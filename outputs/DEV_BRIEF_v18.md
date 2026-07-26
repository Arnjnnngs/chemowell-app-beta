# DEV_BRIEF_v18.md — Reports → Blood Pressure crash

Role: Developer (investigation + plan only, no code changes made in this pass). Repo: `chemowell-app-beta` (APP-BETA). Investigated against the current `index.html` as of 2026-07-26.

## Process note — source docs referenced in the assignment were not found

The assignment pointed to `/home/claude/chemowell-app-beta/TEAM.md`, `outputs/QA_USER_ZERO_v17.md`, and `outputs/AUDIT_v17.md`, and asked me to follow the style of `outputs/DEV_BRIEF_v17.md`/`v16.md`. None of these files exist in this repo, on disk or anywhere in `git log --all`. The repo's actual version ledger (`README.md`) only goes up to `app-v10` (2026-07-24); there is no v16/v17 in this codebase's history. `outputs/` currently contains only `DESIGN_SPEC_B23.md` and two PNGs.

Rather than fabricate a "previous diagnosis" from documents that don't exist, I independently re-derived the root cause directly from the current source. The bug description in the assignment (crash on open, silent on-screen, ~1/sec repeating `TypeError` via the tick loop) turned out to be **exactly accurate** against the real code — see verification below. Flagging the missing docs so whoever owns the doc trail can reconcile the version numbering; it doesn't block the technical finding.

## Root cause — confirmed

`renderBloodPressureReport()`, `index.html` lines 3011–3023 (current, re-located fresh — not the 3278–3290 range from the stale ticket):

```js
function renderBloodPressureReport(now) {
  const list = state.entries.filter(e => e.medId === 'blood_pressure').sort((a, b) => b.ts - a.ts);
  if (!list.length) return h('div', { style: {...} }, 'No blood pressure readings yet. Log them from the Home screen card.');
  return h('div', { style: {...} },
    ...list.map((e, i) => h('div', {...}, ...))
  );
}
```

Both branches `return` a single DOM node from `h()` (`h()` at line 1252 is `document.createElement(tag)` — a plain `Element`, not iterable). Every sibling report renderer in this file returns an **array** of top-level nodes instead:

- `renderHistory` (3085) → `return [toggleBar, h(...)]`
- `renderCycle` (3174) → `return [card, history]`
- `renderAppetite` (3212) → `return [history]`
- `renderBowelMovementReport` (3233) → `return [history]`
- `renderWeightTrend` (3329) → `return [toggle, h(...)]` (empty state) / `return [toggle, ...]` (populated)
- `renderInPatient` (3251, same file, same convention) → `return [card, history]`

`renderReportDetail()` (3069–3082) consumes whichever renderer it dispatches to and spreads the result directly into its own returned array:

```js
function renderReportDetail(type, now) {
  const report = reportDescriptor(type, now);
  const content = type === 'history' ? renderHistory(now) : ... : type === 'blood_pressure' ? renderBloodPressureReport(now) : ...;
  return [
    h('section', ... report header ...),
    ...content
  ];
}
```

`...content` requires `content` to be iterable (array). For every other report type it is. For `blood_pressure` it's a bare `Element`, so `...content` throws `TypeError` (not iterable) the instant `renderReportDetail` runs for that type.

