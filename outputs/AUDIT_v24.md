# AUDIT_v24 — Zero Day Auditor Report (Full Chain, Stage 3)

**Auditor:** Claude (Zero Day Auditor role, per TEAM.md)
**Date:** 2026-07-28
**Build under test:** `/home/claude/chemowell-app-beta/index.html`, served at `http://localhost:8910/index.html`
**Scope:** Full-charter sweep (first-run walkthrough, all 5 medication placement/category modes, 7-day-span logging for every loggable type across every display surface) **plus** the release-specific notification-gate fix and two new Calendar reminder options described in the task brief.
**Method:** Automated Playwright (Chromium, `/opt/pw-browsers/chromium`) end-to-end tests against the running app, primary viewport 390×844 (secondary pass at 360×800), with `localStorage` seeding matched to the app's real schema and a faked `window.Notification` to capture fired reminders. Test scripts: `/home/claude/chemowell-app-beta/audit_v24.mjs` and `/home/claude/chemowell-app-beta/audit_v24_part2.mjs` (both left in the repo for the Lead Auditor to re-run). Full console-error capture on every run (ERR_TUNNEL/ERR_FAILED/ERR_NAME_NOT_RESOLVED excluded per the sandbox note).

**Result: 45 test cases run, 45 passed, 0 failed.** (One test's *first* attempt — TC34 — failed due to a wrong locator in my own script, not an app defect; corrected and re-verified, see the case note.) This exceeds the charter's 20-test minimum and covers every named required area. 3 Findings below (0 blocker, 2 should-fix, 1 nice-to-have) — all pre-existing or release-mechanics gaps, **none are functional defects in the code this release actually shipped**.

---

## Test cases (pass/fail, one line each)

### A. First-run walkthrough (genuinely wiped install)
1. **PASS** — Wiped install shows the "Welcome to ChemoWell" setup screen with a patient-name field and "Get started" button.
2. **PASS** — After "Get started," the guided tour begins automatically ("Welcome — let's set up together" intro step).
3. **PASS** — Following the tour's own prompts (Meds tab → Add → fill name + gap hours → Add medication → Home), the medication is saved and the tour advances through "Nice work!" → tap Home.
4. **PASS** — The newly added medication actually appears as a Quick Log card on Home after finishing the tour (not just saved silently).
5. **PASS** — Zero console errors throughout the entire first-run + tour + first-medication-add flow.

### B. Medication placement/category coverage (every option the editor supports)
6. **PASS** — "Own Home card" placement: medication renders as its own standalone Quick Log card on Home.
7. **PASS** — "No Home card" (hidden) placement: medication is absent from Home's Quick Log entirely, but still listed and editable from the Meds tab.
8. **PASS** — "Morning meds group" placement: medication is listed inside the shared "Morning meds" grouped card on Home, not as its own card.
9. **PASS** — "Only near treatment day" (treatment-day-only): medication is fully absent from Home with no treatment date set, and appears/loggable once a treatment (chemo) date is set to today.
10. **PASS*** — "Excluded near treatment day": medication is normally loggable; during the excluded window it becomes an inert, unloggable placeholder card labeled "Excluded near treatment day" rather than disappearing outright. *(Behaves correctly/safely — the med truly cannot be logged — but see **Finding 1**: this contradicts the editor's own "Hidden" copy.)*

### C. 7-day-span logging, every loggable type, checked on every display surface
11. **PASS** — Medication doses logged across a simulated 7-day span show up correctly (Today's Journal / Home dose state).
12. **PASS** — Weight entries across 7 days appear correctly in History.
13. **PASS** — Weight entries across 7 days appear correctly in the dedicated Reports → Weight trend tab.
14. **PASS** — Temperature entries across 7 days appear correctly on Home's latest-reading card and in History (there is no separate Reports tab for temperature — confirmed this is by design, not a gap; temperature only surfaces via Home + History).
15. **PASS** — Blood pressure entries across 7 days appear correctly on Home's latest-reading card and in the dedicated Reports → Blood Pressure tab.
16. **PASS** — Bowel movement entries across 7 days appear correctly in the dedicated Reports → Bowel Movement tab.
17. **PASS** — Appetite entries across 7 days appear correctly in the dedicated Reports → Appetite tab.
18. **PASS** — Symptom entries (nausea, one per day) across 7 days appear correctly in the Symptoms tab.

### D. Release-specific: notification/reminder gate fix (medication dose reminders)
19. **PASS** — With the simulated date NOT offset (`dateOffsetDays === 0`), a medication dose-window reminder fires a real browser notification at its correct real-clock trigger time.
20. **PASS** — Jumping the date forward via Beta Date Controls with a dose reminder due suppresses it completely — confirmed by seeding a window that becomes due *while already time-traveled* (not one already open at load), watching real clock time carry it into its due state, and confirming zero notifications fired.
21. **PASS** — Clicking Reset (or `resetSimDate()`) resumes real dose-reminder firing — verified with a freshly-due window after reset.

### E. Release-specific: notification/reminder gate fix (Calendar appointment reminders — tested independently per the brief, since dose reminders and appointment reminders share the identical bug but are fixed in two separate functions)
22. **PASS** — With the date NOT simulated, a Calendar appointment reminder fires a real browser notification at its correct real-clock trigger time.
23. **PASS** — Jumping the date forward suppresses the appointment reminder completely.
24. **PASS** — Resetting the simulated date resumes real appointment-reminder firing.

### F. Release-specific: two new Calendar reminder options
25. **PASS** — "At the scheduled time" (`attime`) fires exactly at the appointment's timestamp and shows the correct label ("At the scheduled time") in the Calendar list.
26. **PASS** — Custom reminder fires at its correctly computed trigger time (`appt.ts − n × unitMs`).
27. **PASS** — Custom lead-time UI (number input + unit `<select>` + live "Reminds N unit before" preview) appears **only** when "Custom..." is selected — confirmed absent for "1 hour before" and for the default state, present only after selecting Custom.
28. **PASS** — Negative custom value (`-10`) is rejected at save with the exact toast text "Enter a reminder time of 0 or more."
29. **PASS** — `0` is accepted (not rejected) and both saves successfully and displays as "At the scheduled time" in the Calendar list, not "0 minutes before."
30. **PASS** — Editing an already-fired (`reminded: true`) custom-reminder appointment and changing **only** the custom lead time (30 min → 120 min) correctly resets `reminded` to `false` (re-arms it).
31. **PASS** — Editing an already-fired custom-reminder appointment and changing **only** the note does **not** re-arm it (`reminded` stays `true`).
32. **PASS** — Re-opening an appointment that has a saved custom reminder (7 days) correctly populates the number field (`7`) and unit select (`Days`) in the editor — not blank or defaulted.
33. **PASS** — Calendar list shows correct, grammatically-correct human-readable labels for all 5 reminder types simultaneously, including singular/plural handling for custom units ("1 hour before" vs "2 hours before", "1 day before" for both the fixed option and a custom 1-day value).
34. **PASS** — `apptReminderLabel(appt)`'s new object-based signature has exactly one call site in the codebase (grep-verified) — no second caller was silently broken by the signature change.

### G. Settings notification permission UI + FAQ copy
35. **PASS** — Settings notification permission block renders the correct green "✓ Notifications are on" for the `granted` state.
36. **PASS** — Settings notification permission block renders the correct red "Notifications are blocked for this app" + browser-settings instructions (no button, since JS can't re-prompt after denial) for the `denied` state.
37. **PASS** — Settings notification permission block renders the correct amber "Notifications aren't turned on yet" + working "Turn on notifications" button for the `default`/never-answered state.
38. **PASS*** — Notification permission-status block is gated to the non-native branch only (`!isNativeApp() ? notifPermissionStatusBlock() : null`, confirmed by direct code inspection). *I could not exercise the actual native/Capacitor branch in this sandbox — flagging as untested rather than silently skipping, per the task instructions.*
39. **PASS** — FAQ "How do I get a reminder for an appointment?" entry lists all 5 reminder options and correctly mentions the foreground-only/no-background-delivery limitation, with no contradiction of the actual UI.

### H. Regressions and edge cases
40. **PASS** — The 3 pre-existing reminder options (1h/morning/1day) are unaffected: a note-only edit on an already-fired 1h-reminder appointment does not re-arm it (matches the pre-existing app-v22 audit-fixed behavior exactly).
41. **PASS** — Beta Date Controls' date-jump buttons and the Plans sheet's "Simulate purchase (beta)" / "Reset to Free" controls are unaffected by this release. *(My first attempt at this check used a wrong locator to open the Plans sheet — "Plans" isn't reachable directly from the drawer, only via Settings → "View plans" — and false-failed as a result; corrected and re-verified as passing. Documented so the Lead Auditor doesn't need to re-derive this.)*
42. **PASS** — Zero console errors across 3+ tick cycles (the interval that drives `checkNotifications`/`checkAppointmentReminders`) and every main screen, at both 390×844 and 360×800.
43. **PASS** — Double-tapping "Add medication" (simulating a fast double-tap) does not create a duplicate medication.
44. **PASS** — A dose logged at 23:59:30 (day boundary) appears correctly in History without error.
45. **PASS** — Empty states (brand-new profile with zero medications and zero appointments) render Home and Calendar without crashing or going blank; absurd inputs (300-character appointment title, `999999999` custom lead-time minutes) save without crashing or causing horizontal layout overflow; app reload while offline still renders from cached shell + persisted `localStorage` data.

---

## Findings

### Finding 1 — "Excluded near treatment day" doesn't actually hide the medication; the editor's own copy says it will (nice-to-have, pre-existing, not introduced by this release)

- **File/location:** `index.html:3022-3030` (render logic, `renderToday`'s `medCards` builder) vs. `index.html:3601-3605` (`TREATMENT_MODE_OPTIONS` copy in the medication editor).
- **Summary:** The medication editor's "Excluded near treatment day" option is described to the user as: *"Hidden for a window of days around your treatment date — available the rest of the time."* In practice, the medication is **not** hidden during that window — it renders as a visible, dashed-border, inert placeholder card on Home reading "`<name>` / Excluded near treatment day." This is a deliberate design choice per the code's own v20-restart comments (so a caregiver doesn't see a card silently vanish and wonder if data was lost), and it's arguably the *better* UX than literally hiding it — but the copy the user reads while choosing this option promises full hiding, and it doesn't deliver that. This is not a functional bug (the medication genuinely cannot be logged during the window, which is the important safety property), but it's a real mismatch between what the picker tells a non-technical caregiver and what happens.
- **Failure scenario:** A caregiver reads "Hidden for a window of days" in the editor, picks "Excluded near treatment day," and later during that window sees the medication's name still sitting on Home (just inert) — which reasonably reads as "the app didn't do what it said," especially contrasted with the sibling "Only near treatment day" option, which genuinely does vanish completely (confirmed correct in test case 9 above).
- **Screenshot:** `/tmp/tc6_excluded_near_treatment.png`
- **Suggested fix (for the Lead Developer to consider, not applied here):** Either (a) change the picker's helper copy to say something like "Grayed out and can't be logged for a window of days around your treatment date," matching actual behavior, or (b) if literal hiding is preferred for consistency with the "only" mode, remove the inert-card render path. This is a copy/design decision, not a pure logic bug, so it may belong with the Designer stage's copy review rather than a code fix — flagging here since Audit runs before Designer this release and this is exactly the kind of finding that can reshape what the Designer reviews.

### Finding 2 — Reminder pipeline's "zero entries anywhere" gate silently blocks a brand-new user's very first reminder (should-fix — pre-existing gate, but its impact is new because this release is what makes the pipeline actually fire on web for the first time)

- **File/location:** `index.html:4845` — `checkNotifications()`: `if (!state.loaded || state.entries.length === 0 && !state.demo) return;`
- **Summary:** A profile with a scheduled medication (`alerts: true`, an open dose window right now) and **zero logged entries of any kind** (the exact state of a genuinely brand-new install that has added its first medication but not yet logged anything) never receives a dose reminder — confirmed by direct test: seeded exactly this state, waited through the 1-second tick loop for 6+ seconds during an open window, zero notifications fired.
- **Failure scenario:** A new caregiver finishes onboarding, adds their first scheduled medication with reminders on, and does not receive a reminder for it — the single highest-value moment for a first-time reminder to prove itself. This predates v24 (the Dev Brief for this release explicitly flagged it as Open Question #2 and asked the Auditor to weigh in if it looked "surprising in practice" during this pass) but its real-world impact is new: before this release's gate fix, reminders never fired on web at all regardless of this rule, so this specific edge case was unreachable and invisible. Now that the pipeline genuinely fires, this gate is the first thing a brand-new user's very first reminder will run into.
- **Repro steps:** Seed/create a profile with one scheduled (`type: 'win'`) medication, `alerts: true`, a dose window covering the current time, and zero entries in `chemowell-app-p-{id}-entries-v1`. Load the app and wait through an open window. Expected: a reminder fires once the window opens. Actual: nothing fires, silently, with no error and no way for the user to tell why.
- **Suggested fix:** Either drop the `state.entries.length === 0` clause entirely (its original intent — likely avoiding reminder noise before a user has "started" — doesn't obviously apply once a medication with `alerts: true` exists) or add an explicit early return specifically for "no medications with alerts yet" instead of "no entries of any kind yet," which is a much narrower and more defensible gate.

### Finding 3 — Release mechanics incomplete: version not bumped for this ship (should-fix, process/release-mechanics gap — likely PM stage's job to catch at final gate, flagged here since it's a concrete, verifiable gap found during this pass)

- **File/location:** `index.html:4086` (`const APP_VERSION = 'app-v23';`), `sw.js:1` (`const CACHE = 'chemowell-app-v23';`), `README.md` (no `app-v24` version-history entry exists anywhere in the file).
- **Summary:** TEAM.md's Release mechanics checklist (binding for both lanes) requires "Version bump (`APP_VERSION` in index.html) and service worker cache name bump for any change that ships to users" plus a "README.md version history entry." None of the three have happened yet for this release. Settings → About & Legal visibly shows "ChemoWell app-v23 (beta)" even though this build contains the notification-gate fix and two new Calendar reminder options.
- **Failure scenario:** If this build ships as-is: (1) a user who already has the PWA installed/cached under the old `chemowell-app-v23` service-worker cache name won't reliably get the new build's assets busted/refetched, since the cache key hasn't changed; (2) Aaron (or anyone) looking at Settings → About has no way to tell a new version shipped; (3) there's no README history entry documenting the fix or the foreground-only limitation caveat that the Dev Brief explicitly called out as needing to be surfaced in two places (in-app copy — done, confirmed in test case 39 — and README — not done).
- **Note:** This is squarely release-mechanics territory (normally the Lead Developer's self-verification step and the PM's final gate), not a functional defect in the shipped code itself — flagging it here as a concrete, easily-missed gap since I happened to check it directly.

---

## Notes on methodology / things worth the Lead Auditor's attention

- All localStorage seeding matched the real key schema (`chemowell-app-profiles-v1`, `chemowell-app-p-{id}-prefs-v1`/`med-v1`/`entries-v1`/`appts-v1`) and real object shapes read directly from `index.html` (not guessed).
- The 7-day-span logging tests (cases 11-18) seeded entries with real historical timestamps spanning the past 7 real days rather than literally driving Beta Date Controls through 7 forward jumps and logging at each stop — this exercises the exact same render/report code paths (which all key off entry timestamps, not "how" the timestamp was produced) and was far faster; the Beta Date Controls mechanism itself *was* separately and directly exercised (and is exactly what's under test) in cases 20-24, which specifically shift/reset the simulated date and depend on that mechanism working correctly.
- One genuine transient/flaky issue in my own test tooling is worth naming for the Lead Auditor: a plain `text=Calendar` / `text=Settings` Playwright locator can resolve to the in-page screen title (which sits under the drawer overlay) instead of the drawer navigation row once you've already visited that screen once in the same session, because both elements contain the same text. I fixed this by matching on each drawer row's unique subtitle instead (`"Appointments & reminders"` / `"Profiles, units, data"`). This was a test-script bug, not an app bug, but it's worth flagging because it looks exactly like a "pointer-events intercepted" rendering defect at first glance, and cost real debugging time to rule out.
- Screenshots captured as evidence (in `/tmp/`, not yet curated to the ~10-image cap for the eventual evidence folder — that's a later-stage step per TEAM.md):
  - `/tmp/tc1_welcome.png`, `/tmp/tc1_home_after_first_med.png` — first-run walkthrough
  - `/tmp/tc6_excluded_near_treatment.png` — Finding 1 evidence
  - `/tmp/tc22_custom_ui.png` — custom reminder UI (number + unit + live preview)
  - `/tmp/tc28_labels.png` — Calendar list label correctness across all 5 reminder types
  - `/tmp/tc30_settings_perm_granted.png`, `/tmp/tc30_settings_perm_denied.png`, `/tmp/tc30_settings_perm_default.png` — all 3 permission states
  - `/tmp/tc32_faq.png` — updated FAQ copy
  - `/tmp/tc39_absurd_inputs.png` — absurd-input edge case, no layout overflow
