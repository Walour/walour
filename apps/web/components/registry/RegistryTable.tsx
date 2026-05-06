'use client'

import { useState, useCallback } from 'react'
import Badge from '@/components/ui/Badge'
import ConfBar from '@/components/ui/ConfBar'
import type { ThreatRow } from '@/lib/types'

interface RegistryTableProps {
  rows: ThreatRow[]
  loading?: boolean
  onRowClick?: (row: ThreatRow) => void
}

const SKELETON_COUNT = 8

// Source badge styles mirror the DetailDrawer spec
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

function CopyButton({ address }: { address: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    // Prevent the click from bubbling up to the row's onRowClick
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 1000)
    } catch {
      // clipboard API may be unavailable in some contexts — silently ignore
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
          width="13"
          height="13"
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
          width="13"
          height="13"
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

function truncateAddress(addr: string): string {
  if (addr.length <= 12) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: SKELETON_COUNT }, (_, i) => (
        <tr key={i} className="skeleton-row">
          <td>
            <div className="addr-cell">
              <div className="skeleton-bar" style={{ width: 120 }} />
            </div>
          </td>
          <td>
            <div className="skeleton-bar" style={{ width: 72 }} />
          </td>
          <td>
            <div className="skeleton-bar" style={{ width: 56 }} />
          </td>
          <td className="col-conf">
            <div className="skeleton-bar" style={{ width: '100%', maxWidth: 160 }} />
          </td>
          <td className="col-date">
            <div className="skeleton-bar" style={{ width: 96 }} />
          </td>
        </tr>
      ))}
    </>
  )
}

export default function RegistryTable({ rows, loading = false, onRowClick }: RegistryTableProps) {
  return (
    <div className="table-card">
      <div className="table-card-scroll">
      <table className="threats">
        <thead>
          <tr>
            <th scope="col">Address / Domain</th>
            <th scope="col">Type</th>
            <th scope="col">Source</th>
            <th scope="col">Confidence</th>
            <th scope="col">Date Reported</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <SkeletonRows />
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={5}>
                <div className="registry-empty">
                  <div className="registry-empty-icon">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                  </div>
                  <div>No threats match your filters.</div>
                </div>
              </td>
            </tr>
          ) : (
            rows.map(row => {
              const sourceStyle = getSourceStyle(row.source)
              return (
                <tr
                  key={row.address}
                  onClick={() => onRowClick?.(row)}
                  style={onRowClick ? { cursor: 'pointer' } : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onKeyDown={
                    onRowClick
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            onRowClick(row)
                          }
                        }
                      : undefined
                  }
                  aria-label={onRowClick ? `View details for ${row.address}` : undefined}
                >
                  <td>
                    <div className="addr-cell">
                      <span className="mono">{truncateAddress(row.address)}</span>
                      <CopyButton address={row.address} />
                    </div>
                  </td>
                  <td>
                    <Badge type={row.type} />
                  </td>
                  <td>
                    {sourceStyle ? (
                      <span
                        className="badge"
                        style={{
                          color: sourceStyle.color,
                          background: sourceStyle.bg,
                          borderColor: sourceStyle.border,
                        }}
                      >
                        {sourceStyle.label}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-disabled)', fontSize: 13 }}>—</span>
                    )}
                  </td>
                  <td className="col-conf">
                    <ConfBar value={Math.round(row.confidence * 100)} />
                  </td>
                  <td className="col-date">{formatDate(row.last_updated)}</td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
      </div>
    </div>
  )
}
