# Designer — app-v94

**No layout, spacing, type, colour or control changed in this release.** It changes what the Up
next card and the dose ring *say*, not how either is drawn. Both already existed and both are
already covered by gates that run on every release.

## What was checked anyway, and why

The release changes the *frequency* of two states that were previously rare, so both were rendered
rather than assumed:

| State | Before this release | After | Checked |
|---|---|---|---|
| Hero absent, ring present | only when every window was already missed | now also when a dose was logged early and the rest of the day is missed | rendered at 390px, no overflow, ring legible |
| Ring showing a *lower* number than before | a double-logged window read as two covered | reads as one | rendered; the ring is the same 56px component, one digit either way |

`test/v94-window-coverage.mjs` renders Home in eight fixtures at 390px and fails on any console
error or warning; `overflow-scan` walks ten device widths; `contrast-scan` reads every string on
Home. All three are green on this build. Nothing here needed a measurement they do not already take.

## One thing worth saying out loud

**The ring can now show a smaller number than the same data showed yesterday.** A caregiver who
logged two doses into one window saw "2 of 2" before this release and sees "1 of 2" after it. That
is the honest number and the point of the change, but it will look like the app lost a dose. The
changelog says it plainly — *"The ring on Home counted two doses logged in one time slot as two
slots done. It counts the slots you have actually covered."* — and that is the right place for it.
No in-app notice beyond the changelog is proposed: a one-off banner explaining a counting change is
more alarming than the change.

## Exempt, stated

* Chromium only in this sandbox; an iPhone's rendering cannot be reproduced here.
* The missed-dose rows and History were not rendered — they are not on the screens this release
  touches, and `BACKLOG` M44 records that nothing renders them.
