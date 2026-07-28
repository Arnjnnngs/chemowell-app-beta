# DESIGNER_v24 — Designer Review (Full Chain, Stage 5)

**Designer:** Claude (Designer role, per TEAM.md)
**Date:** 2026-07-28
**Build under test:** `/home/claude/chemowell-app-beta/index.html`, served at `http://localhost:8910/index.html`
**Runs after:** Auditor (AUDIT_v24.md — 45/45 test cases passed, 0 blockers, 2 should-fix + 1 nice-to-have, all pre-existing/release-mechanics, no functional defects in this release's shipped code).
**Method:** Real Playwright/Chromium (`/opt/pw-browsers/chromium`) against the running app, `localStorage`-seeded per the established schema. Primary viewport 390×844, secondary pass at 360×800 (smallest supported width). `window.Notification.permission` faked via `page.addInitScript` for the three permission states, matching `verify_notif_fix_v24.mjs`'s TC4 pattern. Script used: `/home/claude/chemowell-app-beta/designer_v24.mjs` (left in repo). Where visual judgment needed a precise number, I pulled real `getBoundingClientRect()` measurements rather than eyeballing pixels.

**Result: 0 blockers, 3 should-fix, 2 nice-to-have.** One copy item (FAQ reminder-limitation wording) is flagged per TEAM.md's copy-review section as worth extra care, with a suggested rewrite provided rather than left unresolved.

---

## Findings

### Finding 1 — "Turn on notifications" button is 40px tall, below the app's own 44px touch-target convention (should-fix)

- **Location:** `index.html:4758`, `notifPermissionStatusBlock()`, the `default`/never-answered permission state, Settings → Notifications.
- **What's wrong:** The button's inline style sets `minHeight: '40px'`. Measured via `getBoundingClientRect()` in the real running app: **actual rendered height is 40px** (`{x:31, y:1451.6, width:183.2, height:40}`), 4px under the 44px minimum this app consistently uses everywhere else (e.g. the sibling "Replay the walkthrough" button two sections down, `index.html:4174`, uses `minHeight: '44px'`).
- **Why it matters:** This is the one actionable control in the entire notification-status block — the whole point of adding it was to give Aaron (or any caregiver) a way to fix a broken permission state. Landing 4px short of the app's stated minimum on the button that most needs to be reliably tappable is exactly the kind of thing that should be caught before ship.
- **Suggested fix:** Change `minHeight: '40px'` → `minHeight: '44px'` at `index.html:4758` (also matches `padding: '0 15px'`, `fontSize: '13px'`, `fontWeight: '800'` already used consistently on the "Replay the walkthrough" button — no other value needs to change).
- **Screenshot:** `/tmp/designer_settings_notif_default_390x844.png`

### Finding 2 — Bell icon floats mid-gap when a Calendar reminder label wraps to two lines (should-fix)

- **Location:** `index.html:4050`, `renderCalendarView()`'s `apptRow`, the reminder `<span>`: `h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '3px' } }, appIcon('bell', 12, ...), apptReminderLabel(appt))`.
- **What's wrong:** With `alignItems: 'center'`, the icon vertically centers against the *whole* wrapped text block, not the first line. Measured directly on a custom "999 minutes before" label (a realistic case now that custom lead times are user-typed numbers): the span is 36.4px tall (two lines), the bell SVG sits at `y: 378–390`, while line 1 ("999 minutes") occupies `y: 366.8–381.8` and line 2 ("before") occupies `y: 385–400` — the icon lands squarely in the gap between the two lines, not clearly attached to either. The text itself wraps at a clean word boundary with correct horizontal alignment (both lines start at `x: 111`) — this is purely an icon vertical-alignment issue, not a text-wrap bug.
- **Why it matters:** This is a real behavior change this release enables — the old 3 fixed reminder options (1h/morning/1day) never produced labels long enough to wrap at 390px or 360px; the new custom lead time (any integer × minutes/hours/days) can. It's the exact case the brief asked to check ("long custom labels don't break the row layout or wrap awkwardly next to the bell icon") and it does look slightly awkward, if not broken.
- **Suggested fix:** Change `alignItems: 'center'` → `alignItems: 'flex-start'` on that span (`index.html:4050`); optionally add `marginTop: '2px'` to the icon itself (or wrap it in `h('span', {style:{marginTop:'2px', flexShrink:'0'}}, appIcon(...))`) so it optically lines up with the cap-height of line 1 instead of sitting flush at the very top edge.
- **Screenshot:** `/tmp/designer_calendar_list_390x844.png` (full list), `/tmp/designer_calendar_crop_zoom2.png` (2× crop of the affected row)

### Finding 3 — FAQ "calendar" answer buries the foreground-only caveat inside a run-on sentence (should-fix, copy)

- **Location:** `index.html:1469`, `FAQ_ITEMS`, id `'calendar'`.
- **Current text:** *"Open the menu and tap Calendar, then Add. Give it a title, date, and time, and choose Remind me — right at the scheduled time, 1 hour before, the morning of, 1 day before, or a custom lead time you set yourself. You'll need to allow notifications when asked for the reminder to actually fire, and the app needs to be open in your browser at that moment — it can't send a reminder while your phone is locked or the tab is closed."*
- **What's wrong:** The one caveat this release specifically needed surfaced clearly — reminders don't work in the background — is the tail clause of a compound sentence that also covers the unrelated permission-prompt requirement, joined by "and." A caregiver has to parse the whole second-and-third sentence to reach it. Compare this to the Settings → Notifications copy for the same fact (`index.html:4168`), which the Lead Developer already wrote as two short, separate sentences and reads noticeably better: *"Calendar and dose reminders fire while this app is open in your browser. They can't reach you while your phone is locked or the tab is closed — full background delivery needs the phone-app version (in progress)."* The FAQ version doesn't match that clarity even though it's explaining the identical fact.
- **Suggested exact replacement text:** *"Open the menu and tap Calendar, then Add. Give it a title, date, and time, then choose when to be reminded — right at the time, 1 hour before, the morning of, 1 day before, or a custom lead time you set yourself. One thing to know: reminders only fire while ChemoWell is open in your browser, so they won't reach you if your phone is locked or the tab is closed. You'll also need to allow notifications when your browser asks."*
- **Flagging per TEAM.md's copy-review section:** this caveat is worth extra care beyond a button-label-level fix. A caregiver who assumes (reasonably, based on how native phone reminders normally behave) that a Calendar reminder will reach them with the phone locked could rely on it and miss a real infusion or appointment. I've provided exact replacement text above as a starting point, but given the real-world consequence of getting this nuance wrong, this is a good candidate for the Lead Developer to double-check wording with Aaron rather than treat my rewrite as final — same caution the Dev Brief itself already flagged for the original draft of this copy (Open Question 3).
- **Screenshot:** `/tmp/designer_faq_calendar_390x844.png`

---

### Finding 4 — "Turn on notifications" CTA is styled identically to a low-stakes secondary action, undercutting it as the fix for a real gap (nice-to-have)

- **Location:** `index.html:4758` (button) vs. `index.html:4174` ("Replay the walkthrough" button, same section group below).
- **What's wrong:** Both buttons use the exact same low-emphasis pill treatment: `background: rgba(170,83,117,0.10)`, `border: 1px solid rgba(170,83,117,0.25)`, `color: #8E3D61`. "Replay the walkthrough" is a completely optional, low-stakes action; "Turn on notifications" is the fix for an actual functional gap (no reminders will fire at all until this is tapped) sitting directly under an amber "not turned on yet" warning line. Visually, nothing distinguishes the two in importance.
- **Suggested fix:** Give the notifications CTA the same solid-fill treatment already used for primary actions elsewhere in the app (e.g. the Calendar modal's "Add"/"Save" button, `index.html:4028`: `background: '#A24C71'`, `color: '#fff'`, `boxShadow: '0 2px 8px rgba(142,61,97,0.22)'`) so it visually reads as "the thing to tap to fix this," distinct from secondary/optional buttons on the same screen.
- **Screenshot:** `/tmp/designer_settings_notif_default_390x844.png`

### Finding 5 — "Notifications are on" (granted) status doesn't reuse the app's existing success-pill pattern (nice-to-have)

- **Location:** `index.html:4748`, `notifPermissionStatusBlock()`, `granted` branch.
- **What's wrong:** Renders as plain colored text (`color: '#2E7D4F'`, no background) with no visual container, while the app already has an established "success" pill component for exactly this kind of status — the "Active" profile badge two sections above (`index.html:4115`: `background: 'rgba(46,125,79,0.10)'`, same `#2E7D4F` text, `padding: '3px 10px'`, `borderRadius: '99px'`). Using the same pill here would read as more deliberately "done/confirmed" and be consistent with how the app already signals a settled positive state elsewhere on the very same screen.
- **Suggested fix:** Wrap the "✓ Notifications are on" text in the same pill treatment as the "Active" badge (`background: 'rgba(46,125,79,0.10)'`, `padding: '3px 10px'`, `borderRadius: '99px'`, same `#2E7D4F` text color/weight).
- **Screenshot:** `/tmp/designer_settings_notif_granted_390x844.png`

---

## Confirmed passing (checked per the brief, no issue found)

- **Custom reminder inline controls** (`index.html:4009-4023`): at 360×800, the number input and unit `<select>` each measure exactly **44px tall** (`getBoundingClientRect`), 135px wide, 10px gap — not cramped, meets the app's touch-target convention. The live preview line ("Reminds 45 minutes before" / "Reminds 1 hour before" with correct singular/plural) reads naturally and matches the established "Reminds between 8:00 AM and 8:30 AM" pattern from the schedule-window picker. Modal `scrollHeight === clientHeight` at 360×800 with the custom row expanded — it fits without extra scroll.
- **Medication editor "Excluded near treatment day" helper text** (`TREATMENT_MODE_OPTIONS`, `index.html:3601-3609`): the new wording ("Grayed out and can't be logged for a window of days around your treatment date — available the rest of the time.") reads naturally, mirrors the sibling "Only near treatment day" option's sentence structure (behavior → window → rest-of-time state), and now accurately matches what actually renders on Home during the excluded window (confirmed visually against `/tmp/tc6_excluded_near_treatment.png` from the Auditor's evidence — dashed border, muted/grayed card, correct label). Sanity check passes.
- **Settings → Notifications section copy** (`index.html:4168`): well-constructed — two short sentences, leads with the limitation, no run-on. This is the model the FAQ item (Finding 3) should be brought in line with.
- **Color contrast:** all four notification-status text colors checked against their white/near-white backgrounds pass WCAG AA comfortably (green `#2E7D4F` 5.05:1, red `#A5443C` 6.01:1, amber `#9A6419` 4.99:1, gray caption `#6E5A64` 6.35:1, custom-reminder preview `#8A6479` 5.02:1 — all ≥ 4.5:1 for normal-size text).
- **Denied state** (`index.html:4750-4754`): red header + generic (device-agnostic) instruction text, correctly has no button since JS can't re-prompt after an explicit deny — matches the Dev Brief's reasoning exactly.

---

## Screenshots (curated, saved to `/tmp/`)

- `/tmp/designer_appt_modal_custom_preview_390x844.png`, `/tmp/designer_appt_modal_custom_preview_360x800.png` — custom reminder controls + live preview, both viewports
- `/tmp/designer_calendar_list_390x844.png`, `/tmp/designer_calendar_crop_zoom2.png` — Finding 2 (icon vertical-align on wrap)
- `/tmp/designer_settings_notif_granted_390x844.png` — Finding 5
- `/tmp/designer_settings_notif_denied_390x844.png` — confirmed-passing denied state
- `/tmp/designer_settings_notif_default_390x844.png` — Findings 1 and 4
- `/tmp/designer_faq_calendar_390x844.png` — Finding 3
- `/tmp/designer_med_treatment_mode_390x844.png` — confirmed-passing copy sanity check

## Scope note

Per TEAM.md, only screens this release actually touched were reviewed: the Calendar appointment editor and list, Settings → Notifications (all 3 permission states), the Notifications FAQ item, and the medication editor's treatment-mode helper text. No other screens changed this release, so no other screens were re-reviewed.
