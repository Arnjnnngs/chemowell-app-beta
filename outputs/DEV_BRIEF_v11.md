# DEV_BRIEF_v11 — Plans-sheet flicker + pull-to-refresh tab loss

Role: Developer (Quality Chain stage 1) · Date: 2026-07-24 · Target: APP-BETA (`chemowell-app-beta`)
Scope: two Owner-reported phone bugs. **No code was modified for this brief.** All line numbers refer to `index.html` at app-v10 (3707 lines).

---

## 0. Architecture facts both bugs hang on

**The render model.** `render()` (lines 1702–1737) rebuilds the ENTIRE app DOM from scratch every pass:

```js
// 1734–1736
root.innerHTML = '';
root.appendChild(page);
positionTour();
```

Every child — header, main, toast, `renderTimeModal()` (1719), `renderUpgradeModal()` (1720), bottom nav — is a brand-new element each pass. Any element-local state (CSS animation progress, `scrollTop` of an inner scroller, focus) dies with the old element.

**The tick loop** (lines 3676–3682):

```js
setInterval(() => {
  state.now = simNow();
  const activeTag = document.activeElement && document.activeElement.tagName;
  const isEditing = activeTag === 'INPUT' || activeTag === 'SELECT' || activeTag === 'TEXTAREA';
  if (!state.timeModal && !isEditing) render();
  checkNotifications();
}, 1000);
```

Note the two existing exemptions: an open **time modal** and a **focused form field** already suppress the 1-second rebuild. The upgrade sheet has no such exemption. This is the codified precedent for the Bug 1 fix. (`checkNotifications()` runs every tick regardless — it must keep doing so.)

**`setState` always renders** (345–353): every interaction (`setState(...)`) triggers a full rebuild too, independent of the tick loop. It also flushes `pendingEntries` when the time modal closes (348–351) — companion machinery to the time-modal exemption (entry updates are deferred while the modal is open, 3666–3671).

**State/boot.** `state` is a plain module-level object, initialized at line 339 with `view: 'home'` (plus `upgradeOpen: false`, `timeModal: null`, etc.). Nothing about UI state is persisted except tour progress (`tourStep`/`tourDone` in prefs — 1638–1640, restored at 3683). Boot sequence: prefs subscription (3657), entries subscription (3664), tick interval (3676), tour restore (3683), first `render()` (3684), SW registration (3687).

**Storage split.** localStorage = health data + config (profile-scoped `chemowell-app-p-<id>-entries/prefs/med-v1`, device-wide `chemowell-app-profiles-v1`, `chemowell-app-license-v1`). Nothing uses `sessionStorage` today (grep: zero hits). `CONFIG` + `state` = memory only.

---

## 1. BUG 1 — Plans bottom sheet flickers

### 1.1 Root cause (confirmed)

`renderUpgradeModal()` (1562–1620) is called from `render()` at line 1720 and returns the sheet whenever `state.upgradeOpen` is true (guard at 1563). The sheet element (line 1603):

```js
h('div', { role: 'dialog', ..., style: { width: '100%', maxWidth: '720px', maxHeight: '88vh',
  overflowY: 'auto', ..., animation: 'sheetUp .32s cubic-bezier(0.32,0.72,0,1)' } },
```

with the keyframes at line 25:

```css
@keyframes sheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
```

Because the tick loop has **no `upgradeOpen` exemption**, the sheet element is destroyed and recreated every 1000 ms. A freshly created element restarts its CSS animation from `translateY(100%)`, so the 320 ms slide-up replays every second — the exact "keeps flickering and adjusting" the Owner saw.

**Scroll position is also lost.** The sheet is the app's tallest overlay (`maxHeight: 88vh`, `overflowY: 'auto'`; on a phone the Free+Plus+Pro cards + TEST_MODE reset button + beta footer overflow it). A recreated element has `scrollTop = 0`, so any scroll inside the sheet snaps back to top at the next tick — the "adjusting" component of the report. (Document-level scroll survives rebuilds because `<html>/<body>` are never recreated and the wipe+append happens synchronously in one frame; only *inner* scrollers lose position. The only two inner scrollers in the app are this sheet and the time-modal dialog at 1820 — and the time modal is already tick-exempt.)

**Tick suppression alone is not enough.** `setState`-driven renders replay the animation too. Concretely, while the sheet is open:
- "Simulate purchase (beta)" → `setToast(...)` + `setState({})` (1571)
- "Reset to Free (beta testing)" → same (1616)
- `setToast` itself renders **twice** — once to show the toast, once 4.5 s later to clear it (706–710)

