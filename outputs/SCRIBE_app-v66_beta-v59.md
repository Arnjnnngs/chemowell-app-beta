# Scribe — app-v66 and beta-v59

**Independent documentation check. 2026-08-25. Branch `claude/caretracker-chemowell-updates-k80ydk` in both repos.**
I did not write this code or these docs. Every claim below was checked against the diff, and every
testable claim was tested.

---

## The short version, for Aaron

**The numbers in the documents are right. Nothing is exaggerated, nothing describes a change that
did not happen, and both apps are still safely un-shipped. But the write-up of app-v66 stops one
round too early — it does not mention the three corrections made in the final round of work — and
the beta's handbook still tells the next person to number the beta wrongly and to look for a warning
banner that no longer exists.**

Five things need attention. None of them is a defect in the app itself. Both apps are untouched
where it matters: the only change to the ChemoWell app's code is one hidden search word and a
version number.

---

## What I verified as CORRECT

Everything in this list I checked myself rather than took on trust.

**Version numbers — correct and consistent in both repos.**

| | app-beta | beta |
|---|---|---|
| `APP_VERSION` in `index.html` | `app-v66` | `beta-v59` |
| `CACHE` in `sw.js` | `chemowell-app-v66-1` | `chemowell-beta-v59` |
| Version-history row | `app-v66` / `chemowell-app-v66-1` | `beta-v59` / `chemowell-beta-v59` |
| Any other mention | none | none |

**Every test count quoted in the docs is real. I ran all six suites.**

| Suite | Doc claims | I measured |
|---|---|---|
| `test/v57-search.mjs` | ALL GREEN | **ALL GREEN**, 53/53 exact, 0 failures |
| `test/v59-para.mjs` | 15/15 | **15/15** |
| `test/v64-logger.mjs` | 23/23 | **23/23** |
| `test/v63-encrypted-backup.mjs` | 22/22 | **22/22** |
| `harness/beta-isolation-test.mjs` | 9/9 | **9/9** |
| `harness/eod-test.mjs` | 11/11 | **11/11** |

**The md5 hashes are correct.** `a42c2f53998615069a1acd30f13a3546` is quoted in `BETA_STATUS.md:53`,
`BETA_HANDOFF.md:644` and `BETA_README.md:38`. I computed it: `md5sum index.html` returns exactly
that. All three agree with each other and with the file.

**The beta rebuilds byte-for-byte from production, which is a stronger claim than the docs make.**
I re-ran `harness/betaify-patch.py` against care-tracker `4d6df42` (production v59) on a fresh copy.
All nine isolation steps applied clean, every safety post-condition passed, and the output md5 was
`a42c2f5…` — identical to the shipped beta file. "Parity is true by construction" is not a figure of
speech; it reproduces. The claim of "all nine isolation edits" is also exactly right (seven text
edits plus two generated steps, printed as steps 1–9 by the script).

**`sw.js` really is production's, with only the cache name changed.** `diff` against
`4d6df42:sw.js` shows one differing line: `caretracker-v59` → `chemowell-beta-v59`. Nothing else.

**The new gates can actually fail — I broke them four ways and watched them go red.**

| Mutant I built | Result | Doc claim it tests |
|---|---|---|
| Reworded the care-team disclaimer | `V57-1` **RED** | "Falsified by breaking the sentence" ✓ |
| Added a visible `"Litres drained"` outside the Help corpus | cross-check **RED** (2 raw vs 1 parsed) | the "coverage hole … closed before shipping" ✓ |
| Deleted the `litres` search alias | **3 checks RED** | the alias check and the exact-hit check ✓ |
| Added a source *comment* containing "litres" | **stays GREEN** | the round-3 `codeOnly()` fix ✓ |

Mutant 3 also independently confirms the corrected story: with the alias gone, `litres` returns
`proc-para` **first**, at quality **0.65**, and drags `faq:weight-reason` in with it. That is exactly
what the README now says, and the opposite of the retracted claim. **The retracted claim is gone
from every file it should be gone from** — I searched `test/`, `README.md` and `BACKLOG.md` for it
and it survives only inside the two audit reports, where it is quoted as the thing being retracted.
That failure has been genuinely closed.

**The claims about what was NOT done all hold.**
- `PUBLISHED.json` still reads `"app_version": "app-v65"`, `"cache": "chemowell-app-v65-1"`. It has
  **not** been quietly bumped.
- Neither repo's HEAD is on `main`. app-beta is 5 commits ahead of `origin/main` (which sits at the
  app-v65 publish); beta is 1 commit ahead of `origin/main` (which sits at beta-v52).
- Nothing has been pushed. No doc anywhere claims app-v66 or beta-v59 is live.

