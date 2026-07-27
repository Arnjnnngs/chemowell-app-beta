# DESIGNER_REVIEW_v20_restart — Fix pass on AUDIT_v20's P1-1, P1-2, P2-1

Role: Designer (Quality Chain stage 3) · Date: 2026-07-27 · Build: app-v20 restart (`const APP_VERSION = 'app-v20'`, `index.html:3531`) · Reviewed: RENDERED product at http://localhost:8910/index.html via Chromium (Playwright), fresh onboarding each run, viewports **390x844** (primary) and **1280x900** (secondary). No code was modified.

This is a narrow, scoped re-review per the restart rule — the three original v20 features (pause, excluded-window, schedule-window picker) already passed Designer/Lead Designer/QA and are unchanged by this fix pass; the four visual defects the original Designer pass found (Items 2/5/6/8 in `DESIGNER_REVIEW_v20.md`) were already fixed and re-verified by the Lead Designer before this restart even began (`LEAD_DESIGNER_SIGNOFF_v20.md`) and are out of scope here. This review covers only what `DEV_BRIEF_v20_restart.md` changed: the P1-2 fix (the only one with a visual surface) plus a sanity spot-check of P1-1's and P2-1's no-new-UI claims and the surrounding Meds-tab flows.

Method note: every visual claim is backed by a screenshot and/or a live `getComputedStyle()`/`getBoundingClientRect()` probe against the running DOM, not eyeballing. Two throwaway medications were created against a seeded treatment date (today): **Excluded Only Test** (Scheduled, Treatment-day availability = Excluded, default −1/+1 days, never paused) and **Excluded Paused Test** (same, then paused via the editor) — this is the exact combination state the audit's P1-2 repro needed and the one no earlier review stage had constructed. 10 screenshots saved to `outputs/v20-restart-designer-screenshots/`.

---

## Item 1 — New standalone "Excluded near treatment day" inert card — **PASS**

`index.html:2718-2727` (verified against the running DOM, not just source):
```js
if (treatmentExcludedNow(med, now)) {
  return h('div', { style: { background: 'rgba(125,105,116,0.06)', border: '1.5px dashed rgba(125,105,116,0.30)', borderRadius: '16px', padding: '10px 12px', ... } },
    h('div', { ...TYPE.title, color: '#554A52' }, med.name),
    h('div', { fontSize: '12px', color: '#7A6E76' }, 'Excluded near treatment day')
  );
}
```
Live `getComputedStyle()` on the rendered "Excluded Only Test" card, both viewports:
- `background-color: rgba(125, 105, 116, 0.06)`
- `border: 1px dashed rgba(125, 105, 116, 0.3)` (sub-pixel `1.5px` rounding to `1px` in `getComputedStyle` — same expected browser behavior noted for the identical recipe in `DESIGNER_REVIEW_v20.md` Item 7, not a defect)
- `border-radius: 16px`, `padding: 10px 12px`

This is a byte-identical match to the existing inert-card family used for Paused (`index.html:2710`), In-Patient (`index.html:2729`), and Not-scheduled-today (`index.html:2735`) — same `rgba(125,105,116,0.06)`/`1.5px dashed rgba(125,105,116,0.30)` recipe, same 16px radius, same 10px/12px padding, same title/caption color pair (`#554A52` / `#7A6E76`) already reviewed and passed at 7.37:1 / 4.24:1 contrast in the original v20 pass (Item 7) — no new contrast risk since no new colors were introduced.

Non-interactivity confirmed live: `cursor: auto` (not `pointer`), `hasButton: false`, no `onClick` anywhere on the card or its children. It does not accidentally read as tappable — no shadow, no hover affordance, no button chrome, consistent with the other inert cards in the same grid.

No overflow or clipping at either width: at 390px the card renders at `358×61px` (full-width single column) with "Excluded near treatment day" comfortably on one line; at 1280px it sits in a two-column grid at `340×96.5px` — the extra height there is CSS Grid's default `align-items: stretch` matching the row height of its taller sibling ("Excluded Paused Test — Paused" wraps to two lines), not a defect of this card. See `w390-01-home-quicklog-combo.png`, `w1280-01-home-quicklog-combo.png`.

