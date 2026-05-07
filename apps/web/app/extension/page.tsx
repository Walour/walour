import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Browser Extension | Walour',
  description:
    'Walour intercepts wallet-draining transactions before you sign. Real-time scam protection for Solana — works with Phantom, Solflare, and Backpack.',
  openGraph: {
    title: 'Walour — Stop wallet drainers before you sign',
    description:
      'AI-powered scam protection for Solana. Intercepts malicious transactions in <400ms. Works with Phantom, Solflare, and Backpack.',
  },
}

// ─── Detection capabilities ────────────────────────────────────────────────

const DETECTIONS: { label: string; severity: 'danger' | 'warn' | 'safe' }[] = [
  { label: 'Phishing domain detection',           severity: 'danger' },
  { label: 'Newly registered domains (<14 days)', severity: 'danger' },
  { label: 'Token honeypot detection',            severity: 'danger' },
  { label: 'Jupiter organic score analysis',      severity: 'danger' },
  { label: 'Jupiter token audit + liquidity',     severity: 'warn'   },
  { label: 'SetAuthority drain instruction',      severity: 'danger' },
  { label: 'CloseAccount drain instruction',      severity: 'danger' },
  { label: 'Unlimited token Approve',             severity: 'danger' },
  { label: 'PermanentDelegate exploit',           severity: 'danger' },
  { label: 'System program owner reassign',       severity: 'warn'   },
  { label: 'Durable nonce abuse',                 severity: 'warn'   },
  { label: 'Multi-instruction drain chains',      severity: 'warn'   },
  { label: 'Address Lookup Table drainers',       severity: 'warn'   },
  { label: 'Balance delta simulation',            severity: 'safe'   },
  { label: 'AI transaction plain-English decode', severity: 'safe'   },
  { label: 'On-chain threat registry lookup',     severity: 'safe'   },
]

// ─── Permissions declared ──────────────────────────────────────────────────

const PERMISSIONS: { name: string; why: string }[] = [
  {
    name: 'activeTab',
    why: 'Read the current tab hostname to check it against the phishing domain registry.',
  },
  {
    name: 'tabs',
    why: 'Show a badge on the extension icon when a risk is detected on the active tab.',
  },
  {
    name: 'storage',
    why: 'Save your settings (alert threshold, dismissed warnings) locally on your device.',
  },
]

const CANNOT_SEE = [
  'Your browser history',
  'Private keys or seed phrases',
  'Passwords or form input',
  'Other browser tabs',
  'Any data unrelated to the current transaction',
]

// ─── Page ──────────────────────────────────────────────────────────────────

