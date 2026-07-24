# DEV_BRIEF_v13 — Merge the four Home-placement toggles into one picker; unify the two "as needed" concepts; R6 rule-note copy

Role: Developer (stage 1 of the Quality Chain, TEAM.md). Pre-implementation brief for the Lead Developer.
Scope approved by the Owner: (1) one single-choice control replacing the four placement pill toggles, (2) UI-level unification of Schedule type "As needed / gap-based" vs Days taken "As needed (no set days)", (3) R6 rule-note item. **STRICTLY UI-level: the stored schema (`quickLog`/`groupedMorning`/`groupedAfternoon`/`groupedEvening` booleans, `scheduleDays` modes) and the `normalizeMedication` `alerts` derivation must NOT change.**

Investigated on the actual code (`index.html`, current working tree, all line numbers below verified against it) AND the running app (python3 -m http.server 8877 + headless Chromium via Playwright at 390x844). Probe scripts: `/tmp/dev13_probe.mjs`, `/tmp/dev13_probe2.mjs`. No code was modified.

---

## 0. Live-verified facts (the load-bearing ones)

Seeded a profile with four synthetic meds and drove the real UI:

1. **Multi-group is legal and additive today.** A med with `quickLog:true, groupedMorning:true, groupedEvening:true` renders in the Quick Log grid AND the Morning meds card AND the Evening meds card simultaneously (4 name occurrences on Home: card title + "Log X" button + one row in each group card). The four flags are independent filters — nothing anywhere enforces exclusivity.
2. **The current toggle help copy is wrong.** "Lists it in the shared 'Morning meds' card **instead of** its own Quick Log card" (line 2919) — the code never implements "instead of". `quickLog` + any group = both places at once.
3. **"Appears nowhere on Home" is a legitimate, deliberate state.** `quickLog:false` + all groups false → zero Home presence (verified), and the Meds tab explicitly badges it "Managed only (no Home card)" (line 2981). The single-choice picker MUST keep this as a real option.
4. **Save-twice is idempotent for every combination tested** (canonical placements, multi-group, gap+asneeded, win+asneeded, win+weekly, gap+interval+afternoon+evening): open editor → change nothing → save → stored JSON identical to the previous save. **This is the round-trip invariant v13 must preserve.** (Note: raw hand-seeded storage gains normalization keys — `note:''`, `chemoOnly:false`, `ceiling:false`, `gapH`, `alerts` — on the FIRST save only; that is today's behavior, not a v13 concern. The invariant is measured save→save.)
5. For **gap-type** meds, Days taken "Every day" vs "As needed (no set days)" differ ONLY in a stored `scheduleDays:{mode:'asneeded'}` object and the green "As needed" badge on the Meds tab (line 2985) / "Taken:" labels. Behavior (day gating, lock timer, alerts) is identical.
6. For **win-type** meds, Days taken "As needed" is the ONLY thing that turns missed-dose tracking off (`alerts` derivation, line 257) — this is the safety-adjacent path that must not move.

---

## 1. Home placement — current semantics, render paths, and the picker mapping

### 1.1 The four booleans and every consumer

| Flag | Written at | Read at | Effect |
|---|---|---|---|
| `quickLog` | form default `true` for new meds (`medicationFormFrom` 2675); save 2787; normalize default 258 (`DEFAULT_QUICK_LOG_IDS` = `[]`, line 219) | Home Quick Log grid filter **2467**: `m.quickLog && (!m.chemoOnly \|\| dexActive…)`; `reorderableHomeMeds()` **2814**; Meds-tab badge **2981** | Own compact card in the Quick Log grid |
| `groupedMorning` | form 2677; save 2789; normalize 260 (`DEFAULT_MORNING_IDS` = `[]`, 221) | Home filter **2583–2584** → `renderGroupedMedsCard('Morning meds', …)`; badge 2982 | One row in the shared Morning meds card |
| `groupedAfternoon` | form 2678; save 2790; normalize 261 | Home filter **2587–2588**; badge 2984 | One row in the Afternoon meds card |
| `groupedEvening` | form 2676; save 2788; normalize 259 (220) | Home filter **2591–2592**; badge 2983 | One row in the Evening meds card |

The editor renders them as four independent pill toggles at **2918–2921** (`renderPillToggle` 2853, `toggleMedicationForm` 2848–2851). `renderGroupedMedsCard` is 1510–1562 (Take-all button 1516, not-scheduled row 1520–1527, in-patient row 1528–1535, Log/override rows 1536–1558).

### 1.2 What each combination renders on Home (all 16 are storable today)

- Each true flag adds one independent surface; they never suppress each other. Q+M+E → three surfaces (verified live).
- All four false → nothing on Home; "Managed only (no Home card)" badge on Meds (2981). Legitimate state; note there is **no dose-logging path at all** for such a med (Meds tab is management-only) — the picker's copy must not claim otherwise.
- Does real data rely on multi-group? **No shipped data does.** APP-BETA fresh installs start with an empty med list (`defaultMedicationConfig` 289–293), all three DEFAULT id arrays are empty (219–221), and no migration writes multi-group combos. Only a user who manually turned on several toggles has one. That population is why the picker needs a "Custom" escape (below), not a forced choice.

### 1.3 Picker → boolean mapping (the contract)

Single-choice control, 5 canonical options + 1 conditional:

| Picker option | quickLog | groupedMorning | groupedAfternoon | groupedEvening |
|---|---|---|---|---|
| Own Home card | **true** | false | false | false |
| Morning meds group | false | **true** | false | false |
| Afternoon meds group | false | false | **true** | false |
| Evening meds group | false | false | false | **true** |
| No Home card (managed only) | false | false | false | false |
| Custom (current mix) — *conditional* | *exact stored values, untouched* | | | |

Reverse derivation (for rendering which option is selected): if the four form booleans match a canonical row → that option. Otherwise → "Custom (current mix)" is selected, and the option row is rendered at all ONLY in that case (11 of 16 combos are non-canonical).

### 1.4 Editing a med with a non-expressible combination — recommendation

**Show a conditional "Custom (current mix)" option; never force a choice.** Concretely:

- In `medicationFormFrom` (2662) capture a snapshot of the four loaded booleans (e.g. `_origPlacement: {quickLog, groupedMorning, groupedAfternoon, groupedEvening}`). Underscore-prefixed form fields are ignored by `saveMedicationEditor` (2777–2795 reads only named fields), so this cannot leak into storage.
- The picker's value is **derived every render** from the four live form booleans — no new persistent state, no new field in the saved object.
- Render the Custom row only when `_origPlacement` is non-canonical. Its helper text spells out the actual mix (e.g. "Keeps today's setup: Own card + Morning group + Evening group"). Tapping Custom restores `_origPlacement` into the four form booleans — so a user who taps "Morning meds group" by accident can get back to their old mix without discarding.
- Round-trip invariant holds by construction: the four booleans are loaded verbatim (2675–2678), never touched unless an option is tapped, and saved verbatim (2787–2790).

Why not force a choice: it silently rewrites a chemo patient's Home layout on an unrelated edit (they open the med to fix a dose label, save, and their evening card row vanishes) — exactly the class of quiet data change TEAM.md exists to prevent.

### 1.5 Control form + exact copy

Radio-style pill list (single-select, `role="radiogroup"`, rows ≥44px — reuse the `renderPillToggle` visual language at 2853–2863 with a radio dot instead of a switch; `aria-checked`, one tap per option). A `<select>` would hide the per-option helper text that carries the actual teaching; five visible rows at 12.5px/44px cost ~230px of form height vs today's ~230px for four toggles — net wash. `toggleMedicationForm` stays (still used by Chemo-day only, 2922); placement taps call one new UI helper that sets all four booleans via `updateMedicationForm(field, value, true)` semantics (one `setState`, not four).

Copy (exact strings):

- Section label: **"Home screen placement"** — helper: **"Choose the one place this medication appears on Home."**
- **"Own Home card"** — "Its own card in the Quick Log grid, with dose buttons and timing."
- **"Morning meds group"** — "One line in the shared Morning meds card — for medications taken together each morning."
- **"Afternoon meds group"** — "One line in the shared Afternoon meds card."
- **"Evening meds group"** — "One line in the shared Evening meds card."
- **"No Home card"** — "Hidden from Home. The medication stays here in Meds with its rules and history, but has no card to log doses from."
- **"Custom (current mix)"** *(conditional)* — "Keeps this medication's current setup: {computed list, e.g. Own card + Morning group + Evening group}."

Alignment note: the Meds-tab badges (2981–2984) already use "Own Home card" / "Managed only (no Home card)" vocabulary — the picker labels above match them deliberately. The "Home screen order" caption at 2939 says "Grouped Morning/Evening meds aren't included here" — while touching this area, extend to "…Morning/Afternoon/Evening…" (existing copy gap, 2-word fix, still UI-only).

---

## 2. The two "as needed" concepts — exactly what each drives, and the unified UI

### 2.1 What each concept actually does

**Schedule type `type: 'gap' | 'win'`** (select at 2888; form 2669; save 2752; normalize 239):
- `gap` → `status()` gap-timer branch **707–735**: lock = last dose ts + `gapH`·3600000 (734); ceilings checked first (709–726). No `windows` stored (2799, 275). `alerts` is ALWAYS false for gap meds (257: `type === 'win' && …`) — gap meds are never missed-dose tracked, regardless of Days taken.
- `win` → windows branch **737–752**: lock/open per window. `alerts = true` UNLESS Days taken is asneeded.

**Days taken `scheduleDays`** (select at 2892–2897; form 2680–2683; save 2756–2767; normalize 263–273). Absent = every day. Consumers:
- `medScheduledOn` **539–552**: day gating. `asneeded` returns `true` every day (543 — "available any day, just never 'due'").
- Quick-log card "Not scheduled today" branch **2474–2478**; grouped-card dimmed row **1520–1527**; `dueMeds` for Take-all **1512**.
- Missed-dose engine `missedDosesFor` **571–573**: only `m.alerts && m.windows` meds, only on scheduled days.
- **`alerts` derivation at `normalizeMedication` 257** — the one safety-adjacent line: `alerts: type === 'win' && !(scheduleDays.mode === 'asneeded')`. **DO NOT TOUCH.**
- Labels: `scheduleDaysLabel` 553–559; Meds-tab badge 2985; rule summary `formatRuleSummary` 2634–2650 (gap: "Min Xh gap" / "As needed", 2641).

### 2.2 The overlap, precisely

| | Days: Every day (no `scheduleDays`) | Days: As needed (`{mode:'asneeded'}`) |
|---|---|---|
| **Type gap** | shown daily, gap timer, never alerted | **identical behavior**; only diff: green "As needed" badge (2985) + "Taken: As needed" labels |
| **Type win** | shown daily, windows gate Log, **missed-dose tracked** | shown daily, windows gate Log, **NOT missed-dose tracked** |

So "As needed" appears twice in one form meaning two different things: as a *type* it means "gap timer instead of clock windows"; as a *days* value it means "don't flag missed doses" (win) or almost nothing (gap).

### 2.3 Unified UI proposal (labels + contextual helper only — zero storage change)

**Keep both selects, keep all four Days-taken options always rendered, relabel dynamically by `form.type`:**

- Schedule type options (2888):
  - `gap` → **"As needed — gap timer between doses"**
  - `win` → **"Scheduled — set time windows"**
  (Tour step idx 3 copy at 1690 already teaches exactly these two phrases — '"As needed" uses a gap timer… "Scheduled" uses set time windows' — so tour and form converge with no tour edit.)
- Days taken options (2893–2896), when `form.type === 'gap'`:
  - `daily` → "Every day" (unchanged)
  - `asneeded` → **"No set days"**
  - others unchanged.
- Days taken options when `form.type === 'win'`:
  - `asneeded` → **"As needed — don't flag missed doses"**
- Contextual helper line under the Days-taken row, rendered only when `form.scheduleMode === 'asneeded'` (reuse `fieldLabel` helper styling, 2865–2867):
  - type gap: **"Same as Every day for an as-needed medication — it shows every day and is never marked missed."**
  - type win: **"The time windows still control when the Log button opens, but skipped windows won't be flagged as missed."**

**Why not hide/auto-set the option (the rejected variant):** a stored gap+asneeded med (live-verified: editor opens with select value `asneeded`) would have a select value with no matching `<option>` — the browser displays the first option while `form.scheduleMode` still holds `'asneeded'`, i.e. UI lies about state; and any "auto-set to daily on type change" writes a different `scheduleDays` on an untouched save, violating the invariant. Relabel-in-place has zero such paths.

### 2.4 Combination map — every legal stored combo → unified UI → saved result

`form.scheduleMode` is loaded (2680) and saved (2756–2767) untouched by this design, so every row round-trips identically:

| Stored (type / scheduleDays) | Unified UI shows | Untouched save stores |
|---|---|---|
| gap / absent | As needed—gap timer + Every day | identical (no `scheduleDays`) |
| gap / asneeded | As needed—gap timer + **No set days** | identical `{mode:'asneeded'}` |
| gap / weekly [d…] | As needed—gap timer + Specific days (chips 2905–2910) | identical |
| gap / interval {n,anchor} | As needed—gap timer + Every few days (2898–2903) | identical |
| win / absent | Scheduled + Every day | identical |
| win / asneeded | Scheduled + **As needed — don't flag missed doses** | identical; `alerts` stays false via 257 |
| win / weekly | Scheduled + Specific days | identical; `alerts` true |
| win / interval | Scheduled + Every few days | identical; `alerts` true |

No stored combination becomes unreachable: every option still exists under both types (only labels differ), so a user can still deliberately create gap+asneeded ("No set days") or win+asneeded.

---

## 3. R6 — the rule-note recommendation, restated

From the v12 redundancy catalog (DEV_BRIEF_v12.md §3, R6): the **"Frequency / rule note"** textarea's placeholder — today still `'For example: Min 4-hour gap or Once nightly'` at **line 2915** — literally coaches the user to duplicate, as free text, the structured rules the form's gap field / windows / daily limit already enforce and that `formatRuleSummary` (2634–2650) already renders. Recommendation was: **KEEP the field** (it is doing real work — it's the rule-summary fallback when no structured rule exists, 2649 `… || (med.note || 'No schedule rule set')`, and it renders on grouped-card rows at 1554 `med.sub + ' · ' + med.note`), but **change the placeholder/helper to steer toward genuinely free-form notes**. R6 was not implemented in v12; it is the third v13 item.

Exact copy for v13:
- Label: **"Notes"** (drop "Frequency / rule" — the frequency rules now visibly live in the fields above) with `fieldLabel` helper: **"Optional — shown with the medication. For anything the fields above don't cover."**
- Placeholder: **"e.g. Take with food · From Dr. Kim · Crush if needed"**
- Do not touch storage (`note`, save 2782, normalize spread 251) or `formatRuleSummary`'s fallback.

---

## 4. Approach, alternative, tradeoffs

### 4.1 Recommended — Approach A: derived-value picker, booleans stay the single source of truth

All three items live entirely in `renderMedicationEditor` (2873–2929) + one small placement helper:
1. Replace the four pill toggles (2918–2921) with the radiogroup of §1.5. Selected option is **computed from the four form booleans each render**; taps set all four booleans in one `setState`. `_origPlacement` snapshot in `medicationFormFrom` powers the conditional Custom row (§1.4).
2. Dynamic option labels + conditional helper for the two selects (§2.3) — pure ternaries on `form.type`/`form.scheduleMode` inside the existing `h('option'…)` calls; the select re-renders anyway (`updateMedicationForm(…, true)` on type change, 2888).
3. Note field label/placeholder swap (§3) at 2915.

Untouched: `normalizeMedication` (236–277, incl. `alerts` 257), `saveMedicationEditor` (2746–2807), `medicationFormFrom`'s existing fields (2662–2685; only the additive `_origPlacement` snapshot), `toggleMedicationForm` (2848 — still used by Chemo-day only 2922), all Home render paths (2467, 2583–2592, 1510–1562), `reorderableHomeMeds` (2813–2815).

Tradeoffs: slightly more render logic in the editor; Custom option needs careful conditional rendering; but zero storage/save-path risk and the round-trip invariant holds by construction.

### 4.2 Alternative — Approach B: explicit `form.placement` enum mapped back at save

Add `placement: 'own'|'morning'|'afternoon'|'evening'|'none'|'custom'` to the form in `medicationFormFrom`, and have `saveMedicationEditor` translate it to the four booleans (custom → pass originals through). Simpler render code (picker binds to one field), and the mapping table lives in exactly one function. **Tradeoffs that disqualify it:** it puts new logic in the save path — the one place a bug silently rewrites stored placement (the invariant now depends on the translation being right for all 16 combos instead of on "nothing touched the booleans"); two sources of truth while the editor is open (booleans vs enum) can drift if any future code sets a boolean directly; and it's more code in the highest-blast-radius function of the editor. Approach A is strictly safer for the same UX.

### 4.3 Constraints & landmines (carried from v12 §4, still current)

- 1-second full-DOM re-render (tick loop ~3750s region): no cached nodes; picker selection must be derived state, which Approach A guarantees. The `isEditing` guard skips renders while an input/select/textarea has focus — pill-button taps are buttons, so the picker re-render happens on the tap's own `setState`, same as today's toggles.
- `updateMedicationForm` deliberately skips re-render for text fields (2687–2691) — the Notes/label changes must not add a rerender flag to text inputs.
- Reserved legacy med IDs (2728) and everything in `normalizeMedication` are out of bounds.
- Tour contract: `medEditor:open` (2742), `med:saved` (2806), `medEditor:closed` (2925, Discard) must keep firing; step idx 3 (`TOUR_STEPS[3]`, 1690) targets `[data-tour="med-editor"]` (2878) and renders as the v12 slim banner (`formStep` 1728, banner 1733–1743) — the form grows ~1 row taller with the picker; banner mode is height-insensitive but re-verify with real clicks.
- TEST_MODE stays true; no cloud; version ritual on push (APP_VERSION, sw.js CACHE, README row).

### 4.4 Pre-existing quirks documented, deliberately NOT fixed in v13 (flag to Owner separately)

- Grouped-card filters (2583–2592) ignore `chemoOnly` — a chemo-only med in a group shows year-round in that group.
- `doseProgressToday` (606–618) counts a win+asneeded med's windows in the Home ring denominator even though such a med is never "due".
- A quickLog+grouped ("Custom") med appears in multiple places but is EXCLUDED from the "Home screen order" reorder list (2814 requires no groups) — the picker makes new such combos impossible, existing ones keep today's behavior.
- "No Home card" meds have no dose-logging UI anywhere (copy in §1.5 is written to be honest about this).

---

## 5. Done criteria + regression list

Done when (all on the running app, mobile viewports 390x844 + 360x740, keyboard heights 390x480 + 360x400 for the editor):

1. **Round-trip invariant (the gate):** scripted matrix — meds stored with each of the 5 canonical placements, ≥2 non-canonical combos (Q+M+E; A+E with Q=false), and all 8 type×scheduleDays combos of §2.4 — open editor, change nothing, save: stored JSON **byte-identical** to the pre-open value (pattern: `/tmp/dev13_probe2.mjs` save-twice, which passes on today's build for every case).
2. Picker behavior: each canonical option → exactly the boolean row of §1.3 in storage; Home then shows exactly one surface (or none for "No Home card"); Meds-tab badges (2981–2985) agree.
3. Custom option: rendered ONLY for non-canonical meds, shows the actual mix in its helper, restores the original booleans when re-selected after tapping another option, and never appears for new meds (new-med default remains `quickLog:true` = "Own Home card" selected, per 2675).
4. As-needed labels swap live when Schedule type changes gap↔win, with `form.scheduleMode` preserved across the swap; contextual helper appears only when mode = asneeded.
5. Notes field: new label/placeholder; saving an existing med whose `note` duplicates a rule changes nothing stored.
6. Tour: full first-run at 390x844 and 360x740 via REAL actions (welcome → name → Show me → Meds → Add → fill → save → Home → Next×4 → Finish); on step idx 3 the banner + every field + the picker + Save are simultaneously reachable (real Playwright click on "Add medication" succeeds); step-3 teaching text (1690) still matches the form's vocabulary.
7. Zero console/page errors; zero horizontal overflow at 360/390; all picker rows ≥44px tap height.

Must-not-regress:
- **Grouped cards on Home:** single-group meds render one row; Take-all appears with 2+ due (1516); "Not scheduled today" dimmed rows (1520–1527) and In-Patient rows (1528–1535) intact; a legacy multi-group med still renders in all its groups.
- **Missed-dose alerts derivation:** win+daily/weekly/interval meds still produce missed entries (`missedDosesFor` 566–601); win+asneeded and ALL gap meds still never do; `alerts` line 257 character-identical.
- Quick Log grid population (2467), collapse header count (2576), chemoOnly gating on it, and card order = `state.meds` order via `reorderableHomeMeds` (2813) + Home screen order section (2936–2939).
- Editor validation toasts unchanged: name required (2751), window parse (2755), weekly needs ≥1 day (2761), interval ≥2 (2765), daily-limit unit-carrier check (2769–2773).
- Discard/Save row (2924–2927) and `medEditor:closed` back-step (1715–1717) intact.
- Chemo-day-only toggle (2922) and `toggleMedicationForm` untouched.
- v12 fixes intact: tour banner mode on `short` steps (1728–1743), gapH empty-with-placeholder draft (2670, 2912), R2/R3/R8/R9 deletions stay deleted.
- Text inputs still don't re-render per keystroke (2687–2691) — focus/keyboard survives typing.
