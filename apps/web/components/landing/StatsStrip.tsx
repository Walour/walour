'use client'

import { useEffect, useState } from 'react'

interface StatsStripProps {
  threats: number
  drainsBlocked: number
  solSaved: number
}

type ColorKey = 'danger' | 'accent' | 'safe'

export default function StatsStrip({
  threats,
  drainsBlocked,
  solSaved,
}: StatsStripProps) {
  const [counts, setCounts] = useState({
    threats,
    drainsBlocked,
    solSaved,
  })
  const [flashIdx, setFlashIdx] = useState<number | null>(null)

  useEffect(() => {
    setCounts({ threats, drainsBlocked, solSaved })
  }, [threats, drainsBlocked, solSaved])

  useEffect(() => {
    const id = setInterval(() => {
      setCounts(prev => ({
        threats: prev.threats + Math.floor(Math.random() * 3),
        drainsBlocked: prev.drainsBlocked + Math.floor(Math.random() * 2),
        solSaved: prev.solSaved + Math.floor(Math.random() * 6),
      }))
      const which = Math.floor(Math.random() * 3)
      setFlashIdx(which)
      setTimeout(() => setFlashIdx(null), 400)
    }, 3500)

    return () => clearInterval(id)
  }, [])

  const cells: Array<{ value: string; label: string; color: ColorKey }> = [
    {
      value: counts.threats.toLocaleString(),
      label: 'Threats Tracked',
      color: 'danger',
    },
    {
      value: counts.drainsBlocked.toLocaleString(),
      label: 'Drains Blocked',
      color: 'accent',
    },
    {
      value: counts.solSaved.toLocaleString(),
      label: 'SOL Saved',
      color: 'safe',
    },
  ]

  return (
    <div className="container">
      <div
        className="stats-strip glass-subtle stats-strip-responsive"
        style={{
          borderRadius: 'var(--radius-md)',
          marginTop: 40,
          border: '1px solid var(--border)',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
        }}
      >
        {cells.map((cell, i) => (
          <div
            key={cell.label}
            className={`stats-strip-cell stats-cell-flash stats-cell-color-${cell.color}${
              flashIdx === i ? ' flashing' : ''
            }`}
            style={{
              padding: '22px 28px',
              borderRight:
                i < cells.length - 1 ? '1px solid var(--border)' : 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <span className="stats-number-lg">{cell.value}</span>
            <span className="stats-label-sm">{cell.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
