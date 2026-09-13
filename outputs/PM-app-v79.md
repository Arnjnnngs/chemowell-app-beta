# PROJECT MANAGER SIGN-OFF — app-v79

AUDITED-COMMIT: 6314bd756efed28a766c6a0ce37ef30383036dac
VERDICT: DO NOT SHIP

## NOT READY — and for one reason only

**The code is right. The chain is one step short, and it is the step this project has already
paid for.**

Everything I could check myself came back clean: the release is byte-for-byte reproducible from
the repo, all nine suites are green when I run them rather than take them on trust, and the
release note's substantive claims hold up against the file. I am not holding this for polish
and I am not holding it for anything I found in the app.

I am holding it because **the last independent look at this release was round 3, at commit
`c2bda8f`, and `index.html` changed after that** — commit `6314bd7`, round 4, which fixed the
round-3 audit's six findings. Two of those fixes land inside `afterLog`, the acetaminophen
ceiling-warning path. That is the exact place round 1, round 2 and round 3 each found a defect,
three rounds running. Round 4's code has been read by the person who wrote it and by no one else.

TEAM.md already carries this failure by name: app-v68 was gated by an audit of `51ba75f` while
`68d3dd6` shipped — "67 further lines of index.html that no auditor had ever seen" — and the gate
passed because the report was *named* for v68. `release_check.sh` was rewritten to stop exactly
that, and it is currently stopping exactly that.

**The remedy is small: a delta re-audit of `6314bd7` alone, scoped to round 4's diff.** Not a new
round, not a rebuild. Per TEAM.md that re-audit is a fresh attempt to break the whole change and
its suspects are a floor, not a ceiling; the floor here is `sharedTotalLabel`, the rewritten
singulariser, and the rewritten leak guard.

**Signing off would not have shipped it anyway.** `release_check.sh` exits 1 on the staleness
above regardless of what I write here, so "SIGNED OFF" would have been a word that changed
nothing except the record of whether anyone noticed.

---

## 1. Release mechanics — PASS

| Item | Result |
|---|---|
| `APP_VERSION` | `app-v79` (index.html:7566) |
| `sw.js` CACHE | `chemowell-app-v79-1` (sw.js:1) |
| Moved together, and match | Yes |
| README.md version-history row for app-v79 | Present, line 14, top of the table |
| HANDOFF.md contradicted? | No — line 3 "last refreshed 2026-09-13 at app-v79", line 63 "currently `app-v79`" |
| Work committed | Yes. `git status --short` is empty at HEAD `6314bd7` |
| `release_check.sh` / `mark_published.sh` exec bits | `100755` both — the app-v11 exit-126 trap is not set |
| `index.html` parses | Yes, one script block, no syntax error |

**One bookkeeping item to fix at push time, not a blocker:** `PUBLISHED.json` still records
`app-v76` as live, and `release_check.sh` says nine commits have touched `index.html` since. If
app-v77 or app-v78 were in fact pushed, `./mark_published.sh <that commit>` has to run before the
next gate, or the baseline this gate trusts is wrong in the direction that prints a green tick on
a build that never bumped its cache — the app-v40 failure wearing a checkmark, which is the whole
reason that file exists.

## 2. Reproducibility from the repo alone — PASS, proven

I rebuilt the release from scratch in a scratch directory, without touching the working tree:

    git show e310665:index.html   (the app-v78 base)
    git show e310665:sw.js
    + harness-v79-audit-fixes.py → -round2.py → -round3.py → -round4.py, in that order

All four applied cleanly and exited 0. The result is **byte-identical** to the committed files:

    index.html   b4e5db415185c56a1a331eae62bd6cd1   (rebuilt == committed)
    sw.js        da2f22d59123b7b89c92297b43989b6b   (rebuilt == committed)

The chain does what it claims. Nothing is documented-only and nothing had to be hand-edited to
make it match.

## 3. Every suite, run by me — 9/9 GREEN, 245 numbered checks

| Suite | Result |
|---|---|
| v75-no-other-patient | 26/26 — ratchet 0/0/0, pinned at 0/0/0 |
| v75-table-builder | 96/96 |
| v75-med-description-shots | all checks passed (unnumbered) |
| v76-properties-equivalence | 22/22 |
| v76-empty-window-render | 13/13 |
| v77-legacy-migration-equivalence | 36/36 |
| v78-fence-removed | 20/20 |
| v79-home-cards-render | 18/18 |
| v79-warning-priority | 14/14 |

Every one exited 0. Served from `python3 -m http.server 8899` over the repo root, so the suites
that drive a browser were reading the same `index.html` that is committed.

## 4. `bash release_check.sh` — EXIT 1

What it says, exactly:

- Baseline `PUBLISHED.json` → app-v76 at `d125967`; nine commits have changed `index.html` since.
- `❌ RELEASE CHECK FAILED: the quality chain has not run for app-v79.`
- `missing: an outputs/PM*app-v79*.md sign-off` — **this file closes that one.**
- `a report on record cannot be read, so its verdict is UNKNOWN` for **all three** audit reports:
  `AUDIT-app-v79.md`, `-round2.md`, `-round3.md`.

