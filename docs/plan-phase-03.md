# Plan — Phase 3: On-Chain Oracle + Colosseum Submit
**Dates:** May 3 – May 11
**Deliverable:** `walour_oracle` Anchor program on Solana mainnet + Colosseum Frontier submission.

---

## Goals
1. `walour_oracle` Anchor program deployed to Solana mainnet.
2. Ingestion worker promoting high-confidence corpus entries to on-chain PDAs.
3. Dialect Blinks wired up — any Solana address scannable from X/Discord.
4. Corpus at ≥ 3,500 addresses.
5. Colosseum Frontier submission filed by May 11.

---

## P3-01: Anchor program — scaffold (May 3)
- `programs/walour_oracle/` — Anchor workspace
- Declare program ID, deploy to devnet first
- Define accounts:

```rust
#[account]
pub struct ThreatReport {
    pub address: Pubkey,
    pub threat_type: ThreatType,
    pub source: [u8; 32],       // source tag, fixed-width
    pub evidence_url: [u8; 128],
    pub confidence: u8,          // 0-100 (scale of 0-1)
    pub first_seen: i64,
    pub last_updated: i64,
    pub corroborations: u32,
    pub bump: u8,
}

#[account]
pub struct Reporter {
    pub pubkey: Pubkey,
    pub reports_submitted: u32,
    pub confidence_avg: u8,
    pub last_active: i64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub enum ThreatType {
    Drainer,
    Rug,
    PhishingDomain,
    MaliciousToken,
}
```

---

## P3-02: Anchor program — instructions (May 3–4)

**`submit_report`** (permissionless, reporter-signed)
```rust
pub fn submit_report(
    ctx: Context<SubmitReport>,
    address: Pubkey,
    threat_type: ThreatType,
    evidence_url: [u8; 128],
) -> Result<()>
```
- Init `ThreatReport` PDA seeded `["threat", address]`
- Init `Reporter` PDA if not exists, seeded `["reporter", reporter.key()]`
- Set initial confidence = 40 (community weight 0.4 × 100)

**`corroborate_report`** (permissionless)
```rust
pub fn corroborate_report(ctx: Context<CorroborateReport>, address: Pubkey) -> Result<()>
```
- Increment `corroborations` on target `ThreatReport`
- Recalculate `confidence` based on corroboration count

**`update_confidence`** (admin-gated, multisig in v2, single authority in v1)
```rust
pub fn update_confidence(ctx: Context<UpdateConfidence>, address: Pubkey, new_score: u8) -> Result<()>
```
- Only callable by program authority
- Used by ingestion worker to sync corpus confidence to chain

---

## P3-03: Devnet testing (May 4)
- Deploy to devnet
- Run `submit_report` with a known test address
- Confirm PDA created, fields correct
- Run `corroborate_report` twice → confirm confidence updates
- Run `update_confidence` as authority → confirm new score persists
- Use `anchor test` suite — add tests for all three instructions

---

## P3-04: Mainnet deploy (May 5)
- Fund deploy wallet with ≥ 0.5 SOL
- `anchor deploy --provider.cluster mainnet`
- Verify program on Solana Explorer
- Update SDK `lookupAddress` to also check on-chain PDAs (in addition to Supabase)
- Fallback order: Redis → Supabase → on-chain PDA → GoPlus

---

## P3-05: Ingestion worker — promote to chain (May 5–6)
Update the Vercel Cron worker to promote high-confidence entries:

```ts
// After upsert to Supabase, if confidence > 0.7:
const highConfidenceEntries = await supabase
  .from('threat_reports')
  .select('*')
  .gt('confidence', 0.7)
  .gt('last_updated', lastPromotionTimestamp)

for (const entry of highConfidenceEntries) {
  await walourOracleProgram.methods
    .updateConfidence(new PublicKey(entry.address), Math.round(entry.confidence * 100))
    .accounts({ authority: adminKeypair.publicKey, ... })
    .signers([adminKeypair])
    .rpc()
}
```

- Rate-limit on-chain writes (Solana tx fees) — batch up to 10 promotions per cron cycle
- Log each on-chain write to `outages` table for monitoring

