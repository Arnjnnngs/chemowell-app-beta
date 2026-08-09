# Zero Day Auditor — full-app sweep, app-v51

**Date:** 2026-08-09 · **Auditor:** Zero Day Auditor (independent gate) · **Build audited:** `index.html` @ `APP_VERSION = 'app-v51'`
**Scope:** full minimum-20-test-case sweep (Aaron-mandated, app-v24 rule) — 4 fresh onboardings + 4 guided tours, 13 medications created across every placement/category/unit, a simulated 7-day logging span across every loggable type, verified against Today / History / Reports / Calendar / Notes / trends / CSV, plus edge cases.
**Test cases executed:** 82 (74 pass, 8 real failures + 4 additional defects found by code reading and confirmed live).

---

## Verdict — read this part

**The app is NOT in good shape to be called finished. It is in decent shape functionally, with three defects that should block a "this is done" message to Aaron.**

Core logging works, and works well. Every loggable type wrote correctly, every daily limit fired with the right unit, override reasons were recorded, midnight rollover reset correctly, double-taps produced exactly one entry, absurd inputs were rejected with plain-English messages, the app ran offline, and **there were zero JavaScript console errors across every screen, every profile type and every flow** (the only console noise is the four blocked `cdn.jsdelivr.net` Capacitor scripts, which are a sandbox network restriction — see "What I could not test").

But:

1. **A red "2 missed doses from previous days" banner can become permanently un-clearable.** Tapping its own "Review" button lands on a screen that says "No missed doses to review — you're all caught up!". There is no other way to dismiss it. It survives reload. This is missed-medication tracking, so it is safety-relevant, and it is the single worst thing in this build. (Finding H-1)
2. **A radiation-only profile can create a medication it can never use.** The medication editor offers "Only near treatment day", but that profile type has no UI anywhere to set a treatment date, so the medication silently never appears on Home again. (Finding H-2)
3. **Aaron's CSV bug is real and worse than he described.** "500mg → 500 pills" is one instance of a general rule: *every* dose whose label starts with a number gets that number re-exported as a pill count. Confirmed live for mg, mcg, tabs and applications. This is the file that goes to a doctor. (Finding H-3)

**On the specific question Aaron was being asked to verify himself — the "Other" treatment type in the medication editor — the previous sessions' claim is CORRECT and I am settling it as VERIFIED.** Exact on-screen strings are in §2 below. But the claim was too narrow: the editor is adaptive, the screens *around* it are not, including the Home card that supplies the very date the editor is talking about. (Finding M-3)

Pre-flight confirmed as instructed: `git diff origin/main -- index.html` is **empty** — the file I tested is byte-identical to what is deployed. Served locally at `http://localhost:8899/index.html` (HTTP 200, 571,061 bytes).

---

## 1. Onboarding + guided tour — four runs, one per treatment type

Method: fresh browser context per run (empty `localStorage` = wiped install), 390×844 mobile viewport, all ten tour steps walked to "Finish" by performing the real actions each step demands.

| # | Test | Result | Observed |
|---|---|---|---|
| T-01 | Chemo profile: onboarding → tour steps 1–10 → Finish | PASS | Ten steps, all copy rendered; landed on Home with `TourMed` in Quick Log |
| T-02 | Radiation profile: same | PASS | Same ten steps; Home showed `RADIATION SESSIONS` and **no** `TREATMENT SCHEDULE` card |
| T-03 | Both profile: same | PASS | Same ten steps; Home showed **both** `TREATMENT SCHEDULE` and `RADIATION SESSIONS` |
| T-04 | "Other" profile: same | PASS | Same ten steps; Home showed `TREATMENT SCHEDULE` (see M-3) |
| T-05 | Is any tour copy wrong for a given treatment type? | PASS | `TOUR_STEPS` (index.html:2781) is a static array — no chemo/radiation-specific wording in any of the 10 steps. Verbatim step 8: "Track hospital stays here. While a stay is active, home medication logging pauses, since the hospital handles meds." Reads correctly for all four types. |
| T-06 | Tour "More" expands the slim banner | PASS | Collapsed: `GUIDE · 3 OF 10 \| Tap Add to create your first medication. \| Skip this step \| More \| Skip` → expanded: `GUIDE · STEP 3 OF 10 \| Add your first medication \| Tap the Add button to create your first medication. \| 👆 Tap Add to continue \| Skip guide \| Back \| Got it` |
| T-07 | Last step's promised path exists: menu → Settings → Replay the walkthrough | PASS | Button present in Settings |
| T-08 | Replay restarts at step 1 | PASS | `GUIDE · STEP 1 OF 10` |
| T-09 | **Tour banner does not obstruct the app header / hamburger menu** | **FAIL** | See M-4 |
| T-10 | Zero console errors through all four tours | PASS | `[]` on every run |

Full step-by-step tour transcripts (all four types) were captured; step copy was byte-identical across types, as expected.

---

## 2. THE QUESTION AARON WAS BEING ASKED TO VERIFY — settled

**Claim under test:** for treatment type "Other", the medication editor previously showed chemo/radiation wording ("open near treatment" / "exclude near treatment"); prior sessions claimed `isOtherTreatmentType()` / `treatmentModeOptions()` are fully adaptive.

**Method:** created a real "Other" profile (Olivia, Female, Other), walked it through the medication editor **both** via the guided tour (step 4, where Aaron saw it) **and** via Meds → Add afterwards, and read every label on screen, including the two fields that only appear once a mode is selected.

**Verdict: VERIFIED. No chemo/radiation wording appears anywhere in the medication editor for an "Other" profile.** Exact strings read off the running app:

| Element | "Other" profile (verbatim) | Chemo/Radiation/Both profile (verbatim) |
|---|---|---|
| Section label | `AVAILABILITY NEAR YOUR DATE` | `TREATMENT-DAY AVAILABILITY` |
| Section helper | `Whether this medication is only available, or specifically excluded, near your date.` | `Whether this medication is only available, or specifically excluded, near your treatment date.` |
| Option 1 | `Always available` / `No restriction based on your date.` | `Always available` / `No treatment-day restriction.` |
| Option 2 | `Only near your date` / `Only appears on Home for a window of days around your date — hidden the rest of the time.` | `Only near treatment day` / `…around your treatment date — hidden the rest of the time.` |
| Option 3 | `Excluded near your date` / `Grayed out and can't be logged for a window of days around your date — available the rest of the time.` | `Excluded near treatment day` / `…around your treatment date — …` |
| Days field 1 | `DAYS BEFORE` / `Becomes active this many days before your date (0 = starts on your date itself).` | `DAYS BEFORE TREATMENT` / `…before treatment day (0 = starts on treatment day itself).` |
| Days field 2 | `DAYS AFTER` / `Stays active through this many days after your date (0 = your date only).` | `DAYS AFTER TREATMENT` / `…after treatment day (0 = treatment day only).` |
| Live window preview | `Active window: 2 days before through 2 days after your date.` | `Active window: 1 day before through 1 day after treatment day.` |
| Meds-list chip | `Your date −2/+2` | `Treatment day −1/+1` |

Verified identically on the tour path (screenshot `02-other-profile-med-editor-adaptive-copy.png`) and on the normal Meds → Add path.

**However — the claim was scoped too narrowly, and this is the part that was not checked.** The editor is adaptive; four surfaces that talk about the same date are not. See Finding **M-3**.

---

## 3. Medications created — every placement, category and unit

13 medications created through the real editor across four profiles. Stored JSON verified against `chemowell-app-p-<id>-med-v1` in each case.

| # | Test | Result | Observed |
|---|---|---|---|
| A-01 | Chemo: as-needed, 8 h gap, mg limit 24, own Home card, generic name + note (Ondansetron) | PASS | `{"type":"gap","gapH":8,"doses":[{"label":"4 mg","mg":4,"pills":4},{"label":"8 mg","mg":8,"pills":8}],"quickLog":true,"ceiling":true,"ceilingMax":24}` |
| A-02 | Chemo: scheduled, **two** windows (08:00 Morning + 14:00 Afternoon), Morning group, "Only near treatment day" −1/+1 (Dexamethasone) | PASS | `windows:[{start:8,end:14},{start:14,end:24}]`, `treatmentMode:"only"`, `alerts:true`; auto-derived window ends correct |
| A-03 | Chemo: as-needed, **pills** limit unit, 12 h gap, Evening group (Senna, "2 tabs") | PASS | `ceilingUnit:"pills"`, `ceilingMax:4`, `groupedEvening:true` |
| A-04 | Chemo: as-needed, **applications** limit unit, "Excluded near treatment day" 0/+2, **No Home card** (Magic Mouthwash) | PASS | `ceilingUnit:"applications"`, `treatmentMode:"excluded"`, `treatmentDaysBefore:0`, `treatmentDaysAfter:2`, absent from Home as designed |
| A-05 | Chemo: 2nd scheduled always-available med (Pantoprazole 40 mg, 08:00) | PASS | `alerts:true`, single window 8→24 |
| A-06 | Reserved legacy id collision handled | PASS | A user-typed "Dexamethasone" got id `dexamethasone-2`, not the reserved legacy `dexamethasone` (`RESERVED_LEGACY_MED_IDS`, index.html:4275) |
| R-01 | Radiation: topical, applications unit, limit 3, own card, note (Aquaphor Ointment) | PASS | `ceilingUnit:"applications"`, `ceilingMax:3` |
| R-02 | Radiation: 2nd topical, "Excluded near treatment day", Evening group (Biafine Cream) | PASS | `treatmentMode:"excluded"` |
| R-02b | Radiation: "Only near treatment day" med (Pre-Rad Antiemetic) | **FAIL** | Medication saves, then **never appears on Home** — see H-2 |
| O-01 | Other: ordinary daily med, scheduled 07:00, own card (Levothyroxine 75 mcg) | PASS | `doses:[{"label":"75 mcg","mg":0,"pills":75}]` — note `pills:75` for a microgram dose, root of H-3 |
| O-02 | Other: "Only near your date" −2/+2 with mg limit 1200 (Ibuprofen) | PASS | `treatmentMode:"only"`, `treatmentDaysBefore:2`, `treatmentDaysAfter:2` |
| B-01 | Both: scheduled twice-daily oral chemo (Capecitabine 500 mg 08:00/20:00) + as-needed Tylenol 3000 mg cap | PASS | Both stored correctly |
| A-07 | Daily-limit field is gated until Dosage options carries the chosen unit | PASS | `DAILY LIMIT` renders disabled with placeholder `Locked` and the line `Add a matching amount to Dosage options above first.` |
| A-08 | Meds-list placement chips are self-consistent | **FAIL** | See M-1 |
| B-02 | Pause control present in edit mode | PASS | Buttons in edit mode: `["Pause","Save changes"]` |
| B-03 | Pausing records a real pause period | PASS | `{"paused":true,"pausePeriods":[{"start":1786233600000,"end":null}]}` |
| B-04 | Paused med stays visible on Home as "Paused" with Resume (not hidden) | PASS | `Capecitabine — Paused \| Not tracked while paused. Resume anytime. \| Resume` |
| B-06 | Resume closes the pause period | PASS | `[{"start":1786233600000,"end":1786233600000}]` |
| B-05 | "Still pausing?" daily check-in banner | PASS (corrected) | Absent same-day by design — `pausedCheckinDate` is stamped on pause so it doesn't nag the day you paused. Not a defect. |

