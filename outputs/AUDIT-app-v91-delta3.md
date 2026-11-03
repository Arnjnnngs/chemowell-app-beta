# AUDIT — app-v91, DELTA PASS 3 (Zero Day Auditor, fourth pass)

AUDITED-COMMIT: 58faf04704802a34cbc1918363009bea546251c1
VERDICT: DO NOT SHIP

**Audited sha `58faf04704802a34cbc1918363009bea546251c1`** (branch
`claude/caretracker-team-review-i83ik2`), `index.html` md5 `165a7a70dd4cc8547cbb4178901e0996`,
`sw.js` md5 `a1e86136b8f7c676d24e17d3f5d1f19c` — **verified on disk and as served on :8899,
identical to what passes 1, 2 and 3 examined.** Working tree clean. The app bytes have not moved
in four passes, so nothing the earlier passes established was re-spent: the palette's correctness,
the collapsed-colour sweep, the 63 enumerated backdrops, the gradient ΔE arithmetic, Rule 0, the
Voice and the frozen chart clock are taken as current and unexamined by me.

This pass covers `ec59918`, `de229bc` and `58faf04`: the clock freeze, the moving-backdrop
threshold, the narrowed `HIDE`, the de-duplicated count, the designer script's exit code, and the
corrected records.

**Every one of pass 3's eight findings has a real repair behind it, and the two that mattered most
are genuinely better: `-webkit-text-fill-color` closes the `currentColor` hole at its source rather
than downstream of it, and the third photograph earns its place (measured below).** I am not
blocking on anything the instrument does. **I am blocking because the shipped file asserts three
things that are false of it, and the one false-green class that survives all four repairs is
written down nowhere** — not in the code, not in `README.md`, not in `TEAM.md`, not in
`BACKLOG M38`. On a release whose entire deliverable is an instrument and its record, that is the
deliverable being wrong.

Nothing here requires a rebuild. The remediation list is four documentation edits and no code
change.

---

## BLOCK-1 — HIGH — A TRANSLUCENT OVERLAY STILL PRODUCES A BYTE-IDENTICAL SILENT FALSE GREEN, AND THE GUARD'S COMMENT CLAIMS IT CANNOT.

Pass 2 raised this as M-SEMI. Pass 3 re-raised it as MEDIUM-1. Four repairs have landed since and
**it is untouched, undiminished, and now contradicted in writing.**

| mutant | md5 | difference from the shipped file | scan |
|---|---|---|---|
| **M4-CLEAN** (positive control) | `165a7a70dd4cc8547cbb4178901e0996` | none — the repo on :8899 | **310 / 602 / 0 below AA / worst 4.78:1, skipped 468, exit 0**, byte-identical on two consecutive runs |
| **M4-SEMI** | `dcfc26be936ebb9dc1559daad41d69a9` | one `<div>`: fixed 390×140 bar at the top, `z-index:99999`, `pointer-events:none`, `background: rgba(255,255,255,0.85)` | **310 / 602 / 0 below AA / worst 4.78:1, skipped 468, exit 0 — BYTE-IDENTICAL HEADLINE TO A CLEAN BUILD** |

Byte copies outside the repo, md5-verified on disk and as served, on their own ports, exit status
read from node directly.

**And the figures are not merely green — 48 of the 310 printed ratios MOVED, and all 48 moved UP.
None moved down.** Dumped row by row against the control (the scan does not emit its measured set,
so I instrumented a copy of it outside the repo to get this):

| string | ink | backdrop CLEAN | backdrop VEILED | printed | TRUE on screen |
|---|---|---|---|---|---|
| `Alex’s Meds` | `#2A2127` | `#FDDCCE` | `#FFFAF8` | 12.12 → **15.08:1** | **1.30:1** |
| `Tuesday, Nov 3` | `#5C4E52` | `#FDDCCE` | `#FFFAF8` | 6.11 → **7.61:1** | **1.22:1** |
| `ChemoWell` | `#A83D0F` | `#FDDCCE` | `#FFFAF8` | 4.88 → 4.88:1 | **1.22:1** |
| `BETA` | `#8C5900` | `#FFF3E2` | `#FFFEFB` | 5.41 → 5.41:1 | **1.22:1** |

