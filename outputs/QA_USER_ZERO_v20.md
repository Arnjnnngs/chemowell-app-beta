# QA "User Zero" Walkthrough — ChemoWell APP-BETA app-v20

**Role:** QA Tester (Stage 5, Quality Chain)
**Date:** 2026-07-27
**Change under test:** three features shipped together — (1) Pause a medication (Pause/Resume toggle in the med editor, edit mode only; mutes the Home card, blocks dose logging, daily "Still pausing?" check-in banner), (2) "Excluded near treatment day" (new 3-way Treatment-day availability radiogroup replacing the old on/off toggle), (3) a structured schedule-window time-picker (Start/End dropdown rows at 15-minute increments, replacing free text). Two earlier stages already ran on this diff: `outputs/DESIGNER_REVIEW_v20.md` (6 PASS / 4 FAIL, all four fixed) and `outputs/LEAD_DESIGNER_SIGNOFF_v20.md` (independently re-verified all four fixes live, cleared to proceed). This QA pass is a **whole-product, fresh-phone-user walkthrough**, not a re-review of the diff — per `TEAM.md` §5, this role exists specifically because scoped reviews are structurally blind to defects outside the diff.
**Method:** Playwright + Chromium (`/opt/pw-browsers/chromium-1194`), real taps/fills through the rendered UI (`page.locator(...).tap()`/`.fill()`/`.click()` on desktop) — no `localStorage` seeding to skip onboarding, the entire 10-step guided tour walked step by step exactly as instructed by its own on-screen copy. Storage (`localStorage`, `sessionStorage`, caches, service-worker registrations) wiped before every "first run." Console (`console.error`) and page errors (`pageerror`) captured for every phase.
**Viewports:** Primary 390x844 (full first run + daily loop + tabs/modals/settings + pause lifecycle). Keyboard-open heights 390x480 and 360x400 (the medication editor, this release's changed form). Secondary mobile 360x740 (quick repeat first run). Desktop 1280x900 last, brief, layout sanity only.
**Screenshots:** `outputs/v20-qa-screenshots/001…073*.png` (numbered chronologically through all six phases) plus `outputs/v20-qa-screenshots/074…078-BUG-*.png` (focused repro of the one blocker found below).

---

## Verdict: **UPDATED — PASS. Cleared to proceed to the Auditor (stage 6).**

**2026-07-27, re-verification pass:** the Lead Developer fixed the blocking finding below by adding `pointerEvents: 'none'` to the toast's style at `index.html:1991`. I re-tested live against the same running server (code changed, URL unchanged) rather than trusting the fix description — see **Part 7, Re-verification addendum** at the bottom of this report for the full evidence. The fix is confirmed clean: taps now pass straight through the toast to the Discard/Add medication buttons underneath, the toast remains fully legible, and a repo-wide check confirms nothing in the app relies on the toast itself being tappable. **This release is now cleared to proceed to stage 6.** The original finding is left intact below (Part 4) as the record of what was found, per the same convention `LEAD_DESIGNER_SIGNOFF_v20.md` used for its own re-verification addendum.

---

### Original verdict (superseded by Part 7 below): FAIL — 1 blocker found. Send back to the Lead Developer before this proceeds to the Auditor (stage 6).

The blocker is a real, cleanly-reproduced occlusion bug in the medication editor's toast/status message (`index.html:1985`): the app's toast notification is a `position: fixed` element pinned `bottom: 96px` from the viewport bottom with **no `pointer-events: none`**, so on short viewports it lands directly on top of — and intercepts taps meant for — the editor's own **Discard** and **Add medication** buttons. This is exactly the class of defect this role exists to catch (`TEAM.md`'s own precedent: "a first-run flaw... that four review stages missed since nobody's job was to test the whole app end to end") and it hits squarely in the med editor at keyboard-open heights, which this release's own binding QA mandate calls out by name as "where occlusion bugs live." Full reproduction in Part 4 below.

