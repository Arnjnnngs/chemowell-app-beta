# AUDIT — app-v91, DELTA PASS 2 (Zero Day Auditor, third pass)

AUDITED-COMMIT: 1509faf4a288534ddf98985a9d419a6a91381617
VERDICT: DO NOT SHIP

**Audited sha `1509faf4a288534ddf98985a9d419a6a91381617`** (branch
`claude/caretracker-team-review-i83ik2`), `index.html` md5 `165a7a70dd4cc8547cbb4178901e0996`,
`sw.js` md5 `a1e86136b8f7c676d24e17d3f5d1f19c` — **both verified on disk and as served on :8899,
identical to what passes 1 and 2 examined.** The app bytes have not moved since `2a6e89a`, so
nothing passes 1 and 2 established about the palette was re-spent: the collapsed-colour sweep, the
63 enumerated backdrops, the gradient ΔE arithmetic, Rule 0, the Voice and the frozen clock are
taken as current and unexamined by me.

This pass covers `d4e1864` and `1509faf` only: DELTA-1's second repair, DELTA-4's key fix, the
corrected records, and the two new chain artefacts.

**The repair is better than the one it replaces and the reasoning behind it is right.** It still
does not close the class, and the comment shipped above it claims that it does, about the one
example it is wrong about.

---

## BLOCK-1 — HIGH — DELTA-1 is NARROWED, NOT CLOSED. An opaque, non-hit-testable bar still produces a byte-identical silent false green.

The two-photograph guard rests on one premise: *the only pixels that differ between the two frames
are glyph pixels.* **That premise is false, because `HIDE` does not only hide glyphs.** It sets
`color: transparent !important` on `*,*::before,*::after`, plus `text-shadow:none`,
`-webkit-text-stroke:0`, and `fill`/`stroke` on SVG text. Anything on the page that derives its
painted appearance from `color` — a `currentColor` border, background, box-shadow, or an SVG fill on
a non-text element — changes between photograph A and photograph B **where no glyph has ever been.**
The diff is then non-zero for every box under it, and the covered text is counted as "live".

Falsified with a byte copy outside the repo, md5-verified on disk and as served, on its own port:

| mutant | md5 | difference from the shipped file | scan |
|---|---|---|---|
| **M-CONTROL** (positive control) | `165a7a70dd4cc8547cbb4178901e0996` | none — the shipped bytes in the mutant harness | **309 / 565 / 0 below AA / 4.71:1, skipped 374, exit 0** — identical to the repo run, so the harness itself changes nothing |
| **M-TRANS** | `a2799a49d21319566b7b9cc6728dd42c` | one `<div>`: fixed 390×140 opaque bar at the top, `z-index:99999`, `pointer-events:none`, `color:#FFFFFF; background:currentColor; transition: background 2s linear` | **309 / 565 / 0 below AA / worst 4.71:1, exit 0 — BYTE-IDENTICAL HEADLINE TO A CLEAN BUILD** |

`PASS Home (62 strings, all at or above AA)` for a Home screen whose top 140px is behind an opaque
white bar. No invisible strings reported. Exit 0, measured as node's own status.

**Why this is structural rather than exotic.** `background: currentColor` is the clearest trigger,
but it is not the only one: `border-color`, `box-shadow`, `outline`, `caret-color`, `fill` and
`stroke` all default to or are commonly set from `currentColor`, and `HIDE` rewrites `color` on every
element on the page. The guard's own comment says it is *"mechanism-independent… it does not care
who painted the layer, whether it is hit-testable, whether the app knows about it."* It does care
about one thing: that the overlay's own pixels are unaffected by the stylesheet the guard injects.
Nothing checks that, and the guard has no way to tell "this box changed because a glyph was there"
from "this box changed because the thing covering it changed too".

Today's `index.html` contains `currentColor` once, so this is not a live defect in the app — it is a
hole in the gate, which is exactly what DELTA-1 was, and the gate is the deliverable of this release.

## BLOCK-2 — HIGH — `overlayNow()` CANNOT catch `pointer-events: none` layers. The comment above it says it can, and names the one example it is wrong about.

The release kept the first repair as well as the second. The assertion added at
`test/contrast-scan.mjs:287` refuses the run when `window.__backTest.overlayNow()` is not `false`.
`overlayNow()` is `anyOverlayOpen()` (index.html:1920), and that function **skips
`pointer-events: none` by explicit design**:

    // A LAYER THAT LETS TAPS THROUGH IS NOT COVERING ANYTHING, AND THIS ONE LINE IS THE WHOLE
    // DIFFERENCE BETWEEN A LOCK AND A TRAP.
    if (cs.pointerEvents === 'none') continue;

