import { createClient } from '@supabase/supabase-js'

export const config = { runtime: 'edge' }

interface MobileBlockedEvent {
  event_id?: unknown
  timestamp?: unknown
  wallet_pubkey?: unknown
  blocked_tx_hash?: unknown
  drainer_target?: unknown
  block_reason?: unknown
  app_version?: unknown
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders })
  }

  let body: MobileBlockedEvent
  try {
    body = await req.json() as MobileBlockedEvent
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400, headers: corsHeaders })
  }

  const eventId = readString(body.event_id)
  const blockReason = readString(body.block_reason)
  const timestamp = typeof body.timestamp === 'number' ? body.timestamp : Date.now()

  if (!eventId || !blockReason) {
    return Response.json(
      { error: 'event_id and block_reason are required' },
      { status: 400, headers: corsHeaders }
    )
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !supabaseKey) {
    return Response.json(
      { error: 'Telemetry service unavailable' },
      { status: 503, headers: corsHeaders }
    )
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  })

  const { error } = await supabase.from('drain_blocked_events').insert({
    event_id: eventId,
    timestamp,
    wallet_pubkey: readString(body.wallet_pubkey) ?? '',
    blocked_tx_hash: readString(body.blocked_tx_hash) ?? '',
    drainer_target: readString(body.drainer_target),
    block_reason: blockReason,
    estimated_sol_saved: 0,
    estimated_usd_saved: 0,
    confirmed: false,
    surface: 'mobile',
    app_version: readString(body.app_version) ?? '0.1.0',
  })

  if (error) {
    console.error('[mobile-blocked] Supabase insert failed:', error.message)
    return Response.json(
      { error: 'Failed to record blocked event' },
      { status: 500, headers: corsHeaders }
    )
  }

  return Response.json({ success: true }, { headers: corsHeaders })
}

