# DEV_BRIEF_v17 — Tour banner + target attention treatment (green border, pulse feasibility, arrow fallback)

Role: Developer (Quality Chain stage 1) · Date: 2026-07-26 · Target: APP-BETA (`chemowell-app-beta`)
Scope: Owner-reported — the guide/tour banner doesn't grab attention during the guided tour.
**No code was modified for this brief.** All line numbers refer to `index.html` at app-v16, commit
`c3e51cb` (3885 lines).

---

## 0. Owner's report (verbatim / paraphrased from task)

> The guide/tour banner blends in too much and doesn't grab attention while going through the guided
> tour.

Ranked preferences:
1. A green border around the banner box itself, **and** around whatever tab/element it's currently
   directing the user to tap.
2. A pulse animation on that border/highlight — flagged by Aaron himself as possibly too big a lift;
   must respect `prefers-reduced-motion` (reuse the existing global guard).
3. Fallback if pulse is too much: a green arrow pointing at the target element instead.

Hard constraint: the banner must **stay pinned at the top of the header** — this is the app-v12
tour-occlusion fix (README row, `outputs/QA_USER_ZERO_v12.md`) and must not be undone. This request is
additive visual weight only, not a reposition.

---

## 1. Current behavior — how the tour actually renders (read in full before changing anything)

### 1.1 The tour already highlights its current target — just not in green, and not pulsing

This is the single most important finding: **request #1's second half ("border around whatever
tab/element it's directing the user to tap") is already implemented.** `positionTour()` (1820–1855)
already outlines the live target element on every render:

```js
// banner mode, 1834–1837
if (step.target) {
  const targetEl = document.querySelector('[data-tour="' + step.target + '"]');
  if (targetEl) { targetEl.style.outline = '3px solid #E0679A'; targetEl.style.outlineOffset = '3px'; window.__tourHighlighted = targetEl; }
}
```

```js
// card mode, 1841–1845
const el = document.querySelector('[data-tour="' + step.target + '"]');
if (!el) return;
el.style.outline = '3px solid #E0679A';
el.style.outlineOffset = '3px';
window.__tourHighlighted = el;
```

`#E0679A` is a rose/pink tone very close to the app's own AA-rose accent family (`#A24C71`/`#8E3D61`)
and the banner's own border tint (`rgba(170,83,117,0.4)`) — this is very likely *why* Aaron says it
"blends in": the highlight color is already close in hue to the surrounding chrome (header, banner
border, active-nav tint all live in the same rose family), so a rose-on-rose highlight reads as part of
the design system rather than as an alert. **No new plumbing is needed to find/mark the target** — the
`data-tour` attribute mechanism already exists and already resolves the right element for every step
(see 1.3). The fix for request #1 is substantially a **color + weight change to two existing lines**,
not new targeting logic.

`tourClearHighlight()` (1777–1782) already resets `outline`/`outlineOffset` to `''` when the tour ends
or steps change — the reset path for any highlight styling already exists and is exercised.

### 1.2 The banner itself

`renderTourLayer()` (1783–1819) renders one of two things depending on `state.tourStep` and the local
module flag `tourExpanded`:

- **Banner mode** (formStep — a step with a `short` field — and not expanded): a slim strip,
  `id: 'tour-banner'`, `position: fixed`, `top: calc(8px + var(--safe-top))`, centered, `zIndex: 80`,
  **`border: '2px solid rgba(170,83,117,0.4)'`** (1793) — a translucent rose border at 40% opacity.
  This is the "blends in" surface Aaron is describing.
- **Card mode** (everything else, or "More" tapped): a centered modal dialog, `id: 'tour-card'`, same
  border treatment (`'2px solid rgba(170,83,117,0.4)'`, 1804).

Both are rebuilt fresh by `renderTourLayer()` on every call to `render()` — there is no persistent DOM
node here; the whole `#tour-layer` div is a new element tree every single render pass (this is true of
the entire app — see 1.4).

### 1.3 Target resolution — `data-tour` attribute, already correct and complete

