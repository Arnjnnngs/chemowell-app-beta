# Enhancer pass — app-v79

Run on the screens this release touches: the Home daily-total card, the warning banner, and the
Meds list. Rule 2.6's checklist, and the labels were read rather than keyword-searched.

## The headline: the app renders a card the user has no way to create

`homeCard: { kind: 'mg' | 'pills' | 'ml' }` is written in exactly one place — `LEGACY_MED_RULES`,
the migration table for medications that predate the properties. **No screen in the app sets it.**

So the daily-total card on Home — the running "2,500 / 3,000 mg · 500 mg left before the daily
limit" card that four of app-v79's eight fixes are about — can only appear for somebody who was
already using one of the four legacy medications. **A new ChemoWell user who sets up paracetamol
with a 3,000 mg daily limit gets the ceiling WARNING and never the running total.** They find out
they are over the limit at the moment they cross it, and there is nothing on Home before then that
shows them getting close.

That is checklist item 1 exactly — a screen that displays a kind of record but gives no way to
create it — and it is the Paracentesis bug in a different costume. It also applies to the other four
properties: `chemoRelativeWindows`, `chemoBlock`, `linkedTo` and `interactions` are all readable,
all migrated, and none of them settable. **`HARDCODED_MEDS_PLAN.md` phase 4 is this**, and this pass
is the argument for doing it next rather than after the visual work.

Worth saying plainly: phases 1-3 were sold as "a stranger can finally use their own medication's
real name", and that is true. But naming a medication Zofran now gets you a name and nothing else.
Phase 4 is where the customer actually gets the behaviour, and until it lands the app has *removed*
the fence without *opening* the gate.

## Proposals, with sizes

| # | Screen | Proposal | Size | Recommend |
|---|---|---|---|---|
| 1 | Medication editor | **Phase 4** — a "Show a daily total on Home" switch that writes `homeCard.kind` from the limit unit already chosen, plus editors for the other four properties. | L | **Yes, next** |
| 2 | Warning banner | The red "daily limit exceeded" banner has one control: dismiss. A caregiver reading *"Check with the care team before logging more"* cannot see what made up the total from there. Add **"See today's doses"** jumping to that medication in the journal. Checklist item 4, a dead end. | S | Yes |
| 3 | Home daily-total card | Same dead end, one step earlier: the card shows a total and no way into the doses behind it. Make the card itself tappable. | S | Yes |
| 4 | Reports — Appetite, Bowel movement | Empty states read *"No appetite entries logged yet."* and *"No bowel movement entries logged yet."* — full stop, no route to add one. The Blood Pressure empty state one screen over reads *"...Log them from the Home screen card."* **The inconsistency is the finding** (checklist item 5). Already task #4 on the sheet. | M | Yes |
| 5 | Reports — Paracentesis | *"No paracentesis procedures logged yet."* Same shape, same screen family. | S | Yes |

## Checked and deliberately not proposed

- **Nothing to remove.** Checklist item 6, the one this role is most likely to skip. The daily-total
  card shows a used figure, a limit, an amount remaining and a bar. Every one of those is a number a
  caregiver acts on, and none is an average of events that accumulate over time — which is the shape
  that got *"Averaging 5.6 L per procedure"* removed from the sibling app.
- **The grouped label** — "Tylenol + Tylenol Liquid · today" — was checked for the opposite failure
  and is right: it appears only where the total really is the group's, and the mL card, whose cap is
  one medication's own, keeps that medication's name.
