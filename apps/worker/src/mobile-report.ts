import { createClient } from '@supabase/supabase-js'

export const config = { runtime: 'edge' }

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const VALID_TYPES = new Set(['drainer', 'rug', 'phishing_domain', 'phishing', 'malicious_token'])
const rateLimit = new Map<string, number>()
const RATE_LIMIT_MS = 60_000

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeType(type: string): string {
  return type === 'phishing' ? 'phishing_domain' : type
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders })
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders })
  }

  let body: { target?: unknown; type?: unknown; evidenceUrl?: unknown; notes?: unknown }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400, headers: corsHeaders })
  }

  const target = readString(body.target)
  const type = readString(body.type)
  const evidenceUrl = readString(body.evidenceUrl) || null

  if (!target) return Response.json({ error: 'target is required' }, { status: 400, headers: corsHeaders })
  if (!VALID_TYPES.has(type)) {
    return Response.json({ error: 'type must be drainer, rug, phishing_domain, or malicious_token' }, { status: 400, headers: corsHeaders })
  }

  const now = Date.now()
  const previous = rateLimit.get(target)
  if (previous && now - previous < RATE_LIMIT_MS) {
    return Response.json({ error: `Please wait ${Math.ceil((RATE_LIMIT_MS - (now - previous)) / 1000)}s before reporting this again.` }, { status: 429, headers: corsHeaders })
  }
  rateLimit.set(target, now)

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !supabaseKey) {
    return Response.json({ error: 'Report service unavailable' }, { status: 503, headers: corsHeaders })
  }

  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })
  const { error } = await supabase.rpc('upsert_threat', {
    p_address: target,
    p_type: normalizeType(type),
    p_source: 'community',
    p_evidence_url: evidenceUrl,
    p_confidence_delta: 0.4,
  })

  if (error) {
    console.error('[mobile-report] upsert_threat failed:', error.message)
    return Response.json({ error: 'Failed to record report' }, { status: 500, headers: corsHeaders })
  }

  void body.notes
  return Response.json({ success: true }, { headers: corsHeaders })
}

