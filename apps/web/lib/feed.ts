export type FeedVerdict = 'BLOCKED' | 'DRAINED' | 'SAFE'

export interface FeedEntry {
  id: string
  ts: string
  verdict: FeedVerdict
  address: string
  eventType: string
  amount?: string
}

const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

const EVENT_TYPES_BLOCKED = [
  'drain attempt',
  'malicious approval',
  'unlimited SPL approve',
  'rug pull token',
  'phishing signature',
  'fake mint request',
]
const EVENT_TYPES_DRAINED = [
  'wallet drained',
  'unauthorized transfer',
  'rug confirmed',
]
const EVENT_TYPES_SAFE = [
  'verified contract',
  'whitelisted dApp',
  'safe approval',
]

function rand(n: number) {
  return Math.floor(Math.random() * n)
}

function randBase58(len: number) {
  let s = ''
  for (let i = 0; i < len; i++) s += BASE58[rand(BASE58.length)]
  return s
}

export function generateAddress(): string {
  return `${randBase58(4)}...${randBase58(4)}`
}

function generateAmount(verdict: FeedVerdict): string | undefined {
  if (verdict === 'SAFE') return undefined
  const amount = (Math.random() * 80 + 0.5).toFixed(1)
  return `${amount} SOL`
}

function pickEvent(verdict: FeedVerdict): string {
  const list =
    verdict === 'BLOCKED'
      ? EVENT_TYPES_BLOCKED
      : verdict === 'DRAINED'
        ? EVENT_TYPES_DRAINED
        : EVENT_TYPES_SAFE
  return list[rand(list.length)]
}

function pickVerdict(): FeedVerdict {
  const r = Math.random()
  if (r < 0.78) return 'BLOCKED'
  if (r < 0.9) return 'SAFE'
  return 'DRAINED'
}

function pad2(n: number) {
  return n.toString().padStart(2, '0')
}

function timestampForOffset(offsetSeconds: number): string {
  const now = new Date(Date.now() - offsetSeconds * 1000)
  return `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`
}

export function generateEntry(index: number): FeedEntry {
  const verdict = pickVerdict()
  return {
    id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    ts: timestampForOffset(0),
    verdict,
    address: generateAddress(),
    eventType: pickEvent(verdict),
    amount: generateAmount(verdict),
  }
}

function generateSeedEntry(index: number, secondsAgo: number): FeedEntry {
  const verdict = pickVerdict()
  return {
    id: `seed-${index}`,
    ts: timestampForOffset(secondsAgo),
    verdict,
    address: generateAddress(),
    eventType: pickEvent(verdict),
    amount: generateAmount(verdict),
  }
}

export const SEED_ENTRIES: FeedEntry[] = Array.from({ length: 25 }, (_, i) =>
  generateSeedEntry(i, (i + 1) * 7)
)

export function scrambleAddress(final: string, progress: number): string {
  const len = final.length
  const revealCount = Math.floor(progress * len)
  let out = ''
  for (let i = 0; i < len; i++) {
    const ch = final[i]
    if (i < revealCount || ch === '.') {
      out += ch
    } else {
      out += BASE58[rand(BASE58.length)]
    }
  }
  return out
}
