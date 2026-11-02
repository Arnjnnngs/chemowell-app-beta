AUDITED-COMMIT: a7bd9c8
VERDICT: SHIP

# Zero Day Audit — app-v90 (chart axes, plus F1)

Both halves of what Aaron reported are genuinely fixed, in both charts, from one shared pair of
functions. The release writes nothing, deletes nothing, and no reading can be pushed outside the
drawn area — I checked that by comparing every plotted point's computed `cx` against the plot
rectangle rather than by looking at a picture. Eight findings below, none of them a reason to hold
a fix for a chart that currently mislabels when a fever was taken. Two of them (F2, F3) put a wrong
or cut-off thing in front of a caregiver and should be the first items of app-v91.

**This pass was interrupted.** The container was restarted roughly two-thirds of the way through.
Everything that the verdict rests on was re-run afterwards against the restarted server and is
marked RE-RUN below; a few lower-weight observations are marked PRE-RESTART and were not repeated.
Repo clean at the audited commit throughout; `index.html` md5 `ed166b9a3a5aa3056fa87ba635f2db24`,
and the server on 8899 was verified to be serving exactly those bytes before and after.

---

## Findings

### F1 — HIGH (process). `test/v90-chart-axes.mjs` is 29/29 only after ~11:00 local. It reds 23/29 every morning.

**RE-RUN after the restart.** Sections 1 and 2 seed readings at `todayAt(9)` and `todayAt(7/9/11)`.
Run the suite when the local clock is earlier than those hours and the fixture is dating readings
in the **future**, which this release deliberately lets through (`Math.max(lastTs, …)`). Then:

* section 1's single reading has `tMax === tMin`, so the axis collapses to one label —
  `1.temp.2` and `1.weight.2` fail on `labels.length >= 3`;
* that one label, `9:00 AM`, is later than now, so `1.temp.1` and `1.weight.1` fail;
* section 2's 7/9/11 AM readings are all still ahead, so `2.temp.2` and `2.weight.2` fail.

Reproduction, with the only change being a `timezoneId` on the suite's contexts so the browser and
node share an early-morning zone (the app file is untouched):

    FAKE_TZ=Asia/Kolkata TZ=Asia/Kolkata node <copy of the suite>   ->  29 checks: 23 passed, 6 failed

Confirmed at 03:07 IST, 03:38 Dhaka and 04:38 Bangkok before the restart and again at 04:05 IST
after it; identical six failures every time. Green only from about 11:01 local onwards.

**Why it matters.** This project's standing rule is that a check must be able to fail for the right
reason and only for the right reason. A suite that goes red on correct code because of the wall
clock is the mirror image of `|| true`: the next session to run it at 3am sees six red lines about
the chart axis and either chases a defect that is not there or learns to ignore the suite. It is
not caught by `release_check.sh`, which only runs `v75-no-other-patient.mjs`, so it will surface as
a surprise rather than as a gate.

**Fix (small).** Make the fixtures relative to the clock, not to a fixed hour: `now - 3h` instead
of `todayAt(9)`, `now - 5h/-3h/-1h` instead of 7/9/11. Nothing about the cases is lost and they
stop depending on when someone runs them.

### F2 — MEDIUM. The de-duplication's stated invariant is false, and the real app still prints a repeated date.

The comment at `index.html:11450-11452` says *"Dates are monotonic, so any duplicates among them
are adjacent and the de-duplication below removes them"*. That holds only while the span is under
about a year. `M/D` carries no year, so two ticks a whole year apart render the same string with
other labels between them, and the de-duplication only drops a label equal to its **immediate**
predecessor.

**RE-RUN after the restart**, driven through the real weight report:

    365d apart, weeks  -> ["7/25","10/25","1/24","4/25","7/25"]   duplicate survived
    730d apart, weeks  -> ["7/25","1/24","7/25","1/24","7/25"]    duplicate survived
    1095d apart, months-> ["7/26","1/25","7/25","1/24","7/25","1/24","7/25"]

The 730-day axis reads `7/25, 1/24, 7/25, 1/24, 7/25` — an x-axis repeating dates, which is
literally the complaint this release answers, surviving at a longer span.

