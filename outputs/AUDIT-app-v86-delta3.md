AUDITED-COMMIT: 4d6db99
VERDICT: SHIP

# Zero Day Audit — ChemoWell app-v86, THIRD DELTA pass (`4d6db99`, branch `claude/caretracker-team-review-i83ik2`)

**Every one of the five claims in this delta is real, and I proved each with a mutant rather than
reading the diff.** The rename blocker is dead on both arms, measured on a fresh page outside the
suite with a throwing `Storage.setItem`: a failing **list** write now leaves `profiles.list` and
`patientName` both holding the old name, returns `false`, paints the new name nowhere, throws
nothing, and the toast *"Could not save that name — nothing was changed."* is true in both arms. All
three of the predecessor's survivors — the rename rollback arm, the `!rads` clause, the appetite
note comparison — now turn the suite red. The live delete-based correction on the bowel banner is
gone: correcting from the banner keeps the earlier answer, the export marks it *"(corrected later —
superseded)"*, and the History day summary still reads **"1 BM"**, all measured through the real
banner control. **80/80.** Nine regression suites match the previous pass exactly, including the one
pre-existing red, whose message is byte-identical.

**Nothing in this delta loses a record, tells the caregiver something false, or leaves an assertion
that cannot vary.** I am not refusing it.

**What I found is three pieces of code with no check over them at all, and one of them is the only
caregiver-facing string this delta adds.** Fourteen mutants, five survive. The banner's new toast can
be made to say *"Already logged as Normal for that day."* after a correction that **did** write — the
false-reassurance shape this release has now been refused for twice — and the suite scores a clean
80/80. So can the inverse. And the `!isSupersededEntry` filter on the History day summary's `bms` and
`appetites` counters can be deleted with the suite green, which is the **same shape as D3** that the
last pass refused on, now sitting on the path this delta just made the normal one. The shipped code
is correct in all four cases; I measured it. That is the difference between this and a block.

---

## THE FIVE DELTA CLAIMS, EACH VERIFIED

### 1. The blocker (D1) — FIXED. One `try` per write, and only the write that SUCCEEDED is rolled back.

`index.html:706-721`. The shipped shape is not the one D1 proposed, and it is better: the prefs-write
failure now returns before the list write is ever attempted, so there is nothing to roll back; the
list-write failure rolls back prefs only.

```js
try { await setPrefsDB({ patientName: name }); }
catch (e) { setToast('Could not save that name — nothing was changed.'); return false; }
try { me.name = name; saveJSON(PROFILES_KEY, ps); }
catch (e) { me.name = previous; try { await setPrefsDB({ patientName: previous }); } catch (e2) {}
            setToast('Could not save that name — nothing was changed.'); return false; }
```

**Measured independently of the suite, fresh context per arm, `Storage.prototype.setItem` throwing on
one key only** (`scratchpad/p_rename3.mjs`):

| arm that throws | `profiles.list` | `prefs.patientName` | returns | new name on screen | pageerrors | toast |
|---|---|---|---|---|---|---|
| `-prefs-v1` | `Old Name` | `Old Name` | `false` | 0 occurrences | none | **true** |
| `-profiles-v1` | `Old Name` | `Old Name` | `false` | 0 occurrences | none | **true** |

This is the state `0f73911` had on one arm and `5ae0f67` had on neither. `profilesState()` returns a
fresh parse each call (`index.html:250`), so a failed `saveJSON` cannot have left anything on disk and
`me.name = previous` is bookkeeping on a local object — correct either way.

**Residual, named rather than skipped:** if the prefs *rollback* itself throws (a double failure), the
toast is false. D1's own proposed fix had the same property. Not reachable from a single quota event.

### 2. The check that was blind to it (D4) — ADDED, and it is the check that would have stopped D1.

Section 16b's second case throws on `/-profiles-v1$/`.

