# AUDIT — app-v92 (Zero Day Auditor)

AUDITED-COMMIT: f6df061c80f8ce26d45a5197376b1e21e589a0a6
VERDICT: DO NOT SHIP

**Audited sha `f6df061c80f8ce26d45a5197376b1e21e589a0a6`**, branch
`claude/caretracker-team-review-i83ik2`, working tree clean, `index.html`
md5 `60f0ec0c135d757a73ad1f912a5a3060`, `sw.js` md5 `4151f4e2a332e922c1587062a688c061`.
Diff judged: `ac1577e..f6df061`. The app-v91 palette was not re-audited (five passes cleared it);
the single colour literal that moves in this diff — `#6D5247 → #6A4433` on the Resume button inside
the muted row, one site — was confirmed and measured, and nothing else in the palette was touched.

**Two blockers. Neither is a defect a patient can see today, and both are the class this release
family has already been refused for four times: a check that cannot fire, and a record whose
central proof claim is a property of a fixture rather than of the build.** Everything else below
is a finding to schedule, not a stop. The fixes are small and the measurements to re-run are
named.

---

## BLOCKER 1 — `falsify.sh`'s new over-block check is dead code, and it prints a sentence it never verified

**Severity: blocker. The change is in this diff. It cannot fire, and it asserts a fact it does not
have.**

`falsify.sh` gained this, to close a hole the fifth app-v91 audit found — a suite can exit non-zero
with no `FAIL` line, so an over-block control could be scored "SURVIVED AS EXPECTED" on a run the
suite had refused:

```
LAST_STATUS=0
run_suite() {
  local _out
  _out=$( cd "$WORK" && env -u ... node "$SUITE" 2>&1 )
  LAST_STATUS=$?
  printf '%s\n' "$_out" | grep -E "^  FAIL|checks:" || true
}
```

`run_suite` is called in exactly two places, `falsify.sh:141` and `falsify.sh:207`, and **both are
command substitutions** — `BASE=$(run_suite)` and `OUT=$(run_suite)`. A command substitution runs
in a subshell, so `LAST_STATUS=$?` is assigned in a child process and discarded. In the scoring
code `LAST_STATUS` is permanently its initialised `0`, so

```
elif [ "$EXPECT" = "survive" ] && [ "$LAST_STATUS" -ne 0 ]; then   # OVER-BLOCK
```

can never be true. The branch added in this commit is unreachable. The code comment says
*"`$LAST_STATUS` is the suite's own"*; it is not.

**Proved twice, not reasoned.**

*(a) A sweep.* Mutant corpus written outside the repo
(`<scratchpad>/zda/mutants-zda-overblock.sh`), run against the shipping HEAD with the repo's own
`falsify.sh`:

```
FALSIFY_PORT=9307 ./falsify.sh test/v92-text-collisions.mjs <scratchpad>/zda/mutants-zda-overblock.sh
```

Mutant 1 injects `setTimeout(function(){ throw new Error("zda-overblock-probe"); }, 1600)` before
the document's closing `</body></html>` and is labelled `MUTANT_EXPECT_1="survive"`.
`v92-text-collisions` records a page error into `fails` but prints **no `^  FAIL` line** for it and
**does** print its `checks:` summary, so it exits 1 looking green — precisely the hole. The sweep
printed:

```
=== MUTANT 1: an async throw in the page -- non-zero exit with no FAIL line, the hole the new branch was written for
15 checks: 12 passed, 3 failed   (650 in-flow text runs compared)
  ✅ SURVIVED AS EXPECTED -- the suite stayed green on a change a real release could
     legitimately contain, and exited 0. That is this mutant's job: it is the
     over-block control.
```

The suite exited **1**. The sweep said **"and exited 0"** — a sentence this commit added. Mutant 2
(a benign `background-position` animation, exit 0) printed the identical verdict, so the two are
indistinguishable, which is the whole thing the branch exists to distinguish.

*(b) The wiring, in isolation* (`<scratchpad>/zda/subshell-proof.sh`, the same shape, twelve lines):

```
captured output : 15 checks: 12 passed, 3 failed
LAST_STATUS seen by the scoring code: 0   (the suite really exited 1)
=> OVER-BLOCK branch is DEAD; falls through to 'SURVIVED AS EXPECTED ... and exited 0'
--- and the same function called WITHOUT command substitution ---
LAST_STATUS = 1
```