---

## 4. Simulated 7-day logging span (chemo profile "Grace"), every loggable type

Days simulated 2026-08-09 → 2026-08-15 using the `TEST_MODE` Beta date controls. Final dataset: **34 entries across 6 distinct days, 17 distinct entry types.**

| # | Test | Result | Observed |
|---|---|---|---|
| C-01 | As-needed dose (Ondansetron 8 mg) | PASS | `{"medId":"ondansetron","dose":"8 mg","mg":8,"pills":8}`; Home card → `Waiting / Last taken - Sunday 8/9 · 8 mg / Next dose at 6:00 PM` |
| C-02 | Scheduled dose logged from a Morning group card | PASS | `{"medId":"dexamethasone-2","dose":"4 mg","mg":4}`; card → `✓ Logged 10:00 AM / Opens 2:00 PM` |
| C-03 | Temperature 101.4 °F | PASS | `{"medId":"temp","temp":101.4,"unit":"Fahrenheit","dose":"101.4 °F"}` |
| C-04 | **Fever ≥ 100.4 °F is stated in words, not just colour** | **FAIL** | Card reads only `TEMPERATURE / Last reading 10:00 AM / 101.4°F / Log` — see M-6 |
| C-05 | Weight 154.2 lbs + reason + litres drained | PASS | `{"weight":154.2,"weightReason":"paracentesis","litersDrained":2.5}`; History renders `154.2 lbs · Paracentesis (fluid drained) (2.5 L)` |
| C-06 | Blood pressure 118/76 | PASS | `{"sys":118,"dia":76,"dose":"118/76 mmHg"}` |
| C-07 | BP logging is consistent with temp/weight | **FAIL** | See L-1 |
| C-08 | Daily check-in writes appetite + bowel + a Note in one save | PASS | appetite `"Little to none"`, bowel `"None"`, note `"Rough morning, kept fluids down after 2pm."` on `2026-08-09` |
| C-09 | Symptom (Nausea) with free-text note | PASS | `{"medId":"symptom_nausea","note":"Worse after the infusion."}` |
| C-10 | Symptom with severity + body-site fields (Skin Reaction/Rash) | PASS | `{"medId":"symptom_skin_reaction","severity":"moderate"}`; modal exposes `HOW BAD IS IT? (OPTIONAL)` Mild/Moderate/Severe + `WHERE ON THE BODY? (OPTIONAL)` |
| C-11 | Cycle report offered for Female profile with tracking on | PASS | Reports list: History, Weight, Blood Pressure, **Cycle**, Bowel Movement, Appetite |
| C-12 | Cycle start | PASS | `{"medId":"cycle_start"}`; Home banner → `Period active / Day 1 since period start / Log Period End` |
| C-22 | Cycle end (day 4) | PASS | `{"medId":"cycle_end"}`; Cycle report → `8/9/2026 – 8/13/2026 (5 days)` |
| C-13 | In-patient start | PASS | `{"medId":"inpatient_start"}`; In-Patient screen → `Day 1 / Active / Since 8/9/2026 10:00 AM. Home medication logging is paused while a stay is active — the hospital is administering doses, not you.` |
| C-16 | In-patient end | PASS | `{"medId":"inpatient_end"}`; stay closed, history row `8/9/2026 10:00 AM – ongoing` becomes a closed stay |
| C-15 | Beta date control advances the app day | PASS | Header moved `Sunday, Aug 9` → `Monday, Aug 10` |
| C-17 | Daily limit (24 mg) locks the card | PASS | Card → `Limit / Last taken - Monday 8/10 · 8 mg / Next dose tomorrow after midnight` |
| C-17b | Limit prompt wording per unit (mg / pills / applications) | PASS | `Daily limit of 1,000 mg reached. Log more anyway?` · `Daily limit of 2 pills reached. Log more anyway?` · `Daily limit of 2 applications reached. Log more anyway?` |
| C-18 | Over-limit override path records a reason | PASS | Entries carry `overrideReason:"early"` and `overrideReason:"early+overLimit"`; History shows chips `EARLY` and `EARLY · OVER LIMIT` |
| C-19 | Pills-unit med (Senna, "2 tabs") | PASS | `{"dose":"2 tabs","pills":2}` |
| C-20 | Missed scheduled doses surfaced on Home after a skipped day | PASS | `1 missed dose from previous days` |
| C-21 | Day-3 vitals with a second weight reason | PASS | temps `["101.4 °F","98.6 °F"]`, weights `["154.2 lbs / paracentesis","151.8 lbs / steroid"]`, bp `["118/76 mmHg","134/88 mmHg"]` |
| C-23 | Appointment with time + reminder + note | PASS | `{"title":"Oncologist follow-up","note":"Bring the symptom log.","reminder":"1day","ts":…,"color":"coral"}` |
| C-24 | Note added from the Notes screen | PASS | Two notes on `2026-08-09` and `2026-08-13` |
| R-05 | Radiation session logged ("Log today's session") | PASS (corrected) | `{"medId":"radiation_session"}`; card → `Session 1 / ✓ Today's session logged (5:36 AM)`. *The earlier FAIL was a Playwright `fill()` artifact on the Planned-total field, not an app defect — re-tested with real keystrokes and it works.* |
| R-06 | Planned total + session counter | PASS (corrected) | `radiationPlannedTotal: 20` persisted; Radiation report → `1 / 20 sessions completed` |
| R-07 | Backdated session via the "+" button | PASS | Opens `Log Past Radiation Session` modal; entry created |
| R-08 | Applications daily limit reached | PASS (corrected) | After 2 of 2 applications: card → `Limit / Next dose tomorrow after midnight` |
| C-25 | Whole span assembled | PASS | 34 entries / 6 days / 17 types: `chemo_date, ondansetron, dexamethasone-2, pantoprazole, senna, temp, weight, blood_pressure, appetite, bowel_movement, symptom_nausea, symptom_skin_reaction, symptom_neuropathy, cycle_start, cycle_end, inpatient_start, inpatient_end` |

