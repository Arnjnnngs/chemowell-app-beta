AUDITED-COMMIT: 9ea73a7437c42034a521e730efe340fc14950ec5
VERDICT: SHIP

# PM sign-off — app-v80, "Up next" on Home

## The one check this seat exists for: is the audited code the code being signed?

**Yes. Measured three independent ways, none of which trusts the brief or the commit messages.**

| How I checked | Result |
|---|---|
| `git diff --name-only 25889d1 HEAD -- index.html sw.js test/` | **empty** |
| `git diff --name-only 25889d1 HEAD` (everything, not just those paths) | `README.md`, `outputs/AUDIT-app-v80-round3.md`, `outputs/NEXT-RELEASE-FROM-v80.md` — **nothing else** |
| md5 of `index.html` at `25889d1` vs at HEAD | `09f24f9ffc7e706cb2870bc711b481a1` both; `sw.js` `4c66a8e2ea84ceb05f4722b4a16c90fe` both |

The second row matters more than the first. The brief asked me to check three paths; I checked the
whole tree, because `.github/workflows/verify-live.yml` is also a Rule 5 path and it **did** change
in this release. It changed at or before `25889d1`, so the round-3 audit read it — and it audited it
explicitly (its section 6). `git diff --stat 25889d1 HEAD -- .github/workflows/` is empty.

And a fourth, from outside this session: the round-3 audit's own restoration note records the file
it read as md5 `09f24f9ffc7e706cb2870bc711b481a1`. That is the md5 of the file in the working tree
right now. The auditor's record and my measurement agree.

**This is the failure that bit app-v68 and app-v79. It has not happened here.**

## The audit chain

Read, not glanced at. Each report's header is at the top of its file and parses.

| Report | Examined | Verdict | In HEAD's history? |
|---|---|---|---|
| `outputs/AUDIT-app-v80.md` | `24b4c7f` (Sep 13 22:37) | DO NOT SHIP | yes |
| `outputs/AUDIT-app-v80-round2.md` | `f42e394` (Sep 13 23:13) | DO NOT SHIP | yes |
| `outputs/AUDIT-app-v80-round3.md` | `25889d1` (Sep 14 00:48) | SHIP | yes |

`git merge-base --is-ancestor` confirms `24b4c7f` and `f42e394` are both strict ancestors of
`25889d1`, so **both refusals are cleared by a SHIP on a strictly later commit** — not by a
different desk and not by a re-run on the same tree.

The three refusals are one control, three doors, and I checked that round 3's code is what closes
the last one rather than moving it: round 2 blocked because collapsing Home's "Quick log" chevron
takes every card off the page and the hero's button then did nothing, silently, for the rest of the
session. Round 3 adds the reopen branch, and the auditor mutated it out and watched
`test/v80-up-next.mjs` drop to 37/38. A guard that cannot fail is the thing this project keeps
paying for; this one fails when broken.

## The correction in `9ea73a7`, and why it is allowed to be after the audit

The round-3 audit shipped with one required correction: the README said the missed-dose banner
needed `minWidth: 0` because *"a wrap alone would have changed nothing"*, and the auditor measured
each half on its own and found it backwards — remove `minWidth: 0` and keep the wrap, Home is clean
at 38/38; remove the wrap and keep `minWidth: 0`, Home is 620px on a 320px phone.

`9ea73a7` makes exactly that correction and touches **no code, no test, and none of the Rule 5
paths** — verified above by the whole-tree diff, not by reading its commit message. The two findings
that WOULD need code (the hero button's 22-character threshold, which should be about 14; and
`test/v80-contrast.mjs` never seeing the green all-done card) are deferred to
`outputs/NEXT-RELEASE-FROM-v80.md` rather than changed after the audit that read them. **That is the
right call and it is the rule app-v68 and app-v79 paid for.**

I confirmed both halves are actually in the shipping file: `index.html:5183` carries
`minWidth: '0'` on the banner's flex column and `index.html:5189` carries `overflowWrap: 'anywhere'`
on the line that prints the medication name. Behaviour is unaffected either way; what was wrong was
the explanation, in the row Aaron reads.

## Suites — I ran them, and the numbers are mine

