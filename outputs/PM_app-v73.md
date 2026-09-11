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
* **RESTORE ALWAYS COMES BACK WITH REMINDERS OFF**, whatever the archive says, and the app says so.
  The missed-dose walk reads every tracked medication for every day in range, so restoring one with
  alerts on flags every dose window during the archived weeks — the flood ending a hospital stay
  produced once already.
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

* `test/v73-archived-meds.mjs` **31/31** — new.
* `test/v72-med-purpose.mjs` **47/47 → 61/61**.
* **Ten mutants, every one red on the intended check**, including: the safety one (delete
  `med.alerts = false`, board drops to 29/31); the app-v20 strip trap in both directions; dropping
  pause periods on the way back in; removing the id tie-break; rendering the Removed-medications
  section when nothing is removed; restoring under a new id; and, for B and C, a missing entry, a
  brand name whose wording drifts from its generic, and the combination product falling back to its
  generic ingredient again.

## What is deliberately exempt

* **Home is untouched.** Nothing about removed medications appears there.
* **The missed-dose engine is untouched.** Not one line of it changes; the safety argument is handled
  where the medication is restored.
* **Safari/WebKit** — Chromium only in this sandbox, as on every release here.
