'use client'

import { useInView } from '@/hooks/useInView'
import { useCountUp } from '@/hooks/useCountUp'
import ThreatFeed from './ThreatFeed'

function CountUp({ to, trigger }: { to: number; trigger: boolean }) {
  const v = useCountUp(to, 1600, trigger)
  return <>{v}</>
}

export default function ThreatScene() {
  const { ref, inView } = useInView<HTMLElement>({ threshold: 0.2 })

  return (
    <section ref={ref} className="threat-scene">
      <div className="container threat-scene-inner">
        <header className="threat-scene-header">
          <h2 className="threat-scene-headline">
            <span style={{ color: 'var(--danger)' }}>$3.2M</span> drained from Solana wallets this month.
          </h2>
          <p className="threat-scene-sub">
            Most victims signed it themselves. Here&apos;s what&apos;s happening right now.
          </p>
        </header>

        <div className="threat-stats-row">
          <div className="threat-stat">
            <div className="threat-stat-value" style={{ color: 'var(--danger)' }}>
              1 in <CountUp to={14} trigger={inView} />
            </div>
            <div className="threat-stat-label">wallets hit a drainer this month</div>
          </div>
          <div className="threat-stat-divider" aria-hidden="true" />
          <div className="threat-stat">
            <div className="threat-stat-value" style={{ color: 'var(--warning)' }}>
              $<CountUp to={847} trigger={inView} />
            </div>
            <div className="threat-stat-label">average loss per drained wallet</div>
          </div>
          <div className="threat-stat-divider" aria-hidden="true" />
          <div className="threat-stat">
            <div className="threat-stat-value" style={{ color: 'var(--accent)' }}>
              &lt;<CountUp to={400} trigger={inView} />ms
            </div>
            <div className="threat-stat-label">to warn you before you sign</div>
          </div>
        </div>

        <ThreatFeed />
      </div>
    </section>
  )
}
