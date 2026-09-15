AUDITED-COMMIT: 22c44756823c6fa020cee3367e48d075640be84f
VERDICT: DO NOT SHIP

# PM sign-off, pass 2 — ChemoWell app-v83 + app-v84

Second PM pass. `outputs/PM-app-v84.md` refused at `3ec6b4c`; this pass re-issues that stage
against `22c4475`, which is HEAD and is what origin has on this branch. I did not build any of
this and I have not fixed anything I found.

**HEADLINE: the app is in the best shape it has been in this release, every suite I re-ran is
green, and I am still refusing — on one sentence in the README that asserts a measurement
nothing in this repo produces, and on the fact that no independent audit has examined HEAD.**
The first is the exact defect this release has now been refused for seven times, and it is
already written down as false *inside the previous PM sign-off* and was never carried across to
the record Aaron actually reads. The second is mechanical and the code risk is provably nil.
Both are minutes of work. Neither is a defect in the app.

---

## 1. THE GATE — raw output, both runs

### Run A — at the start of this pass, HEAD `22c4475`, before this report existed

    ℹ️  Suites will run against a clean export of HEAD at /tmp/tmp.Dk1Iai5PGc
       (not the working tree -- see the app-v82 note above).
    ℹ️  Baseline: PUBLISHED.json -> app-v80 (chemowell-app-v80-2) at 048c1ff
       37 commit(s) have changed index.html since that record. This gate assumes NONE of
       them are live yet. If any were already pushed, run ./mark_published.sh <that commit>
       first -- otherwise the comparison below is against the wrong build.
    ❌ RELEASE CHECK FAILED: a chain report refuses this release, and nothing supersedes it.
       These say DO NOT SHIP:
         outputs/PM-app-v84.md — examined 3ec6b4c
       A refusal is cleared by re-running that stage against a LATER commit and it saying
       SHIP — not by adding another file beside it.

    EXIT=1

Run B, taken after this report was committed, is appended at the end of this file — a gate
reading quoted before the thing being gated exists is not a gate reading.

**What the gate did NOT get to.** It `exit 1`s at the chain stage (line 678), which sits
*before* the Rule 0 patient-leak check and the two suites it runs itself. Those never
executed in either run. I ran all three by hand instead, and they are green — see §4.

---

## 2. BLOCKER 1 — `README.md:14` asserts "eight hooks", and nothing in this repo produces eight

The app-v84 row, unqualified, with no dated correction beside it:

> "...and a hook block exporting **four hooks** where the release exports **eight**. Falsified
> in a real browser both ways: the committed script gave a ReferenceError with `#root` at 0,
> the fixed one gives no exceptions, `#root` at 4205 and **all eight hooks** — the same figures
> as HEAD, which is the control."

**Measured, not argued.** Parsing `harness-v84-whatsnew.py` and counting top-level
`window.__* =` assignments in each block:

| thing | count |
|---|---|
| `BASE_HOOKS` — the block the script REMOVES | **2** (`__doseTest`, `__backTest`) |
| `MOVED_HOOKS` — the block the release re-attaches | **5** (`+ __whatsNewTest`, `__tempTest`, `__eraseTest`) |
| fields `test/rebuild-boots.mjs` actually collects | **5** |
| distinct `window.__*` names anywhere in `index.html` | **9** |

Neither **four** nor **eight** is any of those, and no grouping of them yields eight. My own
run of `./verify-rebuild.sh` printed the probe verbatim:

    hooks: {"whatsnew":"object","version":"app-v84","key":"chemowell-app-seen-version",
     "older":"function","firstEver":"function"}

Five fields. `#root` at **4205**, which the row gets right.

**Why this is blocking and not a typo.** Three reasons, and the third is the one that decides it.

1. It is not decoration — it is the **evidence figure**. That sentence is what certifies the
   Scribe's B4 fix (the rebuild path that built a blank app) was verified by loading rather than
   by a script exiting 0. A false number in the evidence column is the whole of what B4 was
   about, one level up.
2. It is false twice in one clause: the *before* count is 2, not four, and the *after* count is
   5, not eight. A reader cannot recover the truth from either half.
