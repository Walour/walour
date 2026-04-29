'use client'

import { useEffect, useRef, useState } from 'react'

interface CodeLine {
  type: 'comment' | 'prompt' | 'plain'
  text: string
}

const SDK_LINES: CodeLine[] = [
  { type: 'comment', text: '// install the oracle SDK' },
  { type: 'prompt', text: '$ npm install @walour/sdk' },
  { type: 'plain', text: '' },
  { type: 'plain', text: "import { Walour } from '@walour/sdk'" },
  { type: 'plain', text: '' },
  { type: 'plain', text: "const walour = new Walour({ network: 'mainnet-beta' })" },
  { type: 'plain', text: '' },
  { type: 'plain', text: 'const result = await walour.check(transaction)' },
  { type: 'plain', text: "if (result.risk === 'HIGH') dontSign()" },
]

const COPY_TEXT = `npm install @walour/sdk

import { Walour } from '@walour/sdk'

const walour = new Walour({ network: 'mainnet-beta' })

const result = await walour.check(transaction)
if (result.risk === 'HIGH') dontSign()`

export default function SdkBlock() {
  const ref = useRef<HTMLDivElement>(null)
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState(false)

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

  function handleCopy() {
    navigator.clipboard.writeText(COPY_TEXT).then(() => {
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
              Integrate in minutes.
            </h2>
            <p
              style={{
                color: 'var(--text-muted)',
                fontSize: 16,
                lineHeight: 1.6,
                margin: '0 0 24px',
              }}
            >
              Drop the SDK into your dApp, wallet, or backend. Threat lookups
              are cached client-side, signed by the oracle, and verifiable on-chain.
            </p>

            <ul className="sdk-bullets">
              <li className="sdk-bullet">
                Cache-first lookups — sub-100ms warm, &lt;400ms cold.
              </li>
              <li className="sdk-bullet">
                Streaming Claude analysis — first token under 400ms.
              </li>
              <li className="sdk-bullet">
                Circuit breakers on every provider — never crashes your app.
              </li>
            </ul>

            <div>
              <a href="#docs" className="btn btn-secondary">
                Read the Docs →
              </a>
            </div>
          </div>

          {/* Right — code box */}
          <div>
            <div className="code-tab-row">
              <span className="code-tab">
                <span className="code-tab-dot" />
                index.ts
              </span>
            </div>

            <div className="codebox">
              <div className="codebox-chrome">
                <div className="codebox-dots">
                  <span className="codebox-dot" />
                  <span className="codebox-dot" />
                  <span className="codebox-dot" />
                </div>
                <button
                  className={`codebox-copy${copied ? ' copied' : ''}`}
                  onClick={handleCopy}
                  aria-label={copied ? 'Copied to clipboard' : 'Copy code to clipboard'}
                >
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>

              <div className="codebox-body">
                {SDK_LINES.map((line, i) => (
                  <div
                    key={i}
                    className={`code-reveal-line${revealed ? ' in' : ''}`}
                    style={{ transitionDelay: `${i * 80}ms` }}
                  >
                    <span className={`c-${line.type}`}>{line.text || ' '}</span>
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