There are twenty lines of comment there explaining why: treating `#tour-layer` as an overlay froze
the body through the whole first-run guide and **a brand-new user could not add their first
medication.** That line is load-bearing for the app and must not change.

**So the assertion is structurally incapable of catching the class DELTA-1 was about** — and the
shipped comment, in the file, says the opposite:

> *"So ask the APP whether anything is over the screen… and it covers What's New, the tour, the
> drawer, the upgrade sheet and every overlay added after this comment. **One assertion, whole
> class.**"*

Two paragraphs above it, the same comment names the tour as *"not hypothetical in this app"*.

**Measured, against the unmodified repo bytes on :8899, with one value changed in the FIXTURE
(`tourDone: false`) and nothing else:**

    260 DISTINCT strings measured (478 samples), 184 below AA, worst 1.39:1
    exit 1 — and NO `REFUSING:` line anywhere in the output

**The assertion did not fire.** 184 phantom failures against `#BFA296`-class colours that exist
nowhere in the palette — within one hundredth of pass 2's pre-fix measurement (184 below AA, worst
1.38:1). The exit-1 came from the phantom contrast failures, not from the guard. The pixel-diff
guard did not fire either: the tour scrim is `rgba(34,14,6,0.28)`, so glyphs still change pixels
through it, and **zero** invisible strings were reported.

The README row carries the same false claim in different words: *"the scan **refuses with exit 3**
if anything is still over the screen."* It refuses if the What's New modal is still mounted, or if a
**hit-testable** near-full-viewport layer is up. Not "anything".

**This is the Voice's first question one level down in the test suite, and the project has already
written the rule for it.** index.html's own withdrawn-claim comment, ten lines above the
`pointer-events` line, says: *"A claim about behaviour that nobody measured does not become true by
being written into the code next to a real fix."* Here it WAS measured — the builder's own account
says the mutant "passed again, byte for byte" against this assertion — and the claim that it covers
the class was written anyway, beside a fix that is real.

The assertion is not worthless: it would catch a hit-testable scrim the What's New check misses.
Keep it, and delete the sentence that says it covers the tour.

## MEDIUM-1 — A translucent overlay is invisible to BOTH guards, and the numbers it produces OVERSTATE contrast.

| mutant | md5 | difference | scan |
|---|---|---|---|
| **M-SEMI** | `f8179638ff0b5a43ccb0ae99ef357dbf` | the same bar at `rgba(255,255,255,0.85)` | **309 / 565 / 0 below AA / worst 4.71:1, exit 0** |

Green, and the figures are not just green — **47 strings were measured against a veiled backdrop and
every one of their ratios moved UP**, dumped row by row against the control:

| string | ink | backdrop CLEAN | backdrop VEILED | printed ratio |
|---|---|---|---|---|
| `ChemoWell` | `#A83D0F` | `#FDDCCE` | `#FFFAF8` | 4.88 → **6.07** |
| `Alex’s Meds` | `#2A2127` | `#FDDCCE` | `#FFFAF8` | 12.12 → **15.08** |
| `Tuesday, Nov 3` | `#5C4E52` | `#FDDCCE` | `#FFFAF8` | 6.11 → **7.61** |
| `BETA` | `#8C5900` | `#FFF3E2` | `#FFFEFB` | 5.41 → 5.88 |

The backdrop is read from the photograph, so it correctly includes the veil. **The ink is not** — it
comes from `cs.color`, unveiled. The rendered ink under an 85% white veil is
`0.15·ink + 0.85·white`, so `Alex’s Meds` is painted at about `#DFDEDF` on about `#FFFAF8`: a true
on-screen ratio near **1.3:1**, printed as **15.08:1**. The error is in the dangerous direction and
it is silent.

Not hypothetical: `#tour-scrim` is a full-viewport `pointer-events: none` translucent layer. It
fails loudly only because it is dark. A light one passes green. (The app has no `backdrop-filter`
anywhere — I checked — so the blurred-scrim variant of this is not reachable today.)

## MEDIUM-2 — An overlay that changes between the two photographs leaks a third of its covered strings past the guard.

| mutant | md5 | difference | invisible caught | measured |
|---|---|---|---|---|
| **M-OPAQUE** (reproduction of the builder's falsification) | `8925e68a7218be1922282efd4983cec7` | static opaque bar, `pointer-events:none` | **108**, exit 1 | 261 |
| **M-ANIM** | `f9ecb26931112c57ce04e3fcea2b410b` | same bar + `@keyframes` flicker `#FFFFFF`↔`#FEFEFE`, 200ms | **108**, exit 1 | 261 |
| **M-JSFLICK** | `fde59f240e60a055cf6f695c30aad5ad` | same bar + `setInterval` flipping the same two colours every 30ms | **72**, exit 1 | **291** |

A CSS keyframe animation is settled by Playwright's screenshot, so M-ANIM changed nothing. **A JS
timer is not**, and 36 of the 108 strings walked through — the diff for their boxes was non-zero
because the bar's own pixels moved between the shutter falls, not because a glyph did. The scan still
exited 1 here, by luck of which boxes landed on which frames. **How much of the hole the guard covers
depends on when the shutter falls**, which is not a property a gate should have.

This is also the honest answer to one of the questions put to this pass: anti-aliasing noise is not
the risk — a covered glyph produces an exactly zero diff, which I confirmed on 108 strings. **The
risk is anything else in the box moving.**

## MEDIUM-3 — "108 string(s)" is 108 COLLECTIONS. This is MEDIUM-4 again, in the line this delta added, four lines below the comment that records the lesson.

`rows` is de-duplicated by key per screen. `invisible` is not — it is pushed flat, once per
collection, across 20 scroll positions and 8 screens. The scan's own output proves it:

      "ChemoWell"  box [88,23,74,18]        <- 1st
      "BETA"  box [166,21,54,23]
      "Alex’s Meds"  box [16,54,344,24]
      "Tuesday, Nov 3"  box [16,80,344,18]
      "Beta date controls"  box [29,121,148,16]
      "▼"  box [348,121,13,16]
      "ChemoWell"  box [88,23,74,18]        <- the same six, identical boxes, again
      "BETA"  box [166,21,54,23]
      ...

Clean build 309 measured, M-OPAQUE 261 — **48 strings actually left the measured set. The headline
says 108.** A 2.25x inflation of the same kind pass 1 blocked on: *"565 'strings' was really 295, a
1.9x inflation… The ratios were right; the word was wrong, in four places in the record."* The fix
is the one already used eleven lines up: count distinct keys, and print the samples separately if
they are wanted.

## MEDIUM-4 — `test/v91-designer-pass.mjs` CANNOT FAIL. `test/v90-designer-pass.mjs` could, and the app-v90 PM sign-off is titled for that property.

The new script has **no `process.exit` at all**. It collects page errors into `errs`, prints
`page errors: 0`, and returns 0 whatever happened. `test/v90-designer-pass.mjs` ends:

    process.exit(bad || thrown.length ? 1 : 0);

and commit `49c937d` is *"PM app-v90 second pass: SHIP. The Designer pass is real and **its check can
fail**."* That property is gone one release later.

Two further consequences:

* It never asserts the What's New modal closed. It clicks the hook `if` it is there and carries on.
  If a future build leaves the modal up, this script photographs the modal twelve times and prints
  success — which is BLOCK-1 of this very release, in the seat next door.
* `release_check.sh` does not run it. The design-time gate (`release_check.sh:535`) checks only that
  a file matching `outputs/DESIGN*app-v91*` exists. So the one number the DESIGN report leads with,
  *"zero page errors"*, is a `console.log` from a hand-run script with no exit code behind it.

Rule 5: *"A check that cannot fail is worse than no check (a literal `|| true` shipped here)."*
One line fixes it.

## LOW-1 — `--file` is advertised in the usage header and is not implemented.

`test/contrast-scan.mjs:31`:

    //      [--file <index.html>] [--json <out>]

`arg('--file')` is never called. The code reads `--base`, `--json` and `--width` only. So
`node test/contrast-scan.mjs --file /some/other/index.html` silently scans **whatever happens to be
served on port 8899** and prints a clean PASS for a file nobody asked about. That is BLOCK-1's own
shape — an instrument measuring something other than the thing named — and `--file` is the idiom
this project uses elsewhere for exactly this purpose. Either implement it (serve the file, or read
it) or delete the line.

## LOW-2 — DESIGN's M36 finding is TRUE, and its scope is understated: it happens at 390 too, and worst there.

The claim this pass was asked to check specifically — *"This is a real-viewport screenshot, not a
`fullPage` capture"* — **is correct.** `p.screenshot({ path })` leaves `fullPage` at its default
`false`. And I did not need the screenshot: I measured the geometry directly, `deviceScaleFactor: 1`,
no capture involved.

The floating Back pill button (`88×42` at `y=714`, `pointerEvents:'auto'`,
`background: rgba(59,25,10,0.88)`) covers the Weight report's `Average` value box **at every width,
at scroll 0**:

| width | Average value box | overlap with the pill |
|---|---|---|
| 320 | `62×21` at (134, 721) | `62×21` — the **whole** box |
| 360 | `73×21` at (144, 738) | `73×18` |
| **390** | `83×21` at (154, 734) | **`83×21` — the whole box, 1743px²** |

DESIGN says *"At **320 and 360**"*. It is 320, 360 and 390, and 390 is the largest overlap. That
matters more than a width count: **390 is the only width the contrast gate runs at**, and there the
`Average` value is dropped into `covered: 65` and never measured, while the Designer report tells a
reader 390 is clean. The declined app-v90 finding was rightly overturned; the seat was right and
under-claimed.

At maximum scroll the tile has moved out from under the pill, so the overlap there is a different
one — the `88×7` over the last list row quoted from `BACKLOG M36`, which I did not re-measure.

---

## Confirmed, so nobody pays for it again

| claim | reproduced? | evidence |
|---|---|---|
| clean shipped build: 309 / 565 / 0 below AA / worst 4.71 / skipped 374, exit 0 | **yes, three times, byte-identical** | repo on :8899 (md5 `165a7a70` verified as served) and M-CONTROL on :8931, node's own exit status |
| builder's falsification: mutant → exit 1 with 108 invisible | **yes, exactly 108** | M-OPAQUE `8925e68a`, verified as served |
| the two-photograph change did not alter the figures | **yes** | pass 2's own version of the scan (`git show 56558c5:test/contrast-scan.mjs`) gives the identical 309 / 565 / 374 / 4.71 |
| the two-photograph change did not alter the cost | **yes** | shipped scan **21s**, pass-2 version **21s**, three shipped runs all 21s. Whole gate 247s. No timeout risk. |
| the new failure path reaches the real gate | **yes** | opaque mutant committed in a throwaway clone → `❌ RELEASE CHECK FAILED: test/contrast-scan.mjs`, quoting `FAIL 108 string(s)…`, gate **exit 1**, after the other four suites went green |
| the gate refuses a mutant that is only on disk | **yes, and it says so** | *"❌ BLOCKER: index.html or sw.js has uncommitted changes… If a falsification mutant is still applied, THAT is what this just caught."* |
| **DELTA-4**: no key collision introduced, count still right | **yes** | 309 rows, per screen 62/32/48/54/54/26/15/18; 17 distinct inks; 13 strings per screen rendered in more than one ink/size/weight — the split pass 2 enumerated still works. With `paint` in the key a collision cannot carry two different inks, and the total did not move. |
| **DELTA-2**: the record now describes what actually dismisses the notice | **yes** | the README row states plainly that by the 2200ms wait *"there is nothing to dismiss"*, that the hook path *"does not execute on this build"*, and that the 2200ms is load-bearing. One residual false sentence remains — see BLOCK-2. |
| **DELTA-3**: `102 strings` corrected | **yes** | the row's first sentence now reads *"it was 56 strings across eight"*, consistent with `56 below WCAG AA` nine lines later |
| **DELTA-5**: the denominator caveat now prints | **yes** | the `(NOT a coverage figure…)` line is in the output |
| ENHANCER E3: "30 `rgba()` literals still encode the retired colours" | **yes, exactly 30** | `rgba()` across all five retired triples: 1 + 1 + 19 + 7 + 2 = 30. index.html:8890 does carry `#0B5C40` beside `rgba(10,107,74,0.10)`. |
| ENHANCER: "at 320 the axis labels render at about 4.5 CSS px" | **yes** | 12px CSS × viewBox scale: **4.48px at 320**, 5.19 at 360, 5.72 at 390. `needs()` reads the 12 and applies the strict 4.5:1 threshold, so no AA threshold is wrongly loosened. |
| DESIGN: twelve captures, three widths, four screens, zero page errors | **yes** | script run against :8899, 12 PNGs, `page errors: 0` |

**And three things I attacked and could not break**, so the next pass does not re-spend them:

* **`window.__stash` stores a reference to the canvas, not a copy.** I expected photograph A to be
  destroyed when B was loaded. It is not: `__load` builds a **new** `canvas` element on every call,
  so `__cvA` keeps A. Safe as written, and fragile only if `__load` is ever changed to reuse one
  canvas.
* **The Back pill is not a false-green risk.** Its full-width fixed container is
  `pointer-events: none`, which looked like DELTA-1 again — but that container paints nothing, and
  the visible pill is an inner button with `pointerEvents: 'auto'`. `elementFromPoint` sees it, so
  the scan's header comment about skipping the Back pill is true.
* **No scroll-coverage hole.** `hMax` is `documentElement.scrollHeight`, not the max scroll offset,
  so every screen gets a pass at 0 and a pass at 700 (clamped by the browser), and the bottom of
  each screen is photographed. The `offscreen: 291` is re-collection, as pass 2 measured.
* **HIDE's 120ms settle is adequate on this build.** I expected the nav labels to be caught
  mid-fade, because the nav button declares `transition: background .18s ease, color .18s ease` and
  the shutter falls at 120ms. The label is a child `<span class="navlabel">` which declares no
  transition of its own, so `*{color:transparent !important}` hits it instantly. No text-bearing
  element in the file declares a `color` transition — pinned by nothing, and worth a line in M38.

---

## What must happen before this ships

1. **BLOCK-2 — delete the false sentence, in both places.** The comment at
   `test/contrast-scan.mjs:286-289` and the README row's *"refuses with exit 3 if anything is still
   over the screen"*. `anyOverlayOpen()` skips `pointer-events: none` by design and must keep doing
   so. Keep the assertion; say what it actually covers (a hit-testable near-full-viewport layer),
   and say that the tour scrim is covered by neither guard. **This is the cheapest item on the list
   and the one a future session will be most hurt by.**
2. **BLOCK-1 — make the guard's premise checkable, or state its limit.** The honest minimum is a
   sentence in the file saying the diff proves "something in this box changed", not "a glyph in this
   box is visible". A real closure needs a second signal that the overlay did not move: e.g.
   photograph a third frame with `HIDE` applied twice (A, B, B') and require the box to be
   **identical** between B and B', so a changing overlay is detected rather than mistaken for ink;
   or sample the backdrop only at points where B differs from A **and** B equals B'.
3. **MEDIUM-3 — de-duplicate `invisible` before printing a count of "strings".** The release was
   already blocked once for this exact word.
4. **MEDIUM-4 — give `test/v91-designer-pass.mjs` an exit code** (`process.exit(errs.length ? 1 : 0)`)
   and a refusal if the What's New modal is still mounted. Falsify it once.
5. **LOW-2 — correct DESIGN's M36 row to 320/360/390** and note that at 390 the `Average` value is
   silently in the contrast scan's `covered` bucket.
6. **LOW-1 — implement or delete `--file`.**
7. MEDIUM-1 and MEDIUM-2 belong in `BACKLOG M38` beside the self-checks already asked for there,
   with the mutant md5s, so the next person does not have to rebuild them.
8. A `PM*app-v91*` sign-off still does not exist. Not mine to write.

## What I did NOT check

- **Everything passes 1 and 2 established**, by instruction: the palette's correctness, 309/0/4.71
  and 309/56/2.1, the collapsed-colour sweep, the 63 enumerated backdrops, the gradient ΔE
  arithmetic, Rule 0, the Voice, the frozen clock, LOW-7's `rgba()` debt, `NOTICE_TONES.info`. The
  md5s are identical; their findings stand unexamined by me and should be read as current.
- **One width only (390) for contrast**, as passes 1 and 2. The Designer captures cover 320/360/390
  for four screens; the contrast gate does not.
- **The screens outside the scan's eight** — Settings, Calendar, Help, the med editor, Upgrade,
  What's New, Setup, Bowel, Appetite, Radiation, the symptom reports, every modal and every toast.
  The Enhancer raises this as E1 and it is unchanged by this commit.
- **Interaction states.** No `:hover`, `:focus`, `:active`, `:disabled`, by me or by the scan.
  Rule 5.5's question is still open for contrast; the Enhancer raises it as E2.
- **No real device, no iPhone, no Safari.** Chromium only in this sandbox. Colour management, P3 and
  sub-pixel rendering are exempt here, stated rather than skipped.
- **The published app-v89 baseline** — still unscanned, as passes 1 and 2 left it.
- **`BACKLOG M36`'s `88×7` figure at maximum scroll.** I measured the scroll-0 overlap instead,
  which is a different and larger one.
- **I did not edit `index.html` or `sw.js`.** Every mutant was a byte copy outside the repo,
  md5-verified on disk and against what the server returned, each on its own port. I started
  8931–8937 and killed only those; the pre-existing 8899, 8901 and 8921 were left alone. The
  `*-GATEFIXTURE.md` stand-ins that let the gate reach its suite loop exist only in a throwaway
  clone under my scratch directory and are not in this repo.
- **I did not touch `care-tracker`** in any way — not a read, not a scan, not a clone. Rule 0.0.
- **I did not write the PM sign-off**, the Enhancer pass or the Design pass, and have no authority
  to. **I did not push to `main`.**
