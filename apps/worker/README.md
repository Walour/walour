# @walour/worker

Vercel Edge Functions that keep the Walour threat corpus fresh.

Two handlers run on a schedule:

| Handler | Path | Schedule | Purpose |
|---------|------|----------|---------|
| `ingest` | `/api/ingest` | Every 15 minutes | Pull new threat addresses from Chainabuse, Scam Sniffer, and Twitter |
| `purge` | `/api/purge` | Daily at 02:00 UTC | Delete stale low-confidence entries (confidence < 0.2, not updated in 90 days) |

---

## Environment variables

Set these in Vercel project settings (or a local `.env` file for `vercel dev`):

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Your Supabase project URL, e.g. `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Yes | `service_role` key (not the `anon` key — worker needs write access) |
| `TWITTER_BEARER_TOKEN` | No | Twitter API v2 Bearer Token. If absent the Twitter source is silently skipped. |

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

```bash
# Ingest (replace <url> with your deployment URL)
curl -X GET https://<your-deployment>.vercel.app/api/ingest

# Purge
curl -X GET https://<your-deployment>.vercel.app/api/purge
```

Both handlers accept any HTTP method — the cron runner uses GET.

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
| `twitter` | 0.30 | Social signal — lowest trust |

Confidence accumulates on repeated sightings (`+= delta * 0.1`) and is capped at 1.0.

---

## Error handling

- A single bad row never crashes the worker — it is logged to `ingestion_errors` and skipped.
- A source API being down logs a warning and records an entry in `outages`; the rest of the run proceeds normally.
- The entire fetch phase has a 55-second global timeout (Vercel limit is 60s).
