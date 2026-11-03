# AUDIT — ChemoWell app-v92, delta pass (Zero Day Auditor)

AUDITED-COMMIT: 217f9996b14befbb9547a5da7ce995e3ca6a19b0
VERDICT: DO NOT SHIP

**Audited sha `217f9996b14befbb9547a5da7ce995e3ca6a19b0`**, branch
`claude/caretracker-team-review-i83ik2`, working tree clean, `index.html` md5
`47357d9722a23c7b4abea89119490643`, `sw.js` md5 `4151f4e2a332e922c1587062a688c061` — all three as
the brief states. Subject: the four commits `f6df061..217f999`. This is a **delta pass**: the app
was not re-opened, the app-v91 palette was not re-audited, and nothing pass 1 confirmed reproducing
was re-measured.

**I came to this pass expecting to clear it, and I was writing SHIP until the last measurement.**
Both of pass 1's blockers are genuinely closed, and I reproduced each one both ways, to the pixel.
The nine findings below are all in a test, a corpus or a sentence — none of them in the app, none
visible to a patient, and I would not hold a release for any of them.

**One new blocker, and it is not a judgement call.** `test/contrast-scan.mjs` **does not parse at
this commit.** `node --check` is clean at `f6df061` and raises `SyntaxError: Unexpected identifier
'opacity'` at `217f999`, because the F3 wording fix inserted two unescaped backtick pairs inside
`seed()`'s template literal. The suite cannot start — not "cannot fail", cannot start — and it is in
`release_check.sh`'s loop, so **this commit cannot pass its own gate** (measured: exit 1,
`fail_note`, gate exit 1). The whole nine-mutant contrast corpus is unrunnable with it. And the file
is the gate for defect (3), the colour fix the owner has been waiting for: the edit made to stop
that file saying something untrue about the contrast fix is the edit that switched the contrast
check off.

**The fix is two characters.** Escape the backticks, `node --check`, then actually run the suite —
and re-take its timing, because the number this delta wrote into `release_check.sh` as *"measured"*
cannot have come from this commit. Details in Blocker 3. Everything else below is ready to ship
behind it, and nothing in it asks for a wider release.

The earlier pass on this release (`outputs/AUDIT-app-v92.md`, examining `f6df061`) also carries a
standing refusal. `release_check.sh`'s `check_report_current` supersedes a refusal only with a
report examining a **later** commit, and `217f999` is later and is in this branch's history, so this
report is the operative one — and it refuses as well. `outputs/PM*app-v92*` still does not exist and
the gate will say so; that is the PM's desk, not mine. I have no authority over `main` or over the
sign-off.

---

## The three things the re-audit was asked to show

### 1. The `falsify.sh` sweep, mutants 10 and 11 — both verdicts, as named

Run against the repo's own harness and corpus, `FALSIFY_PORT=9404 FALSIFY_FROM=10 FALSIFY_TO=11`,
baseline green at 15/15 first:

```
=== MUTANT 10: an async throw in the page -- non-zero exit with NO FAIL line …
15 checks: 12 passed, 3 failed   (650 in-flow text runs compared)
  ❌ OVER-BLOCK -- … printed no FAIL line, but the suite exited 1.

=== MUTANT 11: a benign background-position animation -- the control that must stay green AND exit 0
15 checks: 15 passed, 0 failed   (650 in-flow text runs compared)
  ✅ SURVIVED AS EXPECTED -- … and exited 0.
```

Sweep exit 1, `1 over-block control(s) correctly stayed green, 1 over-block(s) fired`. The two are
distinguishable. **And the second fix is proved by the same log:** mutant 10's suite exited 1 and
the sweep carried on through mutant 11 and printed its tally, where a bare
`LAST_OUT=$(node …)` under `set -e` would have aborted on the first caught mutant.

I also drove the scoring block through all four outcomes with a synthetic suite (no browser), to
separate "the branch fires" from "the branch fires for the right reason" — see D6.

### 2. `overflow-scan` with the widened fixture — red without the badge fix, clean with it

Both runs are the repo's unmodified suite against byte copies outside the repo, each serving itself
on an ephemeral port, the mutant applied by the corpus's **own** `mutant_8` code:

| build served | `index.html` md5 | result |
|---|---|---|
| `217f999` as shipped | `47357d9722a23c7b4abea89119490643` | `170 of 170 … 0 overflowing element(s).` **CLEAN**, exit 0 |
| badge `minWidth: '0'` removed (corpus `mutant_8`) | `b9ccda56f8f8bc08f36bcf073f277c55` | `170 of 170 … 6 overflowing element(s).` **NOT CLEAN**, exit 1 |

The six, verbatim:

```
  iOS  iPhone SE (1st gen) (320px) — HOME — 1 problem(s)
      "Not scheduled · Early · Over limit"
        <span> the wording is wider than the box it sits in by 21px · box 89x74 · white-space:normal
  … the same at NO-STAY:HOME and NO-DATES:HOME, and
  Android  Android small (display size) (330px) — … by 11px · box 89x74
```

**21px at 320, 11px at 330, three times each, one element.** Every digit in the record reproduces.
`minWidth: '0'` is on all five badge spans across the three row sites, and the
`override`+`skipped` entry is in `SEED_ENTRIES`. Blocker 2 is closed.

I also ran the pair the fixture mutant exists for: **`mutant_8` + `mutant_9` together** (badge fix
removed *and* the fixture entry trimmed) → `170 of 170 … 0 overflowing`, **CLEAN**. That is mutant
9's claim measured rather than asserted: with the fixture narrowed the six findings vanish.

### 3. The F3 wording, the "four suites" and the "~17 minutes"

The README says **three** suites and names the two that landed a commit earlier; no live claim of
four survives. The time comment is now measurements rather than arithmetic. The F3 replacement is
done at three of **four** sites — see D4.

---

## BLOCKER 3 — `test/contrast-scan.mjs` does not parse. The F3 wording fix switched off the suite it was fixing.

**Severity: blocker. Introduced by this delta, and the release cannot pass its own gate with it.**

```
$ node --check test/contrast-scan.mjs          # at 217f999 (HEAD, shipping)
/home/user/chemowell-app-beta/test/contrast-scan.mjs:108
  // reads the TEXT element's own `opacity`, which is 1; the muting is on its ROW. So it reports
                                   ^^^^^^^
SyntaxError: Unexpected identifier 'opacity'

$ node --check <f6df061's copy of the same file>   # the commit pass 1 examined
$                                                   # clean, no output
```

**The mechanism, and it is one keystroke.** `contrast-scan.mjs`'s fixture is a **template literal** —
`const seed = () => \`(() => { … }\`` — injected into the page as a string. The F3 remediation added
a seven-line comment inside it, and that comment contains two unescaped backtick pairs:
`` `opacity` `` at line 108 and `` `BACKLOG.md` `` at line 111. Each one closes the template literal
and the rest of the fixture becomes syntax. The comment that was there before had **zero** backticks
inside that template; the new one has four.

**The same delta got this right in the file beside it.** `test/v92-pill-clearance.mjs:101` adds the
same kind of comment to the same kind of template literal and escapes them —
`` \`cycle\` (non-male and cycleTracking on), \`radiation\` `` — so that suite parses and runs. One
edit escaped, one did not, and the one that did not was never executed afterwards.

### What it costs, measured rather than reasoned

1. **The suite cannot start.** Exit **1** on the SyntaxError, invoked exactly as the gate invokes it
   (`node test/contrast-scan.mjs --base http://…/index.html`). Rule 5 says a check that cannot fail
   is worse than no check; this is one step further back.
2. **`release_check.sh` refuses the release.** Its loop at line 920 scores a non-zero suite as
   `❌ RELEASE CHECK FAILED: test/contrast-scan.mjs` → `fail_note` → `FAIL=1` → exit 1. The gate
   catches it, which is the gate working — and it means this commit **cannot be shipped through its
   own chain**, so the verdict below is not me adding a hurdle, it is me reading the one that is
   already there.
3. **The nine-mutant contrast corpus goes with it.** `./falsify.sh test/contrast-scan.mjs
   falsify/mutants-contrast-overlays.sh` → *"the baseline produced no summary line, so the suite
   never finished on HEAD"*, exit 1, mutants 1-9 never reached. (Second live cause of that same
   misleading sentence — see D1.)
4. **The record asserts a measurement that cannot exist.** This delta rewrote
   `release_check.sh`'s timing comment to say *"Measured on this box rather than estimated, because
   an earlier version of this comment guessed"*, and in that list is **`contrast-scan` 28s**. The
   file does not run at this commit, so 28s was not measured at it; and pass 1 independently
   measured that suite at **~6-7 minutes**, which is what sent me to time it and is how this blocker
   was found at all. The comment replaced an estimate it called out as nobody's measurement with a
   figure that is also nobody's measurement of this build.
5. **It is the gate for the fix the owner asked for.** Defect (3) is the paused and
   treatment-excluded rows going from ~3.4:1 to ~4.9:1. `contrast-scan` is the only instrument that
   walks those strings at all (even though, per F3/D4, it reads them unmuted). The edit existed to
   stop that file claiming it *measures* the row. It left the sentence truer and the suite dead.

**Nothing else in the delta is broken.** I parse-checked all eleven `.mjs` suites the gate calls and
all five shell scripts: `contrast-scan.mjs` is the only failure, `bash -n` is clean on `falsify.sh`,
`release_check.sh` and all three corpora, and `index.html` rendered without a page error in every
browser run below.

