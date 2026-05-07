import 'dotenv/config'
import http from 'node:http'
import { URL } from 'node:url'

import scanHandler from './scan'
import decodeHandler from './decode'
import blinkHandler from './blink'
import ingestHandler from './ingest'
import purgeHandler from './purge'
import promoteHandler from './promote'
import simulateHandler from './simulate'
import mobileBlockedHandler from './mobile-blocked'
import mobileScanHandler from './mobile-scan'
import mobileWalletHealthHandler from './mobile-wallet-health'
import mobileReportHandler from './mobile-report'
import mobileStatsHandler from './mobile-stats'

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000

type NodeHandler = (req: http.IncomingMessage, res: http.ServerResponse) => Promise<void>
type WebHandler = (req: Request) => Promise<Response>
type AnyHandler = NodeHandler | WebHandler

const routes: Record<string, AnyHandler> = {
  '/api/scan': scanHandler,
  '/api/decode': decodeHandler,
  '/api/blink': blinkHandler,
  '/api/ingest': ingestHandler,
  '/api/purge': purgeHandler,
  '/api/promote': promoteHandler,
  '/api/simulate': simulateHandler,
  '/api/mobile/blocked': mobileBlockedHandler,
  '/api/mobile/scan': mobileScanHandler,
  '/api/mobile/wallet-health': mobileWalletHealthHandler,
  '/api/mobile/report': mobileReportHandler,
  '/api/mobile/stats': mobileStatsHandler,
}

async function dispatch(
  nodeReq: http.IncomingMessage,
  nodeRes: http.ServerResponse
): Promise<void> {
  const url = new URL(nodeReq.url ?? '/', `http://localhost:${PORT}`)
  const handler = routes[url.pathname]
  if (!handler) {
    nodeRes.writeHead(404, { 'Content-Type': 'application/json' })
    nodeRes.end(JSON.stringify({ error: `No handler for ${url.pathname}` }))
    return
  }
  // Handlers wrapped with adaptForVercel accept (IncomingMessage, ServerResponse).
  // Raw Web API handlers (mobile routes) accept (Request) and return Response.
  if (handler.length >= 2) {
    await (handler as NodeHandler)(nodeReq, nodeRes)
  } else {
    const chunks: Buffer[] = []
    for await (const chunk of nodeReq) chunks.push(chunk as Buffer)
    const body = chunks.length ? Buffer.concat(chunks) : null
    const flat: Record<string, string> = {}
    for (const [k, v] of Object.entries(nodeReq.headers)) {
      if (v !== undefined) flat[k] = Array.isArray(v) ? v.join(', ') : v
    }
    const webReq = new Request(url.toString(), {
      method: nodeReq.method ?? 'GET',
      headers: flat,
      ...(body?.length ? { body, duplex: 'half' } : {}),
    } as RequestInit)
    const webRes = await (handler as WebHandler)(webReq)
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
}

const server = http.createServer((req, res) => {
  dispatch(req, res).catch(err => {
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
  console.log('  POST /api/purge   (Bearer WALOUR_CRON_SECRET)')
  console.log('  GET  /api/promote (Bearer WALOUR_CRON_SECRET)')
  console.log('  POST /api/simulate  { txBase64: string, signerPubkey?: string }')
  console.log('  POST /api/mobile/blocked')
  console.log('  POST /api/mobile/scan')
  console.log('  POST /api/mobile/wallet-health')
  console.log('  POST /api/mobile/report')
  console.log('  GET  /api/mobile/stats')
})
