import 'server-only'
import { getSupabase } from './supabase'
import type { StatsData, ThreatsResponse, ThreatRow, ProviderStatus } from './types'
import type { FeedEntry, FeedVerdict } from './feed'

const KNOWN_PROVIDERS = ['Helius', 'Triton', 'GoPlus', 'Claude', 'Upstash', 'Solana RPC'] as const

const MOCK_STATS: StatsData = {
  threatsTracked: 0,
  drainsBlocked: 0,
  solSaved: 0,
  topThreats: [],
  typeBreakdown: {},
  confidenceBuckets: [0, 0, 0, 0],
  providerHealth: KNOWN_PROVIDERS.map((p) => ({ provider: p, status: 'operational' })),
}

export async function fetchStats(): Promise<StatsData> {
  const supabase = getSupabase()
  if (!supabase) return MOCK_STATS

  const [
    threatsCount,
    drainsCount,
    solRows,
    topThreats,
    typeConfRows,
    outageRows,
  ] = await Promise.all([
    supabase.from('threat_reports').select('*', { count: 'exact', head: true }),
    supabase.from('drain_blocked_events').select('*', { count: 'exact', head: true }),
    supabase.from('drain_blocked_events').select('estimated_sol_saved').eq('confirmed', true),
    supabase
      .from('threat_reports')
      .select('address, type, confidence, last_updated, source')
      .order('confidence', { ascending: false })
      .limit(10),
    // Single query for type + confidence — avoids head:true+filter bug, counts all actual types
    supabase.from('threat_reports').select('type, confidence').limit(2000),
    // Provider health — gracefully handle missing outages table
    supabase.from('outages').select('provider, closed_at').limit(50),
  ])

  if (typeConfRows.error) {
    console.error('[fetchStats type+conf]', typeConfRows.error.message)
  }

  const solSaved = (solRows.data ?? []).reduce(
    (sum: number, row: { estimated_sol_saved: number }) => sum + (row.estimated_sol_saved ?? 0),
    0
  )

  const typeBreakdown: Record<string, number> = {}
  const confidenceBuckets: [number, number, number, number] = [0, 0, 0, 0]
  for (const row of (typeConfRows.data ?? []) as { type: string; confidence: number }[]) {
    // Accumulate type counts from whatever type strings actually exist in the DB
    if (row.type) {
      typeBreakdown[row.type] = (typeBreakdown[row.type] ?? 0) + 1
    }
    // Bucket confidence (stored as 0–1 float) into four quartile bands
    const pct = (row.confidence ?? 0) * 100
    if (pct <= 25) confidenceBuckets[0]++
    else if (pct <= 50) confidenceBuckets[1]++
    else if (pct <= 75) confidenceBuckets[2]++
    else confidenceBuckets[3]++
  }

  const degradedSet = new Set<string>()
  for (const row of outageRows.data ?? []) {
    const r = row as { provider: string; closed_at: string | null }
    if (r.closed_at === null) degradedSet.add(r.provider)
  }

  const providerHealth: ProviderStatus[] = KNOWN_PROVIDERS.map((p) => ({
    provider: p,
    status: degradedSet.has(p) ? 'degraded' : 'operational',
  }))

  return {
    threatsTracked: threatsCount.count ?? 0,
    drainsBlocked: drainsCount.count ?? 0,
    solSaved,
    topThreats: (topThreats.data ?? []) as ThreatRow[],
    typeBreakdown,
    confidenceBuckets,
    providerHealth,
  }
}


const BLOCK_REASON_STORY: Record<string, string> = {
  phishing_domain: 'Phishing dApp asked for unlimited SPL approval',
  malicious_token: 'Malicious mint disguised as an NFT claim',
  known_drainer: 'Known drainer contract masked as a token swap',
  ai_flagged_transfer: 'Hidden transfer instruction caught mid-sign',
  setauthority_detected: 'Token authority transfer to an unknown address',
  user_blocked: 'User refused to sign a flagged transaction',
  auto_blocked: 'Auto-blocked drainer attempt at signing',
}

const THREAT_TYPE_STORY: Record<string, string> = {
  drainer: 'Newly catalogued drainer address',
  rug: 'Rug-pull token added to the registry',
  phishing: 'Phishing site indexed from community reports',
  malicious_token: 'Malicious token surfaced from on-chain heuristics',
  phishing_domain: 'Phishing domain indexed from community reports',
}

function shortAddr(addr: string | null | undefined): string {
  if (!addr) return ''
  if (addr.length <= 10) return addr
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`
}

export async function fetchThreatFeed(limit = 6): Promise<FeedEntry[]> {
  const supabase = getSupabase()
  if (!supabase) return []

  const blockedTake = Math.max(1, Math.min(limit, 4))
  const drainedTake = Math.max(1, limit - blockedTake)

  const [blockedRows, threatRows] = await Promise.all([
    supabase
      .from('drain_blocked_events')
      .select('event_id, timestamp, block_reason, estimated_sol_saved')
      .eq('confirmed', true)
      .order('timestamp', { ascending: false })
      .limit(blockedTake),
    supabase
      .from('threat_reports')
      .select('address, type, last_updated, confidence')
      .gte('confidence', 0.6)
      .order('last_updated', { ascending: false })
      .limit(drainedTake),
  ])

  const entries: FeedEntry[] = []

  for (const row of (blockedRows.data ?? []) as Array<{
    event_id: string
    timestamp: number
    block_reason: string
    estimated_sol_saved: number | null
  }>) {
    const sol = row.estimated_sol_saved ?? 0
    entries.push({
      id: `blocked-${row.event_id}`,
      ts: Number(row.timestamp) || Date.now(),
      verdict: 'BLOCKED' as FeedVerdict,
      story: BLOCK_REASON_STORY[row.block_reason] ?? 'Drainer attempt blocked at signing',
      amount: sol > 0 ? `${sol.toFixed(1)} SOL` : undefined,
    })
  }

  for (const row of (threatRows.data ?? []) as Array<{
    address: string
    type: string
    last_updated: string
    confidence: number
  }>) {
    const ts = new Date(row.last_updated).getTime()
    const base = THREAT_TYPE_STORY[row.type] ?? 'New threat indexed in the registry'
    const tag = shortAddr(row.address)
    entries.push({
      id: `threat-${row.address}`,
      ts: Number.isFinite(ts) ? ts : Date.now(),
      verdict: 'DRAINED' as FeedVerdict,
      story: tag ? `${base} (${tag})` : base,
    })
  }

  entries.sort((a, b) => b.ts - a.ts)
  return entries.slice(0, limit)
}


export async function fetchThreats(
  page: number,
  search: string,
  type: string
): Promise<ThreatsResponse> {
  const supabase = getSupabase()
  if (!supabase) return { rows: [], total: 0 }

  const pageSize = 25
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('threat_reports')
    .select('address, type, confidence, last_updated, source', { count: 'exact' })
    .order('confidence', { ascending: false })
    .range(from, to)

  if (search) {
    query = query.ilike('address', `%${search}%`)
  }

  if (type && type !== 'all') {
    query = query.eq('type', type)
  }

  const { data, count, error } = await query

  if (error) {
    console.error('[fetchThreats]', error.message)
    return { rows: [], total: 0 }
  }

  return { rows: (data ?? []) as ThreatRow[], total: count ?? 0 }
}
