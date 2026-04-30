interface TypeDonutProps {
  typeBreakdown: Record<string, number>
}

const SEGMENT_META: Record<string, { label: string; color: string }> = {
  phishing_domain: { label: 'Phishing Domain', color: '#F97316' },
  drainer:         { label: 'Drainer',          color: '#EF4444' },
  malicious_token: { label: 'Malicious Token',  color: '#A855F7' },
  rug:             { label: 'Rug Pull',          color: '#F59E0B' },
}
const FALLBACK_COLORS = ['#6366F1', '#EC4899', '#14B8A6', '#84CC16']

export default function TypeDonut({ typeBreakdown }: TypeDonutProps) {
  // Build segments dynamically from whatever types are in the DB
  const entries = Object.entries(typeBreakdown).filter(([, v]) => v > 0)
  const total = entries.reduce((sum, [, v]) => sum + v, 0)

  let cursor = 0
  const stops = entries.map(([key, count], i) => {
    const meta = SEGMENT_META[key] ?? {
      label: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      color: FALLBACK_COLORS[i % FALLBACK_COLORS.length],
    }
    const pct = total > 0 ? (count / total) * 100 : 0
    const stop = { key, label: meta.label, color: meta.color, from: cursor, to: cursor + pct, count, pct }
    cursor += pct
    return stop
  })

  const gradient =
    stops.length === 0
      ? 'conic-gradient(var(--border) 0% 100%)'
      : `conic-gradient(${stops
          .map((s) => `${s.color} ${s.from.toFixed(2)}% ${s.to.toFixed(2)}%`)
          .join(', ')})`

  return (
    <div
      style={{
        padding: 20,
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border)',
        background: 'rgba(22, 27, 34, 0.55)',
        backdropFilter: 'blur(18px) saturate(140%)',
      }}
    >
      <p
        style={{
          margin: '0 0 16px',
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: 0.3,
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
        }}
      >
        Threat Type Breakdown
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
        {/* Donut */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div
            aria-label="Threat type donut chart"
            style={{
              width: 160,
              height: 160,
              borderRadius: '50%',
              background: gradient,
            }}
          />
          {/* Centre hole */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 88,
              height: 88,
              borderRadius: '50%',
              background: 'var(--surface)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
            }}
          >
            <span
              style={{
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: '-0.5px',
                lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
                color: 'var(--text)',
              }}
            >
              {total.toLocaleString()}
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 0.3 }}>
              total
            </span>
          </div>
        </div>

        {/* Legend */}
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            flex: 1,
            minWidth: 140,
          }}
        >
          {stops.map((s) => (
            <li key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: s.color, flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: 'var(--text)', flex: 1 }}>{s.label}</span>
              <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                {s.count.toLocaleString()}
                <span style={{ marginLeft: 4, opacity: 0.6 }}>({s.pct.toFixed(1)}%)</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
