AUDITED-COMMIT: 9e34a40
VERDICT: DO NOT SHIP

# Zero Day Audit — app-v90 DELTA pass (commit `9e34a40`)

**Headline: the commit that fixed my F6 put a FALSE sentence in front of the patient.** The
app-v90 What's New now reads *"They stop at the last reading now."* They do not. On a same-day
chart the axis stops at **now**, which is the whole point of the fix: one reading at 09:00, read at
23:10, draws an axis running `9 AM → 12 PM → 4 PM → 7 PM → 11 PM` — fourteen hours past the last
reading, measured, not reasoned. The sentence is false in exactly the scenario its own first clause
describes ("when only today had readings"). This is the surface with four consecutive false
entries behind it, which is why Rule 2.7 lets the Voice block on copy alone. It is a one-sentence
fix and then this ships.

**The chart fix itself is sound and I could not break it.** 89/89 in four timezones including the
two that matter, the reported defect is genuinely gone in both charts, and four of the six mutants
that beat my last pass are now dead. This verdict is two small corrections, not a rejection of the
release.

Audited `9e34a40`. `index.html` md5 `a6cb59326874e1bcc6bad604d41b5c06`, proven equal to
`git show 9e34a40:index.html` and to the bytes served on :8899 before every run. One commit exists
above the audit target — `dc4b337`, TEAM.md only; `git diff 9e34a40 HEAD -- index.html sw.js test/`
is empty, so the code audited is also the code at HEAD.

---

## MUST FIX BEFORE `main`

### BLOCKER-1 — the changelog bullet is false. (copy, patient-facing, introduced by this commit)

`index.html:9332`, bullet 1: *"...They stop at the last reading now."*

`chartTimeMax` is `Math.max(lastTs, Math.min(tMin + AXIS_DAY, now))`. For a span over a day that
resolves to the last reading; **for a same-day span it resolves to `now`**, because `tMin + DAY`
is still in the future so the `Math.min` picks `now`. Measured through the real app with one
reading at 09:00 on a simulated day: labels `["9 AM","12 PM","4 PM","7 PM","11 PM"]`. The last dot
sits at x=58 and the axis runs to x=646. A caregiver reading that bullet and then looking at the
chart is told the chart ends where her last reading is, and it does not.

My F6 asked for *"They no longer run past today"* — which is exact, and shorter. The rewrite
replaced a mild overstatement with a plain falsehood. Bullet 2 ("no date printed twice") is **true**
as rewritten; only the first needs the edit.

### BLOCKER-2 — `3b.<chart>.2` is a vacuous check, in the section this delta added.

```
t('3b.' + chart.key + '.2  the earliest date is the first label, not a later one',
  r.labels.length >= 2, JSON.stringify(r.labels));
```

The assertion is `r.labels.length >= 2` — **character-for-character the same condition as its own
precondition `3b.<chart>.0`** — while its name claims something about which date is first. It
asserts nothing about dates.

**Falsified, not inferred.** Mutant `M7` makes the de-duplication keep the LAST of a run instead
of the first, which is precisely "the earliest date is NOT the first label". Under `M7`,
`3b.temp.2` and `3b.weight.2` **PASSED**; only `3b.temp.p3`/`3b.weight.p3` went red. The check
passes on the defect it is named for.

Rule 5: *"A check that cannot fail is worse than no check (a literal `|| true` shipped here)."* A
name that promises coverage over an assertion that provides none is the same hazard with better
camouflage — and it is in the commit whose own message is about checks that cannot be reached.
Either give it a real assertion (compare the first label to the `M/D` of the earliest fixture
timestamp) or delete it and let `p3` carry the claim it already carries.

---

## The mutants

Fifteen runs, twelve mutant files. Each is a byte copy of the audited `index.html` with exactly ONE
anchor site replaced — the builder script **refuses and exits** if an anchor occurs any number of
times other than once — served from its own directory on its own port, with the **fetched** bytes
md5'd against the file on disk before any result was believed. Every md5 below was verified equal
disk-vs-served at run time. Source and md5s: `.../scratchpad/d90/m/`, `meta.json`.

