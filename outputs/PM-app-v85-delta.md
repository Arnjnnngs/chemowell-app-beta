AUDITED-COMMIT: 6cb5ce0
VERDICT: SHIP

Project Manager sign-off desk, ChemoWell **app-v85 stage 1**, branch
`claude/caretracker-team-review-i83ik2`, HEAD `6cb5ce0`. Second PM pass; the first refused at
`f962e01`.

I did not build this. Everything below was measured by running it at `6cb5ce0`. Where I took a
number from a chain report instead of re-measuring it, the line says so. The working tree was not
left modified: every mutant was applied in place and restored from a byte copy, with `md5sum -c`
green after each run, and `git status --porcelain` is empty apart from this file.

---

# HEADLINE

**SHIP.** Every chain seat produced its artifact, every audit finding is closed against the file,
and the two gates I was told not to believe both fail when I break them — including the one that
guards the actual defect, which I broke myself and watched take six checks red.

The release does exactly stage 1 and no more: it stops one profile's reminders destroying another's,
it disarms a deleted profile's reminders, and it makes the Settings card say whose count it is
showing. Stage 2 — per-profile coverage and a caregiver-chosen notification label — is absent from
the code and recorded as absent in both the README row and the Developer brief, with Aaron's own
choice of order and label design written down as the source.

Two follow-ups and one standing item ship unfixed. I agree with all three, and I have added a fourth
of my own that is a process item, not a defect: none of them is logged anywhere a future session
looks.

---

# 1. THE CHAIN — every seat, every artifact

All present, all committed, all dated inside this release's window.

| Seat | Artifact | Commit | State |
|---|---|---|---|
| Developer brief | `outputs/DEVELOPER-multiprofile-notifications.md` (575 lines) | `f962e01` | Planning-only pass, no code. Records Aaron's two decisions with their source. |
| Enhancer + Voice (pre-build) | `outputs/ENHANCER-app-v85.md` (44 lines) | renamed into the gate's glob at `f4b8e98` | Six findings E1–E6. Was filed as `ENHANCER-multiprofile-notifications.md`, which the gate could not see; the first PM caught that and it was renamed. |
| Designer | `outputs/DESIGN-app-v85.md` + 12 PNGs in `outputs/design-app-v85/` | `f4b8e98` | Four states × three widths (320/360/390): `on`, `on-exact`, `empty`, and a three-profile config. |
| Zero Day Auditor | `AUDIT-app-v85.md`, `-delta.md`, `-delta2.md`, `-delta3.md`, `-delta4.md`, `-delta5.md` | six commits | Verdict chain below. |
| PM (first pass) | `outputs/PM-app-v85.md` (443 lines) | `2467cbe` | DO NOT SHIP at `f962e01`. |
| PM (this pass) | `outputs/PM-app-v85-delta.md` | — | This file. |

**The verdict chain, read off the files' own first two lines:**

```
AUDIT-app-v85.md          21b8123  DO NOT SHIP
AUDIT-app-v85-delta.md    f3f1880  DO NOT SHIP
AUDIT-app-v85-delta2.md   cbc0520  SHIP
PM-app-v85.md             f962e01  DO NOT SHIP
AUDIT-app-v85-delta3.md   f4b8e98  DO NOT SHIP
AUDIT-app-v85-delta4.md   43f1d95  DO NOT SHIP
AUDIT-app-v85-delta5.md   f9bb182  SHIP
```

Every refusal is followed by a later commit and a later report. The last audit says SHIP at
`f9bb182`, and the only thing between `f9bb182` and HEAD is that report itself:

```
$ git diff --name-status f9bb182 6cb5ce0
A	outputs/AUDIT-app-v85-delta5.md
```

**So the tree the last auditor examined IS the tree being shipped.** That was the first PM's
refusal reason 2 and it does not recur here.

