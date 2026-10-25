AUDITED-COMMIT: 2e60c2d
VERDICT: SHIP

Zero Day Audit — ChemoWell app-v87, DELTA PASS, branch `claude/caretracker-team-review-i83ik2`,
HEAD `2e60c2d`. Delta audited: `git diff bb45852 2e60c2d` — one commit, 6 files, +480/-20.

## HEADLINE

**All six claims hold, and the three checks that survived the previous round now bite.** The two
hand-written bowel option lists are one shared `bowelOptions()`; the banner names the day it
actually writes to, from the same variable as the heading; `loose` renders amber rather than
green; a note no longer follows a changed answer; both record corrections are made. Eleven mutants,
nine red. `v87-correct-a-past-day` **43/43**, `v86-logging-and-labels` **87/87**, both matching the
README. Nothing in this delta can lose a record, mis-state one, or silently refuse a correction.

**What I found instead is one missing check and one overstated sentence, neither of them in the
app's behaviour.** Nothing asserts a caregiver can still *decline* to answer the check-in — deleting
the sheet's "Not answered" option scores a clean 43/43, 87/87 and 10/10 (**D2**, the eighth). And
the README's own ratchet claim — *"adding a sixth value to the app and forgetting the banner is
what turns it red"* — is **no longer true**: with the options generated from the map you cannot
forget a control, so a sixth value scores 43/43 green. The check that *does* fire on a sixth value
is `bowelUi.values.length === 5` in the v86 suite — a number typed into the suite, failing on an app
that is **correct** (**D1**). Both are one line each and neither blocks.

## THE SIX CLAIMS, WITH EVIDENCE

**1 — one shared option list.** `grep -n "h('option', { value: 'diarrhea' }" index.html` → no hits;
the only two callers of `bowelOptions()` are 3712 (check-in sheet) and 6021 (banner). Measured in
Chromium at 390 on a standing `loose` day: sheet `options = ["=Not answered", "normal=Normal",
"very_little=Very little", "none=None", "loose=Loose", "diarrhea=Diarrhea"]`, `value="loose"`,
`selectedIndex` 3, shown `"Loose"`. The blank select is gone.

*Does either control lose something?* **No.** The sheet keeps `''`/"Not answered" prepended at
index 0, the banner keeps its own placeholder at index 0. *Can a caregiver still decline?* **Yes,
measured end to end**: an unanswered day opens the sheet at `index 0 → "Not answered"`, Save writes
`0` bowel entries and `0` entries of any kind, toast "Check-in saved" — `confirmCheckinModal` gates
on `m.bowel` being truthy. *Is the order the same?* **Yes.** `Object.keys(BOWEL_MOVEMENT_LABELS)`
is `normal, very_little, none, loose, diarrhea` — the sheet's previous four in their previous
order, with `Loose` inserted between None and Diarrhea, identical to the banner's previous order.

**2 — the placeholder is true.** Measured on a banner whose day IS today: heading `"Update status
for today"`, placeholder `"Change the answer for today…"`. Suite section 1c drives the non-today
case and compares the two day strings pulled out independently. Mutant MD7 (restore the hardcoded
`today`) → **3 red**.

**3 — the three survivors.** MD1 `Loose` dropped from the corrector → **42/43** (was 25/25 green).
MD2 `dailyLogBusy = false` moved out of its `finally` → **42/43** (was green); the new 7b scenario
makes `Storage.prototype.setItem` throw, reads the toast, then proves the next pick still lands
(`1 -> 2`). MD3 highlight forced off → **42/43** (was green). All three are now covered.

**4 — `loose` is amber.** Measured `rgb(199, 120, 0)` against Normal `rgb(15, 157, 107)` and
Diarrhea `rgb(192, 69, 59)`. MD6 (drop `loose` from the watch set) → **42/43**.

