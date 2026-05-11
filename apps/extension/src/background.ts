/// <reference types="chrome" />

interface DrainBlockedEvent {
  event_id: string
  timestamp: number
  wallet_pubkey: string | null
  blocked_tx_hash: string | null
  drainer_target?: string
  block_reason: string
  surface: 'extension'
  app_version: string
}

interface ScanTxMessage {
  type: 'SCAN_TX'
  txBase64: string
  hostname: string
}

interface TelemetryMessage {
  type: 'TELEMETRY'
  event: DrainBlockedEvent
}

type IncomingMessage = ScanTxMessage | TelemetryMessage

export interface ScanResult {
  level: 'GREEN' | 'AMBER' | 'RED' | 'UNKNOWN'
  hostname: string
  domain: { level?: string; reason?: string; confidence?: number } | null
  token: { level?: string; reasons?: string[]; score?: number } | null
  txSummary: string
  confidence: number
  updatedAt: number
}

interface PopupHelloMessage {
  type: 'POPUP_HELLO'
  scan: ScanResult | null
}

declare const __API_BASE__: string
declare const __SUPABASE_URL__: string
declare const __SUPABASE_ANON_KEY__: string

const DEFAULT_API_BASE = __API_BASE__
const SUPABASE_URL = __SUPABASE_URL__
const SUPABASE_ANON_KEY = __SUPABASE_ANON_KEY__

// Map of tabId → latest scan result (capped at 50 tabs to avoid memory growth)
const lastScan = new Map<number, ScanResult>()
const LAST_SCAN_CAP = 50

function updateBadge(tabId: number, level: ScanResult['level']): void {
  const badge: Record<ScanResult['level'], { text: string; color: string }> = {
    RED:     { text: '!',  color: '#EF4444' },
    AMBER:   { text: '·',  color: '#F59E0B' },
    GREEN:   { text: '',   color: '#22C55E' },
    UNKNOWN: { text: '',   color: '#00C9A7' },
  }
  const { text, color } = badge[level]
  chrome.action.setBadgeText({ text, tabId })
  // Always set the color so a transition from a non-empty state (e.g. RED)
  // back to an empty state (e.g. GREEN) doesn't leave the previous color sticking.
  chrome.action.setBadgeBackgroundColor({ color, tabId })
}

function setLastScan(tabId: number, partial: Partial<ScanResult> & { hostname?: string }): void {
  const existing = lastScan.get(tabId)
  const merged: ScanResult = {
    level: partial.level ?? existing?.level ?? 'UNKNOWN',
    hostname: partial.hostname ?? existing?.hostname ?? '',
    domain: partial.domain !== undefined ? partial.domain : existing?.domain ?? null,
    token: partial.token !== undefined ? partial.token : existing?.token ?? null,
    txSummary: partial.txSummary ?? existing?.txSummary ?? '',
    confidence: partial.confidence ?? existing?.confidence ?? 0,
    updatedAt: Date.now(),
  }
  lastScan.set(tabId, merged)
  updateBadge(tabId, merged.level)
  // Evict oldest if over cap
  if (lastScan.size > LAST_SCAN_CAP) {
    let oldestKey: number | null = null
    let oldestTs = Infinity
    for (const [k, v] of lastScan) {
      if (v.updatedAt < oldestTs) { oldestTs = v.updatedAt; oldestKey = k }
    }
    if (oldestKey !== null) lastScan.delete(oldestKey)
  }
}

function deriveLevel(domain: ScanResult['domain'], token: ScanResult['token']): ScanResult['level'] {
  // Worker normalizes risk strings to GREEN|AMBER|RED before they reach here.
  // The earlier HIGH/CRITICAL/MEDIUM/WARN/LOW/SAFE branches were dead code
  // — kept only to mask sloppy upstream contracts. Trim to the canonical set.
  const vals = [
    (domain as any)?.level, (domain as any)?.risk,
    (token as any)?.level,  (token as any)?.risk,
  ].filter(Boolean) as string[]
  if (vals.some(v => v === 'RED')) return 'RED'
  if (vals.some(v => v === 'AMBER')) return 'AMBER'
  if (vals.some(v => v === 'GREEN')) return 'GREEN'
  return 'UNKNOWN'
}

