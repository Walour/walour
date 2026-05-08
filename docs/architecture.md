# Walour: System Architecture

**Version:** v5 · **Date:** 2026-05-08

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
(Helius    Haiku 4.5)                    Corpus +
+ GoPlus)                                 GoPlus)
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
- Chainabuse: 0.90
- Scam Sniffer: 0.85
- GoPlus: 0.80
- Community report: 0.40 (until corroborated)
- Twitter scrape: 0.05 (single-source signals, must be corroborated to clear AMBER)

Confidence accumulates on repeated sightings (`+= delta * 0.1`) and is capped at 1.0.

---

### 2.4 Walour Oracle (Anchor Program)

On Solana devnet. Program ID: `A2pxWB5ro7h1vh4yc7kQeQ4eydV1iA3Fgy9kQ9zhaZVQ`.

**PDAs:**
```
OracleConfig PDA
  seed: ["config"]
  fields: authority, bump

Treasury PDA
  seed: ["treasury"]
  purpose: collects 0.01 SOL anti-spam stake on every community submit_report

ThreatReport PDA (community submits)
  seed: ["threat", address, first_reporter]    ← namespaced by reporter
  fields: version, address, threat_type, source, evidence_url, confidence,
          first_seen, last_updated, corroborations, first_reporter, bump

ThreatReport PDA (authority fast-track)
  seed: ["threat", address]                     ← legacy seed, authority only
  same field layout
```

**Instructions:**
- `initialize()`, one-time bootstrap, creates OracleConfig + Treasury
- `submit_report(address, threat_type, evidence_url)`, permissionless community submit. Charges 0.01 SOL into Treasury. Namespaced PDA per reporter, first-writer squat impossible.
- `authority_submit_report(...)`, authority-cosigned fast-track. Uses legacy seed for canonical entries. `has_one = authority` constraint on OracleConfig.
- `corroborate_report(address, first_reporter)`, permissionless. Rejects if `signer == report.first_reporter`. Confidence: `40 + (corroborations × 5)`, capped at 100.
- `update_confidence(address, new_score)`, `has_one = authority` declarative check.
- `transfer_authority(new_authority)`, governance handoff.

**Forward compatibility:** every account carries a `version: u8` byte. `ThreatType` is `#[non_exhaustive]`. SDK fails-loud on unknown versions instead of silently misinterpreting bytes.

**Sybil resistance:** namespaced report PDAs + 0.01 SOL Treasury stake + self-corroboration block (via stored `first_reporter`) make cheap-keypair attacks economically painful. 7 Mocha tests cover the attack scenarios.

Ingestion worker promotes high-confidence Supabase entries to devnet PDAs via `authority_submit_report` on each sync cycle.

---

### 2.5 Caching Layer (Upstash Redis)

| Key | TTL | Notes |
|---|---|---|
| `token:risk:{mint}` | 60s | Short TTL, token state changes fast |
| `tx:decode:{programId}:{ixDiscriminator}` | 24h | Instruction shapes are stable |
| `address:threat:{pubkey}` | 5 min | Corpus updates every 15 min |
| `domain:risk:{hostname}` | 1h | Domain reputations are slow-moving |

---

### 2.6 Circuit Breakers

All external dependencies wrap in a circuit breaker:

| Dependency | Primary | Fallback | Last Resort |
|---|---|---|---|
| RPC | Helius | Triton | Solana public RPC |
| LLM | Claude Haiku 4.5 |, | Cached generic warning |
| Threat intel | Walour corpus | GoPlus Security API |, |

Threshold: 3 failures / 60s → circuit opens → 30s cooldown → half-open retry.

---

### 2.7 Telemetry

Every prevented signing event emits `DrainBlockedEvent` to Supabase:

```ts
DrainBlockedEvent {
  event_id: string                  // uuid v4, CHECK constraint enforces format
  timestamp: number                 // unix ms
  wallet_pubkey: string | null      // base58 32-44 chars, CHECK constraint; null when extension can't read pubkey
  blocked_tx_hash: string | null    // base58 64-88 chars, CHECK constraint; null when not yet known
  drainer_target?: string
  block_reason: 'phishing_domain' | 'malicious_token' | 'known_drainer' | 'ai_flagged_transfer' | 'setauthority_detected' | 'user_blocked' | 'auto_blocked'
  estimated_sol_saved: number
  estimated_usd_saved: number
  confirmed: boolean                // post-hoc sim: > 0.01 SOL would have drained
  surface: 'extension' | 'mobile'
  app_version: string
}
```

The Supabase `drain_blocked_events` table has 4 CHECK constraints applied (event_id UUID format, wallet_pubkey base58 32-44 OR null, blocked_tx_hash base58 64-88 OR null, block_reason length ≤ 64) and a single permissive `allow_anon_insert_constrained` policy that lets the extension write but not read.

Aggregated on the public dashboard at `walour.io/stats`.

---

## 3. Data Flow, Transaction Interception

```
1. User clicks "Sign" in wallet popup
2. Extension intercepts signTransaction call
3. Run in parallel:
   a. checkDomain(currentUrl)       → Redis → Homoglyph check → corpus → GoPlus
   b. checkTokenRisk(tokenMint)     → Redis → Helius + GoPlus
   c. decodeTransaction(tx)         → Redis → Claude Haiku 4.5 (streaming)
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
| Anthropic (Claude Haiku 4.5 / Haiku 4.5) | Transaction decoder, streaming output | API key |
| Scam Sniffer | Phishing domain feed (60k domains via GitHub DB) | None (public) |
| Twitter v2 | Scam keyword scrape | Bearer token |
| Upstash Redis | Caching | REST token |
| Supabase | DB + Edge Functions + PostgREST | Service role key |
| Dialect | Blinks generation | SDK |
| Yellowstone gRPC | On-chain event streaming to oracle | API key |
