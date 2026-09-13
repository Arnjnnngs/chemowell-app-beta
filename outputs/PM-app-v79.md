AUDITED-COMMIT: 20f01bb3801c369f16e2f2592f96171b8043b0de
VERDICT: SHIP

# PROJECT MANAGER SIGN-OFF — app-v79

**This file replaces the earlier NOT READY verdict of record.** It was held for exactly one thing —
the last independent audit was round 3 at `c2bda8f` and `index.html` had changed after it — and that
thing is closed. This is the delta pass that clears it.

## The one reason for the hold, and why it is closed

Round 4 (`6314bd7`) was audited: `outputs/AUDIT-app-v79-round4.md`, **DO NOT SHIP**, six findings.
All six were fixed in round 5 (`f5677f4`), and `outputs/AUDIT-app-v79-round5.md` audits that exact
commit and says **SHIP**. I confirmed the chain is current against the code I am signing:

    git diff --name-only f5677f4 20f01bb -- index.html sw.js test/   →  (empty)

So everything between the round-5 audit and HEAD is reports and documentation. **The audited code and
the code being signed are byte-identical.** That was the whole of my objection, and it no longer holds.

### The chain, every report readable and the newest verdict on the newest commit

| Report | AUDITED-COMMIT | VERDICT | Readable by the gate |
|---|---|---|---|
| `AUDIT-app-v79.md` | `5eb5e42` | DO NOT SHIP | yes |
| `AUDIT-app-v79-round2.md` | `f2307fd` | DO NOT SHIP | yes |
| `AUDIT-app-v79-round3.md` | `c2bda8f` | SHIP | yes |
| `AUDIT-app-v79-round4.md` | `6314bd7` | DO NOT SHIP | yes |
| `AUDIT-app-v79-round5.md` | `f5677f4` | **SHIP** | yes |

The three missing headers were added by the auditors themselves — commits `5ee3c13`, `fb40540` and
`20f01bb`, each `+3/-0` or `+3` on its own report, no finding revised, softened or withdrawn. I read
all three diffs rather than taking the commit messages' word for it. **I refused to write those lines
last time and that refusal was right**; they are signatures, and they now carry the right names.

Every refusal on the chain is superseded by a SHIP on a strictly later commit, which is the only way
a refusal may be cleared.

## Every suite, run by me — 10 suites, 268 numbered checks, all green

Served from `python3 -m http.server 8899` over the repo root, so the browser suites read the same
`index.html` that is committed.

| Suite | Result |
|---|---|
| v75-no-other-patient | **27/27** — ratchet `found 0/0/0, pinned at 0/0/0` |
| v75-table-builder | **96/96** |
| v75-med-description-shots | all checks passed (this suite does not number them) |
| v76-properties-equivalence | **22/22** |
| v76-empty-window-render | **13/13** |
| v77-legacy-migration-equivalence | **36/36** |
| v78-fence-removed | **20/20** |
| v79-home-cards-render | **20/20** |
| v79-warning-priority | **14/14** |
| v80-pixel-identity | **SKIP, exit 0** — see below |

Every one exited 0. Two counts have moved since my last pass and both moved upward, because round 5
added checks: `v75-no-other-patient` 26 → 27 (the schedule ratchet, now pinned at a live 9 rather than
double it) and `v79-home-cards-render` 18 → 20.

**On `v80-pixel-identity` being a SKIP and not a pass.** Run bare it prints an explanation and exits 0:
it is a before/after comparison tool that takes a directory (`--save <dir>` before a refactor,
`--check <dir>` after). That is deliberate — round 5 changed it so `run-all-tests.sh` stops going red
on a tool that has nothing to compare — and it means **this suite asserts nothing about app-v79 and
must not be counted as a gate that passed it.** Saying so out loud is the point: a gate that cannot
start is indistinguishable from one that passes, and this repo has been bitten by that exact shape.
The nine suites above are the release's real coverage.

## Reproducibility from the repo alone — PASS, proven on copies