**Why this is a stop and not a note.** Rule 5: *"A check that cannot fail is worse than no check."*
This is a check that cannot fire, in the file whose only job is proving that checks fire, shipped in
the commit that writes down why the hole mattered. And it does not merely fail silently — it prints
**"and exited 0"** about runs that did not, which is the standing finding of this release family
(records asserting more than the code guarantees) reproduced inside the falsification harness
itself.

**Fix, size S.** Stop capturing `run_suite` through a substitution. Either have it write its output
to a variable the parent reads (`run_suite; OUT="$LAST_OUT"`), or emit the status into the captured
text and parse it back out. Then re-run the sweep above: mutant 1 must print `❌ OVER-BLOCK` and
mutant 2 must still print `✅ SURVIVED AS EXPECTED`. Both mutants are written and are the
falsification; keep them in `falsify/` rather than in a scratch directory, for the reason
`falsify/mutants-contrast-overlays.sh`'s own header gives.

---

## BLOCKER 2 — the arbiter says the overflow MOVED again. "0 overflowing elements" is a property of the fixture, not of the build

**Severity: blocker on the record. The pixel is latent, not visible, and I say so plainly below.**

`test/overflow-scan.mjs`'s `SEED_ENTRIES` (`test/overflow-scan.mjs:82`) has never carried an entry
with `override: true` or `skipped: true`. So the one badge a Home timeline row or a History row can
render has never been in front of the instrument the record calls *"the arbiter here, and reasoning
was not"*.

I added **one line** to that fixture — `override: true,
overrideReason: 'offDay+early+overLimit', skipped: true` on the existing `s1` entry, nothing else
changed, the suite's own code untouched — and ran the repo's unmodified scan against byte copies of
both builds:

| build served | `overflow-scan` result |
|---|---|
| `ac1577e` (pre-v92), md5 `165a7a70dd4cc8547cbb4178901e0996` | **3 overflowing** — `"10:00 AM"` `<div>` by **5px**, 320px only. The badge does not overflow. |
| `f6df061` (shipping), md5 `60f0ec0c135d757a73ad1f912a5a3060` | **6 overflowing** — `"Not scheduled · Early · Over limit"` `<span>` by **21px at 320px** and by **11px at 330px**. The time cell is fixed. |

Both runs: `170 of 170 screen/width combinations scanned`, `NOT CLEAN`. The 6 are one element at two
widths, counted three times each because Home is walked as `HOME`, `NO-STAY:HOME` and
`NO-DATES:HOME` — the same arithmetic the record uses for the 3.

**The mechanism, measured rather than inferred.** The content column took `minWidth: '0'` and the
name took a `<span>` with `minWidth: '0'`, so the name line can now shrink below its own min-content
— which is the fix, and it works. The badge `<span>` sitting beside the name on that same line got
neither `minWidth: '0'` nor `flexShrink: '0'`, and `overflow-wrap: break-word` — which it *does*
inherit from the line, as the comment says — **does not reduce a flex item's automatic minimum
size**; only `overflow-wrap: anywhere` or `word-break: break-all` does. So the badge is handed
exactly its min-content and overflows the line. Measured at 320px on the shipping build:

```
name line (flex, wrap) width  68.3px
badge span width              89.5px   -> overflows its flex parent by 21.2px, 5 lines tall
same figures at 330px         78.3 / 89.5 -> 11.2px
345 / 360 / 390               93.3 / 108.3 / 138.3 -> badge fits, 0px
pre-v92, every width          parent 144.8 = badge 144.8 -> 0px (the LINE overflowed instead,
                                                            and a line is a non-leaf, which
                                                            overflow-scan does not consider)
```

That last row is the whole story: before the fix the overflow sat on an element `overflow-scan`
skips by design (leaves only); after the fix it sits on a leaf, which is why the scan can see it at
all — once its fixture renders one.

**Reachable, not contrived.** `index.html:3216-3220` pushes `offDay`, `early` and `overLimit` into
`reasonParts` independently, and the comment beside it describes the simultaneous case as the
reason the field exists at all. Both patched row sites render this badge (`index.html:7052` Home,
`index.html:12022` History). A caregiver who force-logs a dose on an unscheduled day, early, and
over the daily limit gets this label.

