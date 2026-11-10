AUDITED-COMMIT: ca48e31933cc2d74a8b85bc896b37c1ee27b0271
VERDICT: SHIP

# Zero Day Auditor — ChemoWell app-v94, DELTA 2

**SHIP.** BLOCK 1 is closed and I measured it closing: on the reported fixture read at 16:50 — one
17:00–21:00 window, one dose logged at 16:45 — the armed plan now drops tonight's alarm, the plan
for "dose given" is no longer identical to the plan for "nothing logged", the reactive web
notification does not fire, and the shipped cancel-on-log reaches the plugin with tonight's alarm
id. Mutant 8, which restores the exact predicate the first pass blocked on, dies on five checks.

**Five non-blocking findings, D1 first because it is the one worth acting on.** One surface this
release newly claims as fixed — the app-icon badge and drawer dot — can be broken by a fourth
private copy of the naive coverage test and the **entire gate stays green**. I measured that.
Nothing is wrong in the shipped code; the hole is in what can be falsified, which is the same hole
the first pass blocked on, one surface further along.

**One checklist item is NOT CLEARED:** the first pass's F3 and F4 are neither fixed nor logged
anywhere. They are gone, not deferred.

## The tree I audited, as I measured it

| | measured | expected |
|---|---|---|
| `git rev-parse HEAD` | `ca48e31933cc2d74a8b85bc896b37c1ee27b0271` | matches |
| branch | `claude/caretracker-team-review-i83ik2` | matches |
| `index.html` md5 | `17fd16f29a5341ab41be9a70a3ef163d` | matches |
| `sw.js` md5 | `8efcc1e7e7c55a22902057b722b5a58b` | matches |
| `APP_VERSION` (index.html:9842) | `app-v94` | matches |
| `sw.js` CACHE (sw.js:1) | `chemowell-app-v94-1` | matches |
| `git status --porcelain` | empty, before and after every probe | clean |

`index.html` md5 was re-read after the last probe and is byte-identical to HEAD. Every mutation I
applied went to a copy under my scratchpad, served on its own port; nothing was written into the
repository except this report. I ran no `git checkout`.

**The sibling repository was not touched.** I did not modify a file in it, run anything against it,
open its live site, touch Firestore, or port anything to it. The only thing I read of it is the
notice that loads automatically into every session, which is exactly what that notice permits.

---

# The first pass's "To clear" list

### 1. `medWindowDueAt` calls the shared walk — **CLEARED**

`index.html:13651-13658`. The naive interval test is gone; the function filters the medication's own
entries, resolves the window index with `med.windows.indexOf(w)` and asks `coveredWindowFlags`.

**I attacked the `indexOf`, which is the one new assumption.** Every call site must iterate
`med.windows` and pass the object it got from that array, or the index is wrong. All of them do:

| line | caller | iterates |
|---|---|---|
| 1061 | `profileDueCount` (app-icon badge, drawer dot) | `med.windows.forEach` |
| 13404 | `dueRemindersAt` (reactive web notification) | `med.windows.forEach` |
| 13688 | `buildReminderPlan` (OS alarm) | `(med.windows \|\| []).forEach` |
| 14067-14068 | `cancelReminderForEntry` | `windowClaims(d0, mine, med.windows)` then `med.windows.forEach` |
| 14332 | `__v86Test.medWindowDue` | indexes `med.windows` |

So `wi < 0` is unreachable from everything that ships. **It is not harmless if it ever becomes
reachable**, and that is worth a line in the file: the fallback judges the lone window with pass 2's
reach, which for a single window runs to midnight, so it is *more* permissive than the indexed path
— a derived or linked window could be marked covered by a dose ten hours later. A `return true`
(ask anyway) is the safe direction for a reminder; `coveredWindowFlags(d0, mine, [w])` is not.
Latent, not live. A duplicated window object in one array resolves both iterations to index 0; the
data path cannot produce it and the failure mode is a duplicate alarm, not a missing one.

`medWindowsFor` can return a *derived* list (`chemoRelativeWindows`) while all four notification
call sites iterate `med.windows` raw. That divergence is wider than M45 records — M45 names
`linkedTo` only — and is unreachable on today's data for the same reason. Worth folding into M45.

### 2. `dueRemindersAt` uses the shared walk — **CLEARED**

`index.html:13404`. Measured: mutant 9 reverts only this call site and dies on
*"the reactive notification does not fire for a dose logged early"*. It is read at 17:03, inside the
five-minute firing window, which is the only clock where that path's question exists. Correct.

