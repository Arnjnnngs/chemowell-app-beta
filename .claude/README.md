# `.claude/` — why this directory exists

## `settings.json`

Two things, both added 2026-09-13 after one specific patient's app leaked into this product.

**`hooks`** run `session-guard.sh` at session start and at every stop: it says what this product is,
warns when the other patient's repo is visible in the working directory, and runs the four-shape
check in `test/v75-no-other-patient.mjs`. It never blocks — a guard that stops a session gets
disabled the first time it is wrong, and then it protects nothing. `release_check.sh` is the one
that blocks.

**`claudeMdExcludes`** is the important one, and it is the mechanical version of "one session per
product". All three repos sit under a single working directory, so reading any file in
`care-tracker` pulls its `CLAUDE.md` — 719 lines naming one patient nine times and listing four of
her medications — into a session working on THIS product. That is how the leak happened. These
patterns stop those files loading at all.

The `care-tracker-staging` entries are there ahead of a pending rename of `chemowell-beta`, which
despite its name is care-tracker's staging copy. Listing both names means the rename cannot silently
turn the guard off.

**If this ever stops working, check the setting name against the current Claude Code docs before
assuming the file is at fault.** The whole class of bug this directory exists for was a file whose
name the loader did not recognise, failing silently.

## `session-guard.sh`

Print-only, exits 0 unconditionally, `set -uo pipefail` with no `-e`. It cannot wedge a session.
