AUDITED-COMMIT: 814a767
VERDICT: DO NOT SHIP

Independent Zero Day Auditor, ChemoWell app-v88, branch `claude/caretracker-team-review-i83ik2`.
Two live, reproducible, caregiver-reachable defects on a write path, both introduced by this
release, both invisible to every suite in the gate. Either one alone blocks under Rule 2.2 ("any
release that WRITES, EDITS or DELETES a record gets an independent auditor before the PM").

The release is close. Neither finding is a design problem; both are one-line orderings in the new
`daily` branch of `confirmTimeAndLog()`. I confirmed the diagnosis of both by patching a served byte
copy and re-running the probes — the repo file was never modified (md5 `d7768f83e96ef64e30253e29330c7e5b`
before and after, confirmed).

## Gate as it stands on the shipped file

| Suite | Result |
|---|---|
| `test/v88-log-a-missed-day.mjs` | 29/29 |
| `test/v87-correct-a-past-day.mjs` | 64/64 |
| `test/v86-logging-and-labels.mjs` | 87/87 |
| `test/v55-help.mjs` | ALL GREEN |
| `test/v57-search.mjs` | 53/53 ALL GREEN |
| `test/v75-no-other-patient.mjs` | 27/27 (ratchets 0/0/0, unchanged) |
| `release_check.sh` | fails only on the missing `AUDIT*app-v88*` / `PM*app-v88*` reports — correct |

Every suite ran against `http://127.0.0.1:8899/index.html` and every one printed a count, so none of
them silently failed to start.

---

# FINDING 1 — BLOCKER. `Log another day` silently deletes an appetite note the caregiver already wrote.

**Severity: HIGH — silent loss of caregiver-entered clinical text, on the screen this release exists
to populate.**
**File:** `index.html` line 11991 (`note: opts.noteable ? '' : undefined`), consumed at line 3132
(`m.note === undefined ? undefined : String(m.note)`).

The release's own rule, stated in the brief and in the comment at `index.html:11909-11919`:
*"untouched sends `undefined` so the writer applies its own rule — keep on unchanged answer, drop on
changed; touched sends the string so clearing works."* The logger and the row corrector honour it,
through `dailyNoteToSend()`. **The modal does not.** It is opened with `note: ''`, which is not
"untouched" — it is indistinguishable from the caregiver having emptied the box. So the modal sends
"clear the note" on **every** confirm, whether or not she touched it, and the modal's note box is
never pre-filled with the day's existing note, so she has no way to see what she is about to lose.

### Reproduced

Seed one appetite entry: Fri Oct 23, `Normal`, note `"ate a full dinner"`. Open Reports → Appetite.
Tap **Log another day**, pick Oct 23 in the calendar, pick **Normal** (the answer the row already
shows, and also the modal's default), do not touch the note box, tap Confirm.

Before — one row, one export line:

    2026-10-23 | 12:00 PM | Appetite | Normal | ate a full dinner

After — the screen reads `Friday, Oct 23 — Normal` with no note, and the clinician's export reads:

    2026-10-23 | 12:00 PM | Appetite | Normal (corrected later — superseded) | ate a full dinner
    2026-10-23 | 12:00 PM | Appetite | Normal                                |

The toast said `Normal · Friday, Oct 23` — i.e. it reported a successful write, not
`Already logged as …`, because `logAppetite()` sees `prev.note !== ''` and treats the wipe as a real
correction.

### What it costs a caregiver

She fills in a day she missed, mis-taps onto a day she had already answered — which the modal's own
hint invites her to do (*"picking a day you have already answered replaces it"*) — and the sentence
she wrote about that day disappears from the screen. In the file the care team reads, that day now
appears twice: the line carrying the truthful note is flagged as having been *corrected later*, and
the line presented as the standing answer is blank. Nothing was corrected. Only the note was
removed, and she was never shown it.

### Diagnosis confirmed

Serving a copy with the initialiser changed to omit `note`, the same probe produces no second entry
and the note survives. `test/v88-log-a-missed-day.mjs` is 29/29 on both the shipped file and the
patched one — the suite cannot tell them apart. `logAnotherDay()` in that suite accepts a `note`
argument and **no call site ever passes one**, so the modal's note field is captured in `shape` and
never asserted.

### Related, same cause, lower severity

The changelog says *"There is now, on the appetite screen and on any day you correct."* There are in
fact **three** places a note can now be touched — logger, row corrector, and this modal — and the
third behaves by a different rule from the two the sentence names. The sentence is not false, but it
is the shape the Voice exists to catch: it describes two of three surfaces and the unnamed one is
the one that destroys data.

---

# FINDING 2 — BLOCKER. Double-tapping Confirm writes duplicate entries with identical timestamps.

**Severity: HIGH — duplicate records in the clinician's export, neither marked superseded.**
**File:** `index.html` lines 3130-3137 — the `await` precedes `setState({ timeModal: null })`.

Every pre-existing branch of `confirmTimeAndLog()` closes the modal **before** it awaits the write
(`med` at line 3184, `temp` at 3192, `para`, `weight`, `multi` all the same). The modal unmounts, so
a second tap has no button to land on. **The new `daily` branch inverts that order:**

    const wrote = m.kind === 'appetite' ? await logAppetite(...) : await logBowelMovement(...);
    setState({ timeModal: null });

The Confirm button stays live across the await, and there is no `dailyLogBusy` guard here — the
other two daily surfaces (`renderDailyValueLogger`, `renderDayCorrector`) both have one.

### Reproduced

Reports → Appetite → **Log another day** → Confirm tapped three times in quick succession:

    rows: [ {normal, ts 1792929600000}, {normal, ts 1792929600000}, {normal, ts 1792929600000} ]

Two taps give two rows. The export then reads:

    2026-10-25 | 12:00 PM | Appetite | Normal |
    2026-10-25 | 12:00 PM | Appetite | Normal |

`__v86Test.isSuperseded()` returns **false for both**, because `isSupersededEntry()` requires
`o.ts > e.ts` and `supersedeStamp()` re-reads `prev` from a `state.entries` that has not refreshed
between the synchronous taps, so both land on the same stamp. This is the exact hazard the comment
above `supersedeStamp()` warns about in terms: *"an equal stamp would leave which one wins down to
array order."*

### Control — this is introduced here, not inherited

The same double-tap on the **symptom** modal, same shared dialog, same Confirm button, writes
**exactly one** entry. The difference is the ordering above, not the modal.

### What it costs a caregiver

The app gives no feedback on the first tap — the dialog just sits there while the write resolves —
which is precisely the thing that produces a second tap. She then has a day listed twice in the
record with no marker saying one supersedes the other, and `Remove` takes them off one at a time.
Rule 5.5 is about exactly this class: every gate here asks about a still frame, and this is a defect
you can only see with a finger moving.

### Diagnosis confirmed

Serving a copy that closes the modal before awaiting (matching every other branch), three taps
produce one row. `test/v88-log-a-missed-day.mjs` is 29/29 on both.

---

# FINDING 3 — MEDIUM. Cancel on the row corrector does not discard the note that was typed into it.

**File:** `index.html` line 11901 — Cancel sets `editingDaily: null` and never deletes
`dailyNoteDraft[kind + ':' + dayTs]`. The draft is deleted only on a successful write (line 11888).

### Reproduced

Day Oct 23 reads `Normal — "ate a full dinner"`. Open **Correct** on it, type
`"WRONG DAY - meant Thursday"` into the note box, realise the mistake, tap **Cancel**. Reopen
**Correct** on the same day: the box shows `"WRONG DAY - meant Thursday"`, not the day's real note.
Pick `No Appetite`:

    rows: [ {normal, note "ate a full dinner"}, {none, note "WRONG DAY - meant Thursday"} ]

The abandoned text is now the standing note on that day, in the export.

The draft also survives leaving the Appetite screen and coming back (confirmed), which is defensible
on its own — but paired with a Cancel button that visibly discards the correction, it is not. Cancel
means discard everywhere else in this app.

**Not a blocker on its own**, but it is the same keying mechanism as Findings 1 and the note rule
generally, and it should be fixed in the same pass rather than scheduled.

---

# FINDING 4 — MEDIUM (suite). Section 3 of the new suite is vacuous. Proven.

**File:** `test/v88-log-a-missed-day.mjs` lines 186-192.

    t('and the newer one is what the screen shows for that day',
      /Normal/.test(shown) && !/\bNone\b[\s\S]{0,40}(Correct|Remove)[\s\S]{0,40}Normal/.test(shown), …)

Clause one, `/Normal/.test(document.body.innerText)`, is **unconditionally true** — `Normal` is a
`BOWEL_MOVEMENT_LABELS` value and the logger's own buttons are on the screen at all times. It proves
nothing.

Clause two only discriminates **by accident**. Dumping the body text under a mutant that flips
`bowelMovementEntriesByDay()` to oldest-wins shows what it actually matched:

    … Friday, Oct 23 — None | Correct | Remove | Normal · Friday, Oct 23 | …
                                                 ^^^^^^ the TOAST, still visible after 1.1s

The check fires on the toast string happening to begin with `Normal` and happening to sit within 40
characters of `Remove`. Change one word of that toast — `'Saved · ' + dayLabel` instead of
`(m.valueLabel || m.value) + ' · ' + dayLabel` — and with oldest-wins still in place the suite
reports **28/29, with section 3 green on a build that shows the superseded answer.** Section 5 was
the only thing that caught the mutant.

This is the same shape the suite's own header warns about for section 4. The suite's header names
section 5 as the one most likely to be vacuous; section 5 is in fact sound (M2+oldest-wins turns it
red). Section 3 is the one that is not.

Also at line 187: `const el = [...document.querySelectorAll('[data-correct-day]')].length;` is
assigned and never read, and line 192 is `shown.slice(0, 0) + 'screen names Normal for the corrected
day'` — a detail string that discards the evidence and prints a constant. A failing line that cannot
say what it saw is how section 4 got written vacuously the first time.

---

# FINDING 5 — MEDIUM (suite coverage). The new suite does not test its own subject.

Three mutants score **29/29 on `test/v88-log-a-missed-day.mjs`**. All three are caught elsewhere in
the gate, so the gate as a whole holds — but the suite written for E-2 does not test E-2's rule.

- **M6 — the logger passes `dailyNoteFor(...)` instead of `dailyNoteToSend(...)`.** This is the
  original E-2 defect, the one the longest comment in the diff says *"THE SUITES CAUGHT ME GETTING
  THIS WRONG."* They do not any more. Sections 6 and 7 both **touch** the box before saving, so the
  draft is defined and the two functions return the same value. **The untouched path — the only
  reason `dailyNoteToSend()` exists — is never exercised by this suite.** Caught by
  `v86-logging-and-labels`: *"the note describing the OLD answer does not follow a CHANGED one."*
- **M5 — the row corrector passes `dailyNoteFor(...)`.** Reproduces the v86/v87 red exactly:
  export line `Appetite | No Appetite | ate a full dinner`. The suite never queries
  `[data-correct-note]` at all. Caught by `v87-correct-a-past-day`.
- **M1 — `appetiteEntriesByDay()` alone flips to oldest-wins** (the two maps are duplicated code;
  someone edits one). Section 3 is bowel-only and section 5 is bowel-only; sections 6-7 are
  appetite-only via the logger. Nothing exercises supersede-on-appetite through the modal — which is
  exactly where Finding 1 lives. Caught by `v86-logging-and-labels`.

## Are the three mutants the header records weaker than they read?

Partly. They are honestly described and M2's note (that M1 did not turn section 5 red) is exactly the
right kind of disclosure. But all three are **blunt**: M1 breaks the day target and the future guard
together, M3 removes a whole field. None of them is a one-line ordering or a one-word change, and
both of my blockers are one-line orderings. A mutant that deletes a control measures whether the
suite notices the control; it does not measure whether the suite notices the control behaving wrongly.
M3 in particular ("the appetite note field removed → 5 red") is the weakest: it is the only mutant
aimed at E-2, and E-2's actual rule is what M5 and M6 show to be untested.

---

# FINDING 6 — LOW. Two new bolded control names in Help that nothing verifies.

**File:** `index.html` line 4133 (`vit-checkin-modal`) and 4147 (`sym-bowel-confusion`).

Checked by hand: both read **Log another day**, and the button at line 11993 reads `'Log another
day'`. Exact match, and the surrounding claims are true — Reports → Bowel Movement and Reports →
Appetite are the real screen names, and the control does fill in a missed day.

The brief flags the bolded-control-name sweep as deferred, and asks only that no new unverified name
be added. **Two were.** Measured: renaming the button to `Log a missed day` and leaving both Help
topics saying `Log another day` scores `v88` 29/29, `v87` 64/64, `v55-help` ALL GREEN, `v57-search`
ALL GREEN. The claim is true today and nothing holds it true tomorrow. That is the known deferred
class, and on the PM's last judgement it should be logged against the existing `BACKLOG.md` item
(now +2) rather than turned into a seventh round of guard work.

`renderHelpView()` is untouched by this diff — **no ninth prose literal was added.**

---

# FINDING 7 — LOW. Two new gendered pronouns in code comments. Rule 0, leak shape 2.

**File:** `index.html` line 11919 (*"send the draft only if **she** TOUCHED the box"*) and line 11952
(*"a refused write leaves what **she** typed on screen"*). Also `test/v88-log-a-missed-day.mjs:425`
(*"and what **she** typed reaches the record"*).

Not caregiver-facing — `v75-no-other-patient` reads shipped strings, not comments, and passes 27/27
— so no user can see it. But Rule 0 says *"no gendered pronoun anywhere including code comments"*,
and this release moved the count the wrong way.

Measured for the backlog, since nobody had: `index.html` carries **16** matches of `\b(she|her|hers)\b`
today, of which 14 pre-date this release and one is a search stopword list. A ratchet pinned at 14
would hold the line without a sweep.

---

# FINDING 8 — LOW / future, not something a caregiver of this build can hit today.

The logger's note draft is keyed by `opts.key` (`'appetite'`) alone, while the corrector's is keyed
`kind + ':' + dayTs`. The logger always writes to `dayStart(simNow())`. So a draft typed and not
saved, left while the day changes under it — real midnight with the app open, or the beta date
control — would be pre-filled into and written onto the **new** day. I confirmed the draft survives
leaving and returning to the screen, and I confirmed by reading `switchProfile()` that a **profile
switch is safe** (it calls `location.reload()`, which clears the module-level object — so there is no
cross-patient note leak, which was the thing worth checking hardest).

I could not drive the beta date control end-to-end past an overlay, so the midnight case is reasoned
from the code, not demonstrated. Say it out loud rather than fix it: it needs an unsaved draft plus a
day boundary, and the fix is one key.

---

# The back-fill and the alarm — checked, and I could not break it

`bowelIssueActive()` and `daysSinceBowelIssueStart()` read the most recent **answered** day, which a
back-fill can now create where none existed. I looked for a disagreement between the Home banner and
the report screen and did not find one: both derive from `bowelMovementEntriesByDay()`, there is no
cached copy, and section 5 of the suite genuinely discriminates (M2+oldest-wins turns it red while
everything else stays green). Back-filling a gap between two issue days correctly extends the streak;
back-filling a `normal` over the latest issue day correctly ends the alarm.

The one judgement call worth recording rather than blocking: if the record has been silent for two
weeks and the caregiver back-fills *"day 3 of the hospital stay — Diarrhea"*, the Home banner turns on
and counts from a two-week-old answer. That is the documented semantics of "the most recent answer
stands until a newer one replaces it", it was already reachable in app-v87 through `Correct`, and
changing it is a product decision, not a defect. Worth one line in the Enhancer's next pass.

# `dateOnly` and the other five modal types — checked, unaffected

`m.dateOnly` is set in exactly one place (line 11990) and read in exactly three (lines 5796-5800).
Driven, not read: the **symptom** modal and the **temperature** modal both still render the Date pill,
the `input[type="time"]`, and the *"Defaults to now — edit if logging a past time"* hint. `period`
takes the other arm of the ternary entirely and is untouched. The `&& m.type !== 'daily'` exclusion
from the future-time confirm-through is correct and is covered: removing it turns section 4's *"it
says so rather than failing silently"* red (1 fail), and removing the day guard itself turns two
checks red.

# Mutant board

Every mutant was served from a byte copy on port 8900 via `FALSIFY_BASE`. The repo file was never
written to; md5 verified before and after the whole run.

| # | Mutant | v88 suite | Rest of gate | Verdict |
|---|---|---|---|---|
| M1 | `appetiteEntriesByDay()` alone → oldest-wins | **29/29 CLEAN PASS** | v86 red (1) | suite blind, gate holds |
| M2 | daily toast reworded to `'Saved · ' + dayLabel` | **29/29 CLEAN PASS** | — | harmless alone; see M2+ |
| M2+ | M2 **and** both day-maps oldest-wins | 28/29 — **section 3 green on a build showing the OLD answer** | — | proves section 3 vacuous |
| M3 | future-day guard deleted | 27/29 (2 red) | — | caught |
| M4 | `&& m.type !== 'daily'` removed from the confirm-through | 28/29 (1 red) | — | caught |
| M5 | row corrector sends `dailyNoteFor` (reintroduces the v87 red) | **29/29 CLEAN PASS** | v87 red (1) | suite blind, gate holds |
| M6 | logger sends `dailyNoteFor` (reintroduces the v86 red) | **29/29 CLEAN PASS** | v86 red (1) | suite blind, gate holds |
| M7 | back-fill writes to today, not the day picked | 25/29 (4 red) | — | caught |
| M8 | `dateOnly` time suppression removed | 28/29 (1 red) | — | caught |
| M9 | the button renders on Appetite only | 23 run, 13 pass, 10 red (incl. the README count) | — | caught well |
| M11 | button renamed `Log a missed day`, Help prose left saying `Log another day` | **29/29 CLEAN PASS** | v87 64/64, v55-help GREEN, v57 GREEN | known deferred class |
| DX | candidate fix for Findings 1+2 (omit `note`; close before await) | 29/29 | — | both probes go clean; suite cannot tell |

**Five clean passes: M1, M2, M5, M6, M11.** M2 and the M2+ pair are the most valuable thing in this
report — they show a check whose only discriminating power came from a string that is not its
subject, which is how section 4 was written vacuously one round ago.

# What I deliberately did not cover

- **iOS/Safari rendering.** This sandbox has Chromium only. The new note inputs are set at 16px
  (the iOS zoom floor) and the new button at `minHeight: 44px`, both read from the source and both
  correct; nobody has seen either on a real phone. Exempt, as on every release here.
- **Overflow at 320/360.** The daily modal now adds a select plus a note input above the date pill.
  I did not run `test/overflow-scan.mjs` — the Designer owns that, and the modal already caps its own
  height and scrolls internally since v70.
- **The sync backend, Capacitor config, and `sw.js` beyond the CACHE bump** (`chemowell-app-v88-1`,
  matched to `APP_VERSION`, verified).
- **Concurrency against a second device.** The duplicate in Finding 2 is a single-device double-tap;
  I did not test two devices writing the same day.
- **The deferred items I was told not to re-raise**: `renderHelpView()`'s eight prose literals (count
  confirmed unchanged at eight — no ninth) and the bolded-control-name sweep, which is Finding 6 only
  because the brief asked me to check for additions.

# What a fix round should and should not be

Findings 1 and 2 are two lines in one function and I confirmed both fixes work. Finding 3 is one
`delete` in the Cancel handler. Finding 4 is a test rewrite — read the day's row out of
`[data-correcting-day]`'s own container or the history row for that day, not out of
`document.body.innerText`, which in this app also contains the toast and the changelog. Findings 5-8
are measurements for `BACKLOG.md`.

**Do not spend a round on Findings 6, 7 and 8.** They are the known-deferred classes, nothing a
caregiver of this build can hit, and the last PM's judgement was that Help work ran three rounds past
its value. Fix 1, 2 and 3, repair the section 3 check so it can fail, add one check that saves from
the modal **without touching the note box** and one that saves from the row corrector's note field —
those two alone would have caught Finding 1, M5 and M6 — and ship it.
