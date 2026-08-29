# Zero Day Audit — app-v68 (chemowell-app-beta), branch `claude/hotfix-treatment-date-clear`

**Verdict: the three fixes are correct. Ship them. Nothing I found is a reason to leave
app-v67's blocker live for another day.** Everything below is a condition on shipping, not a
reason to hold it — with one exception that is not in the app at all: `release_check.sh` can be
made to print a green tick with no audit and no PM sign-off, and I reproduced that twice.

Audited 2026-08-29 against `chemowell-app-beta@51ba75f` (app-v68), with
`care-tracker@03481a1` (branch `claude/caretracker-chemowell-updates-k80ydk`) as the comparison
build. Spec for the fix: `outputs/AUDIT_app-v67_beta-v60.md`.

---

## In plain words, for Aaron

**The Clear button works now. I tried nine different ways to break it and eight of them held.**
Set a date and clear it, clear before ever setting one, clear twice, set-clear-set-clear — all
correct. The one that broke needs a treatment-date record with a missing timestamp, which nothing
in the app can currently write, so it is a door to bolt rather than a fire to put out.

**Zofran's block is right now, but only for Zofran.** The same "count forward from treatment, not
to the nearest treatment" mistake is still live in the general, editable version of that rule —
the per-medication treatment window in the medication editor. If you give a medication an uneven
window (say, nothing before treatment and three days after), it can still switch itself off on a
day it should be on, and a medication set to be *avoided* near treatment can still be offered on
a day it should be hidden. Not new, not caused by this fix, and the release note says the
directional problem is settled when it is settled for one drug out of two.

**One wrong date is still printed on screen.** The "1 January 1970" you were shown last time is
gone from the normal path, but the Zofran card still reads its unlock date from the wrong place.
With two treatment dates on record and the older one entered last, I measured the card saying
**"Opens Thursday, Aug 6"** — three weeks in the past — while correctly refusing to unlock. The
lock is right; the date beside it is not.

**And the safeguard that was supposed to make the audit unskippable can be skipped.** If a release
does not touch `index.html`, `./release_check.sh` prints "✅ Release check passed" and exits 0
without ever asking for an audit or a PM sign-off. A change to the service worker alone, or to the
sync backend, clears it. That is the exact thing the check was written yesterday to prevent.

---

## BLOCKER — none.

I could not reach a wrong treatment-date answer through any path the shipped app can write.

---

## MAJOR-1 — the directional fix was applied to one caller; the editable version of the same rule is still wrong

`chemoOffsetSinceLast()` was added and wired into `zofranBlockedOn()`. Every other consumer of
`chemoOffsetFor()` was checked. `dexActiveOn()` is genuinely fine — a symmetric ±1 window and
"nearest date" are the same question, provably. **`treatmentActiveOn()` is not**, because its
window is per-medication and can be asymmetric.

* `chemowell-app-beta/index.html:1514-1520`
* `care-tracker/index.html:1281-1287` — identical

### Measured, both repos
Treatments 24 Aug and 27 Aug. One medication, window **0 days before / 3 days after**:

```
        nearest  sinceLast  treatmentActiveOn   should be
8/24       0         0          true              true
8/25       1         1          true              true
8/26      -1         2          FALSE             true     <-- wrong
8/27       0         0          true              true
8/28       1         1          true              true
```

26 Aug is two days after the 24th, inside a 0..+3 window. "Nearest" picks the 27th, returns −1,
and the window rejects it.

### Direction of harm — both ways, and one of them is the dangerous way
* `treatmentOnly` medication → `treatmentOnlyBlocks()` returns true → the card is hidden from Home
  and `missedDosesFor()` skips the day. A dose that was due is neither offered nor missed.
* `treatmentMode: 'excluded'` medication → `treatmentExcludedNow()` returns **false** → a
  medication the care team said to avoid near treatment is **offered as available** on a day it
  should be withheld.

### Why this is MAJOR and not a BLOCKER
It is not introduced by app-v68 and app-v68 does not widen it. It needs two treatment dates close
together *and* a non-default asymmetric window. But the release notes state the directional
question as closed — *"Dexamethasone's −1..+1 window is symmetric so nearest stays right for it"* —
naming only the symmetric caller and not the configurable one. **The note is more confident than
the code.** Fix `treatmentActiveOn` to ask both questions (`sinceLast` for the "after" half,
"until next" for the "before" half) rather than collapsing them into one distance, or say plainly
in the notes that only Zofran was fixed.

