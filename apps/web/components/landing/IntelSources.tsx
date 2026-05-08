'use client'

import { useEffect, useState } from 'react'
import { useInView } from '@/hooks/useInView'

const LEFT_SOURCES = [
  { name: 'Phishing Domains',      tag: '60,000+ known threats',             color: '#EF4444' },
  { name: 'Token Risk',            tag: 'Honeypot and rug detection',        color: '#A855F7' },
  { name: 'Jupiter Intelligence',  tag: 'Organic score + audit + liquidity', color: '#FCA311' },
] as const

const RIGHT_SOURCES = [
  { name: 'Site Impersonation',     tag: 'Fake wallet and dApp sites',       color: '#F59E0B' },
  { name: 'Transaction Simulation', tag: 'What actually leaves your wallet', color: '#00C9A7' },
  { name: 'AI Analysis',            tag: 'Plain-English explanation',         color: '#3B82F6' },
] as const

const ALL_SOURCES = [...LEFT_SOURCES, ...RIGHT_SOURCES]

// Canvas geometry — oracle centered, 3 sources each side
const VW = 1000
const VH = 300
const SRC_W = 248
const SRC_H = 64
const SRC_GAP = 20
const LEFT_SRC_X = 12
const RIGHT_SRC_X = 740
const ORACLE = { x: 378, y: VH / 2, w: 244, h: 158 }

const SRC_TOTAL_H = 3 * SRC_H + 2 * SRC_GAP  // 252
const SRC_Y0 = (VH - SRC_TOTAL_H) / 2         // 104

function leftCenter(i: number) {
  return { x: LEFT_SRC_X + SRC_W, y: SRC_Y0 + i * (SRC_H + SRC_GAP) + SRC_H / 2 }
}

function rightCenter(i: number) {
  return { x: RIGHT_SRC_X, y: SRC_Y0 + i * (SRC_H + SRC_GAP) + SRC_H / 2 }
}

function leftPath(i: number) {
  const a = leftCenter(i)
  const bx = ORACLE.x
  const by = ORACLE.y
  const dx = bx - a.x
  return `M ${a.x} ${a.y} C ${a.x + dx * 0.5} ${a.y}, ${bx - dx * 0.5} ${by}, ${bx} ${by}`
}

function rightPath(i: number) {
  const a = rightCenter(i)
  const bx = ORACLE.x + ORACLE.w
  const by = ORACLE.y
  const dx = a.x - bx
  return `M ${a.x} ${a.y} C ${a.x - dx * 0.5} ${a.y}, ${bx + dx * 0.5} ${by}, ${bx} ${by}`
}

