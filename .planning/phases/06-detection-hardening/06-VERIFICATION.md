---
phase: 06-detection-hardening
verified: 2026-05-03T18:18:27Z
status: gaps_found
score: 6/7 checks verified
re_verification:
  previous_status: passed
  previous_score: 12/12
  gaps_closed: []
  gaps_remaining:
    - "npm run build fails — DTS error at domain-check.ts:80 (ThreatReport.source type mismatch)"
  regressions: []
  note: "Previous verification covered DH-01 through DH-06 (tx-decoder, token-risk, overlay, simulate). This re-verification covers the zero-latency hostname heuristics added post-session: checkHostingPlatformSquat, checkKeywordSquatting, checkHighRiskTld."
gaps:
  - truth: "npm run build completes with zero TypeScript errors"
    status: failed
    reason: "DTS build fails — ThreatReport.source union does not include 'on-chain', assigned at domain-check.ts:80 in the lookupAddress on-chain PDA fallback path (pre-existing, not introduced by hostname heuristics)"
    artifacts:
      - path: "packages/sdk/src/domain-check.ts"
        issue: "Line 80: source: 'on-chain' is not assignable to 'chainabuse' | 'scam_sniffer' | 'community' | 'twitter'"
      - path: "packages/sdk/src/types.ts"
        issue: "Line 20: ThreatReport.source union is missing the 'on-chain' variant"
    missing:
      - "Add 'on-chain' to ThreatReport.source union in packages/sdk/src/types.ts line 20"
human_verification:
  - test: "Confirm overlay sim row shows token symbol (e.g. 'USDC') not truncated mint during live transaction signing"
    expected: "Sim row displays '-1.00 USDC' not '-1.00 EPjF...'"
    why_human: "Requires live extension + Jupiter API key wired to worker — cannot verify rendering end-to-end statically"
  - test: "Trigger a transaction that includes a System Program Assign instruction and confirm overlay shows assign_account warning"
    expected: "Overlay displays the ownership-hijack red flag before Claude streamed text"
    why_human: "Red flag pre-emit at signing time requires live extension context"
---

# Phase 06: Detection Hardening — Re-Verification Report (Hostname Heuristics)

**Phase Goal:** Add zero-latency hostname heuristics to `checkDomain()` in `packages/sdk/src/domain-check.ts` so that brand-impersonation, hosting-platform subdomain squatting, and high-risk TLDs are caught before any network call (GoPlus, Supabase).
**Verified:** 2026-05-03T18:18:27Z
**Status:** PARTIAL — heuristic logic is correct and complete; build has one type error in an adjacent function
**Re-verification:** Yes — previous verification (2026-05-03T14:30:00Z) covered DH-01 through DH-06 and passed 12/12. This pass covers the hostname heuristic additions made in the same session.

---

## Check Results

### Check 1 — All 3 heuristic functions are present

**Result: PASS**

All three functions exist in `packages/sdk/src/domain-check.ts`:

| Function | Lines | Signature |
|---|---|---|
| `checkHostingPlatformSquat(hostname)` | 165–177 | `string → { platform, brand } \| null` |
| `checkKeywordSquatting(hostname)` | 149–157 | `string → { brand } \| null` |
| `checkHighRiskTld(hostname)` | 159–163 | `string → string \| null` |

Supporting constants present:
- `BRAND_CANONICALS` (lines 112–130) — all 17 brands specified (phantom, solflare, backpack, glow, slope, exodus, ledger, trezor, metamask, coinbase, jupiter, raydium, orca, marinade, kamino, drift, mango)
- `HIGH_RISK_TLDS` (lines 134–137) — all 14 TLDs specified (xyz, top, click, buzz, shop, live, online, site, store, icu, fun, vip, work, cyou)
- `HOSTING_PLATFORMS` (lines 140–143) — all 9 platforms specified (vercel.app, github.io, netlify.app, pages.dev, web.app, firebaseapp.com, surge.sh, glitch.me, replit.dev)
- `isCanonicalOrSubdomain` helper (lines 145–147)

---

### Check 2 — Pipeline order in `checkDomain()` is correct

**Result: PASS**

Actual pipeline traced from `checkDomain()` at lines 179–256:

