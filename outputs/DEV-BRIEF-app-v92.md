# DEVELOPER BRIEF — ChemoWell app-v92

Stage 1 of the Quality Chain. Written before any line of app-v92 exists.

**Scope: the two fixes Aaron asked for after the colour release** — task #36 (the Back pill covers
content) and task #28 (a chip overflows its box on Home at 320px). Nothing else. Both were measured
during app-v90/v91 and deferred to their own release rather than widening a palette change, per
Rule 0.7 item 4.

---

## Task #36 — the Back pill clips the bottom of the last line on a report screen

### What the person sees

On a Reports sub-screen (History, Temperature, and others depending on how much is logged) scroll to
the bottom. The bottom of the last line of text runs under the dark "↩ Back" pill, so digits and
descenders are cut off. Scrolling further does nothing — the page has already reached its end, so
there is no way to uncover it.

### The geometry, measured — and the earlier figure corrected

| Element | Where it is | Source |
|---|---|---|
| Bottom nav | `position: fixed`, `bottom: 0`, ~84px tall incl. safe-area padding | `index.html:4746` |
| Back pill | `position: fixed`, `bottom: calc(88px + env(safe-area-inset-bottom))`, `minHeight: 42px` → **top edge a constant 130px above the viewport bottom**, measured at `top = 714` in an 844px viewport at all three widths | `index.html:5480` |
| Page wrapper | `paddingBottom: 'calc(90px + env(safe-area-inset-bottom))'` | `index.html:5434` |

**90px of padding clears the 84px nav and nothing else**, so the tail of the scrollable content has
nowhere to go and the last line of text ends up behind the pill.

**Measured at max scroll (`scrollTop + innerHeight == scrollHeight`), glyph boxes by `Range`,
intersected with the pill's own rect:**

| Width | History | Weight | Temperature |
|---|---|---|---|
| 320 | **35×7px** covered — "1 tablet" | none | **50×7px** covered — "Wed, Oct 7 · 11:30 AM" |
| 360 | **15×7px** — "1 tablet" | none | **30×7px** — "Wed, Oct 7 · 11:30 AM" |
| 390 | none | none | **15×7px** — "Wed, Oct 7 · 11:30 AM" |

**The earlier figures in `outputs/DESIGN-app-v91.md` — 62×21 at 320, 73×18 at 360, 83×21 at 390 —
are element-box intersections, not glyph coverage, and they overstate this defect.** A row's box
includes its padding, and a pill sitting over a row's bottom padding hides nothing. What is actually
covered is the bottom **7px** of the last line's glyph box: the descender band, which clips the
bottom of digits and of letters like `p` and `g`. That row of `DESIGN-app-v91.md` is corrected in
the same commit as this brief.

**It is still a real defect and it is still worth a release**, for three reasons that the smaller
number does not change:
1. It is at the **end of the scroll**, so it cannot be scrolled away. The person has no recourse.
2. It is **width- and data-dependent** — 390/History shows nothing while 320/History shows 35×7px.
   A defect that appears on some phones and not others is the kind nobody can reproduce on request.
3. A **clipped glyph reads as a rendering fault**, not as a design choice. On a medication tracker
   the clipped text is a time and a dose.

### The fix

One predicate, three call sites.

1. Rename `toastNeedsLift()` (`index.html:135`) to **`backPillShowing()`** — it has always returned
   "is the Back pill on screen", and the new name is what the third caller needs to read. Keep
   `toastNeedsLift()` as a one-line alias that returns `backPillShowing()` so the toast call site and
   anything in the suites keep working, with a comment saying which is the primitive.
2. `index.html:5434` — page `paddingBottom` becomes
   `backPillShowing() ? 'calc(138px + env(safe-area-inset-bottom))' : 'calc(90px + env(safe-area-inset-bottom))'`.
   138 = the pill's 130px top edge + 8px of breathing room, so the last row clears it rather than
   touching it.
3. `index.html:5480` — the pill's own `bottom` and the padding above must not be able to drift apart.
   Hoist the two numbers to one place: `const BACK_PILL_BOTTOM = 88, BACK_PILL_H = 42;` beside
   `backPillShowing()`, and derive both the pill's `bottom` and the page's padding from them. **Two
   literals that have to agree are the defect class, not just this instance** — the same pairing
   broke the toast at 96 vs the pill at 130 in v57.

4. `index.html:11774` — add `'data-report-tile': type` to each Reports-menu tile. One attribute,
   no behaviour. It is what lets the new suite **discover** the report sub-screens from the app
   instead of carrying a list of its own, so a tenth report is walked on the day it lands with
   nothing for anyone to remember. Rule 5 asks for explicit `data-` hooks; this is the hook that
   turns the check from an instance into a class.

### Deliberately NOT done

