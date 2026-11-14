# BACKLOG.md — chemowell-app-beta

Small, non-blocking things found during work that aren't worth stopping for, but shouldn't get
forgotten either (per Aaron, 2026-08-06: "if there is something that you notice is a problem or
can be an easy fix... make sure that is in the notes"). Read this at the start of any session in
this repo — it's the durable, in-repo version of a running punch list. Pull items into a real task
when you're about to touch the relevant code; delete the line once it's actually fixed and shipped.

- **app-v87, after the final audit verdict.** Commit `04b8cc2` lands AFTER the sixth audit's
  clearance and changes a guard, so no auditor has seen it. Test code and `BACKLOG.md` only, and it
  implements the sixth audit's own named remedy — but the trade should be on the record: the Help
  enumeration guard's **bowel side is unchanged** (three of five values still caught), while the
  **symptom side relaxed from three to five of nine**, so a hand-typed four-of-nine list now passes
  and five is caught. The alternative went red on a correct app (`sym-severity` gaining the word
  *headache* is an ordinary edit), so the trade is right — but it is a trade, and the next person
  tightening this should know which side gave way. Found by the PM, not by an auditor.

- **app-v88 audit, ten deferrals, written here because hard rule 8 says fixed or logged.** The PM
  refused app-v88 partly for this: they existed only inside four long audit documents, which is not
  a list anybody reads. Strongest first.
  * **M19 — the `surface` component of `noteKey` is unguarded, and it was VERIFIED to reproduce a
    real defect.** Drop it and the logger's note draft collides with TODAY's row corrector, which
    renders directly beneath it: type in the logger, open Correct on today's row, tap Cancel, and
    the logger's box silently empties. One check would hold it. **The strongest of these if one
    ever gets picked up.**
  * **M20 / M15 — the `day` component is unguarded.** Without it a note typed at 23:58 and left
    unsaved belongs to a different day at 00:01. Fixed in the code; nothing proves it stays fixed.
  * **M21 — the `kind` component is unguarded**, reachable only by a future edit: bowel is
    `noteable: false`, so no bowel draft is ever written. Correct defence for the day that changes.
  * **M22 — `dailyLogBusy` back outside the `try`.** Future-only; exercising it needs a throwing
    render.
  * **M11 — renaming a control leaves the Help prose behind.** Pairs with the bolded-name sweep
    above; same fix.
  * **M1 — the appetite day-map going oldest-wins.** Still caught by `v86`, but it stopped being
    named from audit round three and is in no carry-forward list. **A finding that drops out of the
    record while its guard survives is how a guard gets deleted later as "unused".**
  * **`pickDay` / `tapDay` are fragile across a month boundary** (`test/v88-log-a-missed-day.mjs`).
    They match a day cell by `String(getDate())`, which fails loudly but confusingly on the first
    days of a month. Assert the date pill's label names the expected date.
    **MEASURED 2026-11-02, and it accounts for ALL SEVEN of that suite's failures, not one
    section.** `pickDay` (line 573) takes `want = String(target.getDate())`, finds dialog buttons
    whose text equals that number, and clicks `cells[cells.length - 1]`. The calendar draws only
    the cursor month, so on **Nov 2** "two days back" is **Oct 31** and `want` is `"31"` — a number
    November's grid does not contain. The fallback then clicks any button matching `/\d/`, which
    can be anything. **Two Rule 5 violations in six lines:** a TEXT selector where a `data-` hook
    is required, and last-match selection where an explicit hook is required. Both are named in
    Rule 5 as already-paid-for lessons.
    The date-dependence is the proof: **8 failures on Oct 31 (app-v89), 7 on Nov 2 (app-v90)**,
    with no code change in that area. A failure count that moves with the calendar is a clock
    artifact, not a regression. Sections 1/2/3 write to today instead of the day picked; **7b's
    note box is empty because it is showing a DIFFERENT day's note, and confirming then writes a
    row with `note: ""`** — which reads exactly like silent note loss and is not; 7f is the same
    thing after a day change. **That near-miss is the reason this is written down in full: a suite
    artifact that mimics data loss is one panic away from a day spent fixing a working app.**
    Fix: `data-cal-day="YYYY-MM-DD"` on every cell, select on it, navigate months until the wanted
    day is drawn. Falsify on the 1st, the 2nd and the 15th. Then re-check: any failure that
    survives is a real app defect and gets its own task.
  * **`test/v75-no-other-patient.mjs` reads the repo from disk and ignores `FALSIFY_BASE`.** An
    auditor's first falsification of the pronoun ratchet reported the same count for a +1 and a −1
    mutant and looked like a dead ratchet when it was a harness that never reached the mutated
    file. Re-run in a copied tree it is correct both ways. **Worth one line in the suite so nobody
    repeats it.**
  * **7g's `'reopened'` escape** — closed in the code, recorded because the class is not: a
    precondition that tolerates *"I did not do the thing"* passes for the wrong reason.
  * **Two instruments disagree about overflow and nobody noticed.** `overflow-scan` reports three
    overflows on Home at 320px — proven pre-existing against app-v87's published file — while the
    last two Designer passes recorded *"overflow — clean"*. One of them is wrong and it is not
    known which. **A pass that says clean while a committed suite says otherwise is a false
    reassurance in the record**, which is worse than no pass.

- **app-v87 audit, DEFERRED DELIBERATELY — the sixth Help surface.** `renderHelpView()`
  (`index.html` ~10022-10252) is the only `renderHelp*` function and it writes **eight prose
  literals straight into the DOM**. None is in any of the five data arrays `__v86Test.helpProse()`
  returns, so none is read by the app-v87 Help ratchets. The substantial one is the **standing
  safety notice on the Help SEARCH screen** — the screen whose own comment says it exists *"so
  that whatever this list says, the one true sentence is above it"*. Measured: a false claim
  appended to that notice is read by a caregiver who searches `diarrhea`, and scores 64/64 with
  v55-help green. The others are the empty-results hint (itself a hand-typed enumeration), the
  landing caption, the walkthrough privacy footer, the three `careHeading` values and the section
  labels. **The surface is clean today** — all eight re-read, none makes a claim about a control.
  **Widening the hook again cannot close this**: the hook lists DATA SOURCES and the renderer is
  not one, so a ninth literal arrives the next time somebody types a sentence into it. The version
  with no next surface reads the rendered screen: section 7c already drives the Help UI, so it can
  walk landing → category → topic plus the search screen, scrape `innerText`, and apply the
  existing rules to that. Minor, same area: `HELP_POINTERS` rows are mapped with `body: ''`, so a
  pointer that ever gains a description is unread. **Pairs with the next item — one "hold Help to
  what the app renders" pass, not two.**
- **app-v87, found by sweep.** Every `**bolded**` control name in Help, checked against the rest of
  the file: **134 distinct, 40 appearing nowhere else** by exact match, **5** by substring — so the
  real number is between the two and most of the 40 is matching artefact. The five unmatched by
  substring are all emphasis sentences (*"Contact the care team now."*, *"Tap this one first"*) and
  name no control. This sweep is how the **fifth** Help/control mismatch of app-v87 was found
  (`**Bowel movements**` against a tile labelled `**Bowel Movement**`), after three independent
  audits read past it. Make it a ratchet rather than a triage: exact, then substring, then a
  declared allow-list for the phone's own settings and for emphasis; the triage falls out of the
  first run. It must read the RENDERED screen, per the item above.

- **app-v86 audit.** The in-app History list still shows a corrected bowel/appetite answer and the
  answer it replaced as two rows at the same minute, unmarked. The CSV and the printed report mark
  them; the on-screen list does not. Nothing untrue is said — the changelog scopes its claim to the
  export and the report, and the Reports screen states the current value — but the two surfaces
  disagree in presentation.
- **app-v86 audit.** `isSupersededEntry` is quadratic over the export: measured +44ms at 2,190
  entries, +318ms at 6,570 and +1,232ms at 13,140 on desktop Chromium. Correct, and invisible at
  realistic sizes today, but it runs once per row over every row. A per-day index built once would
  make it linear.
- **app-v86 audit, not fixed in that release.** `submitBowelMovement` / `submitAppetite` are dead
  code — nothing calls either, and both still carry the delete-then-relog correction pattern this
  project has shipped and had to undo twice. Delete them before somebody wires one up.
- **app-v86 audit.** Settings can show two "Patient name" inputs at once — the rename field and the
  add-profile field render independently. Opening one should close the other.
- **app-v86 audit.** The rename field renders below the whole profile list rather than inside the
  row it edits. Fine with one profile; visually detached with two or three. Worth moving into the
  row when rename grows to cover non-active profiles.
- **app-v86.** `renameActiveProfile` deliberately renames only the ACTIVE profile, because renaming
  another means writing into that profile's own prefs blob from here and cross-profile writes are
  what broke reminders in app-v85. To rename another profile you switch to it first, and the copy
  says so. Worth revisiting with a safe cross-profile write.

- **app-v85, F2 — `test/v85-profile-reminders.mjs` promises about six pages what it watches on one.**
  `pageerror` is attached to the first `newPage()` only (line 40), and the suite opens six (37, 205,
  301, 330, 380, 427). The check it feeds says *"no page error at any point above"* — a claim about all
  six, backed by one. Measured by the delta-5 audit: a real uncaught throw on section 6d's page still
  printed "none". Pre-existing, nothing in the record depends on it, and a fatal error would fail that
  page's own card assertions anyway — but it is the same shape as the sentence this very release exists
  to fix, one level up, so it goes first. One line: `ctx.on('page', p => p.on('pageerror', e => thrown.push(String(e))))`.

- **app-v85, F1 — the check that reads this suite's figure out of README.md still types one number.**
  Section 8 computes `pass + fail + 1`, the offset being itself, and it is the last check in the file.
  Append anything below it and the README figure is wrong while the check stays green (measured: 44
  checks, 44 passed, README says 43). Strictly better than the `+2` it replaced, which had this hole
  AND the deletion hole it was written to close — but the residue is real. Fix: make the comparison
  uncounted (set `process.exitCode = 1` and print, instead of a `t()`), and the offset disappears.

- **app-v85, M7 — `deleteProfile()` refuses to delete the ACTIVE profile, and nothing tests that.**
  Correct today, and the guard sits above the new `cancelRemindersForProfile(id)` call so the new code
  cannot disarm the profile you are in. Untested since the delta-2 audit raised it. One line of
  coverage: call `deleteProfile(activeId)` and assert it is still there.

- **app-v85, Voice — "set its reminders up again" implies a before that may never have happened.**
  The Settings scope line tells the caregiver to open the other profile *"to set its reminders up
  again"*. For a profile that has never been opened there was no first time. Raised by the PM gate as
  non-blocking and true in the common case (the bug destroyed reminders that DID exist). Worth a word
  when stage 2 rewrites that sentence anyway.

- **`HANDOFF.md` is four releases stale** — it names app-v80 as the live build, last touched at
  `ffc7bff`. No repo rule requires it to move with a release, which is exactly why it drifted. Either
  refresh it or make `release_check.sh` require it, but do not leave it saying something untrue.

- **The APK is published to a Release tagged `app-v14-native-test`**, named *"ChemoWell native test
  build (app-v14)"*. That is the page Aaron downloads from, and it names a version seventy-one
  releases stale. Raised by the delta-3 audit; unrelated to any release it was found in.

- **PM RULING, app-v66 gate, 2026-08-24 — the four-profile sweep runs on the next release that
  touches application code, however small it looks.** It has now been skipped three times running
  (audit round 1, audit round 2, and the PM itself), defensibly each time because none of those
  releases touched dose, schedule or storage logic. Three in a row is how a habit forms. This is a
  standing instruction from the gate that has authority to set it, not a suggestion.

- **PM RULING — the Help search results screen is the NEXT release, with the Designer stage.** The
  regression below may stay open through app-v66 (it is not a safety failure; the care-team sentence
  and the one-tap `sym-severe` route are both present and were verified) but it binds the next one.

- **app-v58 quietly undid two of the v57 Designer's fixes to the Help search results screen, and the
  test guarding them has been red for NINE releases (v58 -> v66).** Found by the round-2 Zero Day
  Auditor while running the twenty browser suites that nothing runs automatically. Two regressions at
  `index.html:6982` and `:6994-6998`: the care-team strip lost its own surface colour (`#FFFBF5` in
  app-v57 -> `#FFFFFF` now), so it reads as the first search result instead of an aside; and the
  results count line moved from inside `listCard()` above the rows back out to a standalone `section`
  **after** all twelve rows — the exact defect v57 fixed. Bisected by colour count in `index.html`:
  3 at `32b297f` (v57), 1 at `9155fd3` (v58), 1 today. Measured: the strip is **216px at 360px wide
  and 235px at 320px** against a 200px bar, leaving the first result row **21px visible** above the
  bottom nav at 320px. **This is NOT a safety failure** — the care-team sentence and the one-tap
  `sym-severe` route are both present, so `V57-1` passing is honest. It is the 17 failures in
  `test/v57-browser-notice.mjs` already logged in care-tracker's REQUESTS.md, now with a cause and a
  commit. Needs a design pass plus rule 5's gates; sized as its own release.

- **NOTHING RUNS THESE SUITES, and that is the mechanism behind both nine-release blind spots.**
  `npm test` is a stub that exits 1, `release_check.sh` runs no suites, and `.github/workflows/
  android-build.yml` runs none either. Twenty browser suites exist and are only ever run when
  somebody remembers to. `V57-1` sat red for eight releases and the layout regressions above for
  nine, both silently. A runner script that executes every suite and exits non-zero on any failure is
  the single highest-value fix on this list — it is what would have caught both on the day they
  landed. Note `test/v57-browser-notice.mjs` needs a server on port 8899 that it does not start
  itself; the runner must start and stop it.

- **`test/audit-v55b.mjs` cannot start at all** — it reads `/tmp/topics.js`, a path from the retired
  sandbox. Same class as the 39 hardcoded playwright paths fixed in app-v66: a gate that cannot start
  is indistinguishable from a gate that passes.

- **`audit-v55.mjs`, `pm-v55.mjs` and `pm-v55b.mjs` pin a stale topic count (133, actual 135).** The
  pinned-literal anti-pattern again. They should read the count from the corpus under test. Separately
  `audit-v55`'s `A6` ("0 chips followed") and `B8` are NOT count pins, so one of them may be a real
  finding — worth ten minutes.

- **All three apps on `arnjnnngs.github.io` evict each other's offline cache.** Each service worker
  deletes every cache on the origin that is not its own (`chemowell-app-beta/sw.js:20` and the same
  handler in the other two). Real consequence is small and self-healing: one "can't load" screen if
  someone opens an evicted app while offline, cleared by a single online visit. **No logged data can
  be lost** — entries live in `localStorage`, which Cache Storage eviction cannot touch. One-line fix:
  scope the filter to `k.startsWith('<this-app-prefix>-')`. Round 1 of the audit rated this MAJOR and
  said network-first made it worse; round 2 measured it and found the opposite — network-first
  re-caches on every successful navigation, so it is the only variant that self-heals.

- **The app-v66 spelling cross-check can be defeated by a deliberately escaped alias** (`"lit\u0072es"`
  in the keywords array frees a raw count that can then be spent on a visible "Litres"). Contrived —
  it requires someone to escape a keyword on purpose — and explicitly not a reason to distrust the
  gate against anything a person would plausibly write. Recorded so it is not rediscovered as news.

- **A four-profile sweep has now been skipped by two consecutive audits.** Defensible both times
  (neither release touched dose, schedule or storage logic) but it should not become three.

- **The sandbox filesystem silently rolled back mid-session for the SECOND time, and this one could
  have overwritten a good live build with a regressed one** (app-v57, after the push). Symptom: local
  `HEAD` had quietly moved back to the gate-round-2 commit, `index.html` was 733,357 bytes against
  the 736,834 on `origin/main`, and every Designer round-2 fix — the shortened care-team strip, the
  suppressed first-run toast, `toastNeedsLift`, `careTone`, the 560px caps — was **absent locally
  and present on origin**. The working tree looked healthy and `git status` was clean; nothing
  announced the loss. A stop-hook nudge to "push these commits" is what surfaced it, and pushing
  local over origin at that moment would have reverted a PM-signed-off, live-verified release.
  **The recovery is not the interesting part; the detection is.** Content on GitHub was correct
  throughout — the live app was never at risk from the rollback itself, only from a reflexive push.
  Recovered by preserving the local-only files outside the repo, branching the stale commits to
  `v57-local-before-rollback`, then `git checkout -B main origin/main` — deliberately NOT
  `git reset --hard`, which is banned in this repo for having destroyed agent reports twice.
  All four suites green afterwards and the tree digest matches origin exactly.
  **Standing rule from now on:** before pushing, and before trusting any local measurement after a
  gap in the session, compare
  `git ls-tree -r HEAD --format='%(objectname) %(path)' | sort | sha256sum` against the same command
  on `origin/main`. If they differ and you did not just make a change, assume the sandbox rolled
  back and re-derive from origin — never the other way round. This is the same class of trap as the
  stray `http.server` on a shared port that served a different directory earlier in this release:
  **the environment can lie about what you are looking at, and the only defence is a digest.**
- **The executable bit on the three `.sh` files does not survive a GitHub web upload, and app-v57's
  "fix" for it did not actually reach the remote** (app-v57, found at push time). The Auditor's
  V57-6 asked for `release_check.sh`, `mark_published.sh` and `.github/scripts/android_smoke_test.sh`
  to be committed `100755` rather than `100644`. They were, locally, and the PM verified it locally
  — but pushes in this environment are manual GitHub **web uploads**, and the web upload API has no
  way to set a file mode. After the v57 push the local tree and `origin/main` are byte-identical in
  content (verified by tree digest) and differ **only** in those three modes, which are still 644 on
  the remote. So V57-6 is closed locally and open on GitHub, and this note exists so the next person
  does not re-close it from a local `git ls-files -s` and believe it.
  **This is the third time this has bitten** (see the earlier entry about a fetch + fast-forward
  bringing both scripts back). It is low-impact in practice — every call site in TEAM.md and in this
  project's own docs invokes them as `bash release_check.sh`, which ignores the bit entirely — but
  the CI workflow that runs `android_smoke_test.sh` directly would exit 126. **The only real fix is
  a push path that can carry a mode**, i.e. a working `git push`. **Attempted at the end of the
  app-v57 push, and the proxy's actual error is now on record and is ACTIONABLE — it is not a
  generic 403:**

  > `remote: access denied by the git proxy: Arnjnnngs/chemowell-app-beta is not in this session's`
  > `authorized repository set, so the proxy will not inject a credential for it. To fix, add the`
  > `repository to the session's sources.`

  So this was never a network limitation, and the note elsewhere in this file that once called it
  "no network" was wrong twice over. **`git push` is blocked purely because the repo is not in the
  session's authorized source list** — a configuration Aaron can change when starting a session,
  not a sandbox constraint anyone has to engineer around. If `chemowell-app-beta` (and
  `chemowell-beta`) are added as sources, the entire manual web-upload apparatus goes away: no
  batching, no per-file mode loss, no risk of a half-landed push, and `release_check.sh` can trust
  `origin/main` directly instead of needing `PUBLISHED.json` as a stand-in baseline.
  **This is the single highest-leverage piece of setup available on this project. Try it first
  next session.**
- **`test/v55-help.mjs`'s "every careLead topic is also flagged medical" check cannot fail**
  (app-v57 PM gate, **PM-1**, proven by a full-suite mutation run, not inferred). Same lazy
  multiline-regex class as the Auditor's R2-C, sitting three lines below the per-line fix R2-C
  prompted: `[\s\S]*?` expands from the FIRST topic in the block, so each captured chunk spans
  intervening topics and borrows somebody else's `medical: true`. The PM flagged `log-double-tap`
  careLead-without-medical and the whole suite still printed ALL GREEN; 6 of 9 candidate positions
  go undetected. Worse, this release's own new page `sym-medical-question` is exempt from the regex
  entirely, because its object ends `careTone: "calm" }` rather than `careLead: true }` — the newest
  and most safety-adjacent page in the corpus is not checked at all. **Why it matters if the
  invariant is ever violated:** `careCallout` renders on `topic.medical` and the answer body renders
  on `(!topic.careLead && topic.a)`, so a careLead page WITHOUT medical renders neither — the page
  ships with its entire answer text missing. The code is correct today (all five carry both); only
  the guard is hollow. Fix: match per line, exactly as the `careTone` check two lines above now
  does. **Deliberately held for the next release's first commit** so nothing about the app-v57
  shipping build changed after the PM signed off.
- **The care-team coverage floor measures 4 rows while the phone shows 2** (app-v57 PM gate,
  **PM-2**). `test/v57-search.mjs` reads the top 4, which was the Auditor's V57-2 correction — but
  the V57-1 fix put a ~175-194px strip above the results, so after it the phone shows **2 rows at
  360 and 1 at 320**. V57-2 has effectively been reintroduced by the fix for V57-1. Measured: top-2
  is 15/50 against the floored top-4's 20/50. The comment calls the choice conservative in the safe
  direction; it is the opposite. Not a behaviour defect — the unconditional strip is the safety
  property and it is asserted in the rendered UI — but the supporting metric currently overstates
  itself. Held for the next release's first commit, same reason as PM-1.
- **The Help results screen has no heading element at all** (app-v57 PM gate, **PM-4**, Low,
  non-visual). Removing the duplicated "Search help" H1 to buy the clearance R2D-1 needed at 320px
  also removed the view's only `<h1>` on that screen, since `pageHead()` is the sole emitter. The
  eyebrow that remains is a `<span>`. One line to fix by promoting the eyebrow's text node; no
  visual change. Held for the next release's first commit.
- **The deep-linked help page's back row points somewhere the reader has never been** (app-v57
  Designer round 2, **R2D-7**). Tapping "More about the web version" on Home lands on
  `rem-web-vs-app` with a back row reading "← Reminders & notifications" — the person came from
  Home, not from that category, so "back" is an invitation into a section they did not ask for.
  Everything works and the bottom nav is always present, so it is orientation rather than a trap.
  **Not fixed in v57 on purpose:** the fix is to make the back row depend on where `state.help` was
  set from, which introduces entry-point state into a component that currently has none. That is a
  design decision worth taking deliberately rather than inside a fix pass.
