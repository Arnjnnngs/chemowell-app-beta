# Zero Day Audit — delta pass 4 — care-tracker v75 / ChemoWell app-v73
AUDITED-COMMIT: 9bdf1349ce8f24d2d06e91658bc685cd1fb07eca
VERDICT: DO NOT SHIP

**2026-09-11 · narrow delta over `7cf1b31..ab90f64` (care-tracker) and `95e2ccb..9bdf134` (ChemoWell)**

## VERDICT: DO NOT SHIP — one record defect, and it is the same class the last three passes refused

**The headline.** The mechanism is right. The copy fix is right and it is true in every branch I could
reach. The validator works and I proved both new checks can fail by breaking them. **What is wrong is
a sentence that appears in four records and in the shipped source comment: that a wrong away-span
"stays until the medication is deleted outright" and is "undone by deleting the medication."
There is no such control, and deleting does not undo it.** Removing a medication *archives* it, and
the archive keeps `awayPeriods` inside `config`; bringing it back re-adds the old span and appends a
new one. A wrong span is permanent, full stop. That sentence was written to replace an earlier one
the third pass already refused for being false in exactly this way ("removing and restoring again
fixes it"), and it is false in the same way.

It matters beyond wording: the code comment at `index.html:296-303` uses that recoverability as the
stated reason it is safe to *reject rather than clamp* and to accept under-reporting as the worst
case. The safety argument rests on a recovery path that does not exist.

---

## The chain, verified line by line (care-tracker `index.html`)

| Step | Line | What happens to the span |
|---|---|---|
| Restore builds it | 4579-4582 | `med.awayPeriods = (existing).filter(...).concat([{start, end}])` — appends onto whatever the archived config already held |
| Remove archives it | 4606 | `config: JSON.parse(JSON.stringify(med))` — `med` is the live medication, so `awayPeriods` goes into the archive with it |
| Load keeps it | 322-325 | `normalizeArchivedMeds` runs `normalizeMedication(config)`, which preserves any span that passes the new filter |
| Nothing removes it | — | `grep "delete archivedMeds"` returns exactly one hit, line 4584, inside **restore**. There is no purge, no "forget", no reset-to-defaults control. `defaultMedicationConfig()` (331) is only the parse-failure fallback. |

ChemoWell is the same: one `delete archivedMeds[id]`, at `index.html:5980`, inside restore. Its only
"delete outright" is *Delete profile* / *Start over*, which erase the whole patient. That is not a
recovery path for one bad span.

### The required change (small, and no code behaviour moves)

Replace the claim in all five places — `README.md`, `CARETRACKER_HANDOFF.md`, `STATUS.md` KNOWN #1,
`index.html` comment, `harness/archived-meds-patch.py` (both the prose at :59 and the comment at
:298) — plus the ChemoWell copies, with what is actually true:

> **A wrong span cannot be cleared at all.** Restore appends; nothing removes; no screen shows a
> span; removing the medication again carries the span into the archive and bringing it back
> re-adds it. It is permanent until the stored medication config is edited by hand. Deliberate —
> a control that edits suppression is a control that can hide real missed doses — but it is
> permanent, and the worst case of the validator's reject-don't-clamp choice is therefore a
> permanent under-count, not a recoverable one.

If the team would rather keep the "recoverable" argument than change it, the other honest fix is to
add the missing control (a *Forget this medication* on the archived row, or clearing `awayPeriods`
when a medication is archived). That is a build, not a wording change, and it is not what I am
asking for.

---

## Everything else I attacked, and what it did

### 1. The upgrade-day copy — CLEAR, and true in every branch I could reach

- `knewWhenItLeft = !!Number(entry.removedAt)` (4576) and `awayFrom = dayStart(Number(entry.removedAt) || now)` (4577) branch on the same fact, so toast and behaviour cannot disagree.
- **Known case:** span = removal day → today, and the walk (1748) is inclusive at both ends, so every away day is suppressed. *"those days will not count as missed"* is **true**.
- **Unknown case:** span collapses to today alone, so every away day counts. *"Removed before this update — the app cannot tell when, so those days will still count as missed"* is **true** (it over-warns by one day: today is inside the single-day span — the safe direction).
- **The blurb** *"Each one says below whether the days it was away will still count as missed"* promises nothing. Correct.
- **What's New bullet 3** is conditional and true.
- **`daysAway` across a month boundary:** `Math.round((dayStart(now) - dayStart(left)) / 86400000)` uses absolute ms from local midnights, so month length is irrelevant, and `Math.round` absorbs the ±1h DST drift. Correct.
- **`h()` trap:** the new row is `h('div', {style:{…}}, <string>)` — no null or undefined attribute value, child is always a string. Clean.
- **Non-blocking:** with the clock moved backwards (or an archive synced from a phone that was ahead), `daysAway` goes negative and the row reads *"Removed today"*. Harmless, but `daysAway < 0` would more honestly read *"Removed recently"*.
- **Non-blocking (Voice):** *"those days"* on the row has no antecedent in its own sentence — it only resolves against the blurb higher up the screen. And *"Removed today · those days will not count as missed"* is plural for one day.

### 2. Section 4B's reload — CLEAR, and I proved it can fail

`load()` is a real `page.goto` with `serviceWorkers: 'block'` (suite lines 96-99), so the file is
re-parsed and `normalizeMedication` genuinely re-runs; it is not a cached page.

Falsified: `delete original.awayPeriods` at the top of `normalizeMedication` →

```
FAIL  and the span survives closing and reopening the app, which storage cannot prove
      | 277 before the reload -> 305 after          44/45
```

The number moves **only after the reload**, which is precisely what storage could not answer.

### 3. The validator — CLEAR as far as it claims to go, one honest gap left open

Falsified: `&& span.end <= Date.now()` removed →

```
FAIL  THE RECORD SURVIVES IT: the span is dropped on load, so nothing is suppressed
      | 305 expected -> 183 with the wide span planted          44/45
```

What I could not get through it: `{start,end}` non-numeric, arrays, `start > end`, zero or negative
ends, `end` in the future in any magnitude. `Number()` before `isFinite()` makes the coercion path safe.

**What still gets through, by design:** `{start: 1, end: <now>}` — a wide span that *ends* in the
past. The records say so out loud, which is right. Two refinements:

- **The claim "nothing here can write one" is not quite true.** `removedAt` is `dayStart(clock)` **at
  removal time** (4606). A phone whose date was wrong *when the medication was removed* — corrected
  afterwards — restores with a span reaching back to whatever that clock said, and that span passes
  the filter. STATUS.md KNOWN #1 only names *"the moment of restore"*, and its sentence *"it can
  never reach past the day the medication actually left"* is false in that case. Worth one clause.
- **The gap is cheaply narrowable and the records imply it is not.** Nothing before
  `MISSED_TRACK_SINCE` is ever flagged, so `span.start >= dayStart(MISSED_TRACK_SINCE)` costs nothing,
  loses nothing legitimate, and turns *"a past-ending span cannot be checked"* into *"cannot reach
  further back than tracking does."* Not a blocker; the exemption as written just overstates how
  closed the door is.

**Reject rather than clamp: right call, with one visible cost.** A span written on a phone whose
clock is slightly ahead of the one reading it is dropped, permanently (the normalised list is what
the next `persistMedicationConfig` writes). That direction is safe — it shows more missed doses, never
fewer — and matches the medsync note already in STATUS.md. Clamping would silently alter a record the
caregiver never sees, which is worse.

**`delete medication.awayPeriods` when empty is safe on every reader.** The four readers are
`missedDosesFor` (1748, `|| []`), `restoreMedicationConfig` (4579, `Array.isArray` guard),
`normalizeMedication` itself, and `medsyncConfigJson`'s stable stringify. Nothing writes `[]`, and
normalisation deletes rather than empties, so two v75 devices produce identical JSON and an older
device's dropped field looks the same as a delete. No spurious sync diff.

### 4. The records — numbers check out, and I reproduced them

I ran `harness/archived-meds-test.mjs` clean on the working tree: **45/45**.

| Claim | Measured | |
|---|---|---|
| `archived-meds-test` 45/45 | 45/45 | ✅ |
| 305 → 277 after restore with a 14-day span | `305 if nothing were suppressed -> 277 now` | ✅ |
| above the 183 it reads with the medication removed | `183 with it removed -> 277` | ✅ |
| span survives a reload | `277 before the reload -> 277 after` | ✅ |
| a wide planted span is dropped | `305 expected -> 305 with the wide span planted` | ✅ |
| 14 days recorded, not the restore day | `14 days recorded` | ✅ |
| `index.html` / `sw.js` md5 in STATUS.md | `24bdacc…` / `266e970…` | ✅ |
| beta `index.html` md5 in BETA_STATUS.md | `3812d1a…` | ✅ |
| `python3 pm.py` | exit 2, one disclosed warning (pre-existing pinned literals) | ✅ |

**Stated exemptions I checked and found TRUE:** the restore day is inside the span (1748 is inclusive
at both ends); spans accumulate without merging (4582 `.concat`); an old phone republishing over
medsync strips the fields and shows *more* missed doses, not fewer.

**Stated exemption I found FALSE:** the recoverability claim above. That is the blocker.

**Record hygiene, non-blocking but fix before the release message:**
- `outputs/SUITES-v75.md` is **uncommitted** and now holds **two appended sweeps** — 63 rows, several
  suites listed twice, two closing lines. `pm.py` passes on it and STATUS.md's 45/45 matches it, but
  the **committed** copy at `ab90f64` still says 43/43. Rule 0: push it, and write it rather than
  append to it.
- `outputs/v69-report-after-edit.html` is also uncommitted.
- `README.md` and `CARETRACKER_HANDOFF.md` say *"28 suppressed is exactly fourteen days times two
  Protonix windows."* The span is inclusive at both ends — fifteen days — and 28 only comes out
  because the restore day contributed nothing at the hour the sweep ran. The suite asserts
  inequalities, so nothing is fragile; the sentence is just arithmetic that will not reproduce later
  in the day. Say *"fourteen full days"* or drop the multiplication.

### 5. The two things worth a glance

- **`pm.py`'s new suite check** does what it says: a row per file in `harness/`, plus a closing line,
  and it named the aborted-sweep hole it closes. It passed on the duplicated file — tolerating
  duplicates is fine, but a second sweep appending rather than replacing is how a stale row survives.
- **`/home/user/chemowell-beta/harness-archived-meds-patch.py`** — `REPO = HERE` is correct for a patch
  that sits in the repo root; run with no arguments it now finds `index.html` and refuses cleanly
  (*"base is beta-v62, this patch transforms beta-v61 -> beta-v62"*), which is the reproducibility
  guard behaving.
- **Non-blocking, and it is the sibling-drift finding again:** `/home/user/chemowell-beta/index.html`
  carries the validator (line 255) but its `harness/archived-meds-test.mjs` has **no section 4C**.
  The beta ships a validator with no check on it — which is the exact thing commit `5d2c5f9` is named
  after. beta is deliberately unmerged so this blocks nothing, but port 4C before it ever merges.

---

## What I did NOT re-derive

The third pass's end-to-end measurement of the both-ended mechanism (banner 305 → 183 → 277, export
122 → 0 → 94, History 61 → 0 → 47, survives reload / edit-and-save / a second cycle, zero
`removeEntryDB`/`addEntryDB`/`addDoc`/`deleteDoc` in the diff, both patches byte-for-byte). Taken as
established.

No test data reached Firestore: every run was `env -u HTTPS_PROXY …` against the stubbed harness.
`index.html` and the patches were not modified; mutants were written to the scratchpad.

---

## VERDICT: DO NOT SHIP

**The one change required:** correct the recoverability claim — *"a wrong span stays until the
medication is deleted outright"* / *"undone by deleting the medication"* — in `README.md`,
`CARETRACKER_HANDOFF.md`, `STATUS.md` (KNOWN #1), `index.html`'s comment and
`harness/archived-meds-patch.py` (both places), and the ChemoWell copies of the same comment. A wrong
span cannot be cleared by any control the app has. Everything else on this delta is clear, and the
non-blocking items above can ride in the same commit.
