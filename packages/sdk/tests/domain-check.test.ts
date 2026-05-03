/**
 * domain-check.test.ts
 *
 * Tests for Phase 2 RDAP domain-age detection integrated into checkDomain().
 * All network calls are mocked — no real HTTP requests are made.
 *
 * Architecture note: checkDomain() returns early from Phase 1 for any squat hit,
 * so RDAP signals combine only with riskTld in the fallback, not with squat.
 */

// Mock cache so tests don't need Redis
jest.mock('../src/lib/cache', () => ({
  cacheGet: jest.fn().mockResolvedValue(null),
  cacheSet: jest.fn().mockResolvedValue(undefined),
}))

// Mock @solana/web3.js to avoid real connection attempts in lookupAddress
jest.mock('@solana/web3.js', () => {
  const actual = jest.requireActual('@solana/web3.js')
  return {
    ...actual,
    Connection: jest.fn().mockImplementation(() => ({
      getAccountInfo: jest.fn().mockResolvedValue(null),
    })),
  }
})

import { checkDomain } from '../src/domain-check'

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Build a fake RDAP response with a registration event. */
function rdapResponse(registrationDate: string) {
  return {
    ok: true,
    json: async () => ({
      events: [{ eventAction: 'registration', eventDate: registrationDate }],
    }),
  }
}

/** GoPlus non-phishing response. */
const goplusClean = {
  ok: true,
  json: async () => ({ result: { is_phishing_site: '0' } }),
}

/** GoPlus phishing response. */
const goplusPhishing = {
  ok: true,
  json: async () => ({ result: { is_phishing_site: '1' } }),
}

/** RDAP 404 (domain not found). */
const rdap404 = { ok: false }

/** Date string for a domain registered N days ago. */
function daysAgoISO(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString()
}

/** Mock fetch routing requests by URL prefix. */
function mockFetchByUrl(routes: { rdap: object; goplus: object; supabase?: object }) {
  ;(global.fetch as jest.Mock).mockImplementation((url: string) => {
    if (typeof url === 'string' && url.includes('rdap.org')) {
      return Promise.resolve(routes.rdap)
    }
    if (typeof url === 'string' && url.includes('gopluslabs')) {
      return Promise.resolve(routes.goplus)
    }
    // Supabase queryCorpus — return empty array (no corpus hit)
    return Promise.resolve({
      ok: true,
      json: async () => routes.supabase ?? [],
    })
  })
}

// ─── setup ────────────────────────────────────────────────────────────────────

const mockFetch = jest.fn()
global.fetch = mockFetch as unknown as typeof fetch

beforeEach(() => {
  mockFetch.mockReset()
  // Default: no supabase env, so queryCorpus fetch will be called but return empty
  process.env.SUPABASE_URL = 'https://fake.supabase.co'
  process.env.SUPABASE_SERVICE_KEY = 'fake-key'
})

afterEach(() => {
  delete process.env.SUPABASE_URL
  delete process.env.SUPABASE_SERVICE_KEY
})

// ─── RDAP age detection ───────────────────────────────────────────────────────

