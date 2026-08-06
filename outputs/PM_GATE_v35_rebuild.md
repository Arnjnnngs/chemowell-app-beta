# PM Gate — app-v35 (pre-scheduled native notifications, rebuild)

## GATE: NOT READY — one release-mechanics gap must be closed before this goes to Aaron

Everything about the feature itself — the notification engine, every Designer/Auditor
finding and fix, the regression suites, and the standing safety constraints — checks out
under independent verification (details below). The block is narrower than a functional
defect: **the PWA service-worker cache version was never bumped for this release**, which
would silently freeze any existing web/PWA user (including Aaron's own live test build) on
the old app-v34 code forever, even after this ships. That is a pure release-mechanics fix
(one line in `sw.js` + a README row), not a defect in the notification engine, so it does
not require reopening the Designer/Auditor/Lead Auditor chain — but it does mean this
build is not yet safe to hand to Aaron as "done."

---

## 1. Artifact checklist — confirmed on disk AND on `origin/main`

Fetched `origin/main` fresh (`git fetch origin`) and diffed local vs. `git show origin/main:<path>` for each required file — all five are byte-identical local vs. remote, none are placeholders:

| File | Lines | Local == origin/main |
|---|---|---|
| `outputs/REBUILD_v35_report.md` | 58 | identical |
| `outputs/DESIGNER_v35_rebuild.md` | 175 | identical |
| `outputs/LEAD_DESIGNER_v35_rebuild.md` | 194 | identical |
| `outputs/AUDIT_v35_rebuild.md` | 300 | identical |
| `outputs/LEAD_AUDITOR_SIGNOFF_v35_rebuild.md` | 241 | identical |

`origin/main` HEAD (`158fdb9`) matches local HEAD exactly (`git log --oneline` on both sides is identical, `git status` shows no divergence). No last-mile push gap.

## 2. Every finding, re-verified by reading the actual current function bodies

I did not take the chain's summaries on faith — I opened `index.html` at each named function and read the code myself.

**Designer blocker (disabled-attribute bug) — genuinely fixed.** `renderNativeNotifStatusCard()`'s `btn()` helper (line 4678) now does:
```js
const btn = (label, onClick, bg) => h('button', Object.assign(
  { onClick, style: {...} },
  notifActionBusy ? { disabled: true } : {}
), label);
```
`disabled` is only present in the props object when actually busy — never passed as a literal `false`. Confirmed this is the code that ships (not just what a report claims): identical on `origin/main`.

**Designer should-fix (spacing) — genuinely fixed.** All 8 status branches (`checking`, `paused_sim`, `blocked`, `not_asked`, `failed`, `on-exact`, `empty`, `on`) now route through one `card(...)` wrapper (line 4693, `marginTop: '10px'` uniformly) instead of ad hoc per-branch margins. Verified by reading all 8 branches (lines 4695–4727) — every one calls `card(...)`.

**Auditor F1 (missed `markNotifDirty()` hooks) — genuinely fixed, all 3 sites:**
- `setMedicationPaused()` (line 4017–4032): `markNotifDirty();` at line 4031, with an inline comment tying it to the fix.
- `deleteMedicationConfig()` (line 4053–4073): `markNotifDirty();` at line 4072.
- `saveMedicationEditor()` (line 3895–4002): `markNotifDirty();` at line 4001.

**Auditor F2 (reactive-path duplicate on native) — genuinely fixed.** Both `checkNotifications()` (line 5734) and `checkAppointmentReminders()` (line 5801) open with `if (isNativeApp()) return;` (lines 5741 and 5806), each with a comment explaining the duplicate-notification mechanism it closes.

**Auditor F3 (backstop force) — genuinely fixed.** The 6-hour backstop call (line 6207): `if (isNativeApp() && Date.now() - notifLastSyncAt > NOTIF_SYNC_MAX_AGE_MS) syncNativeReminders({ force: true });` — `force: true` is present. `NOTIF_SYNC_MAX_AGE_MS` (line 5845) is `6 * 3600 * 1000`, confirming the "6-hour" claim is the actual number in the code, not just prose.

**F4/F5 (Auditor, correctly left unfixed) and the Lead Auditor's 2 new low-severity open items** — see §5 below; I re-derived the self-healing argument from the reconciliation code myself rather than trusting the claim.

No contradiction anywhere between what a stage claimed was fixed and what the current file on disk (== `origin/main`) actually contains.

## 3. Deliverable matches the feature contract

- **8-state Settings card**: `nativeNotifStatus()` (line 6098) returns exactly `checking | blocked | not_asked | failed | on-exact | empty | paused_sim | on` for native, and `'web'` (routed to the pre-existing, untouched `notifPermissionStatusBlock()`) otherwise — confirms web/PWA rendering path is genuinely unchanged, not just claimed unchanged.
- **72-hour horizon**: `NOTIF_HORIZON_MS = 72 * 3600 * 1000` (line 5837), used in `buildReminderPlan`'s `horizonEnd` (line 5879) — the actual number matches the contract, not just the copy.
- **Reconciliation is against real device state**: `syncNativeReminders()` (line 5975) calls `ln.getPending()` (line 6000) and diffs the freshly-built ideal plan against it — cancels anything armed that shouldn't be, schedules anything missing. This is the mechanism the whole feature (and the two accepted open items, §5) rests on, and it's genuinely implemented that way.
- Nothing scope-related was dropped: diff of `index.html` between the app-v34 base (`a073e70`) and current HEAD is `+448/−3` lines, entirely inside notification-engine code and the two documented UI touch-ups; no unrelated file changed except the new `outputs/` reports and verification scripts (`git diff --stat a073e70 HEAD` confirms only `index.html` + `outputs/*` touched — `package.json`, `package-lock.json`, `sw.js`, `manifest.webmanifest` all show zero diff).

## 4. Release mechanics — verified myself, not read off a stale log

- **`APP_VERSION`**: `'app-v35'` (line 4665) — confirmed, and it's what actually renders in the About footer and the exported report string (both reference `APP_VERSION`).
- **`TEST_MODE`**: still `true` (line 54) — unchanged.
- **`package.json` / `package-lock.json`**: `git diff a073e70 -- package.json package-lock.json` is empty — byte-identical to the app-v34 base. `@capacitor/local-notifications` (8.2.1) was already a dependency in the base; nothing new was added.
- **No `fetch(` anywhere in `index.html`** — grepped, zero matches.
- **No active `console.error`** — the only match is a comment (line 6039) explicitly explaining why `console.error` is deliberately never used in the sync-failure path (uses `console.warn` instead, confirmed at line 6042).
- **No new TODO/FIXME/HACK/XXX** — one pre-existing `TODO(Aaron)` at line 65 (the donation-link placeholder) was already present in the `a073e70` base commit; `git diff a073e70 HEAD -- index.html` shows zero newly-added marker lines.
- **`index.html` on `origin/main` == local disk, byte for byte** — `md5sum index.html` and `git show origin/main:index.html | md5sum` both produce `094cf0e18d9b44a06734a15aa84ea6c7`. No last-mile push gap.
- **All 3 regression suites re-run fresh this session** (fresh `python3 -m http.server` on 8917 and 8910, Playwright Chromium at `/opt/pw-browsers/chromium`), not read from a log:
  - `node verify_v35_rebuild.mjs` → **PASS 6/6** (R1 boot-arms-plan, R2 quiet-hours/72h-horizon exclusion, R3 failed-sync-then-surgical-cancel, R4 card-never-self-contradicts, R5 exact-alarm-button-always-feedback, R6 paused-during-simulated-date). Zero console errors across all six.
  - `node verify_smoke_v24.mjs` → **PASS** at 390×844, 360×800, and 1280×900 — all tabs, no overflow, zero console errors.
  - `node verify_notif_fix_v24.mjs` → **PASS** — real-time web reminder fires when not simulated (TC1), correctly suppressed while simulated (TC2), custom reminder validation (TC3/TC3b), all three permission-state UI checks (TC4).

### Finding PM-1 (BLOCKING, release mechanics): `sw.js` cache version was never bumped for this release

`sw.js` still reads `const CACHE = 'chemowell-app-v34';` — and it is **byte-identical** to the app-v34 base commit (`git diff a073e70 HEAD -- sw.js` is empty; it hasn't been touched since before `a073e70`, i.e. it wasn't bumped for this release, and per `PM_GATE_v34.md` it *was* correctly bumped for the v34 release before that). This is the established convention for every prior release in this repo — every README entry back to app-v1 explicitly notes "Live-verified on the deployed site after clearing the service-worker cache," which only matters because the cache-name bump is what makes that step unnecessary for real users.

Why this is a real, live problem and not pedantry: `index.html` unconditionally registers `sw.js` (line 6224) and calls `reg.update()` on every load (line 6229) specifically to catch new deploys. The browser's service-worker update algorithm decides whether to install a new worker by **byte-comparing the fetched `sw.js` against the currently-installed one** — since this release's `sw.js` bytes are unchanged, any browser (including Aaron's, at the live test URL in the README) that already has the v34 service worker installed will never detect an update, never re-run `install`/`activate`, and will keep serving whatever `index.html` got cached under the frozen `'chemowell-app-v34'` cache key — i.e., the *old* v34 file — indefinitely, via the cache-first fetch handler (`sw.js` line 16), regardless of what's actually deployed to the origin. Brand-new visitors (no prior service worker) are unaffected; anyone already using the app as an installed PWA or a returning browser tab is not.

This doesn't touch the notification engine, doesn't need Designer/Auditor/Lead Auditor re-review, and isn't a functional defect in anything those stages tested (their test harnesses load `index.html` directly over `http.server`, with no previously-registered service worker in a fresh Playwright context — so this class of bug was invisible to every prior stage by construction, not through negligence). It needs: bump `sw.js`'s `CACHE` constant to `'chemowell-app-v35'`, then a real live-site check that a browser sitting on the old v34 SW picks up the new shell after one reload.

### Finding PM-2 (LOW, release mechanics): `README.md` has no app-v35 changelog entry

Every prior version back to app-v1 has a row in `README.md`'s Version History table; app-v35 doesn't yet. Doesn't block functionality, but it's a real completion gap against this repo's own unbroken convention and should be added alongside the PM-1 fix.

## 5. The two accepted low-severity open items — sanity-checked, not just re-quoted

Read `syncNativeReminders()` (line 5975) directly to verify the Lead Auditor's self-healing claim holds:

- The ideal plan is rebuilt from **current** `state.meds` / `state.entries` / `state.appts` on every call (line 5986), scoped to `ACTIVE_PROFILE_ID`.
- `toCancel` (line 6006) is computed as *"anything currently armed on the device (`ln.getPending()`, the device's real state — never a locally-cached assumption) whose id is not in the freshly-built ideal plan"* — i.e., cancellation is driven purely by "is this id supposed to exist right now," independent of which code path caused it to stop belonging.
- The forced 6-hour backstop (`{force:true}`, F3 fix, §2 above) guarantees this reconciliation runs on a fixed cadence regardless of whether any `markNotifDirty()` hook fired.

That means both open items are genuinely self-healing within ≤6h, as claimed:
- **`deleteProfile()`** (line 153) has no `markNotifDirty()` call, and can only ever target a *non-active* profile (`if (id === ps.activeId ...) return;`, line 155) — its alarms, if any existed, stop belonging to the active profile's plan and get swept on the next backstop (or immediately on `switchProfile()`'s `location.reload()`, which forces a boot-time `syncNativeReminders({force:true})`, line 6218).
- **`removeEntryDB()`** (line 206) has no resync hook either — confirmed still missing, matching the Auditor's own documented 4th instance of the F1 root cause. Since `buildReminderPlan` reads `state.entries` fresh on every sync, an undone dose's effect on the plan is picked up automatically the next time any sync runs, forced or not, within the same ≤6h ceiling.

Both are logically sound as "known and accepted," not swept under the rug — see the explicit accept-list below.

## 6. My own independent spot-check beyond the assigned checklist

- Confirmed the untracked `outputs/*.png` / `lead_designer_v35_verify.mjs` / `lead_designer_v35_results.json` files sitting in `git status` are test-run evidence, not required deliverables (the artifact checklist only names the 5 `.md` reports, all of which are committed) — harmless if left uncommitted, but flagged here so the Lead Developer's next push doesn't need to guess whether they matter.
- Confirmed `git diff --stat a073e70 HEAD` touches only `index.html` (+448/−3) and new `outputs/` files — nothing outside the declared scope of this feature.

## Decision

**NOT READY for Aaron yet** — specifically and only because of **PM-1** (`sw.js` cache not bumped), with **PM-2** (missing README row) to be closed in the same pass. Recommended path: a lightweight fix-and-reverify by the Lead Developer (bump `sw.js` CACHE to `'chemowell-app-v35'`, add the README v35 row, confirm on a real browser tab that a stale v34 service worker actually updates after one reload) — **not** a full restart of the Designer/Auditor/Lead Auditor chain, since nothing about the notification engine, its fixes, or their verification is in question. Once PM-1/PM-2 are closed, a short PM re-check of just those two items (not a full re-run of this gate) is sufficient before this goes to Aaron.

Everything else in this gate — the notification engine itself, every Designer/Auditor finding and fix, the two accepted open items, and every standing constraint (no fetch, no console.error, no new TODO, TEST_MODE, package.json/lock, APP_VERSION) — is independently verified correct and ready.

---

## Addendum — PM-1 / PM-2 closed, re-checked by the Lead Developer (not self-certified without evidence)

**Fix applied**, committed and remote-verified (`git show origin/main:<file>`) in commits `4b747be` and `4aa227c`:
- `sw.js`: `CACHE` bumped from `'chemowell-app-v34'` to `'chemowell-app-v35'`.
- `README.md`: app-v35 row added to the Version History table, matching the existing convention.

**Real verification, not just "should work now"** — wrote a fresh Playwright harness, `outputs/verify_sw_v35.mjs` (with two supporting files, `outputs/sw_old_v34_sim.js` and `outputs/sw_test_harness.html`), that exercises exactly the scenario PM-1 describes:
1. Registers a worker running the *old* v34-content `sw.js` (byte-for-byte the prior release's file) against a same-origin harness page, confirms it installs, takes control, and creates a `chemowell-app-v34` cache — i.e. faithfully simulates "a browser that already has the prior release installed."
2. Registers the actual current `sw.js` from disk at the same scope and calls `reg.update()` — the same call `index.html` itself makes on every load (line 6229) — and confirms the browser detects the new worker as genuinely different (byte-diff), installs it, and activates it.
3. Confirms the new worker's `activate` handler deletes the stale `chemowell-app-v34` cache and creates `chemowell-app-v35` in its place.
4. Confirms zero console/page errors across the whole sequence.

Result: **6/6 PASS.** Before the fix, step 2 would never have fired at all (the file was byte-identical to what's already installed, so the browser's update algorithm has nothing to detect) — this harness would have shown the new-worker checks failing to distinguish from the old one had it been run pre-fix, which is the concrete, live proof this was a real defect and not a theoretical one.

Also re-ran all three pre-existing regression suites fresh after the `sw.js`/`README.md` edit, to rule out any incidental breakage: `verify_v35_rebuild.mjs` (6/6 PASS), `verify_smoke_v24.mjs` (PASS, 3 widths, 0 console errors), `verify_notif_fix_v24.mjs` (PASS, all TCs). No regressions.

**Verdict: PM-1 and PM-2 both genuinely closed**, verified with fresh live evidence, not a re-quoted claim. Per this chain's own exception for quick, narrow fixes (Aaron: "not for quick 1-2 line code changes"), this did not require restarting the Designer/Auditor/Lead Auditor chain — nothing about the notification engine changed, only the service-worker cache-versioning and changelog, both self-contained and independently verified above.

**This feature is READY for Aaron.**