### 3. `cancelReminderForEntry` asks `windowClaims` — **CLEARED**, and I pushed on it

`index.html:14053-14074`. I tried four ways to make it cancel the wrong alarm:

- **Two entries at the same `ts`.** `Number(claim.ts) !== ts` would match both, so both windows'
  alarms are cancelled — but two entries at that instant genuinely cover two windows, so the plan
  agrees. Consistent.
- **A string `ts`.** `Number()` is applied on both sides (`ts` at 14052, `claim.ts` at 14070), and
  `windowClaims`' own filter and sort coerce. No asymmetry.
- **The dose is not the claimer.** Windows 8–12 and 17–21, a dose already logged at 13:00 (which
  claims the morning window in pass 2) and a new one at 16:45: claims come back
  `[13:00, 16:45]`, the guard matches index 1, and only tonight's alarm is cancelled. The v68
  ordering survives — a dose that credits an earlier window does not silence a later one.
- **Windows changed since the alarm was armed.** The tag no longer matches, `hit` is undefined, and
  nothing is cancelled; the next full sync reconciles. Same as before this release.

The synthetic `{medId, ts}` push is guarded by `!mine.some(e => Number(e.ts) === ts)`, so a late
`state.entries` update cannot double-count the dose.

### 4. A check that would have caught this — **CLEARED, and it is the right check**

`test/v94-window-coverage.mjs`, 15 → **33 checks**, and the discriminator the first pass named is
in it verbatim: *"so the armed plan is not identical to a day with nothing logged"*. Two clocks,
16:50 for the plan question and 17:03 for the reactive one, each where its own question exists —
which is the trap the builder fell into on the first attempt and did not fall into twice.

### 5. A mutant per site — **CLEARED, re-run end to end**

`FALSIFY_PORT=9461 ./falsify.sh test/v94-window-coverage.mjs falsify/mutants-v94-coverage.sh`,
7 → 12 mutants, ~6m. **The builder's summary is accurate.**

| mutant | result | dies on |
|---|---|---|
| 1 status naive | caught | 2 checks |
| 2 ring counts entries | caught | 2 |
| 3 unbounded early reach | caught | 6 |
| 4 grace = 0 | caught | 9 |
| 5 passes collapse | caught | 3 |
| 6 late reach to midnight | **caught** (was a declared hole) | 1 — the gap-claim check |
| 7 over-block control | survived as intended | — |
| 8 **alarm plan naive — the BLOCK** | caught | **5** |
| 9 reactive naive | caught | 1 |
| 10 **cancel-on-log inside-window only** | caught | 1 — the stubbed-bridge check |
| 11 **mute drops the kind filter (app-v93)** | caught | 1 |
| 12 `atH` fixed hop (DST) | survived — declared hole, M46 | — |

`10 caught, 0 survived unexpectedly, 0 could not be measured, 0 anchors stale, 1 over-block control
green, 1 known open hole`. Exactly as claimed.

**Mutant 10 is load-bearing.** It is the one the first pass found vacuous, and it now dies on
exactly one check — *"logging the dose 15 minutes early CANCELS that armed alarm"* — reporting
`{"armedCount":3,"tonightId":1235475707,"cancelled":[]}`. The id is armed, the cancel list is empty.
That check is the only thing standing between this mutant and survival, and it does stand.

**Mutant 6's catch is real.** It dies on *"a dose in a gap is credited to the last window, not the
first"*, reporting `[1793980800000, null]` — the claim moved to window 0, which is the defect. The
hole closed because cancel-on-log made the claim readable, not because anything renders a missed
row; `BACKLOG` M44's remaining half says so and is honest about it.

### 6. Correct the count, and grep for any remaining private coverage test — **CLEARED**

`index.html:2534` reads *"There were SIX, and three of them were wrong"*, with all six named and a
paragraph saying why the number is stated at all. The README row keeps the original three-answer
paragraph as the record of the first build and then corrects it explicitly
(*"There were not three answers … there were six"*).

**I grepped the whole file for a surviving private coverage test** — the finding the first pass was
built on and the one most likely to repeat: `e.ts >= `, `e.ts < `, `>= ws`, `< we`,
`w.start * 3600000`, `hourTs(d0, w.start)`. Every remaining hit is a different question (a daily mg
sum, a rolling ceiling, a chart range, a report filter) or a comment. **Six is the true number and
there is no seventh.** Two hits are the subject of D2 below; neither is a coverage test.

### 7. F1's mutant and appointment check — **CLEARED**

