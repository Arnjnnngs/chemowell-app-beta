#!/bin/bash
# Mandatory pre-push gate. Run this, and only push if it exits 0, EVERY single time --
# no exceptions for "small" changes, solo edits, or late-night one-liners. This is what
# app-v40 skipped (repeatedly, across several same-day pushes), which is why Aaron saw zero
# updates all day despite multiple real, successfully-deployed releases: the app's service
# worker caches index.html cache-first, and it only checks for a new version when sw.js's
# own CACHE constant changes. If index.html changes but sw.js doesn't, every already-installed
# copy of the app (including the APK, which loads this same live site) keeps serving the old
# cached shell forever -- no error, no warning, just silence. That's a bug this script makes
# structurally impossible to ship again, because it blocks the push instead of relying on
# anyone (human or agent) remembering a checklist item under time pressure.
set -euo pipefail
cd "$(dirname "$0")"

FAIL=0

# BACKLOG predicted this and it happened: a GitHub web upload does not preserve the executable bit,
# so after anyone syncs from the remote `./release_check.sh` dies with exit 126 -- "Permission
# denied", which reads like a broken gate rather than a mode bit, and the tempting next move is to
# skip it. Confirmed 2026-08-11: both scripts came back 100644 after a fetch + fast-forward.
# Self-check, because a gate that cannot be invoked the documented way is not protecting anything.
for _s in release_check.sh mark_published.sh; do
  _mode=$(git ls-files -s -- "$_s" 2>/dev/null | awk '{print $1}')
  if [ -n "$_mode" ] && [ "$_mode" != "100755" ]; then
    echo "⚠️  WARNING: $_s is committed as $_mode, not 100755."
    echo "   ./$_s will exit 126 (Permission denied) for anyone who clones or syncs this repo."
    echo "   Fix: git update-index --chmod=+x $_s && commit, then re-upload it."
  fi
done


# PM-6 (app-v55 PM gate): a bare `grep -o` returns EVERY match, so a second `CACHE = '…'` anywhere
# in sw.js -- a commented-out previous value is the obvious way in -- made these variables
# multi-line, and the `grep -Fx` reuse check downstream then read each line as its own pattern and
# hard-failed a perfectly correct release with a nonsense message. It failed safe, so nothing could
# be stranded, but TEAM.md forbids working around a red gate and a gate that cries wolf on a good
# build is how someone learns to push through a red one.
#
# `head -1` alone is NOT the fix, and proving that is why this is a function: with the comment
# ABOVE the real line, head -1 picks the comment's stale value and the script confidently reports
# "not bumped" on a correctly bumped build -- a different wrong answer, arrived at just as
# confidently. So: ignore comment lines, and if what is left is anything other than exactly one
# definition, say so and stop. A gate does not get to guess which of two values is the real one.
read_cache() {   # stdin: a sw.js. stdout: the bare value, or "none"/"multi".
  local hits
  hits=$(grep -v '^[[:space:]]*\(//\|\*\|/\*\)' | grep -o "CACHE = '[^']*'" | sed "s/.*'\(.*\)'/\1/" || true)
  local n
  n=$(printf '%s' "$hits" | grep -c . || true)
  if [ "$n" -eq 0 ]; then echo "none"; elif [ "$n" -gt 1 ]; then echo "multi"; else printf '%s\n' "$hits"; fi
}


# THE BASE REF IS THE WHOLE POINT (fixed 2026-08-10, found by the app-v52 PM gate).
# This script used to diff against HEAD, i.e. only UNCOMMITTED work. That made it pass green on
# the exact failure it exists to block: APP_CLAUDE.md rule 8 says commit early and often, and
# pushes here are manual GitHub web uploads of files that are already committed -- so by the time
# anyone runs this, the risky change is in a commit and `git diff HEAD` is empty. The PM
# reproduced it on a scratch clone: commit an index.html-only change with no sw.js bump, run this,
# get "No index.html changes vs $BASE. and exit 0. A safety net that only inspects the one state
# the workflow never pushes from is not a safety net.
#
# Now it diffs against what is actually LIVE, which is the real question: "does the delta I am
# about to publish change index.html without bumping the cache?" Because that diff is taken from
# the WORKING TREE, uncommitted work is judged too -- which is right, since a manual upload
# publishes the working tree.
#
# ...AND origin/main GOES STALE AFTER A PUSH UNLESS SOMEONE FETCHES (found by the app-v53 PM gate).
# Pushes here are manual GitHub web uploads, so git never learns they happened: until someone runs
# `git fetch`, origin/main points at the release BEFORE the live one. A CACHE bumped in the PREVIOUS
# release then still reads as "bumped" against that stale base and this script prints a green tick
# on a build that never bumped it. Reproduced on a scratch clone; the app-v40 failure wearing a ✅.
#
# CORRECTION (2026-08-11, the same day, after this script asserted otherwise): `git fetch` DOES work
# in this sandbox. Only `git push` is refused -- the proxy declines to inject a credential for this
# repo (403), which is a write restriction, not a network one. The earlier text here said "this
# sandbox has no network" and built a whole workaround on that, which was a guess generalised from
# the push failure without ever running fetch. Kept as a note rather than deleted, because assuming
# instead of checking is the specific mistake this file keeps being edited to undo.
#
# So the baseline is now belt AND braces: fetch when you can, and keep PUBLISHED.json as a COMMITTED
# record written by ./mark_published.sh, which still matters when a run is offline or a fetch is
# skipped. Resolution order, most trustworthy first:
#   1. $BASE_REF          -- explicit override, for scratch clones and for testing this script.
#   2. PUBLISHED.json     -- the recorded live commit, cross-checked against its own sw.js.
#   3. origin/main        -- honest now that it can be refreshed; still warns if it was not.
#   4. HEAD               -- uncommitted work only. Warns hard, because it catches almost nothing.
#
# This script never fetches by itself. A gate that mutates refs behind the operator is a gate that
# can change its own verdict between two runs, so it tells you to fetch instead.
PUB_COMMIT=""; PUB_CACHE=""; PUB_VERSION=""
if [ -f PUBLISHED.json ]; then
  PUB_COMMIT=$(python3 -c "import json;print(json.load(open('PUBLISHED.json')).get('commit',''))" 2>/dev/null || echo "")
  PUB_CACHE=$(python3 -c "import json;print(json.load(open('PUBLISHED.json')).get('cache',''))" 2>/dev/null || echo "")
  PUB_VERSION=$(python3 -c "import json;print(json.load(open('PUBLISHED.json')).get('app_version',''))" 2>/dev/null || echo "")
