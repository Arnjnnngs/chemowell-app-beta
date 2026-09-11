# Zero Day Audit — delta pass 6 — care-tracker v75 / ChemoWell app-v73 / chemowell-beta beta-v62
AUDITED-COMMIT: 813a81f53fddcaba7089c643b5311cdaf906330e
VERDICT: DO NOT SHIP

(chemowell-app-beta at app-v73. care-tracker examined at `f9c4289fe0c5d70c9efbf2dd81964b97bd0de356`
(v75); chemowell-beta at `5d15ebaa2c3515dbbe9e800b88c1b54082cdbc39` (beta-v62, deliberately not
merged). Narrow delta over `c535d1e..f9c4289`, `574580d..813a81f`, `fd92481..5d15eba`.)

---

## THE HEADLINE

**Both of pass 5's blockers are genuinely fixed. I falsified both halves of the new 4D check myself
and each went red on its own mutant.** The mechanism is right, the record is safe, nothing is
written, edited or deleted, and all three patches still reproduce their `index.html` byte-for-byte.

**And the sweep the brief asked for found the claim family alive in two more places — one of them
the replacement sentence written in this very delta.**

1. **The new sentence is false in ChemoWell.** It says a span changes "the derived missed-dose rows
   in the clinician export", and then quotes a measurement — *"the export drops 305 rows to 277 and
   14 History days change their MISSED count"* — that was taken on care-tracker. **ChemoWell's
   export has no missed-dose rows at all.** It over-claims in exactly the direction the brief
   predicted.
2. **"The span collapses to a single day and suppresses nothing" is false in all three apps**, and
   the caregiver-facing toast and row built on that belief are false with it. Measured: that
   single-day fallback span suppresses two real missed doses and drops two rows from the clinician
   export, while the toast tells the caregiver those days *"will still show as missed."*

Both are wording, not behaviour. Neither damages a record. The fix is an edit pass, not a rebuild —
the exact replacements are at the bottom.

---

## BLOCKER 1 — the replacement sentence over-claims in ChemoWell

`chemowell-app-beta/index.html` line 1189, and `harness-archived-meds-patch.py` line 213, ship:

> WHAT A SPAN DOES CHANGE is every surface fed by missedDosesFor(): the banner, the card's MISSED
> label, Today's journal, the History rows and day summaries, **and the derived missed-dose rows in
> the clinician export**. … **Measured on a 14-day span: the export drops 305 rows to 277** and 14
> History days change their MISSED count.

**In chemowell-app-beta, a span changes the export by nothing at all.** Proved four ways, each of
which would go red if the code changed:

| evidence | in chemowell-app-beta @ 813a81f |
|---|---|
| readers of `awayPeriods` | exactly one — line 1763, the guard **inside** `missedDosesFor()` |
| `buildExportRows()` (7885) | `allEntriesRaw().filter(...).map(...)` — never calls `missedDosesFor` |
| its only two callers | `downloadEntriesCSV` (8176) and `openPrintReport` (8231) — both consume the same `rows`, neither adds misses |
| occurrences of `"not logged"` in the file | **0** |
| `derivedMissed` anywhere in the file | **0** |

