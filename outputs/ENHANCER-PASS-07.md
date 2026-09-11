# Enhancer pass 07 — the Meds screen and the medication editor, app-v74

Run BEFORE the build, on the screens this release touches (Rule 1.5). The proposal list goes in the
release message, not only here.

## The screens this release touches

The **Meds list** (each card gains a source link under the description) and the **medication editor**
(the "What it's for" field, whose placeholder now has a third thing it can show).

## Checklist

**1. Add / edit / remove symmetry.** Unchanged and already closed by app-v73. A description can be
typed, changed and cleared; clearing it now falls back to the cached official line if there is one,
and then to the built-in line. Nothing is one-way.

**2. Read the empty states out loud.** There is no new empty state, and that is deliberate: a
medication nothing knows about shows **no description element at all** rather than an empty one, and
the suite asserts it. A blank line under a medication name reads as a fault.

**3. Can a mistake be corrected?** Yes, and a new one is worth naming: if the looked-up description is
wrong for her medication — a brand name that matches the wrong drug — she can type over it, and her
wording wins permanently. The cached source is kept underneath rather than destroyed, so clearing her
text brings the official line back. Nothing is lost either way.

**4. Is anything a dead end?** **One, and it is the finding of this pass.** When the lookup has never
succeeded — which on day one is every medication, and may be every medication forever if the service
does not answer browsers — the row shows *"Look it up on MedlinePlus"* and that is the whole story.
There is **no way to ask the app to try again**. A caregiver who adds a medication in the hospital
lift with no signal gets the lookup link forever, and the only way to trigger another attempt is to
open the editor and save the medication again without changing anything, which nobody would guess.

**5. Where a sibling screen got it right.** care-tracker has none of this yet, by instruction. The
port carries the same gap unless item 1 below is taken.

**6. Is everything already on the screen worth being there?** The link is one line of 13px text under
a description that is itself secondary to the dose buttons. On a 320px phone the Meds card is already
dense. **It earns its place only while it is honest** — which is why the wording changes with the
state rather than always reading "source". Worth re-reading on a real phone before the care-tracker
port: if it crowds the card, the right answer is to show it only where the citation is real.

## Proposed, for Aaron to pick from

1. **"Try again" on a medication with no cached source (S).** One tap that re-runs the lookup, instead
   of the only route being re-saving a medication you did not want to edit. **Recommended** — it is
   the only dead end on the screen, and it matters far more than usual because the lookup may be
   failing for everyone, forever, and nobody would know to keep tapping Save.
2. **Show when the description was fetched (S).** `fetchedAt` is already stored and shown nowhere. A
   drug's official page can change; a line cached a year ago and never refreshed is quietly stale.
   Weaker than item 1 and adds a fourth line to a dense card. **Not recommended yet.**
3. **Refresh the cached description in the background when it is old (M). NOT recommended.** It sounds
   tidy and it is the wrong trade: background fetching on a patient's phone spends battery and signal
   on something nobody asked for, and a description that changes on its own between one look and the
   next is worse than one that is a year old. Raised only to record that it was considered and why it
   was refused.

## What this pass did NOT look at

Home, History, Reports and the backup flow are untouched by this release and were not walked.
`Bowel Movement` and `Appetite` report controls remain open from pass 05 (TASK-SHEET, QUEUED).
