# Zero Day Audit — ChemoWell app-v73 and care-tracker v75 — THIRD pass (delta)

AUDITED-COMMIT: 31a20a4d08bbdeaa6cc490ae92760e5cf7910c6c (chemowell-app-beta)
care-tracker commit examined: 866b26baf2aea205dcc0c35df7440b9c25fce4cf (v75)
VERDICT: DO NOT SHIP

Both HEADs moved under me during this pass, in both repos, to *"the suite was supplying the thing
it was meant to be checking."* Neither `index.html` changed; only suites and falsification
expectations did. I re-ran the affected mutants against the new suites and the results below are
against these two shas.

---

## THE HEADLINE, IN PLAIN WORDS

**The mechanism is right this time. I could not damage the record with it, and I tried hard.**
Bringing a medication back now suppresses only the days it was genuinely off the list, and it does
so identically on all three surfaces — the banner, the History day summaries, and the report that
goes to the doctor. Measured on care-tracker with a real fourteen-day gap:

    never removed        banner 305 | export rows 122 | 61 days with a miss
    with it removed      banner 183 | export rows   0 |  0 days
    after Bring back     banner 277 | export rows  94 | 47 days      <- only the gap is gone
    after a reload       banner 277 | export rows  94 | 47 days      <- and it stays gone

28 rows suppressed is exactly fourteen days times two Protonix windows. Every miss from before the
removal is still there. That is what the last two refusals asked for, and it is what ships.

**What stops it is the promise the caregiver reads on the day she installs it.** Three strings —
the What's New line, the toast after Bring back, and the hint under *Removed medications* — say
that only the days it was off the list are left uncounted. **That is not true of a single
medication in the list on upgrade day.** Nothing before this release wrote down the day a
medication left, so every entry already in the archive restores with a one-day span, and the whole
absence comes back as missed doses. Measured, same fixture, same medication, archive written the
way an older build leaves it:

    after Bring back     banner 305 | export rows 122 | 61 days      <- nothing suppressed at all

The "Removed medications" list does not exist before this release. So the first medication anybody
brings back is, necessarily, one of these. The app tells her the days it was away will not be
counted, and then counts them. That is the v66 failure shape exactly: true of the new path, false
of the path a real device takes.

Two more, both small to fix and both in the class this project keeps paying for: a normaliser that
strips `awayPeriods` on the way back in leaves **both suites at a full green board** while the
feature is dead after the first reload; and the records tell a reader that a wrong span is
*"correctable by removing and restoring again"* when nothing in either app can remove a span — I
measured two stacked and both survived.

**Closed since the last pass, verified:** the second refusal is genuinely fixed (numbers above);
reminders come back on and survive a reload; and the hole I found mid-pass — nothing asserted that
the APP writes `removedAt`, so deleting it from the archive write scored 41/41 and 40/40 — was
found and closed by the two commits that landed while I was writing. I re-ran that mutant against
the new suites: RED in both.

---

## BLOCKING

### B1 — The copy is untrue on the only path that exists on upgrade day

Three caregiver-facing strings, identical in substance in both apps:

* care-tracker What's New, v75: *"Its reminders come back on, and only the days it was off the list
  are left uncounted."*
* Toast after Bring back (both apps): *"… Its reminders come back on, and the days it was off the
  list are not counted as missed."*
* Hint under the *Removed medications* heading (both apps): *"… it comes back with its reminders on
  again, and only the days it was off the list are left uncounted."*

All three are unconditional. The behaviour is not. `restoreMedicationConfig()` reads
`Number(entry.removedAt) || (state.now || Date.now())`, so an archive entry without `removedAt` —
which is every archive entry written by any build before this one — produces the span
`{today, today}` and suppresses nothing.

Measured on care-tracker v75, `scratchpad/zda/probe-old.mjs`, removing the medication and then
deleting `removedAt` from the archive exactly as a pre-v75 build leaves it:

    awayPeriods recorded : [{"start":<today>,"end":<today>}]
    banner               : 305 -> 183 (removed) -> 305 (back)
    clinician export     : 122 -> 0 -> 122
    History days w/ miss :  61 -> 0 -> 61

