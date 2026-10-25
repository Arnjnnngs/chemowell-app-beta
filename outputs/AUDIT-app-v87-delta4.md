AUDITED-COMMIT: 9ec37ae
VERDICT: DO NOT SHIP

Zero Day Audit — ChemoWell app-v87, FOURTH DELTA PASS, branch `claude/caretracker-team-review-i83ik2`.
Subject `git diff 239593d..9ec37ae` — three commits, 57 lines of `index.html`, two suites, one README
row. Whole release remains in scope.

## HEADLINE

**You asked me to check the other patterns in 7c for the same class of error as the `diarrhea` one.
There is one, it is in the check added this round, and it means check E cannot pass on a correct app.**
`test/v87-correct-a-past-day.mjs:657`:

    const scaleClaim = /\b(1 ?(to|-) ?10|0 ?(to|-) ?10|pain scale)\b/i;

The app's control renders **`PAIN LEVEL (1–10)`** — U+2013 EN DASH, measured off the live form, not read
off the source. The alternation allows `to` or an ASCII hyphen and nothing else, so `scaleRendered` is
structurally false. **Mutant N1** restored the Help promise *and* forced `showPainScale` true on the
symptom path, so the claim became TRUE and the control was measurably on screen — the dialog's text grew
from 240 to 318 characters, a second `select` appeared, and `PAIN LEVEL (1–10)` was in it — and the check
still printed `rendered on the symptom form: false` and failed. So check E is not *"Help promises a
1-to-10 scale only if the form renders one"*; it is **"Help may never say 1-to-10"**, and it will go red
on a correct app the day the queued severity work lands and Help truthfully describes it. That is the
`values.length === 5` anti-pattern, in the release that exists to remove it, two rounds after the same
root cause — a pattern written against prose and never run against the app's own string. The app's own
dose parser at `index.html:7685` already writes `[-–]`; the suite did not.

**And the ratchets police one of the two arrays the Help centre renders.** `window.__v86Test.helpTopics()`
returns `HELP_TOPICS`. The Help screen renders `helpAllTopics() = HELP_TOPICS.concat(helpFaqTopics())`,
and `helpFaqTopics()` maps `FAQ_ITEMS` (`index.html:3992-4008`) into the **Common questions** category.
**Mutant N3b** appended the exact sentence this whole saga is about — *"Diarrhea and constipation can both
be logged from the Symptoms tab, whichever you find easier."* — to an existing Common-questions answer:
**63/63, v55-help ALL GREEN, v57-search 53/53 ALL GREEN.** The README says of the claim-check that *"one
occurrence is permitted anywhere in Help and everything else is a finding"*. It is anywhere in
`HELP_TOPICS`.

**Everything you said was fixed, is.** I re-ran the three round-3 survivors myself rather than taking
them: MH (bowel sentence drops `diarrhea`) is red and its failure line now names `diarrhea`, so your
pattern repair works; MI is red naming `numbness or tingling`; MK is red three times and names **both**
`diarrhea` and `constipation`. N2 (the pain promise restored, form unchanged) is red. The TDZ comment,
the `sym-log` required-note clause and the three new What's New points are accurate. `v57-search` still
dies loudly when its extraction list goes stale — N8 renamed `nonSelectableSymptomDenial` and it exited 1
with `Error: function not found`.

## BLOCKING FINDINGS

### R4-1 — HIGH. The new check cannot pass on a correct app. `test/v87-correct-a-past-day.mjs:657`.

The pattern, the rendered string, and the measurement are above. Two consequences, in order of cost:

1. **It will block a correct future release.** The claim is allowed back "the moment the control exists",
   which is the queued severity work. On the release that builds it, Help will truthfully say *1 to 10*,
   the form will render `PAIN LEVEL (1–10)`, and this check will report the app lying. Somebody under
   time pressure then has a red check describing a defect that is not there — the situation this repo
   has already paid for twice in `v57-search`'s `litre` check, whose own header records three false
   positives across two releases and years of nobody being able to fix it because the thing it
   complained about was correct.
2. **Today it passes for the wrong reason.** `!sevText || scaleRendered` is an implication, and `sevText`
   is null because Help says nothing — so the check currently asserts an absence. The positive half has
   never executed truthfully.

