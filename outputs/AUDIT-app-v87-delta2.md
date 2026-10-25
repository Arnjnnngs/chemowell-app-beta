AUDITED-COMMIT: d21cf06
VERDICT: DO NOT SHIP

Zero Day Audit — ChemoWell app-v87, SECOND DELTA PASS, branch `claude/caretracker-team-review-i83ik2`.
Primary subject `git diff 2e60c2d..d21cf06` (8 lines of `index.html`, 26 across two suites, one README
line); whole-release scope `git diff 87d1784..d21cf06` also exercised.

## HEADLINE

**The in-app Help tells a caregiver with diarrhoea to log it in Symptoms. Symptoms has not offered
Diarrhoea since v57.** Measured through the real UI, not read: Help → Symptoms → *"Should diarrhoea go
in Symptoms or the bowel tracker?"* answers *"Either works"* and states *"The Symptoms list does include
diarrhoea and constipation for exactly that reason."* The Symptoms picker renders ten options —
`Select…, Nausea, Vomiting, Fatigue, Mouth Sores, Neuropathy, Headache, Dizziness, Skin Reaction/Rash,
Other`. Neither diarrhoea nor constipation is there. **That false sentence is the step immediately after
the one this delta edited, inside the same array literal, in the one topic D3 was sent to fix** — and
the README row claims the FAQ was dealt with.

**And the ninth vacuous check is the eighth one's fix.** The new assertion is named *"and that option is
first, so an unanswered day opens on it rather than blank"*. It never opens an unanswered day. Breaking
the unanswered-day pre-fill scores **45/45, 87/87, 10/10** while the check-in sheet renders `selectedIndex
-1` — **blank, the release's own headline defect** — and Save then writes a `bowel_movement` record the
caregiver never entered. The previous round asked for two things: that the first option is `''`, **and
that on a day with no entry it is the one selected.** The first became the assertion; the second became
the assertion's name.

Two blockers, both small to fix. Nothing in the shipped code is behaviourally wrong today: the delta's
only functional edit is a function declaration that moved, and that move is a no-op (F3). The release is
refused for false caregiver-facing copy it claims to have corrected, and for a check that states coverage
it does not have over a path that can write a junk record.

## BLOCKING FINDINGS

### F1 — HIGH (caregiver-facing copy, and the README claims it was fixed). The Help FAQ sends people to a control that does not exist.

`index.html:4062` (`sym-bowel-confusion`) and `index.html:4057` (`sym-log`).

* `sym-bowel-confusion` — answer: *"Either works, and they're for different things."* Step 2: *"Use the
  **Symptoms** tab for a specific episode with a time and a note."* Step 3: *"The Symptoms list does
  include diarrhoea and constipation for exactly that reason."*
* `sym-log` — step 3 lists the choices as *"nausea, vomiting, fatigue, mouth sores, numbness or tingling,
  headache, dizziness, a skin reaction or rash, **diarrhoea, constipation**, or Other."*

The picker at `index.html:5583-5592` is a hand-written list of nine. `index.html:3884-3889` states the
removal in terms: *"Diarrhea and Constipation were removed as selectable options here (v57)… remain in
SYMPTOM_TYPES/SYMPTOM_COLORS below purely so any pre-existing logged entries still display correctly."*
Both FAQ lists were evidently copied from `SYMPTOM_TYPES` (11 entries) rather than from the control
(9) — **a hand-written list copied off the wrong list, which is the exact failure the comment this
release added at 3489 congratulates itself on ending for bowel values.**

**Reproduced**, 390×844 Chromium against the working tree served at 127.0.0.1:8899:
* Symptoms picker, driven through the modal:
  `["=Select...","nausea=Nausea","vomiting=Vomiting","fatigue=Fatigue","mouth_sores=Mouth Sores","neuropathy=Neuropathy (Numbness/Tingling)","headache=Headache","dizziness=Dizziness","skin_reaction=Skin Reaction/Rash","other=Other"]`
* Help topic, opened by clicking menu → Help & FAQ → Symptoms → the topic, read from `innerText`:
  `"Either works, and they're for different things."` /
  `"The Symptoms list does include diarrhoea and constipation for exactly that reason."`

