---
phase: 04-extension-overlay-redesign
plan: "04"
subsystem: ui
tags: [shadow-dom, glass-morphism, overlay, press-and-hold, typescript, chrome-extension, design-tokens]

requires:
  - phase: 04-01
    provides: tokens.css design token file (OVERLAY_CSS mirrors :root block)
  - phase: 04-03
    provides: popup three-state redesign (design language to match)

provides:
  - Rewritten overlay.ts with glass morphism card (rgba fallback + backdrop-filter blur 18px saturate 140%)
  - New setVerdict(level, confidence, threats?) export: updates verdict band, confidence meter, threats list
  - Press-and-hold friction on allowBtn (1500ms, 16ms tick, --hold-pct as percentage string) gated by currentVerdict === RED
  - Backward-compatible legacy API: showOverlay, hideOverlay, updateRow, appendStream, onDecision unchanged
  - Hex SVG logo (28x28) built via createElementNS — zero innerHTML anywhere

affects: [content.ts, popup.ts, 04-05]

tech-stack:
  added: []
  patterns:
    - "OVERLAY_CSS embeds :host token block verbatim (Shadow DOM cannot inherit document <link> stylesheets)"
    - "Press-and-hold: setInterval 16ms tick updates --hold-pct; setTimeout 1500ms fires decisionCallback(true); pointerup/leave/cancel cancel"
    - "currentVerdict module variable gates pointerdown handler — no DOM query needed"
    - "Array.from(querySelectorAll()) for ES2020 Symbol.iterator compatibility"

key-files:
  created: []
  modified:
    - apps/extension/src/overlay.ts

key-decisions:
  - "OVERLAY_CSS token block uses :host selector (not :root) so CSS custom properties resolve inside the closed shadow root"
  - "--hold-pct set as percentage string ('42%') not unitless number — required for conic-gradient to parse correctly"
  - "currentVerdict defaults to UNKNOWN (non-RED) so existing content.ts call sites without setVerdict get one-tap allow — preserves backward compat"
  - "Array.from() on querySelectorAll result required for ES2020 lib (NodeListOf lacks Symbol.iterator in that target)"

patterns-established:
  - "Press-and-hold pattern: cancelHold() resets timer + interval + CSS property; attachAllowHandlers() wires all four pointer events"
  - "Verdict-aware button variant: RED -> walour-btn-hold class; non-RED -> walour-btn-ghost class, toggled in setVerdict()"

requirements-completed:
  - EXT-05

duration: 9min
completed: "2026-04-30"
---

# Phase 04 Plan 04: Overlay Redesign Summary

**Glass morphism overlay card with verdict band, confidence meter, threat list, and 1.5s press-and-hold friction on the allow button when verdict is RED**

## Performance

- **Duration:** 9 min
- **Started:** 2026-04-30T20:56:37Z
- **Completed:** 2026-04-30T21:05:46Z
- **Tasks:** 1 / 1
- **Files modified:** 1

## Accomplishments

- Full overlay rewrite: glass card (rgba fallback + blur/saturate backdrop-filter), hex SVG logo via createElementNS, verdict band, confidence meter, threat list, three check rows with streaming support
- New `setVerdict(level, confidence, threats?)` export drives all dynamic state — verdict band color/text, meter width/class, threat list items, allow button variant
- Press-and-hold mechanic: 1500ms timer + 16ms interval tick updates `--hold-pct` CSS custom property as percentage string; pointerup/pointerleave/pointercancel cancel and reset; only active when `currentVerdict === 'RED'`
- Zero `innerHTML` in implementation (comment documents the rule); all DOM via createElement + textContent + createElementNS

## Task Commits

1. **Task 1: Rewrite overlay.ts with glass card, verdict band, meter, threats, and press-and-hold** - `0a87554` (feat)

**Plan metadata:** (docs commit pending)

## Files Created/Modified

- `apps/extension/src/overlay.ts` - Full rewrite: OVERLAY_CSS with embedded token block, glass card, verdict band, meter, threats, rows, press-and-hold action buttons

## Decisions Made

- Used `:host` selector (not `:root`) for the token block in OVERLAY_CSS — custom properties must be declared on the shadow host to resolve inside closed shadow DOM
- `--hold-pct` set as a percentage string (`'42%'`) not a unitless number — `conic-gradient` requires units; unitless would silently break the arc animation
- `currentVerdict` defaults to `'UNKNOWN'` so all existing `content.ts` call sites (which never call `setVerdict`) continue to get one-tap allow — backward compatibility preserved without any change to content.ts
- `Array.from(querySelectorAll())` used in `updateRow` to fix ES2020 Symbol.iterator compatibility (tsc error TS2488)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Array.from() on querySelectorAll in updateRow**
- **Found during:** Task 1 (tsc --noEmit verification)
- **Issue:** `NodeListOf<Element>` lacks `[Symbol.iterator]()` under `lib: ["ES2020", "DOM"]` — tsc error TS2488 at line 514
- **Fix:** Wrapped `shadowRoot.querySelectorAll('.walour-row')` in `Array.from()` before the `for...of` loop
- **Files modified:** apps/extension/src/overlay.ts
- **Verification:** `npx tsc --noEmit` exits 0
- **Committed in:** `0a87554` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Fix required for TypeScript compilation. No scope change.

## Issues Encountered

- `innerHTML` appears in the security comment on line 2 — the plan's grep check (`c.includes('innerHTML')`) would have flagged this false positive. Verified via `replace(/\/\/.*$/gm, '')` before check — no actual innerHTML assignment anywhere in the implementation.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- overlay.ts exports are stable and backward-compatible; content.ts requires no changes
- `setVerdict()` is ready to be called from content.ts once the background script surfaces verdict data
- Wave 5 (04-05) may add micro-interaction polish (scale pings, additional reduced-motion guards) and verify content.ts integration end-to-end
- Pending manual verification: load dist/ as unpacked extension, navigate to test-trigger.html, confirm glass card appears, press-and-hold on RED verdict animates arc, release cancels

---
*Phase: 04-extension-overlay-redesign*
*Completed: 2026-04-30*
