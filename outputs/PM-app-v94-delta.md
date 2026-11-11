AUDITED-COMMIT: 87fad33ebcebc4894456b6450a31886753bc40b9
VERDICT: SHIP

# Project Manager — ChemoWell app-v94, DELTA (supersedes `PM-app-v94.md`)

**SHIP.** The one thing my own earlier refusal objected to is gone: the production-code change that
landed after the delta-2 SHIP has now been read by an independent auditor, and the only commits
since that audit are two documentation files. Every finding from all three audit passes is either
fixed-and-measured or logged with a number. The release mechanics are right. **The verdict on line 2
follows `./release_check.sh`, whose complete raw output and exit code are at the foot of this file —
the gate decides, not this paragraph.**

**A note on how this file was produced, because it matters to how much it is worth.** The gate will
not report on anything until a PM artefact with a readable verdict exists, so there is no way to
learn its objections without one already on disk. This file was therefore written in full first,
stating SHIP, and the gate was then run against it; the raw output was appended afterwards and the
verdict reconciled with the exit code. **An earlier attempt at this run was lost when the container
restarted mid-suite**, and the draft that survived asserted a pass the gate had not yet delivered.
That sentence has been removed rather than left to stand on my own expectation: an unfinished run is
not a pass, which is the whole premise of having a gate.

**This file supersedes `outputs/PM-app-v94.md`, which says DO NOT SHIP at `0c74ea3`.** I added a
file rather than rewriting that one, deliberately — see "Why a second file" below. The gate's
supersession rule is satisfied mechanically: same stage, strictly later commit, SHIP.

I did not build this and I did not audit it. Three independent audit passes read the code. What
follows is whether the process ran, whether every finding landed somewhere, whether the deliverable
is what the owner asked for, and whether the mechanics are right.

## The tree as I measured it

| | measured | expected | |
|---|---|---|---|
| `git rev-parse HEAD` | `87fad33ebcebc4894456b6450a31886753bc40b9` | `87fad33e…` | matches |
| branch | `claude/caretracker-team-review-i83ik2` | same | matches |
| `index.html` md5 | `9dbb11ebb200ee5a7181942847feb25e` | same | matches |
| `sw.js` md5 | `8efcc1e7e7c55a22902057b722b5a58b` | same | matches |
| `APP_VERSION` (`index.html:9842`) | `app-v94` | — | — |
| `sw.js` CACHE (`sw.js:1`) | `chemowell-app-v94-1` | — | — |
| `git status --porcelain` | empty before and after every run | clean | clean |
| `HEAD` vs `origin/claude/…-i83ik2` | identical sha | pushed | pushed |

I ran no `git checkout` and edited no application file, suite or corpus. The only file I wrote is
this report.

**`care-tracker` was not touched.** I did not modify a file in it, run anything against it, open its
live site, touch Firestore, or port anything to or from it. I read only the notice that loads
automatically into every session, which is what that notice permits.

## The chain, stage by stage

| Stage | Artefact | Ran? |
|---|---|---|
| Enhancer (design-time) | `outputs/ENHANCER-app-v94.md` | Yes — before the build, on Home. Four proposals, **none built**; E7 queued in `REQUESTS.md:1139` as "not built". |
| Designer | `outputs/DESIGN-app-v94.md` | Yes. No layout, spacing, type, colour or control changed. Chromium-only exemption stated. Its stale quote was corrected in `abbb4b9`. |
| Builder write model | README row + header comment at `index.html:2533` | Yes. Appends nothing, deletes nothing; the two-pass tie-break is stated before the code. |
| Zero Day Audit 1 | `outputs/AUDIT-app-v94.md` | Yes — **DO NOT SHIP** at `0242928`: one BLOCK (the notification path) plus F1–F5. |
| Delta-2 audit | `outputs/AUDIT-app-v94-delta2.md` | Yes — **SHIP** at `ca48e31`, D1–D5, one item NOT CLEARED (D4). |
| PM 1 | `outputs/PM-app-v94.md` | Yes — **DO NOT SHIP** at `0c74ea3`: production code moved after a SHIP. |
| Delta-3 audit | `outputs/AUDIT-app-v94-delta3.md` | Yes — **SHIP** at `abbb4b9`, scoped to the 14-line diff, mutants 13 and 14, the two badge checks. Two new cosmetic findings, N1 and N2. |
| PM 2 | this file | Yes. |
| Mechanical gate | `./release_check.sh` | Yes — output below. |

