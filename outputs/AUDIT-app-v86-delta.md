AUDITED-COMMIT: 0f73911
VERDICT: SHIP

# Zero Day Audit — ChemoWell app-v86, DELTA pass (`0f73911`, branch `claude/caretracker-team-review-i83ik2`)

**The two blockers are genuinely dead, and I killed them myself with mutants rather than taking the
commit's word for it.** The Home check-in now wins the latest-wins comparison on both metrics; a day
of only bowel and appetite reads *"1 BM · 1 appetite"* instead of *"Nothing logged"*. The two mutants
that scored a clean 38/38 last round both turn the suite red now. `60/60`, and seven of the eight
mutants I built against the new code die.

**What I found that the fix round did not.** The release's own stated lesson on F1 was *"the shape
was the defect, not the arithmetic — an opt-in argument four of five writers never opted into."* The
F4 no-op guard was then written in the same shape, in the UI handler, and the Home check-in was left
out of it again. Re-confirming the answer already recorded from the evening check-in writes a
duplicate, and because F3's marker now runs over the export, the doctor-facing file prints
*"Normal (corrected later — superseded)"* directly above *"Normal"* — a correction that did not
happen — and the note the caregiver had attached stays only on the row marked superseded. Reproduced
end to end through the shipped check-in sheet.

That is a MEDIUM, not a blocker: both rows carry the same value, so no clinician misreads the
patient's condition, and the duplicate itself predates this release. It is two lines to fix and the
guard already exists one function away. **Two further gate gaps**: the radiation counter — one of the
three types F2 named — has no check at all, and the section that claims to cover it has no radiation
entry in its fixture; and the F7 try/catch cannot catch a failure of the first of its two writes,
because `setPrefsDB` is `async` and is called without `await`.

Nothing here loses a record, asserts an absence that is not true, or tells the caregiver something
false. Ship, and take items 1 and 2 below in the same push if the builder is still in the loop.

---

## THE SEVEN FINDINGS, EACH VERIFIED

### F1 — FIXED. Mutant dies.

`logBowelMovement(value, dayStartTs)` and `logAppetite(value, dayStartTs, note)` compute the stamp
themselves; the fourth argument is gone from the file, so there is nothing left for a writer to
forget. Every one of the five writers the predecessor tabulated now goes through it.

The honest mutant is not "revert `supersedeStamp` to the base stamp" — that makes *all* writers
agree again and the bug disappears. The bug was the **asymmetry**, so I restored exactly that: the
check-in writing `addEntryDB` at `midday` directly while the logger supersedes.

```
M-F1  confirmCheckinModal's bowel line -> addEntryDB({... ts: midday })
  FAIL  AND IT IS THE ONE THAT STANDS -- it does not lose to the earlier picks
        | latest=loose of ["normal","diarrhea","loose"]
  60 checks: 59 passed, 1 failed       KILLED
```

The brief's own suggested mutant (`ts: dayStartTs + 12 * 3600000` back inside `logBowelMovement`)
also turns it red, at 57/60, via sections 3 and 15.

### F2 — FIXED for bowel and appetite. Radiation is correct in the code and covered by nothing.

Rendered, on a day holding one bowel and one appetite record and nothing else:

```
summary="1 BM · 1 appetite"        (was: "Nothing logged")
```

Deleting the `bms` segment → `FAIL it counts them under their own names | summary="1 appetite"`,
59/60. **KILLED.**

Deleting the radiation segment *and* dropping `!rads` from `nothingElseLogged` → **60/60. SURVIVES.**
See new finding N2.

I checked the shipped behaviour separately with a real radiation-only day: it reads `1 radiation`
and no "Nothing logged" appears anywhere. The code is right; only the check is missing.

### F3 — FIXED, and the marker goes exactly where it should and nowhere else.

```
EXPORT (CSV + printed report), one correction:
  2026-10-25 12:00 PM | Bowel Movement | Normal (corrected later — superseded)
  2026-10-25 12:00 PM | Bowel Movement | Diarrhea
PRINTED REPORT HTML (escHtml applied):
  <tr><td>12:00 PM</td><td>Bowel Movement</td><td>Normal (corrected later — superseded)</td></tr>
```