**How a caregiver reaches it.** Only through the weight chart. `renderWeightTrend` (12517) still
keeps the old fallback `points = filtered.length > 0 ? filtered : weightEntries.slice(-2)`, which
has no date bound — so if nothing has been weighed in 90 days, the chart silently draws the last
two weights ever, however old, under a heading that still says "Last 4 weeks". The temperature
chart is immune: 11524-11536 deliberately removed exactly that fallback and shows an empty-state
instead, with a comment explaining that presenting old readings as this month's is the one false
impression on these screens with a clinical consequence. **The two charts are identical in the six
lines this release shared, and still divergent in the lines right above them.**

**Not a regression** — the old code was always `M/D` too, so this span was equally wrong at
app-v89. It is listed here because the release claims the repeats are gone and the comment asserts
an invariant that does not hold.

**Fix (small).** Either include the year in the date format once the span passes ~300 days, or
de-duplicate against every label already emitted rather than only the previous one. The second is
one character of change (`out.some(...)` for `out[out.length-1]`) and is strictly safe, because
positions are kept per label. Separately, and worth its own task: give the weight chart the
temperature chart's empty-state instead of `slice(-2)`.

### F3 — MEDIUM. The right-hand axis label is clipped when it is a two-digit time. Introduced by this release.

**RE-RUN after the restart.** The last tick is drawn centred on x=660 inside a 680-wide viewBox,
leaving 20 units for half a label. `10/31` needs 18 and just fits. `10:36 PM` needs 29:

    "10:36 PM" x=660.0  bbox=[631.2..690.0]  viewBox=[0..680]   clipped

Measured on both charts at 320px and 390px. A screenshot of the temperature chart with four
readings over 40 minutes is at
`/tmp/claude-0/-home-user/41e5d279-40d0-5a8a-b4e0-827057dd9522/scratchpad/audit90/axis-clip.png`
and renders the final label as **`10:09 P`** — the "M" is cut off.

**When.** Same-day span under 3 hours (so the minute format is chosen) whose right edge falls in a
10, 11 or 12 o'clock hour. That is a caregiver taking temperatures every half hour during a fever
late in the evening — precisely the case this release exists to serve. Cosmetic rather than a
misread: the time is still readable. But it is a new visible flaw, in the new code path, in the
scenario the release is named for.

**Fix (small).** `pad.right` 20 -> 34 on both charts, or clamp the last label's x so its box stays
inside the viewBox.

### F4 — MEDIUM (suite). Four of my ten mutants survived 29/29, and they name four real holes.

All ten were built from the audited `index.html`, served on ports above 9800, and each server's
md5 verified against its own file before use. The six results below were re-verified after the
restart from the same mutant files (md5s unchanged).

| Mutant | What it breaks | Result |
|---|---|---|
| `A1` `sameDay = true` always | restores the builder's first wrong format rule | **6 red** |
| `A2` drop `Math.max(lastTs, …)` | a reading later than "now" is cropped out of its own chart | **4 red** |
| `A8` `data-xaxis` removed from the weight chart only | the copied-defect shape | **11 red** |
| `A10` only the two end ticks emitted | a useless axis | **8 red** |
| `A3` drop the `tMin + AXIS_DAY` cap | right edge always "now" | **survived** |
| `A4` `dayOf` in UTC instead of local | midnight decided in the wrong zone | **survived** |
| `A5` `count` hard-coded to 4 | Weeks/Months tick count ignored | **survived** |
| `A6` minute format disabled | hour labels on a 20-minute chart | **survived** |
| `A7` every label drawn one tick to the right of its own time | the axis lies about position | **survived** |
| `A9` de-duplication keeps the last of a run, not the first | labels drift right of their time | **survived** |

The four that matter:

* **`A7` and `A9` survive because the suite never asserts where a label is drawn** — only its text.
  An axis is a claim that this label sits over that time, and nothing in 29 checks tests that claim.
  `data-xaxis` already carries the `x` attribute, so asserting it is cheap: for each label, recover
  the timestamp its text names and require `|x(ts) - x_attr|` to be within a tick.
