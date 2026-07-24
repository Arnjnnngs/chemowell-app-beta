# QA "User Zero" Walkthrough — ChemoWell APP-BETA v12

**Role:** QA Tester (Stage 5, Quality Chain) — first shift for this role
**Date:** 2026-07-24 (~5:40 PM local app time)
**Method:** Fresh browser, localStorage + sessionStorage + SW caches wiped. Every action a real tap/type through the UI — no state seeding, no evaluate-shortcuts for user actions. Beta date controls (an in-app UI feature) used only where a test needs a day change (check-ins ask about "yesterday").
**Viewports:** Primary 390x844. First-run + med-add repeated at 360x740. Form screens re-tested at 360x400 (keyboard-open height). Desktop 1280x900 layout sanity last.
**Screenshots:** `outputs/qa-v12-01…90*.png` (numbered chronologically, referenced per step below).

---

## Part 1 — First run (390x844)

| # | Step | Result | Notes / screenshot |
|---|------|--------|--------------------|
| 1 | Fresh load → welcome screen | **PASS** | Clean card: privacy promise up front, one name field, one button, "a short interactive guide will walk you through…" sets expectations. `qa-v12-01` |
| 2 | Type name "Margaret" → Get started | **PASS** | Lands on Home with guide Step 1 of 10 card centered. `qa-v12-03/04` |
| 3 | Guide step 1 (Welcome card) → "Show me" | **PASS** | `qa-v12-04` |
| 4 | Step 2: compact top banner "Tap Meds at the bottom" + spotlight ring on the Meds tab | **PASS** | Banner is small, instruction + More + Skip; the target tab is visually ringed. `qa-v12-05` |
| 5 | Banner "More" expands to full card with Skip guide / Back / Got it | **PASS** | `qa-v12-07` |
| 6 | Step 3: tap Add → inline med editor opens, banner advances to step 4 "Fill out the form, then tap Add medication at the bottom" | **PASS** | Editor is a normal in-page form (nothing buried under the tour card — the v11 defect is gone). `qa-v12-08` |
| 7 | Fill name/generic/doses; Schedule type → **Scheduled window** | **PASS** | Switching type swaps "Minimum gap hours" for "Schedule windows" with a sensible pre-filled default value ("8 AM-8 PM Daily") and example placeholder. `qa-v12-09` |
| 8 | Enter two windows, daily limit 2 "pills", toggle states, tap Add medication | **PASS (validation caught me)** | Save was blocked with a genuinely smart toast: *"The daily limit is in pills but no dose option includes a count (e.g. \"1 pill\") — the limit could never be enforced."* Exactly the right check; message tells you both fixes. `qa-v12-12` |
| 9 | Fix limit to 16 mg → save | **PASS** | Toast "Zofran added…", card shows Doses / Rules / Own Home card summary; guide advances to step 5 "tap Home". Header dose ring appears (0/2). `qa-v12-13` |
| 10 | Step 5 → Home; steps 6–9 (Quick Log, Reports, In-Patient, Symptoms explainers); step 10 "You're ready!" → Finish | **PASS** | Cards anchor near the section they describe; Back/Next/Skip all ≥44px. `qa-v12-14–18` |
| 11 | **CONFUSED:** immediately after adding the med (mid-afternoon), Home already shows a red "Missed dose" alert + a journal "MISSED — Morning window closed" entry | **CONFUSED (medium)** | I added this medication 5 minutes ago; being told I already missed a dose during onboarding is alarming. A first-day grace (or "window was already closed when this med was added" wording) would fix it. `qa-v12-14` |

**First dose through the flow:** tapped "4 mg" at 5:42 PM (window opens 6:00 PM) → inline warning **"Closed — opens in 17m. Log it early anyway?"** with explicit Log-now / Cancel buttons (`qa-v12-20`), then a Date/Time confirm sheet defaulting to now (`qa-v12-22`). Confirmed → ring 1/2, journal entry, toast (`qa-v12-23`). **PASS** — the window rule communicates instead of silently blocking.

## Part 2 — Daily loop (390x844)

