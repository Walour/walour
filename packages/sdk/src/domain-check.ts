import { Connection, PublicKey } from '@solana/web3.js'
import { cacheGet, cacheSet } from './lib/cache'
import type { DomainRiskResult, ThreatReport } from './types'

const DOMAIN_TTL = 3_600   // 1h
const ADDRESS_TTL = 300    // 5 min
const CACHE_TTL = ADDRESS_TTL

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!

async function queryCorpus(address: string): Promise<ThreatReport | null> {
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/threat_reports?address=eq.${encodeURIComponent(address)}&limit=1`,
      {
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
        signal: AbortSignal.timeout(5_000),
      }
    )
    if (!res.ok) return null
    const rows: ThreatReport[] = await res.json()
    return rows[0] ?? null
  } catch {
    return null
  }
}

async function goplusDomainCheck(hostname: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://api.gopluslabs.io/api/v1/phishing_site?url=${encodeURIComponent(hostname)}`
    )
    const data = await res.json()
    return data?.result?.is_phishing_site === '1'
  } catch {
    return false
  }
}

export async function lookupAddress(pubkey: string): Promise<ThreatReport | null> {
  const cacheKey = `address:threat:${pubkey}`
  const cached = await cacheGet<ThreatReport | null>(cacheKey)
  if (cached !== undefined) return cached

  // 1. Supabase corpus lookup
  const report = await queryCorpus(pubkey)
  if (report) {
    await cacheSet(cacheKey, report, ADDRESS_TTL)
    return report
  }

  // 2. On-chain PDA fallback
  // Fallback order: Redis → Supabase → on-chain PDA → GoPlus
  // On-chain lookup (only if WALOUR_PROGRAM_ID and HELIUS_API_KEY are set, skip gracefully if not)
  if (process.env.WALOUR_PROGRAM_ID && process.env.HELIUS_API_KEY) {
    try {
      const connection = new Connection(
        `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`,
        'confirmed'
      )
      const programId = new PublicKey(process.env.WALOUR_PROGRAM_ID)
      const [pda] = PublicKey.findProgramAddressSync(
        [Buffer.from('threat'), new PublicKey(pubkey).toBuffer()],
        programId
      )
      const accountInfo = await connection.getAccountInfo(pda)
      if (accountInfo) {
        // PDA layout (byte offsets):
        //   0–7   : 8-byte discriminator
        //   8–39  : address (Pubkey, 32 bytes)
        //   40    : threat_type enum variant (1 byte)
        //   41–72 : source ([u8; 32])
        //   73–200: evidence_url ([u8; 128])
        //   201   : confidence (u8, 0–100)
        const confidence = accountInfo.data[201] / 100
        const THREAT_TYPES = ['drainer', 'rug', 'phishing_domain', 'malicious_token'] as const
        const typeIndex = accountInfo.data[40] ?? 0
        const threatType = THREAT_TYPES[typeIndex] ?? 'drainer'
        const chainResult: ThreatReport = {
          address: pubkey,
          type: threatType,
          source: 'on-chain',
          confidence,
          first_seen: new Date().toISOString(),
          last_updated: new Date().toISOString(),
        }
        await cacheSet(cacheKey, chainResult, CACHE_TTL)
        return chainResult
      }
    } catch {
      // On-chain lookup failure is non-fatal — fall through to null
    }
  }

  await cacheSet(cacheKey, null, ADDRESS_TTL)
  return null
}

// DH-06: IDN homograph detection.
// Browsers encode confusable Unicode hostnames to Punycode (xn-- ACE prefix).
// Char-code > 127 catches raw Unicode hostnames that bypassed browser encoding
// (e.g., from a fetch interceptor passing the URL as a string).
function hasHomoglyphRisk(hostname: string): boolean {
  if (hostname.includes('xn--')) return true
  for (let i = 0; i < hostname.length; i++) {
    if (hostname.charCodeAt(i) > 127) return true
  }
  return false
}

// ─── Phase 1 hostname heuristics (sync, zero-network, zero-dependency) ───────

