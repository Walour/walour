import { createClient } from '@supabase/supabase-js'
import { adaptForVercel } from './lib/adapt'
import { verifyCronSecret } from './lib/cron-auth'
import { safeError } from './lib/safe-error'

async function handler(req: Request): Promise<Response> {
  // C3: method check — purge is a destructive write, only POST is allowed.
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json', 'Allow': 'POST' } }
    )
  }

  // C4: cron-class auth — only Vercel cron (with WALOUR_CRON_SECRET) may call this.
  const auth = verifyCronSecret(req)
  if (!auth.ok) return auth.response!

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )

  const start = Date.now()

  // Delete stale low-confidence entries that haven't been updated in 90 days
  const { error, count } = await supabase
    .from('threat_reports')
    .delete({ count: 'exact' })
    .lt('confidence', 0.2)
    .lt('last_updated', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())

  if (error) {
    return Response.json(
      { ok: false, error: safeError(error, 'purge failed') },
      { status: 500 }
    )
  }

  const purged = count ?? 0
  const duration_ms = Date.now() - start

  console.log(`[purge] Purged ${purged} stale threat_reports in ${duration_ms}ms`)

  return Response.json({ ok: true, purged, duration_ms })
}

export default adaptForVercel(handler)
