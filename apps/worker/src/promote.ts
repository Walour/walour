// GET /api/promote — called by Vercel cron every hour
// Promotes high-confidence Supabase entries to the on-chain oracle.
//
// Prerequisites (Supabase migration 002_promote.sql):
//   ALTER TABLE threat_reports ADD COLUMN IF NOT EXISTS promoted_at TIMESTAMPTZ;
//   CREATE INDEX IF NOT EXISTS idx_threat_reports_promote ON threat_reports (confidence, promoted_at) WHERE confidence > 0.7;

import { createClient } from '@supabase/supabase-js'
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
} from '@solana/web3.js'
import * as anchor from '@coral-xyz/anchor'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ThreatRow {
  id: string
  address: string
  confidence: number
  threat_type: string
}

// ---------------------------------------------------------------------------
// Anchor IDL (minimal — only what promote.ts needs)
// ---------------------------------------------------------------------------

const PROMOTE_IDL = {
  version: '0.1.0',
  name: 'walour_oracle',
  instructions: [
    {
      name: 'updateConfidence',
      accounts: [
        { name: 'threatReport', isMut: true, isSigner: false },
        { name: 'oracleConfig', isMut: false, isSigner: false },
        { name: 'authority', isMut: false, isSigner: true },
        { name: 'systemProgram', isMut: false, isSigner: false },
      ],
      args: [
        { name: 'address', type: 'publicKey' },
        { name: 'newScore', type: 'u8' },
      ],
    },
  ],
  accounts: [
    {
      name: 'ThreatReport',
      type: {
        kind: 'struct',
        fields: [
          { name: 'address', type: 'publicKey' },
          { name: 'threatType', type: { defined: 'ThreatType' } },
          { name: 'source', type: { array: ['u8', 32] } },
          { name: 'evidenceUrl', type: { array: ['u8', 128] } },
          { name: 'confidence', type: 'u8' },
          { name: 'firstSeen', type: 'i64' },
          { name: 'lastUpdated', type: 'i64' },
          { name: 'corroborations', type: 'u32' },
          { name: 'bump', type: 'u8' },
        ],
      },
    },
    {
      name: 'OracleConfig',
      type: {
        kind: 'struct',
        fields: [
          { name: 'authority', type: 'publicKey' },
          { name: 'bump', type: 'u8' },
        ],
      },
    },
  ],
  types: [
    {
      name: 'ThreatType',
      type: {
        kind: 'enum',
        variants: [
          { name: 'Drainer' },
          { name: 'Rug' },
          { name: 'PhishingDomain' },
          { name: 'MaliciousToken' },
        ],
      },
    },
  ],
  errors: [],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export default async function handler(
  req: Request
): Promise<Response> {
  if (req.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const startMs = Date.now()

  // --- Validate env ---
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY
  const heliusKey = process.env.HELIUS_API_KEY
  const programIdStr = process.env.WALOUR_PROGRAM_ID
  const authorityKeyRaw = process.env.PROGRAM_AUTHORITY_KEYPAIR

  if (!supabaseUrl || !supabaseKey || !heliusKey || !programIdStr || !authorityKeyRaw) {
    return new Response(
      JSON.stringify({ error: 'Missing required environment variables' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // --- Build Supabase client ---
  const supabase = createClient(supabaseUrl, supabaseKey)

  // --- Build Anchor provider ---
  const authorityKeypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(authorityKeyRaw))
  )
  const connection = new Connection(
    `https://mainnet.helius-rpc.com/?api-key=${heliusKey}`,
    'confirmed'
  )
  const wallet = new anchor.Wallet(authorityKeypair)
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
  })
  anchor.setProvider(provider)
  // Inject programId into IDL so Anchor 0.30.x 2-arg constructor can read it
  ;(PROMOTE_IDL as { address: string }).address = programIdStr
  const programId = new PublicKey(programIdStr)
  // Use 2-arg constructor for Anchor 0.30.x; falls back gracefully on 0.29.x
  const program = new anchor.Program(PROMOTE_IDL as anchor.Idl, provider)

  // PDAs
  const [oracleConfigPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('config')],
    programId
  )

  // --- Fetch candidates ---
  const { data: rows, error: fetchErr } = await supabase
    .from('threat_reports')
    .select('id, address, confidence, threat_type')
    .gt('confidence', 0.7)
    .or('promoted_at.is.null,promoted_at.lt.' + new Date(Date.now() - 86_400_000).toISOString())
    .order('confidence', { ascending: false })
    .limit(10)

  if (fetchErr) {
    return new Response(
      JSON.stringify({ error: 'Supabase fetch failed', detail: fetchErr.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const candidates = (rows as ThreatRow[]) ?? []
  let promoted = 0
  let errors = 0

  for (const row of candidates) {
    try {
      const address = new PublicKey(row.address)

      const [threatReportPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('threat'), address.toBuffer()],
        programId
      )

      // Skip rows whose ThreatReport PDA doesn't exist on-chain yet
      const pdaInfo = await connection.getAccountInfo(threatReportPda)
      if (!pdaInfo) {
        console.warn(`[promote] PDA not found on-chain for ${row.address} — skipping`)
        continue
      }

      // Confidence stored as 0–1 in Supabase, on-chain expects 0–100
      const onChainScore = Math.min(100, Math.round(row.confidence * 100))

      await program.methods
        .updateConfidence(address, onChainScore)
        .accounts({
          threatReport: threatReportPda,
          oracleConfig: oracleConfigPda,
          authority: authorityKeypair.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc()

      // Mark promoted in Supabase
      const { error: updateErr } = await supabase
        .from('threat_reports')
        .update({ promoted_at: new Date().toISOString() })
        .eq('id', row.id)

      if (updateErr) {
        console.error(`[promote] Failed to mark row ${row.id} as promoted:`, updateErr.message)
      }

      promoted++
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[promote] Failed to promote ${row.address}:`, msg)

      // Log to outages table — non-blocking
      await supabase.from('outages').insert({
        service: 'promote-worker',
        error: msg,
        address: row.address,
        occurred_at: new Date().toISOString(),
      }).then(() => undefined)

      errors++
    }
  }

  const duration_ms = Date.now() - startMs

  return new Response(
    JSON.stringify({ promoted, errors, duration_ms }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  )
}