**Both code paths inside `renderBloodPressureReport` are affected** — verified directly, not assumed:
- Empty state (line 3013, `if (!list.length) return h(...)`): single node, crashes.
- Populated state (lines 3014–3022, `return h('div', ..., ...list.map(...))`): also a single outer node — the `...list.map(...)` spread there is fine (it's spreading an array of rows as *children* of that one div, valid `h()` usage), but the function's overall return value is still one `Element`, not an array. Also crashes.

So the crash fires whether or not the user has ever logged a BP reading — confirms QA's claim of both empty-state and populated-state crashes.

## Exact failure mechanism (why it's silent, then repeats every ~1s)

1. Reports tile tap → `openReport('blood_pressure')` (1313) → `setState({ view: 'reports', reportsView: 'blood_pressure' })` (1314).
2. `setState()` (345–353) mutates `state` first, **then** calls `render()`.
3. `render()` (1702–1737) has no try/catch. It builds the whole page tree in one expression, including `renderContent()` → `renderReportDetail('blood_pressure', now)` → the `...content` spread → throws.
4. Because the throw happens *before* `root.innerHTML = ''; root.appendChild(page)` (1734–1735) is reached, the previously-rendered DOM (the Reports menu, pre-tap) is never replaced. That's the "tapping the tile produces zero visible feedback" symptom — the screen doesn't freeze or blank, it just fails to update, silently.
5. `state.reportsView` is already `'blood_pressure'` (step 2 completed before the throw), so it stays stuck there.
6. The global tick loop, `setInterval(() => { ...; if (!state.timeModal && !isEditing) render(); ... }, 1000)` (3676–3682), calls `render()` every second. Each tick re-enters the same crashing path and throws again — the repeating ~1/sec `TypeError` QA observed. It only stops when the user navigates away (changing `state.view`/`state.reportsView` off the blood_pressure branch), matching the QA report exactly.

## Blast radius — confined to one call site

`grep -n "renderBloodPressureReport("` across the whole file returns exactly two matches: the function definition (3011) and the one call inside `renderReportDetail` (3071). No other function calls it.

The **Home-screen "Blood pressure" quick-log card** (lines 2305–~2317, inside the Home/Today content builder) is a separate, self-contained `h()` tree with its own inline IIFE for the "Last sys/dia" label and its own input fields + `logBloodPressure()` handler (786–794). It does **not** call `renderBloodPressureReport()` at all and is fully unaffected by this bug — confirmed by reading it directly, not inferred. It must not be touched by the fix.

## Data safety — confirmed no data-loss risk, pure rendering bug

- `logBloodPressure()` (786–794) → `addEntryDB()` (123–129) writes straight to `localStorage` key `chemowell-app-p-<profile>-entries-v1`. This write path is entirely independent of any render function.
- The crash occurs only while *building DOM nodes to display* `state.entries` (a read/render path) — never while writing. Readings logged from the Home card are saved correctly and remain intact in storage; they simply cannot currently be *viewed* in the Reports detail screen because that view fails to finish rendering.
- `removeEntryDB()` per-row "Remove" button (line 3020) is unreachable today only because the row never renders — once the fix lands, this is the same tested `removeEntryDB` used by every other report's remove button, no new risk there.

This is safe to characterize to Aaron as: **display-only bug, zero data loss, zero data-integrity risk.**

## Recommended fix (minimal, surgical)

Wrap both `return` statements in `renderBloodPressureReport()` (lines 3013 and 3014–3022) in array brackets, matching the exact convention every sibling renderer already uses (`renderAppetite`/`renderBowelMovementReport`'s `return [history]` pattern is the closest analog — single top-level node, single-element array):

```js
function renderBloodPressureReport(now) {
  const list = state.entries.filter(e => e.medId === 'blood_pressure').sort((a, b) => b.ts - a.ts);
  if (!list.length) return [h('div', { style: {...} }, 'No blood pressure readings yet. Log them from the Home screen card.')];
  return [h('div', { style: {...} },
    ...list.map((e, i) => h('div', {...}, ...))
  )];
}
```

Two-character change per branch (add `[` / `]`). Nothing else in the function changes. No changes needed to `renderReportDetail`, `reportDescriptor`, `renderReportsMenu`, or the Home BP card — they're already correct/unaffected.

## Definition of done

- `renderBloodPressureReport()` returns an array in both branches (empty-state and populated-state).
- Reports → Blood Pressure opens and displays correctly with **zero** logged readings (empty-state copy visible, no console error).
- Reports → Blood Pressure opens and displays correctly with **one or more** logged readings (rows visible, each showing sys/dia + timestamp, each with a working Remove button that calls `removeEntryDB`).
- No repeating console errors from the 1-second tick loop while the Blood Pressure report is open.
- Back button / navigating away from the report still works (unrelated to this bug, but part of the same view — sanity check it wasn't collateral damage).
- Regression check, must NOT change: History, Weight, Cycle, Bowel Movement, and Appetite reports all still render exactly as before (their functions are untouched by this fix — verify by opening each from the Reports menu).
- Regression check, must NOT change: the Home-screen "Blood pressure" quick-log card (input fields, Log button, "Last sys/dia" label) — separate code path, should need no changes and must keep working identically.
- No other report-rendering function's array-return convention should be touched or "cleaned up" as a drive-by — scope is the one function.

## Suggested QA verification steps

1. Fresh install / no BP entries → Reports → Blood Pressure → confirm empty-state message shows, no console error, no repeating error after waiting 3+ seconds.
2. Log 1 BP reading from Home card → Reports → Blood Pressure → confirm the reading renders with correct sys/dia/timestamp, no console error.
3. Log 2–3 more readings → confirm all render, newest first (list is sorted `b.ts - a.ts`), Remove button removes the correct row and updates the list live.
4. Remove the last reading → confirm it falls back to the empty-state message without crashing.
5. Open each of the other 5 report types (History, Weight, Cycle if enabled, Bowel Movement, Appetite) → confirm no regression.
6. Confirm the Home-screen BP quick-log card still logs correctly and shows "Last sys/dia" after logging.
