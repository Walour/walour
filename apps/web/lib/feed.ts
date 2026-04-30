export type FeedVerdict = 'BLOCKED' | 'DRAINED'

export interface FeedEntry {
  id: string
  ts: number
  verdict: FeedVerdict
  story: string
  amount?: string
  // kept for backward compat
  address?: string
  eventType?: string
}

const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

function rand(n: number) { return Math.floor(Math.random() * n) }
function randBase58(len: number) {
  let s = ''
  for (let i = 0; i < len; i++) s += BASE58[rand(BASE58.length)]
  return s
}

export function generateAddress(): string {
  return `${randBase58(4)}...${randBase58(4)}`
}

const BLOCKED_STORIES = [
  'Fake airdrop site tried to drain a wallet',
  'Phishing dApp asked for unlimited SPL approval',
  'Spoofed Jupiter clone hid a transfer in the instruction',
  'Malicious mint disguised as an NFT claim',
  'Drainer contract masked as a token swap',
  'Fake Magic Eden listing tried to siphon SOL',
  'Cloned wallet popup asked for a blind signature',
  'Rug token tried to claim transfer authority',
  'Compromised Discord link triggered a drain attempt',
  'Fake staking page asked for account ownership',
  'Unknown contract tried to move every SPL token',
  'Counterfeit Phantom site requested a drainer signature',
]

const DRAINED_STORIES = [
  'Wallet approved a drainer two days before installing Walour',
  'User signed a drainer on a spoofed mint page',
  'Approval to a known drainer address went through',
  'Spoofed claim page collected the signature',
  'Copycat dApp collected a blind signature',
]

function pickStory(verdict: FeedVerdict): string {
  const list = verdict === 'BLOCKED' ? BLOCKED_STORIES : DRAINED_STORIES
  return list[rand(list.length)]
}

function pickVerdict(): FeedVerdict {
  return Math.random() < 0.82 ? 'BLOCKED' : 'DRAINED'
}

export function generateEntry(index: number): FeedEntry {
  const verdict = pickVerdict()
  const sol = (Math.random() * 80 + 0.5).toFixed(1)
  return {
    id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    ts: Date.now(),
    verdict,
    story: pickStory(verdict),
    amount: `${sol} SOL`,
  }
}

function generateSeedEntry(index: number, secondsAgo: number): FeedEntry {
  const verdict = pickVerdict()
  const sol = (Math.random() * 80 + 0.5).toFixed(1)
  return {
    id: `seed-${index}`,
    ts: Date.now() - secondsAgo * 1000,
    verdict,
    story: pickStory(verdict),
    amount: `${sol} SOL`,
  }
}

export const SEED_ENTRIES: FeedEntry[] = Array.from({ length: 12 }, (_, i) =>
  generateSeedEntry(i, (i + 1) * 11)
)

export function relativeTime(ts: number, now: number = Date.now()): string {
  const diff = Math.max(0, Math.floor((now - ts) / 1000))
  if (diff < 3) return 'just now'
  if (diff < 60) return `${diff}s ago`
  const m = Math.floor(diff / 60)
  if (m < 60) return `${m}m ago`
  return `${Math.floor(m / 60)}h ago`
}

export function scrambleAddress(final: string, progress: number): string {
  const len = final.length
  const revealCount = Math.floor(progress * len)
  let out = ''
  for (let i = 0; i < len; i++) {
    const ch = final[i]
    if (i < revealCount || ch === '.') out += ch
    else out += BASE58[rand(BASE58.length)]
  }
  return out
}
