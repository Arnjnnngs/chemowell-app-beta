AUDITED-COMMIT: cb78237
VERDICT: SHIP

Independent Project Manager gate, ChemoWell app-v88, branch
`claude/caretracker-team-review-i83ik2`, HEAD `cb78237`. I did not build this release and I did
not audit it. This replaces my refusal at `e0b7f98`.

**All three grounds I refused on are cleared, and I re-verified each one myself rather than
reading that it had been done.** The live defect is gone from the rendered page. Both missing
seats produced real passes. The ten deferrals are on the punch list. The guard that was written
for the defect has been widened, and — the part that mattered most to check on this release — the
widening did not retire the checks it already had.

Three small things are open. None of them is reachable by a caregiver, none needs another audit
round, and one of them should be folded into the commit that lands this. They are named in
section 7.

---

# 1. What I verified myself at `cb78237`

## All seven suites, run by me, every one printed a count

| Suite | Expected | **What I got** |
|---|---|---|
| `test/v88-log-a-missed-day.mjs` | 58/58 | **58 checks: 58 passed, 0 failed** |
| `test/v87-correct-a-past-day.mjs` | 64/64 | **64 checks: 64 passed, 0 failed** |
| `test/v86-logging-and-labels.mjs` | 87/87 | **87 checks: 87 passed, 0 failed** |
| `test/v84-whatsnew.mjs` | 100/100 | **100 checks: 100 passed, 0 failed** |
| `test/v75-no-other-patient.mjs` | 29/29 | **29/29 checks passed** |
| `test/v55-help.mjs` | ALL GREEN | **ALL GREEN** |
| `test/v57-search.mjs` | 53/53 | **53/53 exact, 0 recovered in top 3, 0 missed — ALL GREEN** |

The three that carry a README-figure self-check passed it, so the documented numbers are the real
ones.

## The scope claim behind the re-clearance — checked, holds exactly

    git diff --stat 65bcb2c..HEAD -- index.html sw.js   ->  (empty)
    git diff --name-status 65bcb2c..HEAD                ->  A outputs/AUDIT-app-v88-delta4.md
                                                            M test/v84-whatsnew.mjs
    md5 index.html  65bcb2c == HEAD  (6c24a321c5cb91db811896a3043c1b07)
    md5 sw.js       65bcb2c == HEAD  (ddca18c584047ad841e81a790d10364c)

And the ordering is right, which is the thing I was explicit about last time: the `index.html`
change landed in `b17a418`, and the re-clearance examined `65bcb2c`, which is after it. **The
string change did not ride on an approval given before it existed.**

The whole `index.html` delta since my refusal is three lines inside `CHANGELOG`: the bullet
reworded to `a “Log another day” button`, and the fourth bullet deleted. I read the diff; nothing
else in the file moved.

## Release mechanics and Rule 0 — unmoved and still right

- `index.html:9310` — `const APP_VERSION = 'app-v88';`
- `sw.js:1` — `const CACHE = 'chemowell-app-v88-1';`
- Pronoun count at HEAD: **36**, against a ratchet pinned at 36 and failing in both directions. The
  string edits moved nothing.

---

# 2. Ground two — the live defect. Cleared, and checked three ways.

**On the rendered page.** I re-ran the same probe that found it, on the shipped file, reading the
app-v88 entry's `innerText` off the What's New screen:

    Both the bowel movement and appetite screens now have a “Log another day” button:
    pick the day, pick the answer, done.

    literal ** in the rendered entry? -> false

Three bullets, no blank one where the fourth was, no stray punctuation, no page error.

**Across every entry, independently of the guard** — because a guard this specific could not tell
me, and that is the whole lesson of this finding. I parsed the `CHANGELOG` block out of the shipped
file and scanned every string literal in all nine entries for double asterisk, single asterisk,
underscore, backtick, tilde, markdown link and heading:

    changelog string literals scanned: 64
    entries: 9
    >>> NONE — every changelog string is plain prose

That reproduces the delta-4 figures exactly, arrived at separately.