function deriveConfidence(domain: ScanResult['domain'], token: ScanResult['token']): number {
  // domain.confidence is 0–1 threat confidence; token.score is a risk metric, not the same scale.
  // Only use domain.confidence — fall back to level defaults when it's 0 (no signal).
  const domConf = typeof (domain as any)?.confidence === 'number'
    ? (domain as any).confidence as number
    : undefined

  if (domConf !== undefined && domConf > 0) return domConf

  const level = deriveLevel(domain, token)
  return level === 'RED' ? 0.85 : level === 'AMBER' ? 0.55 : level === 'GREEN' ? 0.75 : 0
}

// Reject anything that doesn't look like an https origin (or a localhost dev origin).
// This is the boundary that turns a stored string into a fetch target — if a
// page or another extension manages to write to chrome.storage.sync.apiBase,
// we still won't fetch from a hostile URL.
const VALID_API_BASE = /^https:\/\/[a-z0-9.-]+(?::\d+)?$/i
const VALID_DEV_API_BASE = /^http:\/\/localhost:\d+$/
function isValidApiBase(s: unknown): s is string {
  return typeof s === 'string' && (VALID_API_BASE.test(s) || VALID_DEV_API_BASE.test(s))
}

function getApiBase(): Promise<string> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['apiBase'], (result) => {
      const v = result['apiBase']
      resolve(isValidApiBase(v) ? v : DEFAULT_API_BASE)
    })
  })
}

