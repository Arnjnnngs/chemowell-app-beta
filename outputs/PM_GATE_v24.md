# PM Gate — app-v24

**Lane:** Full chain (safety-relevant — dosing/dose-reminder logic and calendar reminder logic
both changed; new feature — two new reminder types; multi-screen — Calendar editor, Calendar
list, Settings, FAQ, medication editor), per TEAM.md, run under Aaron's newly reordered stage
sequence: Developer → Lead Developer → **Auditor → Designer** (swapped this release) → PM.

## What was asked

Aaron reported, live-testing: he set a 10 AM Calendar appointment with a "1 hour before"
reminder, and nothing fired at 9 AM — "there are no notifications working to my knowledge."
He asked for the whole notification pipeline investigated, not just that one repro, since
Calendar reminders and medication dose reminders might share machinery. Separately, he asked
for two reminder-timing gaps to be closed: a "right at the time" option, and a fully custom,
self-set lead time — the four existing choices (none/1h/9am-morning/1day) never let him remind
himself exactly when he actually wanted. He also asked for a much stricter, mandatory-20-test-case
"Zero Day Auditor" charter for full-chain releases, and for Audit to run before Design going
forward, both captured in TEAM.md ahead of this release.

## What shipped

- **Root cause found and fixed:** `checkNotifications()` (medication dose reminders) and
  `checkAppointmentReminders()` (Calendar reminders) both blanket-suppressed every notification
  on the web build whenever `TEST_MODE` was on — which is always true on the build Aaron tests
  with (`arnjnnngs.github.io/chemowell-app-beta`), regardless of whether he'd touched the Beta
  Date Controls at all. This was total and permanent, not intermittent, and matches his repro and
  his broader complaint exactly. Fixed so both functions only suppress when the app's simulated
  "today" is actually offset from real time (`state.dateOffsetDays !== 0`) — a normal session
  that never opens Beta Date Controls now gets real reminders throughout, while suppression
  during an active date-jump is preserved (confirmed by the Developer stage to be more than a UX
  nicety: dose entries logged while time-traveled carry simulated timestamps, so a real-time
  check against them could otherwise fire a spurious "dose not taken" notification).
