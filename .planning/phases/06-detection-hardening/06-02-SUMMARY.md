---
phase: 06-detection-hardening
plan: 02
subsystem: sdk
tags: [token-risk, token-2022, spl-token, solana, honeypot-detection]

# Dependency graph
requires:
  - phase: 06-detection-hardening
    provides: token-risk.ts with existing mintAuthority/freezeAuthority/permanentDelegate checks
provides:
  - Token-2022 ConfidentialTransfer extension flagging (weight 20, presence-only)
  - Token-2022 TransferFeeConfig honeypot flagging when basis points > 500 (weight 20)
affects: [sdk, extension, web]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Token-2022 extension iteration via parsed?.info?.extensions array (NOT parsed?.extensions)"
    - "ConfidentialTransfer detection is presence-only — ext.state intentionally absent per PR #24621"
    - "TransferFee honeypot threshold: bps > 500 (>5%)"

key-files:
  created: []
  modified:
    - packages/sdk/src/token-risk.ts

key-decisions:
  - "ConfidentialTransfer flagged on extension presence alone — no ext.state check needed (account-decoder PR #24621 omits state)"
  - "TransferFee threshold set at > 500 bps (>5%) to avoid false positives on legitimate low fees"
  - "Field path is parsed?.info?.extensions (not parsed?.extensions) per RESEARCH.md Pitfall 2"

patterns-established:
  - "DH-03 pattern: Token-2022 ext checks sit in a dedicated block after mintAuthority/freezeAuthority/supplyAnomaly, before holderConcentration"

requirements-completed: [DH-03]

# Metrics
duration: 5min
completed: 2026-05-03
---

# Phase 06 Plan 02: Token-2022 Extension Honeypot Detection Summary

**Token-2022 ConfidentialTransfer and TransferFeeConfig (>5%) extensions now flag tokens as high-risk in token-risk.ts runChecks**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-03T13:50:27Z
- **Completed:** 2026-05-03T13:55:00Z
- **Tasks:** 1/1
- **Files modified:** 1

## Accomplishments

- Added `checks.confidentialTransfer` (weight 20) — fires on any mint with `confidentialTransferMint` extension, presence-only (no state dependency)
- Added `checks.transferFee` (weight 20) — fires when `transferFeeConfig` extension has `newerTransferFee.transferFeeBasisPoints > 500`
- Field path correctly uses `parsed?.info?.extensions` (matching existing `parsed?.info?.mintAuthority` convention)
- Legacy SPL Token mints (no extensions array) pass through silently without penalty

## Task Commits

1. **Task 1: Add Token-2022 extension checks to runChecks (DH-03)** - `a26bbcf` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `packages/sdk/src/token-risk.ts` — Added 32-line DH-03 block: extensions[] iteration, confidentialTransferMint check, transferFeeConfig bps > 500 check

## Decisions Made

- ConfidentialTransfer: presence-only check. Solana's account-decoder intentionally omits `state` for this extension (PR #24621). Requiring state would miss all mainnet ConfidentialTransfer mints.
- TransferFee threshold: `> 500` bps (>5%). Sub-5% fees exist on legitimate protocols; >5% is the honeypot signal.
- Block placement: after mintInfo-derived checks (lines 91-115), before holderConcentration (line 149). Keeps all mintInfo-derived data in one logical group.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing TypeScript errors in `@types/mocha` and `@upstash/redis` node_modules declarations are unrelated to this change. No errors in `token-risk.ts` or any SDK source file. Out of scope per deviation rules.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- DH-03 requirement fully satisfied
- `checkTokenRisk()` now surfaces Token-2022 extension honeypot signals to the extension overlay and web app verdict path
- Ready for 06-03 (next detection-hardening plan)

---
*Phase: 06-detection-hardening*
*Completed: 2026-05-03*