**Fix, size S, and then three things must actually be run.**
1. Escape both backtick pairs (`` \`opacity\` ``, `` \`BACKLOG.md\` ``) or drop the backticks from
   the comment. `node --check test/contrast-scan.mjs` must be silent.
2. **Run the suite.** 327 checks, 0 below AA, worst 4.76:1 is the figure to reproduce.
3. **Re-time it** and correct the `release_check.sh` comment, and re-run the contrast corpus baseline
   so the nine mutants are reachable again.

**And one line that would have caught it in a second instead of a gate run.** Nothing in this repo
parse-checks its own suites. `care-tracker`'s `pm.py` checks "that index.html actually parses"; this
repo's gate has no equivalent for `test/`. A loop over `test/*.mjs` running `node --check`, at the
top of `release_check.sh` before the fifteen-minute part, costs under a second and fails loudly on
exactly this class. It should be falsified by reverting the escape and watching it go red.

---

## Where the overflow moved next — the question Blocker 2 asked twice

Nowhere, on this fixture: 170 of 170 combinations clean, with the badge-bearing row rendered. But
the arbiter renders **one of the three row sites the fix touches** — see D7 — and the fixture change
that made it see the badge interacts with the corpus in a way worth reading: D2.

---

## Findings

Numbered D1… to keep them apart from pass 1's F3-F11. **None of these is the stop** — Blocker 3
above is. Each one is in a test, a corpus or a sentence, and I would ship behind Blocker 3 with all
nine of them open. They are ordered by what I would fix first.

### D1 (MEDIUM) — the new corpus's overflow group cannot run through the harness it ships for

`falsify/mutants-v92-layout.sh` documents, in its header and again above mutant 7:

```
FALSIFY_PORT=8864 FALSIFY_FROM=7 FALSIFY_TO=9 \
  ./falsify.sh test/overflow-scan.mjs falsify/mutants-v92-layout.sh
```

I ran exactly that. It does not work, and it cannot:

```
=== BASELINE (no mutant) -- every check must be green before any of them mean anything

❌ the baseline produced no summary line, so the suite never finished on HEAD.
   Nothing below would mean anything. Find out why before running a sweep.
EXIT=1
```

That refusal arrived after a **7 minute 17 second, completely healthy** `overflow-scan` run.
Mutants 7, 8 and 9 were never reached. The cause is one line that is not there:
**`test/overflow-scan.mjs` prints neither the shared `checks:` summary nor any `^  FAIL` line**, and
it is the only one of the gate's ten suites with neither — `contrast-scan`, `v84-whatsnew`,
`v90-chart-axes`, `v92-pill-clearance` and `v92-text-collisions` each have exactly one `checks:`
line, and in three of those it was added for precisely this reason.

**This is the third time, and the second time is in this delta's own commit message.** `6a055d6`
says: *"v92-pill-clearance prints a 'checks:' line. Without one falsify.sh refuses its own baseline
and never measures a mutant, which is what happened the first time it was swept — the same omission
contrast-scan had an hour earlier."* The same commit adds three mutants aimed at the one suite that
still lacks it. That is this project's own sentence about itself: *the guard goes on the thing you
were thinking about and not on the thing beside it.*

Two smaller things in the same place:

* **The refusal misdiagnoses itself.** It says the suite *"never finished on HEAD"*. It finished,
  cleanly, in 7m17s. The next person reads that sentence and goes looking for a broken suite.
* **`MUTANT_EXPECT_n` is per-mutant, but the right expectation is per-suite.** Mutant 5 is a
  declared `hole` for the collisions suite and a genuine **catch** for `overflow-scan` (D3's table).
  Swept against `overflow-scan` the harness would print *"the hole is closed; update its
  MUTANT_EXPECT to die"* — advice that is wrong, because the label was never about that suite.

*Fix, size S:* give `overflow-scan.mjs` the shared `checks:` line (`problems` is the failed count and
`scanned` the total), falsify it by sweeping the group, and reword the refusal to "produced no
summary line this harness can read".

### D2 (MEDIUM) — mutant 7, labelled `die` and called "the app-v92 defect itself", is a no-op

`MUTANT_DESC_7` says *"the time cell can shrink — '10:00 AM' over its box by 5px at 320px"* and its
comment records *"Measured with it reverted: 3 overflowing, '10:00 AM' by 5px, 320px only."* It is
labelled `die`, so a sweep must catch it.

Measured on byte copies, the corpus's own mutant code, the repo's unmodified suite:

| copy | what was removed, on top of HEAD | result |
|---|---|---|
| `m7` | the time cell's own `flexShrink: '0'` (corpus `mutant_7`) | **170/170, 0 overflowing, CLEAN, exit 0** |
| `m79` | the same, **and** the badge out of the fixture (`mutant_9`) | **170/170, 0 overflowing, CLEAN, exit 0** |
| `m7grp` | only the time cell's **wrapper group**'s `flexShrink: '0'` (`index.html:7056`) | **170/170, 0 overflowing, CLEAN, exit 0** |
| `m7both` | **both** `flexShrink: '0'` declarations | **170/170, 0 overflowing, CLEAN, exit 0** |
| `m5`+`m7` | the content column's `minWidth: '0'` **and** the time cell's `flexShrink` | **170/170, 6 overflowing** — but all six are `"Remove"` off the right edge by 17px / 7px, **byte-identical to `mutant_5` alone**; no `"10:00 AM"` finding at any width |

Five variants, and not one of them produces the string the mutant is named for. The second rules out
the widened fixture. The third and fourth rule out the one plausible mechanical explanation — that
`flexShrink: '0'` is simply declared twice on the same axis, on the cell (`index.html:7057`) and on
the wrapper that holds the dot and that cell (`index.html:7056`) — because removing **both** is still
clean. The fifth rules out "it only shows when the column cannot absorb the squeeze": with the
content column pinned, the overflow goes out of the row's right edge and the time string is still
never squeezed.

**So what the measurement actually supports is narrower and more useful than any of my hypotheses:**
`flexShrink: '0'` on the Home timeline's time cell is **not load-bearing for anything this suite can
see at this commit**, and the *"3 overflowing, '10:00 AM' by 5px"* figure belongs to the **pre-v92
structure as a whole** — a line with no `minWidth: '0'` on the column, none on the name span, and no
inherited `overflowWrap`. It is not reproducible by reverting one, two or three of app-v92's
properties on HEAD, and the one property whose removal `overflow-scan` still reports is the content
column's `minWidth: '0'` — which is mutant 5, and which reports the Remove button, not the time.

Consequences, both real:

* If D1 is fixed and the group is swept, **mutant 7 scores an unexpected survivor and fails the
  sweep** (`$ALIVE` ≠ 0 → exit 1). A corpus that refuses its own release over a mutant nobody can
  act on is the corpus that gets `|| true` written beside it.
* The property is not useless — at the two other `fmtTime()` row sites (`index.html:5916` and
  `index.html:12029`) the parent is a plain flex div with no `flexShrink`, so there the cell's own
  declaration plausibly **is** load-bearing. Neither of those rows is rendered by this suite (D7),
  so that is untested in either direction.

*Fix, size S:* either point mutant 7 at the property that is actually load-bearing and rename it, or
keep it and relabel it `hole` with this measurement as its description — "the time cell's own
`flexShrink` is covered by the column fix at the one site this suite renders" is a true and useful
thing for a corpus to say. What it must not keep is a `die` label and a figure from a build that no
longer exists.

### D3 (MEDIUM) — one of the three surviving-mutant write-ups is wrong, measured

The brief asked me to attack all three. One is right, one is half right, and one is false.

**(c) Mutant 5 — "the content column's `minWidth: '0'` is load-bearing for OVERFLOW, not for
collisions." CORRECT, and now measured on both sides.** Against `v92-text-collisions`: 15/15, exit
0, survives. Against `overflow-scan`: **NOT CLEAN, exit 1, 6 overflowing** — `"Remove"` `<button>`
*off the right edge by 17px* at 320px and *by 7px* at 330px, three times each. The 17px even
corroborates the README's historical note that *"the Remove button went 17px off the right edge"*.
(One caveat: the mutant's anchor matches **21** sites, not the one content column it names, so if it
ever bites somewhere new you cannot tell where from the mutant.)

**(a) Mutant 2, first version — `BACK_PILL_GAP` to -24 survived; "the 8px gap is breathing room and
not the guard". HALF RIGHT, and the half that matters is a fixture property.** Measured with an
instrumented copy of the suite (one added read: the lowest in-flow glyph bottom, the pill's rendered
height, and the page's computed `padding-bottom`), 844px-tall viewport:

| build | `padding-bottom` | padding top edge | pill top | pill height | last glyph bottom | margin left |
|---|---|---|---|---|---|---|
| shipped | 138px | 706 | **714** | 42 | 666–674 | 40–48px |
| `BACK_PILL_GAP = -24` | 106px | 738 | **714** | 42 | 705 | **9px** |
| `BACK_PILL_H = 0` | 96px | 748 | **738** | **18** | 715–716 | 22–23px |

The *"roughly 32px above the padding edge"* figure checks out (705 against a 738 edge = 33px). But
the mutant survived with **9px** to spare on one fixture. A last row one line taller and it would
have gone red. *"The gap is not the guard"* is a statement about this fixture, not about the fix —
which is the exact shape Blocker 2 was raised for, one level in.

**(b) Mutant 2, second version — `BACK_PILL_H = 0` survived; "both the pill and the padding are
derived from that one constant, so the two stayed in agreement … A mutant that edits a SHARED
constant cannot break an agreement that the sharing creates. That is the refactor working,
measured." FALSE.** They did not stay in agreement, and the general law is not a law:

* `BACK_PILL_H` enters the pill as `minHeight` — a **floor** — and the clearance as an **exact
  term**: `BACK_PILL_BOTTOM + BACK_PILL_H + BACK_PILL_GAP`.
* So the pill's height is `max(BACK_PILL_H, its intrinsic height)`. Measured: with `BACK_PILL_H = 0`
  the pill still renders **18px** tall, while the padding falls the full 42px to 96px.
* The invariant the fix exists for is `pillHeight ≤ BACK_PILL_H + BACK_PILL_GAP`. Shipped: `42 ≤ 50`,
  an 8px margin. At `BACK_PILL_H = 0`: `18 > 8`. **The agreement is broken by 10px** — the pill's top
  edge sits at 738 while the page's own padding says content may reach 748.
* It survived for the same reason (a) survived: incidental slack, 22–23px of it.

The sharing creates an agreement only while `BACK_PILL_H` exceeds the pill's intrinsic height. That
is true at 42 and false below 18, silently, and a future label change (a longer word, a bigger font)
moves the intrinsic height without moving the constant.

**And the constructive half, which is the reason this is worth a finding at all.** `README.md` says
*"`test/v92-pill-clearance.mjs` asserts the INVARIANT rather than one row — no glyph box may
intersect the pill at `scrollHeight`."* That second clause is a **row** assertion: it can only fail
once the slack is consumed. The real invariant — `pillHeight + BACK_PILL_GAP ≤ backPillClearancePx()`,
or equivalently `pill.top ≥ viewportHeight − padBottom` — is asserted nowhere. One line in `measure`
would do it, and from the table above **it catches both of the mutants the corpus writes off**: by
24px and by 10px respectively. Both would stop being "facts about the fix" and start being catches.

### D4 (MEDIUM-LOW) — F3 is done at three sites of four, and the fourth is in the file F3 named

The brief says *"check … that no fourth site still says measured."* There is one.
`test/contrast-scan.mjs:353`:

> *"app-v92 raises those rows to 0.8 … and seeds a PAUSED medication below so the row **is measured**
> here from now on"*

— two lines above the same comment's own *"**The ancestor-opacity hole itself is still open**"*. One
paragraph, both claims. The `seed()` header 250 lines above (line ~104) **was** corrected in this
delta and corrected well, with the pre-v92 cross-check spelled out; `index.html:4922` and
`BACKLOG.md` M38-b are both correct. So the substance is now recorded in three places and
contradicted in a fourth, inside the file the finding was about.

*Fix, size S:* one word, plus the clause the other three carry. (Two stale digits sit in the same
paragraph — *"3.39:1 and 3.27:1"* and *"4.68:1"* against the 3.41 / 3.30 → 4.92 / 4.70 measured in
pass 1 and carried in `README.md`. Pre-existing, not from this delta, and within method noise;
worth aligning while the word is being changed.)

### D5 (MEDIUM-LOW) — F5's second half survives, and the sentence asserting it was rewritten around

`outputs/DEV-BRIEF-app-v92.md:118` still reads:

> *"A completeness check over the Reports sub-screen list: if a seventh sub-screen is added without a
> clearance assertion, the suite fails — the class, not the instance."*

Pass 1 found that is not what shipped. The delta rewrote lines 87–117 of that very section — the
"every means all nine" correction and the per-screen scroll guard, both good — and left 118 standing.
It is still untrue. `tileCount` is compared **only across widths** (`v92-pill-clearance.mjs:214-217`)
and there is no floor.

Falsified, on a byte copy, the attribute simply absent on three of the nine tiles at every width:

```
18 screen×width combinations at end-of-scroll, 18 of them genuinely scrolling,
6 report screens discovered from the menu.
18 checks: 18 passed, 0 failed
PASS — nothing is hidden behind the Back pill at the end of any report screen.
EXIT=0
```

The walk narrowed from 27 to 18 and the suite passed, saying so in a line nothing reads.

**A second route, found by accident and worse.** With the hook **present but holding a wrong value**
(`null`), the suite walked three screens named `null`, scored each one `ok`, and still printed *"9
report screens discovered from the menu"* — because the only navigation guard is
`where.reportsView === key`, and `openReport` sets `reportsView` to whatever string it is handed. The
suite checks that navigation agreed with the key, never that the key is a report.

*Fix, size S:* a floor on `tiles.length` (a ratchet, the shape `v75-no-other-patient` already uses in
this repo — not a version literal), and assert the key is one the app's own `reportTypes` can
produce. Then correct line 118 or delete it.

### D6 (LOW) — a third way the suite's exit status is lost, and this one is silent

The brief asked me to look for one. The repaired check is

```
elif [ "$EXPECT" = "survive" ] && [ "$LAST_STATUS" -ne 0 ]; then   # OVER-BLOCK
```

— gated on one of the three labels. I drove `falsify.sh`'s real scoring block through all four
outcomes with a synthetic suite (no browser: it reads the clone's `index.html` and behaves per the
marker a mutant injected, so each row is the harness's own code, not a simulation):

| label | suite behaviour | scored | sweep exit |
|---|---|---|---|
| `survive` | exit 1, `checks:` line, no FAIL | `❌ OVER-BLOCK` | 1 — correct |
| `survive` | exit 0, `checks:` line, no FAIL | `✅ SURVIVED AS EXPECTED` | correct |
| **`hole`** | **exit 1, `checks:` line, no FAIL** | **`⚠️ SURVIVED — KNOWN OPEN HOLE`** | **0** |
| `die` | exit 1, `checks:` line, no FAIL | `⚠️ SURVIVED — no check went red` | 1 — right code, wrong reason |

Row 3 run alone exits **0**: a run the suite **refused** certifies a known open hole, and the sweep
reports success. It is Blocker 1's hole exactly, on the other label — and worse in one respect,
because `hole` does not count toward `$ALIVE`, so nothing fails. It also defeats the label's stated
purpose: *"so the day it STARTS dying is noticed"* — a hole that starts dying by making the suite
throw is reported as still open.

**Why this is a finding and not a third blocker, said plainly.** It cannot be reached from any
committed corpus: the four `hole`/`survive` mutants that could do it
(`mutants-v92-layout.sh` 5, 6, 9 and `mutants-contrast-overlays.sh` 4) are pure CSS or a fixture
edit and cannot throw — which is, word for word, the "cannot bite today" that `run_suite`'s own
comment used about the first version of this branch, and I am not going to pretend otherwise. What
separates it is that the `hole` branch asserts nothing about the exit code, where the dead `survive`
branch printed *"and exited 0"* about runs that had exited 1; and `falsify.sh` is not run by
`release_check.sh`, so it gates nothing in this release. Row 4 mislabels a refusal as a survival but
still fails the sweep.

*Fix, size S:* hoist the status test above the label dispatch — any non-zero exit with no FAIL line
and a `checks:` summary is a refusal, whatever the mutant was labelled. Falsify with rows 3 and 4.

### D7 (LOW) — the arbiter renders one of the three row sites the badge fix touches

`overflow-scan` walks the five tabs (`home`, `meds`, `reports`, `inpatient`, `symptoms`) plus the
drawer and overlay passes. It never opens a report **sub-screen**, so `renderHistory`'s badge row
(`index.html:12037`) is never rendered; and nothing in `SEED_ENTRIES` produces a missed dose, so
`missedRow`'s `Missed` badge (`index.html:5929`) is never rendered. Every one of the six findings in
the `mutant_8` run is a `HOME` variant.

The property is identical at all three sites and min-width behaviour is width-independent, so the fix
is almost certainly right there too — this is about the falsification, not the code. But "widen the
arbiter to the siblings on the line being changed" is the lesson this release has now paid for twice,
and two of the three sites it was applied to are still outside the instrument.

### D8 (LOW) — "a constant 130px above the viewport bottom" has one exception, at a supported width

Measured across all 27 combinations: pill top **714** in an 844px viewport = the recorded 130px, at
26 of them — and **736 (= 108px) at 320px on `paracentesis`**. There is still 44px of clearance, so
there is no defect here. It is pass 1's F11 mechanism (horizontal-overflow-driven layout-viewport
scaling) appearing at **320px**, which is a supported width rather than the 280/300 F11 looked at. It
also implies that report sub-screen overflows horizontally at 320px, and nothing looks at that:
`overflow-scan` does not open report sub-screens (D7).

### D9 (LOW, Designer / Voice) — nobody has looked at the state the Blocker-2 fix changes

`minWidth: '0'` lets the override badge shrink below its min-content and break. Unfixed it measured
**89 × 74px — five lines** at 320px; fixed it must fit a 68px line, so it is narrower and taller
again. `outputs/DESIGN-app-v92.md` covers the long-name row carefully, including the mid-word break
and the `hyphens: 'auto'` negative result, and does not mention the badge at all — the Designer pass
never rendered an `override`+`skipped` row, because nothing did until this delta put one in a
fixture. **I did not measure the fixed badge's box**, so this is an observation, not a number: a
six-line uppercase pill on a Home row at 320px is legible but may not be what anyone intended. One
look on the 320px-class phone, added to the four items already on that list.

The changelog itself is fine. Title **5 words**, **3 bullets**, **66 words** total, no mechanism, no
version, no function names — Rule 0.9 on every count, and bullet 2 is now scoped to the end of the
scroll, which is the falsifiable promise F9 was raised about. *"Clearer on a small phone"* is a loose
umbrella over three fixes, two of which help at every width; it is imprecise rather than untrue, and
nothing on the screen contradicts it. Bullet 1's *"It wraps onto its own line now"* still describes a
name that wraps within its own column, as pass 1 noted.

---

## What reproduced, exactly

Every figure re-measured on byte copies served from their own ephemeral ports, each mutant applied by
the corpus's own code with `cd <copy> && mutant_n`, md5-verified on disk.

| claim, as recorded | measured here |
|---|---|
| HEAD sha, `index.html` md5, `sw.js` md5 | **all three identical to the brief**; tree clean |
| `overflow-scan` on the shipping build, widened fixture: 170/170, 0 overflowing | **identical**, `CLEAN`, exit 0 |
| badge `minWidth: '0'` removed → the same 6 come back, 21px at 320 and 11px at 330 | **identical**, exit 1, `box 89x74`, 3 widths × 2 as described |
| `mutant_8` + `mutant_9` → the 6 go invisible | **170/170, 0 overflowing, CLEAN** — mutant 9's claim, measured |
| corpus mutant 10 → `❌ OVER-BLOCK`; mutant 11 → `✅ SURVIVED AS EXPECTED` | **identical**, baseline 15/15, sweep exit 1 |
| a caught mutant no longer kills the sweep | **confirmed** — the run continued past mutant 10's exit 1 and printed its tally |
| pill group 1-3 all caught, mutant 3 via a refusal, exit 0 | **identical** — 3 caught, mutants 1 and 2 at 13 passed / 14 failed, mutant 3 `FAIL the Reports menu rendered no [data-report-tile] elements` + `CAUGHT, but the suite ABORTED` |
| collisions group: 4 caught, 5 `hole`, 6 over-block green, exit 0 | **identical** — mutant 4 `46x9px` at 320 and `6x9px` at 360, `"Hydroxychloroquine" x "Remove"`, the corpus's own figures to the pixel |
| corpus header: remove the time cell's `flexShrink` and nothing collides | **identical**, 15/15, exit 0 |
| `v92-pill-clearance`: 27 combinations, 27 genuinely scrolling, 0 covered | **identical**, 9 tiles discovered, exit 0 |
| the pill top is a constant 130px above the viewport bottom | **714 in 844 = 130 at 26 of 27**; 736 = 108 at 320px `paracentesis` (D8) |
| `release_check.sh`: a missing suite now fails the gate | **confirmed** — all nine named suites fail it; the designer pass is the one exception and resolves to exactly one filename that cannot collide with any of the nine; `fail_note` → `FAIL=1` → exit 1 |
| README says three suites, not four | **confirmed**, and it names why |
| changelog: retitled, third bullet, Rule 0.9 | **5-word title, 3 bullets, 66 words** |
| corpus `mutant_5` against `overflow-scan` ("sweep it to see it bite") | **NOT CLEAN, exit 1**, `"Remove"` off the right edge by **17px** at 320 and **7px** at 330 — the write-up is right |
| **`test/contrast-scan.mjs` runs at all** | **NO — `SyntaxError` at line 108, exit 1.** Clean at `f6df061`, broken at `217f999` (Blocker 3) |
| all eleven gated `.mjs` suites parse; all five shell scripts parse | **ten of eleven**; `contrast-scan.mjs` is the only failure. `bash -n` clean on all five |
| corpus mutant 7: "3 overflowing, '10:00 AM' by 5px" | **NOT reproduced — CLEAN across five variants** (D2) |
| the documented overflow-group sweep command | **NOT reproduced — refuses at the baseline** (D1) |
| the "shared constant" survival write-up | **NOT reproduced — the agreement breaks by 10px** (D3) |
| `contrast-scan` 28s in the new "measured, not estimated" comment | **NOT reproducible at this commit — the suite does not parse.** Pass 1 measured that suite at ~6-7 min (Blocker 3) |

## Mutants and copies built (all outside the repo; `index.html` and `sw.js` in the repo never edited)

| copy | what | `index.html` md5 |
|---|---|---|
| `ov/base`, `pill/pbase` | `217f999` byte copy (reference) | `47357d9722a23c7b4abea89119490643` |
| `ov/m7` | corpus `mutant_7` — the time cell's own `flexShrink` | `bbba4109c0638cd13dae770a954fdfb2` |
| `ov/m8` | corpus `mutant_8` — the badge `minWidth`s | `b9ccda56f8f8bc08f36bcf073f277c55` |
| `ov/m9` | corpus `mutant_9` — the fixture entry (suite only) | unchanged app |
| `ov/m89` | `mutant_8` + `mutant_9` | `b9ccda56…` + trimmed suite |
| `ov/m79` | `mutant_7` + `mutant_9` | isolates the fixture from D2 |
| `ov/m7grp` | the time cell's **wrapper** `flexShrink` only | `1f78561ae8d8b778c3aa6e24fa095f78` |
| `ov/m7both` | both `flexShrink` declarations | `66da9d3a2a10a1a2ab9d479270b54002` |
| `ov/m5ov` | corpus `mutant_5` against `overflow-scan` | `62bc31a5d3f79f0d3b1dc80d8aaaa0ab` |
| `ov/m57` | corpus `mutant_5` + `mutant_7` | `7dd30267c6b138b6c1153453c2acc257` |
| — | `f6df061`'s `test/contrast-scan.mjs`, for the `node --check` comparison | n/a (suite file) |
| `pill/pgap` | `BACK_PILL_GAP = -24` | `5f8f2b9edfd863bde9f9c19410eaada1` |
| `pill/ph0` | `BACK_PILL_H = 0` | `7543bf0bb6d34a565ea616356e6884ac` |
| `pill/pnarrow2` | 3 of 9 tiles render no `data-report-tile` | `c840732cbd0f7d9bf84ea070e5757be4` |
| — | synthetic suite + 4-row mutants file driving `falsify.sh`'s scoring (D6) | no app involved |

Ports used: 9401–9406 for `falsify.sh` runs; every direct suite run served itself on an ephemeral
port (`listen(0)`). **8899, 8901, 8921, 8941, 8942, 8964 and 8975 were left running untouched**; no
server I did not start was stopped, and `pkill` was not used.

## What I did NOT check, stated rather than skipped

* **The app, re-opened.** By instruction. Pass 1 confirmed the shipped behaviour; this pass judged
  the four delta commits.
* **The app-v91 palette.** By instruction. Five passes cleared it and nothing in this delta touches a
  colour literal — the `index.html` diff is comments, five `minWidth: '0'` additions and changelog
  prose, with no logic change and no write path touched at all.
* **Safari, and any real device.** Chromium at Apple viewport sizes. Every geometric figure above —
  the 18px pill, the 9px margin, the 21px and 11px badge overflows, the 17px Remove — is a Chromium
  number.
* **The fixed badge's rendered box** (D9). Inferred, not measured.
* **`release_check.sh` end to end.** I traced the new missing-suite path to the verdict and drove the
  loop's exact lines through three trees, but did not execute the gate (it needs a clean export, a PM
  sign-off that does not exist yet, and ~15 minutes).
* **Two sweeps ran two browser suites at once** for part of this pass, against `falsify.sh`'s own
  "run this alone" warning. Every result I kept is a deterministic geometry or exit-code measurement,
  no run reported an unreachable screen or a page error, and the two `CLEAN` baselines agree with
  pass 1 — but the two timing-shaped numbers in D3's table were taken with at most one other suite
  running, and the `contrast-scan` figure below was taken on an idle box.
* **`care-tracker`.** Not opened, not cloned, not scanned, nothing run against it. That app is
  closed and its data frozen (Rule 0.0). Nothing in this release goes near it.

## What has to happen before this ships, and what does not

**Blocking — Blocker 3 only.** Two characters, then three runs:

1. Escape the two backtick pairs in `test/contrast-scan.mjs` lines 108 and 111 (`v92-pill-clearance`
   line 101 is the worked example, in this same delta). `node --check` must be silent.
2. Run the suite: **327 checks, 0 below AA, worst 4.76:1**, exit 0.
3. Re-time it, correct the `release_check.sh` comment's `contrast-scan` figure, and run the contrast
   corpus's baseline so its nine mutants are reachable again.

Then add the `node --check` loop over `test/*.mjs` at the top of `release_check.sh` and falsify it by
re-introducing the unescaped backtick. That is the mechanism; the rest of this is a lesson.

**Not blocking — D1 through D9.** I would ship behind Blocker 3 with every one of them open, and I
have said so in each. If any are taken now, D1 and D2 belong together: one line giving
`overflow-scan.mjs` the shared `checks:` summary, and mutant 7 either repointed or relabelled with
the measurement in D2 as its description. The thing to show afterwards is the overflow group running
end to end — mutant 8 red, mutant 9 declared, mutant 7 whatever it honestly is. D3's invariant
assertion is one line in `measure` and should be falsified against `pill/pgap` and `pill/ph0`, both
of which are measured above and both of which it must turn red. D4 is one word. D5 and D6 are one
condition each. **None of D1-D9 changes `index.html`.**

**The re-audit is a delta of a delta.** Three things to show: `node --check` silent across `test/`,
`contrast-scan` green with its count and its real wall time, and the gate reaching a verdict with
the suite in it. Nothing else in this pass needs re-measuring — the badge fix, the pill clearance,
the three corpus groups and the changelog all reproduced here and are recorded above with their
numbers.
