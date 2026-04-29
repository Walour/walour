import { confColor } from '@/lib/tokens'

interface ConfBarProps {
  value: number
}

export default function ConfBar({ value }: ConfBarProps) {
  const color = confColor(value)
  const clamped = Math.min(100, Math.max(0, value))

  return (
    <div className="conf">
      <div className="conf-track">
        <div
          className="conf-fill"
          style={{ width: `${clamped}%`, background: color }}
        />
      </div>
      <span className="conf-pct" style={{ color }}>
        {clamped}%
      </span>
    </div>
  )
}