| # | Step | Result | Notes |
|---|------|--------|-------|
| 12 | Second dose + rules | **PASS** | Logged 8 mg (12/16 mg). The remaining dose button then **relabels itself "8 mg · over limit"** and tapping it is hard-blocked with toast *"Exceeds today's 16 mg limit — 4 mg left."* Clear, quantified, correct. `qa-v12-27/28` |
| 13 | **CONFUSED:** after both doses, card still shows chip "Waiting" + "Next dose at 6:00 PM" while the header ring shows ✓ done; also the morning MISSED journal entry silently vanished after the early-evening log with no explanation | **CONFUSED (medium-low)** | Mixed signals — a "Done for today" chip would match the ring. |
| 14 | Temperature 99.1 → Log | **PASS** | Confirm modal (date/time, defaults to now) fully on-screen. `qa-v12-29b` |
| 15 | Weight 148 → Log | **PASS** | Same confirm-sheet pattern. |
| 16 | BP 118/76 → Log | **PASS (inconsistency noted)** | BP logs **instantly** with a toast — no confirm sheet, unlike temp/weight. Harmless but inconsistent. `qa-v12-30` |
| 17 | Symptom: + → select Nausea, note, Confirm | **PASS** | Preset list + note + date/time; card gets Edit + Remove. `qa-v12-33–35` |
| 18 | Edit the symptom (change note) | **PASS** | `qa-v12-37` |
| 19 | Bowel + appetite check-ins | **PASS after day change / CONFUSED at enable time** | Enabled both in Settings; nothing appears on Home that day (they ask about *yesterday*, once a day) — no feedback that enabling worked (**CONFUSED, low**). After +1 day (in-app beta control) both cards appeared and logged fine (Normal / Little to none), then disappeared once answered. `qa-v12-62–64` |
| 20 | Missed-dose "Took later" | **PASS** | Opens the same confirm sheet; resolved entry replaces MISSED with the logged dose at the window time. `qa-v12-65/66` |

## Part 3 — Every tab (390x844)

| # | Step | Result | Notes |
|---|------|--------|-------|
| 21 | Meds: edit Zofran (add rule note) → Save changes | **PASS** | Note appears on card. `qa-v12-40` |
| 22 | Meds: add Tylenol — as-needed, min gap 6h | **PASS** | With two Home-card meds, a **"Home screen order"** panel appears with up/down controls. `qa-v12-42/43` |
| 23 | Gap rule: log Tylenol 500 mg, tap again | **PASS** | Card flips to "Next dose at 11:50 PM"; retap → *"Closed — opens in 5h 59m. Log it early anyway?"* with explicit override/Cancel. `qa-v12-46` |
| 24 | Delete Tylenol | **PASS** | Inline two-step (Remove → "Confirm delete"/"Keep") with *"Existing dose history will remain visible"* — and the post-delete toast repeats that history was preserved. `qa-v12-47/48` |
| 25 | Reports hub | **PASS** | History / Weight / Blood Pressure / Bowel Movement / Appetite tiles with live subtitles ("7 recorded entries", "148 lbs latest"). `qa-v12-49` |
| 26 | History report + back | **PASS (rough edge)** | Day-grouped, per-entry Remove, "Missed Doses / Show all" filter. The floating "↩ Back" pill overlaps the Remove button of whichever row scrolls beneath it — scroll frees it, but it can sit on a tappable control. `qa-v12-50` |
| 27 | Weight report + back | **PASS (cosmetic)** | Trend chart, Weeks/Months, Current/Average/Change stats. X-axis with one reading shows duplicated/future labels "7/24 7/24 7/25 7/25 7/25". `qa-v12-51` |
| 28 | Appetite report + back | **PASS** | Honest empty state. `qa-v12-52` |
| 29 | In-Patient: start stay | **PASS** | One tap; status "Day 1 — since …", Undo offered, toast "meds now show as Restricted". `qa-v12-54` |
| 30 | Home during stay | **PASS** | Banner "In-Patient active" with an End button right on Home; Zofran card replaced by "In-Patient (Restricted) — Given by hospital staff — not logged in this app". Exactly the promised pause behavior. `qa-v12-55` |
| 31 | End stay | **PASS** | History records "7/24 5:52 PM – 7/24 5:52 PM (1 day)". `qa-v12-56` |

## Part 4 — Settings (390x844)

