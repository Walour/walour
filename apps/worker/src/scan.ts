import { Connection, VersionedTransaction, PublicKey } from '@solana/web3.js'
import { checkDomain, checkTokenRisk, lookupAddress } from '@walour/sdk'
import { adaptForVercel } from './lib/adapt'

// Known program IDs to exclude from mint detection
const KNOWN_PROGRAMS = new Set([
  '11111111111111111111111111111111',
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe8bSe',
  'ComputeBudget111111111111111111111111111111',
  'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
])

function getConnection(): Connection {
  return new Connection(
    `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`,
    'confirmed'
  )
}

async function resolveAccounts(
  tx: VersionedTransaction,
  connection: Connection
): Promise<{ accounts: PublicKey[]; failed: boolean }> {
  const staticKeys = tx.message.staticAccountKeys
  const compiledInstructions = tx.message.compiledInstructions

  // Collect all referenced indexes from instructions
  const indexSet = new Set<number>()
  for (const ix of compiledInstructions) {
    for (const idx of ix.accountKeyIndexes) {
      indexSet.add(idx)
    }
  }

  // Start with all static keys
  const resolved: PublicKey[] = [...staticKeys]

  // Add instruction-referenced static keys (may duplicate, deduped below)
  for (const idx of indexSet) {
    if (idx < staticKeys.length) {
      resolved.push(staticKeys[idx])
    }
  }

  // Resolve Address Lookup Tables
  let failed = false
  const lookups = tx.message.addressTableLookups
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

  // Deduplicate
  const seen = new Set<string>()
  const unique: PublicKey[] = []
  for (const key of resolved) {
    const str = key.toBase58()
    if (!seen.has(str)) {
      seen.add(str)
      unique.push(key)
    }
  }

  return { accounts: unique, failed }
}

function findLikelyMint(accounts: PublicKey[]): string | null {
  for (const key of accounts) {
    const str = key.toBase58()
    if (!KNOWN_PROGRAMS.has(str)) {
      return str
    }
  }
  return null
}

async function handler(req: Request): Promise<Response> {
  const ALLOWED_ORIGIN =
    process.env.NODE_ENV === 'development'
      ? '*'
      : `chrome-extension://${process.env.EXTENSION_ID}`

  const corsHeaders = {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const url = new URL(req.url, "http://localhost")
  const hostname = url.searchParams.get('hostname')
  const txParam = url.searchParams.get('tx')

  if (!hostname || hostname.trim() === '') {
    return new Response(JSON.stringify({ error: 'hostname is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const connection = getConnection()
  let mintAddress: string | null = null
  let altWarning = false

  let resolvedAccounts: PublicKey[] | null = null
  if (txParam) {
    try {
      const tx = VersionedTransaction.deserialize(Buffer.from(txParam, 'base64'))
      const { accounts, failed: altFailed } = await resolveAccounts(tx, connection)
      if (altFailed) altWarning = true
      resolvedAccounts = accounts
      mintAddress = findLikelyMint(accounts)
    } catch {
      mintAddress = null
    }
  }

  // Check all non-program tx accounts against the threat corpus
  let drainerHit: { address: string; confidence: number } | null = null
  if (resolvedAccounts) {
    try {
      const nonProgram = resolvedAccounts.filter(k => !KNOWN_PROGRAMS.has(k.toBase58()))
      const hits = await Promise.all(nonProgram.map(k => lookupAddress(k.toBase58())))
      // Only 'drainer', 'rug', 'phishing_domain' entries flip domain to RED.
      // 'malicious_token' entries are surfaced via checkTokenRisk's own corpusHit check.
      const first = hits.find(h => h !== null && h.type !== 'malicious_token')
      if (first) drainerHit = { address: first.address, confidence: first.confidence }
    } catch { /* non-fatal */ }
  }

  const [domainResult, tokenResult] = await Promise.all([
    checkDomain(hostname),
    mintAddress ? checkTokenRisk(mintAddress) : Promise.resolve(null),
  ])

  // If a tx account is a known drainer, upgrade domain result to RED
  const finalDomain = drainerHit
    ? {
        level: 'RED',
        reason: `Transaction destination ${drainerHit.address.slice(0, 8)}... is a known threat (confidence ${Math.round(drainerHit.confidence * 100)}%)`,
        confidence: drainerHit.confidence,
        source: 'corpus',
      }
    : domainResult

  const responseBody: Record<string, unknown> = { domain: finalDomain, token: tokenResult }
  if (altWarning) responseBody.altWarning = true

  return new Response(
    JSON.stringify(responseBody),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  )
}

export default adaptForVercel(handler)
