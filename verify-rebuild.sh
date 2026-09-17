#!/usr/bin/env bash
# VERIFY THAT THE DOCUMENTED REBUILD PATH PRODUCES AN APP THAT BOOTS.
#
# WHY THIS EXISTS. `harness-v84-whatsnew.py` is listed as the way to rebuild app-v84 from app-v83,
# and for two audit rounds it produced a file that threw at module evaluation and rendered an empty
# `#root` -- while printing "OK -- What's New applied". Four separate records said the release was
# reproducible from base + patch and that the result had been verified by loading it. It had not.
# A rebuild path nobody loads is a rebuild path that rots, and it rots silently, because the script
# exiting 0 looks exactly like success.
#
# WHAT IT DOES. Checks out the base commit's index.html into a throwaway copy of HEAD, runs the
# patch script on it, serves it, loads it in a real browser and asks three questions: did the module
# throw, did anything render, and did evaluation reach the LAST line of the module (which is what
# the debug-hook block proves). It does NOT assert byte-equality with HEAD -- fourteen commits of
# audit fixes have no patch scripts, which README.md records -- so this is a boot check, not a
# reproducibility proof, and saying otherwise would be the same overstatement this release keeps
# finding in its own records.
set -euo pipefail

BASE_COMMIT="${REBUILD_BASE:-aaeca4f}"
SCRIPT="${REBUILD_SCRIPT:-harness-v84-whatsnew.py}"
PORT="${REBUILD_PORT:-8969}"

# Same question, and the same wrong first answer, as falsify.sh: `curl -f` FAILS on a 404, and a
# squatting http.server in a directory with no index answers 404. Without -f, curl exits 0 on any
# HTTP response and non-zero only when nothing answered -- which is the question being asked.
if curl -sS --noproxy '*' --max-time 2 -o /dev/null "http://127.0.0.1:$PORT/" 2>/dev/null; then
  echo "❌ something is already answering on 127.0.0.1:$PORT -- pick another with REBUILD_PORT=<n>."
  exit 1
fi

# IT JUDGES HEAD, SO IT REFUSES A DIRTY SCRIPT -- the same rule falsify.sh applies to index.html,
# and for the same reason. `git archive HEAD` writes the COMMITTED script into the clone, so an
# uncommitted fix to the patch script is not what gets run, and the first run of this check reported
# a dead app against a fix sitting in the working tree. A result that describes neither the tree nor
# the commit is worse than no result.
# BOTH HALVES MUST JUDGE THE SAME TREE, and they did not. The boot half rebuilds from
# `git archive HEAD`; the drift half reads index.html from the WORKING TREE. With index.html dirty,
# this script compared a patch payload against one file and then booted another -- a green board
# describing no single state of the repo. falsify.sh has refused a dirty index.html since the day
# it was written, for the same reason; this one did not, and an audit caught the asymmetry.
if [ -n "$(git status --porcelain -- "$SCRIPT" index.html)" ]; then
  echo "❌ $SCRIPT or index.html has uncommitted changes, and this check judges HEAD."
  echo "   Commit it first -- otherwise the clone runs the committed script and the verdict is"
  echo "   about neither the file you edited nor the one in the artifact."
  exit 1
fi

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"; [ -n "${SRV:-}" ] && kill "$SRV" 2>/dev/null || true' EXIT

git archive HEAD | tar -x -C "$WORK"
git show "$BASE_COMMIT:index.html" > "$WORK/index.html"

# DRIFT FIRST, BOOT SECOND -- because a stale payload still boots.
# The script copies text out of index.html. That is a fact about the day it was copied, not a
# property that holds: the app moved one character twenty minutes after the lift and the rebuild
# went quietly back to producing a file the app no longer is, with this gate green throughout.
# A boot check cannot see that; only a comparison can.
# The payload is compared against the release the SCRIPT BUILDS, not against HEAD. Once the app
# moves on (app-v85 shipped while this script still builds app-v84) HEAD is the wrong yardstick:
# the script is not stale, it is simply historical. REBUILD_TARGET names that release's commit.
# PINNED, NOT SEARCHED. The first version of this resolved the target with
#   git rev-list -1 --grep='^app-v84' HEAD || echo HEAD
# and an audit found three faults in that one line. It selects on the COMMIT MESSAGE, not on file
# content: fifteen commits match, and one of them carries APP_VERSION 'app-v82' -- had it been the
# most recent, the check would have compared an app-v84 payload against an app-v82 file and said
# nothing. `git rev-list -1` exits 0 with EMPTY output when nothing matches, so the `|| echo HEAD`
# fallback could never fire; the command degraded to `git show ":index.html"`, which git accepts as
# index.html FROM THE STAGING AREA. Three ways to be quietly wrong in one clever line.
#
# EVERY RELEASE MUST ADVANCE THESE TWO. Both sides are immutable commits now, so this reads 17/17
# for ever and can only fail if someone edits the historical patch script -- which means it says
# nothing about THIS release unless REBUILD_SCRIPT and REBUILD_TARGET are moved to it. There is no
# harness-v85-*.py yet, so app-v85's own reproducibility is currently unverified, and that is
# stated rather than implied by a green tick.
REBUILD_TARGET="${REBUILD_TARGET:-d38e36a}"   # the commit whose index.html IS app-v84
TARGET_SRC="$WORK/.target-index.html"
git show "$REBUILD_TARGET:index.html" > "$TARGET_SRC" || {
  echo "❌ REBUILD_TARGET=$REBUILD_TARGET does not resolve to a commit with an index.html."
  echo "   It must name the release $SCRIPT builds. Do not fall back to HEAD -- comparing a"
  echo "   patch script against a later release is how this check goes permanently red."
  exit 1
}
_tgt_ver=$(grep -m1 -o "const APP_VERSION = 'app-v[0-9]*'" "$TARGET_SRC" || true)
echo "→ patch script targets: $_tgt_ver (commit $REBUILD_TARGET)"
echo "→ checking every piece of app text the patch script carries is still the app's"
APP_SRC="$TARGET_SRC" python3 test/harness-payload-matches-app.py || {
  echo "❌ $SCRIPT no longer copies the app. Re-extract what it names; do not hand-edit."
  exit 1
}
echo

echo "→ rebuilding $BASE_COMMIT + $SCRIPT"
( cd "$WORK" && python3 "$SCRIPT" )

# `--directory` rather than a `( cd ... ) &` subshell, so $! is the server and not its wrapper.
# With the subshell, the trap killed the wrapper and the server kept the port -- the first run of
# this script left exactly that squatter behind and the second run refused to start because of it.
python3 -m http.server "$PORT" --directory "$WORK" >/dev/null 2>&1 &
SRV=$!
_up=0
for _ in $(seq 1 25); do
  if ! kill -0 "$SRV" 2>/dev/null; then break; fi
  if curl -fsS -o /dev/null --max-time 1 "http://127.0.0.1:$PORT/index.html" 2>/dev/null; then _up=1; break; fi
  sleep 0.4
done
[ "$_up" = 1 ] || { echo "❌ the rebuilt clone's server never came up on 127.0.0.1:$PORT."; exit 1; }

env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy \
  BASE="http://127.0.0.1:$PORT/index.html" node test/rebuild-boots.mjs
