AUDITED-COMMIT: 603360c07c3c6789f802c41d69120e9626653539
VERDICT: DO NOT SHIP

# Zero Day Auditor — ChemoWell app-v93

One defect blocks this release. It has a three-line fix, I measured the fix green, and after it
this release is good work. Everything else below is a finding, not a block.

**The tree I audited.** HEAD `603360c0`, tree clean, `index.html` md5
`2d55f6074ddea0472d6121060961284c`, `sw.js` md5 `7dce2d2f5186f5a0cc3f0bc6e7e718fe` — all three as
the brief states. `APP_VERSION` `app-v93`, `sw.js` CACHE `chemowell-app-v93-1`, both moved
together. One discrepancy to disclose: the v93 commits are on local **`main`** (6 ahead of
`origin/main`), not on `claude/caretracker-team-review-i83ik2`, which locally still points at v92
(`caa548d`). Same sha, same bytes, so it changes nothing about what was audited.

---

## BLOCK 1 — Silencing a profile destroys their APPOINTMENT reminders, and the app says it does not

`setProfileMuted()` calls `cancelRemindersForProfile(id)`. That function filters the device's
pending alarms by **`profileId` only — there is no `kind` filter**:

    const mine = ((res && res.notifications) || []).filter(p => p.extra && p.extra.profileId === profileId);

So muting cancels every armed alarm that profile has, appointments included. **Measured, not read.**
`probe-v93-audit.mjs` section C stubs the Capacitor bridge, arms a dose alarm and an appointment
alarm for `p2`, taps the shipped `setProfileMuted('p2', true)` through the app's own hook, and
records what reached `cancel()`: **`cancelled=[101,102]`** — 101 is the dose, **102 is the
appointment.**

Five places tell the caregiver the opposite:

* the toast they are shown: *"Medication reminders for Sam are off. **Appointment reminders still
  come through.**"*
* the drawer footnote under the rows, same sentence;
* the CHANGELOG bullet the patient reads;
* `README.md`'s app-v93 row: *"**Appointment reminders are deliberately NOT silenced** and the UI
  says so beside the switch"*;
* the comments in `setProfileMuted` and in the new `notifCancelCandidates` clause.

**Why this is a block and not a blemish.** For the ACTIVE profile it self-heals: `markNotifDirty()`
fires and the next sync re-arms the appointment ~400ms later. **For a profile you are not in,
nothing re-arms it** — `syncNativeReminders` builds the active profile's plan alone, and the
release says so in its own toast: *"Reminders for X resume next time you open their profile."* So
the alarm is gone for up to the full 72-hour horizon. The person this feature was designed around
is *"currently in the hospital"* — the single most likely person on the phone to have a scan or a
clinic slot inside those 72 hours, which is the release's own stated reason for keeping
appointments alive. It silently deletes the reminder for somewhere they have to BE, and tells the
caregiver it did not.

**It is a new defect, introduced by this release.** Before v93 `cancelRemindersForProfile` had one
caller, `deleteProfile`, where cancelling everything is exactly right. The second caller wants a
narrower cancel and got the wide one.

**The fix, measured.** On a byte copy outside the repo (md5 `2d55f607…` → `f4b66d16…`), served on
its own port 9477:

    async function cancelRemindersForProfile(profileId, kinds) { ...
      && (!kinds || kinds.indexOf(p.extra.kind) !== -1));
    ...  await cancelRemindersForProfile(id, ['dose', 'checkin']);

`deleteProfile`'s call passes no `kinds` and keeps today's sweep-everything behaviour. Against that
copy: probe C **all four PASS** (`cancelled=[101]`), `test/v93-profile-notifications.mjs` **27/27**,
`test/v85-profile-reminders.mjs` **43/43**. Red on HEAD, green on the fix — falsified both ways.

**And the suite cannot see it.** v93 is 27/27 with the defect and 27/27 without it. Attacking the
corpus as instructed: the one claim in the README's app-v93 row with **no mutant behind it** is
*"Appointment reminders are deliberately NOT silenced"* — and that is the claim that turned out to
be false. The fix needs a check and a mutant, not just a patch.

