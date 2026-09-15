AUDITED-COMMIT: 1c50c87
VERDICT: BLOCK

# Zero Day Audit — ChemoWell app-v84, FOURTH PASS

**HEADLINE: a mutant that freezes the page exactly while the medication editor is open under the
first-run guide — which is the BLOCK-1 failure verbatim, a brand-new user unable to add their first
medication — passes `test/v84-whatsnew.mjs` 37/37, all green. The app fix HOLDS; the check written
to defend it does not. Case 7d measures the first frame of the tour and stops: the layer is up, the
body is not fixed, the page scrolls, a "Skip guide" button exists. It never reaches step 4, and step
4 is the step that broke. The previous pass asked in writing for "a case that walks the tour to step
4 and asserts the save button is reachable"; none of that is in the case that landed.**

**SECOND BLOCK: `test/v83-meds-and-reports.mjs` is 75/80 on an unmodified clone of 1c50c87 right
now.** The commit message's "80/80" is true only for part of the day. Section 1 places "today's
doses" at `now - 5h` and `now - 6h`, so before about 06:00 local those doses are yesterday and five
checks go red. `test/v80-up-next.mjs` in this same repo already freezes the clock for exactly this
reason and says so in a comment.

Measured in Chromium at 390×844 against private clones of 1c50c87, each served on its own port
(8971, 8981-8984). The working tree was not modified other than this file.

## Status of the four things this pass was asked to judge

| | Verdict |
|---|---|
| **1 — the tour-layer freeze (`pointerEvents === 'none'`)** | **The fix HOLDS in the browser, end to end.** No real modal is unlocked by it. The claim that it also released the loading splash is **false** (N1). |
| **2 — the Home/Meds comparison check + `data-med-card` on the inert cards** | **HOLDS, both halves.** The vanishing-card mutant is now killed; nothing that keys off `[data-med-card]` regressed. |
| **3 — `status()` reads `dc.windowH`; `group` is `!isRolling && !!ceilingGroup`** | **HOLDS for the two cases named.** The same misread survives at three further call sites (N2) and the pills/group figure is still wrong behind an honest label (N3). |
| **4 — my own falsification sweep** | **BLOCK 1** (M4 survives 37/37) and **BLOCK 2** (the suite is clock-dependent). Two more named checks overstate what they assert (N4, N5). |

---

# BLOCK 1 — The first-run freeze is fixed in the app and unguarded in the suite

## The fix works. Measured, not read.

A genuinely fresh install (no storage, setup completed in the browser: name, sex, treatment type),
then every tour step walked with a real click, scrolling the page at each one:

| Step | body locked | page scrolls | note |
|---|---|---|---|
| 1 Welcome | no | yes (28px, page is 872px) | `#tour-layer` present, computed `pointer-events: none` |
| 2 Tap Meds | no | yes | |
| 3 Tap Add | no | page is 844px, nothing to scroll | |
| **4 Fill in the details** | **no** | **yes — scrollY 600 of a 2,387px page** | "Add medication" at top 2198, **clicked successfully** |
| 5 Nice work | no | yes | the guide **advanced on `med:saved`** — banner read "GUIDE · 5 OF 10" |
| 6-10 | no | yes | Finish ends the guide; `#tour-layer` count 0, lock released |

`MyMed` is in `…-med-v1` afterwards. Zero page errors across the whole walk. **The defect the third
pass blocked on is gone on the path a real new user takes.**

## Attacking the fix itself: nothing real is unlocked

`pointer-events: none` appears exactly five times in the file (grep, whole file):

| Element | Full-screen? | Why it has it |
|---|---|---|
| `#tour-layer` (banner form, 4973) | yes, `inset: 0` | deliberate — taps pass through to the page |
| `#tour-layer` (card form, 5002) | yes, `inset: 0` | same |
| `#tour-scrim` (5003) | yes, `inset: 0` | purely visual dim since v48 |
| toast (4738, 5117) | no — a pill at the bottom | Rule 5.5 exemption, asserted scrollable on purpose |
| Reports "↩ Back" wrapper (5134) | no — a strip above the nav | its button re-enables `pointer-events: auto` |
| safe-area probe (124) | n/a | `visibility: hidden`, and not a child of the page |

