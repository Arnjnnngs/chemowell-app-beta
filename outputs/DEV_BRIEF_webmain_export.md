# DEV BRIEF — CSV export + printable report for WEB-MAIN (`care-tracker`)

**Stage:** Developer (stage 1, Quality Chain). No code written. No repository file modified.
**Target:** `care-tracker` / WEB-MAIN, currently `caretracker-v42`, single file `index.html` (2,791 lines).
**Ships as:** `caretracker-v43`.
**Date:** 2026-08-14

---

## 0. Environment corrections — read this first

**The two web repos were not on disk.** `/home/claude/webmain` and `/home/claude/webbeta` do not exist in
this sandbox. Only `/home/claude/chemowell-app-beta` (APP-BETA) was present. I obtained read-only clones
from the origin the app-beta remote points at:

| Brief says | Reality | What I used |
|---|---|---|
| `/home/claude/webmain` | absent | `git clone https://github.com/Arnjnnngs/care-tracker.git` → `/tmp/webmain-ro` |
| `/home/claude/webbeta` | absent | `git clone https://github.com/Arnjnnngs/chemowell-beta.git` → `/tmp/webbeta-ro` |
| `/home/claude/chemowell-app-beta` | present | used in place |

`/tmp/webmain-ro` is at commit `9a7adb3` — *"v42: Full promotion from care-tracker-testing …"* — the tip of
`main`. **Every line number in this brief refers to `index.html` at that commit.** Whoever implements this
must re-confirm the anchors against their own working copy before editing; if their `webmain` is ahead of
`9a7adb3`, the anchors move.

Nothing was written to either clone. Nothing was written to any repo except this brief.

### What I could and could not verify by running code

**Could not verify (stated plainly):**
- WEB-MAIN never booted. It requires Firebase at `index.html:32-46` (project `fuelforge-7c132`) and the
  sandbox has no route to it. I did not point anything at her Firestore, at any point, in any form.
- Therefore: no verification of real document shapes in `caretracker_entries`, no verification of how many
  legacy/rogue-shaped documents exist in her actual history, and no end-to-end click-through of the feature.

**Could verify, offline, with fixtures I wrote by hand:**
- I built `/tmp/exportharness/harness.mjs`. It copies WEB-MAIN's real helpers **verbatim** (`nameOf`
  line 421, `BOWEL_MOVEMENT_LABELS` 781, `APPETITE_LABELS` 884, `SYMPTOM_TYPES` 923, `fmtTime` 413) and
  feeds them 17 fixture entries — one of every shape WEB-MAIN's own write sites construct. It runs a
  faithful port of APP-BETA's `buildExportRows()` against them. Results in §4 and §3 are from that run.
  **These are harness results on invented data, not results from her app.**
- I built `/tmp/exportharness/report.mjs` + `shot.mjs`, generating the proposed report from fixtures and
  rendering it in Chromium under `emulateMedia({media:'print'})`, plus a real Letter PDF. Zero console
  errors. The layout findings in §5 are from looking at that render.
- I served nothing over HTTP — I loaded via `file://`, so the port-8913 md5 check did not apply and no
  server was left running.

---

## 1. Verification of the three premises I was handed

### 1a. "All 18 entry fields are identical across WEB-MAIN and APP-BETA" — **the field list is wrong**

The list `dose, mg, ts, id, medId, note, pills, painLevel, symptomType, weight, value, missed, override,
target, currentTarget, freq, g, windowName` does not survive contact with the code. It looks like it came
from a grep for `e.<word>`, which swept up DOM event properties and prose.

| Field | Verdict |
|---|---|
| `target`, `currentTarget` | **Not entry fields.** DOM event props — `e.target.value` in input handlers (lines 1245, 1254, 1258, 1263, 1427), `e.target === e.currentTarget` in a backdrop click (1240). |
| `g` | **Not a field.** The literal string `e.g.` inside code comments (lines 308, 325, 333, 494, 501, 1833, 2044). |
| `missed`, `windowName` | **Not Firestore fields.** Synthesised in memory by `missedDosesFor()` at line **407**: `out.push({ missed:true, medId, ts:win.ws, windowName:win.w.name })`. Never written. See §3c — this matters a great deal. |
| `freq` | **Real but vestigial.** Read at 933 and rendered at 2389, but `logSymptom()` (926) never writes it. It exists only on symptom documents written by an older build. A backup must carry it. |
| `dose, mg, ts, id, medId, note, pills, painLevel, symptomType, weight, value, override` | Confirmed real. |

**Fields the list omits that WEB-MAIN actually writes:**

| Field | Written at | Note |
|---|---|---|
| `temp` | 646 — `{ medId:'temp', temp:v, dose:v+' '+suffix, mg:0, ts }` | Temperature is **`temp`, not `value`**. |
| `volumeMl` | 635 — `if (med.volumePerDoseMl) entry.volumeMl = ...` | Tylenol Liquid. Feeds the 90 mL/24h cap (335). |
| `loggedAt` | 610, 1664 | `chemo_date` only — wall-clock of when the schedule was set. |

