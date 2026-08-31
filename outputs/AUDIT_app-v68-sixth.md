AUDITED-COMMIT: 18543b7
VERDICT: DO NOT SHIP

# Zero Day Audit — app-v68, sixth pass (30ed35a..18543b7)

STATUS: COMPLETE.

Scope: the single commit 18543b7, which claims to close the one blocker and five majors of
outputs/AUDIT_app-v68-fifth.md. Files touched: index.html (2 Help topics), release_check.sh
(the report header reader), test/overflow-scan.mjs (coverage count, per-screen assertions,
fixture date, six drawer screens, a Help-search state, failure messages).

---

## HEADLINE

**The commit that was supposed to make the release gate stricter made it weaker. Two of the seven
standing chain reports — including the PM's only sign-off record for this release — stopped being
read at all, so their DO NOT SHIP stopped counting and they vanished from the gate's own output.
Nobody decided that. It happened as a side effect.**

Run the gate at the previous commit and it lists six refusals. Run it at this commit and it lists
five. The two that disappeared are `outputs/AUDIT_app-v68.md` and `outputs/PM_app-v68.md`. Both
still say DO NOT SHIP, in plain text, on line 4. The gate can no longer see them.

---

# FINDINGS

## BLOCKER-1 — the new header rule de-lists two real refusals, one of them the PM's

The change makes a report's header "the first two non-blank lines of the file". Both dropped
reports open the way a normal markdown document opens:

    line 1   # Zero Day Audit — app-v68 (chemowell-app-beta), branch `claude/hotfix-...`
    line 2   (blank)
    line 3   AUDITED-COMMIT: 51ba75f
    line 4   VERDICT: DO NOT SHIP

The first non-blank line is the title. So the reader takes the title and the AUDITED-COMMIT line
as "the header", finds no commit on the first of them, and returns nothing. The blocking loop
begins `[ "$(report_verdict "$_r")" = "" ] && continue` — a report it cannot read is skipped
silently. Not warned about. Not listed. Skipped.

Measured, not reasoned. Running the two functions lifted verbatim out of the shipping script:

    AUDIT_app-v68-delta.md         sha=[ecebc50...]  verdict=[DONOTSHIP]
    AUDIT_app-v68-fifth.md         sha=[30ed35a]     verdict=[DONOTSHIP]
    AUDIT_app-v68-final.md         sha=[a74f4dc]     verdict=[DONOTSHIP]
    AUDIT_app-v68-head.md          sha=[23aedd6]     verdict=[DONOTSHIP]
    AUDIT_app-v68-remediation.md   sha=[d50e60b...]  verdict=[DONOTSHIP]
    AUDIT_app-v68.md               sha=[]            verdict=[]     <-- invisible
    PM_app-v68.md                  sha=[]            verdict=[]     <-- invisible

And end to end, the whole script, both commits, same repo:

    at 30ed35a   ./release_check.sh -> 6 refusals listed (5 audits + PM_app-v68.md)
    at 18543b7   ./release_check.sh -> 5 refusals listed (PM_app-v68.md and AUDIT_app-v68.md gone)

Why this is a blocker and not a tidy-up:

  1. **It fails open, not shut.** On the approval side an unreadable header means "cannot clear the
     gate" — safe. On the refusal side it means "does not block" — unsafe. The same rule points in
     opposite directions on the two paths and nothing in the change notices.
  2. **It hit the PM.** `PM_app-v68.md` is the only PM record for this release, and it says DO NOT
     SHIP. This release now has, as far as the gate is concerned, no PM verdict at all.
  3. **It is silent.** The reports did not move, change, or get superseded. They simply stopped
     appearing. The fifth audit warned about exactly this shape under NOTE-2 — "a way for four
     audits to vanish from the output without anyone deciding they should" — and this commit
     created a second, live instance of it.
  4. **The previous audit's own evidence said this shape was legitimate.** Its list of things that
     still parsed correctly includes "a legitimate report: title line, blank line, then the header
     -> parses correctly." That was true of the old code. The new code breaks it, and two files in
     `outputs/` are written that way.

Right now nothing has escaped: five other refusals still hold the gate shut. That is luck, not
design. Delete or supersede those five and the gate opens while two live refusals sit unread on
disk.

