---
phase: 06-detection-hardening
plan: "01"
subsystem: sdk/tx-decoder
tags: [detection, system-program, durable-nonce, multi-drain, red-flags]
dependency_graph:
  requires: []
  provides: [assign_account-detection, durable_nonce-detection, multi_drain-detection]
  affects: [packages/sdk/src/tx-decoder.ts]
tech_stack:
  added: []
  patterns: [4-byte-little-endian-discriminator, post-loop-aggregate, dex-suppression]
key_files:
  modified:
    - packages/sdk/src/tx-decoder.ts
decisions:
  - "durable_nonce detail is intentionally AMBER/informational — no attack language (legitimate hardware wallet / multisig use cases)"
  - "multi_drain suppressed when any DEX_PROGRAMS member present — Jupiter swaps routinely close 3+ token accounts"
  - "assign_account detail references ix.accounts[0] (target account); new owner is in data bytes 4-35, not accounts array"
  - "4-byte slice(0,8) used for System Program; Token program continues to use 1-byte slice(0,2)"
metrics:
  duration: "~2 min"
  completed: "2026-05-03T13:52:18Z"
  tasks: 2/2
  files: 1
requirements: [DH-01, DH-02, DH-04]
---

# Phase 06 Plan 01: Detection Hardening — Assign, Durable Nonce, Multi-Drain Summary

Three instruction-level detection gaps closed in `tx-decoder.ts`, raising detection coverage for ownership-hijack, non-expiring transactions, and multi-account drain patterns.

## What Was Built

**DH-01 — System Program Assign (ownership-hijack):** When an instruction targets `11111111111111111111111111111111` with discriminator `01000000` (4-byte LE u32), a `assign_account` RedFlag is emitted. References the target account (`ix.accounts[0]`) since the new program owner is encoded in data bytes 4-35. Accounts for 73.85% of drainer losses per SolPhishHunter.

**DH-02 — Durable Nonce / AdvanceNonceAccount:** When discriminator is `04000000`, a `durable_nonce` RedFlag is emitted as AMBER. Detail is purely informational ("it never expires and can be replayed at any future time") — no "attack"/"drainer" language. Legitimate uses include hardware wallets, multisig, and scheduled payments.

**DH-04 — Multi-instruction drain:** After the for-loop, counts Transfer (discriminator `03`) and CloseAccount (discriminator `09`) instructions across TOKEN_PROGRAM and TOKEN_2022_PROGRAM. If `drainIxs.length > 2` AND `affectedAccounts.size > 2` AND no DEX program is present, emits `multi_drain`. DEX suppression prevents false positives on Jupiter/Orca/Raydium swaps.

## Lines Added to tx-decoder.ts

| Lines | What |
|-------|------|
| 24 | `const SYSTEM_PROGRAM = '11111111111111111111111111111111'` |
| 28 | Extended RedFlag union: `assign_account | durable_nonce | multi_drain` added |
| 86-102 | System Program detection block inside for-loop (DH-01, DH-02) |
| 115-131 | multi_drain post-loop aggregate block (DH-04) |

## New RedFlag Union Members

| Type | Severity | Trigger |
|------|----------|---------|
| `assign_account` | RED | System Program ix with discriminator `01000000` |
| `durable_nonce` | AMBER | System Program ix with discriminator `04000000` |
| `multi_drain` | RED | >2 token transfers/closes on >2 distinct accounts, no DEX present |

## DEX Suppression

`DEX_PROGRAMS.has(ix.program)` check covers Jupiter v6, Orca Whirlpool, Orca v2, Raydium AMM — unchanged from pre-existing set. multi_drain is only emitted when `isDexTx === false`.

## Commits

| Task | Hash | Message |
|------|------|---------|
| Task 1 | bcdc318 | feat(06-01): DH-01/DH-02 assign_account + durable_nonce detection |
| Task 2 | 4b62680 | feat(06-01): DH-04 multi_drain post-loop aggregate detection |

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `packages/sdk/src/tx-decoder.ts` exists and contains all 5 grep targets (01000000, 04000000, multi_drain, assign_account, durable_nonce)
- Commits bcdc318 and 4b62680 verified in git log
- multi_drain block confirmed at lines 115-131 (after for-loop closes at line 113)
- TypeScript errors in tx-decoder.ts: 0 (pre-existing @types/mocha and @upstash/redis errors are unrelated)
