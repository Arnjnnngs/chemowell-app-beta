AUDITED-COMMIT: e0b7f98
VERDICT: DO NOT SHIP

Independent Project Manager gate, ChemoWell app-v88, branch
`claude/caretracker-team-review-i83ik2`, HEAD `e0b7f98`. I did not build this release and I did
not audit it.

**The product code is ready. The chain around it is not, and one thing a caregiver sees is wrong.**
I am refusing on three grounds, in the order it costs least to check them:

1. **Two seats the release gate itself requires produced nothing for this version** — there is no
   `outputs/ENHANCER*app-v88*` pass and no `outputs/DESIGN*app-v88*` pass. `release_check.sh`
   demands both whenever `index.html` moves, and `index.html` moved. The Designer gap is not a
   formality: this release puts new controls on screen and **nobody has looked at any of them
   rendered, at any width.** The auditor declined 320/360 overflow in all four rounds on the
   stated grounds that the Designer owns it. The Designer never ran.
2. **A live, user-visible copy defect, introduced by this release, in the one screen that speaks
   to the caregiver about this release.** The in-app What's New entry for app-v88 renders
   `**Log another day**` with the asterisks showing. I drove the shipped file and read it off the
   rendered page. It is the only markdown markup in the entire changelog array and no other
   release has any.
3. **Not one deferred item from four audit rounds reached `BACKLOG.md`.** The file has no app-v88
   entry at all and has not been touched since app-v87. This repo's hard rule 8 says a finding is
   either fixed or logged there. Ten were neither.

None of this is a finding against the code the release exists to deliver. Both of Aaron's items
are built, correct as far as six suites and four audits can show, and I verified every figure
myself rather than taking anyone's word. The gap is at the edges, and on this project the edges
are where the last three releases were refused.

---

# 1. What I verified myself, and how

Everything below I ran or measured in this session. Where I am repeating someone else's number I
say so.

## The six suites — run by me, every one printed a count

Run as instructed, against the server already up on `127.0.0.1:8899`:

| Suite | Expected | **What I got** |
|---|---|---|
| `test/v88-log-a-missed-day.mjs` | 58/58 | **58 checks: 58 passed, 0 failed** |
| `test/v87-correct-a-past-day.mjs` | 64/64 | **64 checks: 64 passed, 0 failed** |
| `test/v86-logging-and-labels.mjs` | 87/87 | **87 checks: 87 passed, 0 failed** |
| `test/v75-no-other-patient.mjs` | 29/29 | **29/29 checks passed** |
| `test/v55-help.mjs` | ALL GREEN | **ALL GREEN** |
| `test/v57-search.mjs` | 53/53 | **53/53 exact, 0 recovered in top 3, 0 missed — ALL GREEN** |

Every one printed its own count, so none silently failed to start — the failure mode named in my
brief, and the one that bit the builder on this release. Three of the six carry a self-check that
the README figure matches the run, and all three passed, so the documented numbers are the real
ones.

## The scope claim behind the delta-3 clearance — checked, holds exactly

The last audit pins to `64bb8a6` and three commits landed after it. The claim is that everything
after is test and documentation only. Measured:

    git diff --stat 64bb8a6..HEAD -- index.html sw.js   ->  (empty)
    git diff --name-status 64bb8a6..HEAD                ->  M TEAM.md
                                                            A outputs/AUDIT-app-v88-delta3.md
                                                            M test/v88-log-a-missed-day.mjs
    md5 index.html  64bb8a6 == HEAD  (005eeb378660fc3030e1d1a025429817)
    md5 sw.js       64bb8a6 == HEAD  (ddca18c584047ad841e81a790d10364c)

The two test edits are both strictly tightening: a precondition narrowed from "the day was tapped
**or** I reopened the calendar instead" to "the day was tapped", and a dead capture removed. Read
both diffs; neither can turn a failing build green. **The scope claim is true and I am not
refusing on it.**

## Release mechanics

- `index.html:9310` — `const APP_VERSION = 'app-v88';`
- `sw.js:1` — `const CACHE = 'chemowell-app-v88-1';`
- Both moved, together, in the same release. This is the one mechanical thing that has silently
  cost Aaron a whole day before, and it is right.
- `README.md` carries an app-v88 version-history row, and it describes what actually shipped,
  including the four refusals and what each found. It is extremely long, but long is not wrong,
  and the content is accurate against the diff.