* **`A5` survives because no case ever switches the range toggle to Months.** The `4 : 6` argument
  — one of the two inputs to the new function — is entirely untested. A Months case on each chart
  closes it.
* **`A6` survives because the minute-format branch is only reachable by the suite between 09:00 and
  12:00 local**, and in that same window F1's checks are failing. In practice that branch ships
  unexercised. A fixture pinned to `now - 40 minutes` covers it at any hour and also fixes F1.
* **`A3` survives** because nothing distinguishes "right edge = min(first reading + 24h, now)" from
  "right edge = now". Both are defensible; the suite should say which one the product means.

Separately, `4.<chart>.2` is vacuous on an empty set — `new Set([]).size === [].length` and
`futureOnes([])` is empty — and it passed on zero labels under `A8`. The section's own `.0`
precondition catches it, so the section as a whole still reds, but the individual check does not
carry a count guard the way `1.x.1`, `2.x.2` and `3.x.2` do. The file's header claims every section
asserts the count first; that is true per section, not per check.

### F5 — LOW (copy). "labelled" is British, and it is the first British spelling the patient sees.

The new CHANGELOG bullet (`index.html:9333`, rendered and read in the notice, not in source) says
*"A single day is **labelled** by the hour now"*. The file has nine "labelled" and four "labeled" —
**every one of them in a code comment.** This is the first in user-facing copy. The app is
American throughout (Fahrenheit default, `M/D` dates, and `v57-search` explicitly pins "liters" as
the spelling with "litres" only an invisible search alias). One character: `labeled`.

### F6 — LOW (copy). Two small over-claims in the same entry.

* *"They now stop at today."* They stop at today unless a reading is **dated** after today, which
  the app supports: the time sheet warns "This time is in the future. Press Confirm again to log it
  anyway" (`index.html:5843`) and the Help topic `log-wrong-time` describes it as deliberate. With
  such a reading the weight axis renders `["11/2","11/3"]` — tomorrow, on purpose, because
  `Math.max(lastTs, …)` would rather show the reading than crop it. That design call is right;
  the sentence just slightly overstates it. *"They no longer run past today"* would be exact.
* *"with nothing printed twice"* is false in the F2 case.

Both are minor, but this is the surface with four consecutive false entries behind it, so they are
worth the two-minute edit.

### F7 — LOW (suite). F1 fixed the selector; `v89` 9.6a still cannot tell a title from a date.

The hook is the right fix and it falsifies correctly — mutant `B1`, removing
`data-whatsnew-title`, reds `v90` 5.1/5.2/5.3 **and** `v89` 9.6a (74 -> 73). But mutant `B2`, which
renders `e.date` in the title node while keeping the hook, **passes `v89` at 74/74**: 9.6a only
asks `length > 3 && length < 60`, and "Nov 2, 2026" satisfies it. `v90`'s own 5.2 catches it with
an explicit not-a-date assertion. Give 9.6a the same assertion. (PRE-RESTART; the mutants are still
on disk under `.../scratchpad/audit90/m/`.)

### F8 — INFORMATIONAL. `chartTimeMax` reads the global clock rather than the caller's `now`.

Both render functions already receive `now`, use it for the range filter, and then call
`chartTimeMax`, which independently calls `simNow()`. `state.now` is refreshed on the 1-second tick
so the two differ by under a second today and nothing is wrong. It is still two clocks in one
chart; passing `now` in would make the axis and the window provably agree.

---

## What I checked and found clean

* **No reading can fall outside the drawn area.** `tMax >= lastTs >= every ts >= tMin` by
  construction, so `(ts - tMin)/tRange` is in `[0,1]`; when `tMax === tMin` the `|| DAY` fallback
  keeps `x()` finite and every point lands on the left edge. Verified empirically by reading each
  circle's `cx` out of the live SVG against the plot rectangle on both charts, for: a future
  reading, a reading exactly at local midnight, midnight plus now, a single reading at this exact
  instant, 3h and 4h spans, 23h59m, a 90-day months-range chart, and the weight `slice(-2)` path.
  No point outside the area in any case, and no label outside it either.
