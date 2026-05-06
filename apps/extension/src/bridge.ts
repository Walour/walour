// Isolated world bridge — has chrome API access
// Relays messages between MAIN world (content.ts) and background service worker

const ports = new Map<string, chrome.runtime.Port>()

window.addEventListener('message', (e: MessageEvent) => {
  if (!e.data?.__walour_req) return
  const { reqId, type, txBase64, hostname } = e.data
  if (type === 'TELEMETRY') {
    try { chrome.runtime.sendMessage({ type: 'TELEMETRY', event: e.data.event }) } catch { /* ignore */ }
    return
  }
  if (type !== 'SCAN_TX') return
  if (ports.size >= 3) return  // rate-limit: at most 3 concurrent scans per page

  try {
    const port = chrome.runtime.connect({ name: 'walour-scan' })
    ports.set(reqId, port)

    port.onMessage.addListener((msg: unknown) => {
      window.postMessage({ __walour: true, reqId, msg }, '*')
    })

    port.onDisconnect.addListener(() => {
      ports.delete(reqId)
      window.postMessage({ __walour: true, reqId, msg: { type: 'DISCONNECTED' } }, '*')
    })

    port.postMessage({ type: 'SCAN_TX', txBase64, hostname })
  } catch {
    // chrome.runtime unavailable — fail open silently
  }
})
