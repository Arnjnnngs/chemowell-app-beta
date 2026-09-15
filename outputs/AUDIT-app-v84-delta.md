AUDITED-COMMIT: 5767bee
VERDICT: DO NOT SHIP

# Zero Day Audit — ChemoWell app-v84, DELTA PASS on 5600b92 → 5767bee

**HEADLINE: app-v84's headline fix does not fix the bug it was written for. I reproduced the exact
symptom on the commit you are shipping — type in the medication name, swipe down toward "Add
medication", and 500ms later the page slides itself back to the top (scrollY 1220 → 340 → 1),
leaving the button 1,353px below the fold.** `preventScroll` at `index.html:5202` is not what moves
the page; **`index.html:4221` is** — the v28 `focusin` handler's 320ms
`scrollIntoView({block:'center'})`, which I caught in the act by instrumenting the running build
(one call, stack `index.html:4221:31`, fired at y=1201).

**SECOND BLOCK: the rebuild path now runs and produces an app that does not boot.** `5767bee` fixed
`harness-v84-whatsnew.py`'s SyntaxError — the script executes now — and what it writes throws
`ReferenceError: Cannot access 'WHATS_NEW_KEY' before initialization` at module load and renders a
blank page. The SyntaxError was hiding it. That is the temporal-dead-zone failure this file has been
hit by three times, encoded into the release's own documented rebuild path.

Everything else in the delta is sound. All six suites are green against a clean export of `5767bee`,
the README figures are now true, and the Enhancer and Designer passes are real work, not filler.

---

## What I relied on rather than re-derived

`outputs/AUDIT-app-v84.md` (fifth pass, `5600b92`, VERDICT SHIP) — its conclusions on everything up
to `5600b92` stand: BLOCK 1 (the tour walk reaching step 4), BLOCK 2 (the frozen clock), mutants
n1–n8, and the 320/360 width pass. I did not re-run those.

**One correction to the brief:** three commits landed since `5600b92`, not two — `8fe5acd` sits
between `5600b92` and `3ec6b4c` and changed `index.html` (9 lines) plus two suites. I audited the
whole `5600b92..5767bee` delta, so it is covered.

**I did re-test the previous pass's one survivor (n9).** Deleting the "Fill in the details" step from
`TOUR_STEPS` on a clone of `5767bee` now **FAILS** — *"the guide is actually ON the fill-in-the-form
step before we act on it | GUIDE · 4 OF 9 | Medication saved!…"*. The negative-assertion hole is
genuinely closed.

---

# BLOCK 1 — the defect app-v84 says it fixed is still in the build

**Where:** `index.html:4221` (cause) and `index.html:5202` (the committed non-fix).

**What breaks, in the user's words:** open the medication editor, type a name, swipe down to reach
*Add medication* at the bottom of the 2,387px form — the page slides back to the top and the button
goes 1,353px out of reach. This is the first-run guide's own instruction to a brand-new user, on a
release that ships the guide's scroll-lock fix as if that path now works.

**How I verified it — twice, on a clean export of `5767bee`, in Chromium at 390×844:**

1. **My own probe, a real wheel gesture, no suite involved.** Form height 2387px. Wheel down to
   y=1220, then hands off:

       scrollY over 3.5s:  1220 -> 340 -> 1 -> 1 -> 1 -> 1 -> ...
       "Add medication" boundingBox: y = 2197   (viewport 844)

2. **Instrumented the page** — patched `Element.prototype.scrollIntoView` and `window.scrollTo` to
   record every call with a stack. Exactly one call moved the page:

       scrollIntoView med-name @y=1201 :: at http://127.0.0.1:8971/index.html:4221:31

   That is the v28 focusin nudge: it is scheduled when the finger lands in the field and centres the
   field 320ms later **regardless of where the person has scrolled since**.

3. **`preventScroll` is not load-bearing here.** I built a mutant of `5767bee` with line 5202 reverted
   to a bare `freshActive.focus();` and ran the suite against both. **Identical results** — same two
   failures, same numbers. A change with no measurable difference either way is not the fix the
   commit message, the README row and the What's New record all say it is.

**Why the green suite did not see this.** The committed `test/v84-whatsnew.mjs` is 50/50 because
nothing in it scrolls away from a focused field and then leaves the page alone. A check that does
exist — uncommitted, in the working tree while I audited — fails 2/7 against `5767bee`.

**Not a regression:** the yank pre-dates this release (v28). Shipping does not make it worse. What
makes this a refusal is that the release is recorded as having fixed it, the new-user path this
release is otherwise about still dead-ends on it, and the next session reading the README will
believe it is closed.

**The fix is at 4221, not 5202:** if the page has moved more than a few pixels since focus landed,
the person has already said where they want to be — skip the nudge. Keep 5202; it is correct on any
screen that does re-render under a caret, but it must stop being described as the fix.

---

# BLOCK 2 — `harness-v84-whatsnew.py` runs now, and what it builds is a blank app

