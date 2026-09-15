AUDITED-COMMIT: 0590b1f
VERDICT: DO NOT SHIP

# Zero Day Audit — ChemoWell app-v84, FIFTH DELTA PASS on `c9c4388` → `0590b1f`

**HEADLINE: the new sentence this delta adds is shown to people it is false about, because
`deviceHasPriorChemoWellData()` can only ever return `true` — the app writes its own
`chemowell-app-profiles-v1` key about nine thousand lines before the function that asks whether any
ChemoWell key exists.** So *"A fresh install is not an update"* — the README's own headline promise,
the `index.html` comment block, the PM's "claims I checked and found TRUE" list and the Designer
addendum — is **false on every first install**, and the check written to guarantee it **cannot
fail**: replace the whole function body with `return true` and `test/v84-whatsnew.mjs` still scores
**89/89**. That is **mutant 17**, and it survives.

**Everything the brief sent me to attack is genuinely answered.** BLOCK A2 is closed and I
reproduced the rollout myself; mutants 13–16 are in the file and I ran the sweep alone to **16
caught, 0 survived**; the baseline guard is real and COULD NOT MEASURE really does fail a sweep; all
six housekeeping items are done; the README row's figures are right one at a time; Rule 0 is clean;
no temporal-dead-zone hazard in the new `let`; the addenda are real work and I re-measured them.
**The count line and the first-ever line are both correct code.** What I am refusing is that the one
branch deciding WHO sees them has been broken the whole time, unmeasurable by the suite, and
asserted as working in four records.

**Nothing here can harm a caregiver** — no data is lost, no dose is mis-counted, the first-run guide
still works. The categories are stated per finding, and the remediation is about six lines of app
code, one rewritten check and one mutant. **I built the fix on a private clone and measured it in
both directions before recommending it.**

---

## THE BLOCK

### BLOCK A3 — a brand-new phone IS greeted with "here is what changed", and after "Start over" the app tells a person it has never shown them one of these before, minutes after showing them one

#### What the code does

`index.html:167` is an IIFE that runs at module evaluation:

    (function initProfiles() {
      if (loadJSON(PROFILES_KEY, null)) return;
      const ps = { list: [{ id: 'p1', name: '', createdAt: Date.now() }], activeId: 'p1' };
      ...
      saveJSON(PROFILES_KEY, ps);
    })();

`PROFILES_KEY` is `'chemowell-app-profiles-v1'`. `deviceHasPriorChemoWellData()` (`index.html:9062`)
runs from `whatsNewShouldShow()` at `index.html:9171` — **9,004 lines later in the same module** —
and asks:

    if (k && k !== WHATS_NEW_KEY && k.indexOf('chemowell-app') === 0) return true;

By then the app has written `chemowell-app-profiles-v1` and `chemowell-app-p-p1-prefs-v1` itself.
**The function has no path to `false` on any device where `localStorage` works.** The distinction the
whole branch exists to draw — *"a phone that has never run ChemoWell"* versus *"a phone that HAS run
it from before this marker existed"* — cannot be drawn, because the app is always its own prior data.

#### What I measured, in a browser, against a clean `git archive HEAD` export on port 8951, md5 of the served file checked against the working tree first

**A phone that has never run ChemoWell.** `localStorage.clear()`, reload, then the welcome screen
filled in and *Get started* tapped exactly as a person would:

| | |
|---|---|
| keys present when `whatsNewShouldShow()` runs | `chemowell-app-profiles-v1`, `chemowell-app-p-p1-prefs-v1` |
| `window.__whatsNewTest.firstEver()` | **`true`** |
| `[data-whatsnew-modal]` after *Get started* | **1 — the notice opens** |
| what it says | **UPDATED · The app now tells you what changed** · *"Until today ChemoWell updated quietly…"* · **"ChemoWell has never shown you one of these before, so the earlier updates under “See recent updates” will be new to you too."** |
| what is behind it | **GUIDE · STEP 1 OF 10 — "Welcome — let's set up together"** |
| `body` position while it is up | `fixed` — the page is scroll-locked over the first-run guide |
| page errors | none |

The notice dismisses normally and releases the lock, and the guide then works — **so this is not the
frozen-guide defect this release already fixed.** It is a person who installed the app ninety seconds
ago being told what changed in it, on top of the welcome guide, on every single install.

