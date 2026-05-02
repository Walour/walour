import { VersionedTransaction } from '@solana/web3.js'
import { checkDomain, checkTokenRisk, decodeTransaction, lookupAddress } from '@walour/sdk'

export const config = { runtime: 'edge' }

type ScanKind = 'url' | 'address' | 'token' | 'transaction'
type Verdict = 'GREEN' | 'AMBER' | 'RED' | 'UNKNOWN'

interface MobileScanRequest {
  kind?: unknown
  value?: unknown
  hostname?: unknown
  txBase64?: unknown
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function isKind(value: unknown): value is ScanKind {
  return value === 'url' || value === 'address' || value === 'token' || value === 'transaction'
}

function levelRank(level: Verdict | undefined): number {
  if (level === 'RED') return 3
  if (level === 'AMBER') return 2
  if (level === 'GREEN') return 1
  return 0
}

function worst(...levels: Array<Verdict | undefined>): Verdict {
  return levels.reduce<Verdict>((current, next) => (
    levelRank(next) > levelRank(current) ? (next ?? current) : current
  ), 'UNKNOWN')
}

function hostnameFrom(value: string): string {
  try {
    const parsed = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`)
    return parsed.hostname
  } catch {
    return value.replace(/^https?:\/\//i, '').split('/')[0]
  }
}

function responseJson(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: corsHeaders })
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders })
  if (req.method !== 'POST') return responseJson({ error: 'Method not allowed' }, 405)

  let body: MobileScanRequest
  try {
    body = await req.json() as MobileScanRequest
  } catch {
    return responseJson({ error: 'Invalid JSON body' }, 400)
  }

  if (!isKind(body.kind)) return responseJson({ error: 'kind must be url, address, token, or transaction' }, 400)
  const value = readString(body.value)
  const txBase64 = readString(body.txBase64) || (body.kind === 'transaction' ? value : '')
  if (!value && !txBase64) return responseJson({ error: 'value is required' }, 400)

  try {
    if (body.kind === 'url') {
      const hostname = hostnameFrom(value)
      const domain = await checkDomain(hostname)
      return responseJson({
        verdict: domain.level ?? 'UNKNOWN',
        confidence: domain.confidence ?? 0,
        target: hostname,
        targetType: 'url',
        reasons: [domain.reason ?? 'No known threats found for this URL.'],
        source: domain.source,
        domain,
        token: null,
        threat: null,
      })
    }

    if (body.kind === 'address') {
      const threat = await lookupAddress(value)
      return responseJson({
        verdict: threat ? 'RED' : 'GREEN',
        confidence: threat?.confidence ?? 0,
        target: value,
        targetType: 'address',
        reasons: threat
          ? [`Known ${threat.type} in the Walour corpus.`]
          : ['No known threat report found for this address.'],
        source: threat?.source,
        domain: null,
        token: null,
        threat,
      })
    }

    if (body.kind === 'token') {
      const [token, threat] = await Promise.all([
        checkTokenRisk(value),
        lookupAddress(value),
      ])
      const verdict = worst(token.level, threat ? 'RED' : undefined)
      return responseJson({
        verdict,
        confidence: Math.max((token.score ?? 0) / 100, threat?.confidence ?? 0),
        target: value,
        targetType: 'token',
        reasons: [
          ...(token.reasons?.length ? token.reasons : ['Token risk checks completed.']),
          ...(threat ? [`Token appears in the Walour corpus as ${threat.type}.`] : []),
        ],
        source: threat?.source,
        domain: null,
        token,
        threat,
      })
    }

    const txBytes = Buffer.from(txBase64, 'base64')
    const tx = VersionedTransaction.deserialize(txBytes)
    const chunks: string[] = []
    for await (const chunk of decodeTransaction(tx)) chunks.push(chunk)
    const summary = chunks.join('').trim()
    const hostname = readString(body.hostname)
    const domain = hostname ? await checkDomain(hostname) : null
    const verdict = worst(domain?.level, summary.toLowerCase().includes('known threat') ? 'RED' : undefined)

    return responseJson({
      verdict,
      confidence: domain?.confidence ?? (verdict === 'RED' ? 0.85 : 0.5),
      target: hostname || 'Transaction payload',
      targetType: 'transaction',
      reasons: [summary || 'Transaction decoded. Review the summary before signing.'],
      source: domain?.source,
      domain,
      token: null,
      threat: null,
      txSummary: summary,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return responseJson({ error: message }, 500)
  }
}

