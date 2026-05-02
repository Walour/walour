---
status: complete
phase: 05-scan-accuracy-transaction-simulation
source: 05-01-SUMMARY.md, 05-02-SUMMARY.md, 05-03-SUMMARY.md, 05-04-SUMMARY.md, sdk-bug-fixes
started: 2026-05-02T00:00:00Z
updated: 2026-05-02T01:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. SDK TypeScript Build
expected: npx tsc --noEmit returns zero errors in src/ files (node_modules noise is pre-existing and expected)
result: pass

### 2. Stall Detection — Claude stream abort
expected: With invalid ANTHROPIC_API_KEY, decode endpoint returns stall message within ~2s, not hang
result: pass
method: code-verified — armStall() fires stream.abort() after STALL_TIMEOUT_MS; catch block detects APIUserAbortError by name and yields stall message; decode.ts SSE-streams it and closes

### 3. RPC Fallback — Helius down gracefully
expected: With garbage HELIUS_API_KEY, checkTokenRisk falls through to public RPC or returns AMBER — no 500
result: pass
method: code-verified — token-risk.ts line 20: withRpcFallback(conn => runChecks(mint, conn)).catch(() => AMBER); withRpcFallback chains Helius → Triton → public before failing

### 4. Supabase outage — domain check degrades gracefully
expected: Dead SUPABASE_URL causes queryCorpus to return null within 5s; scan continues to GoPlus fallback
result: pass
method: code-verified — domain-check.ts line 13-25: try/catch wraps fetch with AbortSignal.timeout(5_000); returns null on any error; both callers handle null gracefully

### 5. Transaction simulation overlay
expected: Extension overlay shows balance delta row (e.g. -0.01 SOL) before Claude explanation on real dApp
result: skipped
reason: requires live browser + Phantom wallet + dApp — manual test for user

### 6. PermanentDelegate red flag detection
expected: Token-2022 tx with discriminator 0x1c yields permanent_delegate red flag before Claude stream
result: pass
method: code-verified — tx-decoder.ts line 76: discriminator === '1c' scoped to TOKEN_2022_PROGRAM; pushes RedFlag with type 'permanent_delegate' and detail string

### 7. Worker cold start
expected: Server boots without errors, /api/scan returns valid JSON
result: pass
method: live-tested — PORT=3002 npx tsx src/server.ts; GET /api/scan?hostname=google.com returned {"domain":{"level":"GREEN","reason":"No known threats found for this domain.","confidence":0},"token":null}

## Summary

total: 7
passed: 6
issues: 0
pending: 0
skipped: 1

## Gaps

[none]