**And the same is true at `c9c4388`**, which I served on port 8952 and drove identically: the notice
appears there too, without the new line. **This delta did not introduce the mis-detection.** It did
two things to it: it put a new sentence on that screen, and it is the release that ships What's New
to users at all — app-v80 has no What's New code, so this behaviour is new *to every user* with
app-v84 whatever commit it came from.

#### Where the new sentence becomes false, on a documented path

The brief asked: *"could that include a phone that HAS seen a What's New notice and lost its
storage?"* **Yes — and not by storage eviction. By the app's own Start over button,** Menu → Account
→ Start over, with two help FAQs describing it and copy promising it is *"exactly like a brand-new
install"*. `eraseAllAppData()` (`index.html:1037`) removes every `chemowell-app-` key **except**
`chemowell-app-license-v1`, then reloads — and `initProfiles()` immediately re-creates the profiles
key before the check runs.

Driven end to end: first run → notice shown and dismissed → marker `app-v84` → the exact key sweep
`eraseAllAppData()` performs → reload → welcome screen filled in again:

| | HEAD (`0590b1f`) |
|---|---|
| notice after Start over, free tier | **shown** |
| the line it carries | **"ChemoWell has never shown you one of these before, so the earlier updates under “See recent updates” will be new to you too."** |
| notice after Start over, a device that bought Plus | **shown**, same line |

**That sentence is false.** It was shown to that person minutes earlier and they tapped *Got it* on
it. This is the Voice's first question — *is it true? not roughly right, true* — on the one surface
in this app that speaks directly to the person taking the medicine, on copy **this delta added**, in
the release whose entire subject is a screen that was true sentence by sentence and false as a whole.

#### The check that was supposed to prevent this cannot fail — mutant 17

`test/v84-whatsnew.mjs:76-86`:

    section('1. A BRAND-NEW PHONE IS NOT GREETED WITH "HERE IS WHAT CHANGED"');
    const p = await freshPage();
    t('nothing pops up on a first-ever run',
      await p.locator('[data-whatsnew-modal]').count() === 0, ...);

`freshPage()` without `setUp` does `goto` + a 1.5s wait and **stops on the welcome screen**, where
the notice is never mounted under any circumstances. The count is 0 for a reason that has nothing to
do with the branch being tested. **The suite's own header documents this exact trap** — *"the notice
is mounted in the running app, NOT on the first-run setup screen, and a fixture that never names a
patient sits on that screen forever while every check reports 'no notice' — which is true, and about
the wrong screen. That is how the first run of this suite failed."* Section 1 then does it.

Falsified, on a private clone of HEAD served on port 8953, one edit:

    function deviceHasPriorChemoWellData() { ... }   →   function deviceHasPriorChemoWellData() { return true; }

**`node test/v84-whatsnew.mjs` → 89 checks, 89 passed, 0 failed.** The function can be deleted
outright and nothing in this project notices. That is **mutant 17**, and it belongs in
`falsify/mutants-v84-whatsnew.sh` whichever way the block is cleared.

*(The opposite mutant, `return false`, IS caught — section 2 goes red — which is why the sweep felt
complete. Every existing check is about the notice APPEARING. Nothing is about it not appearing to
the wrong person, except a check that measures the wrong screen.)*

#### Where the record says the opposite

| file | what it says | measured |
|---|---|---|
| `README.md:14` | *"**A fresh install is not an update** — a phone with no marker and no other ChemoWell data is stamped silently and told nothing"* | **False.** It is stamped AND shown the notice. |
| `index.html:9056-9061` | *"A FRESH INSTALL IS NOT AN UPDATE. No marker means two different things and they must not be confused… Any other ChemoWell key already on the device separates them."* | **False.** The app's own key is always there. |
| `outputs/PM-app-v84.md:166` | listed under **"Claims I checked and found TRUE"**: *"A fresh install is not an update … stamped silently"* | Checked by reading the function, not by running it. |
| `outputs/DESIGN-app-v84.md:92-95` | *"A genuinely new install is stamped silently and shown nothing (`deviceHasPriorChemoWellData()`), so that overlap needs a user who updated part-way through the guide"* | **False.** The overlap with the guide is the default for every new install, at step 1 of 10. |

This is the class the README itself calls this release's worst finding — *"a comment asserting a
guarantee the code did not have"* — for the fourth time, one level under the place delta 3 and delta
4 each found it.

#### Two ways to clear it. I built and measured the first

