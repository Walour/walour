---
phase: 06-detection-hardening
verified: 2026-05-03T14:30:00Z
status: passed
score: 12/12 must-haves verified
re_verification: false
human_verification:
  - test: "Confirm overlay sim row shows token symbol (e.g. 'USDC') not truncated mint during live transaction signing"
    expected: "Sim row displays '-1.00 USDC' not '-1.00 EPjF...'"
    why_human: "Requires live extension + Jupiter API key wired to worker — cannot verify rendering end-to-end statically"
  - test: "Trigger a transaction that includes a System Program Assign instruction and confirm overlay shows assign_account warning"
    expected: "Overlay displays the ownership-hijack red flag before Claude streamed text"
    why_human: "Red flag pre-emit at signing time requires live extension context"
---

# Phase 06: Detection Hardening Verification Report

**Phase Goal:** Close the 4 known Solana attack vector gaps and improve overlay UX — raising detection score from 6.5/10 to 8.5/10 before Colosseum submission. Research-backed improvements sourced from SolPhishHunter (arXiv), SEAL Drainers Vol. 1, and Blockaid TOCTOU analysis.
**Verified:** 2026-05-03T14:30:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | tx-decoder flags System Program Assign instructions as RED ownership-hijack | VERIFIED | `tx-decoder.ts` line 89: `if (first4 === '01000000')` → pushes `assign_account` flag with ownership-hijack detail |
| 2 | tx-decoder flags durable nonce (AdvanceNonceAccount) as AMBER (informational, not RED) | VERIFIED | `tx-decoder.ts` line 96: `if (first4 === '04000000')` → detail says "never expires and can be replayed" — no attack/drainer language |
| 3 | tx-decoder flags multi-instruction drains (>2 distinct token accounts, no DEX) | VERIFIED | `tx-decoder.ts` lines 115-131: post-loop aggregate with `isDexTx` suppression; threshold `drainIxs.length > 2 && affectedAccounts.size > 2` |
| 4 | token-risk flags Token-2022 mints with ConfidentialTransfer extension | VERIFIED | `token-risk.ts` line 126: `ext.extension === 'confidentialTransferMint'` → `checks.confidentialTransfer` weight 20, `passed: false` |
| 5 | token-risk flags Token-2022 mints with TransferFee > 5% (>500 bps) | VERIFIED | `token-risk.ts` lines 135-143: `ext.extension === 'transferFeeConfig'` + `bps > 500` threshold |
| 6 | ConfidentialTransfer detection works even when ext.state is absent | VERIFIED | `token-risk.ts` line 126: presence-only check on `ext.extension` — no `ext.state` access for this branch |
| 7 | checkDomain returns RED for hostnames containing 'xn--' | VERIFIED | `domain-check.ts` line 102: `if (hostname.includes('xn--')) return true` in `hasHomoglyphRisk` |
| 8 | checkDomain returns RED for hostnames with charCode > 127 | VERIFIED | `domain-check.ts` lines 103-106: loop with `hostname.charCodeAt(i) > 127` |
| 9 | Homoglyph check fires BEFORE corpus lookup (fail-fast) | VERIFIED | `domain-check.ts`: `hasHomoglyphRisk` called at line 116, `queryCorpus` called at line 128 — ordering confirmed |
| 10 | Homoglyph RED result cached with DOMAIN_TTL (not forever) | VERIFIED | `domain-check.ts` line 123: `await cacheSet(cacheKey, result, DOMAIN_TTL)` — DOMAIN_TTL = 3600s |
| 11 | Worker /api/simulate enriches each SimDelta with symbol from Jupiter V1 + Redis cache | VERIFIED | `simulate.ts` lines 14-43: `getTokenSymbol` uses `token:meta:{mint}` cache key, fetches `api.jup.ag/tokens/v1/token/{mint}`, TTL 3600; lines 141-147: `Promise.all` enrichment after deltas built |
| 12 | Extension overlay renders d.symbol when present, else truncated mint | VERIFIED | `overlay.ts` line 669: `d.symbol ?? (d.mint.slice(0, 4) + '...')` |

