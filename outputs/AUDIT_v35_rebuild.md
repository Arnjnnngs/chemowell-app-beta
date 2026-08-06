# Auditor report — v35 pre-scheduled native notifications

**Scope.** Line-by-line code audit of the v35 notification engine + its blast radius in
`/home/claude/chemowell-app-beta/index.html` (current on-disk version, `app-v35`, post-Designer-fix
commit `171e702`), plus live end-to-end Playwright testing against the running app on both
`http://127.0.0.1:8917/index.html` and `http://127.0.0.1:8910/index.html` (verified byte-identical
behavior on both — same pass/fail pattern on every check).

**Method.** Read the full engine block (index.html ~5806–6220), the `addEntryDB`/appointment/sim-date
hooks, `renderNativeNotifStatusCard`, and diffed the relevant functions against the pre-v35 base
(`git show a073e70:index.html`) to separate "pre-existing behavior" from "new in this rebuild." Wrote
a new Playwright harness, `/home/claude/chemowell-app-beta/outputs/audit_v35_live_tests.mjs` (10
checks, T1–T10), reusing the fake-clock/Capacitor-stub pattern from `verify_v35_rebuild.mjs` but
driving the actual rendered UI (button clicks via `aria-label`/text match, not `page.evaluate` calls
into module scope, which isn't reachable). Full raw run log:
`/home/claude/chemowell-app-beta/outputs/audit_v35_live_tests_8917.log`. Also re-ran the existing
`verify_v35_rebuild.mjs` (6/6 pass, confirms the Designer's disabled-button blocker is genuinely fixed
on this build) and `verify_smoke_v24.mjs` (full pass, no console errors, no overflow at any width) as
regression checks.

---

## Findings

### F1 — BLOCKER: three of the four medication-config mutation paths never call `markNotifDirty()` — deleting or pausing a medication leaves its native alarms armed for up to 6 hours (or indefinitely if nothing else happens to trigger a resync)

**Where:** `deleteMedicationConfig()` (index.html ~4051–4069), `setMedicationPaused()` (~4016–4029),
and the add/edit save path inside the medication editor's submit handler (~3990–4001, the function
containing `persistMedicationConfig(meds, state.archivedMeds); setState({ meds, medEditor: null, ... })`
around line 3997–3998). None of these three call `markNotifDirty()`. Confirmed via `git diff a073e70
-- index.html` on each function: all three are **byte-identical to the pre-v35 base** — v35 simply
never touched them. `outputs/REBUILD_v35_report.md`'s own "where the code lives" list only mentions
`addEntryDB`, the appointment CRUD hooks, and the sim-date hooks as `markNotifDirty()` call sites —
medication CRUD is absent from that list entirely, which matches what's actually in the file.

A fourth, lower-severity instance of the same root cause: `removeEntryDB()` (~206–209, called by
`removeEntry()`, the "delete a history entry" action) also never calls `markNotifDirty()`. Undoing a
mistaken dose log should potentially re-arm that window's reminder if it's still inside the 72h
horizon; it doesn't, promptly.

**Why this matters:** `syncNativeReminders()` only runs when something calls `markNotifDirty()` (400ms
debounced) or when the `NOTIF_SYNC_MAX_AGE_MS` (6h) backstop fires. Editing a medication's dose
windows, pausing it, or deleting it outright changes what buildReminderPlan() *should* produce, but
nothing tells the engine to recompute — the stale, already-armed alarms from the old plan keep sitting
on the device, unrelated to what's now in Settings/Meds. Worst case for a deleted or fully-turned-off
medication: the caregiver gets a "Zofran Due" native alarm at the old scheduled time for a medication
that no longer exists in the app, for up to 6 real hours after deleting/pausing it (or longer, since
the 6h backstop itself is a plain, non-forced `syncNativeReminders()` call — see F3, which can
independently fail to actually re-sync even when it fires).

