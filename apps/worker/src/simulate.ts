import { Connection, VersionedTransaction } from '@solana/web3.js'
import { cacheGet, cacheSet } from '@walour/sdk/lib/cache'
import { enforceRateLimit, clientIpFrom, rateLimitedResponse } from './lib/rate-limit'
import { safeError } from './lib/safe-error'

export const config = { runtime: 'edge' }

export interface SimDelta {
  mint: string
  symbol?: string
  change: number      // human units (divided by 10^decimals)
  decimals: number
  uiChange: string    // formatted: "+0.5" or "-1000"
}

// H13: hard ceiling on body size.
const MAX_BODY_BYTES = 64 * 1024
// M14: txBase64 length cap.
const MAX_TX_BASE64_LEN = 100_000

async function getTokenSymbol(mint: string): Promise<string | undefined> {
  const cacheKey = `token:meta:${mint}`
  const cached = await cacheGet<{ symbol: string }>(cacheKey)
  if (cached?.symbol) return cached.symbol

  const apiKey = process.env.JUPITER_API_KEY
  if (!apiKey) return undefined

  try {
    const res = await fetch(
      `https://api.jup.ag/tokens/v1/token/${mint}`,
      {
        headers: { 'x-api-key': apiKey },
        signal: AbortSignal.timeout(3_000),
      }
    )
    if (!res.ok) return undefined
    const data = await res.json() as {
      address: string
      symbol: string
      name: string
      decimals: number
    }
    if (!data?.symbol) return undefined
    await cacheSet(cacheKey, { symbol: data.symbol }, 3_600)
    return data.symbol
  } catch (err) {
    // M16: log full detail; client-side path doesn't see this error directly.
    safeError(err, 'token-symbol-lookup-failed')
    return undefined
  }
}

export interface SimResult {
  success: boolean
  solChangeLamports: number
  deltas: SimDelta[]
  error?: string
  cluster?: 'mainnet' | 'devnet'
}

function getConnection(cluster: 'mainnet' | 'devnet' = 'mainnet'): Connection {
  const url = cluster === 'devnet'
    ? `https://devnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
    : `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
  return new Connection(url, 'confirmed')
}

async function handler(req: Request): Promise<Response> {
  const ALLOWED_ORIGIN = process.env.NODE_ENV === 'development' ? '*' : 'chrome-extension://*'
  const corsHeaders = {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }

  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // H3: per-IP rate limit — 10 requests/minute. Simulate hits Helius RPC, so
  // it's a more expensive route than scan.
  const ip = clientIpFrom({
    headers: Object.fromEntries(req.headers.entries()),
    socket: undefined,
  })
  const rl = await enforceRateLimit('simulate', ip, 10, 60)
  if (!rl.ok) return rateLimitedResponse(rl.retryAfter, corsHeaders)

  // H13: body size cap.
  const contentLength = parseInt(req.headers.get('content-length') ?? '0', 10)
  if (contentLength >= MAX_BODY_BYTES) {
    return new Response(JSON.stringify({ error: 'request body too large' }), {
      status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // H14: caller opts in to devnet via ?cluster=devnet. We never auto-pivot.
  const url = new URL(req.url, 'http://localhost')
  const requestedCluster = url.searchParams.get('cluster') === 'devnet' ? 'devnet' : 'mainnet'

  try {
    const { txBase64, signerPubkey } = await req.json() as { txBase64: string; signerPubkey?: string }
    if (!txBase64) {
      return new Response(JSON.stringify({ success: false, error: 'txBase64 required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    // M14: explicit length cap.
    if (txBase64.length > MAX_TX_BASE64_LEN) {
      return new Response(JSON.stringify({ success: false, error: 'txBase64 too long' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const txBytes = Buffer.from(txBase64, 'base64')
    const tx = VersionedTransaction.deserialize(txBytes)

    // H14: simulate strictly on the requested cluster. No silent devnet fallback.
    const sim = await getConnection(requestedCluster).simulateTransaction(tx, {
      replaceRecentBlockhash: true,
      commitment: 'confirmed',
    })

    if (sim.value.err) {
      // M16: log full simulator error server-side; return a stable shape to the client.
      console.warn('[simulate] simulation returned error', { cluster: requestedCluster, err: sim.value.err })
      return new Response(
        JSON.stringify({
          success: false,
          error: 'simulation failed',
          cluster: requestedCluster,
          solChangeLamports: 0,
          deltas: [],
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // SOL delta: postBalances[0] - preBalances[0] (negative = spending SOL)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const simVal = sim.value as any
    const pre = simVal.preBalances ?? []
    const post = simVal.postBalances ?? []
    const solChangeLamports = (post[0] ?? 0) - (pre[0] ?? 0)

    // Token deltas from simulation pre/post token balances
    const preTokenMap = new Map<string, { amount: string; decimals: number; mint: string }>()
    for (const tb of simVal.preTokenBalances ?? []) {
      preTokenMap.set(`${tb.accountIndex}:${tb.mint}`, {
        amount: tb.uiTokenAmount.amount,
        decimals: tb.uiTokenAmount.decimals,
        mint: tb.mint,
      })
    }

    const deltas: SimDelta[] = []
    for (const tb of simVal.postTokenBalances ?? []) {
      const key = `${tb.accountIndex}:${tb.mint}`
      const preTb = preTokenMap.get(key)
      const preAmount = BigInt(preTb?.amount ?? '0')
      const postAmount = BigInt(tb.uiTokenAmount.amount)
      const diff = postAmount - preAmount
      if (diff === 0n) continue
      const decimals = tb.uiTokenAmount.decimals
      const change = Number(diff) / Math.pow(10, decimals)
      deltas.push({
        mint: tb.mint,
        change,
        decimals,
        uiChange: (change >= 0 ? '+' : '') + change.toFixed(decimals > 4 ? 2 : decimals),
      })
    }

    // signerPubkey is accepted for future filtering but not required in this version
    void signerPubkey

    // DH-05: enrich each delta with token symbol (cache-first, never blocks on Jupiter failure)
    await Promise.all(
      deltas.map(async (d) => {
        const sym = await getTokenSymbol(d.mint)
        if (sym) d.symbol = sym
      })
    )

    const result: SimResult = { success: true, solChangeLamports, deltas, cluster: requestedCluster }
    return new Response(JSON.stringify(result), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    // M15: never echo raw exception messages to the client.
    return new Response(
      JSON.stringify({
        success: false,
        error: safeError(err, 'simulation failed'),
        cluster: requestedCluster,
        solChangeLamports: 0,
        deltas: [],
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

export default handler
