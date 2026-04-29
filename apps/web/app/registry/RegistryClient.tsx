'use client'

import { useState, useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import FilterBar from '@/components/registry/FilterBar'
import RegistryTable from '@/components/registry/RegistryTable'
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
        <div aria-live="polite" aria-atomic="true">
          {(loading || isPending) && (
            <span style={{ color: 'var(--text-muted)' }}>Loading…</span>
          )}
        </div>
      </div>

      <div style={{ marginTop: 0 }}>
        <RegistryTable rows={rows} loading={loading} />
        {totalPages > 1 && (
          <Pager page={page} totalPages={totalPages} onChange={handlePage} />
        )}
      </div>
    </>
  )
}
