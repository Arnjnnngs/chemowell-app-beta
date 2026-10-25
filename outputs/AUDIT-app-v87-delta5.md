AUDITED-COMMIT: b2d4ac3
VERDICT: SHIP

Zero Day Audit — ChemoWell app-v87, FIFTH DELTA PASS, branch `claude/caretracker-team-review-i83ik2`.
Subject `git diff 9ec37ae..b2d4ac3` — two commits, 29 lines of `index.html` (test hooks only, no
behaviour), 72 lines of `test/v87-correct-a-past-day.mjs`, one README row.

## HEADLINE

**There is a sixth surface, and it is the only one that is not an array — so no hook built by listing
arrays will ever close this class.** `renderHelpView()` (`index.html:10022-10252`) writes prose directly
into the tree, outside all five sources `helpProse()` collects. The substantial one is the standing
safety notice on the Help SEARCH screen — the screen a frightened person reaches by typing their own
words, and the one the comment above it says exists *"so that whatever this list says, the one true
sentence is above it"*. **Mutant P1** appended *"Diarrhea and constipation can both be logged from the
Symptoms tab."* to that notice's body and measured it live: a caregiver who types `diarrhea` into Help
search reads it in `document.body.innerText`, `helpProse()` does not contain it, and the suites score
**64/64 with v55-help ALL GREEN**.

**And the question-mark heuristic does not hold: my N4 still passes.** You wrote that it fails. It does
not — N4's question is *"Diarrhea can be logged from the Symptoms tab too — or should it go in the bowel
tracker?"*, which **ends in a question mark**, so `qIsAQuestion` is true and the denial on that topic
satisfies the raise rule. **64/64 green.** Your fix does work for the case it was aimed at: N4b, the same
claim with the full stop instead, is red and names `sym-bowel-confusion:q:diarrhea`. The hole is the
heuristic — *"X is true — or should it go elsewhere?"* is a declarative claim wearing a question mark.

**The enumeration check misses three shapes** (question 2, which you were right to be least sure of):
slash-joined lists, lists spread one value per step, and anything inside the step that prints the
generated symptom sentence — that last one is skipped wholesale by an early `return` where the bowel
sentence is surgically stripped.

**Nothing here is something a caregiver can hit.** Every claim on screen is true; all five Help/control
mismatches stay fixed; every one of my ten prior mutants behaves as it should, including N1, which now
**passes**, which is the behaviour check E was supposed to have. Taking you at your word on
proportionality: **these are future problems, not present ones, and I am not refusing over them.**

## 1 — IS THE CLASS CLOSED? NO. THE SIXTH SURFACE IS THE RENDERER ITSELF.

I checked against what `renderHelpView` puts on screen rather than against your list. It is the only
`renderHelp*` function in the file; I brace-matched it (lines 10022-10252) and pulled every prose literal
out of its body. These render to caregivers and are in none of the five arrays:

| Where | String |
|---|---|
| search screen, notice heading | *"ChemoWell can't tell you if something is serious"* |
| search screen, notice body | *"ChemoWell holds no medical information and can't tell you whether something is serious. For anything about symptoms, doses, or how someone is feeling, contact the care team."* |
| search screen, notice button | *"When to call the care team straight away"* |
| empty results | *"Try a single plain word — "reminder", "greyed", "export", "missed". Or tap Clear and pick the area from the list instead."* — itself a hand-typed enumeration |
| landing caption | *"Pick the area that matches what you are seeing, or search. N step-by-step walkthroughs plus the N common questions, all stored in the app — nothing is sent anywhere."* |
| walkthrough footer | *"This help is stored inside the app. Nothing you read or search here is sent anywhere."* |
| care callout heading | *"Ask your care team"* / *"Contact your care team"* / *"Not medical advice"* |
| section labels | *"Step by step"*, *"Worth knowing"*, *"Related"*, *"Nothing matched that"*, *"Search help"*, placeholder *"e.g. not getting reminders"* |

