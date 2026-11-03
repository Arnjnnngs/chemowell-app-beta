# AUDIT — app-v91, DELTA PASS (Zero Day Auditor, second pass)

AUDITED-COMMIT: 56558c532c168ffc103946919b36bbfdbc35770e
VERDICT: DO NOT SHIP

**Audited sha `56558c532c168ffc103946919b36bbfdbc35770e`** (branch `claude/caretracker-team-review-i83ik2`),
`index.html` md5 `165a7a70dd4cc8547cbb4178901e0996` — verified identical to the sha pass 1 audited —
`sw.js` md5 `a1e86136b8f7c676d24e17d3f5d1f19c`, unchanged. This pass covers `56558c5` only: the
BLOCK-1/BLOCK-2 repair. The app bytes have not moved, so nothing pass 1 established about the
palette was re-spent.

**Not because the repair is wrong. It is largely right, and the BLOCK-2 half is the strongest thing
in this release.** The release fails on three artefacts that do not exist and one hole in the gate
it is about, which I was able to walk through with a byte copy.

---

## What I confirmed, so nobody pays for it again

| claim | reproduced? | evidence |
|---|---|---|
| app-v91 shipped: 309 distinct, 0 below AA, worst 4.71:1 | **yes, exactly** | committed scan, unmodified, port 8899, md5 `165a7a70` verified as served |
| app-v90 pre-palette: 309 distinct, 56 below AA, worst 2.1:1 | **yes, exactly** | same scan, port 8901, md5 `fe3328de` verified as served |
| skip denominator `374 {hidden:18, offscreen:291, covered:65}` | **yes, byte-identical on both builds** | as above |
| BLOCK-1: the scan now runs against the shipped file | **yes**, exit 0 | the committed file, no edits |
| BLOCK-1 is version-agnostic | **yes, mechanically** | `grep -n "app-v[0-9]" test/contrast-scan.mjs` → two hits, **both in comments**; no literal in code |
| BLOCK-2: the scan runs inside `release_check.sh` | **yes** | `ℹ️  contrast-scan.mjs: green.`, against the gate's own export on :8897, md5 `165a7a70` verified by the gate |
| BLOCK-2: it can FAIL there | **yes** | one literal reverted → `❌ RELEASE CHECK FAILED: test/contrast-scan.mjs`, gate exit 1 |
| MEDIUM-4's fix is real | **yes** | pass 1's single-literal mutant reported **18** failures as samples; deduplicated it reports **8** — one per screen, 8 screens. Correct. |
| HIGH-3: M37 closed, `care-tracker` not queued | **yes** | BACKLOG M37 now reads *"CLOSED. Do not scan it. Do not open it."* |
| Rule 0 clean | **yes** | `No-other-patient check: clean.` inside my own gate run |

**The 295-vs-309 disagreement is resolved, and both numbers were right about different things.**
Pass 1 de-duplicated by text per screen and got 295. The committed key is
`text + tag + color + fontSize + fontWeight`, which **splits 14 strings that are rendered twice on
the same screen in different ink, size or weight.** I enumerated all fourteen. Examples: Home's
`Weight` as a 12px/700 `#6A4433` label and a 15px/500 `#2A2127` heading; Temperature's `98.6` three
times (12px SVG `#5C4E52`, 13px SVG `#AE5833`, 18px div `#AE5833`); `Reports` as a 24px/800 `h1` and
an 11px/700 breadcrumb. **309 is the better figure for this gate** — those are fourteen separate
pieces of ink that can independently fail AA, and collapsing them would hide a failure. Neither
measurement was wrong; 295 answers "how many different words", 309 answers "how many things can
fail", and a contrast gate needs the second.

One caveat on the word, for the record rather than as a defect: 309 is string-renderings **summed
per screen**. Globally distinct it is 211 by the same key, 175 by text alone — the app chrome
(`ChemoWell`, `Reports`, `Today`) is counted once per screen. That is correct for this gate, because
each screen's instance sits on a different part of the gradient and genuinely needs its own
measurement, and the per-screen breakdown is printed. Worth knowing before anyone quotes 309 as
"the number of strings in the app".

**Pass 1's coverage finding is confirmed independently and exactly.** I instrumented every one of
the six skip branches to record the TEXT it dropped, then computed, per screen, the strings never
measured on any pass: **295 measured / 12 never measured = 96.1%**, and 8 of the 12 are the single
source-code comment `// ---------- On-device storage — no cloud, no a…` leaking into the text
walker once per screen (correctly skipped as hidden). The genuinely unmeasured UI strings are the
same **four** pass 1 named: Home's `Male`, `Female`, `Treatment type`, and History's `68.5 lbs`.
Two careful measurements by different methods now agree.

