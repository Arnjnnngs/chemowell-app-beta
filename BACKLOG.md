# BACKLOG.md — chemowell-app-beta

Small, non-blocking things found during work that aren't worth stopping for, but shouldn't get
forgotten either (per Aaron, 2026-08-06: "if there is something that you notice is a problem or
can be an easy fix... make sure that is in the notes"). Read this at the start of any session in
this repo — it's the durable, in-repo version of a running punch list. Pull items into a real task
when you're about to touch the relevant code; delete the line once it's actually fixed and shipped.

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
