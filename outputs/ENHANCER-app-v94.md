# Enhancer — app-v94 (the dose-coverage fix)

Rule 2.6's question, on the screens this release touches: **can the caregiver do the whole job
here, or does the app send them somewhere else?** Not "is it correct" — every other seat asks that.

## Screens touched

Home only, and only what it *says*: the Up next card, the dose ring, and the medication cards'
locked/available state. No control was added, moved or removed. The release changes one question
the app asks itself — has this window been covered — and three places that were answering it
differently.

## The finding this release did not need the Enhancer to make, but should record

**The app asked for a dose that had already been given, and the screen contradicted itself about
it.** A caregiver looking at "4/4 DOSES" and "Due now" at the same time has no way to resolve that
from the screen. The only action offered is *Log this dose* — which would have given a second dose.
There was no "I already gave this" and no way to see, from Home, which of the day's windows the app
thinks is outstanding. That gap is what made a counting bug into a safety problem.

## Proposals — Aaron decides, the builder does not widen the release

**E7 — the card does not say WHICH window it is asking for, when a medication has more than one (S).**
It says "Due now · Daily", where "Daily" is the window's name. With two windows a caregiver who has
already given one dose cannot tell from the card whether the app means the one they gave or the
other one. Showing the window's time — "Due now · 5:00 PM slot" — costs one string and removes the
ambiguity that this whole release is about. **Recommended.**

**E8 — tapping the ring should show the day's windows and which are covered (M).**
The ring is the only place the day's progress appears and it is a number with no detail behind it.
Tapping it could show the day's windows as a short list with a tick against the covered ones. That
is the screen that would have let Aaron answer his own question in two seconds. Bigger than it
sounds — it is a new surface — so: propose, do not build.

**E9 — nothing on Home lets a caregiver say "I already gave this" (S/M, needs intent).**
Today the only ways to resolve an outstanding window are to log a dose or to let it become a missed
one. If the app is wrong about a window — which it was, until this release — the caregiver has no
control that says so. Related to E1 from app-v92 (a logged dose cannot be corrected) and probably
the same piece of work.

**E10 — nothing this time on the ring's empty state.** With nothing scheduled the ring is hidden
entirely rather than showing an empty circle, which is correct and needs no change. Recorded as an
explicit "nothing this time" rather than silence.

## Read the empty states out loud

Unchanged by this release. "All scheduled doses are in · Nothing else is scheduled today.
As-needed medications are still available below." is true under the new rule in every case the
suite covers, including the one where a dose was logged early — which is the first release in which
that sentence has been true in that case.
