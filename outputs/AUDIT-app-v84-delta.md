AUDITED-COMMIT: c70e06d
VERDICT: DO NOT SHIP

# Zero Day Audit — ChemoWell app-v84, DELTA PASS on 5600b92 → c70e06d

**HEADLINE: the scroll fix is right, and the check that guards it has a hole I drove a truck
through. `mutant_3` from this release's own mutants file — the v28 nudge deleted outright, the
feature the guard exists to preserve — SURVIVES the suite 57/57.** *"and a field focused WITHOUT a
swipe is still brought into view — v28 is not deleted"* (`test/v84-whatsnew.mjs:515`) is a
three-way `||` whose first disjunct, `deepTopBefore > vhE`, is **already true on the real build**
(870 > 844). The check passes on its own precondition and would report green on an app that does
nothing at all. That is the fifth check in this release that cannot fail.

**And the answer the broken check was supposed to give, measured properly: v28 SURVIVES the guard.**
Focusing a field 870px down with `preventScroll: true` — so the browser's own focus scroll cannot
confound it — the page moves `scrollY 0 → 470` and the field lands at top 400 on `c70e06d`, and does
not move at all on `mutant_3`. So the behaviour is correct and the instrument is not.

**The scroll fix itself is genuine and now fully covered.** I re-derived nothing from the commit
message: I built mutants 1, 2 and 4 by hand and **all three are killed** (2 failures each). Both
halves are load-bearing — neither alone stops the yank — and `preventScroll`, which measured nothing
at `5767bee`, is load-bearing now.

**Carried from the previous pass and still open at this commit: the rebuild path builds an app that
does not boot.** `harness-v84-whatsnew.py` is byte-identical at `c70e06d` to what I refused at
`5767bee` (`git diff 5767bee c70e06d -- harness-v84-whatsnew.py` → no change). Running it on
`adfc99c^` produces `ReferenceError: Cannot access 'WHATS_NEW_KEY' before initialization` with
`#root` empty.

---

## The four things you asked me to audit

### 1. `restoringFocus` and the temporal dead zone — CLEAN, and I checked it the hard way

`let restoringFocus = false;` executes at `index.html:4245`; it is read at `4247` (inside the
`focusin` listener registered at `4246`, one line later) and read/written at `5238`/`5244` inside
`render()`.

The only way to trip the TDZ is a **synchronous** call to `render()` during module evaluation before
line 4245 — timers, microtasks and events cannot fire until evaluation finishes, so `setTimeout`
paths are safe by construction. I enumerated every column-0 executable statement above 4245: the
CSS block, `cwInstallErrorLog()` (453), the `window.__syncTest` block (733), a `storage` listener
(921) and a `keydown` listener (4196). **`cwInstallErrorLog()` registers two listeners and returns;
the 733 block assigns hook properties and `queueMicrotask`s the rest. Neither calls `render()`, and
nothing else executes.** The two top-level `render()` calls in the file are at 12587 and inside the
`setInterval` at 12542, both far below 4245. Empirically the app boots with zero page errors on
every run in this pass.

**The `finally` cannot stick true.** It runs on every exit path including a throw from
`focus()`/`setSelectionRange()`, and both of those are already individually wrapped. The only
theoretical hazard is re-entrancy — a focus handler calling `setState()` → `render()` from inside
the restore, whose inner `finally` would clear the flag early. **There is no such handler:**
`grep -n "onFocus\|onfocus\|'focus'"` returns nothing in the whole file, and the only thing left in
the outer restore after `focus()` is `setSelectionRange()`, which dispatches no focus event. Clean,
but it is worth a one-line note in the code that the flag is not re-entrant, because the next person
to add an `onFocus` will not know.

### 2. The 8px slack — I CANNOT ANSWER THIS FOR iOS, AND NEITHER CAN THIS SANDBOX

Chromium only, at Chromium's viewport model, with no on-screen keyboard. The number is defensible
against the thing it was chosen for (a pixel or two of visual-viewport jitter) and I have no way to
measure what iOS Safari's own scroll-to-reveal does when a field is focused with a keyboard opening.

**The risk is specific and worth stating plainly: if iOS moves the layout viewport by more than 8px
when it reveals a focused field, this guard reads that as "the person scrolled" and suppresses the
nudge — switching v28 off on the one platform v28 was written for.** That failure would be invisible
here and obvious on a phone.