---

## DELTA-1 — HIGH — An opaque overlay with `pointer-events:none` is INVISIBLE to the scan. It measures text through it and prints PASS.

**This is the one finding that would stop the release on its merits.** The brief asked whether the
scan can still reach `collect()` with a scrim up by some other route. It can, and the coverage guard
does not notice.

`collect()` decides whether a word is visible with `document.elementFromPoint`. **`elementFromPoint`
ignores any element with `pointer-events: none`.** So an overlay that is painted over the text but
not hit-testable is, to this scan, not there at all: the sample points are kept, the text is
"measured", and the backdrop it is measured against is **the overlay's own pixels**, because the
backdrop comes from the screenshot, which does show the overlay.

**Falsified with a matched pair of byte copies, each md5-verified on disk and as served, each on its
own port.** Both add the same thing the scan's own new comment predicts — *"Add a sticky header
tomorrow and the labels under it leave the count silently while the scan still prints PASS"* — a
fixed opaque white bar, 390×140, `z-index: 99999`, over the top of the viewport.

| mutant | md5 | difference | scan result |
|---|---|---|---|
| **M-STICKY** — bar with `pointer-events:none` | `957b8cc655ffa780cadfab1ff879989c` | one `<div>` | **309 measured, 565 samples, 374 skipped `{hidden:18, offscreen:291, covered:65}`, 0 below AA, PASS on all 8, exit 0** — byte-identical to a clean build |
| **M-STICKY-HITTEST** — same bar, hit-testable | `eb6a488ad98ad9d7ee0b10fa6fb7f54f` | the same `<div>` minus `pointer-events:none` | **261 measured, 457 samples, 482 skipped `{… covered:173}`, 0 below AA, PASS on all 8, exit 0** |

The pair separates the two failures cleanly:

1. **With `pointer-events:none` the denominator does not move by a single count.** I verified the bar
   really renders (`#mutant-sticky`, 390×140 at top, `z-index 99999`, parent `BODY`) and that
   `elementFromPoint(195, 70)` returns the app's content div underneath it rather than the bar. Then
   I compared measured backdrops directly, clean build against mutant, for every Home string inside
   the covered band. **Six strings are measured against the bar's own white:**

   | Home string, hidden behind an opaque bar | ink | backdrop CLEAN | backdrop WITH bar |
   |---|---|---|---|
   | `Alex's Meds` | `#2A2127` | `#FDDCCE` | **`#FFFFFF`** |
   | `ChemoWell` | `#A83D0F` | `#FDDCCE` | **`#FFFFFF`** |
   | `Tuesday, Nov 3` | `#5C4E52` | `#FDDCCE` | **`#FFFFFF`** |
   | `BETA` | `#8C5900` | `#FFF3E2` | **`#FFFFFF`** |
   | `Beta date controls` | `#8C5900` | `#FFF8EE` | **`#FFFFFF`** |
   | `▼` | `#8C5900` | `#FFF8EE` | **`#FFFFFF`** |

   Six strings a user cannot see at all were reported as measured and passing, and the only number
   that could have revealed it — the skip denominator this release added — read exactly as it reads
   on a clean build. **That is a silent false green in the gate this release exists to install.**
   It is also, precisely, the defect the file's own header comment says the covered-check prevents:
   *"the number would be the contrast of a word against a button sitting on top of it, which is not
   a number about anything."* The check does that for hit-testable overlays only.

2. **For an ordinary overlay the denominator DOES move, and that part of MEDIUM-5 works** — 48
   strings leave the count and `covered` rises 65 → 173. But **the scan still exits 0 and prints
   PASS on every screen.** Nothing ratchets the denominator, and `release_check.sh` reads only the
   exit code, so a sticky header that hides 48 strings passes the gate green. The denominator is
   information for a human comparing two runs; it is not a guard.

