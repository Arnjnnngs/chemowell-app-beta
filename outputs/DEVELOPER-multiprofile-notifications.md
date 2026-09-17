# DEVELOPER BRIEF — multi-profile reminders (app-v84 → proposed app-v85)

**Stage 1 of the Quality Chain. Planning pass only. No code was written, no app file was touched.**
Aaron: *"Make a plan with the team before you write any code."*

| # | App | Task | Status |
|---|---|---|---|
| 1 | ChemoWell app | Reproduce & verify the multi-profile reminder defect | DONE — verified, evidence below |
| 2 | ChemoWell app | Constraints & landmines survey | DONE |
| 3 | ChemoWell app | Options + recommendation | DONE |
| 4 | ChemoWell app | Notification text options (privacy) | DONE — **needs Aaron's decision** |
| 5 | ChemoWell app | Definition of done + falsification plan | DONE |
| 6 | all 3 repos | Blast-radius check on the two siblings | DONE — defect class absent in both |
| 7 | ChemoWell app | Build stage 1 (stop the destruction + honest copy) | QUEUED — S, needs go-ahead |
| 8 | ChemoWell app | Build stage 2 (per-profile reminder coverage) | BLOCKED — needs Aaron on task 4 and on size (M) |

---

## HEADLINE

**Confirmed, all four points, and it is worse than the diagnosis says.**

The diagnosis says the reconcile loop destroys the other profile's armed reminders "subject only to
the `NOTIF_MIN_LEAD_MS` protection band." **There is no protection band.** It is vacuous on exactly
the code path where the destruction happens.

`switchProfile()` (index.html:662) ends in `location.reload()` — that is how this app switches
profiles, because every storage key is bound at module load. A reload re-initialises
`let notifPlanApplied = []` (index.html:12466). The protection band is:

```js
const toCancel = pending.filter(p => !planIds.has(p.id)).filter(p => {
  const applied = notifPlanApplied.find(a => a.id === p.id);
  return !applied || applied.at > guardEnd;     // index.html:12534-12539
});
```

`applied` is `undefined` for every id this fresh process did not arm itself, so `!applied` is `true`
and the notification is cancelled **unconditionally** — including one due five seconds from now.
The band only ever protected ids armed earlier in the *same* app process. After a profile switch,
that set is empty by construction.

Reproduced deterministically (expressions copied verbatim from index.html:12530-12540, ids from the
real `notifIdFromTag`):

```
pending ids : [ 1370386971, 2107802394, 1168520640 ]   # 2 from profile A, 1 from active profile B
plan ids    : [ 1168520640 ]
toCancel    : [ 1370386971, 2107802394 ]  <- count 2
=> both profile-A reminders cancelled, protection band did NOT apply
```

**And it is not only switching.** The boot sync at index.html:12769 runs `force: true` on every cold
start. So any launch of the app, with profile B active, cancels every armed reminder belonging to
profile A. Nothing ever re-arms them; profile A regains coverage only when it is made active again.
The "3 missed doses from previous days" on Home is the downstream evidence, not a second bug.

**Who this hits.** `tierLimit()` (index.html:172) is `free = 1`, `plus = 3`, `pro = ∞`. A second
profile is a *paid* feature. This defect only affects paying users, and it breaks the specific thing
they paid for, silently, while Settings tells them reminders are on.

### The four claims, checked one by one

| Claim | Verdict | Evidence |
|---|---|---|
| `ACTIVE_PROFILE_ID` resolved once at module load; all keys bound to it | **Confirmed** | index.html:251; keys at 847 (entries), 848 (prefs), 904 (appts), 953 (notes), 1127 (med config) |
| `syncNativeReminders()` plans for the active profile only | **Confirmed** | index.html:12514 — `buildReminderPlan(nowTs, state.meds, state.entries, state.appts, ACTIVE_PROFILE_ID)` |
| Profile id is inside the notification id, so ids are distinct per profile | **Confirmed** | `notifDoseTag` index.html:12308; check-in tag 12382; appointment tag 12402. All three embed `profileId`. Measured: 20,000 synthetic profile ids against the same medication/window produced 20,000 distinct ids, zero collisions |
| The reconcile loop cancels the other profile's notifications, limited by the protection band | **Confirmed, and the limit does not exist** | index.html:12534-12542, plus `notifPlanApplied` reset at 12466 and `location.reload()` at 666. See above |

