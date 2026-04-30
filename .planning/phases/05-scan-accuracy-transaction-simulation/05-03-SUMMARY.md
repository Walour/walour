---
phase: "05"
plan: "05-03"
subsystem: worker
tags: [simulation, transaction, token-deltas, endpoint]
dependency_graph:
  requires: []
  provides: ["/api/simulate endpoint", "SimDelta interface", "SimResult interface"]
  affects: ["apps/worker/src/server.ts"]
tech_stack:
  added: []
  patterns: ["simulateTransaction with replaceRecentBlockhash", "preTokenMap keyed by accountIndex:mint", "BigInt diff for token amounts"]
key_files:
  created:
    - apps/worker/src/simulate.ts
  modified:
    - apps/worker/src/server.ts
key_decisions:
  - "signerPubkey accepted but unused — reserved for future per-signer delta filtering"
  - "uiChange uses toFixed(decimals > 4 ? 2 : decimals) to avoid excessive decimal places on high-precision tokens"
  - "All errors (including sim.value.err) return HTTP 200 with success:false — never 500 from simulation failures"
metrics:
  duration: "~1 min"
  completed_date: "2026-05-01"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
---

# Phase 05 Plan 03: Worker /api/simulate Endpoint Summary

**One-liner:** POST /api/simulate calls Helius simulateTransaction with replaceRecentBlockhash:true and returns structured SOL + SPL token balance deltas.

## What Was Built

A deterministic pre-sign simulation endpoint that tells the extension exactly what a transaction will do to the signer's balances — "your wallet will lose 1000 USDC" — with zero AI involvement. This is the core differentiator that separates Walour from heuristic-only scanners.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create simulate.ts handler | 4332556 | apps/worker/src/simulate.ts (created) |
| 2 | Register /api/simulate route | eb46462 | apps/worker/src/server.ts (modified) |

## Implementation Details

### simulate.ts
- Accepts POST `{ txBase64: string, signerPubkey?: string }`
- Deserializes the base64 transaction with `VersionedTransaction.deserialize()`
- Calls `connection.simulateTransaction(tx, { replaceRecentBlockhash: true, commitment: 'confirmed' })`
- SOL delta: `postBalances[0] - preBalances[0]` (index 0 = fee payer)
- Token deltas: builds `preTokenMap` keyed by `${accountIndex}:${mint}`, diffs against `postTokenBalances` using BigInt arithmetic
- `uiChange` formatted as "+0.5" or "-1000" with smart decimal places
- CORS headers for both `*` (dev) and `chrome-extension://*` (prod)
- OPTIONS preflight handled
- Every error path returns HTTP 200 with `{ success: false, error, solChangeLamports: 0, deltas: [] }`

### server.ts
- Import `simulateHandler from './simulate'`
- Route `'/api/simulate': simulateHandler` added to routes map
- Startup log: `POST /api/simulate  { txBase64: string, signerPubkey?: string }`

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- FOUND: apps/worker/src/simulate.ts
- FOUND: commit 4332556 (feat(worker): add /api/simulate endpoint with token balance deltas)
- FOUND: commit eb46462 (feat(worker): register /api/simulate route)