| # | Step | Result | Notes |
|---|------|--------|-------|
| 32 | Profiles: "+ Add profile" on Free tier | **PASS** | Paywall sheet appears: Free ($0, current) / Plus $4.99 / Pro $14.99, one-time purchases, "Simulate purchase (beta)". Closed with ✕, returned to Settings intact. `qa-v12-58` |
| 33 | Home screen customizer toggles | **PASS** | All 8 toggles ≥44px, first-tap registers, honest descriptions ("escalate if unanswered — turn on only what the care team wants tracked"). Note: the med editor's "Show as its own Home card" defaults **ON** for new meds — good default (I initially misread my own test here; verified default-on at 360x740 run). |
| 34 | Units °F→°C, lbs→kg | **FAIL — see Blocker 1** | Journal entries correctly keep "99.1 °F" / "148 lbs", but the Home summary cards relabel the same numbers as **"99.1°C"** and **"148 kg"** — and 99.1°C renders in red fever styling. `qa-v12-61`, desktop `qa-v12-77` |
| 35 | Replay the walkthrough | **PASS** | Guide restarts at Step 1; "Skip guide" exits (drops you on Home rather than back in Settings — trivial). `qa-v12-67/68` |
| 36 | Medical disclaimer + About | **PASS** | Full disclaimer visible, version string "app-v12 (beta)", privacy statement. `qa-v12-69` |
| 37 | **Erase all data (done last)** | **PASS** | Two-step: warning copy ("cannot be undone. Purchased plans are kept.") → "Erase everything? This is permanent." → Yes → returns to the welcome screen with everything wiped. `qa-v12-79/80` |

## Part 5 — 360x740 repeat (fresh first-run)

Welcome → name "Walter" → guide steps 1–4 → added "Compazine 10 mg" (as-needed defaults) through the guide → saved → skipped remaining steps → logged a 10 mg dose (confirm sheet → journal → "✓ Available" since no gap). **All PASS.** Banner, spotlight ring, editor, and Save/Discard all visible and tappable at 360 wide. `qa-v12-82–90`

## Part 6 — Keyboard-open height (360x400)

| Screen | Result | Evidence |
|--------|--------|----------|
| Welcome patient-name + Get started | **PASS** — both in one screenful after scroll | `qa-v12-81` |
| Med editor (name focus, scroll to Save changes / Discard) | **PASS** — focused field visible below sticky header, Save reachable by scroll | `qa-v12-70/71` |
| Temperature input + Log | **PASS** — input and Log share a row, fully visible | `qa-v12-73` |
| BP systolic/diastolic + Log | **PASS** | `qa-v12-74` |
| Symptom form (modal) | **PASS** — modal scrolls internally; Cancel/Confirm reachable | `qa-v12-75/76` |
| Caveat | With the **beta date controls bar expanded**, the sticky header grows to ~167px and at 400px height list rows can be pinched between header and nav (Edit buttons untappable until the bar is collapsed). Beta-only chrome, but worth knowing. | `qa-v12-72` |

## Part 7 — Desktop (1280x900, layout sanity only)

Two-column vitals grid, centered content column, nav pill bottom — no broken layout, no overflow. `qa-v12-77/78` **PASS** (also where the °C mislabel + red fever styling is plainly visible).

---

# Verdict: **FAIL — 1 blocker**, everything else is genuinely ship-shape

### Blocker
1. **[FAIL — HIGH] Units switch relabels existing readings on Home cards, including false fever styling.** Switch °F→°C in Settings: the Home Temperature card shows the old Fahrenheit reading as **"99.1°C" in red fever styling** (and Weight shows "148 kg" for a 148 lbs reading). The journal keeps the original "99.1 °F", so the same reading displays with two different units in two places. In a chemo app where the temperature card exists to catch fevers, showing a caregiver a red 99.1°C (= 210°F equivalent alarm, or read literally a fatal temperature) is a medical-display correctness failure. Settings copy ("Units label new readings — existing readings keep the numbers you entered") describes the storage behavior, but the Home card should either convert the display value or keep the reading's original unit label, and fever styling must be computed against the reading's own unit.

### Confused items
2. **[CONFUSED — MEDIUM] Instant "Missed dose" during onboarding.** Adding a scheduled-window med after a window has already closed immediately raises the red Missed-dose alert and a MISSED journal entry — on the user's very first minute in the app. Suggest a first-day grace for windows already closed at creation time.
3. **[CONFUSED — MEDIUM-LOW] Post-completion mixed signals.** After logging all daily doses, the card still shows "Waiting / Next dose at 6:00 PM" while the header ring shows ✓; and an early log made the earlier MISSED entry silently disappear with no explanation of how it was attributed.
4. **[CONFUSED — LOW] Check-in enable gives no same-day feedback.** Turning on bowel/appetite check-ins shows nothing on Home until the next day (they ask about yesterday). A one-line "will first ask tomorrow" note in Settings would prevent the "did it work?" moment.

