# Zero Day Auditor — app-v66 ROUND 2 (`46e8db8`)

Branch `claude/caretracker-chemowell-updates-k80ydk`. Audited 2026-08-25. Everything below was run,
not reasoned about. Round 1's report is `outputs/AUDIT_app-v66_beta-v59.md`.

---

## THE HEADLINE

**The gate is genuinely fixed, and I could not defeat it with anything a person would plausibly
write. But while running the twenty browser suites nobody had run, I found something worse than the
thing that stopped round 1: app-v58 quietly undid two of the v57 Designer's fixes to the Help search
results screen — the same screen this whole release is about — and the test that guards them has
been red for NINE releases without anyone reading it.**

Same failure as `V57-1`, on the same screen, in the neighbouring suite, and nobody has caught it in
two audits.

**I am NOT blocking this release.** The defect round 1 stopped it for is really fixed, and the fix
is better than what it replaced. What I am reporting is what the release did not look at.

---

## VERDICT: NO BLOCKER. Four MAJORs, several MINORs.

The release changes no application code. `index.html` and `sw.js` are byte-identical to `aeec6ec`
(`git diff aeec6ec 46e8db8 --stat` touches only README.md, outputs/webmain-v43/run.mjs,
test/v57-search.mjs, test/v59-para.mjs). Nothing here can reach a patient. What is at stake is
whether the gates guard.

---

## Why I did not block, stated plainly

Round 1 blocked because the gate could be defeated **by ordinary prose** — the literal text
`keywords: [` typed into a Help answer — *and* because the commit message and README asserted as
fact that the gate was falsifiable in both directions when it was not. Both halves mattered.

The replacement survives the prose attack (proven below, four mutants). It can still be defeated,
but only by an escape sequence deliberately hidden inside a keyword array (MINOR-1) — not something
an author writes by accident. And the commit's claim is correctly scoped: *"Counting raw against
parsed cannot be fooled by prose, because prose raises the raw count and not the parsed one."* That
sentence is true as written. There is no false claim of invulnerability to correct.

Applying round 1's standard mechanically would block again. Applying it honestly does not.

---

## MAJOR-1 (NEW) — app-v58 reverted two of the v57 Designer's fixes to the Help search results screen, and they are still reverted in app-v66

**Files:** `index.html:6981` and `index.html:6994-6998`; guarded by `test/v57-browser-notice.mjs`
(`R2D-1`, `R2D-3`, `R2D-4`), red since app-v58.

This is the screen a frightened person reaches by typing their own words. app-v57's Designer pass
fixed three things on it. Two were undone one release later.

**1. The safety strip lost its own surface.** app-v57 shipped it on `#FFFBF5`, deliberately
different from the white cards around it, because on white it *"read as the first result rather
than as an aside"*. app-v66 renders it on `#FFFFFF`:

```
index.html:6981
h('section', { style: { background: '#FFFFFF', border: '1px solid #E9D8D1', ...
```

Traced across releases — the colour count in `index.html` for `#FFFBF5`:

```
32b297f (app-v57)  3 occurrences   <- strip has its own surface
9155fd3 (app-v58)  1 occurrence    <- reverted here
aeec6ec (app-v66)  1 occurrence    <- still reverted
```

The one surviving use is at `index.html:4217`, an unrelated notice card.

**2. The results count line moved back below the fold.** app-v57 passed it *into* `listCard()` as a
caption above the rows. app-v66 renders it as a standalone `section` **after** the whole results
list — the exact pre-v57 defect ("rendered AFTER all twelve rows, ~1,080px below the fold"):

```
app-v57 (32b297f:6503)   ? listCard(results.map(...), <count line>)
app-v66 (index.html:6994) results.length ? h('section', {...TYPE.caption...}, <count line>) : null
```

**3. Consequence, measured in a real browser:** the strip is **216px at 360px** and **235px at
320px** against the Designer's 200px bar, and at 320px the first result row has only **21px visible
above the bottom nav** (bar: 50px). At 320px, a person searching gets a screen with no readable
result on it.

### Reproduction
```bash
cd /home/user/chemowell-app-beta
python3 -m http.server 8899 --directory . &
env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy node test/v57-browser-notice.mjs
# 17 FAILURES, exit 1
```