**The structural fix, and it is the same idea the other half of this fix already uses:** the
`restoringFocus` flag distinguishes a finger from the renderer **by cause**. The scroll guard
distinguishes them **by effect**, which is exactly why it is platform-dependent. A passive
`wheel`/`touchmove` listener setting a "the person has scrolled since focus landed" flag answers the
same question by cause and needs no magic number. Until then: **item 1 on Aaron's phone checklist —
open the medication editor on the iPhone, tap a field low on the form, and confirm the keyboard does
not leave it hidden.**

### 3. Does the guard delete v28? — NO, measured; but the check that says so is broken

| Build | field top, before → after | scrollY on focus → +1.4s | v28 nudge |
|---|---|---|---|
| `c70e06d` | 870 → **400** | 0 → **470** | **fired** |
| `mutant_3` (nudge deleted) | 870 → 870 | 0 → 0 | did not fire |

Focus was applied in-page with `el.focus({ preventScroll: true })` precisely so the browser's own
focus scroll could not be mistaken for the app's nudge — which is what the suite's version does not
do, and is why it cannot tell these two builds apart.

**BLOCK: `test/v84-whatsnew.mjs:515` cannot fail.**

    deepTopBefore > vhE || deepTopAfter < deepTopBefore - 20 || (deepTopAfter >= 0 && deepTopAfter <= vhE)

Disjunct 1 is a statement about the **precondition** (the field started below the fold: 870 > 844)
and is true before the app does anything — it short-circuits, so disjuncts 2 and 3 are never even
evaluated on the real build. Disjunct 3 would also pass on a build with no nudge, because
`locator.focus()` lets the browser scroll the element into view by itself. **Proven:** `mutant_3`
scores **57 checks, 57 passed**.

**The fix is two lines:** focus with `preventScroll: true` from inside the page, then assert
`window.scrollY` moved — the measurement in the table above discriminates perfectly.

### 4. Section 7e, adversarially — the yank checks are SOUND

| Mutant (verbatim from `falsify/mutants-v84-whatsnew.sh`) | Result |
|---|---|
| **1** — `if (restoringFocus) return;` removed | **KILLED** — 2 failures, `scrollY 1503 -> 1`, save button at 2197 |
| **2** — the 8px scroll guard removed | **KILLED** — 2 failures, identical numbers |
| **3** — the v28 nudge deleted outright | **SURVIVED — 57/57** ← the block above |
| **4** — `preventScroll` reverted to a bare `focus()` | **KILLED** — 2 failures |

Each ran against its own private clone of `c70e06d` on its own port (8991–8994), suite unmodified.
Mutants 1 and 2 killing separately is the important result: **both halves are needed, for different
orders of events, and the check sees both.** Mutant 4 killing is the difference between this commit
and the last one — at `5767bee` I measured `preventScroll` as making no difference at all, and now
that the listener is guarded it is the remaining mechanism, so the revised comment at `5232` is
accurate where the original was not.

**I could not make 7e pass on a build with the yank.** Its timing holds up: it swipes 120ms after
`fill()` — inside the 320ms window, which is the whole point — and then waits 1.8s, past the timer
and past the smooth animation. The one bound worth knowing: a nudge scheduled **beyond** 1.8s would
be missed. Not a defect today; do not lengthen that 320ms without lengthening the wait.

### `falsify.sh` — the fix is correct

`find "$WORK" -mindepth 1 -delete` keeps the directory inode the `http.server` subshell holds as its
cwd, where `rm -rf "$WORK"; mkdir` replaced it and left the server serving nothing. Every mutant
after the first then failed for want of a page and was scored CAUGHT — a sweep that reported a clean
sheet it never measured. **That defect is the reason this whole round exists, and the same class as
the vacuous check above: an instrument that reports success loudest when it can see nothing.** The
comment explaining it is exactly right. I ran my own mutants on private clones rather than through
`falsify.sh`, so this is a reading of the fix, not a measurement of it.

---

## STILL OPEN AT THIS COMMIT (carried, and none of it is fixed here)

