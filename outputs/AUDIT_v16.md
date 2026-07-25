# 02 AUDITOR REPORT — Custom treatment-day windows per medication + generic dose reminders
Role: Auditor (Quality Chain stage), run as an independent fresh agent with no visibility into the
Lead Developer's implementation reasoning beyond the DEV_BRIEF and the actual diff. Adversarial code
audit + edge-case user-testing, cross-checked against `DEV_BRIEF_v16.md`'s Definition of Done.

## Confirmed correct (tried to break, couldn't)
- `chemoOnly` has zero remaining functional references (only the migration comment).
- Dead legacy `dexamethasone`/`zofran`-id branches are byte-identical — landmine respected, not touched.
- `treatmentActiveOn` migration correct for all three prior medication shapes (never-toggled,
  old fixed `chemoOnly:true`, already-new-shape).
- `missedDosesFor`, `doseProgressToday`, the Home Quick Log filter, `status()`'s `chemoOver`, and
  `dueRemindersAt` all gate identically via `med.treatmentOnly && !treatmentActiveOn(med, ts)` — no
  drift between "shown on Home," "counted as missed," and "gets a reminder."
- `before:0, after:0` (treatment day only), no treatment date ever set, and a DST spring-forward
  transition (tested against 2026-03-08) all behave correctly — verified via harness.
- Negative/NaN day-count inputs can't reach `treatmentActiveOn` — clamped at both save time and load
  time.
- `treatmentOnly` composes safely with every `scheduleDays` mode.
- `node --check` clean.

## Findings (all fixed same-pass; see below)

**1. [must-fix, FIXED] `clampTreatmentDays('')` returned 0, not the documented fallback of 1.**
`Number('')` is `0` (a legitimate, finite, non-negative value), so a cleared/blank input silently
saved as "treatment day only" instead of falling back — contradicting the function's own doc comment
and, worse, silently narrowing a patient's premedication window with no error or toast. Fixed by
checking for blank/whitespace-only input *before* the `Number()` coercion.

**2. [should-fix, FIXED] Reminder de-dupe key only included a window's start hour, not its end —
two windows on the same medication starting at the same hour would collide and the second window's
reminder would silently never fire, every day.** Fixed by including both `w.start` and `w.end` in
the `notifSentToday` key (and in the OS-level notification `tag` passed to `sendNotif`, which had the
same collision risk for notification replacement).

**3. [should-fix, FIXED] README changelog wasn't updated to app-v16 yet at audit time** — this was
mid-implementation (the Lead Developer hadn't reached the README/version-bump step yet); added below
in this same pass, confirmed in `git diff`.

## Verification after fixes
- Added targeted regression tests reproducing both bugs directly (`clampTreatmentDays('')`/`'   '`/
  `null` → 1; two same-start-hour windows on one medication both independently fire) to the Node
  harness — all 35 checks pass (30 pure-logic + 5 migration).
- Re-ran the full Playwright smoke suite (mobile 390px + desktop 1280px): toggle → day inputs → live
  summary (1/1 → 3/3) → save → badge → Settings version string → full tab sweep. Zero console errors,
  zero page errors, zero horizontal overflow, `app-v16` confirmed in Settings, no `app-v14` stale
  string remaining.

## Verdict
**PASS.** All three findings fixed and re-verified in the same pass; no new issues introduced by the
fixes (confirmed via full harness + smoke re-run).
