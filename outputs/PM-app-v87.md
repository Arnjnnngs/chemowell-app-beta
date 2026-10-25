AUDITED-COMMIT: 068392c
VERDICT: SHIP

Project Manager sign-off gate — ChemoWell **app-v87**, branch `claude/caretracker-team-review-i83ik2`,
HEAD `068392c`. Independent seat: I did not build this and I did not audit it.

**This replaces my refusal at `04b8cc2`.** That refusal had one blocker — the Enhancer seat produced
no artefact for this version — and one condition, that the guard change made after the final audit be
written down. **Both are answered.** The gate now exits 0 and I sign.

---

## THE DECISION, IN ONE PARAGRAPH

Both items Aaron ordered are delivered and guarded by checks I broke myself to prove they bite. Seven
audit passes; every finding traced forward to the commit that answered it; nothing dropped between
rounds; two deliberate deferrals, both named, both justified, both in `BACKLOG.md`. Four suites green
on my own runs plus three long-standing reds now fixed. Release mechanics correct, Rule 0 clean, the
in-app What's New true in all six of its points. The Enhancer pass that was missing now exists, it is
real work rather than a file to satisfy a gate, and it found two things — both correctly left
unbuilt, both now decisions for Aaron. **Ship it.**

---

## 1. THE BLOCKER I RAISED, AND WHY IT IS CLEARED

### `outputs/ENHANCER-app-v87.md` — present, and it is a pass, not a placeholder

I read it against Rule 2.6's six-item checklist and then checked its two factual claims in the code
myself, because a seat's own account of what it found is not evidence.

**It opens by naming its own lateness as the finding above the findings**, which is the right
instinct and the thing I refused for: skipped on app-v86, refused by that PM, skipped again here — on
the release whose README row opens by explaining that both its features exist *because* it was
skipped. It then measures the cost rather than asserting it: app-v87 turned up five places where Help
described a control the app does not have, three audit rounds read past the fifth, and a person
sweeping bolded names by hand found it. That is this checklist, item for item.

It names the five screens it read, it proposes without building, and **three of its five sections
record an explicit "nothing this time"** — including item 6, whether anything already on the screen
should not be there, which is the question this seat is structurally most likely to skip and which it
answers with a specific comparison (no derived statistic on these screens, unlike the Paracentesis
average that the Voice had to remove from a sibling app).

**I verified both findings in the code:**

| Claim | My check | Verdict |
|---|---|---|
| **E-1** — `Correct` renders only on an existing row, and the logger writes to today with no date step | `renderDailyValueLogger` pins `d0 = dayStart(simNow())`; the corrector is reached from a rendered row | **True** |
| **E-1** — Paracentesis and Weight already open a date step | Both route through the shared time modal, which carries a `Date` pill and a full calendar | **True** |
| **E-2** — nothing in the app can enter an appetite note | `submitAppetite()` is the only writer that passes one, and `grep` returns its definition and **no call site**. The live logger and the row corrector both call `logAppetite(v, d)` with no note; the check-in sheet passes none either | **True** |

**E-2 is the better of the two findings and I want it on the record as such.** The app renders a
field, carries it into the clinician's CSV, and two consecutive releases have written careful rules
about what happens to it — and no caregiver can put anything in it. That is a dead end of the purest
kind, and it is exactly the thing every other seat on this team is built not to notice: nothing is
*wrong*, something is *missing*, which is Rule 2.6's whole reason for existing.

### Is E-1 an incompleteness against what Aaron ordered, or a follow-on?

**A follow-on, and this is checkable rather than a judgement call.** Aaron ordered "the two Enhancer
items" from the app-v86 pass. That pass listed five. Its **E-1** was *"a past day can only be deleted,
not corrected"* — delivered here. Its **E-5** was *"No way to log for a day that is not today. M"* —
the same proposal, already written down, already sized at M, already in front of Aaron, **and not
among the two he picked.** The v87 pass has independently re-derived an item he has already seen and
declined to schedule. That is the seat working correctly, not the release falling short.

I agree with the pass's own closing sentence: the release is complete without either proposal. I
would add only that E-1's re-appearance is itself information worth giving Aaron — it is the second
time the seat has raised it unprompted, and a missed day is the common case for a once-a-day
question, not the rare one.