**Other spot-checks that came back clean:** the `|| true` really was removed from
`outputs/webmain-v43/run.mjs:119`; `PARA-0` really was deleted from `v59-para.mjs` (with the reason
written into the file); `npm test` really is a stub that exits 1; `audit-v55b.mjs` really does read
`/tmp/topics.js`; `audit-v55`, `pm-v55` and `pm-v55b` really do pin `133`; `sw.js:20` really does
delete every cache that is not its own; `TEST_MODE` is set exactly once in the beta; the BACKLOG
colour bisect (3 at `32b297f`, 1 at `9155fd3`, 1 today) reproduces exactly.

---

## Discrepancies

### BLOCKER-1 — `BETA_HANDOFF.md` still tells the next person to number the beta the old way, in a step-by-step recipe

The header edit at the top of the file is accurate and well done: it correctly marks the obsolete
feature list as a historical record, and correctly says the "prod version + 1" convention no longer
applies. **But the file repeats that obsolete convention twice more, unmarked, and one of them is an
instruction someone will follow.**

- **`BETA_HANDOFF.md:918`**, in section 11's *"Bump the version"* recipe:
  > "This repo's new version = that number **+ 1** (or +1 again if testing is already ahead…)"

  Production is at v59. Follow this recipe and you name the next beta `v60`. The actual convention,
  per the header of the same file, produces `beta-v59` today and `beta-v60` only when production
  ships v60. The header says the stale convention is "left in place only because BETA_README.md
  still describes it" — that is not accurate; **this file describes it too, in its own how-to.**

- **`BETA_HANDOFF.md:618`**, introducing the version history:
  > "this repo uses `vN` numbers matching production's scheme, **offset one ahead while testing
  > leads**"

  Directly contradicted by the header, and sitting six lines above the new `beta-v59` entry that
  does not follow it.

### BLOCKER-2 — the beta's troubleshooting steps describe a banner and a cache name that no longer exist

`BETA_HANDOFF.md:922–925`, *"Debug the live testing app"*:
> "2. …check SW status (`caretracker-testing-vN`).
>  3. Confirm the orange **"🧪 Testing app"** banner is visible — if it's missing, `TEST_MODE` may
>  have been accidentally flipped, which is a serious bug (would point this app at prod's
>  collection)."

Both are false as of this build. The cache is `chemowell-beta-v59`, and the banner reads
**"BETA — TEST DATA ONLY. Nothing logged here reaches the real app."** (`index.html:2783`). The
header edit corrected this exact sentence at the top of the file and left this copy of it standing —
**the same shape as the "litres" failure this release exists to fix: corrected in one place, left as
fact in another.**

This one has teeth because of what the step tells you to conclude: someone following it would look
for a banner that does not exist, find it missing, and conclude the app is pointed at the patient's
real data. That is a false alarm on the single most safety-relevant property this repo has. (The app
itself is fine — the isolation suite is 9/9 and I re-derived the build from production myself.)

Both BLOCKERs are **pre-existing text, not introduced by this release.** They become contradictions
rather than mere staleness *because* the header edit landed. Since the brief asked specifically
whether that edit left the file contradicting itself: it did, in three places.

### MAJOR-1 — the README describes round 2 of the release, and stops there

The final commit (`5f5b8ee`, round 3) made three real corrections. **None of them appears in the
`app-v66` README row or in `BACKLOG.md`.** I searched both for "codeOnly", "comment", "false
positive" and "round 3": no hits.

1. The cross-check was changed to strip comments first (`codeOnly(html)`), because a source comment
   containing "litres" turned the gate red for no defect. That is a real fix to a gate the README
   spends a paragraph describing — and the README still describes the round-2 version of it.
2. The retracted false claim was deleted from `test/v57-search.mjs`, where it had survived eight
   lines above its own correction.
3. The description of the killer mutant was corrected (an unbalanced `[` makes the suite *throw*,
   not fail).

The README also still says **"All three falsified against three separate mutants."** The round-2
count. The round-3 auditor built a fourth (a visible "Litres" in a Help category blurb) that the
developer had not, and it was caught. As written, the row reads as though the release ended at
round 2 — which is the same failure mode as a fix that lives only in a commit message.

### MAJOR-2 — `BETA_README.md` presents the retired versioning rule as current, with no marker

`BETA_README.md:22–32`, a section headed **"Versioning (matches production, offset ahead)"**, still
states as present-tense fact: *"This repo's version number is **(current live production version) +
1** while testing carries features prod doesn't have yet."* Twelve lines below it, the version
history's newest row is `beta-v59` against production v59 — the section and the table disagree on
the same page.

The `BETA_HANDOFF.md` header *acknowledges* this gap, which is honest. But acknowledging it in a
different file does not stop a reader of `BETA_README.md` from acting on it, and this release edited
`BETA_README.md` anyway (to add the row), so the marker could have gone in at the same time.

Related and smaller: the file's title is still **"⚠️ CareTracker TESTING"**, a name retired by the
v71 rebrand recorded in its own table.

### MINOR-1 — "all 20 browser suites" is 19

