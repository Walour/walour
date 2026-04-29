export default function CtaBanner() {
  return (
    <section style={{ padding: '96px 0 0' }}>
      <div className="container">
        <div className="cta-inner glass">
          <div className="cta-sweep-layer" aria-hidden="true" />
          <h2
            style={{
              fontSize: 'clamp(28px, 4vw, 40px)',
              fontWeight: 700,
              letterSpacing: '-0.03em',
              margin: '0 0 12px',
            }}
          >
            Ship Walour-protected. Today.
          </h2>
          <p
            style={{
              color: 'var(--text-muted)',
              fontSize: 17,
              maxWidth: 460,
              margin: '0 auto 36px',
              lineHeight: 1.55,
            }}
          >
            Free for indie devs. No credit card. Works with any Solana wallet adapter.
          </p>
          <div
            style={{
              display: 'flex',
              gap: 12,
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            <a href="#" className="btn btn-primary cta-btn-pulse">
              Install Extension — it&apos;s free
            </a>
            <a href="#" className="btn btn-secondary btn-mono">
              npm i @walour/sdk
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
