---
phase: 07-rdap-domain-age
plan: 01
subsystem: sdk/domain-check
tags: [rdap, domain-age, detection, typescript, testing]
dependency_graph:
  requires: [phase-06-detection-hardening]
  provides: [rdap-age-detection, domain-age-scoring]
  affects: [checkDomain, domain-check.ts, dist/index.d.ts]
tech_stack:
  added: []
  patterns: [Promise.all concurrency, AbortSignal.timeout, RDAP REST API, cache-first pattern]
key_files:
  modified:
    - packages/sdk/src/domain-check.ts
  created:
    - packages/sdk/tests/domain-check.test.ts
decisions:
  - squat-combined RDAP branches removed (unreachable due to Phase 1 early return)
  - RDAP signals combine only with riskTld in fallback (not squat)
  - ageDays cast via type alias to avoid TypeScript narrowing-to-never error
metrics:
  duration: ~15 minutes
  completed: 2026-05-03
  tasks_completed: 3
  files_modified: 1
  files_created: 1
---

# Phase 07 Plan 01: RDAP Domain Age Detection Summary

**One-liner:** RDAP-based domain registration age detection integrated into checkDomain() via Promise.all concurrency with Redis caching, escalating new domains (<14 days) from AMBER to RED when combined with high-risk TLD signals.

## What Was Implemented

### Functions Added (`packages/sdk/src/domain-check.ts`)

**`extractRootDomain(hostname: string): string`** (private, line ~188)
- Strips subdomains to last two labels: `sub.example.xyz` → `example.xyz`
- Pure function, no network, handles single-label edge case

**`rdapAgeCheck(hostname: string): Promise<number | null>`** (private, line ~198)
- Calls `https://rdap.org/domain/{root}` with `AbortSignal.timeout(5_000)` and `Accept: application/rdap+json`
- Parses `events[].eventAction === 'registration'` to compute age in whole days
- Caches result at `domain:rdap:{rootDomain}` with `DOMAIN_TTL` (3600s)
- Returns `null` on any failure (404, network error, missing event) — non-fatal

### Fallback Block Changes (`checkDomain()`)

Replaced sequential `await goplusDomainCheck(hostname)` with:
```typescript
const [isPhishing, ageDays] = await Promise.all([
  goplusDomainCheck(hostname),
  rdapAgeCheck(hostname),
])
```

Scoring logic (applied after GoPlus priority check):
- `isNewDomain && riskTld` → RED, confidence 0.75
- `isNewDomain` alone → AMBER, confidence 0.55
- `riskTld` alone (no age signal) → AMBER, confidence 0.35 (unchanged from Phase 1)
- Fallback → AMBER, confidence 0.0 (unchanged)

### Line Count
- Original: 256 lines
- After changes: 313 lines (+57 net)
- Constraint was 320 lines — PASSED

## Test Coverage (`packages/sdk/tests/domain-check.test.ts`)

9 tests, all passing, zero real network calls:

| Test | Branch Covered | Result |
|------|---------------|--------|
| AMBER: new domain alone (7 days) | `isNewDomain && !riskTld` | AMBER 0.55, "7 days ago" |
| RED 0.75: new domain + high-risk TLD | `isNewDomain && riskTld` | RED 0.75, reason has TLD |
| RDAP failure non-fatal (throws) | catch block returns null | AMBER 0.35, no "days ago" |
| RDAP failure non-fatal (404) | `!res.ok` returns null | AMBER, no "days ago" |
| Domain >= 14 days: no RDAP text | `isNewDomain` false | AMBER 0.0, no "days ago" |
| GoPlus RED takes priority | `isPhishing` branch | RED 0.85, GoPlus source |
| Singular "1 day ago" grammar | `days === 1` ternary | "1 day ago" not "1 days ago" |
| extractRootDomain strips subdomain | RDAP URL check via mockFetch.mock.calls | URL has `/domain/example.xyz` |
| extractRootDomain single-label | RDAP URL check via mockFetch.mock.calls | URL has `/domain/example.com` |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unreachable squat-combined RDAP branches**
- **Found during:** Task 1 TypeScript build
- **Issue:** The plan specified scoring branches for `isNewDomain && squat && riskTld` (RED 0.85) and `isNewDomain && squat` (RED 0.75). However, `squat` is computed by `checkKeywordSquatting()` at lines 245-246 and the function returns early at line 259 if `squat` is truthy. TypeScript control-flow analysis correctly narrows `squat` to `never` in the fallback block, causing DTS build errors: `Property 'brand' does not exist on type 'never'`.
- **Fix:** Removed the two unreachable squat-combined branches. The surviving scoring table (`age+riskTld → RED 0.75`, `age alone → AMBER 0.55`) is correct and complete for the reachable states.
- **Files modified:** `packages/sdk/src/domain-check.ts`
- **Commits:** `6f5be9f`
- **Impact:** The plan's tests for "RED 0.75: new domain + keyword squat" and "RED 0.85: new domain + squat + riskTld" were replaced with equivalent tests that exercise the actual reachable scoring paths. Test count remains >= 7 (9 total).

**2. [Rule 1 - Bug] TypeScript narrowing required `ageDays` type alias**
- **Found during:** Task 1 TypeScript build iteration
- **Issue:** `ageDays` destructured from `Promise.all` is `number | null`, but inside `isNewDomain`-guarded branches TypeScript did not narrow it to `number` without assistance.
- **Fix:** Added `const days = ageDays as number` to provide a typed alias for use in template literals inside guarded branches. This is safe since `isNewDomain` guarantees `ageDays !== null`.
- **Files modified:** `packages/sdk/src/domain-check.ts`

## Build Output Confirmation

```
CJS  dist\index.js       4.39 MB  Build success
ESM  dist\index.mjs      394.38 KB  Build success
DTS  dist\index.d.ts     4.03 KB   Build success (zero TypeScript errors)
```

`dist/index.d.ts` exports:
```typescript
declare function checkDomain(hostname: string): Promise<DomainRiskResult>;
```
Signature identical to pre-Phase-2.

## Full Test Suite

```
Test Suites: 3 passed, 3 total
Tests:       23 passed, 23 total
```
Zero regressions in `rpc-fast.test.ts` and `private-report-cloak.test.ts`.

## Self-Check: PASSED

- [x] `packages/sdk/src/domain-check.ts` exists and is 313 lines
- [x] `packages/sdk/tests/domain-check.test.ts` exists with 9 passing tests
- [x] `packages/sdk/dist/index.js` present and non-empty (4.39 MB)
- [x] `packages/sdk/dist/index.mjs` present and non-empty (394.38 KB)
- [x] `packages/sdk/dist/index.d.ts` present and non-empty (4.03 KB)
- [x] Commit `6f5be9f` — Task 1 (domain-check.ts changes)
- [x] Commit `04b0c53` — Task 2 (domain-check.test.ts)
- [x] No new imports added to domain-check.ts
- [x] No new npm dependencies in package.json
- [x] `checkDomain()` public signature unchanged
- [x] Phase 1 helpers untouched
