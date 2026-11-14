AUDITED-COMMIT: 2a4f94d4e7d451fea9a7e40d150c424741733ba6
VERDICT: SHIP

# Zero Day Audit — ChemoWell app-v95, DELTA 3 (narrow pass over `git diff af3d19e..HEAD`)

**G1 is genuinely closed, and I attacked it rather than read it.** Seven separate mutations of the
guard, each measured: the four term deletions all go RED, including the one that used to hide inside
its neighbour; the bracket-form rewrite goes RED; and a guard whose `return !!(` anchor disappears
fails loudly on a check of its own instead of silently matching nothing. `mutant_9` is repointed at
the hiding term and reddens the whole suite end to end. G2 now has a behavioural measurement that
fails on `mutant_8` independently of the text check. F3 reads correctly at source in both documents.
F5 reports a tally and a FAILURES list and exits 1.

**The release ships because the app is right and the instrument now bites where it was blind.** The
`index.html` serving to a phone is byte-identical to the one delta 2 measured and found behaviourally
correct, and the hole delta 2 refused the release over — a one-token deletion at the term that exists
because of Aaron's own v45 report — is shut, measured both ways.

**Four findings are recorded below, none of them a block and none of them in app code.** The sharpest
is N1: the new matcher verifies that a layer's name *appears* in the guard expression, not that it is
a *disjunct* of it, so a one-character `!` neutralises any term while the suite stays 29/29 green. I
measured that, and I measured a two-line fix red-then-green. It is a narrower and far less likely
shape than the one delta 2 blocked on, it is test-side only, and it does not need another audit of
`index.html` — fold it into this push with a tenth mutant and the sweep's "0 known open holes" line
becomes true rather than nearly true.

## The tree, as I measured it

| | |
|---|---|
| `git rev-parse HEAD` | `2a4f94d4e7d451fea9a7e40d150c424741733ba6` — matches the brief |
| branch | `claude/caretracker-team-review-i83ik2` |
| `md5sum index.html` | `4b1c45ada973c2a4955d108b8eee19c3` — matches, and identical to delta 2's |
| `md5sum sw.js` | `19cc1c1af901f7e23ac4ef5a558c8a2d` — matches |
| `APP_VERSION` | `'app-v95'` (line 9908) |
| `sw.js` CACHE | `'chemowell-app-v95-1'` (line 1) |
| diff since `af3d19e` | 5 files: `BACKLOG.md`, `README.md`, `falsify/mutants-v95-sheet.sh`, `test/v95-sheet-stability.mjs`, and delta 2's own report. **No app code.** |
| working tree | clean before this file |

Nothing was checked out. `index.html` was not edited. Every mutation was applied to byte copies in my
scratchpad and served on ports the suite itself allocated (port 0), with the sweep on 8951.

**`care-tracker` was not touched.** Not modified, not run against, no browser pointed at its live
site, no Firestore access of any kind. I read nothing from it but its instruction files. It is closed.

---

# G1 — CLEARED. Seven mutations, four classes, all of them measured

The shipped matcher, for the record:

    const expr = r.guard.slice(r.guard.indexOf('return !!('));
    const guarded = new Set([...expr.matchAll(/state\.(\w+)/g)].map(m => m[1]));

**Baseline on the shipped file:** `keys: 26`, guard source 1365 chars, `indexOf('return !!(')` = 860,
expression 505 chars, **21 guarded tokens**, `unaccounted = []`.

| Mutation of the guard | Old substring matcher | Shipped token matcher | Full suite |
|---|---|---|---|
| delete `state.confirmRemove` (the hiding term) | GREEN | **RED — `confirmRemove`** | **29 checks: 28 passed, 1 failed** |
| delete `state.timeModal` | RED | RED | (covered by mutant 3 in the sweep) |
| delete `state.whatsNewOpen` | RED | RED | **29 checks: 27 passed, 2 failed** |
| delete `state.addingProfile` | RED | RED | — |
| rewrite as `state['confirmRemove']` | GREEN | **RED — `confirmRemove`** | — |
| `return !!(` → `return Boolean(` (anchor gone) | GREEN | **RED twice, loudly** | — |
| `|| (false && state.addingProfile)` | GREEN | **GREEN** → finding N1 | 29/29 PASS |

**The deletion class, which is the one that matters, is closed.** Delta 2's own experiment reproduced:
on a byte copy with ` || state.confirmRemove` removed from the guard, the suite now prints

    FAIL  EVERY dismissible layer is either guarded or exempted with a reason — unaccounted: confirmRemove — guard it, or exempt it here and say why
    29 checks: 28 passed, 1 failed

