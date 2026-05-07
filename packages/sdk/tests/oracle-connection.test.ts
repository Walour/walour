/**
 * oracle-connection.test.ts
 *
 * Verifies that getOracleConnection() honors WALOUR_ORACLE_CLUSTER and
 * WALOUR_ORACLE_RPC_URL. We capture the URL passed to the Connection
 * constructor by mocking @solana/web3.js.
 */

const lastUrl: { value: string | null } = { value: null }

jest.mock('@solana/web3.js', () => {
  const actual = jest.requireActual('@solana/web3.js')
  return {
    ...actual,
    Connection: jest.fn().mockImplementation((url: string) => {
      lastUrl.value = url
      return { getAccountInfo: jest.fn() }
    }),
  }
})

import { getOracleConnection } from '../src/lib/rpc'

beforeEach(() => {
  lastUrl.value = null
  delete process.env.WALOUR_ORACLE_CLUSTER
  delete process.env.WALOUR_ORACLE_RPC_URL
  delete process.env.HELIUS_API_KEY
})

describe('getOracleConnection', () => {
  it('defaults to devnet public RPC when no env is set', () => {
    getOracleConnection()
    expect(lastUrl.value).toBe('https://api.devnet.solana.com')
  })

  it('uses devnet public RPC when WALOUR_ORACLE_CLUSTER=devnet', () => {
    process.env.WALOUR_ORACLE_CLUSTER = 'devnet'
    getOracleConnection()
    expect(lastUrl.value).toBe('https://api.devnet.solana.com')
  })

  it('routes to Helius mainnet when WALOUR_ORACLE_CLUSTER=mainnet and HELIUS_API_KEY is set', () => {
    process.env.WALOUR_ORACLE_CLUSTER = 'mainnet'
    process.env.HELIUS_API_KEY = 'fake-key'
    getOracleConnection()
    expect(lastUrl.value).toBe('https://mainnet.helius-rpc.com/?api-key=fake-key')
  })

  it('falls back to public mainnet when WALOUR_ORACLE_CLUSTER=mainnet without HELIUS_API_KEY', () => {
    process.env.WALOUR_ORACLE_CLUSTER = 'mainnet'
    getOracleConnection()
    expect(lastUrl.value).toBe('https://api.mainnet-beta.solana.com')
  })

  it('WALOUR_ORACLE_RPC_URL overrides cluster selection', () => {
    process.env.WALOUR_ORACLE_CLUSTER = 'devnet'
    process.env.WALOUR_ORACLE_RPC_URL = 'https://my-private-rpc.example/?key=abc'
    getOracleConnection()
    expect(lastUrl.value).toBe('https://my-private-rpc.example/?key=abc')
  })
})