**And the second edit was right.** Deleting *"Two unused pieces of the old correction code are
gone. Neither was reachable…"* is a copy fix, not a scope reduction — nothing a caregiver can do
changed, and telling a tired person at 2am that something invisible to them was removed invites a
worry the sentence cannot answer.

---

# 3. The guard — I falsified it myself, with the full family plus the two it already held

This is the check that decided the verdict for me, so I did not take the figures. I ran a
seven-mutant sweep with `./falsify.sh`, which applies each mutant to a throwaway clone of HEAD on
its own port and never touches the working tree.

**Baseline on the clone: 100/100.**

| Mutant | What it plants | Before the widening | **My run** |
|---|---|---|---|
| MD | `**Log another day**` — the defect that shipped | caught | **2 red — still caught** |
| MC | `` `Log another day` `` | caught | **2 red — still caught** |
| MA | `*Log another day*` | clean pass | **2 red — now caught** |
| MB | `_Log another day_` | clean pass | **2 red — now caught** |
| MF | `[Log another day](#reports)` | clean pass | **2 red — now caught** |
| ME | `**bold**` in the app-v87 entry, reachable only behind *See recent updates* | clean pass | **1 red — now caught** |
| MG | `## ` heading in a point — **mine, nobody had tested it** | never tested | **1 red — caught** |

    === 7 mutant(s) caught, 0 survived, 0 could not be measured, 0 anchor(s) stale

**MD and MC are the two that matter most and they are the reason I am signing.** This release's own
written lesson is that a fix can quietly retire the check for the thing it fixed, with nothing
going red to say so — it happened here once already, to the guard for the first blocker. A
widening is a fix. So the question was not "does the new pattern catch more" but "does it still
catch what it caught". It does, at the same strength, and I measured it rather than inferring it
from the pattern being a superset.

I also confirmed the click-through is real rather than asserted: the precondition reports **9
entries on screen**, and ME — markdown planted in an entry that is invisible until you tap *See
recent updates* — goes red. Eight entries that were unguarded an hour ago are guarded now.

---

# 4. Ground one — the two seats. Cleared, and both passes are real.

## Designer

`outputs/DESIGN-app-v88.md`, with twelve screenshots in `outputs/design-app-v88/` at 320, 360 and
390, device scale 2. It measures on the rendered page rather than reading declarations, which is
the distinction that mattered on this release.

What it establishes, and what I spot-checked independently in the source rather than taking on
trust: **all three new text inputs are `fontSize: '16px'`** with a 46–48px box — I read each of the
three element definitions myself, and the one that looked like an exception in a crude grep was the
11.5px *label* above an input, not an input. Below 16px, iOS Safari zooms the page on focus and
throws the caregiver out of their place mid-sentence; all three clear it.

Also measured there: zero controls under 44px in the new dialog, enumerated rather than asserted;
no horizontal overflow at any of the three widths; and the tallest state the release builds — the
dialog with its calendar open — at 776px with Confirm at y=785 of 844. **59 pixels of margin is
thin but real**, and the pass says so plainly rather than rounding it up, and flags that a shorter
phone will need the dialog's internal scroll.

**And it carries my `overflow-scan` finding honestly**, including the part that is uncomfortable:
three overflows on Home at 320px, proven pre-existing against app-v87's published file and
therefore not chargeable here — **but the last two Designer passes recorded "clean" while that
suite reports three, two instruments disagree, and nobody had noticed.** It says it does not yet
know which instrument is wrong rather than guessing. That is the right way to leave a finding one
does not have the answer to.

## Enhancer

`outputs/ENHANCER-app-v88.md`, scoped exactly as I judged it should be — the surfaces app-v88
*created*, since the app-v87 pass already covers the two items themselves. Four proposals, none
built, all for Aaron:

| | Proposal | Size | Its recommendation |
|---|---|---|---|
| E-1 | Remove inside the dialog | — | **Nothing this time** — correctly absent, and it says why, so a later pass does not "fix" it |
| E-2 | Make missing days visible in the history list | S | **Not now** — risks reading as nagging |
| E-3 | Say on the bowel screen that notes live on appetite | S | **Recommended**, with any future bowel-note work |
| E-4 | Banner names the day it is derived from | S | **Proposed** — Aaron's call |

