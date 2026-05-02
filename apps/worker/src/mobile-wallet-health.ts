import { Connection, PublicKey } from '@solana/web3.js'
import { checkTokenRisk, lookupAddress } from '@walour/sdk'

export const config = { runtime: 'edge' }

const TOKEN_PROGRAM = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function getConnection(): Connection {
  return new Connection(
    `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`,
    'confirmed'
  )
}

function levelRank(level: string | undefined): number {
  if (level === 'RED') return 3
  if (level === 'AMBER') return 2
  if (level === 'GREEN') return 1
  return 0
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders })
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders })
  }

  let walletAddress = ''
  try {
    const body = await req.json() as { walletAddress?: unknown }
    walletAddress = typeof body.walletAddress === 'string' ? body.walletAddress.trim() : ''
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400, headers: corsHeaders })
  }

  if (!walletAddress) {
    return Response.json({ error: 'walletAddress is required' }, { status: 400, headers: corsHeaders })
  }

  try {
    const owner = new PublicKey(walletAddress)
    const directThreat = await lookupAddress(walletAddress)
    const riskyTokens = []
    const warnings: string[] = []

    try {
      const accounts = await getConnection().getParsedTokenAccountsByOwner(owner, { programId: TOKEN_PROGRAM })
      const mints = [...new Set(accounts.value
        .map(account => (account.account.data as any)?.parsed?.info?.mint)
        .filter((mint): mint is string => typeof mint === 'string'))]
        .slice(0, 8)

      const tokenChecks = await Promise.allSettled(mints.map(async mint => ({
        mint,
        result: await checkTokenRisk(mint),
      })))

      for (const check of tokenChecks) {
        if (check.status !== 'fulfilled') continue
        const { mint, result } = check.value
        if (result.level === 'RED' || result.level === 'AMBER') {
          riskyTokens.push({
            verdict: result.level,
            confidence: (result.score ?? 0) / 100,
            target: mint,
            targetType: 'token',
            reasons: result.reasons?.length ? result.reasons : ['Token risk checks found warning signals.'],
            token: result,
            domain: null,
            threat: null,
          })
        }
      }
    } catch (err) {
      warnings.push('Token account scan unavailable. Address corpus lookup still completed.')
    }

    const knownThreatInteractions = directThreat ? [{
      verdict: 'RED',
      confidence: directThreat.confidence,
      target: walletAddress,
      targetType: 'address',
      reasons: [`Wallet appears in the Walour corpus as ${directThreat.type}.`],
      source: directThreat.source,
      domain: null,
      token: null,
      threat: directThreat,
    }] : []

    const verdict = [directThreat ? 'RED' : 'GREEN', ...riskyTokens.map(t => t.verdict)]
      .sort((a, b) => levelRank(b) - levelRank(a))[0] ?? 'UNKNOWN'

    return Response.json({
      walletAddress,
      verdict,
      riskCount: riskyTokens.length + knownThreatInteractions.length,
      riskyTokens,
      knownThreatInteractions,
      recentWarnings: warnings.length ? warnings : ['Wallet health scan completed.'],
    }, { headers: corsHeaders })
  } catch {
    return Response.json({ error: 'Invalid wallet address' }, { status: 400, headers: corsHeaders })
  }
}

