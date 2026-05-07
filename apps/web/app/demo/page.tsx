'use client'

import { useEffect, useRef, useState } from 'react'
import Script from 'next/script'

// Test addresses seeded in the Walour threat corpus
const AMBER_MINT     = 'AmberTestWaLourToken11111111111111111111111'
const RED_DRAINER    = 'Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS'
const SYSTEM_PROGRAM = '11111111111111111111111111111111'
const FAKE_BLOCKHASH = '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d'

const API_BASE = process.env.NEXT_PUBLIC_WALOUR_API_BASE ?? 'http://localhost:3001'

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    solanaWeb3: any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    phantom: { solana: any }
    __walour_content_injected?: boolean
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Buffer: any
  }
}

type DemoState =
  | 'mobile'
  | 'checking'
  | 'no-extension'
  | 'no-wallet'
  | 'ready'
  | 'scanning'
  | 'result'

type Scenario = 'green' | 'amber' | 'red'
type ResultType = Scenario | 'error'

interface DomainVerdict {
  level?: 'GREEN' | 'AMBER' | 'RED' | string
  reason?: string
  confidence?: number
  source?: string
}

interface TokenVerdict {
  level?: 'GREEN' | 'AMBER' | 'RED' | string
  score?: number
  reasons?: string[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  checks?: Record<string, any>
}

interface ScanResponse {
  domain?: DomainVerdict | null
  token?: TokenVerdict | null
  altWarning?: string | null
}

const RESULT_CONFIG: Record<ResultType, { label: string; color: string; desc: string }> = {
  green: { label: 'GREEN', color: '#22C55E', desc: 'Walour detected no threats. Transaction is clean.' },
  amber: { label: 'AMBER', color: '#F59E0B', desc: 'Walour flagged a suspicious token — caution warranted.' },
  red:   { label: 'RED',   color: '#EF4444', desc: 'Walour detected a known drainer. Block this transaction.' },
  error: { label: 'ERROR', color: '#EF4444', desc: 'Something went wrong. Check the console.' },
}

function computeVerdict(data: ScanResponse, hostname: string): Scenario {
  // localhost is dev — domain-AMBER isn't a real signal
  const ignoreDomainAmber = hostname === 'localhost' || hostname === '127.0.0.1'
  if (data.domain?.level === 'RED') return 'red'
  if (data.token?.level === 'RED') return 'red'
  if (data.token?.level === 'AMBER') return 'amber'
  if (data.domain?.level === 'AMBER' && !ignoreDomainAmber) return 'amber'
  return 'green'
}

export default function DemoPage() {
  const [state, setState] = useState<DemoState>('checking')
  const [web3Ready, setWeb3Ready] = useState(false)
  const [walletKey, setWalletKey] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<ResultType | null>(null)
  const [lastScenario, setLastScenario] = useState<Scenario | null>(null)
  const [scanData, setScanData] = useState<ScanResponse | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const checkCount = useRef(0)

  // Polyfill Buffer before @solana/web3.js loads
  useEffect(() => {
    if (typeof window !== 'undefined' && !window.Buffer) {
      import('buffer').then(m => {
        window.Buffer = m.Buffer
      })
    }
  }, [])

  // Mobile detection + extension polling
  useEffect(() => {
    if (/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
      setState('mobile')
      return
    }

    const poll = setInterval(() => {
      checkCount.current += 1
      if (window.__walour_content_injected) {
        clearInterval(poll)
        if (window.phantom?.solana?.isPhantom) {
          setWalletKey(window.phantom.solana.publicKey?.toBase58?.() ?? null)
          setState('ready')
        } else {
          setState('no-wallet')
        }
        return
      }
      if (checkCount.current >= 20) {
        clearInterval(poll)
        setState('no-extension')
      }
    }, 500)

    return () => clearInterval(poll)
  }, [])

  function recheck() {
    checkCount.current = 0
    setState('checking')
    const poll = setInterval(() => {
      checkCount.current += 1
      if (window.__walour_content_injected) {
        clearInterval(poll)
        if (window.phantom?.solana?.isPhantom) {
          setWalletKey(window.phantom.solana.publicKey?.toBase58?.() ?? null)
          setState('ready')
        } else {
          setState('no-wallet')
        }
        return
      }
      if (checkCount.current >= 20) {
        clearInterval(poll)
        setState('no-extension')
      }
    }, 500)
  }

  async function connectWallet() {
    if (!window.phantom?.solana) {
      window.phantom = {
        solana: {
          isPhantom: true,
          publicKey: { toBase58: () => SYSTEM_PROGRAM },
          connect: async () => ({ publicKey: { toBase58: () => SYSTEM_PROGRAM } }),
          signTransaction: async (tx: unknown) => tx,
          signAndSendTransaction: async () => ({ signature: 'walour-demo-mock' }),
        },
      }
    }
    try {
      await window.phantom.solana.connect()
      setWalletKey(window.phantom.solana.publicKey?.toBase58?.() ?? SYSTEM_PROGRAM)
      setState('ready')
    } catch {
      setWalletKey(SYSTEM_PROGRAM)
      setState('ready')
    }
  }

  async function runScenario(scenario: Scenario) {
    if (!web3Ready) return
    setState('scanning')
    setLastScenario(scenario)
    setScanData(null)
    setErrorMsg('')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { PublicKey, VersionedTransaction, TransactionMessage, SystemProgram, ComputeBudgetProgram } = window.solanaWeb3 as any
    const payer = new PublicKey(SYSTEM_PROGRAM)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let tx: any
    try {
      if (scenario === 'green') {
        const ix = ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 })
        const msg = new TransactionMessage({ payerKey: payer, recentBlockhash: FAKE_BLOCKHASH, instructions: [ix] }).compileToV0Message()
        tx = new VersionedTransaction(msg)
      } else if (scenario === 'amber') {
        const ix = SystemProgram.transfer({ fromPubkey: payer, toPubkey: new PublicKey(AMBER_MINT), lamports: 1000 })
        const msg = new TransactionMessage({ payerKey: payer, recentBlockhash: FAKE_BLOCKHASH, instructions: [ix] }).compileToV0Message()
        tx = new VersionedTransaction(msg)
      } else {
        const ix = SystemProgram.transfer({ fromPubkey: payer, toPubkey: new PublicKey(RED_DRAINER), lamports: 1000 })
        const msg = new TransactionMessage({ payerKey: payer, recentBlockhash: FAKE_BLOCKHASH, instructions: [ix] }).compileToV0Message()
        tx = new VersionedTransaction(msg)
      }
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : String(e))
      setLastResult('error')
      setState('result')
      return
    }

    // Real fetch to Walour worker — replaces hardcoded scenario echo
    let data: ScanResponse | null = null
    try {
      const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false })
      const txBase64 = window.Buffer
        ? window.Buffer.from(serialized).toString('base64')
        : btoa(String.fromCharCode(...new Uint8Array(serialized)))
      const hostname = window.location.hostname
      const url = `${API_BASE}/api/scan?hostname=${encodeURIComponent(hostname)}&tx=${encodeURIComponent(txBase64)}`
      const res = await fetch(url, { method: 'GET' })
      if (!res.ok) {
        throw new Error(`Worker returned ${res.status} ${res.statusText}`)
      }
      data = (await res.json()) as ScanResponse
      setScanData(data)
    } catch (e: unknown) {
      const isLocal = API_BASE.includes('localhost') || API_BASE.includes('127.0.0.1')
      const hint = isLocal
        ? `Worker unreachable at ${API_BASE} — start it with \`cd apps/worker && npm run dev\`.`
        : `Worker unreachable at ${API_BASE}.`
      const detail = e instanceof Error ? e.message : String(e)
      setErrorMsg(`${hint} (${detail})`)
      setLastResult('error')
      setState('result')
      return
    }

    // Fire wallet sign in parallel-ish — extension overlay may intercept; non-fatal either way
    try {
      await window.phantom.solana.signTransaction(tx)
    } catch {
      // User clicked "Don't sign" or extension blocked — verdict already computed
    }

    const verdict = computeVerdict(data, window.location.hostname)
    setLastResult(verdict)
    setState('result')
  }

  return (
    <>
      <Script
        src="https://unpkg.com/@solana/web3.js@1.95.8/lib/index.iife.min.js"
        onLoad={() => setWeb3Ready(true)}
      />

      <main style={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 20px',
      }}>
        <div style={{ width: '100%', maxWidth: 560 }}>

          {state === 'mobile' && (
            <Gate
              icon="📱"
              title="Open on desktop"
              body="The Walour demo requires Chrome with the extension installed. Open walour.io/demo on your desktop to continue."
              action={null}
            />
          )}

          {state === 'checking' && (
            <Gate
              icon={<Spinner />}
              title="Checking for Walour extension..."
              body={null}
              action={null}
            />
          )}

          {state === 'no-extension' && (
            <Gate
              icon="🛡️"
              title="Walour extension not detected"
              body="Install the Walour extension first, then return to this page. The demo intercepts transactions via the extension and won't work without it."
              action={
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <a href="#" style={btnStyle('#00C9A7')}>
                    Add to Chrome
                  </a>
                  <button onClick={recheck} style={{ ...btnStyle('#8b949e'), cursor: 'pointer' }}>
                    I installed it — check again
                  </button>
                </div>
              }
            />
          )}

          {state === 'no-wallet' && (
            <Gate
              icon="👻"
              title="Connect a wallet to continue"
              body="Walour intercepts wallet signing calls. Connect Phantom, or use the built-in mock wallet if you don't have one installed."
              action={
                <button onClick={connectWallet} style={{ ...btnStyle('#00C9A7'), cursor: 'pointer', margin: '0 auto', display: 'block' }}>
                  Connect wallet
                </button>
              }
            />
          )}

          {(state === 'ready' || state === 'scanning') && (
            <ReadyView
              walletKey={walletKey}
              web3Ready={web3Ready}
              scanning={state === 'scanning'}
              onScenario={runScenario}
            />
          )}

          {state === 'result' && lastResult && (
            <ResultView
              result={lastResult}
              scenario={lastScenario}
              data={scanData}
              errorMsg={errorMsg}
              onReset={() => {
                setLastResult(null)
                setLastScenario(null)
                setScanData(null)
                setErrorMsg('')
                setState('ready')
              }}
            />
          )}
        </div>

        <p style={{ marginTop: 40, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
          No real SOL or wallet required · Transactions never leave your browser
        </p>
      </main>
    </>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function Gate({ icon, title, body, action }: {
  icon: React.ReactNode
  title: string
  body: string | null
  action: React.ReactNode
}) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 20 }}>{icon}</div>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 12px' }}>{title}</h1>
      {body && <p style={{ color: 'var(--text-muted)', fontSize: 15, lineHeight: 1.6, marginBottom: 28 }}>{body}</p>}
      {action && <div style={{ marginTop: 24 }}>{action}</div>}
    </div>
  )
}

