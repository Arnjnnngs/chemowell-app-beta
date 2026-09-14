AUDITED-COMMIT: e5dfce4
VERDICT: BLOCK

# Zero Day Audit — ChemoWell app-v83 + app-v84, DELTA RE-AUDIT

**HEADLINE: the pill fix added two of Home's three gates. `treatmentOnlyBlocks` is the third, and it
is the worst of them — a medication whose treatment window has passed has NO CARD ON HOME AT ALL,
and the Meds pill still reads a green "Available". Separately, the new scroll lock makes the
medication editor unusable: the body is frozen at 844px around a 6,869px editor with no inner
scroller, so "Save changes" and 61 other controls cannot be reached.**

Delta pass over a582058 → e5dfce4 only. Measured in Chromium against a clone of e5dfce4 served on
its own port. The working tree was not modified other than this file.

## The five original BLOCKs

| # | Original finding | Status at e5dfce4 |
|---|---|---|
| 1 | off-day medication: Home withholds, Meds says "Available" | **FIXED** — pill reads "Not scheduled today" |
| 2 | treatment-excluded medication: no Log button on Home, Meds says "Available" | **FIXED** — pill reads "Held near treatment day" |
| 3 | rolling ceiling drawn as a daily allowance | **FIXED for the mg case**; see NEW-1 for the case it broke |
| 4 | temperature report labels ten-week-old readings "Last 4 weeks" | **FIXED** — fallback deleted |
| 5 | symptom bar count ≠ its own filtered list | **FIXED** — equal at both ranges |

Reproductions for 1 and 2, re-run at e5dfce4: off-day medication → Home `Not scheduled today · Taken:
Thu`, Meds pill `Not scheduled today`. Treatment-excluded → Home renders the inert panel with no
card, Meds pill `Held near treatment day`. Both now agree.

---

# BLOCK A — The third gate: `treatmentOnlyBlocks`. Same defect, still live.

`medStatusPill` now asks `treatmentExcludedNow` and `medScheduledOn`. Home asks a third question
that the pill does not, at **three** call sites:

    index.html 6218  const medCards = state.meds.filter(m => m.quickLog && (m.paused ||
                       !treatmentOnlyBlocks(m, now) && !(m.treatmentOnly && status(m).courseComplete)))
    index.html 4474  if (treatmentOnlyBlocks(med, now) || treatmentExcludedNow(med, now)) { …inert row… }
    index.html 4450  dueMeds = meds.filter(m => { … if (treatmentOnlyBlocks(m, now)) return false; … })

`status()` asks `treatmentOnlyBlocks(med, d0 + 86400000)` — **tomorrow**, and only inside the `'win'`
branch after the window loop, to produce `courseComplete`. It never asks about today, and for a
`'gap'` medication it never reaches that line at all.

**Reproduction.** One medication, `type:'gap'`, `treatmentMode:'only'`, `treatmentOnly:true`,
`treatmentDaysBefore/After: 1`; one `chemo_date` entry 30 days ago.

| Screen | What it says |
|---|---|
| Home (standalone) | **no card at all** — filtered out at line 6218 |
| Home (grouped) | inert row, *"Outside its treatment-day window"*, no button |
| "Take all" | excluded from the count |
| Meds | pill reads **`Available`** |

This is BLOCK 2's shape exactly: Home removes the medication from the screen and Meds says green go.
The fix is the same shape too — the pill must ask `treatmentOnlyBlocks(med, state.now)` alongside the
two gates just added, with wording matching the grouped row (*"Outside its treatment-day window"* /
*"Outside its date window"* when `isOtherTreatmentType()`).

**And the general lesson, which is why this recurred:** "the gates Home applies" is still a list
maintained in two places by hand. Three call sites in Home enumerate it; `medStatusPill` now
enumerates it again. A fourth gate added to Home will diverge the same way. The durable fix is one
predicate — `medWithheldNow(med, now)` — that Home's filter, Home's grouped row, `dueMeds` and the
pill all call, so the enumeration exists once.

# BLOCK B — The new scroll lock makes the medication editor unreachable

`medEditor` is marked `overlay: true`. It is not an overlay. It is a full-screen **in-page** panel
that has always relied on the document scrolling, and `applyScrollLock` freezes the document.

**Reproduction.** 14 medications; Meds → Edit on any one; measured with the editor open at 390×844:

    document.body.style.position : "fixed"
    document.documentElement.scrollHeight : 844      (was 4894)
    document.body.scrollHeight   : 6869              ← the editor is 6,869px tall
    inner scroll containers      : 0                 ← nothing inside can scroll either
    controls rendered below the viewport : 62
    "Save changes"               : top 1248.9        ← 405px below the fold, unreachable
    window.scrollTo(0, 900)      : lands at 0

