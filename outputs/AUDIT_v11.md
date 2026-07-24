# AUDIT_v11 — Plans-sheet flicker fix + tab persistence

Role: Auditor (Quality Chain stage 5) · Date: 2026-07-24 · Target: APP-BETA (`chemowell-app-beta`) at app-v11
Scope: the v11 change set (tick guard, animate-once flag, sheet scroll preservation, sessionStorage view persistence, overscroll CSS, version/cache bump) — line-by-line code audit of the change + blast radius, and deep user testing on the running build (`http://localhost:8877`, Playwright/Chromium, 390×844 and 360×640). **No code was modified.**

Verification basics: `node --check` on the extracted module — clean. Zero console errors and zero page errors across every journey below.

---

## 1. Findings

### P0 — none.
### P1 — none.

### P2-1 — README.md has NO app-v11 version-history row (release mechanics violated)
- **Location:** `/home/claude/chemowell-app-beta/README.md` — version-history table starts at the `app-v10` row (line 14). `grep -c "app-v11" README.md` → 0.
- **What:** TEAM.md stage 2 mandates on every push: "bump `APP_VERSION`, bump the `sw.js` CACHE name, **add the README version-history row**." `APP_VERSION` (index.html:2939 = `'app-v11'`) and `sw.js` CACHE (`chemowell-app-v11`) were bumped; the README row was not written. The PM gate (stage 7) treats a missing release artifact as automatic FAIL, so this blocks the chain regardless.
- **Repro:** open README.md, look for an app-v11 row. There isn't one.
- **Severity rationale:** zero runtime impact, but it is a hard requirement of the release process and exactly the class of "quietly skipped step" the chain exists to catch.

### P3-1 — Purchase/reset toast is invisible while the plans sheet is open (z-index 50 under overlay z-index 70)
- **Location:** toast at index.html:1746 (`zIndex: '50'`); sheet overlay at index.html:1625 (`zIndex: '70'`).
- **What:** "Simulate purchase" / "Reset to Free" fire `setToast(...)`. The toast renders at `bottom: calc(96px + inset)` — squarely behind the opaque white sheet (and the scrim). It auto-clears after 4.5 s, so a user who stays in the sheet **never sees the confirmation toast at all**. Feedback still exists (the "✓ Current plan" badge moves instantly), so this is cosmetic, and it is **pre-existing from v10's** dialog→bottom-sheet conversion, not a v11 regression. v11's animate-once/scroll work made the toast lifecycle inside the sheet an explicit design concern, which is why it surfaces now.
- **Repro:** Settings → View plans → Simulate purchase (Plus). Observe: no toast anywhere on screen (evidence: `outputs/audit-v11-j3-after-buy-plus.png` — sheet open, Current plan moved to Plus, no toast). Close the sheet within 4.5 s of the tap and the toast is visible below (verified separately).
- **Suggested direction (for the next chain run, not applied):** either raise the toast above overlays for these two actions or skip the toast when `state.upgradeOpen` and rely on the in-sheet state change.

### P3-2 — Fast double-tap on "View plans" can insta-dismiss the sheet mid-animation (scrim catch; pre-existing)
- **Location:** scrim close handler index.html:1625 (`if (e.target === e.currentTarget) setState({ upgradeOpen: false })`) + 320 ms `sheetUp` animation (index.html:1626, keyframes line 25).
- **What:** during the slide-up, the sheet is still translated toward the bottom, so a second tap at the "View plans" button's position lands on the scrim (the overlay container itself) and closes the sheet — it flashes open and vanishes. The window is narrow: reproduced with a 35 ms gap between taps, NOT reproduced at 80 ms (by then the sheet already covers the tap point). Real double-taps are usually ≥100 ms apart, so exposure is small. Pre-existing since v10 introduced scrim-tap-close; v11's animate-once flag correctly resets on this close path (reopening animates again — verified).
- **Repro (automated):** two `page.mouse.click` on View plans 35 ms apart → sheet gone (`F4 REPRO` PASS); same with 80 ms gap → sheet stays open.
- **Suggested direction:** ignore scrim clicks for the first ~350 ms after open, or drop scrim-close during the entry animation.