3. **This exact figure was already caught, written down, and left standing.** The eighth Zero
   Day audit found it by running the probe instead of reading the table.
   `outputs/PM-app-v84.md` carries a THIRD CORRECTION, dated 2026-09-15, whose heading is
   *"'all eight' is a number nothing in the repo produces"* and which says of it:

   > *"A figure in the evidence column of a signed sign-off that nothing produces is the same
   > defect this release has now been refused for six times."*

   It was corrected **in the sign-off** and never in `README.md` — and this repo's own
   `HANDOFF.md` says *"`README.md`'s version history is the record."* The record was left
   carrying the number the correction exists to retract. That is worse than not having found
   it, because the finding is on file and the fix stopped one file short.

**The fix is one sentence:** "a hook block exporting two hooks where the release exports five …
`#root` at 4205 and all five hooks." I have not made it; that is the builder's edit and this
desk does not write the record it grades.

---

## 3. BLOCKER 2 — no independent audit has examined HEAD

`outputs/AUDIT-app-v84-delta8.md` says SHIP at `400bd37`. Three commits landed after it:

    a1d023f  Ninth audit: the four items clear, and what the new payload check cannot see
    7adafef  The drift check covered 4 of 12 insertion sites; now it reads the script's AST
    22c4475  SWEEP-app-v84.md: say which later commits the run covers

`index.html` is in that diff, so `check_report_current()` will report delta8 as
`examined 400bd37; changed since: index.html` and no AUDIT report will be CURRENT. The gate
refuses on it whatever verdict I write.

**I measured how much of that is real, because the two answers are very far apart.**

    git diff 400bd37..HEAD -- index.html

is **five lines, every one of them a `//` comment**, inside the block explaining why the
prior-data snapshot excludes the marker. Filtering the whole range for non-comment changes:

    $ git diff 714602b..HEAD -- index.html | grep '^[+-]' | grep -v '^[+-][+-]' | grep -vE '^[+-]\s*//'
    -      if (!k || k.indexOf('chemowell-app') !== 0) continue;
    +      if (!k || k.indexOf('chemowell-app-') !== 0) continue;

— and that one character landed in `4b54901`, which is *inside* delta8's audited range and which
delta8 verified explicitly. **So the executable content of `index.html` at HEAD is identical to
the executable content delta8 read and cleared.** The code risk of this blocker is nil and I say
so plainly.

**I am still not waiving it**, for two reasons. Rule 5 has, in its own words, "zero exceptions
and zero Lead-Developer discretion to waive it", and this desk is not a better place to exercise
that discretion than the one the rule names. And the gate's scar tissue here is app-v68, which
shipped 67 unread lines of `index.html` behind a report that was merely *named* for the version.
The remedy is a delta pass over three commits, two of which touch no shipping code at all.

**What genuinely has not been read by anyone independent**, and is the part of this worth an
auditor's attention rather than a rubber stamp:

- `test/harness-payload-matches-app.py` — **new, 114 lines**, written in `7adafef` to answer
  delta8's own findings A and B, i.e. written *after* the report that blessed the thing it
  replaces. It is now the gate standing between a stale rebuild payload and a green board.
- `verify-rebuild.sh` — +21 lines in the same commit.
- `harness-v84-whatsnew.py` — 5 lines.

None is in `RULE5_PATHS`, so Rule 5 does not formally reach them. Given the history I measured
them anyway; see §5.

---

## 4. WHAT I RE-MEASURED — twelve suites, independently, at HEAD

Not taken from the brief, not taken from delta8. Run by me, this pass, one at a time:

| suite | result |
|---|---|
| `test/v84-whatsnew.mjs` | 96 checks: 96 passed, 0 failed |
| `test/v83-meds-and-reports.mjs` | 80 checks: 80 passed, 0 failed |
| `test/v81-dose-parser.mjs` | 227/227 passing |
| `test/v72-med-purpose.mjs` | 65/65 checks passed |
| `test/v80-up-next.mjs` | 48/48 checks passed |
| `test/v82-vitals-strip.mjs` | 41 checks: 41 passed, 0 failed |
| `test/v81-purpose-hint.mjs` | 32/32 checks passed |
| `test/v75-no-other-patient.mjs` | 27/27 checks passed |
| `test/v82-timeline.mjs` | 24 checks: 24 passed, 0 failed |
| `test/v76-properties-equivalence.mjs` | 22/22 checks passed |
| `test/v82-back-button.mjs` | 15/15 passing |
| `test/v76-empty-window-render.mjs` | 13/13 checks passed |

