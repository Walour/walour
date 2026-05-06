export default function LivePill() {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '12px',
        color: 'var(--accent)',
        fontWeight: 500,
        letterSpacing: '0.2px',
      }}
    >
      <span className="live-dot" />
      Live · Devnet
    </div>
  )
}
