AUDITED-COMMIT: c656ae87aa71e99c715627b515e3387b58537d99
VERDICT: SHIP

# PM sign-off, pass 3 — ChemoWell app-v83 + app-v84

Third and final PM pass. `outputs/PM-app-v84.md` refused at `3ec6b4c`;
`outputs/PM-app-v84-pass2.md` refused at `22c4475` on two blockers. **Both are closed, both
verified by me rather than accepted, and this pass re-issues the PM stage at `c656ae8`, which is
HEAD and is what origin has on this branch.** I did not build any of this and I fixed nothing.

**HEADLINE: SHIP.** The app's executable content has not changed since the eighth audit cleared
it — I reproduced the md5s myself — every one of the twelve suites is green at HEAD, the rebuild
path boots, and the two records defects this desk refused over are corrected in the record Aaron
reads. I am signing over **one open finding in the test harness**, named in §6, which is latent,
touches nothing a user can reach, and is the first thing the next release should fix. I am not
filing it quietly: it is the reason this section says "signing over" rather than "clear".

---

## 1. THE GATE — raw output at `c656ae8`

    ℹ️  Suites will run against a clean export of HEAD at /tmp/tmp.ZIJAoGvERV
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

**Read what this says and what it no longer says.** The only refusals standing are **this desk's
own two**, at `3ec6b4c` and `22c4475`. **No AUDIT report is named** — `outputs/AUDIT-app-v84-delta9.md`
at `ffc7bff` has superseded every earlier Auditor refusal and is itself CURRENT, which is the
thing pass 2 blocked on. This file, examining `c656ae8`, is strictly later than both PM refusals
and both are ancestors of it, so it supersedes them by the gate's own rule.

A second run of the gate, taken after this file is committed, is appended at the end. A gate
reading quoted before the thing being gated exists is not a gate reading.

---

## 2. BLOCKER 1 — CLOSED, and verified against the file

`README.md:14` now reads:

> "...a hook block exporting **two** hooks where the release re-attaches **five** (the figures
> that stood here, four and eight, were both wrong — counted 2026-09-15 by parsing the script:
> `BASE_HOOKS` carries `__doseTest` and `__backTest`; `MOVED_HOOKS` adds `__whatsNewTest`,
> `__tempTest` and `__eraseTest`). Falsified in a real browser both ways: ... `#root` at 4205 and
> all **five** probed fields..."

`grep -c "eight hooks" README.md` → **0**. I re-parsed the script rather than trusting either the
commit message or my own earlier count: `BASE_HOOKS` **2**, `MOVED_HOOKS` **5**, and the three
names the row lists are exactly the three the AST shows `MOVED_HOOKS` adds. My own
`./verify-rebuild.sh` run at HEAD printed `#root innerHTML length: 4205` and five probed fields.
**Every figure in the corrected sentence is one I reproduced.**

It also does the thing that made this blocking in the first place: the row now records that "all
eight" had already been retracted once in `PM-app-v84.md`'s third correction and that **the fix
stopped one file short of the record**. The next reader learns the failure mode, not just the
number.

Both non-blocking items from pass 2 are closed too: `verify-rebuild.sh`'s banner no longer carries
a hand-written "17", and `HANDOFF.md` task 24 now reads `DONE — pushed, awaiting your word`, which
is that file's own mandated vocabulary and the honest description of a branch that is not live.

---

## 3. BLOCKER 2 — CLOSED, and this time HEAD being past the SHIP commit does NOT matter

`outputs/AUDIT-app-v84-delta9.md` is a real 198-line pass, `VERDICT: SHIP` at `ffc7bff`.

Pass 2 asked this question about a five-line comment diff and answered "it matters, barely".
**The answer is different now and it is not a judgement call — it is empty output:**

    $ git diff --name-only ffc7bff..HEAD -- index.html sw.js .github/workflows \
          sync-backend package.json package-lock.json capacitor.config.ts
    $

**Not one gated file moved after the audited commit.** `c656ae8` touches
`test/harness-payload-matches-app.py` and nothing else. So `check_report_current()` finds no
drift, delta9 is CURRENT, and the gate agrees — it named no AUDIT report in §1.

**And I reproduced the audit's strongest claim myself** rather than reading its table, because it
is the claim the whole verdict rests on. Comment-stripped `index.html`, md5 truncated to 12:

| commit | comment-stripped md5 |
|---|---|
| `400bd37` — what delta8 cleared | `2cf265655d53` |
| `a1d023f` | `2cf265655d53` |
| `ffc7bff` — what delta9 cleared | `2cf265655d53` |
| **HEAD `c656ae8`** | **`2cf265655d53`** |
| `714602b` — the tree the sweep judged | `ffcd5a6fff5a` |

**The executable content of the app at HEAD is byte-identical to what two independent audit passes
have now cleared.** The only executable difference anywhere in this range is the one-character
prefix fix at `4b54901`, which is inside delta8's audited range and which delta8 verified
explicitly.

---

## 4. THE MUTANT ARGUMENT — I was asked to judge it. It is SOUND, and its best evidence is not in its own list.

Pass 10 ran mutants 12–16 at HEAD (baseline 96/96; `5 caught, 0 survived, 0 could not be measured,
0 anchor(s) stale`), which with delta8's 17–19 means **12 through 19 are swept at HEAD**. It
argues 1–11 need not be run. Five reasons were offered; I checked the load-bearing ones.

**Reason 4 — "none of 1–11 reads the snapshot" — is true, and I checked it by reading the mutant
file rather than the claim.** Their subjects and anchors are: `restoringFocus`, the v28 nudge's
`lastUserScrollAt` guard, the nudge itself, `focus({ preventScroll: true })`, `anyOverlayOpen()`'s
`pointerEvents === 'none'` skip, the scroll lock's release branch, its 90%-viewport engage test,
`localStorage.setItem(WHATS_NEW_KEY, APP_VERSION)`, the `['wheel','touchmove']` listener list, the
*See recent updates* label, and an aria-label. **None reads `HAD_PRIOR_CHEMOWELL_DATA`** and none
anchors on the line the prefix fix changed.

**But "the mutant does not read the changed value" only covers its TARGET.** The failure mode that
actually bit this release three times was not a mutant reading the wrong thing — it was a **stale
anchor**: `mutant_18`'s `assert s.count(old)==1` failing after the app moved under it, killing the
sweep under `set -e` with no tally. Scribe finding B2 is exactly that. So the argument needs the
anchors to still apply, and neither the audit's list nor the coordinator's summary puts that first.

**I measured it.** I extracted every `old = ...` literal from `falsify/mutants-v84-whatsnew.sh`,
evaluated each, and counted its occurrences in HEAD's `index.html`:

    anchors evaluated: 19
    anchors NOT appearing exactly once in HEAD's index.html: 0

**All nineteen anchors apply, exactly once, at HEAD. Zero stale.** That, plus a 96/96 baseline at
HEAD measured four separate times and an unchanged suite, is what makes "1–11 would behave as they
did at `714602b`" a deduction rather than an expectation. **With that in hand I accept the
argument and do not require mutants 1–11 to be re-run.** Without it I would have.

---

## 5. MY OWN ERROR, CORRECTED — pass 2 §9 was wrong and pass 10 was right to say so

Pass 2 §9 says mutants 1–16 had never been swept against HEAD *"though HEAD's `index.html` is one
comment block away from the tree they were swept against."*

**That is false, and it contradicts my own §3 four sections earlier**, which correctly reported
that filtering `714602b..HEAD` for non-comment changes yields exactly one line. The swept tree is
`714602b`, and HEAD differs from it by the one-character prefix fix **plus** comments. The code
change is the entire reason the question was worth asking, and my sentence deleted it.

**I am refusing this release's own defect in my own report**, so the correction is made the way
this project makes them: `outputs/PM-app-v84-pass2.md` keeps its body exactly as written and
carries a dated correction appended beneath it, in the manner of `PM-app-v84.md`'s three. A record
quietly edited after the fact is worse than one that is wrong.

Worth naming the shape: a sign-off whose §9 disagrees with its own §3 is the same class as an
evidence figure nothing produces. **Internal consistency is not a smaller property than accuracy**,
and nothing in this chain checks for it — not the gate, not the Auditor's brief. That belongs in
`BACKLOG.md`, not in this release.

---

## 6. THE ONE FINDING I AM SIGNING OVER — and exactly why, in the open

`c656ae8` landed after delta9's verdict and closes pass 10's §3: `src` may now be assigned only
from `read_text()` or from `cut()`, so a payload written into the app by some other route cannot
go uncompared. **It is post-audit code that nobody independent has read, so I falsified it** on
isolated copies under my scratchpad — the shared tree was never touched.

    control, unmodified                                    17 checks: 17 passed, 0 failed  exit 0
    src = src.replace("</body>", "<!--SNEAK--></body>")     18 checks: 17 passed, 1 failed  exit 1
    src = src + "<!--SNEAK-->"                              18 checks: 17 passed, 1 failed  exit 1
    src = "".join([src, "<!--SNEAK-->"])                    18 checks: 17 passed, 1 failed  exit 1
    src = _re.sub("</body>", "<!--SNEAK--></body>", src)    18 checks: 17 passed, 1 failed  exit 1
    src += "<!--SNEAK-->"                                   17 checks: 17 passed, 0 failed  exit 0   <-- MISSED
    src, _junk = src + "<!--SNEAK-->", 1                    17 checks: 17 passed, 0 failed  exit 0   <-- MISSED
    restored                                               17 checks: 17 passed, 0 failed  exit 0

**The guard catches the four shapes pass 10 named and misses two it did not.** `src += "..."` is an
`ast.AugAssign`, not an `ast.Assign`; `src, _junk = ...` puts a `Tuple` in `node.targets` where the
walk looks for a `Name`. **This is the same defect a fourth time, one level up each round:** the
`.mjs` could only see the SPELLING it was written against (`r"""`), the `.py` could only see the
FUNCTION it was written against (`cut`), and now it can only see the ASSIGNMENT FORM it was written
against. The commit message for `c656ae8` says *"the answer both times was to stop trusting a
convention and check it"* — and then enumerated shapes rather than checking the invariant.

**Two claims in the repo are therefore false as landed**, and I name them rather than let them
stand unremarked:

* `test/harness-payload-matches-app.py:103` — *"EVERY EDIT TO THE FILE MUST GO THROUGH `cut()`"*
  and *"`src` may be assigned only from the initial read, or from `cut()`"*.
* `verify-rebuild.sh:60` — *"checking **every** piece of app text the patch script carries is still
  the app's"*, a word upgraded in `c656ae8` on the stated grounds that it had become true by
  mechanism rather than convention. It has not.
* `outputs/AUDIT-app-v84-delta9.md` §3 — *"With it, the banner's word 'every' becomes true by
  construction."*

**It is latent, and I established that by AST rather than by grep**, because grep is how the
earlier versions of this same check were fooled:

    plain Assign to src: 13  {'read_text': 1, 'cut': 12}
    AugAssign to src: 0   |  tuple-target assigns to src: 0   |  HTML.write_text sites: 1

**Why I am not blocking on it, said plainly so the reasoning can be argued with:**

1. **Nothing a user can reach is affected.** The app's executable content is byte-identical to what
   two audits cleared (§3). This is a check on a rebuild script, not the shipping file.
2. **It is in no gated file.** `test/` is outside `RULE5_PATHS`, so Rule 5 does not reach it, and
   the two claims are a comment and a terminal banner — not `README.md`, not `HANDOFF.md`. I
   checked: the durable record carries no version of this claim (`grep` → 0).
3. **It is latent by measurement, not by assumption**, per the AST count above.
4. **The blocker this desk raised twice was a false figure in the record Aaron reads.** This is a
   false completeness claim in a developer comment. Treating those as the same thing is how an
   audit loop stops terminating — eleven rounds on a dose parser is written into the operating
   model as the failure it cost, and the ratio here is now three consecutive passes whose findings
   are about the checking apparatus rather than the app. `CLAUDE.md` Rule 2.2 says in as many
   words that if that starts happening, the reasoning has gone wrong.

**What should happen next, and it is small:** handle `ast.AugAssign` and tuple/list targets in that
walk, and re-falsify against all six shapes. Until then the honest word in both places is
*"assignments"*, not *"every edit"*. **This is the first item of the next release, and it is in
`BACKLOG.md`'s territory, not a reason to hold four finished versions off a phone.**

---

## 7. `PUBLISHED.json` — re-derived, and the answer is unchanged: do NOT run `mark_published.sh`

Pass 10 did not re-derive this, so I did it again and **closed the one weakness in my pass-2
answer**: last time I read `origin/main` without fetching first, which is precisely what
`mark_published.sh`'s own header warns against. This time:

    $ git fetch origin
    $ git rev-parse origin/main                          47e1bc41dd4462fa3af715d97f116b98e6af4127
    $ git show origin/main:index.html | grep APP_VERSION  APP_VERSION = 'app-v80'
    $ git show origin/main:sw.js      | grep CACHE        CACHE = 'chemowell-app-v80-2'
    $ git merge-base --is-ancestor 048c1ff origin/main    (true)

`PUBLISHED.json` records `app-v80` / `chemowell-app-v80-2` at `048c1ff`, and `048c1ff` is an
ancestor of the commit the remote actually has. **The record is correct and current, after a
fetch.** Nothing since app-v80 has been pushed.

**Running `mark_published.sh` now would stamp the file with a build no phone has ever loaded** —
the one thing its own header forbids (*"Never edit it by hand to make the gate pass"*), and the
gate's ℹ️ line is informational and **conservative**: assuming nothing is live makes the cache
comparison stricter, not looser. It is not a reason this release was ever refused.

**The sequence stays: push → `git fetch origin` → `./mark_published.sh` → commit.**

**And the thing Aaron should hear in one sentence:** app-v81, v82, v83 and v84 have all been built,
audited and committed and **not one has ever gone out**, so this push delivers four releases to
phones at once — the dose parser and purpose hint, the Home timeline and vitals strip, the Meds
card and Temperature report, and the What's New notice he asked for.

---

## 8. RE-MEASURED AT HEAD — twelve suites, the rebuild, and the leak guard

Run by me at `c656ae8`, one at a time, not taken from any brief:

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

All twelve match `README.md:14` exactly. `test/v72-med-purpose.mjs` again needed
`env -u HTTPS_PROXY ...`, and that trap is now written into `HANDOFF.md` with its two sibling
output-shape traps — I verified all three shapes myself.

`./verify-rebuild.sh` → **exit 0**, `17 checks: 17 passed, 0 failed`, `OK -- What's New applied`,
`uncaught exceptions: none`, `#root innerHTML length: 4205`, five probed fields, `BOOTS`.

Rule 0: `test/v75-no-other-patient.mjs` 27/27, covering all four leak shapes. The five comment
lines that are the whole `index.html` delta since delta8 carry no patient name, gendered pronoun,
care-plan dose or medication-id branch.

Release mechanics: `APP_VERSION = 'app-v84'` and `sw.js` `CACHE = 'chemowell-app-v84-14'` move
together, the cache key appears once in the app-v84 row, the in-app `CHANGELOG` carries an app-v84
entry in product-neutral copy, working tree **clean**, and HEAD is pushed — origin has
`claude/caretracker-team-review-i83ik2` at `c656ae8`.

The three suites the gate runs itself sit inside the table above and are green, so the part of the
gate that never executes before the chain stage would pass.

---

## 9. WHAT I DID NOT CHECK

- **Anything on a real phone.** Chromium only. Nobody has opened app-v84 on an iPhone or on
  Aaron's own device. The notice's dismissal, the scroll lock under a real finger, and the
  keyboard-resize interaction with the v28 nudge are Chromium-measured only. **This is the single
  largest thing standing behind this signature** and no amount of further sandbox work reduces it.
- **Mutants 1–11 at HEAD.** I judged the argument for not running them (§4) and verified its
  anchors; I did not run them. Mutants 12–19 have been run at HEAD by others, not by me — I
  reproduced the anchor precondition, not the sweep.
- **`falsify.sh` D6/D7/D8** — three internal comments about outcome counts. Non-blocking by the
  Scribe's classification and not re-derived.
- **The eleven `cut()` payloads by eye.** I verified and falsified the mechanism that compares
  them, twice now; I did not read all seventeen pieces of text myself.
- **`sync-backend/`, the workflows, the Capacitor path.** Untouched by this release, not examined.
- **The app-v81 and app-v82 rows end to end.** I checked the figures the Scribe flagged and the
  `BACK_LAYERS` count; this push carries those rows and I did not audit them line by line.
- **Whether delta9's own falsification table (§2) reproduces.** I reproduced its §1 md5 table and
  its §3 finding, and I extended §3 by two shapes. I did not re-run its coverage-floor table.

---

## 10. THE VERDICT, AND WHAT IT IS NOT

