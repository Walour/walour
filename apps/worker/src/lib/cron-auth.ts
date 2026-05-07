// Cron-class auth: require a Bearer token matching either WALOUR_CRON_SECRET
// (explicit, set by us) or CRON_SECRET (auto-injected by Vercel cron).
//
// Vercel cron jobs do NOT support custom Authorization headers in vercel.json;
// instead Vercel auto-injects the value of the CRON_SECRET env var as
// `Authorization: Bearer <CRON_SECRET>` on each scheduled invocation.
// See https://vercel.com/docs/cron-jobs/manage-cron-jobs#protecting-cron-jobs
//
// Deployment requirement: set BOTH `WALOUR_CRON_SECRET` and `CRON_SECRET` to
// the SAME value in the Vercel project env. Locally, `WALOUR_CRON_SECRET` in
// apps/worker/.env is sufficient (manual curl includes the header explicitly).
//
// Used by /api/purge, /api/promote, /api/ingest.

export interface CronAuthResult {
  ok: boolean
  response?: Response
}

function unauthorized(): Response {
  return new Response(
    JSON.stringify({ error: 'unauthorized' }),
    { status: 401, headers: { 'Content-Type': 'application/json' } }
  )
}

// Constant-time-ish comparison: short-circuit on length, then char-by-char XOR accumulator.
function bearerMatches(authHeader: string, secret: string): boolean {
  const expected = `Bearer ${secret}`
  if (authHeader.length !== expected.length) return false
  let mismatch = 0
  for (let i = 0; i < expected.length; i++) {
    mismatch |= authHeader.charCodeAt(i) ^ expected.charCodeAt(i)
  }
  return mismatch === 0
}

export function verifyCronSecret(req: Request): CronAuthResult {
  const walourSecret = process.env.WALOUR_CRON_SECRET
  const vercelSecret = process.env.CRON_SECRET

  if (!walourSecret && !vercelSecret) {
    console.error('[cron-auth] Neither WALOUR_CRON_SECRET nor CRON_SECRET configured — refusing all requests')
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ error: 'server misconfigured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      ),
    }
  }

  const auth = req.headers.get('authorization') ?? ''
  const ok =
    (walourSecret && bearerMatches(auth, walourSecret)) ||
    (vercelSecret && bearerMatches(auth, vercelSecret))

  if (!ok) return { ok: false, response: unauthorized() }
  return { ok: true }
}
