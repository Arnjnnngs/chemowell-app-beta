AUDITED-COMMIT: 196b999
VERDICT: SHIP

# Zero Day Audit — app-v90, SECOND DELTA pass (commit `196b999`)

**Both blockers I refused the release for are answered, and the drawing code survived everything I
threw at it.** BLOCKER-1 is closed and measured: the sentence a patient reads is now true in every
branch of `chartTimeMax`. BLOCKER-2 is closed in the letter and only partly in the spirit — the
check can fail now, proven with three mutants, but it still does not bite the mutant it was written
against, and what it actually pins is not what its name says.

**Headline, and it is mine, not theirs: F1 IS BACK.** The new section 4d is **RED on correct code
from 00:00 to 09:00 local, every day.** Same file, md5-proven served bytes, nothing changed but the
timezone:

    TZ=Pacific/Kiritimati  14:20 local   151/151
    TZ=Pacific/Niue        13:22 local   151/151
    TZ=America/Chicago     18:23 local   151/151
    TZ=Australia/Eucla     09:14 local   151/151
    TZ=Asia/Tokyo          09:26 local   151/151
    TZ=Asia/Shanghai       08:28 local   147/151   <- 4d.temp.1/.2, 4d.weight.1/.2
    TZ=Etc/UTC             00:24 local   147/151
    TZ=Europe/Paris        01:25 local   147/151

The boundary is 09:00 local, pinned between Shanghai 08:28 (red) and Eucla 09:14 (green).

**Cause.** 4d seeds its reading at `future + 9*HOUR` — 09:00 on the simulated day — but `simNow()`
is `Date.now() + N whole days`, so the simulated clock keeps the REAL time of day. Before 09:00
local the reading sits in the simulated future, `chartTimeMax` returns `lastTs`, `tMin === tMax`,
and the axis collapses to one label (`["9:00 AM"]`) on both charts.

**Why it is worse than a flake.** 4d is the ONLY check in all 151 that kills the
`chartTimeMax`-ignores-`now` mutant: my md5-proven m5 reds exactly four checks and all four are
4d's. So for nine hours of every day that mutant is indistinguishable from the shipped file, and
the guard this delta added to close M10 is the same guard that is already red. `README.md` and
`TEAM.md` now record F1 as closed and the suite as "no longer green-only-in-the-afternoon". That is
false as written.

**I also reproduced the midnight case naturally rather than by argument.** A run begun at 23:59:27
scored **145/151** — 4c.temp.1 and 4c.weight.1 on top of 4d's four — because `minuteWindow()`
computes its window before local midnight and the app renders after it, so `sameDay` is false and
the axis is labelled `["11/2","11/3"]`. A run begun 77 seconds earlier was 151/151. And inside the
first 60 seconds after local midnight `ago()`'s `midnight + 60000` floor dates its fixture in the
future, so sections 1 and 2 would red too (reasoned from the helper, not driven).

**Graded HIGH (process), not a blocker — deliberately, and for consistency with my own first pass.**
Pass 1 graded the identical defect class, in the identical file, as HIGH and shipped past it. Pass 2
blocked on a check that could not fail, which is worse because it is silently green; a check that is
loudly red is at least visible. Refusing a correct chart fix a third time over a test fixture would
make this seat the defect.

## MUST GO IN THE SAME COMMIT AS THE PUSH — neither is `index.html` or `sw.js`

1. **4d's fixture.** Place the reading relative to the simulated clock instead of at a fixed hour —
   `simMidnight + (Date.now() - realMidnight) - 3*HOUR`, floored at `simMidnight + 60000`, which is
   the cure `ago()` already applies in sections 1 and 2. Then re-run in two timezones. No app code
   moves, so the 151/151 and the eight-timezone table above stand.