---

## 1. CONSTRAINTS AND LANDMINES

### L1 — `buildReminderPlan()` is NOT a pure function of its arguments. Its own docstring is false.

This is the single biggest trap and it will bite any naive fix.

index.html:12335 says *"Pure function of its inputs (no reads of `state`, no bookkeeping mutation)."*
It reads the **active profile's preferences** through at least six helpers:

* `medRemindersEnabledOn()` → `treatmentOnlyBlocks()` (2362) → `isOtherTreatmentType()` (3472),
  `hasTreatmentDate()` (2280), `treatmentActiveOn()` (2310) — all read `getPrefsDB()` (888), which
  is bound to `PREFS_KEY`, which is bound to `ACTIVE_PROFILE_ID`.
* `treatmentExcludedNow()` (2368) — same.
* `checkinEnabledToday()` (3501) → `homePref()` (3473) → `getPrefsDB()`.
* `checkinDoneForDay()` (3529) and `getDailyCheckinTime()` (3499) — same.

**So a fix that simply loops profiles and calls `buildReminderPlan(now, medsB, entriesB, apptsB, 'pB')`
will compile, run, produce a plausible-looking plan, and be wrong.** Profile B's treatment-only
medications would be armed or suppressed by profile A's treatment calendar and treatment type, and
profile B would inherit profile A's check-in time and toggles. Every one of those failures is silent.

Any fix must make the profile-dependent reads explicit parameters (a `profileCtx` object), and must
carry a check that goes **red** when they are not — see B3 in section 4.

### L2 — `loadMedicationConfig()` WRITES. Do not reuse it to read another profile.

index.html:1692. It is a reader with a deferred side effect: index.html:1732 schedules
`persistMedicationConfig(state.meds, state.archivedMeds)` — and `persistMedicationConfig` writes to
the module constant `MED_CONFIG_STORAGE_KEY`, while `state.meds` is the **active** profile's list.
Parameterise this function carelessly and a background read of profile B's medications can write
**profile A's medication list into profile B's storage key.** That is total, silent loss of the other
patient's medication configuration.

A multi-profile fix must add a **new, side-effect-free reader** that takes a profile id, reads the key
and normalises in memory. It must never call `loadMedicationConfig()` or `persistMedicationConfig()`.

### L3 — Profile switching is a full page reload, by design

