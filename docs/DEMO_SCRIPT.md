# Walour — Demo Script
**Target length:** 2 minutes 15 seconds
**Recording tool:** [Cap](https://cap.so) — free, screen + webcam overlay, exports MP4
**Where to post:** Upload MP4 natively to X + attach to Colosseum submission

### Face cam strategy
- **Scene 1 (hook):** face cam ON — builds trust, feels human
- **Scenes 2–5 (demo):** face cam OFF — nothing distracts from the product
- **Scene 6 (close):** face cam ON — ends like a pitch, not a tutorial

---

## Setup before recording

Start these in order — have them all running before you hit record:

1. **Worker:** `cd apps/worker && npx tsx server.ts` (port 3001)
2. **Stats page:** `cd apps/web && npm run dev`
3. **Test trigger page:** open `apps/extension/test-trigger.html` via a local server
4. **Extension:** loaded in Chrome from `apps/extension/dist`
5. **Phantom:** installed, unlocked, and connected

### Verify before recording
Open the test trigger page, click **Connect Phantom**, then **Sign Transaction** — the Walour overlay should appear with URL row showing RED. If GREEN, the worker isn't running.

---

## Scene 1 — Hook (0:00–0:20) · FACE CAM ON

**Screen:** Stats page
**Camera:** Face cam on, bottom-right corner

**Say:**
> "Solana lost $330 million to wallet drainers last year. Every single victim had one thing in common — they signed a transaction they didn't understand. Walour stops that. Not after the fact. Before the signature."

**What to show:** Pause on stat cards — threats tracked, drains blocked.

---

## Scene 2 — The intercept (0:20–1:10) · FACE CAM OFF · THE WOW MOMENT

**Screen:** Test trigger page
**Camera:** Toggle off

**Say:**
> "A user lands on a suspicious site. Phantom fires. Watch what happens."

Click **Sign Transaction.**

**Say nothing for 3 seconds.** Let the overlay slide in. Let the judge see it happen.

Then narrate what they're watching:

> "Walour intercepts the transaction before the wallet popup even appears."

Point to URL row:

> "Domain — RED. Known threat, 97% confidence."

Point to token row:

> "Token — flagged. PermanentDelegate extension. That means the contract can move tokens from your wallet without your approval, ever again."

Point to the streaming text row — let it run:

> "And right now, Claude is reading the raw Solana instruction and explaining it in plain English. In real time. Before you decide anything."

**Pause. Let the stream run 4 full seconds. This is the moment.**

---

## Scene 3 — One click (1:10–1:25) · FACE CAM OFF

**Screen:** Still on the overlay

**Say:**
> "One click. Transaction blocked. The drain never happens."

Click **Don't sign.**

**What to show:** Overlay closes cleanly. Wallet popup gone.

---

## Scene 4 — The oracle (1:25–1:50) · FACE CAM OFF

**Screen:** Switch to stats page or VS Code showing Anchor program

**Say:**
> "Every blocked drain gets written to an on-chain registry. A Solana oracle — permissionless, sybil-resistant, queryable by anyone."

Show the program ID or Solana Explorer devnet link briefly:

> "Any wallet, any dApp, can read the same threat intelligence. Not a centralized blocklist. A shared oracle any developer can build on."

---

## Scene 5 — SDK (1:50–2:05) · FACE CAM OFF

**Screen:** VS Code with the SDK snippet

**Say:**
> "Ten lines of TypeScript. That's all it takes to plug any dApp into the same threat intelligence that just blocked that drain."

Show this on screen:

```ts
import { checkDomain, checkTokenRisk, decodeTransaction } from '@walour/sdk'

const domain = await checkDomain('suspicious-airdrop.xyz')
// { level: 'RED', confidence: 0.95 }

for await (const chunk of decodeTransaction(tx)) {
  process.stdout.write(chunk) // streams in real time
}
```

---

## Scene 6 — Close (2:05–2:15) · FACE CAM ON

**Screen:** GitHub repo
**Camera:** Face cam back on

**Say:**
> "Walour. A security oracle for Solana. Not a plugin. Not a blocklist. Shared infrastructure any wallet or dApp can use — starting now."

---

## Recording tips

- Record at 1080p minimum
- Do one full rehearsal run before the real take — muscle memory matters on the overlay scene
- If Claude stream is slow, that is fine — it shows it's real, not faked
- If anything breaks mid-scene, cut and redo just that scene — Cap lets you trim
- Total target: under 2:20. Colosseum reviewers watch dozens of these; tight wins
- Do not mention Supabase, Redis, or Helius by name — say "the oracle" or "the corpus"
- Do not say "Chrome extension" in the close — say "security oracle"

---

## X post copy (post the video natively, not a YouTube link)

```
Built a Solana security oracle that intercepts wallet drainers before you sign.

Streaming Claude explains the transaction in plain English — in real time.
On-chain threat registry any dApp can query in 10 lines of TypeScript.
5,200+ threats tracked. Every blocked drain is public.

github.com/Walour/Walour

#Solana #Colosseum
```
