# PM Gate — app-v68 (chemowell-app-beta), branch `claude/hotfix-treatment-date-clear`

AUDITED-COMMIT: 51ba75f


# VERDICT: FAIL BACK TO THE CHAIN

**Not because the code is bad. Because the code that would ship has never been audited.**

The Zero Day Auditor audited commit `51ba75f`. The branch head is `68d3dd6`. In between, the Lead
Developer changed **67 more lines of `index.html`** — rewriting `treatmentActiveOn` (which decides
whether a medication is shown or withheld near a treatment date), adding two new functions
(`chemoDayFor`, `zofranBlockingDay`), rewriting `zofranBlockedOn`, and changing the Zofran branch of
`status()`. **No auditor has seen any of it.**

TEAM.md's restart rule is not ambiguous about this tier: a "real functional, data, or safety-relevant
miss ... gets a **full restart** ... and the fix goes back through both mandatory gates from scratch."
MAJOR-1 and MAJOR-2 are squarely that tier — one of them causes a medication the care team said to
**avoid** near treatment to be **offered** on a day it should be withheld. The fixes for them are
exactly the code that has not been audited.

I am the last internal gate and my own review of that unaudited delta turned up a real defect in
about ten minutes (PM-1 below). That is the evidence that this delta needs an adversarial pass, not
my reading of it.

---

## ⚠️ READ THIS BEFORE TRUSTING `release_check.sh` ON THIS RELEASE

**The existence of this file makes `release_check.sh` print a green tick.**

The chain gate globs for `outputs/AUDIT*app-v68*` and `outputs/PM*app-v68*` and checks only that the
files **exist**. It does not read them. It cannot tell that this PM report says FAIL, and it cannot
tell that the audit report describes a different commit than the one being shipped.

Before this file existed, the gate failed with *"missing: an outputs/PM*app-v68*.md sign-off."* After
it exists, the gate passes — on a release its own PM has refused. **Do not read a green
`release_check.sh` on app-v68 as clearance.** Logged as PM-4.

---

## 1. Stage artifacts — what actually exists

| Stage | Ran? | Artifact | PM finding |
|---|---|---|---|
| 1. Developer | No | — | **Correctly skipped.** TEAM.md scopes this stage to genuine new features or architecture questions. This is a defect fix. Agreed. |
| 2. Lead Developer | Yes | the commits | Ran. Self-verification real but, per rule 5, not a gate. |
| 3. Zero Day Auditor | Yes | `outputs/AUDIT_app-v68.md` | **Exists, is high quality — and is stale.** Covers `51ba75f`, not `68d3dd6`. |
| 4. Designer | No | — | **Defensible for `51ba75f`, NOT defensible for the release as a whole.** See PM-3. |
| 5. Lead Auditor | No | — | Discretionary — the PM's call, and I would not have required it *if the audit covered the code*. It does not, so the ordinary Auditor is what is missing, not the Lead. |
| 6. Scribe | No | — | **Gap, and it matters here.** See PM-2. |
| 7. PM | Yes | this file | — |

There is also **no `outputs/PM_app-v67*.md`** — confirming app-v67 shipped to `main` with the Auditor
and PM gates skipped entirely. That is the incident this whole release exists to clean up, and it is
the reason I am not willing to wave through a second ungated release to fix the first one.

---

## 2. Verification of the Lead Developer's six post-audit claims

I tested each rather than reading the commit messages.

### Claim 1 — the chain gate's skippable door is closed. **VERIFIED. Falsified both ways.**