**Live-tested, not inferred (T4, T9 in `audit_v35_live_tests.mjs`):**
- **T4 (delete):** seeded Zofran with 2 windows/day, 3-day horizon → 6 "Zofran Due" alarms armed at
  boot. Opened the Meds tab, clicked the real "Remove Zofran" button, clicked the real "Confirm removal
  of Zofran" button (genuine DOM clicks through the UI, not module calls), waited 2.2s (well past the
  400ms debounce). Result: **`zofranStillPending=true`**, all 9 originally-armed device notifications
  (6 Zofran + 3 Dexamethasone) still present, `afterPendingTitles` still lists `"Zofran Due"` six times.
  `deleteMedicationConfig()` never ran markNotifDirty, so no resync was ever attempted.
- **T9 (pause):** same seed, opened the medication editor, clicked the real "Pause" button. Result:
  **`zofranPendingAfterPause=6`** (unchanged from `zofranPendingBeforePause=6`), `scheduleCallsAfter=1`
  (still just the original boot-time sync — no second sync attempt was ever made).

Both reproduced identically on `127.0.0.1:8917` and `127.0.0.1:8910`.

**Fix direction:** add `markNotifDirty()` to the end of `deleteMedicationConfig()`,
`setMedicationPaused()`, the med-editor save handler, and `removeEntryDB()` — the same one-line pattern
already used correctly in the appointment CRUD hooks and sim-date hooks.

---

### F2 — SHOULD-FIX (blast radius): on native builds, the pre-existing reactive dose-reminder path (`checkNotifications`/`dueRemindersAt`/`sendNotif`) can fire a second, independently-scheduled native notification for a window v35 already pre-armed, producing a duplicate

**Where:** `checkNotifications()` (~5731–5757) is unconditionally called every second by the
`setInterval` loop (~6180) regardless of `isNativeApp()`. Its own permission gate —
`if (!isNativeApp() && (!('Notification' in window) || Notification.permission !== 'granted')) return;`
— only blocks the *web* build; on native it always proceeds. `sendNotif()` (~5657–5673) has its own
native branch that calls `window.Capacitor.Plugins.LocalNotifications.schedule(...)` directly, with its
own id (hashed from a tag that does **not** include `profileId` or `dayTs`, unlike v35's
`notifDoseTag`), firing ~300ms after being detected due. This reactive-native behavior is **not new** —
confirmed byte-identical against the pre-v35 base (`git show a073e70:index.html`) — but v35 is new, and
nothing in v35 accounts for the interaction: on a native device with the app open in the foreground
exactly when a dose window opens, the caregiver can now get **two** "Zofran Due" notifications for the
same window: one from the AlarmManager alarm v35 pre-armed at boot (fires at the exact window-open
instant), and a second ~300ms–1min later from the reactive path noticing the same window is due.

**Live-tested (T8):** seeded Zofran with a 9–12 window, booted 60s before 9:00 (inside the plan's
horizon, so v35 armed it: boot `schedule()` call included `{"id":1930285767,"title":"Zofran Due",...,
"at":1786438800000}`, i.e. exactly 9:00:00). Advanced the fake clock across 9:00:00 while the page
stayed open (simulating the app being foregrounded at the moment the window opens) and waited for the
1s tick. A **second** `schedule()` call fired ~32s later: `{"id":160329623,"title":"Zofran Due","body":
"Zofran — Morning dose window has opened","at":...+300ms,"extra":null}` — a genuinely different id (no
`dayTs`/`profileId` in its tag), same title/body, i.e. a real duplicate as far as the caregiver's
notification shade is concerned. `reactivePathFiredSecondSchedule=true` in the raw output.

**Why should-fix, not blocker:** only reachable when the app happens to be open in the foreground at
the exact moment a pre-armed window opens (the common closed/locked-phone case v35 exists for is
unaffected — only the AlarmManager alarm fires then), and it's an extra reminder, not a missing one —
annoying/confusing for a caregiver, not silent data loss. Still worth fixing before release: a
duplicate "your loved one's Zofran is due" notification right as a caregiver is looking at the app is
exactly the kind of small trust-eroding glitch Aaron's "zero errors" bar is meant to catch.

