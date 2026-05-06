import { Connection, PublicKey } from '@solana/web3.js'
import { cacheGet, cacheSet } from './lib/cache'
import { withRpcFallback } from './lib/rpc'
import { lookupAddress } from './domain-check'
import type { TokenRiskResult } from './types'

const RAYDIUM_LOCK_STR = 'LockrFaYaRmxWaQdxFRNStUWZ8pBudtEoJKxYBQUwcMN'
let _raydiumLock: PublicKey | null = null
function getRaydiumLock(): PublicKey {
  if (!_raydiumLock) _raydiumLock = new PublicKey(RAYDIUM_LOCK_STR)
  return _raydiumLock
}
const CACHE_TTL = 60

export async function checkTokenRisk(mint: string): Promise<TokenRiskResult> {
  const cacheKey = `token:risk:${mint}`
  const cached = await cacheGet<TokenRiskResult>(cacheKey)
  if (cached) return cached

  const result = await withRpcFallback(conn => runChecks(mint, conn))
    .catch((): TokenRiskResult => ({
      level: 'AMBER',
      score: 30,
      reasons: ['Risk check unavailable — all RPC providers unreachable'],
      checks: {},
    }))

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

interface JupiterSecData {
  organicScore: number | null
  organicScoreLabel: 'high' | 'medium' | 'low' | null
  isVerified: boolean | null
  // isSus is only present in the API response when true — absence means unchecked, not safe
  isSus: true | null
  devBalancePct: number | null
  devMints: number | null
  liquidityUsd: number | null
  hasPrice: boolean | null
  tags: string[]
}

async function getJupiterSecurity(mint: string): Promise<JupiterSecData | null> {
  const apiKey = process.env.JUPITER_API_KEY
  if (!apiKey) return null

  const headers = { 'x-api-key': apiKey }
  const sig = { signal: AbortSignal.timeout(2_500) }

  try {
    const [searchRes, priceRes] = await Promise.allSettled([
      fetch(`https://api.jup.ag/tokens/v2/search?query=${encodeURIComponent(mint)}`, { headers, ...sig }),
      fetch(`https://api.jup.ag/price/v3?ids=${encodeURIComponent(mint)}`, { headers, ...sig }),
    ])

    let organicScore: number | null = null
    let organicScoreLabel: JupiterSecData['organicScoreLabel'] = null
    let isVerified: boolean | null = null
    let isSus: true | null = null
    let devBalancePct: number | null = null
    let devMints: number | null = null
    let tags: string[] = []

    if (searchRes.status === 'fulfilled' && searchRes.value.ok) {
      const arr = await searchRes.value.json() as Array<{
        id: string
        organicScore?: number
        organicScoreLabel?: 'high' | 'medium' | 'low'
        isVerified?: boolean
        audit?: {
          isSus?: true        // only present when flagged; absence means unchecked
          mintAuthorityDisabled?: boolean
          freezeAuthorityDisabled?: boolean
          topHoldersPercentage?: number
          devBalancePercentage?: number
          devMints?: number
        }
        tags?: string[]
      }>
      const hit = Array.isArray(arr) ? arr.find(t => t.id === mint) : null
      if (hit) {
        organicScore = hit.organicScore ?? null
        organicScoreLabel = hit.organicScoreLabel ?? null
        isVerified = hit.isVerified ?? null
        isSus = hit.audit?.isSus === true ? true : null
        devBalancePct = hit.audit?.devBalancePercentage ?? null
        devMints = hit.audit?.devMints ?? null
        tags = hit.tags ?? []
      }
    }

    // Tokens absent from the Price v3 response have no reliable pricing data
    let hasPrice: boolean | null = null
    let liquidityUsd: number | null = null
    if (priceRes.status === 'fulfilled' && priceRes.value.ok) {
      const data = await priceRes.value.json() as Record<string, { usdPrice?: number; liquidity?: number } | undefined>
      const entry = data?.[mint]
      hasPrice = entry !== undefined && entry.usdPrice != null
      liquidityUsd = entry?.liquidity ?? null
    }

    if (
      organicScore === null && organicScoreLabel === null && isVerified === null &&
      isSus === null && devBalancePct === null && hasPrice === null
    ) {
      return null
    }

    return { organicScore, organicScoreLabel, isVerified, isSus, devBalancePct, devMints, liquidityUsd, hasPrice, tags }
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

async function runChecks(mint: string, connection: Connection): Promise<TokenRiskResult> {
  const mintPubkey = new PublicKey(mint)

  const [mintInfo, largestAccounts, lpLocked, tokenAgeDays, goplusFlag, corpusHit, jupiterSec] =
    await Promise.allSettled([
      connection.getParsedAccountInfo(mintPubkey),
      connection.getTokenLargestAccounts(mintPubkey),
      checkLpLock(mint, connection),
      getTokenAge(mintPubkey, connection),
      getGoPlusFlag(mint),
      lookupAddress(mint),
      getJupiterSecurity(mint),
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

  // DH-03: Token-2022 extension honeypot checks
  if (mintInfo.status === 'fulfilled' && mintInfo.value.value) {
    const parsed = (mintInfo.value.value.data as any)?.parsed
    const extensions: Array<{ extension: string; state?: any }> =
      parsed?.info?.extensions ?? []

    for (const ext of extensions) {
      // ConfidentialTransfer: balances hidden — drain amounts unverifiable
      // Note: ext.state may be absent (account-decoder PR #24621). Presence-only check.
      if (ext.extension === 'confidentialTransferMint') {
        checks.confidentialTransfer = {
          passed: false,
          weight: 20,
          detail: 'Token uses Confidential Transfer — balances are hidden, drain amounts are unverifiable',
        }
        score += 20
      }
      // TransferFee: honeypot pattern when basis points > 500 (>5%)
      if (ext.extension === 'transferFeeConfig') {
        const bps: number = ext.state?.newerTransferFee?.transferFeeBasisPoints ?? 0
        if (bps > 500) {
          checks.transferFee = {
            passed: false,
            weight: 20,
            detail: `Token charges ${(bps / 100).toFixed(1)}% transfer fee — honeypot pattern`,
          }
          score += 20
        }
      }
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

  // Check 8: Jupiter intelligence — organic score, audit flag, dev concentration, liquidity
  if (jupiterSec.status === 'fulfilled' && jupiterSec.value !== null) {
    const j = jupiterSec.value
    const ageDays = tokenAgeDays.status === 'fulfilled' ? tokenAgeDays.value : null
    const isEstablished = ageDays !== null && ageDays >= 7

    // Prefer the categorical label (confirmed enum: high/medium/low) over raw numeric threshold
    if (j.organicScoreLabel !== null) {
      if (j.organicScoreLabel === 'low') {
        const detail = j.organicScore !== null
          ? `Jupiter organic score ${j.organicScore.toFixed(0)}/100 — low organic trading activity`
          : 'Low organic trading activity (Jupiter)'
        checks.jupiterOrganicScore = { passed: false, weight: 15, detail }
        score += 15
      } else if (j.organicScoreLabel === 'high') {
        const detail = j.organicScore !== null
          ? `Jupiter organic score ${j.organicScore.toFixed(0)}/100 — healthy organic activity`
          : 'High organic trading activity (Jupiter)'
        checks.jupiterOrganicScore = { passed: true, weight: 15, detail }
      }
      // medium: neutral, no check entry
    } else if (j.organicScore !== null) {
      // fallback to numeric if label absent
      if (j.organicScore < 30) {
        checks.jupiterOrganicScore = { passed: false, weight: 15, detail: `Jupiter organic score ${j.organicScore.toFixed(0)}/100 — low organic trading activity` }
        score += 15
      } else if (j.organicScore >= 70) {
        checks.jupiterOrganicScore = { passed: true, weight: 15, detail: `Jupiter organic score ${j.organicScore.toFixed(0)}/100 — healthy organic activity` }
      }
    }

    // isSus is only set by Jupiter when explicitly flagged — absence means unchecked, not safe
    if (j.isSus === true) {
      checks.jupiterSus = { passed: false, weight: 20, detail: 'Flagged suspicious by Jupiter audit' }
      score += 20
    }

    // Only penalise unverified if another flag is already present — avoids punishing every new legit token
    if (j.isVerified === false && score > 0) {
      checks.jupiterUnverified = { passed: false, weight: 5, detail: 'Token is not verified on Jupiter' }
      score += 5
    } else if (j.isVerified === true) {
      checks.jupiterUnverified = { passed: true, weight: 5, detail: 'Verified on Jupiter' }
    }

    if (j.devBalancePct !== null && j.devBalancePct > 20) {
      const mintNote = j.devMints !== null && j.devMints > 1 ? `, ${j.devMints} mint events` : ''
      checks.jupiterDevBalance = { passed: false, weight: 10, detail: `Deployer holds ${j.devBalancePct.toFixed(1)}% of supply${mintNote} (Jupiter)` }
      score += 10
    }

    // Token absent from Price v3 response = no reliable pricing. Only flag established tokens.
    if (j.hasPrice === false && isEstablished) {
      checks.jupiterNoPrice = { passed: false, weight: 10, detail: 'No Jupiter price — absent from price feed, illiquid or no routable pool' }
      score += 10
    }
  }

  // Check 9: Walour corpus hit
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

  const intel: TokenRiskResult['intel'] = {}
  if (jupiterSec.status === 'fulfilled' && jupiterSec.value !== null) {
    const j = jupiterSec.value
    intel.jupiter = {
      organicScore: j.organicScore,
      isVerified: j.isVerified,
      isSus: j.isSus,
      devBalancePct: j.devBalancePct,
      devMints: j.devMints,
      liquidityUsd: j.liquidityUsd,
      hasPrice: j.hasPrice,
      tags: j.tags,
      fetchedAt: Date.now(),
    }
  }

  return { level, score, reasons, checks, ...(Object.keys(intel).length ? { intel } : {}) }
}
