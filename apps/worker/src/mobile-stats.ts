import { createClient } from '@supabase/supabase-js'

export const config = { runtime: 'edge' }

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders })
  if (req.method !== 'GET') {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders })
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !supabaseKey) {
    return Response.json({
      threatsTracked: 0,
      mobileScans: 0,
      reportsSubmitted: 0,
      lastCorpusSync: 'Unavailable',
    }, { headers: corsHeaders })
  }

  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })
  const [threats, mobileEvents, reports, latest] = await Promise.all([
    supabase.from('threat_reports').select('*', { count: 'exact', head: true }),
    supabase.from('drain_blocked_events').select('*', { count: 'exact', head: true }).eq('surface', 'mobile'),
    supabase.from('threat_reports').select('*', { count: 'exact', head: true }).eq('source', 'community'),
    supabase.from('threat_reports').select('last_updated').order('last_updated', { ascending: false }).limit(1),
  ])

  return Response.json({
    threatsTracked: threats.count ?? 0,
    mobileScans: mobileEvents.count ?? 0,
    reportsSubmitted: reports.count ?? 0,
    lastCorpusSync: latest.data?.[0]?.last_updated ?? 'Unknown',
  }, { headers: corsHeaders })
}

