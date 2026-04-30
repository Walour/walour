import type { Metadata } from 'next'
import DocsClient from './DocsClient'

export const metadata: Metadata = { title: { absolute: 'SDK Docs | Walour' } }

export default function DocsPage() {
  return <DocsClient />
}