**Reproduced.** N1 as described; N2 (Help promise restored, app untouched) is red with the identical
message, which is how the two states became indistinguishable to it. I verified N1 reached the code
before claiming anything, precisely because a mutant that does not reach the code under test looks
exactly like a vacuous check: pristine form = 1 select / 240 chars / no pain label; under N1 = 2 selects /
318 chars / `PAIN LEVEL (1–10)` present.

**Fix:** `[-–—]` in both alternations, or stop matching the range and match `pain level` — the thing the
control is actually called.

### R4-2 — HIGH. `FAQ_ITEMS` renders in the Help centre and no ratchet reads it.

`index.html:3992-4008` (15 entries) → `helpFaqTopics()` (9607) → `helpAllTopics()` (9612) →
`helpTopicsIn('common')` (9616), rendered under **Common questions** and counted on the Help landing page
(*"plus the 15 common questions"*, 10238). Checks B, C, D and E all read `T.helpTopics()`, which is
`HELP_TOPICS` alone (13383).

**Reproduced.** Mutant **N3b** put the false claim inside the existing `add-med` answer, leaving the item
count unchanged: **v87 63/63 · v55-help ALL GREEN · v57-search 53/53 ALL GREEN.** My first attempt (N3)
added a *new* FAQ item and v55-help went red with 5 failures — but on the **count**, not the content, so
it proves nothing about the claim and I am not counting it as coverage.

**What it costs.** Nothing today: I searched the corpus and `FAQ_ITEMS` contains zero occurrences of
`diarrh`, `constipation`, `1 to 10` or `pain scale`. This is a hole in the guard, not a live defect. But
it is a third of the Help centre, it is the surface the five mismatches all came from, and the README
asserts the property for all of Help. Fix: `helpTopics: () => helpAllTopics()`, or a second hook — one
line either way, and the ratchets then cover what the screen shows.

## NON-BLOCKING FINDINGS

### R4-3 — MEDIUM. Check C reads questions for *raising*, never for *claiming*.

`strayClaims` searches `tp.body` (a + steps + note + branches). `tp.q` is searched only by
`raisedWithoutDenial`, which is satisfied the moment the topic carries the denial. So the one topic that
carries the denial can say anything in its question.

**Reproduced.** Mutant **N4** rewrote that question to *"Diarrhea can be logged from the Symptoms tab too
— or should it go in the bowel tracker?"* → **63/63 green**. Narrow, because a declarative lie in a `q`
field is an odd thing to write; but it is now the only place inside the policed array where a false claim
is invisible, and the fix is to run `strayClaims` over `strip(tp.q)` as well, keeping
`raisedWithoutDenial` for the interrogative case.

### R4-4 — MEDIUM. The generated sentence may not drift; a hand-typed copy beside it still may.

Checks B and D assert that the generated sentence is complete and that the topic prints it. Neither
forbids a second, contradictory, hand-typed list in the next step.

**Reproduced.** Mutant **N9** added one step to `sym-bowel-confusion` — *"The four answers are normal,
very little, none, or loose."* — leaving the generated five-value sentence in place and printed:
**63/63 green**. That is *"a copy of a list is a thing that drifts; this is the list"* — the comment at
`index.html:3489` that this release's headline rests on — defeated one array element away from the
sentence the ratchet guards. The symptom side has the same shape. A cheap closure: no step in these two
topics may contain a bowel label or a `symptomSpoken` form outside the generated sentence, which is the
same subtract-then-search trick check C already uses.

### R4-5 — LOW (latent). `symRe` builds a regex out of a label without escaping it.

`test/v87-correct-a-past-day.mjs:584`. Harmless for `Diarrhea` and `Constipation`. If
`Neuropathy (Numbness/Tingling)` or `Skin Reaction/Rash` ever moved out of `SELECTABLE_SYMPTOM_IDS` — the
product decision the new comment explicitly invites — the parentheses become a capture group and the
pattern silently stops matching the literal text. A third dead pattern, waiting on a one-line product
change. `name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')` before the `diarrhea` substitution closes it.

### R4-6 — MEDIUM (record). *"anywhere in Help"*. Fourth round running for this shape.

README line 14: *"…so one occurrence is permitted **anywhere in Help** and everything else is a
finding"*. N3b is the counter-example. This is the same defect the first round raised as D1, the second
as F3 and the third as R3-6 — a ratchet described in the README by the property it was designed for
rather than the property it has. The sentence should name the array: *anywhere in `HELP_TOPICS`* — or,
better, the code should earn the sentence (R4-2).

