# LEAD_DESIGNER_SIGNOFF_v11 — Review of the Designer's v11 review

Role: Lead Designer (Quality Chain stage 4) · Date: 2026-07-24 · Build: app-v11
Reviewed artifact: `outputs/DESIGNER_REVIEW_v11.md` + screenshots `v11-01`…`v11-16`
Method: independent re-verification on the running app at http://localhost:8877/index.html (headless Chromium via Playwright, viewports 360x740 and 390x844 DPR2/touch), plus code inspection of `index.html` (no code modified). My evidence: `outputs/lead-v11-01`…`lead-v11-07` and the scripted run in `/tmp/lead_v11.mjs` (all assertions listed passed unless noted).

---

## 1. What I checked — independent re-verification of Designer claims

I re-ran the three claims that would matter most if wrong, from scratch, with my own instrumentation:

| Claim (Designer) | My independent result | Verdict |
|---|---|---|
| Sheet byte-identical across ticks (Item 1) | Two PNG buffers 600ms and 3.6s after open compared with `Buffer.equals`: **identical at 390** (`lead-v11-01/02`). DOM-node marker survived 3s of ticks — the sheet element is genuinely never rebuilt by the tick loop. | **CONFIRMED** |
| Animation once per open, both close paths reset the flag (Item 1) | First open: `sheetUp .32s` running. "Simulate purchase" re-render: `animation=""` — no replay. Close via **scrim tap** → reopen: animates. Close via **✕** → reopen: animates. Matches the flag reset at line 1584 (`!state.upgradeOpen` early return). | **CONFIRMED** |
| No flash-of-wrong-tab on restore (Item 3) | MutationObserver installed at **document-start** (context init script, so it genuinely observes from first paint of the new document), reload on Symptoms: distinct active-nav history = `["Symptoms"]`. No Home frame ever painted. `restoreView()` (line 349) runs at state init, before the first `render()` at 3716 — code agrees. | **CONFIRMED** |

Accuracy spot-checks against code: scrim `rgba(50,25,40,0.45)` (line 1625), ✕ 44x44 (1631), toast `zIndex: 50` (1741) vs scrim `70` (1625) vs tour `80` (1683) — all Designer-quoted values are accurate. Their reported sheet-top settle of 101px at 390x844 is consistent with `maxHeight: 88vh` (844 − 742.7 ≈ 101.3). I also reproduced their toast-invisibility finding exactly: toast present, computed z-index 50, `elementFromPoint` at the toast's center hits sheet content — the toast is fully occluded while the sheet is open. No Designer claim I tested was wrong or exaggerated.

## 2. Coverage probe — surfaces the Designer did or didn't cover

**(a) Sheet at 360px.** Partially covered. The Designer took real 360 screenshots (`v11-10`, `v11-11`, `v11-12` — I inspected them; content matches my own 360 captures) but their **stability byte-compare ran only at 390 and 1280** (their Item 1 says so explicitly). I closed the gap: byte-identical buffers across 3s at 360x740 (`lead-v11-03/04`), `scrollTop=150` held exactly across 2.5s of ticks, zero horizontal overflow. **Gap closed — no defect behind it.**

**(b) Time modal (the other tick-suspended surface).** Not exercised by the Designer beyond "still scrolls." Since the v11 fix edited the shared tick guard (line 3712), I ran the full regression myself: opened the temperature time modal from Home → modal node marker survived 3.2s of ticks (guard intact, `!state.timeModal` untouched); in-modal date-pill → calendar toggle re-render works; Save closes the modal, the 99.5° entry appears (pendingEntries flush path working); `main` was rebuilt within 1.6s of close (tick render resumes). Zero errors. Evidence: `lead-v11-05-timemodal-390.png`. **No regression.**

**(c) Second sheet opener path.** The Designer opened the sheet only via Settings → "View plans." Note: the task brief mentioned a "Meds-tab + Add profile" path — **that path does not exist**; grep of all `upgradeOpen: true` writers finds exactly two, both in Settings: "View plans" (line 2981) and "+ Add profile" when at the profile limit (line 2980). I tested the untested one: on Free tier with 1 profile, "+ Add profile" opens the same sheet, entry animation plays once, node stable across 2.5s of ticks (`lead-v11-06`). **No defect; both openers behave identically, as expected since they share `renderUpgradeModal`.**

