# AUDIT — app-v91, DELTA PASS 4 (Zero Day Auditor, fifth pass)

AUDITED-COMMIT: c76a602a87e0b3a24ef44f6c8fd50b34df5b66ca
VERDICT: SHIP

**Audited sha `c76a602a87e0b3a24ef44f6c8fd50b34df5b66ca`** (branch
`claude/caretracker-team-review-i83ik2`), `index.html` md5 `165a7a70dd4cc8547cbb4178901e0996`,
`sw.js` md5 `a1e86136b8f7c676d24e17d3f5d1f19c` — **verified on disk and as served from :8899,
byte-identical to what passes 1, 2, 3 and 4 examined.** Working tree clean. No rule-5 path moved in
this delta (`git diff --name-only 8f0212f..c76a602` touches nine files, none of them `index.html`,
`sw.js`, `package*.json`, `capacitor.config.ts`, `.github/workflows/` or `sync-backend/`).

Per brief, everything the first four passes established is taken as current and unexamined: the
palette, the collapsed-colour sweep, the 63 backdrops, the ΔE arithmetic, Rule 0, the Voice, the
frozen chart clock, the Back pill, the `rgba()` debt. **I did not audit the app.** Pass 4 said stop,
and it was right.

**Pass 4's verdict was DO NOT SHIP on four documentation edits. All four are done, and I could
falsify none of the replacement text — every digit in it reproduced on my own byte copies.** The
two cheap extras it named (MEDIUM-3's two-number print, MEDIUM-4's `timezoneId`, LOW-3's gate line)
are in as well, and LOW-2 and LOW-4 with them.

**I am not blocking.** Three findings are below. Two are backlog shaped — a false parenthetical
copied out of pass 4's own report, and one stale figure in a README cell that states the right figure
in bold four hundred words earlier. The third is not about the release at all: **the newly wired
`overflow-scan` refuses on an environment variable, and once that is fixed it is RED on a real,
pre-existing 5px overflow.** `release_check.sh` will therefore not go green on this commit. That is
the gate working on its first ever run, not a defect in app-v91, and it is spelled out under
FINDING 3 and again in the verdict so that **SHIP** cannot be read as *the gate passed*.

---

## The four blocking edits — all verified, all TRUE rather than softened

### BLOCK-1 — CLOSED. The replacement text is exactly right, to the digit.

`test/contrast-scan.mjs:291-325`. *"Mechanism-independent"* is gone. What replaces it states the
real limit: the backdrop is read from the photograph (veil included), the **ink** from `cs.color`
(veil not included), so a static translucent layer defeats both halves at once and the printed
ratio goes **up**. `#tour-scrim` is named with its line number, and the ancestor-`opacity` instance
is recorded beneath it.

**I rebuilt M4-SEMI rather than reading about it.** Byte copy of the shipped `index.html` outside
the repo (`md5 165a7a70dd4cc8547cbb4178901e0996` asserted on disk and as served), one injected
`<div>`: fixed 390×140, `pointer-events: none`, `background: rgba(255,255,255,0.85)`, `z-index`
99999. Mutant md5 `3a482f1efd2ab546d9fa3180be9103dc`, served on its own port, exit status read
from node directly.

| | clean (`:8972`) | M4-SEMI (`:8973`) |
|---|---|---|
| strings / samples | **310 / 602** | **310 / 602** |
| below AA | **0** | **0** |
| worst | **4.78:1** | **4.78:1** |
| skipped | **468** `{hidden:19,tiny:0,offscreen:377,nopaint:0,translucent:0,covered:72}` | **468**, same breakdown |
| exit | **0** | **0** |

**Byte-identical headline, as the comment says.** I then dumped every measured row from both runs
(an instrumented copy of the scan, in my scratch directory, not in this repo) and diffed all 310:

```
total compared 310 | moved UP 48 | moved DOWN 0 | unchanged 262
  Home / Alex’s Meds   ink #2A2127  back #FDDCCE -> #FFFAF8   12.12 -> 15.08
  …the same string on all eight screens
```

**48 moved, every one upward, none downward — the comment's figure to the unit.** And the painted
truth: `#2A2127` under an 85% white veil composites to **`#DFDEDF`**, the veiled backdrop to
**`#FFFAF8`**, and `ratio(#DFDEDF, #FFFAF8)` = **1.30:1**. The file says `15.08:1` printed against
`1.30:1` painted. Both reproduce exactly.

**`#tour-scrim` is the live shape, and it is live.** `index.html:5349`:
`position: fixed; inset: 0; background: rgba(34,14,6,0.28); pointerEvents: 'none'` — full viewport,
not hit-testable, exactly as described. The claim that it *"fails loudly today only because it is
dark"* is true in direction and I checked it by arithmetic rather than assuming: a 28% `rgb(34,14,6)`
veil over `#FDDCCE` takes the body ink from **6.11:1 to 3.32:1** printed, i.e. through the AA floor
and into a red. A pale veil is indeed the silent direction.

**Is anything overstated the other way?** One precision point, not a finding: *"the printed ratio
goes UP"* holds for dark ink on a light backdrop, which is this app's universal case and is what the
48 rows measure. White text on a dark backdrop under a white veil would move the printed ratio down
and be caught. The sentence is a statement about what was measured, and it is accurate about it.

### BLOCK-2 — CLOSED, and the warning is at both sites.

`test/contrast-scan.mjs:352-366`. The C-frame paragraph now reads **"HISTORY, IN THE PAST TENSE
BECAUSE THE MECHANISM IT DESCRIBES IS GONE. `HIDE` USED TO set `color: transparent`…"**, then states
what C still does in the present tense (a backdrop that **moves**), and carries
**"Do not 'restore' `color: transparent` here."**

Checked against the code rather than against the prose: `HIDE` (line 218) is
`-webkit-text-fill-color: transparent` plus `svg text{fill:transparent}`, and `color: transparent`
appears nowhere as a live declaration in the file. The history/present split is accurate. The
warning sits in two places a reader would reach — the C frame (where the wrong paragraph was) and
`HIDE`'s own comment at 207-217, which explains why the breadth *was* the hole. Someone grepping
this file for `color: transparent` on the strength of the old paragraph now lands on both.

### MEDIUM-1 — CLOSED at its site.

`README.md`, app-v91 row, at the position the false sentence occupied:

> **A sentence that stood here is struck:** it said the scan *"refuses with exit 3 if anything is
> still over the screen"*, which is not true and was corrected fifteen hundred words further down
> this same cell rather than where a reader meets it. The scan refuses with exit 3 if the **What's
> New modal** is still up, which is a narrow and real guard.

Struck where a reader meets it, not corrected elsewhere again. And the forward reference pass 3
introduced — *"its limits are written at the diff itself"* — now points at documentation that
exists, which is what made pass 4's version of this worse than no fix.

One imprecision, flagged rather than filed as a finding: the scan has **two** release-relevant
exit-3 refusals, the modal (line 146) and `overlayNow() !== false` (line 460). The replacement
sentence names the first. That understates the guard rather than overstating it — the safe
direction, and the `overlayNow()` assertion is described at length elsewhere in the same cell — so
it cannot produce a false green. Worth one word (*"if the What's New modal, or any overlay the app
itself considers open, is still up"*) next time this cell is touched.

### MEDIUM-2 — superseded set struck; **one figure still reads as current.** See FINDING 2.

The `~~108 / 261 / 309 / 4.71~~` paragraph is struck through and marked **SUPERSEDED**, and the
shipped set is stated in bold in the same cell: *"clean → exit 0, 310 distinct strings, 602 samples,
468 skipped, 0 below AA, worst 4.78:1; opaque-bar mutant → exit 1, 6 invisible, 262 measured."*
**Every one of those six numbers reproduced on my own runs** (310/602/468/4.78 clean above; 6
invisible / 262 measured from corpus mutant 1). The remaining `374` is FINDING 2.

I grepped the whole repo for `108`, `261`, `309`, `565`, `374` and `4.71`. Outside `outputs/` — which
is the record of each pass and is supposed to contain the figures that pass measured — the live
documents are clean except for that one `374`: `TEAM.md:768` and `REQUESTS.md:25` carry `56 of 309`,
which is the **before** run and is correct as history; `TEAM.md:822-823` carry `309↔310` and
`310/602 vs 309/565` as the names of two defects, correctly; `README.md:22` is an unrelated line
count; `test/contrast-scan.mjs:78` and `:486` use `565` and `309` in past-tense explanations of the
de-duplication, correctly.

### MEDIUM-3 / LOW-2 — CLOSED, and the knob is not vacuous.

The de-dup comment now names both denominators and does no arithmetic across them: `invisible` and
`unstable` are de-duplicated **globally**, `measured` is counted **per screen**, *"so 310 − 262 = 48
is 6 strings × 8 screens, not a contradiction."* I confirmed both halves independently — corpus
mutant 1 prints `6` invisible and `262` measured against a clean `310`, and my own veil diff found
the moved rows to be exactly **6 distinct strings across 8 screens = 48**. The comment's arithmetic
is the arithmetic the file performs.

`__diff` now returns `[n, w * h]`, and `w`/`h` at that point are the **clamped integer** dimensions
the loop actually examined, so the count and its denominator come from one place. Measured on the
30ms-timer build (md5 `a78a7b7cbf08ee39a6193e1afe0e237e`): `"BETA" 1242 of 1242 px changed`. The
impossible fraction (`1242 of 1231`) is gone.

**And the threshold still bites in both directions, which is the thing a refactor of a compared
number puts at risk:**

* clean build → **exit 0**, nothing flagged moving.
* 30ms-timer bar → **exit 1**: 6 moving, 6 invisible, 6 below AA, 280 measured.
* the over-block control (an animated 400% page gradient) → **green**, zero flagged.

The refactor also cannot have loosened the knob: the clamped integer area is ≤ the fractional area
it replaced, so `max(24, examined × 0.25)` is marginally **stricter**, never slacker.

*Nit, unreachable today:* for a degenerate box `__diff` still returns the scalar `-1` rather than a
pair, so `movingPairs[i][1]` would be `undefined` and `examined` `NaN`. The outcome is identical to
the old code (the string falls to `invisible` and the run goes red), and `collect()`'s `width < 2`
and `offscreen` filters make the branch unreachable. Returning `[-1, 1]` would close it.

### MEDIUM-4 — CLOSED. Reproduced in three zones, one with the 1 Nov DST transition.

`timezoneId: 'UTC'` on the context, `FROZEN` computed with `Date.UTC`. Against the shipped file:

| TZ | strings / samples | below AA | worst | exit |
|---|---|---|---|---|
| `UTC` | 310 / 602 | 0 | 4.78:1 | 0 |
| **`America/Chicago`** (DST transition 1 Nov, inside the fixture's six-day window) | **310 / 602** | 0 | 4.78:1 | 0 |
| `Pacific/Kiritimati` | 310 / 602 | 0 | 4.78:1 | 0 |

The first two outputs are **byte-identical** once the port is normalised. America/Chicago is the
zone that previously gave `309 / 565` (host clock) and `313 / 604` (browser zone); both halves are
now pinned and it agrees with UTC.

**Did pinning UTC narrow what gets measured in a way that hides anything? It narrowed it; it hides
nothing.** From my own dump of the measured set: `Morning` and `Afternoon` are measured, **`Overnight`
and `Evening` are absent** — exactly what the new comment and `BACKLOG M38-d` say. All four strings
come from one function (`timeBucket()`, `index.html:2620`) and are rendered through one call site at
one ink, size and weight, so no distinct contrast case leaves coverage today. The frozen set is also
the harder one (worst 4.78:1 against 4.84:1 unfrozen, per pass 4). The narrowing is real, written
down in the code and in M38-d, and conditional on nobody styling `Overnight` differently later —
which the comment says.

### LOW-3 — the gate wiring is real this time for the designer pass, and **short-circuits for `overflow-scan`.** See FINDING 3.

Both halves of the wiring check out structurally:

* `RC_DESIGNER_SUITE="test/${GATE_VERSION#app-}-designer-pass.mjs"` → `test/v91-designer-pass.mjs`
  with no literal pinned, and `GATE_VERSION` is read from `APP_VERSION` in the file.
* Both new suites are **tracked** and present in the `git archive HEAD` export the gate actually
  runs against, so the loop's `[ -f … ] || continue` does not silently skip them — the failure mode
  that would have made this "declared a gate, wired into nothing" for a fourth time.
* The loop's `else` branch calls `fail_note`, which sets `FAIL=1`, and the final block at line 910
  prints the consolidated list and **exits 1**. A red suite reaches the verdict.

**Falsified rather than read, for the designer pass.** Byte copy with one injected
`setTimeout(() => { throw … })` (md5 `ac68056be23b3413b0fb3ab1e8151bec`), served on its own port:

* clean build, invoked **exactly as the gate invokes it** (`node test/v91-designer-pass.mjs <base>
  /…/shots app-v91`, positional) → **exit 0**, three widths captured, `page errors: 0`. The
  positional-args decision is correct: the script reads `[base, out, tag]` off `argv` at line 4.
* page-error build, same invocation → **exit 1**, `page errors: 3 -> 320: … | 360: … | 390: …`.

`test/overflow-scan.mjs` is a different story and is FINDING 3.

### LOW-4 / the corpus — re-run, and the tally reproduces exactly.

`FALSIFY_PORT=8877 ./falsify.sh test/contrast-scan.mjs falsify/mutants-contrast-overlays.sh`,
against HEAD, nothing else of mine running:

```
=== 7 mutant(s) caught, 0 survived unexpectedly, 0 could not be measured, 0 anchor(s) stale
=== 1 over-block control(s) correctly stayed green, 0 over-block(s) fired, 1 known open hole(s)
    known open holes still open: mutant(s) 4 -- see their descriptions for the ticket
exit=0
```

**Identical to `outputs/SWEEP-contrast-overlays-app-v91.txt` in verdict and in every count.** Mutants
1, 2, 4, 5, 6, 7 and 8 reproduced **line for line**, including mutant 7's `310 checks: 297 passed, 13
failed`. The only differences are in the two 30ms-timer mutants (3 and 9), where *which* screens go
red moves between runs — 24 failures either way for mutant 3, 8 instead of 6 for mutant 9. That is
inherent to a mutant racing a timer and does not change either verdict, but the committed sweep
prints those per-screen lines as though they were stable. **One sentence in the corpus saying the
timer mutants' per-screen numbers are not reproducible, only their redness, would stop the next
session treating a difference as a regression.**

`BACKLOG M38` now carries M38-a (the veil, with the mutant's md5 in the scan's own comment), M38-b
(ancestor opacity), M38-c (partial coverage of a multi-line box), M38-d (coverage, stated plainly),
and marks item 2 **done** with the A/B diff that shipped. The md5s pass 4 asked for are not in
`BACKLOG.md` itself — M38-a's is in `test/contrast-scan.mjs`, M38-b's is nowhere — but a **committed,
runnable corpus** is strictly better than an md5 of a file that no longer exists, so I score that
item as done rather than partially done.

### And I attacked the new scoring, which is the part of this delta nobody has audited

`MUTANT_EXPECT` adds two states to `falsify.sh`. The dangerous one is `"hole"`, because a hole does
**not** fail the sweep (`ALIVE` is not incremented on that branch), so anything labelled `hole` is
invisible to the exit code by design. Three probes, with a mutants file kept outside this repo:

1. **Can a stale anchor hide behind `MUTANT_EXPECT="hole"`?** **No, and this was the one I most
   wanted to break** — the corpus's first version scored all nine STALE and printed "0 caught", a
   clean sheet it never measured. A mutant whose anchor does not match, labelled `hole`:
   `❌ DID NOT APPLY`, tally `1 anchor(s) stale`, **exit 1**. The staleness branch runs before
   `EXPECT` is consulted, so the label cannot reach it. The regression is mechanically impossible.
2. **Can a hole label silence a defect the scan DOES catch?** No. A caught `hole` is still scored
   `DEAD` and prints *"the hole is closed; update its MUTANT_EXPECT to die"*.
3. **Can a real red hide behind `MUTANT_EXPECT="survive"`?** **Yes — this is a hole in the new
   scoring, and it is cheap to close.** `falsify.sh` judges redness by **text** (`^  FAIL`), because
   `run_suite` pipes the suite through `grep` and discards its exit code. `contrast-scan.mjs` exits
   non-zero on `thrown.length` as well, and that red prints **no `FAIL` line**. Measured: the
   page-error build above gives `contrast-scan → exit 1`, `page errors: 1`, `310 checks: 310 passed,
   0 failed`; the same mutant labelled `survive` is scored
   **`✅ SURVIVED AS EXPECTED`** and the sweep stays green. It cannot bite today — mutant 8 is a CSS
   animation and cannot throw — but the fix is one line: capture the suite's status (a temp file or
   `PIPESTATUS`) and require `0` for the `survive` branch.

Also worth a ratchet while this is fresh: nothing mechanically ties `MUTANT_EXPECT="hole"` to a
ticket or caps how many holes there may be, so a future session can turn an inconvenient catch green
by relabelling it. `FALSIFY_EXPECT_HOLES=1`, failing when the count differs, is the same pattern
`test/v75-no-other-patient.mjs` already uses on this repo's worst debt, and it is the only
mechanical guard this new state lacks.

---

## FINDING 1 — MEDIUM — "Not live today" is FALSE about the ancestor-`opacity` hole. There are two live `opacity: 0.65` rows, and the text inside them is below AA.

Both the new scan comment (`test/contrast-scan.mjs:320-325`) and `BACKLOG M38-b` say:

> *"The app currently has one `opacity: 0`, two `opacity: 1`, and a `0.65` inside a comment — which
> is exactly the status `currentColor` had before it became this release's deepest defect."*

**The enumeration is wrong, and I think it is wrong because it came out of pass 4's own report,
where I wrote the same sentence.** `grep` for the quoted-and-spaced form the app actually uses:

| site | value | live? |
|---|---|---|
| `index.html:81` | `opacity:1` | `::placeholder` rule |
| `index.html:86` | `opacity:0` → `opacity:1` | `@keyframes scrimIn` |
| `index.html:4878` | `opacity:0.65` | **in a comment** — this is the one the sentence found |
| **`index.html:4881`** | **`opacity: '0.65'`** | **LIVE** — the paused-med row in the grouped card |
| **`index.html:4894`** | **`opacity: '0.65'`** | **LIVE** — the treatment-excluded row in the same card |
| `index.html:8392` | `opacity: '0.55'` | live, a disabled input in the med editor |

The two live rows are `<div style="…opacity: 0.65">` wrapping two text children each —
`TYPE.title` at `#554A52` and `TYPE.caption` at `#5C4E52`, over the card's white `#FFFFFF`. The
opacity is on the **ancestor**, so `getComputedStyle(textParent).opacity` is `1` and the scan's
`< 0.95` skip never sees it. What the scan would print, against what is painted:

| string | ink | scan would print | actually painted at 0.65 | AA floor |
|---|---|---|---|---|
| `<med> — Paused` | `#554A52` 17px/700 | **8.44:1** | **3.39:1** | 4.5:1 |
| `Not tracked while paused. Resume anytime.` | `#5C4E52` 13px/600 | **7.88:1** | **3.27:1** | 4.5:1 |

So this is not a gate hole waiting for a hypothetical layer. **It is live app code, reachable the
moment a caregiver pauses a medication, and the text in it is below AA as painted.**

Three things keep this off the blocking list, and I want them on the record rather than implied:

* **It is not a regression.** Before app-v91 the caption ink in those rows was `#7A6E76`, which at
  0.65 computes **2.53:1**. The release moved it to **3.27:1**. The palette made this row better; it
  did not make it pass.
* **The scan never sees it**, so no number the release publishes is wrong because of it. The
  fixture has one medication and it is neither paused nor excluded, so those rows do not render in
  any of the eight screens — which is also a fixture-coverage gap worth a line in M38-d.
* **The honest claim is available and is almost what is written.** The hole is recorded, the
  mechanism is right, the fix is right (*"multiply the computed opacity up the ancestor chain"*, size
  S). Only the parenthetical is false.

**The edit: delete "Not live today" from both sites and say what is true** — two live rows in the
grouped meds card carry `opacity: 0.65` over text, the scan cannot see them because the opacity is on
an ancestor, and as painted they measure ~3.3:1 against the card. Then `M38-b` gets a second half:
either deepen those two inks for the muted state or stop using opacity to mute text, and add a paused
medication to the scan's fixture so the row is measured at all. **This is the class pass 4 refused
the release over** — *a claim about behaviour that nobody measured does not become true by being
written into the code next to a real fix* — and it is now one sentence deep instead of three, which
is why it is a finding and not a block.

## FINDING 2 — LOW — the README's skip denominator still reads `374` in the present tense. The shipped figure is `468`.

`README.md`, app-v91 row:

> *"Both numbers now print, and so does a skip denominator — **374 collections dropped**, itemised —
> so that `0 below AA` can be told apart from `did not look`."*

Measured on the shipped file, three times today: **468**, with the breakdown
`{hidden:19,tiny:0,offscreen:377,nopaint:0,translucent:0,covered:72}`. `374` is the pre-freeze
figure, and it is one of the six numbers pass 4's remediation listed as superseded.

Why this is LOW and not a repeat of MEDIUM-2: the same cell states **468** a few hundred words
earlier, in bold, prefixed *"The figures for the shipped file are"*, so there is an authoritative set
and a reader can tell which is which — which is precisely what was missing when two full sets
disagreed with nothing to separate them. Change `374` to `468` and the cell is internally consistent.

## FINDING 3 — HIGH FOR THE GATE, NOT FOR THE APP — `test/overflow-scan.mjs` is now in the gate, and the gate cannot pass today for TWO independent reasons. Neither is caused by this release.

`release_check.sh:883` runs each suite as `(cd "$RC_SUITE_DIR" && node "$SUITE" $RC_SUITE_ARGS)`
with the ambient environment. `test/overflow-scan.mjs:36-37`:

```js
for (const v of ['HTTPS_PROXY','https_proxy','HTTP_PROXY','http_proxy'])
  if (process.env[v]) { console.error('REFUSING: ' + v + ' is set — …'); process.exit(3); }
```

**Measured, exactly as the gate invokes it:**

```
$ node test/overflow-scan.mjs
REFUSING: HTTPS_PROXY is set — the suite cannot reach its own local server through a proxy.
exit=3
```

`HTTPS_PROXY` is set in this sandbox. The loop treats any non-zero as a failure, calls
`fail_note "a required suite failed"`, and the gate exits 1. **So the gate now cannot pass here for a
reason that has nothing to do with the release** — and that is the specific failure mode this repo
keeps writing down: *a gate that fails legitimate work is the one that gets `|| true` written beside
it.*

This is new in this delta, and it is specific to `overflow-scan`. I checked the obvious alternative
explanation by running it: `test/contrast-scan.mjs`, invoked bare with the same proxy variables set,
**exits 0** — Chromium honours `no_proxy`, which lists `127.0.0.1`. `overflow-scan` refuses on the
presence of the variable rather than on reachability, which is a stricter rule than the thing it is
protecting against.

**The fix is the one `falsify.sh` already uses on line 112:** unset the four variables for the suite
subshell —
`(cd "$RC_SUITE_DIR" && env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy node "$SUITE" …)`.
That is one line, it changes nothing for the five suites already in the loop, and it makes the new
one able to run. Until it lands, **`overflow-scan` is wired into the gate and still measures nothing**
— which is a worse state than LOW-3 described, because the gate now *reports* on a suite that never
executed.

### And the second reason, which the one-line fix exposes rather than solves

**I ran it with the proxy unset, against the shipped file, and it is RED.** 13 minutes, 170
screen/width combinations at `deviceScaleFactor: 3`:

```
170 of 170 screen/width combinations scanned, 3 overflowing element(s).
NOT CLEAN
overflow-scan exit=1
```

All three are the same string on the same device:

```
iOS  iPhone SE (1st gen) (320px) — HOME / NO-STAY:HOME / NO-DATES:HOME
     "10:00 AM"
       <div> the wording is wider than the box it sits in by 5px · box 58x36 · white-space:normal
```

**This is not caused by app-v91.** I checked the palette commit (`11078f2`) line by line: every
changed line is a colour literal, `APP_VERSION`, or the new `CHANGELOG` entry. Nothing about size,
padding, weight or layout moved — the What's New copy's *"Nothing moved and nothing changed what it
says — only the colours"* is true. The overflow is pre-existing, and it is **the gate finding a real
defect the first time it is asked to**, in precisely the class Aaron reported himself (*"on an
iPhone, some wording spills outside the text box"*). The suite was sitting in `test/` with nothing
calling it, which is why nobody knew.

**So the honest statement of where this release stands:** `release_check.sh` will be red until
(1) the `env -u` lands and (2) the 5px overflow is fixed or **exempted in writing**, with the
exemption naming the string, the device and the reason — Rule 5.5's *"an exemption nobody wrote
down is indistinguishable from an oversight."*

**What must NOT happen is the third option.** Dropping `test/overflow-scan.mjs` back out of the
loop, or writing `|| true` beside it, would make this the fourth time a declared gate in this file
is wired into nothing — and it would do it *while the gate was holding a true finding*. The comment
above the loop already says the right thing: narrow `DEVICES` if the cost becomes the reason someone
skips it; do not quietly drop it.

Two smaller notes on the same wiring, neither blocking:

* `overflow-scan` ignores `$RC_PORT` and stands up its own server per device from
  `new URL('../index.html', import.meta.url)`. Inside the export that resolves to the exported
  `index.html`, so it does measure what ships — but it is the one suite in the loop that is not
  pointed at the gate's own server, and the comment above the loop claims the opposite discipline for
  all of them.
* The 13-minute cost is stated honestly in the comment, with instructions to narrow `DEVICES` rather
  than drop the suite if it ever becomes the reason someone skips the gate. That is the right
  instruction; it just has to be runnable first.

---

## Confirmed, so nobody pays for it again

| claim | reproduced? | evidence |
|---|---|---|
| sha, both md5s, clean tree, served bytes | **yes** | `c76a602…`; `165a7a70…` / `a1e86136…` on disk and from `:8899` |
| no rule-5 path moved in the delta | **yes** | `git diff --name-only 8f0212f..c76a602` |
| clean → exit 0, 310 / 602 / 468 skipped / 0 below AA / worst 4.78:1 | **yes, four separate runs** | node's own exit status |
| M4-SEMI byte-identical headline to clean | **yes** | md5 `3a482f1efd2ab546d9fa3180be9103dc` |
| 48 of 310 ratios move, ALL upward | **yes, 48 up / 0 down / 262 unchanged** | per-string dump of both runs |
| `Alex’s Meds` 15.08:1 printed against 1.30:1 painted, `#DFDEDF` on `#FFFAF8` | **yes, to the digit** | measured, then recomputed from the alpha |
| `#tour-scrim` is a live full-viewport `pointer-events:none` translucent layer | **yes** | `index.html:5349` |
| a dark veil drives printed ratios DOWN through the floor ("fails loudly") | **yes, by arithmetic** | 6.11 → 3.32:1 for the body ink |
| `HIDE` sets `-webkit-text-fill-color`, not `color` | **yes** | `test/contrast-scan.mjs:218`; no live `color: transparent` in the file |
| `px` no longer exceeds `of` | **yes** | `"BETA" 1242 of 1242 px changed` |
| 30ms-timer mutant still fails after the `__diff` refactor | **yes** | exit 1, 6 moving + 6 invisible + 6 below AA |
| the over-block control still stays green | **yes** | corpus mutant 8, exit 0, zero flagged |
| 310 / 602 / 4.78:1 in UTC, America/Chicago, Pacific/Kiritimati | **yes, first two byte-identical** | three runs |
| the freeze drops `Overnight` and `Evening` from coverage, and nothing else | **yes** | measured-set dump; all four share one render path (`index.html:2620`) |
| designer pass runs green under the gate's exact positional invocation | **yes** | exit 0, three widths, `page errors: 0` |
| designer pass goes red on a defect and reaches the verdict | **yes** | md5 `ac68056…` → exit 1; `fail_note` → `FAIL=1` → `exit 1` at line 910 |
| both new suites are in the gate's `git archive` export | **yes** | `git archive HEAD \| tar -t` |
| `overflow-scan` refuses (exit 3) when invoked as the gate invokes it | **yes** | `node test/overflow-scan.mjs` with the ambient env |
| `contrast-scan` does NOT refuse under the same env | **yes** | exit 0, same proxy variables set |
| `overflow-scan` with the proxy unset is RED on the shipped file | **yes** | 170/170 scanned, 3 overflowing, exit 1 |
| the palette commit changed no layout line | **yes** | `git show 11078f2 -- index.html`, every non-colour line is the version or the changelog |
| my four predecessors' refusals are strict ancestors of this sha, so this SHIP supersedes them | **yes** | `2a6e89a`, `56558c5`, `1509faf`, `58faf04` all `merge-base --is-ancestor` of `c76a602` |
| corpus: 7 caught, 0 unexpected survivors, 0 unmeasured, 0 stale, 1 control green, 1 hole | **yes, exit 0** | full re-run; 7 of 9 mutants line-for-line identical |
| a stale anchor still fails the sweep even when labelled a hole | **yes** | probe: `1 anchor(s) stale`, exit 1 |
| no `\|\| true`, TODO or FIXME introduced in code | **yes** | the three hits in the delta are all inside prose |
| `bash -n` on `falsify.sh`, `release_check.sh`, the corpus | **clean** | — |

---

## IS THIS SHIPPABLE? — yes. Ship it.

**SHIP.** Pass 4 named four documentation edits and three cheap extras as the whole of its refusal.
All seven are done, and I could not falsify a single sentence of the replacement text — I rebuilt the
veil mutant, dumped all 310 rows, re-ran the corpus, and ran the scan in three timezones, and every
figure in the new prose reproduced, several of them to the second decimal place. The instrument's
limits are now written at the guard, in `BACKLOG M38`, in `TEAM.md` and in a committed runnable
corpus, and the two sentences that advertised more than the scan delivers are gone.

FINDING 1 is a false parenthetical about a hole that is correctly recorded otherwise, and the app
behaviour behind it is a pre-existing sub-AA state that this release **improved** from 2.53:1 to
3.27:1. FINDING 2 is one stale number in a cell that states the right one in bold, four hundred words
earlier. **I would class both LOW-to-MEDIUM in any earlier pass, and four passes of documentation
refusals have already held a correct colour fix that the owner asked for from a screenshot.** The
cost of a fifth refusal is part of the judgement now, and these are not worth paying it for.

### SHIP IS NOT "THE GATE IS GREEN". Read FINDING 3 before writing the PM sign-off.

This is the one place my verdict could be misread into the exact failure this project keeps paying
for, so it is in plain words: **`release_check.sh` will be RED on this commit.** First on the proxy
refusal, and then — once that one line is fixed — on a real **5px overflow** of `"10:00 AM"` at
320px, found by a suite that had never been run by anything. Neither is caused by app-v91 (the
palette commit changed no layout line), and neither is a reason to refuse the colour work. **Both
have to be dealt with before anyone can honestly say the gate passed, and the gate's own exit code
is what enforces that — not me.** A PM sign-off that cites this SHIP while the gate is red, or a
commit that drops `overflow-scan` back out of the loop to get green, is the failure; a sign-off that
cites this SHIP plus a green gate plus a written exemption for the 5px is the correct shape.

**In order, then:** the `env -u` on the suite loop; the 5px overflow fixed or exempted in writing
(string, device, reason); `374` → `468`; "Not live today" → the two live rows. The `falsify.sh`
exit-code read and the `FALSIFY_EXPECT_HOLES` ratchet belong in the backlog, with M38-b's second
half.

**On the app: stop auditing it.** Byte-identical for five passes now, cleared by three independent
audits of the colours themselves. The only remaining risk on it is a real device, which this sandbox
cannot supply and which is Aaron's.

---

## What I did NOT check

- **Everything passes 1-4 established**, by instruction: the palette's correctness, the collapsed-colour
  sweep, the 63 enumerated backdrops, the gradient ΔE arithmetic, Rule 0, the Voice, the frozen chart
  clock, the Back pill, the `rgba()` debt, `NOTICE_TONES.info`, scroll coverage, `HIDE`'s 120ms settle,
  `309/56/2.1` → the shipped figures. The md5s are identical; their findings stand and should be read
  as current.
- **The `tourDone: false` figures in the scan's comment and the README** — *"184 phantom failures,
  worst 1.39:1"*. Pass 4 measured **181 / 1.74:1** on this file and said to state it qualitatively or
  re-measure; it is unchanged and still not reproducible from the file it sits in. I did not run it a
  third time, because another agent was running two 3×-DPI browser suites on this box and a third
  number measured under that load would have settled nothing. **The substance is right** (the
  `overlayNow()` assertion cannot see the tour) and the direction is arithmetically certain. Pass 4
  did not number this item; nor do I.
- **The 5px overflow itself.** I measured it (FINDING 3) and did not diagnose or fix it. `"10:00 AM"`
  in a 58×36 box at 320px, `white-space: normal`, on three Home variants — whether the right answer
  is a wider box, a smaller time format, or a written exemption is the builder's call and the
  Designer's, not mine. I also did not re-run `overflow-scan` against the pre-palette file; I
  established that the palette commit changed no layout line instead, which is cheaper and answers
  the same question.
- **One width only (390) for contrast**, as all four prior passes.
- **The screens outside the scan's eight** — Settings, Calendar, Help, the med editor, Upgrade,
  What's New, Setup, Bowel, Appetite, Radiation, the symptom reports, every modal and every toast.
  And now, explicitly, **the grouped card's paused and treatment-excluded rows** (FINDING 1), which
  the fixture never renders.
- **Interaction states.** No `:hover`, `:focus`, `:active`, `:disabled`. Rule 5.5's question is still
  open for contrast.
- **No real device, no iPhone, no Safari.** Chromium only; `-webkit-text-fill-color` measured only in
  Chromium. Colour management, P3 and sub-pixel rendering are exempt here, stated rather than skipped.
- **The published app-v89 baseline**, still unscanned, as all four prior passes left it.
- **I did not run the full `release_check.sh`.** No rule-5 path moved, the gate refuses anyway for
  want of a `PM*app-v91*` sign-off (`outputs/` holds four `AUDIT*app-v91*` files and no `PM*`), and
  FINDING 3 means it would stop on `overflow-scan` before reaching anything else. I verified the loop
  statically and falsified the two suites' exit codes individually instead.
- **I did not edit `index.html` or `sw.js`.** Every mutant was a byte copy outside the repo, the source
  md5 asserted before each build and verified on disk and against what the server returned, each on
  its own port. I started 8972-8975 and left 8877 as I found it; the pre-existing 8899, 8901, 8921,
  8941, 8942 and 8964 were not touched. The instrumented copies of the scan (per-string dump,
  `tourDone` probe) and my probe mutants file exist only in my scratch directory and are not in this
  repo.
- **I did not touch `care-tracker`** in any way — not a read, not a scan, not a clone. Rule 0.0.
- **I did not write the PM sign-off**, the Enhancer pass or the Design pass, and have no authority to.
  **I did not push to `main`.**