```
16b. A FAILED RENAME LEAVES BOTH STORES AS THEY WERE
  PASS  a rename whose LIST write fails also reports failure  |  returned false
  PASS  and patientName is rolled back, not left holding the new name
        |  patientName=Renamed Target list=p1=First Person,p2=Renamed Target
```

**M-K, the predecessor's named survivor, is dead.** Deleting the rollback arm:

```
M-K  me.name = previous; try { await setPrefsDB({ patientName: previous }); } catch (e2) {}   -> removed
     FAIL  and patientName is rolled back, not left holding the new name  |  patientName=List Fail Name
     80 checks: 79 passed, 1 failed      KILLED  (was 69/69 SURVIVES)
```

Nit, not blocking: the new assertion checks `prefName` only, not the list. The list cannot drift in
this arm (`saveJSON` is what threw), so it is sound today; one more clause would make it sound by
construction rather than by argument.

### 3. The live delete path (D6) — FIXED, and the check drives the real control.

`submitBowelBannerUpdate` (`index.html:3801`) now calls `logBowelMovement(v, day)` and nothing else.
I pushed hard on whether section 13c is reaching the banner, because it finds its `<select>` by
option text and the retrospective bowel card also carries a Normal/Diarrhea select. **Two mutants
settle it:**

```
M-BB1  banner reverts to delete-then-relog
       FAIL  correcting from the banner KEEPS the earlier answer  |  ["normal"]
       80 checks: 79 passed, 1 failed      KILLED
M-BB2  submitBowelBannerUpdate() { if (1) return; ... }       (does the click land at all?)
       FAIL  correcting from the banner KEEPS the earlier answer  |  ["diarrhea"]
       FAIL  and the corrected value is the one that stands      |  ["diarrhea"]
       80 checks: 78 passed, 2 failed      KILLED
```

If 13c were clicking the retrospective card instead, it would write for *yesterday* and
`values[last]` would still be `diarrhea` — the second assertion catches that. It does not fire. The
check is on the banner.

**The questions asked about the new `false` path, each answered by measurement**
(`scratchpad/p_toast.mjs`, real banner, real click):

```
A. correct diarrhea -> Normal : toast="Bowel movement updated — Normal"
                                n=2  values=["diarrhea","normal"]  banner gone
B. re-pick the SAME value     : toast="Already logged as Diarrhea for that day."
                                n=1  values=["diarrhea"]           banner still up
C. correct again, then History: summary="1 BM"
                                export=["12:00 PM | Diarrhea (corrected later — superseded)",
                                        "12:00 PM | Normal"]
```

- **The refusal path is correct.** One record, no duplicate, the banner correctly stays up because
  `diarrhea` is still an issue value.
- **`bowelBannerInput` is cleared on both outcomes and not on a throw** — right in all three cases:
  after a refusal the stale selection should not persist, and after a failure it should, so the
  caregiver can retry. The `catch` does not clear it.
- **`latestBowelDay()` still points where the toast implies.** `supersedeStamp` returns
  `max(prev.ts + 1000, d0 + 12h)`, so the superseding entry stays inside the same day; the banner's
  `bannerDay` and its label are unchanged by the correction.
- **No case where the banner should delete and now cannot.** Every downstream reader of bowel data
  goes through `bowelMovementEntriesByDay()` (latest-per-day) or `isSupersededEntry`, so the
  one-answer-per-day invariant the old comment protected is preserved by derivation instead of by
  deletion. Removal is still available per entry on the History timeline, and `bowel_movement` is in
  `BYPASS_48H_IDS`, so an old one is still removable.

### 4. The two vacuous checks (D3, D5) — BOTH COVERED.

