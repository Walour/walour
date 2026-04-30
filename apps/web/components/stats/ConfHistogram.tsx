interface ConfHistogramProps {
  confidenceBuckets: [number, number, number, number]
}

const BUCKET_LABELS = ['0–25%', '26–50%', '51–75%', '76–100%'] as const

export default function ConfHistogram({ confidenceBuckets }: ConfHistogramProps) {
  const maxVal = Math.max(...confidenceBuckets, 1)
  const BAR_HEIGHT = 120

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
        Confidence Distribution
      </p>

      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 12,
          height: BAR_HEIGHT + 40,
          paddingBottom: 0,
        }}
        role="img"
        aria-label="Confidence distribution bar chart"
      >
        {confidenceBuckets.map((count, i) => {
          const heightPx = maxVal > 0 ? Math.max(Math.round((count / maxVal) * BAR_HEIGHT), count > 0 ? 4 : 0) : 0
          // Full opacity for 76-100 bucket (index 3), reduced for lower
          const opacity = i === 3 ? 1 : 0.4 + i * 0.1

          return (
            <div
              key={BUCKET_LABELS[i]}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                height: BAR_HEIGHT + 40,
                justifyContent: 'flex-end',
              }}
            >
              {/* Count label */}
              <span
                style={{
                  fontSize: 12,
                  fontVariantNumeric: 'tabular-nums',
                  fontWeight: 600,
                  color: count > 0 ? 'var(--text)' : 'var(--text-disabled)',
                  lineHeight: 1,
                }}
              >
                {count.toLocaleString()}
              </span>

              {/* Bar */}
              <div
                style={{
                  width: '100%',
                  height: heightPx,
                  background: `rgba(0, 201, 167, ${opacity})`,
                  borderRadius: '3px 3px 0 0',
                  transition: 'height 0.4s ease',
                  minHeight: count > 0 ? 4 : 0,
                }}
              />

              {/* X-axis label */}
              <span
                style={{
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  whiteSpace: 'nowrap',
                  textAlign: 'center',
                  lineHeight: 1.3,
                  marginTop: 4,
                }}
              >
                {BUCKET_LABELS[i]}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