---

## 5. Every screen the data should appear on

| # | Test | Result | Observed |
|---|---|---|---|
| V-07 | History lists every day of the span | PASS (corrected) | `TODAY - SATURDAY 8/15`, `FRIDAY, 8/14`, `WEDNESDAY, 8/12`, `MONDAY, 8/10` (`IN-PATIENT`), `SUNDAY, 8/9` (`IN-PATIENT`). *My first regex only matched one format; re-read confirms the full span.* |
| V-08 | History includes every loggable type | PASS | Found on screen: Ondansetron, Dexamethasone, Pantoprazole, Senna, Temperature, Weight, Blood Pressure, Nausea, Skin Reaction/Rash, Neuropathy, In-Patient, Appetite, Bowel Movement, MISSED |
| V-08b | History per-day summary line | PASS | e.g. `3 doses · 1 temp · 1 wt`, `0 doses · 1 temp · 1 MISSED` |
| V-09 | Weight report + trend chart | PASS | `CURRENT 149.9 / AVERAGE 151.6 / CHANGE -4.3 lbs`; all-readings list shows reason text `Paracentesis (fluid drained) — 2.5 L drained` and `Steroid medication` |
| V-10 | BP report | PASS | `122/79`, `126/82`, `134/88`, `118/76` all listed with day + time |
| V-11 | Cycle report | PASS | `Day 7 since last period start`, `8/9/2026 – 8/13/2026 (5 days)` |
| V-12 | Bowel report | PASS | `BOWEL MOVEMENT HISTORY / Sunday, Aug 9 — None` |
| V-13 | Appetite report | PASS | `APPETITE HISTORY / Sunday, Aug 9 — Little to none` |
| V-14 | Appointment marked on the month grid | PASS (corrected) | Cell 13 `aria-label="Thursday, August 13, 1 appointment"` with a coloured dot. *My first run clicked the wrong day.* |
| V-15 | Appointment detail on its day | PASS | `Thursday, August 13 / Oncologist follow-up / 2:30 PM / 1 day before / Bring the symptom log.` |
| V-16 | Notes list | PASS | `AUG 13 Thursday — Appetite better…` and `AUG 9 Sunday — Rough morning…` |
| V-00 | CSV export downloads | PASS | Real download event, filename `chemowell-grace-2026-08-15.csv` |
| V-06 | CSV row count matches the data | PASS | 33 rows vs 33 loggable entries (`chemo_date` correctly excluded) |
| V-04 | CSV: cycle / in-patient rows | PASS | `Period Start`, `Period End`, `In-Patient Start`, `In-Patient End` — deliberately blank detail |
| V-05 | CSV: symptom rows | PASS | `Skin Reaction/Rash,moderate` and note text preserved |
| V-01/02/03/R-12 | CSV unit + reason correctness | **FAIL** | See H-3 and M-2 |
| V-17 | Notes date badges include the year | **FAIL** | `AUG 13` / `AUG 9` only — confirms the open BACKLOG item |

---

## 6. Edge cases

| # | Test | Result | Observed |
|---|---|---|---|
| E-05 | Triple-tap a dose button + triple-tap Confirm | PASS | 34 entries → 34 entries (delta 0). No duplicates. |
| B-08 | Midnight rollover | PASS | Today's Journal reset to `No doses logged yet today…`; Tylenol went from `Limit` back to `✓Available` with `Last taken - Sunday 8/9` preserved |
| B-09 | Reload with the dose-confirm modal open | PASS | 1 entry before → 1 after; modal closed cleanly, no phantom write |
| E-06 | Absurd temperature (999) | PASS | `Enter a valid temperature in °F (86–113)` |
| E-07 | Absurd BP (900/900) | PASS | `Enter a valid reading, e.g. 120 over 80.` |
| E-08 | Negative weight (−5) | PASS | `Enter a valid weight` |
| E-09 | Offline (network disabled + reload) | PASS | App rendered fully from the service-worker cache; all data intact |
| X-01/X-02 | Desktop 1280 px | PASS | Renders correctly, `scrollWidth 1280 == clientWidth 1280` |
| X-03/X-04 | 360 px Home + Meds | PASS | No horizontal overflow |
| X-05 | 360 px medication editor | **FAIL** | `scrollWidth 379 vs clientWidth 360` — see M-5 |
| X-06 | Touch targets ≥ 44 px | **FAIL (Low)** | 4 reorder buttons (`▲`/`▼` in Meds → Home screen order) measure 40×40 |
| B-10 | Browser / Android Back | **FAIL** | See M-7 |
| E-01 | Missed-dose banner appears | PASS | `2 missed doses from previous days` with a `Review` button |
| E-02/E-03/E-04 | Missed-dose review + clear + persistence | **FAIL** | See H-1 |
| X-12 | Free tier blocks a 2nd profile | PASS | Account shows `1 of 1 profile used`; add-profile routes to the plans screen |
| X-15 | Notes "Delete?" confirm resets on nav away | **FAIL** | Still shows `Delete?` after leaving and returning — confirms the open BACKLOG item |
| CE-01 | **Zero JavaScript console errors** across all profiles, tours, screens, modals, reloads and the offline pass | PASS | `[]` on every single run |

