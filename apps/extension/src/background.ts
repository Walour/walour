/// <reference types="chrome" />

interface DrainBlockedEvent {
  event_id: string
  timestamp: number
  wallet_pubkey: string
  blocked_tx_hash: string
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
  domain: { risk: string; reason?: string } | null
  token: { risk: string; symbol?: string } | null
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

// Map of tabId → active port
const activePorts = new Map<number, chrome.runtime.Port>()

// Map of tabId → latest scan result (capped at 50 tabs to avoid memory growth)
const lastScan = new Map<number, ScanResult>()
const LAST_SCAN_CAP = 50

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
  const risks = [domain?.risk, token?.risk].filter(Boolean) as string[]
  if (risks.includes('RED') || risks.includes('HIGH') || risks.includes('CRITICAL')) return 'RED'
  if (risks.includes('AMBER') || risks.includes('MEDIUM') || risks.includes('WARN')) return 'AMBER'
  if (risks.includes('GREEN') || risks.includes('LOW') || risks.includes('SAFE')) return 'GREEN'
  return 'UNKNOWN'
}

function deriveConfidence(domain: ScanResult['domain'], token: ScanResult['token']): number {
  // Naive: 1.0 if both present, 0.5 if one, 0 if neither. Wave 4 may refine.
  const have = (domain ? 1 : 0) + (token ? 1 : 0)
  return have / 2
}

function getApiBase(): Promise<string> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['apiBase'], (result) => {
      resolve((result['apiBase'] as string) || DEFAULT_API_BASE)
    })
  })
}

async function handleScanTx(
  port: chrome.runtime.Port,
  txBase64: string,
  hostname: string,
  tabId: number | undefined
): Promise<void> {
  const apiBase = await getApiBase()

  // Run scan (domain + token risk check)
  try {
    const scanUrl = `${apiBase}/api/scan?hostname=${encodeURIComponent(hostname)}&tx=${encodeURIComponent(txBase64)}`
    const scanRes = await fetch(scanUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (scanRes.ok) {
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
      const domain = { risk: 'UNKNOWN', reason: 'Scan service unavailable' }
      const token = null
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
    }
  } catch {
    const domain = { risk: 'UNKNOWN', reason: 'Network error during scan' }
    const token = null
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
  if (tabId !== undefined) {
    activePorts.set(tabId, port)
  }

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

  port.onDisconnect.addListener(() => {
    if (tabId !== undefined) {
      activePorts.delete(tabId)
    }
  })
})

chrome.tabs.onRemoved.addListener((tabId) => {
  lastScan.delete(tabId)
  activePorts.delete(tabId)
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