- **The pill is not moved or made non-fixed.** It is a constant that the content can be padded
  around; moving it reopens the v28 tap-target finding recorded in the comment at `index.html:5470`.
- **No change to the nav's 90px baseline** on non-report screens. Nothing is clipped there and
  widening the padding everywhere would add dead space at the bottom of Home.

### Done means

- At 320, 360 and 390, on **every** Reports sub-screen, scrolled to `scrollHeight`, **no glyph box
  intersects the pill's rect at all** — zero covered boxes, not "a smaller overlap". **"Every"
  means all nine the app can offer**, not the six a default profile shows: `cycle`, `radiation`
  and `paracentesis` are profile-gated and the suite's first fixture enabled none of them, so it
  walked six while this sentence said every. The fixture turns all three on. Measured: **27
  combinations, 27 of them genuinely scrolling, 0 covered.**
- On Home / Meds / Symptoms / In-Patient the page's bottom padding is unchanged (assert the computed
  value, not the screenshot).

### The new check, and how it will be falsified

A new suite `test/v92-pill-clearance.mjs`, in the **interaction** class Rule 5.5 demands — it
scrolls, it does not photograph a still frame:

- For each width × each Reports sub-screen: seed enough rows to make the screen scroll, scroll to
  `scrollHeight`, then read the pill's `getBoundingClientRect().top`.
- **Assert the invariant, not one row.** No element that is text-bearing and not `position: fixed`
  may have a `.bottom` greater than the pill's `.top`. Rule 5 says select by explicit `data-` hook
  rather than by text — and there is no "last row" hook on these lists because *which* element is
  last depends on the screen and on the data. A hook would pin this instance; geometry pins the
  class, and the class is what keeps coming back. The report under a failure names the offending
  element (tag, hook attribute if it has one, and its text) so the finding is actionable.
- Separately assert the screen actually scrolled (`scrollTop > 0` after the scroll). **A screen
  that did not scroll FAILS** — and the first version of this suite did not do that: it refused
  only when NOT ONE screen scrolled, so with the fixture emptied an audit got a PASS with 13 of 18
  combinations vacuous, because the appetite screen scrolls on app chrome alone. On the real run
  four were already vacuous and `blood_pressure`'s end-of-scroll had never been tested at any
  width. Per-screen now, with the fixture seeding every report the menu offers. That is the
  empty-Home trap `test/overflow-scan.mjs` paid for twice, and it does not get a third outing.
- A completeness check over the Reports sub-screen list: if a seventh sub-screen is added without a
  clearance assertion, the suite fails — the class, not the instance.
  **DELIVERED HALF-WAY, AND THE AUDIT SAID SO (2026-11-03).** Discovering the screens from the
  app's own `data-report-tile` hooks delivers the ADD direction: a tenth report is walked on the
  day it lands. It delivers nothing in the REMOVE direction, which is the direction that bites —
  the auditor stripped the hook from three of nine tiles and the walk narrowed 27 → 18 and passed,
  printing "6 report screens discovered". A floor on the discovered count (`MIN_REPORT_TILES`, a
  ratchet in the shape `v75-no-other-patient.mjs` uses) now closes it, together with a guard that
  a walked screen is a report the app actually knows. **This bullet was written in the future
  tense and then read as if it had been done** — the same shape as the "asserts the INVARIANT"
  sentence in `README.md`, in the same release.

**Falsification, mandatory, one mutant per claim:** restore the page padding to the current
`calc(90px + …)` in a byte-copy outside the repo, md5-verified on disk and as served, served on its
own port, and watch the suite go red on all three widths. Then restore. A check that cannot fail is
worse than no check.

---

## Task #28 — "10:00 AM" overflows its box by 5px on Home at 320px

### Confirmed, by the repo's own instrument

`test/overflow-scan.mjs` on the current build: **170 of 170 screen/width combinations scanned,
3 overflowing elements — all the same one.**

```
iOS  iPhone SE (1st gen) (320px) — HOME — 1 problem(s)
    "10:00 AM"
      <div> the wording is wider than the box it sits in by 5px · box 58x36 · white-space:normal
```

(Three occurrences because Home is scanned three times at 320: the base fixture, `NO-STAY` and
`NO-DATES`. One element, one defect.)

**The element, located by an instrumented copy of the scan rather than by guesswork:**

```
div > div > div > div{data-timeline-row} > div > div
minW=58px  shrink=1  size=14px  clientW=58  scrollW=58
```

That is `index.html:6968` — the time cell in a Home timeline row:

```js
h('div', { className: 'mono', style: { ...TYPE.mono, fontWeight: '600', color: '#6A4433', minWidth: '58px' } }, fmtTime(e.ts))
```

### AND THE 5px NUMBER UNDERSTATES IT BADLY — the screenshot is the finding

