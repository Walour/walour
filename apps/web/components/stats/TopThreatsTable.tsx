import Badge from '@/components/ui/Badge'
import ConfBar from '@/components/ui/ConfBar'
import type { ThreatRow, ThreatType } from '@/lib/types'

interface TopThreatsTableProps {
  threats: ThreatRow[]
}

// Gold / Silver / Bronze for top 3; rest use muted surface
const RANK_COLORS = ['#F59E0B', '#8B949E', '#B45309'] as const

function isValidType(type: string): type is ThreatType {
  return ['drainer', 'rug', 'phishing', 'malicious_token'].includes(type)
}

function truncateAddress(addr: string): string {
  // Domain names (contain a dot) are shown as-is; wallet addresses are truncated
  if (addr.includes('.')) return addr
  if (addr.length <= 12) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export default function TopThreatsTable({ threats }: TopThreatsTableProps) {
  return (
    <div className="table-card">
      {/* Card header */}
      <div
        style={{
          padding: '20px 20px 14px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, letterSpacing: '-0.2px' }}>
          Top 10 Threats by Confidence
        </h2>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Updated every 60s</span>
      </div>

      {threats.length === 0 ? (
        <div
          style={{
            padding: '48px 20px',
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: 14,
          }}
        >
          No threats indexed yet.
        </div>
      ) : (
        <table className="threats" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: 48 }}>#</th>
              <th>Address / Domain</th>
              <th>Type</th>
              <th style={{ minWidth: 180 }}>Confidence</th>
              <th style={{ whiteSpace: 'nowrap' }}>Last Updated</th>
            </tr>
          </thead>
          <tbody>
            {threats.map((row, i) => {
              const pct = Math.round(row.confidence * 100)
              const rankColor = i < 3 ? RANK_COLORS[i] : undefined
              const date = new Date(row.last_updated).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })

              return (
                <tr key={row.id ?? row.address}>
                  {/* Rank circle */}
                  <td>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        background: rankColor ? `${rankColor}22` : 'var(--border-subtle, #21262D)',
                        color: rankColor ?? 'var(--text-muted)',
                        fontSize: 12,
                        fontWeight: 700,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {i + 1}
                    </span>
                  </td>

                  {/* Address / Domain */}
                  <td>
                    <span className="mono" style={{ fontSize: 12, color: 'var(--text)' }}>
                      {truncateAddress(row.address)}
                    </span>
                  </td>

                  {/* Type badge */}
                  <td>
                    {isValidType(row.type) ? (
                      <Badge type={row.type} />
                    ) : (
                      <span className="badge">{row.type}</span>
                    )}
                  </td>

                  {/* Confidence bar */}
                  <td>
                    <ConfBar value={pct} />
                  </td>

                  {/* Last updated */}
                  <td style={{ color: 'var(--text-muted)', fontSize: 13, whiteSpace: 'nowrap' }}>
                    {date}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {/* Footer note */}
      <div
        style={{
          padding: '14px 20px',
          borderTop: `1px solid var(--border-subtle, #21262D)`,
          textAlign: 'center',
          fontSize: 13,
          color: 'var(--text-muted)',
        }}
      >
        Data refreshes every{' '}
        <span style={{ color: 'var(--accent)' }}>60 seconds</span>.
        Powered by <span style={{ color: 'var(--accent)' }}>Walour</span>.
      </div>
    </div>
  )
}
