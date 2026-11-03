AUDITED-COMMIT: 020fc730cca8a25f8c80eac869ee53521e279d19
VERDICT: SHIP

# PM SIGN-OFF — ChemoWell app-v92

Stage 5 of the Quality Chain, and the last internal gate before this reaches Aaron. I did not
build any of this and I did not take the builder's or the auditors' word for anything I could run
or read myself. Every number below I reproduced.

---

## FOR AARON — what this is, in plain words

Three things you could not read on your phone are fixed, and nothing else changed.

1. **A long medication name printed straight across the time and the dose.** On a small phone a
   name like Hydroxychloroquine ran over the top of "8:00 AM" and "200 mg", so the time of a dose
   and the dose itself were both unreadable. The name now wraps onto its own line and the time
   holds its place.
2. **The floating Back button covered the last line of every report.** When you scrolled to the
   bottom of a report the bottom of the last row of text ran underneath the dark Back pill, and
   there was no scroll left to move it out from under. The page now leaves room for the button.
3. **Text that was too faint to read.** This is the one you reported from the History screen. The
   background was too close in shade to the writing on top of it — measured across eight screens,
   56 of 309 pieces of text were below the readable standard, the worst more than twice as faint
   as it should be. The background is lifted and the text is deepened. Nothing is below the
   standard now. It is still warm, still neither white nor black, which is what you asked for.
   On top of that, a paused medication's row was being dimmed so far it was unreadable; it is
   dimmed less now.

This one release carries three updates. Two earlier ones were built and never published, so when
this goes out your phone jumps three versions at once. The app knows that and will tell you there
are two earlier updates waiting under "See recent updates" — I checked that it actually says so
rather than quietly showing you one card and hiding the rest.

**One thing you may want to look at and decide.** On the very smallest phone screen only, and only
on a row that is both unscheduled and skipped, the little status label now breaks a word in half —
it reads NOT / SCHEDUL / ED. It is ugly. It is not a mistake and it is not a step backwards: before
this release that same label ran out of its column and over the Remove button, which is worse. The
clean fix is to shrink the Remove button to an icon on narrow screens, which would give the label
room to sit on one line. That changes a button you tap, so it is your call and not mine to make.
I looked at the before and after pictures myself rather than taking the description on trust.

**Nothing here has been pushed to the live app.** See the next section.

---

## THIS RELEASE HAS NOT BEEN PUSHED TO `main`, AND MUST NOT BE

This sign-off means the work is **ready for Aaron to decide**, not that it ships. The branch is
`claude/caretracker-team-review-i83ik2`. It has not been merged or pushed to `main` and no one may
push it there until Aaron says so in his own words, in the moment. A green gate is permission to
ask him, not permission to deploy.

Separately, and not negotiable: **`care-tracker` is closed.** Nothing in this release goes near it,
no fix here is ported back to it, and I did not clone, open, scan or run anything against it.
RULE 0.0 observed.

---

## What I verified myself, independently

**Identity of what I am signing.** HEAD is `020fc730cca8a25f8c80eac869ee53521e279d19` on
`claude/caretracker-team-review-i83ik2`. `index.html` md5 `e62bc8df843735237b57ecce8460ed62`,
`sw.js` md5 `4151f4e2a332e922c1587062a688c061`. Working tree clean; branch level with its remote.

**Version mechanics agree.** `APP_VERSION = 'app-v92'`, `sw.js` CACHE `chemowell-app-v92-1`, and
the changelog's newest entry is `app-v92`. All three move together, which is the one thing this
gate was originally built to make impossible to forget.

**The changelog obeys Rule 0.9.** Title "Clearer on a small phone" — five words. Three bullets.
Sixty-two words total, against a target of seventy. No mechanism, no version numbers, no function
names, nothing a patient does not need. Each of the three bullets maps to a real change in this
release, which I checked rather than assumed — including the third: the paused row's opacity goes
from 0.65 to 0.8 in the app-v92 commits, not in an earlier one.

**The audit trail holds, and this was the check most worth doing.** Three audits exist for
app-v92. The first two refuse it: `AUDIT-app-v92.md` at `f6df061`, `AUDIT-app-v92-delta.md` at
`217f999`, both DO NOT SHIP. The third, `AUDIT-app-v92-delta2.md` at `36cc61b`, says SHIP. I
confirmed by ancestry, not by date order, that `36cc61b` is a strict descendant of both refusals
and an ancestor of HEAD — so somebody genuinely looked again after the objections, which is the
rule the gate enforces. Better than that: `index.html` and `sw.js` at `36cc61b` are byte-identical
to HEAD (`77097119...` and `9dace362...`), so the approving auditor examined the exact code that
would ship, not an approximation of it.

