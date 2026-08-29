AUDITED-COMMIT: ecebc50db5d8bf35a5e3433599cb1c81e1bdce59

# Zero Day Audit — app-v68 unaudited delta (51ba75f..ecebc50)

STATUS: COMPLETE — verdict DO NOT SHIP.

Scope: the entire delta `git diff 51ba75f..ecebc50` — index.html (+136), release_check.sh (+94),
test/overflow-scan.mjs (new, 320 lines), test/v68-treatment-clamp.mjs (new), test/v67-chemo-offset.mjs,
README.md.

Baseline: all four unit suites pass (26/26, 10/10, 4/4, 28/28). The render scan reports CLEAN,
48 screen/width combinations, 0 problems.

---

## BLOCKER-1 — the render scan says CLEAN when every saved medication has silently vanished

The scan's stated fixture guard is: "Two things must be true, and the second is the one that bites:
the app is past first-run setup, AND the seeded medication actually reached the screen. Checking only
the first would have called a run clean while every medication had been silently dropped on load."

The second check does not exist. `page.evaluate(seedName => {...}, SEED_MEDS.meds[0].name)` passes
`seedName` in and never reads it. The body only checks that two nav buttons exist.

PROVEN: I made `loadMedicationConfig()` return the empty fallback unconditionally, with no console
output at all — the exact end-state of the TDZ bug this scan was written to catch, minus the
incidental console warning. The scan reported "every screen clean at all 8 device widths", exit 0.

The medication editor was still counted as scanned, because its opener falls back to the "Add"
button when no medication exists — so a run in which the app has lost every medication is
indistinguishable from a healthy run.

The TDZ wipe was caught last time by a console warning the author happened to be printing. That is
luck, not a gate. Fix: assert the seeded medication's NAME is present in the medication list before
scanning, and fail the run if it is not.

## BLOCKER-2 — the render scan says CLEAN for screens it never rendered

`navigated` is true if the nav BUTTON exists. Nothing checks that the view actually changed.

PROVEN: I made `navigateTo()` return early for reports, symptoms and inpatient — three of the five
tabs became completely dead, tapping them does nothing. The scan reported "48 screen/width
combinations, 0 overflowing element(s). CLEAN", exit 0.

This is the exact trap the file's own header claims was carried over from care-tracker ("the scan
never left Home while reporting five screens walked"), moved one level down: it now clicks the real
button instead of calling navigateTo, but still never confirms it arrived. Fix: read the app's
current view (or a per-screen data hook) after each click and fail if it did not change.

## MAJOR-3 — the scan is structurally blind to text escaping its box, which is its stated purpose

Its title is "does any text escape its box". It cannot see the most common case.

`scanFn` flags an element only if `el.scrollWidth - el.clientWidth > 1`, or if its rect leaves the
VIEWPORT. Inline elements — which is most text in this app, every `<span>` — report clientWidth 0
and scrollWidth 0, so the self-overflow test can never fire on them. Text that spills into a
neighbouring grid cell never leaves the viewport, so the edge test never fires either.

PROVEN with the delta's own second fix: I removed the `.navlabel` rules entirely and the scan
reported CLEAN at all 8 widths. So nothing in this release guards the nav-label fix. The bug is real
— measured directly at 320px, "Symptoms" needs 65.3px in a 57.6px cell and spills 7.7px into its
neighbour — but the new gate cannot see it, and would not see it come back.

## MINOR-4 — the 9.5px nav label fires 40px wider than the bug it fixes

Measured, all five labels, real render:
  320px — cell 57.6px; at 11px "Symptoms" is 65.3px and SPILLS. Fix needed.
  360px — cell 65.6px; at 11px "Symptoms" is 65.3px and FITS (by 0.3px).
  375px — cell 68.6px; everything fits at 11px.

The media query is `max-width:360px`, so every 360px Android phone — the most common width in the
world, per the scan's own comment — drops to 9.5px although 11px already fits there. 0.3px is a very
thin margin, so some guard at 360 is defensible, but 9.5px is not the guard it needs.

Verdict on the project's 16px floor: that rule exists because iOS Safari zooms the page when a TEXT
INPUT under 16px receives focus. A nav label is not a text control and does not trigger it, so the
rule does not formally apply. But 9.5px is very small type on a patient-facing app used by someone
mid-treatment. Recommend: `max-width:320px` for the size drop, or keep the letter-spacing tightening
at 360 and drop the font-size change there.

