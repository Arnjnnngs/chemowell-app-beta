# AUDIT — app-v91 (Zero Day Auditor)

**Audited sha: `2a6e89ab7767e85423a1842839763af42f0f9f72`** (branch `claude/caretracker-team-review-i83ik2`),
`index.html` md5 `165a7a70dd4cc8547cbb4178901e0996`, `sw.js` CACHE `chemowell-app-v91-1`.
Covers `11078f2` (palette + scan), `d358d86` (record), `74f3abd` (frozen clock), `2a6e89a` (gradient repair).

# VERDICT: DO NOT SHIP

**Not because the palette is wrong — it is right, and I could not break it.** Both headline numbers
reproduce exactly, and three independent mutants all die. The release fails on its other half.

**`test/contrast-scan.mjs`, run verbatim as committed against the build it is supposed to gate,
throws before it measures a single string.** `node test/contrast-scan.mjs` exits **1** with
**zero** strings measured. A contrast release whose contrast gate cannot run is the `|| true`
shape this project has already paid for, and nothing in the repo would have caught it because
nothing in the repo runs the gate at all.

The fix is one line in a fixture. The release should go out once BLOCK-1 and BLOCK-2 are closed.

---

## BLOCK-1 — HIGH — The new gate does not run against app-v91. It crashes.

    $ node test/contrast-scan.mjs --base http://127.0.0.1:8899/index.html
    page.click: Timeout 30000ms exceeded.
      waiting for locator('[data-tour="nav-home"]')
      <button data-whatsnew-all="true">See recent updates</button> from
      <div data-whatsnew-modal="true"> subtree intercepts pointer events
    NODE EXIT CODE = 1        # "strings measured" appears 0 times in the output

**Cause.** The seed's last line pins a version literal:

    localStorage.setItem('chemowell-app-seen-version', 'app-v90');

`WHATS_NEW_KEY` is `'chemowell-app-seen-version'` (index.html:9395) and `APP_VERSION` is now
`'app-v91'`. seen ≠ current, so the What's New modal opens on load, and the scan's first action —
`goNav('home')` — is swallowed by its scrim. It never reaches `collect()`.

**This is Rule 5 verbatim: "Never pin version literals ('v43.3') in patches or suites."** The scan
was authored while `APP_VERSION` was `app-v90`, where that literal happened to suppress the modal.
The bump in the same commit (`11078f2` changes both) broke it. Proof the breakage is version-keyed
and not environmental: the identical unmodified scan runs to completion against the pre-palette
build (`11078f2^`, APP_VERSION `app-v90`) on port 8901 and prints `565 strings measured, 102 below
AA`. Same bytes of test code, same machine, same minute.

**Consequence for the record.** The commit message, the README row, TEAM.md and BACKLOG M37 all
quote `after: 565 / 0 below AA / worst 4.71:1`. Those figures are **correct** — I reproduced them —
but they cannot have been produced by the committed scan against the committed app. They were
measured on a build carrying the palette with `APP_VERSION` still at `app-v90`, i.e. not the
shipped file. Rule 7's own lesson, in this repo's words: *verified once is not verified; the file
just moved.*

**Fix (one line, version-agnostic — do not substitute `'app-v91'`, that only moves the bug):**

    await page.waitForTimeout(2200);
    { const c = await page.$('[data-whatsnew-close="true"]');
      if (c) { await c.click(); await page.waitForTimeout(600); } }

I verified this exact repair: it makes the committed scan run clean on app-v91 and it is what every
figure below was measured with.

## BLOCK-2 — HIGH — The gate is wired into nothing.

`contrast-scan.mjs` appears in **no runner**:

    $ grep -oE "test/[a-z0-9.-]+\.mjs" release_check.sh | sort -u
    test/v75-no-other-patient.mjs   test/v76-empty-window-render.mjs
    test/v76-properties-equivalence.mjs   test/v84-whatsnew.mjs   test/v89-everything-free.mjs
    $ grep -n contrast release_check.sh     # (no output)

TEAM.md, added by this very release: *"`test/contrast-scan.mjs` is the gate for it. Treat it as the
sixth question."* It is asserted as a gate and enforced by nobody. This repo already decided this
question — Hard Rule 6: *"This is now mechanical, not a promise… A rule enforced only by the person
it constrains is the one that gets skipped at the end of a long day."* `v75-no-other-patient.mjs`
is in `release_check.sh` precisely so *"a release cannot skip it."* This one must be too.

Taken together BLOCK-1 and BLOCK-2 are one failure: the only reason a gate that cannot run went
unnoticed is that nothing ever runs it.

## HIGH-3 — This release queues work against an app that is frozen.

`d358d86` adds **BACKLOG M37**: *"`care-tracker` and `chemowell-beta` … the scanner is
theme-agnostic, so it runs against either app unchanged except for the navigation hooks and the
seed. Order: **scan both**, report the numbers."*

`care-tracker/CLAUDE.md` now opens with: *"⛔ THIS APP IS CLOSED. DO NOT CHANGE IT. **DO NOT RUN
ANYTHING AGAINST IT.** … Brandi passed away on 18 September 2026"*, and this repo's own new Rule
0.0 says items of the form *"the same defect exists in `care-tracker`, port it back"* are **closed,
not queued.** M37 is that item, written as a work order, in the release now being shipped. A future
session reading the backlog in order would drive a browser suite against a dead patient's app.

M37 must be rewritten to close the `care-tracker` half outright. The `chemowell-beta` half is
`care-tracker`'s staging copy, so whether it has any purpose left is **Aaron's call, not mine** —
flag it, do not assume.

## MEDIUM-4 — "565 strings" and "102 below AA" are counts of SAMPLES, not strings.

The scan re-collects at every scroll position and increments `measured` per row, and `seen` is a
fresh `Set` inside each `page.evaluate`. A string visible in the 144px overlap between passes
(viewport 844, step 700) is counted again each time.

Measured by me on the audited sha, text identity per screen:

| | |
|---|---|
| reported by the scan | **565** "strings measured" |
| distinct strings actually measured | **295** |
| inflation | **1.9×** |

The single-literal mutant below makes it unarguable: **one** colour literal on **one** line
produced **18** reported failures, all of them the same string, `"Tuesday, Nov 3"`. By the same
arithmetic `102 below AA` in the before-run is ~50–60 distinct strings, and its own output shows
the duplicates (`"Overnight"` ×2, `"Quick log"` ×2, `"Today"` ×2, `"4 logged"` ×2).

The numbers are not wrong, but the **word** is: they are quoted as strings in the commit message,
the README row, the TEAM.md section and BACKLOG M37. Either de-duplicate before counting, or
rename the figure to "samples". This is the Voice's question 3 one level up — arithmetically
correct and still a false impression.

## MEDIUM-5 — The scan reports no denominator. "0 below AA" cannot be distinguished from "didn't look."

Seven `continue` branches drop a text-bearing element with **no record in the output**: hidden /
`display:none` / `opacity < 0.95`, box under 2px, any box crossing a viewport edge, unparseable
paint, text alpha < 0.95, and every sample point covered. Instrumented counts on this sha:
`fully_covered` **65**, `hidden_display_opacity` **18**, `partial_points_lost` **12** (measured on
fewer than 6 points), plus the viewport drops.

**I must be straight that coverage today is good**, and my first framing of this was wrong: most
viewport drops are simply below-the-fold elements picked up on a later pass. Measuring "was this
string measured anywhere on this screen" gives **295 measured / 12 never measured = 96.1%**, and 8
of those 12 are one source-code comment leaking into the text walker in a single-file app
(correctly skipped as hidden). The genuinely unmeasured UI strings are **four**: Home's `"Male"`,
`"Female"`, `"Treatment type"` (all `fully_covered`), and History's `"68.5 lbs"` (edge straddle).

