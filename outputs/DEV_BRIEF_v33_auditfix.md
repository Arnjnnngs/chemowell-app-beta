# DEV BRIEF — v33 audit fix pass (chain restart after Auditor FAIL)

## Why the previous attempt failed
The CSV exporter was written to handle CSV *syntax* (quoting for commas/quotes/newlines) but not
CSV *semantics in the consuming application* — spreadsheet apps evaluate cell content beginning
with `= + - @` (and tab/CR variants) as formulas. Free-text health notes flow into those cells
verbatim, so the export the UI sells as "ready for doctor visits" could render `#NAME?` garbage
for benign notes (`-3 lbs overnight`) or, worse, carry a crafted DDE payload. Root cause: the
implementer treated "escape the CSV" as a format problem, not a threat-model problem. Lesson:
any export consumed by a third-party app gets audited against that app's execution rules
(OWASP CSV Injection), not just the file format spec.

## Fix list (from AUDIT_v33.md)
- **M1** `csvField()`: values matching `/^[=+\-@\t\r]/` get a leading apostrophe before the
  existing quote-escaping (OWASP-recommended neutralization; visible `'` in the cell is the
  accepted tradeoff). Applies to every column — notes, details, and future fields alike.
- **m1/m3** radiation backdate: one soft second-confirm (same pattern as the existing `futureOk`)
  when the picked day already has a session and/or the date is >1 year past — composed message,
  single extra Confirm, never a hard block (real courses do occasionally have two fractions/day,
  and old backfills are legal).
- **m2** planned-total input: out-of-range/non-numeric entry now toasts "Planned total must be a
  number from 1 to 99" instead of silently blanking.

## Definition of done
All suites green including new checks: CSV neutralizes `=2+2` note; duplicate-day backdate asks
before logging; invalid planned total gives feedback. Lead Auditor reproduces the original M1
repro and confirms it no longer exports raw.
