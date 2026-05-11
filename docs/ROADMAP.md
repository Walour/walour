# Walour Post-Hackathon Roadmap

**Owner:** Sahir (@Sahir__S)  
**Status:** Colosseum Frontier submission shipped (May 11 2026). This roadmap covers May 12 onward.  
**Goal:** Take Walour from working hackathon submission to industrial-grade security oracle that wallets, dApps, and exchanges integrate as core infrastructure.

---

## Phase 1 — Critical Fixes (Bleed Stop)

**Goal:** Close every known correctness/security gap that could embarrass us in production or get a user drained.  
**Time estimate:** 7–10 days

### Tasks

- **Cloak mainnet support** — replace hardcoded `cluster: 'devnet'` with env-driven `WALOUR_CLOAK_CLUSTER`. Add integration test against mainnet.
- **Tamper-resistant extension messaging** — replace `window.__walour === true` sentinel with HMAC-signed message envelope using a per-session nonce minted by the background service worker.
- **Endpoint authentication** — add API key + per-install JWT (24h TTL) on `/scan`, `/decode`, `/lookup`, `/report`. Free public tier: 30 req/min/IP via Upstash sliding window.
- **Schema-stable PDA decoding** — switch off raw byte-offset reads. Use Anchor's `try_deserialize` everywhere; SDK reads IDL from chain rather than hardcoded layouts.
- **Overlay timeout + fail-safe** — 4s soft timeout → "Risk check unavailable" state. 8s hard timeout → close overlay, emit `decode_timeout` telemetry. Never hang the wallet.
- **Corpus garbage collection** — nightly cron: demote entries >180d with confidence <0.7 to `archived`, delete `archived` entries >365d, delete entries with ≥3 successful appeals.
- **Telemetry** — wire `drain_blocked`, `decode_timeout`, `false_positive_appeal` into PostHog.

### Why this matters
Cloak-on-devnet makes private reports non-functional in prod. Forgeable extension messages let a malicious site spoof a "safe" verdict. Open endpoints get scraped within a week of real traffic.

---

## Phase 2 — Performance & Reliability Hardening

**Goal:** Walour stays fast and online when Helius hiccups, Vercel redeploys, or a transaction touches 30 accounts.  
**Time estimate:** 8–12 days

### Tasks

- **Persistent circuit breaker** — move breaker counters from in-memory `Map` to Upstash Redis with 60s TTL keys (`cb:helius:fails`, `cb:goplus:open_until`). Survives cold starts and edge function churn.
- **Batch corpus lookups** — replace per-account `select().eq('address', x)` with a single `select().in('address', accounts)`. Add in-memory LRU (1000 entries, 60s TTL) for hot addresses. Target: ≤1 Supabase round trip per `decodeTransaction`.
- **Edge-cached scan results** — wrap `/api/scan` in Vercel's `unstable_cache` keyed by mint address, `revalidate: 300`. Burst traffic on a viral mint: 10k Supabase reads → 1.
- **RPC fallback chain** — enforce hard 800ms timeout per provider, race Helius vs Triton with `Promise.race`, log every fallback to `provider_fallback` event.
- **Synthetic monitoring** — Checkly or BetterStack hitting `/scan`, `/decode` every 60s from 3 regions. Page on 2 consecutive failures.
- **Sentry + structured logging** — Sentry on extension + all edge functions. Pino JSON logs to Axiom. Error budget: 99.5% scan availability.
- **Load test** — k6 script simulating 500 rps against `/scan` and `/decode`. Document p50/p95/p99 and cost-per-1k-scans.

### Why this matters
A single Helius outage today silently breaks the overlay because the breaker resets on every redeploy. Wallet integration partners won't tolerate this.

---

## Phase 3 — Feature Upgrades

**Goal:** Match what real security products ship (Blowfish, Wallet Guard), then exceed them on oracle/NLP axes.  
**Time estimate:** 18–25 days

### Tasks