So after a purchase the sheet would replay its entrance and jump to top twice more even with the tick fixed.

**Confirmed: this is the ONLY entry animation in the app.** Grep for `animation`/`@keyframes`: line 25 (keyframes), line 26 (reduced-motion guard), line 1603 (the sheet) — that's all. The `transition:` usages (1376, 1442, 2228, 2249, 2270, 2756) don't replay on element recreation (transitions only fire on property *change*, and a fresh element renders directly in its final state), so no other UI has this flicker class of bug. No other fix sites needed.

### 1.2 Recommended approach (A): tick exemption + animate-once flag + sheet scrollTop preservation

Three small, independent pieces, all mirroring existing patterns:

1. **Extend the tick guard** (line 3680):
   `if (!state.timeModal && !state.upgradeOpen && !isEditing) render();`
   This is exactly the time-modal precedent one token over. Side effects: while the sheet is open, the header date/dose-ring and missed-dose banners freeze for the duration — acceptable, the sheet is a full-screen modal covering them, and the header shows no clock (removed per Aaron in v10). `state.now` still updates (3677) and `checkNotifications()` still runs each tick, so notification timing is unaffected. First tick after close re-renders everything fresh.

2. **Play `sheetUp` only on the open transition.** Module-level flag next to the function, e.g.:
   ```js
   let upgradeSheetAnimated = false;
   function renderUpgradeModal() {
     if (!state.upgradeOpen) { upgradeSheetAnimated = false; return null; }
     ...
     // in the style object at 1603:
     animation: upgradeSheetAnimated ? 'none' : 'sheetUp .32s cubic-bezier(0.32,0.72,0,1)',
     // after building (or immediately before return): upgradeSheetAnimated = true;
   ```
   The reset lives in the `!state.upgradeOpen` early return, which is guaranteed to run on the first render after close (render is unconditional in `setState`), so reopening always animates once. This keeps the premium entrance on every open while making purchase-toast re-renders animation-free. The `prefers-reduced-motion` guard (line 26) is untouched.

3. **Preserve the sheet's `scrollTop` across interaction re-renders.** Give the sheet div an `id` (e.g. `id: 'plans-sheet'`), and in `render()` before `root.innerHTML = ''`: read `document.getElementById('plans-sheet')?.scrollTop` into a local; after `root.appendChild(page)`, re-query by id and restore. Must **re-query, never cache the element** (stale-ref landmine, §4). Without this, buying Pro while scrolled to the bottom snaps the sheet to top when the toast appears and again when it clears. ~4 lines, generic enough that a future second sheet could reuse it.

Pieces 1+2 are the fix; piece 3 is strongly recommended polish for the purchase flow (Designer will otherwise flag the toast-driven scroll jump).

### 1.3 Alternatives considered

- **(B) Animation-once only, no tick exemption.** Smallest diff (piece 2 alone). Rejected as insufficient: the 1 Hz rebuild still resets sheet `scrollTop` every second — the Owner's "adjusting" symptom remains whenever the sheet is scrolled. Also keeps burning a full DOM rebuild every second behind a modal for nothing.
- **(C) DOM reuse / keying: detect the existing sheet node in `render()` and re-append the live element instead of recreating it.** Fixes animation + scroll + future-proofs, but introduces a second reconciliation model into a renderer whose whole contract is "rebuild everything"; event handlers and license-state changes (`✓ Current plan` after purchase) would go stale unless partially re-rendered. Highest blast radius, fights the architecture. Rejected.
- **(D) Pause the whole interval while a modal is open.** Would silence `checkNotifications()` — med reminders (8 PM/8:30 AM/10 AM windows, gap expiries at 3455–3650) could be missed while someone reads the Plans sheet. Rejected outright.

---

## 2. BUG 2 — Pull-to-refresh loses the current tab

### 2.1 Facts

