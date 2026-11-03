AUDITED-COMMIT: 36cc61bc17035af657d0554ae432ac6bc3faec5a
VERDICT: SHIP

# AUDIT — ChemoWell app-v92, SECOND delta pass (Zero Day Auditor)

Scope: the delta `217f999..HEAD` only. The blocker the previous pass raised is dead, and it is dead
by measurement rather than by argument. Nine findings were remediated; I attacked the remediation
and seven notes come back, none of them release-blocking. Three releases are stacked behind this
one and nothing here is worth holding them for.

## Tree facts, verified before anything else

    HEAD        36cc61bc17035af657d0554ae432ac6bc3faec5a   (tree clean, branch as briefed)
    index.html  e62bc8df843735237b57ecce8460ed62
    sw.js       4151f4e2a332e922c1587062a688c061

All three match. `index.html` moved exactly once in this delta (one `data-page-shell` attribute
plus a comment); `sw.js` did not move.

## THE BLOCKER IS CLOSED, AND THE GATE AROUND IT WAS MEASURED IN SITU

`node --check` over every `test/*.mjs`: **68 suites, all parse.** `contrast-scan` runs green.

The previous remediation said the parse gate's in-situ behaviour was argued rather than measured,
because the chain gate `stopped_early` (release_check.sh lines 716/745) before reaching it. I built
that tree: a clone outside the repo, chain artefacts fabricated so the chain gate clears, then the
ORIGINAL defect reintroduced byte-for-byte (an unescaped backtick in a comment inside `seed()`'s
template literal).

* **Broken:** the gate reaches the block and fires in **6.3 seconds**, naming the file and printing
  node's own error under it, and the suite loop `break`s. Eleven minutes of `overflow-scan` are not
  spent on a dead instrument.
* **Restored:** `every test/*.mjs parses (68 suite(s), node --check)` at line 13 of the run, and the
  gate then proceeds into the suite loop.

Falsified both ways, in place. This is the one thing the last pass could not say.

## Findings

**F1 — moderate, and it is the class this file already carries scars for. When the parse gate
fires, the gate claims it ran everything.** Measured output of the broken run, verbatim:

      RELEASE CHECK FAILED. Everything this run found, in one place:
       - a suite in test/ does not parse -- it cannot fail, so it is not a check
       The whole gate ran, so this IS the complete list -- fix all of it before re-running.

The whole gate did not run. `RC_PARSE_BAD=1` broke the suite loop and **ten suites never executed**,
yet the summary tells the operator this is the complete list. That is precisely the under-reporting
the block at release_check.sh:17-37 was written to end, arriving through the one door left open: it
distinguishes `exit 1` hard stops from accumulated failures, and the parse gate is a third thing —
an accumulated failure that silently truncates the run. Exit code is correct, message is not. Fix:
when `RC_PARSE_BAD=1`, print the partial-list wording, or call `stopped_early`.

**F2 — moderate, corpus label. Mutant 7 is `survive`, and by this harness's own definitions it is a
`hole`.** falsify.sh:180 defines `survive` as an OVER-BLOCK CONTROL — "it changes something a real
release might legitimately contain ... If such a mutant is caught, that is a false alarm." Removing
`flexShrink: '0'` from the time cell is not something a real release legitimately contains; it is
the deliberate removal of defence-in-depth, and it has a ticket (M39-e), which is falsify.sh:186's
definition of `hole`. I drove the real scoring block through the consequence:

    survive + a FAIL line  ->  OVER-BLOCK  "Fix the check, not the mutant."   sweep exit 1
    hole    + a FAIL line  ->  CAUGHT      "the hole is closed; update to die" sweep exit 0

So on the day a row appears that the time cell does carry, and `overflow-scan` catches it, this
label instructs the next session to **weaken the scan**. Mutant 9 — the same shape, an instrument
mutant with a ticket — is correctly `hole`. One-character class of fix; it changes no measurement.

**The measurement behind the relabel survives attack, and that matters more than the label.** I
re-ran `falsify/probe-timecell-width.mjs` on the shipped build and on mutant 7: identical
(`used 58.03/66.31`, `text 58.03/66.31`, 0 squeezed, `flex-shrink` reading 1 in the mutant, so the
mutation applied). Then I asked whether the fixture was too kind and built a deliberately hostile
one — a 43-character name containing a 24-character unbreakable token, a 38-character dose label,
all three badges on every row, 320px. **Still 0 squeezed in both builds.** The property is genuinely
inert. `survive` is an honest conclusion wearing the wrong label.

**F3 — minor, and NOT reproduced; I say so rather than asserting it.** `overflow-scan`'s
`ovfFailed = report.length + unreachable + (errs||warns ? 1 : 0)` can in principle exceed
`ovfTotal = combinations + 1`, because one screen/width combination can push **two** entries into
`report` — the layout-viewport branch (lines 735 / 761) and the per-element branch (746 / 772) — while
the denominator counts combinations. The ceiling is tight: a mutant that overflowed every
combination printed `171 checks: 1 passed, 170 failed`, so one double-push makes the "passed" count
negative. I tried twice to fire the layout-viewport branch (a 900px fixed block; then a 40-character
nowrap block at 40px) and could not, so this stays a code-reading finding, not a measurement.
Separately, the device-level fixture-failure branch (line 637) adds `unreachable += SCREENS.length`
and then skips the `EXTRA` loop entirely, so `EXTRA_COUNT` combinations go uncounted — an
under-count. **Neither can produce a false green:** `ovfFailed == 0` still implies `unreachable == 0`,
which implies all 170 were scanned. The arithmetic is wrong only on runs that are already red.

**F4 — minor, and it closes M39-d's open question by measuring it, which is what that item asked
for.** The Paracentesis report at 320px **side-scrolls by 8px**: `window.innerWidth` 328,
`document.documentElement.scrollWidth` 328 on a 320px viewport. That is why that one combination
reports `innerH 866` and a pill top of 736 instead of 714 — the layout viewport has been widened,
not the pill moved. The widest in-flow element is the three-up stat grid's "Since last / Today"
card (`gridTemplateColumns: 'repeat(3,1fr)'`, index.html:12600). **Pre-existing, not app-v92:** that
grid's geometry has not changed since the commit that introduced it (only a text ink in app-v91),
and the `TYPE` scale has never changed at all. Backlog. It is invisible to `overflow-scan` because,
per M39-c, that suite walks no report sub-screen — a gap the remediation had already logged.

**F5 — minor.** `falsify/probe-badge-row.mjs` as committed throws at 320px
(`page.screenshot: Clipped area is either empty or outside the resulting image`), so re-running the
committed evidence yields the measurements but not the committed PNGs. The measurements reproduce
exactly: 320px badge box 77x110, 6 line boxes, text overflow 0, `scrollWidth == innerWidth`.

**F6 — minor, record.** `MUTANT_EXPECT_10` was deleted rather than set to `die`. It behaves
correctly (`EXPECT="${!expect_var:-die}"`), but the comment says "RELABELLED FROM `survive` TO
`die`" and a reader grepping for the label finds nothing. M39-e's heading has the mirror-image
defect: it still says mutant 7 is "labelled `die`" while its own body says `survive`.

**F7 — minor, record.** `outputs/SWEEP-v92-layout-overflow-group.txt` is the PRE-relabel run. Its
body scores mutant 7 "SURVIVED -- no check went red", its tally reads "1 survived unexpectedly" and
`EXIT=1`, while the corpus now labels that mutant `survive` — under which the group exits 0. The
prose above it explains this; the raw output contradicts the current corpus. Re-running costs 29
minutes, so this is a note, not a demand.

**One surface still unrendered by anybody.** `missedRow`. By construction its badge is the literal
`'Missed'` — one six-letter word — so it cannot produce the multi-line wrap that
`overrideBadgeLabel()` does, which is why I did not hold the release for it. It remains the only one
of the three row sites nobody has put on a screen.

## The design judgement was attacked and it held

The last pass said the History row and `missedRow` carry the same markup and were not rendered. I
rendered the History report at four widths with an override+skipped fixture. It is **milder** than
the Home row the argument was made about, not worse:

    width   History badge box   lines   text overflow   page side-scroll
    320     101 x 74            4       0               none
    330     111 x 74            4       0               none
    360     141 x 38            2       0               none
    390     171 x 38            2       0               none

Home at 320px is 77x110 over 6 lines. So the worst case in the app is the one that was rendered and
argued, and the surface nobody looked at is better. The judgement in
`outputs/DESIGN-app-v92-delta.md` stands: a contained ugly wrap at 320px beats a badge running 21px
into the Remove control.

## Everything I reproduced, with the numbers I got

    contrast-scan            327 checks: 327 passed, 0 failed    exit 0    28.3s
    v92-pill-clearance       27 checks: 27 passed, 0 failed      exit 0    47.1s
    overflow-scan            171 checks: 171 passed, 0 failed    exit 0    7m13.9s  (170 of 170 scanned)
    v92-text-collisions      15 checks: 15 passed, 0 failed      exit 0
    v75-no-other-patient     29/29, pronoun ratchet 32 of 32     exit 0
    v76-properties-equiv.    22/22                               exit 0
    node --check test/*.mjs  68 suites, all parse

Mutants, byte copies outside the repo with md5 recorded, each served on its own ephemeral port:

    data-page-shell removed      27 of 27 red, exit 1 — the null branch does fire, the hook
                                 cannot be quietly deleted
    BACK_PILL_GAP = -24          27 of 27 red ("pill 24px above the reserve")
    BACK_PILL_H   = 0            27 of 27 red
    an async throw + contrast    "FAIL  the page threw 1 error(s)", "328 checks: 327 passed,
                                 1 failed", exit 1 — it cannot read green, and the clean-run
                                 denominator is still 327
    probe-timecell-width         shipped and mutant 7 identical; hostile fixture also identical

Both mutants the last pass found surviving the pill suite now die on every single combination. The
invariant is the real thing: the strongest of them previously managed 14 of 27.

The hook is on the right element — index.html:5493, inside `render()`, the shell whose
`paddingBottom` is derived from `backPillClearancePx()`. The other identical opener (5107) is
`renderSetup()`, the welcome screen, which sets no bottom padding at all.

`falsify.sh`'s scoring block, old and new, driven through ten outcomes with a synthetic suite:

    OLD   hole + refusal  ->  "SURVIVED -- KNOWN OPEN HOLE"   ALIVE=0   sweep exit 0
    NEW   hole + refusal  ->  "REFUSED"                       ALIVE=1   sweep exit 1

Every other row identical. **No fifth outcome:** the branch set is exhaustive over (FAIL line) x
(summary line present) x (exit status) x (die / hole / survive), and each reachable cell lands in a
named branch. `STALE` increments `ALIVE`, so a stale anchor still fails the sweep.

## Disclosures

* `overflow-scan`'s 7m13.9s baseline ran concurrently with the parse-gate clone experiments. Pass
  and fail counts are not timing-sensitive and it came back 171/171 within the stated 7-13 minute
  envelope, but that figure is not a clean idle measurement. Every other suite above was run alone.
* The `falsify.sh` scoring verification lifted the real block out by line range and drove it, the
  same method the remediation used, because driving it through a real sweep costs a browser run per
  cell. The code executed is byte-identical to lines 243-295 of the shipped file.
* The chain artefacts that let the gate reach the parse block are fixtures in a scratch clone
  outside the repo. Nothing was written to this repository's `outputs/` to clear a gate.
* Servers: one mutant server on 8913, stopped with a bracketed pattern. The seven pre-existing
  servers (8899, 8901, 8921, 8941, 8942, 8964, 8975) were verified still running afterwards.

## RULE 0.0 and RULE 0

* **`care-tracker`.** Not cloned, not opened, not scanned, nothing run against it, and nothing in
  this release travels there. That app is closed.
* **RULE 0.** `test/v75-no-other-patient.mjs` green, 29/29, pronoun ratchet at 32 of 32. Nothing in
  this delta adds a name, a pronoun, a care-plan number, or a medication-id branch.

## VERDICT

Stated flush left on line 2. SHIP. The blocker is gone and was measured in the gate rather than
reasoned about. What is left is backlog: a gate message that overstates completeness when it stops
early (F1), a corpus label that will one day give the wrong instruction (F2), an arithmetic hazard
that only misreports runs that are already red and which I could not reproduce (F3), and a
pre-existing 8px side-scroll on one report sub-screen that the remediation itself had already
ticketed and asked to have measured (F4) — now measured. Take F1 and F2 into the next release.