`./run-all-tests.sh` from the repo root, at 01:2x–02:0x UTC on 2026-09-14.

    PASS 42   FAIL 5   COULD-NOT-START 1
      failing:      audit-v55 pm-v55 pm-v55b v57-browser-notice v74-shipped-audit-probe
      cannot start: audit-v55b

**Those six are exactly the known-red list and nothing else.** Forty-two suites green, including
every suite that touches this release. No suite went red that was not already red on app-v79.

Counted failures on this build, against what the brief claimed: `audit-v55` **3**, `pm-v55` **1**,
`pm-v55b` **2**, `v57-browser-notice` **17** (the runner prints only the first five lines, so I ran
that suite again on its own against this build to count them: 17 FAILURES — the same number it gives
on the app-v79 file), `v74-shipped-audit-probe` **3**, `audit-v55b` **cannot start**.

### Known-red, and NOT this release's — spot-checked rather than accepted

The brief handed me a list of six suites said to be red on app-v79 too. **I re-measured three of
them against the app-v79 file itself** (`git show 2f24edd:index.html` into a scratch tree, served on
a separate port, the suite copied out and repointed — the working tree was never touched):

| Suite | Claimed | Measured on the app-v79 file |
|---|---|---|
| `test/v74-shipped-audit-probe.mjs` | 3 | **3** (19/22) |
| `test/v57-browser-notice.mjs` | 17 | **17 FAILURES** (and 17 on this build too) |
| `test/pm-v55b.mjs` | 2 @360 | **2** (14 pass, 2 fail @360) |

`pm-v55b` is the sharpest of the three: on this build it fails **B3 (*"Is my data private?"*) and
B8 (*"all 133 rows opened | 135"*)**, and on the app-v79 file it fails **the same two checks with the
same two messages**. Same defect, both builds, not introduced here.

`test/audit-v55b.mjs` cannot start for a reason that is version-independent and needs no
measurement: it reads `/tmp/topics.js`, an absolute path from a sandbox that no longer exists.

`audit-v55` (3) and `pm-v55` (1) came back at exactly those counts on this build.

### The frozen clock, and the hour I ran it at

`test/v79-warning-priority.mjs` has its clock frozen at 10:00 in this release, because it was going
red after midnight on app-v79 in rounds 1 and 2. **I ran it at 01:35 UTC — inside exactly that
window — and it is 14/14.** That is the hour the freeze exists for, so this is a real test of the
fix rather than a lucky one.

### The release's own new gates, run individually

- `test/v80-up-next.mjs` — **38/38**
- `test/v80-contrast.mjs` — **10/10**
- `test/v76-empty-window-render.mjs` — **13/13**

**And one that the runner will count as green and should not be trusted as one.**
`test/v80-pixel-identity.mjs` exits 0 having printed `SKIP — this suite is a before/after comparison
and takes a directory`. I ran it myself to see. It **asserts nothing about this release**, and
`run-all-tests.sh` has no way to tell that from a pass. The app-v79 PM recorded the same thing and
was right to; a gate that cannot start is indistinguishable from one that passed, which is the
reason this repo has a `COULD NOT START` category at all. Not a blocker — it is a tool, not a
regression gate — but it is not evidence for this release.

Those are the two counts the README row claims (38 and 10). They are correct.

## Reproducibility from the repo alone

Rebuilt on **copies in a scratch directory**; `/home/user/chemowell-app-beta/index.html` was not
touched and its md5 was re-checked afterwards and is unchanged.

From `git show e310665:index.html` and `:sw.js` (base md5 `e9d5f74447e98fccc6ebd1991e05cf10` /
`8e2679b676a63660d3b7b097c7a61e47`), applying in order `harness-v79-audit-fixes.py`,
`-round2.py`, `-round3.py`, `-round4.py`, `-round5.py`, `harness-v80-up-next.py`,
`harness-v80-audit-round2.py`, `harness-v80-audit-round3.py` — all eight applied cleanly:

| File | Rebuilt | Committed |
|---|---|---|
| `index.html` | `09f24f9ffc7e706cb2870bc711b481a1` | `09f24f9ffc7e706cb2870bc711b481a1` |
| `sw.js` | `4c66a8e2ea84ceb05f4722b4a16c90fe` | `4c66a8e2ea84ceb05f4722b4a16c90fe` |

