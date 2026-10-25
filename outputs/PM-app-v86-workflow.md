AUDITED-COMMIT: 2af4d54
VERDICT: SHIP

# PM sign-off — app-v86 workflow pin (`verify-live.yml`)

Desk: Project Manager. Scope: commit `2bccd13` (the runner pin) and `2af4d54` (the Auditor
report that cleared it). Branch `claude/caretracker-team-review-i83ik2`, HEAD `2af4d54`.

## Headline

Signed off. This is a one-line change to the machine a gate runs on, with sixteen lines of
comment around it, and **no application code moved at all**. I re-derived the Auditor's central
claim myself by two independent methods rather than taking it on trust, and it holds exactly.
The gate is not softened anywhere: same six steps, same order, `fetch-depth: 0` intact, chain
check still ahead of the live fetch, nothing gained `continue-on-error`, an `if:`, or a new
`|| true`.

I accept the out-of-chain push **narrowly, on the specific properties of this change**, and I do
not accept the reasoning that was given for it. Section 3 says why, and names what should
replace the reasoning — because this is the second workflow change this year pushed on it, and a
reason used twice is a practice, not an exception.

## 1. The central claim, re-derived

Method A — strip every comment and blank line from both sides of `git diff 9c0c030 2bccd13` and
diff what is left. Result: one hunk, one line.

        10c10
        <     runs-on: ubuntu-latest
        >     runs-on: ubuntu-24.04

Method B — parse both versions with `yaml.safe_load`, coerce keys to strings, sort, and walk the
two trees node by node. A textual strip can be fooled by a reformat; a tree walk cannot.

        semantic differences: 1
          /jobs/verify/runs-on
            old: 'ubuntu-latest'
            new: 'ubuntu-24.04'

One changed value in the entire parsed document. That rules out a reordered step, a dropped
`with:`, or an altered `run:` body hiding inside the comment block. `git diff --stat` reports
17 insertions and 1 deletion in one file, which reconciles: 16 comment lines plus the one
replaced line.

## 2. The gate is not softened — checked as its own question

A "fix the CI" commit is the natural place to hide a weakened check, so I looked for that
specifically rather than inferring it from the line count.

| Property | Before `2bccd13` | After | Verdict |
|---|---|---|---|
| Step count and order | 6: checkout, setup-node, browser install, chain check, read expected, poll live | identical | unchanged |
| `actions/checkout@v4` `with:` | `{fetch-depth: 0}` | `{fetch-depth: 0}` | intact |
| Chain check before live fetch | step 4 before step 6 | step 4 before step 6 | intact |
| `continue-on-error` anywhere | none | none | unchanged |
| `if:` on any step or the job | none | none | unchanged |
| `|| true` occurrences | 3 | 3 | unchanged |
| `set -e` / `set -u` lines | 4 (`-euo` ×2, `-uo` ×2) | 4, same four | unchanged |
| `exit 1` occurrences | 2 | 2 | unchanged |
| `release_check.sh` invocation | `if ./release_check.sh; then` | identical | unchanged |
| Secrets, env, tokens in file | none | none | unchanged |

The three `|| true` are all pre-existing and none sits on a check: one is on `chmod +x`, two are
on `curl` captures in the poll loop whose emptiness is then explicitly compared and, on failure,
falls through to `exit 1`. Swallowing the curl error is how the loop distinguishes "not deployed
yet" from "deployed wrong", which is the behaviour the surrounding comment asks for.

All three workflow files parse. `verify-live.yml` is the only one that moved.

## 3. The out-of-chain push — accepted here, and the reasoning rejected

Rule 6 is not ambiguous: build → self-verify → independent Auditor → PM sign-off → push, and
*never push first and audit after*. `.github/workflows/` is named in Rule 5. `2bccd13` went to
`main` ahead of both desks. That is a departure and the commit message says so, which is the
one thing it got right — a declared departure can be reviewed; a silent one cannot.

