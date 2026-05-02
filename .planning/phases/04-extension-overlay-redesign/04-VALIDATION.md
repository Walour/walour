---
phase: 4
slug: extension-overlay-redesign
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-30
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | none — visual/structural checks only (no test runner needed) |
| **Config file** | none |
| **Quick run command** | `cd apps/extension && npx tsc --noEmit` |
| **Full suite command** | `cd apps/extension && npx tsc --noEmit && npx vite build` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/extension && npx tsc --noEmit`
- **After every plan wave:** Run `cd apps/extension && npx tsc --noEmit && npx vite build`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 4-01-01 | 01 | 1 | EXT-01 | build | `test -f packages/tokens/tokens.css` | ✅ W0 | ⬜ pending |
| 4-02-01 | 02 | 2 | EXT-02 | build | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 4-02-02 | 02 | 2 | EXT-03 | build | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 4-02-03 | 02 | 2 | EXT-04 | build | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 4-03-01 | 03 | 3 | EXT-05 | build | `npx vite build` | ✅ | ⬜ pending |
| 4-04-01 | 04 | 4 | EXT-06 | build | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 4-05-01 | 05 | 5 | EXT-07 | manual | visual inspect reduced-motion | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `packages/tokens/` directory — create workspace package (tokens.css + package.json) — handled by Wave 1 plan 04-01

*All TypeScript infrastructure already exists. Only new artifact is packages/tokens/, which Wave 1 (plan 04-01) creates as its first task. Wave 0 prerequisite is therefore satisfied at the moment Wave 1 begins.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Press-and-hold arc animates 0→100% over 1.5s on RED "Sign anyway" | EXT-05 | Requires browser interaction | Load extension, intercept a tx, hold "Sign anyway" button for 1.5s, verify arc completes and action fires |
| Live pulse pill animates in popup idle state | EXT-02 | Requires loaded extension | Open popup, verify green dot pulses at 2s interval |
| Reduced-motion disables animations | EXT-07 | Requires OS setting | Enable reduced motion in OS, open popup, verify no animations |
| Popup shows lastScan verdict on re-open | EXT-06 | Requires background port | Scan a page, close popup, reopen, verify verdict state restores |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved
