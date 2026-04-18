// GET /api/blink?address={pubkey}
// Dialect Actions (Blinks) endpoint — returns a structured action card describing
// the threat level of a Solana address.

import { lookupAddress, checkTokenRisk } from '@walour/sdk'

const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const url = new URL(req.url)
  const address = url.searchParams.get('address') ?? ''

  // --- Validate address ---
  if (!BASE58_RE.test(address)) {
    return blinkResponse({
      title: 'Walour Threat Check',
      icon: 'https://walour.xyz/logo.png',
      description: 'Invalid Solana address. Please provide a valid base58 public key.',
      label: 'Scan Another',
      links: { actions: [] },
    })
  }

  // --- Parallel lookups ---
  const [corpusHit, tokenResult] = await Promise.allSettled([
    lookupAddress(address),
    checkTokenRisk(address),
  ])

  const hit = corpusHit.status === 'fulfilled' ? corpusHit.value : null
  const token = tokenResult.status === 'fulfilled' ? tokenResult.value : null

  // --- Build description ---
  let description: string

  if (hit) {
    description = `\u26a0\ufe0f RED: Known ${hit.type}. Confidence ${(hit.confidence * 100).toFixed(0)}%. Do not interact.`
  } else if (token?.level === 'RED') {
    const reason = token.reasons[0] ?? 'High risk detected.'
    description = `\u26a0\ufe0f RED: High-risk token. ${reason}. Do not sign.`
  } else if (token?.level === 'AMBER') {
    const reason = token.reasons[0] ?? 'Risk factors present.'
    description = `\u26a1 AMBER: Token has risk factors. ${reason}. Proceed with caution.`
  } else {
    description = `\u2705 GREEN: No threats detected for this address.`
  }

  return blinkResponse({
    title: 'Walour Threat Check',
    icon: 'https://walour.xyz/logo.png',
    description,
    label: 'Scan Another',
    links: {
      actions: [
        {
          label: 'View Full Report',
          href: `https://walour.xyz/stats?address=${address}`,
          type: 'external-link',
        },
      ],
    },
  })
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

interface BlinkPayload {
  title: string
  icon: string
  description: string
  label: string
  links: {
    actions: Array<{
      label: string
      href: string
      type?: string
    }>
  }
}

function blinkResponse(payload: BlinkPayload): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'X-Action-Version': '1',
      'Access-Control-Expose-Headers': 'X-Action-Version',
    },
  })
}
