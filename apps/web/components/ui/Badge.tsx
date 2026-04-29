import { THREAT_CSS_CLASS, THREAT_TYPE_LABELS } from '@/lib/tokens'

interface BadgeProps {
  type: 'drainer' | 'rug' | 'phishing' | 'malicious_token'
}

export default function Badge({ type }: BadgeProps) {
  const cssClass = THREAT_CSS_CLASS[type]
  const label = THREAT_TYPE_LABELS[type]

  return (
    <span className={`badge ${cssClass}`}>
      {label}
    </span>
  )
}
