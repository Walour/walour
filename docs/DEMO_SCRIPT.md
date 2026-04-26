# Walour — Demo Script
**Target length:** 2–3 minutes  
**Recording tool:** [Cap](https://cap.so) — free, screen + webcam overlay, exports MP4  
**Where to post:** Upload MP4 natively to X (10x more reach than YouTube links) + attach to Colosseum submission

### Face cam strategy
- **Scene 1 (hook):** face cam ON — builds trust, feels human
- **Scenes 2–6 (demo):** face cam OFF — nothing distracts from the product
- **Scene 7 (close):** face cam ON — ends like a pitch, not a tutorial

Cap lets you toggle webcam on/off mid-recording. Face cam bubble goes bottom-right corner.

---

## Setup before recording

Start these in order — have them all running before you hit record:

1. **Worker:** `cd apps/worker && npx tsx server.ts` (port 3000)
2. **Stats page:** `cd apps/web && npm run dev` (port 3001 or 3000 if worker isn't running)
3. **Test trigger page:** `npx serve . -p 8080` from the repo root → open `http://localhost:8080/walour/apps/extension/test-trigger.html`
4. **Extension:** loaded in Chrome from `apps/extension/dist` → chrome://extensions → Load unpacked
5. **Phantom:** installed and unlocked

### Verify before recording

Open the test trigger page, click **Connect Phantom**, then click **Sign Transaction** — the Walour overlay should slide in with the URL row showing **RED** (localhost is seeded as a known threat in the corpus). If it shows GREEN, the worker isn't running.

---

## Scene 1 — Hook (0:00–0:15) · FACE CAM ON

**Screen:** Stats page at `localhost:3001/stats`  
**Camera:** Face cam on, bottom-right corner

**Say:**
> "Every day, Solana users lose millions to wallet drainers and phishing sites — and they only find out after they've already signed. Walour stops it before the signature."

**What to show:** Pause on the stat cards — 5,209 threats tracked, drains blocked, SOL saved.

---

## Scene 2 — The problem (0:15–0:30) · FACE CAM OFF

**Screen:** Switch to the test trigger page  
**Camera:** Toggle face cam off — screen only from here

**Say:**
> "A user lands on a suspicious site. Their wallet pops up asking to sign a transaction. They have no idea what it does. Most people just sign."

**What to show:** The test trigger page. Click **Connect Phantom** — wallet connects.

---

## Scene 3 — Walour intercepts (0:30–1:10) · FACE CAM OFF ← WOW MOMENT

**Screen:** Click **Sign Transaction** on the test trigger page

**Say:**
> "The moment the wallet fires — Walour intercepts it."

**What to show:**
- Overlay slides in (dark card)
- **URL row** lights up RED — known threat, 97% confidence
- **Token row** shows risk score
- **Transaction row** — Claude starts streaming plain-English text in real time

**Say (while Claude streams):**
> "Claude Sonnet reads the raw Solana instruction and explains it in plain English — in real time, before you decide anything."

Let the stream run 3–4 seconds. This is the moment that sells it.

---

## Scene 4 — Don't sign (1:10–1:25) · FACE CAM OFF

**Screen:** Click the **Don't sign** button

**Say:**
> "One click. Transaction blocked. The drain never happens."

**What to show:** Overlay closes, wallet popup disappears.

---

## Scene 5 — Stats update (1:25–1:45) · FACE CAM OFF

**Screen:** Switch to `localhost:3001/stats`

**Say:**
> "Every blocked drain is recorded — threats tracked, SOL saved, all public."

**What to show:** Stat cards with real numbers. Top 10 threats table with real addresses.

---

## Scene 6 — SDK (1:45–2:05) · FACE CAM OFF

**Screen:** VS Code or GitHub README open on the code snippet

**Say:**
> "And because it's a composable SDK, any dApp can plug in the same threat intelligence in 10 lines of TypeScript. No API key, no single point of failure."

**What to show:**
```ts
import { checkDomain, checkTokenRisk, decodeTransaction } from '@walour/sdk'

const domain = await checkDomain('suspicious-airdrop.xyz')
// { level: 'RED', confidence: 0.95 }

for await (const chunk of decodeTransaction(tx)) {
  process.stdout.write(chunk) // streams in real time
}
```

---

## Scene 7 — Close (2:05–2:20) · FACE CAM ON

**Screen:** GitHub repo — `github.com/Walour/Walour`  
**Camera:** Toggle face cam back on

**Say:**
> "Walour. A security oracle for Solana — not a blocklist, not a plugin. Shared infrastructure any wallet or dApp can use. Built for Colosseum Frontier."

---

## X post copy

```
We built a Solana security oracle that intercepts wallet drainers before you sign.

→ Chrome extension hooks Phantom, Solflare & Backpack
→ Claude Sonnet streams a plain-English tx explanation in real time
→ 5,200+ known threats in the corpus
→ Any dApp can read the threat registry in 10 lines of TypeScript

github.com/Walour/Walour

#Solana #Colosseum
```

---

## Tips for your mate

- Record at 1080p, 30fps minimum
- If the Claude stream is slow, that's fine — shows it's real, not faked
- Don't mention Supabase, Redis, or Helius by name — just say "the corpus" or "the oracle"
- If anything breaks mid-scene, stop and redo just that scene — Cap lets you trim
- Keep total under 2:30 — Colosseum reviewers watch dozens of these
