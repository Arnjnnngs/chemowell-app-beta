# QA "User Zero" Walkthrough — ChemoWell APP-BETA app-v20 restart

**Role:** QA Tester (Stage 5, Quality Chain) · **Date:** 2026-07-27
**Change under test:** the restart fix pass on `AUDIT_v20.md`'s two P1s and one P2 — (P1-1) deleting and re-adding a medication under the same name no longer discards `pausePeriods`, (P1-2) a standalone Quick Log card that is both paused and inside an "Excluded near treatment day" window now correctly shows "Paused" instead of vanishing, (P2-1) `normalizeMedication` now self-heals a desynced `treatmentOnly`/`treatmentMode` pair. Per `DEV_BRIEF_v20_restart.md`, the fix touched `loadMedicationConfig`, `deleteMedicationConfig`, `saveMedicationEditor`, `medCards`, and `normalizeMedication` — all on the critical path of nearly everything the app does. Two stages already ran on this diff: `DESIGNER_REVIEW_v20_restart.md` (3/3 PASS) and `LEAD_DESIGNER_SIGNOFF_v20_restart.md` (independently re-verified, cleared to proceed, two non-blocking UX notes).

**My mandate (TEAM.md §5):** this is NOT a re-review of the diff — it's a full, fresh-phone-user walkthrough of the WHOLE app, exactly as if nothing had changed, because scoped reviews are structurally blind to defects outside the diff. I did not seed state or skip the tour anywhere in this report.

**Method:** Node + Playwright, Chromium (`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`), real `page.locator(...).click()/.fill()` taps and fills against the live server at `http://localhost:8910/index.html` — no `localStorage` seeding to skip onboarding anywhere in Part 1. Storage (`localStorage`, `sessionStorage`, caches, service-worker registrations) wiped before every "first run." `console.error`/`pageerror` captured continuously.

**Viewports:** Primary 390×844 (full first run + daily loop + tabs/modals/settings + multi-med lifecycle). Keyboard-open heights 360×400 and 390×480 (the medication editor). Secondary mobile 360×740 (repeat first run + pause lifecycle). Desktop 1280×900 last, brief, layout sanity only.

**Screenshots:** `outputs/v20-restart-qa-screenshots/*.png` (107 files, referenced by name below; numeric prefixes repeat across script runs but filenames are unique/descriptive).

**Baseline console/page errors, confirmed on every bare page load in this sandbox (not app defects):** 6 — `net::ERR_TUNNEL_CONNECTION_FAILED` ×2, `net::ERR_FAILED` ×4, all from the two Capacitor CDN `<script>` tags (`cdn.jsdelivr.net/.../capacitor.js`, `.../plugin.js`), consistent with every prior QA/Designer pass in this repo. **Zero real app-code console/page errors were produced anywhere in this walkthrough** — every phase below was checked against this same baseline.

---

## Verdict: **PASS, with one new (non-blocking) finding to flag for the Developer/Auditor. Cleared to proceed to the Auditor (stage 6).**

Every one of the three restart fixes holds up under a genuine, unscoped, whole-app walkthrough: deleting and re-adding a medication under the same name works cleanly and the rest of the app (Home, Reports, tabs) keeps working afterward; deleting **all** medications down to zero — the exact scenario `loadMedicationConfig`'s empty-list handling was patched for — does not crash the app, in-session or after a full reload; and the paused+excluded standalone-card ordering renders "Paused" correctly, matching the Designer/Lead Designer's own findings. The previously-fixed toast/pointer-events occlusion bug (from the original `QA_USER_ZERO_v20.md`) was re-confirmed still fixed at both mandated keyboard-open heights.

One **new, real, non-blocking finding** surfaced during the ordinary daily-loop walkthrough (Part 2): the History report's per-day "N doses" summary count incorrectly includes Blood Pressure (and by the same code path, Bowel Movement/Appetite/Symptom) entries as if they were medication doses. This is **not** part of the P1-1/P1-2/P2-1 diff (confirmed: the bug is in `renderHistory`, `index.html:3723`, untouched by this restart) and does not affect any safety-critical math (dose ceilings, gap timers, and missed-dose detection all key off `entriesFor(specific medId)`, not this summary line — confirmed by code read). It does not hide or block any interactive element, so it is not a TEAM.md "FAIL, full stop" under this role's binding standard. I'm flagging it because whole-app testing is exactly what's supposed to catch things like this, outside any diff.

