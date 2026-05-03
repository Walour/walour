---
status: complete
phase: 06-detection-hardening
source: [06-01-SUMMARY.md, 06-02-SUMMARY.md, 06-03-SUMMARY.md, 06-04-SUMMARY.md]
started: 2026-05-03T14:00:00Z
updated: 2026-05-03T14:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. SDK builds without errors
expected: Run `npx tsc --noEmit` in packages/sdk. 0 errors in SDK source files. Pre-existing vendor type errors in @types/mocha / @upstash/redis do not count.
result: pass

### 2. assign_account detection in tx-decoder
expected: SYSTEM_PROGRAM constant defined. Block checking `ix.dataHex.slice(0,8) === '01000000'` emits `assign_account` RedFlag referencing `ix.accounts[0]`.
result: pass

### 3. durable_nonce detection is AMBER (informational)
expected: `04000000` discriminator emits `durable_nonce` flag. Detail text is informational — no "attack"/"drainer" language. Per plan intent, AMBER is expressed via neutral detail string, not a severity field.
result: pass

### 4. multi_drain detection with DEX suppression
expected: Post-loop aggregate block counts Transfer(03) + CloseAccount(09) across token programs. Fires only when count > 2 AND distinct accounts > 2 AND no DEX program (Jupiter/Orca/Raydium) present.
result: pass

### 5. Token-2022 ConfidentialTransfer flags as risk
expected: `parsed?.info?.extensions` iterated (correct path). `confidentialTransferMint` presence triggers weight-20 failed check — no `.state` dependency.
result: pass

### 6. Token-2022 TransferFee >5% flags as risk
expected: `transferFeeConfig` extension found, `newerTransferFee.transferFeeBasisPoints > 500` triggers weight-20 failed check.
result: pass

### 7. Homoglyph domain detection returns RED
expected: `hasHomoglyphRisk` helper with `hostname.includes('xn--')` AND `charCodeAt(i) > 127` loop. Fires after cache read, before corpus/GoPlus. Cached with DOMAIN_TTL.
result: pass

### 8. Jupiter token symbols in worker simulate endpoint
expected: `getTokenSymbol(mint)` calls `api.jup.ag/tokens/v1/token/${mint}` (not deprecated paths). Cache key `token:meta:${mint}` TTL 3600. Returns undefined gracefully when JUPITER_API_KEY missing — simulation never blocked.
result: pass

### 9. Overlay renders symbol not truncated mint
expected: `updateSimulation` uses `d.symbol ?? (d.mint.slice(0, 4) + '...')` at line 669 — shows "USDC" when symbol present, truncated mint as fallback.
result: pass

### 10. JUPITER_API_KEY documented in worker env
expected: `apps/worker/.env.example` contains `JUPITER_API_KEY=` with comment explaining it's optional.
result: pass

## Summary

total: 10
passed: 10
issues: 0
pending: 0
skipped: 0

## Gaps

[none]
