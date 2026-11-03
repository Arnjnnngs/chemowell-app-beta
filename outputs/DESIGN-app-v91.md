# DESIGNER — app-v91 (the contrast release)

**Verdict: the palette holds at every width I can test. Twelve captures, three widths, four
screens, zero page errors. One defect confirmed at a real viewport — it is pre-existing and
already on the list.**

## It ran late. Second release running. That is the finding, not the apology.

`outputs/DESIGN-app-v90.md` opens with the same confession and the same cause: `release_check.sh`
puts the chain-report stage before the design-time stage and `stopped_early` hides whatever is
behind it, so both design-time seats get summoned by a gate instead of running before the build.
**Two releases, four late passes, one gate ordering.** Logged as a gate defect rather than written
off as discipline twice.

## Captured

`v91-{home,reports,history,weight}-{320,360,390}.png`, `deviceScaleFactor: 2`, the What's New
modal dismissed by its own hook first. Screenshots **sent to Aaron as produced**, not filed.

| | 320 | 360 | 390 |
|---|---|---|---|
| Home | ✓ | ✓ | ✓ |
| Reports menu | ✓ | ✓ | ✓ |
| Reports / History | ✓ | ✓ | ✓ |
| Reports / Weight | ✓ | ✓ | ✓ |

**Zero page errors at any width.**

## What the eye confirms that the number already said

Every string the contrast scan measures now clears AA, and the screens read as the scan claims:
the eyebrow, the title, the subtitle, the day headings and the small grey summaries are all
legible against the page rather than sinking into it. The page is still unmistakably warm — it
reads as tinted paper, not as white, which is the constraint Aaron set in his own words.

**Three widths genuinely test three things here**, unlike app-v90's chart pass where the drawing
scaled and the widths were one test at three sizes. This release changes the page itself, so every
card edge, chip, toggle and tile is re-composited at each width. Nothing reflows wrongly, nothing
clips, and the card-against-page separation survives the lighter background — the white cards still
read as raised, carried by their shadow rather than by the old colour gap.

## The one defect visible in these captures, and it is NOT this release's

At **320 and 360**, on the Weight report, the floating **Back** pill sits squarely over the
`AVERAGE` tile's value: in `v91-weight-320.png` the number behind it is unreadable. **This is a
real-viewport screenshot, not a `fullPage` capture** — which matters, because the app-v90 Designer
pass declined exactly this finding as a capture artifact and was wrong. It is `BACKLOG M36`,
measured independently at 88×7 px over the last list row at maximum scroll, pre-existing, and
queued.

Recording it again here for one reason: **this is the second seat to see it and the first one
declined it.** A finding that has been declined once needs the evidence attached the next time it
appears, or it gets declined again by the same reasoning.

## Not covered, plainly

* **No real device, no iPhone, no Safari.** Chromium only. Every colour figure in this release is
  Chromium's, and colour management and P3 are untested by definition.
* **Four screens of about twenty.** Settings, Calendar, Help, the medication editor, Upgrade,
  Setup, Bowel, Appetite, Radiation and the symptom reports are not captured — the same gap the
  Enhancer pass raises as E1 about the scan itself. Two of the five gradients this release repaired
  live on screens neither the scan nor this pass visits.
* **No interaction states.** Nothing hovered, focused, pressed or disabled. Rule 5.5's question is
  open for colour exactly as it is for layout, and the Enhancer pass raises it as E2.
* **Dark mode / system contrast settings.** Not captured; the app has no dark theme to capture.