- **Transaction simulation** — use Helius `simulateTransaction` with `accountsToReturn` to compute pre/post token + SOL deltas for the signer. Render in overlay as "You will pay X, you will receive Y." Flag any unexpected balance change to a non-signer-controlled account as high risk.
- **Appeal/dispute flow** — Anchor instruction `appeal_threat`: stake 0.01 SOL to challenge a corpus entry. Web UI at `walour.xyz/appeal/[id]`. Adjudication via 2-of-3 multisig (v1). Successful appeals refund stake + zero confidence + trigger GC.
- **Signed threat certificates** — every corpus entry signed by Walour's Ed25519 oracle key on write. SDK's `lookupAddress` verifies signature before trusting. Public key at `walour.xyz/.well-known/walour-oracle-key.json`.
- **Source attribution + confidence math** — every entry tracks `sources: [{provider, weight, fetched_at}]`. Confidence is a weighted aggregate, not a single float. Surfaces in overlay as "3 sources: ScamSniffer, GoPlus, community."
- **Domain phishing model upgrade** — add Levenshtein + homoglyph check against top 200 Solana dApps. Cache verdicts in Redis 1h.
- **NLP scam-classifier endpoint** — `/api/classify`: Claude Sonnet 4.6 with prompt cache, classifies arbitrary text (DM, tweet, email) as scam-likely/benign with cited reasons.

### Why this matters
Simulation is table stakes for any wallet partnership conversation. Appeals fix false-positive accumulation. Signed certs make Walour usable as shared infrastructure — the framing Colosseum winners use.

---

## Phase 4 — Mobile App

**Goal:** Be the first Solana scam protection on mobile. Zero competitors have shipped here.  
**Time estimate:** 20–28 days

### Tasks

- **Bootstrap** — Expo + React Native + `@solana-mobile/mobile-wallet-adapter-protocol`. Repo: `apps/mobile/`.
- **MWA interception layer** — register as MWA-aware app wrapping `signTransaction` / `signAndSendTransactions`. On Saga/Seeker, ship as system-level companion app with overlay permission.
- **Reuse `@walour/sdk` directly** — SDK is pure TS, no DOM deps. Wire `decodeTransaction` streaming into a bottom-sheet UI.
- **Push notifications for watched addresses** — Expo push + Yellowstone gRPC stream. User pins addresses; we alert on any outgoing tx within 2s.
- **Registry tab** — searchable threat registry, signed certs visible.
- **iOS note** — iOS cannot intercept other wallets' signing. Ship iOS as "lookup + watchlist + education"; Android/Saga gets full interception.

### Why this matters
Mobile is the largest unaddressed surface in Solana scam protection. No competitor has it. Turns Walour from "Chrome extension" into "platform."

---

## Phase 5 — Distribution & Growth

**Goal:** `@walour/sdk` becomes a default dependency for any Solana app handling user funds.  
**Time estimate:** ongoing, ~15 focused days to bootstrap

### Tasks

- **Publish `@walour/sdk` v1.0** — proper semver, full TypeDoc at `walour.xyz/docs`, runnable examples (Next.js, Vite, RN). Bundle size budget: <40KB gzipped.
- **Wallet partnership pitches** — Phantom, Solflare, Backpack, Glow: "embed `@walour/sdk` natively, we provide the oracle, you keep the UI." Have simulation + signed certs ready before pitching.
- **dApp drop-in widget** — `@walour/react`: `<WalourGuard>` wrapper any dApp can put around `signTransaction`. One-line integration. Targets Jupiter, Drift, Tensor, MagicEden first.
- **Bug bounty** — Cantina or Immunefi tier-2 ($25k cap) on the Anchor oracle program and signed-cert verification path.
- **Threat-feed API for partners** — paid tier streaming new threats via SSE. Customers: CEX compliance teams, on-chain forensics firms.
- **Superteam + Solana Foundation grants** — frame as security oracle / shared infrastructure (+27% winner attribute).
- **Dialect Blinks** — every confirmed scam gets a shareable Blink. Native Solana distribution surface.

---

## Sequencing

- **Phase 1 before any v1.0 announce.** Ship the week after Colosseum results.
- **Phases 2 and 3 interleave** — performance work while feature work is in review.
- **Phase 4 starts in parallel with Phase 3** if you have a co-builder. Otherwise serial.
- **Phase 5 starts the day Phase 1 ships.** Partnership conversations have long lead time.

---

## Anti-goals

- No points, XP, leaderboards, or streaks. (Winner-underindexed −57%.)
- No NFT badges, no token launch. (Winner-underindexed −56%.)
- No blocking outright on ALT resolution failure — always degrade to warning.
- No gamification of the reporter system.