- **The care-team strip's button label wraps to two lines at every phone width** (app-v57 Designer
  round 2, **R2D-8**, recorded as a known state rather than a request). "When to call the care team
  straight away" is 2 × 16.9px of line box inside its 44px target at 320/360/390, one line at 768.
  It fits, and the wording is the Auditor's R2-G fix — "when to contact them" had no antecedent if
  the button was read alone. If a one-line label at 390 is ever wanted, the Designer's measured
  alternative is "When to call the care team now" (30 chars). Left alone in v57 because two
  reviewers have now approved this exact sentence and it is read while someone decides whether to
  phone.
- **Help search has no "show more", so a page ranked 13 or lower is unreachable through search**
  (app-v57 Auditor round 2). The v57 cap shows the closest 12 and the count line now states the true
  total honestly ("The closest 12 of 28 matches"), so nothing is hidden silently — but there is no
  way to page past 12 other than typing a narrower query. Fine for a 133-page corpus where the
  fixture puts an acceptable page first 53 times out of 53; worth revisiting if the corpus grows.
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
  **CLOSED app-v57 — done, and in a stronger form than this item proposed. The guard is gone with the bubble; `HELP_CARE_TEAM_LINE` now sits above EVERY search-results screen, not only the ones a classifier judged to be near-misses. Deciding which queries are the frightening ones is the classifier that failed twice in v56, so v57 stopped trying.**
