AUDITED-COMMIT: d50e60b2ad5052cdc4e9b96528b48a31621f7551
VERDICT: DO NOT SHIP

# Zero Day Audit — app-v68 remediation (ecebc50..d50e60b)

STATUS: COMPLETE — verdict DO NOT SHIP.

Scope: the single commit d50e60b, claiming to close all five required findings from
outputs/AUDIT_app-v68-delta.md. Files touched: README.md (+19), index.html (+7/-2, CSS only),
release_check.sh (+91/-31), test/overflow-scan.mjs (+111/-30).

## Headline

Four of the five findings are genuinely closed and I proved it by re-running the previous
auditor's own sabotages. But the nav-label fix **introduced a new overflow** in a band of screen
widths the previous CSS covered, and the scan's device list has a hole exactly there; the chain
gate's one-line-stub bypass is **not** fixed and the remediation made it more reliable; and the
correction to the false changelog claim was filed in the wrong place, leaving the false claim
standing where release_check.sh itself reads.

## Suites, run by me at d50e60b (twice, start and end — identical)

    test/v67-chemo-offset.mjs        26/26 PASS   exit 0
    test/v67-inpatient-window.mjs    10/10 PASS   exit 0
    test/v67-medflag-backfill.mjs      4/4 PASS   exit 0
    test/v68-treatment-clamp.mjs     28/28 PASS   exit 0
    test/overflow-scan.mjs           48 combinations, 0 problems, CLEAN, exit 0  (~2 min)

`./release_check.sh` on the real tree exits 1, correctly, for want of a current PM sign-off.

---

# CLAIM-BY-CLAIM

## Claim 1 — the fixture check now reads the fixture. CLOSED.

Re-created the sabotage: `loadMedicationConfig()` returns the empty fallback unconditionally, no
console output. Scan now prints, at all eight widths,
`FIXTURE DID NOT TAKE ... the seeded medication "Dexamethasone" never reached the screen`,
40 combinations unreachable, **exit 1**. It was exit 0 CLEAN before. Real fix.

## Claim 2 — navigation now proves the view changed. CLOSED, but see MAJOR-B.

Re-created the dead-tabs sabotage (`navigateTo` returns early for reports/symptoms/inpatient):
`COULD NOT REACH` x24, **exit 1**. Was exit 0 CLEAN before. Real fix.
The same rule now guards the medication editor: making `renderMedicationEditor` return null gives
`COULD NOT OPEN med-editor` x8, exit 1. Also real.

## Claim 3 — the overflow test measures rendered text with a Range. CLOSED, with holes.

Deleting the `.navlabel` rules gives 6 problems,
`"Symptoms" the wording is wider than the box it sits in by 8px`, **exit 1**. Was CLEAN before.
Grid cells and flex cells both flag correctly (52px and 60px). See MAJOR-C, MAJOR-D, MINOR-E.

## Claim 4 — the chain gate sees untracked files. CLOSED.

I tried to sneak six shapes past it. Blocked: a brand-new untracked `.github/workflows/evil.yml`;
an untracked file in a brand-new subdirectory `sync-backend/newdir/deeper/evil.js`; a renamed
tracked workflow file; a staged-but-uncommitted new workflow file; a renamed `sw.js`. Only the
gitignored case got through — MINOR-J.

## Claim 5 — the gate reads every report and needs one CURRENT per stage. HALF CLOSED. See BLOCKER-1.

Sort-order dependence is genuinely fixed, and a stale report is correctly refused: with the real
files in place the gate names each one and why it is not current. But the substance of the old
MINOR-8 — that the gate never checks the file is a report — is untouched, and is now easier to
exploit.

## Claim 6 — README correction. ACCURATE, FILED IN THE WRONG PLACE. See MAJOR-E.

## Claim 7 — the two-step nav-label media query. INTRODUCES A NEW BUG. See BLOCKER-2.

---

# FINDINGS

## BLOCKER-1 — two three-line stub files still clear the whole chain gate, and now always work

In a scratch clone at d50e60b I created exactly this, and nothing else:

    outputs/AUDIT_app-v68-x.md   ->  "AUDITED-COMMIT: <HEAD sha>"
    outputs/PM_app-v68-x.md      ->  "AUDITED-COMMIT: <HEAD sha>"

`./release_check.sh` printed **"✅ Release check passed."**, exit 0 — while listing the real
audit that says DO NOT SHIP as *"Superseded reports present (history, not blocking)"*.

The previous change made this **more** reliable, not less. Before, only the first report by
filename sort order was read, so a stub had to win the sort. Now ANY current file matching the
glob satisfies its stage, so a stub is guaranteed to work no matter what the real reports say.

Two further ways in, both confirmed live:

- **A stale report that quotes a fresh sha at column 0.** `grep -m1 '^AUDITED-COMMIT:'` takes the
  first such line anywhere in the file. A report that opens by quoting the header of the report it
  is answering, then declares its own older commit, is read against the quoted sha. Built it,
  gate passed, exit 0.
- **A commit that is not an ancestor of HEAD.** I made a side commit on a detached head with no
  rule-5 changes, confirmed `git merge-base --is-ancestor` says NO, put its sha in the report —
  gate passed. The gate only asks "does this sha exist, and do the rule-5 files match the working
  tree". A commit created seconds ago purely to satisfy the gate still works.

And the gate never reads a verdict: a current report whose body is
`VERDICT: DO NOT SHIP. Three blockers.` passes, exit 0.

Minimum fix: require the report to declare a sha that **is an ancestor of HEAD**; require the
first `AUDITED-COMMIT:` line to be within the first few lines of the file; and require a verdict
line the gate can read.

## BLOCKER-2 — the nav-label fix creates a new overflow at 321–345px that the old CSS did not have

The two-step media query drops the 9.5px size only at <=320px. Between 321px and ~345px the label
runs at 11px with letter-spacing alone, and that is not enough.

Measured on the shipping index.html, "Symptoms" rendered text vs its nav cell:

    321px   cell 57.80   text 62.63   SPILLS 4.8px   ("In-Patient" also wraps to two lines)
    325px   cell 58.59   text 62.63   SPILLS 4.0px
    330px   cell 59.59   text 62.63   SPILLS 3.0px
    340px   cell 61.59   text 62.63   SPILLS 1.0px
    346px   cell 62.80   text 62.63   fits by 0.2px
    360px   cell 65.59   text 62.63   fits by 3.0px
    320px   cell 57.59   text 54.08   fits by 3.5px   (9.5px rule applies)

The nav grid gap is 4px, so below ~330px the label crosses into its neighbour's space. The CSS
this replaced (`max-width:360px {font-size:9.5px}`) had 7.5px of slack at 340px — no spill
anywhere in the band.

**The release's own scan agrees with me.** Add a 325px row to its DEVICES list and the shipping
build goes NOT CLEAN, 6 problems, *"the wording is wider than the box it sits in by 4px"*. The
only reason this release is green is that DEVICES jumps 320 -> 360 and never tests between the two
breakpoints the release itself just created. A media query has two edges; the scan tests neither
interior.

Real users are in that band: Android "Display size" / Samsung "Screen zoom" rescales dp, and a
360dp phone one step up reports roughly 324–336dp.

Fix: `max-width:345px` (or 352px) for the size drop rather than 320px, and add a width in the
321–345 range to DEVICES so the band is guarded.

## MAJOR-A — the 360px half of the nav fix is unguarded, and the 0.3px margin it defends is real

Removing only `@media (max-width:360px){.navlabel{letter-spacing:-0.03em;}}` — half of this
release's own fix — leaves the scan **CLEAN at all 8 widths**. Nothing checks it.

On the previous auditor's 0.3px question: it is real, not an artefact. At 360px, 11px, no
letter-spacing, "Symptoms" measures 65.27px in a 65.59px cell — 0.32px of slack. The tightening
converts that to 2.97px. A 0.3px margin is roughly 0.5% of the label; iOS renders San Francisco
with different metrics from the Chromium fallback this was measured in, and a 1% difference eats
it. **The letter-spacing change is the right call.** It just is not tested, and it is the half
that covers the most common phone width in the world.

## MAJOR-B — a screen that renders NOTHING still counts as scanned and clean

`aria-current="page"` is set from `state.view`. It proves the tab highlighted, not that the screen
rendered.

PROVEN: I made `renderContent` return `[]` for reports, inpatient and symptoms. Three of the five
tabs render completely blank — no error, no console output, no crash. Scan: **48 combinations,
0 problems, CLEAN, exit 0.** (Returning `null` instead crashes the renderer, and that IS caught —
by the console gate, not by the navigation check.)

This is much better than before (genuinely dead tabs are now caught) but the receipt still is not
"the screen rendered". Fix: demand a per-screen content hook, or that the content region is
non-empty.

## MAJOR-C — the rewritten scan is still blind to `<select>`, the control named in its own comment

The comment says the old version "skipped every `<select>` ... It was blind to both defects it had
been written to catch." Selects now pass the leaves filter, but they still cannot be measured.
Measured directly on a 110px select holding "Every few days (for example, every other day)" — the
exact MINOR-9 case from the previous audit:

    range.selectNodeContents(select).getClientRects()  ->  []      (option text is not laid out)
    scrollWidth 108   clientWidth 108   rect 110

