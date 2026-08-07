# Designer review — v37: unified Daily check-in + CSV export fix

Reviewed live in Chromium (Playwright) against the running build at `http://127.0.0.1:8936/index.html`,
at 390×844 (mobile) and 1280×900 (desktop). Screenshots saved to
`/home/claude/chemowell-app-beta/v37-designer-screenshots/`. Seeded localStorage per the brief, with
one correction: `appetiteCheckin`/`bowelCheckin`/`dailyWeightCheckin` are read by `homePref()` from
`prefs.homeCards.*`, not top-level `prefs.*` (see `homePref()`/`setHomePref()`, index.html:1469-1480).
Seeding them at the top level (as literally given in the brief) silently no-ops — the check-in card
never appears and the toggle buttons in Settings still read "off." Nesting them under `homeCards` is
what `renderPillToggle`'s own `onClick` does, and is what actually reflects real user state. Flagging
this only so future scripted seeds don't waste a cycle chasing a "missing card" that's a seed-format
issue, not a product bug.

## What I checked
- Home screen: check-in card present (all 3 sub-toggles on) and absent (all off), both viewports.
- Check-in modal: all three conditional fields visible, blank/untouched state, Cancel/Save.
- Settings: the three renamed toggles, reminder-time row shown/hidden by gating, both viewports.
- Export section: CSV button, Printable report button, and the actual toast copy after a real
  (headless, non-Web-Share) CSV download.

## Findings

### 1. Select fields' "Not answered" is indistinguishable from a real answer (functional/legibility)
In `renderCheckinModal` (index.html:1550, 1559), the Appetite and Bowel Movement `<select>` elements
render their empty option ("Not answered") in the same `color: '#2A2127'` (near-black) as every real
answer, because it's a normal `<option>`, not a placeholder. Screenshot evidence
(`crop_modal_fields.png`, cropped from `desktop-02-checkin-modal-all-fields.png`): the Weight field's
"Not answered" is a true `<input placeholder>` in the app's standard placeholder gray (`#7A6E76`,
global `::placeholder` rule at index.html:37), and visibly reads as empty — but the two selects right
above it render "Not answered" full-strength dark, so at a glance all three fields look "answered."
This directly undercuts the modal's own promise ("Skip anything that doesn't apply") — a caregiver
skimming the modal before hitting Save can't tell which fields are actually blank.
**Fix:** style the select's text color conditionally on its own value — `color: (m.appetite ? '#2A2127' : '#7A6E76')` and the same for bowel — so an unanswered select visually matches the placeholder-gray weight input. No markup change needed, just make the two selects agree with the one input.

### 2. "Anything else?" label is a shouting, two-line run-on (typography)
`renderCheckinModal`'s local `fieldLabel` (index.html:1543) only does one style: `TYPE.label` —
12px, weight 700, uppercase, 0.06em letter-spacing — applied to the *entire* string including the
parenthetical, so "ANYTHING ELSE? (GOES TO TODAY'S NOTES, ALWAYS EDITABLE LATER)" renders as two
lines of all-caps, letter-spaced text (see `crop_anything_else.png`). That's a lot of shouting for what
is explanatory copy, not a section label, and it reads noticeably heavier than every other label in the
modal. The codebase already has the right primitive for this two-tier pattern —
`fieldLabel(text, helper)` at index.html:4261 — which renders the label in caps and the helper below it
in sentence case at 12px/weight 600/no letter-spacing. The modal's local `fieldLabel` shadows the name
but doesn't reuse the shared one.
**Fix:** drop the local single-arg `fieldLabel` and call the existing `fieldLabel('Anything else?', 'Goes to today's Notes, always editable later.')` instead — same visual language as the rest of the app, and it stops shouting the caption.

### 3. CSV export toast wraps to 4 lines on mobile (copy length vs. container)
The new toast copy — `rows.length + ' entries exported to CSV — check your Downloads folder'`
(index.html:5145) — is meaningfully longer than the old one-line message. The shared toast container
caps at `maxWidth: min(90vw, 340px)` (index.html:2409), unchanged from before. At 390px viewport this
produces a squat, 4-line pill (`crop_toast.png`) that sits noticeably taller and more intrusive than any
other toast in the app, and visually overlaps the Export section's own buttons/the About & Legal card
beneath it (harmless since `pointerEvents: 'none'`, but visually busy). **Fix, pick one:**
(a) widen the cap specifically isn't necessary — simplest is trimming the copy to
`rows.length + ' entries exported — check Downloads'` (still destination-aware, ~15 fewer characters,
fits in 2 lines at 340px), or (b) bump the toast's shared `maxWidth` to `min(92vw, 380px)` if other
toasts could use the room too. I'd do (a) — it's copy-only and doesn't touch the shared component.

