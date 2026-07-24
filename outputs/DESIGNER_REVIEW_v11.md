# DESIGNER_REVIEW_v11 — Plans-sheet flicker fix + tab persistence

Role: Designer (Quality Chain stage 3) · Date: 2026-07-24 · Build: app-v11 · Reviewed: RENDERED product at http://localhost:8877/index.html via headless Chromium (Playwright), viewports 360x740, 390x844 (DPR 2, touch), 1280x900. Zero console errors and zero page errors across every run. No code was modified.

Method note: every claim below was measured on the live DOM or verified in screenshots saved to `outputs/` (filenames inline). "Byte-identical" means two full-page PNG captures compared as buffers.

---

## Item 1 — Plans sheet: stability, entry animation, visual quality — **PASS**

**Stability watch.** Sheet opened, screenshot taken, 3-second wait, screenshot again: **byte-identical at 390x844 and again at 1280x900**. No flicker, no shimmer, no reflow, no scroll creep. (`v11-02-sheet-open-390.png` vs `v11-03-sheet-after-3s-390.png`.)

**Entry animation plays once per open, every open.** Four total open cycles measured. On each reopen the sheet's top edge was at 484–634px 40ms after the tap and settled at 101px — a real, visible slide — with `animation: sheetUp .32s cubic-bezier(0.32,0.72,0,1)` present. Close via ✕ and close via **scrim tap** both reset the animate-once flag (scrim-tap probe: reopen top@50ms = 484px, animation running). The 0.32s spring-out curve reads premium — it decelerates into place with no bounce artifact.

**Sheet internal scroll survives.** `scrollTop` set to max (122px at 390; 232px at 360) held exactly across 2.2–2.6s of tick time. Scrolled-to-bottom state at 360 (`v11-11-sheet-360-scrolled-bottom.png`): footer "Reset to Free (beta testing)" link and beta note render cleanly with comfortable 20px bottom padding.

**Reduced motion.** With `prefers-reduced-motion: reduce`, the sheet is at its final position 60ms after tap (`animation-duration: 1e-05s`) — the media-query guard works.

**Visual inspection (`v11-02-sheet-open-390.png`, `v11-10-sheet-360.png`, `v11-13-sheet-1280.png`):**
- Drag handle: 36x4px, `#DCCFD4`, pixel-centered, 12px from sheet top — correct per spec (8px padding + 4px margin).
- Close ✕: measured 44x44px circular hit area, vertically center-aligned with the 19px "Plans" title (delta 0.0px).
- Radius 22px top corners, white `#FFFFFF` body, scrim `rgba(50,25,40,0.45)` dims the ivory canvas evenly.
- Card hierarchy reads correctly: compact Free row, featured Plus (2px `#A24C71` border, `#FFF9FB` fill, "Most popular" badge, gradient CTA), outlined Pro.
- Safe-area: `padding-bottom: calc(20px + env(safe-area-inset-bottom))` — resolves to 20px in the test browser; the env() term is present for notched devices.
- 1280x900: sheet caps at 720px, centered (280px margins both sides), flush to the bottom edge, aligned with the app column. Consistent.
- No horizontal overflow at any viewport (documentElement scrollWidth delta = 0).

## Item 2 — Buy Plus in place — **PASS** (one pre-existing polish note, below)

Tapped "Simulate purchase (beta)" on Plus with the sheet open (`v11-04-before-buy-plus-390.png` → `v11-05-after-buy-plus-390.png` → `v11-06-plus-current-plan-390.png`):
- **Sheet frame did not move one pixel**: top delta 0.0px, height delta 0.0px (the sheet exceeds its 88vh cap in both states, so the outer geometry is invariant).
- No animation replay (`style.animation` empty after the re-render), scroll position preserved.
- The state swap is clean: Free card drops its green border + "✓ Current plan" line; Plus card gains the 2px `#2E7D4F` border and "✓ Current plan" replaces the CTA. One instantaneous reflow, no double-render flash from the toast show/clear cycle (verified across the 4.5s toast lifetime).
- "Reset to Free (beta testing)" restores the Free state equally cleanly.

**Polish note (pre-existing, not introduced by v11):** the confirmation toast "Plus unlocked (simulated for beta)" renders at `zIndex: 50` — *underneath* the sheet scrim (`zIndex: 70`). elementFromPoint at the toast's center hits a sheet button: the toast is fully invisible for its entire 4.5s life while the sheet is open. Feedback still exists via the in-card "✓ Current plan" swap, so this is not a FAIL of the fix, but the app is talking to nobody. **Suggestion:** toast `zIndex: '75'` (above the sheet's 70, below the tour layer's 80), or while `state.upgradeOpen` position it at `bottom: 'calc(16px + env(safe-area-inset-bottom))'` so it overlays the sheet footer rather than hiding behind the nav area.

