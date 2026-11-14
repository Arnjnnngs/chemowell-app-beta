# Designer — ChemoWell app-v95

## What changed visually

**Nothing is drawn differently.** No layout, no control, no colour, no copy on any screen except
one new What's New entry. The change is to *when* the page redraws, not to what it renders.

So the usual pass — every touched screen at 320, 360 and 390 — has nothing new to measure, and
saying so is the honest output rather than producing screenshots of an unchanged screen.
`overflow-scan` (171 checks across ten device widths) and `contrast-scan` (327) both run in the
gate on this build and are the standing guard for that claim.

## The one thing a reader WILL notice, and it is intended

**The confirmation message now lingers while a sheet is open.** Before, it vanished 4.5 seconds
after a log, full stop. Now, if a sheet is open when those 4.5 seconds are up, it waits and goes
within about 600ms of the sheet closing.

| | before | after |
|---|---|---|
| Log a dose, do nothing | toast for 4.5s | unchanged |
| Log a dose, open another sheet | toast vanishes mid-edit **and takes the open field with it** | toast stays behind the sheet, goes when it closes |

Behind a sheet the toast sits under the scrim at the bottom of the screen, so for most of that time
it is dimmed rather than prominent. A caregiver who closes a sheet after two minutes sees the
message for a fraction of a second before it goes. That is slightly odd and much better than the
alternative, which was the field closing under their finger.

## What is deliberately exempt

* **No iPhone.** This sandbox has Chromium only; an iOS rendering cannot be reproduced here. That
  exemption is on every release and it is on this one.
* **No real device.** The defect's whole mechanism — a destroyed `<input type="time">` dismissing
  Android's system clock dialog — can only be *inferred* here. What the suite measures is the node
  being destroyed, which is the cause; the dialog closing is the effect, and it needs a phone.
  **This is the one thing Aaron has to check himself**: log two doses in a row and adjust the time
  on the second.
