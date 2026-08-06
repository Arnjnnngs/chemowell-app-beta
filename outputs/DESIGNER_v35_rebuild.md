# Designer review — v35 pre-scheduled native notifications, Settings status card

**Reviewed:** `renderNativeNotifStatusCard()` (index.html ~line 4668-4713), wired into the
"Notifications" section of `renderSettings()` (~line 4786-4795).

**Method:** Drove the actual rendered app with Playwright (Chromium) against
`http://127.0.0.1:8917/index.html`, stubbing `window.Capacitor.Plugins.LocalNotifications` via
`page.addInitScript` and seeding localStorage, exactly per the pattern in
`verify_v35_rebuild.mjs`. Captured all 8 card states (`on`, `blocked`, `not_asked`, `on-exact`,
`failed`, `empty`, `checking`, `paused_sim`) at three widths (320 / 390 / 1280), both full-page and
cropped-to-section. Script used: `/home/claude/chemowell-app-beta/designer_v35_screens.mjs`.
Screenshots: `/home/claude/chemowell-app-beta/outputs/designer_v35_<state>_<width>_{full,card}.png`
(48 files total, all present and non-empty). I read every one of the 24 cropped-card screenshots and
the `_full` shots for the widest and narrowest widths before writing findings below — this is not a
code-only read.

