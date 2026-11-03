# PM sign-off — app-v90, second pass. The refusal is cleared.

AUDITED-COMMIT: 8dd2e3c65323967e6c6bd22d8163578a418a78e1
VERDICT: SHIP

## The headline

`outputs/PM-app-v90.md` refused this release on exactly one thing: the Designer seat had produced no
report. **That file now exists, and it is a real pass rather than a file that makes a gate shut up.**
I did not take it on trust — I ran its script against the shipped bytes, then built the mutant its
falsification claim names and watched the check go red. It goes red. The two record corrections my
predecessor asked for are in, and I re-measured both rather than reading them.

**One thing in the Designer's report is wrong**, and it is wrong in the direction that matters: the
floating Back pill DOES overlap visible content on a real 320px viewport. The report waves it away as
a `fullPage: true` artifact and it is not one. It is pre-existing — byte-identical on the published
app-v89 baseline — so it does not block this release, but it is a false statement in a chain report
and it is logged as **M36** rather than left in the record.

Nothing in `index.html` or `sw.js` has moved. `index.html` md5 is still
`fe3328deb53ea15bacc2abf7749894f4`, equal to the bytes served on :8899 before every run below, and
`git diff 9f2259c 8dd2e3c` touches **no rule-5 path** — I verified that myself: the diff is
`BACKLOG.md`, `README.md`, `outputs/DESIGN-app-v90.md`, `outputs/PM-app-v90.md`, and
`test/v90-designer-pass.mjs`. So the three Zero Day passes and every figure in the first PM report
stay valid, and this is a delta sign-off, not a fourth audit.

## 1. Is the Designer pass real? — measured, and its check can fail

**I ran `test/v90-designer-pass.mjs` against the shipped file.** Twelve captures, **0 page errors, 0
labels drawn outside the chart, exit 0.** The structural numbers reproduce exactly as the report
states them: a fixed `680` viewBox rendering at **254 CSS px at 320, 294 at 360, 324 at 390**.

Rightmost drawn edge, every combination I measured (the report quotes one figure per screen):

| screen | 320 | 360 | 390 |
|---|---|---|---|
| temperature, time labels | 672.0 | 671.1 | **672.3** |
| temperature, date labels | 665.7 | **666.9** | 666.1 |
| weight, time labels | 672.0 | 671.1 | **672.3** |
| weight, date labels | 661.8 | **663.0** | 662.2 |

Worst case across all twelve is **672.3 of 680 — 7.7 units of clearance**, so the report's "about 8
units" is right. **Two of its four quoted figures are not the worst case for their row**, though:
it quotes 672.0 for temperature/times (the 320 value, when 390 reaches 672.3) and 665.7 for
temperature/dates (the 320 value, when 360 reaches 666.9). Every number it prints is a real
measurement; the sampling across widths is just inconsistent. Immaterial to the conclusion, recorded
because this project has been hurt by figures written as properties when they were snapshots.

### The falsification — nobody had watched it fail, and now someone has

I built the `pad.right = 20` mutant as a byte copy: both sites (`index.html:11570` temperature,
`:12554` weight) changed from `right: 34` to `right: 20`, **4 bytes differing and nothing else**
(`cmp -l` = 4), md5 `a7cfd23e57e79db84322aa095a8007af`, served on :8899 and the served md5 checked.

**The check goes red: 8 of 12 captures fail, `labels drawn outside the chart: 8`, exit 1.** And the
report's specific claim reproduces to the digit — the widest axis label reaches **686.0 of 680** at
320 and **686.3** at 390, against the report's "reached 686 and rendered clipped". The Designer pass
is not decorative.

### And its own self-limiting claim is slightly wrong — in the safe direction

The report says clipping inside the chart is **width-independent**, because the chart is one fixed
drawing scaled to fit, so "the three widths are *not* a test of the axis". **The mutant shows that is
not quite true.** In the dated-axis fixture the mutant is **green at 320 (679.7) and RED at 360
(680.9) and 390 (680.1)** — a y-axis label, `100.6`, crossing the bound at two widths and not the
third. `getBBox` resolves through the scaled layout, so text metrics shift by up to ~1.2 units across
widths and a verdict really can flip. The three widths carry slightly more discriminating power than
the report credits itself with. It overstates its limits rather than its coverage, which is the
harmless direction, but it is still inaccurate and is recorded here.

## 2. The Back pill — the Designer's one declined finding, and the call was WRONG

The report declines to file the Back pill overlapping a stat tile, on the grounds that it is an
artifact of `fullPage: true`, and states: *"On a real screen both are pinned to the bottom and
overlap nothing."* **The reasoning about `fullPage` is sound and the conclusion is false.** I
measured it in the VIEWPORT, not in a full-page capture, with element bounding rects rather than by
eye (`backpill-probe.mjs`, in my scratchpad; findings reproduced below).

The pill's wrapper is `position: fixed; z-index: 36; bottom: calc(88px + env(safe-area-inset-bottom))`
(`index.html:5481`) and the page body has **`padding-bottom: 0`**, so nothing reserves space for it.
The pill occupies viewport y 714–756 at every width. Overlaps with visible text:

| width | scroll | what the pill covers | overlap |
|---|---|---|---|
| 320 | top | the `LATEST` tile's value `99.8` | 59 × 21 px |
| 320 | **bottom (235/235, cannot scroll further)** | the last readings row, `Tue, Nov 3 · 12:01 AM` | 48 × 8 px |
| 390 | top | the `Latest` label and its value `99.8` | 83 × 14, 83 × 21 px |
| 390 | **bottom (248/248)** | the last readings row | 13 × 8 px |

