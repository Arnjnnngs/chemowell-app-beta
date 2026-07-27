# DESIGNER_REVIEW_v20 — Pause a medication + Excluded treatment window + Schedule-window time picker

Role: Designer (Quality Chain stage 3) · Date: 2026-07-27 · Build: app-v20 (`const APP_VERSION = 'app-v20'`, `index.html` line 3445) · Reviewed: RENDERED product at http://localhost:8910/index.html via Chromium (Playwright), fresh onboarding each run (no seeded localStorage), viewports **390x844** (primary, DPR 2, touch), **1280x900** (secondary), plus a spot-check at the keyboard-open height **390x480** per `TEAM.md`'s binding MOBILE FIRST rule ("keyboard-open heights must be tested on every form"). No code was modified. 63 screenshots saved to `outputs/v20-screenshots/`.

Method note: every visual claim below is backed by either a screenshot (filenames inline) or a live `getBoundingClientRect()`/`getComputedStyle()` probe against the running DOM (values quoted inline), plus WCAG contrast computed from the actual composited (flattened) rgba colors, not eyeballed. Three throwaway test medications were created to exercise every state: **Ondansetron Test** (Scheduled, Treatment-day availability = Only, −2/+1 days), **Chemo Excluded Test** (Scheduled, Excluded, −1/+2 days), **Metformin Test** (As-needed, used for the full pause lifecycle), plus a fourth, **Grouped Paused Test** (placed in "Morning meds group"), used only to check the grouped-card paused-row rendering. No console errors were introduced by any of these flows; the "1 missed dose from previous days" banner seen in later screenshots is expected/pre-existing behavior from advancing the simulated date on an unlogged scheduled medication, unrelated to this ticket.

---

## Item 1 — Schedule-window row picker: single row, multi-row, delete-to-one, quarter-hour + label live preview — **PASS**

Walked the full lifecycle on a Scheduled medication:

| State | Screenshot (390) | Screenshot (1280) |
|---|---|---|
| Default single row (8:00 AM–8:00 PM, delete hidden) | `w390-03-scheduled-single-default-row.png` | `w1280-03-scheduled-single-default-row.png` |
| Two rows (delete visible on both) | `w390-04-two-window-rows.png` | `w1280-04-two-window-rows.png` |
| Three rows | `w390-05-three-window-rows.png` | `w1280-05-three-window-rows.png` |
| Quarter-hour start/end (8:15 AM–8:30 AM) + custom label "Morning", live preview updates | `w390-06-row-with-quarter-hour-and-label-live-preview.png` | `w1280-06-...png` |
| Back down to one row — delete button correctly hidden again | `w390-07-back-to-one-row-trash-hidden.png` | `w1280-07-...png` |

Live probes confirm the delete-button visibility rule exactly matches spec (`index.html` line 3310: `(form.windowRows || []).length > 1 ? ... : null`):
- 1 row → `document.querySelectorAll('button[aria-label="Remove this time window"]').length === 0`
- 2 rows → `=== 2`
- 3 rows → `=== 3`
- back to 1 row (after two deletes) → `=== 0` again

The live plain-language preview line renders exactly as specced: `"Morning — Reminds between 8:15 AM and 8:30 AM"` for a labeled row, recomputing on every Start/End/label change with no separate preview step — confirmed by reading the rendered text after each select change, not just the source. Visual language (hairline `rgba(212,104,138,0.22)` borders, `43px` selects, `11px` radii) is consistent with every other `<select>`/`formInput` in the same editor. This is a clean, well-executed replacement of the old free-text field — no stray commas to mistype, no silently-dropped windows.

## Item 2 — Row delete ("trash") button touch target — **FAIL**