The patient's own name, painted at `#DFDEDF` on `#FFFAF8` and unreadable by anybody, is printed as
**15.08:1** and reported `PASS`.

**Why neither guard fires.** The backdrop is read from the photograph, so it correctly includes the
veil. **The ink is not** — it comes from `cs.color`, unveiled. The rendered ink under an 85% white
veil is `0.15·ink + 0.85·white`. The glyph still changes pixels through a translucent layer, so the
A/B diff counts it live; the layer is static, so B and C are identical and the new moving-backdrop
guard says nothing. The `HIDE` narrowing is irrelevant to it, because nothing about the veil depends
on `color`.

**It is reachable in this app.** `#tour-scrim` is a full-viewport `pointer-events: none` translucent
layer. It fails loudly only because it is dark; a light one passes green. (Confirmed separately: the
tour probe below is the dark case.)

### The blocking part is not the hole. It is that the file says the hole is not there.

Pass 3's repair rewrote the `overlayNow()` comment correctly and ended it:

> *"It is NOT the guard for painted-but-not-hit-testable layers. That is the pixel diff, and **its
> own limits are written where it lives.**"*

**At the pixel diff, no limits are written.** What is written there instead
(`test/contrast-scan.mjs`, above `shotAndSample`) is a universality claim:

> *"Mechanism-independent: it does not care who painted the layer, whether it is hit-testable,
> whether the app knows about it, or whether the text escaped `color` through `fill` or anything
> else invented later."*

M4-SEMI is a layer it does not catch, and under which every number it prints is wrong in the
optimistic direction. Pass 3 asked for one sentence — *"the honest minimum is a sentence in the file
saying the diff proves 'something in this box changed', not 'a glyph in this box is visible'"* — and
that sentence was not added. The forward reference pass 3's own fix introduced now points at
documentation that does not exist, which makes the record worse than before that fix, not better.

**This is the fourth consecutive pass on which this release's record claimed more than its
instrument delivers, and the project's own rule is quoted twice in the file it happened in:** *a
claim about behaviour that nobody measured does not become true by being written into the code next
to a real fix.*

## BLOCK-2 — MEDIUM — THE C-FRAME COMMENT DESCRIBES A `HIDE` THAT THE NEXT COMMIT DELETED.

`test/contrast-scan.mjs:291-293`, present tense, about the code 100 lines above it:

> *"The diff above assumes that anything changing between A and B is a glyph. **`HIDE` is wider than
> that: it sets `color: transparent` on every element**, so a border, background, box-shadow or SVG
> fill drawn from `currentColor` changes too…"*

`HIDE` has not set `color: transparent` since `de229bc`, which is the commit after the one that
wrote this. It sets `-webkit-text-fill-color: transparent`, and the comment 100 lines up says so
explicitly and explains why. **The hole this paragraph describes was closed by the next commit and
the paragraph was not re-read.**

Two concrete costs, not stylistic ones:

* A future session grepping `HIDE` for `color: transparent` on the strength of this paragraph will
  not find it and cannot tell whether the comment or the code is current.
* Worse in the other direction: a session that believes this paragraph describes the live mechanism
  may "restore" `color: transparent` — which is the exact three-guards-deep defect `de229bc` exists
  to fix.

This is pass 3's BLOCK-2 shape, one commit later, in the same file.

## MEDIUM-1 — THE README SENTENCE PASS 3 REQUIRED DELETED "IN BOTH PLACES" IS STILL THERE, IN THE SECOND PLACE.

`README.md`, the app-v91 row:

> *"Repaired version-agnostically: nothing is seeded, the modal is dismissed by its own hook if it
> is there, and the scan **refuses with exit 3** if anything is still over the screen."*

It refuses if the What's New modal is still mounted, or if a **hit-testable** near-full-viewport
layer is up. Not "anything" — and the tour scrim, a full-viewport layer, is covered by neither
guard, which the same cell states correctly about **1,500 words later**. The sentence is never
struck, marked superseded, or corrected at its site; the paragraph is chronological and a reader
meeting the sentence has no way to know a retraction is coming four screens down.

