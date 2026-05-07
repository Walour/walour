// Sliding-window rate limiter backed by Upstash Redis.
//
// Implementation: per-key Redis ZSET where each request adds an entry whose
// score is the current epoch-millis. ZREMRANGEBYSCORE evicts entries older
// than the window, then ZCARD counts what remains. A TTL on the key prevents
// orphans for idle clients.
//
// Falls open if Redis is unreachable (we never want a Redis outage to take the
// worker offline). When Upstash creds aren't configured (e.g. local dev without
// .env values), the limiter logs once and allows all requests.

import { Redis } from '@upstash/redis'
import type { IncomingMessage } from 'node:http'

let client: Redis | null = null
let warnedMissing = false

function getRedis(): Redis | null {
  if (client) return client
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.UPSTASH_REDIS_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.UPSTASH_REDIS_TOKEN
  if (!url || !token) {
    if (!warnedMissing) {
      console.warn('[rate-limit] Upstash credentials missing — rate limiting disabled')
      warnedMissing = true
    }
    return null
  }
  client = new Redis({ url, token })
  return client
}

export interface RateLimitResult {
  ok: boolean
  retryAfter: number // seconds until window slot frees up; 0 when allowed
  remaining: number  // approximate remaining quota in this window
}

/**
 * Resolve client IP from request headers. Vercel sets x-forwarded-for; localhost
 * falls through to the socket remote address. The first hop in x-forwarded-for
 * is the real client; later hops are proxies.
 */
export function clientIpFrom(req: { headers: IncomingMessage['headers']; socket?: { remoteAddress?: string } }): string {
  const xff = req.headers['x-forwarded-for']
  const xffStr = Array.isArray(xff) ? xff[0] : xff
  const first = xffStr?.split(',')[0]?.trim()
  if (first) return first
  return req.socket?.remoteAddress ?? 'unknown'
}

/**
 * Rate-limit by (route, ip). Sliding window of `windowSec` seconds, allowing
 * at most `max` requests. Fails open on Redis errors (logged).
 */
export async function enforceRateLimit(
  routeKey: string,
  ip: string,
  max: number,
  windowSec: number
): Promise<RateLimitResult> {
  const redis = getRedis()
  if (!redis) return { ok: true, retryAfter: 0, remaining: max }

  const key = `rl:${routeKey}:${ip}`
  const nowMs = Date.now()
  const windowMs = windowSec * 1000
  const cutoff = nowMs - windowMs

  try {
    // Evict old entries, add this one, count, set TTL — pipelined for one round-trip.
    const pipe = redis.pipeline()
    pipe.zremrangebyscore(key, 0, cutoff)
    // Member is unique-per-request; epoch-nanos approximation via "${nowMs}:${random}".
    pipe.zadd(key, { score: nowMs, member: `${nowMs}:${Math.random().toString(36).slice(2, 10)}` })
    pipe.zcard(key)
    pipe.expire(key, windowSec + 5)
    const results = await pipe.exec()
    // results[2] is the ZCARD count (post-add).
    const count = Number((results?.[2] as number | undefined) ?? 0)

    if (count > max) {
      // Look up the oldest score within the window so we know when a slot frees.
      const oldest = await redis.zrange<string[]>(key, 0, 0, { withScores: true })
      let retryAfter = windowSec
      if (oldest && oldest.length >= 2) {
        const oldestMs = Number(oldest[1])
        if (Number.isFinite(oldestMs)) {
          retryAfter = Math.max(1, Math.ceil((oldestMs + windowMs - nowMs) / 1000))
        }
      }
      return { ok: false, retryAfter, remaining: 0 }
    }

    return { ok: true, retryAfter: 0, remaining: Math.max(0, max - count) }
  } catch (err) {
    console.error('[rate-limit] Redis error — failing open:', err)
    return { ok: true, retryAfter: 0, remaining: max }
  }
}

/**
 * Build the standard 429 Response with Retry-After + cors-friendly headers.
 * Caller is responsible for spreading any route-specific CORS headers on top.
 */
export function rateLimitedResponse(retryAfter: number, extraHeaders: Record<string, string> = {}): Response {
  return new Response(
    JSON.stringify({ error: 'rate limit exceeded', retryAfter }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfter),
        ...extraHeaders,
      },
    }
  )
}
