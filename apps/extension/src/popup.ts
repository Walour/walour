/// <reference types="chrome" />

import type { ScanResult } from './background'

interface PopupHelloMessage { type: 'POPUP_HELLO'; scan: ScanResult | null }
type PopupState = 'idle' | 'scanning' | 'verdict'

function $(id: string): HTMLElement | null { return document.getElementById(id) }
function setText(id: string, value: string): void { const el = $(id); if (el) el.textContent = value }
function setClass(el: HTMLElement | null, cls: string): void { if (el) el.className = cls }

function riskToLevel(level: string | undefined | null): 'GREEN' | 'AMBER' | 'RED' | 'checking' {
  if (!level) return 'checking'
  const r = level.toUpperCase()
  if (r === 'RED' || r === 'HIGH' || r === 'CRITICAL') return 'RED'
  if (r === 'AMBER' || r === 'MEDIUM' || r === 'WARN' || r === 'WARNING') return 'AMBER'
  if (r === 'GREEN' || r === 'LOW' || r === 'SAFE') return 'GREEN'
  return 'checking'
}

function setState(state: PopupState): void {
  document.body.dataset['state'] = state
  const logoWrap = $('ext-logo-wrap')
  if (logoWrap) {
    logoWrap.classList.toggle('scanning', state === 'scanning')
  }
}

function renderScanning(scan: ScanResult): void {
  setText('scan-host', scan.hostname || '')

  // URL row
  const urlRow = document.querySelector('.ext-check-row[data-key="url"] .ext-check-dot') as HTMLElement | null
  const urlText = $('check-text-url')
  if (scan.domain) {
    const lvl = riskToLevel(scan.domain.level)
    if (urlRow) urlRow.className = `ext-check-dot ${lvl}`
    if (urlText) urlText.textContent = `${scan.domain.level ?? ''}${scan.domain.reason ? ': ' + scan.domain.reason : ''}`
  } else {
    if (urlRow) urlRow.className = 'ext-check-dot checking'
    if (urlText) urlText.textContent = 'Checking…'
  }

  // Token row
  const tokRow = document.querySelector('.ext-check-row[data-key="token"] .ext-check-dot') as HTMLElement | null
  const tokText = $('check-text-token')
  if (scan.token) {
    const lvl = riskToLevel(scan.token.level)
    if (tokRow) tokRow.className = `ext-check-dot ${lvl}`
    const firstReason = scan.token.reasons?.[0]
    if (tokText) tokText.textContent = `${scan.token.level ?? ''}${firstReason ? ': ' + firstReason : ''}`
  } else {
    if (tokRow) tokRow.className = 'ext-check-dot checking'
    if (tokText) tokText.textContent = 'Checking…'
  }

  // Tx row (streaming)
  const txRow = document.querySelector('.ext-check-row[data-key="tx"] .ext-check-dot') as HTMLElement | null
  const txText = $('check-text-tx')
  if (scan.txSummary) {
    if (txRow) txRow.className = 'ext-check-dot GREEN'
    if (txText) txText.textContent = scan.txSummary
  } else {
    if (txRow) txRow.className = 'ext-check-dot checking'
    if (txText) txText.textContent = 'Decoding…'
  }

  // Progress bar — naive: 33/66/100% based on how many sections complete
  const progress = (scan.domain ? 33 : 0) + (scan.token ? 33 : 0) + (scan.txSummary ? 34 : 0)
  const fill = $('scan-bar')
  if (fill) (fill as HTMLElement).style.width = `${progress}%`
}

