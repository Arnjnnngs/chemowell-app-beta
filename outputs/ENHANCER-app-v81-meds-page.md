# ENHANCER — the Meds page, before a line of the rebuild is written

> **WHICH RELEASE THIS GATED: app-v81.** Renamed from `ENHANCER-meds-page.md` so
> `release_check.sh` can find it — the gate now refuses a release that touches `index.html` without
> an `ENHANCER*<version>*` and a `DESIGN*<version>*` pass in `outputs/`, which is a promise
> `TEAM-ORDER.md` had written down without keeping.
>
> **What in app-v81 this pass covers, and what it does not.** app-v81 changes two things on this
> screen: the "What it's for" hint, and the Dosage options parser. Both are findings below — the
> hint is what E7 is about (identity fields split apart, and the generic name is the lookup's second
> input), and the parser is the front half of **E8**, whose back half is the unit list and is
> deliberately not in this release. Everything else here — E1 through E6 — is PROPOSED and waiting
> on Aaron's pick. **Nothing on this list was built into app-v81 without him choosing it.**


Aaron, 2026-09-14: *"We need a full rundown with the whole team in the meds page. Designer and
enhancer needs to be a big part of what needs to stay and what makes sense along with the order if
how things are laid out. There needs to be a full sweep of that page with several eyes on it for
wording and entering the box forms."*

**This is the first Enhancer pass of the session, and that is the finding behind all the others.**
Six releases shipped before it ran once. Everything below was reachable in twenty minutes by reading
the labels off the running screen; none of it needed an auditor, and most of it has been on that
screen for many releases.

**Method, per Rule 2.6: the labels were read off the live app, not grepped for.** Two scripted
passes enumerated every heading, button, field, `<select>` option, placeholder and empty state on
the Meds screen and in the Add-medication form, at 320 / 360 / 390.

---

## THE HEADLINE

**A person who has just installed this app and taps Meds sees a paragraph of admin prose, an Add
button, and nothing else.** No list, no empty state, no invitation. The paragraph reads:

> *"Review, add, edit, or remove the active medication list. Configuration is stored on this device;
> dose history stays intact."*

That is the first sentence a new customer reads about the screen where they set up their
chemotherapy medications. It is written for whoever maintains the list, not for the person holding
the phone at the pharmacy counter.

---

## WHAT IS ON THE SCREEN TODAY — read off the running app

### The Meds screen, empty
`MEDICATION MANAGEMENT` · `Meds` · the paragraph above · `Add` · the tab bar. **No empty state.**

### The Meds screen, with medications
Each card, verbatim:

> **Acetaminophen** · No generic name · Eases pain. · *Look it up on MedlinePlus* ·
> **Doses:** 500 mg · 1000 mg · **Rules:** Min 4-hour gap · Own Home card
> *controls: `[Edit Acetaminophen]` `[Remove Acetaminophen]`*

### The Add-medication form, in the order it presents them

| # | Label | Control |
|---|---|---|
| 1 | Medication name | text |
| 2 | **What it's for** | text |
| 3 | **Generic name** | text |
| 4 | Schedule type | select — As needed / Scheduled |
| 5 | **Limit unit** | select — **Total milligrams (mg) / Number of pills / doses / Number of applications** |
| 6 | Dosage options | text, free — `500 mg, 1000 mg` |
| 7 | Hours between doses | number |
| 8 | Daily limit | text, **disabled, placeholder "Locked"** |
| 9 | **(no label at all)** | select — Every day / No set days / Specific days of the week / Every few days |
| 10 | Notes | textarea |

---

## FINDINGS

### E1 — A control with no name. *(S, do it regardless of what else is picked)*
Field 9 has **no label**. A `<select>` offering *Every day / No set days / Specific days of the week
/ Every few days* sits under the form with nothing saying what it governs. A screen reader announces
an unnamed combo box; a person guesses from the options. Every other field on this form is labelled.

### E2 — The empty Meds screen says nothing to a new customer. *(S)*
No empty state. Rule 2.6's second question is *read the empty states out loud* — there is nothing to
read. **Proposed:** *"No medications yet. Add the ones you're taking and ChemoWell will remind you
and keep the record."*

