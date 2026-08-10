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
set -euo pipefail
cd "$(dirname "$0")"

REF="${1:-HEAD}"
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
