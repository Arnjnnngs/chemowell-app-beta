AUDITED-COMMIT: 6339aee
VERDICT: DO NOT SHIP

# Zero Day Audit — ChemoWell app-v84, THIRD DELTA PASS on `3c8365f` → `6339aee`

**HEADLINE: the completeness check still does not do what it says, and I have it on a real surface
— a build whose changelog screen reads *"Every update ChemoWell has ever shipped. Nothing has been
left out."* scores 73/73.** The regex was widened and given a two-way corpus, and the sentence two
paragraphs above it (`test/v84-whatsnew.mjs:632-634`) — *"refuses any claim of completeness, however
it is worded… a fifth surface added later fails here without anybody remembering to add it to a
list"* — was left standing, and is still false. The README repeats it.

**The previous BLOCK is genuinely fixed and the shipping code is sound.** Mutant 9 dies on section
7g, the sweep is a real 9-caught/0-survived that I re-ran end to end, the rebuild script boots and
renders *"See recent updates"*, the timeline suite is 24/24 at four different local hours including
00:32, and all nine suites match their claimed figures. **Everything I am refusing on is in the
INSTRUMENTS and in the RECORD, plus one product decision only Aaron can make:** a check whose stated
guarantee it does not have, a README row that misstates the release's own headline number in the
commit whose purpose was to stop quoting numbers that did not come from the suite, and a pop-up that
will tell a phone upgrading from app-v80 about one of the four releases it is receiving.

---

## THE BLOCK AND THE FOUR FINDINGS I WAS SENT TO CHECK

### BLOCK 1 (`touchmove` protected by nothing) — CLOSED, verified by re-running the sweep

`FALSIFY_PORT=8912 ./falsify.sh test/v84-whatsnew.mjs falsify/mutants-v84-whatsnew.sh`, run by me,
start to finish: **baseline 73/73, then 9 mutant(s) caught, 0 survived, exit 0.** Mutant 9 dies on
exactly the new check and on nothing else:

      FAIL  and it STAYS where the finger left it -- the touchmove half of the guard is doing
            the work  |  scrollY 1307 -> 519

against `1316 -> 1543` on the shipping build. The discriminating margin is ~790px against a 40px
tolerance, so this is not a near-miss.

The nine mutants produced nine different failure signatures (1 → 2 fails, 2 → 3, 3 → 1, 4 → 2,
5 → 7, 6 → 16, 7 → 1, 8 → 1 + abort, 9 → 1) on a green baseline, which is independent evidence that
`find "$WORK" -mindepth 1 -delete` really does rebuild the clone under the running server.

**7g's timing assertion is sound, and I attacked it three ways.**

1. **Is `window320` measuring the right event?** `window.__focusAt` records the LAST `focusin`, and
   `render()` restores focus after every rebuild — so if the 1s tick rebuilt this screen, the
   assertion would be measuring a renderer focusin that schedules no nudge, and a gesture that ran
   long would still read as short. **Measured, it does not:** with the caret sitting in `#med-name`,
   **1 focusin in 5 seconds**, the tap's own. (`render()` does not rebuild the medication editor on
   the tick; the second focusin the commit message describes is triggered by TYPING, and 7g
   deliberately does not type.) So `window320 ≤ 320` really does prove the finger lifted before the
   nudge was due, and it cannot be satisfied vacuously on this screen.
2. **Can load make it red on a good build?** I ran the suite against the clean export with eight
   busy loops on a 4-core box. `window320` went **199ms → 223ms**. Nearly 100ms of headroom left,
   and if it is ever exceeded the check fails loudly with the elapsed time in the message rather
   than silently measuring the wrong thing. Not flaky in this environment.
3. **Can load make it green on the defective build?** No, and for a structural reason rather than a
   measured one: `window320 ≤ 320` is checked with `__focusAt` = the tap, so a gesture slow enough
   for the nudge to have fired mid-swipe fails that assertion before the scroll assertions are
   reached.

**But see FINDING C below — the comment's account of WHY the check works is wrong.**

### FINDING 2 (`harness-v84-whatsnew.py` wrote `'See all updates'`) — CLOSED, verified by loading

