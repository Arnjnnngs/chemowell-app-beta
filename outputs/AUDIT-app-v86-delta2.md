AUDITED-COMMIT: 5ae0f67
VERDICT: DO NOT SHIP

# Zero Day Audit — ChemoWell app-v86, SECOND DELTA pass (`5ae0f67`, branch `claude/caretracker-team-review-i83ik2`)

**The fix for N3 regressed the arm of `renameActiveProfile` that already worked, and the check
written to prove N3 fixed is blind to it.** Awaiting `setPrefsDB` closed the prefs-write arm and
opened the list-write arm: the catch now retries the write that just threw *before* rolling back
prefs, so the rollback is unreachable in exactly the case it exists for. Measured side by side
against `0f73911` with a throwing `Storage.setItem`. The phone is left with `patientName` — the name
on the printed report and the CSV filename — holding the **new** value while Settings holds the old,
under a toast reading *"Could not save that name — nothing was changed."* That sentence was true at
`0f73911`. This commit made it false.

**Three mutants score a clean 69/69**, two of them against code this delta added to close the
predecessor's vacuous-check findings. Deleting `renameActiveProfile`'s whole rollback arm is green —
that is the survivor the delta claims to have killed, and section 16b only ever exercises the arm in
which the rollback is dead code. Dropping `!rads` from `nothingElseLogged` is green, so the radiation
third of F2 can come back with the suite passing; the N2 fixture covered the counter and not the
clause. And the appetite guard can be made to ignore the note entirely.

**The record overstates two fixes.** N1 is fixed only when the existing appetite answer carries no
note. Give it one — the exact fixture the predecessor's N1 repro used — and pressing Save on an
unchanged check-in sheet still writes a duplicate, still prints *"(corrected later — superseded)"*
over an identical value in the doctor's file, and strips the caregiver's note from the answer that
stands. The new section 12b passes because its fixture has no note.

Everything else in the delta is real and holds up. `69/69`. Both writer guards are genuinely
covered — I deleted each and the suite went red. The appetite-note mutant is dead. The uncaught
`Error: quota` that `0f73911` threw out of the rename click handler is gone. Seven regression suites
are unchanged and the three pre-existing reds reproduce with byte-identical messages. **Nothing here
loses a record on an ordinary path and nothing is urgent.** I am refusing on four items that total
about a dozen lines, because the one thing that keeps going wrong on this release is a guard written
where the check cannot see it, and this commit ships the third and fourth instance of that while the
README says both are closed.

---

## THE SIX DELTA CLAIMS, EACH VERIFIED

### 1. N1 — the guard moved into the writers. FIXED for bowel; FIXED for appetite ONLY when no note exists.

**The move itself is real and both writers are covered.** I deleted each guard in turn:

```
delete logBowelMovement's guard
  FAIL  re-confirming the answer already recorded writes no second record | 1 -> 2
  FAIL  so the export does not mark an identical answer as corrected      | ["Diarrhea (corrected later — superseded)"]
  69 checks: 67 passed, 2 failed      KILLED

delete logAppetite's guard
  FAIL  and the appetite answer is not duplicated either                  | 1 -> 2
  FAIL  so the export does not mark an identical answer as corrected      | ["Little to none (corrected later — superseded)"]
  69 checks: 67 passed, 2 failed      KILLED
```

Moving the appetite check onto the check-in path was the right call and it works — removing the
appetite guard used to be shielded by the logger's own UI handler, and it is not any more.

**But see D2 below: the predecessor's own N1 repro still reproduces.**

### 2. N2 — radiation. The COUNTER is covered. The `nothingElseLogged` CLAUSE is not. See D3.

```
rads counter -> 0                      FAIL it counts them under their own names | summary="1 BM · 1 appetite"
                                       69 checks: 68 passed, 1 failed     KILLED  (was a survivor)
drop !rads from nothingElseLogged      69 checks: 69 passed, 0 failed     SURVIVES
```

Section 13's fixture now carries the radiation entry, which is what kills the counter mutant. It
also carries a bowel and an appetite entry, so `nothingElseLogged` is false no matter what `rads`
does — the clause cannot vary in this fixture, which is the same shape the fixture was fixed for.

