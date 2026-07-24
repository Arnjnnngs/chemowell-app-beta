# 02 — COMBINED VERIFICATION (Designer + QA User Zero + Auditor) — app-v15 safe-area fix

Verifier: independent combined pass (did not write the fix). Date: 2026-07-24.
Fix under test: `--safe-top` CSS var (env(safe-area-inset-top,0px) default; 28px WebView-only override).

## 1. CODE AUDIT — PASS
Source: /tmp/fix/index.html (3925 lines).

- **Single-source guarantee**: `:root{--safe-top:env(safe-area-inset-top,0px);}` (line 21). Override at line 57 uses `setProperty('--safe-top','28px')` — a custom-property REPLACE, never a sum. Override fires only when `isWebView && measured === 0`, i.e. exactly when env contributed 0. No code path stacks env + 28px. Confirmed: with override active, header padding-top computed to 38px = 10 + 28 (not 10 + 28 + env).
- **Probe hygiene** (lines 49-58): probe is `visibility:hidden;pointer-events:none`, appended to documentElement, measured, then `probe.remove()`. Whole IIFE wrapped in try/catch. Nit (not a defect): if getComputedStyle threw mid-probe, the inert hidden probe would leak — cosmetic-zero impact.
- **Hoisting check**: `initSafeTop` IIFE runs before `isNativeApp`'s textual definition, but `isNativeApp` is a function declaration in the same module scope — hoisted, so the `typeof isNativeApp === 'function'` guard resolves correctly. The `/; wv\)/` UA test additionally covers CDN-blocked Capacitor.
- **safeTopPx()** (lines 60-62): parseFloat of computed `--safe-top` ("0px"/"28px" → 0/28), isNaN→0. Verified live: returned 28 with override active.
- **Fixed/sticky element sweep** (all matches of position fixed/sticky):
  - L52 probe — self-removed. OK
  - L1482 sticky header — `calc(10px + var(--safe-top))`. COVERED
  - L1529 bottom nav — bottom-anchored, `env(safe-area-inset-bottom)` UNTOUCHED. OK
  - L1701 plans sheet overlay — inset:0 but content bottom-anchored (flex-end); dim scrim under status bar is by design. OK
  - L1773/1774 tour banner — `top: calc(8px + var(--safe-top))`. COVERED
  - L1784/1785 tour card — centered, then clamped L1834 `Math.max(8 + safeTopPx(), top)`. COVERED
  - L1854 toast, L1857 reports pill — bottom-anchored env(bottom). UNTOUCHED. OK
  - L1861 loading overlay — full-screen centered spinner, transient. OK
  - L1961 time-modal overlay — `padding: calc(20px + var(--safe-top)) 20px 20px`. COVERED
  - L1626 welcome screen (renderSetup, L1624) — `padding: calc(24px + var(--safe-top)) 24px 24px`. COVERED
  - **No top-anchored fixed element was missed.**
- **sw.js**: `const CACHE = 'chemowell-app-v15'` — bumped. OK
- **README.md**: app-v15 row present (line 14), describes fix + LEAN chain. OK

## 2. DESKTOP REGRESSION — PASS
Fresh tab → https://arnjnnngs.github.io/chemowell-app-beta/?cb=leanv15
- v15 live: outerHTML contains `initSafeTop` (no CDN staleness; no wait needed).
- `--safe-top` computes to **0px**. Header rect top = 0, padding-top = **10px** (baseline). Brand text top = **10.0px**. No mystery gap; layout identical. Screenshot taken (ss_5660iptlz): header flush at top, bottom nav normal.

## 3. SIMULATED WEBVIEW — PASS
Set `--safe-top: 28px` via setProperty in the live tab.
- Header brand text: **10.0px → 38.0px, delta exactly 28.0px**; header box still at y=0 (padding grows, no layout jump). padding-top computed **38px** — proves replace-not-sum.
- Guide banner: advanced tour (Show me → step 2 "Tap Meds"). `#tour-banner` computed `top: 36px`, rect top **36.0px = 8 + 28** — clears the simulated status-bar zone exactly. Screenshot (ss_3665d8e63).
- Tour card clamp: step-2 "More" card rendered at top **525px** near its Meds-tab target; `Math.max(36, 525)` correctly leaves it alone. Clamp floor (36px) verified in code + safeTopPx()=28 live.
- Page fully usable throughout; no double-gap anywhere.
- LIMITATION: `resize_window(390x844)` did not take effect (viewport stayed 1600x842 — window likely maximized/OS-constrained). Measurements are width-independent (fixed-px paddings), but a true 390px-wide visual pass was not possible in this environment. Screenshots are at 1600px width.

## 4. FIRST-RUN SPOT-CHECK — PASS (code-level only)
This is a shared test browser with live first-run state ("Day One Test" profile, tour unstarted) — **not wiped**. Welcome screen verified by source inspection only: renderSetup (L1624) top padding `calc(24px + var(--safe-top))` (L1626). Honest limitation: welcome screen was not rendered live.

## Cleanup (shared browser)
Non-destructive: tour advanced 1→2 during banner test, then restored (`tourStep` 1→0 in chemowell-app-p-p1-prefs-v1) and page reloaded. Post-reload verified: --safe-top 0px, brand top 10px, tour back at "Step 1 of 10". No data created or deleted.

## Minor observations (non-blocking, no action required)
1. 28px is a heuristic; devices with taller status bars (>28px) that still report env=0 in-WebView would remain slightly tight. Standard Android status bar ≈24-28dp — acceptable per brief.
2. Tour banner at top:36px overlays the sticky header's title text — pre-existing floating-banner design, not a v15 regression.
3. Probe leak on mid-probe exception (see audit) — theoretical, inert.

## 5. VERDICT: **PASS**
No MAJOR defects. All five consumption sites verified (3 live-measured, header/banner/card; 2 code-verified, welcome/time-modal per non-destructive constraint). Desktop regression zero. Chain may proceed.
