AUDITED-COMMIT: b19e390
VERDICT: DO NOT SHIP

# Zero Day Audit — app-v81, round 8 (delta: `b19e390` over `3854df3`)

## The headline, in plain words

**The three blocks from round 7 are genuinely closed. I attacked all three and could not reopen
any of them. But the parser generalisation that closed block 3 has opened a new one in the opposite
direction: the app now counts a number that is not an amount. Type a Percocet card the way the
bottle is written — `5/325 mg q6h` — and this build counts SIX PILLS per dose. It then lets the
caregiver set a four-a-day limit it could not set before, and the card's only dose button comes up
reading `5/325 mg q6h · over limit` BEFORE A SINGLE DOSE HAS BEEN GIVEN. The medication can only be
given through the red two-tap override, and every dose it writes is stamped `overLimit` in History
and in the exported record. On `3854df3` the identical input logs normally.**

The round before this one, the app refused to guess and said so. This one guesses, and the guess is
a dosing frequency. The comment above the change says *"Inventing a number is not"* — which is
exactly what `firstCountableNumber` now does on this class of string, and there is no disclosure,
because a dose that carries a `pills` number is by definition not an uncountable one.

**Everything else in the round holds.** The confirmation notice reaches every control that writes a
dose — I enumerated all of them rather than trusting the claim, and there is no path left.
`data-placement-option` is a real hook and the completeness check reads it. The copy fix is true in
all three places. 159/159, 456/456, 44 mutants and "twelve suites" all check out, verified by
re-running, not by reading. Rule 0 is 27/27. Nothing threw anywhere. Section 4 records that so it
does not have to be done again.

**The fix is small — a handful of characters in one function — and the suite needs three rows and one
mutant it does not have.** This is not a rebuild. It is the same release with the guess taken back
out.

---

# BLOCKS

## BLOCK 1 — the count can now be a dosing frequency, and it locks a pain medication at zero doses *(HIGH)*

### What changed

`leadingNumberIsRatio` looked at the FIRST number only: if that number was half of a ratio it could
not evaluate, the dose carried no `pills`, the limit was disarmed, and every control said so.
`firstCountableNumber` now walks past every number belonging to a ratio and counts **the first one
that is left** — whatever it happens to be.

On a combination strength, the first number that is left is very often not an amount. It is the
dosing interval.

### Measured, through the shipping parser (`window.__doseTest.parseDoseOptions`)

    "5/325 mg q6h"                 ->  pills: 6      (3854df3: no pills at all)
    "5/325 mg every 6 hours"       ->  pills: 6      (3854df3: none)
    "10/325 mg q8h"                ->  pills: 8      (3854df3: none)
    "5/325 mg q4-6h"               ->  pills: 4      (3854df3: none)
    "5/325 mg (max 8 per day)"     ->  pills: 8      (3854df3: none)
    "5/325mg #30"                  ->  pills: 30     (3854df3: none)
    "7.5/325 mg 1-2 tabs"          ->  pills: 1      (3854df3: none)

The intended cases still work and I am not asking for them back:
`5/325 mg (1 tablet)` -> 1, `5/325 mg 2 tablets` -> 2, `5/325 mg x 2` -> 2, `5/325 mg` -> no count.

### Measured on the screen, `5/325 mg q6h`, typed into the real Add-medication form

Same script, same steps, two builds, 320×720, clock frozen at 10:00.

| | `3854df3` (before this round) | `b19e390` (this round) |
|---|---|---|
| Daily limit box, unit = pills | **Locked** — the app will not arm a limit it cannot count | **unlocked**, accepts `4` |
| stored dose | `{label:'5/325 mg q6h', mg:325}` | `{label:'5/325 mg q6h', mg:325, **pills:6**}` |
| the card, zero doses logged | `5/325 mg q6h` | `5/325 mg q6h **· over limit**` |
| tapping it | logs the dose | arms *"This would go over today's 4 pills limit. Log it anyway?"* |
| the record after one dose | one ordinary dose | nothing, unless she overrides — and then `override:true, overrideReason:'overLimit'` |

