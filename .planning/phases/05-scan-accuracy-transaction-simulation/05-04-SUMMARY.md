---
phase: 05
plan: 04
subsystem: extension-overlay
tags: [overlay, simulation, balance-delta, ui]
dependency_graph:
  requires: [05-03]
  provides: [overlay-sim-delta-display]
  affects: [apps/extension/src/overlay.ts, apps/extension/src/content.ts]
tech_stack:
  added: []
  patterns: [fire-and-forget-iife, abortcontroller-timeout, shadow-dom-element-ref]
key_files:
  modified:
    - apps/extension/src/overlay.ts
    - apps/extension/src/content.ts
decisions:
  - simRowRef is a module-level element ref (consistent with existing ref pattern in overlay.ts)
  - simRow inserted between check-rows container and actions (not after stream text) per plan spec
  - 2s AbortController timeout on /api/simulate prevents stalling the overlay UX
  - All simulate errors swallowed silently — overlay degrades gracefully
metrics:
  duration: ~5 min
  completed_date: "2026-05-01"
  tasks_completed: 2
  files_modified: 2
---

# Phase 05 Plan 04: Overlay Balance Delta Display Summary

**One-liner:** Shadow DOM sim-row that shows "+0.5 SOL  -1000 USDC..." in danger/safe color from a fire-and-forget /api/simulate fetch with 2s AbortController timeout.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Add updateSimulation export to overlay.ts | ad38b21 | apps/extension/src/overlay.ts |
| 2 | Call /api/simulate from content.ts | b6b5fcb | apps/extension/src/content.ts |

## What Was Built

**overlay.ts changes:**
- Exported `SimDelta` interface (mirrors worker type: `mint`, `change`, `decimals`, `uiChange`)
- Added `simRowRef: HTMLElement | null = null` module-level element reference alongside other refs
- In `showOverlay()`, a `walour-sim-row` div is created with `display:none`, appended to the overlay card between the check-rows container and the actions bar, and assigned to `simRowRef`
- New `updateSimulation(deltas, solChangeLamports)` export: formats SOL change (4 decimal places) and token deltas (truncated mint address), sets `textContent` and `display:block`, colors the row danger (`#EF4444`) if any value is negative or safe (`#22C55E`) if all positive
- `hideOverlay()` resets `simRowRef = null`

**content.ts changes:**
- Import updated to include `updateSimulation` and `SimDelta` from `./overlay`
- After `showOverlay()` call in `interceptedCall`, a fire-and-forget async IIFE fetches `${VITE_API_BASE}/api/simulate` with `{ txBase64 }` in the body
- `AbortController` with `setTimeout(..., 2_000)` ensures the call is abandoned after 2s
- On `res.ok`, casts response as `{ success, solChangeLamports, deltas }` and calls `updateSimulation()` only when `data.success` and there are non-zero deltas
- All errors (network failure, timeout, JSON parse) are caught and swallowed — overlay continues normally

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] `SimDelta` exported from `overlay.ts`
- [x] `updateSimulation` exported from `overlay.ts`
- [x] `simRowRef` inserted into card DOM in `showOverlay()`
- [x] `hideOverlay()` resets `simRowRef = null`
- [x] `content.ts` imports `updateSimulation` and `SimDelta`
- [x] Fire-and-forget IIFE with 2s AbortController timeout
- [x] Failure caught silently
- [x] 2 commits made (ad38b21, b6b5fcb)

## Self-Check: PASSED
