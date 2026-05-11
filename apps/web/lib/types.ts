export type ThreatType = 'drainer' | 'rug' | 'phishing_domain' | 'malicious_token'

export interface ThreatRow {
  address: string
  type: ThreatType
  confidence: number
  last_updated: string
  source?: string
}

export interface ProviderStatus {
  provider: string
  status: 'operational' | 'degraded'
}

export interface StatsData {
  threatsTracked: number
  drainsBlocked: number
  solSaved: number
  topThreats: ThreatRow[]
  typeBreakdown: Record<string, number>
  confidenceBuckets: [number, number, number, number]
  providerHealth: ProviderStatus[]
}

export interface ThreatsResponse {
  rows: ThreatRow[]
  total: number
}

export interface Incident {
  id: string
  provider: string
  openedAt: string
  closedAt: string | null
  errorMsg: string | null
  durationMinutes: number | null
}

export interface StatusData {
  providers: ProviderStatus[]
  recentIncidents: Incident[]
  allOperational: boolean
}