## Rule 0 — ChemoWell is a product, and no stranger's patient is in it

- No patient name, no gendered pronoun in any user-facing string, no care-plan dose, ceiling or
  schedule, no new behaviour keyed to a medication id. The suite's own ratchets report
  `0/0/0` against ceilings of `0/0/0` and the fence is gone.
- **The pronoun ratchet is honest, and I proved it rather than reading it.** It is two-sided — it
  fails if the count rises AND if the count falls without the pin being lowered — and it counts
  `she/her/hers/herself/he/him/his/himself` in `index.html`. I counted the same pattern at every
  commit of this release:

      app-v87 as published   36
      first v88 build        37
      after the suite commit 38
      after the delta-1 fix  36   <- back to baseline
      ... and 36 at HEAD

  So the two pronouns the first audit found in new comments were **actually removed**, not pinned
  in. The ratchet is set at the pre-release number. That is the right way to add a ratchet and it
  is the single best thing in this release's process.
- One cosmetic note, not a defect: the README row for this release says *"the box sends the draft
  only if **she** TOUCHED it"*. That is a repo document, not shipped code, so no ratchet covers it
  and no user reads it — but Rule 0's wording is "anywhere", and the next person copying that
  sentence into a comment moves the count. Worth a word on the next pass; not worth a round.

## The diff stayed where it said it would

`index.html` moved in ten places: the `daily` branch of `confirmTimeAndLog`, the two bowel-issue
helpers, `logAppetite` (and the deletion of the two dead writers), two Help topics, three regions
of `renderTimeModal`, the version and changelog constants, the day corrector, the daily value
logger, and the two report screens. **Nothing touches tiering, profiles, backup, restore, the
printable report, the sync backend, Capacitor or medication configuration.** I grepped the diff
for every tier-shaped token and it is clean.

---

# 2. The raw `release_check.sh` output

Run exactly as it stands, before my report existed:

    ℹ️  Suites will run against a clean export of HEAD at /tmp/tmp.VLcDB3G6zX
       (not the working tree -- see the app-v82 note above).
    ℹ️  Baseline: PUBLISHED.json -> app-v87 (chemowell-app-v87-1) at 68741a7
       6 commit(s) have changed index.html since that record. This gate assumes NONE of
       them are live yet. If any were already pushed, run ./mark_published.sh <that commit>
       first -- otherwise the comparison below is against the wrong build.
    ❌ RELEASE CHECK FAILED: the quality chain has not run for app-v88.
       Changed under rule 5: index.html sw.js
       missing: an outputs/PM*app-v88*.md sign-off
       AND a report on record REFUSES this release: outputs/AUDIT-app-v88-delta.md (examined 8e28f6f) says DO NOT SHIP.
       Fix what it found and re-run that stage against a later commit. A sign-off from a
       different desk does not answer it.
       AND a report on record REFUSES this release: outputs/AUDIT-app-v88-delta2.md (examined 5538d0a) says DO NOT SHIP.
       Fix what it found and re-run that stage against a later commit. A sign-off from a
       different desk does not answer it.
       AND a report on record REFUSES this release: outputs/AUDIT-app-v88.md (examined 814a767) says DO NOT SHIP.
       Fix what it found and re-run that stage against a later commit. A sign-off from a
       different desk does not answer it.
       Every suite passing is SELF-verification. CLAUDE.md rule 5 requires an independent
       Auditor pass and PM sign-off before this ships, with no size exception. Permission to
       push is not that gate.

    exit status: 1

**Reading it honestly, because the brief said anything beyond the missing sign-off is a blocker
and three other things are named.**

The three refusals it names are the superseded earlier rounds, and they are **not** outstanding.
That branch of the script fires only when a chain report is missing, and it deliberately names
every refusal sitting in the reports that do exist **without applying the supersession test** —
its own comment says so. The test lives further down: a refusal is cleared by a report from the
same desk, over 2000 bytes and 25 lines, examining a strictly later commit in this history and
clearing it. The delta-3 report at `64bb8a6` satisfies every clause for all three. So those three
lines are the pre-sign-off branch being blunt on purpose, not three live objections.

