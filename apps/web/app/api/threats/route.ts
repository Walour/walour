import { NextRequest, NextResponse } from 'next/server'
import { fetchThreats } from '@/lib/queries'

export const runtime = 'nodejs'
export const revalidate = 0

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const search = (searchParams.get('q') || '').slice(0, 100)
  const type = searchParams.get('type') || 'all'

  const data = await fetchThreats(page, search, type)
  return NextResponse.json(data)
}
