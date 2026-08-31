AUDITED-COMMIT: 701bfbc
VERDICT: DO NOT SHIP

# Zero Day Audit — ChemoWell app-v70 (fourth pass)

Supersedes the audits of `f0c74ca`, `095b56d` and `07e6d39`, all of which refused.
Auditor: Zero Day Auditor · 2026-08-31.

## The headline

**There is a sixth live sentence in the app claiming a hospital stay pauses something, and it is
still there in this commit. The new gate cannot see it — not because the wording is unusual, but
because of where it sits in the file.**

    { id: 'inpatient', label: 'Hospital stays', icon: 'hospital',
      blurb: 'Starting and ending a stay, and what pauses meanwhile' }

That is a Help-centre category subtitle. It is the line a caregiver reads under **Hospital stays**
before they open anything — the first thing shown to someone who came to Help *specifically* to find
out what a stay does. Nothing pauses meanwhile. This release exists to delete exactly this sentence,
in its sixth location, and it survived four passes because no gate has ever reviewed it.

It is dropped by `CODEY`. The sentence fragment carries the surrounding object braces, so the
scanner classifies it as code and skips it. **It is not alone: 17 sentences are dropped unreviewed
that way**, and I found the wrong one by scanning what the gate discards rather than what it keeps.

The allow-list is a genuinely good design and I could not fool it on the sentences it looks at. The
problem is the filter that decides what it looks at.

---

## BLOCKER 1 — a live false claim, and the blind spot that hid it

Fix the blurb. Then close the blind spot, because the blurb is not special: any user-facing string
that shares a line with the object literal around it is invisible to this gate, and this app writes
almost all of its Help metadata that way.

`CODEY` exists so a styling edit cannot churn the list, which is a real concern. But it is doing the
job at the wrong level: it filters *sentences* on characters that belong to *lines*. Extract the
string literals first — the values of `blurb:`, `label:`, `a:`, `q:`, `note:`, `text:`, `steps:[…]`
and the arguments to `helpIcon()`/`setToast()` — and scope sentences inside those. Then a brace in
the surrounding code cannot hide a sentence, and a colour change still cannot churn the list.

Verified by counting rather than reading: under the committed regexes, 33 sentences are scoped in
and reviewed (matching the suite exactly), and 17 are discarded by `CODEY` and reviewed by nobody.

## BLOCKER 2 — three ways to block or lose a dose that the behavioural check does not see

The behavioural ground truth is a real improvement and it kills the attacks that beat the source
patterns. But it is one medication, one button, one confirm, one dose — and that is a narrow slice
of the ways a dose reaches the store. All three sabotages below ran against the committed suite from
scratch copies outside the repo, each verified applied by grep first, and each was also written to
evade the source-level smoke test so that **nothing in the repo catches them at all**.

### X5 — the first dose works, the second is refused

A lock in `status()` that bites only once a dose already exists for that medication today. Reached
through a neutrally-named helper, so no `inpatient(`-shaped call appears in the scanned functions.

    v70-stay-does-not-lock.mjs: all checks passed

Proved with a direct probe that logs twice instead of once:

    committed tree : attempt 1  Confirm=true  doses=1     attempt 2  Confirm=true  doses=2
    X5             : attempt 1  Confirm=true  doses=1     attempt 2  Confirm=false doses=1

The second dose of the day is silently refused for the whole of a hospital stay. The suite logs one
dose, so it sees a healthy app.

### X6 — the dose is written, the count is right, the dose is lost

The check asserts the entry count for that `medId` goes up by exactly one. It does. The entry lands
30 days in the past.

    v70-stay-does-not-lock.mjs: all checks passed

    committed tree : doses=1  daysOffFromToday=1     (i.e. today)
    X6             : doses=1  daysOffFromToday=-29   (a month ago)

Every dose given during a stay is filed a month back. It never appears in Today's journal, and it
never covers the window it was meant to cover — so the dose that was actually given still gets
flagged as missed. Counting rows is not the same as recording a dose, and this is the gap you asked
me to find in (c).

### X4 — an entire logging route the fixture never renders

