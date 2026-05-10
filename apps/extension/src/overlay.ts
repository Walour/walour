// Overlay module — vanilla TypeScript, Shadow DOM only
// Security: NEVER use innerHTML. All DOM construction via createElement + textContent
// (or createElementNS for SVG). Token block is duplicated from packages/tokens/tokens.css
// because Shadow DOM does not inherit document <link> stylesheets — keep both in sync.

const ROOT_ID = 'walour-root'
const SVG_NS = 'http://www.w3.org/2000/svg'

export interface SimDelta {
  mint: string
  symbol?: string  // DH-05: enriched from Jupiter V1 by worker
  change: number
  decimals: number
  uiChange: string
}

let shadowRoot: ShadowRoot | null = null
let decisionCallback: ((allow: boolean) => void) | null = null
let streamTextNode: Text | null = null
let backdropEl: HTMLDivElement | null = null
let allowBtnRef: HTMLButtonElement | null = null
let simRowRef: HTMLElement | null = null
let currentVerdict: 'GREEN' | 'AMBER' | 'RED' | 'UNKNOWN' = 'UNKNOWN'

let holdTimer: ReturnType<typeof setTimeout> | null = null
let holdInterval: ReturnType<typeof setInterval> | null = null

const HOLD_MS = 1500

const OVERLAY_CSS = `
  /* === Tokens (mirror of packages/tokens/tokens.css :root) === */
  :host, .walour-host {
    --bg: #0D1117;
    --surface: #161B22;
    --border: #30363D;
    --text: #E6EDF3;
    --text-muted: #8B949E;
    --accent: #00C9A7;
    --safe: #22C55E;
    --warning: #F59E0B;
    --danger: #EF4444;
    --danger-soft: rgba(239, 68, 68, 0.08);
    --accent-soft: rgba(0, 201, 167, 0.08);
    --accent-glow: rgba(0, 201, 167, 0.35);
    --radius: 8px;
    --radius-pill: 999px;
    --font-sys: 'SF Pro Display', 'Roboto', 'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  }

  /* === Glass card === */
  .walour-overlay {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 2147483647;
    width: 380px;
    /* Fallback first (no backdrop-filter) */
    background: rgba(22, 27, 34, 0.92);
    /* Glass layer (where supported) */
    background: rgba(22, 27, 34, 0.55);
    border: 1px solid rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(18px) saturate(140%);
    -webkit-backdrop-filter: blur(18px) saturate(140%);
    border-radius: 14px;
    color: var(--text);
    font-family: var(--font-sys);
    font-size: 13px;
    box-sizing: border-box;
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.06) inset,
      0 0 0 1px rgba(0, 0, 0, 0.2),
      0 12px 40px rgba(0, 0, 0, 0.5),
      0 0 60px rgba(0, 201, 167, 0.06);
    /* IMPORTANT: do not set overflow:hidden here — would clip backdrop-filter */
  }

  .walour-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 16px;
    border-bottom: 1px solid var(--border);
  }
  .walour-brand {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    font-weight: 600;
    letter-spacing: 0.04em;
  }
  .walour-brand svg { display: block; }

  /* === Verdict band === */
  .walour-verdict {
    padding: 16px 18px;
    display: flex;
    gap: 12px;
    align-items: flex-start;
    border-bottom: 1px solid var(--border);
    transition: background 300ms ease;
  }
  .walour-verdict.is-risk     { background: var(--danger-soft); border-left: 3px solid var(--danger); }
  .walour-verdict.is-warn     { background: rgba(245,158,11,.08); border-left: 3px solid var(--warning); }
  .walour-verdict.is-scanning { background: var(--accent-soft); border-left: 3px solid var(--accent); }
  .walour-verdict.is-safe     { background: rgba(34,197,94,.06); border-left: 3px solid var(--safe); }
  .walour-verdict-label {
    font-size: 18px;
    font-weight: 700;
    line-height: 1.1;
  }
  .walour-verdict-label.danger   { color: var(--danger); }
  .walour-verdict-label.warn     { color: var(--warning); }
  .walour-verdict-label.scanning { color: var(--accent); }
  .walour-verdict-label.safe     { color: var(--safe); }
  .walour-verdict-sub {
    font-size: 12px;
    color: var(--text-muted);
    margin-top: 4px;
  }

  /* === Confidence meter === */
  .walour-meter {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 10px;
    align-items: center;
    padding: 10px 18px;
    border-bottom: 1px solid var(--border);
  }
  .walour-meter-label { font-size: 11px; color: var(--text-muted); letter-spacing: 0.04em; text-transform: uppercase; }
  .walour-meter-track { height: 5px; background: var(--border); border-radius: 3px; overflow: hidden; }
  .walour-meter-fill  { height: 100%; border-radius: 3px; transition: width 600ms ease-out; width: 0%; }
  .walour-meter-fill.danger { background: var(--danger); }
  .walour-meter-fill.warn   { background: var(--warning); }
  .walour-meter-fill.safe   { background: var(--safe); }
  .walour-meter-pct { font-size: 12px; font-weight: 600; }

  /* === Threats list === */
  .walour-threats { padding: 12px 18px; border-bottom: 1px solid var(--border); }
  .walour-threats[hidden] { display: none; }
  .walour-threats-header {
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: 8px;
  }
  .walour-threat-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
    font-size: 12px;
    color: var(--text);
    animation: walour-feedIn 200ms ease-out both;
  }
  .walour-threat-dot {
    width: 6px; height: 6px; border-radius: 50%; background: var(--danger); flex-shrink: 0;
  }

  /* === Check rows === */
  .walour-rows {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px 18px;
    border-bottom: 1px solid var(--border);
  }
  .walour-row {
    display: grid;
    grid-template-columns: 12px 80px 1fr;
    align-items: flex-start;
    gap: 8px;
    font-size: 12px;
  }
  .walour-dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    margin-top: 4px;
    background: var(--text-muted);
    flex-shrink: 0;
  }
  .walour-dot.checking { background: var(--text-muted); animation: walour-pulse 1s ease-in-out infinite; }
  .walour-dot.GREEN { background: var(--safe); }
  .walour-dot.AMBER { background: var(--warning); }
  .walour-dot.RED   { background: var(--danger); }
  .walour-label {
    color: var(--text-muted);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding-top: 2px;
  }
  .walour-text {
    color: var(--text);
    line-height: 1.45;
    min-width: 0;
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  .walour-stream { white-space: pre-wrap; }

  /* === Actions === */
  .walour-actions { display: flex; gap: 10px; padding: 12px 14px; }
  .walour-btn {
    flex: 1;
    height: 40px;
    border-radius: 8px;
    font-weight: 600;
    font-size: 13px;
    border: 1px solid transparent;
    cursor: pointer;
    transition: all 180ms ease;
    font-family: inherit;
    color: var(--text);
    background: transparent;
    user-select: none;
  }
  .walour-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .walour-btn-primary { background: var(--danger); color: white; border-color: var(--danger); }
  .walour-btn-primary:hover { filter: brightness(1.12); }
  .walour-btn-ghost { background: transparent; border-color: var(--text-muted); color: var(--text-muted); }
  .walour-btn-ghost:hover { color: var(--text); border-color: var(--text); }

  /* Press-and-hold variant on RED */
  .walour-btn-hold {
    position: relative;
    overflow: hidden;
    border-color: var(--danger);
    color: var(--danger);
    background: rgba(239, 68, 68, 0.06);
  }
  .walour-btn-hold::before {
    content: '';
    position: absolute;
    inset: 0;
    background: conic-gradient(
      var(--danger) var(--hold-pct, 0%),
      transparent var(--hold-pct, 0%)
    );
    opacity: 0.22;
    pointer-events: none;
    border-radius: inherit;
  }

  /* === Animations === */
  @keyframes walour-pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%      { opacity: 0.4; transform: scale(0.85); }
  }
  @keyframes walour-feedIn {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes walour-scalePing {
    0%   { transform: translate(-50%, -50%) scale(0.96); }
    60%  { transform: translate(-50%, -50%) scale(1.015); }
    100% { transform: translate(-50%, -50%) scale(1.0); }
  }
  .walour-overlay.ping { animation: walour-scalePing 260ms ease-out 1; }

  @media (prefers-reduced-motion: reduce) {
    .walour-dot.checking,
    .walour-threat-item,
    .walour-overlay.ping { animation: none !important; }
    .walour-meter-fill,
    .walour-verdict { transition: none !important; }
  }
`

