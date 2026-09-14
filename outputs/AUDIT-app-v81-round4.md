AUDITED-COMMIT: df600c9
VERDICT: DO NOT SHIP

# Zero Day Audit — app-v81, round 4 (delta: `df600c9` over `c391bc9`)

## The headline, in plain words

**The release says it fixes every medication already saved on the phone. There is a second door into
the medication list — "Bring back", the control that restores a medication the caregiver removed —
and it walks straight past the migration. Measured on this build: a medication archived under
app-v80 comes back with its old `.5 mg / 5 mg` dose, is written to disk that way, and Home
immediately reads `.5 mg · over limit` before a single dose has been logged. That is the exact
screen the round-3 audit refused this release for, reproduced on the build that claims to have
fixed it.**

It heals on the next full app load, and that is the whole of the mitigation. Until the caregiver
closes and reopens the app she is looking at a card locked out of a dose she is entitled to give,
and the only way past it is the Override button — which records the dose. The configuration on disk
is wrong in the meantime, so a backup taken in that window carries the wrong numbers into the
future.

**A second string still parses wrongly, and this release's new suite certifies the wrong answer as
correct.** `5/325 mg` — oxycodone/paracetamol, the string round 3 blocked on — now keeps its label
and counts 325 mg, which is right. It also counts **five pills**. Measured on the real screen: a
medication whose only dose is `5/325 mg`, limit unit *Number of pills / doses*, daily limit 4
tablets, reads **"5/325 mg · over limit" with nothing logged.** One tablet is five.

Four smaller findings follow, including two comments that state a property the code does not have —
the class this release opened by refusing five times.

**What is genuinely fixed, verified rather than accepted:** the proper-fraction guard holds against
every combination strength and rate I could find; the migration loses no dose option under any
malformed input I could construct; logged history really is untouched; `release_check.sh`'s
empty-file gate now fires in both directions; and the round-2 keystroke regression has **not** come
back.

---

## BLOCK 1 — "Bring back" restores a medication the migration never sees *(HIGH)*

Brief item 2 asked whether archived medications are migrated, and whether they should be. They are
not, and the consequence is not theoretical — it is reachable with two taps.

`migrateDoseLabels` is called in exactly one place: the `.map()` chain inside
`loadMedicationConfig` (`index.html` 1551). `restoreMedicationConfig` (`index.html` 7041) rebuilds
the medication from `entry.config` through `normalizeMedication` alone and calls
`persistMedicationConfig` directly (`index.html` 7097). `normalizeMedication` preserves
`doseSchemaV` only when it is already `> 0`; an archive written by app-v80 has no stamp, so the
restored medication has no stamp and no migration.

Measured in a real Chromium page against the shipping `index.html` at `df600c9`, seeding one
archived medication in exactly the shape app-v73+ writes on delete:

    archive on disk           { label: ".5 mg", mg: 5, pills: 5 }   (ceiling 2 mg)
    a full app load           archive untouched — correct, it is not on the list yet
    tap "Bring back"
    tap "Yes, bring it back"
    PERSISTED TO DISK         { label: ".5 mg", mg: 5, pills: 5 }   doseSchemaV: absent
    HOME, NO DOSE LOGGED      "1 mg"   ".5 mg · over limit"
    after one page reload     { label: "0.5 mg", mg: 0.5, pills: 0.5 }   doseSchemaV: 1

Compare the round-3 report's BLOCK 2 evidence line. It is the same button, on the build that exists
to remove it.

**Why this is not a small window.** The restore toast tells the caregiver the medication "is back,
with its doses and rules" — so the app has just asserted the doses are right. Anything she does in
that session is done against a 10× wrong milligram figure: the card locks her out, and if she
overrides, the entry that is written records what the app believed, which the release is explicit
it will never rewrite afterwards. A backup taken before the next launch carries the wrong config.

**The fix (S).** `restoreMedicationConfig` already runs `normalizeMedication`; run `migrateDoseLabels`
on the same line — `med = migrateDoseLabels(normalizeMedication(...))`. Then falsify it: remove the
call, re-seed an app-v80 archive, and watch the restored dose come back as `.5 mg / 5`.