where delta 2 measured 26/26 PASS on the same edit.

**Slicing from `return !!(` does drop the comment, and I checked it rather than assuming.** The 1365
characters of `String(liveEditingSurfaceOpen)` are 860 characters of comment and prologue followed by
a 505-character expression. The pre-`return` region contains no `state.` token today — so the second
mouth delta 2 described (a future comment writing `state.foo` and silently exempting `foo`) is shut by
construction, not by luck.

**The `slice(-1)` trap fails loudly, which was the specific thing asked.** With the anchor renamed,
`indexOf` returns `-1`, `slice(-1)` yields one character, the token Set is empty — and the new
`ok('the guard parses into whole tokens, not a text blob', guarded.size > 15)` goes RED, with the
completeness check reporting all 21 registered layers unaccounted behind it. An empty slice cannot
pass quietly.

**`mutant_9` is correctly repointed.** It now removes ` || state.confirmRemove` and leaves
`state.confirmRemovePara`, i.e. exactly the term the substring matcher could not see. I checked the
other eight anchors for the same shape — a mutant pointed at a uniquely-named term while a hiding
sibling exists — and there is only one such pair in the guard (`confirmRemove` / `confirmRemovePara`),
now mutated on the hiding side. Mutant 3 removes `state.timeModal`, which is unique.

# G2 — CLEARED, behaviourally, and it fails on `mutant_8` for the right reason

The scenario sets `chemowell-app-seen-version` to `app-v93` (an *older* marker; an unset marker
deliberately shows nothing, and the fixture's own comment says so), lets boot settle 1.8s, marks the
modal's **own** hook `[data-whatsnew-modal]` with an expando, and resamples after 3.2s.

* **Shipped file:** `ok the What's New sheet is open on first run` · `ok three seconds of ticks do not rebuild the What's New sheet`. The first check is what stops the second being vacuous: if the fixture failed to open the modal, the pass would be reported as a failure, not as a pass.
* **`mutant_8` (the `whatsNewOpen` term removed):** `FAIL three seconds of ticks do not rebuild the What's New sheet — {"present":true,"isOriginal":false}` **and** `FAIL EVERY dismissible layer is either guarded or exempted`. **Two independent reds**, so the behavioural half stands on its own — a future change that renders the modal while `whatsNewOpen` is false would still be caught by the node-identity check.
* The key name matches the app: `WHATS_NEW_KEY = 'chemowell-app-seen-version'` (line 10019).

The element is the modal itself (`index.html:10124`, `role="dialog" aria-modal="true"`), not an
ancestor found by walking up from a button — which is the trap recorded in the comment above it.

# G3 — CLEARED

The comment now states what `backLayerKeys` is: the set of surfaces the **Back button** can dismiss,
so the check catches a registered layer losing its guard and cannot see a surface that was never
registered, with `confirmUndoInpatient` named as the live example. That matches what I measured
independently: 26 registry keys, 21 guard terms, five exemptions with reasons.

# F3 — CLEARED at source, in both documents

* **`BACKLOG.md` M52** is retitled **"TWO FIXED, TWO OPEN (corrected 2026-11-14)"**; `_undoInpatientTimer` and the `confirmClearChemo` timer are struck through and marked fixed **in the list itself**, not in a later paragraph; and the false generalisation is now stated as a past error and corrected in the same sentence — *"true of `confirmRemove` alone, which is in `liveEditingSurfaceOpen()`'s list, so deferring its auto-disarm would leave a delete button hot indefinitely"*. The "reachability is low" claim, which was also wrong, is corrected where it stood.
* **`README.md`'s app-v95 row** no longer asserts the false reason and then withdraws it thirteen sentences later. It now reads *"Two are fixed here and two are not, and the first version of this row got the reason wrong"* at the point the subject comes up.

Two residual nits, neither of them the F3 defect: the lead sentence of M52 still says *"Four more
`setTimeout` callbacks still call `setState` on a wall clock"* two lines above a list in which two are
struck through (defensible, since a deferred timer does eventually call `setState`), and the
`medFormRerenderTimer` paragraph now appears twice.

# F5 — CLEARED, and the tally is right

Reproduced delta 2's crash exactly — the suite run with `--file` against a directory missing
`icon-512.png`, where the `"Got it"` click times out after 30s. **Before**, that produced no checks
line and no FAILURES. **Now:**

    1 checks: 0 passed, 1 failed
    FAILURES:
      - threw: locator.click: Timeout 30000ms exceeded. …
    exit code 1

**The arithmetic is not off by one in a misreporting direction.** The handler prints `checks + 1`
total, `checks - fails.length` passed and `fails.length + 1` failed; those three satisfy
`total = passed + failed` for every value of `checks` and `fails.length`, and the extra one is the
crash itself counted as a failed check, which is the honest reading. With a full asset directory the
same command runs clean — **29 checks: 29 passed, 0 failed** in 61s — which confirms delta 2's
diagnosis that the crash was the missing referenced asset and not the modal.

---

# N1 (NEW, not a block) — the matcher proves a term is *mentioned*, not that it *guards*

`m.match(/state\.(\w+)/g)` over the expression answers "does this name appear". It does not answer
"is this name a disjunct of the OR". Measured on byte copies, full suite each time:

| Guard | Tokens found | Completeness check | Full suite |
|---|---|---|---|
| shipped | 21 | GREEN | 29/29 PASS |
| `|| (false && state.addingProfile)` | 21 | GREEN | **29 checks: 29 passed, 0 failed** |
| `|| !state.addingProfile` — **one character** | 21 | GREEN | (same matcher result) |

In both cases the add-profile sheet — which contains a name field, and which this release guarded for
the first time — is rebuilt once a second while it is open, and every one of the 29 checks is green.
The sweep's `0 known open hole(s)` is therefore still very slightly generous: no mutant in the corpus
neutralises a term without deleting its text.

**Why this is a finding and not a second refusal.** Delta 2's hole was opened by the *most likely*
edit (deleting a term) at the *most dangerous* term, and `mutant_9` was pointed away from it, so the
record actively overstated coverage. This one needs a negation or a non-disjunct rewrite, which is a
mistake rather than a routine edit, and nothing in the corpus claims to cover it. The app is correct
either way.

**The fix, measured red-then-green, two lines, test-side only:**

    const disj = expr.replace(/^return !!\(/, '').replace(/\)[\s;}]*$/, '').split('||').map(x => x.trim());
    const guarded = new Set(disj.filter(d => /^state\.\w+$/.test(d)).map(d => d.slice(6)));