## Item 3 — Tab restore on reload — **PASS**

Reload performed while on each tab (390: all six; 360: Meds; 1280: Reports). Every restore rendered the full header, full content, and correct nav state:

| Tab | Restored | Active tint | 4px dot | Screenshot |
|---|---|---|---|---|
| Home | yes | rgba(162,76,113,0.12) | rgb(162,76,113) | v11-07-restored-home-390.png |
| Meds | yes | same | same | v11-07-restored-meds-390.png, v11-12 (360) |
| Reports | yes | same | same | v11-07-restored-reports-390.png, v11-14 (1280) |
| In-Patient | yes | same | same | v11-07-restored-inpatient-390.png |
| Symptoms | yes | same | same | v11-07-restored-symptoms-390.png |
| Settings | yes (full Settings page) | no nav item active — correct, Settings is the gear surface | inactive dots all transparent | v11-08-restored-settings-390.png |

- `aria-current="page"` present only on the active item; inactive dots computed `rgba(0,0,0,0)` (slot reserved — no height shift). Matches the design-system nav spec exactly.
- **No flash-of-wrong-tab:** a MutationObserver injected before reload recorded every distinct active-nav value from first paint onward while reloading on Symptoms; history = `["Symptoms"]` — the first frame ever painted already showed the right tab. The sessionStorage read happens before first render; there is no Home flash.
- Garbage sessionStorage value falls back to Home (re-confirmed, matching the smoke result).
- `overscroll-behavior-y: none` computed on body; normal page scrolling unaffected; both inner scrollers (sheet, time modal) still scroll.

## Item 4 — Header tick suspension while sheet open — **PASS (unnoticeable)**

The v10 header has **no clock** (removed per Aaron); the only time-varying header elements are the date label (changes at midnight) and the dose-progress ring (changes only when a dose is logged or the day rolls over). While the sheet is open, logging is impossible — so there is literally nothing on screen whose freeze a user could perceive. Verified with a scheduled med present (`v11-15-home-with-ring-390.png`, `v11-16-sheet-with-ring-behind-390.png`): ring visible and static behind the scrim during a 5s open, resumed within 1.5s of close, zero errors. The one theoretical seam — sheet held open across midnight freezes the date label until close — is not worth engineering around. Judgment: the suspension is the right call and is invisible in practice.

## Item 5 — Polish sweep of touched surfaces — **PASS**

- **Sheet:** premium. Spacing rhythm (10px card gap, 16px card padding, 12px subtitle margin) is consistent; typography follows TYPE scale; price value/suffix split reads well; nothing below 12px.
- **Nav on restore:** active state (tint + dot + `#8E3D61` text) identical to in-session navigation — no restore-specific styling drift at any of the three viewports.
- **Settings (360/390):** `v11-09-settings-360.png`, `v11-08-restored-settings-390.png` — clean cards, 44px+ buttons ("+ Add profile", "View plans"), "Free plan" chip and Active badge aligned; no truncation at 360.
- Suggestions (with exact values):
  1. Toast z-index while sheet open — see Item 2 (`zIndex: '75'`). Severity: low, pre-existing.
  2. Nothing else. The decorative (non-draggable) handle is a documented spec decision (scrim tap + ✕ both dismiss); the desktop bottom-sheet presentation is consistent with the 720px app column and acceptable.

---

## Verdict summary

| # | Item | Verdict |
|---|---|---|
| 1 | Sheet stability + once-per-open animation + visual quality | **PASS** |
| 2 | Buy Plus updates in place, no visual jump | **PASS** |
| 3 | Tab restore incl. nav state, no boot flash | **PASS** |
| 4 | Tick suspension visibility | **PASS — unnoticeable** |
| 5 | Polish sweep of touched surfaces | **PASS** |

**FAILs: none.** One low-severity, pre-existing suggestion carried forward: purchase/reset toast hidden behind the sheet scrim (`zIndex` 50 vs 70) — recommend toast `zIndex: '75'` in a future pass through the chain. Zero console/page errors across all runs; no horizontal overflow at 360/390/1280.

Screenshots: `outputs/v11-01` … `v11-16` as referenced above.
