AUDITED-COMMIT: 3854df3
VERDICT: DO NOT SHIP

# Zero Day Audit — app-v81, round 7 (delta: `3854df3` over `b20ec72`)

## The headline, in plain words

**The disclosure now renders on all four Home placements — that part is fixed and I could not break
it. But the button that logs the uncountable dose in a batch is not one of those four rows. "Take
all" sits at the top of the group card, and on a six-medication Evening card the notice is 404
pixels below it, off the bottom of a 320×720 screen. The confirmation modal names the medication —
"Log 6 meds · Buspirone, Compazine, Paroxetine, Iron, Senokot, Perco" — and says nothing about the
limit it is about to ignore. Measured on this build: six taps of "Take all", six Perco doses past a
four-a-day ceiling. The identical medication with the dose written `1 tablet` stops at four on the
identical button.**

That is round 6's BLOCK 1 moved one level up. Round 6 blocked because the disclosure was wired to
one renderer and the other renderer's Log button ignored it. Round 8 wired the second renderer —
and left the *third* control, the one that logs every medication on the card at once, with no
disclosure of its own and, in the ordinary case of a group with more than about three medications,
with the disclosure off screen at the moment it is tapped.

**And the completeness check does not do what the commit and the README say it does.** It does not
read the app's placement picker; it reads the subset of the picker whose labels happen to end in
"Home card" or "meds group" — a naming convention copied into the suite. A sixth placement labelled
`Bedtime list` leaves the board at **146/146 green**. A sixth placement labelled `Bedtime meds group`
turns it red. The check completes against the suite's own idea of what a placement is called, which
is the same failure the commit message says was removed one layer down. There is already a live
example: `Custom (current mix)` is a real radio in that picker today and the harvest cannot see it.

**The rest of this round is sound, and a great deal of it is.** The anchored guard is correct on
every written amount I could construct, including the two the brief most wanted measured; the
deleted "look behind" half really was unreachable and I proved it two ways; the group notice is
legible, unclipped and does not overlap the Log button at 320px; `146/146`, `443/443` and
"37 mutants" all check out; Rule 0 is 27/27; nothing threw anywhere. Sections 4–9 record that so it
need not be re-done.

---

## BLOCK 1 — "Take all" logs the dose the limit cannot count, with the disclosure below the fold and nothing in the modal *(HIGH)*

### What is on the screen

`renderGroupedMedsCard` puts the notice in the medication's **row** (index.html 4372-4385). The
batch control is in the card **header** (4281) and logs every due medication at once through
`timeModal type:'multi'` (2808-2827). Between them sit every other row in the group.

Measured, viewport 320×720, Evening group of six with the combination medication last — the ordinary
shape of an evening round:

    Take all button      top y = 725
    the notice           top y = 1174
    gap                  404 px
    viewport height      720
    notice on screen when Take all is?   NO

The modal that opens, read off the page:

    Log 6 meds · Buspirone, Compazine, Paroxetine, Iron, Senokot, Perco
    DATE Mon, Sep 14 ▼   TIME  Defaults to now — edit if logging a past time
    Cancel   Confirm
    elements carrying [data-uncounted] inside the dialog: 0

### The measurement, and its control

Seeded as an app-v80 device stores a Percocet card — `version: 2`, no `doseSchemaV`, one dose
`{ label: '5/325 mg', mg: 325, pills: 5 }`, `ceiling: true, ceilingMax: 4, ceilingUnit: 'pills'`,
`groupedEvening: true` — clock frozen at 10:00 so the day cannot roll. Six rounds of
Take all → Confirm:

    round 1 -> entries 6   Perco 1
    round 2 -> entries 12  Perco 2
    round 3 -> entries 18  Perco 3
    round 4 -> entries 24  Perco 4
    round 5 -> entries 30  Perco 5
    round 6 -> entries 36  Perco 6

The control — the identical medication in the identical card, the only change being the dose written
`1 tablet`:

    round 1..4 -> Perco 1,2,3,4
    round 5    -> entries 29  Perco 4   (the batch logged 5 of 6; Perco was dropped as not due)
    round 6    -> entries 34  Perco 4

