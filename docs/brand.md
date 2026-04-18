# Brand — Walour

_Status: active_

## Palette

| Token | Hex | Usage |
|---|---|---|
| Primary | `#00C9A7` | Electric Teal — CTAs, active states, logo accent |
| Background | `#0D1117` | Deep Charcoal — app/extension background |
| Safe | `#22C55E` | GREEN risk level, success states |
| Warn | `#F59E0B` | AMBER risk level, caution states |
| Danger | `#EF4444` | RED risk level, block/error states |
| Surface | `#161B22` | Elevated panels, cards |
| Border | `#30363D` | Dividers, input borders |
| Text Primary | `#E6EDF3` | Body copy on dark background |
| Text Muted | `#8B949E` | Secondary labels, metadata |

## Typography

System font stack only — no web fonts (performance + privacy):

```css
font-family: 'SF Pro Display', 'Roboto', 'Segoe UI', system-ui, sans-serif;
```

Monospace (addresses, hashes):
```css
font-family: 'SF Mono', 'Roboto Mono', 'Consolas', monospace;
```

## Voice

- Direct and unambiguous: "This transaction will drain your wallet" not "This transaction may present some risk"
- Action-first: "Don't sign" not "Cancel signing"
- Never alarmist for GREEN — "Looks safe" not "No threats detected"
- Security oracle framing: authoritative, not fearful

## Extension Overlay Spec

- Container: 360px wide, `#0D1117` bg, `1px solid #30363D` border, `12px` border-radius
- Header: `#00C9A7` left border accent, `14px` semibold
- Status dots: 8px circle — GREEN `#22C55E` / AMBER `#F59E0B` / RED `#EF4444`
- Primary button ("Don't sign"): `#00C9A7` bg, `#0D1117` text, `8px` radius
- Ghost button ("Sign anyway"): transparent, `#8B949E` text, `1px solid #30363D` border
- Spinner: `#00C9A7` rotating ring
