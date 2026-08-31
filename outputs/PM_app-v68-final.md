# PM Gate — app-v68, final ruling (chemowell-app-beta)

AUDITED-COMMIT: 1a0851d
VERDICT: SHIP

## The decision, and why

**Ship app-v68.** The refusal I am revisiting was procedural — it held the release because the code
that would ship had never been looked at by an auditor — and that reason is gone: seven independent
adversarial passes now cover every commit of the product, the product itself has not changed for
three rounds, and the one real defect my predecessor found in the unaudited half is fixed and pinned
by a test I broke on purpose and watched go red.

Everything still imperfect is either **in the machinery that checks the app**, which Aaron never
sees, or **behaviour already live on his phone in app-v67**, which this release does not make worse.
Neither is a reason to hold a correct beta for an eighth round.

---

## 1. The original PM refusal, objection by objection

The refusal in `outputs/PM_app-v68.md` (examined 51ba75f) raised one ruling and five numbered
findings. Here is each one against the current head.

### The ruling itself — "the code that would ship has never been audited". **RESOLVED.**

That was the whole basis of the hold. Since then: seven Zero Day Audits, six of which said DO NOT
SHIP and every one of which found something real. The product files stopped moving three rounds ago
— `index.html` was last changed at `18543b7`, `sw.js` at `51ba75f` — and both the sixth audit (which
examined `18543b7` itself) and the seventh have gone over the product at or after that point. The two render changes my
predecessor singled out as never having been looked at on a screen are now walked by a browser at
ten phone widths.

### PM-1 (MAJOR) — the treatment-window clamp was applied at one place only, so the editor lied. **FIXED.**

There is now exactly one rule, and every path calls it: the save path, the normalise path, the
editor's own chip, and the code that decides whether a medication is offered. I checked all six call
sites and then broke the rule — removed its upper bound — and watched two separate suites go red
(5 failures and 1 failure). The number on screen is now the number the app obeys.

I also confirmed the deeper half of that objection, which was that a window typed as text was being
destroyed before the fix could see it. It is not any more: `"3"` is honoured as 3, and the suite has
a named check that fails if anyone puts the old test back.

### PM-2 (MAJOR, process) — the Scribe pass, and the deferred findings with nowhere to live. **NOT DONE. I am releasing this requirement, deliberately.**

`BACKLOG.md` has not been touched on this branch. The wrong sentence at `BACKLOG.md:119` still
stands. My predecessor made this a condition of merge. I am removing that condition, and I want the
reason on the record rather than buried: a backlog file is a filing job, not a safety gate, and
holding a correct beta over it would cost more than it protects. It is now the first thing after the
push, and section 5 lists exactly what has to be written down so nothing is lost.

The README half of Scribe's job *is* done, and done properly — the false "string-blind" claim is
corrected inside the version-history row itself, which is the row the release script reads, and the
arithmetic slip that came with the correction has been fixed too. I read the row rather than the
commit message.

### PM-3 (MINOR) — "no layout change" was not an accurate description, and nothing had been rendered. **RESOLVED, and it was a good objection.**

There is now a real render gate. I ran it in full: **140 of 140 screen and width combinations
scanned, 0 overflowing elements, 0 errors in the browser, CLEAN, exit 0.**

And the objection earned its keep. Following it up, I rendered the app in the one state nobody had
ever rendered — a hospital stay in progress — and found a real defect. See section 3.

### PM-4 (MAJOR) — the gate could not tell a stale audit from a current one. **FIXED, and I attacked it.**

The gate now reads each report's declared commit, insists that commit is genuinely in this branch's
history, reads the verdict, refuses a file too thin to be a report, and refuses to let one desk sign
off another desk's refusal. I proved all of that from both sides. Details in section 2.

### PM-5 (MINOR) — six screenshots riding along in a hotfix. **STILL TRUE. Accepted, and I found the cause.**

Six PNGs under `outputs/` still differ by a few bytes. I now know why: running the full test suite
rewrites them, so anybody who runs the tests before committing sweeps them in. It happened to me
during this review and I put them back. Harmless, cosmetic, not worth a round — but the fix is to
stop the suites writing into a committed directory.

### The leftovers from my predecessor's claim-by-claim review

- **The silent death in the release script when `PUBLISHED.json` is tampered with.** Fixed — that
  line is now guarded and falls back to "none" instead of killing the script without a word.
- **The other silent exit.** Still open. Write `APP_VERSION` with double quotes instead of single
  and the release script exits 1 having printed nothing about why. It fails *closed*, so nothing
  unsafe gets out, but it has now survived four rounds and it is a one-line fix.

---