```
13a. A RADIATION-ONLY DAY IS NOT "NOTHING LOGGED" EITHER
M-I2  drop !rads from nothingElseLogged
      PASS  precondition: the day holds a radiation session and nothing else  |  "Nothing logged · 1 radiation"
      FAIL  and the summary does not also say "Nothing logged"                |  "Nothing logged · 1 radiation"
      80 checks: 79 passed, 1 failed      KILLED  (was 69/69 SURVIVES)

13b. (new tail) THE NOTE IS PART OF THE ANSWER
M-N   if (prev && prev.value === value && ((prev.note||'').trim() === trimmedNote))  ->  drop the note clause
      FAIL  but the same value with a NEW note is a real correction and is written  |  returned false
      FAIL  and the new note is the one that stands                                 |  note="only managed toast"
      80 checks: 78 passed, 2 failed      KILLED  (was 69/69 SURVIVES)
```

13a is well built: the precondition and the assertion read the same span, so a regex that stops
matching fails the precondition loudly instead of letting the assertion pass on an empty string.

### 5. The check-in's `''` third argument (D2) — DROPPED, and the fixture now carries a note.

`index.html:3654` is `await logAppetite(m.appetite, todayStart)`. Section 12b's appetite fixture
carries `note: 'only managed toast'` and a fourth assertion guards it. Reverting the one word:

```
M-D2  logAppetite(m.appetite, todayStart)  ->  logAppetite(m.appetite, todayStart, '')
      FAIL  and the appetite answer is not duplicated either          |  1 -> 2
      FAIL  and the note on that answer survives the re-confirmation  |  note=""
      FAIL  so the export does not mark an identical answer as corrected
            |  ["Little to none (corrected later — superseded)"]
      80 checks: 77 passed, 3 failed      KILLED
```

The predecessor's D2 repro — press Save on an unchanged check-in sheet whose appetite answer carries
a note — no longer reproduces.

---

## NEW FINDINGS

None of these is a live defect. All four are code with no check over it, found by eleven mutants
beyond the three I was asked to re-run.

### E1 — MEDIUM (gate). The banner's new toast is the only caregiver-facing string this delta adds, and nothing checks it. Both branches survive.

```
M-T1  setToast(changed ? 'Bowel movement updated — X' : 'Already logged as X for that day.')
   -> setToast(false   ? ...)                                80 checks: 80 passed    SURVIVES
M-T2  -> setToast(true ? ...)                                80 checks: 80 passed    SURVIVES
```

With M-T1 the app tells a caregiver who has just corrected *Diarrhea* to *Normal* that it was
**already logged as Normal** — a false reassurance about a write that did happen, on the pinned
banner, which is exactly the class the Voice exists for and exactly the class this release has
already been refused for twice (the v65 *"the frosted glass is gone"* shape, and D1's
*"nothing was changed"*).

Section 13c already clicks the control and already knows what it expects; it asserts the records and
walks past the sentence. **Fix: two lines** — return the toast text from 13c's `evaluate` (it is
`[...document.querySelectorAll('[role="status"]')]`) and assert `/updated/i` on the correcting case,
plus one refusal case asserting `/Already logged/i`. Both strings are measured above and can be
pasted in.

**Not blocking** because the shipped branch is right on both arms, probed live (A and B above).

**Voice verdict on the string itself: true and plain.** `logBowelMovement` returns `false` only when
`prev.value === value`, so "Already logged as X" is literally what the record says. *"for that day"*
rather than *"for today"* is the correct choice and not a slip — the banner can target yesterday or
an older date, and its own label two lines above names which (*"Update status for yesterday"*). The
Reports logger's sibling toast says *"for today."* because that one is always today. No gendered
pronoun, no medication id, no dose.

### E2 — MEDIUM (gate). The superseded filter on the History day-summary counters is covered by nothing, and this delta is what makes it matter.

```
M-BMS  const bms = items.filter(e => e.medId === 'bowel_movement' && !isSupersededEntry(e, state.entries)).length
    -> const bms = items.filter(e => e.medId === 'bowel_movement').length
       80 checks: 80 passed, 0 failed      SURVIVES
M-APC  the same deletion on `appetites`
       80 checks: 80 passed, 0 failed      SURVIVES
```

