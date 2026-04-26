import { createClient } from '@supabase/supabase-js'

export const revalidate = 60

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ThreatRow {
  address: string
  type: string
  confidence: number
  last_updated: string
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function fetchStats() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  // Use service key server-side to bypass RLS for public stats reads
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Return mock data if Supabase not configured
  if (!supabaseUrl || !supabaseKey) {
    return {
      threatsTracked: 0,
      drainsBlocked: 0,
      solSaved: 0,
      topThreats: [] as ThreatRow[],
    }
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  const [threatsCount, drainsCount, solSaved, topThreats] = await Promise.all([
    supabase.from('threat_reports').select('*', { count: 'exact', head: true }),
    supabase.from('drain_blocked_events').select('*', { count: 'exact', head: true }),
    supabase
      .from('drain_blocked_events')
      .select('estimated_sol_saved')
      .eq('confirmed', true),
    supabase
      .from('threat_reports')
      .select('address, type, confidence, last_updated')
      .order('confidence', { ascending: false })
      .limit(10),
  ])

  const totalSol = (solSaved.data ?? []).reduce(
    (sum: number, row: { estimated_sol_saved: number }) => sum + (row.estimated_sol_saved ?? 0),
    0
  )

  return {
    threatsTracked: threatsCount.count ?? 0,
    drainsBlocked: drainsCount.count ?? 0,
    solSaved: totalSol,
    topThreats: (topThreats.data ?? []) as ThreatRow[],
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncateAddress(addr: string): string {
  if (addr.length <= 12) return addr
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`
}

function confidenceColor(confidence: number): string {
  if (confidence >= 0.7) return '#22C55E'
  if (confidence >= 0.4) return '#F59E0B'
  return '#EF4444'
}

function threatTypeBadge(type: string): string {
  const map: Record<string, string> = {
    drainer: '#EF4444',
    rug: '#F59E0B',
    phishing_domain: '#F97316',
    malicious_token: '#A855F7',
  }
  return map[type.toLowerCase()] ?? '#6B7280'
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default async function StatsPage() {
  const { threatsTracked, drainsBlocked, solSaved, topThreats } = await fetchStats()

  const cards = [
    { label: 'Threats Tracked', value: threatsTracked.toLocaleString() },
    { label: 'Drains Blocked', value: drainsBlocked.toLocaleString() },
    { label: 'SOL Saved', value: `${solSaved.toFixed(2)} SOL` },
  ]

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '48px 24px' }}>
      {/* Header */}
      <div style={{ marginBottom: 40 }}>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: '#00C9A7',
            margin: 0,
            letterSpacing: '-0.5px',
          }}
        >
          Walour
        </h1>
        <p style={{ color: '#8B949E', marginTop: 6, fontSize: 14 }}>
          Solana Security Oracle — live threat registry
        </p>
      </div>

      {/* Stat cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
          marginBottom: 40,
        }}
      >
        {cards.map((card) => (
          <div
            key={card.label}
            style={{
              backgroundColor: '#161B22',
              border: '1px solid #30363D',
              borderRadius: 10,
              padding: '24px 20px',
            }}
          >
            <div style={{ fontSize: 12, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {card.label}
            </div>
            <div
              style={{
                fontSize: 36,
                fontWeight: 700,
                color: '#E6EDF3',
                marginTop: 8,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {card.value}
            </div>
          </div>
        ))}
      </div>

      {/* Top threats table */}
      <div
        style={{
          backgroundColor: '#161B22',
          border: '1px solid #30363D',
          borderRadius: 10,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #30363D',
            fontSize: 14,
            fontWeight: 600,
            color: '#E6EDF3',
          }}
        >
          Top 10 Threats by Confidence
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ color: '#8B949E' }}>
              {['Address', 'Type', 'Confidence', 'Last Updated'].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: 'left',
                    padding: '10px 20px',
                    fontWeight: 500,
                    borderBottom: '1px solid #30363D',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {topThreats.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  style={{ padding: '24px 20px', color: '#8B949E', textAlign: 'center' }}
                >
                  No threats tracked yet.
                </td>
              </tr>
            ) : (
              topThreats.map((row, idx) => {
                const badgeColor = threatTypeBadge(row.type)
                const barColor = confidenceColor(row.confidence)
                const pct = Math.round(row.confidence * 100)
                const date = new Date(row.last_updated).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })

                return (
                  <tr
                    key={row.address}
                    style={{
                      borderBottom: idx < topThreats.length - 1 ? '1px solid #21262D' : 'none',
                    }}
                  >
                    {/* Address */}
                    <td style={{ padding: '12px 20px' }}>
                      <span
                        style={{
                          fontFamily: '"SF Mono", "Fira Code", monospace',
                          color: '#E6EDF3',
                          fontSize: 12,
                        }}
                      >
                        {truncateAddress(row.address)}
                      </span>
                    </td>

                    {/* Type badge */}
                    <td style={{ padding: '12px 20px' }}>
                      <span
                        style={{
                          backgroundColor: `${badgeColor}22`,
                          color: badgeColor,
                          border: `1px solid ${badgeColor}55`,
                          borderRadius: 4,
                          padding: '2px 8px',
                          fontSize: 11,
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                        }}
                      >
                        {row.type.replace('_', ' ')}
                      </span>
                    </td>

                    {/* Confidence bar */}
                    <td style={{ padding: '12px 20px', minWidth: 120 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div
                          style={{
                            flex: 1,
                            height: 6,
                            backgroundColor: '#30363D',
                            borderRadius: 3,
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${pct}%`,
                              height: '100%',
                              backgroundColor: barColor,
                              borderRadius: 3,
                            }}
                          />
                        </div>
                        <span style={{ color: barColor, fontSize: 12, fontWeight: 600, minWidth: 32 }}>
                          {pct}%
                        </span>
                      </div>
                    </td>

                    {/* Last updated */}
                    <td style={{ padding: '12px 20px', color: '#8B949E', fontSize: 12 }}>
                      {date}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <p style={{ marginTop: 32, fontSize: 12, color: '#484F58', textAlign: 'center' }}>
        Data refreshes every 60 seconds. Powered by{' '}
        <span style={{ color: '#00C9A7' }}>Walour</span> — Solana security infrastructure.
      </p>
    </main>
  )
}
