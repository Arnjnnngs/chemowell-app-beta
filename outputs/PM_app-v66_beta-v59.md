# Project Manager — Gate 8 — app-v66 and beta-v59

**Independent PM pass. 2026-08-25. Branch `claude/caretracker-chemowell-updates-k80ydk` in both repos.**
I did not implement any of this. Every claim below I re-ran or re-read against the current code.
I fixed nothing — per brief, this is a gate.

---

# VERDICT: PASS WITH CONDITIONS

Both releases may go to `main`. Four conditions below, three of which are bookkeeping and one of
which binds the *next* release.

---

## 1. Stage artifacts — all present and accounted for

| Stage | Ran? | Artifact | My ruling |
|---|---|---|---|
| 1 Developer | No | — | **Justified.** TEAM.md scopes stage 1 to genuine new features or architecture questions. I diffed the app myself: app-v66's entire `index.html` change is **one keyword string**. beta-v59 is a mechanical re-derivation. Neither is a feature. The skip holds. |
| 2 Lead Developer | Yes | 4 commits | Ran. |
| 3 Designer | No | — | **Justified, verified by diff, not by assertion.** `git diff abfc970 HEAD -- index.html` is 2 lines: one keyword and `APP_VERSION`. Nothing a user can see changed. For beta-v59, 819 lines of `index.html` moved, but it re-derives byte-for-byte from already-designed production v59 — **I recomputed the md5 myself: `a42c2f53998615069a1acd30f13a3546`, matches.** No new design surface exists to review. |
| 4 Lead Designer | No | — | Justified for the same reason; also discretionary under TEAM.md stage 5. |
| 5 Zero Day Auditor | **Twice** | `AUDIT_app-v66_beta-v59.md`, `AUDIT_app-v66_round2.md` | Both present. Round 1 blocked; round 2 cleared. |
| 6 Lead Auditor | **Merged into round 2** | (same file) | **Accepted — see ruling below.** |
| 7 Scribe | Yes | `SCRIBE_app-v66_beta-v59.md` | Present. |
| 8 PM | This file | | |

### Ruling on the merged Lead Auditor stage

**Accepted, and it does not need to run separately.** Two reasons, and the second matters more than
the first.

TEAM.md stage 5 is explicit that Lead Auditor is *"optional, at the PM's discretion only... Not
required by default, and not required just because the Auditor... ran."* It was never a mandatory
stage, so this is a stage that was *not required*, not a stage that was *skipped*.

More importantly, I checked whether round 2 actually behaved like a Lead Auditor rather than a
second first-pass — that is the substance, and the label is not. It did:

- It **reversed** round 1's service-worker conclusion, having measured what round 1 reasoned about.
- It found round 1's own MAJOR-1 only **half-closed** (fixed in one file, left standing in the other).
- It probed what round 1 never reached — the twenty browser suites — and found a defect **two audits
  had walked past**.

That is adversarial cross-checking of the prior auditor's work, which is the job. It was also a
fresh agent, not the Lead Developer re-labelling its own pass — the specific failure TEAM.md's
"Chain of command" section exists to prevent.

**The Lead Developer flagged this itself rather than letting me discover it.** That is the correct
behaviour and I am recording it as such.

---

## 2. Every finding, re-checked against current code

I did not read commit messages as evidence. Verification method is in the right-hand column.

### Round 1 Auditor

| # | Finding | State | How I verified |
|---|---|---|---|
| **BLOCKER-1** | PARA-0 gate passed on the defect it was written to catch | **FIXED — falsified by me** | I built three mutants of my own (below). The replacement gate goes red on both attacks and stays green on the legitimate change. |
| MAJOR-1 | Retracted false claim left in two test files | **FIXED** | `grep -rn 'scored ZERO\|cannot bridge' test/` → **no hits.** Gone from both files. |
| MAJOR-2 | `release_check.sh` green from a broken baseline | **NOT fixed — accepted, disclosed** | Reproduced; see §4. Self-corrects at the next real deploy. |
| MAJOR-3 | literal `\|\| true` in a file this commit edited | **FIXED** | `grep -rn '\|\| true' --include=*.mjs --include=*.js` → one hit, and it is the *comment recording the removal*, not an assertion. |
| MAJOR-4 | Three apps evict each other's offline cache | Logged to BACKLOG, correctly **reversed** by round 2 | Read the BACKLOG entry; it records the reversal rather than the original wrong claim. |
| MINOR-1/2/3 | | Logged | |

