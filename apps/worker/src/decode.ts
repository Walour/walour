import { VersionedTransaction } from '@solana/web3.js'
import { decodeTransaction } from '@walour/sdk'
import { adaptForVercel } from './lib/adapt'
import { enforceRateLimit, clientIpFrom, rateLimitedResponse } from './lib/rate-limit'
import { safeError } from './lib/safe-error'
import { corsHeaders, corsPreflight } from './lib/cors'

// H12: hard ceiling on request body size — anything larger than 64 KB is
// rejected before the JSON parser runs.
const MAX_BODY_BYTES = 64 * 1024

// M14: txBase64 itself is capped at 100k chars (matches extension bridge).
const MAX_TX_BASE64_LEN = 100_000

async function handler(req: Request): Promise<Response> {
  const cors = corsHeaders(req, 'POST, OPTIONS')

  if (req.method === 'OPTIONS') {
    return corsPreflight(req, 'POST, OPTIONS')
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  // H3: per-IP rate limit — 10 requests/minute (decode is the most expensive route).
  const ip = clientIpFrom({
    headers: Object.fromEntries(req.headers.entries()),
    socket: undefined,
  })
  const rl = await enforceRateLimit('decode', ip, 10, 60)
  if (!rl.ok) return rateLimitedResponse(rl.retryAfter, cors)

  // H12: reject oversized bodies via Content-Length before reading.
  const contentLength = parseInt(req.headers.get('content-length') ?? '0', 10)
  if (contentLength >= MAX_BODY_BYTES) {
    return new Response(JSON.stringify({ error: 'request body too large' }), {
      status: 413,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  let txBase64: string
  try {
    const body = await req.json()
    txBase64 = body?.txBase64
    if (!txBase64 || typeof txBase64 !== 'string' || txBase64.trim() === '') {
      return new Response(JSON.stringify({ error: 'txBase64 is required' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }
    // M14: explicit length cap on the base64 string (defense in depth).
    if (txBase64.length > MAX_TX_BASE64_LEN) {
      return new Response(JSON.stringify({ error: 'txBase64 too long' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: safeError(err, 'invalid JSON body') }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  let tx: VersionedTransaction
  try {
    const txBytes = Buffer.from(txBase64, 'base64')
    tx = VersionedTransaction.deserialize(txBytes)
  } catch (err) {
    return new Response(JSON.stringify({ error: safeError(err, 'failed to deserialize transaction') }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const generator = decodeTransaction(tx)
        for await (const chunk of generator) {
          const sseData = `data: ${JSON.stringify({ chunk })}\n\n`
          controller.enqueue(encoder.encode(sseData))
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      } catch (err) {
        // M15: log the real error server-side, send only a generic message to the client.
        const generic = safeError(err, 'stream error')
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: generic })}\n\n`)
        )
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    status: 200,
    headers: {
      ...cors,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
  })
}

export default adaptForVercel(handler)