* **The "runs into the future" half is genuinely fixed.** `Math.max(lastTs, Math.min(tMin + AXIS_DAY,
  simNow()))` is bounded above by `max(lastTs, now)`, so the axis can only exceed today when a
  reading itself does. Mutant `A1`-adjacent `c1` shape (restoring the old floor) is what the
  builder already red-lined; my `A2` confirms the `Math.max` is load-bearing in the other direction.
* **Non-adjacent duplicates are impossible below a one-year span.** Brute-forced: every span from
  1ms to 1095 days across both tick counts and seven start hours, plus an exhaustive sweep of every
  start minute of the day against every span up to 3 days in 7-minute steps, in four timezones
  (America/Chicago, UTC, Europe/London, Australia/Lord_Howe). Zero duplicates, zero empty label
  sets, zero labels outside `[tMin, tMax]` for every span under 365 days. Every failure the sweep
  found was at 365 days or more — F2.
* **DST.** America/Chicago 2026-11-01 (the 25-hour fall-back day) and 2026-03-08 (the 23-hour
  spring-forward day), midnight-to-midnight and 01:00+4h, at both tick counts. No duplicates; the
  twice-occurring 1 AM is adjacent and is dropped.
* **No third copy of either pattern.** `tMin + DAY` now appears once, inside `chartTimeMax`. The
  `M/D` construction appears at 11459 (the new helper) plus three unrelated formatters at 2656,
  4240 and 11824, none of them a chart axis. Only two SVGs in the file carry a time axis, and both
  go through the shared functions with identical arguments. No identifier collisions for
  `AXIS_HOUR`, `AXIS_DAY`, `timeAxisLabels`, `chartTimeMax`.
* **Rule 0.** No patient name, no gendered pronoun (the only pronoun-shaped hit in the added lines
  is "Aaron" in a comment, the owner, matching existing convention), no care-plan dose, ceiling or
  schedule, no branch on a medication id. `v75-no-other-patient.mjs` 29/29 (RE-RUN).
* **Rule 0.9.** The new entry is a 4-word title and two bullets, 55 words as rendered in the
  notice — comfortably under the 70-word target. No mechanism, no version numbers, no team seats.
  Read rendered, not as source. Diffed every older entry's title and bullets against the app-v89
  build: **none disturbed**, array insertion only.
* **Release mechanics.** `APP_VERSION` `app-v90` (9307) and `sw.js` CACHE `chemowell-app-v90-1`
  move together. README version-history row added. The F1 hook is on every entry, keyed by version.
* **Regressions.** `v89-everything-free` 74/74 and `v75` 29/29 (both RE-RUN after the restart);
  `v84-whatsnew` 100/100, `v86` 87/87, `v87` 64/64, `v55-help` ALL GREEN, `v57-search` 53/53
  ALL GREEN (PRE-RESTART). `v88-log-a-missed-day` is 51/58 here — and the brief's stated baseline
  of 56/58 is wrong: run against the app-v89 commit itself it is **50/58**, with the identical
  failure set plus one. v90 does not regress it; it incidentally fixes one of its checks.
* **`release_check.sh`** stops at the quality-chain gate for the absence of this report and a PM
  sign-off, which is the expected and correct state. It confirmed that only `index.html` and
  `sw.js` changed under rule 5.
* **No uncaught page errors** in any of the roughly sixty browser runs across this pass.

## What I did not check

* **A real iPhone or Android device.** Chromium only here; the clipping in F3 is measured from
  Chromium's text metrics and the exact overshoot will differ slightly with the system monospace
  font. The direction will not.
* **`overflow-scan.mjs` against the baseline.** It reports NOT CLEAN at this commit with three
  problems, all the string `"10:00 AM"` in a 58x36 `<div>` on Home at 320px — a Home element, not
  an SVG axis label, and nothing this release touched. I could not finish the comparison run
  against the app-v89 build before the container restarted, so I have not formally proven it
  pre-existing, only that it is not in the changed code.
* **Locales other than English.** `toLocaleTimeString` with `hour: 'numeric'` yields a 24-hour
  label in a 24-hour locale; that is monotonic within a day, so the de-duplication reasoning still
  holds, but I did not run the app under one.
* **The printable/doctor's report export**, which does not draw these charts.