- **Move `symptoms`, `morning`, `evening` and `night` from tier 1 to tier 2 of the guard's
  suppressor** (app-v56 PM gate, measured, non-blocking). `symptoms` sitting in tier 1 is the
  clearest miss — it is *the* clinical noun — and it is why *"is her morning tablet safe"* still
  returns a list. Measured by the gate: boundary leaks 7 → 5, with held-out clinical (9/86),
  held-out ordinary (3/66) and a fresh 20-question ordinary set (0/20) all unchanged. It costs
  nothing; it was left out of v56 only because the release had already had two High findings
  arrive in exactly this kind of small change made after the testers had finished.
  **CLOSED app-v57 — the guard and its two-tier suppressor were deleted with the help bubble. Nothing to move.**
- **On the held-out fixture, 7 of 72 medical questions still get a list of app pages, and 3 of 66
  ordinary questions are still wrongly refused** (app-v56, `test/v56-guard-heldout.mjs`). None gets
  a confident answer, which was the class that caused the PM's NO-GO. The residual leaks are
  descriptions of a person that share incidental vocabulary with an app page — *"she fainted this
  morning"*, *"he has not eaten in three days"* — and the residual refusals are app questions
  phrased about a person: *"he takes his with breakfast where does that go"*. **Do not tune the
  patterns against that file**; the moment anything is changed to make a line in it pass, it stops
  being held out and stops being worth running. Improve against the tuned set, then read the
  held-out numbers to find out whether it generalised.
  **CLOSED app-v57, but the observation was re-pointed rather than dropped. The guard and `test/v56-guard-heldout.mjs` are deleted with the help bubble, so the numbers above no longer describe anything. What survives is the underlying fact: a clinical question typed into the SEARCH BOX still returns a list of app pages, and after the Auditor measured that v55 returned nothing for 49 of 50 such questions while the v56 matcher returns a list for 45 of 50, that is now understood as a v56 regression on an unaudited path rather than residual guard leakage. v57's answer is not a better classifier: the care-team sentence and a one-tap route to `sym-severe` sit above every results screen unconditionally, and the coverage floor in `test/v57-search.mjs` measures the four rows a phone actually shows.**
- **The Designer's S1 residual was decided against and never written down** (app-v56). The user's
  own message bubble is `#A83D0F` and the primary CTA is `#BF4C1A` — 1.28:1 apart, so they remain
  confusable at a glance even though the contrast fix landed. The report's quiet-tint alternative
  would have removed the ambiguity entirely, at the cost of a less familiar chat shape. Recorded so
  it is a decision rather than an oversight.
- **A toast paints over the help panel's content** (app-v56, Lead Designer). The panel now sits at
  z51 above the toast's z50, which fixes the reported case; the inverse is that a toast raised
  during a help conversation is hidden behind the panel for its 4.5s. Cosmetic either way, and the
  chosen direction is the better of the two, but it is a trade rather than a fix.
  **CLOSED app-v57 — the panel is gone. The toast's own collision with the Back-to-reports pill, which this release's Designer found, is fixed separately.**
- **The help panel's callout and the walkthrough page's are two separate components that merely
  match** (app-v56, Lead Designer). `helpBotNotice()` is panel-only; `renderHelpView`'s callout is
  still its own inline markup. They read as one component at a consistent scale, but there is no
  single shell to edit, so the next change to one will silently not apply to the other.
  **CLOSED app-v57 — `helpBotNotice()` is deleted; only the walkthrough page's callout remains, so there is nothing left to diverge.**
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
  **CLOSED app-v57 — the guard is deleted with the bubble. The property that replaced it is measured in `test/v57-search.mjs`: a care-team page must appear in the four rows a phone actually shows, for at least 18 of those same 50 questions.**
- **The screen-reader announcer node is re-created on every reply** (`index.html`, `helpbot-announce`;
  Lead Auditor LA-3, explicitly left open). It was added to fix the transcript's `aria-live`
  container being destroyed by `render()` — and it has the same structural flaw, because it is
  inside the tree `render()` replaces. It is written *after* the rebuild, which may be enough in
  practice, but that has not been confirmed with an actual screen reader and should not be assumed.
  Needs a real assistive-technology pass, or moving the node outside `#root`.
  **CLOSED app-v57 — `helpbot-announce` no longer exists.**
- **The help bubble is re-focused once per second while it holds focus** (app-v56, Lead Auditor).
  `render()` restores focus by id after every rebuild, so a focused button gets a fresh `focusin`
  every tick — measured at 7 events in 6 idle seconds. No observable defect was produced, but it is
  the kind of thing a screen reader may narrate repeatedly. Same assistive-technology pass as above.
  **CLOSED app-v57 — the bubble is deleted.**
- **`BY_MEASURE` in the clinical guard has no `symptom` entry** (`index.html`, `helpBotAsk`). The
  guard can return `measure: 'symptom'`, and the map only has `temp`, `weight` and `dose`, so those
  questions take the generic care-team reply. That is the safe direction and it is deliberate —
  there is no `careLead` symptom page other than `sym-severe`, which BACKLOG already flags as
  needing a clinician read before it is surfaced more aggressively. Recorded so the gap is a
  decision rather than an oversight.
  **CLOSED app-v57 — `helpBotAsk` and `BY_MEASURE` are deleted.**
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

## From the app-v71 Zero Day Audit (2026-09-06) — found, not fixed, recorded so they are not lost

- **A paracentesis with no `loggedAt` and a future `ts` cannot be deleted, and the app says it was.**
  The tombstone is stamped `loggedAt: Date.now()`, which loses `paraSupersedes()` to the future `ts`,
  so the row stays on screen while the toast reads *"Paracentesis removed."* **Pre-existing —
  identical on untouched app-v70**, neither introduced nor widened by v71. Worth its own small
  release: a lie about a deletion in a medical record is the kind of thing that gets believed.
- **The floating "Back" pill clips the last Radiation row's Remove button by about 71×8px at 360.**
  Already true at 320px on v70; v71's add row pushed the list down far enough to reach 360 too. It
  fails the safe way — a stray thumb hits Back, not a destructive control — but the fix is the same
  tail-room the sibling app added to its report detail.
- **"Total drained · 17.0 L" fails the same test the average failed.** A lifetime cumulative sum of
  volumes that each depend on elapsed time, monotonically increasing, inviting *"she's had seventeen
  liters taken off."* The auditor's proposal, and it is **Aaron's call, not the team's** — he asked
  for the average removed, not this. **"Procedures · 2" should stay**: how often a drain is needed is
  a real ascites signal.
- **Weight can now ADD but still cannot EDIT or REMOVE.** The ALL READINGS rows carry no controls at
  all, so a mistyped `1156.2` distorts the trend permanently from that screen. **This is the exact
  inverse of the Paracentesis defect v71 just fixed** — and the Enhancer walked that screen while
  adding the add row and did not notice, which is the same blind spot recorded in TEAM.md.

### Two gaps in the v71 SUITE itself, recorded because they were written nowhere at all

The PM gate found these missing from every file — the audit had raised them and they existed only
inside an agent's report, which does not survive a session.

- **S7 — nothing checks the `loggedAt: Math.max(Date.now(), prev + 1)` guard.** Replace it with a
  bare `Date.now()` and `test/v71-report-controls.mjs` stays green. That guard is the whole reason a
  paracentesis edit still works on a legacy record with no `loggedAt` or one dated in the future;
  right now it is load-bearing and unguarded. Needs a fixture with a future-dated record.
- **S6 — the suite can crash mid-run and silently shorten its own coverage.** It reports only the
  checks it reached, so a crash after check 9 looks like a shorter, passing run rather than a
  failure. The same shape as the "a suite that cannot start looks exactly like a suite that passes"
  trap hit twice on this project in one day. It needs an expected-check-count assertion at the end.

## The medication purpose table needs a periodic clinical re-read (app-v72, 2026-09-08)

app-v72 ships 42 short sentences saying what each medication is generally for. Two guards hold the
line automatically — no digits, no schedule words, no dosage form, no fever clause — but **no check
can tell whether a sentence is clinically WRONG**, and the audit found two that were:

- `lidocaine` was described as "a numbing cream", which is false for the viscous rinse used for chemo
  mouth sores and false for the patch. In an app where every medication is one the user typed, the
  name says nothing about the form.
- Every entry that mentioned fever was removed, because a fever during treatment is a thing to
  report rather than suppress.

Both were caught by a person reading the table, not by a gate. **Re-read the whole table whenever an
entry is added, and treat "is this true for every form of this drug?" as the question that matters** —
a wrong line on the right medication is worse than no line at all, because it ships under a
disclaimer promising general information about the drug.

