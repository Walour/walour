import { createClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TIMEOUT_MS = 55_000 // total budget; Vercel limit is 60s
const FETCH_TIMEOUT_MS = 15_000 // per-source HTTP timeout

const SOURCE_WEIGHTS: Record<string, number> = {
  chainabuse: 0.9,
  scam_sniffer: 0.85,
  community: 0.4,
  twitter: 0.3,
}

// Solana base58 alphabet excludes 0, O, I, l
const SOLANA_BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

// Allowed threat types (must match DB check constraint)
const VALID_TYPES = new Set(['drainer', 'rug', 'phishing_domain', 'malicious_token'])

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RawEntry {
  address: string
  type: string
  source: 'chainabuse' | 'scam_sniffer' | 'community' | 'twitter'
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

async function fetchChainabuse(): Promise<RawEntry[]> {
  const res = await withTimeout(
    fetch('https://www.chainabuse.com/api/reports/download?chain=SOL', {
      headers: { 'User-Agent': 'Walour-Ingest/1.0' },
    }),
    FETCH_TIMEOUT_MS
  )

  if (!res.ok) throw new Error(`Chainabuse HTTP ${res.status}`)

  const text = await res.text()
  const lines = text.split('\n').slice(1).filter(Boolean) // skip CSV header

  const entries: RawEntry[] = []
  for (const line of lines) {
    // Columns: address, type, evidence_url (order may vary — be defensive)
    const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''))
    const address = cols[0] ?? ''
    const rawType = cols[1] ?? ''
    const evidenceUrl = cols[2] ?? null

    entries.push({
      address,
      type: normaliseType(rawType),
      source: 'chainabuse',
      evidence_url: evidenceUrl || null,
    })
  }

  return entries
}

async function fetchScamSniffer(): Promise<RawEntry[]> {
  const res = await withTimeout(
    fetch('https://api.scamsniffer.io/v1/drainers?chain=solana&limit=500', {
      headers: { 'User-Agent': 'Walour-Ingest/1.0' },
    }),
    FETCH_TIMEOUT_MS
  )

  if (!res.ok) throw new Error(`ScamSniffer HTTP ${res.status}`)

  const data = await res.json() as { items?: Array<{ address?: string; report_url?: string; type?: string }> }

  return (data?.items ?? []).map(item => ({
    address: item.address ?? '',
    type: normaliseType(item.type),
    source: 'scam_sniffer' as const,
    evidence_url: item.report_url ?? null,
  }))
}

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

  const entries: RawEntry[] = []

  for (const tweet of data?.data ?? []) {
    const text = tweet.text ?? ''
    // Extract Solana addresses from tweet text using the base58 regex
    const addressMatches = text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/g) ?? []
    for (const address of addressMatches) {
      // Filter out common non-address base58 strings (short tokens, etc.)
      if (address.length < 32) continue
      const evidenceUrl = tweet.entities?.urls?.[0]?.expanded_url ?? null
      entries.push({
        address,
        type: 'drainer',
        source: 'twitter',
        evidence_url: evidenceUrl,
      })
    }
  }

  return entries
}

// ---------------------------------------------------------------------------
// Upsert + error logging
// ---------------------------------------------------------------------------

async function processEntries(
  supabase: ReturnType<typeof createClient>,
  entries: RawEntry[]
): Promise<{ processed: number; errorCount: number }> {
  let processed = 0
  const errorBatch: Array<{ source: string; payload: unknown; reason: string }> = []

  for (const entry of entries) {
    try {
      // Validate address
      if (!entry.address || !isValidSolanaAddress(entry.address)) {
        errorBatch.push({
          source: entry.source,
          payload: entry,
          reason: `invalid_address: "${entry.address}"`,
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
  supabase: ReturnType<typeof createClient>,
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
      await supabase
        .from('outages')
        .update({ closed_at: new Date().toISOString(), error_msg: msg })
        .eq('id', outageId)
        .catch(() => undefined)
    }

    return []
  }
}

// ---------------------------------------------------------------------------
// Vercel Edge Function handler
// ---------------------------------------------------------------------------

export default async function handler(_req: Request): Promise<Response> {
  const start = Date.now()

  const supabase = createClient(
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
        runSource(supabase, 'chainabuse', fetchChainabuse),
        runSource(supabase, 'scam_sniffer', fetchScamSniffer),
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
