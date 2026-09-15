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

---

# ADDENDUM, 2026-09-15 — THE NOTICE GAINED A LINE, SO THE SCREEN GETS THE PASS AGAIN

The pass above ran over Home, Meds and Reports. The update notice itself gained a line after the
fourth audit, and a screen that changes gets read again — including with question 6, *is everything
already on the screen worth being there*, which is the question this seat is most likely to walk
past because it is looking for what is missing.

## The line

> *"2 earlier updates you have not seen are under "See recent updates"."*

**Worth being there: yes, and it is the whole finding.** The notice renders the newest changelog
entry and nothing else. On an ordinary release that is right — one card, one update, dismissed in
five seconds. This release ships four versions to a phone sitting on app-v80, and without this line
the screen tells a caregiver about one of them and closes. Every sentence true; the screen false.

**It carries a number, so question 3 of the Voice applies: does this figure belong on a screen?**
Yes. It is a count of discrete things a person can go and read, not an average of anything, and it
changes what they do next — it is the difference between tapping *"Got it"* and tapping *"See
recent updates"*. Compare the figure this project removed for failing the same question:
*"Averaging 5.6 L per procedure"*, which described nothing anybody would act on.

**It disappears when it is nothing.** A line reading *"0 earlier updates"* would be on every notice
on every ordinary release, which is how a screen accumulates furniture. Asserted in both
directions by `test/v84-whatsnew.mjs` section 7h.

**Its wording names the control it points at, exactly.** The button says *"See recent updates"* and
the line quotes it character for character. That rule is here because v66 shipped a hint naming
controls that had been renamed.

## Can the caregiver do the whole job on this screen?

Unchanged and still yes: read what changed, tap through to the rest, or dismiss. **Nothing new is a
dead end** — the line points at a control that is on the same screen, two rows below it.

## Nothing else proposed this time

E1–E6 above are still the list, unchanged and still Aaron's to pick from. **Explicitly: no new
proposals from this addendum.** An explicit "nothing this time" is information; silence is not.


---

# ADDENDUM 2, 2026-09-15 — THE LINE ABOVE COULD NOT APPEAR ON ANY PHONE IN THIS ROLLOUT

Addendum 1 read the notice's new line and passed it. **It never asked whether the line can fire**,
and an audit measured that it cannot: app-v80 carries no What's New code, so no phone receiving
app-v84 has a seen-version marker, the count is 0 on every one of them, and the line was invisible
on the entire rollout.

**That is this seat's own blind spot, exactly as Rule 2.6 describes it.** The Enhancer asks whether
a screen is complete and whether what is on it is worth being there. It does not, by habit, ask
**can the thing I just approved actually appear for the people receiving it** — and on this release
the answer was no.

## The question that was missing, now written down

**For every control or line a release adds: which population sees it, and does that population exist
in this rollout?** A control that only appears for users who already have state the release
introduces is a control nobody sees on the release that adds it. It is not wrong; it is absent, and
absent looks identical to done from inside a code review.

## What changed

The notice now handles both populations: a phone with a marker gets the count, and a phone with none
— every phone in this rollout — is told the true thing that is knowable, that these notes have never
been shown on it before. **No number is invented for the case where the number is unknowable.**

**No new proposals.** E1–E6 are still the list.