### E3 — The screen's own description is written for an administrator. *(S — Voice)*
*"Review, add, edit, or remove the active medication list. Configuration is stored on this device;
dose history stays intact."* Three things a caregiver does not think in: *active medication list*,
*configuration*, *dose history*. The eyebrow **MEDICATION MANAGEMENT** above a heading **Meds** is
also the tab you just tapped, said twice.

### E4 — "No generic name" is the app announcing an absence. *(S)*
Printed on every card without one. It is the same class as the `Untitled medication` placeholder
already logged as task #19: **a label composed out of a missing value.** Nothing should be printed.

### E5 — The card is a dead end: you cannot get from a medication to its doses. *(M)*
The card shows what the medication IS and what its rules ARE, and nothing about what has happened.
No count today, no last dose, no running total against the daily limit, no way through to the log.
**The mockup Aaron approved has exactly this** — a ceiling bar reading *2,500 / 3,000 mg*, *4 doses
today*, *500 mg left*. Rule 2.6's fourth question is *is anything a dead end*; this is the clearest
one in the app.

### E6 — The daily-limit chain is three fields deep and the middle one is a guess. *(M–L)*
`Limit unit` (a 3-option select) → `Dosage options` (free text) → `Daily limit` (disabled until a
parser agrees the first two match). The parser takes any leading number as a count. The field says
**"Locked"** and nothing on screen says how to unlock it — the explanation lives in the FAQ, under
*"The Daily limit box is greyed out and says 'Locked'"*. **A screen that needs an FAQ entry to be
operable is a screen with a design defect, and the FAQ entry is the app's own bug report about
itself.**

### E7 — THE ORDER IS WRONG, and Aaron asked about exactly this. *(S)*
- **What it's for** sits *between* Medication name and Generic name, splitting the two identity
  fields — and the generic name is the second input to the description lookup, so they belong
  together.
- **Limit unit** is asked *before* the caregiver has seen the optional field it configures. Its own
  help text — *"What a daily limit below (optional) will count"* — points forward at something not
  yet on screen.

**Proposed order:** name → generic name → what it's for → schedule type → *when* (days, hours
between doses) → *how much* (dosage options → daily limit → limit unit, or a single combined
control) → placement → notes. Identity, then purpose, then when, then how much.

### E8 — Three dose units is not the medical world. *(L — this is Aaron's, and it is the big one)*
`Total milligrams (mg)` / `Number of pills / doses` / `Number of applications`. Two further
problems inside those three:

- **"Number of pills / doses" conflates two different things.** A dose can be two pills. A limit of
  "6" then means six of one and three of the other, and the app cannot tell which the caregiver
  meant.
- **A logged entry stores only `mg`, `pills` and `volumeMl`.** So this is **not a dropdown change**:
  *2 puffs*, *8 units of insulin*, *1 patch*, *5 mL*, *2 mEq* have nowhere to be counted. The
  Research seat is reporting on the full taxonomy and on what the storage has to become; its
  findings decide the size of this item.

---

## THE ORDER I RECOMMEND

| | Item | Size |
|---|---|---|
| 1 | E1 label · E2 empty state · E3 wording · E4 "No generic name" | **S** — a morning, and all four are on screen today |
| 2 | E7 field order | **S** |
| 3 | E5 card rebuild with the ceiling bar (this is also phase 4, task #16) | **M** |
| 4 | E6 the daily-limit chain, and E8 the units, together | **L** — gated on the Research report |

**E8 cannot be designed before the research lands**, and E6 is the same screen, so they go together.
Everything above them is independent and can ship first.

---

## WHAT SHOULD STAY, EXACTLY AS IT IS

Asked because the other half of this role's job is not adding things.

- **Edit and Remove on every card, and Add on the screen.** Full symmetry — the Paracentesis defect
  that created this role does not exist here.
- **The description and its source line.** *Look it up on MedlinePlus* vs *Read it on MedlinePlus*
  is a real distinction, honestly drawn, and it should survive the rebuild untouched.
- **Removed medications and Bring back**, which render only when the archive has something in it.
  Conditional, correct, and the app-v75 audit refused three designs before this one.
- **"Own Home card" and the placement picker.** Long labels with an explanation under each — the one
  place on this form where a choice explains itself.
