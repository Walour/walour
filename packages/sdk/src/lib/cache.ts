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
  return getCache()?.get<T>(key) ?? null
}

export async function cacheSet<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  await getCache()?.set(key, value, { ex: ttlSeconds })
}