async function handleScanTx(
  port: chrome.runtime.Port,
  txBase64: string,
  hostname: string,
  tabId: number | undefined
): Promise<void> {
  chrome.storage.local.get(['stats.scans'], (res) => {
    chrome.storage.local.set({ 'stats.scans': ((res['stats.scans'] as number) ?? 0) + 1 })
  })
  const apiBase = await getApiBase()

  // Run scan (domain + token risk check) — up to 3 attempts with exponential backoff
  const scanUrl = `${apiBase}/api/scan?hostname=${encodeURIComponent(hostname)}&tx=${encodeURIComponent(txBase64)}`
  let scanRes: Response | null = null
  let lastErr: unknown = null
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (attempt > 0) await new Promise(r => setTimeout(r, 300 * 2 ** (attempt - 1)))
      scanRes = await fetch(scanUrl, { method: 'GET', headers: { 'Content-Type': 'application/json' } })
      if (scanRes.ok) break
      lastErr = `HTTP ${scanRes.status}`
    } catch (err) {
      lastErr = err
    }
  }

  try {
    if (scanRes?.ok) {
      const { domain, token } = await scanRes.json()
      port.postMessage({ type: 'SCAN_RESULT', domain, token })
      if (tabId !== undefined) {
        setLastScan(tabId, {
          hostname,
          domain,
          token,
          level: deriveLevel(domain, token),
          confidence: deriveConfidence(domain, token),
        })
      }
    } else {
      const domain = { level: 'AMBER', reason: 'Scan service unavailable' }
      const token = null
      port.postMessage({ type: 'SCAN_RESULT', domain, token })
      if (tabId !== undefined) {
        setLastScan(tabId, { hostname, domain, token, level: 'AMBER', confidence: 0 })
      }
    }
  } catch {
    const domain = { level: 'AMBER', reason: 'Network error during scan' }
    const token = null
    port.postMessage({ type: 'SCAN_RESULT', domain, token })
    if (tabId !== undefined) {
      setLastScan(tabId, { hostname, domain, token, level: 'AMBER', confidence: 0 })
    }
  }

  // Run streaming decode
  try {
    const decodeRes = await fetch(`${apiBase}/api/decode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ txBase64 }),
    })

    if (!decodeRes.ok || !decodeRes.body) {
      port.postMessage({ type: 'STREAM_DONE' })
      return
    }

    const reader = decodeRes.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      // Keep last incomplete line in buffer
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue

        const payload = trimmed.slice(5).trim()
        if (payload === '[DONE]') {
          if (tabId !== undefined) {
            setLastScan(tabId, { updatedAt: Date.now() } as Partial<ScanResult>)
          }
          port.postMessage({ type: 'STREAM_DONE' })
          return
        }

        try {
          const parsed = JSON.parse(payload)
          if (parsed.chunk) {
            port.postMessage({ type: 'STREAM_CHUNK', chunk: parsed.chunk })
            if (tabId !== undefined) {
              const cur = lastScan.get(tabId)
              setLastScan(tabId, { txSummary: (cur?.txSummary ?? '') + parsed.chunk })
            }
          }
        } catch {
          // Malformed SSE line — skip
        }
      }
    }

    // Flush remaining buffer
    if (buffer.trim().startsWith('data:')) {
      const payload = buffer.trim().slice(5).trim()
      if (payload !== '[DONE]') {
        try {
          const parsed = JSON.parse(payload)
          if (parsed.chunk) {
            port.postMessage({ type: 'STREAM_CHUNK', chunk: parsed.chunk })
            if (tabId !== undefined) {
              const cur = lastScan.get(tabId)
              setLastScan(tabId, { txSummary: (cur?.txSummary ?? '') + parsed.chunk })
            }
          }
        } catch {
          // Ignore
        }
      }
    }

    if (tabId !== undefined) {
      setLastScan(tabId, { updatedAt: Date.now() } as Partial<ScanResult>)
    }
    port.postMessage({ type: 'STREAM_DONE' })
  } catch {
    port.postMessage({ type: 'STREAM_DONE' })
  }
}

async function handleTelemetry(event: DrainBlockedEvent): Promise<void> {
  chrome.storage.local.get(['stats.blocks'], (res) => {
    chrome.storage.local.set({ 'stats.blocks': ((res['stats.blocks'] as number) ?? 0) + 1 })
  })
  // Fire-and-forget — never log keys or seed phrases, only pubkeys
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/drain_blocked_events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        event_id: event.event_id,
        timestamp: event.timestamp,
        wallet_pubkey: event.wallet_pubkey,
        blocked_tx_hash: event.blocked_tx_hash,
        drainer_target: event.drainer_target ?? null,
        block_reason: event.block_reason,
        surface: event.surface,
        app_version: event.app_version,
      }),
    })
  } catch {
    // Telemetry failure must never surface to user
  }
}

chrome.runtime.onMessage.addListener((msg: IncomingMessage, sender) => {
  if (msg.type === 'TELEMETRY' && sender.id === chrome.runtime.id) {
    handleTelemetry(msg.event)
  }
})

chrome.runtime.onConnect.addListener((port) => {
  // Reject any port not originated by our own extension. With
  // externally_connectable.ids = [], Chrome should already block external
  // connections, but a defense-in-depth check costs us nothing.
  if (port.sender?.id !== chrome.runtime.id) {
    try { port.disconnect() } catch { /* already gone */ }
    return
  }

  if (port.name === 'walour-popup') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id
      const scan = tabId !== undefined ? lastScan.get(tabId) ?? null : null
      const msg: PopupHelloMessage = { type: 'POPUP_HELLO', scan }
      try { port.postMessage(msg) } catch { /* port may already be closed */ }
    })
    port.onDisconnect.addListener(() => { /* no state to clean up */ })
    return
  }

  if (port.name !== 'walour-scan') return

  const tabId = port.sender?.tab?.id

  port.onMessage.addListener((msg: IncomingMessage) => {
    // Security: only process messages from our own extension
    if (port.sender?.id !== chrome.runtime.id) return

    if (msg.type === 'SCAN_TX') {
      handleScanTx(port, msg.txBase64, msg.hostname, tabId).catch(() => {
        port.postMessage({ type: 'STREAM_DONE' })
      })
    } else if (msg.type === 'TELEMETRY') {
      handleTelemetry(msg.event)
    }
  })

  port.onDisconnect.addListener(() => { /* no scan state to clean up per-port */ })
})

chrome.tabs.onRemoved.addListener((tabId) => {
  lastScan.delete(tabId)
})

chrome.tabs.onActivated.addListener(({ tabId }) => {
  const scan = lastScan.get(tabId)
  updateBadge(tabId, scan?.level ?? 'UNKNOWN')
})

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({
    enabled: true,
    apiBase: DEFAULT_API_BASE,
    checks: {
      url: true,
      token: true,
      tx: true,
    },
  })
})
