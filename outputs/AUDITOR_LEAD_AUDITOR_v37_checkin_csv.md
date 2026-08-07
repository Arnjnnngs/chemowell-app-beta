# AUDITOR + LEAD AUDITOR Report — v37 "Daily check-in" + CSV export fix

**Repo:** chemowell-app-beta
**Scope:** `index.html` — Daily check-in card/modal/completion-tracking/notification-scheduling (replacing the
three old nag banners), CSV export's new Web Share path, and the two deleted dead functions.
**Prior stage:** Designer/Lead Designer visual pass — both PASSED (per task brief).
**Method:** Full line-by-line read of every v37 diff site plus its blast radius (call sites, storage keys,
notification scheduler), followed by live end-to-end testing against the running app at
`http://127.0.0.1:8936/index.html` using Playwright (`chromium` at `/opt/pw-browsers/chromium`, driven via
Node scripts, not the reasoning-only route) at mobile (390×844) and desktop (1280×900) viewports. Every claim
below marked "confirmed live" was reproduced against the running app — actual clicks, actual localStorage
reads, actual screenshots — not inferred from source alone.

This is written as a combined Auditor pass followed by an adversarial Lead Auditor re-check: each surviving
finding below was independently re-reproduced with a second, differently-constructed test before being kept in
this report, and I explicitly tried to find each one to be a test artifact / false positive before accepting
it as real.

**Explicit statement on live testing:** All findings F1–F3 below, and all "confirmed clean" items in the
Verified-Working section, were exercised against the actually-running app in a real (headless) Chromium
browser — localStorage seeded per the harness's own gotcha note, buttons actually clicked or DOM events
actually dispatched, and the resulting localStorage/DOM state actually read back afterward. Nothing in this
report is "should work based on reading the code" without a corresponding live reproduction. Screenshots are
saved under `outputs/v37-checkin-evidence/`.

---

## Findings

### F1 — Rapid double-tap on the check-in modal's Save button creates duplicate appetite/bowel/weight entries (High)

**File:** `index.html:1525-1539` (`confirmCheckinModal`).

**Issue:** `confirmCheckinModal` is `async` and does several `await`s (`logAppetite`, `logBowelMovement`,
`addEntryDB` for weight) *before* it finally calls `closeCheckinModal()` (which nulls `state.checkinModal`) as
its second-to-last statement. There is no guard at the top of the function and no disabling of the Save
button while the save is in flight. Since none of those awaited calls do real I/O (`addEntryDB` is a
synchronous `localStorage` write wrapped in `async`), the whole chain resolves inside the JS microtask queue —
but if two click events land before the modal has actually unmounted (a realistic double-tap on a touchscreen,
or an impatient double-click), both invocations run to completion and each pushes its own new entry, because
`addEntryDB` always **appends** (no update-in-place, no dedup) for `appetite`/`bowel_movement`/`weight`.

This directly contradicts the app's own established defensive pattern: the pre-existing (non-v37)
`confirmTimeAndLog` (`index.html:1189`, used by every Quick Log card) guards against exactly this race by
calling `setState({ timeModal: null })` as its **first** side-effecting statement — before any `await` — so a
second click sees `state.timeModal` already null and bails via `if (!m) return;`. `confirmCheckinModal` does
not follow this pattern; it's a regression relative to the rest of the codebase, not just an isolated new bug.

**Reproduction (confirmed live, twice, two different ways):**
1. Seeded fresh profile (all 3 check-in toggles on), opened the check-in modal, filled Appetite=Normal,
   Bowel=Normal, Weight=150.5.
2. A real Playwright double `.click({force:true})` via `Promise.all` did **not** reproduce it (Chromium's own
   event-dispatch spacing let the first handler's microtasks fully drain before the second synthetic click was
   processed) — this was the first thing I tried, and it looked clean. Not trusting that, I re-tested with a
   more realistic worst case:
3. `btn.dispatchEvent(new MouseEvent('click', ...))` called **twice back-to-back in the same JS task** (no
   `await` between dispatches — simulating two touch events queued before either handler's async chain has
   unwound) reliably produced **6 entries instead of 3**: `["appetite","appetite","bowel_movement",
   "bowel_movement","weight","weight"]`.
