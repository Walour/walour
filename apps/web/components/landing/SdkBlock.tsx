'use client'

import { useEffect, useRef, useState } from 'react'

interface CodeLine {
  type: 'comment' | 'prompt' | 'plain'
  text: string
}

const PM_COMMANDS: Record<string, string> = {
  npm: 'npm install @walour/sdk',
  pnpm: 'pnpm add @walour/sdk',
  yarn: 'yarn add @walour/sdk',
  bun: 'bun add @walour/sdk',
}

const SDK_LINES: CodeLine[] = [
  { type: 'plain', text: "import { checkDomain, checkTokenRisk, decodeTransaction } from '@walour/sdk'" },
  { type: 'plain', text: '' },
  { type: 'comment', text: '// Domain check: real-time threat detection' },
  { type: 'plain', text: "const domain = await checkDomain('suspicious-airdrop.xyz')" },
  { type: 'comment', text: "// → { level: 'RED', confidence: 0.95 }" },
  { type: 'plain', text: '' },
  { type: 'comment', text: '// Stream AI explanation before signing' },
  { type: 'plain', text: 'for await (const chunk of decodeTransaction(tx)) {' },
  { type: 'plain', text: "  overlay.append(chunk)  // first token < 400ms" },
  { type: 'plain', text: '}' },
]

export default function SdkBlock() {
  const ref = useRef<HTMLDivElement>(null)
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState(false)
  const [pm, setPm] = useState('npm')

  useEffect(() => {
    const saved = localStorage.getItem('walour-pm')
    if (saved && PM_COMMANDS[saved]) setPm(saved)
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setRevealed(true)
          obs.disconnect()
        }
      },
      { threshold: 0.2 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  function selectPm(key: string) {
    setPm(key)
    localStorage.setItem('walour-pm', key)
  }

  function handleCopy() {
    navigator.clipboard.writeText(PM_COMMANDS[pm]).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    })
  }

  return (
    <section className="sdk-section">
      <div className="container">
        <div ref={ref} className="sdk-two-col">
          {/* Left — copy */}
          <div>
            <h2
              style={{
                fontSize: 'clamp(28px, 4vw, 40px)',
                fontWeight: 700,
                letterSpacing: '-0.03em',
                margin: '0 0 14px',
                lineHeight: 1.1,
              }}
            >
              One npm install. Any Solana app.
            </h2>
            <p
              style={{
                color: 'var(--text-muted)',
                fontSize: 16,
                lineHeight: 1.6,
                margin: '0 0 24px',
              }}
            >
              Drop the SDK into a dApp, wallet, or backend. Lookups are cached
              client-side, signed by the oracle, and verifiable against the
              on-chain registry.
            </p>

            <ul className="sdk-bullets">
              <li className="sdk-bullet">
                Cache-first lookups. Sub-100ms warm, under 400ms cold.
              </li>
              <li className="sdk-bullet">
                Streaming AI analysis. First token under 400ms.
              </li>
              <li className="sdk-bullet">
                Circuit breakers on every provider. Built for production uptime.
              </li>
            </ul>

            <div>
              <a href="#docs" className="btn btn-secondary">
                Read the SDK docs
              </a>
            </div>
          </div>

          {/* Right — install bar + code box */}
          <div>
            {/* Install bar */}
            <div className="install-bar">
              <div className="install-bar-tabs">
                {Object.keys(PM_COMMANDS).map(key => (
                  <button
                    key={key}
                    className={`install-tab${pm === key ? ' active' : ''}`}
                    onClick={() => selectPm(key)}
                  >
                    {key}
                  </button>
                ))}
                <span className="install-bar-meta">v0.1.0 · TS · MIT</span>
              </div>
              <div className="install-bar-cmd">
                <span className="install-bar-prompt" aria-hidden="true">$</span>
                <code className="install-bar-code">{PM_COMMANDS[pm]}</code>
                <button
                  className={`install-bar-copy${copied ? ' copied' : ''}`}
                  onClick={handleCopy}
                  aria-label={copied ? 'Copied to clipboard' : 'Copy install command'}
                >
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Code box */}
            <div className="codebox codebox-connected">
              <div className="codebox-chrome">
                <div className="codebox-dots">
                  <span className="codebox-dot" />
                  <span className="codebox-dot" />
                  <span className="codebox-dot" />
                </div>
                <span
                  style={{
                    fontFamily: 'ui-monospace,"SF Mono","Roboto Mono",Consolas,monospace',
                    fontSize: 11,
                    color: 'var(--text-muted)',
                    marginLeft: 6,
                  }}
                >
                  <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#3178C6', marginRight: 6, verticalAlign: 'middle' }} />
                  index.ts
                </span>
              </div>
              <div className="codebox-body">
                {SDK_LINES.map((line, i) => (
                  <div
                    key={i}
                    className={`code-reveal-line${revealed ? ' in' : ''}`}
                    style={{ transitionDelay: `${i * 80}ms` }}
                  >
                    <span className={`c-${line.type}`}>{line.text || ' '}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