A screenshot of the **current shipped build** at 320px with a long medication name shows what the
scan's "over by 5px" actually is on screen:

> **"Hydroxychloroquine" is printed straight across "8:00 AM" and "200 mg".** The time of the dose
> and the dose itself are unreadable.

`test/overflow-scan.mjs` compares each element's text against **its own box, one element at a
time**, so a sibling that escapes its box and lands on top of another element comes out as a small
number with no hint that two strings are now illegible. **That is the same shape as the contrast
gate's blind spot a week earlier: an instrument that measures one element cannot see a relationship
between two.** Logged as task #40.

So this release adds the check that asks the relationship question —
`test/v92-text-collisions.mjs` — and the measurement is unambiguous:

| build | 320px Home | every other screen × width |
|---|---|---|
| current | **2 collisions**, worst `"8:00 AM"` over `"Hydroxychloroquine"` **31×16px** | 0 |
| fixed | 0 | 0 |

650 in-flow text runs compared on both, so the difference is the defect and not the fixture.

**Out-of-flow text is deliberately out of scope and that is what makes the check usable.** A first
version counted everything and reported 4 to 11 collisions per screen on a build with one real
defect — "ChemoWell" over "Radiation", "Morning" over "Home" — which is the page scrolling under
the fixed header and nav, i.e. the layout working. Whether something painted on top of text hides
it is `contrast-scan.mjs`'s question and it has its own answer.

### The root cause, measured

The cell is a **flex item with `minWidth: 58px` and the default `flex-shrink: 1`.** When the row's
content column wants room — a medication name plus a dose line, which is the normal case — the
flex algorithm squeezes this cell to its 58px floor. Measured in Chromium at 14px `ui-monospace`,
the string `"10:00 AM"` is **66.31px** wide. It does not wrap because its only break opportunity is
the single space, and the cell is one line tall.

**Two things checked and found NOT to be the cause**, so nobody re-investigates them:

- **It is not a non-breaking space.** ICU 72+ emits U+202F (narrow no-break space) before AM/PM in
  some builds, which would make the string unbreakable and was my first hypothesis. Measured in the
  page: `U+0031 U+0030 U+003A U+0030 U+0030 U+0020 U+0041 U+004D` — a plain U+0020. The hypothesis
  was wrong and is written down here so it is not repeated as fact.
- **`white-space` is `normal`**, as the scan reports. The wrapping rule is not the problem.

**And note `clientW=58, scrollW=58` on the offending element.** `scrollWidth - clientWidth` is
**zero** here. That is the trap `test/overflow-scan.mjs:130` documents in its own header — the old
test was `scrollWidth > clientWidth`, which is always 0 for inline text — and my own first probe at
this defect reimplemented it and reported nothing. This element is now the worked example of why
that method cannot see this class.

### The fix

**Correctness comes from `flex-shrink`, not from a bigger magic number.** A larger `min-width` would
hold until the next string or font that needs one pixel more.

1. `index.html:6968` — add **`flexShrink: '0'`** to the time cell. Its used width then becomes
   `max(min-width, content)`, so it can never be squeezed below its own text, in any locale, at any
   font size. Keep `minWidth: '58px'`: it is now purely a **column-alignment floor**, not a
   correctness guard, and that is worth a comment beside it.
2. `index.html:6966` — the dot+time group holding it carries `minWidth: '0'`, which permits the
   group to shrink below its own min-content width; the non-shrinkable cell would then overflow the
   *group* instead, which is the scan's "content wider than its box" check. Change it to
   **`flexShrink: '0'`** so the group is a fixed 9 + 9 + ≥58px and the content column absorbs the
   squeeze — which it is already built to do (`flexWrap: 'wrap'` on the name line).
3. `index.html:5860` — **the same latent defect, one screen over.** The journal row's time cell is
   `minWidth: '66px'` with the default shrink, rendering the same `fmtTime()` output. It does not
   overflow today only because its row has fewer columns competing for width. Add `flexShrink: '0'`
   there too. **Fix the class, not the instance** — this is the Enhancer's checklist item 5 ("where
   a sibling screen already got it right, why didn't this one?") running in the other direction.

**Do NOT** add `overflow: hidden` or `text-overflow: ellipsis`. Hiding a dose time is worse than
overflowing it: the person loses the information and the scan goes green, which is a
check-that-cannot-fail wearing a different coat.

### Done means

**Both** instruments green, because they ask different questions:

* `test/overflow-scan.mjs` exits **0** — **170 of 170** combinations across **ten** device widths
  (not eight, as an earlier draft of this brief said), zero overflowing elements, including the six
  drawer screens it walks. **Measured on the fixed build: clean** — and the sentence below about
  relocation turned out to be false the first time round, so read it with its correction: the
  fixture had never rendered the `override`/`skipped` badge, so the relocation it promised to
  catch went straight past it. The badge is in the fixture now and the badges carry `minWidth: '0'`;
  falsified both ways, 0 with the fix and the same 6 (21px at 320, 11px at 330) without it.