**Option 1 — fix the code (recommended).** Take the snapshot before the app writes anything, and read
it later. Built on a private clone served on port 8954, two edits, about eight lines:

    // immediately above `const PROFILES_KEY` at index.html:166
    const HAD_PRIOR_CHEMOWELL_DATA = (function () {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k !== 'chemowell-app-seen-version' && k.indexOf('chemowell-app') === 0) return true;
        }
      } catch (e) {}
      return false;
    })();

    function deviceHasPriorChemoWellData() { return HAD_PRIOR_CHEMOWELL_DATA; }

Measured on that clone, both directions:

| case | HEAD | with the fix |
|---|---|---|
| never-run phone, through the real welcome screen | notice **shown**, first-ever line shown | **no notice**, marker stamped silently, guide runs unobstructed |
| app-v80 rollout (prior data, no marker) | notice + first-ever line | **unchanged** — notice + first-ever line, `firstEver()` true, count 0 |
| Start over, free tier | false sentence shown | **no notice** |
| Start over, device that bought Plus | false sentence shown | **still shown** — `chemowell-app-license-v1` survives the wipe |
| `node test/v84-whatsnew.mjs` | 89/89 | **89/89** |

The last row of that table is the residual: excluding `LICENSE_KEY` from the snapshot the same way
`eraseAllAppData()` already excludes it closes it. **The key literal has to be inlined in the
snapshot** because `WHATS_NEW_KEY` and `LICENSE_KEY` are `const`s declared later — that duplication
wants a comment, not a clever import, and it is the reason to keep the snapshot boringly simple.

This is shipped code, so it needs the cache key bumped, section 1 rewritten to measure on the running
app rather than the welcome screen, and mutant 17 added. It does not touch the count line, the
first-ever line, `falsify.sh`, or any other suite.

**Option 2 — records only, ships today.** If the dose-parsing correction is worth more than this is
worth waiting for, that is **Aaron's call and a defensible one**: correct the four records to say
what the app actually does, log the mis-detection in `BACKLOG.md`, and ship. **Section 1 still has to
be fixed either way** — a check that cannot fail is worse than no check, and leaving it green while
the README is corrected around it is how this comes back a fifth time. My recommendation is Option 1,
because it is eight lines and I have already measured that it works.

---

## WHAT I WAS SENT TO RE-CHECK, ITEM BY ITEM

### 1. BLOCK A2 — **CLOSED.** I reproduced the rollout and the new branch does exactly what it claims

A page whose storage looks like an app-v80 device — prior ChemoWell data, marker removed — loaded
against the clean export:

| | |
|---|---|
| `[data-whatsnew-modal]` | 1 |
| `[data-whatsnew-older]` | **absent** (count 0, as delta 4 measured) |
| `[data-whatsnew-firstever]` | present, no digits in it |
| the sentence | *"ChemoWell has never shown you one of these before, so the earlier updates under “See recent updates” will be new to you too."* |
| marker after load | `app-v84` |
| page errors | none |

**`whatsNewFirstEver`, attacked every way the brief names.**

- **Can it be true when it should be false?** Yes — that is BLOCK A3, and the fault is in
  `deviceHasPriorChemoWellData()`, not in the flag. Given a correct `prior`, the flag is exactly
  `prior`.
- **Can it survive across anything?** No. It is a module-scope `let`, reset to `false` on every page
  load, and the only assignment is inside `whatsNewShouldShow()`'s `!seen` branch. There is no
  setter, and `window.__whatsNewTest.firstEver` is a getter function.
- **Second run after this release.** Marker is `app-v84`, `seen === APP_VERSION`, `shouldShow()`
  returns false, the flag stays `false`, no modal. Measured: `firstEver() === false`, modal absent.
  Correct. And on the NEXT release the marker is found in `CHANGELOG`, so the count branch takes over
  and the flag is never consulted again — which is the intended shape.
- **Can the flag be true AND the count non-zero?** Yes, in one place, and the precedence is right.
  `whatsNewMarkSeen()` swallows a failed `setItem` (a full quota, a locked-down private window). Then
  `seen` stays `null`, `idx` is `-1`, and the count is `CHANGELOG.length - 1` = **4**. `if (n)` wins
  and the reader gets *"4 earlier updates you have not seen…"* — which on a phone that has never been
  shown any of them is **true**, and strictly more informative than the first-ever line. The ordering
  of the two branches is correct.