2. **Two stale figures in the README's app-v90 row.** The suites line still reads `v90 **89/89**`
   while the same row says the suite grew 89 → 151. And `v88 is 51/58` is a one-day snapshot: I
   measure **50/58** with the local date Nov 2 and **54/58** with it Nov 3, same file, only `TZ`
   differing — which is the row's own root cause proving a fixed figure cannot be right. It should
   read 50–54/58, moving with the calendar month. This is the third wrong v88 figure in that row.

Everything else below is app-v91.

---

## BLOCKER-1 — the false sentence. CLOSED.

The bullet now reads *"The temperature and weight charts could label the bottom of the chart with
tomorrow's date when only today had readings. They no longer run past today."* Driven through the
real temperature report at 18:40 local:

| Fixture | Axis |
|---|---|
| one reading at 09:00 today (the case that falsified *"stop at the last reading"*) | `9 AM, 11 AM, 1 PM, 4 PM, 6 PM` — ends at **now**, which is today |
| two readings today, 3h apart | identical — ends at now |
| three readings 20, 12 and 5 days back (3c) | last label `10/29`, sitting exactly on the newest reading's dot (646 = 646) |
| a reading deliberately dated TOMORROW | `11/2, 11/3` — the axis does reach tomorrow |

So the sentence is true in the scenario its own first clause describes, and in every multi-day case.
**One residual, named and not blocked on:** a caregiver who deliberately logs a future-dated reading
(the app warns and allows it) still sees tomorrow on the axis. That behaviour is right — cropping a
reading out of its own chart would be worse — it is outside the bullet's stated scope, it is
unchanged from app-v89 so the entry claims nothing about it, and *"They no longer run past today"* is
the wording my own pass-1 F6 prescribed as exact. Blocking on it now, having asked for it, would be
incoherent.

**"Today" follows `simNow()`, not the wall clock**, which is the right reading: `render()` takes
`now = state.now`, `state.now` comes from `simNow()`, and it threads through to `chartTimeMax`. 4d
demonstrates it when it is green — the axis moves with the simulated date.

## Voice verdict — PASS. 62 words.

Title *"Chart dates read correctly"* — **4 words**. Two bullets, **26 and 32 words = 58**, 62 with
the title. Rule 0.9 satisfied on every count: title inside 3–6, bullets inside 2–4, total under the
~70 target, no mechanism, no version number, no team seat, nothing a patient does not need. Bullet 2
is unchanged from the commit I refused and was already true. `labeled` is the American spelling and
is the only user-facing instance.

**The other nine entries are untouched.** I diffed the whole `CHANGELOG` array against the app-v89
build (`a5d5908`): a pure array insertion, not one character of the older entries changed. Against
the refused commit `9e34a40` the only difference in the array is the one sentence.

Two nits, neither this release's doing: `date: 'Nov 2, 2026'` is now yesterday; and app-v85 and
app-v84 carry a single bullet each where Rule 0.9 asks for two to four, while app-v89 is 71 bullet
words.

## BLOCKER-2 — the vacuous check. CLOSED IN THE LETTER, half open in the spirit.

`3b.<chart>.2` now asserts `r.labels[0] === wantFirst`. It is no longer character-for-character its
own precondition, and **it can fail — falsified three ways, every mutant md5-proven:**

* `m13` the year printed at every dated span (`span > 0`) → reds `3b.temp.2`, `3b.weight.2` (+4 more)
* `m14` day and month swapped (`D/M`) → reds both, and 10 others
* `m15` the first label dropped → reds both, and 23 others

Two things are still true and should be said rather than filed:

1. **It does not bite the mutant it was written against.** `m7`, de-duplication keeping the LAST of
   a run, reds exactly four checks in a green timezone — `3.temp.p3`, `3.weight.p3`, `3b.temp.p3`,
   `3b.weight.p3` — and `3b.2` passes, as it did before the rewrite. `p3` carries that claim, and
   `p3` is load-bearing (m15 reds it thirteen times), so nothing is unguarded. But the comment above
   the check says it "now asserts the claim its name makes", and the mutant says otherwise.
