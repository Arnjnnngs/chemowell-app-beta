# DESIGNER_REVIEW_v17 — Tour banner/target green attention treatment (border + pulse)

Role: Designer (Quality Chain stage 3) · Date: 2026-07-26 · Build: app-v17 · Reviewed: RENDERED product at http://localhost:8917/index.html via Chromium (Playwright), first-run flow (no seeded localStorage), viewports **360x740, 390x844** (primary, DPR 2, touch), **1280x900** (secondary), plus keyboard-open heights 360x400 / 390x480. No code was modified. 78 screenshots saved to `outputs/v17-screenshots/`.

Method note: every visual claim below is backed by either a screenshot (filenames inline) or a live `getComputedStyle()` probe against the running DOM (values quoted inline) — not eyeballing alone, since the pulse's actual amplitude turned out to be too subtle to reliably judge from timed screenshots (see Item 2). Zero console errors traceable to this change; the only failed network requests are pre-existing Capacitor CDN script loads blocked by the sandbox proxy (`cdn.jsdelivr.net/npm/@capacitor/...`), unrelated to `index.html`/this ticket and present on a bare page load with no tour interaction.

---

## Item 1 — Banner + target both get a visible green border/outline on every applicable step — **PASS**

Walked the full 10-step tour from a genuinely fresh first run (name entry → "Show me" → tap Meds → tap Add → fill + save a medication → tap Home → Next ×4 → Finish), verifying `applyTourHighlight()`'s green treatment lands correctly at every step with a `target`:

| Step | Target | Mode | Screenshot |
|---|---|---|---|
| 0 | none (welcome) | centered card | `w390-00-tour-step0-centered-card.png` |
| 1 | `nav-meds` | banner | `w390-01a...png` |
| 2 | `meds-add` | banner | `w390-02a...png` |
| 3 | `med-editor` | banner | `w390-03a...png`, scrolled: `w390-03d-tour-step3-mededitor-scrolled.png` |
| 4 | `nav-home` | banner | `w390-04a...png` |
| 5 | `quick-log` | centered card | `w390-05a...png` |
| 6 | `nav-reports` | centered card | `w390-06a...png` |
| 7 | `nav-inpatient` | centered card | `w390-07a...png` |
| 8 | `nav-symptoms` | centered card | `w390-08a...png` |
| 9 | none (finish) | centered card | `w390-09...png` |

All 8 targeted steps highlight correctly, advance correctly on real taps (not simulated events), and the highlight tracks the live re-queried element exactly as the rose version did — no regression to tour logic, Skip/Back/Next/Got it/Finish all behaved as expected. `#2E7D4F` (confirmed via `getComputedStyle` = `rgb(46,125,79)`) is used for both banner/card border and target outline, and is literally the same token already used at Plans-sheet "current plan" (line 1688/1703/1717) and the med-manager "Active" badge (line 3184) — no new color introduced, source-verified identical hex, not just visually similar.

At **rest/peak** (full alpha), the green reads clean and unambiguously "success/medical," not clashing with the ivory/rose palette — see the welcome-card border in `w390-00...png`. This part of Aaron's request is solidly delivered: the banner no longer blends into the rose chrome around it.

## Item 2 — Pulse amplitude/contrast — **FAIL (concrete fix below)**

This is the most important finding in this review, and it required going past screenshots to the computed animation, because two screenshots 1–2s apart alone were not a reliable signal (see below for why).

**What's actually happening:** `@keyframes tourPulse{0%{outline-color:rgba(46,125,79,1)}50%{outline-color:rgba(46,125,79,0.3)}100%{outline-color:rgba(46,125,79,1)}}` animates the outline's **alpha**, cycling continuously between 1.0 and 0.3 every 1.6s. I polled `getComputedStyle(el).outlineColor` on the live tour target at 40–200ms intervals across multiple steps and confirmed it's genuinely animating (not stuck): values sweep the full 1.0→0.3→1.0 range every cycle, and the phase-synced negative `animation-delay` technique (`DEV_BRIEF_v17.md` §2.2) works exactly as designed — no once-a-second "snap" across ticks, confirmed by sampling `animationDelay` across 8 consecutive 500ms render ticks (each returns a distinct, wall-clock-consistent delay, e.g. `-0.375s → -1.375s → -1.375s → -0.775s → -0.175s → -1.175s`, never resetting to `0s`).

**The problem is the floor, not the mechanism.** I computed WCAG contrast for the outline color at each alpha step against the three backgrounds it actually sits on:

