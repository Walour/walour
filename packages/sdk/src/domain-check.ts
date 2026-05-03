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
        const chainResult: ThreatReport = {
          address: pubkey,
          type: 'drainer', // default — full deserialization requires IDL
          source: 'chainabuse',
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

export async function checkDomain(hostname: string): Promise<DomainRiskResult> {
  const cacheKey = `domain:risk:${hostname}`
  const cached = await cacheGet<DomainRiskResult>(cacheKey)
  if (cached) return cached

  // DH-06: Fail-fast homoglyph check before corpus + GoPlus lookups.
  // Punycode (xn--) and raw non-ASCII characters are definitive IDN homograph signals.
  if (hasHomoglyphRisk(hostname)) {
    const result: DomainRiskResult = {
      level: 'RED',
      reason: 'Domain contains non-ASCII or Punycode characters — likely impersonating a known site',
      confidence: 0.9,
      source: 'walour',
    }
    await cacheSet(cacheKey, result, DOMAIN_TTL)
    return result
  }

  // Check corpus first (faster)
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

  // Fallback: GoPlus
  const isPhishing = await goplusDomainCheck(hostname)
  const result: DomainRiskResult = isPhishing
    ? { level: 'RED', reason: 'This domain is flagged as a phishing site by GoPlus Security.', confidence: 0.85, source: 'goplus' }
    : { level: 'GREEN', reason: 'No known threats found for this domain.', confidence: 0, source: undefined }

  await cacheSet(cacheKey, result, DOMAIN_TTL)
  return result
}
