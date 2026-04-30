import http from 'node:http'
import { URL } from 'node:url'

import scanHandler from './scan'
import decodeHandler from './decode'
import blinkHandler from './blink'
import ingestHandler from './ingest'
import purgeHandler from './purge'
import simulateHandler from './simulate'

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000

const routes: Record<string, (req: Request) => Promise<Response>> = {
  '/api/scan': scanHandler,
  '/api/decode': decodeHandler,
  '/api/blink': blinkHandler,
  '/api/ingest': ingestHandler,
  '/api/purge': purgeHandler,
  '/api/simulate': simulateHandler,
}

// Adapt Node IncomingMessage → Web Request → Web Response → Node ServerResponse
async function nodeToEdge(
  nodeReq: http.IncomingMessage,
  nodeRes: http.ServerResponse
): Promise<void> {
  const url = new URL(nodeReq.url ?? '/', `http://localhost:${PORT}`)
  const pathname = url.pathname

  const handler = routes[pathname]
  if (!handler) {
    nodeRes.writeHead(404, { 'Content-Type': 'application/json' })
    nodeRes.end(JSON.stringify({ error: `No handler for ${pathname}` }))
    return
  }

  // Buffer request body
  const chunks: Buffer[] = []
  for await (const chunk of nodeReq) {
    chunks.push(chunk as Buffer)
  }
  const body = chunks.length > 0 ? Buffer.concat(chunks) : null

  // Flatten multi-value headers (Node allows string[], Web Request does not)
  const flatHeaders: Record<string, string> = {}
  for (const [k, v] of Object.entries(nodeReq.headers)) {
    if (v !== undefined) flatHeaders[k] = Array.isArray(v) ? v.join(', ') : v
  }

  const reqInit: RequestInit = {
    method: nodeReq.method ?? 'GET',
    headers: flatHeaders,
  }
  if (body?.length) {
    Object.assign(reqInit, { body, duplex: 'half' })
  }
  const webReq = new Request(url.toString(), reqInit)

  const webRes = await handler(webReq)

  // Flatten response headers (Headers entries() can have multi-values)
  const resHeaders: Record<string, string> = {}
  webRes.headers.forEach((v, k) => { resHeaders[k] = v })
  nodeRes.writeHead(webRes.status, resHeaders)

  if (webRes.body) {
    const reader = webRes.body.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      nodeRes.write(value)
    }
  }
  nodeRes.end()
}

const server = http.createServer((req, res) => {
  nodeToEdge(req, res).catch(err => {
    console.error('[server] Unhandled error:', err)
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Internal server error' }))
    }
  })
})

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[walour-worker] Port ${PORT} already in use. Run: lsof -ti:${PORT} | xargs kill -9`)
  } else {
    console.error('[walour-worker] Server error:', err)
  }
  process.exit(1)
})

server.listen(PORT, () => {
  console.log(`[walour-worker] dev server → http://localhost:${PORT}`)
  console.log('  GET  /api/scan?hostname=<domain>')
  console.log('  POST /api/decode   { txBase64: string }')
  console.log('  GET  /api/blink?address=<pubkey>')
  console.log('  POST /api/ingest')
  console.log('  POST /api/purge')
  console.log('  POST /api/simulate  { txBase64: string, signerPubkey?: string }')
})
