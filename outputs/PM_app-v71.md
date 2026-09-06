# Project Manager gate — ChemoWell app-v71

AUDITED-COMMIT: 13e67d8ac2a2006caa0e6d12d824d103dd175b2f
VERDICT: DO NOT SHIP

**In this project's plainer words: VERDICT: NO-GO — for now, and not because of the app.**
(`release_check.sh` only understands `SHIP` / `DO NOT SHIP`, so that is the vocabulary the header
above has to use. Read it as NO-GO.)

**Commit under test:** `13e67d8` on local `main`, also pushed to `origin/claude/app-v71-wip`.
**`index.html` md5:** `05cad67ff2471dff4cf70fd72becc548`
**`sw.js` md5:** `6f3ce4b129987c9abaa4e71bfa9187f1`
**Published baseline:** app-v70 / `chemowell-app-v70-1` at `28455fe` (`PUBLISHED.json`); `origin/main`
is at `40c8ba6`, which carries that same v70 `index.html`.

---

## Headline

**The build is sound. The paperwork around it is not, and one piece of it will make this project's
own release gate refuse the push.** I found nothing wrong with the code, the version mechanics, or
the reproducibility — I reproduced all three myself rather than taking them on report. Three things
block the sign-off, all of them fixable in minutes and none of them requiring a line of app code to
move:

1. **The audit report's header is not a commit sha, so `release_check.sh` will refuse the release
   and name the audit as unreadable.** This is a hard stop, not a nit.
2. **`BACKLOG.md` is uncommitted.** The four findings the audit recorded exist only in this
   sandbox's working tree. On this project's history that is the same as not having recorded them.
3. **`REQUESTS.md` ticks two items `[x]` while nothing is live**, against the rule written at the
   top of `REQUESTS.md` itself.

Fix those three and this is a GO. I would re-run `./release_check.sh` and expect exit 0.

---

## 1. Release mechanics — PASS

| check | result |
|---|---|
| `APP_VERSION` | `app-v71` (index.html:6669) |
| `sw.js` CACHE | `chemowell-app-v71-1` (sw.js:1) |
| moved together | yes — v70 was `app-v70` / `chemowell-app-v70-1` at `28455fe` |
| equal to the published baseline? | no, both moved |
| CACHE defined once in sw.js | yes |
| `index.html` parses | yes |

**On the parse check, and why the obvious way to run it lies.** `index.html` holds two inline
scripts; the real one is 830,034 characters. Compiled under V8 (`new vm.Script`) it is clean. My
first pass reported a syntax error in "script 1" — that was **my extraction regex**, not the file:
an HTML comment in the head contains the text `<script`, so a naive scrape cut the block short.
Worth writing down because that false positive is exactly the shape that gets a good build held.
Independently, the browser suite loads the real page and asserts **no page errors**, twice, and
passes.

**`release_check.sh` agrees on all of this.** Run against the tree as it stands, the script clears
its sw.js sections (CACHE readable, defined once, moved with index.html, never shipped before, not
the value already live) and its README section (a version-history row exists for `app-v71` and that
row names the cache key), and stops only at the chain gate for the missing PM sign-off — this file.
The mechanics half of the gate is already green.

---

## 2. Was any app code changed after the audit? — NO. Verified.

This is the check that matters most, because shipping bytes an auditor never saw is a documented
failure on the sibling project.

`13e67d8` touches **exactly two files**: `test/v71-report-controls.mjs` and
`outputs/AUDIT-app-v71.md`. No app code. And it is not just the file list that agrees — the audit
recorded `index.html` md5 `05cad67ff2471dff4cf70fd72becc548` and `sw.js` md5
`6f3ce4b129987c9abaa4e71bfa9187f1`, and both still hash to exactly that at `13e67d8`. The audited
bytes are the bytes on the table.

### The vacuous Radiation check is genuinely fixed — I falsified it myself

I did not take this on the commit message. I rebuilt the auditor's S5 sabotage on a scratch copy
outside the repo: in `renderRadiationReport()`, `return [addRow, summary, list]` → `return [summary,
list]`, so the add control survives only on the empty-state path — care-tracker v66's defect
exactly.