---

## MAJOR-2 — the Zofran card still prints a date from the wrong source, and it can be in the past

The previous audit's BLOCKER said *"every `dayStart(nextChemoTs())` display site needs a null
guard"*, and MINOR-9 said the same two sites disagree with the condition around them. **Neither
was touched by this hotfix**, and the MAJOR-2 fix widens the gap: the *condition* is now
`chemoOffsetSinceLast()`, the *printed date* is still `nextChemoTs()` (most recently **entered**).

* `chemowell-app-beta/index.html:1757` — `availableAt: dayStart(nextChemoTs()) + 3 * 86400000 + 8 * 3600000`
* `chemowell-app-beta/index.html:4419` — chemo-plan banner `cLabel`
* `care-tracker/index.html:1443` and `:2938` — identical

### Measured
Treatment dates 3 Aug and 24 Aug, with **3 Aug entered second** — precisely the "log a past
treatment after a future one" case app-v67's nearest-date change exists to handle, and the shape
Aaron's own record has:

```
Tue 8/25   sinceLast=1   zofranBlocked=true   card says "Opens Thu, 8/6"    <-- 3 weeks in the past
```

The lock is correct. The date beside it is read from a different treatment. On the banner the same
mismatch prints the wrong day in the "Treatment on <date>" (offset −2) copy.

This is the same defect family as the 1 Jan 1970 label the BLOCKER was written about, and the
release notes present that symptom as resolved. It is not, in the multiple-date case.

**Fix**: derive both display dates from the same list the condition uses —
`chemoDayList()` / `chemoOffsetSinceLast()` — not from `nextChemoTs()`.

---

## MAJOR-3 — `release_check.sh`: the class was not eliminated, and one hole is a silent SKIP, not a silent exit

The two documented silent-exit fixes (lines 280-288 and 316-330) are correct — I read them and
they hold. **The file still contains more of the same class, and the gate itself has a bigger
hole than any of them.** All four below are measured on a scratch copy, not read.

### 3a. The chain gate is skipped entirely when `index.html` is unchanged — **falsified twice**
`release_check.sh:315` runs the AUDIT/PM check only `if [ -n "${NEW_VERSION:-}" ]`, and
`NEW_VERSION` is assigned only inside `if [ -n "$INDEX_CHANGED" ]` at `:262`.

```
$ BASE_REF=HEAD ./release_check.sh          # index.html unchanged, no AUDIT/PM report exists
ℹ️  Baseline: BASE_REF override -> HEAD
✅ Release check passed.
exit=0

$ sed -i s/v68-1/v68-2/ sw.js               # change ONLY the service worker
$ BASE_REF=HEAD ./release_check.sh
✅ Release check passed.
exit=0
```

APP_CLAUDE.md rule 5 names `sw.js`, `.github/workflows/`, `sync-backend/`, `package.json` and
`capacitor.config.ts` as covered files. **A release touching any of those and not `index.html`
clears this gate with the quality chain never having run**, and prints a green tick while doing
it. This is the failure the gate was written on 2026-08-29 to make mechanically impossible.

Fix: read `NEW_VERSION` unconditionally, and run the chain gate on any tracked change to a
rule-5 file, not on `index.html` alone.

### 3b. `release_check.sh:183` — unguarded, dies at **exit 128 with zero output** — falsified
```bash
CACHE_OLD=$(git show "$BASE":sw.js 2>/dev/null | read_cache)
```
`set -euo pipefail` + a `git show` that fails ⇒ the pipeline is non-zero ⇒ the assignment fails ⇒
the script dies. Reproduced with a baseline commit that has no `sw.js`:
```
ℹ️  Baseline: BASE_REF override -> 1e7e27a
exit=128
```
Nothing else printed. Its own sibling on the very next line **is** guarded
(`CACHE_NEW=$(read_cache < sw.js 2>/dev/null || echo "none")`), and the `CACHE_OLD = "none"`
branch at `:209-214`, written to handle exactly this, is unreachable because the assignment dies
first.