**What IS outstanding is further down the script and this run never reached it.** With a sign-off
present the gate continues past that branch to the design-time seat check, which fires whenever
`index.html` is among the changed rule-5 paths — it is — and requires both
`outputs/ENHANCER*app-v88*.md` and `outputs/DESIGN*app-v88*.md`. **Neither exists.** The second
run below, with this report in place, is the one that reaches it. The raw output is appended at
the end of this file so it cannot be mistaken for the first.

---

# 3. Ground one — a required seat produced no artefact. Twice.

This is the cheapest refusal available and it has been the right one on the last two releases.

## The Enhancer — satisfied in substance, and my brief asked me to say which and why

`outputs/ENHANCER-app-v87.md` is the pass that produced E-1 and E-2. It is named for the previous
release, and that is the correct name: Rule 1.5 puts this seat **before** the build, on the screens
about to change, and relative to app-v88 that pass is exactly that. It walked Reports → Bowel
Movement, Reports → Appetite, the Home banner, the daily check-in sheet and the matching Help
topics. It applied all six checklist items. E-1 came out of item 5 (a sibling screen already got
it right — Paracentesis and Weight both had the date step) and E-2 out of items 1 and 4 (a field
shown and exported that nothing can fill). Aaron read that list and approved both.

**So the thinking the seat exists for demonstrably happened, and demanding a second file purely
for the version number in its name would be the ritual this project has already written down twice
as a failure.** On substance, the seat is satisfied for *deciding what to build*.

**It is not satisfied for the screens as they now are, and that is a real gap rather than a
filing one.** app-v88 created a surface the v87 pass could not have seen: the shared time modal in
`daily`/`dateOnly` mode, carrying a value picker and a note box above the date pill, plus a note
field on the row corrector. Nothing has asked the Enhancer's questions of those. Three things are
sitting unasked right now:

- **Add/edit/remove symmetry on the new surface.** The modal can write a day and overwrite a day.
  It cannot remove one — that is back on the row. Defensible, probably correct, nobody decided it.
- **The bowel row still has no note**, which the brief declines and justifies. That is the
  Builder making the Enhancer's call in the Builder's own document. It may well be the right call;
  it is not an independent one.
- **The auditor parked a product question explicitly "for the Enhancer's next pass"**: back-filling
  an issue day after a fortnight of silence switches the Home banner on and counts from a
  two-week-old answer. He was right not to block on it and right to write it down. There is no next
  pass, so it is nowhere.

**Judgement: the v87 pass satisfies the seat's purpose for these two items; app-v88 still owes a
short pass on the screens it actually changed.** Short — the Enhancer is the cheapest seat on the
board and a pass that proposes nothing is written down as "nothing this time" and still counts.

## The Designer — not satisfied, and this is the one I would refuse on alone

TEAM.md stage 4: the Designer runs when the release "actually changes visual layout: new screens,
moved or resized elements, **new components**, anything where what's on screen physically changed."

app-v88 adds a `Log another day` button to two report screens, a note input to the daily logger, a
note input to the row corrector, and a note input plus a value picker into a modal that previously
held a date pill and a time field. That is four new components across three surfaces. **Every
release from app-v84 to app-v87 produced a Designer pass. This one, which adds more visible
controls than app-v87 did, produced none.**

And the hole is load-bearing, not clerical. All four audit reports close with the same exemption,
in the same words: *"`overflow-scan` at 320/360 — the Designer owns that."* The auditor was right
to say so and right not to do another seat's job. But the seat he deferred to never sat down. The
specific consequences:

- **Nobody has seen the new modal rendered at 320px.** It now stacks a value picker and a note
  input above the date pill, inside a dialog that caps its own height and scrolls internally. That
  is the single most likely place in this release for something to be clipped or unreachable, and
  it is unobserved.
- **Touch targets were read from source, never measured on a rendered page.** All four reports say
  the note inputs are set at the 16px iOS zoom floor and the button at `minHeight: 44px`, "read
  from the source". Reading a style declaration is not measuring a box; app-v87's Designer pass
  measured 46px on a rendered button and said so.
- **No screenshots exist at any width.** app-v87 shipped 21. app-v88 ships none.

**I ran `test/overflow-scan.mjs` myself, since nobody had.** It is not clean:

    170 of 170 screen/width combinations scanned, 3 overflowing element(s).
    NOT CLEAN
      iPhone SE (320px) — HOME / NO-STAY:HOME / NO-DATES:HOME
        "10:00 AM"  the wording is wider than the box it sits in by 5px · box 58x36