---

## FINDINGS

### H-1 — HIGH (safety-relevant): a "missed doses" banner that can never be cleared, and directly contradicts its own Review screen

* **Where:** `renderHistory()` — `index.html:5975` (the `dmap` build) and `index.html:5978` (`missedDosesFor(k, now)`), versus `pastMissedCount()` — `index.html:1144-1151`.
* **What's wrong:** the Home banner counts misses by **looping over every calendar day** since install. History only computes misses for days that already have **at least one logged entry** (`dmap` is built purely from `state.entries`), and it additionally drops `cycle_start` / `cycle_end` / `inpatient_*` from that build. So a day on which the caregiver logged nothing at all — or logged only a period start/end — cannot produce a missed-dose row in History, even though the banner is counting it.
* **Repro (exactly what I did):**
  1. Chemo profile with a scheduled medication (Pantoprazole, 08:00 window, alerts on).
  2. Simulate forward one day and log nothing at all (Aug 11). Simulate forward again to a day where the only entry is a period end (Aug 13).
  3. Return to Home → red banner: **"2 missed doses from previous days"** with a `Review` button.
  4. Tap `Review` → History, Missed Doses filter → **"No missed doses to review — you're all caught up!"**
  5. `Clear all` is not rendered (it only renders when `totalMissed > 0`), and there are no per-row Clear buttons because there are no rows. Reload the app: banner still says 2.
* **Control that proves the cause:** with the sim date set back to Aug 11 and a single temperature logged there, that day immediately appeared in History as `TUESDAY, 8/11 — 0 doses · 1 temp · 1 MISSED` with `Took later / Skipped / Clear`, and `Clear all` appeared. Aug 13 (only a `cycle_end`) stayed invisible, and the banner still read 2.
* **Expected:** History should enumerate the same day range `pastMissedCount()` does, so every counted miss is listed and resolvable. The two counts must never disagree.
* **Why it matters:** the day a caregiver logs nothing is exactly the day most likely to contain a real missed dose. That is the one day the app cannot show them. And an un-dismissable red alert trains people to ignore red alerts.
* **Evidence:** `04a-home-says-2-missed-doses.png`, `04b-history-says-all-caught-up.png`.

### H-2 — HIGH: on a radiation-only profile, "Only near treatment day" medications disappear forever with no way to fix it

* **Where:** `index.html:3717` (`if (!isRadiationOnly() && homePref('showChemoSchedule'))` hides the Treatment schedule card) and `index.html:5522` (`!isRadiationOnly() ? toggle('showChemoSchedule', …)` hides the Settings toggle that would bring it back), against `index.html:3792` (the Quick Log filter drops a non-paused `treatmentOnly` med whose `treatmentActiveOn()` is false — and `treatmentActiveOn()` returns false whenever `chemoOffsetFor()` is `null`, i.e. whenever no treatment date exists).
* **Repro:** onboard as Radiation → Meds → Add → name "Pre-Rad Antiemetic", 8 h gap, dose "8 mg", **Only near treatment day**, Own Home card → Add medication. Toast confirms it saved and the Meds list shows it. Go to Home: it is **not in Quick Log**, not in any group, and there is no Treatment schedule card and no Settings toggle anywhere to set the date it needs.
* **Observed:** Home Quick Log after the save contained only `Aquaphor` — `Pre-Rad Antiemetic` absent entirely, with no message.
* **Expected:** either hide the "Only/Excluded near treatment day" options for radiation-only profiles, or give those profiles a way to set the date (the radiation session card would be the natural home for it).
* **Evidence:** `09-radiation-only-home-no-treatment-date-ui.png`.

### H-3 — HIGH (doctor-facing data): CSV export invents a pill count for every dose whose label starts with a number

* **Where:** `buildExportRows()` — `index.html:5632`: `if (e.pills) detail += (detail ? ', ' : '') + e.pills + ' pill' + (e.pills === 1 ? '' : 's');`
  Root cause upstream: `parseDoseOptions()` — `index.html:4192-4194`: `const numMatch = label.match(/(\d+(?:\.\d+)?)/); … if (numMatch) dose.pills = Number(numMatch[1]);` — **any** leading number becomes a pill count, including the milligram number.
* **Aaron's exact case reproduced and generalised.** Real rows from the CSV I downloaded from the running app:
  * `2026-08-09,10:00 AM,Ondansetron,"8 mg, 8 pills",`
  * `2026-08-10,10:00 AM,Ondansetron,"8 mg, 8 pills, override: early+overLimit",`
  * `2026-08-10,10:00 AM,Pantoprazole,"40 mg, 40 pills",`
  * `2026-08-10,10:00 AM,Senna,"2 tabs, 2 pills",`
  * `2026-08-09,5:34 AM,Aquaphor Ointment,"2 applications, 2 pills",` (radiation profile)
  * a 75 mcg levothyroxine dose stores `pills: 75` and would export as `75 mcg, 75 pills`
* **Blast radius:** every medication row in the CSV, and the same `buildExportRows()` feeds the **printable doctor's report** (`openPrintReport()`, index.html:5702) — so the PDF a caregiver hands to an oncologist says a patient took 40 pills of pantoprazole. Non-medication rows (temperature, BP, weight, symptoms, cycle, in-patient) are unaffected.
* **Expected:** export the medication's real unit. `med.ceilingUnit` already records `pills` / `applications`; `dose.label` already contains the human string. The number should only be re-stated when it genuinely differs from what `e.dose` already says.

