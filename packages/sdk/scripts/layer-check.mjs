/**
 * Walour SDK — Backend Integration / Layer Check
 * Loads env from apps/worker/.env, then exercises checkDomain + checkTokenRisk
 * against a set of known-good and known-bad inputs.
 *
 * Run from packages/sdk:
 *   node scripts/layer-check.mjs
 */

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'

// ---------------------------------------------------------------------------
// 1. Load env from apps/worker/.env
// ---------------------------------------------------------------------------

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.resolve(__dirname, '../../../apps/worker/.env')

try {
  const raw = readFileSync(envPath, 'utf8')
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim()
    if (key && !(key in process.env)) {
      process.env[key] = val
    }
  }
  console.log('[setup] Loaded env from', envPath)
} catch (e) {
  console.error('[setup] Could not load .env:', e.message)
  process.exit(1)
}

// ---------------------------------------------------------------------------
// 2. Import from built dist
// ---------------------------------------------------------------------------

const sdkPath = path.resolve(__dirname, '../dist/index.js')
// On Windows, dynamic import() requires a file:// URL for absolute paths
const sdkUrl = new URL('file:///' + sdkPath.replace(/\\/g, '/'))
const { checkDomain, checkTokenRisk } = await import(sdkUrl)

// ---------------------------------------------------------------------------
// 3. Test runner
// ---------------------------------------------------------------------------

let passed = 0
let failed = 0
const rdapHits = []

async function runDomainTest(hostname, expectedLevel, description) {
  try {
    const result = await checkDomain(hostname)
    const levelOk = result.level === expectedLevel
    const status = levelOk ? 'PASS' : 'FAIL'
    if (levelOk) passed++; else failed++

    console.log(
      `[${status}] ${description}: level=${result.level} confidence=${result.confidence?.toFixed(2) ?? 'n/a'} reason="${result.reason}"`
    )

    // Track RDAP live hits
    if (result.source === 'walour-heuristic' && result.reason?.includes('day')) {
      rdapHits.push({ hostname, ageDays: result.reason })
    }
  } catch (e) {
    failed++
    console.log(`[FAIL] ${description}: THREW ${e.message}`)
  }
}

async function runTokenTest(mint, allowedLevels, description) {
  try {
    const result = await checkTokenRisk(mint)
    const levelOk = allowedLevels.includes(result.level)
    const status = levelOk ? 'PASS' : 'FAIL'
    if (levelOk) passed++; else failed++

    console.log(
      `[${status}] ${description}: level=${result.level} score=${result.score} reasons=[${result.reasons.slice(0, 3).join('; ')}]`
    )
  } catch (e) {
    failed++
    console.log(`[FAIL] ${description}: THREW ${e.message}`)
  }
}

// ---------------------------------------------------------------------------
// 4. Domain check tests
// ---------------------------------------------------------------------------

console.log('\n=== Domain Check Tests ===')

await runDomainTest(
  'phantom-airdrop.xyz',
  'RED',
  'phantom-airdrop.xyz [expect RED: keyword squat + risk TLD]'
)

await runDomainTest(
  'phantom-connect.vercel.app',
  'RED',
  'phantom-connect.vercel.app [expect RED: hosting platform squat]'
)

// phantom.app is canonical — no squat. Falls through to RDAP/GoPlus → AMBER
await runDomainTest(
  'phantom.app',
  'AMBER',
  'phantom.app [expect AMBER: canonical, clean]'
)

await runDomainTest(
  'raydium.io',
  'AMBER',
  'raydium.io [expect AMBER: canonical, clean]'
)

// newscamsite.xyz — live RDAP age check + risk TLD. Accept either RED or AMBER.
try {
  const result = await checkDomain('newscamsite.xyz')
  const levelOk = result.level === 'RED' || result.level === 'AMBER'
  if (levelOk) {
    passed++
    console.log(
      `[PASS] newscamsite.xyz [expect RED or AMBER, live RDAP]: level=${result.level} confidence=${result.confidence?.toFixed(2) ?? 'n/a'} reason="${result.reason}"`
    )
    if (result.reason?.includes('day')) {
      rdapHits.push({ hostname: 'newscamsite.xyz', detail: result.reason })
    }
  } else {
    failed++
    console.log(`[FAIL] newscamsite.xyz: unexpected level=${result.level}`)
  }
} catch (e) {
  failed++
  console.log(`[FAIL] newscamsite.xyz: THREW ${e.message}`)
}

await runDomainTest(
  'google.com',
  'AMBER',
  'google.com [expect AMBER: clean domain, no signals]'
)

// ---------------------------------------------------------------------------
// 5. Token risk test
// ---------------------------------------------------------------------------

console.log('\n=== Token Risk Tests ===')

await runTokenTest(
  'So11111111111111111111111111111111111111112',
  ['GREEN', 'AMBER'],
  'wSOL So111... [expect GREEN or AMBER, must not crash]'
)

// ---------------------------------------------------------------------------
// 6. Summary
// ---------------------------------------------------------------------------

console.log('\n=== Summary ===')
console.log(`Tests: ${passed + failed} total — ${passed} passed, ${failed} failed`)

if (rdapHits.length > 0) {
  console.log('\n[RDAP live hits — API is reachable:]')
  for (const h of rdapHits) {
    console.log(`  ${h.hostname}: ${h.detail ?? h.ageDays}`)
  }
} else {
  console.log('\n[RDAP] No live age results returned (domains may be cached AMBER or RDAP timed out)')
}

if (failed > 0) process.exit(1)
