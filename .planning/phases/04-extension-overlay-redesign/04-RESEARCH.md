# Phase 4: Extension + Overlay Redesign - Research

**Researched:** 2026-04-30
**Domain:** Chrome Extension MV3 UI, CSS design systems, Shadow DOM styling, press-and-hold UX
**Confidence:** HIGH

---

## Summary

Phase 4 is a pure UI/styling phase — no backend changes, no new API calls, no logic changes. The extension already works correctly: background.ts handles scanning, content.ts hooks wallets, overlay.ts renders check rows with streaming. The goal is to replace placeholder visuals with the same design language already live on walour.xyz.

The web app (apps/web/styles/globals.css) already contains most of the target CSS classes: `.ext-popup`, `.ext-live-pill`, `.ext-live-dot`, `.ext-verdict`, `.ext-meter`, `.ext-threats`, `.ext-actions`. These were designed as extension mockup styles. They can be extracted verbatim into `packages/tokens/tokens.css` with minor adaptations for Shadow DOM injection.

The main technical constraint is Chrome Extension MV3's Content Security Policy: `script-src 'self'; object-src 'self'`. This means no inline `<style>` in popup.html beyond what's already there — but CSS files loaded as extension pages are fine. Shadow DOM injection in content scripts must use `document.createElement('style')` (already done correctly in overlay.ts). No web fonts, no `@import` with remote URLs.

**Primary recommendation:** Extract globals.css ext-popup classes + design tokens into `packages/tokens/tokens.css`. Rewrite `popup.html` to use those classes. Rewrite `overlay.ts` OVERLAY_CSS string to use the same tokens. Add press-and-hold to the RED "Sign anyway" button. Add `POPUP_HELLO` port handler to background.ts so popup can display `lastScan` state.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EXT-01 | Shared design tokens package at `packages/tokens/tokens.css` | globals.css `:root` block + ext-popup classes are the source; extract + version as standalone file |
| EXT-02 | Popup idle state — hex SVG logo, live pulse pill, stats strip, quick lookup, check toggle pills | `.ext-popup`, `.ext-live-pill`, `.ext-live-dot` classes exist in globals.css; hex SVG is in Nav.tsx; stats strip pattern at `.stats-strip` |
| EXT-03 | Popup scanning state — animated logo, live check rows with status updates, streamed Claude decode | `.ext-scan-progress`, `.ext-scan-bar-fill`, `@keyframes glowPulse` already exist; state machine: idle → scanning on `POPUP_HELLO` response |
| EXT-04 | Popup verdict state — colored band, confidence bar, threat flags, address card, CTA buttons | `.ext-verdict`, `.ext-meter`, `.ext-threats`, `.ext-btn` classes exist in globals.css; state drive via `lastScan` from background |
| EXT-05 | Overlay redesign — glass card, verdict band, confidence bar, flags list, press-and-hold on RED | OVERLAY_CSS in overlay.ts needs glass morphism + verdict band; press-and-hold uses `pointerdown`/`pointerup` with timer + CSS progress arc |
| EXT-06 | Background script — lastScan cache, POPUP_HELLO handler, walour-popup port | background.ts currently only handles `walour-scan` port; add `walour-popup` port + `lastScan` Map<tabId, ScanResult> |
| EXT-07 | Micro-interactions — pulse animations, scale pings, reduced-motion support | `@keyframes pulse`, `@keyframes glowPulse`, `@media (prefers-reduced-motion)` all exist in globals.css; pattern: wrap all animations in reduced-motion guard |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | ^5.4.0 | All extension source | Already in devDeps |
| Vite | ^5.0.0 | Extension build (MV3) | Already configured |
| Chrome MV3 | - | Extension platform | Locked by manifest.json |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| No new deps needed | - | All styling is plain CSS | Phase is CSS + minor TS changes only |

**Installation:** No new packages required. This phase adds `packages/tokens/` as a new workspace package (CSS only, no JS).

---

## Architecture Patterns

### Recommended Project Structure Changes
```
packages/
└── tokens/
    ├── package.json          # name: "@walour/tokens"
    └── tokens.css            # CSS custom properties + ext-popup classes

apps/extension/
├── popup.html                # REWRITE — use tokens.css classes
├── src/
│   ├── popup.ts              # REWRITE — state machine: idle|scanning|verdict
│   ├── overlay.ts            # REWRITE OVERLAY_CSS — glass morphism + verdict band
│   └── background.ts         # ADD — lastScan cache, walour-popup port handler
```