`switchProfile()` (662), `createProfile()` (632), the restore-into-new-profile path (390) and the
cross-tab storage handler (991) all end in `location.reload()`. There is no in-memory concept of
"another profile" anywhere in this file. That is fine for a plan builder (localStorage is synchronous,
so another profile's data can be read directly), but it means **every module-scope notification
variable starts empty on every switch** — see L4.

### L4 — The protection band is built on state that starts empty

`notifPlanApplied` (12466) is the only thing the band consults. It is empty after every reload, app
launch, or service-worker `controllerchange` reload (12800-ish). Any fix that still needs a "don't
race a mid-fire cancel" band must derive it from `getPending()` itself. Fortunately the app already
writes what it needs into the notification's `extra`: `profileId`, `at` and `pk` (index.html:12549).
Use those. Do not invent a parallel ledger in localStorage.

### L5 — `NOTIF_MAX_PENDING = 128` becomes a shared budget with no fairness rule

index.html:12305 and the truncation at 12411: `out.sort((a,b) => a.at - b.at)` then
`out.length = NOTIF_MAX_PENDING`. With one profile that is "keep the earliest, drop the rest" and it is
fine. With several profiles it silently becomes **a race between patients**: a profile whose doses are
dense and early can consume the entire budget and starve a profile whose first dose is at 20:00.
Nothing anywhere says so. The cap's semantics have to be decided out loud — global earliest-N, or a
per-profile quota — and checked (B4).

### L6 — iOS has a hard cap of **64** pending local notification requests per app

`UNUserNotificationCenter` keeps the **64 soonest-firing** scheduled requests per app and silently
discards the rest; there is no error and no callback. `NOTIF_MAX_PENDING = 128` already exceeds it,
which is harmless today only because `package.json` lists `@capacitor/android` and no `@capacitor/ios`
— **iOS is not shipping yet.** A realistic two-profile plan over the 72h horizon plausibly exceeds 64
(5 medications × 3 windows × 3 days + check-ins ≈ 48 per profile). If iOS is on the roadmap, the
horizon or the cap has to come down **before** multi-profile arming, not after, and the number must be
re-confirmed against `@capacitor/local-notifications` iOS docs on the day it is built rather than
taken from this brief.

### L7 — Android notification channels are device-wide and close to permanent

Three channels, created once, `notifChannelsReady` latched (12482-12487). They carry no profile id,
which is correct and should stay that way. Reasons not to make them per profile:

* A channel's user-facing settings (importance, sound, blocked state) are owned by the OS once
  created. Deleting and recreating a channel with the same id **restores the user's previous
  settings, including a blocked state** — so a per-profile channel scheme cannot be cleanly undone.
* Every deleted profile would leave a dead channel in the app's notification settings forever.

Consequence to state plainly: if the caregiver mutes "Dose reminders", it is muted for every profile,
and there is no way to offer per-profile muting through channels.

Second note on channels: all three are created with **`visibility: 1`** (12483-12485), which is
Android's `VISIBILITY_PUBLIC` — full content shown on a locked screen. The app currently opts into the
*least* private setting available, and nobody has been asked about it. See section 3.

### L8 — The exact-alarm lead buffer is profile-agnostic but has a floor that can collide

`applyExactAlarmLeadBuffer()` (12430) shifts every entry 4 minutes earlier when exact alarms are not
granted, floored at `nowTs + NOTIF_MIN_LEAD_MS`. Applied to the whole plan at once, after building.
Safe to keep as-is under any option, but note two profiles' near-term reminders can be floored onto the
same instant — noisy, not wrong.

### L9 — TEST_MODE date simulation blocks on-device testing of this entire path

index.html:12510: `if (TEST_MODE && !!state.dateOffsetDays) { ...; return; }`. That guard is correct
and must survive untouched (R2). But it means the multi-profile arming path **cannot be exercised
on-device in this beta while the date controls are in use**. Every check for this work therefore has to
be unit-level against `buildReminderPlan` / the reconcile filter, reached through
`window.__notifTest` (12447). Budget for that: "arm it on a phone and watch" is not available.

### L10 — Profile DELETE leaves orphaned armed alarms, and today's bug is what hides it

`deleteProfile()` (648) removes five storage keys and **never touches notifications** — it does not even
call `markNotifDirty()`. Today that is invisible, because the over-broad cancel cleans the orphans up as
a side effect. **Fix the over-broad cancel without fixing delete, and a deleted patient's medication
reminder keeps firing on the lock screen for up to 72 hours,** with no data behind it and no control
anywhere in the app to stop it. This is a **required companion change** to any option that preserves
another profile's notifications. The same applies to the undo path at 573-585, which also removes
profile keys.

(Adjacent, pre-existing, out of scope — log it: `deleteProfile()` also never removes
`-synckey-v1` or `-syncmeta-v1`, index.html:690-701.)

### L11 — The sync path never re-arms a non-active profile

Sync keys and metadata are per profile (690-701) and a profile can be shared to a second device. If a
sync pull changes a non-active profile's entries or medications, nothing re-plans that profile's
reminders — today because nothing plans them at all, tomorrow because the sync completion path will not
know it needs to. Whatever function decides "which profiles do we plan for" has to be called from the
sync completion path too, or a shared profile's reminders go stale on the device where it is not open.

### L12 — There is no notification-tap handler anywhere in this app

`grep -n "addListener\|localNotificationActionPerformed"` over index.html returns **nothing**. Tapping a
reminder just opens the app on whatever profile is active. Under any option that arms reminders for a
non-active profile, that becomes a new hazard: a reminder for profile B, tapped, opens **profile A's**
Home, and the obvious next tap logs the dose against the wrong patient. Any such option must either add
a tap handler that switches profile first, or declare this a known accepted gap — and it should not be
accepted quietly.

### L13 — There is no notification test suite at all

`grep -rn "buildReminderPlan" test/` matches only `test/fixtures/app-v76-base.html`, a frozen fixture.
The `window.__notifTest` hook exists (12447), exposes `buildReminderPlan` and
`applyExactAlarmLeadBuffer`, and **nothing uses it.** `release_check.sh` gates nothing about reminders.
Every check in section 4 is new, and `release_check.sh` has to be edited to run them (R7).

### L14 — Id collision risk is real but small, and undetected

`notifIdFromTag` (12309) hashes into `[0, 2^31)`. Birthday estimate: 128 armed ids ≈ 0.0004%,
512 ≈ 0.006%, 1024 ≈ 0.024%. Measured across 20,000 synthetic profile ids: zero collisions. So the id
space is adequate for several profiles. **But a collision is detected nowhere**, and its failure mode
is one patient's reminder silently cancelling another's. If the plan grows, add a cheap assertion
(`new Set(ids).size === ids.length`) rather than trusting the arithmetic.

---

## 2. OPTIONS

### Option A0 — Stop the destruction only (the tourniquet)

**What changes.** The reconcile loop stops cancelling an armed notification that belongs to a profile
the current plan does not cover. `getPending()` already returns `extra.profileId` (written at 12549), so
the filter becomes: cancel only ids that are absent from the plan **and** whose `extra.profileId` is the
active profile (or is missing — a pre-v85 or foreign id, which must still be cleanable). Plus the L10
companion fix: `deleteProfile()` and the undo path cancel that profile's pending notifications by
`extra.profileId`.

**Cost.** Roughly 10-15 lines in two places. **S.**

**What it buys.** The app stops actively destroying the other patient's armed reminders. Whichever
profile was last active keeps whatever it had.

**What it risks.** It does not give the other profile *coverage* — it preserves a snapshot. Profile A's
plan was built against a 72-hour horizon; after 72 hours away it is empty and nothing refreshes it.
Doses logged in A while A is not active do not cancel A's reminders, so a reminder can fire for a dose
already taken on another device via sync. And it makes L10 load-bearing: get the delete cleanup wrong
and reminders fire for a patient who no longer exists in the app.

**How it goes wrong silently.** A caregiver switches to profile B for a week. Profile A's reminders
quietly expire off the end of the horizon on day 4 and nothing says so. Better than today — today they
are gone in seconds — but still not coverage. **A0 must not ship alone; it ships with B.**

### Option B — Keep it active-only, but make the app say so

**What changes.** Copy and status, no scheduling logic. Three places:

1. The Settings reminder card (index.html:9260-9261), which today reads *"N reminders scheduled over the
   next 3 days"* with no mention of profiles. It gains a truthful line naming which profiles are and are
   not covered.
2. The Profiles section (index.html:9999), which today reads *"Each profile keeps its own medications and
   history, fully separate, on this device."* — true, and silent on the thing that actually bit Aaron.
3. A one-time notice the first time a second profile exists.

**Cost.** **S.** Copy plus a small status computation. Voice pass required (Rule 2.7): the string must
be true on a one-profile device too — do not print "1 of 1 profiles covered" to a free user.

**What it buys.** Nobody believes they are covered when they are not. That is the actual harm in Aaron's
report: not the missed reminder, the *false assurance*.

**What it risks.** It is a disclosure, not a fix. A paying customer is told the paid feature does not do
the obvious thing. Expect that to read as a limitation admission rather than a bug fix.

**How it goes wrong silently.** The string is computed from `notifScheduledCount`, which is
active-profile-only — write the check lazily and it will happily say "all profiles covered" on a build
where they are not. The falsification for B7 exists for exactly this.

### Option C — Per-profile "remind me even when this profile isn't open", defaulted ON

**What changes.** The real fix, in this shape:

1. A side-effect-free per-profile reader (L2) returning `{meds, entries, appts, prefs}` for any profile id.
2. `buildReminderPlan()` gains an explicit `profileCtx` parameter carrying the treatment date, treatment
   type, check-in toggles and check-in time; the six helpers in L1 read from it instead of `getPrefsDB()`.
   Active-profile callers pass the active context, so single-profile behaviour is unchanged.
3. `syncNativeReminders()` builds a plan per covered profile and concatenates, then sorts and applies an
   explicit cap policy (L5).
4. A per-profile pref `remindWhenInactive`, default **true**, with a toggle in the Profiles section.
5. `deleteProfile()` cancels by `extra.profileId` (L10).
6. The sync completion path triggers a re-plan (L11).
7. A `localNotificationActionPerformed` listener that switches to the notification's profile before
   opening (L12) — or an explicit, written exemption.
8. Notification text decided per section 3.

**Cost.** **M**, upper half. Seven touch points, one of them (`buildReminderPlan`'s signature) touching
every gate in the file, plus a whole new test suite and a `release_check.sh` edit.

**What it buys.** Coverage. Every profile the caregiver has said to cover gets its reminders regardless
of which one is open, and the toggle is an honest escape hatch for a profile that is dormant or belongs
to someone who does not want notifications on this phone.

**What it risks.** Every landmine in section 1 at once. L1 is the killer: get the context threading wrong
and the wrong person's treatment calendar suppresses a dose reminder, silently, forever. L5 starvation.
L6 on iOS. L12 wrong-patient logging.

**How it goes wrong silently.** Three named ways, all of which a lazily-written check passes:

* Both fixture profiles are given the same treatment settings, so the L1 contamination bug does not show.
* The cap is never exceeded in the fixture, so L5 starvation never fires.
* The suite tests a re-implementation of the reconcile filter rather than the one in the shipped file,
  so a later edit to `index.html` is not covered. This project has shipped roughly eight checks like that.

### Option D (for completeness) — Arm all profiles unconditionally, no toggle

Option C minus the pref and the UI. Cheaper by maybe 15% and worse: no way for a caregiver to stop
notifications for a dormant profile, and no way to opt a second person out of having their medication
names appear on somebody else's phone. Given section 3 is a privacy decision, a feature that cannot be
turned off per profile is the wrong default. **Not recommended**, but it is the cheap version of C if
Aaron wants it. **M**, lower half.

### RECOMMENDATION

**Ship A0 + B now as one small release. Then build C, gated on Aaron.**

Reasoning:

* A0 + B together are **S**, land in one auditable change, and remove both halves of the present harm:
  the app stops destroying armed reminders, and it stops implying a coverage it does not have. Neither
  needs a decision from Aaron beyond the go-ahead, and neither depends on section 3.
* C is the real fix, it is **M** (so it is his gate under Rule 3), and it **cannot be written until
  section 3 is decided** — the notification text is an input to the build, not a finishing touch.
* Splitting them also gives the Zero Day Auditor a small first target and a delta pass on the second,
  rather than one large surface. Rule 1.5's sequence: cheap before expensive.

Do **not** ship A0 without B. A0 alone leaves a caregiver with a stale snapshot they believe is live —
which is the same false assurance in a quieter form.

---

## 3. THE NOTIFICATION TEXT — FOR AARON TO DECIDE, NOT ME

Today (index.html:12360-12361):

* Dose — title `"<Medication> Due"`, body `"<Medication> — <Window name> dose window has opened"`
* Check-in — title `"Daily check-in"`
* Appointment — title `"Upcoming: <user-typed title>"`, body includes the user-typed note

With two profiles on one phone, the dose reminder does not say **who**. That is the ambiguity. But the
obvious fix — the patient's name next to a medication name on a lock screen — is a privacy decision,
because a medication name plus a person's name can disclose a diagnosis to anyone standing near the
phone. Laying out the options without picking one:

| Option | Reads as | For | Against |
|---|---|---|---|
| **1. No change** | "Metformin Due" | Discloses nothing new. Zero work. | Does not solve the reported problem. Two profiles, same medication → indistinguishable |
| **2. Full profile name** | "Metformin Due — <name>" | Unambiguous, natural, no new setting | Name + medication on a lock screen. The classic exposure. Also: the name is whatever they typed in setup, which may be a full legal name |
| **3. First name / initial only** | "Metformin Due — <initial>." | Reduces exposure, still disambiguates | Reduces, does not remove. "T." is useless with two T names |
| **4. A separate, user-chosen reminder label per profile, default empty** | "Metformin Due — <label>" or "Metformin Due" | Puts the disclosure decision with the person who lives with the phone. Never derived from the patient name, so nothing leaks by default | One more setting, one more thing to explain. Empty by default means the ambiguity persists until they set it |
| **5. Generic profile index** | "Metformin Due (Profile 2)" | Unambiguous about *which*, discloses nothing about *who* | Useless if the caregiver cannot remember which profile is 2 |

**A separate decision, on the same screen: Android channel visibility.** All three channels are created
with `visibility: 1` = `VISIBILITY_PUBLIC` (index.html:12483-12485) — full content on a locked screen.
`0` (private) shows the app name and hides the content until unlocked; `-1` (secret) hides it entirely.
The app currently opts into the most exposed setting and nobody was asked. **This is close to one-way:**
an Android channel's settings cannot be changed after creation from inside the app, so changing it
requires a new channel id, and users who had customised the old channel lose that (L7).

**Note for whoever builds it:** options 2-4 are user-entered data, not hardcoded content, so none of them
conflict with Rule 0. What Rule 0 forbids is a *name in the file*. A name the user typed into their own
profile is theirs.

**My recommendation to Aaron, as a recommendation only:** option **4** (user-chosen label, default empty)
paired with channel visibility **0**, because it makes the lock screen safe by default and lets the
caregiver opt into as much identification as their household warrants. But this is his call and the build
is blocked on it.

---

## 4. DEFINITION OF DONE

Each item is a behaviour or a regression, the check that proves it, and **the mutant that must turn that
check red**. Per `release_check.sh`'s own app-v82 note, the gates run against a clean export of HEAD, so
every falsification must be performed deliberately and the mutant **restored and never committed**.

Every check must reach the *shipped* functions through `window.__notifTest` (index.html:12447) against the
real `index.html`, never a copy of the logic in the test file. Extend `__notifTest` with the reconcile
filter and the new per-profile reader so they can be reached the same way.

### Behaviours that must work

**B1 — A reminder armed for profile X is never cancelled by work happening in profile Y.**
*Check:* feed the reconcile filter a pending set carrying `extra.profileId` for two profiles and a plan
covering only one; assert no cancelled id belongs to the uncovered profile.
*Falsify:* restore `pending.filter(p => !planIds.has(p.id))` with no profile predicate → red.
*Second mutant (the one that matters):* strip `extra.profileId` from one pending record so it is
`undefined` → the check must state and assert what happens to unattributed ids (they must still be
cleanable, or a pre-v85 id is orphaned forever).

**B2 — After a profile switch, the previously active profile still has armed reminders.**
*Check:* browser-level. Seed two profiles in `localStorage`, stub `Capacitor.Plugins.LocalNotifications`
with an in-memory `schedule`/`cancel`/`getPending`, boot, record the armed set, switch profile (reload),
assert profile A's ids are still pending.
*Falsify:* re-point the plan builder at `ACTIVE_PROFILE_ID` only → red. Second mutant: force
`notifPlanApplied = []` immediately before the reconcile → must stay green under the fix (proving the
fix does not depend on that variable), and red under today's code.

**B3 — Profile B's plan uses profile B's treatment date, treatment type, check-in toggles and check-in
time. Never the active profile's.** *(This is L1, the most likely check to be written so it cannot fail.)*
*Check:* two profiles with **deliberately different** settings — profile A `treatmentType: 'other'` with
no treatment date; profile B `'chemo'` with a treatment date and a `treatmentOnly` medication. Assert the
treatment-only medication IS armed for B while **A is active**. Then swap which is active and assert the
plan is byte-identical.
*Falsify:* hardcode the context reader back to `getPrefsDB()` → the check must go red on **both**
orderings. A fixture where the two profiles share treatment settings passes on the broken build — that
fixture is the defect, not the check.

**B4 — The cap is explicit and no profile with a due dose is starved.**
*Check:* profile A with ~200 dose windows starting 06:00, profile B with 3 at 22:00, over the horizon.
Assert profile B has at least one armed reminder.
*Falsify:* restore the flat `out.length = NOTIF_MAX_PENDING` after a global sort → red (B gets zero).

**B5 — Deleting a profile cancels its armed reminders.**
*Check:* arm both, delete B, assert no pending id carries `extra.profileId === B`.
*Falsify:* remove the cancel from `deleteProfile()` → red. Second mutant: delete the profile while one of
its reminders is inside the 30-second band → assert it is still cancelled (a deleted patient's reminder
must not be protected by a band designed to protect a live one).

**B6 — The delete-undo path (index.html:573-585) restores the profile AND re-arms its reminders.**
*Check:* delete, undo, assert the profile's ids are pending again.
*Falsify:* remove the re-plan from the undo path → red.

**B7 — Settings tells the truth about coverage.**
*Check:* assert the rendered string names the uncovered profiles by count on a two-profile device, and
does **not** mention profiles at all on a one-profile device.
*Falsify:* compute the string from `notifScheduledCount` alone (active-profile-only) → red on the
two-profile fixture. Voice pass (Rule 2.7) required on the final wording.

**B8 — Tapping a reminder lands on the right patient** *(only if L12 is fixed rather than exempted).*
*Check:* dispatch a `localNotificationActionPerformed` carrying profile B's `extra`, assert the active
profile becomes B before Home renders.
*If exempted instead:* the exemption is written in the release message, in plain words, as Rule 5.5
requires. An exemption nobody wrote down is indistinguishable from an oversight.

### Regressions that must not happen

**R1 — Single-profile behaviour is byte-identical.** Deep-equal the full plan (ids, order, titles, bodies,
`at`) before and after, on a one-profile fixture across a full simulated cycle. Reuse the
`test/v76-properties-equivalence.mjs` pattern — it exists and it is the right shape.
*Falsify:* change a single character of any title → red.

**R2 — The TEST_MODE simulated-date guard still disarms everything** (index.html:12510).
*Falsify:* remove the guard → red.

**R3 — The exact-alarm lead buffer still applies and still floors at `now + NOTIF_MIN_LEAD_MS`.**
*Falsify:* remove the `Math.max(..., floor)` → red.

**R4 — `cancelReminderForEntry()` still cancels exactly one id on a dose log, in the active profile only.**
*Falsify:* broaden it to all profiles → red.

**R5 — No `console.error` on a handled sync failure** (the harnesses fail a run on any console message of
type `error`; index.html:12572 uses `console.warn` deliberately). New code keeps that.

**R6 — Product neutrality holds.** `test/v75-no-other-patient.mjs` green; the three ratchet numbers
(13 / 8 / 6) unchanged; no gendered pronoun in new code **or comments**; no new branch keyed to a
medication id.
*Falsify:* insert `if (med.id === 'zofran')` in the new reader → the ratchet must go red.

**R7 — `release_check.sh` actually runs the new suite.** A check nobody runs is the ninth check that
passed on a broken build.
*Falsify:* rename the suite file → `release_check.sh` must fail, not silently skip.

---

## 5. BLAST RADIUS — the two sibling repos

Both repos' `CLAUDE.md` (and the imported instruction file each one points at) were read before
concluding anything.

### `/home/user/care-tracker` — **defect class ABSENT. Nothing to port. No work.**

Per `claude/care-tracker.md`, this is **one named person's app**. Checked in the code rather than assumed:

* `grep -ci profile index.html` → **1 hit**, and it is a *comment* at index.html:5445 describing where
  ChemoWell keeps appointments. There is no profile system, no `ACTIVE_PROFILE_ID`, no profile-scoped
  storage keys.
* No Capacitor, no `@capacitor/local-notifications`, no `LocalNotifications`, no `buildReminderPlan`, no
  reconcile loop. Nothing in that repo cancels a notification.
* Its reminders are a **server broadcast**: `.github/workflows/reminders.yml` runs `send-reminders.js`
  (751 lines), which reads every token in the `fcm_tokens` collection and sends to all of them, claiming
  each send by `create()` at a deterministic document id in `reminder_ledger`. There is no per-recipient
  plan and no cancel step — `grep -n cancel send-reminders.js` matches only the word inside DST comments.

There is no "active profile" and therefore no way for one patient's schedule to cancel another's.
**Do not port this fix there.** (Adjacent and *not* a defect: the broadcast reaches every registered
device, which is intended — one patient, several caregivers.)

### `/home/user/chemowell-beta` — **defect class ABSENT. Nothing to port. And do not add the concept.**

Per `claude/care-tracker-staging.md` Rule 0: despite the repo name this is **care-tracker's staging copy**,
one specific person's app, `TEST_MODE = true`, writing `caretracker_test_entries`. It is **not** the
ChemoWell product.

* `grep -ci profile index.html` → **1**, the same ChemoWell comment (index.html:4710).
* `grep -c Capacitor index.html` → **0**. No native notification path at all; `subscribePush()` and
  `checkNotifications()` short-circuit while `TEST_MODE` is on, and the repo has no workflows and no
  `send-reminders.js`.

**Do not port the fix, and do not port the multi-profile concept.** That repo's own Rule 0 records a
2026-09-13 incident where product rules were wrongly applied to it; this would be the same mistake.

### The direction that does matter

The reverse port is the risk. If a future session moves notification code **from** either sibling **into**
this repo, it arrives with no profile concept whatsoever and will re-introduce exactly this defect. Worth
a line in `HANDOFF.md` when the fix lands.

---

## 6. SIZING (Rule 3 — Aaron gates M and L)

| Option | Size | What he gets |
|---|---|---|
| **A0** — stop the destruction + delete cleanup | **S** | The app stops destroying the other profile's armed reminders |
| **B** — honest coverage copy | **S** | Nobody believes they are covered when they are not |
| **A0 + B together** (recommended first release) | **S** | Both of the above, one release, one audit |
| **C** — per-profile coverage with a toggle (recommended real fix) | **M** (upper half) | Every covered profile gets its reminders regardless of which is open |
| **D** — arm all profiles, no toggle | **M** (lower half) | Same coverage, no way to opt a profile out. Not recommended |
| Notification text change, once decided | **S** on top of C | Disambiguation, at whatever privacy level he picks |

**S proceeds on a statement (Rule 3). So A0 + B can start on his go-ahead alone. C needs his go on the
size AND his decision in section 3 before a line is written.**

---

## OPEN QUESTIONS FOR AARON

1. **Section 3 — the notification text.** Blocks option C. My recommendation is a user-chosen per-profile
   label defaulting to empty, plus Android channel visibility `0`. His call.
2. **Ship order.** A0 + B now (S, his go-ahead only), then C (M, gated)? Or straight to C?
3. **L12 — the wrong-patient tap.** Fix it inside C (a profile-switching tap handler, adds to the M), or
   ship C with it written down as an exemption?
4. **L6 — iOS.** Is iOS on the roadmap before this ships? If yes, the horizon or the cap has to come down
   as part of C rather than later.

## WHAT I DID NOT DO

No code written, no app file edited, no commit other than this brief. `index.html`, `sw.js` and every test
file are untouched. The reconcile-loop reproduction ran in the scratchpad against expressions copied out
of `index.html`; nothing was executed against the repo's own files.