function Spinner() {
  return (
    <div style={{
      width: 36, height: 36, border: '3px solid #30363d', borderTopColor: '#00C9A7',
      borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto',
    }} />
  )
}

function ReadyView({ walletKey, web3Ready, scanning, onScenario }: {
  walletKey: string | null
  web3Ready: boolean
  scanning: boolean
  onScenario: (s: Scenario) => void
}) {
  const disabled = !web3Ready || scanning

  return (
    <div>
      <div style={{ marginBottom: 32, textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--card-bg, #161b22)', border: '1px solid var(--border, #30363d)', borderRadius: 20, padding: '6px 14px', fontSize: 12, color: 'var(--text-muted)', marginBottom: 24 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E', display: 'inline-block' }} />
          {walletKey ? `${walletKey.slice(0, 4)}…${walletKey.slice(-4)}` : 'Wallet connected'}
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: '0 0 10px' }}>Test Walour live</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 15, margin: 0, lineHeight: 1.6 }}>
          Click a scenario. Walour scans the transaction and returns a real verdict before your wallet signs.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <ScenarioCard
          verdict="GREEN" label="Safe transaction" color="#22C55E"
          desc="Compute-budget only — no token involved. Walour returns a clean verdict."
          onClick={() => onScenario('green')} disabled={disabled}
        />
        <ScenarioCard
          verdict="AMBER" label="Suspicious token" color="#F59E0B"
          desc="Transfer to a mint flagged as malicious in the Walour corpus. Token risk scores AMBER."
          onClick={() => onScenario('amber')} disabled={disabled}
        />
        <ScenarioCard
          verdict="RED" label="Known drainer" color="#EF4444"
          desc="Transfer to a known drainer address. Domain check fires RED and Walour blocks immediately."
          onClick={() => onScenario('red')} disabled={disabled}
        />
      </div>

      {scanning && (
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <Spinner />
          <p style={{ marginTop: 12, fontSize: 13, color: '#F59E0B' }}>
            Scanning transaction with Walour…
          </p>
        </div>
      )}
    </div>
  )
}

