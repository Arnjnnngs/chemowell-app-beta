# PM sign-off — app-v90 (chart axes, plus F1 deferred from app-v89)

AUDITED-COMMIT: 9f2259cdef450e5ef5121904b40681d7f433cc56
VERDICT: SHIP

This is the Project Manager gate under CLAUDE.md rule 5, not a fourth audit. Three independent Zero
Day passes have read the drawing code; I did not re-read it line by line. My job was the one nobody
else had done: prove the chain actually ran, prove each refusal was genuinely answered in the file as
it now stands, prove the deliverable is what Aaron asked for and nothing else, and prove the release
mechanics. Everything below I measured myself unless it says otherwise.

`index.html` md5 `fe3328deb53ea15bacc2abf7749894f4`, equal to `git show 196b999:index.html` and to
the bytes served on :8899 before every run. `git diff 196b999 9f2259c -- index.html sw.js` is
**empty**, so the code the third audit cleared is byte-for-byte the code I am signing. Working tree
clean; HEAD pushed to `origin/claude/caretracker-team-review-i83ik2`.

## The chain — every artifact exists

| Stage | Artifact | Examined | Verdict |
|---|---|---|---|
| Developer brief | `outputs/DEV-BRIEF-app-v90.md` | — | write model stated: **this release writes nothing** |
| Enhancer | `outputs/ENHANCER-app-v90.md` | — | ran LATE (Rule 1.5 violation, self-declared); 4 proposals, none built |
| Zero Day pass 1 | `outputs/AUDIT-app-v90.md` | `a7bd9c8` | SHIP, F1–F8 |
| Zero Day pass 2 | `outputs/AUDIT-app-v90-delta.md` | `9e34a40` | refused, 2 blockers |
| Zero Day pass 3 | `outputs/AUDIT-app-v90-delta2.md` | `196b999` | SHIP, 2 must-fix + 1 new finding |
| PM | this file | `9f2259c` | SHIP |

No artifact is missing, so nothing goes back down the chain. The Enhancer running after the build is
a real process miss and it is disclosed in its own first paragraph and in the README row rather than
quietly skipped — which is the correct handling of a miss that cannot be undone retroactively.

## The four blockers and must-fix items, each with my own evidence

**Pass 2 BLOCKER-1 — the false release note. CLOSED.** The bullet now reads *"...They no longer run
past today."* The refused wording *"They stop at the last reading now"* is gone from the file. The
sentence is true in every branch of `chartTimeMax(tMin, lastTs, now) = Math.max(lastTs, Math.min(tMin
+ AXIS_DAY, now))`: the result is bounded above by `max(lastTs, now)`, so the axis cannot exceed today
unless a reading itself does.
&nbsp;&nbsp;**One residual, which I am accepting rather than re-blocking.** The app lets a caregiver
deliberately date a reading in the future (the warning string *"This time is in the future"* is in the
file, once), and in that case the axis does reach tomorrow — so the sentence is not literally
universal. I am not blocking on it, for three reasons: the behaviour is right (cropping a reading out
of its own chart would be worse), the only person who sees it put the reading there themselves, and
it is unchanged from app-v89 so the entry claims nothing new about it. That is a materially different
thing from the sentence pass 2 refused, which was false after one ordinary morning reading and no
unusual action at all.

**Pass 2 BLOCKER-2 — the vacuous check. CLOSED.** `3b.<chart>.2` was
`r.labels.length >= 2`, character-for-character its own precondition. It is now
`r.labels[0] === wantFirst`, and the check was renamed in the same commit to
*"the first label is the earliest reading's date, in M/D shape"* — narrowed to what it can actually
see, because `wantFirst` re-derives `M/D` from the app's own two fields and therefore pins the label's
shape and source, not the arithmetic. `3c.2` and `3d.1` were renamed for the same reason. Pass 3
falsified it three ways. Accepting the honest narrowing of a name is the right outcome: a check named
wider than it can see is how the vacuous version survived a pass in the first place.

**Pass 3 must-fix 1 — section 4d was red on correct code before 09:00 local. CLOSED, and this is the
one I proved myself, because the container clock is inside the formerly-red window.** The fixture no
longer sits at a fixed hour: it is one reading twelve hours in the REAL future, which is two and a
half SIMULATED days in the past, so the one-day cap always sets the span and nothing depends on the
time of day. Measured by me:

* **01:28 UTC — `TZ=Etc/UTC`: 162/162.** Under the old fixture this hour scored 147/151.
* **`TZ=America/Chicago`: 162/162.**
* **And the guard still bites in that same window**, which is the half that actually mattered: my own
  mutant making `chartTimeMax` read `Date.now()` again — md5 `4f202e88da8e3dc33a5b148833889381`,
  byte-identical to the auditor's m5 — dies at **01:50 UTC with exactly 4 red, all four of them 4d's**
  (`4d.temp.1/.2`, `4d.weight.1/.2`, each collapsing to a single label). The defect pass 3 found was
  that for nine hours a day this mutant was indistinguishable from the shipped file. It no longer is,
  at the hour it used to be invisible.

**Pass 3 must-fix 2 — two stale README figures. ONE CLOSED, ONE REOPENED BY THE SAME COMMIT.** The
`v88` figure is now correctly a range, and I confirm the range: **50/58 at local date Nov 2
(`TZ=America/Chicago`)** and **54/58 at Nov 3 (`TZ=Etc/UTC`)**, same file, only `TZ` differing —
inside the stated 50–54. The `v90 89/89` figure was updated to `151/151` in two places. **It is stale
again**, because the same commit added `f2` and took the suite to 162. See the record findings below.

**Pass 3's new finding — `f1` blind to a proportional thinning. CLOSED, and I falsified the fix
myself**, since `f2` landed after the last audit and no independent pass had ever seen it fail. My
mutant dropping every other label — md5 `5ed0028b6ceae9d1603dd95288f7eb6d`, again byte-identical to
the auditor's m18 — reds **11 `f2` checks, 143/162**, which is exactly the figure the README claims.
`f1` fires on none of them, confirming that evenness alone really was blind and that `f2` is the check
doing the work. Before `f2` this mutant scored 149/151.

## Release mechanics

`APP_VERSION = 'app-v90'` (index.html:9307) and `sw.js` CACHE `chemowell-app-v90-1`, against a
baseline of app-v89 / `chemowell-app-v89-1` in `PUBLISHED.json`. They move together. I checked every
other place a version could hide: `manifest.webmanifest` carries none, `capacitor.config.ts` carries
none, `www/` carries none, and `APP_VERSION` is referenced but never re-declared anywhere else. Clean.

## The CHANGELOG entry, read rather than taken on trust

Title *"Chart dates read correctly"* — 4 words, inside Rule 0.9's 3–6. Two bullets, 26 and 32 words,
**62 words with the title**, under the ~70 target. No mechanism, no function name, no version number,
no team seat. `labeled` is American, matching the file. Both sentences are true of the shipped file
subject to the one named residual above. I diffed the whole array: a pure insertion, no older entry
disturbed.

## What I measured myself

`v90-chart-axes` **162/162** under `TZ=Etc/UTC` and `TZ=America/Chicago` · `v89-everything-free`
**75/75** · `v75-no-other-patient` **29/29** · `v84-whatsnew` **100/100** ·
`v86-logging-and-labels` **87/87** · `v83-meds-and-reports` **80/80** · `v82-back-button` **15/15** ·
`v82-timeline` **24/24** · `v82-vitals-strip` **41/41** · `v55-help` ALL GREEN · `v57-search` 53/53
ALL GREEN · `v88-log-a-missed-day` **50/58 and 54/58**, in range, harness-only ·
`v87-correct-a-past-day` **64/64 in UTC and in `America/Phoenix`, 43/51 in `America/Chicago`** — see
below.

## Scope drift, in both directions

**Nothing landed that Aaron did not ask for, with one pre-authorised rider.** The entire `index.html`
diff against the published baseline is: the version bump, the changelog entry, the two shared axis
helpers, both chart call sites, `pad.right` 20 → 34 on both charts, two `data-xaxis` hooks, one
`data-whatsnew-title` hook, and one `simDate` test hook. The `data-whatsnew-title` work is F1, which
is not chart axes — it was deferred into v90 by the app-v89 PM and is named as the second job in the
developer brief, so it is a prior authorisation rather than drift, and it is disclosed in the README
row. The `simDate` hook is production code added purely to serve a test; pass 3 judged it acceptable
on precedent (`window.__eraseTest`, a factory reset, is already exposed ungated) and proved it inert
when `TEST_MODE` is false. I accept that, and note plainly that the hook ships to users and does
nothing.

