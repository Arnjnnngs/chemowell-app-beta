AUDITED-COMMIT: 714602b69619935ed660f97cf2c5e9c0b9562757
VERDICT: DO NOT SHIP

# Zero Day Auditor — app-v84, pass 8 (delta since 8bcb8c9)

Branch `claude/caretracker-team-review-i83ik2`, working tree clean at audit start.
Delta: `8bcb8c9..714602b` — six commits, `index.html` +41/-12, plus `falsify.sh`,
`harness-v84-whatsnew.py`, `test/v84-whatsnew.mjs`, `verify-rebuild.sh`,
`test/rebuild-boots.mjs`, `README.md`, `outputs/`.

## HEADLINE

**The app code in this delta is clean and I could not break it. The block is narrow and
sits entirely in the records and the harness — and it is the same class this release has
already refused five times: a record asserting a mechanism the code does not have.**

Two, measured rather than read:

1. **`falsify.sh`'s summary line cannot report one of the four outcomes it scores** — the
   DID NOT APPLY branch this delta added. Driven through all four outcomes, a mutant whose
   anchor no longer matches prints `=== 0 mutant(s) caught, 0 survived, 0 could not be
   measured`. The comment directly above says that line "says which of the four outcomes
   actually happened". It says three. This is the instrument the release's headline figure
   is read off, and the fix it belongs to was written for the failure *"the sweep stopped
   three times on a stale mutant and never said so"*.
2. **`outputs/PM-app-v84.md`'s evidence table reports `hooks: all eight`** for the rebuilt
   file. I ran the probe: it returns **five** fields and asserts two. There is no grouping
   of eight anywhere in the file. A figure in the evidence column of a signed sign-off that
   nothing in the repo produces.

**The headline finding I opened this pass with has since been answered, and I record that
plainly.** `README.md`'s *"Nineteen mutants swept, nineteen caught, none survived"* was, at
the time I began, a figure no run had produced — the Scribe refused on it as B2 at
`7eb5daa`, and this delta responded by raising the number from eighteen rather than
attaching a run. The sweep completed while this pass was running, at this commit:

>     === BASELINE  96 checks: 96 passed, 0 failed
>     === 19 mutant(s) caught, 0 survived, 0 could not be measured

No mutant hit the DID NOT APPLY branch, so that tally is faithful for this run. **B2 is
closed and the README row is now true.** Finding 1 below is withdrawn.

## FINDINGS

### 1. WITHDRAWN — the "nineteen caught" claim now has a run behind it

Open when this pass started; closed by the sweep quoted above, which I watched to
completion at `714602b`. Recorded here rather than deleted because the sequence matters:
the sentence was written before the measurement existed, and was raised to nineteen from
eighteen in this delta while still unevidenced. It happens to have come true. Next time it
should be written after the run, not before it.

### 2. BLOCKING — the tally drops one of its four outcomes

`falsify.sh` added a DID NOT APPLY branch this delta. It increments `ALIVE` but neither
`SURVIVED` nor `UNMEASURED`. The summary line prints only the latter three.

Falsified by running the real counter/tally block with the suite stubbed (all four
outcomes driven; `git`/`tar` stubbed, counting logic byte-identical to `falsify.sh`):

| driven outcome | summary line printed | exit |
|---|---|---|
| caught | `=== 1 mutant(s) caught, 0 survived, 0 could not be measured` | 0 |
| survived | `=== 0 mutant(s) caught, 1 survived, 0 could not be measured` | 1 |
| could not measure | `=== 0 mutant(s) caught, 0 survived, 1 could not be measured` | 1 |
| **anchor did not apply** | **`=== 0 mutant(s) caught, 0 survived, 0 could not be measured`** | 1 |

`DEAD + SURVIVED + UNMEASURED` no longer equals the mutants attempted, and the outcome
that happened is nowhere in the line. The comment directly above it says:

>     The summary line is the only line most people read; it says which of the four
>     outcomes actually happened.

It says three of the four. The exit code is right, so nothing ships silently — but the
one line the figure in finding 1 gets read off cannot state it. Fix: a fourth counter,
printed.

**Mitigating, and checked rather than assumed:** all 19 mutant anchors DO currently match
`HEAD:index.html`. Applied each `mutant_N` to a scratch copy of HEAD outside the repo —
19 defined, 19 applied, 0 no-ops. So the sweep now running is not hitting this branch.

