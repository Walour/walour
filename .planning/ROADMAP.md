# Walour Roadmap

## Phase 5: Scan Accuracy + Transaction Simulation

**Goal:** Make Walour's threat detection deterministic and trustworthy — fix the ALT account resolution bug so modern drainer transactions aren't missed, add Token-2022 PermanentDelegate detection, and build the transaction simulation layer that shows exact balance deltas before signing.

**Deliverables:**
- ALT bug fix: scan.ts resolves Address Lookup Tables before threat analysis
- Token-2022 PermanentDelegate detection in red-flag logic
- `/api/simulate` worker endpoint using `connection.simulateTransaction()`
- Balance delta display in overlay ("+0.5 SOL, -1000 USDC") before Claude explanation

**Requirements:**
- SIM-01: Fix ALT resolution in scan.ts extractAccounts() — must resolve all ALT accounts before threat scoring
- SIM-02: Add Token-2022 PermanentDelegate detection to red-flag discriminator checks
- SIM-03: Worker `/api/simulate` endpoint — call simulateTransaction, parse pre/post token balances, return delta array
- SIM-04: Overlay balance delta row — show SOL/token changes surfaced by simulation before streaming Claude explanation

**Plans:** 3/4 plans executed

Plans:
- [ ] 05-01-PLAN.md — Fix ALT resolution in scan.ts extractAccounts() [SIM-01]
- [ ] 05-02-PLAN.md — Token-2022 PermanentDelegate detection in red-flag logic [SIM-02]
- [ ] 05-03-PLAN.md — Worker /api/simulate endpoint — balance deltas [SIM-03]
- [ ] 05-04-PLAN.md — Overlay balance delta display before Claude stream [SIM-04]

---

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
- [x] 04-03-PLAN.md — Popup redesign: three-state DOM (idle/scanning/verdict) + state machine + Vite copies tokens.css [EXT-02, EXT-03, EXT-04] ✓ 2026-04-30
- [x] 04-04-PLAN.md — Overlay redesign: glass card + verdict band + meter + threats + press-and-hold on RED [EXT-05] ✓ 2026-04-30
- [x] 04-05-PLAN.md — Micro-interactions polish: scalePing, toggle bounces, full reduced-motion audit [EXT-07] ✓ 2026-04-30