### Severity reasoning
**Not a BLOCKER, and not a safety failure.** I checked the thing that actually matters: the
care-team sentence and the one-tap route to `sym-severe` are both **present and rendered** — the
suite finds and measures the strip, so it exists. `V57-1` passing is not a lie. What was lost is
legibility and visual separation, which is exactly what the Designer stage exists to protect and
what `TEAM.md` calls the premium consumer-grade bar.

**What makes it MAJOR is the pattern, not the pixels.** app-v66's entire stated purpose is "a gate
that had been red for eight releases and nobody noticed." A gate on the *same screen* has been red
for **nine** (v58, v59, v60, v61, v62, v63, v64, v65, v66), and two audits have now walked past it —
round 1 saw the 17 failures, counted them, categorised them, and did not ask whether they were the
suite being stale or the app being broken. They are the app being broken.

Fix belongs in a separate release; do not bolt it onto this one.

---

## MAJOR-2 — round 1's MAJOR-1 was closed in one file and left standing in the other

**File:** `test/v57-search.mjs:392-398` (unchanged by this commit)

Round 1 named two files. The commit fixed `test/v59-para.mjs` and says so accurately. Nothing was
done to the second, and nothing acknowledges it. The retracted claim still reads, as fact:

```
// app-v65 removed it along with the visible copy, and the topic then
// scored ZERO for "litres": helpStem('litres') is 'litr', the index holds only 'liter', and
// helpFuzzy's 1-edit budget for a 6-letter word cannot bridge a 2-edit gap. Worse than a miss --
// an unmatched term still counts against helpScore's denominator, so it pushed the topic DOWN.
```

Eight lines below it, the correction says the opposite: *"app-v65 was never broken … The topic was
found either way."*

**I settled it by running it myself**, against a build with the alias deleted (`/tmp/mut/m2_noalias.html`):

```
FAIL app-v66 "litres" is an EXACT keyword hit  |  [{"key":"liters","quality":0.65}]
FAIL ...resolves to the paracentesis topic, alone  |  litres -> proc-para, faq:weight-reason
```

`proc-para` scored **0.65**, not zero, and came back **first**, not pushed down. The surviving
comment is false. Round 1's reasoning applies unchanged: nobody reads a commit message from eight
releases ago; they read the file.

---

## MAJOR-3 — the new cross-check counts comments, and the same file has a helper written to stop exactly that

**File:** `test/v57-search.mjs:429-433`

```js
const rawLitre = (html.match(/litre/gi) || []).length;
```

`html` is the whole file, comments included. Writing an ordinary source comment in `index.html` that
mentions the word turns the release gate red with nothing wrong.

### Reproduction (run, not reasoned)
```bash
# add ONE comment line above HELP_SYNONYMS, change nothing else:
# // app-v65 normalised every visible string to "liters"; "litres" survives only as a search alias.
node test/v57-search.mjs --file /tmp/mut/m7_comment_LEGIT.html
FAIL app-v66 every "litre" in the shipped bytes is accounted for by a parsed search keyword
     |  2 in the file, 1 in parsed keyword arrays          # node exit 1
```

This is the exact false-positive class the same file documents **at line 119**:

> *"Source-level assertions run against CODE ONLY. Three false positives across two releases all came
> from a comment that mentioned the very token the assertion forbade, so comments are stripped
> before any 'this string must not appear' check."*

`codeOnly()` is defined at line 121 and the new check does not call it. Given that this release,
its two audits and its README row all discuss "litres" at length, someone documenting the alias in
`index.html` is not a hypothetical.

**Same class, same commit:** the `|| true` removal at `outputs/webmain-v43/run.mjs:119` left the
literal token `|| true` inside its replacement comment, so any grep-based gate for that
anti-pattern still hits the line it was supposed to clear.

A false RED is the safe direction to fail, which is why this is MAJOR and not a BLOCKER.

---

## MAJOR-4 — nothing runs any of these suites

**Files:** `package.json:7`, `release_check.sh`, `.github/workflows/android-build.yml`

```
package.json  "test": "echo \"Error: no test specified\" && exit 1"
release_check.sh                — references no test/*.mjs
android-build.yml               — npm ci, cap add, gradlew assembleDebug, android_smoke_test.sh
```

No automation executes `test/*.mjs`. Every gate in this repo is a file a human has to remember to
run. That is the mechanism behind `V57-1` sitting red for eight releases and `R2D-1/3/4` for nine —
not carelessness, an absent runner. Two rounds of work have now gone into making a gate that *can*
fail, on top of a system where a red gate is invisible by default.

