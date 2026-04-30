---
phase: 04-extension-overlay-redesign
plan: "01"
subsystem: tokens
tags: [css, design-tokens, extension, overlay, shared-package]
dependency_graph:
  requires: []
  provides: [packages/tokens/tokens.css, "@walour/tokens"]
  affects: [packages/extension/popup.html, packages/extension/overlay.ts]
tech_stack:
  added: ["@walour/tokens workspace package (CSS-only, no build)"]
  patterns: ["CSS custom properties cascade", "Shadow DOM injection via OVERLAY_CSS string copy"]
key_files:
  created:
    - packages/tokens/package.json
    - packages/tokens/tokens.css
  modified: []
decisions:
  - "CSS-only package with no build step — imported by relative path in popup.html and injected verbatim into overlay shadow DOM"
  - "Single source of truth: tokens.css is canonical; overlay.ts Wave 4 will copy :root + .ext-* rules into its OVERLAY_CSS string"
metrics:
  duration: "< 10 minutes"
  completed: "2026-04-30"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 0
---

# Phase 4 Plan 01: @walour/tokens Package Summary

Extracted extension popup CSS into `packages/tokens/tokens.css` — a 420-line single source of truth for design tokens and ext-popup class families shared by the Chrome extension popup and overlay shadow DOM.

## What Was Built

### packages/tokens/ (new workspace package)

**package.json** — Minimal workspace manifest (`@walour/tokens`, `main: tokens.css`, no build, no dependencies). Root `package.json` already includes `packages/*` in workspaces — no change needed.

**tokens.css (420 lines)** — Single CSS file extracted from `apps/web/styles/globals.css`:

**:root design tokens (21 tokens)**
- Color: `--bg`, `--surface`, `--surface-elevated`, `--border`, `--border-subtle`, `--text`, `--text-muted`, `--text-disabled`, `--accent`, `--accent-dark`, `--safe`, `--warning`, `--danger`, `--danger-soft`, `--accent-soft`, `--accent-glow`
- Spacing: `--radius-sm`, `--radius`, `--radius-md`, `--radius-lg`, `--radius-pill`
- Typography: `--mono`, `--font-sys`

**Class families exported**
- `ext-popup` — base popup shell + `state-risk`, `state-scanning` modifiers
- `ext-popup-header`, `ext-popup-brand`, `ext-popup-brand-name` — header row
- `ext-live-pill`, `ext-live-dot` — live status indicator
- `ext-popup-close` — close button
- `ext-verdict`, `ext-verdict-icon`, `ext-verdict-label`, `ext-verdict-sub` — verdict block (is-risk / is-scanning / is-safe)
- `ext-meter`, `ext-meter-label`, `ext-meter-track`, `ext-meter-fill`, `ext-meter-pct` — confidence meter (danger / safe variants)
- `ext-threats`, `ext-threats-header`, `ext-threat-item` — threat list
- `ext-address-card`, `ext-address-card-label`, `ext-address-card-value` — address display card
- `ext-actions`, `ext-btn` — action bar (primary / ghost / accent variants)
- `ext-btn-hold` — press-and-hold danger button (conic-gradient fill)
- `ext-scan-progress`, `ext-scan-bar-track`, `ext-scan-bar-fill`, `ext-scan-label` — scanning progress bar
- `ext-check-rows`, `ext-check-row`, `ext-check-dot`, `ext-check-label`, `ext-check-text` — scanning check rows (checking / GREEN / AMBER / RED dot states)
- `ext-stats-strip`, `ext-stats-cell`, `ext-stats-cell-value`, `ext-stats-cell-label` — stats strip (idle state)
- `ext-lookup`, `ext-lookup-input`, `ext-lookup-btn` — quick address lookup (idle state)
- `ext-toggles`, `ext-toggle`, `ext-toggle-dot` — feature toggle pills (idle state, `.on` variant)
- `ext-logo-wrap` — logo wrapper (`.scanning` animated variant)
- `glass` — glass morphism backdrop utility

**Keyframes exported**
- `pulse` — opacity + scale loop (dot indicators, logo)
- `glowPulse` — box-shadow bloom loop (live dot)
- `feedIn` — translateY(8px) → 0 entry (threat items, check rows)
- `fadeUp` — translateY(20px) → 0 entry (general)
- `popupShake` — horizontal jitter (blocked-sign rejection)

**Reduced-motion guards**
- `@media (prefers-reduced-motion: reduce)` disables all animations (`ext-live-dot`, `ext-check-dot.checking`, `ext-logo-wrap.scanning`, `ext-threat-item`, `ext-check-row`) and transitions (`ext-meter-fill`, `ext-scan-bar-fill`, `ext-verdict`, `ext-popup.shake`) via `!important`.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1: package.json | `46c585c` | chore(04-01): create @walour/tokens workspace package manifest |
| Task 2: tokens.css | `fe2fd2b` | feat(04-01): add @walour/tokens tokens.css (420 lines) |

## Decisions Made

1. **CSS-only, no build step** — Wave 2+ consumers import by relative path (`../tokens/tokens.css`) or use `<link rel="stylesheet">` in popup.html. No bundler required.
2. **Single source of truth** — overlay.ts (Wave 4) will copy the `:root` block and `.ext-*` rules verbatim into its `OVERLAY_CSS` string constant at implementation time. If tokens change here, overlay.ts must be regenerated.
3. **No @import or external references** — tokens.css is self-contained, safe for both browser `<link>` and shadow DOM `adoptedStyleSheets` / `<style>` injection.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- [x] `packages/tokens/package.json` exists — FOUND
- [x] `packages/tokens/tokens.css` exists — FOUND (420 lines, >= 250 required)
- [x] Commit `46c585c` exists
- [x] Commit `fe2fd2b` exists
- [x] All 19 token/class checks in verify command pass
- [x] Root package.json workspaces already includes `packages/*` — no modification needed
