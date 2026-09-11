# Zero Day Audit — delta pass 5 — care-tracker v75 / ChemoWell app-v73
AUDITED-COMMIT: 574580de8095e5635e665e498d7d19cac2488e9f
VERDICT: DO NOT SHIP

(chemowell-app-beta. care-tracker commit examined: c535d1e268c04030b30b3d05d0027ad4fbaf0049, v75.
chemowell-beta examined at fd924811d393949f2516f3e788fc9d7819972020, deliberately not merged.)

**2026-09-11 · narrow delta over `ab90f64..c535d1e` (care-tracker) and `9bdf134..574580d` (ChemoWell)**

---

## THE HEADLINE: the replacement claim is false, and it is the fifth in a row of the same class

The fourth pass blocked because *"a wrong span stays until the medication is deleted outright"* was
untrue. This delta replaced it. **The replacement is also untrue**, and it is untrue in the one
direction that matters: it tells a future reader that a bad span cannot reach the file that goes to
the doctor. It can.

The new sentence, shipped verbatim in **six** places — `index.html` (care-tracker line ~306 and the
ChemoWell copy), `harness/archived-meds-patch.py`, `README.md`, `CARETRACKER_HANDOFF.md`,
`STATUS.md` KNOWN #1 — reads:

> WHAT ACTUALLY MAKES THIS SAFE is narrower and does not depend on a recovery path: **a span changes
> only what the missed-dose banner COUNTS.** No entry is written, edited or deleted by any of this,
> **the export reads the entries themselves**, and the doses stay exactly where they are. **The worst
> case is under-reporting on one screen, which is visible.**

### Measured, on the shipped build, with the probe falsified

Probe: `scratchpad/span-surface-probe.mjs` — loads the real `index.html` with the Firebase modules
stubbed and all other network aborted, plants a 14-day `awayPeriods` span on the tracked medication
that actually carries misses (Protonix), and reads `missedDosesFor()`, `buildExportRows()` and the
per-day History counts directly rather than off the screen.

| surface | without the span | with a 14-day span | claim says |
|---|---|---|---|
| missed-dose banner total | 305 | 277 (−28) | changes ✔ |
| **`buildExportRows()` — the CSV that goes to the doctor** | **305 rows** | **277 rows (−28)** | **does not change ✘** |
| …of which `not logged` rows | 305 | 277 (−28) | — |
| **History day summaries with a changed `N MISSED`** | — | **14 days** | **does not change ✘** |

**Falsified:** with the `awayPeriods` guard removed from the served copy of the build, every one of
those deltas reads 0. The probe measures the mechanism and nothing else.

This is not a new discovery — it is the project's own prior measurement, restated. Pass 3 recorded
`export rows 122 → 0 → 94` and `61 days → 0 → 47`. The 122→94 leg **is the span**, on the clinician
export. The v75 changelog row says so in its own words, four sentences before it says the opposite:

> *122 misses spanning two months vanished — from the banner, from the History day summaries, and
> from the report that goes to the doctor (122 rows → 0)*

And the shipped source says so too, 1,450 lines away from the new comment, at the guard itself
(`index.html` ~1752): *"gone from the banner, the day summaries and the report that goes to the
doctor."* Two sentences in one file, flatly contradicting each other about the same mechanism.

### Static confirmation — every consumer of the span

`awayPeriods` has exactly one reader: the guard inside `missedDosesFor()` (care-tracker line 1755).
`missedDosesFor()` is read by **five** surfaces, not one:

| line | surface |
|---|---|
| 3753 | the missed-dose banner |
| 4206 | the `N MISSED` label on the medication card on Today |
| 4336 | Today's journal |
| 6071 | **`derivedMissedEntries()` → `buildExportRows()` — the CSV backup / clinician export** |
| 7130 | **History rows and the `· N MISSED` day summary** |

`derivedMissedEntries()` exists precisely so the export carries misses; its own comment says
*"omitting them loses real clinical signal. They are included and marked `derived`."*

### ChemoWell is different, and the same sentence is wrong there too