- `state.view` starts as `'home'` (line 339) on every boot; nothing restores it. Dispatch in `renderContent` (1510–1517) recognizes exactly six views: `home` (default fallback), `meds`, `settings`, `reports`, `inpatient`, `symptoms`. Bottom nav (1428–1450) covers five; `settings` is reached via the header gear (1399, `navigateTo('settings')`).
- `state.view` is mutated in exactly two places: `navigateTo(view)` (1306–1311) and `openReport(report)` (1313–1316, always sets `view: 'reports'` + a `reportsView` sub-view). Nothing else writes it.
- Today `<html>/<body>` have **no** overscroll/overflow CSS at all — just `html,body{height:100%}` (line 15) and `#root{min-height:100vh}` (24). The document/body is the main scroller, so the browser's pull-to-refresh gesture is fully live on every tab. `viewport-fit=cover`, `apple-mobile-web-app-capable=yes` (7), manifest `display: "standalone"`.
- A pull-to-refresh is just a page reload, and every reload boots to Home. Same is true for the app's own five `location.reload()` sites: `createProfile` (82), `switchProfile` (99), the stale-tab profile-switch guard (153), `eraseAllAppData` (203), and the SW `controllerchange` auto-reload (3702).

### 2.2 Recommendation: do BOTH (a) and (b) — and (a) is REQUIRED, not optional

**(a) Persist the active tab in `sessionStorage`.**

- Key: something like `'chemowell-app-ui-view'`. `sessionStorage` is the right home: ephemeral UI state, not health data (explicitly allowed by the task constraints), survives reloads in the same tab/PWA instance (pull-to-refresh, SW controllerchange reload, profile-switch reload), and evaporates when the app is fully closed — so a cold launch still opens on Home, which is the correct "app opens fresh" behavior. **Zero localStorage schema change**; `eraseAllAppData`'s prefix scan (197–201) and the profile key namespace are untouched.
- Write: one line in `navigateTo()` (1307-area) and one in `openReport()` (1314-area) — the only two `state.view` writers. (`openReport` writes `'reports'`, the view only — see scope below.)
- Read: at boot, replace the literal `view: 'home'` at line 339 with a validated read — whitelist `['home','meds','reports','inpatient','symptoms','settings']`, anything else → `'home'`. Whitelisting makes a stale/garbage value from an old build harmless.
- Factory reset: add `sessionStorage.removeItem(key)` inside `eraseAllAppData()` (before the `location.reload()` at 203). Without this, "Erase all data" → reload → welcome setup → finish setup would drop the user on e.g. Settings instead of Home, breaking the documented "exactly like a brand-new install" contract (comment at 191–193). This is the one flow where persistence must be actively cleared.
- Profile switch (`switchProfile`/`createProfile` reloads): deliberately do NOT clear the key. All six views are profile-agnostic, and both actions are initiated from Settings — reopening on Settings after the reload is the least-surprising outcome (the user sees the profile they just switched to, right where they did it). The stale-tab guard reload (153) likewise just restores the same view, which is correct. If the Owner prefers "profile switch lands on Home," it's a one-line clear in `switchProfile` — flag as an Owner taste decision, default to keeping the tab.

**Scope discipline — what (a) must NOT persist:** `reportsView` (the open report detail), `historyMissedOnly`, `upgradeOpen`, `timeModal`, `medEditor` drafts, `confirm*` flags, `addingProfile`, `testDateControlsOpen`, `chemoCalOpen`, toast — all deliberately reset on reload, exactly like every native app drops transient sheets on relaunch. Also NOT `state.dateOffsetDays`: the TEST_MODE simulated date already resets to real "today" on any reload (memory-only, 364–385). That is pre-existing, arguably a feature (a stuck simulated date in prefs would be dangerous), and out of scope — but note that pull-to-refresh currently silently resets Aaron's simulated date mid-testing; worth telling the Owner it will keep doing so by design. Tour progress already persists via prefs (1640/3683) — don't touch it.

**(b) Suppress the pull-to-refresh gesture with CSS.**

Add to the `<style>` block (line 15 area):

```css
html, body { overscroll-behavior-y: none; }
```

- On Chrome/Android (browser tab and installed PWA alike) this disables the pull-to-refresh action and the overscroll glow at the root scroller. It does **not** affect normal scrolling.
- Scroll-chaining audit: the only inner scrollers in the whole app are the Plans sheet (1603) and the time-modal dialog (1820) — both full-screen modals where chaining scroll out to the background page is *undesirable* anyway, so blocking chaining at the root loses nothing legitimate and slightly improves modal feel. No carousels, no nested scroll regions elsewhere (grep `overflowY`: two hits total).
- Put it on both `html` and `body`: which element counts as the root scroller varies across engines/modes, and the double declaration is the established belt-and-braces form.