The README says *"all 20 browser suites in this repo hardcoded a playwright path."* I checked every
file: **19 of the 20 files in `test/` had the pinned path and 19 now carry the candidate list.**
The twentieth, `test/v57-search.mjs`, contains no reference to playwright at all — it is a
parse-and-run suite, not a browser suite, which is precisely why the new spelling checks were moved
into it. `BACKLOG.md`'s "Twenty browser suites exist" has the same off-by-one.

### MINOR-2 — "3 new checks" in `v57-search.mjs` is 6

The README's test line reads *"`test/v57-search.mjs` ALL GREEN (3 new checks…)"*. The diff adds
**six** assertions: three spelling checks (visible / keyed / raw-vs-parsed) and three search-quality
checks (exact hit, resolves alone, American spelling unaffected). The row's own prose describes all
six; only the summary count undercounts them.

### MINOR-3 — a line reference in BACKLOG is one off

`BACKLOG.md` places the care-team-strip regression at `index.html:6981`. Line 6981 is `searchCard(),`;
the strip with the reverted `#FFFFFF` background is at **6982**. The second reference (`:6994-6998`)
is right to within a line. Both findings themselves are real and reproduce.

### MINOR-4 — the executable-bit restore is undocumented

This release also flipped `release_check.sh` and `mark_published.sh` back from `100644` to `100755`
(`git diff --summary` confirms; `git ls-files -s` now reads `100755` for both). `TEAM.md` treats this
mode drift as a known, release-breaking trap that has bitten before. It is a real change to release
mechanics and it is in no version-history row.

### MINOR-5 — plain language: the app-v66 row is not readable by Aaron

The row is a single ~700-word paragraph inside one table cell. It requires the reader to hold
`/keywords:\s*\[[^\]]*\]/g`, `helpFuzzy()`, `helpSearch('litres')[0] === 'proc-para'`, "parses
`HELP_TOPICS` into a VM", a `0.65` versus `1.0` quality score, and three separate rewrites of the
same gate. `TEAM.md` and the project's own communication rule ask for plain words and short
sentences for a non-technical reader; this is a developer's engineering note.

The headline — *"A stale safety gate, unpinned"* — is jargon on both counts ("stale gate",
"unpinned"). Something like *"A safety check had been broken for eight releases and nobody
noticed — the app was fine, the check was not"* says the same thing and can be read once.

**Credit where it is due, and this matters:** the row is **not** misleading about impact. It leads
with a failing *safety* check, which is the sort of phrase that could frighten an owner, and it
answers that within two sentences — *"The app was never unsafe: the disclaimer and the one-tap route
to `sym-severe` are both present and always were."* I confirmed that independently: `V57-1` passes on
the shipped build and both properties are in the source. The BACKLOG entry does the same thing
("**This is NOT a safety failure**"). That is the right instinct, applied consistently.

---

## Every entry checked for the opposite failure — describing something that did not happen

This is the failure named in my brief, so I checked each substantive assertion in the two version
rows and the seven BACKLOG items against the diff or by running it. **I found no entry describing a
change that did not happen.** The app-v66 row's claim of eight red releases (v58–v65) is arithmetically
right and the reworded sentence is in the file at line 6984. The beta row's "seven releases of drift"
(v53–v59 against a beta at v52) is right. The seven BACKLOG items are all reproducible.

The one thing the docs *understate* rather than overstate is the size of the code change: the entire
change to the ChemoWell app is **one keyword string** (`"liters"` → `"litres"` in the paracentesis
topic's hidden search words), plus the two version constants. Everything else in app-v66 is test and
documentation work. The README row never says this plainly, and it is the sentence Aaron would most
want first.

---

## Not reached, named rather than rushed

- I did not verify the BACKLOG's "actual 135" topic count against the pinned 133 — I confirmed the
  `133` pins exist in all three named suites, but not the true current figure.
- I did not run the other 14 browser suites, so I did not independently re-confirm the auditor's
  "15 green, 5 red" or the 17 `v57-browser-notice` failures.
- I did not verify the "39 hardcoded playwright paths" figure across all three repos precisely; my
  count of files carrying the old string comes to 38–44 depending on whether `outputs/` scripts are
  included. It is approximately right; it is not exact.
- I reviewed the two audit reports only for the claims the version rows depend on, not end to end.

---

## Recommendation

Nothing here blocks the code. The app is untouched apart from one hidden search word, every quoted
number is real, and both builds are reproducible. What needs a pass before this ships is the writing:

1. Fix `BETA_HANDOFF.md:918` and `:618` (the version-numbering recipe) and `:922–925` (the banner and
   cache name in the debug steps) — same treatment as the header got: mark, don't delete.
2. Add a marker to `BETA_README.md`'s Versioning section.
3. Extend the `app-v66` README row to cover round 3, and correct "three mutants" to four.
4. Correct "20 browser suites" → 19 and "3 new checks" → 6.
5. Rewrite the row's opening for a non-technical reader, and lead with the fact that one hidden
   search word is the whole app change.

Items 1 and 2 are the ones that will cost somebody real time if they are left.
