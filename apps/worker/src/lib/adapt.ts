import http from 'node:http'

type WebHandler = (req: Request) => Promise<Response>

/**
 * Wraps a Web API handler (Request → Response) for Vercel Node.js Lambda.
 * Lambda calls handlers with (IncomingMessage, ServerResponse); this adapter
 * bridges the two conventions so the same handler works locally and on Vercel.
 */
export function adaptForVercel(handler: WebHandler) {
  return async function (
    nodeReq: http.IncomingMessage,
    nodeRes: http.ServerResponse
  ): Promise<void> {
    try {
      const protocol =
        (nodeReq.headers['x-forwarded-proto'] as string) || 'https'
      const host =
        (nodeReq.headers['x-forwarded-host'] as string) ||
        (nodeReq.headers.host as string) ||
        'localhost'
      const url = new URL(nodeReq.url ?? '/', `${protocol}://${host}`)

      const chunks: Buffer[] = []
      for await (const chunk of nodeReq) {
        chunks.push(chunk as Buffer)
      }
      const body = chunks.length > 0 ? Buffer.concat(chunks) : null

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
    } catch (err) {
      console.error('[adapt] Unhandled error:', err)
      if (!nodeRes.headersSent) {
        nodeRes.writeHead(500, { 'Content-Type': 'application/json' })
        nodeRes.end(JSON.stringify({ error: 'Internal Server Error' }))
      }
    }
  }
}
