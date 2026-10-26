AUDITED-COMMIT: 5538d0a
VERDICT: DO NOT SHIP

Delta-2 re-audit of ChemoWell app-v88, `git diff 8e28f6f..5538d0a`, branch
`claude/caretracker-team-review-i83ik2`.

**D1 through D4 are genuinely fixed, I reproduced every one of your three survivor results
independently, and the note rule is now closed on every axis where a wrong value could be WRITTEN.
One thing remains that a caregiver can hit, and it is a side effect of the D1 fix itself: tapping
the day that is already selected silently discards what was typed in the note box.** One condition
on a line that already exists. It loses typing; it does not corrupt a record.

**And the single most useful thing in this pass is not a code defect: the D1 fix disarmed the guard
for the blocker it was built on top of.** Restoring `note: ''` at the modal opener — the original
blocker, exactly — now scores **52/52**, where the identical mutant turned 7b red one round ago.
That is this project's own pattern moved up a level: the previous round's fix written in the shape
the previous round's lesson warned against, this time in the guards.

`index.html` md5 `fb85d3077952e6ffdb7a0881befed28f` before and after; nothing edited, committed or
staged. Mutants served from byte copies on ports 8900/8901 via `FALSIFY_BASE`.

## Baselines re-run at HEAD — they match yours

| Suite | Result |
|---|---|
| `test/v88-log-a-missed-day.mjs` | 52/52 |
| `test/v87-correct-a-past-day.mjs` | 64/64 |
| `test/v86-logging-and-labels.mjs` | 87/87 |
| `test/v75-no-other-patient.mjs` | 29/29 |
| `test/v55-help.mjs` | ALL GREEN |
| `test/v57-search.mjs` | 53/53 ALL GREEN |

## Your three survivors, re-run here rather than taken on trust

| Mutant | Delta-1 | Now |
|---|---|---|
| M5 — corrector sends `dailyNoteFor` | 52/52 clean pass | **51/52** — *the row does not carry the old note onto the new answer* |
| M6 — logger sends `dailyNoteFor` | 52/52 clean pass | **51/52** — *the logger does not carry the old note onto the new answer* |
| M16 — display expression always blank | 52/52 clean pass | **49/52** — 7b plus 7f shapes A and B |

Your counts are exact. 7d2 is the right fixture and it is doing the work.

---

# E1 — THE ONE LIVE DEFECT. Re-tapping the day already selected discards what was typed.

**Severity: LOW — unsaved typing is lost. Nothing wrong is written and nothing in the record is
deleted. But it is reachable today, by a plausible gesture, and it is silent.**
**File:** `index.html:5808-5817` — the reset fires on *every* calendar cell click, including the
cell that is already the selected day.

The D1 fix is right about the axis and slightly too eager about the trigger. `renderCalendar`'s
`onPick` now runs `state.timeModal.note = undefined` whenever any date cell is clicked. It does not
ask whether the date actually changed.

### Reproduced on the shipped file

Oct 24 carries `"soup"`. Open **Log another day**, tap the date pill, tap Oct 24:

    box shows                           : "soup"
    type                                : "vomited twice"
    tap the SAME highlighted Oct 24 cell: (reset fires)
    box now shows                       : "soup"        <- her typing is gone, no message

The calendar does not close after a pick — only the pill (showing `Sat, Oct 24 ▲`) collapses it —
so tapping the highlighted date again to dismiss the picker is a thing a person does. Her sentence
disappears and the box quietly shows the old note instead.

**Why I am calling it rather than waving it through.** You set the rule for me: *"I will not ship
over anything a caregiver can actually hit."* This is hittable. It is also the smallest thing I have
blocked on in four rounds, and I want the proportion on the record: the loss is **visible** — the box
content changes in front of her — and nothing reaches the clinician's export wrong. The fix is one
condition on a line that already exists:

    if (state.timeModal.type === 'daily' && ds !== state.timeModal.timeValue.slice(0, 10))

If you judge that below your bar, the rest of this release is clean and I would rather you ship with
this paragraph recorded than spend a fifth round. That is your call, not mine; my call is that it is
reachable, so I report it as reachable.

---

# E2 — THE GUARD FOR BLOCKER 1 IS GONE, AND THE D1 FIX IS WHAT REMOVED IT.

**Severity: MEDIUM as a suite finding — nothing is wrong on HEAD. The next edit reintroduces the
release's worst defect silently.**

**M23** restores `note: opts.noteable ? '' : undefined` at the modal opener — the original blocker,
character for character. One round ago the identical mutant (M12) turned 7b red. **Now it is
52/52.**

The D1 fix is why. 7b drives `logAnotherDay(..., 2, 'normal')`, which **picks a day**, and the
day-pick reset overwrites whatever the opener put in `m.note` before Confirm is ever reached. So 7b
no longer exercises the opener's initial value at all.

