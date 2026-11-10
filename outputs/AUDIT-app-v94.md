AUDITED-COMMIT: 0242928acb684f99bb4bdf3ffa19983478759185
VERDICT: DO NOT SHIP

# Zero Day Auditor — ChemoWell app-v94

**One BLOCK.** app-v94 fixes "the app asks for a dose that was already given" on the Home screen
and leaves it in place on the **notification** path. On the exact fixture Aaron reported — one
window 17:00–21:00, one dose logged at 16:45 — the screen now reads *"All scheduled doses are in"*
and the OS alarm for 17:00 **stays armed**. Measured: the reminder plan for that fixture is
byte-identical to the plan for a day with **nothing logged at all**.

That is also the shape of the app-v93 BLOCK this same release is fixing: the UI says one thing and
the notification does another. This release repairs that on appointments and reintroduces it on
doses.

## The tree I audited

| | measured | expected |
|---|---|---|
| HEAD | `0242928acb684f99bb4bdf3ffa19983478759185` | matches |
| branch | `claude/caretracker-team-review-i83ik2` | matches |
| `index.html` md5 | `c2bde2c3430de5eeb8e8bdbbf5d2ca8b` | matches |
| `sw.js` md5 | `8efcc1e7e7c55a22902057b722b5a58b` | matches |
| `APP_VERSION` (index.html:9805) | `app-v94` | matches |
| `sw.js` CACHE (sw.js:1) | `chemowell-app-v94-1` | matches |
| `git status --porcelain` | empty, before and after my work | clean |

Nothing moved under me. `index.html` md5 was re-checked after every probe and is unchanged — all
patching was done on a copy outside the repo.

**`care-tracker` was not touched.** I did not modify a file in it, did not run anything against it,
did not open its live site, did not touch Firestore and did not port anything to it. I read its
`CLAUDE.md` notice only, which is what that notice permits.

---

# BLOCK 1 — the notification path still asks for the dose that was already given

## What it costs a patient

A caregiver gives a dose a few minutes before the window opens — which is the whole reason this
release exists — and the phone fires **"<Med> Due — <window> dose window has opened"** at the top
of the hour anyway. The Home screen, now fixed, says the day's doses are in. The alarm says give it.
A caregiver who trusts the thing that buzzed at them gives a second dose.

Pre-v94 the two surfaces at least agreed with each other (both wrongly said "due"). After v94 they
contradict each other, and the one that is wrong is the one that interrupts you.

## Why it is this release's defect

The release's claim, in `README.md`'s app-v94 row and in the file's own comment at `index.html:2537`:

> *"THE APP HELD THREE ANSWERS TO 'HAS THIS WINDOW BEEN COVERED' AND TWO WERE WRONG … `coveredWindowFlags()` is now the only implementation and all three call it."*

It held **six**. app-v94 unified three and left three, and all three it left are on the notification
path, which is the loudest surface the app has:

| line | function | surface | predicate |
|---|---|---|---|
| 13363 | `dueRemindersAt` | reactive web notification | `entriesFor(med.id).some(e => e.ts >= ws && e.ts < we)` |
| 13596 | `medWindowDueAt` | **native alarm arming** (`buildReminderPlan`) | `!(entries\|\|[]).some(e => e.medId === med.id && e.ts >= ws && e.ts < we)` |
| 13998 | `cancelReminderForEntry` | **cancel-on-log, the surgical path** | `if (ts < hourTs(d0,w.start) \|\| ts >= hourTs(d0,w.end)) return;` |

Line 13596 is character-for-character the predicate the release's own comment names as the defect
(`e.ts >= windowStart && e.ts < windowEnd`). Line 13998 is why nothing self-heals: the instant the
16:45 dose is logged, the surgical cancel decides the dose "isn't in this window" and returns
without cancelling, and the next full sync rebuilds the plan through 13596, which cannot see it
either. The alarm survives to fire.

`coveredWindowFlags` was available to all three. None of them calls it.

## Measured evidence

