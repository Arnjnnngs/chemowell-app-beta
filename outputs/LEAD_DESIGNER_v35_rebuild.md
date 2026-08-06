# Lead Designer sign-off — v35 pre-scheduled native notifications, Settings status card

**Scope:** independently re-verify the Designer's `outputs/DESIGNER_v35_rebuild.md` review and the
Lead Developer's fix in commit `171e702` ("app-v35 fix: Designer blocker (disabled-attribute bug) +
card spacing"), against the current `index.html` on disk (identical byte-for-byte on both
`http://127.0.0.1:8917/index.html` and `http://127.0.0.1:8910/index.html`, confirmed via `diff`).

**Method:** did not take the Designer's report or the diff at face value. Read the current
`renderNativeNotifStatusCard()` (index.html lines 4668–4725) myself, then wrote a fresh, independent
Playwright harness (`/home/claude/chemowell-app-beta/lead_designer_v35_verify.mjs`) rather than
reusing the Designer's or Developer's scripts, using real `page.getByRole('button', {...}).click()`
pointer interactions (not `element.click()` via `page.evaluate`). Full run log and raw measurements:
`outputs/lead_designer_v35_results.json`. I also re-ran the repo's own
`BASE_PORT=8917 node verify_v35_rebuild.mjs` for a second, independent confirmation.

---

## 1. Blocker re-verification — CONFIRMED FIXED

**Claim being checked:** the Designer found all 4 action buttons (Try again ×2, Turn on
notifications, Allow exact reminders) were permanently disabled via `disabled: notifActionBusy`
being passed as a literal boolean into `h()`, which sets unknown props via `setAttribute` (presence-
based, so even `setAttribute('disabled', false)` disables the button).

**Fix applied:** `btn()` now builds its attrs via `Object.assign({ onClick, style }, notifActionBusy
? { disabled: true } : {})` — the `disabled` key is only present at all when actually busy, so
`setAttribute('disabled', ...)` is simply never called while idle.

**My independent test, for each of the 4 previously-broken buttons:**
1. Reached the exact state via a from-scratch Capacitor/localStorage stub (not copy-pasted from the
   Designer's or Developer's harness).
2. Asserted `locator.isEnabled()` is `true` **before** clicking.
3. Did a real `getByRole('button', {name}).click({timeout: 4000})` — a genuine synthetic pointer
   event that goes through Playwright's actionability checks (this is exactly the check that timed
   out for the Designer pre-fix).
4. Confirmed the click actually fired the real handler via an independent side-effect (not just "no
   error"):

| State | Button | Enabled before click | Real pointer click | Side-effect confirmed |
|---|---|---|---|---|
| `blocked` | Try again | true | succeeded, no timeout | `requestPermissions()` call count incremented 1→2, permission flipped to granted |
| `failed` | Try again | true | succeeded, no timeout | `schedule()` was re-attempted (attempt count 1→2) |
| `not_asked` | Turn on notifications | true | succeeded, no timeout | `requestPermissions()` call count incremented 1→2, permission flipped to granted |
| `on-exact` | Allow exact reminders | true | succeeded, no timeout | toast "Exact reminders are allowed." appeared |

All 4 pass. Also re-ran the repo's own `verify_v35_rebuild.mjs`: **6/6 PASS**, including **R5 now
passes** (this is the exact check the Designer found failing pre-fix, with the report's own quote:
*"the exact-alarm button never dead-ends... FAIL R5"* — that specific regression is gone).

I also grep'd the whole file for any other `disabled:` literal-boolean traps outside this card (the
same class of bug the file has a standing warning comment about at line 4395) — none found; this is
the only site using the pattern, and it's now fixed correctly there.

**Verdict: the blocker is genuinely fixed.** Any later stage can rely on this without re-deriving it:
buttons in all 4 previously-broken states are enabled by default and a real pointer click reliably
reaches their handler.

---

## 2. Spacing re-verification — CONFIRMED FIXED

**Claim being checked:** Designer found 0px gap in 4 states (`not_asked`, `empty`, `checking`,
`paused_sim`) vs 10px in the other 4, because only some of the per-state helpers (`errBlock`, `pill`)
happened to carry their own `marginTop`.