## Item 2 — Paused + Excluded combination shows "Paused," not "Excluded" and not nothing — **PASS**

This is the exact audit repro (P1-2). "Excluded Paused Test" (both `paused:true` and inside its `treatmentMode:'excluded'` window) renders the **Paused** card, matching the copy and styling of every other paused medication:
- Live DOM text: `"Excluded Paused Test — Paused" / "Not tracked while paused. Resume anytime."`
- Resume button: live `getBoundingClientRect()` → `92.2px × 44px` at both viewports — meets the 44px touch-target minimum.
- Clicking Resume works end-to-end: after the click, the same medication correctly re-renders as the **Excluded** inert card (title "Excluded Paused Test," caption "Excluded near treatment day") instead of vanishing or staying stuck — confirmed visually in `w390-02-home-after-resume.png` / `w1280-02-home-after-resume.png` (both cards now read "Excluded near treatment day," no "— Paused" text anywhere on the page).

This confirms the branch ordering the dev brief specified (`paused` checked first at `index.html:2704`, `treatmentExcludedNow` second at `index.html:2718`, ahead of `inpatientActiveNow` and `medScheduledOn`) renders correctly on the live build, not just in source.

## Item 3 — Meds tab delete/add flow spot-check (P1-1's no-new-UI claim) — **PASS**

P1-1 (archived `pausePeriods` on delete, restored on matching re-add) is pure data/logic with no new screens (`deleteMedicationConfig:3192`, `normalizeArchivedMeds:358`, `normalizePausePeriods:280` — confirmed no new `h(...)` render calls in any of these). Spot-checked the surrounding UI for regression:
- **Confirm-delete UI** (`w390-04-delete-confirm.png`, `w1280-04-delete-confirm.png`): tapping the trash icon correctly flips it in-place to a red "Confirm delete" button plus "Existing dose history will remain visible." / "Keep" — this two-step pattern is pre-existing and renders identically to what it did before this fix pass, no layout shift or clipping at either width.
- **Delete toast** (`w390-05-after-delete-toast.png`, `w1280-05-after-delete-toast.png`): "Excluded Only Test was removed from the active list. Existing dose history was preserved." — unchanged copy, correct positioning, no overlap issues.
- **Add-medication toast**: "Excluded Paused Test added to medication management." — unchanged, renders correctly at both widths (visible mid-transition in `w390-01`/`w1280-01`/`w1280-02`).
- Confirmed no console errors from any of these flows (only pre-existing, unrelated `net::ERR_CERT_AUTHORITY_INVALID` failures on the external `cdn.jsdelivr.net` Capacitor shim scripts, present on every load of this build regardless of this fix pass — not a regression).

P2-1 (`normalizeMedication` deriving `treatmentOnly` from `treatmentMode`) has no visual surface at all and was not reviewed further, per the dev brief.

---

## Verdict summary

| # | Item | Verdict |
|---|---|---|
| 1 | New standalone "Excluded near treatment day" inert card — style match to inert-card family, non-interactive, no overflow | **PASS** |
| 2 | Paused + Excluded combination shows "Paused" card with working 44px Resume, then correctly falls through to the Excluded card on resume | **PASS** |
| 3 | Meds-tab delete/add flow (confirm-delete UI, toasts) — no visual regression from the P1-1 data-only fix | **PASS** |

**Overall: PASS.** The one new visual surface this fix pass introduced — the standalone "Excluded near treatment day" card — is a correct, pixel-consistent reuse of the app's existing inert-card recipe, not a new design decision, and the combination state the audit actually failed on (paused-and-excluded) now resolves correctly end-to-end on the live build. No new findings. Nothing to send back to the Lead Developer.

Screenshots: `outputs/v20-restart-designer-screenshots/w390-*` (5 files), `w1280-*` (5 files).