### 3c. `release_check.sh:265` — same shape — falsified
```bash
OLD_VERSION=$(git show "$BASE":index.html | grep -o "APP_VERSION = '[^']*'" | head -1 | sed ...)
```
With a baseline whose `index.html` carries no `APP_VERSION` line, the script dies here. The
README-row check *and* the chain gate never run. Confirmed by the missing chain-gate output on an
otherwise identical working tree. Exit 1 masks it, so it looks like an ordinary failure.

### 3d. `release_check.sh:297` — unguarded inside the failure branch
```bash
sed -n "${ROW}p" README.md | grep -o "chemowell-app-v[0-9]*-[0-9]*" | sort -u | sed 's/^/     /'
```
A README row mentioning no cache key at all kills the script mid-message — before `FAIL=1` at
`:300` and before the "Fix the row" instruction at `:298-299`. Fails safe on exit code, truncates
the explanation.

**The pattern**: every guarded assignment in this file was guarded after someone was bitten by it.
The three above are the ones nobody has been bitten by yet. `grep -E '^\s*[A-Z_]+=\$\(' ` over
this file and guard each one, rather than fixing them one incident at a time.

---

## MINOR-4 — the tombstone walk is only as good as `loggedAt`, and there is no null guard behind it

`chemoDayList()` (`index.html:1456-1474`) orders by `loggedAt || ts || 0`. `nextChemoTs()`
(`:1448-1452`) reduces on `loggedAt || 0` only. **The two use different fallbacks, so a
`chemo_date` row with no `loggedAt` makes them disagree — and the disagreement is exactly the
contradictory state the BLOCKER was about.** Measured:

```
chemoDates = [ {ts: 24 Aug, loggedAt: undefined}, {ts: 0, loggedAt: 1000} ]   // a date, then Clear

chemoDayList()      => [24 Aug]      <-- the clear lost
nextChemoTs()       => null
hasTreatmentDate()  => false
dexActiveOn(25 Aug) => true
zofranBlockedOn     => true
availableAt         => dayStart(null) + 3d + 8h  =  4 Jan 1970      <-- the 1970 label, back
```

Also measured in the same function:
* a tombstone and a date sharing one `loggedAt` → **the clear loses**. `Array.sort` is stable, so
  ties keep `state.chemoDates` order, which `notifyEntries()` (`:766-769`) sorts by `ts` — putting
  the `ts: 0` tombstone first, where it wipes nothing.
* a Clear written by a device whose clock is behind the one that set the date → the clear loses.
  Not reachable in app-beta (single-device `localStorage`); **it is reachable in `care-tracker`,
  which is multi-device Firestore.**

**Not reachable through the shipped UI today** — both writers stamp `loggedAt`
(`index.html:1900` sets, `:4718` clears). The exposure is bulk-write paths that do not normalise:
`cwBkMergeById` on backup restore (`:509`), and any future sync/import merge.

**Cheapest real fix**: make `nextChemoTs()` derive from `chemoDayList()` so the two can never
disagree, and null-guard the two display sites in MAJOR-2. Adding `loggedAt` to the tombstone
comparator is not enough on its own.

### Attacks that HELD (measured, all correct)
tombstone as the very first entry · two tombstones in a row · set → clear → re-set → clear again ·
`ts: null` · no chemo dates at all · duplicate dates on one calendar day · a date set after a clear.

---

## MINOR-5 — the two per-medication treatment-window implementations diverge, and ChemoWell is the weaker one

The three shared hotfix functions are **byte-identical** between the repos once comments are
stripped: `chemoDayList`, `chemoOffsetSinceLast`, `chemoOffsetFor`, `dexActiveOn`, `nextChemoTs`,
`zofranBlockedOn`. No divergence there. The divergence is in the window plumbing around them, and
it runs the opposite way to the framing in my brief — care-tracker's port is the better one.

| | care-tracker | chemowell-app-beta |
|---|---|---|
| Upper bound on the window | **0-14**, `clampTreatmentDays` `index.html:212` | **none** — `n >= 0 ? n : 1`, `index.html:5341` |
| Editor input | `type:'number', min:'0', max:'14'` `:3687-3689` | `type:'text', inputMode:'numeric'`, no min/max `:5910-5914` |
| String coercion at normalise | `clampTreatmentDays(original.…)` `:247-248` | `Number.isFinite(original.…)` `:1109-1110` — **false for `"3"`** |
| `treatmentActiveOn` null guard | `med && med.treatmentDaysBefore` | `med.treatmentDaysBefore` |