Before (on `main`'s script), a `sw.js`-only change with no audit report present:

```
ℹ️  Baseline: BASE_REF override -> HEAD
✅ Release check passed.
   No index.html changes vs HEAD.
EXIT=0
```

After (the branch's script), same input, audit report deleted:

```
❌ RELEASE CHECK FAILED: the quality chain has not run for app-v68.
   Changed under rule 5: sw.js
   missing: an outputs/AUDIT*app-v68*.md report
EXIT=1
```

Also confirmed blocking on `package.json` alone and `.github/workflows/` alone. `NEW_VERSION` is now
read independently of `INDEX_CHANGED`. **This fix is real and I could not get past it.**

### Claim 2 — "three more silent-exit bugs fixed." **PARTIALLY VERIFIED. The class is NOT eliminated.**

`:183` and `:265` (now `:202`/`:289`) are genuinely fixed — a baseline with no `sw.js` and no
`APP_VERSION` now produces a readable warning and reaches the chain gate instead of dying at exit 128
with zero output. The `CACHE_OLD = "none"` branch is reachable again. Confirmed by measurement.

**But the identical bug survives at line 109**, in the same shape as the one fixed at line 202:

```bash
REC_CACHE=$(git show "$PUB_COMMIT":sw.js 2>/dev/null | read_cache)   # unguarded
```

Measured — `PUBLISHED.json` pointing at a commit with no `sw.js`:

```
EXIT=128     (zero output — silent death)
```

This is worse than an ordinary bug, because lines 105-116 exist **specifically to catch a
hand-edited or tampered `PUBLISHED.json`**. In one shape of "tampered", the script dies with no
message instead of printing the "not self-consistent" refusal it was written to print — the auditor's
exact words about the previous instance: *the branch written to handle exactly this is unreachable
because the assignment dies first.*

Line 291 (`NEW_VERSION`) is also still unguarded while its twin at line 350 (`GATE_VERSION`) was
guarded in this very commit. It fails closed, so it is lower severity — but it means an `index.html`
with a renamed `APP_VERSION` kills the script before the chain gate runs, exit 1, masked as an
ordinary failure.

**The auditor asked for a sweep of the whole class. Three were fixed one at a time instead. That is
the pattern the finding was written about.**

### Claim 3 — `treatmentActiveOn` / `zofranBlockedOn` ask every treatment. **VERIFIED, and falsified.**

Both now iterate `chemoDayList()`. I reverted `treatmentActiveOn` to nearest-only on a scratch copy:

```
FAIL  26 Aug is 2 days after the 24th and stays active, though the 27th is nearer
FAIL  an EXCLUDED medication is therefore withheld on that day too, not offered
FAIL  a window typed as text is honoured, not silently reset to the default
23/26 checks passed
```

The new checks go red on the defect. The gate is real. Also confirmed the `0` case is handled
correctly (a naive `||` would have broken a legitimate `0`-day window; they used explicit
`!== null/undefined/''` tests).

### Claim 4 — display sites print the right date. **VERIFIED.**

No `dayStart(nextChemoTs())` remains in executable code (one occurrence survives, inside an
explanatory comment). `chemoDayFor()` uses the same nearest-date tie-break as `chemoOffsetFor()`, so
the banner label and the condition around it can no longer disagree. `zofranBlockingDay()` returns
non-null whenever `zofranBlockedOn()` is true, so the `status()` fall-through is unreachable — and it
falls through to *available*, which is the safe direction.

### Claim 5 — "adopted care-tracker's coercion and 0–14 clamp." **NOT VERIFIED. This claim is wrong.**

See PM-1. The clamp was added at **one read site only**. The save path, the normalise path, and the
editor's own on-screen chip were never touched, and `git log -S clampTreatmentDays` on this branch
returns nothing.

### Claim 6 — the false README claim corrected. **VERIFIED, and done properly.**

The app-v68 row now carries an explicit *"Correction to an earlier claim in this row"* paragraph
stating the suite cannot start on app-v67, with the honest mutant numbers. Corrected **in the file**,
not in a commit message — which is what TEAM.md requires.

---

## 3. Defects I found that nobody upstream reported

### PM-1 (MAJOR) — the window clamp is applied at read time only, so the editor now lies on screen

`clampTreatmentDays()` at `index.html:5392` is **still unbounded**:

```javascript
return Number.isFinite(n) && n >= 0 ? n : 1;     // no Math.min(14, ...)
```

care-tracker's equivalent clamps to 14. This branch never touched ChemoWell's copy. The result after
app-v68 is four code paths that no longer agree:

| path | line | behaviour on a typed `300` |
|---|---|---|
| Save | :5501 | `clampTreatmentDays` → stores **300** |
| Editor chip | :5967, :6031, :6035 | `clampTreatmentDays` → **prints "−300/+300"** |
| Normalise | :1109, :5237 | `Number.isFinite` → still **string-blind** |
| **Evaluation** | :1530 (new) | inline `num()` → **clamps to 14** |

**Two consequences.**

1. **The editor now shows a value the app does not obey.** Type 300, the chip says
   "Treatment day −300/+300", the medication behaves as −14/+14. Before app-v68 these agreed
   (both unbounded). The behaviour is *safer*; the screen is now *untrue*. In a medication editor,
   a control that displays a number it does not honour is its own defect.
2. **The stated bug is not actually fixed.** The claim is that `Number.isFinite("3")` being false
   made typed windows collapse to 1/1. But that collapse happens in `normalizeMedication()` at
   `:1109`, which every saved medication passes through on load (`:1210`) and on save (`:5515`) —
   **before** `treatmentActiveOn` ever sees the value. A `"3"` arriving from a restore or import is
   destroyed at normalise and reaches the new coercion already reduced to `1`. The new code cannot
   recover it. The fix was applied one layer too late.

The new test at `test/v67-chemo-offset.mjs` asserting `'300'` is clamped **pins this half-fix as
correct**, which will make it harder to spot later.

Not a blocker. But it is a defect *introduced by the unaudited half of this release*, found by the PM,
which is precisely why that half needs an auditor.

### PM-2 (MAJOR, process) — the Scribe gap is not cosmetic on this release

The Lead Developer's framing — "I corrected one false claim in the README myself" — understates what
Scribe owes here. Scribe's job is not only the README row. It is also:

- **Logging the audit's deferred findings in `BACKLOG.md`.** The auditor explicitly routed MINOR-5,
  MINOR-6, MINOR-7 there, and said the `v55-help` red *"belongs in BACKLOG.md as its own entry"* and
  that `BACKLOG.md:119` *"should stop being read as the explanation for this suite's red."* That is a
  wrong sentence sitting in a file, which TEAM.md calls out by name: *"the uncorrected copy is always
  the one somebody actually reads."* I see no BACKLOG change on this branch.
- **Showing Aaron the full done / outstanding list**, which TEAM.md requires on *every* build and
  request, not just completions.

Three of the auditor's findings are now deferred with nowhere to live. And the author checking their
own documentation is exactly the check Scribe exists to replace — the LD is right to have flagged
this rather than let me find it, but flagging it does not close it.

### PM-3 (MINOR) — the "no layout change" justification is wrong for two of the six changes

The Designer skip was justified as "logic and copy, not layout." That holds for the treatment-date
maths. It does **not** hold for the two `renderGroupedMedsCard` changes, which are the ones that
change what is physically on screen:

- **"Take all" now appears during a hospital stay** where it previously did not — a new 44px button
  rendering into a flex row at phone widths.
- `offDay` flipping changes a medication row from a full orange **Log** button to a locked row with
  a **"Log anyway"** override.

The auditor was honest that it *"did not render it"* and said so twice. So: two render changes, zero
render verification, in a release whose every gate is data-layer — and ChemoWell still has no port of
`harness/overflow-scan.mjs`. The risk is genuinely low (both states already render in the ordinary
non-stay case), which is why this is MINOR and not a hold on its own. But "no layout change" is not
an accurate description of this diff and should not be repeated.

### PM-4 (MAJOR, gate design) — the chain gate cannot tell a stale audit from a current one

Covered in the banner above. The gate proves a *file exists whose name contains the version string*.
It cannot check that the audit describes the commit being shipped, that the report says PASS, or that
the file is non-empty. On this exact release that is not theoretical: `AUDIT_app-v68.md` legitimately
names app-v68 and legitimately cleared app-v68 — of a commit that is now four commits behind.

**Recommended:** have the gate record the audited commit SHA (the auditor already writes it in the
report) and fail when `git diff <that SHA>..HEAD -- <rule-5 paths>` is non-empty. That converts
"an audit happened" into "the audit covers this code," which is the thing the gate is actually for.

### PM-5 (MINOR, scope) — six binary screenshots ride along in this hotfix

`git diff main...HEAD` includes byte-level changes to six PNGs under `outputs/` unrelated to the
treatment-date fix — almost certainly regenerated by a test run and swept into a commit. Harmless,
but a hotfix branch to a medication app should contain the hotfix.

---

## 4. Release check — raw output, verbatim, warnings included

```
ℹ️  Baseline: PUBLISHED.json -> app-v67 (chemowell-app-v67-1) at 283b016
   2 commit(s) have changed index.html since that record. This gate assumes NONE of
   them are live yet. If any were already pushed, run ./mark_published.sh <that commit>
   first -- otherwise the comparison below is against the wrong build.
❌ RELEASE CHECK FAILED: the quality chain has not run for app-v68.
   Changed under rule 5: index.html sw.js 
   missing: an outputs/PM*app-v68*.md sign-off
   Every suite passing is SELF-verification. APP_CLAUDE.md rule 5 requires an independent
   Auditor pass and PM sign-off before this ships, with no size exception. Permission to
   push is not that gate.
EXIT=1
```

Two things to disclose rather than summarise away:

- The **baseline-staleness warning is present and is not noise.** It is the gate saying out loud that
  it is trusting `PUBLISHED.json` to be current and cannot verify that from inside the sandbox.
  `./mark_published.sh` must be run immediately after any push.
- The failure above is the **pre-existing** state, before this report was written. See the banner:
  once this file exists the same command exits 0. That flip is not evidence of anything improving.

`APP_VERSION = 'app-v68'` ↔ `sw.js CACHE = 'chemowell-app-v68-1'` ↔ README row naming that cache key:
all three confirmed consistent.

---

## 5. Suites — re-run independently by me

Full `./run-all-tests.sh`, my own clean run:

```
PASS 17   FAIL 5   COULD-NOT-START 1
  failing:      audit-v55 pm-v55 pm-v55b v55-help v57-browser-notice
  cannot start: audit-v55b
NOT GREEN — do not report this work as done.
```

**This reproduces the auditor's numbers exactly** — same totals, same five suites, same
cannot-start. The auditor's MAJOR-10 closure is honest and independently confirmed, including that
`v52-fixes` and `v55-fixes-shots` were environment contamination in the previous round and pass
clean. That materially raises my confidence in the rest of that report.

All five reds are pre-existing and none is caused by app-v68: three are topic-count pins (135 vs a
hardcoded 133), one is a stale wording pin on copy app-v67 deliberately rewrote, one is the app-v58
layout regression. Confirmed by reading the failure lines, not by assumption.

Release gates, run individually:

```
v67-chemo-offset       26/26   EXIT=0
v67-inpatient-window   10/10   EXIT=0
v67-medflag-backfill     4/4   EXIT=0
```

`run-all-tests.sh` correctly `exit 1`s on a non-green run. (I briefly misread a `0` here; it was
`tail`'s exit code in my own pipeline, not the runner's. The runner is fine.)

---

## 6. Does this match what Aaron asked for?

**Yes on intent, no on discipline.**

Aaron's instruction, 2026-08-29: *"you CAN always push to chemowell, after audit pass and PM."*
Order: build → self-verify → **independent Auditor** → **PM sign-off** → push.

The Lead Developer did: build → audit → **build more** → PM. The second build step is the problem.
It is not scope drift in the sense of inventing features — every one of the six changes traces to a
real audit finding. It is scope drift in the sense that **the auditor's own recommended order was
ignored**:

> 1. **Ship app-v68.** ... 2. `release_check.sh` MAJOR-3a, **before the next release** ...
> 3. MAJOR-2 ... 4. MAJOR-1 ...

The auditor explicitly sequenced items 2, 3 and 4 *after* shipping. Bundling them into the same
release converted a cleared release into an uncleared one. The clean path was available, was written
down, and was not taken.

---

## 7. RULING 1 — app-v68: HOLD, with a cheap and specific remedy

**Do not merge `claude/hotfix-treatment-date-clear` to `main` as it stands.**

I weighed this seriously against the auditor's "holding costs more than anything I found," and I
disagree with that trade **on the current head**, for three reasons:

1. **The auditor's verdict was about a different commit.** "Ship them" referred to the three fixes in
   `51ba75f`. It cannot be transferred onto 67 lines written afterwards in response to that report.
2. **The urgency is lower than framed.** `chemowell-app-beta` publishes to
   `arnjnnngs.github.io/chemowell-app-beta/` — the **native-app beta**. The patient's live app is
   `care-tracker`. Real defect, real users, but this is not the phone Brandi depends on tonight, and
   that difference is worth a few hours.
3. **The unaudited half already has a defect in it** (PM-1), found by the gate that is explicitly not
   supposed to be the one finding these.

**Either of these clears the hold. Both are hours, not days:**

- **Option A (preferred).** Re-audit scoped to `51ba75f..HEAD` — a 67-line `index.html` diff, the
  `release_check.sh` rewrite, and 9 new test checks. Per TEAM.md the re-audit attacks the **whole**
  change and those suspects are a **floor, not a ceiling** — and it must reach the two render
  changes in `renderGroupedMedsCard`, which no one has yet looked at on a screen. Then this gate
  re-confirms the audit names the shipping commit, which is quick.
- **Option B.** Ship `51ba75f` alone as app-v68 — exactly what the auditor cleared, in the order it
  recommended — and carry `68d3dd6` into app-v69 with its own audit. Gets the blocker fix to users
  today with a fully clean chain behind it.

**Also required before merge, either option:** the Scribe pass (PM-2) — the three deferred findings
and the `v55-help` correction into `BACKLOG.md`, and Aaron's done/outstanding list.

**Not required to merge, but do not lose:** PM-1 (clamp at the save and normalise layers, or the
editor chip stops being true), the line-109 silent exit, and PM-4 (teach the gate to check the
audited SHA).

---

## 8. RULING 2 — `chemowell-beta`: it is second, and it needs its own audit

The auditor reported it could not reach this repo. **It is present in this sandbox at
`/home/user/chemowell-beta`, and I checked it directly.** `beta-v60` on `main` carries the identical
blocker:

```
index.html:1237  function chemoDayList()
index.html:1240    .filter(e => e && e.ts > 0)          <-- the tombstone-discarding filter
grep -c "dayStart(nextChemoTs())"  ->  2                 <-- both display sites, unfixed
```

**Order, and why:**

1. **`chemowell-app-beta` first.** It is further along, its fix is written, and the port should be
   made from a build that has actually cleared the chain — not from a branch that has not. Porting
   first would copy an unaudited fix into a second repo and double the review debt.
2. **Then port to `chemowell-beta` as its own release, with its own Auditor and PM pass.** Rule 5
   applies per repo; a clean audit here is not an audit of that. That port must additionally
   re-verify **Firestore isolation at runtime** — `chemowell-beta` writes to a shared Firebase
   project, `APP_CLAUDE.md` rule 2 forbids it touching the `caretracker_*` collections, and the
   auditor flagged that this was *not* re-verified this round. It is the highest-consequence check in
   that repo and it is currently unverified.
3. **Flagged, outside my gate:** `care-tracker`'s own port of this fix is sitting on branch
   `claude/caretracker-chemowell-updates-k80ydk`, not on `main`. Given that `care-tracker` is the
   patient's real app, somebody should establish deliberately whether `main` is exposed and what the
   plan is. I did not assess it and am not ruling on it.

**Do not do all three in one session or one chain.** Three repos, three releases, three audits.

---

## 9. What I did not reach

- **No rendered screen.** Same gap the auditor named. I did not drive a browser against app-v68; the
  two `renderGroupedMedsCard` changes remain unverified visually by anybody. ChemoWell still has no
  port of `harness/overflow-scan.mjs`.
- **`chemowell-beta`** — I confirmed the blocker is present by reading. I did not audit that repo,
  did not run its suites, and did not verify Firestore isolation.
- **`care-tracker`'s release readiness** — out of scope, flagged only.
- **The `cwBkMergeById` restore path** (MINOR-4's exposure) — read, not exercised.
- **`audit-v55`'s A6 / B8** — still unattributed, as the auditor also left them. Open since app-v66.
- **`release_check.sh`'s remaining unguarded assignments** — I proved line 109 and characterised 291.
  I did not exhaustively test lines 161, 185 and 304.

---

*PM gate, 2026-08-29. Every measurement above was reproduced by me on this branch or on a scratch
copy of it; nothing here is taken from the Lead Developer's commit messages or from the Auditor's
report without independent re-running.*