Em dash renders correctly (the document declares `charset=utf-8`); nothing in the marker needs
HTML or CSV escaping and nothing is mangled.

**Where it does NOT reach, all checked:** `buildExportRows()` has exactly two callers,
`downloadEntriesCSV()` and `openPrintReport()`. The backup is `cwBkCollect()` →
`loadJSON(ENTRIES_KEY)`, raw entries, so the marker never enters a backup file and the round trip
cannot bake it into stored data. The on-screen History list, the day summary and every toast build
their own strings. Confirmed on screen: `/corrected later/` is false in `document.body.innerText`.

**`isSupersededEntry` attacked across six shapes.** It is derived at render time with no stored
flag, which is the right call:

| case | result |
|---|---|
| three corrections in one day (`base`, `+1s`, `+2s`) | first two marked, third not — correct |
| the newest answer is removed | the one below it **un-marks** itself (`["Normal"]`, no marker) — correct |
| a legacy entry at 23:59 beside a noon one, same day | the 23:59 one stands, noon marked — correct |
| a future-stamped entry (23:30 while it is noon) | the later one stands — correct |
| a day with a radiation record and nothing superseadable | `false`, early-returns on the medId set |
| DST / timezone shift | both entries of a day sit at `dayStart+12h±seconds`, so they move together under any offset; `dayStart()` cannot split them |

### F4 — FIXED for the Reports logger. Mutant dies.

```
four taps on the value already showing: 1 -> 1 record
toast: "Already logged as Normal for today."
M-F4  guard deleted -> FAIL "1 -> 5", and the export fills with five identical marked rows
      60 checks: 58 passed, 2 failed      KILLED
```

Not fixed on the Home check-in. That is new finding **N1**.

### F5 — FIXED. The survivor is dead.

```
M-A  find(x => x.id === ACTIVE_PROFILE_ID) -> [0]
  FAIL  the ACTIVE profile is the one renamed      | p1=Renamed Target,p2=Second Person
  FAIL  the first profile in the list is untouched | p1=Renamed Target,p2=Second Person
  60 checks: 58 passed, 2 failed       KILLED  (was 38/38 clean)
```

The fixture is non-vacuous: it seeds `p-p1-prefs-v1` with its own `patientName` explicitly, so
"the untouched profile keeps its own patientName" is reading a value that exists rather than an
absent key.

### F6 — FIXED. The survivor is dead.

```
M-B  heroSnoozeUntil: Date.now() + 90 * 60 * 1000   (label and toast untouched)
  FAIL  the snooze really is set ~15 minutes out, not just labelled that way
        | handler set it 89.99 minutes out
  60 checks: 59 passed, 1 failed       KILLED  (was 38/38 clean)
```

The check reads `state.heroSnoozeUntil` through the hook in the same breath as the click, which is
what the predecessor asked for. The suite now tests what the app DOES, not three strings about it.

### F7 — HALF FIXED, and the half that is missing is the one the comment promises. See N3.

### F9 / `nextMedicationId` — FIXED, and the v78 fence is NOT back.

```
Weight -> weight-2 · Appetite -> appetite-2 · Paracentesis -> paracentesis-2 · Temperature -> temperature
Ondansetron -> ondansetron       (a real drug name still gets its plain id)
isDoseEntry({medId:'weight-2'}) === true
M   taken = id => ids.has(id)          60 checks: 56 passed, 4 failed      KILLED
```

- **Cannot loop forever.** `base + '-' + suffix` can never be in `NON_DOSE_MED_IDS` (no member
  carries a `-N` suffix) and can never start `symptom_` (`safeMedicationId` maps `_` to `-`), so the
  new clauses add at most one iteration.
- **Does not break restoring an archived or legacy medication already holding a reserved id.**
  `nextMedicationId` returns `existingId` on line 2 of the function, before any `taken()` call, and
  the restore path goes through `safeMedicationId(original.id, …)` at `index.html:1524` and never
  touches `nextMedicationId` at all. A phone that already has a medication with the id `weight`
  keeps it.
- `id.indexOf('symptom_') === 0` is unreachable from user input for the reason above. Harmless, and
  honest as a belt-and-braces clause.
