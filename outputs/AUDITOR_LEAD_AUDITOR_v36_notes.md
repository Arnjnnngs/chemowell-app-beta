# AUDITOR + LEAD AUDITOR Report — v36 "Notes"

**Repo:** chemowell-app-beta
**Scope:** `/home/claude/chemowell-app-beta/index.html` (Notes storage layer, modal, list view, and all touched
call sites) + `/home/claude/chemowell-app-beta/sw.js` (cache bump)
**Prior stage:** Design/Lead Design review passed (2 rounds; caught and fixed a real data-loss bug in the
modal's date-repick flow — see the "Lead Designer catch" comments at index.html:4722 and 4783).
**Method:** Full line-by-line read of every v36 diff site + surrounding blast radius, plus live end-to-end
testing against the running app via Playwright/Chromium (`python3 -m http.server`, headless Chromium at
`/opt/pw-browsers/chromium-1194`). Every finding below that is marked "verified live" was actually reproduced
against the running app, not just reasoned from source.

This report is written as a combined Auditor pass followed by a self-skeptical Lead Auditor pass: each
finding below already survived an attempt to refute it (see "Lead Auditor check" under each item).

---

## Findings

### F1 — Note list and date pill never display the year (Low–Medium, non-blocking)

**Files:** `index.html:4799-4813` (`renderNotesView` → `noteRow`), `index.html:2683-2687` (`calPillLabel`,
used by the note modal's collapsed date button at `index.html:4757-4759`).

**Issue:** The Notes list row shows only `MON` + day-of-month (`dLabel.toLocaleDateString([], { month:
'short' })` / `dLabel.getDate()`) and a weekday line (`dLabel.toLocaleDateString([], { weekday: 'long' })`) —
no year anywhere. The modal's collapsed date pill (`calPillLabel`) is the same: `"Sat, Aug 15"`, no year. The
year is visible only while the calendar grid is expanded (the month header, e.g. "August 2020").

**Reproduction (verified live):**
1. Add a note for Aug 15, **2020** (open Add → date pill → Previous month ×72 → pick 15 → save).
2. Add a note for Aug 20, **2030** (Add → Next month ×48 from the default month → pick 20 → save).
3. Notes list shows two rows: `AUG 20 / Tuesday / Future note 2030` and `AUG 15 / Saturday / Old backdated
   note 2020` — visually indistinguishable in year from a hypothetical same-month-day note in the current
   year.
4. Re-opening the 2020 note for edit shows the date pill as `"Sat, Aug 15"` — no year until the calendar is
   expanded.

**Why it matters here specifically:** This is a day-by-day *journal* that Aaron's spec explicitly wants
"always editable... backdatable," and this audit's brief specifically called out testing a very old backdated
date (2020) — which is exactly what surfaced this. A caregiver skimming a year-plus of accumulated notes (a
completely realistic outcome for a chronic chemo/radiation journal) cannot tell month/day-duplicate entries
apart by year without opening each one and expanding its calendar.

**Lead Auditor check (trying to refute this):** Is this a v36 regression, or inherited? Checked the sibling
Appointments feature (`apptRow` at `index.html:4662-4668`, same `calPillLabel`) — it has the *exact same* gap.
So this is not new code introduced by v36; the Notes modal explicitly says it "mirrors the appointment
modal's date-picker wiring" (index.html:4718-4720), and it faithfully mirrored this gap too. That downgrades
this from "v36 regression" to "pre-existing app-wide gap Notes inherited," but it's still worth flagging
because Notes is the feature where a long accumulation of same-day-different-year entries is the *expected*
normal use case (multi-year chemo journal), more so than a near-term appointment calendar. **Verdict: real,
reproducible, non-blocking. Recommend a follow-up (not required for this ship) to add the year whenever an
entry's year differs from the current year, in both the list row and the collapsed pill.**

---

### F2 — `saveNote()`'s "empty text deletes the note" branch is unreachable dead code (Low, informational)

**Files:** `index.html:272-281` (`saveNote`), `index.html:4739-4749` (`confirmNoteModal`, the only caller).

**Issue:** `saveNote(dateStr, text)` contains a documented branch: if the trimmed text is empty and a note
already exists for that date, it deletes the note outright (comment: "matches how every other optional-text
field in this app treats an emptied value"). But `saveNote` has exactly one call site — `confirmNoteModal`
(line 4747) — and `confirmNoteModal` already returns early with a toast ("Write something before saving, or
Cancel.") before ever calling `saveNote` if the trimmed text is empty (line 4742). So the delete-on-empty
branch inside `saveNote` can never execute through the app's UI today.

**Lead Auditor check:** Is this dangerous, e.g. could a user accidentally nuke a note by clearing the
textarea and tapping Save? No — reproduced live: clearing the textarea to whitespace and tapping the primary
button just re-shows the "Write something..." toast and keeps the modal open with the (now-empty) text intact;
no delete happens, no note is lost. So there's no user-facing risk. This is purely a code-clarity nit: the
comment describes behavior as if it's live UI behavior, when it's actually a defensive/unreachable path under
the current call graph. **Verdict: not a bug, not blocking — worth a one-line comment fix next time this
function is touched, nothing more.**

---

### F3 — "Delete?" confirm state never auto-resets (Low, confirmed *consistent* with sibling, not a v36 regression)

**Files:** `index.html:4816-4818` (note row delete button), `index.html:292-297` (`removeNote`), compare
`index.html:4684-4686` (appt row) / `index.html:250-256` (`removeAppointment`).

**Issue:** Tapping the trash icon on a note sets `confirmDeleteNote` to that note's id, swapping the icon for
a red "Delete?" button. Nothing resets `confirmDeleteNote` except actually completing the delete
(`removeNote`) — there is no timeout, no "tap elsewhere to cancel," and (critically) `navigateTo()` does *not*
clear it the way it explicitly clears `confirmDeleteMed` on every view change (`index.html:1869`).

**Reproduction (verified live):**
1. Notes list → tap trash on a note → button becomes "Delete?".
2. Tap the page title (not Delete, not Keep — there's no Keep button on this pattern) → still "Delete?".
3. Navigate Home → back to Notes → **still shows "Delete?"** on that row.

**Task's specific ask — compare against `confirmDeleteAppt`:** Checked the sibling Appointments feature in
full: `confirmDeleteAppt` is *only* ever cleared inside `removeAppointment` (line 253) — identical pattern, identical
gap. So Notes is behaviorally consistent with its sibling here; this is not something v36 introduced or got
wrong relative to the feature it was modeled on.

**Lead Auditor check:** Is this actually a broader, worth-flagging inconsistency? Yes, at the *app* level:
`confirmDeleteMed` resets on `navigateTo()` (line 1869), and the med-history `confirmRemove` pattern
auto-times-out after 6 seconds (`index.html:2937`, `setTimeout(..., 6000)`), so the app already has two
different, more forgiving patterns elsewhere. Appointments and Notes share a third, stickier pattern. This is
worth Aaron knowing about as a general app-wide consistency item, but **it is not a v36 regression** (Notes
faithfully copied the already-shipped Appointments behavior) and does not block this release.

---

### F4 — Cross-tab stale-reference edit race (Informational, verified safe by code trace)

**Files:** `index.html:300-305` (`storage` event listener), `index.html:266-268` (`NOTES_KEY`/`loadNotes`/`persistNotes`).

**Issue:** The `storage` event listener that keeps two open tabs of the same profile in sync only re-syncs on
`ENTRIES_KEY`, `PREFS_KEY`, and `PROFILES_KEY` — `NOTES_KEY` (and `APPTS_KEY`, its v22 sibling) are not
included. So if Tab A has a note's Edit modal open and Tab B deletes that same note, Tab A's in-memory
`state.notes` and open modal do not update.

**Traced consequence:** If the user then taps Save in Tab A, `confirmNoteModal` calls `saveNote(m.dateStr,
m.text)`, which calls `loadNotes()` — a **fresh** `localStorage` read at save time, not a read of Tab A's stale
`state.notes`. Since Tab B's delete already persisted, `saveNote`'s `existing = list.find(n => n.date ===
dateStr)` finds nothing and takes the "create new" branch, producing a brand-new note (new id) with Tab A's
text. Net effect: the note the user thought they were "editing" gets **silently recreated**, not corrupted,
not duplicated, and no exception is thrown.

**Lead Auditor check — is this reachable in a single tab (the more realistic scenario for this app's users)?**
No: the note modal is a full-screen fixed-position overlay (`index.html:4753`, `position: 'fixed', inset:
'0', zIndex: '60'`) that captures all taps; there is no way to reach the underlying list's delete button while
the modal is open in the same tab. This scenario requires two simultaneously open tabs/windows on the same
device against the same profile, which is an unlikely usage pattern for this app's target users (chemo/
radiation patients and caregivers, typically single-device/single-tab). Also pre-existing gap (shared with
Appointments), not new in v36. **Verdict: theoretically real, practically very low likelihood, and the actual
failure mode is a benign "resurrected note" rather than data loss or corruption. Not blocking.**

---

## Checks performed and passed (no issue found)

- **APP_VERSION / sw.js CACHE bump** — `index.html:4844` (`const APP_VERSION = 'app-v36'`) and `sw.js:1`
  (`const CACHE = 'chemowell-app-v36'`) are both bumped and consistent. This is the exact defect class that
  shipped in v35 per project history — explicitly re-checked and confirmed correct this time.
- **Multi-profile isolation** — verified live end-to-end: created a note under Profile 1, created and
  switched to a new Profile 2 (via the Account screen's real "Switch" button, triggering `switchProfile()`'s
  `location.reload()`), confirmed Profile 2 starts with **zero** notes ("No notes yet"), added a distinct note
  under Profile 2, switched back to Profile 1, confirmed Profile 1's note is present and Profile 2's note does
  **not** leak across. `NOTES_KEY = 'chemowell-app-p-' + ACTIVE_PROFILE_ID + '-notes-v1'` (line 266) correctly
  scopes storage per profile, and the full-page reload on switch correctly re-initializes `state.notes` from
  the new profile's storage (`state.notes: loadNotes()` in the `state` initializer at line 586).
- **`deleteProfile` cleanup array** (`index.html:158-163`) — confirmed `'-notes-v1'` was added and the
  pre-existing `'-appts-v1'` gap (since app-v22) was also folded in, exactly as the v36 comment claims. Both
  are simple string-list additions with no other behavior change.
- **No cloud/network writes** — grepped the entire file for `fetch(`, `XMLHttpRequest`, `firebase`,
  `firestore`, `caretracker_` — zero matches anywhere in the codebase, not just in the Notes code. Notes (like
  everything else in this app) is 100% localStorage. Rule confirmed intact.
- **Timezone / date-string correctness** — `toLocalISO()` (`index.html:959-963`) builds the date string from
  local `Date` getters (`getFullYear`/`getMonth`/`getDate`), never `toISOString()`/UTC conversion, so there is
  no midnight-rollover or DST off-by-one risk in `dateStr` derivation. Confirmed by direct read, consistent
  with how the rest of the app (appointments, entries) already does date handling.
- **Wrong-note-deletion-on-reorder** — `confirmDeleteNote` and `removeNote` both key off `note.id` (never
  array index), and each row is keyed by `key: note.id` in the vdom (`index.html:4805`). Reordering the list
  (e.g., editing a note to move its sort position) cannot cause the confirm state or a delete action to target
  the wrong row. Confirmed by code trace; no live repro needed since the mechanism is structurally id-based.
- **Focus-safety render-guard** — the `setInterval` tick guard at `index.html:6373` correctly includes
  `!state.noteModal` in its condition, alongside `apptModal`/`medEditor`/`infoModal`/etc., so the note modal
  and its textarea are not torn down and rebuilt every second while open (which would have dropped focus/typed
  text). Confirmed present and correctly wired.
- **Router / nav wiring** — `VALID_VIEWS` includes `'notes'` (line 580), the drawer nav array includes the
  Notes entry (line 2088), and the main content router has `if (state.view === 'notes') return
  renderNotesView(now);` (line 2243). All confirmed present and correct.
- **No leftover debug/TODO/placeholder code in the v36 diff** — grepped for `console.log`, `TODO`, `FIXME`,
  `XXX`, `DEBUG` across the whole file; the only hits are pre-existing, unrelated to Notes (a `TODO(Aaron)`
  donation-link placeholder from before v36, and two pre-existing `console.warn` calls in unrelated
  medication-config code).
- **XSS / injection** — note text is rendered via the app's `h()` helper as a text child
  (`document.createTextNode`), never via `innerHTML`, so arbitrary note text cannot inject markup/scripts.

## Live user-journey testing summary

| Test | Result |
|---|---|
| Double-tap Save rapidly | **Pass** — no duplicate note created. The first tap's synchronous `setState`→re-render removes the modal from the DOM before a second physical tap can land on it. |
| Whitespace-only note | **Pass** — blocked by `confirmNoteModal`'s `.trim()` check; toast shown ("Write something before saving, or Cancel."), no note created/mutated, modal stays open. |
| 12 notes across distinct dates | **Pass** — all render correctly, sorted strictly newest-first (`b.date.localeCompare(a.date)`), no visible perf issue, list scrolls normally. |
| Stale-reference edit-then-delete | Reasoned through code (not practically reproducible in a single tab — modal blocks the underlying list). See **F4**: safe (note gets recreated, not corrupted) but only reachable via two simultaneous tabs on the same profile. |
| Delete-confirm "tap elsewhere" reset | **Reproduced**: confirm state does *not* reset on tapping elsewhere or navigating away/back. See **F3** — matches sibling Appointments exactly (not a regression). |
| Create profile → switch → verify empty → switch back → verify original intact | **Pass**, verified live (see above). |
| Reload mid-session (F5) with notes present | **Pass** — notes persist correctly across a full page reload (backed by localStorage, not memory-only state). |
| Very old backdated date (2020) and future date (2030) | **Pass, functionally** — both save and display without error. This is what surfaced **F1** (no year shown). |

---

## Verdict: **READY**

No blocking issues found. All four findings (F1–F4) are Low or Low–Medium severity, non-blocking, and none
represent data loss, data corruption, cross-profile leakage, duplicate-note creation, or a cloud-storage rule
violation — the specific failure classes this audit was most focused on all check out clean. Three of the four
findings (F2, F3, F4) are either unreachable through the UI or exact behavioral matches to already-shipped
sibling features (Appointments), so they are not v36 regressions. F1 (missing year in date displays) is the
one item worth a deliberate decision from Aaron: ship as-is (consistent with how Appointments already works)
or take it as a fast-follow before the journal has accumulated enough real multi-year data for it to bite a
user in practice.

**No blocking issues.**

### Optional (non-blocking) follow-ups, in priority order
1. F1 — show the year in the Notes list row and date pill whenever it differs from the current year.
2. F3 — consider unifying the three different "delete confirm" reset patterns in the app (nav-reset /
   6s-timeout / never-resets) into one, across meds/entries/appts/notes. App-wide, not Notes-specific.
3. F2 — tighten the comment on `saveNote`'s empty-delete branch to note it's currently unreachable via UI, or
   remove the branch if it's confirmed genuinely dead.
4. F4 — if multi-tab-same-profile usage is ever expected to be common, add `NOTES_KEY`/`APPTS_KEY` to the
   existing `storage` event listener alongside `ENTRIES_KEY`/`PREFS_KEY`/`PROFILES_KEY`.