**Neither half of what he asked for is incomplete, and I verified the completeness claim rather than
inheriting it.** `tMin + DAY` now occurs exactly once, inside `chartTimeMax`. `data-xaxis` occurs on
exactly two emitting lines. Only two `tMin`/`tMax` axis constructions exist in the file (11561
temperature, 12548 weight) and both call both helpers with identical arguments. The three other `M/D`
constructions are not chart axes: 2656 and 11844 are history day headings (*"Monday, 11/2"*) and 4240
is a full-date formatter. **So both halves are fixed in both charts, and there is no third chart.**

## What is wrong in the record

1. **`v90 151/151` is stale in two places and should be `162/162`.** This is the defect pass 3's own
   must-fix named, recurring one commit later: the figure was corrected from 89/89 to 151/151 and
   then `f2` took the suite to 162 in the same commit, while the row's own prose says *"Suite 89 →
   151 → 162"* and *"143/162"* two sentences apart from the stale number. **That is now the fourth
   figure in this one row to be written as a property of the code when it was a snapshot of a run.**
2. **`v87 64/64` is a snapshot, not a property, and the suite has an unrecorded DST defect.** I
   measure `v87-correct-a-past-day` at **64/64 under UTC** and **43/51 under
   `TZ=America/Chicago`** — eight failures and thirteen fewer checks even executed. I discriminated
   the cause rather than guessing: under **`America/Phoenix`**, same local date (Mon Nov 2), no DST,
   it is **64/64**. So it is not the calendar date and not the app — it is that the fixture seeds its
   row at `localMidnight - 2*86400000` and the selector looks for `D0 - 2*86400000`, and Chicago's
   fall-back on Nov 1 2026 makes that interval 49 hours, so the arithmetic lands at 01:00 and the
   `data-correct-day` key never matches. **It is pre-existing, not a v90 regression:** the published
   app-v89 baseline (`a5d5908`, md5 `a9de408cec59efb2bc8b8df44a750cc0`, served separately) scores an
   identical 43/51 in Chicago. All three audits ran their regression tables under `America/Chicago`
   and none re-ran v87, which is exactly how it stayed invisible. **This is a different defect from
   v88's `pickDay`**, so task #30 does not cover it and it needs its own entry.
3. Neither of the two is app code, and neither is a reason to hold the release. Both are the record,
   which is the developer's instrument, and this project has been hurt by that instrument lying.

## Exemptions — honest, with one qualification

Chromium only, no iPhone, nothing on a real phone: honest and stated everywhere, and the two charts
have genuinely never been seen on a phone. No Designer screenshots because nothing changes a layout a
person taps: **true as written but narrower than it sounds.** `pad.right` moved 20 → 34 on both
charts, which does move drawn pixels — the fever-threshold label is anchored to `W - pad.right` and
shifted 14 units left with it. No tap target moved, the change was measured from text metrics rather
than eyeballed, and it is now pinned by `p4` (my m4-equivalent class reds it three times), so the
substance is covered. The exemption would be fully honest if it said *"a visual change did land and
was measured rather than screenshotted"* instead of implying nothing visual changed.

## What I did NOT check, plainly

* **The drawing code line by line, and the mutant corpus.** Three passes did that; re-doing it is the
  quota this project has overspent. I wrote two mutants only, aimed at the two guards that landed
  after the last audit and had never been independently falsified. Both of my md5s came out identical
  to the auditor's, which corroborates their construction byte-for-byte.
* **Any real device.** Chromium only, same as every pass.
* **`overflow-scan.mjs`.** Not run by me either; pass 1's NOT CLEAN result (three `"10:00 AM"` hits on
  Home at 320px, not an SVG axis label) is still not formally proven pre-existing.
* **DST and non-English locales for the chart axis**, beyond the v87 discrimination above.
* **The sibling-repo ports.** Correctly not built here. `care-tracker` is the live patient's app and
  needs Aaron's own go-ahead; I have no authority there and did not touch it.
* **Whether the Enhancer's four proposals are right.** They are logged (M29, M30, tasks #32/#34) and
  are Aaron's call, not mine.

## Conditions on this sign-off

None blocking. Two record corrections should go in with the push, neither touching a rule 5 path:
`v90 151/151` → `162/162` in both places, and `v87` recorded as a range with its DST root cause
logged as its own backlog item beside task #30. I have no authority to push to `main` and have not.
