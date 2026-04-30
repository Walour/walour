# Walour Roadmap

## Phase 4: Extension + Overlay Redesign

**Goal:** Redesign the Chrome extension popup and transaction overlay to match the website's visual language — same design tokens, glass morphism, hex logo, live pulse, and risk verdict UX.

**Deliverables:**
- Extension popup: idle, scanning, and verdict states
- Transaction overlay: blocking verdict card with press-and-hold friction
- Shared tokens package at packages/tokens/tokens.css
- All surfaces use #0D1117, #00C9A7, glass morphism, system fonts

**Requirements:**
- EXT-01: Shared design tokens package (packages/tokens/tokens.css)
- EXT-02: Popup idle state — hex SVG logo, live pulse pill, stats strip, quick lookup, check toggle pills
- EXT-03: Popup scanning state — animated logo, live check rows with status updates, streamed Claude decode
- EXT-04: Popup verdict state — colored band, confidence bar, threat flags, address card, CTA buttons
- EXT-05: Overlay redesign — glass card, verdict band, confidence bar, flags list, press-and-hold on RED
- EXT-06: Background script — lastScan cache, POPUP_HELLO handler, walour-popup port
- EXT-07: Micro-interactions — pulse animations, scale pings, reduced-motion support

**Plans:** 5 plans

Plans:
- [x] 04-01-PLAN.md — Create @walour/tokens workspace package (tokens.css + package.json) [EXT-01] ✓ 2026-04-30
- [x] 04-02-PLAN.md — Background script: lastScan cache + walour-popup port + ScanResult type [EXT-06] ✓ 2026-04-30
- [ ] 04-03-PLAN.md — Popup redesign: three-state DOM (idle/scanning/verdict) + state machine + Vite copies tokens.css [EXT-02, EXT-03, EXT-04]
- [ ] 04-04-PLAN.md — Overlay redesign: glass card + verdict band + meter + threats + press-and-hold on RED [EXT-05]
- [ ] 04-05-PLAN.md — Micro-interactions polish: scalePing, toggle bounces, full reduced-motion audit [EXT-07]