### Round 2 Auditor

| # | Finding | State | How I verified |
|---|---|---|---|
| **MAJOR-1** | app-v58 undid two v57 Designer fixes; red 9 releases | **NOT fixed — logged.** My ruling in §6. | **I ran the suite myself: 17 failures, exit 1.** At 320px the strip is 235px and the first result has **21px visible**. The auditor's numbers are exact. |
| MAJOR-2 | Retracted claim still in `v57-search.mjs` | **FIXED** | Same grep as above — clean. |
| MAJOR-3 | Cross-check counted comments → false RED | **FIXED** | `test/v57-search.mjs:449` now reads `codeOnly(html).match(...)`. My mutant C confirms a legitimate comment stays green. |
| MAJOR-4 | Nothing runs any of these suites | **NOT fixed — logged.** Condition C below. | `package.json` `"test"` is still the stub. |
| MAJOR-5 | Service-worker cross-eviction | Logged | |
| MINOR-1..6 | | Logged | |

### Scribe

| # | Finding | State | How I verified |
|---|---|---|---|
| **BLOCKER-1** | `BETA_HANDOFF.md` version recipe still said prod+1 | **FIXED** | Read `:918-925` and `:618-621`. Recipe now yields `beta-<prod version>`; both other copies marked. |
| **BLOCKER-2** | Debug steps named a banner and cache that no longer exist | **FIXED, and fixed well** | Now names `chemowell-beta-vN` and `"BETA — TEST DATA ONLY"`, **and redirects the reader to `ISO-5` in the isolation suite rather than to wording in a document that can rot.** That is the right instinct — a runtime gate over a prose promise. |
| MAJOR-1 | README stopped at round 2 | **FIXED** | `663a3d9` rewrote the row; round 3's three fixes and the fourth mutant are now in it. |
| MAJOR-2 | `BETA_README.md` versioning rule unmarked | **FIXED**, one residual — see §5 | Retired marker present. |
| MINOR-1..5 | | Addressed | |

**Nothing was claimed as fixed that is not fixed.** That was the highest-value thing I was asked to
look for, and I did not find an instance of it.

### My own falsification of the new gate

I did not take either auditor's falsification on trust. Three mutants, built by me:

| Mutant | Expected | Actual |
|---|---|---|
| A — delete the `litres` alias | RED | **RED**, 3 failures, exit 1 |
| B — round 1's killer: alias deleted + visible `Litres` hidden behind a literal `keywords: [` | RED | **exit 1** — by crash, not by a check. **This is exactly what the report says it does**, honestly disclosed as MINOR-2. |
| C — legitimate source comment mentioning "litres" | GREEN | **ALL GREEN**, exit 0 — the `codeOnly()` fix works |

**Round 1's blocker is genuinely closed.** The gate that replaced it is falsifiable in both
directions, and the release notes no longer overclaim.

---

## 3. Suites re-run by me

All run with the proxy unset, as briefed.

| Suite | Repo | Result |
|---|---|---|
| `test/v57-search.mjs` | app-beta | **53/53 exact, ALL GREEN**, exit 0 |
| `test/v59-para.mjs` | app-beta | **15/15**, exit 0 |
| `test/v64-logger.mjs` | app-beta | **23/23**, exit 0 |
| `test/v63-encrypted-backup.mjs` | app-beta | **22/22**, exit 0 |
| `harness/beta-isolation-test.mjs` | beta | **9/9**, exit 0 |
| `harness/eod-test.mjs` | beta | **11/11**, exit 0 |
| `test/v57-browser-notice.mjs` | app-beta | **17 FAILURES, exit 1** — the known pre-existing regression, reproduced exactly |
| `pm.py` | care-tracker | exit 0, "RESULT: clear" |

Every count quoted anywhere in the docs reproduces. **The safety property holds:** `V57-1` passes all
three assertions — the care-team sentence is in the results screen, it routes to `sym-severe` in one
tap, and the true total is reported. The 17 failures are legibility, not safety.

**Beta containment re-verified independently:** `TEST_MODE = true` (set exactly once, line 57), the
isolation suite is 9/9 at runtime, and the md5 matches production's re-derivation. The beta cannot
reach the patient's data.

