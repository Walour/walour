export const revalidate = 60

import LivePill from '@/components/ui/LivePill'
import StatGrid from '@/components/stats/StatGrid'
import TopThreatsTable from '@/components/stats/TopThreatsTable'
import { fetchStats } from '@/lib/queries'

export const metadata = {
  title: 'Live Stats — Walour',
  description: 'Network-wide threat activity updated continuously from the Walour oracle.',
}

export default async function StatsPage() {
  const { threatsTracked, drainsBlocked, solSaved, topThreats } = await fetchStats()

  return (
    <main>
      <div className="container" style={{ paddingTop: 60, paddingBottom: 80 }}>
        {/* Page header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
            marginBottom: 32,
          }}
        >
          <div>
            <h1 className="section-title">Oracle Stats</h1>
            <p className="section-sub">
              Live threat intelligence from the Walour oracle
            </p>
          </div>
          <LivePill />
        </div>

        {/* 3-column stat cards */}
        <StatGrid
          threatsTracked={threatsTracked}
          drainsBlocked={drainsBlocked}
          solSaved={solSaved}
        />

        {/* Top 10 threats table */}
        <TopThreatsTable threats={topThreats} />
      </div>
    </main>
  )
}