Playwright confirmed it independently: attempting to click a control in the editor failed after 30s
of retries with *"element is outside of the viewport"* on every attempt.

Among the 62 unreachable controls are every schedule radio — *"No Home card"*, *"Always available"*,
*"Only near treatment day"*, *"Excluded near treatment day"* — and Save and Delete. **The medication
editor is the only place edit and delete live.** This file's own comments call that out twice as the
failure mode to avoid ("a blank screen with no way back"); this is the same screen, reachable, and
frozen.

By contrast the layers that genuinely float are fine: the log-a-symptom sheet and the menu drawer
both measured `bodyH === winH === 844` with 0 unreachable controls, and the What's New modal carries
its own `maxHeight:80vh; overflowY:auto`.

**Fix:** `medEditor` must not be `overlay: true`, or it must be given its own scroll container
(`max-height:100dvh; overflow-y:auto`) before the body is frozen around it. The registry currently
conflates *"Back dismisses it"* with *"it floats above a page that must not move"*. Those are two
different properties and the release put them on one flag — which is the same shape as the original
BLOCK, where one function was asserted to answer two questions.

# BLOCK C — The rolling wording is now applied to a figure that is not rolling

`medCeilingBar` derives `const rolling = !!med.rollingCeilingH` **from the medication**. But
`dailyCeiling()` short-circuits on `ceilingUnit` *before* it ever looks at `rollingCeilingH`:

    index.html 2068  if (med.ceilingUnit) return { used: dailyPills(med.id), max, unit: med.ceilingUnit, … };
    index.html 2070  const used = med.rollingCeilingH ? rollingDoseMg(…) : …

So for a medication with **both** a pills-unit ceiling and a rolling window, `used` is
`dailyPills()` — a count since midnight — while the bar labels it as a rolling window.

**Reproduction.** `ceiling:true, ceilingMax:6, ceilingUnit:'pills', rollingCeilingH:4`; four pills
logged today, one of them inside the last four hours.

    "4 / 6 pills"
    "2 pills left in the last 4h"
    "A rolling 4-hour limit, not a daily one — this frees up again as earlier doses age out."
    aria-label: "4 of 6 pills used in the last 4h"

Every one of those is false. Four pills were taken **today**, one in the last four hours, and the
figure does **not** free up as doses age out — it resets at midnight. The previous release said
"today" about a rolling figure; this one says "in the last 4h" about a daily figure **and adds a
sentence explaining behaviour the number does not have**, which is worse: a reader who believes the
explanation will expect room to reappear within the hour and it will not.

**Fix:** the window must be reported by whichever branch of `dailyCeiling()` actually ran, not
guessed from the medication afterwards. Have `dailyCeiling` return `windowH` (set only in the rolling
branch, absent in the pills and group branches) and have `medCeilingBar` read that.

The mg case the fix was aimed at is correct: `15 mg / 4h`, 15 mg given today, 5 mg in window →
*"5 / 15 mg · 10 mg left in the last 4h"*, aria *"used in the last 4h"*, plus the explanatory line.
True, and it agrees with Home.

---

# FALSIFICATION SWEEP — `test/v83-meds-and-reports.mjs` at e5dfce4

Seven mutants against a throwaway clone of e5dfce4 on its own port. Baseline **56 checks, 56 passed**.

