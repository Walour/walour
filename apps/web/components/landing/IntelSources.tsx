'use client'

import { useEffect, useState } from 'react'
import { useInView } from '@/hooks/useInView'

const SOURCES = [
  { name: 'Phishing Domains',       tag: '60,000+ known threats',              conf: null, color: '#EF4444' },
  { name: 'Token Risk',              tag: 'Honeypot and rug detection',         conf: null, color: '#A855F7' },
  { name: 'Site Impersonation',      tag: 'Fake wallet and dApp sites',         conf: null, color: '#F59E0B' },
  { name: 'Transaction Simulation',  tag: 'What actually leaves your wallet',   conf: null, color: '#00C9A7' },
  { name: 'AI Analysis',             tag: 'Plain-English explanation',           conf: null, color: '#00C9A7' },
] as const

// SVG canvas geometry — diagram is laid out in a fixed coordinate space then
// scaled responsively. Sources sit on the left, the oracle sits on the right.
const VW = 1000
const VH = 520
const ORACLE = { x: 760, y: VH / 2, w: 220, h: 150 }
const SOURCE_X = 20
const SOURCE_W = 300
const SOURCE_H = 72
const SOURCE_GAP = 24
const SOURCE_TOTAL_H = SOURCES.length * SOURCE_H + (SOURCES.length - 1) * SOURCE_GAP
const SOURCE_Y0 = (VH - SOURCE_TOTAL_H) / 2

function sourceCenter(i: number) {
  const y = SOURCE_Y0 + i * (SOURCE_H + SOURCE_GAP) + SOURCE_H / 2
  return { x: SOURCE_X + SOURCE_W, y }
}

function oracleAnchor() {
  return { x: ORACLE.x, y: ORACLE.y }
}

// Smooth cubic curve from a source row to the oracle anchor.
function pathFor(i: number) {
  const a = sourceCenter(i)
  const b = oracleAnchor()
  const dx = b.x - a.x
  const c1x = a.x + dx * 0.5
  const c1y = a.y
  const c2x = b.x - dx * 0.5
  const c2y = b.y
  return `M ${a.x} ${a.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${b.x} ${b.y}`
}