And an APP-BETA/WEB-MAIN divergence that will bite a naive port: APP-BETA writes `unit: CONFIG.tempUnit`
on temperature entries (app-beta:1532); **WEB-MAIN does not**. WEB-MAIN's `CONFIG.tempUnit` is hardcoded
`'Fahrenheit'` (257). Any code doing `e.unit === 'Celsius' ? '°C' : '°F'` happens to produce the right
answer here by accident. Read the unit from `tempSuffix()` (283), not from the entry.

**Net: the shapes are close, but they are not identical, and the supplied list is not a safe spec.**
Build the exporter to pass through whatever it finds (§2, R4) rather than against an enumerated list.

### 1b. "The browser download path is what WEB-MAIN needs, and should be simpler" — **confirmed**

`nativeShareFile()` (app-beta:7905) is Capacitor `Filesystem`+`Share`. WEB-MAIN has no Capacitor, no
`www/`, no `capacitor.config.ts` — it is a plain GitHub Pages PWA. So in WEB-MAIN:

- Drop `nativeShareFile()` entirely — not "keep it, it returns false". It cannot even be imported.
- Drop the `getLicense()` / tier paywall (app-beta:6828). WEB-MAIN has no licensing. **The printable
  report must not be gated.**
- Keep `navigator.share` + `canShare({files})` (6797-6804) as an *optional* first hop: Brandi runs this as
  an installed PWA on a phone, and the share sheet is a materially better answer to "where did the file
  go" than a silent Downloads drop. Keep the `AbortError` handling at 6806 — a user dismissing the sheet
  is not a failure and must not fall through to a second download.
- Keep `Blob` + `<a download>` (6810-6821) as the terminal fallback.

That is roughly 25 lines instead of app-beta's ~50. Confirmed simpler.

### 1c. "The `500mg, 500 pills` bug is open and unfixed" — **it is already fixed; item #1 is a different bug**

`buildExportRows()` at app-beta `index.html:6750-6759` reads:

```js
detail = e.dose || '';
if (!detail && e.pills) { … unit = medRec.ceilingUnit || 'pill' + (e.pills === 1 ? '' : 's'); … }
```

The pill count is only used **when there is no dose label**, and even then it uses the med's real
`ceilingUnit`. The comment above it (6740-6749) documents the fix as **app-v52, audit H-3**, quoting
Aaron's report verbatim. My harness confirms it: the 500 mg Tylenol fixture exports as
`500 mg, pain 6/10`. I could not reproduce `500mg, 500 pills` on current code.

`BACKLOG.md:165-169` says what is actually still open, and it is a *neighbouring* bug in the same
function: the printable report **prints raw internal override codes** — `'override: ' + e.overrideReason`
renders as `override: early+overLimit` to a clinician, when `overrideBadgeLabel()` already exists to turn
that into "Early · Over limit".

