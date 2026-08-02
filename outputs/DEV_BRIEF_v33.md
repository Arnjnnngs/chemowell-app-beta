# DEV BRIEF — v33 "Radiation support, profile buildup, Account, Export"

Stage: Developer (investigation only — no code changed). Repo: `chemowell-app-beta` (APP-BETA).
File: `index.html` (5,393 lines, single file, no build step), verified against `APP_VERSION = 'app-v32'`
(index.html:4460) / `sw.js` `CACHE = 'chemowell-app-v32'` (sw.js:1). All line numbers below are v32.

Owner correction honored throughout: **the existing "Cycle" feature is MENSTRUAL cycle tracking**
(`logCycleStart`/`logCycleEnd` write `cycle_start`/`cycle_end` entries — index.html:1287-1332), not chemo cycles.
Radiation gets its own, separate mechanism.

---

## 1. Codebase map (verified, with line numbers)

### 1.1 Rendering & state
- `h()` hyperscript renderer: 1664. `state` object literal: **526** (every UI flag lives here). `setState`: 532 →
  full re-render via `render()`: 2433. `render()` short-circuits to the welcome screen when
  `state.prefsLoaded && !(CONFIG.patientName || '').trim()` — **2435**.
- View routing: `VALID_VIEWS = ['home','meds','reports','inpatient','symptoms','settings','calendar']` — **520**;
  `restoreView()` 521 (sessionStorage whitelist); `navigateTo()` 1747; `renderContent()` if-chain dispatch — **2110-2116**.
  Reports sub-routing via `state.reportsView` + `openReport()` 1811; floating "↩ Back" pill 2468.
- 1-second tick loop: **5350-5368**. CRITICAL: the tick skips `render()` only when
  `!state.timeModal && !state.upgradeOpen && !state.drawerOpen && !state.apptModal && !state.medEditor && !state.infoModal && !isEditing`
  (**5365**). Any NEW modal/sheet must join this guard or it gets torn down/rebuilt every second (the exact v27 "flashing ?" bug).
- Bottom sheets pattern: `renderUpgradeModal` 2194 (scrim + `sheetUp` animation + animate-once guard 2165),
  `renderInfoModal` 2170, shared time modal `renderTimeModal` (~2560-2700) driven by `state.timeModal.type`.

### 1.2 Storage & profiles
- `loadJSON`/`saveJSON`: 102-106. License (device-wide, NOT per-profile): `LICENSE_KEY='chemowell-app-license-v1'` 109,
  `getLicense()` 110, `setLicense()` 111, `tierLimit()` 112 (free=1, plus=3, pro=Infinity), `tierLabel()` 113.
- Profiles: `PROFILES_KEY='chemowell-app-profiles-v1'` 116, shape `{ list:[{id,name,createdAt}], activeId }`.
  `initProfiles()` 117 (legacy v1-v4 migration). `profilesState()` 134. `ACTIVE_PROFILE_ID` frozen at boot 135.
  `createProfile(name)` **137-148** — enforces tier limit (139), seeds new profile's prefs with
  `{ patientName, installedAt, tourDone: true }` (**144** — new profiles SKIP welcome + tour), then `location.reload()`.
  `deleteProfile` 149 (never active/last), `switchProfile` 158 (reload). Cross-tab guard 240-245.
- Per-profile keys: `ENTRIES_KEY`/`PREFS_KEY` = `'chemowell-app-p-'+ACTIVE_PROFILE_ID+'-entries-v1'/'-prefs-v1'` **166-167**;
  med config `'-med-v1'` 336; appointments `'-appts-v1'` 216. Any profile's data is readable directly via
  `loadJSON('chemowell-app-p-'+id+'-prefs-v1', {})` — this is how the Account view gets inactive profiles' details.
- Entries: `allEntriesRaw` 172, `notifyEntries` 174 (special-cases `chemo_date` into `state.chemoDates`, strips it
  from `state.entries` — 177-178), `subscribeEntries` 181, `addEntryDB` 187 (generates id, appends, notifies),
  `removeEntryDB` 195. Prefs: `getPrefsDB` 200, `subscribePrefs` 201, `setPrefsDB` 206.
