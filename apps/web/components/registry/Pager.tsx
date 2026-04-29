'use client'

interface PagerProps {
  page: number
  totalPages: number
  onChange: (p: number) => void
}

function getPages(page: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const set = new Set(
    [1, total, page - 1, page, page + 1].filter(p => p >= 1 && p <= total)
  )
  const sorted = Array.from(set).sort((a, b) => a - b)

  const result: (number | '...')[] = []
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push('...')
    result.push(sorted[i])
  }
  return result
}

export default function Pager({ page, totalPages, onChange }: PagerProps) {
  if (totalPages <= 1) return null

  const pages = getPages(page, totalPages)

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        justifyContent: 'center',
        paddingTop: 16,
      }}
      role="navigation"
      aria-label="Pagination"
    >
      <button
        className="pager-btn"
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
        aria-label="Previous page"
        type="button"
      >
        ← Prev
      </button>

      {pages.map((p, i) =>
        p === '...' ? (
          <span
            key={`ellipsis-${i}`}
            style={{ padding: '0 6px', color: 'var(--text-disabled)', userSelect: 'none' }}
            aria-hidden="true"
          >
            …
          </span>
        ) : (
          <button
            key={p}
            className={`pager-btn${p === page ? ' active' : ''}`}
            onClick={() => p !== page && onChange(p as number)}
            aria-label={`Page ${p}`}
            aria-current={p === page ? 'page' : undefined}
            type="button"
          >
            {p}
          </button>
        )
      )}

      <button
        className="pager-btn"
        disabled={page === totalPages}
        onClick={() => onChange(page + 1)}
        aria-label="Next page"
        type="button"
      >
        Next →
      </button>
    </div>
  )
}