**Why I accept it in this instance.** Not because it is small; Rule 5 has no size exception and
that exception is exactly what let a broken plugin bundle sit live from app-v47 to app-v49.
I accept it because of three properties of *this* change that are checkable rather than asserted:

1. **It cannot reach a user.** `index.html`, `sw.js`, `package.json`, `capacitor.config.ts` and
   `sync-backend/` are all byte-identical. Nothing in the shipped app or the Android build is
   touched. The worst case of a wrong `runs-on` value is that the gate stays dead — which is
   where it already was.
2. **The gate was dead, not merely red.** It was dying in the browser install in 14 seconds,
   before the chain check and before the live fetch. Nothing working was being bypassed, because
   nothing was working. A push that cannot make the state worse is in a different category from
   a push that trades a known-good state for an unreviewed one.
3. **The chain did then run, against the pushed commit, both halves.** An Auditor pass at
   `2bccd13` and this sign-off at `2af4d54`. Late is materially worse than early, but it is not
   the same as absent.

**Why I reject the reasoning.** The commit message argues that the change cannot be verified by
reading, so the verification that counts is the job's behaviour. Half of that is true and the
half it skips is the half Rule 5 exists for. Nobody here can confirm from a sandbox that
`ubuntu-24.04` is still offered or that Playwright 1.56.1 supports it — that is genuinely
empirical and the audit correctly labels it INFERRED. But *every single thing in my section 2
table was established by reading*, in under ten minutes, with no network. The adversarial review
was always available; only the empirical half was not. "Unverifiable by reading" justified
deferring the live-behaviour confirmation. It did not justify skipping the desks.

**And the shortcut cost more than the chain would have.** Because `.github/workflows/` is a
Rule 5 path, `2bccd13` put all six standing app-v86 chain reports into drift, turned
`release_check.sh` red for the whole release, and required two further chain passes to undo —
one Auditor, one PM — plus this report. Pushing before the chain produced *more* process than
pushing after it, one commit later. That is the argument that should be made next time, because
it is arithmetic rather than principle.

### The rule for next time

Second occurrence on the same reasoning means a promise is the wrong output. This repo's own
pattern is to turn a promise into a mechanism — `release_check.sh` exists because "a rule
enforced only by the person it constrains is the one that gets skipped". Two mechanisms, to land
together in one chained commit:

- **A runner-pin ratchet.** `release_check.sh` refuses any file under `.github/workflows/` whose
  `runs-on` ends in `-latest`. That is the actual root cause, it is mechanical, it is the same
  shape as the reserved-med-id and delete ratchets already in this repo, and it forces the
  `android-build.yml` exposure to be dealt with rather than logged.
- **A softening ratchet.** Pin the counts measured above — zero `continue-on-error`, zero `if:`
  on a check step, exactly three `|| true` and none of them on a line invoking
  `release_check.sh` or `node test/`. This converts "a fix-the-CI commit is where a softened
  check would hide" from something an auditor has to remember to look for into something the
  gate refuses. The Auditor caught it this time; the next one should not have to.

Until those exist, the standing rule is: a workflow commit may precede the chain **only** when
all three of my acceptance properties above hold and the commit message asserts each by name —
no app-path change, the gate already dead, and both desks run in the same working session. Any
one of them missing, and it waits.

## 4. Nothing about the app moved

        git diff 86c1acc 2af4d54 -- index.html sw.js   -> empty

Confirmed by content hash rather than by the diff alone:

| | `index.html` | `sw.js` |
|---|---|---|
| at `86c1acc` (prior PM sign-off) | `1d5f3004caac466e904b65f5d06ae7c7` | `3a60dd3a758f2b3ac8f5090971ee8e3f` |
| at `2af4d54` (HEAD) | `1d5f3004caac466e904b65f5d06ae7c7` | `3a60dd3a758f2b3ac8f5090971ee8e3f` |
| working tree | `1d5f3004caac466e904b65f5d06ae7c7` | `3a60dd3a758f2b3ac8f5090971ee8e3f` |