### P-1 — on `BACKLOG.md`, in the terms I asked for

The entry states the trade exactly: bowel side unchanged at three of five, symptom side relaxed from
three to five of nine, a hand-typed four-of-nine list now passing, the alternative going red on a
correct app, and that it was found by the PM rather than an auditor. That is the whole of my
condition. Cleared.

### Nothing else moved

`git diff 04b8cc2..068392c --stat` is `BACKLOG.md` and `outputs/ENHANCER-app-v87.md`. No application
code, no suite beyond the one guard line already in `04b8cc2`, no version or cache movement. **The
sixth audit's clearance therefore stays current** — neither file is in `RULE5_PATHS` — so no further
audit round is owed, and I confirmed the gate agrees.

---

## 2. SCOPE — DID IT DELIVER WHAT AARON ORDERED, AND ONLY THAT?

Aaron, 2026-10-25: *"the two Enhancer items, then backup."*

### Both delivered. Verified by driving them, not by reading the diff.

| Ordered | Status | How I know |
|---|---|---|
| Home bowel banner could not record "Loose" | **Delivered** | My own mutant removing `loose` from the shared option builder turns the suite red in 6 places |
| A past bowel/appetite day could only be deleted | **Delivered** | `Correct` sits beside `Remove` on every past row, opens a day-scoped picker, supersedes rather than deletes, refuses a no-op |

### It also grew, and that is the honest finding of this review.

**Ring 1 — the same defect, one control over. Correct and necessary.** The release fixed the banner
and left the daily check-in sheet offering four of five, where a standing "Loose" day rendered the box
*blank*. The first audit caught it; both controls now build their options from one function. Also
here: the banner placeholder (the release introduced the false string), the amber Loose dot, and the
note-inheritance rule on a corrected appetite day. **All of this belongs to the two items.**

**Ring 2 — the Help centre. This is where the release ran away.** It started in scope: Help's bowel
sentence was a hand-typed copy of the very list being fixed. It became a different project — a false
claim that Symptoms carries diarrhoea (a control deleted thirty releases ago), a promised 1-to-10 pain
scale never built, a bolded control name not matching its tile, and four rounds of ratchets to police
the whole Help corpus. **Rounds 3, 4, 5 and 6 of six went almost entirely here.** Nothing found was
imaginary — the pain-scale promise is a real thing a caregiver reads at 2am — but "hold Help to what
the app renders" is its own work, discovered, half-built and then deferred inside a two-item release.
The sixth audit recommended deferring it. **That was right three rounds earlier too.**

**Ring 3 — three long-standing red suites fixed.** `v84-whatsnew`, `v71-report-controls`,
`v57-search`. Unordered, but cheap housekeeping that makes every future gate readable. I do not count
it against the release.

**And the next item's prep rode along:** `ENHANCER-PASS-backup-gating.md` and
`DEV-BRIEF-backup-gating.md`. Documents only, no app code, for "then backup" — the next thing ordered.
Correct, and noted only so nobody mistakes them for this release.

**Judgement: ring 1 yes, ring 3 forgivable, ring 2 should have been stopped at round 3** and logged as
one pass. Two of the six rounds were about the thing Aaron asked for.

---

## 3. THE CHAIN — SEAT BY SEAT

| Seat | Artefact for app-v87 | Status |
|---|---|---|
| Builder | the commits | present |
| Enhancer | `outputs/ENHANCER-app-v87.md` | **present — late, and it says so first** |
| Designer | `outputs/DESIGN-app-v87.md` + 21 screenshots in `outputs/design-app-v87/` | present |
| Zero Day Auditor | `AUDIT-app-v87.md` and six delta reports | present, seven passes |
| `release_check.sh` | run by me, raw output below | **exit 0** |
| PM | this file | this seat |

---

## 4. WHAT I RAN MYSELF — FIGURES TAKEN, NOT ACCEPTED

Suites run by me against the tree at `04b8cc2`/`068392c` (identical application code), served at
`127.0.0.1:8899`, served bytes confirmed to match `index.html` (md5 `f80a7a1c878c1cc5160534e921bd4f19`),
with `env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy`. `release_check.sh` then re-ran
the whole board itself against a clean export of HEAD.