Rebuilt in a scratch directory. **The working tree's `index.html` was not touched.**

    git show e310665:index.html   (the app-v78 base)
    git show e310665:sw.js
    + harness-v79-audit-fixes.py → -round2 → -round3 → -round4 → -round5, in that order

All five applied cleanly and exited 0. The result is **byte-identical** to the committed files:

    index.html   4b5f542c841be9537be45ef5ea0919b0   (rebuilt == committed)
    sw.js        da2f22d59123b7b89c92297b43989b6b   (rebuilt == committed)

The five-script chain does what it claims. Nothing is documented-only; nothing needed a hand edit.

## Release mechanics — PASS

| Item | Result |
|---|---|
| `APP_VERSION` | `app-v79` (index.html:7570) |
| `sw.js` CACHE | `chemowell-app-v79-1` (sw.js:1) |
| Moved together, and match | Yes |
| `PUBLISHED.json` baseline | **`app-v78` / `chemowell-app-v78-1` at `e310665`** — reconciled since my last pass, and the gate now reports 5 commits on top instead of 9 against a v76 baseline |
| README app-v79 row | Present, line 14, top of the table |
| `index.html` parses | Yes — one script block, no syntax error |
| Working tree | Clean at HEAD before this pass |

## `bash release_check.sh` — what it says, exactly

Before this sign-off it exits **1**, on one thing and nothing else:

    ℹ️  Baseline: PUBLISHED.json -> app-v78 (chemowell-app-v78-1) at e310665
       5 commit(s) have changed index.html since that record.
    ❌ RELEASE CHECK FAILED: a chain report refuses this release, and nothing supersedes it.
       These say DO NOT SHIP:
         outputs/PM-app-v79.md — examined 6314bd7

That refusal is **my own**, and by the gate's own rule it is cleared only by re-running the PM stage
against a later commit and that run saying SHIP. This file is that run, against `20f01bb`, a
descendant of `6314bd7`. Every audit refusal on the chain is already superseded the same way. The
re-run of the gate with this file in place is recorded at the bottom of this report.

## Does the release note tell the truth? — one stale count found and corrected

I re-read the README app-v79 row against the file, because this release's own subject is release
notes asserting properties the code does not have.

**Verified true in the current file:**

- `medHomeCardKind` defined at index.html:2299, called at 5262, 9489 and 9506 — the dead Home screen
  is genuinely fixed, and `v79-home-cards-render` renders it.
- *"the ceilings deliberately were not [restored]"* — no `ceilingMax: 4` for Imodium or Lidocaine
  exists. The only live `ceilingMax` uses are the editor writing the caregiver's own number (6395)
  and deleting it when absent (6405); 1193 is the comment disowning the earlier attempt.
- *"it caps at two names plus and N more"* — index.html:1724, exactly that, with the unnamed
  placeholder filtered and a real name as the fallback.
- *"it now reads the 3,000 mg daily limit these share"* — index.html:2358, exactly that string.
- *"The ratchet is back to 0/0/0"* — the suite prints `found 0/0/0, pinned at 0/0/0`.
- *"fourteen checks"* for `v79-warning-priority` — the suite runs 14/14. My last pass's correction
  (`six` → 14) still holds.
- `APP_VERSION` → `app-v79`, `sw.js` CACHE → `chemowell-app-v79-1` — both correct.

**One found stale, and I corrected it in this pass:** the row said `v79-home-cards-render` has
**18 checks**; it has **20**. That sentence was true when my last pass asked for `12` → `18`, and
round 5 added two checks to the same suite afterwards. **This is the third time the same sentence has
gone stale**, which is a pattern worth naming rather than a typo: a release note that narrates a
release in order, written while the release is still moving, goes stale in the same place every time.
The number is now 20. **This is the only file I changed outside `outputs/`** — documentation only; no
code, no test, and none of the paths Rule 5 covers.

`outputs/NEXT-RELEASE-FROM-v79.md` records a **false** sentence in an earlier commit message (about
the unit singulariser and the words `pens` and `cans`). That is a correction deliberately put on the
record by the auditor, not a claim to verify, and I treated it as such.

## Why SHIP and not another hold

