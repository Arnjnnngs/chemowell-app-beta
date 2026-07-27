# Developer Brief — Structured schedule-window picker (replaces free-text "Schedule windows" field)

Stage: Developer (investigation only — no code changed). Repo: `chemowell-app-beta` (APP-BETA), file: `index.html` (single file, no build step). **Checkout was initially stale** (found at commit `4e05654`, `app-v10`) — per this task's explicit instruction, `git fetch origin && git pull origin main --ff-only` was run before any code was read. Verified against `app-v19` (`const APP_VERSION = 'app-v19'`, line 3182), commit `3c82397` ("app-v19: require a minimum gap for as-needed meds"), the current HEAD at investigation time. Every line number below was read fresh from this checkout.

Aaron's design decision (binding, not re-litigated here): replace the free-text "Schedule windows" field with a structured, repeatable list of Start/End `<select>` dropdown rows at 15-minute intervals, plus an optional per-row label and a live plain-language preview line.

---

## 1. Current implementation

### The field itself
`form.windowsText` — a single free-text `<input>` in the medication editor, **line 3068**:
```js
scheduled ? h('label', { style: { gridColumn: '1 / -1' } }, fieldLabel('Schedule windows', 'e.g. 8 AM-12 PM Morning, 8 PM-10 PM Evening.'), formInput({ value: form.windowsText, placeholder: '8 AM-12 PM Morning, 8 PM-10 PM Evening', onInput: event => updateMedicationForm('windowsText', event.target.value) })) : ...
```
Only rendered when `form.type === 'win'` (scheduled meds); "as needed" (`type: 'gap'`) meds get a "Minimum gap hours" number input instead in the same grid slot.

### Parsing: text → `windows` array
`parseScheduleWindows(text)`, **lines 2818–2828**:
```js
function parseScheduleWindows(text) {
  const windows = [];
  String(text || '').split(',').map(value => value.trim()).filter(Boolean).forEach((segment, index) => {
    const match = segment.match(/^(\d{1,2})(?::\d{2})?\s*([AaPp][Mm])?\s*[-–]\s*(\d{1,2})(?::\d{2})?\s*([AaPp][Mm])?\s*(.*)$/);
    if (!match) return;
    const start = Math.max(0, Math.min(23, scheduleHourTo24(match[1], match[2], false)));
    const end = Math.max(1, Math.min(24, scheduleHourTo24(match[3], match[4], true)));
    if (end > start) windows.push({ start, end, name: (match[5] || ('Window ' + (index + 1))).trim() });
  });
  return windows;
}
```
`scheduleHourTo24(hourStr, ampm, isEnd)` (**lines 2811–2817**) converts a 12-hour string + AM/PM into a 24-hour integer hour.

**This confirms the exact bug Aaron's Lead Developer flagged**: the function splits on commas, and for each segment either produces a window or silently `return`s nothing (line 2822: `if (!match) return;`, and again line 2825's `if (end > start)` guard) — there is no collected list of failures and no user-facing warning. A typo like `"8-12 Morning, 2-4p Afternoo n"` (stray space breaking the regex) drops the second window with zero feedback. The only validation gate at all is at save time (**line 2870**): `if (type === 'win' && !windows.length) { setToast(...); return; }` — this only fires when **every** segment fails to parse, i.e. the empty-array case. **A partial failure (1 of N segments drops) passes validation silently** because `windows.length` is still truthy. This is the exact caregiver-facing bug: they can believe two reminder windows are set when only one was actually saved.

### Critical, previously-unflagged finding: `start`/`end` are stored as **whole-hour integers only today** — minutes are already being discarded
The regex's minute group is non-capturing and unused: `(?:\:\d{2})?` matches but never captures `:MM`. `scheduleHourTo24` does `Number(hourStr)` on `match[1]`/`match[3]`, which are pure `\d{1,2}` digit captures (no decimal point possible). **Even if a user today types `"8:07-8:22"`, the `:07`/`:22` are matched by the regex but silently thrown away** — the resulting window is `{start: 8, end: 8}`, which then fails the `end > start` check and drops entirely (the second bug compounding the first: a well-intentioned precise entry produces a silently-dropped window, not a rounded one).