| File | Result |
|---|---|
| shipped | **GREEN**, 21 terms |
| `confirmRemove` deleted | RED — `confirmRemove` |
| `(false && state.addingProfile)` | **RED — `addingProfile`** |
| `!state.addingProfile` | **RED — `addingProfile`** |
| `state['confirmRemove']` | RED — `confirmRemove` |

The deeper version of this is to stop reading the guard as text at all: `__v86Test` exposes *the
shipped functions* for exactly this reason ("not copies of them … a check that keeps its own copy
agrees with itself"), and `guardSource` is the one hook in that object that hands out a string.
Exporting `liveEditingSurfaceOpen` callably, plus a state setter, would let the check set each key in
turn and ask the real function. That is an `index.html` change and so belongs in a later release, not
this one.

# N2 (NEW, not a block) — the crash handler can turn a green run red after it has already printed PASS

Neither handler is ever removed, and the success path does not `process.exit(0)`. So a rejection that
lands after the summary prints a second, contradictory tally underneath the PASS line and exits 1.
Measured on a synthetic script with the same structure:

    29 checks: 29 passed, 0 failed
    PASS — all good.
      FAIL suite rejected a promise: late
    30 checks: 29 passed, 1 failed
    exit 1

This is a false RED, not a false GREEN, so it cannot hide a defect — but `release_check.sh` reads exit
codes, so it is a flake that would block a good release and send somebody hunting. One line:
`process.exit(0)` after the PASS log, or drop both listeners before the summary.

# N3 (NEW, not a block) — the README row is now wrong about this release's own verification

The app-v95 row still says `test/v95-sheet-stability.mjs`, **26 checks**. It is **29** (the two What's
New behavioural checks and the token-parse check). The same row records, in detail, five verification
defects of this release — a stale anchor twice, an unreachable block, a selector that clicked the
wrong control, a text match on the dose ring's label — and records **nothing** of the sixth, which is
the most serious of them: the completeness check that was vacuous for the one term that hides. Per
Rule 0.9's own table the README version history is where that account lives; `outputs/` holds the
audit, not the record. Two numbers and three sentences.

# N4 (NEW, trivial) — a check label that is false of its own fixture

`"the What's New sheet is open on first run"` runs on a fixture with an *older* seen-marker, i.e. an
update. A first run shows nothing, deliberately, as the comment eight lines above says. Somebody
debugging a red there will set the marker to unset and get the wrong answer. Rename to *"…is open
after an update"*.

---

# Reproduced, with timings

| What | How | Time | Result |
|---|---|---|---|
| Tree identity | `git rev-parse`, `md5sum`, `grep`, `git diff --stat` | <5s | all six values match the brief; no app code in the diff |
| Guard census, shipped | own probe, reads `__backTest.keys` + `__v86Test.guardSource` | 1.8s | 26 keys, 21 tokens, comment region free of `state.` |
| Seven guard mutations | same probe, both matchers side by side | ~15s | table above |
| Suite baseline | `--file` on a byte copy with all four assets | 61s | **29 checks: 29 passed, 0 failed** |
| G1 end to end | suite on the `confirmRemove` mutant | 60s | **28/29 — RED** (was 26/26 PASS in delta 2) |
| G1 residual | suite on `(false && state.addingProfile)` | 60s | 29/29 PASS → N1 |
| G2 | suite on `mutant_8`'s edit | 60s | 27/29 — behavioural **and** completeness both red |
| F5 | suite on a directory missing `icon-512.png` | 55s | exit 1, `1 checks: 0 passed, 1 failed`, FAILURES printed |
| N2 | synthetic script, same handler shape | <1s | second tally after PASS, exit 1 |
| N1 fix | disjunct matcher, five files | ~10s | GREEN shipped, RED on all four neutralisations |
| Sweep | `FALSIFY_PORT=8951 ./falsify.sh test/v95-sheet-stability.mjs falsify/mutants-v95-sheet.sh` | ~14 min | see below |
| F3 | read M52 and the README row end to end | 3 min | correct at source in both |

## The sweep, on my own port

Reproduced the builder's record exactly, on my own port, from a throwaway clone of HEAD:

    === BASELINE (no mutant) -- every check must be green before any of them mean anything
    29 checks: 29 passed, 0 failed
    ...
    === 8 mutant(s) caught, 0 survived unexpectedly, 0 could not be measured, 0 anchor(s) stale
    === 1 over-block control(s) correctly stayed green, 0 over-block(s) fired, 0 known open hole(s)

Per-mutant, and every one of them reddens a check that names the defect rather than a count:

| Mutant | Result |
|---|---|
| 1 — Aaron's reported bug restored | 24/29, five reds, `replaced at ~4000ms` — the scenario is genuinely reachable |
| 2 — card flash undeferred | 28/29 |
| 3 — guard forgets the log sheet | 27/29, the completeness check names `timeModal` |
| 4 — OVER-BLOCK, the toast never clears | 27/29, caught by the two checks that require the toast to GO |
| 5 — guard stops caring about a focused field | 28/29 |
| 6 — OVER-BLOCK CONTROL, the toast is restyled | 29/29 green, correctly |
| 7 — In-Patient Undo undeferred (F1) | 28/29 |
| 8 — `whatsNewOpen` out of the guard (F2) | 27/29 — **behavioural check and completeness check both red** |
| 9 — `confirmRemove` out of the guard (the substring trap) | 28/29, names `confirmRemove` — **this is the line delta 2 could not get** |

`0 known open hole(s)` is now very nearly true. The one shape left open is N1 below.

# What I did not run

* **The thirteen other gated suites** — taken on trust per the brief: the builder re-ran all fourteen
  green on this exact `index.html` (md5 `4b1c45ad`), and nothing since has touched it.
* **Everything the first audit and delta 2 verified clean** — F1, F2, F4, the `state.now` ordering, the
  guard's term census against the deferred confirms, the toast chain cancellation. `index.html` is
  byte-identical to the file they measured, so re-measuring it would be re-measuring their work.
* **A real device.** None available. The mechanism that makes this class expensive — a destroyed
  `<input type="time">` dismissing Android's system clock dialog — cannot be observed in Chromium,
  which renders that input inline. Every measurement here is node identity, which is the antecedent.
* **`contrast-scan` / `overflow-scan`** — this diff moves no pixel; it touches two documents, one
  suite and one mutant corpus.

# To fold into this push (none of it touches `index.html`, none of it needs a re-audit)

1. **N1** — the two-line disjunct matcher above, and a `mutant_10` that writes `|| !state.addingProfile`
   so the corpus covers the shape. Red-then-green already measured.
2. **N3** — `26 checks` → `29 checks` in the README row, and three sentences recording the delta-2 block.
3. **N2** — `process.exit(0)` after the PASS line.
4. **N4** — rename one check label.

**No patient-identifying content.** This report names no patient, uses no gendered pronoun, and adds
no medication, dose, ceiling or schedule. `test/v75-no-other-patient.mjs` re-run after writing it.