**Why this matters for WEB-MAIN:** neither bug ports, but for a reason that creates a *third* bug.
WEB-MAIN's override is a **boolean** — line 638, `if (early) entry.override = true`. There is no
`overrideReason` field in WEB-MAIN at all. So APP-BETA's line 6758 (`if (e.overrideReason)`) is never
true, and **every early/override dose silently loses its override flag.** My harness confirms this: the
Morphine fixture carrying `override:true` exported as `½ tab · 7.5 mg, pain 8/10` — the override
vanished. This is precisely the class of failure the brief warns about ("mislabels doses is worse than no
export"), and it arrives *because* someone ports the file believing the bug list is current.

**Spec: WEB-MAIN must branch on `e.override` (truthy) and render `taken early (override)`.**

---

## 2. The plan — what to add to `/tmp/webmain-ro/index.html` (→ `webmain/index.html`)

Ten new functions plus one modified render function and one new state key. All new code goes in **one
contiguous block inserted between line 2194 (end of `renderReportDetail`) and line 2196 (blank line before
`renderHistory`)**, so the diff is one clean hunk in the reports area where it belongs.

### Insertion point A — the export module, after line 2194

| # | Function | Signature | Depends on (existing, all read-only) |
|---|---|---|---|
| 1 | `csvField` | `(v) → String` | none |
| 2 | `escHtml` | `(s) → String` | none |
| 3 | `allExportEntries` | `() → Array` | `state.entries` (261), `state.chemoDates` (261) |
| 4 | `exportDetailFor` | `(e) → String` | `BOWEL_MOVEMENT_LABELS` 781, `APPETITE_LABELS` 884, `state.meds` 261, `state.archivedMeds` 261, `tempSuffix` 283 |
| 5 | `buildExportRows` | `() → Array<Array<String>>` | 3, 4, `nameOf` 421, `fmtTime` 413, `timeBucket` 412, `missedDosesFor` 381 |
| 6 | `exportFilename` | `(kind, ext) → String` | `CONFIG.patientName` 257, `simNow` 280 |
| 7 | `deliverFile` | `async (blob, filename, mime) → void` | `setToast` 536 |
| 8 | `downloadEntriesCSV` | `async () → void` | 1, 5, 6, 7 |
| 9 | `buildReportDoc` | `() → String` (HTML) | 2, 5, `CONFIG` 257, `nextChemoTs` 362 |
| 10 | `openPrintReport` | `async () → void` | 6, 7, 9 |

`escHtml` and `csvField` do not currently exist anywhere in WEB-MAIN (grep for `export|csv|Blob|print(`
returns **zero** hits — this is greenfield, there is nothing to collide with).

### Insertion point B — surface it in Reports

**Do not add a sixth bottom-nav tab.** `renderBottomNav` (1108-1125) hardcodes
`gridTemplateColumns: 'repeat(5, minmax(0, 1fr))'` at line 1117; a sixth item silently overflows five
columns. Instead:

- **`renderReportsMenu` (2156-2179):** append one `<section>` after the `reportTypes` map closes at line
  2177, containing two buttons — *Download CSV* and *Printable report* — plus one line of subtext naming
  the file and stating it is a complete copy. Reuse the existing card styling from 2167-2174 verbatim so
  it is visually native.
- Do **not** add `'export'` to the `reportTypes` array at 2157. That array feeds `openReport()` → 
  `reportDescriptor()` (2138) → `renderReportDetail()` (2181), whose dispatch at 2183 is an `if/ternary`
  chain ending in a bare `else renderAppetite(now)`. An unrecognised type falls through to the **Appetite
  report** rather than erroring. Adding `'export'` there without touching 2183 produces a wrong screen.

### Insertion point C — one state key

Add `exporting: false` to the `state` literal at line **261**. Used only to disable the two buttons while
a blob is being built, preventing a double-tap producing two downloads. In-memory only; never persisted.

### Existing code this must not disturb

| Do not touch | Line | Why |
|---|---|---|
| `subscribeEntries` | 84-91 | Splits `chemo_date` out of the callback. Changing the split changes what every other view sees. Read `state.chemoDates` instead (§3d). |
| `addEntryDB` / `removeEntryDB` | 92-93 | The only entry write paths. Export must never reference them. |
| `clearMissedDoses` / `PREFS_DOC` | 98-111 | The only prefs write. See §2's read-only proof. |
| `persistMedicationConfig` | 247-255 | The only `localStorage.setItem`. Export must never call it. |
| `missedDosesFor` | 381-411 | Call it, do not modify it. It is load-bearing for Home and History. |
| `nameOf` | 421 | Call it. Do not "improve" the fallback — the raw-id fallback is what stops doses being dropped (§3). |
| `renderHistory` | 2197+ | Shares `missedDosesFor`; a signature change breaks it. |
| `setState` | 267-275 | Has a `pendingEntries` flush side-effect. Export should call it at most twice (spinner on/off). |

---

## 3. Read-only proof

### 3a. The enumeration

WEB-MAIN has exactly **four** mutation mechanisms. Every one is a named function; there are no other
write paths in the file.

| # | Mechanism | Sole call sites | Reached by my plan? |
|---|---|---|---|
| W1 | `addDoc` → `addEntryDB` (92) | 610, 640, 648, 654, 664, 670, 712, 737, 738, 815, 900, 927, 986, 991, 1664 | **No** |
| W2 | `deleteDoc` → `removeEntryDB` (93) | 677, 690, 907, 937 | **No** |
| W3 | `setDoc` → `PREFS_DOC` (106) and `fcm_tokens` (65) | `clearMissedDoses`, `subscribePush` | **No** |
| W4 | `localStorage.setItem` → `persistMedicationConfig` (250) | 1957, 1986, 1996 | **No** |

Walking the ten functions in §2: functions 1, 2, 6 are pure string transforms. Function 3 reads two state
arrays. Functions 4, 5, 9 read state and call `nameOf`/`fmtTime`/`timeBucket`/`missedDosesFor`, all of
which are pure reads (`missedDosesFor` builds a local `out` array and returns it — line 385, 410 — it
assigns to nothing outside its own scope). Function 7 constructs a `Blob`, optionally calls
`navigator.share`, otherwise creates and clicks a detached `<a>`; it touches `document`, never Firestore
and never `localStorage`. Functions 8 and 10 orchestrate 1-7/9 and call `setToast` (536), which mutates
only `state.toast` in memory. **No path reaches W1-W4.**

### 3b. The mechanism that guarantees it

Not discipline — **structure, plus a mechanical gate.**

The structural argument: Firestore writes in WEB-MAIN are only reachable through the module-scoped
bindings `addDoc`, `deleteDoc`, `setDoc` imported at line 33, and every use is wrapped in one of the four
named functions above. The export module references none of those seven identifiers. There is no dynamic
dispatch anywhere in this file — no `window[...]()`, no `eval`, no computed method access on `db` — so
the static reference set is the complete behavioural set.

The gate the Auditor can run, which does not depend on anyone's judgement:

```
# Extract the inserted block (line 2195 .. end of openPrintReport) and assert it is clean:
grep -nE 'addDoc|deleteDoc|setDoc|addEntryDB|removeEntryDB|persistMedicationConfig|localStorage|PREFS_DOC|clearMissedDoses' <block>
# must return ZERO matches.
```

Add that grep to `release_check.sh` scoped to the export block so it cannot regress silently.

### 3c. The one thing that would have written — flagged, as instructed

**A "last exported at" timestamp is the obvious next request and it must not be built.** The natural home
is `caretracker_prefs`, and there is a ready-made helper inviting it: `clearMissedDoses` (103-111) already
does `setDoc(PREFS_DOC, {...}, { merge: true })`. Adding `lastExportedAt` there is a two-line change that
would look completely idiomatic and would break the entire safety argument for shipping this first.

**Alternatives, in order of preference:**
1. **Don't track it.** The filename already carries the date (`caretracker-brandi-2026-08-14.csv`). Her
   file manager sorts by date. This is sufficient and it is what I recommend.
2. If a visible "last exported" is genuinely wanted, hold it in the in-memory `state` only (like
   `exporting`), so it shows until reload and writes nothing.
3. If it must persist, `sessionStorage` — device-local, tab-scoped, and crucially *not* the key
   `caretracker-medication-config-v1`, so a bug can never corrupt her med config.

Options 2 and 3 still weaken the claim "this feature writes nothing". **Recommend option 1 and state in
the release notes that the export is provably write-free.**

### 3d. Second-order read hazard

`allExportEntries()` must read `state.chemoDates` as well as `state.entries` — but it must **copy** before
sorting. `state.entries` is the live array the renderer walks. `[...state.entries, ...state.chemoDates].sort()`
is safe; `state.entries.sort()` mutates render order in place and would reorder her History screen as a
side-effect of pressing Export. Not a Firestore write, but a user-visible mutation, and exactly the kind
of thing that makes "read-only" untrue in practice. **Spec: always spread-copy before sorting.**

---

## 4. Medication name resolution — the hard part

### 4a. How `medId` resolves today

`nameOf(id)` (line **421**) resolves in this order:

1. Hardcoded special ids — `temp`, `weight`, `cycle_start`, `cycle_end`, `inpatient`, `inpatient_start`,
   `inpatient_end`, `bowel_movement`, `appetite`.
2. `symptom_*` prefix → `SYMPTOM_TYPES[suffix]` (923), else the bare suffix.
3. `state.meds.find(x => x.id === id)` → `.name` — the **device-local** config from
   `localStorage['caretracker-medication-config-v1']` (146, loaded 232-245).
4. `state.archivedMeds[id]` → `.name` — also device-local.
5. **Fallback: return the raw `id` string.**

Note what `nameOf` does *not* handle: **`chemo_date` has no case**, so it returns the literal string
`chemo_date`. See §5/§4d.

### 4b. The four scenarios, verified in the harness

| Scenario | Mechanism | Export shows | Dose lost? |
|---|---|---|---|
| **Active med** | in `state.meds` | `Tylenol` | No |
| **Renamed** | `nextMedicationId(name, existingId)` (1906-1914) **returns `existingId` when editing** — the id is preserved across a rename (1933) | the **new** name, applied retroactively to all history | No |
| **Archived / deleted** | `deleteMedicationConfig` (1990-1999) moves `{name, sub}` into `archivedMeds` before removing from `meds` (1995) | the correct **historical** name | No |
| **Created or archived on a *different* device** | med config is per-device localStorage (144-146); this device has neither record | the **raw id**, e.g. `gabapentin` | No |

Harness output:

```
tylenol    (active)                  -> "Tylenol"
zofran     (renamed on this device)  -> "Zofran Renamed By Brandi"
compazine  (archived on this device) -> "Compazine"
gabapentin (created on ANOTHER device) -> "gabapentin"
```

**The good news: nothing is ever silently dropped.** The step-5 fallback guarantees a row for every
document. The failure mode is degradation of the label, never omission — *provided the exporter iterates
entries and never iterates `state.meds`.* An implementation that looped over configured meds and gathered
their entries would drop every dose in scenarios 3 and 4 entirely. **That is the single most dangerous
way to write this function, and it must be called out in review.**

### 4c. Two real fidelity defects, and the fix

1. **Retroactive relabel.** Because rename preserves the id, doses she took in June under "Tylenol" export
   under whatever the med is called today. A clinician reading the report cannot tell.
2. **Cross-device slugs.** A custom med added on her phone exports from the laptop as `gabapentin`, or
   worse, as a collision-suffixed slug like `medication-2` (1911-1913), which is meaningless on paper.

**Fix — the single most important design decision in this brief: export the raw `medId` in its own
column.** The CSV gets a `Med ID` column carrying `e.medId` unmodified. This makes the file
**self-describing and device-independent**: whatever the display name resolved to on whichever device
produced the file, the stable identifier that links every dose to its medication is in the file. Without
it, a CSV exported from a device with a stale config is *not* a reconstructible backup — it is a set of
rows labelled with one device's opinion. With it, it is.

The printable report should **not** show the id column (a clinician does not want slugs). Where `nameOf`
falls through to the raw id, the report should render it as `` `gabapentin` (unrecognised medication) ``
so the doctor knows the app could not name it rather than reading a slug as a drug name.

### 4d. Also unhandled

`nameOf('chemo_date')` returns `chemo_date`. Since chemo dates must be exported (§5), add an explicit
label — `Chemo Date` — inside the **exporter**, not by editing `nameOf` (which is called from many render
paths and is not in scope to change).

---

## 5. Entry-type coverage

Complete enumeration from WEB-MAIN's own write sites (610, 633-670, 815, 897, 926, 986, 991, 737-738).

| Entry type | `medId` | Payload | In APP-BETA export? | CSV | Report |
|---|---|---|---|---|---|
| Dose | med id | `dose`, `mg`, `pills?`, `volumeMl?`, `painLevel?`, `override?` | Yes | dose label; `+ ", N mL"` if `volumeMl` and label lacks it; `+ ", pain N/10"`; `+ ", taken early (override)"` | same |
| Temperature | `temp` | `temp`, `dose` | Yes | `e.dose` else `temp + tempSuffix()` | same; peak in summary |
| Weight | `weight` | `weight`, `dose` | Yes | `e.dose` else `weight + " lbs"` | same; net change in summary |
| Symptom | `symptom_<type>` | `symptomType`, `note`, legacy `freq?` | Yes | type via `nameOf`; `freq` → `"N episodes"`; **note carries the content** | own Symptoms table |
| Appetite | `appetite` | `value`, `dose`, `note?` | Yes | `APPETITE_LABELS[value]` | same |
| Bowel movement | `bowel_movement` | `value`, `dose` | Yes | `BOWEL_MOVEMENT_LABELS[value]` | same |
| Cycle start/end | `cycle_start` / `cycle_end` | marker | Yes (blank detail) | blank detail | in daily log |
| In-patient start/end | `inpatient_start` / `inpatient_end` | marker | Yes (blank detail) | blank detail | in daily log |
| Legacy in-patient day | `inpatient` | marker | Yes | blank detail | in daily log |
| **Chemo dates** | `chemo_date` | `dose`, `ts`, `loggedAt` | **NO — excluded** | **include** | header + own row |
| **Missed doses** | *(none — computed)* | `missed`, `windowName` | **NO — cannot be** | **include, flagged derived** | own section, flagged |
| Overrides | flag on a dose | `override: true` | **effectively no** (reads `overrideReason`) | `", taken early (override)"` | same |
| Pain levels | flag on a dose | `painLevel` | Yes | `", pain N/10"` | same |
| Notes | field on any entry | `note` | Yes | own column | own column |

### 5a. The three exclusions, and whether they are right for a backup

**Chemo dates — APP-BETA excludes them (`buildExportRows`, line 6726: `.filter(e => e.medId !== 'chemo_date')`,
justified in the comment at 6723 as "internal scheduling state, not health data"). That reasoning is wrong
for WEB-MAIN's purpose.** They are Firestore documents in `caretracker_entries`; they are the treatment
calendar the whole app pivots on (`nextChemoTs` 362, `chemoOffsetFor` 367, `dexActiveOn` 372,
`zofranBlockedOn` 377); and if the export is the only backup, excluding them means her chemo schedule is
the one thing that cannot be restored. **Include them.**

Two traps when you do:
- **The `ts: 0` tombstone.** Clearing a chemo date writes `{ medId:'chemo_date', dose:'Chemo date cleared',
  mg:0, ts:0, loggedAt:Date.now() }` (line **1664**). `ts: 0` is 1 Jan 1970. Sorted chronologically it
  lands at the very top of the CSV and produces a `1970-01-01` heading in the report. **Rule: `chemo_date`
  rows with `ts === 0` sort by `loggedAt`, are labelled `Chemo date cleared`, and are excluded from the
  daily log's day-grouping** (they are audit trail, not a day's events). Carry them in the CSV — dropping
  them would make the schedule history unreconstructible.