`TOUR_STEPS` (1744–1755) declares a `target` string per step: `null`, `'nav-meds'`, `'meds-add'`,
`'med-editor'`, `'nav-home'`, `'quick-log'`, `'nav-reports'`, `'nav-inpatient'`, `'nav-symptoms'`. Every
one of those strings has a matching `data-tour` attribute already present in the DOM:

| target | element | line |
|---|---|---|
| `nav-meds`/`nav-home`/`nav-reports`/`nav-inpatient`/`nav-symptoms` | bottom-nav buttons, generated dynamically as `'data-tour': 'nav-' + item.key` | 1554 (`renderBottomNav`) |
| `meds-add` | the Meds tab "Add" button | 3126 |
| `med-editor` | the whole inline med-editor `<section>` | 2987 |
| `quick-log` | the Home "Quick log" section label | 2634 |

`positionTour()` re-queries `document.querySelector('[data-tour="…"]')` fresh on every call — it never
caches the element (matches the stale-element-ref precedent already documented in
`outputs/DEV_BRIEF_v11.md` §4.1, "`positionTour()` re-querying every render"). **Adding a green
border/pulse to the target does not require adding `data-tour` to any new element** — every target the
tour currently addresses already carries the attribute.

### 1.4 Render model and the tick loop — the actual landmine

`render()` rebuilds the entire DOM from scratch every pass (`root.innerHTML = ''; root.appendChild(page)`),
then calls `positionTour()` (1888, 1897) to (re-)apply the highlight to whatever fresh element now
matches the current target. The 1-second tick (3851–3860):

```js
setInterval(() => {
  state.now = simNow();
  const activeTag = document.activeElement && document.activeElement.tagName;
  const isEditing = activeTag === 'INPUT' || activeTag === 'SELECT' || activeTag === 'TEXTAREA';
  // upgradeOpen joins timeModal in the tick guard (v11): rebuilding the plans sheet every second
  // replayed its 320ms sheetUp entry animation and reset its internal scroll...
  if (!state.timeModal && !state.upgradeOpen && !isEditing) render();
  checkNotifications();
}, 1000);
```