Mutant 11 restores the app-v93 block exactly and dies on
*"SILENCING DOES NOT TOUCH THEIR APPOINTMENT ALARM"*, reporting `[101,102,103]` — the appointment
id is in the cancel list. On HEAD it is not. Profile **deletion** still passes no `kinds`, so the
`!kinds` short-circuit clears everything including appointments; that is unchanged at 13879 and the
checks for dose and check-in cancellation both pass.

### 8. F2's one clock, and F4's fixture — **F2 CLEARED in `status()`** (see D2), **F4 NOT CLEARED** (see D4)

`index.html:3103` is `atH = (h) => hourTs(d0, h)` and both `d0 + 86400000` hops are `nextDay()`,
with `availableAt` now `hourTs(tomorrow, first.start)`. Mutant 12 reverts it and survives, which is
honest: every suite in this repo freezes to a non-transition day in UTC on purpose, and M46 asks for
the fixture rather than pretending. **Could a fixture catch it cheaply? Yes — cheaply but not
freely.** One context at `timezoneId: 'America/Chicago'` frozen to 2026-11-01 asserting that the
walk's window and `status()`'s open/close agree would kill mutant 12 in about 40 lines. M46 already
specifies exactly that and sizes it M because it wants to cover all ~40 call sites. The declaration
is honest; the estimate is slightly pessimistic for mutant 12 alone.

---

# New findings

## D1 — the app-icon badge can take a fourth private copy of the naive test and the WHOLE GATE stays green

This release's own README now claims the badge: *"it feeds **both** the OS alarm
(`buildReminderPlan`) and the app-icon badge and drawer dot (`profileDueCount`) — so five surfaces,
not three."* The code is correct. **Nothing in the repository can falsify it.**

Measured, on a byte copy of `index.html` outside the repo. One line changed, `index.html:1064`:

```js
// shipped
if (!medWindowDueAt(med, d0, w, entries)) return;   // already logged in this window
// mutant: a fourth private copy of the predicate this whole release deleted
if ((entries || []).some(e => e && e.medId === med.id && e.ts >= ws && e.ts < we)) return;
```

`ws`/`we` are already in scope two lines above, so this is the smallest possible regression and
exactly the shape that occurred three times in this release.

| suite | shipped | with the naive 4th copy |
|---|---|---|
| `test/v94-window-coverage.mjs` | 33/33 | **33/33 — green** |
| `test/v93-profile-notifications.mjs`, badge checks | `ok` | **`ok` — green** |

v94's suite never reads `profileDueCount`. v93's suite does, and has the right check — *"a dose
already logged is not counted (3 windows open, 1 given)"* — but **its fixture logs the dose at 09:30
inside a 09:00–12:00 window**, which the naive test satisfies, so that check only catches a *deleted*
gate. I measured that half too: deleting the gate outright turns the same check red
(`{"id":"p2","count":3,...}` against an expected 2).

So the surface is guarded against disappearing and unguarded against the actual defect, in the
release whose entire subject is that defect.

**What closes it, and it is small.** One mutant 13 — the diff above — plus moving or adding one dose
in `seedTwo` so that a profile's open window is covered by a dose logged a few minutes *early*
rather than inside. A dose at 08:50 against a 09:00–12:00 window is enough; the naive copy then
counts it due and the check goes red. Recommended before the next release touches this path, not
before this one ships: the shipped build is right on all five surfaces and I measured it.

## D2 — "one clock" stopped at the edge of `status()`, inside two functions this release rewired

F2 is fixed where it was reported. Two sites of the same class remain, both in functions this
release changed:

1. **`index.html:1062`, `profileDueCount`** — `const ws = d0 + w.start * 3600000, we = d0 + w.end * 3600000;`
   decides whether the window is open right now, and the very next line calls `medWindowDueAt`,
   which is now `hourTs`-based. That is F2's mixed clock verbatim, in the badge function, two lines
   apart.
2. **`index.html:2860`, `missedDosesFor`** — the day filter is
   `e.ts >= d0 && e.ts < d0 + 86400000` while `windowClaims`, which consumes its output, bounds the
   day with `nextDay(d0)`. On a 25-hour autumn day a dose logged in the extra hour is dropped from
   `dayEntries` and the window it covered is recorded as missed.

Both are DST-only, both predate this release, and M46 covers the class *by reference* — *"that would
guard every `hourTs`/`nextDay` call site at once — there are about forty"*. Neither is named. Name
them in M46; a class cited as "about forty" is not a list anybody will work from.

## D3 — the check count is wrong in two documents, which is F5's lesson arriving again

