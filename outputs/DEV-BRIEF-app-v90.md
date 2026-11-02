# Developer brief — app-v90: chart axes, and the title hook v89 deferred

## What Aaron reported

> *"Chart x-axes repeat dates and run into the future"*

Both halves are real, both come from the **same six lines**, and those six lines exist **twice** —
in `renderTemperatureReport` (~11480, ~11495) and in the weight chart (~12464, ~12498). Measured,
not assumed: `grep` for `tMin + DAY` returns exactly two sites and `grep` for the `M/D` label
construction returns those same two plus an unrelated full-date formatter at 4240. **Two instances,
one class.** Whatever is written must be written once and called twice, or it drifts — this project
has the scar from bowel values and Help enumerations.

## The defect, exactly

    const tMin   = points[0].ts;
    const tMax   = Math.max(points[points.length - 1].ts, tMin + DAY);
    const tRange = (tMax - tMin) || DAY;
    // then 5 (weeks) or 7 (months) labels at even fractions of tRange, each formatted M/D

**(1) Runs into the future.** `tMax` is floored at `tMin + DAY`. One reading this morning, or three
in one morning, makes the right-hand edge 24 hours after the **first** reading — so the axis is
labelled with tomorrow. The chart shows a day that has not happened.

**(2) Repeats dates.** Labels are always M/D and always evenly spaced across the span. A short span
— today's readings, or two days in hospital — puts the same calendar day under four or five ticks:
`10/31 10/31 10/31 11/1 11/1`.

## The decision the diagnosis left open, and the call

Should ticks sit on **calendar boundaries** (midnights) rather than at even fractions?

**No — even fractions, with the format chosen from the span.** Boundaries make repeats impossible by
construction, which is attractive, but they move the end labels off the data edges: a reader looking
at a 10-day chart would see the first tick before the first reading and the last after the last one,
and on a span under a day there is no interior boundary at all, so it degenerates to one tick or
none. Keeping the ticks on the data and fixing the *format* solves both reported symptoms without
changing what the x-axis means.

## The fix

One module-scope helper, `timeAxisLabels(tMin, tMax, count, x)`, used by both charts:

* **Format from the measured span**, because the thing that varies is not always the date:
  under 3 hours → `9:05 AM`; under 2 days → `9 AM`; otherwise → `10/31`.
* **Never draw the same label twice in a row.** Belt and braces with the format rule: a 6-day span
  across 7 ticks still collides, and dropping the repeat is always right.

And at both call sites:

    const tMax = Math.max(lastTs, Math.min(tMin + DAY, simNow()));

`simNow()` rather than `Date.now()`, because `TEST_MODE` date overrides must move the axis too. The
`Math.max(lastTs, …)` is load-bearing in the one direction that matters: **the data always fits.**
If a reading is somehow later than "now" — a simulated future date — the axis still reaches it
rather than cropping a reading out of the chart.

## Also in this release: F1, deferred from app-v89 by the PM

The app-v89 clearing audit found that `test/v89-everything-free.mjs`'s title check can go vacuous:
it reads the title as `innerText.split('\n')[1]`, a **text-position selector**, which Rule 5
forbids. Emptying the notice's "Updated" badge makes the extracted "title" the date string, and the
check's own precondition accepts it. The PM named it the first job of v90 because it is the
`|| true` shape this repo has shipped before. Fix: a `data-whatsnew-title` hook on the title node
(9455), and the check asserts against that.

It is folded in here rather than released alone so one audit covers both.

## The write model

**This release writes nothing.** No storage key, no entry shape, no new field. Both changes are
render-time only: an axis label list, and one `data-` attribute. The Zero Day question "what can
this destroy?" has the answer "nothing", so the risk is entirely *wrong output* — an axis that
misrepresents when a reading was taken, which on a temperature chart is a clinical misread.

## Done means

A single reading today: no label after today, and the labels are distinct times. Three readings in
one morning: distinct labels. Four weeks of readings: unchanged from today's behaviour. Both charts
identical in all of it, driven through the real Reports screens. New suite, falsified on both halves
separately, plus a mutant restoring each old line.
