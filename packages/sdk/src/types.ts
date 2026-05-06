export type RiskLevel = 'GREEN' | 'AMBER' | 'RED'

export interface TokenRiskResult {
  level: RiskLevel
  score: number
  reasons: string[]
  checks: Record<string, { passed: boolean; weight: number; detail: string }>
  intel?: {
    jupiter?: {
      organicScore: number | null
      isVerified: boolean | null
      isSus: true | null
      devBalancePct: number | null
      devMints: number | null
      liquidityUsd: number | null
      hasPrice: boolean | null
      tags: string[]
      fetchedAt: number
    }
  }
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
  source: 'on-chain' | 'scam_sniffer' | 'community' | 'twitter' | 'goplus'
  evidence_url?: string
  confidence: number
  first_seen: string
  last_updated: string
}