function renderVerdict(scan: ScanResult): void {
  const isRed  = scan.level === 'RED'
  const isAmber = scan.level === 'AMBER'
  const isSafe = scan.level === 'GREEN'

  const band = $('verdict-band')
  if (band) {
    band.className = 'ext-verdict ' + (isRed ? 'is-risk' : isAmber ? 'is-warn' : isSafe ? 'is-safe' : '')
    // scale-ping on entry
    if (!band.classList.contains('ping')) {
      band.classList.add('ping')
      setTimeout(() => band.classList.remove('ping'), 280)
    }
  }

  const label = $('verdict-label')
  if (label) {
    const labelText = scan.level === 'RED' ? 'High risk'
      : scan.level === 'AMBER' ? 'Caution'
      : scan.level === 'GREEN' ? 'Safe'
      : 'Unknown'
    label.textContent = labelText
    label.className = 'ext-verdict-label ' + (isRed ? 'danger' : isAmber ? 'warn' : isSafe ? 'safe' : '')
  }

  const sub = $('verdict-sub')
  if (sub) {
    const reasons: string[] = []
    if (scan.domain?.reason) reasons.push(scan.domain.reason)
    if (scan.token?.level && scan.token.level !== 'GREEN') {
      const tokenReason = scan.token.reasons?.[0]
      reasons.push(`Token: ${scan.token.level}${tokenReason ? ': ' + tokenReason : ''}`)
    }
    sub.textContent = reasons.join(' · ') || scan.hostname || ''
  }

  // Verdict icon — small inline SVG circle filled with verdict color
  const iconHost = $('verdict-icon')
  if (iconHost) {
    while (iconHost.firstChild) iconHost.removeChild(iconHost.firstChild)
    const svgNS = 'http://www.w3.org/2000/svg'
    const svg = document.createElementNS(svgNS, 'svg')
    svg.setAttribute('width', '20')
    svg.setAttribute('height', '20')
    svg.setAttribute('viewBox', '0 0 24 24')
    svg.setAttribute('fill', 'none')
    const stroke = scan.level === 'RED' ? '#EF4444' : scan.level === 'AMBER' ? '#F59E0B' : scan.level === 'GREEN' ? '#22C55E' : '#8B949E'
    svg.setAttribute('stroke', stroke)
    svg.setAttribute('stroke-width', '2')
    svg.setAttribute('stroke-linecap', 'round')
    svg.setAttribute('stroke-linejoin', 'round')
    const circle = document.createElementNS(svgNS, 'circle')
    circle.setAttribute('cx', '12'); circle.setAttribute('cy', '12'); circle.setAttribute('r', '9')
    svg.appendChild(circle)
    if (scan.level === 'RED' || scan.level === 'AMBER') {
      const path = document.createElementNS(svgNS, 'path')
      path.setAttribute('d', 'M12 8v4M12 16h.01')
      svg.appendChild(path)
    } else if (scan.level === 'GREEN') {
      const path = document.createElementNS(svgNS, 'path')
      path.setAttribute('d', 'M8 12l3 3 5-6')
      svg.appendChild(path)
    }
    iconHost.appendChild(svg)
  }

  // Meter
  const fill = $('meter-fill') as HTMLElement | null
  const pct = Math.round((scan.confidence ?? 0) * 100)
  if (fill) {
    fill.style.width = `${pct}%`
    fill.className = 'ext-meter-fill ' + (isRed ? 'danger' : isAmber ? 'warn' : 'safe')
  }
  setText('meter-pct', `${pct}%`)

  // Threats
  const threatsBlock = $('threats-block')
  const threatsList = $('threats-list')
  if (threatsBlock && threatsList) {
    while (threatsList.firstChild) threatsList.removeChild(threatsList.firstChild)
    const threats: string[] = []
    if (scan.domain?.level && scan.domain.level !== 'GREEN') {
      threats.push(`Domain: ${scan.domain.level}${scan.domain.reason ? ': ' + scan.domain.reason : ''}`)
    }
    if (scan.token?.level && scan.token.level !== 'GREEN') {
      const tokenReason = scan.token.reasons?.[0]
      threats.push(`Token: ${scan.token.level}${tokenReason ? ': ' + tokenReason : ''}`)
    }
    if (threats.length === 0) {
      threatsBlock.setAttribute('hidden', '')
    } else {
      threatsBlock.removeAttribute('hidden')
      for (const t of threats) {
        const item = document.createElement('div')
        item.className = 'ext-threat-item'
        const dot = document.createElement('span')
        dot.style.cssText = 'width:6px;height:6px;border-radius:50%;background:var(--danger);flex-shrink:0;'
        const text = document.createElement('span')
        text.textContent = t
        item.appendChild(dot)
        item.appendChild(text)
        threatsList.appendChild(item)
      }
    }
  }

  // Address card
  setText('address-card-value', scan.hostname || '')
}

function applyHello(scan: ScanResult | null): void {
  if (!scan) {
    setState('idle')
    return
  }
  if (scan.level === 'UNKNOWN') {
    setState('scanning')
    renderScanning(scan)
  } else {
    setState('verdict')
    renderVerdict(scan)
  }
}