## MAJOR-1 — the message a de-listed report produces names the wrong cause

Claim 7 is that failure messages name the real cause. On this path it does not.

`check_report_current` answers a report it cannot parse with:

    "no AUDITED-COMMIT line in its first 12 lines"

That statement is false for both dropped files. `AUDIT_app-v68.md` has its AUDITED-COMMIT line at
line 3, comfortably inside the first 12. The real cause is "it is not the first non-blank line".
Anyone acting on the printed message would go looking at line 13 and find nothing wrong.

The stale wording is not only in the message. The comment two lines above the reader still says
"A report is read from its FIRST 12 LINES only", and `report_head()` — the function that
implemented that — is still defined at line 406 and is now called from nowhere. Dead code sitting
under a comment that describes behaviour the script no longer has.

## MAJOR-2 — the Symptoms screen can still lose every row and pass

The fifth audit's MAJOR-2 was that three tab screens could be gutted and still pass. The fix gives
each screen a specific string to look for. It works for two of the three and not for the third.

Falsified through the real suite, against a copy of the shipping index.html, at 320px:

    Reports — all eight report tiles deleted     -> COULD NOT REACH REPORTS (missing: "History")   exit 1   CAUGHT
    In-Patient — both action buttons deleted     -> COULD NOT REACH INPATIENT (missing: "In-Patient") exit 1 CAUGHT
    Symptoms — every logged symptom row deleted  -> 14 of 14 scanned, 0 problems, CLEAN            exit 0   MISSED

The needle for Symptoms is the word `Symptom`. The screen's own heading is **"Symptoms &
Reactions"**, which contains it. So the assertion is satisfied by the heading alone — which is
precisely what the code's own comment says it was written to avoid: *"assert the controls that
define the screen — a heading alone is what a broken screen also shows."* For Symptoms that
sentence is not true.

This is the same break the previous auditor ran, at the commit that claims to have fixed it, with
the same result.

## MAJOR-3 — the fixture is still not safe across midnight

Claim 4 is that anchoring the seeded treatment date to local noon means "a midnight or DST
crossing cannot fail it spuriously". Half of that is right and the important half is not.

Noon anchoring fixes the DST case: the seeded timestamp no longer sits near a day boundary, so a
clock shift cannot slide it into the previous day. Good.

It does nothing about a run crossing midnight, because that failure has a different cause. The
seed is computed once, from Node's clock, when the process starts. The browser's clock keeps
running. What matters is the number of days between the seeded day and *the day the browser thinks
it is when the screen renders* — and that number goes up by one at midnight regardless of what
time of day the seed is anchored to.