E-4 is the item the delta-1 audit explicitly parked for this seat and which was, at the time of my
refusal, nowhere. It now has an answer: the behaviour is documented semantics rather than a defect,
it was already reachable before this release, and the honest mitigation is one line of copy so
Aaron chooses it rather than inherits it. **That is the question answered, not deflected.**

---

# 5. Ground three — the deferrals

Ten items in `BACKLOG.md`, each with why it is deferred and what it costs, **M19 first** as the
only one verified to reproduce a real defect. I read them. They match what the four audit rounds
actually carried, including the two I flagged as having quietly dropped out of the reports: M1,
which stopped being named after round three while its guard survived elsewhere, and the
instrument disagreement about overflow.

The entry for M1 carries the right reason, in one sentence I would keep: a finding that drops out
of the record while its guard survives is how a guard gets deleted later as unused.

---

# 6. The two things you asked me to push back on

## Taking the guard widening now rather than deferring it to v89 — **I agree, and it is the right call**

The reasoning holds and it is not a close one:

- **It is test-only.** `test/v84-whatsnew.mjs` is not a rule-5 path, so it costs no re-clearance,
  and I confirmed `index.html` and `sw.js` are byte-identical across it.
- **A round is what costs time, not a suite run.** The thing this release has twice been told not
  to spend is a *round*. Running a sweep is minutes.
- **And the decisive one: the alternative was shipping with a guard known-narrow on the exact
  defect that caused the refusal.** The audit measured three markdown forms that render literally
  and scored clean. Leaving that in place for a release and writing "v89 will widen it" is how a
  guard becomes a regression test for last week — and this project's record is full of guards that
  were going to be widened next time.

The thing that would have made me disagree is if the widening had cost anything it was not
entitled to, and the sweep says it did not: the two mutants it already caught still go red at full
strength. **A widening that holds its old ground is free; one that does not is a disarmed check.**
I checked which this was before agreeing with it, which is the only reason my agreement is worth
anything.

The consistency question is worth answering out loud, since you took one deferred fix now and not
the other: **they are different categories, and taking one and not the other is correct.** The 7z
widening is a test change that closes a known gap in the guard for this release's own defect. The
`release_check.sh` reporting fix below is a change *to the gate, while the gate is gating this
release*. Those are not the same risk and should not get the same answer.

## My `release_check.sh` finding being unfixed — **it does not block, and I would not fix it here**

The finding stands: the pre-sign-off branch exits before reaching the design-time seat check, so
the run people actually look at under-reports what is outstanding. On this release that was not
cosmetic — the two missing seats were invisible until a sign-off file existed to let the gate get
that far, and I only found them by reading the script.

But it does not block, for three reasons:

1. **The exit code was always right.** Nothing can ship through this. The defect is in which
   reason the reader is sent to look at, not in whether the gate holds.
2. **Every check still runs.** Nothing is skipped; the later ones are merely reported later.
3. **Changing the gate while it is gating this release is the riskier act.** This file's own
   comments record five occasions where a gate failed silently in precisely the case it was written
   for, several of them introduced by a well-meant tightening. Doing that now, to a release that is
   otherwise finished, is the "changing more than the minimum" failure wearing the better motive —
   which is the judgement I made against this release's own round two, and I am not going to make
   the opposite call when it is my own finding.

**First commit of app-v89**, with the two items below. Not now.

---

# 7. What is open, and none of it blocks

**(a) The README version-history row was not updated, and this one I would fold into your commit.**
The app-v88 row still describes a four-round release. It does not record that the What's New notice
printed literal asterisks to every user after an update, that it was caught by the PM and fixed,
that the fourth bullet was removed as developer language, or that the Designer and Enhancer seats
ran late and what they found. Nothing in it is *false* — the behaviour it describes is the
behaviour that ships — but the row is the durable record of this release, and the one
caregiver-visible defect it had is missing from it. **`README.md` is not a rule-5 path, so this
costs no re-clearance and no round**; it is a paragraph, and the right time is the commit that
lands this.