---

## MAJOR-5 (carried from round 1, reassessed — and round 1 got the direction backwards)

**Files:** `chemowell-app-beta/sw.js:20`, `chemowell-beta/sw.js:10`, `care-tracker/sw.js:10`

Round 1 reported two apps evicting each other. It is **three** — `chemowell-app-beta` has the
identical activate handler and is served from the same `arnjnnngs.github.io` origin:

```
chemowell-app-beta  CACHE = 'chemowell-app-v66-1'
chemowell-beta      CACHE = 'chemowell-beta-v59'
care-tracker        CACHE = 'caretracker-v59'
  all three: caches.keys().then(ks => ...ks.filter(k => k !== CACHE).map(k => caches.delete(k)))
```

**Round 1 said network-first "matters more now." Measured, it is the other way round.** All three
workers already put the document back into the cache on every successful navigation
(`caches.open(CACHE).then(c => c.put(e.request, copy))`, line 47 in all three). The cache-first
branch at line 58 does **not** re-cache. So after an eviction:

- **network-first document** — self-heals on the first online visit.
- **cache-first shell assets** (manifest, icons) — never re-cached until the next `CACHE` bump.

Offline immediately after an eviction, both designs fail equally; network-first is the one that
recovers. Round 1's conclusion should be reversed.

**Real-world consequence, in plain words:** if the patient's phone ever opens a ChemoWell beta link
in the same browser, the medication app's offline copy is deleted. Open the app once with a signal
and it is fine again. **No logged data can ever be lost this way** — entries live in
`localStorage`/`IndexedDB`, which Cache Storage eviction does not touch. The realistic harm is one
"can't load" screen while offline. Pre-existing, belongs in `BACKLOG.md` with an owner, not in this
release. One-line fix: filter on `k.startsWith('<prefix>-')`.

---

## The attacks I was asked to run, and what they returned

Live build: `test/v57-search.mjs` **ALL GREEN**, `test/v59-para.mjs` **15/15**, both exit 0.

| # | Mutant | Should be | Actual |
|---|---|---|---|
| M1 | round 1's killer: alias deleted + visible `Litres` disguised behind a literal `keywords: [` | RED | **exit 1 — but by CRASH, not by a check** (see MINOR-2) |
| M2 | alias deleted only | RED | **RED**, 3 checks, exit 1 |
| M3 | visible `'Litres drained (optional)'` label (outside Help) | RED | **RED** on the cross-check, `2 in the file, 1 in parsed`, exit 1 |
| **M4 (mine)** | visible `Litres` in a `HELP_CATEGORIES` blurb — rendered, and NOT in `corpus` | RED | **RED**, `2 in the file, 1 in parsed`, exit 1 |
| **M5 (mine)** | `"litres"` keyword + visible `'Litres drained'` label — the offset attack | RED | **ALL GREEN, exit 0 — DEFEATED** |
| M6 | legitimate: same alias added to a second topic | GREEN | cross-check GREEN (2===2) — the numeric pin is really gone; a *different*, pre-existing check goes red (MINOR-3) |
| M7 | legitimate: a source comment mentioning "litres" | GREEN | **RED — false alarm** (MAJOR-3) |
| M8 | legitimate: a balanced `[...]` inside Help copy | GREEN | **GREEN** |

### Your prime suspect: DISPROVEN

You asked whether a topic rendered but absent from `corpus` could raise both counts equally and pass.
It cannot. `keyedLitre` reads **only** `corpus[].keywords`, so anything outside `corpus` raises
`rawLitre` alone and the cross-check goes red. **M4 proves it on the real suite.** `corpus` really is
incomplete — `HELP_POINTERS[0].q` (rendered at `index.html:7028`), `HELP_CATEGORIES[].label` and
`.blurb`, and `HELP_CARE_TEAM_LINE` are all rendered Help text that `corpus` never sees — but the
cross-check backstops every one of them.

### Is `displayedText()` complete? Yes, for the fields that hold copy.

Enumerated from the parsed data — every field present on any of the 119 `HELP_TOPICS` / 15 `FAQ_ITEMS`:

```
id, cat, q, a, steps, branches{when,steps}, note, keywords, related, medical, safety, careLead, careTone
```