care-tracker's own comment says why the bound exists: *"a mistyped 30 would make a medication
treatment-adjacent for two months either side."* On ChemoWell you can type 300 and it is accepted.
The string-coercion difference is not reachable through ChemoWell's own editor (it saves through
`clampTreatmentDays`), but any restore or import carrying strings silently collapses every
configured window back to 1/1 with no message — the exact bug care-tracker's comment records as
having *nearly* shipped.

---

## MINOR-6 — the new gate's falsification claim is stated wrong

README's app-v68 row: *"`test/v67-chemo-offset.mjs` **17/17** with 7 new checks, **5 of which go
red on app-v67**."* The suite **cannot run on app-v67 at all**:

```
$ node test/v67-chemo-offset.mjs --file <app-v67 index.html>
Error: function not found: chemoOffsetSinceLast
```

Zero assertions execute. This is the MINOR-11 class the previous audit named — *a gate that cannot
start is indistinguishable from a gate that passes* — reported here as *a gate that goes red*.

**The substance is true; I proved it the honest way.** Reverting each half separately inside the
app-v68 file:

| mutant | result |
|---|---|
| `chemoDayList()` back to app-v67's `ts > 0` filter | **13/17** — 4 red |
| `zofranBlockedOn` back to `chemoOffsetFor` | **16/17** — 1 red |
| both (true app-v67 semantics) | **12/17** — 5 red |

So "5 red" is the right number, arrived at by a method the note does not describe. Restate it as
*falsified against a mutant of this build*, and mention that this suite is version-coupled and
cannot be pointed at an older file.

---

## MINOR-7 — two render bugs fixed, zero render gates added

All seven new checks are data-layer. The previous audit already wrote this down:
*"Applying the fix to either line and re-running all three v67 suites leaves them green... that is
the coverage gap that let both lines through."* app-v68 closes the two bugs and leaves the gap
exactly as it was. `care-tracker` now has `harness/overflow-scan.mjs`; ChemoWell has nothing.

---

## MAJOR-3 (the app-v67 finding) — verified fixed, and the surrounding render logic holds

Read line by line, not assumed:

* `inpatientNow` is gone from the entire file except one explanatory comment (`:3413`). No dangling
  reference, no unused `const`.
* `const offDay = !medScheduledOn(med, now);` (`:3417`) now matches both web builds.
* `locked = !!st.locked || offDay` (`:3419`) — unchanged, and now fed a correct `offDay`.
* `overrideReasonLabel` (`:3435`) and `overrideExplain` (`:3436-3443`) both branch on `offDay`, so
  during a stay an unscheduled medication now shows **"Not scheduled"** and a **"Log anyway"**
  override instead of a dead orange **Log** button and a prompt reading *"Closed — opens later"*.
* "Take all" (`:3371`) is gated on `dueMeds.length >= 2` alone. `dueMeds` (`:3367`) already
  excludes unscheduled, paused and treatment-excluded medications, so **the count is unchanged** —
  the button simply appears during a stay, which is what the rewritten Help topic promises.

`offDay` is now correct in every branch of this function.

---

## Should ChemoWell have `overflow-scan.mjs`? Yes — and it is a port, not a flag

Measured both ways:

```
$ node harness/overflow-scan.mjs                                   # care-tracker
40 screen/width combinations, 0 overflowing element(s).   CLEAN     exit 0

$ node harness/overflow-scan.mjs --file <chemowell index.html>
page.evaluate: TypeError: Cannot read properties of undefined (reading 'pushEntry')
```

The scanner is real and it runs clean on care-tracker, but its seeding hooks are care-tracker's,
so ChemoWell needs its own port rather than a `--file` argument. **app-v68 is precisely the
release that would have wanted one**: it changes what renders on the grouped-meds card during a
hospital stay, at phone widths, and every gate in the release is data-layer.

**Could app-v68's changes have introduced layout problems?** Low risk, and I say that from reading
rather than from pixels — which is the honest limit here. Both changes restore states the card
already renders in the ordinary non-stay case: no new element, no new string, no new width, same
flex row. I did not render it.

---

## Standing traps — checked