export default function ExtensionPage() {
  return (
    <main>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section style={{ paddingTop: 80, paddingBottom: 72, textAlign: 'center' }}>
        <div className="container" style={{ maxWidth: 760 }}>

          {/* Status badge */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 999, padding: '6px 14px', marginBottom: 28 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%',
              background: 'var(--warning)', display: 'inline-block' }} />
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)',
              letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Chrome Web Store listing in review
            </span>
          </div>

          <h1 style={{
            fontSize: 'clamp(32px, 5vw, 52px)',
            fontWeight: 700,
            lineHeight: 1.15,
            letterSpacing: '-0.02em',
            color: 'var(--text)',
            marginBottom: 20,
          }}>
            Stop wallet drainers{' '}
            <span style={{ color: 'var(--accent)' }}>before you sign.</span>
          </h1>

          <p style={{
            fontSize: 'clamp(16px, 2vw, 19px)',
            lineHeight: 1.65,
            color: 'var(--text-muted)',
            maxWidth: 580,
            margin: '0 auto 36px',
          }}>
            Walour intercepts malicious Solana transactions the moment your wallet asks
            you to sign — explains exactly what it does in plain English, and stops drains
            before a single lamport leaves your wallet.
          </p>

          {/* Stats row */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 40,
            marginBottom: 40, flexWrap: 'wrap' }}>
            {[
              { value: '5,200+', label: 'Threats tracked' },
              { value: '16',     label: 'Attack vectors detected' },
              { value: '<400ms', label: 'Scan latency' },
            ].map(({ value, label }) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--accent)',
                  letterSpacing: '-0.02em' }}>{value}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)',
                  marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {label}
                </div>
              </div>
            ))}
          </div>

          {/* CTAs */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center',
            flexWrap: 'wrap', marginBottom: 36 }}>
            {/* TODO: Replace #install with the real Chrome Web Store URL once the listing is approved */}
            <a href="#install" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'var(--accent)', color: '#0D1117',
              fontWeight: 700, fontSize: 15, padding: '13px 28px',
              borderRadius: 8, textDecoration: 'none',
              letterSpacing: '-0.01em',
              transition: 'opacity 0.15s',
            }}>
              <ChromeIcon />
              Add to Chrome — it&apos;s free
            </a>
            <a href="https://github.com/Walour/walour" target="_blank" rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: 'transparent',
                color: 'var(--text)',
                fontWeight: 600, fontSize: 15, padding: '12px 24px',
                borderRadius: 8, textDecoration: 'none',
                border: '1px solid var(--border)',
                letterSpacing: '-0.01em',
              }}>
              <GitHubIcon />
              View on GitHub
            </a>
          </div>

          {/* Compatible wallets */}
          <p style={{ fontSize: 13, color: 'var(--text-muted)', letterSpacing: '0.02em' }}>
            Works with{' '}
            <WalletBadge name="Phantom" color="#AB9FF2" />,{' '}
            <WalletBadge name="Solflare" color="#FCA311" />,{' '}
            and{' '}
            <WalletBadge name="Backpack" color="#E33D3D" />
          </p>

        </div>
      </section>

      <Divider />

      {/* ── How it works ──────────────────────────────────────────────── */}
      <section style={{ paddingTop: 72, paddingBottom: 72 }}>
        <div className="container" style={{ maxWidth: 860 }}>

          <SectionLabel>How it works</SectionLabel>
          <h2 className="section-title" style={{ marginBottom: 8 }}>
            Three steps. Under 400 milliseconds.
          </h2>
          <p className="section-sub" style={{ marginBottom: 52 }}>
            Walour sits between your wallet and the dApp — invisibly, until it matters.
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 2,
          }}>
            {[
              {
                step: '01',
                title: 'Transaction triggered',
                body: 'A dApp asks your wallet to sign. Walour intercepts the unsigned transaction bytes before the popup appears.',
                accent: 'var(--text-muted)',
              },
              {
                step: '02',
                title: 'Walour scans in <400ms',
                body: 'Domain phishing check, token honeypot lookup, on-chain oracle query, balance delta simulation, and AI decode — in parallel.',
                accent: 'var(--accent)',
              },
              {
                step: '03',
                title: 'You decide',
                body: 'If risk is detected, you see a plain-English explanation and a risk score. Sign, reject, or override — the choice is always yours.',
                accent: 'var(--safe)',
              },
            ].map(({ step, title, body, accent }, i) => (
              <div key={step} style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: i === 0 ? '8px 0 0 8px' : i === 2 ? '0 8px 8px 0' : 0,
                padding: '32px 28px',
                position: 'relative',
              }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
                  textTransform: 'uppercase', color: accent, marginBottom: 14,
                }}>
                  Step {step}
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 650, color: 'var(--text)',
                  marginBottom: 10, letterSpacing: '-0.01em' }}>
                  {title}
                </h3>
                <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                  {body}
                </p>
                {i < 2 && (
                  <div style={{
                    position: 'absolute', right: -14, top: '50%',
                    transform: 'translateY(-50%)',
                    width: 28, height: 28, borderRadius: '50%',
                    background: 'var(--bg)', border: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, color: 'var(--text-muted)', zIndex: 1,
                    fontWeight: 600,
                  }}>
                    →
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* AI callout */}
          <div style={{
            marginTop: 24,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderLeft: '3px solid var(--accent)',
            borderRadius: 8,
            padding: '18px 24px',
            display: 'flex', alignItems: 'flex-start', gap: 14,
          }}>
            <span style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>⚡</span>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.7, margin: 0 }}>
              <strong style={{ color: 'var(--text)' }}>Powered by Claude AI (Anthropic).</strong>{' '}
              Transaction bytes are streamed to Claude Haiku for real-time plain-English decoding.
              First token appears in under 400ms. Transaction data is never stored — discarded
              immediately after the analysis response.
            </p>
          </div>

        </div>
      </section>

      {/* ── Live demo CTA ─────────────────────────────────────────────── */}
      <section style={{ paddingTop: 56, paddingBottom: 56 }}>
        <div className="container" style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: 15, marginBottom: 20 }}>
            See it in action before you install.
          </p>
          <a href="/demo" className="btn btn-primary" style={{ fontSize: 15, padding: '12px 28px' }}>
            Try the live demo
          </a>
        </div>
      </section>

      <Divider />

      {/* ── What it detects ───────────────────────────────────────────── */}
      <section style={{ paddingTop: 72, paddingBottom: 72 }}>
        <div className="container" style={{ maxWidth: 860 }}>

          <SectionLabel>Detection coverage</SectionLabel>
          <h2 className="section-title" style={{ marginBottom: 8 }}>
            16 attack vectors. One extension.
          </h2>
          <p className="section-sub" style={{ marginBottom: 44 }}>
            Walour covers every major drain technique seen in the wild on Solana,
            from classic phishing to sophisticated Token-2022 exploits.
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 10,
          }}>
            {DETECTIONS.map(({ label, severity }) => (
              <div key={label} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '13px 16px',
              }}>
                <span style={{
                  width: 9, height: 9, borderRadius: '50%', flexShrink: 0,
                  background: severity === 'danger' ? 'var(--danger)'
                    : severity === 'warn' ? 'var(--warning)'
                    : 'var(--safe)',
                  boxShadow: severity === 'danger'
                    ? '0 0 6px var(--danger)'
                    : severity === 'warn'
                    ? '0 0 6px var(--warning)'
                    : '0 0 6px var(--safe)',
                }} />
                <span style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.4 }}>
                  {label}
                </span>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div style={{
            display: 'flex', gap: 24, marginTop: 20, flexWrap: 'wrap',
          }}>
            {[
              { color: 'var(--danger)',  label: 'High severity — likely drain attempt' },
              { color: 'var(--warning)', label: 'Medium severity — suspicious pattern'  },
              { color: 'var(--safe)',    label: 'Informational — context provided'       },
            ].map(({ color, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%',
                  background: color, display: 'inline-block' }} />
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
              </div>
            ))}
          </div>

        </div>
      </section>

      <Divider />

      {/* ── Permissions / trust ───────────────────────────────────────── */}
      <section style={{ paddingTop: 72, paddingBottom: 72 }}>
        <div className="container" style={{ maxWidth: 860 }}>

          <SectionLabel>Privacy</SectionLabel>
          <h2 className="section-title" style={{ marginBottom: 8 }}>
            What Walour can — and cannot — see.
          </h2>
          <p className="section-sub" style={{ marginBottom: 44 }}>
            We declare exactly three browser permissions. Nothing more.
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 20,
            marginBottom: 24,
          }}>

            {/* Can see */}
            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              overflow: 'hidden',
            }}>
              <div style={{
                padding: '14px 20px',
                background: 'rgba(0, 201, 167, 0.08)',
                borderBottom: '1px solid var(--border)',
                fontSize: 12, fontWeight: 700, letterSpacing: '0.06em',
                textTransform: 'uppercase', color: 'var(--accent)',
              }}>
                Declared permissions (3)
              </div>
              <div style={{ padding: '8px 0' }}>
                {PERMISSIONS.map(({ name, why }) => (
                  <div key={name} style={{
                    padding: '14px 20px',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex', flexDirection: 'column', gap: 4,
                  }}>
                    <code style={{
                      fontSize: 13, fontWeight: 600,
                      color: 'var(--accent)',
                      background: 'rgba(0, 201, 167, 0.1)',
                      padding: '2px 8px', borderRadius: 4,
                      alignSelf: 'flex-start',
                    }}>
                      {name}
                    </code>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)',
                      lineHeight: 1.6 }}>
                      {why}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Cannot see */}
            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              overflow: 'hidden',
            }}>
              <div style={{
                padding: '14px 20px',
                background: 'rgba(239, 68, 68, 0.07)',
                borderBottom: '1px solid var(--border)',
                fontSize: 12, fontWeight: 700, letterSpacing: '0.06em',
                textTransform: 'uppercase', color: 'var(--danger)',
              }}>
                We cannot see
              </div>
              <div style={{ padding: '8px 0' }}>
                {CANNOT_SEE.map(item => (
                  <div key={item} style={{
                    padding: '12px 20px',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    <span style={{ color: 'var(--danger)', fontSize: 14,
                      flexShrink: 0, fontWeight: 700 }}>✕</span>
                    <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                      {item}
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Trust badges row */}
          <div style={{
            display: 'flex', gap: 12, flexWrap: 'wrap',
          }}>
            {[
              { icon: '🔓', label: 'Open source',         sub: 'MIT license on GitHub'              },
              { icon: '🚫', label: 'No data harvesting',  sub: 'No analytics, no ad networks'       },
              { icon: '🔑', label: 'No key access',       sub: 'Keys stay in your wallet'           },
              { icon: '📜', label: 'Manifest V3',         sub: 'Latest Chrome security standard'   },
            ].map(({ icon, label, sub }) => (
              <div key={label} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '12px 18px',
                flex: '1 1 180px',
              }}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>{icon}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                    {label}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {sub}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Privacy policy link */}
          <p style={{ marginTop: 20, fontSize: 13, color: 'var(--text-muted)' }}>
            Full details in our{' '}
            <a href="/privacy" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
              Privacy Policy
            </a>.
            Transaction bytes are discarded immediately after analysis — never logged,
            never stored, never used for model training.
          </p>

        </div>
      </section>

      <Divider />

      {/* ── Final CTA ─────────────────────────────────────────────────── */}
      <section style={{ paddingTop: 72, paddingBottom: 96 }}>
        <div className="container" style={{ maxWidth: 640, textAlign: 'center' }}>

          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '52px 40px',
            position: 'relative',
            overflow: 'hidden',
          }}>
            {/* Decorative glow */}
            <div style={{
              position: 'absolute', top: -60, left: '50%',
              transform: 'translateX(-50%)',
              width: 320, height: 160,
              background: 'radial-gradient(ellipse, rgba(0,201,167,0.15) 0%, transparent 70%)',
              pointerEvents: 'none',
            }} />

            <h2 style={{
              fontSize: 'clamp(24px, 4vw, 34px)',
              fontWeight: 700,
              color: 'var(--text)',
              letterSpacing: '-0.02em',
              marginBottom: 14,
              position: 'relative',
            }}>
              Start protecting your wallet today.
            </h2>
            <p style={{
              fontSize: 16, color: 'var(--text-muted)',
              lineHeight: 1.65, marginBottom: 36,
              position: 'relative',
            }}>
              Free. Open source. No account required. Works the moment you install it.
            </p>

            <div style={{
              display: 'flex', gap: 12, justifyContent: 'center',
              flexWrap: 'wrap', position: 'relative',
            }}>
              {/* TODO: Replace #install with the real Chrome Web Store URL once the listing is approved */}
              <a href="#install" style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: 'var(--accent)', color: '#0D1117',
                fontWeight: 700, fontSize: 15, padding: '14px 32px',
                borderRadius: 8, textDecoration: 'none',
                letterSpacing: '-0.01em',
              }}>
                <ChromeIcon />
                Add to Chrome — it&apos;s free
              </a>
              <a href="https://github.com/Walour/walour" target="_blank" rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  background: 'transparent', color: 'var(--text)',
                  fontWeight: 600, fontSize: 15, padding: '13px 24px',
                  borderRadius: 8, textDecoration: 'none',
                  border: '1px solid var(--border)',
                  letterSpacing: '-0.01em',
                }}>
                <GitHubIcon />
                GitHub
              </a>
            </div>

            <p style={{
              marginTop: 24, fontSize: 13, color: 'var(--text-muted)',
              position: 'relative',
            }}>
              Not on the store yet?{' '}
              <a href="https://github.com/Walour/walour" target="_blank" rel="noopener noreferrer"
                style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                Clone the repo and load unpacked
              </a>{' '}
              to try the dev build.
            </p>

            <p style={{
              marginTop: 10, fontSize: 12, color: 'var(--text-muted)',
              opacity: 0.6, position: 'relative',
            }}>
              Questions?{' '}
              <a href="mailto:walour786@gmail.com"
                style={{ color: 'inherit', textDecoration: 'underline' }}>
                walour786@gmail.com
              </a>
            </p>
          </div>

        </div>
      </section>

    </main>
  )
}

// ─── Shared sub-components ─────────────────────────────────────────────────

function Divider() {
  return (
    <div className="container">
      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: 0 }} />
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
      textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 10,
    }}>
      {children}
    </div>
  )
}

function WalletBadge({ name, color }: { name: string; color: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 999, padding: '3px 10px',
      fontSize: 12, color: 'var(--text-muted)', fontWeight: 500,
    }}>
      <span style={{
        width: 7, height: 7, borderRadius: '50%',
        background: color, display: 'inline-block',
      }} />
      {name}
    </span>
  )
}

function ChromeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1
        14.93V12H7.07C7.56 9.27 9.5 7 12 7c2.76 0 5 2.24 5 5s-2.24 5-5 5c-1.16
        0-2.22-.4-3.07-1.07H11v-.93C11.33 16.97 11.66 17 12 17c2.76 0 5-2.24
        5-5H13c0 .55-.45 1-1 1s-1-.45-1-1z" />
    </svg>
  )
}

function GitHubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6
        1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92
        0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33
        2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1
        2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69
        1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z" />
    </svg>
  )
}