The header's plan to refresh the table to exact federal label wording carries the same risk in
reverse: federal wording says "reduces fever". The suite's fever guard is what stops that refresh
quietly undoing this release's safety decision.

---

## The MedlinePlus table: how to refresh it, and what to check when you do (app-v75)

The 33 quoted descriptions in `tools/med-source-table.json` are **generated, not written**. Do not
edit that file by hand: `t` is quoted verbatim from `u`, and editing the words turns the citation
under them into a false one.

**To refresh it:** push any commit to the branch `run/refresh-meds`. The workflow
`.github/workflows/refresh-med-table.yml` fetches every drug in `tools/med-list.json` from
MedlinePlus, applies the guards, runs `test/v75-table-builder.mjs`, and pushes the result to
`chore/refresh-med-table` along with `tools/last-run/` — the fetch log, the raw pages, and
`report.md`, which lists every sentence that was REJECTED and why. **Read report.md before pulling
the table across.** It is the interesting half.

There is a `workflow_dispatch` button too, but the assistant that maintains this repo cannot press
it: dispatching needs an Actions:write permission its GitHub App does not have. The push trigger
exists so nobody has to ask Aaron to press anything.

**The warning at the top of this section applies with more force here, not less.** The paragraph
above about fever and dosage forms was written about the hand-written table, where a person chose
every word. These lines come from a machine reading a web page, so:

- **A green run with an empty or shrunken table is the dangerous outcome, not a red one.** It has
  happened: a host check rejected its own resolver's output, threw away all 46 pages, and the run
  finished green having produced nothing. `test/v75-table-builder.mjs` section 12 now refuses a
  table that is empty or has collapsed below 25 entries.
- **Every guard is a ban except one.** The on-topic guard is a REQUIREMENT — the sentence must say
  what the drug is used to do. It exists because MedlinePlus's real answer for dexamethasone
  ("a corticosteroid, is similar to a natural hormone produced by your adrenal glands") passed all
  six bans while answering a different question than the card asks.
- **The count going UP is worth as much scrutiny as it going down.** More kept entries can mean
  MedlinePlus improved its pages, or it can mean a guard stopped working.
- **A sentence can be true, safe, and still wrong for this patient.** MedlinePlus answers for the
  drug's primary indication, which is not always the reason a chemotherapy patient is taking it.
  Read every new line against "why would SHE be on this?" before it ships.

## A grouped ceiling counts only one medication, and nothing on screen says so

**Found by the app-v84 audit, 2026-09-15. NOT reachable through the product today, which is the
only reason it is here rather than in the release.**

`dailyCeiling()` returns `group: false` on the `ceilingUnit` (pills) branch, so a grouped
pills-unit medication counts only ITSELF against a limit that is meant to be shared — and the bar
draws no "shared with other medications" line, because that line keys off the same flag. The figure
is wrong and silent about being wrong.

**Why it is not a block:** `ceilingGroup` is never assigned anywhere in `index.html`. No user can
create a grouped medication of any unit, so nobody can be shown the number. It is unreachable
through the product, not merely rare.

**When it becomes a block: the release that makes `ceilingGroup` settable.** Whoever builds that
feature needs to fix this in the same change, or the first grouped pills medication a user creates
will under-count a shared safety limit. Same for `rollingCeilingH`, which is also never assigned —
four call sites now read `dailyCeiling().windowH` rather than the raw flag, and they are correct,
but none of them has ever run.

## The Meds reorder arrows are 40x40, under the 44px touch target

**Found by the app-v84 audit's width pass, 2026-09-15. Pre-existing, width-independent, and NOT
caused by that release.**

The up/down arrows that set Home's card order measure 40x40 at 320, 360 and 390. The rest of the
app holds a 44px floor, and this file's own notes cite that floor repeatedly. Two of them sit
directly above and below each other, which is the arrangement where an undersized target is most
likely to be mis-tapped into the wrong one.

Logged rather than fixed so it is a deliberate decision and not re-found by a third audit.

## The ceiling override prompt recomputes a label `status()` has already decided

**Found by the app-v84 delta audit, 2026-09-15. Unreachable today; a one-line change when it is
touched next.**

`renderToday()`'s red override prompt decides between *"Up to the <label> reached"* and *"Daily
limit of <label> reached"* by asking `dailyCeiling(med).windowH`, and `status()` decides whether to
lock by asking the same thing. They agree in every reachable case — the auditor enumerated
`ceilingUnit`, `ceilingGroup`, rolling and a null ceiling — with one residual: **the volume-cap
path**, where the two would disagree. It cannot happen, because `volumeCeilingMl` is never assigned
anywhere in the file, exactly like `ceilingGroup` and `rollingCeilingH` above.

**The real fix is not another comparison, it is deleting the second opinion:** have the prompt read
`st.ceilingLabel` off the status object rather than recomputing the label from the medication. Two
pieces of code answering "which kind of limit is this" is the shape that produced the original
defect — a screen and a lock disagreeing inside one tap — and it is still that shape, just with the
two answers currently matching.

**When it becomes a block: the release that makes any of `volumeCeilingMl`, `ceilingGroup` or
`rollingCeilingH` settable.**

## iOS: the focus nudge is guarded by gesture now, and nobody here can test the keyboard

**Not a defect. A named risk with an owner, recorded so the next person does not re-litigate it.**

The v28 `focusin` nudge (bring a focused field into view, written because an opening on-screen
keyboard can leave it hidden) is skipped when a `wheel` or `touchmove` happened after focus landed.
That is deliberately a question about CAUSE: the first version compared scroll positions with an
8px tolerance, and the audit was right that an effect-based guard can mistake iOS's own
viewport movement for a swipe and switch v28 off on the platform it was written for.

A keyboard opening is not a wheel or a touchmove, so the gesture version cannot make that mistake —
but **this sandbox is Chromium with no on-screen keyboard and cannot prove it.** Item on Aaron's
phone checklist every release until it has been seen once: *open the medication editor on the
iPhone, tap a field low down the form, and confirm the keyboard does not leave it hidden.*

---

## app-v89 — the Enhancer pass, and one store blocker it found

Everything below is PROPOSED. Nothing was built in app-v89 beyond the pricing change itself.
Full write-up: `outputs/ENHANCER-app-v89.md`.

### M20 — **No "Restore purchases" control. This is a store blocker.** (M, blocked on #31)

