function WalourMark() {
  return (
    <svg viewBox="-80 -80 160 160" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" width="22" height="22">
      <polygon points="0,-68 59,-34 59,34 0,68 -59,34 -59,-34" fill="none" stroke="#00C9A7" strokeWidth="4.5" strokeLinejoin="round"/>
      <polygon points="0,-46 40,-23 40,23 0,46 -40,23 -40,-23" fill="none" stroke="#00C9A7" strokeWidth="1.5" strokeLinejoin="round" opacity="0.3"/>
      <polyline points="-40,-23 -18,26 0,6" fill="none" stroke="#00C9A7" strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round"/>
      <polyline points="40,-23 18,26 0,6" fill="none" stroke="#00C9A7" strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round"/>
    </svg>
  )
}

function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.736-8.835L2.25 2.25h6.892l4.255 5.623L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/>
    </svg>
  )
}

function GitHubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
    </svg>
  )
}

export default function Footer() {
  return (
    <footer className="foot">
      <div className="foot-inner container">
        <div className="foot-brand">
          <a href="https://walour.io" className="foot-brand-link">
            <WalourMark />
            <span className="foot-brand-name">WALOUR</span>
          </a>
          <p className="foot-tagline">Real-time scam protection for Solana.</p>
        </div>

        <nav className="foot-nav" aria-label="Footer navigation">
          <div className="foot-col">
            <span className="foot-col-label">Product</span>
            <a href="https://walour.io/stats">Stats</a>
            <a href="https://walour.io/registry">Registry</a>
            <a href="https://chromewebstore.google.com" target="_blank" rel="noopener noreferrer">Extension</a>
          </div>
          <div className="foot-col">
            <span className="foot-col-label">Developers</span>
            <a href="https://walour.io/docs">Docs</a>
            <a href="https://www.npmjs.com/package/@walour/sdk" target="_blank" rel="noopener noreferrer">npm</a>
            <a href="https://github.com/Sahir619" target="_blank" rel="noopener noreferrer">GitHub</a>
          </div>
        </nav>
      </div>

      <div className="foot-bar container">
        <span className="foot-copy">© 2026 Walour. Solana Security Oracle.</span>
        <div className="foot-social">
          <a href="https://x.com/walourApp" target="_blank" rel="noopener noreferrer" aria-label="Follow on X">
            <XIcon />
          </a>
          <a href="https://github.com/Sahir619" target="_blank" rel="noopener noreferrer" aria-label="GitHub">
            <GitHubIcon />
          </a>
        </div>
      </div>
    </footer>
  )
}