**Fix applied:** a single `card(...)` wrapper (`marginTop: '10px'`, flex column, `gap: '8px'`) now
wraps every one of the 8 state branches, so the gap is no longer dependent on which helper a
branch's first child came from.

**My independent measurement:** wrote my own `getBoundingClientRect()`-based measurement (not reused
from either prior script) of the gap between the "NOTIFICATIONS" section's intro sentence and the
card's first rendered child, across all 8 states (`blocked`, `failed`, `not_asked`, `on-exact`,
`empty`, `checking` [held in that state via a stub `checkPermissions()` delay], `paused_sim`, `on`).

Result: **every single state measures an identical 5px gap** (8/8, exact match to the pixel, not just
"close"). Raw data in `outputs/lead_designer_v35_results.json` under `gaps`. The previous split (0px
vs 10px) no longer exists in any of the 8 states.

**Verdict: spacing fix confirmed, no remaining inconsistency.**

---

## 3. Re-verification of the Designer's "checked and clean" claims

I did not re-read the Designer's report as evidence — I independently re-measured a sample:

- **Color contrast:** independently recomputed WCAG contrast (own relative-luminance/contrast-ratio
  implementation, not copied) for the amber `not_asked` headline text against white, reading the
  color live from the rendered DOM via `getComputedStyle`: `rgb(154,100,25)` → **4.99:1**, passes AA
  (≥4.5:1). Matches the Designer's number independently.
- **44px touch targets:** independently measured `boundingBox().height` for "Allow exact reminders"
  (one of the 4 previously-broken buttons, so also implicitly re-confirms it renders with real
  clickable geometry, not just a non-zero DOM presence): **44px exactly**. Passes.
- **No 320px overflow:** re-screenshotted and measured `scrollWidth` vs `clientWidth` of the
  Notifications section at 320px width, specifically for the 4 previously-broken states (the
  Designer's own 320px screenshots may predate the fix — this task called that out explicitly).
  `blocked`, `not_asked`, `on-exact`, `failed` all measure `scrollWidth === clientWidth` (286px),
  **no horizontal overflow** in any of them post-fix. Screenshots saved:
  `outputs/lead_designer_v35_{blocked,not_asked,on-exact,failed}_320_full.png`.
- **Copy tone:** re-read the `failed` state's body text live from the DOM (not from the report) —
  *"Something went wrong scheduling reminders. Your existing reminders are unaffected — this only
  blocks new ones from being armed until it's retried."* No stack trace, no exception string leaking
  through. Confirms the Designer's read.

---

## 4. Gap-check — one genuine new (minor) finding

### 4a. Busy/disabled visual state has no affordance, and in the common failure path is not even
### reachable long enough to matter — NICE-TO-HAVE, not a blocker

I specifically went looking for whether the fix introduced a *new*, subtler problem: the button is no
longer *permanently* disabled, but is it now correctly and *visibly* disabled during the real
`notifActionBusy` window?

Two things I found, neither of which reopens the blocker:

- **In the realistic case (retry from `blocked`, permission still gets denied), the busy window is
  effectively zero-width and never renders as disabled at all.** `syncNativeReminders()` short-
  circuits (`if (notifPermState !== 'granted') return;`) before it ever reaches any slow/native call,
  so the whole `retryNotifPermission()` promise chain resolves within the same burst of microtasks as
  the click — confirmed by polling the button's `disabled` property every 300ms for 2.4s after a real
  click from `blocked` with permission staying denied: it read `false` the entire time. This is
  harmless (the button was never going to get stuck), just means the busy-guard's UI half is inert in
  the most common retry-and-still-fail path.
- **When I did construct a scenario with a genuine async gap (granting permission mid-click, which
  transitions `not_asked` → `on-exact` and keeps a button on screen while `syncNativeReminders()` is
  artificially slowed), the disabled state DOES render** (`disabled: true` confirmed on the live DOM
  for a sustained window) — so the mechanism itself is not dead code, it's just rarely exercised.
  However, **when it is showing as disabled, it is visually indistinguishable from enabled**: `opacity:
  1`, identical background color, `cursor: pointer` — the same "invisible disabled" pattern the
  Designer's original blocker described, just now scoped to a legitimately-disabled (not permanently-
  broken) button instead of every button. Screenshot: `outputs/lead_designer_v35_busy_disabled_visual.png`.

