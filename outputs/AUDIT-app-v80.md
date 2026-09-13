AUDITED-COMMIT: 24b4c7f9ea05a9b5abcf535a76299b162f8f475d
VERDICT: DO NOT SHIP

# Zero Day Audit — app-v80, "Up next" on Home

## The headline, in plain words

**The new card can tell a caregiver that a medication is due when the app itself says it never is.**

If you set a medication's "Days taken" to **"As needed"** — an option the medication editor offers
in one tap, with its own help text reading *"Available any day — missed doses are never flagged for
this medication"* — the new orange card at the top of Home names that medication and says
**"Due now"**, with a button reading **"Go to [medication]"**. The card below it, on the same screen,
says **"Available"**. Nothing about that medication is late. Nothing about it is scheduled. The app
will never flag a missed dose for it. The new card announces it as the next thing to give.

That is the exact thing this release told itself it must never do. Its own commit message says
as-needed medications are excluded *"on purpose"* because *"a card headed 'Up next' saying so
invites a dose nobody asked for."* The exclusion was written for one shape of as-needed medication
and missed the other one.

Observed, not reasoned: with a medication configured that way, Home renders
`UP NEXT / PrnScheduled / 1 tab / Due now · Now / 0/1 DOSES / Go to PrnScheduled`.

**Two other blocks and six ranked findings follow. The release's central safety claim — that it
writes nothing — is TRUE and I could not break it.**

---

## First: the write model. Proven, not accepted.

The claim was that this release appends nothing, deletes nothing and writes no record.

I checked it mechanically rather than by reading the argument. Every added line of `index.html` was
searched for `addEntryDB`, `removeEntryDB`, `setPrefsDB`, `localStorage`, `sessionStorage`,
`setItem`, `removeItem`, `fetch`, `XMLHttpRequest`, `logMed`, `confirmTimeAndLog`, assignment to
`state.entries`, and any push onto an entry array. **There are none.** The only two mutating calls
the diff adds are `setState({ medFlash: ... })` and its 1800 ms clear; `setState` assigns to the
in-memory `state` object and calls `render()`, and touches storage nowhere.

`nextDueDose`, the hero body and the dose ring are all pure reads over `status()`, `medWindowsFor()`
and `doseProgressToday()`. The hero's button calls `scrollToMedCard`, which scrolls and sets a flag.

**The write model holds. No record can be created, changed or destroyed by this release.** That was
the right thing to state before writing a line, and it is the reason the findings below are about a
caregiver being misinformed rather than about data being lost.

Rule 0 also clean: no patient name, no gendered pronoun, no care-plan dose or ceiling, and no new
branch keyed to a medication id anywhere in the diff. `v75-no-other-patient` passes 27/27 with the
ratchet unmoved.

---

## BLOCK 1 — The hero names an as-needed medication as "Due now"

**Reachable in the shipped UI in two taps, and the app disagrees with itself on the same screen.**

`saveMedicationEditor` writes `type` and `scheduleDays` independently. A **scheduled** medication —
`type: 'win'`, with real time windows — can have its "Days taken" control set to `asneeded`. The
option is even labelled differently for that case: `form.type === 'win' ? 'As needed' : 'No set days'`.

Downstream, every other consumer honours that setting and `nextDueDose` does not:

| Consumer | Treats an as-needed scheduled med as… |
|---|---|
| `normalizeMedication` | `alerts: false` — *"as-needed meds don't"* get missed-dose tracking |
| `missedDosesFor` | filtered out entirely (`m.alerts && m.windows`) |
| `medScheduledOn` | returns true, with the comment *"available any day, just never 'due'"* |
| the medication card | renders "Available" |
| **`nextDueDose` (new)** | **"Due now"** |

`nextDueDose`'s only as-needed guard is `if (!(med.windows && med.windows.length)) continue;`. That
catches a `type: 'gap'` medication — but `normalizeMedication` deletes `windows` from every gap
medication anyway (`if (type === 'win') medication.windows = …; else delete medication.windows;`),
so the guard is checking a condition that the normaliser has already made impossible to violate. It
never looks at `scheduleDays.mode`, which is where the user actually said "as needed".