**Where:** `harness-v84-whatsnew.py`, the "debug hooks" `cut()` at the end of the file.

**Verified by rebuilding, not by reading.** `git archive adfc99c^` into a scratch dir, copied in the
HEAD version of the script, ran it:

    OK -- What's New applied        (exit 0 — the SyntaxError fix is real)

Served the result and loaded it:

    #root len: 0
    visible  : ""
    errors   : ReferenceError: Cannot access 'WHATS_NEW_KEY' before initialization

**Why.** The script still inserts the debug-hook block at its old position (~line 7130 of the output,
about 1,600 lines above the `const WHATS_NEW_KEY` it declares), and exports `key: WHATS_NEW_KEY`
**eagerly**. The `get version()` getter added in `5767bee` protects `APP_VERSION` and nothing else.
The fix that actually shipped in `index.html` was *positional* — the hook block moved to the end of
the module (`index.html:12620`, the last statements before `</script>`) — and the script was never
updated to match. The script's own new comment states the getter as the guard, which is the reasoning
the release explicitly rejected: *"Patching each field would have fixed the two that were caught and
left the next one."*

**Also in the same script:** the `CHANGELOG` block it writes still contains
*"Every past update is listed under 'What's new' in the menu"* — the false claim the audit made the
team remove. `index.html:8926` correctly reads *"Updates from here on are listed under 'What's new'"*.
So a rebuild reintroduces a copy defect that was blocked on earlier in this same release.

**Reproducibility, plainly:** app-v84 is still **not** reproducible from base + harness. The PM's
finding stands, and it is now worse than it was, because a script that crashes on import announces
itself and a script that silently emits a non-booting app does not. Every `.py` in the repo does now
pass `python3 -m py_compile` (39/39) — parsing was never the property that mattered.

---

# FINDINGS (do not block, in severity order)

**N1 — the FOURTH surface still claims the changelog is complete: `index.html:9025`, the button
labelled `'See all updates'`.** You asked me to hunt for a third; the drawer row (4447) and the screen
header (9002) are fixed, and this one is the primary button of the pop-up the fix started in. It sits
one line under the entry text that correctly says *"Updates from here on"*, so a single view
contradicts itself, and it is the control that performs the navigation. `CHANGELOG` holds five entries
for an 84-release app. Suggested: *"See more updates"*. Note `test/v84-whatsnew.mjs:160` names this
button in a check, so the label is not free to change silently.

**N2 — `index.html:9535`, `helpSetQuery()` calls a bare `next.focus()` after its own `render()`.** It
is the one other place that restores focus by id after a rebuild, and it did not get the same
treatment — the inconsistency you asked about. Low harm (the Help search field is near the top of its
screen), but if 5202 is right then 9535 is wrong for the same reason. The other four `.focus()` sites
(4183, 4187, 4206, 4207 — drawer open/close and the Tab trap) are deliberate focus moves where
scrolling is wanted; leave them.

**N3 — the copy fix has no check.** No suite asserts the drawer helper or the What's New header
strings; no test file changed in `5767bee`. The claim that was wrong on four surfaces is now protected
by nothing but this report.