**Measured, not read.** Pristine run of my probe: the notice body renders verbatim on the search screen
and `helpProse()` does not contain the words `holds no medical information`. Under P1 the planted claim
renders in the same place and `inHelpProse` is still `false`. Two of those strings are medical-adjacent
and one already contains the word *symptoms*, so this is the right surface for exactly the claim this
release has been refused for four times.

**Why widening the hook again will not end it.** `helpProse()` is a list of data sources; the renderer is
not a data source. A seventh will appear the next time somebody writes a sentence directly into
`renderHelpView` — which is how all eight above got there. The version that cannot have a seventh surface
is to **read the screen**: the suite already drives the Help UI twice in 7c (the picker, and check E's
symptom form), so it can walk Help's three levels — landing, each category, a search with results and a
search with none, and the topics it already opens — scrape `innerText`, and apply the claim and
enumeration rules to that, keeping `helpProse()` for per-topic attribution in failure messages. That is a
bigger job than a hook, which is why I am not asking for it in this release.

**One latent gap in the hook as written:** `HELP_POINTERS.map(pt => ({ ..., body: '' }))` carries only
`q`. Pointers are `{ id, cat, q, to }` today so nothing is lost, but a pointer that ever gains a
description is unread, silently.

## 2 — THE ENUMERATION CHECK: THREE MISSES

My first three attempts (P2a/b/c) all went red — and **not by the enumeration rule.** They were caught by
check C, because every bowel list I wrote contained the word `diarrhea`, which is also a non-selectable
symptom name. That is my mutants failing to reach the code under test, the error you warned me about last
round, and I am recording it rather than counting those three as coverage. Re-aimed at the **symptom**
list, where no non-selectable name is involved and only the enumeration rule can fire:

| Mutant | Planted in `sym-log` | Result |
|---|---|---|
| **P2d** | *"The choices are nausea / vomiting / fatigue / mouth sores / headache / dizziness."* | **SURVIVED 64/64** |
| **P2e** | six steps, one value each — *"Pick nausea if they felt sick."*, *"Pick vomiting if…"*, … | **SURVIVED 64/64** |
| **P2f** | *"… In older versions the choices were nausea, vomiting, fatigue, or headache."* appended to the step that prints the generated sentence | **SURVIVED 64/64** |

* **P2d — the separator set.** `(?:,|or|and)` does not include `/`, `;`, `·`, `–` or a bullet. A
  slash-separated list is not exotic: `index.html:3481` used to carry
  `normal / very_little / none / diarrhea`, and that comment is one of the things this release fixed.
  Widening the class to `[,/;·]|or|and|then` costs nothing.
* **P2e — adjacency.** The pattern needs a contiguous run, and `body` is split on `' \n '`, so a list
  written one value per step has no adjacency anywhere. This is the most natural way a person writes a
  Help enumeration, and it is a complete hand-typed copy of the list.
* **P2f — the exemption is a `return`, not a strip.** `if (left.indexOf(helpData.symptomSentence) >= 0)
  return;` drops the whole piece from **both** the symptom and the bowel scan. The bowel sentence next to
  it is handled correctly, by `strip()` removing exactly that substring. Making the symptom sentence a
  third `strip()` term closes it in one line and removes the asymmetry.

**And the opposite risk, worth stating once.** `normal` and `none` are ordinary English, and the list
form now requires a join — but *"normal and none"* or *"none, or normal"* in some future reminders topic
would fire with no defect present. You already hit this once with `rem-none-scheduled`. Matching only
runs of **three or more**, or requiring at least one comma, would make a false positive much less likely
without weakening what it catches: every real enumeration of these lists has five entries.

## 3 — MY PRIOR MUTANTS, RE-RUN BY ME

Baseline reproduced: **v87 64/64 · v86 87/87**, matching your figures.

