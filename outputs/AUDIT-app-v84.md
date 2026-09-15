AUDITED-COMMIT: 5600b92
VERDICT: SHIP

# Zero Day Audit — ChemoWell app-v84, FIFTH PASS (delta on 1c50c87 → 5600b92)

**HEADLINE: both BLOCKs are genuinely fixed and I can prove each one with the build's own output —
the tour walk reaches the real step (the suite prints "GUIDE · 4 OF 10 | Fill out the form" as the
detail on the check that catches my mutant, so it is measuring step 4 and not a step that resembles
it), and the frozen clock is load-bearing rather than decorative (the OLD suite is still 75/80
against the NEW app at this same 03:00 hour, while the new suite is 80/80 at both 03:00 and 12:00
real local time). Eight mutants run, seven killed. VERDICT: SHIP.**

**But the answer to the question you asked is no: a Playwright click is NOT a fair proxy for a
finger, and I have a measurement rather than an opinion.** Re-implement the freeze as
`overflow: hidden` instead of `position: fixed` — which is what most code does, and what this app
rejected only because iOS ignores it — and *"and it can actually be TAPPED"* goes **green on a page
no finger can scroll**. Playwright scrolls through `overflow: hidden` over CDP; a thumb does not.
That check is carried entirely by the scroll assertion standing next to it. It still killed the
mutant, so this does not block — but the check does not mean what its name says, and if the scroll
assertions were ever trimmed as redundant the suite would go blind.

**The one survivor: delete the "Fill out the form" step from `TOUR_STEPS` — so the guide never tells
a new user what to do in the editor — and the suite is 48/48 green**, because *"and the guide
advances once the medication is saved"* is asserted only as `!/Fill out the form/`. A negative
assertion passes when the thing never existed.

Measured in Chromium against private clones of 5600b92, each on its own port (8971, 8991-8998).
Working tree untouched other than this file.

## The delta, item by item

| | Verdict |
|---|---|
| **BLOCK 1 — 7d walks the guide to the editor** | **FIXED and verified.** Reaches step 4 of 10, proven by the suite's own output. Both freeze mutants killed (4 and 6 failures, exactly as you reported). |
| **BLOCK 2 — the clock frozen in the fixtures and shimmed in the page** | **FIXED and verified at two real hours.** The shim does not mask anything this suite is responsible for (below). |
| **N1 — the splash claim** | **Withdrawn correctly**, in the comment and the commit. |
| **N2 — raw `med.rollingCeilingH` reads** | Two of three fixed. The third (6416) **should have been fixed too**; it is unreachable, so it does not block. |
| **N4 — `expectsNoCard` a declared flag** | **FIXED.** Fixture-level `__expectNoCard`, no prose parsing. |
| **N5 — the Skip control clicked, not counted** | **FIXED**, and it asserts the guide actually ends. |
| **N3 — grouped pills** | **Does NOT rise to a block.** Your instinct is right, and for a stronger reason than "it predates the release" — see below. |
| **Prior mutants 5-7** | **Run. All three killed.** |
| **320 / 360px on Meds and Reports** | **Clean.** No overflow at any width; both new disclosure lines wrap correctly at 320. |

---

# BLOCK 1 — verified, including the part you asked me to check

## The walk reaches step 4, and the suite proves it itself

You asked me to confirm the walk reaches the step I measured rather than one that looks like it. The
strongest available evidence is the suite's own failure detail against my mutant — the string it
prints is the live banner at the moment it clicks:

    FAIL  and the guide advances once the medication is saved
          |  GUIDE · 4 OF 10 | Fill out the form, then tap Add medication at the bottom. | Skip this st

"4 OF 10", "Fill out the form". That is the step the third pass measured at 2,387px with the button
1,354px below a frozen fold. The walk is on it.

Independently: the case asserts `#med-doses-text` exists (the editor is really open), that
`#tour-layer` is still present (it is the tour path, not the ordinary Meds → Edit path), and it
reaches the editor through `[data-tour="meds-add"]` — the tour's own target hook — rather than a
button that happens to say Add.

## The sweep

Eight mutants, each on a private clone of 5600b92 on its own port.

| # | Mutant | Suite | Result |
|---|---|---|---|
| n1 | the lock re-applied only while the editor is open (my last-pass survivor, verbatim) | v84 | **KILLED — 4 failures**, incl. *"CLICK TIMED OUT: a new user cannot add their first medication"* |
| n2 | the `pointerEvents` line deleted entirely | v84 | **KILLED — 6 failures** |
| n3 | the form step's `advanceOn` changed so the guide strands on it | v84 | **KILLED — 1 failure** |
| n5 | `medWithheldNow` stops asking `treatmentExcludedNow` (prior mutant 5) | v83 | **KILLED — 2 failures** |
| n6 | the temperature out-of-range fallback restored (prior mutant 6) | v83 | **KILLED — 5 failures** |
| n7 | `windowH` dropped from the rolling branch (prior mutant 7) | v83 | **KILLED — 5 failures** |
| n8 | the freeze re-implemented as `overflow: hidden` | v84 | **KILLED — 3 failures, but the TAP check passed** (below) |
| n9 | the "Fill out the form" step removed from `TOUR_STEPS` | v84 | **SURVIVED — 48/48** (below) |