| build | result |
|---|---|
| `index.html` as committed | **16/16, exit 0** |
| same file, S5 sabotage applied | **FAIL — `an add control exists on the Radiation report │ no [data-report-add-btn]`**, 1 failed, exit 1 |
| untouched app-v70 base | **9 FAIL / 4 PASS, exit 1** |

The fix is real, it goes red on the defect it exists to catch, and it goes red on the base. The
suite also now proves which path it is on before asserting, and it scopes that text probe to
`<main>` rather than `document.body` — the right call in a single-file app, where a body-text
assertion matches the app's own source and can never fail.

---

## 3. Reproducibility — PASS, reproduced independently

- The supplied v70 base hashes `2e1c1b682524fd91de1fcfc318c7fcd9`, **byte-identical to `git show
  28455fe:index.html`**. So the base is the real baseline, not a copy of something adjacent to it.
- `python3 harness/enhance-reports-patch.py` applied to that base produces a file that differs from
  the committed `index.html` on **exactly one line**:

      6669c6669
      < const APP_VERSION = 'app-v70';
      > const APP_VERSION = 'app-v71';

Nothing else. The patch's `sub()` refuses any anchor that does not match exactly once, so a
silently-misapplied rewrite is not a way this could have passed.

---

## 3a. The pre-existing test failures — re-verified by me, on port 8899

I ran `./run-all-tests.sh` end to end against the committed build, on the port the legacy suites
hardcode. Result, exit 1:

    PASS 25   FAIL 4   COULD-NOT-START 1
      failing:      audit-v55 pm-v55 pm-v55b v57-browser-notice
      cannot start: audit-v55b

**Same four, same non-starter, same failure lines** as the auditor's untouched-v70 baseline
(`A3 total rows opened | 135`, `P3c every row opened | 135 rows`, `B8 all 133 rows opened | 135`,
the 320px notice-strip failures, and `audit-v55b` dying on `/tmp/topics.js`, a path from a sandbox
that no longer exists). Nothing v71 touched moved any of them, and `v71-report-controls` passes.
The README's `PASS 25 / FAIL 4 / cannot-start 1` line is true.

**I did not re-walk into the port trap, and it is worth restating why it matters.** The
`audit-v55`/`pm-v55` family hardcode `127.0.0.1:8899`. Run them on any other port and all of them
fail to reach a server, which prints as a wall of red that looks like a real difference between two
builds — the auditor hit this and briefly read it as "v71 fixed six suites". `run-all-tests.sh`
defaults to 8899 and starts the server itself, so the safe move is simply to let it, and never to
pass `PORT=`.

---

## 4. Docs moved with the code — MIXED

**TEAM.md — PASS.** The new section *"Does this number belong on the screen at all?"* is really
there, in the Copy review chapter, quoting Aaron and stating the general rule (averages of things
that accumulate over time almost never mean anything). It is a process change that outlives this
release, which is what that file is for.

**README.md — PASS with one false number.** The `app-v71` version-history row exists, names the
cache key, and describes the change accurately and in detail — including the deliberate
cycle exclusion. But it says the new gate was *"falsified against app-v70 at 9 of 12 red."*
**There is no 12.** The auditor already corrected this once (it counted 15 checks); after the
radiation fix there are 16. Measured just now against the v70 base: **9 red, 4 green, exit 1** —
the 9 is right, the 12 never was. A number in the version history is what somebody reconstructs
this release from later; it should be right.

**REQUESTS.md — the ticks are premature, by the file's own rule.** Both of Aaron's asks are
present, worded from his own words, and dated. Both are `[x]`. But `REQUESTS.md` opens with:

> *"An item only gets checked off after it's built, tested, and — for anything user-facing —
> confirmed live on the actual deployed site (the same one the APK loads), never from a plan or
> from 'should work.'"*

**Nothing is live.** The app-v57 entry twenty lines further down honours that rule explicitly
("All three are built. Ticks only after the live check"). Two items in the same file, same day,
opposite treatment. Either un-tick them until the live check, or say on the line that they are
built and awaiting it. This is small, and it is the exact class of quiet documentation falsehood
TEAM.md's *"Notes move with the code"* section was written about.