describe('RDAP age detection', () => {
  it('AMBER: new domain alone (< 14 days, no other signals)', async () => {
    mockFetchByUrl({
      rdap: rdapResponse(daysAgoISO(7)),
      goplus: goplusClean,
    })

    const result = await checkDomain('q8r2x1.co')
    expect(result.level).toBe('AMBER')
    expect(result.confidence).toBe(0.55)
    expect(result.reason).toContain('7 days ago')
    expect(result.source).toBe('walour-heuristic')
  })

  it('RED 0.75: new domain + high-risk TLD', async () => {
    mockFetchByUrl({
      rdap: rdapResponse(daysAgoISO(3)),
      goplus: goplusClean,
    })

    // .xyz is in HIGH_RISK_TLDS; no keyword squat
    const result = await checkDomain('newscam.xyz')
    expect(result.level).toBe('RED')
    expect(result.confidence).toBe(0.75)
    expect(result.reason).toContain('3 days ago')
    expect(result.reason).toContain('.xyz')
  })

  it('no change: RDAP failure is non-fatal (fetch throws)', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('rdap.org')) return Promise.reject(new Error('timeout'))
      if (url.includes('gopluslabs')) return Promise.resolve(goplusClean)
      return Promise.resolve({ ok: true, json: async () => [] })
    })

    // .xyz alone → AMBER 0.35 even when RDAP fails
    const result = await checkDomain('oldscam.xyz')
    expect(result.level).toBe('AMBER')
    expect(result.confidence).toBe(0.35)
    expect(result.reason).toContain('.xyz')
    expect(result.reason).not.toContain('days ago')
  })

  it('no change: RDAP failure is non-fatal (404)', async () => {
    mockFetchByUrl({
      rdap: rdap404,
      goplus: goplusClean,
    })

    const result = await checkDomain('unknowndomain.co')
    expect(result.level).toBe('AMBER')
    expect(result.reason).not.toContain('days ago')
  })

  it('no change: domain >= 14 days has no RDAP text in reason', async () => {
    mockFetchByUrl({
      rdap: rdapResponse(daysAgoISO(30)),
      goplus: goplusClean,
    })

    const result = await checkDomain('legit-old-domain.co')
    expect(result.reason).not.toContain('days ago')
    // Falls through to plain AMBER (no riskTld, no GoPlus hit)
    expect(result.level).toBe('AMBER')
    expect(result.confidence).toBe(0)
  })

  it('GoPlus RED takes priority over RDAP age', async () => {
    mockFetchByUrl({
      rdap: rdapResponse(daysAgoISO(2)),
      goplus: goplusPhishing,
    })

    const result = await checkDomain('phishing-new.co')
    expect(result.level).toBe('RED')
    expect(result.confidence).toBe(0.85)
    expect(result.source).toBe('goplus')
    // GoPlus reason — not RDAP
    expect(result.reason).toContain('GoPlus')
  })

  it('singular: 1 day old domain uses "day" not "days"', async () => {
    mockFetchByUrl({
      rdap: rdapResponse(daysAgoISO(1)),
      goplus: goplusClean,
    })

    const result = await checkDomain('brand-new.co')
    expect(result.level).toBe('AMBER')
    expect(result.reason).toContain('1 day ago')
    expect(result.reason).not.toContain('1 days')
  })
})

// ─── extractRootDomain (via checkDomain fetch call args) ──────────────────────

describe('extractRootDomain (via fetch call)', () => {
  it('strips subdomain: sub.example.xyz queries rdap.org/domain/example.xyz', async () => {
    mockFetchByUrl({
      rdap: rdapResponse(daysAgoISO(30)),
      goplus: goplusClean,
    })

    await checkDomain('sub.example.xyz')

    // Find the RDAP fetch call and verify the URL uses root domain only
    const rdapCall = mockFetch.mock.calls.find(
      (call: unknown[]) =>
        typeof call[0] === 'string' && (call[0] as string).includes('rdap.org')
    )
    expect(rdapCall).toBeDefined()
    expect(rdapCall![0]).toContain('/domain/example.xyz')
    expect(rdapCall![0]).not.toContain('sub.example.xyz')
  })

  it('single-label root: example.com queries rdap.org/domain/example.com', async () => {
    mockFetchByUrl({
      rdap: rdapResponse(daysAgoISO(30)),
      goplus: goplusClean,
    })

    await checkDomain('example.com')

    const rdapCall = mockFetch.mock.calls.find(
      (call: unknown[]) =>
        typeof call[0] === 'string' && (call[0] as string).includes('rdap.org')
    )
    expect(rdapCall).toBeDefined()
    expect(rdapCall![0]).toContain('/domain/example.com')
  })
})