**And this is not hypothetical in this app.** `pointer-events: none` appears 8 times in
`index.html`, and one of them is a full-viewport scrim: `#tour-layer` is `position: fixed; inset: 0`
with `pointerEvents: 'none'` (index.html:5319, 5348) and `#tour-scrim` is `inset: 0`,
`background: rgba(34,14,6,0.28)`, also `pointerEvents: 'none'` (5349). The app's own comment at
line 1935 calls the layer *"deliberately `pointer-events: none`"*. I ran the scan against the
unmodified shipped app with one value changed in the **fixture** — `tourDone: false`, so the guided
tour is left open — and the result is unambiguous:

    260 DISTINCT strings measured (478 samples), 184 below AA, worst 1.38:1
    skipped while collecting: 453  {"hidden":17,...,"offscreen":239,"covered":197}
    2.64:1  #A83D0F on #BFA296   "ChemoWell"
    2.99:1  #6D5247 on #BFA296   "Home"  /  "Meds"  /  "Reports"  /  "Symptoms"

`#BFA296`, `#BBAAA3`, `#C1B3A5`, `#C1B7AD`, `#BFB9B7` — **none of those colours exists anywhere in
this app's palette.** 184 phantom failures, precise, repeatable and about nothing: the SVG-`fill`
incident this file's own header comment was written about, at nine times the scale. It fails loudly
rather than greenly, which is the saving grace, but the only thing standing between this gate and
either outcome is one boolean in the fixture that nothing pins — the same class of fragile fixture
coupling as the `'app-v90'` literal that caused BLOCK-1 in the first place.

**The fix is one line, it is class-wide, and the app already exports it.** `anyOverlayOpen()` exists
specifically because *"whether something covers the screen is a fact about the screen, so it is read
off the screen"* (index.html:1920), after an earlier version of the scroll lock trusted hand-written
flags and **ten of twenty-three were wrong.** It is exported as
`window.__backTest.overlayNow()`. Asserting it is `false` before each `collect()` closes What's New,
the tour, the drawer, the upgrade sheet, the med editor and every overlay added in future **at
once**, instead of one `data-` hook per overlay. I used exactly that call as my independent probe:
`overlayNow=false`, `scrollLocked=false`, zero full-viewport layers, at all 20 scroll positions the
scan visits on all 8 screens of the shipped build — so the current figures are confirmed clean, and
the assertion would be green today.

This is Rule 5.5's own instruction — *write the case for the whole class, not the one instance* —
and the scan currently carries a one-instance guard. M38 already asks for *"every sampled backdrop
colour should occur in the app's palette"*, which would catch the tour scrim; it would **not** catch
the opaque white bar, because white is in the palette. The overlay assertion catches both.

## DELTA-2 — MEDIUM — The exit-3 refusal is sound, but it is DORMANT on this build, and the record says it is the operative mechanism.

The commit message and the README row both say the repair works because *"the modal is dismissed by
its own hook, and the scan REFUSES with exit 3 if it is still open afterwards."* **On this build the
modal is never dismissed by the scan, because it is already gone before the scan looks.**

Measured, at 150ms intervals from `load`:

    +  175ms  {"modal":true, "closeBtn":true,  "marker":"app-v91", "loaded":true}
      [nav] ...  [nav] ...        <- two service-worker driven reloads
    +  332ms  {"modal":false,"closeBtn":false, "marker":"app-v91", "loaded":true}
    ... false for every sample through +3718ms

With no marker seeded, `whatsNewShouldShow()` (index.html:9452) takes its `if (!seen)` branch,
**stamps the marker to `APP_VERSION` immediately**, and returns `prior`. The notice renders. The
service worker then activates, `controllerchange` fires and the page reloads — the behaviour
index.html:213 documents in those words — and on the second evaluation `seen === APP_VERSION`, so
the modal does not re-open. By the scan's `waitForTimeout(2200)` the modal has been gone for about
1.9 seconds. `page.$('[data-whatsnew-close="true"]')` returns null, the click never happens, and the
refusal checks for an element that was removed by the app.

**The guard is not decoration — I proved it fires.** Two byte copies, each md5-verified on disk and
as served, each on its own port, that force the notice to persist (`whatsNewShouldShow()` → `true`)
and then break dismissal two different ways:

| mutant | md5 | what it breaks | result |
|---|---|---|---|
| **M-STUCK-NOHOOK** | `86b2f5556421a44407ed16a58bcbd40e` | the `data-whatsnew-close` hook is removed (a rename) | **exit 3**, `REFUSING: the What's New modal is still open` — **KILLED** |
| **M-STUCK-DEAFCLOSE** | `1f9623c33807e0564f299f4259f1d24f` | the hook stays, `close` is a no-op (the click does nothing) | **exit 3**, same refusal — **KILLED** |
| **M-STUCK-DISMISSABLE** (positive control) | `b3baa474bf636297437dbc32e32675cb` | notice persists, dismissal works | scan dismisses it and measures: **309 / 0 below AA / worst 4.71:1**, identical to the shipped-file run — so the dismissal path works, and the figures are not contaminated by a scrim either way |