The suite has **33** checks (I ran it; the falsify baseline agrees; `release_check.sh`'s comment
says 33). The README's app-v94 row says *"**30 checks**"* and `REQUESTS.md` says *"the suite went
from 15 to 30 checks"*. `release_check.sh` is right and the two documents a reader reaches first are
wrong. F5 was a wrong count in a comment and it cost this release a block; this is the same mistake
in the same release, three lines of fix.

## D4 — the first pass's F3 and F4 are neither fixed nor logged. They are lost.

The brief asks me to confirm they are logged as backlog. **They are not.** `BACKLOG.md` gained M44's
half-closure, M45 and M46; `grep` for F3's subject (a pending notification with no `extra` at all
surviving every cancel path, deletion included) and F4's (the suite's gapped window shapes versus
what `deriveWindowEnds` can actually produce) finds nothing in `BACKLOG.md` or `REQUESTS.md`.

Neither is dangerous — F3 is an orphan path no arming site can reach, F4 is fixture fidelity. But
this project's Rule 7 exists because notes outlive their subjects and findings go missing, and a
finding that was measured, written down by an auditor and then dropped is the cheaper half of that
failure. Two `BACKLOG` entries, S each. **This is the one item I am marking NOT CLEARED.**

## D5 — the new test hooks widen an ungated surface (note, not a finding to act on now)

`window.__v86Test` is assigned under `typeof window !== 'undefined'` with no `TEST_MODE` gate, and it
now includes `cancelForEntry`, which drives the plugin's `cancel()`. That gate has been absent since
app-v85/86 and this release did not introduce it; it is worth knowing before store submission, when
`TEST_MODE` comes down, that this object comes down with it or does not.

---

# What I checked and found clean

- **The hooks are the shipped functions, not copies.** `reminderPlan` → `buildReminderPlan`,
  `medWindowDue` → `medWindowDueAt`, `dueReminderKeys` → `dueRemindersAt`, `windowClaimTs` →
  `windowClaims`, `cancelForEntry` → `cancelReminderForEntry`, `armedTags` → `notifPlanApplied`.
  No re-implementation, so no suite agreeing with itself. There is no test-only branch in the app.
- **`dueReminderKeys` is genuinely pure.** `notifSentToday` is `let` at 13265, so the reassignment
  works; it is saved before and restored in a `finally`, so it survives a throw. The hook drops
  `_day` while it runs and puts the original object back, so a second read returns the same answer
  and the app's own day bookkeeping is untouched.
- **`windowClaims` kept every property `coveredWindowFlags` had.** `claimed` is still a `Set` of
  object references from the caller's own array, so one entry can claim at most one window; the
  `[d0, nextDay(d0))` filter still runs before the walk, so no claim crosses a day; each call site
  still passes one medication's entries, so no claim crosses a medication. Pass 1 is still
  `[start − 2h, end]` and pass 2 `[start − 2h, nextWindowStart)`, and the two-hour bound is enforced
  on the notification path too — the check *"a dose more than two hours early leaves the alarm
  armed"* is red under mutant 3.
- **`coveredWindowFlags` is a pure `.map(c => !!c)` wrapper** and the three screen surfaces still
  call it, so the first pass's screen measurements stand without re-running them.
- **The changelog entry obeys Rule 0.9 and is true.** Title five words, three bullets, 59 words. The
  third bullet — *"The reminder and the app-icon count do the same — logging early switches them
  off"* — is true on both halves: `profileDueCount` reaches `medWindowDueAt`, which I confirmed by
  call site and by mutating it. No mechanism, no version, no seat named.
- **`test/v85-profile-reminders.mjs` exists and the gate loop actually runs it.** It is in the
  `for SUITE in` list at `release_check.sh:959`, the same loop the parse gate guards, not in a
  comment.
- **`missedDosesFor`'s stale comment is gone** and what replaced it says where the walk went.
- **The `linkedTo` qualification is stated rather than implied** at 2952-2965 and logged as M45,
  which is the honest handling of a divergence that is unreachable today.
- **No version literal, no `document.body.textContent` assertion, no `|| true`** in the new checks;
  they select by `data-` hooks and `aria-label`, freeze with `Date.UTC` *and* `timezoneId: 'UTC'`,
  and fail themselves on console noise. The new notification checks read decisions, never strings.
- **No patient name, no pronoun about a patient, no dose or schedule from one care plan** in
  anything I wrote. Every probe is outside the repository; the one file I committed is this report.

# Reproductions, with timings