**The two commits after the SHIP audit are safe.** One adds the audit report. The other changes
`BACKLOG.md`, two falsification corpora, a probe, two reports and `release_check.sh` — no app code,
which is why the audit stays current. I read the gate change rather than trusting the commit
message, because a builder editing the gate after the auditor has signed off is exactly the move
that needs a second pair of eyes. It makes the gate's failure summary say "NOT the complete list"
when a suite failed to parse. It strengthens the gate's honesty and weakens no check.

**Every chain seat produced a report for this version**: developer brief, Enhancer, two Designer
passes, three audits, and this sign-off.

**The three fixes are in `index.html` itself, not merely discussed in `outputs/`.** This is the
job nobody else on this chain has, and I checked each one in the shipping file:

* Fix 1 — the time cell carries `flexShrink: '0'` at all three sites that draw a time in a row
  (Home timeline, History list, missed-dose row), with `minWidth` demoted to a column-alignment
  floor; the name is wrapped in a span with `minWidth: '0'` so it can shrink and wrap instead.
* Fix 2 — `BACK_PILL_BOTTOM` (88), `BACK_PILL_H` (42) and `BACK_PILL_GAP` (8) now sit together and
  both the pill and the page's bottom padding are derived from them. The page reserves 138px when
  the pill is showing and 90px when it is not, instead of a flat 90px against a pill whose top
  edge sits 130px up. The two literals that had to agree and did not are now one number.
* Fix 3 — the paused and treatment-excluded rows go from `opacity: 0.65` to `0.8`, and the Resume
  button takes `#6A4433` at that one site.

**Four specific README claims spot-checked against the file, because the last two audits both
caught the records asserting properties the code did not have.** All four hold: `toastNeedsLift()`
is genuinely renamed to `backPillShowing()` with the old name kept as a delegating caller; the
badge fix really is at all three row sites, including the missed-dose row whose badge is the bare
word "Missed"; `#6D5247` really is used in twelve other live places (fourteen lines, two of them
comments), so "changing it everywhere is a palette release rather than this one" is accurate; and
`release_check.sh` really does run `node --check` over every suite before the long loop.

---

## The deferred items — I checked each is genuinely backlog, not a dodge

`BACKLOG.md` M38-a..d and M39-a..j are instrument debt, not app defects. None of them changes what
a patient sees, each carries the measurement that justifies deferring it, and several record the
measurement refuting an earlier, more convenient version of the same entry. That is the opposite
of a dodge. The three I was asked to look at hardest:

* **M39-g — the mid-word break.** I opened `before-badge-320.png` and `after-badge-320.png` and
  looked at them rather than reading the table about them. The after is exactly as described:
  NOT / SCHEDUL / ED · / EARLY · / OVER / LIMIT, six lines in a 110px pink block at 320px. Ugly,
  contained, legible, nothing covered. Before, the same label escaped its column into the Remove
  control. The design note did not oversell it and did not hide it. **Not a blocker. It is the one
  item I have written up for Aaron in plain words above, because it is the only part of this
  release he could look at and think something had got worse** — and the fix for it is a control
  change, which Rule 2.6 reserves to him.
* **M39-i — the 8px side-scroll on the Paracentesis report at 320px.** Measured by the delta2
  audit and shown to be pre-existing: the three-up stat grid's geometry has not changed and the
  type scale has not moved. Not introduced here, so not this release's to fix.
* **M39-c — `overflow-scan` never opens a report sub-screen.** Real and correctly stated. The
  coverage exists but is split across instruments: the two new app-v92 suites do walk all nine
  report screens. The honest version of the complaint is that the scan's own summary line does not
  say what it did not look at, which is a reporting gap, not a hole in this release.

I have the authority to block on any of these and I am not exercising it. One more thing belongs
in the record rather than in a blocker: the contrast scan still cannot see an ancestor's opacity
(M38-b), so fix 3's opacity change is protected by arithmetic and by two pixel measurements but by
no automated gate. The backlog says that in those words instead of claiming coverage it does not
have, which is why it is a disclosure and not a defect.

---

## The gate

Run to completion, output pasted raw and unsummarised below, both times.

### Run 1 — before this sign-off existed

As expected, it stops at the Quality Chain stage because this file did not yet exist. The two
"REFUSES this release" lines beside it are the missing-report branch listing every standing
refusal without applying the supersession test; they are answered by `AUDIT-app-v92-delta2.md`
examining the later commit `36cc61b`, which run 2 confirms. Nothing else in run 1 is a failure,
and the gate says plainly that it stopped early rather than pretending the list is complete.