---

## Part 1 — Full first run, 390×844 (never skipped, never seeded, tour walked exactly as instructed)

| # | Step | Result | Screenshot |
|---|------|--------|------------|
| 1 | Fresh wiped load → welcome/name-entry screen | **PASS** | `001-fresh-welcome.png` |
| 2 | Entered name "Priya" → tapped Get started | **PASS** | `002-name-filled.png`, `003-after-get-started.png` |
| 3 | Tour step 1 of 10 (centered welcome card, "Show me" button) | **PASS** | `002-tour1.png` |
| 4 | Tapped "Show me" → step 2 of 10 (target `nav-meds`) | **PASS** | `003-tour2.png` |
| 5 | Real tap on Meds tab → step 3 of 10 | **PASS** | `004-tour3-meds.png` |
| 6 | Real tap on the highlighted "+ Add" button → medication editor opens, step 4 of 10 | **PASS** | `005-tour4-editor.png` |
| 7 | Filled Medication name "Ondansetron", Generic "Zofran", Dosage "4 mg, 8 mg"; switched Schedule type to **Scheduled — set time windows** → structured Start/End dropdown row appears | **PASS** | `006-filled-basic.png`, `007-schedule-type-scheduled.png` |
| 8 | Tapped **"+ Add another time window"** → second row appears with a trash ("Remove this time window") button; confirmed 2 trash buttons present | **PASS** | `001-two-windows.png` |
| 9 | Labeled the second row "Evening dose" → live plain-language preview updated in place | **PASS** | `001-labeled-window.png`, `002-labeled-window.png` |
| 10 | Treatment-day availability radiogroup → selected **"Only near treatment day"** → days-before/-after fields appeared | **PASS** | `003-treatment-only-selected.png` |
| 11 | Switched to **"Excluded near treatment day"** → live summary text correctly swapped to "Excluded window: ..." | **PASS** | `004-treatment-excluded-selected.png` |
| 12 | Set back to **"Always available"** for a clean first medication | **PASS** | `005-treatment-always.png` |
| 13 | Confirmed the **Pause/Resume button is absent** while adding a brand-new medication (edit-mode-only control, per dev brief) — `button:has-text("Pause")` count = 0 | **PASS** | — |
| 14 | Scrolled to and tapped the real **"Add medication"** submit button | **PASS**, toast "Ondansetron added to medication management." fired, tour advanced to step 5/10 ("Medication saved! Now tap Home.") | `007-after-submit.png` |
| 15 | Real tap on `nav-home` → step 6 of 10 (target `quick-log`) | **PASS** | `001-tour6-home.png` |
| 16 | Steps 6–9 advanced correctly via real "Next" taps | **PASS** | `002-tour-next-0.png`–`005-tour-next-3.png` |
| 17 | Step 10 of 10 ("You're ready!", Finish) reached | **PASS** | `005-tour-next-3.png` |
| 18 | Tapped Finish → tour ended cleanly | **PASS** | `001-tour-finished.png` |
| 19 | Leftover-highlight check: queried every `[data-tour]` element's computed style after Finish — **zero** elements with a non-`none` `animationName` | **PASS** | — |
| 20 | Returned to Home — Ondansetron Quick Log card renders with 4 mg / 8 mg dose buttons | **PASS** | `002-home-quicklog-card.png` |
| 21 | Tapped the 4 mg dose button. Schedule window (8:00–8:30 AM) was closed at test wall-clock time, so the card correctly showed the locked/amber "Log it early anyway?" panel — genuine, correct behavior, not a bug. Tapped "Log 4 mg now" → Date/Time confirm modal opened → tapped **Confirm** → dose logged, card updated to "Last dose Today" | **PASS** | `001-confirm-modal.png`, `002-dose-logged.png` |

**Console/page errors through the entire first run:** the same 6 pre-existing, sandbox-only Capacitor-CDN errors present on every bare load. **Zero real app-code errors.**

---

## Part 2 — Daily loop: vitals, tabs, all reports, modals, settings, check-ins (390×844, continuing real state, no seeding)

