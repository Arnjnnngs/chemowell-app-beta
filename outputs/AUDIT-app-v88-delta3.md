AUDITED-COMMIT: 64bb8a6
VERDICT: SHIP

Delta-3 re-audit of ChemoWell app-v88, `git diff 5538d0a..64bb8a6`, branch
`claude/caretracker-team-review-i83ik2`.

**Confirmed. E1 and E2 are fixed, 7b2 and 7g are not vacuous, `prevDay` is captured before the
reassignment — proved by falsification, not by reading — and nothing in the diff is broken. No
earlier guard was disarmed by this one, which is the question this release taught us to ask. I said
I expected to sign the next one; it holds. Take it to the PM.**

`index.html` md5 `005eeb378660fc3030e1d1a025429817` before and after; nothing edited, committed or
staged. Mutants served from a byte copy on port 8900 via `FALSIFY_BASE`.

## Baselines — all six re-run by me at HEAD, not taken on trust

| Suite | Result |
|---|---|
| `test/v88-log-a-missed-day.mjs` | 58/58 |
| `test/v87-correct-a-past-day.mjs` | 64/64 |
| `test/v86-logging-and-labels.mjs` | 87/87 |
| `test/v75-no-other-patient.mjs` | 29/29 |
| `test/v55-help.mjs` | ALL GREEN |
| `test/v57-search.mjs` | ALL GREEN |

Your 58/58 is exact, and the other five are green too, so the PM has them.

---

# 1. `prevDay` is captured before the reassignment — read, then falsified

**Read.** `index.html:5808-5809`. `const prevDay = state.timeModal.timeValue.slice(0, 10);` is the
**first statement** in the arrow body; the reassignment of `state.timeModal.timeValue` is the
second. Correct ordering.

**Falsified, because reading it is what you asked me not to settle for.** **M28** moves the capture
to *after* the reassignment — the one-line mistake that would make `prevDay === ds` on every pick,
so the reset never fires at all:

    M28  prevDay captured AFTER the reassignment  ->  58 checks: 54 passed, 4 failed
    M17  the reset removed entirely               ->  58 checks: 54 passed, 4 failed

**Identical, down to the four check names and both 7f shapes.** That is the proof the ordering is
load-bearing *and* guarded: the subtle version of the bug is indistinguishable, to the suite, from
the blunt one. Either way 7f goes red.

**The comparison itself is sound.** `ds` comes from `renderCalendar`'s own
`dstr = cy + '-' + String(cm).padStart(2,'0') + '-' + String(d).padStart(2,'0')` — zero-padded
`YYYY-MM-DD`, the same shape as `timeValue.slice(0, 10)`. A format mismatch would make
`ds !== prevDay` always true and put E1 straight back; it does not, and 7g would catch it if it did.

**Behaviour driven on HEAD, both directions, on one open calendar:**

    same-day re-tap   -> box keeps "TYPED"          (the reset correctly does not fire)
    different-day tap -> box shows "toast", day -3's own note  (the reset fires and re-reads)

Both halves right.

---

# 2. 7b2 and 7g are not vacuous

**7b2 — confirmed, and it is the right shape.** It drives the one path the day-pick reset cannot
reach and uses no calendar at all.

    M23  note: '' restored at the opener  ->  58 checks: 56 passed, 2 failed
         FAIL  the box shows today's note the moment it opens, before any day is picked  |  ""
         FAIL  confirming without touching the calendar does not wipe the note
               |  [{"v":"normal","note":"ate a full dinner"},{"v":"normal","note":""}]

**2 red, exactly as you said.** Both checks bite independently — one on display, one on the write —
and the second one catches the extra row as well as the blank note, so a build that wrote a
duplicate without clearing the note would also fail it. The guard for the first blocker is re-armed,
and it is re-armed on a path that no future reset can overwrite, which is the part that matters.

I also drove that path by hand on HEAD: open **Log another day** on a day carrying a note, Confirm
untouched → box reads `"ate a full dinner"` at open, and the export is byte-identical before and
after. A clean no-op.

**7g — confirmed, with one latent weakness worth a word.**

    M27  the reset fires on every tap again  ->  58 checks: 57 passed, 1 failed
         FAIL  and the typed note survives a tap on the day that is already selected  |  box shows "soup"

**1 red, as you said.** And I checked the specific way it could have been hollow: `tapDay` returns
the string `'reopened'` when it finds no day cells and only toggles the pill, and 7g's second
precondition accepts `again === true || again === 'reopened'`. **If the `'reopened'` branch were ever
taken on the second tap, no cell would be clicked, the reset could not fire, and the main assertion
would pass for free.** I instrumented the exact sequence against HEAD:

    first tap : true   | box: "soup"
    SECOND tap returned: true          <- lands on a real cell
    box after : "vomited twice"

So it is genuinely exercising the code today — and M27 going red confirms it from the other side; a
tap that never landed could not have turned it red. **The escape clause is a latent hole, not a
present one.** Accepting only `true` on the second tap, or retrying the way `pickDay` does, closes
it in a word. Not worth a round.

**One cosmetic inaccuracy in your description, zero impact:** `noteShown` is captured twice, not
once — at line 116 inside the `shape` object and again at line 142 after the day pick, which
overwrites it on every `logAnotherDay` call. The line-142 capture is the one every assertion reads,
so the behaviour is exactly what you intended; the first is simply dead. `hasNote` is properly gone
from the shape, leaving only the comment explaining why, which is the right thing to leave behind.

---

# 3. Nothing in the diff is broken, and — the question this release taught — no earlier guard was disarmed