**And it is pre-existing, which I established rather than assumed** — I extracted app-v87's
published `index.html` and ran the same scan against it with `--file`, and got character-identical
output: the same three, the same element, the same 5px. **So this is not an app-v88 regression and
it must not be charged to this release.** Two things follow anyway. The scan does not reach the new
modal, so it tells us nothing about the surfaces this release added. And the last two Designer
passes both recorded "Horizontal overflow — clean" from their own per-screenshot measurement while
this suite was reporting three overflows on Home — the two instruments disagree and nobody has
noticed, which is a Designer-seat finding that only the Designer seat was ever going to make.

---

# 4. Ground two — the What's New notice shows raw markup to the caregiver

**Severity: LOW damage, HIGH visibility, and it is new in this release.** Nothing is lost and
nothing is mis-recorded. But it is the first thing every user sees after updating, it looks
unfinished, and Aaron has said the app cannot launch with known bugs.

`index.html:9320`, the first bullet of the app-v88 changelog entry:

    'Both the bowel movement and appetite screens now have **Log another day**: pick the day, …'

`whatsNewEntry()` at `index.html:9462` renders each point as `h('li', {…}, pt)` — a plain text
child. There is no markdown pass anywhere in the file. So the asterisks are printed.

**Demonstrated on the shipped file, not reasoned.** I seeded a profile, opened the What's New
screen and read the rendered text back:

    Both the bowel movement and appetite screens now have **Log another day**: pick the day,
    pick the answer, done.

    literal ** present in the rendered entry? -> true

`**Log another day**` is the **only** markdown markup in the whole `CHANGELOG` array. Every entry
from app-v86 back is plain prose. The convention existed; this release broke it.

**Why four audits read past it.** The Voice is merged into the auditor's brief on audited releases,
and all four rounds did read this copy — the first one even dissected the note sentence for
completeness. They were reading it as *text*, in the source, where `**` looks like emphasis a
reviewer's eye supplies for itself. Nobody rendered the page and read what a user gets. That is
exactly the same shape as Rule 5.5's lesson, one surface over: every gate here asks about the
source or the data, and the one that asks about the rendered screen is the Designer, who did not
run. **The two grounds for this refusal are the same hole.**

There is also a guard-shaped gap behind it: `test/v55-help.mjs` already carries *"no FAQ answer
renders literal `**` or backticks"*. The class was known and guarded for Help. The What's New list
is the other prose surface in the app and has no equivalent. One check, same shape.

**One more copy note for the same pass, not a blocker.** The fourth bullet reads *"Two unused
pieces of the old correction code are gone. Neither was reachable, and both still did it the old
way, by deleting the day and writing a new one."* That is an internal refactor described to a
caregiver in developer language, with no user-visible effect to report. Rule 2.7 exists because
four consecutive releases got this surface wrong, and one of them was wrong in precisely this way.
Recommend deleting the bullet rather than rewording it — a change nobody can see does not belong
in What's New at all.

---

# 5. Ground three — `BACKLOG.md` has nothing from this release

`grep -ic v88 BACKLOG.md` returns **0**, and the file's last commit is app-v87's. app-v85, app-v86
and app-v87 each added their deferrals. Hard rule 8 of this repo: a finding is fixed or it is
logged in `BACKLOG.md` plus the task list.

Named, justified and argued in the audit reports — and in no punch list anywhere:

| Carried as | What it is | Why deferring is right |
|---|---|---|
| M19 | the `surface` component of `noteKey` is unguarded; removing it was **verified to reproduce D2** | the strongest of these; one check closes it |
| M20 / M15 | the `day` component — the midnight-rollover key | needs an unsaved draft across a day boundary |
| M21 | the `kind` component | unreachable until bowel becomes noteable |
| M22 | `dailyLogBusy = true` ordering relative to the `try` | needs a render that throws |
| M11 | two new bolded control names in Help that nothing holds true | the known deferred class; belongs on the existing item, now +2 |
| M1 | the appetite day-map alone flipped to oldest-wins | caught by `v86`, blind in the v88 suite |
| — | month-boundary fragility in the suite's `pickDay` / `tapDay` helpers | a red that would be the calendar's fault, not the app's |
| — | `v75-no-other-patient` reads from disk and ignores `FALSIFY_BASE`, so it cannot be falsified the way every other suite here is | cost one auditor a wrong falsification; worth a comment |
| — | back-filling an issue day after a long silence switches the Home banner on from a stale answer | a product decision, already reachable in app-v87 |
| — | the overflow-scan vs Designer-screenshot disagreement on Home at 320 (**mine, pre-existing**) | two instruments, one unnoticed contradiction |