The commit message asserts the hero *"draws the same line `doseProgressToday` and the missed-dose
walk already draw."* It does not. The missed-dose walk draws its line on `alerts`; the hero draws
its line on `windows.length`. Those are the same line for a gap medication and different lines for
this one.

**The fix is one clause:** skip a medication whose `scheduleDays.mode === 'asneeded'`. The
alternative — key on `med.alerts`, which is exactly what the missed-dose walk uses — makes the two
provably identical and is the version I would ship.

**And the new suite cannot see this.** Its as-needed case (`test/v80-up-next.mjs`, section 2) builds
`{ type: 'gap', gapH: 4 }` with no windows — the shape the structural guard already excludes. The
shape the user can actually create is untested.

---

## BLOCK 2 — The hero's only button can do nothing at all, and for a grouped medication it lands nowhere

Two separate defects in `scrollToMedCard`, both reachable from placement options the medication
editor offers by name.

**2a. "Managed only (no Home card)" — the button is dead.** `medCards` renders only
`state.meds.filter(m => m.quickLog && …)`. `nextDueDose` iterates all of `state.meds` with no such
filter. So a scheduled medication whose placement is "Managed only (no Home card)" is named by the
hero, and `scrollToMedCard` finds neither `[data-med-card="nocard"]` nor `[data-med-card-nocard]`,
hits `if (!el) return;` and **returns silently — no scroll, no highlight, no toast, nothing.**

Observed: hero reads `UP NEXT / ManagedOnly / Due now / Go to ManagedOnly`; own card count 0, group
card count 0; after tapping, `[data-flash="on"]` count 0.

This is worse than a dead control. The caregiver is told a dose is due, told where to go, taps, and
the screen does not move. There is no card on Home from which that dose can be logged at all.

**2b. A grouped medication scrolls to a card that never lights up.** The group hook
(`data-med-card-<id>`) is written onto the group `<section>`, but `data-flash` is only ever rendered
onto an individual Quick Log card. So for a medication in the Morning/Afternoon/Evening group,
`scrollToMedCard` scrolls correctly, sets `state.medFlash`, and **nothing on screen changes.**

Observed: group hook present (1), `[data-flash="on"]` after tap: **0**.

This is precisely the failure the release says it caught and fixed. Its own commit message: *"On a
phone the ring would have flashed and vanished, leaving the caregiver on a card with nothing marking
it."* It was fixed for standalone cards and left in place for grouped ones — and grouped medications
are the common case for the morning and evening rounds. Section 4 of the suite tests only
`quickLog: true`, standalone.

**Minimum fix:** exclude `!med.quickLog && !grouped` medications from `nextDueDose` (or render a
Home card for them), and render the flash on the group section as well as the individual card.

---

## BLOCK 3 — Two of the four guarantees this release makes are not protected by any check

The commit message names four things the hero must never do: name a medication that is *already
logged in its window*, *paused*, *not scheduled today*, or *blocked around a treatment day*.

I removed each guard from `nextDueDose` and re-ran `test/v80-up-next.mjs`:

| Mutation | Suite result |
|---|---|
| delete `if (!medScheduledOn(med, now)) continue;` | **14/14 PASS** |
| delete `if (treatmentOnlyBlocks(med, now) \|\| treatmentExcludedNow(med, now)) continue;` | **14/14 PASS** |

Both mutants ship a hero that names a medication on a day it is not taken, or on a treatment day it
is blocked for, and the gate is green. The suite's section-2 header lists both cases in prose and
builds a fixture for neither: it tests *already logged* and *paused* only. Two of its four stated
guarantees are decoration.

The release claims *"falsified six ways"*. I do not doubt the six that were run; the six chosen were
all inside the two cases that do have fixtures. **Falsifying the mutations a suite already covers
measures nothing about the ones it does not.**

`index.html` was restored byte-for-byte after each mutation — see the closing section.

Needed before ship: a weekly fixture whose days exclude today, an interval fixture on an off day,
and a `chemoBlock` fixture on a treatment day, each asserting the medication is not named. I
verified by hand that the current code handles all three correctly (weekly off-day → no hero;
interval off-day → no hero), so this is writing the checks, not fixing the code.

---

## Ranked findings — real, not blocking on their own