```
ℹ️  Suites will run against a clean export of HEAD at /tmp/tmp.5lFDPnoWpd
   (not the working tree -- see the app-v82 note above).
ℹ️  Baseline: PUBLISHED.json -> app-v89 (chemowell-app-v89-1) at a5d5908
   8 commit(s) have changed index.html since that record. This gate assumes NONE of
   them are live yet. If any were already pushed, run ./mark_published.sh <that commit>
   first -- otherwise the comparison below is against the wrong build.
❌ RELEASE CHECK FAILED: the quality chain has not run for app-v92.
   Changed under rule 5: index.html sw.js 
   missing: an outputs/PM*app-v92*.md sign-off
   AND a report on record REFUSES this release: outputs/AUDIT-app-v92-delta.md (examined 217f999) says DO NOT SHIP.
   Fix what it found and re-run that stage against a later commit. A sign-off from a
   different desk does not answer it.
   AND a report on record REFUSES this release: outputs/AUDIT-app-v92.md (examined f6df061) says DO NOT SHIP.
   Fix what it found and re-run that stage against a later commit. A sign-off from a
   different desk does not answer it.
   Every suite passing is SELF-verification. CLAUDE.md rule 5 requires an independent
   Auditor pass and PM sign-off before this ships, with no size exception. Permission to
   push is not that gate.

⛔ STOPPED EARLY -- the checks after this point did NOT run.
   This is not the complete list of what is wrong with the release; it is the first thing
   that made the rest of the gate impossible to evaluate. Fix it and re-run.
EXIT=1
```

### Run 2 — with this sign-off in place

Run to completion. **Exit code 0.** Ten suites green, the no-other-patient check clean, and
the chain gate satisfied: it names `AUDIT-app-v92-delta2.md` and this sign-off as the current
pair and correctly records the two earlier refusals as present and not clearing the release,
rather than as objections that vanished. The served tree's md5 is verified as `e62bc8df` inside
the run, so the suites measured the same bytes I signed.

```
ℹ️  Suites will run against a clean export of HEAD at /tmp/tmp.ewowT26Sm7
   (not the working tree -- see the app-v82 note above).
ℹ️  Baseline: PUBLISHED.json -> app-v89 (chemowell-app-v89-1) at a5d5908
   8 commit(s) have changed index.html since that record. This gate assumes NONE of
   them are live yet. If any were already pushed, run ./mark_published.sh <that commit>
   first -- otherwise the comparison below is against the wrong build.
ℹ️  Other reports present and not clearing this release:
     outputs/AUDIT-app-v92-delta.md — says DO NOT SHIP
     outputs/AUDIT-app-v92.md — says DO NOT SHIP
ℹ️  Chain artifacts present for app-v92, and current against the working tree:
     outputs/AUDIT-app-v92-delta2.md
     outputs/PM-app-v92.md
ℹ️  Suite server on 127.0.0.1:8897, serving /tmp/tmp.ewowT26Sm7 (md5 e62bc8df verified).
✅ every test/*.mjs parses (68 suite(s), node --check)
ℹ️  v76-properties-equivalence.mjs: green.
ℹ️  v76-empty-window-render.mjs: green.
ℹ️  v89-everything-free.mjs: green.
ℹ️  v84-whatsnew.mjs: green.
ℹ️  contrast-scan.mjs: green.
ℹ️  overflow-scan.mjs: green.
ℹ️  v90-chart-axes.mjs: green.
ℹ️  v92-pill-clearance.mjs: green.
ℹ️  v92-text-collisions.mjs: green.
ℹ️  v92-designer-pass.mjs: green.
ℹ️  No-other-patient check: clean.
✅ Release check passed.
   index.html changed and sw.js's CACHE constant changed with it -- installed
   copies of the app will pick this up automatically on next open.
```

---

## One process defect found and fixed, which did not block

**Two of Aaron's three requests were never written into `REQUESTS.md`.** Only the colour one had
an entry. The other two — the medication name printing across the time and the dose, and the Back
pill covering the last line — existed as task numbers #36 and #28 in a session task list and in
`outputs/`, and `REQUESTS.md` mentioned those numbers in passing without ever carrying the asks
themselves. That file's own rule is that an ask is logged the moment he makes it, before any code
is touched, and `TEAM-ORDER.md` already records the Scribe seat failing to keep this file before.

**The work itself was not dropped — I verified all three fixes in `index.html`, which is the
point of this seat — so this is a record defect, not a scope defect, and it does not block.** I
logged both asks in `REQUESTS.md` with their measurements and with M39-g named as the known
tradeoff, rather than reporting the gap and leaving it open.
