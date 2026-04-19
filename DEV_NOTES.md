# Walour — Dev Notes

Owner: Sahir (@Sahir__S) · sikandersahir@gmail.com  
Deadline: Colosseum Frontier May 11 2026  
Repo: https://github.com/Walour/Walour

---

## Current Status

| Phase | What | Status |
|---|---|---|
| Phase 1 | SDK + corpus ingestion worker | ✅ Complete |
| Phase 2 | Chrome extension | ✅ Overlay working end-to-end |
| Phase 3 | Anchor oracle + stats dashboard + Blinks | ✅ Oracle deployed to devnet |

---

## What Has Been Done (Apr 19 2026 session)

### Credentials
All `.env` files are written with real credentials (gitignored):
- `apps/worker/.env` — Supabase, Helius, Anthropic, Upstash, program ID
- `apps/web/.env.local` — Supabase public keys
- `apps/extension/.env` — Supabase, API base (currently `http://localhost:3000`)

### Supabase
- Migrations `001_initial.sql` and `002_promote.sql` run on project `aatsscxoaqefahgnwaup`
- Tables confirmed: `threat_reports`, `drain_blocked_events`, `ingestion_errors`, `outages`
- Test data seeded manually:
  ```sql
  INSERT INTO threat_reports (address, type, source, confidence, evidence_url) VALUES
  ('test-phishing-walour.xyz', 'phishing_domain', 'chainabuse', 0.9, null)
  ON CONFLICT (address) DO NOTHING;
  ```

### Anchor Oracle
- Deployed to **devnet** at program ID: `42xCNeFF1HhTDrLfvJu8ieMxuSfEHQDisK8Fe1hJ4QHL`
- Deploy wallet keypair: `target/deploy/walour-deploy-keypair.json` (DO NOT COMMIT)
- 5/6 anchor tests pass on devnet (test 5 fails due to devnet airdrop rate limit — not a code bug)
- `Cargo.toml` workspace added at root with `overflow-checks = true`
- Anchor upgraded to 0.32.0 (0.30.1 had rustc incompatibility with Agave stable)

### Local Worker (`apps/worker`)
- Runs locally via: `npx tsx server.ts` (port 3000)
- `vercel dev` does NOT work on Windows due to recursive invocation bug — use `server.ts` instead
- `/api/scan` confirmed working: returns GREEN for google.com, RED for seeded phishing domains
- Ingest (`/api/ingest`) — external APIs (Chainabuse, ScamSniffer) have changed endpoints, returns 0 entries. Needs fix (see below).
- Redis env var mismatch fixed: cache now reads `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`

### Chrome Extension
- Loads in Chrome from `apps/extension/dist`
- **Overlay confirmed working** — shows on `signTransaction` intercept with 3 rows (URL, Token, Transaction)
- Fixed: MV3 MAIN world scripts have no chrome API access — added `bridge.ts` (ISOLATED world) to relay `window.postMessage` ↔ `chrome.runtime`
- Fixed: Phantom re-injects after `document_start` and overwrites the hook — now checks function marker `__walour_intercepted` on each poll
- Fixed: Vite `define` block now uses `loadEnv` to correctly inject `.env` values at build time
- Extension `.env` `VITE_API_BASE` must be `http://localhost:3000` for local testing

---

## What Still Needs Testing / Fixing

### 1. `drain_blocked_events` telemetry not recording
When user clicks "Don't sign", the row should appear in Supabase `drain_blocked_events` but doesn't.  
The `TELEMETRY` message is sent from `content.ts` → `bridge.ts` → background via `chrome.runtime.sendMessage`.  
Background handles it in `k()` function which POSTs to Supabase `/rest/v1/drain_events`.  
**Likely bug**: the endpoint is `/rest/v1/drain_events` but the table is `drain_blocked_events`. Check `background.ts` line with `drain_events`.

