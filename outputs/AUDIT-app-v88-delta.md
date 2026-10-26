AUDITED-COMMIT: 8e28f6f
VERDICT: DO NOT SHIP

Delta re-audit of ChemoWell app-v88, `git diff 814a767..8e28f6f`, branch
`claude/caretracker-team-review-i83ik2`.

**Both blockers from the previous round are fixed, and both fixes are now guarded against
recurrence. One new blocker, same root cause, one axis over: the modal still holds a single
`m.note` while the DAY is mutable, so changing your mind in the date picker carries the note
across.** That is not a future edit — it is reachable by an ordinary use of a date picker, and I
reproduced both of its shapes on the shipped file.

`index.html` md5 `89a62ba37b9046d29e90fb1eecbaf505` before and after; nothing in the repo was
edited, committed or staged. Mutants were served from a byte copy on port 8900 via `FALSIFY_BASE`,
except the pronoun ratchet, which does not read `FALSIFY_BASE` — see Finding D5.

## Baselines re-run at HEAD, and they match yours

| Suite | Result |
|---|---|
| `test/v88-log-a-missed-day.mjs` | 40/40 |
| `test/v87-correct-a-past-day.mjs` | 64/64 |
| `test/v86-logging-and-labels.mjs` | 87/87 |
| `test/v75-no-other-patient.mjs` | 29/29 |
| `test/v55-help.mjs` | ALL GREEN |
| `test/v57-search.mjs` | 53/53 ALL GREEN |

---

# D1 — BLOCKER. The modal carries one note across a day change, so switching days writes the wrong note or deletes one.

**Severity: HIGH — a note attached to the wrong day in the clinician's export, and silent deletion
of a note on a day the caregiver never looked at.**
**File:** `index.html:5695-5700` (the display expression) with `index.html:3132` (what is sent).
`state.timeModal.note` is a single value; the day is mutable underneath it.

You fixed the *touched* axis: untouched now means `undefined`, and the box shows the picked day's
note. **The day axis was not fixed.** Once the box has been touched, `m.note` is defined, so the
display falls straight through to `String(m.note)` and the lookup never runs again — and `m.note`
is still what gets sent, no matter which day is now selected. The corrector keys its draft by
`kind + ':' + dayTs` for exactly this reason. The modal has one field and a moving day, so it needs
the day change to reset or re-read `m.note`, and nothing does.

Both shapes reproduced on the shipped file. In each, the caregiver opens **Log another day**, taps
the date pill once, picks Sat Oct 24, then picks Thu Oct 22 — the calendar stays open after a pick,
so this is two taps in one open picker, which is what a person does when they realise they chose the
wrong day.

### Shape A — she clears a note and the deletion lands on the other day

Oct 24 carries `"ate a full dinner"`; Oct 22 carries `"soup"`.
Pick Oct 24 → box correctly shows `"ate a full dinner"`. She empties it, meaning to clear *Oct 24's*
note. She then realises she wanted Oct 22 and picks it. **The box shows blank** — Oct 22's real note
is not displayed, because `m.note` is now `''`. Confirm:

    2026-10-22 | Appetite | Normal (corrected later — superseded) | soup
    2026-10-22 | Appetite | Normal                                |
    2026-10-24 | Appetite | Normal                                | ate a full dinner

Oct 22's note is gone from the standing answer, the answer itself never changed, and the only copy of
the truth is on the line flagged *corrected later*. That is the previous round's blocker, byte for
byte, through a different door. Oct 24 — the day she actually meant to clear — is untouched.

### Shape B — she edits a note and it lands on the other day

Same fixtures. Pick Oct 24 → box shows `"ate a full dinner"`. She types `"vomited after lunch"`.
She switches to Oct 22. **The box keeps showing her Oct 24 text.** Confirm:

    2026-10-22 | Appetite | Normal (corrected later — superseded) | soup
    2026-10-22 | Appetite | Normal                                | vomited after lunch
    2026-10-24 | Appetite | Normal                                | ate a full dinner

A sentence written about Saturday is now the record of Thursday, in the file the care team reads.
This is the `"ate a full dinner"` under `"No Appetite"` class that v86 and v87 both went red on,
moved from the value axis to the day axis.

### Why the new section 7b does not see it

7b drives the modal over one day and never touches the box. Both shapes here require a day change
*after* the box is touched. 7b is green on the shipped file and green on both of these.

---

# D2 — MEDIUM, and it is new in this delta. The logger's draft key now collides with today's row corrector.

**File:** `index.html:11996` / `12001` (logger, now `opts.key + ':' + d0`) against `index.html:11902`
/ `11918` (corrector, `kind + ':' + dayTs`).

