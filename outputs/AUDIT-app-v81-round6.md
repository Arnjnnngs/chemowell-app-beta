AUDITED-COMMIT: b20ec72
VERDICT: DO NOT SHIP

# Zero Day Audit — app-v81, round 6 (delta: `b20ec72` over `217cba0`)

## The headline, in plain words

**The disclosure was added to one of the four places a dose is given. On the other three — the
Morning, Afternoon and Evening group cards — the exact defect the last audit blocked this release
for is still live, with nothing on screen saying so. Measured on this build: a medication placed in
the Evening group, dose `5/325 mg`, daily limit 4 tablets armed. Six taps of Log, six doses
recorded, no block, no warning, no notice anywhere on the page. The identical medication moved to
its own card shows the new amber line and the identical medication with the dose written
`1 tablet` locks at four.**

Round 5's block was that a caregiver's daily limit stops counting after the upgrade and is not told.
Round 7's answer is right in principle — count what you can, disclose what you cannot — and it was
wired into `renderToday`'s standalone medication card only. `renderGroupedMedsCard` has its own Log
button, its own "Take all", and calls `logMed(med.id, med.doses[0])` with the same uncountable dose.
It never calls `uncountableDoseNotice`.

The release's own README row states the opposite, to the product owner:

> *"says on the card, next to the button that gives the dose, exactly which amount is not being
> counted and against which limit"*

False for three of the four placements the medication editor offers.

**The rest of the round is sound and I could not break it.** No `h()` null-attribute trap, no render
throw on any hostile medication I could construct, the truth conditions are right on every ceiling
shape I tried, `release_check.sh` is correct, the numbers in the README row check out, and Rule 0 is
clean at 27/27. Details in sections 3–8, so they are not re-audited.

---

## BLOCK 1 — three of the four Home placements disclose nothing, and the limit is still silently ignored there *(HIGH)*

### The code