Pass 3's item 1 was *"delete the false sentence, in both places"* and called it *"the cheapest item
on the list and the one a future session will be most hurt by."* One place was done.

## MEDIUM-2 — THE RECORD CARRIES THREE GENERATIONS OF FIGURES FOR THE SAME MEASUREMENTS, INCLUDING THE `108` THAT PASS 3 BLOCKED ON.

The app-v91 README row states, as a measured result:

> *"Measured with node's own exit code rather than through a pipe…: **mutant → exit 1, 108 invisible
> strings caught, 261 measured instead of 309; clean shipped build → exit 0, 309 measured, 0 below
> AA, worst 4.71:1.**"*

Measured by me against the shipped file, same mutant shape (M4-OPAQUE, md5
`991cf45ad746240017c5edaa308d6960`):

| the record says | the shipped file does |
|---|---|
| mutant: **108** invisible | **6** invisible |
| mutant: **261** measured | **262** measured |
| clean: **309** measured, **565** samples | **310** measured, **602** samples |
| clean: worst **4.71:1** | worst **4.78:1** |
| clean: **374** skipped | **468** skipped |

`108` is the inflated count pass 3 blocked on; the fix shipped and the record kept the pre-fix
number, presented as a measurement of the release. The same cell *also* carries the current figures
(`310 strings / 602 samples / worst 4.78:1, identical across two runs`), correctly, several hundred
words away. **Both sets read as current and they disagree.** A reader cannot tell which describes
the file, which is the condition the first refusal of this release was issued for.

## MEDIUM-3 — THE DE-DUP COMMENT STATES THE ARITHMETIC AND THE LINE BELOW IT PRINTS A DIFFERENT NUMBER.

The new comment above the de-duplicated print:

> *"108 'strings' against the opaque-bar mutant was 48; the clean run measures 309 and the mutant
> 261, and **309 − 261 = 48 is the arithmetic that says so.**"*

Measured: clean **310**, M4-OPAQUE **262**, difference **48** — the arithmetic is right and I confirm
it. The line below then prints **`FAIL 6 string(s)`**. The 48 is six distinct header strings
(`ChemoWell`, `BETA`, `Alex’s Meds`, `Tuesday, Nov 3`, `Beta date controls`, `▼`) × eight screens.

`invisible` is de-duplicated **globally** by text+box; `measured` counts distinct **per screen**.
Two different denominators, so the printed count and the measured delta cannot be reconciled by a
reader, and the comment asserting the reconciliation names a third number. The direction is the safe
one this time — 6 understates 48 rather than 108 overstating it, and the exit code is 1 either way —
but it is the same unreconcilable-numbers defect in the line written to cure it. Printing both
(`6 distinct, 48 measurements across 8 screens`) is the whole fix.

## MEDIUM-4 — THE CLOCK FREEZE IS NOT TIMEZONE-STABLE, AND THE RECORD PINS THE FIGURE WITHOUT NAMING THE CONDITION.

The freeze cures the drift it was built for: **two consecutive runs are byte-identical, and so are
runs in four different zones.** But the figure itself depends on the zone:

| TZ | measured / samples | 0 below AA | worst |
|---|---|---|---|
| UTC | **310 / 602** | yes | 4.78:1 |
| Asia/Tokyo | 310 / 602 | yes | 4.78:1 |
| Pacific/Kiritimati | 310 / 602 | yes | 4.78:1 |
| Europe/London | 310 / 602 | yes | 4.78:1 |
| **America/Chicago** | **313 / 604** | yes | 4.78:1 |
| **America/Denver** | **313 / 604** | yes | 4.78:1 |

**Mechanism, confirmed rather than guessed:** `FROZEN` is 14:00 *local*, but the fixture walks back
six days in fixed milliseconds (`now - d * 86400000`). Both US zones above had a DST transition on
1 Nov 2026, inside that window, so a fixed-ms day is not a calendar day there: an entry lands at
12:30 instead of 11:30, crosses noon, and the app draws one more time-of-day heading. Europe/London
transitioned 25 Oct, outside the window, and matches UTC — which is the control that makes DST the
cause.

