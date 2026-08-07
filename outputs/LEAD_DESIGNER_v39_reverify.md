# Lead Designer re-verification — v39 "Other" treatment-type fix

## Verdict: PASS

## What was checked (live at http://127.0.0.1:8936/index.html, Playwright/Chromium)

1. **Bug reproduction/fix, 390x844** — seeded 3 profiles (chemo/1 entry, radiation/0, other/0) via
   `chemowell-app-profiles-v1` + per-profile `-prefs-v1`/`-entries-v1` keys, opened Account via
   drawer → Profiles. Measured caption `<div>` heights via DOM rects: "Chemo · 1 entry" = 14px,
   "Radiation · 0 entries" = 14px, "Other · 0 entries" = 14px — all single-line, uniform row height,
   no wrap. Label text confirmed as short "Other" (not "Other treatment").
   Screenshot: `v39-01-account-profiles-390-reverify.png`.

2. **Print-report call site (code inspection)** — index.html:5298
   `treatmentLabel(treatmentType())` — single argument, `short` param is `undefined`/falsy, so
   `t === 'other'` still returns full `'Other treatment'`. Unchanged from pre-fix behavior.
   (openPrintReport() opens via window.open(), not evaluable in-page; code read directly per the
   prior audit's precedent for this exact unreachable case.)

3. **Regression spot-check, 390x844** — welcome/setup screen 4 treatment chips (Chemo/Radiation/
   Both/Other) all fit one line, no wrap (`v39-02-welcome-390-reverify.png`). Legacy migration card
   4 chips also fit one line, no clipping (`v39-03-migration-card-390-reverify.png`). Neither surface
   touches `treatmentLabel()` (hardcoded chip labels), consistent with no regression.

4. **Unchanged labels** — `treatmentLabel()` source (index.html:5195) confirms chemo/radiation/both
   branches are untouched (`'Chemo'`, `'Radiation'`, `'Chemo + Radiation'` regardless of `short`).
   Account-list screenshot shows "Chemo · 1 entry" and "Radiation · 0 entries" rendering exactly as
   before. Fix is scoped to the `t === 'other' && short === true` branch only.

## Conclusion
The `short` param correctly disambiguates the two call sites: Account list (index.html:5364, passes
`true`) now gets "Other", print report (index.html:5298, no second arg) still gets "Other treatment".
Original wrap bug is resolved with no observed regressions in adjacent surfaces.
