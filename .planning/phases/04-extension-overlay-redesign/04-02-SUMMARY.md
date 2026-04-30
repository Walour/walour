---
phase: 04-extension-overlay-redesign
plan: 02
subsystem: extension
tags: [chrome-extension, typescript, background-script, popup, scan-cache]

# Dependency graph
requires:
  - phase: 04-01
    provides: "@walour/tokens CSS design tokens used by overlay and popup"
provides:
  - "ScanResult type exported from background.ts"
  - "lastScan Map<number, ScanResult> module-level cache with 50-tab LRU eviction"
  - "walour-popup port handler that replies with POPUP_HELLO containing latest scan or null"
  - "Tab cleanup via chrome.tabs.onRemoved evicting lastScan + activePorts"
affects:
  - "04-03 popup redesign (imports ScanResult, connects via walour-popup)"
  - "04-04 overlay wave"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "LRU-capped Map for tab-scoped state in Chrome MV3 background scripts"
    - "Partial upsert helper (setLastScan) merging incremental updates into cached entry"
    - "Port-name dispatch pattern: single onConnect listener branches on port.name"

key-files:
  created: []
  modified:
    - apps/extension/src/background.ts

key-decisions:
  - "LRU cap of 50 tabs prevents unbounded memory growth in background service worker"
  - "deriveLevel/deriveConfidence are placeholder helpers; Wave 4 may refine confidence algorithm"
  - "STREAM_DONE only refreshes updatedAt — it does not change level/domain/token (already set at SCAN_RESULT time)"
  - "walour-popup port is fire-and-reply: one POPUP_HELLO then disconnect; no state maintained"

patterns-established:
  - "setLastScan(tabId, partial): all writes to lastScan go through this helper — never direct .set()"
  - "tabId flows as explicit parameter through handleScanTx to avoid re-querying sender mid-stream"

requirements-completed: [EXT-06]

# Metrics
duration: 8min
completed: 2026-04-30
---

# Phase 04 Plan 02: Background lastScan Cache + walour-popup Port Summary

**lastScan Map keyed by tabId feeds POPUP_HELLO on walour-popup connect, enabling Wave 3 popup state machine to show verdict instead of stale idle screen**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-30T20:53:20Z
- **Completed:** 2026-04-30T21:01:30Z
- **Tasks:** 1/1
- **Files modified:** 1

## Accomplishments

- Added `export interface ScanResult` with level/hostname/domain/token/txSummary/confidence/updatedAt fields
- Implemented `lastScan: Map<number, ScanResult>` with 50-tab LRU eviction cap and `setLastScan()` upsert helper
- Intercepted all three SCAN_RESULT post sites (success + two error branches) to populate the cache
- Appended STREAM_CHUNK text to `lastScan[tabId].txSummary` during streaming decode
- Added `walour-popup` onConnect handler that queries the active tab and replies with `POPUP_HELLO { scan: ScanResult | null }`
- Added `chrome.tabs.onRemoved` listener to evict entries from both `lastScan` and `activePorts`
- Extended `handleScanTx` signature with optional `tabId` parameter (no breaking change to call sites)

## Task Commits

1. **Task 1: Add lastScan cache, ScanResult type, and walour-popup port handler** - `91d4f0a` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `apps/extension/src/background.ts` — Added ScanResult export, lastScan Map, setLastScan/deriveLevel/deriveConfidence helpers, walour-popup onConnect branch, chrome.tabs.onRemoved cleanup; extended handleScanTx with tabId param; lines modified span the full file (122 net insertions, 12 deletions)

## Decisions Made

- **LRU cap 50:** Background service workers in MV3 are periodically killed and restarted; 50 is a safe upper bound that avoids the Map growing across many tabs while staying well under memory limits.
- **deriveLevel/deriveConfidence are naive stubs:** Both functions apply simple string-matching against known risk label variants (RED/HIGH/CRITICAL etc.) and a 0/0.5/1.0 presence heuristic. Wave 4 will refine if needed.
- **STREAM_DONE refreshes updatedAt only:** The domain+token verdict is already in the cache from SCAN_RESULT. STREAM_DONE just bumps the timestamp so Wave 3 can tell the entry is "fully resolved".
- **Port-name dispatch via early-return:** Rather than nested if/else, the onConnect handler checks `walour-popup` first with an early `return`, then falls through to the existing `walour-scan` guard. Keeps the original scan logic untouched.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- `npx tsc --noEmit` returned exit code 2 with one pre-existing error in `src/overlay.ts` (line 296: `NodeListOf<Element>` iterator). Confirmed pre-existing by stashing changes and re-running tsc. `background.ts` produced zero errors. Out of scope per plan scope boundary rules — logged to deferred-items.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `ScanResult` type is exported; Wave 3 popup can `import type { ScanResult } from '../background'`
- Popup connects with `chrome.runtime.connect({ name: 'walour-popup' })` and reads the first `POPUP_HELLO` message to initialize its state machine
- `lastScan` is populated on every completed scan (both success and error paths), so the popup will always receive a meaningful result or null
- Pre-existing `overlay.ts` tsc error should be resolved before Wave 4 overlay work (EXT-07+)

---
*Phase: 04-extension-overlay-redesign*
*Completed: 2026-04-30*
