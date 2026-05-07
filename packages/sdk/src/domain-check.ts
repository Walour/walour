import { Connection, PublicKey } from '@solana/web3.js'
import { createHash } from 'crypto'
import { cacheGet, cacheSet } from './lib/cache'
import { getOracleConnection } from './lib/rpc'
import type { DomainRiskResult, ThreatReport } from './types'

const DOMAIN_TTL = 3_600   // 1h
const ADDRESS_TTL = 300    // 5 min
const CACHE_TTL = ADDRESS_TTL

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!

// H9 — only allow address strings that are safe to interpolate into a
// PostgREST URL. Solana base58 is `[1-9A-HJ-NP-Za-km-z]+` (32–44 chars);
// domain corpus rows reuse this column for hostnames so we widen the
// allow-list to the conservative PostgREST-safe charset spec'd in the
// audit (`[A-Za-z0-9._-]+`). Anything outside that set is rejected.
const POSTGREST_SAFE_KEY = /^[A-Za-z0-9._-]+$/

// H10 — RDAP root domain allow-list. Punycode `xn--` is fine because it
// only uses [a-z0-9-]; raw Unicode hostnames are rejected by hasHomoglyphRisk
// long before we get here.
const RDAP_ROOT_SAFE = /^[a-z0-9.-]+$/

async function queryCorpus(address: string): Promise<ThreatReport | null> {
  // H9 — fail-loud on anything that could URL-inject into PostgREST.
  if (!POSTGREST_SAFE_KEY.test(address) || address.length > 256) {
    console.warn('[walour/domain-check] queryCorpus rejected unsafe key:', address.slice(0, 64))
    return null
  }
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
      `https://api.gopluslabs.io/api/v1/phishing_site?url=${encodeURIComponent(hostname)}`,
      { signal: AbortSignal.timeout(5_000) }
    )
    const data = await res.json()
    return data?.result?.is_phishing_site === '1'
  } catch {
    return false
  }
}

// ─── On-chain ThreatReport decode ────────────────────────────────────────────
//
// IDL field order (target/idl/walour_oracle.json, ThreatReport struct, v1):
//   bytes  0..  8  : 8-byte Anchor account discriminator
//                    (sha256("account:ThreatReport")[0..8])
//   byte         8 : version (u8) — fail-loud if > 1
//   bytes  9.. 41  : address (Pubkey, 32) — what we filter on
//   byte        41 : threat_type enum tag (u8)
//   bytes 42.. 74  : source ([u8; 32])
//   bytes 74..202  : evidence_url ([u8; 128])
//   byte       202 : confidence (u8, 0..100)
//   bytes 203..211 : first_seen (i64 LE)
//   bytes 211..219 : last_updated (i64 LE)
//   bytes 219..223 : corroborations (u32 LE)
//   bytes 223..255 : first_reporter (Pubkey, 32)
//   byte       255 : bump (u8)
//
// If the on-chain layout changes, bump VERSION_SUPPORTED_MAX and add a
// new branch in decodeThreatReport — never silently widen the offsets.

const DISC_LEN = 8
const OFFSET_VERSION = DISC_LEN                     // 8
const OFFSET_ADDRESS = OFFSET_VERSION + 1           // 9
const OFFSET_THREAT_TYPE = OFFSET_ADDRESS + 32      // 41
const OFFSET_CONFIDENCE = OFFSET_THREAT_TYPE + 1 + 32 + 128  // 202
const OFFSET_FIRST_SEEN = OFFSET_CONFIDENCE + 1     // 203
const OFFSET_LAST_UPDATED = OFFSET_FIRST_SEEN + 8   // 211
const ACCOUNT_MIN_LEN = 256
const VERSION_SUPPORTED_MAX = 1

const THREAT_TYPES = ['drainer', 'rug', 'phishing_domain', 'malicious_token'] as const
type ThreatTypeStr = ThreatReport['type'] | `unknown_variant_${number}`

let _cachedDiscriminator: Buffer | null = null
function threatReportDiscriminator(): Buffer {
  if (!_cachedDiscriminator) {
    _cachedDiscriminator = createHash('sha256')
      .update('account:ThreatReport')
      .digest()
      .subarray(0, 8)
  }
  return _cachedDiscriminator
}

interface DecodedThreatReport {
  threatType: ThreatTypeStr
  confidence: number          // 0..1 normalized
  firstSeenIso: string
  lastUpdatedIso: string
}