**iOS caveat — why (a) is mandatory.** Safari only gained `overscroll-behavior` in 16.0 (late 2022), and its handling of the *root* scroller (rubber-banding / Safari's own pull-to-refresh, added in iOS 15) was inconsistent for years afterward; Chrome-on-iOS additionally implements pull-to-refresh as a native UIKit control layered on WebKit that CSS does not reliably disable. As of 2026 it mostly works in current Safari, but "mostly, on current versions" is not a guarantee for a medical app. When the app is installed to the iOS home screen (this app sets `apple-mobile-web-app-capable` + standalone display) there is no pull-to-refresh gesture at all — but the Owner said he hits this "as a PWA/browser app," so the browser context is in play. **Conclusion: (b) is best-effort gesture suppression; (a) is the correctness guarantee that must ship regardless.** With both, Android users never trigger the reload and iOS users who do trigger it land back on the same tab.

### 2.3 Alternatives considered

- **Persist the tab in prefs (localStorage).** Rejected: pollutes per-profile *health-data* prefs with device UI state, violates the no-schema-change constraint for no benefit, and makes the app reopen on an arbitrary tab weeks later after a cold start.
- **JS gesture blocking:** `touchstart/touchmove` listeners with `preventDefault()` when `scrollY === 0` and the finger moves down (`{ passive: false }`). Works on more iOS versions than CSS, but non-passive touch listeners on the document hurt scroll performance, are notoriously easy to get wrong (breaking momentum scroll, text selection, the modal scrollers), and add a permanent event-handling tax to every scroll. Rejected — the persistence fallback makes this risk unnecessary.
- **History API / hash routing** (`#meds` etc. + `popstate`). Would also survive reload and add back-button semantics, but that's a navigation-model change (new interactions with the SW `start_url`, the tour, and every `location.reload()` site) — far beyond the blast radius this bug justifies.

---

## 3. Definition of done

### Bug 1 — must work
1. Open Settings → "View plans" (2952) or hit the profile limit (2951): sheet slides up ONCE (320 ms), then sits perfectly still for 60+ seconds. No 1 Hz shimmer, no reflow.
2. Scroll the sheet halfway down and wait 10 s: scroll position does not move.
3. Tap "Simulate purchase (beta)" on Plus, then Pro: toast appears AND disappears (4.5 s) with no sheet re-animation and (with piece 3) no scroll jump; "✓ Current plan" moves correctly.
4. "Reset to Free (beta testing)": same — no replay, license resets.
5. Close via ✕ and via scrim tap; reopen: the slide-up animation plays again exactly once. Repeat twice.
6. With OS "reduce motion" on: no animation at all, sheet still appears/dismisses correctly (line 26 guard intact).

### Bug 1 — must not regress
- Header date, dose ring, Quick Log lock countdowns ("Opens 4:32 PM") resume updating within 1 s of closing the sheet.
- Time modal behavior unchanged: opens, defers entry updates, flushes on close (pendingEntries path 348–351/3666–3671).
- Notifications still fire while the sheet is open (checkNotifications unchanged in the tick).
- Typing in any input still suppresses the tick render (isEditing guard intact).

### Bug 2 — must work
1. On each of Meds / Reports (menu) / In-Patient / Symptoms / Settings: pull-to-refresh (or manual browser reload) → the SAME tab is showing after reload. On Home → still Home.
2. On a report detail (e.g. History): reload lands on the Reports MENU (view persists, sub-view intentionally doesn't).
3. On Android Chrome (browser + installed PWA): pull-down at the top of the page no longer triggers a refresh at all; normal scrolling everywhere is unaffected; the Plans sheet and time modal still scroll internally.
4. Settings → Start over → "Yes, erase everything": app reloads to the welcome/setup screen, and after entering a name lands on HOME (not the pre-reset tab), tour offered — identical to a fresh install.
5. Switch profile / create profile: reload lands on Settings (the tab where the action happened), new profile's data showing.
6. Close the app/tab fully, relaunch: opens on Home (sessionStorage gone — expected).
7. SW-update auto-reload (3699–3703): tab preserved.
8. TEST_MODE: date-override controls still work after reload (offset resets to 0 as today — unchanged, pre-existing).

### Bug 2 — must not regress
- Fresh-install first run: welcome setup still appears (prefsLoaded/patientName gate at 1704), tour starts, tour progress still survives reload (3683).
- Bottom-nav active state matches the restored view (aria-current, dot, tint — 1439–1445).
- Two-tabs-open sync: the storage listener (149–154) still reloads a stale tab on profile switch, and that tab restores its view without writing into the old profile.
- No new localStorage keys (verify: DevTools → localStorage unchanged except existing keys); license survives erase (199).
- sw.js untouched except the mandatory CACHE bump; `TEST_MODE = true` untouched.

### Tester sweep list (both bugs)
Home, Meds (+ med editor), Reports menu, History detail, Weight/BP/Cycle/Bowel/Appetite reports, In-Patient, Symptoms, Settings (profiles/plans/erase), Plans sheet, time modal, first-run setup + tour (including a mid-tour pull-to-refresh), 360/390 px widths, zero console errors.

---

## 4. Landmines

1. **Stale element refs across rebuilds.** Any node captured before `root.innerHTML = ''` is dead after it. The scrollTop-preservation code must `getElementById` twice (before wipe, after append) inside the same `render()` call — never store the element. Existing precedent for careful handling: `window.__tourHighlighted` (1651–1656) and `positionTour()` re-querying every render (1677–1700).
2. **Animate-once flag reset path.** The `upgradeSheetAnimated` reset MUST live in the `!state.upgradeOpen` branch of `renderUpgradeModal` (or wherever every close path funnels through render). If it's reset only in the ✕ handler, closing via scrim tap (1602) would leak the flag and the next open wouldn't animate. Both close paths — ✕ (1608) and scrim — go through `setState({ upgradeOpen: false })` → render → the early return, so that's the safe single point.
3. **Do not "fix" the tick by pausing the interval.** `checkNotifications()` (3455) rides the same interval; suppress the `render()` call only, exactly as line 3680 already does for the time modal.
4. **h() attribute handling / select-value.** `h()` sets `value` as attribute then re-applies as property after children (1254, 1265–1267, 1277) because a `<select>` attribute alone never selects an option. Neither fix should touch `h()`; if the Lead Developer adds an `id` to the sheet, plain `el.setAttribute('id', ...)` path (1269) handles it fine.
5. **`location.reload()` × tab persistence.** Five reload sites (82, 99, 153, 203, 3702). Decision per site: preserve tab (99, 82, 153, 3702) vs clear tab (203, factory reset). Missing the 203 clear breaks the "brand-new install" contract; clearing anywhere else breaks profile-switch UX. sessionStorage (not localStorage) means the erase-flow's prefix scan never sees the key — the clear must be explicit.
6. **Whitelist the restored view.** An unknown value must fall back to `'home'`; `renderContent`'s default branch already renders Today for garbage views, but the bottom nav would show NO active tab — validate at read time, not render time.
7. **Setup-screen interplay.** `render()` short-circuits to `renderSetup()` when no patientName (1704). A restored view sits harmlessly in state during setup — but only if factory reset cleared it (landmine 5); otherwise post-setup lands on a stale tab.
8. **Mid-tour restore.** Tour steps advance on `tourEvent('view:x')` fired only from `navigateTo` (1310). Restoring `view` at boot fires no tourEvent, so a pull-to-refresh during e.g. step 1 ("Tap Meds") can resume with the user already ON Meds but the tour still waiting. Tapping the Meds nav item again advances it (navigateTo has no same-view early return). Pre-existing shape of issue, severity low — tester should walk it once; do NOT add tourEvent calls at boot.
9. **TEST_MODE.** Both fixes are TEST_MODE-agnostic; the Plans sheet's TEST_MODE buttons (1575, 1616) must keep their handlers verbatim (v10 README promise: "TEST_MODE handlers untouched"). The simulated-date reset-on-reload (§2.2) is expected behavior, not a regression.
10. **Release mechanics** (Lead Developer, not optional): bump `APP_VERSION` at 2910 (`app-v10` → `app-v11`), bump `sw.js` CACHE (`chemowell-app-v10` → `chemowell-app-v11`) — the fetch handler logic itself must not change — add the README version row, live smoke with cache-buster.

## 5. Open questions for the Owner
1. After switching/creating a profile, should the app reopen on Settings (recommended, where the action happened) or always on Home?
2. On iOS in-browser (not installed), CSS pull-to-refresh suppression is best-effort; the guaranteed behavior is "refresh happens but the tab is kept." Acceptable, or should we also install the app to his home screen (standalone mode has no pull-to-refresh at all on either platform)?
3. Pull-to-refresh today also resets the TEST_MODE simulated date to real today (memory-only by design). Leave as-is? (Recommended: yes.)
