# Walour — Dev Notes

Owner: Sahir (@Sahir__S) · sikandersahir@gmail.com  
Deadline: Colosseum Frontier May 11 2026  
Repo: https://github.com/Walour/Walour

---

## Current Status

| Phase | What | Status |
|---|---|---|
| Phase 1 | SDK + corpus ingestion worker | ✅ Code complete |
| Phase 2 | Chrome extension | ✅ Builds + loads in Chrome |
| Phase 3 | Anchor oracle + stats dashboard + Blinks | ✅ Code complete — needs deploy |

---

## What Needs To Happen Before Testing

### 1. Credentials (owner only)

Create `apps/extension/.env`:
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_API_BASE=https://walour-worker.vercel.app
```

Create `apps/worker/.env`:
```
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
HELIUS_API_KEY=
ANTHROPIC_API_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
TWITTER_BEARER_TOKEN=
WALOUR_PROGRAM_ID=          # fill after anchor deploy
PROGRAM_AUTHORITY_KEYPAIR=  # JSON array of deploy keypair bytes
```

Create `apps/web/.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

---

## Next Steps: Testing Checklist

### Step 1 — Supabase setup
- [ ] Run migration: `apps/worker/supabase/migrations/001_initial.sql`
- [ ] Run migration: `apps/worker/supabase/migrations/002_promote.sql`
- [ ] Verify tables exist: `threat_reports`, `drain_blocked_events`, `outages`, `ingestion_errors`
- [ ] Set `SUPABASE_URL` and keys in all `.env` files above

### Step 2 — Deploy worker to Vercel
```bash
cd apps/worker
vercel deploy --prod
```
- [ ] Confirm `https://walour-worker.vercel.app/api/scan?hostname=google.com` returns `{ domain, token }`
- [ ] Confirm `POST https://walour-worker.vercel.app/api/decode` streams SSE chunks
- [ ] Trigger ingest manually: `GET /api/ingest` — confirm rows appear in `threat_reports`

### Step 3 — Anchor program (devnet first)
```bash
# Install toolchain if not done
cargo install --git https://github.com/coral-xyz/anchor avm --force
avm install 0.30.1 && avm use 0.30.1

# Build — this generates the real program ID
cd D:/Walour/walour
anchor build

# Get program ID
solana address -k target/deploy/walour_oracle-keypair.json
```
- [ ] Copy program ID into `Anchor.toml` (replace `11111111111111111111111111111111`)
- [ ] Copy program ID into `programs/walour_oracle/src/lib.rs` `declare_id!(...)`
- [ ] Copy program ID into worker `.env` as `WALOUR_PROGRAM_ID`
- [ ] Deploy to devnet:
```bash
solana config set --url devnet
solana airdrop 2 <deploy-wallet-pubkey>
anchor deploy
```
- [ ] Run tests: `anchor test`
- [ ] All 6 tests pass → deploy to mainnet:
```bash
solana config set --url mainnet-beta
anchor deploy --provider.cluster mainnet
```
- [ ] Verify on Solana Explorer: `https://explorer.solana.com/address/<PROGRAM_ID>`

### Step 4 — Extension end-to-end test
- [ ] Rebuild extension with real API base: `cd apps/extension && npm run build`
- [ ] Load `dist/` in Chrome (`chrome://extensions` → Load unpacked)
- [ ] Visit a known phishing site (use test address from corpus)
- [ ] Connect Phantom wallet on a test dApp
- [ ] Trigger a `signTransaction` → overlay appears with 3 rows
- [ ] URL row resolves GREEN/AMBER/RED
- [ ] Token row resolves
- [ ] Transaction row streams Claude text
- [ ] Click "Don't sign" → confirm `drain_blocked_events` row in Supabase
- [ ] Click "Sign anyway" → confirm transaction proceeds normally

### Step 5 — Stats dashboard
- [ ] `cd apps/web && npm run dev` → `localhost:3000/stats`
- [ ] After "Don't sign" test above, refresh — drain count should increment
- [ ] Deploy to Vercel: `cd apps/web && vercel deploy --prod`
- [ ] Confirm `walour.xyz/stats` (or Vercel URL) is publicly accessible

### Step 6 — Blinks
- [ ] Hit `GET /api/blink?address=<known-bad-address>` → confirm RED description
- [ ] Hit `GET /api/blink?address=<clean-address>` → confirm GREEN description
- [ ] Paste Blink URL into a tweet draft → confirm interactive card renders

### Step 7 — Corpus check
```sql
SELECT COUNT(*) FROM threat_reports;
```
- [ ] Must be ≥ 3,500 before Colosseum submit
- [ ] If under: run historical Chainabuse backfill manually

---

## Running Locally

```bash
# Install all deps
npm install

# Extension (builds to dist/)
cd apps/extension && npm run build

# Stats dashboard
cd apps/web && npm run dev        # localhost:3000/stats

# Worker (local dev)
cd apps/worker && vercel dev      # localhost:3000
```

---

## Architecture

See `docs/architecture.md` for the full system diagram.

Short version:
```
Browser page
  └─ content.js (MAIN world) hooks Phantom/Solflare/Backpack
       └─ background.js calls:
            ├─ /api/scan  → SDK: checkDomain + checkTokenRisk
            └─ /api/decode → SDK: decodeTransaction (Claude Sonnet 4.6 stream)
                                  ↓
                           Supabase threat_reports
                           On-chain walour_oracle PDAs
```

