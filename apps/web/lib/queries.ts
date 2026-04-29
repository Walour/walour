import 'server-only'
import { getSupabase } from './supabase'
import type { StatsData, ThreatsResponse, ThreatRow } from './types'

const MOCK_STATS: StatsData = {
  threatsTracked: 0,
  drainsBlocked: 0,
  solSaved: 0,
  topThreats: [],
}

export async function fetchStats(): Promise<StatsData> {
  const supabase = getSupabase()
  if (!supabase) return MOCK_STATS

  const [threatsCount, drainsCount, solRows, topThreats] = await Promise.all([
    supabase.from('threat_reports').select('*', { count: 'exact', head: true }),
    supabase.from('drain_blocked_events').select('*', { count: 'exact', head: true }),
    supabase
      .from('drain_blocked_events')
      .select('estimated_sol_saved')
      .eq('confirmed', true),
    supabase
      .from('threat_reports')
      .select('id, address, type, confidence, last_updated, source')
      .order('confidence', { ascending: false })
      .limit(10),
  ])

  const solSaved = (solRows.data ?? []).reduce(
    (sum: number, row: { estimated_sol_saved: number }) => sum + (row.estimated_sol_saved ?? 0),
    0
  )

  return {
    threatsTracked: threatsCount.count ?? 0,
    drainsBlocked: drainsCount.count ?? 0,
    solSaved,
    topThreats: (topThreats.data ?? []) as ThreatRow[],
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
    .select('id, address, type, confidence, last_updated, source', { count: 'exact' })
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
