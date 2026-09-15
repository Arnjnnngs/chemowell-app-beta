AUDITED-COMMIT: 3ec6b4c
VERDICT: DO NOT SHIP

# PM sign-off — ChemoWell app-v83 + app-v84

**The verdict in the words this desk was asked for is BLOCKED.** The header above says
`DO NOT SHIP` because that is the only refusal token `release_check.sh` can parse
(`report_verdict()` matches `^VERDICT:\s*(DO NOT SHIP|SHIP)\s*$`, anchored). A file saying
`VERDICT: BLOCKED` is read as *unreadable*, and this gate's own comments record twice that
"the gate cannot read this" silently became "this raises no objection". BLOCKED and
DO NOT SHIP mean the same thing here.

**HEADLINE: the code is in good shape and the record is not, and the gate refuses on three
things, none of which is a defect in the app.** Every suite I ran is green and every
behavioural claim I could measure in the code is true. What is wrong is the paperwork the
release rests on: the README row for app-v84 is a snapshot of an intermediate commit
presented as the record of the release, the independent audit has never seen the commit
being shipped, and the Enhancer and Designer seats have no pass on file for a release that
redesigned three screens. All three are hours of work, not days, and none requires touching
the app.

| # | App | Item | Status |
|---|---|---|---|
| 1 | ChemoWell app | Run `./release_check.sh` and report it verbatim | DONE |
| 2 | ChemoWell app | Version mechanics — APP_VERSION vs sw.js CACHE | DONE — both moved |
| 3 | ChemoWell app | Re-run all four suites and check every N/N claim | DONE — 3 false figures found |
| 4 | ChemoWell app | Reproducibility from base + harness scripts | DONE — app-v84 is NOT reproducible |
| 5 | ChemoWell app | Real-phone checklist for Aaron | DONE — below |
| 6 | ChemoWell app | BACKLOG deferrals confirmed | DONE — both logged, both agreed |
| 7 | ChemoWell app | README app-v84 row: cache key, suite figures, last three commits | BLOCKED — needs the builder |
| 8 | ChemoWell app | Independent audit of 3ec6b4c (delta pass) | BLOCKED — needs the Auditor |
| 9 | ChemoWell app | ENHANCER + DESIGN passes for app-v84 | BLOCKED — needs those seats |

---

## 1. THE GATE. `./release_check.sh` → **exit 1**

Run at HEAD `3ec6b4c`, working tree clean apart from this file (`outputs/` is not a rule-5
path, so it does not dirty the gate). Output verbatim, with a PM file present so the gate
ran past its missing-PM branch:

```
ℹ️  Suites will run against a clean export of HEAD at /tmp/tmp.F6kaI4FNu1
   (not the working tree -- see the app-v82 note above).
ℹ️  Baseline: PUBLISHED.json -> app-v80 (chemowell-app-v80-2) at 048c1ff
   24 commit(s) have changed index.html since that record. This gate assumes NONE of
   them are live yet. If any were already pushed, run ./mark_published.sh <that commit>
   first -- otherwise the comparison below is against the wrong build.
❌ RELEASE CHECK FAILED: README.md's app-v84 row does not mention the cache key that
   is actually about to ship (chemowell-app-v84-6). It says:
     chemowell-app-v84-2
   Fix the row. A version-history entry wrong about the one fact it exists to record is
   worse than no entry, because it will be believed.
❌ RELEASE CHECK FAILED: the design-time seats have not run for app-v84.
   missing: an outputs/ENHANCER*app-v84*.md pass
   missing: an outputs/DESIGN*app-v84*.md pass
   These run BEFORE the build, on the screens about to change (TEAM-ORDER.md).
   An Enhancer pass that found nothing is written down as 'nothing this time' and still
   counts. Silence does not -- that is the failure this gate exists for.
❌ RELEASE CHECK FAILED: no CURRENT chain report for app-v84.
   Finding a filename is not reading a report. app-v68 was gated by an audit of 51ba75f
   while the head being shipped was 68d3dd6 — 67 further lines of index.html, a rewritten
   treatmentActiveOn among them, that no auditor had ever seen. The report was NAMED for
   v68, and the name was all this gate checked.
   missing: a CURRENT outputs/AUDIT*app-v84* report saying VERDICT: SHIP
   Reports found, and why each is not current:
     outputs/AUDIT-app-v84.md — examined 5600b92; changed since: index.html sw.js
   Re-run that stage against the current tree, or drop the unaudited work to a later
   version. Code that ships must be code someone read.
=== EXIT: 1 ===
```