function buildHexLogo(size = 28): SVGSVGElement {
  // Verbatim from apps/web/components/layout/Nav.tsx lines 113-179.
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('viewBox', '-80 -80 160 160')
  svg.setAttribute('width', String(size))
  svg.setAttribute('height', String(size))
  svg.setAttribute('aria-hidden', 'true')

  const polygons: Array<[string, Record<string, string>]> = [
    ['0,-68 59,-34 59,34 0,68 -59,34 -59,-34', { 'stroke-width': '4.5' }],
    ['0,-46 40,-23 40,23 0,46 -40,23 -40,-23', { 'stroke-width': '1.5', opacity: '0.3' }],
    ['-28,-36 -16,-29 -16,-16 -28,-9 -40,-16 -40,-29', { 'stroke-width': '0.8', opacity: '0.18' }],
    ['28,-36 40,-29 40,-16 28,-9 16,-16 16,-29',       { 'stroke-width': '0.8', opacity: '0.18' }],
    ['0,13 12,20 12,33 0,40 -12,33 -12,20',           { 'stroke-width': '0.8', opacity: '0.18' }],
  ]
  for (const [pts, attrs] of polygons) {
    const p = document.createElementNS(SVG_NS, 'polygon')
    p.setAttribute('points', pts)
    p.setAttribute('fill', 'none')
    p.setAttribute('stroke', '#00C9A7')
    p.setAttribute('stroke-linejoin', 'round')
    for (const [k, v] of Object.entries(attrs)) p.setAttribute(k, v)
    svg.appendChild(p)
  }

  const polylines: string[] = ['-40,-23 -18,26 0,6', '40,-23 18,26 0,6']
  for (const pts of polylines) {
    const p = document.createElementNS(SVG_NS, 'polyline')
    p.setAttribute('points', pts)
    p.setAttribute('fill', 'none')
    p.setAttribute('stroke', '#00C9A7')
    p.setAttribute('stroke-width', '3.5')
    p.setAttribute('stroke-linejoin', 'round')
    p.setAttribute('stroke-linecap', 'round')
    svg.appendChild(p)
  }

  const circles: Array<[number, number]> = [[0,-68],[59,-34],[59,34],[0,68],[-59,34],[-59,-34]]
  for (const [cx, cy] of circles) {
    const c = document.createElementNS(SVG_NS, 'circle')
    c.setAttribute('cx', String(cx))
    c.setAttribute('cy', String(cy))
    c.setAttribute('r', '4.5')
    c.setAttribute('fill', '#0D1117')
    c.setAttribute('stroke', '#00C9A7')
    c.setAttribute('stroke-width', '1.8')
    svg.appendChild(c)
  }

  return svg
}

