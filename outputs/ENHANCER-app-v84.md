# ENHANCER — app-v83 / app-v84, the three screens the redesign touched

**RELEASE: app-v84** (covering app-v83 and app-v84, which ship together).
**Run AFTER the build rather than before it, and that is a process failure, not a choice.**

Rule 2.6 says the Enhancer runs BEFORE the build so Aaron picks from the list and the build carries
the pick, instead of a proposal waiting a release. That did not happen here: Aaron approved a
three-screen redesign from screenshots and the build went straight at it. This pass is therefore
honest about what it is — a completeness read of what shipped, and a proposal list for next time.

---

## THE SCREENS THIS RELEASE CHANGED, AND WHETHER THE JOB CAN BE DONE ON EACH

Read off the running app, not grepped. Rule 2.6's warning stands: a keyword search reported
"Add: yes" for a screen that only had Delete.

### Home — vitals strip, Today timeline, Up-next hero
| Record shown | Add | Correct | Remove |
|---|---|---|---|
| Temperature | ✅ tile → input in place | ❌ | ❌ |
| Weight | ✅ tile → input in place | ❌ | ❌ |
| Blood pressure | ✅ tile → input in place | ❌ | ❌ |
| A logged dose | ✅ med card | ❌ | ✅ Remove on the row |

**E1 (S). A vital logged at the wrong time can only be deleted and re-added.** The timeline row has
Remove; nothing offers "correct this". This is the exact shape of the Paracentesis finding that
produced Rule 2.6 in the first place, on three more record types.

**E2 (S). The vitals tiles are add-only.** Tap a tile and you get an input and a Log button. There
is no route from the tile to the reading it is showing — the number is displayed, and the only
thing you can do with it is add another one. Rule 2.6 question 4: information with no action on it.

### Meds — status pill, ceiling bar, doses-today line
| Record shown | Add | Correct | Remove |
|---|---|---|---|
| A medication | ✅ Add | ✅ Edit | ✅ Remove + Bring back |
| Today's doses (new) | ❌ | ❌ | ❌ |

**E3 (M). The doses-today line is a dead end, which is what E5 said about the whole card.** The card
now says "2 doses today · last at 2:14 PM" and there is no way through to those two doses. The
figure is the start of a question — *which two, and when* — and the screen ends the sentence.
Proposed: the line becomes a link to that medication's rows in Reports → History.

**E4 (S). A medication at its daily limit shows a red pill and no route to the override.** Home has
the override flow behind the dose button; Meds shows the state and offers nothing. A caregiver who
opens Meds to find out why a dose is refused has to go back to Home to act on it.

### Reports — Temperature report (new), symptom bars
| Record shown | Add | Correct | Remove |
|---|---|---|---|
| Temperature | ✅ add row | ❌ | ❌ |
| Symptoms | ✅ + button | ✅ tap a row | ✅ |

**E5 (S). The Temperature report can add and list but not correct or remove.** Symptoms, on the
same screen group, can do all three — Rule 2.6 question 5: the inconsistency IS the finding. A
temperature typed as 989 instead of 98.9 is in the record permanently and drags the chart's axis
with it.

**E6 (S). The temperature list has no date grouping.** Every other list in the app groups by day.

---

## IS EVERYTHING ALREADY ON THESE SCREENS WORTH BEING THERE?

Rule 2.6 question 6, which is the one this role is most likely to walk past.

- **The temperature stat tiles: Highest / Latest / At or above the fever line.** Kept deliberately,
  and an average was deliberately NOT added — a mean body temperature over a month reads as
  reassurance across a week holding one 101.4. This is the paracentesis-average lesson applied
  before shipping rather than after.
- **The symptom bars are counts, not average severity.** Same reasoning: a count of discrete events
  is what somebody says on the phone to a clinic.
- **The ceiling bar's two new disclosure lines** (shared limit / rolling window) only draw when
  true. Verified in the width pass rather than assumed.
- **Nothing on these three screens is a figure I would now remove.**

---

## THE LIST FOR AARON, WITH SIZES

| # | Screen | Proposal | Size |
|---|---|---|---|
| E1 | Home | Correct a vital logged at the wrong time, instead of delete-and-re-add | S |
| E2 | Home | A route from a vitals tile to the reading it displays | S |
| E3 | Meds | "2 doses today" links through to those doses | M |
| E4 | Meds | The override reachable from the Meds card, not only from Home | S |
| E5 | Reports | Correct / remove a temperature, as Symptoms already allows | S |
| E6 | Reports | Group the temperature list by day, like every other list | S |

**Recommendation: E5 first.** It is the only one where the absence puts a wrong number permanently
into a clinical record and drags a chart axis with it. E1 is the same defect one screen over.

**Nothing on this list was built into app-v83 or app-v84.** The release carries what Aaron approved
from the screenshots and the twelve defects the audit found, and nothing else.