### 3. NON-BLOCKING — the busy-port guard works; its recorded reason is false

`falsify.sh` and `verify-rebuild.sh` both say the `-f` guard failed because a squatting
`python3 -m http.server` *"in a directory with no index.html -- which answers 404"*.
Measured against a bare `http.server` on an empty directory:

| request | status | `curl -f` exit |
|---|---|---|
| `GET /` | **200** (directory listing) | 0 — would have fired |
| `GET /index.html` | 404 | 22 — would not have fired |

The shipped guard requests `/`. On the scenario the comment names, `-f` would have fired;
what 404s is `/index.html`, which is the READINESS curl, not the guard. No committed
version of `falsify.sh` ever contained a `-f` busy-port guard (`git log -p --all`), so the
account describes an uncommitted intermediate whose request path cannot be recovered.

**Stated precisely, because the weaker version of this claim is the honest one:** the
squatter the comment describes answers the shipped guard's request with 200, not 404, so
the failure mode the comment gives does not apply to the code it annotates. A reader
concludes the `-f` flag was the whole problem when the requested path was equally
load-bearing. The guard's own behaviour is correct and I falsified it both ways — squatter
refused with exit 1, free port not refused.

### 4. NON-BLOCKING — the hang case the brief asks about is covered downstream

A port open at TCP level that never answers: the guard MISSES it (curl exits 28 after the
2s cap). Measured. But the clone's server then fails to bind, `kill -0 "$SRV"` catches it
within one iteration, and the sweep aborts printing `OSError: [Errno 98] Address already
in use`. The gap is real and closed by a different line added in the same delta. Worth a
sentence in the comment; not worth a block.

### 5. NON-BLOCKING — `verify-rebuild.sh` credits the wrong line for its own guarantee

It says the gate asks *"did evaluation reach the LAST line of the module (which is what
the debug-hook block proves)"*. `rebuild-boots.mjs` asserts `__whatsNewTest` (index.html
12812) and `__backTest.version` (12804). `__tempTest` (12817) and `__eraseTest` (12822)
are assigned AFTER both and are not asserted; `hooks.older` and `hooks.firstEver` are
collected and never checked. A throw at 12817 is caught — by `pageerror`, not by the
hooks. The property holds; the sentence attributes it to the wrong mechanism.

`hooks.version === 'app-v84'` also pins a version literal in a check, which this project's
sibling rulebook forbids by name. It will red on app-v85 for no reason.

### 6. BLOCKING — "all eight hooks" in the PM correction is not what the probe returns

`outputs/PM-app-v84.md`'s new table reports `hooks: all eight` for the rebuilt file and
the HEAD control. **Measured, by running the probe** (`./verify-rebuild.sh`, and directly
against HEAD):

>     hooks: {"whatsnew":"object","version":"app-v84","key":"chemowell-app-seen-version",
>             "older":"function","firstEver":"function"}

Five fields, of which `ok` asserts two. No grouping in the file yields eight. A figure in
the evidence column of a signed sign-off that nothing in the repo produces. **Promoted to
blocking** — it is the second of the two headline items.

### 7. WIPE_SURVIVORS — behaviour-preserving, PROVED, and the coupling claim is true

Extracted both predicates verbatim from `8bcb8c9:index.html` and `HEAD:index.html` (regex
extraction, not retyped) and ran old against new over 107 key-set cases built from every
real key plus adversarial ones:

    cases=107  snapshot-differences=0  erase-differences=0

**The rig was falsified:** deleting the new snapshot's `WIPE_SURVIVORS` skip makes it
differ from old in 5 of those cases, so the harness can see a difference.

Round-trip property (storage -> `eraseAllAppData()` -> snapshot), which is the
user-visible one:

* As shipped: the snapshot reads TRUE after a factory reset only when a key matching
  `chemowell-app` but NOT `chemowell-app-` is present. `chemowell-app-license-v1`,
  `profiles-v1`, `seen-version`, unrelated keys: all correctly FALSE.
* Adding a key to the SHARED list (`profiles-v1`, and a non-hyphen key) introduces **no
  new failing case**. So the comment's *"adding a survivor here is enough"* is TRUE, and
  precisely scoped — it claims nothing about the prefix.

