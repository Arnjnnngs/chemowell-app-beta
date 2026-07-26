# AUDIT_v17 — Tour banner/target green attention treatment (border + pulse)

Role: Auditor (Quality Chain stage 6) · Date: 2026-07-26 · Build under audit: app-v17
Method: independent adversarial pass across two fronts — (1) line-by-line code audit of
`renderTourLayer()`/`positionTour()`/`applyTourHighlight()`/`tourGlowAnim()`/`tourClearHighlight()`/
`prefersReducedMotion()`/`tourPulseDelay()`/`TOUR_STEPS` and their blast radius in `index.html`, and
(2) live end-to-end user-journey testing against the running build at http://localhost:8917/index.html
via Playwright + Chromium (`/opt/pw-browsers/chromium-1194`), real taps/fills, fresh storage per run,
390x844 primary viewport. Reviewed upstream chain artifacts in full first: `DEV_BRIEF_v17.md`,
`DESIGNER_REVIEW_v17.md` (incl. its re-verification section), `LEAD_DESIGNER_SIGNOFF_v17.md`,
`QA_USER_ZERO_v17.md`. Per instructions, the pre-existing `renderBloodPressureReport()` crash QA found
is **not** re-investigated here — confirmed still present at `index.html:3278` (unchanged location),
noted for completeness only, out of scope for this audit.

Test script and evidence: `/tmp/audit_v17.mjs` (7 automated live-browser journeys, all reproducible;
run twice for stability, 7/7 pass both runs).

---

## 1. Findings

### P0 — none.
No safety-invariant, data-loss, or crash-class defect found in the tour/highlight code or its blast
radius.

### P1 — none.
No functional regression to tour advancement, target highlighting, or any non-tour surface.

### P2-1 — `README.md` has NO `app-v17` version-history row (release-mechanics gap, still open)

`index.html:3177` (`APP_VERSION = 'app-v17'`) and `sw.js:1` (`CACHE = 'chemowell-app-v17'`) are both
correctly bumped — confirmed live via source read, not just self-report. But `README.md`'s "Version
history" table top row is still `app-v16` (2026-07-25); **no `app-v17` row exists anywhere in the
file**, confirmed by grep across the whole document.

This is not a new category of defect — `LEAD_DESIGNER_SIGNOFF_v17.md` §3c/§4.1 already found and
flagged this exact gap as **"blocking, must be fixed before this proceeds further down the chain"** and
explicitly named the missing README row. It was not fixed before the chain proceeded to QA (stage 5)
or to this audit (stage 6) — the version strings were bumped, the README row was not. Per `TEAM.md`:
*"a missing README row is an automatic PM-gate fail"* (established at `AUDIT_v11.md` P2-1, same class
of finding, same repo). This will bounce automatically at the PM gate if not fixed before then.

**Not grounds for a full chain restart** — this is exactly the "one exact-value/mechanical item" class
the Owner's amendment allows the Lead Developer to fix and have re-verified without restarting the
whole chain (same as the Lead Designer already characterized it). **Must be fixed before the PM gate.**

Fix: add an `app-v17` row to `README.md`'s version-history table summarizing the green tour
border/pulse change (banner+target `#2E7D4F` treatment replacing the rose outline, phase-synced pulse,
JS-level `prefers-reduced-motion` guard), matching the style of the `app-v16` row above it.

### P3-1 — Double-ring banner/card aesthetic (already known, re-confirmed, non-blocking)

Independently re-observed: the banner/card frame carries both a static `border: 3px solid #2E7D4F`
and a separately 2px-offset pulsing `outline: 3px solid #2E7D4F`, rendering as two concentric rings
with a visible gap — matches `DESIGNER_REVIEW_v17.md` Item 3 and `LEAD_DESIGNER_SIGNOFF_v17.md` §2b
exactly. Not a new finding; concur with both prior stages that this is non-blocking polish, not a
functional or accessibility defect. No action required from this audit.

### P3-2 — "med-manager 'Active' badge" mislabel in upstream docs (already known, doc-only)