**The opener's value is still load-bearing**, on the one path where no day is picked: open
**Log another day** and Confirm without touching the calendar. I drove that path on both builds:

    HEAD (correct)        box at open: "ate a full dinner"  -> no-op, CSV unchanged
    M23  (blocker back)   box at open: ""                   -> note deleted:
        2026-10-26 | Appetite | Normal (corrected later — superseded) | ate a full dinner
        2026-10-26 | Appetite | Normal                                |

That is the original export shape, on a reachable path, scoring 52/52.

**The fix is one case, not a round:** drive the modal, Confirm **without touching the calendar**, on
a day that carries a note. It is also the cheapest check in the suite — no calendar driving at all.

---

# E3 — all three components of `noteKey` can be deleted individually and the suite stays green.

| Mutant | v88 | What it reintroduces |
|---|---|---|
| **M19** — drop `surface` | **52/52** | **D2 exactly** — verified below |
| M20 — drop `day` | 52/52 | the midnight rollover (your agreed backlog item) |
| M21 — drop `kind` | 52/52 | bowel/appetite crossing — **unreachable today**, see below |

**M19 is the one that matters, and I confirmed the mutant is valid rather than assuming it.** Run
side by side on HEAD and on the M19 copy, driving D2's exact sequence — type in the logger, open
Correct on today's row, tap Cancel:

    HEAD  corrector box shows "soup" (the day's real note); logger keeps "soup, ate about half"
    M19   corrector box shows "soup, ate about half" (the logger's draft);
          logger box after Cancel reverts to "soup" — her typing silently gone

So the `surface` component is doing real work and nothing holds it there. One check: type in the
logger, open today's corrector, assert the corrector shows the day's note and not the logger's text.

**M21 is reachable only by a future edit, and I want that said plainly rather than counted against
you.** `kind` only matters if two kinds share a surface and a day, and bowel is `noteable: false` —
it has no note box, so no bowel draft is ever written. The component is correct defence for the day
somebody makes bowel noteable; it cannot be exercised now. **M20 is the backlog rollover you and I
already agreed is a measurement.** Neither needs a check.

**M22** — reverting `dailyLogBusy = true` to outside the `try` — is also 52/52, and also future-only:
exercising it requires a render that throws. Not worth a check; the ordering is right now and that
is what matters.

---

# Question 1 — is the note rule one rule? The invariant is closed. Here is the enumeration.

**The RULE is one rule.** All three surfaces implement *untouched ⇒ undefined ⇒ the writer decides;
touched ⇒ send the string*.

**The MECHANISM is still two**, and that is the honest answer to why this has now been wrong twice:
the logger and the corrector share `dailyNoteDraft` keyed by `noteKey(surface, kind, day)`; the modal
uses a bare `m.note` on the modal object, with "untouched" re-established by hand at the one place
the day can move. Every defect in this release has come out of that asymmetry, and E1 is its third
consequence — the hand-written reset overreaching.

I enumerated every axis that can leave `m.note` defined-but-wrong and drove or read each one:

| Axis | Status |
|---|---|
| **touched** — box edited, value sent verbatim | closed round 1 |
| **day** — day changes under a typed note | closed here; see below |
| **surface** — two boxes sharing a draft | closed by `noteKey` (D2) |
| **kind** — bowel and appetite crossing | no control changes `kind` while the modal is open |
| **value** — answer changed with text in the box | correct by design: she typed it, it is sent |
| **month arrow** (`calShift`) | moves `calCursor` only; `timeValue` and the display are untouched |
| **reopen** | `setState` builds a fresh modal object each time |
| **modal Cancel** | the note lives on the modal object and is discarded with it; no draft map involved |

**The day axis is genuinely closed, and I checked it structurally rather than by driving one case.**
`grep -n "timeModal.timeValue = "` returns exactly two sites: line 5808, the calendar pick, which
carries the reset; and line 5830, the time input, which mutates only the `T…` portion and is
suppressed under `dateOnly`. **There is no third way to move the day**, so there is no third way for
a note to outlive its day.

**Conclusion: closed on every axis where a wrong value can be written.** What is left is the reset
firing when the day did not actually change — E1 — which loses typing rather than writing anything.

If you want the asymmetry gone rather than managed, the modal's note belongs in `dailyNoteDraft`
under `noteKey('modal', kind, pickedDay)`. That makes "untouched" a property of the key instead of a
hand-written reset, and both E1 and E2 stop being possible rather than being fixed. **I am not asking
for that in this release** — it is a refactor on a release that is otherwise ready, and the two
one-line fixes above are the proportionate answer.

---

# Question 2 — 7f is not vacuous. Both of the things you were worried about are safe.

**`pickDay`'s retry cannot mask a refusal.** Three cases, all of which end red rather than green:

- *The app genuinely will not offer the day.* `attempt` finds no cell → false. The pill click then
  **closes** the open calendar → `attempt` false again → `second === false` → the precondition
  *"two different days were picked in one open calendar"* goes red. The refusal surfaces; it is not
  swallowed.
- *The click lands but does nothing* (disabled cell). `attempt` returns true, but the next assertion
  is `boxNow === 'soup'`, and with the day unchanged the box still holds day −1's state. Red.
- *The calendar merely needed reopening* — the only case the retry is for, and the one it handles.

Measured, not reasoned: **M17 turns 7f red four times and M18 six times, both through `pickDay`.** A
helper that masked refusals could not do that.

**The `d3` selection is safe, with about a day of margin on each side.** The fixtures are d−1 at
noon and d−3 at noon; the cutoff is `Date.now() - 2*DAY`, which lands somewhere on day −2 whatever
hour the suite runs. d−3 noon is always below it and d−1 noon always above, so `d3` is always the
newest entry on day −3 — including a superseding one at `+1s`. I checked the boundary at both ends of
the day and it does not move.

**Two things I would still tighten, neither of them vacuity:**

1. **`want = String(target.getDate())` near a month boundary.** On, say, Nov 2 the back-3 target is
   Oct 30 while the grid shows November; `attempt` finds no `30` and the precondition goes red —
   loud, but a red that is the calendar's fault rather than the app's. One line closes it: after a
   pick, assert the pill label names the expected date. Same class as the fragility already noted in
   section 4.
2. **Two dead fields.** `shape.hasNote` is still set at line 100 and never read now that
   `noteShown` replaced it, and the initial `noteShown` capture at line 104 is overwritten at line
   130. Harmless, but `hasNote` is exactly the assertion that was vacuous last round, and leaving it
   in `shape` is an invitation to assert on it again.

**On your two harness defects — you have not papered over anything.** Re-reading the note box after
the day is picked is correct and is the only way the check can mean what its name says; reopening
the collapsed calendar is the harness doing what a finger does. I verified both by the mutants
above: if either were hiding something, M16/M17/M18 could not go red through the same code paths.

---

# Question 3 — nothing in the diff is broken. Driven, not read.

- **The shared calendar handler still works for non-daily types.** A **symptom** backdated three
  days: pill reads `Fri, Oct 23 ▲`, the time input is still rendered, and the entry lands exactly
  3 days back. The `type === 'daily'` guard holds.
- **Blocker 2 stays fixed.** Three taps on Confirm → one row.
- **The bowel modal is unaffected** by the note work: no note box (`noteable: false`), writes
  normally.
- **`dailyLogBusy` is released, now from inside the `try`.** Three sequential writes in one session —
  modal, then logger, then corrector — all land, with strictly increasing stamps (`…000`, `…001`,
  `…002`). No stranded flag, no stamp collision.
- **Recurrence guards still bite:** M24 (await-first) → 2 red, M25 (Cancel keeps draft) → 1 red,
  M26 (oldest-wins + reworded toast, the pair that defeated the old section 3) → 2 red.
- **No gendered pronoun added by this delta**; `v75` 29/29 with the ratchet at 36.
- No page error thrown in any probe, on any page.

# Mutant board

| # | Mutant | v88 | Verdict |
|---|---|---|---|
| M5 | corrector sends `dailyNoteFor` | 51/52 | **now caught** (was clean) |
| M6 | logger sends `dailyNoteFor` | 51/52 | **now caught** (was clean) |
| M16 | display expression always blank | 49/52 | **now caught** (was clean) |
| M17 | day-pick reset removed (D1 reverted) | 48/52 | caught, both shapes, display + write |
| M18 | day-pick resets to `''` not `undefined` | 46/52 | caught |
| M19 | `noteKey` drops `surface` (D2 reverted) | **52/52 CLEAN PASS** | **E3 — verified to reproduce D2** |
| M20 | `noteKey` drops `day` | **52/52 CLEAN PASS** | agreed backlog (rollover) |
| M21 | `noteKey` drops `kind` | **52/52 CLEAN PASS** | future-edit only — bowel is not noteable |
| M22 | `dailyLogBusy` back outside the `try` | **52/52 CLEAN PASS** | future-edit only — needs a throwing render |
| M23 | modal opener back to `note: ''` (blocker 1) | **52/52 CLEAN PASS** | **E2 — was caught one round ago** |
| M24 | modal awaits before closing (blocker 2) | 50/52 | caught |
| M25 | Cancel keeps the draft | 51/52 | caught |
| M26 | oldest-wins + reworded toast | 50/52 | caught |

Five clean passes. **M23 is the valuable one** — it is the only mutant in four rounds that a fix
*stopped* catching, and it is the release's original blocker.

# What I did not cover

iOS/Safari rendering (Chromium only) · `overflow-scan` at 320/360 · sync backend, Capacitor, `sw.js`
beyond the CACHE/version pairing · two-device concurrency · the Help bolded-name class and the
rollover, both agreed measurements · `README.md` and the audit files in this diff, which are
documentation.

# What the next pass should be, and it is not a round

**E1** — one condition: `&& ds !== state.timeModal.timeValue.slice(0, 10)`.
**E2** — one case: Confirm the modal **without touching the calendar**, on a day that has a note.
That is the cheapest check in the file and it re-arms the guard for the worst defect this release
had.
**E3** — one case for the `surface` component, if you want it; `kind`, `day` and the busy ordering
need nothing.

Everything else above is a measurement. Two one-line changes and one short check, and I expect to
sign this.