Writing these down costs minutes. Leaving them in four audit reports means the next person has to
read four audit reports to find them, which is the same failure as a role whose output is a file
nobody opens.

---

# 6. Every finding, every round, and whether anything was dropped

**Round 1 — refused at `814a767`.** Eight findings.

| # | Finding | Status now |
|---|---|---|
| 1 | **BLOCKER** — the modal sent "clear the note" on every confirm; a day's note silently deleted | **Fixed and guarded.** Opener sends `undefined`; box shows the day's note. Re-armed by check 7b2 after the guard was disarmed in round 3 — see below. |
| 2 | **BLOCKER** — double-tapping Confirm wrote duplicate rows with identical stamps, neither superseded | **Fixed and guarded.** Modal closes before the await, plus a busy flag; the guarding mutant turns two checks red, one of them naming the stamp collision rather than the symptom. |
| 3 | MEDIUM — Cancel on the row corrector kept the typed note, which later became the standing note | **Fixed and guarded** (check 7e). |
| 4 | MEDIUM — suite section 3 vacuous, proven: it matched the toast, not the row | **Fixed and falsified.** Reads the day's own row container; the mutant pair that beat it now turns it red. |
| 5 | MEDIUM — three mutants clean-passed the new suite (M5, M6, M1) | **Two fixed** (M5 and M6 now 51/52 each, confirmed by the next auditor independently). **M1 carried**, caught by `v86` — but it drops out of the reports from round 3 onward and is in no backlog. |
| 6 | LOW — two new bolded Help control names nothing verifies | Deferred, justified. **Not in `BACKLOG.md`.** |
| 7 | LOW — two new gendered pronouns in code comments | **Fixed, and better than asked**: removed, count returned to baseline, and a two-sided ratchet added. I verified both directions of the count independently. |
| 8 | LOW — logger draft key ignored the day (midnight rollover) | **Fixed mid-round — and the fix created D2.** See the judgement below. |

**Round 2 — refused at `8e28f6f`.** Six findings.

| # | Finding | Status now |
|---|---|---|
| D1 | **BLOCKER** — one note, mutable day: switching days wrote a note onto the wrong day, or deleted one unseen | **Fixed and guarded.** Picking a day re-reads that day's note; two mutants turn it red four and six times, both shapes, display and write. |
| D2 | MEDIUM — **introduced by round 1's fix to finding 8**: logger and today's corrector shared one draft | **Fixed** via `noteKey(surface, kind, day)`. The `surface` component is itself unguarded (M19). |
| D3 | MEDIUM — the two sections added were the wrong two; M5/M6 still clean-passed | **Fixed** (fixture 7d2: untouched box, day with a note, different answer). |
| D4 | MEDIUM — the display check asserted an element exists, not that anything is in it | **Fixed**; the mutant that beat it now turns four checks red. |
| D5 | the pronoun ratchet is sound, both directions | Confirmed — and I re-confirmed it by a different route. |
| D6 | confirmations of round 1's fixes | Held. |
| — | `dailyLogBusy = true` sat outside the `try` | **Moved inside**, confirmed by the next round. |
| — | a stale comment describing the old key shape | **Fixed** — both comments now read "Keyed by … AND day". |

**Round 3 — refused at `5538d0a`.** Three findings.

| # | Finding | Status now |
|---|---|---|
| E1 | the day-change reset fired on **every** calendar tap, so re-tapping the selected day discarded typing | **Fixed and guarded** (check 7g; the mutant turns it red). |
| E2 | **the fix for D1 had disarmed the guard for blocker 1 — restoring the original blocker scored a clean pass** | **Fixed and guarded** by check 7b2, which confirms without touching the calendar and so cannot be overwritten by any future reset. Two red under the mutant. |
| E3 | all three components of `noteKey` deletable with the suite green | M19 **named as the one that matters** and verified to reproduce D2. Carried. **Not in `BACKLOG.md`.** |

