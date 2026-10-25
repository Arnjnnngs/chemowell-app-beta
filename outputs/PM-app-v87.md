AUDITED-COMMIT: 04b8cc2
VERDICT: DO NOT SHIP

Project Manager sign-off gate — ChemoWell **app-v87**, branch `claude/caretracker-team-review-i83ik2`,
HEAD `04b8cc2`. Independent seat: I did not build this and I did not audit it.

---

## THE DECISION, IN ONE PARAGRAPH

**The code is right and I could not break it. The chain is not complete.** There is no
`outputs/ENHANCER-app-v87.md`. The Enhancer seat — the one that runs BEFORE a build, on the screens
it is about to touch — produced no artefact for this version, and `release_check.sh` requires one
whenever `index.html` moves. **This is the identical gap that made the PM refuse app-v86 one release
ago**, and app-v86's own README row for v87 says so out loud: these two features exist *because* that
seat was skipped last time. It was skipped again. Everything else I checked is sound: four suites
green on my own runs, the two ordered features delivered and guarded, Rule 0 clean, release mechanics
correct, every audit finding either fixed or deliberately deferred with a backlog entry. **The fix is
one artefact and no code.** Run the Enhancer on the screens app-v87 touched, write the file, and this
desk signs.

---

## 1. SCOPE — DID IT DELIVER WHAT AARON ORDERED, AND ONLY THAT?

Aaron, 2026-10-25: *"the two Enhancer items, then backup."*

### Both items delivered. Verified by driving them, not by reading the diff.

| Ordered | Status | How I know |
|---|---|---|
| Home bowel banner could not record "Loose" | **Delivered** | Suite section drives the banner; my own mutant removing `loose` from the shared option builder turns the suite red in 6 places |
| A past bowel/appetite day could only be deleted | **Delivered** | `Correct` sits beside `Remove` on every past row, opens a day-scoped picker, supersedes rather than deletes, refuses a no-op |

### It also grew, and the growth is the honest finding of this review.

Three rings of work beyond the two items:

**Ring 1 — the same defect, one control over. Correct and necessary.** The release fixed the banner
and left the daily check-in sheet offering four of five, where a standing "Loose" day rendered the box
*blank*. The first audit caught it. Both controls now build their options from one function. Also in
this ring: the banner placeholder (the release introduced the false string), the amber Loose dot, and
the note-inheritance rule on a corrected appetite day. **All of this belongs to the two items.**

**Ring 2 — the Help centre. This is where the release ran away.** It started in scope: Help's bowel
sentence was a hand-typed copy of the very list being fixed. It then became a different project —
a false claim about diarrhoea and constipation in Symptoms (a control deleted thirty releases ago), a
promised 1-to-10 pain scale that was never built, a bolded control name that did not match its tile,
and four rounds of building ratchets to police the whole Help corpus. **Rounds 3, 4, 5 and 6 of six
were spent almost entirely here.** Nothing found was imaginary — the pain-scale promise in particular
is a real thing a caregiver reads at 2am — but "hold Help to what the app renders" is its own piece of
work, and it was discovered, half-built and then deferred inside a two-item release. The sixth audit
recommended deferring it. That was right. **It was right three rounds earlier too.**

**Ring 3 — three long-standing red suites, diagnosed and fixed.** `v84-whatsnew`, `v71-report-controls`
and `v57-search`. I ran all three: **96/96, all checks passed, and 53/53 ALL GREEN.** Unordered work,
but it is housekeeping that makes every future gate readable, and it is cheap. I do not count it
against the release.

**And one piece of the NEXT item's prep rode along:** `outputs/ENHANCER-PASS-backup-gating.md` and
`outputs/DEV-BRIEF-backup-gating.md`. Documents only, no app code, and they are for "then backup",
which is the next thing Aaron asked for. Correct, and worth noting only so nobody mistakes them for
this release.

**My judgement on drift: ring 1 yes, ring 3 forgivable, ring 2 should have been stopped at round 3**
and logged as "Help vs the app it describes — one pass". Two of the six rounds were about the thing
Aaron asked for.

---

## 2. THE CHAIN — SEAT BY SEAT