2. **`wantFirst` re-implements the code under test.** The test computes `(getMonth()+1)/getDate()`
   itself, which is the app's own construction, and `labels[0]` is `fmt(tMin)` where `tMin` is the
   earliest reading by construction. On the question its NAME asks — is the first label the earliest
   reading's date? — it compares the app's formatter with a copy of itself and agrees by
   construction. What it genuinely pins is the format SHAPE at a sub-300-day span. That is a real
   claim; it is not the one the name makes. Rename it, or assert it against the fixture's own
   timestamp through the app's visible output rather than a re-derivation. `3c.2` and `3d.1` share
   the same self-reference.

## NEW FINDING — the "fully labelled" blind spot is only HALF closed. (app-v91, HIGH)

`f1` asserts the gaps between labels are EQUAL, so it is blind to any arithmetic drop pattern — and
collapsing runs is exactly the shape a de-duplication bug takes. Mutant `m18`, md5-proven
(`5ed0028b6ceae9d1603dd95288f7eb6d`), drops every other label from every axis in the app:

    m18 -> 151 checks: 149 passed, 2 failed   (3b.temp.0, 3b.weight.0)

Both red lines are **preconditions**, not assertions about the axis. An app showing half its axis
labels scores 149/151 and nothing in 151 checks says so. `f1`, `3c.1`, `3c.2`, `3d.1`, `3d.2`,
every `.2` distinctness check and all four position checks pass.

The fix is the one `BACKLOG.md` M31 already argues for, and it is one line: assert the label COUNT
against the tick count the chart asked for (`out.length === count + 1`) as a **pure-function** test,
not gap equality in a browser.

The 0.3 tolerance itself is fine, not loose: measured gaps spread by 0.1 u (147.8 / 147.7) and 0.3 u
is 0.04 % of the 680-unit viewBox. `f1` is correctly withheld from sections 3, 3b and 4c, where
labels are meant to collapse — but it is **also missing from 4d**, where the labels are distinct
hours and the axis should be complete.

## The new test hook in production code — judgement: ACCEPTABLE, with two notes

* **It is NOT gated by `TEST_MODE`.** The enclosing block is `if (typeof window !== 'undefined')`
  (`index.html:13623`). There is precedent and it is much larger than this hook: the same block
  already exposes `window.__eraseTest = eraseAllAppData` — **a factory reset** — plus
  `renameActiveProfile` and `logAppetite`, all ungated. `simDate` is the least dangerous member of a
  surface that already hands a page a data-erase button.
* **It survives into a store build, and is inert there.** Mutant `m20`, `TEST_MODE = false`,
  md5-proven `c7c28f5465201380ca77aa458745aef0` disk-against-served:
  `typeof window.__v86Test.simDate === 'function'` is still **true**, so the hook ships — but
  `setSimDate` early-returns on `!TEST_MODE`, so it does nothing. Proved by running the suite
  against m20: `147/151`, with 4d collapsed to `["9:00 AM"]`. **Say that plainly: the hook ships and
  is a no-op.**
* **Junk input cannot corrupt anything.** Thirteen cases driven through the real hook:
  `null`/`undefined`/`''` early-return; `"not-a-date"` sets `dateOffsetDays = NaN`, which every
  reader defuses with `(state.dateOffsetDays || 0)` because NaN is falsy, and the app renders
  normally; `"9999-99-99"`, `"0000-00-00"`, `"2026-13-45"`, `"-271821-04-20"` move the clock to an
  absurd date and the charts show their empty or collapsed states; a non-string (`1e15`) throws
  `TypeError: dateStr.split is not a function` at the call site only. **No page error and no storage
  write in any of the thirteen** — localStorage key count 6 → 6 throughout — and the offset is
  deliberately not persisted (`index.html:1827`).