A person who buys Plus, changes phone and reinstalls **cannot get their purchase back**. The only
route to a non-free tier in the app today is the `TEST_MODE` reset button, which does not exist in a
store build. **Apple requires a restore control; Google expects one.** It belongs with Play Billing
(#31) and must not be allowed to arrive after it — an app that takes money and cannot return the
entitlement is the kind of thing a store review rejects and a customer writes a one-star review
about.

### M21 — The tier pill should count people, not name a plan (S)

Account and Profiles both show a pill reading `Free plan`. With every feature free, that badge tells
the reader nothing except that they have not paid — and Aaron's whole decision here is that free must
not feel like a penalty. `1 of 1 person` says the only thing the plan still governs, and makes the
upgrade legible at the moment it would actually matter.

### M22 — No way back down a tier, and Help does not say so (S, Help only)

Buying Pro when Plus was meant is unwindable only by the beta reset button. Store purchases are
refunded through the store rather than the app, which is correct — but Help should say it, so nobody
hunts for a control that should not exist.

### M23 — The plans sheet is reachable only from Profiles (S)

Both "View plans" buttons live on profile screens. Someone wondering what the app costs before
committing their records to it has no path to the answer from Home, Settings or About.

### M24 — What's New stacks above the plans sheet (S, pre-existing)

Noticed during the Designer pass, not charged to app-v89 and not introduced by it: the update notice
renders over an open plans sheet. Only reachable by opening the sheet without dismissing an update
notice first. Worth looking at when the stacking order is next touched.

### M25 — `release_check.sh`: the chain gate still hides code problems underneath it (M)

**Half-fixed in app-v89, and the other half is deliberately not attempted inside a release this
script is gating.** The gate fails in two ways: most checks set a flag and carry on, so one run
surfaces every problem of that kind; a handful call `exit 1` on the spot. Both used to print one
red line and exit 1, so an operator reading the second kind believed they had the complete list,
fixed the one thing, re-ran, and met the next failure — serially, one release-blocking item per
run, each looking like the last.

app-v89 made the difference **visible**: an early stop now prints `⛔ STOPPED EARLY — the checks
after this point did NOT run`, and an accumulating run ends with every failure listed together.

What remains: the **Quality Chain gate** — the check that an independent `AUDIT*` report and `PM*`
sign-off exist for this version — stops the run, which is the normal mid-release state. So a
missing audit report hides the delete ratchet, the 16px floor, the README-row check and
`v75-no-other-patient` underneath it. The fix is to run the independent code checks regardless of
chain state and report everything at the end, which is a restructure of a 790-line script. The
four prerequisite stops (unresolvable baseline, unparseable `CACHE`) must **stay** hard: a gate
that claims to have checked something it could not is the failure that rule exists for.

### M26 — Mutant servers are leaked, and the next run inherits the mess (S)

Found twice in one release, once by each auditor. Falsification rounds start
`python3 -m http.server <port>` per mutant and nothing stops them. By the end of app-v89 **38
abandoned servers held ports 8891–8928**, so a later round's servers never bound — and that round
read the *previous* mutant's bytes, which looks exactly like a check that cannot fail. One auditor
nearly reported four bogus escapes on the strength of it.

The md5 comparison added in app-v89 catches it after the fact. What is missing is not leaking them
in the first place: a helper that allocates a free port, serves a directory, and kills the server
on exit, used by every falsification round instead of a hand-rolled `nohup setsid`. The delta audit
also suggests verifying `/proc/<pid>/cwd` rather than only comparing md5 after the fact, which
catches the case where the right bytes are served by the wrong process.

### M27 — **A vital can be logged from the report screen and never corrected or removed there** (M)

From `outputs/ENHANCER-app-v90.md` E1. Task **#32**.

The Temperature report's `Readings` list (`index.html` 11638) and the Weight trend's `All Readings`
(12681) render every reading as a plain row with **no control on it**. A temperature typed as `102`
instead of `100.2` goes in on that screen and cannot be fixed on it. Removal lives in History
(5893), behind a different tab; **correction does not exist for a vital at all.**

**Paracentesis, on the same Reports screen, has a `Remove` on every row** (12494), and bowel and
appetite days got the correct-rather-than-delete treatment in app-v89. Vitals are what is left out,
and that inconsistency is the finding rather than an absence.

Preferred shape: a correction path that **appends a superseding reading** the way `logSymptom` has
since app-v72, plus a `Remove` matching the paracentesis row. Build with M28 below, not before it.

### M28 — Both vital log boxes stamp NOW, with no earlier-time entry (M, pairs with M27)

E2. A temperature taken at 6am and typed in at 9pm is recorded at 9pm, and by M27 cannot be moved.
Bowel and appetite got "log a day you missed" in app-v89; the two vitals did not. An entry at the
wrong time that **can** be corrected is a far smaller problem than one that cannot, so M27 first.

### M29 — **`Average` on the Weight trend is the paracentesis average again** (S) — Aaron's call

E3, and Voice question 3. Task **#33**. `index.html` 12636 shows `Current` / `Average` / `Change`;
`Average` is the arithmetic mean of every reading in the window.

Weight during treatment **trends**, so its mean is the midpoint of a slope. It describes nothing a
clinician uses and invites *"averaging 150, this one is 146, fine"* when the direction is the whole
story — and **`Change` already carries the direction** while `Current` carries the number that
matters. This is precisely what Aaron caught on the paracentesis report himself (*"this isn't an avg
thing"*), one screen across, surviving because this seat looks for what is missing and walks past
what is already there — the blind spot Rule 2.6 item 6 names.

Recommend **rate of change** over the window (`-1.4 lb / week`): the figure oncology watches, and
one that cannot be read as a target. **A number on a patient's screen, so Aaron decides.**

### M30 — The Temperature report's range toggle writes `state.weightRange` (S)

E4. Task **#34**. `renderTemperatureReport` 11498 reads `state.weightRange`, and its own
Weeks/Months buttons write it — so **Months** on Temperature silently switches the Weight report
too. Surfaced by app-v90's own suite section 4b, which is the first test ever to press that button.
Defensible behaviour, undefensible naming. Recommend renaming the key to `vitalRange` with a comment
saying the sharing is deliberate, rather than splitting it.

### M31 — `dayOf()` decides "same day" from the container's clock, and no test can reach the gap (S)

Named twice by the Zero Day Auditor (`AUDIT-app-v90.md` A4, `AUDIT-app-v90-delta.md` M11),
recorded here because a hole reported twice and written down nowhere is a hole that gets closed
by accident or not at all.

**CORRECTED 2026-11-03, and the correction is the point of the entry.** This said "still alive",
and the third audit killed it: the `setUTCHours` mutant **reds 14 checks under
`TZ=America/Chicago`**. The sections added for the two blockers reach it after all. What is still
true, and is the reason this entry stays open: **it is invisible in this container**, which runs
UTC, where local and UTC midnight are the same instant and the mutant is exactly equivalent. So
the net exists but only an auditor who re-runs under another zone is holding it. **An entry
written from one run of one container is a measurement of the container.**

`timeAxisLabels()` decides between time labels and date labels with
`dayOf(ts) => { const d = new Date(ts); d.setHours(0,0,0,0); return d.getTime(); }`. A mutant that
uses `setUTCHours` instead **survives the whole suite, and survived it under `TZ=America/Chicago`
too.** The discriminating input is a span that crosses LOCAL midnight but not UTC midnight — in
Chicago, roughly 23:00 to 01:00 local — and the axis always ends at *now*, so building that fixture
requires "now" to be a particular time of night. **It is not constructible at an arbitrary hour**,
which is exactly why it has survived two audits.

Two honest options, and the second is better:
1. Freeze the clock. The suite can now move the app's date through `__v86Test.simDate`, but that
   takes whole days, not hours. A time-of-day override would make this and a family of other
   boundary cases reachable — and would be the second time this release found that *a check that
   cannot be reached is indistinguishable from a check that passes*.
2. **Test `timeAxisLabels()` directly.** It is a pure function of `(tMin, tMax, count, x)`. A unit
   test can hand it a span across local midnight at any hour and read the labels back, with no
   browser and no clock. The browser suite is the wrong instrument for a pure function, and that
   is the real finding: this hole exists because every check on this code goes through a page.

### M32 — the global de-duplication is now defensive only, and that is worth knowing before deleting it

The audit's M2 mutant — restoring the old previous-label-only de-duplication — **survived all 89
checks**, which it reported as "F2's fix has zero test coverage". True at the time. With the year
now printed on spans over ~300 days, non-adjacent duplicates are no longer constructible at all:
inside a span, `M/D` is unique for ticks a day or more apart, and where ticks are closer than a day
the repeats are adjacent, which the OLD rule already handled.

**So M2 is now a genuinely equivalent mutant, not an uncovered one.** The global `Set` is belt and
braces behind the format. Written down so that nobody later reads "no test distinguishes these" and
deletes the `Set` as dead weight — it is the thing that holds if the format rule is ever relaxed.

### M33 — The suite now hard-depends on `TEST_MODE === true`, and store prep will turn it red (S)

Section 4d drives the app's date through `window.__v86Test.simDate`, which calls `setSimDate`, which
early-returns when `TEST_MODE` is false. The third audit proved this by building the store case:
with `TEST_MODE = false`, `typeof simDate === 'function'` is **still true** — the hook ships — and
the eight checks in 4d go red because the clock will not move.

**This is not a defect; it is a dependency that has to be written down before the day it bites.**
Hard rule 4 keeps `TEST_MODE = true` until store submission prep, and at that moment:

* 4d's eight checks must be skipped with a stated reason, not deleted and not left failing.
* The hook itself ships inert into the store build. **Say that plainly rather than discovering it
  in a review**: `window.__v86Test` and `window.__eraseTest` are exposed behind
  `if (typeof window !== 'undefined')`, not behind `TEST_MODE` — and `__eraseTest` is a factory
  reset, which is a far larger surface than a date setter. Gating that whole block on `TEST_MODE`
  is the real fix and belongs in store prep, where it can be audited on its own.

### M34 — `checkFullyLabelled` saw a dropped label but not a dropped HALF of them (S)

The third audit built the mutant this entry exists for: `if (i % 2 === 0) out.push(...)` drops every
other label from every axis in the app and **scored 149/151**. The two reds are preconditions
(`3b.*.0`), not the check written to catch this.

**Why the check could not see it.** `f1` asserts the gaps between labels are all EQUAL, because the
mutant it was written against dropped ONE label from the middle and left unequal gaps. Drop every
second label and the gaps are equal again — twice as wide, perfectly regular, and invisible to an
equality test. **A proportional thinning is the one failure shape an evenness check cannot detect**,
and that is worth keeping as a lesson in its own right: a check derived from one mutant tends to
describe that mutant rather than the property.

Closed in part in app-v90 by asserting a floor on the label COUNT alongside the evenness, which
kills this mutant. The complete fix is M31's option 2 — `timeAxisLabels()` is a pure function, so a
unit test can assert `out.length === count + 1` exactly, with no browser, no clock and no floor
chosen by measurement.

### M35 — `v87-correct-a-past-day` is red under `TZ=America/Chicago`, and it is a DST defect in the SUITE (S)

**Found by the app-v90 PM, and it had been invisible for a reason worth writing down: all three
audit passes ran their regression tables under `America/Chicago` and none of them re-ran v87.**
The figure `v87 64/64` was carried forward from an earlier run under a different zone.

Measured:

| Zone | Result |
|---|---|
| `Etc/UTC` | **64/64** |
| `America/Chicago` | **43/51** — eight failures, and thirteen checks never executed |
| `America/Phoenix` | **64/64** — same local date (Mon Nov 2), no DST |

**Phoenix is what makes it a diagnosis rather than a guess.** Same calendar date as Chicago, same
app, no daylight saving: green. So it is neither the date nor the app.

**The cause.** The fixture seeds a day at `localMidnight - 2 * 86400000` while the selector looks
for the key `D0 - 2 * 86400000`. Chicago's fall-back on 2026-11-01 makes that interval **49 hours,
not 48**, so the seeded day lands at 01:00 of the wrong date and the `data-correct-day` key never
matches. Arithmetic on milliseconds is not arithmetic on days, which is the same mistake
`timeAxisLabels` avoids by asking `dayOf()` instead of measuring a span.

**It is pre-existing, not an app-v90 regression**, and that was checked rather than assumed: the
published app-v89 baseline (`a5d5908`) scores an identical **43/51** in Chicago.

**It is a DIFFERENT defect from task #30** (`v88`'s `pickDay` selecting calendar cells by day
number with no month navigation), so #30 does not cover it. Both are suite defects that move with
the calendar; neither is in the app.

The fix is the same shape as #30's: derive the target day as a DATE (`setDate(getDate() - 2)`),
never by subtracting milliseconds, and address the cell by a `data-` key built from that date.

**And one more thing that suite carries:** it contains a self-check comparing its own count against
the figure in `README.md`. That check is currently red. It is a real mechanism and worth keeping,
but it reds whenever the count moves for any reason, so it reports "the record is stale" and "the
suite found a bug" in the same colour.

### M36 — the floating Back pill covers report content, and a chain report says it does not (S)

**Found by the app-v90 PM, correcting `outputs/DESIGN-app-v90.md`.** That report saw the Back pill
sitting on a stat tile in its screenshots, reasoned that `fullPage: true` captures fixed elements at
viewport coordinates and then extends the page beneath them — which is true — and concluded *"On a
real screen both are pinned to the bottom and overlap nothing."* **The reasoning is sound and the
conclusion is false.** The bottom nav really is a capture artifact. The Back pill is not.

Measured in the VIEWPORT with element bounding rects, not in a full-page capture, on the temperature
report with three readings:

| width | scroll | covered | overlap |
|---|---|---|---|
| 320 | top | the `LATEST` tile's value `99.8` | 59 × 21 px |
| 320 | **bottom (235/235, no further scroll)** | last readings row, `Tue, Nov 3 · 12:01 AM` | 48 × 8 px |
| 390 | top | `Latest` and `99.8` | 83 × 14, 83 × 21 px |
| 390 | **bottom (248/248)** | last readings row | 13 × 8 px |

**The cause.** The pill's wrapper is `position: fixed; z-index: 36; bottom: calc(88px +
env(safe-area-inset-bottom))` (`index.html:5481`) and the scrolling content has
**`padding-bottom: 0`**. Nothing reserves space for the pill, so at maximum scroll the last row of
any report list sits permanently underneath it with no scroll left to clear it.

**It is pre-existing, not an app-v90 regression**, and that was checked rather than assumed:
`git diff a5d5908 HEAD -- index.html` has no hunk within thousands of lines of the pill or the page
padding — the diff is the version line, the changelog, the What's New hook, the two shared axis
helpers, the two chart call sites and one test hook.

**The fix is a bottom gutter**, not a change to the pill: give the scrolling report container
`padding-bottom` of about the pill's height plus its offset, so the last row can always be scrolled
clear. Check every screen that shows the pill, not only the two chart reports.

**The lesson worth more than the fix.** A Designer seat reading screenshots is right to distrust
`fullPage` artifacts — that distrust is exactly what the report was exercising, and it is correct
practice. But "this is probably a capture artifact" is a hypothesis, and a seat that can measure
should measure it rather than reason it away: one viewport-coordinate rect comparison separates the
two cases in seconds. A declined finding needs the same evidence standard as a filed one.

### M37 — ~~The other two apps have never been measured for contrast~~ — CLOSED for `care-tracker`, and NOT queued for staging

**WRITTEN WRONG, AND THE AUDIT CAUGHT IT. Corrected 2026-11-03.** The original entry read *"Order:
scan both, report the numbers"* and named `care-tracker` first. By the time it was written, Aaron
had frozen that app: *"That app and its data is to be frozen… that app is not to be touched
whatsoever."* `care-tracker/CLAUDE.md` now opens with **⛔ THIS APP IS CLOSED. DO NOT CHANGE IT. DO
NOT RUN ANYTHING AGAINST IT**, and this repo's Rule 0.0 says items of this shape are closed, not
queued.

**As written, a future session working the backlog in order would have pointed a browser suite at
a dead patient's app** — exactly the failure the notice exists to prevent, written into the backlog
hours after the notice went up, by the same session that wrote the notice.

* **`care-tracker`: CLOSED. Do not scan it. Do not open it. There is no number worth having.**
* **`chemowell-beta`: not queued either.** It is `care-tracker`'s staging copy. It holds fabricated
  test data and nobody's medical record, so it is not covered by the freeze — but it is still her
  app's test bed, and nothing there gets touched unless Aaron asks for it in his own words.

What survives of the original point: the scanner is theme-agnostic and reads painted pixels, so it
*could* run against either. That is a fact about the tool, not a reason to use it.

### M38 — The contrast scan has no sanity check on its own backdrop readings (S)

It shipped with a defect that looked exactly like a result: SVG text is painted with `fill`, so
"hide all text with `color: transparent`" left every chart label on screen, and the scan sampled
each glyph as its own backdrop. Nineteen chart labels were reported as failing against greys
(`#7D7276`, `#8D8487`) **that exist nowhere in the app's palette.**