No stylesheet rule sets `pointer-events` anywhere — the only two matches outside these are the new
comment itself. **Every one of the 13 full-screen fixed layers that is a real modal intercepts taps**
(`#tour-card` and `#tour-banner` both set `pointer-events: auto` on their own panels, so they are
tappable while their wrapper is not — that is the intended shape, and it is the shape the brief asked
me to look for going the other way). There is no modal in this app whose OUTER element is
`pointer-events: none`, so the line unlocks nothing that should lock.

## And here is what it does not guard

**M4** — `anyOverlayOpen()` skips a `pointer-events: none` layer *unless the medication editor is
open*:

    if (cs.pointerEvents === 'none' && !document.querySelector('[data-tour="med-editor"]')) continue;

That is one line, and it is BLOCK 1 restored exactly. Measured against the mutant on its own port,
same fresh-install walk:

| Step | body locked | scrollY after `scrollTo(0, 600)` | "Add medication" |
|---|---|---|---|
| 1-3 | no | scrolls | — |
| **4 Fill in the details** | **yes** | **0** | **click TIMED OUT — outside the viewport** |

Document height 844 against a 2,387px body, no inner scroller, 10 of 21 buttons below the fold. A
brand-new user cannot add their first medication, the step only advances on save, so the guide
cannot move either. **`test/v84-whatsnew.mjs` against that build: 37 checks, 37 passed, 0 failed.**

**Why 7d cannot see it.** The case loads the app, writes `patientName`/`onboarded`, reloads, and
asserts four things about **tour step 1**: a `#tour-layer` exists, `document.body.style.position`
is not `fixed`, `window.scrollY > 0` after a scroll, and a "Skip guide" control exists. It never
taps Meds, never taps Add, never opens the editor. The defect it was written for lives at step 4.