### P3-3 — `eraseAllAppData` hardcodes `'chemowell-app-ui-view'` instead of using `UI_VIEW_KEY`
- **Location:** index.html:205 (literal) vs index.html:347 (`const UI_VIEW_KEY = 'chemowell-app-ui-view'`).
- **What:** duplicated string constant. Works today (values identical — verified live: after erase-all the key is gone and re-setup lands Home). Pure drift risk: if UI_VIEW_KEY is ever renamed, factory reset would silently stop clearing the persisted view and a post-erase re-setup could land on Settings again. `UI_VIEW_KEY` is in scope at call time (the function only runs on click, long after the const initializes), so it could simply be referenced.
- **Repro:** code inspection only; no user-visible behavior today.

### P3-4 — Mid-tour reload can restore a view that is "ahead of" the awaited tour step (cosmetic, recoverable)
- **Location:** view restore index.html:349-354 vs tour restore index.html:3728; `tourEvent('view:…')` only fires from `navigateTo` (index.html:1326), never on restore.
- **What:** tour progress persists in prefs; view now persists in sessionStorage. After a reload, the pair can be inconsistent — e.g. leftover `view=meds` with tourStep 1 ("Tap Meds at the bottom to continue") while the user is *already on* Meds. Verified live (F5): no crash, coach card renders, highlight points at the nav item, and tapping the already-active Meds tab still fires `view:meds` and advances the tour (navigateTo has no same-view guard — confirmed at index.html:1321). Worst case is one redundant instruction; the tour cannot deadlock. Also note the practical path into this state is narrow (fresh profiles created via `createProfile` are seeded `tourDone: true`; erase-all clears the view key; it takes a devtools-style localStorage-only wipe or a mid-tour reload to see it).
- **Repro:** `sessionStorage.setItem('chemowell-app-ui-view','meds')`, clear localStorage, reload, complete welcome as "Sam" → tour step 1 shows while Meds tab is active (`outputs/audit-v11-f5-tour-on-meds.png`); tap Meds nav → advances to step 3 of 10 (`outputs/audit-v11-f5-tour-step3.png`).

---

## 2. Code audit — attack surface examined, no defect found

Each item below was a hypothesized failure mode; all were checked line-by-line and (where testable) exercised live.

**2.1 Animate-once flag across ALL close paths.** The flag (`upgradeSheetAnimated`, index.html:1582) is reset only in `renderUpgradeModal`'s `!state.upgradeOpen` early return (1584). Enumerated every path out of the sheet:
- Scrim tap (1625) and ✕ (1631): both `setState({upgradeOpen:false})` → `setState` always calls `render()` (index.html:360-368) → `renderUpgradeModal` runs → flag resets. Verified live: reopen after each close animates (J2, 5× stress).
- Purchase / Reset-to-Free (1594, 1639): do NOT close the sheet — correct; flag stays true so those interaction renders don't replay the animation (verified J3/F6).
- Profile create/switch (index.html:82, 99), stale-tab guard (153), erase-all (206), SW controllerchange (3734): all `location.reload()` → module re-evaluates → flag re-initializes to `false`. No stale-flag path exists.

**2.2 renderSetup ordering hole.** `render()` early-returns to `renderSetup()` at index.html:1727 *before* `renderUpgradeModal` is reached, so if the sheet were open in a renderSetup state the flag would never reset. **The state is unreachable:** the sheet only opens from Settings (index.html:2980, 2981), which requires a set `patientName`; nothing in the app clears `patientName` in-session (erase-all and profile ops always reload, which reinitializes the flag anyway). Confirmed by grep of every `upgradeOpen: true` setter (exactly two, both in Settings) and every `patientName` write.

