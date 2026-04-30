---
phase: 05-scan-accuracy-transaction-simulation
plan: "01"
subsystem: worker/scan
tags: [alt-resolution, scan, security, bug-fix]
dependency_graph:
  requires: []
  provides: [ALT-aware account extraction in /api/scan]
  affects: [apps/worker/src/scan.ts]
tech_stack:
  added: []
  patterns: [resolveALTs pattern from tx-decoder.ts, Helius getAddressLookupTable]
key_files:
  created: []
  modified:
    - apps/worker/src/scan.ts
decisions:
  - Reused exact resolveALTs pattern from tx-decoder.ts to keep ALT resolution consistent across the codebase
  - Non-fatal ALT failures surface as altWarning: true in response JSON rather than blocking the scan
  - Connection created once per request and passed to both resolveAccounts call sites to avoid double instantiation
metrics:
  duration: "~10 minutes"
  completed: "2026-05-01"
  tasks_completed: 1
  tasks_total: 1
  files_modified: 1
requirements:
  - SIM-01
---

# Phase 05 Plan 01: ALT Resolution in Scan Endpoint Summary

ALT-aware account extraction in scan.ts — async resolveAccounts() using getAddressLookupTable, replacing the static-keys-only extractAccounts().

## What Was Built

The worker scan endpoint (`apps/worker/src/scan.ts`) was silently passing modern drainer transactions as GREEN because `extractAccounts()` only read `tx.message.staticAccountKeys`. Versioned transactions using Address Lookup Tables hide real recipient addresses in the ALT — meaning malicious addresses never appeared in the account list and were never checked against the corpus.

This fix replaces the synchronous `extractAccounts()` with an async `resolveAccounts(tx, connection)` that mirrors the proven `resolveALTs` pattern already in `packages/sdk/src/tx-decoder.ts`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add ALT resolution to scan.ts extractAccounts() | c6c6055 | apps/worker/src/scan.ts |

## Changes Made

### apps/worker/src/scan.ts

1. Added `Connection` to the `@solana/web3.js` import.
2. Added `getConnection()` helper (identical to tx-decoder.ts pattern — Helius mainnet RPC, `confirmed` commitment).
3. Replaced `function extractAccounts(tx)` with `async function resolveAccounts(tx, connection)`:
   - Starts with `[...staticAccountKeys]`
   - Iterates `tx.message.addressTableLookups`
   - Calls `connection.getAddressLookupTable(lookup.accountKey)` per entry
   - Appends `writableIndexes` and `readonlyIndexes` addresses
   - Per-lookup try/catch — failure sets `failed = true` (non-fatal, scan continues)
   - Returns `{ accounts: PublicKey[], failed: boolean }`
   - Deduplication logic preserved unchanged
4. In the handler: `const connection = getConnection()` created once at top, passed to both `resolveAccounts` call sites.
5. Both call sites destructure as `{ accounts, failed: altFailed }` and set `altWarning = true` on failure.
6. Response JSON includes `altWarning: true` when any ALT fetch failed.

## Verification

- `grep -n "getAddressLookupTable" apps/worker/src/scan.ts` — returns line 53 (confirmed)
- `grep -n "staticAccountKeys" apps/worker/src/scan.ts` — returns line 27 only (inside resolveAccounts, not as sole account source)
- `npx tsc --noEmit -p apps/worker/tsconfig.json` — zero errors in scan.ts (pre-existing errors in ingest.ts and simulate.ts are out of scope)

## Deviations from Plan

None — plan executed exactly as written. The `resolveAccounts` name was used instead of `resolveALTs` to better reflect its role (it is the replacement for `extractAccounts`, not a standalone helper), but the logic is identical.

## Self-Check

- [x] `apps/worker/src/scan.ts` modified and committed at c6c6055
- [x] `getAddressLookupTable` present in scan.ts
- [x] `staticAccountKeys` only inside resolveAccounts (not as sole source)
- [x] Both call sites use `await resolveAccounts(tx, connection)`
- [x] try/catch per ALT fetch
- [x] `altWarning: true` appended to response on failure
- [x] TypeScript: zero errors in scan.ts

## Self-Check: PASSED