**And widen the check, not just the fix (Rule 5.5).** The defect is not "restore was missed", it is
"there is more than one door into `state.meds` and only one of them migrates". The suite needs a
case for the CLASS: every path that writes a medication into the list produces a stamped,
migrated medication. `restoreMedicationConfig` is the one I found; the next one added will be
missed the same way.

**Name the seat.** This is not the Enhancer's or the Designer's. It is the builder's write model —
Rule 1.5 requires it to be stated before coding, and "what this release appends" was stated for the
load path only. The one control in this app that puts a stored medication back on the list is the
one the write model did not name.

---

## BLOCK 2 — one combination tablet counts as five, and the new suite pins it *(HIGH)*

Brief item 1: find a real-world dose string that still parses wrongly. This is it, and it is the
same string round 3 blocked on.

Through the shipping parser (`window.__doseTest`, and reproduced against the functions lifted
verbatim out of `index.html`):

    "5/325 mg"    ->  label "5/325 mg"   mg 325    pills 5
    "10/325 mg"   ->  label "10/325 mg"  mg 325    pills 10
    "300/30/10"   ->  label "300/30/10"  mg 0      pills 300
    "875/125 mg"  ->  label kept         mg 125    pills 875

On the real screen, medication added through the Add-medication form, nothing seeded:

    Dosage options   5/325 mg
    Limit unit       Number of pills / doses
    Daily limit      4
    HOME, BEFORE ANY DOSE:   "5/325 mg · over limit"

The mg half of this string is now handled correctly and that is the release's achievement. The
pills half is still `numMatch` taking the leading number, so a single Percocet weighs five tablets
and a four-tablet-a-day ceiling is blown before breakfast.

**This is pre-existing behaviour — and that is not a defence here, for two reasons.**

1. `test/v81-dose-parser.mjs` now asserts it: `{ in: '5/325 mg', out: [{ label: '5/325 mg', mg: 325,
   pills: 5 }], why: 'BLOCK 1: a combination strength read as a fraction' }`. A row added to close an
   audit finding has pinned a wrong number as the correct answer. The next person to touch this
   parser will read that row as a decision.
2. The commit message says these strings are "left exactly as typed, which is ... the only honest
   answer to a string whose meaning it cannot know." `pills: 5` is not leaving it alone. It is a
   guess, in the same place, of the same kind, and it locks a card.

**The fix, and it is small (S).** When a label contains an un-evaluated slash between two numbers,
the app does not know what the leading number counts — so it should set no `pills` at all, exactly
as it does for `as directed`. That leaves the mg limit working, leaves the label alone, and stops
the app inventing a tablet count it cannot derive. Whatever is chosen, **the suite row has to stop
asserting 5** and the behaviour has to be written into the release note as an exemption if it is
kept.

---

## 3 — a tenth of a tablet counts as a whole one, an eighth does not, and nothing says so *(MEDIUM)*

`DOSE_FRACTION_DENOMS = [2, 3, 4, 5, 6, 8]`. Measured on the shipping build:

    "1/8 tablet"   ->  pills 0.125
    "1/6 tab"      ->  pills 0.1666…
    "1/10 tablet"  ->  pills 1        <-- ten times the medicine
    "1/12 tab"     ->  pills 1
    "1/16 tablet"  ->  pills 1

Round 3's stated reason for blocking the first fix was not only the wrong number — it was that
*"two strengths of the same product behave differently, which is how a caregiver learns not to trust
what the box does."* The denominator whitelist recreates exactly that shape one notch down:
`1/8` and `1/10` are the same kind of thing written the same way and differ by a factor of ten, and
the app shows nothing to distinguish them.

I am not asking for `1/10` to be added to the list — the whitelist is a sound trade and I could not
find a real combination product it lets through (see section 4). **What is missing is the sentence.**
Rule 5.5: an exemption nobody wrote down is indistinguishable from an oversight. Nothing in the
commit, the code comments, the suite or `RESEARCH-dose-units.md` says which denominators evaluate
and what happens to the rest. Add the list and its consequence to the comment above
`DOSE_FRACTION_DENOMS`, and put one of the rejected denominators in the suite table with its
measured `pills` value so the behaviour cannot drift without a row going red.

---

## 4 — the guard itself: I tried to break it and could not *(no finding — recorded so nobody re-tests it)*