function decodeThreatReport(
  data: Buffer | Uint8Array,
  programId: PublicKey,
  ownerPk: PublicKey
): DecodedThreatReport | null {
  const buf = Buffer.from(data)

  // H8 — owner must match the program.
  if (!ownerPk.equals(programId)) return null

  if (buf.length < ACCOUNT_MIN_LEN) return null

  // H8 — discriminator must match Anchor's account:ThreatReport hash.
  const expectedDisc = threatReportDiscriminator()
  if (!buf.subarray(0, DISC_LEN).equals(expectedDisc)) return null

  // M11 / version — fail-loud on unknown layouts.
  const version = buf.readUInt8(OFFSET_VERSION)
  if (version > VERSION_SUPPORTED_MAX) {
    console.warn(
      `[walour/domain-check] ThreatReport version ${version} > supported ${VERSION_SUPPORTED_MAX}; refusing to decode (SDK upgrade needed).`
    )
    return null
  }

  const typeIndex = buf.readUInt8(OFFSET_THREAT_TYPE)
  const knownType = THREAT_TYPES[typeIndex]
  let threatType: ThreatTypeStr
  if (knownType === undefined) {
    console.warn(`[walour/domain-check] Unknown ThreatType variant ${typeIndex}`)
    threatType = `unknown_variant_${typeIndex}`
  } else {
    threatType = knownType
  }

  const confRaw = buf.readUInt8(OFFSET_CONFIDENCE)
  const confidence = Math.min(1, Math.max(0, confRaw / 100))

  const firstSeenSecs = Number(buf.readBigInt64LE(OFFSET_FIRST_SEEN))
  const lastUpdatedSecs = Number(buf.readBigInt64LE(OFFSET_LAST_UPDATED))
  const safeIso = (secs: number): string => {
    if (!Number.isFinite(secs) || secs <= 0) return new Date().toISOString()
    try {
      return new Date(secs * 1000).toISOString()
    } catch {
      return new Date().toISOString()
    }
  }

  return {
    threatType,
    confidence,
    firstSeenIso: safeIso(firstSeenSecs),
    lastUpdatedIso: safeIso(lastUpdatedSecs),
  }
}

/**
 * Look up a Solana address in the on-chain oracle.
 *
 * Order of attempts:
 *  1. Authority fast-track PDA at `[b"threat", address]` (legacy seed,
 *     used by `authority_submit_report`). Single account fetch — cheapest.
 *  2. Namespaced community PDAs at `[b"threat", address, first_reporter]`
 *     queried via `getProgramAccounts` with a memcmp on the `address`
 *     field (offset = 9 — 8 disc + 1 version). Capped at 50 results to
 *     bound RPC cost. Aggregated by selecting the highest-confidence
 *     report.
 *
 * Both paths verify owner + Anchor discriminator + version.
 */
async function findOnChainReport(
  address: string,
  connection: Connection,
  programId: PublicKey
): Promise<DecodedThreatReport | null> {
  let pubkey: PublicKey
  try {
    pubkey = new PublicKey(address)
  } catch {
    return null
  }

  // Path 1 — authority fast-track legacy seed.
  try {
    const [authPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('threat'), pubkey.toBuffer()],
      programId
    )
    const authInfo = await connection.getAccountInfo(authPda, 'confirmed')
    if (authInfo) {
      const decoded = decodeThreatReport(authInfo.data, programId, authInfo.owner)
      if (decoded) return decoded
    }
  } catch (err) {
    console.warn('[walour/domain-check] authority PDA lookup failed:',
      err instanceof Error ? err.message : err)
  }

  // Path 2 — scan namespaced community reports via getProgramAccounts.
  try {
    const expectedDisc = threatReportDiscriminator()
    const accounts = await connection.getProgramAccounts(programId, {
      commitment: 'confirmed',
      filters: [
        { memcmp: { offset: 0, bytes: expectedDisc.toString('base64'), encoding: 'base64' } },
        // Filter on the `address` field — offset 9 (after disc + version),
        // matched as the base58 pubkey.
        { memcmp: { offset: OFFSET_ADDRESS, bytes: pubkey.toBase58() } },
      ],
    })

    if (accounts.length === 0) return null

    // Cap to 50 to bound aggregation cost on a hot path.
    const capped = accounts.slice(0, 50)

    let best: DecodedThreatReport | null = null
    for (const acc of capped) {
      const decoded = decodeThreatReport(acc.account.data, programId, acc.account.owner)
      if (!decoded) continue
      if (best === null || decoded.confidence > best.confidence) {
        best = decoded
      }
    }
    return best
  } catch (err) {
    console.warn('[walour/domain-check] getProgramAccounts scan failed:',
      err instanceof Error ? err.message : err)
    return null
  }
}

