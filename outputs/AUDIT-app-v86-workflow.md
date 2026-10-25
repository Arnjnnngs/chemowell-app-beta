AUDITED-COMMIT: 2bccd13
VERDICT: SHIP

# Zero Day Auditor — app-v86 workflow pin (`verify-live.yml`)

Scope: `git diff 9c0c030 2bccd13`, one commit, one file, `.github/workflows/verify-live.yml`.
Nothing else in app-v86 was examined; it has its own chain reports.

## Headline

Ship it. The change moves exactly one executable line — `runs-on: ubuntu-latest` to
`runs-on: ubuntu-24.04` — and everything else it adds is comment. It cannot weaken the gate
because it does not touch a single check: it changes the machine the checks run on, from one
where the job dies in 14 seconds before reaching them, to one where they run. Run 25 is the
proof: it got past the browser install and refused the release at the chain check, which is the
gate doing its job for the first time since the platform moved.

Two advisory findings below, neither blocking. One operational note the caller must act on: this
report alone will NOT turn `release_check.sh` green.

## What I verified here, versus what I am reasoning about

I have no network beyond loopback. I cannot reach GitHub's runner-image list, Playwright's
supported-platform matrix, or the live Pages site. The split is explicit:

| Claim | Status |
|---|---|
| Only one executable line changed | VERIFIED, two independent ways |
| YAML parses; all three workflows parse | VERIFIED (`yaml.safe_load`) |
| `fetch-depth: 0` intact, 6 steps, order unchanged | VERIFIED |
| No env, no secrets, no token in this file | VERIFIED (`grep`, none in either version) |
| Rule 0 clean in the added comments | VERIFIED |
| Sibling workflows still on `ubuntu-latest` | VERIFIED |
| Playwright 1.56.1 supports ubuntu-24.04 | INFERRED — see below |
| `ubuntu-24.04` still offered by GitHub | INFERRED — cannot check from here |

## 1. The diff, line by line

Two methods, because one could be fooled by a reformat.

Comment-stripped textual diff (all `#` and blank lines removed from both sides) yields exactly
one hunk: `runs-on: ubuntu-latest` becomes `runs-on: ubuntu-24.04`.

Normalized semantic diff — both files parsed to objects, keys coerced to strings, sorted, dumped
and compared — yields exactly one changed value, `jobs.verify.runs-on`. Nothing else in the
parsed tree differs. That rules out a reordered step, a dropped `with:`, or a silently altered
`run:` body hiding behind the comment block.

Specifically confirmed intact, because the file's own comments say they matter:

- `actions/checkout@v4` with `fetch-depth: 0` — still the first step, still depth 0. The comment
  explains that a depth-1 checkout makes `PUBLISHED.json`'s recorded commit absent on the runner,
  so the gate silently measures the cache bump against the wrong baseline. Still holds.
- The browser install step — unchanged, still `playwright@1.56.1`, still `--no-save`, still
  before the chain check. The `--no-save` reasoning (keep the app's `package.json` free of a test
  dependency the Android build would then install) still holds; `package.json` has no Playwright
  entry, confirmed.
- Step order unchanged: checkout, setup-node, browser install, chain check, read expected
  versions, poll live site. The chain check still runs before the live fetch.
- No `continue-on-error`, no `if:` added, no `|| true` introduced on any check. The one
  pre-existing `|| true` is on `chmod +x`, which was already there and is not a check.

## 2. Is `ubuntu-24.04` the right pin?

Yes, and `ubuntu-22.04` would be worse.

What I can reason from the evidence in hand: the error names the unsupported target as
`ubuntu26.04-x64`. Playwright resolves native dependencies from a per-distribution table, and the
message is a lookup miss on that table rather than a runtime fault — which means the table has
entries for the Ubuntu releases it does support. Playwright 1.56 is recent enough that 24.04 is
squarely inside its supported set and old enough that 20.04 had already been dropped. So 24.04 is
the newest Ubuntu this Playwright knows about, which is exactly the pin you want: maximum runway
before the next forced move.

On `ubuntu-22.04`: it would probably also work with Playwright, but it is the wrong choice. It is
an older LTS, it is the next image in line for retirement now that `ubuntu-latest` has rolled
forward two releases past it, and pinning to something closer to end-of-life buys a shorter
reprieve for the same effort. If the point of a pin is to stop the floor moving, pin to the
newest floor that holds.

What I cannot verify: whether GitHub has published a retirement date for `ubuntu-24.04`. I think
it is unlikely this soon after 26.04 became `latest` — the historical pattern leaves the previous
LTS available for a long overlap — but that is inference, not a checked fact. **Recommended
follow-up for whoever has a browser: confirm `ubuntu-24.04` has no announced retirement date, and
put that date in the comment block if one exists.** A pin with a known expiry that nobody wrote
down is the same trap as `ubuntu-latest`, just slower.

## 3. Pinning versus bumping Playwright versus installing the browser differently

I agree with pinning, and I would take the same call.

**Bumping Playwright** is the wrong move in this commit specifically. Over forty suites under
`test/` import Playwright. Changing the browser they execute against changes test semantics
across the whole suite — and doing that inside the commit whose entire purpose is to restore a
broken gate means that if anything then goes red, you cannot tell whether the gate came back or
the browser changed underneath the assertions. That is a separate piece of work with its own
chain pass. The commit message's reasoning is sound.

