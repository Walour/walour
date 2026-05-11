'use client'

import { useEffect, useState } from 'react'

const NAV_GROUPS = [
  {
    label: 'Getting Started',
    items: [
      { id: 'install', label: 'Install' },
      { id: 'quickstart', label: 'Quick Start' },
    ],
  },
  {
    label: 'SDK Reference',
    items: [
      { id: 'check-token', label: 'checkTokenRisk()' },
      { id: 'check-domain', label: 'checkDomain()' },
      { id: 'lookup', label: 'lookupAddress()' },
      { id: 'decode', label: 'decodeTransaction()' },
      { id: 'report', label: 'submitPrivateReport()' },
    ],
  },
  {
    label: 'Infrastructure',
    items: [
      { id: 'caching', label: 'Caching' },
      { id: 'circuit-breakers', label: 'Circuit Breakers' },
    ],
  },
] as const

type SectionId =
  | 'install' | 'quickstart'
  | 'check-token' | 'check-domain' | 'lookup' | 'decode' | 'report'
  | 'caching' | 'circuit-breakers'

function CodeBlock({ lang, children }: { lang: string; children: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(children).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    })
  }

  return (
    <div className="codebox" style={{ margin: '16px 0' }}>
      <div className="codebox-chrome">
        <span style={{
          fontFamily: 'ui-monospace, "SF Mono", Consolas, monospace',
          fontSize: 11,
          color: 'var(--text-disabled)',
          letterSpacing: 0.4,
        }}>
          {lang}
        </span>
        <button
          className={`install-bar-copy${copied ? ' copied' : ''}`}
          onClick={handleCopy}
          aria-label={copied ? 'Copied' : 'Copy code'}
          style={{ fontSize: 11, padding: '3px 10px' }}
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <pre className="codebox-body" style={{ margin: 0, color: '#e6edf3', lineHeight: 1.7, fontSize: 13 }}>
        <code>{children}</code>
      </pre>
    </div>
  )
}

function Badge({ children, color = 'var(--accent)' }: { children: string; color?: string }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '3px 10px',
      borderRadius: 20,
      fontSize: 12,
      fontWeight: 600,
      letterSpacing: 0.3,
      background: `${color}18`,
      border: `1px solid ${color}40`,
      color,
    }}>
      {children}
    </span>
  )
}