**(b) The guard's failure message is blind for four of the seven mutants. New, mine, measured.**
The matcher was widened and the *detail string* was left behind — it still searches
`.{0,30}(\*\*|`).{0,30}`, so for a single asterisk, an underscore, a link or a heading the output
reads:

    FAIL  and it contains no literal markdown ...  |  2 found: []

The count is right and the check fails correctly — **it is not vacuous** — but it cannot say what
it saw. That is the exact class this release's own first audit named in its Finding 4: a failing
line that cannot report its evidence is how a check gets rewritten wrongly later. One line.

**(c) The two patterns in 7z have drifted apart.** The on-screen check matches headings
(`^\s*#{1,6}\s`); the every-entry scan does not. So a `##` planted in one of the eight entries
behind *See recent updates* is caught by neither — my MG mutant proves the asymmetry from one side
(1 red, not 2). No live instance: my own 64-string scan included the heading form and came back
clean. One character class, shared.

(b) and (c) are both one-line test edits and belong with the gate fix in v89's first commit.

---

# 8. The judgements, unchanged and now with the fifth round in evidence

**Five rounds on a two-item release.** My earlier reading was that this was mostly a process
working with one clear over-reach — round one's finding 8, a deferred measurement fixed inside a
blocker round, which created D2. The fifth round does not change that and adds something better:
it found a real guard-breadth gap, named the product as correct anyway, and **declined to refuse
over it**, on the explicit ground that nothing a caregiver could reach was wrong. That is the
judgement this chain has been bad at — it has twice run guard-polish rounds past their value — and
getting it right once is worth more than the finding.

The round also produced the pair to the lesson already in `TEAM.md`, and it is the cheaper of the
two: **for any string a caregiver reads, look at the rendered page once, as a reader, not as a grep
target.** Both of this release's last two findings — the asterisks and the four unseen controls —
were invisible to everything except somebody actually looking at the screen. I would put that line
in `TEAM.md` beside the mutant rule, and I would also record the detail that makes it stick: the
rendered asterisks were sitting in an auditor's own probe output in round one, in a dump that was
being read for something else. **Output nobody reads as a whole is not coverage.**

**Scope.** Unchanged: it delivered exactly the two things Aaron approved and stayed inside them.
The only additions since my refusal are the two changelog edits, two seat reports, twelve
screenshots, ten backlog lines and a widened test. **Nothing in this release touches tiering,
profiles, backup, restore or the printable report**, so nothing in it contradicts the decision that
every single-user feature stays free and Plus buys only the three patient profiles. I re-checked
the diff for that specifically.

---

# 9. For Aaron

**Short version: it is ready. I held it yesterday for three things and all three are fixed. The two
features you asked for work, and I checked them myself rather than taking anyone's word.**

**What you get.** Two things, both of which you approved.

You could already correct a day you got wrong, but there was no way to fill in a day you missed.
Two days in hospital simply had no answer and nothing on the screen said why. Both the bowel and
appetite screens now have a button that lets you pick a past day and answer it, using the same date
picker the weight and paracentesis screens have always used. A day in the future is refused, and it
says why. Picking a day that already has an answer replaces it and keeps the old one in the records
your care team reads — same as correcting a day.

And the app had been showing a note on each appetite day, and putting it in the file you share with
the care team, with no way to write one. Two releases had carefully worked out what should happen
to that note when the answer changes, for a note that could not exist. There is a box for it now,
on the appetite screen and on any day you correct, and emptying it clears the note.

**What I held it for yesterday, and what happened.**

The stray asterisks in the "What's new" note are gone — it now reads *a "Log another day" button*,
in plain words. I opened the app and read it off the screen to be sure, rather than checking the
code. A bullet that told you two invisible pieces of old code had been deleted is also gone; it was
written for a developer and it only invited a worry it could not answer. And there is now a test
that opens that notice and reads it the way you would, so this cannot come back quietly — I tried
seven different ways of breaking it and the test caught all seven.

The two missing reviews both ran. The one that looks at the screens on a small phone measured every
new control: all three new typing boxes are large enough that your phone will not zoom in and lose
your place when you tap one, nothing is too small to tap, and nothing spills off the edge at any of
the three phone widths. The one thing it flagged honestly is worth knowing: when you open the date
picker inside the new pop-up, it is the tallest thing this release builds, and the Confirm button
sits about 59 pixels from the bottom of a large phone's screen. That is enough — but on a smaller
phone you may have to scroll inside the box to reach it.

