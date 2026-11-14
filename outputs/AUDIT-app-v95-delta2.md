AUDITED-COMMIT: af3d19e139aaab6ee9c6dee08be728521a949207
VERDICT: DO NOT SHIP

# Zero Day Audit — ChemoWell app-v95, DELTA 2 (over `git diff 9165522..HEAD`)

**The two blocks are genuinely fixed, and I measured both rather than reading them.** The release
is stopped on something else: **the completeness check that is this delta's headline safety
mechanism passes green on a tree whose guard has lost a term.** Measured end to end — the full
26-check suite is **26/26 PASS** on a copy of this exact `index.html` with `state.confirmRemove`
deleted from `liveEditingSurfaceOpen()`, while the 1s tick rebuilds the whole document underneath
an armed delete confirmation. That is Aaron's own v45 report ("screen keeps refreshing constantly
while trying to permanently delete things") restored, invisibly, by a one-token edit.

## The tree, as I measured it

| | |
|---|---|
| `git rev-parse HEAD` | `af3d19e139aaab6ee9c6dee08be728521a949207` — matches the brief |
| `md5sum index.html` | `4b1c45ada973c2a4955d108b8eee19c3` — matches |
| `md5sum sw.js` | `19cc1c1af901f7e23ac4ef5a558c8a2d` — matches |
| `APP_VERSION` | `'app-v95'` (line 9908) — matches |
| `sw.js` CACHE | `'chemowell-app-v95-1'` (line 1) — matches |
| working tree | clean before this file; branch `claude/caretracker-team-review-i83ik2` |

Nothing was checked out. `index.html` was not edited. Every mutation was applied to byte copies in
my scratchpad and served on my own ports (8931 for the sweep, 8947 for one suite run).

**`care-tracker` was not touched.** Not modified, not run against, no browser pointed at it, no
Firestore access of any kind. It is closed.

---

# NEW BLOCK — G1. The completeness check is vacuous for `confirmRemove`, and mutant 9 picks the one term where it bites

**The check, as shipped** (`test/v95-sheet-stability.mjs`):

```js
const unaccounted = r.keys.filter(k => r.guard.indexOf('state.' + k) < 0 && !EXEMPT[k]);
```

`indexOf` is a substring test. The guard's last two terms are
`|| state.confirmRemove || state.confirmRemovePara);` — so `'state.confirmRemove'` **matches inside
`state.confirmRemovePara`**. Delete the `confirmRemove` term and the check still finds its text.

**Measured, both sides, on byte copies of this `index.html`:**

| File | Guard has `state.confirmRemove` as its own term | Completeness check | Tick while the Remove confirm is armed |
|---|---|---|---|
| shipped (`4b1c45ad`) | yes | GREEN (`unaccounted = []`) | **held off** — marked node `isOriginal: true` after 3 ticks |
| mutant (that one term deleted) | no | **GREEN (`unaccounted = []`)** | **rebuilt** — `isOriginal: false` after 3 ticks |

And the whole suite, not just that check, run against the mutant over `--base`:

```
26 checks: 26 passed, 0 failed
PASS — a sheet survives the timers that fire underneath it, and the toast still clears.
```

No other check can see it: no scenario in the suite ever arms the entry Remove confirmation, and the
behaviour only diverges while it is armed. So the mutant is invisible to all 26.

**Why this is a block and not a note.** The delta's own commit message is *"the guard is now checked
against the app's own registry"*, and the first audit's closing recommendation was a mechanical check
so a **ninth** omission is found by a suite rather than by a person. The mechanism has a hole at one
of its 21 terms — and the hole is at the term that exists because of Aaron's v45 report. Worse,
**`mutant_9` is described as "any removed term should redden it" and removes `state.confirmRemovePara`,
which is the unique string of the pair.** The sweep therefore reports the check as sound (`0 known
open hole(s)`) while it is not. Rule 5: a check that cannot fail is worse than no check.

**The fix, measured red-then-green, two lines:**

```js
const expr = r.guard.slice(r.guard.indexOf('return !!('));
const guarded = new Set((expr.match(/state\.([A-Za-z0-9_$]+)/g) || []).map(s => s.slice(6)));
const unaccounted = r.keys.filter(k => !guarded.has(k) && !EXEMPT[k]);
```

