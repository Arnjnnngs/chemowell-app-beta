# Zero Day Auditor — app-v52

**Date:** 2026-08-09 · **Commit under test:** `ca587c4` ("app-v52: fix three High-severity defects from the full app audit")
**Method:** real end-to-end testing against the running product (Playwright + Chromium, `python3 -m http.server` over the repo), plus a line-by-line read of the diff and its blast radius. Primary viewport **390 × 844** and **360 × 780**. Four profiles created from wiped installs (Chemo, Radiation, Both, Other), every medication and every log entered by the Auditor through the real UI. `git diff origin/main -- index.html sw.js` shows only the v52 commit, so the code under test is byte-identical to what would ship.

---

## VERDICT — **app-v52 is NOT clear to ship yet.**

The three v51 High findings are genuinely fixed for the paths Aaron named, and I could not find a single regression: a profile that never touched treatment-day modes renders a **byte-identical Home** on v51 and v52, the radiation-only default really is **OFF**, no other Home-card default moved, and there were **zero console errors** in every one of the ~40 browser sessions this audit ran.

But **the H-2 fix is incomplete in a way that reproduces Aaron's original complaint.** The `!hasTreatmentDate()` escape hatch was added to exactly one of the seven places that ask "is this medication inside its treatment window" (`index.html:3821`). The other six still treat "no date exists" as "outside the window". The most visible consequence: a medication placed in the **Morning / Afternoon / Evening group** instead of its own Home card is *still* the same dead end — it renders an inert row reading **"Outside its treatment-day window"** when there is no window at all, and cannot be logged. On the same screen, at the same moment, an identically-configured standalone medication shows **"✓ Available"**. That is Finding **V52-1**, and it is High.

Four further Mediums all sit inside the code this release touched: the dose-progress ring under-counts, missed-dose tracking silently ignores exactly the medications the new filter now shows, a medication with no treatment date can announce **"Course complete"**, and *today's* missed doses are still counted by a banner whose own tap target lands on "you're all caught up" — the identical contradiction H-1 fixed for past days.

Under TEAM.md's restart rule these are the functional/safety tier: back to the Lead Developer, then both mandatory gates again.

**What is safe:** shipping v52 as-is would be strictly better than v51 for every user. Nothing here is a regression. The objection is that it must not be reported to Aaron as "H-2 fixed", because for a grouped medication it isn't.

---

## Aaron's headline demand — *"the testing should show if a med is actually showing up near treatment day and disappears when it needs"*

Driven live, on four profiles, with `TEST_MODE` date override. Test medication: **`Window Med`**, "Only near treatment day", `daysBefore = 2`, `daysAfter = 1`.

| # | Case | Result | Observed on screen |
|---|---|---|---|
| A-1 | Only-mode med, **no treatment date set** → must be VISIBLE | **PASS** | Quick log: `Ondansetron ✓Available` · **`Window Med ✓Available · No doses logged · 2 mg`** · `Sched Only Med ✓Available` · `Excl Med ✓Available` |
| A-1b | Same, but a *scheduled* (time-window) only-mode med | **PASS** | `Sched Only Med · ✓Available · No doses logged · 4 mg` |
| A-2 | Treatment date **8/20** (11 days out, window −2/+1) → must be HIDDEN | **PASS** | Quick log: `Ondansetron`, `Excl Med` only. `Window Med` and `Sched Only Med` both absent |
| A-3 | Treatment date **today** → VISIBLE again | **PASS** | `Window Med ✓Available · No doses logged · 2 mg` back in Quick log |
| A-4 | **Boundary walk**, treatment 8/20, window −2/+1 | **PASS — exact, no off-by-one** | 8/16 (−4) hidden · 8/17 (−3) hidden · **8/18 (−2) VISIBLE** · 8/19 (−1) VISIBLE · 8/20 (0) VISIBLE · **8/21 (+1) VISIBLE** · 8/22 (+2) hidden · 8/23 (+3) hidden |
| A-4b | Same walk for the scheduled variant | **PASS** | identical day-for-day |
| A-5a | **Excluded** mode, no date → visible and loggable | **PASS** | `Excl Med · ✓Available · No doses logged · 1 pill` |
| A-5b | Excluded mode, date far away → normal | **PASS** | `Excl Med · ✓Available` |
| A-5c | Excluded mode, date **today** → inert | **PASS** | `Excl Med` / **`Excluded near treatment day`** (no dose buttons) |
| A-5d | Excluded-mode boundary walk (inverse of A-4) | **PASS — exact** | inert on 8/18, 8/19, 8/20, 8/21; normal on 8/17 and 8/22 |
| G-2 | `0 / 0` window = treatment day only | **PASS** | visible 8/9 (`Edge Med ✓Available`), hidden 8/8 and 8/10 |
| G-3 | **Clearing** the date while inside the window | **PASS** | card header returns to `No treatment date set`; `Edge Med` stays VISIBLE (does not vanish) |