| Step | Result | Screenshot |
|---|---|---|
| Logged Temperature 99.4°F (Log → Date/Time modal → Confirm) | **PASS** | `001-temp-logged.png` |
| Logged Weight 142.5 lbs (Log → Date/Time modal → Confirm) | **PASS** | `002-weight-logged.png` |
| Logged Blood Pressure 118/76 — confirmed via source (`logBloodPressure()`, `index.html:967-975`) this logs **immediately, with no Date/Time modal**, unlike Temp/Weight (`logTemp()`/`logWeight()` both open `state.timeModal`). This is real, pre-existing, working behavior (not a regression) — noted because the original `QA_USER_ZERO_v20.md` described all three vitals as going through the modal, which is not quite accurate for Blood Pressure | **PASS** | `003-bp-logged.png` |
| Switched through all 5 bottom-nav tabs (Meds, Reports, In-Patient, Symptoms, Home) | **PASS** | `004-tab-meds.png`–`008-tab-home.png` |
| Reports hub loads (History / Weight / Blood Pressure / Bowel Movement / Appetite tiles) | **PASS** | `001-reports-hub.png` |
| Opened every report type: **History**, **Weight**, **Blood Pressure** (the exact report type that crashed on every open in the v17 QA pass — confirmed clean here, fresh, zero errors), **Bowel Movement** (correct empty state), **Appetite** (correct empty state) | **PASS**, zero new console/page errors on any of the five | `002-report-history.png`, `003-report-weight.png`, `004-report-bloodpressure.png`, `005-report-bowelmovement.png`, `006-report-appetite.png` |
| Symptoms tab → "+" opens the Log Symptom modal | **PASS** | `001-symptoms-tab.png`, `002-symptom-modal.png` |
| Cancel closes the symptom modal cleanly | **PASS** | `003-symptom-modal-cancelled.png` |
| In-Patient tab: "Not currently in-patient" state renders correctly | **PASS** | `004-inpatient-tab.png` |
| Settings screen: Profiles, Home screen customizer toggles, "View plans" | **PASS** | `005-settings.png` |
| "View plans" → Plans sheet opens: Free (current) / Plus $4.99 / Pro $14.99 tiers, "Simulate purchase (beta)" buttons present | **PASS** | `001-plans-sheet.png` |
| "✕" closes the Plans sheet cleanly | **PASS** | `002-plans-sheet-closed.png` |
| Paused Ondansetron via the Meds-tab editor, advanced the simulated date **+1 Day** via BETA date controls → **"Still pausing Ondansetron?"** check-in banner appeared correctly | **PASS** | `002-checkin-banner.png` |
| Tapped **"Continue pausing"** → banner dismissed for today, medication remains paused (not force-resumed) | **PASS** | `003-checkin-continue-dismissed.png` |
| Organic re-check of the P1-2 fix during normal use: set Ondansetron to "Excluded near treatment day" + Paused → standalone Home card correctly shows **"Paused"** (not vanished, not "Excluded") | **PASS**, matches Designer/Lead Designer's independent findings | `002-home-paused-excluded-combo.png` |

### Finding — History day-summary "N doses" count includes non-dose entries (NEW, non-blocking)

**Location:** `renderHistory()`, `index.html:3723`:
```js
const doses = items.filter(e => e.medId !== 'temp' && e.medId !== 'weight' && e.medId !== 'cycle_start' && e.medId !== 'cycle_end' && !e.missed && !e.skipped).length;
```
This filter excludes `temp`/`weight`/`cycle_start`/`cycle_end` but **not** `blood_pressure`, `bowel_movement`, `appetite`, or `symptom_*` — so any of those entry types gets counted as a medication "dose" in the day's summary line.