- **`CHANGELOG.length > 1`** guards the sentence's own claim: with one entry there are no earlier
  updates to be new to you, and nothing renders.

**Voice (Rule 2.7), on the sentence itself.** *Is it true?* — for the population it was written for,
the app-v80 rollout, **yes**; for the two populations BLOCK A3 leaks into it, **no** after Start over
and **beside the point** on a fresh install. *Would a tired person understand it at 2am?* — yes:
short, no version numbers, no jargon, and it quotes the button beneath it character for character,
which is the v66 rule. *Does it earn its place?* — yes, and for the reason the Enhancer addendum
gives: it is not a number, so Rule 2.7's question 3 does not bite; it changes whether a person taps
*See recent updates* or *Got it*.

### 2. The three surviving mutants, plus the sweep — **all closed, and I ran it myself, alone**

`FALSIFY_PORT=8961 ./falsify.sh test/v84-whatsnew.mjs falsify/mutants-v84-whatsnew.sh`, nothing else
driving a browser, load average 0.41 on 4 cores at the start:

    === 16 mutant(s) caught, 0 survived      (exit 0)

Sixteen distinct failure signatures — 3, 1, 2, 7, 16, 1, 1+abort, 1, 1, 1, 3, 1, 1, 1, 2 reds — so
the clone really is being rebuilt under the running server rather than every mutant dying for want of
a page. The three that survived last time now die on the right check:

| mutant | the red it produces |
|---|---|
| **13** — the sentence prints `n + 1` while the attribute stays right | `and the SENTENCE carries that same number -- the attribute is not what anybody reads` |
| **14** — `idx === -1 ? 0 : idx` | `a marker the changelog does not carry counts every entry but the one on screen` |
| **15** — `n === 1` → `n === 0`, so the singular never fires | `and says it in the singular -- "One earlier update ... is"` |
| **16** — the first-ever line removed | two reds in the no-marker block |

**The seventeenth mutant is BLOCK A3 above**, and it survives 89/89.

### 3. `falsify.sh`'s baseline guard — **real, and it fails the sweep the way it should**

    if ! echo "$BASE" | grep -q "checks:"; then … exit 1; fi

placed before the existing red check, so a baseline that dies before printing anything now stops the
sweep instead of being compared against sixteen mutants. `run_suite` ends in `|| true`, so a crashed
suite yields an empty `$BASE` and the guard is what catches it — correct.

I also re-verified the thing that looks like a `set -e` hazard and is not: `_ran=0; echo "$OUT" |
grep -q "checks:" && _ran=1` inside the `while` loop. Run it standalone under `set -euo pipefail`
with a non-matching `$OUT` and the loop completes and the script exits 0 — the failing command is
not the last in the `&&` list, so it is exempt. COULD NOT MEASURE increments `ALIVE`, and the script
ends `[ "$ALIVE" -eq 0 ] || exit 1`, so it does fail the sweep. Confirmed.

### 4. The six housekeeping items — **all six done, and #3 and #4 are not circular**

| # | claim | verified |
|---|---|---|
| 1 | the stale `50/50` | now reads *"was **50/50 at that point in the release** and finished at 89/89"*, with the final figures block corrected to 89/89 |
| 2 | `falsify.sh`'s three-way scoring unmentioned | the row now describes CAUGHT / CAUGHT-but-aborted / SURVIVED / **COULD NOT MEASURE** and the baseline guard |
| 3 | *"computed here from the app's own CHANGELOG"* described a hand-reasoned literal | **now genuinely computed** — see below |
| 4 | `olderUnseen` exposed and used by nothing | now read in 7h — see below |
| 5 | 7f's false-red wordings | a six-line warning is in the suite at `:779-784`, naming the mechanism (changelog entry text renders inside two of the three scopes) |
| 6 | harness reproducibility | recorded in the README row in as many words, including that the first-ever line is not in the patch either |

**#3 is real and not circular.** `expectFor(marker)` re-implements the arithmetic in the test:

    const expectFor = (marker) => { const i = all.indexOf(marker); return Math.max(0, (i === -1 ? all.length : i) - 1); };

`all` is the app's `CHANGELOG` version list — data, which is what a test should read — and the index
arithmetic is written out independently rather than calling `whatsNewOlderUnseenCount`. **Mutant 14
proves it:** the app's `idx === -1 ? CHANGELOG.length : idx` is flipped to `? 0 :` and `expectFor`
keeps the original, so the check goes red. A circular expectation would have followed the mutation.
The section now exercises five values of `n` (2, 1, 4, 0 and the no-marker case) where it used to
exercise two.