---

## 5. Rollback — a path exists; there is no bundle, and here is what it should be

There is no rollback bundle in `outputs/` and nothing named for one anywhere in the repo. That is
survivable here only because **git still holds v70 whole**: `28455fe` (and `origin/main` at
`40c8ba6`, whose `index.html` is the same bytes) carries app-v70's `index.html` and `sw.js`, and I
confirmed the `index.html` there hashes to the supplied base.

**The rollback recipe, written down so nobody has to work it out during an incident:**

    git show 40c8ba6:index.html > index.html
    git show 40c8ba6:sw.js      > sw.js
    # then bump CACHE FORWARD, e.g. chemowell-app-v70-2 -- do not simply restore -v70-1
    # then web-upload both files, then ./mark_published.sh and commit PUBLISHED.json

A straight restore of `chemowell-app-v70-1` would in fact work — browsers update a service worker
on a byte difference in `sw.js`, the reverted file differs from the v71 one, so the new worker
installs and its activate step deletes `chemowell-app-v71-1`. But bumping the cache name forward
costs nothing and removes the need to reason about that at all in the middle of a bad afternoon.

**Recommendation, not a blocker:** save `outputs/rollback-app-v70/{index.html,sw.js}` before the
push, so a rollback needs no git archaeology.

---

## 6. What the audit flagged, and whether it is recorded

The brief's condition was that every unfixed finding is written down before I sign. Here is the
true state.