This is **not a blocker** — the button is not stuck, a click always eventually lands, and the
`if (notifActionBusy) return;` guard at the top of both handlers protects against double-submission
at the JS level regardless of what's painted. But there's a real UX gap worth handing to the next
Designer pass: a caregiver who taps a button and, in the rare case where the busy window is wide
(slow device, slow network to the OS permission dialog), sees literally nothing change, may tap again
believing the first tap didn't register (harmless due to the guard, but confusing).

### 4b. `pill()` / `errBlock()` reuse risk — checked, none found

Both helpers are declared as `const` **inside** `renderNativeNotifStatusCard()`, not at module scope,
so they cannot be called from anywhere else in the file. Grepped the whole file for other
declarations/callers of functions/consts named `pill` or `errBlock` — none exist outside this
function. Removing their individual `marginTop` values in favor of the shared `card()` wrapper's flex
`gap` cannot have broken any other call site, because there is no other call site.

### 4c. No other `disabled:` literal-boolean traps in the file

Grepped the whole file for `disabled:` usage outside this card — the only other occurrence is the
pre-existing warning comment at line 4395 that documents the correct pattern; no other button in the
codebase repeats the bug this card had.

---

## Summary / explicit sign-off

- **Blocker (permanently-disabled action buttons):** ✅ **CONFIRMED FIXED.** Verified via real
  Playwright `getByRole(...).click()` pointer interactions (not `.click()` via `evaluate`) on all 4
  previously-broken buttons, each confirmed enabled beforehand and each confirmed to fire its real
  handler via an independent side-effect (permission-request call count, toast text, or a re-attempted
  `schedule()` call) — not merely "click didn't throw." Also independently re-ran the repo's own
  `verify_v35_rebuild.mjs`: 6/6 pass, including R5 (the specific check that failed pre-fix).
- **Spacing (0px vs 10px inconsistency):** ✅ **CONFIRMED FIXED.** Independently measured the gap in
  all 8 states via `getBoundingClientRect()`; all 8 now measure an identical 5px, matching the shared
  `card()` wrapper's intent.
- **Sampled re-verification of "checked, no issue" claims** (contrast, 44px targets, 320px overflow in
  the specific 4 previously-broken states, copy tone): all independently re-confirmed with fresh
  measurements/screenshots, not by re-reading the Designer's report.
- **New finding (nice-to-have, not a blocker):** the busy/disabled visual state, on the rare
  occasions it's wide enough to be observed, is visually identical to enabled (no dimming, no
  spinner) — and in the most common retry-and-fail path it's not observable at all because
  `syncNativeReminders()` short-circuits before ever reaching the slow part. Recommend a future pass
  add a visible busy affordance (opacity or spinner) if this is worth spending on, but it does not
  block release: no button is ever stuck, and the JS-level `notifActionBusy` guard prevents double-
  submission regardless of what's painted.
- **No new visual regressions found:** `pill()`/`errBlock()` are locally scoped to this card only, so
  removing their per-helper `marginTop` values in favor of `card()`'s flex `gap` cannot have affected
  any other part of the app.

**Nothing here rises to blocker or should-fix severity that would send this back to stage 1.** The
two issues the Designer flagged are both genuinely fixed and independently reproducible as fixed. The
one new observation (4a) is recorded as a nice-to-have for a future design pass, not a gate.

## What remains open (not verified by me, out of scope for this pass)
- I did not re-verify the Designer's "structural consistency with the rest of Settings" or the
  1280px-desktop-layout nice-to-have — those were unaffected by this fix (pure layout/copy items, not
  touched by commit `171e702`) and the Designer's method for them (full-page screenshot comparison)
  was sound.
- I did not test on a real native Android/iOS device or with a real OS permission dialog — all
  verification here is against the Capacitor plugin stub, consistent with every prior stage's method
  for this feature.
