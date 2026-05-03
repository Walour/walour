---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_plan: Completed 07-01-PLAN.md
status: active
stopped_at: Completed 07-01-PLAN.md
last_updated: "2026-05-03T15:30:00.000Z"
progress:
  total_phases: 3
  completed_phases: 3
  total_plans: 10
  completed_plans: 10
---

# Walour Project State

**Project:** Walour — Solana Security Oracle
**Stack:** Next.js 14, TypeScript, Supabase, Chrome Extension MV3, Anchor/Rust
**Ship target:** Colosseum Frontier, May 11 2026

## Active Phase

**Phase 07 — RDAP Domain Age Detection**
**Current Plan:** Completed 07-01
**Last session:** 2026-05-03T15:30:00.000Z
**Stopped at:** Completed 07-01-PLAN.md

## Completed Phases

- Phase 0+1: Corpus ingestion + SDK (Apr 17–25) ✓
- Phase 2: Chrome extension MVP (Apr 26 – May 2) ✓
- Phase 3: Web app (Registry, Stats, Docs pages) ✓
- Phase 4 Plan 01: @walour/tokens package (2026-04-30) ✓
- Phase 4 Plan 02: background.ts lastScan cache + walour-popup port (2026-04-30) ✓
- Phase 4 Plan 03: popup three-state redesign (idle/scanning/verdict) (2026-04-30) ✓
- Phase 4 Plan 04: overlay redesign — glass card, verdict band, meter, press-and-hold (2026-04-30) ✓
- Phase 4 Plan 05: micro-interactions — scalePing, .ping modifiers, canonical reduced-motion guard (2026-04-30) ✓
- Phase 6 Plan 01: tx-decoder assign_account + durable_nonce + multi_drain detection (2026-05-03) ✓
- Phase 7 Plan 01: RDAP domain age detection — rdapAgeCheck() + Promise.all concurrency + 9 tests (2026-05-03) ✓

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
- scalePing keyframe added to tokens.css (single source of truth); walour-scalePing added separately in OVERLAY_CSS — shadow DOM cannot inherit document stylesheets
- Press-and-hold timer deliberately exempt from reduced-motion — functional friction, not decorative animation
- Single canonical reduced-motion block in tokens.css covers all Phase 4 animations
- PermanentDelegate detection scoped to TOKEN_2022_PROGRAM only; discriminator '1c' (hex 28) matches InitializePermanentDelegate
- ConfidentialTransfer (Token-2022) flagged on extension presence alone — ext.state intentionally absent per account-decoder PR #24621; presence-only is correct
- TransferFee (Token-2022) honeypot threshold: > 500 bps (>5%) — sub-5% fees exist on legitimate protocols
- Token-2022 ext field path is parsed?.info?.extensions (NOT parsed?.extensions) — RESEARCH.md Pitfall 2
- hasHomoglyphRisk placed after cache read but before corpus/GoPlus: cached results short-circuit, fresh homograph domains exit without I/O
- Homoglyph detection: xn-- (Punycode ACE) AND charCode > 127 (raw Unicode) — belt-and-suspenders, cached with DOMAIN_TTL not forever
- durable_nonce is AMBER/informational only — no attack language; hardware wallet/multisig/scheduled payment are legitimate uses
- multi_drain suppressed when any DEX_PROGRAMS member present — Jupiter/Orca/Raydium swaps routinely close 3+ token accounts
- System Program Assign uses 4-byte slice(0,8) LE u32 discriminator; Token program uses 1-byte slice(0,2)
- Path alias @walour/sdk/lib/cache added to worker tsconfig to access Redis cache module without re-exporting from SDK public index (DH-05)
- getTokenSymbol uses AbortSignal.timeout(3000) for Jupiter fetch; cache key token:meta:{mint} TTL 3600s; missing API key returns undefined without blocking sim (DH-05)
- RDAP squat-combined branches (age+squat, age+squat+riskTld) are unreachable — Phase 1 returns early for all squat hits; RDAP scoring combines only with riskTld in the fallback (07-01)

## Performance Metrics

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 04    | 01   | ~10 min  | 2/2   | 2     |
| 04    | 02   | ~8 min   | 1/1   | 1     |
| 04    | 03   | ~3 min   | 3/3   | 3     |
| 04    | 04   | ~9 min   | 1/1   | 1     |
| 04    | 05   | ~8 min   | 3/3   | 3     |
| 05    | 02   | ~5 min   | 1/1   | 1     |
| Phase 05 P03 | 1 min | 2 tasks | 2 files |
| Phase 05 P04 | 5 min | 2 tasks | 2 files |
| Phase 06 P02 | 5min | 1 tasks | 1 files |
| Phase 06 P03 | 8min | 1 tasks | 1 files |
| Phase 06 P01 | 2 min | 2 tasks | 1 files |
| Phase 06 P04 | 10 min | 2 tasks | 4 files |
| Phase 07 P01 | ~15 min | 3 tasks | 2 files |