**Both instructions my earlier refusal left behind were followed.** It required the delta-3 SHIP to
name a commit strictly after `0c74ea3`: it names `abbb4b9`, and `git merge-base --is-ancestor
0c74ea3 abbb4b9` returns true, so that holds. It required the PM stage to run again: this is it.

## Item 1 — the supersession question. **Documentation only. No further audit pass is owed.**

The delta-3 audit examined `abbb4b9`. HEAD is `87fad33`. `git log --oneline abbb4b9..HEAD`:

| Commit | What | Touches production code? |
|---|---|---|
| `111c359` | *"Zero Day Auditor delta 3 on app-v94: SHIP"* — the audit report itself | No. One file: `outputs/AUDIT-app-v94-delta3.md` |
| `87fad33` | *"M50: four wrong numbers in one release…"* | No. One file: `BACKLOG.md` |

`git diff --stat abbb4b9..HEAD` is **two files, 293 insertions, 0 deletions**: `BACKLOG.md` (+40)
and `outputs/AUDIT-app-v94-delta3.md` (+253). I read the whole diff, not the commit messages.
**Nothing under `index.html`, `sw.js`, `test/`, `falsify/`, `release_check.sh` or `README.md`
changed.** Both md5s are identical to the ones the delta-3 auditor measured, which is the
independent confirmation that the bytes it read are the bytes that would ship.

**I am applying the same strictness my earlier refusal did, and it lands the other way this time.**
That refusal turned on a distinction it stated in those words: a documentation correction after a
SHIP is nothing; a change to production dose logic after a SHIP is a different thing, however small
and however inert. This diff is squarely the first kind. Neither commit adds a line that executes,
a check that asserts, or a mutant that measures — one files the audit's own report, the other writes
its two findings into the backlog with exact lines. There is no code here for an auditor to read, so
there is nothing a delta-4 pass could examine. Waving a *production* change through on my own
reading is what Hard Rule 5 forbids; declining to spend an audit cycle on a backlog entry and a
report is not that, and the gate agrees — it finds `AUDIT-app-v94-delta3.md` current, because its
own currency test is drift in `RULE5_PATHS`, and there is none.

## Item 2 — N1 and N2 shipping unfixed. **My call: it does not block. Here is the reasoning.**

Both are wrong counts in prose. I verified both myself rather than taking the audit's word, because
the whole class of defect here is a number nobody re-derived:

* **N2** — `index.html:2534` reads *"There were SIX, and **three** of them were wrong."* The comment
  then names all six. Reading its own list: `missedDosesFor` correct; `status()`,
  `doseProgressToday`, `medWindowDueAt`, `dueRemindersAt` and `cancelReminderForEntry` wrong.
  **Five**, not three.
* **N1** — *"all **five** call sites"* of `medWindowDueAt`, at `index.html:13648`,
  `falsify/mutants-v94-coverage.sh:196` and the `README.md` app-v94 row. `grep -n "medWindowDueAt"`
  returns the definition (13657), two comments (2553, 13400) and **four** callers: `profileDueCount`
  (1064), `dueRemindersAt` (13404), `buildReminderPlan` (13694) and the test hook (14338).
  `cancelReminderForEntry` is not one — it calls `windowClaims` directly. **Four**, not five.

**Why I am not blocking on them.**

1. **Nothing executes on either.** No assertion, no suite, no mutant and no caregiver-facing string
   depends on either number. They are developer prose.
2. **The authoritative content beside them is correct and complete.** The N2 sentence is contradicted
   and corrected by the eight lines directly beneath it, which enumerate all six definitions and say
   what each one did wrong — a reader who acts on that comment acts on the list, and the list is
   right. The README row's own arithmetic is right too: three answers counted in the first build with
   two wrong, three more found by the audit on the notification path, six in total with one correct.
   Only the headline tally in one clause is stale.
3. **The claim N1 supports does not rest on the number.** *"`wi < 0` is unreachable"* was re-derived
   by the delta-3 auditor with a throwing probe and a falsified control, and I re-derived it again by
   grep and by reading all four call sites: each reads `med.windows` off the same `med` it then
   passes, in the same synchronous expression, so `indexOf` resolves. Four callers prove it exactly
   as well as five would have.
