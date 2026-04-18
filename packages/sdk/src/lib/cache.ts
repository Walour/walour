import { Redis } from '@upstash/redis'

let client: Redis | null = null

export function getCache(): Redis {
  if (!client) {
    client = new Redis({
      url: process.env.UPSTASH_REDIS_URL!,
      token: process.env.UPSTASH_REDIS_TOKEN!,
    })
  }
  return client
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  return getCache().get<T>(key)
}

export async function cacheSet<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  await getCache().set(key, value, { ex: ttlSeconds })
}