Confirmed downstream, **`normalizeMedication`** (**lines 285–289**):
```js
const windows = Array.isArray(original.windows) ? original.windows.map((window, windowIndex) => ({
  start: Math.max(0, Math.min(23, Number(window.start) || 0)),
  end: Math.max(1, Math.min(24, Number(window.end) || 24)),
  name: String(window.name || ('Window ' + (windowIndex + 1)))
})).filter(window => window.end > window.start).sort((a, b) => a.start - b.start) : [];
```
`start`/`end` are plain JS numbers, not strings, not minutes-since-midnight, not "HH:MM". Every existing saved window has an **integer** value 0–24 representing a whole hour. `Number()`/`Math.max`/`Math.min` here don't themselves reject a fractional value — they were just never fed one, because nothing upstream today ever produces one.

**Consequence for the 15-minute-interval feature**: this is not "already minute-precision, just verify the format" — it is **whole-hour-only today**, and multiple downstream consumers actively assume that. Two are real landmines that must be fixed as part of this feature, not just the input UI:

1. **`hourTs(d0, hour)`, line 622**: `const d = new Date(d0); d.setHours(hour, 0, 0, 0); return d.getTime();` — `Date.setHours()` truncates a fractional first argument (verified: `setHours(8.25, 0, 0, 0)` → `08:00:00`, not `08:15:00`). If `windows[i].start` becomes `8.25` (8:15) under a decimal-hours model, `hourTs` **silently rounds it down to the top of the hour**. `hourTs` is used by `missedDosesFor` (**lines 637–638**, computing `win.ws`/`win.we`/`win.nextStart`) — every missed-dose determination for a 15-minute-precision window would be computed against the wrong (rounded-down) boundary.
2. **`dueRemindersAt(nowDate)`, line 3851**: `if (h !== w.start || m >= 5) return;` where `h = nowDate.getHours()` (always an integer 0–23). If `w.start` is `8.25`, this comparison is **never true** — the reminder for that window would simply never fire, for any window not starting exactly on the hour. This is the generic per-medication reminder engine (real, shipped, id-agnostic since v16) — see also `checkNotifications()`/`sendNotif()`, **lines 3867–3879**.
3. **`normalizeMedication`'s own clamp has a second, independent bug that will bite the moment 15-minute values exist**: `Math.min(23, Number(window.start) || 0)` clamps any start ≥ 23 down to exactly `23`. A legitimate 15-minute-granular start of `23.75` (11:45 PM) would be silently truncated to `23` (11:00 PM) on every save/load round-trip through `normalizeMedication` — a second, independent silent-data-loss bug, this one in existing "safety net" code, not the parser. **Must be fixed to `Math.min(23.75, ...)`** (or better, drop the artificial ceiling and rely on the `end > start` / `end <= 24` checks) as part of this feature.

Functions confirmed to be **already safe** for fractional hours (arithmetic multiplication, not `setHours`):
- `status(med)`'s `atH = (h) => d0 + h * 3600000` (**line 796**) — used for the live lock/unlock countdown shown on the Home card ("Opens {time}"). Fractional hours multiply correctly; `0.25 * 3600000 = 900000` exactly (quarter-hour fractions are dyadic — exactly representable in IEEE-754 double, zero floating-point precision risk for 15-minute steps specifically).
- `isEarlyAt(med, ts)` (**line 499**): `ts < d0 + med.windows[0].start * 3600000` — same safe pattern.
- `dueRemindersAt`'s own window-open/close math (**line 3859**): `const ws = d0 + w.start * 3600000, we = d0 + w.end * 3600000;` — safe; only the **gating comparison** at line 3851 (`h !== w.start`) is broken, not the timestamp math a few lines later.

