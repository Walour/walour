# @walour/sdk

AI-powered real-time scam protection for Solana. Three checkpoints — domain, token, transaction — with streaming Claude explanations.

## Install

```bash
npm install @walour/sdk
```

## Environment variables

```
ANTHROPIC_API_KEY=
HELIUS_API_KEY=
SUPABASE_URL=
SUPABASE_ANON_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
GOPLUS_API_KEY=          # optional
```

## Usage

### Domain / address lookup

```ts
import { checkDomain, lookupAddress } from '@walour/sdk'

// Returns null if clean, ThreatReport if known threat
const threat = await lookupAddress('Fg6PaFpo...') 

const domain = await checkDomain('wallet-airdrop.xyz')
// { level: 'RED', reason: 'Phishing domain in corpus', confidence: 0.9 }
```

### Token risk score

```ts
import { checkTokenRisk } from '@walour/sdk'

const result = await checkTokenRisk('EPjFWdd5...')
// {
//   level: 'AMBER',
//   score: 38,
//   reasons: ['Mint authority is active', 'No liquidity lock detected'],
//   checks: { mintAuthority: { passed: false, weight: 15, detail: '...' }, ... }
// }
```

Scores: RED ≥ 60 · AMBER 30–59 · GREEN < 30

Eight parallel checks: mint authority, freeze authority, holder concentration, LP lock, supply anomaly, token age, GoPlus flag, Walour corpus hit.

### Transaction decoder (streaming)

```ts
import { decodeTransaction } from '@walour/sdk'
import { VersionedTransaction } from '@solana/web3.js'

const tx = VersionedTransaction.deserialize(rawBytes)

for await (const chunk of decodeTransaction(tx)) {
  process.stdout.write(chunk)
}
// "⚠️ Token authority transfer to Fg6PaFpo... This transaction will hand over
//  control of your token account to an unknown address. Do not sign."
```

Red flags (SetAuthority, CloseAccount, unknown Approve) are yielded immediately before the Claude stream starts.

## Architecture

```
checkDomain / lookupAddress
  └─ Upstash Redis (5min TTL) → Supabase threat_reports → GoPlus fallback

checkTokenRisk
  └─ Upstash Redis (60s TTL) → 8 parallel Helius RPC + GoPlus checks

decodeTransaction
  └─ ALT resolution → sync red-flag detection → Upstash Redis (24h TTL)
     → Claude Sonnet 4.6 stream (Haiku 4.5 fallback via circuit breaker)
```

## License

MIT
