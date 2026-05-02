---
phase: 05-scan-accuracy-transaction-simulation
verified: 2026-05-01T00:00:00Z
status: passed
score: 4/4 must-haves verified
re_verification: false
---

# Phase 5: Scan Accuracy + Transaction Simulation Verification Report

**Phase Goal:** Make Walour's threat detection deterministic and trustworthy — fix the ALT account resolution bug so modern drainer transactions aren't missed, add Token-2022 PermanentDelegate detection, and build the transaction simulation layer that shows exact balance deltas before signing.
**Verified:** 2026-05-01
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Modern drainer transactions using ALTs are resolved before threat scoring in the scan endpoint | VERIFIED | `resolveAccounts()` in scan.ts iterates `tx.message.addressTableLookups`, calls `connection.getAddressLookupTable()` per entry, appends writable and readonly indexes; both drainer-check and mint-detection call sites use the async result |
| 2 | Token-2022 PermanentDelegate transactions are flagged as a red flag before signing | VERIFIED | `RedFlag` union includes `'permanent_delegate'` (line 24); `detectRedFlags()` checks `discriminator === '1c'` scoped to `TOKEN_2022_PROGRAM` (lines 75-80) in tx-decoder.ts |
| 3 | The worker exposes a deterministic `/api/simulate` endpoint that returns exact SOL and token balance deltas | VERIFIED | simulate.ts exports `SimDelta`, `SimResult`, calls `simulateTransaction` with `replaceRecentBlockhash:true`; server.ts imports `simulateHandler` and registers `'/api/simulate': simulateHandler` |
| 4 | The overlay shows balance deltas (e.g., "+0.5 SOL  -1000 USDC") before the Claude stream explanation | VERIFIED | overlay.ts exports `SimDelta` interface and `updateSimulation()` function; `simRowRef` is created in `showOverlay()`, inserted between rows container and actions bar, reset in `hideOverlay()`; content.ts imports both, fires a fire-and-forget async IIFE with `AbortController` 2s timeout, calls `updateSimulation()` on success |

**Score:** 4/4 truths verified

---

### Required Artifacts

| Artifact | Requirement | Level 1: Exists | Level 2: Substantive | Level 3: Wired | Status |
|----------|-------------|-----------------|----------------------|----------------|--------|
| `apps/worker/src/scan.ts` | SIM-01 | Yes | async `resolveAccounts()`, iterates `addressTableLookups`, per-lookup try/catch, `altWarning` propagated to response | Called at both account-extraction call sites in handler | VERIFIED |
| `packages/sdk/src/tx-decoder.ts` | SIM-02 | Yes | `'permanent_delegate'` in `RedFlag` union; discriminator `'1c'` check on `TOKEN_2022_PROGRAM` in `detectRedFlags()` | `detectRedFlags()` called in `decodeTransaction()` which is the SDK's exported streaming decoder | VERIFIED |
| `apps/worker/src/simulate.ts` | SIM-03 | Yes | 112 lines; exports `SimDelta`, `SimResult`; calls `simulateTransaction` with `replaceRecentBlockhash:true`; builds `preTokenMap` keyed by `accountIndex:mint`; BigInt arithmetic for token diffs; every error path returns HTTP 200 with `success:false` | Imported in server.ts and registered as route handler | VERIFIED |
| `apps/worker/src/server.ts` | SIM-03 | Yes | `import simulateHandler from './simulate'`; `'/api/simulate': simulateHandler` in routes map; startup log prints the route | Is the entry-point server; all routes active at startup | VERIFIED |
| `apps/extension/src/overlay.ts` | SIM-04 | Yes | Exports `SimDelta` interface (lines 9-14), `updateSimulation()` function (lines 659-674); `simRowRef` module-level ref (line 21); created in `showOverlay()` (line 479), inserted before actions bar (line 509), nulled in `hideOverlay()` (line 526) | Imported and consumed by content.ts | VERIFIED |
| `apps/extension/src/content.ts` | SIM-04 | Yes | Imports `updateSimulation` and `SimDelta` from `./overlay` (line 14); fire-and-forget async IIFE (lines 81-102) with `AbortController` 2s timeout (lines 83-84); calls `updateSimulation()` when `data.success` and deltas or SOL change non-zero (lines 95-97); all errors swallowed silently (lines 98-100) | `updateSimulation` called inside intercepted wallet signing flow, after `showOverlay()` | VERIFIED |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `scan.ts` handler | Helius RPC | `connection.getAddressLookupTable(lookup.accountKey)` | WIRED | Called inside `resolveAccounts()` for each entry in `tx.message.addressTableLookups`; result appended to resolved accounts |
| `scan.ts` resolveAccounts | threat corpus | `lookupAddress(k.toBase58())` on all non-program accounts | WIRED | `nonProgram` array filtered from ALT-resolved accounts; all passed to `Promise.all(nonProgram.map(k => lookupAddress(...)))` |
| `tx-decoder.ts` detectRedFlags | TOKEN_2022_PROGRAM permanent_delegate | `discriminator === '1c'` check | WIRED | Check is in the instruction loop, only fires on `TOKEN_2022_PROGRAM`, pushes `RedFlag` with type `'permanent_delegate'` |
| `simulate.ts` | Helius RPC simulateTransaction | `connection.simulateTransaction(tx, { replaceRecentBlockhash: true })` | WIRED | Response result used to build SOL delta and token delta array returned in `SimResult` |
| `server.ts` routes | `simulate.ts` handler | `import simulateHandler from './simulate'`; route map entry | WIRED | Route map key `'/api/simulate'` points to `simulateHandler`; startup log confirms it |
| `content.ts` fire-and-forget IIFE | `/api/simulate` worker endpoint | `fetch(\`\${apiBase}/api/simulate\`, { method: 'POST', body: JSON.stringify({ txBase64 }) })` | WIRED | Response parsed, `updateSimulation(data.deltas, data.solChangeLamports)` called on success |
| `overlay.ts` simRowRef | shadow DOM card | `simRow` created in `showOverlay()`, appended via `overlay.appendChild(simRow)` | WIRED | `simRowRef = simRow` assigned; `updateSimulation()` sets `textContent` and `display:block` directly on this ref |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SIM-01 | 05-01-PLAN.md | Fix ALT resolution in scan.ts extractAccounts() | SATISFIED | `async resolveAccounts(tx, connection)` iterates `addressTableLookups`, calls `getAddressLookupTable` per lookup, try/catch per entry, non-fatal failure sets `altWarning:true` |
| SIM-02 | 05-02-PLAN.md | Add Token-2022 PermanentDelegate detection to red-flag discriminator checks | SATISFIED | `'permanent_delegate'` in `RedFlag` type union; `'1c'` discriminator check scoped to `TOKEN_2022_PROGRAM` in `detectRedFlags()` |
| SIM-03 | 05-03-PLAN.md | Worker `/api/simulate` endpoint — call simulateTransaction, parse pre/post token balances, return delta array | SATISFIED | `simulate.ts` exists, calls `simulateTransaction` with `replaceRecentBlockhash:true`, parses `preTokenBalances`/`postTokenBalances` using BigInt diff, returns `SimResult` with `deltas`; route registered in `server.ts` |
| SIM-04 | 05-04-PLAN.md | Overlay balance delta row — show SOL/token changes before streaming Claude explanation | SATISFIED | `updateSimulation()` exported from `overlay.ts`; `simRow` inserted between check-rows and actions bar; `content.ts` fires fire-and-forget IIFE immediately after `showOverlay()` with 2s AbortController timeout |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | — | — | — |

