# Plan — Phase 0 + Phase 1: Corpus & SDK
**Dates:** Apr 17 – Apr 25
**Deliverable:** F-SDK-00 ingestion worker live + `@walour/sdk` v0.1.0 published to npm

---

## Goals
1. Threat corpus seeded with ≥ 2,000 unique malicious addresses before any user-facing code ships.
2. All three SDK scanning functions (`checkTokenRisk`, `decodeTransaction`, `checkDomain`) working, cached, and circuit-breakered.
3. `@walour/sdk` v0.1.0 published to npm, MIT-licensed, with a README integration example.

---

## Phase 0 — Corpus Ingestion (Apr 17–20)

### P0-01: Project scaffold
- Init monorepo: `packages/sdk`, `apps/extension`, `apps/worker`, `programs/walour_oracle`
- Set up Supabase project, run schema migrations (see `architecture.md §4`)
- Configure Upstash Redis instance
- Add `.env` template: `HELIUS_API_KEY`, `GOPLUS_API_KEY`, `ANTHROPIC_API_KEY`, `UPSTASH_REDIS_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `TWITTER_BEARER_TOKEN`

### P0-02: Supabase schema
Run migrations for:
- `threat_reports` (primary corpus table, indexed on `address`)
- `ingestion_errors`
- `drain_blocked_events`
- `outages`

### P0-03: Ingestion worker — Chainabuse + Scam Sniffer
- Vercel Cron Edge Function (`apps/worker/src/ingest.ts`)
- Fetch Chainabuse CSV; parse rows; base58 validate each address
- Fetch Scam Sniffer X feed; parse entries
- Normalize to `ThreatReport` shape
- Upsert to Supabase with confidence weights (Chainabuse 0.9, Scam Sniffer 0.85)
- Log errors to `ingestion_errors`, never crash on bad row

### P0-04: Ingestion worker — Twitter scrape
- Twitter v2 recent-search: `drainer wallet solana`, `rug pump.fun`, `scam solana address`
- Extract Solana pubkeys via regex, dedup, upsert at confidence 0.3
- Rate-limit aware (Twitter v2 free tier: 500k tweets/month)

### P0-05: Dedup + purge logic
- On upsert conflict: increment confidence by source-weight delta, cap at 1.0, update `last_updated`
- Purge cron (daily): delete where `confidence < 0.2 AND last_updated < now() - interval '90 days'`

### P0-06: Seed verification
- Run worker manually; confirm ≥ 2,000 unique rows in `threat_reports`
- Spot-check 10 addresses against Chainabuse web UI
- Confirm full sync completes in < 60s

**P0 done when:** `SELECT COUNT(*) FROM threat_reports` ≥ 2,000 and worker runs clean on Vercel Cron.

---

## Phase 1 — SDK (Apr 21–25)

### P1-01: SDK scaffold
- `packages/sdk/` — TypeScript, ESM + CJS dual build, `tsup`
- Export barrel: `checkTokenRisk`, `decodeTransaction`, `checkDomain`, `lookupAddress`
- Redis client singleton (Upstash REST SDK)
- Circuit breaker utility (`src/lib/circuit-breaker.ts`): threshold 3/60s, 30s cooldown

### P1-02: F-SDK-03 — Domain check (simplest, build first)
- `lookupAddress(pubkey)` → Redis `address:threat:{pubkey}` (5 min TTL) → Supabase query → GoPlus fallback
- `checkDomain(hostname)` → Redis `domain:risk:{hostname}` (1h TTL) → corpus lookup → GoPlus phishing API
- Return: `{ level: 'GREEN' | 'AMBER' | 'RED', reason: string, confidence: number }`

### P1-03: F-SDK-01 — Token risk scorer
- 8 parallel checks via `Promise.allSettled`:
  1. Mint authority (Helius `getAccountInfo`)
  2. Freeze authority (same)
  3. LP lock (Raydium Lock program `LockrFaYaRmxWaQdxFRNStUWZ8pBudtEoJKxYBQUwcMN`)
  4. Holder concentration (Helius `getTokenLargestAccounts`)
  5. Supply anomaly (recent mint events)
  6. Token age (creation timestamp)
  7. GoPlus token flag
  8. Walour corpus hit (`lookupAddress`)
- Weighted score → RED ≥ 60, AMBER 30–59, GREEN < 30
- Cache: `token:risk:{mint}` 60s TTL
- Circuit breaker wraps Helius calls (fallback: Triton → public RPC)

### P1-04: F-SDK-02 — Transaction decoder
- `decodeTransaction(tx: VersionedTransaction): AsyncGenerator<string>`
- **ALT resolution first:** if `message.addressTableLookups.length > 0`, resolve all via `connection.getAddressLookupTable`, merge with `staticAccountKeys`
- **Red-flag detection** (sync, before calling Claude):
  - `SetAuthority` → always warn immediately
  - `CloseAccount` to unknown recipient
  - Unlimited `Approve` to non-DEX program
  - Transfer to corpus hit
- **Cache lookup:** hash `(programId, ixDiscriminator, accountTypes[])` → Redis `tx:decode:{hash}` 24h TTL → if hit, stream cached string, no LLM call
- **Cache miss:** call Claude Sonnet 4.6 streaming, render tokens as they arrive
- Fallback on circuit open: Claude Haiku 4.5
- Stall detection: if no token in 2s → abort → emit generic warning

### P1-05: Caching layer audit
- Confirm every exported function hits Redis before any network call
- Add integration test: mock Redis hit → assert no Helius/Claude call made

### P1-06: npm publish
- Bump to `0.1.0`, write README with minimal integration example:
  ```ts
  import { checkTokenRisk } from '@walour/sdk'
  const result = await checkTokenRisk('mint_address_here')
  console.log(result.level) // 'GREEN' | 'AMBER' | 'RED'
  ```
- Publish to npm under MIT license

### P1-07: Reference integration test
- Small Node script in `examples/` that scans a known-bad address from the corpus
- Confirms GREEN/AMBER/RED level comes back correctly
- Confirms Redis cache is populated after first call

**P1 done when:** `@walour/sdk@0.1.0` is live on npm, all 3 check functions pass integration tests, p95 latency targets met (token < 800ms, decode first-token < 400ms, domain < 100ms).

---

## Acceptance Criteria Summary

| Check | Pass condition |
|---|---|
| Corpus seed | ≥ 2,000 rows in `threat_reports` |
| Worker runtime | Full sync < 60s |
| `lookupAddress` latency | < 50ms p95 |
| Token scorer latency | < 800ms p95 |
| Decoder first-token | < 400ms on cache miss |
| Domain check latency | < 100ms p95 |
| npm publish | `npm install @walour/sdk` works |
| No bypass | Zero direct RPC calls outside SDK cache wrapper |
