AUDITED-COMMIT: 07e6d39
VERDICT: DO NOT SHIP

# Zero Day Audit — ChemoWell app-v70 (third pass)

Supersedes the audits of `f0c74ca` and `095b56d`, both of which refused. Auditor: Zero Day Auditor ·
2026-08-31. Scope, as directed: the rewritten allow-list gate, its ground-truth check, and
`release_check.sh` as machinery.

## The headline

**I reinstated the pre-v67 lock — the app genuinely refuses to log any dose while a hospital stay is
active — and `v70-stay-does-not-lock.mjs` reported `all checks passed`. Twice, two different ways.
No other suite in the repo caught it either.**

The allow-list itself is a real improvement and I could not break it the way I broke the blacklist.
The prose half of this gate is now sound. The **ground-truth half is not**, and the ground truth is
the half that matters: prose that is true today stays true only because the code stays true.

---

## BLOCKER — the ground-truth check reads two functions, and the lock does not have to live in them

You asked me to find a dose-writing path that is neither `logMed()` nor `confirmTimeAndLog()`, or a
way to block logging without a call expression matching the pattern. Both exist. Each is a single
insertion, each was verified applied by grep before I drew any conclusion, and each was run against
the committed suite from a scratch copy outside the repo.

### B1 — put the lock back where it actually used to live: `status()`

    function status(med) {
      const now = state.now;
      if (isInpatientActiveNow()) return { locked: true, inpatient: true };

`logMed()` calls `status(med)` on its second line and obeys it:
`if ((st.locked || offDay) && !opts.force) { setState({ override: ... }); return; }`. So every Quick
Log button is locked out for the duration of a stay, and the card renderers show it as locked. This
is not a hypothetical regression — **`status()` is where the "Restricted" behaviour lived before
v67**, so it is the single most likely place for it to come back.

    Result: all checks passed
      PASS  logMed() does not consult a hospital stay before writing a dose
      PASS  confirmTimeAndLog() does not consult a hospital stay before writing a dose

Both green sentences are true as written and both are irrelevant. The lock is one frame up.

### B2 — block inside `logMed()` itself, with no call expression matching the pattern

    const ipRows = state.entries.filter(e => e.medId === 'inpatient_start' || e.medId === 'inpatient_end').sort((a, b) => a.ts - b.ts);
    const lastIp = ipRows[ipRows.length - 1];
    if (lastIp && lastIp.medId === 'inpatient_start') { setToast('Not available right now'); return; }

This is inside the very function the check reads, and it blocks every dose log during an open stay.
`/\w*[Ii]n[Pp]atient\w*\(/` requires a `(` after the word; here the word only ever appears inside
string literals.

    Result: all checks passed

Widening the pattern to catch identifiers as well as calls would stop B2 and would not touch B1.

### Nothing else in the harness catches either one

I ran both sabotages against every suite that plausibly covers this behaviour — including the v67
suites that exist *because* of this exact behaviour change:

| Suite | B1 | B2 |
|---|---|---|
| `v67-inpatient-window.mjs` | 10/10 | 10/10 |
| `v67-medflag-backfill.mjs` | 4/4 | 4/4 |
| `v67-chemo-offset.mjs` | 26/26 | 26/26 |
| `v68-treatment-clamp.mjs` | PASS 28 FAIL 0 | PASS 28 FAIL 0 |
| `v70-stay-does-not-lock.mjs` | all green | all green |

A full reinstatement of the defect this release exists to prevent ships silently, with every gate
green.

**What would work.** Stop enumerating the functions that must be innocent and assert the behaviour
instead: in a browser, seed an open stay, click a Quick Log button, and require the entry to land in
`localStorage`. That is one check, it cannot be routed around by moving the guard, and it is the
same shape as the browser suite that already catches a dead Remove button.

## FINDING — a false claim can sit outside the scanner's reach

You asked for a claim that lands outside SCOPE, NARROW and CODEY. SCOPE requires the words
`in-patient`, `hospital`, or `stay` in a recognised construction. A caregiver-facing sentence can
describe a hospital stay without using any of them:

    '. Medication logging is paused while she is admitted; the ward gives the doses, not you.'

    Result: all checks passed

*Admitted*, *admission*, *on the ward*, *while she is in* — all invisible. This is a narrower hole
than the blacklist's, because the allow-list still forces review of every sentence that does use the
scope vocabulary, and a writer reintroducing this claim would most likely say "stay". It is a
finding, not the blocker. Adding `admit|admission|ward|discharge` to SCOPE closes it.

**Credit where it is due — the attack I expected to work did not.** I predicted the `CODEY`
exclusion would swallow a claim written without a closing full stop, so that its sentence fragment
ran on into the surrounding `}` and got dropped as code:

    '. Home medication logging is paused while a stay is active, so the hospital can give the doses'

    Result: 1 FAILED — every live sentence about a hospital stay is one a person has reviewed
      NEW OR CHANGED: "Home medication logging is paused while a stay is active, so the hospital can give the doses..."

The boundary set catches it. The prose half of this gate is genuinely solid.

## The allow-list is truthful, as far as I can check it

I read all 33 entries against the code rather than against each other. I found nothing untrue. The
historical entry — *"Medications showed as 'Restricted' and could not be logged at all while a stay
was active…"* — is correctly framed in the past and describes real prior behaviour, which is exactly
the sentence the old past-tense exemption existed to protect and now needs no exemption at all.

One completeness note, not a falsehood: several allow-listed sentences say a dose window is treated
as the hospital's when it *opened* during the stay. `inpatientCoversMoment()` also suppresses a
**whole calendar day** for the legacy `inpatient` day-marker entry. No live sentence is wrong
because of it; there is simply no sentence describing it.

## `release_check.sh` — the machinery

- **Helper ordering is correct.** `report_headline`/`report_headcount`/`report_pair`/`report_sha`/
  `report_verdict` are defined at lines 376–391; the earliest use is line 420, and every other use
  (480, 489, 523, 541–543, 556, 560) is below that. Nothing calls them before they exist.
- **No variable clobbering.** The new loop uses `_f`/`_fs`; `report_pair` sets `_n` and `report_sha`
  sets `_raw`. The earlier loop that builds `AUDIT_ALL`/`PM_ALL` also uses `_f`, but it completes
  before the new loop starts, so the reuse is safe.
- **The new loop has one blind spot, and it is the same shape as the scar it was written for.** It
  reports a refusal only when `report_verdict` returns a value, and `report_pair` returns empty for
  any report with two or more unindented `AUDITED-COMMIT:` lines. So in this branch — a report
  missing — a *refusing but ambiguous* report is silently not named, which is once again the most
  important reason going unmentioned. One extra `case` arm printing "…and one report on record is
  unreadable, so its verdict is unknown" would close it.
- The end-anchored verdict pattern is right: `VERDICT: SHIPPING SOON` cannot read as SHIP.

## Suite runs — real numbers from this tree, this session

- `test/v70-stay-does-not-lock.mjs` — 7 checks, all green, exit 0. **The green is not load-bearing;
  see the blocker.**
- `test/v69-treatment-date-help.mjs` — **27/27**, exit 0. My residual finding is closed: the answer
  paragraph is read now.
- `test/v70-remove-one-date.mjs` — **16/16**. `test/v70-remove-one-date-browser.mjs` — **15/15**.
- `test/overflow-scan.mjs` — **170 of 170 scanned, 0 overflowing elements, CLEAN, exit 0.**
- Both sabotaged builds are live working apps, not crashed ones: `v70-remove-one-date-browser.mjs`
  reports **15/15, all checks passed** against B1 and against B2, including *"the app logged no
  errors while doing any of this"*. So the stay gate's green came from a functioning app with the
  lock in place, not from a build that failed to load.
- `bash release_check.sh` reads this report correctly: *"a report on record REFUSES this release:
  outputs/AUDIT_app-v70.md (examined 07e6d39) says DO NOT SHIP"*. Both of your `release_check.sh`
  fixes — the header/verdict pair format and the new refusal loop in the missing-report branch —
  work as described.

## What has to happen before this can ship

1. Replace the two-function ground truth with a behavioural check: open stay seeded, Quick Log
   clicked, entry required in the store. B1 and B2 must both go red against it.
2. Widen SCOPE with `admit|admission|ward|discharge` so the "while she is admitted" claim is scoped
   in for review.
3. Add the unreadable-report arm to the new `release_check.sh` loop.
4. Re-run B1, B2 and A1 and show them red.

Everything else in this release is in good shape: the allow-list, the v69 button-name check, the
overflow needle, the removal logic and the version bumps.

## Audit hygiene

All sabotage lived under the session scratchpad, outside the repository, applied with `--file`. Each
was verified applied by grep before any conclusion was drawn from a green. Nothing was committed or
pushed and `/home/user/care-tracker` was not touched.

## Note on the working tree at the end of this pass

As in both previous passes, uncommitted edits from another worker appeared in the repo while I was
writing up — `release_check.sh` and `test/v70-stay-does-not-lock.mjs`. **None of that is audited
here.** This verdict is against the commit named in the header. The next pass must show B1, B2 and
A1 going red on whatever is committed, and the descriptions above are complete enough to reproduce
all three as single insertions into `index.html`.
