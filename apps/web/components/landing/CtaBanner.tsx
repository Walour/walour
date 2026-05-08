export default function CtaBanner() {
  return (
    <section style={{ padding: '40px 0 0' }}>
      <div className="container">
        <div className="cta-inner glass tile-hover-scan">
          <h2
            style={{
              fontSize: 'clamp(28px, 4vw, 40px)',
              fontWeight: 700,
              letterSpacing: '-0.03em',
              margin: '0 0 12px',
              position: 'relative',
              zIndex: 2,
            }}
          >
            Ship a wallet your users can actually trust.
          </h2>
          <p
            style={{
              color: 'var(--text-muted)',
              fontSize: 17,
              maxWidth: 460,
              margin: '0 auto 36px',
              lineHeight: 1.55,
              position: 'relative',
              zIndex: 2,
            }}
          >
            Free for indie devs. No credit card. Works with every Solana wallet adapter.
          </p>
          <div
            style={{
              display: 'flex',
              gap: 12,
              justifyContent: 'center',
              flexWrap: 'wrap',
              position: 'relative',
              zIndex: 2,
            }}
          >
            <a href="#" className="btn btn-primary">
              Add to Chrome
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