Before this delta the logger keyed on `'appetite'` and the corrector on `'appetite:<ts>'` — always
distinct. Keying the logger by day to close my LOW finding 8 made the two **identical for today's
row**: both are now `appetite:<dayStart(today)>`. Today's row is rendered in the history list
directly below the logger, so these are two note boxes visible on the same screen sharing one draft.

This is precisely what the corrector's own comment says the keying exists to prevent — *"two open
correctors on one screen sharing a draft would quietly write one day's note onto another"* — now
true one level up.

### Reproduced

Today logged `Normal` + note `"soup"`. Reports → Appetite:

    logger box shows                      : "soup"
    type into the LOGGER                  : "soup, ate about half"
    open Correct on today's row, box shows: "soup, ate about half"   <- the logger's draft
    tap Cancel on the corrector
    logger box now shows                  : "soup"                   <- her typing is gone

Cancel on one control silently discards what is typed in a different control, with no message. The
reverse direction holds too: text typed in the logger is presented inside the corrector as if it were
that day's recorded note.

Bounded to today — a corrector for any other day keys differently, so there is no cross-day
contamination here. Not a blocker on its own, but it is a regression introduced by this delta and it
belongs in the same pass as D1, since both are the one-note-two-contexts shape.

---

# D3 — MEDIUM (suite). You were right: the two sections added are the wrong two. M5 and M6 still clean-pass.

Re-ran all five. **M5, M6, M11, M1 and M2 are all still 40/40 on `test/v88-log-a-missed-day.mjs`.**

| Mutant | v88 | Rest of gate |
|---|---|---|
| M5 — corrector sends `dailyNoteFor` (the v87 red) | **40/40 CLEAN PASS** | v87 red (1) |
| M6 — logger sends `dailyNoteFor` (the v86 red) | **40/40 CLEAN PASS** | v86 red (1) |
| M1 — appetite map alone → oldest-wins | **40/40 CLEAN PASS** | v86 red (1) |
| M2 — daily toast reworded | **40/40 CLEAN PASS** | — (harmless alone; see D6) |
| M11 — button renamed, Help prose left behind | **40/40 CLEAN PASS** | v87 64/64, v55-help GREEN |

**Exactly why, and it is one fixture away from fixed.** The discriminating case for both M5 and M6 is
the same: **an untouched note box, on a day that already carries a note, picking a DIFFERENT answer.**
`dailyNoteToSend` sends `undefined` and the writer drops the note; `dailyNoteFor` sends the old
string and it follows the new answer.

- **7d** seeds a day with `value: "normal"` and **no note**, then **types** `"only managed toast"`
  before picking. With the draft set, both functions return the same string. It tests that the field
  exists and that typed text reaches the record — not the rule.
- **7e** deletes the draft before the save, so again both functions agree. It is correctly aimed at
  Cancel and it does catch M14; it is not aimed at the note rule.
- **7b** is the modal. **The logger's untouched path is still not exercised anywhere**, which is the
  same gap I reported last round — sections 6 and 7 both type.

Two changes close it: seed 7d's fixture with a note and do not touch the box before picking a
different answer; add the same case on the logger. Each is a few lines and each would turn one of M5
and M6 red.

The gate as a whole still holds — v87 catches M5, v86 catches M6 — so this is not why I am blocking.

---

# D4 — MEDIUM (suite). 7b's display check is vacuous, and it is guarding the half of the fix you named as the root cause.

**File:** `test/v88-log-a-missed-day.mjs`, the check named
*"and the modal shows the note that day already has, rather than an empty box"*, asserting
`r.ok && r.shape.hasNote === true`.

`hasNote` is `!!d.querySelector('[data-daily-modal-note]')` — **it tests that a box is rendered, not
that anything is in it.** The check's name promises the display; the assertion cannot see it.

Measured. **M16** reverts the display expression alone to
`value: m.note === undefined ? '' : String(m.note)` — the box never shows the day's note again,
which is the exact conflation you identified as the cause — and leaves the *sent* value correct.
Result: **40/40, every suite green.** The half of the fix you singled out has no guard at all, and
the check that reads as its guard is the one that cannot fail.

The lift is one line: `logAnotherDay()` already builds `shape`; capture the input's `.value` there
and assert it equals the day's note. (My own probe harness captures it as `noteValue` — the suite's
`shape` does not.)

---

# D5 — the pronoun ratchet is sound. Verified independently, and a note on how to falsify it.

`FALSIFY_BASE` does not reach this suite — it reads the repo from disk
(`fs.readFileSync(path.join(ROOT, f))`), so a mutant served on another port is invisible to it. My
first attempt to falsify it reported `36 found` for both a +1 and a −1 mutant, which looked like a
dead ratchet and was in fact a harness that never reached it. Worth writing down, because a suite
that cannot be falsified the way every other suite here is falsified is a suite someone will later
believe they have tested.

