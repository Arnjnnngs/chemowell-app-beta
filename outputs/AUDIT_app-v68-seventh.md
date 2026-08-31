# Zero Day Audit — app-v68, seventh pass

AUDITED-COMMIT: b330402
VERDICT: SHIP

HEADLINE, in plain words.

The app is right. The machine that checks the app is not, and this round those are two
different answers.

I attacked the product hard: the treatment-window rules, the treatment-date clearing, the
dropdown wording, the Help text, the medication editor, and how every screen draws at ten
phone widths. It holds up. Every suite is green, the render scan is clean at all ten widths
with no errors in the browser console, and the two things this release actually changed for
Aaron — the dropdown labels and the Help wording that describes them — now say the same thing
as each other and as the code.

I also attacked the checking machinery, and found four real problems in it. The worst one is
new, introduced by the very commit that was meant to fix the last round's worst one: a report
that says DO NOT SHIP can again be read as SHIP, and when that happens it does not merely go
unnoticed — it wipes seven other standing refusals off the screen. I proved it, and I have a
one-line fix that I tested.

None of that harms Aaron's use of the app. The gate defect is a defect in the gate. Every
product statement in this report was checked by me directly — by running the code, not by
reading the gate's verdict — so the product conclusion does not lean on the broken part.

So: ship the app, fix the gate, and log the rest. Six rounds of holding a correct beta has a
cost of its own, and it has now been paid twice over.

One thing to be clear about, because it will look like a contradiction: the release script
will STILL refuse this release after my SHIP, and that is correct. An Auditor's approval
cannot answer the PM's refusal — a different desk has to sign. That rule is working.

---

WHAT WAS IN SCOPE

The change under review, 18543b7..b330402, touches three files: the sixth audit's own report,
release_check.sh, and test/overflow-scan.mjs. The product has not been touched for two rounds
— index.html and sw.js were last changed at 18543b7. That is worth stating plainly: for two
consecutive audits the thing being held back has not changed, and only the gate around it has.

---

Q1. IS THE SHIPPING PRODUCT CORRECT?

Broadly, yes. Here is what I checked and how.

SUITES — all four run, all four start properly, all four print real counts:

    v67-chemo-offset      26 / 26 passed
    v67-inpatient-window  10 / 10 passed
    v67-medflag-backfill   4 / 4  passed
    v68-treatment-clamp   28 / 28 passed   (PASS 28, FAIL 0)

RENDER SCAN — 14 passes across 10 device widths:

    140 of 140 screen/width combinations scanned, 0 overflowing element(s).  CLEAN
    0 page errors, 0 console warnings, 0 blocked outbound requests.  Exit 0.

THE CHANGE ITSELF. I read every hunk between the last published build and this one, and
re-derived the important ones in a sandbox rather than trusting the comments:

  - The shared day clamp is genuinely shared. The save path, the editor, the chips and the
    code that evaluates the window all call it, so the number on screen is the number obeyed.
    Text input coercion works ("3" is 3, not 1); blank falls back to 1 and not to a deliberate
    0; 300 caps at 14 in one place instead of two.
  - Clearing a treatment date works for every sequence a person can actually produce: set /
    clear, set / clear / set, set / set / clear. Verified in a VM against the real functions.
  - The Zofran block and the treatment-day window now measure against EVERY recorded treatment
    rather than the nearest one. I checked the reasoning holds and it does: for a symmetric
    window "nearest" and "any" are mathematically the same answer, so nothing regressed; for
    an asymmetric one — which Zofran's day-0-to-day-2 block is — "any" is the correct answer
    and "nearest" was wrong. This is a real fix, not a shuffle.
  - Dexamethasone still asks the "nearest" question, and that is safe for the same reason: its
    window is symmetric.
  - The two dropdown labels shortened in this release ("As needed", "Every few days") appear
    nowhere else in their old long form except inside explanatory comments, and the two Help
    topics that describe them now match the code's own conditional exactly, including the
    detail that the same choice reads "No set days" in the other schedule mode. The fifth
    audit's finding — a renamed control with Help still naming the old one — is closed.

FINDINGS

