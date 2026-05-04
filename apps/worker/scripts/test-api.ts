/**
 * Backend smoke test — run with:
 *   npx tsx scripts/test-api.ts
 *
 * Requires worker running on http://localhost:3001
 */

const BASE = process.env.WORKER_URL ?? 'http://localhost:3001'

type Level = 'GREEN' | 'AMBER' | 'RED'

interface TestCase {
  label: string
  url: string
  expectLevel: Level
  expectReason?: RegExp
}

const DOMAIN_TESTS: TestCase[] = [
  // Canonical domains — always GREEN
  { label: 'raydium.io canonical',    url: `/api/scan?hostname=raydium.io`,              expectLevel: 'GREEN' },
  { label: 'jup.ag canonical',        url: `/api/scan?hostname=jup.ag`,                  expectLevel: 'GREEN' },
  { label: 'phantom.app canonical',   url: `/api/scan?hostname=phantom.app`,             expectLevel: 'GREEN' },
  { label: 'orca.so canonical',       url: `/api/scan?hostname=orca.so`,                 expectLevel: 'GREEN' },

  // Keyword squats — RED
  { label: 'phantom keyword squat',   url: `/api/scan?hostname=phantom-airdrop.xyz`,     expectLevel: 'RED', expectReason: /phantom/ },
  { label: 'jupiter keyword squat',   url: `/api/scan?hostname=jupiter-exchange.click`,  expectLevel: 'RED', expectReason: /jupiter/ },

  // Hosting platform squats — RED
  { label: 'phantom on Vercel',       url: `/api/scan?hostname=phantom-wallet.vercel.app`, expectLevel: 'RED' },
  { label: 'backpack on Netlify',     url: `/api/scan?hostname=backpack.netlify.app`,    expectLevel: 'RED' },

  // High-risk TLD alone — AMBER
  { label: 'unknown .xyz TLD',        url: `/api/scan?hostname=solana-tools.xyz`,        expectLevel: 'AMBER' },

  // Unknown domain — AMBER
  { label: 'unknown domain',          url: `/api/scan?hostname=superteambr-academy.vercel.app`, expectLevel: 'AMBER' },
]

let passed = 0
let failed = 0

async function runTest(tc: TestCase): Promise<void> {
  try {
    const res = await fetch(BASE + tc.url)
    if (!res.ok) {
      console.error(`  FAIL [${tc.label}] HTTP ${res.status}`)
      failed++
      return
    }
    const data = await res.json() as { domain?: { level?: string; reason?: string } }
    const level = data?.domain?.level?.toUpperCase()
    const reason = data?.domain?.reason ?? ''

    const levelOk = level === tc.expectLevel
    const reasonOk = !tc.expectReason || tc.expectReason.test(reason)

    if (levelOk && reasonOk) {
      console.log(`  PASS [${tc.label}] → ${level}`)
      passed++
    } else {
      console.error(`  FAIL [${tc.label}]`)
      if (!levelOk) console.error(`       expected level ${tc.expectLevel}, got ${level}`)
      if (!reasonOk) console.error(`       reason "${reason}" did not match ${tc.expectReason}`)
      failed++
    }
  } catch (err) {
    console.error(`  FAIL [${tc.label}] fetch error:`, err instanceof Error ? err.message : err)
    failed++
  }
}

async function main(): Promise<void> {
  console.log(`\nWalour backend smoke test → ${BASE}\n`)

  // Health check
  try {
    await fetch(`${BASE}/api/scan?hostname=raydium.io`)
  } catch {
    console.error('Worker unreachable. Start it with: npm run dev (in apps/worker)\n')
    process.exit(1)
  }

  console.log('Domain scan tests:')
  for (const tc of DOMAIN_TESTS) {
    await runTest(tc)
  }

  console.log(`\n${passed} passed, ${failed} failed out of ${DOMAIN_TESTS.length} tests\n`)
  if (failed > 0) process.exit(1)
}

main()
