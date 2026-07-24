# DEV BRIEF v12b — Units switch mislabels stored readings (QA_USER_ZERO_v12 Blocker 1)

**Role:** Developer (Stage 1, Quality Chain) — restart per TEAM.md restart rule
**Date:** 2026-07-24
**Severity:** HIGH — medical-display correctness (false fever styling on Home)
**Scope file:** `index.html` (single-file app, all line numbers below refer to it at v12, `APP_VERSION = 'app-v12'` L2975; `sw.js` CACHE currently `chemowell-app-v12`)

---

## 1. Why the previous state is wrong (defect anatomy)

QA reproduced: log 99.1 while in °F, log 148 while in lbs, then flip Settings units to °C/kg.

- Home Temperature card renders the stored raw number with the *current* unit suffix: `lastTemp.temp + tempSuffix()` (L2350) → **"99.1°C"**.
- Fever styling compares the stored raw number against the *current-unit* threshold: `lastTemp.temp >= tempFever()` where `tempFever()` returns 38.0 in °C mode (L2277, L405) → 99.1 ≥ 38.0 → **red/amber fever styling on a normal reading**.
- Home Weight card: `lastWeight.weight + ' ' + weightSuffix()` (L2364) → **"148 kg"**.
- Meanwhile the journal/history render the entry's frozen `dose` **string** ("99.1 °F") captured at log time (L2585, L3227) → the same reading shows two different units in two places.

Root cause: readings are stored as **raw numbers with no unit field**; every live display glues on the *current* preference's suffix and compares against the *current* preference's threshold. Nothing converts, and nothing remembers which unit the number was entered in — except, luckily, the `dose` display string.

---

## 2. How readings are stored today (entry shape)

Storage: `localStorage` key `chemowell-app-entries-v1`, plain array via `addEntryDB` (L123–129, adds generated `id`). Prefs: `chemowell-app-prefs-v1` (L136–146).

| Reading | Created at | Entry shape | Unit captured? |
|---|---|---|---|
| Temperature | `confirmTimeAndLog` L844–850 | `{ medId:'temp', temp: v, dose: v + ' ' + tempSuffix(), mg:0, ts }` | Only inside the `dose` string ("99.1 °F") — no structured field |
| Weight | L851–856 | `{ medId:'weight', weight: v, dose: v + ' ' + weightSuffix(), mg:0, ts }` | Only inside `dose` (" lbs" / " kg") |
| Blood pressure | `logBloodPressure` L802–810 | `{ medId:'blood_pressure', sys, dia, dose: sys+'/'+dia+' mmHg', mg:0, ts }` | N/A — mmHg always, unit-independent |

Input flow: `logTemp` (L783–788) validates `0 < v <= 120` (NOT unit-aware) then opens the confirm sheet; `logWeight` (L812–817) validates `0 < v <= 999`. The number the user typed is interpreted as whatever unit is currently selected — correctly stamped into `dose`, but the numeric `temp`/`weight` field is unit-naked.

## 3. CONFIG and the Settings switch

- `CONFIG` defaults L338: `{ ..., tempUnit: 'Fahrenheit', weightUnit: 'lbs' }`.
- Loaded from prefs in `subscribePrefs` callback L3722–3728: `CONFIG.tempUnit = prefs.tempUnit === 'Celsius' ? 'Celsius' : 'Fahrenheit'` (L3724), `CONFIG.weightUnit = prefs.weightUnit === 'kg' ? 'kg' : 'lbs'` (L3725).
- Settings selects L3040 (temp) and L3042 (weight) call `setPrefsDB({tempUnit|weightUnit})` → prefsListener fires synchronously → CONFIG mutates → next render (1-second loop L3741–3750 or `setState`) repaints everything with the new suffix/threshold. **Nothing else changes** — no data migration, no conversion. The Settings caption L3044 ("Units label new readings — existing readings keep the numbers you entered") describes storage truthfully but the Home card contradicts it visually.
- Unit helpers: `tempSuffix()` L404, `tempFever()` L405 (38.0 °C / 100.4 °F), `tempHigh()` L406 (39.4 °C / 103 °F), `weightSuffix()` L339, `tempDefault()` placeholder L782 ('36.9' / '98.5'), `weightDefault()` L801 (**returns latest raw stored number regardless of unit** — placeholder bug in kg mode), weight placeholder fallback L2367 ('68.0' / '150.0', already unit-aware).