### 3. N3 — `setPrefsDB` awaited. One arm fixed, the other arm broken. **This is the blocker. See D1.**

### 4. N7 — `rads` now carries `!e.missed`. Correct and consistent; no reachable behaviour change
(nothing creates a missed `radiation_session`), so no check can cover it and none should be written.

### 5. The three survivors.

| predecessor's survivor | this pass |
|---|---|
| M-I radiation counter | **killed** (68/69) — but only its counter half; see D3 |
| M-J appetite note preservation reverted | **killed** (68/69) — `FAIL and the note from the answer it replaced came with it \| note=""` |
| M-K rename rollback arm deleted | **STILL SURVIVES, 69/69** — see D4 |

### 6. N5 and N6 in `BACKLOG.md`. Both present, both accurately described, both correctly scoped.
`BACKLOG.md` is the right home and the entries say what was measured rather than what was feared.

---

## NEW FINDINGS

### D1 — BLOCKER. The rename rollback is now unreachable in the arm it was written for, and the failure toast is false.

**Severity: MEDIUM-HIGH — a REGRESSION introduced by this delta, in the guard this delta exists to
fix, with a caregiver-facing sentence that this delta turned from true into false.**

**Location.** `index.html:701` — the catch arm of `renameActiveProfile`.

```js
} catch (e) {
  try { me.name = previous; saveJSON(PROFILES_KEY, ps); await setPrefsDB({ patientName: previous }); } catch (e2) {}
  setToast('Could not save that name — nothing was changed.');
  return false;
}
```

The delta reversed the rollback's order so the list write comes first. In the scenario where the
**list** write is the one that failed, `saveJSON(PROFILES_KEY, ps)` throws again on the first line of
the rollback, the empty `catch (e2)` swallows it, and `await setPrefsDB({ patientName: previous })`
**never runs**. At `0f73911` the prefs rollback came first and therefore always ran.

**Measured, same probe, fresh page, both builds served on loopback** (`0f73911` from `git show`, no
checkout). `Storage.prototype.setItem` throws on the profiles key only:

| build | `profiles.list` | `prefs.patientName` | returns | toast |
|---|---|---|---|---|
| `0f73911` | `Alex` | `Alex` | `false` | *"Could not save that name — nothing was changed."* — **true** |
| **`5ae0f67`** | `Alex` | **`List Fail Name`** | `false` | same sentence — **false** |

On `5ae0f67` the greeting on screen renders the new name while Settings renders the old, and the
caregiver has been told nothing changed. `patientName` is the one a clinician reads: it is the
printed report's title and the CSV filename.

The commit's own new comment, four lines above, asserts the opposite in so many words —
*"patientName goes first because it is the one a clinician reads; if the list write then fails, the
previous name is put back and the caregiver is told."* The same comment then says **"A comment
asserting an ordering guarantee that the code did not provide is worse than no guard."** That
sentence is now true of the comment it is written in.

**Net against `0f73911`: not more frequent, but the drift moved to the clinician-facing store and the
toast became a lie.** Before, the split was Settings-new / report-old under a false *success* toast.
Now it is Settings-old / report-new under a false *failure* toast, which is the one a caregiver has
no reason to go and check.

**Repro:** `/tmp/claude-0/-home-user/41e5d279-40d0-5a8a-b4e0-827057dd9522/scratchpad/p_rename.mjs`
(both arms) and `p_renameB.mjs` (the regressed arm alone, fresh page, run against each build).

**Fix — three lines, verified.** One `try` per write so neither blocks the other:

```js
} catch (e) {
  me.name = previous;
  try { await setPrefsDB({ patientName: previous }); } catch (e2) {}
  try { saveJSON(PROFILES_KEY, ps); } catch (e2) {}
  setToast('Could not save that name — nothing was changed.');
  return false;
}
```

Applied in place and re-probed: **both** arms now end `list=Alex patientName=Alex`, returning
`false`, with the toast true in each. Restored afterwards; `md5sum -c` clean.

**And a check that would have caught it** — see D4. Section 16b forces the prefs write to fail and
nothing else.

### D2 — MEDIUM. N1's own repro still reproduces: an appetite answer that carries a note.