**BLOCK — the release is still not reproducible, and the rebuild path builds a blank app.**
`harness-v84-whatsnew.py` is unchanged since `5767bee`. It parses (all 39 `.py` compile), it runs,
and what it writes throws `ReferenceError: Cannot access 'WHATS_NEW_KEY' before initialization` at
module load with `#root` empty — verified by rebuilding from `adfc99c^` and loading the result. It
still inserts the debug-hook block ~1,600 lines above the `const` it reads eagerly, where the fix
that shipped was positional (`index.html:12620`, last in the module). The same script still writes
the false changelog line *"Every past update is listed under 'What's new'"* that the audit had
already removed from the app.

**FINDING — `README.md:14` names the wrong cache key again.** It says `chemowell-app-v84-6`;
`sw.js` at `c70e06d` is `chemowell-app-v84-7`. `./release_check.sh` refuses on exactly this.

**FINDING — `index.html:9064` still reads `'See all updates'`**, the fourth surface claiming the
changelog is complete (five entries, 84 releases), one line under entry text that correctly says
*"Updates from here on"*. `test/v84-whatsnew.mjs:160` names this label, so it is not free to change
silently.

**FINDING — `index.html:9574`, `helpSetQuery()` still calls a bare `next.focus()`** after its own
`render()`. It now needs **both** halves, not just `preventScroll`: it is a renderer refocus, so the
v28 listener will schedule a nudge 320ms after every keystroke unless `restoringFocus` is set around
it too.

**NOTE — the working tree is being edited while I audit.** At the time of writing it carries
uncommitted changes to `index.html`, `sw.js` (CACHE `chemowell-app-v84-8`), `harness-v84-whatsnew.py`
and two suites, several of which appear to address the findings above. **None of that is audited.**
I judged commit `c70e06d` only, via `git archive`, and modified nothing in the repository except
this report.

---

## VERIFIED CLEAN AT `c70e06d`

Six suites, run by me against a private export on its own port (not the working tree):

| Suite | Result |
|---|---|
| `test/v84-whatsnew.mjs` | **57/57** |
| `test/v83-meds-and-reports.mjs` | **80/80** |
| `test/v80-up-next.mjs` | **48/48** |
| `test/v75-no-other-patient.mjs` | **27/27** |
| `test/v76-properties-equivalence.mjs` | **22/22** |
| `test/v76-empty-window-render.mjs` | **13/13** |

The PM's two UNVERIFIED v76 suites are green, as you said. `./release_check.sh` exits 1 on the
README cache key, the standing PM refusal at `3ec6b4c`, and now this report.

Carried forward from the `5600b92 → 5767bee` half of this delta, re-checked and unchanged here: the
ceiling override prompt (`6433`) agrees with `status()`'s lock in every reachable case, including
`ceilingUnit`, `ceilingGroup` and a null ceiling — the one residual disagreement is the volume-cap
path, which is unreachable because `volumeCeilingMl` is never assigned, and which would be closed for
good by reading `st.ceilingLabel` instead of recomputing the label. Rule 0 clean across the whole
delta: no patient name, no gendered pronoun in code or comments, no care-plan dose, no new behaviour
keyed to a medication id; `test/v75-no-other-patient.mjs` ratchets unchanged at 0/0/0. No `h()`
null-attribute pattern, no version literal, no `document.body.textContent` assertion, and no
declaration moved above its readers anywhere in the delta.

From the previous pass I am relying on, not re-deriving: `outputs/AUDIT-app-v84.md`'s conclusions up
to `5600b92`, and my own `5600b92 → 5767bee` findings except where re-measured above.

## WHAT THE BUILDER SHOULD DO

1. **Fix the `v28 is not deleted` check** (`test/v84-whatsnew.mjs:515`): focus in-page with
   `preventScroll: true`, assert `window.scrollY` moved. Then re-run `mutant_3` and watch it die.
2. **Make `harness-v84-whatsnew.py` emit the hook block LAST**, update the changelog text it writes,
   rebuild from base and **load the output** — parsing is not the property that matters.
3. **README's cache key**, `'See all updates'`, and `helpSetQuery` (both halves).
4. **Put the 8px guard on Aaron's phone checklist** as a named risk, or replace it with a
   wheel/touchmove flag and stop depending on a number this sandbox cannot validate.
5. Then the PM re-runs. Its refusal at `3ec6b4c` and this one are what the gate is holding on.

Measured in Chromium against private clones of `c70e06d` on ports 8981 and 8991–8994, plus a rebuild
clone of `adfc99c^` on 8951. The repository working tree was not modified by this pass.
