AUDITED-COMMIT: 8bcb8c9
VERDICT: SHIP

# Zero Day Audit — ChemoWell app-v84, SIXTH DELTA PASS on `0590b1f` → `8bcb8c9`

**HEADLINE: BLOCK A3 is genuinely fixed, I drove the paths through the app's own buttons rather
than reading the code, and nothing I found would harm a caregiver or make a caregiver-facing
surface false. Ship it.** The snapshot really is taken before the first write — *nothing above
`index.html:186` touches `localStorage` at all, not even a read* — a brand-new phone now reaches
the app with **no** notice and a silently stamped marker, **the real Menu → Account → Start over →
Erase all data → confirm → set up again shows nothing even on a device that bought Plus**, and an
app-v80 upgrade renders exactly the screen the Designer signed off. Nine suites match the README
figure for figure against a clean `git archive HEAD` export whose md5 I checked against the working
tree first. The sweep, run alone on an idle box, is **18 caught, 0 survived**.

**I did find the nineteenth mutant, and it is not in the verdict.** It is not in the fix — it is in
the *coupling* the fix depends on. Section 1's new block says in its own comment that it drives
*"the path the audit drove: Account → Start over"*. It does not: it reimplements the wipe in the
fixture. So nothing ties the snapshot's exclusion list to `eraseAllAppData()`'s preservation list,
and **adding one key to that preservation list reinstates BLOCK A3's exact user-visible defect
while `test/v84-whatsnew.mjs` scores a clean 95/95.** I built it and drove it. The shipping build is
correct; the instrument is one step removed from the button.

**And one thing nobody has written down, which is why the check is right rather than lucky:** a
first-ever visit evaluates this module **twice** — the service worker installs, `controllerchange`
fires, the page reloads once — and on that second evaluation `HAD_PRIOR_CHEMOWELL_DATA` is `true`
by construction. A fresh install is protected by the snapshot on the first evaluation and by the
**marker** on the second. Two legs, not one. Section 1's second assertion is the one holding the
second leg up, and mutant 8 is the proof.

Everything else is housekeeping, categorised per finding at the end.

---

## 1. THE BLOCK — CLOSED, AND I ATTACKED IT THE FOUR WAYS THE BRIEF NAMES

### 1.1 Is the snapshot genuinely before every write? Yes. Here is the whole list

Everything that **executes** above `index.html:186`, in order — not a summary, the enumeration:

| # | statement | touches `localStorage`? |
|---|---|---|
| 1 | `const TEST_MODE = true` | no |
| 2 | `const SUPPORT_LINK = '…'` | no |
| 3 | `const SUPPORT_LINK_READY = …` | no (string `indexOf`) |
| 4 | `(function initSafeTop(){…})()` | **no** — creates a probe div, reads `getComputedStyle`, sets `--safe-top`. DOM only. |
| 5–13 | `toastNeedsLift`, `safeTopPx`, `isNativeApp`, `loadJSON`, `saveJSON`, `getLicense`, `setLicense`, `tierLimit`, `tierLabel` | declarations; no body runs |
| 14 | `const LICENSE_KEY = 'chemowell-app-license-v1'` | no |

**One IIFE, and it never opens storage.** The first `localStorage` access of any kind in this file
is inside the snapshot itself at 188, and the first **write** is `initProfiles()` at 201. The
comment's *"Nothing above it touches localStorage except reads"* understates it — there are no
reads either — so it is not false.

Nothing outside the module gets in first, either. The three CDN `<script>`s and the `window.synapse`
shim run before the module and write no `chemowell-app` key; `sw.js` contains **zero** `localStorage`
references (a service worker has no access to it); `reset.html` is the only other page on the
origin and never touches storage.

### 1.2 The temporal dead zone — safe, and I checked the specific hazard

