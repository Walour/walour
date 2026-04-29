'use client'

import { useEffect, useRef, useState } from 'react'
import ExtensionPopup from './ExtensionPopup'

function Connector() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [drawn, setDrawn] = useState(false)

  useEffect(() => {
    const el = wrapRef.current?.closest('.how-grid-wrapper')
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setDrawn(true)
      },
      { threshold: 0.4 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <div className="how-connector" ref={wrapRef}>
      <svg width="60" height="40" viewBox="0 0 60 40" fill="none">
        <path
          d="M0 20 Q30 5 60 20"
          stroke="var(--accent)"
          strokeWidth="1.5"
          strokeDasharray="5 4"
          style={{
            transition: 'stroke-dashoffset 900ms ease-out',
            strokeDashoffset: drawn ? 0 : 200,
          }}
          fill="none"
        />
        {drawn && (
          <circle r="3" fill="var(--accent)">
            <animateMotion dur="2.4s" repeatCount="indefinite" path="M0 20 Q30 5 60 20" />
          </circle>
        )}
      </svg>
    </div>
  )
}

function ScanDiagram() {
  const [scanPos, setScanPos] = useState(0)
  const [litNode, setLitNode] = useState(-1)

  useEffect(() => {
    let dir = 1
    let pos = 0
    const id = setInterval(() => {
      pos += dir * 2
      if (pos >= 100) {
        dir = -1
        setLitNode(2)
      }
      if (pos <= 0) {
        dir = 1
        setLitNode(0)
      }
      if (pos === 50) setLitNode(1)
      setScanPos(pos)
    }, 24)
    return () => clearInterval(id)
  }, [])

  const nodes = ['W', '◈', '⬡']
  return (
    <div style={{ width: '100%', padding: '0 12px' }}>
      <svg width="100%" height="60" viewBox="0 0 240 60" preserveAspectRatio="xMidYMid meet">
        <line x1="32" y1="30" x2="208" y2="30" stroke="var(--border)" strokeWidth="1.5" strokeDasharray="4 3" />
        <rect
          x={32 + ((208 - 32) * scanPos) / 100 - 8}
          y="20"
          width="16"
          height="20"
          rx="2"
          fill="url(#scanGrad)"
          opacity="0.6"
        />
        <defs>
          <linearGradient id="scanGrad" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0" />
            <stop offset="50%" stopColor="var(--accent)" stopOpacity="0.8" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[32, 120, 208].map((x, i) => (
          <g key={i}>
            <circle
              cx={x}
              cy={30}
              r={14}
              fill={litNode === i ? 'rgba(0,201,167,0.15)' : 'var(--surface-elevated)'}
              stroke={litNode === i ? 'var(--accent)' : 'var(--border)'}
              strokeWidth="1.5"
              style={{ transition: 'all 200ms ease' }}
            />
            <text
              x={x}
              y={34}
              textAnchor="middle"
              fill={litNode === i ? 'var(--accent)' : 'var(--text-muted)'}
              fontSize="10"
              fontFamily="var(--mono)"
            >
              {nodes[i]}
            </text>
          </g>
        ))}
      </svg>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 10,
          color: 'var(--text-muted)',
          marginTop: 4,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}
      >
        <span>Wallet</span>
        <span>Oracle</span>
        <span>Contract</span>
      </div>
    </div>
  )
}

export default function HowItWorks() {
  const [visible, setVisible] = useState(false)
  const gridRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = gridRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setVisible(true)
      },
      { threshold: 0.2 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <section className="how-section">
      <div className="container">
        <div className="how-section-head">
          <h2>How Walour protects you</h2>
          <p>From install to intercepted drain — under 400ms.</p>
        </div>
        <div ref={gridRef} className="how-grid-wrapper">
          <div
            className={`how-step-card glass tile${visible ? ' in' : ''}`}
            style={{ transitionDelay: '0ms' }}
          >
            <div className="step-num">01</div>
            <div className="step-visual-area">
              <div style={{ textAlign: 'center' }}>
                <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true">
                  <rect
                    x="8"
                    y="8"
                    width="48"
                    height="38"
                    rx="6"
                    fill="var(--surface-elevated)"
                    stroke="var(--border)"
                    strokeWidth="1.5"
                  />
                  <rect
                    x="8"
                    y="8"
                    width="48"
                    height="10"
                    rx="6"
                    fill="var(--surface)"
                    stroke="var(--border)"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M28 30 h4 a2 2 0 0 0 0-4 v-4 h12 v4 a2 2 0 0 0 0 4 h0 v6 h-4 a2 2 0 0 0-4 0 v4 h-8 z"
                    fill="var(--accent)"
                    opacity="0.85"
                  />
                </svg>
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 12,
                    color: 'var(--safe)',
                    fontWeight: 600,
                  }}
                >
                  ✓ Extension ready
                </div>
              </div>
            </div>
            <div>
              <h3 className="step-title">Install</h3>
              <p className="step-body">
                Add Walour to Chrome in 10 seconds. Works with any wallet — Phantom, Solflare, Backpack.
              </p>
            </div>
          </div>

          <Connector />

          <div
            className={`how-step-card glass tile${visible ? ' in' : ''}`}
            style={{ transitionDelay: '150ms' }}
          >
            <div className="step-num">02</div>
            <div className="step-visual-area">
              <ScanDiagram />
            </div>
            <div>
              <h3 className="step-title">Scan</h3>
              <p className="step-body">
                Every signing request is checked against the on-chain oracle, AI threat models, and community reports in under 400ms.
              </p>
            </div>
          </div>

          <Connector />

          <div
            className={`how-step-card glass tile${visible ? ' in' : ''}`}
            style={{ transitionDelay: '300ms' }}
          >
            <div className="step-num">03</div>
            <div className="step-visual-area" style={{ alignItems: 'flex-start', paddingTop: 8 }}>
              <ExtensionPopup loop initialState="scanning" />
            </div>
            <div>
              <h3 className="step-title">Protected</h3>
              <p className="step-body">
                Walour intercepts and warns you before your wallet signs. Clear verdict. One click to reject.
              </p>
            </div>
          </div>
        </div>
      </div>
      <style>{`
        @media (max-width: 960px) {
          .how-grid-wrapper { display: flex; flex-direction: column; gap: 24px; }
        }
      `}</style>
    </section>
  )
}
