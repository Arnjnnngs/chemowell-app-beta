# ChemoWell — Team Process

Defined by Aaron (Owner). This is the actual release process for this project — it lives in
this file, not in anyone's memory, so it survives across sessions.

Aaron is a non-technical solo founder and product owner. He sets direction and gives final
acceptance; he should never have to catch a technical defect himself. Every technical
decision (architecture, libraries) is owned by the Lead Developer unless Aaron says
otherwise. Running the process itself is a separate question — see below.

## Scribe — mandatory, every release

**Read `REQUESTS.md`, `BACKLOG.md`, and this file at the start of every session, before
doing anything else — that's what makes them worth having.** Scribe is the name Aaron uses
across his projects for this responsibility (carried over from another project's process,
2026-08-07); it's not a separate spawned agent by default, just like `release_check.sh`
below isn't — it's a mandatory step whoever is doing the work runs every single release, so
it can't be skipped the way a remembered checklist item can be. For a release big enough to
already be running a Developer/Auditor/PM as separate agents, Scribe can be its own fresh
agent pass too, the same way Lead Auditor/Lead Designer scale up — but it never skips.

---

## AFTER ANY FIX, RE-RUN THE MUTANT THE PREVIOUS ROUND WAS CATCHING. (app-v88, 2026-10-26)

**The most valuable finding across four audit rounds on app-v88 was not in the product.** It was a
fix quietly retiring the check for the thing it had just fixed, **with nothing going red to say
so.**

What happened, exactly. The release's first blocker was the "log another day" dialog sending
*delete the note* on every confirm. It was fixed, and a check was written that turned red without
the fix. Two rounds later a different defect was fixed by clearing the note whenever the day
changes — a correct fix, and it had a side effect nobody could see: **the check for the first
blocker picks a day before confirming**, so the day-change reset now overwrote the value that
check existed to test. Restoring the original blocker verbatim scored a clean pass. The guard was
still there, still ran, still green — and would have stayed green on a build with the first defect
back in it.

Nothing in any suite, any gate or any review can tell you that has happened. A disarmed check and
a passing check look identical. The only thing that catches it costs one line:

> **When you fix something, re-run the mutant that the previous round's check was catching.**
> Not the suite — the suite is green either way. The mutant.

On the round this was found, the auditor re-ran every mutant the suite was already catching rather
than assuming a one-expression calendar edit was local. Five were unchanged and one had got
*stronger*. That took minutes and is the only reason app-v88 did not ship with its first blocker
unguarded.

Corollary, same release: **a precondition that tolerates "I did not do the thing" is a free pass.**
One check accepted either "the day was tapped" or "I reopened the calendar instead", and on the
second branch no cell is clicked, so the behaviour under test cannot fire and the assertion holds
for the wrong reason. It was not being taken — but preconditions are exactly where this hides,
because nobody reads them as assertions.

---

## FOR ANY STRING A CAREGIVER READS, LOOK AT THE RENDERED PAGE ONCE. (app-v88, 2026-10-26)

The pair to the rule above, and it comes from the same release.

app-v88 shipped `**Log another day**` into the What's New notice every user is shown after an
update. It rendered **with the asterisks visible**. Help topics are parsed for markdown; the
changelog array is not — its strings go to the screen exactly as typed, and that was the only
markdown in thirty-seven changelog points.

**Four audit rounds, a Designer exemption and a PM read past it**, because every one of them read
the array as *source*, where `**Log another day**` looks like formatting doing its job. The defect
exists only on the rendered page.

And the detail that makes it stick: in round one the auditor had **already dumped the app's
rendered text into its own tool output**, and the literal asterisks were in that dump. It was
scanning the output for row values and treated the changelog block as noise. Its own words:

> *A dump I scanned for one thing is not a page I looked at.*

**Output nobody reads as a whole is not coverage.** A grep over rendered text is still a grep.

> **The rule: for any string a caregiver reads, open it once and read it as a reader.**
> Not as a grep target, not as a diff, not as a field in a dump.

Two further things this cost, both worth knowing:

* **The guard written for it was itself too narrow, twice.** It caught `**` and backticks while
  `*single*`, `_underscore_` and `[link](url)` all passed, and the check *named* for every release
  entry never clicked through to them — one entry on screen, nine behind a tap. **Match the
  character class, not the case list.** That is the third time on one release a pattern matched a
  wording instead of a rule.
* **A widening is a fix, so it falls under the rule above it.** Before trusting a broadened
  pattern, re-run the mutants it *already* caught. A widening that holds its old ground is free;
  one that quietly drops a case is a disarmed check wearing a bigger regex.

Scribe's job every release:
- Check off anything in `REQUESTS.md` that just shipped and was verified live; add any new
  request Aaron made this session, the moment he makes it, not at the end.
- Log anything genuinely new found in `BACKLOG.md` (small issues not worth stopping for).
- Add the README.md version-history entry for what shipped.
- Update this file (TEAM.md) itself when the process changes, so the next session — or a
  fresh chat Aaron pulls this project's docs into — reads the current process, not a stale
  one.