**The tour has no tick-guard exemption today**, and doesn't need one for what it does today, because
everything it currently applies (`outline`, `outlineOffset`, the banner's static `border`) is a
*static* style — re-applying the same value to a freshly-created element every second produces zero
visible difference. That is exactly why this bug class has never surfaced for the tour before.

A **looping CSS animation is different in kind**, and this is precisely the failure mode
`outputs/DEV_BRIEF_v11.md` / `outputs/AUDIT_v11.md` document for the Plans sheet: `renderTourLayer()`
and the target element are both **brand-new DOM nodes every render pass**. Any `animation: pulse 1.6s
infinite` applied to a node that gets destroyed and recreated every 1000ms will have its animation
clock reset to `0%` on every tick — for a one-shot animation (the sheetUp precedent) that produced a
visible "replay" every second; for an *infinite* pulse it is worse in one sense (it never stops
happening) but the visual signature differs: instead of one full replay, you get a periodic "snap back
to the start-of-cycle state" roughly once a second, forever, for as long as that tour step is showing.
Confirmed empirically for context: grep for `@keyframes`/`animation:` in the whole file returns exactly
one entry point — `sheetUp` (line 32) plus its own tick-guard fix — no other looping animation exists
anywhere in this app to compare against, so this would be the first `infinite`-iteration animation the
codebase has ever shipped.

---

## 2. Feasibility verdict on the pulse (request #2)

**Verdict: feasible, and recommended as primary — but it is not a drop-in CSS `@keyframes` block the
way `sheetUp` was. It needs one specific piece of engineering to avoid the exact flicker-on-tick bug
class v11 fixed, and there are two valid ways to get there.**

### 2.1 Why a naive keyframe pulse would flicker (confirmed risk)

Same root cause as the Plans-sheet bug, applied to a different animation shape:
- `state.tourStep != null` can persist across many ticks — a user reading a "wait" step (e.g. step 3,
  "Fill in the details," `wait: 'Save the medication to continue'`) can sit on that step for a minute
  or more while filling out the med form.
- Every one of those ticks calls `render()` (no exemption today) → `renderTourLayer()` returns a new
  `#tour-banner` node, and `renderBottomNav()`/the med-editor section return new nodes too →
  `positionTour()` re-applies the highlight to the new target node.
- If either the banner's border-glow or the target's outline uses `animation: … infinite`, that
  animation restarts from `0%` on the new node every ~1000ms — a visible once-a-second "hitch" in the
  glow, for the entire duration the step is on screen. This is worse than the v11 bug in exposure
  (continuous vs. one-time) even though each individual restart is smaller in magnitude than a 320ms
  slide-up replay.

### 2.2 Recommended fix: phase-synced negative `animation-delay` (no tick-loop change required)

Rather than expanding the tick guard (which would freeze background re-rendering — see 2.3 for why
that's a bigger tradeoff here than it was for the Plans sheet), compute a **negative animation-delay
from real wall-clock time** each time the style is applied, so a freshly-created node resumes the
pulse at the correct phase instead of restarting it at `0%`:

```js
const PULSE_MS = 1600; // pick any period; doesn't need to divide 1000 evenly with this technique
function pulseDelay() { return '-' + (Date.now() % PULSE_MS) + 'ms'; }
// applied wherever the highlight is set, e.g.:
el.style.animation = 'tourPulse ' + PULSE_MS + 'ms ease-in-out infinite';
el.style.animationDelay = pulseDelay();
```

Because the animation's `0%`/`100%` keyframes are the same visual state (a true loop — e.g.
`box-shadow` opacity oscillating symmetrically), starting a fresh node at `-(elapsed % period)` makes it
resume mid-cycle at (approximately) the same point the previous node was at when it was destroyed. The
discontinuity is bounded by render-call jitter (single-digit ms), which is not perceptible. This is a
**self-contained change** at the two `positionTour()` call sites (1836, 1843) plus the banner's own
style object (1793) — it does not touch `setInterval`, does not add a new tick-guard condition, and
therefore has **zero blast radius on any other screen's live-update behavior.**

One explicit implementation note for the Lead Developer: use `Date.now()` (real wall time), **not**
`state.now`/`simNow()`. `state.now` can jump by whole days when Aaron uses the TEST_MODE date-offset
controls (`state.dateOffsetDays`, referenced throughout — see `dateOffsetDays` in `state` init at 401);
keying the animation phase to simulated time would cause one harmless but visible micro-jump in the
glow's phase at the instant the test date changes. `Date.now()` sidesteps that entirely and is more
correct anyway (the pulse is a real-time visual effect, not part of the simulated-date domain).

### 2.3 Alternative: extend the existing tick-guard pattern (viable, but broader tradeoff here)

The precedented alternative — mirroring `!state.timeModal && !state.upgradeOpen` — would add
`!(state.tourStep != null && <in banner mode>)` to the tick's render guard so the tour layer (and its
target) simply doesn't get recreated every second while a "wait for tap" step is showing. This is a
smaller code change (one boolean condition, same shape as the v11 fix) but has a **materially different
side effect than it did for the Plans sheet**: the Plans sheet is a full-screen opaque modal, so
freezing background re-render behind it is invisible to the user. The tour banner is explicitly **not**
occluding — that's the entire point of the v12 fix — so the background stays visible and interactive
while the banner is up. Freezing the 1-second tick during banner-mode steps would also freeze anything
else driven by that tick while it's visible behind the banner: on Home, any "Opens in 4:32 PM" /
"Closed — opens in Nm" countdown text on Quick Log cards would stop advancing for as long as the banner
step is on screen. Interaction-driven renders (`setState`, which any real tap triggers) still fire
regardless of the tick guard, so this wouldn't break tour advancement or dose logging — only cosmetic
countdown freshness during the (typically brief) banner steps. Real exposure is narrow (of the 10 tour
steps, only steps 1–4 are `formStep`/banner-mode; of those, step 1 ("Tap Meds") is the only one where
Home's own live content is simultaneously visible behind the banner) but it is a real, new class of
staleness that 2.2 avoids entirely. **Recommend 2.2 as primary; note 2.3 as a fallback only if 2.2 turns
out to have unexpected cross-browser issues with negative `animation-delay`** (it is standard, widely
supported CSS, so this is a low-probability fallback trigger, but the Lead Developer should know it
exists).

### 2.4 `prefers-reduced-motion` — already handled globally, no new code needed

```css
/* line 33 */
@media (prefers-reduced-motion: reduce){*{animation-duration:0.01ms !important;transition-duration:0.01ms !important}}
```

This is a **global wildcard rule with `!important`**, so it overrides `animation-duration` set any way
— stylesheet class or inline `el.style.animation` — including a brand-new pulse. This is the same guard
the `sheetUp` animation relies on (confirmed in `outputs/DEV_BRIEF_v11.md` §1.1: "the
`prefers-reduced-motion` guard (line 26 [pre-v11 numbering]) is untouched"). **No additional
reduced-motion code is required** as long as the pulse is implemented as a real CSS `animation` (which
2.2 is) and not a JS `requestAnimationFrame`/`setInterval`-driven style loop (which would silently
bypass this guard — do not do this).

---

## 3. Occlusion risk at small viewports (360×740 / 390×844, keyboard-open ~360×400)

Low risk, for a specific reason worth stating explicitly: both proposed treatments are **non-layout**
CSS properties.
- `outline`/`outline-offset` (already used for the target highlight) is drawn **outside the border box
  and does not participate in layout** — changing its color or animating a glow around it cannot shift
  or resize anything, cannot cover the Save button, and cannot reproduce the app-v12 tour-card
  occlusion bug (that bug was about a *large centered card* covering the med-add form; this change adds
  no new fixed-position, layout-occupying element).
- A `box-shadow`-based glow (recommended over animating `outline-width` directly, since outline-width
  keyframes are less consistently smooth across engines) is also layout-inert — it paints outside the
  box without affecting hit-testing or reflow.
- The banner's own `border` (2px today) growing to, say, 3px and/or gaining a glow adds at most a few
  px of non-interactive paint around a `position: fixed` element that already deliberately overlaps the
  header (the v12 design) — it does not grow the banner's touch targets or push content.

Net: this treatment **cannot reintroduce the v12 occlusion bug** (QA_USER_ZERO_v12.md) as long as the
Lead Developer sticks to `outline`/`box-shadow`/`border-color` changes and does not add padding/margin
to accommodate the new visual weight. One thing to actually re-verify at 360×400 keyboard-open (not a
new risk, but worth re-confirming as part of QA for this pass): the `med-editor` target is a large
section that's often partially scrolled off-screen when the keyboard is open — a pulsing outline around
an element that's mostly out of the viewport is harmless (nothing to occlude, no complaints expected)
but the Designer/QA passes should screenshot it once to confirm the glow doesn't create a distracting
edge artifact at the clipped viewport boundary.

---

## 4. Recommended approach vs. arrow fallback

### Primary recommendation: green border (banner + target) + phase-synced pulse (§2.2)

This matches Aaron's stated preference order (#1 then #2) because the investigation shows #2 is **not**
the large lift he assumed — the codebase already has (a) the exact target-resolution machinery needed
(§1.3), (b) a proven, reusable global reduced-motion guard (§2.4), and (c) a clean, self-contained
technique (§2.2) that avoids re-touching the one piece of shared infrastructure (the tick loop) that
would otherwise make this risky. The only genuinely new engineering is: swap `#E0679A` → a green token,
add a `@keyframes` pulse + the negative-delay helper, and apply both at the two existing
`positionTour()` highlight sites plus the banner's style object. No new `data-tour` plumbing, no tick-
guard expansion, no occlusion risk.

**Color:** don't invent a new green — the app already has an established, in-use green token:
`#2E7D4F` (used today as a `2px solid #2E7D4F` border on the Plans sheet's "current plan" card, 1687,
plus "✓ Current plan" text 1702/1716, the schedule badge 3110, and the med-manager "Active" badge 3161)
and `#0C7F57` (the dose-progress-ring checkmark, 1490, and "✓ Logged" text, 1613). Reusing `#2E7D4F` for
both the banner border and the target outline keeps this consistent with the app's one existing
"green = success/positive/active" convention instead of introducing a second, unrelated green.

### Fallback: green arrow (only if pulse proves problematic in practice)

If the Designer/Lead Developer find the phase-synced pulse unreliable in real browser testing (e.g.
some in-scope WebView doesn't honor negative `animation-delay` the way desktop Chrome does — worth a
quick spot-check on the Capacitor Android WebView used for the APK build, since that's a real deployment
target per `outputs/DEV_BRIEF_v14` history), the arrow is a reasonable static fallback: a small SVG/CSS
triangle, green, positioned adjacent to the banner pointing at the highlighted target (or, for
off-screen targets, pointing toward the nav bar generically). It's strictly *more* code than the border
treatment (a new small render function, new positioning math similar to what `positionTour()` already
does for the card, since an arrow needs to know the target's bounding rect the same way the card does at
1846–1854) and does not by itself solve "the banner blends in" — it only solves "which element is being
pointed at," which the existing outline already solves. **Recommend treating the arrow as an addition
to the border treatment if Aaron still feels it needs more attention after the border+pulse ships, not
as a replacement for either.**

---

## 5. Definition of done

**Must work:**
1. The tour banner has a clearly visible green border (not the current translucent rose) at all times
   any tour step is on screen — banner mode and expanded card mode both.
2. The current tour target (nav tab, Add button, med-editor section, quick-log label — whichever
   `TOUR_STEPS[state.tourStep].target` names) has a matching green outline that updates correctly as
   the tour advances through all 10 `TOUR_STEPS`, exactly matching today's rose-outline behavior in
   scope/timing (only the color/weight/animation changes).
3. If pulse ships: it animates smoothly and continuously for as long as a step with a target is shown,
   including across many 1-second ticks (soak-test: sit on a `wait` step — e.g. step 3, "Fill in the
   details" — for 15+ seconds and confirm no visible restart/snap in the glow).
4. `prefers-reduced-motion: reduce` (OS-level or emulated in DevTools): no animation at all; the green
   border/outline still renders (static), tour still fully usable.
5. The banner remains `position: fixed`, pinned at `top: calc(8px + var(--safe-top))`, unchanged from
   today — this ticket must not touch positioning.
6. Tour replay via the `?` header button (1510, `startTour`) shows the new treatment from step 0.
7. Skip / Got it / Next / Back / Finish all behave exactly as today (1791–1818) — this is a purely
   visual change to `positionTour()`'s highlight styling and the banner/card `style` objects, not to any
   handler.
8. Zero new horizontal overflow or occlusion at 360×740, 390×844, and keyboard-open heights (~360×400,
   390×480) on every step that has a target, including the med-editor step.

**Must NOT regress:**
- The app-v12 tour-occlusion fix: the banner must never grow into a full-width card that covers the
  Meds/Add/med-editor content on phones. No padding/margin additions to accommodate the new border —
  `outline`/`box-shadow` only (§3).
- Tour advancement logic (`tourEvent`, `advanceTour`, `backTour`, the `medEditor:closed` back-step) —
  untouched.
- Skip/finish (`endTour`) and its highlight cleanup (`tourClearHighlight`, 1777–1782) — must still clear
  the outline/animation styling on tour end (extend the reset to also clear `animation`/`animationDelay`
  if those are added, or the last-highlighted element could be left mid-pulse after the tour ends).
- Non-tour UI: the reused green token (`#2E7D4F`) is already used elsewhere (Plans sheet, med badges) —
  do not change those existing usages; this ticket only adds new uses of the same token to the tour.
- The 1-second tick loop's existing guard (`!state.timeModal && !state.upgradeOpen && !isEditing`) —
  unchanged if the §2.2 (phase-synced delay) approach is used, as recommended.
- `checkNotifications()` — unaffected either way (outside the render guard, 3859).

---

## 6. Out of scope for this pass

- The arrow fallback (§4) — only build if the pulse is rejected after real-device/WebView testing.
- Any change to *what* the tour explains or the step order/copy in `TOUR_STEPS` (1744–1755).
- Any change to banner *position* (already correct per Aaron/app-v12; explicitly not being revisited).
- Toast z-index behind the Plans sheet (P3-1, `outputs/AUDIT_v11.md`) and other pre-existing queued
  items — unrelated to this ticket, do not bundle.
- A settings-level "always show tour target highlights" toggle or similar — not requested.

---

## 7. Landmines for the Lead Developer

1. **Two highlight call sites, not one.** `positionTour()` sets the outline in two places — banner mode
   (1836) and card mode (1843) — both must get the color/pulse change, or the highlight will visibly
   flip color depending on whether the user has tapped "More." Consider factoring both into one small
   helper (e.g. `applyTourHighlight(el)`) so they can't drift.
2. **`tourClearHighlight()` must also clear whatever new properties are added.** Today it resets
   `outline`/`outlineOffset` only (1779). If `animation`/`animationDelay`/`boxShadow` are added to the
   highlight, add them to this reset too, or the element the tour last pointed at will keep animating
   after `endTour()`/`Skip` — a real, visible bug distinct from anything currently in the app (nothing
   today leaves an animation running past its owning state going away).
3. **Don't cache the target element.** Exactly the existing precedent (`outputs/DEV_BRIEF_v11.md` §4.1)
   — `positionTour()` re-queries by `data-tour` every call and must keep doing so; the element is a new
   DOM node every render.
4. **Use `Date.now()`, not `state.now`, for the pulse phase** (§2.2) — avoids a TEST_MODE date-offset
   glitch and is more correct regardless.
5. **Don't touch the tick guard** if going with §2.2 (recommended). If the Lead Developer instead
   chooses §2.3 (tick-guard extension), scope the new condition as narrowly as possible — ideally to
   "a `wait`-having step is on screen" rather than "any tour step is on screen" — to minimize how much
   background live-content staleness it introduces (§2.3 discussion).
6. **Reuse `#2E7D4F`, don't invent a new green.** Keeps this consistent with the Plans-sheet
   "current plan" treatment and the med-manager "Active" badge, both already-shipped uses of the same
   token.
7. **`h()`'s attribute/style handling is untouched by this change** — this is pure `style` object values
   in existing `h()` calls plus imperative `el.style.*` in `positionTour()`, the same mechanism already
   in use for the outline today. No new renderer behavior needed.
8. **Version discipline (Lead Developer, not optional):** bump `APP_VERSION` (index.html:3136,
   currently `'app-v16'`) and `sw.js` CACHE (sw.js:1, currently `'chemowell-app-v16'`) together, add the
   README version-history row — per the P2-1 finding in `outputs/AUDIT_v11.md`, a missing README row is
   an automatic PM-gate fail.

---

## 8. Open questions for the Lead Developer

1. Should the pulse (if built) apply to **all 8 targeted steps** (both banner-mode "wait" steps 1–4 and
   the centered-card "Next"-button steps 5–8, e.g. `quick-log`/`nav-reports`/`nav-inpatient`/
   `nav-symptoms`), or only the 4 banner-mode steps where the user must actually find and tap the
   target to proceed? Both are cheap under the §2.2 approach since it's the same code path; this is a
   product-feel call, not a technical constraint. Recommend: all 8, for visual consistency, since the
   pulse costs nothing extra to extend once built.
2. Confirm the exact green shade with the Designer against `#2E7D4F` before implementation — this brief
   recommends reusing it for consistency, but the Designer stage should verify contrast/legibility of a
   `#2E7D4F` outline against every target's own background (nav bar white/rose-tinted, med-editor
   card's translucent rose background) at both 360px and 390px before sign-off.
3. Worth a quick real-device check on the Capacitor Android WebView (the APK build target from
   `outputs/DEV_BRIEF_v16.md`/v14 history) for negative `animation-delay` support before calling §2.2
   "done" — this sandbox cannot exercise a real WebView; flag to QA/Auditor to spot-check on-device if
   the APK is available, otherwise treat as a known verification gap same as the v14 notification work.
