import { Connection, PublicKey } from '@solana/web3.js'
import { cacheGet, cacheSet } from './lib/cache'
import { withBreaker } from './lib/circuit-breaker'
import { lookupAddress } from './domain-check'
import type { TokenRiskResult } from './types'

const RAYDIUM_LOCK_STR = 'LockrFaYaRmxWaQdxFRNStUWZ8pBudtEoJKxYBQUwcMN'
let _raydiumLock: PublicKey | null = null
function getRaydiumLock(): PublicKey {
  if (!_raydiumLock) _raydiumLock = new PublicKey(RAYDIUM_LOCK_STR)
  return _raydiumLock
}
const CACHE_TTL = 60

function getConnection(): Connection {
  return new Connection(
    `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`,
    'confirmed'
  )
}

export async function checkTokenRisk(mint: string): Promise<TokenRiskResult> {
  const cacheKey = `token:risk:${mint}`
  const cached = await cacheGet<TokenRiskResult>(cacheKey)
  if (cached) return cached

  const result = await withBreaker(
    'helius',
    () => runChecks(mint),
    async () => ({
      level: 'AMBER' as const,
      score: 30,
      reasons: ['Risk check unavailable — RPC provider unreachable'],
      checks: {}
    })
  )

  await cacheSet(cacheKey, result, CACHE_TTL)
  return result
}

async function checkLpLock(mint: string, connection: Connection): Promise<boolean> {
  // Check if any lock account owned by Raydium Lock program references this mint
  try {
    const locks = await connection.getProgramAccounts(getRaydiumLock(), {
      filters: [{ memcmp: { offset: 8, bytes: mint } }],
      dataSlice: { offset: 0, length: 0 },
    })
    return locks.length > 0
  } catch {
    return false
  }
}

async function getTokenAge(
  mintPubkey: PublicKey,
  connection: Connection
): Promise<number | null> {
  try {
    const sigs = await connection.getSignaturesForAddress(mintPubkey, { limit: 1 }, 'confirmed')
    if (!sigs.length || !sigs[0].blockTime) return null
    const ageMs = Date.now() - sigs[0].blockTime * 1000
    return Math.floor(ageMs / (1000 * 60 * 60 * 24)) // days
  } catch {
    return null
  }
}

async function getGoPlusFlag(mint: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://api.gopluslabs.io/api/v1/solana/token_security?contract_addresses=${mint}`,
      { signal: AbortSignal.timeout(5_000) }
    )
    if (!res.ok) return false
    const data = await res.json() as { result?: Record<string, { is_honeypot?: string; is_blacklisted?: string }> }
    const info = data?.result?.[mint]
    return info?.is_honeypot === '1' || info?.is_blacklisted === '1'
  } catch {
    return false
  }
}

