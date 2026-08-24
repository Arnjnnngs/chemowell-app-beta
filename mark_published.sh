#!/bin/bash
# Run this IMMEDIATELY AFTER a successful push, then commit the result.
#
# It records the commit, APP_VERSION and sw.js CACHE that are now live in PUBLISHED.json, which is
# the baseline release_check.sh trusts. See the _comment block in that file for why a committed
# record is used instead of origin/main: this sandbox has no network, pushes are manual web
# uploads, and origin/main therefore silently points one release behind reality forever.
#
# Usage:  ./mark_published.sh            # records HEAD
#         ./mark_published.sh <commit>   # records a specific commit
#
# Run `git fetch origin` FIRST. With no argument this records origin/main, whose SHA is the one the
# remote actually has and therefore the one that still resolves after any future fetch.
set -euo pipefail
cd "$(dirname "$0")"

# Default to origin/main, NOT HEAD (fixed 2026-08-11, after the previous default broke in practice).
# This script used to record the local commit, on the reasoning that a GitHub web upload mints its
# own SHA which this sandbox has never seen. That was true and still wrong: `git fetch` DOES work
# here (only push is refused), so the moment anyone fetches and fast-forwards, local history is
# replaced by the remote's and the recorded SHA stops existing -- release_check.sh then silently
# degrades to its origin/main fallback, which is the guard it was written to replace. Observed
# exactly that on 2026-08-11 with commit 60434dc. origin/main's SHA survives a fetch, because it IS
# what the remote says. Fetch first, then run this.
if [ -z "${1:-}" ] && git rev-parse --verify --quiet origin/main >/dev/null; then
  echo "ℹ️  Recording origin/main. If you have not fetched since the upload, Ctrl-C now and run:"
  echo "   git fetch origin && git status"
fi
REF="${1:-origin/main}"
SHA=$(git rev-parse --verify "$REF^{commit}")

# Read from the COMMIT, not the working tree. If the tree has moved on since the commit that was
# actually uploaded, recording the tree's values would put a build in this file that nobody can
# load -- the precise class of lie this file exists to prevent.
VERSION=$(git show "$SHA":index.html | grep -o "APP_VERSION = '[^']*'" | head -1 | sed "s/.*'\(.*\)'/\1/")
CACHE=$(git show "$SHA":sw.js | grep -o "CACHE = '[^']*'" | head -1 | sed "s/.*'\(.*\)'/\1/")

if [ -z "$VERSION" ] || [ -z "$CACHE" ]; then
  echo "❌ Could not read APP_VERSION and/or CACHE out of commit $SHA. Nothing written."
  exit 1
fi

if [ -n "$(git status --porcelain -- index.html sw.js)" ] && [ "$REF" = "HEAD" ]; then
  echo "⚠️  WARNING: index.html and/or sw.js have uncommitted changes."
  echo "   Recording commit $(git rev-parse --short "$SHA") anyway, because that is what could"
  echo "   have been uploaded. If you uploaded the working tree instead, commit it first and"
  echo "   re-run -- otherwise this record names a build that does not exist anywhere."
fi

DATE=$(git show -s --format=%cd --date=short "$SHA")

python3 - "$SHA" "$VERSION" "$CACHE" "$DATE" <<'PY'
import json, sys, io
sha, version, cache, date = sys.argv[1:5]
with io.open('PUBLISHED.json', encoding='utf-8') as f:
    data = json.load(f)
data['commit'] = sha
data['app_version'] = version
data['cache'] = cache
data['published_at'] = date
with io.open('PUBLISHED.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
    f.write('\n')
PY

echo "✅ PUBLISHED.json now records:"
echo "   commit      $SHA"
echo "   APP_VERSION $VERSION"
echo "   CACHE       $CACHE"
echo "   published   $DATE"
echo
echo "   Commit this file now. release_check.sh uses it as the baseline for the next release."