PRODUCT — MAJOR — "Update" does not replace the treatment date, and Help says it does.
  ALREADY LIVE IN v67. NOT INTRODUCED BY THIS RELEASE. NOT A REASON TO HOLD IT.
  The Treatment schedule card shows one date and its button reads "Update". The Help topic
  "I need to change or remove the treatment date" opens with "Setting a new date replaces the
  old one." Neither is true. Setting a date APPENDS one, and every treatment rule in the app
  honours all of them. Proved in a sandbox against the real functions: with a mistyped Aug 20
  corrected to Aug 24 by tapping Update, the app still blocks Zofran on Aug 21 and Aug 22, and
  still expects Dexamethasone on Aug 19, 20 and 21 — all measured from the date the caregiver
  believes they replaced. The only way to actually remove it is Clear, which wipes everything.
  I ran the identical probe against the published v67 build and got the same result, so this
  is standing behaviour and not a regression. It belongs in the backlog with a real fix (either
  make Update write a tombstone first, or say honestly in Help that dates accumulate).

PRODUCT — MINOR — two functions disagree about how to order treatment records.
  Latent, and not reachable through any path in this app today. nextChemoTs() sorts records by
  "loggedAt", while chemoDayList() sorts by "loggedAt, or failing that the treatment date".
  For a record with no loggedAt and a treatment date in the future, those give opposite
  answers: the app reports the date as cleared while still obeying it — exactly the split-brain
  this hotfix exists to close. Every write path in this app stamps loggedAt, including the
  first commit, so nothing here can produce such a record; a hand-edited or foreign backup file
  restored through Backup & restore could. Worth making the two agree while the code is fresh.

PRODUCT — MINOR — dead code added this release, with a comment that misleads.
  chemoOffsetSinceLast() was added in this change and is never called (one occurrence in the
  file: its own declaration). Its comment reads as though the Zofran block depends on it. The
  Zofran block does not — it does the same arithmetic inline. The next person to change Zofran
  will read the wrong function.

PRODUCT — NOTE — the day clamp accepts two values it should probably refuse.
  clampTreatmentDays([]) and clampTreatmentDays(false) both return 0, which the app reads as a
  deliberate "treatment day itself only". Neither can arrive from a text input. Noted, not
  urgent.

---

Q2. IS THE HARNESS HONEST ABOUT WHAT IT CHECKED?

Partly. Four of the sixth round's fixes hold. Three do not, and one of those made things worse
than before it was written.

WHAT HOLDS, each broken on purpose and watched go red:

  - Both refusals that had silently vanished are read again. The gate now prints eight, up
    from six: the six -delta/-remediation/-head/-final/-fifth/-sixth reports plus the two that
    disappeared last round. Confirmed against the previous gate side by side.
  - An unreadable report blocks loudly instead of being skipped. I made reports unreadable in
    three new ways — a UTF-8 byte-order mark before the header, a title underlined with "===",
    and a Unicode look-alike colon — and each was named and refused, by name, with an
    explanation of the required shape. A report with Windows line endings is read correctly.
  - The plain quoting attacks still fail. A report that quotes someone else's approval above
    its own refusal, in ordinary prose or as a blockquote, is refused as unreadable.
  - The seeding really is anchored to local noon, and the suite is stable across midnight. I
    moved the clock to 23:39 local and to 00:39 local on the other side of the boundary and ran
    the whole suite at both: 140 of 140, clean, exit 0, both times.
  - The drawer screens' content check can fail and names the real cause. I stripped Settings to
    its heading plus filler in the app's own source: exit 1, "COULD NOT OPEN drawer:settings at
    360px — not scanned (missing: "PROFILES")" at all ten widths. That is the check I intended,
    firing for the reason I intended.