## MAJOR-5 — the changelog states a user-facing bug that never existed in any shipped build

README's new app-v68 item (6) says: *"The treatment window was unbounded and string-blind here — a
`text` input with no upper limit, and `Number.isFinite("3")` is false, so every window typed in
silently collapsed back to 1/1."* The code comment in `normalizeMedication` says the same.

The second half is not true, and it is checkable. `saveMedicationEditor` has run
`clampTreatmentDays(form.treatmentDaysBefore)` — which returns a NUMBER — since `bc52fd4`, the
app-v16 commit that introduced the feature at all (`git log -S`, confirmed). No released version of
this app has ever written a string into `treatmentDaysBefore`/`After`, so `Number.isFinite` in
`normalizeMedication` always saw a number and nothing ever collapsed to 1/1. The change is correct
and harmless; the story told about it is wrong.

Same for the framing of item (1) in the brief: the "chip reads −300/+300 while the app obeys 14"
divergence was introduced by `68d3dd6` — an unreleased intermediate commit inside this very delta —
and removed by `84ad288` two commits later. At `51ba75f`, `treatmentActiveOn` had NO 14-day cap at
all, so a stored 300 was actually obeyed. What genuinely reached users was the unbounded save clamp;
what is being described is the intermediate state of this release's own work.

This matters because `release_check.sh` itself says a version-history entry wrong about the one fact
it exists to record "is worse than no entry, because it will be believed" — and this same README row
already carries two corrections of earlier false claims. A third is being added underneath them.

## MAJOR-6 — the chain gate does not see new files, so unaudited code ships under a green tick

Both the "does this release touch rule-5 files" test and the new staleness test use
`git diff --name-only <ref> -- index.html sw.js .github/workflows sync-backend ...`. `git diff` only
compares TRACKED paths. A brand-new file is invisible to both.

PROVEN in a scratch clone: with both reports declaring HEAD, I dropped an untracked
`.github/workflows/evil.yml` (a workflow that POSTs a secret to an external host) and an untracked
`sync-backend/evil.js` into the tree. The gate printed:

    ℹ️  Chain artifacts present for app-v68, and current against the working tree:
         outputs/AUDIT_app-v68.md
         outputs/PM_app-v68.md

It declared the tree audited and current while holding two files no auditor had ever seen. A release
consisting only of new files under those paths skips the chain gate entirely.
Fix: use `git status --porcelain -- <paths>` alongside the diff, or `git add -A` those paths first.

## MINOR-7 — two new `|| true` guards can turn a failed check into a pass

`RULE5_CHANGED=$(git diff ... || true)` and `_drift=$(git diff ... || true)`. If either `git diff`
fails for any reason, the variable is EMPTY, and empty means "nothing changed" — the chain gate is
skipped, or the staleness test passes. This is the same shape as the six `set -euo pipefail` holes
this release just closed, inverted: instead of exiting 128 loudly, it now passes quietly. I could not
force `git diff` to fail, so this is a latent risk, not a proven bypass. Prefer capturing the exit
status and failing closed.

## MINOR-8 — the gate reads only the FIRST report matching the version glob

`for _f in outputs/AUDIT*"$GATE_VERSION"*; do ...; break; done`. Which report is read depends on
filename sort order, not on which is newest. Observed live: adding this report
(`AUDIT_app-v68-delta.md`, which sorts before `AUDIT_app-v68.md`) made the gate stop reading the
stale `AUDIT_app-v68.md` entirely. A one-line file named `outputs/AUDIT_app-v68-a.md` containing
nothing but a fresh `AUDITED-COMMIT:` line satisfies the audit half of the gate.

Also: the declared sha only has to EXIST, not be an ancestor of HEAD — so a commit created seconds
ago purely to satisfy the gate works. And `grep -m1 '^AUDITED-COMMIT:'` takes the first such line
anywhere in the file, so a report that quotes a previous report's header at column 0 is read against
the wrong commit.

## MINOR-9 — the "Days taken" picker is now hard-clipped, with no ellipsis, at 320px and 360px

The global `min-width:0` does NOT collapse any select to an unusable width — I measured every select
on the medication editor at 320px and 360px, before and after; nothing narrower than 254px, all
clearly tappable. But the picker that caused the bug now shows
"Every few days (for example, every other day)" needing 303px in 214px of box, cut mid-word with no
ellipsis (its sibling "Schedule type" select already sets `text-overflow:ellipsis`). Trading a
side-scroll for a clean truncation is right; trading it for a ragged cut is avoidable. Add the same
three properties, or shorten the option label.