| Step | Check | Lines | Outcome if triggered |
|---|---|---|---|
| 1 | Redis cache | 181–182 | Return cached result |
| 2 | `hasHomoglyphRisk` (IDN/Punycode) | 185–194 | RED 0.9 |
| 3 | `checkHostingPlatformSquat` | 197, 201–210 | RED 0.92 |
| 4 | `checkKeywordSquatting` | 198, 212–223 | RED 0.88 (or 0.95 if also high-risk TLD) |
| 5 | `queryCorpus` (Supabase) | 226–236 | RED at corpus confidence |
| 6 | `goplusDomainCheck` | 239–242 | RED 0.85 |
| 7 | High-risk TLD alone (no squat) | 243–249 | AMBER 0.35 |
| 8 | Default | 250–252 | AMBER 0.0 |

All three heuristics are evaluated before any async call. `riskTld` is computed alongside `hosting` and `squat` at lines 197–199 and is available for the confidence boost at line 218.

---

### Check 3 — Canonical domains pass cleanly

**Result: PASS (code trace)**

`isCanonicalOrSubdomain` at line 145–147: `hostname === canonical || hostname.endsWith('.' + canonical)`

| Hostname | Brand | Match | Outcome |
|---|---|---|---|
| `phantom.app` | phantom | exact match `phantom.app` | Skipped (canonical) |
| `jup.ag` | jupiter | 'jup.ag' does not contain 'jupiter' | Not evaluated |
| `raydium.io` | raydium | exact match `raydium.io` | Skipped (canonical) |
| `orca.so` | orca | exact match `orca.so` | Skipped (canonical) |
| `marinade.finance` | marinade | exact match `marinade.finance` | Skipped (canonical) |
| `coinbase.com` | coinbase | exact match `coinbase.com` | Skipped (canonical) |

None of these would be flagged. PASS.

---

### Check 4 — Subdomains of canonicals pass cleanly

**Result: PASS (code trace)**

`hostname.endsWith('.' + canonical)` covers the subdomain case:

| Hostname | Canonical | endsWith | Outcome |
|---|---|---|---|
| `app.phantom.com` | `phantom.com` | `'app.phantom.com'.endsWith('.phantom.com')` = true | Skipped |
| `app.phantom.app` | `phantom.app` | `'app.phantom.app'.endsWith('.phantom.app')` = true | Skipped |
| `swap.raydium.io` | `raydium.io` | `'swap.raydium.io'.endsWith('.raydium.io')` = true | Skipped |
| `station.jup.ag` | `station.jup.ag` | exact match = true | Skipped |
| `wallet.coinbase.com` | `wallet.coinbase.com` | exact match = true | Skipped |
| `app.coinbase.com` | `coinbase.com` | `'app.coinbase.com'.endsWith('.coinbase.com')` = true | Skipped |

No false positives on legitimate subdomains. PASS.

---

### Check 5 — False-positive risk: `coinbase.something.com` correctly triggers detection

**Result: PASS (code trace — correct behavior)**

`checkKeywordSquatting('coinbase.something.com')`:
1. `lower.includes('coinbase')` = true
2. `isCanonicalOrSubdomain('coinbase.something.com', 'coinbase.com')` → `'coinbase.something.com'.endsWith('.coinbase.com')` = **false**
3. `isCanonicalOrSubdomain('coinbase.something.com', 'wallet.coinbase.com')` → `'coinbase.something.com'.endsWith('.wallet.coinbase.com')` = **false**
4. Returns `{ brand: 'coinbase' }` → RED 0.88

This is the correct behavior. Non-canonical domains that contain a brand keyword but are not a legitimate subdomain are flagged.

Additional edge case checked: `coinbase.com.evil.xyz` — contains 'coinbase', not a canonical/subdomain of `coinbase.com` or `wallet.coinbase.com` → RED. Correct.

---

### Check 6 — TypeScript build: `npm run build`

**Result: FAIL**

Build output:

```
src/domain-check.ts(80,11): error TS2322: Type '"on-chain"' is not assignable to
type '"chainabuse" | "scam_sniffer" | "community" | "twitter"'.

Error: error occurred in dts build
```

The CJS and ESM bundles compile successfully. Only the DTS (type declarations) step fails.

