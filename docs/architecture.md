# Walour — System Architecture

**Version:** v4 · **Date:** 2026-05-03

---

## 1. High-Level Overview

```
User Browser / Mobile
        │
        ▼
┌────────────────────┐     ┌─────────────────────────┐
│  Chrome Extension  │     │   Mobile App (v2)        │
│  (Manifest V3)     │     │   (React Native / Expo)  │
└────────┬───────────┘     └────────────┬────────────┘
         │                              │
         └──────────┬───────────────────┘
                    │
                    ▼
          ┌─────────────────┐
          │  @walour/sdk    │  (npm, MIT-licensed)
          │  TypeScript     │
          └────┬────────────┘
               │
    ┌──────────┼──────────────────────────────┐
    │          │                              │
    ▼          ▼                              ▼
F-SDK-01   F-SDK-02                       F-SDK-03
Token      Transaction                    URL/Domain
Risk       Decoder                        Check
Scorer     (Claude                        (Homoglyph +
(Helius    Sonnet 4.6)                    Corpus +
+ GoPlus)                                 GoPlus)
+ GoPlus)
    │          │                              │
    └──────────┴──────────────────────────────┘
                    │
                    ▼
          ┌─────────────────┐
          │  Upstash Redis  │  Cache layer (all SDK calls)
          └─────────────────┘
                    │
         ┌──────────┴──────────┐
         │                     │
         ▼                     ▼
  ┌────────────┐      ┌─────────────────┐
  │  Helius    │      │  Supabase       │
  │  RPC       │      │  (threat corpus │
  │  (primary) │      │   + telemetry)  │
  └────────────┘      └─────────────────┘
         │                     ▲
         ▼                     │
  ┌────────────┐      ┌─────────────────┐
  │  Triton    │      │  Ingestion      │
  │  (fallback)│      │  Worker         │
  └────────────┘      │  (Vercel Cron   │
                      │   every 15 min) │
                      └────────┬────────┘
                               │
               ┌───────────────┼──────────────┐
               │               │              │
               ▼               ▼              ▼
         Scam Sniffer    GoPlus          Twitter v2
         (60k domains)   token/domain    scrape
```

---

## 2. Components

### 2.1 `@walour/sdk` (npm)

Core scanning engine. All three check functions follow the same pattern:

```
exported function
  → check Redis cache
  → cache hit? return immediately
  → cache miss: call external APIs
  → normalize result
  → write to cache with TTL
  → return result
```

**Exports:**
- `checkTokenRisk(mint: string): Promise<TokenRiskResult>`
- `decodeTransaction(tx: VersionedTransaction): AsyncGenerator<string>` (streaming)
- `checkDomain(hostname: string): Promise<DomainRiskResult>`
- `lookupAddress(pubkey: string): Promise<ThreatReport | null>`

---

### 2.2 Chrome Extension

**Manifest V3.** Content script injects into all pages. Background service worker manages the wallet provider hook.

**Injection flow:**
1. Content script detects wallet provider (`window.phantom`, `window.solflare`, `window.backpack`).
2. Wraps `provider.signTransaction` and `provider.signAndSendTransaction` with Walour interceptors.
3. On intercept: run all 3 SDK checks in parallel.
4. Render overlay popup with streaming Claude output.
5. User clicks "Don't sign" → emit `drain_blocked` telemetry → abort. Or "Sign anyway" → proceed.

---

### 2.3 Threat Corpus Ingestion Worker

Vercel Cron job, runs every 15 minutes.

```
F-SDK-00 worker
  → fetch Scam Sniffer all.json (up to 60k phishing domains)
  → fetch GoPlus known-malicious Solana token list
  → fetch Twitter v2 search results (if TWITTER_BEARER_TOKEN set)
  → normalize each entry (base58 validate / lowercase domain)
  → dedup against Supabase
    → exists? increment confidence + update last_updated
    → new? insert with source-weight confidence
  → purge: confidence < 0.2 AND age > 90 days
  → done in < 60s
```

**Source confidence weights:**
- Scam Sniffer: 0.85
- GoPlus: 0.8
- Community report: 0.4 (until corroborated)
- Twitter scrape: 0.3 (until corroborated)

---

### 2.4 Walour Oracle (Anchor Program)

On Solana mainnet. Program name: `walour_oracle`.

**PDAs:**
```
ThreatReport PDA
  seed: ["threat", address]
  fields: address, type, source, evidence_url, confidence, first_seen, last_updated, corroborations

Reporter PDA
  seed: ["reporter", reporter_pubkey]
  fields: pubkey, reports_submitted, confidence_avg, last_active
```

