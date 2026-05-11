export const tokens = {
  accent: '#00C9A7',
  accentDark: '#00967D',
  bg: '#0D1117',
  surface: '#161B22',
  border: '#30363D',
  text: '#E6EDF3',
  textMuted: '#8B949E',
  safe: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
  phishing: '#F97316',
  token: '#A855F7',
} as const

export function confColor(value: number): string {
  if (value >= 75) return tokens.danger
  if (value >= 55) return tokens.warning
  return tokens.safe
}

export const THREAT_TYPE_LABELS: Record<string, string> = {
  drainer: 'Drainer',
  rug: 'Rug',
  phishing_domain: 'Phishing',
  malicious_token: 'Malicious Token',
}

export const THREAT_CSS_CLASS: Record<string, string> = {
  drainer: 'badge-drainer',
  rug: 'badge-rug',
  phishing_domain: 'badge-phishing',
  malicious_token: 'badge-token',
}
