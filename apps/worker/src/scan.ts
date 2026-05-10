import { Connection, VersionedTransaction, PublicKey } from '@solana/web3.js'
import { checkDomain, checkTokenRisk, lookupAddress } from '@walour/sdk'
import { adaptForVercel } from './lib/adapt'
import { enforceRateLimit, clientIpFrom, rateLimitedResponse } from './lib/rate-limit'
import { safeError } from './lib/safe-error'
import { corsHeaders, corsPreflight } from './lib/cors'

// Known program IDs to exclude from mint detection
const KNOWN_PROGRAMS = new Set([
  '11111111111111111111111111111111',
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe8bSe',
  'ComputeBudget111111111111111111111111111111',
  'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
])

// CORS now handled by lib/cors.ts via a smart allow-list (chrome-extension://*
// + walour.io + walour.vercel.app + localhost). EXTENSION_ID env var no longer
// required — the chrome-extension scheme is allowed by regex.

// H11: hostname validation — limit to ASCII letters, digits, dots, hyphens, underscores.
// Anything else (script tags, slashes, query strings) is rejected up front.
const HOSTNAME_RE = /^[A-Za-z0-9._-]+$/

// M12: cap fan-out so a malicious tx with 200 accounts can't fan out 200
// `lookupAddress` calls per request.
const MAX_LOOKUP_ACCOUNTS = 32

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
  const cors = corsHeaders(req, 'GET, OPTIONS')

  if (req.method === 'OPTIONS') {
    return corsPreflight(req, 'GET, OPTIONS')
  }

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  // H3: per-IP rate limit on /api/scan — 30 requests/minute.
  const ip = clientIpFrom({
    headers: Object.fromEntries(req.headers.entries()),
    socket: undefined,
  })
  const rl = await enforceRateLimit('scan', ip, 30, 60)
  if (!rl.ok) return rateLimitedResponse(rl.retryAfter, cors)

  const url = new URL(req.url, "http://localhost")
  const hostname = url.searchParams.get('hostname')
  const txParam = url.searchParams.get('tx')

  // H11: strict hostname validation. Reject empty, too-long, or unsafe chars.
  if (!hostname || hostname.length > 256 || !HOSTNAME_RE.test(hostname)) {
    return new Response(JSON.stringify({ error: 'invalid hostname' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
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
  let tooManyAccounts = false
  if (resolvedAccounts) {
    try {
      const nonProgram = resolvedAccounts.filter(k => !KNOWN_PROGRAMS.has(k.toBase58()))
      // M12: fan-out cap. A tx with > MAX_LOOKUP_ACCOUNTS non-program accounts
      // is treated as RED outright — both because it suggests a complex
      // multi-step drainer and because we won't fan out that many lookups.
      if (nonProgram.length > MAX_LOOKUP_ACCOUNTS) {
        tooManyAccounts = true
      } else {
        const hits = await Promise.all(nonProgram.map(k => lookupAddress(k.toBase58())))
        // Only 'drainer', 'rug', 'phishing_domain' entries flip domain to RED.
        // 'malicious_token' entries are surfaced via checkTokenRisk's own corpusHit check.
        const first = hits.find(h => h !== null && h.type !== 'malicious_token')
        if (first) drainerHit = { address: first.address, confidence: first.confidence }
      }
    } catch (err) {
      safeError(err, 'lookup-fan-out-failed')
    }
  }

  const [domainResult, tokenResult] = await Promise.all([
    checkDomain(hostname),
    mintAddress ? checkTokenRisk(mintAddress) : Promise.resolve(null),
  ])

  // M12: explicit too-many-accounts response — RED with no further work needed.
  let finalDomain
  if (tooManyAccounts) {
    finalDomain = {
      level: 'RED',
      reason: 'Transaction touches too many accounts to safely analyze',
      confidence: 0.9,
      source: 'corpus',
    }
  } else if (drainerHit) {
    finalDomain = {
      level: 'RED',
      reason: `Transaction destination ${drainerHit.address.slice(0, 8)}... is a known threat (confidence ${Math.round(drainerHit.confidence * 100)}%)`,
      confidence: drainerHit.confidence,
      source: 'corpus',
    }
  } else {
    finalDomain = domainResult
  }

  const responseBody: Record<string, unknown> = { domain: finalDomain, token: tokenResult }
  if (altWarning) responseBody.altWarning = true

  return new Response(
    JSON.stringify(responseBody),
    {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
    }
  )
}

export default adaptForVercel(handler)
