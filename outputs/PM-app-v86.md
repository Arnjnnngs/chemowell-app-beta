AUDITED-COMMIT: 3c167cb
VERDICT: DO NOT SHIP

# PM sign-off — ChemoWell app-v86 (`3c167cb`, branch `claude/caretracker-team-review-i83ik2`)

**The code is right and I could not break it. The chain is not complete: the Enhancer seat never
ran, there is no `outputs/ENHANCER-app-v86.md`, and `release_check.sh` refuses the release for
exactly that and for nothing else.** Rule 5 has no size exception and no PM discretion to waive a
seat, and this is the worst release to waive it on — the defect Aaron reported is *literally* the
Enhancer's flagship checklist item (a screen that offers Remove and no Add, the Paracentesis bug
shape), and walking the four changed screens for completeness is the one question nobody asked.
I found two live symmetry gaps on those screens while reading them, below, which is what that seat
exists to surface before a build rather than after one.

**Everything else passed.** Six mutants of my own, all red. 86/86 reproduced. `index.html` and
`sw.js` are byte-identical to the commit the last Zero Day Audit said SHIP at, so no app code has
escaped audit. All three "pre-existing red" claims verified by me on both builds. Rule 0 clean.
Release mechanics clean. No scope drift. The copy is true.

**The remedy is one file and no code change.** Run the Enhancer pass on the four screens this
release touches, write `outputs/ENHANCER-app-v86.md` (an honest "nothing this time" is a legitimate
pass and still counts), commit it, re-run the gate. Nothing in the shipped app needs to move for
that, which is why this is a refusal of the process and not of the build.

---

## 1. Chain stages and their artifacts

Everything in `outputs/` carrying `v86` in its name, by filename:

| Seat | Artifact | Present |
|---|---|---|
| Designer | `outputs/DESIGN-app-v86.md` + `outputs/design-app-v86/` (18 PNGs) | yes |
| Zero Day Auditor, pass 1 | `outputs/AUDIT-app-v86.md` | yes |
| Zero Day Auditor, delta | `outputs/AUDIT-app-v86-delta.md` | yes |
| Zero Day Auditor, delta 2 | `outputs/AUDIT-app-v86-delta2.md` | yes |
| Zero Day Auditor, delta 3 | `outputs/AUDIT-app-v86-delta3.md` | yes |
| **Enhancer** | **`outputs/ENHANCER-app-v86.md`** | **MISSING** |
| PM | this file | yes |

The 18 Designer PNGs are real files at six screens x 320/360/390, 191–302 KB each, written
2026-10-25 00:11–00:15 — not a claim. I opened two of them (bowel report at 390, Settings with the
rename field open at 360) and the copy in them matches the source.

The Enhancer artifact is not merely unfiled. `git log --all -- 'outputs/ENHANCER*'` shows passes for
app-v84 and app-v85 and none for app-v86; `find` turns up no file of any name written for this
release; there is no untracked copy. The seat did not run.

**Why this is substantive here, not clerical.** Rule 2.6's first checklist item is add / edit /
remove symmetry, and its worked example is a screen that can delete a record but not create one.
That is precisely the defect Aaron reported. The release fixes it for *today's* answer. Reading the
rendered screens myself, two neighbouring halves of the same question are still open and nobody has
written down a decision on either:

- **A past day can still only be deleted, not corrected.** The Bowel Movement history row for
  Saturday offers one control: `Remove`. Correcting last Tuesday is still delete-and-re-add, which
  is checklist item 3 word for word, on the very screen this release rebuilt.
- **The bowel-issue banner cannot record "Loose".** `BOWEL_MOVEMENT_LABELS` has five values; the
  banner's select offers four (`normal`, `very_little`, `none`, `diarrhea`). A caregiver whose real
  answer is Loose cannot enter it from the control the app pushes hardest. **This is pre-existing —
  identical at `87d1784` — and is NOT caused by this release**, but this release rewrote that
  banner's writer, so it is squarely inside the seat's scope.

Neither is a data-loss risk and neither needs to be built now. They need to be *proposed with a
size and a recommendation*, which is the Enhancer's output and which Aaron has twice said he should
not have to ask for.

