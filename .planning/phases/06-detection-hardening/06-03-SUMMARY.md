---
phase: 06-detection-hardening
plan: 03
subsystem: sdk
tags: [domain-check, homoglyph, punycode, unicode, idn, security]

# Dependency graph
requires:
  - phase: 06-detection-hardening
    provides: domain-check.ts with corpus + GoPlus lookups
provides:
  - hasHomoglyphRisk(hostname) helper for IDN homograph detection
  - Fail-fast homoglyph RED branch in checkDomain before corpus/GoPlus
  - DH-06 requirement implemented
affects: [sdk, extension, domain-check]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fail-fast security checks: homoglyph detection runs before expensive I/O (corpus + GoPlus)"
    - "Belt-and-suspenders IDN detection: Punycode xn-- prefix AND raw charCode > 127"

key-files:
  created: []
  modified:
    - packages/sdk/src/domain-check.ts

key-decisions:
  - "hasHomoglyphRisk placed AFTER cache read so a cached result still short-circuits, but BEFORE corpus/GoPlus to avoid unnecessary I/O on obvious homograph domains"
  - "Both xn-- (Punycode ACE prefix) AND charCode > 127 (raw Unicode) checks required: belt-and-suspenders per RESEARCH.md Pitfall 6"
  - "RED result cached with DOMAIN_TTL (3600s), not forever — domain registrations can expire or change"
  - "confidence: 0.9, source: 'walour' — definitive signal, not corpus-corroborated but structurally unambiguous"

patterns-established:
  - "Fail-fast security gate pattern: insert critical security checks after cache-read, before I/O lookups in checkDomain"

requirements-completed: [DH-06]

# Metrics
duration: 8min
completed: 2026-05-03
---

# Phase 06 Plan 03: Homoglyph / IDN Domain Detection Summary

**hasHomoglyphRisk helper closes IDN homograph bypass in checkDomain: xn-- Punycode prefix and raw non-ASCII characters now return RED before corpus or GoPlus lookups are attempted**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-03T00:00:00Z
- **Completed:** 2026-05-03T00:08:00Z
- **Tasks:** 1/1
- **Files modified:** 1

## Accomplishments
- Added `hasHomoglyphRisk(hostname)` helper with two checks: `hostname.includes('xn--')` for Punycode ACE prefix and `charCodeAt(i) > 127` loop for raw Unicode characters
- Inserted fail-fast early-exit branch in `checkDomain` after cache read, before corpus and GoPlus lookups — no unnecessary I/O on obvious homograph domains
- RED result cached at `domain:risk:{hostname}` with `DOMAIN_TTL` (3600s) using existing cache infrastructure — not cached forever since domain registrations can expire

## Task Commits

Each task was committed atomically:

1. **Task 1: Add hasHomoglyphRisk helper + early-exit branch in checkDomain (DH-06)** - `1bfef04` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified
- `packages/sdk/src/domain-check.ts` — Added `hasHomoglyphRisk` helper (lines 97-107) and homoglyph early-exit branch in `checkDomain` (lines 114-125)

## Decisions Made
- `hasHomoglyphRisk` positioned after cache read but before corpus/GoPlus: cached result still short-circuits, but fresh homograph domains exit without hitting Supabase or GoPlus
- Two-check implementation (xn-- AND charCode > 127): Punycode covers browser-encoded confusable domains; raw Unicode covers fetch interceptors passing URLs as strings without browser encoding
- `DOMAIN_TTL` (3600s) used for RED cache — not forever, since a domain's registration status can change
- `confidence: 0.9` reflects high certainty from structural signal without requiring corpus corroboration

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing TypeScript errors in external `@types/mocha` and `@upstash/redis` type declarations were present before this change and are unrelated to `domain-check.ts`. No errors in modified file.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- DH-06 complete: homoglyph/IDN bypass closed in checkDomain
- All three detection hardening tasks (DH-01/DH-02 assign_account + durable_nonce, DH-03 Token-2022 PermanentDelegate, DH-06 IDN homograph) are now implemented
- SDK ready for integration testing / Phase 07

---
*Phase: 06-detection-hardening*
*Completed: 2026-05-03*