* **The suite now has a hard dependency on `TEST_MODE === true`.** At store prep, section 4d's eight
  checks go red. That belongs in `HARDCODED_MEDS_PLAN`/store-prep now, not as a discovery then. And
  the real store-prep item on this surface is `__eraseTest`, which predates this release.

## Every mutant I wrote. Twenty, all md5-proven, all dead.

Each is a byte copy of the audited `index.html` with the named anchor sites replaced — the builder
script **refuses and exits** unless each anchor occurs exactly the expected number of times — served
from its own directory on its own port, with the **fetched** bytes md5'd against the file on disk
before any result was believed. Source `index.html` md5 `fe3328deb53ea15bacc2abf7749894f4`, equal to
`git show 196b999:index.html` and to the bytes served on :8899. Counts below are from
`TZ=America/Chicago`, where 4d is green, so they are net of the clock defect.

| # | md5 (applied, proven) | What it breaks | Red | Builder's claim |
|---|---|---|---|---|
| m1 | `f76f2926448837b8830ea2aed11f0918` | one label dropped mid-axis | **13** | 11 |
| m2 | `5427963dcf89df9dbf7094a8326947e4` | every label one tick RIGHT of its time | **51** | 51 ✓ |
| m3 | `ec6d0485c0fc3bb56b3900c795bc0bfa` | the `tMin + AXIS_DAY` clamp removed | **20** | 4 |
| m4 | `a7cfd23e57e79db84322aa095a8007af` | `pad.right` back to 20, both charts | **3** | 3 ✓ |
| m5 | `4f202e88da8e3dc33a5b148833889381` | `chartTimeMax` reads `Date.now()` | **4** | 4 ✓ |
| m6 | `eea5a787bb174f14fb23bfe9f96ea20e` | the year branch removed | **1** | 1 ✓ |
| m7 | `ac8fcf1899d73e9e77d022f9659f87f3` | de-dup keeps the LAST of a run | **4** | 2 |
| m8 | `dc5ddbf116f914a20d0ca9e9172cdd6f` | tick count hard-coded to 4 | **2** | 2 ✓ |
| m9 | `3e22f32b1f748a59323862457faaa74c` | `dayOf` decides midnight in UTC | **14** | — (survived twice) |
| m10 | `ed704bbc2f1364b1584a7be563240125` | the `simDate` hook deleted | **5** | — |
| m11 | `abef45cb9b5bbd11e626593a0e1fe532` | year threshold moved to 400 days | **1** | — |
| m12 | `faa614956e87a7f6f83dbcd80f97c53a` | de-duplication removed entirely | **4** | — |
| m13 | `e140979994ccd4bbde17b8cd04072561` | the year printed at EVERY dated span | **6** | — |
| m14 | `30b3847175ad2c25d8849a2d48d9528f` | day and month swapped (`D/M`) | **12** | — |
| m15 | `c89eaefe98a06cac5301ca7cb4bc0481` | the FIRST label dropped | **25** | — |
| m16 | `c7da8bb60a9733b3a6d677bea578133a` | the axis always runs to NOW | **4** | — |
| m18 | `5ed0028b6ceae9d1603dd95288f7eb6d` | EVERY OTHER label dropped | **2** | — |
| m20 | `c7c28f5465201380ca77aa458745aef0` | `TEST_MODE = false` (store build) | **4** | — |

**Where my numbers differ, and it matters that this time most of them do not.** Six of the builder's
eight reproduce exactly — m2 51, m4 3, m5 4, m6 1, m8 2, and m1 at 13 against a claimed 11. Two
differ and both are explained by construction, not by disagreement: my m3 removes the whole
`Math.min(tMin + AXIS_DAY, now)` clamp rather than part of it, so it breaks every same-day case as
well (20 red, not 4); my m7 moves the surviving label's `px` rather than re-ordering the array, which
reaches both charts in two sections (4 red, not 2). **Both still die.** Last pass the builder's
"12, 22, 2, 2, 2" could not be reproduced at all; this tally substantially can, and the record
deserves to say so.