fi

BASE=""
if [ -n "${BASE_REF:-}" ]; then
  BASE="$BASE_REF"
  if ! git rev-parse --verify --quiet "$BASE" >/dev/null; then
    echo "❌ RELEASE CHECK FAILED: BASE_REF='$BASE' was set explicitly but does not resolve."
    exit 1
  fi
  echo "ℹ️  Baseline: BASE_REF override -> $BASE"
elif [ -n "$PUB_COMMIT" ] && git rev-parse --verify --quiet "$PUB_COMMIT^{commit}" >/dev/null; then
  # Integrity check. A record that disagrees with the commit it names is worse than no record --
  # it is a baseline someone could hand-edit to make this gate pass. Refuse it outright rather
  # than quietly falling back, so the tampering surfaces instead of being routed around.
  # GUARDED. The sixth and last of this class (found by the PM after five were fixed): a baseline
  # commit with no sw.js makes `git show` fail, the pipeline fails under `set -euo pipefail`, the
  # ASSIGNMENT fails, and the whole script dies at exit 128 with ZERO output -- the gate vanishing
  # in exactly the case it exists to catch. "none" is a value the comparison below handles.
  REC_CACHE=$(git show "$PUB_COMMIT":sw.js 2>/dev/null | read_cache || echo "none")
  if [ "$REC_CACHE" != "$PUB_CACHE" ]; then
    echo "❌ RELEASE CHECK FAILED: PUBLISHED.json is not self-consistent."
    echo "   It records cache '$PUB_CACHE' for commit ${PUB_COMMIT:0:7}, but that commit's sw.js"
    echo "   actually says '$REC_CACHE'. Do not hand-edit this file -- re-run ./mark_published.sh"
    echo "   against the commit that was really uploaded."
    exit 1
  fi
  BASE="$PUB_COMMIT"
  echo "ℹ️  Baseline: PUBLISHED.json -> $PUB_VERSION ($PUB_CACHE) at ${PUB_COMMIT:0:7}"
  # Surface the staleness this file exists to defeat, so it is visible rather than inferred.
  if git rev-parse --verify --quiet origin/main >/dev/null; then
    ORIGIN_SHA=$(git rev-parse origin/main)
    if [ "$ORIGIN_SHA" != "$PUB_COMMIT" ] && git merge-base --is-ancestor "$ORIGIN_SHA" "$PUB_COMMIT" 2>/dev/null; then
      echo "   (origin/main is $(git rev-list --count "$ORIGIN_SHA".."$PUB_COMMIT") commit(s) behind the published build --"
      echo "    exactly the stale-baseline case this record exists to defeat. Ignoring origin/main.)"
    fi
  fi
  # PM-3 on the release gate (app-v55 PM gate): the integrity check above proves this record is
  # self-CONSISTENT, never that it is CURRENT. Nothing here can see GitHub, so if someone pushes
  # and forgets ./mark_published.sh, the record silently describes the release before the live one
  # and the whole stale-baseline hole reopens -- quietly, which is the part that matters. There is
  # no way to detect that from inside the sandbox, so say out loud what the record is being trusted
  # to mean and how many unrecorded index.html changes sit on top of it.
  AHEAD=$(git rev-list --count "$PUB_COMMIT"..HEAD -- index.html 2>/dev/null || echo 0)
  if [ "$AHEAD" -gt 0 ]; then
    echo "   $AHEAD commit(s) have changed index.html since that record. This gate assumes NONE of"
    echo "   them are live yet. If any were already pushed, run ./mark_published.sh <that commit>"
    echo "   first -- otherwise the comparison below is against the wrong build."
  fi