### M-1 — MEDIUM: the Meds list tells you a medication has no Home card and is in the Morning group, at the same time

* **Where:** `index.html:4918` — `med.quickLog ? 'Own Home card' : 'Managed only (no Home card)'`, which never considers `groupedMorning` / `groupedAfternoon` / `groupedEvening`.
* **Observed on screen:** `Dexamethasone` → chips `Managed only (no Home card)` **and** `Morning group`. `Senna` → `Managed only (no Home card)` **and** `Evening group`. Both medications *do* have a Home card (inside their group), verified on Home.
* **Expected:** show `Managed only (no Home card)` only when the medication is in no group and has no own card.
* **Evidence:** `05-meds-list-managed-only-plus-morning-group.png`.

### M-2 — MEDIUM: CSV exports the weight-reason database id instead of the label the app shows everywhere else

* **Where:** `index.html:5626` — `detail += ' (' + e.weightReason + …` (raw id), while Home/History/Reports all use `weightReasonLabel()` (`index.html:1984`).
* **Observed:** CSV row `2026-08-09,10:00 AM,Weight,"154.2 lbs (paracentesis, 2.5L drained)"` vs the History row on screen: `154.2 lbs · Paracentesis (fluid drained) (2.5 L)`. Other ids that would leak: `fluid_retention`, `poor_appetite`, `nausea_vomiting`, `increased_appetite`.
* **Expected:** `weightReasonLabel(e.weightReason)`. This is exactly the "reads like a data field name rather than a human sentence" case, on a doctor-facing document.

### M-3 — MEDIUM (copy, and the direct extension of Aaron's question): the "Other" profile's editor is adaptive but four surrounding surfaces are not

Verified live on an "Other" profile:

| Surface | On screen for an "Other" profile | Location |
|---|---|---|
| Home card heading + empty state | `TREATMENT SCHEDULE` / `No treatment date set` / and once set, `Last treatment Sunday, 8/9` | index.html:3712-3721 |
| Toast after picking a date | `Treatment date set — 8/9/2026` | index.html:1372 |
| Toast after clearing | `Treatment date cleared` | index.html:3724 |
| Settings toggle | `Treatment schedule card` / `Countdown and reminders around treatment dates.` | index.html:5522 |
| FAQ entry | `How do I set a treatment date?` … `On Home, under Treatment schedule, tap Pick a date.` | index.html:2000 |

So the editor asks about "your date" and the only place to set that date calls it a "treatment date". This is the same complaint v41 was written to fix, one screen over. (The Rx countdown banner itself *is* correctly adapted — verified: `Today / Today's the day — log doses and symptoms as they happen.`)
**Evidence:** `03-other-profile-home-still-says-treatment-schedule.png`.

### M-4 — MEDIUM: during the guided tour the banner covers the app header and blocks the menu button

* **Where:** `renderTourLayer()` slim-banner branch (`index.html:2884-2940`) — `#tour-layer` spans the full viewport (measured `0,0 390×844`) and the banner is pinned at the top.
* **Observed:** on tour steps 2–5, `document.elementFromPoint()` at the centre of the hamburger (16,10, 44×44) returns `DIV "Tap Add to create your first medication."` inside `#tour-layer`; a real click on the menu button times out as blocked. The whole header row (wordmark, patient name, date) is hidden behind the banner.
* **Expected:** the tour banner should sit below the header, or the layer should not intercept pointer events outside the banner itself.
* **Evidence:** `01-tour-banner-covers-header-and-menu.png`.

### M-5 — MEDIUM (mobile-first): the medication editor overflows horizontally at 360 px

* **Observed:** at 360×740, `document.documentElement.scrollWidth = 379` vs `clientWidth = 360`. The offending element is the **Days taken** `<select>` (`left 33, right 379, width 346`). Because the `<nav>` bottom bar is `width:100%`, it inherits the 379 px and its right edge (`Symptoms`) is pushed past the viewport. The whole page scrolls sideways by 19 px.
* Home and Meds are clean at 360 px; only the editor overflows. 390 px is unaffected. 360 px is a very common Android width, and TEAM.md names 360–390 px as the primary check.
* **Evidence:** `06-med-editor-overflows-at-360px.png`.

### M-6 — MEDIUM (safety-relevant copy, called out explicitly per the copy-review rule): a fever is signalled by colour alone

* **Where:** `index.html:3598` — `if (dt >= tempHigh()) tempColor = '#C0453B'; else if (dt >= tempFever()) tempColor = '#9A6419';` Thresholds: `tempFever()` = 100.4 °F / 38.0 °C, `tempHigh()` = 103 °F / 39.4 °C (index.html:843-844).
* **Observed:** after logging 101.4 °F the Home card reads, in full: `TEMPERATURE / Last reading 10:00 AM / 101.4°F / Log`. The number is amber. There is no word anywhere on the card, in Today's Journal, or in History saying "fever", "call the care team", or anything else.
* **Why I'm flagging it at this level:** 100.4 °F is the standard neutropenic-fever threshold — for a chemo patient it is a "phone the on-call oncologist now" number, not a "hmm" number. The app already knows the reading crossed it. Relying on a colour change also fails the colour-blind case and is a WCAG "don't use colour alone" issue.
* **This is a piece of copy a caregiver reads while making a medical decision.** Per TEAM.md's copy-review rule I am naming it explicitly rather than guessing the wording: it should go to Aaron as worth a real clinician/copywriter pass, not be resolved in-chain by the Lead Developer.
* **Evidence:** `08-fever-101-4-no-text-warning.png`.