## 2. Did the seventh audit earn its SHIP? I spot-checked the three things that would matter most.

I did not re-run the seventh audit. I picked the claims where being wrong would actually hurt
someone and tested those myself, by breaking the app and watching the checks fail.

**(a) Does "Clear" really clear a treatment date?** This is the whole reason the branch exists. I put
the original bug back — the filter that threw away the "cleared" marker and kept the date it was
meant to erase — and the suite went red on four named checks, including *"a cleared treatment date is
really gone"* and *"Zofran is not blocked against a date that was cleared."* The fix is real and the
check behind it can fail.

**(b) Is a medication the care team said to avoid near treatment now correctly withheld?** This was
the worst finding in the whole record. I rewrote the rule back to asking only the *nearest*
treatment date and the suite went red on *"an EXCLUDED medication is therefore withheld on that day
too, not offered."* Same for the Zofran block: red on *"Zofran is blocked across BOTH treatments,
not just the nearer one."* Both directions of that defect are now guarded.

**(c) Does the app say the same thing as its own Help pages?** This was the fifth audit's blocker —
a dropdown option renamed in the app and left un-renamed in Help. I searched the whole file: the old
wording survives only inside two source comments, and both Help topics now spell out the detail that
the same choice reads *"No set days"* in the other mode, which is exactly what the code does. Closed.

**Three of the four claimed fixes in the newest commit, verified in both directions.** The new rule
is that a report must contain exactly one header written flush left. I built the attack that beat the
*previous* version of the gate — a report whose own verdict is DO NOT SHIP, with someone else's
approval quoted under a heading above it — and ran it against both. Against the old gate it printed
**"Release check passed", exit 0**, while listing eight real refusals directly above. Against the
current gate it is **refused by name, exit 1.** Nine legitimate reports still parse correctly, a
thick approval at the head commit still opens the gate, and a two-line placeholder still does not.

**The two replaced screen checks and the search check all bite.** I renamed the string each one looks
for and ran the scanner: `missing: "Common questions"`, `missing: "An idea"`, and *"the results view
did not render (no Clear control)"* — each naming the real cause, each exit 1. I also confirmed the
two strings they replaced really were the screens' own headings, which is what made the old checks
worthless. The fourth claim — a coverage number that used to shrink by two thirds when things went
wrong — is fixed: a run where the fixture fails now reports "0 of 14", not "0 of 5".

**What I could not make fail:** nothing I attacked. Every check I aimed at went red when it should
have. The only thing I could not falsify is the claim that the render scan proves anything about
Safari — it is Chromium at iPhone sizes, which the file says plainly itself.

---

## 3. What I found that nobody else did

**At 320px, with a hospital stay active, the app scrolls sideways.** On Home, the stay banner's
**"Log In-Patient End"** button is 167px wide and refuses to shrink, which pushes the page to 324px
on a 320px screen. Measured, reproducible, and the whole page slides 4px. It is at `index.html:4484`
and the fix is to let that button shrink or shorten its label. I measured five widths: it happens at
320px and nowhere else — 330, 345, 360 and 375 are all clean — so it is the iPhone SE and the mini.

**It is already live in app-v67 and this release does not touch it.** I ran the identical measurement
against the published build and got byte-identical numbers, so it is not a regression and not a
reason to hold. It goes at the top of the backlog.

**Why nobody found it:** the render scan never seeds a hospital stay, so that entire state — banner,
buttons, and the two medication-card changes this release actually made — has never been rendered by
any gate. That is the real gap, and my predecessor was pointing straight at it. A related note: the
scan's In-Patient check looks for *"Log In-Patient Start"*, which is not on screen during a stay, so
the scan would report that screen unreachable if Aaron ever had one running.

---

## 4. What I accept as known-imperfect

- **A backlog file that has not been written.** Section 5.
- **Six stray screenshots** in a hotfix branch.
- **The release script still dies silently** if `APP_VERSION` is written with the wrong quotes.
- **Three cosmetic-but-misleading things in the harness.** When the fixture fails, the scan still
  prints "every screen clean" before its NOT CLEAN verdict, and it under-counts the screens it
  skipped by nine. The gate's rejection message still tells you to look at "the first 12 lines",
  which is no longer the rule, and a helper function it used to describe is dead code.
- **Two product wrinkles carried forward.** A function added this release, `chemoOffsetSinceLast`,
  is never called and its comment reads as though the Zofran block depends on it — the next person
  to touch Zofran will read the wrong code. And the little grey line under "Days taken" names an
  option that reads differently in the other mode.
