---
phase: 05
plan: 02
subsystem: sdk
tags: [token-2022, permanent-delegate, red-flags, detection]
dependency_graph:
  requires: []
  provides: [permanent_delegate red flag detection]
  affects: [packages/sdk/src/tx-decoder.ts]
tech_stack:
  added: []
  patterns: [discriminator-based instruction detection, Token-2022 extension awareness]
key_files:
  created: []
  modified:
    - packages/sdk/src/tx-decoder.ts
decisions:
  - PermanentDelegate detection scoped to TOKEN_2022_PROGRAM only (not classic TOKEN_PROGRAM, which has no such instruction)
  - Discriminator '1c' (hex 28) matches InitializePermanentDelegate instruction index in Token-2022 spec
metrics:
  duration: ~5 min
  completed: "2026-05-01"
  tasks_completed: 1
  tasks_total: 1
  files_modified: 1
---

# Phase 05 Plan 02: Token-2022 PermanentDelegate Detection Summary

## One-liner

Token-2022 PermanentDelegate red flag added via discriminator '1c' check on TOKEN_2022_PROGRAM, surfacing issuer drain risk before signing.

## What Was Built

Extended `detectRedFlags()` in `packages/sdk/src/tx-decoder.ts` with a new detection block for the Token-2022 `InitializePermanentDelegate` instruction. When this instruction appears in a transaction targeting the Token-2022 program, a `permanent_delegate` red flag is pushed with a user-facing explanation of the drain risk.

Updated the `RedFlag` TypeScript interface union to include `'permanent_delegate'` so callers can type-safely discriminate on this new flag type.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add PermanentDelegate red flag detection | ef50ec3 | packages/sdk/src/tx-decoder.ts |

## Decisions Made

- PermanentDelegate check is **TOKEN_2022_PROGRAM only** — the classic Token program has no equivalent instruction, so scoping prevents false positives.
- Discriminator `'1c'` (decimal 28) is the `InitializePermanentDelegate` instruction index per the Token-2022 program spec.
- Detection placed after the existing Approve (`'04'`) check, before the corpus-hits loop — consistent with existing ordering pattern.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] `RedFlag` type union includes `'permanent_delegate'` — line 24
- [x] `detectRedFlags()` checks discriminator `'1c'` on `TOKEN_2022_PROGRAM` — lines 74-80
- [x] Existing checks (06, 09, 04) unchanged — lines 37-72
- [x] Commit ef50ec3 exists