**(d) Reload-restore mid-tour on a fresh profile.** Not covered by the Designer (the Dev brief flagged this as landmine 8). I ran it: fresh profile with no `tourDone` → tour starts at step 1; advanced to "Tap Meds" → tapped Meds (tour → step 3, `sessionStorage` view = `meds`); **reloaded mid-tour**. Result: Meds tab restored with correct nav state, tour resumed at step 3, tour card fully on-screen, highlight re-attached to the `meds-add` target, and the tour advanced normally afterward (Add → step 4). Zero errors. Evidence: `lead-v11-07-tour-restored-meds-390.png`. **Tab restore and tour interplay is coherent — no wedged state.**

**(e) Keyboard focus around the sheet.** Not covered by the Designer at all — this is the one real miss with findings behind it. Three defects found (all **pre-existing**, none introduced by v11):
1. **Focus never moves into the dialog on open.** Activating "View plans" with Enter leaves `document.activeElement` on `<body>` (the trigger is destroyed by the re-render). The sheet declares `role="dialog"` + `aria-modal="true"` but receives no focus — a keyboard/screen-reader user is left outside a modal that claims to be modal.
2. **Escape does not close the dialog.** No keydown handler exists; the sheet stayed open after Esc.
3. **Focus does not return to the trigger on close.** After ✕, `activeElement` is `<body>`.

Severity: low-to-medium, WCAG 2.1 relevance (2.1.1/2.1.2, 2.4.3). Mitigation context: ✕ and the cards are reachable by Tab once inside, scrim + ✕ both work by pointer/touch, and v11 actually **improved** keyboard usability here — before the fix, the 1Hz rebuild destroyed any focused element inside the sheet every second, so keyboard interaction with the sheet was effectively impossible; now the node persists between interactions. These should ride the next chain pass as their own item (focus sheet on open, Esc-to-close, restore focus to trigger), not be quick-fixed (restart rule).

## 3. Judgment on the Designer's suggestion (toast `zIndex: '75'`)

**Endorsed, with one amendment.** The app's layer scale is 20 (header) / 34 (back pill) / 35 (nav) / 50 (toast) / 60 (time modal) / 70 (sheet scrim) / 80 (tour) / 100 (loader). `75` slots cleanly between the sheet and the tour layer and keeps the tour supreme — internally consistent with the system. Raising the toast above the time modal (60) as a side effect is also correct: feedback should never render underneath any surface. **Amendment:** the toast computes `pointer-events: auto` (verified live); at z 75 it would overlay the sheet's lower cards and intercept taps for its 4.5s life. The fix must pair `zIndex: '75'` with `pointerEvents: 'none'` (the toast is `role="status"` with no interactive content, so this costs nothing). The Designer's alternative (repositioning while `upgradeOpen`) is worse — state-dependent styling for a layering problem. Correctly labeled pre-existing and low severity; correctly routed as a suggestion for a future chain pass rather than a v11 FAIL.

## 4. What remains open

1. **Sheet keyboard/focus a11y** (§2e, three pre-existing defects) — new item for a future chain pass. Not a v11 blocker: v11's scope was flicker + tab persistence, and v11 made this surface better, not worse.
2. **Toast z-index 75 + `pointerEvents: 'none'`** — carried forward as amended (§3), for a future pass through the full chain.
3. Designer's noted theoretical seam (sheet held open across midnight freezes the date label) — I agree with their judgment: not worth engineering around; noting here so the Auditor sees it was consciously accepted twice.

## 5. Verdict on the Designer's review

**PASS.** Every re-verified claim held up under independent measurement, including the three highest-stakes ones; all quoted values matched code and live computed styles; their screenshots are genuine and accurate. Coverage was strong with two gaps — 360 stability byte-compare (closed by me, clean) and keyboard focus (real miss, three pre-existing a11y findings now on record). Zero defects found in the v11 fixes themselves across all seven probe areas. The build proceeds to stage 5 (Auditor) with the two open items above attached.