function buildRow(key: 'url' | 'token' | 'tx'): { row: HTMLDivElement; dot: HTMLSpanElement; text: HTMLSpanElement } {
  const labelMap = { url: 'URL', token: 'Token', tx: 'Transaction' }

  const row = document.createElement('div')
  row.className = 'walour-row'
  row.dataset['key'] = key

  const dot = document.createElement('span')
  dot.className = 'walour-dot checking'

  const label = document.createElement('span')
  label.className = 'walour-label'
  label.textContent = labelMap[key]

  const text = document.createElement('span')
  text.className = key === 'tx' ? 'walour-text walour-stream' : 'walour-text'
  text.textContent = 'Checking…'

  row.appendChild(dot)
  row.appendChild(label)
  row.appendChild(text)

  return { row, dot, text }
}

function cancelHold(): void {
  if (holdTimer) { clearTimeout(holdTimer); holdTimer = null }
  if (holdInterval) { clearInterval(holdInterval); holdInterval = null }
  if (allowBtnRef) allowBtnRef.style.setProperty('--hold-pct', '0%')
}

function attachAllowHandlers(btn: HTMLButtonElement): void {
  btn.addEventListener('pointerdown', () => {
    if (currentVerdict !== 'RED') {
      // Non-RED: one-tap allow
      decisionCallback?.(true)
      return
    }
    // RED: press-and-hold required
    cancelHold()
    const start = Date.now()
    holdInterval = setInterval(() => {
      const pct = Math.min(((Date.now() - start) / HOLD_MS) * 100, 100)
      btn.style.setProperty('--hold-pct', `${pct}%`)
    }, 16)
    holdTimer = setTimeout(() => {
      cancelHold()
      decisionCallback?.(true)
    }, HOLD_MS)
  })
  btn.addEventListener('pointerup',     cancelHold)
  btn.addEventListener('pointerleave',  cancelHold)
  btn.addEventListener('pointercancel', cancelHold)
}

