# LEAD DESIGNER Review — v36 "Notes" (day-by-day journal)

**Reviewer:** Lead Designer stage, Quality Chain
**Date:** 2026-08-06
**Method:** Read Designer's report and screenshots in full, read the relevant source
(`openNoteModal`, `confirmNoteModal`, `renderNoteModal`, `renderNotesView`, `saveNote` —
index.html:266-289, 4721-4826), then independently re-ran the live app via
`python3 -m http.server 8791` + Playwright/Chromium (`/opt/pw-browsers/chromium-1194`) at
390×844 (mobile) and 1280×900 (desktop). Verification screenshots saved to
`/home/claude/chemowell-app-beta/outputs/lead-designer-v36-verification/`.

## Verdict: **NOT READY**

The Designer's visual/consistency findings are accurate and I confirmed the numeric claims
I spot-checked. But the Designer's one "informational, non-blocking" note — about a caption
string being unreachable dead code — is **backwards**. I reproduced the caption rendering in
a real, common user flow, and behind it is a genuine data-loss bug: tapping the primary
**"+ Add"** button a second time on a day that already has a note opens a blank "Add note"
form (not an edit form), and saving silently **overwrites and destroys** the original note's
text with no warning that actually communicates this. This is exactly the kind of medical-
journal data-integrity issue that should block sign-off, not ship with a note.

---

## What I confirmed matches the Designer's report

- **Drawer nav (4 items now):** Re-opened the hamburger drawer myself — Account / Calendar /
  Notes / Settings all render with identical icon + bold-label + rose-helper-line treatment.
  No layout regression from adding the 4th item.
- **Touch targets:** Live `getBoundingClientRect()` on the row's Edit and Delete buttons
  measured exactly `44×44px`, radius `10px` — matches the Designer's claim precisely.