---

## 4. Release mechanics — raw output, warnings included

As instructed, verbatim and complete:

```
$ cd /home/user/chemowell-app-beta && env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy bash release_check.sh

⚠️  WARNING: PUBLISHED.json names commit 2b40965, which does not exist in this
   repository -- most likely a local SHA recorded before history was replaced by a fetch.
   Re-run ./mark_published.sh (it records origin/main now, which survives a fetch).
⚠️  WARNING: no usable PUBLISHED.json record, falling back to origin/main.
   That is only trustworthy if origin/main has been refreshed since the last push --
   run 'git fetch origin' and re-run this, or a CACHE bumped in the PREVIOUS release
   could satisfy the check below. Run ./mark_published.sh after your next push too.
✅ Release check passed.
   index.html changed and sw.js's CACHE constant changed with it -- installed
   copies of the app will pick this up automatically on next open.
EXIT=0
```

**The two warnings are real and I am not absolving them with the exit code.** I confirmed
`git cat-file -t 2b40965` → `fatal: Not a valid object name`. The recorded baseline commit does not
exist in this repository, so the gate is running on its `origin/main` fallback — the same fallback
TEAM.md names as the app-v40 stranding failure.

**It is safe for this release specifically**, because I checked the fallback rather than assuming it:
`origin/main` is `0c9a63c` = "mark app-v65 published" = genuinely the last release. The verdict is
correct. The *mechanism* is not, and it self-corrects only when `mark_published.sh` runs after the
next real push. Condition A below.

### Everything else in mechanics — clean

| Check | Result |
|---|---|
| `APP_VERSION` / `CACHE` agree, app-beta | `app-v66` / `chemowell-app-v66-1` ✓ |
| `APP_VERSION` / `CACHE` agree, beta | `beta-v59` / `chemowell-beta-v59` ✓ |
| `PUBLISHED.json` still records **app-v65** | ✓ `"app_version": "app-v65"`, `"cache": "chemowell-app-v65-1"`. **Untouched since the v65 publish commit** — `git log 0c9a63c..HEAD -- PUBLISHED.json` is empty. Nothing was quietly advanced. |
| Both working trees clean | ✓ `git status --porcelain` empty in both |
| Both branches pushed | ✓ app-beta remote `663a3d9` = local HEAD; beta remote `22ff262` = local HEAD |
| Neither on `main`, neither live | ✓ app-beta `main` = `0c9a63c` (v65); beta `main` = `034aa99` (v52) |
| File modes | ✓ `100755` on both release scripts |

---

## 5. Scope — what Aaron asked for, and whether the work stayed inside it

Aaron's "fix all" covered three things. Against them:

| Asked | Delivered | Verified |
|---|---|---|
| The "litres" search issue | Fixed | The old keyword array contained `"liters", "liters"` — a **duplicate**. It now reads `"liters", "litres"`. A wasted slot became a working British-spelling alias. Real, if small. |
| Seven releases of drift in `chemowell-beta` | Fixed | Re-derived from production v59; md5 reproduces; isolation 9/9. |
| A dispatch flag left ACTIVE | **NOT yet done** — Condition B | Currently `ACTIVE`, correctly, because this chain is still running and I am the last stage. |

### Ruling on scope drift: WARRANTED, not widening

I checked the third repo directly, because that is where drift would hurt most.

**`care-tracker`'s live patient application is untouched.** `git diff main HEAD --name-only` returns
`REQUESTS.md`, `STATUS.md`, and 17 files under `harness/`. **No `index.html`, no `sw.js`, no
`send-reminders.js`, no Firebase config.** That is the answer that mattered and it is clean.

The test-infrastructure work was necessary, not elective:

- The playwright paths were hardcoded to a retired sandbox. A prior commit records that **all 17
  suites could not start at all** in a cloud session. TEAM.md's own standard is that *a gate that
  cannot start is indistinguishable from a gate that passes* — these gates were in that state.
- It paid for itself immediately: running the newly-runnable suites is **how the round-2 auditor
  found the nine-release design regression** that two audits had walked past.
- The `REQUESTS.md` and `STATUS.md` edits are Scribe's mandated job and the Rule 2 dispatch flip.

**I am ruling this in scope.** Fixing gates that cannot start is the stated purpose of this release,
not a widening of it.

### Two residual items I found that nobody else did