| # | md5 (applied, proven) | What it breaks | Result |
|---|---|---|---|
| M1 | `dfb2501179eccd2989c998cf26b2a7de` | drops one label in the **middle** of the axis | **SURVIVED 89/89** |
| M2 | `35a3bfbe5cc0d3bc7b79e890e231cece` | restores the OLD previous-label-only de-dup (undoes F2) | **SURVIVED 89/89** |
| M3 | `4a4a6466f1dd84eddfcd3ab166aaf64f` | no de-duplication at all | 4 red |
| M4 | `1cc1d073a76510237741732f60989dfc` | tick count hard-coded to 4 (A5) | 2 red — **4b kills it** |
| M5 | `bfa9034cfcb15c343a4024f2ffc97d34` | minute-format branch disabled (A6) | 2 red — **4c kills it** |
| M6 | `1ec2de8787c2d382eca4d8354257ca70` | every label one tick RIGHT of its time (A7) | **24 red** — p1/p3 kill it |
| M7 | `520fa39f508a0c558b8f09656db9db1c` | de-dup keeps the LAST of a run (A9) | 2 red — **only 3b.p3 kills it** |
| M8 | `4d46514948dac2c3f2f786c7eca239e7` | drops the `tMin + AXIS_DAY` cap (A3) | **SURVIVED 89/89** |
| M9 | `feceaed549d9b0d7a0ff0750a6a369bf` | `pad.right` back to 20 (undoes F3) | **SURVIVED 89/89** |
| M10 | `8de3352c0ea013aa3cd51248965870ae` | `chartTimeMax` ignores `now`, reads `Date.now()` (undoes F8) | **SURVIVED 89/89** |
| M11 | `58de0b48bd92bdc9faf0cfd7506eb3f2` | `dayOf` decides midnight in UTC (A4) | **SURVIVED** (also under `TZ=America/Chicago`) |
| M12 | `5679398646c4e26823ade8fd893905db` | What's New renders the DATE in the title node, hook intact | 1 red in **v89 (9.6a2)**, 1 red in v90 (5.2) |

**The four that beat my last pass are dead.** A5, A6, A7 and A9 all now red, and each dies in the
case written for it — 4b for the Months toggle, 4c for the minute branch, p1/p3 for position, 3b
for keep-last. `p3`'s anchor is sound: I confirmed the only `<circle>` elements inside either chart
SVG are data points (`index.html:11602`, `12609`), both charts `.sort((a,b) => a.ts - b.ts)` so the
earliest reading is always at `x = pad.left`, and `p3` requires `cxs.length > 0`, so it is not
vacuous on a one-reading or empty chart — section 1 runs it with exactly one dot and it passes
meaningfully.

**Five survivors, and what each one means.** M8 and M11 are pre-existing holes I reported last
pass and the delta did not claim them. M1, M2, M9 and M10 are new information:

* **M1 — nothing in 89 checks can see a dropped label.** No check asserts the axis is fully
  labelled. Every distinctness check (`new Set(labels).size === labels.length`) is satisfied *more
  easily* by dropping a label than by keeping it, so the suite is blind in exactly the direction
  F2's fix moved the code.
* **M2 — F2's fix has zero test coverage.** Old and new de-duplication are indistinguishable on
  every fixture in the suite, because inside the 28/90-day spans the tests use, `M/D` is unique
  and there is nothing for either rule to collapse.
* **M9 — F3 has no regression check.** `pad.right` can go back to 20 silently. `p1` only asks
  that the label's `x` is inside the viewBox; 646 and 660 both are. The clipping is of the
  **box**, not the anchor, and nothing measures the box.
* **M10 — the TEST_MODE date override is unprotected on both screens.** I built the discriminator
  the suite is missing and it takes one case: one reading at 09:00 on a simulated future day gives
  5 labels on the shipped code and **1 label** (`["9:00 AM"]`) under M10.

---

## F2 as a behaviour change — the brief's question, answered with measurements

**The comment's reachability claim is false.** `index.html:11457` says *"the only two spans the UI
can ask for are 28 and 90 days (`spanDays`)"*. `renderWeightTrend` still carries
`const points = filtered.length > 0 ? filtered : weightEntries.slice(-2)` (`index.html:12533`) —
**no date bound at all.** Nothing weighed in 90 days and the chart draws the last two weights ever,
however far apart. The README row repeats the same false claim in the permanent record.