**Designer screenshots are real files, not a claim.** Twelve PNGs, 1.1–1.2 MB each, timestamped
between 04:57 and 04:58 on 2026-09-17.

---

# 2. THE AUDIT FINDINGS — closed, and the gates re-broken

## 2.1 The suite at HEAD, re-run by me

```
$ python3 -m http.server 8899 --directory /home/user/chemowell-app-beta
$ env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy node test/v85-profile-reminders.mjs
...
43 checks: 43 passed, 0 failed
```

Section 8 read the README live and reported *"README says 43/43, this run counts 43"*.

`node test/v75-no-other-patient.mjs` → **27/27 checks passed**, ratchet **0/0/0**.

## 2.2 The two mutants I was told not to believe — BOTH DIE

**M20** — revert `status !== 'empty'` to `notifScheduledCount > 0` at `index.html:9322`:

```
  FAIL  so the sentence scopes the count that is showing  |  This is for Alex only. The other profile on this phone keeps the remin
43 checks: 42 passed, 1 failed
```

**M24** — delete one check that is not the last. I ran it twice, at both ends of the file, because
a counter that works at one position and not another is exactly the shape this check has already
been wrong about five times.

| Where the check was deleted | Result |
|---|---|
| `test/v85-profile-reminders.mjs:457`, section 6d, near the end | `42 checks: 41 passed, 1 failed` — *"README says 43/43, this run counts 42"* |
| `test/v85-profile-reminders.mjs:75`, section 2, near the start | `42 checks: 41 passed, 1 failed`, **node exit 1** — same failure |

Deletion is caught wherever it happens.

## 2.3 A mutant of my own, because both of those are about the copy and the counter

Neither M20 nor M24 touches the defect this release exists to fix. So I deleted the guard itself —
`index.html:12639`, the line that spares another profile's reminder:

```
$ sed -i '12639d' index.html    # the profile-existence guard, gone
node exit=1
  FAIL  the other profile's reminders are NOT cancelled  |  toCancel=[11,22,33]
  FAIL  exactly one id was cancelled  |  3 cancelled
  FAIL  a dose due seconds away on another profile survives a reload  |  1 cancelled
  FAIL  a corrupt profile list protects the other profile rather than sweeping it  |  cancelled=1
  FAIL  a missing profile list protects it too  |  cancelled=1
  FAIL  and a healthy list still protects it  |  cancelled=1
43 checks: 37 passed, 6 failed
```

**Aaron's defect coming back takes six checks red, including the fail-closed cases.** That is the
one I most needed to see and it is the one no report asked me to run.

## 2.4 The suite drives the shipped code, not a copy of it

Read off the diff rather than the report: `syncNativeReminders()` calls
`notifCancelCandidates(pending, planIds, notifPlanApplied, nowTs)`, and the test hook exports
`cancelCandidates: notifCancelCandidates` — the same function object, plus `deleteProfile` itself
rather than only the helper it calls. The earlier draft's re-implementation is gone.

## 2.5 The first PM's seven gate items

| # | Item | State |
|---|---|---|
| 1 | A delta audit over `f962e01` | Done — three more of them (`delta3/4/5`), two refusing. |
| 2 | README `30/30` → correct figure | Done — and it is no longer typed. Section 8 computes it. |
| 3 | Run the Designer seat, write `DESIGN-app-v85.md` | Done — 12 renders. |
| 4 | Make the Enhancer pass visible to the gate | Done — renamed to `ENHANCER-app-v85.md`. |
| 5 | Close M10 with an `empty` fixture; tighten M11's regex | Done — section 6b renders the empty state; M20 above is the proof the lead condition is now covered. |
| 6 | Changelog to say *"within"* about three days | Done — *"run out within about three days"*, matching the card word for word. |
| 7 | `release_check.sh` exit 0, fresh PM sign-off | Section 6 below; this file is the sign-off. |

---

# 3. SCOPE — is this what Aaron asked for, and is the copy true?