| outline-color alpha | vs. white nav bar / banner card | vs. med-editor's translucent rose card (~`#FEFBFB` effective) |
|---|---|---|
| 1.0 (peak) | 5.05:1 | 4.90:1 |
| 0.7 | 2.88:1 | 2.84:1 |
| **0.5** | **2.05:1** | **2.03:1** |
| **0.3 (trough)** | **1.51:1** | **1.50:1** |

WCAG 2.1 SC 1.4.11 (non-text contrast, applies to UI component boundaries like this outline) requires **3:1**. The keyframe's midpoint (alpha 0.3) sits at **1.51:1** — a 50%+ shortfall — and roughly half of every 1.6s cycle is spent below the 3:1 floor (alpha needs to be **≥0.75** to clear 3:1; the keyframe only clears that for a small fraction of each cycle, near the 0%/100% endpoints).

I captured this directly with paired peak/trough screenshots (grabbed by polling the live alpha and snapping the instant it crossed >0.95 or <0.35, not on a fixed timer):

- `w390-11a-navmeds-pulse-PEAK-alpha0.95.png` vs. `w390-11b-navmeds-pulse-TROUGH-alpha0.33.png` — the Meds tab's ring is bold and unmistakable at peak; at trough it fades to a pale sage that's nearly camouflaged against the white nav bar.
- `w390-12-medsadd-pulse-PEAK-alpha0.95.png` vs. `w390-12-medsadd-pulse-TROUGH-alpha0.31.png` — same pattern around the "+ Add" button.
- `w390-13-mededitor-pulse-PEAK-alpha0.98.png` vs. `w390-13-mededitor-pulse-TROUGH-alpha0.33.png` — same pattern around the med-editor section, which sits on the translucent rose card background the brief specifically flagged for contrast verification (§8, open question 2).

**Why my first pass of screenshots (1–2s apart) didn't catch this cleanly:** at those intervals the samples landed near-random points in the 1.6s cycle and several by chance landed near full alpha, making the pulse look more consistent than it is. The peak/trough capture (triggered by the actual computed value, not a timer) is the reliable evidence here.

**Practical impact:** the banner/card chrome itself is safe — it keeps a static, non-animated `border: 3px solid #2E7D4F` underneath the pulsing outline (see Item 3), so the banner never disappears. But the **target highlight** — the outline-only treatment on `nav-meds`, `meds-add`, `med-editor`, `nav-home`, `quick-log`, `nav-reports`, `nav-inpatient`, `nav-symptoms` — is exactly what Aaron asked for first ("a green border around... whatever tab/element it's currently directing the user to tap") and it periodically nearly vanishes against the white/near-white surfaces those targets sit on. For a chemo patient scanning quickly and not staring continuously at one spot, there's a real chance their glance lands during a trough.

**Suggested fix (exact values):** raise the pulse's minimum outline-color alpha from **0.3 to 0.75** in the `tourPulse` keyframe (`index.html` line 33):
```css
@keyframes tourPulse{0%{outline-color:rgba(46,125,79,1)}50%{outline-color:rgba(46,125,79,0.75)}100%{outline-color:rgba(46,125,79,1)}}
```
This keeps the pulse perceptible (peak 1.0 → trough 0.75 is still a visible "breathing" swing — roughly a 3.4:1 → 5:1 contrast range, i.e. always at or above AA's 3:1 non-text floor) without ever dropping below usable contrast. If a stronger pulse is still wanted after this fix, prefer widening the *range of values it swings between* while keeping the floor ≥0.75 over lowering the floor again.

## Item 3 — Double-ring visual treatment on banner/card — minor aesthetic note, not a FAIL

The banner and card both carry **both** a static `border: 3px solid #2E7D4F` **and** a separately-offset `outline: 3px solid #2E7D4F; outline-offset: 2px` (pulsing). Because the outline sits 2px outside the border, the two render as **two concentric green rings with a visible gap between them**, not one unified glow — clearly visible in a magnified crop of the top edge (`/tmp` crops reviewed during this pass; visible directly in any banner/card screenshot, e.g. `w390-01a...png`, `w1280-01a...png`).

This isn't broken, and it reads as intentional/bold rather than glitchy, but it's a "sticker border" look rather than the soft attention-glow the Owner's request implied, and it's a different visual language than the rest of the app's calm, hairline-bordered card system (`DESIGN_SPEC_B23.md`'s "no glassmorphism... solid white cards with hairline borders"). Two suggestions, either is sufficient — pick one, don't stack both fixes:

1. **Cheapest:** set `outlineOffset: '0px'` on the banner/card (currently `'2px'` at lines 1818, 1829) so the outline sits flush against the border and the two merge into one solid-looking ring instead of two.
2. **Closer to the brief's original recommendation** (`DEV_BRIEF_v17.md` §3: "a `box-shadow`-based glow... is layout-inert... recommended over animating `outline-width`"): drop the separate `outline` on the banner/card entirely and animate a soft `box-shadow: 0 0 0 Npx rgba(46,125,79,alpha)` instead, which diffuses rather than hard-edges — reads calmer for anxious users and matches "glow" more literally than a second hard ring does. Note this only applies to the banner/card frame (which already has its own static border); the **target** highlights (nav tabs, Add button, med-editor section) should keep the current `outline` approach since a `box-shadow` there would need to follow each target's own border-radius and risks bleeding into adjacent nav items at 360px — outline is the right primitive there, it just needs the Item 2 floor fix.

## Item 4 — `prefers-reduced-motion` — **FAIL (real defect, not present in DEV_BRIEF's analysis)**

`DEV_BRIEF_v17.md` §2.4 asserted the existing global rule (`@media (prefers-reduced-motion: reduce){*{animation-duration:0.01ms !important}}`) would be sufficient with no new code, citing the `sheetUp` precedent. **This holds for `sheetUp` (a one-shot, finite animation) but not for `tourPulse`, because `tourPulse` is `infinite` with a computed negative `animation-delay`** — this is, as the brief itself noted, the first infinite-iteration animation in the codebase, and it breaks the assumption in a way finite animations don't.

Forcing `animation-duration` to `0.01ms` on a **finite** animation just makes it complete (and land on its final frame) almost instantly — that's why `sheetUp` freezes cleanly. Forcing it on an **infinite** animation doesn't freeze anything: the animation still loops, just ~160,000 times per second instead of once every 1.6s. I verified this is not just theoretical — polling `getComputedStyle(el).outlineColor` with reduced-motion emulated, **40ms apart**, on the same target element:
```
0  rgb(46, 125, 79)              (alpha 1.0)
1  rgba(46, 125, 79, 0.85)
2  rgb(46, 125, 79)
3  rgba(46, 125, 79, 0.85)
4  rgba(46, 125, 79, 0.518)
5  rgba(46, 125, 79, 0.518)
6  rgba(46, 125, 79, 0.345)
7  rgb(46, 125, 79)
8  rgba(46, 125, 79, 0.85)
9  rgba(46, 125, 79, 0.518)
```
The computed color jumps unpredictably between full and faded green from one 40ms sample to the next — the negative-delay phase-sync math becomes numerically unstable once duration collapses to near-zero (huge iteration counts, floating-point modulo noise). In practice, on a real display, this would repaint as visible flicker/jitter on the highlight rather than the calm, static, non-animated state `prefers-reduced-motion` is supposed to guarantee. For a medical app, this is a meaningful miss: some users enable reduced-motion specifically because flashing/flickering effects are a health concern for them, and this bug means the highlight could flicker *specifically* for that population, which is the opposite of the intended safeguard. (Two full-page screenshots 1.2s apart under reduced motion, `w390-10a...png`/`w390-10b...png`, happened to both land on high-alpha frames and look identical/static — this is the same "screenshot timing got lucky" trap as Item 2; the computed-style probe is the reliable signal here, not the screenshots.)

**Suggested fix:** don't rely on the global CSS override for the pulse specifically — check the media query in JS where the animation is applied, and skip animating entirely when reduced motion is preferred:
```js
const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function tourGlowAnim() {
  if (prefersReducedMotion()) return {}; // static outline-color already set by applyTourHighlight/border; no animation properties at all
  return { animation: 'tourPulse ' + TOUR_PULSE_MS + 'ms ease-out infinite', animationDelay: tourPulseDelay() };
}
```
This is a small, self-contained change at the same call site already identified in the brief, and it makes the reduced-motion path do what it was always intended to do: render the static full-alpha green border/outline with zero animation, full stop.

## Item 5 — Occlusion, layout, touch targets, spacing — **PASS**