| | shipped matcher | token matcher |
|---|---|---|
| shipped file | GREEN | GREEN (21 guarded tokens) |
| `confirmRemove` mutant | GREEN | **RED — `unaccounted = ["confirmRemove"]`** |

Slicing from `return !!(` also closes a second mouth on the same defect: `String(liveEditingSurfaceOpen)`
is 1365 characters and most of it is the new comment block, which sits **inside** the function body
and so inside the matched text. I measured that the comment contains no `state.` token today, so the
check is not vacuous that way yet — but one future comment writing `state.foo` would silently exempt
`foo` for ever. Match the expression, not the function.

**Also repoint `mutant_9`** at `state.confirmRemove` (or add a tenth for it). A mutant aimed at the
one term the matcher can see is a mutant that proves nothing about the other twenty.

---

# The first audit's findings, re-checked

## F1 — CLEARED, measured independently

My own probe, 390x900, clock frozen with `Date.UTC(...)` and `timezoneId: 'UTC'`, an open
`inpatient_start` entry in the fixture: In-Patient tab → `Undo` (arms the 5s timer, toast confirmed
up) → `+` (`aria-label="Log a past hospital stay"`) → mark and focus the `<input type="time">`.

```
C Undo present: 1
C plus present: 1   armed toast: true
C time field marked+focused: true
C replacement: NEVER REPLACED (field survived past 7.2s)
C after closing sheet +1.5s, Undo control reads: "Undo"
```

Previously destroyed at t+5315ms. It now survives past 7.2s, **and it still disarms** — the label is
back to plain `Undo` within 1.5s of the sheet closing, so the deferral is not a leak.