`displayedText()` walks `q, a, note, steps[], branches[].when, branches[].steps[]`. Of the rest:
`medical`, `safety`, `careLead` are **booleans**; `careTone` is the single value `'calm'`; `related`
is an array of topic **ids** whose rendered label is the target's `q` (already walked); `keywords` is
never rendered — confirmed, its only readers are `helpIndex` at `index.html:6550` and the scorer at
`:6667/:6695`. `id` and `cat` are not copy.

**No displayed field was missed.** This is the one part of the change I could not find a hole in.

### Is `html` the full shipped file? Yes.

`fs.readFileSync(FILE)` where `FILE` defaults to `../index.html` — the actual single-file app, not a
slice. `www/index.html` is a 1.2KB native splash stub and `capacitor.config.ts` loads the live URL,
so there is no second copy of the app to drift.

### Does deleting PARA-0 lose coverage? No silent loss.

| PARA-0 caught | Restored by |
|---|---|
| a `litre` anywhere outside a keyword array | cross-check (**stronger** — parses instead of pattern-matching) |
| the alias deleted | `litreKeyed.includes('proc-para')` |
| *false-failed* on a second alias | fixed — the `=== 1` pin is gone (M6) |

One thing genuinely changes: PARA-0 needed no parse, so it survived a malformed `HELP_TOPICS`. The
replacement dies with the parser (MINOR-2). Loudly, not silently.

---

## MINORs

**MINOR-1 — the new gate is still defeatable, by escape sequence.** M5, above: change the alias to
`"litres"` (raw bytes lose a `litre`, the parsed keyword keeps one) and spend the freed count on
a visible `'Litres drained (optional)'` label. All six checks green, exit 0. Also unreachable by any
check: a homoglyph (`Litrеs` with Cyrillic `е`) is invisible to `/litre/i` in both directions.
Contrived; reported for the record, and explicitly **not** my reason for anything.

**MINOR-2 — M1 crashes the suite instead of failing a check.** The commit says the three mutants are
"caught by at least one check." M1 is not caught by any check — the unbalanced `[` breaks
`sliceBlock()`'s bracket counter and the suite throws before a single assertion runs, taking all 53
fixtures and the `V57-1` safety checks with it:
```
Error: unbalanced block: const HELP_TOPICS = [   at sliceBlock (test/v57-search.mjs:62:9)   # exit 1
```
Exit 1 is the right outcome, so the gate holds. But the description is wrong, and concentrating the
spelling gate inside the parsing suite means one stray unbalanced bracket in Help copy now takes down
the spelling check too — which it did not when PARA-0 lived in `v59-para.mjs`. (A *balanced* `[...]`
in copy is fine — M8 green.)

**MINOR-3 — round 1's "red on a legitimate change" is only half fixed.** The `=== 1` pin is gone, but
`'app-v66 and it still resolves to the paracentesis topic, alone'` goes red on M6. Defensible —
"alone" is a property someone deliberately chose — but the round-1 finding is not fully closed and
the commit reads as if it were.

**MINOR-4 — three suites are red on a stale pinned count.** `133` vs the real `135`:
`test/audit-v55.mjs` (`A3`), `test/pm-v55.mjs` (`P3c`), `test/pm-v55b.mjs` (`B8`). Pinned-literal
anti-pattern, the same one this release exists to remove, in three more places.

**MINOR-5 — `test/audit-v55b.mjs` cannot start at all.** `Error: Cannot find module '/tmp/topics.js'`,
exit 1 in 0 seconds — a scratch file from the retired sandbox. A gate that cannot start is
indistinguishable from a gate that passes; this release fixed that class for the playwright path and
left this one.

**MINOR-6 — `PUBLISHED.json` still names commit `2b40965`, which does not exist here.**
`./release_check.sh` still prints both warnings and still exits 0 on the `origin/main` fallback. I
verified the fallback is correct **right now** — `origin/main` is `0c9a63c` = "mark app-v65
published" = the real last release — and `mark_published.sh:25-29` now records `origin/main`, so it
self-corrects at the next real deploy. Round 1's mechanism complaint stands until then; the commit's
handling of it is honest.

---

## All twenty browser suites — run, as asked

`git diff aeec6ec 46e8db8 -- index.html sw.js` is **empty**, so re-running against
`git show aeec6ec:index.html` is a no-op: **every failure below is pre-existing by construction.**
I dated them against release history instead, which is the more useful question.

