import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './types/supabase'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TIMEOUT_MS = 55_000 // total budget; Vercel limit is 60s
const FETCH_TIMEOUT_MS = 15_000 // per-source HTTP timeout

const SOURCE_WEIGHTS: Record<string, number> = {
  scam_sniffer: 0.85,
  goplus: 0.8,
  community: 0.4,
  twitter: 0.3,
}

// Solana base58 alphabet excludes 0, O, I, l
const SOLANA_BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
// Domain/hostname pattern for phishing_domain entries
const DOMAIN_RE = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/

// Allowed threat types (must match DB check constraint)
const VALID_TYPES = new Set(['drainer', 'rug', 'phishing_domain', 'malicious_token'])

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RawEntry {
  address: string
  type: string
  source: 'scam_sniffer' | 'goplus' | 'community' | 'twitter'
  evidence_url?: string | null
}

interface IngestResult {
  processed: number
  errors: number
  duration_ms: number
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function isValidSolanaAddress(addr: string): boolean {
  return SOLANA_BASE58_RE.test(addr)
}

function isValidDomain(addr: string): boolean {
  // Strip protocol prefix if present
  const host = addr.replace(/^https?:\/\//, '').split('/')[0].split('?')[0]
  return DOMAIN_RE.test(host) && host.includes('.')
}

function isValidEntry(entry: RawEntry): boolean {
  if (!entry.address) return false
  if (isValidSolanaAddress(entry.address)) return true
  // Also accept domains for phishing_domain type entries
  if (entry.type === 'phishing_domain' || normaliseType(entry.type) === 'phishing_domain') {
    return isValidDomain(entry.address)
  }
  return false
}

function normaliseType(raw: string | undefined | null): string {
  if (!raw) return 'drainer'
  const lower = raw.toLowerCase().trim()
  if (VALID_TYPES.has(lower)) return lower
  // Map common aliases
  if (lower.includes('rug')) return 'rug'
  if (lower.includes('phish') || lower.includes('domain')) return 'phishing_domain'
  if (lower.includes('token')) return 'malicious_token'
  return 'drainer'
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

function withTimeout(promise: Promise<Response>, ms: number): Promise<Response> {
  return Promise.race([
    promise,
    new Promise<Response>((_, reject) =>
      setTimeout(() => reject(new Error(`fetch timeout after ${ms}ms`)), ms)
    ),
  ])
}

// ---------------------------------------------------------------------------
// fetchScamSniffer — tries three URL paths in order
// 1. main/blacklist/solana.json  (original path)
// 2. main/solana/blacklist.json  (alternate layout)
// 3. api.scamsniffer.io fallback
// ---------------------------------------------------------------------------

// ScamSniffer all.json — contains 4k+ EVM addresses + 345k phishing domains
const SCAM_SNIFFER_ALL_URL = 'https://raw.githubusercontent.com/scamsniffer/scam-database/main/blacklist/all.json'
const SCAM_SNIFFER_DOMAIN_LIMIT = 60_000 // raised from 10k — full list is ~50k domains

async function fetchScamSniffer(): Promise<RawEntry[]> {
  const res = await withTimeout(
    fetch(SCAM_SNIFFER_ALL_URL, { headers: { 'User-Agent': 'Walour-Ingest/1.0' } }),
    FETCH_TIMEOUT_MS
  )

  if (!res.ok) throw new Error(`ScamSniffer HTTP ${res.status}`)

  const data = await res.json() as {
    address?: string[]
    domains?: string[]
  }

  const entries: RawEntry[] = []

  // Phishing domains — capped to avoid timeout
  const domains = (data.domains ?? []).slice(0, SCAM_SNIFFER_DOMAIN_LIMIT)
  for (const d of domains) {
    if (typeof d === 'string' && d.length > 3) {
      entries.push({ address: d, type: 'phishing_domain', source: 'scam_sniffer', evidence_url: null })
    }
  }

  console.log(`[ingest] ScamSniffer: ${entries.length} phishing domains`)
  return entries
}

// ---------------------------------------------------------------------------
// fetchGoPlus — GoPlus Security known-malicious Solana addresses
// Endpoint: GET https://api.gopluslabs.io/api/v1/solana_security/known_malicious?limit=500
// Returns confidence weight 0.8 (corroborating source — see SOURCE_WEIGHTS)
// ---------------------------------------------------------------------------

// Known high-risk Solana token mints to seed GoPlus lookups
// These are well-documented Solana meme/scam tokens with public risk data
const GOPLUS_SEED_MINTS = [
  'So11111111111111111111111111111111111111112', // wSOL (baseline — should return low risk)
]

async function fetchGoPlus(): Promise<RawEntry[]> {
  // GoPlus correct Solana endpoint: /api/v1/token_security/solana
  // Takes comma-separated contract addresses, returns per-address risk data
  if (GOPLUS_SEED_MINTS.length === 0) return []

  const addresses = GOPLUS_SEED_MINTS.join(',')
  // Correct GoPlus Solana endpoint: /api/v1/solana/token_security (not /api/v1/token_security/solana)
  // Pass GOPLUS_API_KEY as apikey query param if set (raises rate limits on authenticated tier)
  const apiKeyParam = process.env.GOPLUS_API_KEY ? `&apikey=${process.env.GOPLUS_API_KEY}` : ''
  const res = await withTimeout(
    fetch(`https://api.gopluslabs.io/api/v1/solana/token_security?contract_addresses=${addresses}${apiKeyParam}`, {
      headers: { 'User-Agent': 'Walour-Ingest/1.0', Accept: 'application/json' },
    }),
    FETCH_TIMEOUT_MS
  )

  if (!res.ok) throw new Error(`GoPlus HTTP ${res.status}`)

  // GoPlus /api/v1/solana/token_security returns nested objects for each risk attribute.
  // status "1" means the authority/feature is active (risky); "0" means disabled (safe).
  const json = await res.json() as {
    result?: Record<string, {
      mintable?: { status?: string }
      freezable?: { status?: string }
      transfer_fee?: { status?: string }
      metadata_mutable?: { status?: string }
      trusted_token?: number
    }>
  }

  const entries: RawEntry[] = []
  for (const [addr, data] of Object.entries(json?.result ?? {})) {
    // Skip tokens explicitly marked trusted (e.g. wSOL)
    if (data.trusted_token === 1) continue

    // Flag as malicious_token if any high-risk attribute is active
    const isRisky =
      data.mintable?.status === '1' ||
      data.freezable?.status === '1' ||
      data.transfer_fee?.status === '1'

    if (isRisky) {
      entries.push({
        address: addr,
        type: 'malicious_token',
        source: 'goplus' as const,
        evidence_url: null,
      })
    }
  }

  return entries
}

// ---------------------------------------------------------------------------
// fetchTwitter — requires TWITTER_BEARER_TOKEN (optional source)
// ---------------------------------------------------------------------------

async function fetchTwitter(): Promise<RawEntry[]> {
  const bearerToken = process.env.TWITTER_BEARER_TOKEN
  if (!bearerToken) {
    console.warn('[ingest] TWITTER_BEARER_TOKEN not set — skipping Twitter source')
    return []
  }

  // Twitter v2 recent search — look for Solana scam address reports
  const query = encodeURIComponent(
    '(solana OR sol) (scam OR drainer OR rug) -is:retweet lang:en has:links'
  )
  const url = `https://api.twitter.com/2/tweets/search/recent?query=${query}&max_results=100&tweet.fields=entities,author_id`

  const res = await withTimeout(
    fetch(url, {
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        'User-Agent': 'Walour-Ingest/1.0',
      },
    }),
    FETCH_TIMEOUT_MS
  )

  if (!res.ok) throw new Error(`Twitter API HTTP ${res.status}`)

  const data = await res.json() as {
    data?: Array<{ text?: string; entities?: { urls?: Array<{ expanded_url?: string }> } }>
  }

  const rawEntries: RawEntry[] = []

  for (const tweet of data?.data ?? []) {
    const text = tweet.text ?? ''
    // Extract Solana addresses from tweet text using the base58 regex
    const addressMatches = text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/g) ?? []
    for (const address of addressMatches) {
      if (address.length < 32) continue
      const evidenceUrl = tweet.entities?.urls?.[0]?.expanded_url ?? null
      rawEntries.push({
        address,
        type: 'drainer',
        source: 'twitter',
        evidence_url: evidenceUrl,
      })
    }
  }

  return rawEntries
}

// ---------------------------------------------------------------------------
// Upsert + error logging
// ---------------------------------------------------------------------------

async function processEntries(
  supabase: SupabaseClient<Database>,
  entries: RawEntry[]
): Promise<{ processed: number; errorCount: number }> {
  let processed = 0
  const errorBatch: Array<{ source: string; payload: unknown; reason: string }> = []

  for (const entry of entries) {
    try {
      // Validate address or domain
      if (!entry.address || !isValidEntry(entry)) {
        errorBatch.push({
          source: entry.source,
          payload: entry,
          reason: `invalid_address_or_domain: "${entry.address}"`,
        })
        continue
      }

      // Validate type
      const threatType = normaliseType(entry.type)

      // Validate source
      if (!(entry.source in SOURCE_WEIGHTS)) {
        errorBatch.push({
          source: entry.source,
          payload: entry,
          reason: `unknown_source: "${entry.source}"`,
        })
        continue
      }

      const weight = SOURCE_WEIGHTS[entry.source]

      const { error } = await supabase.rpc('upsert_threat', {
        p_address: entry.address,
        p_type: threatType,
        p_source: entry.source,
        p_evidence_url: entry.evidence_url ?? null,
        p_confidence_delta: weight,
      })

      if (error) {
        errorBatch.push({
          source: entry.source,
          payload: entry,
          reason: error.message,
        })
        continue
      }

      processed++
    } catch (err) {
      errorBatch.push({
        source: entry.source,
        payload: entry,
        reason: err instanceof Error ? err.message : String(err),
      })
    }
  }

  // Flush error batch to DB (fire-and-forget; never crash if this fails)
  if (errorBatch.length > 0) {
    supabase
      .from('ingestion_errors')
      .insert(errorBatch)
      .then(({ error }) => {
        if (error) console.error('[ingest] Failed to persist ingestion_errors:', error.message)
      })
      .catch(e => console.error('[ingest] ingestion_errors insert threw:', e))
  }

  return { processed, errorCount: errorBatch.length }
}

// ---------------------------------------------------------------------------
// Source runner — never throws; records outage on failure
// ---------------------------------------------------------------------------

async function runSource(
  supabase: SupabaseClient<Database>,
  name: string,
  fetcher: () => Promise<RawEntry[]>
): Promise<RawEntry[]> {
  let outageId: string | null = null

  try {
    // Open speculative outage record; close it on success
    const { data: outage } = await supabase
      .from('outages')
      .insert({ provider: name, error_msg: 'in_progress' })
      .select('id')
      .single()
    outageId = outage?.id ?? null

    const entries = await fetcher()

    // Close outage — source succeeded
    if (outageId) {
      await supabase
        .from('outages')
        .update({ closed_at: new Date().toISOString(), error_msg: null })
        .eq('id', outageId)
    }

    console.log(`[ingest] ${name}: fetched ${entries.length} raw entries`)
    return entries
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[ingest] ${name} source failed — skipping: ${msg}`)

    // Update outage with actual error
    if (outageId) {
      try {
        await supabase
          .from('outages')
          .update({ closed_at: new Date().toISOString(), error_msg: msg })
          .eq('id', outageId)
      } catch { /* non-fatal */ }
    }

    return []
  }
}

// ---------------------------------------------------------------------------
// Vercel Node.js Function handler
// ---------------------------------------------------------------------------

import { adaptForVercel } from './lib/adapt'

async function handler(_req: Request): Promise<Response> {
  const start = Date.now()

  const supabase = createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )

  // Race all sources against the global timeout budget
  const deadline = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('global timeout')), TIMEOUT_MS)
  )

  let allEntries: RawEntry[]

  try {
    allEntries = await Promise.race([
      Promise.all([
        runSource(supabase, 'scam_sniffer', fetchScamSniffer),
        runSource(supabase, 'goplus', fetchGoPlus),
        runSource(supabase, 'twitter', fetchTwitter),
      ]).then(results => results.flat()),
      deadline,
    ])
  } catch (err) {
    // Global timeout — process whatever we have
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[ingest] Aborted fetch phase: ${msg}`)
    allEntries = []
  }

  // Deduplicate by address (last-write wins for evidence_url; keep highest weight source)
  const seen = new Map<string, RawEntry>()
  for (const entry of allEntries) {
    const existing = seen.get(entry.address)
    if (!existing || (SOURCE_WEIGHTS[entry.source] ?? 0) > (SOURCE_WEIGHTS[existing.source] ?? 0)) {
      seen.set(entry.address, entry)
    }
  }
  const deduped = Array.from(seen.values())

  console.log(`[ingest] ${allEntries.length} raw entries -> ${deduped.length} after dedup`)

  const { processed, errorCount } = await processEntries(supabase, deduped)

  const result: IngestResult = {
    processed,
    errors: errorCount,
    duration_ms: Date.now() - start,
  }

  console.log('[ingest] Complete:', result)

  return Response.json(result)
}

export default adaptForVercel(handler)
