import { Redis } from '@upstash/redis'

let client: Redis | null = null

function getCache(): Redis | null {
  if (!client) {
    const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.UPSTASH_REDIS_URL
    const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.UPSTASH_REDIS_TOKEN
    if (!url || !token) return null
    client = new Redis({ url, token })
  }
  return client
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const cache = getCache()
  if (!cache) {
    console.warn('[walour/cache] Redis unavailable — skipping cache read for:', key)
    return null
  }
  return cache.get<T>(key)
}

export async function cacheSet<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  const cache = getCache()
  if (!cache) {
    console.warn('[walour/cache] Redis unavailable — skipping cache write for:', key)
    return
  }
  await cache.set(key, value, { ex: ttlSeconds })
}