In ChemoWell `buildExportRows()` maps `allEntriesRaw()` only, so *"the export reads the entries
themselves"* **is** true there. *"Only the banner"* is still false: `missedDosesFor()` drives
History (8860, 8864), Today's journal (5330), the header count (1825) and the review flow (3419) —
and at line 8860 a History **day is seeded into existence only because it has misses**, so a span
can make an entire day vanish from History rather than merely change its number. ChemoWell's own
source states the general rule at line 1794: *"it disappears everywhere `missedDosesFor` is used
(banner, History, Today's Journal)."*

### What is TRUE, and is enough

The safety argument does not need the false half. Everything below is verified and holds:

* No entry is written, edited or deleted. Zero `removeEntryDB` / `addEntryDB` / `addDoc` /
  `deleteDoc` in the release diff (re-confirmed).
* Every logged dose stays exactly where it is; the span changes only *derived* missed-dose rows,
  which are computed at render time and are not documents.
* Nothing is destroyed: delete the span from the config and all five surfaces come straight back.
* The under-reporting is visible on every surface it touches.

### The fix (wording only — no code change)

Replace, in all six places, with something like:

> A span changes only **derived missed doses** — the banner, the card label, Today's journal, the
> History day summaries, **and the missed rows in the CSV export**. No entry is written, edited or
> deleted; every logged dose stays where it is, and removing the span brings all of it back. The
> worst case is under-reporting of missed doses across those surfaces, which is visible on all of
> them and is not a loss of data.

(For ChemoWell, drop the CSV clause — but keep History and the journal, and say that a day with no
entries can drop out of History entirely.)

**Also delete the surviving older copy of the same falsehood** in the v75 changelog row, which this
delta left untouched: *"a span only ever changes what the banner counts."*

---

## BLOCKER 2 — the new `daysAway < 0` branch promises suppression that will not happen

Item 3 added a branch for a clock moved backwards. It changes the date wording and **keeps the
promise**, on the one branch where the promise is guaranteed false.

`renderMedicationManager` (care-tracker ~4795):

    item.daysAway < 0 ? 'Removed on ' + new Date(item.removedAt).toLocaleDateString() : ...
      + ' · the days it was away will not count as missed doses'

`daysAway < 0` means `dayStart(now) < dayStart(removedAt)` — the recorded removal day is in the
future. `restoreMedicationConfig` then builds `{ start: dayStart(removedAt), end: dayStart(now) }`,
i.e. **start > end**. The missed-dose guard is `d0 >= dayStart(p.start) && d0 <= dayStart(p.end)`,
which no day can satisfy when start > end, and `normalizeMedication` drops the span outright on the
next load (`span.start <= span.end`). So on this exact branch **nothing is suppressed, ever** — and
the row tells the caregiver the opposite. The toast is wrong the same way: it is gated on
`knewWhenItLeft`, which is true here, so it says *"the days it was off the list are not counted as
missed."*

This is the pass-3 blocker reappearing on a branch this delta introduced: a string promising
unconditionally that the days off the list go uncounted, on a path where they do not. The release's
own comment names this scenario as the realistic one (*"a phone whose DATE WAS WRONG AT THE MOMENT OF
REMOVAL and was corrected afterwards"*), so it cannot also be dismissed as unreachable.

**Fix:** on `daysAway < 0`, fall through to the honest wording — *"Removed on 25/09/2026 — that date
is in the future, so the app cannot tell how long it was away and those days will still count as
missed."* And gate the toast on `awayFrom <= awayTo`, not on `knewWhenItLeft`.

---

## Cleared — items audited this pass that do not block

**2 · Rejecting the strip-at-removal option — sound.** `deleteMedicationConfig` archives
`config: JSON.parse(JSON.stringify(med))`, spans included; restore concatenates a new span onto
whatever the archive carried. Strip on removal and the sequence remove(T0) → restore(T1) →
remove(T2) → restore(T3) keeps only `[T2,T3]`, and the `[T0,T1]` months flood back as missed. The
stated reasoning is correct, and the trade — a permanent wrong span versus a control that can hide
real missed doses — is the right way round for a patient's record.

**3 · The other copy branches — correct.** `daysAway` is derived from `left = Number(removedAt) || 0`,
so the `item.removedAt` test and the `daysAway` arithmetic cannot disagree. `daysAway === 0`
→ *Removed today* is reachable only with a real `removedAt` on today's date; `=== 1` → *yesterday*;
`> 1` → *N days ago*. No `h()` null-attribute exposure — every branch yields a string. The relative
phrase now naming the days reads correctly at 2am. *Non-blocking:* the new `toLocaleDateString()` is
called bare, while this file formats every other date with explicit options
(`{ weekday, month, day }`). In a `dd/mm` locale `09/11/2026` is ambiguous; pass
`{ month: 'short', day: 'numeric', year: 'numeric' }`.

**4 · The `pm.py` two-sweeps check — can fail, will not false-positive.** Falsified: appending one
extra `Failing or erroring suites: 0` line to `outputs/SUITES-v75.md` turned `pm.py` from exit 2 to
**exit 1** with `STOP TWO SWEEPS IN ONE RECORD — … carries 2 closing lines`; the file was restored
and `git status` is clean. False-positive risk is near nil: `run-all.sh` writes the header block with
`>` (truncate) and the closing line with `>>` exactly once, so a normal re-run cannot produce two.
The only way to trip it accidentally is a human quoting the phrase inside the record, and blocking is
the safe direction there.

**5 · chemowell-beta 4B / 4C — sound and falsifiable.** Ran the beta suite against its own build:
**37/37**, with 4C's `kept` reading `[]`. Falsified by removing the `span.end <= Date.now()` clause
from a scratch copy of beta's `index.html`: **36/37**, the single red row being *"THE RECORD SURVIVES
IT"* with `[{"start":1,"end":8640000000000}]` — red for the right reason, and no collateral
failures. The save-before-read reasoning is right, and its failure direction is safe: if the editor
save did not fire, the planted span would still be in storage and the check would go **red**, not
green. *Non-blocking, already written down:* in beta both behavioural halves of 4B are EXEMPT
(that build's banner carries no missed-dose count), so in beta the only evidence that suppression
happens is the recorded span, not observed behaviour. The exemption is stated in the output, which is
what the rule asks.

**6 · The two reformatted headers — no verdict altered, both shas real.** `delta3` and `delta4` each
now carry exactly one unindented `AUDITED-COMMIT:` line immediately followed by `VERDICT: DO NOT
SHIP`; `delta2` already did. The care-tracker sha displaced from `delta3`'s header was moved into a
parenthetical below the verdict, not dropped. All four shas resolve to real commits:
`18c3010b…` *Voice: Excedrin gets no line at all*, `31a20a4d…` and care-tracker `866b26ba…`
*the suite was supplying the thing it was meant to be checking*, `9bdf1349…` *records follow the
build: 44/44*.

---

## What was NOT re-audited (pass 4 cleared it; nothing in this delta touches it)

The both-ended `awayPeriods` mechanism and its measured numbers; the `knewWhenItLeft` upgrade-day
branch; section 4B's reload; the span validator's other clauses; patch/byte-for-byte reproduction.

## Method note

Firebase modules stubbed and all other network aborted in every run; nothing reached real Firestore.
Suites run with the proxy variables unset. `index.html` and the patches were not modified —
the probe appends its one-line export to the **served** copy, and the falsification mutants are
scratch copies under the scratchpad. The transient `pm.py` falsification touched
`outputs/SUITES-v75.md` for the length of one command and was restored in the same command;
`git status` is clean.

## Verdict

**DO NOT SHIP.** Blocker 1: the replacement safety claim is false in six shipped places, measured
at −28 rows on the clinician export and 14 changed History day summaries, and it contradicts two
other sentences in the same files. Blocker 2: the newly added `daysAway < 0` row and its toast
promise a suppression that cannot occur on that branch. Both are wording fixes; no code change is
required for either, and the mechanism underneath them is sound.