## THE OTHER PATTERNS IN 7c — SWEPT, AND THE ANSWER IS BOUNDED

I extracted every regex in `test/v87-correct-a-past-day.mjs` used in an assertion or in selecting the
element an assertion reads, and checked each against the string the app actually produces.

| Pattern | Against | Verdict |
|---|---|---|
| `scaleClaim` | `PAIN LEVEL (1–10)` | **DEAD — R4-1** |
| `symRe` after the `diarrh(o)?ea` repair | `Diarrhea`, `Constipation` | fires; proven by MK naming both |
| `symRe` with an unescaped label | future non-selectable types | **latent — R4-5** |
| `/how bad is it/i`, `/where on the body/i` | `HOW BAD IS IT? (OPTIONAL)` etc. | fire (case-insensitive, unanchored) |
| `/not in the Symptoms list/i` | generated denial | fires |
| `/Change the answer for (.+?)…/` | placeholder with U+2026 | fires, and fails loudly if it stops |
| `/—\s*(Normal\|Loose\|Diarrhea)\s*$/` | history row built with `' — '` | fires |
| `/Changed to Diarrhea/`, `/Already logged as Diarrhea/` | the two toasts | fire |
| `/^Symptoms$/`, `/^Save$/i`, `/^Cancel$/i` | rendered buttons | fire; guarded by preconditions |
| `/Remove/.test(document.body.innerText)` | rendered text | correct — `innerText`, not `textContent`, so the single-file source is not in the haystack |

**Then the same class across the whole suite tree**, mechanically: every ASCII-hyphen numeric range and
dash-separated literal in `test/*.mjs`, cross-checked against the app's 16 en dashes (`30–45`, `86–113`,
`0–20`, `1–10`, the in-patient `–` separators). **`scaleClaim` is the only mismatch in the repository.**
The class is real and it is confined to the one pattern.

## THE 39 BOLDED NAMES — MY OPINION: AFTER THIS RELEASE, AND AS A CHECK RATHER THAN A TRIAGE

I reproduced your sweep with substring matching instead of exact matching: **134 distinct bolded strings,
5 not found anywhere else** — *"Contact the care team now."*, *"Contact the care team."*, *"Tell the care
team."*, *"Tap this one first"*, *"Add it to your Home Screen."* Every one is a bolded sentence for
emphasis, not a control name. So the two methods bracket the answer at **5 ≤ real ≤ 40** and most of your
40 is exact-match artefact, exactly as you read it.

**Not in this release.** What is left is a measurement problem, not a defect list, and resolving it means
40 judgement calls on a release that has already turned over four times. A sixth round spent triaging
strings is how a class gets closed badly.

**But not as a backlog line either.** `**Bowel movements**` is the fifth mismatch in this family and the
only thing that found it was a person looking — which is the same sentence that has been written about
the other four. The task should be *"make the sweep a check"*, not *"triage 40 strings"*: the triage
falls out of the check as its first run, and the check is what stops the sixth. My substring variant
would have caught `**Bowel movements**` (the tile is `Bowel Movement`), so a two-tier ratchet — exact
match, then substring, then an explicit allow-list for emphasis sentences — is cheap and gives the
residue a home. It should cover `helpAllTopics()`, not `HELP_TOPICS`, for the reason in R4-2.

## `test/v57-search.mjs` — IT FAILS LOUDLY; IT STILL DOES NOT EXERCISE THE GENERATED TEXT

`sliceLine` and `sliceFn` both `throw` on no-match. **Mutant N8** renamed `nonSelectableSymptomDenial`
throughout: the suite died with `Error: function not found: nonSelectableSymptomDenial`, **exit 1**,
which `run-all-tests.sh` puts in its explicit `COULD-NOT-START` bucket before exiting non-zero. The
property you care about holds, and the comment you added saying so is accurate.

**What it does not do is exercise the generated text.** Measured last round and unchanged: with both
generators returning `''`, `v57-search` scored 53/53 ALL GREEN. Nothing in it asserts on those words —
it needs them only to build a corpus without crashing. That is fine for a search-ranking suite and the
coverage lives in 7c, but the hand-maintained slice list has now broken twice, and a third dependency
added to those sentences breaks it a third time. Worth considering: derive the slices from one named
block in `index.html` rather than eight patterns, so the list cannot go stale by addition.

## MUTANT BOARD