**The verdict is stable in every zone** (0 below AA, worst 4.78:1), so this is not a false green. It
is that `310 / 602` is now pinned in `README.md` and `TEAM.md` as the release's figure and a future
auditor on a US machine measures `313 / 604` and has to work out whether the file moved. That is the
cost the freeze was added to remove. One line fixes it: `timezoneId` on the context, with `FROZEN`
computed in the same zone.

## LOW-1 — The freeze permanently narrows what the scan looks at, and nothing says so.

The brief asked whether the freeze changed *which* strings are measured in a way that hides
something. **It changed them; it hides nothing below AA.** I dumped both measured sets (instrumented
copies outside the repo) and diffed:

* 14:00 local means the fixture's readings land only in **Morning** and **Afternoon**. Before the
  freeze the same fixture rendered **Overnight** (`#5C4E52` on `#FEE4CC`, 6.44:1). **"Overnight" and
  "Evening" can now never appear in a run.**
* One string left the set: `Reports / History  "69.4 lbs"  #6A4433 on #EADDD7  6.36:1` (hence 311
  pre-freeze vs 310).
* Nothing dropped was below AA, and the frozen set is the **harder** of the two: its worst is
  **4.78:1** (`"Remove"`, `#A15B56` on `#FAF8F7`) against **4.84:1** pre-freeze.

The four time-bucket headings share one ink, size and weight today, so no contrast case is lost. If
a future release styles `Overnight` differently — a dark chip is the obvious one — this scan will
never see it, and the freeze comment does not mention that it froze two of the four out.

## LOW-2 — `px` exceeds `of` in the unstable report.

From the M4-JSFLICK run: `"BETA"  1242 of 1231 px changed`. `moving[i]` is counted over the clamped
integer box; `area` is `round(w) * round(h)` from the fractional box. Harmless numerically — the
threshold is nowhere near the boundary — but a failure message that prints an impossible fraction
invites exactly the "is this instrument right?" round this release has had four of.

## LOW-3 — The designer script can now fail, and nothing runs it.

Pass 3's MEDIUM-4 had two halves. The first is closed and falsified (below). The second is
unchanged: `release_check.sh:538` checks only that a file matching `outputs/DESIGN*app-v91*` exists.
`test/v91-designer-pass.mjs` appears nowhere in the gate, so the exit code just added has nothing
invoking it, and *"zero page errors"* remains a `console.log` from a hand-run script. `TEAM.md`'s own
new section says it: *"Declaring a gate and wiring a gate are two tasks. Do the second one in the
same commit."*

## LOW-4 — `BACKLOG M38` was not updated, so the two open holes are recorded nowhere.

Pass 3's item 7 asked that the translucent-overlay and moving-overlay findings go into `M38` with
their mutant md5s. `M38` is unchanged from before this release. It still reads as entirely open, and
its item 2 — *"Hiding the text must change the pixels under it. Photograph once with text, once
without, and assert the two differ inside every text box"* — **is what shipped as the A/B diff** and
is not marked done. `TEAM.md`'s new section states the right rule (*"Every mutant above… belong
beside the scan, not in a scratch directory"*) and then leaves them in a scratch directory.

## LOW-5 — The `--json` artefact cannot support the comparison the freeze exists to enable.

`--json` writes `{screen, measured, fails}` per screen and nothing else. The freeze's own
justification is that *"comparing runs is how the overlay defects in this file were all found"* — but
to compare *which strings* two runs measured I had to patch a copy of the scan. Adding the per-string
rows is a few lines and makes every future delta pass cheaper than this one was.

---

## Confirmed, so nobody pays for it again

