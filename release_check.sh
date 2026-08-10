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

# THE BASE REF IS THE WHOLE POINT (fixed 2026-08-10, found by the app-v52 PM gate).
# This script used to diff against HEAD, i.e. only UNCOMMITTED work. That made it pass green on
# the exact failure it exists to block: APP_CLAUDE.md rule 8 says commit early and often, and
# pushes here are manual GitHub web uploads of files that are already committed -- so by the time
# anyone runs this, the risky change is in a commit and `git diff HEAD` is empty. The PM
# reproduced it on a scratch clone: commit an index.html-only change with no sw.js bump, run this,
# get "No index.html changes vs $BASE. and exit 0. A safety net that only inspects the one state
# the workflow never pushes from is not a safety net.
#
# Now it diffs against what is actually LIVE (origin/main by default), which is the real question:
# "does the delta I am about to publish change index.html without bumping the cache?" The old
# HEAD check is kept below as an additional uncommitted-work warning, since work-in-progress that
# forgets the bump is still worth flagging early.
BASE="${BASE_REF:-origin/main}"
if ! git rev-parse --verify --quiet "$BASE" >/dev/null; then
  echo "⚠️  WARNING: base ref '$BASE' not found (no network, or a fresh clone?)."
  echo "   Falling back to HEAD, which only sees UNCOMMITTED work -- this will NOT catch a"
  echo "   committed index.html change that forgot the sw.js bump. Run 'git fetch origin' and"
  echo "   re-run before pushing, or set BASE_REF explicitly."
  BASE="HEAD"
fi

INDEX_CHANGED=$(git diff --name-only "$BASE" -- index.html)

# Secondary: uncommitted work that already forgets the bump, caught before it is even committed.
UNCOMMITTED_INDEX=$(git diff --name-only HEAD -- index.html)
UNCOMMITTED_SW=$(git diff HEAD -- sw.js)
if [ -n "$UNCOMMITTED_INDEX" ] && [ -z "$UNCOMMITTED_SW" ] && [ -z "$INDEX_CHANGED" ]; then
  echo "⚠️  WARNING: uncommitted index.html changes with no sw.js bump yet."
  echo "   Not blocking (nothing is being published from the working tree), but bump CACHE"
  echo "   before this gets committed and pushed."
fi

# V53-4 (Auditor): comparing the whole sw.js diff let a cosmetic sw.js edit satisfy the check while
# CACHE stayed put -- the script then printed "sw.js's CACHE constant changed with it", which was
# untrue and is the exact stranding it exists to block. Compare the CACHE constant itself.
CACHE_OLD=$(git show "$BASE":sw.js 2>/dev/null | grep -o "CACHE = '[^']*'" || echo "none")
CACHE_NEW=$(grep -o "CACHE = '[^']*'" sw.js || echo "none")
if [ -n "$INDEX_CHANGED" ] && [ "$CACHE_OLD" = "$CACHE_NEW" ]; then
  echo "❌ RELEASE CHECK FAILED: index.html differs from $BASE, but sw.js's CACHE"
  echo "   constant was not bumped. Anyone with the app already open or installed will"
  echo "   NEVER see this update -- the service worker will keep serving the old cached"
  echo "   copy indefinitely, with no error to signal it."
  echo
  echo "   Fix: bump the CACHE constant at the top of sw.js (e.g. 'chemowell-app-v41-1'),"
  echo "   then re-run this script."
  FAIL=1
fi

# APP_VERSION is just the on-screen build label (drawer footer) -- not load-bearing for the
# caching bug above, but it should still track reality so a screenshot of the drawer is a
# reliable way to confirm which build someone is on. Warn, don't hard-block, since a stale
# label doesn't strand anyone the way a stale sw.js cache does.
if [ -n "$INDEX_CHANGED" ]; then
  OLD_VERSION=$(git show "$BASE":index.html | grep -o "APP_VERSION = '[^']*'" || echo "none")
  NEW_VERSION=$(grep -o "APP_VERSION = '[^']*'" index.html || echo "none")
  if [ "$OLD_VERSION" = "$NEW_VERSION" ]; then
    echo "⚠️  WARNING: index.html changed but APP_VERSION ($NEW_VERSION) wasn't bumped."
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
  echo "   No index.html changes vs $BASE."
fi
exit 0