| Seat | Artefact for app-v87 | Status |
|---|---|---|
| Builder | the commits | present |
| **Enhancer** | **`outputs/ENHANCER-app-v87.md`** | **MISSING — BLOCKER** |
| Designer | `outputs/DESIGN-app-v87.md` + 21 screenshots in `outputs/design-app-v87/` | present |
| Zero Day Auditor | `AUDIT-app-v87.md` and six delta reports | present, seven passes |
| `release_check.sh` | run by me, raw output below | refuses |
| PM | this file | this seat |

### BLOCKER B1 — the Enhancer seat produced nothing for this version.

`ls outputs/ENHANCER*` returns passes for v79, v81, v84, v85, v86 and one for the backup-gating item.
**There is none for app-v87.** `release_check.sh` demands `outputs/ENHANCER*app-v87*` whenever
`index.html` changed; it has not reached that check yet only because it exits earlier on my own
missing sign-off.

**Why this is not a filing technicality, on this release above all others.** The Enhancer's question
is *"does this screen let the caregiver do the whole job, and does what it says match what it
offers?"* This release found **five** places where Help described a control the app does not have.
Three independent audit rounds read past the fifth one; it was found by a person eyeballing bolded
names. That is the Enhancer's checklist, item for item, and the seat whose job it is never sat down.
The last release was refused by this same desk for this same absence, and the README row for THIS
release opens by explaining that the two features exist because of it.

**The remedy, and it is small.** Walk the screens app-v87 actually touched — the Home bowel-issue
banner, the daily check-in sheet, Reports → Bowel Movement, Reports → Appetite, and the Help centre —
against Rule 2.6's checklist, and write `outputs/ENHANCER-app-v87.md`. An honest *"nothing this time"*
is a legitimate pass. An absent file is not. **No code change is required and the Auditor's clearance
stays current**, because the design seats are not in `RULE5_PATHS`.

---

## 3. WHAT I RAN MYSELF — FIGURES TAKEN, NOT ACCEPTED

Every suite run by me against the working tree at `04b8cc2`, served at `127.0.0.1:8899`
(I confirmed the served bytes match `index.html`, md5 `f80a7a1c878c1cc5160534e921bd4f19`), with
`env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy`.

| Suite | Expected | **My run** |
|---|---|---|
| `test/v87-correct-a-past-day.mjs` | 64/64 | **64 checks: 64 passed, 0 failed** |
| `test/v86-logging-and-labels.mjs` | 87/87 | **87 checks: 87 passed, 0 failed** |
| `test/v55-help.mjs` | ALL GREEN | **ALL GREEN** |
| `test/v57-search.mjs` | 53/53 ALL GREEN | **53/53 exact, 0 recovered, 0 missed — ALL GREEN** |
| `test/v84-whatsnew.mjs` | was a standing red | **96 checks: 96 passed, 0 failed** |
| `test/v71-report-controls.mjs` | was a standing crash | **all checks passed** |
| `test/v75-no-other-patient.mjs` (Rule 0 ratchet) | 27/27 | **27/27** |

All three long-standing reds are genuinely fixed. Each suite's own README-figure self-check passed,
so the published numbers are the numbers.

### My own falsification, because a green suite proves nothing on its own

I did not mutate the repository. I served a byte copy of `index.html` from my scratchpad on a second
port and pointed the suite at it with `FALSIFY_BASE`; the working tree was never touched
(`git status --porcelain` empty throughout).

| My mutant | Result |
|---|---|
| **PM1** — drop `Loose` from the shared bowel option builder, i.e. re-create the exact defect this release exists to fix | **CAUGHT, 7 red** — including *"the banner offers every value the app defines"*, *"the check-in sheet offers every value"*, and *"a Loose day pre-fills it rather than rendering blank"* (`index=-1 shown="(BLANK)"`) |
| **PM2** — a hand-typed bowel list spread one value per step across three Help steps | **CAUGHT** — `vit-checkin-modal [bowel, spread across steps]: normal, very little, none` |
| **PM3** — the same shape with **four of nine** symptom names | **SURVIVED 64/64** — see finding P-1 |
| **PM4** — **five of nine** symptom names | **CAUGHT** |