Re-run in a copied tree, it is correct in both directions:

    baseline  36 found, ratchet allows 36                      29/29
    +1        FAIL  37 found, ratchet allows 36 -- write they/them
    -1        FAIL  35 found, ratchet set at 36 -- lower it to 35

Three legitimate categories named in the comment, both directions checked, debt logged separately
rather than folded into the release. This is the right shape and it closes my LOW finding 7.

---

# D6 — confirmed fixed, with the falsification

- **Blocker 1 recurrence is guarded.** M12 restores `note: opts.noteable ? '' : undefined` at the
  modal opener → 7b goes red with the exact export shape from last round.
- **Blocker 2 recurrence is guarded.** M13 restores the await-first ordering and removes the busy
  flag → **two** checks red, including *"no two entries share a timestamp"*, which is the one that
  names the real hazard rather than the symptom.
- **Cancel is guarded.** M14 removes the `delete` from the Cancel handler → 7e red.
- **Section 3 is no longer vacuous — my finding 4 is closed and I falsified the fix.** Serving
  oldest-wins **plus** the reworded toast, which scored section 3 green last round, now reports
  `FAIL and the newer answer is what that row shows | "Saturday, Oct 24 — None Correct Remove"`.
  It reads the day's own row container and the detail string carries the evidence.
- **No gendered pronoun was added to shipped code by this delta** (the only matches in the diff are
  inside the new ratchet's own comment and its regex, which is correct).

# The ordering change in the shared function — checked, nothing else broken

- **The other branches are untouched and behave.** Driven, not read: the **symptom** modal and the
  **temperature** modal both still render the Date pill, the `input[type="time"]` and the
  *"Defaults to now — edit if logging a past time"* hint. A double tap on Confirm in the **symptom**
  modal still writes exactly one entry.
- **`dailyLogBusy` is not left set.** Three sequential writes from all three surfaces in one session
  — modal, then logger, then corrector — all land, with strictly increasing stamps
  (`…000`, `…001`, `…002`). If the flag were stranded the second write would have been silently
  dropped.
- **The captures are correct.** `kind`, `value`, `valueLabel` and `note` are read before
  `setState({ timeModal: null })` nulls `state.timeModal`, and the toast uses the locals. I looked
  for a use of `m.` after the null inside that branch and there is none.

**One thing I would move, and it is a future problem rather than something a caregiver can hit:**
`dailyLogBusy = true` sits *outside* the `try`, with `setState({ timeModal: null })` — a full
app re-render — between it and the `try`. If that render ever throws, the flag is stranded `true` and
every daily write on all three surfaces goes silently dead until the app is reloaded. Nothing reaches
it today. It is a one-line ordering, which is the class that has now bitten this release twice, so it
is worth moving `dailyLogBusy = true` inside the `try` while the file is open — not worth a round of
its own.

# Also future-only, say it and ship it

- **M15** — reverting the logger key to drop the day is a clean 40/40 pass, so the midnight-rollover
  fix is unguarded. Consistent with that having been a backlog measurement; not worth a check.
- **M11** — the Help bolded-name class, unchanged and still clean-passing. Agreed deferred.
- **`index.html:11921`** — the comment above `dailyNoteDraft` still reads *"Per-screen note drafts.
  Keyed by logger key so bowel and appetite cannot overwrite each other."* It is now keyed by screen
  **and day** in both places. One stale sentence, and this project's own record says an invented or
  outdated mechanism in a comment is what the next reader builds on. Fix it with D2, since D2 is a
  defect in exactly what that sentence describes.

# What I deliberately did not cover

iOS/Safari rendering (Chromium only — the new input is 16px and the button 44px, read from source,
never seen on a phone) · `overflow-scan` at 320/360 · sync backend, Capacitor, `sw.js` beyond the
CACHE/version pairing · two-device concurrency · the deferred Help literals and the bolded-name sweep
beyond confirming no new literal · `outputs/AUDIT-app-v88.md` and `README.md`, which are documentation
in this diff.

# What a fix round should be

**D1 is the only thing standing between this and a ship.** One decision: when the picked day changes,
either reset `m.note` to `undefined` (the box then re-reads the new day and the caregiver re-types if
she meant to) or key the modal's note by day the way the corrector does. The first is simpler and
matches the rule the other two surfaces already follow.

**D2** is the same shape and the same pass — give the logger a key the corrector cannot collide with.
**D3** is one fixture and one case. **D4** is capturing a value you already have in `shape`.

Everything else above is a measurement or a comment. I would not spend a round on D5's harness note,
M11, M15 or the stale comment beyond fixing the last one in passing.