*Every `BOWEL_ISSUE_VALUES` consumer checked* — 3768 `bowelIssueActive`, 3775
`currentBowelIssueType`, 3781/3785 `daysSinceBowelIssueStart`, 11849 the dot. The day summary
(11558) counts bowel entries without classifying them; `buildExportRows` carries the label, not a
band. **None of them needed the watch set**, and promoting `loose` into the issue set would have
turned a watch value into a red alarm — correctly left to Aaron. One place `loose` reads
inconsistently is named as **D5** below; it is pre-existing, not introduced here.

**5 — the note rule.** Truth table walked against the shipped `logAppetite`:

| prev | incoming `note` | result |
|---|---|---|
| same value, note absent | `undefined` | inherits prev note → guard matches → **no-op, nothing written** |
| same value, note `''` | `''` | differs from prev note → **writes, clears the note** (pre-existing, deliberate: `confirmCheckinModal`'s comment is why it passes no third argument) |
| same value, new note | string | **writes** — a real correction |
| CHANGED value, note absent | `undefined` | `sameValue` false → `incoming = ''` → **writes with no note** |
| CHANGED value, with note | string | **writes with that note** |
| no prev at all | either | **writes** |

No combination loses a note it should keep: the superseded entry keeps its own, verified in the
export (`superseded note="ate a full dinner"`, standing `note=""`). No combination refuses a
correction it should accept. `confirmCheckinModal` is unaffected — it passes no third argument, so
re-confirming an unchanged answer that carries a note is still a no-op. MD8 (revert the inheritance)
→ 42/43 and 86/87. MD11 (`sameValue = false`, stripping a note on re-confirm) → **84/87**.

**6 — the two record corrections.** The `setState` comment now describes `Object.assign` + render
and says the old mechanism was invented. The Designer heading reads *"One screen not re-captured,
at its three widths"*. Both correct.

## MUTANT BOARD

Baseline 43/43. Every mutant applied in place, restored from a byte copy, `md5sum -c` after each
(`bccda4b60a407d68817a50298a78f3dd`, OK eleven times).

| # | Mutant | Result |
|---|---|---|
| MD1 | `Loose` dropped from the corrector's picker | **CAUGHT** 42/43 |
| MD2 | `dailyLogBusy = false` out of the `finally` | **CAUGHT** 42/43 |
| MD3 | `const on = false` — highlight forced off | **CAUGHT** 42/43 |
| MD4 | `bowelOptions()` filters out `loose` | **CAUGHT** 35/41, 6 red |
| MD5 | check-in sheet re-hardcoded to the old four | **CAUGHT** 41/43 |
| MD6 | `loose` removed from `BOWEL_WATCH_VALUES` | **CAUGHT** 42/43 |
| MD7 | placeholder back to the hardcoded `today` | **CAUGHT** 40/43 |
| MD8 | note inheritance reverted across a changed answer | **CAUGHT** 42/43 and v86 86/87 |
| MD9 | a SIXTH value (`watery`) added to the map, no control touched | **SURVIVED 43/43** — see D1 |
| MD10 | the sheet's `''`/"Not answered" option deleted | **SURVIVED** 43/43, 87/87, v58 10/10 — see D2 |
| MD11 | `sameValue = false` — a re-confirm strips the note | **CAUGHT** v86 84/87 |

## NEW FINDINGS

### D1 — MEDIUM (record, not behaviour). The README's ratchet claim is obsolete, and the check that does fire is a typed literal.
The row states: *"The banner check counts against the app's own label map, not a number typed into
the suite, so adding a sixth value to the app and forgetting the banner is what turns it red."*
That was measured true at `bb45852`. At `2e60c2d` it is **not**: MD9 adds `watery` to
`BOWEL_MOVEMENT_LABELS`, touches no control, and `v87-correct-a-past-day` scores **43/43 green** —
because the controls are generated, so forgetting one is unreachable. The construction is strictly
better than the check; the sentence describing it is now wrong. Worse, the thing that *did* go red
on MD9 is `test/v86-logging-and-labels.mjs:94`,
`t('it offers every bowel value', bowelUi.values.length === 5 && …)` — it failed with
`normal,very_little,none,loose,diarrhea,watery`, i.e. **on an app that was correct**. That is
exactly "a figure somebody has to remember to edit", in the suite the sentence contrasts itself
with, and the next release that adds a value gets a red it will be tempted to fix by changing `5`
to `6`. Repro: apply MD9, run both suites. Fix: `bowelUi.values.length === Object.keys(await
page.evaluate(() => window.__v86Test.bowelLabels())).length`, and reword the README to claim what
is now true — the control is built from the map, so a hand-written list is what goes red.

### D2 — LOW-MEDIUM. THE EIGHTH. Nothing asserts a caregiver can decline to answer.
`test/v87-correct-a-past-day.mjs:1b` reads the sheet's options with `.filter(Boolean)`, which
deliberately drops the `''` option, and no check anywhere reads it back. MD10 deletes
`h('option', { value: '' }, 'Not answered')` and scores **43/43, 87/87, 10/10**. The consequence it
hides is the release's own headline in mirror image: with `m.bowel === ''` and no `''` option the
select is `selectedIndex -1` and renders **blank** for every unanswered day — the state the sheet
is in every single morning. The shipped code is right (measured above); nothing holds it there.
Fix: two lines in 1b — the sheet's first option has `value === ''`, and on a day with no entry it
is the one selected.

### D3 — LOW-MEDIUM (Voice). The in-app Help still enumerates four of five, for the control this delta just fixed.
`index.html:4058`, FAQ `sym-bowel-confusion`: *"Use the **Daily check-in** bowel question for the
day's overall pattern — normal, very little, none, or diarrhoea."* The sheet now offers five. A
caregiver with loose stools reads that list, does not see their day in it, and goes to Symptoms —
which is the "nothing told anyone where to go" failure this release exists to end, one surface
over, in the surface whose only job is telling the caregiver what the control does. Three words.
(The same string spells it *diarrhoea* while the app's own label is *Diarrhea*; pre-existing, and
the keyword list carries both spellings on purpose, so I am not calling that one.)

### D4 — LOW (Voice). The in-app What's New names only the banner.
`CHANGELOG` app-v87 point 1 says the **Home banner** offered four of five. True. But the defect a
user actually met — the once-a-day check-in sheet going blank on a Loose day — and the amber dot
are not mentioned at all. The README tells Aaron both; the person holding the phone is told
neither. Not false, incomplete, and the incompleteness points away from the route the app pushes
hardest. One point added to the existing three.

### D5 — LOW (record). Choosing `Loose` on the banner DISMISSES the alarm, and the README does not say so.
Measured: a standing `diarrhea` day, pick `Loose`, Update → entries `["diarrhea","loose"]`
(superseded, nothing deleted — correct), toast *"Bowel movement updated — Loose"*, and
`"Bowel issue active"` **gone from the page**. `daysSinceBowelIssueStart()` resets with it. The
README tells Aaron only the half that is a non-event — *"it is NOT promoted into
`BOWEL_ISSUE_VALUES`… alarming on Loose is Aaron's decision"* — and does not tell him that Loose
currently **ends** an alarm exactly as Normal does, while the history list it just repainted calls
Loose amber. Clinically defensible (diarrhea → loose is improvement) and pre-existing, so not a
blocker; but it is the half of the decision he would actually want to make, and the release that
made Loose one tap from that control is the release that should name it.

### D6 / D7 / D8 — NITS
**D6** `test/v87-correct-a-past-day.mjs:195-196` is a leftover empty `if (opts) {\n}` — dead code
left by the edit. **D7** the README row now carries both *"still **86/86**"* and ***87/87*** for
`v86-logging-and-labels` in the same cell; the suite's own figure self-check passed only because
the word *"still"* sits between the filename and the first number and its regex does not allow it —
the stale figure is skipped by luck, not by design. **D8** `bowelOptions()` (a hoisted function
declaration, 3494) reads `BOWEL_MOVEMENT_LABELS` (a `const`, 3501). Safe today because every caller
is a render function, but a TDZ `ReferenceError` the day anything calls it at module-evaluation
time; moving the `const` above it costs nothing.

## RUNS — measured, not asserted

Loopback only, `env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy`. A server was
**already listening on 8899** when this pass began, serving this working tree (`curl | md5sum`
matched `index.html` byte for byte); I did not start it and have left it as I found it. No other
server started, no Firebase, no `caretracker_*` name touched, no network beyond 127.0.0.1.

| Suite | Result |
|---|---|
| `test/v87-correct-a-past-day.mjs` | **43/43** — matches the README, confirmed by its own figure self-check |
| `test/v86-logging-and-labels.mjs` | **87/87** — matches |
| `test/v83-meds-and-reports.mjs` | 80/80 |
| `test/v85-profile-reminders.mjs` | 43/43 |
| `test/v75-no-other-patient.mjs` | 27/27 — Rule 0 ratchet intact |
| `test/v80-up-next.mjs` | 49/49 |
| `test/v58-eod-checkin.mjs` | 10/10 |
| `test/v59-para.mjs` | 15/15 |
| `test/v64-logger.mjs` | 23/23 |
| `test/v84-whatsnew.mjs` | 95/96 — the identical pre-existing red, *"the field is below the fold"*, `top=836` in an 844px viewport. Not this delta |

No page error on any scenario in any suite or probe.

## RULE 0 AND THE VOICE

Twenty-seven added lines in `index.html`. Zero patient-name matches, **zero gendered pronouns
including the code comments** (`\b(she|her|hers|herself|he|him|his|himself)\b` over the added
lines → none), zero care-plan dose/ceiling/schedule, zero new `medId === '…'` or `med.id === '…'`
branches. `v75-no-other-patient` 27/27. The one name in the delta is *"Aaron's call"* in a code
comment — the owner, not a patient, and `Aaron` already appears 130 times in this file as the
established comment convention, so it is not a leak and should not be re-raised.

Caregiver-facing strings the delta changes, read in full: the banner placeholder (true on every
path, and it is the plain sentence a tired person reads at 2am), the sheet's five option labels
(the app's own map, unchanged wording), and the dot colour, which says nothing. The README row's
checkable claims verified: both suite figures run true; `APP_VERSION` is `app-v87` and `sw.js`
CACHE is `chemowell-app-v87-1`, moving together; `87d1784` carried the identical four-option banner;
the Reports logger does map `Object.keys(labels)` and offers all five. The row's admission that the
figure automation wrote `**/**` is sound — **there is no live broken figure left**; the only
`**/**` in the file is the backticked mention inside that sentence. Two claims are overstated:
D1 (the ratchet) and D5 (the half-told Loose decision).

## NOT BLOCKING ON

D1 through D8. None harms a user, none damages a record, and the one check that cannot fail
(**D2**) guards behaviour I measured correct rather than behaviour I am taking on trust. **Worth
doing in this release because each is one line and all are inside its own scope:** D3 (three
words in the FAQ), D1 (replace `length === 5` with the map's length, and reword the README
sentence), D6 (delete the empty block). D2 is two lines in a suite. D4, D5, D7, D8 are a backlog.

## RELEASE MECHANICS — what still stands between this and a push

`bash release_check.sh` exits **1** today, for two reasons it names: *"missing: an
outputs/PM\*app-v87\*.md sign-off"*, and the previous round's report refusing `bb45852`. This
report supersedes that refusal under the gate's own rule — same stage, strictly later commit
(`bb45852` is an ancestor of `2e60c2d`), over the 2000-byte / 25-line floor, header flush left and
adjacent. **A PM sign-off naming `2e60c2d` or later is the one remaining chain item.** Also note
the gate's baseline warning: `PUBLISHED.json` still records `app-v86` at `a62069b` with two
index.html commits since, so if either was already pushed, `./mark_published.sh` runs first.

## WORKING TREE

`git status --porcelain` shows only this file. `index.html` md5 `bccda4b60a407d68817a50298a78f3dd`,
byte-identical to `2e60c2d`, verified after all eleven mutants. No `git add`, `checkout`, `reset` or
`stash`. No commit, no push.
