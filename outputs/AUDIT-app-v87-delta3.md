AUDITED-COMMIT: 239593d
VERDICT: DO NOT SHIP

Zero Day Audit — ChemoWell app-v87, THIRD DELTA PASS, branch `claude/caretracker-team-review-i83ik2`.
Subject `git diff d21cf06..239593d` — three commits, 85 lines of `index.html`, four suites, one README
row. Whole release remains in scope.

## HEADLINE

**Help still promises a control the app does not have — one topic over from the two that were just
rewritten.** `index.html:4100`, topic `sym-severity`, step 3: *"For pain-type symptoms you get a 1 to 10
scale."* There is no such scale. `index.html:5580` reads
`const medForPain = m.type === 'med' ? state.meds.find(…) : null;` and
`const showPainScale = !!(medForPain && medForPain.painScale);` — **`medForPain` is `null` for every
symptom, so `showPainScale` can never be true on the symptom path**, and `logSymptom()` (4159-4170) has
no `painLevel` field to store one in. The 1-10 scale belongs to a MEDICATION carrying `painScale`. This
is the same defect as the blocker the last round raised and fixed: the Help telling a caregiver that a
control exists where it does not, in the Symptoms category, in a topic whose own `related` list points at
`sym-log`. The new 7c ratchets do not look at it, because they were built for the two sentences that were
already known about.

**And two of the four new ratchets can be defeated by the exact defect they were written for.**

* Dropping `diarrhea` from the generated bowel sentence — so Help reads *"normal, very little, none, or
  loose"*, **four of five, the defect F4 exists to prevent** — scores **55/55, v55-help green,
  v57-search green**. Check D matches the word against the WHOLE topic text, and `diarrhea` also appears
  in that topic's question and in its third step. The suite's own output proves the leak: with every
  sentence emptied (MK) it reports `missing: normal,very little,none,loose` and **does not name
  diarrhea**.
* Dropping *"numbness or tingling"* from the generated symptom sentence, while the picker still offers
  Neuropathy, scores **55/55**. The check carries `&& id !== 'neuropathy' && id !== 'skin_reaction'`
  inside its filter, so **two of the nine selectable symptoms are exempt — and they are the two whose
  spoken form differs from the picker label**, which is exactly the pair a hand-edit gets wrong.

The reworded-false-claim question you flagged: **yes, it is defeated.** And the comment written this
round to correct the TDZ record states something the same commit made untrue.

**What is genuinely fixed, verified with my own mutants, not taken from the brief:** F2 (the sentinel in
the unanswered pre-fill now fails section 1d twice — `index=-1 shown="(BLANK)"` and
`1 before -> 2 after [normal,zz_unset]`), F5 (re-aimed at `renderDailyValueLogger`, an extra logger value
is now 86/87 red), the picker ratchet (reversing its order is caught), and the README's TDZ and
mutant-attribution corrections.

## BLOCKING FINDINGS

### R3-1 — HIGH (caregiver-facing copy). The fourth Help claim about a control that does not exist.

`index.html:4100`, `sym-severity`, step 3: *"For pain-type symptoms you get a 1 to 10 scale."*

**Reproduced from the code path, which is unambiguous.** `index.html:5580-5581`:

    const medForPain = m.type === 'med' ? state.meds.find(x => x.id === m.medId) : null;
    const showPainScale = !!(medForPain && medForPain.painScale);

The pain-level select at 5727-5733 is gated on `showPainScale`. On the symptom path `m.type` is
`'symptom'`, so `medForPain` is `null` and the block never renders. `confirmTimeModal`'s symptom branch
(3257-3264) calls `logSymptom` with `{ note, site, severity }` only, and `logSymptom` (4159-4170) stores
`note`, `site`, `severity` — **there is no `painLevel` on a symptom entry anywhere in the file.** The
only `painLevel` writers are the medication branch at 3112-3116.

