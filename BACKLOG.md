# BACKLOG.md — chemowell-app-beta

Small, non-blocking things found during work that aren't worth stopping for, but shouldn't get
forgotten either (per Aaron, 2026-08-06: "if there is something that you notice is a problem or
can be an easy fix... make sure that is in the notes"). Read this at the start of any session in
this repo — it's the durable, in-repo version of a running punch list. Pull items into a real task
when you're about to touch the relevant code; delete the line once it's actually fixed and shipped.

- **`release_check.sh` only guards *uncommitted* work — it passes green on the exact bug it exists
  to block.** Found by the PM gate on app-v52 (2026-08-09) and reproduced directly: the script reads
  `git diff --name-only HEAD -- index.html` and `git diff HEAD -- sw.js`, so on a clean tree it prints
  "✅ Release check passed. No index.html changes pending." and exits 0 — even when the committed
  delta about to be uploaded changes `index.html` without bumping `sw.js`'s CACHE. That is precisely
  the app-v40 silent-stale-cache failure the script was written to make structurally impossible, and
  it is reachable through this project's *own documented workflow* (APP_CLAUDE.md rule 8 says commit
  early and often; pushes are manual GitHub web uploads of already-committed files). app-v52's own
  version coherence was verified by hand instead (`APP_VERSION` app-v51 → app-v52, CACHE
  chemowell-app-v51-1 → chemowell-app-v52-4). Fix: diff against the upstream ref, not `HEAD` —
  `BASE="${BASE_REF:-origin/main}"`, then `git diff --name-only "$BASE" -- index.html` and
  `git diff "$BASE" -- sw.js`, keeping the existing `HEAD` check as an additional uncommitted-work
  warning. Deliberately NOT changed inside the PM gate that depends on it: it should go in as its own
  change with its own Auditor + PM pass. **Do this before the next release.**
- **History gets very heavy when a large missed-dose backlog is finally listed** (new tail case
  introduced by app-v52's H-1 fix — History now seeds days that have misses but no entries, where
  before it rendered nothing for them). PM-measured on this sandbox, 4 window meds, nothing logged:
  14 days / 56 misses → 83 ms render, 113 ms tap · 45 days / 180 → 135 ms / 198 ms · 120 days / 480 →
  298 ms / 569 ms · **365 days / 1,460 → 1.5 s render, ~114 k characters of DOM, and the screen
  effectively stops responding to taps** (a click retried for 20 s without landing). Cause is the
  1-second `setInterval` in index.html that calls `setState()` and rebuilds the entire tree, which is
  fine at normal sizes and not at this one — and the user who most needs the "Clear all" button is
  exactly the one who can't tap it. Realistic backlogs (a patient who stops logging for a few weeks)
  are comfortably fine, so this is a tail case, not a release blocker. Fix options: cap/paginate the
  seeded day list, or exclude History from the 1-second tick the way the modals already are.
- **The near-treatment restriction is still stored on "Other" profiles, just ignored** — app-v52
  removed the control and made saved values inert (`treatmentOnlyBlocks`/`treatmentExcludedNow` both
  return false for Other), and re-saving a medication on an Other profile leaves `treatmentMode:"only"`
  in localStorage. Harmless today *only because there is no UI anywhere to change a profile's
  treatment type after first-run setup* (`needsProfileCompletion()` gates the one editor, and it only
  fires when sex or type is missing). If treatment-type editing is ever added — and it probably should
  be, see the next item — an Other → Chemo switch would silently reactivate a restriction the user has
  not been able to see since upgrading. Fix: normalise `treatmentMode`/`treatmentOnly` to `none`/false
  on save when `isOtherTreatmentType()`, and/or clear it when the type changes.
- **No way to change treatment type after setup** — chemo / radiation / both / Other is asked once on
  the welcome screen and can then only be changed by the legacy "Finish setting up this profile" card,
  which only appears when sex or type is *missing*. A user who picks the wrong one, or whose treatment
  plan changes (very common — chemo then radiation), has no way to correct it short of erasing the
  profile. Pre-existing, noticed during the app-v52 PM gate.