### 4. Pre-existing, not v37: "1 entries exported" grammar
Confirmed via git log this string (`rows.length + ' entries exported...'`, no singular case) predates
v37 — v37 only appended "— check your Downloads folder" to it. Flagging because the longer sentence
makes the miscount more noticeable in the toast, but this is not a v37 regression and shouldn't block
this review. Cheap fix if anyone's in that line: `rows.length + (rows.length === 1 ? ' entry' : ' entries') + ' exported...'`.

### 5. Settings grid mixes "Home cards" and "check-in inclusion" toggles with no visual grouping (minor)
The Home screen section's `repeat(auto-fit,minmax(220px,1fr))` grid (index.html:4979) interleaves
`showTemperature`/`showWeight`/`showBloodPressure`/`showChemoSchedule` (whether a quick-log card shows
on Home) with `dailyWeightCheckin`/`bowelCheckin`/`appetiteCheckin` (whether that metric is *asked about
in the check-in*) in one undifferentiated list. On desktop's 2-column layout this puts "Weight card" and
"Weight in daily check-in" diagonally adjacent — same word, different meaning, no separator between the
two toggle families. The intro caption explains the distinction in prose, but a caregiver scanning
toggles (not reading paragraphs) has no visual cue they've crossed into a different category.
**Suggestion:** either reorder so all 4-5 "card" toggles come first and all 3 "check-in" toggles follow
as a visually distinct run (small `marginTop: 14px` gap + a `TYPE.label`-styled sub-heading like "DAILY
CHECK-IN INCLUDES" above just those three, matching the label style already used for "HOME SCREEN"
itself), or at minimum increase inter-item gap between the two families from the current uniform 8px.
This is a clarity nit, not a blocker — the reminder-time row copy right below already does a good job
of restating the check-in framing.

## What's working well (worth naming, since it's most of the surface)
- **Card removal/consolidation is a clear win.** One calm card (`NOTICE_TONES.info`, mauve accent, no
  red/amber escalation) replaces three separate banners — confirmed both the "on" and "all-off" Home
  states render cleanly with no orphaned gap either way (`mobile-01...png` / `mobile-05...png`).
- **Gating logic is airtight visually.** Reminder-time row appears/disappears with no layout jump in
  Settings on both viewports (`mobile-03` vs `mobile-06`, `desktop-03` toggled), confirmed by re-running
  with all three prefs off.
- **Touch targets:** every interactive control I measured in the new surfaces meets 44px+ height —
  toggles (`minHeight: 44px`), modal selects/input (`48px`), Cancel/Save (`48px`), time picker (`44px`).
- **Color contrast:** spot-checked all new text/background pairs against WCAG AA (4.5:1 body text,
  3:1 large text) — all pass, most comfortably (caption `#8A6479`/white = 5.02:1, reminder label
  `#5F4A56`/white = 8.08:1, white/`#A24C71` Start button = 5.51:1, placeholder `#7A6E76`/white = 4.86:1).
- **Modal on desktop stays narrow (max-width 380px) rather than stretching** — correct call for a short
  form; it doesn't look broken, just intentionally centered and compact.
- **CSV Web Share-first approach** is sound and correctly falls back to blob-download in this headless
  environment (confirmed a real file download fired); only the resulting toast's wrap (finding 3) needs
  a tweak.

## Verdict: FAIL-WITH-FINDINGS

Two of the five findings (#1 select-vs-placeholder mismatch, #2 shouty label) are genuine "looks
half-finished" issues in a brand-new, user-facing modal that's meant to feel calm and inviting — not
polish nits. Both have exact, cheap fixes (a conditional color on two selects; reuse an existing shared
helper) and don't require touching layout, gating, or logic. #3 is a one-line copy trim. #5 is a
nice-to-have. Recommend fixing #1–#3 before ship; #4 and #5 can ride to the next pass.