**Round 4 — cleared at `64bb8a6`.** It did the thing that makes the clearance worth something: it
re-ran every mutant the suite had been catching before the edit, rather than assuming a
one-expression calendar change was local. Five unchanged, one stronger. It also falsified the
`prevDay` capture ordering rather than reading it, and showed that the subtle version of that
mistake is indistinguishable from the blunt one to the suite — which is the correct standard.

**Was anything dropped between rounds?** Substantively, no: every blocker and every MEDIUM was
either fixed with a falsified guard or carried forward with a stated reason. Two small drops worth
naming. **M1** stops appearing from round 3 onward and is not in round 4's carry-forward list,
though the gate does still catch it in `v86`. And **the auditor's product question about a
back-filled stale day** was explicitly handed to "the Enhancer's next pass", which does not exist.
Both are documentation drops, not code drops, and both are symptoms of the same thing: there is no
list outside the audit reports, because `BACKLOG.md` was never updated.

---

# 7. Judgement one — four rounds on a two-item release

**Mostly a process working. One clear instance of the builder changing more than the minimum, and
it cost a full round.** The evidence, round by round:

- **Rounds 1's two blockers were in code this release wrote.** Both are one-line orderings inside
  the single new branch of `confirmTimeAndLog()` — `note: ''` at the opener, and awaiting the write
  before closing the modal. A new write path on a medical record, got wrong in two places, caught
  before it shipped. That is the process doing its job, and no amount of restraint avoids it.
- **Round 2's blocker traces to one structural decision, not to churn.** The brief chose to hold
  the modal's note in a bare value on the modal object while the other two surfaces use a keyed
  draft map. The auditor named it exactly: the *rule* is one rule, the *mechanism* is two. D1 and
  E1 are both consequences of that asymmetry. One decision, two rounds. Arguable, not careless —
  and the final round was right to refuse the refactor that would close it, on the grounds that
  changing more than the minimum late in a release is what produced the turnovers in the first
  place.
- **Round 3's E2 — the fix that disarmed the guard for the first blocker — is the opposite of
  scope creep.** Nothing anyone could have avoided by being more disciplined; it is only findable
  by re-running the previous round's mutant, which is why it is the most valuable thing here.
- **And then the one that is scope creep.** Round 1's finding 8 (the midnight-rollover draft key)
  was explicitly filed as a **measurement for the backlog** — the auditor's closing paragraph said
  in terms *"do not spend a round on findings 6, 7 and 8."* It was fixed anyway, inside a blocker
  round, and the fix created D2: two visible note boxes on one screen sharing a draft, so cancelling
  one silently emptied the other. **A deferred measurement was turned into a fix, and the fix was a
  new MEDIUM defect.** That is one round of the four, charged squarely to changing more than the
  minimum.

So: three rounds of a process catching real defects on a genuinely new write path, and one round
of self-inflicted work. Four rounds on two items is not evidence of a broken process here. It is
close to the ceiling of what is tolerable, though, and the thing that would most reduce it is not
more rounds — it is the Enhancer and Designer seats running before the build, which on this release
did not run at all.

## Is the lesson now in `TEAM.md` the right lesson?

**Yes, and it is well written — but it records the detection and not the cause, and it has no
mechanism.**

What it says — *after any fix, re-run the mutant the previous round was catching; not the suite,
the suite is green either way* — is exactly right, costs minutes, and is demonstrably the only
reason this release is not shipping with its first blocker unguarded. A disarmed check and a
passing check are indistinguishable from inside. That belongs on the wall. The corollary it adds —
that a precondition tolerating *"I did not do the thing"* is a free pass — is also right and was
also paid for.

Two things I would add before calling it finished:

1. **The missing half: in a fix round, fix the finding and nothing else.** A backlog measurement is
   not a fix request. The release has a worked example — finding 8 fixed inside a blocker round
   produced D2 — and the new section does not mention it. As written, the lesson institutionalises
   catching the damage rather than not causing it.
2. **It is prose with no mechanism, and this project's own record says that is how a rule gets
   skipped.** The Enhancer's output rule needed the release message to carry it; the task list
   needed the table in the message. The cheap mechanical version here: the audit brief gains a
   required section — *the previous round's mutant board, re-run, with before/after counts* —
   so an audit that skips it is visibly incomplete rather than silently thinner. Round 4 did this
   voluntarily and produced a six-row table; making that table a required artefact costs nothing
   and does not depend on anyone remembering.