Every shape the brief named, plus a sweep of real combination products, measured through the
shipping parser rather than reasoned about:

| typed | result | verdict |
|---|---|---|
| `5/325`, `10/325`, `7.5/325`, `37.5/325`, `80/12.5`, `875/125`, `500/125`, `200/50`, `300/30/10` | label kept, no division | safe |
| `5 mg/mL`, `100 mg/m2` | untouched | safe |
| `1:1000`, `1:1000 mg` | untouched | safe |
| `1-2 tablets`, `1–2 tablets`, `2 x 500 mg` | untouched, leading number counted | unchanged from before |
| `1/2-1 tablet`, `1/4 to 1/2 tablet` | first fraction counted, label kept | reasonable |
| `1⁄2` (U+2044), `1／2` (fullwidth) | not recognised — counts **1** | see below |
| `1 / 2` with wide spaces, NBSP | counted 0.5 | safe (JS `\s` covers NBSP) |
| `½/2` | counts 0.5, should be 0.25 | not reachable by typing on any keyboard I can find |
| `1/0 tablet` | left alone, no `Infinity` | safe, asserted |
| `q6h` | counts 6 | pre-existing; nobody types a frequency in a dose box |

The two unicode slashes count a half as a whole — the old bug, in the safe direction, reachable only
by pasting from a word processor. Worth one line in the same exemption sentence finding 3 asks for;
not worth code.

The one arithmetic hole I found in the guard is `6/8 mg` → `0.75 mg`, i.e. a proper fraction over a
listed denominator that is written as a strength. I could not name a real product of that shape, so
I am recording it rather than blocking on it.

---

## 5 — the disclosure notice cannot fire for a fraction, and the commit says otherwise *(MEDIUM)*

The commit: *"The editor now shows 'Will be saved as: ...' the moment the result differs from what
was typed."*

`dosesRewrittenNotice` compares `parsed.map(d => d.label).join(', ')` against
`splitDoseOptions(raw).join(', ')` — **labels only.** Since this release the label of a fraction is
left verbatim, so for every fraction the two sides are equal by construction and the notice can
never appear. Measured:

    ".5 mg"        ->  "Will be saved as: 0.5 mg …"
    "1.0 mg"       ->  "Will be saved as: 1 mg …"
    "1/2 tablet"   ->  (silent)   count 0.5 — right, but changed
    "1/10 tablet"  ->  (silent)   count 1   — WRONG, and changed tenfold
    "5/325 mg"     ->  (silent)   count 5 pills — see BLOCK 2

So the one case where the counted number differs most from what the caregiver wrote is the one case
the disclosure never covers. The notice is a good idea and it is built well; the claim made for it
is wider than what it does. Either compare the counted amount as well as the label, or narrow the
sentence in the release note to "when the app rewrites the text you typed".

**The rest of the notice holds up, measured.** It renders on both positives and stays silent on all
six negatives; it is unclipped with the page not scrolling sideways at 320px; it uses no null
attribute and does not go through `h()`'s trap. **And the round-2 block has not come back** —
typing `.5 mg, 1.0 mg, 2.50 mg` one character at a time at 160 ms across the 450 ms debounce, with
the notice appearing mid-word:

    typed    ".5 mg, 1.0 mg, 2.50 mg"
    in box   ".5 mg, 1.0 mg, 2.50 mg"    focus still on #med-doses-text, caret at the end

Nothing dropped, focus never left the box.

---

## 6 — the Voice: a sentence that promises more than the app can deliver *(MEDIUM)*

The new caregiver-facing string, in full:

> **Will be saved as:** 0.5 mg
> Amounts are written the way a pharmacy writes them, so they cannot be misread. Change the box
> above if this is not what you meant.

**"Will be saved as: 0.5 mg" is excellent** — short, concrete, true, and it does the one job a
disclosure has to do. "Change the box above if this is not what you meant" names the right control
and the box really is directly above it. Both stay.

**"so they cannot be misread" has to go.** It is an absolute safety claim about a person's reading,
made by an app, on a screen that has just demonstrated it can get a number wrong. Rule 2.7's
standing rule is never to promise a fix that has not been confirmed, and this promises one that
cannot be confirmed at all. It is also not quite true of the thing it is attached to: `1.0 mg` →
`1 mg` is a *less* explicit string than the one typed, and a tired reader at 2am is not helped by
being told it now cannot be misread.