- **Future dates.** A scheduled chemo date is in the future. In my render it appeared at the top of the
  "Daily log" as a day of its own, which reads oddly. **Rule: surface the next chemo date in the report
  header; keep future-dated `chemo_date` rows out of the daily log; keep them in the CSV.**

**Missed doses — APP-BETA cannot export them and neither can a naive port, because they are not documents.**
`missedDosesFor()` (381-411) computes them at render time from: `state.meds` (device-local config), the
chemo date (`dexActiveOn`), in-patient days (`isInpatientDay`, 384), and the hard floor
`MISSED_TRACK_SINCE = Jul 12 2026` (380). Two devices with different med configs will compute **different**
missed-dose sets from byte-identical Firestore data.

That makes them the one place a backup could actively mislead. But omitting them loses real clinical
signal — a doctor wants to know she missed three evening Protonix doses. **Recommendation: include them,
in both artefacts, explicitly marked as derived.** In the CSV, a `Source` column valued `logged` or
`derived`. In the report, a separate "Missed scheduled doses" section carrying a `derived` chip and the
line *"Calculated from the schedule configured on this device, not recorded by the patient."* Also state
the `MISSED_TRACK_SINCE` floor, so nobody reads the absence of pre-12-July flags as perfect adherence.

The `Source` column is what makes this safe: it keeps the file honest about which rows are facts and which
are inferences, and it means a future restore can trivially filter to `logged` only.