Fixed, but found by eye. Two cheap self-checks would have caught it on the first run and neither
is there yet:

1. **Every sampled backdrop colour should occur in the app's palette** (or be a blend of two that
   do). A backdrop that matches nothing means the sample is landing on something unexpected.
2. **Hiding the text must change the pixels under it.** Photograph once with text, once without,
   and assert the two differ inside every text box. If they do not, the hiding did not work and
   every number from that run is fiction.

A measurement harness needs a check on what it MEASURES, not only on what it reports.

---

**STATUS, app-v91 (updated after the fourth audit).**

**Item 2 is DONE and shipped** — it is the A/B pixel diff in `test/contrast-scan.mjs`, plus a third
photograph C in the same hidden state for a backdrop that is still moving. A string that cannot be
proven visible now **fails** the scan instead of being counted as passing. **Item 1 is still open**
and would still be worth having: a sampled backdrop that matches nothing in the palette means the
sample landed somewhere unexpected.

### What the pixel diff does NOT catch, with the mutants that prove it

The corpus is `falsify/mutants-contrast-overlays.sh`, runnable with
`./falsify.sh test/contrast-scan.mjs falsify/mutants-contrast-overlays.sh`. Four audits built these
mutants in scratch directories that died with their sessions, so each audit rebuilt the last one's
work from prose. They are committed now, with the two below declared as expected survivors so the
day either starts dying is noticed rather than rediscovered.

**M38-a — a static TRANSLUCENT veil (corpus mutant 4, `MUTANT_EXPECT="hole"`).** The backdrop is
read from the photograph, so a veil is included in it; the **ink** is read from `cs.color`, which a
veil does not touch. Both colours are then wrong in the same direction, so the printed ratio goes
**up**. Measured: one 390×140 `rgba(255,255,255,0.85)` div at `pointer-events: none` produces output
**byte-identical to a clean build** — 310 / 602 / 0 below AA / worst 4.78:1, exit 0 — while 48 of the
310 printed ratios move, every one upward, and `Alex's Meds` prints **15.08:1** against a painted
**1.30:1**. The live shape is `#tour-scrim` (`index.html:5349`), which fails loudly today only
because it is **dark**; a pale veil is the silent direction, and the only thing holding the tour shut
in the fixture is `tourDone: true`.

*Proposed fix, size M, not attempted in app-v91:* collect every element that paints — `position`
fixed/absolute/sticky with a non-transparent `background-color` or a `background-image`, plus
`backdrop-filter` and `mix-blend-mode` layers — independently of hit-testing, and fail any text box
one of them intersects. That is a real guard rather than a wider diff, and it has to be falsified in
**both** directions before it goes in: the drawer and the upgrade sheet are legitimate layers and a
gate that refuses them is a gate somebody disables. The corpus already carries the over-block
control for that (mutant 8).

**M38-b — an ANCESTOR's `opacity` (corpus mutant 7). LIVE, not hypothetical.**
`getComputedStyle(el).opacity` is the element's **own** value, so the `< 0.95` translucency skip
never sees an ancestor's. With `#root { opacity: 0.35 }` the scan exits 1 on 13 strings and still
prints **297 as passing** while every one of them is painted at 35%.

**An earlier version of this entry said "not live today", and that was false.** It listed one
`opacity: 0`, two `opacity: 1` and a `0.65` inside a comment — an enumeration taken from an audit
report instead of from the file. The grouped medications card carries **two live rows at
`opacity: '0.65'`** (`index.html` paused row and treatment-excluded row), each wrapping a
`TYPE.title #554A52` and a `TYPE.caption #5C4E52` over the card's white, plus an `opacity: '0.55'`
disabled input in the med editor. The scan would have printed **8.44:1** and **7.88:1** for text
painted at **3.39:1** and **3.27:1**.

**Half of this is CLOSED in app-v92** and half is still open:

* **Closed:** those two rows are now `opacity: 0.8` — measured as painted, **4.92:1** title,
  **4.68:1** caption, and the Resume button took the palette's existing `#6A4433` because `#6D5247`
  composites to only 4.34:1 even at 0.8. `contrast-scan.mjs` now seeds a **paused** medication, so
  the row is **rendered** on every run from here — **not measured**, and an earlier version of this
  bullet said measured two lines above admitting it could not be. The scan reads the text's own
  opacity, which is 1, so it reports these inks unmuted whatever the row's opacity is: run it
  unchanged against the pre-app-v92 build and it prints 327 strings, 0 below AA, worst 4.83:1, on
  rows painted at 3.4:1. **The opacity fix is protected by the arithmetic and by two pixel
  measurements, and by no gate**, until the bullet below closes. The tell nobody read: the scan's
  worst ratio went 4.83:1 → 4.76:1 across a release whose subject was raising contrast — if those
  rows were being measured it would have moved the other way.
* **Still open, size S:** the scan's skip still cannot see an ancestor's opacity. *Fix:* multiply the
  computed opacity up the ancestor chain before applying the `< 0.95` skip. Corpus mutant 7 is the
  falsification, and it must go from "caught on 13 of 310" to "caught on all of them".
* **Still open, size S, and it is the one that bites next:** the `opacity: '0.55'` disabled input in
  the med editor has never been measured either, for the same reason — no fixture opens the editor
  with a disabled field. A disabled control is allowed to be low-contrast under WCAG, so this may be
  exempt rather than a defect; **measure it before deciding, and write down which it is.**

**M38-c — partial coverage of a multi-line box.** The diff is counted over the whole box, so a layer
covering one line of a three-line string leaves a non-zero diff and the string is kept. Reasoned
about, not built — an incompleteness rather than a wrong measurement, and the weakest of the three.

**M38-d — coverage, stated plainly.** One width (390), eight screens, no focus/pressed/disabled
states, Chromium only. `-webkit-text-fill-color` is a WebKit-prefixed property and has been measured
**only in Chromium**. The frozen 14:00 clock also drops the "Overnight" and "Evening" headings from
coverage; both measured above AA (6.44:1, 6.36:1) and the frozen set is the harder one (worst 4.78:1
against 4.84:1), so nothing failing is being hidden — but it is a narrowing.

**So `0 below AA` from this scan means "nothing measured below AA", never "no unreadable text on
screen".** The scan's own comments say so now, and nothing in this repo may say otherwise.

---

### M39 — What the app-v92 delta audit left behind (S each, none blocking)

Every item here was raised by the Zero Day Auditor's delta pass on app-v92
(`outputs/AUDIT-app-v92-delta.md`), measured by it, and deliberately NOT fixed in that release.
They are instrument debt, not app defects: nothing on this list changes what a patient sees.

**M39-a — `MUTANT_EXPECT` is per-mutant and the right expectation is per-SUITE.** Corpus mutant 5
in `falsify/mutants-v92-layout.sh` is a declared `hole` for `v92-text-collisions` and a genuine
catch for `overflow-scan` (measured: `"Remove"` off the right edge by 17px at 320px, 7px at 330px).
Swept against overflow-scan the harness therefore advises *"the hole is closed; update its
MUTANT_EXPECT to die"*, which is wrong — the hole it names is in the other suite. The label needs
to be keyed by suite, e.g. `MUTANT_EXPECT_5__v92_text_collisions="hole"`, with the bare form kept
as the default.

**M39-b — mutant 5's anchor matches 21 sites, not the one column it names.** It still bites and the
measurement reproduces, but a corpus entry whose description says "the content column" and whose
anchor rewrites twenty-one places is a corpus entry nobody can reason about. Narrow the anchor.

**M39-c — `overflow-scan` never opens a report SUB-screen.** It walks the top-level screens and two
overlay passes. So of the three row sites the app-v92 fix touches, it renders exactly one: History's
row lives behind a report tile and `missedRow` needs a missed dose, and neither is in the fixture.
All six findings the badge mutant produces are `HOME` variants. The two app-v92 suites do walk all
nine report screens, so the coverage exists — it is split across instruments, and the scan's own
summary line does not say so.

**M39-d — one report screen scales at 320px and nothing looks at it.** On `paracentesis` at 320px
the Back pill's top measures 736 rather than the 714 every other combination reports, and the
reserve moves with it (770 vs 748), so the clearance invariant holds and there is no defect. The
cause is the same scaling mechanism the app-v91 audit logged as F11, and it implies a horizontal
overflow on that sub-screen — which, per M39-c, no instrument renders. Measure it before assuming
it is cosmetic.

