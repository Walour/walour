'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

interface StatsStripProps {
  threats: number
  drainsBlocked: number
  solSaved: number
}

type ColorKey = 'danger' | 'accent' | 'safe'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function StatsStrip({
  threats,
  drainsBlocked,
  solSaved,
}: StatsStripProps) {
  const [counts, setCounts] = useState({ threats, drainsBlocked, solSaved })
  const [flashIdx, setFlashIdx] = useState<number | null>(null)

  useEffect(() => {
    setCounts({ threats, drainsBlocked, solSaved })
  }, [threats, drainsBlocked, solSaved])

  useEffect(() => {
    const flash = (idx: number) => {
      setFlashIdx(idx)
      setTimeout(() => setFlashIdx(null), 400)
    }

    const threatsSub = supabase
      .channel('threat_reports_count')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'threat_reports' }, () => {
        setCounts(prev => ({ ...prev, threats: prev.threats + 1 }))
        flash(0)
      })
      .subscribe()

    const drainsSub = supabase
      .channel('drain_blocked_events_count')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'drain_blocked_events' }, (payload) => {
        const sol = (payload.new as { estimated_sol_saved?: number })?.estimated_sol_saved ?? 0
        setCounts(prev => ({
          ...prev,
          drainsBlocked: prev.drainsBlocked + 1,
          solSaved: prev.solSaved + sol,
        }))
        flash(1)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(threatsSub)
      supabase.removeChannel(drainsSub)
    }
  }, [])

  const cells: Array<{ value: string; label: string; color: ColorKey }> = [
    {
      value: counts.threats.toLocaleString(),
      label: 'Threats Indexed On-Chain',
      color: 'danger',
    },
    {
      value: counts.drainsBlocked.toLocaleString(),
      label: 'Signings Blocked',
      color: 'accent',
    },
    {
      value: counts.solSaved.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      label: 'SOL Kept in Wallets',
      color: 'safe',
    },
  ]

  return (
    <div className="container" style={{ paddingBottom: 48 }}>
      <div
        className="stats-strip glass-subtle stats-strip-responsive"
        style={{
          borderRadius: 'var(--radius-md)',
          marginTop: 0,
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