I then did it a **second time in a fresh directory** and got the same two md5s again, so the chain is
deterministic rather than order-lucky. The working tree's md5s were re-checked after both rebuilds
and are unchanged.

**Byte-identical.** `e310665` and all eight patch scripts are committed and in HEAD's history, so
this release can be reconstructed from the repo with nothing else.

## Release mechanics

- `APP_VERSION = 'app-v80'` (`index.html:7795`); `sw.js` CACHE `chemowell-app-v80-2` (`sw.js:1`).
  **They moved together** — both differ from `PUBLISHED.json`'s recorded baseline of `app-v79` /
  `chemowell-app-v79-1` at `2f24edd`.
- **`index.html` parses and runs.** I loaded it in Chromium: title `ChemoWell`, 925,208 characters of
  rendered body HTML, **zero page errors and zero JavaScript console errors**. (A regex-based check
  of the inline scripts is NOT evidence here and I am not offering it as any — `<script` appears
  inside string literals in this file, so naive extraction splits in the wrong place. The browser is
  the only honest parser for a single-file app.)
  The only console errors were four `ERR_CERT_AUTHORITY_INVALID` resource loads: the four
  `cdn.jsdelivr.net` Capacitor plugin bundles, failing because this sandbox intercepts TLS. They are
  **character-for-character identical to app-v79's** (`diff` of the extracted URLs is empty), carry
  no user data, and are not introduced by this release.
- Working tree at HEAD: clean apart from **twelve previously-modified PNGs under `outputs/`** that
  pre-date this release and the round-3 audit alike, plus the untracked `outputs/v80-audit-r3-shots/`.
  Nothing outside `outputs/` is modified. Noted, not a blocker.

## Does the release note tell the truth?

This release's own subject is release notes asserting properties the code does not have, so I
checked every number and every checkable claim in the README `app-v80` row against the file.

| Claim in the row | How I checked it | Verdict |
|---|---|---|
| `test/v80-up-next.mjs` **38 checks** | ran it | true — 38/38 |
| `test/v80-contrast.mjs` **10** | ran it | true — 10/10 |
| `APP_VERSION` → `app-v80`, CACHE → `chemowell-app-v80-2` | read both files | true |
| the `overflowWrap` is the whole fix; `minWidth: 0` is belt-and-braces | read both style objects in the shipping file; the auditor's mutation table measured 38/38 vs 620px | true as now written — this is the sentence `9ea73a7` corrected |
| Home measured **620px** on a 320px phone before the wrap | auditor measured it twice, independently of the author | accepted on the auditor's measurement, not re-measured by me |
| the header's dose ring is suppressed on Home | read `homeShowsDoseCount()` — it returns false unless Home is genuinely showing the count | true, and correctly conditional |
| **the CI gate on `main` has been red on every push since it was added** | queried GitHub Actions: the **10 most recent `verify-live.yml` runs on `main` all concluded `failure`**, including run 16 on `1772e4c`, the last push before this release | **true — verified against GitHub, not inferred** |
| the hero appends nothing, deletes nothing, writes no record | round 2's audit searched every added line for those calls and found zero — **and I re-ran that grep myself** over the hero's render region: no `addEntryDB`, `removeEntryDB`, `setPrefsDB`, `localStorage`, `sessionStorage`, `fetch(`, `XMLHttpRequest`, `logMed(` or `confirmTimeAndLog`. `scrollToMedCard` calls `setState` twice and both are UI-only (`quickLogOpen`, `medFlash`) | true |
| as-needed medications are excluded, and the hero can only name a medication with a card | read `nextDueDose()` myself: it gates on `med.alerts` (which `normalizeMedication` sets false for "as needed"), then `medHasReachableCard`, then scheduling, then the treatment blocks, then `status()` | true |

**I found no further false claim in the row.** That is a measured statement about the items in the
table above, not a guarantee about every clause in a 700-word paragraph.

One thing that is not false but will become stale: `HANDOFF.md` says the live build is `app-v79`.
That is true right now and wrong the moment this is pushed. The file already says of itself that it
goes stale and names `README.md` and `PUBLISHED.json` as the record, so this is housekeeping, not a
defect — see the post-push list below.

## `bash release_check.sh`

