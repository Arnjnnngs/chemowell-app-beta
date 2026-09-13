# Phase 4 — exposing the five properties in the editor

Written 2026-09-13, after the app-v79 Enhancer pass. `HARDCODED_MEDS_PLAN.md` phase 4.

## Why this is the urgent one

Phases 1-3 turned four medications' hardcoded behaviour into five properties, migrated the legacy
ids onto them, and took down the fence that stopped a customer creating a medication called Zofran.
Every one of those properties is **readable, migratable, and unsettable.** `homeCard` is written in
exactly one place in the whole file — `LEGACY_MED_RULES` — so the daily-total card on Home appears
only for somebody who was already using one of four legacy medications.

**A new customer who sets up paracetamol with a 3,000 mg daily limit gets the ceiling warning and
never the running total.** They find out they are over the limit at the moment they cross it.

Phases 1-3 removed the fence. Phase 4 opens the gate.

## The rule this design follows

This is a medication app for people having chemotherapy. **Every extra control is a new way to
mis-tap**, and the medication editor is already the longest screen in the app — the help file has a
whole entry for *"The Daily limit box is greyed out"*, which is the most-reported sticking point on
it. So the test for each property is not *can we expose it* but **can we derive it from something
the caregiver has already told us.** Two of the five can be.

---

## 1. `homeCard` — DERIVE IT. Do not add a control. (S, ship first)

The editor already asks for **Limit unit** (*Total milligrams* / *Number of pills or doses* /
*Number of applications*) and a **Daily limit**. A medication with a daily limit almost always wants
a running total against it; that is what a limit is for.

So: one switch, **"Show today's running total on Home"**, which appears *only once a daily limit is
set*, defaults **on**, and writes `homeCard.kind` from the limit unit already chosen —

| Limit unit already chosen | `homeCard.kind` |
|---|---|
| Total milligrams (mg) | `mg` |
| Number of pills / doses | `pills` |
| Number of applications | `pills` |
| (`volumeCeilingMl` set, no mg limit) | `ml` |

No new vocabulary, no new decision unless the caregiver wants one, and the property stops being
reachable only by migration. **This single item is most of the Enhancer's finding.**

Falsification for the suite: set a limit, save, assert the card appears on Home with the right unit;
turn the switch off, save, assert it is gone. Then delete the derivation and watch both go red.

## 2. `chemoBlock` — RECONCILE, do not add. (S, and it is a real finding)

**There are already two overlapping ways to say "not around treatment day", and only one of them is
settable.** The editor's *Treatment-day availability → Excluded near treatment day*, with days
before and after, writes `treatmentMode` and `treatmentDaysBefore/After`. `chemoBlock`, with
`fromDayOffset`/`toDayOffset`, is written only by the migration.

They are not the same: the treatment-mode path greys the card out, and `chemoBlock` is a hard lock
that reports `courseComplete` when the window has passed. A customer setting up their own
anti-nausea medication gets the first and can never get the second, and nothing on screen explains
that the app has two answers.

**Do not add a sixth control.** Decide which mechanism is the real one, express the other in its
terms, and migrate. The likely answer is that `chemoBlock` is the more precise expression and
`treatmentMode: 'excluded'` should write it — but that is a behaviour change on existing
medications and needs its own equivalence pass, hour by hour, the way phase 2's did.

## 3. `linkedTo` — one new control. (M)

*"This one is taken a few hours after another medication."* A medication picker, a number of hours,
and a morning/evening half. Three fields, in a disclosure that stays shut unless opened.

The half is the part that will confuse people, and it is not optional — `linkedWindowsFor` anchors
on the first dose of the named medication inside that half of the day. Name it in the caregiver's
words (*"after the morning dose"* / *"after the evening dose"*) rather than exposing `half`.

## 4. `interactions` — one new control. (M)

*"Warn me if this is taken within N hours of another medication."* A picker, a number of hours, and
the sentence to show. **The sentence is the hard part and it is a Voice question, not an
engineering one:** a caregiver writing their own warning text will write something too short to act
on, and the app must not write a medical claim on their behalf. Proposal: the caregiver picks the
medication and the gap; the app writes a neutral, non-clinical sentence — *"These were logged within
2 hours of each other. Check with the care team about spacing them."* — and the free-text field is a
**note**, appended, not a replacement.

Ship this only after `homeCard`. An interaction warning that fires wrongly is worse than none.

## 5. `chemoRelativeWindows` — last, and it is the one that is genuinely hard. (L)

Different times of day on different days relative to treatment. There is no way to make this three
fields. The honest shape is that each **schedule window** row gains an optional *"only on these days
around treatment"* selector, visible only when the medication is set to *Only near treatment day* —
so the complexity appears for the few medications that need it and nowhere else.

Leave it until the other four are live and the editor's length has been measured again.

---

## Order, and why

1. **`homeCard`** (S) — the Enhancer's actual finding, derived from existing answers, no new concepts.
2. **`chemoBlock`** (S–M) — reconcile the two overlapping mechanisms before either grows a UI.
3. **`linkedTo`** (M) and **`interactions`** (M) — one new disclosure each.
4. **`chemoRelativeWindows`** (L) — after the editor has been measured again.

Each step is its own release with its own audit, because each one writes to the medication config,
which is the file a caregiver's whole regimen lives in. `HARDCODED_MEDS_PLAN.md` phase 5 (server
reminders reading the config) is unchanged and still after all of this.
