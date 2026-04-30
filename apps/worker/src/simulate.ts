import { Connection, VersionedTransaction } from '@solana/web3.js'

export const config = { runtime: 'edge' }

export interface SimDelta {
  mint: string
  symbol?: string
  change: number      // human units (divided by 10^decimals)
  decimals: number
  uiChange: string    // formatted: "+0.5" or "-1000"
}

export interface SimResult {
  success: boolean
  solChangeLamports: number
  deltas: SimDelta[]
  error?: string
}

function getConnection(): Connection {
  return new Connection(
    `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`,
    'confirmed'
  )
}

export default async function handler(req: Request): Promise<Response> {
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

  try {
    const { txBase64, signerPubkey } = await req.json() as { txBase64: string; signerPubkey?: string }
    if (!txBase64) {
      return new Response(JSON.stringify({ success: false, error: 'txBase64 required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const connection = getConnection()
    const txBytes = Buffer.from(txBase64, 'base64')
    const tx = VersionedTransaction.deserialize(txBytes)

    const sim = await connection.simulateTransaction(tx, {
      replaceRecentBlockhash: true,
      commitment: 'confirmed',
    })

    if (sim.value.err) {
      return new Response(JSON.stringify({ success: false, error: JSON.stringify(sim.value.err), solChangeLamports: 0, deltas: [] }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // SOL delta: postBalances[0] - preBalances[0] (negative = spending SOL)
    const pre = sim.value.preBalances ?? []
    const post = sim.value.postBalances ?? []
    const solChangeLamports = (post[0] ?? 0) - (pre[0] ?? 0)

    // Token deltas from simulation pre/post token balances
    const preTokenMap = new Map<string, { amount: string; decimals: number; mint: string }>()
    for (const tb of sim.value.preTokenBalances ?? []) {
      preTokenMap.set(`${tb.accountIndex}:${tb.mint}`, {
        amount: tb.uiTokenAmount.amount,
        decimals: tb.uiTokenAmount.decimals,
        mint: tb.mint,
      })
    }

    const deltas: SimDelta[] = []
    for (const tb of sim.value.postTokenBalances ?? []) {
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

    const result: SimResult = { success: true, solChangeLamports, deltas }
    return new Response(JSON.stringify(result), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ success: false, error: msg, solChangeLamports: 0, deltas: [] }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
}