### Pattern 1: Token Extraction

The design tokens in globals.css `:root` block are the single source of truth. Extract them verbatim into `packages/tokens/tokens.css`. In popup.html, load as `<link rel="stylesheet" href="tokens.css">` (Vite copies to dist). In overlay.ts, inject the CSS string directly into the Shadow DOM style element.

**What:** All CSS custom properties (`--bg`, `--accent`, `--safe`, `--warning`, `--danger`, `--glass`, etc.) plus the `ext-popup` class family, keyframes for `pulse`, `glowPulse`, `feedIn`, `fadeUp`.

**Tokens to include (from globals.css):**
```css
/* Source: apps/web/styles/globals.css lines 7-35 */
:root {
  --bg: #0D1117;
  --surface: #161B22;
  --surface-elevated: #1E2535;
  --border: #30363D;
  --border-subtle: #21262D;
  --text: #E6EDF3;
  --text-muted: #8B949E;
  --text-disabled: #484F58;
  --accent: #00C9A7;
  --accent-dark: #00967D;
  --safe: #22C55E;
  --warning: #F59E0B;
  --danger: #EF4444;
  --danger-soft: rgba(239, 68, 68, 0.08);
  --accent-soft: rgba(0, 201, 167, 0.08);
  --accent-glow: rgba(0, 201, 167, 0.35);
  --radius-sm: 4px;
  --radius: 8px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --radius-pill: 999px;
}
```

### Pattern 2: Glass Morphism (from globals.css lines 79-105)

```css
/* Source: apps/web/styles/globals.css */
.glass {
  background: rgba(22, 27, 34, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(18px) saturate(140%);
  -webkit-backdrop-filter: blur(18px) saturate(140%);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.06) inset,
    0 0 0 1px rgba(0, 0, 0, 0.2),
    0 12px 40px rgba(0, 0, 0, 0.5),
    0 0 60px rgba(0, 201, 167, 0.06);
}
```

**MV3 constraint:** `backdrop-filter` works fine in extension popup pages (Chromium-rendered HTML). In Shadow DOM content scripts it also works because the shadow host is in the page's rendering context. No special handling needed.

### Pattern 3: Popup State Machine

The popup needs three states. Use `data-state` attribute on the root element:

```typescript
// popup.ts — drive state machine from background port
type PopupState = 'idle' | 'scanning' | 'verdict'

function setState(state: PopupState, data?: ScanResult) {
  document.body.dataset.state = state
  // show/hide sections via CSS [data-state] selectors
}
```

CSS drives visibility:
```css
[data-state="idle"]    .scanning-section { display: none; }
[data-state="idle"]    .verdict-section  { display: none; }
[data-state="scanning"] .idle-section    { display: none; }
/* etc */
```

### Pattern 4: Background → Popup Communication (EXT-06)

Current background.ts only handles `walour-scan` port (content script → background). The popup needs a separate port `walour-popup` to request `lastScan` for the active tab.

```typescript
// background.ts addition
const lastScan = new Map<number, ScanResult>()  // tabId → latest result

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'walour-popup') {
    // Popup opened — send current state for active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id
      const scan = tabId !== undefined ? lastScan.get(tabId) : undefined
      port.postMessage({ type: 'POPUP_HELLO', scan: scan ?? null })
    })
    port.onDisconnect.addListener(() => { /* cleanup if needed */ })
    return
  }
  // existing walour-scan handler below...
})
```

```typescript
// popup.ts — connect on DOMContentLoaded
const port = chrome.runtime.connect({ name: 'walour-popup' })
port.onMessage.addListener((msg) => {
  if (msg.type === 'POPUP_HELLO') {
    if (msg.scan) setState('verdict', msg.scan)
    else setState('idle')
  }
})
```

### Pattern 5: Press-and-Hold for RED "Sign Anyway" (EXT-05)

Only required when verdict is RED. Use `pointerdown`/`pointerup`/`pointerleave` with a 1.5s timer and CSS `clip-path` or `conic-gradient` arc to show progress.

