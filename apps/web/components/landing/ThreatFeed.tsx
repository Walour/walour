'use client'

import { useEffect, useState } from 'react'
import { FeedEntry, relativeTime } from '@/lib/feed'

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

function FeedRow({ entry, now }: { entry: FeedEntry; now: number }) {
  const blocked = entry.verdict === 'BLOCKED'
  return (
    <div
      className={`tf-row ${blocked ? 'tf-row-blocked' : 'tf-row-drained'}`}
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

export default function ThreatFeed({ entries }: { entries: FeedEntry[] }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  const visible = entries.slice(0, MAX_VISIBLE)
  const empty = visible.length === 0

  return (
    <div className="threat-feed-card">
      <div className="threat-feed-head">
        <span className="threat-feed-pulse" aria-hidden="true" />
        <span className="threat-feed-title">Live threat feed</span>
        <span className="threat-feed-sub">Solana · live from the Walour corpus</span>
      </div>
      <div className="threat-feed-list" role="list">
        {empty ? (
          <div className="tf-row" role="listitem">
            <div className="tf-body">
              <span className="tf-story">No recent activity in the corpus yet.</span>
            </div>
          </div>
        ) : (
          visible.map(e => <FeedRow key={e.id} entry={e} now={now} />)
        )}
      </div>
    </div>
  )
}
