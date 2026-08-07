# Developer Brief — v39: "Other" treatment-type onboarding option

## Why
Aaron (Owner) wants ChemoWell's positioning broadened beyond chemo/radiation patients to "any
chronic illness / long-term treatment" — but as a deliberately SMALL first step, not a full
rebrand/rename/re-theme. Concrete decision from Aaron (2026-08-07):
- Audience: "any chronic illness / long-term treatment" (chemo/radiation becomes one of several
  supported tracks, not the only one).
- Scope: start small — add a "none of these" / "other" option to the onboarding treatment-type
  choice so a non-chemo/non-radiation user can get through setup. No rename, no re-theme, no
  rewrite of app-wide copy this round.

This directly closes the BACKLOG.md item: "Onboarding has no 'none of these' option for treatment
type — the welcome screen forces a choice of Chemo / Radiation / Both before 'Get started'
unlocks."

## Investigation findings (full detail from research pass, condensed here)
- Treatment type is a single string field in per-profile prefs (`treatmentType`), read via
  `treatmentType()` (index.html:1461), values today: `'chemo' | 'radiation' | 'both' | ''`.
  **`''` is NOT neutral** — it's the legacy/pre-v33 "unanswered" sentinel and is treated
  identically to `'chemo'` everywhere. The new option MUST be a distinct explicit string
  (`'other'`), never `''`, or it collides with that sentinel and keeps re-triggering the
  "Finish setting up this profile" nag forever.
- Two onboarding surfaces render the same 3-chip choice and both need the new 4th chip:
  1. First-run welcome screen, `setupChipRow('Treatment type', ...)` — index.html:2434.
  2. Legacy-profile migration card on Home, `chipBtn(...)` × 3 — index.html:3116-3118.
- `treatmentLabel(t)` (index.html:5191) maps the value to a display string for the Account →
  Profiles list and the printable/PDF report subtitle. It currently falls through to `'Not set'`
  for anything not chemo/radiation/both — needs a branch for `'other'` or an "other" profile
  will read as broken/incomplete everywhere it's shown.
- Downstream gating is shallow: `hasRadiation()` / `isRadiationOnly()` only ever check for
  `'radiation'`/`'both'` — `'other'` naturally falls through as "not radiation," which is
  correct (no radiation-sessions card, keeps the general treatment-schedule card visible by
  default, same as chemo-only profiles get today). **No scheduling, dosing, daily-limit, or
  missed-dose logic reads treatment type at all** — this is purely a display/labeling surface.
- Two copy sites actively name only chemo/radiation and should be softened (still "small," just
  wording, no restructuring):
  - Welcome screen headline (index.html:2424): "...tracker for chemo and radiation patients and
    their caregivers."
  - FAQ item (index.html:1789): "How do I set a treatment (chemo/radiation) date?"
- `manifest.webmanifest` / `package.json` still say "chemo" in their descriptions — explicitly
  OUT OF SCOPE this round per Aaron's "start small" call; logged to BACKLOG.md as a later-phase
  item alongside any future rebrand conversation.

## What "done" looks like
1. A 4th choice, value `'other'` / label `'Other'`, appears in both onboarding chip rows in the
   same order as existing chips (Chemo, Radiation, Both, Other).
2. Selecting "Other" and completing setup writes `treatmentType: 'other'` and unlocks "Get
   started" exactly like the other three (no special-casing needed in `completeSetup()` — it
   already just checks truthiness).
3. `treatmentLabel('other')` returns a real label (not "Not set") — recommend `'Other treatment'`
   for the profile-list/report context so it doesn't read as a downgrade from "Chemo + Radiation".
4. An "Other" profile: does NOT show the Radiation sessions card (correct via existing
   `hasRadiation()` logic, no code change needed); DOES show the Treatment schedule card by
   default, same as a chemo-only profile (existing `!isRadiationOnly()` gate, no code change
   needed) — both togglable in Settings regardless.
5. Welcome-screen headline and the one FAQ item read naturally for someone who isn't a
   chemo/radiation patient, without erasing that ChemoWell is still built with cancer-care roots.
6. Existing `'chemo'`/`'radiation'`/`'both'`/`''` (legacy-unset) profiles are completely
   unaffected — this is additive only.
7. Regressions that must NOT happen: legacy-unset (`''`) profiles must still be treated as before
   (no accidental remap to "other"); the "Finish setting up this profile" nag must still clear
   correctly for both new and legacy-migration paths; the report/profile-switcher label must not
   show "Not set" or "undefined" for an "Other" profile.

## Alternative considered
Renaming the field/adding a free-text "describe your condition" input was considered and
rejected for this pass — Aaron's instruction was explicitly to start small, and free text adds
validation/display-surface complexity (report subtitles, profile list truncation) disproportionate
to "let non-chemo users past onboarding." A fixed `'other'` value keeps this contained; a
free-text label can be a later enhancement if Aaron wants richer differentiation.
