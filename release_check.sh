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
# ...AND origin/main IS NOT THAT BASELINE HERE (fixed 2026-08-11, found by the app-v53 PM gate).
# Pushes in this project are manual GitHub web uploads and this sandbox has no network, so
# origin/main is never fetched after a push -- one release later it points at the release BEFORE
# the one that is actually live. A CACHE bumped in the PREVIOUS release then still reads as
# "bumped" against that stale base and this script prints a green tick on a build that never
# bumped it. Reproduced exactly on a scratch clone; it is the app-v40 failure wearing a ✅.
#
# The fix is PUBLISHED.json: a COMMITTED record of what is live, written by ./mark_published.sh as
# part of the push itself, so it cannot drift the way a remote ref does. Baseline resolution, in
# order of how much the answer can be trusted:
#   1. $BASE_REF          -- explicit override, for scratch clones and for testing this script.
#   2. PUBLISHED.json     -- the recorded live commit, cross-checked against its own sw.js.
#   3. origin/main        -- with a loud staleness warning; better than nothing.
#   4. HEAD               -- uncommitted work only. Warns hard, because it catches almost nothing.
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
  REC_CACHE=$(git show "$PUB_COMMIT":sw.js 2>/dev/null | read_cache)
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
  echo "⚠️  WARNING: no usable PUBLISHED.json record, falling back to origin/main."
  echo "   This sandbox cannot fetch, so origin/main may be a release behind what is really live,"
  echo "   which would let a CACHE bumped in the PREVIOUS release satisfy the check below."
  echo "   Run ./mark_published.sh after your next push to close this."
else
  BASE="HEAD"
  echo "⚠️  WARNING: no PUBLISHED.json and no origin/main. Falling back to HEAD, which only sees"
  echo "   UNCOMMITTED work -- this will NOT catch a committed index.html change that forgot the"
  echo "   sw.js bump. Set BASE_REF explicitly before trusting this run."
fi

INDEX_CHANGED=$(git diff --name-only "$BASE" -- index.html)
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
CACHE_OLD=$(git show "$BASE":sw.js 2>/dev/null | read_cache)
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
  OLD_VERSION=$(git show "$BASE":index.html | grep -o "APP_VERSION = '[^']*'" | head -1 | sed "s/.*'\(.*\)'/\1/")
  NEW_VERSION=$(grep -o "APP_VERSION = '[^']*'" index.html | head -1 | sed "s/.*'\(.*\)'/\1/")
  if [ "$OLD_VERSION" = "$NEW_VERSION" ]; then
    echo "⚠️  WARNING: index.html changed but APP_VERSION is still $NEW_VERSION."
    echo "   Not blocking, but the version shown in the app's drawer will be stale."
  fi
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