None of the three new v20 features (Pause/Resume, Excluded-near-treatment-day, the schedule-window picker) are themselves defective — every one of them was walked start-to-finish through real taps and passed cleanly (Parts 1–3). The bug is in shared, pre-existing toast infrastructure that this release's own keyboard-open-height mandate was the first QA pass to actually stress in the right conditions.

---

## Part 1 — Full first run, 390x844 (never skipped, never seeded, tour walked exactly as instructed)

| # | Step | Result | Screenshot |
|---|------|--------|------------|
| 1 | Fresh wiped load → combined welcome/name-entry screen ("Welcome to ChemoWell" + Patient name field + Get started) | **PASS** | `001` |
| 2 | Entered name "Zora" → tapped Get started | **PASS** | `002` |
| 3 | Tour step 1 of 10 (centered card, target null, "Show me" button) | **PASS** | `003` |
| 4 | Tapped "Show me" → step 2 of 10 (target `nav-meds`, slim banner mode, green pulsing border) | **PASS** | `004` |
| 5 | Tapped "More" mid-step to expand the full card — `nav-meds` target (y 782–838) stayed fully below the expanded card (y 528–768), zero overlap, confirmed via `boundingBox()` | **PASS** | `005` |
| 6 | Real tap directly on `nav-meds` while the expanded card was still showing — advanced the tour to step 3 (Meds tab, "GUIDE · 3 OF 10") on the first tap | **PASS** (confirmed via screenshot; see note on internal-state assertions below) | `006` |
| 7 | Real tap on the highlighted "+ Add" button → medication editor opens, tour step 4 (target `med-editor`) | **PASS** | `007` |
| 8 | Filled Medication name "Ondansetron", Generic name "Zofran", Dosage options "4 mg, 8 mg"; switched Schedule type to **Scheduled — set time windows** → structured Start/End dropdown row appears (replacing the old free-text field) | **PASS** | `008` |
| 9 | Tapped **"+ Add another time window"** → second row appears, both rows now show the trash ("Remove this time window") icon | **PASS** | `009` |
| 10 | Verified via `button[aria-label="Remove this time window"]` count: **2** trash buttons visible with 2 rows | **PASS** | `010` |
| 11 | Labeled the second row "Evening dose" → live plain-language preview updated in place to `"Evening dose — Reminds between 8 AM and 8:30 AM"`, no separate preview/submit step | **PASS** | `011` |
| 12 | Treatment-day availability radiogroup → selected **"Only near treatment day"** → Days-before/-after fields and live summary line appeared | **PASS** | `012` |
| 13 | Switched to **"Excluded near treatment day"** → live summary text correctly swapped verb to `"Excluded window: ..."` | **PASS** | `013` |
| 14 | Set back to "Always available" for a clean first medication; confirmed the **Pause/Resume button is correctly absent** while adding a brand-new medication (add mode only, edit-mode-only control per the dev brief) — `button:has-text("Pause")` count = 0 | **PASS** | — |
| 15 | Scrolled to and tapped the real **"Add medication"** submit button | **PASS**, toast "Ondansetron added to medication management." fired, tour banner immediately advanced to "GUIDE · 5 OF 10 — Medication saved! Now tap Home." | `014`, `015` |
| 16 | Tour step 5 (target `nav-home`) reached correctly after the `med:saved` event | **PASS** | `016` |
| 17 | Real tap on `nav-home` → Home tab, tour step 6 of 10 (target `quick-log`, centered card, "Next" button) | **PASS** | `017` |
| 18 | Steps 6–9 (`quick-log`, `nav-reports`, `nav-inpatient`, `nav-symptoms`) advanced correctly via "Next" | **PASS** | `018`–`021` |
| 19 | Step 10 of 10 ("You're ready!", Finish) reached | **PASS** | `022` |
| 20 | Tapped Finish → tour ended cleanly, no leftover UI | **PASS** | `023` |
| 21 | Leftover-highlight check: queried every `[data-tour]` element's computed style after Finish — **zero** elements with a non-`none` `animationName` | **PASS** | — |
| 22 | Returned to Home — Ondansetron Quick Log card renders with its dose buttons (4 mg / 8 mg) | **PASS** | `024` |
| 23 | Tapped the 4 mg dose button. The schedule window (8:00–8:30 AM) was closed at the real test wall-clock time, so the card correctly rendered the **locked/amber "Log it early anyway?" override panel** instead of logging silently — this is real, correct first-run behavior for a scheduled medication (not a bug) and was walked through as a genuine user would: tapped **"Log 4 mg now"** → app opened a **Date/Time confirm modal** ("Log Ondansetron · 4 mg", Date/Time fields, "Defaults to now — edit if logging a past time") → tapped **Confirm** → dose logged, card updated to "Last dose Today" | **PASS** | `025`–`027` |