**Three results worth more than their row:**

* **m9 is dead, and it survived both previous passes.** `dayOf` → `setUTCHours` reds **14** checks
  under `TZ=America/Chicago`. The new `f1`, 4c and 4d sections closed the A4/M11 hole, which nobody
  claimed. In this UTC container it is a semantic no-op and invisible, so a default run here still
  cannot see it.
* **m6 and m11 each red exactly ONE check** (`3d.1`). The whole year branch — the fix for my own F2 —
  is pinned by a single assertion in a single weight-only section. Thin.
* **m10 fails LOUDLY, answering the brief's question.** Deleting the hook reds 4d ×4 **and 6.1**,
  because `axisOf` pushes `'simDate hook missing'` into `thrown`. The dependency is not silent.

## The year threshold at 300 days — SOUND, and swept rather than argued

I extracted `timeAxisLabels` and `chartTimeMax` verbatim from the audited file into a module and
swept them as pure functions, which is the instrument M31 asks for:

* **162,064 combinations** — spans from 1 ms to 1200 days including 299/300/301/364/365/366/367/730/
  1095 and ±1 ms either side of the 300- and 365-day boundaries, 56 start times across a year, both
  tick counts: **zero duplicate labels.** The duplicate class F2 named is gone.
* **Every span above 300 days is FULLY labelled** — 301, 330, 364, 365, 366, 400, 730, 1095 all
  emit `count + 1` labels. The 365-day drop I measured on the refused build, where the missing tick
  was the one under the most recent reading, **is gone.**
* **The largest span that still drops a label is 5 days**, where the collapse is intentional.
* **2,077,536 ticks checked for the invariant that matters**: a tick with no label of its own must be
  covered by the nearest label to its LEFT naming that tick's own date. **Zero violations.** Global
  de-duplication plus the year makes that true by construction, because `seen` only ever drops a
  label equal to one already emitted and dates are monotonic.
* **What happens between 300 and 365 days:** the year is printed where `M/D` would still have been
  unambiguous — two ticks inside a span under 365 days cannot render the same `M/D`. Conservative,
  harmless, slightly wider labels. At exactly 300 days no year, and 300 < 365, so safe. **There is
  no window left where a label is ambiguous or dropped.**
* **Width.** The year format is eight characters in the same `ui-monospace,Menlo,monospace` as
  `"10:36 PM"`, so it cannot beat the 58.84 u widest I measured last pass. Measured live at 3d, the
  right-edge box is `[624.4 .. 668.8]` inside the 680 viewBox. `pad.right = 34` clears it, and m4
  now reds `p4` three times, so the fix is pinned where it was not.

**The temperature chart really is exempt.** `renderTemperatureReport` has no `slice(-2)` fallback —
an empty window returns the `data-temp-none-in-range` state (`index.html:11542`) — so its span can
never exceed 90 days. The weight chart's `points = filtered.length > 0 ? filtered : weightEntries.slice(-2)`
(`12536`) is unbounded. 3d being weight-only is correct and the stated reason is true. **The comment
makes no false claim now**: the reachability it asserts is the code at 12536, and the 365-day drop it
describes is what I reproduced on the refused build.

## The other new checks, attacked

* **`p4` fails loudly if `getBBox` throws.** `xs` and `boxes` map the same `[data-xaxis]` node list
  and nulls are filtered, so one throw makes `boxes.length !== xs.length`. It also fails on an empty
  axis, because `vbWidth` is then `null` and `null > 0` is false. Proved from the code — I could not
  make `getBBox` actually throw in Chromium.
* **None of `p1`–`p4` is vacuous on an empty set.** Each guards on `xs.length > 0` and `vbWidth > 0`.
* **`3c` holds across a month boundary and in a non-UTC zone**, because node and the browser share
  one timezone: the suite passes no `timezoneId`, so Chromium inherits the process `TZ`. That is a
  **latent coupling** worth writing down — pass 1 added a `timezoneId` to reproduce F1, and doing
  that again would break `3b.2`, `3c.2` and `3d.1` for a reason that has nothing to do with the app.