The central guard of the release bites hard, and bites on the exact defect. The Help spread guard
bites on the bowel side and has a measured, deliberate gap on the symptom side.

---

## 4. `./release_check.sh` — RAW OUTPUT

Run by me at `04b8cc2`, **before** this file existed:

    ℹ️  Suites will run against a clean export of HEAD at /tmp/tmp.HezIEBjkif
       (not the working tree -- see the app-v82 note above).
    ℹ️  Baseline: PUBLISHED.json -> app-v86 (chemowell-app-v86-1) at a62069b
       10 commit(s) have changed index.html since that record. This gate assumes NONE of
       them are live yet. If any were already pushed, run ./mark_published.sh <that commit>
       first -- otherwise the comparison below is against the wrong build.
    ❌ RELEASE CHECK FAILED: the quality chain has not run for app-v87.
       Changed under rule 5: .github/workflows/verify-live.yml index.html sw.js
       missing: an outputs/PM*app-v87*.md sign-off
       AND a report on record REFUSES this release: outputs/AUDIT-app-v87-delta2.md (examined d21cf06) says DO NOT SHIP.
       Fix what it found and re-run that stage against a later commit. A sign-off from a
       different desk does not answer it.
       AND a report on record REFUSES this release: outputs/AUDIT-app-v87-delta3.md (examined 239593d) says DO NOT SHIP.
       Fix what it found and re-run that stage against a later commit. A sign-off from a
       different desk does not answer it.
       AND a report on record REFUSES this release: outputs/AUDIT-app-v87-delta4.md (examined 9ec37ae) says DO NOT SHIP.
       Fix what it found and re-run that stage against a later commit. A sign-off from a
       different desk does not answer it.
       AND a report on record REFUSES this release: outputs/AUDIT-app-v87.md (examined bb45852) says DO NOT SHIP.
       Fix what it found and re-run that stage against a later commit. A sign-off from a
       different desk does not answer it.
       Every suite passing is SELF-verification. CLAUDE.md rule 5 requires an independent
       Auditor pass and PM sign-off before this ships, with no size exception. Permission to
       push is not that gate.
    EXIT CODE: 1

**It names more than my missing sign-off, and I checked whether that matters. It does not.** Those
four refusals are the four `DO NOT SHIP` audit rounds, and they are listed here by a branch of the
gate that deliberately prints every standing refusal *without* applying the supersede rule, because
that branch exists to stop an important reason going unmentioned. The supersede rule lives further
down and only runs once a PM file exists. I verified by hand that each of the four refusals is an
ancestor of `242e07c`, the commit the sixth audit cleared, and that the sixth audit is over the
thinness floor and in this branch's history — so each is superseded by a later pass of the same seat.
**Those four lines are history, not outstanding work.**

The baseline note about `PUBLISHED.json` is informational (`ℹ️`), not a failure, and is the standing
warning that `./mark_published.sh` is owed if any `index.html` commit in this range was already
uploaded. Nothing here has been pushed by me.

### The gate run WITH this sign-off in place

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
       These say DO NOT SHIP:
         outputs/PM-app-v87.md — examined 04b8cc2
       A refusal is cleared by re-running that stage against a LATER commit and it saying
       SHIP — not by adding another file beside it.
    EXIT CODE: 1

**This is the proof of B1, and the proof that nothing else is outstanding.** With a sign-off file on
disk the gate reaches the checks it could not reach before, and it names exactly two things: the
missing Enhancer pass, and my own refusal. **The four audit refusals are gone from the output** —
superseded, as I said above, now that the gate's supersede rule is in play. There is nothing else.
Replace the Enhancer gap and re-issue this sign-off and the gate has no remaining objection.

---

## 5. EVERY AUDIT FINDING, AND WHERE IT ENDED UP

Seven audit passes. I traced each finding forward to the commit that answered it and checked the
later rounds did not quietly drop an earlier one.

**Round 1 (`bb45852`, refused) — 9 findings.** F1 (check-in sheet four-of-five, box blank on Loose) and
F2 (placeholder false off-today) were the blockers: **both fixed**, and re-measured by the next round
through the live DOM. F3 (Loose shown green) **fixed** — amber, measured `rgb(199,120,0)`. F4, F5, F7
(three checks that could not fail) **fixed** — all three go red now. F6 (a note following a changed
answer) **fixed**, with a six-row truth table walked against the shipped writer. F8, F9 (two record
sentences) **corrected**.

