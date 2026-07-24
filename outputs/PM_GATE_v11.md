# PM_GATE_v11 — Project Manager final internal gate (Quality Chain stage 7)

Role: Project Manager · Date: 2026-07-24 · Target: APP-BETA (`chemowell-app-beta`) at app-v11
Owner request (verbatim): "on my phone when looking at the plans, the screen keeps flickering and adjusting the pop up that shows the different plans. also on any tab i'm on, if I swipe down to refresh, it take me back to home page. shouldn't it just refresh the tab that i'm on only."

**GATE VERDICT: PASS.** All five checks below passed under my own independent verification (I re-ran the syntax check and the full smoke suite myself and personally inspected the diff, the README row, and sample evidence screenshots). No code was modified at this stage.

---

## Check 1 — Chain artifacts exist and are substantive: **PASS**

| Artifact | Present | Substantive? |
|---|---|---|
| outputs/DEV_BRIEF_v11.md | yes (22.9 KB) | Full root-cause analysis of both bugs with line references, 2–3 alternatives each with rejection rationale, definition-of-done, 10 landmines, 3 Owner questions. Not a stub. |
| outputs/DESIGNER_REVIEW_v11.md | yes (8.7 KB) | Measured, rendered-product review at 360/390/1280 with byte-compare stability proof, per-item verdicts, exact-value suggestion. |
| outputs/LEAD_DESIGNER_SIGNOFF_v11.md | yes (8.5 KB) | Independent re-verification of 3 highest-stakes claims, closed two coverage gaps (360 byte-compare, time modal), surfaced 3 pre-existing a11y findings, explicit checked/found/open sign-off. PASS verdict. |
| outputs/AUDIT_v11.md | yes (15.7 KB) | Line-by-line code audit (9 attack areas), 15 live journeys with screenshots, findings ranked P0–P3. Verdict FIX FIRST on P2-1 (correctly triggered a fix pass). |
| outputs/LEAD_AUDITOR_SIGNOFF_v11.md | yes (8.7 KB) | 4 findings reproduced independently, both post-audit fixes verified (P2-1, P3-3 incl. live factory reset), 3 coverage probes run (multi-tab, TEST_MODE+sheet, SW reasoning), explicit sign-off. PASS, clear to stage 7. |
| Evidence screenshots | yes | 18 `v11-*` (Lead Dev/Designer), 7 `lead-v11-*` (Lead Designer), 15 `audit-v11-*` (Auditor), 4 `leadaudit-v11-*` (Lead Auditor). I visually inspected samples (`v11-02-sheet-open-390.png`, `audit-v11-j4-settings-restored.png`) — genuine captures of the running app matching their claims. |

Every one of the seven pre-Owner roles demonstrably ran, each by a different agent, each producing its own evidence. No stage was skipped, merged, or self-certified.

## Check 2 — Findings closure: **PASS**

| Finding | Status | Verified by a later stage? |
|---|---|---|
| P0 / P1 | none found | — |
| P2-1 — README missing app-v11 row | **FIXED** | Lead Auditor: row present, every claim cross-checked against the actual `git diff`. My own check: `grep -c app-v11 README.md` = 1, row content matches the diff I read. |
| P3-3 — erase-all hardcoded the view key string | **FIXED** | Lead Auditor: code verified (`UI_VIEW_KEY` referenced at index.html:206, literal now exists once, TDZ-safe by construction) AND exercised **live** — full factory reset ran with zero errors, key cleared, boot to welcome (`leadaudit-v11-b1-post-erase-welcome.png`). I confirmed the code in the diff myself. |
| P3-1 — purchase toast hidden behind sheet scrim (z50 < z70) | **DEFERRED** | Pre-existing since v10; does not block either Owner bug (feedback exists via the in-card "✓ Current plan" swap). Named in the README app-v11 row. Fix direction already agreed: toast zIndex 75 + pointerEvents none (Lead Designer amendment). |
| P3-2 — 35 ms double-tap on "View plans" insta-dismisses the sheet | **DEFERRED** | Pre-existing since v10; window so narrow it needs automation to hit (80 ms already safe). Named in the README row. |
| P3-4 — mid-tour reload can restore a view "ahead of" the tour step | **DEFERRED** | New-in-v11 interaction, cosmetic and self-recovering (verified live twice: no crash, no deadlock, next tap advances the tour). Named in the README row. |
| Sheet keyboard a11y (no focus-on-open, no Esc, no focus return) | **DEFERRED** | Pre-existing; v11 made this surface strictly better (the sheet node now survives between interactions). Named in the README row. |

