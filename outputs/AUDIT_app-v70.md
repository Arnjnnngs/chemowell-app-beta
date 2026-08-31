# Zero Day Audit — ChemoWell app-v70 (re-audit)

AUDITED-COMMIT: 095b56d16495d37d41d793a2dce42d23de6da811

Supersedes the audit of the previous commit (`f0c74ca`), whose verdict was DO NOT SHIP.
Auditor: Zero Day Auditor · Date: 2026-08-31
Scope, as directed: concentrated on the two rewritten gates rather than re-proving the removal
logic I already could not break.

## VERDICT: DO NOT SHIP

Blocker 2 is genuinely fixed and I could not get past it. Blocker 1's *fix* is correct — the app no
longer says the wrong thing anywhere. But **the new gate written to keep it correct does not work.**
I got four different false claims past it, including the verbatim sentence it was written to catch,
and I made the app really lock dose logging during a hospital stay while it reported all green.

You asked me to assume a third hole in the past-tense exemption. There is one. There are also three
holes that have nothing to do with the exemption.

---

## BLOCKER A — `test/v70-stay-does-not-lock.mjs` does not do the job it is named for

The prose fixes are all correct and verified against the code, not against other prose:
`index.html:8717` now says logging is not locked, `ip-undo` no longer implies logging was abnormal,
and `miss-false-missed` now describes the per-window rule instead of the whole-day model. Good.

The gate meant to hold that in place is the problem. Five sabotages, all on scratch copies outside
the repo, each verified applied by grep before running. **One goes red. Four do not.**

| # | The sentence I put on the In-Patient screen (present tense, false, live) | Gate |
|---|---|---|
| S5 | *"Home medication logging is paused while a stay is active — the hospital is administering doses, not you."* (the exact pre-fix wording) | **1 FAILED** ✓ |
| S1 | *"Home medication logging is **suspended** while a stay is active…"* | **all checks passed** ✗ |
| S2 | *"You **can't log** medications while a stay is active…"* | **all checks passed** ✗ |
| S3 | *"Home medication logging is paused while a stay is active — that **was** decided when in-patient tracking **was** added."* | **all checks passed** ✗ |
| S4 | *"Every **dose button is locked** while a stay is active…"* | **all checks passed** ✗ |

**S3 is the one you asked me to hunt, and it is the worst.** The claim is byte-identical to S5 —
the CLAIMS family *does* match it. The exemption then releases it, because `sentenceAround()` splits
on `.` `?` `!` and `"` **but not on the em-dash or the semicolon**, and this codebase writes in
em-dashes on almost every line. So any present-tense claim joined by a dash to any clause containing
`was` or `were` — two of the commonest words in English — inherits that clause's exemption. The
hatch has now been holed three times in three different ways (±220 chars, the leading question, and
now the intra-sentence dash), which is the signal that the shape is wrong rather than the radius.

**S1, S2 and S4 are a separate and larger problem, and they are the same mistake this release was
opened to fix.** The commit's own transferable lesson is: *"a grep for the sentence you have already
fixed always comes back clean."* The CLAIMS family is a family of **phrasings of the sentences
already fixed**, not a family of **meanings**:

- `logging (pauses|stops|is blocked|is locked|is disabled)` — misses *suspended*, *halted*, *off*,
  *unavailable*, *on hold*.
- The "cannot log" rule requires the passive *"cannot **be** logged"*. The active *"you can't log"*
  — how a person would actually write it — walks straight through.
- Every rule that mentions locking requires the literal word **logging** next to it. *"Every dose
  button is locked"*, *"the medication cards are disabled"*, *"Log buttons are greyed out"* all
  walk through, and none of them mention logging by name.

**BLOCKER A2 — the ground-truth check does not check the ground truth.** The file's stated promise
is that *"if the app ever really does start locking logging, the gate fails rather than the prose
going quietly wrong."* I tested that literally. One line at the top of `logMed()`:

    if (isInpatientActiveNow()) { setToast('Not available right now'); return; }

`logMed()` is the real dose path — three Quick Log call sites (`index.html:3610`, `3614`, `5121`).
Every dose log in the app is now blocked during a hospital stay, which is precisely the v67
regression, and the prose is now the thing that is wrong (it promises nothing is locked).

    Result: all checks passed — including
      PASS  inpatientCoversMoment is defined once and called once — a stay still touches exactly one rule

That check counts occurrences of `inpatientCoversMoment(`. My lock uses `isInpatientActiveNow()`, so
the count is still 2 and the check is still green. It is a tripwire on one function name, not a
statement about what a stay does. Its green sentence is false, which is the failure mode this
release already declared unacceptable: *a check that prints a false sentence in green is worse than
no check.*

**What would actually work.** Invert it. Instead of enumerating bad phrasings, enumerate the small
set of live strings that mention a stay at all and require each to be on an allow-list, so a NEW
sentence about stays fails until somebody looks at it. And for the ground truth, assert on the
*call sites that gate logging* — that `logMed()` and `confirmTimeAndLog()` contain no reference to
any in-patient predicate — rather than counting one helper's name.

## BLOCKER B — FIXED. I could not break it.

