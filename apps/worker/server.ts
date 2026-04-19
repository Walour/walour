import { createServer, IncomingMessage, ServerResponse } from 'http'
import { readFileSync } from 'fs'
import { join } from 'path'

// Load .env
const envPath = join(__dirname, '.env')
try {
  const lines = readFileSync(envPath, 'utf8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim()
    if (key && !(key in process.env)) process.env[key] = val
  }
} catch { /* no .env */ }

async function nodeRequestToFetch(req: IncomingMessage, baseUrl: string): Promise<Request> {
  const url = `${baseUrl}${req.url}`
  const body = await new Promise<Buffer>((resolve) => {
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks)))
  })
  return new Request(url, {
    method: req.method,
    headers: req.headers as Record<string, string>,
    body: body.length > 0 ? body : undefined,
  })
}

async function sendFetchResponse(fetchRes: Response, res: ServerResponse) {
  res.statusCode = fetchRes.status
  fetchRes.headers.forEach((val, key) => res.setHeader(key, val))
  // Override CORS to allow all origins locally
  res.setHeader('Access-Control-Allow-Origin', '*')
  const body = await fetchRes.arrayBuffer()
  res.end(Buffer.from(body))
}

const PORT = process.env.PORT || 3000
const BASE = `http://localhost:${PORT}`

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const path = req.url?.split('?')[0] ?? '/'

  try {
    const fetchReq = await nodeRequestToFetch(req, BASE)

    let handler: ((r: Request) => Promise<Response>) | null = null

    if (path === '/api/scan')    handler = (await import('./src/scan')).default
    if (path === '/api/decode')  handler = (await import('./src/decode')).default
    if (path === '/api/blink')   handler = (await import('./src/blink')).default
    if (path === '/api/ingest')  handler = (await import('./src/ingest')).default
    if (path === '/api/promote') handler = (await import('./src/promote')).default

    if (!handler) {
      res.statusCode = 404
      res.end(JSON.stringify({ error: 'Not found' }))
      return
    }

    const fetchRes = await handler(fetchReq)
    await sendFetchResponse(fetchRes, res)
  } catch (err: unknown) {
    console.error(err)
    res.statusCode = 500
    res.end(JSON.stringify({ error: String(err) }))
  }
})

server.listen(PORT, () => {
  console.log(`Walour worker running at http://localhost:${PORT}`)
  console.log('  GET  /api/scan?hostname=<domain>')
  console.log('  POST /api/decode')
  console.log('  GET  /api/blink?address=<address>')
  console.log('  GET  /api/ingest')
  console.log('  GET  /api/promote')
})