All twelve match the figures `README.md:14` lists, exactly. **One environment note that is not a
defect and will bite the next person:** `test/v72-med-purpose.mjs` exits **3** with
`REFUSING: HTTPS_PROXY set.` unless the proxy vars are unset. It passes 65/65 under
`env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy`. A green figure in a record for
a suite that refuses to run in the default shell is a trap worth a line in `HANDOFF.md`.

The three suites the gate would have run itself — `v76-properties-equivalence`,
`v76-empty-window-render`, `v75-no-other-patient` — are in that table and green, so the part of
the gate that never executed would have passed.

---

## 5. THE UNAUDITED DRIFT CHECK — I falsified it rather than trusting it

`test/harness-payload-matches-app.py` is new, unreviewed, and load-bearing. Rule 5 of
care-tracker's `CLAUDE.md` says falsify every new check once. I did, in an isolated copy under
my scratchpad so the shared tree was never touched:

- **Control** (verbatim copies of `index.html` + the patch script): `17 checks: 17 passed, 0 failed`, exit 0.
- **Mutant** (in the *copy* of `index.html` only, revert the one-character prefix fix —
  `'chemowell-app-'` → `'chemowell-app'`, the precise drift the check was written for):
  `16 checks: 14 passed, 2 failed`, **exit 1**.

It goes red on the thing it exists for. Good.

Two things it does not do, neither blocking, both worth the next auditor's eye:

- `harness-v84-whatsnew.py` makes **12** `cut()` calls; the check covers **11**. The twelfth is a
  deletion with an empty replacement, so there is nothing to compare — structurally uncheckable,
  not skipped. But the floor is `if len(inserts) < 8`, so a thirteenth site whose payload the AST
  walker cannot resolve would drop coverage silently and the board would stay green. The floor
  should be an equality against the number of `cut()` calls found, not a magic 8.
- `verify-rebuild.sh` announces *"checking all 17 pieces of app text the patch script carries"*.
  With one site uncheckable, "all" is the same shape of overstatement delta8 raised as its item
  D. One word.

`./verify-rebuild.sh` itself: **exit 0**, no uncaught exceptions, `#root innerHTML length: 4205`,
all five hooks, `BOOTS`. The Scribe's B4 is genuinely closed by measurement, not by assertion.

---

## 6. `PUBLISHED.json` — NO, `./mark_published.sh` MUST NOT RUN FIRST

Asked directly, so answered directly. **It must not run, and running it would be the one thing
its own header forbids.**

`mark_published.sh` records *what is live*, and it is to be run **immediately after a successful
push**. Nothing has been pushed. I checked the remote rather than reasoning about it:

    $ git ls-remote --heads origin
    47e1bc4...  refs/heads/main
    22c4475...  refs/heads/claude/caretracker-team-review-i83ik2

    $ git show origin/main:index.html | grep APP_VERSION
    APP_VERSION = 'app-v80'
    $ git show origin/main:sw.js | grep CACHE
    CACHE = 'chemowell-app-v80-2'

`origin/main` **is** app-v80 at `chemowell-app-v80-2`, which is exactly what `PUBLISHED.json`
records. **The record is correct and current.** app-v81, v82, v83 and v84 have all been written,
audited and committed, and **not one of them has ever gone out** — which is why the count is 37
commits rather than the handful a single release would produce, and why this push, when Aaron
authorises it, delivers four releases to phones at once. That is worth him knowing in those
words; it is not a defect.

**What running it anyway would mean.** It would stamp `PUBLISHED.json` with a build no phone has
ever loaded, and the gate's next comparison — is the CACHE new, has this CACHE shipped before, did
`sw.js` move with `index.html` — would be taken against a fiction. The file's own comment calls
this out: *"Never edit it by hand to make the gate pass — release_check.sh cross-checks these
values against the recorded commit and will refuse a record that lies."* The gate's ℹ️ line is
**informational and conservative**: assuming nothing is live makes the comparison stricter, not
looser. It is not one of the reasons this release is refused.