4. Visible caregiver-facing impact confirmed: navigated to Reports → Weight afterward — the "All readings"
   list shows **two identical rows**, `Fri, 8/7 · 12:00 PM · 150.5 lbs` back-to-back (screenshot:
   `v37-checkin-evidence/13c_weight_full.png`). This is exactly the kind of silently-duplicated health data a
   caregiver could hand to a doctor without noticing.
5. Checked whether the free-text note is also vulnerable: it is **not** — `saveNote()` dedupes by date, so
   the same double-dispatch race with a note filled in produced exactly 1 note, not 2 (confirmed live). Only
   the three `addEntryDB`-backed metrics are exposed.

**Lead Auditor re-check:** Tried to dismiss this as "just how double-clicks always behave in this app, not a
v37-specific problem." Directly tested the pre-existing weight Quick Log → Confirm flow with the identical
double-dispatch technique: it produced exactly **1** entry, not 2 — confirming `confirmTimeAndLog`'s
null-state-before-await guard actually works and this is not an app-wide inherent limitation. **Verdict:
CONFIRMED, real, reproducible, and specific to the new v37 code path — not a false positive, not pre-existing.**

---

### F2 — Weight field in the check-in modal is always blank on open, even if weight was already logged that day via Quick Log — re-answering it creates a second, conflicting entry (Medium)

**File:** `index.html:1514-1523` (`openCheckinModal`).

**Issue:** `openCheckinModal()` pre-fills Appetite and Bowel from any existing same-day entry
(`appetiteFor(todayStart)`, `bowelMovementFor(todayStart)`), but **hardcodes `weight: ''`** unconditionally —
it never checks whether a weight entry already exists for the day. If a caregiver has Weight *and* at least
one other metric (Appetite/Bowel) opted into the check-in, and logs Weight earlier in the day through the
normal Quick Log flow (not the modal) while leaving the other metric unanswered, `checkinDoneForDay()`'s
fallback logic correctly keeps the Home card visible (because the *other* metric is still missing) — but
opening the modal to answer that other metric shows Weight as blank, inviting the caregiver to fill it in
again. Doing so calls `addEntryDB` a second time for `weight`, since there is no fallback/update-in-place
here either.

**Reproduction (confirmed live):**
1. Seeded profile with all 3 toggles on. Logged Weight = 155 via the normal Quick Log card + its Confirm
   step (screenshot: `v37-checkin-evidence/15_after_weight_quicklog.png` shows the pre-existing "Log Weight"
   confirm modal, unrelated to but reached en route to reproducing this).
2. Confirmed the Daily check-in card **correctly stays visible** afterward (Appetite/Bowel still unanswered) —
   this half of the fallback logic works as intended.
3. Opened the check-in modal: Weight field showed `""` (blank), not `155`.
4. Answered Appetite = Normal, filled Weight = 156 (a caregiver re-entering what they believe is unanswered),
   hit Save.
5. Read back `entries`: **two** `weight` entries for the same day — `155 lbs @ 12:39 AM` (the Quick Log one)
   and `156 lbs @ 12:00 PM` (the modal one) — different values, both persisted, no warning shown.

**Lead Auditor re-check:** Confirmed this can only be reached this way — I checked whether re-opening the
modal after a *normal* Save (via the modal itself) could also cause this, since Appetite/Bowel *do* pre-fill.
It cannot: `confirmCheckinModal` unconditionally calls `markCheckinCompletedToday()` on every Save regardless
of which fields were filled, which permanently hides the card (and thus the only UI path to the modal) for
the rest of that simulated day — verified live that a Save with only Appetite answered still hides the card
immediately after. So the "reopen and re-answer an already-filled field" risk is real for exactly one specific
mismatch (a metric completed via a *different* flow than the modal, i.e., Quick Log or a Reports-tab direct
log for Appetite/Bowel), not a generally-reachable reopen loop. **Verdict: CONFIRMED, narrower trigger
condition than F1, but a realistic one — a caregiver weighing in the morning via Quick Log and doing the rest
of the check-in that evening is an entirely ordinary usage pattern for this app, not a contrived edge case.**

---

### F3 — Daily check-in reminder is not subject to the same quiet-hours filter dose reminders use (Medium)

**File:** `index.html:6134-6182` (`buildReminderPlan`), `index.html:5011-5015` (Settings time input).

