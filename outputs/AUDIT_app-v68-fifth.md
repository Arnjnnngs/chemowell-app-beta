AUDITED-COMMIT: 30ed35a
VERDICT: DO NOT SHIP

# Zero Day Audit — app-v68, fifth pass (a74f4dc..30ed35a)

STATUS: COMPLETE.

Scope: the single commit 30ed35a, which claims to close the two blockers and four majors of
outputs/AUDIT_app-v68-final.md. Files touched: test/overflow-scan.mjs, release_check.sh,
index.html (8 lines), README.md (one phrase in one row).

---

## HEADLINE

**The dropdown check is genuinely fixed this time — and the release renamed a button in the app
without renaming it in the Help pages, so Help now tells people to look for something that is not
there.**

I attacked the repaired check hard and could not defeat it. I put the long labels back and it went
red, 36 findings, on both editor dropdowns, in both schedule modes, at every phone width. Then I
put back ONLY the one option the last audit found by hand — "As needed — don't flag missed doses" —
and the scan caught it on its own, at 320px and 330px, over by 32px and 22px: the same two numbers
the previous auditor measured by hand. That is the first time in four releases this rule has been
able to fire on the control it was written for. It is real.

But the same commit shortened that option to "As needed" in the app and left two Help topics
quoting the old wording word for word — including the Help topic *for that exact dropdown*, which
lists its four choices as a menu. One of the four no longer exists. And "No set days", which is what
that slot actually says for an as-needed medication, is not mentioned anywhere in Help at all.

The release note for this change says the explanation "moved into the field's help text" and that
no meaning was lost. It moved into the little grey line under the field. It did not move into the
Help centre, which is the thing a confused caregiver actually opens, and the Help centre now
contradicts the screen — on the setting that turns missed-dose alerts off.

---

## SUITES — every one run by me at 30ed35a, and every one produced real output

    test/v67-chemo-offset.mjs        26/26 PASS, named assertions printed     exit 0
    test/v67-inpatient-window.mjs    10/10 PASS, named assertions printed     exit 0
    test/v67-medflag-backfill.mjs      4/4 PASS, named assertions printed     exit 0
    test/v68-treatment-clamp.mjs     28/28 PASS, named assertions printed     exit 0
    test/overflow-scan.mjs           "60 combinations, 0 problems, CLEAN"     exit 0

I checked the thing this repo has now been bitten by three times: a gate that cannot start looks
exactly like a gate that passes. None of the five is in that state. All four unit suites printed
individually named assertions and a total count, not a bare exit code. The screen scan printed a
real summary line and I proved separately that it can go red (three different ways, below).

The screen scan's own count is wrong, though — see MAJOR-1.

## ./release_check.sh — exits 1

It says: *"RELEASE CHECK FAILED: a chain report refuses this release, and nothing supersedes it"*,
and lists six standing reports — five audits and one PM sign-off — each with the commit it examined.
That is the correct answer for the correct reason.

I also proved the script is not simply stuck. In a throwaway clone I satisfied the chain properly
(a thick Auditor SHIP and a thick PM SHIP, both naming HEAD) and the script ran through to
**"Release check passed."** with no other complaint. So every other check in the script passes at
this commit, and the only thing holding the release is the refusals — which is what should hold it.

---

# FINDINGS

## BLOCKER-1 — Help still names a dropdown option this release deleted

The commit changed the Days-taken option from "As needed — don't flag missed doses" to "As needed".
Two Help topics still quote the old wording exactly:

  - *"One particular medication never reminds me"* — step 4 tells the reader:
    "Check **Days taken**. ... If it's set to *As needed — don't flag missed doses*, it never
    reminds."
  - *"This medication isn't taken every day"* — the topic FOR this dropdown. It lists the four
    choices as a menu, and the fourth is given as
    "*As needed — don't flag missed doses* — available any day, and never flagged as missed."

Neither string exists in the app any more. Measured on the running app at 320px, the four options
in that dropdown now read:

    scheduled medication:   Every day · As needed · Specific days of the week · Every few days
    as-needed medication:   Every day · No set days · Specific days of the week · Every few days

So a caregiver reading the Help topic for this setting is given a four-item menu in which one item
is wrong, and if their medication is an as-needed one, the item they are told to look for
("As needed — don't flag missed doses") is replaced on screen by an unrelated phrase
("No set days") that appears **nowhere in Help at all**. I searched the whole file: "No set days"
occurs exactly once, in the app code, and never in a Help topic.