```typescript
// overlay.ts — press-and-hold implementation
let holdTimer: ReturnType<typeof setTimeout> | null = null
let holdInterval: ReturnType<typeof setInterval> | null = null

allowBtn.addEventListener('pointerdown', () => {
  if (currentVerdict !== 'RED') {
    decisionCallback?.(true)
    return
  }
  const HOLD_MS = 1500
  const start = Date.now()
  // Update CSS progress arc
  holdInterval = setInterval(() => {
    const pct = Math.min((Date.now() - start) / HOLD_MS * 100, 100)
    allowBtn.style.setProperty('--hold-pct', `${pct}`)
  }, 16)
  holdTimer = setTimeout(() => {
    clearInterval(holdInterval!)
    decisionCallback?.(true)
  }, HOLD_MS)
})

allowBtn.addEventListener('pointerup', cancelHold)
allowBtn.addEventListener('pointerleave', cancelHold)

function cancelHold() {
  if (holdTimer) { clearTimeout(holdTimer); holdTimer = null }
  if (holdInterval) { clearInterval(holdInterval!); holdInterval = null }
  allowBtn.style.setProperty('--hold-pct', '0')
}
```

CSS progress arc on button:
```css
.walour-btn-hold {
  position: relative;
  background: rgba(239,68,68,0.15);
  color: var(--danger);
  border: 1px solid var(--danger);
  overflow: hidden;
}
.walour-btn-hold::before {
  content: '';
  position: absolute;
  inset: 0;
  background: conic-gradient(
    var(--danger) calc(var(--hold-pct, 0) * 1%),
    transparent calc(var(--hold-pct, 0) * 1%)
  );
  opacity: 0.2;
  pointer-events: none;
}
```

### Pattern 6: Hex SVG Logo (from Nav.tsx)

The hex logo is a multi-polygon SVG already defined in `apps/web/components/layout/Nav.tsx` lines 113-179. Use the same SVG inline in `popup.html` and `overlay.ts`. The inner polygon opacity-0.3 and the vertex circles provide the nested hex aesthetic. For the popup (40px), scale `viewBox="-80 -80 160 160"` via `width/height` attributes.

### Anti-Patterns to Avoid

- **Don't use `innerHTML` in overlay.ts** — already documented in overlay.ts line 2. Shadow DOM must use `createElement + textContent`. The press-and-hold button can use CSS `::before` pseudo-element for the progress arc (no innerHTML needed).
- **Don't import tokens.css with `@import url()`** from a remote host — MV3 CSP blocks external CSS. All CSS must be bundled or included as extension page assets.
- **Don't use web fonts** — system font stack only: `'SF Pro Display', 'Roboto', 'Segoe UI', system-ui, sans-serif`.
- **Don't share tokens.css via `<link>` in Shadow DOM** — Shadow DOM does not inherit `<link>` from the document. Tokens must be injected as `<style>` text nodes into the shadow root.
- **Don't add backdrop-filter to Shadow DOM overlay without fallback** — some Linux/low-end Chromium builds don't support it. Always include `background: rgba(22,27,34,0.92)` as fallback before the `backdrop-filter` rule.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Design token variables | Custom values scattered in each file | `packages/tokens/tokens.css` `:root` block | Single source, sync with website |
| Animation keyframes | Custom per-component keyframes | Reuse `@keyframes pulse`, `glowPulse`, `feedIn` from globals.css | Already tuned to brand, reduced-motion guards already written |
| Hex SVG logo | Re-drawing hex geometry | Copy SVG from Nav.tsx verbatim | Already pixel-perfect with vertex circles |
| Ext-popup classes | Custom `.popup-*` classes | Reuse `.ext-popup`, `.ext-verdict`, `.ext-meter`, `.ext-threats` from globals.css | These were designed for exactly this popup |
| Press-and-hold timer | UI library | Native `setTimeout`/`setInterval` + CSS conic-gradient | Zero dependencies, works in Shadow DOM |

**Key insight:** globals.css already contains a complete extension popup mockup class system (`ext-popup`, `ext-live-pill`, `ext-verdict`, `ext-meter`, `ext-threats`, `ext-actions`, `ext-btn`). These were written as website mockup classes but are directly usable as the real popup's styles.

---

## Common Pitfalls

### Pitfall 1: CSS Custom Properties Don't Cross Shadow DOM Boundaries (Inherited)
**What goes wrong:** `var(--accent)` defined in `:root` of the document is NOT available inside a Shadow DOM unless re-declared.
**Why it happens:** Shadow DOM creates a new CSS scope. Custom properties DO inherit through Shadow DOM boundaries by default (they are inheritable), but only if the shadow host's `:host` or `:root` inherits them. Since overlay.ts uses `mode: 'closed'`, properties set on `document.documentElement` still cascade in.
**How to avoid:** Include the `:root` token block at the top of the OVERLAY_CSS string injected into the shadow root. This ensures tokens are available regardless of document CSS state.
**Warning signs:** Colors showing as empty strings when using `var(--accent)` in overlay.