**4. On a day with an unlogged past window, Home now shows no dose figure anywhere.**
The header ring is suppressed on Home unconditionally; the hero shows the figure only when it names
a medication, and the green card only when `taken >= scheduled`. In between — scheduled doses exist,
some are not logged, and every remaining window has closed — neither renders. Observed:
`{ ringsAnywhere: 0, hero: false }`. The release argues that a card which vanishes "looks broken at
the exact moment it should feel done"; it handled the finished day and left the unfinished one
vanishing, which is the case where the caregiver most needs a number. Suggested fix: suppress the
header ring only when the hero actually rendered.

**5. The hero prints the FIRST dose option as though it were the dose.**
`const firstDose = nx.med.doses && nx.med.doses.length ? nx.med.doses[0].label : null;`. A
medication carrying "Half dose 250 mg" and "Full dose 500 mg" renders
`UP NEXT / TwoStrengths / Half dose 250 mg / Due now` — observed. That is a dose statement, on the
most prominent card in a medication app, chosen by array position. It is not wrong for a
single-strength medication and it is arbitrary for every other. Either omit the dose when
`doses.length > 1`, or label it "Options: …".

**6. "Due in 0 minutes" is on screen for the thirty seconds before a window opens.**
`Math.round((nx.at - now) / 60000)` yields 0 for anything under 30 s. Verified across the boundary:
1 s, 20 s and 29 s all render *"Due in 0 minutes"*; 30 s flips to *"Due in 1 minute"*. At 2am a
caregiver reading "Due in 0 minutes" cannot tell whether to give it. Fix: `Math.ceil`, or fall
through to "Due now" under a minute. No negative values are possible (`Math.max(0, …)`) and the
wording does not otherwise flicker on the one-second tick.

**7. Tapping the hero twice kills the highlight instead of renewing it.**
`setTimeout(() => { if (state.medFlash === safe) setState({ medFlash: null }); }, 1800)` — the first
tap's timer is not cancelled, and because both taps carry the same id its equality guard passes. Tap
the same button twice 1.2 s apart and the highlight is **off** 0.7 s after the second tap (observed:
0 flashed elements), so the second tap looks like it did nothing. Fix: keep the timer id in a
module-level variable and `clearTimeout` it, as `toastTimer` already does two lines away.

**8. The `h()` null-attribute trap, in this diff.**
`'data-flash': flashed ? 'on' : null` — `h()` falls through to `el.setAttribute(k, v)`, which
stringifies `null`. Every unflashed medication card ships `data-flash="null"`. Observed:
`{ anyDataFlash: 1, flashOn: 0 }` with nothing flashed. Harmless today because the suite selects
`[data-flash="on"]`, but this file carries two long comments warning about this exact trap (the
disabled-input fix, the reorder-arrow fix) and the release added a third instance of it. Omit the
attribute with a spread, matching the pattern used elsewhere in the file.

**9. Designer — rendered at 320, 360 and 390.** *(This sandbox has Chromium only. An iPhone's
rendering, its font metrics and its safe-area insets cannot be reproduced here; the hero must be
opened on the two real phones before this is called verified.)*
Screenshots in `outputs/v80-audit-shots/`.

- No horizontal overflow at any width (`scrollWidth === clientWidth` at 320/360/390). Button is
  48 px minimum height everywhere except one case below. Card width 288/328/358.
- **At 320 with a long medication name the hero grows to 316 px and its only control is pushed
  underneath the fixed bottom tab bar** — visible in `hero-320-longname.png`. Reachable by
  scrolling, but on first paint the button is half-covered. The name wrapping is correct and should
  stay; the card needs bottom clearance for the nav.
- **Contrast: the "UP NEXT" label is 2.69:1.** `rgba(255,255,255,0.82)` over the gradient's top stop
  `#E4693B`, at `TYPE.label`'s 12 px uppercase. WCAG AA wants 4.5:1 for text that size. The "DOSES"
  caption inside the ring is 8 px, which is below any reasonable floor on a phone. The medication
  name, the "Due now" line and the button are all fine.
- The hero is not the first thing on Home in the browser build — the "You're using the web preview"
  notice sits above it and pushes the hero below the fold at 320 (`home-320-normal.png`). Dismissible
  and presumably absent in the Capacitor wrap, so noted rather than filed.