## NOTE-10 — a stored out-of-range window is silently rewritten on the next save of ANY medication

`state.meds` is the normalized (now 14-capped) list, and every `persistMedicationConfig()` call site
writes `state.meds`. So a medication saved with 300 days becomes 14 in storage the first time the
user saves, pauses, reorders or deletes ANY medication. Behaviour does not change — nothing ever
obeyed 300 correctly and the chip now tells the truth — but the original number is gone. Acceptable;
recording it so nobody is surprised later.

## NOTE-11 — a pre-existing TDZ hazard of exactly the shape this release fixed

Static scan of every top-level `const`/`let` against the module-init region found two forward
references. One is real in shape: `cwLogAdd()` (line ~413) writes `app: APP_VERSION`, and
`APP_VERSION` is declared at line 6506. `cwInstallErrorLog()` installs that handler at line 439,
during module init. If the app throws during module start-up, the on-device error log is the one
diagnostic that exists — and it would itself hit `Cannot access 'APP_VERSION' before initialization`,
be swallowed by its own `catch (e) { return null; }`, and record nothing. The one instrument for a
silent start-up failure is disabled during exactly the window it is for. Not introduced by this
delta; not exercised by it either. (The other, `CW_BK_MAX_BYTES` at line 214/7486, is only reachable
from a user gesture and is safe.)

## NOTE-12 — treatmentActiveOn's null-med branch is unreachable

`clampTreatmentDays(med ? med.treatmentDaysBefore : undefined)` yields a ±1-day window for a null
med. No caller can reach it: `treatmentOnlyBlocks` returns early on `!med`, and
`treatmentExcludedNow` dereferences `med.treatmentMode` before calling. Harmless dead defence.

## NOTE-13 — selects sit at 13px, below the iOS zoom floor

Not from this delta, and the 16px rule is about text INPUTS (iOS Safari zooms the page when one
under 16px is focused). Selects also trigger it. Every select in the medication editor is 13px.
Logged, not blocking.

---

## What I tried to break and could not

- **The unified clamp.** Removed the upper bound → `test/v68-treatment-clamp.mjs` goes red on 5
  checks. Restored the `Number.isFinite` version in `normalizeMedication` → red on 3. The suite is
  real and it falsifies.
- **The TDZ fix.** Re-created the original `const TREATMENT_DAYS_MAX = 14` → the render scan's
  console gate catches it immediately ("Cannot access 'TREATMENT_DAYS_MAX' before initialization",
  8 console errors, exit 1) and both unit suites also fail. Claim 3 verified.
- **The `set -euo pipefail` guards.** Built a baseline commit with no `sw.js`: the pre-fix
  `release_check.sh` from 51ba75f dies at exit 128 with ZERO output; the fixed one runs to
  completion and reports. Claim 4 verified, falsified both ways.
- **The staleness gate against tracked drift.** It works. The real `PM_app-v68.md` declares 51ba75f
  and the gate blocks the release naming `index.html` as unaudited. A report declaring HEAD but
  written before a later working-tree edit is also caught, because the comparison is against the
  working tree, not HEAD.
- **The select fix.** Reverted it → the scan goes red at 320/375/384px with "THE PAGE ITSELF IS
  WIDER THAN THE PHONE, needs 379px". Real fix, real check. (Note: only the medication editor was
  ever affected — the five tabs were clean at 320px without the fix too.)
- **Collapsing a select with the global `min-width:0`.** Measured every select on the editor at 320
  and 360, including the flex-row "interval" layout. Nothing collapses.
- **`h()` null-attribute trap.** The only new `h()` attribute in the delta is
  `{ className: 'navlabel' }`; `h()` handles `className` explicitly. No new conditional attributes.
- **Version literals / body.textContent.** No new assertion in the delta pins a version string or
  reads `document.body.textContent`.

## Verdict

**DO NOT SHIP.**

Not because the app logic is wrong — the treatment-window work in this delta is sound and I could
not break it. Because the two things this release adds to the process are both broken in the way
they were added to prevent: the render scan reports CLEAN on a wiped medication list and on screens
it never rendered, and the chain gate calls a tree audited while it holds files nobody has read.
Shipping them as-is installs two checks that cannot fail, which this project's own rules call worse
than having none.

Required before ship: BLOCKER-1, BLOCKER-2, MAJOR-6, and the false claim in MAJOR-5.
