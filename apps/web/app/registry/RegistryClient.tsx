'use client'

import { useState, useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import FilterBar from '@/components/registry/FilterBar'
import RegistryTable from '@/components/registry/RegistryTable'
import DetailDrawer from '@/components/registry/DetailDrawer'
import Pager from '@/components/registry/Pager'
import type { ThreatRow } from '@/lib/types'

const PAGE_SIZE = 25

interface RegistryClientProps {
  initialRows: ThreatRow[]
  initialTotal: number
  initialPage: number
  initialSearch: string
  initialType: string
}

export default function RegistryClient({
  initialRows,
  initialTotal,
  initialPage,
  initialSearch,
  initialType,
}: RegistryClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [rows, setRows] = useState<ThreatRow[]>(initialRows)
  const [total, setTotal] = useState(initialTotal)
  const [page, setPage] = useState(initialPage)
  const [search, setSearch] = useState(initialSearch)
  const [type, setType] = useState(initialType)
  const [loading, setLoading] = useState(false)
  const [selectedRow, setSelectedRow] = useState<ThreatRow | null>(null)
  const [reportOpen, setReportOpen] = useState(false)

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const updateUrl = useCallback(
    (nextSearch: string, nextType: string, nextPage: number) => {
      const params = new URLSearchParams()
      if (nextSearch) params.set('q', nextSearch)
      if (nextType !== 'all') params.set('type', nextType)
      if (nextPage > 1) params.set('page', String(nextPage))
      const qs = params.toString()
      startTransition(() => {
        router.push(`/registry${qs ? `?${qs}` : ''}`, { scroll: false })
      })
    },
    [router]
  )

  const fetchData = useCallback(
    async (nextSearch: string, nextType: string, nextPage: number) => {
      setLoading(true)
      try {
        const params = new URLSearchParams({
          q: nextSearch,
          type: nextType,
          page: String(nextPage),
        })
        const res = await fetch(`/api/threats?${params.toString()}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data: { rows: ThreatRow[]; total: number } = await res.json()
        setRows(data.rows)
        setTotal(data.total)
      } catch (err) {
        console.error('[RegistryClient] fetch failed', err)
      } finally {
        setLoading(false)
      }
    },
    []
  )

  const handleSearch = useCallback(
    (q: string) => {
      const nextPage = 1
      setSearch(q)
      setPage(nextPage)
      updateUrl(q, type, nextPage)
      fetchData(q, type, nextPage)
    },
    [type, updateUrl, fetchData]
  )

  const handleType = useCallback(
    (t: string) => {
      const nextPage = 1
      setType(t)
      setPage(nextPage)
      updateUrl(search, t, nextPage)
      fetchData(search, t, nextPage)
    },
    [search, updateUrl, fetchData]
  )

  const handlePage = useCallback(
    (p: number) => {
      setPage(p)
      updateUrl(search, type, p)
      fetchData(search, type, p)
      // Scroll to top of table area smoothly
      window.scrollTo({ top: 160, behavior: 'smooth' })
    },
    [search, type, updateUrl, fetchData]
  )

  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(page * PAGE_SIZE, total)

  return (
    <>
      <FilterBar
        onSearch={handleSearch}
        onType={handleType}
        search={search}
        type={type}
      />

      <div className="registry-meta">
        <div>
          {total === 0 ? (
            <span>No threats found</span>
          ) : (
            <>
              Showing <strong>{rangeStart}–{rangeEnd}</strong> of{' '}
              <strong>{total.toLocaleString()}</strong> threats
            </>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div aria-live="polite" aria-atomic="true">
            {(loading || isPending) && (
              <span style={{ color: 'var(--text-muted)' }}>Loading…</span>
            )}
          </div>
          <button
            className="btn btn-secondary"
            style={{ fontSize: 13, padding: '6px 14px' }}
            onClick={() => setReportOpen(true)}
          >
            + Report a threat
          </button>
        </div>
      </div>

      <div style={{ marginTop: 0 }}>
        <RegistryTable
          rows={rows}
          loading={loading}
          onRowClick={(row) => setSelectedRow(row)}
        />
        {totalPages > 1 && (
          <Pager page={page} totalPages={totalPages} onChange={handlePage} />
        )}
      </div>

      <DetailDrawer
        row={selectedRow}
        onClose={() => setSelectedRow(null)}
      />

      <ReportModal open={reportOpen} onClose={() => setReportOpen(false)} />
    </>
  )
}

// ─── Standalone report modal ─────────────────────────────────────────────────

const THREAT_TYPES = [
  { value: 'drainer', label: 'Wallet Drainer' },
  { value: 'rug', label: 'Rug Pull' },
  { value: 'phishing_domain', label: 'Phishing Site' },
  { value: 'malicious_token', label: 'Malicious Token' },
] as const

type SubmitState = 'idle' | 'submitting' | 'done' | 'error'

function ReportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [address, setAddress] = useState('')
  const [type, setType] = useState('phishing_domain')
  const [submitState, setSubmitState] = useState<SubmitState>('idle')

  function reset() {
    setAddress('')
    setType('phishing_domain')
    setSubmitState('idle')
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!address.trim()) return
    setSubmitState('submitting')
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: address.trim(), type }),
      })
      setSubmitState(res.ok ? 'done' : 'error')
    } catch {
      setSubmitState('error')
    }
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={reset}
        style={{
          position: 'fixed', inset: 0, zIndex: 199,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        }}
        aria-hidden="true"
      />
      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Report a threat"
        style={{
          position: 'fixed', top: '50%', left: '50%', zIndex: 200,
          transform: 'translate(-50%, -50%)',
          width: 'min(480px, calc(100vw - 32px))',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: 28,
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        }}
      >
        {submitState === 'done' ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>✓</div>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700 }}>Report submitted</h3>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: '0 0 20px' }}>
              Confidence starts at 0.5 and increases as other sources corroborate it.
            </p>
            <button className="btn btn-primary" onClick={reset} style={{ fontSize: 13 }}>Done</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Report a threat</h3>
              <button type="button" onClick={reset} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 18, lineHeight: 1, padding: 4 }}>×</button>
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="report-address">Address / Domain</label>
              <input
                id="report-address"
                className="form-input"
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="Solana address or phishing domain…"
                required
                autoFocus
              />
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="report-type">Threat type</label>
              <select id="report-type" className="form-select" value={type} onChange={e => setType(e.target.value)}>
                {THREAT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            {submitState === 'error' && (
              <div className="form-error-banner">Submission failed. Please try again.</div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button type="submit" className="btn btn-primary" disabled={submitState === 'submitting'} style={{ flex: 1, fontSize: 13 }}>
                {submitState === 'submitting' ? 'Submitting…' : 'Submit report'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={reset} style={{ fontSize: 13 }}>Cancel</button>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '10px 0 0', textAlign: 'center' }}>
              Anonymous. Your IP is not logged.
            </p>
          </form>
        )}
      </div>
    </>
  )
}
