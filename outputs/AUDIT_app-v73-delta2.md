# Zero Day Audit — ChemoWell app-v73 and care-tracker v75 — second pass

AUDITED-COMMIT: 18c3010b02ad3f8ac017b20550ec3a2b11b2a1cb
VERDICT: DO NOT SHIP

care-tracker commit examined: `99f9c81a0c38db7274b0523feb0c3acbb4ccb924` (v75, `CACHE =
'caretracker-v75'`), with one uncommitted change in the tree — see R3.

**The brief named ChemoWell `12670ac`. HEAD moved under me while I was reading it**, to `18c3010`
("Voice: Excedrin gets no line at all, and promethazine says it makes you drowsy"). That commit is
the one I ran every suite and probe against, and it is the sha above. It touches only the purpose
table and its suite; nothing in it bears on the findings below.

---

## THE HEADLINE, IN PLAIN WORDS

**Bringing a medication back now erases every missed dose it ever had — not just the days it was
away. In the test that ships with this release the medication is gone for about two seconds, and
122 missed doses spanning two months disappear and never come back.**

The release promises the opposite, in three places the caregiver reads and twice in bold in the
records: *"the days it was away are not counted as missed"*, *"THE GAP IS WHAT IS SUPPRESSED"*.
What the code actually does is suppress **everything before the day you tap Bring back**, whether
the medication was away that day or sitting on the list being missed.

Those missed doses are not only on her screen. They are in the History day summaries, and they are
in the report that goes to the doctor. I measured that path directly: the clinician's derived
missed-dose rows for the restored medication go **122 → 0**.

And the new safety check cannot see any of it. I built the worst version of this bug I could — a
build where the stamp switches that medication's missed-dose tracking off **entirely and forever** —
and **both suites stayed fully green**: care-tracker 37/37, ChemoWell 36/36.

The good news, and it is real: the thing that refused the last pass is fixed. Reminders genuinely do
come back on, in both apps, and they survive a reload. The two copy findings I raised were both
taken. What is left is one design error, one check that still cannot fail, and two records that are
untrue again in a new particular.

---

## BLOCKING FINDINGS

### B1 — The suppression has no far end. It erases missed doses from days the medication was present.

    if (med.alertsFrom && d0 < dayStart(med.alertsFrom)) return;

One end, not two. `alertsFrom` is stamped at the moment of restore, so the guard suppresses **every
day from the start of missed-dose tracking up to the restore**, and the archive gap is only ever a
part of that span — often a tiny part.

Measured on care-tracker v75, `scratchpad/ct-gap.mjs`, driving the real missed-dose walk:

    protonix missed-dose days, no stamp : 61 days, 2026-07-12 .. 2026-09-10, 122 rows
    with the stamp restore writes       : 0
    clinician export rows (derivedMissedEntries), before -> after : 122 -> 0

The release's own suite makes the same point without meaning to. It removes the medication and
brings it straight back — the gap is the few hundred milliseconds between two clicks — and prints:

    care-tracker : 305 before -> 183 with it removed -> 183 after
    ChemoWell    :  60 before ->   0 with it removed ->   0 after

Those 122 (care-tracker) and 60 (ChemoWell) missed doses are from days the medication was on the
list, tracked, and genuinely not taken. None of them is a day it was away. All of them are gone, and
**nothing anywhere clears `alertsFrom`** — not the editor, not a second remove-and-restore, not a
reload. It is a one-way, invisible, permanent edit to what the app reports about the patient, under
a button labelled "Bring back", which is the same shape as the finding that stopped the first pass.

This is not a hypothetical caregiver. The feature exists for "removed it, want it back" — and the
most likely reason to want it back is that removing it was a mistake. Undoing the mistake silently
deletes two months of missed-dose history and tells her it restored it.