Evidence: `01-PASS-chemo-no-date-only-med-visible.png`, `02-PASS-date-far-away-only-med-hidden.png`, `03-PASS-date-today-only-visible-excluded-inert.png`.

### Per profile type

| # | Case | Result | Observed |
|---|---|---|---|
| C-1 | **Radiation-only** default: Treatment schedule card OFF | **PASS** | Home cards = `TEMPERATURE, WEIGHT, BLOOD PRESSURE, RADIATION SESSIONS` — no chemo countdown |
| C-1/Chemo,Both,Other | Default: card shown | **PASS** | `… TREATMENT SCHEDULE …` present on all three |
| C-2 | Settings toggle exists on **every** profile | **PASS** | Radiation-only Settings: `Treatment schedule card` · state **OFF** · helper *"Countdown and reminders around treatment dates. Turn this on if any medication is set to appear only near your treatment day."* |
| C-3a | Radiation-only, no date: only-mode med VISIBLE (the exact v51 H-2 repro) | **PASS** | Quick log: `Aquaphor ✓Available · 1 application` · **`Pre-Rad Antiemetic ✓Available · No doses logged · 8 mg`** |
| C-3b | Toggle ON surfaces the card | **PASS** | `TREATMENT SCHEDULE / No treatment date set / Pick a date` appears on Home |
| C-4 | A date can actually be set on radiation-only | **PASS** | `TREATMENT SCHEDULE / Thursday, 8/20 · in 11 days / Clear` |
| C-5a | Date far away → med hidden | **PASS** | `Pre-Rad Antiemetic` absent |
| C-5b | Radiation-only boundary walk −2..+1 | **PASS — exact** | 8/17 hidden · 8/18–8/21 VISIBLE · 8/22 hidden |
| C-7 | No other Home-card default changed | **PASS** | 8–9 toggles read per profile, every one at its documented `HOME_PREF_DEFAULTS` value; the only deviation is the intended radiation-only `showChemoSchedule = false` |
| I-2 | **Other** profile: only-mode med visible with no date | **PASS** | `Pre-Infusion Steroid ✓Available · 4 mg` |
| T-Chemo/Radiation/Both/Other | Full 10-step guided tour from a wiped install | **PASS** | 10/10 panels walked on each; zero console errors |
| T-copy | Radiation-only screens avoid chemo-specific wording | **PASS** | no non-brand occurrence of "chemo" on the radiation tour/Home |

Evidence: `04-PASS-radiation-only-med-now-visible.png`, `05-PASS-radiation-settings-toggle-default-off.png`.

### No regression

| # | Case | Result | Observed |
|---|---|---|---|
| F-1 | Home identical on v51 vs v52 for a profile that **never** used treatment-day modes | **PASS** | v51 build served side-by-side on :8898 with the **same localStorage dump** injected. Home `innerText` identical after normalising only the version string and the toast. |
| F-3 | v52 History shows more days than v51 **only** where real misses exist | **PASS** | 90-day seed: v51 = 78 day sections / `Missed Doses (26)`; v52 = 90 day sections / `Missed Doses (50)`. The 12 extra sections are exactly the 12 seeded log-nothing days, all carrying real misses. |

---

## H-1 — missed-dose banner vs History