**Net finding for point 2 of the investigation ask ("blast radius of 15-minute granularity"):** nothing about *days* is affected (treatment-day fields are untouched, separate code path). Within *time-of-day* windows specifically, the blast radius is real but narrow and enumerable: `hourTs()` (1 function, used by `missedDosesFor`), `dueRemindersAt`'s hour-equality gate (1 line), and `normalizeMedication`'s start-clamp ceiling (1 line). All three are small, mechanical fixes — not a redesign — but they are **required changes**, not optional polish, or missed doses will be computed against the wrong boundary and reminders will silently stop firing for any non-hour-aligned window.

### Every consumer of `med.windows` (full blast radius — confirmed by grep across the whole file)

| Location | Line(s) | Reads `windows` how | Needs a code change for 15-min? |
|---|---|---|---|
| `deepCopyMeds` | 263–269 | Structural clone (`{...window}`) | No — shape-agnostic |
| `normalizeMedication` | 276–324 (windows block 285–289; default fallback 322) | Clamps/sorts/filters; defaults to `[{start:0,end:24,name:'Daily'}]` if empty | **Yes** — fix the `23` start-clamp ceiling (see above) |
| `isEarlyAt` | 492–500 (window read at 499) | `med.windows[0].start * 3600000` | No — already fractional-safe |
| `dexWindowsForOffset` | 590 | Returns hardcoded `{start,end}` for the legacy Dexamethasone id only | No — out of scope, id-gated, do not touch |
| `hourTs` | 622 | `setHours(hour,0,0,0)` | **Yes** — must stop truncating fractional hours |
| `missedDosesFor` | 625–660 (windows read 630, 633; `hourTs` calls 637–638) | Builds each window's open/close/next-start via `hourTs`, matches unused day-entries against them | Indirectly, via the `hourTs` fix above |
| `doseProgressToday` | 665–677 (windows read 668, 671) | Counts scheduled windows vs. logged doses per day | No — only reads `.length`, no hour math |
| `eveningWindowsFor` / `morningWindowsFor` | 729–736 / 750–757 | Protonix-linked Iron/Buspirone/Paroxetine dynamic window override; falls back to `med.windows` unmodified | No — pass-through fallback only, and these are id-gated (`eveningLinkedToProtonix`/`morningLinkedToProtonix`) legacy-family logic, out of scope |
| `status(med)` | 759–812 (windows read 797; `atH` helper 796; loop 798–811) | Live lock/unlock + "Opens {time}" countdown | No — already fractional-safe (`atH`) |
| `renderGroupedMedsCard` | 1569–1621 | Never reads `.windows` directly — calls `status(med)` and `fmtTime(st.availableAt)`, both already timestamp-based | No |
| Home Quick Log cards (`medCards`) | uses `status(med)` same as above | Same as `status()` | No |
| `formatRuleSummary` (Meds-tab one-line summary) | 2733–2749 (windows read 2741–2742) | `formatHour(window.start) + '–' + formatHour(window.end)` when no `window.name` | **Yes** — `formatHour` (below) needs to display minutes |
| `formatHour` | 2751–2755 | `(h > 12 ? h-12 : h) + (h>=12?' PM':' AM')` — whole hours only, no minute formatting at all | **Yes** — must be extended (or replaced by a new `formatWindowTime` that keeps `formatHour`'s exact output for on-the-hour values, so existing whole-hour meds' summary text is byte-identical) |
| `medicationFormFrom` | 2761–2790 (windowsText build 2771) | Builds the OLD free-text field's initial value from `windows` for editing | **Superseded** — this reverse-serialization goes away; replaced by the new form's per-row prefill (see §4) |
| `saveMedicationEditor` | 2861–2929 (parse 2869, validate 2870, assign 2906, delete-if-not-win 2921) | Calls `parseScheduleWindows(form.windowsText)`, validates non-empty, assigns to `candidate.windows` | **Yes** — `parseScheduleWindows`/`windowsText` path replaced by reading the new structured row state directly into a `windows` array (still validated non-empty for `type==='win'`, same toast copy pattern) |
| `dueRemindersAt` | 3841–3865 (windows read 3847, 3850; hour-gate 3851; key 3856; timestamps 3859) | Per-medication reminder firing | **Yes** — fix the `h !== w.start` integer-only gate |
| `checkNotifications` / `sendNotif` | 3867–3879 | Consumes `dueRemindersAt`'s output; only touches `window.name`/`.start`/`.end` for notification copy/key strings | No direct fix, but inherits correctness from the `dueRemindersAt` fix |