Why this is a blocker and not a copy nit:

  1. This release exists to change the wording on this control. Getting the wording right is the
     entire deliverable, and the release note asserts "no meaning was lost."
  2. This project has already shipped this exact failure once and called it a BLOCKER. app-v67's
     record says the Help centre "**taught the workaround**" — instructing a user to end a hospital
     stay early to log a dose. The lesson written down then was that Help contradicting the app is
     a defect in the app, not a documentation chore.
  3. The setting in question is the one that switches missed-dose alerts off.
  4. The fix is two strings. There is no cost argument for shipping around it.

## MAJOR-1 — the scan says it checked 60 screens; it checked 70

The new "med editor in Scheduled mode" pass is a seventh screen per width. The line that prints the
total was not updated — it is still "ten widths times (five tabs plus one)". Every run therefore
prints 60 no matter how many screens are really walked.

The consequence is precise and bad: a clean run at this commit prints

    60 screen/width combinations, 0 overflowing element(s).
    CLEAN

which is **byte-for-byte the sentence the previous commit printed** — the commit where the previous
auditor proved the check had been switched off. The single number a reviewer would use to confirm
the new pass is actually running did not move when the pass was added. This is the same family as
the mistake this file's own header warns about twice.

To be fair to it: if the new screen fails to open, the run says so out loud and exits 1. It is the
success path that is silent about it.

## MAJOR-2 — three of the five tab screens can lose all of their content and still pass

The new bar is: the `<main>` region must hold more than 60 characters, plus — for Home and Meds
only — the seeded medication's name must be on screen. Reports, In-patient and Symptoms get the
60-character bar and nothing else.

I broke two of them and ran the real suite:

  - deleted every one of the eight report tiles from the Reports menu
  - deleted every symptom row from the Symptoms screen

Result: **"every screen clean at all 10 device widths ... 0 overflowing element(s). CLEAN", exit 0.**

Measured, main-region character counts:

                    healthy   gutted   bar   verdict
    reports           453       79      60   PASSES (19 characters of margin)
    symptoms          191      166      60   PASSES
    in-patient        118      118      60   (thinnest honest screen; 58 of margin)

The code's comment says "The real check for 'the content vanished' is below" — but that check is
`if (key === 'home' || key === 'meds')`. For the other three screens there is no such check, and
the comment reads as though there is.

It is also, narrowly, a step backwards for those three. The old rule was body text minus nav > 150,
which on this app is main + about 76 characters of header, i.e. an effective bar of ~74 over main.
The new bar over main is 60. Measured on the gutted Reports screen: the old metric was 155 against
150 — six characters from catching it. The new one is 79 against 60 — nineteen away. The bar moved
in the wrong direction on exactly the screens that did not get a fixture assertion to compensate.

## MAJOR-3 — the scan's fixture sits exactly on a date boundary, so the run will go red for nothing

The seeded medication is treatment-only with a three-day window either side, and the seeded
treatment date is `now - 259200000` — exactly three days ago. Today is therefore day +3: the **last**
day inside the window. There is zero margin.

Falsified through the real suite, not by reasoning. I copied the suite, changed one number in the
fixture — the seeded treatment date from three days ago to four — and ran it against the shipping
index.html. Output:

    COULD NOT REACH HOME at 320px — not scanned (blank, or the seeded medication is missing)
    ... the same line at 330, 345, 360, 375, 384, 390, 393, 412 and 428px
    60 screen/width combinations, 0 overflowing element(s).
    10 screen/width combination(s) COULD NOT BE REACHED and were not scanned.
    NOT CLEAN — an unreachable screen is an unchecked screen.        exit 1

Nothing was wrong with the app. One day of drift in the fixture takes the whole run down, and the
message it prints blames the render.

Two ways this happens on its own, with nothing wrong in the app:

  - **The run crosses local midnight.** `now` is captured once when the scan starts; the browser's
    own clock keeps moving. The scan takes about six minutes. Start it just before midnight and the
    later widths compute day +4 and fail.
  - **A daylight-saving change** inside the preceding 72 hours shifts the fixed 72-hour offset
    across a calendar boundary.

And a third, more corrosive one: this fixture is pinned to the exact edge of the treatment-window
logic that app-v68 is *about*. Any future change to how that window's endpoints are counted turns
this render scan red and makes it look like a layout bug. A fixture should sit in the middle of the
state it needs, not on its boundary. `now - 2*86400000` would do the same job with a day of slack.

## MAJOR-4 — a quoted verdict can still flip a refusal, if two lines are quoted instead of one