### 8. LATENT, with a one-character non-destructive fix — the unshared prefix

`HAD_PRIOR_CHEMOWELL_DATA` tests `k.indexOf('chemowell-app') !== 0`; `eraseAllAppData()`
tests `k.indexOf('chemowell-app-') === 0`. A key matching the first but not the second
counts as prior data and is NOT removed by a factory reset, so the phone reads as an
upgrade forever — the exact defect this release fixed.

**Verified LATENT, not live.** Every `localStorage` write in the file resolves to a
hyphenated key: enumerated all 9 `setItem` and all 24 `saveJSON` call sites and every
`chemowell*` string literal. The two non-hyphen literals are `'chemowell-'` (a CSV export
filename, line 10453) and `'chemowell-pair-v1'` (an HKDF salt, line 764) — neither is a
storage key. `'chemowell-app-ui-view'` is `sessionStorage` only, which the snapshot never
walks. Neither sibling repo writes a `chemowell-app*` key.

**Answer to the question put to me: it is half a fix that reads as a whole one, and the
remedy is not the destructive one.** Unifying on the erase side would widen what a reset
deletes — do not. Unifying on the SNAPSHOT side deletes nothing:

    -      if (!k || k.indexOf('chemowell-app') !== 0) continue;
    +      if (!k || k.indexOf('chemowell-app-') !== 0) continue;

Measured: this closes every one of the 22 latent failing cases, in all three survivor-list
configurations, and changes nothing on today's data. It is also the semantically correct
question — the snapshot should ask about exactly the set a reset can clear. **Not a block**
(unreachable today), but it should land before the comment above it is read by anyone as
settling the matter, and the comment should say the prefixes are deliberately unshared.

### 9. MINOR — records

* `outputs/DESIGN-app-v84.md`: the replacement paragraph ends *"...true for that person.
  The notice sits above the guide and dismisses normally."* — the last sentence is an
  un-deleted leftover of the text it replaced.
* `MUTANT_DESC_8` says *"'Got it' does not stamp the version"*; the mutant guts
  `whatsNewMarkSeen()` itself, so it also removes the startup stamp. The `index.html`
  comment describing that wider effect is correct; the description is not.
* `outputs/SCRIBE-app-v84.md` carries a flush-left `AUDITED-COMMIT` + `VERDICT: DO NOT
  SHIP` at `7eb5daa`, but `outputs/SCRIBE*` matches neither the `AUDIT*` nor the `PM*`
  glob in `release_check.sh`. That standing refusal is invisible to the gate.
* The only PM sign-off for this release (`PM-app-v84.md`, `3ec6b4c`) refuses. A current PM
  pass is required whatever this desk says.

## CHECKED AND CLEAN

* **Rule 0.** No patient name, gendered pronoun, care-plan dose/ceiling/schedule or new
  medication-id branch in any line this delta added to `index.html`.
  `node test/v75-no-other-patient.mjs` -> **27/27**, all four ratchet ceilings at 0/0/0.
* **No temporal dead zone in the delta.** `LICENSE_KEY` (159) < `WIPE_SURVIVORS` (170) <
  `HAD_PRIOR_CHEMOWELL_DATA` (207); hook block last in the module. Same ordering holds in
  the file the rebuild produces.
* **The "module evaluates twice on a first-ever visit" comment is TRUE.** `sw.js` calls
  `self.skipWaiting()` on install and `self.clients.claim()` on activate, so an
  uncontrolled first-ever page IS claimed, `controllerchange` fires and the single reload
  happens. Pass 2 is held by the marker, as the comment says.
* **The rebuild runs.** `aaeca4f:index.html` + `harness-v84-whatsnew.py` in a scratch dir
  exits 0 and emits all four `WIPE_SURVIVORS` / `__eraseTest` lines exactly once, matching
  HEAD. 30 hunks still differ from HEAD, consistent with the README's own statement that
  fourteen audit commits have no patch scripts.
* **`overlay: true` really is gone as a mechanism.** The string survives once, at line 1829,
  inside the comment describing the deleted flag; no `overlay:` is used as data anywhere.
  `anyOverlayOpen()` reads the DOM as the record says. Scribe B1 is closed.