- **Card styling:** Computed `border-radius: 18px`, `box-shadow: rgba(180,130,150,0.1) 0 4px
  24px 0, rgba(180,130,150,0.06) 0 1px 2px 0`, `border: 1px solid rgb(235,227,228)` (#EBE3E4)
  — byte-for-byte identical to the Designer's reported values, and identical to Calendar's card.
- **Subtitle contrast:** Computed color `rgb(122,110,118)` (#7A6E76). I independently calculated
  the WCAG contrast ratio against white background: **4.86:1** — matches the Designer's number
  exactly and passes AA.
- **Long-text wrapping:** Confirmed clean wrap for the Designer's 130-word multi-paragraph case.
- **Genuinely-empty-word wrap edge case (not tested by Designer):** I additionally tested a
  120-character string with **zero spaces**. It wraps cleanly via `word-break: break-word`
  with no horizontal overflow (`scrollWidth === clientWidth` at 390px). This closes the gap
  the Designer's word-based stress test could have missed.
- **Calendar default-collapsed / discard-cleanly (not explicitly tested by Designer):** Verified
  the date-picker calendar is collapsed by default on a fresh "Add note" open. Verified picking
  a different date in the calendar and then hitting **Cancel** (instead of Save) leaves the
  underlying notes store completely untouched — no stray/partial note created. Clean discard.
- **Backdating to a date with an existing note, via the calendar picker specifically:** Confirmed
  the Designer's description of *that one path* — picking a different date that already has a
  note does reassign the modal to edit mode and preload the existing text. That part of their
  testing was accurate as far as it went.

## Where I corrected the Designer

### The "dead caption" is not dead — it's the visible tip of a real overwrite bug (BLOCKING)

The Designer tested the merge/backdate behavior by opening a **fresh "Add note"** and then
**using the calendar picker** to navigate to an already-used date. In that specific path, the
`onPick` handler (index.html:4758-4768) does reassign `editId` to the existing note's id before
the caption's own reachability check runs (index.html:4771), so the caption is indeed suppressed
in *that* flow. That much of their code reasoning was correct.

But they never tested the simpler, more common flow: **tapping "+ Add" itself when today (the
modal's default date) already has a note, without touching the calendar at all.**
`openNoteModal(null)` (index.html:4721, 4731) *always* opens with `editId: null, dateStr:
todayStr, text: ''` — it does not check whether today already has a note. I reproduced this
live:

1. Added a note for today ("felt nauseous after lunch, took zofran"). Saved successfully.
2. Tapped **"+ Add"** again (the top-right button, the primary/only entry point most users will
   reach for to log a second thought later in the day).
3. The modal opened titled **"Add note"** (not "Edit note"), date defaulted to today, and the
   textarea was **empty** — the existing note's text was not shown or preloaded.
4. The caption **did render**: *"This date already has a note — saving will add to it."*
   (see `outputs/lead-designer-v36-verification/12_add_modal_when_today_has_note.png` and the
   identical desktop-width repro in `41_desktop_add_when_today_has_note.png`).
5. I typed a new, unrelated note and hit **Add**.
6. Result: the original note's text was **completely gone**. `localStorage` after the save
   contained a single note object, same `id`, with only the new text —
   `saveNote()` (index.html:272-289) keys purely off `dateStr` and does
   `existing.text = trimmed`, i.e. a full in-place overwrite, not an append.
   (See `13_after_second_save.png` and the raw localStorage dump captured during testing.)

So the caption is reachable, renders exactly when it matters, and its wording actively
**misleads the user in the wrong direction**: "saving will add to it" reads as reassurance that
both notes will coexist, when the actual, confirmed behavior is that the earlier text is
silently and irreversibly destroyed with no undo, no diff, no confirmation dialog — just one
small italic line in muted rose that a caregiver typing a note about "felt tired, took a nap"
is unlikely to stop and parse as a data-loss warning.

This is worse than the Designer's framing of "harmless because it never renders, though the
wording is slightly inaccurate if revived." It is not inaccurate-if-revived, it is inaccurate
and live in the app today, in exactly the entry point (the primary "+ Add" button) most users
will actually use for their second entry of the day. A closer read of the code itself hints
this was meant to be handled: the comment on `openNoteModal` (index.html:4723-4725) explicitly
describes "a third internal path... used by the 'already logged today' shortcut on the list
view," but I confirmed via `grep` that there is only ever one call site with `dateOrId === null`
(the "+ Add" button, index.html:4814), and it never passes today's existing date as that
shortcut would require. The shortcut described in the comment does not exist in the shipped
code — this looks like an incomplete implementation, not a deliberate design choice.

**Why this blocks sign-off:** ChemoWell is a medical symptom/medication journal for chemo
patients and caregivers. Silent, unrecoverable loss of a day's journal entry — with the only
warning being a caption whose wording implies the opposite of what happens — is a real and
plausible failure mode for exactly the user this app is built for (someone logging a second
symptom note later in the day, without remembering or noticing there's already a "Today" entry
in the list above the fold).

**Recommended fix (for the dev stage, not mine to implement):** make `openNoteModal(null)`
check for an existing note on `todayStr` the same way the calendar's `onPick` handler already
does, and open directly in Edit mode with the existing text preloaded when one exists — i.e.
actually wire up the "already logged today" shortcut the code comment describes but the button
never calls. At minimum, fix the caption's wording to say "will replace it" / "will overwrite
the existing note," not "will add to it," so the warning is honest even before the deeper fix
lands.

### Minor additional finding not in the Designer's report: stale APP_VERSION string

`APP_VERSION` (index.html:4828) is still `'app-v35'` in this commit (`git log` confirms this
commit is titled "app-v36 WIP: Notes feature," following an "app-v35" commit). This string is
shown in the drawer footer, the Settings screen, and the PDF/report export header — I confirmed
"ChemoWell app-v35" is what actually renders in the drawer on both mobile and desktop in this
build. Not a Notes-specific defect and not a design/visual issue, so not blocking on its own,
but it's a real, easily-fixed inaccuracy in user-facing text that should be bumped alongside
this release. Flagging for the dev stage.

## Everything else — unchanged from the Designer's findings

I have no corrections to the Designer's other findings: the sibling Calendar/Appointments style
parity, the empty-state copy, the modal spacing/hierarchy, the desktop max-width behavior, and
the pre-existing toast-overlap note are all accurate as reported and I did not find additional
issues in those areas during my own pass.

## What remains open

- The overwrite bug above needs a code fix and a re-verification pass before this feature can
  ship. This is the only blocking item.
- The stale `APP_VERSION` string should be bumped to `app-v36` as part of the same fix pass.
- Once fixed, I'd want to re-verify specifically: (a) tapping "+ Add" when today already has a
  note goes straight to Edit mode with the existing text visible, and (b) the caption (if kept
  at all) accurately describes replace, not append, in any state where it can still appear.