**What a person sees today: nothing.** I am stating this as flatly as the finding, because the four
previous passes were refused for records claiming more than the code guarantees and the mirror image
is just as bad. At 320px the badge's right edge is still **~58px inside the row's content edge** and
**~73px inside the white card**; `v92-text-collisions` reports **0 collisions** on the same fixture;
nothing is clipped and nothing is illegible. There is roughly 6px of clearance before the Remove
button. It is a latent overflow with a 21px margin of error, not a clipped glyph.

**So why block.** Because of what the record says about it:

* `README.md`, app-v92 row: *"**`overflow-scan` is the arbiter here and reasoning was not** — it
  went 3 → 1 → 12 → 0 findings across those attempts. **Final: 170 of 170 screen/width
  combinations across ten device widths, 0 overflowing elements.**"*
* `outputs/DEV-BRIEF-app-v92.md`: *"The scan reports the worst offender per combination, **so a fix
  that merely relocates the overflow is caught by the same run.**"*

The second sentence is disproved by the same run. The overflow *did* relocate — to a new width the
original defect never reached (330px) and at four times the magnitude — and the run did not catch
it, because the arbiter's fixture cannot render the element the fix newly allowed to shrink. The
builder recorded that two earlier attempts relocated this exact overflow and that the scan was the
thing that caught them; the step not taken was widening the arbiter to the siblings on the line
being changed. `overflow-scan.mjs`'s own header names this trap: *"A fixture of short names would
make this suite green on the broken build — the empty-Home trap `overflow-scan.mjs` paid for twice,
in its third costume."* This is the fourth costume: not short names, a missing badge.

**Fix, size S, two parts, and the second is the one that matters.**
1. Give the `override` and `skipped` badge spans at `index.html:7052-7055` and
   `index.html:12022-12025` (and the `Missed` badge at `index.html:5921` for the class, not the
   instance) `minWidth: '0'`, the same one line the name span got. Then the badge shrinks and breaks
   like the name does.
2. **Add an `override` + `skipped` entry to `test/overflow-scan.mjs`'s `SEED_ENTRIES`**, so the
   arbiter can see the elements it is being quoted about. Falsify it: without part 1 the scan must
   report 6; with part 1, 0.
3. Re-state the README's "0 overflowing elements" as what it is — 0 on a fixture that renders no
   badge — or make it true.

---

## Findings to schedule

### F3 (MEDIUM) — three records say the paused row "is measured from here on". It is *rendered*, not measured, and the gate is green on the broken build

The new `contrast-scan.mjs` fixture seeds a paused medication, and the count claim reproduces
exactly: **310 → 327 distinct strings, 0 below AA, worst 4.76:1.** The displacement check the brief
asked for is clean — per-screen, Home 63→72 and Meds 26→34, every other screen unchanged, so the
new fixture is purely additive and nothing that used to be measured was displaced.

But I ran **HEAD's `contrast-scan.mjs`, unmodified, against the pre-v92 `index.html`** on its own
port:

```
327 DISTINCT strings measured (607 samples), 0 below AA, worst 4.83:1
327 checks: 327 passed, 0 failed          <- on the build whose muted rows paint at 3.4:1
```

**The gate cannot tell `opacity: 0.65` from `opacity: 0.8`.** It renders the row and then reads the
text's own opacity (1), so it measures the ink unmuted — it prints 8.44:1 for text painted at
3.44:1. The opacity fix is protected by nothing, and `BACKLOG.md` M38-b admits precisely this one
bullet *after* asserting the opposite:

* `index.html:4921` — *"The scan now seeds a PAUSED medication so this row is measured from here on."*
* `test/contrast-scan.mjs` header — *"seeds a PAUSED medication below so the row is measured here from now on"*
* `BACKLOG.md` M38-b — *"`contrast-scan.mjs` now seeds a **paused** medication, so the row is measured on every run from here."*

All three should read *rendered*, with one sentence saying the row's own number is still the unmuted
one until M38-b is closed. `README.md` is the only one of the four that is accurate, because it
claims only that the count moved.

**The tell nobody read:** the scan's worst ratio went **4.83:1 → 4.76:1** across a release whose
subject was raising contrast. If those rows were being measured it would have moved the other way.

### F3b — the opacity change itself is right, and every figure reproduces from pixels

Measured independently, full-viewport screenshot decoded in-page, darkest pixel of each glyph run
against the card's painted white, 390px:

| row / string | pre-v92 (0.65) | app-v92 (0.8) | at 0.75 |
|---|---|---|---|
| paused title `#554A52` | **3.44:1** | **4.94:1** | — |
| paused caption `#5C4E52` | **3.31:1** | **4.70:1** | — |
| Resume label | **3.14:1** (`#6D5247`) | **5.00:1** (`#6A4433`) | — |
| treatment-excluded title `#554A52` | **3.41:1** | **4.92:1** | **4.34:1** |
| treatment-excluded caption `#5C4E52` | **3.30:1** | **4.70:1** | **4.14:1** |

The record's figures (3.41 / 3.30 → 4.92 / 4.70, and "0.75 was tried and still fails, 4.33 / 4.14")
reproduce to the second digit. `#554A52` and `#5C4E52` unmuted on white are **8.44:1** and
**7.88:1**, exactly as claimed. A mutant restoring `#6D5247` on the Resume button at
`opacity: 0.8` (md5 `8530af6ce43846d79d7cb2842d36a624`) measures **4.38:1** — below AA — so that
one-site ink change is load-bearing and the claim holds. `#6D5247` appears at **12 code sites**
plus the 2 comment mentions, none of the 12 inside a muted row (`index.html:6773` is the
*standalone* card's Resume and carries no opacity), so "twelve other places, none of them muted" is
right.

**Two things nobody measured and one of them is now measured.** The treatment-excluded row is the
*second* `opacity: '0.8'` site and `contrast-scan`'s new fixture does **not** render it — only the
paused row. I rendered it (`treatmentMode: 'excluded'` plus a `chemo_date` entry; the prefs
`chemoDate` key alone does not do it, `chemoDayList()` reads entries) and it is fine, above. The
`opacity: '0.55'` disabled Daily-limit input I could **not** reach: no fixture opens the editor with
a locked field and I could not drive it by hook. On the merits it is almost certainly exempt —
WCAG 1.4.3 places no contrast requirement on text that is part of an *inactive* user interface
component — and `BACKLOG.md` already says to measure before deciding. Worth writing the exemption
down rather than leaving it open, since an exemption nobody wrote down is indistinguishable from an
oversight.

### F4 (MEDIUM) — `v92-pill-clearance` does not do what its brief says about vacuous screens

The brief: *"A screen that failed to seed must FAIL, not pass by being too short to clip anything.
That is the empty-Home trap `test/overflow-scan.mjs` paid for twice."*

What shipped refuses only when **not one** screen scrolled (`scrolledScreens === 0`). I copied the
suite outside the repo, set its fixture loop to seed **zero** readings, and ran it against the
shipping build:

```
EXIT=0
18 screen×width combinations at end-of-scroll, 5 of them genuinely scrolling, 6 report screens discovered
PASS — nothing is hidden behind the Back pill at the end of any report screen.
```

**13 of 18 combinations vacuous and it passed**, because the appetite screen scrolls on app chrome
alone, so the guard never fires. On the real run **4 of 18 are already vacuous**: `blood_pressure`
at all three widths — the fixture seeds no blood-pressure readings at all, so that report screen's
end-of-scroll has never been tested — and `bowel_movement` at 390. To the suite's credit it prints
`(short (vacuously clear))` per row and the record quotes *"14 of them genuinely scrolling"* rather
than 18, so the record is honest; the gap is between the brief's promise and the code. *Fix, size S:*
fail any screen that did not scroll, or seed every report type the fixture walks.

The **other** two guards do fire, verified:
* Removing `data-report-tile` from the Reports tiles (mutant md5 `d21f925d6d84d0e0a7515c417beb26af`,
  byte-verified on disk and as served on its own port) → **exit 3**, `REFUSING: the Reports menu
  rendered no [data-report-tile] elements`. Exit 3 is non-zero, so `release_check.sh` scores it a
  failed suite and the gate's verdict changes. Good.
* `v92-text-collisions` cannot pass vacuously: with its fixture emptied entirely it dies on the
  nav click, **exit 1**. Its `runsTotal < 100` backstop is therefore unreachable in practice, but
  the louder failure comes first, which is the right order.

### F5 (MEDIUM-LOW) — the suite walks 6 of the app's 9 report sub-screens, and two records say "every"

`index.html:11848` `reportTypes` holds nine: `history, weight, temp, paracentesis, blood_pressure,
radiation, cycle, bowel_movement, appetite`. Three are filtered out unless the profile enables them
— `cycle` (non-male **and** `homePref('cycleTracking')`), `radiation` (`treatmentType` radiation or
both), `paracentesis` (`homePref('paracentesisTracking')` or resolved entries). The suite's fixture
enables none of the three, so it discovers **six** tiles and 18 = 6 × 3.

`DEV-BRIEF` "Done means" says *"on **every** Reports sub-screen"*; `DESIGN` says *"on every report
screen at all three widths"*. The suite's own header is the accurate one — *"every report sub-screen
the Reports menu offers"*.

**I walked all nine myself** (`treatmentType: 'both'`, `sex: 'female'`,
`homeCards: {cycleTracking: true, paracentesisTracking: true}`) at 280/300/320/330/345/360/390:
tiles `[history, weight, temp, paracentesis, blood_pressure, radiation, cycle, bowel_movement,
appetite]`, pill top a constant **714** in an 844px viewport (= the recorded 130px above the
viewport bottom), and **0 glyph boxes under the pill on all nine screens at 320/330/345/360/390**.
So the fix does cover all nine — the padding is applied for any `reportsView`, not per screen. The
hole is in the verification and the wording, not in the code.

Also: the brief's *"completeness check over the Reports sub-screen list: if a seventh sub-screen is
added without a clearance assertion, the suite fails"* is not what shipped. Discovery from the app
is better than a written list, but the only guard is zero-tiles; `tileCount` is compared **only
across widths**, so removing `data-report-tile` from *some* tiles silently narrows the walk and
nothing says so.

### F6 (LOW) — nine of the gate's ten suites can be deleted to pass it

`release_check.sh:884`: `[ -f "$RC_SUITE_DIR/$SUITE" ] || continue`. `v75-no-other-patient.mjs` gets
an explicit `else` branch that fails the gate and says *"Deleting it is not a way to pass this
gate."* The nine in the loop — including the two added in this commit and `v90-chart-axes` — get a
silent `continue`. Everything else about the wiring is sound and I checked it: `fail_note` sets
`FAIL=1`, the bottom of the script exits 1 on `FAIL`, the server's md5 is compared against the
export before any suite runs, `overflow-scan` resolves `../index.html` relative to its own location
so under `cd "$RC_SUITE_DIR"` it scans the gated tree, the two new suites read `FALSIFY_BASE` which
points at that verified server, and the designer pass is given positional args rather than
`--base`. The `env -u` addition is necessary and correct: `overflow-scan` refuses on the mere
presence of `HTTPS_PROXY` with exit 3, which the loop scores as a failure.

### F7 (LOW) — the "~17 minutes" line was not recalculated for the three suites this commit adds

Measured on an idle box against the shipping file: `v90-chart-axes` **69s**, `v92-pill-clearance`
**35s**, `v92-text-collisions` **28s** — **132s** on top of what the comment's arithmetic covers.
Separately `overflow-scan` ran in **~7 minutes** here, not the 13 the comment states;
`contrast-scan` ~6-7 min, `v84-whatsnew` 137s, `v89-everything-free` 72s, the `v76` pair 14s, the
designer pass 18s. So "about four minutes to about seventeen" is arithmetic from the app-v91 loop,
left in place while three suites were added beneath it. The number is nobody's measurement now.
On this box the loop looks closer to 13-15 minutes; on a slower runner it will exceed 17.

### F8 (LOW) — the two new suites ship with no committed mutant corpus

`falsify/` holds only `mutants-contrast-overlays.sh` and `mutants-v84-whatsnew.sh`, and both new
suites read `FALSIFY_BASE`, so both *can* be swept. `TEAM.md`'s own rule is that a corpus "belongs
beside the scan, not in a scratch directory", because four audits rebuilt the same corpus from
prose. The padding falsification was done by hand and it is exact — I reproduced all five figures
below — but it is not reproducible from the repo by anyone who did not read this file.

### F9 (LOW, Voice) — "Nothing covers anything" is not true, and the third fix has no bullet

`outputs/DESIGN-app-v92.md` states that **mid-scroll the Back pill still floats over a row, and that
this is deliberate** — correctly, and it says so out loud. A patient told *"Nothing covers
anything"* who then sees the pill sitting on a row mid-scroll has been read something untrue. The
brief's own draft title, *"Back button no longer covers rows"*, was narrower and true. Rule 2.7:
*not "roughly right" — true.*

The entry is otherwise well within Rule 0.9 — 3-word title, 2 bullets, **54 words** against a ~70
target, no mechanism, no version numbers — and both bullets are true as written, though *"It wraps
onto its own line now"* describes a name that wraps **within its own column**, not onto a line of
its own. The contrast fix is user-visible (two rows of live text from ~3.4:1 to ~4.9:1) and has no
bullet; Rule 0.9 allows up to four.

### F10 (LOW, record) — "`release_check.sh` gained four suites"

The diff adds **three**: `v90-chart-axes`, `v92-pill-clearance`, `v92-text-collisions`.
`overflow-scan` and the designer pass were already in the loop at `ac1577e` — they landed in the
app-v91 documentation remediation. `outputs/DEV-BRIEF-app-v92.md`'s transplant checklist says three
and is right; the `README.md` row says four.

### F11 (informational, out of scope, and I did not measure it against the old build)

At **280px and 300px** the Back pill is displaced below the fold on the Weight and Paracentesis
report screens — pill top **796** and **859** in an 844px viewport, where every other screen reads
714. That is horizontal-overflow-driven mobile layout-viewport scaling, not the pill's own CSS. Both
widths are below the app's supported floor and below `overflow-scan`'s narrowest device (320), and I
did **not** run the comparison against `ac1577e`, so I am recording it as unmeasured rather than
calling it a defect. If anyone ever supports a 280px-class viewport, start here.

---

## What reproduced, exactly

Every figure below was re-measured on byte copies served from their own ports, md5-verified on disk
and as served.

| claim, as recorded | measured here |
|---|---|
| `v92-text-collisions` before: 2 collisions, 320px Home, worst `"8:00 AM"` over `"Hydroxychloroquine"` 31×16px | **identical**, exit 1 |
| `v92-text-collisions` after: 0 collisions, 15 checks, 650 in-flow runs on both builds | **identical**, exit 0, 650 both |
| `overflow-scan` on the shipping file: 170/170, 0 overflowing | **identical**, `CLEAN` — *on the repo's own fixture; see Blocker 2* |
| `overflow-scan` on `ac1577e`: `"10:00 AM"` over by 5px, 3 findings | **identical**, `NOT CLEAN` |
| pill top a constant 130px above the viewport bottom | **714 in an 844 viewport = 130**, at every width and on all nine report screens |
| `v92-pill-clearance`: 18 combinations, 14 genuinely scrolling, 6 screens, 0 covered | **identical**, exit 0 |
| padding reverted to `calc(90px + …)`: History 35×7 / Temp 50×7 at 320, 15×7 / 30×7 at 360, 15×7 Temp at 390, Weight none, History none at 390 | **identical, every cell**, exit 1, 5 failures (mutant md5 `b83871e4456fa4d17467c956b374db17`) |
| `"10:00 AM"` measures 66.31px at 14px `ui-monospace` | **66.31px** |
| the break opportunity is a plain U+0020, not U+202F | **`U+0031 U+0030 U+003A U+0030 U+0030 U+0020 U+0041 U+004D`** |
| the time cell's used width is now `max(min-width, content)` | `flexShrink: 0`, `minWidth: 58px`, used **66.31px** |
| `contrast-scan`: 310 → 327 strings, 0 below AA, worst 4.76:1 | **identical**; displacement check clean (Home 63→72, Meds 26→34, all others unchanged) |
| muted rows 3.41:1 / 3.30:1 → 4.92:1 / 4.70:1, painted | **identical** (excluded row); paused row 3.44/3.31/3.14 → 4.94/4.70/5.00 |
| 0.75 still fails at 4.33 / 4.14 | **4.34 / 4.14** (mutant md5 `e2d5104aec0ed39becc263ed89db7f3d`) |
| `#6D5247` composites to 4.34:1 even at 0.8 | **4.38:1**, below AA (mutant md5 `8530af6ce43846d79d7cb2842d36a624`) |
| `#554A52` / `#5C4E52` would print 8.44:1 / 7.88:1 unmuted | **8.44 / 7.88** |
| `#6D5247` used in twelve other places, none muted | **12 code sites**, none inside a muted row |
| `test/v92-designer-pass.mjs` is `v91`'s with no change | **byte-identical** |
| all ten suites green on the shipping file | **green**: `v76-properties-equivalence` 22/22, `v76-empty-window-render` 13/13, `v89-everything-free` 75/75, `v84-whatsnew` exit 0, `contrast-scan` 327/327, `overflow-scan` 170/170, `v90-chart-axes` exit 0, `v92-pill-clearance` exit 0, `v92-text-collisions` 15/15, `v92-designer-pass` exit 0, plus `v75-no-other-patient` 29/29 |
| `APP_VERSION` → `app-v92`, `sw.js` CACHE → `chemowell-app-v92-1` | both present, moved together |
| the only colour literal that moves is `#6D5247 → #6A4433` at one site | **confirmed**, one site |

**Could not reproduce (historical, not in the repo):** `overflow-scan` "went 3 → 1 → 12 → 0 findings
across those attempts"; "Remove went 17px off the right edge"; "the name overflowed its own 68px
column by 23px". The intermediate builds are not committed. The 68px figure is corroborated — I
measure the name line at **68.3px** at 320px on the shipping build.

## Mutants built (all outside the repo, md5-verified on disk and as served, each on its own port)

| port | what | md5 |
|---|---|---|
| 9301 | `f6df061` byte copy (reference) | `60f0ec0c135d757a73ad1f912a5a3060` |
| 9302 | `ac1577e` byte copy (reference) | `165a7a70dd4cc8547cbb4178901e0996` |
| 9303 | page padding reverted to `calc(90px + …)` | `b83871e4456fa4d17467c956b374db17` |
| 9304 | Resume ink back to `#6D5247` at `opacity: 0.8` | `8530af6ce43846d79d7cb2842d36a624` |
| 9305 | both muted rows at `opacity: 0.75` | `e2d5104aec0ed39becc263ed89db7f3d` |
| 9308 | `data-report-tile` removed from the Reports tiles | `d21f925d6d84d0e0a7515c417beb26af` |
| — | `overflow-scan.mjs` with one `override`+`skipped` entry added to `SEED_ENTRIES` (suite copy, app untouched) | Blocker 2 |
| — | `falsify.sh` mutant corpus: async page throw labelled `survive`, plus a benign CSS over-block control | Blocker 1 |

`index.html` and `sw.js` in the repo were never edited. No server I did not start was stopped;
8899, 8964, 8975, 8901, 8921, 8941 and 8942 were left alone.

## What I did NOT check, stated rather than skipped

* **Safari, and any real device.** This is Chromium at Apple viewport sizes. The badge min-content
  width in Blocker 2, the `overflowWrap` behaviour, the `-webkit-text-fill-color` the contrast gate
  depends on, and every painted-pixel ratio above are Chromium numbers. A clean run narrows the
  search; it clears nothing on WebKit. The Designer's four-item phone list stands.
* **iOS Dynamic Type / Android font scaling as such.** These layouts are in fixed `px`, so I used
  narrower viewports (280, 300, 330, 345) as the geometric stand-in and said so. That is not the
  same test.
* **The `opacity: '0.55'` disabled Daily-limit input.** Still unmeasured — I could not drive the med
  editor to a locked field by hook. See F3b for why it is probably exempt anyway.
* **`release_check.sh` end to end.** I read the wiring and traced every failure path to the verdict,
  and ran all eleven suites it calls individually against the shipping file, but I did not execute
  the gate itself (it needs a clean export and ~15 minutes, and Blocker 1 is in `falsify.sh`, which
  the gate does not run).
* **The app-v91 palette**, by instruction. Five passes cleared it; I confirmed only the one literal
  that moves in this diff.
* **`v82-*`, `v83`, `v85`, `v86`, `v87`, `v88`, `v77`, `v78`, `v79`, `v80`, `v81` and the other
  suites in `test/`** that `release_check.sh` does not call. Out of scope for this diff.
* **Whether 280px/300px behaviour (F11) is a regression.** Not measured against `ac1577e`.
* **`care-tracker`.** Not opened, not cloned, nothing run against it. Rule 0.0.

## Re-audit, if these are fixed

A delta pass, not a full one. The three things that must be re-run and shown:
1. The `falsify.sh` sweep with the two mutants above — mutant 1 `❌ OVER-BLOCK`, mutant 2
   `✅ SURVIVED AS EXPECTED`.
2. `overflow-scan` with an `override`+`skipped` entry in `SEED_ENTRIES` — red without the badge
   `minWidth: '0'`, `CLEAN` with it, and the 170/170 figure re-quoted against the widened fixture.
3. The three sentences in F3 corrected to say *rendered*, and the README's "four suites" and
   "~17 minutes" either measured or dropped.

Nothing in this audit asks for a wider release. F4, F5, F6, F7, F8 and F9 are schedulable and I
would not hold a release for any of them on its own.
