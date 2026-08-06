# DESIGNER Review — v36 "Notes" (day-by-day journal)

**Reviewer:** Designer stage, Quality Chain
**Date:** 2026-08-06
**Method:** Live inspection via Playwright/Chromium against `python3 -m http.server` at 390x844 (mobile) and 1280x900 (desktop). Real onboarding flow completed, real notes added (short, backdated, and a long multi-line entry), all interactive states exercised by clicking through the actual UI — not a code read-through. Screenshots saved to `/home/claude/chemowell-app-beta/outputs/v36-designer-screenshots/`.

## What I checked

1. **Drawer nav** — opened hamburger menu, confirmed "Notes" entry (`drawer_open.png`): file icon, "Notes" label, "Daily journal" helper text, positioned between Calendar and Settings with identical row treatment (icon + bold label + rose-muted helper line) as Account/Calendar/Settings.
2. **Empty state** — mobile (`mobile390_01_empty.png`) and desktop (`desktop1280_01_empty.png`).
3. **List with 3 notes**: a short today entry, a backdated entry (3 days prior via calendar picker), and a long multi-paragraph entry to stress-test wrapping (`*_05_list_with_notes.png`, `mobile390_10..12_*_viewport.png`, `desktop1280_05_list_with_notes.png`).
4. **Add-note modal**, collapsed and with the date-picker calendar expanded (`*_02_add_modal_collapsed.png`, `*_03_add_modal_calendar.png`, `*_04_add_modal_after_pick.png`).
5. **Edit-note modal**, confirming prior text loads (`*_06_edit_modal.png`).
6. **Delete-confirm inline state** (tap trash → "Delete?") (`*_07_delete_confirm.png`, `*_14_delete_confirm_viewport.png`).
7. **Date-already-has-a-note merge behavior**: opened a fresh "Add note," picked a date that already had an entry, confirmed the modal auto-retitles to "Edit note" and preloads the existing text rather than creating a duplicate (`duptest_02_after_pick_existing_date.png`).
8. **Direct pixel/style comparison against the sibling Calendar/Appointments feature**, including adding a real appointment and diffing computed styles (`sibling_appt_list.png`).
9. Computed-style probes (bounding boxes, colors, radii, shadows) pulled straight from the live DOM to get exact values rather than eyeballing.

## Findings

### Consistency with sibling Calendar/Appointments — excellent, effectively pixel-identical
Diffing the source for `renderNotesView`'s `noteRow` against `renderCalendarView`'s `apptRow` (index.html:4783-4826 vs 4657-4713) and confirming live in the browser:
- Date badge: same 52px-wide column, `AUG` in 11px/800-weight uppercase `#A24C71`, day number 20px/800-weight `#2A2127`.
- Row padding `13px 15px`, `borderTop: 1px solid rgba(212,104,138,0.08)` — identical.
- Edit/delete icon buttons: both exactly **44×44px** (verified via `boundingBox()`), 10px radius, `rgba(162,76,113,0.08)` / `rgba(192,69,59,0.08)` backgrounds — identical to the Calendar row, and meets the app's 44px touch-target minimum exactly (not just "close enough").
- Card wrapper: `18px` border-radius, `1px solid #EBE3E4` border, `0 4px 24px rgba(180,130,150,0.10), 0 1px 2px rgba(180,130,150,0.06)` shadow, white background — identical token-for-token to Calendar's card.
- Header block (icon+label, `h1`, description line, "+ Add" button) is the same structure/spacing as Calendar's header.
- Delete confirm ("Delete?" red pill replacing the trash icon) behaves identically in both features.

This is the strongest finding of the review: Notes does not merely resemble Calendar/Appointments, it reuses the same exact style values, so it inherits that feature's already-approved quality bar rather than drifting from it.

### Body text color and empty-state copy match the design system spec exactly
- Note body text: `rgb(42,33,39)` = `#2A2127` (spec ink), 14px/400, line-height 20.3px (1.45).
- Empty state (`No notes yet.` / "Jot down anything worth remembering — a side effect, a question for the doctor, how the day went.") is warm and specific rather than a bare "No notes" — genuinely inviting, gives concrete examples of what to write, matches Calendar's empty-state pattern ("No upcoming appointments yet." + a similarly example-driven subtext).

### Long-text wrapping — clean, no layout breakage
The 130-word stress-test note wraps correctly at both viewports with `whiteSpace: 'pre-wrap'` + `wordBreak: 'break-word'`; the card grows to fit, no horizontal overflow, no clipped text, no squeezed edit/delete icons. On mobile the row's icon buttons sit at the top of the (now-tall) card rather than vertically centered against the whole block — this matches the same pattern already used and accepted in Calendar's list, so it's consistent, not a new problem, though it does mean a long note requires scanning past the full block of text to reach Edit/Delete rather than having them float near the last line. Not a blocker, just worth flagging as inherited behavior.

