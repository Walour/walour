import { VersionedTransaction } from '@solana/web3.js'
import { decodeTransaction } from '@walour/sdk'

export const config = { runtime: 'edge' }

const corsHeaders = {
  'Access-Control-Allow-Origin': 'chrome-extension://*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let txBase64: string
  try {
    const body = await req.json()
    txBase64 = body?.txBase64
    if (!txBase64 || typeof txBase64 !== 'string' || txBase64.trim() === '') {
      return new Response(JSON.stringify({ error: 'txBase64 is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let tx: VersionedTransaction
  try {
    const txBytes = Buffer.from(txBase64, 'base64')
    tx = VersionedTransaction.deserialize(txBytes)
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to deserialize transaction' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
        const errMsg = err instanceof Error ? err.message : 'Stream error'
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: errMsg })}\n\n`)
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
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
  })
}
