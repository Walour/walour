import LivePill from '@/components/ui/LivePill'
import StatGrid from '@/components/stats/StatGrid'
import TopThreatsTable from '@/components/stats/TopThreatsTable'
import TypeDonut from '@/components/stats/TypeDonut'
import ConfHistogram from '@/components/stats/ConfHistogram'
import { fetchStats } from '@/lib/queries'

// Force dynamic rendering — never statically prerender at build time, where env
// vars may be absent and getSupabase() would return null → MOCK_STATS (empty
// typeBreakdown / zero confidenceBuckets), causing charts to be hidden forever.
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Live Stats | Walour',
  description: 'Network-wide threat activity updated continuously from the Walour oracle.',
}

export default async function StatsPage() {
  const {
    threatsTracked,
    drainsBlocked,
    solSaved,
    topThreats,
    typeBreakdown,
    confidenceBuckets,
  } = await fetchStats()

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

        {/* KPI cards */}
        <StatGrid
          threatsTracked={threatsTracked}
          drainsBlocked={drainsBlocked}
          solSaved={solSaved}
        />

        {/* Charts row — always shown; components handle empty-state internally */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 20,
            margin: '24px 0',
          }}
        >
          <TypeDonut typeBreakdown={typeBreakdown} isEmpty={!Object.values(typeBreakdown).some(v => v > 0)} />
          <ConfHistogram confidenceBuckets={confidenceBuckets} isEmpty={!confidenceBuckets.some(v => v > 0)} />
        </div>

        {/* Top 10 threats table */}
        <div style={{ marginTop: 24 }}>
          <TopThreatsTable threats={topThreats} />
        </div>
      </div>
    </main>
  )
}
