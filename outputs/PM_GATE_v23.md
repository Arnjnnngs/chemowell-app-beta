# PM Gate — app-v23

**Lane:** Full chain (new feature — scheduled-med gap timers; data-model change — `state.override`
gains an optional `doseKey`, entries gain `overrideReason`, medications gain `createdAt`; multi-screen
(Home cards, grouped cards, medication editor, Journal, History, Settings selects); safety-relevant
(dosing lockout logic, missed-dose tracking)), per TEAM.md.

## What was asked

Aaron's second message batch, clarified via follow-up questions:

1. Scheduled medications should get the same gap-timer/lockout logic as-needed meds already have
   ("Yes, same lockout logic as as-needed meds").
2. "Daily limit needs more elaboration" — reworded copy explaining what it does, repositioned under
   Dosage options in the editor so it flows naturally (not new limit types).
3. A Home-screen way to override a daily-limit block for a temporary reason, with a confirmation
   toast — mirroring the existing "Log early" gap-timer override.
4. Restyle every native `<select>` dropdown app-wide — rounded, light, consistent font, not the
   dark/square OS default.
5. Card text should wrap to additional lines instead of truncating, with simplified copy (his
   example: "Last dose Today - Monday 7/2..." / "Next Dose at 11:00 PM" → "Last taken - Monday 7/27").
6. Consider a copywriter/"wordsmith" role in the team process.

Two urgent bugs arrived mid-build and were folded into this same release ahead of the rest of the
batch, per Aaron's "put all above thing into fix mode":

- **Bug A:** adding a brand-new medication immediately showed 3 missed doses.
- **Bug B (with screenshot):** the app's header blended into the phone's system status bar, making
  notification icons unreadable.

Aaron also asked mid-turn to make sure testing covers mobile-first layout, which is the project's
existing standard but was reconfirmed explicitly for this release.

## What shipped

- **Scheduled-med gap timers** — a scheduled ("Scheduled — set time windows") medication can now
  optionally also carry a minimum-gap-hours value. `status()` ORs the gap check in with the existing
  window check: a window being open no longer guarantees "available" if the last dose was logged too
  recently. The existing "Log early" override UI picks this up automatically since it already keys
  off `locked`/`availableAt` generically — no separate override path needed. Editor gains a
  "Minimum gap hours (optional)" field for scheduled meds (required, as before, for as-needed meds).
  `formatRuleSummary()` shows both the schedule windows and the gap rule together when both are set.
- **Daily limit rework** — "Daily limit" and "Limit unit" moved from after the schedule/gap block to
  directly under Dosage options, and the label copy now reads "Blocks logging more doses once this
  many are reached for the day. Leave blank for no limit."