Stated plainly: **the app-v86 work the previous desk signed off at `86c1acc` is untouched, and
what I am signing off is a workflow file and nothing else.** This sign-off does not re-open, and
must not be read as re-opening, any question about app-v86's own code. `APP_VERSION` is
`app-v86`, `CACHE` is `chemowell-app-v86-1`, and `PUBLISHED.json` records app-v86 live at
`a62069b` — all consistent.

The full set of files between `86c1acc` and `2af4d54` is six: `verify-live.yml`,
`PUBLISHED.json`, `REQUESTS.md`, and three files under `outputs/`. Only the first is a Rule 5
path.

## 5. Drift audit — no report is stale for any reason but this one

Asked to check whether any app-v86 report drifted for a reason other than `verify-live.yml`.
Measured each report's declared commit against HEAD over the Rule 5 path set:

| Report | declared at | Rule 5 paths changed since |
|---|---|---|
| `AUDIT-app-v86.md` | `5d54e2e` | `verify-live.yml`, `index.html` |
| `AUDIT-app-v86-delta.md` | `0f73911` | `verify-live.yml`, `index.html` |
| `AUDIT-app-v86-delta2.md` | `5ae0f67` | `verify-live.yml`, `index.html` |
| `AUDIT-app-v86-delta3.md` | `4d6db99` | `verify-live.yml` |
| `PM-app-v86.md` | `3c167cb` | `verify-live.yml` |
| `PM-app-v86-delta.md` | `86c1acc` | `verify-live.yml` |
| `AUDIT-app-v86-workflow.md` | `2bccd13` | none |

**No anomaly.** The two newest reports — the Auditor at `4d6db99` and the PM at `86c1acc`, which
are the pair that actually cleared app-v86 — drift on `verify-live.yml` alone. The three older
rounds additionally show `index.html`, which is app-v86's own later fixes landing after those
rounds examined it; that is ordinary within-release supersession, and later reports examined
exactly that work. Three reports say do-not-ship; the gate's supersession loop did not fire on
any of them, which I checked is correct — each is answered by a strictly-later report at the
same desk, and `2af4d54` is a descendant of all three.

## 6. The two advisory findings — I agree with the sequencing, neither blocks

**`android-build.yml` still on `ubuntu-latest`, both jobs.** Confirmed: `build` at line 31 and
`emulator-smoke` at line 142. I agree with the Auditor that this is real exposure — the
`emulator-smoke` job hand-writes a udev rule for `/dev/kvm` and boots an API-33 system image via
`reactivecircus/android-emulator-runner@v2`, which is the most platform-coupled thing in the
repo, and the file's own comments record it already being broken once by an unpinned default
moving underneath it. **It does not block, for a reason the sequencing argument alone does not
give: it is exposed, not failing.** Nothing is currently red, no APK is currently wrong, and a
failure there produces "no APK" discovered at build time, not a bad artifact reaching anyone.
Fixing it now would put the fresh audit at `2bccd13` and this sign-off straight back into drift
and force a third round on a non-urgent change. Correct call. It should be the next commit after
this release closes, with its own chain, and I would fold it into the same commit as the
runner-pin ratchet in section 3 — the ratchet would refuse `android-build.yml` anyway, so they
are one piece of work, not two.

**Playwright pinned in one npm install line with no ratchet.** Confirmed independently:
`playwright@1.56.1` appears exactly once in the repo, at line 63 of `verify-live.yml`.
`package.json` carries eight Capacitor dependencies and `typescript` only — no Playwright entry,
dev or otherwise — while 47 files under `test/` reference Playwright. So the version agreement
the comment asserts is held by a comment. **Does not block**: it is pre-existing, this commit
neither created nor worsened it, and bumping Playwright inside the commit whose purpose is to
restore a broken gate would make a subsequent red indistinguishable between "the gate came back"
and "the browser changed underneath 47 suites". Backlog item, same ratchet family.