**What it costs a caregiver.** Someone whose patient has diarrhoea at 2am opens Help, is told either
place works and that Symptoms carries it, taps Symptoms → **+**, and the option is not in the list. They
either log it as *Other* with no classification, or log nothing. This is the same "nothing told anyone
where to go" failure the release exists to end, one screen over, in the surface whose only job is telling
the caregiver what the controls do — and it is worse than D3, which was an incomplete list: this is a
positive assertion about a control that was deleted thirty releases ago.

**Why it blocks rather than going to the backlog.** It is pre-existing, but the delta edited step 1 of
that exact topic and the README row lists the FAQ among the things this release *took*: *"the Help FAQ
enumerated four of five values… — and spelled 'diarrhoea' against the app's own 'Diarrhea'."* One of the
three `diarrhoea` spellings in that topic changed; the topic now reads *diarrhoea* in its question,
*diarrhea* in step 1 and *diarrhoea* in step 3, and the false sentence is untouched. A release may not
claim a surface was corrected and leave the worst sentence on it standing.

**Fix (small).** `sym-bowel-confusion`: the answer is not *"Either works"* — say the daily check-in is
where a bowel pattern goes, and that Symptoms covers episodes of other kinds; delete step 3 or rewrite it
to say Symptoms deliberately does not duplicate the bowel tracker. `sym-log`: drop *diarrhoea,
constipation* from the enumeration, or generate that sentence from the picker. Then settle the spelling
across the topic — the keyword list already carries both, so search is unaffected either way.

### F2 — HIGH (a check that states coverage it does not have; the ninth vacuous check). The "unanswered day" is never driven.

`test/v87-correct-a-past-day.mjs:132-145`, both new checks, and specifically the second:

    t('and that option is first, so an unanswered day opens on it rather than blank',
      !!declineable && declineable.firstText.length > 0 && declineable.count === defined.length + 1, …)

The scenario it reads (`everyControl`, seeded at line 65) has a **standing `loose` entry for today**, so
`openCheckinModal()` takes its truthy branch and the unanswered path is never executed. The condition
inspects the option list only — never the selection — and *"that option is first"* is already established
by the preceding check's `declineable.first === ''`. **No suite in the repo opens the check-in sheet on a
day with no bowel entry.**

**Reproduced.** Mutant MB: `index.html:3646`, `bowel: bowelMovementFor(todayStart) ? … : ''` →
`… : 'zz_unset'`. Option list untouched, `''`/"Not answered" still present and still first.

| | pristine `d21cf06` | mutant MB |
|---|---|---|
| sheet on an unanswered day | `value="" index=0 shown="Not answered"` | `value="" index=-1 shown="(BLANK)"` |
| entries written by tapping Save | `[]` | `["bowel_movement=zz_unset"]` |
| `v87-correct-a-past-day` | 45/45 | **45/45** |
| `v86-logging-and-labels` | 87/87 | **87/87** |
| `v58-eod-checkin` | 10/10 | **10/10** |

**What it costs a caregiver.** Two things, neither of which anything in the repo would notice. The
check-in sheet renders a blank bowel box **every morning nobody has answered yet** — `selectedIndex -1`,
the precise state the previous round refused this release for. And Save writes a `bowel_movement` entry
for a question that was never answered, because `confirmCheckinModal` gates on `m.bowel` being truthy and
a non-empty sentinel is truthy. A fabricated daily answer in a record a clinician reads is worse than a
missing one.

**Fix (one scenario).** Seed a context with no bowel entry, open the sheet, assert
`selectedIndex === 0` and the shown text is the decline option; then Save and assert zero
`bowel_movement` entries were written. That is the behaviour the assertion is already named after.

## NON-BLOCKING FINDINGS

### F3 — MEDIUM (record). The TDZ fix fixes nothing, and the README says it does.

README line 14: *"`bowelOptions()` was declared **above** the map it reads, a temporal-dead-zone throw
waiting for the first caller during module evaluation, **moved below it**."* The move
(`index.html:3505`) cannot remove that hazard. **Function declarations hoist**, so the textual position
of `bowelOptions()` is irrelevant; only the position of a *call site* relative to the `const` matters, and
the `const` at 3500 did not move. The code comment at 3501-3504 contradicts itself on this — it opens
*"It is hoisted, so placement makes no difference"* and then justifies the move as removing the trap.

