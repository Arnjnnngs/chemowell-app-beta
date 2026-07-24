# 01 DEVELOPER BRIEF — Status-bar overlap in APK (Android WebView wrapper)
Role: Developer (Quality Chain stage 1). Investigation only — no code changed.
Source inspected: /tmp/chemowell/index.html (284,756 bytes; the "/tmp/app" path in the task maps to this checkout). Line numbers below are from this file.

## 1. Bug summary
The third-party APK wraps https://arnjnnngs.github.io/chemowell-app-beta/ in an Android WebView that draws edge-to-edge. The page already has `viewport-fit=cover` (line 5) but NOTHING applies `env(safe-area-inset-top)` — only bottom insets are used. On top of that, Android WebViews resolve `env(safe-area-inset-top)` to 0 unless the native wrapper explicitly forwards window insets, so even adding plain `env()` would not fix this APK. Result: the sticky header and the tour banner ("GUIDE · 4 OF 10") render under the clock/battery/signal.

## 2. Top-of-viewport elements (audit of every fixed/sticky element)

### Affected — must gain top safe-area padding
| # | Element | Line | Position | Today |
|---|---------|------|----------|-------|
| A | App header, `renderHeader()` | 1461 | `position: 'sticky', top: '0', zIndex: '20'` — in-flow, first child of the page div (rendered at 1827), so its top edge sits at viewport top | `padding: '10px 16px 12px'` on the header itself. No safe-area anywhere. The header carries the pink `#FDF1F4` background, so padding it also tints the status-bar strip (desirable). |
| B | Tour slim banner (`#tour-banner`, the "GUIDE · N OF 10" pill) | 1753 | `position: 'fixed', top: '8px'` | Hard-coded 8px — directly under the status bar. This is the exact element in Aaron's report (label built at 1755). |
| C | Tour card clamp, `positionTour()` | 1813 | JS sets `card.style.top = Math.max(8, top) + 'px'` | For targeted steps the card can clamp to 8px from viewport top → under the status bar. (Centered default at 1764, `top: 50%`, is safe.) |
| D | First-run welcome/setup, `renderSetup()` | 1605 | In-flow, `minHeight: 100vh` flex-centered page div | `padding: '24px'`. On short viewports the centered card clamps to 24px from the top → clipped by the status bar. |
| E | Time/log modal overlay (`timeModal`) | 1940 | `position: 'fixed', inset: '0'`, flex-centered, `padding: '20px'`; inner dialog (1941) `maxHeight: '100%', overflowY: 'auto'` | A tall modal grows to the overlay's 20px padding → top edge under the status bar. Secondary but same one-line fix. |

### NOT affected — leave untouched
- Bottom nav (1508): bottom-anchored, already `calc(6px + env(safe-area-inset-bottom))`.
- Plans/upgrade sheet (1680 overlay, 1681 sheet): `alignItems: 'flex-end'` bottom sheet, `maxHeight: '88vh'` keeps its top ≥ 12vh below viewport top — clear of any status bar. Already has bottom env(). No change.
- Toast (1833), Reports back-button bar (1836): bottom-anchored with bottom env(). No change.
- Loading overlay (1840): full-screen scrim with short centered content. No change.
- Tour layer wrappers (1752, 1763): `inset: 0, pointerEvents: 'none'` scrims — fine.
- `#page` paddingBottom (1826): bottom-only. No change.

## 3. Existing safe-area usage (all 6 occurrences — every one is BOTTOM)
Lines 1508 (bottom nav), 1681 (plans sheet), 1826 (page bottom padding), 1833 (toast), 1836 (reports back bar) — all `env(safe-area-inset-bottom)`. `env(safe-area-inset-top)` appears nowhere. `--safe-top` appears nowhere. No `navigator.userAgent` usage exists anywhere in the file (grepped) — the detection below is net-new.

## 4. Recommended strategy — one CSS variable, one source of truth

### Boot logic (once, before first render — e.g. right after `const TEST_MODE` at line ~42, or just before the boot `render()` at file end)
1. In the `<style>` block (lines 19–33) add the default:
   `:root { --safe-top: env(safe-area-inset-top, 0px); }`