**2.3 Suspending the tick while the sheet is open.**
- *Toast auto-clear:* `setToast` (index.html:721-725) uses its own `setTimeout(() => setState({toast:null}), 4500)` — independent of the tick. Verified live: toast clears at 4.5 s with the sheet open AND closed (J3).
- *`checkNotifications`:* still runs every tick — it sits outside the guard (index.html:3712-3713). Additionally it is currently a no-op in this build (`if (TEST_MODE) return;` at 3555), so no reminder risk either way.
- *`state.now`:* still updated every tick (3706) even when render is skipped, so the first render after close is time-correct. Verified: background DOM frozen while sheet open, tick rebuilds resume within one tick of close (F3).
- *Missed-dose banners / header ring going stale:* frozen behind the full-screen sheet while it's open; refresh on the first tick/interaction after close. Acceptable and matches the pre-existing time-modal exemption precedent.
- *TEST_MODE date controls:* live on Home behind the sheet; they drive `setState`, which renders regardless of the tick guard. Verified working post-sheet (F2: header date Jul 24 → Jul 25 → Reset).
- *Interaction renders are NOT suppressed* — `setState` always renders. That is exactly why pieces 2 and 3 (animate-once + scroll restore) exist; verified they hold under interaction renders (J3, F6).

**2.4 Scroll restore when the sheet closes mid-render.** In `render()` (index.html:1760-1764): `prevSheet` is read from the OLD DOM before the wipe; after rebuild, restore only runs `if (sheetScroll > 0)` AND `if (freshSheet)` — when the sheet was just closed, `getElementById('plans-sheet')` returns null and the restore is a no-op. No error, verified across dozens of close renders (zero page errors). The `h()` tree is built in memory before the wipe, so `prevSheet` still resolves to the live old node — ordering is correct. Content-shrink after purchase clamps `scrollTop` gracefully (F6: 319 → clamped 265, no top-jump).

**2.5 View persistence vs. the stale-tab guard and reloads.** `sessionStorage` is per-tab, so the profile-switch storage-event reload (index.html:153) restores that tab's own view — no cross-tab bleed. All five `location.reload()` sites land on the persisted view (verified for profile create, profile switch, and plain reload; SW controllerchange is the same code path).

**2.6 sessionStorage in private/incognito iOS.** All three accesses are try/wrapped: `restoreView` (350-351), `persistView` (353), erase-all removal (205). Verified live with a `sessionStorage` accessor that throws on every call (J8): app boots, setup completes, navigation works, zero page errors.

**2.7 Whitelist completeness.** Every `state.view` writer audited: `navigateTo` call sites pass `'settings'` (1416), nav `item.key` ∈ {home, meds, reports, inpatient, symptoms} (1443-1452/1459), `'meds'` (2390), `'home'` (3018); `openReport` always persists `'reports'` (1331). All ∈ `VALID_VIEWS` (348). Garbage/injection value in the key falls back to Home (verified live). `reportsView` deliberately not persisted — reload from a report detail lands on the Reports INDEX with no crash and no stray Back pill (J4).

**2.8 Hard rules (APP_CLAUDE.md).** No cloud/network writes added — grep for `fetch(`/`XMLHttpRequest`/`firebase`/`firestore`/`analytics`: only the SW's cache-fallback `fetch(e.request)`. No `caretracker_*` references. `TEST_MODE = true` intact (index.html:36). `APP_VERSION 'app-v11'` (2939) matches `sw.js` CACHE `'chemowell-app-v11'`; old caches deleted on activate.

**2.9 Misc.** `overscroll-behavior-y: none` present on html,body (line 15; computed style verified = `none`). Only one entry animation exists in the app (keyframes line 25 + sheet), so the animate-once pattern has no missed siblings. Time modal's own tick exemption untouched and verified (F1).

---

## 3. User journeys run (evidence)

Server: `python3 -m http.server 8877`; Playwright Chromium; scripts `/tmp/audit_v11.mjs` (J1-J9) and `/tmp/audit_v11b.mjs` (F1-F6). **Zero console errors, zero page errors across all runs.** Screenshots in `outputs/audit-v11-*.png`.