// Brand → canonical hostnames. Subdomains of any canonical pass.
const BRAND_CANONICALS: Record<string, string[]> = {
  phantom:  ['phantom.app', 'phantom.com'],
  solflare: ['solflare.com'],
  backpack: ['backpack.app', 'backpack.exchange'],
  glow:     ['glow.app'],
  slope:    ['slope.finance'],
  exodus:   ['exodus.com'],
  ledger:   ['ledger.com'],
  trezor:   ['trezor.io'],
  metamask: ['metamask.io'],
  coinbase: ['coinbase.com', 'wallet.coinbase.com'],
  jupiter:  ['jup.ag', 'jupiter.exchange', 'station.jup.ag'],
  raydium:  ['raydium.io'],
  orca:     ['orca.so'],
  marinade: ['marinade.finance'],
  kamino:   ['kamino.finance'],
  drift:    ['drift.trade'],
  mango:    ['mango.markets'],
}

// TLDs with statistically elevated phishing abuse rates (Spamhaus/Interisle 2024).
// Used as a soft signal: alone → elevated AMBER; combined with squatting → raises confidence.
const HIGH_RISK_TLDS = new Set([
  'xyz', 'top', 'click', 'buzz', 'shop', 'live', 'online',
  'site', 'store', 'icu', 'fun', 'vip', 'work', 'cyou',
])

// Public hosting platforms that serve user-deployed subdomains.
const HOSTING_PLATFORMS = [
  'vercel.app', 'github.io', 'netlify.app', 'pages.dev',
  'web.app', 'firebaseapp.com', 'surge.sh', 'glitch.me', 'replit.dev',
]

function isCanonicalOrSubdomain(hostname: string, canonical: string): boolean {
  return hostname === canonical || hostname.endsWith('.' + canonical)
}

function checkKeywordSquatting(hostname: string): { brand: string } | null {
  const lower = hostname.toLowerCase()
  for (const [brand, canonicals] of Object.entries(BRAND_CANONICALS)) {
    if (!lower.includes(brand)) continue
    if (canonicals.some(c => isCanonicalOrSubdomain(lower, c))) continue
    return { brand }
  }
  return null
}

function checkHighRiskTld(hostname: string): string | null {
  const parts = hostname.toLowerCase().split('.')
  const tld = parts[parts.length - 1]
  return tld && HIGH_RISK_TLDS.has(tld) ? tld : null
}

function checkHostingPlatformSquat(hostname: string): { platform: string; brand: string } | null {
  const lower = hostname.toLowerCase()
  for (const platform of HOSTING_PLATFORMS) {
    if (!lower.endsWith('.' + platform)) continue
    const sub = lower.slice(0, lower.length - platform.length - 1)
    if (!sub) return null
    for (const brand of Object.keys(BRAND_CANONICALS)) {
      if (sub.includes(brand)) return { platform, brand }
    }
    return null
  }
  return null
}

// ─── Phase 2: RDAP domain-age detection ──────────────────────────────────────

/**
 * Extract the registrable root domain (last two labels).
 * "sub.example.xyz" → "example.xyz"
 * "example.com"     → "example.com"
 * For known SLDs (co.uk etc.) two labels is still acceptable — rdap.org
 * will 404 gracefully and rdapAgeCheck returns null.
 */
function extractRootDomain(hostname: string): string {
  const parts = hostname.toLowerCase().split('.')
  return parts.length >= 2 ? parts.slice(-2).join('.') : hostname.toLowerCase()
}

/**
 * Returns the domain's registration age in whole days, or null on any failure.
 * Result is cached under "domain:rdap:{rootDomain}" with DOMAIN_TTL.
 * Non-fatal: all errors return null so checkDomain() continues unaffected.
 */
async function rdapAgeCheck(hostname: string): Promise<number | null> {
  const root = extractRootDomain(hostname)
  const cacheKey = `domain:rdap:${root}`

  const cached = await cacheGet<number>(cacheKey)
  if (cached !== null) return cached

  try {
    const res = await fetch(`https://rdap.org/domain/${root}`, {
      headers: { Accept: 'application/rdap+json' },
      signal: AbortSignal.timeout(5_000),
    })
    if (!res.ok) return null

    const data = await res.json() as { events?: { eventAction: string; eventDate: string }[] }
    const regEvent = data.events?.find(e => e.eventAction === 'registration')
    if (!regEvent?.eventDate) return null

    const ageMs = Date.now() - new Date(regEvent.eventDate).getTime()
    const ageDays = Math.floor(ageMs / 86_400_000)

    await cacheSet(cacheKey, ageDays, DOMAIN_TTL)
    return ageDays
  } catch {
    return null
  }
}