Probe: the **shipped** `buildReminderPlan`, driven through the repo's own `window.__v86Test.buildReminderTitles()`
hook (the same route `test/v93-profile-notifications.mjs` uses), clock frozen at 16:50 with
`timezoneId: 'UTC'`, one `type: 'win'` medication with a single 17:00–21:00 window.

| fixture | armed dose reminders (72h horizon) | Home screen |
|---|---|---|
| **A** dose logged 16:45 | **3** — `["<Med> Due","<Med> Due","<Med> Due"]` | `allIn: true`, `due: false` |
| **B** control, nothing logged at all | **3** — identical | `allIn: false`, ring `0 of 1` |
| **C** control, dose logged 18:30 inside an 18:00–21:00 window | **2** (today's correctly suppressed) | `allIn: true` |

**A equals B.** The arming path cannot distinguish "already given" from "never given". C is the
control that proves the old predicate still functions for a dose logged *inside* the window — so
this is precisely the early-dose blind spot, not a dead code path.

This is live on the shipping target. `syncNativeReminders` only returns early on `!isNativeApp()`
and on `TEST_MODE && state.dateOffsetDays` (a date override being active), so on the Capacitor build
the plan arms normally.

## The fix, measured both ways

Smallest change that closes it, on a byte copy of `index.html` outside the repo, served on its own
port. Replace `index.html:13593-13597`:

```js
function medWindowDueAt(med, dayTs, w, entries) {
  const d0 = dayStart(dayTs);
  const windows = med.windows || [];
  const i = windows.indexOf(w);          // buildReminderPlan iterates med.windows, so identity holds
  if (i < 0) return true;
  const mine = (entries || []).filter(e => e && e.medId === med.id);
  return !coveredWindowFlags(d0, mine, windows)[i];
}
```

Same probe, same fixtures, against the patched copy:

| fixture | before | after |
|---|---|---|
| A — dose logged 16:45 | 3 armed | **2 armed** (today's 17:00 alarm gone) |
| B — nothing logged | 3 armed | **3 armed** (unchanged — it did not blanket-suppress) |
| C — dose inside the window | 2 armed | **2 armed** (unchanged) |

Red before, green after, with B as the falsification that the fix did not simply stop arming
reminders. `test/v94-window-coverage.mjs` is 15/15 on the patched copy as well — it never reads the
notification path, so it cannot see either the defect or the fix.

`dueRemindersAt` (13363) and `cancelReminderForEntry` (13998) need the same treatment for the
non-TEST_MODE web install and for cancel latency; fixing 13596 alone is what closes the alarm,
because the reconcile in `syncNativeReminders` then cancels what the plan no longer contains.

---

# Non-blocking findings

## F1 — the app-v93 half of this release has no test and no mutant behind it

I measured the fix and **it is correct** (below). But nothing in this repo will notice when it
regresses, and the brief's own warning about app-v93 was that the one claim with no mutant behind it
was the false one.

- `grep -n "appt\|Upcoming" test/v93-profile-notifications.mjs` → **no matches.** The suite that
  owns profile notifications does not mention appointments.
- `falsify/mutants-v93-profiles.sh` has 13 mutants. None touches `kinds`, `cancelRemindersForProfile`
  or an appointment. Deleting the `kinds` argument entirely would survive the whole corpus.
- `falsify/mutants-v94-coverage.sh` has 7 mutants, all on `coveredWindowFlags`. None on the v93 fix.

So the three-line fix for a BLOCK ships with zero coverage, in a release whose own suite was written
because "a unit test on either half alone passed throughout".

**My measurement of it**, for the record — Capacitor `LocalNotifications` stubbed, pending set seeded
with seven alarms across two profiles and all three kinds, recording every id that reaches `cancel()`:

| pending alarm | muting p2 cancels it? | correct? |
|---|---|---|
| id 4 — `{kind:'dose', profileId:'p2'}` | **yes** | yes |
| id 5 — `{kind:'appt', profileId:'p2'}` | **no** | yes — this is the app-v93 BLOCK, fixed |
| ids 1,2,3,6,7 — profile p1 | no | yes |

`setProfileMuted('p2', true)` → `cancelled: [[4]]`. The fix works.

`grep -n "kind: '"` over the whole file finds exactly three notification kinds — `dose`, `checkin`,
`appt` — so `['dose','checkin']` is a complete enumeration of what muting should cancel, not a
list that happens to be right today. An alarm with a **missing** `extra.kind` survives a mute
(`['dose','checkin'].indexOf(undefined) === -1`), which is the safe direction, and is cleared on
deletion (`!kinds` short-circuits the filter). Both correct.

**To close F1:** one mutant that drops the `kinds` argument from the `setProfileMuted` call, and one
check in `test/v93-profile-notifications.mjs` asserting an appointment reminder survives a mute.

## F2 — `status()` now runs two different clocks inside one function

`coveredWindowFlags` uses the DST-safe `hourTs(d0, hour)` (calendar `setHours`). The loop that
consumes its output, six lines later, still uses `atH = (h) => d0 + h * 3600000` — raw millisecond
arithmetic, the exact thing `hourTs`'s own comment says it exists to avoid.

Measured, `timezoneId: 'America/Chicago'`, 2026-11-01 (fall back, a 25-hour day), window 17:00–24:00:

```
hourTs(d0, 17) → Sun Nov 01 2026 17:00:00 GMT-0600   (correct)
atH(17)        → Sun Nov 01 2026 16:00:00 GMT-0600   (one hour early)
```

So on the two DST days a year, `coveredWindowFlags` asks about one window and `status()`'s
`now < ws` / `now >= ws && now < we` comparisons ask about a window an hour away. Visible effect:
the card reads "Due now" an hour before the window opens on a fall-back day, and the "opens at"
time it offers is an hour off. `cancelReminderForEntry` (13998) uses `hourTs` while `medWindowDueAt`
(13594) uses raw arithmetic, so those two disagree on the same two days.

The `atH` bug predates app-v94 and is not this release's doing. What *is* new is the mixed clock
inside `status()`: this release put a DST-safe clock on one half of the function and left the other
half raw. Fix: `const atH = (h) => hourTs(d0, h);`.

## F3 — an alarm with no `extra` at all is never cancelled, even on profile deletion

`cancelRemindersForProfile` (13879) filters `p.extra && p.extra.profileId === profileId`. A pending
notification with no `extra` object survives every cancel path, deletion included. In my probe, id 7
(`{id:7, title:'no-extra p1'}`) never appeared in any cancel list. Not reachable from the three
arming sites, which all set `extra` — but it is an orphan-alarm path on a function whose job is to
leave nothing behind. Pre-existing, not introduced here.

## F4 — the new suite's fixtures use window shapes the app's own editor cannot produce

`deriveWindowEnds` (8313) sets each window's `end` to the **next window's start**, and the last
window's to `24`. Windows a user creates are therefore **contiguous**: starts at 8 and 17 become
`[8,17]` and `[17,24]`, never `[8,12]` and `[17,21]`.

`test/v94-window-coverage.mjs` uses `TWO = [{start:8,end:12},{start:17,end:21}]` and
`EVENING = [{start:17,end:21}]`. Gapped windows do exist — the legacy table at 1566 carries
`[{8,12},{14,18}]` — so this is not dead geometry, but it is **legacy-only**, and two consequences
follow for user-created medications:

1. **Pass 2 is close to a no-op.** With `end_i == start_{i+1}`, pass 1's range `[lo, we]` and pass
   2's `[lo, hi)` differ only in endpoint inclusivity. The two-pass structure, mutant 5's catch and
   the declared hole M44 all live in gapped geometry.
2. **The 2-hour grace of window N+1 reaches 2 hours back into window N.** Starts 8 and 17, doses
   logged at 15:00 and 16:00: pass 1 gives 15:00 to the morning window and 16:00 to the evening one,
   so the day reads 2 of 2. That is arguably the grace doing its job ("given a bit early"), and I am
   not calling it a defect — but the suite's "two doses in one window count as ONE window covered"
   check only holds while both doses sit more than two hours clear of the next start, which with
   contiguous windows is a narrower guarantee than the check's wording suggests.

Worth one fixture in the suite built through `deriveWindowEnds` rather than hand-written, so the
geometry under test is the geometry that ships.

## F5 — the "three answers" count is wrong in the README and in the code comment

`index.html:2537` — *"There were THREE, and two of them were wrong"* — and the README's app-v94 row
make the same count. There were six. The next session reading that comment will believe the
unification is complete; it is the reason BLOCK 1 is shipping. Correct the count in both places as
part of the fix.

---

# What I checked and found clean

This is as much of the value as the findings — it says what the next session need not redo.

- **The reported bug is genuinely fixed on Home.** Dose at 16:45, window 17:00–21:00: card no longer
  says "Due now", panel reads "All scheduled doses are in". I reproduced the fixed state, and mutant
  1 restores the defect and the suite goes red on it.
- **Claim bookkeeping is sound.** `claimed` is a `Set` of entry object references, declared inside
  `coveredWindowFlags`, holding elements of a `filter(...).sort(...)` of the caller's array — so the
  references are the caller's objects and each entry can be claimed at most once. **One dose can
  never cover two windows.** `claimed` cannot leak across medications (each call site passes one
  medication's entries) or across days (the `[d0, nextDay(d0))` filter runs before the walk).
- **The mirror hazard is bounded as claimed.** A dose 2h01m early does *not* cover the window
  (suite check 2); mutant 3 (`lo: d0`, unbounded reach) is caught by five checks; mutant 4
  (grace = 0) by two.
- **v68 still holds.** A 13:00 dose against windows at 8 and 17 credits the morning window it was
  late for rather than being stolen by the evening one.
- **The 16:00 case the two-pass design exists for is fixed**, and that is the check that dies under
  mutants 1, 4 and 5 — it is carrying real weight, not decoration.
- **Ring, card and missed rows agree on Home**, including the case that shipped broken: two doses in
  one window now read `1 of 2`, not `2 of 2`, beside a card that still asks.
- **`test/v94-window-coverage.mjs` is 15/15 on HEAD** (13.0s), and 15/15 on my patched copy.
- **The mutant corpus's own summary is accurate.** I ran it: 5 caught, **0 unexpected survivors**,
  1 declared hole (6), 1 over-block control green (7), exit 0. Mutant 6's "not observable from Home"
  claim is **true** — I confirmed the suite renders only Home and no check reads a missed row — and
  the hole really is only that: `hi` is consulted solely in pass 2, which under gapped geometry
  decides which window is credited for a gap dose, and the dose *count* is the same either way.
- **Edge cases do not throw and do not spam.** 11 medications in one render — three-window meds,
  a `windows: []` med, a paused med, an as-needed med — with 240 entries on the day: 11 cards
  rendered, ring `24 of 26`, **zero console errors or warnings**. The `windows: []` path that threw
  in the app-v76 phase 1 audit is still guarded.
- **No per-render cost worth reporting.** `totalDueCount()`, which walks every medication through
  `coveredWindowFlags`, measured at **0.080 ms** per call over 20 calls with 240 entries and 11
  medications. The v93 audit's 2.3 ms finding has no counterpart here.
- **`release_check.sh` genuinely gates the new suite.** `test/v94-window-coverage.mjs` is in the
  `for SUITE in` list at line 950, so it cannot be skipped.
- **No version literal, no `document.body.textContent` assertion, no `|| true` in the new suite.**
  It selects by `[data-home="up-next"]` and by `aria-label`, freezes the clock with `Date.UTC` *and*
  `timezoneId: 'UTC'`, and fails itself on console noise. It is a good suite. Its blind spot is
  scope, not rigour: it reads one screen, and the defect I am blocking on is on another surface.
- **No trace of the other patient written anywhere.** I committed one file, this report, and it
  names no patient, no dose and no care plan. Every probe lives outside the repo.

# Reproductions, with timings

| # | What | Where | Time | Result |
|---|---|---|---|---|
| 1 | Tree verification (sha, 2 md5s, 2 version strings, clean tree) | `git`, `md5sum`, `grep` | 2s | all match |
| 2 | `test/v94-window-coverage.mjs` on HEAD | repo | 13.0s | 15/15 |
| 3 | Notification plan on the reported fixture + 2 controls | probe, shipped hook | 48s | **BLOCK 1** |
| 4 | Same probe on the patched copy | copy outside repo | 46s | 3→2, controls held |
| 5 | `test/v94-window-coverage.mjs` on the patched copy | copy outside repo | 13s | 15/15 |
| 6 | v93 `kinds` filter, Capacitor stubbed, 7 pending alarms | probe | 22s | fix correct (F1) |
| 7 | DST divergence, America/Chicago 2026-11-01 | probe | 14s | 1h apart (F2) |
| 8 | 11 meds / 240 entries / empty-windows / paused / as-needed + cost | probe | 16s | clean, 0.080 ms |
| 9 | `falsify/mutants-v94-coverage.sh`, all 7 mutants | repo | ~3m | 5 caught, 0 unexpected, exit 0 |
| 10 | Window geometry: `deriveWindowEnds`, legacy table, call-site grep | read + grep | 4m | F4 |

# What I deliberately did not run

Taken on trust from the builder, not re-measured — I spent the time where a wrong dose lives:

- `test/overflow-scan.mjs` (171 checks, ~7m), `test/contrast-scan.mjs` (327), `test/v84-whatsnew.mjs`,
  `test/v90-chart-axes.mjs`, `test/v92-pill-clearance.mjs`, `test/v92-text-collisions.mjs`,
  `test/v89-everything-free.mjs`, `test/v76-*`, the designer suite. All reported green.
- `test/v93-profile-notifications.mjs` — not run. F1 is about what it *contains*, which I read; I
  measured the v93 fix myself instead.
- `test/v75-no-other-patient.mjs` — not run. I added no app code, so its three ratchet numbers
  cannot have moved; the one file I wrote names no patient.
- `falsify/mutants-v93-profiles.sh` — not run. I read all 13 descriptions; none is about `kinds`.
- No real device, no APK. The notification BLOCK is measured through the shipped `buildReminderPlan`
  with a stubbed bridge, which is what this repo's own v93 suite does. Someone should still see a
  phone fail to buzz once the fix is in.
- `release_check.sh` end to end — not run; I verified the suite's presence in its gate list only.

# To clear this audit

1. **`index.html:13593-13597` — `medWindowDueAt` calls `coveredWindowFlags`.** Patch and measurement
   are above. This is the one that closes the alarm.
2. **`index.html:13363` — `dueRemindersAt`** uses the same walk, for the non-TEST_MODE web install.
3. **`index.html:13998` — `cancelReminderForEntry`** uses the same walk, so a logged dose cancels its
   alarm immediately rather than waiting for a reconcile.
4. **A check that would have caught this.** Extend `test/v94-window-coverage.mjs` (or a sibling) to
   assert the *armed reminder plan* for the 16:45 fixture, not only the rendered screen — the two
   surfaces disagreeing is the whole defect class, and the suite currently reads one of them. Fixture
   B above is the discriminator: the plan for "dose given" must differ from the plan for "nothing
   logged".
5. **A mutant per site.** Restore each naive predicate; each must die.
6. **Correct the count** in `index.html:2537` and in the README's app-v94 row: six implementations,
   not three. A comment that says the unification is done is how the next session misses the rest.
7. **F1's mutant and appointment check** (cheap, and it covers the other half of this release).
8. Optional but cheap: F2's one-line `atH`, and F4's fixture built through `deriveWindowEnds`.

The window-coverage work itself is good — the two-pass reasoning is sound, the corpus is honest
about its hole, and the suite is the right kind of suite. It stopped one surface short of the
surface that wakes people up.
