# Designer — app-v93: the drawer profile rows, the menu count, the silenced state

Rendered, not reasoned about. `falsify/probe-drawer-profiles.mjs` opens the drawer at four widths
with a deliberately hostile fixture — a 27-character hyphenated name, a two-character name, a
profile with **no name at all**, and a 12-dose count so a badge sized for "1" is shown "12".
Screenshot at `outputs/drawer-profiles-320.png`.

## Measured

| width | drawer | row height | switch target | silence target | text overflowing | truncated | under 44px / under 10px |
|---|---|---|---|---|---|---|---|
| 320 | 269px | 56px | 201x56 | 44x44 | **0** | name ellipsised, 115px hidden | **0** |
| 330 | 277px | 56px | 209x56 | 44x44 | 0 | 107px hidden | 0 |
| 360 | 302px | 56px | 234x56 | 44x44 | 0 | 82px hidden | 0 |
| 390 | 320px | 56px | 252x56 | 44x44 | 0 | 64px hidden | 0 |

No page side-scroll at any width. Every touch target clears the 44px floor on the narrowest
supported phone, including the silence button, which is the smallest control added.

**A note on the "overflow" column, because the first run of this probe reported 115px of it.**
The probe did not know the difference between text that escapes its box and text that is correctly
ellipsised inside a `overflow: hidden` box. `overflow-scan.mjs` has carried a `clipped` guard since
it was written; this probe needed the same one. The long name is truncated with an ellipsis, which
is the intended behaviour, and the number of hidden pixels is now reported separately so a name
that silently disappears would still show up here.

## Findings

**D1 — at 320px the active row's status wraps to two lines ("12 doses due / now") while the other
rows are one.** The row stays 56px and nothing is clipped, but three rows of a list where one is
visually denser than the others is the kind of unevenness this bar is meant to catch. The cause is
the longest status string meeting the narrowest drawer. **Recommendation: shorten the string to
"12 due now" at every width** — it says the same thing, fits on one line at 320px, and removes the
only ragged row. Size: S. Not done in this release because the Voice has not read it and a copy
change made at the end of a build is how v64 through v66 shipped four false changelog entries in a
row.

**D2 — the identity header and the first profile row both show the active person's name**, one
ellipsised to "Bartholomew F…" and the other to "Bartholome…". Redundant on a phone where the
header is the only thing above the list. It is kept: the header carries the plan badge and is
non-interactive by v54's explicit decision, and the row carries the count and the bell. Removing
either would cost a function. **Nothing this time**, written down so it is a decision.

**D3 — an unnamed profile renders as "Profile 3" with the initial "P".** Correct and deliberate —
`profileNameById` numbers by position rather than falling back to a generic word, because three
profiles all reading "Patient" would reproduce the exact defect this release exists to fix. Worth
stating that the initial is then "P" for every unnamed profile, which is the one place the numbering
does not reach. Size of a fix: S. **Recommendation: leave it** — the name beside it disambiguates,
and an initial is decoration here, not identification.

**D4 — the two-digit count fits.** "12" renders in a 22px pill with its 6px padding and does not
push the bell off the row at 320px. Checked because a badge designed around "1" is a badge nobody
has shown a real number to.

## The silenced state

Measured in `test/v93-profile-notifications.mjs` rather than here: the bell becomes a struck-through
bell (a real icon — `svgIcon` falls back to a HOUSE for any unknown name, so this was asserted
explicitly), the count disappears from that row, the status line reads "Reminders off", and
`aria-pressed` flips. The row keeps its height, so silencing does not reflow the list.

## Exempt, and said out loud

* **This sandbox has Chromium only.** An iPhone's rendering cannot be reproduced here. The 320px
  and 390px columns are Chromium at Apple viewport sizes, not Safari.
* **The app-icon badge is not rendered by this app** and cannot be screenshotted here. It depends
  on the Badging API — present on an installed PWA, absent in a plain tab and in today's APK, which
  has no badge plugin. That is why the count also sits on the menu button, which the app does draw.
  **Aaron's phone is the only place the icon badge can be confirmed.**
* `missedRow` and the History row are not on this screen and were not rendered here.
