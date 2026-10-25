AUDITED-COMMIT: 242e07c
VERDICT: SHIP

Zero Day Audit — ChemoWell app-v87, SIXTH DELTA, CONFIRMATION PASS, branch
`claude/caretracker-team-review-i83ik2`. Subject `git diff b2d4ac3..242e07c`. Scope as requested:
confirm the delta is what it is said to be, confirm nothing in it breaks what the fifth pass cleared,
and give the gate a verdict against the current tree.

## HEADLINE

**The delta is exactly the four things claimed, the `index.html` change is comments only — proven, not
eyeballed — and all four targeted holes are closed with my own mutants.** Stripping every `//`-comment
line from `index.html` at `242e07c` leaves a file **byte-identical** to `b2d4ac3` (721,351 characters
both ways). So *"no application behaviour is touched"* is true and measured.

**One new thing, and it is a measurement rather than a defect: the new spread rule has a margin of one
word.** Threshold is three distinct values in a topic; the live corpus maxes out at **two**, in two
places, and the words are the most ordinary English in either list —
`rem-none-scheduled [bowel]: normal, none` and `sym-severity [symptom]: a skin reaction or rash, other`.
`sym-severity` is a topic about how bad a symptom was; the day it gains the word *headache* in passing,
the suite goes red with no defect present. That is the `values.length === 5` shape again, much milder —
it needs a future edit and the failure message names the words, so it is diagnosable in seconds — but it
is worth knowing before it happens rather than after.

**On the deferral: I agree it should not be in this release, and the reasons are below.** One loose end —
the README says the `renderHelpView` work *"is logged as its own work"*, and it is not in `BACKLOG.md`.

## 1 — IS THE DELTA WHAT YOU SAY IT IS? YES.

`git diff --stat b2d4ac3..242e07c`: `README.md` 1 line, `index.html` 12 lines, `test/v87-correct-a-past-day.mjs`
35 lines, plus the fifth audit report. Nothing else, and no fifth item.

**`index.html` — comments only, verified two ways.** Every added and removed line in the diff begins with
`//` (the filtered diff is empty). Then the stronger check, because a comment can hide a change on a line
that only looks like one: removing all `//`-prefixed lines from both revisions and comparing gives
`identical: True`, 721,351 characters each. The whole change is one contiguous comment block inside the
`helpProse` hook's preamble. Your belief about your own diff is correct.

**The three code changes are in the suite, and each is the one described:**

| # | Change | Where |
|---|---|---|
| P2f | `.split(symptomSentence).join(' ')` replaces the early `return` — the generated symptom sentence is now stripped like the bowel one, not used to skip the piece | enumeration block |
| P2d/P2e | separator class widened to `, ; / · – — - or and then`, plus a per-TOPIC spread counted at three or more distinct values | `listRe` and the new `topicHits` |
| D5-2 | the raise exemption now also requires the `q` to OPEN with an interrogative | `qIsAQuestion` |

**`README.md`** — *"every Help surface held in data"* replaces *"every surface the Help centre renders"*,
`renderHelpView` and its eight literals are named, the N4 measurement is corrected in your own words, and
the fifth pass's findings are recorded. The `index.html` comments narrow the What's New exemption to the
past tense and name the renderer gap beside the hook. All four as described.

## 2 — MEASUREMENTS, TAKEN RATHER THAN TRUSTED

Baselines, run here: `v87-correct-a-past-day` **64/64** · `v86-logging-and-labels` **87/87** · `v55-help`
**ALL GREEN** · `v57-search` **53/53 exact, ALL GREEN**. All four match your figures exactly.

**The four targeted holes, each closed by the rule meant to close it:**

| Mutant | Result | By which rule |
|---|---|---|
| **N4** — declarative claim in a `q` ending in `?` | **RED** `sym-bowel-confusion:q:diarrhea` | the claim rule; the interrogative-opening test bites |
| **P2d** — slash-separated symptom list | **RED** | **both** — the run rule quotes `"nausea / vomiting / fatigue / mouth sores / headache / dizziness"` and the spread rule names seven values |
| **P2e** — one value per step across six steps | **RED** | the spread rule alone, which is the shape it was added for |
| **P2f** — hand-typed list appended to the step printing the generated sentence | **RED** | the run rule fires, so the strip genuinely replaced the skip |

**Nothing I cleared has broken:**

| Mutant | Expected | Result |
|---|---|---|
| **N1** — pain promise restored **and** the control rendered (a TRUE claim) | must PASS | **64/64 PASSES** |
| **N9** — hand-typed four-of-five list as an extra step | red | red, run rule + spread |
| **MH** — bowel sentence drops `diarrhea` | red | red, `missing: diarrhea` |
| **MB2** — sentinel in the unanswered-day pre-fill | red | red twice: `index=-1 (BLANK)`, `1 before -> 2 after [normal,zz_unset]` |
| **N3b** — false claim in a Common-questions answer | red | red, `faq:add-med:diarrhea, faq:add-med:constipation` |

N1 is the one I most wanted to re-run: widening a separator class and adding a whole-topic counter is
exactly the kind of change that re-introduces a check which cannot pass on a correct app, and it did not.

## 3 — FINDINGS

### D6-1 — LOW-MEDIUM (future false positive). The spread rule's margin is one word, and the threshold does not scale with list length.

`test/v87-correct-a-past-day.mjs`, `if (spread.length >= 3)`. I measured the live corpus rather than
reasoning about it: replicated the strip-and-count against `helpProse()` across all **153** Help pieces.
Distinct values per topic, generated sentences removed:

| Count | Topic |
|---|---|
| **2** | `rem-none-scheduled [bowel]` — `normal, none` |
| **2** | `sym-severity [symptom]` — `a skin reaction or rash, other` |
| 1 | eleven more, almost all of them the single word `normal`, `none` or `other` |

Three is the right answer to the `normal and none` problem I raised and two would have been wrong. The
residue is that **two topics sit one ordinary word below the line**, and the words that would cross it
are not rare: `sym-severity` is the topic about *how bad it was*, so *headache* or *nausea* appearing in
it is an entirely natural edit, and it would fire with nothing wrong.

**The sharper half is the scaling.** Three of five bowel values is a majority — a real signal that
somebody has copied the list. Three of **nine** symptom forms is a third, and one of those nine is
`Other`, which appears in eight unrelated topics already. The symptom side is therefore the weak one, and
it is the side with the smaller margin.

Not a blocker, and not worth a fix in this release: it cannot fire on this build (measured), the failure
message names the offending words so a false positive is diagnosable at a glance, and the check earns its
place by catching P2d and P2e. Worth one line when the file is next open: either declare a stop-list of
`normal`, `none`, `other` and count the rest, or require the spread to be three **and** a majority of the
list — which keeps the bowel behaviour identical and removes the symptom-side risk entirely.

### D6-2 — LOW (record). The deferral says it is logged, and it is not logged where the rules say.

README line 14: *"The version with no next surface reads the rendered screen, and that is **logged as its
own work** rather than a sixth round."* It is described in that row and in the new `index.html` comment
beside the hook — both good — but it is **not in `BACKLOG.md`**, nor in `REQUESTS.md`, `TEAM-ORDER.md` or
`STATUS.md`. I grepped all four for `renderHelpView`, `bolded` and `bold…control name`; the only hit is an
unrelated app-v56 entry at `BACKLOG.md:294`.

This repo's own hard rule 8 names `BACKLOG.md` as where a finding goes when it is not fixed on the spot,
and the lesson written into Rule 2.6, Rule 0.7 and Rule 0.8 — three times, in those words — is that output
filed where the owner does not look is not output. A release row is a changelog, not a work queue. One
entry, carrying the eight literals and the two measurements, and the sentence becomes true.

## 4 — ON DEFERRING THE `renderHelpView` PASS: I AGREE, AND NOT NARROWLY

You asked for this now because it is the last cheap moment. My answer is defer, for four reasons I can
stand behind:

1. **The surface is clean today.** I read all eight literals in the fifth pass and re-checked them here.
   None makes a claim about a control, and the two medical-adjacent ones — the search-screen safety notice
   and its button — say only that the app cannot judge seriousness and to contact the care team, which is
   the truest sentence in the file. The gap is a missing guard, not a defect behind it.
2. **It is the only remaining item that needs machinery rather than a line.** Everything else this
   release found was a one-liner and was taken. Scraping Help's three levels, deciding which strings are
   claims, and keeping `helpProse()` for attribution is a design job, and design jobs done at the end of a
   six-round release are how the fifth and ninth vacuous checks got written.
3. **Pairing it with the bolded-name sweep is the right shape** and makes it bigger, not smaller — which
   is an argument for giving it its own brief, not for squeezing both in. Both ask the same question:
   hold Help to what the app renders. One pass that answers it properly beats two half-passes.
4. **The two things that make a deferral dangerous are already handled** — somebody knowing, and somebody
   having measured it — except for D6-2. Fix that and the deferral is safe.

## 5 — SCOPE I DID NOT RE-COVER

This was a confirmation pass and I treated it as one. I did not re-run the full mutant board, did not
re-read the Help corpus for truth beyond the eight renderer literals, did not re-audit the app paths
closed in rounds one to three, and did not re-check `v57-search`'s extraction (unchanged this round, and
verified loud in the fourth pass). Device coverage is unchanged and still exempt: Chromium at 390×844, no
iPhone, no Android, nothing on a real phone. `release_check.sh` read, not run — `outputs/` still carries
no `PM*app-v87*` sign-off and `PUBLISHED.json` still records `app-v86` at `a62069b`, so
`./mark_published.sh` is owed if any later `index.html` commit was already pushed.

## 6 — RULE 0

12 added lines in `index.html`, every one a comment. Zero patient-name matches, zero gendered pronouns
about a patient, zero care-plan dose/ceiling/schedule, zero new `med.id === '…'` branches. `APP_VERSION`
`app-v87` and `sw.js` CACHE `chemowell-app-v87-1` unchanged and still paired.

## WHY THIS SHIPS

The verdict I gave at `b2d4ac3` was that what remained were future problems rather than anything a
caregiver could hit. This delta takes three of those as one-liners, corrects two record sentences, changes
no application code at all — verified byte-for-byte — and leaves the same single item outstanding, now
named in both the file and the row. The four holes it set out to close are closed, measured with mutants
of my own, and the five results I had already cleared are unchanged. The one new finding is a check that
could in future fail on a correct app, with a measured margin of one word and a one-line remedy, and the
one record finding is a missing `BACKLOG.md` entry. Neither is a reason to hold a release that is now
strictly better than the one I passed.

## WORKING TREE

`git status --porcelain` empty before and after, except this report. `index.html` md5
`f80a7a1c878c1cc5160534e921bd4f19`, byte-identical to `242e07c`, re-verified after each of the nine
mutant runs. No app or test file edited as a fix, nothing committed, nothing pushed. Probe scripts live in
the session scratchpad. Loopback only — the server on 8899 was already listening and was left as found; no
other network, no Firebase, no `caretracker_*` collection touched.