**Confirmed**: the on-disk **shape** of a `windows` entry (`{start: number, end: number, name: string}`) does not need to change. Only the **precision** of `start`/`end` (integer hours → quarter-hour decimals) and the handful of call sites above that assume integer hours.

---

## 2. Data model recommendation for 15-minute precision

### Recommended: decimal hours, quarter-hour steps (`8.25` = 8:15 AM, `20.5` = 8:30 PM)
- **Zero migration for existing data.** Every currently-saved window (`start`/`end` as whole-hour integers 0–24) is already a valid value in this scheme — an integer is just the `.0` case of a decimal hour. No conversion pass, no schema-version bump, no new key.
- **No floating-point risk specific to this granularity.** 15 minutes = exactly `0.25` hours; the four possible fractional values per hour (`.0`, `.25`, `.5`, `.75`) are all dyadic (powers of two in the denominator) and therefore exactly representable in IEEE-754 double — confirmed (`0.25 * 3600000 = 900000` exactly, no rounding error accumulates through `*3600000` arithmetic or repeated saves).
- Every existing consumer that does `w.start * 3600000` arithmetic (the `atH` pattern) already works unmodified. Only `hourTs` (uses `setHours`) needs a fix — and that fix is small and mechanical: split the decimal into whole hour + minute before calling `setHours`, e.g. `d.setHours(Math.trunc(hour), Math.round((hour % 1) * 60), 0, 0)` — preserving `hourTs`'s existing DST-safety (calendar-based `setHours`, not raw millisecond addition — see the "DST-safe helpers" comment at line 621) rather than switching to raw arithmetic, which would reintroduce a DST bug this function was deliberately written to avoid.

### Alternative considered: minutes-since-midnight integers (`0`–`1440`)
- Pros: avoids any theoretical float concern, integer math throughout, a more conventional representation.
- Cons: **not zero-migration** — every existing saved value (`8`, `20`, `24`, etc., meaning hours) would need to be reinterpreted as minutes, requiring an explicit one-time conversion (`hours * 60`) inside `normalizeMedication` gated on a schema flag or a heuristic ("if this looks like an hour, not minutes"), which is exactly the kind of ambiguous, error-prone migration the decimal-hours approach avoids entirely. Also requires touching every `* 3600000` call site to become `* 60000` instead — a strictly larger, riskier diff than the decimal approach for a benefit (float safety) this specific case doesn't need, since quarter-hour decimals have no float risk to begin with.
- **Not recommended** given the zero-migration constraint the task explicitly calls out, but flagged since it's the more "obviously correct-looking" choice to a fresh reader and should not be picked without knowing this tradeoff.

### Alternative considered: `"HH:MM"` strings
- Pros: human-readable in raw storage/devtools.
- Cons: every arithmetic consumer (`atH`, `hourTs`, `dueRemindersAt`'s timestamp math) would need a parse step first; larger diff than decimal-hours for no behavioral benefit; also not zero-migration (existing values are numbers, not strings — `normalizeMedication`'s `Number(window.start)` coercion would need to become a time-string parser). **Not recommended.**

**Recommendation: decimal hours.** Smallest diff, zero migration, exact arithmetic for this specific granularity, and it's a strict superset of the current format (every existing value is already valid under it).

---

## 3. UI design

