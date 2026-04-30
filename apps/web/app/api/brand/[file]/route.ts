import { type NextRequest } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

export async function GET(
  req: NextRequest,
  { params }: { params: { file: string } }
) {
  const { file } = params

  // Safety: only .svg files, no path traversal
  if (!file.endsWith('.svg') || file.includes('/') || file.includes('..') || file.includes('\\')) {
    return new Response('Not found', { status: 404 })
  }

  // Sanitise: only allow alphanumeric, hyphens, and the .svg extension
  if (!/^[a-zA-Z0-9-]+\.svg$/.test(file)) {
    return new Response('Not found', { status: 404 })
  }

  try {
    // process.cwd() is apps/web — go up two levels to project root, then into brand/
    const filePath = path.join(process.cwd(), '..', '..', 'brand', file)
    const content = await fs.readFile(filePath, 'utf-8')

    const download = req.nextUrl.searchParams.get('download') === '1'

    const headers: HeadersInit = {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400',
    }

    if (download) {
      headers['Content-Disposition'] = `attachment; filename="${file}"`
    }

    return new Response(content, { headers })
  } catch {
    return new Response('Not found', { status: 404 })
  }
}