export default function IntelSources() {
  const { ref, inView } = useInView<HTMLDivElement>({ threshold: 0.18 })
  const [pulse, setPulse] = useState(-1)

  // Sequential "feed firing" pulse — highlights one source at a time so each
  // line gets a brighter dot travelling toward the oracle.
  useEffect(() => {
    if (!inView) return
    let i = 0
    let t: ReturnType<typeof setTimeout>
    const tick = () => {
      setPulse(i % SOURCES.length)
      i++
      t = setTimeout(tick, 900)
    }
    t = setTimeout(tick, 600)
    return () => clearTimeout(t)
  }, [inView])

  return (
    <section style={{ padding: '72px 0' }}>
      <style>{`
        @keyframes wal-flow {
          0%   { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: -28; }
        }
        @keyframes wal-pulse-ring {
          0%   { transform: scale(0.95); opacity: 0.55; }
          70%  { transform: scale(1.35); opacity: 0; }
          100% { transform: scale(1.35); opacity: 0; }
        }
        @keyframes wal-blink {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.35; }
        }
        .wal-line {
          stroke-dasharray: 4 8;
          animation: wal-flow 1.2s linear infinite;
        }
        .wal-source-card {
          transition:
            opacity 0.6s ease,
            transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1),
            border-color 0.25s ease,
            box-shadow 0.25s ease;
          opacity: 0;
          transform: translateX(-16px);
        }
        .wal-source-card.in {
          opacity: 1;
          transform: translateX(0);
        }
        .wal-source-card:hover {
          border-color: rgba(0, 201, 167, 0.35) !important;
          box-shadow: 0 0 30px rgba(0, 201, 167, 0.10);
        }
        .wal-oracle-card {
          transition: opacity 0.7s ease, transform 0.7s cubic-bezier(0.2, 0.8, 0.2, 1);
          opacity: 0;
          transform: scale(0.94);
        }
        .wal-oracle-card.in {
          opacity: 1;
          transform: scale(1);
        }
        .wal-pulse-ring {
          transform-origin: center;
          animation: wal-pulse-ring 2.4s ease-out infinite;
        }
        .wal-live-dot {
          animation: wal-blink 1.6s ease-in-out infinite;
        }
        @media (max-width: 860px) {
          .wal-desktop { display: none !important; }
          .wal-mobile { display: flex !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          .wal-line, .wal-pulse-ring, .wal-live-dot { animation: none !important; }
        }
      `}</style>

      <div className="container">
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h2 style={{
            fontSize: 'clamp(28px, 4.4vw, 44px)',
            fontWeight: 700,
            letterSpacing: '-0.03em',
            margin: '0 0 14px',
            lineHeight: 1.05,
          }}>
            Five layers of protection.
          </h2>
          <p style={{
            color: 'var(--text-muted)',
            fontSize: 16,
            lineHeight: 1.6,
            maxWidth: 580,
            margin: '0 auto',
          }}>
            Every transaction you sign is checked against five independent threat signals before the approval prompt appears.
          </p>
        </div>

        <div ref={ref} style={{ position: 'relative' }}>
          {/* Desktop / tablet: SVG flow diagram with HTML cards overlaid */}
          <div
            className="wal-desktop"
            style={{
              position: 'relative',
              width: '100%',
              aspectRatio: `${VW} / ${VH}`,
              maxWidth: 1100,
              margin: '0 auto',
            }}
          >
            <svg
              viewBox={`0 0 ${VW} ${VH}`}
              width="100%"
              height="100%"
              preserveAspectRatio="xMidYMid meet"
              style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
              aria-hidden
            >
              <defs>
                <radialGradient id="wal-oracle-glow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#00C9A7" stopOpacity="0.25" />
                  <stop offset="60%" stopColor="#00C9A7" stopOpacity="0.05" />
                  <stop offset="100%" stopColor="#00C9A7" stopOpacity="0" />
                </radialGradient>
                {SOURCES.map((s, i) => (
                  <linearGradient
                    key={s.name}
                    id={`wal-grad-${i}`}
                    gradientUnits="userSpaceOnUse"
                    x1={sourceCenter(i).x}
                    y1={sourceCenter(i).y}
                    x2={oracleAnchor().x}
                    y2={oracleAnchor().y}
                  >
                    <stop offset="0%" stopColor={s.color} stopOpacity="0.85" />
                    <stop offset="100%" stopColor="#00C9A7" stopOpacity="0.85" />
                  </linearGradient>
                ))}
              </defs>

              {/* Soft glow behind the oracle */}
              <circle
                cx={ORACLE.x + ORACLE.w / 2}
                cy={ORACLE.y}
                r={170}
                fill="url(#wal-oracle-glow)"
              />

              {/* Connector lines — one per source */}
              {SOURCES.map((s, i) => {
                const d = pathFor(i)
                const isActive = pulse === i
                return (
                  <g key={s.name}>
                    {/* Faint base line */}
                    <path
                      d={d}
                      fill="none"
                      stroke={`url(#wal-grad-${i})`}
                      strokeWidth={1.25}
                      opacity={inView ? 0.55 : 0}
                      style={{ transition: 'opacity 0.8s ease', transitionDelay: `${i * 90 + 200}ms` }}
                    />
                    {/* Animated dashed flow */}
                    <path
                      className={inView ? 'wal-line' : ''}
                      d={d}
                      fill="none"
                      stroke={`url(#wal-grad-${i})`}
                      strokeWidth={1.5}
                      opacity={inView ? 0.9 : 0}
                      style={{ transition: 'opacity 0.8s ease', transitionDelay: `${i * 90 + 300}ms` }}
                    />
                    {/* Travelling dot — uses animateMotion to ride the path */}
                    {inView && (
                      <circle r={isActive ? 4.5 : 3} fill={s.color}>
                        <animateMotion
                          dur={isActive ? '1.1s' : '2.6s'}
                          repeatCount="indefinite"
                          path={d}
                        />
                        {isActive && (
                          <animate
                            attributeName="opacity"
                            values="1;0.6;1"
                            dur="1.1s"
                            repeatCount="indefinite"
                          />
                        )}
                      </circle>
                    )}
                    {/* Anchor dot at source edge */}
                    <circle
                      cx={sourceCenter(i).x}
                      cy={sourceCenter(i).y}
                      r={3}
                      fill={s.color}
                      opacity={inView ? 1 : 0}
                      style={{ transition: 'opacity 0.6s ease', transitionDelay: `${i * 90 + 400}ms` }}
                    />
                  </g>
                )
              })}

              {/* Oracle pulse rings — purely decorative */}
              {inView && (
                <>
                  <circle
                    className="wal-pulse-ring"
                    cx={ORACLE.x + ORACLE.w / 2}
                    cy={ORACLE.y}
                    r={ORACLE.w / 2 + 8}
                    fill="none"
                    stroke="rgba(0, 201, 167, 0.45)"
                    strokeWidth={1}
                  />
                  <circle
                    className="wal-pulse-ring"
                    cx={ORACLE.x + ORACLE.w / 2}
                    cy={ORACLE.y}
                    r={ORACLE.w / 2 + 8}
                    fill="none"
                    stroke="rgba(0, 201, 167, 0.3)"
                    strokeWidth={1}
                    style={{ animationDelay: '1.2s' }}
                  />
                </>
              )}
            </svg>

            {/* Source cards — absolutely positioned in % so they track the SVG viewBox */}
            {SOURCES.map((s, i) => {
              const top = (SOURCE_Y0 + i * (SOURCE_H + SOURCE_GAP)) / VH * 100
              const left = SOURCE_X / VW * 100
              const width = SOURCE_W / VW * 100
              const height = SOURCE_H / VH * 100
              return (
                <div
                  key={s.name}
                  className={`glass wal-source-card${inView ? ' in' : ''}`}
                  style={{
                    position: 'absolute',
                    top: `${top}%`,
                    left: `${left}%`,
                    width: `${width}%`,
                    height: `${height}%`,
                    borderRadius: 'var(--radius-md)',
                    padding: '10px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    gap: 4,
                    transitionDelay: `${i * 90}ms`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{s.name}</span>
                    {s.conf !== null ? (
                      <span style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: s.color,
                        background: `${s.color}1A`,
                        padding: '2px 7px',
                        borderRadius: 99,
                        letterSpacing: '0.04em',
                        whiteSpace: 'nowrap',
                      }}>
                        {s.conf}% conf
                      </span>
                    ) : (
                      <span style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        background: 'rgba(255,255,255,0.05)',
                        padding: '2px 7px',
                        borderRadius: 99,
                        letterSpacing: '0.04em',
                        whiteSpace: 'nowrap',
                      }}>
                        live
                      </span>
                    )}
                  </div>
                  <span style={{
                    fontSize: 10.5,
                    fontWeight: 600,
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase',
                    color: 'var(--text-muted)',
                  }}>
                    {s.tag}
                  </span>
                </div>
              )
            })}

            {/* Oracle output card */}
            <div
              className={`glass wal-oracle-card${inView ? ' in' : ''}`}
              style={{
                position: 'absolute',
                top: `${(ORACLE.y - ORACLE.h / 2) / VH * 100}%`,
                left: `${ORACLE.x / VW * 100}%`,
                width: `${ORACLE.w / VW * 100}%`,
                height: `${ORACLE.h / VH * 100}%`,
                borderRadius: 'var(--radius-lg)',
                border: '1px solid rgba(0, 201, 167, 0.45)',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                justifyContent: 'center',
                boxShadow: '0 0 80px rgba(0, 201, 167, 0.18)',
                transitionDelay: '500ms',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  className="wal-live-dot"
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 99,
                    background: 'var(--accent)',
                    boxShadow: '0 0 10px var(--accent)',
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--accent)', letterSpacing: '-0.01em' }}>
                  Walour Oracle
                </span>
                <span style={{
                  marginLeft: 'auto',
                  fontSize: 9.5,
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  background: 'rgba(255,255,255,0.05)',
                  padding: '2px 7px',
                  borderRadius: 99,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}>
                  on-chain
                </span>
              </div>
              <span style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
              }}>
                Unified output
              </span>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
                Confidence-weighted threat data. Queryable by any Solana program with no API key or trust assumption.
              </p>
            </div>
          </div>

          {/* Mobile: vertical stack with arrow connectors */}
          <div
            className="wal-mobile"
            style={{
              display: 'none',
              flexDirection: 'column',
              gap: 10,
              maxWidth: 480,
              margin: '0 auto',
            }}
          >
            {SOURCES.map((s, i) => (
              <div key={s.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
                <div
                  className={`glass wal-source-card${inView ? ' in' : ''}`}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    transitionDelay: `${i * 70}ms`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{s.name}</span>
                    {s.conf !== null ? (
                      <span style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: s.color,
                        background: `${s.color}1A`,
                        padding: '2px 7px',
                        borderRadius: 99,
                      }}>
                        {s.conf}% conf
                      </span>
                    ) : (
                      <span style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        background: 'rgba(255,255,255,0.05)',
                        padding: '2px 7px',
                        borderRadius: 99,
                      }}>
                        live
                      </span>
                    )}
                  </div>
                  <span style={{
                    fontSize: 10.5,
                    fontWeight: 600,
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase',
                    color: 'var(--text-muted)',
                  }}>
                    {s.tag}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0', color: 'var(--text-muted)', opacity: 0.5 }} aria-hidden>
                  <svg width="10" height="14" viewBox="0 0 10 14" fill="none">
                    <path d="M5 0 V12 M1 8 L5 12 L9 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
            ))}

            <div
              className={`glass wal-oracle-card${inView ? ' in' : ''}`}
              style={{
                padding: '14px 16px',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid rgba(0, 201, 167, 0.45)',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                boxShadow: '0 0 60px rgba(0, 201, 167, 0.15)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  className="wal-live-dot"
                  style={{
                    width: 8, height: 8, borderRadius: 99,
                    background: 'var(--accent)',
                    boxShadow: '0 0 10px var(--accent)',
                  }}
                />
                <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--accent)' }}>Walour Oracle</span>
                <span style={{
                  marginLeft: 'auto',
                  fontSize: 9.5,
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  background: 'rgba(255,255,255,0.05)',
                  padding: '2px 7px',
                  borderRadius: 99,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}>
                  on-chain
                </span>
              </div>
              <p style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
                Confidence-weighted threat data. Queryable by any Solana program with no API key or trust assumption.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
