'use client'

import React, { useEffect, useRef, useState } from 'react'
import TileVisualBrowser from './TileVisualBrowser'
import TileVisualCode from './TileVisualCode'
import TileVisualChain from './TileVisualChain'

function ShieldIcon() {
  return (
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
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}

function CodeIcon() {
  return (
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
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  )
}

function ChainIcon() {
  return (
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
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  )
}

interface TileData {
  icon: React.ReactNode
  visual: React.ReactNode
  eyebrow: string
  title: string
  description: string
  delay: number
}

const TILES: TileData[] = [
  {
    icon: <ShieldIcon />,
    visual: <TileVisualBrowser />,
    eyebrow: 'Browser Extension',
    title: 'Chrome Extension',
    description:
      'Intercepts every signing request from Phantom, Solflare, and Backpack. Verdict in under 400ms. One click to reject.',
    delay: 0,
  },
  {
    icon: <CodeIcon />,
    visual: <TileVisualCode />,
    eyebrow: 'Developer SDK',
    title: '@walour/sdk',
    description:
      'Drop into any wallet adapter or backend. Cache-first lookups: sub-100ms warm, under 400ms cold.',
    delay: 150,
  },
  {
    icon: <ChainIcon />,
    visual: <TileVisualChain />,
    eyebrow: 'Live Oracle',
    title: 'On-Chain Oracle',
    description:
      'Every threat entry is signed and written to Solana. Any protocol can read it. No protocol has to trust us.',
    delay: 300,
  },
]

export default function FeatureTiles() {
  const [visible, setVisible] = useState(false)
  const gridRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = gridRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <section style={{ padding: '48px 0' }}>
      <div className="container">
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h2 style={{ fontSize: 'clamp(28px,4vw,42px)', fontWeight: 700, letterSpacing: '-0.03em', margin: '0 0 12px' }}>
            One install. Three layers between you and a drainer.
          </h2>
          <p style={{ fontSize: 16, color: 'var(--text-muted)', margin: 0 }}>
            Extension at the wallet, SDK at the dApp, oracle on-chain.
          </p>
        </div>
        <div
          ref={gridRef}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 16,
          }}
          className="feature-tiles-grid"
        >
          {TILES.map(tile => (
            <div
              key={tile.title}
              className={`tile glass tile-hover-scan${visible ? ' in' : ''}`}
              style={{
                padding: 28,
                borderRadius: 'var(--radius-md)',
                animationDelay: visible ? `${tile.delay}ms` : '0ms',
                transitionDelay: visible ? `${tile.delay}ms` : '0ms',
              }}
            >
              <div
                className="tile-icon"
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 'var(--radius)',
                  background: 'rgba(0, 201, 167, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent)',
                  marginBottom: 18,
                }}
              >
                {tile.icon}
              </div>

              <div className="tile-visual-wrap">{tile.visual}</div>

              <p
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.8px',
                  textTransform: 'uppercase',
                  color: 'var(--accent)',
                  margin: '14px 0 6px',
                  opacity: 0.8,
                }}
              >
                {tile.eyebrow}
              </p>

              <h3
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  letterSpacing: '-0.2px',
                  margin: '0 0 10px',
                  color: 'var(--text)',
                  fontFamily: tile.title.startsWith('@')
                    ? 'ui-monospace, "SF Mono", "Roboto Mono", Consolas, monospace'
                    : 'inherit',
                }}
              >
                {tile.title}
              </h3>

              <p
                style={{
                  color: 'var(--text-muted)',
                  fontSize: 14,
                  lineHeight: 1.6,
                  margin: 0,
                }}
              >
                {tile.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .feature-tiles-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </section>
  )
}