HARNESS — MAJOR — THE QUOTING ATTACK IS BACK, AND IT NOW ERASES REAL REFUSALS.
  This is a regression introduced by the commit under review.
  Allowing a markdown title above the header was done by discarding every line beginning with
  "#" in the first forty lines — not just a leading title. So a heading can be used to hide the
  sentence that introduces a quotation. A report shaped like this, whose OWN stated verdict is
  DO NOT SHIP:

        # Title
        (blank)
        # The previous gate output read:
        (blank)
        <a quoted commit line naming this HEAD>
        <a quoted verdict line reading SHIP>
        (blank)
        ## My own finding
        (blank)
        <this report's real commit line>
        <this report's real verdict line, reading DO NOT SHIP>

  ...is read by the gate as an approval of this HEAD. And because an approval naming a later
  commit supersedes earlier refusals, that misreading did not merely lose one report — it
  erased SEVEN standing DO NOT SHIP reports from the gate's output, leaving two. The identical
  file placed beside the PREVIOUS version of the gate changed nothing at all: it was skipped.
  So the change traded "a real refusal is invisible" for "a crafted or unlucky file cancels
  every real refusal", which is strictly worse in the direction that matters.
  This is not far-fetched in this project. Every one of these audits quotes the previous one,
  and quoting a header pair under a section heading is a natural thing to write.
  COST: a broken future release could be waved through by the gate. It cannot harm the app.
  FIX, written and tested: allow at most ONE heading line, and only at the very top —

        report_pair() {
          head -40 "$1" 2>/dev/null | awk 'NR==1 && /^[[:space:]]*#/ {next} /^[[:space:]]*$/ {next} {print}' | head -2 || true
        }

  With that one line in place I re-ran both attacks: each is refused as unreadable and named,
  and all nine current reports — including the two that had vanished — are still read
  correctly. Two minutes of work.

HARNESS — MAJOR — two of the six drawer needles are the screen's own title.
  The comment in the scan says every needle "was read off the running screen and sits BELOW the
  heading, so a page stripped to its title cannot satisfy it." That is false for two of six.
  "Find and fix a problem" is the subtitle argument passed to the Help screen's own page header.
  "Errors and ideas" is literally the <h1> of the Report a problem screen.
  Proved, not argued: I edited the app so the Report a problem screen renders its heading and
  one line of filler and nothing else — no controls, no log rows, no body at all — and the scan
  reported "140 of 140 screen/width combinations scanned, 0 overflowing element(s). CLEAN" and
  exited 0, with no page errors and no console warnings. For those two screens the check is
  still the 60-character floor, which is exactly the bar the sixth round said it was replacing.
  The other four drawer needles (CURRENT PLAN, Appointments, A day-by-day journal, PROFILES) do
  sit below the heading and do catch a stripped screen.
  One more, smaller: on the Reports tab the needle "Report" is a substring of that screen's own
  heading "Reports", so it is decorative — but its companion needle "History" is real, and
  because every needle in the list must be present, that pass is still properly guarded.
  COST: two of eleven screens could lose their entire contents without this gate noticing.

HARNESS — MAJOR — the Help-search check still cannot tell whether it got results.
  The guard was changed from "the word dose appears" to "the words nothing matched do NOT
  appear". Both are satisfied by a screen that never searched anything. Measured on the running
  app: the Help category menu, before a single key is typed, is 1515 characters long and
  contains no no-result phrase — so it passes all three conditions the guard applies.
  Proved: I disabled the search in the app's source so typing does nothing and the category
  menu stays on screen. The scan reported 140 of 140 scanned, CLEAN, and exited 0 — happily
  measuring the Help menu twice while claiming to have scanned the results list.
  This is the specific thing the brief asked me to hunt for: a guard that a persistent element
  satisfies. Here the persistent thing is a whole screen rather than an element.
  A positive check is needed — assert that a known result title is on screen, or that the
  results container has at least one row.
  COST: the one screen with a MEASURED open layout defect on record is the one this pass is
  least able to confirm it ever visited.

HARNESS — MINOR — the two medication-editor passes report no cause at all.
  The claim was that failure messages name the real cause on every path, including the nine
  overlay passes. Six of nine do. The Help-search pass does for its content check. The two
  med-editor passes do not: four distinct failures (no Meds tab, no Edit button, no Add button,
  the editor did not render) all collapse into one sentence. Proved by removing the editor's
  data hook: exit 1 correctly, but the message for both passes is only "the screen could not be
  opened".