---

## Findings — real, none of them blocking

**F1. "It over-reports, never under-reports" is false.** `readProfileMeds` runs
`backfillDefaultMedFlags` → `normalizeMedication` and stops. `loadMedicationConfig` also runs
**`migrateLegacyMedRules`**, which for id `dexamethasone` carries `replaceWindows: true` and
**replaces the stored windows** with 08–12 / 14–18. Measured with `probe-v93-underreport.mjs`:
identical stored bytes (config `version: 1`, no `schemaV`, stored window 00:00–01:00), read from
outside the profile → **count 0**; the same profile opened → **count 1**. A strict under-report —
the direction the release promises never happens, in the one gate it skipped. Reachability is
narrow (a legacy `dexamethasone` id in a config not loaded since app-v77, since loading stamps it
forward), which is why this is a finding and not a block. `migrateLegacyMedRules` is pure and
writes nothing, so `.map(migrateLegacyMedRules)` in `readProfileMeds` closes it; otherwise soften
the claim in the code, the README and the UI's "(about)".

**F2. The most destructive line in the release has no test and no mutant.** The new
`notifCancelCandidates` clause returns `true` — *cancellable* — and sits ahead of the protection
app-v85 exists to provide. I drove the shipped predicate directly (probe A/B) and it holds up:
a muted profile's `dose` and `checkin` alarms are cancellable; its **`appt` alarm is protected**;
an alarm whose `extra.kind` is **missing** is not destroyed (it falls through to the existence
rule); the ACTIVE profile's own stale dose alarm stays cancellable; and with
`Storage.getItem` throwing on `PROFILES_KEY`, `toCancel=[]` — it **fails closed**, unlike the
`loadJSON` trap the function's own comment documents. A profile deleted while muted leaves the
list, so its alarms become cancellable and are swept, which is correct. All of that is currently
true and nothing in the gate would notice if it stopped being. Add those five checks and a mutant.
Minor, same clause: `profileIsMuted()` is called **per notification**, two lines below a comment
explaining why `knownProfileIds` is read **once per call** for exactly that reason.

**F3. `test/v85-profile-reminders.mjs` is not wired into `release_check.sh`** — and this release
edits the function that suite exists to guard. I ran it by hand: **43/43 on HEAD.** Wire it in.

**F4. A comment claims more than the code does.** *"syncAppBadge() no-ops unless the total actually
moved, so this costs a single integer comparison on the overwhelming majority of renders."* The
comparison is cheap; the count that feeds it is computed first, every render. Measured: 3 profiles
× 4,000 entries (~300 KB of JSON each), `totalDueCount()` = **2.3 ms per call** on this box, and
`render()` and `renderHeader()` each call it — ~2 passes a second, on a desktop CPU, growing with
history. Compute once per render and pass it down.

**F5. `lastAppBadge` is assigned before the platform call**, so a rejected `setAppBadge` /
`clearAppBadge` leaves the remembered value out of step with the icon until the count next moves.
Assign after the promise resolves.

**F6. Armed titles go stale on a rename or a deletion.** `createProfile` reloads, so adding a
profile re-arms every title with its name. `renameActiveProfile` and `deleteProfile` call neither
`markNotifDirty()` nor a reload, so armed titles keep the old name (or keep a name on a phone that
is back to one profile) until the 6-hour `NOTIF_SYNC_MAX_AGE_MS` backstop. Cosmetic, self-healing.

**F7. The two surfaces of one number disagree on a single-profile phone.** The app-icon badge is
`totalDueCount()` ungated; the menu-button count is gated on `multiProfile()`. So one profile gets
a number on the icon and nothing in the app. That matches Aaron's ask #2 literally and is a
defensible call — it just belongs in the release message as a stated choice.

---

## What I checked and found clean