**Not a regression** — identical at `0f73911`, where the predecessor filed it as N1 and shipped. **It
is in scope because this delta's commit message, its README row and its new section 12b all say it
is closed.**

`confirmCheckinModal` passes `''` as the note (`index.html:3639`). The new guard treats `''` as a
deliberate note change, so it refuses to fire whenever the recorded answer has a note:

```js
const incoming = note === undefined || note === null ? (prev && prev.note) || '' : String(note);
if (prev && prev.value === value && ((prev.note || '').trim() === trimmedNote)) return false;
```

**Reproduced through the shipped check-in sheet.** Fixture is section 12b's, with one word added —
the appetite entry carries `note: 'ate half a sandwich'`. The sheet pre-fills with today's answers
(`["Little to none","Diarrhea"]`); I pressed **Save** and changed nothing:

```
BEFORE  bowel_movement diarrhea (no note)
        appetite       little   note="ate half a sandwich"
AFTER   bowel_movement diarrhea (no note)          <- correctly refused
        appetite       little   note="ate half a sandwich"
        appetite       little   note=null          <- duplicate written

EXPORT  12:00 PM | Bowel Movement | Diarrhea
        12:00 PM | Appetite | Little to none (corrected later — superseded) | ate half a sandwich
        12:00 PM | Appetite | Little to none                                |
```

A nurse reads that the appetite answer was corrected from *Little to none* to *Little to none*, and
that the patient's note belongs to the retracted one. The note is gone from every screen — the
Reports history keeps one entry per day and that entry is now the one without it.

**The truth table, walked in full:**

| call | prev | result |
|---|---|---|
| same value, note omitted (Reports logger) | any | inherits `prev.note`, guard fires, **no-op** ✅ |
| same value, `''` (check-in) | **no note** | guard fires, **no-op** ✅ |
| same value, `''` (check-in) | **has a note** | **writes a duplicate and drops the note** ❌ |
| same value, a new note (`submitAppetite`, dead) | any | writes — a real correction ✅ |
| different value, note omitted | has a note | writes, note carried forward ✅ (section 13b) |
| different value, `''` (check-in) | has a note | writes, note dropped — defensible, the note described the old answer |

**No real correction is refused.** The failure is one-directional: an unintended write plus a note
loss.

**Reachability is narrow and should be stated as such.** The only live writer of an appetite note is
`submitAppetite`, which is dead code, so a note can only be present from restored or synced legacy
data — the predecessor's F10 said the same. That is why this is not the blocker.

**Fix — one word.** `index.html:3639`: `await logAppetite(m.appetite, todayStart)`. The check-in sheet
has no appetite note field, so it should not express an opinion about the note; omitting the
argument makes it inherit, the guard fires, and the behaviour matches the Reports logger.
Then re-run section 12b with a note in its appetite fixture.

**Repro:** `/tmp/claude-0/-home-user/41e5d279-40d0-5a8a-b4e0-827057dd9522/scratchpad/p_note.mjs`.

### D3 — MEDIUM (gate). The radiation half of `nothingElseLogged` is still covered by nothing.

```
M-I2  const nothingElseLogged = ... && !bms && !appetites && !rads && !mgTotals.length;
   -> const nothingElseLogged = ... && !bms && !appetites && !mgTotals.length;
      69 checks: 69 passed, 0 failed      SURVIVES
```

With that clause gone, a day whose only record is a radiation session renders
**`Nothing logged · 1 radiation`** — F2's original defect, self-contradicting in a single line, with
the suite green. Section 13's fixture holds a bowel entry and an appetite entry alongside the new
radiation one, so `nothingElseLogged` is false whatever `rads` is; the N2 fix made the **counter**
non-vacuous and left the **clause** exactly as it was.

**Fix:** a second fixture holding one `radiation_session` and nothing else, asserting the summary is
`1 radiation` and contains no "Nothing logged". Re-run M-I2 and show it red.

### D4 — MEDIUM (gate). The rename rollback arm can be deleted entirely, 69/69. It is the survivor the delta claims to have killed.

```
M-K  try { me.name = previous; saveJSON(PROFILES_KEY, ps); await setPrefsDB({ patientName: previous }); } catch (e2) {}
  -> try { } catch (e2) {}
     69 checks: 69 passed, 0 failed      SURVIVES  (unchanged from the previous pass)
```

