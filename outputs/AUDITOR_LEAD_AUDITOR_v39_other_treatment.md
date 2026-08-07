# Combined Auditor + Lead Auditor report — v39 "Other" treatment-type onboarding option

Scope: index.html v39 changes (treatmentType() docs, FAQ wording, welcome-screen headline/chip
row, legacy-migration chip row, `treatmentLabel(t, short)`). Verified live at
http://127.0.0.1:8936/index.html via Playwright/Chromium (390x844 mobile, 1280x900 desktop), plus
full line-by-line code read of every touched location and every call site of the functions named
in the brief. Screenshots in `/home/claude/chemowell-app-beta/outputs/v39-audit-evidence/`. Test
script: `/home/claude/chemowell-app-beta/outputs/v39_auditor_live_tests.mjs` (re-runnable).

## Overall verdict: PASS

Zero Critical/High/Medium findings. One pre-existing (not v39-introduced), out-of-scope
environmental observation is noted below for completeness but does not affect the verdict.

---

## Front 1 — Line-by-line code audit

Read/verified directly against current index.html (not just the brief's line numbers, which were
accurate):

- `treatmentType()` — index.html:1461 — comment now documents `'chemo' | 'radiation' | 'both' |
  'other' | ''`. Implementation unchanged: `getPrefsDB().treatmentType || ''`. Confirmed `'other'`
  is a real truthy string distinct from `''` — no risk of the two being confused by `||` or `!`
  coercion (`'other'` is truthy, `''` is falsy, and every gate below relies on exactly that).
- `hasRadiation()` (1462) and `isRadiationOnly()` (1464) — both do exact string equality against
  `'radiation'`/`'both'`. `'other'` falls through both as `false`, i.e. NOT radiation — correct
  per the brief. Verified live: an `'other'` profile shows no Radiation-sessions card (Front 2,
  Journey 4/5).
- `needsProfileCompletion()` (1468) — `!!(p.patientName||'').trim() && (!p.sex || !p.treatmentType)`.
  For `treatmentType: 'other'`, `!p.treatmentType` is `false` (truthy string), so the nag
  correctly does NOT re-trigger — confirmed live in Journey 2 (migration card disappears after
  Save with `'other'` picked, `needsProfileCompletion()`'s implicit re-render doesn't resurrect
  it). For legacy `''`/unset profiles, `!p.treatmentType` is still `true` and the nag still shows
  — no regression to the pre-v39 legacy path (Journey 2 seeded exactly this state and it rendered
  the migration card as expected before either chip was picked).
- `setupChipRow('Treatment type', [['chemo','Chemo'],['radiation','Radiation'],['both','Both'],
  ['other','Other']], ...)` — index.html:2434. Correct order, correct value/label pairs, chip
  builder itself (2406-2416) is generic and treats all 4 options identically (`on = current ===
  val`), no special-casing needed or present.
- Legacy migration card chip row — index.html:3116-3120 — 4 `chipBtn(...)` calls, `curTreat ===
  'other'` wired to `migrateTreatDraft = 'other'`, matches the welcome screen's pattern exactly.
  Draft variables (`migrateSexDraft`/`migrateTreatDraft`) are correctly reset to `''` only on
  successful Save (3124), so a picked-then-abandoned `'other'` draft doesn't leak into a later
  session — matches existing pattern for the other 3 values, no new bug surface.
- `completeSetup()` (2390-2404) — validates `setupTreatmentDraft` truthiness only
  (`if (!setupTreatmentDraft) {...}`), no chemo/radiation-specific special casing. `'other'`
  passes this check identically to the other 3 values, confirmed live (Journey 1, Journey 3).
- `treatmentLabel(t, short)` — index.html:5195 — exactly 2 call sites in the whole file, confirmed
  by exhaustive grep (`grep -n "treatmentLabel("`):
  - index.html:5298 — print-report subtitle, `treatmentLabel(treatmentType())` — no second arg,
    so `short` is `undefined`/falsy → `'other'` renders as full `'Other treatment'`. Correct per
    the Lead Designer's v39 sign-off fix.
  - index.html:5364 — Account → Profiles list, `treatmentLabel(pp.treatmentType, true)` — `short`
    is `true` → `'other'` renders as short `'Other'`. Confirmed live: "Other · 0 entries" renders
    as a single 14px line, on par with "Chemo · 0 entries" and "Radiation · 0 entries" (screenshot
    `14-account-page-390.png`) — the Designer/Lead-Designer wrap bug from the prior round is
    resolved and stays resolved.
  - Chemo/Radiation/Both branches of `treatmentLabel` are unchanged regardless of `short`
    (`'Chemo'`, `'Radiation'`, `'Chemo + Radiation'` — no second dependency on `short` for those
    3), confirmed by reading the one-line ternary chain directly.