Replace with something that says what happened and stops: *"A leading zero is added and a trailing
zero removed, because `.5` and `1.0` are the two amounts most often read wrong."* That is true,
checkable, and it explains the change instead of guaranteeing an outcome.

---

## 7 — two comments state a property the code does not have *(MEDIUM — brief item 7)*

Brief item 7 makes this a block class on this project, and the round-3 report caught one of the same
shape.

**(a) `parseDoseOptions`, above `countable`:**

> *COUNTED FROM THE UNROUNDED FORM, SHOWN FROM THE ROUNDED ONE.*

**Nothing is rounded any more.** The same commit deleted `round3` — its own message says so
("`round3` no longer rounds. Renamed") — and the label now keeps the fraction exactly as typed. The
sentence describes the behaviour of the build the round-3 audit refused. The split is
evaluated-vs-verbatim, not unrounded-vs-rounded.

**(b) `normalizeMedication`, the `doseSchemaV` whitelist line.** The comment says:

> *removing this line leaves every measurable behaviour identical, which a mutant proved rather than
> a reading of it*

and then, four lines later:

> *without this line the stamp is silently eaten, the migration re-walks every medication on every
> load forever*

Both cannot be true of today's code. A mutant leaving `test/v81-dose-parser.mjs` green proves the
**suite** cannot see the change; it does not prove every measurable behaviour is identical, and the
paragraph itself names the behaviour that differs. I verified the mutant survives (M15 in
`FALSIFY-app-v81-round5.txt`, reproduced here). The honest sentence is: *nothing the suite can see
changes, because the migration is idempotent and the only observable difference is work done on
every load that nothing measures.*

Both are one-line edits. Neither is load-bearing on its own — together they are the third and fourth
comment on this release to describe a property the code does not have, which is the reason item 7 is
in the brief.

---

## 8 — the suite, assumed to be lying *(MEDIUM-LOW)*

**94/94 green, re-run here against a clean tree (33 s).** The eleven mutants in
`/tmp/.../falsify5.py` reproduce as logged: ten die, M15 survives. Three things it still does not do:

- **`3c`'s sentinel check is named for something it cannot measure.**
  `'a config that needs nothing is not rewritten — the migration really is one-shot'`. The sentinel
  proves no **write** happened. It does not prove the migration did not **run** — M15 is the proof:
  with the stamp dropped, `migrateDoseLabels` re-walks every medication on every load and this check
  stays green. The comment above it is honest about this; the check's name, which is what anyone
  reads off the board, is not. Rename it to what it measures: *an already-correct config is not
  written back.*
- **`3c` seeds only through `localStorage` + reload.** That is why BLOCK 1 is invisible to it —
  every path it exercises goes through `loadMedicationConfig`, which is the one path that migrates.
  A migration suite that only ever enters by the migrating door will pass on any number of doors
  that do not.
- **`3d`'s negatives can pass on an absent element**, and the `notice()` helper returns `null` both
  when the notice is absent and when the selector fails. M19 shows they bite today (removing the
  negative case turns all five red), so this is a latent shape rather than a live defect — but the
  helper cannot distinguish "no notice" from "no editor", and a future change that closes the editor
  early would turn five assertions into five free passes. Assert the doses box is on screen inside
  the helper before reading.

What I checked and found sound: the dead `junk &&` term is gone; section 3b's arithmetic
(`third.pills * 3 === 1`) is exact and would go red on any re-rounding, and M12 proves it; the
320px check reads `documentElement.scrollWidth` and not just the element box.

---

## 9 — what I could NOT break in the migration *(recorded, so it is not re-audited)*

Every malformed input the brief named, run against `migrateDoseLabels` lifted verbatim from the
shipping file. **No input made it lose a dose option a caregiver can see today:**