`uncountableDoseNotice(med)` is called from exactly one place, index.html 6054-6065, inside
`renderToday`'s `medCards` map — the standalone Quick-log card.

    $ grep -n 'uncountableDoseNotice' index.html
    1847:function uncountableDoseNotice(med) {
    6056:        const notice = uncountableDoseNotice(med);

`renderGroupedMedsCard` (4234-4366) is the other Home renderer. It is not a display-only list: each
row carries a `Log` button wired to `logMed(med.id, med.doses ? med.doses[0] : null)` (4340), the
header carries `Take all (n)` (4263), and both write entries. Its row prints the medication name,
the sub-line, the treatment-date note, the "✓ Logged" stamp and the override explanation — and no
uncounted-dose notice.

Placement is a caregiver-facing choice in the medication editor: `PLACEMENT_OPTIONS` at 7624 offers
Own card / Morning group / Afternoon group / Evening group, written to `groupedMorning` /
`groupedAfternoon` / `groupedEvening` (7047-7049). Three of those four routes bypass the fix.

### Measured, on the shipping build

Seeded exactly as an app-v80 device stores a Percocet card — `version: 2`, no `doseSchemaV`, one
dose `{ label: '5/325 mg', mg: 325, pills: 5 }`, `ceiling: true, ceilingMax: 4, ceilingUnit: 'pills'`
— with `quickLog: false, groupedEvening: true`. Clock frozen at 10:00 so the day cannot roll.

    disk after migration   [{"label":"5/325 mg","mg":325}]     <-- pills: 5 deleted, as designed
    notices on the page    []                                  <-- [data-uncounted] absent entirely
    tap 1 -> entries=1   EVENING MEDS  Perco  ✓ Logged 10:00 AM  [Log]
    tap 2 -> entries=2   EVENING MEDS  Perco  ✓ Logged 10:00 AM  [Log]
    tap 3 -> entries=3   EVENING MEDS  Perco  ✓ Logged 10:00 AM  [Log]
    tap 4 -> entries=4   EVENING MEDS  Perco  ✓ Logged 10:00 AM  [Log]
    tap 5 -> entries=5   EVENING MEDS  Perco  ✓ Logged 10:00 AM  [Log]
    tap 6 -> entries=6   EVENING MEDS  Perco  ✓ Logged 10:00 AM  [Log]
    notices after taps     []

The control — same medication, same group, dose written `1 tablet`:

    tap 1..3 -> entries=1..3   [Log]
    tap 4    -> entries=4      EVENING MEDS  Perco  ✓ Logged 10:00 AM  [Limit reached]
    tap 5    -> no Log button; the only control on the row is "Limit reached"

Same ceiling, same card, same taps. One enforces; one does not, and says nothing.

### The falsification — the detector can go red, and does

The probe looks for `[data-uncounted]` across the whole document, so a notice rendered anywhere on
Home would be found. Same seeded medication, only the placement changed:

    own card           detector -> ["card"]
    evening group      detector -> []
    morning group      detector -> []
    afternoon group    detector -> []

The difference is the placement and nothing else.

### Severity

This is round 5's BLOCK 1 at the same severity for the affected placements, and the grouped cards are
not an edge: they are the **batches** — the morning round and the evening round — which is where a
combination tablet on a daily ceiling is most likely to sit and where "Take all" logs several
medications at once with no per-dose screen at all. Nothing about the defect is milder here; only
the disclosure is missing.

### The fix *(S)*

`uncountableDoseNotice` is already a pure function of the medication. Render it from the grouped row
as well — one call inside the row's left-hand column at 4356, beside the existing treatment-date note
and the "✓ Logged" line, using the same `[data-uncounted]` hook with a value of `'group'` so a check
can tell the two surfaces apart. Do not duplicate the markup: lift the amber block into one
`uncountedNoticeEl(med, where)` helper and call it from both, or the next renderer added will make
the same mistake a third time.

**And the check has to be written for the CLASS, not the instance (Rule 5.5).** The suite case that
proves it must loop every placement — `quickLog`, `groupedMorning`, `groupedAfternoon`,
`groupedEvening` — and fail if any Home surface that offers a log control for a medication with an
uncountable dose under an armed unit limit renders no notice. A case that only adds "evening" fixes
the instance I happened to test.

### Name the seat

**The builder's write model, third round running, and this time the Enhancer too.**

- *Write model (Rule 1.5)* — it is required to enumerate what a release touches. A fix whose entire
  purpose is "the caregiver is told on the screen where she gives the dose" has to enumerate the
  screens where a dose is given. There are two on Home and the release covered one.
- *Enhancer (Rule 2.6), checklist item 5* — *"Where a sibling screen already got it right, why didn't
  this one?"* This is that finding exactly, and the file's own history says so: the comment at 4249
  records the group card being left out of the flash-highlight feature for precisely the same reason
  and calls it *"that is precisely the failure this release's own notes claim to have fixed, left in
  place for the grouped half."* The same sentence is now true again, in the same function, about a
  safety limit.
- *Zero Day Auditor, round 5 (me, the seat)* — my own fix note said "route it to the medication card
  and the Meds row" and named one surface. The brief for this round asked whether the grouped card
  was a fourth door. It was.

---

## BLOCK 2 — the app names a remedy it will not accept, and the sentence is false where a caregiver lands first *(MEDIUM-HIGH — the Voice)*

The editor's new line ends:

> *"The app cannot tell how many that is, so it will not add it up. **Write the amount as a plain
> number if it should count.**"*

The obvious execution is to put the count in front of the strength and keep the strength. Measured
through the shipping parser (`window.__doseTest.parseDoseOptions`):

| typed | mg | pills | counts? |
|---|---|---|---|
| `5/325 mg` | 325 | — | no |
| `1 tablet (5/325 mg)` | 325 | — | **no** |
| `1 tablet 5/325 mg` | 325 | — | **no** |
| `2 tablets (5/325 mg)` | 325 | — | **no** |
| `1 tablet of 5/325 mg strength` | 325 | — | **no** |
| `1 x 5/325 mg` | 325 | — | **no** |
| `1 tablet` | 0 | 1 | yes — strength lost |
| `1 tablet — 5-325 mg` | 325 | 1 | yes — hyphen instead of slash |
| `1 tablet (5 325 mg)` | 325 | 1 | yes — space instead of slash |

`UNEVALUATED_RATIO` matches a digit-slash-digit **anywhere in the string**, so every attempt that
keeps the strength in its conventional notation is refused a count, including the four most natural
ones. The only ways through are to delete the strength or to mis-write it with a hyphen or a space —
which the app never says, and which nobody would guess.

**Worse, the card sentence is then false.** With `1 tablet (5/325 mg)` stored, the Home card reads,
measured:

    ! This amount is not counted toward the daily limit of 4 pills — the app cannot tell how many
      that is: 1 tablet (5/325 mg). Nothing on this card is being counted against that limit.

*"the app cannot tell how many that is"* about an amount that begins with the words **1 tablet**. The
app can tell; it declined to, because of a slash later in the string. Rule 2.7 question 1: not
roughly right — true. This is not true, and it appears at the end of the one path the app itself sent
the caregiver down.

### The fix *(S–M, and it is copy plus one parser decision)*

Two options, and the second is better:

1. **Copy only (S).** Change both strings so they stop promising something the parser refuses:
   *"The app will not count this amount. To have it counted, add a separate option with just the
   number of tablets — for example `1 tablet`."* And change *"the app cannot tell how many that is"*
   to *"the app will not count this amount"*, which is true in every case it fires.
2. **Copy plus the parser (M).** `UNEVALUATED_RATIO` is deliberately conservative and should stay so
   for a bare `5/325 mg`. But a string that opens with an explicit count and a unit word —
   `1 tablet (5/325 mg)` — has already told the app how many. Counting the leading `1 tablet` and
   leaving the ratio uninterpreted is not inventing a number; it is reading the one that is written.
   That makes the remedy the app names actually work. It needs its own suite row and its own mutant,
   and it must not reopen round 4 (`5/325 mg` alone must still count nothing).

Do **not** ship option 2 without 1: the sentence is wrong today either way.

---

## 3 — the notice's truth conditions, attacked *(no block; one cosmetic)*

Every shape the brief named, seeded onto a real device and read off the rendered card:

| medication | notice | verdict |
|---|---|---|
| `ceiling:true, ceilingMax:0` | none | **right** — `dailyCeiling` is null, no limit is in force, nothing to warn about |
| `ceilingMax` absent | none | right, same reason |
| `ceilingMax: NaN` | none | right, same reason |
| `ceilingUnit:'applications'` | *"…daily limit of 4 applications…"* | right, and it reads correctly |
| dose with `pills: 0` explicit | names it | right — `Number(0) > 0` is false |
| dose with `pills: "5"` (string) | names it | right, and unreachable anyway: the migration re-parses on load and the string never survives to render |
| `volumeCeilingMl` only, no `ceiling` | none | right — `volumePerDoseMl`/`volumeMl` is a separate path and no user-settable field writes either |
| `rollingCeilingH: 24` **with** `ceilingUnit` | *"the daily limit of 4 pills"* | **true as written** — `dailyCeiling`'s `ceilingUnit` branch ignores `rollingCeilingH` entirely and counts `dailyPills`, so the enforcement really is per-calendar-day and the word "daily" is accurate. The rolling window silently not applying to a unit limit is pre-existing and outside this diff; flagging it as a **backlog item**, not a finding here |
| `doses: []` | *"…has no amounts set. Add them in Edit…"* | right |
| `doses` a string, not an array | *"…has no amounts set…"* | right by luck rather than by design — `!Array.isArray` catches it — and it does not throw |
| ordinary `1 tablet` + 4-tablet limit | none | right |
| mg limit on the same medication | none | right |
| no limit at all | none | right |

**One cosmetic (LOW).** A dose whose `label` is an object renders
*"…the app cannot tell how many that is: **[object Object]**…"* — inside a safety notice. Nothing the
app's own writers produce can do this (`parseDoseOptions` always writes a string); a hand-edited or
corrupt backup restored through `cwBkApplyTo` could. `uncountableDoses` already calls `String(...)`;
it should drop a label that does not stringify to something readable, or fall back to the dose index.

**The "Up next" hero card is not a door.** Its only control is `scrollToMedCard` (5587) — it
navigates, it does not log. Correct to leave alone.

**The Meds screen is not a door either.** `renderMedicationManager`'s rows carry Edit/Pause/Remove
and placement badges, no Log control.

**The homeCard daily-total card (5606-5640) is a display, not a door, but it is a false
reassurance.** For a `kind:'pills'` card it prints `dailyPills(id)` against the limit — the total that
can never move on an uncountable dose — as a bar reading "0 of 4 tablets" forever. It is not a
logging surface so it is not part of BLOCK 1, and `homeCard` is not settable from the editor today,
so I am not blocking on it. **It should get the same notice when the fix is generalised**, and the
helper suggested above makes that one line.

---

## 4 — the `h()` null-attribute trap *(clean)*

`h()` (3790-3816) ends in a bare `el.setAttribute(k, v)`, so a `null` value writes the literal string
`"null"`. All three new hooks pass literals, never a conditional:

    'data-uncounted': 'card'        (6057)
    'data-uncounted': 'editor'      (7474)
    'data-dose-rewritten': '1'      (6820)

Neither IIFE returns an element with a conditional attribute. **No instance of the trap in this
diff.** Checked rather than assumed.

---

## 5 — render safety of the two new IIFEs *(clean)*

Both notices are IIFEs inside a render list, so a throw in either kills the whole Home screen. I
seeded thirteen hostile medications (the table in section 3, plus `doses` containing `null`, a
non-array `doses`, an object `label`, and `ceilingMax: NaN`) and read `pageerror` after each render.

    page errors across all thirteen: none
    the page rendered every time (body text 407–600 chars, never the empty fallback)

`uncountableDoses` guards `!med`, a non-array `doses` and a null element before touching a dose, and
`String(d.label == null ? '' : d.label)` cannot throw. `dailyCeiling` is pure arithmetic over
`entriesFor`. `uncountedDosageOptions` guards `!form` and runs `parseDoseOptions`, which the round-5
audit already proved cannot throw on the strings in this table.

---

## 6 — every claim in the commit, the comments and the README row

**Verified true:** `test/v81-dose-parser.mjs` **132/132**, re-run here against a clean tree (~70 s).
**33 mutants across four rounds** — `outputs/FALSIFY-app-v81-round7.txt` adds M26–M33 to the 25 the
round-5 audit counted, and all eight name a check that went RED and was restored. **429/429 across
twelve suites** — `outputs/SUITES-app-v81.txt` sums to exactly 429 over exactly 12 suite headings;
I re-ran two of the twelve (dose-parser 132/132, v75-no-other-patient 27/27) and did not re-run the
other ten, which is stated rather than asserted. `APP_VERSION` `app-v81`, `sw.js` CACHE
`chemowell-app-v81-2`.

**"A medication whose amounts the app can read says nothing, which is nearly all of them."** True —
measured null on an ordinary tablet with a tablet limit, on an mg limit, and on a medication with no
limit, and the mutant M28 that makes it fire everywhere dies.

**FALSE — and this is the sixth comment in this release to describe a property the code does not
have.** The README row and the commit message both say the app *"says on the card, next to the
button that gives the dose, exactly which amount is not being counted"*. It says so on one of four
placements. The row must not ship in this wording whatever happens to BLOCK 1: either the fix covers
the grouped cards and the sentence becomes true, or the row names the exemption in plain words
(Rule 5.5 — an exemption nobody wrote down is indistinguishable from an oversight).

The new function comments at 1832-1846 and 6052-6055 are accurate about what the code does; 6054
*"Renders for no medication whose amounts the app can read"* is true, and the comment's silence about
which renderer it lives in is what made the gap easy to miss.

---

## 7 — the suite, assumed to be lying *(one MEDIUM — it is green with the block live)*

**132/132 green, and it cannot see BLOCK 1.** Every seed in section 3f sets `quickLog: true` and not
one sets a grouped placement:

    $ grep -c "quickLog: true" section 3f seeds -> every combo() and every literal
    $ grep -c "grouped" test/v81-dose-parser.mjs -> 0

So the suite proves the notice on the one surface that has it and is structurally blind to the three
that do not. That is the same shape as the hole round 5 named — *"every limit check here used a
medication the suite created through the editor"* — one level over: every notice check here uses a
medication the suite gave its own card.

On the specific questions asked:

* **3f's `seedAndOpenHome` does not leak state into later sections.** It rewrites the whole med config
  and clears entries on every call, then reloads. Section 4 uses `parse()` through the hook and does
  not read the screen at all, so nothing it asserts can be satisfied by leftover DOM.
* **The upgrade case proves what it claims.** `logged === 4` is not obtainable by a gap timer
  (`gapH: 0`) or by a window (no `windows` on the seed), and the clock is frozen at 10:00 so the day
  cannot roll under it. I re-ran it and the loop reports `["no button at 6"]` with `logged 4` — the
  card locked, exactly as the second assertion reads it off the screen (`Limit`, `tomorrow`). Sound.
* **`noticeText()` reads the right element now.** `document.querySelector('[data-uncounted="card"]')`,
  not a text search. The commit's account of why the old version failed — `find` returning the
  outermost match — is correct.
* **The negatives can fail.** M28 (fire everywhere) and M29 (fire with no limit) both turn the
  "says nothing" rows red in `FALSIFY-app-v81-round7.txt`. Not vacuous.

**The missing case is the class.** See BLOCK 1's fix.

---

## 8 — `release_check.sh` *(correct, and that is all it says)*

    $ bash release_check.sh ; echo $?
    ℹ️  Baseline: PUBLISHED.json -> app-v80 (chemowell-app-v80-2) at 048c1ff
       7 commit(s) have changed index.html since that record.
    ❌ RELEASE CHECK FAILED: the quality chain has not run for app-v81.
       Changed under rule 5: index.html sw.js
       missing: an outputs/PM*app-v81*.md sign-off
       AND a report on record REFUSES this release: AUDIT-app-v81.md, -round2, -round3, -round4, -round5
    1

Exactly the missing PM sign-off and the five standing refusals, nothing spurious, and the baseline
notice is accurate. This report makes six.

---

## 9 — Rule 0, product neutrality *(clean, spot-checked not repeated)*

`test/v75-no-other-patient.mjs` **27/27**, all three ratchets at 0/0/0. Nothing in this diff adds a
name, a gendered pronoun, a care-plan dose or a branch keyed to a medication id. `Perco`,
`5/325 mg` and `oxycodone/paracetamol` appear only as generic examples of a written form.

---

## 10 — round-5 items that were NOT carried out *(advisory, carried forward)*

Checked against the current file rather than assumed from the commit message:

* **`cwBkApplyTo` is still unmigrated (549).** `saveJSON(K('med-v1'), { version: 1, meds: incomingMeds, … })`
  writes restored medications straight to disk with no `.map(migrateDoseLabels)`, still correct only
  because a `location.reload()` two functions away happens to run afterwards. Round 5's finding 2 is
  open. One line.
* **The `{threw}` wrapper is still not applied in sections 3b and 4** (lines 271, 293, 295 index
  `parse()` directly). Round 5's finding 4 is open. One line each.
* **The module-binding-order guard is not in `harness/`** (round 5's finding 7, recommended not
  required). `harness/` still holds one unrelated file.

None of these is a block. All three should ride with the fix.

---

## What it would take to turn this into SHIP

1. **BLOCK 1** — render the notice from `renderGroupedMedsCard` too, through one shared helper, and
   add the suite case for the CLASS: every placement the editor offers, failing if any Home surface
   with a log control is silent. It must go red on this commit.
2. **BLOCK 2** — fix both strings so they are true and so the remedy they name is one the parser will
   accept; optionally let a leading explicit count be read through a later ratio, with its own row
   and its own mutant.
3. **Finding 6** — the README row and the release message stop claiming a coverage the code does not
   have.
4. **Finding 3** — drop an unstringifiable dose label rather than printing `[object Object]` in a
   safety notice.
5. **Finding 10** — the three round-5 items still open.
6. **Backlog, not this release** — `rollingCeilingH` is ignored whenever `ceilingUnit` is set, so a
   rolling unit limit is silently enforced as a calendar-day limit.

1 and 2 are the release. 3-5 should ride with it.

Chromium only; an iPhone's rendering cannot be reproduced in this sandbox and stays exempt.