So there is no derived missed-dose row in ChemoWell's CSV or its printable doctor's report for a
span to remove, and the 305 → 277 figure was never measured in this app — it is care-tracker's
fixture pasted across. **Pass 5 said so explicitly** (*"In ChemoWell `buildExportRows()` maps
`allEntriesRaw()` only, so 'the export reads the entries themselves' IS true there"*), and the
correction went in without that half being carried over.

This is the **sixth** claim in this release describing a property the code does not have, and the
**fifth written specifically to replace the last one**. The direction has flipped — it over-claims
rather than under-claims, which is the safer direction — but the defect is identical, and the rule
this release just paid for says *measure it or do not write it*. A number presented as a measurement
in a file where it was never measured is the purest form of the thing.

**chemowell-beta is different and its copy is correct**: `derivedMissedEntries()` (5143) feeds
`buildExportRows` (5167) and `"not logged"` is a real row there. **The sentence is true in
care-tracker and in chemowell-beta, and false in exactly one of the three apps** — the one whose
commit ships today.

---

## BLOCKER 2 — "suppresses nothing" is false, and the caregiver is told so

Shipped in all three `index.html` files, all three patches, `outputs/PM_app-v73.md`, `README.md` and
`CARETRACKER_HANDOFF.md`:

> An archive written before this release carries no removedAt: that restore gets a single-day span,
> **which suppresses nothing that matters** and never reaches backwards.
> … the span collapses to a single day and **suppresses nothing**.
> AN ENTRY FROM AN OLDER BUILD … gets a single-day span, so it suppresses nothing — **the toast and
> the row say so** rather than promising otherwise.

### Measured, on the shipping build, by driving the real controls

Probe: `scratchpad/restore-day-probe.mjs` — loads care-tracker `index.html` at f9c4289 with the
three Firebase modules stubbed and all other network aborted, calls the real
`deleteMedicationConfig()` and `restoreMedicationConfig()` (two taps each), strips `removedAt` from
the archive exactly as any pre-v75 build leaves it, and reads `missedDosesFor()` and
`buildExportRows()` directly rather than off the screen.

| | with the fallback span | span dropped, same build, same fixture |
|---|---|---|
| Protonix missed windows **today** | **0** | **2** (Morning 8-12, Evening 20-22) |
| all missed windows today | **0** | **2** |
| **`buildExportRows()` — the file that goes to the doctor** | **305 rows** | **307 rows** |
| span written | `{start: 2026-09-11 00:00, end: 2026-09-11 00:00}` | — |

The toast the caregiver reads on that same path, captured verbatim from `state.toast` in the same
run:

> *"Protonix is back, with its doses and rules. Its reminders come back on. The app has no usable
> record of when you removed it, so **the days it was away will still show as missed**."*

The row says the same thing. **Both are false about the restore day**, and false in the
under-reporting direction — two missed doses leave the banner, Today's journal, the History day
summary and the doctor's export while the app is saying they will stay.

**Falsified:** `FALSIFY=1` removes the guard line from the served copy and the deltas go to zero, so
the probe measures this mechanism and nothing else.

### The record already contradicts itself about it

`README.md` and `CARETRACKER_HANDOFF.md` say *"suppresses nothing that matters"* — and then, a few
sentences later in the same row, say the opposite and call it deliberate:

> **The day of the restore is itself inside the span** (the range is inclusive at both ends), so a
> dose window already missed earlier that same day is not counted: one day, deliberate, and stated
> here because an exemption nobody wrote down is indistinguishable from an oversight.

That paragraph is right, and it is the reason this is a wording block rather than a code block. But
two sentences in one file flatly disagreeing about the same mechanism is precisely what pass 5
refused, and the half the caregiver actually reads is the wrong half.

### And no check covers it

`harness/archived-meds-test.mjs` asserts on this path only that *"the span it was away is recorded
on this path too"*. Nothing asserts what that span does. The one property the comment claims —
that it suppresses nothing — has never been measured by anything.

---

## What I verified clean

### Blocker 2's code fix — 4D falsified independently, both halves

Baseline `harness/archived-meds-test.mjs` on the shipping file: **48/48**. Two mutants built in
scratch copies (`index.html` never touched):

| mutant | what it reverts | result |
|---|---|---|
| **mut2** — row side | `usable` back to `!!Number(item.removedAt)`, `daysAway < 0` branch restored | **FAIL** *"the row does NOT promise those days will go uncounted"* — row read `Removed on 9/16/2026 · the days it was away will not count as missed doses`, pass 5's blocker reproduced exactly |
| **mut1** — restore side | `knewWhenItLeft` back to `!!Number(entry.removedAt)` | **FAIL** *"and no backwards span is recorded from it"* — `[{"start":1789516800000,"end":1789084800000}]`, start after end |

Each mutant reddened **only its own half**, so the two checks are independent and neither is
carrying the other.

### The boundary, midnight, DST, TEST_MODE

- **`dayStart(leftOn) <= dayStart(now)` is the right test.** The guard it feeds is day-granular
  (`d0 >= dayStart(p.start) && d0 <= dayStart(p.end)`), so a day-granular flag matches it exactly. A
  removal at 23:59 today stays usable; one millisecond into tomorrow is rejected — conservative in
  the safe direction.
- **Midnight:** a removal recorded today and confirmed after midnight reads `daysAway === 1`,
  *"Removed yesterday"*. Correct.
- **DST:** `dayStart` is `new Date(d.getFullYear(), d.getMonth(), d.getDate())` — the local-calendar
  constructor, not modulo arithmetic, so a 23- or 25-hour day is still one day. `daysAway`'s
  `Math.round(.../86400000)` absorbs the ±1h. Both correct across a transition.
- **ChemoWell TEST_MODE:** removal writes `removedAt: dayStart(state.now || Date.now())` (6032) and
  restore reads `state.now`, which is `simNow()`. A stable date offset is therefore self-consistent
  and 4D's scenario is exactly what an offset produces. One mismatch, non-blocking, below.
- **Can the row and the toast disagree?** Only across a midnight rollover **between** the render and
  the confirming tap, on a future-dated removal. Both apps re-render on a tick, so the window is
  about a second. Not worth code.

### Everything else in the delta

- `awayPeriods` has **exactly one reader** in every app: the guard inside `missedDosesFor()`. No
  `removeEntryDB` / `addEntryDB` / `addDoc` / `deleteDoc` anywhere in the delta.
- **Patches reproduce byte-for-byte at the shipping commits**, re-verified because the patches
  themselves changed in this delta: care-tracker `3a9882b6…` = `index.html`; chemowell-app-beta
  `a8c5c436…` = `index.html`; chemowell-beta `2ed1d586…` = `index.html`.
- The span validator still rejects `start > end` and any `end` beyond now, so the future-removal-day
  case cannot reach the guard even if it were written.
- `python3 pm.py` on care-tracker: **clear**, one warning to disclose (nine pinned version literals,
  all pre-existing, all in patches or old suites).
- **`STATUS.md`'s "THE RULE THIS RELEASE PAID FOR" table is accurate** — I checked each of the five
  cells against what the sentence actually said and why it was false, and against the code. One
  cosmetic nit: the third row is labelled pass 5 while its own text says it is pass 3's copy
  blocker.

---

## Non-blocking findings

1. **ChemoWell's own changelog row carries the same over-claim, older.** The app-v73 row in
   `chemowell-app-beta/README.md` says the second design's erasure was *"gone from the banner, the
   day summaries and the clinician export"*. Same care-tracker sentence, same app where the export
   has no missed rows. Fix it in the same pass as Blocker 1.
2. **ChemoWell: the validator uses real time, the restore uses simulated time.** Restore writes
   `end = dayStart(state.now)` = `simNow()`, while `normalizeMedication`'s filter requires
   `span.end <= Date.now()` — real. `TEST_MODE` is permanently `true` in this build, so a tester who
   sets the date forward, removes and restores a medication is told the days will not count, and the
   span is silently dropped by the validator on the next load. The direction is fail-safe (more
   misses show, none are hidden) and it is a beta control, so it is a note rather than a block —
   but it is the row and the toast disagreeing with the behaviour again, one reload later.
3. **The suite has no check on the fallback path's effect.** Whatever wording replaces "suppresses
   nothing", assert it: measure the missed count and the export row count across a restore from an
   archive with no `removedAt`, and require the restore day — and only the restore day — to move.
   That turns the README's written-down exemption into something that can fail.
4. `pm.py` warning, disclosed above.

---

## The minimal fix

Two sentences, no code.

**Blocker 1** — in `chemowell-app-beta/index.html` (~1189) and its `harness-archived-meds-patch.py`
(~213), the export clause and the measurement are care-tracker's. Say what is true of each app:

> WHAT A SPAN DOES CHANGE is every surface fed by missedDosesFor(): the banner, the card's MISSED
> label, Today's journal, and the History rows and day summaries. **In this app the clinician export
> is NOT one of them — `buildExportRows()` maps `allEntriesRaw()` only and this file contains no
> derived missed-dose row. In care-tracker and chemowell-beta it IS: there a 14-day span drops the
> export from 305 rows to 277.** …

**Blocker 2** — everywhere "suppresses nothing" appears (three `index.html`, three patches,
`PM_app-v73.md`, `README.md`, `CARETRACKER_HANDOFF.md`), and in the two caregiver strings:

> …gets a single-day span covering the day of the restore, so it **can never reach backwards over
> days the medication was on the list — but the restore day itself is inside it, and a dose window
> already missed earlier that day is not counted. Measured: two missed windows and two export rows.**

and the toast / row:

> *"Its reminders come back on. The app has no usable record of when you removed it, so the days it
> was away will still show as missed — apart from today."*

Re-audit is a delta over those edits only; the mechanism, the suites and the patches are all clear.