### Established pattern to match
Native `<select>` is already the app's idiom for every enumerated-choice field: temp/weight unit (line 3247/3249), Schedule type (line 3043), Days-taken mode (line 3047), Limit unit (line 3070), symptom type (line 2026), pain level (line 2098), bowel/appetite quick-select (lines 2283/2320/2356) — all styled identically (`minHeight: 43-52px`, `border: 1px solid rgba(212,104,138,0.2-0.22)`, `borderRadius: 11-13px`). **Recommendation: native `<select>` for both Start and End**, styled identically to the existing `form.type`/`form.scheduleMode` selects at lines 3043/3047, populated with 15-minute-interval `<option>`s.

**Alternative considered and rejected as primary: `<input type="time" step="900">`.** The app already uses native time inputs elsewhere (in-patient start/end at lines 2058/2075, single dose-log time at line 2093) — a real precedent, and worth naming since it's the more "native-feeling" mobile picker (OS wheel/clock UI). Rejected as the primary choice specifically because Aaron's own locked-in spec says "dropdown" and gives 15-minute-interval example values explicitly — and critically, `step="900"` is **not reliably enforced by every mobile browser's native time-picker UI** (behavior varies by OS/browser version whether the minute wheel actually snaps to 15-minute increments or allows any minute with silent rounding on blur). For an elderly/non-tech-savvy audience, a `<select>` with exactly 96 unambiguous options is more predictable and matches what Aaron described seeing/wanting. Note this as available if Aaron later wants a more native mobile feel; not recommended as the initial implementation given his explicit wording.

### Option list generation
- **Start**: 96 options, `00:00` through `23:45` in 15-minute steps (`value` = decimal hour `0, 0.25, 0.5, ... 23.75`; label = 12-hour format, e.g. `12:00 AM`, `8:15 AM`, `11:45 PM`).
- **End**: 97 options — the same 96, **plus a 97th "Midnight" option at `value=24`** (label e.g. `Midnight (12:00 AM)`), since the existing model already uses `end: 24` to mean "through the end of the day" (see the default fallback in `normalizeMedication`, line 322: `{start:0, end:24, name:'Daily'}`, and Dexamethasone's window shape at line 590). Without this 97th option, a full-day or late-night window (e.g. today's default "8 AM–8 PM Daily" pattern, or a window that should run to midnight) becomes unrepresentable in the new picker. This is a genuinely new requirement the free-text field's `\d{1,2}` regex handled implicitly (`24` parsed as a valid end hour) that the dropdown's option list must handle explicitly.
- Reuse `formatHour`-style 12-hour label formatting (extend `formatHour` itself, or add a sibling `formatQuarterHour(decimalHour)` that falls back to `formatHour`'s exact output for whole-hour values — needed anyway per the blast-radius table above for `formatRuleSummary`, line 2742).

### Repeatable rows, label field, live preview
- **No exact existing precedent for "add/remove array-of-form-rows" inside this editor** — the closest structural cousins are the weekday multi-select (toggle buttons, lines 3061–3066, not row-based) and the two-step "Remove" confirm pattern used for medications (lines 3141–3143) and journal entries (lines 2144–2150, timeout-based confirm). This is legitimately new UI, but should borrow the app's existing visual vocabulary rather than invent new chrome:
  - Each row: two `<select>`s (Start/End, styled like line 3043) + one `formInput` (line 3024) for the optional label, placeholder `"e.g. Morning, With breakfast"` + a remove control. Use the same 44px-minimum tap target / hairline-border card language as the rest of the editor (`border: 1px solid rgba(212,104,138,0.22)`, `borderRadius: 11px`).
  - Remove control: a small icon button reusing `appIcon('trash', 16)` (already used for medication delete, line 3143) rather than a bare "×", for consistency and touch-target size; no confirm-step needed for removing a single time-window row (low-stakes, easily re-added, unlike deleting an entire medication).
  - "Add another time window" — a full-width secondary button below the last row, same visual weight as other secondary actions in this screen (e.g. "Discard" button style, line 3096) — not primary/pink, to avoid competing with "Add medication"/"Save changes".
  - **Live plain-language preview line** per row (not just one summary at the bottom): e.g. "Reminds between 8:00 AM and 8:30 AM" — reuses `formatHour`/the new minute-aware formatter, computed live off the row's current Start/End `<select>` values on every change (no separate "Preview" button/state needed — it's a pure function of the row's current values, same as how `clampTreatmentDays` already drives a live "Active window: N days..." summary line at line 3093 for the treatment-day fields — good existing precedent for this exact interaction: **compute-and-render inline on every keystroke/selection, don't gate behind a submit**).
  - If a row has a custom label, show it in the preview instead of/alongside the plain-language time range (e.g. "Morning — Reminds between 8:00 AM and 8:30 AM"), matching how `windowName`/`window.name` already takes priority over the formatted time range in `formatRuleSummary` today (line 2742: `window.name || (formatHour...)`).

