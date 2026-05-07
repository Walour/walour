# Walour: Solana Security Oracle

> Real-time scam protection for Solana. Intercepts wallet-draining transactions before you sign, explains them in plain English, and publishes threat intelligence to an on-chain oracle any dApp can query.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Solana](https://img.shields.io/badge/Solana-devnet-9945FF)](https://solana.com)
[![Colosseum Frontier 2026](https://img.shields.io/badge/Colosseum-Frontier%202026-FF6B35)](https://arena.colosseum.org)

**Website:** [walour.io](https://www.walour.io) · **Worker API:** [walour.vercel.app](https://walour.vercel.app)

---

## Colosseum Frontier 2026

Walour was built for and submitted to [Colosseum Frontier 2026](https://arena.colosseum.org).

| Track | Sponsor | Integration |
|---|---|---|
| Jupiter Developer Platform | Jupiter | Jupiter Tokens v2 + Price v3 as a dedicated security intelligence layer in the SDK |
| Security Audit Credits | Adevar Labs | Security oracle with documented threat model: PDA collision, confidence manipulation, prompt injection |
| RPC Infrastructure Credits | RPC Fast | Third tier in the SDK RPC fallback chain (Helius -> Triton -> RPC Fast -> public) |

---

## The problem

Solana wallet drainers stole **$330M+** in 2024. Every attack follows the same pattern: get the user to sign a transaction they don't understand. Current defenses are either:

- **Too late:** hardware wallets show raw hex after the user clicked "sign"
- **Too narrow:** blocklists miss new drainers within hours of deployment
- **Not composable:** each wallet re-implements its own ad-hoc checks

Walour sits between the dApp and the wallet, decodes the transaction in real time, and shares its findings with the entire ecosystem.

---

## How it works

```
dApp triggers signTransaction()
         │
         ▼
  [Walour content script intercepts]
         │
         ├─ checkDomain()       → corpus + GoPlus + homoglyph + RDAP age check
         ├─ checkTokenRisk()    → mint authority, freeze, Token-2022, GoPlus, Jupiter intel
         ├─ /api/simulate       → exact SOL + token balance deltas before signing
         └─ decodeTransaction() → Claude Haiku streams plain-English explanation
                 │
                 ▼
         Overlay appears in < 400ms
         GREEN / AMBER / RED verdict
         "Don't sign" → drain_blocked telemetry emitted → Supabase
```

Any dApp can query the oracle directly via the SDK:

```ts
import { checkDomain, checkTokenRisk } from '@walour/sdk'

const risk = await checkDomain('phantom-wallet.xyz')
// { level: 'RED', reason: 'Hostname contains "phantom" but is not a canonical phantom domain, and uses high-risk TLD .xyz.', confidence: 0.95 }
```

---

## Detection coverage

| Attack vector | Detection method | Status |
|---|---|---|
| Phishing / lookalike domains | Corpus + GoPlus + homoglyph (Punycode/Unicode) | ✅ |
| Newly registered domain (< 14 days) | RDAP domain age check | ✅ |
| Token honeypot — mint authority not revoked | On-chain mint info | ✅ |
| Token honeypot — Token-2022 ConfidentialTransfer | Extension field check | ✅ |
| Token honeypot — transfer fee > 5% | transferFeeBasisPoints check | ✅ |
| SetAuthority drain (token ownership transfer) | Discriminator `06` | ✅ |
| CloseAccount drain | Discriminator `09` | ✅ |
| Unlimited Approve to non-DEX | Discriminator `04` | ✅ |
| PermanentDelegate (Token-2022) | Discriminator `1c` | ✅ |
| System Program Assign (wallet hijack) | Discriminator `01000000` | ✅ |
| Durable nonce (non-expiring tx) | Discriminator `04000000` | ✅ |
| Multi-instruction drain (> 2 assets) | Post-loop aggregate + DEX suppression | ✅ |
| Address Lookup Table drainers | ALT resolution before decode | ✅ |
| Balance delta simulation | `/api/simulate` pre-sign preview | ✅ |
| Low organic score / wash-traded token | Jupiter `organicScoreLabel` | ✅ |
| Suspicious audit flag + dev concentration | Jupiter `audit.isSus` + `devBalancePercentage` | ✅ |

---

## Jupiter integration

Walour uses **Jupiter Tokens v2** and **Price v3** as a dedicated security intelligence layer. Both API calls run in parallel with existing checks inside a `Promise.allSettled` with a 2.5s timeout each. If Jupiter is unreachable, the rest of the engine continues unaffected.

| Field | Source | Weight | Usage |
|---|---|---|---|
| `organicScoreLabel` | Tokens v2 | 15 | `low` = RED flag; `high` = positive pass; numeric fallback when label absent |
| `audit.isSus` | Tokens v2 | 20 | Only present in response when flagged — `true` fires; absence is not treated as safe |
| `isVerified` | Tokens v2 | 5 | Only penalises when another flag is already present — avoids punishing new legitimate tokens |
| `devBalancePercentage` | Tokens v2 | 10 | > 20% deployer concentration = AMBER flag |
| Price presence | Price v3 | 10 | Token absent from price feed AND older than 7 days = AMBER; new tokens are excluded |

Maximum Jupiter contribution: 60/100 points. Walour's RED threshold is 60, so Jupiter signals alone can push a suspicious token to RED.

**DX report:** [`docs/JUPITER_DX_REPORT.md`](docs/JUPITER_DX_REPORT.md)

---

## Repo structure

```
apps/
  worker/        — Backend API (Vercel Edge Functions)
                   /api/scan      → domain + token risk check
                   /api/decode    → Claude Haiku streaming decoder
                   /api/simulate  → pre-sign SOL + token balance delta simulation
  extension/     — Chrome extension (Manifest V3, TypeScript + Vite)
  web/           — Marketing site + stats dashboard (Next.js)
packages/
  sdk/           — @walour/sdk — checkDomain, checkTokenRisk, decodeTransaction
  tokens/        — Shared CSS design tokens
programs/
  walour_oracle/ — Anchor program (on-chain threat registry)
docs/
  architecture.md        — Full system architecture
  JUPITER_DX_REPORT.md   — Jupiter Developer Platform integration report
```

---

## On-chain oracle

Program ID: `42xCNeFF1HhTDrLfvJu8ieMxuSfEHQDisK8Fe1hJ4QHL` · [View on Solana Explorer](https://explorer.solana.com/address/42xCNeFF1HhTDrLfvJu8ieMxuSfEHQDisK8Fe1hJ4QHL?cluster=devnet)

The oracle is the durable shared layer. Community reports flow in permissionlessly. Confidence accumulates from unique corroborations. An authority multisig can override. Everything is anchored to a PDA — no centralised database required to verify a threat.

```
submit_report(address, threat_type, evidence_url)
  → ThreatReport PDA  [seeds: b"threat" + address]
  → Confidence: 40 (community weight)

corroborate_report(address)
  → Corroboration PDA  [seeds: b"corroboration" + address + signer]
  → init fails if signer already corroborated — sybil guard enforced on-chain
  → Confidence: 40 + (corroborations × 5), capped at 100

update_confidence(address, score)
  → Authority-gated via OracleConfig PDA
  → Final override for verified threats
```

**Security properties:** Signer checks via `Signer<'info>` · PDA validation with stored bump on every account · `init` constraint prevents reinitialization · Anchor 8-byte discriminators prevent type cosplay · One-per-signer corroboration PDA closes the sybil vector entirely.

---

## Running locally

### Prerequisites

- Node 18+, npm 9+
- Anthropic, Helius, Supabase, Upstash API keys

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp apps/worker/.env.example apps/worker/.env
```

<details>
<summary>Environment variables reference</summary>

```
ANTHROPIC_API_KEY=          # Claude Haiku (tx decoder streaming)
HELIUS_API_KEY=             # Primary Solana RPC — free tier at helius.dev
TRITON_KEY=                 # Secondary RPC fallback — rpcpool.com (optional)
RPC_FAST_API_KEY=           # Tertiary RPC fallback — portal.rpcfast.io (optional)
SUPABASE_URL=               # Supabase project URL
SUPABASE_SERVICE_KEY=       # service_role key (worker needs write access)
UPSTASH_REDIS_URL=          # Upstash Redis REST URL
UPSTASH_REDIS_TOKEN=        # Upstash Redis REST token
GOPLUS_API_KEY=             # GoPlus Security — token + domain threat intel (optional, free tier)
JUPITER_API_KEY=            # Jupiter API key — organic score + audit.isSus checks
                            # Free tier (60 RPM) at portal.jup.ag
                            # If absent, Jupiter checks are silently skipped
WALOUR_PROGRAM_ID=          # Deployed oracle program ID (see programs/walour_oracle)
EXTENSION_ID=               # Your Chrome extension ID from chrome://extensions
TWITTER_BEARER_TOKEN=       # Optional — scam keyword scrape for corpus ingestion
```

</details>

### 3. Start the worker

```bash
cd apps/worker
npx tsx server.ts
# → http://localhost:3001
```

Smoke test:
```bash
curl "http://localhost:3001/api/scan?hostname=phantom-wallet.xyz"
# { "domain": { "level": "RED", "reason": "Hostname contains \"phantom\" but is not a canonical phantom domain, and uses high-risk TLD .xyz.", "confidence": 0.95, "source": "walour-heuristic" }, "token": null }
```

### 4. Load the extension

```bash
cp apps/extension/.env.example apps/extension/.env
# Set VITE_API_BASE=http://localhost:3001
cd apps/extension && npm run build
```

Chrome → `chrome://extensions` → Developer mode → **Load unpacked** → `apps/extension/dist`

The extension activates on any page where `window.solana` (Phantom, Solflare, Backpack) is present.

### 5. Stats dashboard

```bash
cd apps/web && npm run dev
# → http://localhost:3000/stats
```

---

## SDK

```bash
npm install @walour/sdk
```

```ts
import { checkDomain, checkTokenRisk, decodeTransaction } from '@walour/sdk'

// Domain check — corpus + GoPlus + homoglyph + RDAP age
const domain = await checkDomain('phantom-wallet.xyz')
// { level: 'RED', reason: 'Hostname contains "phantom" but is not a canonical phantom domain...', confidence: 0.95 }

// Token risk — on-chain checks + GoPlus + Jupiter intelligence
const token = await checkTokenRisk('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
// { level: 'GREEN', score: 2, reasons: [], intel: { jupiter: { organicScore: 92, isVerified: true, isSus: null, ... } } }

// Transaction decoder — streams Claude output token by token
for await (const chunk of decodeTransaction(serializedTx)) {
  process.stdout.write(chunk)
}
// Safe: this swaps 0.5 SOL for USDC via Jupiter. No unusual authority changes detected.
```

All functions are cache-first (Upstash Redis) and circuit-breakered. An outage at Helius, GoPlus, or Anthropic degrades gracefully rather than crashing the SDK.

---

## Stack

| Layer | Tech |
|---|---|
| SDK | TypeScript, `@walour/sdk` (npm) |
| Extension | Chrome Manifest V3, TypeScript, Vite |
| On-chain oracle | Anchor / Rust, Solana |
| Backend | Vercel Edge Functions (production), Node.js HTTP (local dev) |
| Database | Supabase (PostgreSQL) |
| Cache | Upstash Redis — cache-first on all SDK calls |
| AI | Claude Haiku 4.5 — streaming tx decode, < 400ms first token |
| RPC | Helius -> Triton -> RPC Fast -> public (circuit-breakered fallback chain) |
| Threat intel | ScamSniffer (60k domains), GoPlus Security, Jupiter Tokens v2 + Price v3, RDAP |

---

## Security

Walour is a security product, so its own posture is published.

**Threat model:** the SDK and extension sit in the wallet-signing critical path; the worker pays for AI/RPC/threat-intel calls per request; the on-chain oracle is the durable shared trust layer. Adversaries we defend against: malicious dApps that craft drainer transactions, phishing pages that postMessage the bridge, attackers who try to Sybil-flag legitimate addresses on the oracle, and anyone attempting to drain Anthropic/Helius/GoPlus quota by hammering public worker endpoints.

**Audit + remediation log:**
- `D:\Walour\AUDIT_2026-05-07.md` — full audit (4 CRITICAL, 20 HIGH, 22 MEDIUM, 12 LOW).
- `D:\Walour\REMEDIATION_PLAN_2026-05-07.md` — wave-by-wave fix plan with acceptance criteria.

**Deployment requirement — Vercel cron auth:** Vercel cron does not support custom Authorization headers in `vercel.json`. Instead Vercel auto-injects the value of the `CRON_SECRET` env var as `Authorization: Bearer <CRON_SECRET>` on every scheduled invocation. Before deploying:

1. In `apps/worker/.env` set `WALOUR_CRON_SECRET` to a 32-byte hex string (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
2. In Vercel project env, set BOTH `WALOUR_CRON_SECRET` AND `CRON_SECRET` to the same value.

Without step 2, `/api/purge`, `/api/promote`, and `/api/ingest` will 401 immediately on every cron tick. `lib/cron-auth.ts` accepts either env name as a fallback so local development with only `WALOUR_CRON_SECRET` works without a separate `CRON_SECRET`.

### How to verify the security posture

```bash
# 1. Rate limit on /api/scan (expect first ~30 → 200, rest → 429)
for i in $(seq 1 50); do curl -s -o /dev/null -w "%{http_code} " "http://localhost:3001/api/scan?hostname=test$i.xyz" & done; wait

# 2. Cron-class endpoints reject GET (405) and unauthenticated POST (401)
curl -s -o /dev/null -w "purge GET: %{http_code}\n"  -X GET  http://localhost:3001/api/purge
curl -s -o /dev/null -w "purge POST: %{http_code}\n" -X POST http://localhost:3001/api/purge

# 3. Hostname input validation (expect 400)
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3001/api/scan?hostname=%3Cscript%3E"

# 4. Supabase RLS — drain_blocked_events should have a CHECK-constrained policy
#    (run via the Supabase SQL editor under the project's anon role)
SELECT policyname, with_check FROM pg_policies WHERE tablename = 'drain_blocked_events';
SELECT conname FROM pg_constraint WHERE conrelid = 'public.drain_blocked_events'::regclass AND contype = 'c';

# 5. Oracle program — Sybil corroboration must fail
cd walour && anchor test --skip-deploy
```

---

## License

MIT
