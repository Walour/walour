// Overlay module — vanilla TypeScript, Shadow DOM only
// Security: NEVER use innerHTML. All DOM construction via createElement + textContent.

const ROOT_ID = 'walour-root'

let shadowRoot: ShadowRoot | null = null
let decisionCallback: ((allow: boolean) => void) | null = null
let streamTextNode: Text | null = null
let backdropEl: HTMLDivElement | null = null

const OVERLAY_CSS = `
  .walour-overlay {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 2147483647;
    width: 360px;
    background: #0D1117;
    border: 1px solid #30363D;
    border-radius: 12px;
    padding: 20px;
    font-family: 'SF Pro Display', 'Roboto', 'Segoe UI', system-ui, sans-serif;
    color: #E6EDF3;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
    box-sizing: border-box;
  }

  .walour-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-bottom: 16px;
    border-bottom: 1px solid #30363D;
    margin-bottom: 16px;
    font-size: 14px;
    font-weight: 600;
  }

  .walour-logo {
    color: #00C9A7;
    font-size: 20px;
  }

  .walour-rows {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 20px;
  }

  .walour-row {
    display: grid;
    grid-template-columns: 12px 60px 1fr;
    align-items: flex-start;
    gap: 8px;
    font-size: 13px;
  }

  .walour-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-top: 4px;
    flex-shrink: 0;
  }

  .walour-dot.checking {
    background: #8B949E;
    animation: walour-pulse 1s ease-in-out infinite;
  }

  .walour-dot.GREEN {
    background: #22C55E;
  }

  .walour-dot.AMBER {
    background: #F59E0B;
  }

  .walour-dot.RED {
    background: #EF4444;
  }

  .walour-label {
    color: #8B949E;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding-top: 2px;
  }

  .walour-text {
    line-height: 1.5;
    color: #E6EDF3;
  }

  .walour-stream {
    white-space: pre-wrap;
  }

  .walour-actions {
    display: flex;
    gap: 8px;
  }

  .walour-btn {
    flex: 1;
    padding: 10px 16px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    border: none;
    transition: background 0.15s;
    min-height: 40px;
    font-family: inherit;
  }

  .walour-btn:focus-visible {
    outline: 2px solid #00C9A7;
    outline-offset: 2px;
  }

  .walour-btn-primary {
    background: #00C9A7;
    color: #0D1117;
  }

  .walour-btn-primary:hover {
    background: #00b396;
  }

  .walour-btn-ghost {
    background: transparent;
    color: #8B949E;
    border: 1px solid #30363D;
  }

  .walour-btn-ghost:hover {
    color: #E6EDF3;
    border-color: #8B949E;
  }

  @keyframes walour-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  @media (prefers-reduced-motion: reduce) {
    .walour-dot.checking {
      animation: none;
    }
  }
`

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
  text.textContent = 'Checking\u2026'

  row.appendChild(dot)
  row.appendChild(label)
  row.appendChild(text)

  return { row, dot, text }
}

export function showOverlay(): void {
  // Remove any existing overlay first
  hideOverlay()

  decisionCallback = null
  streamTextNode = null

  // Backdrop (outside shadow root, behind overlay)
  backdropEl = document.createElement('div')
  backdropEl.id = 'walour-backdrop'
  backdropEl.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:2147483646;'
  document.body.appendChild(backdropEl)

  // Shadow host
  const host = document.createElement('div')
  host.id = ROOT_ID
  document.body.appendChild(host)

  shadowRoot = host.attachShadow({ mode: 'closed' })

  // Inject styles
  const style = document.createElement('style')
  style.textContent = OVERLAY_CSS
  shadowRoot.appendChild(style)

  // Build overlay container
  const overlay = document.createElement('div')
  overlay.className = 'walour-overlay'

  // Header
  const header = document.createElement('div')
  header.className = 'walour-header'

  const logo = document.createElement('span')
  logo.className = 'walour-logo'
  logo.textContent = '\u2B21' // ⬡

  const title = document.createElement('span')
  title.textContent = 'Walour Security Check'

  header.appendChild(logo)
  header.appendChild(title)

  // Rows
  const rowsContainer = document.createElement('div')
  rowsContainer.className = 'walour-rows'

  const urlRow = buildRow('url')
  const tokenRow = buildRow('token')
  const txRow = buildRow('tx')

  // Keep reference to stream text node for appendStream
  streamTextNode = document.createTextNode('Checking\u2026')
  // Replace the default textContent with a live text node
  txRow.text.textContent = ''
  txRow.text.appendChild(streamTextNode)

  rowsContainer.appendChild(urlRow.row)
  rowsContainer.appendChild(tokenRow.row)
  rowsContainer.appendChild(txRow.row)

  // Actions
  const actions = document.createElement('div')
  actions.className = 'walour-actions'

  const blockBtn = document.createElement('button')
  blockBtn.className = 'walour-btn walour-btn-primary'
  blockBtn.id = 'walour-block'
  blockBtn.textContent = "Don't sign"
  blockBtn.addEventListener('click', () => {
    if (decisionCallback) decisionCallback(false)
  })

  const allowBtn = document.createElement('button')
  allowBtn.className = 'walour-btn walour-btn-ghost'
  allowBtn.id = 'walour-allow'
  allowBtn.textContent = 'Sign anyway'
  allowBtn.addEventListener('click', () => {
    if (decisionCallback) decisionCallback(true)
  })

  actions.appendChild(blockBtn)
  actions.appendChild(allowBtn)

  overlay.appendChild(header)
  overlay.appendChild(rowsContainer)
  overlay.appendChild(actions)

  shadowRoot.appendChild(overlay)
}

export function hideOverlay(): void {
  const existing = document.getElementById(ROOT_ID)
  if (existing) existing.remove()

  const backdrop = document.getElementById('walour-backdrop')
  if (backdrop) backdrop.remove()

  shadowRoot = null
  streamTextNode = null
  decisionCallback = null
  backdropEl = null
}

export function updateRow(
  key: 'url' | 'token' | 'tx',
  level: 'checking' | 'GREEN' | 'AMBER' | 'RED',
  text: string
): void {
  if (!shadowRoot) return

  // Find the row by data-key
  const rows = shadowRoot.querySelectorAll('.walour-row')
  for (const row of rows) {
    const el = row as HTMLElement
    if (el.dataset['key'] !== key) continue

    const dot = el.querySelector('.walour-dot')
    const textEl = el.querySelector('.walour-text')

    if (dot) {
      dot.className = `walour-dot ${level}`
    }

    if (textEl) {
      if (key === 'tx') {
        // For tx row, replace the stream text node
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
  // textContent += is safe — no HTML parsing
  streamTextNode.textContent = (streamTextNode.textContent ?? '') + chunk
}

export function onDecision(cb: (allow: boolean) => void): void {
  decisionCallback = cb
}
