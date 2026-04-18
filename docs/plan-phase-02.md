# Plan — Phase 2: Chrome Extension MVP
**Dates:** Apr 26 – May 2 (Chrome Web Store submit by Apr 29)
**Deliverable:** Working Chrome extension with URL interception, wallet popup warning injection, streaming LLM output, ALT resolution, and telemetry. Submitted to CWS by Apr 29 to allow 10-day review buffer before May 11.

---

## Goals
1. Extension intercepts `signTransaction` / `signAndSendTransaction` across Phantom, Solflare, Backpack.
2. Pre-sign popup shows URL · Token · Transaction verdicts with streaming Claude output.
3. `drain_blocked` telemetry emits on every prevented signing event.
4. Extension submitted to Chrome Web Store by Apr 29.

---

## P2-01: Extension scaffold (Apr 26)
- `apps/extension/` — Vite + TypeScript, Manifest V3
- Manifest permissions: `tabs`, `storage`, `scripting`, `activeTab`, `webNavigation`
- File structure:
  - `manifest.json`
  - `src/background.ts` — service worker, circuit breaker state
  - `src/content.ts` — wallet provider hook injection
  - `src/popup/` — React overlay component
  - `src/options/` — Options page

---

## P2-02: Wallet provider injection (Apr 26–27)
Hook into wallet `window` objects before the page script runs (use `"world": "MAIN"` content script injection):

```ts
// For each wallet: Phantom, Solflare, Backpack
const original = window.phantom?.solana?.signTransaction
window.phantom.solana.signTransaction = async (tx) => {
  const allow = await walourPreSign(tx, window.location.hostname)
  if (!allow) throw new Error('Walour: transaction blocked by user')
  return original(tx)
}
```

- Wrap both `signTransaction` and `signAndSendTransaction` for each wallet
- Guard: only inject if wallet provider is present — never throw if wallet absent

---

## P2-03: Pre-sign overlay UI (Apr 27–28)
React component injected as a shadow DOM root above the wallet popup:

**Layout (top to bottom):**
- Walour header bar (logo + "Walour Security Check")
- Three status rows: URL · Token · Transaction
  - Each: colored dot (GREEN `#22C55E` / AMBER `#F59E0B` / RED `#EF4444`) + one-line verdict
  - Transaction row: streaming Claude text + blinking cursor
- Two buttons: **"Don't sign"** (teal, primary) · **"Sign anyway"** (ghost, muted)
- Never auto-dismiss — user must click one

**Rendering flow:**
1. Show overlay immediately with three "Checking…" spinners
2. URL and token checks resolve first (~100–800ms) — update their rows
3. Claude stream renders token-by-token into Transaction row
4. Both buttons active as soon as overlay shows (don't wait for stream to finish)

---

## P2-04: Parallel scan logic (Apr 27–28)
In the background service worker, on intercept:

```ts
const [urlResult, tokenResult] = await Promise.allSettled([
  sdk.checkDomain(hostname),
  sdk.checkTokenRisk(tokenMint)   // extract mint from tx accounts
])

// Stream decoder separately — renders live into popup
const stream = sdk.decodeTransaction(tx)
for await (const chunk of stream) {
  sendToPopup({ type: 'STREAM_CHUNK', chunk })
}
```

- Extract token mint from transaction accounts before SDK call
- Handle `Promise.allSettled` rejections gracefully — show "Check failed" not crash
- Stream stall > 2s → abort → show "Unable to decode — proceed with caution"

---

## P2-05: ALT resolution (Apr 28)
Already implemented in SDK (P1-04), but extension must pass the full connection object:

- Background service worker holds a `Connection` instance (Helius primary, circuit-breaker wrapped)
- `decodeTransaction(tx, connection)` — SDK uses it for `getAddressLookupTable` calls
- If ALT fetch fails: append "ALT resolution failed — higher-risk transaction" to the warning text. Do not block.

---

## P2-06: Telemetry emission (Apr 28)
On "Don't sign" click (or popup closed for > 10s without action):

```ts
const event: DrainBlockedEvent = {
  event_id: uuidv7(),
  timestamp: Date.now(),
  wallet_pubkey: connectedWallet,
  blocked_tx_hash: txHash,
  drainer_target: redFlagAddress ?? undefined,
  block_reason: determineBlockReason(urlResult, tokenResult, streamSummary),
  estimated_sol_saved: simulateOutcome(tx),
  estimated_usd_saved: solPrice * estimated_sol_saved,
  confirmed: false,          // post-hoc sim runs async
  surface: 'extension',
  app_version: chrome.runtime.getManifest().version
}
await supabase.from('drain_blocked_events').insert(event)
```

Post-hoc: after 30s, simulate the tx against mainnet state. If simulation shows > 0.01 SOL would have drained, update `confirmed = true`.

---

## P2-07: Options page (Apr 29)
- Toggle per checkpoint: URL check · Token check · Transaction decode
- Corpus stats: total addresses tracked, last sync timestamp
- "Report a scam" shortcut — opens slide-out panel to submit community report

---

## P2-08: walour.xyz/stats dashboard (Apr 29 — can be minimal for CWS submit)
- Public Next.js page (or Vercel static)
- Reads from `drain_blocked_events` Supabase view (no auth)
- Shows: total SOL saved, event count, top drainer addresses
- This is the KPI's public proof — must be live before Colosseum submit

---

## P2-09: CWS submission (Apr 29)
- Build production bundle: `vite build`
- Zip: `extension.zip`
- CWS Developer Dashboard: new item, upload zip, fill store listing
- Store listing copy:
  - **Name:** Walour — Solana Wallet Protection
  - **Short description:** Real-time scam protection for Solana. Blocks phishing sites, malicious tokens, and wallet drainers before you sign.
  - **Category:** Productivity
- Request review — allow 10 days (CWS typical: 1–7 days, buffer to May 11)

---

## P2-10: Testing (Apr 30 – May 2, parallel with review wait)
- Test with a known drainer address from corpus → verify RED verdict shows
- Test with a clean token → verify GREEN
- Test with a phishing URL from Chainabuse → verify URL row goes RED
- Test "Sign anyway" flow → tx proceeds normally
- Test stream stall fallback (mock Claude timeout)
- Test ALT failure fallback message
- Confirm `drain_blocked_events` row appears in Supabase after "Don't sign"

---

## Acceptance Criteria

| Check | Pass condition |
|---|---|
| Wallet injection | Works on Phantom, Solflare, Backpack desktop |
| Overlay | Shows before wallet popup, never auto-dismisses |
| Streaming | First token < 400ms on cache miss |
| ALT | VersionedTransactions decoded correctly |
| Telemetry | Event row in Supabase after every "Don't sign" |
| CWS submit | Submitted by Apr 29 |
| Stats page | walour.xyz/stats publicly accessible |