| # | What | Where | Time | Result |
|---|---|---|---|---|
| 1 | Tree verification — sha, 2 md5s, 2 version strings, clean tree, before and after | `git`, `md5sum`, `grep` | 3s | all match |
| 2 | `test/v94-window-coverage.mjs` on HEAD | repo | 36s | **33/33** |
| 3 | Full falsify sweep, 12 mutants | repo, port 9461 | ~6m | **10 caught, 0 unexpected, 1 hole (12), 1 control green** |
| 4 | Call-site audit of `medWindowDueAt`'s `indexOf` — 5 sites | grep + read | 4m | identity holds everywhere |
| 5 | Remaining-private-coverage-test grep, whole file, 6 patterns | grep | 3m | six is the true count |
| 6 | `profileDueCount` gate DELETED → v94 suite | copy outside repo | 40s | 33/33 green (blind) |
| 7 | Same mutant → `v93-profile-notifications` badge checks | copy outside repo | 60s | **red**, count 3 vs 2 |
| 8 | `profileDueCount` naive 4th copy → v94 suite | copy outside repo | 38s | **33/33 green — D1** |
| 9 | Same → `v93-profile-notifications` badge checks | copy outside repo | 55s | **green — D1** |
| 10 | `cancelReminderForEntry` attacked 4 ways (same ts, string ts, non-claimer dose, changed windows) | read + arithmetic | 5m | sound |
| 11 | Changelog word count and truth of each bullet | read + call sites | 2m | 59 words, all true |
| 12 | `BACKLOG`/`REQUESTS` grep for F3 and F4 | grep | 1m | **absent — D4** |

# What I did not run, and took on trust

Taken from the builder on this exact tree, not re-measured — I spent the time where a wrong dose
lives:

- `test/overflow-scan.mjs` (171 checks, ~7m), `test/contrast-scan.mjs` (327),
  `test/v84-whatsnew.mjs` (100), `test/v90-chart-axes.mjs` (162),
  `test/v89-everything-free.mjs` (75), `test/v92-pill-clearance.mjs`,
  `test/v92-text-collisions.mjs`, `test/v76-properties-equivalence.mjs`,
  `test/v76-empty-window-render.mjs`, the designer suite. All reported green.
- **`test/v85-profile-reminders.mjs` (43 checks) — not run.** I verified it exists and that the gate
  loop runs it, which is what F3 of the v93 audit was about.
- **`test/v93-profile-notifications.mjs` — run only against copies, and only its first ~20 checks
  are trustworthy from my runs.** On both a pristine copy and a mutated one it reached the profile
  and badge checks, reported them, and then died later in the run on a Playwright click timeout.
  Because it timed out identically on the *clean* copy, that is my probe directory and not a defect
  in the tree — I did not chase it, and I did not run the suite in the repository. Its green result
  on HEAD is the builder's, taken on trust; the badge checks I quote I saw run.
- `falsify/mutants-v93-profiles.sh` — not run. Mutant 11 in the v94 corpus now covers the
  appointment claim, which was F1's ask.
- `test/v75-no-other-patient.mjs` — not run before writing. I added no application code and the one
  file I wrote names no patient, no pronoun about a patient and no dose.
- `release_check.sh` end to end — not run. I verified the suite list only.
- **No real device, no APK.** Every notification measurement here, mine and the suite's, goes through
  the shipped functions with a stubbed Capacitor bridge. Somebody should still watch a phone stay
  quiet after an early log once, which is the one thing none of this can prove.

# To clear this audit

Nothing blocks the release. In order of value:

1. **D4 — log F3 and F4 in `BACKLOG.md`.** Two S entries. They were measured and then lost, which is
   the failure Rule 7 is about.
2. **D1 — mutant 13 plus one early dose in `seedTwo`.** The badge is claimed and unfalsifiable.
3. **D3 — correct "30 checks" to 33** in the README's app-v94 row and in `REQUESTS.md`.
4. **D2 — name `profileDueCount:1062` and `missedDosesFor:2860` in M46**, and fold the
   `chemoRelativeWindows` half of the window-list divergence into M45.
5. Optional, one line: make `medWindowDueAt`'s `wi < 0` fallback `return true` rather than judging a
   lone window with pass 2's reach to midnight, so the unreachable branch fails safe if it ever
   becomes reachable.

The notification work is good, and the part that is best is the part that is hardest to get credit
for: the suite reads decisions instead of strings, it uses two clocks because the two questions live
at different times, and the one mutant that had been passing for an incidental reason was found and
made to bite. The first pass blocked because every gate here read the screen. This delta put a gate
on the surface that wakes people up.