Neither blocks. Both should be logged.

1. **`care-tracker/STATUS.md` defines `DISPATCH: IDLE` twice and never defines `ACTIVE`.** Lines
   15–18: the first bullet says `IDLE` means no active build; the second bullet *also* says
   `DISPATCH: IDLE` where it plainly means `ACTIVE` ("a build is genuinely in progress"). Anyone
   reading that block to decide what to set is reading a contradiction. Pre-existing since
   2026-08-17, **not introduced here**, and `pm.py` does not catch it. It sits in exactly the area
   Aaron named as broken, which is why I am raising it rather than filing it silently.
2. **`BETA_README.md`'s heading still advertises the retired rule** — *"## Versioning (matches
   production, offset ahead)"*. The retired marker was correctly added, but it sits *below* the
   paragraph, so a skim-reader meets the wrong rule in the heading and again in the body before
   reaching the correction. Scribe asked for "mark, don't delete," which was honoured; the heading is
   the one place the mark does not reach.

---

## 6. The two judgement calls

### Is app-v66 worth shipping at all? — YES, SHIP IT

**My recommendation, not the Lead Developer's: ship it as-is. Do not revert.**

The Lead Developer honestly offered Aaron the cheaper option of reverting app-v66 and keeping only
the beta work plus the test-runner fix. I have looked at what that would actually buy, and the
answer is nothing:

- **The app change is not zero, it is a real fix.** The keyword array held `"liters"` **twice**. The
  duplicate did nothing. Replacing it with `"litres"` costs no risk and makes the paracentesis Help
  topic findable to someone typing British spelling. That is a genuine, if tiny, improvement.
- **Reverting is not free.** It means unwinding two version constants, and leaving `PUBLISHED.json`
  and the version history describing a release that was built, audited twice, documented and then
  withdrawn. That is more churn and more room for error than shipping two already-verified lines.
- **The valuable work needs a version to ride on.** The test and documentation repair — a safety gate
  that had been red for eight releases, 19 suites that could not start, two documentation blockers —
  is the real content here. It has to be recorded against *some* release number. Reverting the
  version bump orphans it.
- **The mechanics are already green and consistent.** Version constants agree, the release check
  passes, both suites relevant to the change are green and falsifiable.

**But Aaron should be told plainly what this is:** a housekeeping release. Nothing on his screen
changes. The value is that several broken safety checks now work again. The rewritten README row now
says this; earlier drafts buried it, and Scribe was right to call that out.

### May these releases proceed with the design regression outstanding? — YES, WITH A BINDING CONDITION

**Ruling: they may proceed. The regression must be the next release, and I am making that Condition D
rather than a suggestion.**

Why they may proceed:

- **Neither release causes it or makes it worse.** It came from app-v58. I confirmed app-v66's
  `index.html` diff is one keyword — it cannot touch that screen.
- **It is not a safety failure, and I verified that myself rather than accepting the claim.** `V57-1`
  passes all three assertions, and in the browser run `R2D-5` passes: the care-team notice's primary
  action *is* above the bottom nav on first paint. The disclaimer and the one-tap route to
  `sym-severe` are present and reachable. What was lost is legibility and visual separation.
- **Blocking a two-line housekeeping release does not fix the regression one hour sooner.** It only
  delays the gate repairs that make the regression visible in the first place.

Why it nonetheless binds the next release:

- At 320px, **21px of the first search result is visible above the bottom nav.** A person searching
  Help on the smallest supported phone gets a screen with no readable answer on it. I measured this
  myself; it is not a rounding argument.
- **It has been red for nine releases and walked past by two audits.** The thing that makes this
  serious is not the pixels, it is that a red gate stayed invisible for nine consecutive releases.
- This is the screen a frightened person reaches by typing their own words. TEAM.md's premium
  consumer-grade bar applies to it more than to most screens, not less.

**The next release is the Help search results screen, and it needs the Designer stage that these two
releases legitimately did not.** Per TEAM.md's restart rule this is a real functional miss, so it
goes to the Lead Developer and back through both mandatory gates — plus Designer, which is exactly
the stage whose earlier work app-v58 undid.

---

## 7. Conditions

**A. Run `./mark_published.sh` immediately after the push and commit `PUBLISHED.json`.** The release
gate is currently running on a fallback baseline it says it cannot trust. It is correct today by
luck. This is the step that repairs it, and TEAM.md already calls it part of the push, not a
follow-up.