**M39-e — corpus mutant 7 claimed to be the app-v92 defect and is caught by nothing.** (It was labelled `die`; it is now `hole`. See the resolution at the end of this item — the heading said `die` for a while after the body said otherwise, which is the same stale-record class this whole section is about.) The auditor measured five
variants of "the time cell can shrink" (the cell's `flexShrink` alone; with the badge out of the
fixture; the wrapper's `flexShrink`; both; and mutant 5 + mutant 7) and every one reported
`170/170 … 0 overflowing, CLEAN`. The *"3 overflowing, '10:00 AM' by 5px"* figure in its comment
belongs to the pre-app-v92 row STRUCTURE as a whole and is not reproducible by reverting that one
property: the name absorbs the squeeze instead.

**CLOSED, by measuring it rather than by relabelling it on the audit's word.** The full group sweep
was run (29m0s): mutant 7 **survived**, 171 checks / 171 passed / 0 failed, confirming the audit.
`overflow-scan` cannot distinguish *"the suite cannot see it"* from *"there is nothing to see"* —
it only ever reports a box too small for its text — so `falsify/probe-timecell-width.mjs` measures
the time cell's used width against its own text's width by Range, four widths, 24 cells, shipped
against the mutant:

| build | `flex-shrink` | used widths | text widths | squeezed below text |
|---|---|---|---|---|
| shipped | 0 | 58.03 / 66.31 | 58.03 / 66.31 | 0 |
| mutant 7 | 1 | 58.03 / 66.31 | 58.03 / 66.31 | 0 |

**Identical**, with `flex-shrink` reading 1 in the mutant so the mutation applied. The property is
inert on every row this fixture can draw, and app-v92's own name fix is the reason: the name span
carries `minWidth: '0'` and `overflowWrap: break-word`, so a crowded row relieves itself by
wrapping the name — even a single long token like `Hydroxychloroquine` breaks mid-word — and the
time cell is never put under pressure. It stays in the app as defence-in-depth for a future row
that cannot wrap; the mutant is **`MUTANT_EXPECT="hole"`**. The first relabel used `survive` and
the second audit was right to refuse it: `falsify.sh` defines `survive` as an OVER-BLOCK CONTROL
and prints *"Fix the check, not the mutant"* when one is caught, so the day the time cell becomes
load-bearing that label would send the next session to weaken `overflow-scan`. `hole` is this
file's own word for a known gap with a ticket, and prints *"the hole is closed"* instead.
Mutants 5 and 8 are what actually pin that row and both bite.

**What is still open here, and it is small:** no instrument can show that the time cell's
`flexShrink: '0'` matters, because nothing can currently build a row that cannot wrap. A mutant
that adds `white-space: nowrap` to the name AND removes the time cell's `flexShrink` would pin it
under the condition the property exists for. Worth one run, not worth blocking a release.

**M39-f — `v92-text-collisions` skips any text run with a `fixed`/`sticky`/`absolute` ancestor.**
That is deliberate and documented (a toast over a row is not a collision), and it is also the
reason the suite cannot see the Back pill sitting on a row — which is why
`v92-pill-clearance.mjs` exists and now carries the reserve invariant. Written down here so the
exemption is a stated exemption rather than an undiscovered gap.

**M39-g — the content column is 77px wide at 320px, and that is why the badge breaks mid-word.**
Found by the Designer pass the app-v92 delta audit asked for
(`outputs/DESIGN-app-v92-delta.md`). The card's 280px of inner width at 320px is spent on the time
group (~85px with dot and gaps), the `Remove` text button (~72px) and the gaps, leaving 77px.
`SCHEDULED` at 10px bold uppercase with letter-spacing measures ~85px, so **no fix that keeps the
badge inside that column can avoid breaking the word** — the app-v92 badge fix traded a 21px
column overflow for a mid-word break, which is a net improvement (nothing escapes into a control
any more) and still not good. Three ways out, in order of recommendation: **icon-only `Remove` at
<= 345px** (S — already proposed for app-v92 and not built; gives back ~40px, helps every narrow
row, and is a CONTROL change so it is Aaron's call under Rule 2.6); drop the uppercase and
letter-spacing on this badge (S — longest word becomes ~52px, changes a badge type's visual
language app-wide); give the badges their own full-width line below the row (M — correct in
principle, three render sites, changes the shape of every row carrying a badge).

**M39-h — `overflow-scan`'s denominator can in principle be exceeded, and under-counts in one
branch.** Raised by the app-v92 delta2 audit as F3, and raised honestly: it could not be
reproduced in two attempts and is a code-reading finding. One screen/width combination can push
**two** `report` entries (the layout-viewport branch and the per-element branch) while the
denominator counts combinations, so `ovfFailed` could exceed `ovfTotal`; separately, the
device-level fixture-failure branch adds `unreachable += SCREENS.length` and skips the `EXTRA`
loop, under-counting by `EXTRA_COUNT`. **Neither can produce a false green** — `ovfFailed == 0`
still implies 170 scanned — which is why it is here and not in the release. Fix by keying the
denominator to entries rather than combinations, or de-duplicating `report` by combination.

**M39-i — the Paracentesis report side-scrolls by 8px at 320px, and it is pre-existing.** The
delta2 audit answered M39-d's open question by measuring it: `innerWidth` 328 against
`scrollWidth` 328 at a 320px device, which is why that one combination reports `innerH 866` and a
pill top of 736 — the layout viewport widened and the pill did not move. The widest element is the
three-up stat grid's "Since last / Today" card (`index.html:12600`). **Not app-v92**: that grid's
geometry is unchanged since the commit that introduced it and the `TYPE` scale has never moved.
Invisible to `overflow-scan` because, per M39-c, it walks no report sub-screen. Fix with the
report sub-screen coverage in M39-c, or by letting that grid wrap to two-up under ~340px.

**M39-j — `missedRow` has never been rendered by any gate or any designer pass.** The one surface
left unrendered after the delta2 audit walked Home and History. Its badge is the literal
`'Missed'` — one six-letter word — so it cannot produce the multi-line wrap M39-g is about, which
is why no one held a release for it. It is still a row that nothing has ever looked at.

---

### M40 — The app-icon badge does not work on the Android build (S, needs a dependency)

app-v93 puts the due count on the app icon with `navigator.setAppBadge`, which an installed PWA
supports and a plain browser tab ignores. **The native APK has no badge plugin in
`package.json`**, so on the Android build the icon never carries a number and the in-app count on
the menu button is the whole feature. That is why the count is on the menu button at all, and it
is said out loud in the code, in `DESIGN-app-v93.md` and in `REQUESTS.md` rather than left to be
discovered. Fix: add a badge plugin (`@capawesome/capacitor-badge` is the usual one), call it
beside `setAppBadge` in `syncAppBadge()`, and rebuild. Needs a dependency and an Android build, so
it is not a line of JavaScript and does not belong in a release that cannot verify it.

### M41 — A silenced profile keeps accumulating missed doses (needs Aaron's intent, then S)

Silencing stops the reminders. It does not stop the medication being RECORDED as missed, so a
two-week hospital stay produces a wall of missed-dose flags the moment that profile is reopened —
and the missed-dose banner still has no upper bound (task #17). The app already has the right
mechanism for "not taking this at the moment": a medication **pause**, which `isPausedOn` keeps
out of missed-dose history for exactly the days it covers. Proposal in
`outputs/ENHANCER-app-v93.md` E5: when a profile is silenced, offer "also pause their medications"
as a one-tap follow-up. **This changes the record and not just the alerts, so it is Aaron's call
before anything is built.**

### M42 — Silencing has no end date and the app never asks again (S)

Aaron's own example is a hospital stay, which ends. The switch stays off until somebody notices.
A caregiver who silences on admission and forgets is exactly the person this app exists to
protect. Cheapest useful version, recommended: a plain "silenced since 3 Nov" line on the row — no
new control, no new behaviour. The fuller version ("silence until a date") needs a picker and a
wake-up path and should wait to see whether the date line is enough. `outputs/ENHANCER-app-v93.md` E4.

### M43 — Another profile's reminders cannot be re-armed from here (by design, worth revisiting)

Un-silencing a profile you are not in tells the caregiver "reminders resume next time you open
their profile", because building their plan from here would apply the OPEN profile's treatment-day
rules to someone else's medications — and arming a dose reminder for a medication that should be
withheld around treatment is not a rounding error on a medication tracker. The real fix is the
same one M39-c and `profileDueCount` want: make the treatment gates take a context object instead
of reading `getPrefsDB()` and `state.chemoDates`. That is a refactor of load-bearing medical logic
and wants its own release and its own audit. It would also make every cross-profile count exact.

---

### M44 — Which window is credited for a mid-gap late dose is unchecked (S) — **HALF CLOSED 2026-11-10**

Found by the app-v94 mutant corpus and declared there as `MUTANT_EXPECT_6="hole"` rather than
excused. After app-v94's two-pass claim, pass 1 takes every dose that is on time or early for a
window, so a window's LATE reach (`hi`) only decides which window is credited for a dose logged in
a **gap** — after one window closes and more than two hours before the next opens. The dose count
is identical either way; the only difference is which window is recorded as **missed**, and that
lives in History and the missed-dose rows. `test/v94-window-coverage.mjs` reads the Home screen.

Measured, at a 17:03 clock with windows 6-8, 13-15 and 20-22 and one dose at 16:00: the correct
build credits the 13-15 window, a build whose late reach runs to midnight credits 6-8, and **Home
renders identically for both**.

**HALF CLOSED in the app-v94 delta, and not the way this entry predicted.** It said closing it
needs a suite that reads the missed rows. It did not: fixing the notification path meant
cancel-on-log had to know *which* window a dose belongs to, so the claim became readable through a
hook, and `test/v94-window-coverage.mjs` now asserts that a dose at 16:00 against windows 6-8 and
11-13 is credited to the later one. Mutant 6 is a **catch** rather than a declared hole.
**The hole was never in the app — it was in what the suite could see**, and it closed as a side
effect of making a different surface honest. Worth remembering before writing off the next one.

**Still open, and still worth the suite it asks for:** no gate RENDERS a missed row. That is the
other half of this entry, and it also covers task #17 (the missed-dose banner has no upper bound —
it once read "20751 missed doses") and `M39-j` (`missedRow` has never been rendered by any gate).
One piece of work rather than three.

---

### M45 — A medication carrying `linkedTo` still has its card and its ring on different windows (S)

Found on the builder's own re-read during app-v94, and the shape is the one that release exists to
end — one screen's two halves answering the same question differently — one level up from the walk
itself. `status()` takes `med.linkedTo ? linkedWindowsFor(med, d0) : medWindowsFor(med, d0)`.
`doseProgressToday` and `missedDosesFor` take `medWindowsFor` alone. So the three now share the
WALK but not the WINDOW LIST.

**It is deliberate and it was settled by measurement**: the phase 1 audit's B5 found that folding
the linked variant into `medWindowsFor` moved the ring's and the missed walk's windows by an hour,
so the divergence was kept on purpose.

**`chemoRelativeWindows` belongs in this entry too** (delta audit D2's second half). `status()` and
the missed walk take their windows from `medWindowsFor`, which resolves that property, while
`buildReminderPlan` and `profileDueCount` iterate `med.windows` raw. So a treatment-relative
medication's alarm is armed from a different window list than its card is drawn from — the same
divergence as `linkedTo`, reachable by the same phase 2, and to be settled in the same pass. And it is **unreachable on today's data** — RULE 0 item 4:
every one of the five phase 1 medication properties, `linkedTo` among them, is absent in the field.

So this is not a defect today. It is a defect waiting for `HARDCODED_MEDS_PLAN.md` phase 2, which
migrates the thirteen legacy ids onto those properties and makes `linkedTo` real. Settle it before
that lands: either all three take the linked windows (and B5's hour is re-measured and fixed), or
the ring is documented as deliberately counting the unlinked schedule. The comment in
`doseProgressToday` now states the qualification rather than claiming the three cannot disagree.

### M46 — No fixture pins a DST transition day, so the clock mutants cannot be caught (M)

Declared in the app-v94 corpus as `MUTANT_EXPECT_12="hole"`. `hourTs(d0, h)` is calendar-correct
and `d0 + h * 3600000` is a fixed hop; they differ by exactly one hour on the two DST transition
days a year and are identical on the other 363. app-v94 removed the last fixed-hop arithmetic from
`status()` (audit F2), but **nothing in the repo can see a regression**: every suite freezes its
clock to a non-transition day in UTC, deliberately, because `v90-chart-axes` was red one hour a day
on correct code when it did not.

The fix is a fixture, not a rule: one context pinned to `America/Chicago` on 2026-11-01 (the autumn
transition) and 2027-03-14 (the spring one), asserting that a window's open time and the coverage
walk agree. That would guard every `hourTs` / `nextDay` call site at once — there are about forty —
rather than only the one `status()` just lost. The delta audit put the cost of killing mutant 12
alone at about forty lines, so the **M** on this entry is for the whole class, not for that mutant.

**Two sites the delta audit named (D2), because "one clock" stopped at `status()`:**
* `profileDueCount` (index.html:1062) computes `ws` / `we` with raw `d0 + h * 3600000` two lines
  above a call that goes through `hourTs`. Same mixed clock inside one function that F2 fixed next
  door.
* `missedDosesFor` (index.html:2860) filters the day with `e.ts < d0 + 86400000` while the walk it
  hands those entries to uses `nextDay(d0)`. On the 25-hour autumn day the last hour falls outside
  the filter and inside the walk, so a dose given in it reads as **missed**.

Both are pre-existing and DST-only. Fix them in the same pass as the fixture, not before it — a
clock change with nothing able to see it is how this class got here. Worth its own small suite, `test/dst-clock.mjs`,
because it is the only check in the repo that needs a non-UTC context and the reason wants writing
down where the next person will find it.

### M47 — An alarm with no `extra` survives every cancel path (S)

The app-v93 audit's F2, restated as the delta re-audit's F3 and **lost for a release** — it was in
neither `BACKLOG.md` nor `REQUESTS.md` until now, which is exactly the failure Rule 7 exists for and
why that rule carries dates. Logged properly here.

`cancelRemindersForProfile` filters `p.extra && p.extra.profileId === profileId`, so a pending
notification with no `extra` object at all is never cancelled — not by silencing a profile, and not
by **deleting** one. Nothing this app arms is missing `extra` (every `out.push` in
`buildReminderPlan` sets it), so it is unreachable from the current arming sites. It becomes
reachable the moment anything else on the device arms through the same plugin, or an older build's
alarm survives an upgrade: that alarm would then outlive the profile it belonged to and fire with a
name for somebody who is no longer on the phone.

Fix is one line (treat a missing `extra` as cancellable **on the deletion path only** — on the mute
path it must stay protected, because `notifCancelCandidates` deliberately falls back to the
existence rule for alarms whose kind it cannot read). Wants its own check and mutant, since the two
paths want opposite answers.

### M48 — The window fixtures use shapes `deriveWindowEnds` cannot produce (S)

The delta re-audit's F4 on the first pass, also lost until now. User-created windows are
**contiguous**: `deriveWindowEnds` sets each window's `end` to the next window's `start` and the
last to 24, so a real medication has no gaps. Gapped windows exist only in legacy configs (one
entry, index.html:1566) and in test fixtures.

That matters for how much the app-v94 corpus proves. Under contiguous geometry pass 2 is nearly a
no-op — every dose is inside some window — and the two-hour early grace reaches two hours back
*into the previous window* rather than into empty time. So the gap cases this suite leans on are
real but rare, and the contiguous case, which is what nearly every user has, is under-tested by
comparison. Add a contiguous fixture (08–17, 17–24) alongside the gapped ones and check what the
grace does where two windows touch: a dose at 16:50 is early for the 17:00 window and also inside
the 08–17 one, and only one of them should claim it.

### M49 — `window.__v86Test` is ungated and now drives the plugin cancel (S, before store submission)

Noted by the app-v94 delta audit (D5). The hook block is attached unconditionally, not behind
`TEST_MODE`, and it has grown: as of app-v94 it exposes `setProfileMuted`, `cancelForEntry` and
`armedTags`, so anything running in the page can mute a profile or cancel armed alarms. Pre-existing
since app-v85/86 and harmless in a single-file app with no third-party script and a CSP that admits
one CDN — but it is a surface, and "no third-party script" is a property of today's file rather than
a guarantee.

Gate the whole block behind `TEST_MODE` before store submission, and make the suites run against the
`TEST_MODE = true` build they already use. Belongs with the `TEST_MODE = false` flip on the
store-readiness list rather than in a dose-logic release.

### M50 — Four wrong numbers in one release, and the next one is a mechanical check (S)

**First, the two open ones, with their exact lines, so they cannot go the way F3/F4 went.** Both are
the delta-3 audit's findings, both are prose with zero behavioural effect, and both are the **first
commit of the next touch** — not fixed in app-v94 because `release_check.sh`'s supersession rule
requires an audit SHIP naming a commit at which `index.html` is current, so two words would have
cost a full extra audit-plus-PM cycle. The independent auditor's own judgement, followed here.

* `index.html:2534` — *"There were SIX, and **three** of them were wrong."* **Five** were wrong:
  `status`, `doseProgressToday`, `medWindowDueAt`, `dueRemindersAt` and `cancelReminderForEntry`.
  Only `missedDosesFor` was right. The release corrected `THREE` → `SIX` for the count of
  definitions and left the other half of the sentence behind, so it now matches neither framing —
  **in the comment whose whole job is to stop the next person miscounting.**
* `index.html:13648`, `falsify/mutants-v94-coverage.sh:196` and the `README.md` app-v94 row —
  *"all **five** call sites"* of `medWindowDueAt`. There are **four**: `profileDueCount`,
  `dueRemindersAt`, `buildReminderPlan` and the test hook. `cancelReminderForEntry` is not one of
  them; it calls `windowClaims` directly. The conclusion the sentence supports (that `wi < 0` is
  unreachable) is unaffected — the auditor re-derived it by instrumentation — only the count is
  wrong.

**Now the actual entry, because four of these in one release is the finding.** app-v94 produced:
F5 (the header comment said three definitions when there were six), D3 (the README row and
`REQUESTS.md` said 30 checks when there were 33), the gate's own comment (33 when there were 35 —
and that file was the one that was *right* when D3 was written), and now these two. Every one is the
same shape: **a count written in prose next to the thing it counts, which goes stale on the next
commit and is then read as true by the next session.** This project has already paid for that
specific mistake at a much higher price — Rule 7's standing-exceptions list had three entries
describing defects that had been fixed for weeks, and one of them nearly sent a second build at a
solved problem.

**The fix is not more care. It is a check.** The repo already has the right pattern in
`test/v75-no-other-patient.mjs`: a two-sided ratchet that counts the real thing and fails if the
written number drifts in either direction. Do the same for the counts that appear in comments:
derive the number of coverage definitions and the number of `medWindowDueAt` call sites from the
file, and require the comment beside them to state it. Then a stale count is a red suite rather than
a finding somebody has to notice. Cheap, and it retires a whole class.

**A third item for the same commit, found on Aaron's phone on 13 November.** The `CHANGELOG`
entry for app-v94 carries `date: 'Nov 10, 2026'` and the release reached him on the **13th** — the
date was written when the entry was, and then the release spent three days in the chain. He read
"Nov 10" on a screen on the 13th. Nothing computes from that field, so it is the same shape as the
two counts above and as `mark_published.sh`'s `published_at` (fixed 14 November, which had been
recording the commit date): **a date or a number written by hand at build time and read as true
later.** Correct it to the day it shipped in the same commit as N1 and N2, and consider whether the
ratchet this entry proposes should also assert that the newest `CHANGELOG` entry's date matches
`PUBLISHED.json`'s `published_at` once a release is live — that is the one version of this check
that would have caught all four instances.

Out of scope for M50 and worth saying: this does **not** extend to the README's version-history
prose, which is a historical record and is allowed to describe what was true at the time.

### M51 — `verify-live.yml` is red on main and hides the deploy check behind it (M)

Found while promoting app-v94 on 14 November. Two defects, and the second is the one that matters.

**It has been red since app-v92.** That run failed two suites that are green in the sandbox and
green on `release_check.sh`: `contrast-scan` reported *"Reports / Temperature (1 of 54 below AA)"*
at 326/327, and `overflow-scan` crashed with a Node error before reporting. Neither was
investigated, so for two releases the only automated statement about what is live has been a red
tick nobody read — and this workflow's own header comment says *"a gate that is always red says
nothing; a gate that dies before it runs says less."*

**And the live check cannot run while that is true.** The job's steps are ordered: *"The quality
chain must have run for what is on main"* calls `release_check.sh` and `exit 1`s on failure, so
*"Wait for Pages, then read the live files"* never executes. Those are two independent facts —
whether the chain ran, and whether the deploy landed — and the step's own error text calls the
chain check *"a report rather than a block"* once the push has happened. So the **app-v40 failure
this entire file exists to catch** (`index.html` changed, `sw.js`'s CACHE not, every installed copy
serving the old shell forever, no error, no warning) is unguarded exactly when the other check is
red. app-v94's deploy had to be confirmed by reading GitHub's own `pages build and deployment` run
for the sha instead, because **the live site is unreachable from this environment**: the network
policy answers `403` to `CONNECT` for `arnjnnngs.github.io`, which is the same wall the file's
header comment describes hitting ten times after app-v75.

**The fix, in order:** give the live step `if: always()` so it reports whatever the chain check did;
then diagnose the two runner-only failures (the contrast one smells like font rendering differing
between the runner and this sandbox, which would mean the threshold or the fixture needs to tolerate
it rather than the app needing a change — measure before assuming). It touches
`.github/workflows/`, which is in `RULE5_PATHS`, so it needs an audit and a PM sign-off.

**Also worth a line, since it cost a published commit message.** `9719ee8` on `main` reads *"the
live step wants ,"* — a pair of backticks inside a `git commit -m "..."` string made bash run the
enclosed text as a command, and the phrase vanished. The message is not amended, because that
commit is already published and GitHub Pages and the Android build have both run against it.
**Never put backticks in a double-quoted `-m` argument**; use a heredoc with `-F -`, which is what
every other commit in this release used.
