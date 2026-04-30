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
    <html lang="en">
      <head />
      <body>
        <SiteBackground />
        <Nav />
        {children}
        <Footer />
      </body>
    </html>
  )
}