| finding | fixed? | recorded? |
|---|---|---|
| Vacuous Radiation check (S5) | **fixed in `13e67d8`**, falsified by me | n/a |
| Undeletable paracentesis — no `loggedAt`, future `ts`; toast says "removed" | no (pre-existing, identical on v70) | yes — `BACKLOG.md`, **but uncommitted** |
| Floating Back pill clips a Radiation row's Remove by ~71×8px at 360 | no | yes — `BACKLOG.md`, **but uncommitted** |
| "Total drained" fails the same test the average failed | no (Aaron's call) | yes — `BACKLOG.md`, **but uncommitted** |
| Weight can add but still cannot edit or remove | no | yes — `BACKLOG.md`, **but uncommitted** |
| **S7 — nothing checks `loggedAt: Math.max(Date.now(), prev + 1)`** | no | **NOT RECORDED ANYWHERE** |
| **S6 — the suite can crash mid-run and silently truncate its own coverage** | no | **NOT RECORDED ANYWHERE** |

### 6a. `BACKLOG.md` is uncommitted — this is a blocker, not bookkeeping

`git status` reads ` M BACKLOG.md`. The whole *"From the app-v71 Zero Day Audit"* section — 21
lines, all four findings — exists **only in this sandbox's working tree**. It is not in `13e67d8`,
so it is not on `origin/claude/app-v71-wip` either. The safety branch that exists specifically so
this work survives does not contain it. A sandbox that rolls back takes all four findings with it,
including a *"the app tells the caregiver a medical record was deleted when it was not"* defect.

Written-but-uncommitted is not written down. **Commit it.**

### 6b. Two findings the audit made and nobody wrote down

The audit's falsification table has eight sabotages and the report discusses two gaps beyond S5.
Neither reached `BACKLOG.md`:

- **S7.** `loggedAt: Math.max(Date.now(), prevStamp + 1)` is, in the auditor's own words, the
  release's most carefully-reasoned line — and **no check covers it**; the sabotage that reduces it
  to a plain `Date.now()` passes the suite green. The auditor verified it by hand instead, and it
  works. But "verified by hand once" is how a thing stops being verified. The fix is the same one
  shape as the radiation fix: a fixture record with no `loggedAt`.
- **S6.** Under one sabotage the suite threw an unhandled `TimeoutError` and **checks 11–15 never
  ran**. Exit was 1, so a human sees red — but a mid-suite crash silently shrinks coverage, and
  this project has already been bitten by "a gate that cannot start looks exactly like a gate that
  passed."

Both are gate-quality defects, and TEAM.md is explicit that the gates are audited like code. Neither
is a reason to hold this release. Both must be in `BACKLOG.md` before it goes.

### 6c. My judgement on shipping with the four unfixed items

Acceptable, all four, and I would not widen this release to chase any of them:

- **Undeletable paracentesis (D1)** — pre-existing, identical on v70, and v71 cannot create the
  condition. Real, and it deserves its own small release soon because an app that says it deleted a
  medical record and did not is the kind of lie that gets believed. Not this release.
- **The 8px Back-pill clip** — a regression in the strict sense, but it fails safe: the control a
  stray thumb lands on is *Back*, not *Remove*. The sibling project's version of this had the
  destructive control underneath, and that is the difference between a note and a hold.
- **"Total drained"** — Aaron asked for the average removed and did not ask about this. Removing a
  second number he did not mention, in a patient's app, on the team's own initiative, is the wrong
  instinct. Propose it; do not do it.
- **Weight without edit or remove** — genuinely awkward given this release is named for report
  screens that can do the whole job, and worth saying plainly to Aaron rather than letting him find
  it. But adding an edit path to a trend-charted record type is a design decision, not a patch, and
  the day this release was built is the same day the sibling app destroyed a patient's record by
  treating exactly that kind of change as a port.

---

## 7. The blocker: the audit report cannot be read by this project's own gate

`outputs/AUDIT-app-v71.md` opens with a header whose first line reads
`AUDITED-COMMIT: working-tree-app-v71`.

That is not a commit sha. `release_check.sh` extracts the sha with
`grep -oE '^AUDITED-COMMIT:[[:space:]]*[0-9a-f]{7,40}[[:space:]]*$'`, gets nothing, and its
UNREADABLE rule then fires:

> *"AN UNREADABLE REPORT IS NOT AN ABSENT OBJECTION … the safe reading of 'I don't know what this
> says' is never 'it says ship'."*

So the gate **fails the release by name** — it does not fall back to the `VERDICT: SHIP` on the
next line. The audit is real, thorough and I have re-verified its central claims; it simply cannot
clear a gate written to refuse anything it cannot parse. The gate is behaving correctly.

**The fix is one line, and it is honest rather than cosmetic.** The auditor states in its own first
paragraph that the builder committed the working tree mid-audit as
`4e5b91fb93d176996f2888f513cb0e1fe161e210`, and that everything was measured against those bytes.
So the header should read:

      AUDITED-COMMIT: 4e5b91fb93d176996f2888f513cb0e1fe161e210

I checked that this also satisfies the staleness half of the gate: `git diff --name-only 4e5b91f`
over `index.html sw.js .github/workflows sync-backend package.json package-lock.json
capacitor.config.ts` is **empty**. No rule-5 path has moved since the commit the auditor examined,
which is the same fact section 2 establishes, arriving from the other direction.

I have deliberately **not** made this edit myself. Rewriting another stage's header is exactly the
kind of quiet change this gate exists to catch, and a PM editing the evidence it is judging is a bad
precedent even when the edit is right. It belongs to whoever owns that report.

---

## Conditions to turn this into a GO

1. Correct the `AUDITED-COMMIT` line in `outputs/AUDIT-app-v71.md` to the full sha
   `4e5b91fb93d176996f2888f513cb0e1fe161e210`.
2. Commit `BACKLOG.md`, and add the two unrecorded audit findings (S7, S6) to it first.
3. Fix the two documentation falsehoods: README's *"9 of 12 red"* (it is 9 of 16, 4 green, and
   the numbers should be re-read off a run rather than edited by hand), and the two premature `[x]`
   ticks in `REQUESTS.md`.
4. Commit `outputs/PM_app-v71.md` (this file) alongside `BACKLOG.md` — it is currently untracked,
   which is the same hazard I am blocking on in 6a, and I am not going to exempt my own report from
   it.
5. Re-run `./release_check.sh` and confirm exit 0 before the upload. It will still refuse while this
   file says DO NOT SHIP; the sign-off flips to `VERDICT: SHIP` once 1–4 are done, and that flip is
   mine to make, not the builder's.

Recommended, not blocking: save `outputs/rollback-app-v70/`.

None of this touches `index.html` or `sw.js`. If any of it does, the audit has to look again.