**B. Set `care-tracker/STATUS.md`'s `DISPATCH:` back to `IDLE` and disable the two scheduled tasks
when this chain closes.** This is the third of Aaron's three asks and the only one still open. It is
correctly `ACTIVE` while I am running; it must not stay that way. I did not change it myself — I gate,
I do not implement.

**C. A test runner is the highest-value item on the backlog. Do not let it slip.** Round 2's MAJOR-4
is the mechanism behind *both* nine-release blind spots. Two rounds of work went into making a gate
that can fail, on top of a system where a red gate is invisible by default. `npm test` is still the
stub.

**D. The Help search results regression is the next release, with a Designer pass.** See §6.

**E. Log my two residuals** — the duplicated `IDLE` bullet in `STATUS.md`, and the `BETA_README.md`
heading.

Conditions A and B are before/at the push. C, D and E are the next work.

---

## 8. What I did not reach

Capped at ~30 minutes and naming rather than rushing:

- **The four-profile sweep** (chemo / radiation / both / Other, per-treatment medications, multi-day
  logging, real CSV). Now skipped by two audits and by me. **Defensible three times over** — no
  release here touches dose, schedule or storage logic — but the app has not had one since
  `AUDIT_full_app_v51.md`, and the BACKLOG's own note says it should not become three. It has.
  **This is now my recommendation as PM: the four-profile sweep runs on the next release that touches
  application code, regardless of how small that release looks.**
- I re-ran 7 of the 20 browser suites, not all 20. Round 2 ran all twenty and I had no reason to
  doubt the 15-green/5-red tally; I confirmed the one that matters (the 17 failures) myself.
- I did not re-derive the beta from `betaify-patch.py` myself. I verified its **output** — the md5 of
  the shipped file matches the value quoted in three documents. Scribe re-ran the generator.
- I did not diagnose `audit-v55`'s `A6` and `B8`. Round 2 flagged that neither is a count pin, so one
  may be real. Still worth ten minutes from someone.
- I did not read the app-v58 release notes to determine whether that revert was deliberate. That
  question belongs to the release that fixes it.

---

## 9. Summary for Aaron — plain language

**Both updates are good to go. Nothing you can see on screen changes.**

You asked for three things to be fixed. Two are done and I checked them myself rather than taking
anyone's word:

1. **The "litres" search problem is fixed.** Someone typing the British spelling now finds the fluid
   drainage help page. The old list had the American spelling written in twice by mistake, so one of
   the two slots was doing nothing. That is the entire change to the app — one hidden search word.
2. **The testing app has been rebuilt from the real app.** It had fallen seven versions behind. I
   confirmed the rebuilt copy is an exact match, and confirmed it still cannot reach Brandi's real
   records. That last check is the important one and it passed nine out of nine.
3. **The status flag is still switched on** — correctly, because this review was the last step. It
   needs switching off when this finishes.

**The real work here was repairs to the safety checks, not to the app.** One check meant to protect
the help screen had been quietly broken for eight versions. Nineteen more could not even start. Those
are now fixed, and I broke them on purpose myself to make sure they actually catch problems now — they
do.

**Two things you should know:**

**One good catch.** While fixing the broken checks, the team found a real problem that had been
hiding behind them: on the smallest phones, the help search results screen pushes the first answer
almost entirely off the bottom of the screen. It has been like that for nine versions. **It is not a
safety problem** — the "contact your care team" message and the emergency shortcut are both still
there and still work, and I confirmed that myself. But someone searching for help on a small phone
can barely see the answer. I am ruling that these two updates can still go out, and that fixing this
screen is the very next job.

**One honest caution.** These updates are small and low-risk, and that is exactly why the team
skipped the full deep test for the second time running. I think that was the right call both times.
But it should not happen a third time, so I have written down that the next update touching the app
gets the full test — however small it looks.

**My recommendation: ship both.** The team offered you a cheaper option of cancelling the app update
and keeping only the testing-app work. I would not take it. The app change is a genuine small fix,
cancelling it would cost more fiddling than shipping it, and the valuable repair work needs a version
number to be recorded against.

---

*Gate 8 complete. PASS WITH CONDITIONS. Conditions A and B before/at the push; C, D and E next.*