export default function IntelSources() {
  const { ref, inView } = useInView<HTMLDivElement>({ threshold: 0.18 })
  const [pulse, setPulse] = useState(-1)

  useEffect(() => {
    if (!inView) return
    let i = 0
    let t: ReturnType<typeof setTimeout>
    const tick = () => {
      setPulse(i % ALL_SOURCES.length)
      i++
      t = setTimeout(tick, 900)
    }
    t = setTimeout(tick, 600)
    return () => clearTimeout(t)
  }, [inView])

  return (
    <section style={{ padding: '40px 0' }}>
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
        .wal-source-card.right-side {
          transform: translateX(16px);
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
          .wal-mobile  { display: flex !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          .wal-line, .wal-pulse-ring, .wal-live-dot { animation: none !important; }
        }
      `}</style>

      <div className="container">
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h2 style={{
            fontSize: 'clamp(28px, 4.4vw, 44px)',
            fontWeight: 700,
            letterSpacing: '-0.03em',
            margin: '0 0 14px',
            lineHeight: 1.05,
          }}>
            Six layers of protection.
          </h2>
          <p style={{
            color: 'var(--text-muted)',
            fontSize: 16,
            lineHeight: 1.6,
            maxWidth: 580,
            margin: '0 auto',
          }}>
            Every transaction you sign is checked against six independent threat signals before the approval prompt appears.
          </p>
        </div>

        <div ref={ref} style={{ position: 'relative' }}>

          {/* Desktop: SVG diagram with HTML cards overlaid */}
          <div
            className="wal-desktop"
            style={{
              position: 'relative',
              width: '100%',
              aspectRatio: `${VW} / ${VH}`,
              maxWidth: 1100,
              margin: '0 auto',
              overflow: 'hidden',
            }}
          >
            <svg
              viewBox={`0 0 ${VW} ${VH}`}
              width="100%"
              height="100%"
              preserveAspectRatio="xMidYMid meet"
              style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}
              aria-hidden
            >
              <defs>
                <radialGradient id="wal-oracle-glow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#00C9A7" stopOpacity="0.25" />
                  <stop offset="60%" stopColor="#00C9A7" stopOpacity="0.05" />
                  <stop offset="100%" stopColor="#00C9A7" stopOpacity="0" />
                </radialGradient>
                {LEFT_SOURCES.map((s, i) => (
                  <linearGradient key={`lg-l-${i}`} id={`wal-grad-l-${i}`}
                    gradientUnits="userSpaceOnUse"
                    x1={leftCenter(i).x} y1={leftCenter(i).y}
                    x2={ORACLE.x} y2={ORACLE.y}
                  >
                    <stop offset="0%" stopColor={s.color} stopOpacity="0.85" />
                    <stop offset="100%" stopColor="#00C9A7" stopOpacity="0.85" />
                  </linearGradient>
                ))}
                {RIGHT_SOURCES.map((s, i) => (
                  <linearGradient key={`lg-r-${i}`} id={`wal-grad-r-${i}`}
                    gradientUnits="userSpaceOnUse"
                    x1={rightCenter(i).x} y1={rightCenter(i).y}
                    x2={ORACLE.x + ORACLE.w} y2={ORACLE.y}
                  >
                    <stop offset="0%" stopColor={s.color} stopOpacity="0.85" />
                    <stop offset="100%" stopColor="#00C9A7" stopOpacity="0.85" />
                  </linearGradient>
                ))}
              </defs>

              {/* Glow behind oracle */}
              <circle
                cx={ORACLE.x + ORACLE.w / 2} cy={ORACLE.y}
                r={130}
                fill="url(#wal-oracle-glow)"
              />

              {/* Left connector lines */}
              {LEFT_SOURCES.map((s, i) => {
                const d = leftPath(i)
                const isActive = pulse === i
                return (
                  <g key={`lc-${i}`}>
                    <path d={d} fill="none" stroke={`url(#wal-grad-l-${i})`} strokeWidth={1.25}
                      opacity={inView ? 0.55 : 0}
                      style={{ transition: 'opacity 0.8s ease', transitionDelay: `${i * 90 + 200}ms` }}
                    />
                    <path className={inView ? 'wal-line' : ''} d={d} fill="none"
                      stroke={`url(#wal-grad-l-${i})`} strokeWidth={1.5}
                      opacity={inView ? 0.9 : 0}
                      style={{ transition: 'opacity 0.8s ease', transitionDelay: `${i * 90 + 300}ms` }}
                    />
                    {inView && (
                      <circle r={isActive ? 4.5 : 3} fill={s.color}>
                        <animateMotion dur={isActive ? '1.1s' : '2.6s'} repeatCount="indefinite" path={d} />
                        {isActive && <animate attributeName="opacity" values="1;0.6;1" dur="1.1s" repeatCount="indefinite" />}
                      </circle>
                    )}
                    <circle cx={leftCenter(i).x} cy={leftCenter(i).y} r={3} fill={s.color}
                      opacity={inView ? 1 : 0}
                      style={{ transition: 'opacity 0.6s ease', transitionDelay: `${i * 90 + 400}ms` }}
                    />
                  </g>
                )
              })}

              {/* Right connector lines */}
              {RIGHT_SOURCES.map((s, i) => {
                const d = rightPath(i)
                const isActive = pulse === i + LEFT_SOURCES.length
                return (
                  <g key={`rc-${i}`}>
                    <path d={d} fill="none" stroke={`url(#wal-grad-r-${i})`} strokeWidth={1.25}
                      opacity={inView ? 0.55 : 0}
                      style={{ transition: 'opacity 0.8s ease', transitionDelay: `${(i + 3) * 90 + 200}ms` }}
                    />
                    <path className={inView ? 'wal-line' : ''} d={d} fill="none"
                      stroke={`url(#wal-grad-r-${i})`} strokeWidth={1.5}
                      opacity={inView ? 0.9 : 0}
                      style={{ transition: 'opacity 0.8s ease', transitionDelay: `${(i + 3) * 90 + 300}ms` }}
                    />
                    {inView && (
                      <circle r={isActive ? 4.5 : 3} fill={s.color}>
                        <animateMotion dur={isActive ? '1.1s' : '2.6s'} repeatCount="indefinite" path={d} />
                        {isActive && <animate attributeName="opacity" values="1;0.6;1" dur="1.1s" repeatCount="indefinite" />}
                      </circle>
                    )}
                    <circle cx={rightCenter(i).x} cy={rightCenter(i).y} r={3} fill={s.color}
                      opacity={inView ? 1 : 0}
                      style={{ transition: 'opacity 0.6s ease', transitionDelay: `${(i + 3) * 90 + 400}ms` }}
                    />
                  </g>
                )
              })}

              {/* Oracle pulse rings */}
              {inView && (
                <>
                  <circle
                    className="wal-pulse-ring"
                    cx={ORACLE.x + ORACLE.w / 2} cy={ORACLE.y}
                    r={ORACLE.w / 2 + 8}
                    fill="none" stroke="rgba(0, 201, 167, 0.45)" strokeWidth={1}
                  />
                  <circle
                    className="wal-pulse-ring"
                    cx={ORACLE.x + ORACLE.w / 2} cy={ORACLE.y}
                    r={ORACLE.w / 2 + 8}
                    fill="none" stroke="rgba(0, 201, 167, 0.3)" strokeWidth={1}
                    style={{ animationDelay: '1.2s' }}
                  />
                </>
              )}
            </svg>

            {/* Left source cards */}
            {LEFT_SOURCES.map((s, i) => {
              const top    = (SRC_Y0 + i * (SRC_H + SRC_GAP)) / VH * 100
              const left   = LEFT_SRC_X / VW * 100
              const width  = SRC_W / VW * 100
              const height = SRC_H / VH * 100
              return (
                <div
                  key={s.name}
                  className={`glass wal-source-card${inView ? ' in' : ''}`}
                  style={{
                    position: 'absolute',
                    top: `${top}%`, left: `${left}%`,
                    width: `${width}%`, height: `${height}%`,
                    borderRadius: 'var(--radius-md)',
                    padding: '10px 14px',
                    display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4,
                    transitionDelay: `${i * 90}ms`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{s.name}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 600, color: 'var(--text-muted)',
                      background: 'rgba(255,255,255,0.05)', padding: '2px 7px',
                      borderRadius: 99, letterSpacing: '0.04em', whiteSpace: 'nowrap',
                    }}>live</span>
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 600, letterSpacing: '0.5px',
                    textTransform: 'uppercase', color: 'var(--text-muted)',
                  }}>{s.tag}</span>
                </div>
              )
            })}

            {/* Right source cards */}
            {RIGHT_SOURCES.map((s, i) => {
              const top    = (SRC_Y0 + i * (SRC_H + SRC_GAP)) / VH * 100
              const left   = RIGHT_SRC_X / VW * 100
              const width  = SRC_W / VW * 100
              const height = SRC_H / VH * 100
              return (
                <div
                  key={s.name}
                  className={`glass wal-source-card right-side${inView ? ' in' : ''}`}
                  style={{
                    position: 'absolute',
                    top: `${top}%`, left: `${left}%`,
                    width: `${width}%`, height: `${height}%`,
                    borderRadius: 'var(--radius-md)',
                    padding: '10px 14px',
                    display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4,
                    transitionDelay: `${(i + 3) * 90}ms`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{s.name}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 600, color: 'var(--text-muted)',
                      background: 'rgba(255,255,255,0.05)', padding: '2px 7px',
                      borderRadius: 99, letterSpacing: '0.04em', whiteSpace: 'nowrap',
                    }}>live</span>
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 600, letterSpacing: '0.5px',
                    textTransform: 'uppercase', color: 'var(--text-muted)',
                  }}>{s.tag}</span>
                </div>
              )
            })}

            {/* Oracle card — centered */}
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
                display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'center',
                boxShadow: '0 0 80px rgba(0, 201, 167, 0.18)',
                transitionDelay: '500ms',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  className="wal-live-dot"
                  style={{
                    width: 8, height: 8, borderRadius: 99,
                    background: 'var(--accent)', boxShadow: '0 0 10px var(--accent)', flexShrink: 0,
                  }}
                />
                <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--accent)', letterSpacing: '-0.01em' }}>
                  Walour Oracle
                </span>
                <span style={{
                  marginLeft: 'auto', fontSize: 9.5, fontWeight: 600,
                  color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)',
                  padding: '2px 7px', borderRadius: 99,
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                }}>on-chain</span>
              </div>
              <span style={{
                fontSize: 10, fontWeight: 600, letterSpacing: '0.5px',
                textTransform: 'uppercase', color: 'var(--text-muted)',
              }}>Unified output</span>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
                Confidence-weighted threat data. Queryable by any Solana program with no API key.
              </p>
            </div>
          </div>

          {/* Mobile: vertical stack */}
          <div
            className="wal-mobile"
            style={{ display: 'none', flexDirection: 'column', gap: 10, maxWidth: 480, margin: '0 auto' }}
          >
            {ALL_SOURCES.map((s, i) => (
              <div key={s.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
                <div
                  className={`glass wal-source-card${inView ? ' in' : ''}`}
                  style={{
                    padding: '12px 14px', borderRadius: 'var(--radius-md)',
                    display: 'flex', flexDirection: 'column', gap: 4,
                    transitionDelay: `${i * 70}ms`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{s.name}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 600, color: 'var(--text-muted)',
                      background: 'rgba(255,255,255,0.05)', padding: '2px 7px', borderRadius: 99,
                    }}>live</span>
                  </div>
                  <span style={{
                    fontSize: 10.5, fontWeight: 600, letterSpacing: '0.5px',
                    textTransform: 'uppercase', color: 'var(--text-muted)',
                  }}>{s.tag}</span>
                </div>
                <div style={{
                  display: 'flex', justifyContent: 'center', padding: '4px 0',
                  color: 'var(--text-muted)', opacity: 0.5,
                }} aria-hidden>
                  <svg width="10" height="14" viewBox="0 0 10 14" fill="none">
                    <path d="M5 0 V12 M1 8 L5 12 L9 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
            ))}
            <div
              className={`glass wal-oracle-card${inView ? ' in' : ''}`}
              style={{
                padding: '14px 16px', borderRadius: 'var(--radius-lg)',
                border: '1px solid rgba(0, 201, 167, 0.45)',
                display: 'flex', flexDirection: 'column', gap: 6,
                boxShadow: '0 0 60px rgba(0, 201, 167, 0.15)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="wal-live-dot" style={{
                  width: 8, height: 8, borderRadius: 99,
                  background: 'var(--accent)', boxShadow: '0 0 10px var(--accent)',
                }} />
                <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--accent)' }}>Walour Oracle</span>
                <span style={{
                  marginLeft: 'auto', fontSize: 9.5, fontWeight: 600,
                  color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)',
                  padding: '2px 7px', borderRadius: 99,
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                }}>on-chain</span>
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