Same ceiling, same button, same six taps. One holds at four; the other does not, and at no point in
the six taps was the sentence that explains why on the screen.

### Why this is not "the card already says it"

It is the argument round 7 made and round 6 refused: *the editor says it, therefore it is disclosed*.
The answer then was that the editor is not where a dose is given. The answer now is the same one —
the row is not where THIS dose is given. `Take all` is a separate control with its own confirmation
step, it names the medication in that confirmation, and it is reachable without the notice ever
having been rendered inside the viewport.

On a group of two or three the notice does share the screen (I measured 320px, three medications:
Take all at the top, notice at y=818 — both visible). The defect is not that it is never visible; it
is that whether the caregiver sees it depends on how many medications she put in the group.

### The fix *(S)*

`uncountableDoseNotice` is a pure function of the medication and the batch already has the list of
ids. In `renderTimeModal`'s `multi` branch, under the title, render one line per medication in
`m.medIds` that returns a notice, with a `[data-uncounted="multi"]` hook. The modal is the last
screen before the write and it is where the batch is confirmed; that is the surface the caregiver is
actually looking at.

Same fix applies, for the same reason, to `type:'med'` — the standalone card's Log button also opens
this modal — but there the notice is adjacent to the button by construction, so it is a consistency
improvement, not a block.

**And the check must be written for the class (Rule 5.5):** every control on Home that can cause a
dose to be written — the standalone dose buttons, the group row Log, the group override, and
`Take all` — is asserted to disclose, with the medication placed so the row notice is *outside the
viewport*, or the case passes for the wrong reason.

### Name the seat

**The builder's write model, and the Designer.**