So: the coupling did **not** just move. It moved from a version literal that failed **silently** to
two `data-` hooks that fail **loudly** — which is the right trade and is Rule 5-compliant (explicit
`data-` hooks, not text selectors). The dismissal silently no-opping when there is no modal is also
correct: a scan that demanded a modal would break on the next build that stops showing one.

**What is wrong is the account, not the code.** Three records state a mechanism that is not the one
operating, and the next person to touch the service worker or the marker-stamping path will have no
idea the dismissal is dormant. The honest sentence is: *nothing is seeded, so the app's own
first-run path stamps the marker and closes the notice itself; the dismissal and the exit-3 refusal
are a guard for the case where it does not.* Also worth pinning: the modal's visibility depends on a
reload race with no barrier behind it. Both outcomes are safe (proved by the positive control
above), and the run is stable in practice — my three independent runs and the builder's all give
309/565/374 — but the 2200ms is load-bearing and undocumented.

## DELTA-3 — MEDIUM — MEDIUM-4 survives in the first sentence of the README row, which now contradicts itself.

The row was corrected in most places and `TEAM.md:768` is now right (*"56 of 309 strings… (First
written as '102 of 565'. Those were SAMPLES, not strings)"*). But the row's opening sentence —
the one sentence a reader actually reads — still says:

> *"He is right, and it was never one screen — it was **102 strings** across eight."*

and nine lines later the same row says `before: 309 distinct strings, **56** below WCAG AA`. **One
row, two different failure counts, both called strings.** That is MEDIUM-4 exactly, in the place it
does the most damage, and by this release's own standard (*"the ratios were right; the word was
wrong, in four places in the record"*) it is not yet fixed. One-word fix: `102 samples`, or better,
`56 strings`.

## DELTA-4 — LOW — The de-duplication key reads `cs.color` for SVG text, where `fill` is the ink.

Four lines below the comment block that exists because *"SVG TEXT IS PAINTED WITH `fill`, NOT
`color`, AND THE FIRST VERSION OF THIS FILE FORGOT IT"*, the new key is built from `cs.color`
(index.html… `test/contrast-scan.mjs:188`) while the measurement correctly uses `paint`. For all 42
SVG rows collected, the key records `rgb(42, 33, 39)` — inherited and meaningless — while the
measured ink is `rgb(92, 78, 82)`.

**Zero collisions today**, measured: no key on any screen maps to two different inks. And it
**cannot produce a false PASS**, because the dedup keeps the WORST ratio per key, so a failing row
always survives. What a collision would cost is one count off the total and, if both collided rows
failed, one detail line. One-character class of fix: use `paint` in the key.

## DELTA-5 — LOW — `skipped while collecting: 374` reads as a coverage figure in the output, where the caveat is not.

The source comments are careful and say twice that `offscreen` is *"not a coverage figure on its
own"*. The printed line carries none of that. A reader sees `309 DISTINCT strings measured` beside
`skipped while collecting: 374` and will reasonably conclude that over half the app went unmeasured.
The truth, measured above, is **12 strings never measured anywhere, 4 of them real UI, 96.1%
coverage**. The printed number overstates the unmeasured surface by roughly 30×. Same shape as
MEDIUM-4: arithmetically correct, false impression, and the fix is a word —
`374 collections dropped (mostly re-seen on a later pass)`, or print the never-measured count, which
the scan already has the data to compute.

## GATE-1 — HIGH — `release_check.sh` cannot pass: THREE chain artefacts are missing, and the gate reveals them one at a time.

Pass 1 reported the gate failing for a missing PM sign-off. **It is three files, not one**, and the
gate's `stopped_early` means the output only ever names the first:

| required by the gate | exists? |
|---|---|
| `outputs/AUDIT*app-v91*` | yes — pass 1, now readable (below), and it says **DO NOT SHIP** |
| `outputs/PM*app-v91*` | **missing** |
| `outputs/ENHANCER*app-v91*` | **missing** |
| `outputs/DESIGN*app-v91*` | **missing** |