- **Dead "Other"-specific copy left behind by app-v52** — `treatmentModeOptions()`'s
  `isOtherTreatmentType()` branch ("Only near your date" / "Excluded near your date") is now
  unreachable, since the whole picker is `isOtherTreatmentType() ? null : …`. Three other places still
  carry `isOtherTreatmentType() ? 'Excluded near your date' : …` ternaries inside expressions that are
  already guarded by `&& !isOtherTreatmentType()` (index.html ~2548, ~3883, ~5017), so one expression
  now both excludes Other and branches on it. No behavioural effect; it just misleads the next reader.
- **The printable doctor's report still prints raw internal override codes** — carried over from
  `outputs/AUDIT_v52.md` (V52-10) and re-confirmed in `outputs/AUDIT_v52_2.md`: `buildExportRows()`
  concatenates `'override: ' + e.overrideReason`, so a clinician reads `override: early+overLimit`.
  The app already has `overrideBadgeLabel()`, which turns exactly that value into "Early · Over limit"
  for the on-screen badge — the export just doesn't call it. Same document and same audience as the
  app-v52 H-3 fix (which removed the invented "500 pills" from that column), so it belongs in the next
  pass over this function. Pure copy, one line.
- **No year shown on date labels** — `renderNotesView`'s note rows (index.html, "MMM D" date badge)
  and the sibling Calendar/Appointments feature's `calPillLabel` both show only month+day, no year.
  Fine for near-term dates, ambiguous for anything logged more than ~11 months apart (a chemo/rad
  journal entry from 2 years ago and one from last month can render identically). Found during the
  v36 Notes audit (2026-08-06); pre-existing on Calendar, not a new regression. Fix: add the year to
  both when it differs from the current year, or always show it — Designer call on which reads
  cleaner in the existing card width.
- **`saveNote()`'s empty-text-deletes-the-note branch is unreachable** — its only caller
  (`confirmNoteModal`) already blocks empty/whitespace text with a toast before calling it, so that
  code path can never run. Harmless (no user-facing effect), just stale. Found during the v36 Notes
  audit (2026-08-06). Either wire up a real path to it (e.g. let clearing a note's text in the
  editor and saving delete it, instead of blocking the save) or remove the dead branch — Aaron's
  call on which behavior he actually wants.
- **Notes/Appointments "Delete?" confirm state never auto-resets** — tap trash once (shows
  "Delete?"), navigate away without confirming, come back — it's still showing "Delete?". Consistent
  with the existing Appointments behavior (not a v36 regression) but inconsistent with
  `confirmDeleteMed` (resets on nav away) and entries (6s auto-timeout). Found during the v36 Notes
  audit (2026-08-06). Worth picking ONE pattern and applying it everywhere delete-confirm shows up,
  rather than three different behaviors across the app.
- ~~**Onboarding has no "none of these" option for treatment type**~~ — FIXED in v39 (2026-08-07):
  added a 4th "Other" chip to both onboarding surfaces (welcome screen + legacy-migration card),
  `treatmentLabel()` gives it a real label instead of "Not set". Chain-verified end-to-end
  (Developer/Designer/Lead Designer/Auditor/Lead Auditor/PM). Leaving this line struck through
  instead of deleting until the v39 changes are actually committed/pushed.
- **`manifest.webmanifest` and `package.json` still describe the app as being "for chemo
  patients"/"chemo medication tracker"** — now inaccurate given v39 broadens onboarding to any
  chronic illness / long-term treatment via the "Other" option. Explicitly OUT OF SCOPE for v39
  per Aaron's own "start small" instruction (onboarding-option-only, no rebrand/rename this round).
  Revisit if/when Aaron decides to move forward with a fuller positioning update. Found 2026-08-07
  during the v39 PM gate (the v39 dev brief said this was already logged here — it wasn't; this
  entry corrects that).
- ~~**CSV export needs a true native path once the app is actually Capacitor-wrapped**~~ — DONE,
  app-v47 (added `@capacitor/filesystem` + `@capacitor/share`, real native share-sheet handoff).
  The `synapse` gotcha documented here DID hit in production (silently, since app-v47 shipped) —
  found by a retroactive Zero Day Auditor pass on app-v50 (`outputs/AUDIT_v50.md`) and fixed in
  app-v51 using exactly the shim already written down here. Leaving this entry struck through
  rather than deleted as a record that the backlog note was right and should have been acted on
  sooner — the lesson: a documented-but-unapplied fix for a known live defect should get promoted
  to REQUESTS.md and scheduled, not left here indefinitely once the underlying feature has
  actually shipped and is live for real users.