**Warnings: none beyond the baseline note quoted above.** That note matters on its own: the
live build is **app-v80**, so this push delivers **four** versions at once (v81, v82, v83,
v84) to every installed phone. Nobody has ever seen v81–v83 on a real device.

**The gate exits at the chain gate, so its own suite block never ran.** It never reached
`test/v76-properties-equivalence.mjs`, `test/v76-empty-window-render.mjs` or the
no-other-patient check. I ran the no-other-patient check by hand (below); the two v76 suites
I did **not** run — see section 7.

**I did not interpret around any of this.** Three refusals, one verdict: BLOCKED.

## 2. VERSION MECHANICS — correct

| | Value |
|---|---|
| `APP_VERSION` in `index.html` | **`app-v84`** |
| `CACHE` in `sw.js` | **`chemowell-app-v84-6`** |
| Live now (`PUBLISHED.json`) | `app-v80` / `chemowell-app-v80-2` at `048c1ff` |

They moved together, and the value has never been served before — I traced every `CACHE`
value on this branch (`v81-1`, `v81-2`, `v81-3`, `v82-1`, `v83-1`, `v84-1` … `v84-6`) and
`chemowell-app-v84-6` appears only at HEAD. The silent-stale-shell failure this gate exists
for is **not** present.

One thing the record implies and reality does not: the README gives app-v83 its own cache
key, `chemowell-app-v83-1`. **No phone will ever be served it.** v83 and v84 ship in one
upload and only `chemowell-app-v84-6` is published. That is not a defect, but the version
history reads as four separate releases that each reached users, and none of the four has.

## 3. DOES THE RECORD MATCH THE CODE? — three false figures, and one whole day of work missing

This is where the release is weakest. Every suite below was run by me at HEAD, over HTTP on
127.0.0.1:8899, proxy unset.

| Suite | README app-v84 row claims | **Measured at HEAD** |
|---|---|---|
| `test/v84-whatsnew.mjs` | **30/30** | **50 checks: 50 passed, 0 failed** |
| `test/v83-meds-and-reports.mjs` | **56/56** | **80 checks: 80 passed, 0 failed** |
| `test/v80-up-next.mjs` | not claimed | **48/48 passed** |
| `test/v75-no-other-patient.mjs` | not claimed | **27/27 passed** |
| `sw.js` CACHE | **`chemowell-app-v84-2`** | **`chemowell-app-v84-6`** |

**All three claimed figures were true at commit `e5dfce4` and were never updated again**,
through four further commits that each added checks and each bumped the cache. The row is a
photograph of the middle of the release with the release's name on it. The commit messages,
by contrast, are honest: `3ec6b4c` states `50/50`, `80/80`, `48/48`, `27/27` and
`CACHE -> chemowell-app-v84-6`, and every one of those matches what I measured. **The defect
is in the README, not in the work.**

The app-v83 row claims `test/v83-meds-and-reports.mjs` **45/45** for the same suite that the
v84 row calls 56/56 and that actually reports 80/80. Read together, the version history gives
three different sizes for one suite and the one describing the shipping build is the most
wrong.

### The bigger omission: the last three commits are not in the record at all

The app-v84 row records the first five audit refusals in detail and stops. It says nothing
about:

- **`1c50c87` — the new scroll lock froze the first-run guide**, a regression this release
  introduced and then fixed. The row describes the scroll lock as a clean win.
- **`5600b92` — the guard written for that regression only watched the first frame of it**,
  so the check written for the exact bug could not see it.
- **`3ec6b4c` — typing in any form yanked the page back up, on every screen.** Measured in
  the commit: scrollY 1543 → 679 with "Add medication" stranded at 1519 in an 844px
  viewport. This is arguably the most user-visible fix in the release — it is what makes the
  first-run guide's own instruction followable — and the version history does not mention it.