**This is D3's shape exactly.** Every fixture that opens History (sections 13, 13a, 14) holds at most
one answer per day and none holds a superseded pair, so the filter cannot vary. Section 15 has the
superseded pair but only reads the export. With M-BMS a day corrected once from the banner reads
**"2 BM"** for a single answer.

**The live code is correct — I measured it rather than assuming** (probe C above): after a real
banner correction the summary reads `"1 BM"`. **Fix:** open History on section 15's fixture (it
already has the pair) and assert `/1 BM/` and no `/2 BM/`; re-run M-BMS and M-APC and show them red.
One fixture, already written, two assertions.

### E3 — LOW, carried forward, pre-existing in this release but newly common because of it. The in-app History timeline does not mark a superseded answer.

`isSupersededEntry` is read in exactly three places: the export/print detail string, and the two
summary counters. The History **rows** are not among them. After a banner correction the timeline
shows two rows both labelled *"Bowel Movement"*, both printing the same minute (`fmtTime` is hour and
minute; the supersede stamp lands one second later), with nothing saying which stands, directly under
a summary that says *"1 BM"*:

```
C. History rows mentioning Bowel Movement: ["Bowel Movement","Bowel Movement"]
C. History day summary: "1 BM"
```

**The changelog is NOT false** — it says *"the exported file and the printed report mark it as
corrected"*, and both do (`openPrintReport` and `downloadEntriesCSV` share `buildExportRows`; I
checked both call sites). The copy was written precisely. But the reasoning that earned the export
marker — *"without this a clinician saw 'Normal' and 'Diarrhea' on the same line of the day with no
way to tell which one stands"*, the comment at `index.html:10371` — applies word for word to the
screen the caregiver actually reads, and this delta turns the banner into the route that produces it.
Predates `5ae0f67` (the Reports logger and the check-in already superseded), so not mine to block on.
Worth a `BACKLOG.md` line.

### E4 — LOW, cosmetic. `M-BI` survives.

```
M-BI  remove setState({ bowelBannerInput: undefined }) from the banner handler
      80 checks: 80 passed, 0 failed      SURVIVES
```

A stale selection left in a dropdown. Shipped behaviour is right. Noted for completeness only.

### E5 — LOW, record. The README still names a path that does not exist.

*"a correction dropped any note the check-in had attached"*. The check-in sheet has an Appetite
`<select>` and one free-text field labelled *"Anything else?"* whose help text says
*"Goes to today's Notes"* (`index.html:3714`) — there is **no** appetite-note field anywhere on it. The
previous pass listed this as a follow-up; it was not taken. One clause.

### E6 — LOW, record. "Five vacuous checks" and "eighteen mutants" read as saturation, and they are not.

Both numbers are honest counts of what each round found, and I am not calling them false. But the
row's shape — *"Two more vacuous checks, bringing the total on this release to five"*, immediately
before *"80/80 against eighteen mutants in total"* — invites a reader to conclude the hunt is
finished. Eleven further mutants in this pass turned up E1, E2 and E4. Suggest: *"…five found so far;
a fourth pass added three more uncovered behaviours."* **A count of what was found is not a measure
of what is left**, and this README is the record Aaron reads.

---

## WHAT I PUSHED ON AND FOUND SOUND

**The changelog line this delta exists to make true, walked across every live path.** Only two
functions ever write a bowel or appetite record (`logBowelMovement:3749`, `logAppetite:3838`); both
supersede and neither deletes. Their live callers are `confirmCheckinModal` (3654/3655),
`renderDailyValueLogger.onPick` for both metrics (11755/11785), and `submitBowelBannerUpdate` (3812).
`submitBowelMovement` and `submitAppetite` still carry delete-then-relog and are genuinely dead —
`grep` finds no caller for either, and `BACKLOG.md:18` names exactly those two and no longer
misdescribes the set. The only other `removeEntryDB` on a correction path is the symptom edit at
3262, which is not bowel or appetite. **The line is now true on every live route.**