4. **Fixing it now costs a cycle and buys nothing.** Two words in `index.html` change its md5, which
   makes the delta-3 SHIP stale under the gate's own supersession rule and buys a delta-4 audit and a
   third PM pass — on a release that fixes a medication-dosing defect the owner reported on
   6 November and that is still not live. The independent adversarial pass, whose job is to stop the
   release, judged them not worth a cycle in writing. The PM's job is to check the process ran, not
   to be stricter than the auditor on a comment.

**Against myself, because it is a fair hit and should be on the record.** The false number sits in
the header comment of the very function this release rewrote, and that comment's own next paragraph
argues that *"a comment asserting the unification is finished is exactly how the remainder gets
missed."* Shipping a stale count inside that argument is ironic and I am not pretending otherwise.

**What makes it acceptable under the "zero leftover junk" standard rather than a breach of it** is
that nothing is half-built and nothing is undocumented. `BACKLOG.md:1409` — **M50** — carries both
items with file and line, the exact two-word diff, and the instruction that they are the first
commit of the next touch. And M50 does the thing that actually retires the class: it counts the four
instances this one release produced (F5, D3, the gate's own comment, and now N1/N2), names the shape
— a count written in prose next to the thing it counts — and proposes a two-sided ratchet modelled
on the pronoun ratchet in `test/v75-no-other-patient.mjs` that derives both numbers from the file and
fails if the prose drifts either way. Four instances in one release is a process finding, and a
mechanism is the right answer to it. That is a better outcome than two words fixed quietly.

**One condition I am handing forward, and the gate cannot enforce it.** "First commit of the next
touch" is a promise in a file. This project has already lost F3 and F4 that way for a whole release,
and Rule 7's standing-exceptions list once carried three entries describing defects fixed weeks
earlier. M50 is the thing to check first on the next touch of this app, before any build.

## Finding accounting

**I re-checked only what changed since `PM-app-v94.md`, as briefed, and I rely on that file's
accounting for the rest.** It walked F1–F5 and D1–D5 against `BACKLOG.md`, `REQUESTS.md` and the
file and found nothing unaccounted for. That accounting is not a formality: the delta-2 audit caught
F3 and F4 **lost** — present in neither file — so the walk has already failed once here.

| Finding | Disposition | Re-checked by me |
|---|---|---|
| Audit 1: BLOCK, F1, F2, F3, F4, F5 | Fixed-and-measured, or logged as M46/M47/M48 | Relied on `PM-app-v94.md`; confirmed M47 (`BACKLOG.md:1362`) and M48 (`:1381`) still present and substantive |
| Delta-2: D1, D2, D3, D4, D5 | Fixed-and-measured, or logged as M45/M46/M49 | Relied on `PM-app-v94.md`; confirmed M49 (`:1396`) present |
| Delta-2 optional #5 (`wi < 0` fail-safe) | Built; **now audited** by delta-3 | This is what cleared my refusal |
| `PM-app-v94.md`'s leftover — `release_check.sh` said "33 checks" | **Fixed** in `abbb4b9`; line 941 now reads 35 | Read it |
| `PM-app-v94.md`'s leftover — stale quote in `DESIGN-app-v94.md` | **Fixed** in `abbb4b9`; delta-3 confirms a character-for-character match with the shipped bullet | Relied on delta-3 |
| **N1** — "five call sites" in three places | **Logged, M50**, with all three locations and the fix | Verified the count is four, and that M50 names all three |
| **N2** — "three of them were wrong" at `index.html:2534` | **Logged, M50**, with the line and the fix | Verified the count is five |

**Nothing is unaccounted for.** Every finding from all three passes is fixed-and-measured or carries
a backlog number with an exact line.

## Release mechanics

| Item | Measured | Status |
|---|---|---|
| `APP_VERSION` moved vs `origin/main` | `app-v92` → `app-v94` | ✔ |
| `sw.js` CACHE moved vs `origin/main` | `chemowell-app-v92-1` → `chemowell-app-v94-1` | ✔ |
| The two consistent with each other | both `v94` | ✔ |
| `CHANGELOG` entry for exactly this version | present, `index.html:9865` | ✔ |
| Rule 0.9 size | title 5 words, 3 bullets, **61 words** total (counted by parsing the array, not by eye) | ✔ under ~70 |
| Every statement in it true of the shipped file | see below | ✔ |
| `README.md` version-history row | present, line 14; its figures match what was measured | ✔ |
| Working tree clean, everything pushed | `git status` empty; HEAD == remote branch | ✔ |

**The changelog, read as the owner will read it.** Three bullets: the card, the ring, and *"The
reminder and the app-icon count do the same — logging early switches them off."* All three are true
of this file and all three are now falsifiable — the reminder half dies under mutants 8, 9 and 10,
the app-icon half under mutants 8 and 13, which is the gap D1 was raised over. The caveat worth the
owner knowing, already logged as M40 and not a defect: on the native Android build there is no badge
plugin, so the number appears on the menu button rather than on the app icon. The same function
drives both, so the sentence is true there too — about a different pixel.

**The README row's figures, checked against measurement rather than against the row:** 35 checks,
14 mutants, and *"11 caught, 0 unexpected survivors, 0 stale anchors, 1 over-block control green,
2 declared holes"* with holes 12 and 14. The row also corrects itself explicitly on F5 — it opens
with the first build's "three answers, two wrong" and then states in those words that there were six
and the three untouched ones were all on the notification path. It still carries N1's "five call
sites", which is M50.

## What came from the gate, and what I took on trust

**From the gate, re-run by it on a clean export of HEAD, and this is narrower than I first wrote it.**
The gate stood up its own server against a clean export and printed `md5 9dbb11eb verified`, so it
measured the file I measured and not the working tree. It then ran and passed, **as its own result
rather than anybody's report**: `v76-properties-equivalence`, `v76-empty-window-render`,
`v89-everything-free`, `v84-whatsnew`, `contrast-scan`, `overflow-scan`, `v90-chart-axes`,
`v92-pill-clearance`, `v92-text-collisions`, `v93-profile-notifications`, **`v94-window-coverage`**,
`v85-profile-reminders`, the no-other-patient check, `node --check` on all 70 suites, and the
release mechanics including that `sw.js`'s CACHE moved with `index.html`.

**What the gate does NOT give, and I am not going to let its green stand in for it.** It prints
`green` per suite, not check counts — so **35/35, 29/29 and the pronoun ratchet at 32 are figures I
take from the reports and from my earlier reading, not from this run.** The gate's contribution is
the stronger half of each of those claims (the suite passed, on the shipping bytes); the counts are
corroboration. And **the mutant corpus is not in the gate's output at all** — no `falsify` line
appears, so *11 caught, 0 unexpected survivors, 0 stale anchors, 1 over-block control green,
2 declared holes (12, 14)* rests entirely on the delta-3 auditor's own 7m30s sweep and the delta-2
pass before it. That matters more than the rest, because the corpus is what makes this release's
checks falsifiable, and it is the one figure in the README row that no run of mine or of the gate's
re-measured. I flag it rather than imply the gate covered it.

**Also read off this run, and worth stating:** the gate lists `outputs/PM-app-v94.md` under *"Other
reports present and not clearing this release"* and names this file as the current PM artefact. That
is the supersession working mechanically, out of the gate's mouth rather than mine.

**Measured by me, in the repository, on this exact tree:** the sha, both md5s, both version strings,
the clean tree and the push state; the full `abbb4b9..HEAD` diff; the `medWindowDueAt` call-site
count by grep and by reading all four; the N2 count by reading the comment's own list of six; the
changelog word count by parsing the array; M47–M50 presence; `release_check.sh:941`; E7's queued
status.

**Taken on trust:** the delta-3 auditor's instrumented-probe work on the `wi < 0` branch and its
falsified control, and both earlier audits' findings. Those are the independent passes and
re-deriving them here would be the self-verification Hard Rule 5 forbids.

**No real device, no APK.** Nothing in this repository can test one. Every notification measurement
here — mine, the gate's and all three audits' — goes through the shipped functions with a stubbed
Capacitor bridge. That is the standing exemption on this release and it is the one thing the owner
has to check himself.

## The deliverable against what the owner asked for

> *"I just logged my medication for the 5:00 round and it still shows me to log it."* (2026-11-06)
> · *"Just build and fix. It all needs to be fixed regardless."* (2026-11-10)

**Fixed on the surface he saw and on the one he did not mention.** On his own fixture — one
17:00–21:00 window, one dose at 16:45 — the card stops asking, the ring agrees with it, the OS alarm
is dropped from the plan, the reactive notification does not fire, the app-icon count goes to zero,
and logging the dose cancels an already-armed alarm. Each is a named check in the suite and each
dies under a mutant.

**No scope drift.** Four Enhancer proposals, none built; E7 queued for his opinion. No control added,
moved or removed; the Designer confirms no layout change. The adjacent work that landed is the
reported bug's other half (the ring, which was in his screenshot), the first audit's BLOCK (the
notification path), the app-v93 appointment BLOCK carried forward, and one clock inside a function
this release already rewrote.

**No dropped requirement.** The shape to watch for — a release that fixes the screen and leaves the
phone ringing — is exactly what the first audit refused, and the refusal held.

## Why a second file rather than rewriting the refusal

I wrote a new file and left `outputs/PM-app-v94.md` standing. The gate supports this and I checked
its implementation rather than assuming: a DO NOT SHIP report is cleared when a report **from the
same stage** says SHIP at a **strictly later** commit, is at least 2000 bytes and 25 lines, and
names a commit in this history. `0c74ea3` is an ancestor of `87fad33` and they differ, so this file
supersedes that one mechanically. The gate's warning that a refusal is not cleared *"by adding
another file beside it"* is about a file at the same or an earlier commit; this is the stage running
again, later, which is what its own comment asks for.

Rewriting the refusal in place would have cleared the release just as well and destroyed the record
of why it was refused. On this project the record is the asset — the whole reason `CLAUDE.md` is
shaped the way it is. A reader six months from now should be able to see that production code moved
after a SHIP, that it cost a cycle, and that the rule held. So: both files stay, the earlier one is
shown as superseded in the gate's own output, and the gate reads this one as the current PM verdict.

## Not mine to decide

**Pushing to `main` needs the owner's word, and he has not given it for app-v93 or app-v94.** Both
releases are built and neither is live. This sign-off clears app-v94 to be *offered* to him. I have
pushed nothing to `main` and committed one file — this report — to the working branch.

## The mechanical gate — raw output, verbatim

Run as `env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy ./release_check.sh`, with this
sign-off in place. The output below is one complete run from its first line to its last, pasted
unedited; it was appended afterwards, so the run read everything above it and nothing of its own
output. The gate stands up its own server on port 8897 against a clean export of HEAD rather than
reading the working tree, and it prints the md5 of what it serves — which is how the run below
confirms for itself that it measured `9dbb11eb`, the file I measured.



```
ℹ️  Suites will run against a clean export of HEAD at /tmp/tmp.roZ0h7hQPe
   (not the working tree -- see the app-v82 note above).
ℹ️  Baseline: PUBLISHED.json -> app-v92 (chemowell-app-v92-1) at acb42f3
   9 commit(s) have changed index.html since that record. This gate assumes NONE of
   them are live yet. If any were already pushed, run ./mark_published.sh <that commit>
   first -- otherwise the comparison below is against the wrong build.
ℹ️  Other reports present and not clearing this release:
     outputs/AUDIT-app-v94-delta2.md — examined ca48e31; changed since: index.html 
     outputs/AUDIT-app-v94.md — says DO NOT SHIP
     outputs/PM-app-v94.md — says DO NOT SHIP
ℹ️  Chain artifacts present for app-v94, and current against the working tree:
     outputs/AUDIT-app-v94-delta3.md
     outputs/PM-app-v94-delta.md
ℹ️  Suite server on 127.0.0.1:8897, serving /tmp/tmp.roZ0h7hQPe (md5 9dbb11eb verified).
✅ every test/*.mjs parses (70 suite(s), node --check)
ℹ️  v76-properties-equivalence.mjs: green.
ℹ️  v76-empty-window-render.mjs: green.
ℹ️  v89-everything-free.mjs: green.
ℹ️  v84-whatsnew.mjs: green.
ℹ️  contrast-scan.mjs: green.
ℹ️  overflow-scan.mjs: green.
ℹ️  v90-chart-axes.mjs: green.
ℹ️  v92-pill-clearance.mjs: green.
ℹ️  v92-text-collisions.mjs: green.
ℹ️  v93-profile-notifications.mjs: green.
ℹ️  v94-window-coverage.mjs: green.
ℹ️  v85-profile-reminders.mjs: green.
ℹ️  No-other-patient check: clean.
✅ Release check passed.
   index.html changed and sw.js's CACHE constant changed with it -- installed
   copies of the app will pick this up automatically on next open.
```

**Exit code: 0.** `✅ Release check passed.` (The fenced block is the gate's own stdout and stderr,
complete and unedited. The exit status was captured by the shell that launched it — `echo "EXIT=$?"`
— and is stated here rather than inside the block, because the gate does not print it itself.)

Three things to read out of that output beyond the headline.

**One — it passed on the right bytes.** The gate does not trust the working tree: it exports HEAD to
a temporary directory, serves that, and prints the md5 of what it is serving. `9dbb11eb` is the
`index.html` I measured and the one the delta-3 auditor measured.

**Two — the supersession is the gate's finding, not my assertion.** It lists my earlier refusal and
the first audit's refusal under *"Other reports present and not clearing this release"*, then names
`outputs/AUDIT-app-v94-delta3.md` and `outputs/PM-app-v94-delta.md` as the pair that is current
against the working tree. The refusals are on the record, visible, and cleared the way the gate's own
rule says they must be cleared — by the same stage looking again at a later commit.

**Three — the baseline note is expected and correct.** `PUBLISHED.json` records app-v92 as live and
the nine commits since are app-v93 and app-v94, neither pushed to `main`. Nothing to fix; it is the
gate saying out loud that it is comparing against the right build.

**What this run surfaced that I had not already accounted for: nothing.** No suite went red, no
mechanic failed, and no finding appeared that is not in this report or in `BACKLOG.md`. The one thing
it changed is in my own accounting rather than in the release — it showed me that the mutant-corpus
figures are not inside the gate, and that section now says so.

## For the owner, in plain words

**Your bug is fixed, it has been checked three times over by someone other than the person who fixed
it, and the automatic check now passes. It is ready for you to say yes or no.**

What you reported on 6 November: you gave the five o'clock dose at about quarter to five, and the app
kept asking for it. That is fixed. The card stops asking. The ring beside it now agrees with the card
instead of contradicting it. And — this is the part a review refused the first attempt over —
**your phone stops asking too.** The first version only fixed the screen, so the alarm would still
have gone off at five telling you to give a dose you had already given. That is worse than the bug
you reported, because the phone reaches you when you are not looking at the app. The fix now covers
the alarm, the pop-up and the number on the menu button, and there is a test behind each one so it
cannot come back quietly.

**Why this took an extra round.** After the second review approved it, one line of the main file was
changed — a safety tidy-up the reviewer itself had asked for. Our rule is that code which ships is
code a reviewer has actually read, with no exception for small or obvious, so I refused it rather
than approve a line nobody independent had seen. A short third review has now read it and approved.
Since then nothing in the app has changed at all; the only two commits are that review's own write-up
and a note in the backlog. That is why I am comfortable now and was not before.

**Two leftovers, on purpose, and you should know what they are.** Two developer notes in the code
state a wrong count — one says three things were wrong where five were, the other says five places
use a function where four do. Neither affects anything the app does; both are comments. Fixing two
words would have meant another full review round on a fix you have been waiting on since 6 November,
so they are written down with their exact lines as the first job of the next touch, together with a
better idea: a check that counts the real thing and fails if the written number drifts. Four of these
wrong counts turned up in this one release, so a check is the right answer rather than more care.

**Nothing was added that you did not ask for.** Four possible improvements were written down and none
was built. One is worth your opinion later: showing *which* dose slot the card is asking about when a
medication has more than one round a day.

**The one thing only you can check, once it is live.** Nothing on this side can test a real phone —
every notification result here comes from a simulated one. So: give a dose ten or fifteen minutes
before its scheduled time, then watch that the phone does **not** buzz for it when that time arrives,
and that the number on the menu button drops. A real phone staying quiet is the only proof that
counts.

**Still waiting on you: app-v93 and app-v94 are both built and neither is live.** Nothing goes to the
live app without you saying so.

**And on the other app — the one that is closed.** I did not touch it. I did not change a file in it,
run anything against it, open its live site or go near its data. I read the notice at the top of it
and nothing else.
