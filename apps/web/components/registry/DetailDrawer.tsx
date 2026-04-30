'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Badge from '@/components/ui/Badge'
import ConfBar from '@/components/ui/ConfBar'
import type { ThreatRow } from '@/lib/types'

type ReportState = 'idle' | 'open' | 'submitting' | 'done' | 'error'

interface DetailDrawerProps {
  row: ThreatRow | null
  onClose: () => void
}

// Source badge colours match the spec:
// GoPlus → blue, Community → teal (accent), Helius → purple, Internal/unknown → muted
const SOURCE_STYLES: Record<string, { label: string; color: string; bg: string; border: string }> = {
  goplus: {
    label: 'GoPlus',
    color: '#3B82F6',
    bg: 'rgba(59,130,246,0.13)',
    border: '#3B82F6',
  },
  community: {
    label: 'Community',
    color: 'var(--accent)',
    bg: 'rgba(0,201,167,0.13)',
    border: 'var(--accent)',
  },
  helius: {
    label: 'Helius',
    color: '#A855F7',
    bg: 'rgba(168,85,247,0.13)',
    border: '#A855F7',
  },
}

function getSourceStyle(source: string | undefined) {
  if (!source) return null
  const key = source.toLowerCase()
  return (
    SOURCE_STYLES[key] ?? {
      label: source.charAt(0).toUpperCase() + source.slice(1),
      color: 'var(--text-muted)',
      bg: 'rgba(139,148,158,0.10)',
      border: 'var(--text-muted)',
    }
  )
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function CopyButton({ address }: { address: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      // clipboard unavailable — silently ignore
    }
  }, [address])

  return (
    <button
      className={`copy-btn${copied ? ' copied' : ''}`}
      onClick={handleCopy}
      title={copied ? 'Copied!' : 'Copy address'}
      aria-label={copied ? 'Copied!' : `Copy address ${address}`}
      type="button"
    >
      {copied ? (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  )
}

function InlineReport({ address }: { address: string }) {
  const [state, setState] = useState<ReportState>('idle')
  const lastAddress = useRef(address)

  // Reset when address changes (new row selected)
  useEffect(() => {
    if (lastAddress.current !== address) {
      lastAddress.current = address
      setState('idle')
    }
  }, [address])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setState('submitting')
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, type: 'false_positive' }),
      })
      setState(res.ok ? 'done' : 'error')
    } catch {
      setState('error')
    }
  }

  if (state === 'done') {
    return (
      <div style={{ fontSize: 13, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>✓</span> Report submitted. Confidence will update as it is corroborated.
      </div>
    )
  }

  if (state === 'idle') {
    return (
      <button
        type="button"
        className="drawer-fp-link"
        onClick={() => setState('open')}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        Mark as false positive
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
        Submit a false positive report. Confidence will be reviewed and may be reduced.
      </div>
      {state === 'error' && (
        <div style={{ fontSize: 12, color: 'var(--danger)' }}>Submission failed. Try again.</div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" className="btn btn-secondary" disabled={state === 'submitting'} style={{ fontSize: 13, padding: '6px 14px', flex: 1 }}>
          {state === 'submitting' ? 'Submitting…' : 'Confirm false positive'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => setState('idle')} style={{ fontSize: 13, padding: '6px 10px' }}>
          Cancel
        </button>
      </div>
    </form>
  )
}

export default function DetailDrawer({ row, onClose }: DetailDrawerProps) {
  const isOpen = row !== null

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  // Prevent body scroll while drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const sourceStyle = row ? getSourceStyle(row.source) : null

  return (
    <>
      {/* Backdrop */}
      <div
        className={`drawer-overlay${isOpen ? ' drawer-open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <aside
        className={`drawer-panel${isOpen ? ' drawer-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Threat detail"
      >
        {row && (
          <>
            {/* Header */}
            <div className="drawer-header">
              <span className="drawer-title">Threat Detail</span>
              <button
                className="drawer-close"
                onClick={onClose}
                aria-label="Close drawer"
                type="button"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="drawer-body">
              {/* Address */}
              <section className="drawer-section">
                <div className="drawer-label">Address / Domain</div>
                <div className="drawer-addr-row">
                  <span
                    className="mono drawer-addr"
                    title={row.address}
                  >
                    {row.address}
                  </span>
                  <CopyButton address={row.address} />
                </div>
              </section>

              {/* Badges */}
              <section className="drawer-section">
                <div className="drawer-label">Classification</div>
                <div className="drawer-badges">
                  <Badge type={row.type} />
                  {sourceStyle && (
                    <span
                      className="badge drawer-source-badge"
                      style={{
                        color: sourceStyle.color,
                        background: sourceStyle.bg,
                        borderColor: sourceStyle.border,
                      }}
                    >
                      {sourceStyle.label}
                    </span>
                  )}
                </div>
              </section>

              {/* Confidence */}
              <section className="drawer-section">
                <div className="drawer-label">Confidence</div>
                <div className="drawer-conf-row">
                  <ConfBar value={Math.round(row.confidence * 100)} />
                </div>
              </section>

              {/* Dates */}
              <section className="drawer-section">
                <div className="drawer-label">Last Updated</div>
                <div className="drawer-value">{formatDate(row.last_updated)}</div>
              </section>
            </div>

            {/* Footer — inline report */}
            <div className="drawer-footer">
              <InlineReport address={row.address} />
            </div>
          </>
        )}
      </aside>
    </>
  )
}