---

## 2. The audit trail, and the four things I broke myself

### The trail reconciles

| Report | Commit examined | Verdict | In history | Superseded by |
|---|---|---|---|---|
| `AUDIT-app-v86.md` | `5d54e2e` | DO NOT SHIP | yes | delta (`0f73911`) |
| `AUDIT-app-v86-delta.md` | `0f73911` | SHIP | yes | — |
| `AUDIT-app-v86-delta2.md` | `5ae0f67` | DO NOT SHIP | yes | delta3 (`4d6db99`) |
| `AUDIT-app-v86-delta3.md` | `4d6db99` | SHIP | yes | — |

Each refusal is answered by the same desk looking again at a strictly later commit. The gate agrees
(section 7): it names delta3 as the current clearing audit and lists the two refusals as superseded.

### HEAD is one commit past the last SHIP, and that commit changes no app code

This was the thing most worth checking and it comes out clean:

    git diff --stat 4d6db99 3c167cb
      README.md                       |   2 +-
      outputs/AUDIT-app-v86-delta3.md | 411 +
      test/v86-logging-and-labels.mjs |  69 +-

    md5 index.html  4d6db99 / 3c167cb / working tree : 1d5f3004caac466e904b65f5d06ae7c7 (all three)
    md5 sw.js       4d6db99 / 3c167cb / working tree : 3a60dd3a758f2b3ac8f5090971ee8e3f (all three)

`git diff 4d6db99 3c167cb -- index.html sw.js` is **empty**. The shipping artifact is byte-identical
to the tree the Zero Day Auditor cleared. The last commit only *tightens the suite* (+69 lines: the
banner-toast check and the superseded-counter fixture) and *corrects two overstatements in the
README row*. Strengthening a suite and removing a false claim cannot regress the app, so this does
not need a fifth audit round. It does need the suite re-run against the real file, which I did.

### I re-ran the suite and then re-broke six things

`python3 -m http.server 8899 --directory /home/user/chemowell-app-beta`, then
`env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy node test/v86-logging-and-labels.mjs`.

    86 checks: 86 passed, 0 failed

Then, one at a time, mutate `index.html` in place, run, restore from a byte copy taken before any of
this, `md5sum -c`. **`index.html: OK` after every single one.** The four required, plus two more:

| # | What I broke | Result | What went red |
|---|---|---|---|
| M1 | **rename rollback arm** — deleted `await setPrefsDB({ patientName: previous })` from the list-write catch | 85/86 | *"and patientName is rolled back, not left holding the new name"* — `patientName=List Fail Name` |
| M2 | **banner toast forced to the wrong branch** — `setToast(changed ? …)` → `setToast(false ? …)`, so a correction that DID write says "Already logged" | 85/86 | *"and the toast says it was updated, not that it was already logged"* |
| M3 | **superseded filter, BM counter** — dropped `&& !isSupersededEntry(...)` | 85/86 | *"but the summary counts one of each"* — `summary="2 BM · 1 appetite · 1 radiation"` |
| M4 | **duplicate guard inside `logBowelMovement`** — removed `if (prev && prev.value === value) return false;` | **82/86** | four reds, incl. *"so the export does not mark an identical answer as corrected"* — `["Diarrhea (corrected later — superseded)"]` |
| M5 | superseded filter, **appetite** counter | 85/86 | `summary="1 BM · 2 appetite · 1 radiation"` |
| M6 | snooze handler set to **90** minutes, all three strings left saying 15 | 85/86 | *"the snooze really is set ~15 minutes out, not just labelled that way"* — `handler set it 89.99 minutes out` |

M4 is the important one: it kills the *export marker* as well as the counters, which means the
"corrected later — superseded" line a clinician reads is genuinely under test and not decoration.
M6 was a mutant that **survived** the first audit round; it is dead now.

**I did not take any of the four audit rounds on trust.** Every claim I re-tested held.

---

## 3. Does the deliverable match what Aaron asked for?

### The five claimed are genuinely done