The rewritten button-name check in `test/v69-treatment-date-help.mjs` is sound. The extractor is
real: it reports the card's actual labels — `Remove | Confirm clear | Keep | Clear | ▲ | ▼ | Update
| Set date` — parsed from the `h('button', …)` calls inside a paren-bounded card, and it self-tests
with `Paracentesis` as the name that must be absent. Both of my earlier escapes are dead, and so are
two more I tried:

| # | Sabotage | Baseline | Result |
|---|---|---|---|
| V3 | escape A — `press **Save schedule**` (invented name, different verb) | 26/26 | **24/26, 2 FAILED** ✓ |
| V4 | escape B — `tap **Paracentesis**` | 26/26 | **24/26, 2 FAILED** ✓ |
| V2 | invented capitalised control with **no verb** — `use the **Save Schedule** control` | 26/26 | **24/25, 1 FAILED** ✓ |
| V5 | rename the real button on the card (`Set date` → `Save date`), Help unchanged | 26/26 | **24/26, 2 FAILED** ✓ |

One residual gap, recorded as a finding rather than a blocker: the check reads only the topic's
`steps`. I put *"Fix a wrong date with the **Save schedule** button on the card"* into the topic's
**answer** paragraph (`a:`) — an instruction naming a control that does not exist — and the suite
reported **26/26, exit 0**. The answer field is prose rather than step-by-step instructions, which
is why I am not calling it a blocker, but it is the same defect class and the fix is one line:
run `boldNames` over the whole topic, not just the steps.

The lowercase-bold allowance you flagged as a judgement call is fine. Every real button label in the
app is capitalised, and a lowercase invented control name would not read as a button to anyone. The
only thing it lets through is a lowercase invented control named with no verb, which is not a
plausible way for this defect to recur.

## FINDING 6 — closed, and the check is real

Reverting `e.loggedAt || e.ts || 0` back to `e.loggedAt || 0` turns the unit suite red on exactly
the reasoning I gave: **14/16**, failing *"the date with no loggedAt can still be removed"* with
`20,25` — the date survived its own removal — and *"and removing the other one leaves nothing
behind"*. Right check, right reason, right failure message. This one is done properly.

## FINDING 4 / FINDING 5 — accepted

The unreachable toast branch is annotated rather than deleted, with an accurate note. Finding 5
(the headline jumping to the furthest treatment after a removal, via `nextChemoTs()`'s tie-break) is
logged for its own release, which is the right call — it is pre-existing shape and not a safety
issue.

## Suite runs — real numbers from this tree, this session

Every figure below is from a run I executed against the committed tree. I did not take any number
on trust.

- `test/v70-stay-does-not-lock.mjs` — 3 checks, all green, exit 0. **The total is meaningless; see
  Blocker A.**
- `test/v69-treatment-date-help.mjs` — **26/26**, exit 0. Trustworthy this time.
- `test/v70-remove-one-date.mjs` — **16/16**, exit 0.
- `test/v70-remove-one-date-browser.mjs` — **15/15**, exit 0.
- `test/overflow-scan.mjs` — **170 of 170 scanned, 0 overflowing, CLEAN, exit 0.**

## FINDING 3 — fixed, and I re-ran my own sabotage to prove it

The needle is now `'In-Patient active'`, the string actually on screen, where `"Day N of … stay"`
never was. I rebuilt the sabotage that defeated the old one — `if (inpatientActiveNow)` → `if
(true)`, so the banner renders permanently, verified applied — and re-ran the full scan:

    committed tree : 170 of 170 scanned, 0 overflowing — CLEAN,     exit 0
    banner forced  : 160 of 170 scanned, 10 COULD NOT BE REACHED — NOT CLEAN, exit 1
                     COULD NOT OPEN no-stay:home at 320px … 428px (the stay banner is still on Home)

Last time these two runs produced byte-identical CLEAN logs. Now the pass reports itself unreachable
at all ten widths and the scan fails. That is what an honest receipt looks like.

## What has to happen before this can ship

1. Rewrite `v70-stay-does-not-lock.mjs` so S1, S2, S3 and S4 all go red. The exemption needs to stop
   being a tense heuristic over a hand-rolled sentence splitter; an allow-list of the known-good
   sentences is both simpler and unfoolable.
2. Make the ground-truth check assert on the logging path itself, so S6 goes red.
3. Re-run all six of my sabotages and show them red. They are reproducible from the descriptions
   above; each is a single string replacement in `index.html`.
4. Optional, one line: extend the v69 bold-name check from `steps` to the whole topic so V1 goes red.

Nothing else in this release is blocking. The append-only removal, the version bumps, the browser
suite and the v69 gate are all in good shape.

## Audit hygiene

Every sabotage lived under the session scratchpad, outside the repository, and each suite was
pointed at it with `--file`. Each was verified applied by grep before any conclusion was drawn from
a green — no result above rests on a sabotage that did not take. Nothing was committed or pushed;
`/home/user/care-tracker` was not touched. The working tree was verified free of sabotage strings at
close.

## Note on the working tree at the end of this re-audit

As happened last time, uncommitted edits appeared in the repo from another worker while I was
writing up — `test/v70-stay-does-not-lock.mjs` is being rewritten from a blacklist of phrasings to
an allow-list of known-good sentences, which is the right direction and matches recommendation 1
above. **None of that is audited here.** This verdict is against the commit named at the top of this
file. A further re-audit is required against whatever is committed next, and it must show all six of
my sabotages (S1, S2, S3, S4, S6, and optionally V1) going red on that tree.
