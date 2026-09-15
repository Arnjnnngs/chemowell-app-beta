# DESIGNER — app-v83 / app-v84, every touched screen at 320 / 360 / 390

**RELEASE: app-v84** (covering app-v83 and app-v84, which ship together).

Fifteen screenshots in `outputs/design-app-v84/`, measured not eyeballed. Every touched screen at
each width, with the ceiling shapes that draw the new disclosure text.

## MEASURED, ALL THREE WIDTHS

| Screen | 320 | 360 | 390 |
|---|---|---|---|
| Home (vitals strip, Today timeline, Up-next) | ✅ | ✅ | ✅ |
| Meds (status pill, ceiling bar, doses-today) | ✅ | ✅ | ✅ |
| Symptoms (frequency bars) | ✅ | ✅ | ✅ |
| Reports (menu, Temperature tile) | ✅ | ✅ | ✅ |
| Reports → Temperature (chart, thresholds, list) | ✅ | ✅ | ✅ |

For every one of the fifteen: `document.scrollWidth` equals the viewport exactly, **0** elements
past the right edge, **0** text controls below the 16px iOS floor, **0** elements carrying the
literal attribute value `"null"`, **0** page errors.

The two ceiling disclosure lines added this release — *"shared with other medications"* and
*"A rolling 4-hour limit, not a daily one"* — both wrap correctly at 320 and neither pushes its
card wider. The rolling medication gets the rolling line and not the shared one, and the daily
medication gets neither: the fix is visible in the rendered UI, not only in the code.

## WHAT IS DELIBERATELY EXEMPT, SAID OUT LOUD

**iPhone rendering.** This sandbox has Chromium only. The 320/360/390 rows are Chromium at Apple
viewport sizes, which is NOT Safari — Android rows are high fidelity because Chromium is Android's
engine; iOS rows are an approximation. **Every width figure above should be read as "does not
overflow in Chromium", not "looks right on an iPhone".**

This matters more than usual in this release, because the scroll lock uses `position: fixed`
specifically because **iOS ignores `overflow: hidden` on `body`** — the one behaviour that cannot be
checked here is the one the design decision was made for. It is item 1 on the phone checklist.

**In-Patient and Symptoms-detail were not measured.** This release does not touch them.

## ONE FINDING, PRE-EXISTING, NOT CAUSED BY THIS RELEASE

**The Meds reorder arrows (▲/▼) are 40×40 at every width**, under the 44px touch target this app
holds everywhere else and cites in its own comments. They sit directly above and below each other,
which is the arrangement where an undersized target is most likely to be mis-tapped into its
neighbour — and mis-tapping these reorders the caregiver's Home screen.

Width-independent, so it is not a layout regression. Logged in `BACKLOG.md` rather than widened
into this release, and on the phone checklist so a real thumb decides the urgency.

## WHAT AARON SHOULD OPEN ON A REAL PHONE

Short, and in risk order. The full list is in `outputs/PM-app-v84.md`; these are the three the
Designer seat specifically cannot answer from here:

1. **The What's New note on first open** — does the page behind it stay still when you try to
   scroll? This is the `position: fixed` vs `overflow: hidden` decision, and iOS is the reason it
   was made.
2. **The first-run guide, as a brand-new user** — type a medication name, then thumb-scroll down to
   *Add medication* at the bottom of the form. The page must not jump back up to the field.
3. **The Meds reorder arrows** — are 40×40 big enough under your thumb, or should they go to 44?


---

# ADDENDUM, 2026-09-15 — THE SURFACE THIS RELEASE IS NAMED AFTER HAD NO DESIGN PASS

The fifteen screenshots above cover app-v83's screens. **Not one of them is the What's New notice**,
which is the entire point of app-v84 and the only new full-screen thing a caregiver meets. That is
the Enhancer's blind spot one level up: a pass that measured the screens the release *changed* and
walked past the screen the release *added*.

Six more, in `outputs/design-app-v84/`:

| Surface | 320 | 360 | 390 |
|---|---|---|---|
| The update notice (`whatsnew-modal-*.png`) | ✅ | ✅ | ✅ |
| The full list screen (`whatsnew-screen-*.png`, full page) | ✅ | ✅ | ✅ |

Measured on each of the six, not eyeballed: `document.scrollWidth` equals the viewport exactly,
**0** elements past the right edge, **0** text controls below the 16px iOS floor, **0** buttons
under the 44px touch floor, **0** elements carrying the literal attribute value `"null"`, **0**
page errors.

**Looked at as well as measured.** At 320 the two buttons sit side by side and *"See recent
updates"* wraps to two lines inside its pill without changing the row's height or pushing *"Got
it"* off the edge; the notice's own body scrolls while the page behind it does not (asserted in
`test/v84-whatsnew.mjs` 7b rather than left to the eye). The label reads *"See recent updates"*
rather than *"See all updates"* — the fourth surface that claimed the changelog was complete, and
the reason this addendum exists at all.

**One thing the fixture shows that a real phone will not.** The shots force the notice by writing an
old seen-version, so they catch a device that is simultaneously mid-first-run-guide and being told
what changed. A genuinely new install is stamped silently and shown nothing
(`deviceHasPriorChemoWellData()`), so that overlap needs a user who updated part-way through the
guide. The notice sits above the guide and dismisses normally; noted rather than treated as a
defect.

**Still exempt, and still for the same reason: iPhone rendering.** Chromium only here. The new
gesture-based guard on the focus nudge makes that exemption sharper than usual — see BACKLOG.md,
"iOS: the focus nudge is guarded by gesture now". It is item 1 on the phone checklist.