| claim | reproduced? | evidence |
|---|---|---|
| sha, both md5s, clean tree, served bytes | **yes** | `58faf04…`; `165a7a70…` / `a1e86136…` on disk and from :8899 |
| clean → exit 0, 310 / 602 / 0 below AA / worst 4.78:1 | **yes** | node's own exit status |
| **identical on two runs** | **yes — byte-identical output, `diff` clean** | two consecutive runs, 28s each |
| opaque bar → exit 1 | **yes** | M4-OPAQUE `991cf45ad746240017c5edaa308d6960`, 6 invisible, 262 measured |
| `background: currentColor` + 2s transition → exit 1 | **yes, and now by the RIGHT branch** | M4-CURCOL `d7b7a24a1a3039f55d53946d7ed05d9e` → caught as **invisible** (zero diff), not as moving. The narrowed `HIDE` closed it at source; the C frame is not what catches it |
| 30ms `setInterval` flip → exit 1 | **yes** | M4-JSFLICK `c8b84b614d706074445efd5c5d64701f`, 6 moving + 6 invisible, 268 measured |
| **the third photograph earns its place** | **yes, measured** | same scan with `movedEnough` forced false: M4-JSFLICK leaks to **304** measured instead of 268 — 36 further string-measurements taken against an animating bar, matching pass 3's "36 of 108". It still exits 1 without C, by luck of which boxes landed on which frames; **C makes the catch deterministic, which is the property a gate needs** |
| BLOCK-2's replacement text is TRUE, not softened | **yes in substance** | `tourDone: false`, nothing else changed: **181 below AA, worst 1.74:1, `REFUSING` printed ZERO times**, exit 1 from the phantom failures. `anyOverlayOpen()` does not see the tour, exactly as the new comment says |
| …but it pins figures from a different build | — | the comment and README say *"184 phantom failures, worst 1.39:1"*; the shipped file gives **181 / 1.74:1**. Substance right, digits not reproducible from the file they sit in. Say it qualitatively or re-measure |
| MED-3 de-duplication works | **yes** | 6 instead of 108 — see MEDIUM-3 for the denominator mismatch |
| MED-4 designer script can fail | **yes, falsified both branches** | page-error mutant `3ba63edacabe596cd393aca93f044b0d` → **exit 1**, `page errors: 3` (one per width); mounted-modal mutant `f6e11c40013767738ea1b22fffbcb66d` → **exit 3**, `REFUSING: What's New still open at 320px` |
| the contrast scan's own exit-3 branch | **yes** | same modal mutant → **exit 3** with its own refusal text |
| LOW-1 `--file` | **yes, gone** | no `arg('--file')`; the header now states there is none and why |
| LOW-2 DESIGN M36 | **yes, corrected** | `outputs/DESIGN-app-v91.md:49-51` gives 62×21 at 320, 73×18 at 360, **83×21 = 1743px² at 390**, and names 390 the worst |
| no PM sign-off exists for this release | **confirmed** | `outputs/` holds three `AUDIT*app-v91*` files and no `PM*app-v91*`. Not mine to write |

### Three things I attacked and could NOT break — the 25% knob is sound in both directions

The brief asked me to beat the threshold. I could not, and the reason is worth keeping:

* **A real overlay that changes less than 25% of a box.** M4-SLIVER
  (`e7c59eff000d1145bdde45909c7783f1`): a 4px-tall opaque line flipped `#FFFFFF`↔`#101010` every
  30ms across the header. It beat the threshold as designed — **zero strings flagged moving** — and
  the consequence was a **false FAIL** (5 below AA, worst 3.03:1, exit 1), not a false green,
  because a sample point landed on a dark frame. To get under 25% of a box an overlay must leave
  most of the word showing, i.e. must not be hiding it. **The knob is tied to the quantity it is
  about.** Pass 3 called it "a knob and knobs are how checks go vacuous"; on this evidence it is
  not one.
* **A legitimate animation that changes more than 25%.** M4-BENIGN
  (`6d3cbf452048e4e319034717c4b69669`): the body gradient replaced with a 400% animated one, plus a
  JS timer stepping `background-position` every 30ms — a real design pattern, deliberately chosen to
  be the false-positive case. **Exit 0, figures byte-identical to clean, zero strings flagged.** An
  animation subtle enough to pass is one whose sample is still nearly valid. **I could not make the
  gate block a legitimate release.**
