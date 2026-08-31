# Zero Day Audit — treatment-date Help wording + hospital-stay layout
AUDITED-COMMIT: f5e5b2b6fd3f832c8dc86f3db36032a33f13fb06
VERDICT: DO NOT SHIP

## The headline, in plain words

**The two changes themselves are good. They are correct, they are proved, and the layout fix is
real — I reproduced both original bugs independently and watched both disappear. But this release
cannot go out as it stands, for two reasons that have nothing to do with the quality of the work.**

1. **The release has not been versioned.** The app still calls itself app-v68 and the service
   worker still uses the app-v68 cache name. The project's own pre-push gate refuses it. In plain
   terms: if this were uploaded now, **every phone that already has ChemoWell installed would keep
   showing the old version forever** — no error, no warning, nothing. That is the exact failure
   this project already suffered once (app-v40) and built the gate to make impossible.

2. **The next feature is already being built into the same file, and nothing separates the two.**
   While I was auditing, the app-v70 "remove one treatment date" work appeared in `index.html` —
   72 lines, now wired to a button, plus a new test suite and changes to the render scan. Because
   v69 was never given a version number of its own, there is no boundary in this tree between the
   finished v69 and the half-finished v70. An upload today would publish both, under the old name.

There is also **one real defect in the new Help text**: it tells the reader to tap a button called
**Update**, but in the very situation its own instructions create, that button is called
**Set date**. That is the same mistake a previous audit stopped this project for.

## Scope

The brief names branch `claude/hotfix-treatment-date-clear`. That branch is **stale** — it points
at `f64a54e`, an ancestor of `origin/main`. The work is on local `main`, two commits ahead:

      0f30949  The app and its own Help disagreed about treatment dates
      f5e5b2b  A hospital stay made the whole app scroll sideways

Diff `origin/main..HEAD`: README.md, index.html (+18/-6), test/overflow-scan.mjs,
test/v69-treatment-date-help.mjs (new).

---

## 1. Does anything change what the app DOES with treatment dates? No. Proved.

I extracted every function that touches treatment dates or hospital stays from `origin/main` and
from the audited head and compared them byte for byte:

      dayStart, nextChemoTs, chemoDayList, chemoOffsetSinceLast, chemoOffsetFor,
      treatmentActiveOn, chemoDayFor, zofranBlockingDay, clampTreatmentDays,
      normalizeMedication, setChemoDate, hasTreatmentDate, treatmentOnlyBlocks,
      treatmentExcludedNow, zofranBlockedOn, inpatientPeriods, inpatientStayDays,
      daysSinceInpatientStart

**All eighteen identical.** The three edits to `index.html` in these two commits are one Help
string and two CSS style properties. Nothing that decides when a medication appears, is withheld,
or is flagged missed was touched.

## 2. Is the new Help wording actually true?

I read the code rather than the commit message. Claim by claim:

| Help now says | Code | True? |
|---|---|---|
| a date is ADDED, not swapped | `chemoDayList()` pushes each date, dedupes by day | YES |
| both dates go on driving the rules | `treatmentActiveOn`/`zofranBlockedOn` test **every** date | YES |
| Clear removes **every** date | the tombstone (`ts: 0`) empties the list of everything before it | YES |
| a mistyped date keeps working — appears near the wrong day, and a withheld one stays withheld | `treatmentActiveOn` any-date; `treatmentExcludedNow` | YES |
| with no dates, a treatment-only med shows every day with an amber **No date set** label | `treatmentOnlyBlocks` returns false with no date; the amber line renders | YES |
| set dates after a Clear and they start from nothing | tombstone wipes only what precedes it | YES |

**The substance is right.** The defect is in the button names — see MAJOR-1.

---

## FINDINGS

### BLOCKER-1 — the release is not versioned; the gate refuses it (affects the app)

