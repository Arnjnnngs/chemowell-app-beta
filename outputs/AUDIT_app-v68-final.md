AUDITED-COMMIT: a74f4dc
VERDICT: DO NOT SHIP

# Zero Day Audit — app-v68 final (23aedd6..a74f4dc)

STATUS: COMPLETE.

Scope: the single commit a74f4dc, which claims to close all four findings of
outputs/AUDIT_app-v68-head.md. Files touched: release_check.sh (+87/-25), test/overflow-scan.mjs
(+46/-7), index.html (22 lines), README.md (one version-history row).

---

## HEADLINE

**The screen check that this release exists to fix has been switched off by the fix itself.**
I put back the two long dropdown labels this commit removed — including the one the commit says
the new rule "immediately found" cutting off mid-word at every width from 320px to 428px — and
ran the screen scan at this exact commit. It reported **60 combinations, 0 problems, CLEAN,
exit 0.** At the previous commit the same mutation produced 8 problems.

The reason is in the same commit. It added `text-overflow: ellipsis` to the "Days taken"
dropdown, and the new rule **skips any dropdown that has an ellipsis**. Both medication-editor
dropdowns now have one. So the rule that was rebuilt to catch dropdown truncation cannot fire on
either of the two dropdowns it was rebuilt for. This is the **third release running** that this
rule has been claimed as working and been unable to fire.

And there is a real one it is now blind to, in the code as it stands: choose Schedule type
"Scheduled", and the Days taken option **"As needed — don't flag missed doses"** is **32px too
wide at 320px** and **22px too wide at 330px**. By this release's own stated standard — "those two
options relied on truncation even on a 428px iPhone Plus" and were therefore shortened — that
option relies on truncation at the two narrowest widths the app supports, and was not shortened.

---

## SUITES, run by me at a74f4dc

    test/v67-chemo-offset.mjs        26/26 PASS                            exit 0
    test/v67-inpatient-window.mjs    10/10 PASS                            exit 0
    test/v67-medflag-backfill.mjs      4/4 PASS                            exit 0
    test/v68-treatment-clamp.mjs     28/28 PASS                            exit 0
    test/overflow-scan.mjs           60 combinations, 0 problems, CLEAN    exit 0

All green. The last one is the problem: see BLOCKER-1 for what "clean" is now worth.

## ./release_check.sh

Exits **1**. It says: *"a chain report refuses this release, and nothing supersedes it"*, and
lists all five standing reports — four audits and one PM sign-off — each with the commit it
examined. That is the right answer for the right reason, and the new refusal-blocks-the-gate
behaviour is genuinely there. Every other check in the script passes; I proved that in a throwaway
clone by satisfying the chain gate and watching the script run to "Release check passed" with no
other complaint.

---

# FINDINGS

## BLOCKER-1 — the dropdown check was disarmed by the dropdown fix

Falsified, both directions:

  - Restored `'Every few days (for example, every other day)'` and the two long Schedule type
    labels in index.html. Ran test/overflow-scan.mjs at a74f4dc.
    Result: **60 combinations, 0 overflowing elements, CLEAN, exit 0.**
  - The commit message for this same commit records that mutation as **8 problems, NOT CLEAN**
    at the previous commit.
  - index.html restored byte-for-byte (md5 verified, `git status` clean).

Mechanism, in the new code:

    const selEllipsis = cs.textOverflow === 'ellipsis';
    if (!selEllipsis) [...el.options].forEach(...)   // measure every option

`text-overflow: ellipsis` is now treated as "the designer meant this", so the measurement is
skipped entirely. This commit then ADDED `textOverflow: 'ellipsis'` to the "Days taken" select
in the very same diff. The other editor dropdown ("Schedule type") already had it. So both are
exempt. There is now nothing standing between this app and a re-lengthened dropdown label.

The reasoning behind the exemption is sound and I verified its premise myself rather than taking
it on trust (see WHAT HELD UP). The error is scope: "ellipsis means deliberate" was applied as
"never measure this control again", instead of "measure it, and report it differently". A
dropdown that has to hide two thirds of its own words behind an ellipsis on a 320px phone is not
a design decision; it is the same defect with a nicer edge.

## BLOCKER-2 — a live truncation in the shipping build, at the two narrowest widths

Measured in the real app, medication editor open, Schedule type = "Scheduled":

    320px:  room for text 212px · "As needed — don't flag missed doses" needs 244px · over by 32.1px
    330px:  room for text 222px · same option                                        · over by 22.1px
    360px and up:  fits, 0px over

The user sees roughly "As needed — don't flag missed d…". The words that carry the meaning —
*don't flag missed doses* — are the ones cut. This is a medication-safety setting; the option
that turns missed-dose alerts off is the one whose label is unreadable on the narrowest phones.