**Overrides — see §1c.** Not an APP-BETA exclusion; a porting defect that would newly appear in WEB-MAIN.

### 5b. Symptom notes

For `symptom_other`, `logSymptom` (926) stores the description **only** in `note` — the detail column is
empty (harness confirmed: type `Other`, detail blank, note `sharp rib pain`). Any layout that drops or
truncates the Note column destroys the content of every free-text symptom. **The Note column is
load-bearing and must never be truncated in the CSV.**

---

## 6. The printable report

### 6a. What it contains, in order

1. **Header** — "Treatment record — Brandi"; patient-logged; app version; generated date; period covered;
   next chemo date.
2. **Summary** — period, entry count, peak temperature, net weight change. Four tiles.
3. **Medication totals** — doses recorded per medication over the period. The first thing an oncologist
   actually scans.
4. **Symptoms reported** — date, time, symptom, description. Pulled out of the daily log because it is
   the highest-signal section and is otherwise buried.
5. **Missed scheduled doses** — flagged `derived`, with the caveat line and the tracking-floor note.
6. **Daily log** — reverse-chronological, one table per day: Time / Type / Detail / Note.
7. **Footer** — "not a clinical document — verify against medical records", and that times are device
   local time at logging.

Vitals belong inline in the daily log next to the doses taken around them — a doctor correlating a 100.9 °F
spike with what she took at 9:30 that morning should not be flipping between sections.