* **`3c` is a real section**: m16, the axis always running to now, reds `3c.<chart>.1` and `.2` and
  nothing else. It is the discriminator the suite was missing.
* **Nothing else in the new 62 is vacuous**, as far as I can drive it. Every new assertion I could
  reach was killed by at least one mutant. The weakest are `3b.2`/`3c.2`/`3d.1` for the
  self-reference above, and `f1` for the drop pattern.

## `v88-log-a-missed-day` — the builder's reasoning is RIGHT, and there is NO data-loss defect

This was the most important thing to settle and it is settled by driving the app, not by reading.

**The count moves with the calendar, measured on one file.** `50/58` with the local date Nov 2,
`54/58` with it Nov 3 — same `index.html`, only `TZ` differing. That alone proves the failures are
the harness's, not the code's.

**The root cause is `pickDay` (line 573), and it is sharper than stated.** With the target day Oct 31
and the calendar showing November, I counted the buttons whose text equals `"31"`: **zero**. Oct 31
is not in the rendered grid at all, so both `attempt()` calls return false, no day is ever picked,
and the modal keeps its default — the pill read `"Mon, Nov 2"`. Confirming then writes a new row on
TODAY. The rows in storage afterwards:

    ts 1793469600000  Sat Oct 31 2026 13:00:00  normal  note "ate a full dinner"   id a1   <- UNTOUCHED
    ts 1793642400000  Mon Nov 02 2026 12:00:00  normal  note undefined             id emv…  <- the new row

**So 7b's empty note box and its blank-note row are the suite correcting the wrong day. The
caregiver's note is intact.** A note-loss defect would have left the Oct 31 row superseded or blank;
it is neither. Independently corroborated by **7b2**, the calendar-free version of the same write
path, which is green on all three of its checks on this same build: the box shows the note the moment
it opens, and confirming without touching the calendar does not wipe it.

The harness selects a calendar cell by matching button TEXT to a day NUMBER and then clicks
`cells[cells.length - 1]` — the last match. Rule 5 forbids both by name. That is the fix, and it is
one function.

## The README's app-v90 row

* **"six survived"** ✓ — matches my pass-1 table, which listed six while its heading said four.
* **the unreproducible `12, 22, 2, 2, 2` is gone** ✓ and the kills are named instead.
* **the eight new kills**: six reproduce exactly, two differ by construction (above). Better than
  last pass, and worth recording as such.
* **`v90 89/89` is stale** — the same row says 89 → 151. Should be 151/151.
* **`v88 is 51/58` is wrong today** and cannot be right as a fixed figure; see above.
* **"All seven failures are ONE line"** — there are 8 today and 4 yesterday. The line is right; the
  count is 4–8.
* **`v82 15/15`** ✓ for `v82-back-button`. The `24/24` the last pass flagged was a different file,
  `v82-timeline`, also green; `v82-vitals-strip` is 41/41. The row should name the file, not the
  version.
* **the port claim is true.** `care-tracker/index.html:7799` is
  `const tMax = Math.max(points[points.length - 1].ts, tMin + DAY);` — the future half — and
  7832-7838 is the label loop with an unconditional `(d.getMonth() + 1) + '/' + d.getDate()` — the
  repeat half. One chart, both halves, exactly as claimed. `chemowell-beta/index.html:6901` carries
  the same `tMax`. Correctly NOT built here: that is the live patient's app.

## M31 in `BACKLOG.md` — I agree with option 2, and its premise needs correcting

**M31 says the `setUTCHours` mutant "survives the whole suite, and survived it under
`TZ=America/Chicago` too." That is no longer true at `196b999`** — my md5-proven m9 reds **14**
checks in Chicago. The new `f1`, 4c and 4d sections closed it outside UTC. It stays invisible in this
container, where `setHours` and `setUTCHours` are the same call, so the entry should say "not
reachable by a default run here" rather than "still alive".

