import StatCard from '@/components/ui/StatCard'

interface StatGridProps {
  threatsTracked: number
  drainsBlocked: number
  solSaved: number
}

// Icons are passed as ReactNode to StatCard's icon prop
function EyeIcon() {
  return (
    <span
      style={{
        width: 24,
        height: 24,
        borderRadius: 6,
        background: 'rgba(0, 201, 167, 0.1)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--accent)',
        flexShrink: 0,
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
      </svg>
    </span>
  )
}

function ShieldIcon() {
  return (
    <span
      style={{
        width: 24,
        height: 24,
        borderRadius: 6,
        background: 'rgba(0, 201, 167, 0.1)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--accent)',
        flexShrink: 0,
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    </span>
  )
}

function SolIcon() {
  return (
    <span
      style={{
        width: 24,
        height: 24,
        borderRadius: 6,
        background: 'rgba(0, 201, 167, 0.1)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--accent)',
        flexShrink: 0,
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    </span>
  )
}

export default function StatGrid({ threatsTracked, drainsBlocked, solSaved }: StatGridProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: 16,
        marginBottom: 40,
      }}
    >
      <StatCard
        label="Threats Tracked"
        value={threatsTracked.toLocaleString()}
        delta="+12 today"
        icon={<EyeIcon />}
        tickInterval={3500}
        tickMax={2}
      />
      <StatCard
        label="Drains Blocked"
        value={drainsBlocked.toLocaleString()}
        delta="+3 today"
        icon={<ShieldIcon />}
        tickInterval={4200}
        tickMax={1}
      />
      <StatCard
        label="SOL Saved"
        value={solSaved.toFixed(2)}
        delta="+12.5 SOL"
        icon={<SolIcon />}
        tickInterval={5000}
        tickMax={5}
      />
    </div>
  )
}
