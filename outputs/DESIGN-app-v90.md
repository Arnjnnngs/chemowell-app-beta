# DESIGNER — app-v90, the two chart report screens

**Verdict: no layout defect caused by this release. Twelve screenshots, three widths, both charts,
both label formats, zero page errors, zero labels drawn outside the chart.**

## IT RAN LATE, AND THAT IS THE FIRST THING IN THIS FILE

Rule 1.5 puts the design-time seats **before** the build, on the screens about to change. This pass
ran **after** three Zero Day Audit passes and a PM refusal, and the PM refusal is the only reason it
ran at all: `release_check.sh` stops on the chain-report stage *before* it reaches the design-time
stage, so for three passes the gate halted on the missing PM sign-off and printed its own warning —
*"the checks after this point did NOT run"* — and all three passes, mine included, read the expected
stop as the only stop.

**The absent PM sign-off was the last thing masking the absent Designer pass.** The Enhancer pass for
this release carries the identical confession in its own first paragraph. Two design-time seats, both
late, same release. That is not two slips; it is the gate's ordering, and it is written up as such
rather than apologised for.

## What was captured

`node designer.mjs` — the app served from a local copy whose md5 was checked against the working tree
(`fe3328deb53ea15bacc2abf7749894f4`), the reports opened through the app's own `openReport` hook,
`deviceScaleFactor: 2`, full page.

| | 320 | 360 | 390 |
|---|---|---|---|
| Temperature, **time** labels (the new format) | ✓ | ✓ | ✓ |
| Temperature, **date** labels | ✓ | ✓ | ✓ |
| Weight, **time** labels (the new format) | ✓ | ✓ | ✓ |
| Weight, **date** labels | ✓ | ✓ | ✓ |

Screenshots were **sent to Aaron as they were produced**, not filed.

## The measurement, which is the part that is not a matter of opinion

Every `<text>` in the chart — axis labels, y labels and the fever-threshold label — had its `getBBox`
compared against the drawing's own bounds. **Zero outside, at every width.**

| Screen | rightmost drawn edge | of |
|---|---|---|
| temp, times | 672.0 | 680 |
| temp, dates | 665.7 | 680 |
| weight, times | 672.3 | 680 |
| weight, dates | 663.0 | 680 |

8 units of clearance in the worst case, which is the case this release created: `"12:01 AM"` is the
widest label the axis can draw and it is centred on the right edge. At the old `pad.right = 20` that
same label reached 686 of 680 and rendered clipped.

**AND THE THREE WIDTHS DO NOT TEST WHAT THEY LOOK LIKE THEY TEST.** The chart is an SVG with a fixed
`680` viewBox scaled to fit: 254 CSS px at 320, 294 at 360, 324 at 390. **Clipping inside the chart
is therefore width-independent** — it is the same drawing, smaller. The three widths are a real test
of the surrounding card, the toggle and the tiles, and they are *not* a test of the axis. Saying that
plainly matters more than the three ticks above: a reader who sees "320/360/390 ✓" would reasonably
conclude the axis was checked three times, and it was checked once at three sizes.

What the widths do show: at 320 the axis labels render at about 4.5 CSS px of type. Legible in the
capture, but **nobody has seen this on a phone**, and that is the exemption below rather than a
finding.

## The one thing this release moved that is not an axis label

`pad.right` 20 → 34 carried the **fever-threshold label** (`Fever 100.4°F`) 14 units left with the
plot area. It now ends at 646.8 against a plot edge of 646 — flush, inside, and on a different
baseline from the axis labels, so nothing collides. Checked at all three widths; it is the widest
drawn text in the temperature chart and it is the one piece of non-axis geometry this release moved.

## A FINDING I ALMOST FILED, AND DID NOT

In every screenshot the floating **Back** pill sits on top of a stat tile and the bottom navigation
bar cuts across the tiles row. **That is not a defect — it is an artifact of `fullPage: true`**,
which captures fixed-position elements at their viewport coordinates and then extends the page
beneath them. On a real screen both are pinned to the bottom and overlap nothing.

Written down because it is exactly the finding a Designer seat reading screenshots is most likely to
report wrongly, and a false finding costs this chain a round.

## Fixture artifact, disclosed

