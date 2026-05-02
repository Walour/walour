# Model Cost Strategy — Walour

## Current setup (CLAUDE.md)
- Primary: Claude Sonnet 4.6 (`claude-sonnet-4-6`)
- Fallback: Claude Haiku 4.5 (`claude-haiku-4-5-20251001`)

## Cost comparison (per 1M tokens in/out)
| Model | Input | Output | Tool use | Notes |
|---|---|---|---|---|
| Claude Sonnet 4.6 | $3 | $15 | Yes | Current — overkill for tx explanation |
| Claude Haiku 4.5 | $0.80 | $4 | Yes | 5x cheaper, already in stack |
| GPT-4o-mini | $0.15 | $0.60 | Yes | 20x cheaper, needs OpenAI SDK |
| Gemini 1.5 Flash | $0.075 | $0.30 | Yes | 40x cheaper, needs Google SDK |
| Groq Llama 3.1 8B | ~free | ~free | Limited | Fast, but weak tool use |

## Decision for hackathon

**Use Haiku 4.5 for all streaming tx explanations and forensic tool calls.**

Why:
- Already in the stack — zero new SDK dependency
- Supports tool use (needed for forensic investigation feature)
- ~5x cheaper than Sonnet, quality sufficient for security explanations
- First-token latency is faster than Sonnet (better for streaming UX)

**Only use Sonnet if:** confidence score is RED + corpus hit — i.e. the transaction is flagged and you need a high-quality forensic explanation for the judge demo. Even then, consider Haiku first.

## How to switch in decode.ts
```ts
// Change this line in apps/worker/src/decode.ts:
model: 'claude-sonnet-4-6'
// To:
model: 'claude-haiku-4-5-20251001'
```

Or make it dynamic based on verdict level:
```ts
model: verdictLevel === 'RED' ? 'claude-sonnet-4-6' : 'claude-haiku-4-5-20251001'
```

## Why NOT GPT-4o-mini / Gemini for a hackathon
- Adds a second AI SDK dependency
- Anthropic prompt caching (already configured in CLAUDE.md) means repeated similar tx explanations cost near-zero on Haiku
- Judges may ask "what AI?" — "Claude" is a better answer than "GPT-mini" for a Solana hackathon
- Switching costs outweigh the 4x extra saving vs Haiku for demo-scale usage

## Estimated real cost for hackathon demo
A tx explanation is ~800 tokens total. At Haiku rates:
- 1,000 demo transactions = ~$0.004 total
- Even at Sonnet rates: ~$0.02 for 1,000 txs
- Cost is irrelevant at demo scale — but use Haiku anyway for production readiness signal