**What it costs a caregiver.** Someone logging a headache at 2am reads *"Can I record how bad it was?"*,
is told yes and that pain-type symptoms get a 1 to 10 scale, logs the headache, and there is no scale —
so they either hunt for a setting that does not exist or conclude they did it wrong. The README's own
"Queued next" list confirms the app's position: *"severity on every symptom rather than only skin
reactions"* is still queued work, so the sentence describes a feature Aaron has not yet approved.

**Why it blocks.** The round that produced `239593d` was sent to find Help claims that do not match
controls, rewrote two topics in that category, and added four ratchets for the class. This one sits in
the same category, in the topic `sym-log` links to, and nothing in the new 7c section reads it. A release
may not report that class closed while an instance of it is on screen. Fix: delete the sentence, or
rewrite step 2's scope and say severity is skin-reaction only today.

### R3-2 — HIGH (vacuous check; the tenth). The bowel ratchet cannot detect the defect it was built for.

`test/v87-correct-a-past-day.mjs`, section 7c check D:

    const bowelMissing = bowelWords.filter(w => helpData.symBowel.toLowerCase().indexOf(w) < 0);

`helpData.symBowel` is `q + a + every step + note` joined — not the generated sentence. The rewritten
topic contains `diarrhea` twice independently of the generated list: in its question (*"Should diarrhea
go in Symptoms or the bowel tracker?"*) and in step 3 (*"**Diarrhea and constipation are not in the
Symptoms list.**"*). So `indexOf('diarrhea')` can never fail.

**Reproduced.** Mutant MH: `bowelChoiceSentence()` gains `.filter(k => k !== 'diarrhea')`. The Help step
then reads *"…the day's pattern — normal, very little, none, or loose."* Scores
**v87 55/55 · v55-help ALL GREEN · v57-search 53/53 ALL GREEN.** Independently corroborated by mutant
MK (all generated sentences emptied), whose failure line reads `missing: normal,very little,none,loose`
— four words for a five-word list, because the fifth leaks in from the prose around it.

**What it costs.** F4 was raised because the previous round fixed this sentence by hand with nothing
holding it to the map, and an audit reverted it to a four-of-five wording for a clean pass. The ratchet
built in response **still passes on a four-of-five wording**, as long as the value dropped is the one the
topic happens to name elsewhere — and `diarrhea` is the one value in that list a caregiver is most likely
to be looking for. Fix: have the app expose the generated sentence (or tag that step) and match the
words against **it**, not against the topic.

### R3-3 — HIGH (vacuous check). Two of the nine selectable symptoms are exempt from the "names every selectable symptom" check.

`test/v87-correct-a-past-day.mjs`, 7c check B:

    const head = label.split(' (')[0].split('/')[0].trim();
    return helpData.symLog.toLowerCase().indexOf(head) < 0 && id !== 'neuropathy' && id !== 'skin_reaction';

The exemption exists because the check compares against `SYMPTOM_TYPES[id]` (the picker label) rather
than `symptomSpoken(id)` (what the sentence actually says) — `Neuropathy (Numbness/Tingling)` reduces to
`neuropathy`, which the prose never contains. **The design of the assertion forced it to exclude exactly
the two entries whose spoken form differs from their label, and those are the two a hand-edit will get
wrong.** The exemption is buried in the filter's return expression rather than declared.

**Reproduced.** Mutant MI: `symptomChoiceSentence()` gains `.filter(id => id !== 'neuropathy')`. Help now
offers eight of the nine the picker carries; **v87 55/55, v55-help ALL GREEN.** Corroborated by mutant
MJ, which dropped `skin_reaction` **and** `fatigue`: the suite went red naming only `fatigue`, confirming
`skin_reaction` is unobserved.

**What it costs.** A caregiver looking for where to record numbness during chemotherapy — one of the side
effects the v68 expansion was added for — reads the list, does not find it, and does not look in the
picker. Fix: compare against `symptomSpoken(id)` and delete both exemptions; the test hook already
exists for `selectableSymptomIds`, so one more returning the spoken forms closes it.

## NON-BLOCKING FINDINGS

### R3-4 — MEDIUM (vacuous check; the one you asked about). The false-claim regex is defeated by ordinary rewording.

7c check C. The pattern requires the literal verbs `does include|includes|offers|has` within 40
non-period characters of both a `list|picker|tab` token and `diarrh|constipation`.

**Reproduced.** Mutant MK replaced step 3 with a sentence that is just as false and just as harmful:

    "Diarrhea and constipation can also be logged from the **Symptoms** tab, whichever you find easier."

**v87 55/55, v55-help ALL GREEN.** Other rewordings that defeat it without being any less wrong, from
reading the pattern: *"Diarrhea is one of the choices in the Symptoms list"*; *"The Symptoms tab covers
diarrhea and constipation too"*; *"Choose Diarrhea from the Symptoms list"*; and the verbatim claim with
a clause inserted, which pushes it past `[^.]{0,40}`.

A regex over English will always be narrow, so this is not a demand for a better regex. The structural
version is available and cheap: for every id in `SYMPTOM_TYPES` that is not in `SELECTABLE_SYMPTOM_IDS`,
no Help topic may name it **except** in a sentence that also carries a negation — or, simpler and
stronger, allow it only in the one topic whitelisted to deny it, and forbid it everywhere else outright.
What must not stand is the README sentence claiming the general property (R3-6).

### R3-5 — MEDIUM (record, and a new fragility). The new comment denies a module-evaluation caller that the same commit created.

`index.html:3510-3517` ends: *"The hazard is held off by there being no module-evaluation caller, which
is what the two helpers below are for: everything that wants these words goes through one of them, at
render time."*

**`HELP_TOPICS` is a module-evaluation caller.** It is a top-level `const` whose initializer concatenates
`symptomChoiceSentence()` (4099) and `bowelChoiceSentence()` (4104). Those are the first module-evaluation
callers these maps have ever had, and they arrived in the commit that wrote the comment denying them.

**Reproduced, two ways.** Mutant MO instrumented both generators with a counter; immediately after load,
with no Help screen opened, `window.__genCalls === 2`. Mutant MN2 then did the realistic version of the
hazard — moved the single line `const SELECTABLE_SYMPTOM_IDS = […];` down beside `logSymptom`, below
`HELP_TOPICS`, the same kind of tidy-up that moved `bowelOptions()` for readability one round ago:

    pageerrors: ["ReferenceError: Cannot access 'SELECTABLE_SYMPTOM_IDS' before initialization"]
    bodyLen: 0        <- blank app, for every user

Not a blocker: a blank page fails every suite instantly (under MN2 `v87-correct-a-past-day` did not
report a score at all, it died), so it cannot reach a phone. But the TDZ hazard is now **real rather than
theoretical**, it is held off by nothing but the order of four lines, and the comment a future reader
will consult says the opposite. Fix: say that `HELP_TOPICS` calls both at module-evaluation time, so the
four `const`s must stay above it.

### R3-6 — MEDIUM (record). The README states the new ratchets as stronger than they are. Third round running.

README line 14: *"New ratchets so none of this can come back by hand: the picker must equal the selectable
list in order, **Help must name every selectable symptom and none it does not offer**, **no topic may
claim the Symptoms list carries diarrhoea or constipation**, and **the bowel topic must name every value
the map defines**."*

Of those four, one holds (the picker, caught by MN1). The other three are overstated by exactly the
amount MI, MK and MH measure: Help may omit two of the nine; a topic may make the claim in any other
words; the bowel topic may omit `diarrhea`. **This is the same defect the first round raised as D1** —
*"the README's own claim about its ratchet was one of the findings"* — and the second round raised as F3,
and it is here a third time in the same row. A ratchet's exemptions belong in the sentence that describes
it.

### R3-7 — LOW-MEDIUM (Voice). `sym-log` presents a note as optional; for "Other" the app refuses to save without one.

`index.html:4099`, `sym-log` step 5: *"Add a note if there's anything worth remembering."*
`index.html:3259`: `if (m.symptomType === 'other' && !(m.note || '').trim()) { setToast('Describe the
symptom before saving'); return; }` — and the field's own label switches to *"Describe it (required)"*
(5644). A caregiver who follows `sym-log`'s five steps exactly, picks **Other** — the last item in the
sentence this release just made generate itself — and skips step 5 taps Confirm and nothing happens but
a toast. One clause on step 5.

### R3-8 — LOW (Voice, carried from the first round and not folded in). The in-app What's New still names only the banner.

`CHANGELOG[0]`, `index.html:9205-9213`, three points: the four-of-five banner, the `Correct` button, the
placeholder. The defects a user actually met are still absent — the check-in sheet rendering blank on a
Loose day, the amber dot that makes a Loose day distinguishable, and now the Help corrections, which are
the most user-facing change in the release. The README tells Aaron all of it; the person holding the
phone is told a third of it. Not false; incomplete, and incomplete in the direction of the surfaces the
app pushes hardest.

## WHAT I CHECKED AND FOUND SOUND

**A fourth prose enumeration, outside HELP_TOPICS — searched, none found.** Method: excluded the
`HELP_TOPICS` line range, then scanned every remaining line for co-occurrence of `nausea`+`vomiting`,
`very little`+`none`, and `mouth sores`+`headache`. Hits were the two maps, `SELECTABLE_SYMPTOM_IDS`, a
v68 comment, `SYMPTOM_COLORS`, the medication-purpose table (a different subject), and
`WEIGHT_REASONS`' *"Nausea, vomiting, or diarrhea"* at 3948 — a weight-change reason, a separate list
that correctly includes diarrhea because it is not the symptom picker. Inside `HELP_TOPICS` the
remaining Symptoms-category topics were read in full; the one defect there is R3-1, which is not an
enumeration, and `sym-severity`'s step 2 **is** accurate — the labels on screen read
*"How bad is it? (optional)"* with Mild/Moderate/Severe and *"Where on the body? (optional)"*, matching
the prose word for word.

**`test/v57-search.mjs` — it starts, and it fails loudly when the extraction breaks.** Mutant MP renamed
`listSentence` to `listPhrase` in all three places (the app stays correct — v87 55/55), and the suite
died with `Error: function not found: listSentence`, **exit 1**, which `run-all-tests.sh` puts in its
explicit `COULD-NOT-START` bucket before exiting non-zero. So the thing you were worried about cannot
happen silently. **But it does not exercise the generated text:** mutant MK made both generators return
`''` and v57-search scored **53/53 ALL GREEN**. Nothing in it asserts on those words. That is defensible
for a search-ranking suite — the coverage lives in 7c — but the extension restored the suite's ability
to run, it did not add coverage, and the record should say so rather than implying the generated prose is
under test there.

**Your re-aimed-mutant warning, applied to your other new mutants.** I re-ran the F5 case myself aimed at
`renderDailyValueLogger` rather than `bowelOptions()` (MQ) and it is **86/87 red** on the right check, so
the `length === bowelDefined.length` clause is real. The same question applied to 7c: the picker check
drives the live DOM through the Symptoms tab and the `+` button rather than reading source, and MN1
proves it reaches the code. Checks B, C and D read `window.__v86Test.helpTopics()`, i.e. the shipped
array — they reach the code; their weakness is scope, not aim.

**Rule 0.** 325 added lines. Zero patient-name matches, zero care-plan dose/ceiling/schedule, zero new
`med.id === '…'` branches. One pronoun hit — *"so Aaron can change his mind about it"*, the owner named
in the same clause, the established convention. `APP_VERSION` `app-v87` and `sw.js` CACHE
`chemowell-app-v87-1` still move together.

## MUTANT BOARD

Baseline, measured myself and matching the brief: `v87-correct-a-past-day` **55/55**,
`v86-logging-and-labels` **87/87**, `v57-search` **53/53 ALL GREEN**, `v55-help` **ALL GREEN**. Every
mutant applied by script from a byte copy (`/tmp/pristine.html`, md5
`88f5077718f86419e17e8c9b2a50fc9d`) and restored by `cp`; md5 re-verified after each, OK eleven times.
The runner aborts if a mutation leaves the file byte-identical, so a missed mutation cannot score as a
clean pass. No `git checkout`, `reset`, `stash` or `add`.

| # | Mutant | Result |
|---|---|---|
| MH | `bowelChoiceSentence()` drops `diarrhea` — Help reads four of five | **SURVIVED** 55/55, v55-help green, v57-search green — R3-2 |
| MI | `symptomChoiceSentence()` drops `neuropathy`, picker unchanged | **SURVIVED** 55/55, v55-help green — R3-3 |
| MJ | same, dropping `skin_reaction` **and** `fatigue` | CAUGHT 54/55 — but it names only `fatigue`, confirming R3-3 |
| MK | step 3's false claim reworded, still false | **SURVIVED** 55/55, v55-help green — R3-4 |
| ML | `listSentence()` returns `''` — both enumerations empty | CAUGHT 53/55 by 7c; v57-search **53/53 green**, v55-help green |
| MN1 | symptom picker options rendered in reverse order | CAUGHT 54/55, on the order clause |
| MN2 | `SELECTABLE_SYMPTOM_IDS` moved below `HELP_TOPICS` | CAUGHT by the browser: TDZ `ReferenceError`, blank page; the suite died — R3-5 |
| MO | both generators instrumented with a call counter | `window.__genCalls === 2` at load, Help never opened — R3-5 |
| MP | `listSentence` renamed throughout (app still correct) | v57-search **dies**, exit 1, named error — the good failure mode |
| MB2 | sentinel in the unanswered-day pre-fill (last round's survivor) | **CAUGHT twice** 53/55 — F2 genuinely fixed |
| MQ | Reports logger offers an extra value, aimed at `renderDailyValueLogger` | CAUGHT 86/87 — F5 genuinely fixed |

## WHAT I DELIBERATELY DID NOT COVER

* **Any device that is not Chromium at 390×844.** No iPhone, no Android, no real phone, no Capacitor
  wrap. Unchanged and still exempt.
* **The previous two rounds' mutants**, except MB2 and MQ, which I re-ran because they are the evidence
  that F2 and F5 are closed and that evidence had to be mine.
* **The record-correction paths** (`renderDayCorrector`, `supersedeStamp`, the note-inheritance rule) —
  measured in the two earlier rounds, untouched by this delta, and MQ/MN1 re-exercise their surroundings
  incidentally.
* **The Help search ranking itself.** `v57-search` 53/53 is reported as run, not as audited; I examined
  its extraction and its failure mode, not its ranking assertions.
* **`sync-backend/`, `tools/`, the med database** — outside this diff.
* **`release_check.sh` end to end.** Read, not run. `outputs/` still carries no `PM*app-v87*` sign-off,
  and `PUBLISHED.json` still records `app-v86` at `a62069b`.
* **Whether diarrhoea and constipation should be selectable symptoms again.** R3-1 and the F1 class are
  that Help describes controls the app lacks; re-adding controls is Aaron's decision, and
  `SELECTABLE_SYMPTOM_IDS` is now the single place it would be made.

## WORKING TREE

`git status --porcelain` empty before and after, except this report. `index.html` md5
`88f5077718f86419e17e8c9b2a50fc9d`, byte-identical to `239593d`, re-verified after every mutant and after
the final restore. No app or test file edited as a fix, nothing committed, nothing pushed. Probe scripts
live in the session scratchpad. Loopback only — the server on 8899 was already listening when this pass
began and was left as found; no other network, no Firebase, no `caretracker_*` collection touched.