### Pitfall 2: `backdrop-filter` Clipped by `overflow: hidden` Ancestors
**What goes wrong:** Glass morphism doesn't render on the overlay card.
**Why it happens:** If any ancestor element in the shadow root has `overflow: hidden`, `backdrop-filter` is blocked.
**How to avoid:** Never set `overflow: hidden` on the shadow root's overlay container. Set it only on child elements that need clipping.

### Pitfall 3: Popup Dimensions Fixed at 320px — New Design May Overflow
**What goes wrong:** The existing popup.html body is `width: 320px`. The ext-popup mockup in globals.css is `width: 316px; height: 385px`. The verdict state with address card + threat flags + confidence bar will need ~420px height.
**How to avoid:** Set `min-height` on the popup body instead of fixed height. Chrome extension popups auto-size to content. Remove fixed height constraints.

### Pitfall 4: Vite Doesn't Copy tokens.css to dist Automatically
**What goes wrong:** `popup.html` references `tokens.css` but Vite's rollup config only processes JS entry points.
**Why it happens:** vite.config.ts `rollupOptions.input` lists only `.ts` files. Static CSS assets need explicit copying.
**How to avoid:** Add `tokens.css` to the `copyStaticAssets` plugin in vite.config.ts, OR import the CSS in `popup.ts` (Vite will bundle it as an asset). Since popup.html loads popup.js as a module, the cleanest approach is `import '../../../packages/tokens/tokens.css'` in popup.ts — Vite will emit it as an asset and Vite's HTML plugin will inline it.
**Alternative:** Add a Vite `css.extract` rule or use the existing copyStaticAssets hook.

### Pitfall 5: Background Port `walour-popup` Not Registered Before Popup Opens
**What goes wrong:** `chrome.runtime.connect({ name: 'walour-popup' })` in popup.ts succeeds but the port listener in background.ts hasn't been added, so no message is sent back.
**Why it happens:** MV3 service workers are event-driven. If the SW is sleeping, `onConnect` fires on wake-up, which is fine — but the handler must be registered at the top level of background.ts (not inside another listener), which it currently is for `walour-scan`.
**How to avoid:** Register the `walour-popup` port handler at module top level alongside the existing `walour-scan` handler. Verify with `chrome.runtime.getBackgroundPage` in devtools.

### Pitfall 6: `conic-gradient` in Shadow DOM Requires `--hold-pct` to Be a Number
**What goes wrong:** `calc(var(--hold-pct, 0) * 1%)` evaluates to `0 * 1%` which may not render correctly in all Chromium versions.
**How to avoid:** Use a CSS custom property that already includes the `%` unit: `style.setProperty('--hold-pct', `${pct}%`)` and reference as `conic-gradient(var(--danger) var(--hold-pct, 0%), transparent var(--hold-pct, 0%))`.

---

## Code Examples

### Hex SVG Logo (from Nav.tsx, sized for popup header ~32px)
```html
<!-- Source: apps/web/components/layout/Nav.tsx lines 113-179 -->
<svg viewBox="-80 -80 160 160" width="32" height="32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <polygon points="0,-68 59,-34 59,34 0,68 -59,34 -59,-34"
    fill="none" stroke="#00C9A7" stroke-width="4.5" stroke-linejoin="round"/>
  <polygon points="0,-46 40,-23 40,23 0,46 -40,23 -40,-23"
    fill="none" stroke="#00C9A7" stroke-width="1.5" stroke-linejoin="round" opacity="0.3"/>
  <polyline points="-40,-23 -18,26 0,6" fill="none" stroke="#00C9A7" stroke-width="3.5"
    stroke-linejoin="round" stroke-linecap="round"/>
  <polyline points="40,-23 18,26 0,6" fill="none" stroke="#00C9A7" stroke-width="3.5"
    stroke-linejoin="round" stroke-linecap="round"/>
</svg>
```