- `v75-no-other-patient` **27/27**, ratchet pinned 0/0/0 and found 0/0/0.

### F11 — README corrected.

The version row now records **three** pre-existing reds and names `v57-search` with its reason. I
re-ran the suite: `FAIL app-v66 every "litre" … 3 in the file, 1 in parsed keyword arrays`, and the
two unaccounted hits really are code comments at `index.html:2902` and `index.html:6215`. The
explanation in the README is accurate.

`REQUESTS.md` still carries nothing after 2026-09-15 — the eight queued items live only in the
README cell. The predecessor called this the PM's step and I agree; not mine to block on.

---

## MUTANT BOARD

Every mutant applied in place with Python, suite run, file restored from a byte copy taken before
any mutation, and all six tracked files `md5sum`-compared after each one. All six identical at the
end.

| # | Mutation | Suite | Verdict |
|---|---|---|---|
| M-A | `find(…ACTIVE_PROFILE_ID)` → `list[0]` | 58/60 | **KILLED** (was a survivor) |
| M-B | snooze handler → literal 90 minutes | 59/60 | **KILLED** (was a survivor) |
| M-C | check-in writes at `midday`, logger supersedes — the real F1 | 59/60 | **KILLED** |
| M-D | `ts: supersedeStamp(…)` → `dayStartTs + 12h` in `logBowelMovement` | 57/60 | **KILLED** |
| M-E | delete the `bms` segment | 59/60 | **KILLED** |
| M-F | `o.ts > e.ts` → `>=` in `isSupersededEntry` | 57/60 | **KILLED** |
| M-G | delete the no-op guard | 58/60 | **KILLED** |
| M-H | `taken` → `ids.has(id)` only | 56/60 | **KILLED** |
| **M-I** | **delete the `rads` segment AND `!rads` from `nothingElseLogged`** | **60/60** | **SURVIVES — N2** |
| **M-J** | **appetite note preservation reverted to `String(note \|\| '')`** | **60/60** | **SURVIVES — N4** |
| **M-K** | **delete the rollback arm of `renameActiveProfile`'s catch** | **60/60** | **SURVIVES — N3** |

---

## NEW FINDINGS

### N1 — MEDIUM. The Home check-in has no no-op guard, so the export prints a correction that did not happen and the note falls off the answer that stands.

**Introduced by this release** (the marker and the deterministic note loss; the duplicate itself is
older). **Reproduced through the shipped check-in sheet**, not through a hook.

Fixture: appetite already logged `Normal` today with the note *"ate half a sandwich"*; bowel not yet
answered, so the Home check-in card is on screen (`checkinDoneForDay()` suppresses it only when
**every** opted-in metric has an entry — an ordinary day with the new Reports logger in use). Answer
both selects `Normal` and Save:

```
BEFORE: [{"m":"appetite","v":"normal","note":"ate half a sandwich"}]
AFTER : [{"m":"appetite","v":"normal","note":"ate half a sandwich","ts":…600000},
         {"m":"appetite","v":"normal","note":null,              "ts":…601000},
         {"m":"bowel_movement","v":"normal","note":null,        "ts":…600000}]

EXPORT:
   12:00 PM | Appetite       | Normal (corrected later — superseded) | note=ate half a sandwich
   12:00 PM | Appetite       | Normal                                | note=
   12:00 PM | Bowel Movement | Normal                                | note=
```

A nurse reads that the appetite answer was *corrected* — from Normal to Normal — and that the
patient's own note belongs to the retracted one. Nothing was corrected and nothing was retracted.

**Why it matters beyond the rows.** This is the F1 shape repeated inside the F1 fix round: the guard
that exists to stop "a second identical record" was put in `renderDailyValueLogger`'s `onClick`, a
single UI handler, instead of in the two writers where `supersedeStamp` now correctly lives. One
writer opted in; the other did not.

**Fix, two lines, in the place the release already chose for this class of rule:**

```js
async function logBowelMovement(value, dayStartTs) {
  const prev = bowelMovementFor(dayStartTs);
  if (prev && prev.value === value) return;        // re-confirming is not a correction
  …
}
```
and the same in `logAppetite`. The logger's `onClick` guard can stay — it is what produces the
"Already logged as …" toast, which the check-in does not need. Then add a check: answer the check-in
with the value already stored and assert the entry count is unchanged.