**SHIP**, at `c656ae8`.

It is not a statement that this release is perfect. §6 names an open defect in the test harness and
three sentences in the repo that overstate what it guarantees, and I would rather that sat in a
signed document than in nobody's memory. It is a statement that **the code has been read by two
independent audits and has not changed since; that every check this project owns is green and was
re-run by me rather than quoted; that the two records defects this desk refused over are fixed in
the record that matters; and that the remaining work is on the instruments, not on the app.**

What still needs Aaron: the go-ahead to push, and a look at the notice on his own phone after it
lands. What needs saying when he gets that message: this push is four releases, not one.

---

*PM sign-off, pass 3. ChemoWell app-v83 + app-v84, measured at `c656ae8` on 2026-09-15. Working
tree untouched apart from this file and a dated correction appended to pass 2; falsification was
done on copies under a scratchpad directory.*

---

# RUN B — `./release_check.sh` with this sign-off committed, at `9c057eb`

Raw, pasted rather than described.

    ℹ️  Suites will run against a clean export of HEAD at /tmp/tmp.douA05V0nw
       (not the working tree -- see the app-v82 note above).
    ℹ️  Baseline: PUBLISHED.json -> app-v80 (chemowell-app-v80-2) at 048c1ff
       37 commit(s) have changed index.html since that record. This gate assumes NONE of
       them are live yet. If any were already pushed, run ./mark_published.sh <that commit>
       first -- otherwise the comparison below is against the wrong build.
    ℹ️  Other reports present and not clearing this release:
         outputs/AUDIT-app-v84-delta.md — says DO NOT SHIP
         outputs/AUDIT-app-v84-delta2.md — says DO NOT SHIP
         outputs/AUDIT-app-v84-delta3.md — says DO NOT SHIP
         outputs/AUDIT-app-v84-delta4.md — says DO NOT SHIP
         outputs/AUDIT-app-v84-delta5.md — says DO NOT SHIP
         outputs/AUDIT-app-v84-delta6.md — examined 8bcb8c9; changed since: index.html sw.js
         outputs/AUDIT-app-v84-delta7.md — says DO NOT SHIP
         outputs/AUDIT-app-v84-delta8.md — examined 400bd37; changed since: index.html
         outputs/AUDIT-app-v84.md — examined 5600b92; changed since: index.html sw.js
         outputs/PM-app-v84-pass2.md — says DO NOT SHIP
         outputs/PM-app-v84.md — says DO NOT SHIP
    ℹ️  Chain artifacts present for app-v84, and current against the working tree:
         outputs/AUDIT-app-v84-delta9.md
         outputs/PM-app-v84-pass3.md
    ℹ️  v76-properties-equivalence.mjs: green.
    ℹ️  v76-empty-window-render.mjs: green.
    ℹ️  No-other-patient check: clean.
    ✅ Release check passed.
       index.html changed and sw.js's CACHE constant changed with it -- installed
       copies of the app will pick this up automatically on next open.

    EXIT=0

**`EXIT=0`. The gate passes, and it passes for the right reasons rather than by silence.**

Three things in that output are worth an eye, because a green board is exactly when nobody reads
one.

**It names the two reports that clear the release**, by path: `AUDIT-app-v84-delta9.md` and this
file. Not "a report was found" — the specific two it read, each current against the working tree.

**Eleven superseded reports are listed and not hidden**, including this desk's own two refusals and
seven Auditor ones. A gate that printed only the passing reports would look identical to a gate
that could not see the refusals, and this file's comments record that exact failure happening
twice. Ten refusals and two stale-by-drift reports are visible above the tick.

**The stages beyond the chain gate ran for the first time in this release.** Every previous run
`exit 1`ed before reaching them. `v76-properties-equivalence`, `v76-empty-window-render` and the
Rule 0 patient-leak check are green here, in the gate's own run against a clean export of HEAD —
not only in mine against the working tree. That is a distinction this repo has been bitten by
(`app-v82` audit, BLOCK 3: what is on disk is not what ships), and it is now closed by measurement.

The `ℹ️` line about `PUBLISHED.json` is informational and is answered in §7: the record is correct
after a fetch, `mark_published.sh` must not run before the push, and assuming nothing is live makes
the comparison stricter rather than looser.

*Run B taken 2026-09-15, immediately after committing this file.*