Deferral defensibility: none of the four deferred items touch the Owner's two reported bugs; all are cosmetic/edge/a11y-polish class; all four are visible to the Owner in the README app-v11 row ("Known queued…" plus the P3-4 mention). Note: the Lead Auditor's N1 nit (P3-4 originally mislabeled "pre-existing" in the row) is already corrected — the current row reads "P3-4 new-in-v11 cosmetic," which is accurate.

## Check 3 — Scope matches the Owner's request: **PASS**

`git diff --stat`: README.md +1 line, index.html +41/−7, sw.js 1 line. I read the full index.html diff. The change set is exactly:

1. Tick guard: `!state.upgradeOpen` joins `!state.timeModal` (fixes the flicker's engine) — Bug 1.
2. Animate-once flag `upgradeSheetAnimated` + conditional `sheetUp` animation + `id: 'plans-sheet'` — Bug 1.
3. Sheet scrollTop preservation in `render()` (id-requery both sides of the wipe, no cached nodes) — Bug 1.
4. `UI_VIEW_KEY`/`VALID_VIEWS`/`restoreView()`/`persistView()` + `view: restoreView()` in initial state + persist calls in `navigateTo`/`openReport` — Bug 2.
5. `overscroll-behavior-y:none` on html,body — Bug 2 (gesture suppression, Android).
6. `sessionStorage.removeItem(UI_VIEW_KEY)` in `eraseAllAppData` (required companion + audit P3-3 hygiene fix).
7. `APP_VERSION` app-v10 → app-v11; sw.js CACHE bump; explanatory comments.

Nothing else. No feature creep, no unrelated refactors, no handler changes to the TEST_MODE purchase buttons, TEST_MODE itself intact, no new localStorage keys, no network code. Both Owner bugs are addressed; the only extra is the audit-mandated P3-3 one-token hygiene fix and the mandated docs — exactly as scoped.

## Check 4 — Release mechanics: **PASS**

- `APP_VERSION = 'app-v11'` — index.html:2940. Confirmed.
- `CACHE = 'chemowell-app-v11'` — sw.js:1; fetch/activate logic unchanged (old caches still deleted on activate). Confirmed.
- README app-v11 version-history row: present, accurate against the diff, names both bugs, the P3-3 fix, the chain artifacts, and the queued items. Confirmed.
- Syntax: I extracted the single `<script type="module">` to `/tmp/pm_extract_v11.mjs` and ran `node --check` myself — **clean**.

## Check 5 — Verification evidence is credible: **PASS**

I re-ran the Lead Developer's smoke suite myself against the local server (`NODE_PATH=/tmp/node_modules node /tmp/smoke_v11.mjs`, server at http://localhost:8877):

- **Result: `V11 SMOKE: ALL PASS`, `ERRORS (0)`** — 12/12 fix-specific checks including: tab restored on reload for every view, garbage stored view falls back to Home, overscroll-behavior computed `none`, sheet animates on open, sheet DOM node survives 3.5 s of ticks (no rebuild = no flicker), interaction re-render does not replay the animation, scroll preserved/clamped, reopen animates again, simulated purchase works, zero horizontal overflow at 390 px.
- Independent corroboration already on file: Designer byte-identical screenshot pairs (390/1280), Lead Designer byte-identical at 360 + time-modal regression, Auditor 10-second soak with byte-identical PNGs + 15 journeys, Lead Auditor's own 6-second soak + multi-tab probe. Four separate agents reproduced the core claims with their own instrumentation. This evidence is credible.

---

## Deferred-items register (carried to a future chain pass, Owner-visible via README row)

| # | Item | Severity | Origin | Agreed direction |
|---|---|---|---|---|
| 1 | Purchase/reset toast invisible behind the open plans sheet (toast z50 under scrim z70) | Low, cosmetic, pre-existing (v10) | Designer / Auditor P3-1 | Toast `zIndex: '75'` + `pointerEvents: 'none'` (Lead Designer amendment) |
| 2 | 35 ms double-tap on "View plans" lands second tap on the scrim and insta-dismisses the sheet | Low, pre-existing (v10), narrow window | Auditor P3-2 | Ignore scrim clicks ~350 ms after open |
| 3 | Mid-tour reload can restore a view ahead of the awaited tour step (one redundant instruction, self-recovering) | Cosmetic, new-in-v11 interaction | Auditor P3-4 | Informational; revisit if tour UX pass happens |
| 4 | Sheet keyboard/focus a11y: no focus-on-open, no Esc-to-close, no focus-return-to-trigger | Low-medium (WCAG 2.1.1/2.1.2/2.4.3), pre-existing; v11 improved the surface | Lead Designer §2e | Dedicated item through the full chain |
| 5 | True offline reload against the SW cache not exercised live this round (cache bump verified in code by two roles) | Informational | Lead Auditor | Cover in next audit round or post-deploy check |

Open Owner-taste questions from the Dev brief (decisions defaulted, easily reversed): profile switch reopens on Settings (recommended default shipped); iOS in-browser pull-to-refresh is best-effort suppressed — the guarantee there is "refresh keeps your tab"; TEST_MODE simulated date still resets on any reload (by design).

## Post-gate steps remaining (Lead Developer — deployment is AFTER this gate)

1. `git add` the three changed files + all `outputs/` v11 artifacts (including this report); commit as app-v11.
2. Push to GitHub **via the Chrome-based push flow** (APP_CLAUDE.md rule: Chrome push for BETA repos only; correct target = `chemowell-app-beta`).
3. Live smoke test on https://arnjnnngs.github.io/chemowell-app-beta/ **with a cache-buster query** (v8b lesson: node --check and local smoke are never sufficient for the live build): app boots, Settings shows "ChemoWell app-v11", plans sheet opens and holds still, reload on a non-Home tab restores that tab, zero console errors.
4. Confirm the service worker updates (controllerchange reload happens once; repeat visit serves the v11 cache).
5. Deliver the Owner summary (below) to Aaron. If ANYTHING is wrong at any of these steps → restart rule: back to stage 1.

---

## Completion summary for the Owner (plain language)

Aaron — both of the bugs you reported on your phone are fixed in app-v11.

**1. The flickering Plans pop-up.** The app was silently redrawing the whole screen every second, and each redraw restarted the pop-up's slide-up animation and threw away your scroll position — that was the flicker and "adjusting" you saw. Now the app pauses that background redraw while the Plans sheet is open, plays the slide-up exactly once each time you open it, and keeps your place when you scroll or tap a purchase button. We proved it with pixel-identical screenshots taken 10 seconds apart with the sheet open — it does not move by a single pixel anymore.

**2. Swipe-down-to-refresh dumping you to Home.** Two layers of fix. On Android the browser's pull-to-refresh gesture is now switched off entirely inside the app, so the accidental refresh won't happen at all. And if a refresh does happen any other way (including on iPhone, where the gesture can't always be blocked), the app now remembers which tab you were on and puts you right back there — Meds stays Meds, Reports stays Reports. Closing the app fully and reopening later still starts on Home, and "Erase all data" still resets everything like a brand-new install.

**What was tested:** this release went through the full seven-role Quality Chain you defined — a written engineering brief, the implementation, two independent design reviews, a deep audit (15 real user journeys: fresh install, tour, purchases, factory reset, profile switching, reloads on every tab, even a browser with storage disabled), and an audit-of-the-audit. Over 60 checks and dozens of screenshots, zero errors anywhere. The audit caught one process miss (a missing changelog line) — it was fixed and re-verified, which is exactly the chain doing its job.

**Knowingly deferred (small, none affect your two bugs):** the little "purchase confirmed" toast is hidden behind the Plans sheet while it's open (you still see "✓ Current plan" move instantly); an extremely fast double-tap on "View plans" can close the sheet as it opens; keyboard-only navigation of the Plans sheet needs polish; and one cosmetic tour quirk after a mid-tour refresh. All are listed in the changelog and queued for a future pass.

One choice we made for you (easy to change): after switching or adding a profile, the app now reopens on Settings — where you just were — instead of Home. Say the word if you'd rather it go Home.

Next step: we push app-v11 live and re-test the deployed build with a fresh cache before it's considered shipped.
