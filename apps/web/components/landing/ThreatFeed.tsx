'use client'

import { useEffect, useState } from 'react'
import { FeedEntry, generateEntry, SEED_ENTRIES, relativeTime } from '@/lib/feed'

const MAX_VISIBLE = 6

function WalourMark() {
  return (
    <svg width="12" height="13" viewBox="0 0 12 13" aria-hidden="true" className="walour-mark">
      <path
        d="M6 0.5L11.196 3.5V9.5L6 12.5L0.804 9.5V3.5L6 0.5Z"
        fill="rgba(0,201,167,0.15)"
        stroke="#00C9A7"
        strokeWidth="1"
      />
      <path
        d="M3.6 6.4L5.2 8L8.4 4.8"
        stroke="#00C9A7"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}

function FeedRow({ entry, now, isNew }: { entry: FeedEntry; now: number; isNew: boolean }) {
  const blocked = entry.verdict === 'BLOCKED'
  return (
    <div
      className={`tf-row ${blocked ? 'tf-row-blocked' : 'tf-row-drained'}${isNew ? ' tf-row-new' : ''}`}
      role="listitem"
    >
      <span className="tf-indicator" aria-hidden="true" />
      <div className="tf-body">
        <span className="tf-story">{entry.story}</span>
        {blocked && (
          <span className="tf-caught">
            <WalourMark />
            <span>caught by Walour</span>
          </span>
        )}
      </div>
      <div className="tf-meta">
        <span className={`tf-chip ${blocked ? 'tf-chip-blocked' : 'tf-chip-drained'}`}>
          {blocked ? 'BLOCKED' : 'DRAINED'}
          {entry.amount && (
            <span className="tf-amount">{blocked ? `+${entry.amount}` : `−${entry.amount}`}</span>
          )}
        </span>
        <span className="tf-time" suppressHydrationWarning>
          {relativeTime(entry.ts, now)}
        </span>
      </div>
    </div>
  )
}

export default function ThreatFeed() {
  const [entries, setEntries] = useState<FeedEntry[]>([])
  const [now, setNow] = useState(0)
  const [latestId, setLatestId] = useState<string | null>(null)

  useEffect(() => {
    setEntries(SEED_ENTRIES.slice(0, MAX_VISIBLE))
    setNow(Date.now())
  }, [])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    let cancelled = false
    let counter = SEED_ENTRIES.length
    let timeoutId: ReturnType<typeof setTimeout>

    const schedule = () => {
      timeoutId = setTimeout(() => {
        if (cancelled) return
        const next = generateEntry(counter++)
        setLatestId(next.id)
        setEntries(prev => [next, ...prev].slice(0, MAX_VISIBLE))
        schedule()
      }, 2800 + Math.random() * 2600)
    }
    schedule()
    return () => { cancelled = true; clearTimeout(timeoutId) }
  }, [])

  return (
    <div className="threat-feed-card">
      <div className="threat-feed-head">
        <span className="threat-feed-pulse" aria-hidden="true" />
        <span className="threat-feed-title">Live threat feed</span>
        <span className="threat-feed-sub">Solana mainnet · last 60s</span>
      </div>
      <div className="threat-feed-list" role="list">
        {entries.map(e => (
          <FeedRow key={e.id} entry={e} now={now} isNew={e.id === latestId} />
        ))}
      </div>
    </div>
  )
}