### M-7 — MEDIUM (mobile): one Back press exits the app

* **Where:** no `history.pushState` anywhere in the app; `navigateTo()` is a pure state assignment.
* **Observed:** after onboarding, `history.length === 2`, and it stays at 2 after three tab changes. `goBack()` from Reports → History left the page entirely (`about:blank`, empty document).
* **On the Capacitor Android build** (`capacitor.config.ts` points the WebView at the live site) this means the hardware Back button leaves/closes the app instead of going up a screen — the opposite of what every Android user expects, especially from a nested screen like History or the medication editor.

### M-8 — MEDIUM (privacy hygiene): deleting a profile leaves its encryption key behind

* **Where:** `deleteProfile()` — `index.html:182`: `['-entries-v1', '-prefs-v1', '-med-v1', '-appts-v1', '-notes-v1'].forEach(…)`.
* **What's missing:** `-synckey-v1` (`syncKeyStorageKey()`, index.html:214) — the profile's **raw base64 AES-256 sync key** — and `-syncmeta-v1` (index.html:222, holds the server token and per-record versions). Neither is removed, so deleting a shared profile leaves its key material in `localStorage` indefinitely.
* `eraseAllAppData()` (index.html:576) is fine — it wipes everything prefixed `chemowell-app-`. Only the per-profile delete path leaks.
* Given APP_CLAUDE.md rule 1's zero-knowledge framing and the pending privacy-lawyer review, "delete this patient's profile" should mean the key goes too.

### M-9 — MEDIUM: a mistyped temperature older than 48 h can never be removed, but weight and BP can

* **Where:** `BYPASS_48H_IDS` — `index.html:3325`: `new Set(['weight', 'cycle_start', 'cycle_end', 'bowel_movement', 'appetite', 'radiation_session', 'blood_pressure'])`. `temp` is not in the set.
* **Observed in History:** on 8/12 the Weight and Blood Pressure rows have `Remove` buttons; the Temperature and Pantoprazole rows on the same day do not. On 8/10 nothing does.
* Temperature is the reading most likely to be fat-fingered (101.4 vs 1014, °F entered in a °C profile), it is the one that drives the fever colour, and it is uniquely uncorrectable after two days while its sibling vitals are not.

### L-1 — LOW: blood pressure logs instantly; temperature and weight ask for a date and time first

`logBloodPressure()` (index.html:1376) writes straight to the log with `ts = state.now`. `logWeight()` (index.html:1386) and the temperature path both open the shared time modal (`DATE / TIME / Defaults to now — edit if logging a past time`). Result: three adjacent cards on the same screen behave differently, and there is no way to backdate a BP reading from Home.

### L-2 — LOW: a "Only near your/treatment date" medication vanishes with no explanation when no date is set

On the "Other" profile, Ibuprofen (Only near your date, −2/+2) saved successfully and then simply was not in Quick Log, with no message. After picking a date it appeared. A one-line hint ("Set a date on Home to use this medication") would close it. (A *chemo* profile handles this better — the grouped card shows `Outside its treatment-day window` — so the inconsistency is between placements as well as profile types.)

### L-3 — LOW: warning banner fires on a brand-new, empty medication form

Opening Meds → Add immediately shows a filled amber `!` banner: `Dosage options don't include an mg amount yet — add one to set a daily limit for this medication.` before the caregiver has typed a single character. It is technically accurate and the tail wording ("add one to…") is the softer variant, but a red-adjacent alert badge on an untouched form reads as "you did something wrong" to a stressed user.

### L-4 — LOW: copy and typography nits (all read off the running app)

| Text | Where | Issue |
|---|---|---|
| `On top of the reminder times above -- stops a dose from being logged again too soon after the last one.` | index.html:4710 | Double hyphen instead of the em dash used everywhere else |
| `Last taken - Sunday 8/9 · 8 mg` | med card | Hyphen where the app otherwise uses `·` / `—` |
| `TODAY - SATURDAY 8/15` vs `FRIDAY, 8/14` | History day headers (index.html:5987) | Two different separators one line apart |
| `Next dose tomorrow after midnight` | daily-limit lock state | Reads as an instruction to dose at 12:01 am; means "the limit resets at midnight" |
| `Daily limit of 2 pills reached` for a medication dosed in "1 capsule" | index.html:4244 | App calls capsules/patches/sprays "pills" in the safety message |
| `Not yet logged for yesterday` (Appetite) vs `No entries yet` (Bowel Movement) | Reports list, brand-new profile | Two different empty states for sibling cards; "yesterday" is confusing on a profile created today |
| `1 day before` on the appointment detail | Calendar day panel | Rendered as a bare line under the time with no `Reminder:` label — reads like part of the note |
| `Care team said no Zofran on chemo days. Log it anyway?` | index.html:3915 | Hardcoded drug name in a generic status line. Currently unreachable for new installs (only `med.id === 'zofran'`, and `RESERVED_LEGACY_MED_IDS` stops any user-created medication taking that id) — dead copy, but it would be wrong if it ever surfaced |

### L-5 — LOW: `▲` / `▼` reorder buttons are 40×40, under the 44 px minimum

Meds → "Home screen order" rows. Every other control in the app measured ≥ 44 px.

### L-6 — LOW: a placeholder URL ships in production

`index.html:89` — `const SUPPORT_LINK = 'https://ko-fi.com/REPLACE_WITH_REAL_LINK';`. The `SUPPORT_LINK_READY` derivation (line 90) correctly keeps the banner disabled, so nothing is user-visible today. Flagging it only because it is a live literal in the shipped file.