Driven through the real weight report, two readings both older than 90 days:

| Fixture | OLD (M2, previous-label de-dup) | NEW (shipped, global `Set`) |
|---|---|---|
| 730d, Weeks | `8/4, 2/3, 8/4, 2/2, 8/3` — 5 labels on 5 ticks | `8/4, 2/3, ——, 2/2, 8/3` — **tick at x=350.5 bare** |
| 730d, Months | 7 labels on 7 ticks | 5 labels — **x=350.5 and x=547.5 bare** |
| 365d, Weeks | `8/3, 11/3, 2/2, 5/4, 8/3` — 5 on 5 | `8/3, 11/3, 2/2, 5/4, ——` — **the right-edge tick is bare** |
| 1095d, Weeks | 5 distinct | 5 distinct (identical) |

**Verdict: mixed, and in one case worse.** At 730 days, trading a mid-axis repeat for a bare tick
is an improvement — a date printed twice a year apart actively lies about elapsed time. At 365
days it is **worse**: the dropped label is the last one, and the dots are at `cx=[55, 646]`, so the
bare tick is the one sitting directly under the **most recent weight reading**. The caregiver loses
the date of the reading that matters most. The comment itself names the correct fix and then
declines it — *"the format needs the year — not more de-duplication, which would silently drop
labels instead"* — which is a precise description of what the code now does in the path the comment
believes is unreachable.

**So F2 is relocated, not closed.** It is cosmetic, not a data-integrity defect, reachable only
through the unbounded fallback, and it is not a blocker. The real fix is still the one I gave last
pass and which is still unbuilt: put the year in the format past ~300 days, **and** give the weight
chart the temperature chart's empty state instead of `slice(-2)`.

---

## F3's padding, measured rather than assumed

In Chromium, at the axis's own `font-size:12` / `ui-monospace,Menlo,monospace`, in user units:

    "10:36 PM" = 58.84    "12:36 AM" = 58.84    "11:58 PM" = 58.84
    "10 PM"    = 37.22    "12/31"    = 37.22    "1/1"      = 22.81

`10:36 PM` is the widest string the axis can produce at any format branch. `text-anchor="middle"`
at `x = W - pad.right = 646` puts its box at **[617.2 .. 676.0]** inside a 680 viewBox — it clears
by **4.6 units**, and I confirmed no rendered label falls outside the viewBox on the live chart.
At the old 20 the same box would overhang by ~9.4, which is the `"10:09 P"` clipping I reported.
**34 is correct.** Two caveats: the margin is 1.5% of the chart width, and the figure is Chromium's
— the comment and README call `"10:36 PM"` *"29 units wide"*, which is its half-width (29.42), the
overhang past the centre, not its width. The arithmetic the number was used for is right.

**Left padding is still sufficient** and nothing else was laid out against the old 20: y-axis
labels occupy `[12.0 .. 49.2]` (widest `100.4`) against `pad.left` 58/55, the first x-label's box
starts at 32.8, and the `Fever 100.4°F` threshold label is `text-anchor="end"` at `W - pad.right`,
so it moved 14 units left with the padding and spans `[552.3 .. 647.2]` — no clipping, no overlap
(different `y` from the axis row).

## F8, and the clock

`render()` does `const now = state.now` (`index.html:5427`), `state.now` is set from `simNow()`
(2040/2046/2052) and refreshed on the 1s tick; it threads through `renderContent` →
`renderReportDetail` → both chart functions, which use the same `now` for `minTs = now - spanDays*DAY`
and now pass it to `chartTimeMax`. **One clock per drawing — F8 is genuinely closed.** Proven live
by driving the real control (open *Beta date controls*, press *+ 1 Day* five times, Reset button
appears): the axis follows the simulated date. Under M10 the same fixture collapses to one label,
so the override would silently stop moving the axis and no check would notice (see M10 above).

## Clock and timezone dependence — F1 is closed

