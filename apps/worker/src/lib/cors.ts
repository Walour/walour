/**
 * CORS helper for Walour worker endpoints.
 *
 * Allows:
 * - Any chrome-extension://... origin (unpacked dev + Chrome Web Store packed,
 *   since each user's unpacked install gets a different ID and we can't
 *   enumerate them ahead of time).
 * - Explicit web origins listed below (walour.io, walour.vercel.app, localhost
 *   for dev/demo).
 *
 * Trade-off: any chrome-extension is allowed, which means a malicious extension
 * could call the API. Mitigations: rate limits per IP, no auth tokens needed
 * (read-only scan/decode), constant-time auth on cron endpoints.
 *
 * In NODE_ENV=development we open everything to '*' for easier local testing.
 */

const WEB_ORIGIN_ALLOWLIST = new Set<string>([
  'https://walour.io',
  'https://www.walour.io',
  'https://walour.vercel.app',
])

const LOCALHOST_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/
const CHROME_EXT_RE = /^chrome-extension:\/\/[a-z]{32}$/

/**
 * Compute the Access-Control-Allow-Origin value for a given request.
 * Returns the exact origin to echo back, or '' if the origin is not allowed.
 *
 * Pass the result into your response headers. If '', omit Access-Control-*
 * headers and the browser will block the cross-origin response automatically.
 */
export function allowedOrigin(req: Request): string {
  if (process.env.NODE_ENV !== 'production') return '*'

  const origin = req.headers.get('Origin') ?? ''
  if (!origin) return ''

  // Any valid chrome-extension origin (32-char lowercase ID).
  if (CHROME_EXT_RE.test(origin)) return origin

  // Web allow-list.
  if (WEB_ORIGIN_ALLOWLIST.has(origin)) return origin

  // Localhost on any port (for local web/demo testing against prod worker).
  if (LOCALHOST_RE.test(origin)) return origin

  // Vercel preview deployments under walour-*.vercel.app
  if (/^https:\/\/walour-[a-z0-9-]+\.vercel\.app$/.test(origin)) return origin

  return ''
}

/**
 * Build a CORS headers object for a response. If the origin is not allowed,
 * returns headers WITHOUT Access-Control-Allow-Origin so the browser blocks
 * the response. The caller can still send the body — browser-side enforcement.
 */
export function corsHeaders(req: Request, methods = 'GET, OPTIONS'): Record<string, string> {
  const origin = allowedOrigin(req)
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': methods,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  }
  if (origin) headers['Access-Control-Allow-Origin'] = origin
  return headers
}

/**
 * Handle CORS preflight (OPTIONS) request. Returns a 200 response with
 * appropriate CORS headers, or a 204 if origin is not allowed.
 */
export function corsPreflight(req: Request, methods = 'GET, OPTIONS'): Response {
  return new Response(null, { status: 200, headers: corsHeaders(req, methods) })
}