It is the same defect class this release fixed twice elsewhere, in the same control, and it was
missed because the check that would have found it had just been switched off (BLOCKER-1).

## MAJOR-A — "cleared only by a strictly later commit" is not what the code does

A **two-line file naming a commit that is not in this branch's history at all** cancels every one
of the five standing refusals.

Reproduced in a throwaway clone at a74f4dc:

  1. Made a commit on a side branch off HEAD, never merged. Confirmed it is NOT an ancestor of HEAD.
  2. Wrote `outputs/AUDIT_zz-app-v68.md`, two lines: that sha, and `VERDICT: SHIP`.
  3. `./release_check.sh` no longer prints "a chain report refuses this release". The list of five
     real DO NOT SHIP reports disappears from the output.

The supersession loop applies **none** of the checks the clearing path applies. It never asks
whether the approving report is thick enough to be a report (the 2000-byte / 25-line floor is only
in `check_report_current`), and it never asks whether the approving commit is on this branch —
only `git merge-base --is-ancestor <refusal> <approval>`, which any descendant on any abandoned
branch satisfies.

The release still fails afterwards, for a different reason ("no CURRENT chain report"), so this is
not a complete bypass today. But the gate's loudest and most important signal — *four independent
audits refused this exact code* — is erasable by a stray two-line file, and the message that
replaces it is much milder. The thing this gate exists to prevent is a placeholder standing in for
a stage nobody ran. A two-line placeholder is exactly what silences it.

The asymmetry is worth stating plainly: a two-line file is trusted enough to **overrule** a real
audit, and not trusted enough to **clear** the gate itself. It should be neither.

## MAJOR-B — one stage's sign-off overrules the other stage's refusal

The commit says a refusal is cleared "by re-running THAT STAGE against a LATER commit". The code
does not check the stage. The loop reads `$AUDIT_ALL $PM_ALL` on both sides, so a PM sign-off
clears an Auditor's refusal and vice versa. Verified: a two-line PM file cancelled all four
auditor refusals. The auditor never looked again.

## MAJOR-C — the blank-screen bar went from 80 to 150, but only about five of those characters are real

The check is `document.body.innerText.length - nav.innerText.length > 150`. It subtracts the
bottom navigation. It does **not** subtract the app's persistent header, which renders on every
screen whatever happens below it:

    "ChemoWell BETA · Test Patient's Meds · Saturday, Aug 29 · 1/2 · BETA DATE CONTROLS ▼"

Measured: that header is about **77 characters**, present on all five screens, always. So the
effective bar over screen-specific content is roughly **74 characters** — essentially the old 80.

I then stripped each screen down to its first block, leaving the title and nothing else, and ran
the check's own arithmetic:

    home        1416 -> 106   caught
    meds         660 -> 228   STILL PASSES        (every medication card gone)
    reports      531 ->  90   caught
    inpatient    196 -> 122   caught
    symptoms     269 -> 242   STILL PASSES        (the whole symptom list gone)

A Meds screen with every medication silently wiped — the exact end state the scan's own header
says it exists to catch — reads 228 characters and passes. Two of five screens are not guarded.

I also checked the opposite direction, for a false failure, and found none: with an empty
fixture (no entries, no medications, past first-run setup) the thinnest screen is In-patient at
**192** characters, clear of the bar. The comment in the code says 181; my measurement is 192.
Either way there is no honest empty state that this bar fails — but the margin on that screen is
about 42 characters, so one deleted sentence on the In-patient screen would turn the scan red for
no reason. The bar is sitting close to something it should not be close to.

## MAJOR-D — a report that says DO NOT SHIP can be read as SHIP

`report_verdict` takes the **first** VERDICT-shaped line in the first 12 lines. A report whose own
verdict sits lower than a quoted one is read by the quoted one. Demonstrated, reaching **exit 0**:

    line 1  AUDITED-COMMIT: <head>
    line 2  ```
    line 3  VERDICT: SHIP          <- someone else's, quoted
    line 4  ```
    line 5  AUDITED-COMMIT: <head>
    line 6  VERDICT: DO NOT SHIP   <- this report's own verdict

`./release_check.sh` printed **"Release check passed."**

Two mitigations exist by luck, not design, and I checked both: indenting the quote by four spaces
(the normal way to quote in these reports) breaks the `^VERDICT` anchor and the attack fails; and
if the quote carries its own AUDITED-COMMIT line first, `report_sha` picks that sha up instead and
the mismatch usually saves it. Neither is a rule anyone wrote down.

The underlying flaw is that `report_sha` and `report_verdict` scan independently and each takes its
own first match. A report's commit and its verdict can therefore be read from two unrelated lines.
They should be read as one header, at fixed positions.

## MINOR-1 — three legitimate ways to write the verdict are refused

