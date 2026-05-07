'use client'

import { useEffect, useState } from 'react'
import Script from 'next/script'

// Test addresses — must be seeded in the Walour threat corpus (see SQL below)
const AMBER_MINT    = 'AmberTestWaLourToken11111111111111111111111'
const RED_DRAINER   = 'RedDrainerWaLourTest111111111111111111111111'
// Fee payer for test transactions — using system program keeps findLikelyMint focused on the test address
const SYSTEM_PROGRAM = '11111111111111111111111111111111'
const FAKE_BLOCKHASH = '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d'

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    solanaWeb3: any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    phantom: { solana: any }
  }
}

function ensureMockWallet() {
  if (window.phantom?.solana) return
  window.phantom = {
    solana: {
      isPhantom: true,
      publicKey: { toBase58: () => SYSTEM_PROGRAM },
      signTransaction: async (tx: unknown) => tx,
      signAndSendTransaction: async () => ({ signature: 'walour-test-mock' }),
    },
  }
}

type StatusType = 'idle' | 'pending' | 'blocked' | 'signed' | 'error'

export default function TriggerPage() {
  const [web3Ready, setWeb3Ready] = useState(false)
  const [status, setStatus] = useState<{ msg: string; type: StatusType }>({ msg: '', type: 'idle' })

  useEffect(() => {
    ensureMockWallet()
  }, [])

  async function trigger(scenario: 'green' | 'amber' | 'red') {
    if (!web3Ready) {
      setStatus({ msg: 'web3 library still loading — try again in a moment', type: 'error' })
      return
    }

    ensureMockWallet()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { PublicKey, VersionedTransaction, TransactionMessage, SystemProgram, ComputeBudgetProgram } = window.solanaWeb3 as any
    const payer = new PublicKey(SYSTEM_PROGRAM)

    let tx: unknown
    try {
      if (scenario === 'green') {
        // ComputeBudget-only: all accounts are in KNOWN_PROGRAMS, findLikelyMint returns null
        const ix = ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 })
        const msg = new TransactionMessage({ payerKey: payer, recentBlockhash: FAKE_BLOCKHASH, instructions: [ix] }).compileToV0Message()
        tx = new VersionedTransaction(msg)
      } else if (scenario === 'amber') {
        // Transfer to AMBER_MINT — corpus type 'malicious_token' → token risk AMBER
        const ix = SystemProgram.transfer({ fromPubkey: payer, toPubkey: new PublicKey(AMBER_MINT), lamports: 1000 })
        const msg = new TransactionMessage({ payerKey: payer, recentBlockhash: FAKE_BLOCKHASH, instructions: [ix] }).compileToV0Message()
        tx = new VersionedTransaction(msg)
      } else {
        // Transfer to RED_DRAINER — corpus type 'drainer' → domain RED
        const ix = SystemProgram.transfer({ fromPubkey: payer, toPubkey: new PublicKey(RED_DRAINER), lamports: 1000 })
        const msg = new TransactionMessage({ payerKey: payer, recentBlockhash: FAKE_BLOCKHASH, instructions: [ix] }).compileToV0Message()
        tx = new VersionedTransaction(msg)
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setStatus({ msg: `Transaction build error: ${msg}`, type: 'error' })
      return
    }

    setStatus({ msg: 'Walour overlay should appear above...', type: 'pending' })

    try {
      await window.phantom.solana.signTransaction(tx)
      setStatus({ msg: 'Transaction signed (user approved)', type: 'signed' })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('blocked')) {
        setStatus({ msg: 'Transaction blocked by user', type: 'blocked' })
      } else if (msg.includes('modified')) {
        setStatus({ msg: 'Blocked: transaction tamper detected', type: 'blocked' })
      } else {
        setStatus({ msg, type: 'error' })
      }
    }
  }

  const statusColors: Record<StatusType, string> = {
    idle: '#484f58',
    pending: '#F59E0B',
    blocked: '#EF4444',
    signed: '#22C55E',
    error: '#EF4444',
  }

  return (
    <>
      <Script
        src="https://unpkg.com/@solana/web3.js@1.95.8/lib/index.iife.min.js"
        onLoad={() => setWeb3Ready(true)}
      />
      <main style={{ minHeight: '100vh', background: '#0D1117', color: '#e6edf3', padding: '60px 24px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>

          <div style={{ marginBottom: 40 }}>
            <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 10 }}>Walour Test Trigger</h1>
            <p style={{ color: '#8b949e', lineHeight: 1.65, margin: 0 }}>
              Install the Walour Chrome extension, then click a button below to fire a test
              transaction. The security overlay appears above the page — no real wallet or SOL
              required.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <ScenarioCard
              verdict="GREEN"
              label="Safe transaction"
              desc="A compute-budget-only instruction. No token involved, domain is clean. Overlay shows GREEN verdict."
              color="#22C55E"
              onClick={() => trigger('green')}
              disabled={!web3Ready}
            />
            <ScenarioCard
              verdict="AMBER"
              label="Suspicious token"
              desc="Transfer to a test mint flagged as malicious_token in the Walour corpus. Token risk scores AMBER."
              color="#F59E0B"
              onClick={() => trigger('amber')}
              disabled={!web3Ready}
            />
            <ScenarioCard
              verdict="RED"
              label="Known drainer"
              desc="Transfer to an address seeded as a known drainer. Domain check fires RED immediately."
              color="#EF4444"
              onClick={() => trigger('red')}
              disabled={!web3Ready}
            />
          </div>

          {status.msg && (
            <div style={{
              marginTop: 24,
              padding: '12px 16px',
              borderRadius: 8,
              background: '#161b22',
              border: '1px solid #30363d',
              fontSize: 13,
              color: statusColors[status.type],
            }}>
              {status.msg}
            </div>
          )}

          <p style={{ marginTop: 40, fontSize: 12, color: '#484f58', lineHeight: 1.7 }}>
            Chrome reviewer note: load this page with the Walour extension installed. Click
            any button — the overlay intercepts the transaction before it reaches the wallet.
            Use &quot;Sign anyway&quot; on GREEN, &quot;Block&quot; on AMBER/RED to test both paths.
          </p>
        </div>
      </main>
    </>
  )
}

function ScenarioCard({
  verdict, label, desc, color, onClick, disabled,
}: {
  verdict: string
  label: string
  desc: string
  color: string
  onClick: () => void
  disabled: boolean
}) {
  return (
    <div style={{
      background: '#161b22',
      border: `1px solid ${color}30`,
      borderRadius: 12,
      padding: '18px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ background: `${color}18`, border: `1px solid ${color}50`, color, borderRadius: 4, padding: '1px 7px', fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }}>
            {verdict}
          </span>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{label}</span>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: '#8b949e', lineHeight: 1.5 }}>{desc}</p>
      </div>
      <button
        onClick={onClick}
        disabled={disabled}
        style={{
          flexShrink: 0,
          background: `${color}15`,
          border: `1px solid ${color}50`,
          color,
          borderRadius: 8,
          padding: '9px 18px',
          fontSize: 13,
          fontWeight: 600,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          transition: 'opacity 0.15s',
        }}
      >
        Test
      </button>
    </div>
  )
}