| Mutant | Result |
|---|---|
| symptom bars count all history, ignoring the range (last round's survivor) | **killed** — *"the count is right"* |
| "at or above fever" counts every reading ever (last round's survivor) | **killed** — *"a feverish reading from outside the window is not counted in it"* |
| the symptom list reverts to unwindowed (BLOCK 5 verbatim) | **killed** — *"tapping a bar shows exactly as many entries as the bar counted"* (4 rows for a bar reading 2) |
| the pill stops asking `medScheduledOn` | **killed** (2 checks) |
| the pill stops asking `treatmentExcludedNow` | **killed** (2 checks) |
| **the temperature out-of-range fallback comes back (BLOCK 4 verbatim)** | **SURVIVED — 56/56 green** |
| **the rolling ceiling bar goes back to saying "today" (BLOCK 3's copy)** | **SURVIVED — 56/56 green** |

**Both of last round's survivors are dead. Two new ones replace them, and both protect nothing less
than a block fix that was just made.**

Restoring `const points = inRange.length ? inRange : all.slice(-2)` — BLOCK 4, character for
character — leaves every check green. The new temperature fixture puts a 103.6 reading 60 days out,
which exercises *exclusion*; it never makes `inRange` **empty**, which is the only condition under
which the fallback fires. `data-temp-none-in-range` is rendered by the fix and asserted by nothing.

Restoring `const windowWord = 'today'` likewise leaves 56/56 green: no check reads the bar's window
word, the explanatory line, or the aria-label.

Each needs one fixture and one assertion: a temperature history whose readings are **all** older than
28 days, asserting `data-temp-none-in-range` is present and `data-temp-chart` is absent at Weeks and
the chart returns at Months; and a rolling-ceiling medication asserting the bar's text contains the
medication's own `rollingCeilingH` rather than the word "today".

---

# NON-BLOCKING FINDINGS

## N1 — Nine "overlay" layers are inline confirmations that freeze the screen they sit in

The registry's own comment says confirmations *"sit on top of whatever armed them"*. They do not —
they render **inside** the card that armed them, with `position: static`, and there is no backdrop.
Marking them `overlay: true` freezes the page around a static button.

**Measured, Meds screen, 14 medications.** Tapping the trash icon on one card:

    body.style.position : "fixed"          documentElement.scrollHeight : 844 (was 4894)
    "Confirm delete"    : position static, top 400
    full-screen fixed backdrops on screen : 0
    window.scrollTo(0, 1500) : lands at 0

**Measured, Home.** Arming the red override on one medication card: same — docH 2843 → 844, zero
backdrops, scrolling dead.

So arming a delete confirmation or an over-limit override freezes the entire screen until it is
confirmed or cancelled. It is recoverable (the control that armed it is still where the finger was),
which is why this is not a block, but it is wrong in nine places: `confirmDeleteMed`,
`confirmRestoreMed`, `confirmDeleteProfile`, `confirmDeleteAppt`, `confirmDeleteNote`,
`confirmRemove`, `confirmRemovePara`, `confirmClearChemo`, `override`. With `medEditor` that is **10
of the 23** layers marked `overlay: true` that are not overlays.

The fix for BLOCK B fixes this too if it is done as a property of the thing rather than of its Back
behaviour: `overlay: true` should mean "renders a fixed, full-screen layer", and the honest test is
whether the layer actually paints one.

## N2 — What the lock gets right

Said explicitly because it was the thing to attack hardest and most of it holds:

* **Scroll position is restored exactly.** Locked at scrollY 972 → `body.style.top: -972px` → on
  release, scrollY 972. (An earlier reading of mine suggesting otherwise was a Playwright
  auto-scroll artifact, not a defect.)
* **Stable across the tick.** `body.style.top` unchanged after 3.2 s and three re-renders;
  `applyScrollLock` is genuinely idempotent.
* **Releases on Back**, not only on a button — `__backTest.press()` popped `medEditor` and the lock
  came off in the same frame.
* **Nothing is locked when nothing is open**, and toasts do not lock — correctly exempt and said so
  in the code.
* **The three inline layers are exempt as documented**: `vitalOpen`, `symptomFilter`, `help`.

## N3 — All dose options over the limit: Home requires an override, the pill says "Available"

`ceilingMax: 1000`, 900 mg used, the only dose option is 500 mg. Home renders no ordinary Log
button — only a dashed *"500 mg · over limit"* that arms *"This would go over today's limit. Log it
anyway?"*. The pill reads **"Available"**. Lower severity than BLOCK A because the ceiling bar
immediately beside the pill does show 900 / 1,000, so the information is on the card — but the pill
is inconsistent with how it treats every other override-gated state. One line:
`doseList.every(doseBlocked)` → *"Next dose is over the limit"*.

## N4 — A shared group ceiling is drawn as if it belonged to one medication

Two medications sharing `ceilingGroup`, one logged 500 mg and the other 1,000 mg. On the first
medication's card: *"1,500 / 3,000 mg · 1,500 mg left today"*, directly beside *"1 dose today"*. The
bar is counting both medications; the line beside it is counting one; nothing says the limit is
shared. `ceilingGroupMedIds()` already exists to name the group (index.html 2003).

## N5 — Verified fixed from the previous round

* *"Every past update is listed"* → *"Updates from here on are listed under 'What's new' …"* — now
  true.
* The chemo-block override copy no longer names one care plan's medication: it reads
  `med.name + ' is set to be held around treatment days. Log it anyway?'`.
* Suite section 2 now opens Home and compares both screens — proven by mutants 11 and 12, which kill
  two checks each including *"the two screens agree in words"*.
* Zero page errors and zero console errors across every fixture in this delta pass.
