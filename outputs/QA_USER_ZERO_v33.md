# QA "User Zero" Walkthrough — ChemoWell v33 (APP BETA)

**Tester role:** first-run user, zero seeded state, full product walk.
**Build:** `/home/claude/chemowell-app-beta/index.html` served at `http://localhost:8913/index.html` (TEST_MODE = true).
**Method:** Playwright/Chromium. Primary form factor 390x844 (phone); critical forms repeated at 390x500 (keyboard-open height); desktop 1280x800 as a final secondary check. Full-tree ~1s re-render workaround (`dispatchEvent('click')`) used where needed — not counted as a user-facing defect.
**Screenshots:** `outputs/v33-qa-screenshots/` (referenced inline).

---

## Overall verdict: **FAIL** (1 first-run blocker; everything else passes)

A brand-new user who taps **Get started** on the welcome screen with a missing field gets **zero visible feedback** — the button appears dead. That is the exact "first screen, first tap" class of defect this role exists to catch. Full detail in step 1.3. Every other flow in the product — both personas, the full tour, radiation tracking, day-2 loop, all reports, export, keyboard-height forms, the migration card, desktop — passed.

**Console errors:** 0 JavaScript/page errors from the app across every session. The only console errors were network resource-load failures for the two Capacitor CDN scripts (`cdn.jsdelivr.net/npm/@capacitor/core@8.4.2`, `@capacitor/local-notifications@8.2.1`) blocked by this sandbox's proxy — 34 such lines total across all runs, plus 15 repeats of a Chrome deprecation warning for the `apple-mobile-web-app-capable` meta tag. The app degraded gracefully without the CDN scripts (every feature below worked), but note the dependency for a future offline/first-load review.

---

## 1. First load — welcome screen (fresh context, 390x844)

**1.1 — First impression as a radiation-patient spouse.** PASS.
Loads straight to a single card: "Welcome to ChemoWell", one paragraph explaining what it is and that data stays on-device, three clearly labeled fields (Patient name / Patient is / Treatment type), one Get started button, and a footer saying that's the whole setup and a guide comes next. Nothing else competes for attention. Clear what to do. (`01-welcome-first-load.png`)

**1.2 — Fields render and are correctly labeled.** PASS. Name input, Male/Female chips, Chemo/Radiation/Both chips all present and tappable.

