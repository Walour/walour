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

import { showOverlay, hideOverlay, updateRow, appendStream, onDecision } from './overlay'

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
    const bytes: Uint8Array = tx.serialize()
    // Process in chunks to avoid call stack overflow on large transactions
    const CHUNK = 8192
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i += CHUNK) {
      binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
    }
    return btoa(binary)
  }

  function interceptWallet(wallet: WalletProvider): void {
    if (wallet.__walour_hooked) return
    wallet.__walour_hooked = true

    const originalSign = wallet.signTransaction?.bind(wallet)
    const originalSignAndSend = wallet.signAndSendTransaction?.bind(wallet)

    function createInterceptedCall(
      originalFn: ((tx: any, opts?: any) => Promise<any>) | undefined
    ): ((tx: any, opts?: any) => Promise<any>) | undefined {
      if (!originalFn) return undefined

      return function interceptedCall(tx: any, opts?: any): Promise<any> {
        return new _origPromise((resolve, reject) => {
          let txBase64: string
          try {
            txBase64 = serializeTx(tx)
          } catch {
            // If serialization fails, pass through to original wallet
            originalFn(tx, opts).then(resolve).catch(reject)
            return
          }

          const hostname = window.location.hostname

          try {
            showOverlay()
          } catch {
            // Overlay failure must never block the wallet call
            originalFn(tx, opts).then(resolve).catch(reject)
            return
          }

          let port: chrome.runtime.Port
          try {
            port = chrome.runtime.connect({ name: 'walour-scan' })
          } catch {
            try { hideOverlay() } catch { /* ignore */ }
            originalFn(tx, opts).then(resolve).catch(reject)
            return
          }

          // Register decision callback before sending message
          onDecision((allow: boolean) => {
            try { port.disconnect() } catch { /* port may already be closed */ }
            hideOverlay()

            if (allow) {
              originalFn(tx, opts).then(resolve).catch(reject)
            } else {
              reject(new Error('Walour: transaction blocked by user'))
            }
          })

          port.onMessage.addListener((msg: any) => {
            try {
              handlePortMessage(msg)
            } catch {
              // Never propagate errors to the page
            }
          })

          port.onDisconnect.addListener(() => {
            // Unexpected disconnect — fail open (allow tx through)
            try { hideOverlay() } catch { /* ignore */ }
            originalFn(tx, opts).then(resolve).catch(reject)
          })

          try {
            port.postMessage({ type: 'SCAN_TX', txBase64, hostname })
          } catch {
            try { port.disconnect() } catch { /* ignore */ }
            hideOverlay()
            originalFn(tx, opts).then(resolve).catch(reject)
          }
        })
      }
    }

    if (originalSign) {
      wallet.signTransaction = createInterceptedCall(originalSign) as any
    }
    if (originalSignAndSend) {
      wallet.signAndSendTransaction = createInterceptedCall(originalSignAndSend) as any
    }
  }

  function handlePortMessage(msg: any): void {
    if (msg.type === 'SCAN_RESULT') {
      const domain = msg.domain
      const token = msg.token

      if (domain) {
        // DomainRiskResult.level is already 'GREEN' | 'AMBER' | 'RED'
        const level = (domain.level as 'GREEN' | 'AMBER' | 'RED') ?? 'GREEN'
        const text = domain.reason || (level === 'RED' ? 'Phishing site detected' : level === 'AMBER' ? 'Suspicious domain' : 'Domain looks safe')
        updateRow('url', level, text)
      } else {
        updateRow('url', 'GREEN', 'Domain looks safe')
      }

      if (token) {
        // TokenRiskResult.level is already 'GREEN' | 'AMBER' | 'RED'
        const level = (token.level as 'GREEN' | 'AMBER' | 'RED') ?? 'GREEN'
        const text = token.reasons?.[0] || (level === 'RED' ? 'High-risk token' : level === 'AMBER' ? 'Token caution advised' : 'Token looks safe')
        updateRow('token', level, text)
      } else {
        updateRow('token', 'GREEN', 'No token risk detected')
      }

      // Start streaming decode in tx row
      updateRow('tx', 'checking', '')
    } else if (msg.type === 'STREAM_CHUNK') {
      appendStream(msg.chunk as string)
    } else if (msg.type === 'STREAM_DONE') {
      // Mark tx row as complete — dot goes GREEN
      // If stream wrote nothing, show a fallback message
      updateRow('tx', 'GREEN', '')
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

  // Poll for late-injected wallets (e.g., extension wallets that inject after navigation)
  let attempts = 0
  const MAX_ATTEMPTS = 20
  const interval = setInterval(() => {
    tryHookWallets()
    if (++attempts >= MAX_ATTEMPTS) clearInterval(interval)
  }, 500)
}
