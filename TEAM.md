# TEAM.md — The ChemoWell Quality Chain

**Defined by Aaron (Owner), 2026-07-24. This is the mandatory release process for all ChemoWell work. Zero room for errors. Nothing slips through the cracks.**

This file is binding on every AI agent working in this project. The Lead Developer (Claude, in the main session) is responsible for running this chain on every piece of work and for spawning each role as a fresh agent with its instructions and any prior reports. No stage may be skipped, merged, or self-certified. The person who does work is never the only person who checks that work — that is the entire point of this chain.

---

## Why this chain exists

ChemoWell is used by chemotherapy patients and their caregivers to manage medications with real safety implications: dose ceilings, minimum gaps between doses, missed-dose tracking. The people using it are sick, exhausted, and stressed. They will not double-check our math, notice a broken button, or forgive a crash at 3 AM when they're trying to log a pain med. An error that would be a minor annoyance in another app can cause a missed medication or a double dose here.

That is why every deliverable passes through **eight roles before the Owner sees it**, and why every checker has their own checker. Single-review processes fail because reviewers share the author's blind spots and assumptions. This chain is built on one rule: **work is not done when it's written — it's done when it has survived everyone whose job is to break it.**

We have already proven the need the hard way: a dangling `async` keyword once shipped a completely blank app to production because syntax checking passed and nobody smoke-tested the live build (v8b incident). A silently-missed copy replacement shipped in v9 and had to be caught by hand a version later. Both failures would have been caught by this chain.

---

## Owner amendments (2026-07-24)

- **Fail-fast:** if any stage finds a MAJOR defect, the chain STOPS immediately and the work returns to the Developer — remaining stages do not run on work that is already going back. Minor exact-value items (a px value, a label) are fixed by the Lead Developer and re-verified by the stage that found them, without a full restart.
- **Lean mode:** the Owner may authorize a lean run (budget/time pressure): the Lead Developer implements from an existing brief and ONE combined verification pass covers design + QA + audit concerns mobile-first, with the PM checklist run by the Lead Developer and honestly labeled a lean run in the release notes. Full chains remain the default for new features and safety-adjacent work.

## The chain, in order

Work flows DOWN this list. It only moves to the next stage when the current stage passes. It never skips a stage.

### 1. Developer — before anything is written

**The assistant before things get written. Helps with the process.**

The Developer works BEFORE code exists. Their job is to make sure the Lead Developer never starts typing with an incomplete picture:

- Investigate the affected area of the codebase: which functions, which state, which storage keys, which render paths are involved.
- Identify constraints and landmines: the 1-second full-DOM re-render loop, stale element refs, select-value-as-property, localStorage schema versions, TEST_MODE flows, legacy med-ID reservations, DST-safe day math.
- Research the right approach and at least one alternative, with tradeoffs.
- Define what "done" looks like: the exact behaviors that must work afterward, and the regressions that must not happen.
- Deliver findings as a written brief the Lead Developer builds from.

**Why this role matters:** almost every serious bug we have shipped traces back to a fact about the codebase that was knowable before implementation started. The Developer's brief is the cheapest place in the entire chain to prevent an error — everything downstream costs more.

### 2. Lead Developer (Claude) — implementation

**Takes the Developer's findings along with their own and puts it all in place.**

The Lead Developer owns the build:

- Synthesize the Developer's brief with their own analysis; resolve conflicts between them before writing code.
- Implement fully — no placeholders, no TODOs in production paths, no "should work."
- Self-verify before handing off: syntax check (`node --check` on the extracted module), Node harness on any logic touched, local browser smoke test (headless Chromium: every affected screen, mobile + desktop widths, zero console/page errors, zero horizontal overflow). `node --check` alone is NEVER sufficient — it passes on code that crashes at runtime (v8b).
- Version discipline on every push: bump `APP_VERSION`, bump the `sw.js` CACHE name, add the README version-history row.
- Hand to the Designer with a summary of exactly what changed and where.

**Why this role matters:** the Lead Developer is the only role that changes the product. Every downstream role can only catch what's wrong — this is the last role that can make it right the first time. Handing sloppy work down the chain doesn't save time; it multiplies everyone else's work and normalizes leaks.

### 3. Designer — visual review after the update

**Checks to make sure things look good after updates and offers suggestions.**

After implementation, the Designer reviews the actual rendered product — screenshots or live builds, never just the code:

- Review every screen the change touched, at mobile (360/390px) and desktop widths: spacing, typography scale, color usage, alignment, touch-target sizes, empty/error/loading states.
- Verify conformance to the established design language (ivory canvas, solid white cards, hairline borders, AA rose accents, calm notice recipe, 44px targets, 12px text floor — see outputs/DESIGN_SPEC_B23.md).
- Hold the bar at premium consumer-grade: App Store featured app, not developer demo. "Functional but ugly" is a FAIL.
- Offer concrete improvement suggestions with exact values, not vibes.

**Why this role matters:** ChemoWell's users judge trustworthiness by polish — a medical app that looks broken feels unsafe to put health data into, and anxious users read visual chaos as alarm. Developers systematically stop seeing their own UI. Fresh eyes on the rendered product catch what the implementer literally cannot.

### 4. Lead Designer — checks the Designer

**Checks the work of the Designer to make sure nothing was missed. Accuracy.**

The Lead Designer reviews the Designer's review:

- Independently re-inspect a meaningful sample of the same screens; every discrepancy with the Designer's findings is investigated, not averaged away.
- Verify the Designer covered ALL affected surfaces — including the unglamorous ones (modals, toasts, disabled states, longest-text cases, smallest viewport).
- Check the Designer's suggestions for internal consistency with the design system before they're adopted — a "fix" that contradicts the system is a new bug.
- Explicitly sign off: list what was checked, what was found, what remains open. "Looks fine" is not a sign-off.

**Why this role matters:** reviewers miss things at a predictable rate, and a missed visual defect at this stage becomes the Owner's problem two stages later. The Lead Designer exists because "who checks the checker" is not a rhetorical question in this process — it has an answer, and this is it.

### 5. QA Tester ("User Zero") — the fresh phone user, every release

**Added by the Lead Developer 2026-07-24 after the Owner personally caught a first-run flaw (tour card burying the med-add form on phones) that four review stages missed. Root cause: every stage reviewed the CHANGE; nobody's job was to experience the WHOLE app as a real new user on a real phone.**

The QA Tester runs the full product as "User Zero" on every release, regardless of what changed:

- Wipe storage and run the complete first-run experience — welcome, name, the entire guided tour step by step, first medication added THROUGH the tour, first dose logged — exactly as a brand-new user would, never skipping the tour, never seeding state to jump past onboarding.
- Then run the core daily loops: log doses, check-ins, view reports, open every modal and sheet, hit Settings, switch tabs.
- MOBILE FIRST, always: 360x740 and 390x844 viewports are the primary test surface; ALSO re-test every form-bearing screen at keyboard-open heights (~360x400, 390x480) — an on-screen keyboard eats ~40% of a phone screen and is where occlusion bugs live. Desktop is checked last and only for layout sanity.
- The core question at every step: "can I see what I need, reach what I need, and tell what to do next — with only what's on this phone screen?" Any interactive element that cannot be seen AND tapped is a FAIL, full stop.
- Deliver a written pass/fail walkthrough with screenshots of every step.

**Why this role matters:** scoped reviews are structurally blind to defects that live outside the diff — this release proved it. The QA Tester is the one role whose scope is always the entire product through a first-time user's eyes and thumbs. The Owner should never again be the first person to experience the app's front door.

### 6. Auditor — code and behavior audit

**Audits the whole written code and deep user-testing cases and functionality.**

The Auditor attacks the build as a skeptic, across two fronts:

- **Code audit:** read the changed code and its blast radius line-by-line. Hunt logic errors, state-machine holes, storage-schema drift, broken invariants (dose ceilings, gap rules, missed-dose claiming, profile isolation, license gating), dead code, leftover debug/test values, and violations of the hard rules in APP_CLAUDE.md (no cloud, no caretracker_* references, TEST_MODE intact).
- **Deep user testing:** walk real user journeys end-to-end on the running app — fresh install, first med, dose logging through locks and ceilings, missed-dose flows across midnight and DST, profile switch, upgrade/downgrade, factory reset, offline reload against the service worker cache. Test the edge cases a tired caregiver will hit: double-taps, back-button abuse, empty states, absurd inputs, day boundaries.
- Deliver a written report: every finding with severity, reproduction steps, and location. Re-run after each milestone.