`test/v90-chart-axes.mjs`, unchanged, against the audited file:

    TZ=Etc/UTC            23:05 local   89/89
    TZ=Europe/Paris       00:08 local   89/89      <- eight minutes past midnight
    TZ=Asia/Kolkata       04:39 local   89/89      <- the zone/hour that reddened 6 checks last pass
    TZ=Pacific/Kiritimati 13:06 local   89/89      <- UTC+14
    TZ=Pacific/Niue       12:07 local   89/89      <- UTC-11

The `ago()` / `agoDays()` / `minuteWindow()` fixtures introduce no new clock dependence that bites:
the just-after-midnight collapse is handled by the stated floors, and the one edge I looked for —
`minuteWindow()` returning `start > end` within ~31 seconds of midnight, which would seed a
descending fixture — is absorbed because both charts sort entries by `ts` before using them. The
suite is no longer green-only-in-the-afternoon, and it is no longer green-only-in-this-container.

Worth recording: **this container is `Etc/UTC`, where `setHours` and `setUTCHours` are the same
call**, so M11 (A4) can never be caught here by a default run. I ran it under `America/Chicago`
and it still survived.

## The record

* **v88 `50/58` is the number I measured**, confirmed. The README's correction is right, and its
  note that the earlier 56/58 was "copied from a brief rather than measured" is accurate. v88 is
  **51/58** at the audited commit — same failure set minus one, so v90 does not regress it.
* **"FOUR OF THEM SURVIVED 29/29" is wrong, and the error is originally mine.** My own
  `AUDIT-app-v90.md` heading says *"Four of my ten mutants survived"* while the table directly
  under it lists **six** survivors (A3, A4, A5, A6, A7, A9); the prose then narrows to *"the four
  that matter"*. The README copied the heading. Six survived; four were closed by this delta; A3
  and A4 are still alive, which the README row does not record.
* **"All five now die: 12, 22, 2, 2 and 2 red" — I cannot confirm it and one number does not
  match.** I do not have the builder's mutant sources, so this is a reconstruction, not a
  contradiction: my equivalents of the count, minute-branch and keep-last mutants red **2, 2, 2**
  as claimed, my one-tick-right equivalent reds **24** where the README says 22, and I could not
  identify what the **12** was. Either the number or the mutant it came from should be named.
* `release_check.sh` runs and stops exactly where briefed: it reports the baseline
  (`PUBLISHED.json` → app-v89 at `a5d5908`, 2 commits having touched `index.html` since), names
  `index.html sw.js` as changed under rule 5, finds `outputs/AUDIT*app-v90*` present and
  **`outputs/PM*app-v90*.md` missing**, and halts before the remaining checks. Nothing else was
  reported before that point.

## Voice verdict on the two bullets

**Title** *"Chart dates read correctly"* — 4 words. **Bullet 1** 27 words, **bullet 2** 32 words.
**Total 63 words**, two bullets. Rule 0.9 is satisfied on every count: title inside 3–6, bullets
inside 2–4, total under the ~70 target, no mechanism, no version numbers, no team seats, nothing a
patient does not need.

* **Bullet 1 — FAILS question 1 (is it true?).** See BLOCKER-1. Readable at 2am, and wrong.
* **Bullet 2 — passes.** *"with no date printed twice"* replaced *"with nothing printed twice"*,
  and the narrowing to dates is exactly right: times within a day never collided, and dates no
  longer repeat anywhere a caregiver can reach. True, plain, and it names what to expect.
* `labelled` → `labeled` (F5) is applied and is the only user-facing instance; the remaining
  British spellings are all in code comments.

## Which of F1–F8 I consider closed

| | Closed? | On what evidence |
|---|---|---|
| **F1** fixtures made relative | **YES** | 89/89 at 00:08, 04:39, UTC+14, UTC-11 |
| **F2** global de-duplication | **NO** | reachability claim false (`slice(-2)`); labels now dropped mid-axis and at the right edge; untested (M2 survives) |
| **F3** `pad.right` 34 | **YES** as a fix | widest label measured at 58.84u, box `[617.2..676]` in 680 — but unpinned by any check (M9) |
| **F4** 29 → 89 checks | **PARTLY** | A5/A6/A7/A9 all die; A3/A4 still survive; new blind spot (M1); and one new check is vacuous (BLOCKER-2) |
| **F5** `labeled` | **YES** | only user-facing instance, applied |
| **F6** bullets rescoped | **NO** | bullet 2 fixed; bullet 1 traded an overstatement for a falsehood |
| **F7** v89 check `9.6a2` | **YES** | M12 reds it; v89 is 75/75 |
| **F8** `chartTimeMax(…, now)` | **YES** | one clock proven through `state.now`/`simNow()`, override verified live — but unpinned by any check (M10) |