1. **Bowel and appetite loggable before 7pm.** Both report screens carry
   `renderDailyValueLogger`, gated on nothing but the current day. The Home check-in window
   (`checkinWindowOpen()`, 19:00 default) is deliberately unchanged — correctly, a card at
   breakfast asking how today went is the nagging it was added to remove. A second pick supersedes:
   `supersedeStamp()` returns `max(prev.ts + 1000, dayStart + 12h)` and lives **inside**
   `logBowelMovement` / `logAppetite`, so every writer obeys it with no argument to forget. Verified
   by M4 and by section 15 of the suite.
2. **History stops calling everything a dose.** `NON_DOSE_MED_IDS` is the same list `nameOf()`
   enumerates; `isDoseEntry` excludes it plus `symptom_*`. A day reads
   `1 temp · 1 BP · 1 symptom · 1 para`. Verified by M3/M5 and the suite.
3. **`APAP` gone.** One mg row per medication, under that medication's own name.
4. **Rename exists, and the single-profile phone has controls.** The active row now renders
   `Active` + `Rename`; I confirmed this in the 360px screenshot of a Free, one-profile phone.
   `renameActiveProfile` writes both stores with one `try` per write and rolls back only the write
   that succeeded. Verified by M1.
5. **Snooze says fifteen minutes** — one constant `HERO_SNOOZE_MIN = 15` feeds the handler, the
   button (`Snooze 15m`) and the toast. Verified by M6.

### The queued items are genuinely absent — no scope drift

I read the hunk headers of the whole `index.html` diff against the live build. It touches exactly:
`renameActiveProfile`, `state.renamingProfile`, `NON_DOSE_MED_IDS` / `isDoseEntry` /
`isSymptomEntry`, `nextMedicationId`, `supersedeStamp` / `renderDailyValueLogger`,
`confirmCheckinModal`, `submitBowelBannerUpdate`, `buildExportRows`, `reportDescriptor`,
`renderHistory`, `renderAccount`, `renderSettings`, `renderToday`'s snooze control, `APP_VERSION`
and the changelog.

Nothing touches the chart axis, the Calendar, the In-Patient checkbox, dose prompts, fever warnings
or symptom severity. **Backup gating specifically:** `getLicense().tier` appears at the same four
sites on both builds (`createProfile`, `+ Add profile`, `openPrintReport`, `isFree` in the export
panel) — byte-for-byte the same set as app-v85. Aaron's 2026-10-24 decision that **saving stays
free and restore goes to Plus** is recorded in the README row as queued and is **not** implemented.
Correct on both counts.

### One record-keeping failure, and it is mine to name

`REQUESTS.md` still carries nothing dated later than 2026-09-15. Aaron's twelve items from the
2026-10-23 testing pass exist **only inside the ~5,000-character README cell on line 14**. Both the
first and the second audit flagged this and both called it the PM's step. I agree it is, and I have
deliberately not done it here because I am reviewing a tree I share and must hand it back carrying
only this report — but it must not ship unlogged. **Add to the remedy:** the eight queued items go
into `REQUESTS.md` as eight numbered lines before the next release. A changelog cell is not a list,
and this is the third time on this project that output has been filed where the owner does not read
it.

A smaller arithmetic wobble in that cell, worth fixing while someone is in there: the queued list
names seven things "and four polish items", which reads as eleven queued, not eight. Say which
eight.

---

## 4. The copy, read as it renders

I read these in the source and in the Designer's renders, not in the diff.