- Boot wiring: prefs subscription **5331-5337** (maps `patientName/tempUnit/weightUnit/installedAt/supportPrompt*` into
  `CONFIG`/state — new prefs fields surface here if they need to live in state); entries subscription 5338-5348
  (defers updates while `timeModal` open via `pendingEntries` 530/535); tour resume **5369**
  (`!tourDone && patientName` → restore `tourStep`); `render()` 5370; SW registration + auto-reload-on-update 5372-5390.
- Factory reset `eraseAllAppData` **312-326** — wipes every `chemowell-app-*` key EXCEPT the license.

### 1.3 Entry schema (how types are distinguished)
Everything is one array of `{ id, medId, dose, mg, ts, ...extras }`; **`medId` is the discriminator**:
- Med doses: `medId` = med id, plus `skipped`, `override`, `overrideReason`, `pills`, `painLevel`.
- Vitals: `temp` (`temp`,`unit`), `weight` (`weight`,`unit`,`weightReason`,`litersDrained`), `blood_pressure` (`sys`,`dia`).
- Markers: `chemo_date` (append-only latest-wins, `loggedAt` — 723-728, 1103, clear = ts:0 entry 3161),
  `cycle_start`/`cycle_end` (menstrual, 1287-1332), `inpatient_start`/`inpatient_end` (+legacy `inpatient`, 1571+).
- Daily check-ins: `bowel_movement`, `appetite` (`value`, `note`, day-keyed ts).
- Symptoms: `medId = 'symptom_'+type` with `symptomType` field — `SYMPTOM_TYPES` **1514** (already includes
  `fatigue` and `skin_reaction`), `logSymptom` 1556-1558, `openSymptomModal` 1562, entries list `symptomEntries()` 1515.

**Every place that dispatches on medId** (all must be reviewed for new types):
`nameOf()` **894** (giant if-chain — new ids display as raw id string if missed);
`entryDoseLabel()` 606; `BYPASS_48H_IDS` **2740** + `bypasses48h()` 2741 (48h edit lock);
Today's day-entries filter **3392** (excludes inpatient/cycle markers);
History `dmap` filter **4667** (excludes inpatient/cycle) and "doses" count filter **4673** (excludes temp/weight/cycle);
`renderTimeModal` type if-chain title ~**2574-2580** and body branches 2597+;
`confirmTimeModal` save if-chain **1228-1266** (`'multi'`/`'period'`/`'symptom'` types — a new type not added here
**silently does nothing on save**); `supportPromptDue()` 290 (counts all entries — fine);
`missedDosesFor` (meds only — unaffected).

### 1.4 Onboarding / welcome
- `renderSetup()` **2131-2155**: single centered card, heart emoji, "Welcome to ChemoWell", one input
  (`setupNameDraft`, module-level var 2120 — deliberately NOT state, so typing never re-renders), "Get started".
- `completeSetup()` **2121-2130**: writes `prefs.patientName` AND mirrors name into the profile object
  (2125-2127 — the established "both places" pattern), then starts the tour (`tourStep: 0`) if `!tourDone`.
- The setup page renders via `root.replaceChildren(page)` (2154) — it re-renders on any `setState` because
  `render()` 2435 routes back into it, so chip-style selections that call `setState({})` will repaint correctly.