* **`h()` null-attribute trap** — clean. The v68 diff introduces no boolean-valued attributes; the
  one `h('button', …)` it touches passes only `onClick` and `style`. The trap itself is still live
  in `h()` (a bare `el.setAttribute(k, v)`), so it remains a real hazard for future work.
* **Pinned version literals** — none in `test/v67-chemo-offset.mjs`. The only `app-v67` occurrence
  is inside a comment. The suite reads nothing from a version string.
* **`|| true`** — none anywhere in `test/`. (`release_check.sh` uses it deliberately in
  `read_cache`, where the "none" sentinel is now fatal, so it is not load-bearing there.)
* **`document.body.textContent`** — not used by anything this release adds.
* **Version pairing** — `APP_VERSION = 'app-v68'` ↔ `sw.js CACHE = 'chemowell-app-v68-1'`, README
  row present and naming the correct cache key. `release_check.sh` confirms all three before it
  reaches the chain gate.
* **Assertions that cannot fail** — the seven new checks all fail on a mutant (MINOR-6 table). The
  gate I *did* break is `release_check.sh` (MAJOR-3). Separately, two suite reds turned out to be
  pinned wording rather than defects (`v55-help`, above), and two more turned out to be
  environment contamination in the previous audit's run — so of the seven reds that release was
  reported against, **four were never real**.

---

## Known issues — characterised honestly, confirmed

* `test/audit-v55b.mjs` — **COULD NOT START**, `Cannot find module '/tmp/topics.js'`. Exactly as
  logged.
* `test/audit-v55.mjs` — still red on A3 (topic-count pin, 135 vs 133), A6 (`0 chips followed`)
  and B8. `BACKLOG.md:48` still leaves open whether A6/B8 are stale pins or a real Help regression.
  **Unresolved since app-v66, and unaffected by this release.**
* `test/v57-browser-notice.mjs` — confirmed red from the app-v58 layout regression, measured, not
  taken on trust: `R2D-1 the strip is under 200px` reports `stripH: 235`, and `firstTop: 630`
  against `navTop: 651` — the 21px-visible first answer `BACKLOG.md` records. Honestly
  characterised.
* **`test/v55-help.mjs` is NOT failing on what the previous audit said it was failing on.** That
  audit attributed its red to *"`v55-help`'s unfalsifiable `careLead`/`medical` check"* per
  `BACKLOG.md:119`. Measured — the actual failures are two different checks that are logged
  nowhere:

  ```
  v55-help   FAIL (exit 1)
    FAIL  [360px] V55-3 could reach "medications say .Restricted"  | search "restricted log them" found no row
    FAIL  [390px] V55-3 could reach "medications say .Restricted"  | search "restricted log them" found no row
  ```

  **This one mattered enough to chase, because it is the same Help topic app-v68's MAJOR-3 fix
  leans on** (`ip-meds-restricted`, the one that promises *"nothing is locked"*). A reachability
  check going red on it could have meant a caregiver can no longer find the hospital-stay topic —
  the Help search has a relevance floor (`HELP_SEARCH_FLOOR = 0.22`, `index.html:6845`) that can
  cut a topic out of results entirely, so this was not obviously a wording pin.

  **It is a wording pin, and the topic is findable.** The repo's own search gate proves it:
  `test/v57-search.mjs` asserts `'his meds say restricted' -> 'ip-meds-restricted'` (`:207`) and
  *"every topic is still found first by its own question text"* across all 134 docs (`:383-391`).
  Both **PASS**, ALL GREEN. app-v67 rewrote that topic's copy; the v55-help check pins the old
  phrase `"restricted log them"`, which no longer exists. Same class as V57-1 — a check pinning a
  sentence a later release deliberately reworded — which sat red for eight releases.
  **Action: it belongs in `BACKLOG.md` as its own entry, and `BACKLOG.md:119`'s entry should stop
  being read as the explanation for this suite's red.**
* **Half of the previous audit's MAJOR-10 is now resolved.** It could not attribute two of the
  seven reds because its browser work shared port 8899 with the runner. On my clean, uncontaminated
  run **`v52-fixes` PASSES (ALL GREEN) and `v55-fixes-shots` PASSES** — so those two were
  environment contamination, not defects, and the red list is five, not seven. `pm-v55` and
  `pm-v55b` are confirmed as the topic-count pins `BACKLOG.md:46` records (`135` actual vs a
  hardcoded `133`), not regressions.

---