- *Write model (Rule 1.5)* — round 6 named the enumeration duty exactly: "a fix whose entire purpose
  is 'the caregiver is told on the screen where she gives the dose' has to enumerate the screens
  where a dose is given." The enumeration this round performed was of *placements* (four), not of
  *controls that write a dose* (four renderers' worth of buttons plus one batch). `Take all` is
  named in the release's own commit message — *"renderGroupedMedsCard has its own Log button, its own
  Take all"* — and then only the Log button was wired.
- *Designer (Rule 1.5)* — every touched screen at 320/360/390. The group card was touched. At 320
  with a realistic evening group the new element is 404px below the control it exists to qualify,
  and no screenshot of that case appears in `outputs/`.

---

## BLOCK 2 — the completeness check reads a pattern the suite invented, not the app's picker *(MEDIUM-HIGH)*

### The claim

Commit `3854df3`: *"it reads the app's own placement picker and requires every placement that can log
a dose to carry the disclosure: **a synthetic sixth placement turns it red**"*. README row: *"the
check is now written against the app's own list of Home placements: **adding a sixth without wiring
the disclosure turns it red**"*.

### The code

test/v81-dose-parser.mjs, the completeness block:

    const seen = [...document.querySelectorAll('*')]
      .filter(e => !e.children.length)
      .map(e => (e.innerText || '').trim())
      .filter(x => /(Home card|meds group)$/.test(x));

The list of placements is not what the picker contains. It is what the picker contains **that ends
in one of two phrases the suite hardcodes**. Placement names are the app's to choose.

### Measured, two mutants of `PLACEMENT_OPTIONS`, full suite each

    M-A  sixth option label 'Bedtime list'        -> 146/146 PASSING
         picker readout: ["◉ Own Home card","○ Morning meds group","○ Afternoon meds group",
                          "○ Evening meds group","○ No Home card"]          <-- the sixth is absent
         'every Home placement that can log a dose is covered above'  PASS

    M-B  sixth option label 'Bedtime meds group'  -> 145/146, 1 FAILING
         'every Home placement that can log a dose is covered above'  FAIL
                          unaccounted: ["○ Bedtime meds group"]

The release's own mutant M38 ("a SIXTH Home placement is added and the notice is not wired to it")
is an M-B. It dies. An M-A does not, and nothing in the record distinguishes them.

### And it is not hypothetical — there is already a sixth option the harvest cannot see

`PLACEMENT_OPTIONS` is concatenated at 7656 with a `Custom (current mix)` entry whenever the
medication being edited has a mixed placement. Measured, editing a medication with
`quickLog: true, groupedEvening: true`, reading every `[role="radio"]` in the editor:

    radios in the placement group:
      ○ Own Home card …
      ○ Morning meds group …
      ○ Afternoon meds group …
      ○ Evening meds group …
      ○ No Home card …
      ◉ Custom (current mix)  Keeps the existing layout: Own card + Evening group.

    what the suite's harvest sees:
      ["○ Own Home card","○ Morning meds group","○ Afternoon meds group",
       "○ Evening meds group","○ No Home card","Own Home card"]

Six real options, five harvested, plus one stray duplicate leaf. `Custom` is harmless today — it
resolves to a mix of the four covered surfaces — but it proves the harvest is already not an
enumeration of the picker.

### A second, quieter hole in the same check

    const unaccounted = offered.filter(x => !COVERED.some(...) && !EXEMPT.some(...));
    t(..., offered.length > 0 && unaccounted.length === 0, ...)

It fails on an *extra* option and on an *empty* picker. It does not fail if options **disappear**:
a picker reduced to one option satisfies `offered.length > 0` and `unaccounted.length === 0`. The
four COVERED names are never asserted to be present.

### The fix *(S)*

    const offered = [...document.querySelectorAll('[aria-label="Home screen placement"] [role="radio"]')]
      .map(e => (e.innerText || '').split('\n')[0].replace(/^[◉○]\s*/, '').trim());

— structural, not lexical: it is every radio in the placement radiogroup, whatever it is called.
Then assert both directions: `unaccounted.length === 0` **and** every one of the four COVERED names
is present, so a placement removed or renamed is as red as a placement added. Re-run M-A: it must go
red. And correct the README sentence and the commit-message claim, which are false as written.

### Name the seat

**The builder, and this is the seventh claim in this release to describe a property the code does
not have.** Round 6 recorded the sixth and blocked on it. The specific trap here is the one the
commit message *names*: *"a completeness check completing against itself."* Removing the fallback
list removed one copy of the app's knowledge from the suite; the harvest filter is the other copy,
and it was left in.

---

## BLOCK 3 — round 6's copy fix was not carried out, and the false sentence is still reachable *(MEDIUM)*

Round 6's BLOCK 2 offered two options and said, in terms: *"Do not ship option 2 without 1: the
sentence is wrong today either way."* Option 2 (the parser) shipped. Option 1 (the copy) did not —
`grep` finds the editor line unchanged at 7512, and `uncountableDoseNotice` unchanged at 1885.

The parser fix is real and it closes the four forms round 6 measured. It is **order-dependent**, and
the instruction the app gives does not say so. Measured on the shipping build, a card seeded with the
strength written first:

    dose stored:  {"label":"5/325 mg (1 tablet)","mg":325}      <-- no pills, not counted
    the card reads:
      ! This amount is not counted toward the daily limit of 4 pills — the app cannot tell how
        many that is: 5/325 mg (1 tablet). Nothing on this card is being counted against that limit.

*"the app cannot tell how many that is"* about a string containing the words **1 tablet** — round 6's
sentence, verbatim in shape, reached by writing the two halves the other way round. The editor's
remedy still reads *"Write the amount as a plain number if it should count"* and never says the
number has to come **first**, which is now the whole rule.

Two other reachable cases where the sentence is not true: `1/10 tablet` and `3/2 tablets` both print
*"the app cannot tell how many that is"* about amounts the app can read perfectly well and has
decided, correctly, not to evaluate.

### The fix *(S, copy only)*

- Notice: *"the app cannot tell how many that is"* → *"the app will not count this amount"*, which is
  true in every case it fires.
- Editor: *"Write the amount as a plain number if it should count"* → *"Start the amount with the
  number of tablets if it should count — for example `1 tablet (5/325 mg)`."* That is the rule the
  parser actually implements, and it is the example the suite already pins.
- One suite row for `5/325 mg (1 tablet)` so the order-dependence is written down rather than
  discovered again.

### Name the seat

**The Voice (Rule 2.7, question 1).** A parser change that makes a sentence true for four inputs and
leaves it false for a fifth is a copy question, not a parser question, and the release shipped the
parser half of a two-half fix the standing audit had explicitly refused to accept alone.

---

## 4 — the anchored guard, attacked *(no block — it is correct)*

Every string in the brief plus fourteen more, through the shipping parser (`window.__doseTest`), on
`3854df3`:

| typed | normalised (counting form) | mg | pills | verdict |
|---|---|---|---|---|
| `5/325 mg` | `5/325 mg` | 325 | — | right |
| `5/325 mg, 10/325 mg` | two options | 325 / 325 | — / — | right — both refused |
| `5/325` | `5/325` | 0 | — | right |
| `0.5/325 mg` | `0.5/325 mg` | 325 | — | right — the decimal is still the numerator |
| `1 tablet (5/325 mg)` | unchanged | 325 | **1** | right — the instruction the app gives |
| `1 tablet of 5/325` | unchanged | 0 | 1 | right |
| **`1.5 tablets (5/325 mg)`** | unchanged | 325 | **1.5** | right |
| **`1 1/2 tablets (5/325 mg)`** | `1.5 tablets (5/325 mg)` | 325 | **1.5** | **right — and the LABEL stays `1 1/2 tablets (5/325 mg)` verbatim, so no rewrite notice fires** |
| **`½ tablet (5/325 mg)`** | `0.5 tablet (5/325 mg)` | 325 | **0.5** | right |
| **`2/3 tablet (5/325 mg)`** | `0.6666… tablet (5/325 mg)` | 325 | **0.667** | **right — the mixed/fraction pass evaluates the fraction it can and leaves the strength alone; the two do not interfere** |
| `1/2 of a 5/325 tablet` | `0.5 of a 5/325 tablet` | 0 | 0.5 | right |
| `1 5/325 mg` | unchanged | 325 | 1 | right — the mixed-number pass refuses denominator 325 and returns the whole match untouched |
| `1 patch/24h` | unchanged | 0 | 1 | right |
| `1 tab/day` | unchanged | 0 | 1 | right |
| `10 mL/dose` | unchanged | 0 | 10 | unchanged from before this diff |
| `30 mg/1 mL` | unchanged | 30 | 30 | unchanged from before this diff — see finding 10 |
| `1/10 tablet`, `3/2 tablets`, `875/125 mg`, `300/30/10` | unchanged | — | — | right — all refused |
| `5 mg/mL`, `100 mg/m2`, `1:1000` | unchanged | — | 5 / 100 / 1 | unchanged from before this diff |

No page errors on any of them.

**The float does not leak to the screen.** `2/3 tablet (5/325 mg)` stores `pills: 0.6666666666666666`
and the daily-total card prints **"0.667 / 4 pills"** and **"3.333 pills left before the daily
limit"**. Checked because this release opens a counting path that previously counted nothing.

## 5 — was the deleted "look behind" half actually dead? *(YES — proven, the claim is true)*

The claim is that the counted number is the first number in the string, so a slash-and-digit can
never sit immediately before it. Two independent proofs:

1. **Analytic.** `numMatch = countable.match(/(\d*\.?\d+)/)` is leftmost, and at any digit position
   the pattern matches trivially (`\d*`→"", `\.?`→"", `\d+`→that digit). So the match cannot begin
   after a digit. Therefore no digit precedes `match.index`, therefore no `\d\s*\/\s*` does.
2. **Exhaustive.** All strings up to length 5 over the alphabet
   `0 1 5 . , / space m g ( ) x - ½ t` — **542,163 strings that contain a number match, zero** where
   a digit-slash sits immediately before it.

The line was unreachable. Deleting it rather than keeping it was right, and the comment left in its
place is accurate.

## 6 — the grouped notice on the screen *(no block; one Designer finding, LOW)*

Viewport 320×720, Evening group of three, notice rendered:

    notice box   x 32 → 207.4   (width 175.4, height 129.5, 8 lines at 12px)
    Log button   x 219.4        (44px tall)          <-- no overlap, 12px clear
    card         x 16 → 304      document scrollWidth 320  <-- no sideways scroll
    computed     12px, #8C5900 on transparent, border 0px

**Legible, unclipped, gutter on both sides, does not collide with the button, does not push the page
sideways.** It wraps to eight lines and the row grows to 180px, which is correct behaviour rather
than a defect.

**The finding is that it is not the same object as the standalone one.** The standalone card renders
a bordered, tinted callout — `background rgba(246,108,49,0.07)`, `border 1px solid rgba(246,108,49,
0.20)`, `padding 6px 8px`, a bold `!` in its own span. The grouped one is a bare amber paragraph with
a `'! '` string prefix, no box, styled **identically to the line directly above it**
(*"No date set — showing every day until you set a treatment date."* — same 12px, same `#8C5900`,
same weight). The one safety sentence on the row is visually indistinguishable from a scheduling
note. *(Designer.)* Fix (S): the round-6 recommendation that was not taken — lift the markup into one
`uncountedNoticeEl(med, where)` and call it from both, so the two surfaces cannot drift and the third
caller (BLOCK 1's modal) is one line.

**And the suite does not check the new surface at 320px.** `the notice is unclipped at 320px` and
`it keeps a gutter` both read `[data-uncounted="card"]` only. I measured the group version by hand
and it passes; the check does not exist. *(Rule 5.5 — a new surface for the same string got no
layout case.)*

## 7 — the Voice on the reused string *(LOW-MEDIUM)*

The sentence ends *"Nothing on this card is being counted against that limit."* It was written for a
card containing one medication. Measured verbatim on the Evening group card, which contains six:

    Perco  ! This amount is not counted toward the daily limit of 4 pills — the app cannot tell how
    many that is: 5/325 mg. Nothing on this card is being counted against that limit.  ✓ Logged 10:00 AM

Literally true (nothing on the card counts toward *Perco's* limit) and misleading in the place it now
appears, where "this card" is a shared card whose other five medications have limits of their own
that do count. On a group row it should read *"Nothing this medication logs is being counted against
that limit."* *(Voice, Rule 2.7 question 1 — the string is unchanged but the surface is new, and a
sentence is only true in a place.)*

## 8 — every claim in the commit, the comments, the README row

**Verified TRUE:**

* `test/v81-dose-parser.mjs` **146/146**, re-run here on a clean tree (89 s).
* **"37 mutants across five rounds, all dead."** 37 distinct ids across the five `FALSIFY-app-v81*`
  files. *(The ledger skips **M36** — 37 ids running M1…M38. The count is right; the gap is not
  explained anywhere, and a future reader cannot tell a numbering slip from a survivor that was
  quietly dropped. One line in the file would fix it. LOW.)*
* **"443/443 across twelve suites."** `outputs/SUITES-app-v81.txt` sums to exactly 443 over exactly
  12 headings. I re-ran two of the twelve — dose-parser 146/146 and v75-no-other-patient 27/27 — and
  did not re-run the other ten, which is stated rather than asserted.
* **"the guard's second half … is unreachable … A mutant deleting that half left every check
  green."** True, and stronger than stated — see section 5.
* **The corrected README sentence** — *"says next to the button that gives the dose exactly which
  amount is not being counted"* — is now true for all four placements. Round 6's finding 6 was
  carried out.
* **`combo({ quickLog: false })` plus a group flag genuinely places the medication in that group.**
  `renderToday` filters on the bare flags (6113/6117/6121) with no type restriction, and the three
  assertions read a notice that is only present if the row rendered. They exercise one renderer at
  three call sites, not three renderers — which is the right coverage, since one renderer is what
  exists — and `seedAndOpenHome` rewrites the whole config and clears entries on every call, so no
  stale screen can satisfy them. Sound.
* **The negative on a group card can fail.** M34 turns all three grouped rows red.

**FALSE:** *"a synthetic sixth placement turns it red"* (commit) and *"adding a sixth without wiring
the disclosure turns it red"* (README). See BLOCK 2 — measured green on M-A.

## 9 — spot-checks of what earlier rounds passed *(all still clean)*

* **`h()` null-attribute trap** — the one new hook, `'data-uncounted': 'group'` (4381), is a literal,
  not a conditional. No instance in this diff.
* **Render safety** — the new IIFE is the same pure call as the standalone one inside a render list;
  no page errors across every seed in this report, including `doses: []`, a non-array `doses`, the
  six-medication group, and the Take all batch runs.
* **Rule 0** — `test/v75-no-other-patient.mjs` **27/27**, ratchets unmoved. Nothing in this diff adds
  a name, a gendered pronoun, a care-plan dose or a branch keyed to a medication id. `Perco`,
  `5/325 mg` and `Bedtime` appear only as generic examples.
* **`release_check.sh`** — correct: still refusing, naming the missing PM sign-off and every standing
  DO NOT SHIP on record. This report makes seven.

## 10 — carried forward, checked against the current file rather than assumed

* **`cwBkApplyTo` (549) is still unmigrated.** `saveJSON(K('med-v1'), { version: 1, meds: incomingMeds, … })`
  writes restored medications straight to disk with no `.map(migrateDoseLabels)`. Round 5 finding 2,
  round 6 finding 10 — open, one line. **It has become more urgent, not less:** this release's whole
  subject is a medication whose stored `pills` is wrong, and this is the one door that writes stored
  medications without re-reading them through the fixed parser.
* **The `{threw}` wrapper is still not applied** where round 6 named it. Open, one line each.
* **The module-binding-order guard is still not in `harness/`** — `harness/` holds one unrelated file.
  Recommended, not required. No change in urgency.
* **Backlog, not this release:** `rollingCeilingH` is ignored whenever `ceilingUnit` is set, so a
  rolling unit limit is silently enforced as a calendar-day limit.
* **Backlog, not this release, and outside this diff:** `100 mg/m2` counts `pills: 100` and
  `30 mg/1 mL` counts `pills: 30`. Unchanged by this release — both the old string-wide guard and the
  new anchored one leave them alone — but suite section 2 blesses them as *"safe before and the guard
  must not make them unsafe"*, and under a 4-application limit the first dose of either trips "over
  limit" immediately. That is round 3's over-count defect with a different string, blessed in a
  comment. Worth its own release, not this one.

---

## What it would take to turn this into SHIP

1. **BLOCK 1** — disclose in the `multi` confirmation modal, and write the case for the CLASS: every
   Home control that writes a dose, with the row notice deliberately scrolled out of the viewport.
2. **BLOCK 2** — harvest the placement picker structurally (`[role="radio"]` inside the placement
   radiogroup), assert presence as well as absence, re-run M-A red, and correct the two false
   sentences in the commit message and the README row.
3. **BLOCK 3** — round 6's copy half: the notice stops claiming it cannot tell, and the editor says
   the number must come first.
4. Should ride with it: one shared `uncountedNoticeEl(med, where)` (finding 6), the 320px case for
   the group surface, *"Nothing on this card"* reworded for a shared card (finding 7), the M36 note,
   and `cwBkApplyTo`.

1, 2 and 3 are the release. 4 is small and all of it is one edit away from the same files.

Chromium only; an iPhone's rendering cannot be reproduced in this sandbox and stays exempt.

Evidence screenshots: `outputs/v81-audit-r7-shots/` — `A-evening-320.png` (notice beside the Log
button, three-medication group), `A-takeall-modal-320.png` (the batch modal with no disclosure),
`C-long-evening-320.png` (Take all on screen, notice 404px below), `C-after-takeall-320.png` (six
Perco doses past a four-a-day ceiling).