**#4 is real but it is not the second opinion its comment claims.** `t('and the exported count agrees
with the number drawn on the screen', olderUnseen() === L.attr)` compares a fresh call to
`whatsNewOlderUnseenCount()` against an attribute that was rendered from a call to the same function
a moment earlier, with the same `localStorage`. **The two cannot disagree**, which is why it passed
on mutant 13 in delta 4's clone and why mutant 13 is killed by the *sentence* check on the line
below, not by this one. It is harmless and it is not what closed FINDING H. Housekeeping H1.

### 5. The README row, every figure, one at a time

| claim | measured by me |
|---|---|
| `test/v84-whatsnew.mjs` **89/89** | 89 checks, 89 passed |
| `test/v83-meds-and-reports.mjs` **80/80** | 80/80 |
| `test/v80-up-next.mjs` **48/48** | 48/48 |
| `test/v75-no-other-patient.mjs` **27/27** | 27/27, `found 0/0/0, pinned at 0/0/0` |
| `test/v82-vitals-strip.mjs` **41/41** | 41/41 |
| `test/v82-timeline.mjs` **24/24** | 24/24 |
| `test/v82-back-button.mjs` **15/15** | 15/15 |
| `test/v76-properties-equivalence.mjs` **22/22** | 22/22 |
| `test/v76-empty-window-render.mjs` **13/13** | 13/13 |
| `sw.js` CACHE → `chemowell-app-v84-12` | `sw.js:1` — match |
| `APP_VERSION` → `app-v84` | `index.html:8978` — match |
| "eighteen wordings that must be caught, twelve innocent ones that must not" | the suite prints `18/18` and `12/12` |
| **"Sixteen mutants swept, sixteen caught, none survived"** | my own sweep: **16 caught, 0 survived** |
| "the changelog holds five entries for an eighty-four-release app" | `CHANGELOG.length === 5` |
| "`harness-v84-whatsnew.py` does not build `whatsNewOlderUnseenCount` or the first-ever line" | `grep -c` over that file → **0**. True. |
| the new `falsify.sh` sentences (three-way scoring, baseline guard) | both true, verified in §3 above |
| **"A fresh install is not an update … stamped silently and told nothing"** | **FALSE — BLOCK A3** |

Every figure is right. The one false claim in the row is the behavioural one, and it is the block.

---

## THE INDEPENDENT PASSES

**Rule 0 — clean across the whole delta.** `grep -i brandi` over the diff of `index.html`, `sw.js`,
`test/`, `falsify.sh`, `falsify/` and `README.md` → nothing. No gendered pronoun on any added line,
**code comments included** → nothing. No care-plan dose, ceiling or schedule added. No medication
name of any kind in the delta's `index.html` change, so no new behaviour keyed to a medication id.
`test/v75-no-other-patient.mjs` is **untouched** by the delta (`git diff --stat` → empty) and runs
**27/27** with `found 0/0/0, pinned at 0/0/0`. **The ratchets did not move.**

**Temporal dead zone — safe, and I checked the specific hazard.** `let whatsNewFirstEver` is declared
at `index.html:9075`. Its only reads are inside `renderWhatsNewModal()` (`:9148`) and the debug hook
(`:12755`), both function bodies. The only module-evaluation-time call that can reach it is
`state.whatsNewOpen = whatsNewShouldShow()` at **`:9171`**, which is below the declaration, and the
first `render()` in the module is at **`:12691`**, far below both. `setState`'s `render()` (`:1888`)
and `helpSetQuery`'s (`:9665`) are inside functions, not evaluated at load. Zero page errors across
roughly thirty browser runs in this pass, including four private clones.

**The `h()` null trap and the three-branch IIFE.** `h()` (`:4064`) skips `child == null || child ===
false` (`:4085`), so the `return null` branch appends nothing — confirmed live: with nothing to say,
`[data-whatsnew-older]` is 0, `[data-whatsnew-firstever]` is 0, no stray node, no error. Both
attributes are literal strings (`String(n)` with `n >= 1`, and `'true'`), so neither can carry the
literal `"null"`; I swept the modal at 320/360/390 and found **0** attributes with the value `null`.