Rebuilt from `adfc99c^` into a scratch directory, served it on its own port, md5-checked what the
port served against the file, and LOADED it:

| | |
|---|---|
| `#root` descendants | **21**, real content |
| `window.__whatsNewTest` | present — `latest, all, shouldShow, key` |
| `window.__backTest.version` | `app-v84` |
| page errors | **none** |
| the button | **`See recent updates`**, read off the live DOM |

`test/v84-whatsnew.mjs` section 7f against that rebuild: **all eight checks green.** The whole suite
is 68/73 on the rebuild, and the five reds are the later fixes that have no patch script (scroll
lock, the pointer-events overlay rule, the v28 gesture guard) — the pre-existing shape of
reproducibility in this repo that the last pass documented, not a delta regression. I am not raising
it again.

The docstring at `harness-v84-whatsnew.py:22-23` was corrected too, but the edit left a broken
continuation line (` * not every release…` at column 1 inside a 4-space bullet). Cosmetic, one line.

### FINDING 3 (7f under- and over-broad) — **NOT CLOSED. This is the headline.** See BLOCK A.

The `aria-label` half IS closed, and I proved it rather than reading it: planting a claim in the
modal's own `aria-label` (`index.html:9080`) and changing nothing visible turns 7f red —
`FAIL … | Every past update is listed here`. So `readScope` works.

### FINDING 4 (README described an 8px guard) — the guard sentences are fixed, one figure is not

Row checked claim by claim. See FINDING B: `test/v84-whatsnew.mjs` **71/71** in a suite that is
**73/73**.

Everything else in the row that I could measure is accurate:

| claim in the row | measured |
|---|---|
| `sw.js` CACHE → `chemowell-app-v84-10` | `sw.js:1` — match |
| `APP_VERSION` → `app-v84` | `index.html:8978` — match |
| "scrollY 1543 → 1543, save button on screen at y=655" | 7e: `scrollY 1543 -> 1543`, `top=655 of 844px` — exact |
| "a field focused WITHOUT a swipe is still brought into view (top 870 → 400)" | 7e: `field top 870 -> 400` — exact |
| "Nine mutants swept, nine caught, none survived" | my sweep: 9 caught, 0 survived |
| the other eight suite figures (80/80, 48/48, 27/27, 41/41, 24/24, 15/15, 22/22, 13/13) | all eight match |
| "the 8px guard" | gone from the row; `grep -n "yAtFocus\|Math.abs(yNow" index.html` → nothing |
| "seven caught" | gone from the row |
| row terminates with ` |`, backticks and `**` both even | yes |

### FINDING 5 (`test/v82-timeline.mjs` unfrozen page clock) — CLOSED, and I measured the fix

`test/v82-timeline.mjs:52-53` derives `FROZEN` (today at 23:00) and `AT()` from it; `:59-66`
installs an `addInitScript` Date shim before `goto`. **The freeze is complete:** every fixture
timestamp in the file (`:111-113`, `:136`, `:156`, `:195-196`, `:217-218`, `:234-235`) comes from
`AT()`, and there is no other timestamp source.

Verified by running the suite at four different local hours rather than by reading it:

| local hour at run | result |
|---|---|
| 07:31 (UTC) | 24/24 |
| 16:32 (Asia/Tokyo) | 24/24 |
| **00:32** (America/Los_Angeles) | **24/24** |
| 21:33 (Pacific/Kiritimati) | 24/24 |

00:32 is inside the window where the last pass measured 20/24. The comment at `:43-50` now describes
what the file does.

**The other suites.** Of the nine gating suites, `v83-meds-and-reports`, `v80-up-next`,
`v82-vitals-strip` and `v82-timeline` shim the page `Date`; `v84-whatsnew`, `v82-back-button`,
`v75-no-other-patient`, `v76-properties-equivalence` and `v76-empty-window-render` have no
time-dependent fixtures (`v84-whatsnew`'s only two `Date.now()` calls are inside 7g's probe, at
`:585` and `:605`, and measure an interval rather than a wall-clock hour). Ten suites in `test/`
outside the gate still build fixtures from `new Date()` with no shim — `v57-search`,
`v58-eod-checkin`, `v59-para`, `v61-backup`, `v63-encrypted-backup`, `v64-logger`,
`v67-inpatient-window`, `v70-remove-one-date`, `v74-shipped-audit-probe`, `v79-home-cards-render`.
None of them gates a release and I did not run them; recording it so the next person does not have
to re-scan.