elif git rev-parse --verify --quiet origin/main >/dev/null; then
  BASE="origin/main"
  if [ -n "$PUB_COMMIT" ]; then
    # Distinguish this from "there is no record at all" -- they need different fixes, and a message
    # that says "no record" when a record exists sends the reader looking for the wrong problem.
    # This is the live failure mode after a fetch + fast-forward: mark_published.sh used to store the
    # LOCAL commit, which stops existing the moment history is replaced by the remote's.
    echo "⚠️  WARNING: PUBLISHED.json names commit ${PUB_COMMIT:0:7}, which does not exist in this"
    echo "   repository -- most likely a local SHA recorded before history was replaced by a fetch."
    echo "   Re-run ./mark_published.sh (it records origin/main now, which survives a fetch)."
  fi
  echo "⚠️  WARNING: no usable PUBLISHED.json record, falling back to origin/main."
  echo "   That is only trustworthy if origin/main has been refreshed since the last push --"
  echo "   run 'git fetch origin' and re-run this, or a CACHE bumped in the PREVIOUS release"
  echo "   could satisfy the check below. Run ./mark_published.sh after your next push too."
else
  BASE="HEAD"
  echo "⚠️  WARNING: no PUBLISHED.json and no origin/main. Falling back to HEAD, which only sees"
  echo "   UNCOMMITTED work -- this will NOT catch a committed index.html change that forgot the"
  echo "   sw.js bump. Set BASE_REF explicitly before trusting this run."
fi

INDEX_CHANGED=$(git diff --name-only "$BASE" -- index.html)
# EVERY FILE RULE 5 COVERS, not just index.html.
#
# The chain gate below used to run only when index.html changed, because that is the only thing
# NEW_VERSION was computed for. The Zero Day Auditor reproduced the consequence twice: with
# index.html untouched the script printed "✅ Release check passed", exit 0, WITH NO AUDIT OR PM
# REPORT PRESENT AT ALL -- including for a change to sw.js alone, which is a real release that
# reaches every installed phone. A gate that only guards one file is a gate with a door beside it.
#
# APP_CLAUDE.md rule 5 names index.html, sw.js, .github/workflows/, sync-backend/, package.json,
# package-lock.json and capacitor.config.ts. All of them count.
# TRACKED CHANGES PLUS UNTRACKED FILES. `git diff` compares tracked paths only, so a release made
# entirely of NEW files -- a new .github/workflows/*.yml, a new file under sync-backend/ -- was
# invisible here and skipped the quality chain completely. Demonstrated by the Zero Day Auditor, who
# dropped two new files into a scratch clone and watched this gate report the tree current and clean.
RULE5_PATHS="index.html sw.js .github/workflows sync-backend package.json package-lock.json capacitor.config.ts"
RULE5_CHANGED=$(git diff --name-only "$BASE" -- $RULE5_PATHS 2>/dev/null || true)
RULE5_UNTRACKED=$(git ls-files --others --exclude-standard -- $RULE5_PATHS 2>/dev/null || true)
if [ -n "$RULE5_UNTRACKED" ]; then
  RULE5_CHANGED=$(printf '%s\n%s' "$RULE5_CHANGED" "$RULE5_UNTRACKED" | grep -v '^$' || true)
fi
# A readable name for $BASE in messages -- a bare 40-char SHA tells the reader nothing about which
# build they are being compared against.
BASE_LABEL="$BASE"
if [ -n "$PUB_VERSION" ] && [ "$BASE" = "$PUB_COMMIT" ]; then BASE_LABEL="the live build $PUB_VERSION (${PUB_COMMIT:0:7})"; fi

# Uncommitted-work notice (V53-6: this block used to be unreachable, and its comment described
# behaviour that did not happen). It required INDEX_CHANGED to be EMPTY, but `git diff <commit> --
# index.html` compares the WORKING TREE against that commit, so any uncommitted index change is
# already inside INDEX_CHANGED and the branch could never fire; meanwhile the real outcome was a
# hard exit 1, while the comment promised "Not blocking". It now says what is true: uncommitted
# work IS being judged here, because the working tree is what gets uploaded.
UNCOMMITTED_INDEX=$(git diff --name-only HEAD -- index.html)
if [ -n "$UNCOMMITTED_INDEX" ]; then
  echo "ℹ️  Note: index.html has uncommitted changes. They ARE included in the check below --"
  echo "   this compares the working tree against the published build, because the working tree"
  echo "   is what a manual upload actually publishes. Commit before pushing regardless."
fi

# V53-4 (Auditor): comparing the whole sw.js diff let a cosmetic sw.js edit satisfy the check while
# CACHE stayed put -- the script then printed "sw.js's CACHE constant changed with it", which was
# untrue and is the exact stranding it exists to block. Compare the CACHE constant itself.
# GUARDED. Unguarded, a baseline commit with no sw.js makes `git show` fail, the pipeline fails
# under `set -euo pipefail`, the ASSIGNMENT fails and the script dies at exit 128 with ZERO
# output. Its sibling on the next line was already guarded, which also made the CACHE_OLD="none"
# branch below unreachable. Found by the Zero Day Auditor after I fixed two of this class and
# wrote that both were done.
CACHE_OLD=""
if git show "$BASE":sw.js >/dev/null 2>&1; then
  CACHE_OLD=$(git show "$BASE":sw.js 2>/dev/null | read_cache)
fi
CACHE_NEW=$(read_cache < sw.js 2>/dev/null || echo "none")
[ -z "$CACHE_OLD" ] && CACHE_OLD="none"
[ -z "$CACHE_NEW" ] && CACHE_NEW="none"

if [ "$CACHE_NEW" = "multi" ]; then
  echo "❌ RELEASE CHECK FAILED: ./sw.js defines CACHE more than once (outside comments)."
  echo "   This gate will not guess which one the service worker actually uses. Leave exactly one"
  echo "   active definition and re-run."
  exit 1