2. In JS at boot, override ONLY when we are in an Android WebView AND env() actually resolved to 0:
   - Detection: Android WebView UA contains the `"; wv)"` token (Chrome's documented WebView UA marker: `Mozilla/5.0 (Linux; Android 13; Pixel 7 Build/...; wv) AppleWebKit/...`). Test: `/; wv\)/.test(navigator.userAgent)` (optionally `&& /Android/.test(ua)`).
   - Probe env(): append an invisible div with `padding-top: env(safe-area-inset-top, 0px)`, read `getComputedStyle(...).paddingTop`, remove it. (env() can't be read off :root directly.)
   - If `isWv && probedPx === 0`: `document.documentElement.style.setProperty('--safe-top', '28px')`.
   - Expose the resolved number as `window.__safeTop` (or a `safeTopPx()` helper that parses `getComputedStyle(document.documentElement).getPropertyValue('--safe-top')`) for the JS clamp in positionTour().
3. Fallback value: **28px**. Android status bars are 24dp classic / 24–28dp+ on cutout devices; with `width=device-width`, CSS px ≈ dp, so 28px clears virtually all devices with only ~4px extra on older ones. (Do not go below 24; 32 starts looking padded on non-cutout phones.)

### Why this never double-pads
The variable is the single source: it is EITHER `env(...)` (browsers/iOS where env works) OR the 28px literal (Android WebView where env probed 0) — the JS `setProperty` replaces the CSS default, it never adds to it. Consumers use `var(--safe-top)` only, never `env()` alongside it. The `probedPx === 0` guard means a future wrapper that DOES forward insets (env > 0) keeps the real env value and skips the fallback. Desktop browsers: not wv, env resolves 0 → `--safe-top: 0px` → all `calc(Npx + 0px)` are byte-identical layouts.

### Alternative considered and rejected: pure `env(safe-area-inset-top)`
Cleanest on paper (no JS, no UA sniffing), and correct for iOS Safari/PWA. It fails here because Android WebView only populates the safe-area env() values when the embedding native app opts in and dispatches window insets to the WebView (edge-to-edge + inset forwarding, e.g. androidx WebView inset support). A generic third-party wrapper draws edge-to-edge but forwards nothing, so `env(safe-area-inset-top)` is 0 in exactly the environment with the bug — pure env() would be a no-op in the APK while appearing to work in DevTools emulation.

## 5. Definition of DONE
Must work (in the APK):
- Header (line 1461): brand row + "?"/gear buttons fully below the status bar; the pink header background still extends up behind the status bar (padding, not margin — do NOT use margin-top).
- Tour banner "GUIDE · N OF 10" (1753) fully below the status bar on every banner step.
- Tour card (1813) never clamps its top edge above `8 + safeTop` px — clamp uses the same resolved value, not a second guess.
- Welcome/setup screen (1605): card and heart emoji never clipped on short viewports.
- Tall timeModal dialogs (1940) top out below the status bar.
Must also hold:
- Desktop/mobile browsers and the PWA: zero pixel change (`--safe-top` computes to 0px there).
- iPhone PWA/Safari: gets real `env()` top inset (a free improvement), still exactly one source.
Regressions that must NOT happen:
- Bottom nav / toast / plans sheet / reports bar spacing unchanged — do not touch any `env(safe-area-inset-bottom)` line.
- No double padding: never write `calc(env(safe-area-inset-top) + var(--safe-top))` or apply padding on both the page div (1826/1827 area) AND the header — pad the header only.
- The 1-second re-render tick (line 3870) rebuilds the DOM: the fallback must live in a CSS var + inline `var()` refs (re-created identically each render), not in one-off imperative DOM mutation that a re-render wipes. `positionTour()` runs after every render (1857), so the JS clamp naturally reapplies.
- No layout shift at boot: set the variable synchronously before the first `render()` call.

## 6. Exact patch anchors for the Lead Developer
1. Line 19–33, `<style>` block (unique anchor: `#root{min-height:100vh;}`): add `:root{--safe-top: env(safe-area-inset-top, 0px);}`.
2. Line ~42, after `const TEST_MODE = true;` (or immediately before the boot `render();` near EOF, after the tour-resume line `if (!getPrefsDB().tourDone ...`): add the wv-detect + env-probe + `setProperty('--safe-top','28px')` + `safeTopPx()` helper.
3. Line 1461, `renderHeader` (anchor: `position: 'sticky', top: '0', zIndex: '20', background: '#FDF1F4'`): `padding: '10px 16px 12px'` → `padding: 'calc(10px + var(--safe-top)) 16px 12px'`.
4. Line 1753, tour banner (anchor: `id: 'tour-banner'`): `top: '8px'` → `top: 'calc(8px + var(--safe-top))'`.
5. Line 1813, `positionTour()` (anchor: `card.style.top = Math.max(8, top) + 'px';`): → `Math.max(8 + safeTopPx(), top)`. Optionally mirror in line 1812's `Math.min(window.innerHeight - cardH - 8, ...)` — bottom edge, no change needed.
6. Line 1605, `renderSetup` page div (anchor: `justifyContent: 'center', padding: '24px'` inside renderSetup): `padding: '24px'` → `padding: 'calc(24px + var(--safe-top)) 24px 24px'`.
7. Line 1940, timeModal overlay (anchor: `zIndex: '60', padding: '20px'`): `padding: '20px'` → `padding: 'calc(20px + var(--safe-top)) 20px 20px'`.
8. Explicit no-touch list: lines 1508, 1680–1681, 1826, 1833, 1836, 1840.