`./release_check.sh` exits **1** with three refusals, quoted exactly:

      RELEASE CHECK FAILED: index.html differs from the live build app-v68 (9885042), but sw.js's CACHE
         constant was not bumped. Anyone with the app already open or installed will
         NEVER see this update -- the service worker will keep serving the old cached
         copy indefinitely, with no error to signal it.
      RELEASE CHECK FAILED: CACHE 'chemowell-app-v68-1' is the value that is ALREADY LIVE
         (PUBLISHED.json).
      RELEASE CHECK FAILED: no CURRENT chain report for app-v68 ...
         missing: a CURRENT outputs/AUDIT*app-v68* report saying VERDICT: SHIP
         missing: a CURRENT outputs/PM*app-v68* sign-off saying VERDICT: SHIP

Confirmed by hand: `APP_VERSION = 'app-v68'` (index.html:6566) and `CACHE = 'chemowell-app-v68-1'`
(sw.js:1) are both unchanged, and `PUBLISHED.json` records app-v68 / chemowell-app-v68-1 as live.
The third refusal is a consequence of the first two: because nothing was renamed, the gate is
still asking for v68's paperwork.

This is not a formality. Every installed copy and the APK load the same cached shell, so an
unbumped cache means the patient's phone never sees the corrected Help text at all — the entire
point of the release.

### BLOCKER-2 — a whole NEXT feature is being built into this same tree, unversioned (affects the app)

`git status` was clean when I started (20:52). It did not stay that way. Timestamped, by me, as it
happened:

      20:58  index.html  +33 lines: a new `async function removeChemoDate(dayTs)` — no caller
      21:00  index.html  now +72 lines: removeChemoDate wired to a button (index.html:4891)
             test/overflow-scan.mjs  modified: a second treatment date seeded, new Home needle
             test/v70-remove-one-date.mjs  new suite

This is the **app-v70 "remove one treatment date" feature** — the very fix that commit 0f30949
says is "a real change to the logic driving every medication rule and needs its own release, not a
paragraph in a wording fix." It is being written into the same file, in the same working tree,
with no version boundary between it and v69.

That is the heart of the problem, and it is not "someone is working, how dare they":

**Because APP_VERSION and the sw.js CACHE were never bumped for v69, there is no point anywhere in
this tree where v69 exists as a shippable thing separate from in-progress v70.** They are one
untagged blob. And `release_check.sh` states plainly that it measures the working tree, not the
commit: *"index.html has uncommitted changes. They ARE included in the check below — this compares
the working tree against the published build, because the working tree is what a manual upload
actually publishes."*

So an upload done today would publish half of v70 under the name v68. I have deliberately **not**
reverted any of it — unpushed work in this sandbox is fragile and it is not mine to delete.

The clean route exists and is cheap: **version and ship the commit `f5e5b2b`, not the working
tree.** That commit contains only the two audited changes.

Forward-looking, for whoever audits v70 — one thing I noticed while confirming it was separate:
`removeChemoDate` appends the tombstone **first** and the surviving dates **after**, with no error
handling. If any append after the tombstone fails, the entire schedule is gone rather than one
date. That is the `confirmTimeAndLog()` shape already on this project's standing-exceptions list,
applied to the data driving every medication rule. Not my call to make here; flagging it so it is
not discovered live.

### MAJOR-1 — the corrected Help names a button that does not exist in the case it describes (affects the app)

The Treatment schedule card labels its button conditionally (index.html:4843):

      chemoTs ? 'Update' : 'Set date'

With no treatment date set, the button reads **Set date**.

The rewritten topic says, step 2: *"To add a treatment date: tap the date row, pick the day, tap
**Update**."* — wrong whenever no date is set.

Worse, step 3 says: *"tap **Clear** ... this removes **every** date ... then set the right dates
again."* Clearing empties the schedule, so `chemoTs` is null and the button is **Set date**. The
topic's own recovery path lands the reader on a button it has just called something else.

The sibling topic `treat-set-date` gets it right: *"Tap **Set date** (or **Update** if there was
already one)."* So the app already knows the correct wording, in the topic immediately above.