`DEV_BRIEF_v17.md` and `DESIGNER_REVIEW_v17.md` both describe `index.html:3202` as the "med-manager
Active badge"; it is actually the Settings → Profiles active-profile indicator (`renderSettings()`).
Already caught and corrected by `LEAD_DESIGNER_SIGNOFF_v17.md` §2. Re-confirmed via grep (only three
"Active" strings in the file: this one, the rose Menstrual Cycle pill, and the amber In-Patient pill —
no medication-list "Active" badge exists). Documentation-accuracy note only, no code defect.

### Out of scope, noted for completeness — Reports → Blood Pressure crash (pre-existing, tracked separately)

Confirmed still present at `renderBloodPressureReport()`, `index.html:3278` (unchanged line number from
`QA_USER_ZERO_v17.md`'s report). Per instructions this is not re-diagnosed here; it is unrelated to
`renderTourLayer()`/`positionTour()`/`applyTourHighlight()` and everything else this release touched.
Flagging only because `TEAM.md`'s fail-fast rule means `QA_USER_ZERO_v17.md`'s FAIL verdict technically
already sends this release back to the Developer stage — the tour/highlight work itself (this audit's
actual scope) is clean, but the release as a whole cannot close out until that separately-tracked
blocker and the P2-1 README gap above are both resolved.

---

## 2. Code audit — attack surface examined, no defect found in the tour/highlight change

Read `index.html:1740–1939` in full (the entire tour subsystem: `TOUR_STEPS`, `startTour`/`endTour`/
`setTourStep`/`advanceTour`/`backTour`/`tourEvent`, `tourClearHighlight`, `prefersReducedMotion`,
`tourPulseDelay`, `tourGlowAnim`, `applyTourHighlight`, `renderTourLayer`, `positionTour`, `render`),
plus every call site that fires `tourEvent(...)` (`navigateTo`, `openMedicationEditor`,
`saveMedicationEditor`, the Discard button).

- **Landmine (brief §7.2, "`tourClearHighlight()` must also clear new properties") — closed.**
  Current code (`index.html:1778–1788`) clears `outline`, `outlineOffset`, `animation`, and
  `animationDelay` on `window.__tourHighlighted`, wrapped in try/catch. Verified live: after Skip at
  the med-editor step, the previously-highlighted element's computed style showed `animationName:
  'none'` and empty inline `outline`/`animation` — no stray pulsing element survives `endTour()`.
- **Landmine (brief §7.1, "two highlight call sites") — closed.** Both banner mode
  (`positionTour():1879`) and card mode (`positionTour():1886`) call the same shared
  `applyTourHighlight(el)` helper — no risk of the two drifting to different colors/behavior.
- **Landmine (brief §7.3, "don't cache the target element") — closed.** `positionTour()` re-queries
  `document.querySelector('[data-tour="…"]')` fresh on every call (`:1878`, `:1884`); no element
  reference is cached across renders.
- **Landmine (brief §7.4, "use `Date.now()`, not `state.now`") — closed.** `tourPulseDelay()`
  (`:1809`) uses `Date.now()` directly, not `simNow()`/`state.now` — a TEST_MODE date-offset jump
  cannot glitch the pulse phase.
- **Phase-sync math (`tourPulseDelay()`) — no off-by-one.** `'-' + (Date.now() % TOUR_PULSE_MS) +
  'ms'` is the correct negative-delay formula for resuming a symmetric loop mid-cycle; verified live
  (Test 5 below) that a freshly re-created node's `animationDelay` stays wall-clock-consistent across
  renders with no phase discontinuity.
- **Guard clauses for a missing/mismatched target — present and correct, does not throw.** Banner
  mode: `if (step.target) { const targetEl = …; if (targetEl) applyTourHighlight(targetEl); }` — no
  highlight applied and no error if the element doesn't exist for the current view. Card mode: `if
  (!step.target) return;` then `if (!el) return; // target missing -> stay centered`. Verified live
  (Test 7 below): forcing the tour onto a Home-only target (`quick-log`) while parked on the Reports
  view produces zero thrown errors and the card correctly stays centered with no highlight.
- **Blast radius — clean.** Grepped the whole file for `#2E7D4F`, `outline`, `animation`: the three
  pre-existing non-tour usages of `#2E7D4F` (Plans-sheet "Current plan" border/text, the medication
  schedule-days badge, the Settings → Profiles "Active" badge) are byte-identical to before this
  change — no drift. The only other `outline`/`outline-offset` rules in the file are the global
  `input:focus`/`:focus-visible` accessibility rules (`index.html:27–28`, unrelated, untouched); since
  inline `el.style.outline` always wins the cascade over a stylesheet selector regardless of
  specificity, the tour's highlight and the app's normal focus ring never fight over the same element
  in a way that breaks either. No other code reads `el.style.outline` and assumes it's empty; the only
  reader/writer pair is `applyTourHighlight`/`tourClearHighlight` itself. Grep for `@keyframes`/
  `animation:` confirms `tourPulse` is still the *only* looping (`infinite`) animation in the codebase
  — no other subsystem could be affected by (or accidentally reuse/collide with) its 1600ms period.
- **Hard rules (`APP_CLAUDE.md`) — intact.** No `caretracker_*` references anywhere in the file. No
  `fetch`/`XMLHttpRequest`/`sendBeacon` calls introduced in or near the tour code (`1740–1900` region
  grepped directly, zero matches). `TEST_MODE = true` (`index.html:44`) unchanged. No Firebase/cloud
  writes added.
- **Version discipline — half-done.** `APP_VERSION` and `sw.js` `CACHE` both correctly read
  `app-v17`; grepped for stray `app-v16` string literals remaining in `index.html`/`sw.js` — none
  found. The only remaining `app-v16` string in the whole repo is the historical README row itself
  (correct, it's a changelog entry, not a stale live reference) — see P2-1.

---

## 3. Live user-journey testing (Front 2) — evidence

All 7 scenarios run against the live build with real taps/fills, fresh `localStorage`/`sessionStorage`
per test, Playwright + Chromium. `serviceWorkers: 'block'` used per-context — investigation surfaced
that `sw.js`'s `self.skipWaiting()`/`self.clients.claim()` (pre-existing, unrelated to v17) causes a
genuine one-time self-triggered `location.reload()` on a truly fresh browser profile the instant the
newly-registered worker takes control (`index.html:3918–3922`); this is legitimate existing app
behavior, not a defect, but it made raw automation flaky until diagnosed, so it's blocked for
deterministic testing. `state` (the module's core state object) is intentionally not exposed on
`window` (`<script type="module">`, `index.html:40`) — verified via `readGuideStepLabel()`, which reads
the rendered "GUIDE · N OF 10" text, and `window.__tourHighlighted` (the one thing the app itself
deliberately exposes) instead.

| # | Scenario | Result | Evidence |
|---|---|---|---|
| 1 | Rapid double-tap the "?" header button (`Promise.all` of two near-simultaneous taps) to restart the tour | **PASS** | Exactly one `#tour-card`, one `#tour-banner`, one `#tour-layer` after both taps resolve; zero real console/page errors (only the pre-existing Capacitor CDN sandbox-proxy failures, cross-checked against a bare page load with `page.on('requestfailed')` — same 2 URLs, same errors, zero interaction). JS is single-threaded so `startTour()` (idempotent — resets to step 0 regardless of prior state) cannot truly race; no duplication observed. |
| 2 | Start tour, reach `nav-meds` target (step 1, banner), then tap a **different** nav tab (`nav-reports`, not the tour's target) | **PASS** | Tour stays on step 1 (label "2 OF 10" unchanged), `window.__tourHighlighted` still correctly points at `nav-meds` (present in every view since the bottom nav renders unconditionally), computed `outlineColor: rgba(46, 125, 79, 0.8..0.85)` (pulsing, in-range), `animationName: tourPulse`. No stale/duplicated highlight — the target simply persists correctly since `nav-meds` exists in the DOM on every view. |
| 3 | Start tour, reach med-editor step (step 3, banner, target `med-editor`), tap **Discard** | **PASS** | `backOn: 'medEditor:closed'` correctly fires: label steps from "4 OF 10" → "3 OF 10", `document.querySelector('[data-tour="med-editor"]')` is null (editor genuinely gone), `window.__tourHighlighted` correctly points at `meds-add` with a live `solid` outline — the highlight is not left on the vanished editor. |
| 4 | Start tour, reach `meds-add` target (step 2, banner), force a full page reload (simulated relaunch), no storage cleared | **PASS** | Label reads "3 OF 10" both before and after reload (tour progress correctly persisted via `setPrefsDB({tourStep})`/restored via the `tourStep` bootstrap check at `index.html:3902`). Post-reload: `window.__tourHighlighted` correctly re-points at `meds-add`, outline color contains `46, 125, 79`, `animationName: tourPulse` — highlight re-applies to the correct element with no flash/gap/wrong-element bug. |
| 5 | Toggle `page.emulateMedia({ reducedMotion: 'reduce' })` mid-tour (already pulsing normally), **no reload** | **PASS** | Before: `animationName: 'tourPulse'`. ~1.5s after toggling (letting the natural 1s tick pick it up, no forced re-render): `animationName: 'none'`, inline `style.animation` empty, `outlineColor: rgb(46, 125, 79)` (static full green). 20 samples at 50ms intervals (re-querying the live DOM element fresh each time, matching how the app itself re-renders) were **100% identical** — zero flicker. Confirms `prefersReducedMotion()` is re-evaluated on every render (not cached at tour-start), so toggling the OS/browser setting mid-tour takes effect on the very next natural re-render with no reload required. |
| 6 | Rapid viewport resize 360↔390 (8 flips, 80ms apart) while `nav-meds` is highlighted | **PASS** | `document.documentElement.scrollWidth === clientWidth` at rest (no overflow), `window.__tourHighlighted` still correctly `nav-meds` after the resize storm — no layout break, no highlight loss. |
| 7 | Force the tour onto a step whose target (`quick-log`, Home-only) doesn't exist in the current view (Reports) | **PASS** | Zero errors thrown. `#tour-card` stays at its centered fallback position (`top: '50%'`, `transform: 'translate(-50%, -50%)'`) exactly as the `// target missing -> stay centered` comment at `positionTour()` promises. `window.__tourHighlighted` correctly `null` — no phantom highlight on a nonexistent element. |

Two test-methodology traps worth recording since they cost real debugging time (in case whoever
re-runs this hits the same thing): (a) sampling a *cached* element reference across the 1s tick
falsely looks like a flicker, because the app deliberately destroys and recreates every DOM node each
render — `getComputedStyle()` must be called on a freshly-`querySelector`'d element each sample, not a
stored reference, or you'll observe `tourClearHighlight()`'s own cleanup of the old (now-detached) node
and mistake it for a real gap; (b) `page.route('**/sw.js', ...)` does **not** intercept a service
worker's own script-registration fetch in this Playwright/Chromium build — use the context option
`serviceWorkers: 'block'` instead.

---

## 4. Verdict

**The v17 tour/highlight change itself: PASS.** Every landmine the Dev Brief flagged is closed in the
shipped code, both Designer-caught defects (pulse contrast floor, reduced-motion not stopping the loop)
remain fixed under independent re-verification, the blast radius is clean (no drift to the three
pre-existing non-tour `#2E7D4F` usages, no interference with the global focus-ring rules, no other
looping animation in the codebase to collide with), and all 7 adversarial live user-journeys (double-
tap restart, navigate-away-from-target, discard-steps-back, reload-mid-tour, live reduced-motion
toggle, viewport-resize storm, target-missing-from-DOM) passed against the running build with
reproducible evidence.

**Release as a whole: not yet clear for the PM gate.** Two items remain open, neither inside this
audit's power to close:
1. **P2-1 (this audit, new): `README.md` is still missing its `app-v17` version-history row** —
   already flagged as blocking by the Lead Designer, not yet fixed. Small, mechanical, does not require
   a chain restart, but must be done before the PM gate (automatic PM-gate fail per `TEAM.md` otherwise).
2. **Pre-existing, out of scope for this audit: the Reports → Blood Pressure crash `QA_USER_ZERO_v17.md`
   found** technically leaves that QA pass at FAIL, which per `TEAM.md`'s fail-fast rule already sends
   the release back to the Developer stage regardless of the tour work's own cleanliness. Tracked
   separately per instructions; not re-diagnosed here.

Recommend: Lead Developer adds the README row (P2-1) and resolves the tracked Blood Pressure bug, then
this release is ready for the Lead Auditor / PM gate on the strength of what's actually been verified
here.