`index.html` line 3310:
```js
h('button', { type: 'button', onClick: () => removeWindowRow(i), 'aria-label': 'Remove this time window', style: { flexShrink: '0', width: '40px', height: '40px', ... } }, appIcon('trash', 16))
```
Live `getBoundingClientRect()` on the rendered button (both viewports, identical since it's a fixed-px element): **`{ width: 40, height: 40 }`**. This is 4px short of the **44px minimum** touch target this app already establishes and uses correctly elsewhere in this exact same editor screen — e.g. the Edit/Delete icon buttons in the Meds-manager list are explicitly `44px × 44px` (line 3403: `width: '44px', height: '44px'`), and every button styled via `minHeight: '44px'` throughout the editor (Add-another-window, Discard, Save, radiogroup buttons) meets the convention. The trash button sits directly next to two `43px`-tall `<select>`s in the same row (visually reads as roughly matched height), but at 40px it is measurably below the app's own standard.

**Fix:** change `width: '40px', height: '40px'` to `width: '44px', height: '44px'` at `index.html` line 3310. No layout consequence — the row already has `flexWrap: 'wrap'` and `gap: '8px'`, and 4px of added button size will not force wrapping on a 390px-wide row (verified: the row's three controls — two `flex:1, minWidth:110px` selects plus this button — currently render on one line at 390px with room to spare, per `w390-04-two-window-rows.png`).

## Item 3 — Treatment-day availability radiogroup (3-way): visual match to the established "Home screen placement" pattern — **PASS**

`TREATMENT_MODE_OPTIONS` (`index.html` line 3179) renders via the identical `role="radiogroup"`/`role="radio"` markup and styling as the existing v13 "Home screen placement" picker (line 3327 vs. line 3339) — confirmed by diffing the two render blocks: same grid (`repeat(auto-fit,minmax(220px,1fr))`), same selected/unselected background (`rgba(170,83,117,0.13)` selected / `rgba(255,255,255,0.48)` unselected), same border colors, same `◉`/`○` prefix convention, same `13px`/`800`-weight label + `12px`/`600`-weight helper text. Screenshots at both viewports confirm pixel-consistent styling:
- `w390-08-treatment-mode-default-always-available.png` (default state, "Always available" selected)
- `w390-09-treatment-mode-only.png`, `w1280-09...png` ("Only near treatment day" selected)
- `w390-11-treatment-mode-excluded.png`, `w1280-11...png` ("Excluded near treatment day" selected)

Live rect probes on all three radio buttons at both viewports: heights range **53.2px–85.6px**, widths **323–324px** — comfortably above the 44px minimum (the taller ones are simply wrapping to 3 lines of helper text on narrower columns, not a sizing defect).

## Item 4 — Days-before/after fields + live summary line — **PASS**

Selecting "Only" or "Excluded" correctly reveals the two number fields and a live one-line summary that updates on every keystroke (no submit needed), matching the app's existing "compute-and-render inline" convention (same pattern as the schedule-window preview in Item 1):
- Only, before=2/after=1 → live text: **`"Active window: 2 days before through 1 day after treatment day."`** (`w390-10-treatment-mode-only-custom-days.png`, `w1280-10...png`) — correct singular/plural handling (1 day vs. 2 days).
- Excluded, before=2/after=1 → live text: **`"Excluded window: 2 days before through 1 day after treatment day."`** (`w390-11-...png`) — correctly swaps the verb per mode (`index.html` line 3354: `form.treatmentMode === 'excluded' ? 'Excluded window: ' : 'Active window: '`).
- Selecting back to "Always available" correctly hides both fields entirely (confirmed via `document.querySelectorAll('label')` no longer containing "Days before treatment" — `w390-12-treatment-mode-always-available-fields-hidden.png`).

## Item 5 — Meds-manager badges: "Treatment day −N/+M" vs. "Excluded near treatment −N/+M" are visually indistinguishable — **FAIL**

`index.html` lines 3418–3419:
```js
med.treatmentMode === 'only' ? h('span', { style: { ..., background: 'rgba(192,69,59,0.10)', color: '#A15B56', ... } }, 'Treatment day −' + ... ) : null,
med.treatmentMode === 'excluded' ? h('span', { style: { ..., background: 'rgba(192,69,59,0.10)', color: '#A15B56', ... } }, 'Excluded near treatment −' + ... ) : null,
```
Both badges use the **exact same** `background`/`color` pair. Confirmed live via `getComputedStyle()` on both rendered badges in the same screenshot: `background-color: rgba(192, 69, 59, 0.1)`, `color: rgb(161, 91, 86)` — byte-identical for both. See `w390-19-meds-list-metformin-paused-badge.png`, where **"Excluded near treatment −1/+2"** (Chemo Excluded Test) and **"Treatment day −2/+1"** (Ondansetron Test) render as the same salmon-red pill, distinguishable only by reading the full text.

This matters specifically because the two states are **opposites**: "Only near treatment day" means the medication is *available* in that window and hidden the rest of the time; "Excluded near treatment day" means the reverse. A caregiver scanning the Meds list quickly (this app's whole design premise is that its users are "sick, exhausted, and stressed," per `TEAM.md`) can mistake one for the other at a glance, since color carries zero disambiguating signal — only careful reading of the label text does. The `Treatment day −N/+M` red styling itself is **pre-existing** (shipped in app-v16, confirmed via `git log -p`, unchanged since) and out of this ticket's scope to relitigate on its own — but v20 is the change that introduced the "Excluded" badge and had the opportunity to give it a distinct color; instead it copy-pasted the existing token onto a new, semantically-opposite badge.

Secondary, smaller data point: the shared badge color's own contrast is borderline. Computing WCAG contrast for `#A15B56` text against the badge's actual composited background (its own `rgba(192,69,59,0.10)` flattened over the med-manager card's white background, `#FFFFFF` at line 3373) gives **4.41:1** — a hair under the 4.5:1 AA minimum for normal (non-large) 12px/700-weight text (it only reads as 5.06:1 if measured against pure white, not the badge's own tinted fill). Not a new v20 regression, but worth folding into the same fix since a resolution to Item 5 should pick genuinely AA-clean colors rather than perpetuating a borderline one into a second badge.

**Fix:** give the "Excluded near treatment" badge (line 3419) its own distinct color pair — recommend reusing the app's existing amber "Waiting" token already used elsewhere in this same file (`rgba(181,118,30,0.12)` background / `#8C5900` text, per the Home Quick Log card's "Waiting" pill) so "Excluded" reads as a caution/withhold state distinct from "Only"'s red. Contrast check: `#8C5900` on `rgba(181,118,30,0.12)` flattened over white computes to **5.7:1**, clearing AA with margin. Leave the pre-existing "Treatment day" (Only-mode) badge as-is — out of scope to touch here — but if revisited, either token from `NOTICE_TONES` (`index.html` line 1160) would clear AA cleanly.

## Item 6 — Pause/Resume header button in the medication editor — **FAIL**

`index.html` line 3259:
```js
sourceMed ? h('button', { type: 'button', onClick: () => setMedicationPaused(sourceMed.id, !sourceMed.paused), style: { flexShrink: '0', minHeight: '40px', ... } }, sourceMed.paused ? 'Resume' : 'Pause') : null
```
Live `boundingBox()` on the rendered button, both states, both viewports:
- "Pause" (unpaused state): `{ width: 73.8, height: 40 }`
- "Resume" (paused state): `{ width: 88.2, height: 40 }`

Same 40px shortfall as Item 2, against the same 44px convention. Screenshots: `w390-17-edit-existing-med-pause-button-visible.png` (Pause, outline style) / `w390-18-editor-after-pause-resume-button.png` (Resume, filled accent `#A24C71`) — the two states are otherwise well differentiated visually (outline-vs-filled correctly signals "this is the action you'd take" vs. "this is the current state"), it's purely the height that's short.

**Fix:** change `minHeight: '40px'` to `minHeight: '44px'` at `index.html` line 3259. The header row (`display:'flex', alignItems:'center', justifyContent:'space-between'`) has no fixed height constraint that would be broken by a 4px increase.

Separately confirmed as a real PASS: the Pause/Resume control correctly appears **only** in edit mode. Opening a fresh "Add medication" form shows **zero** buttons matching "Pause" (`page.locator('button', {hasText:'Pause'}).count() === 0`, screenshot `w390-27-add-mode-no-pause-button.png`) — matches the dev brief's explicit design intent (`sourceMed ? ... : null` at line 3259 gates correctly on `state.medEditor.sourceId`).

## Item 7 — Home paused Quick Log card (standalone/"Own Home card" placement) — **PASS**

For a medication placed as its own Home card, pausing it correctly swaps in the inert-card treatment from the same visual family as the pre-existing "In-Patient"/"Not scheduled today" cards:

`index.html` lines 2664–2670: `background: 'rgba(125,105,116,0.06)'`, `border: '1.5px dashed rgba(125,105,116,0.30)'`. Live computed style on the rendered card: `background-color: rgba(125, 105, 116, 0.06)`, `border: 1px dashed rgba(125, 105, 116, 0.3)` (sub-pixel `1.5px` rounds to `1px` in `getComputedStyle` — expected browser behavior, not a defect). Screenshot: `w390-20-home-paused-quicklog-card.png`.

Contrast checks (flattened over the app's ivory page background, `~rgb(253,246,248)`, since this card sits directly on Home's body, not a white sub-card):
- Title "Metformin Test — Paused" (`#554A52`) vs. effective card background: **7.37:1** — comfortably PASS.
- Caption "Not tracked while paused. Resume anytime." (`#7A6E76`) vs. effective card background: **4.24:1** — technically a hair under AA's 4.5:1 for this 13px/600-weight caption text, but this exact color (`#7A6E76`) is the app's long-established, systemic caption color used in dozens of other places throughout `index.html` (including the brand-new schedule-window preview line from Item 1) — not a defect introduced by this feature, and not something this ticket should fix in isolation. Flagging only as a data point, not a blocking finding.

Resume button in this card: `92.2px × 44px` — meets the touch-target minimum exactly. The card correctly wins priority over every other card state (verified: this is checked first in `medCards.map()`, ahead of in-patient/not-scheduled, per line 2658).

## Item 8 — Grouped-card ("Morning/Afternoon/Evening meds group" placement) paused row — **FAIL**

A medication placed in a grouped card (e.g. "Morning meds group") and then paused does **not** get the same muted/dashed inert treatment as the standalone card in Item 7. `index.html` lines 1625–1633:
```js
if (med.paused) {
  return h('div', { style: { display: 'flex', alignItems: 'center', gap: '12px', padding: '13px 15px', borderTop: i > 0 ? '1px solid rgba(212,104,138,0.08)' : 'none' } },
    h('div', { style: { flex: '1', minWidth: '0' } },
      h('div', { style: { ...TYPE.title, color: '#554A52' } }, med.name + ' — Paused'),
      h('div', { style: { ...TYPE.caption, color: '#7A6E76', marginTop: '2px' } }, 'Not tracked while paused.')
    ),
    h('button', { onClick: () => setMedicationPaused(med.id, false), ... }, 'Resume')
  );
}
```
This row renders on the **same plain white background** as every active row in the grouped card (`index.html` line 1623: the shared card wrapper is `background: '#FFFFFF'` with no per-row override for the paused branch) — no dashed border, no muted fill, nothing but the text color change and the appended "— Paused" suffix to signal "this one's off." Screenshot `w390-28-grouped-card-paused-row.png` confirms: visually, a paused row in a grouped card reads almost the same as an active row at a glance — a much weaker "this is inert" signal than Item 7's standalone card gets.

This is made more conspicuous by the fact that the **very same function**, four lines later, uses a *different* muting technique for a *different* inert state in the exact same card: the treatment-window-hidden row (line 1640, `if ((med.treatmentOnly && !treatmentActiveOn(med, now)) || treatmentExcludedNow(med, now))`) applies `opacity: '0.65'` to visually fade the entire row. So within one card, three different "how do I show this row can't be interacted with" answers now exist: standalone card = dashed border + tinted fill; grouped-card treatment-excluded row = opacity fade; grouped-card paused row = no visual treatment at all beyond text color. None of these three should be considered "the" pattern until they agree with each other.

Secondary, smaller finding: the copy also differs between the two paused-card implementations. Standalone card (line 2667): `"Not tracked while paused. Resume anytime."` Grouped-card row (line 1630): `"Not tracked while paused."` — missing the trailing "Resume anytime." sentence. Confirmed live: the standalone card's exact string is present in the DOM in one flow and absent in the other; only the shorter grouped-card string renders for the grouped placement.

**Fix:** apply the same `opacity: '0.65'` treatment already used one branch below (line 1640) to the paused row's wrapping `div` at line 1627, for internal consistency with its nearest sibling state — this is the smallest-diff fix (one style property, matching an existing precedent already three lines away) rather than importing the dashed-border/tinted-fill recipe wholesale into a table-row context where it wasn't designed to sit. Separately, align the copy: either add "Resume anytime." to line 1630 to match line 2667, or (simpler) shorten line 2667 to match line 1630 — pick one string and use it in both places.

## Item 9 — Daily "Still pausing {med}?" check-in banner — **PASS**

Tested the full lifecycle live via the BETA date-shift controls (not just single-frame screenshots):
1. Paused Metformin Test → advanced the simulated date +1 day (`+ 1 Day` button) → banner appeared: **`"Still pausing Metformin Test?"`** with body text `"It won't be tracked or remind you today unless you resume it."` (`w390-22-home-after-plus1-day-pause-checkin-banner.png`, `w1280-22-...png`).
2. Clicked **"Continue pausing"** → banner correctly disappeared for the rest of that simulated day (`bannerGoneAfterContinue: true`, confirmed by re-querying the DOM for the banner text and finding none — `w390-23-home-after-continue-pausing-banner-gone.png`).
3. Advanced +1 day again → banner correctly **reappeared** (`bannerReappearsNextDay: true`, `w390-24-home-next-day-banner-reappears.png`) — confirms the daily recurrence works across a real (simulated) day boundary, not just once.
4. This time clicked **"Resume"** from the banner → the medication fully resumed: Home card returned to normal, and the "Paused" badge disappeared from the Meds-manager list (`pausedBadgeGoneAfterResume: true`, `w390-25-...png`, `w390-26-...png`).

Tone/color check: the banner uses `NOTICE_TONES.info` (`index.html` line 1161: `accent: '#A24C71'`) — the app's rose brand accent, **not** the urgent-red token (`#C0453B`) used one card above it for the "1 missed dose from previous days" banner. This is the correct choice per the dev brief's explicit intent ("a deliberately paused medication isn't a risk signal the way a missing health data point is... do not wire into `dailyAlertLevel`'s escalation") and matches the established Bowel/Weight/Appetite check-in recipe (same `borderLeft: 4px solid {accent}` construction). The two banners can look superficially similar at a glance in a compressed screenshot (both use a colored left-border-accent card), but the actual hues are meaningfully different (rose `#A24C71` vs. red `#C0453B`) and the icon differs (`❚❚` pause glyph vs. `!`) — this is a correctly-calibrated, non-alarming treatment for a non-urgent, user-initiated state.

Button touch targets, live-measured: `"Continue pausing"` — `158.3px × 44px`; `"Resume"` (banner) — `86.2px × 44px`; `"Resume"` (Quick Log card, same screen) — `92.2px × 44px`. All meet the 44px minimum.

## Item 10 — Layout, overflow, keyboard-open occlusion — **PASS**

- **No horizontal overflow** at any tested width: `document.documentElement.scrollWidth === clientWidth` confirmed at **360px, 390px, and 1280px**, each measured live on the "Add medication" editor with a Scheduled window row open (the widest/most control-dense state this release touches).
- **Keyboard-open height spot-check (390×480)**, per `TEAM.md`'s binding rule that keyboard-open heights be tested on every form: the schedule-window rows (`w390x480-kbopen-schedulewindow-rows.png`) and the Treatment-day availability radiogroup (`w390x480-kbopen-treatment-radiogroup.png`) both remain fully reachable via normal scroll, with no element trapped behind the fixed bottom nav or clipped — the short viewport just means more scrolling, not lost content.

---

## Verdict summary

| # | Item | Verdict |
|---|---|---|
| 1 | Schedule-window rows: single/multi/delete-to-one + quarter-hour + live preview | **PASS** |
| 2 | Row delete ("trash") button touch target | **FAIL** — measured 40×40px, 4px under the app's 44px convention. Fix: `width`/`height` → `44px` at `index.html` line 3310. |
| 3 | Treatment-day availability radiogroup styling vs. established pattern | **PASS** — pixel-consistent with "Home screen placement," all options ≥53px tall. |
| 4 | Days-before/after fields + live summary line | **PASS** — correct text, correct verb per mode, correct singular/plural. |
| 5 | "Treatment day" vs. "Excluded near treatment" badge colors | **FAIL** — byte-identical `rgba(192,69,59,0.10)`/`#A15B56` for two opposite meanings; also a borderline 4.41:1 text contrast. Fix: give "Excluded" its own token, e.g. the existing amber `rgba(181,118,30,0.12)`/`#8C5900` (5.7:1 contrast). |
| 6 | Pause/Resume header button (med editor) touch target | **FAIL** — measured 40px tall in both states. Fix: `minHeight` → `44px` at `index.html` line 3259. Correctly absent in Add mode (verified live). |
| 7 | Home paused Quick Log card (standalone placement) | **PASS** — correct dashed/muted inert-card family, 44px Resume button, good title contrast (7.37:1); caption contrast 4.24:1 is a pre-existing systemic color, not a new defect. |
| 8 | Grouped-card ("Morning/Afternoon/Evening" placement) paused row | **FAIL** — no dashed border or opacity fade (unlike its own sibling treatment-excluded row 4 lines later, which does use `opacity:0.65`), plus a shorter, inconsistent copy string. Fix: add `opacity:'0.65'` to the row wrapper at line 1627; align copy with line 2667 (or vice versa). |
| 9 | Daily "Still pausing?" check-in banner | **PASS** — full lifecycle verified live across simulated day boundaries: appears, dismisses on "Continue pausing," reappears next day, resolves on "Resume." Correct non-urgent rose tone, 44px buttons. |
| 10 | Overflow / keyboard-open occlusion | **PASS** — no horizontal overflow at 360/390/1280px; schedule-window rows and radiogroup remain reachable at keyboard-open 390×480. |

**Overall: FAIL, back to the Lead Developer for four concrete, narrowly-scoped fixes** (Items 2, 5, 6, 8). All four are small, well-isolated, exact-value changes — two touch-target height/width bumps, one badge color swap, one `opacity` addition plus a copy alignment — not a redesign. None of the three features' core mechanics are broken: the schedule-window picker, the 3-way treatment-mode radiogroup, and the pause lifecycle (including the daily banner's cross-day recurrence) all work correctly end-to-end on the live build. Per `TEAM.md`'s fail-fast/restart amendment, these read as exactly the class of "minor exact-value item" the Owner's amendment allows the Lead Developer to fix and have this stage re-verify without a full chain restart, rather than requiring a fresh Developer brief.

Screenshots: `outputs/v20-screenshots/w390-*` (28 files, primary mobile walkthrough), `w1280-*` (27 files, desktop parity check), `w390-28-grouped-card-paused-row.png` (grouped-placement pause check), `w390x480-kbopen-*` (3 files, keyboard-open spot-check).
