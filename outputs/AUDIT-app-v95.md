AUDITED-COMMIT: 9165522c005e6c398a64011090fbb941cc82b1d6
VERDICT: DO NOT SHIP

# Zero Day Audit — ChemoWell app-v95

Two measured instances of **the exact defect this release exists to fix**, still live on this
tree. One of them is reachable in two adjacent taps on a top-level screen. The other is on the
first screen every user sees after every update. Both have measured fixes; both are red before
and green after, on byte copies outside the repo.

## The tree, as I measured it

| | |
|---|---|
| `git rev-parse HEAD` | `9165522c005e6c398a64011090fbb941cc82b1d6` — matches the brief |
| `md5sum index.html` | `ac849308e44e00f2a4f69cb123c20b35` — matches |
| `md5sum sw.js` | `19cc1c1af901f7e23ac4ef5a558c8a2d` — matches |
| `APP_VERSION` | `'app-v95'` (line 9882) — matches |
| `sw.js` CACHE | `'chemowell-app-v95-1'` (line 1) — matches |
| working tree | clean; branch `claude/caretracker-team-review-i83ik2` |

Nothing was checked out. `index.html` was not edited. Every measurement of a fix was taken on a
copy under my scratchpad, served on its own ephemeral port.

**`care-tracker` was not touched.** I did not read it, did not run anything against it, did not
open its live site and did not go near Firestore. It is closed.

---

# BLOCK — F1. The In-Patient "Undo" timer still tears the sheet down, 800ms later than before

**What it costs.** Exactly what was reported: the time field closes itself while the caregiver is
setting it. On Android that field *is* the system clock dialog, so it backs out and the entry has
to be started again. This release's headline is that this stopped happening. On this path it has
not stopped; it has moved from ~4.5s to ~5.3s.

**The path, and it is two taps on one card.** `renderInPatient` is a **bottom-nav tab**, not a
buried report. In its active-stay row, 8px apart in the same flex container (index.html 12878-12879):

* `+` — `logPeriodForDay('inpatient_start', 'inpatient_end', 'In-Patient')`, which opens the
  past-stay sheet and its `<input type="time">`
* `Undo` — `undoInpatientStart()`, which arms `confirmUndoInpatient`, raises a toast, and arms
  `_undoInpatientTimer` for **5000ms** (line 4725)

`_undoInpatientTimer` fires `setState({ confirmUndoInpatient: false })` with no guard. `setState`
renders. `render()` does `root.innerHTML = ''` then one `appendChild`. The field is gone.

"Undo, then `+` to log it properly instead" is the natural corrective sequence between two
buttons that sit beside each other.

**Measured on this exact tree** (`ac849308…`), node identity, 390x900, clock frozen, `timezoneId: 'UTC'`:

```
Undo visible: 1
plus visible: 1
armed (Tap to confirm present): 1
toast up: true
period sheet open, time field marked+focused: true at t+470ms
RESULT replacement: {"at":5315,"present":true,"isOriginal":false,"focused":false,"confirming":false}
final: {"present":true,"isOriginal":false,"focused":false}
```

`isOriginal: false` at **t+5315ms** — the node the finger was in no longer exists, and focus is
gone with it. `confirming: false` in the same sample identifies the culprit: it is
`_undoInpatientTimer` disarming the confirm, not the toast (the toast correctly deferred).

**The stated reason for leaving it alone is false for this timer.** `README.md`'s app-v95 row and
`BACKLOG` M52 both say: *"for the three tap-to-arm confirms their own state **is** the open
surface, so the same deferral would mean never disarming them, and a delete button that stays hot
is worse than the defect being fixed."* That argument is sound for `confirmRemove`, which **is**
in `liveEditingSurfaceOpen()`'s list. **`confirmUndoInpatient` is not in that list.** Deferring it
cannot deadlock, and I measured that it does not:

```js
// index.html 4725, replacing the one-line setTimeout
_undoInpatientTimer = setTimeout(function disarmUndoInpatient() {
  if (!state.confirmUndoInpatient) return;
  if (liveEditingSurfaceOpen()) { _undoInpatientTimer = setTimeout(disarmUndoInpatient, 600); return; }
  setState({ confirmUndoInpatient: false });
}, 5000);
```

Green after, same probe, same fixture:

```
period sheet open, time field marked+focused: true at t+492ms
RESULT replacement: NEVER REPLACED (field survived)
final: {"present":true,"isOriginal":true,"focused":true}
```