---

# 8. Judgement two — scope

**It delivered what Aaron asked for, and it stayed inside it, with one excursion.**

He approved two things from the app-v87 Enhancer pass with *"those both need fixed also."* Both are
built:

- **E-1** — both report screens carry `Log another day`. It opens the modal every other screen
  already uses rather than a second date pattern, which matters because a duplicated pattern is the
  defect app-v87 existed to fix. A future day is refused with a reason rather than silently. A
  back-filled day supersedes the existing answer instead of duplicating it, by routing to the
  shipped writers rather than a new one.
- **E-2** — the appetite note can be written, edited and cleared, from the logger and the row
  corrector, after two releases spent writing rules for data nothing could create.
- The two dead delete-then-relog writers are gone, which the brief named up front and justified:
  dead code doing the wrong thing beside live code doing the right thing is how the wrong one gets
  wired back up.

Things it correctly did **not** do: no note on the bowel row (declined in the brief with a reason —
it would mean adding a display and an export column Aaron did not ask for); no refactor of the
modal's note into the keyed draft map, deferred by the final round to its own release with its own
chain; no tier work, no med-id behaviour, no new screens.

The one excursion is the one above — fixing a deferred backlog measurement inside a blocker round,
which cost a round and introduced a defect. The note box appearing in the modal as well as on the
two surfaces Aaron's item named is **not** an excursion: once you can log a past day and a note
exists, a modal with no note box would have been the note-destroying path, which is precisely what
the first blocker was.

**Nothing in this release contradicts the tier model.** I checked the diff specifically: it touches
no gating, no profile limits, no backup, restore or printable-report code. Everything it adds is a
single-user logging feature, which under Aaron's decision is free forever. The Plus boundary is
untouched and nothing here would need to move when it lands.

---

# 9. What has to happen before this ships, in order

Small, and none of it is a redesign.

1. **Remove the two asterisk pairs from the app-v88 changelog bullet** (and, recommended, delete the
   fourth bullet about the deleted internal functions). **This changes `index.html`, so the
   clearance at `64bb8a6` goes stale and a short delta audit is required** — one string, but the
   gate measures drift on rule-5 paths, not significance. Do not let it ride as "only a string";
   that is the reasoning this release was already refused for once.
2. **Add the guard**, because the class is already guarded one surface over: assert no changelog
   point renders a literal `**` or a backtick, the way the Help suite already does.
3. **Run the Designer seat** and write `outputs/DESIGN-app-v88.md`: the two report screens, the
   daily logger, the row corrector with its note open, and the new modal with the note box and the
   calendar open, at 320 / 360 / 390. Measure the touch targets on the rendered page rather than
   reading the style. Record the three pre-existing Home overflows at 320 as pre-existing, and
   record the disagreement between the two overflow instruments.
4. **Run a short Enhancer pass** on the surfaces app-v88 added and write `outputs/ENHANCER-app-v88.md`
   — carrying forward the back-filled-stale-day question the auditor parked for it. "Nothing this
   time" is a legitimate result and still counts.
5. **Write the ten deferred items into `BACKLOG.md`**, with M19 at the top as the strongest.
6. Re-run the six suites and `./release_check.sh`, and send it back to a PM.

Steps 3 to 5 need no code change and no further audit. Step 1 does.

---

# 10. For Aaron

**Short version: the two things you asked for are built and they work. I am not letting it go out
today, for one thing you would see and two checks that nobody ran.**

**What you asked for, and what a caregiver gets.** You approved two fixes. Both are done.

The first: you could already correct a day you got wrong, but there was no way to fill in a day you
missed. Two days in hospital simply had no answer and nothing on screen explained why. Both the
bowel and appetite screens now have a button that lets you pick a past day and answer it. It uses
the same date picker the weight and paracentesis screens have always used, so there is nothing new
to learn. Picking a day in the future is refused, with a reason. Picking a day that already has an
answer replaces it and keeps the old one in the records your care team reads, exactly like
correcting a day does.