Section 16b throws only on keys matching `/-prefs-v1$/`. In that arm `setPrefsDB` throws **before**
`me.name = name` and before the list write, so nothing was ever changed and the rollback is a no-op
by construction. The check asserts a state the code reaches whether the rollback exists or not.

**This is why D1 shipped.** The one arm the new check exercises is the one that works.

**Fix:** a second case in 16b that throws on `chemowell-app-profiles-v1` instead, asserting both
stores still read the old name. It goes red on `5ae0f67` today — that is D1 — and green on the
three-line fix above. Then re-run M-K and show it red.

### D5 — LOW (gate). The appetite guard can be made to ignore the note, 69/69.

```
M-N  if (prev && prev.value === value && ((prev.note || '').trim() === trimmedNote)) return false;
  -> if (prev && prev.value === value) return false;
     69 checks: 69 passed, 0 failed      SURVIVES
```

The note comparison is the only thing distinguishing the appetite guard from the bowel one, and the
comment above it states a rule — *"the same value with a NEW note is a real correction and must be
written"* — that nothing verifies. No live consequence today, because the only caller that passes a
real note is dead code. Worth one check if D2 is fixed, since the fix makes the omitted-note path the
only live one.

### D6 — MEDIUM, CARRIED FORWARD, not introduced here. The live banner's Update still deletes the answer the changelog says it keeps.

The first audit's TO SHIP item 1 asked for the remove-then-rewrite to be dropped from the three
`submit*` paths. It was not, the second pass did not mention it, and `BACKLOG.md` names only
`submitBowelMovement` and `submitAppetite` as dead code — **`submitBowelBannerUpdate` is live**
(`index.html:3789`, the Update control on the pinned *"Bowel issue active"* banner,
`index.html:5968`). Reproduced on `5ae0f67`:

```
before  [b1:diarrhea]
(banner "Bowel issue active" visible; pick Normal; press Update)
after   [emvn912rv6zbo6w:normal]          <- b1 is GONE
export  12:00 PM | Bowel Movement | Normal         (one row; no "corrected later")
```

The changelog says *"Changing today's bowel or appetite answer keeps the earlier one in your records
rather than deleting it, and the exported file and the printed report mark it as corrected."* On this
path the earlier answer is destroyed and there is nothing to mark. It is also the path the app pushes
hardest: the banner is pinned on Home for the whole time a bowel issue is active.

I am not blocking on it — it predates `0f73911` and is unchanged by this delta — but the delta's own
`BACKLOG.md` entry should name it, because as written a future reader will believe all three
delete-then-relog paths are dead. **Repro:**
`/tmp/claude-0/-home-user/41e5d279-40d0-5a8a-b4e0-827057dd9522/scratchpad/p_banner.mjs`.

### D7 — LOW, nit. Section 12b's Save lookup is `if (save) save.click();`.

If the button is ever renamed, nothing is clicked, the entry counts are trivially unchanged and all
three assertions pass. **It is not vacuous today** — both guard-deletion mutants above drove it red,
which proves the click lands. One `t('precondition: the sheet has a Save button', !!save)` closes the
hole permanently.

---

## WHAT I PUSHED ON AND FOUND SOUND

**Return values of the writers.** `logBowelMovement` / `logAppetite` now return `false` on refusal.
Every caller handles it correctly or correctly ignores it:

| caller | ignores the return? | consequence |
|---|---|---|
| `confirmCheckinModal` (3639/3640) | yes | **correct** — the metric IS answered, just unchanged, so `markCheckinCompletedToday()` must still run, the sheet must still close and *"Check-in saved"* is still true. `checkinSaveBusy` clears in a `finally`; no stuck flag, no modal left open |
| `renderDailyValueLogger.onClick` (11705) | yes | cannot reach a refusal — its own guard returns first on the same comparison, so the *"logged"* toast can never fire over a refused write. `dailyLogBusy` clears in a `finally` |
| `submitBowelMovement` (3776, dead) · `submitBowelBannerUpdate` (3794, live) · `submitAppetite` (3837, dead) | yes | cannot reach a refusal — each deletes the existing entry first, so `prev` is `null` by the time the writer runs |