| Where | What it says | True? |
|---|---|---|
| Logger card title | "Log today's bowel movement" / "Log today's appetite" | yes — the logger is `dayStart(simNow())`, today only, and it does not promise more |
| Logger caption | "Sunday, Oct 25 · nothing logged yet" / "· currently Normal" | yes |
| Logger footer | "Picking again replaces today's answer. The earlier one stays in the record." | yes — supersede, not delete; I killed the guard in M4 and watched the record change |
| Logger no-op toast | "Already logged as Normal for today." | yes |
| Report description (bowel) | "Log today's bowel movement, and review the history." | yes — and it replaces the old "logged from Home", which was the false sentence Aaron caught |
| Report description (appetite) | "Log today's appetite, and review the history." | yes |
| Banner toast, wrote | "Bowel movement updated — Diarrhea" | yes |
| Banner toast, no-op | "Already logged as Normal for that day." | yes — and *"that day"* rather than *"today"* is right: the banner targets `latestBowelDay()`, and its own heading above already names it ("Update status for yesterday") |
| Snooze button | "Snooze 15m" | yes |
| Snooze toast | "Snoozed · back in 15 minutes. Nothing about the dose has changed." | yes — it sets `heroSnoozeUntil` and touches nothing else |
| Account caption | "In Settings you can rename the profile you're in, and delete any other." | yes — Rename renders only on the active row, Delete only on the others. States exactly what is possible |
| Rename failure toast | "Could not save that name — nothing was changed." | yes **on both arms now**, which is what delta3 was called back for |

**The CHANGELOG entry.** Eight bullets, all true. The one I went looking to disprove was bullet 6:
*"the exported file and the printed report mark it as corrected"*. Both `downloadEntriesCSV()` and
`openPrintReport()` call `buildExportRows()`, which appends `(corrected later — superseded)`, so the
claim holds for both surfaces. Equally important is what it does **not** claim: it is scoped to the
export and the report and says nothing about the in-app History list, which does not mark them.
That scoping is deliberate and honest.

At 2am, by a tired non-technical reader: the bullets use "7pm unless you changed it", "one specific
painkiller's abbreviation", "a nurse reading two answers for the same day can tell which one
stands". No jargon, no file paths, no version numbers. This is the best changelog this project has
shipped.

**One copy note, not blocking.** The logger footer says the earlier answer "stays in the record" —
and on the History screen the caregiver will indeed see both rows, at the same minute, unmarked,
under a summary that says "1 BM". Nothing untrue is printed, but the sentence and that screen
reinforce each other in a way that makes the History timeline item in section 9 more worth doing
than its size suggests.

---

## 5. Release mechanics

- `APP_VERSION` `app-v85` → **`app-v86`** (index.html:9149).
- `sw.js` CACHE `chemowell-app-v85-1` → **`chemowell-app-v86-1`** (sw.js:1). They move together.
- The new cache value appears nowhere in published history — I walked every `sw.js` commit reachable
  from the published baseline; the newest values there are `…v84-14` and `…v85-1`. No reuse.