Repro rebuilt from the v51 report: chemo profile, `Pantoprazole` scheduled 08:00, dose logged 8/9, then **8/10 nothing logged at all**, **8/11 whose only entry is a period end**, **8/12 nothing**, reviewed on 8/13.

| # | Case | Result | Observed |
|---|---|---|---|
| D-1 | Home banner counts past misses | **PASS** | `Review 3 missed doses from previous days` |
| D-2 | History agrees exactly | **PASS** | History toggle reads **`Missed Doses (3)`** — banner 3, History 3 |
| D-3 | Every counted miss is resolvable | **PASS** | 3 rows, each with `Took later / Skipped / Clear` |
| D-4 | `Clear all` renders | **PASS** | present (it is gated on `totalMissed > 0`, which is why it never appeared in v51) |
| D-5 | No empty filler days | **PASS** | exactly 4 day sections: `WEDNESDAY, 8/12 — 0 doses · 1 MISSED`, `TUESDAY, 8/11 — 0 doses · 1 MISSED`, `MONDAY, 8/10 — 0 doses · 1 MISSED`, `SUNDAY, 8/9 — 1 dose`. Nothing else was added. |
| D-6 | Resolving via all three actions clears the banner | **PASS** | after `Took later` → `Review 2 missed doses…`; after `Skipped` → `Review 1 missed dose…`; after `Clear` → banner gone |
| D-7 | History then reads caught-up | **PASS** | `No missed doses to review — you're all caught up!` |
| D-8 | Stays cleared across a full reload | **PASS** | banner absent after `location.reload()` and re-setting the sim date |
| F-4 | 90-day history: banner == History | **PASS** | `Review 50 missed doses from previous days` vs `Missed Doses (50)` |
| F-5 | 90-day history: no filler sections | **PASS** | 0 sections summarised "0 doses" without a MISSED count |
| F-2 | Performance on a long history | **PASS** | 90 days / ~510 entries / 3 meds: History opens in **863 ms on v52 vs 821 ms on v51** — +42 ms (~5 %) for the extra `missedDosesFor()` pass. Acceptable. Home first paint identical (2.72 s both). |

Evidence: `06-PASS-h1-home-banner-3-missed.png`, `07-PASS-h1-history-3-resolvable-rows.png`.

**But see V52-5:** the seeding loop is `d < d0`, so **today** is still excluded. That leaves the same banner-vs-History contradiction alive for today's misses.

---

## H-3 — export units

Seven real medications created and logged through the UI, covering mg, mcg, tabs, applications, a patch, a free-text unit, and a medication with **no dosage options at all**. CSV downloaded from the running app and read off disk; printable report unlocked (simulated Plus) and read from the opened window.

| # | Case | Result | Observed — actual CSV, verbatim |
|---|---|---|---|
| E-1 | No row invents a "pill(s)" unit | **PASS** | 7 medication rows, **zero** contain the string "pill" |
| E-2 | No row states the amount twice | **PASS** | `Ondansetron,8 mg` · `Levothyroxine,75 mcg` · `Senna,2 tabs` · `Aquaphor,2 applications` · `Fentanyl Patch,1 patch` · `Saline Spray,2 sprays` — each exactly once. (v51 produced `8 mg, 8 pills`, `2 tabs, 2 pills`, `2 applications, 2 pills`.) |
| E-3 | Medication with no dose label | **PASS** | `2026-08-09,4:00 PM,Plain Med,,` — empty Detail, nothing invented |
| E-4 | **Printable report** invents no unit | **PASS** | no line in the rendered report contains "pill" |
| E-5 | Printable report matches the CSV | **PASS** | `8 mg` · `75 mcg` · `2 tabs` · `2 applications` · `1 patch` · `2 sprays` · `8 mg, override: early+overLimit` · `154.2 lbs` |

Evidence: `08-PASS-h3-printable-report-units.png`.

**Note on the fallback branch.** `if (!detail && e.pills)` at `index.html:5661` is unreachable through the shipped UI: `confirmTimeAndLog()` (`index.html:1414-1416`) only ever sets `entry.pills` when `m.dose` exists, and `entry.dose` is that same dose's label — so `pills` without `dose` cannot be produced by any user action. The branch is correct defensive code for legacy/imported records; it just cannot be exercised live, which is why E-3 tests the genuinely reachable case (no dose label → empty Detail) instead.