**Round 2 (`d21cf06`, refused) — 7.** F1 (Help claims Symptoms carries diarrhoea; it has not since v57)
**fixed**. F2 (the eighth vacuous check — the unanswered-day path never driven, and a sentinel there
writes a fabricated daily answer) **fixed**, and I confirmed the guard still bites. F3 (a false TDZ
claim in the README) **corrected**. F4, F5 **fixed**. F6, F7 record corrections **made**.

**Round 3 (`239593d`, refused) — 8.** R3-1 (Help promises a 1-to-10 pain scale that was never built)
**fixed** — the promise is gone and the changelog says so. R3-2, R3-3, R3-4 (three new ratchets
defeated by the very defect they were written for) **fixed**, each re-measured by the next round's own
mutants. R3-5, R3-6 (record) **corrected**. R3-7 (a Help step calling a note optional when the app
refuses to save without one) **fixed**. R3-8 (What's New told a third of the story) **fixed** — the
shipped entry now has six points and I read all six against the code.

**Round 4 (`9ec37ae`, refused) — 6.** R4-1 (a check that could not pass on a correct app, because it
matched an ASCII hyphen against the app's en dash) **fixed** — the fifth audit re-ran the mutant that
makes the claim TRUE and the suite passes, which is the behaviour it was supposed to have. R4-2 (the
ratchets read one of the two arrays the Help screen renders) **fixed**. R4-3, R4-4, R4-5 **fixed**.
R4-6 (record) **corrected**.

**Round 5 (`b2d4ac3`, cleared) — 5.** D5-2, D5-3 **fixed** this round. D5-4, D5-5 (record)
**corrected**. **D5-1 — DEFERRED** (see below).

**Round 6 (`242e07c`, cleared) — 2.** D6-1 and D6-2 both **taken** in `04b8cc2`, the commit after the
last audit.

**Nothing was dropped between rounds.** I spot-checked the three findings most likely to be lost —
the check-in sheet option list, the unanswered-day pre-fill, and the Loose dot colour — and all three
are in the shipped file, with my PM1 mutant proving the first two are still held by a check.

### The two deliberate deferrals — and I agree with both

1. **`renderHelpView()`, the sixth Help surface.** Eight prose literals written straight into the DOM,
   outside every array the new ratchets read; the biggest is the safety notice on the Help search
   screen. (a) Named as deferred: yes, in the README row and in a comment beside the hook. (b) In
   `BACKLOG.md`: **yes** — added in `04b8cc2`, with the measurements and the reason widening the hook
   cannot close it. (c) Justified: yes. The surface is clean today — all eight strings were read twice
   and none makes a claim about a control — and the durable fix is to scrape the rendered screen, which
   is machinery, not a line. Machinery designed at the end of a six-round release is how four of the
   vacuous checks in this release got written.
2. **The bolded-control-name sweep.** 134 bolded strings, between 5 and 40 of them matching nothing
   else in the file. (a) named, (b) **in `BACKLOG.md`**, (c) justified: the right task is *"make the
   sweep a check"*, and the triage falls out of its first run. Forty judgement calls on a release that
   has already turned over six times is how a class gets closed badly.

Both deferrals are correct, and both are recorded where this repo's own hard rule 8 says they go. That
entry did not exist until the last commit; the sixth audit caught its absence and it was fixed.

### P-1 — a finding of my own, on the one commit no auditor has seen

`04b8cc2` lands **after** the final SHIP verdict and changes a guard. It is test code and `BACKLOG.md`
only — no application code — and it implements, almost word for word, the remedy the sixth audit itself
named. But no auditor has measured it, so I did.

The Help enumeration guard used to fire at three distinct values from either list. It now requires
three **and a majority of that list**. Measured by me:

* Bowel side (5 values): **unchanged.** A hand-typed list spread over three steps still goes red (PM2).
* Symptom side (9 values): **relaxed from 3 to 5.** A hand-typed list of **four** of the nine symptom
  names, spread across steps, now passes (PM3). Five is caught (PM4).

That trade is deliberate and I think it is the right one — the alternative was a check that would go
red on `sym-severity` the day it mentions a headache, which is the exact anti-pattern this release
spent two rounds removing. **But the backlog says nothing about it**, and a guard whose threshold moved
after the last audit should not be the one thing in this release nobody wrote down. One line in
`BACKLOG.md`: the symptom-side enumeration guard now needs five of nine, and a stop-list on
`normal` / `none` / `other` would let it come back down.

---

## 6. RELEASE MECHANICS

| Check | Result |
|---|---|
| `APP_VERSION` in `index.html` | `'app-v87'` (line 9227) |
| `CACHE` in `sw.js` | `'chemowell-app-v87-1'` (line 1) |
| Moved together | **Yes** — both from v86, in the same release |
| `README.md` version-history row | Present, and it describes what actually shipped: both ordered items, the check-in sheet, the amber dot, the Help corrections, the deferrals |
| In-app What's New (`CHANGELOG[0]`) | Six points. I read every one against the code. **All true, none promises anything unbuilt** — including *"Help also promised a 1-to-10 scale on symptoms that was never built; that promise is gone until it is"*, which is exactly the right way to say it |
| Working tree | Clean before and after my run, except this report |

---

## 7. CHEMOWELL RULE 0 — PRODUCT NEUTRALITY

Scanned `git diff 87d1784..HEAD` across `index.html`, `sw.js` and `test/`.

* **Patient name:** zero matches.
* **Gendered pronouns:** two hits, both naming **Aaron** in the same sentence — one code comment
  (*"so Aaron can change his mind about it"*) and one test header quoting him. The owner, not a
  patient; the established convention in this file. Not a leak.
* **Dose / ceiling / schedule from one care plan:** zero.
* **Behaviour keyed to a medication id:** zero new ones. The `medId ===` matches in the diff are the
  app's own record kinds — `blood_pressure`, `paracentesis`, `bowel_movement`, `appetite`,
  `radiation_session` — not medications.
* **`test/v75-no-other-patient.mjs`: 27/27**, and its three ratchet counts all read **0/0/0** against
  ceilings of 0/0/0 — the migration debt is gone and has not crept back.

Clean.

---

## 8. THE TWO JUDGEMENT CALLS AARON ASKED FOR

### Six audit rounds — process working, or a builder who could not get it right?

**Both, and the split is sharp enough to be useful.**

**The feature code was right early and stayed right.** From the first audit onward, no round found a
defect in the two things Aaron ordered that could damage or mis-state a record. The correctors write to
the day they belong to, supersede instead of deleting, refuse a no-op, keep the note, and mark the
earlier answer in the export — all of it measured, repeatedly, by mutants that go red when broken.

**What turned over six times was the builder's own guards and the builder's own description of them.**
Four consecutive rounds found a check that claimed coverage it did not have — the seventh, eighth,
ninth and tenth vacuous checks of this release, each one introduced *as the fix for the previous one*.
Round 4's example is the sharpest: a brand-new check that could not pass on a correct app, because it
was written against the prose of the Help text and never once run against the string the app renders.
That is the identical mistake as the defect the release exists to fix — a copy of a list, drifting from
the list — committed inside the fix for it.

And one more pattern, which the auditor itself counted out loud: **six times** across the seven passes,
the README claimed a property the code did not have. The auditor's words at round 4 were *"the same
defect the first round raised as D1, the second as F3 and the third as R3-6."* It happened twice more
after that.

**So: the chain is working — nothing false reached a caregiver, and every one of these was caught.**
But six rounds is not thoroughness. Five of the seven passes were spent on work the builder created
while fixing the previous pass, and the recurring shape is a guard written quickly and a sentence
written confidently about it. That is the chain absorbing care that should have gone in upstream, and
on this project that is expensive in exactly the currency Aaron has complained about. **The single
cheapest correction is the one this release is missing: the Enhancer seat, which asks the screen-level
question that four of the five Help mismatches were.**

### Is it worth shipping now? On the code, yes. On the chain, not yet.

I agree with the last two audits on the narrow question. What remains in the guards — the Help
renderer's eight literals, the four-of-nine symptom gap, a question mark that is not a question — is
reachable only by a future edit, not by anybody holding the phone. Every sentence a caregiver can read
in this build is true; I checked the ones the release changed and the auditors checked the rest twice.
The records are safe: nothing in six rounds found a path that loses or fabricates an answer, and the
one path that could have (a sentinel in the unanswered-day pre-fill writing a daily answer nobody gave)
is now held by a check I re-ran myself.

**I am refusing on the chain, not on the build.** One missing artefact, no code, and this desk signs on
sight.

---

## 9. WHAT HAS TO HAPPEN BEFORE THIS SHIPS

1. **Run the Enhancer seat** on the Home bowel-issue banner, the daily check-in sheet, Reports → Bowel
   Movement, Reports → Appetite, and the Help centre, against Rule 2.6's six-item checklist. Write
   `outputs/ENHANCER-app-v87.md`. A short, explicit *"nothing this time"* counts; an absent file does
   not.
2. **One line in `BACKLOG.md`** recording that the Help enumeration guard's symptom side now needs five
   of nine (finding P-1), with the stop-list option named.
3. Re-run `./release_check.sh`. With the Enhancer file present and this sign-off re-issued as SHIP, it
   should exit 0 — the Auditor's clearance stays current because neither of the two steps above touches
   anything in `RULE5_PATHS`.
4. `./mark_published.sh` after the push, per the gate's baseline note.

No further audit round is required. Nothing above changes application code.

---

## 10. FOR AARON

**Short version: the work is good, one person on the team never showed up, and I am holding it until
they do. It is about an hour, not another day.**

You asked for two things and you got both.

**One.** When the app is already warning you that there is a bowel problem, it puts a little box on the
home screen so you can update the answer. That box offered four of the five answers the app has —
"Loose" was simply missing, and that is the one that usually changes first during chemotherapy. You had
to go somewhere else to record it and nothing told you that. It is there now. While fixing it the team
found the same hole in the once-a-day check-in card, where the box could come up completely empty on a
day you had already answered "Loose" — that is fixed too, and both boxes are now built from one list so
they cannot drift apart again. A "Loose" day also used to look identical to a normal day in your
history, same green dot. It is amber now: worth noticing, not an alarm.

**Two.** If you logged the wrong answer for a day, your only option used to be to delete it. Now every
past day has a **Correct** button next to Remove. Pick the right answer and the app keeps the old one
in the record, marked as replaced, rather than throwing it away — so a clinician can still see what
happened. Delete is still there if you really want it gone.

**Along the way they found the in-app Help was lying in a few places** — it told you to log diarrhoea
in the Symptoms list, which has not offered it for months, and it promised a 1-to-10 pain scale that
was never built. Both are corrected, and Help now points you to the right place instead.

**What nobody has done, and you should.** There is no iPhone here. Everything was checked in a
desktop browser at phone sizes. **Nothing in this release has been on a real phone.** When it goes out,
please open it on your own phone and try three things: the banner's answer box (does "Loose" appear and
save?), the **Correct** button on a day from earlier in the week, and the daily check-in card (does the
bowel box come up blank, or showing your last answer?). Those are the three screens that changed.

**Why I am holding it.** Every release here goes through a fixed set of checks before it ships. One of
them is a person whose only job is to look at a screen and ask *"can the caregiver actually do the
whole job here?"* — the same question that found both of the things you asked for this time. That check
was skipped on the last release, which is exactly why these two problems existed. **It was skipped
again on this one.** Given that this release then turned up five separate places where the app's own
help text described buttons that do not exist, I am not willing to be the person who waves that
through twice in a row. It is one pass over five screens and a short write-up. Nothing needs rebuilding.

**One thing worth knowing about how this went.** This release was re-checked six times before it was
cleared. The feature itself was right from early on — nothing in six rounds found a way to lose or
corrupt one of your records. What kept failing was the *safety nets* written around it: four times in a
row, a test written to stop a problem coming back turned out to be incapable of noticing that problem.
They were all caught and all fixed, which is the system doing its job. But six rounds is not six rounds
of thoroughness — it is mostly rework, and the cheapest thing that would have cut it down is the exact
check that got skipped.