No TODO/FIXME/placeholder comments, empty returns, or stub implementations found in the four modified files.

---

### Human Verification Required

#### 1. Balance Delta Coloring in Overlay

**Test:** Open a page that triggers a wallet intercept. Approve a transaction that spends SOL (e.g., any swap). Observe the sim-row in the overlay.
**Expected:** A row appears between the check-rows and the action buttons showing the SOL/token delta in danger red if negative, safe green if positive.
**Why human:** Shadow DOM element visibility and CSS color rendering cannot be verified by static analysis.

#### 2. ALT Resolution on Real Drainer Transactions

**Test:** Submit a known versioned drainer transaction (one that uses an ALT to hide its real recipient) to `GET /api/scan?tx=<base64>&hostname=...`.
**Expected:** The response includes the drainer address in `drainerHit` and returns `domain.level: 'RED'`, not GREEN as before the fix.
**Why human:** Requires a live Helius connection and a real ALT-backed test transaction to confirm end-to-end resolution.

#### 3. PermanentDelegate Flag in Claude Explanation

**Test:** Decode a transaction that calls `InitializePermanentDelegate` on the Token-2022 program via `POST /api/decode`.
**Expected:** The streaming response begins with "Warning: Token mint has PermanentDelegate — issuer can drain any holder account at any time" before the Claude narrative.
**Why human:** Requires a real Token-2022 transaction with discriminator `0x1c` to test the live path end-to-end.

#### 4. Simulate Endpoint with 2s Timeout Degradation

**Test:** Start the worker with an unreachable Helius RPC. Open a page, trigger a transaction intercept, and observe the overlay.
**Expected:** The overlay appears and operates normally; the sim-row never appears (timeout swallowed silently); the scan/decode flow is unaffected.
**Why human:** Requires network-level interference to verify the fire-and-forget timeout degrades gracefully rather than blocking the overlay.

---

## Gaps Summary

No gaps found. All four requirements are fully implemented, substantive, and wired end-to-end.

- **SIM-01:** `resolveAccounts()` in `scan.ts` is async, iterates `addressTableLookups`, calls `getAddressLookupTable` per lookup with per-entry try/catch, propagates `altWarning` to the response. Both drainer-check and mint-detection paths use it.
- **SIM-02:** `RedFlag` type union includes `'permanent_delegate'`; `detectRedFlags()` checks discriminator `'1c'` scoped strictly to `TOKEN_2022_PROGRAM`.
- **SIM-03:** `simulate.ts` is fully implemented (112 lines), exports `SimDelta` and `SimResult`, calls `simulateTransaction` with `replaceRecentBlockhash:true`, parses pre/post token maps with BigInt arithmetic, handles all error paths with HTTP 200 + `success:false`. Route registered in `server.ts`.
- **SIM-04:** `overlay.ts` exports `SimDelta` and `updateSimulation`, creates `simRowRef` in `showOverlay()`, nulls it in `hideOverlay()`. `content.ts` fires a fire-and-forget IIFE with `AbortController` 2s timeout immediately after `showOverlay()`.

---

_Verified: 2026-05-01_
_Verifier: Claude (gsd-verifier)_
