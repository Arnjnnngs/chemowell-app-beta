# ChemoWell — Team Process

Defined by Aaron (Owner). This is the actual release process for this project — it lives in
this file, not in anyone's memory, so it survives across sessions.

Aaron is a non-technical solo founder and product owner. He sets direction and gives final
acceptance; he should never have to catch a technical defect himself. Every technical
decision (architecture, libraries) is owned by the Lead Developer unless Aaron says
otherwise. Running the process itself is a separate question — see below.

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

- Version bump (`APP_VERSION` in index.html) and service worker cache name bump for any
  change that ships to users.
- README.md version history entry.
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
