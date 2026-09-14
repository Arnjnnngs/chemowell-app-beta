AUDITED-COMMIT: a582058
VERDICT: BLOCK

# Zero Day Audit — ChemoWell app-v83 + app-v84

**HEADLINE: the status pill is wrong in the two states Home computes for itself. A medication that
Home refuses to give without a red confirm-to-override — one not scheduled today, and one excluded
around a treatment day — shows a green "Available" pill on the Meds screen. The claim written above
`medStatusPill` ("One source, so the two screens cannot disagree about whether a medication may be
given") is false, and the 45-check suite that asserts it never opens Home.**

Everything below was measured in Chromium against a clone of a582058 served over HTTP on its own
port. The working tree in /home/user/chemowell-app-beta was not modified.

---

## BLOCK 1 — The Meds pill says "Available" for a medication Home will not give (off day)

`renderMedicationManager` → `medStatusPill(med)` reads `status(med)` only. Home's card does not:

    index.html ~6205
    const offDay = !medScheduledOn(med, now);
    const st = status(med);
    const locked = !!st.locked || offDay;

`offDay` — the `scheduleDays` weekday/interval restriction — is applied **at Home's call site**, not
inside `status()`. `status()` has never heard of `medScheduledOn`. So the pill cannot see it.

**Reproduction.** One medication, `type:'gap'`, `scheduleDays: { mode:'weekly', days:[<a day that is
not today>] }`, nothing logged.

| Screen | What it says |
|---|---|
| Home card | `Not scheduled` · `Not scheduled today · Taken: Thu` · tapping Log arms the red *"Not scheduled today (Thu). Log it anyway?"* override |
| Meds card | pill reads **`Available`**, in the green available token (`#0A6B4A` on `rgba(46,125,79,0.10)`) |

A caregiver who opens Meds — which is the screen this release just made the place to look at what
has happened today — reads a green Available on a medication the app refuses to give one tab away.

## BLOCK 2 — Same defect, worse shape: a treatment-excluded medication

`treatmentExcludedNow(med, now)` is an **early return** in Home's card: the medication renders as an
inert dashed panel, *"Excluded near treatment day"*, with **no Log button at all** — there is not
even an override path. `status()` does not call `treatmentExcludedNow` either.

**Reproduction.** One medication with `treatmentMode:'excluded'`, `treatmentDaysBefore/After: 1`, and
a `chemo_date` entry stamped today.

| Screen | What it says |
|---|---|
| Home | no med card at all; an inert panel reading `Excluded Tabs / Excluded near treatment day` |
| Meds | pill reads **`Available`** |

This is the more dangerous of the two, because Home does not merely gate the dose — it removes the
button. The only screen offering an opinion is the one that says yes.

**The fix is one line of intent, not one line of code:** the pill must be computed from the same
expression Home locks on (`status()` **plus** `offDay` **plus** `treatmentExcludedNow`), or that
expression must move inside `status()` so there is genuinely one source. Moving it into `status()`
changes Home's behaviour too and needs its own equivalence pass; extending `medStatusPill` does not.

## BLOCK 3 — The ceiling bar prints a rolling-window figure as a daily allowance

`dailyCeiling()` returns three different things and `medCeilingBar()` renders them identically.
For `rollingCeilingH` the `used` figure is `rollingDoseMg(id, windowH, now)` — a **rolling** total —
and `dc.label` (which carries the `/ 4h` qualifier) is computed and then **discarded**: the bar reads
only `dc.max` and `dc.unit`.

**Reproduction.** `ceiling:true, ceilingMax:15, rollingCeilingH:4`; doses of 5 mg at 19h ago, 20h ago
and 30 minutes ago — 15 mg given today, 5 mg inside the rolling window.

    Meds pill       : "Available"
    Meds today line : "2 doses today · last at 6:48 PM"
    Meds ceiling bar: "5 / 15 mg"   "10 mg left"
    bar aria-label  : "5 of 15 mg used today"

Fifteen milligrams of a fifteen-milligram limit has been given today. The bar says 5, says **10 mg
left**, and tells a screen-reader user it is reporting what was used **today**. The doses-today line
immediately beside it disagrees with it on the same card.

Two further consequences of the same conflation:

* When the rolling window fills, the pill reads **"Daily limit reached"** while Home correctly reads
  *"Next dose at 10:48 PM"* — a four-hour lockout described on Meds as a daily one. (Measured.)
* This is Rule 2.7 question 3 exactly: the arithmetic is right and the sentence it forms is false.

The changelog then repeats the error in prose: *"A medication with a daily limit gets a bar showing
how much of it has been used and how much is left."*

Minimum fix: draw no bar for `rollingCeilingH` (a rolling window has no "left" that survives the next
minute), or label it with `dc.label` and change "left" to "in the last Nh", and fix the aria-label.

## BLOCK 4 — The temperature report labels readings "Last 4 weeks" that are ten weeks old

    index.html ~10613
    const inRange = all.filter(e => e.ts >= minTs);
    const points  = inRange.length ? inRange : all.slice(-2);

When nothing falls inside the chosen range the report **silently substitutes the last two readings
ever recorded** and changes no label. The chart, the three tiles and the Readings list are all
computed from `points`.

**Reproduction.** Three readings — 98.6 °F, 102.4 °F, 101.1 °F — all stamped ~70 days ago. Range
toggle left on **Weeks**.

    chart header  : "TEMPERATURE / Last 4 weeks"
    HIGHEST       : 102.4
    LATEST        : 101.1
    AT OR ABOVE 100.4 : 2
    Readings list : two rows, both dated Jul 7 and Jul 8
    x-axis labels : 7/7, 7/8, 7/8, 7/8, 7/8

A caregiver reads "Last 4 weeks · Highest 102.4 · 2 at or above 100.4" and concludes there was a
102.4 fever inside the last month. There was not; it was in July. This app colours a reading red
because a fever during chemotherapy can mean neutropenic sepsis — it is the one number here where a
wrong impression has a clinical consequence. The third reading is dropped from the Readings list
without a word, so the screen also under-reports.

This is the app-v82 finding again in a new place: a figure presented under a window label it was not
computed over.

Fix: when `inRange` is empty, say so — *"No readings in the last 4 weeks. The most recent were …"* —
rather than relabelling old readings as recent ones.

## BLOCK 5 — The symptom bar count and the list it filters to are over different windows

The bars are windowed:  `const windowed = entries.filter(e => e.ts >= from)` (28 or 90 days).
The list is not:        `const shown = state.symptomFilter ? entries.filter(...) : entries`.

**Reproduction.** 2 nausea entries in the last 4 weeks, 5 more ~40 days ago, range = Weeks.

    bar            : "Nausea   2 · yesterday"
    rows in list   : 7        (before any tap)
    after tapping  : "Showing Nausea only" — still 7 rows, bar still says 2

The changelog sentence is *"shows how often each symptom has been happening over the last few weeks.
**Tap one to see just those entries.**"* Tapping shows seven entries when the bar says two. "Those
entries" is not what you get. Even untapped, the screen shows "How often: Nausea 2" directly above a
list of seven nausea rows.

Fix either way round — window the filtered list to match the bars, or label the bars' number as a
count over the range and the list as complete history — but the two numbers cannot sit on one screen
unexplained.

---

# NON-BLOCKING FINDINGS

## N1 — Suite section 2 makes a claim its checks do not test

`test/v83-meds-and-reports.mjs` line 128: `section('2. MEDS AND HOME CANNOT DISAGREE ABOUT WHETHER A
DOSE MAY BE GIVEN')`, with the comment *"Both read status(); this proves it for the locking cases."*
The four checks under it **never navigate to Home**. They read `[data-med-status-pill]` and match it
against a regex written in the test file. They are pill-text checks wearing an agreement test's
title, and the two states they omit — off-day and treatment-excluded — are the only two where the
two screens can differ, because they are the only two Home computes for itself.

A real agreement check reads both screens and compares: for every medication, `Home shows a
non-override Log button` must equal `the pill is in the available/due family`. Written that way it
fails today on BLOCK 1 and BLOCK 2.

## N2 — Rule 5.5: the What's New modal does not lock the page behind it

Measured with the modal open: `window.scrollTo(0, 800)` moved the page from 0 to 333 (the full
scroll extent), `body`/`html` overflow both `visible`. There is no scroll-lock mechanism anywhere in
this file — this is a class-wide gap rather than a regression — but app-v84 **adds a new full-screen
overlay** (`position:fixed; inset:0; z-index:95`) to that class, and Rule 5.5 requires the release
that adds an overlay to ship a case for the interaction. Neither new suite has one. care-tracker's
`harness/scrolllock-test.mjs` is the pattern, including its completeness check.

Focus after dismissal returns to `BODY`, not to anything meaningful — the other half of Rule 5.5's
question.

## N3 — "Every past update is listed" is not true

The modal says *"Every past update is listed under 'What's new' in the menu, newest first"*, and the
full screen repeats it: *"Every update to ChemoWell, newest first."* `CHANGELOG` holds **five**
entries (app-v80 … app-v84) for an app on its 84th release. The claim is checkable by the reader in
one tap and it is false. *"The last few updates"* costs nothing and is true. This is the Voice's
question 1, on the copy whose entire subject is telling the truth about what changed.

## N4 — Home's override copy names a medication that is not the one being logged

Not introduced by this release, but surfaced by it, and the neutrality suite does not catch it:

    index.html ~6284
    st.chemoBlock ? 'Care team said no Zofran on chemo days. Log it anyway?' : …

Reproduced with a medication named "Block Med" carrying a `chemoBlock` property: the red override
panel reads *"Care team said no Zofran on chemo days."* That is CLAUDE.md Rule 0 leak shape 4 in
user-facing copy — one care plan's medication name printed under a stranger's medication. The new
pill gets this right (`"Held around treatment"`), which is what makes the old string visible.

## N5 — The temperature report shares `state.weightRange` with the weight report

`renderTemperatureReport` reads and writes `state.weightRange`, the same slot the weight trend uses.
Changing the temperature range silently changes the weight report's range and vice versa. Harmless
today; it is the kind of shared slot that becomes a defect the moment either screen gains a third
option. The symptom bars correctly got their own `state.symptomRange`.

## N6 — `deviceHasPriorChemoWellData()` is correct today by ordering alone

Verified on a genuinely fresh profile: no modal, and `chemowell-app-seen-version` stamped silently.
But the check at line 8831 scans localStorage for any `chemowell-app*` key, and by the end of the
same load three such keys exist (`-profiles-v1`, `-seen-version`, `-p-p1-prefs-v1`). It returns false
only because none of them is written before line 8831 runs. Any future code that writes a
`chemowell-app` key during module init above that point shows "here is what changed" to every
brand-new user, silently, with no test covering it. A comment at line 8831 saying *"nothing may write
a chemowell-app key before this line"* is the cheap guard.

## N7 — Degenerate x-axis labels

With all points inside one day, `tRange` clamps to one day but five labels are still generated:
`7/7, 7/8, 7/8, 7/8, 7/8`. Cosmetic.

---

# FALSIFICATION SWEEP — `test/v83-meds-and-reports.mjs`

Eight mutants, each applied to a throwaway clone of a582058 served on its own port; the working tree
was never touched. Method matches `falsify.sh` (I ran an equivalent script of my own because
`falsify.sh`'s output is buffered through a `grep` pipeline and produced nothing readable while it
ran; the isolation guarantee — clone of HEAD, own port, suite pointed by `FALSIFY_BASE` — is the
same). Baseline: **46 checks, 46 passed**.

| # | Mutant | Result |
|---|---|---|
| 1 | status pill ignores `status()` — everything reads "Available" | killed (3 checks red) |
| 2 | ceiling bar prints the whole limit as "left" | killed (1) |
| 3 | doses-today line counts every dose ever logged | killed (1) |
| 4 | **symptom bar counts all history, ignoring the 4-week / 3-month range** | **SURVIVED — 46/46 green** |
| 5 | **"at or above fever" counts every reading ever, not the ones on the chart** | **SURVIVED — 46/46 green** |
| 6 | the fever threshold line is never drawn | killed (2) |
| 7 | tapping a symptom bar filters nothing | killed (1) |
| 8 | the Readings list shows only the newest reading | killed (1) |

## Two checks cannot fail, and they are the same check twice

**`the count is right`** (section 4) stays green when `const windowed = entries.filter(e => e.ts >=
from)` is replaced by `const windowed = entries`. Its fixture has no entry outside the window, so
the range is never exercised. The number the bar exists to show — *how often, over the chosen range*
— has no test of the range.

**`and how many were at or above the fever line`** (section 3) stays green when `points.filter(...)`
becomes `all.filter(...)`. Same reason: every reading in its fixture is inside the range, so whether
the count is taken over the charted set or over all history is unobservable.

Both survivors sit on one axis: **is this figure computed over the window its label claims?** That is
the axis BLOCK 4 and BLOCK 5 fail on in real use, and the axis the app-v82 audit failed on before
that. The suite tests the value of every new number and the window of none of them.

Fixing the suite means one fixture change in each case — put entries on both sides of the boundary
and assert the number changes when the range toggle is tapped. Written that way, mutants 4 and 5 die
and BLOCK 5 is caught before it ships.

Mutant 1's survivors are informative too: it killed three of section 2's four checks but not *"the
pill is right for an available medication"*, because a pill hardwired to "Available" still satisfies
it. That is the section whose title claims Home and Meds cannot disagree (finding N1).

`test/v84-whatsnew.mjs` (24 checks) was read but not swept — the sweep budget went to the suite
covering the three screens that show numbers about a patient. Its gap is visible by reading: nothing
in it tests scroll behind the modal (N2) or the truth of the "every past update" claim (N3).

---

# WHAT I TRIED AND COULD NOT BREAK

* **Unit conversion is honest.** 37.0 °C and 39.6 °C logged in Celsius, viewed in Fahrenheit, render
  98.6 and 103.3, the latter correctly marked `· high`, on one axis with a Fahrenheit-logged 99.1.
  `dispTemp` converts at ingestion as the comment claims.
* **The fever line is drawn from `tempFever()`**, so it cannot disagree with Home's colouring; the
  High line is dropped only when the axis does not reach it, which is right.
* **No average anywhere** on either new screen — neither a mean temperature nor a mean severity.
* **The symptom filter survives** the 1-second tick and a tab round-trip, `Show all` clears it, and
  the BACK_LAYERS entry pops it.
* **A confirm-delete stays armed** across 3.5 s of re-renders on the Meds screen (the pill now
  carries a live countdown) and the second tap still deletes.
* **The moved debug-hook block boots clean.** Zero page errors and zero console errors on a fresh
  device, on an upgrade, and across every fixture above; all four hooks present and populated.
* **Dismissal sticks.** "Got it" closes the notice, it stays closed through four seconds of ticks,
  and it does not return on the next load. A fresh install is not greeted with it.
* **`test/v75-no-other-patient.mjs` passes 27/27**, and the CHANGELOG prose carries no patient name,
  no gendered pronoun, no dose and no schedule.
* **No new write path.** Every figure on all three screens is derived from `status()`,
  `dailyCeiling()`, `entriesFor()`, `symptomEntries()` and `state.entries`; the only storage write in
  either release is `localStorage.setItem('chemowell-app-seen-version', APP_VERSION)`. The write
  model as claimed holds.
