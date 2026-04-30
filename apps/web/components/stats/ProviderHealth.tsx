import type { ProviderStatus } from '@/lib/types'

interface ProviderHealthProps {
  providers: ProviderStatus[]
}

export default function ProviderHealth({ providers }: ProviderHealthProps) {
  return (
    <div
      className="tile glass"
      style={{
        padding: 20,
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border)',
        marginBottom: 24,
      }}
    >
      {/* Title row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 16,
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: 0.3,
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
          }}
        >
          Provider Health
        </p>

        {/* "Live" badge */}
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '2px 8px',
            borderRadius: 'var(--radius-pill)',
            background: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid rgba(34, 197, 94, 0.2)',
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: 0.4,
            textTransform: 'uppercase',
            color: 'var(--safe)',
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--safe)',
              display: 'inline-block',
              animation: 'pulse 1.6s ease-in-out infinite',
            }}
          />
          Live
        </span>
      </div>

      {/* Pills strip */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        {providers.map(({ provider, status }) => {
          const isOk = status === 'operational'
          const dotColor = isOk ? 'var(--safe)' : 'var(--warning)'
          const statusLabel = isOk ? 'Operational' : 'Degraded'
          const statusColor = isOk ? 'var(--safe)' : 'var(--warning)'

          return (
            <div
              key={provider}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: 'var(--surface)',
                border: `1px solid ${isOk ? 'var(--border)' : 'rgba(245,158,11,0.35)'}`,
                borderRadius: 'var(--radius-pill)',
                padding: '8px 14px',
                minWidth: 0,
              }}
              role="status"
              aria-label={`${provider}: ${statusLabel}`}
            >
              {/* Status dot */}
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: dotColor,
                  flexShrink: 0,
                  boxShadow: isOk
                    ? '0 0 0 0 transparent'
                    : '0 0 6px rgba(245,158,11,0.6)',
                }}
              />

              {/* Provider name */}
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--text)',
                  whiteSpace: 'nowrap',
                }}
              >
                {provider}
              </span>

              {/* Status text */}
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: 0.2,
                  color: statusColor,
                  whiteSpace: 'nowrap',
                }}
              >
                {statusLabel}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