* **Two overlay classes the brief listed as untested, both caught.** `mix-blend-mode: lighten` over
  an opaque white layer (`0432e95629ca28df60caa129401cec66`) → exit 1, 6 invisible, 262 measured.
  `backdrop-filter: blur(8px) brightness(1.6)` (`80231234b91a08d17b10b85bd4132679`) → exit 1, 4
  invisible, 278 measured — 2 of the 6 header strings survived the blur and were measured against a
  brightened backdrop with unveiled ink, which is a smaller instance of BLOCK-1; the run still
  blocks.
* **`opacity` on an ancestor is a SECOND instance of BLOCK-1's premise, and it blocks by accident.**
  `#root{opacity:0.35}` (`7248e405acae2b0ab565106ad18781d1`) → exit 1, 13 below AA, worst 1.69:1.
  Caught — but for the wrong reason: the other **297 of 310** strings still printed as passing while
  painted at 35%. `getComputedStyle(el).opacity` is the element's own value, so an ancestor's opacity
  never reaches the `< 0.95` skip. **Not live in the app today** — the file has one `opacity:0`, two
  `opacity:1`, and the only `0.65` is inside a comment — so this is a gate hole, not an app defect,
  exactly the status `currentColor` had before it became the deepest defect of the release.
* **Pseudo-element text is not a gap today.** No `content:` declaration in `index.html` carries
  words, so the `::before`/`::after` class the brief raised has nothing to miss. It would be silent
  if one were added — the tree walker sees text nodes only, and a pseudo-element string would not
  even reach the skip counters.

---

## IS THIS SHIPPABLE? — the straight answer the brief asked for

**Ship the palette. Wire the scan in as a gate — do not demote it. Do the four documentation edits
first; they are minutes, and they are what I am blocking on.**

**On the app:** stop auditing it. Byte-identical for four passes, cleared by three independent
audits, and the change is right. A fifth pass over `index.html` would be quota spent to re-confirm
what has been confirmed three times, and the only remaining risk on it is a real device, which this
sandbox cannot supply and which is Aaron's.

**On the instrument — wire it in, as it stands.** The instrument has had nine defects to the app's
zero, which looks like an argument for demoting it and is not, for one reason that decides it:
**every one of its defects is an under-catch, and I could not produce a single over-block.** A gate
that misses things is worth having; a gate that fails legitimate work is the one that gets `|| true`
written beside it at the end of a long day, and that has already happened in this repo. I tried
specifically to make this one cry wolf — a realistically animated background, a benign sliver — and
it stayed green on the first and failed safe on the second. Its failure path reaches the real gate
(pass 3 verified that), it costs 28 seconds in a 250-second run, and it is the only check this
project has ever had that asks whether the words can be read. It already found 56 real failures that
five existing gates walked past for months.

**Demoting it to a reporting tool would be the worst of the three options**, and this project has
written the reason down three times: the Enhancer's list that sat in `outputs/`, Rule 0.7's task
list in a panel nobody opens, Rule 0.8's table. **Output that lands where the owner does not look is
not output.** A contrast report nobody is required to read is a contrast report nobody reads.

**What the instrument may not do is claim to be more than it is**, and that is the whole of my
refusal. As shipped it says it is *"mechanism-independent"* and points to limits *"written where it
lives"*, and a 390×140 translucent `<div>` makes it print a patient's name at 15.08:1 when it is
painted at 1.30:1 — green, silent, and byte-identical to a clean build. A gate that under-catches
and says so is an asset. A gate that under-catches and advertises completeness is how the next
session concludes "0 below AA" means no unreadable text, which is the sentence this release exists
to make true.

### The four edits that turn this into SHIP. No code change, no rebuild.

1. **BLOCK-1** — at the pixel diff, write the limit pass 3 asked for: the diff proves *something in
   this box changed*, not *a glyph is visible*; and a **translucent** layer defeats it in the
   optimistic direction, because the backdrop is read from the photograph (veiled) while the ink is
   read from `cs.color` (unveiled). Then either delete *"mechanism-independent"* or qualify it.
   `#tour-scrim` is the live example and should be named.