So the answer to "does the README describe what shipped, including the audit refusals, or
only what was intended?" is: **it describes what was intended plus five of the refusals, and
then stops one day short of the build.**

### The claim of this shape I went looking for, and found

The row asserts: *"Every past release is under **What's new** in the menu."* **False.**
`CHANGELOG` at `index.html:8921` holds **five** entries (app-v80 … app-v84) for an
eighty-four-release app. This is the same claim the audit already made the team remove from
the modal copy — the entry text now correctly reads *"Updates from here on are listed under
'What's new'"* — and the README kept the false version. **And two strings inside the app
still make it:** `index.html:4447` (`helper: 'Every update, newest first'`) and the What's
new screen header at `index.html:9002` (`'Every update to ChemoWell, newest first.'`). The
fix landed on one of three surfaces. It is low-harm — nobody is dosed off a changelog header
— but it is exactly the shape the caller asked me to hunt, and the Voice's first question is
"is it true?", not "is it nearly true?".

### Claims I checked and found TRUE

- *"the whole hook block now runs LAST in the module"* — it does; the debug hooks sit at
  `index.html:12593–12613`, the last statements before `</script>` at 12620.
- *"`position: fixed` rather than `overflow: hidden` … the reader's scroll position is
  restored on release"* — `applyScrollLock()` at 1831–1846 does exactly that.
- *"The marker is per device, not per profile"* — `WHATS_NEW_KEY` is a single
  `localStorage` key (8958–8961), no profile in it.
- *"A fresh install is not an update … stamped silently"* — `deviceHasPriorChemoWellData()`
  (8968) distinguishes the two and `whatsNewShouldShow()` stamps either way.
- *"the ceiling bar … `dailyCeiling` already computed the correct label, carrying the
  '/ 4h'"* — `dailyCeiling()` (2123–2142) returns the label per branch and `medCeilingBar()`
  (8252) reads it.
- app-v83's *"amber at 100.4 °F and red at 103 °F … 38.0 and 39.4 in Celsius"* —
  `tempFever()`/`tempHigh()` at 1928–1929, exactly those numbers.
- The withdrawn splash claim is **not** in the README. It survives only inside the body of
  commit `1c50c87`, and `5600b92` and the audit both record the withdrawal. Nothing further
  to do.

Trivial, noted and not blocking: the row opens with *"eighty-three releases"* and later says
*"84-release app"*.

## 4. REPRODUCIBILITY — **app-v83 yes, app-v84 no**

Measured, not assumed. I rebuilt in a scratch directory; the working tree was not touched.

**app-v83 reproduces.** Taking `index.html` at `ede9667` (the commit before app-v83) and
applying `harness-v84-meds-card.py`, `harness-v85-temperature-report.py` and
`harness-v86-symptom-bars.py` produces a file that differs from the committed app-v83
(`aaeca4f`) by **two lines**: the `APP_VERSION` literal, and one debug hook
(`window.__tempTest`) that was added to the script later by `adfc99c`. That is a genuine
reproducible release.

**app-v84 does not reproduce, for two independent reasons.**

1. **`harness-v84-whatsnew.py` is not valid Python and has never run in its committed
   form.** `python3 -c "ast.parse(...)"` → `SyntaxError: unterminated string literal
   (detected at line 233)`. A multi-line JavaScript replacement string at lines 233–239 was
   written with single quotes instead of a triple-quoted string. The other three scripts
   parse and run. **The What's New notice — the whole point of app-v84 — cannot be rebuilt
   from the repo at all.**
2. **Everything after the patches was hand-edited into `index.html`.** `e5dfce4` (+174/−?),
   `6d7280a` (168), `1c50c87` (42), `5600b92` (18) and `3ec6b4c` (13) changed `index.html`
   directly with no corresponding script. Between app-v83 and HEAD, `index.html` moved by
   **436 insertions and 37 deletions** that no harness script accounts for.

So: **app-v84 is rebuildable only from git, not from base + scripts.** Rule 0's
"reproducible from the repo alone" is satisfied by the commit history and not by the
harness. I am recording it as a finding rather than letting it pass. It is not by itself a
reason to hold the release — the git history is real and the audit read the file, not the
scripts — but the broken script is one quoting fix away from being true again and should be
fixed before anyone believes the scripts are the record.