so rule A's `textW > 0` guard bails and rule B's `scrollWidth - clientWidth` is 0. **Not flagged.**
The half-fix is worse than none here, because the comment now claims coverage that does not exist.

## MAJOR-D — one CSS property switches the scan off for any element

`clipped = cs.textOverflow === 'ellipsis'` exempts an element from rules A **and** B. But
`text-overflow: ellipsis` does nothing on its own; without `overflow: hidden` the text spills in
full.

PROVEN: an 80px box with `white-space:nowrap; text-overflow:ellipsis` and no `overflow:hidden`,
holding 400px of text — **not flagged**. Adding that one declaration to any element makes it
permanently invisible to the gate. That is exactly the property a developer reaches for when the
gate complains. Fix: require `overflow` to actually be hidden/clip before honouring the exemption.

## MAJOR-E — the false changelog claim is corrected in a section that does not contain it

The correction itself is accurate. I checked it independently:

- `git log -S clampTreatmentDays -- index.html` -> first appears in **bc52fd4 (app-v16)**, the
  commit that introduced the feature, and at that commit `saveMedicationEditor` already writes
  `treatmentDaysBefore: clampTreatmentDays(form.treatmentDaysBefore)`, whose body returns
  `Math.round(Number(value))`, a number. Nothing the editor saves has ever been a string.
- At 51ba75f there is no `TREATMENT_DAYS_MAX` and `treatmentActiveOn` has no upper bound at all,
  so "before it there was no upper bound anywhere" is right.
