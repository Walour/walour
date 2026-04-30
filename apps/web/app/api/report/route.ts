import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import type { ThreatType } from '@/lib/types'

export const runtime = 'nodejs'

const VALID_TYPES: ThreatType[] = ['drainer', 'rug', 'phishing', 'malicious_token']

// In-memory rate limit map: address → last submit epoch (ms)
const rateLimitMap = new Map<string, number>()
const RATE_LIMIT_MS = 60_000

interface ReportBody {
  address?: unknown
  type?: unknown
  evidenceUrl?: unknown
  notes?: unknown
}

export async function POST(req: NextRequest) {
  let body: ReportBody
  try {
    body = (await req.json()) as ReportBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const address = typeof body.address === 'string' ? body.address.trim() : ''
  const type = typeof body.type === 'string' ? body.type.trim() : ''
  const evidenceUrl = typeof body.evidenceUrl === 'string' ? body.evidenceUrl.trim() : null
  // notes accepted in body but not forwarded to upsert_threat (stored for future use)

  if (!address) {
    return NextResponse.json({ error: 'Address is required.' }, { status: 400 })
  }

  if (!VALID_TYPES.includes(type as ThreatType)) {
    return NextResponse.json(
      { error: `Type must be one of: ${VALID_TYPES.join(', ')}.` },
      { status: 400 }
    )
  }

  // Server-side rate limit (same-address, 60s window)
  const now = Date.now()
  const lastSubmit = rateLimitMap.get(address)
  if (lastSubmit !== undefined && now - lastSubmit < RATE_LIMIT_MS) {
    const secondsLeft = Math.ceil((RATE_LIMIT_MS - (now - lastSubmit)) / 1000)
    return NextResponse.json(
      { error: `Please wait ${secondsLeft}s before reporting this address again.` },
      { status: 429 }
    )
  }
  rateLimitMap.set(address, now)

  const supabase = getSupabase()
  if (!supabase) {
    return NextResponse.json({ error: 'Service temporarily unavailable.' }, { status: 503 })
  }

  // Supabase client has no generated schema; cast args to satisfy generic constraint.
  const rpcArgs = {
    p_address: address,
    p_type: type,
    p_source: 'community',
    p_confidence: 0.5,
    p_evidence_url: evidenceUrl || null,
  } as Parameters<typeof supabase.rpc>[1]

  const { error } = await supabase.rpc('upsert_threat', rpcArgs)

  if (error) {
    console.error('[POST /api/report] upsert_threat error:', error.message)
    return NextResponse.json({ error: 'Failed to record report. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