Your three counts match mine exactly on n1 and n2. Baseline at 5600b92: v83 **80/80**, v84 **48/48**,
v80-up-next **48/48**, v75-no-other-patient **27/27**, zero page errors anywhere.

## n8 — Playwright's click is not a finger, measured

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';     // instead of position: fixed

plus the scoped re-freeze from n1. Against that build the page cannot be scrolled by any gesture, the
"Add medication" button is a thousand pixels below the fold — and:

    FAIL  and it still scrolls                                         |  0px
    FAIL  and the page still scrolls while the guide is up             |  0px
    FAIL  and it scrolls, which is what a thousand-pixel-tall form needs |  0px
    PASS  and it can actually be TAPPED -- not merely found in the DOM  |  clicked

Playwright's actionability check auto-scrolls via CDP `scrollRectIntoViewIfNeeded`, which moves a
scroll container regardless of `overflow: hidden`. A thumb cannot. The tap check only failed against
n1/n2 because `position: fixed` **collapses the scroll container**, so the element genuinely stays
outside the viewport and there is nowhere for CDP to scroll to — the check passed its own test for an
incidental reason.

**Not a block:** the suite still kills n8, three times over, on the scroll assertions. **But the tap
check is decoration on top of them, not independent evidence**, and its name says otherwise on the one
release whose entire subject was a control that existed and could not be reached. If you want it to
mean what it says, assert the button's `getBoundingClientRect().top` is inside the viewport *before*
clicking, or click at a coordinate with `page.mouse` instead of through the actionability path. One
line either way.

## n9 — the one survivor, and it is the negative assertion

Remove `TOUR_STEPS[3]` — the guide skips straight from "Tap Add" to "Nice work!", so a new user opens
a 2,387px form and is told nothing about it. **48/48 green.** Every check holds: the editor opens, the
layer is up, the page scrolls, the button taps, and

    t('and the guide advances once the medication is saved', !/Fill out the form/i.test(advanced), …)

passes because the banner never said "Fill out the form" in the first place. A negative assertion
cannot tell "it moved on" from "it was never there".

**Required next release, one line:** before filling the form, assert the banner **does** say
`Fill out the form` (or `4 OF 10`). That makes the negative assertion afterwards mean something, and
it is also the explicit proof that the walk is on the right step rather than my inferring it from a
mutant's output. **Not a block**, because the case's chartered subject — the freeze — is now covered
in both directions by n1 and n2, and n9 is a content regression the case was never written to catch.

---

# BLOCK 2 — verified, and the shim does not hide what this suite is for

## The fix is load-bearing, measured right now rather than argued

