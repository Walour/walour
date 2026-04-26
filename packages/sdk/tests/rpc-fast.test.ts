/**
 * rpc-fast.test.ts
 *
 * Verifies that:
 *  1. When RPC_FAST_API_KEY is set, `getRpcEndpoints()` includes an entry whose
 *     URL contains "rpcfast".
 *  2. When RPC_FAST_API_KEY is unset, the chain skips straight to public RPC.
 *  3. `pingRpcFast()` returns { used: false } when key is absent.
 *  4. `pingRpcFast()` calls getLatestBlockhash when key is present (mocked).
 */

import { getRpcEndpoints, pingRpcFast } from '../src/lib/rpc'

// ─── helpers ──────────────────────────────────────────────────────────────────

function setEnv(overrides: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) {
      delete process.env[k]
    } else {
      process.env[k] = v
    }
  }
}

// ─── getRpcEndpoints ──────────────────────────────────────────────────────────

describe('getRpcEndpoints()', () => {
  afterEach(() => {
    setEnv({
      HELIUS_API_KEY: undefined,
      TRITON_KEY: undefined,
      RPC_FAST_API_KEY: undefined,
    })
  })

  it('includes rpc_fast tier when RPC_FAST_API_KEY is set', () => {
    setEnv({ RPC_FAST_API_KEY: 'test_key_abc' })
    const endpoints = getRpcEndpoints()
    const names = endpoints.map((e) => e.name)
    expect(names).toContain('rpc_fast')
    const rfEp = endpoints.find((e) => e.name === 'rpc_fast')!
    expect(rfEp.url).toContain('rpcfast')
    expect(rfEp.url).toContain('test_key_abc')
  })

  it('omits rpc_fast tier when RPC_FAST_API_KEY is unset', () => {
    setEnv({ HELIUS_API_KEY: 'h_key', RPC_FAST_API_KEY: undefined })
    const endpoints = getRpcEndpoints()
    const names = endpoints.map((e) => e.name)
    expect(names).not.toContain('rpc_fast')
    expect(names).toContain('public')
  })

  it('always includes public RPC as last resort', () => {
    setEnv({ HELIUS_API_KEY: undefined, TRITON_KEY: undefined, RPC_FAST_API_KEY: undefined })
    const endpoints = getRpcEndpoints()
    expect(endpoints[endpoints.length - 1].name).toBe('public')
    expect(endpoints[endpoints.length - 1].url).toBe(
      'https://api.mainnet-beta.solana.com'
    )
  })

  it('orders endpoints: helius -> triton -> rpc_fast -> public', () => {
    setEnv({ HELIUS_API_KEY: 'h', TRITON_KEY: 't', RPC_FAST_API_KEY: 'r' })
    const names = getRpcEndpoints().map((e) => e.name)
    expect(names).toEqual(['helius', 'triton', 'rpc_fast', 'public'])
  })
})

// ─── pingRpcFast ──────────────────────────────────────────────────────────────

describe('pingRpcFast()', () => {
  afterEach(() => {
    setEnv({ RPC_FAST_API_KEY: undefined })
    jest.restoreAllMocks()
  })

  it('returns { used: false } when RPC_FAST_API_KEY is unset', async () => {
    setEnv({ RPC_FAST_API_KEY: undefined })
    const result = await pingRpcFast()
    expect(result).toEqual({ used: false })
  })

  it('returns blockhash and latencyMs when key is present (mocked)', async () => {
    setEnv({ RPC_FAST_API_KEY: 'test_key_xyz' })

    // Mock @solana/web3.js Connection so no real HTTP call is made
    const mockGetLatestBlockhash = jest
      .fn()
      .mockResolvedValue({ blockhash: 'FAKEHASH123', lastValidBlockHeight: 9999 })

    jest.mock('@solana/web3.js', () => {
      const actual = jest.requireActual('@solana/web3.js')
      return {
        ...actual,
        Connection: jest.fn().mockImplementation(() => ({
          getLatestBlockhash: mockGetLatestBlockhash,
        })),
      }
    })

    // Re-import after mock is set (jest module isolation)
    jest.resetModules()
    const { pingRpcFast: prf } = await import('../src/lib/rpc')
    const result = await prf()

    expect(result.used).toBe(true)
    expect(result.blockhash).toBe('FAKEHASH123')
    expect(typeof result.latencyMs).toBe('number')
  })
})