---

## Standard edge cases

| # | Case | Result | Observed |
|---|---|---|---|
| G-1 | Absurd window inputs | **PASS (no crash)** | `-5` → falls back to 1 · `abc` → 1 · `2.7` → rounds to 3 · empty → 1 · `0` → 0 · **`9999` → accepted, "Active window: 9999 days before…"** (see V52-8) |
| G-4 | Triple-tap a dose button + double-tap Confirm | **PASS** | exactly one journal entry: `4:06 PM · Tap Med · 5 mg` |
| G-5 | Double-tap the new Settings toggle | **PASS** | returns to its original ON state, no drift |
| G-6 | Reload with the log modal open | **PASS** | recovers to a clean Home (`ChemoWell / … / TEMPERATURE …`), no orphaned modal |
| G-7 | Offline reload | **PASS** | app renders from the service-worker cache (`chemowell-app-v52-1`) |
| G-8 | Horizontal overflow at 360 px | **PASS** | `scrollWidth − clientWidth = 0px` |
| — | Midnight rollover | **PASS** | covered by A-4 / A-5d / G-2: every day transition across both window edges was driven, in both directions |
| — | Empty states | **PASS** | "No medications yet" card, "No history yet.", "No missed doses to review — you're all caught up!", "No treatment date set" all render correctly |
| — | **Console errors** | **PASS — zero** | across every session in this audit. Only `ERR_CERT_AUTHORITY_INVALID` on the CDN Capacitor tags, which is the documented sandbox artifact and was filtered, not ignored. |

---

## Blast radius

| # | Case | Result | Observed |
|---|---|---|---|
| C-7 | `homePref()` — no other card's default changed | **PASS** | see the per-profile table above |
| I-4 | `hasTreatmentDate()` → `nextChemoTs()` on every Home render | **PASS** | 8 treatment-only meds (so `nextChemoTs()` runs 8× per render): average Home render **657 ms with 1 treatment-date record vs 658 ms with 3 000**. `nextChemoTs()` is a single `reduce`; short-circuit evaluation means it is never called for a non-treatment medication. No hazard. |
| I-4b | 3 000 treatment-date records render correctly | **PASS** | Home still lists every treatment-only med; zero console errors |
| F-2 | `renderHistory()` → `missedDosesFor()` once per day since `MISSED_TRACK_SINCE` | **PASS** | +42 ms on a 90-day history (see H-1 table) |
| **B-2** | `renderGroupedMedsCard()` | **FAIL** | → **V52-1** |
| **B-3/B-4b** | `doseProgressToday()` | **FAIL** | → **V52-2** |
| **B-5** | `missedDosesFor()` | **FAIL** | → **V52-3** |
| **B-4** | `status()` → `courseComplete` | **FAIL** | → **V52-4** |
| — | `dueRemindersAt()` / `medRemindersEnabledOn()` | **FAIL (code)** | → **V52-3**, second half. Not driveable in a browser (real OS reminder delivery is one of the genuinely unreachable items), but it is the identical guard on the identical predicate, and its live-observable sibling `missedDosesFor()` was reproduced. |

---

# FINDINGS

## V52-1 — **HIGH**: the H-2 fix misses grouped medications, so Aaron's original dead end is still reachable

* **Where:** `index.html:2519` (the grouped inert row) and `index.html:2498` (`dueMeds`, which gates "Take all"). Compare `index.html:3821`, which is the only site that got `|| !hasTreatmentDate()`.
* **What's wrong:** `hasTreatmentDate()` was added to the standalone Quick-log filter only. `renderGroupedMedsCard()` still reads `med.treatmentOnly && !treatmentActiveOn(med, now)`, and `treatmentActiveOn()` returns `false` both for "outside the window" *and* for "there is no window" — the exact conflation the new helper's own comment says must not be made.
* **Repro (exactly what I did):** chemo profile, no treatment date. Meds → Add → `Group Only Med`, Scheduled 07:00, dose `5 mg`, Home screen placement = **Morning meds group**, Treatment-day availability = **Only near treatment day**, −2/+1. Save. Go to Home.
* **Observed on screen, same viewport, same second:**
  * Quick log → `Sched Only Med` (identical config, **Own Home card**) → **`✓Available · No doses logged · 4 mg`**
  * `MORNING MEDS` → `Group Only Med` → **`Outside its treatment-day window`**, greyed at 65 % opacity, **no Log button**