**1.3 — Tap Get started with nothing filled.** **FAIL — first-run blocker.**
*What I did:* tapped Get started with the form empty; then again with only a name; then again with name + sex.
*What happened:* **nothing visible, all three times.** No error text, no toast, no field highlight. (`02-empty-submit-error.png` — captured immediately after the empty tap; the screen is pixel-identical to first load.)
*Root cause (code-confirmed):* `completeSetup()` (index.html line ~2181) correctly calls `setToast('Enter the patient's name to get started')` etc., but the render gate at line 2514 (`if (state.prefsLoaded && !(CONFIG.patientName || '').trim()) { renderSetup(); return; }`) returns before the toast layer at line ~2534 is ever built, and `renderSetup()` (line 2208) contains no toast markup. So on the one screen where every user starts, all three validation messages are written to state and silently discarded. The messages themselves are well-written — they just never appear. (Contrast: the v33 migration card's "Pick both answers to save" toast IS visible, because Home renders the toast layer — see step 8.5.)
*User impact:* a first-time user who taps Get started early concludes the button is broken. This exact anti-pattern (feedback rendered where the user can't see it) is what buried the Owner's onboarding-popup finding in a previous release.
*Suggested fix direction:* render the toast (or an inline field error) inside `renderSetup()`.

**1.4 — Typed name survives the ~1s full-tree re-render.** PASS. Input value intact after multiple re-renders and failed submits.

**1.5 — Complete as Female + Radiation.** PASS. Lands on the app shell ("Dana's Meds"), "Welcome to ChemoWell" toast fires (visible now — we're on the main shell), and the guided tour offers itself unprompted. (`04-setup-complete-tour-offer.png`)

## 2. Guided tour — full run, no skipping (390x844)

**2.1 — Tour offers itself and survives an app restart mid-tour.** PASS. Reloaded the page at step 1; tour resumed (persisted `tourStep`).

**2.2 — Step 1 "Welcome — let's set up together" / Show me.** PASS. (`05-tour-step1-welcome.png`)

**2.3 — Step 2 "The Meds tab": points at the real Meds tab; tapping the actual tab advances.** PASS. Banner form: instruction visible, target uncovered, real tap advances. (`06-tour-step2-meds-tab.png`)

**2.4 — Step 3 "Add your first medication": real Add button tappable, advances on tap.** PASS. (`07-tour-step3-add.png`)

**2.5 — Step 4 "Fill in the details": filled Zofran, 4 mg/8 mg doses, 8-hour gap; saved with the real Add medication button.** PASS. Tour advanced on `med:saved`. (`08/09-tour-step4-*.png`)
Two deliberate robustness probes here, both PASS: (a) saving an as-needed med **without** a gap is blocked with a clear, visible toast explaining exactly why (v19 rule) — not a silent failure; (b) discarding the editor mid-step steps the tour back to Add instead of stranding it (v12 rule, observed live during an earlier probe run).

**2.6 — Steps 5–9 (Home, Quick log, Reports, In-Patient, Symptoms) and step 10 Finish.** PASS, every step. Each step's target is visible and outline-highlighted; Next/Finish always reachable. On Next-only steps a scrim blocks background taps — this is the documented v28 anti-sidetracking design, and the required control (Next) sits on top of it, so nothing the user needs is unreachable. (`10-tour-step6-quicklog.png`, `11-tour-step9-symptoms.png`, `12-tour-step10-finish.png`) Finish routes to Home, `tourDone` persisted, tour never reappears. (`13-first-run-complete.png`)

## 3. First core actions (the order a new user would try them)

**3.1 — Log a dose (Zofran 4 mg from Quick Log).** PASS. Tap opens a clear confirm modal (date + time prefilled, "Defaults to now — edit if logging a past time"); Confirm logs it; card flips to Locked-until state; entry appears in Today's Journal. (`14-dose-logged.png` shows the modal, `20-dose-confirmed.png` the result)

**3.2 — Log a temperature (99.1).** PASS. Visible confirmation "Temperature 99.1 °F logged at 4:51 PM"; reading shows on the card. (`15-temp-logged.png`)

**3.3 — Set planned radiation total (30).** PASS. Persisted to prefs; progress bar appears.

**3.4 — Log today's radiation session.** PASS. "Session 1 of 30", button replaced by "✓ Today's session logged (4:51 PM)" — correctly prevents accidental double-logging. (`16-radiation-session1-logged.png`)

**3.5 — Skin reaction with severity + site.** PASS. Symptoms tab → + → Skin Reaction/Rash reveals the v33 fields (Mild/Moderate/Severe chips, "Where on the body?" free text), both optional and clearly marked; saved entry shows "Moderate · left side of neck". (`17-skin-reaction-modal.png`, `18-skin-reaction-saved.png`)

**3.6 — Log a symptom (Nausea).** PASS. (`19-nausea-logged.png`)

## 4. Day 2 — daily loop via BETA date controls

**4.1 — Advance one day (+1 Day).** PASS. Header flips to "Monday, Aug 3". (`21-day2.png`)
**4.2 — Radiation card offers today's session again.** PASS.
**4.3 — Counter increments: "Session 2 of 30".** PASS. (`22-radiation-session2.png`)
**4.4 — Reports → Radiation.** PASS. "2 / 30 sessions completed", first/most-recent dates, per-session list with Remove. (`23-reports-menu.png`, `24-radiation-report.png`)
**4.5 — Reports → History.** PASS. Both days grouped correctly; dose, temp, both symptoms, both sessions all present with Remove actions. (`25-history.png`)
*Minor (not verdict-driving):* the day-group summary line counts symptoms and radiation sessions as "doses" ("4 doses · 1 temp" for a day with 1 med dose, 2 symptoms, 1 session). Slightly misleading label.
*Note:* the date offset deliberately does not survive an app restart (documented at line ~522) — confirmed, and fine for a beta-only control.

## 5. Explore everything (curious-user pass)

**5.1 — Bottom tabs.** PASS. Home, Meds (Zofran listed with rules), Reports, In-Patient (status + history, Log In-Patient Start reachable), Symptoms — all render, nothing unreachable, no overlays. (`26-inpatient.png`)
**5.2 — Drawer.** PASS. Hamburger opens drawer: identity header (Dana), Account / Calendar / Settings with helper text, version footer, close X. (`27-drawer.png`)
**5.3 — Account (new in v33).** PASS. Current plan (Free, 1 of 1 profiles), profile list with treatment type + entry count, + Add profile, export section. (`28-account.png`)
**5.4 — Plans sheet.** PASS. Free/$0, Plus/$4.99 with feature lists, "Simulate purchase (beta)" clearly labeled; opens from View plans and closes cleanly. (`29-plans-sheet.png`)
**5.5 — Calendar.** PASS. Empty state explains what it's for, Add reachable. (`31-calendar.png`)
**5.6 — Settings.** PASS. Units, home-card toggles, Replay the walkthrough, FAQ (items expand with real answers), export, data controls. (`32-settings-full.png`)
**5.7 — Female-only cycle tracking.** PASS. "Menstrual cycle tracking" toggle present for Dana (Female); off by default (opt-in, as designed); enabling it adds the Cycle report ("Log Period Start" reachable). (`33-reports-with-cycle.png`, `34-cycle-report.png`)
**5.8 — Every report opens.** PASS. History, Weight, Blood Pressure, Radiation, Cycle, Bowel Movement, Appetite — all open, all have sensible empty states, all have a working Back.
*Minor (not verdict-driving):* Weight report's empty state says "Log your first weight on the **Today** tab" — there is no Today tab; the bottom nav says **Home** (the Blood Pressure report says "Home screen card" correctly). Stale copy.

## 6. Export (free tier)

**6.1 — Download CSV.** PASS. Real file downloads: `chemowell-dana-2026-08-02.csv`, header `Date,Time,Type,Detail,Note` + 6 entry rows (dose, temp, symptoms, both radiation sessions).
**6.2 — Printable report on Free.** PASS. Does not dead-end: shows toast "The printable report is part of Plus — CSV export is free below" AND opens the Plans sheet. (`30-printable-free-routes-to-plans.png`)

## 7. Second persona — Male + Chemo (fresh context)

**7.1 — Setup completes; full tour runs and completes identically.** PASS (medication added during tour, Finish works).
**7.2 — No period/cycle language anywhere this user sees.** PASS. Checked Home, Reports menu, Settings (no Menstrual toggle), Symptom modal, History — zero matches for period/menstrual/cycle. (`35-male-chemo-home.png`, `36-male-chemo-reports.png`, `37-male-chemo-settings.png`)
**7.3 — No radiation card, no Radiation report.** PASS.
**7.4 — Chemo Treatment schedule card present ("No treatment date set / Pick a date").** PASS.

## 8. Keyboard-height pass (390x500 — ~40% of screen gone)

**8.1 — Onboarding.** PASS. All three fields, all five chips, and Get started reachable by normal scroll. (`38-kb-onboarding.png`)
**8.2 — Full tour at 390x500.** PASS. Every banner instruction, every highlighted target, every Next, and Finish reachable at every step. (`39/42-kb-tour-*.png`)
**8.3 — Medication editor.** PASS. Every field (name, generic, doses, daily limit, gap) and the Add medication button reachable; med saves. One probe initially showed the Generic-name input sitting under the fixed tour banner at minimal scroll — after an ordinary user scroll it is fully clear and accepts typing, so not a defect. (`40/41-kb-*.png`, `46-kb-generic-input.png`)
**8.4 — Skin-reaction modal.** PASS. Modal caps to viewport and scrolls internally (v70 behavior confirmed); severity chips, site input, and Confirm all reachable; entry saves. (`43-kb-skin-modal.png`)
**8.5 — Migration card (seeded legacy profile `{"patientName":"Legacy","installedAt":1,"tourDone":true}`).** PASS. "Finish setting up this profile" card appears at top of Home; both chip rows + Save reachable at 390x500; partial save shows a **visible** "Pick both answers to save" toast; full save persists `sex`/`treatmentType` and the card disappears. (`44-kb-migration-card.png`, `45-kb-migration-saved.png`)

## 9. Desktop 1280x800 (secondary)

**9.1 — Home, Reports, drawer.** PASS. Content max-width holds, nav and drawer work, nothing overlaps. (`47/48/49-desktop-*.png`)

---

## Defect list

| # | Severity | Finding |
|---|----------|---------|
| 1 | **Blocker (drives FAIL verdict)** | Onboarding validation feedback is invisible: `renderSetup()` never renders the toast layer, so all three "Get started" validation messages are silently discarded. First screen every user sees; button appears dead. Screenshots `01`–`03`. |
| 2 | Minor | Weight report empty state references a non-existent "Today tab" (nav says Home). |
| 3 | Minor | History day summary counts symptoms/radiation sessions as "doses" (e.g. "4 doses · 1 temp"). |
| 4 | Note | Capacitor scripts load from jsdelivr CDN (only console errors observed, all environmental here; app degrades gracefully without them — worth a bundling decision before GA). |

**Console-error count: 0 application JS errors.** All 34 console error lines across every session were the two blocked CDN resource loads (environment proxy); 15 warnings were the deprecated `apple-mobile-web-app-capable` meta.

---

## Fix verification (re-run, same day)

**Scope:** re-ran step 1.3 (the blocker) as a first-run user — fresh Playwright context, no seeded state, 390x844 — after the dev fix that gives `renderSetup()` its own copy of the toast pill (see the code comment above the toast node in `renderSetup()`).

**Findings — all PASS:**

1. **Empty submit:** tapping Get started with nothing filled now shows a visible toast pill, "Enter the patient's name to get started", anchored above the bottom safe area, fully inside the viewport. (`fix-01-empty-toast.png`)
2. **Name only:** "Select Male or Female to continue" toast visible. Typed name ("Dana") survived the toast re-render, consistent with original 1.4. (`fix-02-name-only-toast.png`)
3. **Name + Female:** "Select the treatment type to continue" toast visible. (`fix-03-treatment-toast.png`)
4. **Complete with Both:** app shell loads normally ("Dana's Meds"), "Welcome to ChemoWell" toast fires visibly in the shell, tour offers itself — matches original 1.5. (`fix-03b-app-shell-welcome.png`)
5. **Short viewport (390x500, simulated keyboard height):** toast renders just below the Get started button, overlapping only ~1px of its bottom edge (measured overlap 207 px² of the button's 13,630 px²); button label and toast text both fully legible, nothing blocked. (`fix-04-keyboard-height.png`)
6. **Console:** 0 application JS/page errors across both fresh sessions (ignoring the known environmental jsdelivr/Capacitor resource-load failures and the `apple-mobile-web-app-capable` deprecation warning, per the original report's baseline).

Defect #1 is closed. Defects #2–#4 (minor/notes) were not re-tested and remain open as written.

## Updated overall verdict: **PASS** — the first-run blocker is fixed; onboarding validation feedback is now visible at both normal and keyboard-height viewports, with zero application console errors.