* **The README's own numbers check out against the file:** `CHANGELOG` holds 5 entries;
  `BACK_LAYERS` holds 26 and the README's correction already says 26 (with 23 marked as a
  point-in-time figure); `test/v84-whatsnew.mjs` contains 96 `t()` calls, matching the
  sweep's `96 checks: 96 passed, 0 failed` baseline.
* **`waitForGuide()` is not a weaker check than the 1600ms it replaced.** It is new in this
  delta (`e5b4adb`), but it was already present at `7eb5daa`, where the Scribe ran
  `FALSIFY_FROM=17 FALSIFY_TO=19` and got all three caught, each dying at 94/96 on the two
  first-run assertions. So the guide-mounting signal does fire before the notice would.
  I flagged this as a regression risk and it is empirically answered.
* **The line-number comments replaced by `grep lastUserScrollAt` hints are accurate** —
  the identifier is declared at 4316 and the `focusin` listener is at 4321. The old
  "near line 4218" was already ~100 lines stale.

## THE BROWSER WORK, RUN AFTER THE SWEEP CLEARED

The 19-mutant sweep owned the box for the static half of this pass, as the brief required.
It finished at 18:19; everything below was run after it, on a free port, with nothing else
using the browser.

### `./verify-rebuild.sh` — PASSES, and matches the PM's recorded figure

    -> rebuilding aaeca4f + harness-v84-whatsnew.py
    OK -- What's New applied
    uncaught exceptions: none
    #root innerHTML length: 4205
    BOOTS                                     (exit 0)

`#root` 4205 is exactly the number `outputs/PM-app-v84.md` records for both the rebuilt
file and the HEAD control. That column of the correction table is verified. The `hooks`
column is not — see finding 6.

### `test/rebuild-boots.mjs` — FALSIFIED FOUR WAYS, and it holds

Four builds served from a scratch directory, the gate run unmodified against each:

| build | uncaught | `#root` | verdict | exit |
|---|---|---|---|---|
| HEAD, untouched | none | 4205 | **BOOTS** | 0 |
| a temporal-dead-zone read injected at line 159 — the exact class this file shipped three times | `ReferenceError: Cannot access 'WHATS_NEW_KEY' before initialization` | 0 | **DEAD** | 1 |
| boots, but `render()` writes 12 characters into `#root` | none | 12 | **DEAD** | 1 |
| boots and renders fully, but mutant 18 applied — the snapshot no longer skips the licence | none | 4205 | **BOOTS** | 0 |

So the gate catches a build that does not boot AND a build that boots and does not render,
and it passes a build that boots and is semantically wrong. **That last row is not a
defect**: `verify-rebuild.sh` says in its own header that it is "a boot check, not a
reproducibility proof, and saying otherwise would be the same overstatement this release
keeps finding in its own records". That sentence is accurate and is the right way to have
written it.

**On the `> 500` threshold the brief asks about:** it fires at 12 characters, and the
healthy value is 4205, so there is roughly eight-fold headroom. A build rendering a partial
shell above 500 characters would pass on that clause alone — but it would have to do so
while also producing no `pageerror` and a live `__whatsNewTest`, which is a narrow gap. Not
worth a block; worth knowing the number is 12% of the real one rather than a measured floor.

## WHAT IT WOULD TAKE TO CLEAR THIS

All four are in records and harness. None is in the shipping app.

| # | what | size |
|---|---|---|
| 1 | `falsify.sh`: a fourth counter for DID NOT APPLY, printed in the summary line | one line |
| 2 | `outputs/PM-app-v84.md`: `all eight` -> the five fields the probe returns | one word |
| 3 | `falsify.sh` / `verify-rebuild.sh` / `README.md`: say that the guard requests `/`, and that the squatter answers 404 on `/index.html` and 200 on `/` | one sentence, three places |
| 4 | `verify-rebuild.sh`: stop crediting the hook fields for the last-line property `pageerror` delivers; unpin `'app-v84'` | two lines |

Recommended alongside, not blocking: the one-character snapshot prefix change in finding 8,
and a sentence in the `WIPE_SURVIVORS` comment saying the prefixes are deliberately
unshared, so the next reader does not take the shared list as settling more than it does.

**Re-audit is a delta pass.** Nothing here requires re-examining the app code, which passed
every test I could build against it.