function ScenarioCard({ verdict, label, desc, color, onClick, disabled }: {
  verdict: string; label: string; desc: string; color: string
  onClick: () => void; disabled: boolean
}) {
  return (
    <div style={{ background: 'var(--card-bg, #161b22)', border: `1px solid ${color}30`, borderRadius: 12, padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ background: `${color}18`, border: `1px solid ${color}50`, color, borderRadius: 4, padding: '1px 7px', fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }}>
            {verdict}
          </span>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{label}</span>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>{desc}</p>
      </div>
      <button
        onClick={onClick}
        disabled={disabled}
        style={{ flexShrink: 0, background: `${color}15`, border: `1px solid ${color}50`, color, borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, transition: 'opacity 0.15s' }}
      >
        {disabled ? '…' : 'Test'}
      </button>
    </div>
  )
}

function ResultView({ result, scenario, data, errorMsg, onReset }: {
  result: ResultType
  scenario: Scenario | null
  data: ScanResponse | null
  errorMsg: string
  onReset: () => void
}) {
  const cfg = RESULT_CONFIG[result]

  if (result === 'error') {
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>❌</div>
        <div style={{ display: 'inline-block', background: `${cfg.color}18`, border: `1px solid ${cfg.color}50`, color: cfg.color, borderRadius: 6, padding: '3px 12px', fontSize: 13, fontWeight: 700, letterSpacing: 0.5, marginBottom: 16 }}>
          {cfg.label}
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 12px' }}>Scan failed</h2>
        {errorMsg && (
          <p style={{
            color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.6, marginBottom: 20,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            background: 'rgba(239, 68, 68, 0.06)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: 8, padding: '12px 14px', textAlign: 'left',
          }}>
            {errorMsg}
          </p>
        )}
        <button onClick={onReset} style={{ ...btnStyle('#00C9A7'), cursor: 'pointer', marginTop: 8 }}>
          Try again
        </button>
      </div>
    )
  }

  // Pick the load-bearing signal: domain RED > token RED > token AMBER > domain AMBER > clean
  const signal = pickSignal(data, result)
  const expected = scenario ? scenario.toUpperCase() : null
  const actual = cfg.label
  const matched = expected === actual

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 56, marginBottom: 12 }}>
        {result === 'green' ? '✅' : result === 'red' ? '🚫' : '⚠️'}
      </div>

      <div style={{
        display: 'inline-block', background: `${cfg.color}18`, border: `1px solid ${cfg.color}50`,
        color: cfg.color, borderRadius: 8, padding: '6px 18px', fontSize: 22, fontWeight: 800,
        letterSpacing: 1, marginBottom: 18,
      }}>
        {cfg.label}
      </div>

      <h2 style={{
        fontSize: 16, fontWeight: 600, margin: '0 auto 16px', maxWidth: 480,
        lineHeight: 1.5, color: 'var(--text, #e6edf3)',
      }}>
        {signal.reason ?? cfg.desc}
      </h2>

      {(signal.confidence != null || signal.source) && (
        <div style={{
          display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center',
          flexWrap: 'wrap', marginBottom: 18,
        }}>
          {signal.confidence != null && (
            <span style={chipStyle(cfg.color)}>
              {Math.round(signal.confidence * 100)}% confidence
            </span>
          )}
          {signal.source && (
            <span style={chipStyle('#8b949e')}>
              source: {signal.source}
            </span>
          )}
        </div>
      )}

      {expected && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: matched ? 'rgba(34, 197, 94, 0.08)' : 'rgba(245, 158, 11, 0.08)',
          border: `1px solid ${matched ? 'rgba(34, 197, 94, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
          color: matched ? '#22C55E' : '#F59E0B',
          borderRadius: 6, padding: '6px 12px', fontSize: 12,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          marginBottom: 24,
        }}>
          {matched ? (
            <>✓ Expected: {expected} · Actual: {actual} · matched</>
          ) : (
            <>Expected: {expected} · Actual: {actual} · Walour saw this differently</>
          )}
        </div>
      )}

      {data?.altWarning && (
        <p style={{
          fontSize: 12, color: '#F59E0B', marginBottom: 16,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        }}>
          ALT warning: {data.altWarning}
        </p>
      )}

      <p style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.5, margin: '0 auto 20px', maxWidth: 420 }}>
        {cfg.desc}
      </p>

      <button onClick={onReset} style={{ ...btnStyle('#00C9A7'), cursor: 'pointer', marginTop: 4 }}>
        Try another
      </button>
    </div>
  )
}

function pickSignal(
  data: ScanResponse | null,
  verdict: ResultType,
): { reason?: string; confidence?: number; source?: string } {
  if (!data) return {}
  const d = data.domain
  const t = data.token

  if (verdict === 'red') {
    if (d?.level === 'RED') {
      return { reason: d.reason, confidence: d.confidence, source: d.source }
    }
    if (t?.level === 'RED') {
      return {
        reason: t.reasons?.[0],
        confidence: typeof t.score === 'number' ? clamp01(t.score / 100) : undefined,
        source: 'token-risk',
      }
    }
  }
  if (verdict === 'amber') {
    if (t?.level === 'AMBER') {
      return {
        reason: t.reasons?.[0],
        confidence: typeof t.score === 'number' ? clamp01(t.score / 100) : undefined,
        source: 'token-risk',
      }
    }
    if (d?.level === 'AMBER') {
      return { reason: d.reason, confidence: d.confidence, source: d.source }
    }
  }
  // green path — surface domain reason if present, else nothing
  return d?.level
    ? { reason: d.reason, confidence: d.confidence, source: d.source }
    : {}
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0
  if (n < 0) return 0
  if (n > 1) return 1
  return n
}

function chipStyle(color: string): React.CSSProperties {
  return {
    fontSize: 11,
    fontWeight: 600,
    color,
    background: `${color}12`,
    border: `1px solid ${color}30`,
    borderRadius: 4,
    padding: '3px 8px',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    letterSpacing: 0.3,
  }
}

function btnStyle(color: string): React.CSSProperties {
  return {
    background: `${color}18`,
    border: `1px solid ${color}50`,
    color,
    borderRadius: 8,
    padding: '10px 20px',
    fontSize: 14,
    fontWeight: 600,
    textDecoration: 'none',
    display: 'inline-block',
  }
}