---

## THE BLOCK

### BLOCK A — `test/v84-whatsnew.mjs:632-634` (and the README) claim a guarantee the check does not have, and a claiming surface passes 73/73

The comment above the pattern still reads:

> *"…it reads what is ON THE SCREEN on every surface that shows the changelog and refuses any claim
> of completeness, however it is worded. A fifth surface added later fails here without anybody
> remembering to add it to a list."*

The README's app-v84 row says the same thing. **Measured on a private clone of HEAD, one string
changed** — `renderWhatsNew`'s heading at `index.html:9066-9067`:

      'Every update ChemoWell has ever shipped. Nothing has been left out. This phone is
       running ' + APP_VERSION + '.'

`node test/v84-whatsnew.mjs` → **73 checks, 73 passed, 0 failed.** That is a fifth wording of the
exact claim this release spent four rounds removing, printed on one of the three surfaces 7f reads,
and the check is green.

Offline against the pattern itself, 13 of 18 natural completeness claims are missed:

| missed | missed |
|---|---|
| `Every update ever made to ChemoWell.` | `Every past update.` |
| `All updates ever published.` | `A record of every change since launch.` |
| `This is the complete set of updates.` | `A comprehensive list of updates.` |
| `Nothing has been left out.` (the corpus has `Nothing is left out.`) | `No update is missing from this screen.` |
| `The updates, in full.` | `Every release since app-v1.` |
| `The full story of every change.` | `Every one of them is here.` · `All of them.` |

and four innocent strings still false-red: `See all medications`, `View all symptoms logged this
week`, `Open the full list of medications`, `Read all about it` — all via the bare
`\b(see|view|read|open)\s+(all|every|…)` alternative, which does not require the sentence to be
about updates at all.

**Why this is a block rather than a note.** The pattern is strictly better than the one the last
pass broke, and it does catch the realistic regressions: reverting the button to `'See all updates'`
turns it red, and so does a claim hidden in an `aria-label` (both measured, below). If the comment
said *"it catches the wordings that have been written here and near variants of them"* I would not
be raising it. It says the opposite, in the check written specifically because *four rounds of one
fix is a missing check*, in a release whose own README calls **"a comment asserting a guarantee the
code did not have"** its worst finding. Shipping this sentence schedules round five and tells the
person who writes the fifth surface that the gate has them covered.

**The fix is a sentence, not a regex.** Either narrow the claim in `:632-634` and in the README to
what the pattern does, or keep the claim and add the missing shapes (`(complete|full|entire|whole|
comprehensive)\s+(set|collection)`, `nothing\s+\w+\s+(been\s+)?(left out|omitted|missing)`, a
quantifier + update with no listing word required, and `see/view/read/open all` restricted to the
same sentence as an update word). Narrowing the claim is the cheaper and more honest half.

---

## FINDINGS

### FINDING B — `README.md:14` says `test/v84-whatsnew.mjs` **71/71**. The suite is **73/73**.