fi

# PM-1 on the release gate (app-v55 PM gate): "none" is a sentinel, and a sentinel that can never
# equal anything is indistinguishable from a successful comparison. If sw.js is missing, or its
# CACHE line is reformatted so this grep stops matching (double quotes, a line break, a rename),
# CACHE_NEW becomes "none", never equals CACHE_OLD, and every block below is either satisfied or
# explicitly skipped -- so the script printed "sw.js's CACHE constant changed with it" and exited 0
# on a build whose cache key it could not read at all. That is V53-4 re-opened through a different
# door. Unparseable is now fatal: the gate must never claim to have checked something it did not.
if [ "$CACHE_NEW" = "none" ]; then
  echo "❌ RELEASE CHECK FAILED: could not read a CACHE constant out of ./sw.js."
  echo "   Expected a line matching:  const CACHE = '…';  (single quotes)."
  echo "   This gate cannot verify a cache bump it cannot parse, and it will not guess. Fix sw.js"
  echo "   (or update this script's pattern if the format changed on purpose) and re-run."
  exit 1
fi
if [ "$CACHE_OLD" = "none" ] || [ "$CACHE_OLD" = "multi" ]; then
  echo "⚠️  WARNING: could not read a single CACHE constant out of sw.js at $BASE_LABEL"
  echo "   ($CACHE_OLD). The comparison below is therefore weaker than usual -- it can still catch"
  echo "   a reused value via the published-history check, but not a straight 'forgot to bump'."
  echo "   Verify the bump by hand against the live site before pushing."
fi

if [ -n "$INDEX_CHANGED" ] && [ "$CACHE_OLD" = "$CACHE_NEW" ]; then
  echo "❌ RELEASE CHECK FAILED: index.html differs from $BASE_LABEL, but sw.js's CACHE"
  echo "   constant was not bumped. Anyone with the app already open or installed will"
  echo "   NEVER see this update -- the service worker will keep serving the old cached"
  echo "   copy indefinitely, with no error to signal it."
  echo
  echo "   Fix: bump the CACHE constant at the top of sw.js (e.g. 'chemowell-app-v41-1'),"
  echo "   then re-run this script."
  FAIL=1
fi

# Belt and braces on the same failure, from the other direction: the value about to be published
# must never be one that has ALREADY been served. A service worker keys its cache by this string,
# so re-using a retired value hands installed apps a cache they already have and strands them just
# as completely as never bumping it.
#
# The set of "already served" values is every CACHE reachable from $BASE -- i.e. published history.
# Commits in $BASE..HEAD are the release being prepared, so the value this release itself introduces
# is expected to be there and must not trip the check. Getting that boundary wrong in either
# direction is the whole difficulty: scanning ALL history fails every correct release (the new value
# is at HEAD), and exempting "whatever HEAD says" silently excuses a bad value the moment it is
# committed -- which is the normal workflow here, so that exemption would have made this block
# decorative. Cheap either way: sw.js has a handful of commits.
if [ -n "$INDEX_CHANGED" ] && [ "$BASE" != "HEAD" ]; then
  CACHE_BARE="$CACHE_NEW"
  REUSED=$(git log --format=%H "$BASE" -- sw.js | while read -r c; do
    git show "$c":sw.js 2>/dev/null | read_cache
  done | grep -Fx "$CACHE_BARE" | head -1 || true)
  if [ -n "$REUSED" ]; then
    if [ -n "$PUB_CACHE" ] && [ "$CACHE_BARE" = "$PUB_CACHE" ]; then
      echo "❌ RELEASE CHECK FAILED: CACHE '$CACHE_BARE' is the value that is ALREADY LIVE"
      echo "   (PUBLISHED.json). Publishing it again means every installed copy keeps the cache it"
      echo "   already has -- the same silent stranding as never bumping it at all."
    else
      echo "❌ RELEASE CHECK FAILED: CACHE '$CACHE_BARE' has been shipped before (it appears in the"
      echo "   published history at $BASE_LABEL). Re-using a retired cache key strands installed apps"
      echo "   the copy they already hold. Pick a value that has never been used."
    fi
    FAIL=1
  fi
fi

# APP_VERSION is just the on-screen build label (drawer footer) -- not load-bearing for the
# caching bug above, but it should still track reality so a screenshot of the drawer is a
# reliable way to confirm which build someone is on. Warn, don't hard-block, since a stale
# label doesn't strand anyone the way a stale sw.js cache does.
if [ -n "$INDEX_CHANGED" ]; then
  # The bare value, not the whole grep match -- this used to print the tautology
  # "APP_VERSION (APP_VERSION = 'app-v55')".
  # Same class: a baseline with no index.html, or with no APP_VERSION line, killed this
  # assignment and took the README check and the chain gate down with it, masked behind exit 1.
  OLD_VERSION=""
  if git show "$BASE":index.html 2>/dev/null | grep -q "APP_VERSION = '"; then
    OLD_VERSION=$(git show "$BASE":index.html 2>/dev/null | grep -o "APP_VERSION = '[^']*'" | head -1 | sed "s/.*'\(.*\)'/\1/")
  fi
  NEW_VERSION=$(grep -o "APP_VERSION = '[^']*'" index.html | head -1 | sed "s/.*'\(.*\)'/\1/")
  if [ "$OLD_VERSION" = "$NEW_VERSION" ]; then
    echo "⚠️  WARNING: index.html changed but APP_VERSION is still $NEW_VERSION."
    echo "   Not blocking, but the version shown in the app's drawer will be stale."
  fi