**The export and the print report both mark it.** `downloadEntriesCSV:10662` and
`openPrintReport:10717` both call `buildExportRows()`, so *"and the exported file and the printed
report mark it as corrected"* is true of both, not just the CSV.

**Mutants that killed cleanly on the surrounding machinery**, run because the banner change leans on
all of it: `supersedeStamp` reverted to the colliding base stamp (77/80), `isSupersededEntry`
loosened from `>` to `>=` (77/80), and the export marker disabled (78/80).

**`window.__v86Test.logAppetite` added to the test hook.** Unconditionally exposed, like every other
hook in that block — including `window.__eraseTest = eraseAllAppData`. Writing an appetite entry is
something the UI already does; this is consistent with a pre-existing deliberate pattern, not a new
surface.

**Rule 0 — clean.** Grepped every added line of `index.html` and the suite for
`she|her|hers|herself|he|him|his|himself|brandi`: zero, comments included. The README delta adds no
gendered pronoun either. No dose, ceiling or schedule. No behaviour keyed to a medication id — the
delta touches `bowel_movement` and `appetite`, which are this app's own record types, and
`v75-no-other-patient` agrees at 27/27 with its three-number ratchet unmoved.

**The Voice.** One new caregiver-facing string (E1 above: true, plain, correctly scoped to "that
day"). Nothing else in `index.html` changed that a caregiver reads — the rest of the delta is two
guards, one argument removed, three comments and a test hook. No number is added to any screen.

**Release mechanics.** `APP_VERSION = 'app-v86'` and `sw.js` CACHE `chemowell-app-v86-1`, unchanged by
this delta and still moving together. The delta touches no `style`, `px` or `color` — zero
style-bearing lines — so the Designer's 18 shots at 320/360/390 stand. No `outputs/PM*app-v86*` exists,
so `release_check.sh` still stops at the missing-sign-off branch; that is Rule 6's order working, and
this report is the audit half of it, not the PM half.

---

## MUTANT BOARD

Fourteen mutants. Each applied in place with Python against a byte copy taken before the first
mutation, suite run, file restored, `md5sum -c` on `index.html`, `sw.js`, `README.md`, `BACKLOG.md`
and `test/v86-logging-and-labels.mjs` after every one. All five identical at the end.

| # | Mutation | Suite | Verdict |
|---|---|---|---|
| M-K | delete `renameActiveProfile`'s rollback arm | 79/80 | **KILLED** — was the delta's named survivor |
| M-I2 | drop `!rads` from `nothingElseLogged` | 79/80 | **KILLED** — was a survivor |
| M-N | appetite guard ignores the note | 78/80 | **KILLED** — was a survivor |
| M-D2 | restore the check-in's `''` third argument | 77/80 | KILLED |
| M-BB1 | banner reverts to delete-then-relog | 79/80 | KILLED |
| M-BB2 | banner handler is a no-op (does 13c's click land?) | 78/80 | KILLED |
| M-SS | `supersedeStamp` returns the colliding base | 77/80 | KILLED |
| M-SE | `isSupersededEntry` `o.ts > e.ts` → `>=` | 77/80 | KILLED |
| M-EXP | export drops the superseded marker | 78/80 | KILLED |
| **M-T1** | **banner toast always "Already logged as X"** | **80/80** | **SURVIVES — E1** |
| **M-T2** | **banner toast always "updated"** | **80/80** | **SURVIVES — E1** |
| **M-BMS** | **drop `!isSupersededEntry` from the `bms` counter** | **80/80** | **SURVIVES — E2** |
| **M-APC** | **drop `!isSupersededEntry` from the `appetites` counter** | **80/80** | **SURVIVES — E2** |
| **M-BI** | **banner never clears `bowelBannerInput`** | **80/80** | **SURVIVES — E4, cosmetic** |

---

## SUITES

All against `4d6db99`, clean tree, hashes verified before the run, loopback `:8899`, headless
Chromium 390×844.

| suite | result | vs. the previous pass |
|---|---|---|
| `v86-logging-and-labels` | **80/80** | 69/69 → 80/80, eleven checks added |
| `v85-profile-reminders` | 43/43 | unchanged |
| `v83-meds-and-reports` | 80/80 | unchanged |
| `v75-no-other-patient` | 27/27 | unchanged, ratchet unmoved |
| `v80-up-next` | 49/49 | unchanged |
| `v58-eod-checkin` | 10/10 | unchanged |
| `v84-whatsnew` | 95/96 | unchanged — pre-existing red, message byte-identical: *"precondition: the field is below the fold… top=836 in a 844px viewport"* |
| `v64-logger` | 23/23 | unchanged |
| `v59-para` | 15/15 | unchanged |

Section 19's self-referential ratchet agrees: *"README says 80/80, this run counts 80."*
Section 18 reports no page error on any page, with the listener attached to the context.

---

## FOLLOW-UPS I AM NOT BLOCKING ON

In the order I would take them. The first two are about four lines each and both fixtures already
exist.

1. **E1** — assert the banner's toast in 13c, both branches. The strings are measured in this report.
2. **E2** — open History on section 15's existing superseded fixture and assert `1 BM`; re-run M-BMS
   and M-APC and show them red.
3. **E5** — strike *"a note the check-in had attached"* from the README row; the sheet has no such
   field.
4. **E6** — one clause so the vacuous-check tally does not read as a saturation claim.
5. **E3** — `BACKLOG.md`: the in-app History timeline shows a superseded daily answer unmarked, at the
   same displayed minute as the one that stands, while the export and the print report mark it.
6. **E4** — `M-BI`, cosmetic.
7. Carried from the previous pass and still open: 16b's new assertion reads `prefName` only, not the
   list; D7's one-line Save precondition in 12b; N5, N6 and the two dead `submit*` twins in
   `BACKLOG.md`; `REQUESTS.md` still ends 2026-09-15, which is the PM's step.

---

## DELIBERATELY EXEMPT, STATED RATHER THAN SKIPPED

Everything here was measured in headless Chromium at 390×844 on loopback. **There is no iPhone and no
Safari in this sandbox and nothing in this release has been on a real phone** — that is the standing
exemption on every release and it still applies. No Firebase, no network path, and no `caretracker_*`
name was read or written. The three pre-existing reds are recorded, not fixed; `v71-report-controls`
still aborts at `para-add` and I did not re-run it, so every check after that point in that file
remains unexercised on this release as on the last three. I did not re-measure N6's export
performance figures — they are in `BACKLOG.md` as measurements, which is the right place. The
`!e.missed` filter on `rads` still has no reachable behaviour, so it stays deliberately uncovered. I
did not re-litigate anything before `5ae0f67` except where this delta disturbed it.

---

## HOUSEKEEPING

Fourteen mutants and four probes. Every mutation applied in place with Python against
`scratchpad/index.html.orig`, a byte copy taken before the first one; file restored from that copy
after each; `md5sum -c` against a pre-audit baseline after every mutant and again at the end — all
five tracked files OK. No `git add`, `checkout`, `reset` or `stash`. No commit, no push.
`git status --porcelain` shows only this file. The one server I started (`python3 -m http.server
8899` on the working tree) is stopped and the port refuses connections. Two stray `.json` mutant
fragments were briefly created in the repo root by a shell slip and were deleted in the same minute;
`git status` was clean immediately after and is clean now. Probe and mutation scripts live in the
session scratchpad at
`/tmp/claude-0/-home-user/41e5d279-40d0-5a8a-b4e0-827057dd9522/scratchpad/`
(`p_toast.mjs`, `p_rename3.mjs`, `mutate.py`, `lmut.py`, `sweep.sh`, `reg.sh`, `baseline.md5`,
`index.html.orig`) and are not in the repo.