### 6b. Print layout

Verified by rendering in Chromium print emulation (screenshot + Letter PDF, zero console errors):

- `@page { size: letter; margin: 14mm 13mm 16mm }`.
- `thead { display: table-header-group }` so multi-page day tables repeat their header.
- `tr { break-inside: avoid }` and `h3 { break-after: avoid }` so a day heading never orphans at a page
  foot and no row splits across pages.
- `.card { break-inside: avoid }` for the summary blocks.
- Body 11.5px, tables 11px — dense enough that a month fits in a few pages, large enough to read.
- Greyscale-safe: missed rows are dark red **and bold**, so they survive a black-and-white printer.
- `print-color-adjust: exact` so the day-heading bands actually print.

**Two defects I found in my own prototype that the implementation must fix:**

1. **Per-day tables auto-size their columns independently**, so the Time/Type/Detail/Note columns do not
   line up between days — visible in the render as the "NOTE" header drifting horizontally. Fix:
   `table-layout: fixed` with explicit widths (Time 62px, Type 120px, Detail auto, Note 30%).
2. **I stubbed a page number** (`Page <span class="pg">`) which CSS cannot fill. Remove it — the browser's
   own print dialog adds page numbers. Leaving it prints the word "Page" followed by nothing.

### 6c. Delivery

`window.open('', '_blank')` + `win.print()` — the classic path, with the pop-up-blocked toast from
app-beta:6872 retained. **But** WEB-MAIN runs as an installed standalone PWA, where `window.open` is
unreliable, which is exactly the v47 failure app-beta already hit. **Recommendation: offer the report as a
downloadable `.html` file via the same `deliverFile()` used by the CSV, and additionally try
`window.open` + print.** If the pop-up is blocked, she still has a file she can open and print — instead
of a toast telling her to reconfigure her browser.

---

## 7. Approach: recommendation and alternative

### Recommended — **Option B: a lean exporter written against WEB-MAIN's own data layer**, taking APP-BETA's *hard-won decisions* but not its code.

