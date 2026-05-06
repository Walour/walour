'use client';

import { useState, useEffect, useRef } from 'react';

import Link from 'next/link';
import { usePathname } from 'next/navigation';


export default function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      if (y > lastY.current && y > 80) {
        setHidden(true);
      } else if (y < lastY.current) {
        setHidden(false);
      }
      lastY.current = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close mobile menu on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const links = [
    { href: '/', label: 'Home' },
    { href: '/registry', label: 'Registry' },
    { href: '/stats', label: 'Stats' },
    { href: '/docs', label: 'Docs' },
  ];

  return (
    <nav
      ref={navRef}
      className={`nav${hidden ? ' nav-hidden' : ''}`}
      role="navigation"
      aria-label="Main navigation"
    >
      {/* ── pill bar ────────────────────────────────────────── */}
      <div className="nav-inner">
        <Link href="/" className="brand" aria-label="Walour home">
          <svg
            className="brand-icon"
            viewBox="-80 -80 160 160"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            width="28"
            height="28"
          >
            <polygon points="0,-68 59,-34 59,34 0,68 -59,34 -59,-34" fill="none" stroke="#00C9A7" strokeWidth="4.5" strokeLinejoin="round" />
            <polygon points="0,-46 40,-23 40,23 0,46 -40,23 -40,-23" fill="none" stroke="#00C9A7" strokeWidth="1.5" strokeLinejoin="round" opacity="0.3" />
            <polyline points="-40,-23 -18,26 0,6" fill="none" stroke="#00C9A7" strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" />
            <polyline points="40,-23 18,26 0,6" fill="none" stroke="#00C9A7" strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" />
            <polygon points="-28,-36 -16,-29 -16,-16 -28,-9 -40,-16 -40,-29" fill="none" stroke="#00C9A7" strokeWidth="0.8" opacity="0.18" />
            <polygon points="28,-36 40,-29 40,-16 28,-9 16,-16 16,-29" fill="none" stroke="#00C9A7" strokeWidth="0.8" opacity="0.18" />
            <polygon points="0,13 12,20 12,33 0,40 -12,33 -12,20" fill="none" stroke="#00C9A7" strokeWidth="0.8" opacity="0.18" />
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

        {/* Desktop links — centered via absolute CSS, display:none on mobile */}
        <div className="nav-links">
          {links.map(({ href, label }) => (
            <Link key={href} href={href} className={pathname === href ? 'active' : ''}>
              {label}
            </Link>
          ))}
        </div>

        {/* Right group: CTA (hidden on mobile) + theme + hamburger */}
        <div className="nav-right">
          <a href="#chrome" className="nav-cta">Add to Chrome</a>
          <button
            className="hamburger"
            onClick={() => setOpen(prev => !prev)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="nav-mobile-menu"
            type="button"
          >
            {open ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* ── Mobile dropdown — OUTSIDE nav-inner so overflow:hidden can't clip it ── */}
      <div
        id="nav-mobile-menu"
        className={`nav-mobile-menu${open ? ' open' : ''}`}
        aria-hidden={!open}
      >
        {links.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={`nav-mobile-link${pathname === href ? ' active' : ''}`}
            onClick={() => setOpen(false)}
          >
            {label}
          </Link>
        ))}
        <a href="#chrome" className="nav-mobile-cta" onClick={() => setOpen(false)}>
          Add to Chrome
        </a>
      </div>
    </nav>
  );
}
