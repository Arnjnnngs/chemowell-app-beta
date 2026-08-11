# BACKLOG.md — chemowell-app-beta

Small, non-blocking things found during work that aren't worth stopping for, but shouldn't get
forgotten either (per Aaron, 2026-08-06: "if there is something that you notice is a problem or
can be an easy fix... make sure that is in the notes"). Read this at the start of any session in
this repo — it's the durable, in-repo version of a running punch list. Pull items into a real task
when you're about to touch the relevant code; delete the line once it's actually fixed and shipped.

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
- **`sym-severe` (index.html:2198) needs one oncology-nurse-level read before real users** — raised
  by the app-v55 Auditor and explicitly *not* treated as a beta blocker. It is the only entry in the
  117-topic Help centre that enumerates clinical signs ("struggling to breathe, confused, or you're
  frightened") as the trigger for calling emergency services. However lightly worded, that is a
  triage list, and it is the one line in the app where being slightly wrong costs something in both
  directions — someone calling too late, or someone learning that whatever is *not* on the list can
  wait. Every other medical-adjacent entry is safely non-clinical (no thresholds, no numbers, no
  "this is fine"). Buy the read before the App Store submission, not before the next beta push.
- **After setting a treatment date, the collapsed row still reads "Pick a date"** while the card
  directly above it already shows the date ("Tuesday, 8/25 · in 15 days"). Found while writing the
  app-v55 Help content and independently confirmed real by the Auditor, which is why `treat-set-date`
  ships with a note explaining it. Help text apologising for a UI wart is a stopgap; fix the row's
  label to reflect the set date and delete that sentence from the walkthrough at the same time.
- **The `pro-switch` Help walkthrough doesn't mention that step 3 hits a paywall** (app-v55 PM gate,
  PM-8). The Free tier caps profiles at 1, so a Free user following "how do I switch profiles"
  reaches the add-profile step and meets the upgrade sheet with no warning. The walkthrough is
  otherwise correct — it just describes the Plus/Pro path as though it were everyone's. One clause
  on that step ("the Free plan includes one profile; adding a second is a Plus or Pro feature")
  fixes it, and it is worth doing before Pro is actually sold, because a help page that walks
  someone into a paywall reads as a bait-and-switch rather than as an oversight.
- **The best remaining lever on the medical guard is not another pattern — it is the LIST reply**
  (app-v56 PM gate). Every residual leak in this release is a list of app pages, and a list carries
  no care-team wording at all, while the "I don't have an answer" reply already says the right
  thing. Adding `HELP_CARE_TEAM_LINE` to a list whose query nearly matched the guard would close the
  whole residual class at once, with copy that already shipped and no clinician needed. Worth
  designing properly rather than rushing into a release that has already had two Highs arrive in
  small post-gate changes.
- **Move `symptoms`, `morning`, `evening` and `night` from tier 1 to tier 2 of the guard's
  suppressor** (app-v56 PM gate, measured, non-blocking). `symptoms` sitting in tier 1 is the
  clearest miss — it is *the* clinical noun — and it is why *"is her morning tablet safe"* still
  returns a list. Measured by the gate: boundary leaks 7 → 5, with held-out clinical (9/86),
  held-out ordinary (3/66) and a fresh 20-question ordinary set (0/20) all unchanged. It costs
  nothing; it was left out of v56 only because the release had already had two High findings
  arrive in exactly this kind of small change made after the testers had finished.
- **On the held-out fixture, 7 of 72 medical questions still get a list of app pages, and 3 of 66
  ordinary questions are still wrongly refused** (app-v56, `test/v56-guard-heldout.mjs`). None gets
  a confident answer, which was the class that caused the PM's NO-GO. The residual leaks are
  descriptions of a person that share incidental vocabulary with an app page — *"she fainted this
  morning"*, *"he has not eaten in three days"* — and the residual refusals are app questions
  phrased about a person: *"he takes his with breakfast where does that go"*. **Do not tune the
  patterns against that file**; the moment anything is changed to make a line in it pass, it stops
  being held out and stops being worth running. Improve against the tuned set, then read the
  held-out numbers to find out whether it generalised.
- **The Designer's S1 residual was decided against and never written down** (app-v56). The user's
  own message bubble is `#A83D0F` and the primary CTA is `#BF4C1A` — 1.28:1 apart, so they remain
  confusable at a glance even though the contrast fix landed. The report's quiet-tint alternative
  would have removed the ambiguity entirely, at the cost of a less familiar chat shape. Recorded so
  it is a decision rather than an oversight.
- **A toast paints over the help panel's content** (app-v56, Lead Designer). The panel now sits at
  z51 above the toast's z50, which fixes the reported case; the inverse is that a toast raised
  during a help conversation is hidden behind the panel for its 4.5s. Cosmetic either way, and the
  chosen direction is the better of the two, but it is a trade rather than a fix.
- **The help panel's callout and the walkthrough page's are two separate components that merely
  match** (app-v56, Lead Designer). `helpBotNotice()` is panel-only; `renderHelpView`'s callout is
  still its own inline markup. They read as one component at a consistent scale, but there is no
  single shell to edit, so the next change to one will silently not apply to the other.
- **The medical guard misses 11 of 50 tuned clinical questions; they land on "I don't have an
  answer" rather than the care-team route** (app-v56, Lead Auditor's set). Examples: *"the injection
  site is red and hot"*, *"does radiation burn the skin"*, *"how do i know if its an infection"*.
  Nothing wrong is asserted — the fallback copy already says *"if it's about the treatment itself, a
  dose, or how someone is feeling, that's a question for the care team"* — but they are not routed
  to it explicitly. Closing this properly needs a symptom-noun list, which is a content decision
  that should wait for the same oncology-nurse read `sym-severe` is already waiting on. Writing one
  by guesswork is how a triage list gets into the app by the back door. **Do not tune the guard
  patterns to catch these without measuring the 35-question ordinary set at the same time** — the
  first attempt at exactly that refused 21 ordinary questions including "is my data safe".
- **The screen-reader announcer node is re-created on every reply** (`index.html`, `helpbot-announce`;
  Lead Auditor LA-3, explicitly left open). It was added to fix the transcript's `aria-live`
  container being destroyed by `render()` — and it has the same structural flaw, because it is
  inside the tree `render()` replaces. It is written *after* the rebuild, which may be enough in
  practice, but that has not been confirmed with an actual screen reader and should not be assumed.
  Needs a real assistive-technology pass, or moving the node outside `#root`.
- **The help bubble is re-focused once per second while it holds focus** (app-v56, Lead Auditor).
  `render()` restores focus by id after every rebuild, so a focused button gets a fresh `focusin`
  every tick — measured at 7 events in 6 idle seconds. No observable defect was produced, but it is
  the kind of thing a screen reader may narrate repeatedly. Same assistive-technology pass as above.
- **`BY_MEASURE` in the clinical guard has no `symptom` entry** (`index.html`, `helpBotAsk`). The
  guard can return `measure: 'symptom'`, and the map only has `temp`, `weight` and `dose`, so those
  questions take the generic care-team reply. That is the safe direction and it is deliberate —
  there is no `careLead` symptom page other than `sym-severe`, which BACKLOG already flags as
  needing a clinician read before it is surfaced more aggressively. Recorded so the gap is a
  decision rather than an oversight.
- **`renderHeader()` titles every screen with the patient's name and "Meds"** (Lead Auditor,
  incidental find) — so the Reports, Symptoms and In-Patient screens all read *"<name>'s Meds"*.
  Pre-existing, unrelated to v56, cosmetic, but wrong on four of five tabs.
