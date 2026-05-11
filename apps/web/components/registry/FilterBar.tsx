'use client'

interface FilterBarProps {
  onSearch: (q: string) => void
  onType: (t: string) => void
  search: string
  type: string
}

export default function FilterBar({ onSearch, onType, search, type }: FilterBarProps) {
  return (
    <div className="filter-bar">
      {/* Search input */}
      <div className="search-wrap">
        <svg
          width="16"
          height="16"
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
        <input
          className="input"
          type="search"
          placeholder="Search address or domain…"
          value={search}
          onChange={e => onSearch(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          aria-label="Search threats"
        />
      </div>

      {/* Type dropdown */}
      <div className="select-wrap">
        <select
          className="select"
          value={type}
          onChange={e => onType(e.target.value)}
          aria-label="Filter by threat type"
        >
          <option value="all">All types</option>
          <option value="drainer">Drainer</option>
          <option value="rug">Rug</option>
          <option value="phishing_domain">Phishing</option>
          <option value="malicious_token">Malicious Token</option>
        </select>
      </div>
    </div>
  )
}