**E2's lesson was that a fix can retire a check without anything going red.** So I re-ran every
mutant the suite was catching before this edit, rather than assuming the calendar change was local:

| Mutant | Before delta-3 | At `64bb8a6` |
|---|---|---|
| M16 — display expression always blank | 3 red | **4 red** (7b2 adds one) |
| M5 — corrector sends `dailyNoteFor` | 1 red | 1 red |
| M6 — logger sends `dailyNoteFor` | 1 red | 1 red |
| M17 — day-pick reset removed | 4 red | 4 red |
| M24 — modal awaits before closing | 2 red | 2 red |
| M25 — Cancel keeps the draft | 1 red | 1 red |

**Nothing weakened; M16 strengthened.** That is the opposite of what happened last round, and it is
the result I most wanted to see.

**Behaviour, driven rather than read:**

- **The shared calendar handler still works for non-daily types.** A **symptom** backdated three
  days: the pill reads `Fri, Oct 23 ▲`, the time input is still rendered, and the entry lands
  exactly 3 days back. The `type === 'daily'` guard on the new condition holds.
- **Blocker 2 stays fixed** — three taps on Confirm write one row.
- **D2 stays fixed** — type in the logger, open Correct on today's row: the corrector shows the
  day's real note, and Cancel leaves the logger's typing intact.
- **The bowel modal is unaffected** — no note box (`noteable: false`), writes normally.
- **`dailyLogBusy` is released** — three sequential writes from modal, logger and corrector all land
  with strictly increasing stamps (`…000`, `…001`, `…002`).
- **No page error thrown** in any probe, on any page.
- **No gendered pronoun added**; `v75` 29/29 with the ratchet at 36.
- **Still exactly two sites mutate `timeValue`** — line 5809, which now carries `prevDay`, and line
  5836, the time input, which touches only the `T…` portion and is suppressed under `dateOnly`.
  There is no third way to move the day, so the guard is on the only path that needs it.

---

# 4. No sixth axis, and I did not go looking past the enumeration

You asked me not to hunt one unless I found one. I did not find one, and here is why that is a
conclusion rather than a shrug: delta-3 changed exactly one expression in the one handler that can
move the day. It adds a condition; it opens no new way for `m.note` to be defined-but-wrong. The
delta-2 enumeration — day, surface, touched, kind, value, month arrow, reopen, modal Cancel — is
unchanged by it, and the structural fact that pins it (two `timeValue =` sites, one guarded, one
time-only) I re-checked above rather than carried over.

**The invariant is closed.** The *rule* is one rule on all three surfaces; the *mechanism* is still
two, and I agree with your call: moving the modal's note into `dailyNoteDraft` under
`noteKey('modal', kind, pickedDay)` is the thing that makes E1 and E2 impossible rather than fixed,
and it is **its own release with its own chain, not a fifth round bolted onto this one.** Changing
more than the minimum late in a release is what produced two of the three turnovers here; doing it
now would be the same mistake wearing a better motive.

# Carried as measurements, unchanged

M11 (Help bolded names) · M15/M20 (the midnight rollover) · M19 (the `surface` component of
`noteKey` is unguarded — it was verified to reproduce D2, so it is the strongest of these if one
ever gets picked up) · M21 (the `kind` component, reachable only by making bowel noteable) · M22
(the `dailyLogBusy` ordering, needs a throwing render) · the month-boundary fragility in `pickDay`
and `tapDay` · 7g's `'reopened'` escape · the dead line-116 `noteShown` capture · and the suite note
that `v75-no-other-patient` reads from disk rather than `FALSIFY_BASE`, which cost me a wrong
falsification on the pronoun ratchet and is worth the line you plan to add. **None is reachable by a
caregiver of this build.**

# What I did not cover

iOS/Safari rendering — Chromium only here; the note inputs are at the 16px floor and the controls at
44px, read from source and never seen on a phone, and that stays exempt on this release as on every
other · `overflow-scan` at 320/360 · the sync backend, Capacitor, and `sw.js` beyond the
CACHE/`APP_VERSION` pairing · two-device concurrency · `README.md` and the audit files in this diff,
which are documentation.

# The call

Four rounds, three blockers, and the one that mattered most was not in the product at all — it was a
fix quietly retiring the check for the thing it fixed. You found that worth saying in the commit and
the README row, and it belongs in `PROCESS-RESET.md` too: **after any fix, re-run the mutant the
previous round was catching.** It is the cheapest habit on this board and it is the only reason this
release is not shipping with its first blocker unguarded.

Nothing is left that a caregiver of this build can hit. **Ship it.**

---

   ADDENDUM, added by the Lead Developer, not the auditor, and indented so it cannot be read as a
   second header line.

   This report's verdict pins to 64bb8a6. Two TEST-ONLY edits landed afterwards in 0cce928, both
   of them changes this auditor asked for in this same pass:

     * test/v88-log-a-missed-day.mjs -- 7g's second precondition tightened from
       `again === true || again === 'reopened'` to `again === true`. The 'reopened' branch clicks
       no cell, so the behaviour under test cannot fire and the assertion would have held for the
       wrong reason. Strictly stricter; it cannot make a failing build pass.
     * the same file -- the dead noteShown capture taken before any day is picked, removed. Every
       assertion reads the capture taken after the pick, so no assertion changes.

   index.html, sw.js and every other Rule 5 path are byte-identical to 64bb8a6. Re-run on the
   committed tree: 58/58.

   Recorded because the auditor raised it rather than letting it pass, and the reasoning it
   refused -- "it is only the test file" -- is exactly the reasoning this release was refused for
   once already.