### Glass Morphism Overlay Card
```css
/* Source: apps/web/styles/globals.css lines 79-88 */
.walour-overlay {
  background: rgba(22, 27, 34, 0.55);  /* fallback first */
  background: rgba(22, 27, 34, 0.92);  /* no backdrop-filter fallback */
  border: 1px solid rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(18px) saturate(140%);
  -webkit-backdrop-filter: blur(18px) saturate(140%);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.06) inset,
    0 0 0 1px rgba(0, 0, 0, 0.2),
    0 12px 40px rgba(0, 0, 0, 0.5),
    0 0 60px rgba(0, 201, 167, 0.06);
  border-radius: 14px;
  width: 360px;
}
```

### Live Pulse Pill
```css
/* Source: apps/web/styles/globals.css lines 1636-1653 */
.ext-live-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.2);
  font-size: 11px;
  color: #22C55E;
}
.ext-live-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: #22C55E;
  animation: glowPulse 1.8s ease-in-out infinite;
}
@keyframes glowPulse {
  /* defined in globals.css line 1173 — copy to tokens.css */
}
```

### Verdict Band (RED state)
```css
/* Source: apps/web/styles/globals.css lines 1668-1678 */
.ext-verdict.is-risk {
  background: rgba(239, 68, 68, 0.08);
  border-left: 3px solid #EF4444;
}
.ext-verdict-label.danger { color: #EF4444; }
```

### Confidence Bar
```css
/* Source: apps/web/styles/globals.css lines 1684-1698 */
.ext-meter {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 10px;
  align-items: center;
  padding: 12px 18px;
}
.ext-meter-track { height: 5px; background: var(--border); border-radius: 3px; overflow: hidden; }
.ext-meter-fill { height: 100%; border-radius: 3px; transition: width 600ms ease-out; }
.ext-meter-fill.danger { background: var(--danger); }
.ext-meter-fill.safe { background: var(--accent); }
```

### Reduced Motion Guard
```css
/* Source: apps/web/styles/globals.css lines 1116-1126 + 2049-2051 */
@media (prefers-reduced-motion: reduce) {
  .ext-live-dot,
  .walour-dot.checking,
  .walour-scan-ring { animation: none !important; }
  .ext-meter-fill { transition: none !important; }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Unicode ⬡ as logo (`⬡`) | SVG hex logo from Nav.tsx | Phase 4 | Brand consistency with website |
| `background: #0D1117` (flat) | Glass morphism `rgba(22,27,34,0.55) + backdrop-filter` | Phase 4 | Visual polish matches website |
| Simple green dot status | Live pulse pill (animated dot + text pill) | Phase 4 | Clear "active" signal |
| Three check rows (always visible) | State-driven sections: idle/scanning/verdict | Phase 4 | UX clarity for each moment |
| "Sign anyway" = one click | Press-and-hold 1.5s on RED verdict | Phase 4 | Friction prevents accidental signing |
| No popup ↔ background communication | `walour-popup` port + `POPUP_HELLO` + `lastScan` cache | Phase 4 | Popup shows last scan result |

**Deprecated:**
- Unicode `⬡` hex character as logo: replaced by SVG
- Inline `body` background color in popup.html: move to tokens.css `.ext-popup` class
- Hardcoded hex strings in overlay.ts: replaced by CSS custom properties

---

## Open Questions

1. **Where does `lastScan` data come from in background.ts?**
   - What we know: background.ts handles `SCAN_RESULT` via `port.postMessage` to content script. It does not currently store results.
   - What's unclear: Should `lastScan` include the full `{ domain, token, txDecode }` result or just the verdict level?
   - Recommendation: Store `{ level: 'GREEN'|'AMBER'|'RED', domain, token, txSummary: string, confidence: number }` keyed by `tabId`. Cap to last 10 tabs.

2. **Does the popup stats strip require a live API call?**
   - What we know: popup.html currently has a link to walour.xyz/stats. The redesign spec calls for a "stats strip" in idle state.
   - What's unclear: Should stats be fetched from `/api/stats` on popup open, or use cached `chrome.storage` values?
   - Recommendation: Use `chrome.storage.local` for stats (updated by background.ts on each scan). No async fetch in popup for performance.

3. **Quick lookup input in idle state — does it need backend integration?**
   - What we know: EXT-02 mentions "quick lookup" in idle state.
   - What's unclear: Is this an address lookup (calls `/api/scan`?) or a URL lookup?
   - Recommendation: Text input that POSTs to `/api/scan?hostname=<input>` and transitions popup to scanning/verdict state. Same flow as existing scan, just triggered manually.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None currently in extension package — visual/interaction tests needed |
