---
phase: 06-detection-hardening
plan: "04"
subsystem: worker-simulate / extension-overlay
tags: [token-symbols, jupiter, redis-cache, overlay-ux, DH-05]
dependency_graph:
  requires: ["06-01"]
  provides: ["human-readable token symbols in sim row"]
  affects: ["apps/worker/src/simulate.ts", "apps/extension/src/overlay.ts"]
tech_stack:
  added: ["Jupiter V1 token API (api.jup.ag/tokens/v1/token)"]
  patterns: ["cache-first (Redis token:meta:{mint})", "Promise.all parallel enrichment", "graceful degradation on missing API key"]
key_files:
  created: ["apps/worker/.env.example"]
  modified: ["apps/worker/src/simulate.ts", "apps/worker/tsconfig.json", "apps/extension/src/overlay.ts"]
decisions:
  - "Path alias @walour/sdk/lib/cache added to worker tsconfig rather than re-exporting cache from SDK index (minimal blast radius)"
  - "AbortSignal.timeout(3000) used for Jupiter fetch — no external timeout library needed"
  - "TTL 3600s matches RESEARCH.md spec — Jupiter token metadata changes rarely"
metrics:
  duration: "~10 min"
  completed: "2026-05-03T13:57:48Z"
  tasks_completed: 2
  files_changed: 4
---

# Phase 06 Plan 04: Jupiter Token Symbol Enrichment (DH-05) Summary

**One-liner:** Cache-first Jupiter V1 symbol lookup enriches SimDelta.symbol in worker, overlay falls back to truncated mint when absent.

## What Was Built

DH-05: Replace truncated mint addresses (`EPjF...`) in the extension overlay's simulation row with human-readable token symbols (`USDC`).

### getTokenSymbol helper (apps/worker/src/simulate.ts)

```typescript
async function getTokenSymbol(mint: string): Promise<string | undefined>
```

- **Endpoint:** `https://api.jup.ag/tokens/v1/token/${mint}` (Jupiter V1 — NOT deprecated paths)
- **Cache key:** `token:meta:${mint}` with **TTL 3600s** (Upstash Redis via `@walour/sdk/lib/cache`)
- **Flow:** `cacheGet` → cache hit returns symbol immediately; cache miss → fetch Jupiter with `x-api-key` header + `AbortSignal.timeout(3000)` → on success `cacheSet` TTL 3600 + return symbol; on any failure return `undefined`
- **JUPITER_API_KEY missing** → returns `undefined` immediately; simulation proceeds normally
- **Jupiter failure** → caught, returns `undefined`; simulation never blocked (CLAUDE.md circuit-breaker rule)

### SimDelta enrichment (apps/worker/src/simulate.ts)

After deltas array is built, before response is returned:

```typescript
// DH-05: enrich each delta with token symbol (cache-first, never blocks on Jupiter failure)
await Promise.all(
  deltas.map(async (d) => {
    const sym = await getTokenSymbol(d.mint)
    if (sym) d.symbol = sym
  })
)
```

Duplicate mints across deltas are cheap — second call hits Redis cache.

### Overlay rendering (apps/extension/src/overlay.ts)

Changed site: `updateSimulation()` around line 669

```typescript
// Before
parts.push(d.uiChange + ' ' + d.mint.slice(0, 4) + '...')

// After
parts.push(d.uiChange + ' ' + (d.symbol ?? (d.mint.slice(0, 4) + '...')))
```

Also added `symbol?: string` to the local `SimDelta` interface.

### .env.example diff (apps/worker/.env.example)

```
# DH-05: Jupiter token metadata enrichment for sim row
# Free tier available at https://portal.jup.ag — V1 token endpoint requires this header.
# Optional: if absent, sim still works but shows truncated mint addresses instead of symbols.
JUPITER_API_KEY=
```

### Worker tsconfig change (apps/worker/tsconfig.json)

Added path alias to expose `cache.ts` from the SDK to the worker without re-exporting from the SDK public index:

```json
"@walour/sdk/lib/cache": ["../../packages/sdk/src/lib/cache.ts"]
```

## Verification Results

| Check | Result |
|-------|--------|
| `grep api.jup.ag/tokens/v1/token simulate.ts` | match line 24 |
| `grep token:meta: simulate.ts` | match line 15 |
| `grep JUPITER_API_KEY .env.example` | match line 16 |
| `grep d.symbol overlay.ts` | match line 669 |
| No deprecated endpoints (token.jup.ag/all, lite-api.jup.ag) | confirmed clean |
| `npx tsc --noEmit` (worker) — new errors from our changes | none |
| `npx tsc --noEmit` (extension) — new errors from our changes | none |

Pre-existing TS errors in `apps/worker/src/ingest.ts` (Supabase type schema drift) and `apps/worker/src/simulate.ts` (SimulatedTransactionResponse property types) are out of scope — they existed before this plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Path alias required for cache module access**
- **Found during:** Task 1
- **Issue:** `@walour/sdk/lib/cache` was not in the worker tsconfig paths; direct relative path `../../packages/sdk/src/lib/cache` was not resolvable under `moduleResolution: bundler`
- **Fix:** Added `"@walour/sdk/lib/cache": ["../../packages/sdk/src/lib/cache.ts"]` to `apps/worker/tsconfig.json`
- **Files modified:** `apps/worker/tsconfig.json`
- **Commit:** c2f6e34

## Self-Check: PASSED

- [x] `apps/worker/src/simulate.ts` - exists and contains getTokenSymbol + Promise.all enrichment
- [x] `apps/extension/src/overlay.ts` - exists and contains d.symbol fallback
- [x] `apps/worker/.env.example` - exists and contains JUPITER_API_KEY
- [x] `apps/worker/tsconfig.json` - exists and contains @walour/sdk/lib/cache alias
- [x] Commit c2f6e34 (Task 1) - verified
- [x] Commit 0b9f8c7 (Task 2) - verified
