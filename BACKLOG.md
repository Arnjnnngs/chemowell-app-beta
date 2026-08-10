# BACKLOG.md — chemowell-app-beta

Small, non-blocking things found during work that aren't worth stopping for, but shouldn't get
forgotten either (per Aaron, 2026-08-06: "if there is something that you notice is a problem or
can be an easy fix... make sure that is in the notes"). Read this at the start of any session in
this repo — it's the durable, in-repo version of a running punch list. Pull items into a real task
when you're about to touch the relevant code; delete the line once it's actually fixed and shipped.

- **🔴 BLOCKS THE NEXT RELEASE — `release_check.sh`'s CACHE hard-block is defeated by a *stale*
  `origin/main`, which is this sandbox's normal state after every push.** Found and reproduced by the
  PM gate on app-v53 (2026-08-10); the app-v53 Auditor saw the adjacent symptom (V53-8) but judged the
  CACHE block "unaffected — it fails safe." It does not. The script compares `CACHE` at `$BASE`
  against `CACHE` in the working tree. Pushes here are manual GitHub web uploads and the sandbox has
  no network, so `origin/main` is **never** fetched afterwards — one release later it points at the
  release *before* the one that is actually live. A CACHE bumped in the **previous** release then
  still reads as "bumped" against that stale base, and the script prints
  `✅ index.html changed and sw.js's CACHE constant changed with it` on a build that never bumped it.
  Reproduced exactly, on a scratch clone, never in the working repo: origin/main pinned at v52
  (`chemowell-app-v52-4`), HEAD at v53 (`chemowell-app-v53-2`), then a simulated app-v54 commit that
  changes `index.html` and leaves CACHE at `v53-2` → **exit 0, green, with the untrue success
  message.** That is the app-v40 silent-stale-cache failure back again, wearing a ✅.
  **This does not affect app-v53 itself** — at the time v53 was gated, `origin/main` genuinely was
  the live build (v52), so the v52-4 → v53-2 comparison was real, and the PM confirmed it by hand.
  The hole opens the moment v53 is uploaded. Fix options, cheapest first: (a) detect staleness —
  if `$BASE` is an ancestor of `HEAD` and more than the current release's commits behind, print a
  hard warning (or `FAIL=1`) saying the baseline may not be what is live; (b) compare `CACHE_NEW`
  against every CACHE value in `$BASE..HEAD`, not just the one at `$BASE`; (c) record the
  last-published CACHE in a committed file that the release step updates, and compare against that
  instead of against a remote ref this environment cannot refresh. **Do this before any further code
  ships**, and until it is done, verify the CACHE bump by hand against the live site as well as by
  running the script.
- **Drawer focus management is broken, and has been since app-v22** — found by the app-v54 Auditor
  and confirmed identical on the live app-v53 build, so it is pre-existing, not a v54 regression.
  Two related defects: (1) focus is never returned to the hamburger when the drawer closes
  (`index.html:2302`) — `closeDrawer()` calls `setState` first, `render()` then does
  `root.innerHTML = ''` (`:3151`), so the stored trigger element is already detached by the time
  `.focus()` runs; observed `activeElement=BODY` after Escape, X and scrim alike. (2) The Tab
  handler (`:2311-2325`) only acts when focus is exactly the first or last focusable, so once focus
  lands on `<body>` — which happens by tapping any non-focusable region of the drawer, e.g. the
  footer — Tab escapes into the app behind the scrim. Only affects keyboard and switch-access users,
  which is why it has gone unnoticed, but it makes the drawer a trap-that-isn't. Fix belongs in its
  own small release with its own gates: focus the trigger *after* the re-render (or move focus to
  the drawer panel and restore on unmount), and make the Tab handler wrap whenever focus is outside
  the drawer, not only at the two ends.
- **`release_check.sh`'s "uncommitted work" warning branch is dead code and its comment is wrong**
  (Auditor V53-6, independently re-confirmed by the PM gate on app-v53). Lines ~44-48 fire only when
  `UNCOMMITTED_INDEX` is non-empty *and* `INDEX_CHANGED` is empty, but `git diff <commit> -- index.html`
  already compares the working tree, so any uncommitted index change is in `INDEX_CHANGED` too.
  Observed: an uncommitted index change with no sw.js bump **hard-fails with exit 1**, while the
  branch's own comment promises "Not blocking (nothing is being published from the working tree)".
  The behaviour is the safe direction; the branch and comment just mislead the next reader. Delete
  the branch or rewrite the comment to describe what actually happens.
- **The `release_check.sh` executable bit may not survive a GitHub web upload.** The app-v53 fix for
  Auditor V53-5 is committed correctly (`git ls-files -s` → `100755`), but this project pushes by
  uploading files through the GitHub web UI, which is not guaranteed to preserve file mode. After the
  next push, check `git ls-tree origin/main release_check.sh` on a fresh clone; if it reads `100644`,
  TEAM.md's documented `./release_check.sh` will still fail with exit 126 for anyone starting from
  GitHub, and the mode needs setting through the API/CLI instead (`git update-index --chmod=+x`).
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
- **Switching chemo → radiation quietly takes the Treatment schedule card off Home while medications
  keyed to that date still depend on it** (Auditor V53-3, re-verified by the PM gate on app-v53).
  Not new in v53 — hiding that card is app-v52's deliberate radiation-only default — but v53's new
  Settings control is what makes a user walk into it. Verified: card present before the switch, absent
  after; the treatment date itself is fully preserved (still stored as its `chemo_date` entry, entry
  count unchanged); the Meds list still shows the medication's `Treatment day −1/+1` chip, so the rule
  stays visible; and Settings → Home screen → *Treatment schedule card* brings the card straight back.
  So it is recoverable and nothing is lost — it just isn't signposted. Cheapest fix is one clause on
  the existing toast when `key === 'radiation'` and a treatment date exists, e.g. *"Treatment updated
  to Radiation — your treatment date is kept; turn its Home card back on in Settings."*
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