The other review looked at the new screens and made four suggestions. **None of them is built, and
none needs to be.** Two are small wording improvements, one is a question about whether the app
should show you the days you skipped, and one is about a surprise: if you fill in a day from two
weeks ago that was a bad day, the alert on the home screen will switch on and talk about it as
though it were current. That is the app working as designed — the most recent answer stands — but
it can startle you, and the suggestion is one line of text naming which day the alert is about.
**All four are yours to decide, whenever you want, and none of them is holding anything up.**

**What is deliberately exempt, and it has not changed.** There is no iPhone here. Everything visual
was checked in a desktop browser shrunk to phone size. That catches most "text spilling out of its
box" problems and catches none of the ways Apple's browser differs. **Nothing in this release has
been on a real phone, yours or anyone's.** That has been true of every release here and it is true
of this one.

**What to check yourself, on your own phone.** Three things, in order, about two minutes:

1. Open Reports, then Appetite. The note box and the new button are both there.
2. Tap the new button, then tap the date. That opens the tallest thing this release built — check
   you can reach Confirm without fighting the page. This is the one I would most like a real phone
   to answer.
3. Pick a day from last week, type a note, then change your mind and pick a *different* day. The
   box should refill with whatever that new day already had, not keep your typing. **That exact
   sequence was broken twice during this release**, so it is the minute best spent.

**One thing left over, and it is bookkeeping.** The release notes in the project's own history file
still describe this release as it stood yesterday and do not mention the asterisk problem or the
two late reviews. It should be brought up to date in the same commit that ships this. It changes
nothing about the app.

**And nothing here affects the free-versus-Plus decision.** Everything this release adds is a
single-user logging feature, which under your decision is free forever. The Plus boundary — the
three patient profiles — is untouched by every line of it.

---

# Appendix — raw `./release_check.sh`

Run with this sign-off in place. Raw output:

    ℹ️  Suites will run against a clean export of HEAD at /tmp/tmp.eLZZwpPm71
       (not the working tree -- see the app-v82 note above).
    ℹ️  Baseline: PUBLISHED.json -> app-v87 (chemowell-app-v87-1) at 68741a7
       7 commit(s) have changed index.html since that record. This gate assumes NONE of
       them are live yet. If any were already pushed, run ./mark_published.sh <that commit>
       first -- otherwise the comparison below is against the wrong build.
    ℹ️  Other reports present and not clearing this release:
         outputs/AUDIT-app-v88-delta.md — says DO NOT SHIP
         outputs/AUDIT-app-v88-delta2.md — says DO NOT SHIP
         outputs/AUDIT-app-v88-delta3.md — examined 64bb8a6; changed since: index.html
         outputs/AUDIT-app-v88.md — says DO NOT SHIP
    ℹ️  Chain artifacts present for app-v88, and current against the working tree:
         outputs/AUDIT-app-v88-delta4.md
         outputs/PM-app-v88.md
    ℹ️  v76-properties-equivalence.mjs: green.
    ℹ️  v76-empty-window-render.mjs: green.
    ℹ️  No-other-patient check: clean.
    ✅ Release check passed.
       index.html changed and sw.js's CACHE constant changed with it -- installed
       copies of the app will pick this up automatically on next open.

    exit status: 0

**Exit 0, and two details in it are worth reading rather than skipping.** The earlier rounds are
now listed as present-and-not-clearing rather than as objections, which is the supersession test
doing its job. And the round-three clearance is correctly marked **stale** — *examined `64bb8a6`;
changed since: index.html* — because the changelog fix landed after it. That is the staleness rule
working exactly as intended on the case I insisted on last time: the string change did not ride on
an earlier approval, and the gate can see that it did not. The pair clearing this release is the
re-clearance and this sign-off, and nothing else.

The reporting-order finding in section 6 is unchanged by this run and is still worth fixing in
v89: this output is informative *because* a sign-off exists. The run a person makes before writing
one still stops at the first failure.
