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
- **Then verify the upload landed, file by file, and only then move `origin/main` by hand.**
  `git push` cannot work here (the proxy refuses to inject a credential for this repo — try it,
  you get a 403), so pushes are web uploads and `git` never learns they happened: `origin/main`
  sits frozen at whatever release the sandbox was created from, and `git status` reports every
  commit since as unpushed forever. That is noise, and noise around "did this ship?" is how a
  release gets assumed-shipped. Fix it deliberately, never reflexively:

  1. Open the compare view — `github.com/<owner>/<repo>/compare/<old-sha>...main` — and check the
     changed-file list matches `git diff --name-only origin/main HEAD` exactly. A file you forgot
     to upload shows up here and nowhere else.
  2. From a github.com tab, hash every one of those files off `raw.githubusercontent.com` and
     compare against local `sha256sum`. app-v55 did this for all 40: 40 match, 0 mismatch. This is
     the step that catches a truncated or mangled upload, which the file list cannot.
  3. Only if that is clean: `git update-ref refs/remotes/origin/main $(git rev-parse HEAD)`.

  This asserts **content** equality, not history — GitHub mints its own commit SHAs for a web
  upload, so the trees match and the SHAs never will. Do not skip to step 3 because the upload
  "looked fine"; an `origin/main` that lies is strictly worse than one that is merely stale,
  because a stale one at least nags.
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

If a piece of copy is high-stakes enough that getting the tone wrong has real consequences —
anything a caregiver reads while making a medical decision, not just a button label — whoever
is doing that review (Designer or Auditor) should say so explicitly rather than guess, and
the Lead Developer should flag it to Aaron as worth a real copywriter's pass rather than
resolve it in-chain.
