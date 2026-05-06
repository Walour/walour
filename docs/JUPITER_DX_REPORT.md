# Jupiter Developer Platform: DX Report
**Project:** Walour (Wallet Armour) — Real-time Solana scam protection  
**Integration:** Tokens v2 (security signals) + Price v3 (liquidity)  
**Use case:** Per-transaction token risk scoring at the moment of signing  
**Author:** Sahir (@Sahir__S)  
**Date:** May 2026

---

## What we built

Walour is a Chrome extension that intercepts Solana transactions before a user signs them and runs a multi-signal risk score. Every signing prompt triggers a scan: phishing domain check, on-chain mint/freeze authority, holder concentration, LP lock, Token-2022 extension analysis, GoPlus honeypot flag, and our own threat corpus.

We added Jupiter as a 6th intelligence layer — the first external API in our stack built specifically around token quality signals rather than threat lists.

**APIs used:**

| Endpoint | Fields consumed |
|---|---|
| `GET /tokens/v2/search?query={mint}` | `organicScore`, `organicScoreLabel`, `isVerified`, `audit.isSus`, `audit.devBalancePercentage`, `audit.devMints` |
| `GET /price/v3?ids={mint}` | presence in response, `usdPrice`, `liquidity` |

Both calls run in parallel with the existing checks inside a `Promise.allSettled`. A 2.5s timeout is set on each. If Jupiter is unreachable or rate-limited, the rest of the engine continues unaffected — no blast radius.

---

## Integration story

Our token risk engine already checked mint authority and freeze authority on-chain. When we read the Tokens v2 OpenAPI spec, we found Jupiter's `audit` object also carries `mintAuthorityDisabled` and `freezeAuthorityDisabled` — the same signals we were deriving from RPC, pre-computed. That was the moment we realised Jupiter's audit layer is closer to what we needed than GoPlus: it's structured, token-specific, and built with the same threat model as a security product.

The integration took one working day. We did not need to migrate anything — Jupiter slotted cleanly alongside the existing checks.

---

## What worked well

**1. `organicScoreLabel` is the right abstraction for a risk tool**

The categorical label (`high` / `medium` / `low`) is more useful than the raw `organicScore` number for a signing-time decision. We don't need to calibrate our own threshold — Jupiter has already done that. We use the label as the primary signal and fall back to the numeric value only when the label is absent.

This is good API design: expose the opinionated interpretation alongside the raw number.

**2. `audit.isSus` semantics are correctly specified**

The docs make clear that `isSus` is only present in the response when flagged — absence does not mean safe, it means unchecked. This is important. A naive implementation would treat `isSus: undefined` as `isSus: false` and silently miss the distinction. We type it as `true | null` in our codebase to make this explicit. The docs are correct here; most APIs get this wrong by returning `false` instead of omitting the field.

**3. Price v3 absent-token semantics are honest**

Tokens with unreliable pricing are omitted from the response entirely rather than returned as null. The documentation says: "Tokens without reliable pricing are omitted — factors include: not traded in 7 days, suspicious activity flags, organic score validation failures." This is a clean contract. We treat a token being absent from the price response (for a token older than 7 days) as a risk signal — no routing = no liquidity = potential rug. The fact that the docs explicitly cross-reference `audit.isSus` as a companion to the price absence check validates this approach.

**4. Batch capability via comma-separated mints**

The `/tokens/v2/search` endpoint accepts comma-separated mints up to 100. For Solana transactions that involve multiple token accounts (common in DeFi), we can batch all mints in a single call. We're currently calling it one-at-a-time because each token check is independently cached, but the batch capability is important for reducing latency on complex transactions.

**5. The portal analytics give us integration health without contacting support**

Real-time request logs in the portal let us verify our API key is being used, check latency trends, and confirm rate limit headroom. For a background security check that runs silently, this observability matters.

---

## What was confusing or missing

**1. `organicScore` numeric thresholds are unpublished**

The field is described as "0-100 measuring real vs wash trading activity" but no reference points are published. What is the median score for a verified token? What score would Jupiter's own UI show a warning at? We use `organicScoreLabel` as the primary signal precisely because we can't calibrate the number ourselves. The label is good — but documenting the approximate score ranges that map to each label would let builders use the numeric field more confidently.

**2. `confidenceLevel` in Price v3 is documented in prose but absent from the OpenAPI spec**

