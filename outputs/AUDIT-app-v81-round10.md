AUDITED-COMMIT: 3b46ec8
VERDICT: SHIP

# Zero Day Audit — app-v81, round 10 (delta: `3b46ec8` over `17391dd`)

## The headline, in plain words

**The positional rule holds, and it is the first version of this fix that I could not break on the
string the previous round was refused for. But it is not tight in the direction the last four
refusals have been about — it is tight in the *opposite* direction, and that is a new thing.
`5/325 mg 30 tablets`, `5/325 mg 8 tabs/24h` and `5/325 mg 12 tablets in 24 hours` — a quantity and
a maximum written with no qualifier word in front of the number — now count 30, 8 and 12. Measured
on the screen at 390×900 with a six-a-day limit and nothing logged: no ordinary Log button, the red
override only, and nothing disclosed. That is round 9's harm, and on those three strings app-v80
gives the caregiver one ordinary dose where this build gives none.**

**I am not blocking on it, and the reason is the second half of the brief.** On a representative set
of twenty-five written amounts this build is safer than app-v80 on twenty and worse on three, and
the three are worse by *one press* — because app-v80 counts 5 on those same strings and locks the
card immediately after. On the far likelier `5/325 mg 1 tablet` at the same limit, app-v80 permits
one ordinary dose and this build permits six. An eighth refusal would hold back a build that is
better for every caregiver on this list except in a case where both builds are wrong and the
difference is a single dose. The finding goes at the top of the next release instead, with the suite
rows and the mutant written out below.

Verified rather than read: **203/203** on `test/v81-dose-parser.mjs`, the twelve suite totals sum to
exactly **500**, **53** unique mutant ids across **eight** FALSIFY files, Rule 0 **27/27**, zero page
errors in every run. The `dispense 30 tablets` claim is true — I measured app-v80's own parser, not
the assertion. One false sentence survives in the README from round 9's recorded list.

---

# BLOCKS

**None.** The one candidate is set out in full as RECORDED 1 below. It is measurably worse than
app-v80 on three strings, which meets the brief's bar for a block on its face, and I am declining to
use it that way deliberately: the harm is one ordinary dose at pill limits of five or more, on a
string form no round of this audit has listed, in a build that removes a much larger version of the
same harm from every other combination strength. Blocking here would be the audit optimising for its
own consistency rather than for the caregiver.

---

# RECORDED — not blocking

## 1. A quantity or a maximum written with NO word in front of the number is counted *(HIGH — first item of the next release)*

The rule closes every shape where something stands between the strength and the number. It cannot
see the shapes where nothing does. Measured through `window.__doseTest.parseDoseOptions` on the
shipping build, with app-v80's own parser beside it:

| written amount | app-v80 | `3b46ec8` |
|---|---|---|
| `5/325 mg 30 tablets` | 5 | **30** |
| `5/325 mg 90 tabs` | 5 | **90** |
| `5/325 mg 60 tablets total` | 5 | **60** |
| `5/325 mg 30 caps` | 5 | **30** |
| `5/325 mg 8 tabs/24h` | 5 | **8** |
| `5/325 mg 12 tablets in 24 hours` | 5 | **12** |
| `5/325 mg 8 tablets per day` | 5 | **8** |
| `5/325 mg 6 tabs daily` | 5 | **6** |
| `5/325 mg 4 doses daily` | 5 | **4** |
| `5/325 mg 3 doses remaining` | 5 | **3** |

Round 9's block list was `max 8 tabs daily`, `up to 6 tabs per day`, `no more than 12 tablets in
24 hours`, `#30 tablets`, `dispense 30 tablets`. All five are closed. The same clinical content with
the qualifier dropped is not, and `MAX 8 TABS/24H` losing its "MAX" to a caregiver retyping it off a
label is not exotic.

**On the screen, 390×900, six-a-day pill limit, zero doses logged**, config seeded and re-read
through the app's own migration:

| dose | pills | ordinary Log button | over-limit override | notice |
|---|---|---|---|---|
| `5/325 mg 30 tablets` | 30 | **none** | 1 | **none** |
| `5/325 mg 8 tabs/24h` | 8 | **none** | 1 | **none** |
| `5/325 mg 12 tablets in 24 hours` | 12 | **none** | 1 | **none** |
| `5/325 mg q4-6h prn max 8 tabs daily` | — | 1 | 0 | fires, correctly |
| `5/325 mg 1 tablet` | 1 | 1 | 0 | none, correctly |

app-v80 on those same three strings, same limit: `pills: 5`, an ordinary Log button present, no
override. So the caregiver gets one ordinary dose on the live build and zero here. At a limit of
**four** — the ceiling the release's own suite uses — the two builds are identical, because 5 and 30
are both over it.

**The fix (S).** The gap is not another word and not another position. It is that
`firstCountableNumber` will count *any* number sitting against the strength, and a quantity
dispensed sits there just as comfortably as a dose. Two options, and I prefer the second: (a) refuse
a count that is larger than any plausible single administration — but that is a magic number; (b)
require the number against the strength to be the amount *and* refuse when a period word follows the
noun (`daily`, `per day`, `/day`, `/24h`, `in 24 hours`, `total`, `remaining`) — a suffix list, which
is the vocabulary shape this round correctly abandoned for the prefix. Honestly, (b) is the same
mistake pointing backwards, and the durable answer is probably that **a bare number past an
unreadable strength should count nothing unless it is bracketed or is 1 or 2** — the two amounts a
person actually gives at once. That is a design decision, not an audit finding, and it belongs to
the builder and Aaron rather than to me.

**The suite.** Four rows asserting no `pills`: `5/325 mg 30 tablets`, `5/325 mg 8 tabs/24h`,
`5/325 mg 12 tablets in 24 hours`, `5/325 mg 4 doses daily`. One end-to-end row seeding
`5/325 mg 30 tablets` at `ceilingMax: 6` and asserting an ordinary Log button exists at zero doses —
that single row is what this finding would have failed on. One mutant: *"a countable number sitting
against the strength is always the amount"*, which must go red on all four.

**Name the seat: the builder's falsification duty, for the third round running, in the same way.**
M50–M54 are all excellent and all die, and every one of them mutates the new rule *towards* the
behaviour of the previous two rounds — drop the positional test, loosen it, tighten it to nothing,
lose the `i` flag, break `ratioEnd`. Not one asks what the narrowed rule now *admits*. Round 8 named
this. Round 9 named it again in the same words. The answering round again extended the table along
the axis of the last block. **The habit to break is writing the mutants after the fix instead of
writing down, before the fix, the sentences the new rule makes newly true.**

## 2. The comma splits the string before the positional rule ever runs

`splitDoseOptions` splits on commas, so the ratio and the number can end up in different options and
the rule never engages. Measured, on a full sig line as a pharmacy prints it:

    "Norco 5/325, 1-2 tabs PO q6h PRN pain, max 8 tabs/24h"
      -> [ "Norco 5/325" (no count, disclosed),
           "1-2 tabs PO q6h PRN pain" (pills 1),
           "max 8 tabs/24h" (pills 8) ]

The third button is round 9's invented maximum, reached by putting a comma in front of it — the
leading-number rule from v45 applies because, in *that* option, no ratio precedes. app-v80 produces
the same `pills: 8` for that segment plus a bogus 5 for the first, so this is **not a regression and
not worse than live**; it is recorded because the commit message's central claim ("past a strength it
could not read, a number counts only when…") is true per option and not true per line, and the next
round should not rediscover it as new. The practical harm is small: the caregiver still has two
usable buttons on that card.

## 3. `oxycodone 5 mg 1 tablet` counts 5, on both builds

No ratio, so the new rule never engages and v45's leading number wins. One tablet counted as five
pills, undisclosed, on a limit of six: one ordinary dose then the override. Identical on app-v80,
so not a regression and not a block — recorded because it shows the class is closed only for
*combination* strengths. A single-ingredient strength written before the count is the same defect
and nothing in this release touches it.

## 4. The README still carries the sentence round 9 asked to have rewritten *(the Voice)*

The app-v81 row now contains the new positional paragraph **and**, further down, the old one intact:

> *"It now counts a number past an unreadable strength **only when the next word says what is being
> counted**… An interval, a quantity dispensed and a maximum are none of those, so they count
> nothing and the app says the limit is not being applied, which is true."*

Round 9 RECORDED item 3 asked for exactly this sentence to be rewritten *with* the fix. It was not:
a new paragraph was added above it and the false one left in place. Two things are wrong with it
now. The noun test is no longer sufficient, so "only when the next word says what is being counted"
describes a rule that no longer exists; and "a quantity dispensed and a maximum… count nothing" is
false as measured in RECORDED 1. It is developer-facing, which is the only reason this is recorded
rather than blocking — the same call round 9 made. *Fix (S): delete the superseded paragraph.*

## 5. Disclosure noise — measured, and my judgement is that it is not wallpaper yet

On ten realistic Percocet strings with a pill limit set, the notice fires on four:

| string | notice |
|---|---|
| `5/325 mg q4-6h prn max 8 tabs daily` | fires |
| `5/325 mg - 1 tablet` | fires |
| `5/325 mg: 2 tablets` | fires |
| `5/325mg tabs - 2 po q6h` | fires |
| `5/325 mg 1 tablet` · `5/325 (1 tab)` · `Percocet 5/325 1 tab q4h prn` · `5/325 mg 2 tabs q6h prn` · `oxycodone 5 mg 1 tablet` · `5/325 mg 30 tablets` | silent |

**Not wallpaper**, and three reasons. It renders once per medication card rather than once per dose
button; it requires a pill-unit daily limit to be set at all, which most medications will not have;
and re-measured this round, an mg limit on the same medication, a medication with no limit, and an
ordinary countable tablet all stay silent. **But the comma/colon/dash family is now the single
biggest producer of it**, and it is the one where the app plainly *can* see the count — a caregiver
who writes `5/325 mg - 1 tablet` is told the limit is not counting a dose whose count is printed in
the same string. Allowing one separator token in `ONLY_UNIT_AND_BRACKETS` would close most of it;
I am not recommending it this release, because widening that regex is exactly how the last four
refusals happened and it should be done deliberately with its own mutants, not as a tidy-up.

## 6. The probe list, for the record — what the comma/colon/dash forms do

`5/325 mg, take 1 tablet` → two options, `5/325 mg` (uncounted, disclosed) + `take 1 tablet` (1).
`5/325 mg, 2 tabs` → the same shape. `5/325 mg - 1 tablet`, `5/325 mg: 2 tablets`,
`5/325mg tabs - 2 po q6h` → one option, no count, disclosed. `TAKE 1 TABLET BY MOUTH` → 1 (no ratio).
`5/325 (1 tab)` → 1. `1 tablet 5/325 mg q6h` → 1. `5/325 mg 2 TABS` → 2 (the new `i` flag).
`Percocet 5/325 1 tab q4h prn` → 1. `oxycodone/APAP 5/325 2 tabs` → 2. `5/325 mg/mL 2 tablets` → 2.
`5/325 mg [2 tablets]` → 2. `5/325 mg qty 30 tablets`, `5/325 mg QTY: 30 tablets`,
`5/325 mg x 30 tablets`, `5/325 mg 4 times daily`, `5/325 mg half tablet` → no count, disclosed.
Nothing threw on any of them.

## 7. Round 9's recorded items 1 and 2 are closed; 4 and 5 stand