* **Expected:** the same rule the standalone card now follows — with no treatment date there is no window, so the medication is shown and loggable. The row currently asserts something that is not true: there is no treatment-day window for it to be outside of.
* **Why it matters:** this is the same class of defect as H-2, reachable by any user who picks a group placement instead of an own card, and it is the first thing a radiation-only user hits since that profile has no date until they find the new Settings toggle. It also contradicts itself on one screen.
* **Evidence:** `09-FAIL-grouped-only-med-still-dead-end.png`

## V52-2 — **MEDIUM**: the dose-progress ring under-counts the medications Home is showing

* **Where:** `index.html:1138`, inside `doseProgressToday()`.
* **Observed:** chemo profile, no treatment date, three scheduled medications (`Daily Control`, `Sched Only Med`, `Group Only Med`). Home shows two of them as `✓Available` cards. The header ring reads **`0 of 1 scheduled doses logged today`** (`aria-label` verbatim). Logging `Sched Only Med` leaves it at `0 of 1` — the dose does not move the ring at all.
* **Expected:** any medication whose card Home is showing as due should be in the ring's denominator, and logging it should move the numerator. Otherwise the ring is a second, quieter contradiction of the card list right above it.
* **Repro:** create the three meds above with no treatment date set, read the ring's `aria-label` and count the `✓Available` cards.

## V52-3 — **MEDIUM (safety-relevant)**: missed-dose tracking and reminders silently skip exactly the medications the new filter now shows

* **Where:** `index.html:1090` (`missedDosesFor`), `index.html:6608` (`dueRemindersAt`), `index.html:6849` (`medRemindersEnabledOn`).
* **Observed:** chemo profile, no treatment date. On 8/10, `Daily Control` (09:00) and `Sched Only Med` (08:00, only-mode) both had visible `✓Available` cards and neither was taken. On 8/11 the Home banner reads **`Review 2 missed doses from previous days`**. Both of those two are `Daily Control` (8/9 and 8/10); `Sched Only Med` contributes **zero**. The correct count is 3.
* **Expected:** a medication the app is actively showing as due, with alerts on, must be tracked for missed doses and must fire reminders. Right now the app shows the card, says "Available", and then never tells the caregiver they didn't take it.
* **Why it matters:** this is the missed-dose safety mechanism, on a medication that is visible specifically *because* of this release's fix. It is the one half of V52-1's inverse — v52 made these medications visible without making them tracked.
* **Reminder half:** `dueRemindersAt()`/`medRemindersEnabledOn()` carry the identical guard, so no dose reminder is ever armed for these medications either. Real OS notification delivery is not reachable from a browser, so that half is code-inspected; `missedDosesFor()` above is the live-reproduced proof the predicate is wrong.

## V52-4 — **MEDIUM**: a medication with no treatment date announces "Course complete"

* **Where:** `index.html:1286` — `const chemoOver = med.treatmentOnly && !treatmentActiveOn(med, d0 + 86400000);`
* **Repro:** chemo profile, **no treatment date ever set**. Add `Sched Only Med`, Scheduled 08:00, dose `4 mg`, Own Home card, Only near treatment day. Log today's dose. Look at the card.
* **Observed on screen:** `Sched Only Med` · `Waiting` · **`Last taken - Sunday 8/9 · 4 mg`** · **`Course complete`** · `4 mg`. Tapping the dose button then offers *"This medication's treatment window has ended. Log it anyway?"* — for a medication whose treatment window has never been defined.
* **Expected:** with no treatment date, the same `!hasTreatmentDate()` reasoning applies — this should read `Next dose tomorrow at 8:00 AM`, not "Course complete". Before v52 the card was hidden entirely, so this copy was unreachable; the H-2 fix made it visible without fixing what it says.
* **Why it matters:** "Course complete" is a clinically loaded phrase. A caregiver reading it at 2am concludes the prescription is finished.
* **Evidence:** `10-FAIL-course-complete-with-no-treatment-date.png`

