export type RiskLevel = 'GREEN' | 'AMBER' | 'RED'

export interface TokenRiskResult {
  level: RiskLevel
  score: number
  reasons: string[]
  checks: Record<string, { passed: boolean; weight: number; detail: string }>
}

export interface DomainRiskResult {
  level: RiskLevel
  reason: string
  confidence: number
  source?: string
}

export interface ThreatReport {
  address: string
  type: 'drainer' | 'rug' | 'phishing_domain' | 'malicious_token'
  source: 'chainabuse' | 'scam_sniffer' | 'community' | 'twitter'
  evidence_url?: string
  confidence: number
  first_seen: string
  last_updated: string
}