**No assertion on `document.body.textContent`** anywhere in the suite — the only two occurrences are
comments saying why not. **No version literal pinned in a new assertion:** 7h derives every marker
from `all[i]` at runtime and `expectFor` from the array length, so adding a changelog entry leaves
every expectation correct. The `app-v8x` strings in the delta's test diff are all in comments.

**The Designer addendum 3 — real work. I re-measured two of its rows rather than reading them.**
Driven myself at all three widths against the clean export, marker removed so the first-ever line
renders:

| | 320 | 360 | 390 |
|---|---|---|---|
| `scrollWidth` vs viewport | 320 = 320 | 360 = 360 | 390 = 390 |
| elements past the right edge | 0 | 0 | 0 |
| text controls under 16px · modal buttons under 44px | 0 · 0 | 0 · 0 | 0 · 0 |
| attributes carrying the literal `"null"` | 0 | 0 | 0 |
| page errors | 0 | 0 | 0 |
| the notice scrollable? (`max-height` 675px) | **no** — card 605px | no — 567px | no — 506px |
| the first-ever line, fully inside the viewport | yes, 4 lines | yes, 3 lines | yes, 3 lines |

Every one matches the addendum. I also opened `outputs/design-app-v84/whatsnew-firstever-320.png`
and it shows what the addendum describes: the line in quiet grey between the entry card and the two
buttons, wrapping to four lines at 320 without pushing *Got it* off the edge, reading as a footnote,
and quoting *"See recent updates"* character for character against the button below it.

**The Enhancer addendum 2 — real work, and its new question is the right one.** *"For every control
or line a release adds: which population sees it, and does that population exist in this rollout?"*
is exactly the seat's blind spot named honestly. **The mirror of that question is what BLOCK A3 is**
— *which population sees it that should not* — and neither addendum asks it. Worth adding beside the
first; it is the same lesson Rule 2.7 records about the Enhancer looking only for what is missing.

**`./release_check.sh` refuses, correctly**, on the four standing audit refusals (`c70e06d`,
`3c8365f`, `6339aee`, `c9c4388`) plus `PM-app-v84.md`. This report is a fifth. **The PM gate has
still examined nothing later than `3ec6b4c` — 24 commits back, 8 of them to `index.html`** — and
clearing the audit half does not clear it. Note that the PM's sign-off is one of the four records
BLOCK A3 contradicts, which is a reason to re-run it rather than to wave it through.

---

## HOUSEKEEPING — none of this is in the verdict, and none of it is a defect a caregiver could meet

1. **H1 (cosmetic, a comment).** 7h's `olderUnseen` cross-check compares the function to itself and
   cannot disagree; the comment calls it *"a second opinion"*. Either drive it from a different
   place — read `all` and the marker and compute — or soften the comment to say it is a smoke test.
2. **H2 (cosmetic, brittleness).** 7h's mutant-13 guard ends `&& !/\b3\b/.test(L.text)`, a hand-pinned
   `3` where `(L.attr + 1)` would be derived. Correct today for any changelog of four or more entries,
   because `all[3]` always yields `n === 2`. Worth deriving anyway; this file has been bitten by a
   pinned literal before.
3. **H3 (record, in scope of the block).** `outputs/DESIGN-app-v84.md:92-95` says the notice-over-guide
   overlap *"needs a user who updated part-way through the guide"*. Measured, it is every new install,
   at step 1 of 10. Fixed automatically by Option 1; needs a sentence under Option 2.
4. **H4 (process).** `release_check.sh` still warns that 32 commits have changed `index.html` since
   the `app-v80` baseline and assumes none are live. I verified the half that mattered to me —
   `git show 048c1ff:index.html` contains no `whatsNew*` anything — not the general assumption.
5. **H5 (process).** Mutant 17 belongs in `falsify/mutants-v84-whatsnew.sh` whichever option is taken,
   and section 1 has to measure on the running app before that mutant can die.

---

## WHAT I WOULD SHIP TODAY IF THE BLOCK WERE CLEARED

Everything else. The count line is right in every direction I bent it, the first-ever line is right
for the population it was written for, the suite's five cases are real cases and not decoration, the
sweep is sixteen for sixteen with the instrument's own gaps closed, Rule 0 is clean, the records are
accurate everywhere except the one sentence above, and the release carries a dose-parsing correction
that matters more than anything in this report. **The block is one branch, eight lines, and a check
that has to be pointed at the right screen.**
