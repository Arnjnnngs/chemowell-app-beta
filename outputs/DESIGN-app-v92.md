# DESIGNER PASS — ChemoWell app-v92

Every touched screen at **320, 360 and 390** wide, looked at rather than reasoned about.
Screenshots were produced by `test/v92-designer-pass.mjs` plus a targeted timeline shot with long
medication names, and are **sent to Aaron with the release message** rather than filed (Rule 1.5).

**Exempt, stated rather than skipped: this sandbox has Chromium only.** An iPhone's rendering
cannot be reproduced here. Every figure below is Chromium at Apple's viewport sizes, which is right
about box geometry and not a substitute for Safari. Android rows are high fidelity, because
Chromium is Android's engine.

## 1. Task #28 — the before is much worse than the bug report said

**Before, 320px, Home, a real drug name:** `Hydroxychloroquine` is printed **straight across**
`8:00 AM` and `200 mg`. The time of the dose and the dose are both unreadable. This is not a 5px
overflow; it is two strings on top of each other on a medication tracker.

**After, same fixture, same width:** the time column holds, the name wraps onto two lines, the dose
sits below it, the Remove button keeps its 44px target. Measured 0 collisions at all three widths
and `overflow-scan` clean at 170/170 combinations across ten widths.

### The one judgement call, and it is visible

At 320px a single word longer than the name column now **breaks mid-word**: `Hydroxyc / hloroquine`.
That is `overflowWrap: 'break-word'` doing its job, and it is the price of the fix.

* **It is the right trade.** The alternative shipping today is the word escaping its box and landing
  on the time and the dose. A break is legible; an overlap is not.
* **`hyphens: 'auto'` was tried and does nothing here** — identical rendering, no hyphen, because
  this Chromium has no hyphenation dictionary loaded. It was reverted rather than shipped: a
  property that does nothing, with a comment claiming it helps, is exactly the class of false
  record this release has spent four audits on. **Worth re-testing on a real iOS/Android device,
  where the dictionary usually is present** — if it works there, the break becomes `Hydroxy-` and
  reads as typography rather than as a glitch.
* It only happens at 320px, and only for a name whose longest word exceeds ~140px. `Children's
  Liquid Tylenol` wraps at its spaces and looks normal.

**Proposed, size S, NOT in this release:** an icon-only Remove at ≤345px would give the name column
about 40px more and the mid-word break would stop happening at all. It changes the affordance of a
destructive control, so it is Aaron's call, not mine.

## 2. Task #36 — the Back pill

**At the end of the scroll**, on every report screen at all three widths, nothing is behind the
pill any more. Measured: 18 screen×width combinations at `scrollHeight`, 14 of them genuinely
scrolling, zero glyph boxes intersecting the pill.

**Mid-scroll the pill still floats over a row, and that is deliberate.** It is a floating control
over a list; the person scrolls and the row comes out from under it. What was wrong was the END of
the scroll, where there was no scroll left to do that with. Said out loud so the next pass does not
read the mid-scroll screenshot as an unfixed defect — **an exemption nobody wrote down is
indistinguishable from an oversight.**

**The extra bottom space is only on report screens.** Home, Meds, Symptoms and In-Patient keep the
90px baseline, so no screen gains dead space it did not need.

## 3. What to check on the two real phones

Chromium cannot answer these, so they are a named list rather than a claim:

1. **320px-class phone (iPhone SE 1st gen, or Android with Display size turned up), Home.** Add a
   medication with a long one-word name — `Hydroxychloroquine` is the test case. The time, the name
   and the dose must all be readable, and the name must not sit on the time.
2. **Does the name hyphenate on your phone?** If it breaks as `Hydroxy-` rather than `Hydroxyc`,
   iOS/Android has the dictionary and `hyphens: 'auto'` is worth putting back.
3. **Any report screen, scrolled all the way down.** The last row must be fully readable above the
   Back pill, not tucked under it.
4. **Safari specifically.** `-webkit-text-fill-color`, which the contrast gate depends on, and the
   flex sizing here have both been measured in Chromium only.

## 4. Anything else on these screens worth changing

Nothing proposed. The Enhancer pass (`ENHANCER-app-v92.md`) carries the two findings on these
screens, both queued rather than folded in: a logged **dose** cannot be corrected, and a **symptom**
correction deletes the original before writing the replacement while bowel and appetite corrections
already append a superseding entry.
