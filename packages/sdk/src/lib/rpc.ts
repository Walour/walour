import { Connection } from '@solana/web3.js'

export interface RpcEndpoint {
  name: string
  url: string
}

let _warned = false

export function getRpcEndpoints(): RpcEndpoint[] {
  const heliusKey = process.env.HELIUS_API_KEY
  const tritonKey = process.env.TRITON_KEY
  const rpcFastKey = process.env.RPC_FAST_API_KEY

  if (!rpcFastKey && !_warned) {
    console.log('[rpc] RPC Fast tier disabled (no key)')
    _warned = true
  }

  return [
    ...(heliusKey
      ? [{ name: 'helius', url: `https://mainnet.helius-rpc.com/?api-key=${heliusKey}` }]
      : []),
    ...(tritonKey
      ? [{ name: 'triton', url: `https://${tritonKey}.rpcpool.com` }]
      : []),
    ...(rpcFastKey
      ? [{ name: 'rpc_fast', url: `https://solana-mainnet.rpcfast.io?api_key=${rpcFastKey}` }]
      : []),
    { name: 'public', url: 'https://api.mainnet-beta.solana.com' },
  ]
}

/**
 * Try each RPC endpoint in order, respecting the circuit breaker state.
 * Exported so circuit-breaker.ts can wire it up without circular imports.
 */
export async function withRpcFallback<T>(
  fn: (conn: Connection) => Promise<T>
): Promise<T> {
  const { isOpen, recordFailure, recordSuccess } = await import('./circuit-breaker')
  const endpoints = getRpcEndpoints()

  let lastErr: unknown
  for (const ep of endpoints) {
    if (isOpen(ep.name)) continue
    const conn = new Connection(ep.url, 'confirmed')
    try {
      const result = await fn(conn)
      recordSuccess(ep.name)
      return result
    } catch (err) {
      recordFailure(ep.name)
      lastErr = err
    }
  }
  throw lastErr ?? new Error('[rpc] All RPC endpoints failed')
}

/**
 * pingRpcFast — makes one getLatestBlockhash call directly to RPC Fast.
 * Called by plan 03-09 E2E to satisfy the bounty "active use" criterion.
 */
export async function pingRpcFast(): Promise<{
  used: boolean
  blockhash?: string
  latencyMs?: number
}> {
  const key = process.env.RPC_FAST_API_KEY
  if (!key) return { used: false }

  const url = `https://solana-mainnet.rpcfast.io?api_key=${key}`
  const start = Date.now()
  const conn = new Connection(url, 'confirmed')
  const { blockhash } = await conn.getLatestBlockhash()
  return { used: true, blockhash, latencyMs: Date.now() - start }
}