## 4. Every display site for temp/weight and how it decides its unit

**Temperature**
| Site | Line | Current behavior | Broken after unit flip? |
|---|---|---|---|
| Home card value | 2350 | raw `temp` + `tempSuffix()` | **YES (the bug)** |
| Home card fever/high color | 2277 | raw `temp` vs `tempFever()`/`tempHigh()` in current unit | **YES (the bug)** |
| Confirm-sheet title | 1868 | `m.tempValue + tempSuffix()` — value just typed in current unit | No (fresh value) |
| Log toast | 850 | typed value + current suffix | No (fresh value) |
| Today's journal row | 2585 | frozen `e.dose` string | Truthful but inconsistent with Home (two units, one reading) |
| History report row | 3227 | frozen `e.dose` string | Same inconsistency |
| History day summary | 3161/3167 | count only ("2 temps") | No |

There is **no temperature report/chart** in `reportDescriptor` (L3090+) — only history/weight/BP/cycle/bowel/appetite. No temp notifications; `afterLog` (L728) and `checkNotifications` (L~3660+) never touch temp.

**Weight**
| Site | Line | Current behavior | Broken after unit flip? |
|---|---|---|---|
| Home card value | 2364 | raw `weight` + `weightSuffix()` | **YES** |
| Input placeholder | 801 (+2367) | raw latest number, no unit conversion | **YES** (shows 148 as the suggested kg value) |
| Confirm-sheet title | 1874 | fresh value + current suffix | No |
| Log toast | 856 | fresh value + current suffix | No |
| Reports hub tile meta | 3093 | raw `weight` + `weightSuffix()` ("148 lbs latest") | **YES** |
| Weight trend chart (`renderWeightTrend` L3394–3557): points/bounds L3395/3416/3423–3427, y-axis labels L3459/3485, last-dot label L3502, header current L3514, Current stat L3523, Average L3527/3478, Change L3475–3476, readings list L3545 | all raw numbers; suffixes from `weightSuffix()` at 3476/3514/3545 | **YES** — and with mixed-unit logging the axis/average/change math silently mixes lbs and kg numbers |
| Daily weight check-in card | 2238–2249 | text only, no value | No |
| Today's journal / History rows | 2585 / 3227 | frozen `e.dose` | Inconsistent with Home |

**Blood pressure**: L802–810 (log), L3082 (report rows), L3091 (hub meta) — always mmHg, no unit dependency. Regression-verify only.

---

## 5. Landmines (per TEAM.md Developer duties)

1. **1-second full re-render loop** (L3741–3750): all conversion must be pure, cheap render-time math. No caching, no DOM refs.
2. **Frozen `dose` strings are the only unit record for existing data.** Every temp/weight entry ever written by this code path has a suffix in `dose` (" °F"/" °C" via L847; " lbs"/" kg" via L853). This is a reliable read-time unit oracle for legacy entries.
3. **Do NOT rewrite stored entries in a migration.** A lossy/buggy one-time rewrite of medical history is the highest-risk move available here; read-time inference is idempotent and reversible.
4. `subscribeEntries` defers updates while `timeModal` is open (L3731–3736) — irrelevant to render-time conversion, but don't add anything that writes entries on unit change.
5. Rounding drift: any design that converts on *write* (storage canonicalization) invites 148 → 67.1 → 147.9 ping-pong. Convert on *read only*, from the untouched stored number, and the original mode always displays the exact entered value.
6. Release mechanics: bump `APP_VERSION` (L2975), bump `sw.js` CACHE (currently `chemowell-app-v12`), README version row.
7. `logTemp` bound `v <= 120` (L786) accepts 98.5 typed while in °C mode — wrong-unit entry guard is a real adjacent risk (see optional hardening).

