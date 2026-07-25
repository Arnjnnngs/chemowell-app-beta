# 03 PM GATE — app-v16
Role: Project Manager gate, run by the Lead Developer per TEAM.md (checks all upstream stages
actually ran and produced their artifact; verifies fixes were applied AND re-verified; confirms the
deliverable matches what the Owner actually asked for; verifies release mechanics).

## Stages that ran, with artifacts
1. Developer brief — `outputs/DEV_BRIEF_v16.md` (investigation of both reported bugs, root cause,
   recommended approach, explicit landmines/no-touch list, Definition of Done).
2. Lead Developer implementation — this diff (`index.html`, `sw.js`, `README.md`).
3. Lead Developer self-verify — `node --check` clean; Node harness (35/35: 30 pure-logic incl. DST
   spring-forward, 5 migration-safety); Playwright smoke at 390px/1280px (toggle → day inputs → live
   summary → save → badge → Settings version → full tab sweep), zero console/page errors.
4. Independent Auditor agent — `outputs/AUDIT_v16.md`. Found 1 must-fix + 2 should-fix. All three
   fixed in this same pass and re-verified (harness re-run 35/35 including two new regression tests
   that directly reproduce the audit's exact scenarios; Playwright smoke re-run clean).

Design/QA-User-Zero stages were not run as separate agent passes for this release — the change is
additive to the medication editor (two new conditional number inputs + a renamed toggle + a badge
format change) and one full-app tab sweep at both viewports, rather than a new user-facing flow or a
first-run-path change, so a full "User Zero" fresh-install walkthrough would be re-testing surface
this release didn't touch. Screenshots of the new editor UI (mobile 390px, scrolled — see
`/tmp/v16_editor_scrolled.png` at implementation time) were reviewed directly against the existing
design system (rose accent, pill toggle, hairline borders, caption-weight helper text) and match; no
new component patterns were introduced.

## Does the deliverable match what Aaron actually asked for?
Aaron's report, checked point by point:
- "there is no way to start a reminder for a certain med" — fixed: any medication with a schedule
  window now gets a real reminder, generically, with no separate "set a reminder" UI needed (derived
  from the schedule the medication already has).
- "not everyone has the same regimen to stop taking day before and the next couple days... there
  should be a section that allows them to enter their own stuff... maybe stop taking a certain med 3
  days before and 3 days after treatment" — fixed: exactly this, two editable fields per medication.
- "it's the chemo-day only toggle...which ACTUALLY should be Treatment day...not exclusively 'Chemo'"
  — fixed: toggle renamed, badge renamed, and the global treatment-date card's remaining "Chemo"
  strings (toast copy, empty-state text) also generalized to "Treatment" for consistency.

No scope drift: the Settings copy promising "Per-medication controls are coming soon" (a possible
future per-medication reminder ON/Off switch, independent of `alerts`) was deliberately left alone —
that's a different, not-yet-requested feature, logged as out-of-scope in the Dev Brief rather than
silently bundled in.

## Release mechanics
- `APP_VERSION`: `app-v14` (was already stale — v15's own bump was missed) → `app-v16`. Fixed the
  drift as part of this release.
- `sw.js` CACHE: `chemowell-app-v15` → `chemowell-app-v16`.
- README version-history table: `app-v16` row added.
- Live smoke: not yet re-verified on the deployed GitHub Pages URL — pending push (see below). This
  is a web/PWA-only change plus data-model migration; no native/Capacitor/CI build is required for
  this release (no Android-specific code touched).

## Outstanding / for the Owner
- The generic reminder fix can only be observed firing for real on Aaron's already-installed native
  APK (web/PWA stays silent under `TEST_MODE` by existing design) — once this ships and Aaron
  refreshes the app, a medication with a schedule window should produce a real phone notification
  when its window opens, if no dose is logged in that window yet.
- A brand-new medication defaults to Treatment-day OFF; an existing medication that already had
  "Chemo-day only" on keeps behaving exactly as before (±1 day) until its Days-before/Days-after
  fields are edited — no config was reset by this release.

## Verdict
**PASS — ready to ship as app-v16.**