| # | Journey | Result | Evidence |
|---|---|---|---|
| J1 | Fresh install → welcome → name "Jordan" → tour appears → Skip → lands Home | PASS | j1-welcome.png, j1-tour-step0.png |
| J2 | Plans sheet open/close 5× fast; double-tap close on ✕ each time; reopen still animates; scrim-tap closes | PASS ×12 | console log |
| J3 | Sheet open → marked DOM node + scrollTop 121 survive **10 s of background ticks** → buy Plus (sheet stays open, "✓ Current plan" moves, no animation replay, scroll clamped-preserved) → toast auto-clears at 4.5 s while sheet open (no replay, scroll kept) → Reset to Free reflects live → close | PASS | j3-sheet-open.png and j3-sheet-after-10s.png are **byte-identical (83,100 bytes)** — pixel-level proof of zero flicker; j3-after-buy-plus.png |
| J3b | Toast visible after closing sheet; auto-clears while closed | PASS | console log |
| J4 | Reload on every tab (Meds/Reports/In-Patient/Symptoms/Home via nav, Settings via gear) → each restores; reload from a **report sub-view** (History detail) → restores Reports **index**, no crash; garbage stored view → Home | PASS ×9 | j4-settings-restored.png, j4-reports-index-restored.png |
| J5/F1 | Scheduled med (Medrol, all-day window) quick-log end-to-end: tap → time modal opens → modal node survives 3 s of ticks → Confirm → "Medrol logged · 4 mg at 3:56 PM" toast, modal closed | PASS | j5-time-modal.png, j5-after-log.png, f1-time-modal.png |
| J6 | Erase-all from Settings → confirm → boots to welcome; sessionStorage view key removed; re-setup as "Riley" → lands **Home**, not Settings | PASS | j6-post-erase-home.png |
| J7 | Plus license → Settings → Add profile "Kim" (reload) → still Settings; switch back to Riley (reload) → still Settings | PASS | j7-profile-switch-settings.png |
| J8 | Throwing sessionStorage (incognito simulation): boots, setup + navigation work, zero errors | PASS | console log |
| F2 | TEST_MODE date controls: +1 day → header Fri Jul 24 → Sat Jul 25 → Reset | PASS | f2-date-offset.png |
| F3 | Background DOM frozen while sheet open; tick rebuilds resume ≤1 s after close | PASS | console log |
| F4 | Double-tap "View plans": 35 ms gap → insta-dismiss (finding P3-2); 80 ms gap → stays open; control tap after animation → stays open | repro'd | console log |
| F5 | Leftover view=meds + fresh install: welcome unaffected; tour starts on Meds view without crash; tapping active Meds tab still advances tour (step 3/10) | PASS | f5-tour-on-meds.png, f5-tour-step3.png |
| F6 | 360×640 (real overflow, max scroll 319): bottom scroll survives 3 s ticks; buy Pro at bottom → clamp to new max (265), no top-jump, no replay; toast-clear render keeps scroll | PASS | f6-360-bottom.png |

---

## 4. Verdict

**FIX FIRST.**

The v11 code itself held up under attack: the tick guard, animate-once flag, scroll preservation, and view persistence are correct across every close path, reload path, and failure mode I could construct — including 10 s background-tick soak (byte-identical screenshots), double-tap stress, purchase/downgrade cycles inside the open sheet, report sub-view reloads, factory reset, profile switches, and a throwing sessionStorage. No P0/P1 defects. Hard rules intact.

But the release is incomplete: **P2-1 (missing README app-v11 version-history row)** is a mandated release artifact under TEAM.md and an automatic FAIL at the PM gate. Per the restart rule, this goes back to the Developer (stage 1). The four P3s are candidates to bundle into that pass (P3-3 is a one-token change; P3-1/P3-2 are pre-existing and may be explicitly deferred with Owner visibility; P3-4 is informational).