I also re-ran the project's own `verify_v35_rebuild.mjs` harness (`BASE_PORT=8917 node
verify_v35_rebuild.mjs`) and independently confirmed one of its results with direct Playwright
locator interaction (real synthetic clicks, not `element.click()` DOM calls), since a rendering-only
review would have missed the top finding below entirely — it is visually invisible.

---

## Findings

### 1. BLOCKER — every primary action button in the card is permanently disabled and unclickable, in 4 of 8 states, with zero visual indication

**Where:** `blocked` (button "Try again"), `not_asked` (button "Turn on notifications"),
`on-exact` (button "Allow exact reminders"), `failed` (button "Try again"). All widths — this is a
markup/behavior bug, not a layout one, so it reproduces identically at 320/390/1280.
Screenshots: `designer_v35_blocked_390_card.png`, `designer_v35_not_asked_390_card.png`,
`designer_v35_on-exact_390_card.png`, `designer_v35_failed_390_card.png` (and the 320/1280
equivalents — button appearance is identical across widths).

**What's happening:** The shared `btn()` helper inside `renderNativeNotifStatusCard()` (line 4671-4674) is:

```js
const btn = (label, onClick, bg) => h('button', {
  onClick, disabled: notifActionBusy,
  style: { ... }
}, label);
```

The app's own `h()` function (line 1738-1765) sets any prop it doesn't special-case via
`el.setAttribute(k, v)`. HTML boolean attributes are presence-based, not value-based:
`setAttribute('disabled', false)` still renders a genuinely disabled button, because the string
`"false"` is still a non-empty attribute value and its mere presence disables the control. Since
`notifActionBusy` starts `false` and this is the literal value passed, **every button built by
`btn()` renders disabled from first paint**, for the entire time `notifActionBusy` is falsy (i.e.
essentially always, since it's only briefly `true` mid-click, and by then the click already can't
land).

**Verified, not inferred:**
- `button.disabled` DOM property reads `true` for all four buttons (checked via `getBoundingClientRect`/`isDisabled()` in a live page).
- A real Playwright `locator.click()` (synthetic pointer event, the same actionability path a real tap goes through) **times out after 3s** trying to click "Try again" in the `blocked` state — Playwright itself refuses because the element fails its "enabled" actionability check.
- Re-running the repo's own `verify_v35_rebuild.mjs` right now (`BASE_PORT=8917 node verify_v35_rebuild.mjs`) shows check **R5 currently FAILS**: `FAIL R5 — the exact-alarm button never dead-ends... method present: buttonFound=true toast=null ... method absent: buttonFound=true toast=null`. This is the exact check `outputs/REBUILD_v35_report.md` claims caught this class of bug and that "all six pass." That claim is **not currently true of the code in `index.html`** — either the fix was reverted, never applied to the shared `btn()` helper (only tested/fixed for one call site), or the report was written against a different build than what's on disk now.
- The file has its own explicit warning comment about this exact trap 277 lines earlier, at line 4395: *"never passed as `disabled: false`, or every arrow button would render permanently disabled"* — with the correct pattern right next to it (`...(isDisabled ? { disabled: true } : {})`). The new card's `btn()` helper does not follow that pattern.

**Why this is a blocker, not a nitpick:** These are the *only* four states where a caregiver is
being asked to take an action to fix their reminders (turn on notifications, allow exact alarms,
retry a failed sync). In all four, the button is 100% visually normal — full-saturation brand color,
white bold label, `cursor: pointer`, `opacity: 1` (I checked computed style directly; there is no
browser default disabled-affordance like a grey-out or reduced opacity happening either, because the
button's own inline styles override it). A caregiver whose dose reminders are silently not arriving
will tap "Turn on notifications," feel nothing happen, and have no way to know the button was never
going to work. This is worse than an ugly button — it's an invisible dead end on the one screen whose
entire purpose is "the thing you tap when reminders aren't working."

**Also note:** a genuinely-disabled button is also not keyboard-focusable and gets announced as
"dimmed"/disabled to screen readers even though it looks enabled — worth flagging to the
Auditor/accessibility pass too, since this compounds beyond a visual issue.

---

### 2. SHOULD-FIX — inconsistent spacing between the section's intro sentence and the card's first line: 0px in 4 states, 10px in the other 4

**Where:** `not_asked`, `empty`, `checking`, `paused_sim` states, all widths.
Screenshots: `designer_v35_not_asked_390_card.png` vs `designer_v35_blocked_390_card.png` (compare
directly — the amber headline in `not_asked` visibly crowds the paragraph above it in a way the red
headline in `blocked` does not).

**Measured (390px width, via `getBoundingClientRect`):**
- `blocked` (uses `errBlock()`, which wraps in `marginTop: '10px'`): 10px gap between intro paragraph and headline.
- `on` / `on-exact` (uses `pill()`, which has its own `marginTop: '10px'`): 10px gap.
- `not_asked` (headline div has no margin at all): **0px gap** — text is edge-to-edge with the paragraph above.
- `empty`, `checking`, `paused_sim` (all return a single `h('div', { style: muted }, ...)` with no `marginTop`): **0px gap**, same issue.

This isn't a huge visual defect on its own, but it means 4 of the 8 states look subtly more
"cramped" than the other 4 for no functional reason — a caregiver flipping between "not turned on
yet" and "blocked" (both plausible states on the same device across two sessions) would see the
card's internal rhythm change. Easy, low-risk fix: give the outermost returned element (or its first
child) a consistent `marginTop: '10px'` across all eight branches of `renderNativeNotifStatusCard()`.

---

### 3. Checked, no issue found — contrast, touch targets (aside from Finding 1), overflow, contradictory states

- **Color contrast (computed against white, WCAG formula):** `#9A6419` amber 4.99:1, `#A5443C` red
  6.01:1, `#0A6B4A` green 6.53:1, `#6E5A64` muted body 6.35:1 — all pass AA (4.5:1) for normal text.
  White text on the amber button (`#9A6419` bg) is 4.99:1, white on primary `#A24C71` is 5.51:1 —
  both pass. The green pill text (`#0A6B4A`) against its own `rgba(46,125,79,0.10)` tint (effective
  ~`#EAF2ED`) is 5.73:1 — passes. No contrast problems anywhere in this card.
- **Touch target height:** every button in the card renders at exactly `44px` (`minHeight: '44px'`,
  confirmed via computed `getBoundingClientRect().height === 44` for all four button/state
  combinations) — meets the app's stated 44px floor. (This is moot for the four disabled buttons
  above until Finding 1 is fixed, but the *sizing* itself is correct.)
- **No contradictory states observed.** Checked all 8 states directly: the card never shows a green
  "on" pill alongside red error text — `on-exact` pairs the green pill with an *amber* (not red)
  degraded-service note, which is a deliberate and correct distinction (on + degraded ≠ error), and
  `failed`/`blocked` never show the pill at all. This matches what the repo's own R4 check asserts
  and I confirm it visually in `designer_v35_on-exact_390_card.png`.
