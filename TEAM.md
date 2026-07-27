# ChemoWell — Team Process

Defined by Aaron (Owner). This is the actual release process for this project — it lives in
this file, not in anyone's memory, so it survives across sessions.

Aaron is a non-technical solo founder and product owner. He sets direction and gives final
acceptance; he should never have to catch a technical defect himself. Every technical
decision (architecture, libraries, process) is owned by the Lead Developer unless Aaron
says otherwise.

## Two lanes, chosen by scope

Every change goes through one of two lanes. The lane is decided by what the change touches,
not by who's in a hurry — that keeps it predictable instead of a judgment call every time.

**Fast lane** — single bug fixes, copy/wording changes, styling/layout fixes, anything
confined to one screen with no change to how data is stored or calculated.

**Full chain** — any new feature, anything that changes how medication/dose/schedule data
is stored, read, or calculated, anything spanning multiple screens, or anything
safety-relevant (dosing logic, missed-dose tracking, reminders).

If it's ambiguous which lane applies, default to the full chain — the fast lane is for
things that are obviously small, not a way to talk yourself into skipping review.

## Fast lane — 4 stages

1. **Lead Developer (Claude)** — investigates, implements, self-verifies: syntax check, a
   real browser/runtime smoke test of every affected screen at mobile and desktop sizes,
   zero console errors. No placeholders, no TODOs, no "should work."
2. **Designer** — quick visual pass, only if the UI actually changed. Skipped entirely for
   backend-only or logic-only fixes.
3. **Auditor** — one combined pass: line-by-line code check of the change and its blast
   radius, plus a real end-to-end test of the fix on the running product (not a thought
   experiment) including the obvious edge cases. This absorbs what QA User Zero used to do
   as a separate stage — a first-time-user walkthrough of the changed flow is just the first
   half of what the Auditor already does.
4. **Project Manager** — confirms the fix matches what Aaron actually asked for, confirms
   the Auditor's test evidence is real, checks release mechanics (version bump if
   applicable, live smoke test after push), writes Aaron a plain-language summary.

## Full chain — 8 stages before Aaron

1. **Developer** — investigates the affected code, researches the approach plus at least
   one alternative, defines what "done" looks like. Written brief.
2. **Lead Developer (Claude)** — implements fully, self-verifies as above.
3. **Designer** — reviews the actual rendered product on every touched screen: spacing,
   typography, color, alignment, touch targets, empty/error states. Premium consumer-grade
   is the bar. Suggestions come with exact values.
4. **Lead Designer** — independently re-inspects a sample, confirms the Designer covered
   every affected surface (modals, toasts, disabled states, smallest viewport). Only
   required if the Designer flags something they're not confident about; otherwise
   optional at the Lead Developer's discretion for high-visibility UI work.
5. **Auditor** — full line-by-line code audit of the change and its blast radius, plus
   end-to-end user journeys on the running product including edge cases: double-taps, day
   boundaries, empty states, absurd inputs, offline/reload. Written report with severity,
   repro steps, locations.
6. **Lead Auditor** — reproduces every finding, probes what the audit didn't cover. Only
   required if the Auditor flags something they're not confident about; otherwise optional
   at the Lead Developer's discretion for high-risk changes (data model changes, anything
   safety-relevant).
7. **Project Manager** — verifies every stage that ran actually produced its artifact,
   cross-checks every finding was fixed and the fix re-verified, confirms no scope drift,
   verifies release mechanics, writes the completion summary.
8. **Owner (Aaron)** — final acceptance.

## The restart rule (applies to both lanes)

If anything is wrong — found at any stage, by anyone — the work goes back to the start of
whichever lane it's in, not back one step. A fix is new work and gets the whole lane. On
repeat failures, the next attempt's brief must say why the previous one failed first.

## Release mechanics checklist (both lanes)

- Version bump (`APP_VERSION` in index.html) and service worker cache name bump for any
  change that ships to users.
- README.md version history entry.
- Push to GitHub, then live-verify the actual deployed site (not just localhost) with a
  cache-buster query param, since the service worker caches aggressively.
- Reports for full-chain work go in `outputs/`. Fast-lane fixes don't need a full report
  set — a one- or two-line note in the commit message and README entry is enough unless the
  PM stage flags something worth documenting further.
- **Screenshot evidence is capped at ~10 curated images per stage**, not a dump of every
  automated capture. Pick the ones that show the finding or the fix, not the whole test
  run. This is what turned today's push into a 20-minute manual GitHub-web-upload exercise
  (263 files, no push credentials in this sandbox) — the fix is fewer, better-chosen
  screenshots, not a better upload method.
