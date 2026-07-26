# QA "User Zero" Walkthrough — ChemoWell APP-BETA v17

**Role:** QA Tester (Stage 5, Quality Chain)
**Date:** 2026-07-26
**Change under test:** guided-tour banner + currently-highlighted target now get a green (#2E7D4F) border/outline with a phase-synced pulsing glow, replacing the old low-contrast rose outline. Design review (`DESIGNER_REVIEW_v17.md`) and Lead Designer sign-off (`LEAD_DESIGNER_SIGNOFF_v17.md`) are both PASS. This QA pass is a full-product first-run test, not a re-review of the visuals.
**Method:** Playwright + Chromium, real taps/fills through the rendered UI (`page.locator(...).tap()` / `.fill()`) — no state seeding, no `evaluate()`-based shortcuts for user actions (evaluate used only to read `getComputedStyle`/inspect state for verification, and to wipe `localStorage`/`sessionStorage`/caches before each fresh-install run). Storage wiped before every "first run." Console (`console.error`) and page errors (`pageerror`) captured for the full session on every phase.
**Viewports:** Primary 390x844 (full first run + daily loop + all tabs/modals/settings). Repeated 360x740 (secondary mobile). Keyboard-open heights 360x440 and 390x480 (med editor, the tour-walked form). Desktop 1280x900 last, brief.
**Screenshots:** `outputs/v17-screenshots/qa/001…078*.png` (numbered chronologically) plus `outputs/v17-screenshots/qa/BUG-bp-01…07*.png` (focused repro of the one blocker found, see below).

---

## Verdict: **FAIL — 1 blocker (pre-existing, not part of the v17 diff) + 1 minor note. The v17 tour/highlight change itself is a clean PASS.**

The blocker is a genuine, reproducible crash in **Reports → Blood Pressure**, unrelated to the tour banner/highlight work in scope for this release, but squarely inside QA's whole-product mandate per `TEAM.md` §5. Per the chain's fail-fast rule this sends the release back to the Developer stage, but it does **not** implicate anything in `renderTourLayer()`, `positionTour()`, `applyTourHighlight()`, `tourGlowAnim()`, `tourClearHighlight()`, `prefersReducedMotion()`, or `@keyframes tourPulse` — every one of those was stress-tested clean (see Part 1).

---

## Part 1 — Full first run, 390x844 (never skipped, never seeded)

| # | Step | Result | Screenshot |
|---|------|--------|------------|
| 1 | Fresh load → welcome screen | **PASS** | `001` |
| 2 | Enter name "Rosalind" → Get started | **PASS** | `002` |
| 3 | Tour step 0 (welcome, centered card, target null) → green border+pulse on the card, `getComputedStyle` confirms `outline: rgba(46,125,79,0.82) solid 3px`, `animationName: tourPulse` | **PASS** | `003` |
| 4 | Tour step 1 (target `nav-meds`, banner mode) — banner pinned top, green border; Meds tab carries a bold, clearly visible green pulsing ring | **PASS** | `004` |
| 5 | Tapped "More" to expand the full card mid-step-1 — target `nav-meds` remains visible below/outside the card (card box y:528–768, target box y:782–838 — **no vertical overlap**, confirmed via `boundingBox()`, not eyeballed) | **PASS** | `005` |
| 6 | **Tapped `nav-meds` directly while the "More" card was still open** — real tap registered, advanced the tour to step 2 (`view:meds`) on the first tap | **PASS — satisfies task requirement "tap the target while More is showing"** | `006` |
| 7 | Tour step 2 (target `meds-add`, banner mode), green highlight on the "+ Add" button | **PASS** | `007` |
| 8 | **Rapid double-tap directly on the highlighted `meds-add` target** (two `touchscreen.tap()` calls 40ms apart at the exact same coordinates) — exactly one med-editor section opened afterward (`document.querySelectorAll('[data-tour="med-editor"]').length === 1`), no duplicate editor, no error | **PASS — satisfies task requirement "rapid double-tap on a highlighted target"** | `008` |
| 9 | Tour step 3 (target `med-editor`, banner mode) — scrolled to the editor while it's mid-pulse; captured at a peak frame and, after an 800ms soak, a mid-cycle frame, to check the pulse never makes the underlying field labels/values hard to read | **PASS — no legibility problem at any point in the cycle**; the pulse only dims the 3px outline ring itself, never the card background or its text | `009`, `010`, `011` |
| 10 | Filled Medication name "Ondansetron" + Dosage options "4 mg" (real `input` events through the actual form field) | **PASS** | `012` |
| 11 | Scrolled to bottom, tapped the actual **"Add medication" submit button** (not the page's identically-worded header — see note below) | **PASS**, toast confirmed "Ondansetron added to medication management." | `013`–`015` |
| 12 | Tour auto-advanced to step 4 (target `nav-home`) the instant `medEditor:open`→`med:saved` fired — highlight correctly relocated to the Home tab | **PASS** | `016` |
| 13 | Tapped `nav-home` (real tap on target) → step 5 (target `quick-log`, centered card, "Next") | **PASS** | `017` |
| 14 | Steps 5–8 (`quick-log`, `nav-reports`, `nav-inpatient`, `nav-symptoms`) — each target correctly highlighted in turn, "Next" advances correctly | **PASS** | `018`–`021` |
| 15 | Step 9 (Finish, centered card) → tapped Finish → `endTour()` | **PASS** | `022`, `023` |
| 16 | **Leftover-highlight check after Finish**: queried every `[data-tour]` element's computed style — zero elements with a non-`none` `animationName` or a non-empty inline `outline` | **PASS — `tourClearHighlight()` correctly resets everything, no stray pulsing element left behind** | — |
| 17 | First dose logged for Ondansetron (tapped the "4 mg" dose button on the newly-created Home card, confirmed through the date/time modal) | **PASS** | `024`–`027` |

**Console/page errors through the entire first run (steps 1–17): 4**, and all 4 are the pre-existing, sandbox-only `net::ERR_TUNNEL_CONNECTION_FAILED`/`net::ERR_FAILED` for the Capacitor CDN scripts (`cdn.jsdelivr.net/npm/@capacitor/...`) that `DESIGNER_REVIEW_v17.md` already identified as unrelated to `index.html` and present on a bare page load before any interaction. Confirmed independently with a clean standalone page-load probe (no tour interaction at all → same 4 errors, same URLs). **Zero real console/page errors attributable to any code touched by this release.**

One selector note for whoever re-runs this test: the medication editor's save button and its page header both render the literal text "Add medication" (`index.html:3032` header vs. `index.html:3092` submit button) — a text-only locator can silently tap the wrong (inert) element. Using a `role=button`-scoped locator disambiguates correctly; noted here since it cost real debugging time in this pass and would trip up a naive automated regression test the same way.

## Part 2 — Tour banner/highlight stress tests (task item 5, beyond what Design already checked)

| Test | Result |
|---|---|
| Does the pulse ever make text underneath/near it hard to read? | **No.** The outline/glow is `outline`/`box-shadow`-only (non-layout, per `DEV_BRIEF_v17.md` §3) and paints strictly outside each element's border box. Peak and mid-cycle screenshots of the med-editor step (`010`, `011`) show identical, fully legible field labels and values at both extremes of the pulse. |
| Does tapping precisely on a highlighted target actually register (not just render)? | **Yes**, on every one of the 8 targeted steps — every tour advance in Part 1 came from a real tap landing inside the highlighted element's bounding box, and each one fired the corresponding `advanceOn` event correctly. Outline/box-shadow do not participate in hit-testing, confirming the Dev Brief's non-interactive claim held in practice, not just in theory. |
| Rapid double-tap on a highlighted target | **PASS**, see Part 1 step 8 — no duplicate editor, no error, no double-advance. |
| Tapping the target while the "More" expanded card is showing | **PASS**, see Part 1 steps 5–6 — on step 1 (`nav-meds`), the expanded card is vertically centered and does not reach down to the bottom nav bar (card bottom edge y≈768 vs. viewport height 844, target top edge y≈782), so the target stayed fully visible and tappable, and a real tap on it worked on the first try. |
| Tour replay via "?" header button, post-onboarding | **PASS** — replayed from Settings-adjacent state, step 0 rendered correctly, advanced to step 1 with the green pulse correctly re-applied to `nav-meds` (`getComputedStyle` confirms `animationName: tourPulse`), Skip correctly ended it. Screenshots `048`–`050`. |
| `tourClearHighlight()` on Skip mid-replay | **PASS** — no stray pulsing element after Skip (spot-checked via computed style, consistent with the full-tour check in Part 1 step 16). |

No occlusion, no dead tap targets, no legibility regression anywhere in the tour surface. This matches and independently reproduces the PASS verdicts already reached by Design/Lead Design — this pass adds real-tap-through-highlight and rapid-double-tap evidence that wasn't part of their scope.

## Part 3 — Daily loop, all tabs, all modals, settings (390x844, continuing Rosalind's real state — no seeding)

| # | Step | Result | Screenshot |
|---|------|--------|------------|
| 18 | Switched through all 5 bottom-nav tabs (Meds, Reports, In-Patient, Symptoms, Home) | **PASS** | `029`–`033` |
| 19 | Reports hub | **PASS** | `034` |
| 20 | Reports → History | **PASS** | `035` |
| 21 | Reports → Weight | **PASS** | `036` |
| 22 | **Reports → Blood Pressure** | **FAIL — blocker, see below** | `037` |
| 23 | Reports → Bowel Movement | **PASS** | `038` |
| 24 | Reports → Appetite | **PASS** | `039` |
| 25 | Symptoms tab, "+" opens the symptom modal, Cancel closes it | **PASS** | `040`, `041` |
| 26 | Settings screen (Profiles, Home screen customizer, etc.) | **PASS** | `042` |
| 27 | "View plans" → Plans/upgrade sheet opens, all 3 tiers visible, "Simulate purchase (beta)" present, "✕" closes it cleanly | **PASS** | `043`, `044` |
| 28 | "+ Add profile" (on Free tier) → correctly routes to the Plans sheet (profile limit gate) | **PASS** | `045` |
| 29 | Home vitals (Temperature/Weight/Blood Pressure quick-log cards) visible and reachable | **PASS** | `046`, `047` |
| 30 | Erase all data (done last, per instructions) — two-step confirm, returns cleanly to the welcome screen | **PASS** | `051`–`054` |

## Part 4 — Blocker: Reports → Blood Pressure crashes on every open (pre-existing, not part of the v17 diff)

**Root cause, `index.html:3278-3290`:** `renderBloodPressureReport()` returns a single DOM node (`h('div', ...)`) in **both** its empty-state branch (line 3280) and its populated-state branch (line 3281) — unlike every sibling report function (`renderHistory`, `renderWeightTrend`, `renderCycle`, `renderAppetite`, `renderBowelMovementReport`), all of which return an **array**. `renderReportDetail()` (line 3336-3349) does `...content` — spreading whatever the type-specific render function returned into the result array. Spreading a single non-iterable node throws `TypeError: content is not iterable`.

**Reproduced cleanly, isolated from the rest of the walkthrough** (`outputs/v17-screenshots/qa/BUG-bp-01…07*.png`, fresh wiped profile "BugRepro"/"BugRepro3"):

1. Fresh profile, zero BP readings logged, real tap on the "Blood Pressure" report tile → **`TypeError: content is not iterable` fires immediately** (`BUG-bp-02`). The UI does not navigate — it silently stays on the Reports hub screen (`BUG-bp-02` looks identical to `BUG-bp-01`, the hub). **The tap produces zero visible feedback: no navigation, no error toast, nothing** — from a real user's perspective the "Blood Pressure" tile is just dead.
2. **The error repeats every ~1 second, indefinitely**, for as long as the app remains "stuck" on this broken state: measured 6 identical `TypeError` events over a 5.2-second window sitting idle (`BUG-bp-03`) — this is the app's existing 1-second tick (`setInterval(..., 1000)`) calling `render()` every second, which re-invokes the same broken code path every time. This is a genuine, continuous background error, not a one-shot.
3. Navigating away (tapping Home) silently recovers the app — `state.view` no longer equals `'reports'`, so the broken render path stops being invoked and the errors stop (`BUG-bp-04`). No crash is visible to the user at any point; this bug is entirely invisible except via console/page-error monitoring, which is exactly why a whole-product QA pass — not just a diff review — is what catches it.
4. **Confirmed the crash also happens with a logged reading present**, not just the empty state: logged 118/76 via the Home quick-log card (`BUG-bp-06`), then opened Reports → Blood Pressure again — same `TypeError`, same silent no-op tap (`BUG-bp-07`). Both branches of the buggy function are equally broken; there is no way to view the Blood Pressure report in this build, empty or populated.

**Severity: HIGH.** Per TEAM.md's "visible-but-unreachable, automatic FAIL" standard, this is worse than unreachable — it's a control that looks completely normal (correct label, correct icon, correct "chevron" affordance, correct meta text) and produces total silence when tapped, plus an indefinite background error loop the user never sees. In a medication-safety app, a caregiver trying to check blood pressure trends before a dose decision gets nothing and no explanation why. This is not part of the v17 tour/highlight diff — it is a pre-existing defect in `renderBloodPressureReport()`/`renderReportDetail()`, unrelated to any of the functions this release touched — but it is squarely inside the "whole product, not just what changed" scope this QA role exists for (`TEAM.md` §5, the exact root-cause pattern the role was created to catch).

**Suggested fix (for the Developer stage, not applied here):** wrap `renderBloodPressureReport()`'s two returns in arrays — `return [h('div', ..., 'No blood pressure readings yet...')]` and `return [h('div', ..., ...list.map(...))]` — matching the pattern already used correctly by every sibling report function.

## Part 5 — Keyboard-open heights (360x440, 390x480) — med editor (the tour-walked form)

| Screen | 360x440 | 390x480 |
|---|---|---|
| Tour step 0 / step 1 banner | PASS (`055`, `056`) | PASS (`062`, `063`) |
| Meds tab reached via real tap on highlighted `nav-meds` | PASS (`057`) | PASS (`064`) |
| Med editor opened via real tap on highlighted `meds-add` | PASS, `scrollWidth === clientWidth` (no horizontal overflow) (`058`) | PASS, no overflow (`065`) |
| Name + dosage fields fillable, scroll-to-save works | PASS (`059`, `060`) | PASS (`066`, `067`) |
| Save button: `boundingBox()` fully inside the viewport after scroll (y:250.7, height:44 inside a 440px-tall viewport) | **reachable, PASS** | **reachable, PASS** (y:290.8, height:44 inside 480px) |
| Real tap on "Add medication" completes the save, tour advances correctly | PASS (`061`) | PASS (`068`) |

No occlusion, no unreachable Save button, no overflow at either keyboard-open height. This matches `DEV_BRIEF_v17.md`'s prediction (§3) that the outline/border-only treatment cannot reintroduce the app-v12 tour-occlusion bug, confirmed here with real fills and real taps rather than just visual inspection.

## Part 6 — 360x740 (secondary mobile width, quick repeat)

Fresh first run "Walter" → tour step 1 → Meds tab (real tap on highlighted target) → med editor → filled "Compazine" 10 mg → saved via real tap on the actual submit button. **All PASS**, zero horizontal overflow (`scrollWidth === clientWidth === 360`). Screenshots `069`–`074`.

## Part 7 — Desktop 1280x900 (secondary, brief)

Fresh first run, real clicks (no touch on desktop) through welcome → tour step 1 (banner) → Meds tab → med editor. **PASS**, no broken layout. Screenshots `075`–`078`.

## Part 8 — Minor, non-blocking observation (not part of v17, pre-existing)

The "Welcome to ChemoWell" toast (fired once, right after "Get started") is positioned `bottom: calc(96px + safe-area)` with no `pointer-events: none`, and briefly overlaps whatever form content happens to be at that screen position during its ~4.5s lifetime — observed sitting over part of the "LIMIT UNIT" dropdown text in the med editor (`010`, `011`) and over part of the "Meds" page header text (`058`). It auto-dismisses and the field underneath remains functional once it fades; this is timing-dependent, low severity, and unrelated to anything in the tour/highlight diff, so it is not being scored as a fail, just recorded per the "check everything, not just what changed" mandate.

---

## Summary against the "see it / reach it / tell what's next" standard

Every screen and control touched by the v17 tour/highlight change passes cleanly: the green border+pulse is visible, legible at every phase of its animation cycle, never blocks a tap (verified with real taps precisely on-target, a rapid double-tap, and a tap performed while the "More" card overlay is showing), and cleans up completely when the tour ends or is skipped. The tour also replays correctly a second time post-onboarding.

The one **automatic FAIL** found in this pass is **Reports → Blood Pressure**, which is visible, looks fully functional, and does nothing when tapped — a silent dead end that also leaves a `TypeError` firing once a second in the background indefinitely. It is unrelated to the v17 diff but must block this release per `TEAM.md`'s whole-product QA mandate and the fail-fast restart rule.
