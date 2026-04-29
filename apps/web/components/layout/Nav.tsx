'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// ─── ThemeToggle ────────────────────────────────────────────────────────────

function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const stored = document.documentElement.dataset.theme as 'dark' | 'light' | undefined;
    if (stored === 'light' || stored === 'dark') {
      setTheme(stored);
    }
  }, []);

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('theme', next);
    } catch (_) {
      // storage may be blocked in private browsing
    }
  }

  const isDark = theme === 'dark';

  return (
    <button
      className="nav-theme-btn"
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      type="button"
    >
      {isDark ? (
        // Sun icon — shown in dark mode to switch to light
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      ) : (
        // Moon icon — shown in light mode to switch to dark
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}

// ─── Nav ────────────────────────────────────────────────────────────────────

export default function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <nav className="nav" role="navigation" aria-label="Main navigation">
      <div className="nav-inner">
        {/* Brand */}
        <Link href="/" className="brand" aria-label="Walour home">
          <svg
            className="brand-icon"
            viewBox="-80 -80 160 160"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            width="28"
            height="28"
          >
            <polygon
              points="0,-68 59,-34 59,34 0,68 -59,34 -59,-34"
              fill="none"
              stroke="#00C9A7"
              strokeWidth="4.5"
              strokeLinejoin="round"
            />
            <polygon
              points="0,-46 40,-23 40,23 0,46 -40,23 -40,-23"
              fill="none"
              stroke="#00C9A7"
              strokeWidth="1.5"
              strokeLinejoin="round"
              opacity="0.3"
            />
            <polyline
              points="-40,-23 -18,26 0,6"
              fill="none"
              stroke="#00C9A7"
              strokeWidth="3.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <polyline
              points="40,-23 18,26 0,6"
              fill="none"
              stroke="#00C9A7"
              strokeWidth="3.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <polygon
              points="-28,-36 -16,-29 -16,-16 -28,-9 -40,-16 -40,-29"
              fill="none"
              stroke="#00C9A7"
              strokeWidth="0.8"
              opacity="0.18"
            />
            <polygon
              points="28,-36 40,-29 40,-16 28,-9 16,-16 16,-29"
              fill="none"
              stroke="#00C9A7"
              strokeWidth="0.8"
              opacity="0.18"
            />
            <polygon
              points="0,13 12,20 12,33 0,40 -12,33 -12,20"
              fill="none"
              stroke="#00C9A7"
              strokeWidth="0.8"
              opacity="0.18"
            />
            <circle cx="0" cy="-68" r="4.5" fill="#0D1117" stroke="#00C9A7" strokeWidth="1.8" />
            <circle cx="59" cy="-34" r="4.5" fill="#0D1117" stroke="#00C9A7" strokeWidth="1.8" />
            <circle cx="59" cy="34" r="4.5" fill="#0D1117" stroke="#00C9A7" strokeWidth="1.8" />
            <circle cx="0" cy="68" r="4.5" fill="#0D1117" stroke="#00C9A7" strokeWidth="1.8" />
            <circle cx="-59" cy="34" r="4.5" fill="#0D1117" stroke="#00C9A7" strokeWidth="1.8" />
            <circle cx="-59" cy="-34" r="4.5" fill="#0D1117" stroke="#00C9A7" strokeWidth="1.8" />
          </svg>
          <div className="brand-text-block">
            <span className="brand-wordmark">WALOUR</span>
            <span className="brand-tagline">Security Oracle</span>
          </div>
        </Link>

        {/* Nav links */}
        <div className={`nav-links${open ? ' open' : ''}`} id="navlinks">
          <Link href="/" className={pathname === '/' ? 'active' : ''}>
            Home
          </Link>
          <Link
            href="/registry"
            className={pathname === '/registry' ? 'active' : ''}
          >
            Registry
          </Link>
          <Link
            href="/stats"
            className={pathname === '/stats' ? 'active' : ''}
          >
            Stats
          </Link>
          <ThemeToggle />
          <a href="#chrome" className="nav-cta">
            Add to Chrome
          </a>
        </div>

        {/* Hamburger toggle */}
        <button
          className="hamburger"
          onClick={() => setOpen((prev) => !prev)}
          aria-label="Toggle menu"
          aria-expanded={open}
          aria-controls="navlinks"
          type="button"
        >
          {open ? (
            // X icon
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
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            // Hamburger icon
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
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          )}
        </button>
      </div>
    </nav>
  );
}
