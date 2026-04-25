import Anthropic from '@anthropic-ai/sdk'
import { Connection, VersionedTransaction, PublicKey } from '@solana/web3.js'
import { cacheGet, cacheSet } from './lib/cache'
import { isOpen, recordSuccess, recordFailure } from './lib/circuit-breaker'
import { lookupAddress } from './domain-check'
import { createHash } from 'crypto'

const CACHE_TTL = 86_400  // 24h
const STALL_TIMEOUT_MS = 2_000

// Known DEX programs — Approve to these is safe
const DEX_PROGRAMS = new Set([
  'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4', // Jupiter v6
  'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc',  // Orca Whirlpool
  '9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP', // Orca v2
  '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', // Raydium AMM
])

// Token program IDs
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
const TOKEN_2022_PROGRAM = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'

interface RedFlag {
  type: 'set_authority' | 'close_account' | 'unlimited_approve' | 'corpus_hit'
  detail: string
}

function detectRedFlags(
  instructions: Array<{ program: string; dataHex: string; accounts: string[] }>,
  corpusHits: Set<string>
): RedFlag[] {
  const flags: RedFlag[] = []

  for (const ix of instructions) {
    const discriminator = ix.dataHex.slice(0, 2) // first byte

    // SetAuthority on Token program: discriminator = 06
    if (
      (ix.program === TOKEN_PROGRAM || ix.program === TOKEN_2022_PROGRAM) &&
      discriminator === '06'
    ) {
      flags.push({
        type: 'set_authority',
        detail: `Token authority transfer to ${ix.accounts[2] ?? 'unknown'}`,
      })
    }

    // CloseAccount on Token program: discriminator = 09
    if (
      (ix.program === TOKEN_PROGRAM || ix.program === TOKEN_2022_PROGRAM) &&
      discriminator === '09'
    ) {
      const destination = ix.accounts[1] ?? 'unknown'
      flags.push({
        type: 'close_account',
        detail: `Closing token account, funds sent to ${destination}`,
      })
    }

    // Approve on Token program: discriminator = 04 — check if delegating to non-DEX
    if (
      (ix.program === TOKEN_PROGRAM || ix.program === TOKEN_2022_PROGRAM) &&
      discriminator === '04'
    ) {
      const delegate = ix.accounts[2] ?? ''
      if (delegate && !DEX_PROGRAMS.has(delegate)) {
        flags.push({
          type: 'unlimited_approve',
          detail: `Token approval granted to unknown program ${delegate}`,
        })
      }
    }

    // Check all account keys against corpus
    for (const account of ix.accounts) {
      if (corpusHits.has(account)) {
        flags.push({
          type: 'corpus_hit',
          detail: `Known threat address in transaction: ${account}`,
        })
      }
    }
  }

  return flags
}

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

function getConnection(): Connection {
  return new Connection(
    `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`,
    'confirmed'
  )
}

async function resolveALTs(
  tx: VersionedTransaction,
  connection: Connection
): Promise<{ accounts: PublicKey[]; failed: boolean }> {
  const lookups = tx.message.addressTableLookups
  if (!lookups.length) return { accounts: [...tx.message.staticAccountKeys], failed: false }

  const resolved: PublicKey[] = [...tx.message.staticAccountKeys]
  let failed = false

  for (const lookup of lookups) {
    try {
      const alt = await connection.getAddressLookupTable(lookup.accountKey)
      if (!alt.value) { failed = true; continue }
      for (const idx of lookup.writableIndexes) resolved.push(alt.value.state.addresses[idx])
      for (const idx of lookup.readonlyIndexes) resolved.push(alt.value.state.addresses[idx])
    } catch {
      failed = true
    }
  }

  return { accounts: resolved, failed }
}

function buildCacheKey(tx: VersionedTransaction): string {
  const instructions = tx.message.compiledInstructions.map(ix => ({
    p: ix.programIdIndex,
    d: Buffer.from(ix.data).toString('hex').slice(0, 16),
  }))
  return 'tx:decode:' + createHash('sha256').update(JSON.stringify(instructions)).digest('hex').slice(0, 16)
}

