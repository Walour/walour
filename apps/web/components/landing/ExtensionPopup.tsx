'use client'
import { useEffect, useState } from 'react'

type PopupState = 'scanning' | 'risk'

interface ExtensionPopupProps {
  loop?: boolean
  initialState?: PopupState
}

const THREATS = [
  'Known drainer contract',
  'Unlimited SPL approval',
  'Reported 12× in 24h',
]

export default function ExtensionPopup({
  loop = false,
  initialState = 'scanning',
}: ExtensionPopupProps) {
  const [state, setState] = useState<PopupState>(initialState)
  const [scanProgress, setScanProgress] = useState(0)
  const [shaking, setShaking] = useState(false)
  const [threatItems, setThreatItems] = useState<string[]>([])

  useEffect(() => {
    if (!loop) {
      if (initialState === 'risk') {
        setScanProgress(97)
        setThreatItems(THREATS)
      }
      return
    }

    const timeouts: ReturnType<typeof setTimeout>[] = []
    let cancelled = false

    const runCycle = () => {
      if (cancelled) return
      setState('scanning')
      setScanProgress(0)
      setThreatItems([])
      setShaking(false)

      const startTime = performance.now()
      const animProgress = (now: number) => {
        if (cancelled) return
        const t = Math.min((now - startTime) / 900, 1)
        setScanProgress(Math.round(t * 97))
        if (t < 1) requestAnimationFrame(animProgress)
      }
      requestAnimationFrame(animProgress)

      timeouts.push(
        setTimeout(() => {
          setState('risk')
          setScanProgress(97)
          setShaking(true)
        }, 1000)
      )
      timeouts.push(setTimeout(() => setShaking(false), 1260))

      THREATS.forEach((_, i) => {
        timeouts.push(
          setTimeout(() => {
            setThreatItems(prev => [...prev, THREATS[i]])
          }, 1300 + i * 200)
        )
      })

      timeouts.push(setTimeout(runCycle, 4800))
    }

    runCycle()
    return () => {
      cancelled = true
      timeouts.forEach(clearTimeout)
    }
  }, [loop, initialState])

  const isRisk = state === 'risk'

  return (
    <div
      className={`ext-popup ${isRisk ? 'state-risk' : 'state-scanning'} ${
        shaking ? 'shake' : ''
      }`}
    >
      {/* Header */}
      <div className="ext-popup-header">
        <div className="ext-popup-brand">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 2L4 6v6c0 5.25 3.5 10.15 8 11.5C16.5 22.15 20 17.25 20 12V6l-8-4z"
              fill="var(--accent)"
              opacity="0.9"
            />
            <path
              d="M9 12l2 2 4-4"
              stroke="#062b25"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="ext-popup-brand-name">Walour</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="ext-live-pill">
            <span className="ext-live-dot" />
            live
          </span>
          <button
            className="ext-popup-close"
            aria-label="Close"
            style={{ background: 'none', border: 'none', padding: 2 }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Verdict */}
      <div className={`ext-verdict ${isRisk ? 'is-risk' : 'is-scanning'}`}>
        <div className="ext-verdict-icon">
          {isRisk ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                fill="var(--danger)"
                opacity="0.2"
              />
              <path
                d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                stroke="var(--danger)"
                strokeWidth="1.5"
                fill="none"
              />
              <line x1="12" y1="9" x2="12" y2="13" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round" />
              <circle cx="12" cy="17" r="1" fill="var(--danger)" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="9" stroke="var(--accent)" strokeWidth="1.5" opacity="0.4" />
              <path d="M12 8v4l2 2" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
            </svg>
          )}
        </div>
        <div>
          <div className={`ext-verdict-label ${isRisk ? 'danger' : 'scanning'}`}>
            {isRisk ? 'HIGH RISK' : 'Analyzing...'}
          </div>
          <div className="ext-verdict-sub">
            {isRisk ? "Don't sign this transaction" : 'Checking against oracle + AI models'}
          </div>
        </div>
      </div>

      {!isRisk ? (
        <div className="ext-scan-progress">
          <div className="ext-scan-bar-track">
            <div className="ext-scan-bar-fill" style={{ width: `${scanProgress}%` }} />
          </div>
          <div className="ext-scan-label">Scanning on-chain data · {scanProgress}%</div>
        </div>
      ) : (
        <div className="ext-meter">
          <span className="ext-meter-label">Confidence</span>
          <div className="ext-meter-track">
            <div className="ext-meter-fill danger" style={{ width: '97%' }} />
          </div>
          <span className="ext-meter-pct" style={{ color: 'var(--danger)' }}>
            97%
          </span>
        </div>
      )}

      {isRisk && (
        <div className="ext-threats">
          <div className="ext-threats-header">Threats detected</div>
          {threatItems.map((threat, i) => (
            <div
              key={threat}
              className="ext-threat-item"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              {threat}
            </div>
          ))}
        </div>
      )}

      <div className="ext-actions">
        <button className="ext-btn primary">Reject</button>
        <button className="ext-btn ghost">Sign anyway</button>
      </div>
    </div>
  )
}
