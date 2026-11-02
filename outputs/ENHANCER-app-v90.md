# Enhancer pass — app-v90 (Temperature report, Weight trend report)

Run late, and that is the first finding: Rule 1.5 puts this pass BEFORE the build, on the screens
the release will touch, so Aaron picks from the list and the build carries the pick. app-v90 was
built and audited without one. The pass is run here rather than skipped, and nothing below is
built — it is a proposal list, which is what this seat produces.

**Screens read:** `renderTemperatureReport` (11491-11648) and `renderWeightTrend` (12501-12694).
Labels extracted from the file, not guessed — the first Enhancer pass on this project reported
"Add: yes" for a screen that only had Delete, because a loose keyword match hit something else.

| Screen | Add | Correct | Remove | Row controls |
|---|---|---|---|---|
| Temperature report | **Yes** — `Log a temperature` box, `data-temp-report-add` | **No** | **No** | none |
| Weight trend | **Yes** — `Log a weight` box, `data-weight-report-add` | **No** | **No** | none |
| Paracentesis (same Reports screen, for comparison) | Yes | No | **Yes** — `Remove` per row (12494) | yes |

## E1 — A reading can be added from these screens and never corrected or removed from them. (M)

Checklist item 1, and item 5 in the same breath. Both screens list every reading — `Readings` on
Temperature (11638), `All Readings` on Weight (12681) — as plain rows with no control on them.
A temperature typed as `102` instead of `100.2` can be entered here and not fixed here. Removal
exists, in History, behind a different tab (5893); correction does not exist at all for a vital.

**Paracentesis, on the same Reports screen, has a Remove on each row.** That inconsistency IS the
finding — the sibling got it right, which is checklist item 5 exactly. Bowel and appetite days got
the correct-don't-delete treatment in app-v89 (tasks #19, #24). Vitals are the two left out.

**Proposal:** a `Remove` on each row of both lists, matching the paracentesis row's shape and its
confirm-then-delete pattern, and — preferred — a correction path that appends a superseding reading
rather than deleting, the way `logSymptom` has done since app-v72. Correction is the better half:
a mistyped temperature is a wrong number in a record a clinician reads, and delete-and-re-log loses
the time it was actually taken.

## E2 — Both log boxes stamp NOW, with no way to enter a reading taken earlier. (M)

Checklist item 3. `onLog: logTemp` and the weight equivalent take the value and the current clock.
A temperature taken at 6am and entered at 9pm is recorded at 9pm, and by E1 cannot then be moved.
Bowel and appetite got "log a day you missed" in app-v89; these did not. Pairs naturally with E1
and should be built with it, not before it — an entry logged at the wrong time that can be
corrected is a much smaller problem than one that cannot.

## E3 — "Average" on the Weight trend is the paracentesis average again. (S)

Checklist item 6, and Voice question 3. The weight screen shows three tiles: **Current**,
**Average**, **Change**. Average is the arithmetic mean of every reading in the window (12636).

Weight during treatment **trends**. The mean of a trending quantity is the midpoint of a slope and
describes nothing a clinician would use — and it invites exactly the misreading the paracentesis
average did: *"averaging 150, this one is 146, that's fine"*, when the direction is the whole
story. **`Change` already carries the direction, and `Current` carries the number that matters.**

This is the same defect Aaron caught himself on the paracentesis report — *"we need to remove
average of 5.6 L per procedure for para. this isn't an avg thing"* — one screen over, surviving
because this seat looks for what is missing and walks past what is already there. It is written
into Rule 2.6 item 6 as this role's known blind spot, and here it is.

**Proposal:** replace `Average` with something a clinician reads — **rate of change** over the
window (e.g. `-1.4 lb / week`), or the lowest reading in it. Recommend rate of change: it is the
figure oncology actually watches, it is derivable from data already on the screen, and it cannot
be read as a target the way a mean can. **Aaron's call** — this is a number on a patient's screen,
not a refactor.

## E4 — The Temperature report's Weeks/Months toggle writes the WEIGHT screen's range. (S)

`renderTemperatureReport` line 11498: `const range = state.weightRange;` — the temperature chart
reads and its toggle writes `state.weightRange`. So pressing **Months** on Temperature silently
switches the Weight report to Months as well, and the other way round.

Not a lie and arguably convenient, but it is accidental rather than chosen, and the key is named
for one of the two screens that share it. This release's own suite exercises it (section 4b), which
is how it surfaced. **Proposal:** either give each report its own key, or rename the shared one to
`vitalRange` and say in a comment that it is deliberately shared. Recommend the rename — one range
across the vital reports is defensible behaviour; a key called `weightRange` driving the
temperature chart is not defensible code.

## Nothing wrong with the empty states, and that is worth saying

Checklist item 2 asks you to read them out loud. *"No temperatures logged yet. Log one from the box
above, or from the Temp tile on Home."* names a control that exists, on this screen, and a second
route. *"No weight readings logged yet."* is thinner but points nowhere false. Neither is the
Paracentesis case where the app's own empty state was a bug report about the screen it sat on.

## Not proposed, deliberately

* **An "export this chart" control.** The report already prints through the doctor's report and the
  CSV, both free since app-v89. A third route to the same data is a new way to mis-tap.
* **A fever alert on the Temperature report.** Task #10 covers it at LOG time, which is where it
  belongs; a banner on a report screen is read hours later.