## V52-5 — **MEDIUM**: H-1's contradiction is still live for *today's* missed doses

* **Where:** `index.html:6030` — the new seeding loop is `for (let d = dayStart(MISSED_TRACK_SINCE); d < d0; …)`, which excludes today. Today only reaches `dmap` if something was logged today.
* **Repro:** chemo profile, `Pantoprazole` scheduled with two windows (08:00 and 12:00), created 8/9. Advance the sim date to 8/10 and log nothing. Resolve the 8/9 miss from History so only today's remains.
* **Observed on screen:**
  * Home banner: **`Missed dose`** / `Clear` / **`Today: Pantoprazole — Daily window (8:00 AM) closed with no dose logged`** (`aria-label` = `Review 1 missed dose from today`)
  * Tapping that banner — its own `onClick` is `goToHistoryTop()` — lands on History → Missed Doses → **`No missed doses to review — you're all caught up!`**, with no count on the toggle and no `Clear all`.
* **Expected:** the same rule the fix applied to past days. If the banner counts it and links to History, History must list it.
* **Severity note:** this is *not* the un-clearable dead end H-1 was — today's banner carries its own `Clear`, names the medication and window inline, and the miss becomes fully resolvable in History tomorrow. But it is the same two-screens-disagreeing contradiction, on the screen the fix was written for, and "an un-dismissable red alert trains people to ignore red alerts" applies just as much to a self-contradicting one.
* **Evidence:** `11-FAIL-today-miss-banner.png`, `12-FAIL-today-miss-history-all-caught-up.png`

## V52-6 — **MEDIUM (copy, for a stressed caregiver)**: nothing tells the user their treatment-day restriction is currently doing nothing

* **Where:** `index.html:3821` (the Home card) and `index.html:4945` (the Meds-list chip).
* **Observed:** with no treatment date set, a medication saved as "Only near treatment day" renders on Home as **`Pre-Infusion Steroid · ✓Available · No doses logged · 4 mg`** — pixel-for-pixel the same as an unrestricted medication. Meanwhile the Meds list still shows the chip **`Your date −2/+1`** (or `Treatment day −2/+1`), which states an active restriction.
* **Expected:** the medication should say why it is always visible — e.g. a caption `Set a treatment date to limit this to your treatment days`, ideally tapping through to the Treatment schedule card. Right now the caregiver has configured a safety restriction, the app has silently disabled it, and the only place that mentions it asserts the opposite.
* **Why this is the copy finding that matters most:** v52 correctly chose "show it" over "hide it". But an unexplained *shown* medication is a quieter failure of the same kind as an unexplained *hidden* one — the caregiver believes a rule is in force that isn't.

## V52-7 — **LOW (copy)**: the new Settings toggle description is the only treatment-day surface that doesn't adapt to the "Other" profile

* **Where:** `index.html:5544`.
* **Observed on an "Other" profile:** Settings helper reads *"…Turn this on if any medication is set to appear only near **your treatment day**."* On the identical profile, the medication editor says **"Only near your date"**, and the Meds-list chip says **`Your date −2/+1`**.
* **Expected:** route it through `isOtherTreatmentType()` like every neighbouring surface — *"…if any medication is set to appear only near your date."*
* This extends v51's still-open **M-3** ("the Other profile's editor is adaptive but four surrounding surfaces are not") by adding a fifth surface in this release.
* **Evidence:** `13-LOW-other-profile-settings-copy.png`

## V52-8 — **LOW**: `clampTreatmentDays()` has a floor but no ceiling