## 3.1 Stage 1 only. Verified by reading the whole diff, not the description.

`git diff 58ec27d..HEAD -- index.html` is **266 lines in 9 hunks**. I read all nine:

1. `deleteProfile()` now calls `cancelRemindersForProfile(id)`
2. `APP_VERSION` `app-v84` → `app-v85`
3. the in-app CHANGELOG entry
4. `profileScopeLine()` added
5. `profileScopeLine()` wired into `on-exact`
6. `profileScopeLine()` wired into `empty` and `on`
7. `notifCancelCandidates()` and `cancelRemindersForProfile()` added
8. `syncNativeReminders()` calls the lifted predicate
9. the `window.__notifScopeTest` hook

**Nothing plans reminders for an inactive profile, and nothing adds a label to a notification
payload.** The plan is still built from the active profile alone. Stage 2 is not quietly here.

## 3.2 Stage 2's absence is recorded, and so is Aaron's design for it

README row, in its own words: *"Stage 2 — reminders for profiles that are not active, plus a
caregiver-chosen label on the notification — is NOT in this release."* It then names his choice:
stage 1 first on its own; a label each profile sets for itself with a blank default so nobody is
named on a lock screen by an upgrade; reminder contents hidden until the phone is unlocked.

`outputs/DEVELOPER-multiprofile-notifications.md` carries the same two decisions with the reason he
gave for each. An earlier audit refused the row for asserting a decision the repo recorded nowhere;
that is fixed, and it is the right fix — a decision that lives only in a chat log is one the next
session re-asks or invents.

## 3.3 The Voice — the copy as it renders

I read the three sentences off the Designer's rendered cards, not off the diff.

> *"This count is for Alex only. The other profile on this phone keeps the reminders it already had,
> but nothing adds to them while you are not in it, and they run out within about three days — open
> that profile to set its reminders up again."*

**Is it true?** Clause by clause:

| Clause | Check |
|---|---|
| *keeps the reminders it already had* | True at HEAD and **false before it** — the reconcile loop destroyed them. Verified by my own guard-deletion mutant above, which is that old behaviour. |
| *nothing adds to them while you are not in it* | True — the plan is built from the active profile alone; I read every hunk. |
| *they run out within about three days* | `NOTIF_HORIZON_MS = 72 * 3600 * 1000` (`index.html:12376`). Three days exactly, and "about" is the right hedge. |
| *open that profile to set its reminders up again* | True, and it is the only instruction in the sentence — which is why the plural branch reading *"open each of them"* matters. Asserted at three profiles by section 6a. |

**The plural branch agrees in number**, and the empty state opens *"This is for Alex only"* rather
than *"This count is for"* when there is no count on screen. Both are asserted, and M20 is what
proves the second one is asserted rather than assumed.

**Would a tired person understand it at 2am?** Yes, though it is the longest thing on that card —
three lines of amber at 320px. I am not asking for it to be shortened: shortening is how it lost the
expiry clause once already, and the expiry is the difference between a limitation and a trap.

**One imprecision, non-blocking, mine.** A profile created and never opened has no reminders, so
*"keeps the reminders it already had"* is vacuously true and *"set its reminders up **again**"*
implies a "before" that never happened. It does not mislead about coverage and it points at the
right action, so it does not block. Worth a word if anyone is next in that sentence.

**The in-app changelog entry**, all three bullets, checked the same way: true, past tense about the
defect, no promise that anything is fixed on a phone nobody has tested, and **they/them throughout**
— *"whoever you were not currently in"*, *"the person you are in"*, *"open their profile"*.

## 3.4 The Enhancer's list, and what it did and did not buy

