---
phase: 04-extension-overlay-redesign
plan: 05
subsystem: extension-micro-interactions
tags: [animation, reduced-motion, micro-interactions, polish, css, typescript]
dependency_graph:
  requires: [04-01, 04-03, 04-04]
  provides: [EXT-07, final-animation-contract]
  affects: [packages/tokens/tokens.css, apps/extension/src/popup.ts, apps/extension/src/overlay.ts]
tech_stack:
  added: []
  patterns: [scale-ping, transient-class, prefers-reduced-motion]
key_files:
  created: []
  modified:
    - packages/tokens/tokens.css
    - apps/extension/src/popup.ts
    - apps/extension/src/overlay.ts
decisions:
  - scalePing keyframe added to tokens.css (single source of truth); walour-scalePing added separately in OVERLAY_CSS because shadow DOM cannot inherit document stylesheets
  - Press-and-hold timer deliberately exempt from reduced-motion — it is functional friction, not decorative animation
  - .ext-toggle.ping rule added to tokens.css (Task 1) to keep all CSS in one canonical reduced-motion block; popup.ts only adds/removes the class at runtime
  - Reduced-motion block is now the single canonical block for all Phase 4 animations — no partial guards elsewhere
metrics:
  duration: ~8 min
  completed: 2026-04-30
  tasks: 3/3
  files: 3
---

# Phase 4 Plan 05: Micro-Interactions & Animation Polish Summary

**One-liner:** scalePing keyframe + transient .ping class pattern wires verdict band, toggle pills, and overlay card to life; single canonical reduced-motion block closes the animation contract for all of Phase 4.

## What Was Built

### New Keyframes
- **`@keyframes scalePing`** (tokens.css): 0.94 → 1.02 → 1.0 over 240ms — used by popup verdict band and buttons
- **`@keyframes walour-scalePing`** (OVERLAY_CSS in overlay.ts): translate(-50%,-50%) scale(0.96 → 1.015 → 1.0) over 260ms — used by overlay glass card

### .ping Modifier Targets
| Selector | Duration | Trigger location |
|---|---|---|
| `.ext-verdict.ping` | 240ms | `renderVerdict()` in popup.ts |
| `.ext-btn.ping` | 180ms | available for future use |
| `.ext-toggle.ping` | 200ms | toggle click handler in `wireIdle()` |
| `.walour-overlay.ping` | 260ms | `setVerdict()` in overlay.ts |

### Toggle + Button Press Feedback
- `.ext-toggle` gets `transition: transform 180ms ease-out, background 180ms ease, color 180ms ease, border-color 180ms ease`
- `.ext-toggle:active` snaps to `scale(0.94)` with `transition: transform 90ms ease-out`
- `.ext-lookup-btn:active` snaps to `scale(0.96)`
- `.ext-btn:active` translates `translateY(1px)`

### Reduced-Motion Contract (Final — Canonical)
Single `@media (prefers-reduced-motion: reduce)` block in tokens.css covers ALL Phase 4 animations:

**animation: none !important:**
`.ext-live-dot`, `.ext-check-dot.checking`, `.ext-logo-wrap.scanning`, `.ext-threat-item`, `.ext-check-row`, `.ext-verdict.ping`, `.ext-btn.ping`, `.ext-toggle.ping`, `.ext-popup.shake`

**transition: none !important; transform: none !important:**
`.ext-meter-fill`, `.ext-scan-bar-fill`, `.ext-verdict`, `.ext-toggle`, `.ext-toggle:active`, `.ext-lookup-btn:active`, `.ext-btn:active`

Overlay reduced-motion block (in OVERLAY_CSS):
- `animation: none`: `.walour-dot.checking`, `.walour-threat-item`, `.walour-overlay.ping`
- `transition: none`: `.walour-meter-fill`, `.walour-verdict`

### Press-and-Hold Exemption
The press-and-hold "Sign anyway" arc animation is deliberately NOT in the reduced-motion guard. It is functional friction (required user intent signal on RED verdicts), not decorative — removing it would break the security UX contract.

## Commits

| Task | Commit | Description |
|---|---|---|
| 1 | db51b65 | feat(04-05): add scalePing keyframe + ping modifiers + canonical reduced-motion guard |
| 2 | c9be9e7 | feat(04-05): trigger scale-ping on verdict render and toggle clicks in popup.ts |
| 3 | (build audit — no file changes) | tsc --noEmit + vite build green; dist/ OK |

## Build Verification

```
vite v5.4.21 building for production...
✓ 6 modules transformed.
dist/bridge.js      0.59 kB
dist/options.js     1.02 kB
dist/background.js  4.41 kB
dist/popup.js       5.98 kB
dist/content.js    16.07 kB
✓ built in 566ms
```

**dist/ artifacts confirmed present:** popup.html, popup.js, tokens.css, background.js, content.js, bridge.js, manifest.json

## Phase 4 Deliverable Confirmation

All EXT-01 through EXT-07 land in shippable form:
- **EXT-01** (@walour/tokens package) — Plan 01 ✓
- **EXT-02** (background lastScan cache + walour-popup port) — Plan 02 ✓
- **EXT-03** (popup three-state redesign: idle/scanning/verdict) — Plan 03 ✓
- **EXT-04** (overlay glass card + verdict band + meter) — Plan 04 ✓
- **EXT-05/06** (design token sync across popup + overlay) — Plans 01, 03, 04 ✓
- **EXT-07** (micro-interactions + reduced-motion contract) — Plan 05 ✓

## Manual QA Checklist

- [ ] Idle popup shows hex SVG logo, live pulse pill, stats strip, lookup input, toggle pills
- [ ] Toggle click bounces with scale-ping (or snaps instantly under OS "Reduce Motion")
- [ ] Scanning popup shows pulsing logo, animated scan bar, three check rows with streaming tx text
- [ ] Verdict popup shows colored band with scale-ping on entry, confidence bar, threat list (when applicable), address card
- [ ] Overlay shows glass card with hex logo, verdict band, meter, threats, check rows
- [ ] Press-and-hold "Sign anyway" requires 1.5s on RED, instant on GREEN/AMBER
- [ ] Reduced-motion OS setting disables: live dot pulse, logo pulse, check row feedIn, verdict ping, toggle ping, meter transition, scan bar transition, popup shake
- [ ] Press-and-hold timer arc remains active even with reduced-motion enabled (intentional)
- [ ] Popup re-open shows lastScan verdict (POPUP_HELLO contract works)
- [ ] Overlay card scale-pings on setVerdict with GREEN, AMBER, or RED; no ping on UNKNOWN

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- packages/tokens/tokens.css — modified ✓
- apps/extension/src/popup.ts — modified ✓
- apps/extension/src/overlay.ts — modified ✓
- Commit db51b65 — exists ✓
- Commit c9be9e7 — exists ✓
- dist/ artifacts — all present ✓