`COUNTABLE_NOUN` is case-insensitive and the duplicate `mL` is gone — `5/325 mg 1 Tablet` → 1,
pinned by a row and by M53. The false range justification is corrected and the range exception is
removed: `7.5/325 mg 1-2 tabs` now counts nothing, which matches a bare `1-2 tabs` counting 1 far
better than counting 2 did. Item 4 (`tsp`, `vial`, `pen`, `unit`, `sachet` losing their count past a
ratio) and item 5 (round 8's carried items) are unchanged and not re-opened.

---

# CLAIMS CHECKED

| claim | result |
|---|---|
| `test/v81-dose-parser.mjs` **203 checks** | **TRUE** — 203/203 passing, re-run |
| **53 mutants across eight rounds, all dead** | **TRUE** — 53 unique ids (M1–M54, M36 unused) across eight `FALSIFY-app-v81-*.txt`; round 11's five all recorded dead |
| **500/500 across twelve suites** | **TRUE** — 65+27+22+36+20+20+14+13+38+10+32+203 = 500, twelve files |
| **`dispense 30 tablets` unchanged from app-v80** | **TRUE, measured against app-v80's own parser** — `dispense 30 tablets 5/325 mg` → 30 on both. Not argued from the assertion: I extracted `parseDoseOptions` from `47e1bc4:index.html` and ran it |
| Rule 0 | **CLEAN** — `test/v75-no-other-patient.mjs` 27/27. The diff is a regex, comments, tests and one README row: no name, no patient pronoun, no dose or ceiling from one care plan, no new branch on a medication id. The README's *"thrown her out of the field"* is pre-existing developer prose about a text cursor |
| "nine harness scripts rebuild index.html byte for byte" | **NOT VERIFIED** — a rebuild writes `index.html`, and the brief forbids modifying it. The count is self-consistent (eight last round, nine now, one added). Stated as unverified rather than assumed |

---

# PART 2: SAFER THAN LIVE?

app-v80 reads the amount as **the first number in the option, always**. That single sentence is the
whole comparison: on every combination strength it returns the opioid component, so one Percocet
tablet weighs five.

Both builds measured directly — `3b46ec8` through `window.__doseTest`, app-v80 through its own
`parseDoseOptions` lifted out of `47e1bc4:index.html` — and the screen rows re-measured at 390×900
with a six-a-day pill limit and nothing logged.

| written amount | app-v80 | `3b46ec8` | truth | safer |
|---|---|---|---|---|
| `.5 mg` | label `.5 mg`, **mg 5** | label `0.5 mg`, **mg 0.5** | 0.5 mg | **v81** — v80 reaches a 3,000 mg paracetamol ceiling after 300 mg |
| `1/2 tablet` | **1** | **0.5** | 0.5 | **v81** |
| `1/2 tab BID` | 1 | 0.5 | 0.5 | **v81** |
| `5,000 units` | splits: `5` → 5 **and** `000 units` → **0** | one option → 5000 | 5000 | **v81** — v80 leaves a dose button that counts **zero**, an uncapped button on an armed limit |
| `1.0 mg` | `1.0 mg`, 1 | `1 mg`, 1 | 1 | v81 (cosmetic, ISMP) |
| `5/325 mg` | **5** | none + notice | 1 tab | **v81** — v80 locks a 4/day card at zero doses |
| `5/325 mg 1 tablet` | **5** | **1** | 1 | **v81** — v80 gives 1 ordinary dose at lim 6, v81 gives 6 |
| `5/325 mg (1 tablet)` | 5 | 1 | 1 | **v81** |
| `5/325 (1 tab)` | 5 | 1 | 1 | **v81** |
| `Percocet 5/325 1 tab q4h prn` | 5 | 1 | 1 | **v81** |
| `oxycodone/APAP 5/325 2 tabs` | 5 | 2 | 2 | **v81** |
| `5/325 mg 2 TABS` | 5 | 2 | 2 | **v81** |
| `5/325 mg 2 tabs q6h prn` | 5 | 2 | 2 | **v81** |
| `12.5/325 mg 2 tablets` | 12.5 | 2 | 2 | **v81** |
| `200/12.5 mg 1 tablet` | **200** | 1 | 1 | **v81** |
| `5/325 mg q6h` | 5 | none + notice | 1 | **v81** |
| `5/325 mg q4-6h prn max 8 tabs daily` | 5 | none + notice | 1–2 | **v81** |
| `7.5/325 mg 1-2 tabs` | 7.5 | none + notice | 1–2 | **v81** |
| `5/325 mg - 1 tablet` | 5 | none + notice | 1 | **v81**, with the caveat below |
| `5/325 mg: 2 tablets` | 5 | none + notice | 2 | **v81**, same caveat |
| `5/325mg tabs - 2 po q6h` | 5 | none + notice | 2 | **v81**, same caveat |
| `5/325 mg, take 1 tablet` | `5` + `1` | none+notice + `1` | 1 | **v81** |
| `1 tablet 5/325 mg q6h` | 1 | 1 | 1 | equal |
| `1 patch` · `2 sprays` · `500 mg` · `8 units` | same | same | | equal |
| `dispense 30 tablets 5/325 mg` | 30 | 30 | 1 | equal — both wrong, neither discloses |
| `oxycodone 5 mg 1 tablet` | 5 | 5 | 1 | equal — both wrong, neither discloses |
| **`5/325 mg 30 tablets`** | 5 → **1 ordinary dose** at lim 6 | **30** → **0 ordinary doses**, override only, silent | 1 | **v80** |
| **`5/325 mg 8 tabs/24h`** | 5 → 1 ordinary dose | **8** → 0 ordinary doses, silent | 1–2 | **v80** |
| **`5/325 mg 12 tablets in 24 hours`** | 5 → 1 ordinary dose | **12** → 0 ordinary doses, silent | 1–2 | **v80** |
| `5/325 mg 6 tabs daily` | 5 → 1 dose | 6 → 1 dose | 1–2 | equal at lim 6 |

**Twenty safer, three worse, the rest equal.**

## The honest caveat, which is not in the table

There is one direction in which this build is *less* protective than app-v80, and it is deliberate
rather than accidental. Where app-v80 invents a wrong number, this build often counts **nothing** —
and a pill limit that counts nothing does not stop anybody. On `5/325 mg - 1 tablet` at a six-a-day
limit, app-v80 blocks after one press; `3b46ec8` permits unlimited presses with a notice on the
card. On the narrow axis of "can a caregiver log more medicine than the limit allows", that is a
loss.

I do not think it is a safety loss, for a reason this project has already paid for three times.
app-v80's "protection" on that string is the number **five** for a single tablet — not a limit, an
arbitrary wrong figure that locks a card that should be open and pushes every real dose through the
red override, where it lands in History and in the export stamped over-limit. A ceiling that fires
at the wrong number trains the caregiver to use the override, and an override used routinely is a
ceiling that has already stopped working. Counting nothing and saying so, in the seven places a dose
can be written, at least leaves the caregiver reading a true sentence. That was the design decision
rounds 5 through 9 argued the builder into, and I think it was the right one.

## Would any caregiver be worse off than they are right now on app-v80?

**Yes — one kind, narrowly, and I can name them exactly.** A caregiver who writes a combination
strength followed immediately by a bare quantity or a bare daily total — `5/325 mg 30 tablets`,
`5/325 mg 8 tabs/24h` — and who has set a pill limit of five or more. On app-v80 they get one
ordinary dose before the override; here they get none. One press, on three string forms, at limits
above four. Nothing silently permits more medicine than app-v80 permits; the loss is entirely in the
over-count direction.

**Everyone else is better off, most of them by a lot.** A `.5 mg` dose stops counting ten times
itself. A 5,000-unit dose stops producing a button that counts zero against an armed ceiling. And
every single caregiver with a combination product — Percocet, Norco, Vicodin, an ARB/diuretic, a
carbidopa/levodopa — stops having one tablet weighed as five, which today locks a four-a-day card
before breakfast and has been true on every build this app has ever shipped.

**If this shipped today I would take that trade without hesitation, and I would not take it quietly.**
The three strings in RECORDED 1 are a real regression against live and they should be the first
thing the next release fixes, with the suite row that would have caught them. But they are a worse
version of a defect app-v80 already has, on a form nobody has written down, and they are not worth
an eighth refusal of a release that removes the far larger version of the same defect from every
combination strength a caregiver is likely to type.

---

## What round 11 has to do

RECORDED 1 — five suite rows, one end-to-end row at `ceilingMax: 6`, one mutant, and a decision from
Aaron on whether a bare number past an unreadable strength should count at all. RECORDED 4 — delete
one stale paragraph from the README row. Nothing else in this release needs to move, and the
mutant-writing habit in RECORDED 1's last paragraph is worth more than either fix.