The how-to guide says "use `confidenceLevel` for safety-sensitive actions." The field does not appear in the OpenAPI YAML. We could not use it. For a security product making risk decisions, this is exactly the kind of field we'd want. Either add it to the spec or remove the reference in the prose — the current state means builders who follow the spec can't use a field the narrative recommends.

**3. `audit.isSus` has no freshness or methodology disclosure**

The field is binary and useful. But for a product that shows users "flagged suspicious by Jupiter audit," we need to know: is this flag manual review, algorithmic, or both? How often is it re-evaluated? A token that was suspicious 6 months ago and has since changed ownership looks identical to one flagged today. Even a coarse `auditedAt` timestamp would let risk tools weight the signal appropriately.

**4. Token not indexed returns an empty array — indistinguishable from "no signals found"**

If a mint is too new or obscure to be in Jupiter's index, `/tokens/v2/search` returns `[]`. We treat this as "no data, skip Jupiter scoring." But "never seen this token" is itself a mild risk signal at signing time. An explicit `indexed: false` field in the response, or a separate `GET /tokens/v2/exists?mint=` endpoint, would let risk tools distinguish "clean" from "unknown."

**5. No `updatedAt` or `indexedAt` per token**

The Tokens v2 response has no freshness metadata. GoPlus returns a result timestamp; we use it to downweight stale signals. Jupiter's token data could be an hour old or six months old — there is no way to tell. For security use cases, data staleness matters more than it does for price display.

---

## How Jupiter signals performed in testing

We tested against three token categories:

**Known rug / suspicious token:** `organicScoreLabel: "low"`, `audit.isSus: true`, `devBalancePercentage: 47%`, absent from Price v3. All four signals fired. Combined Jupiter contribution pushed the risk score past the RED threshold (60/100) on its own.

**Known clean verified token (USDC, JUP):** `organicScoreLabel: "high"`, `isVerified: true`, price present. Jupiter contributed positive passes to the score — the overlay shows these as green checks alongside on-chain results.

**New unindexed token (<24h old):** Empty array from search, absent from price. Jupiter correctly returned no data. The engine continued with on-chain checks only. No false alarm.

---

## Integration summary

| Check | Source field | Weight | Condition |
|---|---|---|---|
| Organic score (low) | `organicScoreLabel: "low"` | 15/100 | RED flag |
| Organic score (high) | `organicScoreLabel: "high"` | 15/100 | Positive pass |
| Suspicious audit flag | `audit.isSus: true` | 20/100 | RED flag — only when present |
| Unverified (with other flags) | `isVerified: false` | 5/100 | Conditional — only if score already > 0 |
| Dev concentration | `devBalancePercentage > 20%` | 10/100 | AMBER flag; dev mint count shown in detail |
| No price (established token) | absent from Price v3 | 10/100 | AMBER flag — only for tokens >7 days old |

Maximum Jupiter contribution: 60 points. RED threshold in Walour's scorer is 60. Jupiter signals alone can push a suspicious token to RED, or corroborate on-chain signals to cross the threshold.

---

## What we would build next

- **`/tokens/v2/recent` polling via Vercel cron** — cache newly-pooled tokens every 5 minutes. Tokens that appear in `/recent` and have no prior history get auto-escalated to AMBER until they age past 7 days. This closes the gap between a rug being launched and it accumulating enough on-chain data to be detected by our existing checks.
- **`/tokens/v2/tag?query=verified` allow-list** — fast-path for Jupiter-verified tokens. If a token appears in the verified tag list, skip the expensive on-chain checks and return GREEN immediately with a "Jupiter-verified" badge. Reduces latency on the common case.
- **Batch mint lookups for complex transactions** — ALT-based transactions can involve 10+ unique token accounts. A single comma-separated call to `/tokens/v2/search` would replace N parallel single-mint calls, cutting the fetch time for complex transactions significantly.

---

## Overall

Jupiter's security fields fill a real gap. `organicScore` and `audit.isSus` are not available from GoPlus or on-chain data. The integration is clean — one endpoint, standard auth, graceful degradation. The main investment needed from Jupiter's side is documentation depth on the security-specific fields: threshold semantics, freshness metadata, and methodology disclosure. For builders making risk decisions with these signals, the "what does this number mean" question matters more than it does for price display use cases.