| Suite | Expected | **My run** |
|---|---|---|
| `test/v87-correct-a-past-day.mjs` | 64/64 | **64 checks: 64 passed, 0 failed** |
| `test/v86-logging-and-labels.mjs` | 87/87 | **87 checks: 87 passed, 0 failed** |
| `test/v55-help.mjs` | ALL GREEN | **ALL GREEN** |
| `test/v57-search.mjs` | 53/53 ALL GREEN | **53/53 exact, 0 recovered, 0 missed — ALL GREEN** |
| `test/v84-whatsnew.mjs` | was a standing red | **96 checks: 96 passed, 0 failed** |
| `test/v71-report-controls.mjs` | was a standing crash | **all checks passed** |
| `test/v75-no-other-patient.mjs` (Rule 0 ratchet) | 27/27 | **27/27** |

All three long-standing reds are genuinely fixed. Each suite's own README-figure self-check passed, so
the published numbers are the numbers.

### My own falsification, because a green suite proves nothing on its own

I did not mutate the repository. I served a byte copy of `index.html` from my scratchpad on a second
port and pointed the suite at it with `FALSIFY_BASE`; the working tree was never touched.

| My mutant | Result |
|---|---|
| **PM1** — drop `Loose` from the shared bowel option builder, re-creating the exact defect this release exists to fix | **CAUGHT, 7 red** — including *"the banner offers every value the app defines"*, *"the check-in sheet offers every value"*, and *"a Loose day pre-fills it rather than rendering blank"* (`index=-1 shown="(BLANK)"`) |
| **PM2** — a hand-typed bowel list spread one value per step across three Help steps | **CAUGHT** — `vit-checkin-modal [bowel, spread across steps]: normal, very little, none` |
| **PM3** — the same shape with **four of nine** symptom names | **SURVIVED 64/64** — the measured cost of P-1, now on the backlog |
| **PM4** — **five of nine** symptom names | **CAUGHT** |

The central guard of the release bites hard and bites on the exact defect.

---

## 5. `./release_check.sh` — RAW OUTPUT

### Run at `04b8cc2`, before the Enhancer pass existed (the refusal, for the record)

    ℹ️  Suites will run against a clean export of HEAD at /tmp/tmp.SvFHckGp61
       (not the working tree -- see the app-v82 note above).
    ℹ️  Baseline: PUBLISHED.json -> app-v86 (chemowell-app-v86-1) at a62069b
       10 commit(s) have changed index.html since that record. This gate assumes NONE of
       them are live yet. If any were already pushed, run ./mark_published.sh <that commit>
       first -- otherwise the comparison below is against the wrong build.
    ❌ RELEASE CHECK FAILED: the design-time seats have not run for app-v87.
       missing: an outputs/ENHANCER*app-v87*.md pass
       These run BEFORE the build, on the screens about to change (TEAM-ORDER.md).
       An Enhancer pass that found nothing is written down as 'nothing this time' and still
       counts. Silence does not -- that is the failure this gate exists for.
    ❌ RELEASE CHECK FAILED: a chain report refuses this release, and nothing supersedes it.
       (my own sign-off, refusing, at 04b8cc2)
    EXIT CODE: 1

On an earlier run — before any sign-off file existed at all — the gate also listed the four audit
rounds that had refused this release. **Those are history, not outstanding work**, and I proved it:
that branch of the gate deliberately prints every standing refusal *without* applying the supersede
rule, and each of `bb45852`, `d21cf06`, `239593d` and `9ec37ae` is an ancestor of `242e07c`, which the
sixth audit cleared. The moment a sign-off file exists the gate applies the rule and all four vanish
from its output, which is what the run above shows.