**Not blocking** because both rows carry the same value, so no clinical reading changes, and the
duplicate predates this release. I would still take it in this push.

### N2 — MEDIUM (gate). The radiation counter is covered by nothing, and the section that claims to cover it has no radiation entry.

`M-I` scores a clean **60/60** with both halves of the radiation fix deleted. Section 13 is titled
*"A DAY OF ONLY BOWEL / APPETITE / RADIATION IS NOT 'NOTHING LOGGED'"* and its fixture
(`test/v86-logging-and-labels.mjs`, the `nlPage` seed) holds one `bowel_movement` and one
`appetite` and nothing else. Its own evidence string says so: `summary="1 BM · 1 appetite"`.

This is the APAP shape the release describes twice in its own README cell — *"an absence check means
nothing unless the thing could have been there"* — and it is the third time on this release that a
fixture could not vary the thing under test. The shipped code is correct; a regression in the
radiation third of F2 would ship green.

**Fix:** one more entry in that seed —
`{ id: 'n3', medId: 'radiation_session', dose: 'Session', mg: 0, ts: d + 10 * 3600000 }` — and
`/1 radiation/` in the "counts them under their own names" assertion. Re-run `M-I` and show it red.

### N3 — MEDIUM. F7's try/catch cannot catch a failure of the first of its two writes, and in that case the app reports success over a split record.

`setPrefsDB` is `async` (`index.html:942`). An `async` function that throws does not throw to its
caller — it returns a rejected promise. `renameActiveProfile` calls it **unawaited inside the try**,
so a `localStorage` failure in the prefs write never reaches the `catch`. Measured, by replacing
`Storage.prototype.setItem` with a throwing stub keyed on the storage key:

| scenario | `list` on disk | `patientName` on disk | returns | toast |
|---|---|---|---|---|
| A — every write fails | `Alex` | `Alex` | `false` | *"Could not save that name — nothing was changed."* ✅ |
| B — prefs ok, list fails | `Alex` | `Alex` | `false` | same, and the rollback really ran ✅ |
| **C — prefs fails, list ok** | **`Split State`** | **`Alex`** | **`true`** | **"Renamed to Split State"** ❌ |

`thrownSync` was `null` in all three — nothing ever reached the catch from the prefs write.

Scenario C is exactly the state F7 was written to prevent: Settings shows the new name while the
greeting, the CSV filename and the printed report title keep the old one, permanently — now with a
success toast on top. The function's own new comment claims the opposite in so many words:
*"patientName goes first because it is the one a clinician reads; if the list write then fails, the
previous name is put back."* That ordering guarantee does not hold, because the first write's
failure is invisible here.

**It is not a regression** — before this commit, scenario C produced the identical split with no
toast at all — and it needs a quota that admits one blob and refuses the other, which is narrow.
That is why it is not blocking. **Fix:** make `renameActiveProfile` `async` and `await setPrefsDB`,
or call `saveJSON(PREFS_KEY, { ...getPrefsDB(), patientName: name })` directly inside the try and
notify the prefs listener afterwards. `M-K` shows nothing in the suite notices either way.

### N4 — LOW (gate). The appetite-note fix has no check.

`M-J` reverts `logAppetite`'s note inheritance to the old `String(note || '')` and scores **60/60**.
The behaviour itself is correct — I confirmed the Reports logger carries the note forward:

```
A. after correcting appetite from the Reports logger:
   [{"v":"normal","note":"ate half a sandwich"},{"v":"little","note":"ate half a sandwich"}]
```

Two notes on the record of it. The README says the fix is for *"a note the check-in had attached"* —
the check-in has never attached an appetite note; it passes `''` and therefore still clears one (see
N1). The only writer of an appetite note is `submitAppetite`, which is dead code. The sentence in
the record names the wrong path.

### N5 — LOW. The in-app History list still shows the same minute twice with nothing saying which stands.

F3 was fixed in `buildExportRows` only. On screen, a corrected day still lists
`12:00 PM Bowel Movement Normal` above `12:00 PM Bowel Movement Diarrhea` with no marker.

