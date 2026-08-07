# Lead Designer sign-off — v39 "Other" treatment-type onboarding

Verified live at http://127.0.0.1:8936/index.html via Playwright/Chromium (390x844, 360x780, 1280x900), seeding
localStorage directly (profiles-v1 + per-profile prefs-v1/entries-v1). Screenshots in `lead-designer-v39-verification/`.

## Designer finding #1 (should-fix) — CONFIRMED
Reproduced independently at 390px (`01-account-profiles-390.png`): measured DOM rects — "Chemo · 1 entry" = 14px tall
(1 line), "Radiation · 0 entries" = 14px, "Other treatment · 0 entries" = **28px (wraps to 2 lines)**. Matches report.

**Designer's suggested fix is technically incomplete.** `treatmentLabel(t)` (index.html:5192) is a single shared
function with exactly two call sites — index.html:5295 (print subtitle) and index.html:5361 (Account list) — and
takes only `t`, no context argument. Editing the one string inside `treatmentLabel()` changes both call sites
identically; it can't give "Other" in the list and "Other treatment" in print without a second param
(`treatmentLabel(t, {short:true})`) or an equivalent split. Flag for implementation so it isn't done as a bare edit.

## Spot-checks of "no issues found" — CONFIRMED
- **Legacy migration card, 390px, end-to-end**: all 4 chips fit one line, no clipping. Went further than chip
  selection — clicked "Other" → "Save" → confirmed via localStorage that `treatmentType: 'other'` persisted and
  "Profile updated" toast fired (`02`–`04`). CTA/save flow works.
- **Welcome screen, desktop 1280px**: chip row clean, evenly spaced, 48px targets, softened headline reads
  naturally, no overflow (`05`).

## Scope gaps checked, no new blocking issues
- **360px (low-end Android)**, not just 390px: welcome + migration card chips still fit one line, no wrap/clip (`06`).
  Closes a real gap in the Designer's coverage safely.
- **Long profile name + "Other treatment" compounds wrapping**: seeded "Alexandria Montgomery-Whitfield" as Other —
  name wraps 3 lines *and* label wraps 2 lines, a visually unbalanced, much-taller row (`07`). Pre-existing
  name-wrapping issue, not introduced by v39, but "Other treatment" is the longest label so it's the worst case.
  Not a hard blocker (needs an unusually long name) — log as owner-optional follow-up.
- **RTL / OS text-zoom**: app is English-only, `<html lang="en">`, no `dir` or i18n anywhere — RTL is out of scope
  app-wide, not v39-specific. Root font-size 150% had no layout effect (styles are fixed-px, not rem) — pre-existing
  app-wide trait, not a v39 regression.

## Verdict: FAIL — do not ship as-is
Finding #1 is real and confirmed. The blocker isn't the wrap itself (Designer already caught it) — it's that the
suggested fix, as literally described, cannot be implemented against the current single-argument `treatmentLabel()`
without a call-site-aware mechanism. Before this ships: give `treatmentLabel()` a short/long mode (param or second
lookup), apply "Other" in the Account list and "Other treatment" in the print subtitle, then re-verify the "Casey
Other" row is 14px/1-line like its siblings at 390px. Everything else reviewed (chip layout at 390/360/1280px,
selected-state styling, migration-card save flow, FAQ copy) passes.