- Show Aaron the current, full `REQUESTS.md` list (not just this session's diff) whenever
  reporting a completion — per his instruction 2026-08-07: "I can't remember all the things
  I've mentioned and still needs to be completed."
  **Restated and tightened 2026-08-09, because this got skipped and he had to ask for it again:**
  "I need to see the task list that done and what needs to be done after every build or request I
  ask. that should have been in notes handed off." So the trigger is not just "reporting a
  completion" — it is **every build AND every request he makes**, including sessions where nothing
  shipped, where the answer was research, or where a decision changed direction. The list goes in
  the reply itself as two plain sections (done / still outstanding), not as a link to this repo and
  not as a diff he has to reconstruct. If a session ends without that list having been shown at
  least once, the Scribe step did not happen, regardless of how much else got done.

This is what lets Aaron open a brand-new chat, point it at this repo, and have it pick up
exactly where things left off — the documents carry the context, not his memory or a chat
transcript that may not carry over.

## Process-gap incident, 2026-08-08 — read this if you're picking this project up cold

app-v50 shipped self-verified by the Lead Developer only, skipping the two mandatory gates this
file requires for every release with no exceptions (Zero Day Auditor, Project Manager). Aaron
caught this by noticing the pattern, not by a defect reaching him — but a real defect was sitting
there anyway: a retroactive Auditor pass (`outputs/AUDIT_v50.md`) turned up a live, currently-
shipping bug (a `ReferenceError` breaking the native export share-sheet feature since app-v47)
that had gone undetected since then specifically because this kind of live-testing gate hadn't
run in a while. Fixed same-day as app-v51.

**Aaron's follow-up, same day, after seeing the first correction attempt still leave room for
Lead-Developer judgment:** "the whole point of the team was to catch things you don't see. I'm
not sure I like your judgement that you can handle on your own bc things have obviously been
skipped or missed... this is an important project and things can't be missed bc this is peoples
lives at stake." He is right, and this closes the loophole for good:

**There is no more Lead-Developer discretion to skip the Auditor + Project Manager gates, for
any change to application code or config, regardless of size.** Not a 1-line fix, not a version
bump, not something that "obviously" works. The first draft of this incident note still framed
a "genuinely small, safe, 1-2 line fix" as a judgment call the Lead Developer could make solo —
that framing is exactly what Aaron is overriding here, so it's gone. See APP_CLAUDE.md rule 5
and rule 7 for the current, tightened wording. In practice: after implementing and
self-verifying any code change — even one line — spawn a Zero Day Auditor agent and a Project
Manager agent (via the Agent tool) before telling Aaron it's done. Self-verification is real
work and still required, but it is never reported to Aaron as equivalent to the independent
gate. If a task genuinely has no code/config change at all (pure documentation edits to files
like this one, README.md, REQUESTS.md, BACKLOG.md), the gates don't apply in the same sense —
but that distinction is not a lever for avoiding the gate on anything that touches
`index.html`, `sw.js`, `.github/workflows/`, `sync-backend/`, or dependency/config files. When
genuinely unsure which category something falls into, treat it as code and run the gates.

## Chain of command (app-v25, Aaron-mandated)

**The Project Manager leads this process. The Lead Developer does not, and never should
have.** This was corrected explicitly after the Lead Developer let real defects (unclear
copy, a visual regression, a confusing validation error, an architecture question that
needed real investigation) reach Aaron on the medication editor despite the chain
supposedly having covered all of it. The PM decides whether a stage's output actually
clears the bar, whether the restart rule applies, and when something is genuinely ready for
Aaron — that authority does not sit with whoever is implementing the fix.

The Lead Developer's place in the sequence is fixed, not roaming the whole chain: it sits
right after the **Zero Day Auditor**. The Auditor finds what's wrong; the Lead Developer
implements the fix, and if that fix doesn't hold up or turns up more problems, the Lead
Developer is who runs it back through the restart rule. The Lead Developer does not get to
decide the loop is done — that call belongs to the PM.

**PM sign-off is a real independent check, not the Lead Developer re-labeling its own pass.**
Up through app-v24, the PM write-up was produced by the same Claude session that did the
implementing — the exact self-certification problem this correction exists to close. Going
forward, PM runs the same way Auditor and Designer already do: as its own independent pass,
not narrated by the Lead Developer after the fact.

## The process (app-v25, Aaron-mandated leaner version)

Two hours per version promote for changes that didn't need eight stages was the wrong trade
for what those extra stages were catching. Aaron approved collapsing the process to two
mandatory gates, with everything else scoped to what a given release actually touches instead
of running by default. This replaces the earlier "fast lane / full chain" split with one
process that scales itself.

**Every release, no exceptions, goes through two mandatory gates: the Zero Day Auditor and
the Project Manager.** Nothing reaches Aaron without both having independently signed off.
Everything else below is scoped in or out based on what the release actually changed.

1. **Developer** — only when a release is a genuine new feature or an actual architecture /
   data-model question that needs real investigation before anyone should start typing code.
   Skipped for ordinary defect fixes and copy fixes — those go straight to the Lead
   Developer. When it is required: investigates the affected code, researches the approach
   plus at least one alternative, defines what "done" looks like, written brief. app-v25
   example of when this stage is genuinely needed: "schedule windows should be a single
   alert time, not a start/end range" touches logic multiple releases depend on (gap timers,
   missed-dose detection, the reminder copy itself) and needed real investigation, not a
   quick patch.
2. **Lead Developer (Claude)** — implements fully, self-verifies: syntax check, a real
   browser/runtime smoke test of every affected screen at mobile and desktop sizes, zero
   console errors. No placeholders, no TODOs, no "should work." Implementer role only — see
   Chain of command above. Sits right after the Zero Day Auditor in the loop: the Auditor
   finds what's wrong, the Lead Developer fixes it, and if the fix doesn't hold up the Lead
   Developer is who runs it back through the restart rule below. The Lead Developer does not
   decide when the loop is done.