---

## VOICE — every new caregiver-facing string

| String | True? | Verdict |
|---|---|---|
| "Up next" | Not for an as-needed medication, and not for one with no card to go to | **See Blocks 1 and 2** |
| "Due now" | Correct for an open, unlogged, scheduled window | OK |
| "Due in N minutes" | Renders "0 minutes" for 30 s | **Finding 6** |
| "Due at H:MM" | Correct; `fmtTime`, same formatter as the rest of the app | OK |
| "Go to [name]" | Sometimes goes nowhere | **Block 2a** |
| "Show me the card" | Fine, and better than "Go to" — plain, no promise about timing | OK |
| "All scheduled doses are in" | True: `doseProgressToday` and `missedDosesFor` agree on this fixture — I built the double-logged-in-one-window case expecting them to disagree and **they did not** (the walk credits a second early dose to the later window). | OK |
| "Nothing else is scheduled today. As-needed medications are still available below." | True where such medications exist; slightly overpromising where the user has none | OK, minor |

**Does the dose ring's figure belong on this card at all?** Yes, and this is the good judgement in
the release. "2 of 4 doses logged today" is a count of discrete scheduled events, which is a figure
a clinician and a caregiver both use — unlike the paracentesis average this project removed, it is
not an average of things that accumulate over time. Putting it beside the medication it is about,
and removing the duplicate from the header, is right. Verified there is exactly one such figure on
Home and that the header ring returns correctly on Meds (observed 1/1/1 across home → meds → home).

**Two strings the release did NOT add but now reads worse beside:** the hero says "Due now" while
the medication's own card below says "✓ Available". They mean the same thing and use different
words, two inches apart, on the most-read screen in the app. Worth one line in a later release.

## ENHANCER note (one line, since it belongs to the release message)

Nothing to propose that this release should widen into. The one structural gap the audit surfaced —
a medication with no Home card can be named as due but not logged from Home — is Block 2a and is a
correctness fix, not an enhancement.

---

## What passes

All ten suites green on the shipped commit: v75-no-other-patient 27/27, v75-table-builder 96/96,
v75-med-description-shots all, v76-properties-equivalence 22/22, v76-empty-window-render 13/13,
v77-legacy-migration-equivalence 36/36, v78-fence-removed 20/20, v79-home-cards-render 20/20,
v79-warning-priority 14/14, v80-up-next 14/14.

Attacks that failed to break it, said out loud so nobody re-runs them:

- A medication whose `windows` key is absent entirely — `nextDueDose` skips it and Home renders.
- A medication with no `doses` and no `sub` — the separator does not appear; the card is clean.
- A weekly schedule excluding today, and an every-other-day schedule on an off day — no hero. Both
  correct in the code, both unprotected by a check (Block 3).
- A `type: 'gap'` medication carrying windows in stored config — `normalizeMedication` deletes them.
- A medication name of `<img src=x onerror=alert(1)>…` — rendered as text through
  `document.createTextNode`, zero elements injected, no page error.
- Two medications open in the same window — deterministic, first in list order, same order the cards
  draw in.
- Divide-by-zero in the ring — guarded by `prog.scheduled > 0`; `taken` is capped per medication at
  the window count so the ring cannot exceed 100%.
- No page errors at any point in any fixture.

## What must happen before this ships

1. Exclude `scheduleDays.mode === 'asneeded'` from `nextDueDose` — preferably by keying on
   `med.alerts`, which makes it provably the same population the missed-dose walk uses.
2. Exclude medications with no Home card, or give them one; render the flash on the group section.
3. Add three fixtures to `test/v80-up-next.mjs` — as-needed-scheduled, managed-only, grouped — and
   three more for weekly-off-day, interval-off-day and treatment-blocked. Falsify each by deleting
   the guard it protects and watching it go red. The two mutations in Block 3 are the acceptance
   test for that work.

Findings 4–9 are a follow-up release, except 6 ("Due in 0 minutes"), which is a two-character change
and should go in the same commit.

---

*Probe scripts used for every observation above are in `outputs/v80-audit-probes/` (gitignored by
`outputs/**/*.mjs`, so kept locally); screenshots in `outputs/v80-audit-shots/`.*