### Three roughest edges hit even while passing
1. **Floating "↩ Back" pill in report views sits on top of list rows**, intermittently covering a row's Remove button until you scroll it out from under it.
2. **BP logs instantly while temp/weight ask for date/time confirmation** — the inconsistency makes you doubt whether the BP tap "took" (the toast saves it).
3. **Truncation and small chart oddities:** "Last dose Today - F…" truncates on the 390px card with no way to read the full line, and the Weight trend x-axis prints duplicated/future date labels when only one reading exists.

### What clearly works (highlights)
Safety-rule UX is the best part of this release: pre-window taps get an explicit "opens in 17m — log early anyway?" choice, the over-limit dose button disarms itself with an on-button label before you even tap, hard blocks are quantified ("4 mg left"), deletion preserves history and says so twice, in-patient mode visibly restricts home logging, and the erase flow is honest and double-gated. The 10-step guide's compact-banner + spotlight pattern works at every phone size tested, and every form remains operable at keyboard-open height.

---

## Blocker 1 re-verification

**Date:** 2026-07-24 (~6:12 PM app time) · **Method:** fresh browser context, storage wiped, 390x844, every action a real tap/type (name "Margaret" → Skip guide → real inputs + confirm sheets). Screenshots `outputs/qa-units-01…13.png`. Exact original repro: log 99.1 temp + 148 weight in °F/lbs, then Settings → °C + kg.

| # | Check | Result | Evidence |
|---|-------|--------|----------|
| 1 | Home after °F→°C, lbs→kg switch | **PASS** — Temperature card shows **37.3°C** in normal dark styling (computed color rgb(42,33,39) — not red, not amber), Weight card shows **67.1 kg**. Input placeholders also converted (temp default 36.9, weight pre-fill 67.1). | `qa-units-05` |
| 2 | Journal + History rows match Home | **PASS** — Today's journal: "Temperature 37.3 °C", "Weight 67.1 kg". Reports → History rows identical. One reading, one unit, everywhere — the Home/journal disagreement is gone. | `qa-units-05`, `qa-units-07` |
| 3 | Weight report all-kg | **PASS** — Trend headline 67.1 kg, y-axis 65–70 (kg range), dot label 67.1, Current 67.1 / Average 67.1 / Change +0.0 kg, All Readings row 67.1 kg. Zero lbs mentions anywhere. Reports hub tile subtitle also converted: "67.1 kg latest". | `qa-units-08`, `qa-units-06` |
| 4 | Fever styling both directions | **PASS** — Logged 38.5 in °C mode (confirm sheet titled "Log Temperature · 38.5°C"): card shows 38.5°C in **amber fever styling** (#9A6419). Switch to °F: **101.3°F, same amber**. Note: 38.5°C sits in the app's *fever* tier (amber ≥38.0°C/100.4°F); **red** (#C0453B) is the *high-fever* tier (≥39.4°C/103°F) — verified separately with a 39.5°C reading: red in °C, and **103.1°F still red** after switching. Threshold color now follows the displayed value in both units, both tiers. | `qa-units-09`, `qa-units-10`, `qa-units-12`, `qa-units-13` |
| 5 | Switch everything back to °F/lbs | **PASS** — Journal shows the original **"99.1 °F"** and **"148 lbs"** exactly as entered (plus the 38.5°C reading as 101.3 °F). Weight card back to 148 lbs. Round-trip is lossless — no 99.1→37.3→99.2 drift. Storage inspection (verification only): entries still hold raw 99.1 / 148 / 38.5 with stamped units (Fahrenheit / lbs / Celsius); nothing rewritten. | `qa-units-11` |

### Verdict on Blocker 1: **RESOLVED**

The failure mode is gone in both directions: no relabeled numbers, no false fever color, no Home-vs-journal disagreement, and stored readings survive a °F→°C→°F round trip byte-identical.

### New observations from this pass (none blocking)

1. **[CONFUSED — LOW] Settings units caption is now stale.** It still reads *"Units label new readings — existing readings keep the numbers you entered."* Under the fix, existing readings **visibly convert** everywhere (99.1 → 37.3 the moment you flip the toggle). The stored numbers are kept, but a fresh user reading that sentence expects the old readings to keep displaying as entered — the opposite of what they then see. One-line copy fix, e.g. "Readings are stored as entered and shown converted to the unit you pick here."
2. Log-confirmation toasts keep the unit in effect at log time ("Weight 148 lbs logged at 6:13 PM" can still be on screen after switching to kg). Correct behavior — it describes the past event — just worth knowing it can briefly coexist with a kg display.
3. Pre-existing rough edge unchanged (not part of this blocker): the Weight report x-axis still prints duplicated/future labels ("7/24 7/25 7/25 7/25 7/25") with a single reading.