And it still disarms — the thing M52 feared:

```
STILL ARMED while sheet open (expected true): true
DISARMED within 1.5s of sheet closing (expected true): true
```

The armed button is behind a full-screen sheet while it waits, so it cannot be tapped in that
window. It goes cold within 600ms of the sheet closing.

---

# BLOCK — F2. The What's New modal is rebuilt every second. Every user, every update.

**What it costs.** This is the first thing every user sees after every release. Its node is
replaced once per second by the 1s tick, so its entry animation replays continuously, its internal
scroll returns to the top every second — a changelog longer than the viewport cannot be read — and
a tap on "Got it" can be eaten by the rebuild. This is the v11/v22/v27/v45/v55 symptom verbatim,
and app-v45's entry in this very file records it in the words it was reported in: *"screen keeps
refreshing constantly."*

**The cause.** `state.whatsNewOpen` is **absent from `liveEditingSurfaceOpen()`** (index.html
2114-2122). It was absent from the old inline tick condition too, so this is not a regression —
but app-v95 is the release whose entire purpose is to consolidate that list, and whose README row
says *"Adding a new sheet still means adding it to that one function; at least there is now only
one to forget."* The consolidation was performed and the one modal that reaches 100% of users on
100% of releases was not noticed. That is the same shape as the app-v94 block: the class fixed on
the surfaces that were looked at, left standing on the one that was not.

**Measured, on this exact tree**, first run after an update (`chemowell-app-seen-version` unset),
marking the modal node and sampling across three ticks:

```
What's New modal open on first run after update: true
modal node marked: true
  after +1100ms -> {"present":true,"isOriginal":false}
  after +1100ms -> {"present":true,"isOriginal":false}
  after +1100ms -> {"present":true,"isOriginal":false}
```

Replaced on every tick. **The fix is one term**, and it is green:

```js
// index.html 2116
return !!(state.timeModal || state.whatsNewOpen || state.upgradeOpen || state.drawerOpen || state.apptModal
```

```
  after +1100ms -> {"present":true,"isOriginal":true}
  after +1100ms -> {"present":true,"isOriginal":true}
  after +1100ms -> {"present":true,"isOriginal":true}
```

No deadlock risk: "Got it" closes the modal through `setState`, which is never deferred.

Nothing on that modal is time-dependent, so the tick has nothing to update there — the same
argument v55 used to exclude the whole Help view.

---

# F3 — The exclusion rationale is wrong for two of the three confirms (docs)

`README.md`'s app-v95 row and `BACKLOG` M52 both generalise one timer's argument across three.
Checked against `liveEditingSurfaceOpen()`'s actual terms:

| Confirm | In the guard list? | Would deferral deadlock? |
|---|---|---|
| `confirmRemove` | **yes** | yes — M52's argument holds |
| `confirmUndoInpatient` | **no** | no — measured, disarms in <1.5s (F1) |
| `confirmClearChemo` | **no** | no — same shape, same 4-line fix |

The cost is not cosmetic: the next session reads M52, accepts "deferral would mean never
disarming", and skips a fix that works. A wrong reason in a backlog entry is how a defect gets a
permanent home. Fix the wording in both places when F1 is fixed.

# F4 — `clearToast` has no "nothing to clear" bail, and `clearFlash` does

`clearFlash` opens with `if (!state.medFlash || state.medFlash.id !== safe) return;` (line 2960).
`clearToast` has no equivalent. `navigateTo` nulls the toast through `setState` —
`if (state.toast) next.toast = null;` (line 4859) — **without clearing `toastTimer`**. `grep`
confirms those are the only two writers of `toast: null` in the file. So a chain can outlive its
toast: once it fires with a surface open, it re-arms every 600ms with nothing left to clear, for
as long as any surface stays open.

**I did not reproduce this through the UI** — two attempts failed to get a surface open inside the
4.5s window after a navigation, and I stopped rather than keep spending on it. It is conclusive
from the source, and the cost is small: one cheap predicate every 600ms, against a 1s tick that
already rebuilds the whole document. It is bounded to a single chain, because every retry
reassigns the one module-global handle. **Not a block — but it is an asymmetry inside this
release's own two-timer fix, and it closes with one line:** `if (!state.toast) return;` as
`clearToast`'s first statement.

# F5 — `test/v95-sheet-stability.mjs` crashes rather than fails when run with `--file`

