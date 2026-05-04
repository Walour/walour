# @walour/sdk

AI-powered real-time scam protection for Solana. Three checkpoints — domain, token, transaction — backed by an on-chain threat oracle. Server-side SDK for Node.js, Vercel Edge Functions, and Cloudflare Workers.

[![npm](https://img.shields.io/badge/npm-%40walour%2Fsdk-red)](https://npmjs.com/package/@walour/sdk)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE)

---

## Install

```bash
npm install @walour/sdk
```

The SDK runs server-side (Node.js, Vercel Edge Functions, Cloudflare Workers). It is not a browser bundle — it calls Claude, Redis, and Helius RPC, which require API keys.

---

## Usage

### Domain and address lookup

```ts
import { checkDomain, lookupAddress } from '@walour/sdk'

// Is this site in the threat corpus?
const domain = await checkDomain('wallet-airdrop.xyz')
// { level: 'RED', reason: 'Phishing domain — 94% confidence', confidence: 0.94, source: 'corpus' }
// level: 'RED' | 'YELLOW' | 'GREEN'

// Is this wallet a known threat?
const threat = await lookupAddress('Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS')
// { address: 'Fg6P...', confidence: 0.91, threatType: 'Drainer' } | null
```

### Token risk score

```ts
import { checkTokenRisk } from '@walour/sdk'

const result = await checkTokenRisk('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
// {
//   level: 'AMBER',
//   score: 38,
//   reasons: ['Mint authority is active', 'No liquidity lock detected'],
//   checks: {
//     mintAuthority:     { passed: false, weight: 15, detail: 'Mint authority not revoked' },
//     freezeAuthority:   { passed: true,  weight: 10, detail: 'No freeze authority' },
//     holderConcentration: { passed: true, weight: 10, detail: 'Top 10 hold 34%' },
//     ...
//   }
// }
```

Risk score: **RED** ≥ 60 · **AMBER** 30–59 · **GREEN** < 30

Eight parallel checks: mint authority, freeze authority, holder concentration, LP lock, supply anomaly, token age, GoPlus flag, Walour corpus hit.

### Transaction decoder (streaming)

```ts
import { decodeTransaction } from '@walour/sdk'
import { VersionedTransaction } from '@solana/web3.js'

const tx = VersionedTransaction.deserialize(rawBytes)

for await (const chunk of decodeTransaction(tx)) {
  process.stdout.write(chunk)
}
// ⚠️ Token authority transfer to Fg6PaFpo...
// This transaction will hand control of your token account to an unknown address. Do not sign.
```

The decoder runs deterministic red-flag checks (SetAuthority, CloseAccount, unlimited Approve, PermanentDelegate, System Assign, durable nonce, multi-drain, corpus hits) before streaming — the warning appears in under 400ms. Claude Haiku 4.5 then streams a plain-English explanation. ALT (Address Lookup Table) accounts are fully resolved before decoding.

---

## How it works

```
checkDomain / lookupAddress
  └─ Upstash Redis (5min TTL)
     └─ Supabase threat_reports
        └─ GoPlus Security fallback

checkTokenRisk
  └─ Upstash Redis (60s TTL)
     └─ 8 parallel checks: Helius RPC + GoPlus

decodeTransaction
  └─ ALT resolution (degrades gracefully on failure)
     └─ Sync red-flag detection (yields immediately)
        └─ Upstash Redis (24h TTL)
           └─ Claude Haiku 4.5 stream
              └─ Circuit breaker → static safe message fallback
```

All functions are cache-first. Circuit breakers on Helius, GoPlus, and Claude — an outage at any provider degrades gracefully instead of crashing.

---

## Environment variables

The SDK reads these at runtime. Set them in your server environment or `.env` file:

```
ANTHROPIC_API_KEY=        # Required for decodeTransaction()
HELIUS_API_KEY=           # Required for checkTokenRisk() and ALT resolution
SUPABASE_URL=             # Required for checkDomain() and lookupAddress()
SUPABASE_ANON_KEY=        # Required for corpus reads
UPSTASH_REDIS_REST_URL=   # Required — cache layer for all exports
UPSTASH_REDIS_REST_TOKEN= # Required — cache layer for all exports
GOPLUS_API_KEY=           # Optional — higher rate limits on token checks
```

---

## On-chain oracle

Threat data is backed by an Anchor program on Solana (`42xCNeFF1HhTDrLfvJu8ieMxuSfEHQDisK8Fe1hJ4QHL`). Anyone can submit or corroborate a threat report. Confidence scores accumulate from unique-wallet corroborations — one signer, one vote, enforced on-chain via a `Corroboration` PDA. The SDK reads from the oracle via Supabase, which is kept in sync by the Walour ingest worker.

---

## License

MIT · [Walour](https://github.com/Sahir619/walour)