3. **Zero Day Auditor — mandatory gate, every release.** Line-by-line code audit of the
   change and its blast radius, plus real end-to-end testing on the running product (not a
   thought experiment), including the obvious edge cases for what changed: double-taps, day
   boundaries, empty states, absurd inputs, offline/reload. Written report with severity,
   repro steps, locations. Explicitly checks whether copy reads clearly to a non-technical
   user and whether the screen matches the app's current visual language — not just "does it
   function." This is where copy-clarity gets checked by default now, including for releases
   where the Designer stage below is skipped (see Copy review section further down).

   **The Auditor does the legwork. Aaron does not. (Aaron, 2026-08-09 — spelled out because
   this rule already existed and still went soft.)** His words: *"you need to have the auditor or
   someone else do these testing questions... I don't need to be doing that leg work. this auditor
   needs to also be entering test/fake logs for every case and scenario to ensure everything works.
   that means doing tour using different things like, chemo, radiation, both and other. there needs
   to be medication added for each profile thats specific to the treatment. everything needs to be
   tested. I've asked this before for a full test of things. but now i'm spelling it out that test
   logs needs to be entered. different profiles needs to be created."*

   Concretely, a full sweep means the Auditor **creates the data and drives the app itself**:
   - **Four profiles from wiped installs — chemo, radiation, both, and Other** — each taken through
     the complete guided tour, with the copy checked *for that treatment type*.
   - **Real medications per profile, specific to that treatment**, covering every placement,
     category, unit, scheduling mode, daily limit and pause-period the editor supports.
   - **A simulated multi-day logging span across every loggable type**, then each entry verified on
     every screen it should reach — Today, History, Reports, Calendar, Notes, and a real CSV export.
   - Test data may be left in place or cleaned up afterwards; Aaron explicitly does not care which.

   **"Please confirm this on your device" is not an acceptable way to close a test case.** The only
   legitimate unverified items are ones a browser genuinely cannot reach — real Android OS
   notification delivery, the native share sheet, the hardware Back button — and each must be named
   explicitly, with the reason, plus whatever half of it *was* testable. Everything else, the
   Auditor determines. Aaron's device is for final acceptance of things only a real phone can show,
   not for finding defects the sweep should have found.

   **This runs in-sandbox, so cost is not a reason to skip it:** Playwright 1.56 + Chromium are
   installed (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`; never run `playwright install`), and
   `python3 -m http.server` over the repo serves the real `index.html` at localhost. The sandbox has
   no outbound access to the live site, which is fine — verify `git diff origin/main -- index.html`
   is empty and you are testing byte-identical code. Reference run: `outputs/AUDIT_full_app_v51.md`,
   82 cases, 4 profiles, 17 entry types, 10 curated screenshots.

   **Test-case depth scales to risk, it isn't fixed at 20 for everything anymore:**
   - Releases that change how medication/dose/schedule data is stored, read, or calculated,
     or anything safety-relevant (dosing logic, missed-dose tracking, reminders), still get
     the full **minimum-20-test-case sweep (app-v24, Aaron-mandated)**: a full first-run
     walkthrough from a wiped install, adding a medication in every placement/category the
     editor supports, a full simulated 7-day logging span across every loggable type checked
     against every screen it should show up on, plus edge cases specific to the change.
   - A single-screen defect fix or a pure copy/wording fix instead gets real testing scoped
     to what changed and its obvious edge cases — not a fixed count, but not a spot-check
     either. Every test case still gets a one-line pass/fail in the written report; failures
     get full repro steps.
   - If it's unclear which of the two applies, default to the full sweep — this scaling is
     for obviously-small changes, not a way to talk yourself into a thinner audit.

   If the Auditor finds something wrong, it goes back to the Lead Developer per the restart
   rule below. **Mobile-first throughout**: phone-sized viewports (360–390px wide) are the
   primary check, not an afterthought after a desktop pass.
4. **Designer** — only if the release actually changes visual layout: new screens, moved or
   resized elements, new components, anything where what's on screen physically changed, not
   just what it says or how it behaves. Reviews the actual rendered product on every touched
   screen: spacing, typography, color, alignment, touch targets, empty/error states. Premium
   consumer-grade is the bar. Suggestions come with exact values. Skipped entirely for
   backend-only, logic-only, or pure-copy releases — the Auditor's copy-clarity check in
   stage 3 covers those.
5. **Lead Auditor** / **Lead Designer** — optional, at the PM's discretion only: for
   high-risk changes (data model, safety-relevant) or high-visibility UI work where the PM
   wants a second independent look before Aaron sees it. Not required by default, and not
   required just because the Auditor or Designer ran.
6. **Project Manager — mandatory gate, every release, leads this process.** Independent
   pass, never a restatement of the Lead Developer's own work: confirms the release matches
   what Aaron actually asked for, confirms the Auditor's test evidence is real (and the right
   depth for what shipped), checks release mechanics (version bump, live smoke test after
   push), decides whether this is genuinely ready for Aaron or needs to loop back through the
   restart rule, writes Aaron's plain-language summary.
7. **Owner (Aaron)** — final acceptance.

## The restart rule — tiered to what was missed

If anything is wrong — found at any stage, by anyone, including Aaron — it goes back for a
fix. How far back depends on what kind of miss it was; this replaces the old flat
"everything restarts the whole lane" rule, which was overkill for a missed word and right for
a broken feature.

- **Real functional, data, or safety-relevant miss** — anything that behaves wrong, corrupts
  or misreads data, breaks a screen, or touches dosing/scheduling/reminder logic — gets a
  **full restart**: back to the start of the process (the Developer stage if this release
  used one, otherwise the Lead Developer), and the fix goes back through both mandatory gates
  from scratch. On repeat failures, the next attempt's brief must say why the previous one
  failed first.
- **Pure wording/copy miss** — a label, a sentence, a tooltip, nothing that changes behavior
  or data — gets a **targeted fix, not a new round**: the Lead Developer fixes the specific
  line, and whoever caught it (or the PM, if it surfaced generally) verifies that one fix
  directly against the running product. This does not require a fresh full Auditor pass or a
  PM write-up starting from zero — it's a spot-check of the fix, logged as an addendum to the
  existing report.

If there's real doubt which tier a miss falls into, treat it as the functional tier. The
lighter tier is for genuinely unambiguous wording-only misses, not a way to talk down a real
defect.

### What a re-audit IS, and what it is NOT (Aaron, 2026-08-24)

Aaron, on the restart: *"I don't want it to only check that one thing when it starts over. it's
supposed to try to break it."* He is right, and the rule above did not say so.

**A re-audit is a fresh attempt to break the WHOLE change. It is not a verification that the
reported defect is gone.** Confirming the fix is the cheapest part of the job and must never be
the whole of it. An auditor that returns "the fix is confirmed" and nothing else has not audited —
it has re-tested, which is the Lead Developer's job and was already done before the re-audit was
requested.

Three rules follow, and they are not optional:

1. **The brief may name suspects, but must state they are a FLOOR, not a ceiling.** Pointing a
   re-audit at the riskiest part of the fix is good practice. Writing a brief that reads as a
   checklist is how a re-audit quietly becomes a re-test. Every re-audit brief says, in these
   words or better: *these are where I think it is weakest; they are the minimum, not the scope.*
2. **The re-audit must go where the previous round did not reach, and must say what it still did
   not reach.** Every audit runs out of road. An audit that does not name its own gaps hands the
   next one no map.
3. **Attack the GATES, not only the app.** This is the lesson that paid for the rule.

**The evidence, from the day this was written.** app-v66's round-1 audit found a BLOCKER: a gate
the Lead Developer had written, and had asserted in writing was "falsified in both directions",
passed on a build carrying BOTH defects it existed to catch. The round-2 audit cleared the
replacement in minutes — and then, because its scope was the whole change rather than the fix,
found two things nobody had asked it to look for:

  * app-v58 had undone two Designer fixes to the Help search results screen, red for NINE releases;
  * **nothing runs these suites at all** — the reason both blind spots survived.

Neither was in its brief. Both were worth more than the thing it was sent to check. **That is what
the extra scope buys, and it is why "just confirm the fix" is banned.**

### The gates are code, and they are audited like code

Every defect found in the app-v66 chain lived in a TEST or a DOCUMENT, not in the application. The
app diff was one keyword. So:

- **The Auditor attacks the gates**: can this check pass on a build that has the defect? Can it
  fail on a build that does not? Is it pinned to a literal that the next release will move? Can it
  START — a gate that cannot start is indistinguishable from a gate that passes.
- **`pm.py` now enforces the mechanical half of this** (sections 7 and 8, added 2026-08-24): a
  `|| true` anywhere in a suite, a direct `require()`/`readFileSync()` of a path from a dead
  environment, and pinned version literals. It checks the suites, not just `index.html` — because
  the `|| true` that shipped here sat in a test file that `pm.py` never looked at.

### Notes move with the code — every final push, every commit (Aaron, 2026-08-24)

Aaron: *"we need to make sure that notes are being updated each final push and commit."*

**Documentation failure is silent.** Nothing breaks when a changelog goes stale, the build stays
green, and no amount of careful reading reliably catches it. Only a check that fails loudly does.
What that cost, all found on one day: `BETA_HANDOFF.md` still said *"Last updated July 23"* and
*"Current version v71"* seven releases later; its debug checklist told a reader to look for a banner
renamed months earlier and to conclude, if it was missing, that the beta was writing to **the
patient's real records**; and `STATUS.md`'s dispatch key defined `IDLE` twice and `ACTIVE` never.

- The docs are written by whoever made the change, **in the same commit** — not afterwards, not as
  a follow-up task. The person who made the change is the only one who knows what changed.
- `pm.py` section 8 **BLOCKS** when `index.html` or `sw.js` differ from `origin/main` and the
  release notes do not. It is not a reminder; it is a gate.
- A correction that lives only in a commit message **is not a correction.** Nobody reads those;
  they read the file. Fix the file, and fix *every* copy of the wrong sentence — the uncorrected
  copy is always the one somebody actually reads.

## Release mechanics checklist

- **Run `./release_check.sh` and confirm it exits 0 before every single GitHub web-upload,
  no exceptions.** This replaced a plain-prose reminder ("bump the version") that was written
  down right here and still got skipped across several same-day pushes in app-v40 — Aaron saw
  zero updates all day because index.html kept changing while sw.js's CACHE constant didn't,
  and the service worker (cache-first) never knew a new version existed. A checklist item is
  something a rushed agent can forget to re-read; a script that hard-fails the release is not.
  If the script fails, fix what it says before doing anything else — do not work around it or
  push anyway.
- Version bump (`APP_VERSION` in index.html) and service worker cache name bump for any
  change that ships to users. (This is what the script above enforces mechanically — the bullet
  stays here as the human-readable explanation of *why*, not as the actual safeguard.)
- README.md version history entry, **and tick the REQUESTS.md line the release closes** — both
  before the push, not "when there's a moment". The app-v55 Auditor found two consecutive
  releases (v54, v55) with neither done (V55-5); the version history is how anyone reconstructs
  what is live, so a gap in it is not a tidiness problem.
- **Immediately after a successful push, run `./mark_published.sh` and commit `PUBLISHED.json`.**
  This is not optional bookkeeping — `release_check.sh` uses that file as its baseline for the
  *next* release. It exists because `origin/main` cannot be trusted here: pushes are manual web
  uploads and this sandbox has no network to fetch with, so origin/main silently points one
  release behind reality forever, and a CACHE bumped in the *previous* release then satisfies the
  gate on a build that never bumped it (proven on scratch clones; it is the app-v40 stranding
  failure printing a ✅). Skip this step and the gate quietly stops guarding one release later —
  which is precisely how app-v40 happened, so treat it as part of the push, not as a follow-up.
- **Then `git fetch origin` and confirm the upload landed. Do not move refs by hand.**
  `git push` does not work here — the proxy refuses to inject a credential for this repo and you
  get a 403 — so pushes are web uploads. **`git fetch` DOES work.** Only writes are blocked; read
  access is fine. So the honest way to find out what shipped is to ask the remote:

  ```
  git fetch origin && git status -sb        # "up to date" is the answer you want
  git diff origin/main --stat               # must be empty
  ```

  If `git status` still shows commits ahead, something did not upload — find it and upload it.
  After a fetch you will normally fast-forward onto the remote's history, which replaces your local
  commit SHAs with GitHub's for the same content. That is expected and fine.

  **This paragraph replaces a procedure that stood here for about an hour and was wrong.** It said
  fetch was impossible and told you to verify by hashing every file, then move
  `refs/remotes/origin/main` by hand. That was built on generalising a *push* 403 into "no network"
  without ever running fetch. It also cost a real false alarm along the way: the first version of it
  said to hash files off `raw.githubusercontent.com`, which is CDN-cached and served stale bytes for
  minutes after an upload, reporting a mismatch on a file that had landed perfectly. Two lessons,
  both the same lesson: **run the command before writing down what it does**, and never hand-move a
  ref to make a status line look tidy — a ref you set yourself asserts something you have not
  verified, which is the failure mode this whole file exists to prevent.

  The tree-digest comparison from that procedure is still a genuinely good tool, just no longer the
  routine path. Keep it for when you need to prove content equality without trusting refs at all —
  compare `git ls-tree -r HEAD --format='%(objectname) %(path)' | sort | sha256sum` against the same
  manifest built from `api.github.com/repos/<owner>/<repo>/git/trees/main?recursive=1`. One
  64-character comparison covers every file in the repo. Use the `git/trees` or `contents` API for
  this, never `raw.githubusercontent.com`.

- **Check the executable bit after any sync from the remote.** A GitHub web upload does not preserve
  file mode, so `release_check.sh` and `mark_published.sh` come back as `100644` and then die with
  exit 126 — "Permission denied", which reads like a broken gate and invites skipping it. BACKLOG
  predicted this; it happened on 2026-08-11. `release_check.sh` now warns about its own mode, but
  it cannot warn if it cannot run, so: `git ls-files -s release_check.sh mark_published.sh` should
  read `100755` for both. Fix with `git update-index --chmod=+x <file>`, commit, and re-upload.

- Push to GitHub, then live-verify the actual deployed site (not just localhost) with a
  cache-buster query param, since the service worker caches aggressively. Batch a release's
  code fixes into one commit and its documentation/reports into another, rather than a
  separate GitHub web-upload round trip per report — each round trip has a real time cost in
  this sandbox (no push credentials, so every commit is a manual web upload).
- Reports for releases that used the Developer/Lead Auditor/Lead Designer stages go in
  `outputs/`. A release that skipped straight to Lead Developer → Auditor → PM doesn't need a
  full report set — a one- or two-line note in the commit message and README entry is enough
  unless the PM stage flags something worth documenting further.
- **Screenshot evidence is capped at ~10 curated images per stage**, not a dump of every
  automated capture. Pick the ones that show the finding or the fix, not the whole test
  run. This is what turned today's push into a 20-minute manual GitHub-web-upload exercise
  (263 files, no push credentials in this sandbox) — the fix is fewer, better-chosen
  screenshots, not a better upload method.

## On-device / real-platform verification (app-v24, Aaron-mandated)

Aaron's instruction, verbatim in intent: testing cannot rest on "I don't have access to a
device" — that's a problem to solve, not a reason to stop. The Lead Developer finds a real
solution before ever telling Aaron something can't be verified, and only comes back to Aaron
if every real option is actually exhausted.

**What this means in practice, and why:** for most of this project's life, everything native
(the actual installed Android app, wrapped via Capacitor — see capacitor.config.ts) was
verified by code inspection only, because the sandbox this project is developed in has no
Android device, no emulator, and no `/dev/kvm` (confirmed directly — no hardware
virtualization support at all). AUDIT_v24.md flagged this gap explicitly rather than quietly
skip it. That gap is now closed:

- **Real, automated, hardware-accelerated on-device testing exists in CI.** GitHub's own
  Linux runners support KVM-accelerated Android emulation for free on public repos — this
  reuses infrastructure the project already owns (the same Actions setup that builds the
  debug APK), not a new third-party service or account. The `emulator-smoke` job in
  `.github/workflows/android-build.yml` boots a real Android system image, installs the exact
  APK the release just built, launches the actual native app, confirms it doesn't crash, and
  captures screenshots plus the full device log — published as Release-asset URLs viewable in
  any browser, no GitHub login required. This runs on every push that touches native-relevant
  files, same as the APK build itself.
- **This is a smoke test today, not the full 45-case web suite** — it proves the native shell
  boots, loads the real app, and doesn't crash on a real Android system. Expanding
  `.github/scripts/android_smoke_test.sh` to drive more of the app (tapping through screens,
  verifying real OS notification delivery via `adb shell dumpsys notification`, multiple
  screen densities) is ongoing work, the same way the Playwright web suites grew release over
  release — not a one-time build.
- **A public, no-login "run any APK in your browser" site was tried and rejected.** Several
  exist and were tested directly; the one actually tried loaded ad content instead of real
  emulation. Even a working one wouldn't be the right home for testing a health app handling
  real medication data — not trustworthy enough to route Aaron's real usage through, even for
  synthetic test data. The CI emulator above is the reliable version of the same idea, built
  on infrastructure this project already controls.
- **One real boundary, not a preference:** legitimate device-cloud services for deeper
  interactive testing (BrowserStack, LambdaTest, Sauce Labs, and similar — real physical
  phones, tappable live in a browser) all require creating an account. The Lead Developer
  does not create accounts on Aaron's behalf on any service, full stop — this holds even if
  asked directly, the same as it holds for banking or medical portals. If Aaron wants that
  tier of testing, he creates the account himself (most have a free trial) and either uses it
  directly or hands the Lead Developer temporary access; the Lead Developer will name the
  option and explain the tradeoff, not silently skip it.
- **iOS, when that work starts:** no iOS Capacitor target exists yet (Android-only so far).
  When one is added, the same pattern applies with GitHub's macOS-hosted runners, which come
  with Xcode and the iOS Simulator preinstalled — an analogous CI job installs the built app
  into the Simulator, launches it, and captures screenshots via `xcrun simctl`, with no paid
  service and no new account, same as the Android job above. This is the committed plan, not
  a "we'll figure it out later."

## Copy review (wordsmith)

Aaron flagged (app-v23) that user-facing wording needs the same deliberate review as layout
and spacing — a clear label matters as much as a clean one, and a caregiver reading a card
at 2am shouldn't have to parse a run-on sentence to know what happened. This doesn't get its
own stage; it rides on whichever mandatory or conditional stage is actually running for a
given release:

- When the **Designer** stage runs (release changed visual layout), Designer checks every
  piece of new or changed user-facing copy for the same things it checks visuals for — is it
  as short as it can be without losing meaning, does it avoid repeating itself (e.g. a date
  and a time appearing twice across two adjacent labels), does it read the way a person would
  actually say it out loud, not the way the underlying data field is named. Suggestions come
  with exact replacement text, the same way visual suggestions come with exact pixel values.
- When the Designer stage is skipped (pure copy/logic/backend release, no layout change),
  this responsibility falls to the **Zero Day Auditor**, whose mandatory checklist already
  includes whether copy reads clearly to a non-technical user — see the process section
  above. This is deliberate: copy-only releases are exactly the ones most likely to skip
  Designer, so the mandatory gate has to be the one covering it, not the conditional one.

### Does this number belong on the screen at all? (added 2026-09-06)

Aaron, on the Paracentesis report: *"we need to remove average of 5.6 L per procedure for para.
this isn't an avg thing. this should have been caught by someone."*

**The wordsmith review above would NOT have caught it, and that is the point.** *"Averaging 5.6 L
per procedure"* is short, clear, reads the way a person would say it, and repeats nothing. It
passes every test in this section. It is also **meaningless and actively misleading**: a
paracentesis drains what has accumulated, so the volume depends on how long it has been. The mean
of those volumes describes nothing a clinician would use, and it invites the wrong reading —
*"she's averaging 5.6, this one was 3, she's improving"* — when the **interval** carries the
meaning, and that was already on the screen as *"Since last"*.

So the review has a third question alongside "is it clear" and "is it short":

> **For every figure the app computes about the patient — what would a clinician do with it, and
> does an average of it mean anything at all?** Averages of things that *accumulate over time*
> almost never do.

**Arithmetically correct and clinically meaningless is still a false impression**, and it is the
harder kind to catch precisely because nothing is wrong with the arithmetic or the wording.

Note for whoever maintains both projects: care-tracker had **no** copy-review role at all until
2026-09-06 (it is Rule 2.7 there now, "The Voice"). This section is the older of the two and the
processes had drifted apart. When one project fixes a process gap, check whether the other has it.

If a piece of copy is high-stakes enough that getting the tone wrong has real consequences —
anything a caregiver reads while making a medical decision, not just a button label — whoever
is doing that review (Designer or Auditor) should say so explicitly rather than guess, and
the Lead Developer should flag it to Aaron as worth a real copywriter's pass rather than
resolve it in-chain.


## DO NOT REPORT UNTIL IT IS DONE (2026-09-08, Aaron, EXPLICIT, effective immediately)

> *"I'm so tired of you stopping when you should be working. You WILL NOT give me a recap of what's
> going on UNLESS I need to approve something OR until you are COMPLETE."*

**Two reasons to send Aaron a message, and no others:** he has to approve or decide something, named
in plain words; or the work is COMPLETE — built, verified, pushed, live, gates green, with the done /
outstanding list included.

Not "a background job is running" — start it and keep working. Not "the audit came back and I am
fixing it" — fix it. Not "here is what I found" — fix it and say so at the end. If a check comes back
red, the next thing that happens is the fix, not a paragraph about the fix. If a message ends with
*"running in the background"*, *"now starting X"* or *"next I will"*, it should not have been sent.

A turn that runs for an hour, launches four agents and ships two releases is correct. A short turn
ending in a status paragraph is the failure. Delivering a finished file is not a recap; pairing it
with a progress note is.

**This supersedes any checkpoint guidance in this repo's process docs wherever the two disagree.**
care-tracker carries the same rule as `CLAUDE.md` Rule 0.6.

**WORK END TO END.** Aaron, same instruction: a task is not a series of steps to be reported between
— it is one piece of work that starts when he asks and finishes when it is live. Build it, check it,
fix what the checks find, audit it, ship it, update the docs and the lists, and port it to the
sibling app if it belongs there. The two exceptions above are the only places that may be
interrupted.


---

## A mutant served by the wrong server looks exactly like a check that cannot fail (app-v89)

A new guard was written, a mutant was applied to break it, the suite was run against that mutant —
and it scored **green**. Under this project's own rule that is a vacuous check, and the next move
is to delete or rewrite it.

**The check was fine. The server was serving a different directory.** The mutated file on disk was
correct; the process answering on that port had been started from somewhere else, so every request
returned the unmutated app. Restarted from inside the mutant's own directory, with the md5 of what
the port serves compared against the md5 of the file on disk, the same check went red immediately.

**The rule, and it costs two seconds:** before believing a falsification result — in either
direction — prove the server is serving the bytes you think it is.

    curl -s --noproxy '*' http://127.0.0.1:<port>/index.html | md5sum
    md5sum <mutant dir>/index.html

Equal, or the run means nothing. This is now mechanical inside `release_check.sh`, which refuses to
run its suites unless the md5 of what its own server returns equals the md5 of the export being
gated — added in the same release, for the same reason, after that script was found to be
announcing "suites will run against a clean export of HEAD" while running them against the working
tree.

**Why this one is worth a section rather than a line.** This project's most recurrent defect is the
vacuous check, so the standing instinct on a green mutant is *my check is wrong*. That instinct is
usually right and was wrong here, and acting on it would have deleted a working guard and left a
real one-line copy defect — Help naming a control that had been renamed — with nothing watching it.
**A green mutant has two explanations, and the cheap one to rule out first is that the mutant never
reached the browser.** It is the same shape as app-v88's *a mutant that does not reach the code
under test looks exactly like a defect*, and app-v89's *a check that runs too late looks exactly
like a check that passed*: three releases running, the failure has been the instrument rather than
the thing measured.

---

## A fixture that omits a field the app always writes is a different program (app-v89)

**The most expensive error of this release was a sentence, and a test fixture put it there.**

A real defect was found in `buildExportRows()` and correctly fixed. A new suite section was written
to prove it, seeding one entry of every kind — and every fixture left out `dose`, because the
branch under test does not read `dose` and it seemed irrelevant. **Every writer in the app sets it.**

So the section proved the fix against a shape the app never produces, and it reported the defect as
total. From there the overstatement spread, in this order:

1. into the suite's own failure message, which named eight entry types as blank;
2. into an eighteen-line code comment describing the defect;
3. into a commit message;
4. into the **CHANGELOG**, where it told patients that reports handed to a care team were missing
   every reading, and asked them to send fresh copies;
5. into a status message to Aaron saying the same thing.

The delta audit measured it against the build that was actually live instead of reasoning about it.
**Four of the five categories named were never affected**: their writers store a duplicate of the
value in `dose`, which the broken fallback printed. Only two entry types — radiation sessions and
symptoms — write `dose: null`, and those two were the entire user-visible footprint.

### The rules

1. **A fixture must carry every field the app's writer sets, including ones the code under test
   does not read.** "Irrelevant to this branch" is a claim about the branch, not about the program.
   Before seeding an entry, open the function that creates it and copy its shape.
2. **A failure message that overstates is a defect in the check.** Not cosmetic: this one was
   quoted verbatim into a comment, a commit, a changelog and a message to the owner, by somebody
   who trusted it — and that somebody was the person who wrote it.
3. **Before writing the blast radius of a defect into anything a user reads, MEASURE it against the
   build that is actually live.** `git archive origin/main`, serve it, drive it. The fix is proven
   by the suite; the *scope* is proven only by the old build, and scope is what the user acts on.
4. **Narrower is not weaker.** "Radiation sessions and symptoms printed no detail" is a smaller
   claim than "every vital was blank" and it is worth more, because it is true and because the
   person reading it can tell whether it applies to them.

### Why it belongs beside the other three

This release produced four instrument failures: a check that ran too late to see what it was
looking for; a mutant served from the wrong directory; three mutants that were never applied; and
thirty-eight abandoned servers holding the ports a later run needed. Each wasted time. **This one
was different in kind — it did not hide a defect, it manufactured one, and shipped it to patients
as fact.** A broken instrument that reads zero gets noticed. A broken instrument that reads high
gets believed and repeated.

---

## A CHECK THAT CANNOT BE REACHED IS INDISTINGUISHABLE FROM A CHECK THAT PASSES (app-v90)

app-v88 taught that **a mutant which does not reach the code under test looks exactly like a
defect** — the mutant appears to pass and the author believes the check is weak. app-v90 is the
same lesson from the other side, and it cost ten mutants to find.

The chart-axis suite was 29/29 green. The auditor wrote ten mutants and **four survived**. Two of
them survived for a reason worth writing down: **the suite could not reach the branch.**

* The axis asks for 4 ticks on the Weeks range and 6 on Months. **No test had ever pressed
  Months.** A mutant that hard-coded the count to 4 therefore passed every case in the suite.
* The minute-format branch fires on a span under three hours that sits entirely inside one day.
  The fixtures were anchored to fixed clock times (`todayAt(9)`), so that branch was only
  reachable **between about 09:00 and 12:00 local**. A mutant disabling it passed outside those
  hours, which is most of the day.

Neither was a weak assertion. Both assertions were fine. **The code they were written for was
never executed**, and a suite reports that identically to a correct answer.

### The rule

1. **For every branch a release adds, name the input that reaches it, and put that input in a
   fixture.** A `? :` on a range toggle is a branch. A `span < 3h` test is a branch. If no case in
   the suite drives it, the branch is untested whatever the green count says.
2. **A control that selects between behaviours must be pressed by a test.** Not read from state —
   pressed, the way a person does it. app-v90 section 4b clicks **Months** and requires more ticks
   than Weeks produced on the identical data.
3. **A fixture anchored to a clock time is a fixture that is sometimes absent.** Build fixtures
   relative to `Date.now()` and to local midnight, then assert the shape they actually produce.
   Where a window can genuinely collapse (just after midnight, there are only seconds of "today"),
   say so in the check's own comment and set the floor at what survives — never a conditional skip.

### And the other two survivors: the suite was reading the words and never the positions

A mutant that drew **every label one tick to the right of its own time** — the axis saying 9 AM
above a 10 AM reading, which is the most misleading thing a chart can do — passed 29/29. So did
de-duplication that keeps the last of a run instead of the first.

**Every label had carried an `x` attribute the whole time and no check had ever read it.** The data
needed to catch both was already in the DOM, exposed by the hook the suite was already using.

**So: when a check reads a rendered element, list what that element asserts about the world and
ask which of those the check actually reads.** A text label on a chart makes two claims — *this
value* and *at this position* — and reading one of them is half a check. The position claim is the
one a reader trusts without thinking, which makes it the one worth asserting.

**Anchor a position to the drawing's own geometry, not to a number you worked out.** app-v90's
first attempt required the last label at the right-hand edge, computed from the padding. That is
false wherever labels de-duplicate: across a two-day span the last label kept sits where the date
changes, correctly, nowhere near the edge. The check that works compares the first label's `x` to
the **earliest reading's own plotted dot**, because that is provably where the axis begins — the
app states it, so the test does not have to guess it.

---

## WHEN EVERY FIXTURE SHARES AN INCIDENTAL PROPERTY, EVERY CLAIM THAT DEPENDS ON IT IS UNTESTED
### And the same gap wrote a false sentence to the patient (app-v90, second delta)

The app-v90 release note said the charts *"stop at the last reading now."* **They stop at `now`.**
For a span inside one day, `Math.max(lastTs, Math.min(tMin + DAY, now))` picks `now` — so one
reading at 09:00 drew an axis running to 11 PM, fourteen hours past the last reading. The sentence
was false in exactly the scenario its own first clause described.

An 89-check suite did not catch it, and a mutant that **deleted the `tMin + DAY` cap altogether**
also passed all 89. One cause for both: **every fixture in the suite had its newest reading at
roughly "now."** Nothing distinguished "the axis ends at the last reading" from "the axis runs on
to today," because in every test those two were the same point.

That property was never a decision. It was what you get from writing fixtures as "a reading an hour
ago, a reading yesterday" — the natural way to write them. And it silently removed a whole class of
claims from the suite's reach.

### The rule

1. **List what is accidentally true of every fixture, and treat each item as an untested axis.**
   All readings recent. All spans ending at now. All data in one month, one year, one timezone. All
   lists non-empty. One fixture that breaks the pattern is usually enough — app-v90's second delta
   added one case with the newest reading five days old, and it killed the surviving mutant and
   made the release note checkable in the same stroke.
2. **Before writing a sentence for the patient, ask which fixture proves it.** If none does, the
   sentence is a guess about your own code. The copy that went out was written from reading the
   diff, and the diff was right; the sentence about it was not.
3. **Prefer the claim the code can be held to.** *"They no longer run past today"* is exact,
   shorter, and true in both branches. The overstatement and the falsehood were both attempts to
   say something more specific than the code does.

### And a vacuous check, in the commit whose own message was about checks that cannot be reached

The same delta added `3b.<chart>.2`, named *"the earliest date is the first label, not a later
one"*, whose body was `r.labels.length >= 2` — **character for character its own precondition on
the line above.** The keep-the-last-of-a-run mutant makes that claim false and this check passed;
only the positional check caught it.

**A check whose body does not mention the thing in its name is the `|| true` hazard with better
camouflage.** It is worse than an absent check, because the name is in the output as a PASS and a
reader counts it. Two cheap habits: when writing a check, say the name out loud and point at the
part of the expression that tests it; and when a section has a precondition, never let a later
assertion in that section repeat the precondition's expression — if that is all you have, delete
the check and let the one that bites carry the claim.

---

## Every gate here asked about the SHAPE of a screen. None asked whether the words could be READ.

**2026-11-03, Aaron, from a screenshot:** *"This color would be too hard to read for some people
and I'm talking mainly about the background… the background blends in with some of the words
that's not put in the box."*

He was right, and it was not one screen. A scan of eight screens found **56 of 309 strings below
the WCAG AA floor, the worst at 2.1:1 where 4.5:1 is required.** (First written as *"102 of 565"*. Those
were SAMPLES, not strings: the viewport and the scroll step overlap by 144px, so every string in
that band was counted twice.) Every piece of text inside a white
card was fine; almost everything printed straight onto the page gradient was not.

Look at what this project checks, and the hole is obvious in hindsight:

| Gate | The question it asks |
|---|---|
| `overflow-scan` | Does the screen **fit**? |
| the Voice | Is the copy **true**? |
| the Enhancer | Can she **do the job** here? |
| the Designer | Does it **look** right, and is anything **clipped**? |
| the Zero Day Auditor | Does the **record** survive? |
| `release_check.sh` | Did the **release mechanics** happen? |

Every one is about position, truth, completeness or process. **Not one is about legibility**, and
the Designer seat is the one that came closest and still missed it — because a person reading a
screenshot sees text they can already read, having been told what it says.

`test/contrast-scan.mjs` is the gate for it. Treat it as the sixth question: **can the words be
read.**

### "Treat it as a gate" is not a gate

This section was written in the release that shipped the scan, called it the gate, and **wired it
into nothing** — not `release_check.sh`, not any runner. The audit found that, citing this repo's
own Hard Rule 6: *a rule enforced only by the person it constrains is the one that gets skipped.*

**And the cost was immediate and invisible.** The scan ALSO crashed on the very build it existed to
gate — it seeded a pinned version literal, the release bumped the version, the What's New modal
opened over it, and the scan exited having measured nothing. For a whole release nobody learned
that from the gate, **because the gate never called it.** A guard nothing invokes does not fail
loudly or quietly; it is simply absent, while reading in the documentation as present.

Declaring a gate and wiring a gate are two tasks. Do the second one in the same commit.

### The instrument's own defects outnumbered the app's, and every one was found by RUNNING it

The palette change was right the first time and three independent audits confirmed it against
byte-identical code. The scan that proved it needed **four** attempts at one guard, and the score
over the whole release is worth writing down plainly:

| found in | how it was found |
|---|---|
| SVG text painted with `fill`, not `color` | a backdrop colour looked wrong |
| a pinned version literal — the scan measured NOTHING and the record quoted a clean sweep | an audit ran it |
| the gate was declared in TEAM.md and wired into nothing | an audit grepped for it |
| `pointer-events: none` invisible to the hit-test | an audit built a bar |
| asking the app instead — same blind spot, by design | **my own falsification, after I had written the fix** |
| the A/B diff vs a 30ms timer | an audit built a timer |
| the third photograph taken after un-hiding — 341 false flags | the first run of it |
| `color: transparent` wiping `currentColor` paint | an audit built a bar, three guards deep |
| fixtures dated from the wall clock — count drifted 309↔310 | two runs an hour apart |
| the freeze pinned the PAGE's clock but not the HOST's — 310/602 in UTC, 309/565 under `TZ=America/Chicago`, identical code | an audit ran it in six timezones |
| the record claimed the diff was "mechanism-independent" — a static TRANSLUCENT veil defeats it, byte-identically to a clean build | an audit built a veil |
| the designer script was given a `process.exit` and nothing ran it | an audit grepped for it |

**Not one was found by reading the code**, including the ones where the reasoning was good enough
that I would have shipped on it. Two in that list are mine finding my own fix wrong *after*
writing it and *before* claiming it worked — which is the only reason they are not in the first
column of someone else's audit.

**The rule that falls out: a measuring instrument needs its own falsification corpus, kept and
re-run, not a one-off check at the moment it is written.** Every mutant above is cheap to rebuild
and each one is now the only thing standing between a future edit and a silent false green. They
belong beside the scan, not in a scratch directory.

**DONE, and it had to be said twice before it was.** The sentence above shipped while every mutant
from four audits still lived in scratch directories that died with their sessions — so each audit
rebuilt the previous one's corpus from prose, and the fourth one said so. The corpus is
`falsify/mutants-contrast-overlays.sh`, nine mutants, runnable with the harness this repo already
had:

    ./falsify.sh test/contrast-scan.mjs falsify/mutants-contrast-overlays.sh

**And writing it down forced two things a prose record cannot hold.** A corpus has to be able to
say *this one is expected to survive*, in two different senses, so `falsify.sh` grew
`MUTANT_EXPECT`:

* **`"survive"` — an over-block control.** It changes something a real release might legitimately
  contain (an animated page gradient). The suite must stay **green**, and catching it is scored as a
  **failure of the sweep**. This is the row that matters most for an instrument this young: a gate
  that misses things is worth having, a gate that fails legitimate work is the one that gets
  `|| true` written beside it — which has already happened in this repo.
* **`"hole"` — a known open hole, with its ticket in the description.** It survives, everyone knows
  why, and it stays in the corpus so the day it **starts** dying is noticed instead of the hole
  being rediscovered by a fifth audit.

Without those two states the only honest way to keep either mutant was to leave it out — and
leaving it out is how a corpus stops describing the instrument.

### What this gate does NOT measure, in the file and in the record

**The scan's limits are now written at the guard itself, in `BACKLOG.md` M38, and in the corpus —
and the reason is that the record said the opposite.** It called the pixel diff
*"mechanism-independent"*. It is not: the backdrop is read from the photograph, so a veil is
included in it, while the **ink** is read from `cs.color`, which a veil does not touch. A static
translucent layer therefore moves both colours the same way and the printed ratio goes **up**. A
390×140 `rgba(255,255,255,0.85)` div produces output byte-identical to a clean build while
`Alex's Meds` prints **15.08:1** against a painted **1.30:1**.

**So `0 below AA` from this scan means "nothing measured below AA". It does not mean "no unreadable
text on screen", and no document in this repo may say it does.** A gate that under-catches and says
so is an asset. One that under-catches and advertises coverage is how the next session concludes
there is nothing left to find.

**And the second rule, which cost the most:** three guards in a row failed because they were all
downstream of the same hiding mechanism. **When a measurement modifies the thing it measures, every
check built on top of it inherits that modification.** Look at the instrument's own effect on the
subject before adding another layer on top of it.

### Two things about building it that generalise

**1. The obvious implementation measures nothing.** Walking up the DOM for a `background-color`
returns `rgba(0,0,0,0)` for every element that sits on the page gradient — which is precisely the
set of elements that were failing. A scan written that way reports a perfect ratio against nothing
and passes forever. The working version photographs the viewport with all text hidden, hands the
photograph back to a canvas so the browser decodes it, and reads the real pixels: gradient, card,
scrim and blur included.

**2. The instrument had a defect that looked exactly like a result.** SVG text is painted with
`fill`, not `color`, so "make all text transparent" left every chart label on screen. The scan then
sampled each glyph as its own backdrop and reported nineteen chart labels failing against greys
(`#7D7276`, `#8D8487`) **that exist nowhere in the app.** Precise, repeatable, reproducible — and
about nothing.

It was caught because a *backdrop colour looked wrong*, not because any check failed. **A
measurement harness needs its own sanity check on the thing it measures, not only on the thing it
reports.** The two that would have caught this immediately: assert that every sampled backdrop
colour actually occurs in the app's palette, and assert that hiding the text changes the pixels
under it. Both are cheap. Neither was there.

### And the corollary for a colour change

Lightening the background was not enough on its own: at 12px the old muted grey still reached only
**3.7:1** against the NEW page. A contrast problem has two sides and the fix usually has to touch
both. Measure after each half rather than assuming the first one did it.

---

## A SUITE THAT DOES NOT PARSE IS NOT A WEAK CHECK. IT IS NO CHECK. (app-v92 delta)

The app-v92 delta shipped `test/contrast-scan.mjs` in a state where `node --check` exits 1. A
seven-line comment — written to make the file's own claims about itself more truthful — went inside
`seed()`'s template literal with two unescaped backticks. The legibility gate for the exact defect
the owner reported in his own words was dead, in the commit whose message said its runtime had been
**measured**.

Three things about it generalise, and all three are about the same habit.

**1. The same edit, in the file beside it, was correct.** `test/v92-pill-clearance.mjs:101` escaped
its backticks. So this was never a gap in knowledge: one of the two files was run again afterwards
and the other was not. **The edit you are sure about is the one you do not re-run.**

**2. A comment is code when it is inside a string.** Every rule in this repo about not trusting a
check you have not watched fail assumes the check runs. A docs-only edit felt exempt from that, and
in a template literal there is no such thing as a docs-only edit.

**3. The record asserted a measurement that could not exist.** The same delta replaced an estimated
timing comment with a measured one — and put `contrast-scan 28s` in it, for a file that cannot
start. Replacing a guess the audit called out with a second guess is worse than leaving the guess,
because the second one claims to be a measurement.

### The gate

`release_check.sh` now runs `node --check` over **every** `test/*.mjs` before the eleven-minute
suite loop, and a parse failure breaks that loop rather than feeding it a file node cannot read.
It costs under a second. It covers suites the gate does not yet run, because a dead instrument
nobody calls is this project's single most repeated defect — `overflow-scan`, `contrast-scan` and
`v90-chart-axes` all sat unrun — and the day one is finally wired in is the wrong day to find out
it never parsed.

## A SUITE CAN ASSERT THE SYMPTOM AND READ AS IF IT ASSERTED THE INVARIANT (app-v92 delta)

`v92-pill-clearance.mjs`'s header said it *"asserts the INVARIANT rather than one row"*. It asserted
a row: no glyph box may intersect the Back pill. That can only go red once a glyph has actually
landed in the pill's band, so it passes on slack. The audit proved it with two mutants, both at
844px:

| mutant | page padding | reserve top | pill top | last glyph | verdict |
|---|---|---|---|---|---|
| shipped | 138px | 706 | 714 | 666–674 | correct |
| `BACK_PILL_GAP = -24` | 106px | 738 | 714 | 705 | **survived on 9px of slack** |
| `BACK_PILL_H = 0` | 96px | 748 | 738 | 715–716 | **survived on 22px of slack** |

Both put the pill over the reserve the page sets aside for it. Both passed.

**And the write-ups of those survivals blamed the app.** They said *"the gap is breathing room, not
the guard"* and *"a mutant that edits a shared constant cannot break an agreement the sharing
creates"*. Both read as laws about the code. Both were facts about **this fixture**: the second is
false outright — at `BACK_PILL_H = 0` the pill still renders 18px tall because the constant enters
it as a `minHeight` floor and enters the clearance as an exact term, so the agreement breaks by
10px. It survived on slack, not on arithmetic.

### The rule

**When a mutant survives, the first hypothesis is that the ASSERTION is weak, not that the property
is unnecessary.** A survivor is evidence about the instrument until the instrument has been shown
to be able to see the thing at all. Writing the survival up as a law about the app — in a commit
message, confidently — converts a measurement gap into documentation that will be believed.

The invariant itself was one line: the pill's top must be at or below the top of the reserve the
page's own `padding-bottom` creates (read through a `data-page-shell` hook, so it is measured rather
than inferred). It catches both survivors, by 24px and by 10px.