* **Where:** `index.html:4320-4324`.
* **Observed:** typing `9999` into "Days before treatment" is accepted, previewing **"Active window: 9999 days before through 1 day after treatment day."** — a ~27-year window, i.e. "always visible" wearing a restriction's label. `-5`, `abc` and empty all correctly fall back to 1; `2.7` rounds to 3.
* **Expected:** clamp to something a real regimen can use (e.g. 0–60), consistent with `radiationPlannedTotal`'s 1–99 validation and its toast.
* Not urgent — it degrades to "always shown", which is the safe direction — but it's an unvalidated numeric field in the medication editor.

## V52-9 — **LOW (pre-existing, not from this release)**: after setting a treatment date, the picker still reads "Pick a date"

* **Where:** `index.html:1378` — `setChemoDate()` ends with `setState({ chemoInput: '' })`, and the picker button at `index.html:3746` renders `state.chemoInput ? <formatted date> : 'Pick a date'`.
* **Observed:** immediately after setting 8/20 the card header correctly reads `Thursday, 8/20 · in 11 days`, but the control directly beneath it still says **`Pick a date`**. It should read `Aug 20, 2026` (or `Change date`), or the two lines look like the date didn't take.
* Surfaced here because v52 exposes this control to radiation-only profiles for the first time, so more users will meet it.

## V52-10 — **LOW (pre-existing, doctor-facing)**: the export prints a raw internal override code

* **Where:** `index.html:5666` — `detail += 'override: ' + e.overrideReason`.
* **Observed in the real printable report:** `4:01 PM · Ondansetron · **8 mg, override: early+overLimit**`. `early+overLimit` is a database value, not a sentence. This is the document a caregiver hands an oncologist.
* **Expected:** the same treatment `overrideBadgeLabel()` already gives the on-screen badge — e.g. `logged early, over daily limit`.
* Same family as v51's **M-2** (raw `weightReason` id in the CSV), which I did not re-test in depth and is presumably still open.

---

## Screenshots — `outputs/v52-audit-screenshots/`

| File | Shows |
|---|---|
| `01-PASS-chemo-no-date-only-med-visible.png` | A-1 — only-mode med visible with no treatment date (the v51 vanish is gone) |
| `02-PASS-date-far-away-only-med-hidden.png` | A-2 — same med hidden with the date 11 days out |
| `03-PASS-date-today-only-visible-excluded-inert.png` | A-3 / A-5c — only-mode back, excluded-mode inert, on the same screen |
| `04-PASS-radiation-only-med-now-visible.png` | C-3a — the exact v51 H-2 repro, now passing |
| `05-PASS-radiation-settings-toggle-default-off.png` | C-1 / C-2 — toggle present and defaulting OFF on radiation-only |
| `06-PASS-h1-home-banner-3-missed.png` | D-1 — banner says 3 |
| `07-PASS-h1-history-3-resolvable-rows.png` | D-2/D-3 — History says `Missed Doses (3)`, all resolvable |
| `08-PASS-h3-printable-report-units.png` | E-4/E-5 — the doctor-facing report with correct units |
| `09-FAIL-grouped-only-med-still-dead-end.png` | **V52-1** — grouped row "Outside its treatment-day window" beside a standalone "✓Available" |
| `10-FAIL-course-complete-with-no-treatment-date.png` | **V52-4** — "Course complete" with no date ever set |
| `11-FAIL-today-miss-banner.png` | **V52-5** — Home counts today's miss |
| `12-FAIL-today-miss-history-all-caught-up.png` | **V52-5** — where that banner's own tap lands |
| `13-LOW-other-profile-settings-copy.png` | **V52-7** — "treatment day" on an "Other" profile |

## Not verifiable in this environment

Named explicitly per TEAM.md rather than quietly skipped:

* **Real Android OS notification delivery** — V52-3's reminder half. The predicate is code-identical to the live-reproduced `missedDosesFor()` case, so the finding stands on that; only actual delivery is unreachable.
* **The native share sheet** for the CSV export (`nativeShareFile`). The web fallback path was driven end-to-end and the file was downloaded and read off disk, so `buildExportRows()` — the thing H-3 changed — is fully verified.
* **The hardware Back button.**

Everything else in this report was determined by the Auditor driving the running app. No test case was closed with "please confirm on your device".