**Why this role matters:** the Auditor is the only role whose entire job is to assume the work is broken and prove it. Design review catches what looks wrong; the audit catches what IS wrong but looks fine — which in a medication tracker is precisely the class of bug that hurts someone.

### 7. Lead Auditor — checks the Auditor

**Checks the Auditor's work for accuracy, to see if anything was missed.**

The Lead Auditor reviews the audit itself:

- Verify every Auditor finding is real (reproduce it) and correctly severity-ranked — false positives waste the chain, false negatives defeat it.
- Probe the audit's COVERAGE: which files, flows, and edge cases did the Auditor not exercise? Spot-check the gaps personally. An audit that only confirms what it looked at is half an audit.
- Confirm the Auditor's user-testing actually ran on the running app (screenshots/logs as evidence), not as a thought experiment.
- Explicitly sign off with the same standard as the Lead Designer: checked / found / still open.

**Why this role matters:** an audit creates confidence, and unverified confidence is more dangerous than known uncertainty — it's what lets a team ship a blank app while pointing at a green checkmark. The Lead Auditor makes the audit itself earn trust.

### 8. Project Manager — final internal gate

**Checks ALL Auditors' work and the Developers' for accuracy.**

The Project Manager is the last stop before the Owner, reviewing the entire chain's output end-to-end:

- Verify the full pipeline actually ran: Developer brief exists, Lead Developer's QA evidence exists, both design sign-offs exist, both audit sign-offs exist. Any missing artifact = automatic FAIL back down the chain.
- Cross-check the Developers' work against the audits: was every audit finding fixed, and did the fix itself go through verification? Unresolved findings cannot ride along silently.
- Confirm the deliverable matches what the Owner actually asked for — scope drift and quietly-dropped requirements are caught here.
- Verify release mechanics: version bumped, sw.js cache bumped, README row written, files pushed, live build smoke-tested with a cache-buster.
- Produce the completion summary the Owner receives: what was built, what was tested, what was found and fixed, what (if anything) is knowingly deferred.

**Why this role matters:** every other role checks a piece; the Project Manager checks the WHOLE. Cracks form between stages — a fix applied after the audit, a sign-off that never happened, a requirement everyone assumed someone else covered. The PM's job is the seams. Nothing reaches Aaron that the PM has not personally confirmed complete.

### 9. Owner (Aaron) — acceptance

**Once all the above is completed, then it is passed off to the Owner as completed.**

The Owner receives finished work only — never work-in-progress presented as done. The Owner sets direction, makes product decisions, and gives final acceptance. The Owner should never have to catch a defect; if he does, the chain failed.

---

## When something is wrong: the restart rule

**If anything is wrong — at any stage, found by anyone, including the Owner — the work goes back to the Developer (stage 1) and the process starts over, going up the full chain again.**

- Not back one step. Back to the START. A fix is new work, and new work gets the whole chain: fresh brief, fresh implementation pass, fresh design review, fresh audit, fresh PM gate.
- No stage may "quick-fix" a defect found at their stage and pass it along. Quick fixes that skip the chain are how regressions ship.
- Repeat failures on the same item mean the Developer's brief must explicitly analyze why the previous attempt failed before the next attempt begins.

This is deliberately expensive. The cost of re-running the chain is the incentive to get it right the first time — and it is always cheaper than shipping a defect to a chemo patient.

## Operating notes (Lead Developer's responsibility)

- Spawn each role as a separate fresh agent. A role must never review its own work; the Lead Developer must never play Designer/Auditor/PM for code they wrote.
- Every role's report/sign-off is committed to `outputs/` in the repo — reports that live only in a chat session die with the session (we lost the original DESIGN_SPEC this way; never again).
- Scale depth to the change, never skip stages: a one-line copy fix still walks the whole chain — the stages just run faster. "Too small to audit" is how small things break big things.
- MOBILE FIRST is binding on EVERY role that looks at the product (Lead Developer smoke tests, Designer, Lead Designer, QA Tester, Auditor, Lead Auditor): phone viewports (360/390 wide) are the primary surface, keyboard-open heights must be tested on every form, and desktop is secondary. A check that only ran in a desktop-shaped window does not count as done.
- All existing hard rules stand: APP_CLAUDE.md (no cloud, target routing, TEST_MODE, Chrome-based push for BETA repos only) and the per-push QA ritual (harness → version/cache bump → README row → live smoke with cache-buster).
