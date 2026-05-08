export type FeedVerdict = 'BLOCKED' | 'DRAINED'

export interface FeedEntry {
  id: string
  ts: number
  verdict: FeedVerdict
  story: string
  amount?: string
}

export function relativeTime(ts: number, now: number = Date.now()): string {
  const diff = Math.max(0, Math.floor((now - ts) / 1000))
  if (diff < 3) return 'just now'
  if (diff < 60) return `${diff}s ago`
  const m = Math.floor(diff / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}