The second row of that table is the one that matters: at maximum scroll the **last** reading in the
list is permanently clipped by the pill and there is no further scroll available to clear it. That is
a missing bottom gutter, not a capture artifact.

**I falsified my own probe before believing it.** Moving the pill's wrapper off-screen
(`left: '-900px'`, md5 `aa3f9c913b3aff4358e0dd95c6c2d7e8`) takes the same probe from 4 overlaps to
**0**, so it is capable of coming back clean.

**It does not block, and here is why, checked rather than assumed.** `git diff a5d5908 HEAD --
index.html` has hunks only at 9307 (version), 9330 (changelog), 9461 (the What's New hook), 11423
(the two shared axis helpers), 11562–11601 and 12549–12604 (the two chart call sites) and 13658 (the
test hook). **Nothing within 6,000 lines of the pill or the page padding.** It is present in the
published app-v89 build exactly as it is here. Logged as M36.

## 3. The two record corrections — re-measured, not read

**`v90 151/151` → `162/162`. Correct now.** I ran `test/v90-chart-axes.mjs` myself:
**162/162 under `TZ=Etc/UTC`** and **162/162 under `TZ=America/Chicago`**, exit 0 both. Both
authoritative statements in `README.md` now read 162. The two surviving `151/151` strings in that row
are historical narrative — *"145/151 … against 151/151 seventy-seven seconds earlier"* and the row's
own account of the error — and both are correct as history.

**`v87-correct-a-past-day`'s DST defect, written up as M35. The whole claim rests on it being
pre-existing, so I re-measured the claim and then the baseline.**

| | HEAD (`fe3328de`) | published app-v89 (`a5d5908`, md5 `a9de408cec59efb2bc8b8df44a750cc0`) |
|---|---|---|
| `TZ=Etc/UTC` | 64/64 | 64 checks, 1 red (the README self-check only) |
| `TZ=America/Chicago` | **43/51** | **43/51 — identical** |
| `TZ=America/Phoenix` | 64/64 | — |

**Identical on the baseline, so it is not a v90 regression.** The Phoenix reasoning holds and I spot-
checked the arithmetic rather than accepting it: at the container's clock the local date is Mon Nov 2
in *both* Chicago and Phoenix, and Phoenix has no daylight saving. Chicago's midnight on Nov 2 is
Nov 2 06:00 UTC; subtracting a fixed `2 * 86400000` lands on Oct 31 **01:00** local, not midnight,
because the Nov 1 fall-back makes that interval 49 hours. In Phoenix the same subtraction lands
exactly on midnight. That is precisely the mechanism M35 describes, and M35's figures match mine row
for row.

## 4. What my predecessor left open, and what I did about it

**`overflow-scan.mjs` — now run, and the pre-existing claim is now PROVEN rather than asserted.**
Against HEAD: `170 of 170 screen/width combinations scanned, 3 overflowing element(s)`, NOT CLEAN —
all three the same `"10:00 AM"` div on Home at 320px, over by 5px, not an SVG axis label. Against the
published app-v89 baseline with `--file`: **the identical three hits, same element, same 5px.** So
pass 1's NOT CLEAN result is formally pre-existing and this release neither caused nor worsened it.
It is not new work for this release; it is the Home card, not the charts.

**The gate-ordering excuse — accurate.** The Designer's report blames `release_check.sh` for putting
the chain-report stage before the design-time stage. It does: the chain-report stage begins at line
434 and ends in `stopped_early` at 513; the design-time stage starts at 515. A missing PM sign-off
therefore hides a missing Designer pass, exactly as described, and the script's own header comment
already logs that class as M25. The account is honest and the Enhancer's identical confession for
this release corroborates it.

## 5. The gate

`./release_check.sh` run before this file existed stopped at
*"a chain report refuses this release, and nothing supersedes it — outputs/PM-app-v90.md examined
9f2259c"*, which is the standing refusal and is cleared only by this stage re-running against a later
commit and saying SHIP. This file examines `8dd2e3c`, a descendant of `9f2259c`, and says SHIP. The
complete raw output of the run that includes this file is in my report to Aaron.

## 6. What I did NOT check, plainly

* **The chart drawing code line by line.** Three Zero Day passes did that against byte-identical
  bytes. I wrote two mutants only — the `pad.right` one the Designer's claim names, and an off-screen
  control for my own probe — and re-ran suites rather than re-reading logic.
* **Any real device.** Chromium only, at Apple's viewport sizes for the iOS rows. Nobody has seen
  either chart on a phone, and at 320 the axis type renders at about 4.5 CSS px. That exemption is
  stated in the Designer's report and I am repeating it rather than clearing it.
* **Safari / WebKit font metrics, dark mode, the Months view**, all named as uncovered by the
  Designer and all still uncovered.
* **Rule 5.5's interaction class.** This release adds no overlay and moves no control, so nothing new
  to scroll behind — but I did not re-run `scrolllock`-style cases.
* **The sibling repos.** `care-tracker` is a live patient's app, I have no authority there, and I
  touched nothing in it.
* **Whether the Enhancer's four proposals are right.** Aaron's call, already logged.

I made no change to any rule-5 path. I have no authority to push to `main` and did not. This file and
the M36 entry in `BACKLOG.md` are the only things I wrote.
