AUDITED-COMMIT: ffc7bff441065ee45d76788f09a1c5c7fb275135
VERDICT: SHIP

# Zero Day Auditor — app-v84, pass 10 (delta since 400bd37)

Branch `claude/caretracker-team-review-i83ik2`, tree clean at audit start. Five commits:
`7adafef`, `22c4475`, `8980cf0`, `79e9707`, `ffc7bff`.

## HEADLINE

**The app carries no new risk, and I proved that rather than accepting it.** With whole-line
`//` comments stripped, `index.html` at HEAD is **md5-identical** to `400bd37` — the commit
I SHIPped. Across `714602b..HEAD` the only non-comment change is the one-character prefix
fix in `4b54901`, which I cleared by measurement in delta8.

**The new `test/harness-payload-matches-app.py` closes both gaps I found in its
predecessor.** 17/17. It now covers all five payload constants and all eleven `cut()`
insertions — including the eight inline literals the `.mjs` could not see — with
`BASE_HOOKS` a named exclusion asserted ABSENT from HEAD. Falsified: reverting the prefix
turns it red on two checks; planting `BASE_HOOKS` text into `index.html` fires the
absent-assertion.

**The `None` / `''` separation you asked about is COMPLETE. I could not move the collapse.**
Details in §2.

**What it still cannot see: it audits `cut()` calls, not the mutation of `src`.** Four
bypass shapes — `src.replace(...)`, `src + "…"`, `"".join([src, …])`, `re.sub(…, src)` —
each writing stale text the app does not contain, every one scoring **17 checks: 17 passed,
0 failed**. Latent today (proved: twelve of thirteen assignments to `src` come from `cut()`,
the thirteenth from `read_text`, and the only `src.replace` is inside `cut` itself), but
`verify-rebuild.sh`'s new banner now says *"every piece of app text the patch script
carries"* — true only by convention. **Same shape one level up: the `.mjs` could only see
the spelling it was written against (`r"""`); the `.py` can only see the function it was
written against (`cut`).** A ~6-line fix, prototyped and falsified, is in §3.

## 1. THE APP — no new risk, measured

| comparison | comment-stripped `index.html` | identical |
|---|---|---|
| `400bd37` (what I SHIPped) vs HEAD | `2cf265655d53` / `2cf265655d53` | **yes** |
| `a1d023f` (my delta8 commit) vs HEAD | `2cf265655d53` / `2cf265655d53` | **yes** |
| `714602b` vs HEAD | `ffcd5a6fff5a` / `2cf265655d53` | no — **exactly one line**, the prefix fix |

The five-line `400bd37..HEAD` diff is the fix for my own delta8 finding E: *"exactly the set
a reset can clear"* → *"the set a reset can clear LESS THE MARKER ITSELF"*, with the reason
recorded. The identical correction was made to the `SNAPSHOT` payload in
`harness-v84-whatsnew.py` — **which is the new checker already doing its job**: had only one
of the two been changed, `SNAPSHOT` would appear 0 times in `index.html`. That is precisely
the red I produced in falsification (a).

## 2. THE COVERAGE FLOOR — the separation holds; I could not move the collapse

The three buckets are mutually exclusive and exhaustive over every `cut()` with ≥3 args:
`v is None` → `_unresolved`; `v is not None and not v.strip()` → `_deletions`; otherwise →
`inserts`. `_unresolved` carries its own explicit red rather than only perturbing the
arithmetic. Driven, not read:

| planted | result |
|---|---|
| unresolvable payload — f-string | `FAIL … cannot resolve` · 16/17 |
| unresolvable payload — method call `.upper()` | `FAIL … cannot resolve` · 16/17 |
| **unresolvable AND a genuine deletion together** | **`FAIL … cannot resolve` · 16/17 — one red, arithmetic balanced** |
| `cut()` with only 2 args | `FAIL  13 cut() call(s), 1 deletion(s), 0 unresolved, but 11 payload(s) resolved` |
| control, restored | 17/17 |