fi

# The README's version-history row is the only human-readable record of what shipped, and it has
# now carried a WRONG cache key twice: app-v55 (PM-4) and app-v56 (Scribe). Both times the row was
# written before a later fix bumped the cache again, and nothing could catch it because this script
# never opened README.md. Documentation failures are silent -- the build is green whether or not
# the changelog is true -- so this is a mechanical check, not a checklist item.
if [ -n "$INDEX_CHANGED" ] && [ -f README.md ]; then
  NEW_VER=$(grep -o "APP_VERSION = '[^']*'" index.html | head -1 | sed "s/.*'\(.*\)'/\1/")
  # SILENT EXIT, fixed 2026-08-29. Under `set -euo pipefail` a grep that matches nothing fails the
  # whole pipeline, so this ASSIGNMENT died and took the script with it -- exit 1, no output at all,
  # never reaching the error message ten lines below that exists to explain exactly this. A gate
  # whose failure is indistinguishable from a crash teaches people to ignore it. Guarded with a
  # separate test so the assignment only runs when there is something to assign, and no `|| true`.
  ROW=""
  if grep -q "^| $NEW_VER |" README.md; then
    ROW=$(grep -n "^| $NEW_VER |" README.md | head -1 | cut -d: -f1)
  fi
  if [ -z "$ROW" ]; then
    echo "❌ RELEASE CHECK FAILED: README.md has no version-history row for $NEW_VER."
    echo "   Two releases (app-v54, app-v55) shipped with no row at all before this check existed."
    FAIL=1
  else
    if ! sed -n "${ROW}p" README.md | grep -qF "$CACHE_NEW"; then
      echo "❌ RELEASE CHECK FAILED: README.md's $NEW_VER row does not mention the cache key that"
      echo "   is actually about to ship ($CACHE_NEW). It says:"
      # Guarded too: with no cache key in the row at all this grep failed and cut off the
      # "Fix the row" explanation immediately below it -- the script truncating its own advice.
      if sed -n "${ROW}p" README.md | grep -q "chemowell-app-v[0-9]*-[0-9]*"; then
        sed -n "${ROW}p" README.md | grep -o "chemowell-app-v[0-9]*-[0-9]*" | sort -u | sed 's/^/     /'
      else
        echo "     (the row names no cache key at all)"
      fi
      echo "   Fix the row. A version-history entry wrong about the one fact it exists to record is"
      echo "   worse than no entry, because it will be believed."
      FAIL=1
    fi
  fi
fi

# ---- THE CHAIN GATE MUST HAVE ACTUALLY RUN FOR *THIS* VERSION ------------------------------
# Added 2026-08-29 after the Lead Developer shipped app-v67 to main with every suite green and
# WITHOUT the Auditor + PM gate, having conflated two different things: Aaron's standing permission
# to PUSH to the ChemoWell repos, and APP_CLAUDE.md rule 5's requirement that an independent Zero
# Day Auditor and PM sign off first. Aaron, 2026-08-29, settling it: "you CAN always push to
# chemowell, after audit pass and PM."
#
# Rule 5 says "zero exceptions and zero Lead-Developer discretion to waive it", and a rule enforced
# only by the person it constrains is the one that gets skipped at the end of a long day. So it is
# a script now. Reports live in outputs/ and are named for the version they cleared.
# Read independently of INDEX_CHANGED: the gate needs the version being released even when the
# release does not touch index.html.
GATE_VERSION="${NEW_VERSION:-}"
if [ -z "$GATE_VERSION" ] && [ -f index.html ] && grep -q "APP_VERSION = '" index.html; then
  GATE_VERSION=$(grep -o "APP_VERSION = '[^']*'" index.html | head -1 | sed "s/.*'\(.*\)'/\1/")