The offset is still exactly 3 days, against a medication with a 3-day window either side. Day +3
is the last day inside the window; there is no margin, which is what the fifth audit's MAJOR-3
actually asked to be fixed ("a fixture should sit in the middle of the state it needs, not on its
boundary"). Start the scan at 23:55 and the later widths compute day +4 and the run fails with
"the seeded medication is missing" while nothing is wrong with the app. The scan now walks 140
combinations instead of 60, so it runs longer and the window for this is wider than before, not
narrower.

Falsified with the real suite, against an unmodified copy of the shipping index.html. I shifted
ONLY the browser's clock, leaving the fixture exactly as the suite built it:

    browser clock moved to 23:55 today (same day)   -> 14 of 14 scanned, CLEAN            exit 0
    browser clock moved to 00:05 tomorrow           -> COULD NOT REACH HOME (missing:
                                                       "Dexamethasone"), NOT CLEAN        exit 1

Same app, same fixture, nothing wrong with either. The control run rules out my probe being the
cause. A run started before midnight still dies, exactly as it did before the fix.

## MAJOR-4 — the six new drawer screens have no content check at all

Claim 6 is that six drawer screens plus a Help-search state are "genuinely reached and genuinely
scanned — not merely counted". Reached, yes. Genuinely scanned, no.

Every one of the six drawer screens is proved open by one test: the drawer closed, and `<main>`
holds more than 60 characters. There is no specific string, no fixture, nothing. That is the exact
bar the fifth audit called insufficient — and the same commit that replaced it for the five tab
screens left it in place for the six screens it was adding.

Falsified: I stripped every control off the Settings screen, leaving the heading and one sentence.

    Settings gutted to a heading and one line -> 14 of 14 scanned, 0 problems, CLEAN     exit 0

The largest screen in the app can lose everything on it and this gate calls it scanned and clean.

## MAJOR-5 — the Help-search pass cannot tell whether it got any results

The Help-search pass exists because "opening Help lands on the category menu; typing lands on the
results list, which is a different layout entirely." Its proof that results rendered is:

    main.innerText.length > 60 && /result|answer|dose/i.test(main.innerText)

The Help screen carries a fixed safety paragraph at the top, on every state, which reads "...about
symptoms, **doses**, or how someone is feeling, contact the care team." That single word satisfies
`/dose/i` forever.

Falsified: I made Help search return nothing for every query. The screen then shows "Nothing
matched that" — a genuine zero-results state, not the results list.

    Help search returns no results  ->  14 of 14 scanned, 0 problems, CLEAN              exit 0
    (measured directly: main was 447 characters, said "Nothing matched that",
     and the pass's own guard still evaluated TRUE)

So the one thing this pass was added to look at can be entirely absent and the run still counts it
as scanned. Counted, not scanned.

## MAJOR-6 — the coverage total still drifts, in the one case where least was checked

Claim 2 is that M "cannot drift from the passes that exist". It can.

`EXTRA_COUNT` is assigned inside the per-device loop, after the tab passes. If the fixture check
fails for a device, the code bails with `unreachable += SCREENS.length` — five — and skips the
assignment. Both numbers are then wrong.

Falsified: I made the app throw away every saved medication on load — the exact start-up bug this
fixture check was built to catch.

    0 of 5 screen/width combinations scanned, 0 overflowing element(s).
    5 screen/width combination(s) COULD NOT BE REACHED and were not scanned.
    NOT CLEAN                                                                            exit 1

Fourteen passes were skipped at that width. It reports five, out of a total of five. In the healthy
case the same line correctly reads "140 of 140". So the denominator — the number a reviewer would
use to confirm coverage — silently shrinks by two thirds in precisely the situation where almost
nothing was checked.

It exits 1, so nothing false-passes. But the fix was specifically for a number that could not be
trusted as a measure of coverage, and it still cannot be.

## MAJOR-7 — the nine new passes report no reason when they fail

Claim 7 is that failure messages name the real cause. They do now, for the five tab screens: I saw
`missing: "History"`, `missing: "In-Patient"` and `missing: "Dexamethasone"`, each accurate.

The nine overlay passes — six drawer screens, Help-search, and the two med-editor modes, all but
two of them added by this commit — print:

    COULD NOT OPEN drawer:report-a-problem at 320px — not scanned

No reason. A drawer pass can return false from four different places (the menu button is missing,
the drawer row is missing, the drawer did not close, `<main>` is too short) and Help-search from
three more. All nine produce the same sentence. That is the generic message the fix was written to
replace, still in place on the passes this release added.

Verified by breaking one: I renamed the "Report a problem" drawer row, and got the line above —
true but useless.

## MINOR-1 — the app's own field help still names a label that is not in the list

Carried over from the fifth audit's MINOR-1, untouched by this commit. The helper under Days taken
still reads: *"...pick which days this one is given. "As needed" means no missed-dose alerts for
it."* For an as-needed medication that option reads **No set days**, and the only "As needed" on
screen is the Schedule type control directly above it, where it means something else.

Help is now correct about this. The app is not. The Help fix documents the inconsistency rather
than removing it.

## MINOR-2 — a refusal written in ordinary markdown style fails open in several more ways

Pre-existing, not introduced here, but it compounds BLOCKER-1: the verdict line must match exactly,
and a refusal that does not match simply stops blocking. Measured:

    VERDICT: DO NOT SHIP              -> blocks
    verdict: do not ship              -> blocks
    VERDICT: DO NOT SHIP.             -> NOT read, does not block
    VERDICT: **DO NOT SHIP**          -> NOT read, does not block
    VERDICT: DO  NOT  SHIP            -> NOT read, does not block
    VERDICT: DO-NOT-SHIP              -> NOT read, does not block

A bolded verdict is a completely ordinary thing to write in a markdown report.

## NOTE-1 — a quoted header still wins if it is the first thing in the file

The two-line quotation attack is narrowed, not closed. A file that opens by quoting another
report's header and states its own DO NOT SHIP below is still read as SHIP:

    line 1  AUDITED-COMMIT: <head sha>
    line 2  VERDICT: SHIP            <- someone else's, quoted
    line 4  AUDITED-COMMIT: <head sha>
    line 5  VERDICT: DO NOT SHIP     <- this report's own

    -> sha=[18543b7...] verdict=[SHIP]

The comment defending the fix says "anything a report quotes is necessarily below its own header."
That is an assumption about how reports are written, not something the gate enforces. Quoting the
previous verdict in an opening summary is a normal thing for an auditor to do. Closed shapes I
confirmed: a code fence at the top, an indented quote, a blockquote, and a header pushed past
line 40 all read as no verdict and fail safe.

## NOTE-2 — Reports passes with seven of its eight tiles gone

The Reports needles are `Report` and `History`. `Report` is satisfied by the screen's own "Reports"
heading; `History` does real work. Deleting all eight tiles is caught. Deleting seven and keeping
History is not: 14 of 14, CLEAN, exit 0.

---

# WHAT HELD UP — things I attacked and could not break

**The Help wording fix is complete, and I looked hard for a straggler.** I searched the whole app
for every fragment of every label this release changed, including the curly-apostrophe form that
the old string actually used (`don’t`) rather than the straight one. Zero occurrences outside
a source comment. "wait a set number of hours between doses", "remind me at specific times" and
"Every few days (for example, every other day)" appear nowhere in the app. The reverse direction is
clean too: the new Help text says the choice "reads *No set days* when the medication's Schedule
type is already *As needed*", and that is exactly what the code does
(`form.type === 'win' ? 'As needed' : 'No set days'`).

**The full render scan runs, walks everything it claims, and is clean.** At this commit:
`140 of 140 screen/width combinations scanned, 0 overflowing element(s). CLEAN`, exit 0. All
fourteen passes are genuinely reached at all ten widths — none silently skipped.

**Two of the three gutted-screen holes really are closed.** Deleting all eight report tiles and
deleting both In-Patient action buttons are both caught, by name, exit 1.

**A skipped pass does reduce the scanned count.** Every mutation that made one pass unreachable
printed "13 of 14", not "14 of 14".

**The scan's statement about the backlogged Help defect is accurate, and the defect is still real.**
Every rule in the file measures width — text against its parent's padding box, a dropdown's option
against its control, and the left/right screen edges. There is no vertical rule anywhere, so the
file is right that it cannot see this. And the defect is live. I measured it independently at this
commit: the care-team strip is **235px tall at 320px and 216px at 360px**, matching BACKLOG.md
exactly. The bottom nav starts at y=499 and the first result row starts at y=591 — the first
result is not merely clipped, it is entirely below the fold at 320px. The results-count line
("The closest 12 of 28 matches") renders at y=1662, after all twelve rows, which is the second
half of that same backlog entry. Both regressions are still there.

**All four unit suites start and print real assertion counts.** No silent exits, no gate that
cannot start.

**The gate is not simply jammed.** Every other check in release_check.sh passes at this commit; the
refusals are the only thing holding it.

---

# SUITES — every one run by me at 18543b7

    test/v67-chemo-offset.mjs       26/26 checks passed, named assertions printed    exit 0
    test/v67-inpatient-window.mjs   10/10 checks passed, named assertions printed    exit 0
    test/v67-medflag-backfill.mjs     4/4 checks passed, named assertions printed    exit 0
    test/v68-treatment-clamp.mjs    OK  PASS 28  FAIL 0, sections printed            exit 0
    test/overflow-scan.mjs          140 of 140 scanned, 0 overflowing, CLEAN         exit 0

I checked the failure this repo has been bitten by three times — a gate that cannot start looking
exactly like a gate that passes. None of the five is in that state. Each printed individually named
assertions and a real total, and I proved the render scan can go red in nine separate ways.

# ./release_check.sh — exits 1

Exact output, after the baseline notice:

    RELEASE CHECK FAILED: a chain report refuses this release, and nothing supersedes it.
       These say DO NOT SHIP:
         outputs/AUDIT_app-v68-delta.md — examined ecebc50
         outputs/AUDIT_app-v68-fifth.md — examined 30ed35a
         outputs/AUDIT_app-v68-final.md — examined a74f4dc
         outputs/AUDIT_app-v68-head.md — examined 23aedd6
         outputs/AUDIT_app-v68-remediation.md — examined d50e60b
       A refusal is cleared by re-running that stage against a LATER commit and it saying
       SHIP — not by adding another file beside it.

Correct answer. Wrong list — see BLOCKER-1. The same command at the previous commit prints six
entries, including outputs/PM_app-v68.md and outputs/AUDIT_app-v68.md.

---

# SCREENS AND STATES STILL NEVER RENDERED BY THIS SCAN

The six drawer screens close the gap the fifth audit's MAJOR-5 named: all eleven of the app's views
are now opened. That is a genuine and substantial improvement. What is still never rendered:

  - **The eight report detail screens** — History, Weight, Paracentesis, Blood pressure, Radiation,
    Cycle, Bowel movement, Appetite. The scan opens the Reports menu and never taps a tile. These
    are the densest tables in the app.
  - **The Help category screen and the Help topic answer screen.** Search results are visited; the
    two other Help layouts are not.
  - **The open drawer itself.** Every drawer pass requires the drawer to be CLOSED before it
    measures, so the menu overlay — a 320px-wide panel of labels and helper text — is never scanned.
  - **Every modal**: log-a-dose time confirm, symptom logger, appointment editor, note editor,
    daily check-in, erase-everything, upgrade sheet, backup/restore notices, the "?" info modals,
    the treatment-date calendar.
  - **The ten-step welcome tour** — deliberately suppressed by the fixture, and reasonably so, but
    it is a full-screen overlay nobody measures.
  - **First-run setup.**
  - **Home in its alternate states**: in-patient active banner, missed-dose banner, bowel-issue
    banner, a paused medication, a medication inside its gap timer, the amber "No date set" label.
  - **The second seeded medication's editor** — the scan always clicks the first Edit button.
  - **Non-default profiles**: male, and treatment type "other", "radiation" or "both".

---

# HOUSEKEEPING

Every mutation was made in a COPY of index.html in a scratch directory outside the repository and
fed to a copy of the suite with its `--file` flag. index.html, release_check.sh and
test/overflow-scan.mjs were never edited. Gate probes ran against functions lifted verbatim out of
the script, and the one whole-script comparison used a throwaway git worktree that has been
removed. `git status` shows exactly one addition: this report. Nothing committed, nothing pushed.
/home/user/care-tracker untouched.

---

# VERDICT

DO NOT SHIP.

One blocker, seven majors, two minors, two notes.

**What actually blocks:** BLOCKER-1. The gate quietly stopped reading two standing refusals,
including the PM's. That is a safety net getting a hole cut in it by the commit that was meant to
patch it, and it is a two-line fix — accept a header that follows a title line, and print a warning
for any chain report the reader cannot parse instead of skipping it in silence.

**What is honestly not a beta-stopper for an app only Aaron uses**, and should be logged for the
next release: MAJOR-2 through MAJOR-7 all concern the scan's own thoroughness, not the app. The
app itself is clean at 140 combinations, and this release's user-facing change — the Help wording —
is correct and complete. MINOR-1 (the field helper naming a label that is not in the list in
as-needed mode) is a real user-facing wrinkle, but a small one, and it is the same one the last
audit logged.

**What should be kept exactly as it is:** the Help fix, the six drawer screens, the reasons on the
tab-screen failures, and the honest paragraph in the scan admitting it cannot see the vertical Help
defect. That paragraph is accurate, I verified the defect independently, and writing down what a
gate cannot do is worth more than another green tick.

This is the sixth DO NOT SHIP in a row, and I want to be plain about the shape of it: five of the
seven majors are in the test harness, not the product. The app is in better shape than the gate
around it. The one thing that genuinely must not ship is a release gate that has learned to look
away.