- **No horizontal overflow** at any tested width: `360x740`, `390x844`, `1280x900`, and the keyboard-open heights `360x400` / `390x480` all measured `scrollWidth === clientWidth` (verified via `document.documentElement`, not visual inspection alone).
- **Banner stays pinned**, `top: calc(8px + var(--safe-top))` unchanged, confirmed via `getBoundingClientRect()` at both 390 and 1280 (`rectTop: 8` in both). The banner's outline extends 5px beyond its box (2px offset + 3px width); at `top:8px` that leaves it 3px of clearance from the viewport edge — tight but genuinely not clipped, confirmed with a magnified pixel crop of the top-left corner at both 390 and 1280 (a thin strip of ivory background is visible above the ring in both). Not a regression, not touched by this ticket's scope, just noting it's a close margin worth keeping in mind if the border/outline weight ever grows further.
- **Med-editor at keyboard-open height (360x400 / 390x480):** the dev brief specifically flagged this as worth confirming (§3) — the med-editor section is mostly scrolled off-screen at this height, and the small sliver of its highlight that's visible peeking above the bottom nav is just a clean rounded corner arc, not a jagged or distracting clipped edge (`keyboard-open-360x400-mededitor.png`, `keyboard-open-390x480-mededitor.png`). Confirmed as harmless, per the brief's prediction.
- **`tourClearHighlight()` correctly resets the animation on tour end.** Tapped "Skip" mid-tour and inspected the last-highlighted element's computed style immediately after: `outline: 'rgb(110, 90, 100) none 0px'` (i.e., cleared/none), `animationName: 'none'`, and both `el.style.outline`/`el.style.animation` (inline) are empty strings. No stray pulsing element left behind after Skip/Finish — landmine #2 from the brief was correctly handled.
- **Touch targets/spacing unaffected**, as expected from a style-only change: "More"/"Skip"/"Next"/"Back"/"Got it" buttons all still measure 44px+ minHeight in every screenshot, nav items unchanged at 56px, no reflow anywhere the highlight was added.

---

## Verdict summary

| # | Item | Verdict |
|---|---|---|
| 1 | Green border/outline present on banner + every targeted step | **PASS** |
| 2 | Pulse contrast/visibility across its full cycle | **FAIL** — floor alpha 0.3 → ~1.5:1 contrast at trough, well under the 3:1 non-text minimum, for roughly half of every cycle. Fix: raise floor to **0.75** in the `tourPulse` keyframe (line 33). |
| 3 | Banner/card double-ring aesthetic | Minor note, not blocking — pick one: `outline-offset: 0` to merge the rings, or box-shadow glow per the brief's original §3 recommendation. |
| 4 | `prefers-reduced-motion` actually freezes the pulse | **FAIL** — infinite animation + forced near-zero duration does not freeze, it flickers (confirmed via live polling). Fix: gate `tourGlowAnim()` on `matchMedia('(prefers-reduced-motion: reduce)')` in JS rather than relying on the CSS `!important` override for this specific infinite-iteration case. |
| 5 | Occlusion / layout / touch targets / spacing | **PASS** — no overflow, no clipping, no regression, clean reduced-motion-adjacent cleanup on Skip/Finish. |

**Overall: FAIL, back to the Lead Developer for two concrete, narrowly-scoped fixes** (Items 2 and 4). Both are small, well-isolated changes — one keyframe value, one `matchMedia` guard at an existing call site — not a redesign. Item 1's core ask (a clearly visible, on-brand green border replacing the low-contrast rose) is genuinely delivered and should not be touched; Item 3 is optional polish, not a blocker. Per `TEAM.md`'s restart rule this technically sends the whole ticket back to Developer stage 1, but the Owner's amendment for minor exact-value items (a px/alpha value) allows the Lead Developer to fix and have this stage re-verify without a full chain restart — I'd characterize both Item 2 and Item 4 as exactly that class of fix (one CSS value, one small JS guard), not a fresh-brief-required redesign.

Screenshots: `outputs/v17-screenshots/w360-*`, `w390-*`, `w1280-*` (full tour walkthrough), `w390-11/12/13-*-PEAK/TROUGH-*` (pulse contrast evidence), `keyboard-open-*` (occlusion check at keyboard heights), `w390-14-medmanager-active-badge-greentoken-compare.png` (existing green-token usage for consistency reference).

---

## RE-VERIFICATION (2026-07-26, same day) — Items 2 and 4 only