**The correct sequence stays:** push → `git fetch origin` → `./mark_published.sh` → commit.

---

## 7. THE FINDINGS ALREADY ON RECORD — checked against the file, not the commit message

The Scribe refused at `7eb5daa` with four blocking findings. I re-derived each from the current
tree rather than reading the fixes.

**B1 — README claimed the scroll lock is driven by an `overlay: true` flag on the back-button
registry. CLOSED.** `grep -c "overlay: true" index.html` → 1, and that one hit is
`index.html:1840`, a comment explaining why the flag was deleted. `README.md` now names its own
old sentence, records the *ten of twenty-three flags wrong* measurement that killed the
mechanism, and describes what ships — `anyOverlayOpen()`. The record now contradicts itself in
the right direction.

**B2 — "nineteen mutants swept, nineteen caught" was a result no run produced. CLOSED, with an
artifact.** `outputs/SWEEP-app-v84.md` carries one run at one commit (`714602b`): baseline
`96 checks: 96 passed, 0 failed`, then `19 mutant(s) caught, 0 survived`. It also does the thing
that makes it trustworthy — it states which later commits it does *not* speak for. I checked that
statement rather than accepting it: the only code change to `index.html` after `714602b` is the
one-character prefix fix quoted in §3. The artifact's own scope claim is true.

**B3 — README claimed `falsify.sh` refuses a busy port and no such guard existed. CLOSED both
ways.** The overclaim is gone from `README.md` (`grep -c "refuses a port"` → 0) *and* the guard
now exists at `falsify.sh:60-65`, correctly written without `curl -f` (so it asks "is anything
*answering*", not "is anything serving a page"), with the record of it having been falsified
against a real squatter on 8951 in the comment above it.

**B4 — the documented rebuild path built a blank app. CLOSED, and I re-measured it.** See §5:
`./verify-rebuild.sh` exits 0, `#root` renders 4205 characters, no exceptions.

**D1 / D2 / D3 — stale suite figures in the app-v81 and app-v83 rows, and an overstated "every
suite" claim. All three CLOSED with dated corrections.** The v83 row now reads *"45/45 at this
release"* and names 80/80 today; the v81 row is corrected to 32/32 with the correction stating
that, unlike the v83 figure, this one was never point-in-time; and the "final figures" list now
carries **twelve** suites, with the three that were quietly dropped added rather than the claim
being narrowed. I verified the list against my own run — all twelve figures match.

**D4 — "23 layers … a nineteenth overlay".** Corrected, and correct: `BACK_LAYERS` carries **26**
entries at HEAD (I counted them), `test/v82-back-button.mjs` is green against all 26, and the
23 is marked as a point-in-time figure with the commit it was true at.

**D5, D9, D10 — stale headings and line references.** `harness-v84-whatsnew.py` opens `app-v84`;
`test/v84-whatsnew.mjs` opens `v84-whatsnew.mjs`; `grep -n "near line 4218" index.html` → no hits,
and the v28 listener is where the comments now say. Closed.

**D11 — `PM-app-v84.md`'s standing claims.** Three dated corrections appended, the third
retracting the "all eight" figure. Closed *in that file* — and §2 is what happened to it next.

**D6 / D7 / D8** — `falsify.sh` internal comments. I did not re-derive these individually; see §9.

**Pass 9's five latent gaps A–E.** A and B are answered by the AST rewrite (§5 — and it is 11 of
12 sites now, not 4 of 12). C is answered: `verify-rebuild.sh` now refuses a dirty `index.html`
as well as a dirty script, so both halves judge the same tree. D is the "all 17 pieces" wording,
still slightly overstated (§5). E is the comment correction that is the entire `index.html` diff
since the audited commit.

---

## 8. RELEASE MECHANICS AND SCOPE — clean

- `APP_VERSION = 'app-v84'` and `sw.js` `CACHE = 'chemowell-app-v84-14'` move together;
  `chemowell-app-v84-14` appears exactly once in `README.md`, in the app-v84 row, and the gate's
  cache-novelty and cache-never-shipped-before checks are upstream of where it exited and did
  not object.