- **`release_check.sh` still cannot tell whether `PUBLISHED.json` is CURRENT — only that it is
  self-consistent** (app-v55 PM gate, PM-3). The integrity check proves the recorded cache matches
  the recorded commit's own `sw.js`, which stops the record being hand-edited into passing. It
  cannot prove the record describes what is actually live, because nothing in this sandbox can
  reach GitHub. So the one remaining way to reopen the stale-baseline hole is to push and then
  forget `./mark_published.sh`. Mitigated, not closed: the gate now prints how many unrecorded
  `index.html` commits sit on top of the record and states out loud that it is assuming none of
  them are live, and TEAM.md's checklist makes `mark_published.sh` part of the push rather than a
  follow-up. A real close needs something that can observe the live site — e.g. reading
  `sw.js` from the deployed URL through Chrome during the post-push live-verify step (which
  already happens) and comparing it to the record, failing the *next* release if they disagree.
  Worth doing the next time a release is being verified in the browser anyway.
- **CONFIRMED 2026-08-11, and fixed once — the executable bit does NOT survive a GitHub web
  upload.** Predicted here before it happened; then a fetch + fast-forward brought both scripts back
  as `100644` and `./release_check.sh` died with exit 126. Both are `100755` again via
  `git update-index --chmod=+x`, and `release_check.sh` now checks its own mode and
  `mark_published.sh`'s and warns. **It will happen again on the next upload of either file** —
  there is no way to set file mode through the web UI. Leaving this line here permanently: after
  any upload that includes a `.sh`, run `git ls-files -s release_check.sh mark_published.sh` and
  re-chmod if needed. A real fix needs a push credential (API/CLI), which this session does not have.

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
