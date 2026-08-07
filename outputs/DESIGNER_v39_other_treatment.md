# Designer review — v39 "Other" treatment-type onboarding option

Reviewed live at http://127.0.0.1:8936/index.html via Playwright/Chromium (390x844 mobile, 1280x900 desktop, plus 816px print width). Screenshots in `/home/claude/chemowell-app-beta/v39-designer-screenshots/`.

## Findings

**1. should-fix — Account → Profiles list: "Other treatment" wraps to 2 lines, breaking row-height consistency**
Location: `index.html` line ~5361 (`treatmentLabel(pp.treatmentType) + ' · ' + cnt + ' entr...'` in the Account profiles list).
At 390px width, "Other treatment · 0 entries" wraps onto 2 lines (measured 28px tall) while "Chemo · 1 entry" and "Radiation · 0 entries" stay on 1 line (14px tall) — see `10-account-profiles.png`. This makes the "Casey Other" row visibly taller/misaligned next to its siblings, so "Other treatment" does *not* read as a clean peer of "Chemo"/"Radiation" in this specific tight layout. Note this is not entirely new — "Chemo + Radiation" (the "Both" label) already wrapped the same way — but the new label doubles the affected rows from 1-of-3 to 2-of-4.
Suggested fix: in this list context only, use the shorter "Other" instead of "Other treatment" (drop "treatment" — the section is already headed "Patient profiles" and sits next to "Chemo"/"Radiation", so the noun is implied). Leave the fuller "Other treatment" wording in `treatmentLabel()` for the print report subtitle, where it fits on one line at real print width (verified in `12-printable-report-print-width.png`) and the extra word adds clarity there.

**2. nice-to-have — no explanatory copy on what "Other" implies**
The 4th chip is a bare "Other" label with no helper text anywhere in onboarding (welcome screen or migration card) about what selecting it changes (e.g., whether chemo/radiation-specific cards like Treatment schedule or Radiation sessions still show). Not a blocker — the existing "these answers just tailor which cards the app shows" line under the button already sets that expectation generically — but a first-time non-oncology user may wonder if they're choosing the "right" option. Optional: no action needed unless the Owner wants it addressed now.

## No issues found
- Welcome screen (mobile + desktop): 4-chip row fits cleanly, no cramping/wrapping on "Radiation" or "Other", touch targets stay 48px, headline copy reads naturally and doesn't overflow (`01`, `02`).
- Selected/active chip state (border, tint background, bold text) is visually identical across Chemo/Radiation/Both/Other (`04-chip-state-3-other.png`).
- Legacy migration card on Home at 390px: all 4 chips fit on one line, no clipping, consistent with the welcome screen's selected-state styling (`05`, `06`).
- FAQ wording change ("How do I set a treatment date?") reads naturally, no truncation (`14`).
- Keyboard focus ring on the Other chip behaves the same as other chips (no custom regression).
