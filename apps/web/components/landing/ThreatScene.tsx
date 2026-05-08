'use client'

import { useInView } from '@/hooks/useInView'
import { useCountUp } from '@/hooks/useCountUp'
import ThreatFeed from './ThreatFeed'
import type { FeedEntry } from '@/lib/feed'

function CountUp({ to, trigger }: { to: number; trigger: boolean }) {
  const v = useCountUp(to, 1600, trigger)
  return <>{v}</>
}

export default function ThreatScene({ feedEntries }: { feedEntries: FeedEntry[] }) {
  const { ref, inView } = useInView<HTMLElement>({ threshold: 0.2 })

  return (
    <section ref={ref} className="threat-scene">
      <div className="container threat-scene-inner">
        <header className="threat-scene-header">
          <h2 className="threat-scene-headline">
            Solana wallets lost over <span style={{ color: 'var(--danger)' }}>$8M</span> to drainers last month.
          </h2>
          <p className="threat-scene-sub">
            Almost every victim signed the transaction themselves. Here is what is hitting wallets right now.
          </p>
        </header>

        <div className="threat-stats-row">
          <div className="threat-stat">
            <div className="threat-stat-value" style={{ color: 'var(--danger)' }}>
              1 in <CountUp to={14} trigger={inView} />
            </div>
            <div className="threat-stat-label">wallets hit a drainer last month</div>
          </div>
          <div className="threat-stat-divider" aria-hidden="true" />
          <div className="threat-stat">
            <div className="threat-stat-value" style={{ color: 'var(--warning)' }}>
              $<CountUp to={1400} trigger={inView} />
            </div>
            <div className="threat-stat-label">average loss per drained wallet</div>
          </div>
          <div className="threat-stat-divider" aria-hidden="true" />
          <div className="threat-stat">
            <div className="threat-stat-value" style={{ color: 'var(--accent)' }}>
              &lt;<CountUp to={400} trigger={inView} />ms
            </div>
            <div className="threat-stat-label">to warn you before you sign it</div>
          </div>
        </div>

        <ThreatFeed entries={feedEntries} />
      </div>
    </section>
  )
}
