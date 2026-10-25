# Designer pass — app-v87

21 screenshots in `outputs/design-app-v87/`: seven screens at 320, 360 and 390, device scale 2.
Chromium only. **There is no iPhone in this sandbox, so Safari rendering is untested and is
written here as exempt rather than passed over.**

Two surfaces are new this release and both were captured: the Home bowel-issue banner with its
answer box (**07**), and a past row with the correction picker open (**08**).

## Horizontal overflow — clean

`document.documentElement.scrollWidth` measured on the same frame that was photographed:
**320/320, 360/360, 390/390 on all twenty-one.** No element's right edge exceeds the viewport.

## The correction picker at 320, which is where it would break

The open row shows the day and its standing answer, a hairline rule, the sentence *"Change this
day's answer. The earlier one stays in the record."*, then all five values wrapping onto two rows
with the current one outlined and tinted, then Cancel. **`Remove` is still there, below** — the
point of this release is that correcting ADDS a route, it does not replace the one that existed.
Every button clears the 44px floor (46px here).

The collapsed rows carry `Correct` and `Remove` side by side. At 320 a long date plus both
controls wraps the date onto three lines (*"Saturday, / Oct 24 — / Loose"*). Legible, nothing
clipped, and it is the narrowest phone in the matrix; at 360 and 390 it sits on one or two lines.
Acceptable, and recorded rather than discovered later.

## One note, not blocking

On the OPEN row, `Remove` renders below the value picker rather than beside the date, because the
picker is a full-width child of a wrapping flex row. It reads as slightly orphaned — a destructive
control sitting under a row of safe ones. Nothing is mis-tappable (it is a plain text button with
clear separation) but moving it back up beside the date when the picker is open would read better.
Backlog, not this release.

## Three screens not re-captured, and why

`03-history-summary` is **not in this set**. It fails to screenshot at device scale 2 within the
timeout — a long page, documented in app-v86's pass as an instrument limit rather than a defect.
**This release does not touch `renderHistory`**, so there is nothing new to look at there; saying
that is better than quietly shipping a set with three gaps in it.

## What the Voice reads on the new surfaces

*"Change this day's answer. The earlier one stays in the record."* — true, and it is the whole
behaviour in nine words. The banner's box now reads *"Change today's answer…"* in place of
*"Update status if back to normal…"*, which invited exactly one of five answers and is the likeliest
reason nobody noticed the others were short. The toasts distinguish a real change
(*"Changed to Diarrhea"*) from a re-pick of what is already there (*"Already logged as Diarrhea for
that day."*) — the second is the one that matters, because a control that silently does nothing is
indistinguishable from a broken one.