## 5. WHAT NEEDS A REAL PHONE

**Standing exemption: this sandbox has Chromium only. An iPhone's rendering, its momentum
scrolling and its treatment of `position: fixed` on `<body>` cannot be reproduced here.**
That matters more than usual this time: the new scroll lock was written `position: fixed`
*specifically because iOS ignores `overflow: hidden`*, and the auditor measured that
Playwright's click scrolls straight through a freeze a real thumb cannot. **The two riskiest
things in this release are both things only a finger can test.**

Aaron — open the app on the real phone and do these, in this order. Roughly ten minutes.

1. **Open the app for the first time after this update.** A short note should appear saying
   what changed. Read it. Tap **Got it**. It should not come back — close the app, reopen
   it, and confirm it stays gone.
2. **Press the phone's Back gesture while that note is open** (before tapping Got it, on a
   second device or after clearing the app). It should close the note, not leave the app.
3. **While the note is open, try to scroll the page behind it with your thumb.** Nothing
   behind it should move. This is the one that cannot be tested here.
4. **Go through the first-run guide as a brand-new user would** — this is the highest-risk
   path in the release. Let it lead you to **Add medication**, fill the form in, and
   **scroll down with your thumb to the "Add medication" button at the bottom**. Keep
   typing in a field first, then scroll. **The page must not jump back up to the field you
   typed in.** That was the bug fixed last night and it is the reason a new user could not
   finish adding their first medication.
5. **In the medication editor, check the page still scrolls** while the guide's card is on
   screen, and that you can reach the Save/Add button at the bottom every time.
6. **Meds screen** — open a medication card. Check the status pill (Available / Wait 2h 10m
   / Daily limit reached) says the same thing the Home screen says about that medication,
   and that the ceiling bar reads sensibly: if the limit is a rolling one it should say
   something like *3,000 mg / 4h*, not a plain daily figure.
7. **Reports → Temperature** — log a reading, look at the chart. The fever line should sit
   at 100.4 (or 38.0 in Celsius) and the heading must not claim "last 4 weeks" over readings
   that are older than that. If there is nothing in the window it should say so and name the
   date of the last reading.
8. **Symptoms** — tap a bar. The list underneath must show exactly the number of rows the bar
   claimed. Press Back once; the filter should clear without leaving the screen.
9. **Meds screen, the little up/down arrows that reorder cards** — see whether you can hit
   the one you mean on the first try. They are 40×40 where the app's floor is 44 (item 6
   below); your thumb is the only measurement that matters.
10. **Anything with a pop-up open** — menu drawer, help topic, the update note — try to
    scroll behind it. Nothing should move except the thing you opened.

## 6. STILL OUTSTANDING — both BACKLOG items confirmed, and I agree with both deferrals