export function showOverlay(): void {
  hideOverlay()

  decisionCallback = null
  streamTextNode = null
  currentVerdict = 'UNKNOWN'

  // Backdrop
  backdropEl = document.createElement('div')
  backdropEl.id = 'walour-backdrop'
  backdropEl.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:2147483646;'
  document.body.appendChild(backdropEl)

  // Shadow host
  const host = document.createElement('div')
  host.id = ROOT_ID
  document.body.appendChild(host)
  shadowRoot = host.attachShadow({ mode: 'closed' })

  const style = document.createElement('style')
  style.textContent = OVERLAY_CSS
  shadowRoot.appendChild(style)

  // Overlay container
  const overlay = document.createElement('div')
  overlay.className = 'walour-overlay walour-host'

  // Header
  const header = document.createElement('div')
  header.className = 'walour-header'

  const brand = document.createElement('div')
  brand.className = 'walour-brand'
  brand.appendChild(buildHexLogo(28))
  const brandName = document.createElement('span')
  brandName.textContent = 'Walour Security Check'
  brand.appendChild(brandName)
  header.appendChild(brand)

  // Verdict band
  const verdict = document.createElement('div')
  verdict.className = 'walour-verdict is-scanning'
  verdict.dataset['key'] = 'verdict'

  const verdictBody = document.createElement('div')
  const verdictLabel = document.createElement('div')
  verdictLabel.className = 'walour-verdict-label scanning'
  verdictLabel.textContent = 'Scanning…'
  verdictLabel.dataset['key'] = 'verdict-label'
  const verdictSub = document.createElement('div')
  verdictSub.className = 'walour-verdict-sub'
  verdictSub.textContent = 'Running security checks before signing'
  verdictSub.dataset['key'] = 'verdict-sub'
  verdictBody.appendChild(verdictLabel)
  verdictBody.appendChild(verdictSub)
  verdict.appendChild(verdictBody)

  // Meter
  const meter = document.createElement('div')
  meter.className = 'walour-meter'
  const meterLabel = document.createElement('span')
  meterLabel.className = 'walour-meter-label'
  meterLabel.textContent = 'Confidence'
  const meterTrack = document.createElement('span')
  meterTrack.className = 'walour-meter-track'
  const meterFill = document.createElement('span')
  meterFill.className = 'walour-meter-fill safe'
  meterFill.dataset['key'] = 'meter-fill'
  meterTrack.appendChild(meterFill)
  const meterPct = document.createElement('span')
  meterPct.className = 'walour-meter-pct'
  meterPct.textContent = '0%'
  meterPct.dataset['key'] = 'meter-pct'
  meter.appendChild(meterLabel)
  meter.appendChild(meterTrack)
  meter.appendChild(meterPct)

  // Threats
  const threats = document.createElement('div')
  threats.className = 'walour-threats'
  threats.setAttribute('hidden', '')
  threats.dataset['key'] = 'threats'
  const threatsHeader = document.createElement('div')
  threatsHeader.className = 'walour-threats-header'
  threatsHeader.textContent = 'Detected threats'
  const threatsList = document.createElement('div')
  threatsList.dataset['key'] = 'threats-list'
  threats.appendChild(threatsHeader)
  threats.appendChild(threatsList)

  // Rows
  const rowsContainer = document.createElement('div')
  rowsContainer.className = 'walour-rows'
  const urlRow   = buildRow('url')
  const tokenRow = buildRow('token')
  const txRow    = buildRow('tx')

  streamTextNode = document.createTextNode('Checking…')
  txRow.text.textContent = ''
  txRow.text.appendChild(streamTextNode)

  rowsContainer.appendChild(urlRow.row)
  rowsContainer.appendChild(tokenRow.row)
  rowsContainer.appendChild(txRow.row)

  // Simulation delta row
  const simRow = document.createElement('div')
  simRow.className = 'walour-sim-row'
  simRow.style.cssText = 'display:none; padding:6px 12px; font-size:12px; color:var(--text-muted,#8B949E); letter-spacing:0.02em; font-family:inherit;'
  simRowRef = simRow

  // Actions
  const actions = document.createElement('div')
  actions.className = 'walour-actions'

  const blockBtn = document.createElement('button')
  blockBtn.className = 'walour-btn walour-btn-primary'
  blockBtn.id = 'walour-block'
  blockBtn.type = 'button'
  blockBtn.textContent = "Don't sign"
  blockBtn.addEventListener('click', () => { decisionCallback?.(false) })

  const allowBtn = document.createElement('button')
  allowBtn.className = 'walour-btn walour-btn-ghost'
  allowBtn.id = 'walour-allow'
  allowBtn.type = 'button'
  allowBtn.textContent = 'Sign anyway'
  allowBtn.style.setProperty('--hold-pct', '0%')
  attachAllowHandlers(allowBtn)
  allowBtnRef = allowBtn

  actions.appendChild(blockBtn)
  actions.appendChild(allowBtn)

  overlay.appendChild(header)
  overlay.appendChild(verdict)
  overlay.appendChild(meter)
  overlay.appendChild(threats)
  overlay.appendChild(rowsContainer)
  overlay.appendChild(simRow)
  overlay.appendChild(actions)

  shadowRoot.appendChild(overlay)
}