---

## 6. Options considered

### (a) Store unit per reading; always display in the reading's own unit
Truthful, no conversion math. **Rejected as primary fix:** mixed-unit history makes the weight chart/average/change nonsense (148 and 67.2 on one axis), the Home card ignores the user's chosen unit (a °C user still sees °F), and the planned fever-alert feature would need per-reading threshold logic anyway. It fixes the lie but not the product.

### (b) Canonical internal unit (°F/lbs), convert on write and read
Uniform display, but requires a one-time storage migration (entries logged in °C mode hold raw Celsius numbers — must detect via `dose` suffix and rewrite), converts user-entered numbers on write (record no longer matches what the user typed; rounding drift), and contradicts the current Settings promise. Migration of medical data = highest-risk option.

### (c) RECOMMENDED — Hybrid: store value + unit as entered; convert at display time to the current setting
- **Storage stays truthful**: entry keeps the exact number the user typed plus a new structured `unit` field stamped at log time. Legacy entries (no `unit`) get their unit inferred at read time from the `dose` suffix (fallback: temp > 45 → Fahrenheit; weight → lbs, the shipped default). No storage rewrite ever.
- **Display is uniform**: every surface converts the reading to the current CONFIG unit and rounds to 1 decimal. One reading, one unit, everywhere — Home, journal, history, reports, chart, placeholder.
- **Thresholds are safe**: fever/high styling compares the **rounded displayed value** against the threshold **in the display unit** (100.4/103 °F; 38.0/39.4 °C). The color can never contradict the number on screen. 38.0 °C ↔ 100.4 °F is exact, so the fever boundary is identical in both modes. (Known approximation: 103 °F ↔ 39.4 °C differ by ~0.09 °F at the "high" tier; 39.4 is the standard clinical value — keep it, document it.)
- **Future fever-alert feature**: alert logic gets a single canonical helper (`tempAsF(entry)` or `tempAsC(entry)`) so alerts fire identically regardless of display mode.

Conversions (exact): °C→°F `c*9/5+32`; °F→°C `(f-32)*5/9`; kg = lbs × 0.45359237; display rounding `Math.round(x*10)/10`. Original-unit display round-trips exactly because the stored number is never touched.

## 7. Implementation site list (hybrid (c)) — all in `index.html`

**New helpers (place near L404):**
- `entryTempUnit(e)` → `e.unit || (e.dose && e.dose.indexOf('°C') !== -1 ? 'Celsius' : 'Fahrenheit')`
- `entryWeightUnit(e)` → `e.unit || (e.dose && /kg\s*$/.test(e.dose) ? 'kg' : 'lbs')`
- `dispTemp(e)` → convert `e.temp` from `entryTempUnit(e)` to `CONFIG.tempUnit`, round 1 decimal
- `dispWeight(e)` → same for weight
- (for the fever-alert roadmap) `tempAsC(e)` canonical accessor

**Write sites (stamp the unit):**
1. L847 — temp entry: add `unit: CONFIG.tempUnit`
2. L853 — weight entry: add `unit: CONFIG.weightUnit`