This is the same defect class as the v68 fifth audit ("I renamed a button and left Help naming the
old one") — reintroduced by the commit whose entire purpose is making Help agree with the app. The
new gate cannot see it: `v69-treatment-date-help.mjs` checks for "ADDED", "both stay", "removes
**every** date" and the absence of "replaces the old one". Nothing checks a button name.

Fix is one line of prose: *"tap **Set date** (or **Update** if there is already one)"*, matching
`treat-set-date`, plus a gate check tying the topic's button names to the two literals in the
render code.

### MINOR-1 — "tap it again to confirm" is not what the Clear control does (affects the app; pre-existing wording carried forward)

Step 3 says *"tap **Clear** in the top right, tap it again to confirm."* In the code
(index.html:4828-4831) the first tap **replaces** Clear with two different buttons — **Confirm
clear** (red) and **Keep** — and a 6-second timer silently reverts it. The reader is told to tap
the same button twice; they must find a differently-named one, and they have six seconds.

This sentence was carried over unchanged from the text being corrected. It is minor, but this
release is specifically about the topic telling the truth.

### MINOR-2 — one of the nine new checks does not guard what its name claims (harness only)

`test/v69-treatment-date-help.mjs`:

      t('it warns that a mistyped date keeps driving the rules',
        /mistyped date keeps working|both stay/i.test(topic), '');

I deleted the entire warning STEP from Help — the sentence that tells a caregiver a mistyped date
is still being applied — and the suite reported **9/9, exit 0**. The `|both stay` alternative
matched the answer paragraph instead. Deleting both phrasings does turn it red (8/9), so the check
can fail; but the step it is named for is unpinned and can be removed silently.

### MAJOR-2 — the new fixture swaps coverage rather than adding it (harness only)

Seeding an open stay is right, and it found two real bugs. But `overflow-scan.mjs` has **one**
fixture, and the stay it seeds never ends. So the states that used to be scanned are now scanned
nowhere:

- In-Patient with **no** stay — the **Log In-Patient Start** button, and the "No in-patient stays
  logged yet." empty-state card.
- The stats row's `periods.length ? ... : null` empty branch.
- Home **without** the In-Patient banner.
- An active stay suppresses missed-dose flags from the moment of admission (`v67-inpatient-window`
  asserts exactly that), so whatever missed-dose UI Home used to draw is now at least partly
  suppressed at every width.

The needle was also loosened from `'Log In-Patient Start'` to `'Log In-Patient'`. That was
necessary, but it now matches either state, so a screen that lost the Start button entirely would
still count as reached. The honest fix is a second pass over the same widths with the stay closed
— not a different fixture replacing the old one.

### MINOR-3 — the README's falsification claim understates what was actually proved (docs only)

README.md says: *"Falsified: both levers reverted → the page-width finding returns."* The commit
message says the opposite and stronger thing — that the wrap is the single load-bearing change and
*is* provable on its own. I ran it: reverting the wrap **alone** turns the scan red with
`app needs 324px on a 320px screen`. The README sentence is stale relative to the final state and
sells the work short. Two smaller nits in the same paragraph: the tile overflow reaches **393px**,
not "320 to 390"; and the fixed pixel figures quoted ("34px usable", "TOTAL needs 36px") do not
match what I measured on the pre-fix build (TOTAL needs 42px in a 40px box; LONGEST needs 61px).
Same conclusion, different measuring basis — worth reconciling so a future reader is not chasing
numbers that never reproduce.

### NOTE — "the two layout fixes were reduced to ONE load-bearing change each"

True for the banner: `flexWrap: 'wrap'` is the only change, and the button was deliberately left
exactly as it was. Verified.

Not true for the tiles: there are **two** changes — the tile's `flex` basis
(`1` -> `1 1 calc(50% - 4px)`) **and** `flexWrap: 'wrap'` on the row. I falsified each separately
(R3, R4) and **both turn the scan red on their own**, so both are load-bearing and neither is
redundant. The reasoning behind the rule therefore holds — the thing being avoided was two
*sufficient* fixes that mask each other, and these two are jointly *necessary*, which is the
opposite. The wording "ONE load-bearing change each" is simply inaccurate for the tiles; the
property that mattered is intact.

### NOTE — a 5px overhang on the In-Patient header at 320px that is NOT a defect

My own probe flagged the "?" help button ending 5px past its header row at 320px. I chased it: the
button is a 44px iOS touch target, and `overflow-scan.mjs` **deliberately** exempts that class
(*"a 44x44 close button overhanging a 39px header slot is deliberate iOS touch sizing, not a
defect"*). It is present identically before and after this release. Recording it so the next
auditor does not re-raise it.

### NOTE — two latent, pre-existing quirks, unchanged by this release

- `hasTreatmentDate()` reads `nextChemoTs()` (highest `loggedAt`), while `chemoDayList()` sorts by
  `loggedAt || ts || 0`. A `chemo_date` row with no `loggedAt` makes them disagree: the card would
  say "No treatment date set" and hide Clear while the date still drives every medication rule.
  Not reachable from the app — both writers always set `loggedAt` — but it is reachable by an
  import or a restore that drops the field.
- The **This year** tile counts a stay by its START year, so a stay running 28 Dec to 4 Jan is
  never counted in the new year. Confirmed with a seeded year-crossing stay.

---

## Is "the behaviour is right, only the words were wrong" defensible? Yes — and it should not wait.

A user who mistypes a date still cannot remove just that one; Clear is all-or-nothing. The release
calls that a separate, larger fix. I agree, and I would ship the words now rather than hold them:

- The old sentence was **actively harmful**. It told a caregiver that setting the right date undid
  the wrong one. Believing that, they stop looking — while an excluded medication goes on being
  withheld around a day that never existed.
- The wording change carries **zero behavioural risk**; I proved the logic is byte-identical.
- Multiple treatment dates are deliberate and correct — a course has several.

Holding honest words hostage to a bigger fix leaves a false instruction live on a patient's phone.
Ship the truth now; ship the removal separately, with its own audit. That the removal is *already
being written into this same file* (BLOCKER-2) is exactly why it must be kept separate.

---

## Test results — every suite, real numbers

      env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy node <file>

| Suite | Result | Exit |
|---|---|---|
| test/v67-chemo-offset.mjs | 26/26 checks passed | 0 |
| test/v67-inpatient-window.mjs | 10/10 checks passed | 0 |
| test/v67-medflag-backfill.mjs | 4/4 checks passed | 0 |
| test/v68-treatment-clamp.mjs | PASS 28  FAIL 0 | 0 |
| test/v69-treatment-date-help.mjs | 9/9 checks passed | 0 |
| test/overflow-scan.mjs | 140 of 140 scanned, 0 overflowing — CLEAN | 0 |
| (5 further scan runs, falsification) | see the table above | 1 / 1 / 1 / 0 / 0 |
| ./release_check.sh | **3 refusals** | **1** |

Every suite started, printed named assertions, and reported a real count. None was a silent
no-op.

---

## Falsification — every check broken on purpose, and watched

Sabotages were applied to **copies** in a scratch directory, never to the repo. Each was verified
to have actually applied before the suite ran, because a sabotage that silently fails to apply
produces a green that proves nothing — a trap this project hit twice this week.

### The new Help suite (`v69-treatment-date-help.mjs`)

| # | Sabotage | Result | Which checks fired |
|---|---|---|---|
| F1 | Put the false sentence "Setting a new date replaces the old one" back | **7/9, exit 1** | "does NOT claim a new date replaces the old one"; "says a date is ADDED" |
| F2 | Made `chemoDayList()` genuinely REPLACE (`days = [dayStart(e.ts)]`) | **7/9, exit 1** | "BOTH dates are in the schedule"; "the mistyped date is still there" |
| F3 | Made the tombstone a no-op (removed `days = []`) | **7/9, exit 1** | "a clear empties the whole schedule"; "dates set afterwards start from nothing" |
| F4 | Removed "removes **every** date, not just the wrong one" | **8/9, exit 1** | "it names Clear as removing EVERY date" |
| F5 | Removed the whole mistyped-date warning STEP | **9/9, exit 0 — STAYED GREEN** | none — see MINOR-2 |
| F6 | Removed the warning step **and** "both stay…" from the answer | **8/9, exit 1** | "it warns that a mistyped date keeps driving the rules" |

F5 is the finding. The sabotage definitely applied (asserted before running); the check survived
because of the `|both stay` alternative. F6 proves the check is not inert.

The suite genuinely pins **both halves** — the words (F1, F4, F6) and the behaviour (F2, F3) — which
was the stated design goal.

### The render scan (`overflow-scan.mjs`), 140 combinations per run

| # | What was run | Result |
|---|---|---|
| B | audited head, unmodified | **140/140, 0 overflowing, CLEAN, exit 0** |
| R1 | the NEW scan (open stay seeded) against the PRE-FIX app | **10 overflowing, NOT CLEAN, exit 1** |
| R2 | fixed app, banner `flexWrap` reverted **alone** | **1 overflowing, NOT CLEAN, exit 1** |
| R3 | fixed app, tile `flex` basis reverted to `'1'` **alone** | **9 overflowing, NOT CLEAN, exit 1** |
| R4 | fixed app, stats-row `flexWrap` removed **alone** | **9 overflowing, NOT CLEAN, exit 1** |
| R5 | the OLD scan (no stay seeded) against the PRE-FIX app | **0 overflowing, CLEAN, exit 0** |
| R6 | the NO-STAY fixture against the FIXED app | **0 overflowing, CLEAN, exit 0** |

Every run scanned all 140 combinations — none bailed early, so none of these greens is a run that
did not happen.

**R1 vs R5 is the important pair.** Same broken app. The old fixture calls it clean; the new one
finds ten problems. That is direct proof the seeded stay is load-bearing and that the previous ten
"clean" In-Patient runs meant nothing. R1 caught exactly what was claimed:

      THE PAGE ITSELF IS WIDER THAN THE PHONE   (Home, 320px)
      "Longest"  the wording is wider than the box it sits in by 19px  (320px)
      ... and at 330, 345, 360, 375, 384, 390, 393 — eight widths, as stated

**R2 confirms the banner claim.** With everything else fixed and only the row's `flexWrap` taken
away, the scan reports:

      app needs 324px on a 320px screen — it will scroll sideways by 4px

That is the original defect, exactly, and it proves the wrap is falsifiable **on its own** — which
is precisely what the commit set out to demonstrate when it reverted its second, redundant fix.

**R3 and R4 settle the tile fix.** Reverting *either* of its two changes alone turns the scan red
with the same nine findings, and neither produces the page-width finding — so the tile fix and the
banner fix are cleanly separated, and each half of the tile fix is independently provable:

      "Longest"     the wording is wider than the box it sits in by 19px (320px), 17px (330), 13px (345), 9px (360), 5px (375) ...
      "Total days"  content wider than its box by 2px (320px)

**R6 closes the coverage question in MAJOR-2 honestly.** Running the no-stay fixture against the
FIXED app comes back clean at all 140 combinations. So the states the new fixture stopped covering
do not currently hide a defect — the gap is a gap in the gate, not a live bug.

## An independent probe, not reusing the project's own scan

Because a gate can only find what it was written to look for, I wrote a separate probe with a
different rule (element-versus-viewport and content-versus-box) and a harsher fixture than the
scan's: **seven hospital stays**, one crossing New Year, one running three years so **Total days
= 1127** and **Longest = 1097d** (four digits), plus a long medication name
("Pegfilgrastim-cbqv Biosimilar Injection") on Home.

On the **pre-fix** build it independently reproduced both defects without being told about them:

      PAGE WIDER THAN PHONE  home @320px: doc=324 inner=324
      <BUTTON> "Log In-Patient End"  past=4
      tiles @320px: Total days(box40/need42 OVER) Longest(box40/need61 OVER)
      Longest OVER at 320, 330, 345, 360, 375, 384, 390, 393

On the **fixed** build, at all ten widths:

      tiles @320px: Stays(box114/need114) Total days(box114/need114) Longest(box114/need114) This year(box114/need114)
      ... box == need at every width up to 428

**The tiles hold with four-digit values, seven stays, and a year-crossing stay.** Home with the
banner and a long medication name is clean at every width. I could not find a width or state where
either fix fails.

---

## What would make this shippable

In order, smallest first. None of it is large.

1. **Fix the button name in the Help topic** (MAJOR-1). One sentence, copied from the topic
   directly above it: *"tap **Set date** (or **Update** if there is already one)"*. While in there,
   correct *"tap it again to confirm"* to name the **Confirm clear** button (MINOR-1).
2. **Add a gate check that ties the topic's button names to the render code.** The two literals
   `'Update'` and `'Set date'` are three lines apart in `index.html`; assert the topic names both,
   the same way the suite already asserts it names Clear. Without this the fix cannot be defended
   next release, which is how this defect got here.
3. **Tighten the alternation in the warning check** (MINOR-2) so the step is pinned separately from
   the answer.
4. **Version the release.** Bump `APP_VERSION` and the `sw.js` `CACHE` together, then re-run
   `./release_check.sh` until it exits 0. Nothing ships before it does.
5. **Publish from the commit, not the working tree** (BLOCKER-2) — the v70 work must not travel
   with this.
6. **Add the second render-scan pass with the stay closed** (MAJOR-2), so the fixture adds a state
   instead of trading one for another. Worth noting for scale: the other nine passes per device
   (six drawer screens, help search, and the two medication-editor passes) are untouched by the
   stay, so the gap is confined to the In-Patient screen and Home without its banner.

## What I did NOT change

Every sabotage was applied to a copy under my scratch directory. I ran the suites with `--file`
pointing at those copies. The repository's own `index.html`, `sw.js` and `test/` files were never
edited by me.

`git status` at the end of this audit shows the two files another session is actively editing
(`index.html`, `test/overflow-scan.mjs`), that session's new `test/v70-remove-one-date.mjs`, and
this report. **None of those modifications are mine, and I deliberately left them alone** rather
than reverting work that has not been pushed anywhere.

## Bottom line

The engineering in these two commits is good and I could not break it. The Help text now tells the
truth about what the app does with treatment dates — I checked every claim against the code, not
the commit message, and all six are correct. The layout fix is real: I reproduced both original
bugs with my own probe and my own fixture, then watched them disappear, and the tiles survive
four-digit numbers and a year-crossing stay.

**DO NOT SHIP** is about the packaging, not the work: one wrong button name in the new text, no
version number, no cache bump, and the next feature already half-written into the same file. Fix
the sentence, bump the two version strings, ship the commit rather than the tree, and this is a
good release.

---

## Tree state at hand-off (for whoever picks this up)

      M  index.html                             <- NOT mine: app-v70 work by another session
      M  test/overflow-scan.mjs                 <- NOT mine: app-v70 fixture change
      ?? test/v70-remove-one-date.mjs           <- NOT mine
      ?? test/v70-remove-one-date-browser.mjs   <- NOT mine (appeared last)
      ?? outputs/AUDIT_app-v69.md               <- this report, the only file I wrote

I verified the working-tree diff contains none of my sabotage strings (`SABOTAGE`, the restored
false Help sentence, the reworded warning step) — zero occurrences of each. Every sabotage lived
and died in a scratch directory outside the repository. I made no commit and no push.
