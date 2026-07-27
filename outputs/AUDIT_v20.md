# AUDIT_v20 — Pause a medication / Excluded near treatment day / Schedule-window time picker

Role: Auditor (Quality Chain stage 6) · Date: 2026-07-27 · Build under audit: app-v20
Method: independent adversarial pass across two fronts — (1) line-by-line code audit of every
function/call-site this release touched or should have touched (`normalizeMedication`,
`isPausedOn`, `setMedicationPaused`, `treatmentActiveOn`/`treatmentExcludedNow`, `status`,
`missedDosesFor`, `doseProgressToday`, `dueRemindersAt`, `medCards`, `renderGroupedMedsCard`,
`saveMedicationEditor`, `medicationFormFrom`, `hourTs`, `formatHour`/`formatQuarterHour`/
`formatClockOption`, the `windowRows` editor UI) and their blast radius in `index.html`, and (2)
live end-to-end user-journey testing against the running build at `http://localhost:8910/index.html`
via Playwright + Chromium (`/opt/node-tools/node_modules/playwright`), real DOM clicks/fills, fresh
`localStorage` per scenario, 390×844 primary viewport, `serviceWorkers: 'block'` per context (same
methodology as `AUDIT_v17.md`, which documented why that flag is required for deterministic runs on
this app). A fake-clock `Date` shim (`window.__fakeNow`, installed via `addInitScript`) was used to
control `TEST_MODE`'s `simNow()` precisely enough to test a real midnight boundary, which the app's
own BETA date controls (whole-day `shiftSimDate`) cannot reach on their own.

Reviewed upstream chain artifacts in full first: `DEV_BRIEF_pause_treatment_exclusion.md`,
`DEV_BRIEF_schedule_window_picker.md`, `DESIGNER_REVIEW_v20.md`, `LEAD_DESIGNER_SIGNOFF_v20.md`,
`QA_USER_ZERO_v20.md` (all clean/PASS per their own scope).

Test script and evidence: `/tmp/audit_v20.mjs` (21 automated live-browser assertions across 10
scenarios, reproducible — 18/21 passed cleanly; the 3 failures are the 3 real findings below, each
independently re-confirmed with a standalone repro script and a screenshot). Screenshots:
`outputs/v20-audit-screenshots/finding1_composition_inconsistency.png`,
`outputs/v20-audit-screenshots/finding2_treatmentOnly_desync.png`.

---

## 1. Findings

### P0 — none.
No safety-invariant, data-loss, or crash-class defect found. Dose ceilings, gap rules, and the
`RESERVED_LEGACY_MED_IDS`/Dexamethasone/Zofran id-gated logic are untouched and behave identically
to before this release (confirmed by grep — bytes-identical at their unchanged line numbers).

### P1-1 — Deleting and re-adding a medication under the same name silently discards `pausePeriods`, reviving exactly the "missed dose flood" the feature was built to prevent

**Reproduction (live, confirmed):**
1. Seed a scheduled medication `Ibuprofen` (id auto-derives to `ibuprofen`), `installedAt` 10 days
   ago, `paused: true`, `pausePeriods: [{start: <2 days ago>, end: null}]`, zero logged entries.
2. Load the app. Header correctly shows **"8 missed doses from previous days"** — the ~8 days before
   the pause window are genuinely missed (no entries, `alerts: true`), but the 2 paused days are
   correctly excluded by `isPausedOn` inside `missedDosesFor` (`index.html:667`). This is the feature
   working exactly as designed.
3. Delete `Ibuprofen` from the Meds tab (a completely ordinary action — fixing a typo, decluttering,
   temporarily removing then re-adding a medication). `deleteMedicationConfig` (`index.html:3136`)
   archives it to `state.archivedMeds` (name/sub only — **not** `pausePeriods`) and removes it from
   `state.meds`.
4. Add a brand-new medication also named `Ibuprofen`, same schedule. `nextMedicationId`
   (`index.html:2980`) derives the id from the name; since the old `ibuprofen` id is no longer in
   `state.meds`, it is free and gets reused for the new medication. The new medication is a fresh
   object: `pausePeriods: []`, `paused: false` (confirmed via the saved config, `index.html:323`'s
   default).
5. Header now shows **"10 missed doses from previous days"** — the exact 2 days that were correctly
   suppressed by the pause in step 2 have reappeared as missed, because `missedDosesFor` iterates
   `state.meds` and checks each *current* medication object's own `pausePeriods` (`index.html:666-667`);
   the new object has no memory of the deleted one's pause history.

