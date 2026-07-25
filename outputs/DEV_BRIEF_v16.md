# 01 DEVELOPER BRIEF — Custom treatment-day windows per medication + generic dose reminders
Role: Developer (Quality Chain stage 1), synthesized by the Lead Developer from direct code
investigation (no code changed yet). Source: index.html post-v15 pull (286,015 bytes). Line numbers
below are from this file, pre-edit.

## 0. Owner's report (verbatim, 2026-07-25)
1. "meds schedule window also doesn't make sense. there is no way to start a reminder for a certain
   med so I don't know how notifications would work"
2. "on the meds add list, not everyone has the same regimen to stop taking day before and the next
   couple days. there should be a section that allows them to enter their own stuff. like maybe it's
   stop taking a certain med 3 days before and 3 days after treatment. this seems hardcoded to what we
   had before. it's the chemo-day only toggle...which ACTUALLY should be Treatment day...not
   exclusively 'Chemo'."

Both reports trace to real, confirmed bugs — not misunderstandings of working features.

## 1. Bug A: dose reminders are 100% dead code for every real medication
`checkNotifications()` (line 3738) has always fired on a hardcoded clock schedule (8:00 PM, 8:30 AM,
9:55–10:05 AM) for exactly five hardcoded legacy medication ids: `protonix`, `iron`, `compazine`,
`buspirone`, `paroxetine` (lines 3760, 3797, 3820). A generic "gap-based availability" section exists
too but its id list (`gapMeds`) is a hardcoded empty array (line 3834) — permanently inert.

`RESERVED_LEGACY_MED_IDS` (grepped separately, med editor section) explicitly blocks any user-created
medication from ever taking one of those five ids, plus `dexamethasone`/`zofran`/etc. — added
specifically so "a stranger's 'Zofran' would [never] inherit another patient's regimen rules" (existing
code comment). That protection is correct and must stay, but its side effect is that **no medication a
real user ever adds can match any id `checkNotifications()` looks for.** Every branch in the function
is unreachable for every real install. This is exactly Aaron's report: there is no way to get a
reminder for a medication he actually added, because the reminder engine only ever knew about five
medications that belonged to the original single-patient prototype and can never exist again.

The fix is not to add a new UI for "set a reminder time" — the data already exists. Every scheduled
medication already has `windows` (start/end hour, from the "Schedule windows" field) and `alerts`
(auto-derived at line 296: `type === 'win' && not as-needed`) — this is the exact same data
`missedDosesFor()` (the passive missed-dose banner) already reads generically, med-agnostic, no id
list. Reminders should read the same source of truth: for every med with `alerts && windows`, fire
once per window per day, in a short band after the window opens, if that window's dose hasn't been
logged yet.

## 2. Bug B: the treatment-day window is hardcoded to ±1 day for every medication
The "Chemo-day only" toggle (`chemoOnly`, editor line ~3007) is described in its own helper text as
"the chemo-adjacent day window (day before through day after chemo)" — a **fixed ±1 day window**,
literally `dexActiveOn(dayTs)` (line 564): `o >= -1 && o <= 1`. That function name and its literal
window are inherited from the single-patient prototype's Dexamethasone regimen (a real 3-day
premedication course), but `chemoOnly` is a *generic* toggle any user medication can turn on (line
2722/2835 in the editor form), and every one of its 4 real call sites (611, 650, 785, 2506) applies
that same fixed ±1 window to whatever medication has the toggle on — there is no per-medication way to
say "3 days before, 3 days after" or any other range. That is Aaron's exact complaint, and it is a
correct read of the code, not a UX confusion.