export function hideOverlay(): void {
  cancelHold()
  const existing = document.getElementById(ROOT_ID)
  if (existing) existing.remove()
  const backdrop = document.getElementById('walour-backdrop')
  if (backdrop) backdrop.remove()
  shadowRoot = null
  streamTextNode = null
  decisionCallback = null
  backdropEl = null
  allowBtnRef = null
  simRowRef = null
  currentVerdict = 'UNKNOWN'
}

export function updateRow(
  key: 'url' | 'token' | 'tx',
  level: 'checking' | 'GREEN' | 'AMBER' | 'RED',
  text: string | null  // null = update dot only, preserve existing text
): void {
  if (!shadowRoot) return
  const rows = Array.from(shadowRoot.querySelectorAll('.walour-row'))
  for (const row of rows) {
    const el = row as HTMLElement
    if (el.dataset['key'] !== key) continue
    const dot = el.querySelector('.walour-dot')
    const textEl = el.querySelector('.walour-text')
    if (dot) dot.className = `walour-dot ${level}`
    if (textEl && text !== null) {
      if (key === 'tx') {
        while (textEl.firstChild) textEl.removeChild(textEl.firstChild)
        streamTextNode = document.createTextNode(text)
        textEl.appendChild(streamTextNode)
      } else {
        textEl.textContent = text
      }
    }
    break
  }
}

export function appendStream(chunk: string): void {
  if (!streamTextNode) return
  streamTextNode.textContent = (streamTextNode.textContent ?? '') + chunk
}

export function onDecision(cb: (allow: boolean) => void): void {
  decisionCallback = cb
}

