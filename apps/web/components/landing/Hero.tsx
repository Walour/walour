'use client'

import { useEffect, useRef, useState } from 'react'
import ExtensionPopup from './ExtensionPopup'

interface HeroProps {
  threatsIndexed?: number
}

function ChromeIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="4" />
      <line x1="21.17" y1="8" x2="12" y2="8" />
      <line x1="3.95" y1="6.06" x2="8.54" y2="14" />
      <line x1="10.88" y1="21.94" x2="15.46" y2="14" />
    </svg>
  )
}

export default function Hero({ threatsIndexed }: HeroProps) {
  const [mounted, setMounted] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const inClass = mounted ? ' in' : ''

  return (
    <section
      ref={sectionRef}
      style={{
        padding: 'clamp(28px, 4vw, 48px) 0 48px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div className="hero-scan-beam" aria-hidden="true" />
      <div className="container" style={{ position: 'relative', zIndex: 1 }}>
        <div className="hero-two-col">
          {/* Left column */}
          <div>
            <div style={{ marginBottom: 28 }}>
              <div className={`eyebrow-pill fade-up d1${inClass}`}>
                <span className="live-dot" />
                Oracle live on Solana devnet ·{' '}
                {threatsIndexed !== undefined
                  ? threatsIndexed.toLocaleString()
                  : '...'}{' '}
                threats indexed
              </div>
            </div>

            <h1
              className={`fade-up d2${inClass}`}
              style={{
                fontSize: 'clamp(38px, 6vw, 64px)',
                fontWeight: 700,
                lineHeight: 1.05,
                letterSpacing: '-1.5px',
                margin: '0 0 20px',
              }}
            >
              Block the <span className="glow-word">drain</span>
              <br />
              <span style={{ color: 'var(--accent)' }}>before you sign it.</span>
            </h1>

            <p
              className={`fade-up d3${inClass}`}
              style={{
                fontSize: 18,
                color: 'var(--text-muted)',
                maxWidth: 560,
                margin: '0 0 36px',
                lineHeight: 1.55,
              }}
            >
              Walour inspects every Solana transaction in under 400ms and warns
              you before your wallet signs anything malicious.
            </p>

            <div
              className={`fade-up d4${inClass}`}
              style={{
                display: 'flex',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <a href="#" className="btn btn-primary">
                <ChromeIcon />
                Add to Chrome
              </a>
              <a href="/registry" className="btn btn-secondary">
                Browse the Registry
              </a>
            </div>
          </div>

          {/* Right column — extension popup mockup */}
          <div className="hero-mock-col">
            <div className="hero-mock-inner">
              <ExtensionPopup loop initialState="scanning" />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
