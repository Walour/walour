import { Suspense } from 'react'
import { fetchThreats } from '@/lib/queries'
import RegistryClient from './RegistryClient'

interface RegistryPageProps {
  searchParams: { q?: string; type?: string; page?: string }
}

export default async function RegistryPage({ searchParams }: RegistryPageProps) {
  const page = Math.max(1, Number(searchParams.page) || 1)
  const search = searchParams.q || ''
  const type = searchParams.type || 'all'

  const { rows, total } = await fetchThreats(page, search, type)

  return (
    <main>
      <div className="container" style={{ paddingTop: 60 }}>
        <h1 className="section-title">Threat Registry</h1>
        <p className="section-sub" style={{ marginBottom: 32 }}>
          {total.toLocaleString()} threats indexed · Updated in real-time
        </p>
        <Suspense fallback={null}>
          <RegistryClient
            initialRows={rows}
            initialTotal={total}
            initialPage={page}
            initialSearch={search}
            initialType={type}
          />
        </Suspense>
      </div>
    </main>
  )
}