**Option 2 — test `timeAxisLabels()` as a pure function — is right, and for a better reason than
M31 gives.** The real argument is not the `dayOf` gap; it is m18. The browser suite's fully-labelled
guard is `f1`, which compares gaps, and so an app dropping every other label scores 149/151. A pure
function asserting `out.length === count + 1` kills that in one line. My own sweep is the
demonstration: 162,064 combinations and 2,077,536 ticks, in seconds, with no browser and no clock,
answering questions the browser suite cannot reach at an arbitrary hour.

## Regressions, all at `196b999` under `TZ=America/Chicago`

`v90-chart-axes` **151/151** · `v89-everything-free` **75/75** · `v75-no-other-patient` **29/29** ·
`v84-whatsnew` **100/100** · `v82-back-button` **15/15** · `v82-timeline` **24/24** ·
`v82-vitals-strip` **41/41** · `v88-log-a-missed-day` **50/58**, harness-only, root cause settled
above. No uncaught page errors in any run this pass.

**Rule 0 clean.** No patient name, no gendered pronoun, no British spelling in any added line of
`index.html` or the suite; `v75-no-other-patient` 29/29 with its three ratchets intact.

**`release_check.sh` exits 1 exactly where briefed.** Baseline `PUBLISHED.json` → app-v89 at
`a5d5908`, 3 commits having touched `index.html` since; `index.html sw.js` changed under rule 5;
**missing `outputs/PM*app-v90*.md`**; and it additionally refuses because
`outputs/AUDIT-app-v90-delta.md` says DO NOT SHIP and must be answered by a report on a later commit
— which this file is. Nothing after that stage ran.

## What I did NOT check, plainly

* **A real iPhone or Android.** Chromium only. Every width, box and clipping figure here is
  Chromium's text metric; a wider system monospace on iOS would re-clip the right-hand label. Nobody
  has looked at these two charts on a phone.
* **`overflow-scan.mjs`.** Not run this pass. The pre-existing NOT CLEAN result from pass 1 — three
  `"10:00 AM"` hits on Home at 320px — is still not formally proven pre-existing.
* **`getBBox` actually throwing.** `p4`'s loud-failure behaviour is proved from the code, not driven.
* **The 00:00–00:01 local window** for sections 1 and 2. Reasoned from `ago()`'s `midnight + 60000`
  floor, not driven; the 23:59 and the 00:24 reproductions are real, that one minute is not.
* **DST.** Not re-run. My pure-function sweep ran in this container's UTC, which has none; pass 1
  covered America/Chicago 2026-11-01 and 2026-03-08 and the de-duplication change cannot affect it.
* **Non-English and 24-hour locales.** `hour: 'numeric'` yields 24-hour labels there; monotonic
  within a day, so the reasoning holds, but unrun.
* **The builder's own mutant sources**, which is why the two differing counts are reported as
  differently-built rather than wrong.
* **v86, v87, v83, v55-help, v57-search.** Not re-run this pass; pass 1 and pass 2 had them green
  and nothing in this delta touches them.
* **The sibling-repo ports themselves.** I read the two defect sites in `care-tracker` and
  `chemowell-beta` to confirm the claim; I ran neither repo's suites and built nothing there.
* **The Enhancer pass** in `outputs/ENHANCER-app-v90.md`. Nothing from it was built and I did not
  audit its findings.
* **The printable/doctor's export**, which does not draw these charts.

---

## Then ship it

The chart code is right, the sentence a patient reads is true, and eighteen mutants could not get
past it. Fix 4d's fixture and the two README figures in the same commit as the push — neither touches
`index.html` or `sw.js`, so nothing above needs re-measuring — and this goes to `main`. `f1`'s drop
pattern, `3b.2`'s name, the single check guarding the year branch, and M31's pure-function suite are
app-v91.