**Instructions:**
- `submit_report(address, type, evidence_url)` — public, reporter-signed
- `corroborate_report(address)` — public
- `update_confidence(address, new_score)` — admin multisig only (v1)

Ingestion worker promotes high-confidence Supabase entries to mainnet PDAs on each sync cycle.

---

### 2.5 Caching Layer (Upstash Redis)

| Key | TTL | Notes |
|---|---|---|
| `token:risk:{mint}` | 60s | Short TTL — token state changes fast |
| `tx:decode:{programId}:{ixDiscriminator}` | 24h | Instruction shapes are stable |
| `address:threat:{pubkey}` | 5 min | Corpus updates every 15 min |
| `domain:risk:{hostname}` | 1h | Domain reputations are slow-moving |

---

### 2.6 Circuit Breakers

All external dependencies wrap in a circuit breaker:

| Dependency | Primary | Fallback | Last Resort |
|---|---|---|---|
| RPC | Helius | Triton | Solana public RPC |
| LLM | Claude Sonnet 4.6 | Claude Haiku 4.5 | Cached generic warning |
| Threat intel | Walour corpus | GoPlus Security API | — |

Threshold: 3 failures / 60s → circuit opens → 30s cooldown → half-open retry.

---

### 2.7 Telemetry

Every prevented signing event emits `DrainBlockedEvent` to Supabase:

```ts
DrainBlockedEvent {
  event_id: string           // uuid v7
  timestamp: number          // unix ms
  wallet_pubkey: string
  blocked_tx_hash: string
  drainer_target?: string
  block_reason: 'phishing_domain' | 'malicious_token' | 'known_drainer' | 'ai_flagged_transfer' | 'setauthority_detected'
  estimated_sol_saved: number
  estimated_usd_saved: number
  confirmed: boolean         // post-hoc sim: > 0.01 SOL would have drained
  surface: 'extension' | 'mobile'
  app_version: string
}
```

Aggregated on the public dashboard at `walour.xyz/stats`.

---

## 3. Data Flow — Transaction Interception

```
1. User clicks "Sign" in wallet popup
2. Extension intercepts signTransaction call
3. Run in parallel:
   a. checkDomain(currentUrl)       → Redis → Homoglyph check → corpus → GoPlus
   b. checkTokenRisk(tokenMint)     → Redis → Helius + GoPlus
   c. decodeTransaction(tx)         → Redis → Claude Sonnet 4.6 (streaming)
         ↓ if VersionedTransaction
         resolve ALTs first (getAddressLookupTable)
4. Overlay renders as results stream in
5. User decides → emit drain_blocked if "Don't sign"
6. Sign proceeds or aborts
```

---

## 4. Supabase Schema (MVP)

```sql
-- Threat corpus
create table threat_reports (
  address      text primary key,
  type         text,          -- drainer | rug | phishing_domain | malicious_token
  source       text,
  evidence_url text,
  confidence   float,
  first_seen   timestamptz default now(),
  last_updated timestamptz default now()
);
create index on threat_reports (address);

-- Ingestion error log
create table ingestion_errors (
  id         uuid default gen_random_uuid() primary key,
  source     text,
  payload    jsonb,
  created_at timestamptz default now()
);

-- Telemetry
create table drain_blocked_events (
  event_id              text primary key,
  timestamp             bigint,
  wallet_pubkey         text,
  blocked_tx_hash       text,
  drainer_target        text,
  block_reason          text,
  estimated_sol_saved   float,
  estimated_usd_saved   float,
  confirmed             boolean,
  surface               text,
  app_version           text
);

-- Provider outages log
create table outages (
  id         uuid default gen_random_uuid() primary key,
  provider   text,
  opened_at  timestamptz default now(),
  closed_at  timestamptz,
  error_msg  text
);
```

---

## 5. External API Dependencies

| API | Used for | Auth |
|---|---|---|
| Helius RPC | `getProgramAccounts`, `getTokenLargestAccounts`, `getAddressLookupTable` | API key |
| Triton | RPC fallback | API key |
| GoPlus Security | Token malicious check, phishing domain check | API key |
| Anthropic (Claude Sonnet 4.6 / Haiku 4.5) | Transaction decoder, streaming output | API key |
| Scam Sniffer | Phishing domain feed (60k domains via GitHub DB) | None (public) |
| Twitter v2 | Scam keyword scrape | Bearer token |
| Upstash Redis | Caching | REST token |
| Supabase | DB + Edge Functions + PostgREST | Service role key |
| Dialect | Blinks generation | SDK |
| Yellowstone gRPC | On-chain event streaming to oracle | API key |