The second: the app had been showing a note on each appetite day and putting it in the file you
share with the care team — and there was no way to write one. Two releases had carefully worked out
what should happen to that note when the answer changes, for a note that could not exist. There is
a box for it now, on the appetite screen and on any day you correct, and emptying it clears the
note.

**Why I am holding it.** Three reasons.

The first is the only one you would notice. The "What's new" note that appears after an update has
two stray asterisks in it — the words come out as `**Log another day**` instead of bold. Nothing is
broken behind it; it just looks unfinished, on the first screen everyone sees after updating. You
have said the app cannot launch with known bugs, and this is a known bug with a two-character fix.

The second is that two of the review seats never ran on this release. One of them is the person
who looks at the screens on a small phone and checks that nothing is clipped, nothing is too small
to tap, and nothing spills out of its box. This release puts four new controls on screen —
including a note box inside a pop-up that was already fairly full — and **nobody has looked at any
of them on a phone-sized screen.** The reviewers who did look said each time that this was somebody
else's job, and they were right; that somebody never sat down. Every release since the end of
August has had that pass. This one does not.

The third is bookkeeping, and it matters to you more than it sounds. The reviews found about ten
small things that were deliberately left for later, each with a good reason. None of them got
written onto the running list of known-small-stuff. If they are not on that list, the only place
they exist is inside four long review documents, and in practice that means they are lost.

**What was deliberately not checked, and you should know it.** There is no iPhone here. Everything
visual was checked in a desktop browser pretended into phone-sized windows. That catches most
"text spilling out of its box" problems and catches none of the ways Apple's browser differs.
**Nothing in this release has been on a real phone, yours or anyone's.** That has been true of
every release here and it stays true of this one.

**What to check yourself, once it does go out.** Open the appetite screen and tap the new button.
Pick a day from last week, pick an answer, and type a note. Then do the fiddly version: open it
again, type something, change your mind about which day you meant, and pick a different day — the
note box should refill with whatever that new day already had, not keep your typing. That exact
sequence was broken twice during this release and is the thing most worth a minute of your time.
Then check both screens on the smallest phone you have, because that is the check nobody here has
done.

**Timing.** Fixing all of this is short — a two-character text change, one screenshot pass, one
short review write-up, and a list updated. The text change does mean one more quick review round,
because it touches the app file and the rules here do not let an app-file change ride on an
approval given before it. None of it touches the Plus-versus-free decision you made, and nothing in
this release goes anywhere near it: everything added here is a single-user feature and stays free.

---

# Appendix — `./release_check.sh` with this report in place

Run again after writing this file, so the gate reaches the checks the first run exited before.
Raw output:

    ℹ️  Suites will run against a clean export of HEAD at /tmp/tmp.Y4hiWMWykw
       (not the working tree -- see the app-v82 note above).
    ℹ️  Baseline: PUBLISHED.json -> app-v87 (chemowell-app-v87-1) at 68741a7
       6 commit(s) have changed index.html since that record. This gate assumes NONE of
       them are live yet. If any were already pushed, run ./mark_published.sh <that commit>
       first -- otherwise the comparison below is against the wrong build.
    ❌ RELEASE CHECK FAILED: the design-time seats have not run for app-v88.
       missing: an outputs/ENHANCER*app-v88*.md pass
       missing: an outputs/DESIGN*app-v88*.md pass
       These run BEFORE the build, on the screens about to change (TEAM-ORDER.md).
       An Enhancer pass that found nothing is written down as 'nothing this time' and still
       counts. Silence does not -- that is the failure this gate exists for.
    ❌ RELEASE CHECK FAILED: a chain report refuses this release, and nothing supersedes it.
       These say DO NOT SHIP:
         outputs/PM-app-v88.md — examined e0b7f98
       A refusal is cleared by re-running that stage against a LATER commit and it saying
       SHIP — not by adding another file beside it.

    exit status: 1

**This settles the reading of the first run, by running it rather than arguing it.** The three
earlier audit refusals have vanished from the output — the supersession test applied and cleared
all three, exactly as I said it would. What is left is the design-time seat failure, which the
first run exited before reaching, and this report's own refusal.

So the honest answer to "is anything outstanding besides the missing sign-off" is **yes, two
seats** — and it was not visible until a sign-off existed to let the gate get that far. That is
worth a line in the script's own notes: a gate that cannot report its later failures until its
earlier ones are cleared will always under-report on the run people actually look at.
