# app-v80 — the redesign, approved 2026-09-13

Aaron: *"I love the redesign with what's next instead of what was there."*

## THE WRITE MODEL, stated before any code (Rule 1.5)

**This release appends nothing. It deletes nothing. It reads no record it did not already read and
writes no record at all.** Every change is in the render layer: which element is drawn, where, and
in what colour. There is no migration, no new stored field, no change to the entry shape or to the
medication config, and no new `removeEntryDB` call of any kind.

That is the single most important sentence in this plan, because it is what makes a large visual
change *safe* in an app that has damaged a patient's record four times. **If any step below starts
needing a stored field, it stops being this release.** The one thing that will tempt it is the
timeline — see step 2.

## What ships, in order, each step independently revertable

1. **Tokens first, nothing else.** The palette becomes named custom properties and the gradient is
   demoted from the page background to the hero card only. No layout moves. This step alone is
   visible and shippable, and it is the one that makes everything after it small.
2. **The Today timeline.** Times down a left rail, doses taken checked and dimmed, the next one
   lifted. **It is derived entirely from `entriesFor()` and `medWindowsFor()`, both of which already
   exist and are already read by Home.** The temptation is to store a "scheduled dose" record so the
   timeline has rows for doses not yet taken; do not. A window that has not been used is already
   computable, and storing it would create a second source of truth about what is due.
3. **The "Up next" hero.** `status()` already answers *what is next and when*; the hero renders that
   answer instead of burying it. The ring is `doses logged today / windows today`, both derived.
4. **Vitals become three tiles** showing the last reading, with the input moving into a sheet on tap.
   The existing input handlers are reused unchanged — only where they live moves.
5. **Colour as meaning.** Terracotta for action, green for done, amber for due, red for a limit. The
   audit trail on this release should check one thing above all: **that nothing except a genuine
   limit warning is red afterwards.**
6. **The Meds empty state.** The real defect in the pass — today it is ~1,000px of blank gradient.
7. **Reports:** two summary figures first, day labels under every chart, and the 100.4 °F line with
   the sentence saying what it is for.
8. **The header, 320px → 56px.** Last, because it is the one that most changes what fits above the
   fold on every other screen, and doing it last means every earlier step has already been looked at
   in its final vertical position.

## The gates this release specifically needs

- **Designer, mandatory:** every touched screen at 320, 360 and 390, screenshots sent to Aaron as
  they are produced. This is the release the Designer role exists for.
- **Rule 5.5, the interaction class:** the redesign adds a vitals sheet, which is a sixth overlay.
  `harness/scrolllock-test.mjs`'s completeness check exists precisely to fail when a sixth is added
  without a lock. Expect it to go red and treat that as the check working.
- **Voice:** every new string. "Up next", "Log this dose", "Snooze", the empty state, the 100.4 °F
  sentence. The last of those is a clinical claim and must say *most care teams ask*, not *call your
  team* — the app does not know a given team's threshold.
- **Zero Day Auditor:** on the grounds of size, not of writing. The brief should say plainly that
  this release writes nothing, and ask it to prove that rather than take it.
- **`python3 pm.py` / `release_check.sh`** before and after, as always.

## Deliberately NOT in this release

The `Snooze` control in the mockup. It implies a stored snooze-until, which is a written record, and
this release writes nothing. It is a good idea and it is its own release.