* **No cross-profile write anywhere on this path — the app-v85 defect has not come back.**
  `readProfileMeds` / `readProfileEntries` are `getItem` + `JSON.parse` only, and
  `loadMedicationConfig` (which persists a migration as a side effect) is correctly not called.
  Probe D snapshots **all of localStorage** before, between and after repeated `profileDueSummary()`
  / `totalDueCount()` / `buildReminderTitles()` calls: byte-identical, and the answers are stable.
  The only shared write is `PROFILES_KEY`, read-modify-write, and every other writer of that list
  (`createProfile`, `deleteProfile`, `renameActiveProfile`, `switchProfile`, `cwUndoRestore`)
  preserves `muted` because they all mutate the whole object.
* **Brief item 7 — no measurement hook mutates.** The five read hooks are pure (probe D);
  `setProfileMuted` is an action the suite invokes on purpose, not a measurement.
* **The skipped gates can only over-count.** `profileDueCount` applies `alerts`, `windows`,
  `paused` and `medScheduledOn` to every profile and skips only `treatmentOnlyBlocks` /
  `treatmentExcludedNow`, both of which only ever suppress. `medScheduledOn` is pure in
  `med` + `dayTs` — no `state`, no prefs — so `weekly`, `interval` and `asneeded` are judged
  identically from outside. `asneeded` never has `alerts` (derived in `normalizeMedication`).
  `profileDueCount` reads `med.windows`, which is the same source `buildReminderPlan` arms from,
  so the count and the reminders cannot disagree about which windows exist.
* **Appointments survive the sweep in both paths**, as distinct from the immediate cancel in
  BLOCK 1: `syncNativeReminders` strips only `dose` / `checkin` from the plan, and
  `checkNotifications` really is dose-only (`sendNotif` has exactly two call sites;
  `checkAppointmentReminders` is a separate function and is not gated on mute). There is no
  reactive check-in notifier, so nothing is left ungated.
* **`syncAppBadge` cannot spin** — it never calls `setState`; every platform call is wrapped and
  every promise has a `.catch`.

## Reproduced, with timings

| What | Result |
|---|---|
| `test/v93-profile-notifications.mjs` | **27/27**, 5.7s |
| `falsify/mutants-v93-profiles.sh` via `falsify.sh` (port 9441) | **11 caught, 0 survived, 0 stale, 2 over-block controls green, exit 0**, 1m44s |
| `test/v85-profile-reminders.mjs` (not in the gate) | **43/43**, 31s |
| `test/v75-no-other-patient.mjs` | **29/29** |
| `probe-v93-audit.mjs` (13 checks, shipped hooks) | 12 pass, **1 fail — BLOCK 1** |
| `probe-v93-underreport.mjs` | **1 fail — F1** |
| `probe-v93-cost.mjs` | 2.3 ms per `totalDueCount()` |

Probes are in the session scratchpad, not the repo:
`/tmp/claude-0/-home-user/41e5d279-40d0-5a8a-b4e0-827057dd9522/scratchpad/probe-v93-audit.mjs`,
`…/probe-v93-underreport.mjs`, `…/probe-v93-cost.mjs`. They should become checks in
`test/v93-profile-notifications.mjs` rather than stay there.

**Deliberately not re-run, disclosed rather than implied:** `overflow-scan` (171, 7m23s),
`contrast-scan` (327), `v84-whatsnew`, `v90-chart-axes`, `v92-pill-clearance`,
`v92-text-collisions`, `v76-*` — I took the builder's figures for those, because none of them can
see any of the four failure modes this release risks, and my time went where a wrong reminder
lives. `release_check.sh` was not run: its Quality Chain gate needs a PM sign-off for app-v93 that
does not exist yet, and it stops the run there (its own M25). The 320px drawer rendering was not
independently re-measured; `outputs/drawer-profiles-320.png` is in the release.
`care-tracker` was not cloned, opened, scanned or run against — RULE 0.0.

## To clear this audit

1. Kind-filter the cancel in `setProfileMuted` (three lines; leave `deleteProfile` as it is).
2. Add checks that a muted profile keeps its appointment alarm — through `setProfileMuted` with a
   stubbed bridge, and through `notifCancelCandidates` — plus a mutant for each.
3. Then F1: either run `migrateLegacyMedRules` in `readProfileMeds` or stop claiming the count
   never under-reports.

F2–F7 are backlog. The re-audit is a delta pass over those three items.