### Run at `068392c`, with this sign-off in place

    ℹ️  Suites will run against a clean export of HEAD at /tmp/tmp.LhcAOlfW2S
       (not the working tree -- see the app-v82 note above).
    ℹ️  Baseline: PUBLISHED.json -> app-v86 (chemowell-app-v86-1) at a62069b
       10 commit(s) have changed index.html since that record. This gate assumes NONE of
       them are live yet. If any were already pushed, run ./mark_published.sh <that commit>
       first -- otherwise the comparison below is against the wrong build.
    ℹ️  Other reports present and not clearing this release:
         outputs/AUDIT-app-v87-delta.md — examined 2e60c2d; changed since: index.html 
         outputs/AUDIT-app-v87-delta2.md — says DO NOT SHIP
         outputs/AUDIT-app-v87-delta3.md — says DO NOT SHIP
         outputs/AUDIT-app-v87-delta4.md — says DO NOT SHIP
         outputs/AUDIT-app-v87-delta5.md — examined b2d4ac3; changed since: index.html 
         outputs/AUDIT-app-v87.md — says DO NOT SHIP
    ℹ️  Chain artifacts present for app-v87, and current against the working tree:
         outputs/AUDIT-app-v87-delta6.md
         outputs/PM-app-v87.md
    ℹ️  v76-properties-equivalence.mjs: green.
    ℹ️  v76-empty-window-render.mjs: green.
    ℹ️  No-other-patient check: clean.
    ✅ Release check passed.
       index.html changed and sw.js's CACHE constant changed with it -- installed
       copies of the app will pick this up automatically on next open.
    EXIT CODE: 0

**Exit 0, and nothing is outstanding in it.** Everything it prints is `ℹ️`. Three groups, and I
checked each:

* **The baseline note** is the standing reminder that `PUBLISHED.json` still records app-v86, so
  `./mark_published.sh` is owed *after* the push. Not a failure.
* **"Other reports present and not clearing this release"** is the gate listing history. Four earlier
  audit rounds refused the release and were each answered by a later pass of the same seat examining
  a later commit; two more are stale only because `index.html` moved after them. The gate names the
  one audit that is both clearing and current — the sixth — alongside this sign-off.
* **The clearing pair** is `outputs/AUDIT-app-v87-delta6.md` and this file, and the gate confirms
  `index.html` changed with `sw.js`'s CACHE, so installed copies will pick the release up.

---

## 6. EVERY AUDIT FINDING, AND WHERE IT ENDED UP

Seven audit passes. I traced each finding forward to the commit that answered it and checked the later
rounds did not quietly drop an earlier one.

**Round 1 (`bb45852`, refused) — 9 findings.** F1 (check-in sheet four-of-five, box blank on Loose)
and F2 (placeholder false off-today) were the blockers: **both fixed**, re-measured by the next round
through the live DOM. F3 (Loose shown green) **fixed** — amber, measured `rgb(199,120,0)`. F4, F5, F7
(three checks that could not fail) **fixed** — all three go red now. F6 (a note following a changed
answer) **fixed**, with a six-row truth table walked against the shipped writer. F8, F9 (two record
sentences) **corrected**.

**Round 2 (`d21cf06`, refused) — 7.** F1 (Help claims Symptoms carries diarrhoea; it has not since
v57) **fixed**. F2 (the eighth vacuous check — the unanswered-day path never driven, and a sentinel
there writes a fabricated daily answer) **fixed**, and I confirmed the guard still bites. F3 (a false
TDZ claim in the README) **corrected**. F4, F5 **fixed**. F6, F7 record corrections **made**.