The fix requires `VERDICT:` to be the line immediately after `AUDITED-COMMIT:`, and its comment says
this means "a quotation cannot be mistaken for this report's own finding." It closes the attack that
was found, and not the class.

Verified against the gate's own two functions, lifted out and run directly:

    a report whose own verdict is DO NOT SHIP, which quotes another report's COMPLETE
    two-line header (AUDITED-COMMIT then VERDICT: SHIP, unindented) anywhere above its
    own header in the first 12 lines,  is read as   VERDICT: SHIP.

The mechanism is unchanged from last time: `grep -m1` takes the FIRST header-shaped pair in the
window, whichever report it belongs to. Requiring adjacency raised the price of the forgery from one
line to two; it did not make the reader ask whose header it is reading.

What is genuinely closed, and I checked each one:

    fenced quote of a bare VERDICT: SHIP above the real header   -> reads as NO verdict. Closed.
    the same quote indented four spaces                          -> reads the real DO NOT SHIP. Closed.
    a blank line between the two header lines                    -> reads as NO verdict (fails safe).
    a legitimate report: title line, blank line, then the header -> parses correctly.
    a header at lines 11-12                                      -> parses. At line 12 -> no verdict.

The safe fix is to stop searching for the header and start reading it: take lines 1 and 2, or the
first two non-blank lines, and refuse anything else.

## MAJOR-5 — the scan walks 5 of the app's 11 screens, and the one open layout defect on record is in one it never opens

`VALID_VIEWS` in the app lists eleven views: home, meds, reports, in-patient, symptoms, settings,
calendar, account, notes, help, report. The scan's `SCREENS` list is the first five, plus the
medication editor in two modes. Settings, Calendar, Account, Notes, the Help centre and the report
detail views are never rendered at any width.

That matters concretely, not theoretically. BACKLOG.md already carries a **measured, open, unfixed**
layout defect on the Help search screen: a strip that is "216px at 360px wide and 235px at 320px
against a 200px bar, leaving the first result row **21px visible** above the bottom nav at 320px",
red for nine releases. The render gate this release exists to repair cannot see it, because it never
opens that screen.

The header of the scan asks "does any text escape its box, at real phone widths, on **EVERY**
screen?". It covers under half of them. The word EVERY should come out of that header, or the
screens should go in.

## MINOR-1 — the new help line quotes a label that is not on screen in one of the two modes

The new field help reads: *"Not every medication is daily — pick which days this one is given.
"As needed" means no missed-dose alerts for it."* It is static; the label it quotes is not.

For an as-needed medication the Days-taken options are Every day / **No set days** / Specific days
of the week / Every few days. There is no "As needed" in that list. There IS an "As needed" directly
above it, on the Schedule type dropdown, where it means something completely different — a minimum
wait between doses. So in that mode the sentence attaches a missed-dose promise to the wrong control.

Claim 6 asks whether a user can still tell that "As needed" in the Days-taken dropdown means missed
doses are not flagged. In Scheduled mode: yes, cleanly. In as-needed mode: the sentence points at a
label that is not there.

## MINOR-2 — the longest surviving option clears its box by two tenths of a pixel

Measured at 320px: the Days-taken control leaves 166.0px of room, and "Specific days of the week"
needs 165.8px. The dropdown sizes itself to its own longest option, so that option is at 99.9% of
the space available on the narrowest supported phone. It is inside the box and the rule is right not
to flag it — but there is no room left for a font change, a longer translation, or one more letter.

## MINOR-3 — the standing record contains an error about the thinness floor

outputs/AUDIT_app-v68-final.md states, under WHAT HELD UP: "A 25-line file with no trailing newline
is counted as 25 lines and accepted." It is not. `wc -l` counts newlines, so such a file counts as
24 and is **rejected**. Fails safe, so nothing unsafe follows from it — but it is a load-bearing
claim in a document the next release will be read against, and it is wrong.

## NOTE-1 — the Meds seed assertion adds almost nothing

The scan already had a fixture check that clicks Meds and requires the seeded name on the page,
run once per width before anything else. The new per-screen assertion on Meds asks the same question
of the same screen a moment later. The only difference is `<main>` versus the whole body, and the
name never appears outside `<main>`. The Home assertion is the one doing new work.

## NOTE-2 — a refusal stops blocking if its commit stops being an ancestor

The blocking loop skips any refusal whose commit is not an ancestor of HEAD. Amend or rebase the
branch and every standing refusal silently drops out of the list. Pre-existing, not introduced here,
and it fails towards "no current chain report" rather than towards a pass — but it is a way for four
audits to vanish from the output without anyone deciding they should.