async function runChecks(mint: string): Promise<TokenRiskResult> {
  const connection = getConnection()
  const mintPubkey = new PublicKey(mint)

  const [mintInfo, largestAccounts, lpLocked, tokenAgeDays, goplusFlag, corpusHit] =
    await Promise.allSettled([
      connection.getParsedAccountInfo(mintPubkey),
      connection.getTokenLargestAccounts(mintPubkey),
      checkLpLock(mint, connection),
      getTokenAge(mintPubkey, connection),
      getGoPlusFlag(mint),
      lookupAddress(mint),
    ])

  const checks: TokenRiskResult['checks'] = {}
  let score = 0

  // Check 1 & 2: Mint + Freeze authority
  if (mintInfo.status === 'fulfilled' && mintInfo.value.value) {
    const data = (mintInfo.value.value.data as any)?.parsed?.info
    if (data?.mintAuthority) {
      checks.mintAuthority = { passed: false, weight: 15, detail: 'Mint authority is active' }
      score += 15
    } else {
      checks.mintAuthority = { passed: true, weight: 15, detail: 'Mint authority revoked' }
    }
    if (data?.freezeAuthority) {
      checks.freezeAuthority = { passed: false, weight: 15, detail: 'Freeze authority is active' }
      score += 15
    } else {
      checks.freezeAuthority = { passed: true, weight: 15, detail: 'Freeze authority revoked' }
    }

    // Check 5: Supply anomaly — decimals 0 with large supply is a common rug pattern
    const decimals = data?.decimals ?? -1
    const supply = Number(data?.supply ?? 0)
    if (decimals === 0 && supply > 1_000_000_000) {
      checks.supplyAnomaly = { passed: false, weight: 10, detail: 'Zero-decimal token with >1B supply (common rug pattern)' }
      score += 10
    } else {
      checks.supplyAnomaly = { passed: true, weight: 10, detail: 'Supply looks normal' }
    }
  }

  // Check 3: Holder concentration
  if (largestAccounts.status === 'fulfilled') {
    const accounts = largestAccounts.value.value
    const supply = accounts.reduce((sum, a) => sum + Number(a.uiAmount ?? 0), 0)
    const top10 = accounts.slice(0, 10).reduce((sum, a) => sum + Number(a.uiAmount ?? 0), 0)
    const concentration = supply > 0 ? top10 / supply : 0
    if (concentration > 0.8) {
      checks.holderConcentration = { passed: false, weight: 15, detail: `Top 10 holders own ${(concentration * 100).toFixed(0)}% of supply` }
      score += 15
    } else if (concentration > 0.6) {
      checks.holderConcentration = { passed: false, weight: 8, detail: `Top 10 holders own ${(concentration * 100).toFixed(0)}% of supply` }
      score += 8
    } else {
      checks.holderConcentration = { passed: true, weight: 15, detail: 'Holder distribution looks normal' }
    }
  }

  // Check 4: LP lock
  if (lpLocked.status === 'fulfilled') {
    if (lpLocked.value) {
      checks.lpLock = { passed: true, weight: 10, detail: 'Liquidity is locked via Raydium Lock' }
    } else {
      checks.lpLock = { passed: false, weight: 10, detail: 'No liquidity lock detected' }
      score += 10
    }
  }

  // Check 6: Token age
  if (tokenAgeDays.status === 'fulfilled' && tokenAgeDays.value !== null) {
    const days = tokenAgeDays.value
    if (days < 1) {
      checks.tokenAge = { passed: false, weight: 15, detail: 'Token created less than 24 hours ago' }
      score += 15
    } else if (days < 7) {
      checks.tokenAge = { passed: false, weight: 8, detail: `Token is only ${days} day${days === 1 ? '' : 's'} old` }
      score += 8
    } else {
      checks.tokenAge = { passed: true, weight: 15, detail: `Token is ${days} days old` }
    }
  }

  // Check 7: GoPlus flag
  if (goplusFlag.status === 'fulfilled') {
    if (goplusFlag.value) {
      checks.goplusFlag = { passed: false, weight: 20, detail: 'Flagged as honeypot or blacklisted by GoPlus' }
      score += 20
    } else {
      checks.goplusFlag = { passed: true, weight: 20, detail: 'Not flagged by GoPlus' }
    }
  }

  // Check 8: Walour corpus hit
  if (corpusHit.status === 'fulfilled') {
    if (corpusHit.value) {
      checks.corpusHit = { passed: false, weight: 30, detail: `In Walour threat corpus (${corpusHit.value.type}, confidence ${(corpusHit.value.confidence * 100).toFixed(0)}%)` }
      score += 30
    } else {
      checks.corpusHit = { passed: true, weight: 30, detail: 'Not in Walour threat corpus' }
    }
  }

  const level = score >= 60 ? 'RED' : score >= 30 ? 'AMBER' : 'GREEN'
  const reasons = Object.values(checks)
    .filter(c => !c.passed)
    .map(c => c.detail)

  return { level, score, reasons, checks }
}