**`BACKLOG.md:515` — a grouped ceiling counts only one medication.** Logged with its
reachability stated plainly ("NOT reachable through the product today, which is the only
reason it is here rather than in the release"), with the trigger named: the release that
makes `ceilingGroup` settable must fix it in the same change. **I verified the
unreachability rather than taking it:** `ceilingGroup` appears eleven times in `index.html`
and every one is a read — `med.ceilingGroup`, `m.ceilingGroup === …` — with no assignment
anywhere and nothing in the medication editor that writes it. Same for `rollingCeilingH`.
**Deferrable: agreed.** A wrong number nobody can be shown is a latent bug, not a live one.

**`BACKLOG.md:534` — the Meds reorder arrows are 40×40 under the 44px floor.** Logged,
stated as pre-existing and width-independent, with the reason it was logged rather than
fixed ("so it is a deliberate decision and not re-found by a third audit"). **Deferrable:
agreed, with a caveat** — it is pre-existing and harmless in the worst case (the cards end
up in the wrong order), and widening a touch target on a screen nobody audited this round is
its own risk. It belongs in the next release that touches the Meds screen, not this one.
Item 9 of the phone checklist is there so Aaron's own thumb, not my reading, decides how
urgent it is.

**And one I am adding, because it is not logged anywhere:** `harness-v84-whatsnew.py` does
not parse (section 4). Nothing in the repo records that, and the next person to trust the
harness will discover it the hard way.

## 7. WHAT I DID NOT CHECK

Stated plainly rather than implied away.

- **I did not re-derive the Zero Day Auditor's twelve findings.** That was explicitly not
  this desk's job. I confirmed the fixes are present in the file for the four I could check
  cheaply (the ceiling label, the temperature window, the symptom-bar window, the scroll
  lock) and took the rest from the suites being green.
- **I did not run `test/v76-properties-equivalence.mjs` or `test/v76-empty-window-render.mjs`.**
  The gate runs both, and the gate exited before reaching them. Their status at HEAD is
  **unverified**.
- **I did not run any other suite in `test/`** — there are fifty-odd — nor `falsify.sh`, nor
  any mutation sweep. I did not falsify any of the four suites I ran; I observed them green
  and compared their totals to the record. A green suite I have not falsified is evidence,
  not proof.
- **I did not open the app in a browser myself.** Every behavioural statement above is from
  the four suites or from reading `index.html`.
- **I checked no rendering at any width.** No screenshots, no 320/360/390 pass. That is the
  Designer seat, and it has no pass on file for this release — which is one of the three
  things the gate is refusing on.
- **Nothing on a real device.** Section 5 is the list; none of it has been done.
- **I did not verify the app-v83 row's 45/45 against commit `aaeca4f`.** It may well have
  been true when written. What I verified is that neither 45 nor 56 is what the shipping
  build reports.

## 8. WHAT UNBLOCKS THIS

Three items, in this order, none of which touches the app's behaviour:

1. **Fix the app-v84 README row**: cache key `chemowell-app-v84-6`, suite figures 50/50 and
   80/80, the three missing commits (the guide freeze, the guard that watched one frame, the
   typing-scroll fix), and drop or qualify *"Every past release is under What's new"*. While
   there, the two in-app strings at `index.html:4447` and `:9002` make the same false claim.
2. **One Enhancer pass and one Designer pass on file for app-v84.** "Nothing this time"
   counts; silence does not.
3. **A delta audit of `3ec6b4c`** — thirteen lines in `render()`, one `focus({ preventScroll:
   true })`. It is a small pass, and it is the difference between shipping code someone read
   and shipping code nobody did. The gate's own scar tissue on this is app-v68.

When those three exist, re-run `./release_check.sh`. If it exits 0, this desk's objection is
answered and I will re-issue against the later commit.

---

*PM sign-off, ChemoWell app-v83 + app-v84. Measured at `3ec6b4c` on 2026-09-15. Working tree
untouched apart from this file.*


---

# CORRECTION APPENDED 2026-09-15 — ONE CLAIM IN SECTION 3 WAS FALSE

**This sign-off's body is left exactly as it was written.** A record that is quietly edited after the
fact is worse than one that is wrong, and the reasoning above is still the reasoning that was
applied. What follows is the correction, with the date, in the manner CLAUDE.md Rule 7 requires of
this project's other list of known things.

Section 3, under **"Claims I checked and found TRUE"**, includes:

> *"A fresh install is not an update … stamped silently"* — `deviceHasPriorChemoWellData()` (8968)
> distinguishes the two and `whatsNewShouldShow()` stamps either way.

**The second half is true and the first half was false.** `deviceHasPriorChemoWellData()` could only
ever return `true`: `initProfiles()` writes `chemowell-app-profiles-v1` at module evaluation, nine
thousand lines before that function asks whether any `chemowell-app` key exists, so the app was
always its own prior data. A brand-new phone WAS greeted with "here is what changed", on top of step
1 of the first-run guide.

It was checked by reading the function, which reads correctly in isolation. What it could not show
is what has already run by the time it is called. **Found by the sixth audit, which drove a wiped
phone through the real welcome screen instead.** Fixed by snapshotting the answer above the first
write; `test/v84-whatsnew.mjs` section 1 now walks that path, and mutant 17 forces the old behaviour
back and dies on it.

**Three other records carried the same claim** — `README.md`, the comment above the function itself,
and `outputs/DESIGN-app-v84.md` — and all three are corrected in place, because none of them is a
signed record of a decision the way this file is.