**Reproduced** on the post-fix file. Mutant ME inserted `const __tdzProbe = bowelOptions();` directly
after `BOWEL_ISSUE_VALUES` (line 3488), i.e. a module-evaluation caller above the map:

    pageerrors: ["ReferenceError: Cannot access 'BOWEL_MOVEMENT_LABELS' before initialization", …]
    body text length: 0        <- the app renders a blank page

Identical to what `2e60c2d` would have done. Confirmed as a language fact in isolation: a call placed
before a `const`, with the function declared *after* it, still throws
`ReferenceError: Cannot access 'MAP' before initialization`.

The move is harmless and reads better. **The README sentence is false** — this release has now shipped
three. Either say the declaration was reordered for readability and the TDZ hazard is unchanged, or move
the two `const`s above every consumer and claim it then.

### F4 — MEDIUM. The D3 fix has no check, and the enumeration it fixed is still hand-written.

Mutant MA reverted the FAQ step to the exact wording the previous round refused — *"normal, very little,
none, or diarrhoea."* — and scored `v87` **45/45**, `v86` **87/87**, `v55-help` **ALL GREEN**. Nothing in
the repo counts a prose enumeration against `BOWEL_MOVEMENT_LABELS`. The release's own argument is that
*"a copy of a list is a thing that drifts; this is the list"* — and it left a copy of the list in prose
with no ratchet on it, in a file whose Help content is 118+ topics nobody re-reads. One check in
`v55-help.mjs`: every value in `bowelLabels()` appears in that step's text, and the count matches.

### F5 — LOW. D1's replacement dropped the half of the old check that was doing work.

`test/v86-logging-and-labels.mjs:98-100`. `bowelDefined.every(v => bowelUi.values.includes(v))` is a
subset test: it catches a control that *omits* a value and not one that offers an *extra*. The literal it
replaced, `length === 5`, caught both. Mutant MC (logger drops `none`) → **82/87, 5 red** — the
replacement does bite, it is not a comparison of a thing against itself. Mutant MD (logger offers an
extra `watery` the map has no label for) → **87/87, 45/45 clean**, and the rendered button's text is
`opts.labels[val]` → `undefined`, i.e. a blank-faced button that writes an unlabelled value into the
record. One more clause closes it: `&& bowelUi.values.length === bowelDefined.length`.

### F6 — LOW (record). Two code comments above the map now describe behaviour the app does not have.

`index.html:3481` still enumerates **four of five**: *"value one of: normal / very_little / none /
diarrhea"* — the same defect as the banner and the FAQ, in the authoritative comment block, nineteen
lines above the map that has five, in the block this release rewrote the bottom half of.
`index.html:3486-3487` states the issue-ending rule as *"only a genuine daily answer of
normal/very_little can end it"*. Measured against `bowelIssueActive()` (3768) and
`daysSinceBowelIssueStart()` (3781): the test is `BOWEL_ISSUE_VALUES.has(latest.value)`, and `loose` is
not in that set, so **a `loose` answer ends an active bowel-issue alarm and resets the Day-N counter.**
The README row now states that behaviour explicitly; the comment two screens from the code still denies
it. The next person to reason about the alarm from this comment will get it wrong.

### F7 — LOW (record). "45/45 against nine mutants, all red."

README line 14. The nine red mutants were run against the **43-check** suite at `2e60c2d`, and the board
they come from had eleven mutants, two of which survived — one of them the reason two of these checks
exist. Both survivors are disclosed later in the same row, so the row is not hiding anything; the
sentence as written attributes a mutant board to a suite that did not exist when it was run.

## MUTANT BOARD

Baseline 45/45, 87/87, both matching the README and confirmed by the suite's own figure self-check.
Every mutant applied by script to a byte copy (`/tmp/pristine.html`,
md5 `513c3b991f9decb5102646db317a958d`) and restored by `cp` immediately after; md5 re-verified after
each, OK seven times. No `git checkout`, `reset`, `stash` or `add`. The runner refuses to proceed if a
mutation leaves the file byte-identical, so a silently-missed mutation cannot score as a clean pass.
None of these appears on the previous round's board.

