# Walour Project State

**Project:** Walour — Solana Security Oracle
**Stack:** Next.js 14, TypeScript, Supabase, Chrome Extension MV3, Anchor/Rust
**Ship target:** Colosseum Frontier, May 11 2026

## Active Phase

**Phase 04 — Extension Overlay Redesign**
**Current Plan:** 04-05 (Plans 01-04 complete)
**Last session:** 2026-04-30 — Completed 04-04-PLAN.md
**Stopped at:** 04-05-PLAN.md (ready to execute)

## Completed Phases

- Phase 0+1: Corpus ingestion + SDK (Apr 17–25) ✓
- Phase 2: Chrome extension MVP (Apr 26 – May 2) ✓
- Phase 3: Web app (Registry, Stats, Docs pages) ✓
- Phase 4 Plan 01: @walour/tokens package (2026-04-30) ✓
- Phase 4 Plan 02: background.ts lastScan cache + walour-popup port (2026-04-30) ✓
- Phase 4 Plan 03: popup three-state redesign (idle/scanning/verdict) (2026-04-30) ✓
- Phase 4 Plan 04: overlay redesign — glass card, verdict band, meter, press-and-hold (2026-04-30) ✓

## Active Decisions

- Design tokens: #0D1117 bg, #00C9A7 accent, glass morphism surfaces
- SDK is stateless exports (not class-based): checkTokenRisk, checkDomain, lookupAddress, decodeTransaction, submitPrivateReportCloak
- No light mode
- System fonts only (SF Pro / Roboto / Segoe UI)
- No gamification fields
- @walour/tokens is CSS-only, no build step; overlay.ts shadow DOM injection copies :root + .ext-* verbatim
- tokens.css is single source of truth; if tokens change, regenerate overlay.ts OVERLAY_CSS string
- lastScan Map capped at 50 tabs (LRU eviction); all writes go through setLastScan() helper
- walour-popup port is fire-and-reply: one POPUP_HELLO then disconnect; Wave 3 popup reads this to initialize state
- deriveLevel/deriveConfidence are naive stubs in Wave 2; Wave 4 may refine confidence algorithm
- popup state gated via body[data-state] CSS attribute selectors — no JS class toggling needed for visibility
- ScanResult imported as type-only from background.ts — zero runtime cost in popup.js bundle
- vite.config.ts throws on missing tokens.css rather than silently skipping — misconfiguration cannot ship
- OVERLAY_CSS uses :host selector (not :root) for token block — custom properties must be on shadow host to resolve in closed shadow DOM
- --hold-pct set as percentage string ('42%') not unitless — conic-gradient requires units
- currentVerdict defaults to UNKNOWN (non-RED) preserving backward compat with content.ts callers that never call setVerdict
- Array.from(querySelectorAll()) required for ES2020 Symbol.iterator compat (NodeListOf lacks it under lib: ES2020)

## Performance Metrics

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 04    | 01   | ~10 min  | 2/2   | 2     |
| 04    | 02   | ~8 min   | 1/1   | 1     |
| 04    | 03   | ~3 min   | 3/3   | 3     |
| 04    | 04   | ~9 min   | 1/1   | 1     |