| Suite | exit | secs | Result |
|---|---|---|---|
| audit-v55 | **1** | 116 | 38 pass, **3 fail** — `A3` stale count 133/135; `A6` "0 chips followed"; `B8` example query "?" |
| audit-v55b | **1** | 0 | **cannot start** — missing `/tmp/topics.js` |
| audit-v55c | 0 | 23 | green |
| audit-v55d | 0 | 38 | green |
| pm-v55 | **1** | 65 | 20 pass, **1 fail** — `P3c` stale count |
| pm-v55b | **1** | 65 | 15 pass, **1 fail** — `B8` stale count |
| pm-v55-chips / -focus / -routes / -shot | 0 | 20/7/13/6 | green |
| v52-fixes | 0 | 6 | green |
| v55-fixes-shots | 0 | 13 | green |
| v55-help | 0 | 150 | green |
| **v57-browser-notice** | **1** | 66 | **17 fail — MAJOR-1, real app regressions from app-v58** |
| v57-search | 0 | 1 | ALL GREEN |
| v58-eod-checkin | 0 | 17 | green |
| v59-para | 0 | 14 | 15/15 |
| v61-backup | 0 | 29 | green |
| v63-encrypted-backup | 0 | 32 | green |
| v64-logger | 0 | 18 | green |

**15 green, 5 red.** Of the 5: one is a real app regression (MAJOR-1), three are stale pinned counts
(MINOR-4), one cannot start (MINOR-5).

Breakdown of the 17 in `v57-browser-notice`, correcting round 1's tally slightly: `R2D-3` ×6,
`R2D-1` ×4, `R2D-4` ×2, `R2D-2` ×2, `R2D-5` ×1, `R2D-9` ×1, `M3` ×1.

---

## Scope I did not reach

Capped at ~30 minutes and over it. Named rather than rushed:

- **The four-profile sweep** (chemo / radiation / both / Other, per-treatment medications, multi-day
  logging span, every screen, real CSV). Still not done — now missed by two consecutive audits. It is
  the right call for a commit that changes zero application code, but `TEAM.md` stage 3 wants it and
  the app has not had one since `AUDIT_full_app_v51.md`.
- `chemowell-beta/harness/eod-test.mjs` — still not run.
- `audit-v55`'s `A6` ("0 chips followed") and `B8` ("? " ) — confirmed red, not diagnosed. Neither is
  a count pin, so one of them may be real. Worth ten minutes from someone.
- Whether MAJOR-1's regressions were a deliberate app-v58 design decision that nobody updated the
  suite for, or an accident. I proved the code changed and that the suite has been red since; I did
  not read the app-v58 release notes for an intent statement.

---

## What I verified as good

- The three new checks are real, run against the true corpus, and go red on three of my four attack
  mutants including one the developer did not build (M4).
- `displayedText()` walks every field of a `HELP_TOPICS` entry that holds copy — enumerated, not
  assumed.
- The `|| true` at `outputs/webmain-v43/run.mjs:119` is genuinely gone; the assertion is now the one
  its name claims. No other `|| true` survives in any `.mjs`/`.js` in this repo.
- No application code changed: `index.html` and `sw.js` byte-identical to `aeec6ec`.
- `APP_VERSION = 'app-v66'` and `CACHE = 'chemowell-app-v66-1'` move together; `release_check.sh`
  exits 0.
- `git ls-files -s` reads `100755` for `release_check.sh` and `mark_published.sh`.
- The commit message is accurate about what it did and honest about what it left open. Its central
  claim — that counting raw against parsed cannot be fooled by prose — I tried to break four ways
  and could not.

---

## Recommendation

**Let app-v66 through.** It does what round 1 sent it back to do, and it does it better than the
gate it replaces.

Then, before anything else ships:
1. **MAJOR-1** — decide whether app-v58's Help-search-results revert was intended. If not, fix the
   app; if so, fix the suite. Either way it must stop being red. Its own release.
2. **MAJOR-4** — give this repo a test runner, or the next red gate hides for another nine releases.
3. **MAJOR-2** — two comment lines in `test/v57-search.mjs`.
4. **MAJOR-3** — wrap the cross-check's input in the `codeOnly()` that already exists eight lines up.
5. **MAJOR-5** and MINOR-4/5/6 to `BACKLOG.md` with owners.