**N4 — `README.md:14` contains a truncated claim and an unterminated code span:**
`` `APP_VERSION` → `app-v84`, `sw.js` CACHE → ` `` followed straight by the next paragraph. The stale
`chemowell-app-v84-2` was deleted and its replacement never written; the correct key does appear at
the end of the row, which is why the gate passes. Close the backtick and finish the sentence.

**N5 — the working tree was modified by another session while I audited.** At the start `git status`
was clean; by the end `index.html`, `falsify.sh` and `test/v84-whatsnew.mjs` were all modified and
`falsify/` was new. **I audited commit `5767bee` only** — via `git archive`, never the working tree,
and I edited nothing. For information: that in-flight work has independently reached BLOCK 1's
diagnosis (its comment names line 4221 and states that `preventScroll` "changed nothing a person could
see"), and **as it stood when I measured it, its guard did not stop the yank either** — the same two
checks failed against it with the same numbers. Whoever takes BLOCK 1 should re-measure rather than
assume the WIP closes it.

---

# WHAT I CHECKED AND FOUND CLEAN

**The ceiling override prompt (`index.html:6430`) agrees with `status()`'s lock in every reachable
case.** `renderToday` computes `const dc = med.ceiling ? dailyCeiling(med) : null` — the same object
`status()` tests at 2584 — so:

| Case | `status()` | the red prompt | Agree? |
|---|---|---|---|
| mg ceiling, rolling (`windowH > 0`) | `rollingCeiling: true` | *"Up to the …"* | ✅ |
| mg ceiling, plain daily | no `rollingCeiling` | *"Daily limit of …"* | ✅ |
| `ceilingUnit` set (+ a stray `rollingCeilingH`) | daily — `dailyCeiling` short-circuits, `windowH: 0` | *"Daily limit of …"* | ✅ **this is the fix** |
| `ceilingGroup` set | daily, `windowH: 0` | *"Daily limit of …"* | ✅ |
| `dailyCeiling()` → null | the mg branch never runs | prompt unreachable except via the volume cap | n/a |

The one residual disagreement is pre-existing and unreachable: if `ceilingHit` comes from the
**volume** cap (`med.volumeCeilingMl`, 2575), the prompt names the mg ceiling — or the literal string
*"Daily limit of limit reached"* when there is no mg ceiling — because it recomputes the label from
`dc` instead of reading `st.ceilingLabel`, which `status()` already set correctly. `volumeCeilingMl`
is never assigned anywhere in the file, exactly like `rollingCeilingH`, so no device can reach it
today. **Worth logging: reading `st.ceilingLabel` would close the class rather than the instance** —
it is the same shape as the ceiling-bar bug this release fixed.

**The other three app changes.** The `try/catch` at 5202 is harmless (no browser throws on a
`focus(options)` argument; the fallback is dead code and degrades to the old behaviour if it ever
runs). The caret restore below it is unaffected — `setSelectionRange` does not scroll. No `.focus()`
anywhere is a validation-error focus, so `preventScroll` cannot strand an error off-screen. The two
copy strings are true as written.

**Rule 0:** the delta contains no patient name, no gendered pronoun (code comments included), no dose
or ceiling from a care plan, and no new behaviour keyed to a medication id.
`test/v75-no-other-patient.mjs` 27/27, ratchets unchanged at 0/0/0.

**Traps:** no `h()` null-attribute pattern in the delta; no declaration moved, so no new temporal dead
zone (the hook block is still last, 12620–12657 of 12659); no version literal and no
`document.body.textContent` in anything that changed.

**Suites, run by me against a clean export of `5767bee` on its own port** (not the working tree):

| Suite | Result |
|---|---|
| `test/v84-whatsnew.mjs` | **50/50** |
| `test/v83-meds-and-reports.mjs` | **80/80** |
| `test/v80-up-next.mjs` | **48/48** |
| `test/v75-no-other-patient.mjs` | **27/27** |
| `test/v76-properties-equivalence.mjs` | **22/22** ← the PM's UNVERIFIED pair |
| `test/v76-empty-window-render.mjs` | **13/13** ← the PM's UNVERIFIED pair |

Both v76 suites are green at this HEAD. **`./release_check.sh` exits 1**, on one refusal only: the
standing `PM-app-v84.md` DO NOT SHIP examined `3ec6b4c`. Its README-cache-key and design-seat
refusals are both cleared.

**The paperwork the PM blocked on — real, not claimed:**

- **README app-v84 row.** Every figure now matches what I measured: 50/50, 80/80, 48/48, 27/27, and
  `chemowell-app-v84-6` = `sw.js`'s actual `CACHE`. The last three commits are described, including
  the scroll fix. The false *"Every past release is under What's new"* is gone. (But see BLOCK 1: the
  scroll paragraph describes a fix that does not fix, and N4.)
- **`outputs/ENHANCER-app-v84.md` — a real pass.** Spot-checked two claims against code. **E5** ("the
  Temperature report can add and list but not correct or remove") — `renderTemperatureReport()` at
  10787 has range controls and no Remove or Edit; true. **E3** ("the doses-today line is a dead end")
  — `medTodayLine()` (8239) renders at 8429 inside a plain `<span>` with no handler; true. It is also
  honest that it ran after the build instead of before.
- **`outputs/DESIGN-app-v84.md` — a real pass.** Spot-checked two measurements against the artefacts.
  The fifteen PNGs in `outputs/design-app-v84/` are exactly 320, 360 and 390 pixels wide, five screens
  each. The reorder-arrow finding is exact: `width: '40px', height: '40px'` at index.html:8326, under
  the 44px floor, and with `margin: '-4px 0'` pulling the pair closer still.

---

## WHAT THE BUILDER SHOULD DO

1. **Fix the yank where it lives (4221)** and re-measure with a real wheel gesture, not a click.
   Commit the interaction check with it — Rule 5.5: this whole class is invisible to a still frame.
2. **Rewrite the record.** The README row, the commit message and anything else saying `preventScroll`
   cured the yank are describing a fix that measured no difference.
3. **Make `harness-v84-whatsnew.py` emit the hook block LAST**, matching what shipped, and update the
   `CHANGELOG` text it writes. Then rebuild from base and **load the output** — a patch script is not
   verified by parsing, only by booting what it produces.
4. N1 (the fourth "all updates" surface) and N2 (9535) are one line each.
5. Then the PM re-runs against the new HEAD; its refusal is what the gate is holding on.

Measured in Chromium against private clones of `5767bee` on ports 8961/8971/8972/8975, and a rebuild
clone of `adfc99c^` on 8951. The repository working tree was not modified by this pass.
