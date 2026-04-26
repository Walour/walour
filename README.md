# Walour — Solana Security Oracle

Real-time, composable threat intelligence for Solana. Blocks phishing sites, malicious tokens, and wallet drainers before you sign.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Solana](https://img.shields.io/badge/Solana-mainnet-9945FF)](https://solana.com)

---

## What it does

- **Intercepts before you sign.** Chrome extension decodes every transaction in real time and flags drainers, rugs, and phishing domains before your wallet popup appears.
- **AI-powered explanation.** Claude Sonnet 4.6 streams a plain-English breakdown of what a transaction actually does, with a risk score.
- **5,200+ threat corpus.** Live Supabase database of known drainers, phishing domains, and malicious tokens — updated continuously.
- **Public stats dashboard.** `walour.xyz/stats` shows threats tracked, drains blocked, and SOL saved in real time.

---

## Repo structure

```
apps/
  worker/     — Backend API (Express + Vercel Edge Functions)
                /api/scan    → domain + token risk check
                /api/decode  → Claude streaming transaction decoder
  extension/  — Chrome extension (Manifest V3, TypeScript + Vite)
  web/        — Stats dashboard (Next.js)
packages/
  sdk/        — @walour/sdk (npm package)
programs/
  walour_oracle/ — Anchor program (Solana on-chain threat registry)
```

---

## Running locally

### Prerequisites

- Node 18+
- npm 9+

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

Copy the example and fill in your keys:

```bash
cp .env.example apps/worker/.env
```

Required keys in `apps/worker/.env`:

```
ANTHROPIC_API_KEY=
HELIUS_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
RPC_FAST_API_KEY=
```

### 3. Run the backend worker

```bash
cd apps/worker
npx tsx server.ts
# Runs on http://localhost:3000
```

Test it:
```bash
curl "http://localhost:3000/api/scan?hostname=wallet-solana-airdrop.xyz"
# { "level": "RED", "reason": "Known phishing domain", "confidence": 0.9 }
```

### 4. Load the Chrome extension

```bash
cd apps/extension
npm run build
```

Then in Chrome:
1. Go to `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** → select `apps/extension/dist`

The extension intercepts wallet signing on any page with Phantom, Solflare, or Backpack.

### 5. Stats dashboard

```bash
cd apps/web
npm run dev
# Open http://localhost:3000/stats
```

---

## SDK usage

```bash
npm install @walour/sdk
```

```ts
import { checkDomain, checkTokenRisk, decodeTransaction } from '@walour/sdk'

// Domain / address lookup
const domain = await checkDomain('suspicious-airdrop.xyz')
// { level: 'RED', reason: 'Known phishing domain', confidence: 0.95 }

// Token risk score
const token = await checkTokenRisk('TokenMintAddressHere...')
// { level: 'AMBER', score: 44, reasons: ['Mint authority not revoked'] }

// Transaction decoder — streams Claude output token by token
for await (const chunk of decodeTransaction(tx)) {
  process.stdout.write(chunk)
}
```

---

## Demo flow (for video)

1. Start worker: `cd apps/worker && npx tsx server.ts`
2. Load extension from `apps/extension/dist`
3. Open a test page with Phantom connected
4. Trigger a `signTransaction` call
5. Walour overlay appears — shows URL risk, token risk, and Claude streaming the transaction explanation
6. Click **Don't sign** → drain blocked, event recorded to Supabase
7. Open `http://localhost:3000/stats` — shows updated drain count

---

## Stack

| Layer | Tech |
|---|---|
| SDK | TypeScript, `@walour/sdk` |
| Extension | Chrome Manifest V3, TypeScript, Vite |
| On-chain | Anchor / Rust, Solana |
| Backend | Express + Vercel Edge Functions |
| Database | Supabase (PostgreSQL) |
| Cache | Upstash Redis |
| AI | Claude Sonnet 4.6 (primary), Claude Haiku 4.5 (fallback) |
| RPC | Helius → Triton → Solana public |
| Threat intel | GoPlus Security API |

---

## License

MIT