- **The exact-alarm "?" explainer should tell users to do battery optimization FIRST** — Aaron
  resolved his own exact-alarm problem on 2026-08-09 by granting battery-optimization exemption,
  after which the OS-level exact-alarm toggle took and the reminder fired on time. The in-app
  explainer currently presents "Allow exact reminders" and "Allow background activity" as two
  independent controls, so a user hitting the same wall gets no hint that one unblocks the other.
  Reword to lead with battery optimization, and consider ordering the two cards that way on screen.
  Small copy change, real support value — this is the single most-reported problem in the project's
  history. (Copy touching a medical reminder = Auditor copy-clarity check applies.)
- **`sync-backend` profile pull is O(n) sequential reads — fine now, will not stay fine** — the
  Zero Day Auditor measured `GET /api/profile/pull` at 516ms for 10 records, 4,755ms for 100,
  11,163ms for 300 and 36,645ms for 1,000 (roughly 37ms per record, linear), because `listJson`
  fetches each blob one at a time. Harmless at realistic near-term scale (dozens of records, a
  ~45s poll loop) and explicitly out of scope for slice 1, but it sits directly under a polling
  sync loop, so it degrades quietly as a patient's history grows. Two straightforward fixes when
  it matters, neither a redesign: read the page concurrently instead of sequentially, and/or add
  the delta-since-timestamp endpoint `SYNC_DEVELOPER_BRIEF_v2.md` §6 already anticipates. Found
  2026-08-09 during the sync-backend provisioning audit. (The *correctness* half of this — silent
  truncation at 1,000 records — was a real bug and is already fixed; this entry is only the
  performance half.)
- **`sync-backend` never cleans up a COMPLETED pairing handshake** — expired sessions are now
  deleted when anything touches them, but a handshake that finishes normally leaves its session
  blob (and its code -> session mapping) sitting in the store until something happens to touch it
  after the expiry time, which for a completed pairing nothing ever does. Nothing sensitive is
  readable from it (the wrapped key is ciphertext only the two paired devices can open, and
  `status` refuses to serve an expired session at all), so this is storage hygiene rather than a
  security hole — but "we clean up on touch" is only true for the paths that get touched. Right
  fix is a real sweep (a scheduled job, or an opportunistic sweep of a small number of expired
  entries on each `pair/create`). Found 2026-08-09 by the PM gate (PM-F2). Deliberately not fixed
  in the same pass as a High-severity regression, to keep that fix small enough to re-verify
  cleanly.
- **Fixing pull's silent truncation makes the latency ceiling the new failure mode** — with paging
  in place, a very large profile no longer returns a quietly short list; it now takes proportionally
  longer, and past roughly 1,600 records it would exceed the function timeout and fail outright.
  That is a strict improvement (a visible failure beats a silent wrong answer) but it means the
  pull-latency entry above is not merely a performance nicety — it is what stops a hard failure at
  scale. Raised by the PM gate 2026-08-09 (PM-F3) as a correction to how comfortably the latency
  item above was originally worded.
- **`sync-backend` has no revocation path** — if a paired device is lost, stolen, or the caregiver
  relationship ends, there is currently no way to cut that device off: it holds K (so it can
  decrypt everything) and the write token (so it can write). Real revocation means rotating both
  and re-pairing every device that should keep access, which is a genuine feature, not a patch.
  Not urgent for slice 1 (nothing is live), but it should be designed before the feature is
  offered to real users, and it belongs in the same conversation as the Formal Privacy Policy /
  lawyer review item in REQUESTS.md. Noted 2026-08-09.
- **"Welcome to ChemoWell" setup toast can briefly overlap the tour's "Daily limit" field** — during
  the guided tour's "Fill in the details" step (medication editor), the post-`completeSetup()` toast
  is still visible for its last moment or two and sits over the Daily limit field. Pre-existing
  toast-timing behavior, not caused by the 2026-08-07 tour-banner-positioning fix. Found during that
  fix's Designer review. Likely fix: either shorten the setup toast's life once the tour has started,
  or delay showing it until after the tour's first real step.