function wireIdle(): void {
  // Version
  const manifest = chrome.runtime.getManifest()
  setText('stat-version', `v${manifest.version}`)

  // Stats from chrome.storage.local
  chrome.storage.local.get(['stats.blocks', 'stats.scans'], (res) => {
    setText('stat-blocks', String(res['stats.blocks'] ?? 0))
    setText('stat-scans',  String(res['stats.scans']  ?? 0))
  })

  // Toggle pills sync with chrome.storage.sync.checks.{url,token,tx}
  chrome.storage.sync.get(['checks'], (res) => {
    const checks = (res['checks'] ?? { url: true, token: true, tx: true }) as { url: boolean; token: boolean; tx: boolean }
    for (const key of ['url', 'token', 'tx'] as const) {
      const btn = document.getElementById(`toggle-${key}`)
      if (btn) btn.classList.toggle('on', checks[key])
    }
  })

  for (const key of ['url', 'token', 'tx'] as const) {
    const btn = document.getElementById(`toggle-${key}`)
    btn?.addEventListener('click', () => {
      chrome.storage.sync.get(['checks'], (res) => {
        const checks = (res['checks'] ?? { url: true, token: true, tx: true }) as { url: boolean; token: boolean; tx: boolean }
        checks[key] = !checks[key]
        chrome.storage.sync.set({ checks })
        btn.classList.toggle('on', checks[key])
        // scale-ping (CSS rule .ext-toggle.ping was added in Task 1)
        btn.classList.add('ping')
        setTimeout(() => btn.classList.remove('ping'), 200)
      })
    })
  }

  // Lookup form — inline result, no page navigation
  const form = document.getElementById('ext-lookup-form') as HTMLFormElement | null
  form?.addEventListener('submit', async (e) => {
    e.preventDefault()
    const input = document.getElementById('ext-lookup-input') as HTMLInputElement | null
    const q = (input?.value ?? '').trim()
    if (!q) return

    const resultEl  = document.getElementById('lookup-result')
    const labelEl   = document.getElementById('lookup-result-label')
    const reasonEl  = document.getElementById('lookup-result-reason')
    const btn       = document.getElementById('ext-lookup-btn') as HTMLButtonElement | null

    const bandEl = document.getElementById('lookup-result-band')
    if (resultEl && bandEl && labelEl && reasonEl) {
      labelEl.textContent = 'Checking...'
      labelEl.className = 'ext-verdict-label'
      bandEl.className = 'ext-verdict is-scanning'
      reasonEl.textContent = ''
      resultEl.style.display = 'block'
      if (btn) btn.disabled = true

      try {
        // Mirror background.ts isValidApiBase — reject any apiBase value
        // that wasn't written by us / doesn't look like a real origin.
        const VALID_API_BASE = /^https:\/\/[a-z0-9.-]+(?::\d+)?$/i
        const VALID_DEV_API_BASE = /^http:\/\/localhost:\d+$/
        const isValidApiBase = (s: unknown): s is string =>
          typeof s === 'string' && (VALID_API_BASE.test(s) || VALID_DEV_API_BASE.test(s))
        const apiBase = await new Promise<string>(resolve =>
          chrome.storage.sync.get(['apiBase'], r => {
            const v = r['apiBase']
            resolve(isValidApiBase(v) ? v : __API_BASE__)
          })
        )
        const res = await fetch(`${apiBase}/api/scan?hostname=${encodeURIComponent(q)}`)
        const data = res.ok ? await res.json() : null
        const domain = data?.domain as { level?: string; reason?: string } | null

        const level = (domain?.level ?? 'UNKNOWN').toUpperCase()
        const reason = domain?.reason ?? 'No data returned.'
        const tag = level === 'RED' ? 'High risk' : level === 'AMBER' ? 'Caution' : level === 'GREEN' ? 'Safe' : 'Unknown'

        bandEl.className = 'ext-verdict ' + (level === 'RED' ? 'is-risk' : level === 'AMBER' ? 'is-warn' : level === 'GREEN' ? 'is-safe' : '')
        labelEl.className = 'ext-verdict-label ' + (level === 'RED' ? 'danger' : level === 'AMBER' ? 'warn' : level === 'GREEN' ? 'safe' : '')
        labelEl.textContent = tag
        reasonEl.textContent = reason
      } catch {
        bandEl.className = 'ext-verdict'
        labelEl.className = 'ext-verdict-label'
        labelEl.textContent = 'Unavailable'
        reasonEl.textContent = 'Could not reach the scan service. Is the worker running?'
      } finally {
        if (btn) btn.disabled = false
      }
    }
  })

  // Stats link (intercept to use chrome.tabs.create for consistency)
  const statsLink = document.getElementById('stats-link')
  statsLink?.addEventListener('click', (e) => {
    e.preventDefault()
    chrome.tabs.create({ url: 'https://walour.io/stats' })
  })

  // Verdict CTAs (no-op if no scan; real wiring via background in v0.2)
  document.getElementById('verdict-block')?.addEventListener('click', () => { window.close() })
  document.getElementById('verdict-details')?.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://walour.io/registry' })
  })
}

document.addEventListener('DOMContentLoaded', () => {
  wireIdle()
  setState('idle')

  try {
    const port = chrome.runtime.connect({ name: 'walour-popup' })
    port.onMessage.addListener((msg: PopupHelloMessage) => {
      if (msg.type === 'POPUP_HELLO') applyHello(msg.scan)
    })
    port.onDisconnect.addListener(() => { /* background will reconnect on next open */ })
  } catch {
    // Background SW unavailable — remain in idle
  }
})