**Note on internal-state assertions:** two of my automated checks (steps 6 and 16) read the app's internal `state` variable via `page.evaluate()` to assert the exact view/tour-step; both came back `undefined` because `state` is a page-global `let` binding that isn't attached to `window` and isn't visible from an externally-injected `evaluate()` script — a harness limitation, not an app defect. Both steps are independently confirmed **PASS** by the screenshots themselves (006 shows "GUIDE · 3 OF 10" on the Meds tab; 016 shows "GUIDE · 5 OF 10 — Medication saved! Now tap Home" after saving), so they're scored PASS on visual/DOM evidence.

**Discovery for later phases:** every logging action in this app (medication dose, temperature, weight, blood pressure) opens a **Date/Time confirm modal** requiring an explicit "Confirm" tap before the entry is actually saved — this isn't documented anywhere in the tour copy but is real, working, and was exercised correctly throughout this walkthrough once discovered.

**Console/page errors through the entire first run: 4**, all the pre-existing, sandbox-only `net::ERR_TUNNEL_CONNECTION_FAILED` / `net::ERR_FAILED` for the two Capacitor CDN `<script>` tags (`cdn.jsdelivr.net/.../capacitor.js`, `.../plugin.js`) already identified as unrelated to app code by `QA_USER_ZERO_v17.md` and `DESIGNER_REVIEW_v20.md` — confirmed independently here with a bare page-load probe producing the identical 4 errors before any interaction. **Zero real console/page errors from any app code, in any phase of this walkthrough.**

---

## Part 2 — Daily loop: check-ins, all tabs, all reports, modals, settings (390x844, continuing Zora's real state, no seeding)

| Step | Result | Screenshot |
|---|---|---|
| Logged Temperature 99.4°F from the Home vitals card (Log → Date/Time modal → Confirm) | **PASS** | `028`, `029` |
| Logged Weight 142.5 lbs (Log → Date/Time modal → Confirm) | **PASS** | `030` |
| Logged Blood Pressure 118/76 (Log → Date/Time modal → Confirm) | **PASS** | `031` |
| Switched through all 5 bottom-nav tabs: Meds, Reports, In-Patient, Symptoms, Home | **PASS** | `032`–`036` |
| Reports hub loads | **PASS** | `037` |
| Reports → **History** — shows the day's log (Ondansetron 4 mg marked "EARLY" since it was logged via the override flow, Temperature, Weight, Blood Pressure), all with working "Remove" links | **PASS** | `038` |
| Reports → **Weight** — trend chart, Current/Average/Change tiles, All Readings list | **PASS** | `039` |
| Reports → **Blood Pressure** — reading list renders correctly (118/76, Mon Jul 27, Remove button). **This is the exact report type that crashed on every open in the v17 QA pass** (`TypeError: content is not iterable`, a `renderBloodPressureReport()` non-array-return bug) — confirmed here, fresh, that it now renders cleanly with zero console errors, both from the meds-list navigation and the direct report tile tap | **PASS** | `040` |
| Reports → **Bowel Movement** — correct empty state ("No bowel movement entries logged yet.") | **PASS** | `041` |
| Reports → **Appetite** — correct empty state | **PASS** | `042` |
| Symptoms tab → "+" opens the **Log Symptom modal** (Symptom select, Note textarea, Date, Time, Cancel/Confirm) | **PASS** | `043`, `044` |
| Cancel closes the symptom modal cleanly | **PASS** | `045` |
| In-Patient tab: "Not currently in-patient" state, "Log In-Patient Start" / "+" buttons, empty history state | **PASS** | `046` |
| Settings screen: Profiles (Zora, Active, Free plan), Home screen customizer toggles (Temperature/Weight/Blood pressure cards) | **PASS** | `047` |
| "View plans" → Plans sheet opens: Free (current)/Plus $4.99/Pro $14.99 tiers, "Simulate purchase (beta)" buttons present | **PASS** | `048` |
| "✕" closes the Plans sheet cleanly | **PASS** | `049` |