No toast left lying, no modal left open, no busy flag stuck, no path where
`markCheckinCompletedToday` is skipped when it should run.

**Could the handler's guard and the writer's guard disagree and produce a false "logged" toast?** No.
The handler compares the render-time `opts.current`; the writer re-reads. `addEntryDB` →
`notifyEntries` → `render()` runs *inside* the writer's await, so the closure is replaced before
`dailyLogBusy` clears, and the two can only diverge across a midnight boundary, which is pre-existing.

**`renameActiveProfile` is now `async`. Every call site checked.**

- `index.html:10188`, the Settings **Save name** button: `onClick: () => renameActiveProfile(...)`,
  not awaited, return value ignored — correct, and it cannot produce an unhandled rejection because
  every throw inside is caught (confirmed: `0f73911` threw `Error: quota` out of this handler on the
  prefs-failure arm and `5ae0f67` throws nothing. **That part of the N3 fix is real and is an
  improvement.**)
- `index.html:13220`, the test hook, returns the promise. Section 16b awaits it. Sections 10 and 11
  do not, and do not need to: `setPrefsDB`'s body is synchronous, so the whole function completes
  within one microtask checkpoint, and the blank-name case returns before the first `await`.
- **No stale name is painted between the two writes.** `prefsListener(next)` fires a synchronous
  render inside `setPrefsDB`, at which point the list on disk still holds the old name — but the
  continuation (`me.name`, `saveJSON`, `setState`) is a microtask, which drains before paint. The
  same intermediate render existed at `0f73911`; the `await` did not add one.
- **Two renames cannot race.** Each click is its own macrotask and the whole function, awaits
  included, completes before the next one starts. A second identical rename is refused by
  `if (me.name === name)`.

**The suite.** `test/v86-logging-and-labels.mjs` → **69 checks: 69 passed, 0 failed** against
`5ae0f67`, the figure the README claims. Section 19's self-referential ratchet agrees
(`README says 69/69, this run counts 69`). Nine checks added, none weakened, and section 12b's
comment honestly records that an earlier version of it pressed nothing.

**Regression, all against `5ae0f67` on loopback `:8899`, clean tree, hashes verified before the run:**

| suite | result |
|---|---|
| `v86-logging-and-labels` | **69/69** |
| `v85-profile-reminders` | 43/43 |
| `v83-meds-and-reports` | 80/80 |
| `v75-no-other-patient` | 27/27 (ratchet found 0/0/0 against a pinned 0/0/0) |
| `v80-up-next` | 49/49 |
| `v58-eod-checkin` | 10/10 |
| `v64-logger` | 23/23 |
| `v59-para` | 15/15 |
| `v84-whatsnew` | 95/96 — pre-existing red, message byte-identical to both earlier builds |

**Rule 0 — clean.** No patient name anywhere in the delta. **No gendered pronoun in a single line the
delta adds to `index.html` or to the suite, comments included** — I grepped the added lines for
`she|her|hers|herself|he|him|his|himself` and got nothing. The only `His` in the delta is README prose
about Aaron, inside a full-row replacement of text that already existed. No dose, ceiling or
schedule. No behaviour keyed to a medication id: the delta touches `renameActiveProfile`, two daily
writers, one `!e.missed` filter and three comments.

**The Voice.** The delta changes **no** caregiver-facing string in `index.html` — the diff is guards,
a filter and comments. The one Voice finding is behavioural and is D1: *"Could not save that name —
nothing was changed."* was true at `0f73911` in both failure arms and is false in one of them now.
*"Check-in saved"* over a fully refused check-in is **true** and should stay — the answers are saved,
they just did not change. *"Already logged as X for today."* is unchanged and still accurate.

**Release mechanics.** `APP_VERSION = 'app-v86'` and `sw.js` CACHE `chemowell-app-v86-1`, unchanged
by this delta and still moving together. `release_check.sh` refuses, and correctly: no
`outputs/PM*app-v86*.md` exists, so it stops at the missing-sign-off branch and never reaches the
supersede logic. For the record, `5ae0f67` is a descendant of both `5d54e2e` and `0f73911`
(`git merge-base --is-ancestor`, both true), so a later SHIP report would satisfy the supersede rule
at lines 647-677 once a PM sign-off exists. **This report is not that report.**

