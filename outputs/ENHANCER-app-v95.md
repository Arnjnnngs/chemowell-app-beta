# Enhancer — ChemoWell app-v95

Run BEFORE the build, on the screens it touches: the log sheet, and the Home screen it sits over.
The Enhancer proposes; Aaron decides. It never widens a release on its own — every extra control
on a medication app is a new way to mis-tap.

## The screens this release touches

app-v95 adds no control and moves none. It changes *when* the page is allowed to redraw. So the
checklist's add/edit/remove symmetry questions are unchanged from app-v94's pass, and the useful
question here is a different one: **what else can the caregiver lose mid-action to the same cause?**

| Proposal | Size | Recommendation |
|---|---|---|
| **E11 — the sheet does not say which dose it is confirming when two are due.** The heading reads "Log Blood pressure dose 2 · 10 mg". With two medications due in the same hour and similar names, the only way to be sure you are confirming the right one is to remember which card you tapped. Aaron's report is literally about logging two in a row. | S | **Recommended.** One line under the heading naming the window — "Daily · 5:00 PM–9:00 PM". The data is already in the sheet's state. |
| **E12 — there is no way back to the other due dose from the sheet.** After confirming one, the caregiver returns to Home and has to find the next card. For a pair taken together that is two scrolls every time. | M | Not recommended yet. A "log the next one" affordance is a second write path by another name, and the app-v80 note already settled that question once. Worth revisiting only if Aaron asks. |
| **E13 — the toast says what was logged but not the time it was logged AT.** When the caregiver has just adjusted the time to 4:45, the confirmation says "Logged" and not "Logged at 4:45 PM". The one moment they would want to check the adjustment took is the moment it disappears. | S | **Recommended**, and it pairs with this release: the toast is the thing that was misbehaving, so it is already under the microscope. |
| **E14 — nothing this release touches has an empty state.** Checked; no new screen, no new list. | — | Nothing this time. |

## What is already on these screens and should not be

Read the sheet out loud, per Rule 2.6 item 6. Nothing on it is unearned: heading, date, time,
optional pain scale where the medication carries one, Cancel and Confirm. The one thing that reads
oddly is the date picker being a full month grid for a dose almost always logged today — but that
was a deliberate v68 change at Aaron's request (native wheels replaced with a tappable calendar),
so it stays.

## Nothing was built from this list

E11 and E13 are recommended and **not built**. This release is a defect fix on a medication path
and widening it is exactly what Rule 0.7 item 4 forbids. They are logged for Aaron to pick.