| Mutant | What it does | Result | Verdict |
|---|---|---|---|
| **N1** | pain promise restored **and** `showPainScale` forced true — a TRUE claim | **64/64 PASSES** | **R4-1 fixed.** The check now accepts a correct app |
| N2 (prior round) | promise restored, control absent | red (re-confirmed last round) | still bites |
| **N3b** | false claim inside an existing Common-questions answer | red, names `faq:add-med:diarrhea, faq:add-med:constipation` | **R4-2 instance fixed** |
| **N4** | declarative claim in a `q` **that ends in `?`** | **64/64 — STILL GREEN** | **R4-3 NOT fixed** |
| **N4b** | the same claim in a `q` with no `?` | red, `sym-bowel-confusion:q:diarrhea` | the fix works for its aimed case |
| **N9** | hand-typed four-of-five list as an extra step | red, `sym-bowel-confusion [bowel]: "normal, very little, none"` | **R4-4 fixed for the comma case** |
| **MH** | bowel sentence drops `diarrhea` | red, `missing: diarrhea` | fixed |
| **MI** | symptom sentence drops `neuropathy` | red, `missing: numbness or tingling` | fixed |
| **MK** | reworded false claim in the bowel topic | red **three times**, names `diarrhea` and `constipation` | fixed |
| **MN1** | symptom picker rendered in reverse order | red on the order clause | holds |
| **MB2** | sentinel in the unanswered-day pre-fill | red twice — `index=-1 (BLANK)`, `1 before -> 2 after [normal,zz_unset]` | holds |
| **MQ** | Reports logger offers an extra value | red, 86/87 | holds |

Every mutant applied by script from a byte copy and restored by `cp`; md5 re-verified after each, OK
eighteen times; the runner aborts on a byte-identical mutation. No `git checkout`, `reset`, `stash` or
`add`.

## 4 — ANYTHING BROKEN WHILE FIXING

Nothing. The `index.html` delta is entirely inside the `window.__v86Test` block and two comment
rewrites — **no application behaviour changed**, which is the safest shape a fix round has had in five
rounds. `helpTopics()` widening to `helpAllTopics()` feeds FAQ entries (which carry no `steps`, `note` or
`branches`) into `text()`, `stepsOf()` and `perTopic`; all three are written defensively and the suite is
green. `helpProse()`'s new category rows put `label` and `blurb` into the corpus and the pointer `q` with
them, and neither trips `scaleClaim` nor the enumeration rule. The escaped `symRe` behaves identically on
`Diarrhea`/`Constipation` — MK proves it still names both.

## FINDINGS

### D5-1 — MEDIUM (coverage, future). The renderer's own prose is unguarded.
Evidence and the list of strings are in section 1. Not a live defect: every one of those sentences is
true today, and I checked the whole set. Fix is either enumerating the renderer's literals (brittle,
another list) or scraping the Help screens (durable). My recommendation is the scrape, as its own task.

### D5-2 — MEDIUM (coverage, future). A question mark is not a question.
`test/v87-correct-a-past-day.mjs:639`, `const qIsAQuestion = /\?\s*$/.test(tp.q);`. N4 green, N4b red.
A sharper invariant: a `q` is held to the raise rule only if it is interrogative **and** contains no
declarative clause — in practice, only if the non-selectable name appears before the first clause break,
or simply by running `strayClaims` over `strip(tp.q)` unconditionally and keeping the raise rule as the
single exemption for a `q` that is *exactly* a question. Either way it is a line.

### D5-3 — MEDIUM (coverage, future). Three enumeration shapes unmatched.
Section 2. P2d, P2e, P2f, all 64/64 green. P2f is one line.

### D5-4 — LOW (record). *"every surface the Help centre renders"*.
README line 14 says the hook was widened to *"every surface the Help centre renders — not only topics and
the Common-questions tiles but the blurb under each category, the pointer row and the care-team line."*
Five of six. This is the same shape as R4-6 one level up, and the honest wording is near to hand: *every
Help surface that is held in data* — which is true, and which names the renderer as the part that is not.