| Run, same machine, same minute, real UTC 03:1x | Result |
|---|---|
| **new suite** (5600b92), `TZ=UTC` — real local hour **03:xx**, the hour that broke it | **80/80** |
| **new suite**, `TZ=Asia/Tokyo` — real local hour **12:xx** | **80/80** |
| **OLD suite** (1c50c87's file) against the **same new app**, `TZ=UTC` | **75/80** — the same five failures as my last pass |

The third row is the falsification: the app did not change underneath this, the suite did, and the
old one still goes red at this hour. Every `Date.now()` is gone from the suite (verified by reading
the diff: eleven call sites replaced by `FROZEN`, plus `new Date().getDay()` and `.getHours()`), and
the page's own `Date` is shimmed in `addInitScript` so the app agrees with the fixture about what
"today" is — a fixture frozen against a live page clock would have been half a fix.

## Does the shim mask a defect? Narrowly yes, and not one this suite owns

A frozen `Date` means the 1-second tick still fires but every render recomputes identical state. Any
defect that only appears as time advances is now invisible **to v83**: the countdown labels, the gap
timer expiring, `rollingCeilingAvailableAt` counting down, and — the one with real history here — the
tour/sheet pulse, whose `Date.now() % TOUR_PULSE_MS` phase is constant under the shim, so the
flicker class this project was bitten by in v11 and v17 could not reproduce.

**The mitigation is already in place and worth stating out loud so nobody removes it by accident:
`test/v84-whatsnew.mjs` carries no clock shim at all.** It runs live, and it is the suite that owns
the overlays, the scroll lock and the tour — the surfaces where a time-passing defect would land. So
the repo has not traded away its live-clock coverage; it has frozen the suite that asks about a day's
worth of doses and left live the suite that asks about a second's worth of rendering. That is the
right split. It should be a sentence in v83's header, because right now it is true by luck of who
wrote which file.

---

# N2 — two of three fixed, and the third is in the same unreachable class

`status()`'s gap-lockout skip (2582) and the Home sub-status line (6362) now both read
`dailyCeiling().windowH`. Correct, and the second one is belt-and-braces —
`((dc && dc.windowH) || med.rollingCeilingH)` is already gated on `st.rollingCeiling`.

**Should you have done 6416 as well? Yes.** The override prompt still asks the raw flag:

    st.ceilingHit ? (med.rollingCeilingH ? 'Up to the ' + label + ' reached. Log more anyway?'
                                         : 'Daily limit of ' + label + ' reached. Log more anyway?')

For a pills-unit medication carrying a rolling window, `status()` now says daily and this red
override prompt says the rolling sentence — **the two disagree inside the same tap**, which is the
precise shape of the defect the first fix was made for. It is three identical misreads and you fixed
two; the comment at 2582 now reads as though the class were closed.

**Is any of the three reachable today? No — and that is why none of this blocks.** Grepping the whole
file for a write: **`rollingCeilingH` is never assigned anywhere**, and neither is `ceilingGroup`.
`ceilingUnit` *is* written by the editor (7513), but the rolling flag that would collide with it
cannot be set by any in-app path. All three sites are reachable only on a medication arriving from a
legacy or imported record.

---

# N3 — it does not rise to a block, and the reason is stronger than "it predates the release"

A grouped pills-unit medication counts `dailyPills(med.id)` — itself alone — against a group's
maximum, and with `group: false` now says nothing about it. You called it a real disclosure gap and
you are right about the substance.

**But `ceilingGroup` is not written anywhere in the file.** Not by the medication editor, not by any
seed, not by the migration. No user can create a grouped medication of any unit, so no user can be
shown the wrong number. It is latent in the strict sense — not "rare", not "hard to reach",
**unreachable through the product**. Widening a release to fix something nobody can currently see,
in a medication app, is exactly the trade Rule 2.6 warns about: every extra control and every extra
line of disclosure is a new way to mis-tap.

**Log it in `BACKLOG.md` rather than carrying it as an open audit finding**, with the reachability
noted, so that whoever eventually makes `ceilingGroup` settable in the editor finds it before they
ship the feature — because that is the release where it stops being latent, and that is the release
where it becomes a block.

---

# 320 / 360px — clean, and the new disclosure lines are the reason to have checked

Meds, Reports and Home at 320, 360 and 390, with a fixture carrying every ceiling shape that draws
disclosure text (rolling, shared-group with two long medication names, pills-unit) plus temperature
readings:

    320px Meds    : docW 320, 0 elements past the right edge, 0 clipped, 0 sub-16px inputs, no "null"
    320px Reports : docW 320, 0 past the edge
    320px Home    : docW 320, 0 past the edge
    360 / 390     : identical, 0 everywhere.  Zero page errors at any width.

Both new lines wrap cleanly at 320 and read correctly:

    1,000 / 3,000 mg | 2,000 mg left today | This limit is shared with other medications —
        the figure above counts all of them, not this one alone.
    5 / 15 mg | 10 mg left in the last 4h | A rolling 4-hour limit, not a daily one —
        this frees up again as earlier doses age out.

The grouped medication gets the shared line and the rolling one does not, which is the N2/N3 fix
visible in the rendered UI rather than inferred from the return value.

**One pre-existing note, not this release's:** the Meds list's reorder arrows (▲ / ▼) are 40×40 at
**every** width, under the 44px target the rest of the app holds to. Width-independent, so it is not
a narrow-screen regression, and out of scope here — but it is the only tap-target miss on these
screens and somebody should decide about it deliberately rather than keep re-finding it.

---

# Standing brief, re-checked at this commit

`test/v75-no-other-patient.mjs` **27/27** — no patient name, no gendered pronoun (comments included),
no care-plan dose, all three ratchet counts unmoved. The only storage write in either release is
still `chemowell-app-seen-version`; this delta adds no write path and touches no `removeEntryDB`.
`test/v80-up-next.mjs` **48/48**, so nothing that counts `[data-med-card]` moved. Zero page errors
across every fixture in this pass.

# What I did not do

`pm.py` and `release_check.sh` were not run. Chromium only — no iPhone rendering, the standing
exemption on every release here. The 320/360 pass covered Meds, Reports and Home; it did not cover
In-Patient or Symptoms, which this release does not touch.