## DISCOVERING FROM THE APP PROTECTS AGAINST FORGETTING AND NOTHING ELSE (app-v92 delta)

`v92-pill-clearance.mjs` discovers the nine report screens from the app's own `data-report-tile`
hooks, never from a list in the suite, so a tenth report is walked automatically. That is a real
property and it was over-claimed: it protects against a report being **added** and missed. It
protects nothing against the hook being **dropped**. The audit removed it from three of nine tiles,
consistently at every width, and the walk narrowed from 27 checks to 18 and **passed**, printing
*"6 report screens discovered"* — the same silent-narrowing class as an emptied fixture, which the
file already carried a per-screen guard against.

Worse, a hook holding a value the app does not dispatch on made the suite walk three screens that
do not exist, score them `ok`, and still print *"9 discovered"* — because the only guard was
`where.reportsView === key`, which `openReport` satisfies for any string.

**Two fixes, and the second is the one worth remembering.** A floor on the discovered count (a
ratchet, like `v75-no-other-patient.mjs`'s three) closes the narrowing. The bogus screen could not
be closed by reading the heading — the app prints a fallback `label: 'Report'` — but **the app was
already saying so**: `console.warn('[reports] unknown report type:', type)`. The suite was deaf to
it. `overflow-scan.mjs` has failed on console output since app-v84 (*"a caught-and-logged failure
is still a failure"*) and this suite did not.

So: **before building a new guard, check whether the app already reports the thing and the
instrument is simply not listening.** That is the cheaper half of the fix and the more reliable one,
because it cannot drift away from what the app actually considers an error.

One consequence: a suite that fails on console output has to be hermetic, or the sandbox's own DNS
failures make the check fire on a correct build. Routes are stubbed the way `overflow-scan` has
stubbed them since app-v84. A check that always fails is as useless as one that cannot, and tuning
it to ignore "resource" errors would have blinded it to real ones.

## THE HARNESS CERTIFIED A KNOWN HOLE WITHOUT A MEASUREMENT (app-v92 delta)

`falsify.sh` learned, during app-v92, that a suite can exit non-zero while printing no red line —
a refusal, not a pass — and grew a branch to score that as an OVER-BLOCK rather than as
*"survived as expected"*. The branch was gated on `MUTANT_EXPECT="survive"`.

So a mutant labelled `hole` whose suite **refused to run** fell straight through to the hole branch,
printed *"SURVIVED — KNOWN OPEN HOLE"*, and exited the sweep **0**. A refused run certified a hole
as still-open without a single measurement — and `hole` does not even count toward `$ALIVE`, so
nothing downstream noticed either. It was the same defect the branch was written to fix, one label
along, in the same commit.

Found by driving the scoring block through all four outcomes with a synthetic suite that reads the
clone's own `index.html` for a marker and behaves accordingly — no browser, so every row of the
resulting table is the harness's own code rather than a story about it. **A fix to a scoring rule
should be falsified against every label the rule can see, not only the label that motivated it.**
The status test is now hoisted above the label dispatch; the label only decides what to call it.