- README: **exactly one** `| app-v86 |` row, and it names `chemowell-app-v86-1`.
- In-app CHANGELOG: **exactly one** `v: 'app-v86'` entry.
- `PUBLISHED.json` records the live build as **app-v85 / `chemowell-app-v85-1` at `c93a072`**,
  published 2026-09-17, and it is self-consistent (that commit's `sw.js` really says that). So
  **app-v86 is not live**; `87d1784` differs from `c93a072` only in `PUBLISHED.json` itself, which is
  why using `87d1784` as the app-v85 baseline for the pre-existing-red comparison is sound.
- After a successful push, `./mark_published.sh` must be run and committed, or the next release's
  baseline is wrong. That is the standing step, not a finding.

---

## 6. Rule 0 — one patient must not be in a product everyone uses

`node test/v75-no-other-patient.mjs` → **27/27 checks passed.** The ratchet reports
`0 outside the resolvers, ceiling 0`, `0 fallbacks inside resolvers, ceiling 0`,
`0 helper(s), ceiling 0`, and `found 0/0/0, pinned at 0/0/0` — the migration is complete and the
ceilings are not stale.

My own pass over the diff, because the ratchet is a floor and not a ceiling:

- **No patient name.** None added.
- **Gendered pronouns.** One hit in the added lines: a code comment reading *"He was right about the
  cause"*. That refers to **Aaron**, the owner, quoting his own bug report — not to a patient. Rule
  0's leak shape 2 is about the app assuming a patient's gender; this does not. I am recording it
  rather than silently passing it so the next reader does not have to re-derive the judgement.
- **No dose, ceiling or schedule** from any care plan added.
- **No new behaviour keyed to a medication id.** The one new id-aware line is the opposite:
  `nextMedicationId` now refuses ids that collide with this app's **own record types**
  (`weight`, `appetite`, `paracentesis`, `symptom_*`). Those are storage keys, not drug names, so
  this is not the v78 fence returning.

One residual, recorded and not blocking: a phone that **already** holds a medication with the id
`weight` keeps it, and from app-v86 `isDoseEntry` stops counting its doses. `isDoseEntry` is used in
exactly one place — the History day summary count — so the blast radius is one line of one summary,
and the audit confirmed the restore path never calls `nextMedicationId`. Worth a line in
`BACKLOG.md`; not worth a release.

---

## 7. `./release_check.sh` — raw output

Run from `/home/user/chemowell-app-beta` at `3c167cb`, working tree clean apart from this
report. **Exit code 1.**

```
ℹ️  Suites will run against a clean export of HEAD at /tmp/tmp.NUIe1OSIbm
   (not the working tree -- see the app-v82 note above).
ℹ️  Baseline: PUBLISHED.json -> app-v85 (chemowell-app-v85-1) at c93a072
   5 commit(s) have changed index.html since that record. This gate assumes NONE of
   them are live yet. If any were already pushed, run ./mark_published.sh <that commit>
   first -- otherwise the comparison below is against the wrong build.
❌ RELEASE CHECK FAILED: the design-time seats have not run for app-v86.
   missing: an outputs/ENHANCER*app-v86*.md pass
   These run BEFORE the build, on the screens about to change (TEAM-ORDER.md).
   An Enhancer pass that found nothing is written down as 'nothing this time' and still
   counts. Silence does not -- that is the failure this gate exists for.
❌ RELEASE CHECK FAILED: a chain report refuses this release, and nothing supersedes it.
   These say DO NOT SHIP:
     outputs/PM-app-v86.md — examined 3c167cb
   A refusal is cleared by re-running that stage against a LATER commit and it saying
   SHIP — not by adding another file beside it.
EXIT=1
```

**Reading it.** The refusal above is the one the brief predicts and more: my own report says DO NOT
SHIP, so the gate stops on that. To see what the gate would say with the PM question removed, I
cloned the repo into my session scratchpad at `3c167cb`, dropped a clearly-labelled placeholder
PM file saying SHIP into **that clone only**, and ran the gate there. Nothing in the repo under
review was touched. Raw output of the probe:

```
ℹ️  Suites will run against a clean export of HEAD at /tmp/tmp.wV0b5FhodX
   (not the working tree -- see the app-v82 note above).
ℹ️  Baseline: PUBLISHED.json -> app-v85 (chemowell-app-v85-1) at c93a072
   5 commit(s) have changed index.html since that record. This gate assumes NONE of
   them are live yet. If any were already pushed, run ./mark_published.sh <that commit>
   first -- otherwise the comparison below is against the wrong build.
❌ RELEASE CHECK FAILED: the design-time seats have not run for app-v86.
   missing: an outputs/ENHANCER*app-v86*.md pass
   These run BEFORE the build, on the screens about to change (TEAM-ORDER.md).
   An Enhancer pass that found nothing is written down as 'nothing this time' and still
   counts. Silence does not -- that is the failure this gate exists for.
ℹ️  Other reports present and not clearing this release:
     outputs/AUDIT-app-v86-delta.md — examined 0f73911; changed since: index.html 
     outputs/AUDIT-app-v86-delta2.md — says DO NOT SHIP
     outputs/AUDIT-app-v86.md — says DO NOT SHIP
ℹ️  Chain artifacts present for app-v86, and current against the working tree:
     outputs/AUDIT-app-v86-delta3.md
     outputs/PM-app-v86.md
ℹ️  v76-properties-equivalence.mjs: green.
ℹ️  v76-empty-window-render.mjs: green.
ℹ️  No-other-patient check: clean.
EXIT=1
```

**That is the finding.** With the PM question answered, exactly one refusal remains and it is the
missing Enhancer pass. Everything else the gate inspects is green: `AUDIT-app-v86-delta3.md` is
accepted as the current clearing audit, the two earlier DO-NOT-SHIP reports are correctly recognised
as superseded, `v76-properties-equivalence` and `v76-empty-window-render` are green, and the
no-other-patient check is clean. The informational note about `AUDIT-app-v86-delta.md` being stale
(`examined 0f73911; changed since: index.html`) is correct and expected — it is superseded history.

---

## 8. The three pre-existing reds — I checked all three, not one

The brief asked for one spot-check. I ran all three on this build and on app-v85 (`87d1784`,
extracted to a scratch directory and served on its own port), and the failure text is **identical**
on both:

| Suite | app-v86 (`3c167cb`) | app-v85 (`87d1784`) | Same? |
|---|---|---|---|
| `v57-search` | FAIL *every "litre" in the shipped bytes is accounted for* — `3 in the file, 1 in parsed keyword arrays`; 53/53 exact | identical, same numbers | yes |
| `v84-whatsnew` | **95/96**, FAIL *precondition: the field is below the fold* — `top=836 in a 844px viewport` | identical, same pixel figure | yes |
| `v71-report-controls` | aborts: `Error: modal did not close after Confirm at: para-add` | identical abort, same line | yes |

**None of the three is caused by this release.** The record is accurate, and the README row names
all three with their reasons — the first audit's F11 asked for `v57-search` to be added and it was.

Two of them deserve a word for Aaron rather than a tick: `v84-whatsnew`'s red is a *precondition*
failing by 8 pixels, which means the assertion underneath it has not actually been exercised on any
recent release; and `v71-report-controls` **aborts** rather than fails, so every check after
`para-add` has not run either. Those are not "two known reds" — they are two suites quietly covering
less than their names suggest. Both belong in `BACKLOG.md` with that wording. Neither blocks v86.

---

## 9. The three follow-ups the last audit did not block on

**(a) The in-app History timeline shows a corrected answer and the one it replaced as two unmarked
rows at the same minute. — I agree it can ship as a follow-up, and it should be first in the queue.**
Nothing untrue is printed: the changelog scopes its marking claim to the export and the printed
report, both of which do mark it, and the Reports screen states the current value. But the day
summary says **"1 BM"** directly above **two** bowel rows, which is one screen disagreeing with
itself. No data is at risk and no clinician-facing surface is wrong, so it does not hold a release —
but it is exactly the shape of thing Aaron finds in a testing pass, and this release just made
correcting an answer an ordinary thing to do.

**(b) `isSupersededEntry` is quadratic over the export. — Agreed, ships as a follow-up.** Measured
by the auditor at +44ms over 2,190 entries, +318ms at 6,570, +1,232ms at 13,140 on desktop
Chromium. 2,190 entries is roughly two years of three logs a day; 13,140 is over a decade. The
function is correct, the cost is invisible at any size a real user will reach soon, and a per-day
index makes it linear whenever someone is next in that file. Worth doing before the export grows,
not worth doing now.

**(c) `bowelBannerInput` clearing is uncovered. — Agreed, ships as a follow-up.** I read the path:
`setState({ bowelBannerInput: undefined })` sits inside the `try`, **after** the awaited write, so a
failed write correctly leaves the caregiver's selection in the box under *"Could not save — please
try again"*. The behaviour is right; it is the test coverage that is missing. Low value, and adding
a check for it should not delay anything.

I would add a fourth to that list, from the Enhancer gap in section 1: **a past day can still only
be deleted, not corrected.** That one is a proposal for Aaron to size, not a defect to fix quietly.

---

## 10. The summary Aaron receives

> **ChemoWell app-v86 is built, checked and not yet shipped. One step of our own process was
> skipped and I am not signing it off until that step is run — it is a review pass, not a code
> change, so nothing you can see has to move.**
>
> **What is in it.** Four things from your testing pass, plus one we found beside them.
> Bowel movement and appetite can now be logged from their own Reports screens at any hour —
> before, the only way in was the evening check-in card, so there was genuinely no door before 7pm.
> Picking a different answer replaces today's and keeps the old one in your records; the exported
> file and the printed report mark the replaced one as corrected, so a nurse reading two answers for
> one day can tell which stands. History no longer calls blood-pressure readings, symptoms and
> paracentesis "doses" — each is named for what it is. The daily milligram total no longer carries
> one painkiller's abbreviation over a different drug. You can rename the profile you are in, from
> Settings, which the Account screen had been promising since before it existed — and a one-profile
> phone now shows a control at all. Snooze says it is fifteen minutes, on the button and again when
> you tap it.
>
> **What is not in it, deliberately.** The eight items you queued, including your Monday decision
> that backup saving stays free and restore goes to Plus. I read the whole change line by line to
> confirm none of them leaked in early. None did.
>
> **What is deliberately exempt.** Everything was checked in Chromium on a simulated phone screen.
> There is no iPhone here, so Safari rendering is untested, and nothing in this release has been on
> a real phone. That is a gap we cannot close from this side and I would rather name it than let it
> pass as checked.
>
> **What needs your phone.** Once it is live: log a bowel movement from the Reports screen in the
> morning, pick a different answer, and confirm the Reports screen shows the new one. Open Settings
> and rename yourself. Tap Snooze on the Up Next card and read the message.
>
> **What is outstanding.** The one blocker: the "does this screen make sense" review pass never ran
> on the four screens this release changed, and our own release gate refuses the push because of it.
> I will not wave that through, partly on principle and partly because reading those screens myself
> turned up two things it would have raised — correcting a *past* day's answer still means deleting
> it and starting over, and the bowel-issue banner cannot record "Loose" even though the app has
> that option everywhere else. Neither is dangerous. Both are decisions for you, not for me.
> Separately, your twelve items from Thursday are written down only inside the changelog entry and
> not in the request list, which is the "filed where you do not read it" problem again; they go into
> `REQUESTS.md` before the next release.
>
> **How much to trust this one, honestly.** Four audit rounds happened, and every single round found
> at least one check that *could not fail* — a test that would have gone on passing no matter how
> badly the thing it named was broken. That is the opposite of reassuring about our tests and
> genuinely reassuring about this release: it means each round was aimed at the last round's blind
> spot and kept finding one, and it means the green ticks you are being shown now were earned by
> something trying hard to make them go red. I broke six things in the code myself and watched the
> tests catch all six. **What it should make you cautious about is a count** — "86 checks passed"
> says less than it sounds like, which is why this release's record replaced its mutant count with
> the direction instead of the number.

---

## What must change before I will sign this

1. **Run the Enhancer seat on the four screens this release touches** — the Bowel Movement report,
   the Appetite report, the History day summary, and the Settings profile row — and commit
   `outputs/ENHANCER-app-v86.md`. Rule 2.6 allows a short, explicit "nothing this time"; what it
   does not allow is silence. The two gaps in section 1 are a free starting point and should be
   proposed with a size and a recommendation, not built.
2. **Re-run `./release_check.sh`** and confirm the only remaining output is `✅ Release check
   passed.`
3. **Then re-run this desk.** The re-check is a delta: the Enhancer pass plus a confirmation that
   `index.html` and `sw.js` have not moved. If they have not, everything in sections 2 through 8 of
   this report still stands and does not need re-deriving.

Not blocking, but to be done in the same push or logged where Aaron will see it: the eight queued
items into `REQUESTS.md`; the "seven items and four polish items" arithmetic in the README row;
`BACKLOG.md` lines for the `v84-whatsnew` precondition, the `v71-report-controls` abort, and the
pre-existing `weight`-id collision.

---

## What I did not do

- **I did not re-run the Designer's eighteen measurements.** I confirmed the PNGs exist, are real
  images of the right screens at the right widths, and that two of them show the copy this report
  quotes.
- **I did not re-derive the quadratic timing figures** in section 9(b). I read the code path,
  confirmed the shape is O(n) per row over n rows, and judged the auditor's measurements plausible
  and the conclusion sound.
- **I did not test on a real device.** There is none here. Said out loud rather than skipped.
- **I changed nothing in the repository except adding this file.** Every mutation was applied in
  place and restored from a byte copy taken beforehand, with `md5sum -c` confirming
  `index.html: OK` after each of the six. The gate probe ran in a throwaway clone in my session
  scratchpad.
