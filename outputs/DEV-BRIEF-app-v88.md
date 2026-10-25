# Developer brief — app-v88: log a missed day, and give the appetite note a way in

Chain stage 1. Both items are the app-v87 Enhancer pass's own proposals (E-1, E-2), approved by
Aaron on 2026-10-25: *"those both need fixed also."* Size **M**.

## E-1 — a missed day

**The constraint that shapes it.** There is already one date-step pattern and it is used by every
other report screen: set `state.timeModal` to an object carrying a `type`, and `confirmTimeAndLog()`
routes on that type. Paracentesis (`logParacentesis`), weight, temperature, symptoms and periods all
go through it. **A second pattern would be the defect this release exists to fix, one level up** —
the bowel option list was wrong precisely because it was a second copy of something the app already
had.

**But the shared modal asks for a date AND a time, and a daily answer has no time.** Showing a time
field on "which day was this?" invites a question the record cannot answer, and the entry's stamp is
computed by `supersedeStamp` from the day anyway. So the modal gains `dateOnly`, which suppresses
the Time label, the input and the *"Defaults to now"* hint. One flag, set by one caller.

**New modal type `daily`**, carrying `kind` (`bowel_movement` / `appetite`), the chosen `value`, and
for appetite a `note`. `confirmTimeAndLog()` routes it to the existing writers with
`dayStart(parsed)` — **never to a new writer**. The writers already own the supersede stamp and the
no-op guard, which is what makes back-filling a day that already has an answer safe by construction.

**The control.** A secondary `Log another day` button under the value row on each report screen. The
value row keeps logging today in one tap — that is the common case and it must not grow a step.

**What has to be checked, because it is where this gets dangerous:**
* A date in the future. Refuse it; a daily answer about tomorrow is not a record.
* Back-filling a day **in the middle of a run of issue days**. `bowelIssueActive()` and
  `daysSinceBowelIssueStart()` read the most recent consecutive answers, so inserting a `normal`
  into Tuesday can end an alarm that is currently showing. That is correct behaviour and it must
  have a check, because nobody would notice it changing.
* A back-filled day must SUPERSEDE an existing answer for that day, not duplicate it. The writers
  do this; the check has to prove the path reaches them.

## E-2 — the appetite note

`logAppetite(value, dayStartTs, note)` already takes a note and already carries the inheritance
rule: a note survives an UNCHANGED answer and is dropped when the answer CHANGES, because *"ate a
full dinner"* under *"No Appetite"* is a kept record that reads as a contradiction. **Nothing calls
it with a note.** The only writer that ever did is `submitAppetite()`, which nothing calls at all.

**The rule for the new field, and it has to be one rule in both places or it will drift:** wherever
a note field is on screen it is **pre-filled with that day's current note**, and its value is passed
verbatim on save. That makes clearing a note possible — empty the field — and it means the field
always shows the truth rather than a blank that silently means "keep what was there". The
alternative (pass `undefined` when empty) cannot clear and was rejected for that reason.

**Also in scope: delete `submitAppetite()` and `submitBowelMovement()`.** Both dead, both still
carrying the delete-then-relog correction pattern this project has shipped and undone twice, both
already on `BACKLOG.md`. Leaving dead code that does the wrong thing next to new code that does the
right thing is how the wrong one gets wired up.

**Not in scope: a note on the bowel row.** The data layer would take it, but nothing displays or
exports one today, so adding the field means adding the display and an export column — a third
change Aaron did not ask for. Stated here so the omission is a decision rather than an oversight.

## Done means

* Both report screens can log a day that is not today, through the shared modal, date only.
* A back-filled day supersedes rather than duplicates, and a future date is refused.
* The appetite note can be entered, edited and cleared, from the logger and from the row corrector.
* `submitAppetite` and `submitBowelMovement` are gone.
* A check per bullet, **each falsified by a mutant**, including the one most likely to be written
  vacuously: *prove a back-filled `normal` ends an active bowel-issue alarm*, because a check that
  only asserts the entry exists would pass on a build where the alarm logic never re-reads it.
* Help describes the new control, and the Help ratchets added in app-v87 still pass.