- **No text clipping or overflow at 320px** (the narrowest supported width) in any of the 8 states —
  checked all 8 `_320_card.png` screenshots. Longest copy blocks (`failed`'s two-sentence body,
  `on-exact`'s stacked pill + count line + warning + button) all wrap cleanly with no horizontal
  scroll, no ellipsis-truncation, no button-label wrapping into the button's padding.
  `overflow-wrap: anywhere` is correctly applied to the error-state title/body text (`errBlock()`),
  though in practice none of the current copy strings are long/unbroken enough to need it.
- **Copy tone:** `failed` state reads as a normal, calm explanation a non-technical caregiver could
  follow — *"Something went wrong scheduling reminders. Your existing reminders are unaffected — this
  only blocks new ones from being armed until it's retried."* No stack trace, no exception text, no
  jargon. `on-exact`'s *"Exact timing isn't allowed — reminders may arrive a little early or late."*
  correctly reads as "still working, just imprecise," not "broken." Good copy, no changes needed
  here.
- **Visual consistency with the rest of Settings:** confirmed via the full-page screenshots
  (`designer_v35_on_390_full.png`, `designer_v35_on_1280_full.png`). The Notifications section uses
  the exact same `secStyle` card chrome (white bg, `#EBE3E4` 1px border, 17px radius, 14px padding)
  and the same `TYPE.label` treatment for its "NOTIFICATIONS" header as Profiles/Home
  screen/Units/FAQ. It does not look bolted-on structurally — it belongs. (Button-disabled bug aside,
  the *look* of this card is on-brand.)

---

### 4. Nice-to-have — desktop (1280px) layout is unchanged from mobile, single narrow column with large empty margins

**Where:** all states at 1280px, e.g. `designer_v35_on_1280_full.png`.

This is a pre-existing, app-wide layout characteristic (every section in Settings — Profiles, Home
screen, Units, FAQ — is the same fixed ~688px-wide single column, not just the new Notifications
card), so it is **not a v35-specific regression** and I'm not scoring it against this feature. Flagging
only so the Lead Designer knows it was checked and is a known, consistent, pre-existing choice rather
than something the new card introduced or broke.

### 5. Nice-to-have — `checking` state has no loading affordance beyond text

**Where:** `checking` state, all widths, e.g. `designer_v35_checking_390_card.png`.

The card shows plain muted text "Checking notification status…" with no spinner or skeleton. This is
consistent with the only other loading state I found elsewhere in the app (a plain "Loading…" text at
line 2590, no spinner pattern exists anywhere in this codebase), so it's not an inconsistency — it's
just worth noting that in practice, `checkPermissions()` against a real native bridge resolves in well
under 100ms, so this state is expected to flash briefly rather than be something a user dwells on.
Not asking for a spinner to be built for a sub-100ms state; noting only for completeness.

---

## Summary for the Lead Designer

- 1 blocker: the shared `btn()` helper in `renderNativeNotifStatusCard()` renders every action
  button (`Try again` ×2, `Turn on notifications`, `Allow exact reminders`) permanently disabled via
  `disabled: notifActionBusy` (an `h()`/`setAttribute` boolean-attribute trap the file already has a
  warning comment about elsewhere). Confirmed with real Playwright pointer clicks (timeout/fail) and
  by re-running `verify_v35_rebuild.mjs`, whose R5 check currently **fails** — contradicting
  `outputs/REBUILD_v35_report.md`'s "all six pass" claim. No visual sign of the disabled state exists
  (`opacity: 1`, `cursor: pointer`, full brand color), so this cannot be caught by screenshots alone.
- 1 should-fix: inconsistent 0px vs 10px gap between the section's intro sentence and the card body,
  split evenly across the 8 states (measured, not eyeballed).
- Checked and clean: color contrast (all ≥4.99:1), 44px touch-target sizing, no 320px overflow/clipping,
  no contradictory pill+error combinations, non-technical/calm copy tone, and structural consistency
  with the rest of the Settings screen.
- Not in scope / pre-existing: the whole app (not just this card) doesn't use extra horizontal space
  at 1280px — flagged only as context, not a v35 defect.

All 48 screenshots referenced above live in `/home/claude/chemowell-app-beta/outputs/` with the
naming pattern `designer_v35_<state>_<width>_{full,card}.png`. Capture script:
`/home/claude/chemowell-app-beta/designer_v35_screens.mjs`.