**This is not a copy defect** — I checked the claim before writing it down. The changelog bullet
says *"the exported file and the printed report mark it as corrected"* and claims nothing about
History, and the Reports screen states `currently Diarrhea` outright, so the caregiver has an
authoritative display. Worth closing for consistency, not worth a release.

### N6 — LOW. The export is roughly twice as slow, and the growth is quadratic.

`isSupersededEntry` scans the whole entry array per superseadable row. The early return on
`SUPERSEDABLE_MED_IDS` keeps it off every other row, which is what saves it. Best of three runs,
desktop Chromium, loopback:

| history | entries | with the scan | with it stubbed `false` | added |
|---|---|---|---|---|
| 1 year | 2,190 | 136 ms | 92 ms | +44 ms |
| 3 years | 6,570 | 580 ms | 262 ms | +318 ms |
| 6 years | 13,140 | 1,903 ms | 671 ms | +1,232 ms |

Synchronous, on the tap that exports. A mid-range phone is several times slower, so six years of
daily history is a multi-second freeze — but a treatment course is months, not years, and the whole
function was already superlinear. One `Map` of `medId|day → max ts`, built once before the `.map()`,
makes it linear if it ever matters.

### N7 — LOW, nit. `rads` is the only one of the six counters without `!e.missed`.

`index.html:11511`. `doses`, `temps`, `weights`, `bps`, `symptoms`, `paras`, `bms` and `appetites`
all filter missed pseudo-entries; `rads` does not. No reachable consequence today — nothing creates
a missed `radiation_session` — but it is the inconsistency, not the bug, that gets copied.

---

## RULE 0 AND THE VOICE

**Rule 0 — clean.** `v75-no-other-patient` **27/27**, ratchet found 0/0/0 against a pinned 0/0/0.
No patient name anywhere in the delta. **No gendered pronoun in any line the delta adds to
`index.html` or to the suite — including comments**; I grepped the added lines for
`she|her|hers|he|him|his|herself|himself` and got nothing. The only `His` in the delta is in the
README cell, referring to Aaron. No dose, ceiling or schedule. No behaviour keyed to a medication
id: `NON_DOSE_MED_IDS` keys on record types, and `nextMedicationId`'s new clause refuses this app's
own storage keys, not drug names — `Ondansetron → ondansetron` proves the v78 fence has not
returned.

**The Voice, on every caregiver-facing string the delta adds or changes.**

| string | true? | 2am? |
|---|---|---|
| *"Changing today's bowel or appetite answer keeps the earlier one in your records rather than deleting it, and the exported file and the printed report mark it as corrected — so a nurse reading two answers for the same day can tell which one stands."* | **Yes**, verified in both artifacts | Long, but every clause is plain and the "so…" earns its length |
| *"Picking the answer that is already showing does nothing instead of adding a second identical record."* | **Yes** on the Reports logger (the screen the bullet is about) | Yes |
| *"You can rename the profile you're in, from Settings."* | **Yes**, and it replaces *"the person you are currently in"*, which was the predecessor's copy nit | Better than what it replaced |
| *"Already logged as Normal for today."* | **Yes** | Yes — and it explains a tap that would otherwise look ignored |
| *"Could not save that name — nothing was changed."* | **Yes in scenarios A and B** (measured: both stores unchanged). Not reached in scenario C, where the toast is *"Renamed to …"* over a split record — N3 | Yes |
| export marker *"(corrected later — superseded)"* | **Yes** where it fires; **false in the N1 case**, where nothing was corrected | "superseded" is a clinician's word in a clinician's file — acceptable here |

Changelog bullet 3 — *"Each is now counted and named for what it actually is"* — which the
predecessor marked as overstated, **is now true**: BP, symptoms, paracentesis, bowel, appetite and
radiation all have named segments.

---

## REGRESSION AND MECHANICS

All against `0f73911` on loopback `:8899`.

| suite | result |
|---|---|
| `v86-logging-and-labels` | **60/60** |
| `v85-profile-reminders` | 43/43 |
| `v83-meds-and-reports` | 80/80 |
| `v75-no-other-patient` | 27/27 |
| `v80-up-next` | 49/49 |
| `v58-eod-checkin` | 10/10 |
| `v64-logger` | 23/23 |