2. **BLOCK-2** — fix `test/contrast-scan.mjs:291-293`. `HIDE` sets `-webkit-text-fill-color`, not
   `color`.
3. **MEDIUM-1 / MEDIUM-2** — strike the README's *"refuses with exit 3 if anything is still over the
   screen"* at its site, and mark the superseded figure sets (`108` / `261` / `309` / `565` / `374` /
   `4.71`) as superseded by `6` / `262` / `310` / `602` / `468` / `4.78`.
4. **LOW-4** — `BACKLOG M38` carries the two open holes with the mutant md5s from this report, and
   its item 2 is marked done.

Cheap and worth doing in the same pass: MEDIUM-3's two-number print, MEDIUM-4's `timezoneId`,
LOW-3's one line in `release_check.sh`.

### And one process recommendation, which is the thing most likely to cause defect number ten

`TEAM.md` now says the mutant corpus *"belong[s] beside the scan, not in a scratch directory"* — and
every mutant from four audits, mine included, is in a scratch directory that will not survive this
session. **Commit the corpus as a runnable script.** The next edit to this file will be made by
somebody who has read nine comments about defects they cannot reproduce, and the only reason any of
the nine was found is that somebody ran a mutant.

---

## What I did NOT check

- **Everything passes 1, 2 and 3 established**, by instruction: the palette's correctness, the
  collapsed-colour sweep, the 63 enumerated backdrops, the gradient ΔE arithmetic, Rule 0, the
  Voice, the frozen chart clock, `309/56/2.1` → `309/0/4.71`, the `rgba()` debt, `NOTICE_TONES.info`,
  the `__stash` reference question, the Back pill, scroll coverage, `HIDE`'s 120ms settle. The md5s
  are identical; their findings stand unexamined by me and should be read as current.
- **One width only (390) for contrast**, as all three prior passes. The Designer captures cover
  320/360/390 for four screens; the contrast gate does not.
- **The screens outside the scan's eight** — Settings, Calendar, Help, the med editor, Upgrade,
  What's New, Setup, Bowel, Appetite, Radiation, the symptom reports, every modal and every toast.
  Unchanged by this commit; the Enhancer raises it as E1.
- **Interaction states.** No `:hover`, `:focus`, `:active`, `:disabled`, by me or by the scan.
  Rule 5.5's question is still open for contrast.
- **No real device, no iPhone, no Safari.** Chromium only in this sandbox; `-webkit-text-fill-color`
  is a WebKit-prefixed property and I measured it only in Chromium. Colour management, P3 and
  sub-pixel rendering are exempt here, stated rather than skipped.
- **The published app-v89 baseline** — still unscanned, as all three prior passes left it.
- **I did not re-run the full `release_check.sh`.** No rule-5 path changed in this delta, pass 3
  verified that the scan's failure path reaches the gate, and the gate refuses anyway for want of a
  `PM*app-v91*` sign-off. I did confirm the scan is invoked (`release_check.sh:855`) and that the
  designer script is not.
- **`BACKLOG M36`'s `88×7` figure at maximum scroll**, as pass 3 left it.
- **The partial-coverage case on a multi-line text box.** An opaque bar hiding one line of a tall box
  can be under 25% of its area while the remaining samples stay valid; I reasoned about it and did
  not build it. It is an incompleteness, not a wrong measurement, and it is the weakest of the
  open items.
- **I did not edit `index.html` or `sw.js`.** Every mutant was a byte copy outside the repo, the
  source md5 asserted before each build, md5-verified on disk and against what the server returned,
  each on its own port. I started 8951–8961 and killed only those; the pre-existing 8899, 8901, 8921,
  8941 and 8942 were left alone. The instrumented copies of `test/contrast-scan.mjs` and
  `test/v91-designer-pass.mjs` used for the string-set dumps and the C-frame falsification exist only
  in my scratch directory and are not in this repo.
- **I did not touch `care-tracker`** in any way — not a read, not a scan, not a clone. Rule 0.0.
- **I did not write the PM sign-off**, the Enhancer pass or the Design pass, and have no authority
  to. **I did not push to `main`.**