`HAD_PRIOR_CHEMOWELL_DATA` is a module-scope `const` at **186**. Its only reader anywhere in the
file is `deviceHasPriorChemoWellData()` at **9103** (`grep` over `index.html`, `test/` and
`falsify/` — two hits, one of them the mutant file's search string). The earliest
module-evaluation-time call that can reach it is `state.whatsNewOpen = whatsNewShouldShow()` at
**9171**. 186 → 9171 at top level, in order. No TDZ. **Zero page errors across roughly twenty
browser runs in this pass, including four private clones.**

### 1.3 The two excluded keys — right, and complete, and the comment about them is wrong

**The list is exactly right.** `eraseAllAppData()` (1071) doom-lists every `chemowell-app-` key
`k !== LICENSE_KEY`, so **`chemowell-app-license-v1` is the only localStorage key in this app that
survives a wipe** — and it is the only one that needs excluding. `chemowell-app-seen-version` is
excluded defensively and is unreachable: `deviceHasPriorChemoWellData()` is only ever called from
the `if (!seen)` branch, so the marker key is absent (or holds `''`, which `whatsNewMarkSeen()`
never writes) whenever the snapshot is consulted. Harmless, correct, and a mutant removing it would
be an equivalent mutant.

**A key written by a previous app version cannot escape.** I extracted every `'chemowell…'` string
literal from the last **60 commits** of `index.html`. Every storage key this app has ever used
begins `chemowell-app` — including the pre-profile app-v1..v4 trio (`chemowell-app-entries-v1`,
`-prefs-v1`, `-medication-config-v1`), which `initProfiles()` migrates **after** the snapshot, so
the snapshot sees them under their old names and answers `true` either way. `chemowell-backup*`,
`chemowell-report*` are filenames, `chemowell-pair-v1` is an HKDF salt and `chemowell_*` are
notification channel ids — none is a storage key. `chemowell-app-ui-view` is **`sessionStorage`**,
which the snapshot never scans, correctly.

**And the comment explaining the two literals is false about one of them.** `index.html:9101`:

> *"The literals above are deliberately spelled out rather than referencing WHATS_NEW_KEY and
> LICENSE_KEY: **both are `const`s declared BELOW the snapshot**…"*

`WHATS_NEW_KEY` is at **9056** — below, true. **`LICENSE_KEY` is at line 159, twenty-seven lines
ABOVE the snapshot at 186**, fully initialised by the time it runs, and referencing it there would
be correct. This is the class this very release calls its worst finding — *a comment asserting a
reason the code does not have* — inside the fix for it. **Housekeeping H1**, with a cost attached:
see H1 below.

### 1.4 Driven in a browser, on a clean export, md5 checked before believing anything

`git archive HEAD` → `/…/scratchpad/exp`, served on **8971**. md5 of the served bytes, the export
and the working tree all `2c2b98c9677bcf46fffe8fae547eb461`.

| path | driven how | modal | first-ever line | marker | body | errors |
|---|---|---|---|---|---|---|
| **genuinely fresh phone** | empty storage → real welcome screen: name, *Female*, *Chemo*, *Get started* | **0** | 0 | `app-v84` **stamped silently** | `static` | none |
| **real Start over, Plus device** | licence written, then **Menu → Account → Erase all data → Yes, erase everything** → welcome screen → set up again | **0** | 0 | `app-v84` | `static`, guide at **STEP 1 OF 10** unobstructed | none |
| **app-v80 upgrade** (prior data, no marker) | marker removed, reload | **1** | **1**, *"ChemoWell has never shown you one of these before…"* | `app-v84` | `fixed` while up | none |

The second row is the one that matters: **that is the path the block was about, pressed through the
app's own buttons rather than simulated in storage, and it is silent.** `chemowell-app-license-v1`
survives the wipe exactly as designed and the snapshot ignores it.

### 1.5 The property that makes this work, which no record states

Driven with an init-script counter in `sessionStorage`, a **single `page.goto()` on a first-ever
visit evaluates the module twice** (`evalCount = 2`, four main-frame navigations). The cause is at
`index.html:12750`: the service worker registers, activates, `controllerchange` fires, and the page
reloads once so the tab picks up the new shell. On evaluation **2**, `initProfiles()` has already
written `chemowell-app-profiles-v1` during evaluation 1, so `HAD_PRIOR_CHEMOWELL_DATA` is **`true`**
— by design and unavoidably.

**So the fresh-install guarantee has two legs**: the snapshot holds evaluation 1, and the *marker
stamped during evaluation 1* holds evaluation 2. Measured on a private clone with mutant 8 applied
(`whatsNewMarkSeen()` neutered), served on 8975:

| | HEAD (8971) | mutant 8 (8975) |
|---|---|---|
| `evalCount` after one `goto` | 2 | 2 |
| `firstEver()` after `goto` | **false** | **true** |
| marker | `app-v84` | `null` |
| modal after setup + 3.8s | **0** | **1** |

**That is why mutant 8 reddens section 1 rather than only section 3, and it is not a defect** — the
marker is stamped synchronously during evaluation 1, before any `controllerchange` can fire, and the
only way that write is lost is a `setItem` throw, which `initProfiles()`'s **unguarded** `saveJSON`
would already have turned into a dead module. Not reachable. But the comment at 186 —
*"The question has to be asked BEFORE the first write. This is that moment."* — invites a reader to
believe the snapshot alone protects a fresh install, and on the second evaluation of every first
visit it does not. **Housekeeping H2.**

---

## 2. THE CHECKS

### 2.1 The sweep — run alone, and I found a nineteenth mutant

`FALSIFY_PORT=8973 ./falsify.sh test/v84-whatsnew.mjs falsify/mutants-v84-whatsnew.sh`, nothing else
driving a browser, load average **0.08** on 4 cores at the start.

    === BASELINE  95 checks: 95 passed, 0 failed
    === 18 mutant(s) caught, 0 survived        (exit 0)

**Eighteen distinct failure signatures** — 2, 3, 1, 2, 7, 16, 1, abort, 1, 1, 1, 6, 1, 1, 1, 2, 2, 2
reds — so the clone really is being rebuilt under the running server rather than every mutant dying
for want of a page. **Mutants 17 and 18 die at 93/95 on exactly the two new assertions**, matching
the commit message word for word:

    red: a phone that started over is NOT greeted with "here is what changed"  |  1
    red: and is not told ChemoWell has never shown them one of these before -- it just did  |  1

**MUTANT 19 — `eraseAllAppData()` preserves one more key, and the suite cannot tell.**

    if (k && k.indexOf('chemowell-app-') === 0 && k !== LICENSE_KEY && k !== PROFILES_KEY) doomed.push(k);

Built on a private clone of HEAD served on 8977. `node test/v84-whatsnew.mjs` → **95 checks, 95
passed, 0 failed.** Then the same clone driven through the real button, Menu → Account → Start over
→ *Yes, erase everything* → set up again:

| | HEAD | mutant 19 |
|---|---|---|
| notice after a real *Start over* | **0** | **1** |
| the line it carries | — | **"ChemoWell has never shown you one of these before, so the earlier updates under “See recent updates” will be new to you too."** |

**That is BLOCK A3's user-visible defect, verbatim, on a build the suite calls green.** The reason is
in section 1's own fixture: it writes the licence, then `localStorage.clear()`, then restores the
licence — a hand-written re-implementation of the wipe — while its comment says it drives *"Account
→ Start over"*. The snapshot's exclusion list and the wipe's preservation list are two halves of one
decision and **nothing compares them in either direction.** **Housekeeping H3**: this is not a defect
in the shipping build, and no caregiver can meet it on `8bcb8c9`.

### 2.2 `falsify.sh` copies the working tree's suite now — verified by construction

`cp -r test "$WORK/test"` nests when the destination exists; `cp -r test/.` does not. Demonstrated
directly rather than inferred: a destination `test/a.mjs` containing `ARCHIVED` and a source
`test/a.mjs` containing `WORKING` plus a source-only `test/b.mjs` →

    dst/test/a.mjs  -> WORKING        (overwritten, not nested)
    dst/test/b.mjs  -> present
    no dst/test/test anywhere

The sweep's own baseline printing **95** rather than 96 is consistent with it, though it does not
prove it on a clean tree, where archive and working tree are identical — which is why I ran the copy
on its own. **This script has shipped three defects that made sweeps meaningless; this is the fix.**
One residue: `2>/dev/null || true` still swallows a *failed* copy, which is the same silent-wrong-
suite failure mode one layer down. **Housekeeping H4.**

### 2.3 The 1.6 seconds — acceptable, and a deterministic signal exists that is better

The budget is **2200 ms inside `completeWelcome()` + 1600 ms after it = 3800 ms** from the *Get
started* click, against a notice measured at ~2300 ms. **1500 ms of margin**, and both mutants that
reinstate the defect die on those assertions on an idle box. It holds.

**But a deterministic signal is right there and is not used.** `window.__whatsNewTest.firstEver()`
returns `whatsNewFirstEver`, which is assigned **synchronously during module evaluation**, inside
the exact `!seen` branch under test, long before any render. On a genuinely fresh phone it must be
`false`; I measured it as **`true`** on the mutant-8 clone and delta 5 measured it `true` on the
un-fixed build. Read on the first load it needs **no wait at all** and cannot be distorted by a
loaded machine. An absence check made only of a timeout is the shape that has now failed twice on
this release; one line of deterministic assertion beside it retires the question. **Housekeeping H5**
— not a block, because the timeout is calibrated and the sweep proves it bites.

### 2.4 `completeWelcome()` — it degrades safely, with one gap

**It cannot silently skip the required answers.** If the chips were renamed, `if (await c.count())`
skips them, `completeSetup()` then refuses with a toast (`'Select Male or Female to continue'`), the
name field stays on screen, and the helper returns **false** — a red, not a green. That is the right
direction of failure and it is the trap the old section 1 fell into.

**The gap: "the name placeholder is gone" is not "the app is on screen."** A build that rendered
*nothing* after setup satisfies it, and every absence check after it then measures an empty page.
Its own comment claims the stronger thing (*"so the app itself is on screen"*). Not exploitable
inside this suite — such a build reddens seven other sections — but one positive assertion (the five
`.navlabel` cells, or any Home element) closes it. **Housekeeping H6.**

---

## 3. THE FOUR CORRECTED RECORDS — and a fifth nobody corrected

| record | now true? |
|---|---|
| the comment above `deviceHasPriorChemoWellData()` (9091–9103) | **True about the defect, the history and the fix. False about `LICENSE_KEY` being declared below the snapshot** — H1. |
| `outputs/DESIGN-app-v84.md` addendum 3 rewrite + addendum 4 | True, with one over-tight sentence — H7 below. |
| `outputs/PM-app-v84.md` correction | **True, and the right shape.** The body is untouched, the correction is dated and appended, and it names the three records corrected in place and why this one is not. |
| `README.md` app-v84 row | Every figure right except one stale number — H8. Checked one at a time below. |

### The README row, figure by figure, measured by me

| claim | measured |
|---|---|
| `test/v84-whatsnew.mjs` **95/95** | 95 checks, 95 passed |
| `test/v83-meds-and-reports.mjs` **80/80** | 80/80 |
| `test/v80-up-next.mjs` **48/48** | 48/48 |
| `test/v75-no-other-patient.mjs` **27/27** | 27/27, `found 0/0/0, pinned at 0/0/0` |
| `test/v82-vitals-strip.mjs` **41/41** | 41/41 |
| `test/v82-timeline.mjs` **24/24** | 24/24 |
| `test/v82-back-button.mjs` **15/15** | 15/15 |
| `test/v76-properties-equivalence.mjs` **22/22** | 22/22 |
| `test/v76-empty-window-render.mjs` **13/13** | 13/13 |
| `sw.js` CACHE → `chemowell-app-v84-13` | `sw.js:1` — match, and bumped from `-12` in this delta |
| `APP_VERSION` → `app-v84` | `index.html:9012` — match |
| "eighteen wordings that must be caught, twelve innocent ones that must not" | `CLAIMS` has **18** entries, `INNOCENT` has **12**; the suite prints 18/18 and 12/12 |
| **"Eighteen mutants swept, eighteen caught, none survived"** | my own sweep: **18 caught, 0 survived** |
| "the changelog holds five entries for an eighty-four-release app" | `CHANGELOG.length === 5` |
| "app-v80 carries no What's New code at all" | `git show 048c1ff:index.html` — **0** matches for `whatsNew`, **0** for the marker key. True, against the build `PUBLISHED.json` names as live. |
| "`harness-v84-whatsnew.py` does not build `whatsNewOlderUnseenCount` or the first-ever line" | true — and it builds something worse, see H9 |
| **"A fresh install is not an update … stamped silently and told nothing"** | **TRUE NOW.** Measured three ways in §1.4. |
| "`test/v84-whatsnew.mjs` … **finished at 89/89**" | **stale — it finished at 95/95**, which the same row's final-figures block states correctly. H8. |

---

## 4. THE INDEPENDENT PASSES

**Rule 0 — clean across the whole delta.** `grep` for the patient's name over the diff of
`index.html`, `sw.js`, `test/`, `falsify.sh`, `falsify/` and `README.md` → nothing. **No gendered
pronoun on any added line, code comments included** → nothing. No care-plan dose, ceiling or
schedule added. No medication name in the delta's `index.html` change at all, so no new behaviour
keyed to a medication id. `test/v75-no-other-patient.mjs` is **untouched** by this delta
(`git diff --stat` empty; last changed at `f5677f4`, app-v79) and runs **27/27** with
`found 0/0/0, pinned at 0/0/0`. **The ratchets did not move.**

**The `Female` chip: ordinary app configuration, not a Rule 0 problem, and I will say why.** It is
the app's own *"Patient is — Male / Female"* control on the welcome screen (`index.html:4828`), which
gates menstrual-cycle tracking (`4774`, `5834`). Rule 0 shape 2 forbids the app **assuming** a
gender — *"Follow her care team"* written about a stranger. This control does the opposite: it
**asks**, per profile, and the user answers. The fixture clicks it because `completeSetup()` refuses
to proceed without it (`4788`), which is the app's real behaviour and the reason the old fixture sat
on the welcome screen forever. **Not a leak.** One pre-existing note, outside this delta and outside
the verdict: `BACKLOG.md:512` carries *"why would SHE be on this?"* — introduced at `f2aca32` on
2026-09-13, an internal doc rather than shipped copy, and not something this delta touched.

**The `h()` null trap.** The delta adds no rendering. The three-branch IIFE is unchanged; both
attributes are literal strings (`String(n)` with `n >= 1`, and `'true'`), and `h()` skips
`child == null`, so the `return null` branch appends nothing. Confirmed live across the three paths
in §1.4: no stray node, no attribute carrying the literal `"null"`, no error.

**No `document.body.textContent` assertion** anywhere in the suite — the only occurrences are
comments saying why not. **No pinned version literal:** `'app-v1'` and `'app-v0-not-in-this-changelog'`
are deliberate "older than anything" and "not in the list" sentinels that stay correct across every
future release; `/^app-v/` is a prefix; `expectFor()` derives from `CHANGELOG` at runtime. The
`app-v8x` strings in the delta's test diff are all in comments.

**`./release_check.sh` refuses, correctly, and the refusal is not mine.** It lists the five
superseded audit refusals (`c70e06d`, `3c8365f`, `6339aee`, `c9c4388`, `0590b1f`) — this report at
`8bcb8c9` supersedes those — **plus `outputs/PM-app-v84.md`, which examined `3ec6b4c`, thirty-three
`index.html` commits back.** Clearing the audit half does not clear the PM half, and the PM's
sign-off is the record that carried the false claim this block was about. **The release cannot pass
its own gate until the PM stage is re-run against `8bcb8c9` or later.** That is a process step for
the builder, not a defect in the build, and it is the only thing standing between this release and
the push.

---

## 5. HOUSEKEEPING — explicitly outside the verdict, one line each on why

None of these can be met by a caregiver on `8bcb8c9`, and none makes a caregiver-facing surface
false. That is the test I applied to each.

1. **H1 — `index.html:9101` says `LICENSE_KEY` is declared below the snapshot. It is at line 159,
   above it.** *Category: record / comment.* Nothing a caregiver meets — but it has a cost: the
   licence key literal is now duplicated in the app **and** in `test/v84-whatsnew.mjs`'s fixture, so
   changing `LICENSE_KEY`'s **value** would silently reinstate mutant 18's defect with the suite
   still green. Reference `LICENSE_KEY` at 192 (legal, it is in scope) and read the key from the app
   in the fixture; `WHATS_NEW_KEY` genuinely must stay a literal.
2. **H2 — the two-legged guarantee is not written anywhere.** *Category: record.* A first visit
   evaluates twice and the snapshot is `true` on the second; the marker is what protects it there.
   Correct as shipped, unreachable to break, and worth one sentence beside the snapshot so the next
   editor does not "simplify" the stamping.
3. **H3 — MUTANT 19, and it is the finding of this pass.** *Category: check.* `eraseAllAppData()`
   preserving one more key reinstates the block's exact defect at **95/95**. Add it to
   `falsify/mutants-v84-whatsnew.sh` and make section 1's second block press the real *Start over*
   button — I drove that path end to end in Playwright in this pass, so it is known to work as a
   fixture.
4. **H4 — `cp -r test/. … 2>/dev/null || true` still swallows a failed copy.** *Category: harness.*
   The same silent-wrong-suite failure the line was just written to fix, one layer down.
5. **H5 — section 1's absence check is still made of a timeout when a deterministic signal exists.**
   *Category: check.* `window.__whatsNewTest.firstEver()` on the first load is synchronous, is the
   branch under test, and needs no wait. The current 3800 ms budget is calibrated and bites; this is
   about never having to calibrate it again.
6. **H6 — `completeWelcome()` returns "the name field is gone", and its comment claims "the app is
   on screen".** *Category: check.* One positive assertion closes the gap between the two.
7. **H7 — `outputs/DESIGN-app-v84.md` addendum 4 says the notice/guide overlap "now really does need
   a phone that upgraded mid-guide".** *Category: record.* Measured: a phone that installed an older
   build, opened it once and never named anybody also gets it, at **STEP 1 OF 10**. **Not a defect
   and not false to that person** — the sentence they read is true, and I drove the dismissal:
   `position` returns to none, the page scrolls again, `#tour-layer` survives, no page errors. One
   clause in the record, not a code change.
8. **H8 — the README row still says the suite "finished at 89/89".** *Category: record.* It finished
   at 95/95, which the same row's final-figures block gets right.
9. **H9 — a FIFTH record carries the corrected claim, uncorrected: `harness-v84-whatsnew.py`.**
   *Category: record.* Its docstring (l.28–31) still says *"A genuinely new phone is stamped silently
   and told nothing"*, and l.115–123 still **build the old, defective `deviceHasPriorChemoWellData()`**
   that walks `localStorage` at call time. Not run by any gate, not shipped, and the README already
   discloses the harness does not reproduce this release — but it does not disclose that the harness
   builds the superseded detection, which is the thing a reader would be misled by.

---

## WHAT I WOULD SHIP, AND I MEAN IT

All of it. The snapshot is in the only place it can be and I enumerated everything above it rather
than trusting the comment. The exclusion list is exactly the one key that survives a wipe. No legacy
key in sixty commits of this file's history can slip past the prefix. The three paths behave as the
records now claim, driven through the app's own buttons on a clean export whose bytes I checked. The
sweep is eighteen for eighteen with eighteen different signatures, run alone on an idle machine. Rule
0 is clean and the ratchets have not moved. The nineteenth mutant is real and it is about the
instrument, not the build — nobody can reach it on `8bcb8c9`.

**This release carries app-v81's correction to a medication tracker that counted ".5 mg" as 5 mg
against a daily limit, and that error is live on real phones today.** The only thing left before the
push is re-running the PM stage against this commit, because its sign-off still examines `3ec6b4c`
and `release_check.sh` is right to refuse until it does.