## Regressions

`v90-chart-axes` **89/89** · `v89-everything-free` **75/75** (74 + the new 9.6a2) ·
`v75-no-other-patient` **29/29** (Rule 0 clean: no patient name, no new gendered pronoun — 32
against a ratchet of 32, no new id-keyed branch, all ceilings 0/0/0) · `v84-whatsnew` **100/100** ·
`v88-log-a-missed-day` **51/58**, pre-existing, one better than the app-v89 baseline.

No uncaught page errors in any run.

## What I did NOT check, plainly

* **A real iPhone or Android.** Chromium only. F3's 4.6-unit margin is Chromium's text metric; a
  wider system monospace on iOS would re-clip the last label. Nobody has looked at these two
  charts on a phone.
* **`overflow-scan.mjs`.** Not run this pass, and the pre-existing NOT CLEAN result from my last
  pass (three `"10:00 AM"` hits on Home at 320px) is still not formally proven pre-existing.
* **Non-English / 24-hour locales.** `hour: 'numeric'` yields 24-hour labels there; monotonic
  within a day, so the reasoning holds, but unrun.
* **The builder's own mutant sources**, which is why the `12, 22, 2, 2, 2` line is reported as
  unverifiable rather than wrong.
* **DST.** Covered in my previous pass (America/Chicago 2026-11-01 and 2026-03-08); not re-run,
  and the de-duplication change cannot affect it — the twice-occurring 1 AM is adjacent and is
  dropped by either rule.
* **The Enhancer pass** in `outputs/ENHANCER-app-v90.md`. Nothing from it was built; I did not
  audit its findings. Its Weight `Average` tile finding looks right to me and is the paracentesis
  average one screen across.
* **The printable/doctor's export**, which does not draw these charts.

---

## Then ship it

Fix the one sentence and the one check. Neither touches the drawing code, so the 89/89 and the
five-timezone result stand; re-run `v90-chart-axes.mjs` once after BLOCKER-2 and the re-audit is a
delta on two files. The chart fix is right, it is the fix Aaron asked for, and it should not wait
long behind two edits this small.

---

## Addendum — five commits landed above the audit target during this pass

`dc4b337`, `4fc6706`, `ddf504b`, `34e83f9`, `e99af32`. **All documentation**: TEAM.md, BACKLOG.md,
README.md. `git diff 9e34a40 HEAD -- index.html sw.js test/` is **empty**, so everything above was
measured against the code that is at HEAD and both blockers are still live there.

Re-checked at HEAD, since two of my findings are about the README:

* **Both record errors persist.** *"FOUR OF THEM SURVIVED 29/29"* is still in the row (six did),
  and *"All five now die: 12, 22, 2, 2 and 2 red"* is unchanged — my reconstruction of the
  one-tick-right mutant reds 24, and I still cannot identify the 12.
* **The new text corroborates me where it overlaps.** The row now records `v88 51/58` and
  root-causes all seven failures to one line — `pickDay` matching a calendar cell by the day
  NUMBER as text and clicking the LAST match, which is two selectors Rule 5 forbids by name, and
  which is why the count moves with the calendar month rather than with the code. That matches the
  51/58 I measured and settles a figure that had been wrong twice. The note that 7b's empty note
  box "reads exactly like silently losing a caregiver's note" and is really the suite correcting
  the wrong day is the right call and worth the space it takes.
* **One number I did not measure moved.** The row now reads `v82 15/15` where it previously read
  `v82 24/24`. I did not run v82 this pass and offer no opinion; flagging it only because a figure
  in that table changed without a release between.
* `9.6a2`'s falsification is now recorded in the row as 75/75 clean and 74/75 with the date in the
  title. **That is exactly what I measured independently** (M12), so F7 is closed on two separate
  runs rather than one.
