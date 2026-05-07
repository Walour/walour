import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Live Demo | Walour',
  description: 'Test Walour transaction protection live in your browser. See GREEN, AMBER, and RED verdicts before you sign.',
}

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return children
}