**Why the three reports are unreadable, and it is not a judgement call.** The gate needs each
report to open with, flush left and adjacent, exactly `AUDITED-COMMIT: <sha>` then
`VERDICT: SHIP` or `VERDICT: DO NOT SHIP`. All three instead open with a markdown title and then
`**VERDICT: BLOCK**` — bolded, and using a word the gate does not accept. So the gate reads them
as UNKNOWN, and an unknown verdict is treated as a refusal, correctly: "I cannot read this" is
never "this raises no objection."

**This is not mine to fix.** Writing a verdict line into someone else's report is forging their
signature, and the two rounds that say BLOCK would have to be written as `DO NOT SHIP` — which the
gate then only clears if a later report says SHIP against a strictly later commit. Round 3 (`PASS`,
at `c2bda8f`, a descendant of both) would supersede them cleanly. The auditor adds the three
headers.

**And when those headers exist the gate still fails**, on the staleness described at the top:
round 3 examined `c2bda8f`, and `git diff --name-only c2bda8f -- index.html` returns `index.html`.
So there is no CURRENT audit. That is the real item, and the header fix is the cheap one that has
to happen alongside it.

## 5. Does the release do what it claims?

I checked the README app-v79 row against the file, because "a release note asserting a property
the code does not have" is this project's own repeated failure and three findings in this very
release were that shape.

**Verified true:**

- `medHomeCardKind` is defined (index.html:2299) and called at 5262, 9485, 9502 — the dead Home
  screen is genuinely fixed, and `v79-home-cards-render` renders it.
- "the ceilings deliberately were not [restored]" — no `ceilingMax: 4` exists for Imodium or
  Lidocaine. The only `ceilingMax` occurrences are the editor writing the user's own number
  (6391) and deleting it when absent (6401). The comment at 1188–1200 disowns the earlier attempt
  rather than repeating it.
- "it caps at two names plus *and N more*" — index.html:1723, exactly that.
- "it now reads *the 3,000 mg daily limit these share*" — index.html:2358, exactly that string.
- "The ratchet is back to 0/0/0" — the suite prints `found 0/0/0, pinned at 0/0/0`.
- "No suite in this repo had ever asserted an `aria-label`" — `v79-home-cards-render.mjs:195` now
  does.
- "`APP_VERSION` → `app-v79`, `sw.js` CACHE → `chemowell-app-v79-1`" — both correct.

**Two sentences I cannot verify as written, and they are the same shape the release is about:**

1. *"New gate `test/v79-home-cards-render.mjs` — **12 checks**"*. The suite has **18**.
2. *"New: `test/v79-warning-priority.mjs` … **six checks** in a real browser"*. The suite has **14**.

Both were true when the sentence was written and stopped being true when rounds 3 and 4 added
checks to the same suites — the row narrates the release in order and never comes back to correct
them. A reader counting the gates gets the wrong number from the current, live document. Neither
misleads a caregiver and neither is a reason on its own to hold a release; both should be
corrected in the same pass as the audit headers, because the row's own subject is release notes
that say untrue things about the code.

Nothing else in the row overstated what I could find in the file.

## 6. What Aaron needs to be told, in plain words

- **The fix is real and it works.** The Home screen that has been crashing on the live build since
  app-v78 is genuinely repaired, and I confirmed it myself rather than taking anyone's word:
  nine test suites, 245 checks, all green, and I rebuilt the whole release from scratch out of the
  repo and got a byte-for-byte identical file.
- **It is not shipping tonight, and it is one short step, not a rebuild.** After the last
  independent reviewer approved it, one more round of changes went in — good changes, fixing what
  that reviewer found — but nobody independent has read them. Two of them sit in the Tylenol
  overdose-warning code, which is the exact spot where each of the last three reviews found a
  mistake. The reviewer needs about half an hour on that one commit.
- **Three of the review reports are also written in a format the release script cannot read**, so
  the script currently treats them as "unknown" and refuses the release on that too. That is a
  formatting fix to the reports, not to the app.
- **Nothing here can hurt anyone or lose a record.** This is a hold on process, not on safety.
- **One piece of bookkeeping:** the file that records which version is actually live still says
  app-v76. If v77 or v78 really did go out, that needs correcting or the next release's safety
  check is measuring against the wrong baseline.

## Outstanding before this can ship

1. Delta Zero Day Audit of commit `6314bd7` (round 4's diff). Cap 30 minutes.
2. Add the `AUDITED-COMMIT:` / `VERDICT:` header block to `AUDIT-app-v79.md` (DO NOT SHIP, `5eb5e42`),
   `-round2.md` (DO NOT SHIP, `f2307fd`) and `-round3.md` (SHIP, `c2bda8f`) — auditor's own hand.
3. Correct "12 checks" → 18 and "six checks" → 14 in the README app-v79 row.
4. Re-run `bash release_check.sh` and confirm exit 0.
5. Reconcile `PUBLISHED.json` against what is actually live before the push.
6. After the push: `./mark_published.sh`, commit `PUBLISHED.json`, `git fetch origin`, live-verify
   with a cache-buster.

*PM pass run 2026-09-13 against HEAD `6314bd7`. Working tree clean throughout; `index.html`,
`sw.js` and `test/` were not modified by this pass — the reproducibility rebuild ran on copies in
a scratch directory.*