- v28 keyboard fix that must not regress: global `focusin` listener **1805-1809** — 320ms-delayed
  `scrollIntoView({block:'center'})` on any input/select/textarea. It's global, so the new onboarding inputs get it
  for free; do NOT add a competing scroll (that's exactly the v28 item-4 tour-scroll fight — generation-token fix).

### 1.5 Menu / drawer (the "3-dot" menu is the hamburger drawer)
There is no literal ⋮ anywhere; the app's menu is the **hamburger drawer** (app-v22): trigger button 1895
(`data-tour="menu-btn"`), `openDrawer/closeDrawer/drawerGo` 1762-1779 (tour-block, focus management, Tab-trap 1780-1796),
`renderDrawer()` **1957-2004**. Items array **1961-1964** currently: Calendar, Settings. Identity header 1977-1986
routes to Settings ("View profile & plan ›"). Footer shows `APP_VERSION` 2000. Drawer is z90, `drawerOpen` is in the
tick guard already.

### 1.6 Menstrual cycle — every surface needing Female-gating
1. Settings toggle "Menstrual cycle tracking" — **4517** (in the Home-screen toggle grid 4509-4518;
   `HOME_PREF_DEFAULTS.cycleTracking: false` **1356** — already opt-in).
2. Home "Period active" banner — **2861-2873** (gated on `homePref('cycleTracking') && cycleActive()`).
3. Reports menu: `reportTypes` filter **4623** (`t !== 'cycle' || homePref('cycleTracking')`).
4. `reportDescriptor('cycle')` **4607-4611**; `renderReportDetail` dispatch **4649**; `renderCycle()` **4752-4784**
   (Start/End buttons + retroactive "+" via `logPeriodForDay('cycle_start','cycle_end','Period')` 4768 → shared
   'period' modal type 1228-1257).
5. Data plumbing that should NOT be gated (legacy entries must keep rendering): `nameOf` 894 (Period Start/End),
   `BYPASS_48H_IDS` 2740, History/Today exclusion filters 3392/4667/4673, `cycle` icon 1703, TEST_MODE comment 547.
6. `daysSinceCycleStart`/`cycleActive` helpers 1289-1332 — pure functions, leave alone.

### 1.7 Chemo-specific UI (candidates to hide for Radiation-only)
- "Treatment schedule" card on Home (chemo_date countdown + calendar picker) — **3146-3178**, toggle
  `showChemoSchedule` 4513, `HOME_PREF_DEFAULTS` 1356.
- Chemo plan banner (T-2…T+1 around `chemo_date`) — **2803-2836** (incl. legacy dex/zofran chips 2814-2833).
- Med-level treatment-window machinery (`treatmentOnly`, `treatmentExcludedNow`) keys off `chemo_date` — leave; it
  simply never fires without a date set.
- Welcome copy "for chemo patients and their caregivers" 2138; Symptoms subtitle 4935 mentions "during or after
  treatment" (already treatment-neutral).

### 1.8 Tour — steps that touch surfaces v33 changes
`TOUR_STEPS` **2260-2271** (10 steps). Resume logic 5369; `startTour` 2276 (Settings "Replay the walkthrough" 4544).
Fragile points:
- Step 0 text ("ChemoWell works best once your medications are in") — fine, but review copy if app is renamed.
- Steps 1-4 target `nav-meds`/`meds-add`/`med-editor`/`nav-home` — unchanged by v33 unless bottom nav changes (don't).
- Step 5 targets `quick-log`; steps 6-8 target `nav-reports`/`nav-inpatient`/`nav-symptoms` — all still exist.
- Step 9 says "the menu (the three lines, top left) → Settings → Replay the walkthrough" — still accurate; if the
  Account item is added to the drawer this copy stays true, no change needed.
- **Real risk:** `completeSetup()` fires `tourStep: 0` (2129) — the new multi-question setup must still end by calling
  the same completion path so the tour still starts exactly once, after the LAST step. Also the tour-resume gate 5369
  keys on `patientName` being set — if the new flow saves the name at step 1 of several, a mid-onboarding reload would
  boot into the main app with the tour started and treatment questions never asked. **Save all prefs in one
  `setPrefsDB` call at final completion, not per-step** (or gate on a new `setupDone` pref).

### 1.9 Support banner (v32) — leave intact
`SUPPORT_LINK`/`SUPPORT_LINK_READY` **70-71** (banner is fully inert until the placeholder link is replaced);
`supportPromptDue` 290-292 (every-20-entries cadence — radiation/skin entries will count, which is fine);
render block 3433-3448. Don't touch; `verify_v29_gate.mjs` asserts it stays hidden.

### 1.10 Version/release mechanics
`APP_VERSION` **4460** (shown in drawer footer 2000 + Settings About 4565); `sw.js:1` `CACHE` (cache-first shell,
old caches deleted on activate; controllerchange auto-reload 5385-5389). README.md version-history table (row per
release, newest on top ~line 14). TEAM.md "Release mechanics checklist" (~line 132): bump both + README row + push +
live-verify with cache-buster. APP_CLAUDE.md hard rules: **no cloud/network writes ever**, keep `TEST_MODE = true` (54).

### 1.11 Test harness conventions
Playwright ESM scripts in `/tmp/*.mjs`, `chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })`,
viewport 390x844-900, served via `python3 -m http.server 8913` from the repo dir, `page.goto('http://localhost:8913/index.html')`.
Existing regression suites (the "38+21 checks"): `/tmp/verify_v27.mjs` (10), `/tmp/verify_v27_regression.mjs` (5),
`/tmp/verify_v28.mjs` (12), `/tmp/verify_v28_dosage.mjs` (11), `/tmp/verify_v29_gate.mjs` + `/tmp/verify_v29_support.mjs`
(21 — these ARE the "v32 suite": v32 shipped by re-pointing the v29 suites; **no file literally named `verify_v32*.mjs`
exists**). NOTE: `verify_v27.mjs:33`, `verify_v28.mjs:23,41`, `verify_v29_gate.mjs:16` all onboard by typing a name and
clicking `button:has-text("Get started")` — see landmine L1.

---

## 2. Recommended approaches per scope item

### 2.1 Onboarding → short profile buildup (name, Male/Female, Chemo/Radiation/Both)
**Recommended: single scrolling card, three fields, one "Get started" button** — extend `renderSetup()` in place.
- Keep the name input exactly as-is (module-level draft, no re-render on type).
- Add two chip-rows (segmented buttons): "Who is this for?" Male / Female; "Treatment type" Chemotherapy / Radiation / Both.
  Chip taps store into module-level drafts (`setupSexDraft`, `setupTreatmentDraft`) then `setState({})` to repaint
  selection state (safe: name input value is restored from its draft; focus loss on the input is acceptable since the
  user just tapped a chip). Total questions: 3 — matches Aaron's "not a lot of questions."
- `completeSetup()` gains: require all three (toast per missing field, same pattern as 2123), then ONE
  `setPrefsDB({ patientName, sex, treatmentType })` + mirror name to profile object as today. Tour start unchanged.
- **Storage: per-profile prefs** (`prefs.sex` = `'male'|'female'`, `prefs.treatmentType` = `'chemo'|'radiation'|'both'`),
  read via tiny helpers `profileSex()` / `treatmentType()` with legacy-safe defaults (see 2.7). Prefs (not the profile
  object) because ALL gating reads happen in the active profile's render path where `getPrefsDB()` is the established
  source (`homePref` precedent 1357), and Account can still read any profile's prefs key directly. Do NOT duplicate
  into the PROFILES_KEY object beyond the existing name mirror.
- Surface into state at boot (5331-5337) if desired, but `getPrefsDB()` reads are cheap and synchronous — helper
  functions reading prefs directly (like `homePref`) are the simpler, established pattern. Recommend helpers only.

**Alternative: multi-step wizard (3 screens).** Prettier, more "app-like", each step trivially focused. Tradeoffs:
more code (step state, back buttons), more chances to regress the v28 keyboard/scroll behavior, and a mid-flow reload
lands half-configured unless a `setupDone` flag gates render() instead of `patientName` (extra migration risk for the
existing check at 2435). Given "few questions," the single card wins.

**New profiles from Settings (createProfile 137)**: add the same two chip-rows to the `addingProfile` inline form
(4496-4499) and pass sex/treatment into `createProfile(name, sex, treatment)` → seed them in the prefs write at 144.
This keeps "new profiles never see welcome/tour" behavior while never creating an un-typed profile.

### 2.2 Radiation session logging ("Session N of M")
**Recommended: one entry per session + planned-total in prefs (derived counting).**
- New entry: `{ medId: 'radiation_session', dose: null, mg: 0, ts, site?: string, note?: string }` via `addEntryDB`.
- Planned total: `prefs.radiationPlannedTotal` (number|null) + optional `prefs.radiationStartedAt`. Session number is
  DERIVED: `entriesFor('radiation_session').filter(e => e.ts <= ts).length` — deleting a mis-logged session
  automatically renumbers; nothing stored goes stale. "Session 14 of 30" = count vs. planned-total at render time.
- Home card "Radiation sessions" (shown when treatmentType is radiation/both, toggleable via new
  `HOME_PREF_DEFAULTS.showRadiation`, default derived from treatmentType — see 2.4): big "Log today's session" button
  (one tap, `simNow()` ts, toast "Session 14 of 30 logged"), guard against double-log same day (confirm inline, same
  arm-then-confirm pattern as override 3234-3241), "+" for backdating via a new `timeModal` type `'radiation'`
  (REQUIRED: add branches to BOTH the title chain ~2574 and the save chain 1228-1266), and a small "Plan: N sessions"
  editor writing `radiationPlannedTotal`.
- New report: add `'radiation'` to `reportTypes` 4623 (gated on treatmentType), `reportDescriptor` 4607-area, dispatch
  4649, and a `renderRadiation(now)` **returning an array** (the v18 renderBloodPressureReport lesson, 4583-4589):
  progress header ("14 of 30 · started Jul 1 · ~3 weeks left" using Mon-Fri math), session list with Remove.
- Wire the id everywhere per §1.3: `nameOf` ("Radiation Session"), `BYPASS_48H_IDS` (sessions are corrections-friendly),
  History doses-count filter 4673 (count sessions separately: "· 1 radiation" in the day summary), Today filter 3392
  (let it show — it's a real event of the day), icons.

**Alternative: store sessionNumber per entry at log time.** Simpler render, but deletes/backdates leave stale numbers
("Session 5" twice) and renumbering logic ends up MORE complex than deriving. Reject. Second alternative — paired
start/end like inpatient — wrong model: a fraction is a moment, not a stay.

### 2.3 Skin-reaction log (site / severity / notes)
**Recommended: extend the existing symptom system** — `symptom_skin_reaction` already exists (1514, dropdown 2608,
color 4907). Add two optional fields to the symptom modal shown only when `symptomType === 'skin_reaction'`
(or for all symptoms, Owner's call): `site` (free text, e.g. "chest, left side") and `severity`
(chips 'mild'|'moderate'|'severe'). Persist on the entry (`logSymptom` opts 1556-1558), display in `symptomRow` 4909-4928
(severity chip colored via NOTICE_TONES) and History rows. Zero new list surfaces, edit/remove/48h-bypass all inherited.
Radiation/both profiles get a "Log skin reaction" shortcut button on the Home radiation card that opens
`openSymptomModal` pre-set to `skin_reaction`.
**Alternative: dedicated `skin_reaction` medId + own report.** More prominent, but duplicates the entire
symptom modal/list/edit machinery and adds another medId to every §1.3 chain. Not worth it for v33.

### 2.4 Treatment-type gating
- Helpers: `treatmentType()` → prefs value or `'chemo'` default (legacy = current behavior);
  `hasChemo()` = chemo|both, `hasRadiation()` = radiation|both.
- Radiation-only hides: chemo plan banner (2805 add `hasChemo() &&`), Treatment-schedule card + its Settings toggle
  (3154, 4513 — gate both), dex/zofran chips come free with the banner. Everything else (meds, symptoms, vitals,
  in-patient, calendar) is treatment-neutral — KEEP for radiation patients (they take supportive meds too).
- Chemo-only hides: the radiation Home card, radiation report, skin-reaction shortcut (plain symptom entry still
  available in Symptoms tab — it's already a chemo-relevant symptom type).
- Female-only: gate all six §1.6 items #1-4 on `profileSex() !== 'male'` (i.e., female OR legacy-unset shows the
  OPT-IN toggle; explicit male never sees toggle/banner/report). Force of truth: gate on
  `profileSex()==='female' || profileSex()===undefined` — never delete cycle data, never touch §1.6 item 5.

### 2.5 Account section
**Recommended: new `'account'` view** (not a sheet — it's a real destination): add to `VALID_VIEWS` 520, dispatch in
`renderContent` 2110-2116, drawer item in the items array **1961-1964** (`{ key:'account', label:'Account',
icon: 'profile-ish', helper:'Profiles & plan' }`) — drawer is the app's menu, per §1.5. `renderAccount(now)`:
- Plan card: `tierLabel(getLicense().tier)`, "N of M profiles used" (`profilesState().list.length` vs
  `tierLimit(...)`, "Unlimited" for pro), "View plans" → `setState({ upgradeOpen: true })` (existing sheet).
- Profile list: for each `p` in `profilesState().list`, read `loadJSON('chemowell-app-p-'+p.id+'-prefs-v1',{})` and
  `loadJSON('chemowell-app-p-'+p.id+'-entries-v1',[]).length` → name, sex/treatment badges, entry count, Active badge /
  Switch button (reuse `switchProfile`). Link to Settings for delete (or move the whole Profiles block 4475-4503 here —
  Owner-taste; recommend moving it and leaving a "Manage profiles in Account" link in Settings to avoid two sources).
**Alternative: bottom sheet like Plans.** Cheaper, but profile management has confirm-delete flows and per-profile
detail that outgrow a sheet; sheets also need tick-guard membership. View is safer.

### 2.6 Export
**Recommended: BOTH, cheap versions — CSV download + printable report.**
- Data inventory to export (all per-profile): entries (`allEntriesRaw()` — includes `chemo_date` rows; export raw,
  they're meaningful), med config (`-med-v1`: names/schedules), appointments (`-appts-v1`), prefs subset
  (name, sex, treatmentType, units, radiationPlannedTotal).
- CSV: build in-memory string (columns: date, time, type [`nameOf`-style label], detail [`entryDoseLabel`], value,
  unit, site, severity, note, flags[skipped/override/missed?]), then
  `const url = URL.createObjectURL(new Blob([csv], {type:'text/csv'})); a.download = 'chemowell-<name>-<date>.csv'; a.click()`.
  Blob/object URLs never hit the service worker fetch handler — no caching gotcha. Works installed-PWA and browser.
  **Landmine:** inside the future Capacitor WebView `a[download]` is unreliable — acceptable now (web beta), leave a
  `TODO(Capacitor: Filesystem/Share plugin)` comment.
- Printable report: `window.print()` on a dedicated print body — inject a `@media print` stylesheet that hides
  `#root` chrome, or (simpler and recommended) `window.open('', '_blank')` + `document.write` of a clean
  self-contained HTML summary (patient header, date range, day-by-day table, radiation progress, symptom log) then
  `print()`. Avoids fighting the app's fixed header/nav/z-indexed layers entirely. No SW involvement (about:blank).
- Placement: "Export" section in Settings (and/or a button in Account) with range chips (30/90 days/All).
- **TIER DECISION REQUIRED (flag to Owner/PM):** the Plans sheet already sells "PDF / CSV export for doctor visits
  (coming in beta)" as a **Plus** feature — index.html:**2247**. Either gate export on `getLicense().tier !== 'free'`
  (with upsell → `upgradeOpen`) or reword the Plus card. Do not ship both a free export and that Plus bullet.
**Alternative: single JSON backup file.** Cheapest, doubles as the promised "Backup & transfer" Plus feature, but not
doctor-readable — good v34 candidate, not a substitute for CSV/print.

### 2.7 Existing-profile migration (pre-v33 profiles lack sex/treatmentType)
**Recommended: default-open + one-time dismissible prompt. No blocking modal, no forced re-onboarding.**
- Missing `sex` → treat as "unspecified": cycle toggle stays visible (exactly today's behavior — zero regression);
  only explicit `'male'` hides it.
- Missing `treatmentType` → treat as `'chemo'` for gating (today's behavior: chemo UI shown, no radiation UI).
- On Home, if `prefs.patientName && (prefs.sex === undefined || prefs.treatmentType === undefined) && !prefs.profilePromptDismissed`:
  one soft info-tone card (NOTICE_TONES.info, same pattern as support banner 3433) — "Finish your profile: 2 quick
  questions" with the same chips inline + an × writing `profilePromptDismissed: true`. Answering writes the prefs and
  the card never returns.
- `eraseAllAppData` (312) needs no change (prefs wiped wholesale). `createProfile` handled in §2.1.

### 2.8 Redesign polish (scope-controlled)
Limit to: welcome-screen restyle to fit the new fields; drawer gains Account; Settings Profiles block possibly moves
to Account; rename strings ONLY if the Owner confirms "ChemoRad Therapy Companion" this release (name appears at
2136, 2138, 1897, 4565, 2244, manifest.webmanifest, README — plus `setToast('Welcome to ChemoWell')` 2128; keep
localStorage key prefixes `chemowell-app-*` UNCHANGED regardless, they're storage identity, not branding).

---

## 3. LANDMINES (numbered — Lead Dev must check each off)

- **L1 — Onboarding change breaks every regression suite.** All four suites onboard via name +
  `button:has-text("Get started")` (verify_v27.mjs:33, verify_v28.mjs:23,41, verify_v29_gate.mjs:16; v27_regression
  reuses saved state). If sex/treatment are REQUIRED, those clicks toast-and-stop and 38+21 checks cascade-fail.
  Either (a) update the suites' onboarding preamble to tap two chips first (preferred — the requirement is real), or
  (b) make the fields defaultable. Decide explicitly; do not discover this at verify time.
- **L2 — Silent fall-through in the timeModal chains.** A new `m.type === 'radiation'` must be added to BOTH
  `confirmTimeModal` (1228-1266) and `renderTimeModal`'s title/body chains (~2574+). Missing the save branch = the
  sheet opens, Save does nothing, no error. Same class: `nameOf` 894 (raw-id display), History summary 4673
  (radiation sessions silently counted as "doses"), `BYPASS_48H_IDS` 2740 (sessions permanently locked after 48h).
- **L3 — Tick-guard membership.** Any new sheet/modal state flag must join line **5365** or it rebuilds every second
  (v27 bug class). If radiation logging rides `state.timeModal`, it's covered for free — a reason to prefer that.
- **L4 — Full re-render focus loss.** Never store in-progress text input in `state` for the setup flow; use
  module-level drafts (existing pattern: `setupNameDraft` 2120, `newProfileNameDraft` 136, `state.bowelInput`-style
  mutation-without-setState 2906). Chip taps may `setState({})`; keystrokes must not.
- **L5 — v28 keyboard-scroll fix (1805-1809).** Global focusin → delayed scrollIntoView. Do not add per-field scroll
  handlers in the new onboarding; if the setup card grows taller than the keyboard-shrunk viewport, make the page
  container scrollable (`minHeight:100vh` + centered flex currently — verify with keyboard open at 390x844).
- **L6 — Partial-onboarding reload.** render() gates on `patientName` alone (2435) and tour-resume on
  `patientName && !tourDone` (5369). Write name+sex+treatment in ONE `setPrefsDB` at the end (§2.1) so a reload
  can never land half-onboarded.
- **L7 — createProfile bypasses welcome** (144 seeds `tourDone:true`): Settings-created profiles must capture or
  default sex/treatmentType (§2.1), else every added profile is permanently "legacy-unset."
- **L8 — chemo_date is stripped from `state.entries`** (177-178): the exporter must read `allEntriesRaw()` (or also
  walk `state.chemoDates`), not `state.entries`, or treatment dates vanish from exports.
- **L9 — License is device-wide, profiles are per-device** (108-113): Account copy must say "plan for this device,"
  not per-profile. `tierLimit('pro') === Infinity` — don't print "N of Infinity."
- **L10 — Support banner (v32) stays inert-gated**: don't touch `SUPPORT_LINK` 70; `verify_v29_gate.mjs` asserts
  hidden-at-100-entries with the placeholder link.
- **L11 — Reports functions must return arrays** (`renderReportDetail` spreads `...content` 4658; the v18
  BP TypeError, 4583-4589). `renderRadiation` returns `[ ... ]`.
- **L12 — Existing suites' selectors**: `verify_v29_*` also assert entry-count-driven banner cadence by seeding
  `chemowell-app-p-p1-entries-v1` directly; new default Home cards for the p1 profile could shift text assertions
  (`root.textContent.includes(...)`) — run all suites before AND after, diff failures to intent.
- **L13 — Release ritual** (TEAM.md ~132): bump `APP_VERSION` 4460 + `sw.js` CACHE + README row together, push,
  live-verify with cache-buster. Missing README row = automatic PM-gate fail (precedent: v11, v17).
- **L14 — No cloud, ever** (APP_CLAUDE.md rule 1): export is Blob/print only; no fetch, no share endpoints.
  Keep `TEST_MODE = true` (54).

---

## 4. Definition of Done

**New behavior that must work (each verified in a fresh Playwright run at 390x844, plus one desktop pass):**
1. Fresh install → welcome asks exactly: name, Male/Female, Chemo/Radiation/Both → Get started → tour starts once;
   all three values persisted in one prefs write; reload mid-flow never lands half-onboarded.
2. Female + (chemo|both): cycle toggle available (still opt-in, default off). Male: toggle, banner, and Cycle report
   absent everywhere (§1.6 items 1-4); pre-existing cycle entries still render by name in any legacy views/history.
3. Radiation and Both profiles: Home radiation card; "Log today's session" produces "Session N" (or "N of M" once a
   planned total is set); backdate + delete renumber correctly; Radiation report shows progress + list; skin-reaction
   quick log captures site/severity/note and appears in Symptoms + History.
4. Radiation-only profiles: no chemo plan banner, no Treatment-schedule card, no its Settings toggle; meds/vitals/
   symptoms/in-patient/calendar all still fully functional.
5. Chemo-only profiles: zero radiation UI anywhere; app behaves byte-for-byte like v32 (modulo Account/Export/welcome).
6. Drawer shows Account; Account lists every profile (name, sex/treatment badges, entry count, Active), shows plan
   name and "N of M profiles," opens Plans sheet; Switch works; tier limit still enforced on create (139).
7. Export produces a downloadable CSV whose row count matches `allEntriesRaw().length` (including chemo_date rows)
   and a printable report that opens and prints without app chrome; both work with SW active (cache-buster load);
   tier-gating matches whatever the Owner decides re: the Plus bullet at 2247.
8. Pre-v33 profile upgraded in place: everything renders exactly as v32 did, one dismissible "finish your profile"
   card appears, answering or dismissing it is permanent.

**Regressions that must NOT happen:**
- All existing suites pass (after the L1-sanctioned onboarding-preamble update ONLY — no assertion deletions):
  `/tmp/verify_v27.mjs`, `/tmp/verify_v27_regression.mjs`, `/tmp/verify_v28.mjs`, `/tmp/verify_v28_dosage.mjs`,
  `/tmp/verify_v29_gate.mjs`, `/tmp/verify_v29_support.mjs` — 38+21 checks, zero console errors.
- Tour completes end-to-end on a fresh profile (all 10 steps incl. skip-step and Finish→Home, v28 items 6-8).
- Keyboard-open field visibility on onboarding + med editor (v28 items 1-2) unchanged.
- Med logging, missed-dose banners/History, in-patient, appointments, units conversion, profile switch/delete,
  erase-all (license survives), plans simulation — all unchanged.
- `TEST_MODE = true` intact; no new network calls; `APP_VERSION`/sw CACHE/README row bumped together to app-v33.