| # | Finding | In this release? |
|---|---|---|
| E1 | The card has eight states and none says "armed for this profile only" | **Yes** — the scope line is the ninth thing that card can say. |
| E2 | The `on` count is true and leaves a false impression | **Yes** — the finding this release exists for. |
| E3 | The notification cannot say whose dose it is | **No — Aaron's decision, deferred to stage 2 by him.** |
| E4 | No per-profile answer to "will this person be reminded?" on the Home profiles card | **No.** Open proposal; the Settings line answers it in one place only. |
| E5 | `empty` means two different things | **Yes** — the scope line disambiguates it. |
| E6 | Profile delete leaves alarms armed — flagged, not measured | **Yes, and it was real** — `deleteProfile()` now disarms them, and section 5b asserts the wiring, not just the helper. |

E6 is the one worth naming: the Enhancer flagged it as a question before any code existed, and it
turned out the old defect had been hiding the leak. Fixing the defect without it would have left a
deleted patient's medication reminders firing for 72 hours.

---

# 4. RELEASE MECHANICS

| Item | Measured |
|---|---|
| `APP_VERSION` | `app-v85` (`index.html:9052`) |
| `sw.js` CACHE | `chemowell-app-v85-1` (`sw.js:1`) |
| Both moved together, against the build that is actually live | Yes. `PUBLISHED.json` records live as `app-v84` / `chemowell-app-v84-14` at `55e0bd5`; both differ. |
| CHANGELOG has a row for exactly this version | Yes — `grep -c "v: 'app-v85'" index.html` → **1** |
| CHANGELOG top entry is app-v85 | Yes — app-v85 (Sep 17) sits above app-v84 (Sep 14). |
| README version-history row | Yes — exactly one `| app-v85 |` row, and it carries the suite figure section 8 reads. |
| Docs moved with the code | README yes. **`HANDOFF.md` did not** — see the note below. |
| Working tree clean before the gate | `git status --porcelain` empty. |

**`PUBLISHED.json` says the live build is app-v84.** That is the right state for an unpushed
release, and it means two things worth saying plainly: **nothing in this release has ever reached a
phone**, so every defect the six audits found was caught on the branch; and after the push somebody
must run `./mark_published.sh` and commit it, or the next release's gate reads a stale baseline.

