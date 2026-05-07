// Content script — runs in MAIN world
// Security: capture safe references before page scripts can tamper with them

/* eslint-disable @typescript-eslint/no-explicit-any */

// Prototype pollution guard — captured at module evaluation time.
// In MV3 MAIN-world content scripts the module runs in an isolated scope,
// but page scripts can still mutate window properties before DOMContentLoaded.
// We capture these synchronously so later code uses the original builtins
// even if the page patches window.Promise or Object.freeze afterward.
const _freeze = Object.freeze
const _origPromise = Promise

import { showOverlay, hideOverlay, updateRow, appendStream, onDecision, setVerdict, updateSimulation, SimDelta } from './overlay'

// Guard: only inject once per page load
if (typeof (window as any).__walour_content_injected === 'undefined') {
  ;(window as any).__walour_content_injected = true

  type WalletProvider = {
    signTransaction?: (tx: any) => Promise<any>
    signAndSendTransaction?: (tx: any, opts?: any) => Promise<any>
    __walour_hooked?: boolean
  }

  const WALLET_ACCESSORS: Array<() => WalletProvider | undefined> = [
    () => (window as any).phantom?.solana,
    () => (window as any).solflare,
    () => (window as any).backpack?.solana,
  ]

  // Freeze accessor array to prevent tampering
  _freeze(WALLET_ACCESSORS)

  function serializeTx(tx: any): string {
    // requireAllSignatures: false — tx is unsigned at intercept time
    const bytes: Uint8Array = tx.serialize
      ? tx.serialize({ requireAllSignatures: false, verifySignatures: false })
      : tx.message?.serialize?.() ?? tx
    // Process in chunks to avoid call stack overflow on large transactions
    const CHUNK = 8192
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i += CHUNK) {
      binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
    }
    return btoa(binary)
  }

  function interceptWallet(wallet: WalletProvider): void {
    // Re-check every call independently for each method — Phantom re-injects and
    // overwrites our hook, and a wallet may expose only one of the two methods.
    const signAlready = (wallet.signTransaction as any)?.__walour_intercepted === true
    const sendAlready = (wallet.signAndSendTransaction as any)?.__walour_intercepted === true
    if (signAlready && sendAlready) return

    const originalSign = wallet.signTransaction?.bind(wallet)
    const originalSignAndSend = wallet.signAndSendTransaction?.bind(wallet)

    function createInterceptedCall(
      originalFn: ((tx: any, opts?: any) => Promise<any>) | undefined
    ): ((tx: any, opts?: any) => Promise<any>) | undefined {
      if (!originalFn) return undefined

      return function interceptedCall(tx: any, opts?: any): Promise<any> {
        return new _origPromise((resolve, reject) => {
          // TOCTOU guard: capture a bound reference to the page's serializer at
          // intercept time, so the comparison at decision time uses the same
          // function we used to compute txBase64. The page can swap
          // tx.message.serialize between calls.
          const _freezedSerialize: ((...args: any[]) => Uint8Array) | undefined =
            typeof tx?.message?.serialize === 'function'
              ? tx.message.serialize.bind(tx.message)
              : undefined

          let txBase64: string
          try {
            txBase64 = serializeTx(tx)
          } catch {
            originalFn(tx, opts).then(resolve).catch(reject)
            return
          }

          const hostname = window.location.hostname
          const reqId = crypto.randomUUID()

          try { showOverlay() } catch {
            originalFn(tx, opts).then(resolve).catch(reject)
            return
          }
          // Reset per-scan state — prevents duplicates when user clicks sign multiple times
          _scanDomainLevel = 'GREEN'
          _scanTokenLevel  = 'GREEN'
          _scanThreats     = []
          _scanConfidence  = 0

          // Fire-and-forget simulation — 5s timeout, never blocks overlay
          ;(async () => {
            try {
              const controller = new AbortController()
              const timeoutId = setTimeout(() => controller.abort(), 5_000)
              const apiBase = (import.meta.env.VITE_API_BASE as string) ?? 'https://walour.vercel.app'
              const res = await fetch(`${apiBase}/api/simulate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ txBase64 }),
                signal: controller.signal,
              })
              clearTimeout(timeoutId)
              if (res.ok) {
                const data = await res.json() as { success: boolean; solChangeLamports: number; deltas: SimDelta[] }
                if (data.success && (data.deltas.length > 0 || data.solChangeLamports !== 0)) {
                  updateSimulation(data.deltas, data.solChangeLamports)
                }
              }
            } catch {
              // Timeout or network error — skip silently
            }
          })()

          // MAIN world → bridge via window.postMessage
          function onBridgeMessage(e: MessageEvent) {
            if (!e.data || e.data.__walour !== true || e.data.reqId !== reqId) return
            const msgType = e.data.msg?.type
            // Keep listening until the scan stream is fully done
            if (msgType === 'STREAM_DONE' || msgType === 'DISCONNECTED') {
              window.removeEventListener('message', onBridgeMessage)
            }
            try { handlePortMessage(e.data.msg) } catch { /* ignore */ }
          }
          window.addEventListener('message', onBridgeMessage)

          onDecision((allow: boolean) => {
            window.removeEventListener('message', onBridgeMessage)
            hideOverlay()
            if (allow) {
              // TOCTOU guard: re-serialize at decision time using the bound
              // reference captured at intercept time (so a swapped serializer
              // on the page can't trick us into comparing a different function).
              let currentBytes: string | null = null
              try {
                if (_freezedSerialize) {
                  const bytes = _freezedSerialize()
                  const CHUNK = 8192
                  let binary = ''
                  for (let i = 0; i < bytes.byteLength; i += CHUNK) {
                    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
                  }
                  currentBytes = btoa(binary)
                } else {
                  currentBytes = serializeTx(tx)
                }
              } catch { /* ignore — can't compare */ }
              if (currentBytes !== null && currentBytes !== txBase64) {
                reject(new Error('Walour: transaction was modified after security check — blocked'))
                return
              }
              originalFn(tx, opts).then(resolve).catch(reject)
            } else {
              // Telemetry envelope: own UUID so it conforms to bridge's reqId
              // regex /^[a-z0-9-]{1,64}$/. Inner event still references the
              // originating scan via event_id = reqId.
              window.postMessage({
                __walour_req: true,
                reqId: crypto.randomUUID(),
                type: 'TELEMETRY',
                event: {
                  event_id: reqId,
                  timestamp: Date.now(),
                  wallet_pubkey: '',
                  blocked_tx_hash: '',
                  drainer_target: null,
                  block_reason: 'user_blocked',
                  surface: 'extension',
                  app_version: '0.1.0',
                }
              }, window.location.origin)
              reject(new Error('Walour: transaction blocked by user'))
            }
          })

          // Send to bridge (isolated world content script).
          // Bridge runs in the ISOLATED world of this same page; window.location.origin
          // pins delivery to the same browsing context and rejects cross-origin frames.
          window.postMessage({ __walour_req: true, reqId, type: 'SCAN_TX', txBase64, hostname }, window.location.origin)
        })
      }
    }

    if (originalSign && !signAlready) {
      const intercepted = createInterceptedCall(originalSign) as any
      intercepted.__walour_intercepted = true
      try {
        Object.defineProperty(wallet, 'signTransaction', { value: intercepted, writable: true, configurable: true })
      } catch { wallet.signTransaction = intercepted }
    }
    if (originalSignAndSend && !sendAlready) {
      const intercepted = createInterceptedCall(originalSignAndSend) as any
      intercepted.__walour_intercepted = true
      try {
        Object.defineProperty(wallet, 'signAndSendTransaction', { value: intercepted, writable: true, configurable: true })
      } catch { wallet.signAndSendTransaction = intercepted }
    }
  }

  let _scanDomainLevel: 'GREEN' | 'AMBER' | 'RED' = 'GREEN'
  let _scanTokenLevel:  'GREEN' | 'AMBER' | 'RED' = 'GREEN'
  let _scanThreats: string[] = []
  let _scanConfidence = 0

  function worstLevel(
    a: 'GREEN' | 'AMBER' | 'RED',
    b: 'GREEN' | 'AMBER' | 'RED'
  ): 'GREEN' | 'AMBER' | 'RED' {
    if (a === 'RED' || b === 'RED') return 'RED'
    if (a === 'AMBER' || b === 'AMBER') return 'AMBER'
    return 'GREEN'
  }

  function handlePortMessage(msg: any): void {
    if (msg.type === 'SCAN_RESULT') {
      const domain = msg.domain
      const token = msg.token

      if (domain) {
        _scanDomainLevel = (domain.level as 'GREEN' | 'AMBER' | 'RED') ?? 'GREEN'
        const text = domain.reason || (_scanDomainLevel === 'RED' ? 'Phishing site detected' : _scanDomainLevel === 'AMBER' ? 'Suspicious domain' : 'Domain looks safe')
        updateRow('url', _scanDomainLevel, text)
        if (_scanDomainLevel === 'RED') _scanThreats.push(text)
        if (domain.confidence != null) _scanConfidence = Math.max(_scanConfidence, domain.confidence)
      } else {
        updateRow('url', 'GREEN', 'Domain looks safe')
      }

      if (token) {
        _scanTokenLevel = (token.level as 'GREEN' | 'AMBER' | 'RED') ?? 'GREEN'
        const text = token.reasons?.[0] || (_scanTokenLevel === 'RED' ? 'High-risk token' : _scanTokenLevel === 'AMBER' ? 'Token caution advised' : 'Token looks safe')
        updateRow('token', _scanTokenLevel, text)
        if (_scanTokenLevel === 'RED' && token.reasons?.length) _scanThreats.push(...token.reasons)
        if (token.score != null && _scanTokenLevel !== 'GREEN') _scanConfidence = Math.max(_scanConfidence, token.score / 100)
      } else {
        updateRow('token', 'GREEN', 'No token risk detected')
      }

      // Start streaming decode in tx row
      updateRow('tx', 'checking', '')
    } else if (msg.type === 'STREAM_CHUNK') {
      appendStream(msg.chunk as string)
    } else if (msg.type === 'STREAM_DONE') {
      updateRow('tx', 'GREEN', null)
      const overall = worstLevel(_scanDomainLevel, _scanTokenLevel)
      // Confidence: use real data if available, otherwise reflect how thorough the check was
      const confidence = _scanConfidence > 0
        ? _scanConfidence
        : overall === 'RED' ? 0.85 : overall === 'AMBER' ? 0.55 : 0.75
      setVerdict(overall, confidence, _scanThreats.length ? _scanThreats : undefined)
    }
  }

  function tryHookWallets(): void {
    for (const accessor of WALLET_ACCESSORS) {
      try {
        const wallet = accessor()
        if (wallet && typeof wallet === 'object') {
          interceptWallet(wallet)
        }
      } catch {
        // One wallet failure must not affect others
      }
    }
  }

  // Hook wallets available at document_start
  tryHookWallets()

  // Re-try on DOMContentLoaded for wallets injected slightly later
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryHookWallets, { once: true })
  }

  // Replace setInterval poll with a MutationObserver — observes documentElement
  // for child-list/subtree changes so we re-hook only when the page actually
  // mutates (e.g., when a wallet extension injects a script tag). The 30s
  // safety cap ensures we don't observe the page forever; once all known
  // accessors return a wallet object we disconnect early.
  //
  // Dependency note: WALLET_ACCESSORS still reads `window.phantom?.solana`,
  // `window.solflare`, `window.backpack?.solana`. The observer only triggers
  // re-hook attempts; the actual wallet reads happen synchronously on `window`.
  const _observer = new MutationObserver(() => {
    tryHookWallets()
    let allHooked = true
    for (const accessor of WALLET_ACCESSORS) {
      try {
        const w = accessor()
        if (!w || (w.signTransaction && !(w.signTransaction as any).__walour_intercepted)) {
          allHooked = false
          break
        }
        if (!w.signTransaction && !w.signAndSendTransaction) {
          allHooked = false
          break
        }
      } catch {
        allHooked = false
        break
      }
    }
    if (allHooked) {
      try { _observer.disconnect() } catch { /* ignore */ }
    }
  })
  try {
    _observer.observe(document.documentElement, { childList: true, subtree: true })
  } catch { /* documentElement not yet available — DOMContentLoaded will retry hooks */ }
  // 30s safety cap
  setTimeout(() => { try { _observer.disconnect() } catch { /* ignore */ } }, 30_000)
}