---

## P3-06: Dialect Blinks integration (May 6–7)
- Add `POST /api/scan` Vercel function that accepts a token/address/URL
- Returns a Dialect Blink-compatible JSON response with the risk verdict
- Wire into `@walour/sdk` → share Blink button in extension and mobile
- Test: paste a Blink URL into Twitter — confirm interactive threat card renders

**Blink URL format:** `https://walour.xyz/scan?address={pubkey}`
**Response schema:**
```json
{
  "title": "Walour Threat Check",
  "icon": "https://walour.xyz/logo.png",
  "description": "⚠️ RED: Known wallet drainer. 847 reports. Do not interact.",
  "label": "Scan Another",
  "links": { "actions": [] }
}
```

---

## P3-07: Corpus growth to ≥ 3,500 (May 7–8)
- Check current count: `SELECT COUNT(*) FROM threat_reports`
- If under 3,500: run a one-off historical backfill from Chainabuse (download full CSV, not just delta)
- Also ingest Scam Sniffer historical dataset if available
- Target: ≥ 3,500 confirmed before submit

---

## P3-08: End-to-end integration test (May 8–9)
- Full flow: visit a phishing URL → extension fires → overlay shows → "Don't sign" → telemetry emits
- Check Supabase `drain_blocked_events` row created
- Check walour.xyz/stats updates
- Check on-chain PDA readable from a fresh Solana connection (not from app state)
- Test Dialect Blink renders in a test tweet

---

## P3-09: Colosseum submission prep (May 9–10)
Use `/submit-to-hackathon` skill for the final checklist. Manual requirements:

- [ ] GitHub repo public, clean README
- [ ] Demo video (2–3 min): show phishing URL blocked, token flagged RED, transaction warning streamed, "Don't sign" clicked, stats dashboard with event registered
- [ ] Extension live in Chrome Web Store (or shareable zip if review pending)
- [ ] `@walour/sdk` v0.1.0 live on npm
- [ ] `walour_oracle` program ID verified on Solana Explorer mainnet
- [ ] walour.xyz/stats publicly accessible with at least 1 confirmed drain_blocked event
- [ ] Colosseum project page: title, one-liner, description (use oracle/security-infrastructure framing — not "AI assistant" framing)
- [ ] Tag: `oracle`, `nlp`, `security`, `solana`, `browser-extension`

**Description framing (copy-paste ready):**
> Walour is a security oracle for Solana — a composable, on-chain threat registry backed by a wallet-agnostic Chrome extension that intercepts phishing sites, malicious tokens, and wallet drainers before the user signs. Claude Sonnet 4.6 decodes raw Solana instructions into plain-English warnings in real time. Any dApp can read the threat registry in 10 lines of TypeScript. No entity can take it down.

---

## P3-10: Colosseum submit (May 11)

Submit at: https://www.colosseum.org/frontier

**Attach:**
- GitHub repo link
- Demo video link
- walour.xyz/stats link (KPI proof)
- `@walour/sdk` npm link
- Solana Explorer link for `walour_oracle` program

---

## Acceptance Criteria

| Check | Pass condition |
|---|---|
| Anchor program | Deployed to mainnet, program ID verified on Explorer |
| PDAs | `submit_report` + `corroborate_report` + `update_confidence` all pass `anchor test` |
| Corpus | ≥ 3,500 rows, promotions to chain working |
| Blinks | Scan URL renders interactive card on Twitter |
| Stats dashboard | Live, shows real events |
| E2E test | Full intercept → block → telemetry flow works |
| Colosseum | Submitted by May 11 23:59 Asia/Calcutta |

---

## Buffer / Risk

| Risk | Buffer |
|---|---|
| CWS review takes > 7 days | Submitted Apr 29; 12-day buffer to May 11. Fallback: distribute as `.zip` sideload |
| Mainnet deploy fails | Devnet tested May 3–4; mainnet on May 5 — 6 days buffer |
| Corpus under 3,500 | Historical backfill on May 7–8 covers shortfall |
| Colosseum form issues | Dry-run submission on May 9 (save draft), final submit May 11 |
