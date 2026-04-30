import { getSupabase } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = getSupabase()
  if (!supabase) return NextResponse.json({ error: 'no supabase client' })

  const { data, error } = await supabase
    .from('threat_reports')
    .select('type, confidence')
    .limit(10)

  const distinctTypes = [...new Set((data ?? []).map((r: { type: string }) => r.type))]

  return NextResponse.json({ rowsReturned: data?.length ?? 0, error: error?.message ?? null, sample: data?.slice(0, 5), distinctTypes })
}
