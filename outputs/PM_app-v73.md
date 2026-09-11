# PM sign-off — ChemoWell app-v73

AUDITED-COMMIT: PENDING
VERDICT: DO NOT SHIP

**Release:** removed medications can be brought back (A); the purpose table gains what the audit
named (B); combination products answer for themselves (C).
**Base:** app-v72 (`chemowell-app-v72-1`) · **This build:** app-v73 (`chemowell-app-v73-1`)
**Patch:** `harness-archived-meds-patch.py`, applied from the app-v72 base; refuses any other base.

This header stands at DO NOT SHIP until the independent audit of this release has returned and its
findings are closed. The gate reads it, and a sign-off that says SHIP before anybody has looked is
the placeholder failure this repo's `release_check.sh` was hardened against three times.

## What Aaron asked for

2026-09-11, picking from the Enhancer's list in the v74 / app-v72 release message: *"Do A, B and C."*

## The write model, stated before a line was written

* **APPENDS:** nothing. No code path in this release writes, edits or deletes an ENTRY.
* **CHANGES:** the medication CONFIG only — `meds` and `archivedMeds` — through the existing
  `persistMedicationConfig()`, the path every medication edit has always used.
* **The archive now keeps the WHOLE medication** (`config`) beside the `{name, sub, pausePeriods}`
  it already kept. Nothing that used to be kept is dropped. app-v20 widened this same record once
  before, for pause periods, and had to add the matching line to `normalizeArchivedMeds` because
  otherwise the next load stripped it straight back out — the same line is here for the same reason.
* **Restore puts it back under its ORIGINAL id.** Every stored dose references that id, so the old
  doses read properly again. A new id leaves them orphaned, which is exactly what typing the
  medication in again does today.
* **REMINDERS COME BACK EXACTLY AS THEY WERE, AND WHAT IS SUPPRESSED IS THE SPAN IT WAS AWAY —
  BOTH ENDS OF IT.** Removing a medication records the day it left (`removedAt`, written at the
  moment of removal because that end cannot be recovered later); restore turns that into an
  `awayPeriods` span running from that day to this one; the missed-dose walk skips a day only when
  the day falls INSIDE one of those spans. An archive written by an older build carries no
  `removedAt`, so that restore gets a single-day span — it suppresses nothing that matters and never
  reaches backwards.

  > **THE SECOND VERSION STAMPED `alertsFrom` AND SKIPPED EVERYTHING BEFORE IT, AND THE AUDIT REFUSED
  > THAT TOO — WORSE THAN THE FIRST.** The span a medication is archived for is only ever part of
  > *everything before now*, so bringing one back erased every missed dose it had ever had. On the
  > fixture, where the medication is off the list for about two seconds: 122 misses spanning two
  > months gone from the banner, from the History day summaries, and from the report that goes to the
  > doctor — measured on the export path, 122 rows to 0. One-way, invisible, permanent, under a
  > button labelled *Bring back*, in a release whose own copy promised the opposite.
  >
  > **THE FIRST VERSION SAID "RESTORE ALWAYS COMES BACK WITH REMINDERS OFF", AND THE
  > AUDIT REFUSED IT IN BOTH APPS, IN OPPOSITE DIRECTIONS.** Here it did not even hold:
  > `normalizeMedication()` recomputes `alerts` from the schedule type and never reads what was
  > saved, so the flag was erased at the next app open and the flood was live. In care-tracker it
  > stayed off forever, under a toast promising a reminders control the editor does not have.
  > The design was wrong, not only the code: *reminders off* trades a visible, recoverable problem —
  > a wall of missed doses for days she was not taking it — for an invisible, unrecoverable one.
  > The sentence is quoted rather than deleted because a sign-off that edits its own wrong claims
  > out teaches nobody what to distrust next time.
* **Pause periods DO come back.** app-v20 archives them so a medication re-added later is not flagged
  for days it was legitimately paused; dropping them on the way back in would undo that from the
  other end.
* **Tie-break:** an ACTIVE medication already holding that id refuses the restore, by name.
* **Twice:** a no-op. **Half-failure:** identical to any other medication edit.
* **This app ships NO default medications** (`DEFAULT_MEDS` is empty by design), so where the sibling
  can fall back to what it ships with, this app cannot — and the row says the doses and rules were
  not kept rather than implying otherwise.

## B and C — every line is a new medical claim

21 entries added. Each passes all nine of the app-v72 audit passes' guards unchanged: no digits, no
schedule in words, no dosage form, no route, no body site, no fever claim, every line readable by the
suite's parser, every key lowercase.

**C is the one worth reading twice.** `Tylenol PM` with its generic field filled in as acetaminophen
rendered *"Eases pain."* — true, and silent about the sedating antihistamine, which is the half that
matters at 2am. Combination products are keyed by their own name now, so the name lookup wins before
the generic fallback. **The check asserts the line is NOT the one the generic alone would give**: a
check that only asked *is there a line?* would have passed before this release too, which is the
defect class this repo spent nine audit passes on.

## Gates

* `test/v73-archived-meds.mjs` **44/44** — new.
* `test/v72-med-purpose.mjs` **47/47 → 61/61**.
* **The suite's own safety check was worthless, and putting it right took three attempts** — it
  counted selectors that do not exist here, then counted names inside a banner that collapses to
  three days, then could not tell *no banner because nothing is wrong* from *a banner I cannot read*.
  It reads the heading's count now: **60 before → 0 with the medication removed → 60 after bringing
  it back** — back to exactly where it started, because this medication was away for no days at all.
  Asserting that last number equalled the REMOVED one was green on the build that erased two months
  of history.

  **AND EVEN THAT CHECK COULD ONLY FAIL IN ONE DIRECTION.** It proves the suppression is not too
  wide and says nothing about whether it happens at all: deleting the guard from the missed-dose walk
  outright left every check green, which only breaking it on purpose was ever going to show. The
  suite now also backdates the archive to read as removed a fortnight ago — what a real phone's would
  say — and brackets the result from both sides: **60 → 32**, below the untouched number because those
  fourteen days are not missed doses, above the 0 it reads with the medication removed because every
  day outside the span is still counted. One mutant goes red on each side.
* **Every mutant red on the intended check**, including: the away-span guard removed from the
  missed-dose walk; the guard widened back to *everything before the restore*, which is the audit's
  second refusal put back; the archive not recording the day the medication left; that day stripped
  on the next load; the app-v20 strip trap in both directions; dropping
  pause periods on the way back in; removing the id tie-break; rendering the Removed-medications
  section when nothing is removed; restoring under a new id; and, for B and C, a missing entry, a
  brand name whose wording drifts from its generic, and the combination product falling back to its
  generic ingredient again.

## What is deliberately exempt

* **Home is untouched.** Nothing about removed medications appears there.
* **The missed-dose engine gains ONE LINE and nothing else** — the guard that skips a day falling
  inside an `awayPeriods` span. The earlier version of this sign-off claimed the engine was untouched,
  which was written when the design put the whole safety argument at the restore and stopped being
  true when it moved. **An exemption that is not true is worse than no exemption**, because it tells a
  reviewer not to look at the one place that changed. No medication that was never archived carries
  `awayPeriods`, so the line is a no-op for every one of them, and the walk is otherwise identical.
* **Safari/WebKit** — Chromium only in this sandbox, as on every release here.