- **Two new Calendar reminder options:** "At the scheduled time" (fires exactly at the
  appointment) and "Custom..." (a number input + minutes/hours/days picker, with a live "Reminds
  N unit before" preview). Negative values are rejected at save with a clear toast; 0 is accepted
  and treated as "at the scheduled time." Editing an already-fired appointment re-arms its
  reminder only when something that actually changes the trigger time changed (date/time, the
  reminder type, or — new this release — the custom lead time/unit itself), matching the
  existing app-v22 audit-fixed behavior for the 4 prior options exactly.
- **Settings → Notifications rewritten:** the old copy claimed reminders "arrive with the
  phone-app version (in progress)" — actively wrong once Calendar reminders shipped in app-v22.
  Now explains reminders fire for real on web, but only while the app is open in the foreground
  (no background/locked-phone delivery without the native app — a real architectural limit, not
  something this fix can close, since the web build has no true push subscription, only a
  foreground 1-second tick loop). A new permission-status block shows one of three states
  (granted/denied/never-answered) with a working "Turn on notifications" action for the
  never-answered state.
- **FAQ updated** to list all 5 reminder options and state the foreground-only caveat plainly,
  in its own short sentence rather than buried in a compound one (Designer finding, see below).

## Stages that ran (new order: Auditor before Designer)

1. **Developer** — independently re-verified the Lead Developer's root-cause finding, and found
   an additional correctness argument for it (simulated-timestamp dose entries could otherwise
   trigger spurious real-time notifications). Designed the exact data shape and edge-case handling
   for both new reminder options, including a real gap in the existing re-arm logic that needed
   closing as part of adding the custom option. Report: `outputs/DEV_BRIEF_v24.md`.
2. **Lead Developer** — implemented the gate fix (both functions + the permission-request call
   site), both new reminder options end-to-end (data model, trigger math, editor UI, list label,
   save validation, re-arm logic), the Settings permission-status block, and the FAQ/Settings copy
   updates. Self-verified: syntax clean, 8 targeted Playwright checks (real-time firing confirmed
   for both dose and appointment reminders, suppression-while-simulated confirmed, custom-value
   validation confirmed, all 3 permission states confirmed) plus a full-app smoke pass at
   390×844/360×800/1280×900, zero console errors throughout.
3. **Auditor ("Zero Day Auditor")** — ran under TEAM.md's newly expanded charter: **45 written
   test cases** (more than double the 20-case minimum), covering a full first-run walkthrough from
   a wiped install, all 5 medication placement/category modes, a simulated 7-day logging span for
   every loggable type checked against every display surface (Home/Reports/Journal/History/
   Symptoms), the full notification-gate fix tested independently for both dose and appointment
   reminders, both new reminder options including validation/re-arm/round-trip editing, all 3
   Settings permission states, FAQ copy, and edge cases (double-tap, day boundary, empty states,
   absurd inputs, offline reload). **45/45 passed.** Report: `outputs/AUDIT_v24.md`.
4. **Designer** — reviewed every surface this release touched at 390×844 (primary) and 360×800,
   using real `getBoundingClientRect()` measurements rather than eyeballing. Report:
   `outputs/DESIGNER_v24.md`.

No Lead Auditor / Lead Designer pass — every finding from both reviewers was unambiguous and
fixed directly, then re-verified against its specific repro, per TEAM.md's discretion clause.

## Findings — all fixed, all re-verified

**Auditor — should-fix:** `checkNotifications()`'s pre-existing "zero entries logged anywhere
yet" gate silently blocked a brand-new user's very first dose reminder — the single highest-value
moment for a reminder to prove itself. This clause predates v24 but was invisible until this
release made the pipeline fire for real on web at all. Fixed by dropping it (the inner
`dueRemindersAt()` already correctly scopes itself to medications with alerts on, so nothing
depended on the outer gate). Re-verified: a brand-new profile with one scheduled medication,
alerts on, and zero logged entries now receives its first reminder correctly.

**Auditor — nice-to-have:** the "Excluded near treatment day" medication option told the user in
the editor it would be "Hidden" during the excluded window, but the medication actually stays
visible as an inert, grayed placeholder card (a deliberate v20 design choice so a caregiver never
sees a card silently vanish). Fixed the copy to say "Grayed out and can't be logged," matching
actual behavior — not a logic change, since the inert-card behavior is the safer UX and was
working correctly; only the promise the picker made was wrong.

**Auditor — should-fix (release mechanics):** version/cache/README hadn't been bumped yet at the
time of the Auditor's pass — expected, since Audit now runs before the ship step in the new
stage order; closed by this same release's version bump below.

**Designer — should-fix:** the "Turn on notifications" button measured 40px tall, 4px under the
app's 44px touch-target floor — on the one actionable control in the whole notification-status
block. Fixed to 44px.

**Designer — should-fix:** the Calendar list's reminder bell icon vertically centered against the
*whole* wrapped label instead of its first line, so a long custom reminder (e.g. "999 minutes
before," a case the 3 old fixed options never produced) left the icon floating in the gap between
lines. Fixed with `alignItems: 'flex-start'` plus a small top offset so it aligns with line 1.

**Designer — should-fix, copy:** the FAQ's foreground-only caveat was buried as the tail clause
of a compound sentence also covering an unrelated permission-prompt fact. Flagged by the Designer
as worth extra scrutiny given the real consequence of a caregiver missing this and assuming a
Calendar reminder works like a native phone alarm. Rewritten into its own short, clearly-labeled
sentence ("One thing to know: reminders only fire while ChemoWell is open in your browser...").

**Designer — nice-to-have:** the "Turn on notifications" CTA used the same low-emphasis pill
styling as the purely-optional "Replay the walkthrough" button right below it, undercutting its
importance as the fix for an actual functional gap. Fixed to the app's solid-fill primary-action
treatment (same recipe as the Calendar modal's Add/Save button).

**Designer — nice-to-have:** the "granted" permission status rendered as bare colored text
instead of reusing the app's existing green success-pill pattern (already used for the "Active"
profile badge on the same screen). Fixed to match.

All 7 findings fixed and re-verified: the two logic fixes (Findings 2 and the entries-gate fix)
via targeted Playwright re-tests; the five visual/copy fixes via fresh screenshots at 390×844
confirming each specific repro no longer reproduces, plus a full re-run of the syntax check and
both verification suites (zero console errors, zero regressions).

## Release mechanics

- `APP_VERSION` bumped `app-v23` → `app-v24`; service worker cache bumped to match
  (`chemowell-app-v23` → `chemowell-app-v24`).
- README.md version history updated (this release's entry).
- TEAM.md updated ahead of this release with Aaron's new stage order (Auditor before Designer,
  both lanes) and the expanded, 20-test-case-minimum Zero Day Auditor charter.
- Evidence: 9 curated screenshots in `outputs/v24-evidence/` — within TEAM.md's ~10-image cap:
  notification permission default/granted/denied states, the Calendar list bell-alignment fix,
  first-run walkthrough, custom reminder controls + live preview, updated FAQ copy, and the
  treatment-exclusion copy fix (with the actual card behavior it now correctly describes).
- Push + live cache-busted verification: next step, immediately following this gate.

## PM sign-off

Matches everything Aaron asked for: the notification pipeline was investigated end-to-end (not
just the one repro), the actual root cause was found and fixed with a concrete correctness
justification beyond just "it should work now," both new reminder options ship with full
validation/edit/re-arm handling, and the new stage order (Auditor before Designer) plus the
20-test-minimum Auditor charter were captured in TEAM.md and then actually exercised on this same
release (45 test cases run, more than double the minimum). Every stage that ran produced its
artifact (`DEV_BRIEF_v24.md`, `AUDIT_v24.md`, `DESIGNER_v24.md`, this doc, the evidence folder).
Every finding — 0 blockers, 3 should-fix + 1 nice-to-have from the Auditor, 3 should-fix + 2
nice-to-have from the Designer — was fixed and the fix itself re-verified against its specific
repro, not just claimed. No scope drift. The foreground-only limitation of web notifications is a
real, permanent architectural fact (not a bug this release could close) and is now surfaced
honestly in three places — Settings copy, FAQ copy, and this document — rather than implied away.
Release mechanics complete except the push, which follows immediately.