**Score:** 12/12 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/sdk/src/tx-decoder.ts` | assign_account, durable_nonce, multi_drain detection + SYSTEM_PROGRAM constant | VERIFIED | All 5 patterns present: `01000000`, `04000000`, `assign_account`, `durable_nonce`, `multi_drain`; `SYSTEM_PROGRAM` constant at line 25; `multi_drain` block at lines 115-131 (post-loop) |
| `packages/sdk/src/token-risk.ts` | Token-2022 extension iteration with confidentialTransferMint + transferFeeConfig checks | VERIFIED | `parsed?.info?.extensions` iteration at line 121; both checks present at lines 126 and 135; field path matches existing `parsed?.info?.mintAuthority` convention |
| `packages/sdk/src/domain-check.ts` | hasHomoglyphRisk helper + early-exit branch in checkDomain | VERIFIED | Helper at lines 101-107; early-exit branch at lines 114-125; positioned before `queryCorpus` (line 128) and `goplusDomainCheck` (line 141) |
| `apps/worker/src/simulate.ts` | getTokenSymbol using api.jup.ag/tokens/v1/token + Promise.all enrichment | VERIFIED | `getTokenSymbol` at lines 14-43; endpoint `api.jup.ag/tokens/v1/token/${mint}`; cache key `token:meta:${mint}` TTL 3600; `Promise.all` enrichment at lines 141-147 |
| `apps/worker/.env.example` | JUPITER_API_KEY documented | VERIFIED | Lines 13-16 contain documented entry with free-tier portal link and optional-use comment |
| `apps/extension/src/overlay.ts` | updateSimulation uses d.symbol with mint fallback | VERIFIED | Line 669: `d.symbol ?? (d.mint.slice(0, 4) + '...')`; `SimDelta` interface at lines 9-15 includes `symbol?: string` |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| detectRedFlags loop | System Program (11111111111111111111111111111111) | `ix.program === SYSTEM_PROGRAM` | WIRED | Lines 87-102: `if (ix.program === SYSTEM_PROGRAM)` gate; uses `ix.dataHex.slice(0, 8)` (4-byte discriminator) as required |
| post-loop aggregate | DEX_PROGRAMS suppression | `instructions.some(ix => DEX_PROGRAMS.has(ix.program))` | WIRED | Line 118: `isDexTx` computed; line 119: `if (!isDexTx)` guards multi_drain emit |
| runChecks Token-2022 path | parsed.info.extensions array | `parsed?.info?.extensions` iteration | WIRED | Line 121: correct field path `parsed?.info?.extensions ?? []`; NOT `parsed?.extensions` |
| checkDomain entry | hasHomoglyphRisk(hostname) | early-exit before corpus + GoPlus | WIRED | Lines 116-125: homoglyph branch; line 128: corpus lookup follows; fail-fast confirmed |
| simulate.ts SimDelta enrichment | Upstash Redis (token:meta:{mint}) then Jupiter V1 | cacheGet → fetch with x-api-key → cacheSet | WIRED | Lines 15-16: `cacheGet` first; lines 22-38: Jupiter fetch with `x-api-key` header; line 38: `cacheSet` with TTL 3600 |
| overlay.ts updateSimulation | SimDelta.symbol | `d.symbol ?? d.mint.slice(0, 4) + '...'` | WIRED | Line 669 confirms exact pattern; `symbol?: string` declared in local `SimDelta` interface |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| DH-01 | 06-01-PLAN.md | System Program Assign ownership-hijack detection | SATISFIED | `tx-decoder.ts` line 89: discriminator `01000000` → `assign_account` RedFlag |
| DH-02 | 06-01-PLAN.md | Durable nonce (AdvanceNonceAccount) AMBER detection | SATISFIED | `tx-decoder.ts` line 96: discriminator `04000000` → `durable_nonce` RedFlag; detail is informational only |
| DH-03 | 06-02-PLAN.md | Token-2022 ConfidentialTransfer + TransferFee > 5% detection | SATISFIED | `token-risk.ts` lines 118-147: both extensions checked; threshold `bps > 500`; presence-only for ConfidentialTransfer |
| DH-04 | 06-01-PLAN.md | Multi-instruction drain pattern with DEX false-positive suppression | SATISFIED | `tx-decoder.ts` lines 115-131: post-loop block; `isDexTx` suppresses on Jupiter/Orca/Raydium |
| DH-05 | 06-04-PLAN.md | Jupiter token symbol enrichment in sim row (overlay UX) | SATISFIED | `simulate.ts` + `overlay.ts` + `.env.example`: full cache-first pipeline wired; graceful degradation on missing key |
| DH-06 | 06-03-PLAN.md | Homoglyph/Unicode domain detection (IDN homograph fail-fast) | SATISFIED | `domain-check.ts` lines 101-125: `xn--` + charCode > 127 checks; cached with DOMAIN_TTL |

No orphaned requirements — all 6 DH-xx IDs are claimed by a plan and verified in the codebase.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/worker/src/simulate.ts` | 106-121 | Pre-existing TS errors: `preBalances`, `postBalances`, `preTokenBalances`, `postTokenBalances` not found on `SimulatedTransactionResponse` type | Info | Type-only — runtime behavior correct; Solana web3.js type definitions lag the actual RPC response shape; not introduced by phase 06 |
| `apps/worker/src/ingest.ts` | 352-434 | Pre-existing TS errors: Supabase generated type schema drift | Info | Not introduced by phase 06; out of scope |
| `apps/extension/src/content.ts` | 85 | Pre-existing TS error: `import.meta.env` — `env` not on `ImportMeta` | Info | Not introduced by phase 06; pre-dates phase |
| `packages/sdk` | — | Pre-existing TS errors: `@types/mocha` + `@upstash/redis` declaration conflicts | Info | Third-party type conflicts not introduced by this phase |

No blocker-severity anti-patterns introduced by phase 06. All TS errors noted are pre-existing and confirmed not introduced by the DH-01 through DH-06 changes.

---

## Human Verification Required

### 1. Overlay Token Symbol Rendering

**Test:** Sign a test transaction that moves a known token (e.g. USDC) with `JUPITER_API_KEY` set in worker env. Open extension overlay.
**Expected:** Sim row shows `-1.00 USDC` instead of `-1.00 EPjF...`
**Why human:** Requires live extension + running worker + valid Jupiter API key — cannot verify rendering end-to-end statically.

### 2. assign_account Red Flag Display Timing

**Test:** Trigger a transaction containing a System Program Assign instruction (e.g. using a test drainer fixture).
**Expected:** Overlay shows the ownership-hijack warning text immediately (before Claude streams), and it appears in the red-flag pre-emit block.
**Why human:** Red flag pre-emit sequence requires live extension with transaction signing flow.

---

## Gaps Summary

No gaps. All 6 requirements (DH-01 through DH-06) are fully implemented across 5 files. All 12 observable truths are verified at all three levels (exists, substantive, wired). TypeScript errors present are pre-existing and unrelated to this phase's changes.

---

_Verified: 2026-05-03T14:30:00Z_
_Verifier: Claude (gsd-verifier)_