The direction of the error is the safe one — over-reporting, visible, self-correcting — and that is
why this is a copy block and not a data block. But it is the promise the release is named for, it
is false for every medication a caregiver can actually bring back today, and the Voice's own
charter says a release can be blocked on copy alone. The records are honest about this
(*"an archive written by an older build carries no `removedAt`, so that restore gets a single-day
span"*). Only the strings the caregiver reads are not.

**The change required.** Say it conditionally, and say it on the row that is affected. The archived
row already carries *"· doses and rules were not kept"* for exactly these entries — the same entries
that lack `removedAt`, because both fields arrived in this release — so the caveat has a home. The
toast has `entry.removedAt` in hand at the moment it is written and can say one thing when the day
is known and another when it is not. The What's New line needs the word that makes it true
(*"from now on"*, or similar). Nothing about the engine needs to move.

### B2 — A normaliser that strips `awayPeriods` on load is a FULL GREEN BOARD in both suites

The app-v20 strip trap, on the field the entire redesign now rests on. One line added to
`normalizeMedication()` in each app — the same shape as the `alerts` recomputation that produced
the FIRST refusal of this release:

    delete medication.awayPeriods;

Result, against the suites at the shas above:

    care-tracker  harness/archived-meds-test.mjs   42/42 checks passed
    ChemoWell     test/v73-archived-meds.mjs       41/41 checks passed

On that build the suppression works until the app is closed and reopened, and then every day the
medication was away floods back as a missed dose — on the banner, in the day summaries and in the
clinician export — with all three strings still promising it will not.

**Why nothing catches it.** Section 4B never reloads after the restore, so the strip never gets a
chance to happen. Section 4's reload check *does* reload, but it reads `awayPeriods` out of
`localStorage` — and the strip happens in memory on load, and is only written back on the next
save, so the file still holds what the app has already forgotten. **This is the identical mistake
the README describes catching once already, for `config`:** *"the first version of that new check
read `localStorage` and passed on the broken build, because the strip happens in memory on load."*
It was fixed for `config` by reading what the screen says the app believes; it was not fixed for
`awayPeriods`, and the records claim the trap is covered *"in both directions."*

**The change required.** In 4B, after the restore, reload and re-read the banner. It must still
read the suppressed number (care-tracker 277, ChemoWell 32). That is one reload and one assertion
in each suite, and it kills this mutant. Add the matching case to both falsification scripts —
neither lists it today.

### B3 — Two records are untrue, and one of them describes a recovery that does not exist

**(a) *"correctable by removing and restoring again"* — measured false.** `README.md` (care-tracker)
and `CARETRACKER_HANDOFF.md` say, of a phone whose clock is wrong at the moment of restore, that
the resulting span is *"bounded, visible in the banner, and correctable by removing and restoring
again."* Restore **appends**:

    med.awayPeriods = (existing valid spans).concat([{ start: awayFrom, end: awayTo }]);

Nothing removes a span. Measured, two cycles on care-tracker (`scratchpad/zda/probe2.mjs`):

    cycle 1 : [{start:-14d, end:today}]
    cycle 2 : [{start:-14d, end:today}, {start:-40d, end:today}]   <- the first one is still there

There is no screen anywhere in either app that lists `awayPeriods`, and no control that clears one.
A wrong span is permanent, invisible and unrecoverable — which is the exact phrase this release's
own sign-off uses for why the first design was refused. The record must either say that plainly, or
the app must gain a way to see and clear a span. Saying it plainly is the smaller change and is what
I would do for this release.

**(b) Both patch files and both `index.html` section headers still document the design the audit
refused twice.** `harness/archived-meds-patch.py` and `harness-archived-meds-patch.py` — the Rule 0
reproducibility record for both apps — still read:

* *"Restore stamps `alertsFrom` with today and missedDosesFor() skips days before it for that
  medication."*
* *"a phone still on the OLD build ignores `alertsFrom` and shows the gap as missed"*
* *"It adds exactly ONE line to the missed-dose engine — a guard keyed on `alertsFrom`, a field no
  medication that was never archived carries"*

`alertsFrom` appears nowhere in either shipped file. It is the second refused design, described as
what ships, in the document whose job is to let the release be rebuilt from the repo alone. The
same sentence survives as the comment block immediately above `restoreMedicationConfig()` in
**both** `index.html` files (care-tracker line 4512, ChemoWell line 5905) — the first thing a future
session reads before touching this code.

Mechanically, both patches are sound: care-tracker's reproduces `index.html` byte-for-byte
(`md5 9f09b74a4f611ac8a6b13388825ce74f`), and ChemoWell's applied to the app-v72 base at `488f55d`
reproduces its `index.html` byte-for-byte (`md5 36d467b935a8d22e4edc13e7f6e76bbe`). It is only the
prose that is false — which is the half a reviewer reads.

---

## NON-BLOCKING

**N1 — ChemoWell's simulated-date control can write a backdated span, and it ships.**
`TEST_MODE = true` in this build, `state.now = simNow()`, and `deleteMedicationConfig()` stamps
`removedAt: dayStart(state.now)`. Set the date back sixty days, remove a medication, reset the date,
bring it back: the span reads `{60 days ago, today}` and sixty days of genuine missed-dose history
disappear from the banner, the day summaries and the export — permanently, invisibly, with no way
to clear it (see B3a). Every date-sensitive write in the app already follows the simulated clock, so
this is not a new class; what is new is that this is the first write that reaches BACKWARD and
changes how past days are *reported*. A logged dose at a simulated time is one row she can delete.
Worth one line in the "deliberately exempt" list rather than a fix.

**N2 — `awayPeriods` is never validated, while `pausePeriods` is.** ChemoWell's
`normalizeMedication()` runs `pausePeriods` through `normalizePausePeriods()` on every load;
`awayPeriods` is carried through untouched by `...original` in both apps. The only writer today is
`restoreMedicationConfig()`, which does filter, so nothing is wrong now — but a span that arrives
from storage, a sync or a hand-edit is never bounded or sanity-checked, and a span whose start is
a small integer would suppress the whole history. A `normalizeAwayPeriods()` beside the existing one
would close it.

**N3 — the restore day itself is inside the span, permanently.** The guard is inclusive at both
ends, so a dose window that passes later on the day she brings the medication back is never flagged
as missed, and never will be. For the removal day that is arguably right; for the restore day the
medication is back on the list and should arguably be tracked from that moment. Either answer is
defensible — but it is not stated anywhere, and an exemption nobody wrote down is indistinguishable
from an oversight.

**N4 — spans accumulate without merging.** Two overlapping cycles leave two overlapping spans (B3a).
Harmless at any realistic count; worth a merge if a clear-a-span control is ever added.

---

## WHAT I CHECKED AND FOUND CLEAN

* **The write model holds.** `git diff` of the whole release across both apps contains **zero**
  occurrences of `removeEntryDB`, `addEntryDB`, `addDoc` or `deleteDoc`. No entry is written,
  edited or deleted. Identical-timestamp tie-breaks do not arise: nothing in this release creates a
  timestamp.
* **Suppression reaches all three surfaces consistently**, measured through the app's own
  `missedDosesFor()` and `derivedMissedEntries()` rather than the screen: banner 277, export 94,
  History 47 days / 94 misses, all from the same fourteen-day span. Suppressing in one and not
  another would have been a finding either way; it does not happen.
* **It survives a reload, an edit-and-save, and a second remove/restore cycle.** The editor's
  `...(original || {})` carries the spans through a save in both apps.
* **A future or malformed `removedAt` fails safe.** A start after the end makes
  `d0 >= start && d0 <= end` unsatisfiable, so nothing is suppressed.
* **An archive written by an older build cannot inject a malformed medication** — it still goes
  through `normalizeMedication()`.
* **Both new 4B assertions can fail.** Guard deleted outright: RED on *SUPPRESSION HAPPENS* in both
  apps (305→305, 60→60). Second refusal put back (`d0 <= dayStart(p.end)` alone): RED on three
  checks including *SUPPRESSION IS BOUNDED*. `removedAt` stripped in `normalizeArchivedMeds`: RED on
  two. The `t()` for the backdating step asserts its own success, and `missedTotal()`'s
  first-reading-decides rule means a zero is read as zero rather than as unreadable, so 4B cannot go
  silently vacuous.
* **The mid-pass fix works.** The mutant that deletes `removedAt` from the archive write now goes
  RED in both apps (*"the archive wrote down the day it left, which nothing can recover later"*).
  Before that commit it was 41/41 and 40/40 green — byte-identical to the project's own
  falsification case, which asserted it went red.
* **`h()` trap:** every new attribute value in the archived-medications render is a string on both
  branches. No null or undefined reaches `h()`.
* **No page errors** in any run.

---

VERDICT: DO NOT SHIP

**Required to ship:**
1. Make the three caregiver strings true for an archive that predates this release, and say it on
   the affected row (B1).
2. Reload after the restore in section 4B of both suites and re-assert the suppressed banner
   number, so a normaliser that strips `awayPeriods` cannot score a full green board; add the
   matching mutant to both falsification scripts (B2).
3. Remove the claim that a wrong span is *"correctable by removing and restoring again"* — it is
   not — and rewrite the `alertsFrom` prose in both patch files and both `index.html` section
   headers to describe the design that actually ships (B3).

Nothing in the engine needs to move.