- The in-app `CHANGELOG` carries an `app-v84` entry. Its copy is product-neutral — no name, no
  pronoun, no care-plan dose — and `test/v75-no-other-patient.mjs` is 27/27, covering all four
  leak shapes in Rule 0.
- The notice's own copy is true as written: *"Updates from here on are listed under 'What's new'"*
  — "from here on" is the honest qualifier, and the earlier unqualified *"every past release"*
  claim is gone from both the app and the README, which is one of the three things the previous
  PM pass demanded.
- Working tree **clean**. HEAD is pushed: `origin/claude/caretracker-team-review-i83ik2` is
  `22c4475`, byte-for-byte this commit. Rule 0 satisfied — nothing here exists only in a sandbox.
- Design-time seats are on file and are real passes, not placeholders:
  `outputs/ENHANCER-app-v84.md` (two addenda tracking the notice's changes) and
  `outputs/DESIGN-app-v84.md` (three addenda) with **27** screenshots in
  `outputs/design-app-v84/` at 320 / 360 / 390, including the first-ever and older-unseen states.
- **Scope: no drift, and a bundle Aaron should be told about in one sentence.** He asked for the
  What's New notice because care-tracker has one and ChemoWell did not; that is app-v84 and it is
  what was built. app-v83 is tasks 24 and 25 of the redesign he approved from screenshots. But
  because nothing since app-v80 has been pushed, **this push ships four releases** (v81 dose
  parser and purpose hint, v82 timeline and vitals strip, v83 Meds card and Temperature report,
  v84 What's New). That is not scope drift; it is a deployment fact he should hear before he
  gives the word.
- **One wording item in `HANDOFF.md`, non-blocking.** Task 24 is `DONE — pushed`. It is pushed to
  this branch and it is not live. The status vocabulary that same file mandates has a phrase for
  exactly this — `DONE — pushed, awaiting your word` — and the shorter form reads as shipped.

---

## 9. WHAT I DID NOT CHECK

Said plainly, because the previous pass did and it was the most useful section in it.

- **Anything on a real phone.** This sandbox has Chromium only. Nobody has opened app-v84 on an
  iPhone or on Aaron's own device. The notice's dismissal, the scroll lock under a real finger,
  and the keyboard-resize interaction with the v28 nudge are all Chromium-measured only.
- **The full 19-mutant sweep.** I did not re-run `falsify.sh`. I checked the artifact's scope
  claim against git instead, which is a different and weaker thing, and I say so. Mutants 1–16
  have still never been swept against HEAD's `index.html` — though HEAD's `index.html` is one
  comment block away from the tree they were swept against.
- **`falsify.sh` items D6, D7 and D8** — three internal comments about outcome counts and check
  totals. Non-blocking by the Scribe's own classification and I did not re-derive them.
- **The other eleven `cut()` payloads by eye.** I verified the mechanism that compares them and
  falsified it; I did not read all seventeen pieces of text myself.
- **`sync-backend/`, the workflows, and the native Capacitor path.** Untouched by this release
  and not examined.
- **Whether the app-v81 and app-v82 rows are accurate as shipped.** I checked the figures the
  Scribe flagged and the BACK_LAYERS count. I did not audit those rows end to end, and this push
  carries them.
- **The first run of the gate's later stages.** It exited at the chain gate in both runs. I ran
  the three suites it would have run and they are green; I did not otherwise simulate it.

---

## 10. WHAT UNBLOCKS THIS

Two items, in this order, neither of which touches the app's behaviour.

1. **Fix the hook counts in `README.md:14`** — "two hooks … exports five", and "all five hooks".
   Optionally carry the third correction's sentence across so the record says why the number
   changed, in the manner this release has used everywhere else.
2. **One delta audit of HEAD.** Three commits; the `index.html` diff is five comment lines. The
   pass worth an auditor's time is not `index.html` — it is the 114-line
   `test/harness-payload-matches-app.py` written after the report that cleared what it replaces,
   plus `verify-rebuild.sh`'s +21. I falsified the first and it goes red correctly; that is my
   measurement, not an independent one, and this desk is not the independent one.

When both exist, re-run `./release_check.sh`. If it exits 0, this desk's objection is answered
and I will re-issue against the later commit. Nothing else here stands between this release and
Aaron.

---

*PM sign-off, pass 2. ChemoWell app-v83 + app-v84, measured at `22c4475` on 2026-09-15. Working
tree untouched apart from this file; falsification of the drift check was done on copies under a
scratchpad directory.*

---

# RUN B — `./release_check.sh` with this report committed, at `8980cf0`

Raw, pasted rather than described. This is the gate's reading of the release *including* this
desk's refusal, which is the reading that counts:

    ℹ️  Suites will run against a clean export of HEAD at /tmp/tmp.tWuLdTlYY4
       (not the working tree -- see the app-v82 note above).
    ℹ️  Baseline: PUBLISHED.json -> app-v80 (chemowell-app-v80-2) at 048c1ff
       37 commit(s) have changed index.html since that record. This gate assumes NONE of
       them are live yet. If any were already pushed, run ./mark_published.sh <that commit>
       first -- otherwise the comparison below is against the wrong build.
    ❌ RELEASE CHECK FAILED: a chain report refuses this release, and nothing supersedes it.
       These say DO NOT SHIP:
         outputs/PM-app-v84-pass2.md — examined 22c4475
         outputs/PM-app-v84.md — examined 3ec6b4c
       A refusal is cleared by re-running that stage against a LATER commit and it saying
       SHIP — not by adding another file beside it.

    EXIT=1

**Two things this run settles that a summary would have hidden.**

The gate **can read this report** — it names it by path with the commit it examined, rather than
listing it under "a chain report exists that this gate cannot read". That failure mode has twice
been allowed to become "raises no objection" on this project, and the only way to know it has not
happened again is to see the file's own name printed under a heading that says DO NOT SHIP. It is
printed there.

And the gate stops at the refusal, so the audit-currency blocker in §3 is **not visible in this
output**. It is real and it is next: with both PM refusals cleared, `check_report_current()` would
report `outputs/AUDIT-app-v84-delta8.md — examined 400bd37; changed since: index.html`, no AUDIT
report would be CURRENT, and the gate would fail again one stage later. Fixing only the README
sentence will not turn this green.

*Run B taken 2026-09-15, immediately after committing this file.*

---

# CORRECTION APPENDED 2026-09-15 — §9 OMITTED THE ONLY CODE CHANGE, AND CONTRADICTED §3

**The body above is left exactly as written.** A record quietly edited after the fact is worse
than one that is wrong, and this is the convention `outputs/PM-app-v84.md` already established
with three corrections of its own.

Section 9, "WHAT I DID NOT CHECK", says:

> *"Mutants 1–16 have still never been swept against HEAD's `index.html` — though HEAD's
> `index.html` is one comment block away from the tree they were swept against."*

**The second half is false.** The swept tree is `714602b`. HEAD differs from it by the
one-character prefix fix — `'chemowell-app'` → `'chemowell-app-'` — **plus** comments. "One
comment block away" deletes the only executable change in the range, and that change is the entire
reason it was worth asking whether the sweep still speaks for HEAD.

**And this report already knew.** Section 3 of the same file reports, correctly, that filtering
`714602b..HEAD` for non-comment changes yields exactly one line, and quotes it. So §9 contradicts
§3 four sections earlier in the same document. Caught by the tenth Zero Day audit
(`outputs/AUDIT-app-v84-delta9.md` §7), which read the two sections against each other.

**The correct sentence** is: mutants 1–16 had not been swept against HEAD, and HEAD's `index.html`
differs from the swept tree by that one character plus comments. `outputs/SWEEP-app-v84.md` states
this correctly; the error was mine alone and is not in the artifact.

**Nothing else in the report turns on it.** The verdict stood on two blockers, neither of which was
this, and both are now closed — see `outputs/PM-app-v84-pass3.md`, which re-issues the PM stage at
`c656ae8` with `VERDICT: SHIP`, and which records in its §5 what this class of defect is: a
sign-off internally inconsistent with itself, which nothing in this chain currently checks for.

*Correction written 2026-09-15 against `c656ae8`.*