**Pre-existing reds spot-checked, as asked.** I served `87d1784` separately on `:8898` from
`git show` (no checkout) and ran `v84-whatsnew` against both:

```
0f73911 : FAIL precondition: the field is below the fold … top=836 in a 844px viewport — 95/96
87d1784 : FAIL precondition: the field is below the fold … top=836 in a 844px viewport — 95/96
```

Byte-identical message on both builds. `v57-search` reproduces its single red on the current build
with the message the README now quotes. `v71-report-controls` I did not re-run; the predecessor
verified it side by side.

**Release mechanics.** `APP_VERSION = 'app-v86'`, `sw.js` CACHE `chemowell-app-v86-1` — moving
together, unchanged by this delta. `release_check.sh` currently refuses with *"a chain report
refuses this release"* and *"missing: an outputs/PM\*app-v86\*.md sign-off"*. This report answers the
first: it is a later commit in the same history, over the byte and line floors, and its verdict is
SHIP, which is the gate's own definition of superseding a refusal. The PM sign-off remains.

**The suite's `freshPage` conversion — no coverage lost.** Every section that used to share the one
context now seeds its own, and I read all seven seeds: each sets profiles, prefs, entries and
(where it matters) med config explicitly rather than inheriting. The `pageerror` listener is bound
per context in both the shared `ctx` and inside `freshPage`, so section 18's "nothing threw" covers
every page the file opens. Section 19's README-figure ratchet is last in the file, so its offset is
exactly itself. The one thing it cannot see is a throw after section 18 on a page left open — the
contexts are never closed and keep ticking. Cosmetic.

---

## TO SHIP

Nothing is required. Two items I would take in the same push, both small:

1. **N1** — move the no-op guard into `logBowelMovement` / `logAppetite`, beside `supersedeStamp`,
   so the check-in obeys it too. Add a check: answer the check-in with the value already stored,
   assert the entry count is unchanged and no row is marked corrected.
2. **N2** — one radiation entry in section 13's fixture and `/1 radiation/` in its assertion. Re-run
   mutant `M-I` and show it red, so the section's title is true.

**Follow-ups I am not blocking on:** N3 (`await setPrefsDB`, or write prefs synchronously, and a
check that the quota path leaves both stores agreeing) · N4 (a check for the appetite note) ·
N5 (mark the superseded row on the in-app History list too) · N6 (one `Map` in `buildExportRows`
if a long history ever bites) · N7 (`!e.missed` on `rads`) · `REQUESTS.md` still ends at
2026-09-15, which is the PM's step · the README's phrase *"a note the check-in had attached"* names
a path that does not exist.

**Deliberately exempt, stated rather than skipped.** Everything here was measured in Chromium at
390px on loopback. There is no iPhone and no Safari in this sandbox; nothing has been on a real
phone. No Firebase and no network path was touched, and no `caretracker_*` name was read or written.
`v71-report-controls` still aborts at `para-add` on both builds, so every check after that point in
that file is unexercised on this release as it was on the last. The three pre-existing reds are
recorded, not fixed. The performance figures are desktop Chromium and a phone will be slower.

---

## HOUSEKEEPING

Eleven mutants, each applied in place with Python, suite run, file restored from a byte copy taken
before the first mutation, and `index.html`, `sw.js`, `test/v86-logging-and-labels.mjs`,
`test/v80-up-next.mjs`, `README.md` and `BACKLOG.md` all `md5sum`-verified identical after every
one. Final state: all six match their pre-audit hashes; `git status --porcelain` shows only this
file. No `git add`, `checkout`, `reset` or `stash`. No commit, no push. Both servers I started
(`:8899` on the working tree, `:8898` on an `app-v85` export) are stopped. Probe scripts are in the
session scratchpad at
`/tmp/claude-0/-home-user/41e5d279-40d0-5a8a-b4e0-827057dd9522/scratchpad/` (`p_quota.mjs`,
`p_edge.mjs`, `p_perf.mjs`, `p_ui.mjs`, `p_ci.mjs`, `p_note.mjs`, `mutate.py`, `restore.sh`) and are
not in the repo.