`doseBlocked` (index.html 6033-6037) is `amt > (dc.max - dc.used)` — 6 > 4 − 0 — so the ordinary Log
button is replaced by the dashed override button from the very first tap and stays that way every
day, forever.

### Why this is a block and not a preference

1. **It is reachable from the editor alone.** No legacy config, no import. A caregiver typing the
   sig line off a Percocet bottle gets it. The old build fenced this off by keeping the limit box
   Locked; this round removed the fence by making the number appear.
2. **The harm is denial of a pain medication plus a false record.** The card says the daily limit is
   already exceeded when nothing has been given. Every dose then carries an "over limit" flag into
   History and the export the care team reads.
3. **The opposite direction is silent.** `7.5/325 mg 1-2 tabs` counts 1 where it previously counted
   nothing. An 8-pill limit then permits 16 tablets — and, unlike before, **the app no longer says
   the limit is not being counted**, because a dose with `pills` set is not an uncountable dose.
   The whole point of this release is that the app does not pretend a limit is holding when it is
   not. Here it does.
4. **It is the round-5 finding again in a new place.** Round 5 blocked because a fix for an
   over-count disarmed ceilings that worked. This is a fix for a disclosure that arms a ceiling on
   an invented number.

### The fix *(S)*

Keep the walk past the ratio; refuse a number that reads as a frequency or a quantity dispensed
rather than an amount. Concretely, inside `firstCountableNumber`, skip a match when

- it is immediately followed by a time unit — `/^\s*(h|hr|hrs|hour|hours|d|day|days|min|x\s*(a|per)\s*day)\b/i`, which kills `q6h`, `every 6 hours`, `q4-6h`;
- it is immediately preceded by a frequency or quantity marker — `/(\bq|\bevery|\bmax(imum)?|\bup to|#)\s*$/i`, which kills `max 8 per day` and `#30`.

Anything still ambiguous after that must fall back to **no count**, which is the behaviour this
release exists to make honest, not to the next number along.

### The suite

`test/v81-dose-parser.mjs` has **no row anywhere in which the first non-ratio number is not the
amount** — every one of the three new rows puts a genuine count after the ratio. Add
`5/325 mg q6h`, `5/325 mg (max 8 per day)`, `10/325 mg q8h`, each asserting **no `pills`**, and one
mutant: *"the counted number may be a frequency"*. It must go red on all three. And add the
end-to-end shape, because the parser row alone would not have shown the `· over limit` button:
type `5/325 mg q6h` into the real form, assert the limit box is either Locked or the card is not
over its limit at zero doses.

### Name the seat

**The builder's falsification duty, and the write model.** The write model for this round said
what the count would be for strings where a real amount follows the ratio; it did not ask what
happens when nothing that follows the ratio is an amount. M42 and M43 both mutate *towards* the old
behaviour; nothing probes the new freedom the generalisation created. A generalisation is exactly
the change where the new cases, not the old ones, are the ones to write down.

---

# VERIFIED SOUND — do not re-do this in round 9

### 1. The fifth door is closed, and I enumerated rather than trusted

Every path in the file that writes a medication dose:

| call site | opens | notice |
|---|---|---|
| standalone card dose button / plain Log (6018+) | `logMed` -> `timeModal type:'med'` | yes |
| group card row Log (4377) | `logMed` -> `timeModal type:'med'` | yes |
| group row override "Log anyway" (4373) | `logMed(..., {force:true})` -> same modal | yes |
| per-dose override "Override — log now" (6055) | `logMed(..., {force:true})` -> same modal | yes |
| whole-card lock override | `logMed(..., {force:true})` -> same modal | yes |
| **Take all** (4301) | `timeModal type:'multi'` | yes |
| missed-dose backfill from History, `logMissedDose` (2613) | `timeModal type:'med'` | yes |

