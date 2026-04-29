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
      <div className="container">
        <h2 className="threat-scene-headline">
          <span style={{ color: 'var(--danger)' }}>$3.2M</span> drained from Solana wallets this month.
        </h2>
        <p className="threat-scene-sub">
          Most victims signed it themselves. Here&apos;s what&apos;s happening right now.
        </p>

        <div className="threat-layout">
          <div className="aggregate-rail">
            <div className="aggregate-cell glass-subtle">
              <div className="aggregate-value" style={{ color: 'var(--danger)' }}>
                <CountUp to={73} trigger={inView} />%
              </div>
              <div className="aggregate-label">
                Solana users exposed to malicious approvals
              </div>
            </div>
            <div className="aggregate-cell glass-subtle">
              <div className="aggregate-value" style={{ color: 'var(--warning)' }}>
                $3.2M
              </div>
              <div className="aggregate-label">
                Drained this month via approved transactions
              </div>
            </div>
            <div className="aggregate-cell glass-subtle">
              <div className="aggregate-value" style={{ color: 'var(--accent)' }}>
                <CountUp to={4} trigger={inView} />.2s
              </div>
              <div className="aggregate-label">
                Average Walour detection latency
              </div>
            </div>
          </div>

          <ThreatFeed />
        </div>
      </div>
    </section>
  )
}
