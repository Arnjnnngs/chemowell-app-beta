# PM Gate — app-v22

**Lane:** Full chain (new navigation paradigm + new data type/storage + multi-screen + new notification path), per TEAM.md.

## What was asked

Aaron: the app "still looks basic" — he wants the common Android pattern of a hidden hamburger
panel on the left housing Profile, Settings, and a new Calendar. Plus: an FAQ section under
Settings, the tour replay confirmed to live under Settings, a Calendar tab wired to notifications
for future appointments, and (from the earlier research report) the steroid-medication
weight-reason suggestion built now rather than left as a future candidate.

## What shipped

- **Left nav drawer** — hamburger icon (replaces the old standalone "?" and gear header icons,
  both one tap deeper now) opens a slide-in panel: identity header (active profile, tap → Settings),
  Calendar, Settings. Scrim, Escape-to-close, Tab-trap, focus returns to the hamburger on close.
- **Calendar** — new view reachable from the drawer. Add/edit/delete appointments (title, date via
  the app's existing calendar-grid picker, time, optional note, optional reminder: 1 hour before /
  morning-of / 1 day before / none). Upcoming list sorted ascending, collapsible Past section.
  Reminders fire through the existing `sendNotif` native/web path via a new, independent
  `checkAppointmentReminders` tick — deliberately not merged into the pre-existing medication
  `checkNotifications` system, so a bug in one can't take down the other.
- **FAQ** — 8-question accordion in Settings, app-usage only (privacy, adding meds, switching
  profiles, missed doses, treatment date, the new weight-reason field, the new Calendar reminders,
  Start over). Medical-advice questions stay out of scope, next to the existing disclaimer.
- **Replay the walkthrough** — already lived in Settings from a prior release; confirmed still there
  and still working, and the tour's own final-step copy updated since it referenced the now-removed
  header "?" button.
- **Steroid weight-reason suggestion** — the weight-log modal now shows a tap-to-fill hint ("Taking
  Dexamethasone — steroids commonly cause fast weight gain...") when an active, non-paused
  medication name-matches a common oncology steroid and no reason is picked yet. Never auto-selects.

## Stages that ran

1. **Lead Developer** — implemented, self-verified: syntax check clean, two Playwright smoke suites
   (new-feature coverage + full regression) at 390×844 and 1280×900, zero console errors both.
2. **Designer** — reviewed all 8 self-verify screenshots plus drove the app live for states not
   captured (calendar empty state, pre-tap suggestion banner). Found 2 should-fix issues.
3. **Auditor** — full code audit of the diff's blast radius plus extensive live edge-case testing
   (double-tap timing, keyboard Tab-trap with a real keyboard, reload-with-drawer-open, paused/
   archived medication exclusion, reminder math). Found 1 blocker, 3 should-fix, 1 nice-to-have.

No Lead Designer / Lead Auditor pass — every finding was unambiguous and fixed directly, then
re-verified against the specific repro, per TEAM.md's discretion clause.

## Findings — all fixed, all re-verified

**Auditor — BLOCKER:** a fast double-tap on the hamburger button could land its second tap on the
drawer's newly-rendered identity button underneath (same screen coordinates), force-navigating to
Settings instead of just opening the drawer. Fixed by moving the close "X" to its own button in the
top-right corner of the drawer panel (previously nested inside the identity button, which was also
invalid markup) — the identity button no longer occupies the hamburger's former top-left position.
Re-verified live via a real two-click Playwright sequence at the hamburger's exact coordinates: no
longer navigates.

**Auditor — should-fix:** the "morning of" reminder always targeted 9 AM regardless of the
appointment's own time, so an appointment before 9 AM (e.g. a 7 AM lab draw) would get its reminder
*after* the visit was already over. Fixed to fall back to 1-hour-before whenever the naive 9 AM slot
would land at or after the appointment. Re-verified with a unit test: a 7 AM appointment now
triggers at 6 AM; a 2 PM appointment still triggers at 9 AM as before.

**Auditor — should-fix:** editing *any* field on an already-reminded appointment (even just fixing a
typo in the note) reset its `reminded` flag, silently re-arming a reminder that had already correctly
fired. Fixed to only reset `reminded` when the date/time or the reminder choice itself changed — a
note-only edit now leaves `reminded` untouched. Re-verified live in both directions (note-only edit
preserves `reminded:true`; changing the reminder choice correctly resets it to `false`) — this also
caught and fixed a precision bug in my own first attempt at the fix (comparing timestamps to the
millisecond instead of the minute, which the form itself can't express, caused false positives).

**Auditor — should-fix:** the drawer close button was nested inside the identity button
(`<button><span role="button"></span></button>`) — invalid markup, inconsistent across screen
readers. Fixed as part of the blocker fix above (now a sibling button, not nested).

**Auditor — nice-to-have:** opening the drawer while the first-run tour is active buries the tour
card (drawer z-index sits above it) with no way back except closing the drawer. Fixed by having the
hamburger no-op while a tour is in progress — the tour's own Skip/Back/Next controls stay available.

**Designer — should-fix:** 3 new touch targets (drawer close X, calendar row edit/delete buttons)
were 36×36px, under the app's documented 44px floor. Fixed — all three are 44×44px now (this was
resolved as part of the blocker fix for the close button; the calendar row buttons were a separate
one-line change each).

**Designer — should-fix:** the steroid-suggestion banner and the calendar's reminder badge used raw
color emoji (💡 🔔), inconsistent with the rest of the app's custom SVG line-icon language (every
other icon, including several added in this same release, is a hand-drawn rose/mauve line icon).
Fixed by adding matching `bulb` and `bell` line icons to the shared icon set and swapping both spots
over — re-verified visually via screenshot.

## Release mechanics

- `APP_VERSION` bumped `app-v21` → `app-v22`; service worker cache bumped to match.
- README.md version history updated (below).
- Evidence: 9 screenshots in `outputs/v22-evidence/` (drawer, calendar add flow, FAQ, steroid
  suggestion at both viewports, plus the double-tap fix repro) — within TEAM.md's ~10-image cap.
- Push + live cache-busted verification: next step, immediately following this gate.

## PM sign-off

Matches every piece Aaron asked for: hamburger drawer with Profile/Settings/Calendar, FAQ under
Settings, tour replay confirmed under Settings, Calendar wired to real notifications, plus the
steroid suggestion carried over from the research report. Every stage that ran produced its artifact
(this doc + evidence folder). Every finding — 1 blocker, 5 should-fix, 1 nice-to-have across both
reviewers — was fixed and the fix itself re-verified against its specific repro, not just claimed.
No scope drift. Release mechanics complete except the push, which follows immediately.
