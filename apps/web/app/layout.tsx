import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Nav from '@/components/layout/Nav'
import Footer from '@/components/layout/Footer'
import SiteBackground from '@/components/layout/SiteBackground'
import '@/styles/globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Walour — Solana Security Oracle',
    template: '%s — Walour',
  },
  description: 'Real-time, composable threat intelligence for Solana. Protect your users before they sign.',
  metadataBase: new URL('https://walour.com'),
  openGraph: {
    siteName: 'Walour',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Flash-prevention: read localStorage before first paint to avoid theme flicker */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme')||(window.matchMedia('(prefers-color-scheme:light)').matches?'light':'dark');document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <SiteBackground />
        <Nav />
        {children}
        <Footer />
      </body>
    </html>
  )
}