| Config file | None — Wave 0 creates `apps/extension/test/` |
| Quick run command | Manual: load unpacked extension, verify each state |
| Full suite command | `npx playwright test apps/extension/test/` (if added) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EXT-01 | tokens.css contains all required CSS custom properties | unit / static | `grep --count "var(--accent)" packages/tokens/tokens.css` | ❌ Wave 0 |
| EXT-01 | tokens.css is valid CSS (no parse errors) | static | `npx postcss packages/tokens/tokens.css --no-map` | ❌ Wave 0 |
| EXT-02 | Popup idle HTML structure contains `.ext-live-pill`, hex SVG, stats strip | manual-only | Load extension, click icon | ❌ Wave 0 |
| EXT-03 | Scanning state shows animated scan bar when `POPUP_HELLO` returns null | manual-only | Open popup during active scan | ❌ Wave 0 |
| EXT-04 | Verdict state shows colored band + confidence bar for RED result | manual-only | Trigger RED verdict, open popup | ❌ Wave 0 |
| EXT-05 | Overlay renders glass card with glassmorphism | manual-only | Visit test-trigger.html, approve wallet hook | ❌ Wave 0 |
| EXT-05 | Press-and-hold 1.5s fires allow decision only after full hold | manual-only | Hold "Sign anyway" on RED overlay | ❌ Wave 0 |
| EXT-05 | Release before 1.5s cancels action | manual-only | Release early on RED overlay | ❌ Wave 0 |
| EXT-06 | Background stores lastScan on SCAN_RESULT | unit | `apps/extension/test/background.test.ts` (mocked chrome API) | ❌ Wave 0 |
| EXT-06 | POPUP_HELLO message sent to walour-popup port on connect | unit | `apps/extension/test/background.test.ts` | ❌ Wave 0 |
| EXT-07 | All animations have `@media (prefers-reduced-motion: reduce)` guard | static | `grep -c "prefers-reduced-motion" packages/tokens/tokens.css` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** Manual visual check — load unpacked extension, verify changed surface
- **Per wave merge:** Full manual regression: idle → scanning → verdict → overlay → press-and-hold
- **Phase gate:** All states visually match design spec + EXT-06 unit tests pass before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/tokens/package.json` — workspace package definition
- [ ] `packages/tokens/tokens.css` — extracted from globals.css
- [ ] `apps/extension/test/background.test.ts` — covers EXT-06 (lastScan cache, POPUP_HELLO)
- [ ] Framework install: `npm install -D vitest @vitest/coverage-v8 -w apps/extension` — if unit tests added

*(EXT-02 through EXT-05, EXT-07 are visual/manual — no automated framework can cover shadow DOM injection reliably without Playwright, which is out of scope for this phase.)*

---

## Sources

### Primary (HIGH confidence)
- `apps/web/styles/globals.css` — all ext-popup classes, glass morphism rules, animation keyframes, design tokens verified by direct inspection
- `apps/extension/src/overlay.ts` — existing OVERLAY_CSS, shadow DOM injection pattern, button event model
- `apps/extension/src/background.ts` — port names (`walour-scan`), message types, storage schema
- `apps/extension/src/popup.ts` — current state logic, storage keys
- `apps/extension/manifest.json` — CSP: `script-src 'self'; object-src 'self'`, MV3 SW mode
- `apps/extension/vite.config.ts` — build entry points, copyStaticAssets plugin, dist output

### Secondary (MEDIUM confidence)
- `apps/web/components/layout/Nav.tsx` — hex SVG geometry verified by direct file read
- Chrome MV3 CSP documentation (knowledge): `script-src 'self'` blocks remote scripts, not local CSS files. `backdrop-filter` works in Chromium-rendered extension pages and in Shadow DOM.

### Tertiary (LOW confidence)
- CSS `conic-gradient` for press-and-hold arc: widely supported in Chromium 69+ (Chrome extension minimum is Chromium 88+ for MV3), confidence HIGH that it works.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, all existing tools confirmed by file inspection
- Architecture: HIGH — existing patterns in codebase fully map to requirements
- Pitfalls: HIGH — identified from direct code inspection of overlay.ts, vite.config.ts, manifest.json
- Token extraction: HIGH — globals.css contains exact classes needed, verified line by line

**Research date:** 2026-04-30
**Valid until:** 2026-05-30 (stable CSS + MV3 APIs, not fast-moving)