- It does **not** overcorrect: the claim that "a restored backup or an imported file can hand it a
  string" is true — the restore path writes `saveJSON(K('med-v1'), { version: 1, meds:
  incomingMeds, ... })` straight from the bundle with no per-field validation, so
  `normalizeMedication` really is the only guard.

But the false claim lives in the **version-history table row at README.md line 14**, and the
correction was appended at line 98 under *"Correction to the app-v68 notes above"* — which sits
under the narrative section at line 73, a section that contains neither of the two claims being
corrected. Line 14 still reads, unqualified:

> **(6) The treatment window was unbounded and string-blind here** — a `text` input with no upper
> limit, and `Number.isFinite("3")` is false, so every window typed in silently collapsed back to
> 1/1.

That row already carries its own in-row *"Correction to an earlier claim in this row"* paragraph,
so the row's own convention is to correct in place. And it is that row that `release_check.sh`
reads and that the script's own words call *"worse than no entry, because it will be believed."*
A reader of the version history gets the false story with no correction in sight.

Also stale, introduced by this commit: line 91 still says the fix was *"a smaller nav label under
360px"*. After d50e60b the smaller label is under **320px**.

## MINOR-F — false positives the rewritten scan will produce

- Content in a horizontally **scrollable** strip is correctly skipped by rule A (parent clips) and
  then flagged by rule C, *"off the right edge"* — rule C consults no ancestor at all. A scrollable
  chip row is a normal pattern and would be reported as a defect.
- An **absolutely positioned** element anchored to a small `position:relative` parent (badge,
  tooltip, popover) is flagged: 20px anchor, 129px badge -> *"wider than the box it sits in by
  109px"*.
- Neither shape exists in the app today, so the scan is green. Latent, not live.

## MINOR-G — dead condition in the new scanner

    if (!parentClips && cs.whiteSpace !== 'normal' || !parentClips) {

reduces to `if (!parentClips)`. The `white-space` half can never change the outcome. Whatever was
intended there is not happening.

## MINOR-H — `release_check.sh` still has a silent-exit hole of the class it has fixed six times

Change `const APP_VERSION = 'app-v68';` to double quotes — a legal, innocuous edit — and the
script exits **1 with no error message at all**. Traced with `bash -x`: `NEW_VERSION=$(grep -o
"APP_VERSION = '[^']*'" index.html | head -1 | sed ...)`; the grep matches nothing, `pipefail`
fails the pipeline, the assignment fails, `set -e` kills the script. The two lines below it guard
exactly this for `GATE_VERSION` and the line above guards it for `OLD_VERSION`; this one does not.
Pre-existing (untouched by this commit and by ecebc50), fail-closed, but silent — which the script
itself calls the worst outcome.

## MINOR-J — a .gitignored file under a rule-5 path is still invisible to the gate

`git ls-files --others --exclude-standard` honours `.gitignore`. The repo's ignore patterns
`verify_*.mjs`, `audit_*.mjs`, `designer_*.mjs` are unanchored, so they match at any depth —
including inside `sync-backend/`. PROVEN: `sync-backend/verify_deploy.mjs` is invisible and the
gate reports **"✅ Release check passed."** It cannot reach GitHub Pages (git will not commit it),
but `sync-backend` is a separately deployed service and a CLI deploy from the working directory
would carry it. Cheap fix: add `--exclude-standard` off, or `git status --porcelain --ignored`
for the rule-5 paths specifically.

## NOTE-K — vertical overflow is not checked

Text clipped by a too-short box is invisible to all three rules. Consistent with the file's stated
scope ("wider than"); recorded so nobody assumes otherwise.

## NOTE-L — the fixture check uses `document.body.innerText`

That is not `textContent`, and it is safe here — `<script>` and `<style>` are `display:none` so
the source is excluded, which I confirmed empirically (the wipe sabotage correctly returned
`nomeds` even though index.html contains the word 17 times). It is safe by two coincidences,
though: the one hardcoded "Dexamethasone Due" banner is gated on the medication existing, and it
reads the whole page rather than the medication list. Prefer scoping the check to the med list.

## NOTE-M — the pre-existing start-up diagnostic hazard: CONFIRMED by experiment

The previous auditor read this out of the source; I ran it.

- Throw during module init (right after `cwInstallErrorLog()`): browser reports the error;
  on-device log `chemowell-app-log-v1` is **null**. Nothing recorded.
- Identical throw 2.5s later, after init completes: logged in full, with `"app":"app-v68"`.

`cwLogAdd()` builds its entry with `app: APP_VERSION`, declared at line 6511. If the module throws
before that line, the binding is in the temporal dead zone forever, `cwLogAdd` throws, its own
`catch (e) { return null; }` swallows it, and the one diagnostic that exists for a silent start-up
failure records nothing — during exactly the window it is for.

**Should it block this release? No.** It is not introduced or exercised by this delta, and the
scan's new console gate now catches start-up errors in CI, which is where the app-v68 wipe was
found. But the fix is one line — move `const APP_VERSION` above `cwLogAdd`, or read it lazily —
and this release is literally about diagnosing a silent start-up failure, so it is the natural
place to fold it in. Log it for the next safety release at the latest.

---

## What I tried to break and could NOT

- **44px tap targets.** A realistic `min-width:44px; min-height:44px` close button, glyph or short
  label, inside a 39px header slot is NOT flagged. The Range measures the text's ink width, not
  the line box — confirmed directly: a 980px-wide flex row containing "Ok" measures 19.1px. The
  comment's justification for the Range rewrite is sound.
- **Ellipsis-truncated text** done properly (`overflow:hidden` + `text-overflow:ellipsis`):
  correctly NOT flagged.
- **Scrollable containers**, rule A: correctly NOT flagged.
- **Grid cells and flex cells**: overflow IS flagged, 52px and 60px.
- **Wrapping body copy**: NOT flagged. **Pseudo-element (`::after`) overflow**: flagged.
- **The chain gate against new files**: five shapes tried, five blocked (see Claim 4).
- **A stale report clearing the gate on its own**: refused, and the message names each report and
  why.
- **Two current reports per stage at once**: no crash, no short-circuit under `set -euo pipefail`;
  the first is used and the rest are listed. I specifically suspected an `&&`-list would trip
  `set -e` here; it does not.
- **The four unit suites**: unchanged by this commit and all green, twice.
- **The `h()` null-attribute trap**: this commit adds no `h()` attributes at all — index.html
  changes are seven lines of CSS.
- **Version literals and `document.body.textContent`**: no new assertion pins a version string;
  `innerText` is used, not `textContent` (NOTE-L).

## Tree state

`git status` is clean apart from this report, which is untracked and expected:

    ?? outputs/AUDIT_app-v68-remediation.md

index.html, release_check.sh, test/ and README.md are byte-identical to d50e60b. All sabotage was
done on copies via the scan's `--file` flag or in a throwaway clone under /tmp.

---

# VERDICT

**DO NOT SHIP.**

Three of the five findings are genuinely and provably closed, and the two new render checks now
catch the sabotages that defeated them. But:

1. **BLOCKER-1** — the chain gate is still cleared by two three-line stub files, and this change
   made that bypass more reliable rather than less. The gate that exists to stop unread code from
   shipping can be satisfied without anyone reading anything.
2. **BLOCKER-2** — the nav-label fix opened a new overflow at 321–345px that the CSS it replaced
   did not have, and the scan's device list skips that whole band. The release's own gate reports
   the shipping build NOT CLEAN as soon as a width in the band is tested.

Required before ship: fix the 321–345px band (move the size drop to `max-width:345px`) and add a
device width inside it; and make the chain gate require the audited commit to be an ancestor of
HEAD plus a readable verdict. MAJOR-C, MAJOR-D and MAJOR-E should go in the same pass — a gate
blind to every `<select>`, switchable off by one CSS property, and a false claim still standing in
the row release_check.sh reads.