It is a genuine improvement over 7c — it does not dismiss the guide, and it **does** kill the total
revert (M3: the `pointerEvents` line deleted → 2 failures, *"and the page is NOT frozen by it |
fixed"*, *"and the page still scrolls while the guide is up | 0px"*). But the release message should
not carry "there is a case now that deliberately does NOT skip the guide" as if the regression class
were covered. **It covers the first frame.**

**Required before ship:** 7d walks to the editor step — tap `[data-tour="nav-meds"]`, tap
`[data-tour="meds-add"]`, then assert the body is not fixed, that the page scrolls with the editor
open, and that the "Add medication" button is clickable. M4 above is the falsification, and it takes
about twelve lines. The walk in this report runs in eight seconds.

---

# BLOCK 2 — The suite's green depends on the wall clock, so "80/80" is not reproducible

An unmodified clone of 1c50c87, served on its own port, run at 02:44 local:

    80 checks: 75 passed, 5 failed

      FAIL  and says how many doses today                    |  None logged today
      FAIL  and when the last one was                        |  None logged today
      FAIL  and a ceiling bar reading used of max            |  0 / 3,000 mg | 3,000 mg left today
      FAIL  and how much is left, not just how much is gone  |  0 / 3,000 mg | 3,000 mg left today
      FAIL  the pill is right for a medication at its daily limit  |  Available

Run twice, identical both times — not flake. The cause is in the fixtures: section 1 logs "today's"
doses at `now - 6 * HOUR` and `now - 5 * HOUR`, and section 2's daily-limit case does the same. Any
run before roughly 06:00 local puts them on yesterday, so the card correctly says *"None logged
today"* and the checks correctly fail. **Between about 05:00 and 06:00 only one of the two lands on
today**, which gives a third distinct result.

This fails loudly rather than passing falsely, so it is not a vacuous check — but it means the
evidence in the commit message cannot be reproduced, a night run of `release_check.sh` blocks the
release for a reason that is not in the app, and nobody reading "80/80" can tell which it was.

**The repo already has the fix and the reasoning.** `test/v80-up-next.mjs` freezes `Date` at 10:00
via `addInitScript`, with a comment saying in as many words that *"a fixture whose meaning depends on
when it is run is a fixture that reports green for the wrong reason on some days."* v83 needs the
same five lines. (`test/v80-up-next.mjs` is 48/48 at this commit; `test/v84-whatsnew.mjs` 37/37;
`test/v75-no-other-patient.mjs` 27/27 — none of those three is clock-dependent.)

---

# WHAT HOLDS, measured

## The Home/Meds comparison — both halves of the fix bite now

Mutants applied to private clones of 1c50c87, each on its own port. (The five clock failures above
appear in every v83 column and are excluded from the counts below.)

| Mutant | Result |
|---|---|
| **M1 — Home's card filter also hides `offDay` and `excluded`; the card VANISHES** (the survivor of the last pass, verbatim) | **KILLED**, 4 new failures |
| **M2 — the inert treatment-excluded card loses its `data-med-card` hook again** | **KILLED**, 2 new failures |
| **M3 — the `pointerEvents` line deleted (BLOCK 1 verbatim)** | **KILLED** by v84 7d, 2 failures |
| **M4 — the lock re-applied only while the med editor is open (BLOCK 1's user-facing failure, first frame intact)** | **SURVIVED — 37/37 green.** BLOCK 1 above |

M1's kill is the exact sentence that was missing:

    FAIL  and a medication not scheduled today KEEPS its card rather than vanishing from Home
          |  THE CARD IS GONE -- a medication that disappears is a dose not given

## Nothing else keyed off `[data-med-card]` meaning "a loggable card"

`data-med-card` has exactly two consumers in the app: `scrollToMedCard()` (2420-2421) and the flash
render at 6419. The hero's "show me the card" button (5924) is the only caller of
`scrollToMedCard`, and its list is `dueMeds` — `meds.filter(m => !medWithheldNow(m, now) && !status(m).locked)`
— so a paused, off-day, excluded, out-of-window or course-complete medication is never named by the
hero and the button that scrolls to it never exists. `missedDosesFor()` independently skips
`isPausedOn`, `treatmentOnlyBlocks` and `treatmentExcludedNow`, so no missed-dose row reaches an
inert card either. **`test/v80-up-next.mjs` is 48/48 at this commit**, including its two checks that
count `[data-med-card]` nodes — nothing miscounted. The hero cannot scroll to an inert card and
cannot mark one.

Latent, worth one line in a comment: **the inert branches render no `data-flash`**, so if a future
change ever did route `scrollToMedCard` at one, the page would scroll and nothing would light up —
the precise failure the 6419 comment records being caught once already.

## The ceiling shapes, table-checked again

| Medication | `used` from | `windowH` | `group` | `status()` calls the lockout | True? |
|---|---|---|---|---|---|
| plain daily mg | `dailyDoseMg` | 0 | false | daily | yes |
| rolling mg | `rollingDoseMg` | the hours | false | **rolling** (`windowH > 0`) | yes |
| pills (`ceilingUnit`) | `dailyPills` | 0 | **false** (was `undefined`) | daily | yes |
| **pills + `rollingCeilingH`** | `dailyPills` | 0 | false | **daily** (was "rolling") | **yes — N1 of the last pass, fixed** |
| mg + `ceilingGroup` | `dailyGroupMg` | 0 | true | daily | yes |
| **mg + group + rolling** | `rollingDoseMg` (this med alone) | the hours | **false** (was `true`) | rolling | **yes — N2's first half, fixed** |
| pills + `ceilingGroup` | `dailyPills` (this med alone) | 0 | false | daily | label true, **figure still wrong — N3** |

Product neutrality holds: `test/v75-no-other-patient.mjs` 27/27, all three ratchet counts unmoved.
The only storage write in this release is still `chemowell-app-seen-version`; this commit's diff adds
no write path and touches no `removeEntryDB`.

---

# NON-BLOCKING FINDINGS

## N1 — The loading-splash claim is false, in the commit message AND in the code comment

Both say the pointer-events line *"also releases the loading splash, which was locking on every cold
start."* Neither half is true.

* The splash (`index.html` 5138) is `position: fixed; inset: 0; z-index: 100` **with no
  `pointer-events` at all**, so its computed value is `auto` and the new `continue` never fires on
  it. The line does not touch it.
* And it was not locking. `document.body.style.position` polled every 8ms from the first frame
  through 3.5 seconds of cold start, 427 samples, never once `fixed`. Storage reads in synchronously
  (the subscribe comment at 12525 says so), so `state.loaded` is true before the first render and the
  splash does not survive to a render that calls `applyScrollLock()`.

So the previous pass's N4 was wrong in one direction and this comment is wrong in the other, and the
comment is the one the next reader will trust. Fix the sentence; a code comment that asserts a
behaviour nobody can reproduce is the same defect as a changelog that does.

## N2 — `med.rollingCeilingH` is still read raw at three more call sites

The `status()` fix reads `dc.windowH`. These do not:

* **6404** — the override prompt: `st.ceilingHit ? (med.rollingCeilingH ? 'Up to the ' + label + ' reached. Log more anyway?' : 'Daily limit of ' + label + ' reached…')`. Not gated on `st.rollingCeiling`. For a pills-unit medication carrying a rolling window, `status()` now correctly says daily and this prompt still says the rolling sentence — the two disagree on the same tap.
* **6618** — the description line: `'Up to ' + limit + ' ' + (med.ceilingUnit || 'mg') + ' per ' + med.rollingCeilingH + 'h'`, printed beside a bar reading "N left today".
* **2577** — `if (med.rollingCeilingH) return { locked: false };`, skipping the gap lockout on a medication whose ceiling was actually counted daily.

Not a block for the same reason as last pass: nothing writes `rollingCeilingH` for a user-created
medication (no `rollingCeilingH:` assignment exists in the file), so the combination is unreachable
today. But the fix was made at one of four sites, and the comment at 2550 now reads as though the
class were closed.

## N3 — `group: false` on the pills branch is an honest label over a wrong number

`dailyCeiling()` returns `used: dailyPills(med.id)` for a pills-unit medication — **this medication
alone** — even when `med.ceilingGroup` puts it in a shared limit whose `max` is the group's. Setting
`group: false` is truthful about what the figure counts and therefore correctly suppresses the
"shared with other medications" line. It also means a grouped pills medication now counts only
itself against a shared maximum **and says nothing at all about it**, which is the quieter of the two
wrong answers. Unreachable today (`ceilingGroup` is not settable in the editor either); worth a line
in the comment so the next reader does not read `false` as "not in a group".

## N4 — The comparison check derives its contract from an English label

    const expectsNoCard = /course/i.test(label);

Correct for all four cases today ("…treatment course has finished", "…last day of its course" expect
no card; the other two expect one). But rewording a label to "…whose treatment has finished" silently
flips that case to the opposite expectation. It fails loudly rather than quietly, so it is not
vacuous — it is one rewording away from asserting the reverse of what it means. A field on the case
tuple costs nothing and cannot drift.

## N5 — 7d's last assertion is named for something it does not measure

    t('the guide offers a way out, and it is reachable', seen > 0, seen + ' control(s)')

`seen` is `await skip.count()`. Nothing measures reachability — not visibility, not position, not a
click. The name is the part a future reader will trust, and it claims more than the check does. Given
that the whole subject of this release is a control that existed and could not be reached, this is
the wrong place to say "reachable" about a count.

---

# WHAT I DID NOT GET TO

* Only the four mutants above were run. I did not re-run the previous pass's mutants 5-7 (the pill
  dropping `treatmentExcludedNow`; the temperature out-of-range fallback; `windowH` dropped from the
  rolling branch), and I have not independently confirmed the kills reported for them.
* No 320px or 360px pass, and no non-Chromium rendering — this sandbox has Chromium only, which is
  the standing exemption on every release here.
* `pm.py`/`release_check.sh` were not run; I did not touch the working tree beyond this file.
