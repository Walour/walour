// Isolated world bridge — has chrome API access
// Relays messages between MAIN world (content.ts) and background service worker

const ports = new Map<string, chrome.runtime.Port>()

window.addEventListener('message', (e: MessageEvent) => {
  // Source/origin guard — only accept messages from this same window context
  if (e.source !== window) return
  if (e.origin !== window.location.origin) return
  if (!e.data?.__walour_req) return

  // Validate fields before destructuring further use
  const { reqId, type, txBase64, hostname } = e.data
  if (typeof reqId !== 'string' || !/^[a-z0-9-]{1,64}$/.test(reqId)) return

  if (type === 'TELEMETRY') {
    try { chrome.runtime.sendMessage({ type: 'TELEMETRY', event: e.data.event }) } catch { /* ignore */ }
    return
  }
  if (type !== 'SCAN_TX') return
  if (typeof txBase64 !== 'string' || txBase64.length > 100_000) return
  if (typeof hostname !== 'string' || hostname.length > 256) return
  if (ports.size >= 3) return  // rate-limit: at most 3 concurrent scans per page

  // Pin response origin to the captured request origin (was '*')
  const replyOrigin = e.origin

  try {
    const port = chrome.runtime.connect({ name: 'walour-scan' })
    ports.set(reqId, port)

    port.onMessage.addListener((msg: unknown) => {
      window.postMessage({ __walour: true, reqId, msg }, replyOrigin)
    })

    port.onDisconnect.addListener(() => {
      ports.delete(reqId)
      window.postMessage({ __walour: true, reqId, msg: { type: 'DISCONNECTED' } }, replyOrigin)
    })

    port.postMessage({ type: 'SCAN_TX', txBase64, hostname })
  } catch {
    // chrome.runtime unavailable — fail open silently
  }
})