## MAJOR-10 from the previous audit — CLOSED. One clean, uncontaminated full run.

The previous audit's top open item was that nobody had a trustworthy `./run-all-tests.sh` number
in either direction. I have one, on an idle machine, with no browser work of my own sharing the
runner's port:

```
PASS 17   FAIL 5   COULD-NOT-START 1
  failing:      audit-v55 pm-v55 pm-v55b v55-help v57-browser-notice
  cannot start: audit-v55b
```

Against app-v67's `PASS 15  FAIL 7  COULD-NOT-START 1`. **The red list is five, not seven** —
`v52-fixes` and `v55-fixes-shots` both pass clean, confirming they were environment contamination
in that run rather than defects.

**Every one of the five reds is now attributed, and none is caused by app-v68:**

| suite | cause | logged? |
|---|---|---|
| `audit-v55` | A3 topic-count pin (135 actual vs 133 hardcoded); A6/B8 still open | `BACKLOG.md:46`, `:48` |
| `pm-v55` | topic-count pin — `P3c every row opened \| 135 rows` | `BACKLOG.md:46` |
| `pm-v55b` | topic-count pin — `B8 all 133 rows opened \| 135` | `BACKLOG.md:46` |
| `v55-help` | **stale wording pin on copy app-v67 rewrote** — proven above | **nowhere** |
| `v57-browser-notice` | app-v58 layout regression, `stripH: 235` measured | `BACKLOG.md` (app-v66) |
| `audit-v55b` | cannot start, `Cannot find module '/tmp/topics.js'` | yes |

And the release's own gates are green on a clean run: `v67-chemo-offset` **17/17**,
`v67-inpatient-window` **10/10**, `v67-medflag-backfill` **4/4**, `v57-search` **ALL GREEN**,
`v63-encrypted-backup` 22/22, `v64-logger` 23/23, `v61-backup` 22/22, `v59-para` 15/15.

`BACKLOG.md:48`'s open question — whether `audit-v55`'s A6/A8 are stale pins or a real Help
regression — is **still open**; A6 (`0 chips followed`) and B8 are not count pins and I did not
chase them. That is the one thing MAJOR-10 asked for that I have not delivered.

---

## Scope: what I did NOT reach

* **`chemowell-beta`** — no v68 branch exists in this sandbox, so the third build was not audited
  and **Firestore isolation was not re-verified at runtime this round.** The BLOCKER and MAJOR-2
  are present in beta-v60 and need the same hotfix; that port is unaudited.
* ~~One clean full `./run-all-tests.sh` pass~~ — **reached after all; see below. MAJOR-10 is
  closed.**
* **Any rendered screen.** Every finding here is from source reading plus VM-harness measurement.
  No browser was driven against app-v68. MAJOR-2's "Opens Thu, Aug 6" is measured from the same
  expression the card renders, not read off a screen.
* **care-tracker's own release readiness** — I compared the shared functions and the window
  plumbing only. Its `harness/treatment-window-test.mjs`, `run-all-tests.sh` and `pm.py` changes
  were not audited.
* The `cwBkMergeById` restore path (MINOR-4's exposure) was read, not exercised.

---

## Recommended order

1. **Ship app-v68.** app-v67 is live and carries the blocker. Holding this costs more than the
   findings above.
2. **`release_check.sh` MAJOR-3a, before the next release** — the chain gate must not depend on
   `index.html` having changed. 3b/3c/3d in the same pass.
3. **MAJOR-2** — point the two display sites at `chemoDayList()`. Small, and it removes the last
   wrong date on screen.
4. **MAJOR-1** — decide `treatmentActiveOn` deliberately, the same way MAJOR-2 was decided for
   Zofran. Correct the release note either way.
5. **Port the BLOCKER + MAJOR-2 fixes to `chemowell-beta`** and re-verify isolation at runtime.
6. **MINOR-4** — derive `nextChemoTs()` from `chemoDayList()`; add a suite case for a
   `chemo_date` row with no `loggedAt`.
7. **MINOR-5, MINOR-6, MINOR-7** to `BACKLOG.md`; port `overflow-scan.mjs` to ChemoWell.

*Auditor pass, 2026-08-29. Every finding above is reproduced from a measured run. Probe scripts
were throwaway and are not committed; each measurement in this report includes the fixture needed
to rebuild it.*