`logMed` has exactly one write path and it is `setState({timeModal})` — there is no branch that
reaches `addEntryDB` directly, forced or otherwise. The only other `addEntryDB` call carrying a real
`medId` is `skipMissedDose` (951), which writes `dose:null, mg:0` and no `pills`: it records that a
window was deliberately not given, so there is no dose to disclose about. Every other `addEntryDB`
in the file is a vital, a treatment date, paracentesis, symptom, appetite or an in-patient marker.

Measured, not only read: 320×720, evening group of five, four of them uncountable —
`[data-uncounted="confirm"]` renders inside `[role=dialog]` naming each affected medication and not
naming the one the limit counts fine. Suite section 3f covers batch, batch-negative and single.

### 2. The notice reads correctly and the modal is usable at 320px

    dialog 320×680, scrollHeight 872 vs clientHeight 678 -> scrolls
    notice block 463px, 4 lines
    Confirm button top 819 (below the 720 fold) -- reachable by scrolling inside the dialog
    clicked successfully, 5 entries written, no page errors

Screenshots: `outputs/v81-audit-r8-shots/`. Not a block — nothing is trapped and nothing is clipped.
See RECORDED 1.

### 3. `data-placement-option` is a real hook, and the claims are true

The attribute is on the radio itself, the check reads keys (`["own","morning","afternoon","evening","none"]`
harvested live), `custom` and `none` are named exempt in the file with the reason. M44 adds a sixth
placement and the check goes red on the key, not on the label — which is the thing round 7 measured
as false.

### 4. Every number in the commit message and the README

- `159/159` — re-ran `test/v81-dose-parser.mjs` myself: **159/159 passing**.
- `456/456 across twelve suites` — the twelve totals in `outputs/SUITES-app-v81.txt` sum to exactly
  456, and twelve suites are listed.
- `44 mutants across six rounds` — 44 unique ids across the FALSIFY files (M1–M45, M36 unused).
- `146 -> 159` — the diff adds 13 checks.
- "order no longer decides the count" — true for the cases the claim is about:
  `1 tablet (5/325 mg)` and `5/325 mg (1 tablet)` both count 1. (The new failure in BLOCK 1 is not
  an order failure; it is a *what is this number* failure.)
- Rule 0: `test/v75-no-other-patient.mjs` **27/27**, ratchet pinned at 0/0/0.

### 5. The copy (the Voice), on the changed string

*"No dose of this medication is being counted against it."* — true in all three surfaces it renders
on, which the old *"Nothing on this card"* was not. No pronoun, no name, no dose from one care plan.
Reads at 2am. The bordered group notice is now visually distinct from the scheduling note directly
above it and does not overlap the Log button at 320px.

---

# RECORDED — not blocking, for the backlog

1. **The confirmation modal pushes Confirm below the fold when several medications are affected.**
   Measured above: four uncountable medications in one batch put the Confirm button at y=819 on a
   720px screen. It scrolls and it works, but the caregiver must scroll a dialog to finish a batch
   she started with one tap. *Suggested (S): cap the notice block at roughly 40% of the dialog with
   its own scroll, or collapse to "3 of these amounts are not counted — tap to see which".*
   **Seat: the Designer.**

2. **In the single-dose confirmation the notice can describe an amount other than the one being
   logged.** A medication with `1 tablet` and `5/325 mg` shows *"This amount is not counted ... :
   5/325 mg. Your other amounts still count."* while the caregiver is confirming `1 tablet`. Every
   word is true and the amount is named explicitly, so this is a readability nit, not a falsehood.
   *Suggested (S): in `type:'med'`, say "5/325 mg is not counted..." rather than "This amount".*
   **Seat: the Voice.**

3. **`2 mg/kg`, `5 mg/mL`, `100 mg/m2` all still set `pills` to the mg number** (2, 5, 100). This is
   pre-existing and pinned deliberately in suite section 4, unchanged by this round — noted only so
   a future round does not discover it and think it is new.

---

## What round 9 has to do

One function, two guards, three suite rows and one mutant. Nothing else in this round needs to move
— the four surfaces, the batch confirmation, the placement hook and the copy are all correct, and
sections 1–5 above are the evidence so they do not need auditing a seventh time.
