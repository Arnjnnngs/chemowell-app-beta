# COMBINED_VERIFY_v13 — Designer + QA User Zero + Auditor (lean pass, TEAM.md Owner amendment)

Date: 2026-07-24 · App: ChemoWell APP-BETA v13 (`index.html`, served at :8877) · Method: real Playwright clicks, Chromium 1194, 390x844 mobile.

## VERDICT: **STOP** — fail-fast on a MAJOR defect (audit spot-check, Custom placement option)

Per the fail-fast protocol, verification halted at the first MAJOR defect. Design pass, QA tour pass, remaining audit checks, and the smoke suites were **not** run to completion and are NOT signed off.

## The defect

**Custom (current mix) is unreachable after switching away — the escape hatch the option exists for does not work, and saving then silently rewrites the patient's Home layout.**

- Where: `index.html` line 2958. The Custom row renders only when `placementOf(form) === 'custom'` — the **live derived** value — instead of when the med's loaded `_origPlacement` snapshot (line 2682) is non-canonical, which is what DEV_BRIEF_v13 §1.4 and Done criterion 3 specify ("restores the original booleans when re-selected after tapping another option").
- Reproduced with real clicks (script `/tmp/verify_custom.mjs`):
  1. Seeded a legacy multi-group med: `quickLog:true, groupedMorning:true, groupedEvening:true` (a legal combo from earlier versions).
  2. Opened its editor → picker correctly shows 6 rows with **Custom (current mix)** selected. Screenshot: `outputs/verify-v13-audit-custom-initial.png`.
  3. Tapped **Morning meds group** → the Custom row **disappears from the radiogroup entirely** (5 rows remain). Screenshot: `outputs/verify-v13-audit-custom-after-switch.png`.
  4. There is now no in-form path back to the original mix. Tapping Save stored `{quickLog:false, groupedMorning:true, groupedAfternoon:false, groupedEvening:false}` — the med's Quick Log card and Evening-group row are silently gone from Home.
- Why MAJOR: this is verbatim the audit spot-check ("switch to another option → switch BACK to Custom → save → exact original booleans restored") and it cannot pass — the control to switch back does not exist. It violates DEV_BRIEF_v13 Done criterion 3 and defeats the stated safety rationale for Custom ("a user who taps 'Morning meds group' by accident can get back to their old mix without discarding" — §1.4). For a chemo patient with a legacy multi-spot layout, one mis-tap + Save is an unrecoverable-in-form, silent rewrite of their Home screen — exactly the quiet-data-change class TEAM.md exists to prevent. Discard-and-reopen is the only recovery, and nothing tells the user that.

## Suggested fix (for the Developer; no code was modified)

Gate the Custom row on the snapshot, not the live value — e.g. compute `placementOf(form._origPlacement) === 'custom'` (or store a `_origIsCustom` flag at form build) and concat the Custom option whenever that is true, with `aria-checked` still driven by `placementOf(form) === 'custom'`. `setPlacement('custom')` already restores `_origPlacement` correctly (lines 2869–2882), so only the render condition at 2958 needs to change. Re-run this full combined pass after the fix.

## Notes observed before the stop (minor, not gating — fold into the fix round)

- The Custom helper text is the generic "Keeps this medication's existing multi-spot layout exactly as it is." — the brief (§1.5) specified it spell out the actual mix, e.g. "Own card + Morning group + Evening group". Worth doing in the same fix since the user deciding whether to tap back to Custom needs to know what it restores.
- Positive: initial render of Custom for a non-canonical med is correct (present + selected + radio dot); canonical option taps set the booleans exclusively as specced; no console/page errors during the reproduction; picker rows met the 44px minimum in the seeded editor.

## Artifacts

- `outputs/verify-v13-audit-custom-initial.png` — editor at 390x844, 6-row picker, Custom selected.
- `outputs/verify-v13-audit-custom-after-switch.png` — same editor after one tap on Morning: Custom row gone.
- Repro script: `/tmp/verify_custom.mjs` (Playwright, real clicks, storage assertions).

## Re-run after fix

Date: 2026-07-24 · Same method: real Playwright clicks, Chromium 1194, served at :8877. Scripts: `/tmp/verify_custom_fix.mjs`, `/tmp/design_v13.mjs`, `/tmp/qa_v13_fresh.mjs` + `/tmp/qa_v13_home_recheck.mjs`, `/tmp/audit_v13_asneeded.mjs`, plus the required `/tmp/smoke_v13.mjs` and `/tmp/smoke_v12.mjs`. No code was modified.

### VERDICT: **SHIP**

### 1. Defect fix re-verified (real clicks, seeded multi-group med Q+M+E)

The fix at `index.html:2958` — Custom row gated on `placementOf(form._origPlacement)` (the loaded snapshot) instead of the live derived value — closes the defect exactly as specified:

- Editor opens with 6 rows, **Custom (current mix)** selected (radio dot, `aria-checked="true"`). Screenshot: `outputs/verify-v13rerun-custom-initial.png`.
- Tap **Morning meds group** → Custom row **survives** (6 rows remain), Morning selected, Custom unselected. Screenshot: `outputs/verify-v13rerun-custom-after-switch.png`.
- Tap No Home card → tap **Custom** → **Save** → stored booleans are the exact originals `{quickLog:true, groupedMorning:true, groupedAfternoon:false, groupedEvening:true}`. Home still renders all three surfaces.
- Helper now names the actual mix: "Keeps the existing layout: Own card + Morning group + Evening group." (the minor note from the first pass, also fixed).
- Correct scoping intact: after deliberately saving a canonical choice (Evening), the reopened editor shows 5 rows with **no** Custom option; a brand-new med never shows Custom (Own Home card is the default). 8/8 checks PASS, zero console/page errors.

### 2. Design pass — 390x844 and 360x400

All automated checks PASS at both viewports plus a canonical-med control run (15/15): every picker row ≥44px tall (measured 53–69px), Discard/Save ≥44px, zero horizontal overflow, label 13px / helper 12px. Visual review of the screenshots: the picker reads as one coherent radiogroup in the app's established card language — selected row gets the plum tint + filled radio glyph, helpers are legible, the Custom row's tinted selected state is unambiguous, and at 360x400 the form scrolls cleanly with the bottom nav intact. Premium and consistent; no design objections.
Artifacts: `outputs/v13rerun-design-390-picker.png`, `-390-editor-full.png`, `-360x400-picker.png`, `-360x400-editor-full.png`, `-390-canonical-picker.png`, `-390-canonical-editor-full.png`.

### 3. QA User Zero — fresh first run, tour, one med per placement

- Full first-run at 390x844 via real actions: welcome → name "Riley" → Show me → Meds → Add → **new form filled through the tour** (slim banner stays up, picker taps mid-tour don't break it; new-med picker = 5 rows, Own Home card pre-selected, no Custom) → Add medication reachable and clickable → Home → Next×4 → Finish. `tourDone:true` persisted. PASS.
- One med per placement via the real Add flow: own (Ondansetron), morning (MorningMed), evening (EveningMed), none (HiddenMed). Stored booleans are exactly canonical for each. Home renders each correctly — own card in Quick Log, morning/evening meds as exactly one row inside their group cards (not in Quick Log), none-placement med fully absent from Home — and the Meds tab shows **"Managed only (no Home card)"** for HiddenMed. Screenshots: `outputs/v13rerun-qa-home-placements.png`, `outputs/v13rerun-qa-meds-managedonly.png`.
- Note on method: the first QA script run reported 3 false failures from my own assertions (the "HiddenMed added…" save toast still on screen, and `innerText` returning the CSS-uppercased "MORNING MEDS"). Re-checked with corrected assertions against the same stored state: 5/5 PASS. App behavior was correct throughout — screenshot evidence confirms.

### 4. Audit

- **gap↔win with asneeded selected never resets scheduleMode on save** (real clicks, 10/10 PASS): gap+asneeded med flipped gap→win→gap→win→gap then saved → `scheduleDays:{mode:'asneeded'}` intact, `alerts:false`; win+asneeded med flipped to gap and back then saved → still `win` + asneeded + `alerts:false`, windows intact. Dynamic labels swap live ("No set days" ↔ "As needed — don't flag missed doses"); contextual helper appears only when mode=asneeded and switches wording with type; Discard leaves storage untouched.
- **`node --check` extracted module**: the single inline script (279,873 bytes) extracted from `index.html` → SYNTAX OK.
- **`/tmp/smoke_v13.mjs`**: 16/16 — **ALL PASS** (round-trip byte-idempotence incl. multi-group and win/asneeded, Custom survives switching, switch-back restores exact mix, helper names the mix, relabels, no overflow, zero errors).
- **`/tmp/smoke_v12.mjs`**: 25/25 — **ALL PASS** (full tour at 390x844 AND 360x400 keyboard height, gap-field placeholder, banner mode, Discard-steps-back; zero errors).

### Minor notes (non-gating, for the next round)

1. The "Home screen order" caption (`index.html:2985`) still reads "Grouped Morning/Evening meds aren't included here" — DEV_BRIEF_v13 §1.5 asked for "Morning/Afternoon/Evening" while in the area. Pre-existing copy gap, two-word fix; afternoon-grouped meds are correctly excluded from the list, only the caption under-describes.
2. Picker row heights vary 53–69px with helper-text wrapping (all ≥44px). Acceptable; equalizing would be pure polish.
3. The save toast can briefly overlap the Quick Log card header on Home (standard toast behavior, self-dismisses) — cosmetic, pre-existing.