The defect is not today's coverage, it is that **the output contains nothing from which today's
coverage could be known.** Put a sticky header over a column of labels and those labels leave the
count silently while the scan still prints `PASS … all at or above AA`. One line —
`N skipped (M covered, K off-viewport, J hidden)` — closes it. BACKLOG M38 asks for the two sibling
self-checks and should carry this third.

Note the structural edge case while you are in there: with viewport 844 and step 700 the overlap is
144px, so **any element taller than 144px that straddles a seam is dropped at both passes** —
`r.bottom > innerHeight` at the earlier position and `r.top < 0` at the later one. Nothing hits it
on today's screens. A longer paragraph will.

## MEDIUM-6 — Gate scope, and it does not reach two of the five gradients just repaired.

Eight screens at one width (390): Home, Reports menu, History, Weight, Temperature, Meds,
Symptoms, In-Patient. **Not measured at all:** Settings, Profile, Calendar/Appointments,
Help/Search, the medication editor, the Upgrade modal, the What's New modal, Setup/onboarding,
Bowel, Appetite, Radiation and Symptom reports, every other modal, every toast, and widths 320 and
360 (the Designer seat's own sizes).

Two of the five flattened gradients `2a6e89a` repaired — `renderSetup`'s "Get started"
(index.html:5076) and `renderUpgradeModal`'s buy button (5142) — are on screens the gate never
visits. They were found by grepping the file, not by the scan, and the scan could not have found
them.

## LOW-7 — The swap was hex-only; 30 `rgba()` literals still encode retired colours.

| retired hex | `rgba()` form | sites, old build | sites, this build |
|---|---|---|---|
| `#BF4C1A` | `rgba(191,76,26,…)` | 19 | **19 unchanged** |
| `#E46F3C` | `rgba(228,111,60,…)` | 7 | **7 unchanged** |
| `#0A6B4A` | `rgba(10,107,74,…)` | 2 | **2 unchanged** |
| `#7A6E76` | `rgba(122,110,118,…)` | 1 | **1 unchanged** |
| `#915E48` | `rgba(145,94,72,…)` | 1 | **1 unchanged** |

A tint and its solid no longer derive from one colour. Clearest instance, index.html:8890 — the
"Bring back" button: solid `#0B5C40` (new) sitting beside its own tint
`rgba(10,107,74,0.10)` (old). Contrast is unaffected (these are fills, borders and shadows, not
ink) and at 10–14% alpha it is not visible today. It is an incomplete migration that will mislead
the next person who greps for the palette.

## LOW-8 — One tone lost an internal distinction.

`NOTICE_TONES` (index.html:3821). `info` was `accent: '#BF4C1A'`, `chipFg: '#A83D0F'` — two
different colours. Both are now `#A83D0F`. `attention` and `urgent` still keep accent ≠ chipFg, so
`info` is now the odd one out. Cosmetic: the comment says accent drives the left border and action
buttons while chipFg drives the icon chip, and those are different elements, so nothing becomes
ambiguous. Worth one byte of deepening on the accent for consistency.

## INFO — the placeholder deepening is intended, and it still reads as a placeholder.

The vitals strip (index.html:6531) was `color: t.value ? t.color : '#A2939B'` — a light grey for
"no reading". `#A2939B` was failing at **2.88:1** and had to move; it is now `#5C4E52`. A populated
tile is `#2A2127`, or `#C0453B`/`#9A6419` for temperature — I checked every value `tempColor` can
take, and none is `#5C4E52`. Populated and empty remain distinguishable. Correct consequence, not
a defect.

---

## Figures I measured myself

All three builds served as byte copies on their own ports, md5-verified on disk **and** as served.

| build | md5 of `index.html` | port | result |
|---|---|---|---|
| audited HEAD `2a6e89a` (app-v91) | `165a7a70dd4cc8547cbb4178901e0996` | 8899 | **565 measured, 0 below AA, worst 4.71:1** |
| pre-palette `11078f2^` (app-v90) | `fe3328deb53ea15bacc2abf7749894f4` | 8901 | **565 measured, 102 below AA, worst 2.1:1** |
| published app-v89 (`PUBLISHED.json` → `a5d5908`) | `a9de408cec59efb2bc8b8df44a750cc0` | 8903 | served and md5-verified; not scanned (see "not checked") |

**My figures match the builder's exactly — 565/102/2.1 before, 565/0/4.71 after.** No divergence.
Per-screen before: Home 21/107, Reports menu 7/52, History 24/126, Weight 9/82, Temperature 9/80,
Meds 12/52, Symptoms 10/30, In-Patient 10/36. After: all eight PASS, 0 page errors.

Cross-check that the worst ratio is a real colour and not an artifact: `4.71:1` is exactly white on
`#C25020` by independent arithmetic. It is a 13.5px/700 button label needing 4.5 — **it passes with
0.21 of margin.** Thin, but measured and real.

## Mutants

Every mutant a byte copy in a scratch directory, md5-verified on disk and against what the server
returned, each on its own port, never the repo file. Run with the repaired scan, because the
committed one cannot run (BLOCK-1).

| mutant | md5 | changed | result | verdict |
|---|---|---|---|---|
| **G** — page gradient alone reverted to `#FFA6AE/#FFC18B/#FFE1B8` | `1fdefaef76c41bb0f7d81417ec1e73c8` | 2 lines | **7 below AA, worst 3.51:1** | **KILLED** |
| **INK** — one ink token reverted, `#5C4E52`→`#7A6E76` (118 sites) | `ad21c46231e9f9861b546f1756ba6df8` | 118 sites | **40 below AA, worst 3.44:1** | **KILLED** |
| **INK1** — *one literal on one line* (index.html:4712, the Home date header) | `89fae47673c61cf06a70d81bea34b464` | 1 literal | **18 below AA, worst 3.77:1** | **KILLED** |

The brief asked whether a single-token regression passes. **It does not, and neither does a
single-site one** — the gate bites at the granularity of one colour literal on one line. That is
the strongest thing in this release. Mutant G is also informative: reverting only the gradient
gives 7 failures, not 102, which confirms the commit's own claim that the fix had to be two-sided —
the gradient alone was never the whole defect.

## Attacked and could not break

Recorded so the next pass does not re-spend the time.

- **"Is the scan measuring anything?" — yes.** I photographed each viewport twice, once with text
  visible and once hidden, and enumerated every distinct sampled backdrop: **63 colours, and every
  one is legitimate** — card white, a gradient interpolation (`#FDDCCE`, `#FCDAC9`, `#FDE3CB`…), or
  a known chip/button fill (`#533528`, `#8C5900`, `#9A6419`, `#A83D0F`, `#AE5833`, `#BB4B1C`).
  **No impossible colour.** The muddy greys that marked the old SVG defect (`#7D7276`, `#8D8487`)
  do not appear anywhere. The `fill`-not-`color` fix holds and there is no second instance of that
  class: I checked the three other ways text can be painted outside `color` — `-webkit-text-fill-color`
  (**0** uses), `background-clip: text` (**0**), `<canvas>` (**0**). Nothing escapes the hide rule.
- **Is the diff really colour-only?** Proved mechanically. Normalising every `#rrggbb` and every
  `rgba()` to a placeholder in both builds leaves **two** differences in the whole of `index.html`:
  the `APP_VERSION` bump and the new CHANGELOG entry. Nothing moved, no logic, no copy.
- **Did two colours collapse where the difference carried meaning?** This was the coordinator's
  item 1 and the most likely place for a live defect. `#A83D0F` was **not a new colour** — it
  existed at 78 sites before the release, and `#BF4C1A`'s 101 sites were merged onto it, so this is
  a genuine two-colour collapse and I went through every site where both appeared. Eleven lines in
  the old build contained both. Five were the flattened gradients (already repaired). Of the rest:
  the setup chip row (5051) and the severity/weekday chips (5723, 5971, 8424) now use one colour for
  a selected border and selected text, but selected still differs from unselected in border
  **width**, border colour and background; the in-patient toggle (11268) is `#A83D0F` background
  with white text when on versus white background with `#A83D0F` text when off, which is unchanged
  in kind; `NOTICE_TONES.info` is LOW-8 above. **No selected/unselected, active/inactive,
  enabled/disabled or destructive/ordinary pair became indistinguishable.** I also checked the four
  greys merged into `#5C4E52` (`#7A6E76`, `#9A8C94`, `#A2939B`, `#6B5F66`) — no line and no sibling
  branch ever held two of them, so nothing was ever being told apart by that difference.
- **Charts.** The threshold rules and series colours are `colourFor()` → `#C0453B` / `#9A6419` /
  `#AE5833` and the gridlines are untouched rgba — none of those literals is in the swap, so no
  series collapsed onto its own gridline or threshold line, and the Temperature and Weight reports
  both scan clean.
- **Rule 0.** `test/v75-no-other-patient.mjs` — **29/29 PASS**, every ratchet intact and none slack:
  0/0/0 id-keyed sites pinned at 0/0/0, pronouns 32 against a ratchet of 32, rule table 9 of at most
  14. Nothing in this diff reintroduces a name, a pronoun, a dose or id-keyed behaviour. A palette
  change could hardly do so, and it does not.
- **The Voice.** Title `Easier to read` — 3 words (needs 3–6). Two bullets (needs 2–4). **51 words**
  (target under ~70). No mechanism, no function name, no version, no seat. And the claim
  *"Nothing moved and nothing changed what it says — only the colours"* is **true**, by the
  normalisation proof above — it is one of the few changelog lines in this repo's history that can
  be mechanically verified. `colours` is British, and that is house style here, not a slip
  (`behaviour` ×17, `centre` ×9, `grey` ×15, and a `const colour` in the app's own source).

## The frozen clock (`74f3abd`)

**Verified 162/162 myself in three timezones**, including the window the brief named:

| TZ | local time at run | result |
|---|---|---|
| `UTC` | 04:27 | **162 checks: 162 passed, 0 failed** |
| `Atlantic/Azores` | **03:27 — inside the 03:00–04:00 window that used to fail** | **162 passed, 0 failed** |
| `Pacific/Kiritimati` | 18:27 | **162 passed, 0 failed** |

The shim is sound on the details I could break it on: `new Date()` → FROZEN, `new Date(x)` → real,
`Date.now()` → FROZEN, `parse`/`UTC` forwarded, `D.prototype = R.prototype` so `instanceof` still
holds. Called without `new`, `Date()` returns an object where real JS returns a string — and the app
has **no bare `Date()` call** (all three non-`new` hits are `new Date()` on inspection), so that
incompatibility is unreachable. The init script is added before the seed, so the seed's own
`Date.now()` is frozen too and the fixture stays internally consistent.

**What the freeze costs, plainly.** It is the right change and it is also a blind spot, and the
commit does not say so. This suite's clock-sensitivity was being found *by* the varying clock —
that is the whole v1 → v2 → v3 history in the commit message. Freezing at 14:00 removes the only
mechanism that was finding it. Concretely: after this change **nothing in the repo renders a chart
whose span is "midnight → now, three hours wide"** — the `ago(4)` clamp branch that the fixture
tripped over is now exercised by no test at any hour. The commit's conclusion *"the app is right;
the fixture is not"* is well supported — the pre-palette build fails the identical 8 checks at the
identical local hour, so the failure tracks the hour and not the build — but it was established by
reasoning from one symptom, not pinned by a case.

The remedy is cheap and does not undo the freeze: keep 14:00 as the default and add two more frozen
instants, **03:30** and **00:30**, as deliberate cases. That turns an accidental flaky probe into a
deterministic deliberate one and tests the clamp on purpose. **Without it the release trades a
flaky test for an untested branch** — a net improvement, but not the free one the commit implies.
Logging it is enough; it does not block.

## Judging the gradient repair (`2a6e89a`) adversarially

The coordinator asked whether `#8F3410` holds up or is a difference talked into. **It holds, and
the arithmetic is not close.**

| pair | ΔL* | ΔE76 | stop-to-stop contrast |
|---|---|---|---|
| original deep gradient `#BF4C1A → #A83D0F` | 6.66 | 7.43 | 1.277 |
| **new deep gradient `#A83D0F → #8F3410`** | **6.06** | **10.65** | **1.252** |
| standard button `#C25020 → #A83D0F` | 7.92 | 8.15 | 1.336 |
| flattened, as in `74f3abd` | 0.00 | 0.00 | 1.000 |

The restored gradient is a **larger** colour difference than the one it replaces (ΔE76 10.65 vs
7.43) at marginally less lightness travel, and ΔE76 10.65 is about 4.6× the ~2.3 just-noticeable
threshold. It is perceptible; it is not a rationalisation.

**And the two button styles do not collapse.** Comparing the mid-tone each gradient averages to:
standard `rgb(181,70,24)` L\*=44.6 against deep `rgb(156,56,16)` L\*=37.7 — ΔE76 **8.60**, ΔL\*
**6.9**, roughly 3.7× JND. The deep button still reads as the deeper one. White on `#8F3410` is
**7.88:1**, which clears AAA, so the repair cannot have cost contrast anywhere.

One thing to note rather than fix: the two gradients now **share an endpoint** — standard ends at
`#A83D0F` and deep starts there. That is structurally identical to the arrangement before this
release, where both met at `#BF4C1A`. Not a regression.

## What I did NOT check

- **The published app-v89 baseline was served and md5-verified on 8903 but not scanned.** Its
  `APP_VERSION` is `app-v89` against a seed marker of `app-v90`, so it hits a variant of BLOCK-1,
  and the pre-palette app-v90 build is the baseline that actually matters for this diff. The v89
  comparison is still open.
- **One width only (390).** Nothing at 320 or 360. The Designer seat's sizes are unmeasured for
  contrast, and a narrower viewport reflows text onto different parts of the gradient.
- **No real device, and no iPhone.** This sandbox is Chromium only. Colour management, P3 and
  sub-pixel rendering on the patient's actual phone are exempt here and always have been — stated,
  not skipped.
- **The screens listed in MEDIUM-6** — Settings, Calendar, Help, the med editor, Upgrade, What's
  New, Setup, Bowel, Appetite, Radiation, Symptom reports, every modal and toast.
- **Interaction states.** Rule 5.5's question: no `:hover`, `:focus`, `:active`, `:disabled` or
  pressed state was measured, by me or by the scan. A focus ring or a disabled control could be
  below AA and every number here would still be green.
- **`pm.py`** — not present in this repo (it is `care-tracker`'s). `release_check.sh` is the
  equivalent and it currently exits **FAILED: "the quality chain has not run for app-v91"**, which
  this report plus a PM sign-off is what clears. **I did not write the PM sign-off and have no
  authority to.**
- I did not push to `main` and have no authority to. I did not touch the `care-tracker` repo in any
  way — not a read of its app, not a scan, nothing beyond `CLAUDE.md` to confirm the freeze.
- I did not edit `index.html` or `sw.js`. Every mutant was a byte copy outside the repo.

## What must happen before this ships

1. **BLOCK-1** — repair the seed version-agnostically and re-run the scan against the shipped file.
   Re-state both headline figures as measured from *that* run.
2. **BLOCK-2** — add `contrast-scan.mjs` to `release_check.sh` so a release cannot skip it.
3. **HIGH-3** — rewrite BACKLOG M37 to close the `care-tracker` half outright; put the
   `chemowell-beta` half to Aaron.
4. **MEDIUM-4** — de-duplicate before counting, or stop calling samples "strings" in all four
   places the figures are quoted.
5. **MEDIUM-5** — print the skip denominator; add it to M38.

Items 6, 7 and 8 and the frozen-clock boundary cases are backlog, not blockers.
