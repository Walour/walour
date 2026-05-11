# @walour/worker

Walour's backend, public scan/decode/simulate/blink endpoints plus scheduled cron handlers that keep the threat corpus fresh.

**Public endpoints** (consumed by the SDK / extension / web demo):

| Path | Method | Purpose |
|---|---|---|
| `/api/scan` | GET | Domain + token risk + drainer detection on a tx |
| `/api/decode` | POST | Stream Claude Haiku explanation of a transaction (SSE) |
| `/api/simulate` | POST | Pre-sign SOL + token balance delta simulation |
| `/api/blink` | GET | Dialect Blinks endpoint, share threats as actionable links |

**Cron handlers** (Vercel scheduler, all Bearer-authenticated via `WALOUR_CRON_SECRET` / `CRON_SECRET`):

| Path | Method | Schedule | Purpose |
|---|---|---|---|
| `/api/ingest` | POST | Daily 00:00 UTC | Pull threats from Scam Sniffer + GoPlus into Supabase |
| `/api/purge` | POST | Daily 02:00 UTC | Delete stale low-confidence entries |
| `/api/promote` | GET | Daily 03:00 UTC | Promote high-confidence Supabase threats to on-chain oracle |

Per-IP rate limit on public endpoints (Upstash Redis sliding window): 30/min for `/api/scan`, 10/min for `/api/decode`, `/api/simulate`, `/api/blink`. Body size cap: 64 KB on POST endpoints.

---

## Environment variables

Set in Vercel project settings (or a local `.env` for `npm run dev`):

| Variable | Required | Description |
|---|---|---|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Yes | `service_role` key, worker needs write access |
| `HELIUS_API_KEY` | Yes | Primary Solana RPC for tx decode + ALT resolution |
| `ANTHROPIC_API_KEY` | Yes | Claude Haiku 4.5 streaming tx decoder |
| `UPSTASH_REDIS_REST_URL` | Yes | Cache + rate-limiter backend |
| `UPSTASH_REDIS_REST_TOKEN` | Yes | Cache + rate-limiter backend |
| `WALOUR_CRON_SECRET` | Yes | 32-byte hex secret for cron auth (see Vercel cron auth setup below) |
| `CRON_SECRET` | Yes (Vercel) | Same value as `WALOUR_CRON_SECRET`, Vercel auto-injects this on cron invocations |
| `WALOUR_PROGRAM_ID` | No | Deployed oracle program ID. SDK falls back to the canonical devnet program if unset. |
| `WALOUR_ORACLE_CLUSTER` | No | `devnet` (default) or `mainnet` for oracle PDA reads |
| `GOPLUS_API_KEY` | No | Higher rate limits on token + domain checks |
| `JUPITER_API_KEY` | No | Token intel, organic score, isVerified, isSus |
| `TRITON_KEY` | No | RPC fallback (rpcpool.com) |
| `RPC_FAST_API_KEY` | No | Tertiary RPC fallback |

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

Vercel automatically picks up `vercel.json` and registers the cron jobs.

---

## Error handling

- A single bad row never crashes the worker, it is logged to `ingestion_errors` and skipped.
- A source API being down logs a warning and records an entry in `outages`; the rest of the run proceeds normally.
- The entire fetch phase has a 55-second global timeout (Vercel limit is 60s).

---

## Vercel cron auth setup

Vercel cron does not support custom Authorization headers in `vercel.json`. Instead Vercel auto-injects the value of the `CRON_SECRET` env var as `Authorization: Bearer <CRON_SECRET>` on every scheduled invocation. Before deploying:

1. In `apps/worker/.env` set `WALOUR_CRON_SECRET` to a 32-byte hex string (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
2. In Vercel project env, set BOTH `WALOUR_CRON_SECRET` AND `CRON_SECRET` to the same value.

Without step 2, `/api/purge`, `/api/promote`, and `/api/ingest` will 401 immediately on every cron tick. `lib/cron-auth.ts` accepts either env name as a fallback so local development with only `WALOUR_CRON_SECRET` works without a separate `CRON_SECRET`.