**Installing the browser differently** is worse in two of the three obvious shapes. Dropping
`--with-deps` would let the browser binary download succeed on 26.04 and then fail at launch for
missing shared libraries — a later, more obscure failure, inside the suites rather than in a
named install step, which is strictly harder to diagnose. Running the job in a `container:` image
would be genuinely hermetic and is defensible, but it is a much larger change (node setup,
checkout ownership, apt state inside the container) carrying risk entirely out of proportion to
"the gate stopped running". Pinning `runs-on` is the smallest change that fully fixes the
problem, and smallest-correct is the right instinct on a file whose job is to be trustworthy.

## 4. FINDING (advisory): the Playwright pin has no ratchet

`playwright@1.56.1` is declared in exactly one place in this repo — line 63 of this workflow.
`package.json` has no Playwright entry, dev or otherwise, and no suite declares a version. The
comment asserts the version "must keep matching the one the suites are written against", but that
agreement is a convention held in a comment, not a mechanism. Anyone can bump that string and
nothing anywhere fails.

This is not introduced by this change and does not block it. But this repo's whole pattern is
turning promises into mechanisms — `release_check.sh` exists because "a rule enforced only by the
person it constrains is the one that gets skipped". The Playwright version is currently a promise.
Worth a backlog item.

## 5. FINDING (advisory): `android-build.yml` is the real second time bomb

Checked all three workflows. The exposure is not equal.

`refresh-med-table.yml` — **low risk.** `ubuntu-latest`, but it is Node 22 via `setup-node` plus
`fetch`, and its one test, `test/v75-table-builder.mjs`, does not import Playwright (verified).
Nothing in it depends on a distro-specific native dependency table. Leaving it is fine.

`android-build.yml` — **real exposure, and it has already been bitten by this exact class.** Both
its jobs are on `ubuntu-latest`. Its own comment block records runs 80–84 passing and run 85
failing with no change to anything it builds, because Google removed an SDK package underneath an
unpinned default. The fix pinned the *package set* and left the *runner* floating, so the same
category of break is still live: a 26.04 image can move the JDK layout, `android-actions/setup-android`
behaviour, or — most fragile of all — the KVM device permissions and emulator image availability
that the `emulator-smoke` job depends on. That job writes a udev rule by hand and boots a system
image; it is the most platform-coupled thing in the repo.

I was asked whether leaving it is a finding. It is. I am not changing it — out of scope, and it
needs its own chain pass — but the recommendation is to pin both of its jobs to `ubuntu-24.04`
as a separate commit, soon, and to do it before it fails rather than after. The asymmetry is the
argument: `verify-live.yml` failing loudly cost one unverified release, while `android-build.yml`
failing means no APK, discovered whenever someone next wants one.

## 6. Does anything here weaken the gate?

No. I looked for this specifically, because a "fix the CI" commit is the natural place to hide a
softened check.

The pin is on `runs-on` only. No step gained `continue-on-error` or an `if:` guard. No `set -e`
was relaxed — the chain-check step still uses `set -uo pipefail` with an explicit `exit 1` in its
else branch, and the live-fetch step still ends in `exit 1` after its 20 attempts. The
`::error::` annotations are unchanged. `release_check.sh` is invoked identically. The gate refuses
exactly what it refused before, on a machine where it can actually get far enough to refuse.

If anything the change strengthens it: for the window it was broken, every push produced the same
red regardless of merit, which is the "a gate that is always red says nothing" failure the comment
names. Distinguishable red is worth more than uniform red.

## 7. Rule 0

Not really applicable to a workflow file, but checked anyway. Scanned every added line for the
patient name, gendered pronouns, and all thirteen reserved medication ids. Clean — the added text
is entirely about Ubuntu versions, Playwright, and the Android SDK precedent. The one occurrence
of "patient" in the file predates this commit and is generic.

## 8. OPERATIONAL NOTE — this report alone will not turn the gate green

The caller needs this. Because `.github/workflows/` is a Rule 5 path, commit 2bccd13 put every
existing app-v86 chain report into drift. Measured directly:

| report | commit | says | Rule 5 drift since |
|---|---|---|---|
| AUDIT-app-v86.md | 5d54e2e | DO NOT SHIP | verify-live.yml, index.html |
| AUDIT-app-v86-delta.md | 0f73911 | SHIP | verify-live.yml, index.html |
| AUDIT-app-v86-delta2.md | 5ae0f67 | DO NOT SHIP | verify-live.yml, index.html |
| AUDIT-app-v86-delta3.md | 4d6db99 | SHIP | verify-live.yml |
| PM-app-v86.md | 3c167cb | DO NOT SHIP | verify-live.yml |
| PM-app-v86-delta.md | 86c1acc | SHIP | verify-live.yml |

All six are stale by the drift rule, which is precisely why run 25 refused. This report supplies a
current Auditor report at 2bccd13 — it clears the thinness floor, its header is the first two
non-blank lines, and 2bccd13 is a descendant of both standing Auditor refusals, so it supersedes
them at the same stage.

**There is still no current PM sign-off.** `check_report_current` will reject both PM files for
drift on `verify-live.yml`, leaving `CURRENT_PM` empty and the gate red. A PM pass at 2bccd13 (or
later) is required before `release_check.sh` passes. Adding one is the next action; it is not
something this audit can or should supply, since the Auditor and the PM are deliberately separate
desks.

## Integrity

Working tree unmutated throughout. No `git add`, `checkout`, `reset` or `stash` was run; the only
writes were this report and one scratch copy of the old file under the session scratchpad.
`git status --porcelain` shows this report as the sole new file.