**The trap in the brief, checked:** neither `confirmUndoInpatient` nor `confirmClearChemo` is in
`liveEditingSurfaceOpen()`. I enumerated all 21 terms from the live function source, not from the
diff: `timeModal, upgradeOpen, drawerOpen, apptModal, noteModal, checkinModal, medEditor, infoModal,
eraseAllModalOpen, whatsNewOpen, addingProfile, override, bkNotice, chemoCalOpen, confirmDeleteMed,
confirmRestoreMed, confirmDeleteAppt, confirmDeleteNote, confirmDeleteProfile, confirmRemove,
confirmRemovePara`. Neither deferred confirm is among them, so neither can wait on itself. Both also
bail on their own state first (`if (!state.confirmClearChemo) return;` / the undo path's guard), so a
disarm that has already happened cannot re-arm a retry loop.

## F2 — CLEARED, measured

First run after an update (`chemowell-app-seen-version` unset), modal node marked, sampled across
three ticks: `[{present:true,isOriginal:true} × 3]`. The node is no longer replaced.

## F3 — **NOT CLEARED**

`README.md`'s app-v95 row was rewritten and does now carry the correction. **`BACKLOG.md` M52 was not
touched by this delta at all** (`git diff --stat 9165522..HEAD` lists five files; `BACKLOG.md` is not
one of them, and its last commit is `7e2efba`, before the audit). M52 still reads, in the present
tense, as a list of things app-v95 deliberately did not fix:

* *"`_undoInpatientTimer`, 5000ms — clears `confirmUndoInpatient`"* — **this delta deferred it.**
* *"the inline 6000ms timer that disarms `confirmClearChemo`"* — **this delta deferred it too.**
* *"For the three confirms, their own state is the open surface"* — the exact false generalisation
  F3 was raised to correct, still standing.

This is now worse than before the delta: the backlog describes fixed work as unfixed and offers a
wrong reason for not doing it. That is the Rule 7 failure this project has paid for repeatedly — a
standing note that outlives its subject and sends a later session at solved work. It is a two-minute
edit and it belongs in this release.

A smaller note on the README row: it keeps the false sentence (*"for the three tap-to-arm confirms
their own state is the open surface…"*) and corrects it thirteen sentences later in the same table
cell. A reader who stops at the first one is misled. Consider marking the first sentence as
superseded where it stands.

## F4 — CLEARED

Both halves are present and sound. `clearToast` opens with `if (!state.toast) return;`, and
`navigateTo` does `if (state.toast) { next.toast = null; clearTimeout(toastTimer); }`. `grep` over the
current file confirms exactly two writers of `toast: null` (line 3328 in `clearToast`, line 4885 in
`navigateTo`) and three `clearTimeout(toastTimer)` sites.

**Can a chain outlive its toast?** No. A live chain implies `state.toast` is truthy, because the only
way it becomes falsy is one of those two writers, and both now end the chain.

**Can `navigateTo` drop a newer toast's chain?** Only by dropping the toast it belongs to, which it
already did before this change. `setToast` is synchronous: raise a toast then navigate in the same
tick and `navigateTo` sees the new toast, nulls it (pre-existing behaviour, line 4885's intent) and
cancels its handle; navigate then raise and `setToast` arms a fresh handle after the cancel. Every
retry reassigns the one module-global handle, so `clearTimeout(toastTimer)` always holds the live one.
No call site in the file pairs `setToast` with `navigateTo` in either order.

## F5 — NOT CLEARED (unchanged, pre-existing, gate unaffected) — and the cause is narrower than guessed

`node test/v95-sheet-stability.mjs --file <copy>/index.html` against a byte-identical copy still dies
with an uncaught `locator.click: Timeout 30000ms exceeded` on the `"Got it"` dismissal — no checks
reported, no FAILURES list. **Fixing F2 did not clear it**, which rules out the per-second rebuild.

I narrowed it: with `index.html`, `sw.js`, `icon-192.png` and `manifest.webmanifest` in the directory
the run crashes and the only 404 is `/icon-512.png`; **copy `icon-512.png` in as well and the same
command runs clean past that click.** So it is the missing referenced asset, not the modal — the
audit's hypothesis was right in kind and named the wrong files. `release_check.sh` runs the suite
without `--file`, and the sweep's own baseline is 26/26, so **the gate is not affected**. It is still
worth closing: an uncaught exception reads as broken infrastructure, not as a red check, and it cost
this pass a detour.

---

# Two further findings, neither a block

**G2 — nothing in the suite ever watches the What's New modal survive a tick.** `mutant_8` is caught
only by the completeness check's string comparison. The `open()` helper dismisses the modal during
setup, so no scenario holds it open. The audit asked for a scenario with the seen-version key unset;
a source-text check was delivered instead. That ties the suite to the guard's text but not to the
behaviour, so a future change that renders the modal while `whatsNewOpen` is false — or that reaches
it by another flag — leaves the suite green. My own probe above is the measurement that is missing;
it is about fifteen lines.

**G3 — `backLayerKeys` is the registry of *Back-dismissible* layers, not of all surfaces.** The
completeness check can only see an omission for a surface that was also registered with the phone's
Back button. Today that is a near-complete set and I checked it rather than assuming: all ten
`role: 'dialog'` surfaces in the file map to a `BACK_LAYERS` key. The exception is
`confirmUndoInpatient`, which is a tap-to-arm confirm with no registry entry — deliberately unguarded,
so no behavioural harm, but it is exactly the shape this check is blind to. Say so in the check's
comment, which currently reads as though the registry were the complete set.

---

# What I checked and found clean

**The four new surfaces cannot make a time-sensitive figure wrong.** This was the costliest item on
the brief and it is clean by construction, not by luck: in the 1s tick, `state.now = simNow();` is
the **first** statement and the guard gates only `render()` further down. So `state.now` keeps
advancing while `override`, `bkNotice`, `addingProfile`, `chemoCalOpen`, `confirmRemovePara` or
`whatsNewOpen` sits open, and so do `checkNotifications()` and `checkAppointmentReminders()`. That
matters because `state.now` is not only displayed — it is **written into records**:
`logBloodPressure` stores `ts: state.now`, and `clearMissedDoses` stores it as `missedClearedAt`.
Had the guard been placed above that assignment, a reading logged after an over-limit prompt had sat
open would have carried the time the prompt opened. It is not, so it cannot. When a surface closes it
closes through `setState`, which renders immediately with a fresh `state.now`, so no staleness
survives the close either.

**None of the new guard members is cleared by a timer that can no longer run.** I grepped every
`setTimeout` in the file that writes state: four exist. `confirmRemove`'s 6000ms disarm is
**undeferred** — correct, because `confirmRemove` *is* in the guard and deferring it would strand an
armed delete control (M52's argument, which holds for this one). `confirmClearChemo`'s is deferred and
not in the guard. `medFormRerenderTimer` is unchanged and correctly excluded. `notifDirtyTimer` does
not touch a surface. The five newly guarded confirms/sheets have no auto-disarm timer at all, so
nothing can strand them; they close on a tap, which is `setState`, which is never deferred.

**The falsification sweep reproduces the builder's record exactly**, on my own port:

```
=== 8 mutant(s) caught, 0 survived unexpectedly, 0 could not be measured, 0 anchor(s) stale
=== 1 over-block control(s) correctly stayed green, 0 over-block(s) fired, 0 known open hole(s)
```

Baseline 26/26 green. Mutant 1 (the reported bug restored) reddens five checks including the new
In-Patient one — so the F1 scenario is genuinely reachable and is not merely asserting on an absent
control, which is the trap the builder's own record says it fell into once. Mutant 6, the over-block
control, correctly stayed green. **The sweep's `0 known open hole(s)` is the one line in it I do not
accept**, for the reason in G1.

**Mutant 1's narrowed anchor is the right call.** Anchoring on the two deciding lines rather than the
whole callback is what stops prose edits disarming it, and it applied cleanly here.

**No patient-identifying content.** This report names no patient, uses no gendered pronoun, and adds
no medication, dose or ceiling. `test/v75-no-other-patient.mjs` re-run after writing it.

---

# Reproduced, with timings

| What | How | Time | Result |
|---|---|---|---|
| Tree identity | `git rev-parse`, `md5sum`, `grep` | <1s | all five values match the brief |
| Falsification sweep | `FALSIFY_PORT=8931 ./falsify.sh …` | ~13 min | baseline 26/26; 8 caught, 0 survivors, 0 stale, 1 control green |
| F1, independent probe | In-Patient → Undo → `+`, node identity, 9 samples | 12s | never replaced past 7.2s (was 5315ms) |
| F1 no-deadlock | close the sheet, read the control's label | 2s | back to `Undo` within 1.5s |
| F2, independent probe | seen-version unset, mark modal, 3 ticks | 8s | `isOriginal: true` ×3 |
| G1 red, check only | completeness logic replicated, both files | 2 × 25s | shipped GREEN on the mutant too |
| G1 red, whole suite | `--base` against the mutant on port 8947 | 3 min | **26/26 PASS on a broken guard** |
| G1 behaviour | arm Remove, mark a node, 3 ticks, both files | 2 × 30s | shipped: held off · mutant: tree rebuilt |
| G1 fix | token matcher, both files | 2 × 25s | GREEN shipped · RED on the mutant |
| F5 | `--file` on a copy, with and without `icon-512.png` | 2 × 90s | crashes without it, clean with it |
| Guard term census | live `String(liveEditingSurfaceOpen)` | <1s | 21 terms; neither deferred confirm among them |
| `state.now` ordering | read the tick, lines 14254-14300 | — | assigned before the guard; `ts: state.now` writers safe |
| `v75-no-other-patient` | after writing this file | 6s | see commit |

# What I did not run

* **The thirteen other gated suites** — taken on trust per the brief: the builder re-ran all fourteen
  green on this exact `index.html` (md5 `4b1c45ad`).
* **Everything the first audit verified clean** — guard equivalence, the `pendingEntries` flush,
  `confirmTimeAndLog`'s captured `timeModal`, chain cancellation inside `setToast`. Unchanged by this
  diff except where noted, and not re-measured.
* **A real device.** None available. The mechanism that makes this class expensive — a destroyed
  `<input type="time">` dismissing Android's system clock dialog — cannot be observed here; Chromium
  renders that input inline. Every measurement above is node identity, which is the antecedent.
* **`contrast-scan` / `overflow-scan`** — nothing in this diff moves a pixel. The only visual change
  is which surfaces hold the tick off.

# To clear this audit

1. **G1** — the token matcher above, and repoint `mutant_9` at `state.confirmRemove`. Two lines plus
   one anchor. Red-then-green already measured.
2. **F3** — update `BACKLOG.md` M52: `_undoInpatientTimer` and the `confirmClearChemo` timer are
   **fixed**, and the "its own state is the open surface" reason applies to `confirmRemove` alone.
3. **G2** — fifteen lines: hold the What's New modal open with the seen-version key unset and assert
   node identity across three ticks, so F2 has a measurement and not only a string.
4. **F5** — have the dismissal failure report as a FAIL, or copy `icon-192.png`, `icon-512.png` and
   `manifest.webmanifest` beside a `--file` target.
5. **G3** — one sentence in the check's comment saying what the registry does and does not cover.

Nothing here requires an `index.html` change. The shipped app's behaviour, on everything I measured,
is correct.