### 2. Ingest APIs broken
Both Chainabuse and ScamSniffer public endpoints return 404/non-JSON.  
Alternatives to investigate:
- Chainabuse: try their GraphQL at `https://api.chainabuse.com/graphql` with proper query
- ScamSniffer: check their current GitHub repo for updated blacklist URL
- Fallback: manually seed corpus from any public Solana scam list (≥3,500 rows needed before submit)

### 3. Claude streaming in Transaction row
Transaction row shows loading but no text streams through.  
The `/api/decode` endpoint streams SSE. Background script reads the stream and sends `STREAM_CHUNK` messages.  
Test directly: `POST http://localhost:3000/api/decode` with `{"txBase64": "<base64>"}` and confirm SSE chunks come back.

### 4. Extension needs rebuild before mainnet deploy
When deploying worker to Vercel for production, update `apps/extension/.env`:
```
VITE_API_BASE=https://walour-worker.vercel.app
```
Then `npm run build` and reload.

### 5. Stats dashboard not tested
`cd apps/web && npm run dev` → `localhost:3000/stats`  
Should show drain count, threat count from Supabase.

### 6. Blinks not tested
`GET http://localhost:3000/api/blink?address=<address>` — confirm response shape.

### 7. Mainnet Anchor deploy
Once devnet tests pass fully, deploy to mainnet:
```bash
solana config set --url mainnet-beta
anchor deploy --provider.cluster mainnet
```
Update `WALOUR_PROGRAM_ID` in worker `.env` and rebuild worker.

### 8. Corpus count
```sql
SELECT COUNT(*) FROM threat_reports;
```
Must be ≥ 3,500 before Colosseum submit.

---

## Running Locally

### Prerequisites
- Node 18+
- Rust + Cargo (`winget install Rustlang.Rust.MSVC`)
- Solana CLI (download from `https://release.anza.xyz/stable/solana-install-init-x86_64-pc-windows-msvc.exe`, **run as Administrator**)
- Anchor via AVM: `cargo install --git https://github.com/coral-xyz/anchor avm --force` then `avm install 0.32.0 && avm use 0.32.0`
- On Windows: add to PATH each session:
  ```powershell
  $env:PATH += ";$env:USERPROFILE\.local\share\solana\install\active_release\bin"
  $env:PATH += ";$env:USERPROFILE\.cargo\bin"
  $env:PATH += ";$env:USERPROFILE\.avm\tmp\bin"
  ```

### Worker (local)
```bash
cd apps/worker
npx tsx server.ts   # runs on http://localhost:3000
```

### Extension
```bash
cd apps/extension
npm run build       # outputs to dist/
# Load dist/ in chrome://extensions → Load unpacked
# After loading fresh, storage is auto-set to localhost:3000
```

### Stats dashboard
```bash
cd apps/web
npm run dev         # localhost:3000/stats
```

### Anchor tests
```powershell
$env:ANCHOR_PROVIDER_URL = "https://api.devnet.solana.com"
$env:ANCHOR_WALLET = "$env:USERPROFILE\.config\solana\walour-deploy.json"
npx ts-mocha -p ./tsconfig.json -t 1000000 "tests/**/*.ts"
```

---

## Architecture

```
Browser page
  └─ content.js (MAIN world) hooks Phantom/Solflare/Backpack
       └─ window.postMessage → bridge.js (ISOLATED world)
            └─ chrome.runtime.connect → background.js
                 ├─ /api/scan  → SDK: checkDomain + checkTokenRisk
                 └─ /api/decode → SDK: decodeTransaction (Claude Sonnet 4.6 stream)
                                       ↓
                                Supabase threat_reports
                                On-chain walour_oracle PDAs
```

---

## Key Credentials Location
All in gitignored `.env` files — ask Sahir for values.
- Supabase project: `aatsscxoaqefahgnwaup`
- Upstash Redis: `optimum-jawfish-76251`
- Helius API key: in `apps/worker/.env`
- Anchor program: `42xCNeFF1HhTDrLfvJu8ieMxuSfEHQDisK8Fe1hJ4QHL` (devnet)