- Other `treatmentType()` read sites, checked for any UI that would render oddly for `'other'`:
  - index.html:3459 (`!isRadiationOnly() && homePref('showChemoSchedule')`) — Treatment schedule
    card. Its on-screen copy ("Treatment schedule", "No treatment date set", "Pick a date", "Set
    date"/"Update", "Treatment date cleared") is already fully generic — no literal "chemo" text
    anywhere in this card's rendered strings. Confirmed live for an `'other'` profile (Journey 4/5,
    screenshot `17-other-profile-home-1280.png` — full innerText captured, contains "TREATMENT
    SCHEDULE / No treatment date set / Pick a date" and nothing chemo-specific).
  - index.html:3489 (`hasRadiation() && homePref('showRadiationSessions')`) — Radiation sessions
    card, correctly absent for `'other'` (confirmed live, both mobile and desktop).
  - index.html:3178 ("Chemo plan banner") — gated on `!isRadiationOnly() && chemoOffNow !== null`
    (i.e. only appears once a treatment date is set AND within a -2..+1 day window). Its title/body
    copy is already generic ("Treatment on ...", "Treatment tomorrow", "Treatment day", "Recovery
    day", "the care team"). The banner's Dexamethasone/Zofran regimen chips (3198-3206) are
    additionally gated on `state.meds.some(m => m.id === 'dexamethasone'/'zofran')` — those exact
    reserved IDs (index.html:4005 `RESERVED_LEGACY_MED_IDS`) can only exist on a device via
    pre-v33 legacy migration, never via a fresh `'other'` (or any new) profile's own med-adding
    flow, since `RESERVED_LEGACY_MED_IDS` blocks user-created meds from claiming those IDs
    (4005-4010). So a new `'other'` profile can never see the chemo-specific dex/Zofran chips —
    this surface is a pre-existing (not v39) design already immune to the concern.
  - index.html:5089-5090 (Settings toggles) — labels "Treatment schedule card" / "Radiation
    sessions card" are already generic, no chemo-specific wording, gated the same way as the Home
    cards (no change needed, none made).
  - Tour (`TOUR_STEPS`, 2556-2567) — read in full; copy is entirely feature-navigation (Meds tab,
    Add medication, Home, quick-log, Reports, In-Patient, Symptoms) with zero treatment-type or
    chemo/radiation-specific text. No v39-relevant gap.
  - Reserved-word grep for `chemo` (case-insensitive, excluding the "ChemoWell" brand name) turned
    up nothing else that reads oddly for a generic "other" user beyond what's covered above; all
    remaining hits are internal variable/function names (`chemoTs`, `chemoOffsetFor`,
    `setChemoDate`, etc.) or brand-name copy explicitly out of scope per the brief
    (manifest/package.json).
- FAQ item — index.html:1789 — "How do I set a treatment date?" body text also already reads
  generically ("Treatment-day only" / "Excluded near treatment day"), no lingering
  "chemo/radiation" parenthetical. Matches the brief's intended edit.
- Welcome-screen headline — index.html:2424 — "...people managing chemo, radiation, or another
  ongoing treatment — and their caregivers." Reads naturally for a non-oncology user while keeping
  the cancer-care framing, matches the brief's intent.

No logic errors, off-by-one/wrong-branch conditionals, leftover debug values, or `''`/`'other'`
confusion found anywhere in the touched code or its consumers.

---

## Front 2 — End-to-end live journeys (Playwright, both viewports)

All 6 required journeys were run live against a running server, seeding `localStorage` directly
for the multi-profile/legacy scenarios (`chemowell-app-profiles-v1` +
`chemowell-app-p-<id>-prefs-v1`/`-entries-v1`), matching the pattern used in the Designer chain.

1. **Fresh install → "Other" → complete onboarding → use app.** Name "Casey Other", sex Female,
   treatment Other → Get started. `localStorage` prefs after setup:
   `{"treatmentType":"other","sex":"female","patientName":"Casey Other",...}`. Home rendered with
   no console/page errors; navigated to Meds, added a medication ("Test Med Other"), it appeared
   on Home with no errors. Screenshots `01`–`07`.
2. **Legacy profile missing sex/treatment → migration card → "Other" → Save → usable.** Seeded a
   profile with prefs containing no `sex`/`treatmentType` keys at all. Migration card appeared
   with all 4 chips (`["Chemo","Radiation","Both","Other"]` confirmed via DOM text). Picked Male +
   Other, Save → prefs became `{"sex":"male","treatmentType":"other",...}`, "Finish setting up
   this profile" card count dropped to 0 immediately after save (no reload needed), Meds tab
   remained fully usable. Screenshots `08`–`11`.
3. **Chip re-selection / draft correctness, welcome screen.** Selected Other (`aria-pressed`
   confirmed `true`), then switched to Chemo — `aria-pressed` correctly flipped (`Chemo=true`,
   `Other=false`), then completed setup: final persisted `treatmentType` was `"chemo"`, matching
   the last selection, not a stale draft. No double-write of `'other'` anywhere.
3b. **Chip re-selection, migration card.** Same test in the opposite direction (Chemo → Other) on
   the migration card: after switching, `Other` pressed=`true`, `Chemo` pressed=`false`, Save
   persisted `treatmentType:"other"` correctly — single source of truth (`migrateTreatDraft`), no
   stale/ghost selection.
4. **Multiple profiles, one 'other' one 'chemo', switch via Account, no bleed-through.** Seeded
   Alice (chemo) as active and Bob (other) as inactive. Account → Patient profiles list rendered
   both rows correctly and distinctly: "Chemo · 0 entries" (Alice, single line) and "Other · 0
   entries" (Bob, single line) — visually confirmed in screenshot `14-account-page-390.png`, both
   14px-tall rows, no wrap, no cross-contamination of labels. Tapped Switch on Bob →
   `chemowell-app-profiles-v1.activeId` became `"pB"` correctly; Home re-rendered for Bob (Other)
   with the Radiation-sessions card absent and Treatment-schedule card present and generic
   ("TREATMENT SCHEDULE / No treatment date set / Pick a date"). No state bled over from Alice's
   chemo profile.
5. **Radiation card hidden / Treatment-schedule copy check, desktop 1280x900.** Seeded a
   standalone `'other'` profile. Full page `innerText` captured and reviewed: `"...TREATMENT
   SCHEDULE\nNo treatment date set\nPick a date..."` with no "Radiation sessions" text anywhere and
   no chemo-specific wording in the visible card copy (matches Front-1 code-read finding above).
6. **Double-tap / rapid-click race conditions.**
   - Welcome screen: double-clicked the "Other" chip, then triple-clicked "Get started"
     concurrently (`Promise.allSettled`, no artificial delay). Result: exactly 1 profile created
     (`chemowell-app-profiles-v1.list.length === 1`), prefs correctly show
     `treatmentType:"other"` — no duplicate profile, no split/partial write, no v37-style
     duplicate-entry bug reproduced.
   - Migration card: triple-clicked the "Other" chip, then triple-clicked "Save" concurrently on a
     legacy profile. Result: prefs correctly settled to `treatmentType:"other"`, exactly one
     "Profile updated" toast fired, migration card count went to 0 (not re-shown, not duplicated).

**Console/page errors across all 6 journeys, both viewports:** zero JavaScript exceptions
(`pageerror` listener never fired in any journey). The only console-level messages captured in any
journey were browser-level `"Failed to load resource: net::ERR_TUNNEL_CONNECTION_FAILED"` /
`net::ERR_FAILED` entries. Isolated separately (see below) — these are **not** app JS errors and
**not** a v39 regression.

### Note (informational only, not a finding): pre-existing sandbox network noise
A completely vanilla page load with zero interaction (verified with a bare Playwright load, no
localStorage seeding, no clicks) already produces the same two failed requests:
`https://cdn.jsdelivr.net/npm/@capacitor/core@8.4.2/dist/capacitor.js` and
`.../@capacitor/local-notifications@8.2.1/dist/plugin.js`, both `ERR_TUNNEL_CONNECTION_FAILED` —
this is the sandbox's outbound-network/proxy configuration blocking the jsdelivr CDN, unrelated to
any application code and unrelated to treatment type. The app already handles this gracefully
(no capacitor plugin calls are unconditional; every journey above completed with fully correct
behavior despite these two failed CDN loads). Not actionable, not in scope for a re-audit.

---

## Findings

**None.** No Critical, High, Medium, or Low severity issues were found in either the code audit or
the live journeys. What was tried, beyond the required checklist:
- Exhaustive grep-based enumeration of every `treatmentType()`, `hasRadiation()`,
  `isRadiationOnly()`, `needsProfileCompletion()`, and `treatmentLabel(` call site in the file
  (not just the ones named in the brief), and hand-verification of each.
- Investigated whether the chemo-specific Dexamethasone/Zofran plan-banner chips could ever leak
  into an `'other'` profile's Home screen (they cannot, by construction of
  `RESERVED_LEGACY_MED_IDS`).
- Verified the previously-flagged Designer/Lead-Designer wrap bug (`treatmentLabel` short/long
  split) is durably fixed in the shipped code, both by reading the source and by re-measuring the
  rendered row live.
- Rapid double-click races on both onboarding surfaces, in both directions (chip-then-submit).
- Cross-profile switching between a `'chemo'` and an `'other'` profile via the real Account UI
  (not just localStorage inspection) to rule out render bleed-through.
- Legacy (`''`) profile regression check to confirm the pre-v33 sentinel behavior is untouched.

## Verdict: PASS — safe to ship as-is.