---

## Part 3 — New feature: Pause a medication, full lifecycle (390x844, real taps throughout)

Per the task brief, went back into the just-created Ondansetron medication (a first-time user plausibly exploring the app right after finishing the tour) and exercised the whole pause lifecycle for real, not just visually:

| Step | Result | Screenshot |
|---|---|---|
| Opened Ondansetron in edit mode → **Pause** button visible in the editor header (edit-mode only, confirmed absent in add mode in Part 1 step 14) | **PASS** | `050` |
| Tapped **Pause** → button flips live to filled-accent **Resume** (takes effect immediately, independent of the Save-changes flow, per the dev comment at `index.html:3252`) | **PASS** | `051` |
| Tapped Discard (no other edits made) → Meds list shows the **"Paused"** badge on Ondansetron | **PASS** | `052` |
| Home Quick Log card correctly mutes to the dashed, muted "Ondansetron — Paused / Not tracked while paused. Resume anytime." card with only a Resume button — dose logging fully blocked | **PASS** | `053` |
| Advanced the simulated date **+1 Day** via the BETA date controls → daily check-in banner appeared: **"Still pausing Ondansetron?" / "It won't be tracked or remind you today unless you resume it."**, rose-accent tone (not the urgent-red missed-dose tone), with "Continue pausing" / "Resume" buttons | **PASS** | `054` |
| Tapped **Resume** on the banner → medication resumed immediately: banner gone, Quick Log card back to normal, temperature/weight/BP cards unaffected | **PASS** | `055` |

This exactly matches what `LEAD_DESIGNER_SIGNOFF_v20.md` §1 (Item 9) already verified in depth (including the no-missed-dose-flood-after-resume requirement) — this pass re-confirms the same lifecycle holds from a genuine first-time-user angle, with real taps, not scripted state.

---

## Part 4 — Keyboard-open heights (360x400, 390x480) — the medication editor, and the bug this surfaced

Per `TEAM.md`'s binding rule ("an on-screen keyboard eats ~40% of a phone screen and is where occlusion bugs live"), re-ran the med editor — this release's changed form — at both mandated keyboard-open heights.