`Take all` on the Morning/Afternoon/Evening cards, removed for the duration of a stay:

    (dueMeds.length >= 2 && !isInpatientActiveNow()) ? h('button', …

    v70-stay-does-not-lock.mjs: all checks passed

This is not invented. `index.html:3535` carries a comment saying `Take all` *"was hidden for the
whole of a stay, left behind when the Restricted tiles were deleted in app-v67… Both web builds
removed it correctly; this one did not."* It is a documented past defect on this exact control, and
the gate cannot see it, because the fixture seeds **one** medication with `quickLog: true` and so
never renders a grouped card at all. The same holds for backfilling a missed dose from History
(`logMissedDose`) and for the expanded card's per-dose buttons.

**What would work.** Seed two grouped medications alongside the standalone one, drive `Take all` and
a second dose as well as the first, and assert on the stored entry — its `ts` on the expected day,
not just the row count.

## FINDING — the fixture is not the medication it says it is

You asked me to check (b) directly. The comment says *"An as-needed medication with no gap and no
day restriction, so the ONLY thing that could stop it being logged is a hospital-stay rule."* Two
parts of that are not true of what the app loads:

- **`type: 'prn'` is not a type this app has.** The string `'prn'` appears **zero** times in
  `index.html`. The medication normaliser (`index.html:1090`) reads
  `const type = original.type === 'win' ? 'win' : 'gap';`, so the seeded medication runs as a
  **gap-timer** medication. It is benign here only because `gapHours: 0`.
- **`doses: ['1 tablet']` are bare strings**, and the same normaliser keeps only entries with a
  `.label`, so the medication ends up with no dose options at all.

This is why one of my earlier probes behaved unexpectedly: a condition on `med.type !== 'prn'` fires
for this fixture, because the running type is `gap`. The check still does its job today, but its
central claim is asserted rather than verified, and the next person to reason from that comment will
reason from something untrue. Seed a medication through the shapes the normaliser actually accepts,
and assert the loaded type rather than describing it in a comment.

## The allow-list contains one sentence that is not true — and I do not think it should be deferred

You flagged `ip-undo`'s *"Logging was never blocked by the stay"* yourself. I agree the operational
meaning is right and I agree it is low-risk. I disagree about deferring it, for one reason that is
specific to this release: **the allow-list's whole value is that a sentence on it has been read and
found true.** Shipping it with a known-untrue entry on it, in the same commit that introduces it,
teaches the next reader that the list means "reviewed once" rather than "true". Cutting "never" to
*"Logging is not blocked by the stay"* is a five-character edit and one allow-list line, in the
commit that is already touching both. That is cheaper than the note explaining why it was left.

Nothing else on the list is untrue. One completeness note, not a falsehood: several entries say a
window is the hospital's when it *opened* during the stay; `inpatientCoversMoment()` also suppresses
a whole calendar day for the legacy `inpatient` day-marker, and no sentence describes that.

## (d) Allow-list completeness under the widened SCOPE

Confirmed: 33 sentences scoped in, all 33 on the list, none unreviewed among them, and the widening
to `admit|admission|ward|discharge` scoped in nothing new that is unreviewed. The widening works —
my *"while she is admitted; the ward gives the doses"* claim is now caught. The gap is not in SCOPE;
it is in `CODEY`, per Blocker 1.

## Suite runs — real numbers from this tree, this session

- `test/v70-stay-does-not-lock.mjs` — all green on the committed tree (33 sentences found). The
  behavioural checks are real: they catch B1 and B2 from my previous pass. They do not catch X4, X5
  or X6.
- `test/overflow-scan.mjs` — **170 of 170 scanned, 0 overflowing, CLEAN, exit 0.**
- `bash release_check.sh` reads this report: it reports the refusal and names the commit examined.

## What has to happen before this can ship

1. Fix the `Hospital stays` category blurb. It is a live false claim.
2. Scope sentences inside extracted string literals so `CODEY` cannot hide one. Re-run the count:
   nothing user-facing may be in the discarded set.
3. Widen the behavioural check: a grouped card and `Take all`, a second dose, and an assertion on
   the stored entry's day rather than the row count. X4, X5 and X6 must all go red.
4. Correct the fixture's medication so it is the shape its comment claims, and assert the loaded
   type.
5. Cut "never" from the `ip-undo` sentence and update its allow-list line in the same commit.

Everything else is in good shape: the allow-list design, the v69 button-name check, the overflow
needle, the removal logic, and `release_check.sh`.

## Audit hygiene

All sabotage lived under the session scratchpad, outside the repository, applied with `--file`. Each
was verified applied by grep before any conclusion was drawn from a green, and X5 and X6 were
additionally proved by a direct browser probe rather than inferred from the gate's silence. Nothing
was committed or pushed and `/home/user/care-tracker` was not touched.
