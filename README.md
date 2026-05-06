# Walour: Solana Security Oracle

> Real-time scam protection for Solana. Intercepts wallet-draining transactions before you sign, explains them in plain English, and publishes threat intelligence to an on-chain oracle any dApp can query.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Solana](https://img.shields.io/badge/Solana-devnet-9945FF)](https://solana.com)
[![Colosseum Frontier 2026](https://img.shields.io/badge/Colosseum-Frontier%202026-FF6B35)](https://arena.colosseum.org)

---

## Colosseum Frontier 2026

Walour was built for and submitted to [Colosseum Frontier 2026](https://arena.colosseum.org). Applying to the following tracks:

**Demo video:** _link added on submission day_

| Track | Sponsor | Fit |
|---|---|---|
| Jupiter Developer Platform | Jupiter | Jupiter Tokens v2 + Price v3 integrated as a dedicated security intelligence layer |
| Security Audit Credits | Adevar Labs | Security oracle product — threat model, PDA collision analysis, prompt injection surface |
| RPC Infrastructure Credits | RPC Fast | RPC Fast is the third tier in the SDK fallback chain (Helius -> Triton -> RPC Fast -> public) |

---

## The problem

Solana wallet drainers stole **$330M+** in 2024. Every attack follows the same pattern: get the user to sign a transaction they don't understand. Current defenses are either:

- **Too late** — hardware wallets show raw hex after the user clicked "sign"
- **Too narrow** — blocklists miss new drainers within hours of deployment
- **Not composable** — each wallet re-implements its own ad-hoc checks

Walour sits between the dApp and the wallet, decodes the transaction in real time, and shares its findings with the entire ecosystem.

---

## How it works

```
dApp triggers signTransaction()
         │
         ▼
  [Walour content script intercepts]
         │
         ├─ checkDomain()      → corpus + GoPlus + homoglyph + RDAP age check
         ├─ checkTokenRisk()   → mint authority, freeze, Token-2022, GoPlus, Jupiter intel
         ├─ /api/simulate      → exact SOL + token balance deltas before signing
         └─ decodeTransaction() → Claude Haiku streams plain-English explanation
                 │
                 ▼
         Overlay appears in < 400ms
         GREEN / AMBER / RED verdict
         "Don't sign" → drain_blocked telemetry emitted → Supabase
```

All threat data is published to an on-chain Solana oracle. Any dApp can query it via the SDK:

```ts
import { checkDomain, checkTokenRisk } from '@walour/sdk'

const risk = await checkDomain('suspicious-airdrop.xyz')
// { level: 'RED', reason: 'Known phishing domain', confidence: 0.95 }
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

Walour uses **Jupiter Tokens v2** and **Price v3** as a dedicated security intelligence layer — the only external API in our stack built around token quality signals rather than threat lists.

Both API calls run in parallel with existing checks inside a `Promise.allSettled`. A 2.5s timeout is set on each. If Jupiter is unreachable, the rest of the engine continues unaffected.

**Signals consumed:**

| Field | Source | How it is used |
|---|---|---|
| `organicScoreLabel` | Tokens v2 | Primary categorical signal — `low` = RED flag (weight 15), `high` = positive pass |
| `audit.isSus` | Tokens v2 | Only present when flagged — `true` = RED flag (weight 20); absence is not treated as safe |
| `isVerified` | Tokens v2 | `false` adds weight when another flag is already present (conditional, weight 5) |
| `devBalancePercentage` | Tokens v2 | > 20% concentration = AMBER flag (weight 10) |
| Price presence | Price v3 | Token absent from response AND older than 7 days = AMBER — no liquidity signal |

Maximum Jupiter contribution: 60/100 points. Walour's RED threshold is 60 — Jupiter signals alone can push a suspicious token to RED.

**DX report:** [`docs/JUPITER_DX_REPORT.md`](docs/JUPITER_DX_REPORT.md)

---

## Repo structure

```
apps/
  worker/        — Backend API (Vercel Edge Functions)
                   /api/scan      → domain + token risk
                   /api/decode    → Claude streaming decoder
                   /api/simulate  → pre-sign balance delta simulation
  extension/     — Chrome extension (Manifest V3, TypeScript + Vite)
  web/           — Marketing site + stats dashboard (Next.js)
packages/
  sdk/           — @walour/sdk — checkDomain, checkTokenRisk, decodeTransaction
programs/
  walour_oracle/ — Anchor program (on-chain threat registry)
docs/
  architecture.md          — Full system architecture
  JUPITER_DX_REPORT.md     — Jupiter Developer Platform integration report
```

---

## On-chain oracle

Program ID: `42xCNeFF1HhTDrLfvJu8ieMxuSfEHQDisK8Fe1hJ4QHL` · [View on Solana Explorer](https://explorer.solana.com/address/42xCNeFF1HhTDrLfvJu8ieMxuSfEHQDisK8Fe1hJ4QHL?cluster=devnet)

The oracle is the durable shared layer. Community reports flow in permissionlessly. Confidence accumulates from unique corroborations. An authority can override. Everything is anchored to a PDA — no centralised database required to verify a threat.

```
submit_report(address, threat_type, evidence_url)
  → ThreatReport PDA  [seeds: b"threat" + address]
  → Confidence: 40 (community weight)

corroborate_report(address)
  → Corroboration PDA  [seeds: b"corroboration" + address + signer]
  → init fails if signer already corroborated — sybil guard enforced on-chain
  → Confidence: +5 per unique wallet, capped at 100

update_confidence(address, score)
  → Authority-gated via OracleConfig PDA
  → Final override for verified threats
```

**Security properties:** Signer checks via `Signer<'info>` · PDA validation with stored bump on every account · `init` constraint prevents reinitialization · Anchor 8-byte discriminators prevent type cosplay · One-per-signer corroboration PDA closes the sybil/spam vector entirely.

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
ANTHROPIC_API_KEY=          # Claude streaming (tx decoder)
HELIUS_API_KEY=             # Solana RPC — free tier at helius.dev
SUPABASE_URL=               # Supabase project URL
SUPABASE_SERVICE_KEY=       # service_role key (worker needs write access)
UPSTASH_REDIS_URL=          # Upstash Redis REST URL
UPSTASH_REDIS_TOKEN=        # Upstash Redis REST token
EXTENSION_ID=               # Your Chrome extension ID (chrome://extensions)
JUPITER_API_KEY=            # Jupiter API key — powers organic score + audit.isSus checks
                            # Free tier (60 RPM) at portal.jup.ag
                            # If absent, Jupiter checks are silently skipped
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
# Set VITE_API_BASE (default: http://localhost:3001)
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
const domain = await checkDomain('phantom-app.io')
// { level: 'RED', reason: 'Known phishing domain', confidence: 0.95 }

// Token risk — on-chain checks + GoPlus + Jupiter intelligence
const token = await checkTokenRisk('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
// { level: 'GREEN', score: 2, reasons: [], intel: { jupiter: { organicScore: 92, isVerified: true, ... } } }

// Transaction decoder — streams Claude output token by token
for await (const chunk of decodeTransaction(serializedTx)) {
  process.stdout.write(chunk)
}
// This transaction transfers ownership of your token account to an unknown program...
```

All functions are cache-first (Upstash Redis) and circuit-breakered — an outage at Helius, GoPlus, or Anthropic degrades gracefully rather than crashing the SDK.

---

## Stack

| Layer | Tech |
|---|---|
| SDK | TypeScript, `@walour/sdk` |
| Extension | Chrome Manifest V3, TypeScript, Vite |
| On-chain oracle | Anchor / Rust, Solana |
| Backend | Vercel Edge Functions (production), Node.js HTTP (local dev) |
| Database | Supabase (PostgreSQL) |
| Cache | Upstash Redis (cache-first on all SDK calls) |
| AI | Claude Haiku 4.5 (streaming tx decode) |
| RPC | Helius -> Triton -> RPC Fast -> public (circuit-breakered fallback chain) |
| Threat intel | ScamSniffer (60k domains), GoPlus Security, Jupiter Tokens v2 + Price v3, RDAP |

---

## License

MIT
