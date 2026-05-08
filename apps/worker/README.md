# @walour/worker

Walour's backend — public scan/decode/simulate/blink endpoints plus scheduled cron handlers that keep the threat corpus fresh.

**Public endpoints** (consumed by the SDK / extension / web demo):

| Path | Method | Purpose |
|---|---|---|
| `/api/scan` | GET | Domain + token risk + drainer detection on a tx |
| `/api/decode` | POST | Stream Claude Haiku explanation of a transaction (SSE) |
| `/api/simulate` | POST | Pre-sign SOL + token balance delta simulation |
| `/api/blink` | GET | Dialect Blinks endpoint — share threats as actionable links |

**Cron handlers** (Vercel scheduler, all Bearer-authenticated via `WALOUR_CRON_SECRET` / `CRON_SECRET`):

| Path | Method | Schedule | Purpose |
|---|---|---|---|
| `/api/ingest` | POST | Every 15 minutes | Pull threats from Chainabuse, Scam Sniffer, Twitter |
| `/api/promote` | GET | Daily | Promote high-confidence Supabase threats to on-chain oracle |
| `/api/purge` | POST | Daily 02:00 UTC | Delete stale low-confidence entries (confidence < 0.2, not updated 90 days) |

Per-IP rate limit on public endpoints (Upstash Redis sliding window): 30/min for `/api/scan`, 10/min for `/api/decode`, `/api/simulate`, `/api/blink`. Body size cap: 64 KB on POST endpoints.

---

## Environment variables

Set in Vercel project settings (or a local `.env` for `npm run dev`):

| Variable | Required | Description |
|---|---|---|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Yes | `service_role` key — worker needs write access |
| `HELIUS_API_KEY` | Yes | Primary Solana RPC for tx decode + ALT resolution |
| `ANTHROPIC_API_KEY` | Yes | Claude Haiku 4.5 streaming tx decoder |
| `UPSTASH_REDIS_REST_URL` | Yes | Cache + rate-limiter backend |
| `UPSTASH_REDIS_REST_TOKEN` | Yes | Cache + rate-limiter backend |
| `WALOUR_CRON_SECRET` | Yes | 32-byte hex secret for cron auth (generate via `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) |
| `CRON_SECRET` | Yes (Vercel) | Same value as `WALOUR_CRON_SECRET` — Vercel auto-injects this on cron invocations |
| `WALOUR_PROGRAM_ID` | Yes | Deployed oracle program ID |
| `WALOUR_ORACLE_CLUSTER` | No | `devnet` (default) or `mainnet` for oracle PDA reads |
| `EXTENSION_ID` | Yes (prod) | Chrome extension ID for CORS allowlist |
| `GOPLUS_API_KEY` | No | Higher rate limits on token + domain checks |
| `JUPITER_API_KEY` | No | Token intel — organic score, isVerified, isSus |
| `TRITON_KEY` | No | RPC fallback (rpcpool.com) |
| `RPC_FAST_API_KEY` | No | Tertiary RPC fallback |
| `TWITTER_BEARER_TOKEN` | No | Twitter source for ingestion (silently skipped if absent) |

---

## Database setup

Apply the migration to your Supabase project once before the first deploy:

```bash
# Using the Supabase CLI
supabase db push --db-url "postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres"

# Or paste supabase/migrations/001_initial.sql directly into the Supabase SQL editor
```

This creates the `threat_reports`, `ingestion_errors`, `drain_blocked_events`, and `outages` tables plus the `upsert_threat` RPC function.

---

## Deploy to Vercel

```bash
# From the repo root or this directory
cd apps/worker

# First deploy (links to Vercel project)
vercel deploy --prod

# Subsequent deploys
npm run deploy
```

Vercel automatically picks up `vercel.json` and registers both cron jobs.

---

## Trigger manually

Cron-class endpoints require a Bearer token matching `WALOUR_CRON_SECRET` (or `CRON_SECRET` — Vercel auto-injects this on its own cron invocations):

```bash
SECRET=$(grep WALOUR_CRON_SECRET .env | cut -d= -f2)

# Ingest
curl -X POST -H "Authorization: Bearer $SECRET" https://<your-deployment>.vercel.app/api/ingest

# Purge
curl -X POST -H "Authorization: Bearer $SECRET" https://<your-deployment>.vercel.app/api/purge

# Promote
curl -X GET -H "Authorization: Bearer $SECRET" https://<your-deployment>.vercel.app/api/promote
```

Without a valid Bearer token, all three return `401`. `/api/purge` rejects non-POST methods with `405`.

Example successful ingest response:

```json
{ "processed": 1482, "errors": 3, "duration_ms": 8741 }
```

---

## Check corpus size in Supabase

Run in the Supabase SQL editor:

```sql
-- Total threats by source
select source, count(*), avg(confidence) as avg_confidence
from threat_reports
group by source
order by count desc;

-- High-confidence threats only
select count(*) from threat_reports where confidence >= 0.7;

-- Recent ingestion errors
select * from ingestion_errors order by created_at desc limit 50;

-- Active outages
select * from outages where closed_at is null;

-- Rows eligible for next purge run
select count(*)
from threat_reports
where confidence < 0.2
  and last_updated < now() - interval '90 days';
```

---

## Source weights

| Source | Confidence delta | Notes |
|--------|-----------------|-------|
| `chainabuse` | 0.90 | Verified community reports |
| `scam_sniffer` | 0.85 | Automated drainer detection |
| `community` | 0.40 | User-submitted (reserved for future use) |
| `twitter` | 0.05 | Social signal — single-source, must be corroborated to clear AMBER |

Confidence accumulates on repeated sightings (`+= delta * 0.1`) and is capped at 1.0.

---

## Error handling

- A single bad row never crashes the worker — it is logged to `ingestion_errors` and skipped.
- A source API being down logs a warning and records an entry in `outages`; the rest of the run proceeds normally.
- The entire fetch phase has a 55-second global timeout (Vercel limit is 60s).

---

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/scan` | GET | Domain + token risk scan. Params: `hostname`, `tx` (optional base64 tx) |
| `/api/decode` | POST | Stream Claude Haiku explanation of a transaction. Body: `{ txBase64: string }` |
| `/api/simulate` | POST | Pre-sign balance delta simulation. Body: `{ txBase64: string }` |
| `/api/ingest` | GET | Cron: ingest threat data from GoPlus + ScamSniffer into Supabase |
| `/api/promote` | GET | Cron: promote high-confidence Supabase threats to on-chain oracle |
| `/api/purge` | GET | Cron: purge stale low-confidence threat entries (runs every 2h) |
| `/api/blink` | GET | Dialect Blink — share a threat report as a shareable action URL |
