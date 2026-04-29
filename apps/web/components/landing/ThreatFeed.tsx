'use client'

import { useEffect, useRef, useState } from 'react'
import {
  FeedEntry,
  generateEntry,
  scrambleAddress,
  SEED_ENTRIES,
} from '@/lib/feed'

const MAX_VISIBLE = 8

function FeedRow({ entry }: { entry: FeedEntry }) {
  const [displayed, setDisplayed] = useState(() =>
    scrambleAddress(entry.address, 0)
  )

  useEffect(() => {
    const start = performance.now()
    const duration = 300
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      setDisplayed(scrambleAddress(entry.address, t))
      if (t < 1) raf = requestAnimationFrame(tick)
      else setDisplayed(entry.address)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [entry.address])

  const verdictClass =
    entry.verdict === 'BLOCKED'
      ? 'feed-verdict-blocked'
      : entry.verdict === 'DRAINED'
        ? 'feed-verdict-drained'
        : 'feed-verdict-safe'

  let verdictText = ''
  if (entry.verdict === 'BLOCKED') {
    verdictText = `→ BLOCKED${entry.amount ? ` +${entry.amount} saved` : ''}`
  } else if (entry.verdict === 'DRAINED') {
    verdictText = `→ DRAINED${entry.amount ? ` ${entry.amount}` : ''}`
  } else {
    verdictText = '→ SAFE'
  }

  return (
    <div className="feed-entry" suppressHydrationWarning>
      <span className="feed-ts" suppressHydrationWarning>
        {`> ${entry.ts}  [${entry.eventType}]`}
      </span>
      <span className="feed-event" suppressHydrationWarning>
        addr {displayed} · {entry.eventType}
      </span>
      <span className={`feed-verdict ${verdictClass}`}>{verdictText}</span>
    </div>
  )
}

export default function ThreatFeed() {
  const [entries, setEntries] = useState<FeedEntry[]>([])
  const counterRef = useRef(SEED_ENTRIES.length)

  useEffect(() => {
    setEntries(SEED_ENTRIES.slice(0, 5))

    let cancelled = false

    const tick = () => {
      if (cancelled) return
      const delay = 3000 + Math.random() * 2000
      const id = setTimeout(() => {
        if (cancelled) return
        const next = generateEntry(counterRef.current++)
        setEntries(prev => {
          const arr = [next, ...prev]
          return arr.slice(0, MAX_VISIBLE)
        })
        tick()
      }, delay)
      return id
    }

    tick()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="terminal">
      <div className="terminal-bar">
        <span className="t-dot t-dot-r" />
        <span className="t-dot t-dot-y" />
        <span className="t-dot t-dot-g" />
        <span className="terminal-label">walour-feed · live</span>
      </div>
      <div className="terminal-feed">
        {entries.map((entry, i) => (
          <FeedRow key={entry.id} entry={entry} />
        ))}
        <span className="term-cursor" />
      </div>
      <div className="scanline-overlay" aria-hidden="true" />
    </div>
  )
}