export default function DocsClient() {
  const [activeId, setActiveId] = useState<SectionId>('install')

  useEffect(() => {
    const onScroll = () => {
      const sections = document.querySelectorAll<HTMLElement>('section[data-section]')
      let current: SectionId = 'install'
      for (const section of sections) {
        if (section.getBoundingClientRect().top <= 120) {
          current = section.id as SectionId
        }
      }
      setActiveId(current)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const handleNavClick = (id: SectionId) => {
    setActiveId(id)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <main>
      {/* Page header */}
      <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 40 }}>
        <div className="container" style={{ paddingTop: 64, paddingBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <Badge>TypeScript</Badge>
            <Badge color="#A855F7">v0.1.0-beta</Badge>
            <Badge color="#F59E0B">Solana devnet</Badge>
          </div>
          <h1 className="section-title" style={{ marginBottom: 12 }}>SDK Docs</h1>
          <p style={{ fontSize: 16, color: 'var(--text)', lineHeight: 1.6, maxWidth: 520, marginBottom: 24 }}>
            Add real-time threat intelligence to any Solana wallet or dApp in under five minutes. Fully typed, cache-first, zero dependencies beyond the Solana web3 library.
          </p>
          <CodeBlock lang="bash">{`npm install @walour/sdk`}</CodeBlock>
        </div>
      </div>

      <div className="container docs-layout">
        {/* Sidebar */}
        <aside className="docs-sidebar">
          <ul className="docs-nav" role="navigation" aria-label="Docs sections">
            {NAV_GROUPS.map((group) => (
              <li key={group.label} style={{ marginBottom: 24 }}>
                <span style={{
                  display: 'block',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  padding: '0 12px',
                  marginBottom: 4,
                }}>
                  {group.label}
                </span>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {group.items.map(({ id, label }) => (
                    <li key={id}>
                      <button
                        className={`docs-nav-link${activeId === id ? ' active' : ''}`}
                        onClick={() => handleNavClick(id)}
                        aria-current={activeId === id ? 'location' : undefined}
                      >
                        {label}
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </aside>

        {/* Content */}
        <div className="docs-content">

          <section id="install" data-section>
            <h2>Install</h2>
            <p>Works with any Node 18+ runtime. TypeScript types are bundled.</p>
            <CodeBlock lang="bash">{`npm install @walour/sdk
pnpm add @walour/sdk
yarn add @walour/sdk
bun add @walour/sdk`}</CodeBlock>
            <p>Set these environment variables before calling any SDK function:</p>
            <CodeBlock lang="bash">{`ANTHROPIC_API_KEY=...        # for decodeTransaction()
HELIUS_API_KEY=...           # primary RPC + token checks
SUPABASE_URL=...             # threat corpus database
SUPABASE_SERVICE_KEY=...     # service role key
UPSTASH_REDIS_REST_URL=...   # cache layer
UPSTASH_REDIS_REST_TOKEN=...`}</CodeBlock>
          </section>

          <section id="quickstart" data-section>
            <h2>Quick Start</h2>
            <p>All SDK functions are stateless exports. Import only what you need.</p>
            <CodeBlock lang="typescript">{`import { checkDomain, checkTokenRisk, decodeTransaction } from '@walour/sdk'

// Check a domain before the user signs a transaction from it
const domain = await checkDomain('suspicious-site.xyz')
if (domain.level === 'RED') {
  showWarning(domain.reason)
}

// Check a token mint for rug risk
const token = await checkTokenRisk(mintAddress)
if (token.level === 'RED') {
  console.warn(token.reasons.join(', '))
}

// Stream a human-readable explanation of the transaction
for await (const chunk of decodeTransaction(versionedTx)) {
  appendToUI(chunk)
}`}</CodeBlock>
            <div className="docs-note">
              Cache-first on every call. Warm responses return in under 100ms. Cold calls hit GoPlus, Helius, and the on-chain registry in parallel.
            </div>
          </section>

          <section id="check-token" data-section>
            <h2>checkTokenRisk(mint)</h2>
            <p>Score a token mint against 8 parallel risk checks. Returns a risk level, a 0-100 score, and a list of reasons for any failures.</p>
            <CodeBlock lang="typescript">{`import { checkTokenRisk } from '@walour/sdk'

const result = await checkTokenRisk(mintAddress: string)

interface TokenRiskResult {
  level:   'GREEN' | 'AMBER' | 'RED'
  score:   number        // 0-100, higher = more risk
  reasons: string[]      // human-readable flag descriptions
  checks:  Record<string, {
    passed: boolean
    weight: number
    detail: string
  }>
}`}</CodeBlock>
            <h3>Checks performed</h3>
            <div className="docs-table-wrap"><table className="docs-table">
              <thead>
                <tr><th>Check</th><th>Weight</th><th>Flags when</th></tr>
              </thead>
              <tbody>
                <tr><td>Mint authority active</td><td>15</td><td>Creator can still mint unlimited supply</td></tr>
                <tr><td>Freeze authority active</td><td>15</td><td>Creator can freeze holder accounts</td></tr>
                <tr><td>Holder concentration</td><td>8-15</td><td>Top wallet holds more than 30% of supply</td></tr>
                <tr><td>LP lock (Raydium)</td><td>10</td><td>Liquidity pool is unlocked or missing</td></tr>
                <tr><td>Supply anomaly</td><td>10</td><td>0 decimals with over 1B supply</td></tr>
                <tr><td>Token age</td><td>8-15</td><td>Created less than 24h ago</td></tr>
                <tr><td>GoPlus honeypot</td><td>20</td><td>GoPlus flags as honeypot or blacklisted</td></tr>
                <tr><td>Walour corpus hit</td><td>30</td><td>Address in threat registry</td></tr>
              </tbody>
            </table></div>
            <div className="docs-note">
              Cache TTL: 60 seconds. Falls back to AMBER with reason "Risk check unavailable" if the circuit breaker opens.
            </div>
          </section>

          <section id="check-domain" data-section>
            <h2>checkDomain(hostname)</h2>
            <p>Check a domain against the Walour threat corpus. Falls back to GoPlus if the address is not in the local corpus.</p>
            <CodeBlock lang="typescript">{`import { checkDomain } from '@walour/sdk'

const result = await checkDomain('malicious-dapp.xyz')

interface DomainRiskResult {
  level:       'GREEN' | 'AMBER' | 'RED'
  reason:      string
  confidence:  number   // 0-1
  source?:     string   // 'corpus' | 'goplus'
}`}</CodeBlock>
            <div className="docs-note">
              Cache TTL: 1 hour. Pass just the hostname, not the full URL.
            </div>
          </section>

          <section id="lookup" data-section>
            <h2>lookupAddress(pubkey)</h2>
            <p>Look up any Solana address or domain in the threat corpus. Checks Redis, then Supabase, then the on-chain registry PDA in order.</p>
            <CodeBlock lang="typescript">{`import { lookupAddress } from '@walour/sdk'

const threat = await lookupAddress(address: string)
// Returns null if address is clean

interface ThreatReport {
  address:       string
  type:          'drainer' | 'rug' | 'phishing_domain' | 'malicious_token'
  source:        'on-chain' | 'scam_sniffer' | 'goplus' | 'community'
  confidence:    number        // 0-1
  evidence_url?: string
  first_seen:    string        // ISO 8601
  last_updated:  string        // ISO 8601
}`}</CodeBlock>
            <div className="docs-note">
              Cache TTL: 5 minutes. Returns <code>null</code> for clean addresses.
            </div>
          </section>

          <section id="decode" data-section>
            <h2>decodeTransaction(tx)</h2>
            <p>Stream a plain-English explanation of what a transaction does before the user signs it. Powered by Claude Sonnet 4.6. Detects red flags synchronously and streams the AI explanation in parallel.</p>
            <CodeBlock lang="typescript">{`import { decodeTransaction } from '@walour/sdk'
import { VersionedTransaction } from '@solana/web3.js'

// Accepts a VersionedTransaction object
for await (const chunk of decodeTransaction(tx: VersionedTransaction)) {
  process.stdout.write(chunk)
}

// In React:
const [explanation, setExplanation] = useState('')

for await (const chunk of decodeTransaction(tx)) {
  setExplanation(prev => prev + chunk)
}`}</CodeBlock>
            <div className="docs-note">
              Resolves Address Lookup Tables before analysis. First token arrives in under 400ms. Cache TTL: 24 hours. Falls back gracefully if Claude is unavailable.
            </div>
          </section>

          <section id="report" data-section>
            <h2>submitPrivateReportCloak()</h2>
            <p>Submit an anonymous threat report using a Cloak UTXO shielded pool with Groth16 proofs. The caller's identity is never linked to the report on-chain.</p>
            <CodeBlock lang="typescript">{`import { submitPrivateReportCloak } from '@walour/sdk'

const result = await submitPrivateReportCloak(
  address:    string,          // Solana address or domain
  label:      'drainer' | 'rug' | 'phishing_domain' | 'malicious_token',
  confidence: number,          // 0-1
  options: {
    connection: Connection,
    payer:      Keypair,
    depositLamports?: number   // optional deposit for ZK proof
  }
)

interface PrivateReportCloakResult {
  txSignature: string
  viewingKey:  string          // base64 Groth16 proof
}`}</CodeBlock>
            <div className="docs-note">
              Reports are corroborated against existing signals before affecting confidence scores. A single community report never overrides oracle data.
            </div>
          </section>

          <section id="caching" data-section>
            <h2>Caching</h2>
            <p>Every SDK function is cache-first. On a miss the SDK fetches all sources in parallel, writes to Upstash Redis, then returns. Subsequent calls within the TTL window skip all network round-trips.</p>
            <div className="docs-table-wrap"><table className="docs-table">
              <thead>
                <tr><th>Function</th><th>TTL</th><th>Warm latency</th></tr>
              </thead>
              <tbody>
                <tr><td>checkTokenRisk()</td><td>60s</td><td>under 100ms</td></tr>
                <tr><td>lookupAddress()</td><td>300s</td><td>under 100ms</td></tr>
                <tr><td>checkDomain()</td><td>3600s</td><td>under 100ms</td></tr>
                <tr><td>decodeTransaction()</td><td>86400s</td><td>under 100ms</td></tr>
              </tbody>
            </table></div>
            <h3>Bypass cache</h3>
            <p>Pass <code>skipCache: true</code> in the options argument to any function to force a fresh fetch.</p>
            <h3>Cache invalidation</h3>
            <p>When a report is submitted via <code>submitPrivateReportCloak()</code>, the cache entry for that address is evicted immediately so the next lookup reflects the new signal.</p>
          </section>

          <section id="circuit-breakers" data-section>
            <h2>Circuit Breakers</h2>
            <p>Every external provider is wrapped in a circuit breaker. If a provider fails 3 times within 60 seconds, its circuit opens and calls are routed to the next provider in the fallback chain automatically.</p>
            <h3>RPC fallback chain</h3>
            <div className="docs-table-wrap"><table className="docs-table">
              <thead>
                <tr><th>Priority</th><th>Provider</th><th>Notes</th></tr>
              </thead>
              <tbody>
                <tr><td>1</td><td>Helius</td><td>Primary, enhanced APIs, ALT resolution</td></tr>
                <tr><td>2</td><td>Triton</td><td>High-availability fallback</td></tr>
                <tr><td>3</td><td>Solana public RPC</td><td>Last resort, rate-limited</td></tr>
              </tbody>
            </table></div>
            <h3>Inspect circuit state</h3>
            <CodeBlock lang="typescript">{`import { getRpcEndpoints } from '@walour/sdk'

// Check which providers are currently healthy
const endpoints = getRpcEndpoints()
// Returns RpcEndpoint[] ordered by priority with circuit state

// Circuit states:
// CLOSED    = healthy, accepting requests
// OPEN      = tripped, routing to next provider
// HALF_OPEN = probing recovery with a single test request`}</CodeBlock>
          </section>

        </div>
      </div>
    </main>
  )
}