**Issue:** Dose-window reminders explicitly refuse to schedule a reminder whose window opens during quiet
hours: `const startH = Math.trunc(w.start); if (startH >= 22 || startH < 8) return;` (line 6151-6152), with an
inline comment explaining the intent. The new check-in reminder block added a few lines later
(`index.html:6170-6181`) has **no equivalent check** — it only bounds `at` against `earliest`/`horizonEnd`:
```js
if (checkinEnabledToday() && !checkinDoneForDay(d0)) {
  const at = hourTs(d0, timeValueToDecimalHour(getDailyCheckinTime()));
  if (at >= earliest && at <= horizonEnd) { out.push({ ... }); }
}
```
The Settings `<input type="time">` that sets this (`index.html:5014`) has no `min`/`max` attribute, so nothing
in the UI stops a caregiver from picking, e.g., `23:30` or `02:00`. As written, the scheduler will happily
arm a real device notification at that literal wall-clock time every single day.

**Verification:** This cannot be end-to-end tested here (no real device / native shell available in this
environment to actually observe a fired OS notification), so this is a **code-level** finding, not a live
reproduction — flagged as such per the instructions. The code itself is unambiguous on read, though: I traced
`buildReminderPlan` line by line, confirmed the dose-reminder quiet-hours check exists and is the only such
check in the function, and confirmed the checkin block that follows a few lines later has no analogous
condition. I also confirmed the time `<input>` has no client-side range restriction, so the bad input is
directly reachable from Settings without needing to bypass anything.

**Lead Auditor re-check:** Is this possibly intentional (e.g., a caregiver *wants* to be woken for a 2 AM
weight check before an early treatment)? The code's own comment block for the appointment-reminder section a
few lines below (`index.html:6184-6188`) explicitly makes exactly this argument for *appointments* — "a 6 AM
lab draw... is precisely the case where the caregiver needs to be woken up" — and deliberately opts
appointments out of quiet hours *with that reasoning stated in the comment*. The check-in reminder has no such
comment or stated rationale; its own comment block (`index.html:6165-6169`) only explains the once-per-day/
horizon logic, never mentions quiet hours one way or the other. Given the dose-reminder quiet-hours logic sits
20 lines above it in the same function and the appointment carve-out is explicitly justified a few lines
below it, the total silence around check-in is much more consistent with an oversight than a considered
decision. **Verdict: CONFIRMED at the code level (cannot be live-verified against real notification delivery
in this environment); recommend either applying the same `startH >= 22 || startH < 8` guard to the check-in
block, or clamping/warning on the Settings time input, or explicitly documenting the "always fire, even at
2 AM" behavior as intentional the way the appointment section does.**

---

## Verified-working (tried to break, could not) — confirmed live

- **Blank-fields Save:** Opening the modal and hitting Save with every field left blank saves cleanly, creates
  zero entries/notes, sets `checkinCompletedDays[today]=true`, and correctly hides the card. (screenshot:
  `03_after_blank_save.png`)
- **Card correctly hides after any Save**, regardless of which subset of fields were answered.
- **Toggling all 3 check-ins off after already completing that day's check-in:** card stays hidden (trivially,
  since `checkinEnabledToday()` now returns false — reconfirmed live rather than just reasoned).
- **Quick Log fallback works as designed:** with only Weight opted in, logging weight through the *normal*
  Quick Log flow (never opening the check-in modal at all) correctly makes `checkinDoneForDay` return true via
  the entry-fallback path, and the Home card never appears. This is the one case where the fallback logic
  behaves exactly as v37's self-verification intended.
- **Day-boundary behavior via TEST_MODE "+1 Day"/"−1 Day":** completed a check-in, jumped the simulated clock
  forward one day — card correctly reappeared (new day, not done); jumped back — card correctly stayed hidden
  (original day's `checkinCompletedDays` entry intact, not lost or duplicated). `checkinCompletedDays` does
  **not** leak across the boundary in either direction.
- **Profile isolation:** `checkinCompletedDays` lives inside the per-profile `PREFS_KEY`
  (`chemowell-app-p-<id>-prefs-v1`), and `switchProfile()`/`addProfile()` both force a full `location.reload()`
  which re-derives `ACTIVE_PROFILE_ID`/`PREFS_KEY` from scratch — there is no code path where one profile's
  completed-check-in state could bleed into another's. (Verified by code trace of `ACTIVE_PROFILE_ID`,
  `PREFS_KEY`, `switchProfile`; the reload-on-switch pattern makes cross-profile leakage structurally
  impossible rather than just "untested.")