Separately, every user-facing string on this toggle says "Chemo": the toggle label ("Chemo-day only",
line 3007), its helper text, and the med-manager badge (line 3071). Aaron is right that this shouldn't
be chemo-exclusive — the rest of the app already generalized this language in v9/v10 ("Treatment
schedule" card, "Treatment day"/"Treatment tomorrow" banner) but the per-medication toggle was missed.

## 3. Landmines / constraints for the Lead Developer
- `dexActiveOn`, `dexWindowsForOffset`, `zofranBlockedOn`, and every `med.id === 'dexamethasone'` /
  `'zofran'` branch (lines 570, 613, 651, 741, 777, 789, 2156) are dead code for real installs (same
  reserved-id protection as Bug A) — **do not touch them.** They're inert, low-risk, and out of scope;
  rewriting dead branches only adds regression surface for zero user benefit.
- `chemoOffsetFor(dayTs)` (line ~563, reads `nextChemoTs()`) is the single global "next treatment date"
  set on the Home "Treatment schedule" card — it is shared across all medications, not per-med. Keep
  it that way; only the before/after day counts become per-medication.
- `normalizeMedication()` (line 275) is the one place old saved configs get migrated on load — this is
  where `chemoOnly` → `treatmentOnly`/`treatmentDaysBefore`/`treatmentDaysAfter` migration must live so
  a device with an existing `chemoOnly: true` medication keeps behaving identically (±1/±1) until the
  user edits it.
- `alerts` is already correctly auto-derived per medication (line 296) — no new field needed to know
  which meds should get reminders; reuse it.
- `checkNotifications()` only actually fires in two situations (line 3742): the native APK build
  (always), or a web/PWA install with `TEST_MODE` off. In this sandbox `TEST_MODE` is on, so the fix
  cannot be exercised live in a browser smoke test — it must be unit-testable as a pure function
  (matching the existing `doseProgressToday` pattern) so a Node harness can verify it, and it will be
  live-verified on Aaron's already-installed APK.
- The 1-second tick loop calls `checkNotifications()` every second (line ~3919) — the new logic must
  stay cheap (a plain filter over `state.meds`, no new timers) and must not fire more than once per
  window per day (reuse the existing `notifSentToday` de-dupe map).
- `APP_VERSION` (grep shows `'app-v14'`) is stale — README/sw.js already moved to v15. Bump all three
  in lockstep this release (`app-v16`) and fix the drift.

## 4. Recommended approach
### Data model (medication object)
Add two fields, replacing `chemoOnly`:
- `treatmentOnly: boolean` (was `chemoOnly`)
- `treatmentDaysBefore: number` (default 1 — matches today's fixed behavior)
- `treatmentDaysAfter: number` (default 1 — matches today's fixed behavior)

`normalizeMedication()` migrates: `treatmentOnly = typeof original.treatmentOnly === 'boolean' ?
original.treatmentOnly : !!original.chemoOnly`, days-before/after default to 1 if absent, then delete
the old `chemoOnly` key so it doesn't linger in storage.

### New generic helper
`treatmentActiveOn(med, dayTs)` — same shape as `dexActiveOn` but reads the per-med day counts instead
of a hardcoded ±1. Replaces `dexActiveOn` at the 4 *generic* call sites only (611, 650, 785, 2506) —
the dead dex/zofran-id-specific branches are untouched (see landmine above).

### Editor UI
Rename the toggle "Chemo-day only" → a treatment-day label; when on, reveal two number inputs ("Days
before treatment" / "Days after treatment", min 0, integer) defaulting to 1/1. Med-manager badge shows
the actual configured window instead of a fixed generic label.

### Reminders
New pure function `dueRemindersAt(nowDate)` — filters `state.meds` for `alerts && windows.length`,
respects `medScheduledOn` and `treatmentOnly`/`treatmentActiveOn`, checks each window's first-5-minutes
band against `entriesFor(med.id)`, returns the due list. `checkNotifications()` becomes a thin wrapper
that calls this and fans out to `sendNotif`. The five hardcoded clock-time blocks and the dead
`gapMeds` block are deleted (dead code, replaced by the generic version). This is a straightforward,
low-risk deletion+replacement since every deleted branch was already provably unreachable (Bug A).

## 5. Definition of DONE
Must work:
- A user-created medication with a schedule window gets a real reminder when that window opens (once
  per window per day), with no dose already logged in it — verifiable via a Node harness against
  `dueRemindersAt` with synthetic `state`.
- Toggling "treatment day" on a medication and setting e.g. 3 days before / 3 days after actually
  changes when that medication shows/hides on Home and counts toward missed-dose tracking —
  `treatmentActiveOn` unit-tested against a range of offsets.
- No "Chemo" wording remains on the per-medication toggle, its helper text, or its med-manager badge.
- An existing saved medication with the old `chemoOnly: true` (no explicit day fields) behaves
  identically post-migration (±1 day window) until edited.
- `APP_VERSION`, `sw.js` CACHE, and the README table are bumped together to app-v16.
Must also hold (regressions that must NOT happen):
- Web/PWA behavior for `checkNotifications()` unchanged (still silent under `TEST_MODE`, still gated
  on `Notification.permission` off native).
- `missedDosesFor`, `doseProgressToday`, and the Home Quick Log filter all still use the same
  treatment-window truth as reminders (no drift between "shown on Home" and "counted as missed").
- Dead dex/zofran-specific branches remain byte-identical — not touched, not "cleaned up" as a drive-by.
- Full existing regression suite (every tab, fresh install, tour, med add, notifications settings
  copy) stays zero-console-error clean at 360/390/1280px.

## 6. Out of scope for this pass (queue instead)
- A per-medication on/off switch for reminders independent of `alerts` (Settings currently promises
  "Per-medication controls are coming soon" — that's this, not today's fix).
- Gap-type (as-needed) medication "available now" reminders — no gap medication currently has
  `alerts: true` by design, so there's nothing to generalize yet; flag as a future request if Aaron
  wants it.
