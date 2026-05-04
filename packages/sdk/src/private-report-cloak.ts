/**
 * private-report-cloak.ts
 *
 * Submits a private threat report using Cloak's UTXO shielded pool.
 * Privacy model: reporter deposits SOL into Cloak's ZK pool → the deposit
 * produces a CloakNote (commitment + ZK proof). The note is the privacy
 * anchor — it proves the reporter funded a shielded UTXO without revealing
 * which wallet made the deposit.
 *
 * The actual oracle report is submitted via a SPL Memo tx signed by the payer
 * (same as submitPrivateReport). The difference: the returned viewingKey is
 * the serialised CloakNote (base64), not just an ephemeral pubkey.
 *
 * SDK: @cloak.dev/sdk  (uses @solana/web3.js v1 — compatible)
 * Min deposit: 0.01 SOL (10_000_000 lamports) enforced by Cloak protocol.
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
} from '@solana/web3.js'
import { CloakSDK, serializeNote, MIN_DEPOSIT_LAMPORTS } from '@cloak.dev/sdk'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface SubmitPrivateReportCloakOptions {
  connection: Connection
  payer: Keypair
  /** Override deposit amount in lamports. Min is MIN_DEPOSIT_LAMPORTS (0.01 SOL). */
  depositLamports?: number
}

export interface PrivateReportCloakResult {
  /** Solana tx signature of the shielded deposit. */
  txSignature: string
  /**
   * Serialised CloakNote as base64 — the ZK commitment proving the reporter
   * shielded funds into the Cloak pool. Store privately; anyone with this
   * note can withdraw the deposited SOL.
   */
  viewingKey: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SPL_MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validate(address: string, confidence: number): void {
  try { new PublicKey(address) } catch {
    throw new Error(`[walour/sdk] submitPrivateReportCloak: invalid address — "${address}"`)
  }
  if (confidence < 0 || confidence > 1) {
    throw new RangeError(`[walour/sdk] submitPrivateReportCloak: confidence must be in [0,1], got ${confidence}`)
  }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Submit a private threat report anchored by a Cloak shielded UTXO deposit.
 *
 * Flow:
 *  1. Deposit SOL into Cloak's ZK pool — produces a CloakNote (commitment).
 *  2. Submit a Memo tx encoding the report (address, label, confidence).
 *  3. Return the deposit tx signature + serialised CloakNote as viewingKey.
 *
 * The payer needs ≥ 0.01 SOL + tx fees on the target network.
 *
 * @example
 * ```ts
 * const result = await submitPrivateReportCloak(
 *   'DrainerAddress123...',
 *   'drainer',
 *   0.9,
 *   { connection, payer }
 * )
 * // result.viewingKey is a base64 CloakNote — keep it private
 * ```
 */
export async function submitPrivateReportCloak(
  address: string,
  label: 'drainer' | 'rug' | 'phishing_domain' | 'malicious_token',
  confidence: number,
  options: SubmitPrivateReportCloakOptions
): Promise<PrivateReportCloakResult> {
  validate(address, confidence)

  const { connection, payer } = options
  const depositLamports = options.depositLamports ?? MIN_DEPOSIT_LAMPORTS

  if (depositLamports < MIN_DEPOSIT_LAMPORTS) {
    throw new RangeError(
      `[walour/sdk] depositLamports must be ≥ ${MIN_DEPOSIT_LAMPORTS} (0.01 SOL), got ${depositLamports}`
    )
  }

  // 1. Initialise Cloak SDK with payer keypair (Node.js mode)
  const sdk = new CloakSDK({
    keypairBytes: payer.secretKey,
    network: (process.env.CLOAK_NETWORK as 'mainnet-beta' | 'devnet') ?? 'mainnet-beta',
  })

  // 2. Deposit into Cloak shielded pool — produces a CloakNote
  const depositResult = await sdk.deposit(connection, depositLamports)
  const note = depositResult.note
  const txSignature = depositResult.signature

  // 3. Submit a Memo tx encoding the report data (signed by payer)
  const confidencePct = Math.round(confidence * 100)
  const memoText = `WALOUR_REPORT:v1:${address}:${label}:${confidencePct}`
  const { blockhash } = await connection.getLatestBlockhash()
  const memoTx = new Transaction({
    recentBlockhash: blockhash,
    feePayer: payer.publicKey,
  }).add({
    programId: SPL_MEMO_PROGRAM_ID,
    keys: [{ pubkey: payer.publicKey, isSigner: true, isWritable: false }],
    data: Buffer.from(memoText, 'utf-8'),
  })
  await sendAndConfirmTransaction(connection, memoTx, [payer], { commitment: 'confirmed' })

  // 4. Return deposit signature + serialised note as base64 viewingKey
  const viewingKey = Buffer.from(serializeNote(note)).toString('base64')

  return { txSignature, viewingKey }
}