export async function checkDomain(hostname: string): Promise<DomainRiskResult> {
  const cacheKey = `domain:risk:${hostname}`
  const cached = await cacheGet<DomainRiskResult>(cacheKey)
  if (cached) return cached

  // Fast-path: known canonical domains are always GREEN — check before any heuristics.
  const lowerHost = hostname.toLowerCase()
  for (const canonicals of Object.values(BRAND_CANONICALS)) {
    if (canonicals.some(c => isCanonicalOrSubdomain(lowerHost, c))) {
      const result: DomainRiskResult = { level: 'GREEN', reason: 'Verified legitimate domain.', confidence: 0.99, source: 'walour' }
      await cacheSet(cacheKey, result, DOMAIN_TTL)
      return result
    }
  }

  // DH-06: Fail-fast homoglyph check — definitive IDN homograph signal.
  if (hasHomoglyphRisk(hostname)) {
    const result: DomainRiskResult = {
      level: 'RED',
      reason: 'Domain contains non-ASCII or Punycode characters. Likely impersonating a known site.',
      confidence: 0.9,
      source: 'walour',
    }
    await cacheSet(cacheKey, result, DOMAIN_TTL)
    return result
  }

  // Phase 1 — synchronous hostname heuristics (zero-network).
  const hosting = checkHostingPlatformSquat(hostname)
  const squat   = checkKeywordSquatting(hostname)
  const riskTld = checkHighRiskTld(hostname)

  if (hosting) {
    const result: DomainRiskResult = {
      level: 'RED',
      reason: `Hosted on ${hosting.platform} with "${hosting.brand}" in the subdomain. Wallet brands do not deploy on public hosting platforms.`,
      confidence: 0.92,
      source: 'walour-heuristic',
    }
    await cacheSet(cacheKey, result, DOMAIN_TTL)
    return result
  }

  if (squat) {
    const result: DomainRiskResult = {
      level: 'RED',
      reason: riskTld
        ? `Hostname contains "${squat.brand}" but is not a canonical ${squat.brand} domain, and uses high-risk TLD .${riskTld}.`
        : `Hostname contains "${squat.brand}" but is not a canonical ${squat.brand} domain. Likely impersonation.`,
      confidence: riskTld ? 0.95 : 0.88,
      source: 'walour-heuristic',
    }
    await cacheSet(cacheKey, result, DOMAIN_TTL)
    return result
  }

  // Check corpus (faster than GoPlus).
  const corpusHit = await queryCorpus(hostname)
  if (corpusHit) {
    const result: DomainRiskResult = {
      level: 'RED',
      reason: `This domain is in the Walour threat registry (${corpusHit.source}, confidence ${(corpusHit.confidence * 100).toFixed(0)}%)`,
      confidence: corpusHit.confidence,
      source: corpusHit.source,
    }
    await cacheSet(cacheKey, result, DOMAIN_TTL)
    return result
  }

  // Fallback: GoPlus + RDAP run in parallel — zero extra latency.
  const [isPhishing, ageDays] = await Promise.all([
    goplusDomainCheck(hostname),
    rdapAgeCheck(hostname),
  ])

  const isNewDomain = ageDays !== null && ageDays < 14

  // Note: squat is always null in this fallback — Phase 1 returns early for any squat hit.
  // RDAP age combines only with riskTld here.
  const days = ageDays as number
  let result: DomainRiskResult
  if (isPhishing) {
    result = { level: 'RED', reason: 'This domain is flagged as a phishing site by GoPlus Security.', confidence: 0.85, source: 'goplus' }
  } else if (isNewDomain && riskTld) {
    // Age < 14d + high-risk TLD → RED
    result = { level: 'RED', reason: `Domain registered ${days} day${days === 1 ? '' : 's'} ago and uses high-risk TLD .${riskTld}.`, confidence: 0.75, source: 'walour-heuristic' }
  } else if (isNewDomain) {
    // Age < 14d alone → AMBER
    result = { level: 'AMBER', reason: `Domain registered ${days} day${days === 1 ? '' : 's'} ago. Treat with caution.`, confidence: 0.55, source: 'walour-heuristic' }
  } else if (riskTld) {
    result = { level: 'AMBER', reason: `High-risk TLD .${riskTld}. No known threats, but verify before signing.`, confidence: 0.35, source: 'walour-heuristic' }
  } else {
    result = { level: 'AMBER', reason: 'No threats detected. Domain unrecognized.', confidence: 0, source: undefined }
  }

  await cacheSet(cacheKey, result, DOMAIN_TTL)
  return result
}
