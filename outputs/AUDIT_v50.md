# AUDIT — ChemoWell app-v50 (APP BETA)

Auditor: Zero Day Auditor (independent, run retroactively — this mandatory gate was skipped when
app-v50 shipped; running it now per TEAM.md's "every release, no exceptions" rule). Date: 2026-08-08.

Scope: line-by-line audit of the three commits that make up this release —
`12430b3` (reminder reliability: battery-optimization exemption + auto early-scheduling buffer,
`index.html`/`sw.js`/`package.json`/`package-lock.json`), `e41f27b` (CI manifest-permission step,
corrupted by a browser-automation `${d}`→template-literal bug), `4e0564e` (clean fix of that
corruption) — plus real end-to-end testing on the live deployed site,
`https://arnjnnngs.github.io/chemowell-app-beta/`. CI run #53 (this exact commit) was already
confirmed green by the requester (build + emulator-smoke, 5m24s, no new warnings); not re-verified
here.

**Test-case depth:** this release touches reminder/notification scheduling (`applyExactAlarmLeadBuffer`
feeds directly into what time an alarm is actually armed at) — safety-adjacent per TEAM.md's scaling
rule, so this got the deeper pass: full diff read of all three commits, unit-style verification of the
padding function's three exact-alarm states plus its floor guard via the live page's exposed
`window.__notifTest` hook, and a full first-run walkthrough on the live site.

## VERDICT: **PASS** for the app-v50 diff itself (0 Critical/Major/Minor in the shipped code).
One **Should-fix** finding, but it is a pre-existing (since app-v47) live production defect this
audit's live-testing pass surfaced — not something introduced by any of the three app-v50 commits.
See F1 below; do not let it block sign-off on app-v50's own diff, but it needs its own follow-up.

---

## Code audit — `12430b3` (index.html / sw.js / package.json / package-lock.json)

- `APP_VERSION` bumped to `app-v50`; `sw.js` `CACHE` bumped to `chemowell-app-v50-1`. `release_check.sh`
  passes clean against the working tree.
- **`applyExactAlarmLeadBuffer` double-pad question (explicitly asked for):** traced every call site —
  there is exactly one, in `syncNativeReminders()` (index.html:6963):
  `applyExactAlarmLeadBuffer(buildReminderPlan(nowTs, state.meds, state.entries, state.appts,
  ACTIVE_PROFILE_ID), nowTs)`. `buildReminderPlan` always recomputes `at` times from the raw
  source-of-truth (med windows / appointment trigger times), never from a previously-padded plan, so
  each sync re-pads from the true unpadded time — **no cumulative double-padding across re-syncs in
  practice.** Confirmed live via `window.__notifTest.applyExactAlarmLeadBuffer`: feeding the function's
  *own already-padded output* back into itself a second time **does** pad again by another 4 minutes
  (`doubleApplyDelta: -240000`) — i.e. the function itself has **no internal guard** against
  double-application; the only thing preventing it today is that the single call site always passes a
  fresh, never-padded plan. This is safe as shipped but fragile-by-convention rather than
  fragile-by-construction: a future refactor that accidentally re-feeds `notifPlanApplied` (the
  already-armed/padded set) instead of a fresh `buildReminderPlan()` output would silently double-pad
  with nothing to catch it. Nice-to-have, not a defect: a one-line assertion or a `_padded` flag on the
  object would make this true by construction instead of by discipline.
- **Floor guard verified live:** `floor = nowTs + NOTIF_MIN_LEAD_MS` (30s). Fed a reminder due in 1
  minute (which a naive 4-minute pad would push 3 minutes into the past): result clamps to exactly
  `now + 30000ms`, never earlier, never past `now`. Confirmed for `granted` (no padding applied at all,
  bit-identical `at` values), `denied`, and `unknown` (both non-`granted` states pad — correct, matches
  the comment's intent of "never confirmed granted").
- **Battery-optimization UI hide-on-success (explicitly asked for):** `requestBatteryOptExemption()`
  (index.html:6699) awaits the plugin call, then explicitly `await refreshBatteryOptStatus()` before
  toasting — not fire-and-forget — so the re-render reflects the *real* OS-reported state, not an
  assumed one, exactly mirroring the existing `changeExactNotificationSetting()` pattern it's modeled
  on. `refreshBatteryOptStatus()` ends with `setState({})`, and `requestBatteryOptExemption()`'s own
  `finally` block calls `setState({})` again — both paths repaint. `batteryOptBlock()`
  (index.html:5399) gates strictly on `batteryOptState === 'enabled'`, so once the state flips to
  `'disabled'` (exemption granted) or `'unsupported'`, the block returns `[]` and disappears from all
  three notification-card branches it's spread into (`on-exact`, `empty`, `on`). Correct.
- **`batteryPlugin()` null-safety (explicitly asked for):** `batteryPlugin()` itself is wrapped in
  try/catch and returns `null` on any access failure (same pattern as the pre-existing `lnPlugin()` /
  `fsPlugin()` / `sharePlugin()`). Every caller checks for null/missing methods before touching it:
  `refreshBatteryOptStatus()` — `if (!bp || !bp.isBatteryOptimizationEnabled) { ...'unsupported'... }`;
  `requestBatteryOptExemption()` — `if (bp && bp.requestIgnoreBatteryOptimization) {...} else {...toast
  fallback...}`, and the whole body is additionally wrapped in try/catch with a toast in the `catch`.
  No path throws past these guards. Found no way to make this crash from a null/missing plugin (web
  build, or a native build where `cap sync` failed to install the plugin).
- `helpIcon()` / `renderInfoModal()` are pre-existing (first shipped for the Schedule-windows field);
  the two new call sites (index.html:5411, 5422) reuse them unchanged. `renderInfoModal`'s body div uses
  `whiteSpace: 'pre-line'` (index.html:2679), so the new strings' embedded `\n\n` render as real line
  breaks, not literal backslash-n — confirmed this is the existing, already-correct mechanism.
- Copy check: both new help-icon bodies use the file's established curly typography (’ U+2019, — em
  dash) consistently. One inconsistency worth a look, not a blocker: index.html:5422 quotes the actual
  Android Settings label as straight double quotes — `"Alarms & reminders"` — where the file's own
  existing convention for naming a literal on-screen UI element uses curly quotes (e.g. index.html:6147,
  `Use the "+" button` uses “+” not "+"). Straight quotes are the convention for *illustrative example
  values* elsewhere (e.g. index.html:4674, `"500 mg, 1000 mg"`), so this reads slightly off-pattern for
  a real Settings-menu label reference. Nit — Auditor-level copy-clarity check, not a functional issue.
- New dependency `@capawesome-team/capacitor-android-battery-optimization@8.0.1` added to
  package.json/package-lock.json only; no changes to any already-pinned dependency version.
- `window.__notifTest` debug hook addition (index.html:6899) follows the same reasoning/pattern as the
  pre-existing `window.__syncTest` hook (module-scope functions otherwise unreachable by an external
  harness) — used live for this audit's verification above.

## Code audit — `e41f27b` then `4e0564e` (`.github/workflows/android-build.yml`)

- `e41f27b`'s new manifest-injection step (`grep -q REQUEST_IGNORE_BATTERY_OPTIMIZATIONS ... || sed -i
  's#<application#<uses-permission .../> \n <application#' "$MANIFEST"`) is itself correct: idempotent
  guard (harmless given `android/` is regenerated every run and never actually pre-contains the
  permission, but doesn't hurt), inserts a `<uses-permission>` as a sibling before `<application>` —
  valid manifest placement, `sed` with no `g` flag only touches the (single) `<application` line.
- The same commit's icon-copy loop was corrupted: every `${d}` in the pre-existing `for d in mdpi
  hdpi ...` loop got replaced with the literal JS class body of a browser-automation tool's own runtime
  (`class d extends c{batchLoaders=u;...}`) — confirmed this is a straight, mechanical string
  substitution artifact (the tool that produced the commit evaluated `${d}` as a JS template
  interpolation instead of leaving it as literal bash), not a logic change; nothing else in the step was
  touched.
- `4e0564e` reverts exactly those corrupted lines back to `${d}` and nothing else (`git show 4e0564e`
  is a clean 5-line/5-line diff, byte-identical to the pre-corruption `${d}` form). No other drift.
- Given CI run #53 (built from this exact `4e0564e` commit) already passed both jobs per the task
  brief, this is consistent with the diff being a correct, complete fix — not re-verified independently
  here per instructions.

## Live testing — `https://arnjnnngs.github.io/chemowell-app-beta/`

**Methodology note (deviation from the standard Playwright-first-party-run instruction):** direct
HTTPS from this sandbox to `arnjnnngs.github.io` and to `cdn.jsdelivr.net` is blocked by the
organization's egress policy (`curl`/Playwright-launched Chromium both get a `403` on the CONNECT
tunnel; confirmed via `/root/.ccr/__agentproxy/status`, `kind: connect_rejected`). Per the proxy
runbook, this is a policy denial to report, not to route around — so live testing was done instead
through the user's actual connected Chrome browser (`claude-in-chrome`), which reaches the real
internet on a different network path and is the same live site a real user would load. All findings
below are from that real, live page — same URL, same jsdelivr-hosted dependencies a real user's browser
fetches.