| stored shape | result |
|---|---|
| `doses: [null, {...}]` | null kept in place, the real dose migrated |
| `label` a number / an object | `String()`'d, same as `normalizeMedication` already does |
| `pills` but no `mg` | kept, `mg: 0` added |
| label that splits in two (`1,5 mL`) | `again.length !== 1` → left exactly as stored |
| label `''` | left alone (and dropped later by `normalizeMedication`, as before) |
| `doses` not an array | returned with the stamp, untouched |
| already stamped | returned unchanged, no re-parse |
| the `5` + `000 units` pair an old splitter produced | both kept, one in one out, as the comment claims |

The early return on `again.length !== 1` is the right call and the comment explaining it is accurate.
Stamping a medication that was left unmigrated is also right — re-walking it on every load would
never produce a different answer.

One shape worth a note rather than a finding: `{ label: '1 patch', mg: 12.5 }` comes out with
`mg: 0`. The migration overwrites `mg` unconditionally rather than only when the label changed. No
path in this app produces such a dose today (the editor always derives `mg` from the label), but a
backup from another build could, and the rule "only the three fields the parser owns move" is
weaker than it reads: the parser owns them whether or not it has anything to say about them.

**Logged history really is untouched (brief item 3), verified.** `parseDoseOptions` has exactly four
call sites: three in the medication editor and the migration. `cwBkCollect` reads entries straight
out of storage and `cwBkBuildPayload` copies them through; the restore path writes them back
unparsed; the export builds rows from raw entries. Nothing re-parses a stored entry label. The
suite's own history assertion holds and M17 dies against it.

---

## 10 — `release_check.sh` *(FIXED — falsified in both directions)*

The round-3 finding is genuinely closed. The block's exact lines, run in isolation under
`set -euo pipefail`:

    A) empty file            GATE FIRED    FAIL=1    script reached its end
    B) three real lines      silent        FAIL=0    script reached its end
    C) four blank lines      GATE FIRED    FAIL=1
    D) two real lines        GATE FIRED    FAIL=1
    E) a good file then an empty one   GATE FIRED on the empty one only
    F) a file that is not there        GATE FIRED

No bash error text, and the `set -e` worry does not bite: `[ -z "$_lines" ] && _lines=0` failing as
an AND-list does not abort the script (measured in B, which reaches the end with FAIL=0).

Whole-script run on this tree exits **1**, correctly, at the quality-chain stage — it names the three
standing DO-NOT-SHIP reports and the missing PM sign-off. The Enhancer and Designer reports for
app-v81 exist at 9,020 and 3,948 bytes, so the empty-file gate is reached and passes honestly.

---

## 11 — Rule 0, product neutrality

`test/v75-no-other-patient.mjs` is **27/27**, all four ratchets at 0/0/0. Nothing in this diff adds a
patient name, a gendered pronoun, a care-plan dose or ceiling, or a branch keyed to a medication id.
The `She` in `RESEARCH-dose-units.md` that round 3 raised as an advisory has been corrected in this
commit and the commit says so accurately.

---

## What it would take to turn this into SHIP

1. **BLOCK 1** — run `migrateDoseLabels` in `restoreMedicationConfig`, and add a suite case for the
   CLASS: every path that puts a medication into `state.meds` produces a migrated, stamped one.
   Falsify by removing the call and watching the restored dose come back as `.5 mg / 5`.
2. **BLOCK 2** — stop deriving `pills` from the leading number of a label that still contains an
   un-evaluated slash, and change the suite rows that currently assert `pills: 5` for `5/325 mg` and
   `pills: 300` for `300/30/10`. If the behaviour is kept instead, it goes in the release note as a
   named exemption.
3. **Finding 3** — write the denominator exemption down, with one rejected denominator in the suite
   table carrying its measured value.
4. **Finding 5** — narrow the notice claim in the release note, or widen the notice to compare the
   counted amount.
5. **Finding 6** — delete "so they cannot be misread".
6. **Finding 7** — correct the two comments.
7. **Finding 8** — rename the sentinel check; guard the `3d` helper against an absent editor.

1 and 2 are the release. 3–7 should ride with them.

Two claims in the commit message I did not verify and am not asserting either way, because they are
outside this diff's reach in the time available: "Full battery 391/391 green across twelve suites"
and "app-v81 + the three harness scripts rebuild index.html byte for byte."

Chromium only; an iPhone's rendering cannot be reproduced in this sandbox and stays exempt.