Carry over, deliberately: `csvField`'s CSV-injection defence (6714-6722 — a note reading `-3 lbs overnight`
is executed as a formula by Excel; this is a real hazard in a patient-authored file, and it is already
solved); the UTF-8 BOM (6779) so Excel opens `°F` correctly; the share→download fallback chain and its
`AbortError` handling; the `en-CA` date format (sortable `YYYY-MM-DD`); the v52 dose-label reasoning.

Leave behind: `nativeShareFile` (no Capacitor), `getLicense` gating (no licensing), `allEntriesRaw` and
the profile system (WEB-MAIN is single-patient), radiation/blood-pressure/`weightReason`/`severity`/`site`
branches (fields WEB-MAIN never writes), and `overrideReason` (replaced by boolean `override`).

**Why:** APP-BETA's `buildExportRows` is ~40 lines of which roughly half branch on fields WEB-MAIN does not
have, and one branch (`overrideReason`) is silently wrong for WEB-MAIN's schema. Porting it means carrying
dead branches into a 2,791-line file whose whole virtue is that it is small and legible — and, worse, it
means the override defect ships. The genuinely valuable parts of that function are its *comments* and its
security decisions, and those transfer by reading, not by copying.

### Alternative — Option A: port `buildExportRows`/`downloadEntriesCSV`/`openPrintReport` wholesale and strip.

**For:** fastest to a working build; the code is battle-tested through several audit rounds; less risk of
a fresh CSV-quoting bug.
**Against:** you must delete `nativeShareFile`, the license gate, `allEntriesRaw`, and five dead field
branches — and *you must remember* to rewrite `overrideReason` → `override`. That is a deletion exercise
where the one thing you must **add** is easy to miss, and missing it is invisible (no error, just absent
data). It also imports app-beta's chemo-date exclusion, which is wrong here (§5a). Roughly the same total
work, worse failure mode.

### Also considered and rejected

**Option C: JSON export of raw documents alongside the CSV.** Strictly the best *backup* — perfect
fidelity, no field list to get wrong, immune to every §4 labelling problem. Rejected as the primary
artefact because Brandi cannot read or verify it, and a backup she cannot open is one she will not trust
or check. **But it is cheap** (`JSON.stringify(allExportEntries(), null, 2)`, ~5 lines, same
`deliverFile`) and it is the only artefact from which her history is *provably* reconstructible byte-for-byte.
**Recommend shipping it as a third, quietly-labelled button ("Raw data backup (.json)") in v43 if the
budget allows, or as v44.** The CSV is for reading; the JSON is for restoring.

---

## 8. Definition of done

### Must work

1. Reports → Export shows two buttons; both work with a populated Firestore and neither throws.
2. CSV columns, exactly: `Date, Time, Time of day, Type, Med ID, Detail, Note, Source, Entry ID`.
3. Row count = `state.entries.length + state.chemoDates.length + <derived missed count>`. Assert this
   equality in test — it is the anti-drop check.
4. A 500 mg Tylenol exports as `500 mg` in Detail. Not `500mg, 500 pills`. Not `500 mg, 500 pills`.
5. A dose with `override: true` exports with `taken early (override)` in Detail. **This is the specific
   regression a port introduces — test it explicitly.**
6. A dose with `painLevel` exports `pain N/10`.
7. A Tylenol Liquid dose carries its volume (from the label, or `", 30 mL"` appended if absent).
8. Temperature uses `tempSuffix()`, rendering `°F`; the `°` survives the round-trip into Excel (BOM).
9. Every one of the 13 rows in §5's table appears for a fixture containing one of each.
10. Medication names resolve per §4b: active → name, renamed → new name, archived → archived name,
    unknown → raw id. **No row is ever dropped for an unresolvable `medId`.**
11. `Med ID` carries raw `e.medId` unmodified for every row.
12. `Source` is `logged` for documents and `derived` for computed missed doses.
13. `chemo_date` rows are present; `ts === 0` tombstones appear as `Chemo date cleared` and do **not**
    create a `1970-01-01` group in the report.
14. A note containing `=SUM(A1)`, a comma, a double quote, and a newline round-trips through Excel and
    Sheets as literal text, in one cell, unexecuted.
15. Printable report prints on Letter with repeated table headers, no row split across a page boundary,
    no orphaned day heading, and aligned columns across all day tables.
16. Missed doses appear in a separate section marked `derived`, with the caveat line and the
    `MISSED_TRACK_SINCE` note.
17. Empty state: with zero entries, both buttons toast "Nothing to export yet" and produce no file.
18. Both buttons work offline (service worker cached, no Firestore round-trip — the data is already in
    `state`).

### Must not happen (regressions)

19. **Firestore document count and content are byte-identical before and after exporting.** Check
    `caretracker_entries` and `caretracker_prefs`. This is the headline check.
