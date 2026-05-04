# Walour — Solana Security Oracle

> Real-time scam protection for Solana. Intercepts wallet-draining transactions before you sign, explains them in plain English, and publishes threat intelligence to an on-chain oracle any dApp can query.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Solana](https://img.shields.io/badge/Solana-devnet-9945FF)](https://solana.com)

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
         ├─ checkDomain()     → Supabase corpus + GoPlus + homoglyph + RDAP age check
         ├─ checkTokenRisk()  → mint authority, freeze, Token-2022 honeypot flags
         ├─ /api/simulate     → exact SOL + token balance deltas before signing
         └─ decodeTransaction() → Claude Haiku streams plain-English explanation
                 │
                 ▼
         Overlay appears in < 400ms
         GREEN / AMBER / RED verdict
         "Don't sign" → drain_blocked event → oracle updated
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
| AI plain-English decode | Claude Haiku streaming | ✅ |

---

## Repo structure

```
apps/
  worker/        — Backend API (Vercel Edge Functions)
                   /api/scan      → domain + token risk
                   /api/decode    → Claude streaming decoder
                   /api/simulate  → pre-sign balance delta simulation
  extension/     — Chrome extension (Manifest V3, TypeScript + Vite)
  web/           — Stats dashboard (Next.js)
packages/
  sdk/           — @walour/sdk — checkDomain, checkTokenRisk, decodeTransaction
programs/
  walour_oracle/ — Anchor program (on-chain threat registry)
```

---

## On-chain oracle

Program ID: `42xCNeFF1HhTDrLfvJu8ieMxuSfEHQDisK8Fe1hJ4QHL` · [View on Solana Explorer →](https://explorer.solana.com/address/42xCNeFF1HhTDrLfvJu8ieMxuSfEHQDisK8Fe1hJ4QHL?cluster=devnet)

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
UPSTASH_REDIS_REST_URL=     # Upstash Redis REST URL
UPSTASH_REDIS_REST_TOKEN=   # Upstash Redis REST token
EXTENSION_ID=               # Your Chrome extension ID (chrome://extensions)
JUPITER_API_KEY=            # Optional — token symbols in overlay
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
curl "http://localhost:3001/api/scan?hostname=wallet-solana-airdrop.xyz"
# { "level": "RED", "reason": "Known phishing domain", "confidence": 0.9 }
```

### 4. Load the extension

```bash
cp apps/extension/.env.example apps/extension/.env
# Fill in VITE_API_BASE (default: http://localhost:3001) and Supabase keys
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

// Domain check — corpus + GoPlus + homoglyph detection
const domain = await checkDomain('phantom-app.io')
// { level: 'RED', reason: 'Known phishing domain', confidence: 0.95 }

// Token risk — on-chain checks + Token-2022 honeypot flags
const token = await checkTokenRisk('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
// { level: 'GREEN', score: 2, reasons: [] }

// Transaction decoder — streams Claude output token by token
for await (const chunk of decodeTransaction(serializedTx)) {
  process.stdout.write(chunk)
}
// ⚠️ Account 8xGz... ownership is being transferred to a new program — ownership-hijack pattern.
// This transaction moves control of your token account to an unknown program...
```

All functions are cache-first (Upstash Redis) and circuit-breakered — an outage at Helius, GoPlus, or Anthropic degrades gracefully rather than crashing the SDK.

---

## Bounty integrations

| Track | Integration |
|---|---|
| **Umbra** | `submitPrivateReport()` — anonymous drain reports via Umbra SDK |
| **Cloak** | `submitPrivateReportCloak()` — privacy-preserving threat submission |
| **RPC Fast** | Tier-3 fallback in RPC chain (Helius → Triton → RPC Fast → public) |

---

## Stack

| Layer | Tech |
|---|---|
| SDK | TypeScript, `@walour/sdk` |
| Extension | Chrome Manifest V3, TypeScript, Vite |
| On-chain oracle | Anchor / Rust, Solana |
| Backend | Express + Vercel Edge Functions |
| Database | Supabase (PostgreSQL) |
| Cache | Upstash Redis (cache-first on all SDK calls) |
| AI | Claude Haiku 4.5 (streaming), Claude Sonnet 4.6 (deep analysis) |
| RPC | Helius → Triton → RPC Fast → public |
| Threat intel | ScamSniffer, GoPlus Security, RDAP |

---

## License

MIT