### L-7 — LOW / informational: the native app's Capacitor plugins load from a third-party CDN at runtime

`index.html:17-37` loads `@capacitor/core`, `local-notifications`, `filesystem` and `share` from `cdn.jsdelivr.net` on every page load. In this sandbox those four requests fail (blocked proxy) and the app degrades cleanly with zero errors — the guards work. But on a real device, a CDN outage or a cold start with flaky connectivity means `window.Capacitor` is undefined, which silently disables **local notifications** (the dose reminders) and the native export share sheet, with no user-visible signal. This is the same failure shape as the app-v47 `synapse` regression that went undetected for three versions. It is a pre-existing architectural choice (the Capacitor shell already loads the whole app from `server.url`), so I am logging it rather than calling it a regression — but "reminders silently stop working when the CDN hiccups" is worth a decision.

---

## Backlog items I touched — confirmed or cleared

| BACKLOG item | Status |
|---|---|
| No year shown on date labels (Notes / Calendar) | **CONFIRMED** — Notes badges read `AUG 13 / Thursday` and `AUG 9 / Sunday`, no year |
| Notes/Appointments "Delete?" confirm never auto-resets | **CONFIRMED** — tapped delete on a note (`Delete?` shown), navigated to Home, returned to Notes: still `Delete?` |
| "Welcome to ChemoWell" toast overlaps the tour's Daily limit field | **PARTIALLY CONFIRMED** — the toast is still on screen during tour step 4; in my runs it sat at the bottom centre and did not land on the Daily limit field at 390 px. Timing-dependent; not reproduced as an overlap at this viewport |
| `saveNote()`'s empty-text branch unreachable | Not re-tested (pure dead-code claim, unchanged) |
| Exact-alarm explainer should lead with battery optimisation | Not testable in a browser (see below) |
| `sync-backend` items (pull latency, handshake cleanup, revocation) | Out of scope for this pass — no code change since they were logged |

---

## What I could NOT test, and exactly why

Everything else in the brief was tested by driving the running app. These three are genuine platform boundaries, not deferrals:

1. **Real Android OS notification delivery.** The app's reminders go through `Notification` in the browser and `@capacitor/local-notifications` in the native shell. A headless Chromium has no OS notification tray, and this sandbox has no Android device, no emulator and no `/dev/kvm`. I verified the *scheduling* side is reachable and that `TEST_MODE` correctly suspends reminders while a simulated date is active (`return 'paused_sim'`, index.html:7088), and Settings correctly reports `Notifications are blocked for this app` with recovery instructions. Whether a notification actually reaches a locked phone can only be answered by the `emulator-smoke` CI job or a real device.
2. **The native share sheet / native file write.** `nativeShareFile()` is a no-op when `window.Capacitor` is undefined, which is the case in any browser. I tested the web fallback path end-to-end (real download event, correct filename, correct bytes) and read the native path; I cannot exercise `Filesystem.writeFile` + `Share.share`.
3. **The Capacitor WebView's own Back-button behaviour.** I measured that the web app creates no history entries (M-7) and that `goBack()` leaves the page. What Android's hardware Back button then does inside the Capacitor activity needs the real shell.

Also noted: the four `cdn.jsdelivr.net` script loads fail in this sandbox by design (no outbound internet). I confirmed the app's own guards handle that with zero console errors, but I could not test the app *with* those plugins present.

One TEST_MODE-only artifact worth knowing about, deliberately not filed as a defect: stepping the Beta date control *backwards* leaves the vitals cards showing readings from "the future" (on a simulated Aug 11, the Temperature card showed the Aug 15 reading). Real users cannot produce future entries; this only affects beta date-control testing.

---

## Screenshots

`outputs/v51-full-audit-screenshots/` — 10 images, curated per the TEAM.md cap:

| File | Shows |
|---|---|
| `01-tour-banner-covers-header-and-menu.png` | M-4 — tour banner over the header, hamburger unreachable |
| `02-other-profile-med-editor-adaptive-copy.png` | §2 — "Other" editor, all labels correct (Aaron's question, settled) |
| `03-other-profile-home-still-says-treatment-schedule.png` | M-3 — the same profile's Home card still says "Treatment schedule" |
| `04a-home-says-2-missed-doses.png` | H-1 — the banner |
| `04b-history-says-all-caught-up.png` | H-1 — what its own Review button leads to |
| `05-meds-list-managed-only-plus-morning-group.png` | M-1 — contradictory placement chips on two medications |
| `06-med-editor-overflows-at-360px.png` | M-5 — 19 px horizontal overflow at 360 px |
| `07-history-full-week.png` | The full 7-day History, every loggable type present |
| `08-fever-101-4-no-text-warning.png` | M-6 — 101.4 °F with no words |
| `09-radiation-only-home-no-treatment-date-ui.png` | H-2 — no Treatment schedule card; the "only near treatment day" med is absent |
| `10-desktop-1280.png` | Desktop pass (secondary check) |

---

## Recommendation to the Project Manager

**Do not report this build to Aaron as clear.** H-1, H-2 and H-3 all reach a real caregiver, and two of the three are safety-relevant. H-3 is a defect Aaron already reported once. Under the restart rule these are the "real functional / safety-relevant miss" tier: back to the Lead Developer, then both mandatory gates again from scratch.

M-6 (fever wording) should not be resolved in-chain — per the copy-review rule it is high-stakes enough to warrant Aaron's decision and a real clinical/copywriting pass.

Test data was left in place under `/tmp/pw/seed-*.json` (browser-context only; nothing was written to the repo except this report and the screenshots).
