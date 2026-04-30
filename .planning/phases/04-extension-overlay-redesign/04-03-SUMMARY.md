---
phase: 04-extension-overlay-redesign
plan: "03"
subsystem: extension-popup
tags: [extension, popup, state-machine, tokens, ui]
dependency_graph:
  requires: [04-01, 04-02]
  provides: [popup-three-state-ui, tokens-css-in-dist]
  affects: [extension-dist, overlay-wave4]
tech_stack:
  added: []
  patterns: [chrome-runtime-connect, data-state-gating, css-visibility-selectors, type-only-import]
key_files:
  created: []
  modified:
    - apps/extension/popup.html
    - apps/extension/src/popup.ts
    - apps/extension/vite.config.ts
decisions:
  - popup state gated via body[data-state] CSS attribute selectors (display:none !important) — no JS class toggling needed
  - ScanResult imported as type-only from background.ts — zero runtime cost in popup.js bundle
  - vite.config.ts throws on missing tokens.css rather than silently skipping — misconfiguration cannot ship
  - verdict-block button closes window (window.close()) as no-op stub; real block logic deferred to v0.2
metrics:
  duration: "~3 min"
  completed: "2026-04-30T21:00:17Z"
  tasks_completed: 3
  tasks_total: 3
  files_modified: 3
---

# Phase 4 Plan 03: Popup Three-State Redesign Summary

Three-state popup redesign replacing placeholder with idle/scanning/verdict design driven by @walour/tokens classes and walour-popup background port.

## What Was Built

### popup.html (160 lines)
- `body[data-state="idle"]` initial state; inline `<style>` block uses CSS attribute selectors to show/hide sections — no JavaScript required for visibility
- Three sections: `.idle-section`, `.scanning-section`, `.verdict-section`
- Hex SVG logo embedded inline (viewBox `-80 -80 160 160`, 28x28px) — React attributes converted to HTML kebab-case (`stroke-width`, `stroke-linejoin`, `stroke-linecap`)
- `<link rel="stylesheet" href="tokens.css">` — resolved by Vite copy step at build time
- `<script type="module" src="popup.js">` — emitted at same level by Vite

**Idle section:** `ext-stats-strip` (3 cells: Blocked / Scans / Build), `ext-lookup` form (input + submit button), `ext-toggles` (URL / Token / Transaction pills), `ext-actions` (View stats link)

**Scanning section:** `ext-verdict.is-scanning` header with clock SVG, `ext-scan-progress` bar + label, `ext-check-rows` with 3 rows (URL / Token / Transaction) — tx row has `.stream` class for streaming text

**Verdict section:** `ext-verdict#verdict-band` (class toggled by level), `ext-meter` confidence bar, `ext-threats#threats-block` (hidden until RED/AMBER), `ext-address-card`, `ext-actions` (Don't sign + View details buttons)

### popup.ts (240 lines)
State machine entry points:
- `applyHello(scan)` — routes incoming POPUP_HELLO message: null → idle, UNKNOWN → scanning, GREEN/AMBER/RED → verdict
- `renderScanning(scan)` — updates check-row dots (ext-check-dot with GREEN/AMBER/RED/checking class), streaming tx text, naive progress bar (33/66/100% based on completed sections)
- `renderVerdict(scan)` — renders verdict band (is-risk/is-safe), dynamically creates SVG icon by level, ext-meter width + color class (danger/safe), ext-threats list with inline dot spans, address card value
- `wireIdle()` — reads manifest version into stat-version, loads stats.blocks/stats.scans from chrome.storage.local, syncs toggle pills with chrome.storage.sync.checks, wires lookup form to open walour.xyz/lookup, wires stats-link to chrome.tabs.create

Runtime port: `chrome.runtime.connect({ name: 'walour-popup' })` — background sends one POPUP_HELLO then disconnects per Wave 2 spec. onDisconnect handler is a no-op (popup reinitializes on next open).

### vite.config.ts (patch)
`copyStaticAssets` plugin now copies `packages/tokens/tokens.css` → `dist/tokens.css` in `closeBundle()`. If tokens.css is absent, build throws with a clear message pointing to the missing file and the fix command. Uses existing `resolve`, `existsSync`, `copyFileSync` imports — no new imports.

## Build Output
```
dist/
  tokens.css   ← copied from packages/tokens/tokens.css
  popup.html   ← copied from apps/extension/popup.html
  popup.js     ← compiled from src/popup.ts (5.81 kB / gzip: 2.08 kB)
  background.js
  content.js
  bridge.js
  options.html / options.js
  icons/
```

Loading `dist/` as an unpacked Chrome extension and clicking the toolbar icon shows the idle state: hex logo, WALOUR wordmark, Active pill, 3-cell stats strip, lookup input, 3 toggle pills, View stats link.

## Deviations from Plan

None — plan executed exactly as written.

Pre-existing issue noted (out of scope per deviation rules): `overlay.ts(296,21)` TypeScript error `TS2488` exists prior to this plan's changes and does not affect popup.ts or the build output. Logged here for reference.

## Note for Wave 4

Wave 4 (overlay shadow DOM injection) will re-use tokens.css by reading it as a string and injecting it verbatim into the shadow root. The `dist/tokens.css` produced here is the same source file — overlay.ts should reference `packages/tokens/tokens.css` directly during its build step rather than copying from dist/.

## Self-Check: PASSED

All files exist:
- apps/extension/popup.html
- apps/extension/src/popup.ts
- apps/extension/vite.config.ts
- apps/extension/dist/tokens.css
- apps/extension/dist/popup.html
- apps/extension/dist/popup.js
- .planning/phases/04-extension-overlay-redesign/04-03-SUMMARY.md

All commits exist:
- 66275c1: feat(04-03): rewrite popup.html with three-state DOM and tokens.css link
- 3d76631: feat(04-03): rewrite popup.ts as three-state machine driven by walour-popup port
- b7b819e: feat(04-03): patch vite.config.ts to copy tokens.css into dist/