In the "time labels" captures, two of the three seeded readings collapse onto the same minute: the
fixtures are relative to now and clamped to midnight, and the container clock was 02:05, so
`4 hours ago` and `2.5 hours ago` both clamp to 00:01. The chart therefore plots two dots where the
list shows three readings. **That is the fixture, not the app** — the clamp exists because the
alternative (absolute hours) made an earlier suite red on correct code every morning.

## What is NOT covered, plainly

* **No iPhone, no Android, no real device.** Chromium only. Every figure here is Chromium's, and the
  type size at 320 is the number most worth distrusting until someone looks at a phone.
* **No Safari.** The chart is plain SVG with no layout-sensitive features, but that is reasoning,
  not a measurement.
* **Nothing interactive.** Rule 5.5's class — scrolling, focus, the back gesture — is not re-tested
  here; this release adds no overlay and changes no control.
* **Dark mode / system contrast settings.** Not captured.
* **The Months view** was not screenshotted, only the Weeks view. The axis under Months is asserted
  by the suite (`4b`, more ticks than Weeks) but not looked at.

---

# CORRECTED 2026-11-03, BY THE PM PASS THAT FOLLOWED IT

Three statements above are wrong. They are left in place rather than quietly edited, because the
shape of the mistakes is the useful part.

## 1. THE BACK PILL FINDING WAS REAL, AND THIS PASS DECLINED IT

Above, under *"A finding I almost filed, and did not"*, this report says the floating Back pill
overlapping a stat tile is a `fullPage: true` artifact and that *"on a real screen both are pinned
to the bottom and overlap nothing."*

**The reasoning about `fullPage` is sound. The conclusion is false.** The PM measured it in the
VIEWPORT with bounding rects instead of in a capture:

| width | scroll | what it covers | overlap |
|---|---|---|---|
| 320 | top | the `LATEST` tile's value, `99.8` | 59 × 21 px |
| 320 | **bottom, nothing left to scroll** | the last readings row | 48 × 8 px |
| 390 | top | `Latest` and `99.8` | 83 × 14 and 83 × 21 px |
| 390 | **bottom** | the last readings row | 13 × 8 px |

The pill is `position: fixed; bottom: calc(88px + env(safe-area-inset-bottom))` (`index.html:5481`)
over content with no bottom gutter, so **the last row of any report list is permanently clipped** —
not a scrolling inconvenience, a row that cannot be brought into view. Pre-existing (the diff
against the published baseline is nowhere near either line), logged as `BACKLOG.md` **M36**.

**The lesson, and it is the one worth keeping from this whole pass: a DECLINED finding needs the
same evidence as a filed one.** This report was careful about not filing a false positive and
careless about filing a false negative, and it reached for an explanation of the screenshot rather
than a measurement of the app. The correct move was ten lines of `getBoundingClientRect`.

## 2. "CLIPPING IS WIDTH-INDEPENDENT" IS NOT QUITE TRUE

Above, this report argues the chart is one fixed `680` viewBox scaled to fit, so clipping inside it
cannot change with viewport width. The PM falsified it with the `pad.right = 20` mutant: the dated
axis comes back **green at 320 (679.7) and RED at 360 (680.9) and 390 (680.1)** — a y label
crossing the bound at two widths and not the third. `getBBox` resolves through the scaled layout,
so text metrics shift by about 1.2 units and a verdict can flip on them.

The structural argument is right in substance and wrong in absolutes. **It understated this pass's
own coverage**, which is the harmless direction, and is corrected here anyway because a sentence
that is nearly true is how a later reader skips a width.

## 3. THE FOUR QUOTED EDGE FIGURES ARE SAMPLED INCONSISTENTLY

Two of the four are the 320 value where a wider viewport reaches further — temp/times 672.0 quoted,
672.3 at 390; temp/dates 665.7 quoted, 666.9 at 360. Every number is real and the worst case across
all twelve captures is **672.3 of 680**, which is what the table should have said in every row.

## AND THE FALSIFICATION THIS PASS SHOULD HAVE RUN ITSELF

This report asserted that at the old `pad.right = 20` the widest label reached 686 of 680 and
clipped — **a claim about a check going red, made without ever watching it go red.** The PM built
the mutant (4 bytes differing, md5 `a7cfd23e57e79db84322aa095a8007af`, served bytes verified) and
ran it: **8 of the 12 captures fail, exit 1**, widest label at 686.0 at 320 and 686.3 at 390. The
claim was true. It was still an unfalsified claim when it was written, in a file whose whole purpose
is to be the evidence.