**Viewport note:** `resize_window` against the connected browser did not reliably produce a true
390px-wide mobile viewport in this remote session (repeated resize calls reported success but
`window.innerWidth` stayed at 971–1600px); this is an environment/tooling limitation, not something
about the app. The app-v50 diff contains **zero CSS/layout changes** — every addition is new text/
button content inserted into pre-existing, unmodified container components (`card()`, `btn()`,
`muted`, `helpIcon()`) that already render correctly at mobile widths (verified across app-v40 through
app-v49's own audits). True mobile-viewport confirmation of this specific release is therefore listed
under Not Verified rather than claimed.

### Journeys (desktop-viewport, live site, fresh profile)
1. **Fresh install → welcome screen**: cleared `localStorage`, reloaded — 3-question setup (name, sex,
   treatment type) rendered correctly. PASS.
2. **Full setup flow**: name "Audit Tester", Male, Chemo, Get started → reached Home with the
   onboarding-tour card ("Step 1 of 10") over a populated Home shell (Temperature/Weight/BP/Treatment
   schedule cards, "No medications yet" state). PASS.
3. **Version footer**: drawer footer reads exactly `ChemoWell app-v50`. PASS — matches `APP_VERSION`.
4. **Settings → Notifications card**: web build shows the pre-existing, untouched `'on'`/"✓
   Notifications are on" state with its "can't reach you while your phone is locked" caveat text —
   this is `notifPermissionStatusBlock()`, confirmed unchanged by the v50 diff. PASS, no regression.
5. **Battery-optimization block correctly absent on web**: neither "Allow background activity" nor
   "battery saving may also delay delivery" text appears anywhere in Settings — correct, since
   `isNativeApp()` is false in a browser tab and `batteryOptState` never leaves its `'unknown'` default,
   so `batteryOptBlock()` always returns `[]` here. PASS.
6. **Navigation regression sweep**: Home → Meds → Reports → In-Patient → Symptoms → Home, all rendered
   their expected content (Reports screen showed History/Weight/Blood Pressure/Bowel
   Movement/Appetite cards correctly). PASS, no regression from this release's diff.
7. **Reload persistence**: full page reload after setup kept the profile ("Audit Tester", Active) and
   the last-open view (Settings stayed on Settings after a reload taken mid-session). PASS.
8. **`sw.js` live cache-version check**: fetched the live `sw.js` with `cache:'reload'` — first line is
   `const CACHE = 'chemowell-app-v50-1';`. Matches `APP_VERSION`. PASS — `release_check.sh`'s
   invariant holds in production, not just in the repo.
9. **`applyExactAlarmLeadBuffer` unit checks against the live page** (via `window.__notifTest`, see Code
   audit above for detail): granted/denied/unknown states and the floor guard all behaved exactly as
   the source predicts. PASS.

## Findings

### F1 — Should-fix (not a v50 regression; pre-existing since app-v47, found live during this audit)
**The `@capacitor/filesystem@8.1.2` CDN bundle throws on every single page load of the live site, and
its plugin never registers — silently regressing the app-v47 native share-sheet export fix back to the
original bug it was built to close.**

**Location:** `index.html:25` (`<script src="https://cdn.jsdelivr.net/npm/@capacitor/filesystem@8.1.2/
dist/plugin.js">`) — unchanged by app-v50 (pinned at this same version since app-v47; the app-v50 diff
only *added* `@capawesome-team/capacitor-android-battery-optimization`, it did not touch this line or
this dependency's version).

**Defect:** fetched the real, live `dist/plugin.js` jsdelivr serves for this exact pinned version. Its
final line is `})({}, capacitorExports, synapse);` — a UMD IIFE invocation that passes a global named
`synapse` as its third argument, but no script on the page (not Capacitor's own `capacitor.js`, not
ChemoWell's own code) ever defines `window.synapse`. This throws `Uncaught ReferenceError: synapse is
not defined` at evaluation of that line — before the wrapped function body ever runs — so
`Filesystem` never gets added to `window.Capacitor.Plugins`. Confirmed live:
`window.Capacitor.Plugins` on the deployed site currently contains `WebView, CapacitorCookies,
CapacitorHttp, SystemBars, LocalNotifications, Share` — **no `Filesystem`**. The sibling CDN scripts
(`core@8.4.2`, `local-notifications@8.2.1`, `share@8.0.1`) were checked and do **not** contain this
"synapse" pattern — this is isolated to the `filesystem@8.1.2` bundle specifically, a genuine upstream
packaging defect in that one published version, not an artifact of this test session (fetched directly
by the user's real connected browser from the real jsdelivr CDN, not through the sandbox's blocked
proxy).

**Reproduction:** load `https://arnjnnngs.github.io/chemowell-app-beta/` in any browser and check the
console — the `ReferenceError` fires on every load (reproduced 6/6 times across setup, reload, and
navigation in this session). `window.Capacitor.Plugins.Filesystem` is `undefined`.

**Failure scenario:** since the exact same `index.html` and CDN script tags are what the native Android
APK's WebView loads (this is the actual mechanism by which the app ships — there's no separate native
bundle), this almost certainly reproduces identically inside the shipped native app. The code is
already null-safe for this (`nativeShareFile()`, index.html:6744, checks `if (!fs || !share) return
false; // older build without these plugins synced in -- fall back to web path`), so it won't crash —
but it means the CSV/PDF export "hand off to Android's real share sheet" feature shipped in app-v47
(the fix for Aaron's "export says check downloads but I don't see anything in my notifications bar"
report) is very plausibly **silently back to the exact pre-v47 behavior** on live/current installs,
with zero visible error to the user or in this audit's own automated checks (it fails closed, not
loud).

**Not a v50-diff issue** — flagging because it's a real, currently-live defect this audit's mandated
live-testing pass turned up, and it violates the "zero console errors" bar the live-testing instructions
set, but the root cause and fix belong to a separate follow-up (pin a different `@capacitor/filesystem`
version, vendor the file locally instead of CDN, or confirm with jsdelivr/Capacitor whether 8.1.2 is a
known-bad publish), not to reopening app-v50's own commits. Recommend: (1) file this as its own
REQUESTS.md/tracked item, (2) if possible, get one real-device confirmation of whether the native
share-sheet export for CSV/PDF is currently silently falling back to the old behavior.

### Info — verified-safe (checks that did *not* find a defect)
- I1 — `applyExactAlarmLeadBuffer` never double-pads in the app's real call graph (one call site,
  always fed a freshly-rebuilt unpadded plan) — see Code audit above.
- I2 — Battery-optimization block correctly appears/disappears based on live-refreshed OS state, never
  a stale assumption; `batteryPlugin()` null-safety has no throw path.
- I3 — Web build shows zero trace of any native-only v50 UI (battery block, exact-timing explainer) —
  confirmed the `isNativeApp()` gate holds for all of it.
- I4 — `release_check.sh` passes; live `sw.js` matches the repo's `CACHE` constant; version footer
  matches `APP_VERSION` on the actual deployed site, not just in source.

## Not verified
- True native-only behavior: real `BatteryOptimization` plugin calls, real Android battery-optimization
  OS dialog/state, real exact-alarm OS behavior — none of this executes on the web build
  (`isNativeApp()` gates it off); depends on the CI build + emulator smoke test (already reported green
  for run #53) and, beyond that, a real device.
- A true ≤400px mobile viewport against the live site in this session (tooling limitation — see
  Viewport note above), though the diff contains no CSS/layout changes to re-verify at that width.
- Whether F1's native-share-sheet regression is actually observable on a real installed APK (reasoned
  from the shared-`index.html` architecture and the null-safe fallback code path, not device-confirmed).