---

## MUTANT BOARD

Every mutant applied in place with Python against a byte copy taken before the first mutation, suite
run, file restored, and all six tracked files `md5sum`-compared after each one. All six identical at
the end.

| # | Mutation | Suite | Verdict |
|---|---|---|---|
| M-I | `rads` counter → `0` | 68/69 | **KILLED** (was a survivor) |
| M-J | appetite note inheritance → `String(note \|\| '')` | 68/69 | **KILLED** (was a survivor) |
| M-BG | delete `logBowelMovement`'s no-op guard | 67/69 | **KILLED** |
| M-AG | delete `logAppetite`'s no-op guard | 67/69 | **KILLED** |
| **M-K** | **delete `renameActiveProfile`'s whole rollback arm** | **69/69** | **SURVIVES — D4** (claimed killed) |
| **M-I2** | **drop `!rads` from `nothingElseLogged`** | **69/69** | **SURVIVES — D3** |
| **M-N** | **appetite guard ignores the note** | **69/69** | **SURVIVES — D5** |
| FIX | candidate three-line catch arm (D1), applied to confirm the fix | both arms clean | control |

---

## TO SHIP

1. **D1.** One `try` per write in `renameActiveProfile`'s catch, prefs rolled back first. Three lines,
   already measured clean on both arms.
2. **D4.** A second case in section 16b that makes the **list** write throw and asserts both stores
   still read the old name. Re-run M-K and show it red. This is the check that would have stopped D1.
3. **D2.** Drop the `''` at `index.html:3639` so the check-in inherits the note instead of clearing
   it, and put a note in section 12b's appetite fixture so the check covers the repro it is named
   after.
4. **D3.** A radiation-only fixture asserting `1 radiation` and no "Nothing logged". Re-run M-I2 and
   show it red.

Each is a handful of lines and one re-run. **Re-audit is a delta pass over those four.**

**Follow-ups I am NOT blocking on:** D5 (a check for the appetite guard's note comparison) · D6
(`submitBowelBannerUpdate` is live and deletes — name it in `BACKLOG.md` beside the two dead paths,
or convert all three) · D7 (one precondition line in 12b) · N5 and N6, correctly filed in
`BACKLOG.md` this commit · `REQUESTS.md` still ends 2026-09-15, which is the PM's step ·
the README's *"a note the check-in had attached"* still names a path that does not exist.

**Deliberately exempt, stated rather than skipped.** Everything here was measured in headless
Chromium at 390×844 on loopback. There is no iPhone and no Safari in this sandbox and nothing has
been on a real phone. No Firebase, no network path, and no `caretracker_*` name was read or written.
The three pre-existing reds are recorded, not fixed; `v71-report-controls` still aborts at `para-add`
and I did not re-run it, so every check after that point in that file remains unexercised on this
release as on the last two. I did not re-measure the export performance figures in N6 — I took the
predecessor's and they are now in `BACKLOG.md` as measurements, which is the right place.
The `!e.missed` filter added to `rads` has no reachable behaviour today, so it is deliberately
uncovered rather than accidentally so.

---

## HOUSEKEEPING

Seven mutants plus one candidate fix, each applied in place with Python, suite run, file restored
from a byte copy taken before the first mutation, and `index.html`, `sw.js`, `README.md`,
`BACKLOG.md`, `test/v86-logging-and-labels.mjs` and `test/v80-up-next.mjs` all `md5sum`-verified
after every one. Final state: all six match their pre-audit hashes and `git status --porcelain`
shows only this file. No `git add`, `checkout`, `reset` or `stash`. No commit, no push. Both servers
I started are stopped — `:8899` on the working tree and `:8898` on a `git show` export of `0f73911`
written outside the repo. Probe scripts live in the session scratchpad at
`/tmp/claude-0/-home-user/41e5d279-40d0-5a8a-b4e0-827057dd9522/scratchpad/`
(`p_rename.mjs`, `p_renameB.mjs`, `p_note.mjs`, `p_banner.mjs`, `mut.py`, `restore.sh`) and are not
in the repo.