Per the fail-fast amendment (`TEAM.md`), the Lead Developer applied two scoped, exact-value fixes in `index.html` (verified at the source level first, then re-checked against the live server at http://localhost:8917/index.html, same method as the original review — live `getComputedStyle()` polling, not just screenshots on a timer). No other surface was touched or re-checked; this is a targeted re-verification, not a full re-review.

### Item 2 re-check — pulse contrast floor — **now PASS**

Source confirms the keyframe changed exactly as described: `@keyframes tourPulse{0%{outline-color:rgba(46,125,79,1)}50%{outline-color:rgba(46,125,79,0.75)}100%{outline-color:rgba(46,125,79,1)}}` (`index.html` line 33).

Recomputed WCAG contrast at the new floor (alpha 0.75) against the same three surfaces checked originally:

| outline-color alpha | vs. white nav bar | vs. med-editor's translucent rose card |
|---|---|---|
| 1.0 (peak) | 5.05:1 | 4.90:1 |
| **0.75 (new trough)** | **3.15:1** | **3.10:1** |

Both now clear the 3:1 WCAG 2.1 SC 1.4.11 non-text-contrast minimum — with a modest but real margin (~0.10–0.15 above the line, not a hairline pass at exactly 3.00). Ease-out timing between keyframes does not overshoot past the specified 0.75/1.0 values (standard monotonic easing, confirmed no color-interpolation overshoot), so the floor holds throughout the cycle, not just at the sampled keyframe instant.

Verified live on the running server, not just computed on paper: polled `getComputedStyle(el).outlineColor` on the `nav-meds` target every 60ms across a full 3.2s window (2 full pulse cycles). **Observed range: min alpha 0.750, max alpha 1.000** — exactly matches the new keyframe, no excursions below the new floor. Captured peak/trough screenshots triggered by the live computed value (not a fixed timer):
- `w390-15a-navmeds-pulse-PEAK-refixed-alpha0.96.png` — bold, saturated ring.
- `w390-15b-navmeds-pulse-TROUGH-refixed-alpha0.77.png` — still a clean, solidly legible green ring at the dimmest point of the cycle; a visible "breathing" dip in intensity from the peak, but never approaches the near-invisible pale-mint appearance from the pre-fix trough (`w390-11b-navmeds-pulse-TROUGH-alpha0.33.png`, kept in the folder for side-by-side comparison). The pulse still reads as a pulse — it did not get fixed into flatness.

**Item 2: PASS.**

### Item 4 re-check — `prefers-reduced-motion` — **now PASS**

Source confirms the new guard: `prefersReducedMotion()` (line 1805) checks `window.matchMedia('(prefers-reduced-motion: reduce)').matches` in a try/catch; `tourGlowAnim()` (line 1810) returns `{}` (no `animation`/`animationDelay` keys at all) when true; `applyTourHighlight()` (line 1814) explicitly sets `el.style.animation = ''` in the same branch rather than setting an animation and hoping the CSS override neutralizes it.

Verified live with the same emulated-reduced-motion + tight-polling method as the original finding: sampled `getComputedStyle()` on both the `nav-meds` target and `#tour-banner` every **40ms for 1 full second** (25 samples). Every single sample across both elements returned:
- `animationName: 'none'` (not just a near-zero duration — the animation is genuinely absent, confirming `tourGlowAnim()`/`applyTourHighlight()` skipped setting it rather than relying on the global `!important` duration override)
- `outlineColor: 'rgb(46, 125, 79)'` — full-opacity green, constant, zero variation across all 25 samples (previously this jumped between ~0.3 and 1.0 alpha from one 40ms sample to the next)
- inline `el.style.animation` empty string, confirming the JS-level skip (not a CSS cascade fight)

No flicker, no jitter, fully static, on both the target highlight and the banner. This directly addresses the photosensitivity concern raised in the original finding.

**Item 4: PASS.**

### Re-verification verdict

| # | Item | Original | Re-verified |
|---|---|---|---|
| 2 | Pulse contrast floor | FAIL (1.51:1 at trough) | **PASS** (3.10–3.15:1 at new 0.75 trough, confirmed live) |
| 4 | `prefers-reduced-motion` freezes the pulse | FAIL (flicker, alpha jumping every 40ms) | **PASS** (`animationName: 'none'`, constant full-opacity green, 25/25 samples static) |

**Both previously-blocking findings are resolved and confirmed against the live rendered product, not just the source diff.** Item 1 (green treatment present, correctly targeted) and Item 5 (occlusion/layout/touch-targets) were PASS in the original review and untouched by this fix — no need to re-run them. Item 3 (double-ring aesthetic) was a non-blocking suggestion, also untouched, still open as optional polish.

**Updated overall verdict: PASS.** This ticket is clear to proceed to the next stage of the chain (Lead Designer).

Additional screenshots from this pass: `w390-15a-navmeds-pulse-PEAK-refixed-alpha0.96.png`, `w390-15b-navmeds-pulse-TROUGH-refixed-alpha0.77.png`.