Traced through the delta: the figure was correct at `e7dd2ee` (65 + the first 7g's six checks);
`6d6e2ee` rewrote 7g into eight checks and did not touch it; and `6339aee` — whose commit message is
*"README: quote the suite's own numbers, not a number from one run of it"* — changed only
`1503 → 1543` and `y=695 → y=655` and left it. Word-diffed to be sure; those three edits are the
entire content of that commit's README change.

This is FINDING 4's class exactly — **a row that is wrong about the release it records** — recurring
in the commit written to fix it, on the one suite the release is named after, sitting in a list where
the other eight figures are all correct so nothing looks odd. Two characters.

### FINDING C — the 60ms hold does NOT cancel Chromium's fling, and the code comment and README both say it does

`test/v84-whatsnew.mjs:566-568` and the README both say the finger *"holds still for 60ms first,
which cancels"* the fling. Measured on the shipping build, three independent runs, with that hold in
place:

| run | scrollY at +150ms after touchEnd | scrollY 1.8s later |
|---|---|---|
| clean export | 1316 | **1543** |
| clean export, machine loaded | 1181 | **1543** |
| sweep baseline (mutant 2's run, for contrast) | 1306 | 522 *(that build has the defect)* |

The page keeps travelling 227–362px after the finger lifts. The hold does not cancel the fling; it
reduces it enough that the measurement is taken before the page reaches the bottom.

**The check still discriminates** — the assertion is `after >= before - 40` and mutant 9 moves the
page 788px the other way — so I am not blocking on it. But two things follow. The assertion is
one-directional by design and cannot see a yank smaller than the fling that hides it; that is
acceptable today only because the nudge always centres a field roughly 1,300px above where the swipe
ended. And the comment gives the next person a false model of why the check works, which is how the
last three rounds of this release started.

### FINDING D — the tenth mutant is a gap in the SWEEP, not in the suite: nothing exercises 7f against the app

All five of 7f's surface assertions are protected by no mutant. The sweep exercises only 7f's own
corpus self-test, so "nine caught, none survived" says nothing about whether 7f can see a claim on a
real screen — the same shape of false comfort that `touchmove` had at `3c8365f`.

I built the two missing mutants by hand on private clones of HEAD and both die correctly:

| mutant | result |
|---|---|
| `'See recent updates'` → `'See all updates'` (the exact copy that shipped four times) | **72/73** — `FAIL and the notice claims nothing about being complete \| See all` |
| the modal's `aria-label` (`index.html:9080`) set to `'Every past update is listed here'`, nothing visible changed | **72/73** — `FAIL … \| Every past update is listed here` |

So 7f works on the surfaces it reads, and the `aria-label` widening is real rather than a silent
no-op. Both belong in `falsify/mutants-v84-whatsnew.sh` as mutants 10 and 11 — the first is a
two-second edit and it guards the single most-repeated defect in this release.

### FINDING E — the pop-up will tell a phone upgrading from app-v80 about one of the four releases it is receiving. **This one is Aaron's call.**

`PUBLISHED.json` records live as **app-v80**; this release delivers v81, v82, v83 and v84 at once.
Every installed phone has no `chemowell-app-seen-version` marker and does have ChemoWell data, so
`whatsNewShouldShow()` (`index.html:9041-9045`) correctly returns true — and
`renderWhatsNewModal()` (`:9074-9078`) then shows `whatsNewLatest()`, which is `CHANGELOG[0]` and
nothing else. Read off the live DOM, that is the whole of what a returning user will see:

      UPDATED
      The app now tells you what changed
      Sep 14, 2026
      Until today ChemoWell updated quietly…
      From now on, the first time you open the app after an update, a short note tells you
      what is different. Tap "Got it" and it does not come back.
      Updates from here on are listed under "What's new" in the menu, newest first…
      [ See recent updates ]  [ Got it ]

Every sentence is true. The impression is not: a card headed **UPDATED** listing one release, on a
phone that is simultaneously receiving a redesigned Home screen (v82), medication cards that now
show doses and a ceiling bar (v83), and **app-v81's correction to how dose amounts are counted
against a daily limit — *".5 mg" was being counted as 5 mg*, so a limit could be reached after a
tenth of the medicine.** That is the one changelog entry on this list with a clinical consequence,
and the person who taps *"Got it"* — which is the styled, filled, right-hand button — never sees it.

Rule 2.7's first question is *is it true*, and its standing lesson is that arithmetically correct and
clinically meaningless is still a false impression. This is the same shape: individually true, and
the surface as a whole says "here is what changed" while withholding three quarters of it, on the
one rollout in this app's history where "the newest release" and "what changed since you last
looked" are different things.

`whatsNewShouldShow()` already reads `seen`, so the app knows exactly which entries are new to this
phone. Three options, smallest first:

1. **Nothing** — the *"See recent updates"* button is right there, equal width, one tap. Defensible;
   it is the design the README argues for (*"a wall of entries on open is something a person
   dismisses without reading"*).
2. **One line under the entry** when more than one release is new: *"3 earlier updates you have not
   seen — see recent updates."* Copy only, no logic beyond a count. **My recommendation.**
3. **Show every entry newer than `seen`** in the modal. The modal is already `maxHeight: 80vh` with
   `overflowY: auto`, so it fits; but it changes the release's headline behaviour on the day it
   ships, and it needs its own check.

I am not treating this as the block — it is a product decision and a copy change, not a defect in
code — but nobody has raised it in four audit passes and it is the surface that speaks to the
patient.

### FINDING F (minor, and it closes) — `falsify.sh` cannot tell a red check from a dead suite

Mutant 8's run printed one FAIL and then **no `73 checks:` summary line at all**: the un-stamped
notice stayed open and a later Playwright click timed out, which throws and aborts the script. The
sweep scores that as CAUGHT. Here it is a true catch — the FAIL is section 1's *"and the version is
recorded silently"*, exactly the right check — so the 9/0 result stands. But the script's own header
warns about precisely this confusion for a different cause, and a one-line guard (require the
`checks:` line to be present, or count the mutant as INDETERMINATE without it) would close it.

### FINDING G (minor) — 7f reads `aria-label`s on two of its three surfaces

`readScope` is used for `[data-whatsnew-modal]` and `[data-whatsnew-screen]`; the drawer row at
`test/v84-whatsnew.mjs:687-691` still reads bare `innerText`. The README says the check "reads
`aria-label`s as well as visible text" without qualification. Four lines.

---

## VERIFIED CLEAN

**All nine suites, run by me against a clean `git archive HEAD` export on its own port (8901), md5
of the served file checked against the file on disk before believing anything:** v84-whatsnew
**73/73**, v83-meds-and-reports **80/80**, v80-up-next **48/48**, v75-no-other-patient **27/27**,
v82-vitals-strip **41/41**, v82-timeline **24/24**, v82-back-button **15/15**,
v76-properties-equivalence **22/22**, v76-empty-window-render **13/13**. Nothing was listening on any
port when I started and the working tree is clean, so the `3c8365f` port collision could not recur.

**The re-entrancy comment (`index.html:5260`) is now true.** `grep` over the whole file:
`addEventListener('focusin'` appears exactly once, at `:4266` — the v28 nudge itself. No
`addEventListener('focus'`, no `onFocus`, no `onfocus`, no `focusout`. The one focusin handler
returns on its first line under `restoringFocus` and calls neither `setState()` nor `render()`, so
the non-re-entrancy claim holds as stated.

**Temporal dead zone — safe, checked three ways.** `let restoringFocus` at `:4245`, `let
lastUserScrollAt` at `:4261`. Every reference (`:4263`, `:4267`, `:4275`, `:5263`, `:5269`, `:9605`,
`:9609`) is either below its declaration or inside a function body. The file is a single
`<script type="module">` (`:94`–`:12694`), and the only column-0 executable statements above `:4245`
are `cwInstallErrorLog()` at `:453` (which only registers two `window` error listeners and touches
neither flag) and two `addEventListener` calls at `:921` and `:4196` whose callbacks cannot run
during module evaluation. The app booted with **zero page errors** in every run in this pass,
including the rebuild and all five private clones.

**Rule 0 — clean across the whole delta.** No patient name on any added line; no gendered pronoun
anywhere in the delta including code comments — `grep -inE '\b(she|her|hers|herself|he|his|him)\b'`
over every added line of the delta returns **nothing at all**. No care-plan dose, ceiling or
schedule; no new behaviour keyed to a medication id. The
single `Zofran` string in the delta is the README recording the leak that was REMOVED in this
release, not app content. `test/v75-no-other-patient.mjs` is **27/27** with the ratchet reading
`found 0/0/0, pinned at 0/0/0` — unmoved, and the file is untouched by the delta.

**No `h()` null-attribute pattern in the delta** (the only `index.html` change is one comment). No
version literal pinned in any new check — 7f's `'app-v1'` is a deliberately stale sentinel, not the
current version. No assertion on `document.body.textContent` anywhere in the suite; the only
occurrences are comments explaining why not. No `|| true`, no TODO/FIXME added.

**`./release_check.sh` refuses, correctly and for the right reason** — three standing refusals
(`AUDIT-app-v84-delta.md` at `c70e06d`, `AUDIT-app-v84-delta2.md` at `3c8365f`, `PM-app-v84.md` at
`3ec6b4c`). This report is a fourth. **Note for whoever clears this: the PM gate has not examined
anything later than `3ec6b4c`, which is fifteen commits back, and clearing the audit half does not
clear it.** It also warns that 29 commits have changed `index.html` since the `app-v80` baseline and
assumes none are live; I did not verify that assumption.

---

## WHAT I RELIED ON RATHER THAN RE-DERIVING

- `outputs/AUDIT-app-v84.md` (`5600b92`), `outputs/AUDIT-app-v84-delta.md` (`c70e06d`) and
  `outputs/AUDIT-app-v84-delta2.md` (`3c8365f`) for everything up to `3c8365f`, as instructed.
- The last pass's analysis of the cause-based scroll guard: that `capture: true, passive: true`
  cannot be blocked or swallowed, that no in-app scroll container creates a false suppression, and
  that tap jitter cannot suppress the nudge because focus lands on `touchend`. I re-checked only the
  cheap half — `grep` confirms one `focusin` listener and no wheel/touchmove listener anywhere else.
- FINDING 6 from that pass — that `helpSetQuery`'s `restoringFocus` guard is correct, unprotected by
  any check, and unobservable because the help screen does not scroll with a query active. I did not
  spend a suite run re-confirming it; the delta does not touch that code.
- The Designer's measurements at 320/360/390 and the six PNGs. The delta changes no rendered pixel.
- What the nine suites assert about app-v81/82/83 behaviour. I ran them; I did not re-derive them.

## WHAT I DID NOT CHECK

- **Anything iOS.** Chromium only: no on-screen keyboard, no Safari, no real momentum after
  `touchEnd` on a phone, no visual-viewport behaviour when the keyboard opens. That exemption is
  sharper than usual because the fix at the centre of this release is a touch-gesture guard, and
  because the *reason* the guard was made cause-based rather than effect-based is a keyboard
  behaviour this sandbox cannot produce. **Nobody has seen v81, v82, v83 or v84 on a device.**
- The ten non-gating suites listed under FINDING 5. Scanned for the clock hazard, not run.
- `sync-backend/`, `.github/workflows/`, `capacitor.config.ts`, `package.json` — untouched by this
  delta.
- Whether `PUBLISHED.json`'s app-v80 baseline is accurate. I used it for FINDING E; if a later
  version is in fact live, that finding shrinks.
- `harness-v85-temperature-report.py` and `harness-v86-symptom-bars.py`, and the order-dependence
  between them and `harness-v84-whatsnew.py` that the last pass documented.
- The other ~45 files in `test/`, and the Designer PNGs from app-v83.

---

Measured in Chromium against a clean export of `6339aee` on port 8901, a rebuild of `adfc99c^` on
8931, five private mutant clones on 8921/8922/8925 and two unserved, and `falsify.sh`'s own clones
on 8912. The md5 of the file each port served was compared against the file on disk before any
result was believed. **No file in the repository was modified by this pass except this report.**

## WHAT THE BUILDER SHOULD DO

1. **BLOCK A** — `test/v84-whatsnew.mjs:632-634` and the matching README sentence: say what the check
   does, or make it do what they say. Narrowing the claim is the honest and cheaper half.
2. **FINDING B** — `README.md:14`: `71/71` → `73/73`.
3. **FINDING C** — `test/v84-whatsnew.mjs:566-568` and the README: the 60ms hold does not cancel the
   fling, it only keeps the measurement off the bottom of the page. Say that.
4. **FINDING D** — add the two mutants I measured (the button label, and a claim in an `aria-label`)
   to `falsify/mutants-v84-whatsnew.sh` and watch them die.
5. **FINDING E** — Aaron's decision. My recommendation is option 2, one line of copy.
6. **FINDING G** — 7f's drawer surface should go through `readScope` like the other two.
7. Then **the PM re-runs.** Its refusal at `3ec6b4c` is fifteen commits stale and still standing on
   its own.
