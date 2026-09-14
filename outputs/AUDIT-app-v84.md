AUDITED-COMMIT: 2bfe0d6
VERDICT: BLOCK

# Zero Day Audit — ChemoWell app-v83 + app-v84, THIRD PASS

**HEADLINE: the medication editor is still frozen on the one path that matters most — the first-run
guided tour. `#tour-layer` is `position:fixed; inset:0` and deliberately `pointer-events:none`, so it
trips the new `anyOverlayOpen()` measurement even though it takes no gestures at all. The page is
locked for the WHOLE tour, and on the tour's own step 4 — "Tap Add medication at the bottom" — the
editor renders 2,387px tall inside an 844px frozen viewport with no inner scroller and the Add
medication button 1,354px below the fold. A brand-new user cannot add their first medication.
BLOCK B was fixed on the path the suite tests and left broken on the path a new user takes.**

**SECOND BLOCK, at the check level: a mutant that deletes the off-day and treatment-excluded cards
from Home — a medication vanishing, a dose not given — passes the whole suite, 78/78.**

Measured in Chromium at 390×844 against a clone of 2bfe0d6 served on its own port. The working tree
was not modified other than this file.

## Status of the three fixes this pass was asked to judge

| Fix | Verdict |
|---|---|
| **A — one predicate (`medWithheldNow`)** | **HOLDS.** No remaining state where Home withholds and Meds says Available; and no medication lost its Home card (proof below). |
| **B — measured overlay detection + scroll lock** | **BLOCK 1.** Correct for every real modal; wrong for the tour layer, which is the layer the med editor opens under on first run. |
| **C — `dailyCeiling()` returns `windowH`/`group`** | **HOLDS for the bar.** The same guess-from-the-medication defect is still live one level up, in `status()` (N1), and the new `group` flag carries two false cases (N2). Both are unreachable from the editor, so neither blocks. |
| **D — the suites** | **BLOCK 2.** A mutant that makes the off-day and excluded cards VANISH from Home passes 78/78: section 2 treats "no card at all" as Home withholding, so the rewritten filter's dangerous direction is unguarded. See the sweep. |

---

# BLOCK 1 — The guided tour freezes the page, and the first medication cannot be saved