For comparison, app-v90 has all five (`AUDIT`, `DESIGN`, `DEV-BRIEF`, `ENHANCER`, `PM`). The
design-time check (`release_check.sh:543`) fires only when `index.html` itself moved, which it did,
and its own text is the answer to any objection: *"An Enhancer pass that found nothing is written
down as 'nothing this time' and still counts. Silence does not — that is the failure this gate
exists for."* I have no authority to write any of the three.

**I verified the rest of the gate is otherwise green.** In a throwaway clone, with clearly-labelled
`*-GATEFIXTURE.md` stand-ins for the three missing artefacts (never written to this repo), the full
gate ran to `✅ Release check passed.` and exit 0 on the clean tree, with every suite green
including `contrast-scan.mjs`. So the only things between this release and a green gate are the
three artefacts and whatever DELTA-1 is worth.

---

## Housekeeping I did, and why

**I added the two-line header to `outputs/AUDIT-app-v91.md`** — nothing else in that file is
touched, and the diff is three inserted lines:

    AUDITED-COMMIT: 2a6e89ab7767e85423a1842839763af42f0f9f72
    VERDICT: DO NOT SHIP

Transcribed from that report's own words: its stated sha, and its stated verdict, which was a
refusal (`# VERDICT: DO NOT SHIP`, line 6 as it stood). **This was not cosmetic.** Without the
header the gate classed the report as UNREADABLE and said so — *"a chain report exists that this
gate cannot read… a report the gate cannot read is not a report that raises no objection"* — and in
the clone test that single unreadable file was the one thing stopping the gate, so the newly wired
contrast scan could not be reached at all. With the header in place the gate now names the refusal
in its output: `ℹ️  Other reports present and not clearing this release: outputs/AUDIT-app-v91.md —
says DO NOT SHIP`. **A refusal that the gate cannot read is a refusal that does not exist**, which
is the failure `release_check.sh:655` was written about. This report carries the header for the same
reason.

---

## What must happen before this ships

1. **DELTA-1** — assert `window.__backTest.overlayNow() === false` before each `collect()`, and
   refuse if it is not. One line, class-wide, uses an export that already exists. Then re-run and
   re-state the figures (they will not change — I measured `overlayNow=false` at all 20 positions).
2. **GATE-1** — an `ENHANCER*app-v91*`, a `DESIGN*app-v91*` and a `PM*app-v91*` must exist. Not mine.
3. **DELTA-2** — correct the three records to say what actually dismisses the notice, and note the
   2200ms is load-bearing.
4. **DELTA-3** — fix `102 strings` in the README row's first sentence.
5. DELTA-4 and DELTA-5 are backlog, not blockers. DELTA-1's assertion belongs in M38 beside the two
   self-checks already asked for there.

## What I did NOT check

- **Everything pass 1 established about the palette**, by instruction: the collapsed-colour sweep,
  the 63 enumerated backdrops, the gradient/ΔE arithmetic, the Voice, the frozen clock, the
  `rgba()` migration debt (LOW-7), `NOTICE_TONES.info` (LOW-8). The bytes are identical; its
  findings stand unexamined by me and should be read as current.
- **One width only (390)**, as pass 1. Nothing at 320 or 360.
- **The screens pass 1 lists under MEDIUM-6** — Settings, Calendar, Help, the med editor, Upgrade,
  What's New, Setup, Bowel, Appetite, Radiation, Symptom reports, every modal, every toast. The
  gate's scope is unchanged by this commit.
- **Interaction states** — no `:hover`, `:focus`, `:active`, `:disabled` or pressed state, by me or
  by the scan. Rule 5.5's question is still unanswered for contrast.
- **No real device, no iPhone.** Chromium only in this sandbox. Colour management, P3 and sub-pixel
  rendering on a real phone are exempt here, stated rather than skipped.
- **The published app-v89 baseline** — still unscanned, as pass 1 left it.
- **I did not write the PM sign-off, the Enhancer pass or the Design pass**, and have no authority
  to. The `*-GATEFIXTURE.md` files that let me test the suite loop exist only in a throwaway clone
  under my scratch directory and are not in this repo.
- **I did not edit `index.html` or `sw.js`.** Every mutant was a byte copy outside the repo,
  md5-verified on disk and against what the server returned, each on its own port; I killed only
  the ports I started (8911–8915) and left the pre-existing 8899 and 8901 up.
- **I did not touch `care-tracker`** in any way — not a read, not a scan, not a clone. Its freeze is
  recorded in this repo's own Rule 0.0 and in BACKLOG M37, both of which I read here.
- **I did not push to `main`** and have no authority to.