**Round 3 (`239593d`, refused) — 8.** R3-1 (Help promises a 1-to-10 pain scale never built) **fixed**
— the promise is gone and the changelog says so. R3-2, R3-3, R3-4 (three new ratchets defeated by the
very defect they were written for) **fixed**, each re-measured by the next round's own mutants. R3-5,
R3-6 (record) **corrected**. R3-7 (a Help step calling a note optional when the app refuses to save
without one) **fixed**. R3-8 (What's New told a third of the story) **fixed** — six points now, all of
which I read against the code.

**Round 4 (`9ec37ae`, refused) — 6.** R4-1 (a check that could not pass on a correct app, matching an
ASCII hyphen against the app's en dash) **fixed** — the fifth audit re-ran the mutant that makes the
claim TRUE and the suite passes. R4-2 (the ratchets read one of the two arrays the Help screen
renders) **fixed**. R4-3, R4-4, R4-5 **fixed**. R4-6 (record) **corrected**.

**Round 5 (`b2d4ac3`, cleared) — 5.** D5-2, D5-3 **fixed**. D5-4, D5-5 (record) **corrected**. D5-1
**DEFERRED**.

**Round 6 (`242e07c`, cleared) — 2.** D6-1 and D6-2 both **taken** in `04b8cc2`.

**Nothing was dropped between rounds.** I spot-checked the three findings most likely to be lost — the
check-in sheet option list, the unanswered-day pre-fill, and the Loose dot colour — and all three are
in the shipped file, with my PM1 mutant proving the first two are still held by a check.

### The two deliberate deferrals — and I agree with both

1. **`renderHelpView()`, the sixth Help surface.** Eight prose literals written straight into the DOM,
   outside every array the new ratchets read; the biggest is the safety notice on the Help search
   screen. (a) Named as deferred: yes, in the README row and in a comment beside the hook. (b) In
   `BACKLOG.md`: **yes**, with the measurements and the reason widening the hook cannot close it.
   (c) Justified: yes. The surface is clean today — all eight strings read twice, none claims a
   control — and the durable fix is to scrape the rendered screen, which is machinery, not a line.
   Machinery designed at the end of a six-round release is how four of this release's vacuous checks
   got written.
2. **The bolded-control-name sweep.** 134 bolded strings, between 5 and 40 matching nothing else in
   the file. (a) named, (b) **in `BACKLOG.md`**, (c) justified: the right task is *"make the sweep a
   check"* and the triage falls out of its first run. Forty judgement calls on a release that has
   already turned over six times is how a class gets closed badly.

---

## 7. RELEASE MECHANICS

| Check | Result |
|---|---|
| `APP_VERSION` in `index.html` | `'app-v87'` (line 9227) |
| `CACHE` in `sw.js` | `'chemowell-app-v87-1'` (line 1) |
| Moved together | **Yes** — both from v86, in the same release |
| `README.md` version-history row | Present, and it describes what actually shipped: both ordered items, the check-in sheet, the amber dot, the Help corrections, the deferrals |
| In-app What's New (`CHANGELOG[0]`) | Six points, each read against the code. **All true, none promises anything unbuilt** — including *"Help also promised a 1-to-10 scale on symptoms that was never built; that promise is gone until it is"* |
| Working tree | Clean before and after my run, except this report |

---

## 8. CHEMOWELL RULE 0 — PRODUCT NEUTRALITY

Scanned `git diff 87d1784..HEAD` across `index.html`, `sw.js` and `test/`.

* **Patient name:** zero matches.
* **Gendered pronouns:** two hits, both naming **Aaron** in the same sentence — one code comment, one
  test header quoting him. The owner, not a patient; the established convention in this file.
* **Dose / ceiling / schedule from one care plan:** zero.
* **Behaviour keyed to a medication id:** zero new ones. The `medId ===` matches in the diff are the
  app's own record kinds — `blood_pressure`, `paracentesis`, `bowel_movement`, `appetite`,
  `radiation_session` — not medications.
* **`test/v75-no-other-patient.mjs`: 27/27**, all three ratchet counts reading **0/0/0** against
  ceilings of 0/0/0.

Clean.

---

## 9. THE TWO JUDGEMENT CALLS AARON ASKED FOR

### Six audit rounds — process working, or a builder who could not get it right?

**Both, and the split is sharp enough to be useful.**

**The feature code was right early and stayed right.** From the first audit onward, no round found a
defect in the two things Aaron ordered that could damage or mis-state a record. The correctors write
to the day they belong to, supersede instead of deleting, refuse a no-op, keep the note, and mark the
earlier answer in the export — all measured, repeatedly, by mutants that go red when broken.

**What turned over six times was the builder's own guards and the builder's own description of them.**
Four consecutive rounds found a check that claimed coverage it did not have — the seventh, eighth,
ninth and tenth vacuous checks of this release, each introduced *as the fix for the previous one*.
Round 4's is sharpest: a brand-new check that could not pass on a correct app, because it was written
against the prose of the Help text and never once run against the string the app renders. **That is
the identical mistake as the defect the release exists to fix** — a copy of a list, drifting from the
list — committed inside the fix for it.

And one more pattern the auditor counted out loud: **six times** across seven passes the README
claimed a property the code did not have. At round 4 the auditor wrote *"the same defect the first
round raised as D1, the second as F3 and the third as R3-6."* It then happened twice more.

**So: the chain is working — nothing false reached a caregiver, and every one of these was caught.**
But six rounds is not thoroughness. Five of the seven passes were spent on work the builder created
while fixing the previous pass, and the recurring shape is a guard written quickly and a sentence
written confidently about it. **That is the chain absorbing care that belonged upstream** — and the
cheapest correction is the seat this release had to be refused to get: the Enhancer asks the
screen-level question that four of the five Help mismatches were.

### Is it worth shipping now? Yes.

What remains in the guards — the Help renderer's eight literals, the four-of-nine symptom gap, a
question mark that is not a question — is reachable only by a future edit, not by anybody holding the
phone. Every sentence a caregiver can read in this build is true; I checked the ones the release
changed and the auditors checked the rest twice. The records are safe: nothing in seven passes found a
path that loses or fabricates an answer, and the one path that could have — a sentinel in the
unanswered-day pre-fill writing a daily answer nobody gave — is held by a check I re-ran myself.

**SHIP.**

---

## 10. AFTER THE PUSH

1. `./mark_published.sh <the commit uploaded>` immediately after, and commit the result — the gate's
   baseline note is standing and `PUBLISHED.json` still records app-v86.
2. The two Enhancer proposals are **decisions waiting on Aaron**, not work in flight.

---

## 11. FOR AARON

**Short version: it is ready. Two small things need a yes or no from you, and one thing only you can
check — it has never been on a real phone.**

You asked for two things and you got both.

**One.** When the app is already warning you there is a bowel problem, it puts a little box on the
home screen so you can update the answer. That box offered four of the five answers the app has —
"Loose" was simply missing, and that is the one that usually changes first during chemotherapy. You
had to go somewhere else to record it and nothing told you that. It is there now. While fixing it the
team found the same hole in the once-a-day check-in card, where the box could come up completely empty
on a day you had already answered "Loose" — fixed too, and both boxes are now built from one list so
they cannot drift apart again. A "Loose" day also used to look identical to a normal day in your
history, same green dot. It is amber now: worth noticing, not an alarm.

**Two.** If you logged the wrong answer for a day, your only option used to be to delete it. Now every
past day has a **Correct** button next to Remove. Pick the right answer and the app keeps the old one
in the record, marked as replaced, rather than throwing it away — so a clinician can still see what
happened. Delete is still there if you really want it gone.

**Along the way they found the in-app Help was wrong in a few places** — it told you to log diarrhoea
in the Symptoms list, which has not offered it for months, and it promised a 1-to-10 pain scale that
was never built. Both corrected, and Help now points you to the right place.

### Two things I need a yes or no on

The check that reads a screen and asks *"can a caregiver actually do the whole job here?"* has now run
on this release. It found two gaps. **Neither is built** — they are proposals, and they are yours to
decide.

1. **You can fix a day you got wrong. You still cannot fill in a day you missed.** If you were at the
   hospital Thursday and Friday and open the app on Saturday, you can record Saturday and nothing
   else. Those two days just stay blank. Two other screens on the same tab — paracentesis and weight
   — already let you pick a date. This is a **medium** job. Worth knowing: this exact item was on the
   list last time and you did not pick it, which is why it is not in this release — I think that was a
   reasonable call then, and I think it is now the most useful next thing on these screens.
2. **The appetite note box does not exist.** The app shows a note next to an appetite entry and puts
   it in the records you export — but there is no way to type one in. It has never been possible. This
   is a **small** job: either add the box, or stop showing something that can never have anything in
   it. My recommendation is to add it — *"ate half a sandwich, no nausea"* is the kind of thing a
   clinician actually reads.

### What only you can check

**There is no iPhone here.** Everything was checked in a desktop browser at phone sizes. **Nothing in
this release has been on a real phone.** When it goes out, please open it on yours and try three
things: the banner's answer box (does "Loose" appear and save?), the **Correct** button on a day from
earlier in the week, and the daily check-in card (does the bowel box come up blank, or showing your
last answer?). Those are the three screens that changed.

### One thing worth knowing about how this went

This release was re-checked six times before it cleared. The feature itself was right from early on —
nothing in six rounds found a way to lose or corrupt one of your records. What kept failing was the
*safety nets* written around it: four times in a row, a test written to stop a problem coming back
turned out to be incapable of noticing that problem. All caught, all fixed, which is the system doing
its job — but six rounds is mostly rework, not thoroughness. The cheapest thing that would have cut it
down is the screen-reading check that got skipped, which is why I held the release until it ran. It
has run now, and the two questions above are what it found.