**Why this matters:** the DEV_BRIEF's entire `pausePeriods` design — and the Owner's explicit,
named requirement ("resuming a medication after a multi-day pause must NOT flood the user with a
backlog of missed-dose flags") — is defeated by a completely mundane, foreseeable action for this
app's stated audience (a "sick, exhausted, stressed" caregiver reorganizing or correcting a
medication entry). The bug isn't in the pause logic itself — `isPausedOn`/`setMedicationPaused` are
correct in isolation (see the extensive PASS results below) — it's that `pausePeriods` lives on the
live medication object, which `deleteMedicationConfig`/`nextMedicationId`'s id-recycling silently
discards and replaces. This is a pre-existing architectural property of medication ids (entries under
a reused id have always been able to leak into a new medication's dose history — that part is not new
to v20), but v20 is the first feature whose entire purpose is a safety-relevant promise ("we will not
re-flag what you already handled") that this specific interaction directly breaks.

**Location:** `nextMedicationId` (`index.html:2980-2989`), `deleteMedicationConfig`
(`index.html:3136-3145`, archives only `{name, sub}`), `normalizeMedication`'s fresh-object default
(`index.html:323`), `missedDosesFor`'s per-current-medication `isPausedOn` check
(`index.html:666-667`).

**Recommendation:** either (a) archive `pausePeriods` (and ideally the full pause-relevant shape)
alongside `{name, sub}` in `archivedMeds` and have `nextMedicationId`/the add-flow restore it when a
new medication's derived id matches an archived one, or (b) stop recycling ids from deleted
medications entirely (append a numeric suffix even when the base id is technically free, the same way
`nextMedicationId` already does for *currently active* name collisions) so a new medication never
silently inherits an old one's history. (b) is the smaller, safer change and also closes the
longer-standing "old dose entries leak into a same-named new medication" issue this finding sits on
top of.

### P1-2 — Standalone Quick Log card and grouped-card row compose the `paused` + `treatmentMode:'excluded'` guards differently for the identical medication state — the standalone card silently vanishes instead of showing "Paused"

**Reproduction (live, confirmed):** two medications, both `paused: true` with an open
`pausePeriods` entry and `pausedCheckinDate` stamped to today (so the daily check-in banner is
isolated out of the test), both `treatmentMode: 'excluded'` with a treatment date logged such that
`treatmentExcludedNow` is currently `true` (i.e. currently inside the exclusion window) — one placed
as a standalone Quick Log card (`quickLog: true`), the other placed in the grouped Morning card
(`groupedMorning: true`). Everything else identical.

- **Grouped card** (`renderGroupedMedsCard`, `index.html:1613`): row renders correctly —
  `"TestMed E2 Grouped — Paused" / "Not tracked while paused. Resume anytime." / [Resume]`. This is
  because the `paused` check (`index.html:1625`) runs **before** the `treatmentOnly`/
  `treatmentExcludedNow` check (`index.html:1638`) inside the per-row `.map()`.
- **Standalone card**: **the medication does not appear anywhere in the Quick Log section at all** —
  no card, no "Paused" label, no Resume button, nothing. This is because `medCards`'s outer
  `.filter()` (`index.html:2666`) evaluates `!treatmentExcludedNow(m, now)` **before** any medication
  reaches the `.map()` where the `if (med.paused)` branch lives (`index.html:2667-2680`). A
  medication that is currently inside its excluded window is removed from the array entirely,
  upstream of where "paused" is ever checked — the `paused` branch inside `.map()` is simply
  unreachable for this combination.

The in-code comment directly above the standalone branch claims the opposite of what actually
happens: *"pause wins over every other card state -- 'the user explicitly said stop' outranks...
as the thing to communicate"* (`index.html:2668-2669`). That's true for every other state
(in-patient, not-scheduled) but **not** for `treatmentMode:'excluded'`, because the exclusion check
sits in the upstream `.filter()`, architecturally outside the `.map()`'s state-priority ordering the
comment describes.

**User-facing consequence:** a caregiver who places a medication on its own Home card, sets
"Excluded near treatment day," and pauses it (three individually reasonable, independently-documented
features from this same release, each usable without restriction on the others per DEV_BRIEF Open
Question 5's "confirm acceptable" answer) gets **zero on-Home indication** that the medication exists
or is paused for however many days the exclusion window spans — not even the muted "Paused" card the
grouped-placement version of the identical state correctly shows. The once-daily "Still pausing
{name}?" banner is the only surviving affordance, and it stops appearing for the rest of the day the
instant the user taps "Continue pausing" on it — after which there is no way back to a Resume control
without knowing to open the Meds tab directly.

**Location:** `medCards` filter, `index.html:2666`; `medCards` paused branch (dead for this
combination), `index.html:2667-2680`; contrast with `renderGroupedMedsCard`,
`index.html:1613-1649` (paused check at `:1625`, treatment check at `:1638`).

**Recommendation:** move the `treatmentExcludedNow`/`treatmentOnly`-outside-window exclusion out of
`medCards`'s upstream `.filter()` and into the `.map()`, in the same relative order
`renderGroupedMedsCard` already uses (paused first, then treatment-window, then not-scheduled) — this
also makes the standalone and grouped code paths structurally symmetric instead of two independently
maintained orderings that can (and did) drift.

### P2-1 — `normalizeMedication` does not self-heal a desynced `treatmentOnly`/`treatmentMode` pair; a stale `treatmentOnly:true` silently overrides `treatmentMode:'excluded'` visibility, including outside the exclusion window

**Reproduction (live, confirmed with a controlled A/B pair):**
- **H1**: a medication stored with `treatmentMode: 'excluded'` and `treatmentOnly: true` (a
  combination `saveMedicationEditor` itself can never produce — it always writes
  `treatmentOnly: form.treatmentMode === 'only'`, `index.html:3068-3069` — but nothing downstream of
  `normalizeMedication` re-derives or rejects it if it arrives some other way), **no treatment date
  logged at all** (so `treatmentActiveOn`/`treatmentExcludedNow` are `false` for every day, meaning
  the medication should be **fully visible** under correct `'excluded'` semantics — nothing is being
  excluded). Result: **the medication is hidden from Home entirely.**
- **H2 (control)**: byte-identical setup, `treatmentOnly` simply omitted (left for
  `normalizeMedication` to derive). Result: **visible**, as expected.

Root cause: `normalizeMedication` (`index.html:276-340`) computes `treatmentOnly`
(`index.html:308`: `typeof original.treatmentOnly === 'boolean' ? original.treatmentOnly : ...`) and
`treatmentMode` (`index.html:314-315`) as two **independent** reads of the same `original` object —
if `original.treatmentMode` is already a valid value (`'only'`/`'excluded'`), it's kept as-is, but
`original.treatmentOnly` is trusted verbatim whenever it's already a boolean, with no cross-check
against the `treatmentMode` that was just computed two lines below it. Every consumer that still
reads `med.treatmentOnly` directly — `medCards` (`:2666`), `missedDosesFor` (`:668`),
`doseProgressToday` (`:709`), `dueRemindersAt` (`:4133`), `status` (`:849`), `renderGroupedMedsCard`
(`:1617`, `:1638`) — inherits whichever of the two fields happens to say "restrict visibility," and in
every one of those call sites `treatmentOnly` is checked with an unconditional `if (med.treatmentOnly
&& ...)` / `!m.treatmentOnly` that has no knowledge `treatmentMode` might disagree.

**Not currently reachable through the shipped UI** — `saveMedicationEditor` always writes both fields
in lockstep, so no click-path can produce this state today. It's a real gap, not a live bug: the
mirror invariant the DEV_BRIEF and the in-code comment at `index.html:311-313` describe ("treatmentOnly
is kept mirrored... so every existing treatmentOnly-reading call site keeps working unmodified") is
only enforced at *save* time, not at *load* time, even though `normalizeMedication` is explicitly the
file's "single choke point every saved medication passes through on load" (per the schedule-window
DEV_BRIEF's own description of this function) and is exactly where storage-schema drift is supposed
to be neutralized. A future import/restore/multi-profile-copy feature, or direct storage
tampering/an old backup, would silently reintroduce this divergence with no self-correction and no
error.

**Location:** `normalizeMedication`, `index.html:305-315` (specifically the independent derivations
at `:308` vs `:314-315`).

**Recommendation:** derive `treatmentMode` first, then compute `treatmentOnly` **from** the resolved
`treatmentMode` (`treatmentOnly: treatmentMode === 'only'`) rather than trusting a separately-stored
value — the same pattern `saveMedicationEditor` already uses correctly at save time, just moved (or
duplicated) into the one function guaranteed to run on every load.

### P3-1 — Save-time schedule-window validation confirmed independent of the UI's option filtering (verified, not a defect)

Noted for completeness since the audit brief specifically asked whether an End time not-after-Start
was reachable by any path other than the dropdown filter. Confirmed live: a DOM-injected `<option>`
was appended directly to a row's End `<select>` (bypassing the app's own `endOptions = 
END_TIME_OPTIONS.filter(opt => opt.value > row.start)` filter at `index.html:3309`) with a value below
the row's Start, selected via a raw `change` event. `saveMedicationEditor`'s own independent filter
(`index.html:3020-3021`: `.filter(row => Number(row.end) > Number(row.start))`) correctly dropped the
tampered row; since it was the medication's only window row, the save was blocked with the expected
"Add at least one schedule window" toast (`index.html:3024`) rather than silently saving a
zero/negative-length window. This is real, working defense-in-depth, not just UI-level prevention —
flagged as a positive finding, no action needed.

---

## 2. Code audit — full sweep, findings above aside

- **`hourTs`/`dueRemindersAt`/`normalizeMedication`'s decimal-hour landmines (all three flagged in
  `DEV_BRIEF_schedule_window_picker.md`) — confirmed closed.** `hourTs` (`index.html:658`) now splits
  `Math.trunc(hour)`/`Math.round((hour%1)*60)` before calling `setHours`, preserving the DST-safe
  calendar-arithmetic approach rather than reintroducing raw millisecond math. `dueRemindersAt`'s
  firing gate (`index.html:4141-4142`) now compares hour AND minute (`startH`/`startM`) instead of
  the old whole-hour-only `h !== w.start`. `normalizeMedication`'s start clamp
  (`index.html:289`) is `Math.min(23.75, ...)`, not `Math.min(23, ...)`. All three verified live via
  Test C (day-boundary pause) and Test G (schedule-window save), which round-trip fractional-hour
  values correctly with no truncation.
- **Every consumer of `med.windows` re-audited for the decimal-hour change, independent of the Dev
  Brief's own list** — grepped the full file for `.windows`, `w.start`, `window.start`. Confirmed
  additionally safe: `status()`'s `atH` helper (`index.html:840`, pure multiplication, dyadic-exact
  for quarter hours), `isEarlyAt` (not re-verified line-by-line this pass but unchanged since the Dev
  Brief's read — no diff in that function), `formatRuleSummary` (`index.html:2857`) now calls
  `formatQuarterHour` instead of the old whole-hour-only `formatHour`, confirmed byte-identical output
  for on-the-hour legacy values (`formatQuarterHour`'s own comment and implementation guarantee this
  at `index.html:2874-2879`). No consumer was found reading `.start`/`.end` with an operation that
  assumes an integer (e.g. no bitwise ops, no `%` against a whole-hour assumption, no array-indexing
  by hour) beyond what the Dev Brief already identified and the Lead Developer already fixed.
- **`pausePeriods` structural correctness (beyond the delete/re-add finding above):**
  `isPausedOn` (`index.html:612-615`) correctly handles an `end` in the future (`d0 < dayStart(p.end)`
  — a period with a future `end` would just mean "paused through that day," not a crash or an
  inverted range; not reachable via the UI since `setMedicationPaused` always stamps `today`, but the
  data structure itself doesn't misbehave if it somehow occurred). `setMedicationPaused`
  (`index.html:3101-3115`) correctly guards against opening a second concurrent period
  (`if (!periods.length || periods[periods.length-1].end !== null)` before pushing) and against
  closing an already-closed or nonexistent period — confirmed both guards hold under real double-tap
  and cross-entry-point redundant-call testing (Tests A1-A3 below), not just by reading the code.
  `normalizeMedication`'s own `pausePeriods` sanitizer (`index.html:323`) filters out any period
  missing a finite `start` and coerces a non-finite `end` to `null` — reasonable defense against a
  malformed array from any future non-UI writer, though note this defense does **not** extend to
  cross-checking `end >= start` per period (an out-of-order tampered period would load without
  correction) — low severity since nothing in the current codebase can produce one, flagged only for
  completeness alongside the P2-1 finding's "normalizeMedication doesn't fully self-heal" theme.
- **Composition of the `paused` guard across every other consumer (`status`, `missedDosesFor`,
  `doseProgressToday`, `dueRemindersAt`) — confirmed consistent and correct.** All four check `paused`
  (live boolean, for "today") or `isPausedOn` (historical, for `missedDosesFor`'s per-day evaluation)
  **first**, before any treatment-window check — `status()` at `:804`, `missedDosesFor` at `:667`,
  `doseProgressToday` at `:708`, `dueRemindersAt` at `:4131`. The composition bug (P1-2) is isolated
  to the two Home-rendering functions (`medCards`/`renderGroupedMedsCard`), not the underlying
  scheduling/safety logic — a paused medication genuinely cannot be logged, cannot fire a reminder,
  and cannot accrue a missed-dose flag regardless of its treatment-mode, confirmed both by code
  reading and by live testing (Tests D1-D2, E1-E3).
- **Gap-timer ("as needed") medications and the pause feature — confirmed clean no-op, as the task
  brief hinted.** `missedDosesFor`/`doseProgressToday`/`dueRemindersAt` all filter on `m.windows`
  truthy (`:666`, `:706`, `:4130`); `normalizeMedication` deletes `windows` entirely for `type!=='win'`
  medications (`index.html:338`). A gap-type medication was never reachable by any of these three
  functions before or after this release — pausing one only affects `status()`'s early return
  (`:804`, correctly locks it) and the Home-card/grouped-card paused branches (confirmed rendering
  correctly, no crash, live in Test D).
- **`RESERVED_LEGACY_MED_IDS`/`dexActiveOn`/`zofranBlockedOn`/`dexWindowsForOffset` — confirmed
  untouched.** Grepped their exact lines (`index.html:588-591`, `620-621`, `2979`) against the Dev
  Brief's own citations — content is unchanged, only surrounding line numbers shifted.
- **Hard rules (`APP_CLAUDE.md`) — intact.** Zero `caretracker_*` references anywhere in the file
  (full-file grep). Zero Firebase/cloud references. `TEST_MODE = true` unchanged
  (`index.html:44`). No new `fetch`/`XMLHttpRequest`/network-write calls introduced by this release
  (grepped the touched regions directly).
- **Version discipline — clean.** `APP_VERSION = 'app-v20'` (`index.html:3465`), `sw.js`'s
  `CACHE = 'chemowell-app-v20'` (`sw.js:1`), and `README.md` carries a detailed `app-v20` row
  (verified present, unlike the `app-v17`-era gap `AUDIT_v17.md` P2-1 flagged — no repeat of that
  class of finding here).
- **`node --check` on the extracted module script — clean** (`/tmp/extracted.mjs`, syntax OK).
- **Dead code / leftover debug values — none found.** No stray `console.log`, no hardcoded test
  dates, no commented-out blocks left in the touched regions.

---

## 3. Live user-journey testing (Front 2) — evidence

18 of 21 automated live-browser assertions passed; the 3 failures are Findings P1-2 and P2-1 above
(P1-2 produced 2 failing assertions — standalone visibility and the standalone/grouped consistency
check — from the same root cause). Full script: `/tmp/audit_v20.mjs`.

| # | Scenario | Result | Notes |
|---|---|---|---|
| A1 | Same-position rapid double-tap on the Pause/Resume toggle button (label flips mid-gesture) | **PASS** | Nets out to one clean period, no corruption, regardless of which label the two taps actually land on. |
| A2 | Two `.click()` calls on the SAME captured (pre-render, stale-closure-risk) button element handle, back to back in one JS turn — the most adversarial double-tap simulation reachable, bypassing Playwright's live-DOM re-query | **PASS** | Both calls resolve to the same intended action (idempotent `setMedicationPaused` guard holds); still exactly one open period. |
| A3 | Redundant "Continue pausing" tap (Home banner) while already paused, then confirmed the med editor offers only "Resume" (never a second "Pause") once paused | **PASS** | No duplicate/second concurrent period opened from a second, independent UI entry point. |
| B0-B2 | Pause via editor → change Treatment-day availability to "Excluded" and Save (unrelated-field edit while paused) → Resume | **PASS** | `pausePeriods`/`paused`/`pausedCheckinDate` survive an intervening save with the exact same `start` timestamp; `treatmentOnly`/`treatmentMode` correctly mirror post-save. |
| C1-C3 | Pause at 23:59:40 (fake-clock-controlled real midnight boundary, not just whole-day `shiftSimDate`), advance clock 40s past midnight, Resume | **PASS** | `start` records the calendar day the tap actually happened on (not the next day); `end` correctly records the new day; `isPausedOn`'s `[start,end)` semantics correctly include the paused day and exclude the resume day. |
| D1-D2 | Gap-timer ("as needed") medication paused → shows inert "Paused" card on Home, no crash → resumed → round-trips cleanly, `windows` key stays absent throughout | **PASS** | Confirms gap meds are structurally unreachable by the missed-dose/reminder machinery regardless of pause state, as intended. |
| E0-E3 | `treatmentMode:'excluded'` (active window) + `paused:true` simultaneously, standalone card vs. grouped-card row | **E0/E2 PASS, E1/E3 FAIL** | **Finding P1-2.** Grouped row correctly shows "Paused"; standalone card is fully absent from the Quick Log section — confirmed with the daily banner isolated out of the test so it wasn't a false match. |
| F1-F2 | Pause, then a full page reload mid-flow (simulating the offline/app-kill scenario `TEAM.md` calls out) | **PASS** | `pausePeriods` survives via `localStorage`; the daily banner correctly stays silent for the rest of the same day (by design, `pausedCheckinDate` already stamped), and the Home card still independently shows "Paused"/Resume. |
| G1-G2 | DOM-injected End-before-Start value on a schedule-window row, bypassing the dropdown's own option filter, then Save | **PASS** | `saveMedicationEditor` independently rejects the row; save is blocked with the standard toast, nothing bad persists. |
| H1 | `treatmentMode:'excluded'` + stale `treatmentOnly:true`, no treatment date logged (exclusion window never active — medication should be fully visible) | **FAIL** | **Finding P2-1.** Medication hidden regardless. |
| H2 | Control: identical setup, `treatmentOnly` omitted | **PASS** | Isolates the cause to the stray `treatmentOnly` value, confirming H1 is a real desync bug and not, e.g., a `chemoOffsetFor(null)` side effect. |
| (extra) | Delete `Ibuprofen` (paused, 2 suppressed missed-dose days) → re-add a new medication also named `Ibuprofen` | **Confirmed defect** | **Finding P1-1.** Missed-dose count goes 8 → 10 on re-add; the id is silently reused (`nextMedicationId`) and the new medication's fresh `pausePeriods: []` no longer suppresses the 2 days the old medication's pause had correctly handled. |

---

## 4. Verdict

**Not clear to proceed past this stage as-is.** Per `TEAM.md`'s fail-fast rule, a MAJOR defect found
at any stage sends the work back to the Developer — this audit found two (P1-1, P1-2), both live,
both reachable through completely ordinary use of features shipped in this exact release, and both
sit directly on top of the Owner's own explicitly-named safety requirement for this feature set
("resuming ... must NOT flood the user with a backlog of missed-dose flags," and each of the three
features working correctly in combination with the others per DEV_BRIEF Open Question 5).

- **P1-1** (delete + re-add under the same name silently discards `pausePeriods`, reviving suppressed
  missed-dose flags) is the more serious of the two — it defeats the pause feature's core promise via
  a two-tap action any user could take without any awareness they're doing something unusual.
- **P1-2** (standalone Quick Log card vanishes instead of showing "Paused" during an active
  `treatmentMode:'excluded'` window, while the grouped-card equivalent correctly shows it) is a real,
  live, reachable inconsistency between two code paths that are supposed to represent the same state
  — not a crash, but exactly the "looks fine, isn't" class of bug `TEAM.md` identifies as this role's
  reason for existing.
- **P2-1** (`normalizeMedication` doesn't self-heal a `treatmentOnly`/`treatmentMode` desync) is real
  but not currently reachable through the shipped UI — does not block this release on its own, but
  should be fixed in the same pass since it's a small, mechanical, one-line-reorder fix
  (`treatmentOnly` derived from the resolved `treatmentMode`, not read independently) sitting in
  exactly the function the codebase already treats as its schema-drift safety net.

Everything else exercised — double-tap/stale-closure resilience on the pause toggle (three
independent adversarial mechanisms, all clean), real midnight-boundary date-math correctness, gap-timer
medications correctly and structurally unreachable by missed-dose tracking regardless of pause,
mid-flow reload persistence, and save-time schedule-window validation holding independently of the
UI's own filtering — passed cleanly with reproducible live evidence, and the decimal-hour/15-minute
picker landmines the Dev Brief flagged are confirmed correctly closed.

**Recommend:** return to the Developer/Lead Developer stage for P1-1 and P1-2 (fix + this audit's
scenarios re-verified against the fix), with P2-1 folded into the same pass since it touches the same
function family. Do not advance to the Lead Auditor/PM gate until both P1s are resolved.
