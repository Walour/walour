import { VersionedTransaction, PublicKey } from '@solana/web3.js'
import { checkDomain, checkTokenRisk } from '@walour/sdk'

export const config = { runtime: 'edge' }

// Known program IDs to exclude from mint detection
const KNOWN_PROGRAMS = new Set([
  '11111111111111111111111111111111',
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe8bSe',
  'ComputeBudget111111111111111111111111111111',
  'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
])

function extractAccounts(tx: VersionedTransaction): PublicKey[] {
  const staticKeys = tx.message.staticAccountKeys
  const compiledInstructions = tx.message.compiledInstructions

  const indexSet = new Set<number>()
  for (const ix of compiledInstructions) {
    for (const idx of ix.accountKeyIndexes) {
      indexSet.add(idx)
    }
  }

  const accounts: PublicKey[] = [...staticKeys]
  const referencedAccounts: PublicKey[] = []
  for (const idx of indexSet) {
    if (idx < staticKeys.length) {
      referencedAccounts.push(staticKeys[idx])
    }
  }

  // Deduplicate
  const seen = new Set<string>()
  const unique: PublicKey[] = []
  for (const key of [...accounts, ...referencedAccounts]) {
    const str = key.toBase58()
    if (!seen.has(str)) {
      seen.add(str)
      unique.push(key)
    }
  }
  return unique
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

export default async function handler(req: Request): Promise<Response> {
  const ALLOWED_ORIGIN =
    process.env.NODE_ENV === 'development' ? '*' : 'chrome-extension://*'

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

  const url = new URL(req.url)
  const hostname = url.searchParams.get('hostname')
  const txParam = url.searchParams.get('tx')

  if (!hostname || hostname.trim() === '') {
    return new Response(JSON.stringify({ error: 'hostname is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let mintAddress: string | null = null

  if (txParam) {
    try {
      const txBytes = Buffer.from(txParam, 'base64')
      const tx = VersionedTransaction.deserialize(txBytes)
      const accounts = extractAccounts(tx)
      mintAddress = findLikelyMint(accounts)
    } catch {
      // Malformed tx — continue without mint detection
      mintAddress = null
    }
  }

  const [domainResult, tokenResult] = await Promise.all([
    checkDomain(hostname),
    mintAddress ? checkTokenRisk(mintAddress) : Promise.resolve(null),
  ])

  return new Response(
    JSON.stringify({ domain: domainResult, token: tokenResult }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  )
}
