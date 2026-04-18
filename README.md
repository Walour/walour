# Walour — Solana Security Oracle

Real-time, composable threat intelligence for Solana. Block phishing sites, malicious tokens, and wallet drainers before you sign.

[![npm](https://img.shields.io/npm/v/@walour/sdk?color=00C9A7&label=npm)](https://www.npmjs.com/package/@walour/sdk)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Solana](https://img.shields.io/badge/Solana-mainnet-9945FF)](https://solana.com)

---

## What it does

- **Intercepts before you sign.** The Chrome extension decodes every transaction in real time and flags drainers, rugs, and phishing domains before your wallet pops up.
- **Shared on-chain oracle.** Threat reports live in a permissionless Anchor program. Any dApp can query the registry in 10 lines of TypeScript — no API key, no entity that can go offline.
- **AI-powered decoding.** Claude Sonnet streams a plain-English explanation of what a transaction actually does, with a confidence-weighted risk score.

---

## Architecture

```
Chrome Extension
      |
      v
  Backend API  (Vercel Edge Functions)
      |
      v
   @walour/sdk
      |
      +---> Supabase (corpus + events)
      |
      +---> On-chain Oracle (Anchor program, Solana mainnet)
                 ^
                 |
           Promote Worker (hourly cron)
```

---

## Quick Start

```bash
npm install @walour/sdk
```

```ts
import { checkDomain, checkTokenRisk, decodeTransaction } from '@walour/sdk'

// 1. Domain / address lookup
const domain = await checkDomain('suspicious-airdrop.xyz')
// { level: 'RED', reason: '...', confidence: 0.95, source: 'goplus' }

// 2. Token risk check
const token = await checkTokenRisk('TokenMintAddressHere...')
// { level: 'AMBER', score: 0.62, reasons: ['Mint authority not revoked'], ... }

// 3. Decode a transaction (streaming)
const stream = await decodeTransaction(serializedTx)
for await (const chunk of stream) {
  process.stdout.write(chunk) // first token < 400ms
}
```

---

## Stack

| Layer | Tech |
|---|---|
| SDK | TypeScript, npm (`@walour/sdk`) |
| Extension | Chrome/Brave Manifest v3, TypeScript |
| On-chain | Anchor / Rust, Solana mainnet |
| Backend / cron | Vercel Edge Functions + Supabase |
| Cache | Upstash Redis |
| AI | Claude Sonnet 4.6 (primary), Claude Haiku 4.5 (fallback) |
| RPC | Helius (primary) → Triton (fallback) → Solana public |
| Threat intel | GoPlus Security API |
| Distribution | Dialect Blinks |

---

## Colosseum

Any dApp can read the threat registry in 10 lines of TypeScript. No entity can take it down.

Walour is built as **security oracle / shared infrastructure** — not a blocklist app, not a gamified leaderboard. Oracle (+27% winner signal) and NLP (+24%) are the two attributes that overindex in Colosseum winners. That is exactly what this is.

---

## Links

- Stats dashboard: [walour.xyz/stats](https://walour.xyz/stats)
- Chrome Web Store: *(coming soon)*
- npm: [@walour/sdk](https://www.npmjs.com/package/@walour/sdk)

---

## License

MIT
