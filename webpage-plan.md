# Walour Website Page Plan

## Stack
- Next.js 14 App Router, TypeScript, pure CSS with existing design tokens
- CSS vars: `--bg #0D1117`, `--accent #00C9A7`, `--danger #EF4444`, `--safe #22C55E`
- Existing globals.css classes: `glass`, `tile`, `container`, `btn`, `table-card`
- Data layer: `apps/web/lib/queries.ts` → Supabase (`threat_reports`, `drain_blocked_events`, `outages`)
- Worker: `apps/worker/src/server.ts` routes `/api/scan`, `/api/decode`, `/api/blink`

---

## Priority 0 — Core (build first)

### `/registry` — upgrade existing
- **Filter rail** (sticky top): type dropdown (all/drainer/rug/phishing/malicious_token), source filter, confidence slider (0–100), date range picker
- **Table**: address/domain (truncated+copy), type badge, confidence bar, source badge, last_updated, clickable rows
- **Detail drawer**: slide-in panel on row click — full address (copyable), all fields, source link if available, "Report as false positive" CTA
- **Source badges**: color-coded (GoPlus=blue, Community=teal, Helius=purple, Internal=muted)
- **Pagination**: 25 per page, total count display
- **Data**: `fetchThreats(page, search, type)` from queries.ts, real-time refresh every 60s
- **URL state**: `?q=`, `?type=`, `?page=` params synced

### `/stats` — upgrade existing
- **4 KPI cards**: Threats Indexed, Signings Blocked, SOL Saved, Avg Confidence
- **Time-series area chart**: threats added per day (last 30 days) — use `first_seen` column
- **Composition donut chart**: breakdown by threat type (drainer/rug/phishing/malicious_token)
- **Source bar chart**: threats by source (GoPlus vs Community vs Helius vs Internal)
- **Confidence histogram**: distribution of confidence scores (0–25, 25–50, 50–75, 75–100)
- **Provider health strip**: Helius, Triton, GoPlus, Claude, Upstash — status from `outages` table (open = degraded, no open = operational)
- **Top 10 threats table**: existing TopThreatsTable component
- **Data**: all from Supabase, server-side rendered + client refresh

### `/lookup` — new
- **Hero input**: large monospace text field + submit button, auto-submits if `?q=` param present
- **Verdict card states**:
  - SAFE (green border): "No threats found. This address has no known reports."
  - WARN (amber): address found, confidence < 0.7 — show type, confidence bar, report date
  - DANGER (red): confidence >= 0.7 — large warning, threat type badge, "Do not interact" CTA
  - NOT FOUND: clean not-found state with "Report a threat" link
- **SDK snippet**: shows how to call `walour.check(address)` — same codebox component
- **Recent lookups**: localStorage-persisted list of last 5 addresses
- **Data**: server action hitting `threat_reports` by address match

### `/decode` — new
- **Input**: base64 textarea for serialized transaction, "Decode" button
- **Streaming output**: Claude Sonnet 4.6 streams analysis token by token
- **First-token timer**: shows "First token: Xms" after response starts
- **Risk flags**: structured risk items extracted from stream (HIGH/MEDIUM/LOW tags)
- **ALT resolution note**: "Address lookup tables resolved" indicator
- **Worker route**: POST to `WORKER_URL/api/decode` (stream relay)
- **Empty state**: placeholder with example transaction hint

---

## Priority 1 — Trust

### `/report` — new
- **Form fields**: address/domain, threat type selector, evidence URL (optional), notes (optional)
- **Privacy notice**: "Reports are submitted via submitPrivateReportCloak — your IP is not logged"
- **Honeypot field**: hidden field to catch bots
- **Confirmation screen**: "Report submitted. Confidence will increase as it is corroborated."
- **Submission**: calls `upsert_threat()` RPC via Supabase client (confidence=0.5 for new community reports)
- **Rate limit**: client-side 1 submit per 60s

### `/docs` — new
- **Sticky sidebar nav**: sections jump-linked (Install, Quick Start, API Reference, Caching, Circuit Breakers)
- **SDK API Reference** (7 exports):
  1. `new Walour(config)` — constructor, config options table
  2. `walour.check(address)` — returns `ThreatResult { risk, confidence, type, source }`
  3. `walour.scan(transaction)` — full transaction scan, returns array of flags
  4. `walour.decode(serializedTx)` — streaming Claude decoder, AsyncIterable<string>
  5. `walour.report(entry)` — submit threat report via cloak
  6. `walour.getStats()` — aggregate stats
  7. `walour.subscribe(address, cb)` — real-time threat subscription
- **Caching docs**: Upstash Redis TTL behavior, cache invalidation
- **Circuit breaker docs**: threshold (3 failures/60s), fallback chain (Helius → Triton → Public RPC)
- **Code examples**: inline codeboxes with copy buttons

### `/status` — new
- **Provider health grid**: 6 cards (Helius, Triton/Public RPC, GoPlus, Claude Sonnet, Claude Haiku, Upstash Redis)
  - Each card: provider name, current status dot (green=operational, amber=degraded, red=down), uptime % last 30d
  - Status derived from `outages` table — open record = degraded, no open record = operational
- **Recent incidents list**: last 10 closed outage records from `outages` table — provider, duration, error_msg
- **Overall status banner**: "All systems operational" (green) or "X providers degraded" (amber/red)
- **Auto-refresh**: every 30s

---

## Priority 2 — Growth

### `/pricing` — new
- **3 tiers**:
  - **Free**: Extension + SDK, 1k lookups/mo, community reports, public registry
  - **Pro** ($29/mo): 100k lookups/mo, priority RPC, webhook alerts, SDK analytics
  - **Enterprise**: custom volume, dedicated RPC, SLA, on-chain registry write access
- **Toggle**: monthly/annual (20% discount on annual)
- **FAQ**: 6–8 questions (free tier limits, data privacy, SOL chain costs, SLA, cancellation)
- **CTA**: "Start free" buttons, enterprise contact form link

### `/about` — new
- **Mission statement**: "Walour is shared security infrastructure for Solana. Every protocol benefits when every threat is indexed."
- **Team section**: Sahir (@Sahir__S) card — founder/builder
- **Colosseum context**: building for Frontier hackathon, May 2026
- **Responsible disclosure**: email (sikandersahir@gmail.com), PGP key placeholder, 90-day disclosure timeline
- **Open source note**: SDK and oracle are open source, extension is source-available

### `/press` — new
- **Brand assets**: download links for all SVGs in `brand/` folder (logo-full, logo-64, logo-32, logo-16, logo-filled, logo-light)
- **Usage guidelines**: do/don't with logo (color, spacing, don't modify)
- **Boilerplate**: 1-sentence, 1-paragraph, 3-paragraph versions (copy button on each)
- **Fact sheet**: key stats (threats indexed, drains blocked, SOL saved — live from Supabase)
- **Contact**: press@walour.xyz placeholder

---

## Execution Waves

### Wave 1 (parallel)
- `/registry` upgrade
- `/stats` upgrade

### Wave 2 (parallel)
- `/lookup` new
- `/decode` new

### Wave 3 (parallel)
- `/report` new
- `/docs` new
- `/status` new

### Wave 4 (parallel)
- `/pricing` new
- `/about` new
- `/press` new