---

# WHAT HELD UP — things I tried hard to break and could not

**The dropdown rule fires, on both dropdowns, in both modes.** I restored the long labels in a copy
of index.html and ran the real suite against it: **36 findings, NOT CLEAN, exit 1**, reported on
MED-EDITOR *and* MED-EDITOR-SCHEDULED at every width from 320px to 428px. The ellipsis exemption is
gone and only changes the wording of the finding, exactly as claimed.

**The new mode pass earns its place, and I proved it in isolation.** I restored ONLY the
scheduled-mode option "As needed — don't flag missed doses" and left everything else short. The scan
reported it at 320px (over by 32px), 330px (22px) and 345px (7px), and **only under
MED-EDITOR-SCHEDULED** — the as-needed pass stayed clean, correctly, because that mode shows a
different, shorter label. The two numbers match the previous auditor's hand measurements exactly.
The defect that was found by a human last time is now found by the gate. That is the claim, and it
is true.

**Every other mode and profile state I could reach is clean at 320px.** I lifted the scan's own
measuring function out of the suite and ran it, unmodified, against states the suite never visits:
Days taken = weekly, = every few days, = as needed; the second medication's editor (the scheduled,
treatment-window one, which the suite never opens because it always clicks the first Edit button);
a male profile; and treatment type set to other, radiation and both, across all five tabs. No
overflow anywhere. The coverage gap in MAJOR-5 is real, but I could not find a live defect hiding
in the parts of it I could reach.

**The new help text renders properly at the narrowest width.** Measured at 320px: 12px, wraps to
four lines, box 254px wide sitting inside a 320px viewport, right edge at 287px flush with its
parent, nothing clipped, document never wider than the phone. The as-needed helper below it
("Available any day — missed doses are never flagged for this medication.") wraps to three lines and
behaves the same.

**The shortened label now matches the medication card.** The card's schedule summary already
returned "As needed" for this mode. Before this commit the editor said something longer than the
card; now they agree. That is a real consistency gain and it was not claimed.

**The side-branch supersession attack is closed.** I rebuilt the previous auditor's attack exactly —
a commit on an abandoned branch, never merged, confirmed not an ancestor of HEAD, named by a thick
2,000-plus-byte SHIP report. All six refusals stayed listed, exit 1. The in-this-history test now
applies to the approval as well as the clearing path.

**One desk can no longer sign for another.** A thick PM SHIP at HEAD cleared the PM's own refusal
and left all five Auditor refusals standing, named, blocking. Correct.

**A thin approval no longer overrules anything.** A two-line SHIP at HEAD: all refusals still listed.
The 2,000-byte / 25-line floor now applies on both paths, so a placeholder is neither trusted to
clear the gate nor trusted to overrule an audit. That asymmetry is closed.

**The gate is not jammed shut.** A thick Auditor SHIP plus a thick PM SHIP, both at HEAD, reaches
"Release check passed." So the refusals are the only thing stopping this release, and every other
check in release_check.sh passes at this commit.

**The four unit suites.** All four run, print named assertions, print a count, and exit 0. The
treatment-clamp suite still pins the string coercion, the shared bound, and the absence of a private
copy of the rule.

**The README correction is right.** A 30-day window is one month either side, and the row now says
that. I checked the arithmetic rather than the diff.

---

# WHAT I COULD NOT MAKE FAIL

**The blank-screen check, for Reports, In-patient and Symptoms.** Not "it did not fail" — I could not
construct a mutation of those three screens, short of near-total blankness, that it catches. I
deleted 100% of the content of two of them and it stayed green. It is a 60-character floor and
nothing more, and for those screens the release's own description of it ("the real check for 'the
content vanished' is below") does not apply.

---

# HOUSEKEEPING

Every mutation was made in a COPY of index.html under a scratch directory and fed to the suite with
its `--file` flag; `index.html` itself was never edited. Every gate attack ran in a throwaway clone.
`git status` in the repository shows exactly one addition — this report. Nothing committed, nothing
pushed. /home/user/care-tracker untouched.

---

# VERDICT

DO NOT SHIP.

One blocker, five majors. The repaired dropdown check is the real thing and I could not defeat it —
that part of the release is done and should be kept. But the app now says one thing and its Help
pages say another about the setting that switches missed-dose alerts off, and the screen gate that
is supposed to be this release's safety net miscounts its own coverage, cannot see three of its five
screens losing everything, and carries a fixture that will turn red on its own at midnight.
