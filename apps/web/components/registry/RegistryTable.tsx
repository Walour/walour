'use client'

import { useState, useCallback } from 'react'
import Badge from '@/components/ui/Badge'
import ConfBar from '@/components/ui/ConfBar'
import type { ThreatRow } from '@/lib/types'

interface RegistryTableProps {
  rows: ThreatRow[]
  loading?: boolean
}

const SKELETON_COUNT = 8

function CopyButton({ address }: { address: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
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

export default function RegistryTable({ rows, loading = false }: RegistryTableProps) {
  return (
    <div className="table-card">
      <table className="threats">
        <thead>
          <tr>
            <th scope="col">Address / Domain</th>
            <th scope="col">Type</th>
            <th scope="col">Confidence</th>
            <th scope="col">Date Reported</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <SkeletonRows />
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={4}>
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
            rows.map(row => (
              <tr key={row.id}>
                <td>
                  <div className="addr-cell">
                    <span className="mono">{truncateAddress(row.address)}</span>
                    <CopyButton address={row.address} />
                  </div>
                </td>
                <td>
                  <Badge type={row.type} />
                </td>
                <td className="col-conf">
                  <ConfBar value={Math.round(row.confidence * 100)} />
                </td>
                <td className="col-date">{formatDate(row.last_updated)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