### D5-5 — LOW (record, and it is mine to correct not yours). R4-3 is reported fixed and is not.
Your message says my N4 fails. It passes. The README does **not** make that claim — it says only that *"a
`q` that does not end in a question mark is prose and is held to the claim rule now"*, which is exactly
true — so there is nothing false in the shipped record. I am logging it so the row is not later amended
to say the hole is closed.

## ON THE WHAT'S NEW EXEMPTION — I AGREE, WITH ONE NARROWING

A changelog must be able to say *"Help used to claim X"*, holding it to the claim rule would forbid
describing the fix, and the reason is written beside the hook, which is what Rule 5.5 asks of an
exemption. I checked the live entry: *"Help said the Symptoms list includes diarrhea and constipation. It
has not for a long time…"* — past tense, true, and it would be absurd for a guard to refuse it.

**The narrowing:** the exemption is granted to the whole surface, not to past-tense statements, so a
**present-tense** false claim written into What's New is unguarded too — and What's New is pushed at
every user after an update, which is a wider audience than Help gets. Not worth a mechanism today; worth
one sentence in the comment saying the exemption covers describing what Help *used to* say, so the next
person does not read it as "What's New is not checked".

## WHAT I DELIBERATELY DID NOT COVER

* **Any device that is not Chromium at 390×844.** No iPhone, no Android, no real phone, no Capacitor
  wrap. Unchanged and still exempt across all five rounds.
* **The Help screens' rendered text as a corpus.** I proved the sixth surface exists and measured one
  string on it; I did not read all eight for truth beyond confirming none carries a false claim about the
  controls this release is about.
* **`v57-search`, `v55-help` beyond the mutant runs above** — unchanged this round, and `v57-search`'s
  extraction was verified loud in the previous pass.
* **The 39 bolded control names.** My recommendation last round stands and this release did not take it
  on, correctly.
* **`sync-backend/`, `tools/`, the med database, the record-correction paths** — outside this diff or
  closed in earlier rounds.
* **`release_check.sh` end to end.** Read, not run. `outputs/` still carries no `PM*app-v87*` sign-off
  and `PUBLISHED.json` still records `app-v86` at `a62069b`, so `./mark_published.sh` is owed if any
  later `index.html` commit was already pushed.

## RULE 0

29 added lines in `index.html`, all inside the test-hook block and two comments. Zero patient-name
matches, zero gendered pronouns about a patient, zero care-plan dose/ceiling/schedule, zero new
`med.id === '…'` branches. `APP_VERSION` `app-v87` and `sw.js` CACHE `chemowell-app-v87-1` still move
together.

## WHY THIS SHIPS

Across five rounds this release has been refused for a false sentence a caregiver could read, and for
checks that claimed coverage they did not have over paths that could damage a record. **Neither applies
now.** All five Help/control mismatches are fixed and I re-measured each one. The pain-scale check accepts
a correct app, which was the one thing in the last round that could have blocked a future release on a
true statement. The unanswered-day path, the correctors, the logger and the picker all still bite. What
remains is three holes in guards and two record wordings — every one of them a defect that can only
arrive through a future edit, none of them reachable by a user of this build. You asked me to say so
plainly if that were the case, and it is.

If any of it is taken now, take **P2f** (one line: strip the symptom sentence instead of returning) and
**D5-2** (one line). D5-1 is the real work and deserves its own task rather than a sixth round.

## WORKING TREE

`git status --porcelain` empty before and after, except this report. `index.html` md5
`b1c66853f14a674002c5c9c20ed53a98`, byte-identical to `b2d4ac3`, re-verified after every mutant and again
after a final clean run of `v87-correct-a-past-day` (64/64). No app or test file edited as a fix, nothing
committed, nothing pushed. Probe scripts live in the session scratchpad. Loopback only — the server on
8899 was already listening and was left as found; no other network, no Firebase, no `caretracker_*`
collection touched.