* `test/v92-text-collisions.mjs` exits **0** — 15 screen×width combinations, 650 in-flow text runs
  compared, no two overlapping. **Measured on the fixed build: clean. Measured on the current build:
  red, on exactly the one real defect.** The scan reports the worst
offender per combination, so a fix that merely relocates the overflow is caught by the same run.

**Falsification:** the scan already fails on this element today, which is the red half of the
falsification — recorded above verbatim, with the exit code. After the fix it must go green, and
reverting `flexShrink: '0'` in a byte-copy outside the repo must bring the same 3 findings back.

## Release mechanics

- `APP_VERSION` → `app-v92`; `sw.js` CACHE → `chemowell-app-v92-1`. The two must move together or
  `pm.py`/`release_check.sh` blocks.
- `CHANGELOG`: one entry, Rule 0.9 — a 3-6 word title and 2-4 short bullets, under ~70 words, no
  mechanism. Draft: **"Back button no longer covers rows"** · *The last row of a report list is no
  longer hidden behind the Back button.* · *A time on the home screen no longer spills past its
  box on small phones.* The detail in this brief goes in `README.md`'s version history row, not in
  the app.
- `README.md` version history row and `BACKLOG.md` (#36, #28 → closed) in the same commit as the
  code, per the Quality Chain stage 2 — the person who made the change is the only one who knows
  what changed.
- Both files touched are rule-5 paths (`index.html`, `sw.js`), so the release takes the full chain:
  Enhancer and Designer at design time, then **one** independent Zero Day Auditor, then the PM
  sign-off, then `release_check.sh` exit 0. Never two agents at once.

## What this brief deliberately leaves out

- Task #34 (the Temperature toggle writing the Weight screen's range key) is a one-line fix sitting
  in the same area of the file. It is **not** in this release. It is a separate defect with a
  separate blast radius and it goes next, in its own release, rather than riding along where nobody
  reviewed it as the point of the work.
- Task #33 (what replaces the "Average" tile on the Weight trend) is Aaron's decision, not a build.

---

## TRANSPLANT CHECKLIST — how this reaches the repo

**Everything above was built and verified in an isolated copy at
`<scratchpad>/v92work`, taken from the repo BEFORE the app-v91 documentation
remediation landed.** So the copy's `release_check.sh`, `README.md`, `TEAM.md` and
`BACKLOG.md` are stale against the branch and **must not be copied back wholesale.** Only
`index.html` and `sw.js` are safe to take as whole files; everything else is re-applied as an
edit on top of the current branch.

1. **`index.html`, `sw.js`** — copy from the work copy. `APP_VERSION = 'app-v92'`,
   `sw.js` CACHE `chemowell-app-v92-1`, changelog entry first in the array.
2. **`test/v92-pill-clearance.mjs`, `test/v92-text-collisions.mjs`** — new files, copy as-is.
3. **`test/v92-designer-pass.mjs`** — copy; it is `v91-designer-pass.mjs` with no change, and
   `release_check.sh` finds it by deriving the name from `GATE_VERSION`.
4. **`release_check.sh`** — re-apply the edit on the branch's current version: add
   `test/v90-chart-axes.mjs`, `test/v92-pill-clearance.mjs` and `test/v92-text-collisions.mjs`
   to the suite loop (`overflow-scan.mjs` and the designer pass are already there from the v91
   remediation).
5. **`README.md`** — new version-history row for app-v92, written against the branch's current
   file.
6. **`BACKLOG.md`** — close #36 and #28; the Enhancer's E1/E2 and the Designer's icon-only-Remove
   proposal are added as new entries.
7. **`outputs/`** — `DEV-BRIEF-app-v92.md` (this file), `ENHANCER-app-v92.md`,
   `DESIGN-app-v92.md`, then the Auditor and the PM.
8. **Re-run everything on the branch after the transplant.** The verification above was done on
   a copy; a release is verified on the file that ships. `overflow-scan` (170/170),
   `v92-pill-clearance` (18 combinations), `v92-text-collisions` (15 checks, 650 runs),
   `contrast-scan`, `v84-whatsnew`, `v90-chart-axes`, `v75-no-other-patient`,
   `v89-everything-free`, and both `v76` suites. **All ten were green on the work copy with the
   version bumped**, so a red one after the transplant means the transplant, not the fix.

**Why this release waited.** `index.html` could not be touched while app-v91's fifth audit pass
was reading it: its md5 is the thing four passes have cleared, and changing the file under an
auditor invalidates the pass. So v92 was built, measured and falsified beside the repo rather
than in it, and lands in one commit once v91 is signed off.
