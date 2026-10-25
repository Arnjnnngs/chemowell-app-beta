# Designer pass — app-v86

18 screenshots in `outputs/design-app-v86/`: six screens at 320, 360 and 390, device scale 2.
Chromium only. **There is no iPhone in this sandbox, so Safari rendering is untested and is
written here as exempt rather than passed over in silence.**

Screens: the Bowel Movement report, the Appetite report, the History day summary, Home with the
Up Next card, the Settings profile row, and the Settings profile row with the rename field open.

## Horizontal overflow — clean

`document.documentElement.scrollWidth` measured on every screen at every width: **320/320,
360/360, 390/390 on all eighteen.** No element's right edge exceeds the viewport. The check is
in the capture script, so it ran on the same frame that was photographed rather than on a
separate load.

## What the new logger card looks like at 320, which is where things break

The five bowel values wrap onto two rows (`Normal` / `Very little`, then `None` / `Loose` /
`Diarrhea`) with even gutters and no clipping. Every button is 46px tall against a 44px floor.
The caption underneath — *"Picking again replaces today's answer. The earlier one stays in the
record."* — wraps to two lines and still clears the history heading below it. The state line
reads *"Sunday, Oct 25 · nothing logged yet"* and switches to *"· currently Diarrhea"* once a
value is picked, so the card says what it holds without needing the history list.

Appetite is the same card with three values on one row.

## The Settings profile row

The active row now reads `Alex Morgan` · `Active` · `Rename`, which fits at 320 with the pill and
the button side by side. Opening rename drops an input plus `Save name` and `Cancel` directly
beneath the list. Touch targets are 44px and 48px.

**One note, not blocking.** The rename field renders below the whole profile list rather than
inside the row it edits. With one profile — the Free case, and the case Aaron reported — it sits
directly under that row and reads correctly. With two or three profiles it is visually detached
from the name it is changing. Worth moving into the row when rename grows to cover non-active
profiles; it is a layout change with no behaviour attached, and it is on the backlog rather than
in this release.

## Found while looking, and NOT caused by this release

Home rendered **"20751 missed doses from previous days"** in these captures. That is the Designer
fixture's doing — it carries `installedAt: 1`, i.e. 1 January 1970, copied from the app-v85 suite
— so it is not a reproduction of anything a real user has seen. **But the app clamps nothing**:
the missed-dose walk runs from the install date with no upper bound, so a corrupted or
mis-migrated `installedAt` would put an absurd number in a red banner at the top of Home.
care-tracker solves the same problem with a `MISSED_TRACK_SINCE` floor. Logged as its own task,
deliberately not fixed here.

## Capture notes, because two instrument faults had to be fixed first

1. **The screenshots hung on "waiting for fonts to load."** The app pulls Capacitor from a CDN
   this sandbox cannot reach, and `page.screenshot()` waits on outstanding requests. The capture
   script now aborts every request that is not loopback — the same rule the project's own suites
   use for safety.
2. **The History screen then failed at all three widths while the other five succeeded**, which
   looked like a defect on that screen and was not: a long page at device scale 2 simply exceeds
   the default 30-second screenshot timeout. Raised to 60s and all three captured. Worth writing
   down, because "one screen fails and the rest pass" is exactly the shape that gets mistaken for
   a finding.