**Before this file existed**, exit 1, quoted exactly:

    ❌ RELEASE CHECK FAILED: the quality chain has not run for app-v80.
       Changed under rule 5: .github/workflows/verify-live.yml index.html sw.js
       missing: an outputs/PM*app-v80*.md sign-off
       AND a report on record REFUSES this release: outputs/AUDIT-app-v80-round2.md (examined f42e394) says DO NOT SHIP.
       AND a report on record REFUSES this release: outputs/AUDIT-app-v80.md (examined 24b4c7f) says DO NOT SHIP.

**With this file in place**, exit 0, quoted exactly:

    ℹ️  Baseline: PUBLISHED.json -> app-v79 (chemowell-app-v79-1) at 2f24edd
       3 commit(s) have changed index.html since that record. This gate assumes NONE of
       them are live yet. If any were already pushed, run ./mark_published.sh <that commit>
       first -- otherwise the comparison below is against the wrong build.
    ℹ️  Other reports present and not clearing this release:
         outputs/AUDIT-app-v80-round2.md — says DO NOT SHIP
         outputs/AUDIT-app-v80.md — says DO NOT SHIP
    ℹ️  Chain artifacts present for app-v80, and current against the working tree:
         outputs/AUDIT-app-v80-round3.md
         outputs/PM-app-v80.md
    ℹ️  v76-properties-equivalence.mjs: green.
    ℹ️  v76-empty-window-render.mjs: green.
    ℹ️  No-other-patient check: clean.
    ✅ Release check passed.
       index.html changed and sw.js's CACHE constant changed with it -- installed
       copies of the app will pick this up automatically on next open.

Note what the gate says about the two earlier refusals: it still sees them, still prints them, and
correctly classifies them as *"present and not clearing this release"* rather than as blockers —
because round 3 examined a strictly later commit. That is the behaviour I checked by hand above, so
the gate and I agree for the same reason rather than by coincidence.

## Verdict

**SHIP.**

The code being signed is the code that was audited, proved four ways. Three refusals were cleared by
a SHIP on a later commit, and I checked that the last fix bites rather than moves. The release is
reproducible from the repo to the byte. The version and the cache moved together. The suites are
green except for six that were already red on app-v79, three of which I re-measured on the app-v79
file myself. The one false sentence the audit found has been corrected, in documentation only.

## After the push — not optional

1. `./mark_published.sh` immediately, and commit `PUBLISHED.json`. Without it the next release's
   cache gate measures against app-v79 and can print a green tick on a build that never bumped.
2. **Watch the `verify-live.yml` run on that push.** Its Node-and-no-browser and shallow-checkout
   fixes are in this release and have never executed on a runner. If it is red again, the CI half of
   this release did not work and the gate still says nothing.
3. Refresh `HANDOFF.md`'s "currently `app-v79`" line.
4. `outputs/NEXT-RELEASE-FROM-v80.md` is where the next release starts: the button's 22 should be
   14, and the contrast suite cannot see the green all-done card.

---

## For Aaron, in plain words

**What this release does.** Home now answers *what is due next* at the top of the screen, before it
asks you for anything. One card: the medication, the dose, whether it is due now or at a time, and
the day's dose count beside it. A button on it takes you to that medication's card.

**What it fixes.** That button was broken three separate times and the independent audit caught it
all three times before anyone shipped it — including the nasty one: if you had ever tapped the
"Quick log" heading to tidy Home away, the button did nothing at all, silently, until you reloaded
the app. It works now, and I watched the new test go red when the fix was taken out, so the test is
real. The card also never names a medication the app itself says not to give, and it never logs a
dose — logging stays on the medication's own card, where the ceiling and gap checks live.

**What it does NOT fix.** A very long medication name still gets cut short on the button at small
phone sizes — the button is the right size and takes you to the right place, it just reads
"Go to Mycophenolate Mofe…". Cosmetic, written down, first item next time. And the colour-contrast
test only ever looks at the orange card, never the green "all doses are in" one.

**What needs your phone.** Two things, and only you can do them. First, open the app after the push
and look at the new card on the real device — this sandbox has Chromium only and cannot reproduce an
iPhone. Second, the automated check that runs on GitHub after every push has been failing for weeks
for reasons that had nothing to do with the app; this release fixes it, but that fix has never run
on a real runner. If it goes green on this push, that check starts being worth something again.
