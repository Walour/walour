export type ThreatType = 'drainer' | 'rug' | 'phishing' | 'malicious_token'

export interface ThreatRow {
  id: string
  address: string
  type: ThreatType
  confidence: number
  last_updated: string
  source?: string
}

export interface StatsData {
  threatsTracked: number
  drainsBlocked: number
  solSaved: number
  topThreats: ThreatRow[]
}

export interface ThreatsResponse {
  rows: ThreatRow[]
  total: number
}
