/**
 * private-report-cloak.test.ts
 * Unit tests for submitPrivateReportCloak() — Cloak SDK mocked, no real RPC.
 */

import { Keypair } from '@solana/web3.js'

const MOCK_TX_SIG = 'CloakMockSig11111111111111111111111111111111111111111111111'
const MOCK_NOTE = { version: '1', commitment: 'abc123', amount: 10000000, network: 'devnet' }

jest.mock('@cloak.dev/sdk', () => {
  class CloakSDK {
    constructor(_config: unknown) {}
    deposit(_connection: unknown, _amount: unknown) {
      return Promise.resolve({ note: MOCK_NOTE, signature: 'CloakMockSig11111111111111111111111111111111111111111111111', depositSignature: 'CloakMockSig11111111111111111111111111111111111111111111111' })
    }
  }
  return {
    CloakSDK,
    serializeNote: jest.fn((note: unknown) => JSON.stringify(note)),
    MIN_DEPOSIT_LAMPORTS: 10000000,
  }
})

jest.mock('@solana/web3.js', () => {
  const actual = jest.requireActual('@solana/web3.js')
  return {
    ...actual,
    sendAndConfirmTransaction: jest.fn().mockResolvedValue('MemoTxSig111'),
    Connection: jest.fn().mockImplementation(() => ({
      getLatestBlockhash: jest.fn().mockResolvedValue({ blockhash: '11111111111111111111111111111111', lastValidBlockHeight: 999 }),
    })),
  }
})

import { submitPrivateReportCloak } from '../src/private-report-cloak'
import { Connection } from '@solana/web3.js'

const VALID_ADDRESS = 'So11111111111111111111111111111111111111112'

function makeOpts() {
  return { connection: new Connection('https://api.devnet.solana.com'), payer: Keypair.generate() }
}

describe('submitPrivateReportCloak()', () => {
  it('returns txSignature and viewingKey', async () => {
    const result = await submitPrivateReportCloak(VALID_ADDRESS, 'drainer', 0.9, makeOpts())
    expect(typeof result.txSignature).toBe('string')
    expect(typeof result.viewingKey).toBe('string')
    expect(result.txSignature).toBe(MOCK_TX_SIG)
  })

  it('viewingKey is base64 encoded CloakNote', async () => {
    const result = await submitPrivateReportCloak(VALID_ADDRESS, 'drainer', 0.9, makeOpts())
    const decoded = JSON.parse(Buffer.from(result.viewingKey, 'base64').toString('utf-8'))
    expect(decoded).toHaveProperty('commitment')
  })

  it('accepts all label types', async () => {
    const labels = ['drainer', 'rug', 'phishing_domain', 'malicious_token'] as const
    for (const label of labels) {
      const r = await submitPrivateReportCloak(VALID_ADDRESS, label, 0.5, makeOpts())
      expect(r).toHaveProperty('txSignature')
    }
  })

  it('throws RangeError for confidence < 0', async () => {
    await expect(submitPrivateReportCloak(VALID_ADDRESS, 'drainer', -0.01, makeOpts())).rejects.toThrow(RangeError)
  })

  it('throws RangeError for confidence > 1', async () => {
    await expect(submitPrivateReportCloak(VALID_ADDRESS, 'drainer', 1.01, makeOpts())).rejects.toThrow(RangeError)
  })

  it('throws Error for invalid address', async () => {
    await expect(submitPrivateReportCloak('NOT_VALID!!!', 'drainer', 0.9, makeOpts())).rejects.toThrow(Error)
  })

  it('throws RangeError if depositLamports below minimum', async () => {
    await expect(
      submitPrivateReportCloak(VALID_ADDRESS, 'drainer', 0.9, { ...makeOpts(), depositLamports: 1000 })
    ).rejects.toThrow(RangeError)
  })
})

describe('submitPrivateReportCloak() — devnet integration', () => {
  it('deposits into Cloak pool on devnet', async () => {
    if (!process.env.WALOUR_DEVNET_TEST) return

    // Requires WALOUR_DEVNET_KEYPAIR env var — JSON array of your funded devnet keypair bytes
    // Example: $env:WALOUR_DEVNET_KEYPAIR='[1,2,3,...]'  (64-byte array from Phantom export)
    const keypairEnv = process.env.WALOUR_DEVNET_KEYPAIR
    if (!keypairEnv) {
      console.warn('Skipping: set WALOUR_DEVNET_KEYPAIR to a funded devnet keypair JSON array')
      return
    }

    jest.unmock('@cloak.dev/sdk')
    jest.unmock('@solana/web3.js')
    const { Connection: RealConn, Keypair: RealKeypair } = await import('@solana/web3.js')
    const conn = new RealConn('https://api.devnet.solana.com', 'confirmed')
    const payer = RealKeypair.fromSecretKey(Uint8Array.from(JSON.parse(keypairEnv)))

    const balance = await conn.getBalance(payer.publicKey)
    console.log(`Payer balance: ${balance / 1e9} SOL`)
    expect(balance).toBeGreaterThanOrEqual(15_000_000) // need ≥ 0.015 SOL

    const result = await submitPrivateReportCloak(VALID_ADDRESS, 'drainer', 0.9, { connection: conn, payer })
    expect(typeof result.txSignature).toBe('string')
    expect(typeof result.viewingKey).toBe('string')
    console.log('Cloak deposit tx:', result.txSignature)
    console.log('Explorer:', `https://explorer.solana.com/tx/${result.txSignature}?cluster=devnet`)
  }, 120_000)
})