const SYSTEM_PROMPT = `You are a Solana transaction security auditor. Analyze the transaction instructions and explain in 2-3 plain English sentences what this transaction will do to the user's wallet. Focus on what assets move and where they go. Flag any risks clearly and directly. Use no jargon — write as if explaining to someone who doesn't know what a program ID is. Never use headers or bullet points. Respond with only the explanation.`

export async function* decodeTransaction(
  tx: VersionedTransaction
): AsyncGenerator<string> {
  const connection = getConnection()

  // 1. Resolve ALTs
  const { accounts, failed: altFailed } = await resolveALTs(tx, connection)
  if (altFailed) {
    yield 'Warning: address lookup table resolution failed — this transaction is higher-risk than normal. '
  }

  // 2. Check cache
  const cacheKey = buildCacheKey(tx)
  const cached = await cacheGet<string>(cacheKey)
  if (cached) {
    yield cached
    return
  }

  // 3. Build instruction list
  const instructions = tx.message.compiledInstructions.map(ix => ({
    program: accounts[ix.programIdIndex]?.toString() ?? 'unknown',
    dataHex: Buffer.from(ix.data).toString('hex').slice(0, 64),
    accounts: ix.accountKeyIndexes.map(i => accounts[i]?.toString() ?? 'unknown'),
  }))

  // 4. Red-flag detection (sync, corpus lookup)
  const allAccounts = instructions.flatMap(ix => ix.accounts)
  const corpusHits = new Set<string>()
  await Promise.allSettled(
    [...new Set(allAccounts)].map(async addr => {
      const hit = await lookupAddress(addr)
      if (hit) corpusHits.add(addr)
    })
  )
  const redFlags = detectRedFlags(instructions, corpusHits)

  // If we already have red flags, prepend them immediately so the user sees risk fast
  if (redFlags.length > 0) {
    const flagText = '⚠️ ' + redFlags.map(f => f.detail).join('. ') + '. '
    yield flagText
  }

  // 5. Stream from Claude Sonnet 4.6 (fast, cost-efficient for hot path)
  const client = getClient()
  let fullText = redFlags.length > 0
    ? '⚠️ ' + redFlags.map(f => f.detail).join('. ') + '. '
    : ''

  const userContent = `Transaction instructions:\n${JSON.stringify(instructions, null, 2)}${
    redFlags.length > 0
      ? `\n\nPre-detected risks: ${redFlags.map(f => f.detail).join('; ')}`
      : ''
  }`

  const useFallback = isOpen('claude')
  try {
    const stream = useFallback
      ? client.messages.stream({
          model: 'claude-haiku-4-5',
          max_tokens: 300,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userContent }],
        })
      : client.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 300,
          system: [
            {
              type: 'text',
              text: SYSTEM_PROMPT,
              // @ts-ignore — cache_control is valid at runtime per Anthropic SDK
              cache_control: { type: 'ephemeral' },
            },
          ],
          messages: [{ role: 'user', content: userContent }],
        })

    let lastChunkTime = Date.now()

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        fullText += event.delta.text
        yield event.delta.text
        lastChunkTime = Date.now()
      }

      // Stall detection
      if (Date.now() - lastChunkTime > STALL_TIMEOUT_MS) {
        yield ' [Decode stalled — verify this transaction manually before signing.]'
        break
      }
    }

    if (!useFallback) recordSuccess('claude')
    if (fullText.length > 10) {
      await cacheSet(cacheKey, fullText, CACHE_TTL)
    }
  } catch (err) {
    console.error('[tx-decoder] Claude error:', err instanceof Error ? err.message : err)
    if (!useFallback) recordFailure('claude')
    yield 'Unable to decode this transaction. Do not sign until you understand what it does.'
  }
}