| # | Mutant | Result |
|---|---|---|
| MA | FAQ step reverted to the four-of-five wording the last round refused | **SURVIVED** 45/45, 87/87, v55-help green — F4 |
| MB | unanswered-day pre-fill → a sentinel that is not an option | **SURVIVED** 45/45, 87/87, v58 10/10 — F2, and it writes a junk record |
| MC | Reports daily logger drops `none` | CAUGHT — v86 82/87, v87 44/45 |
| MD | Reports daily logger offers an extra value the map has no label for | **SURVIVED** 87/87, 45/45 — F5 |
| ME | module-evaluation-time caller inserted above the map | CAUGHT by the browser, not by a suite: `ReferenceError`, blank page — F3 |
| MF | bowel row corrector writes to today instead of the row's day | CAUGHT — v87 7 red |
| MG | appetite row corrector writes to today instead of the row's day | CAUGHT — v87 2 red |

MF and MG are the release's record-damage path, and they are genuinely guarded: correcting Tuesday
cannot overwrite today on either report screen.

## RULE 0 AND THE VOICE

`git diff 87d1784..d21cf06 -- index.html sw.js test/` added 1587 lines. Zero patient-name matches. Two
gendered-pronoun hits, both `He`/`His` referring to **Aaron by name in the preceding sentence** (quoted
testing reports in test headers) — the owner, not a patient, and the established convention in this file;
not a leak and it should not be re-raised. Zero care-plan dose/ceiling/schedule. Zero new
`med.id === '…'` / `medId === '…'` branches. `sex: 'female'` in the suites is the app's own setup pref on
a fixture profile named Alex, not a care-plan fact.

Caregiver-facing strings in the delta: one, the FAQ step at 4062. It is now true about the five values
and consistent with the map's order and the app's own `Diarrhea` spelling — and it sits one array element
above a sentence that is false (F1), in a topic that now spells the word two ways.

Checkable README claims re-run: `APP_VERSION = 'app-v87'` (9164) and `sw.js` `CACHE =
'chemowell-app-v87-1'` move together; `test/v87-correct-a-past-day.mjs` 45/45; `test/v86-logging-and-labels.mjs`
87/87; no live `**/**` figure. False or overstated: F1 (the FAQ "also taken"), F3 (the TDZ sentence),
F7 (the mutant attribution).

## WHAT I DELIBERATELY DID NOT COVER

* **Any device that is not Chromium at 390×844.** No iPhone, no Android, no real phone, no Capacitor
  wrap. Rendering, the native share sheet and local notifications are untested here and stay exempt.
* **The previous round's eleven mutants.** Re-running them would be their evidence, not mine. MD1-MD11
  stand on `outputs/AUDIT-app-v87-delta.md`.
* **The note-inheritance truth table and the `loose` dot colours**, measured in full last round on code
  this delta does not touch. MC and MG re-exercise their surroundings incidentally.
* **The sync backend, the med database generator and `tools/`** — outside this release's diff.
* **`release_check.sh` end to end.** Read, not run: it exports HEAD and runs every suite, and the gate's
  state is already known — `outputs/` has no `PM*app-v87*` sign-off, and `PUBLISHED.json` still records
  `app-v86` at `a62069b`, so `./mark_published.sh` is owed if either later index.html commit was pushed.
  This report pins `d21cf06`, strictly later than the report it supersedes.
* **Whether a caregiver *should* be able to log diarrhoea as a symptom.** F1 is that the Help says they
  can and they cannot. Re-adding the two options to the picker would also resolve it and would reverse a
  deliberate v57 decision — that is Aaron's call, not an auditor's.

## WORKING TREE

`git status --porcelain` empty before and after. `index.html` md5 `513c3b991f9decb5102646db317a958d`,
byte-identical to `d21cf06`, re-verified after the last mutant and again after the final suite run
(45/45, 87/87). Nothing committed, nothing pushed, no file in the repo created or edited except this
report. Probe scripts live in the session scratchpad, not in the repo. Loopback only — the server already
listening on 8899 when this pass began was left as found; no other network, no Firebase, no
`caretracker_*` collection named or touched.