Refused as "states no verdict": `**VERDICT: SHIP**` (markdown bold), `> VERDICT: SHIP`
(blockquote), `VERDICT: SHIP.` (trailing full stop). These fail safe — a real approval is read as
no approval — so nothing unsafe ships. But markdown bold on the headline verdict is a natural thing
for a human to write in a file that is otherwise markdown, and the failure message does not say
which of the two things is wrong. Accepted correctly: `VERDICT:SHIP`, `verdict: ship`, tabs either
side, trailing CR, trailing spaces. Correctly refused: `VERDICT: SHIPPING SOON`, `VERDICT: SHIP IT`.

## MINOR-2 — the corrected README row contains a fresh arithmetic slip

The row still says a mistyped 30-day window "would have made a medication treatment-adjacent for
**two months either side**". Thirty days is one month either side, two months in total. In the one
row this diff exists to make factually accurate, and the one row release_check.sh itself reads,
a 2x overstatement should not survive.

---

# WHAT HELD UP — things I tried hard to break and could not

**The `overflow: visible` claim is TRUE, and I did not take it on trust.** I built five selects
with `overflow` set to hidden, clip, auto and unset, plus a plain div for control. Chromium
computes `overflow: visible` on every single select regardless of the stylesheet, while honouring
`text-overflow` and `white-space` on the same element; the div reports `hidden` as written. A
screenshot confirms the behavioural difference is real: a select without ellipsis cuts mid-word,
one with ellipsis shows "…". The remediation's stated measurement is correct.

**Sha normalisation (the previous auditor's padded-fake attack).** Re-run both ways. A padded,
thick, forged SHIP declaring the full 40-character form of 23aedd6 does **not** supersede the real
refusal that declares the short form, and the reverse also fails. Equal commits are recognised as
equal. Closed.

**Verdict anchoring.** `VERDICT: SHIPPING SOON` and `VERDICT: SHIP IT` are both refused. Closed.

**The 12-line window.** A thick, otherwise perfect SHIP report with its header at line 13 is
refused. A legitimate report with a title line and a blank line above its header passes. Both
directions correct.

**The thinness floor, checked for false failures.** A 25-line file with no trailing newline is
counted as 25 lines and accepted. I could not construct a plausible short chain report that this
rejects: the mandated header plus two dozen lines of findings clears it easily, and every real
report in outputs/ is 14,000 bytes or more.

**A refusal at the same commit beats an approval at the same commit.** A thick SHIP at HEAD plus a
thick DO NOT SHIP at HEAD → blocked, correctly, naming the refusal.

**A thin placeholder refusal does block.** Right outcome, wrong consistency — see MAJOR-A.

**The shortened labels and the new helper text.** Measured in the live app at 320, 330, 360, 390
and 428px: "As needed", "Scheduled" and "Every few days" overflow by **0px at every width**.
Nothing relies on truncation for those three options anywhere. The new helper text renders, is
12px, wraps to three lines, stays inside the screen at 320px (254px wide inside a 320px viewport,
right edge at 287px), is not clipped, and the document never scrolls sideways at any width tested.
Claim 7 is met for the options it covers — it is the fourth option, "As needed — don't flag missed
doses", that was left behind (BLOCKER-2).

**The unit suites.** All four run clean, and the treatment-clamp suite pins the string-coercion and
the shared bound properly.

**The README `git log -S` correction is accurate and does not overcorrect.** I checked the history
myself rather than believing the row. `saveMedicationEditor` has called
`clampTreatmentDays(form.treatmentDaysBefore)` since bc52fd4 — app-v16, the commit that introduced
the feature — and `clampTreatmentDays` has coerced with `Math.round(Number(value))` since that same
commit. So the editor has never saved a string, and the claim that every typed window "silently
collapsed back to 1/1" was indeed never true in a shipped build. The `Number.isFinite` test lived
in `normalizeMedication` and in the editor-seeding path, not in the save path. The correction also
does not go too far: it keeps the `normalizeMedication` fix as correct for restored backups and
imports, which is right, and "before it there was no upper bound anywhere at all" is confirmed —
no cap exists anywhere in 51ba75f^.

---

# WHAT I COULD NOT MAKE FAIL

Nothing. Every check I attacked either failed correctly or failed incorrectly; I found no check in
this diff that is incapable of going red. The dropdown rule (BLOCKER-1) is the closest thing to
one: it CAN go red, and does on selects without an ellipsis — it simply cannot go red on either of
the two controls it was written for.

# HOUSEKEEPING

All mutations reverted. `index.html` md5 matches the pre-audit copy. `git status` shows only this
report as an addition. Nothing committed, nothing pushed, /home/user/care-tracker untouched. All
gate attacks were run in a throwaway clone, which was left clean.

# VERDICT

DO NOT SHIP. Two blockers, four majors. The screen check that this release was written to repair
is, at this commit, unable to fail on the controls it guards, and there is an unfixed truncation
sitting behind it in shipping code.