The mixed case is the one that matters and it separates correctly: the deletion is counted
as a deletion, the unresolvable one is named on its own line, and no second spurious red
appears. **The collapse has not moved anywhere I could find.**

One caution worth writing down: `value_of` resolves `'a' + 'b'`, so my first two attempts at
an "unresolvable" payload were resolvable and tested the wrong thing. I noticed and redid
them. A payload built by concatenating literals is *visible* — which is correct behaviour,
not a gap.

## 3. WHAT IT STILL CANNOT SEE — the only finding of this pass

`cut()` is audited. **`src` is not.** Every bypass writes into the app and leaves the board
green:

| planted, all writing text the app does not have | result |
|---|---|
| `src = src.replace("…", "… // STALE-A")` | **17 checks: 17 passed, 0 failed** |
| `src = src + "<!-- STALE-B -->"` | **17/17** |
| `src = "".join([src, "<!-- STALE-C -->"])` | **17/17** |
| `src = re.sub(r'…', '… // STALE-D', src, count=1)` | **17/17** |

**It is latent, and I established that by AST rather than by reading:** `src` is assigned 13
times — once from `read_text`, **twelve times from `cut()` and nothing else** — every `cut()`
call takes exactly 4 args, the only `src.replace` in the file is inside `cut` itself, and
`HTML.write_text(src)` is the single output. So there is no live bypass today.

But the guarantee rests on a convention. The file's own words are *"So the guarantee gets a
mechanism instead of a good intention."* **Proposed fix, ~6 lines, inside the AST walk
already there — and I falsified it both ways rather than proposing it untested:**

    for n in tree.body:
        if isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'src' for t in n.targets):
            v = n.value
            is_cut  = isinstance(v, ast.Call) and isinstance(v.func, ast.Name) and v.func.id == 'cut'
            is_read = isinstance(v, ast.Call) and isinstance(v.func, ast.Attribute) and v.func.attr == 'read_text'
            if not (is_cut or is_read):
                FAIL('line %d assigns `src` without cut()' % n.lineno)

Measured: **ok on the real script; RED on all four bypass shapes, naming the line; ok again
on restore.** With it, the banner's word *"every"* becomes true by construction.

**Not blocking** — nothing is bypassed today, and this is a new mechanism that works. It
should land before the next hand touches the patch script.

## 4. THE TWO HALVES COVER BOTH ARGUMENTS OF EVERY `cut()` — worth stating positively

The payload check compares every `cut()`'s **`new`** against HEAD. The rebuild that runs
immediately afterwards exercises every `cut()`'s **`old`** against the BASE commit — a stale
anchor makes `cut` die with `REFUSED`, loudly. Neither half covers both; together they do,
**and that only holds because `verify-rebuild.sh` runs them in that order.** The same is
true of `BASE_HOOKS`: this check asserts it is absent from HEAD, and the rebuild asserts it
is present in BASE.

## 5. EVERYTHING ELSE YOU ASKED ME TO VERIFY — checked, not taken

* **`verify-rebuild.sh` refuses a dirty tree** (my delta8 finding C). Falsified in a
  throwaway clone: dirty `index.html` → refused, exit 1; dirty `harness-v84-whatsnew.py` →
  refused, exit 1; clean → proceeds. Both halves now judge the same tree.
* **No hard-coded `17`** anywhere in `verify-rebuild.sh` or the checker. The floor is
  counted from the script's own `cut()` calls.
* **README hook counts**, by parsing rather than reading: `BASE_HOOKS` = **2**
  (`__doseTest`, `__backTest`); `MOVED_HOOKS` = **5**; the probe collects **5** fields;
  `index.html` carries **9** distinct `window.__*` (the four others are `__notifTest`,
  `__syncTest`, `__tourHighlighted`, `__warnTest`). The README says two and five and names
  the exact three hooks `MOVED_HOOKS` adds — all correct.