`renderTourLayer()` returns, on every step:

    index.html 4950  h('div', { id: 'tour-layer', style: { position:'fixed', inset:'0', zIndex:'80', pointerEvents:'none' } }, …)
    index.html 4979  (same, plus #tour-scrim, also pointerEvents:'none')

The layer is full-screen by construction and **transparent to every gesture on purpose** — its own
comment says so in as many words: *"pointerEvents:'none' lets every gesture pass straight through to
the real page"*, added in v48 precisely so the user can tap and scroll the real screen while the
guide is up. `anyOverlayOpen()` asks only about `position`, `display`, `visibility` and size, so it
answers **true** for it, and `applyScrollLock()` freezes the body for the entire tour.

**Reproduction — the first-run path, no medications, nothing skipped.**

| Tour step | body locked | documentElement.scrollHeight | body.scrollHeight |
|---|---|---|---|
| 1 "Welcome" | yes | 844 | 1,177 |
| 2 "Tap Meds" | yes | 844 | 1,177 |
| 3 "Tap Add" | yes | 844 | 844 |
| **4 "Fill in the details"** | **yes** | **844** | **2,387** |

At step 4, with the editor open:

    inner scroll containers      : 0
    buttons below the fold       : 10 of 21
    "Add medication"             : top 2198   ← 1,354px below an 844px viewport
    window.scrollTo(0, 800)      : lands at 0
    Playwright click             : timed out, element outside the viewport

The step's own instruction is *"Fill out the form, then tap Add medication at the bottom."* It cannot
be done. The step advances on `med:saved`, so the guide cannot progress either; the only way out is
"Skip this step" or "Skip". **Ending the guide does release the lock** — measured: locked → false,
docH 844 → 2,387, Add medication clickable — so this is recoverable, by abandoning the onboarding
that exists to get the first medication in.

This is the SAME defect the previous round blocked on, on a different route. `medEditor` is no longer
an overlay, so Meds → Edit is fine (measured: not locked, body 6,187px, "Save changes" clickable).
The editor opened **from the tour** is frozen exactly as before.

**Why no check saw it.** `test/v84-whatsnew.mjs` section 7c is the check written for this exact
regression — and its `freshPage(true)` clicks **"Skip guide"** before it does anything, then opens the
editor from the Meds screen. It exercises the one path that works. The precondition of the check is
the dismissal of the thing that breaks it.

**Fix, one line, and it is the honest test:** a layer that does not take the pointer is not covering
the screen. In `anyOverlayOpen()`, skip elements whose computed `pointerEvents === 'none'`, beside the
existing `display`/`visibility` tests. `#tour-layer` and `#tour-scrim` both declare it deliberately;
every real modal in the file (13 of them are `position:'fixed', inset:'0'`) intercepts taps and is
unaffected. Then add a case that walks the tour to step 4 and asserts the save button is reachable —
the existing 7c with the Skip removed is most of it.

---

# What holds, measured rather than assumed

## A — the predicate, and the card filter it replaced

**No medication lost a Home card.** The two filters are not merely close; the new one is a superset,
and the proof is in the order of `medWithheldNow`'s tests:

    old:  m.quickLog && (m.paused || !treatmentOnlyBlocks(m,now) && !(m.treatmentOnly && status(m).courseComplete))
    new:  m.quickLog && (m.paused || !(w.reason === 'courseWindow' || w.reason === 'courseComplete'))

`courseWindow` IS `treatmentOnlyBlocks`, tested in the same position, so that clause is identical.
`courseComplete` is reached only after `excluded` and `offDay` have both said no, so the new filter
hides a **subset** of what the old one hid: every medication that kept a card keeps it. The one
divergence is in the safe direction and is listed as N3 below.

**`dueMeds` / "Take all" / Up-next are unchanged.** The predicate adds `courseComplete`, but
`status()` returns `{ locked: true, courseComplete: true }` — the same object — so `!s.locked` already
excluded it. Same for `paused` (`{ locked: true, paused: true }`). Nothing is withheld that was
offered before.

**Is the `courseComplete` branch reachable? Yes, but only just — and it should stay.** It needs a
`win` medication, treatment-only, with a treatment date such that `treatmentOnlyBlocks` is false today
and true tomorrow (a zero-day after-window with today's date), every window today already closed or
used, and today a scheduled day. Narrow, but real, and it is the shape the second audit found on
Home. Keeping it costs nothing and deleting it would put the pill and Home's filter out of step again,
which is the whole reason the predicate exists.

## B — everything about the lock other than the tour

* **The walk is free**: 5.7 µs per `anyOverlayOpen()` call, so ~0.0006% of a one-second tick.
* **Scroll position is restored exactly**, with the page scrolled by script rather than by Playwright
  (which auto-scrolls and produced a misleading reading in the last round): scrollY 900 → the lock
  records `top: -900px` → Back pops `timeModal` → scrollY 900.
* **Back releases it**, not only a button.
* **No modal is missed.** Inventory: 13 layers are `position:'fixed', inset:'0'`. Eleven are real
  overlays with a tap-intercepting backdrop (time sheet, drawer, check-in, info, upgrade, erase-all,
  the bottom sheets, …) and all lock. The two that are not: the tour layer (BLOCK 1) and the loading
  splash (N4).
* **The time sheet was measured directly**: opened from Home at scrollY 400, `covers: true` at depth 1,
  body locked, page immovable behind it.
* Zero page errors and zero console errors across every fixture in this pass.

## C — `dailyCeiling()`, branch by branch

| Medication | `used` from | `windowH` | `group` | Bar says | True? |
|---|---|---|---|---|---|
| plain daily mg | `dailyDoseMg` | 0 | false | "N mg left today", no rolling line | yes |
| rolling mg (`rollingCeilingH`) | `rollingDoseMg` | the hours | false | "left in the last 4h" + frees-up line | yes |
| pills unit (`ceilingUnit`) | `dailyPills` | 0 | **undefined** | "left today" | yes |
| pills unit **+** `rollingCeilingH` | `dailyPills` | 0 | undefined | "left today" | **yes — this is the fix** |
| mg **+** `ceilingGroup` | `dailyGroupMg` | 0 | true | "today" + shared-limit line | yes |
| mg **+** group **+** rolling | `rollingDoseMg` (this med only) | the hours | true | shared-limit line | **no — N2** |
| pills **+** `ceilingGroup` | `dailyPills` (this med only) | 0 | undefined | no shared line | **no — N2** |

`medCeilingBar` is the only consumer of the two new fields (seven call sites; the other six read only `used`, `max`, `label` and `unit` — none reads `windowH` or `group`), so
nothing else broke on them.

---

# NON-BLOCKING FINDINGS

## N1 — `status()` still guesses the window from the medication, which is BLOCK C's other half

    index.html 2533  const dc = dailyCeiling(med);
    index.html 2535  if (med.rollingCeilingH) { … rollingCeiling: true, availableAt: rollingCeilingAvailableAt(med) }

Identical shape to the defect just fixed: `dc.used` may have come from the **pills** branch while the
line below reads `med.rollingCeilingH` and declares the lockout rolling. For a pills-unit medication
carrying a rolling window the pill then reads *"Limit reached for now"* and Home prints *"Next dose at
HH:MM"* computed by `rollingCeilingAvailableAt`, which sums `mg` — zero for a pills medication — so the
time is derived from nothing. The fix was made where the audit pointed and not where the same mistake
lives twenty lines away. Read `dc.windowH` here too.

## N2 — the new `group` flag is set on the wrong two cases

`group: !!med.ceilingGroup` is attached in the mg branch regardless of which sub-branch computed
`used`. So a grouped **rolling** medication prints *"This limit is shared with other medications — the
figure above counts all of them, not this one alone"* over a figure that counts **only** this one
(`rollingDoseMg(med.id, …)`). And the pills branch never sets `group` at all, so a grouped pills-unit
medication counts only itself against a shared maximum and says nothing about it. Both are Rule 2.7
question 3 — a sentence that is wrong about what the number means. Neither `ceilingGroup` nor
`rollingCeilingH` is settable in the medication editor, so neither is reachable for a user-created
medication today; that is the only reason this is not a block. `group` should be `!!med.ceilingGroup
&& !isRolling` and should be set in the pills branch as well.

## N3 — the card filter's one divergence, in the safe direction

A `treatmentOnly` medication whose course is complete AND which is also excluded near a treatment day
or not scheduled today used to vanish from Home; it now keeps a card (the `excluded` / `offDay` reason
is returned first, and neither is in the filter's hide list). It renders as the inert excluded row or
as an ordinary off-day card behind the red override, and the Meds pill agrees with whichever it is —
so nothing is inconsistent and no dose is lost. Noted only so the next reader does not mistake it for
an accident.

## N4 — the loading splash locks the body on every cold start

`!state.loaded` renders `position:'fixed'; inset:'0'` at z-index 100, so `applyScrollLock` engages
during startup and releases when data arrives. Harmless — scrollY is 0 then — but it is a lock nobody
declared, and it means `window.scrollTo(0, 0)` runs on every launch. Worth one line in the comment
that lists what is deliberately exempt, since that list is now the only record of intent.

## N5 — the tour cannot scroll to its own targets while the lock is on

`positionTour()` calls `el.scrollIntoView({ block: 'center' })` on each new step. With the body fixed
that call cannot move anything, so any highlighted target below the fold stays below the fold. It is
invisible today because the steps that highlight anything low point at the fixed bottom nav; it stops
being invisible the moment a step points at something in the page. The pointer-events fix in BLOCK 1
fixes this too.

---

# FALSIFICATION SWEEP — my own mutants, not the builder's

Seven mutants against a throwaway clone of 2bfe0d6 on its own port, via `./falsify.sh`
(`FALSIFY_PORT=8941`), suite `test/v83-meds-and-reports.mjs`. Baseline green.

Mutants applied to private clones of 2bfe0d6, each served on its own port, suite run against the
clone. Baseline green on both suites (v83 78/78, v84 33/33).

| Mutant | Result |
|---|---|
| `anyOverlayOpen()` always returns false — no scroll lock anywhere in the app | **killed** by v84 — *"the page does not scroll behind the notice"* (600px). v83 is blind to it (78/78), which is right: the lock checks live in v84. |
| the `courseComplete` gate is deleted from `medWithheldNow` (the third BLOCK, verbatim) | **killed** — and the check that went red is the PRECONDITION one, *"Home withholds a medication on the last day of its course — otherwise this comparison proves nothing"*. That is the guard against a vacuous comparison doing its job. |
| the ceiling bar reads `med.rollingCeilingH` again instead of the branch that ran (BLOCK C, verbatim) | **killed** (2 checks) — *"a figure that is actually daily says today, whatever flags the medication carries"*. |
| **Home's card filter hides an off-day and a treatment-excluded medication too — the card VANISHES** | **SURVIVED — 78/78 green.** |

**The survivor is the one that matters, and it is the exact regression this release was most at risk
of.** Section 2 compares the two screens through

    const homeSaysNo = !cardForIt || explainedAsHeld;

so **"no card at all" counts as Home withholding**. Every check in that section passes when the
medication disappears from Home entirely — which is the failure the brief for this pass called worse
than the bug, and which this file's own comments call out twice as reading like data loss to an
anxious caregiver. The suite protects the hide direction of the rewritten filter and is blind to the
show direction.

**Required before ship:** for the off-day and treatment-excluded cases, assert `cardForIt` is TRUE
*and* explained. `!cardForIt` may only be accepted for the `courseWindow` / `courseComplete` cases,
where vanishing is the intended design. One line each, and the mutant above is the falsification.

Mutants 5-7 (the pill stops asking `treatmentExcludedNow`; the temperature out-of-range fallback
returns; `windowH` dropped from the rolling branch) were not re-run here — `./falsify.sh` was killed
after 15 minutes at the time cap. Note for whoever uses it next: it pipes every run through
`grep | tail`, so it prints NOTHING until the whole sweep ends, and a 7-mutant sweep of this suite is
~15 minutes of silence. Two of the three are reported killed by the previous pass; I have not
independently confirmed them.

`test/v84-whatsnew.mjs` 33/33 and `test/v75-no-other-patient.mjs` 27/27 at this commit — product
neutrality holds: no patient name, no gendered pronoun, no care-plan dose, and the three ratchet
counts are unmoved. The only storage write in either release is still `chemowell-app-seen-version`;
no new write path, no `removeEntryDB` on any path this release touches.
