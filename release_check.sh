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

INDEX_CHANGED=$(git diff --name-only HEAD -- index.html)
SW_DIFF=$(git diff HEAD -- sw.js)

if [ -n "$INDEX_CHANGED" ] && [ -z "$SW_DIFF" ]; then
  echo "❌ RELEASE CHECK FAILED: index.html has unpushed changes, but sw.js's CACHE"
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
  OLD_VERSION=$(git show HEAD:index.html | grep -o "APP_VERSION = '[^']*'" || echo "none")
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
  echo "   No index.html changes pending."
fi
exit 0
