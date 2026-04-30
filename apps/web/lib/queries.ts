import 'server-only'
import { getSupabase } from './supabase'
import type { StatsData, ThreatsResponse, ThreatRow, ProviderStatus } from './types'

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