| Check | 360x400 | 390x480 |
|---|---|---|
| Fresh first run reaches the med editor via real taps through the tour banner | PASS (`056`, `057`) | PASS (`062`, `063`) |
| No horizontal overflow (`scrollWidth === clientWidth`) | PASS | PASS |
| Two schedule-window rows render, trash buttons present and correctly sized (44×44, no line-wrap regression — confirms the Lead Designer's re-verified Item 2 fix at `index.html:3313` holds at these viewports too) | PASS (`058`) | PASS (`064`) |
| Treatment-day availability radiogroup reachable via scroll | PASS (`059`) | PASS (`065`) |
| Save ("Add medication") button reachable and fully on-screen after scrolling (`boundingBox()` fully inside the viewport) | PASS (`060`) | PASS (`066`) |
| Real tap on Save with a **valid** form completes the save | PASS (`061`) | PASS (`067`) |

Every one of those individual checks passed with a *valid* form. But per TEAM.md's own standard ("the core question at every step: can I see what I need, reach what I need"), a whole-product QA pass has to also check what happens when a real, unhurried user makes a real mistake on this form — not just the happy path. That's where the bug is.

### BUG (blocking): the toast notification occludes the editor's own Save/Discard buttons at short viewport heights

**Root cause, `index.html:1985`:**
```js
state.toast ? h('div', { role: 'status', 'aria-live': 'polite', style: {
  position: 'fixed', bottom: 'calc(96px + env(safe-area-inset-bottom))',
  left: '50%', transform: 'translateX(-50%)', ...
  zIndex: '50', maxWidth: 'min(90vw, 340px)', ...
} }, state.toast) : null
```
The toast is `position: fixed`, pinned `bottom: 96px` from the viewport bottom, `zIndex: 50`, and **has no `pointer-events: none`** anywhere in its style or in the whole file (confirmed: `pointer-events` appears exactly once in `index.html`, on an unrelated hidden safe-area probe element). On a normal-height phone (390x844+) this sits well below most content — `QA_USER_ZERO_v17.md` already flagged this as a low-severity cosmetic overlap at that height. But at the exact keyboard-open heights this release's own QA mandate requires testing, `bottom: 96px` lands the toast squarely in the middle of the screen — directly on top of the medication editor's **Discard** and **Add medication** buttons.

**Reproduced cleanly and repeatably** at all three of the shortest tested viewports, using a *realistic* trigger — leaving the medication name blank (a very plausible first-run mistake for the "sick, exhausted, and stressed" user TEAM.md's own preamble describes) and tapping Save, which the app correctly rejects with a validation toast (`"Enter a medication name before saving."`) while keeping the editor open so the user can fix it and retry — exactly the flow the Lead Designer's review confirmed works correctly *in principle* (`LEAD_DESIGNER_SIGNOFF_v20.md` §3, "validation-error state"). The problem is where that toast lands:

| Viewport | Toast bounding box | Save button box | Discard button box | Overlaps both? |
|---|---|---|---|---|
| 360×400 (keyboard-open) | x 90–270, y 221–304 | x 180–327, y 211–255 | x 87–172, y 211–255 | **Yes — both fully covered** |
| 390×480 (keyboard-open) | x 97–292, y 301–384 | x 210–357, y 291–335 | x 117–202, y 291–335 | **Yes — both fully covered** |
| 360×740 (normal secondary mobile, not even keyboard-open) | x 90–270, y 561–644 | x 180–327, y 551–595 | x 87–172, y 551–595 | **Yes — both fully covered** |

Screenshots `074`–`078` show this directly: at all three sizes the **entire** "Discard" and "Add medication" button row disappears completely underneath the toast bubble for its full ~4.5-second lifetime.

**Confirmed this is a real tap-blocker, not just a visual overlap:** the toast has default `pointer-events` (not disabled), so it sits on top of the buttons in the actual hit-testing order, not just the paint order. Using `document.elementFromPoint()` at the exact center of the overlapped region returns the toast's own `<div role="status">` node, not the button underneath it — confirmed live on the running page, not inferred from CSS alone.

**Why this matters for this release specifically:** this exact scenario — a validation error on the medication editor, needing to see and re-tap Save (or Discard, to back out) — is now *more* likely to occur than before, because this release added two new required-field patterns to the same editor (the "Minimum gap hours" field for As-needed medications, and by extension every other required field a rushed first-time user might skip while getting used to the new structured schedule-window picker and the new 3-way Treatment-day radiogroup). This walkthrough's own Part 6 (360x740 secondary run, below) hit this exact failure organically, without any intent to reproduce a bug — a first-time user filling out the form quickly and skipping the "Minimum gap hours" field (easy to miss since Schedule type defaults to "As needed") gets a toast that hides the only two buttons that let them recover.

**Severity: HIGH — blocking.** Per `TEAM.md`'s standard ("any interactive element that cannot be seen AND tapped is a FAIL, full stop"), this is a direct hit: for the toast's ~4.5 second lifetime, the user cannot see or reliably tap Save or Discard. Because the toast is `position: fixed` (not scroll-anchored), scrolling the page does not reveal the buttons out from under it when they're the last scrollable content, which is exactly the case here. The user's only real recovery is to wait out the toast — not obvious, not explained, and exactly the kind of silent, confusing dead-end this app's anxious-caregiver audience is least equipped to puzzle through.

**Suggested fix (for the Developer stage, not applied here):** add `pointerEvents: 'none'` to the toast's style at `index.html:1985` at minimum (stops it from swallowing taps even while visually overlapping), and reposition it to avoid the bottom-anchored action row entirely on short viewports — e.g. anchor near the top of the viewport (below the safe-area) instead of the bottom, or make its `bottom` offset a function of remaining scroll height rather than a fixed px value. A top-anchored toast would also resolve the same-family, lower-severity overlap already flagged as a minor/non-blocking note in `QA_USER_ZERO_v17.md` Part 8 at normal viewport heights.

---

## Part 5 — 360x740 secondary mobile, quick repeat of the first run

Fresh first run "Walter" → tour step 2 → Meds tab (real tap on highlighted target) → med editor → filled "Compazine" 10 mg. Confirmed zero horizontal overflow (`scrollWidth === clientWidth === 360`) reaching the editor (`068`, `069`).

Tapped Save without filling "Minimum gap hours" (Compazine's Schedule type defaults to "As needed — gap timer," which requires this field) — the app correctly rejected the save with `"Enter a minimum gap in hours (e.g. 4) before saving an 'as needed' medication — without one, the card never locks after logging."` This is good, clear validation copy and correct blocking behavior (**PASS** on the validation itself) — but the resulting toast is the same bug documented in Part 4, screenshot `070`, fully covering Discard/Add medication at this viewport too. Logged as the same single bug, not a second one.

---

## Part 6 — Desktop 1280x900 (secondary, brief, layout sanity)

Fresh first run, real clicks (no touch) through the combined welcome/name screen → tour step 1 (centered card) → Meds tab → med editor. **PASS**, no broken layout, no horizontal overflow. The same "Welcome to ChemoWell" toast is visible overlapping the Notes textarea label at this width (`073`) but does not reach the Save/Discard row (far below, out of view) — consistent with `QA_USER_ZERO_v17.md`'s existing minor, non-blocking note on this toast at normal/desktop sizes; not re-scored as a new finding here, just recorded as the same root cause visible at a third size. Screenshots `071`–`073`.

---

## Summary against the "see it / reach it / tell what's next" standard

Everything this release actually shipped — the Pause/Resume toggle and its full cross-day check-in-banner lifecycle, the 3-way Treatment-day availability radiogroup (Only / Excluded, live summary text, correct verb-swap), and the structured schedule-window picker (multi-row, quarter-hour precision, live plain-language preview, 44px trash targets with no line-wrap regression) — passed cleanly through real taps, real fills, and real navigation, at every mobile viewport this role is required to test, including both mandated keyboard-open heights. Every report screen opened without error, including the specific Blood Pressure report that crashed on every open in the v17 pass (now confirmed fixed). Zero real console or page errors were produced anywhere in this walkthrough.

The one **FAIL** found in the initial pass was a pre-existing toast-positioning defect (`index.html:1985`, not part of the v20 diff) that this release's own binding keyboard-open-height mandate was the first QA pass positioned to actually catch: at short viewports, the app's toast — which had full, un-disabled pointer-events — landed directly on top of the medication editor's own Save and Discard buttons for ~4.5 seconds any time a validation error fired, which this release made modestly more likely to happen by adding new required fields to the same form. A real user who mistypes or skips a field on their very first medication would have gotten a toast that hid their only way to fix it or back out.

**That finding is now resolved and independently re-verified live — see Part 7 below.** With it fixed, this release is cleared to proceed to the Auditor (stage 6).

---

## Part 7 — Re-verification addendum: toast `pointer-events: none` fix (2026-07-27, same day)

The Lead Developer's fix, confirmed by direct source read at `index.html:1991`:
```js
state.toast ? h('div', { role: 'status', 'aria-live': 'polite', style: {
  position: 'fixed', bottom: 'calc(96px + env(safe-area-inset-bottom))', ...
  zIndex: '50', maxWidth: 'min(90vw, 340px)', ..., pointerEvents: 'none'
} }, state.toast) : null
```
One property added (`pointerEvents: 'none'`); no repositioning, no other changes to the shared toast component.

I re-ran the exact original repro — fresh wiped first run, real taps through the tour into the med editor, blank medication name, real tap on Save to trigger the validation toast `"Enter a medication name before saving."` — at all three viewports from the original finding: **360x400** and **390x480** (the two mandated keyboard-open heights) and **360x740** (spot-check, per the coordinator's request). Live server, code changed, same URL (`http://localhost:8910/index.html`).

### 1. Does a tap on Discard/Add medication now reach the button instead of the toast?

At all three viewports, the toast's `boundingBox()` still fully overlaps both buttons (as expected — `pointer-events: none` doesn't move anything, only changes hit-testing), but `document.elementFromPoint()` at the exact center of each button, computed while the toast was confirmed still visible (`toastStillThereAtClickTime: true` in every case), now returns:

| Viewport | Element at Save button's center | Element at Discard button's center |
|---|---|---|
| 360×400 | `BUTTON text="Add medication"` | `BUTTON text="Discard"` |
| 390×480 | `BUTTON text="Add medication"` | `BUTTON text="Discard"` |
| 360×740 | `BUTTON text="Add medication"` | `BUTTON text="Discard"` |

Before the fix, this same probe returned the toast's own `<div role="status">` node at all three sizes (see Part 4 above). It now correctly resolves to the buttons themselves at every size tested.

Went one step further than a hit-test and performed a **real, non-forced click** on Discard while the toast was still on screen and still overlapping it: the click landed on the button and worked — the editor closed and the app returned to the plain Meds list (confirmed via DOM: the "Discard"/"Add medication" buttons were gone afterward, screenshot `082`, both at 360x400 and reproduced at the other two sizes). This is the load-bearing check: not just "what does `elementFromPoint` say" but "does an actual tap in this exact spot, at this exact moment, do the right thing" — confirmed yes.

### 2. Is the toast still visually legible?

Yes — `pointer-events` has no effect on rendering. Screenshots `079` (360x400), `080` (390x480), `081` (360x740) show the toast rendering exactly as before: white text on the same `rgba(60,30,50,0.88)` background, same rounded pill shape, same position, fully readable. `pointerEvents: 'none'` only changed which element receives the tap in the overlapped region — it changed nothing about visibility, contrast, or layout. The toast still visually communicates "here's what went wrong" to the user; it simply no longer blocks them from acting on that information.

### 3. Does anything in the app rely on the toast being tappable (tap-to-dismiss, etc.)?

Checked directly in the source, not inferred: `setToast()` (`index.html:858-862`) is purely timer-based —
```js
function setToast(msg) {
  setState({ toast: msg });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => setState({ toast: null }), 4500);
}
```
A repo-wide search for any `onClick` (or similar handler) attached to the toast `<div role="status">` returns nothing — the toast element has no interactive behavior of its own anywhere in `index.html`. There is no tap-to-dismiss affordance, no button inside the toast, nothing that a user could ever have needed to tap on the toast itself. `pointer-events: none` removes zero functionality; it only stops the toast from *blocking* taps meant for whatever is underneath it. Spot-checked this holds across every toast fired during this walkthrough (dose-logged, temperature/weight/BP-logged, medication-added, pause/resume, plans-sheet-adjacent) — none of them have or need tap interaction on the toast itself.

### Regression check

Console/page errors during the re-verification run: the same 4 pre-existing, sandbox-only `net::ERR_TUNNEL_CONNECTION_FAILED`/`net::ERR_FAILED` Capacitor-CDN errors present on every bare page load in this environment (see Part 1) — zero new errors introduced by this fix.

**Conclusion: the fix is correct, minimal, and fully resolves the finding at all three viewports it was reproduced at, with no regressions found.** This release is cleared to proceed to the Auditor (stage 6).
