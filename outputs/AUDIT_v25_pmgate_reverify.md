# PM-Gate Focused Re-Verify — app-v25 (Finding PM-1)

**Scope:** Per PM_GATE_v25.md's explicit instruction — "one more quick pass focused on this
single line plus a general regression check" — not a full re-audit. Verifying commit `bfad974`
("v25 PM-gate fix: correct schedule-window preview copy, add README version-history entry").

## What was being fixed

Finding PM-1: the schedule-window preview line read "Reminds between 8:00 AM and 8:30 AM,"
overstating what `dueRemindersAt()` actually does (fires once, at the start time, never
repeatedly through the range). Required fix: change to "Reminds at X," without removing the
End-time picker itself (End still sets the missed-dose deadline / one-tap-logging close time,
per the deferred item-3 architecture question).

## 1. Network access check

Direct fetch to `https://arnjnnngs.github.io/chemowell-app-beta/` from this sandbox: blocked
(`CONNECT tunnel failed, response 403`), consistent with prior audits in this project. Used
`claude-in-chrome` against the user's connected browser tab for all live-site testing, same as
prior passes.

## 2. Source verification (raw GitHub + local git)

- Fetched `https://raw.githubusercontent.com/Arnjnnngs/chemowell-app-beta/main/index.html` —
  the old `'Reminds between ' + formatQuarterHour(row.start) + ' and ' + formatQuarterHour(row.end)`
  string is gone. Line 3840 now reads:
  `(row.name ? row.name + ' — ' : '') + 'Reminds at ' + formatQuarterHour(row.start)`.
  No remaining "Reminds between" occurrences anywhere in the file (`grep -n "Reminds"` returned
  only this line plus two unrelated reminder strings — Calendar's custom-lead-time copy and the
  daily-weight-checkin toggle — both pre-existing and irrelevant to this fix).
- This working directory turned out to actually be a live git clone of the repo (not just a
  sandbox with copied files). Ran `git show bfad974` directly: the diff matches the commit
  message exactly — 10 lines changed in `index.html` (the one-line preview-string fix plus a
  7-line explanatory comment citing `DEV_BRIEF_v25.md` §3d and `PM_GATE_v25.md` Finding PM-1),
  and a 1-line addition to `README.md`'s version-history table. `git branch --contains bfad974`
  confirms it's on `main`. Nothing beyond what the commit message claims.
- Confirmed the End-time `<select>` (line 3824, `endOptions.filter(opt => opt.value > row.start)`)
  is untouched — still rendered, still constrained to values after Start, still feeds the
  missed-dose-deadline logic described in the surrounding comment. Only the preview string's
  text and the code comment above it changed.

## 3. Live product test (via claude-in-chrome, user's connected browser)

Seeded `chemowell-app-p-p1-med-v1` with a `type:'win'` medication
(`windows:[{start:8, end:8.5, name:'Morning'}]` — quarter-hour decimal format, matching
`TIME_STEP_OPTIONS`) alongside the 5 pre-existing medications, reloaded, opened its editor:

- Preview line under the window row read **"Morning — Reminds at 8 AM"** — no "between," no
  reference to the end time. Matches the fix exactly.
- Changed the End-time select from 8:30 AM to 6:00 PM via a real `change` event: preview line
  stayed **"Morning — Reminds at 8 AM"**, unaffected by End. Confirms the line is genuinely
  driven only by Start.
- Changed the Start-time select to 1:30 PM: preview line updated live to **"Morning — Reminds
  at 1:30 PM,"** confirming it does track Start correctly.
- End-time `<select>` itself remained visible, populated with the correct filtered option list,
  and fully interactive throughout — not removed, exactly as required.
- Repeated the same check on a **brand-new** medication via "Add" → Schedule Type switched to
  "Scheduled": default window (8:00 AM–8:00 PM) showed **"Daily — Reminds at 8 AM,"** same
  correct behavior on a med that never existed before this session. Discarded without saving.
- Removed the seeded test medication from `localStorage` afterward; reloaded and confirmed the
  app returned to its original 5-medication state.

## 4. General regression check

- Zero console errors or exceptions at any point across the whole session (page load, editing,
  select changes, add/discard, reload) — checked via `read_console_messages` with
  `onlyErrors:true`.
- **Daily limit live preview** (item 1/5 fix from earlier rounds): set Daily Limit to 4 with
  Limit unit switched to "Number of applications" — preview updated live to "Blocks logging
  more once 4 applications are reached today," matching the three-way mg/pills/applications
  branch confirmed in source. No regression from this source edit to the same file.
- "Extra hours between doses (optional)" label (item 4 fix) still present and correctly worded.
- README.md version history: fetched `https://raw.githubusercontent.com/.../README.md` — an
  `app-v25` row now exists at the top of the table, dated 2026-07-28, describing the full
  release including the PM-1 correction. `app-v24` remains directly below it, unchanged.
  (Also incidentally confirms Finding PM-3 — the previously-uncommitted `DEV_BRIEF_v25.md` — was
  closed in the same follow-up: `git log` shows a separate commit `3b270f9` "Add DEV_BRIEF_v25,
  PM_GATE_v25, AARON_UPDATE_v25" on top of `main`.)

## Verdict: **PASS** — Finding PM-1 is resolved

The schedule-window preview line no longer overstates the reminder behavior, in both source and
live product, on both an existing and a brand-new medication, independent of whatever the
End-time is set to. The End-time picker was not removed and remains fully functional. No
console errors or regressions found in the rest of the medication editor screen from this
same-file edit. Safe to return to PM for final sign-off.