### Validation
- **End must be after Start, per row.** Recommend disabling/graying out End options ≤ the row's current Start value in that row's own `<select>` (matches the `end > start` invariant already enforced in `parseScheduleWindows` line 2825 and `normalizeMedication` line 289) — catches the error at selection time rather than at save time, which is strictly better than today's free-text field (which only rejects at save, via `saveMedicationEditor`'s toast, and only when the *entire* list is empty). If disabling options is judged too fiddly to implement well, a save-time inline error under the specific offending row (not just the current generic toast) is the fallback — either way, a **per-row, specific** error is better than today's field-level generic toast.
- **Overlapping windows**: the current codebase has **no overlap validation at all** today (`parseScheduleWindows`/`normalizeMedication` accept and independently store overlapping windows; `missedDosesFor`'s "first claim wins" logic at lines 640–651 already has a documented strategy for handling ambiguity between adjacent/nearby windows — see the comment at lines 640–647). **Recommendation: do not add new overlap-blocking validation in this pass** — it's not something Aaron asked for, existing multi-window meds (e.g. Dexamethasone's Morning/Afternoon split, `dexWindowsForOffset` line 590) already coexist fine without it, and inventing new save-blocking validation the free-text field never had risks blocking a legitimate edit case (e.g. a deliberately-overlapping catch-up window) that isn't this feature's problem to solve. If Aaron wants a soft warning (not a block) for genuinely identical/overlapping rows, that's a small addition, but treat as optional, not required for done.
- **Minimum viable state — at least one row is required, matching today's behavior exactly.** Confirmed at `saveMedicationEditor` line 2870: `if (type === 'win' && !windows.length) { setToast(...); return; }` — this check is **independent of `scheduleDays.mode`**. Even a medication whose Days-taken mode is `'asneeded'` (line 2877: `scheduleDays = {mode:'asneeded'}`) still requires `type==='win'` medications to have ≥1 window, because `windows` also drives the daily lock/unlock time via `status()` (line 797) — `scheduleDays.mode==='asneeded'` only suppresses *missed-dose alerting* (`normalizeMedication` line 297: `alerts: type==='win' && !(scheduleDays.mode==='asneeded')`), it does not make `windows` optional. **The new UI must keep this same minimum-one-row requirement** — do not relax it, and do not add a "zero windows allowed" state for `type==='win'` meds; that would be a behavior change beyond what was asked. (An "as needed" medication that genuinely wants no time-of-day structure at all should use `type: 'gap'` — the existing, separate schedule-type choice — not `type:'win'` with zero windows.)

---

## 4. Migration plan for existing free-text-derived schedules

- **No storage migration needed** — per §2, existing `windows` entries (integer `start`/`end`) are already valid values under the decimal-hours model. `normalizeMedication` needs no new migration branch for the `windows` array itself (contrast with, e.g., the real `chemoOnly → treatmentOnly` migration at lines 302–309, which *is* a shape change — this is not that).
- **Editor prefill**: today, `medicationFormFrom` (line 2771) serializes `windows` back into `windowsText` for the free-text field. This reverse-serialization is replaced: the new form's row state should be initialized directly from `med.windows` (one row per array entry, `start`/`end` copied as-is into each row's Start/End `<select>` value, `name` into the label input) — no string round-trip needed at all, which actually **removes** a class of bug (the old round-trip already had one: `windowsText` used `formatHour`, which is lossy for non-whole hours — irrelevant today since none exist, but would have been a live landmine had free-text minute support ever shipped).
- **Existing values are guaranteed to already land on a 15-minute boundary** (they're whole hours, and whole hours are a subset of 15-minute steps), so **the "not on a 15-minute boundary" edge case does not exist for any data this app has ever been able to produce** — `parseScheduleWindows` has never been able to save a non-whole-hour value (confirmed in §1: the regex discards minutes entirely). This means the task's anticipated question ("what happens if an existing window's start/end is NOT on a 15-minute boundary, e.g. someone typed 8:07") **cannot occur from any data this specific app has ever saved.**
  - The only way an off-boundary value could theoretically exist is direct `localStorage` tampering (devtools) or a future non-UI writer — both outside this feature's normal use. **Recommendation (defense-in-depth only, not a required user-facing flow): if a loaded window's `start`/`end` doesn't exactly match one of the 96/97 dropdown option values, round to the nearest 15-minute step when populating the row** (simple `Math.round(value * 4) / 4`), rather than crashing or silently omitting the row. This should be a quiet, one-line normalization at prefill time — not a modal warning — since it is expected to affect zero real users' data. Do **not** silently rewrite the stored value until the user actually saves the form (consistent with how every other editor field in this app works — nothing persists until "Save changes"/"Add medication" is pressed).
- **This must not silently corrupt any existing medication's schedule on next edit**: confirmed achievable because (a) no shape change, (b) no value-range change (existing values are a strict subset of the new value space), (c) the round-trip through the row UI back to `saveMedicationEditor`'s `windows` assignment (line 2906) preserves `start`/`end`/`name` exactly for any medication whose rows aren't touched by the user. The one behavior change to watch in QA: a medication with a window `name` of `''`/falsy today displays as `'Window ' + (index+1)` in `normalizeMedication`'s fallback (line 288) and `parseScheduleWindows`'s fallback (line 2825) — confirm the new row UI's empty-label handling produces the same fallback naming, not a blank label, so existing unnamed windows don't regress to looking unlabeled in the summary line.

---

## 5. Open questions for Aaron

None that block starting implementation — the spec is concrete (exact granularity, dropdown mechanism, label field, live preview are all explicitly given) and the data-model/migration questions the task anticipated (off-boundary values, zero-vs-migration) resolve cleanly from investigation rather than needing a product decision, per §4. Two are worth a one-line confirmation from Aaron during implementation review, not before starting:

1. **End-time "Midnight" option (§3)**: confirm the label `"Midnight (12:00 AM)"` (or similar) is clear for a non-technical user as "end of day," versus confusing it with `12:00 AM` at the *start* of the same calendar day. This is a copy nuance, not a design gap — flagging so Designer stage checks it specifically rather than it slipping through as "just another dropdown option."
2. **Overlap validation (§3)**: confirmed no blocking validation is being added since none exists today and none was requested — flagging only so this is a documented decision, not a silent omission, in case Aaron's mental model of "the new picker prevents mistakes" implicitly assumed overlap-blocking too.

---

## Definition of done

- [ ] `windowsText` free-text `<input>` (line 3068) removed from the medication editor for `type==='win'`; replaced with a repeatable list of Start `<select>` / End `<select>` / optional label `formInput` rows, each with a "Remove" control, plus an "Add another time window" button.
- [ ] Start options: 96 entries, `12:00 AM` through `11:45 PM` in 15-minute steps. End options: 97 entries (the same 96, plus `Midnight`/`24:00`). Both styled to match the existing `form.type`/`form.scheduleMode` `<select>`s (line 3043/3047).
- [ ] A row's End `<select>` cannot select a value ≤ that row's own current Start value (disabled options, or an immediate inline per-row error if disabling is impractical) — strictly better than today's save-time-only, whole-list-only validation.
- [ ] Live plain-language preview per row (e.g. "Reminds between 8:00 AM and 8:30 AM"), recomputed on every Start/End/label change, no separate preview button/step — matches the existing "Active window: N days..." live-summary precedent (line 3093).
- [ ] At least one row is required to save a `type==='win'` medication, in every `scheduleDays.mode` including `'asneeded'` — unchanged from today's `saveMedicationEditor` behavior (line 2870); the new UI blocks/toasts the same way for zero rows.
- [ ] `saveMedicationEditor` builds `windows` directly from row state (no `parseScheduleWindows`/`windowsText` round-trip); `windows` entries keep the exact `{start, end, name}` shape.
- [ ] `normalizeMedication`'s start-clamp ceiling fixed from `Math.min(23, ...)` to `Math.min(23.75, ...)` (or the ceiling removed in favor of the existing `end > start` / `end <= 24` checks) — required before any 15-minute-granular start in the last hour of the day can be saved without silent truncation.
- [ ] `hourTs(d0, hour)` (line 622) fixed to preserve fractional hours (split into whole-hour + minute before `setHours`), keeping its existing DST-safe `setHours`-based approach — not replaced with raw millisecond arithmetic. Verified: `missedDosesFor`'s window open/close/next-start math (lines 637–638) produces minute-accurate boundaries for a 15-minute-granular window.
- [ ] `dueRemindersAt`'s hour-only gate (line 3851: `h !== w.start`) fixed to compare both hour and minute against a fractional `w.start` (e.g. compare `nowDate` against the window's actual start timestamp, or derive hour/minute from `w.start` directly) — verified a reminder fires correctly for a window starting at `:15`/`:30`/`:45`, not just `:00`.
- [ ] `formatHour` (line 2751) extended (or a sibling formatter added) to render minutes when non-zero, with byte-identical output to today's `formatHour` for on-the-hour values — verified in `formatRuleSummary`'s window-range display (line 2742) for both a legacy whole-hour medication and a new 15-minute-granular one.
- [ ] Editor prefill: existing `med.windows` load directly into rows (no string round-trip); any (currently-impossible, defense-in-depth-only) off-15-minute-boundary stored value rounds to the nearest option at prefill without erroring or blocking the row from displaying.
- [ ] Regression check: a pre-existing medication with whole-hour windows (e.g. Dexamethasone-style Morning/Afternoon, or any user-created scheduled medication saved before this change) loads into the new picker with the correct pre-filled rows, saves back byte-identical in `start`/`end`/`name`, and its Home card, missed-dose banner, dose-progress ring, and reminders all behave identically to before this change.
- [ ] New regression check: a medication with a genuinely 15-minute-granular window (e.g. `8:15 AM–8:45 AM`) correctly locks/unlocks on the Home card at the right minute (`status()`), flags as missed at the right minute if unlogged (`missedDosesFor`), counts correctly in the dose-progress ring (`doseProgressToday`), and fires its reminder in the correct 5-minute window, not the top of the hour (`dueRemindersAt`).
- [ ] `RESERVED_LEGACY_MED_IDS`-gated logic (`dexWindowsForOffset`, `eveningWindowsFor`, `morningWindowsFor` — lines 590, 729, 750) confirmed untouched; these remain hardcoded/id-gated and are out of scope for this feature.
- [ ] `node --check index.html` clean.
- [ ] `TEST_MODE` remains `true` in the committed file (per `APP_CLAUDE.md` rule 4).
- [ ] Mobile-first manual QA at 360×740 and 390×844, including keyboard-open heights, per `TEAM.md`'s binding MOBILE FIRST rule — multi-row picker with several rows must remain fully reachable/tappable on a small screen, not just desktop-tested.