fi
if [ -n "$RULE5_CHANGED" ] && [ -n "$GATE_VERSION" ]; then
  # Globs, not `ls`. The first version of this gate used
  #   AUDIT_REPORT=$(ls outputs/AUDIT*"$NEW_VERSION"* 2>/dev/null | head -1)
  # and under `set -euo pipefail` a non-matching `ls` fails the pipeline, kills the ASSIGNMENT, and
  # takes the whole script down at exit 2 with no output -- so the gate died silently in exactly the
  # case it exists to catch. It reintroduced, inside its own fix, the same silent-exit class being
  # fixed twenty lines above. Found by falsifying it rather than by reading it.
  # An unmatched glob expands to the literal pattern, which `[ -e ]` simply reports as absent.
  AUDIT_REPORT=""
  PM_REPORT=""
  # EVERY matching report, not the first one the glob happens to sort to. Reading only the first made
  # which report was trusted a function of filename sort order -- so an older, cleaner report sitting
  # beside a current one decided the release. Each one found must now declare a commit and be current.
  AUDIT_ALL=""
  PM_ALL=""
  for _f in outputs/AUDIT*"$GATE_VERSION"*; do
    if [ -e "$_f" ]; then AUDIT_ALL="$AUDIT_ALL $_f"; [ -z "$AUDIT_REPORT" ] && AUDIT_REPORT="$_f"; fi
  done
  for _f in outputs/PM*"$GATE_VERSION"*; do
    if [ -e "$_f" ]; then PM_ALL="$PM_ALL $_f"; [ -z "$PM_REPORT" ] && PM_REPORT="$_f"; fi
  done
  if [ -z "$AUDIT_REPORT" ] || [ -z "$PM_REPORT" ]; then
    echo "❌ RELEASE CHECK FAILED: the quality chain has not run for $GATE_VERSION."
    echo "   Changed under rule 5: $(echo $RULE5_CHANGED | tr '\n' ' ')"
    [ -z "$AUDIT_REPORT" ] && echo "   missing: an outputs/AUDIT*${GATE_VERSION}*.md report"
    [ -z "$PM_REPORT" ]    && echo "   missing: an outputs/PM*${GATE_VERSION}*.md sign-off"
    echo "   Every suite passing is SELF-verification. APP_CLAUDE.md rule 5 requires an independent"
    echo "   Auditor pass and PM sign-off before this ships, with no size exception. Permission to"
    echo "   push is not that gate."
    exit 1
  fi
  # STALENESS. Finding a filename is not reading a report. app-v68 was gated by an audit of commit
  # 51ba75f while the head being shipped was 68d3dd6 -- 67 further lines of index.html, including a
  # rewritten treatmentActiveOn, that no auditor had ever seen. The gate passed, because the report
  # was NAMED for v68 and the gate only ever checked its name. Every report must now declare the
  # commit it actually examined, and that commit must still describe the tree being shipped.
  # AT LEAST ONE CURRENT REPORT PER STAGE. Not "the first one the glob found", which made filename
  # sort order decide the release; and not "every report must be current", which would make the
  # outputs/ archive of past audits block every future release forever. A superseded report is
  # history and is allowed to be stale -- it just cannot be the one clearing the gate.
  # A report is read from its FIRST 12 LINES only. The header used to be findable anywhere in the
  # file, so a report quoting another report's header, or burying its own at line 900, passed.
  # RESOLVED TO A FULL SHA, always. Comparing the raw strings made "23aedd6" and its own 40-character
  # form look like two different commits, so a forged SHIP declaring the full sha "superseded" a real
  # DO NOT SHIP declaring the short one — the same commit overruling itself. That is how a padded fake
  # cleared this gate while four real refusals were printed above it.
  # ONE HEADER BLOCK, READ AS A UNIT. report_sha and report_verdict used to scan independently, so a
  # report's commit and its verdict could come from unrelated lines: a report stating DO NOT SHIP was
  # read as SHIP because it QUOTED another report's `VERDICT: SHIP` higher in its first 12 lines. The
  # verdict must be the line immediately after AUDITED-COMMIT, so a quotation cannot be mistaken for
  # this report's own finding.
  # THE HEADER IS THE TOP OF THE FILE, not "somewhere in the first twelve lines". Requiring the two
  # lines to be ADJACENT closed the attack that was demonstrated; it did not close the CLASS. Quote
  # two lines of someone else's report instead of one — their AUDITED-COMMIT and their VERDICT,
  # together — and the pair rule matched the quotation rather than this report's own finding, so a
  # report saying DO NOT SHIP was read as SHIP again. There is nowhere left to hide a quotation if
  # the header must be the FIRST two non-blank lines of the file: anything a report quotes is
  # necessarily below its own header.
  # A MARKDOWN TITLE IS ALLOWED ABOVE THE HEADER, AND NOTHING ELSE IS.
  # Requiring the header to be the very first two non-blank lines closed the quoting attack and then
  # did something nobody chose: every report that opens the way a normal markdown document opens --
  # "# Title", blank line, header -- stopped being readable. Two standing DO NOT SHIP reports,
  # including the PM's only sign-off for this release, silently vanished from the gate's output. The
  # rule failed SHUT on approvals (safe) and OPEN on refusals (not safe), and nothing noticed the
  # asymmetry. Nothing escaped only because five other refusals still held the gate -- luck, not design.
  # Leading '#' heading lines and blanks are skipped; the header must be the first two lines after
  # them. A quotation cannot reach that position without displacing the report's own header, and an
  # unreadable report is now blocked loudly rather than skipped in silence (see UNREADABLE below).
  # EXACTLY ONE UNINDENTED HEADER IN THE FILE, and the verdict is the next line after it.
  #
  # Three rules have now failed here, each defeated by the shape of the next one:
  #   "first 12 lines"            -> a quotation higher up won.
  #   "adjacent lines"            -> quote BOTH lines and it won again.
  #   "first two non-blank lines" -> broke every report with a markdown title, and two live
  #                                  refusals silently stopped being read.
  #   "skip leading '#' lines"    -> a heading can introduce the quotation, so it won a third time.
  # Every one of those tried to describe WHERE the header sits. This describes what a header IS:
  # a report has exactly one, written flush left. A report that quotes another's header indents it
  # or fences it -- which any markdown quotation already does -- and an unindented second one means
  # the file is ambiguous, so it is refused by name rather than guessed at.
  report_headline() { grep -n '^AUDITED-COMMIT:' "$1" 2>/dev/null | head -1 | cut -d: -f1 || echo ""; }
  report_headcount() { grep -c '^AUDITED-COMMIT:' "$1" 2>/dev/null || echo 0; }
  report_pair() {
    _n=$(report_headline "$1")
    [ -z "$_n" ] && { echo ""; return; }
    [ "$(report_headcount "$1")" != "1" ] && { echo ""; return; }
    sed -n "${_n},$((_n + 1))p" "$1" 2>/dev/null || true
  }
  report_sha() {
    _raw=$(report_pair "$1" | head -1 | grep -oE '^AUDITED-COMMIT:[[:space:]]*[0-9a-f]{7,40}[[:space:]]*$' | grep -oE '[0-9a-f]{7,40}' | tail -1 || echo "")
    [ -z "$_raw" ] && { echo ""; return; }
    git rev-parse --verify --quiet "$_raw^{commit}" 2>/dev/null || echo "$_raw"
  }
  # ANCHORED TO END OF LINE. `VERDICT: SHIPPING SOON` used to read as SHIP -- the pattern matched the
  # first four letters and stopped. Trailing whitespace/CR is allowed; trailing words are not.
  report_verdict() { report_pair "$1" | tail -1 | grep -m1 -oiE '^VERDICT:[[:space:]]*(DO NOT SHIP|SHIP)[[:space:]]*$' | sed 's/^[^:]*:[[:space:]]*//' | tr -d '[:space:]' || echo ""; }

  check_report_current() {   # $1 = path. echoes "" if current AND clearing, else the reason.
    _sha=$(report_sha "$1")
    if [ -z "$_sha" ]; then echo "no readable header — needs exactly one unindented 'AUDITED-COMMIT:' line"; return; fi
    if ! git rev-parse --verify --quiet "$_sha^{commit}" >/dev/null; then echo "names commit $_sha, which does not exist here"; return; fi
    # THE COMMIT MUST BE IN THIS BRANCH'S HISTORY. Without this a report could declare any commit
    # that exists anywhere in the repo -- a stale side branch, an abandoned experiment -- and
    # "no drift since it" would mean nothing.
    if ! git merge-base --is-ancestor "$_sha" HEAD 2>/dev/null; then
      echo "names commit ${_sha:0:7}, which is not in this branch's history"; return
    fi
    _verdict=$(report_verdict "$1")
    if [ -z "$_verdict" ]; then
      echo "states no verdict — needs a line 'VERDICT: SHIP' or 'VERDICT: DO NOT SHIP' and nothing else on it"; return
    fi
    case "$_verdict" in
      [Dd][Oo]*) echo "says DO NOT SHIP"; return ;;
    esac
    # SUBSTANCE. Two files of two lines each cleared this entire gate. A gate cannot tell a forged
    # report from a real one and should not pretend to -- but it CAN refuse a file that could not
    # possibly be the record of anyone having examined anything. This defends against the failure
    # that has actually happened here three times: a placeholder standing in for a stage nobody ran.
    _bytes=$(wc -c < "$1" 2>/dev/null || echo 0)
    _lines=$(wc -l < "$1" 2>/dev/null || echo 0)
    if [ "$_bytes" -lt 2000 ] || [ "$_lines" -lt 25 ]; then
      echo "is too thin to be a report ($_lines lines, $_bytes bytes) — a stage that ran leaves more than a header"; return
    fi
    _drift=$(git diff --name-only "$_sha" -- $RULE5_PATHS 2>/dev/null || true)
    _n=$(git ls-files --others --exclude-standard -- $RULE5_PATHS 2>/dev/null || true)
    if [ -n "$_n" ]; then _drift=$(printf '%s\n%s' "$_drift" "$_n" | grep -v '^$' || true); fi
    if [ -n "$_drift" ]; then echo "examined ${_sha:0:7}; changed since: $(echo $_drift | tr '\n' ' ')"; fi
  }

  # A LIVE "DO NOT SHIP" IS A STOP, NOT A SHRUG. The gate used to treat a do-not-ship verdict merely
  # as "not the report that clears this", so two fake files could clear the release while the gate
  # printed four real reports all saying DO NOT SHIP directly above the word "passed". A refusal is
  # only superseded by a report examining a LATER commit -- someone must have looked again after the
  # thing that was objected to.
  # AN UNREADABLE REPORT IS NOT AN ABSENT OBJECTION. This loop used to `continue` past any report
  # whose verdict it could not parse, so "the gate cannot read this file" silently meant "this file
  # raises no objection" -- which is exactly how two live refusals disappeared. A chain report that
  # exists but cannot be read now blocks the release and is named, because the safe reading of "I
  # don't know what this says" is never "it says ship".
  UNREADABLE=""
  for _r in $AUDIT_ALL $PM_ALL; do
    if [ "$(report_verdict "$_r")" = "" ] || [ "$(report_sha "$_r")" = "" ]; then
      UNREADABLE="$UNREADABLE
     $_r"
    fi
  done
  if [ -n "$UNREADABLE" ]; then
    echo "❌ RELEASE CHECK FAILED: a chain report exists that this gate cannot read."
    echo "   Unreadable:$UNREADABLE"
    echo "   Each must open with (optional blank/'# Title' lines, then) exactly these two lines:"
    echo "       AUDITED-COMMIT: <sha>"
    echo "       VERDICT: SHIP        (or: VERDICT: DO NOT SHIP)"
    echo "   A report the gate cannot read is not a report that raises no objection. Two live"
    echo "   refusals once vanished from this output that way."
    exit 1
  fi

  BLOCKING=""
  for _r in $AUDIT_ALL $PM_ALL; do
    [ "$(report_verdict "$_r")" = "" ] && continue
    case "$(report_verdict "$_r")" in [Dd][Oo]*) ;; *) continue ;; esac
    _rs=$(report_sha "$_r")
    [ -z "$_rs" ] && continue
    git rev-parse --verify --quiet "$_rs^{commit}" >/dev/null || continue
    git merge-base --is-ancestor "$_rs" HEAD 2>/dev/null || continue
    # SAME STAGE, and the approval must itself be a valid report. Neither held: a two-line file naming
    # a commit on an ABANDONED SIDE BRANCH — not in this history at all — cancelled every standing
    # refusal and erased them from the output, because this loop applied neither the in-this-history
    # test nor the thinness floor that the clearing path applies. And a PM sign-off could overrule an
    # Auditor's refusal, because nothing checked which stage either came from. An Auditor's refusal is
    # answered by the Auditor looking again, not by a different desk signing instead.
    case "$_r" in outputs/AUDIT*) _stage="$AUDIT_ALL" ;; *) _stage="$PM_ALL" ;; esac
    _superseded=""
    for _q in $_stage; do
      case "$(report_verdict "$_q")" in [Ss][Hh][Ii][Pp]) ;; *) continue ;; esac
      _qbytes=$(wc -c < "$_q" 2>/dev/null || echo 0); _qlines=$(wc -l < "$_q" 2>/dev/null || echo 0)
      [ "$_qbytes" -lt 2000 ] && continue
      [ "$_qlines" -lt 25 ] && continue
      _qs=$(report_sha "$_q")
      [ -z "$_qs" ] && continue
      git rev-parse --verify --quiet "$_qs^{commit}" >/dev/null || continue
      git merge-base --is-ancestor "$_qs" HEAD 2>/dev/null || continue
      # strictly later: the refusal's commit is an ancestor of the approval's, and they differ
      if [ "$_qs" != "$_rs" ] && git merge-base --is-ancestor "$_rs" "$_qs" 2>/dev/null; then _superseded="$_q"; fi
    done
    if [ -z "$_superseded" ]; then BLOCKING="$BLOCKING
     $_r — examined ${_rs:0:7}"; fi
  done
  if [ -n "$BLOCKING" ]; then
    echo "❌ RELEASE CHECK FAILED: a chain report refuses this release, and nothing supersedes it."
    echo "   These say DO NOT SHIP:$BLOCKING"
    echo "   A refusal is cleared by re-running that stage against a LATER commit and it saying"
    echo "   SHIP — not by adding another file beside it."
    exit 1
  fi

  CURRENT_AUDIT=""
  CURRENT_PM=""
  STALE_NOTES=""
  for _r in $AUDIT_ALL; do
    _why=$(check_report_current "$_r")
    if [ -z "$_why" ]; then [ -z "$CURRENT_AUDIT" ] && CURRENT_AUDIT="$_r"; else STALE_NOTES="$STALE_NOTES
     $_r — $_why"; fi
  done
  for _r in $PM_ALL; do
    _why=$(check_report_current "$_r")
    if [ -z "$_why" ]; then [ -z "$CURRENT_PM" ] && CURRENT_PM="$_r"; else STALE_NOTES="$STALE_NOTES
     $_r — $_why"; fi
  done
  if [ -z "$CURRENT_AUDIT" ] || [ -z "$CURRENT_PM" ]; then
    echo "❌ RELEASE CHECK FAILED: no CURRENT chain report for $GATE_VERSION."
    echo "   Finding a filename is not reading a report. app-v68 was gated by an audit of 51ba75f"
    echo "   while the head being shipped was 68d3dd6 — 67 further lines of index.html, a rewritten"
    echo "   treatmentActiveOn among them, that no auditor had ever seen. The report was NAMED for"
    echo "   v68, and the name was all this gate checked."
    [ -z "$CURRENT_AUDIT" ] && echo "   missing: a CURRENT outputs/AUDIT*${GATE_VERSION}* report saying VERDICT: SHIP"
    [ -z "$CURRENT_PM" ]    && echo "   missing: a CURRENT outputs/PM*${GATE_VERSION}* sign-off saying VERDICT: SHIP"
    if [ -n "$STALE_NOTES" ]; then
      echo "   Reports found, and why each is not current:$STALE_NOTES"
    fi
    echo "   Re-run that stage against the current tree, or drop the unaudited work to a later"
    echo "   version. Code that ships must be code someone read."
    exit 1
  fi
  AUDIT_REPORT="$CURRENT_AUDIT"
  PM_REPORT="$CURRENT_PM"
  if [ -n "$STALE_NOTES" ]; then
    echo "ℹ️  Other reports present and not clearing this release:$STALE_NOTES"
  fi
  echo "ℹ️  Chain artifacts present for $GATE_VERSION, and current against the working tree:"
  echo "     $AUDIT_REPORT"
  echo "     $PM_REPORT"
fi

if [ "$FAIL" -eq 1 ]; then
  exit 1
fi

echo "✅ Release check passed."
if [ -n "$INDEX_CHANGED" ]; then
  echo "   index.html changed and sw.js's CACHE constant changed with it -- installed"
  echo "   copies of the app will pick this up automatically on next open."
else
  echo "   No index.html changes vs $BASE_LABEL."
fi
exit 0