Baseline, measured myself: `v87-correct-a-past-day` **63/63**, `v86-logging-and-labels` **87/87**,
`v57-search` **53/53 ALL GREEN**, `v55-help` **ALL GREEN** — matching your figures. Every mutant applied
by script from a byte copy (`/tmp/pristine.html`, md5 `50d9a8960d43bf98af03c4e8038cc7fb`) and restored by
`cp`; md5 re-verified after each, OK eleven times. The runner aborts if a mutation leaves the file
byte-identical. No `git checkout`, `reset`, `stash` or `add`.

| # | Mutant | Result |
|---|---|---|
| N1 | pain promise restored **and** the form made to render the scale — a TRUE claim | **FAILS on a correct app** 62/63 — R4-1 |
| N2 | pain promise restored, form unchanged — a false claim | CAUGHT 62/63 (R3-1's fix works) |
| N3b | the false claim inside an existing **Common questions** answer | **SURVIVED** 63/63, v55-help green, v57-search green — R4-2 |
| N3 | the same claim as a NEW FAQ item | caught by v55-help, but on the item **count**, not the content |
| N4 | a false claim in the QUESTION of the topic that carries the denial | **SURVIVED** 63/63 — R4-3 |
| N9 | hand-typed four-of-five list beside the correctly generated one | **SURVIVED** 63/63 — R4-4 |
| MH | bowel sentence drops `diarrhea` (round-3 survivor) | CAUGHT 62/63, names `diarrhea` — fixed |
| MI | symptom sentence drops `neuropathy` (round-3 survivor) | CAUGHT 62/63, names `numbness or tingling` — fixed |
| MK | reworded false claim in the bowel topic (round-3 survivor) | CAUGHT **three times**, names `diarrhea` *and* `constipation` — fixed |
| N8 | `nonSelectableSymptomDenial` renamed | `v57-search` dies, exit 1, named error — the good failure mode |
| probe | pristine symptom form, read live | 1 select, 240 chars, no pain label — N1 reached the code |

## WHAT I DELIBERATELY DID NOT COVER

* **Any device that is not Chromium at 390×844.** No iPhone, no Android, no real phone, no Capacitor
  wrap. Unchanged and still exempt.
* **Rounds 1-3's mutants**, except MH, MI and MK, which I re-ran because they are the evidence that
  R3-2/3/4 are closed and that evidence had to be mine.
* **The record-correction paths and the check-in sheet** — closed in earlier rounds, untouched here.
* **The 39 bolded names themselves.** I measured the bracket and gave an opinion; I did not triage them,
  and I am recommending this release does not either.
* **`v57-search`'s ranking assertions**, `sync-backend/`, `tools/`, the med database.
* **`release_check.sh` end to end.** Read, not run. `outputs/` still carries no `PM*app-v87*` sign-off and
  `PUBLISHED.json` still records `app-v86` at `a62069b`.

## RULE 0

57 added lines in `index.html`. Zero patient-name matches, zero gendered pronouns about a patient, zero
care-plan dose/ceiling/schedule, zero new `med.id === '…'` branches. `APP_VERSION` `app-v87` and `sw.js`
CACHE `chemowell-app-v87-1` still move together. The new What's New points read plainly and are true as
written — I checked each against the code, including *"Help also promised a 1-to-10 scale on symptoms
that was never built; that promise is gone until it is."*

## ON PROPORTIONALITY, SINCE THIS IS THE FOURTH REFUSAL

**Nothing false reaches a caregiver in this build.** All five Help/control mismatches are genuinely
fixed, the Help corpus is clean on every word I searched for, the records are accurate, and the three
round-3 blockers are closed with my own mutants as evidence. The two blocks are one dead pattern and one
unpoliced array, both one line, plus a README clause. If you judge R4-1 as a future problem rather than a
present one and want to ship over it, say so and I will not re-raise it — **but R4-2 should not wait**,
because it is a live hole in a guard rather than a false positive in waiting, and the sentence in the
README currently claims the property it does not have.

## WORKING TREE

`git status --porcelain` empty before and after, except this report. `index.html` md5
`50d9a8960d43bf98af03c4e8038cc7fb`, byte-identical to `9ec37ae`, re-verified after every mutant and after
the final restore. No app or test file edited as a fix, nothing committed, nothing pushed. Probe scripts
live in the session scratchpad. Loopback only — the server on 8899 was already listening and was left as
found; no other network, no Firebase, no `caretracker_*` collection touched.