- **Daily-limit override on Home** — both the standalone Quick Log cards and the grouped
  Morning/Afternoon/Evening cards can now override a daily-limit block, not just a closed-window
  block. Standalone cards get a new per-dose override path (`state.override.doseKey`) for when one
  specific dose option would exceed remaining room while the medication overall isn't locked, plus
  the existing whole-card override path now also fires for ceiling-hit locks. Grouped cards get a
  matching override control with explanatory copy ("This would go over today's limit. Log it
  anyway?"). A logged override now shows a toast confirming what happened ("... (over today's
  limit)") and the entry is tagged with `overrideReason` (`'early' | 'overLimit' | 'both'`) so
  Journal/History badges say which one actually happened instead of always saying "Early."
- **Select restyling** — every native `<select>` app-wide (13 call sites: symptom type, weight
  reason, pain level, bowel/appetite pickers, medication editor's schedule-type/mode/limit-unit/
  window-time selects, appointment reminder picker, Settings' temperature/weight unit selects) now
  renders with a custom chevron, rounded corners, light background, and the app's own font via a
  shared `selectFix()` helper plus new global CSS matching the existing `<input>` font rule.
- **Card text wrapping + copy simplification** — Quick Log card name/sub text and the meta-info row
  (last dose / next dose) now wrap onto additional lines instead of clipping with an ellipsis. The
  "Last dose" line is simplified to Aaron's requested format: `Last taken - Monday 7/27` (no
  redundant "Today -" prefix, no time). The medication's own note, previously dead code marked
  `display:none` since v12, is restored and visible on the card again.
- **TEAM.md wordsmith guidance** — rather than a 9th process stage, copy-quality review folds into
  the existing Designer stage (both lanes): Designer now explicitly checks new/changed user-facing
  copy the same way it checks visuals, with a rule to flag high-stakes copy to Aaron for a real
  copywriter's pass instead of resolving it in-chain.
- **Bug A fix (missed-dose flood on new medication)** — root cause: `missedDosesFor()` had no
  per-medication floor, so a medication added at 2pm still had its 8am/11am windows flagged as
  missed even though it didn't exist yet. Fixed by stamping every genuinely new medication with
  `createdAt` at save time and skipping any window that closed before that timestamp. Medications
  saved before this fix have no `createdAt` and keep behaving exactly as before (the existing
  app-wide `MISSED_TRACK_SINCE` floor still applies to them).
- **Bug B fix (status bar icons invisible)** — root cause: `manifest.webmanifest`'s `theme_color`
  (`#C77800`, dark amber) and `background_color` (`#EEF1F0`, pale green-grey) were stale, mismatched
  leftovers unrelated to the app's actual light-pink header — this is what the OS uses to decide
  status-bar icon contrast for the installed PWA, independent of the HTML meta tag. Both values
  fixed to `#FDF1F4`, matching the app's real header color; the HTML `<meta name="theme-color">` was
  also corrected to the same exact value (was a slightly different pink, `#F8E8EE`).

## Stages that ran

1. **Lead Developer** — implemented the full batch plus both urgent fixes, self-verified: syntax
   check clean, 7 targeted Playwright suites plus the full existing v22 regression suite, at mobile
   (390×844 and 360×800) and desktop viewports, zero console errors throughout.
2. **Designer + Auditor** — ran as a genuine independent parallel review (via the Agent tool, not
   self-certified), each given the diff and the running app.

## Findings — all fixed, all re-verified

**Designer — BLOCKER:** a long medication name on a standalone Quick Log card caused horizontal page
overflow at mobile widths — button styles used `flex:'0 0 auto'` (explicitly no-shrink) with dynamic
text content, so a single oversized button pushed past the viewport even inside a wrapping flex
container. Fixed across all 5 button-style variants in that card's render path:
`flex:'0 1 auto', minWidth:'0', maxWidth:'100%', whiteSpace:'normal', textAlign:'center',
lineHeight:'1.25'`. Re-verified: zero horizontal overflow at both 390px and 360px, long name fully
visible wrapped across multiple lines, confirmed via screenshot.

**Designer — should-fix:** grouped-card override buttons had no explanatory text, unlike the
standalone card's override banner. Fixed with a new `overrideExplain` line ("This would go over
today's limit. Log it anyway?" / "Closed — opens {time}. Log it early anyway?" / "This medication's
treatment window has ended. Log it anyway?").

**Designer — should-fix:** grouped-card override buttons were 42px, under the app's 44px touch-target
floor. Bumped to 44px.

**Designer — should-fix:** the medication editor's "Schedule type" select clipped its text on
desktop with no ellipsis. Fixed with `textOverflow:'ellipsis', overflow:'hidden',
whiteSpace:'nowrap'`.

**Designer — nice-to-have:** awkward daily-limit ceiling-hit copy. Reworded.

**Auditor — BLOCKER:** the grouped-card `courseComplete` case (a medication whose treatment window
has fully ended) still hit the pre-existing "Opens Invalid Date" bug that the ceiling-hit fix alone
didn't cover — `st.courseComplete` locks a medication with no `availableAt`, and the old code always
rendered `'Opens ' + fmtTime(st.availableAt)` regardless of lock reason. This was a real,
previously-undiscovered defect surfaced while building the daily-limit override feature for this
card, not something this release introduced. Fixed by adding explicit `courseComplete` handling
alongside `ceilingHit` in both the trigger button ("Course complete") and the confirm banner. Re-
verified: no "Invalid Date" text anywhere on the page, "Course Complete Med" section renders and
reads correctly.

**Auditor — should-fix:** override entries always showed "Early" in the Journal/History badge, even
when the actual reason was going over today's limit — misleading for a caregiver reviewing what
happened. Fixed by adding `entry.overrideReason` (`'early' | 'overLimit' | 'both'`), set alongside
the existing `entry.override` boolean at log time, with the badge now reading "Over limit" / "Early ·
Over limit" / "Early" accordingly. Entries logged before this fix have `override:true` with no
`overrideReason` and default to displaying "Early," matching their actual prior behavior. Re-
verified: an over-limit-only log now shows "OVER LIMIT," not a bare incorrect "EARLY."

**Auditor — should-fix:** `isEarlyAt()` used a strict `<` when finding the previous dose, so two doses
logged in the same clock minute (the time picker only has minute precision) produced identical
timestamps — the second dose's `ts < prev.ts` was false, `prev` came back `undefined`, and the
override silently lost its "early" flag entirely, not just a mislabeled toast. Fixed by changing to
`<=`; this runs before the new entry is ever saved, so there's no risk of a dose matching itself.

No Lead Designer / Lead Auditor pass — every finding was unambiguous and fixed directly, then
re-verified against its specific repro, per TEAM.md's discretion clause. Every fix was covered by a
dedicated re-verification test (`verify_audit_fixes_v23.mjs`) run at both 390px and 360px per Aaron's
explicit mobile-first instruction, plus a manual screenshot review.

## Bug reports — root-caused and fixed

**"Added a new med, immediately got 3 missed doses"** — see Bug A above. Verified two ways: a
localStorage-seeded test proving old-style medications (no `createdAt`) still flag missed doses
correctly while new medications don't, and a real UI "Add Medication" flow test proving `createdAt`
gets stamped end-to-end with no false flag.

**"Top of the app blocks the system tray... blends in" (with screenshot)** — see Bug B above.
Diagnosed from the single screenshot Aaron provided plus inspection of `manifest.webmanifest` — no
device access was needed to find the root cause. Fix is a data-only manifest/meta correction with no
logic changes, so it carries no regression risk to anything else in the app.

## Release mechanics

- `APP_VERSION` bumped `app-v22` → `app-v23`; service worker cache bumped to match
  (`chemowell-app-v22` → `chemowell-app-v23`).
- README.md version history updated (this release's entry).
- Evidence: 7 curated screenshots in `outputs/v23-evidence/` — within TEAM.md's ~10-image cap:
  long-name overflow + course-complete fix, smallest-viewport (360px) pass, card copy/note/ceiling
  fix, daily-limit override flow, scheduled-med gap timer, missed-dose bugfix, select restyling.
- Push + live cache-busted verification: next step, immediately following this gate.

## PM sign-off

Matches every piece of Aaron's original batch (scheduled-med gap timers, daily-limit rework +
override, select restyling, card text wrap/copy simplification, wordsmith guidance in TEAM.md) plus
both urgent bugs he found live-testing, all folded into one release per his explicit instruction.
Every stage that ran produced its artifact (this doc + evidence folder + the Designer/Auditor
findings above). Every finding — 2 blockers, 5 should-fix/nice-to-have across both reviewers — was
fixed and the fix itself re-verified against its specific repro, not just claimed, with mobile-first
testing (390px and 360px) confirmed throughout per Aaron's explicit instruction. No scope drift.
Release mechanics complete except the push, which follows immediately.