**`HANDOFF.md` is stale and this release did not make it worse.** It says *"last refreshed
2026-09-14 at app-v80"* and names the live build as `app-v80` — it was already four releases behind
before app-v85 existed, last touched at `ffc7bff`. This repo's `CLAUDE.md` has no rule requiring it
to move with each release (that rule is care-tracker's, about a different file), so I am not
refusing on it. It is on the outstanding list.

---

# 5. RULE 0 — a product, not one patient

`node test/v75-no-other-patient.mjs` → **27/27 checks passed.** The three-part ratchet reads
**0/0/0 against ceilings of 0/0/0**, the fence is gone, and the legacy migration is gated on a
per-medication stamp rather than an id.

Read directly against this release's own diff as well:

```
$ git diff 58ec27d..HEAD -- index.html README.md | grep '^+' | grep -niE '\b(she|her|hers|his|him)\b|brandi'
(no matches)
```

No patient name. No gendered pronoun — including in the new code comments, which are long and were
the obvious place for one to slip. No dose, ceiling or schedule from a care plan. **No new behaviour
keyed to a medication id**: the new code branches on `profileId` and on card state, never on
`med.id`.

---

# 6. `./release_check.sh` — RAW OUTPUT

Run by me at `6cb5ce0`, working tree clean. **Exit code 0.**

```
$ ./release_check.sh
ℹ️  Suites will run against a clean export of HEAD at /tmp/tmp.NANDRNwkdO
   (not the working tree -- see the app-v82 note above).
ℹ️  Baseline: PUBLISHED.json -> app-v84 (chemowell-app-v84-14) at 55e0bd5
   6 commit(s) have changed index.html since that record. This gate assumes NONE of
   them are live yet. If any were already pushed, run ./mark_published.sh <that commit>
   first -- otherwise the comparison below is against the wrong build.
ℹ️  Other reports present and not clearing this release:
     outputs/AUDIT-app-v85-delta.md — says DO NOT SHIP
     outputs/AUDIT-app-v85-delta2.md — examined cbc0520; changed since: index.html 
     outputs/AUDIT-app-v85-delta3.md — says DO NOT SHIP
     outputs/AUDIT-app-v85-delta4.md — says DO NOT SHIP
     outputs/AUDIT-app-v85.md — says DO NOT SHIP
     outputs/PM-app-v85.md — says DO NOT SHIP
ℹ️  Chain artifacts present for app-v85, and current against the working tree:
     outputs/AUDIT-app-v85-delta5.md
     outputs/PM-app-v85-delta.md
ℹ️  v76-properties-equivalence.mjs: green.
ℹ️  v76-empty-window-render.mjs: green.
ℹ️  No-other-patient check: clean.
✅ Release check passed.
   index.html changed and sw.js's CACHE constant changed with it -- installed
   copies of the app will pick this up automatically on next open.
$ echo $?
0
```

**Read, not celebrated.**

* The expected refusal did not fire, because this report is what clears it. The gate now
  lists two artifacts as current against the tree: `AUDIT-app-v85-delta5.md` and this file.
* **The six lines under *"not clearing this release"* are the superseded chain, not new
  findings.** Four audits and one PM that refused earlier commits, plus `delta2`, which is
  marked stale rather than refusing (*"examined cbc0520; changed since: index.html"*) —
  correct, since three commits touched `index.html` after it. Each refusal is answered by a
  later commit and a later report; the chain in section 1 shows the sequence.
* **The baseline warning is the one line worth reading twice.** The gate assumes none of the
  six commits since `55e0bd5` is live. `PUBLISHED.json` agrees, and nothing in this session
  can reach the live site to confirm it independently. If any of those six were already
  pushed, `./mark_published.sh <that commit>` must run before the comparison means anything.
* `v76-properties-equivalence.mjs` green, `v76-empty-window-render.mjs` green,
  no-other-patient clean, and the CACHE/`index.html` pairing confirmed by the gate itself.
* **The suites ran against a clean export of HEAD** (`/tmp/tmp.NANDRNwkdO`), not my working
  tree — which is the check that makes my mutant runs safe to have happened at all.

**No refusal in that output is a finding against this release.**

---

# 7. THE TWO FOLLOW-UPS AND THE STANDING ITEM — my judgement

## F1 — section 8's `pass + fail + 1` is still a typed offset. **Agree: follow-up, not a blocker.**

**I measured it rather than agreeing with the report.** I appended one trailing check after section
8 and left the README at 43/43:

```
node exit=0
  PASS  the README figure for this suite is this suite's figure  |  README says 43/43, this run counts 43
44 checks: 44 passed, 0 failed
```

The hole is real and delta5 described it exactly. It does not block, for three reasons I checked
rather than accepted:

1. **Today's figure is correct**, computed from a real run, not typed — section 8 said 43/43 against
   a suite that counted 43.
2. **The hole that actually bit is closed in both directions.** Deletion anywhere is caught (M24 at
   two different positions, above); a drifted figure is caught; and a README with no figure at all
   **fails rather than silently skipping**, which is the failure mode that let this number be wrong
   five times.
3. **The remaining false green needs someone to append a check below the one check whose comment
   says in capitals that it is deliberately last.** That is a strictly smaller residue of the thing
   being fixed, and delta5 measured that the version it replaced had this hole *plus* the deletion
   hole.

Refusing a sixth time on a strict improvement is not a gate, it is a stall. The fix when someone is
next in the file is four lines: compute `const total = pass + fail` after every check, compare, and
on mismatch print FAIL and set `process.exitCode = 1` without incrementing the tally.

## F2 — `pageerror` watches one page in six. **Agree: follow-up, but first in the queue.**

Confirmed structurally by reading the file. Six pages are created; one listener is attached:

```
37: const ctx  = await b.newContext(...)
38: const page = await ctx.newPage()
40: page.on('pageerror', ...)          <- the only listener
205: nativePage   301: solo   330: exactPage   380: emptyPage   427: leadPage    <- unwatched
```

Not a blocker: it is **pre-existing** (five of the six were already unwatched at the commit that was
audited in full), a fatal error on any of those pages would fail that page's own card assertions
anyway, so the exposure is silent non-fatal errors only, and **no claim in the record depends on
it** — I checked the README row and it makes no page-error or console-error claim.

But the check is *labelled* *"no page error at any point above"*, and that is a promise about six
pages backed by one. In a suite whose entire subject is a sentence that was true and left a false
impression, a check label that overstates its own coverage is the same defect one level up. One
line fixes it: `ctx.on('page', (p) => p.on('pageerror', (e) => thrown.push(String(e))));`

## M7 — `deleteProfile`'s refusal to delete the ACTIVE profile is untested. **Agree: follow-up.**

Read at `index.html`:

```js
if (id === ps.activeId || ps.list.length <= 1) return; // never delete the active profile
```

Correct, pre-existing, and it sits **above** the new `cancelRemindersForProfile(id)` call — so the
new code cannot disarm the active profile's reminders even if the guard were reached with the active
id. One line of coverage when someone is next in the file.

## P1 — mine, and it is a process finding, not a defect

**None of F1, F2 or M7 is logged anywhere a future session looks.** `BACKLOG.md` has no entry for
any of them; they exist only inside `AUDIT-app-v85-delta5.md`, which nobody opens unprompted. This
repo's `CLAUDE.md` rule 8 is explicit: a finding you do not fix gets logged in `BACKLOG.md` plus the
task list. Three findings deliberately deferred and filed nowhere is how a standing exception gets
written, goes stale, and sends real work at a solved problem — which is the failure Rule 7 exists
for in the sibling repo.

**Not blocking this release** — none of the three can reach a phone or change a record, and I am the
gate, not the builder; making the entry myself would leave the tree dirty at the moment it has to be
clean. **It is the first item on the outstanding list and it should be done in the same pass as the
push.**

---

# 8. WHAT I DID NOT CHECK, SAID PLAINLY

- **No real device.** Everything native here runs behind a Capacitor stub in headless Chromium.
  Whether a reminder actually survives on Aaron's phone overnight is not knowable from this sandbox,
  and the release must not be described to him as if it were.
- **No iPhone rendering.** Chromium only. The 320/360/390 renders are Chromium at Apple viewport
  sizes, not Safari.
- **No live site.** The proxy blocks `github.io` and this release is not pushed; `PUBLISHED.json`
  confirms app-v84 is what is serving.
- **I did not re-run the other suites individually** — `release_check.sh` runs the board and its raw
  output is in section 6.
- **I did not re-derive the twelve Designer measurements.** I confirmed the twelve PNGs exist, are
  full-size renders, and are timestamped inside this release's window; I took the pixel table from
  the report.

---

# 9. WORKING TREE

Every mutant applied in place and restored from a byte copy under the session scratchpad.
`md5sum -c` green after **every** run (5 for 5: M20, M24 ×2, F1, and my guard deletion):

```
index.html: OK
test/v85-profile-reminders.mjs: OK
```

`git status --porcelain` shows only this report. The server on 8899 was killed. Nothing was
committed and nothing was pushed.

---

# 10. WHAT AARON NEEDS TO DO

1. **Say the word to push.** Nothing else is waiting on him.
2. **After the push:** run `./mark_published.sh` and commit it, or the next release's gate reads a
   stale baseline.
3. **On his phone, and only he can do this:** with two profiles set up, open the app under one of
   them, leave it overnight, and check the next morning that the other profile's reminders are still
   there. That is the one claim in this release that no gate in this repo can test.