HARNESS — MINOR — the scan prints "every screen clean" when it scanned nothing.
  During an earlier sabotage the app failed to parse. The fixture failed at all ten widths, ten
  page errors were logged, and the suite still printed the line "every screen clean at all 10
  device widths (iOS and Android)" before its NOT CLEAN verdict. It also printed "0 of 50"
  rather than 0 of 140, because the overlay count is only set inside the loop that had already
  bailed — so the gate's own report of what it covered understated its own scope by nine tenths.
  The exit code was correct (1). The words were not.

HARNESS — MINOR — the gate's rejection message points at the wrong lines.
  A report that fails to parse is told "no AUDITED-COMMIT line in its first 12 lines". The
  reader actually looks at the first 40 lines and takes the first two after any leading heading
  or blank lines. A person debugging a rejection would look in the wrong place. Related: the
  report_head() helper (head -12) is now defined and never called.

HARNESS — NOTE — the unreadable check blocks on ANY matching file.
  It walks everything matching the audit and PM name patterns for this version. A screenshot, a
  log, or a stray text file dropped in that directory with a matching name would stop the
  release with a message about report headers. Failing loud is right; this particular loud
  failure would be confusing.

---

WHAT ./release_check.sh SAYS RIGHT NOW, exactly

    Baseline: PUBLISHED.json -> app-v67 (chemowell-app-v67-1) at 283b016
    9 commit(s) have changed index.html since that record.
    RELEASE CHECK FAILED: a chain report refuses this release, and nothing supersedes it.
    These say DO NOT SHIP:
      AUDIT_app-v68-delta.md, -fifth.md, -final.md, -head.md, -remediation.md, -sixth.md,
      AUDIT_app-v68.md, PM_app-v68.md
    exit 1

Eight reports read, both of the ones that had vanished among them. That part of the fix is
real and I confirmed it by running the previous version of the gate side by side, which sees
only six.

---

RECOMMENDATION

SHIP THIS BETA, with the harness gaps logged. Here is exactly what I am and am not asserting.

I am asserting that nothing I found would harm Aaron's use of the app. The one genuine product
complaint — that Update does not really replace a treatment date — is already live in the
build on his phone, behaves identically there, and is not made worse by this release. The rest
of what this release changed is correct, and I checked it by running it rather than by reading
about it.

I am NOT asserting that the gate is trustworthy. It is not, on one specific point, and that
point is new. A report that refuses a release can again be read as approving it, and the
misreading cancels other refusals rather than being ignored. That must be fixed before anyone
relies on this script to authorise anything. The fix is one line and I have already tested it.

The reason those two answers can differ is that no product claim in this report depends on the
gate. I re-ran every suite myself, probed the real functions in a sandbox, measured the real
screens in a real browser, and ran the render scan four extra times with deliberate damage in
it to see what it would and would not catch. Where the harness could not be trusted, I did not
trust it — I measured instead.

Holding a correct beta for a seventh round because the machinery around it has bugs would be
the wrong trade. The gate's problems are worth fixing this week; they are not worth another
week of Aaron not having the fix.

Order of work I would suggest: the one-line gate fix first, because it takes two minutes and it
restores a property three previous audits paid for. Then the two title-needles and the
Help-search guard, which are the difference between a render gate that covers eleven screens
and one that covers nine. The product items go in the backlog, with "Update does not replace"
at the top of it.

---

POSTSCRIPT — what the gate did with this report, checked after writing it

I ran ./release_check.sh once more with this file in place. It read the header correctly, and
this approval superseded the seven earlier Auditor refusals — same stage, later commit, which
is the rule working as designed. One refusal remains standing and the release is still held:

    RELEASE CHECK FAILED: a chain report refuses this release, and nothing supersedes it.
    These say DO NOT SHIP:
      outputs/PM_app-v68.md — examined 51ba75f
    exit 1

That is correct and I want it on the record. An Auditor cannot sign off a PM's refusal. The
next step is the PM stage looking again at this commit, not another file placed beside it.

HOUSEKEEPING

Nothing was committed or pushed. Every sabotage was performed on copies outside the repository
and the app was driven with the suite's --file switch, so no tracked file was ever edited.
Verified after the fact: git status shows only this report as new, git diff against HEAD is
empty, and index.html, release_check.sh and test/overflow-scan.mjs each match HEAD byte for
byte by checksum. The care-tracker project was not touched.