* **HANDOFF task 24** reads `DONE — pushed, awaiting your word`.
* **HANDOFF records the `REFUSING: HTTPS_PROXY set.` trap** on `test/v72-med-purpose.mjs`
  with the exact `env -u …` invocation, and both suites that print `N/N passing` instead of
  a `checks:` line, with the right general lesson — *match on the figure, never read silence
  as a pass*. My delta8 run used that `env -u` prefix for all twelve, so my 65/65 was real.
* **`SWEEP-app-v84.md`'s new scope note is accurate and precise** — it names `4b54901` as the
  only code change after the run, credits the re-measurement, and says the rest is comments.
* **`./verify-rebuild.sh` end to end at HEAD:** payload 17/17, rebuild `OK`, `#root` 4205,
  `BOOTS`, exit 0.

## 6. MUTANTS 1–16 AGAINST HEAD — I ran the ones that matter; the rest are not needed

You offered to run them. I ran the blast radius myself instead, at HEAD, on a free port,
alone on the box:

    === BASELINE  96 checks: 96 passed, 0 failed
    MUTANT 12  90/96   MUTANT 13  95/96   MUTANT 14  95/96
    MUTANT 15  95/96   MUTANT 16  94/96
    === 5 mutant(s) caught, 0 survived, 0 could not be measured, 0 anchor(s) stale

**Mutant 16 is the one that mattered** — *"the first-ever line is gone"* is driven by
`whatsNewFirstEver`, which is assigned from the snapshot the prefix fix changed. It is
caught. With my delta8 run of 17–19, **mutants 12 through 19 are now swept at HEAD.**

**Mutants 1–11 do not need running.** Five reasons, in descending strength:

1. HEAD's executable `index.html` differs from the swept tree by **one character**.
2. That character can only change `HAD_PRIOR_CHEMOWELL_DATA` for a key matching
   `chemowell-app` but not `chemowell-app-`. I enumerated every write path in the file in
   pass 8: no such key exists, and none is constructed dynamically.
3. Every mutant whose subject can read that value — 12 through 19 — is now swept at HEAD and
   all eight are caught.
4. Mutants 1–11 target the focus restore, the v28 nudge, `preventScroll`, `anyOverlayOpen`,
   the scroll lock, the touchmove guard, a button label and an aria-label. **None reads the
   snapshot.**
5. The full suite is 96/96 against HEAD, measured four separate times today.

If you want them anyway the cost is about 25 minutes, but I would not spend it, and I would
rather the same time went into §3.

## 7. MINOR

* **`outputs/PM-app-v84-pass2.md` §9** says mutants 1–16 have never been swept against HEAD
  *"though HEAD's `index.html` is one comment block away from the tree they were swept
  against."* The swept tree is `714602b`, and HEAD differs from it by the prefix fix **plus**
  comments. The sweep artifact itself gets this exactly right; the PM's sentence omits the
  only code change — which is the very thing that made the question worth asking.
* **The checker's denominator moves with its result:** 17 checks when green, 16 when anything
  fails, because the closing coverage `ok` only increments when `bad == 0`. A total that
  changes with the outcome is harder to compare run to run; counting it unconditionally would
  cost one line.
* **It checks existence, not position.** A payload can be present in HEAD and inserted
  somewhere else by the script. Already disclaimed in the file's own header — recorded so the
  exemption is written down rather than assumed.

## 8. RULE 0

Nothing this delta added to `index.html` is executable, and the five comment lines carry no
patient name, gendered pronoun, care-plan dose or medication-id branch.
`test/v75-no-other-patient.mjs` **27/27**.

## WHY SHIP

Both of my delta8 findings (A and B) are closed by a mechanism that I attacked and could not
break on the axis it was built for. Finding C is closed and falsified. D and E are corrected.
The app's executable content is byte-identical to what I already cleared. The one thing left
— `src` mutated outside `cut()` — is latent, proved latent, and carries a tested six-line
fix. Nothing here is false about the code as it stands, and nothing is reachable by a user.