export function setVerdict(
  level: 'GREEN' | 'AMBER' | 'RED' | 'UNKNOWN',
  confidence: number,
  threats?: string[]
): void {
  currentVerdict = level

  if (!shadowRoot) return

  // Verdict band
  const band = shadowRoot.querySelector('.walour-verdict[data-key="verdict"]') as HTMLElement | null
  const labelEl = shadowRoot.querySelector('[data-key="verdict-label"]') as HTMLElement | null
  const subEl   = shadowRoot.querySelector('[data-key="verdict-sub"]')   as HTMLElement | null

  const isRed  = level === 'RED'
  const isAmber = level === 'AMBER'
  const isSafe = level === 'GREEN'

  if (band) {
    band.className = 'walour-verdict ' + (isRed ? 'is-risk' : isAmber ? 'is-warn' : isSafe ? 'is-safe' : 'is-scanning')
  }
  if (labelEl) {
    labelEl.className = 'walour-verdict-label ' + (isRed ? 'danger' : isAmber ? 'warn' : isSafe ? 'safe' : 'scanning')
    labelEl.textContent =
      level === 'RED'   ? 'High risk: drainer detected' :
      level === 'AMBER' ? 'Caution: review before signing' :
      level === 'GREEN' ? 'Looks safe' :
                          'Scanning…'
  }
  if (subEl) {
    subEl.textContent =
      level === 'RED'   ? 'Press and hold “Sign anyway” for 1.5s to override.' :
      level === 'AMBER' ? 'At least one signal warrants review.' :
      level === 'GREEN' ? 'No threats detected.' :
                          'Running security checks before signing'
  }

  // Meter
  const fill = shadowRoot.querySelector('[data-key="meter-fill"]') as HTMLElement | null
  const pctEl = shadowRoot.querySelector('[data-key="meter-pct"]') as HTMLElement | null
  const pct = Math.max(0, Math.min(1, confidence))
  if (fill) {
    fill.style.width = `${Math.round(pct * 100)}%`
    fill.style.background = level === 'RED' ? '#EF4444' : level === 'AMBER' ? '#F59E0B' : '#22C55E'
  }
  if (pctEl) pctEl.textContent = `${Math.round(pct * 100)}%`

  // Threats list
  const threatsBlock = shadowRoot.querySelector('[data-key="threats"]') as HTMLElement | null
  const threatsList  = shadowRoot.querySelector('[data-key="threats-list"]') as HTMLElement | null
  if (threatsBlock && threatsList) {
    while (threatsList.firstChild) threatsList.removeChild(threatsList.firstChild)
    const list = threats ?? []
    if (list.length === 0 || isSafe) {
      threatsBlock.setAttribute('hidden', '')
    } else {
      threatsBlock.removeAttribute('hidden')
      for (const t of list) {
        const item = document.createElement('div')
        item.className = 'walour-threat-item'
        const dot = document.createElement('span')
        dot.className = 'walour-threat-dot'
        const text = document.createElement('span')
        text.textContent = t
        item.appendChild(dot)
        item.appendChild(text)
        threatsList.appendChild(item)
      }
    }
  }

  // Update allow button visual and label based on verdict
  if (allowBtnRef) {
    if (level === 'RED') {
      allowBtnRef.className = 'walour-btn walour-btn-hold'
      allowBtnRef.textContent = 'Sign anyway'
      allowBtnRef.setAttribute('aria-label', 'Press and hold to sign anyway')
    } else {
      allowBtnRef.className = 'walour-btn walour-btn-ghost'
      allowBtnRef.textContent = level === 'GREEN' ? 'Sign' : 'Sign anyway'
      allowBtnRef.removeAttribute('aria-label')
      allowBtnRef.style.setProperty('--hold-pct', '0%')
    }
  }

  // scale-ping the overlay card when verdict transitions to a definite state
  if (level !== 'UNKNOWN') {
    const card = shadowRoot.querySelector('.walour-overlay') as HTMLElement | null
    if (card && !card.classList.contains('ping')) {
      card.classList.add('ping')
      setTimeout(() => card.classList.remove('ping'), 320)
    }
  }
}

export function updateSimulation(deltas: SimDelta[], solChangeLamports: number): void {
  if (!simRowRef) return
  const parts: string[] = []
  if (solChangeLamports !== 0) {
    const sol = solChangeLamports / 1_000_000_000
    parts.push((sol >= 0 ? '+' : '') + sol.toFixed(4) + ' SOL')
  }
  for (const d of deltas) {
    parts.push(d.uiChange + ' ' + (d.symbol ?? (d.mint.slice(0, 4) + '...')))
  }
  if (parts.length === 0) return
  simRowRef.textContent = parts.join('   ')
  simRowRef.style.display = 'block'
  const hasLoss = solChangeLamports < 0 || deltas.some(d => d.change < 0)
  simRowRef.style.color = hasLoss ? 'var(--danger,#EF4444)' : 'var(--safe,#22C55E)'
}