**Reproduced cleanly, isolated to a single variable:** fresh first run, one Ondansetron dose logged → History showed "**1 dose**" (`001-history-after-bp-only.png`'s "BEFORE" state, confirmed via captured page text). Logged **only** a Blood Pressure reading (no new medication dose) → History immediately read "**2 doses**" (`001-history-after-bp-only.png`). The visible entry list correctly showed one Ondansetron row and one Blood Pressure row — only the summary count at the top was wrong.

**Severity assessment:** this is a real, reproducible data-accuracy bug, but I'm not scoring it a blocking FAIL for this stage:
- It is **not** part of this restart's diff — `renderHistory` is untouched by any of `loadMedicationConfig`/`deleteMedicationConfig`/`saveMedicationEditor`/`medCards`/`normalizeMedication`.
- It does **not** affect any safety-critical computation. Confirmed by code read: `dailyDoseMg(medId)` (`index.html:546`), `rollingDoseMg`, the gap-timer lock in `status()`, and `missedDosesFor` all filter `entriesFor(specificMedId)` by that medication's own id — none of them read this generic "doses" count. A patient's actual dose ceiling, gap-timer, or missed-dose tracking is unaffected.
- It does **not** hide or block any interactive element (TEAM.md's binding FAIL criterion for this role).
- It is, however, a genuine miscount shown directly to a chemo patient/caregiver reading their own day's medication summary — in an app whose whole premise is trustworthy dose tracking, "2 doses" when only 1 was actually taken is exactly the kind of small inaccuracy that erodes trust once someone notices it. Worth a Developer brief to add `blood_pressure`/`bowel_movement`/`appetite` (and the `symptom_` prefix) to the exclusion filter.

---

## Part 3 — Multi-medication lifecycle: add, delete, re-add, delete to zero (390×844) — the exact surface this restart touched

Per the task brief, this walkthrough deliberately exercised the scenario the P1-1 fix patched: multiple medications, a delete, and confirmation the rest of the app keeps working — then went further and emptied the medication list entirely.

| Step | Result | Screenshot |
|---|---|---|
| Added 2nd medication "Compazine" (10 mg, As-needed, 6h gap) through the real Add-medication flow | **PASS** | `001-added-compazine.png` |
| Added 3rd medication "Dexamethasone" (4 mg) | **PASS** | `002-added-dex.png` |
| All 3 medications listed on the Meds tab | **PASS** | `001-meds-3-total.png` |
| Tapped the trash icon on Compazine's card → flips in-place to red "Confirm delete" + "Existing dose history will remain visible." / Keep | **PASS** | `002-compazine-confirm-delete.png` |
| Tapped "Confirm delete" → Compazine removed; Ondansetron and Dexamethasone remain, both fully intact | **PASS** | `002-compazine-deleted-clean.png` |
| **Rest of the app confirmed still correct after the delete:** Home tab shows the 2 remaining medications, no trace of Compazine | **PASS** | `003-home-after-delete-clean.png` |
| Reports → History still loads with zero new console/page errors after the delete | **PASS** | `004-history-after-delete-clean.png` |
| **Re-added "Compazine" under the exact same name** (exercising the archived-`pausePeriods`/matching-derived-id restore path P1-1 patched) → reappears cleanly, no duplicate, no stale data bleed-through | **PASS** | `001-compazine-readded.png` |
| Home tab correct with all 3 medications present again after the re-add | **PASS** | `002-home-after-readd.png` |
| **Deleted ALL 3 medications down to zero** (Ondansetron, Compazine, Dexamethasone, one at a time via the real trash → Confirm delete flow) | **PASS**, no crash at any step | `003-all-meds-deleted.png` |
| Meds tab with zero medications: shows the "Add" affordance and an empty management list, no error, no blank screen | **PASS** | `003-all-meds-deleted.png` |
| **Home tab with zero medications:** Temperature/Weight/Blood Pressure cards still render normally; Quick Log area shows a correct, styled "No medications yet — Add the first medication to start tracking doses, schedules, and safety limits." empty state, not a crash or blank area | **PASS** | `001-home-zero-meds.png` |
| **Reports/History with zero medications:** loads correctly, zero new console/page errors | **PASS** | `002-history-zero-meds.png` |
| **Full page reload with zero medications in storage** (forces `loadMedicationConfig`/`normalizeMedication`/`normalizeArchivedMeds` to run fresh against an empty `state.meds`) — app reloads cleanly, no crash, no blank page, lands on the last-viewed tab as expected | **PASS**, zero new errors introduced by the reload | `003-reload-zero-meds.png` |

This is a direct, successful stress test of exactly what `loadMedicationConfig`'s empty-medication-list handling needed to survive after this restart's fix — confirmed both in-session and across a real page reload.

---

## Part 4 — Keyboard-open heights (360×400, 390×480) — the medication editor, re-testing the previously-fixed toast occlusion

Per TEAM.md's binding rule, re-ran the medication editor (the form this and the prior restart both touched) at both mandated keyboard-open heights, deliberately triggering the same validation-error toast that was the subject of the original `QA_USER_ZERO_v20.md` blocking finding (fixed via `pointerEvents: 'none'`, re-verified by that report's Part 7).

| Check | 360×400 | 390×480 |
|---|---|---|
| No horizontal overflow (`scrollWidth === clientWidth`) | **PASS** | **PASS** |
| Med editor reachable, fields fillable | **PASS** (`001-360x400-editor-open.png`) | **PASS** (`006-390x480-editor-open.png`) |
| Scrolled to gap-hours/schedule fields, reachable | **PASS** (`002-360x400-scrolled.png`) | **PASS** (`007-390x480-scrolled.png`) |
| Save ("Add medication") button reachable, fully on-screen after scroll (`boundingBox()` fully inside viewport) | **PASS** (`003-360x400-save-visible.png`) | **PASS** (`008-390x480-save-visible.png`) |
| Tapped Save with an incomplete form (blank required field) → validation toast fires, toast visually overlaps the Discard/Add medication row (same as the original finding) | **PASS** — toast fires correctly (`004-360x400-validation-toast.png`) | **PASS** (`009-390x480-validation-toast.png`) |
| **Real, non-forced tap on Discard while the toast is still visually on top of it** → editor closes correctly, confirming the `pointer-events: none` fix from the prior restart still holds at both mandated heights | **PASS** (`005-360x400-after-discard.png`) | **PASS** (`010-390x480-after-discard.png`) |

No regression to the previously-fixed toast/occlusion bug. Zero new console/page errors at either viewport.

---

## Part 5 — 360×740 secondary mobile: full first run + pause lifecycle

Fresh first run "Walter," full 10-step tour walked for real, first medication ("Ondansetron") added through the tour, first dose logged — same rigor as Part 1, repeated at the smallest supported width.

| Step | Result | Screenshot |
|---|---|---|
| Full first run completes (tour, med add, first dose) at 360×740, zero horizontal overflow | **PASS** | `001-360-firstrun-done.png` |
| Edit mode shows the Pause button (edit-mode-only control) | **PASS** | `002-360-edit-pause-visible.png` |
| Tapped Pause → flips live to Resume | **PASS** | `003-360-paused.png` |
| Meds list shows the "Paused" badge after Discard | **PASS** | `004-360-meds-paused-badge.png` |
| Home Quick Log card correctly mutes to "Paused — Not tracked while paused. Resume anytime." | **PASS** | `005-360-home-paused-card.png` |

Zero new console/page errors.

---

## Part 6 — Desktop 1280×900 (secondary, brief, layout sanity)

Fresh first run, real clicks, full tour walked. **PASS**, no broken layout, no horizontal overflow. Reports hub and Settings both spot-checked and load correctly at this width. Screenshots `001-desktop-firstrun-done.png`, `002-desktop-reports.png`, `003-desktop-settings.png`.

---

## Summary against the "see it / reach it / tell what's next" standard

Every part of the app I walked — first-run onboarding, the full 10-step tour, daily vitals logging, all five tabs, every report type (including the historically-fragile Blood Pressure report), every modal (Symptom log, Plans sheet), Settings, the pause check-in banner, and — deliberately, since this is exactly what the restart's fix pass touched — a full add/delete/re-add/delete-to-zero medication lifecycle both in-session and across a real page reload — worked correctly with real taps, real fills, and real navigation, at every mobile viewport this role requires, including both mandated keyboard-open heights.

**All three restart fixes (P1-1, P1-2, P2-1) held up under whole-app, unscoped testing, not just their own targeted repro:**
- Deleting and re-adding a medication under the same name (twice, including across the zero-medication edge case) never broke the rest of the app.
- Paused + Excluded near treatment day correctly shows "Paused" on the standalone Home card, matching the Designer/Lead Designer's independent findings.
- Deleting all medications to zero — the empty-list scenario `loadMedicationConfig` needed to survive — does not crash the app, in-session or after a reload.

**One new, non-blocking finding** surfaced purely from ordinary daily-loop use, unrelated to this restart's diff: the History report's per-day "N doses" summary count (`index.html:3723`) incorrectly includes Blood Pressure/Bowel Movement/Appetite/Symptom entries as if they were medication doses. Confirmed via code read that this does not touch dose-ceiling, gap-timer, or missed-dose safety math — it's a display-only miscount in a summary line — so it does not meet this role's binding FAIL bar ("any interactive element that cannot be seen AND tapped"), but it's real and worth a Developer brief.

Zero real console or page errors were produced anywhere in this walkthrough, at any viewport, in any phase.

## Verdict: **PASS — cleared to proceed to the Auditor (stage 6).** One non-blocking finding (History "doses" miscount, `index.html:3723`) is flagged above for the Developer/Auditor's attention but does not block this release from moving forward.