**Root cause:** In `lookupAddress()` (the on-chain PDA fallback path, lines 77–84), a `ThreatReport` is constructed with `source: 'on-chain'`. The `ThreatReport` interface in `packages/sdk/src/types.ts` line 20 defines `source` as a closed union of `'chainabuse' | 'scam_sniffer' | 'community' | 'twitter'` — which excludes `'on-chain'`.

This error is in `lookupAddress`, not in any of the Phase 06 heuristic functions. The three new heuristic functions are not involved. The error was pre-existing before the hostname heuristics were added.

**Impact:** `npm run build` exits code 1. The package cannot be consumed as a typed dependency. Publishing to npm would fail type checks for downstream consumers.

**Required fix:**

In `packages/sdk/src/types.ts` line 20, add `'on-chain'` to the source union:

```typescript
// Before
source: 'chainabuse' | 'scam_sniffer' | 'community' | 'twitter'

// After
source: 'chainabuse' | 'scam_sniffer' | 'community' | 'twitter' | 'on-chain'
```

---

### Check 7 — Test file for domain-check heuristics

**Result: PARTIAL**

Files found in `packages/sdk/tests/`:
- `rpc-fast.test.ts`
- `private-report-cloak.test.ts`

No `domain-check.test.ts` exists. The three new heuristic functions have zero automated test coverage. Given the sensitivity of the canonical allowlist logic (a regression in `isCanonicalOrSubdomain` could false-positive legitimate wallet sites for users), at minimum the following cases should be tested:

- `checkHostingPlatformSquat('phantom-swap.vercel.app')` → non-null (RED)
- `checkHostingPlatformSquat('mysite.vercel.app')` → null (no brand keyword)
- `checkKeywordSquatting('phantom.app')` → null (canonical)
- `checkKeywordSquatting('app.phantom.app')` → null (subdomain of canonical)
- `checkKeywordSquatting('phantom-airdrop.xyz')` → non-null (RED)
- `checkKeywordSquatting('coinbase.something.com')` → non-null (RED)
- `checkHighRiskTld('evil.xyz')` → `'xyz'`
- `checkHighRiskTld('phantom.app')` → null

This is a follow-up recommendation, not a blocker for the heuristics themselves functioning correctly.

---

## Observable Truths Summary

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | `checkHostingPlatformSquat` function present and correct | VERIFIED | Lines 165–177; uses `endsWith('.' + platform)` + brand keyword scan |
| 2 | `checkKeywordSquatting` function present with canonical allowlist | VERIFIED | Lines 149–157; `isCanonicalOrSubdomain` helper at 145–147 |
| 3 | `checkHighRiskTld` function present with correct TLD set | VERIFIED | Lines 159–163; 14 TLDs in `HIGH_RISK_TLDS` set |
| 4 | Pipeline order: heuristics before corpus and GoPlus | VERIFIED | Lines 197–223 (sync) precede lines 226–242 (async) |
| 5 | Canonical domains do not false-positive | VERIFIED | Code trace — exact match and endsWith logic correct |
| 6 | Legitimate subdomains do not false-positive | VERIFIED | Code trace — `endsWith('.' + canonical)` handles all cases |
| 7 | `npm run build` exits 0 | FAILED | DTS error at `domain-check.ts:80` — `source: 'on-chain'` not in `ThreatReport.source` union |

**Score: 6/7**

---

## Overall Verdict: PARTIAL

The hostname heuristic implementation is logically complete and correct. All three functions match the spec, the pipeline order is right, the canonical allowlist logic is sound, and the confidence values match the spec (0.92 hosting squat, 0.88 keyword squat, 0.95 keyword + high-risk TLD, AMBER 0.35 TLD alone).

The single failing check is a pre-existing TypeScript type error in the `lookupAddress` function (unrelated to the heuristic additions) that prevents `npm run build` from completing successfully. Because the DTS step fails, the package cannot be published or consumed with types by downstream code.

**One-line fix required:**
`packages/sdk/src/types.ts` line 20 — add `'on-chain'` to `ThreatReport.source` union.

Once that fix is applied, all 7 checks will pass and the phase can be marked PASSED.

---

_Verified: 2026-05-03T18:18:27Z_
_Verifier: Claude (gsd-verifier)_