Three runs against byte copies in my scratchpad — including an **unpatched** copy, md5 identical
to the repo's — died with an uncaught `locator.click: Timeout 30000ms exceeded` on the
`"Got it"` dismissal, exit non-zero but with **no checks reported and no FAILURES list**. The
log names the What's New title div intercepting pointer events. I did not isolate the cause
between F2's per-second rebuild making that click a race and the two 404s the scratchpad dir
serves (`icon-192.png`, `manifest.webmanifest`, the only non-absolute asset references in the
file); fixing F2 alone did not clear it, so the 404s are implicated.

`release_check.sh` runs the suite **without** `--file`, and from the repo root it is stable —
18/18 twice. So the gate is not affected. But a delta or corpus run that reaches for `--file`
will crash, and an uncaught exception is not a legible failure: it looks like infrastructure, not
like a red check.

---

# What I checked and found clean

**The guard is equivalent to what the tick had — term for term.** I diffed the replaced condition
against the new function rather than reading the comment that says they match. The old inline
condition carried `isEditing` plus fifteen states; `liveEditingSurfaceOpen()` carries the same
fifteen — `timeModal, upgradeOpen, drawerOpen, apptModal, noteModal, checkinModal, medEditor,
infoModal, eraseAllModalOpen, confirmDeleteMed, confirmRestoreMed, confirmDeleteAppt,
confirmDeleteNote, confirmDeleteProfile, confirmRemove` — and the same `INPUT/SELECT/TEXTAREA`
test. Nothing was dropped. `state.view !== 'help'` is still applied separately at the tick
(line 14260) and is still correct: nothing on Help is time-dependent, which is v55's reasoning
unchanged. F2 is a state that was **never** on the list, not one this release lost.

**The pendingEntries flush is untouched, and no deferred render can reach it.** This was the
item I expected to find something in, and it is sound by construction. `pendingEntries` is
written at exactly one site (line 14213) and only inside `if (state.timeModal)`; the flush gate
in `setState` is `!state.timeModal`; and the flush lives **inside `setState`, which this release
never defers** — only the two cosmetic timers and the tick consult the guard. The tick calls
`render()` directly, not `setState`, so it never flushed pendingEntries before this release
either. A deferred toast cannot delay, skip or double a flush, and no dose record can be lost or
duplicated through this path. The normal sequence still flushes at the moment the sheet closes,
because closing it goes through `setState({ timeModal: null })`.

**No stale `state.timeModal` is readable after a write.** `confirmTimeAndLog` captures
`const m = state.timeModal` once and returns immediately if it is null. Every branch closes the
modal through `setState` *before* it awaits, so the button is gone before a second tap can land;
the `futureOk` path mutates the same object `m` references, so the two cannot diverge. The
deferral touches no entry state at all.

**Toast chain cancellation is correct, including a new toast arriving during a retry.** There is
one module-global `toastTimer`; each retry reassigns it; `setToast`'s `clearTimeout(toastTimer)`
therefore always holds the live handle, whether that handle is the original 4500ms timer or the
nth 600ms retry. Only one chain can exist at a time, so overlapping toasts cannot multiply
retries. JavaScript is single-threaded, so the `setState`-before-`clearTimeout` ordering inside
`setToast` cannot interleave with a firing callback. Same reasoning holds for `medFlashTimer`.

**Nothing re-renders less than it should.** The guard is consulted in two more places than
before, and both are cosmetic clears — a toast fading and a card highlight fading. No data
surface was put behind it. The dose ring, the "Up next" hero and the missed-dose banner are
drawn by `render()` from the 1s tick, whose condition is unchanged, and by `setState`, which is
never deferred. The suite's own tick scenario confirms a sheet still holds the tick off and the
page repaints on interaction.

**`medFormRerenderTimer` is correctly excluded.** It exists *to* rebuild the medication editor as
the caregiver types, debounced to 450ms precisely so the numeric keypad resets between words
rather than between characters. M52's framing — that what it needs is focus preservation across
the render, not a skip — is right.

**The suite is well built and genuinely falsifiable.** It asserts node identity rather than
appearance, selects the toast by the new `data-toast` hook rather than by page text, includes the
over-block case ("never clear the toast" must fail), includes the focus-only case with no sheet
open, and reaches the card-flash timer through a two-dose medication — the two gaps the builder's
own first mutant sweep exposed. I found no remaining assertion that can pass for the wrong
reason. I did not find a sixth mutant in the code; **I found the two the fixtures still cannot
reach, and they are F1 and F2.**