## 7. The outstanding item — app-v86 is still not confirmed live

This is the thing that has not happened, and this sign-off does not make it happen.

**Nobody has confirmed app-v86 is actually serving.** The Pages build and deployment reported
success at `9c0c030`, but a successful Pages deployment is a statement about GitHub's pipeline,
not about what a browser receives. The only mechanism in this project that reads the live site is
`verify-live.yml`, and it cannot reach its live fetch until the chain check ahead of it passes —
which is what this report unblocks. The workflow runs on push to `main` and also carries
`workflow_dispatch: {}`, so once this report is committed and pushed it can be triggered directly
without waiting for another commit.

**What a green run would prove:** that on a 24.04 runner the browser install succeeded; that
`release_check.sh` passed from outside this sandbox, against a full-history checkout, with the
chain reports present and current; and that within the 10-minute poll window
`arnjnnngs.github.io/chemowell-app-beta/index.html` served `APP_VERSION = 'app-v86'` **and**
`sw.js` served `CACHE = 'chemowell-app-v86-1'`. That cache half is the valuable half — it is the
app-v40 silent-stale-shell failure, where index.html deploys and the service worker keeps serving
the old build to every installed copy.

**What it would not prove, and must not be reported as proving:**

- **That the app works.** The step greps two string constants out of two files. It runs no suite
  against the live site, exercises no screen, and loads nothing in a browser.
- **That the rest of the deploy landed.** Only `index.html` and `sw.js` are fetched. Any other
  asset could be stale or missing and the run would still be green.
- **That any installed copy has updated.** `CACHE` being correct in the served `sw.js` means the
  new shell is *offered*. Whether a given phone's service worker has taken it is a separate
  question this gate cannot see.
- **That the window is closed retroactively.** app-v86 shipped with its deployment unverified by
  this gate, and a green run today does not change what was true at ship time. It tells us the
  state now, which is the useful thing, but the record should say "verified late", not "verified".
- **That the pin is durable.** A green run confirms `ubuntu-24.04` works today. It says nothing
  about whether GitHub has announced a retirement date for that image — still unchecked, still
  needing someone with a browser, per the Auditor's section 2.

Until that run is green, the honest status of app-v86 is *deployed, deployment unconfirmed*.

## 8. Gate behaviour, recorded because it differs from what was expected of it

I was told to expect `release_check.sh` to keep refusing until this report existed *at a current
commit*. It does not work that way, and the difference is worth writing down rather than leaving
as folklore.

`check_report_current` measures drift as `git diff --name-only <declared sha> -- $RULE5_PATHS`,
which compares the declared commit against the **working tree**, not against HEAD. `outputs/` is
not in `RULE5_PATHS`. So an uncommitted report in `outputs/` that declares a commit already in
this branch's history clears the gate immediately. Measured: with this file untracked, the gate
returned exit 0.

That is not a hole — the gate's job is to refuse code nobody read, and an uncommitted report is
still a report that exists and names what it examined. But two consequences follow. First, a
green local run does **not** mean the artifacts that make it green are pushed; the runner's copy
of this gate checks out `main` and will see only what was committed, so this report must be
committed and pushed before `verify-live.yml` can reproduce the pass. Second, anyone reasoning
about the gate from the drift rule should know it is tree-relative, because "current against the
working tree" and "current at HEAD" diverge exactly when uncommitted work exists.

## Integrity

No `git add`, `checkout`, `reset` or `stash` was run. The working tree was not mutated: `md5sum`
on `index.html` and `sw.js` matches `2af4d54` exactly, as recorded in section 4. Scratch copies of
the two workflow versions and two analysis scripts live under the session scratchpad, outside the
repo. `git status --porcelain` shows this report as the only new file. Nothing was committed and
nothing was pushed.