20. `localStorage['caretracker-medication-config-v1']` is byte-identical before and after.
21. The grep gate in §3b returns zero matches against the inserted block.
22. History screen order is unchanged after an export (catches the in-place `.sort()` bug, §3d).
23. Home, Meds, In-Patient, Symptoms, and all five existing reports render unchanged; bottom nav still
    shows exactly five items and does not wrap.
24. Zero new console errors or warnings on load and on both export paths.
25. **No `TEST_MODE`, no `caretracker_test_entries`, no `caretracker_test_prefs`, and no "BETA" string
    anywhere in the shipped file.** WEB-BETA gates its collections at `chemowell-beta/index.html:49` and
    `:100` and carries a BETA badge at `:1241`/`:1254`. Grep for all five tokens before release.
26. Firebase config at 32-46 unchanged; still `caretracker_entries` / `caretracker_prefs`.

### The backup test — could her history be reconstructed from the file?

This is the acceptance criterion that matters most, and it must be tested as a **round trip**, not by
eyeballing the file:

27. For every document in a fixture `caretracker_entries`, the CSV contains exactly one row, and from that
    row alone a reader can recover: **when** (`Date`+`Time`, to the minute), **which medication**
    (`Med ID`, stable and device-independent), **what** (`Detail` — dose label, mg, pills, volume, pain,
    override), **any free text** (`Note`, untruncated), and **document identity** (`Entry ID`).
28. Reconstruction is exact for `medId`, `note`, `painLevel`, `override`, `value`, `weight`, `temp`, and
    the entry's day and minute.
29. **Known and accepted lossiness — this must be written into the release notes, not discovered later:**
    - `ts` is exported to **minute** precision, not milliseconds. Ordering within a minute is not
      recoverable. (Fix if desired by adding an ISO-8601 `Timestamp` column — cheap, and I would take it.)
    - `mg` is recoverable only as it appears inside the dose label. A dose whose label omits mg loses the
      numeric `mg`. (Fix by adding an `Amount (mg)` column — also cheap, also recommended.)
    - `volumeMl`, `loggedAt`, and legacy `freq` are rendered into text rather than preserved as fields.
    - Display names are device-dependent (§4c); `Med ID` is not, which is why it is mandatory.
30. Given the above, **the CSV is a faithful clinical record and a good-but-lossy backup.** If the bar is
    "her history could be reconstructed", add the `Timestamp` and `Amount (mg)` columns (items 29a/29b),
    or ship the JSON of Option C. **I recommend adding both columns in v43** — together they are about six
    lines and they move the CSV from "nearly complete" to "complete for every field that carries clinical
    meaning". Absent them, the honest claim is "a very good record", not "a backup".

---

## 9. Version

**Ship as `caretracker-v43`.**

Per `CLAUDE.md:29-38`, every change bumps the SW cache and updates both docs in the same commit.

| # | File | Line | Current | Change to |
|---|---|---|---|---|
| 1 | `sw.js` | 1 | `const CACHE = 'caretracker-v42';` | `'caretracker-v43'` |
| 2 | `README.md` | top + history table | v42 | v43 entry + bump "Current version" |
| 3 | `CARETRACKER_HANDOFF.md` | top + history | v42 | v43 entry + bump "Current version" |

**That is the complete set.** `manifest.webmanifest` carries no version; `index.html` displays no version
string anywhere (grep for `v4[0-9]`, `APP_VERSION`, `version:` returns nothing in it); there is no
`package.json` in this repo. `CLAUDE.md:32` mentions `caretracker-v27`→`v28` only as an example of the
convention — **do not edit it.**

**Note:** this feature is the first thing in WEB-MAIN that wants to print its own version — the report
header should say which build produced it. There is no constant to read. **Add
`const APP_VERSION = 'v43';` near `CONFIG` (line 257)** and use it in the report header, making it a
fourth place to bump from v44 onward. Record that in the handoff so it does not drift out of sync with
`sw.js`.

---

## 10. Summary of what I believe the framing got wrong

1. **The 18-field list is not trustworthy** — `target`, `currentTarget`, and `g` are not entry fields, and
   it omits `temp`, `volumeMl`, and `loggedAt`. Temperature is `temp`, not `value`.
2. **`missed` and `windowName` are not stored data.** They are computed per-device. This changes what an
   export can honestly claim.
3. **The "500mg, 500 pills" bug was fixed in app-v52.** Outstanding item #1 is the adjacent
   raw-`overrideReason` bug in the printable report. Neither ports — but a port introduces a *new* silent
   override-loss defect in WEB-MAIN because its override is a boolean.
4. **APP-BETA's chemo-date exclusion is wrong for this purpose** and would silently omit her treatment
   schedule from the only backup she has.
5. **The repos were not where the brief said**, which is worth fixing in the environment before the
   Auditor spends the same time rediscovering it.
