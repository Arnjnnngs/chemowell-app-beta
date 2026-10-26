# Enhancer pass — app-v88, on the surfaces v88 CREATED

The pass that produced this release's two features is `outputs/ENHANCER-app-v87.md`, and the PM
judged it satisfies the seat for those items — it ran pre-build, on exactly these screens, and E-1
and E-2 are literally its findings. **What it could not cover is the surfaces v88 then built.**
This is that short pass. New surfaces only: the `Log another day` dialog, and the note field on the
row corrector.

## E-1 — The dialog cannot remove a day, and should not be able to. (nothing this time)

Checklist item 1 is add / edit / remove symmetry. The dialog adds and edits; it has no Remove.
**That is right**, and worth writing down so a later pass does not "fix" it: removal belongs on the
row, where the thing being removed is visible, and `Remove` is already there. A delete control
inside a date-picker dialog would let a caregiver destroy a day they are not looking at. **Nothing
proposed.**

## E-2 — A day with no entry still cannot be reached from the history list. (S)

The dialog solved the missing-day problem from the LOGGER. The history list below it is still
only a list of days that have answers — a week with three gaps shows four rows and no sign of the
other three. The caregiver has to know a day is missing to go and add it.

A faint row per missing day, carrying only `Log` — or a one-line summary (*"3 days this week have
no answer"*) — would make the gap visible instead of inferred. **Not recommended for now**: this is
a daily question people legitimately skip, and rendering every skipped day as an absence could read
as nagging, which is the thing the check-in window was added to stop. **Aaron's call, and it is a
product question rather than a defect.**

## E-3 — The note is appetite-only, and the screen does not say so. (S)

Bowel has no note field, deliberately — the data layer would take one but nothing displays or
exports it, so adding the field means adding the display and an export column. That decision is
recorded in the code and in the README.

**What is missing is on the screen.** A caregiver who uses the note on Appetite and then goes to
Bowel finds no box and no explanation. One line under the bowel logger — *"Notes are on the
appetite screen; use Notes in the menu for anything else"* — closes it. **Recommended, S**, in the
same pass as any future bowel-note work rather than on its own.

## E-4 — The question the auditor parked here, and my answer. (nothing to build; Aaron decides)

The delta-1 audit explicitly handed this seat one item: *back-filling a hospital day after two
silent weeks turns the Home banner on from a two-week-old answer.*

**It is documented semantics, not a defect, and it was already reachable in v87 via `Correct`.**
The banner derives from the most recent consecutive answers with no cache, so filling in an old day
genuinely changes what the most recent answers are. The alternative — ignoring back-filled days in
the alarm — would mean the record and the alarm disagree, which is worse.

**But it can surprise someone**: fill in a fortnight-old day and an alarm appears about "today".
The honest mitigation is one line of copy on the banner naming the day it is derived from, which
app-v87 already did for the banner's answer box. **Proposed, S. Aaron's call** — it is the same
class as the Loose decision, where the behaviour is defensible and he should get to choose it
rather than inherit it.

## E-5 — Is everything on the new surfaces worth being there? (nothing this time)

Checklist item 6, the one this seat walks past. The dialog carries exactly four things: the value,
the note (appetite only), the date, and Confirm/Cancel. **No count, no average, nothing computed
about the patient.** The note hint under the corrector appears only on a day that already carries a
note, so it is not permanent furniture. **Nothing to remove.**

---

## Summary for the release message

| # | Proposal | Size | Recommendation |
|---|---|---|---|
| E-1 | Remove inside the dialog | — | **Nothing this time** — correctly absent |
| E-2 | Make missing days visible in the history list | S | **Not recommended now** — risks nagging; Aaron's call |
| E-3 | Say on the bowel screen that notes live on appetite | S | **Recommended**, with any future bowel-note work |
| E-4 | Banner says which day it is derived from | S | **Proposed** — Aaron's call, same class as Loose |
| E-5 | Anything on the new surfaces that should not be | — | **Nothing this time** |

**Nothing in this pass is built in app-v88.** All four are for Aaron, and the release is complete
without them.