**The ratchet is intact.** `test/v75-no-other-patient.mjs` 29/29, pronouns 32 found / 32 allowed,
both sides of the ratchet green. This report adds no patient-identifying content.

---

# Reproduced, with timings

| What | How | Time | Result |
|---|---|---|---|
| Tree identity | `git rev-parse`, `md5sum`, `grep` | <1s | all five values match the brief |
| `v95-sheet-stability` from repo root | `node test/v95-sheet-stability.mjs` | 44s, then 42s | **18/18 twice** — stable |
| Guard equivalence | `git show 87c03b4` old condition vs new function | — | identical, 15 states + focus test |
| F1 red | probe, In-Patient tab, Undo then `+`, node identity | 10s | **replaced at t+5315ms**, focus lost |
| F1 green | same probe, 4-line deferral on a scratchpad copy | 10s | never replaced, still focused |
| F1 no deadlock | same copy, hold sheet 6.5s then Cancel | 9s | armed while open, disarmed <1.5s after |
| F2 red | probe, unseen version, mark modal, 3 ticks | 8s | `isOriginal: false` on every tick |
| F2 green | one added term in the guard | 8s | `isOriginal: true` on every tick |
| Orphan toast chain | counted 600ms `setTimeout` calls after a navigation | 2 runs, 25s | 0 retries — surface never opened in the window; F4 stands on source only |
| `v75-no-other-patient` | after writing this file | 6s | 29/29, ratchet 32/32 |

# What I deliberately did not run

* **The thirteen other gated suites** — taken on trust per the brief. I re-ran only
  `v95-sheet-stability` (my own findings needed it) and `v75-no-other-patient` (because I wrote
  into the repo).
* **`falsify/mutants-v95-sheet.sh`** — the builder reports 5 caught, 0 unexpected survivors, 1
  over-block control green. I spent the time attacking what the *fixtures* cannot reach instead,
  which is where both blocks came from. Neither F1 nor F2 has a mutant, and both need one.
* **A real device.** The mechanism — a destroyed `<input type="time">` dismissing Android's system
  clock dialog — **cannot be observed here.** Chromium in this sandbox renders that input as an
  inline control. What I measured is the node being destroyed while focused, which is the
  antecedent; that it closes the Android dialog is inference from the reported behaviour, not
  something this environment can show. Both blocks rest on the node measurement, which is solid
  on its own: a field the caregiver is typing into ceases to exist.

# To clear this audit

1. **F1** — defer `_undoInpatientTimer` (4 lines, measured above). Do `confirmClearChemo`'s
   inline 6000ms timer at the same time; it is the same shape and the same non-deadlock.
2. **F2** — add `state.whatsNewOpen` to `liveEditingSurfaceOpen()` (one term, measured above).
3. **F3** — correct the rationale in `README.md`'s app-v95 row and in `BACKLOG` M52: the
   "its own state is the open surface" argument applies to `confirmRemove` only. M52 keeps
   `confirmRemove` and `medFormRerenderTimer`; the other two leave it as fixed.
4. **F4** — one line: `if (!state.toast) return;` as `clearToast`'s first statement, matching
   `clearFlash`.
5. **Suite** — a scenario for each block, and a mutant for each in
   `falsify/mutants-v95-sheet.sh`. F2's scenario must start with the seen-version key **unset**,
   which no current scenario does; F1's needs an open `inpatient_start` entry in the fixture,
   which no current fixture has. Both gaps are why 18/18 was green on a tree carrying both.
6. **F5** — either make `--file` copy the two referenced assets, or have the dismissal failure
   report as a FAIL instead of throwing.
7. Re-audit as a delta pass. The equivalence work, the flush analysis and the chain-cancellation
   analysis above do not need redoing unless the guard or `setState` changes.

**The structural note, because it is now earned twice in one release.** M52 already says the root
cause is a renderer that replaces the document instead of reconciling it, and that six releases
have patched a guard list instead. F1 and F2 are the seventh and eighth instances, found in the
release that consolidated the list. The list is now in one place, which is better — but a list
that must be remembered is still a list that will be forgotten. A check that enumerates every
`state.*` key which gates a modal in `render()` and fails when one is missing from
`liveEditingSurfaceOpen()` would have caught F2 mechanically, and would catch the ninth.