- **The newest commit has no auditor on it.** It changes only the release script, the render scanner
  and a report file — nothing that reaches Aaron's phone. I verified all four of its claims myself
  and falsified three of them in both directions, which is proportionate for a harness-only change.
  I am not pretending it was audited.
- **This is Chromium, not Safari.** A clean render run narrows the search; it does not clear iOS.

---

## 5. What goes first in the next release

1. **The gate's two-minute cleanup** — correct the "first 12 lines" message and delete the dead
   helper. It has survived three rounds because it is small.
2. **Seed a hospital stay in the render scan, and fix the 320px overflow it exposes.** One real
   defect is already sitting there, and the two medication-card changes this release made in that
   state are still unrendered.
3. **"Update" does not replace a treatment date — it adds one, and Help says otherwise.** The
   highest-value item on the product side. Either make Update clear first, or tell the truth in Help.
4. **The Scribe pass.** Into `BACKLOG.md`: the 320px in-patient overflow; the Update-appends
   problem; the dead `chemoOffsetSinceLast`; the "Days taken" helper wording; the harness gaps
   above; and a correction to line 119, which currently gives the wrong reason for a failing suite.
5. **Run `./mark_published.sh <the pushed commit>` immediately after the push.** The record still
   points at app-v67, and every future comparison is against the wrong build until it is updated.

---

## 6. Release gate — exact output before this report existed

    ℹ️  Baseline: PUBLISHED.json -> app-v67 (chemowell-app-v67-1) at 283b016
       9 commit(s) have changed index.html since that record. This gate assumes NONE of
       them are live yet. If any were already pushed, run ./mark_published.sh <that commit>
       first -- otherwise the comparison below is against the wrong build.
    ❌ RELEASE CHECK FAILED: a chain report refuses this release, and nothing supersedes it.
       These say DO NOT SHIP:
         outputs/PM_app-v68.md — examined 51ba75f
       A refusal is cleared by re-running that stage against a LATER commit and it saying
       SHIP — not by adding another file beside it.
    EXIT=1

That is correct and it names exactly one thing: my predecessor's refusal. This report is the PM stage
looking again at a later commit, which is the only thing that answers it. `APP_VERSION = 'app-v68'`
and `sw.js` cache `chemowell-app-v68-1` agree, and the README row names that same cache key.

---

## 7. Suites — every number below is from my own run

    test/v67-chemo-offset.mjs        26/26 checks passed, named assertions printed   exit 0
    test/v67-inpatient-window.mjs    10/10 checks passed, named assertions printed   exit 0
    test/v67-medflag-backfill.mjs      4/4 checks passed, named assertions printed   exit 0
    test/v68-treatment-clamp.mjs     PASS 28  FAIL 0, sections printed               exit 0
    test/overflow-scan.mjs           140 of 140 scanned, 0 overflowing, 0 page
                                     errors, 0 console warnings, CLEAN               exit 0

Every one started properly and printed individually named assertions with a real total — I checked
for the failure this project has been bitten by repeatedly, where a suite that cannot start looks
exactly like a suite that passes. None is in that state, and I made four of the five go red on
purpose.

One correction to the brief I was given: only the render scan refuses to run with a proxy set. The
four unit suites read the file directly and are unaffected — I confirmed that by running each one
with `HTTPS_PROXY` deliberately set.

I also ran the whole repository, every suite, start to finish:

    PASS 19   FAIL 5   COULD-NOT-START 1
      failing:      audit-v55  pm-v55  pm-v55b  v55-help  v57-browser-notice
      cannot start: audit-v55b

**No new reds.** These are the same five suites and the same could-not-start my predecessor recorded,
and I read each failure line rather than assuming. Three are counting a number of help topics that a
later release legitimately changed (135 against a hardcoded 133). One pins wording that app-v67
deliberately rewrote. One is the Help-search layout regression that has been open for nine releases
and is already in the backlog — and it is worth noting that the render scan says out loud, in its own
comments, that it cannot see that defect because the defect is vertical and every rule in the scan
measures width. That honesty checks out: the scan is clean and the suite that can see it is red, and
they are both telling the truth.

The two extra passes versus the earlier count are the render scan and the treatment-clamp suite,
which did not exist then.

---

## 8. Housekeeping

Every mutation was made on copies outside the repository and fed to the suites with their `--file`
switch; gate attacks ran in a throwaway clone. `index.html` was never edited. `git status` shows only
this report. Nothing was committed or pushed. `/home/user/care-tracker` was not touched.

*PM gate, 2026-08-31. Seven rounds is enough for a beta only Aaron uses. The app is right; the
machinery around it is better than it was and still has work in it. That work is scheduled, not
skipped.*