export async function lookupAddress(pubkey: string): Promise<ThreatReport | null> {
  // M9 — normalize cache key. Pubkeys are case-sensitive base58 so we
  // only trim whitespace; we do NOT lowercase here.
  const normalized = pubkey.trim()
  const cacheKey = `address:threat:${normalized}`
  const cached = await cacheGet<ThreatReport | null>(cacheKey)
  if (cached != null) return cached

  // 1. Supabase corpus lookup
  const report = await queryCorpus(normalized)
  if (report) {
    await cacheSet(cacheKey, report, ADDRESS_TTL)
    return report
  }

  // 2. On-chain PDA fallback. Uses `getOracleConnection()` so the cluster
  //    follows WALOUR_ORACLE_CLUSTER (default devnet) — this is decoupled
  //    from market-data RPC which stays on mainnet.
  if (process.env.WALOUR_PROGRAM_ID) {
    let programId: PublicKey
    try {
      programId = new PublicKey(process.env.WALOUR_PROGRAM_ID)
    } catch {
      console.warn('[walour/domain-check] WALOUR_PROGRAM_ID is not a valid base58 pubkey')
      await cacheSet(cacheKey, null, ADDRESS_TTL)
      return null
    }

    try {
      const connection = getOracleConnection()
      const decoded = await findOnChainReport(normalized, connection, programId)
      if (decoded) {
        const chainResult: ThreatReport = {
          address: normalized,
          // unknown_variant_<n> stays in the type to be visible upstream;
          // ThreatReport['type'] is a closed union so we widen via cast
          // only at this single boundary (no `any`).
          type: decoded.threatType as ThreatReport['type'],
          source: 'on-chain',
          confidence: decoded.confidence,
          first_seen: decoded.firstSeenIso,
          last_updated: decoded.lastUpdatedIso,
        }
        await cacheSet(cacheKey, chainResult, CACHE_TTL)
        return chainResult
      }
    } catch (err) {
      console.warn('[walour/domain-check] on-chain lookup failed:',
        err instanceof Error ? err.message : err)
    }
  }

  await cacheSet(cacheKey, null, ADDRESS_TTL)
  return null
}

// DH-06: IDN homograph detection.
//
// L7 — flag only when a single label mixes Latin and non-Latin scripts.
// Pure non-Latin labels (e.g. an all-Cyrillic domain) are not by themselves
// a homograph attack. Punycode `xn--` is always flagged because every legit
// .com/.org Solana brand we whitelist is pure Latin.
function hasHomoglyphRisk(hostname: string): boolean {
  if (hostname.includes('xn--')) return true
  for (const label of hostname.split('.')) {
    let hasLatin = false
    let hasNonLatin = false
    for (let i = 0; i < label.length; i++) {
      const code = label.charCodeAt(i)
      if (code <= 127) {
        // ASCII letters/digits/hyphen are the only "Latin" we care about.
        if ((code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a)) {
          hasLatin = true
        }
      } else {
        hasNonLatin = true
      }
      if (hasLatin && hasNonLatin) return true
    }
  }
  return false
}

// ─── Phase 1 hostname heuristics (sync, zero-network, zero-dependency) ───────

// Brand → canonical hostnames. Subdomains of any canonical pass.
const BRAND_CANONICALS: Record<string, string[]> = {
  walour:   ['walour.io'],
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

  // H10 — never let a hostile hostname craft an attacker-controlled URL.
  if (!RDAP_ROOT_SAFE.test(root) || root.length > 253) {
    console.warn('[walour/domain-check] rdapAgeCheck rejected unsafe root:', root.slice(0, 64))
    return null
  }

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
  // M9 — normalize cache key (lowercase + trim).
  const normalized = hostname.toLowerCase().trim()
  const cacheKey = `domain:risk:${normalized}`
  const cached = await cacheGet<DomainRiskResult>(cacheKey)
  if (cached) return cached

  // Fast-path: local development environments are always GREEN.
  if (normalized === 'localhost' || normalized === '127.0.0.1') {
    const result: DomainRiskResult = { level: 'GREEN', reason: 'Local development environment.', confidence: 1, source: 'walour' }
    await cacheSet(cacheKey, result, DOMAIN_TTL)
    return result
  }

  // Fast-path: known canonical domains are always GREEN — check before any heuristics.
  for (const canonicals of Object.values(BRAND_CANONICALS)) {
    if (canonicals.some(c => isCanonicalOrSubdomain(normalized, c))) {
      const result: DomainRiskResult = { level: 'GREEN', reason: 'Verified legitimate domain.', confidence: 0.99, source: 'walour' }
      await cacheSet(cacheKey, result, DOMAIN_TTL)
      return result
    }
  }

  // DH-06: Fail-fast homoglyph check — definitive IDN homograph signal.
  if (hasHomoglyphRisk(normalized)) {
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
  const hosting = checkHostingPlatformSquat(normalized)
  const squat   = checkKeywordSquatting(normalized)
  const riskTld = checkHighRiskTld(normalized)

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
  const corpusHit = await queryCorpus(normalized)
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
    goplusDomainCheck(normalized),
    rdapAgeCheck(normalized),
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
