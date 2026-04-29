import Link from 'next/link'

export default function NotFound() {
  return (
    <main>
      <div
        className="container"
        style={{
          paddingTop: 120,
          paddingBottom: 80,
          textAlign: 'center',
          maxWidth: 480,
        }}
      >
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            color: 'var(--border)',
            lineHeight: 1,
            marginBottom: 16,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          404
        </div>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 600,
            marginBottom: 12,
            letterSpacing: '-0.3px',
          }}
        >
          Page not found
        </h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: 32 }}>
          The page you're looking for doesn't exist or was moved.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/" className="btn btn-primary">
            Go home
          </Link>
          <Link href="/registry" className="btn btn-secondary">
            Browse Registry
          </Link>
        </div>
      </div>
    </main>
  )
}