**The fix is small, and in ChemoWell it is already written.** `deleteMedicationConfig()` there
already computes `const today = dayStart(state.now)` at removal and already closes open pause
periods at that date, and `isPausedOn()` is a tested, bounded, both-ended suppression engine built
for precisely this — app-v20's own comment says so: *"a medication re-added later is not flagged for
days it was legitimately paused."* Restore should append a pause period `{start: removedDay, end:
restoreDay}` rather than invent a new unbounded field. care-tracker has no pause machinery, so it
needs `removedAt` stamped into the archive entry at removal and a two-ended test; that is one extra
field and one extra comparison.

Whatever the mechanism: **the removal date must be recorded when the removal happens.** It cannot be
recovered at restore time, which is why this version reached for "everything before now".

### B2 — The new safety check still cannot fail on what it names. The fourth version has the first version's fault.

The check is `missedAfter === missedRemoved`, read off the banner heading. It asks "did bringing it
back put the days back?" — and it passes identically for a build that suppresses the gap, a build
that suppresses all history, and a build that suppresses that medication forever.

Falsified, and this is the cheapest edit to the app that breaks the promise while leaving the check
green — one line, less typing than the real guard:

    if (med.alertsFrom) return;   // suppress this medication's missed doses ENTIRELY, forever

    care-tracker harness/archived-meds-test.mjs  -> 37/37 checks passed
    ChemoWell    test/v73-archived-meds.mjs      -> 36/36 checks passed

Both still print the reassuring line: *"THE SAFETY CHECK: bringing it back does not put the days it
was away back on the banner | 305 before -> 183 with it removed -> 183 after"*.

**ChemoWell's is worse than unfalsifiable — it is literally `0 === 0`.** The tracked medication is
the only source of missed doses in that fixture, so the check's two sides are both zero at the
moment it matters. The suite's own header records that the FIRST version of this check "scored 0
against 0 on every build, broken or not: a check that could not fail, in the one file whose whole
subject is checks that cannot fail." Three rewrites later it is scoring 0 against 0 again.

A check that can fail has to have a medication that is missed on BOTH sides of the gap: misses
before the removal, an archive gap of real days, misses after the restore. Then assert three things
separately — the gap's misses are gone, **the pre-removal misses are still there**, and today's are
still there. As written, only the first is asserted, and only in a form that also accepts "all of
them are gone".

Falsification duty on my own claim: with the real guard restored, the care-tracker suite prints
`305 -> 183 -> 183` and passes; with the mutant it prints the identical line and passes. The check
does not distinguish them, which is the finding.

---

## FINDINGS WORTH WRITING DOWN — not blocking

### N1 — A wrong device clock at the moment of restore suppresses real missed doses going forward
`dayStart(state.now || Date.now())` is trusted without a ceiling. Stamped 30 days ahead, the guard
suppresses that medication's missed doses for the next 30 days — forward-looking, real doses.
Measured: `future_30d -> 0` against a baseline of 122. Needs a wrong clock, so it is not blocking,
but `Math.min(dayStart(now), ...)` costs nothing and the same expression already exists in the file.

### N2 — Everything else I could throw at the guard fails safe
`alertsFrom` as a garbage string, `NaN`, `0`, `true`, `{}`, or a seconds-instead-of-milliseconds
timestamp all leave the count at the full 122 — no suppression, no page error. An ISO date string
(`'2026-08-01'`) is honoured and suppresses 40 of 122, which is coherent rather than dangerous. The
field survives `normalizeMedication` in both apps (both spread `...original`), survives
`backfillDefaultMedFlags` (it fills only absent keys, and no default carries `alertsFrom`), and
survives an editor save in both apps (both build `candidate` from `...(original || {})`). It is
never dropped where it must persist. The complaint in B1 is the opposite one: it never dies.

### N3 — care-tracker: `migrateSenokotV37` drops the stamp, harmlessly
It replaces a windowed `senokot` wholesale on every load, losing `alertsFrom`. The shipped Senokot
is as-needed with no `alerts`, so it cannot flood. Carried forward from the last pass; still true,
still harmless.

### N4 — care-tracker: a phone on the old build erases the stamp on the phone that has it
`medsyncPublishLocalChange` sends the whole med list. A v74 phone republishing after any medication
edit sends meds with no `alertsFrom`, and the v75 phone adopts it and loses the suppression
permanently. The release states the old-phone exemption as *"a phone still on the OLD build ignores
`alertsFrom`"* — true, but incomplete: the old phone also strips it from the new one. Worth adding to
the exemption rather than fixing, since both phones normally update together. `alertsFrom` is also
absent from the medsync field table at :772, so this change never appears in the two-phone diff the
caregiver is shown.

### N5 — Both fixes I asked for last time landed, and both are right
`confirmRestoreMed` is now cleared in `navigateTo` in both apps (N2 last time), and ChemoWell's 1s
tick guard now names it, so the armed "Yes, bring it back" is no longer rebuilt under her finger
every second (N1 last time). The archive lookup is `Object.prototype.hasOwnProperty.call(...)` in
both, with a `typeof entry !== 'object'` follow-up, matching every neighbouring lookup hardened after
v74 (N3 last time). `data-missed-clear` is on both Clear buttons. I re-drove a medication with the id
`constructor` through remove / reload / render / bring back / reload in both apps: zero page errors,
exactly one copy restored.

### N6 — Interaction and layout re-checked, nothing new (Rule 5.5)
Two-tap arm-and-confirm, a stale third tap, Remove armed while Bring back is half-armed (each
clears the other), navigation away, and the archived row at 320 / 360 / 390 with a long pasted name
all behave as they did last pass. **Exempt, said out loud: this sandbox has Chromium only, so iOS
rendering and iOS focus behaviour are not reproduced here.** No network was touched; Firebase was
stubbed and every other request aborted.

---

## THE VOICE BRIEF — every caregiver-facing string this diff touched

**The two findings from the last pass were both acted on, and both were done better than I asked.**
`promethazine` and `phenergan` now end *"It causes drowsiness."* — the ingredient effect a caregiver
reaching for something at 2am needs. **`excedrin` was removed from the table entirely** rather than
reworded, with a comment saying why: the bare name covers Tension Headache (no aspirin) and PM (a
sedating antihistamine instead of caffeine), so no one sentence is true of all of them, and a name
that cannot carry a true sentence gets none. That is the right call and a better one than my
suggestion, and the suite asserts the absence so nobody "completes the set" later.

**Everything the release changed now fails question 1 — is it true? — on the same point.** All three
strings promise that only the away days stop counting:

* changelog v75: *"Its reminders come back on from the day you bring it back, so the days it was
  away are not counted as missed doses."*
* the section, both apps: *"...it comes back with its reminders on again from today, so the days it
  was away are not counted as missed."*
* the toast, both apps: *"Its reminders come back on from today — the days it was away are not
  counted as missed."*

Per B1, the days it was **present** are not counted either. Read at 2am the sentence is clear,
warm and easy — and it describes a narrower thing than the app does. This is the v66 class again:
not a clumsy sentence, a sentence that is not true. If B1 is fixed as described, all three become
true exactly as written and need no change at all — which is the argument for fixing the code rather
than the copy.

Question 3, does the number belong on screen: yes. The banner's leading count is the number a
caregiver opens the app to find. The concern is that B1 makes it wrong, not that it is there.

ChemoWell still ships no in-app What's New, so there is no changelog entry to check there — stated
as exempt rather than skipped.

---

## WHAT I COULD NOT BREAK

* **No path in either app writes, edits or deletes an ENTRY.** Re-traced `meds`, `archivedMeds`,
  `persistMedicationConfig`, `deleteMedicationConfig`, `restoreMedicationConfig` and every medsync
  function against the new code. The write model's first clause holds. B1 is a derived-figure
  erasure, not a stored-record one — which is why it is B1 and not the end of the engagement.
* Restore under the ORIGINAL id, and the dose history joining back up: holds in both.
* The tie-break: an active medication holding the id refuses the restore by name, and the archive
  keeps its copy. Restoring twice is a no-op; a third stale tap neither duplicates nor throws.
* The `h()` / prototype trap in the new lookup and the new list render: not reachable.
* Reminders surviving a reload — the thing that failed last time — now holds in both apps, asserted
  from the saved record and behaviourally after a reload. `alerts=true`, `alertsFrom` intact.

---

## THE RECORDS — brief item 7, answered in every particular

* **Both README rows are untrue again, in a new particular.** Each asserts, in bold: *"REMINDERS
  COME BACK EXACTLY AS THEY WERE, AND THE GAP IS WHAT IS SUPPRESSED."* The first half is now true.
  **The second half is not** — what is suppressed is everything before the restore. `outputs/PM_app-
  v73.md` carries the same claim. All three must be corrected with the fix, not re-stamped.
* `cd /home/user/chemowell-app-beta && ./release_check.sh` → **FAILS**, correctly: it cannot read
  `outputs/PM_app-v73.md`, whose header is `AUDITED-COMMIT: PENDING` rather than a sha, by design
  until an audit returns. **It regenerated nothing** — `git status --porcelain` is byte-identical
  before and after. It will still refuse after this report lands, because this report refuses.
* `cd /home/user/care-tracker && python3 pm.py` → **2 BLOCKERS**, exit 1:
  * `outputs/SUITES-v75.md` is **unpushed**, and Rule 0 says nothing may exist unpushed.
  * `STATUS.md` says `index.html` is `2bae1abce0f5`; it is `83c1eff1c9a9`. Re-clone verification
    would prove nothing until that is corrected.
  * Plus the standing warning: pinned version literals in nine pre-existing harness files, none
    introduced by v75.
* **R3 — and a check of pm.py's own that cannot fail.** `outputs/SUITES-v75.md` is mid-rewrite in
  the working tree: the committed version records 36 suites and ends *"Failing or erroring suites:
  0"*; the working copy has 6 rows, alphabetically up to `encbackup-test.mjs`, and no closing line.
  pm.py read that truncated file and printed **"ok every suite recorded for v75"** — because its
  check only scans the rows that are present for FAIL/ERROR and has no idea how many there should
  be. An aborted suite run therefore produces a greener pm.py than a completed one. Worth a minimum
  row count, or a required trailing "Failing or erroring suites: N" line.
* Both suites re-run clean on the shipped builds as claimed: care-tracker 37/37, ChemoWell 36/36.
  B2 is why that is not reassuring.

---

## WHAT TO DO

1. **Fix B1: give the suppression a far end.** Stamp the removal date when the removal happens.
   ChemoWell: use the existing `pausePeriods` / `isPausedOn` engine — `{start: removedDay, end:
   restoreDay}`. care-tracker: `removedAt` in the archive entry plus a two-ended comparison.
2. **Fix B2: build a fixture with misses on BOTH sides of a real multi-day gap**, and assert three
   things separately — the gap's misses are gone, the pre-removal misses are still there, today's
   are still there. Then falsify it with `if (med.alertsFrom) return;` and watch it go red. It does
   not go red today.
3. N1 is a one-expression clamp and belongs in the same release.
4. Correct both README rows and `outputs/PM_app-v73.md`: the gap is not what is suppressed yet.
5. Clear the two pm.py blockers, and finish the suite record before pm.py is believed.
6. The copy needs no change **if** B1 is fixed. If it is not, all three strings must say plainly
   that bringing a medication back clears its whole missed-dose history — and Aaron needs telling,
   because that is a real change to what the doctor is shown.