**Display/threshold sites (convert):**
3. L2277 — fever color: compare `dispTemp(lastTemp)` (rounded, display-unit) to `tempFever()`/`tempHigh()`
4. L2350 — Home temp value: `dispTemp(lastTemp) + tempSuffix()`
5. L2364 — Home weight value: `dispWeight(lastWeight) + ' ' + weightSuffix()`
6. L801 — `weightDefault()` placeholder: return converted latest, not raw
7. L3093 — Reports hub weight meta: converted value
8. L3395/L3416 (`renderWeightTrend`) — map points to converted weights **once** at ingestion so ALL downstream math and labels inherit: bounds L3423–3427, y-labels L3459/3485, last-dot L3502, header L3514, Current L3523, Average L3478/3527, Change L3475–3476, readings list L3545
9. L2585 — Today's journal temp/weight rows: for `medId === 'temp' | 'weight'` render converted value + current suffix instead of frozen `e.dose` (other medIds keep `e.dose`)
10. L3227 — History report rows: same substitution
11. L3044 — Settings caption: rewrite to match new truth, e.g. "Readings convert automatically when you switch units — the numbers you entered stay saved as you typed them."

**Verified no-change (fresh values in current unit):** L1868, L1874 (confirm-sheet titles), L850, L856 (toasts), L782/L2353 + L2367 (temp placeholder / weight fallback — already unit-aware), L2238–2249 (weight check-in), all BP sites, L3161–3168 (count summaries).

**Optional hardening (recommend, small):** make `logTemp` bounds unit-aware (°C: 30–45, °F: 90–113, else "check the unit" toast) so a °F number typed in °C mode is caught at entry — the adjacent input-side version of this same bug class.

**Release mechanics:** bump `APP_VERSION` L2975 → `app-v12b` (or v13), bump `sw.js` CACHE, README row.

---

## 8. Done criteria + regression list (run in BOTH unit modes, mobile-first 390x844 + 360x740 + keyboard heights)

**Temperature**
1. °F mode: log 99.1 → Home "99.1°F" normal color; journal + history "99.1 °F"; toast "99.1 °F".
2. Switch to °C → Home "37.3°C" ((99.1−32)×5/9 = 37.28 → 37.3), **no fever styling**; journal + history also "37.3°C" — one unit everywhere.
3. Switch back to °F → exactly "99.1°F" again (no drift).
4. Boundary values: log 100.3°F → normal in °F; in °C shows 37.9°C normal. Log 100.4°F → fever (amber) in °F; in °C shows 38.0°C fever. Log 103.0°F → high (red); in °C shows 39.4°C red.
5. °C-mode logging: placeholder shows 36.9; log 38.0 → stored `{temp:38.0, unit:'Celsius', dose:'38 °C'...}`; Home "38.0°C" fever styling; switch to °F → "100.4°F" fever styling. Log 37.9°C → normal; in °F 100.2°F normal.
6. Legacy data: entry with no `unit` field and `dose:"99.1 °F"` (pre-fix storage) displays 37.3°C in °C mode, normal color.

**Weight**
7. Log 148 in lbs → switch to kg → "67.1 kg" (148×0.45359 = 67.13 → 67.1) on: Home card, input placeholder, Reports hub tile, chart header, last-dot label, Current/Average/Change stats, All Readings list, journal, history. Switch back → "148 lbs" exactly.
8. Mixed history: 148 (lbs) then switch to kg and log 67.2 → chart in kg plots 67.1 and 67.2 on a sane axis (no 67-vs-148 spike); in lbs plots 148 and 148.2; Change stat ≈ +0.1 kg / +0.2 lbs, 1-decimal rounding.
9. Daily weight check-in card behavior unchanged (fires on presence of a reading, any unit).

**Cross-cutting**
10. BP: log 118/76 → identical "118/76 mmHg" on Home, report, journal in both unit modes.
11. Confirm-sheet titles and toasts show the value just typed with the current unit in both modes.
12. Settings units caption reflects the new conversion behavior.
13. Flipping units repeatedly (F→C→F→C) causes no value drift anywhere (storage untouched — assert raw localStorage values unchanged).
14. Erase all data → welcome → re-log works in both modes.
15. Zero console/page errors; no horizontal overflow at 360/390 widths; keyboard-open heights re-checked on Home vitals inputs; desktop layout sanity last.
16. Node harness on the conversion + threshold helpers (all boundary pairs above), `node --check` NOT sufficient alone (v8b rule); version + sw cache + README bumped.