- **Cancel button:** leaves zero entries/notes/completion-flag behind, and reopening the modal afterward shows
  fully fresh (empty) fields — no leaked draft from the cancelled attempt.
- **CSV export, zero entries:** shows "Nothing to export yet — log something first" and does **not** attempt
  `navigator.share` or a Blob download (confirmed via a `page.on('download')` listener that never fired).
- **CSV export, successful share:** `navigator.share` called exactly once, correct "pick where to save it"
  toast, and the Blob/`<a download>` fallback path does **not** also fire — no double-export.
- **CSV export, user cancels the share sheet (`AbortError`):** confirmed silent — no failure toast appears,
  and the fallback download does **not** also fire. The `catch` block's `if (e.name === 'AbortError') return;`
  correctly distinguishes this from a genuine failure.
- **CSV export, genuine share failure (non-Abort error):** confirmed the code correctly falls through to the
  classic Blob + `<a download>` link, fires a real download, and shows the "N entries exported — check
  Downloads" toast.
- **CSV export, `navigator.share` present but `canShare({files})` returns false:** confirmed `share()` is
  never called and the code goes straight to the Blob fallback, as the `if (navigator.canShare(...))` guard
  intends.
- **Dead functions:** `dailyAlertLevel`/`dailyAlertStyle` — grepped the full file, zero remaining references
  anywhere; would have been an instant `ReferenceError` on Home render if any call site had survived. None did.
- **`NOTICE_TONES`:** still defined intact (`index.html:1592`) and actively used by ~9 other banners/badges
  across the file (missed-dose, appointment, weight, warning banners, the "Excluded" med chip, etc.) — not
  broken by the v37 removal of the three old banners.
- **Settings UI:** "DAILY CHECK-IN" sub-heading and all three toggles render and are clickable; the reminder
  time `<input type="time">` correctly hides when all three toggles are off and correctly reappears the moment
  any one toggle is turned on (tested both directions live). (screenshot: `10_settings_daily_checkin.png`)
- No JavaScript runtime/console errors observed navigating Home / Meds / Reports / In-Patient / Symptoms /
  Settings with a freshly-seeded profile.

---

## Not independently reproducible in this environment (code-level only)

- F3's actual notification firing at 2 AM on a native device — no native shell available here. The scheduling
  *logic* itself was fully traced and is unambiguous; only the final OS-level delivery is untested.
- `buildReminderPlan`'s day-walking (`nextDay()`), horizon boundary, and DST handling for the new checkin
  block were read carefully and found structurally sound (reuses the same `nextDay()`/`hourTs()` helpers the
  already-shipped dose-reminder loop uses, so it inherits that code's existing DST correctness rather than
  reimplementing date math) — no separate live test performed for DST specifically since it isn't a new code
  path, just a new consumer of an existing one.

---

## Overall verdict: **FAIL-WITH-FINDINGS**

Three real, reproduced findings (F1 High, F2 Medium, F3 Medium — F3 code-level only). F1 in particular is a
straightforward, easily-hit data-integrity bug (impatient caregiver double-taps Save, a completely ordinary
interaction on a touchscreen) with a silent, visible-in-Reports consequence, and it's a regression against a
guard pattern the rest of the codebase already established and uses correctly elsewhere — this should block
ship until fixed. F2 is real but narrower. F3 needs an explicit product decision (apply quiet hours, or
document the exception like the appointment-reminder code already does for its own carve-out) rather than
shipping silently either way. Recommend: fix F1 by moving `closeCheckinModal()` (or an equivalent busy-guard)
to the top of `confirmCheckinModal()` before any `await`, matching `confirmTimeAndLog`'s existing pattern; fix
F2 by pre-filling weight from `state.entries` the same way appetite/bowel already are; resolve F3 with an
explicit decision. Everything else in the v37 diff — blank-save handling, day-boundary behavior, profile
isolation, CSV export's share/fallback/abort logic, and the two dead-function removals — held up under live
adversarial testing and is clean.
