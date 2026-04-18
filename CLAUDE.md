# Walour — Claude Code Project Instructions

## Project
**Walour (Wallet Armour)** — real-time, wallet-agnostic scam protection for Solana.
Ship target: **Colosseum Frontier, May 11 2026**.
Owner: Sahir (@Sahir__S · sikandersahir@gmail.com · github.com/Sahir619)

---

## Stack

| Layer | Tech |
|---|---|
| SDK | TypeScript, npm (`@walour/sdk`) |
| Extension | Chrome/Brave Manifest v3, TypeScript |
| On-chain | Anchor / Rust, Solana mainnet |
| Backend / cron | Vercel Edge Functions + Supabase |
| Cache | Upstash Redis |
| AI | Anthropic SDK — Claude Sonnet 4.6 (primary), Claude Haiku 4.5 (fallback) |
| RPC | Helius (primary) → Triton (fallback) → Solana public RPC |
| Threat intel | GoPlus Security API |
| Distribution | Dialect Blinks |
| Streaming | Yellowstone gRPC |

---

## Key Files

| Path | What it is |
|---|---|
| `Main Documents/Walour_PRD_v2.docx` | Product requirements — problem, ICP, competitive landscape |
| `Main Documents/Walour_FRD_v1_final.docx` | Feature requirements — SDK features, extension, on-chain, runtime infra |
| `Main Documents/Walour_UIUX_v1.1 (1).docx` | UI/UX spec — design tokens, extension popup, mobile nav |
| `walour_spike.js` | Technical spike — proof of concept, scored 6.5/10 |
| `colosseum-score.md` | Colosseum Copilot landscape analysis (260 cluster, 0/5 competitors placed) |
| `walour-spec-patches.md` | All doc patches from technical review |
| `architecture.md` | System architecture (this project) |
| `plan-phase-01.md` | Phase 0+1: Corpus ingestion + SDK (Apr 17–25) |
| `plan-phase-02.md` | Phase 2: Chrome extension MVP (Apr 26 – May 2) |
| `plan-phase-03.md` | Phase 3: On-chain oracle + submit (May 3–11) |

---

## Available Skills

The following `solana.new` skills are installed at `~/.claude/skills/`:

| Skill | When to use |
|---|---|
| `scaffold-project` | Bootstrapping new Anchor / TS packages |
| `build-with-claude` | General Solana build guidance |
| `build-defi-protocol` | DeFi protocol patterns |
| `build-mobile` | React Native + Solana Mobile Wallet Adapter |
| `deploy-to-mainnet` | Anchor mainnet deployment checklist |
| `review-and-iterate` | Code review for Solana projects |
| `debug-program` | Debugging Anchor programs |
| `colosseum-copilot` | Hackathon landscape analysis |
| `submit-to-hackathon` | Colosseum submission prep |
| `apply-grant` | Superteam grant application |
| `validate-idea` | Idea validation sprint |
| `competitive-landscape` | Competitor mapping |
| `brand-design` | Design tokens / brand |
| `frontend-design-guidelines` | UI quality bar |
| `claude-api` | Anthropic SDK integration, prompt caching |
| `build-data-pipeline` | Ingestion workers / ETL |
| `cso` | Security review mode |
| `security-review` | Full security audit |
| `gsd:new-project` | GSD planning workflow |
| `gsd:plan-phase` | Phase planning |
| `gsd:execute-phase` | Phase execution |
| `vercel:deploy` | Vercel deployment |
| `vercel:env` | Environment variables |
| `vercel:vercel-functions` | Edge / serverless functions |

---

## Mandatory Skills Per Phase

**You MUST invoke these skills (via the Skill tool) before writing any code for the corresponding phase. No exceptions.**

### Phase 1 — Corpus ingestion + SDK (`plan-phase-01.md`)
| Skill | Why |
|---|---|
| `claude-api` | Streaming decoder, prompt caching, model IDs |
| `build-data-pipeline` | Ingest worker patterns, ETL, error handling |

### Phase 2 — Chrome extension MVP (`plan-phase-02.md`)
| Skill | Why |
|---|---|
| `frontend-design-guidelines` | Overlay UI quality bar, shadow DOM patterns |
| `brand-design` | Enforce design tokens in all UI components |
| `claude-api` | Streaming chunk relay from background → popup |
| `cso` | Content script injection security review |
| `vercel:vercel-functions` | Stats dashboard edge function patterns |

### Phase 3 — On-chain oracle + submit (`plan-phase-03.md`)
| Skill | Why |
|---|---|
| `scaffold-project` | Anchor program scaffold |
| `deploy-to-mainnet` | Mainnet deployment checklist |
| `review-and-iterate` | Pre-submit code review |
| `submit-to-hackathon` | Colosseum submission checklist |
| `security-review` | Full audit before mainnet deploy |

---

## Coding Rules

- **Cache first.** Every `@walour/sdk` export checks Upstash Redis before any RPC/API call.
- **Circuit breakers.** Wrap Helius, GoPlus, Claude in circuit breakers (3 failures/60s threshold). Never let a provider outage crash the SDK.
- **Stream Claude output.** Transaction decoder MUST stream tokens, never wait for full response. First-token < 400ms.
- **ALT resolution.** All `VersionedTransaction` decoders MUST resolve Address Lookup Tables before decoding.
- **Confidence scoring.** All threat entries carry a `confidence` field (0–1). Never treat community reports as authoritative without corroboration.
- **No gamification fields.** Data model must not contain `points`, `xp`, `leaderboard_rank`, `streak`. Reporter rep = `confidence` only.
- **Wallet tab = Registry, not Leaderboard.** See UIUX spec.
- **Never block outright on ALT failure** — show risk warning, let user decide.
- **Emit `drain_blocked` telemetry** on every prevented signing event.

---

## Design Tokens (quick ref)

- Primary: `#00C9A7` (Electric Teal)
- Background: `#0D1117` (Deep Charcoal)
- Safe: `#22C55E` · Warn: `#F59E0B` · Danger: `#EF4444`
- Fonts: SF Pro / Roboto / Segoe UI (system only — no web fonts)

---

## Colosseum Context

- Cluster `v1-c13` — Solana Privacy & Identity Management (260 projects, 5.8% win rate)
- 5 direct competitors (Rug Raider, GuardSOL, Iteration 0001, ChainGPT, Sol Guard) — **0 prizes won**
- Winner-overindexed attributes: **oracle +27%, NLP +24%**
- Winner-underindexed: gamification −57%, NFT/token primitives −56%
- Frame Walour as a **security oracle / shared infrastructure**, not a blocklist or gamified app