### Merge-not-duplicate backdating flow is well communicated visually
Picking an already-used date in the date-picker auto-switches the modal's own title from "Add note" to "Edit note" and preloads the existing text (confirmed via `textarea.inputValue()`). This is a stronger, clearer signal than a caption would be — the user can't accidentally think they're creating a second entry for that day. One minor/non-visual nit: there's a caption string in the code ("This date already has a note — saving will add to it.") gated on `other.id !== editId`, but because `editId` gets reassigned to the existing note's id in the same date-pick handler, that condition appears to never actually be true in practice — I could not get this caption to render in any state I tried. It's effectively dead code, not a visible defect (nothing broken on screen), just worth a note to the dev stage since the wording ("will add to it") is also slightly inaccurate — saving replaces the text field's contents, it doesn't append two texts together.

### Modal — spacing and hierarchy consistent with the rest of the app
Add/Edit modal: "Date" label → date pill (44px, matches touch target) → expandable month-grid calendar → "Note" label → textarea → Cancel/Save 48px-tall buttons, 10px gap. Corner radius 22px on the modal (within the app's 11-22px system, at the top end which matches other full-sheet modals). Textarea border `rgba(212,104,138,0.2)` matches the date-pill border — consistent field styling. On mobile the calendar-expanded state pushes the textarea/buttons down near the screen edge but everything stays visible without clipping in an 844px-tall viewport; nothing is cut off.

### Desktop (1280px) — modal and card both behave correctly, not naively stretched
The Add/Edit modal caps at `max-width: 380px` and centers, rather than stretching edge-to-edge on a wide viewport — good judgment call, it reads like a real dialog rather than a scaled-up mobile sheet. The Notes list card likewise does not stretch to the full 1280px width; it sits in the same fixed content column as every other view (matches Calendar, Home, etc. — this is an app-wide layout convention, not something Notes introduced, so not a Notes-specific issue).

### Color contrast — passes
- Row subtitle color `rgb(122,110,118)` (`#7A6E76`, the app's documented "tertiary" text token per the in-code comment at index.html:1772) against white card background computes to a **4.86:1** contrast ratio — passes WCAG AA for normal text (≥4.5:1).
- Primary note body text `#2A2127` on white is very high contrast, no concerns.
- "Delete?" button: white text on `#C0453B` — high contrast, unambiguous destructive-action color, matches Calendar's identical delete-confirm styling.

### App-wide toast behavior overlaps list content briefly — pre-existing, not new
The "Note saved" toast (4.5s duration per `setToast()`, index.html:1084-1088) is positioned `bottom: calc(96px + safe-area-inset-bottom)`, fixed, `pointer-events: none`. When the notes list is short, this toast visually sits on top of the last note's text for part of its 4.5s life (confirmed in `mobile390_11/12_list_scrolled_viewport.png` and `mobile390_14_delete_confirm_viewport.png` — the word "dinner" in the last note is briefly obscured). This is documented, intentional, pre-existing app-wide behavior (see the code comment referencing a v20 QA finding, and `pointerEvents: 'none'` specifically added so it never blocks taps underneath). It is not new to Notes and was already accepted for other features, so I'm not treating it as a Notes-specific blocker — but it is a real, visible overlap a user will see, and it's slightly more noticeable here because Notes rows can be very short (a one-line note leaves little vertical room before the toast's fixed position), more so than Calendar rows which usually include a time subtitle pushing more visual height.

## Screenshots reviewed
All in `/home/claude/chemowell-app-beta/outputs/v36-designer-screenshots/`:
- `mobile390_01_empty.png`, `desktop1280_01_empty.png` — empty state
- `mobile390_02..04_*`, `desktop1280_02..04_*` — Add modal collapsed / calendar expanded / after date pick
- `mobile390_05_list_with_notes.png`, `desktop1280_05_list_with_notes.png`, `mobile390_10..12_*_viewport.png` — list with 3 notes incl. long entry
- `mobile390_06_edit_modal.png`, `desktop1280_06_edit_modal.png` — Edit modal with pre-filled text
- `mobile390_07/14_delete_confirm*.png`, `desktop1280_07_delete_confirm.png` — inline "Delete?" state
- `sibling_appt_list.png`, `sibling_appt_modal.png` — Calendar/Appointments comparison reference
- `duptest_01/02_*.png` — backdating onto an already-used date, showing auto-merge into Edit mode
- `drawer_open.png` — drawer nav entry

## Verdict: READY

No blocking visual or UX issues. The feature reuses the sibling Calendar/Appointments list-row and modal patterns down to identical pixel values (44px touch targets, 18px card radius, matching color tokens), long text wraps cleanly with no clipping/overflow at either viewport, the empty state is inviting and specific, contrast passes AA, and the backdating/merge flow — the feature's core requirement per Aaron ("it should all roll together in one date it was intended for") — is not only implemented correctly but visually self-explains via the Add→Edit modal title switch.

Non-blocking notes for the dev stage (informational, not required to ship):
- The "This date already has a note — saving will add to it." caption in `renderNoteModal` appears to be unreachable given the current onPick logic (editId is reassigned before the caption's condition is evaluated) — harmless since it never renders, but the string is slightly inaccurate to what actually happens (replace-with-preloaded-text, not append) if it's ever revived.
- The app-wide 4.5s toast briefly overlaps short list content on the Notes screen (and equally on Calendar); pre-existing, already reviewed/accepted behavior, flagged only for awareness since Notes rows are more often short (one-liners) than Calendar rows.