**Fix direction:** gate `checkNotifications()`/`checkAppointmentReminders()`'s `sendNotif()` calls
behind `!isNativeApp()` (or make `sendNotif()`'s native branch a no-op) now that v35 pre-schedules the
same events for native — the reactive path's only remaining job on native is none; v35's engine fully
replaces it there.

---

### F3 — SHOULD-FIX: the 6h backstop calls `syncNativeReminders()` **without** `force: true`, so it can itself get silently defeated by the same signature short-circuit it exists to route around

**Where:** the backstop line (~6187): `if (isNativeApp() && Date.now() - notifLastSyncAt >
NOTIF_SYNC_MAX_AGE_MS) syncNativeReminders();` — no `{ force: true }`. Contrast with every other
"make sure this really happens" call site in the file (`retryNotifPermission`, the `failed`-state "Try
again" button, boot), all of which pass `{ force: true }`.

**Why this matters:** `syncNativeReminders()`'s signature short-circuit —
`if (!opts.force && signature === notifLastSignature) return;` — sits **before** the permission check,
the `getPending()` diff, and the `notifLastSyncAt` update. If the ideal plan hasn't changed since the
last successful sync (a real, common case — e.g. only appointment-based reminders with no daily dose
windows, or a session where nothing else happened to call `markNotifDirty()` in between), a call with
no `force` returns instantly without ever re-checking `notifPermState`/`notifExactState` and without
updating `notifLastSyncAt`. If the OS silently revokes notification permission behind the app's back
(a real Android scenario — the user can flip this in system Settings at any time without the app
ever knowing) while the plan signature happens to stay static, the un-forced backstop call can hit this
same short-circuit and do nothing — meaning the Settings card can keep showing "✓ Notifications are on"
indefinitely after the underlying permission was actually revoked, with no path back to "blocked"
except a genuine plan change.

**Live-tested (T10):** seeded a config with **no medications** and a single far-out appointment (so the
ideal plan is static — no daily dose-window churn to force a natural signature change). Booted, let the
initial sync succeed (`bootPendingCount=1`). Then simulated the OS silently revoking permission
(flipped the stub's `permState` to `'denied'` directly, with no in-app action — exactly modeling "user
went to system Settings and turned it off") and advanced the clock past the 6-hour backstop threshold
with no other trigger. After the backstop fired: **the Settings card still read "✓ Notifications are
on"** (`cardStillShowsOnStale=true`, `cardShowsBlocked=false`) — it never picked up the revoked
permission, because the recomputed plan's signature was unchanged and the un-forced backstop call
short-circuited before ever reaching `ln.checkPermissions()`.

**Why should-fix, not blocker:** in the common case (a real medication regimen with daily dose windows)
the plan's shape naturally drifts as windows fire/expire, so the signature is very likely to differ
across any given 6h window in practice, making this self-limiting rather than a guaranteed permanent
stall — but it's not guaranteed, and it directly undermines the one comment in the file promising a
"backstop... regardless" (~6182–6187).

**Fix direction:** `syncNativeReminders({ force: true })` on the backstop line — a one-word change that
makes the backstop's guarantee actually unconditional, matching its own comment.

---

### F4 — NICE-TO-HAVE (code-analysis, not live-reproduced): `notifPlanApplied` is left describing the pre-attempt plan when `ln.cancel()` succeeds but the immediately-following `ln.schedule()` throws in the same sync pass

**Where:** `syncNativeReminders()` catch block (~6018–6028) vs. the success path (~6011).

**Traced scenario:** plan changes such that id A should be cancelled (its window closed) and id D
should newly be scheduled. `ln.cancel({notifications:[{id:A}]})` (~5999) succeeds — the device really
no longer has A armed. `ln.schedule(...)` (~6001) then throws. The catch block sets `notifSyncFailed`/
`notifSyncErrMsg`, clears `notifLastSignature` (so a genuine retry isn't suppressed later), but **does
not touch `notifPlanApplied`** — it still holds the plan from the *last successful* sync, i.e. it still
lists A as armed, even though A was just genuinely cancelled from the device moments earlier in this
same failed attempt.

**Why this is low severity, not higher:** traced both consumers of `notifPlanApplied` and both
self-heal:
1. **UI display** (`notifScheduledCount`/`notifNextAt` in the Settings card): `nativeNotifStatus()`
   checks `notifSyncFailed` *before* falling through to the count/next-at branch, so the card shows the
   honest "Reminders couldn't be set on this device" `failed` state, not a stale count derived from the
   now-inaccurate `notifPlanApplied` — verified this ordering directly in `nativeNotifStatus()` (~6083–6093).
2. **`cancelReminderForEntry()`** (surgical per-dose cancel): if a caregiver logs the dose that used to
   map to id A, it will look up A in the (stale) `notifPlanApplied`, find it, and call
   `ln.cancel({id:A})` again — a harmless no-op re-cancel of something already gone.
3. **The `guardEnd` protection band** in the *next* real sync only consults `notifPlanApplied` for ids
   that are still present in `getPending()` (the device's own authoritative truth) — since A is already
   gone from the device, it never appears in that next sync's `pending` array at all, so the stale
   `notifPlanApplied` entry for A is simply never consulted again.

Recommend updating `notifPlanApplied` to drop successfully-cancelled ids even inside the catch block
(cheap, and makes the invariant the code's own comments claim — "the last known-good plan" — actually
hold precisely), but this does not currently cause an observable bug.

---

### F5 — NICE-TO-HAVE: `notifIdFromTag`'s 31-bit hash has no collision guard

**Where:** `notifIdFromTag()` (~5836–5840), consumed by `buildReminderPlan()` (~5915) via
`out.map(n => Object.assign({ id: notifIdFromTag(n.tag) }, n))` with no dedup/collision check
afterward. If two genuinely different tags (different med/window/day, or a dose tag vs. an appointment
tag) ever hashed to the same 31-bit id, both would end up in the same `plan` array with the same `id`;
`ln.schedule()` would receive two notification objects with an identical Android notification id in one
call, and the OS would keep only one, silently dropping the other's reminder with no error anywhere in
this code (no console warning, no toast) — invisible to both the app and the caregiver.

**Why nice-to-have, not higher:** did the math rather than asserting risk by feel — with
`NOTIF_MAX_PENDING = 128` items spread across a ~2^31 hash space, the birthday-bound collision
probability is on the order of 128²/(2·2^31) ≈ 3.8×10⁻⁶ per full plan, and this app hashes real, mostly
low-cardinality tag strings (not adversarial input) — not zero risk, but not a realistic failure mode
for this app's actual data volume. Flagging because "silently drops a reminder with zero error surface"
is exactly the failure class Aaron's bar cares about; a cheap mitigation (e.g. detect a same-tick id
collision in `buildReminderPlan` and perturb/`console.warn`) would close this for free.

---

## Checked, no issue found

- **`buildReminderPlan`'s 14-iteration day-walk guard vs. the 72h horizon:** worked the arithmetic —
  the 72h horizon can never require more than 4 iterations of the day-walk (worst case `nowTs` at
  23:59:59 → horizon end lands inside day+3), so the 14-iteration guard is never actually the thing
  stopping the loop; it's generous headroom, not a hidden truncation risk.
- **DST-safety of the day-walk:** `dayStart`/`nextDay`/`hourTs` all use `Date` field setters
  (`setHours`/`setDate`) rather than fixed millisecond arithmetic, so a spring-forward/fall-back day
  inside the 72h horizon doesn't shift armed times by an hour.
- **Malformed `windows` (missing start/end, `start > end`, non-numeric) reaching `buildReminderPlan`:**
  traced the data path — `state.meds` is only ever populated via `normalizeMedication()`
  (`loadMedicationConfig` at load, the editor's save path at ~3995), which clamps `start`
  to `[0, 23.75]`, `end` to `[1, 24]`, and explicitly filters `window.end > window.start` — malformed
  windows cannot reach `buildReminderPlan` in the first place.
- **`reminderTriggerTs` with malformed `reminderCustomValue` reaching the plan builder (T6, live-tested):**
  seeded three appointments with `reminderCustomValue` of `-5`, `'not-a-number'`, and `Infinity`.
  `Number.isFinite(n) && n >= 0` correctly rejects all three (`!Number.isFinite(n) || n < 0` → `null`),
  producing zero armed alarms for any of them and no console errors — `pendingCount=0` of malformed
  ones scheduled, no crash.
- **Profile switch / `ACTIVE_PROFILE_ID` leak risk:** `switchProfile()`/`createProfile()`/`deleteProfile()`
  all end in `location.reload()`, and `ACTIVE_PROFILE_ID` is a `const` computed once at module
  evaluation — there is no code path where two profiles' ids are both live in the same JS context, so
  `cancelReminderForEntry`/`buildReminderPlan` can never mix profiles' tags. `notifPlanApplied` also
  resets to `[]` on the reload the switch forces, so the fresh boot's `guardEnd` protection band cannot
  protect a leftover reminder belonging to the profile just switched away from — it gets cancelled like
  everything else not in the new profile's plan.
- **Rapid double-tap "Log Zofran" (T1, live-tested):** real double-click on the Home quick-log button,
  then triple-click on the resulting time-picker's Confirm button. Result: exactly one entry
  (`zofranEntryCount=1`), zero cancel-batch duplication (`cancelledBatches=0`), zero console errors.
- **Dose logged exactly at a window's boundary instant (T2, live-tested):** advanced the fake clock to
  exactly 12:00:00.000 for a 9–12 window and logged through the real UI; no crash, no error, entry
  logged cleanly (`consoleErrors=0`).
- **Clock crossing local midnight while the app stays open (T3, live-tested):** advanced the fake clock
  from 23:58 to 00:03 the next day with the page open the whole time; zero console errors, no exception
  from the day-walk or any render path.
- **Reload after boot has already armed reminders — no double-arm (T5, live-tested):** loaded fresh,
  captured the boot-armed id set, reloaded the same page, captured the id set again. **Identical id set
  both times** (`sameIds=true`), zero real console errors either load (after excluding the same
  `ERR_FAILED` network noise pattern the project's own `verify_v35_rebuild.mjs` already filters) — the
  plan is idempotent across a cold reboot of the JS context, matching `getPending()`-based reconciliation
  rather than blind re-scheduling.
- **Plugin entirely undefined at sync time, not just individual calls failing (T7, live-tested):** set
  `window.Capacitor.Plugins = {}` (no `LocalNotifications` key at all) before boot. `lnPlugin()`'s
  try/catch returns `null` cleanly, `syncNativeReminders()`/`refreshNativeNotifStatus()` both no-op via
  their `if (!ln) return;` guards, zero console errors, and the Settings card correctly sits in
  `checking` (permState never resolves from `'unknown'`) rather than throwing or rendering a broken
  state.
- **Race/re-entrancy coalescing (`notifSyncBusy`/`notifSyncAgain`):** traced by hand (not independently
  live-reproduced beyond T1/T5 above) — `markNotifDirty()`'s single-timer guard
  (`if (notifDirtyTimer) return;`) coalesces a burst of dirty calls into one 400ms-later sync attempt;
  a sync already in flight coalesces any further dirty calls into `notifSyncAgain`, replayed exactly
  once via `markNotifDirty()` in the `finally` block — `notifSyncBusy` is unconditionally reset in
  `finally`, so no code path can leave it stuck `true`. A forced call (`{force:true}`) that arrives
  while another sync is in flight is not lost even though it collapses into a non-forced follow-up: the
  failure path always clears `notifLastSignature` (so a real retry after a failure is never suppressed
  by the stale-signature guard), and a success path's follow-up would only be legitimately suppressed if
  the plan genuinely hasn't changed — which is the correct behavior.
- **`console.error` usage:** none anywhere in the file (`grep -n "console\.error"` → only the comment
  at line 6024 *explaining* why it's deliberately avoided). Only `console.warn` is used in the new code
  (once, in the sync-failure catch block).
- **TODO/FIXME/HACK/XXX markers in the new code region:** none found.
- **`TEST_MODE`:** still `true` (line 54).
- **`package.json`/`package-lock.json`:** `git diff a073e70 -- package.json package-lock.json` is empty
  — untouched, no new dependency.
- **Regression suites:** re-ran `verify_v35_rebuild.mjs` (6/6 pass, including R5 — confirms the
  Designer-stage disabled-button blocker is genuinely fixed on the current file, not just claimed fixed)
  and `verify_smoke_v24.mjs` (full pass — no console errors, no layout overflow at mobile/small-mobile/
  desktop widths, existing appointment-reminder UI unaffected).
- **Both dev servers identical:** ran the full `audit_v35_live_tests.mjs` suite against both
  `127.0.0.1:8917` and `127.0.0.1:8910` — identical pass/fail pattern on every one of the 10 checks,
  confirming there's one single current build under test, not two drifted copies.

---

## Summary for the Lead Auditor

| # | Severity | Finding | Evidence |
|---|---|---|---|
| F1 | **Blocker** | Deleting/pausing/editing a medication (and deleting a logged entry) never calls `markNotifDirty()` — stale native alarms for a medication that's gone/paused/changed can keep ringing for up to 6h+ | Live-tested (T4, T9), both ports |
| F2 | Should-fix | On native, the pre-existing reactive dose-reminder path can fire a second, duplicate native notification for a window v35 already pre-armed, if the app is foregrounded at the exact moment the window opens | Live-tested (T8), both ports |
| F3 | Should-fix | The 6h backstop calls `syncNativeReminders()` without `force:true`, so it can itself be silently defeated by the signature short-circuit it exists to route around, leaving the Settings card showing stale "on" after a real OS permission revocation | Live-tested (T10), both ports |
| F4 | Nice-to-have | `notifPlanApplied` isn't trimmed of successfully-cancelled ids inside the failure catch block (traced to be self-healing/harmless via `getPending()`-based reconciliation, not live-reproduced as an observable bug) | Code trace only |
| F5 | Nice-to-have | `notifIdFromTag`'s 31-bit hash has no collision guard — astronomically unlikely at this app's scale, but would silently drop a reminder with zero error surface if it ever happened | Code trace + math, not live-reproduced |

**Live testing did happen, not just code reading.** 10 Playwright checks (T1–T10) were run against the
actual rendered app via real DOM clicks (button `aria-label`/text matches, real time-picker/confirm
dialog flows) on both dev servers, using a fake clock + a fully-functional stubbed
`Capacitor.Plugins.LocalNotifications` (matching the project's own established harness pattern). 6 of
10 passed clean (T1, T2, T3, T5, T6, T7); T4, T8, T9, T10 reproducibly failed with the findings above,
each confirmed identically on both `127.0.0.1:8917` and `127.0.0.1:8910`. Full run transcript:
`outputs/audit_v35_live_tests_8917.log`. Test harness (for the Lead Auditor or Developer to re-run):
`outputs/audit_v35_live_tests.mjs` — run with `BASE_PORT=8917 node outputs/audit_v35_live_tests.mjs`.

**Net assessment:** the core pre-scheduling engine (id hashing, horizon/quiet-hours filtering,
`getPending()`-based reconciliation, sim-date pause, DST-safe day-walk, boot-time force-arm, offline/
no-plugin handling) is solid and matches its own design intent almost everywhere it was checked. The
real gap is completeness of the `markNotifDirty()` wiring (F1) — the mechanism itself works correctly
everywhere it's actually invoked; it's simply not invoked from three of the highest-value medication
mutation paths. F1 should block release; F2/F3 are real but narrower and should be fixed in the same
pass since they're small, well-understood changes (one boolean gate, one `force:true`).