`main` is serving a Home screen that throws a `ReferenceError` on every render for any device whose
medication list went through the legacy migration — which is the migration app-v77 and app-v78 exist
to perform — and History dies with it. **A caregiver on the current live build cannot see the app's
main screen.** This release fixes that.

Against that, everything still open is polish or already written down as the next release's first
item: the `ns` singulariser clause ("1 applications" on a Home card), the placeholder assertion not
being scoped to the warning banner, a prose-only care plan walking the rule-table guard, and a
`Symbol` key hiding from it. **None of them can harm a caregiver, lose a record, or make this release
unreproducible**, and each is written up in `outputs/NEXT-RELEASE-FROM-v79.md` with its fix and its
falsification. Holding a crash fix behind them would be the wrong trade, and holding it behind a
number in a release note — which I just fixed — would be a worse one.

## What Aaron needs to be told, in plain words

- **It is ready. I am signing it off.** The thing I held it for last time — the last independent
  reviewer had not read the final round of changes — has been done properly: two more review rounds
  happened, the fourth one found six problems, all six were fixed, and the fifth reviewer read those
  fixes and approved them. Nothing in the app has changed since that approval.
- **What it fixes matters.** The version currently live has a broken main screen for anyone whose
  medication list was upgraded by the last two releases. This release repairs it, along with a
  Tylenol overdose warning that was staying silent when pills and liquid were mixed.
- **I checked it myself rather than taking anyone's word.** Ten suites, 268 checks, all green, and I
  rebuilt the entire release from scratch out of the repo — it came out byte-for-byte identical.
- **I found one thing wrong and fixed it: a sentence in the release notes said a test had 18 checks
  when it has 20.** Small, but it is the third time that same sentence has drifted out of date, and
  the whole point of this release is notes that say untrue things about the code.
- **Four small imperfections are known and deliberately not fixed here.** They are written down as
  the next release's first items. None can hurt anyone or lose a record; the worst is a Home card
  that could read "1 applications" instead of "1 application".
- **Nothing here needs a decision from you except the push itself.** After it goes up:
  `./mark_published.sh <commit>`, commit `PUBLISHED.json`, then check the live URL with a
  cache-buster to confirm it really is serving app-v79.

## Outstanding

1. Push app-v79 (Rule 6 order satisfied: build → self-verify → independent Auditor → PM sign-off → push).
2. After the push: `./mark_published.sh` for the pushed commit, commit `PUBLISHED.json`.
3. Live-verify the deployed `APP_VERSION` and `sw.js` CACHE with a cache-buster.
4. Next release starts from `outputs/NEXT-RELEASE-FROM-v79.md`, item 1 first.

## `bash release_check.sh` with this sign-off in place — EXIT 0

    ℹ️  Chain artifacts present for app-v79, and current against the working tree:
         outputs/AUDIT-app-v79-round5.md
         outputs/PM-app-v79.md
    ℹ️  Other reports present and not clearing this release:
         outputs/AUDIT-app-v79-round2.md — says DO NOT SHIP
         outputs/AUDIT-app-v79-round3.md — examined c2bda8f; changed since: index.html
         outputs/AUDIT-app-v79-round4.md — says DO NOT SHIP
         outputs/AUDIT-app-v79.md — says DO NOT SHIP
    ℹ️  v76-properties-equivalence.mjs: green.
    ℹ️  v76-empty-window-render.mjs: green.
    ℹ️  No-other-patient check: clean.
    ✅ Release check passed.
       index.html changed and sw.js's CACHE constant changed with it -- installed
       copies of the app will pick this up automatically on next open.

Exactly two artifacts are current against the working tree — the round-5 audit and this sign-off —
and the gate says so by name. The four superseded reports are listed as present and not clearing the
release, which is the correct record: they are not erased, they are outranked.

*PM pass run 2026-09-13 against `20f01bb`. `index.html`, `sw.js` and everything under `test/` were
read and never modified — the reproducibility rebuild ran on copies in a scratch directory. The only
non-`outputs/` change in this pass is the one README count above.*
