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
if [ -n "$(git status --porcelain -- "$SCRIPT")" ]; then
  echo "❌ $SCRIPT has uncommitted changes, and this check judges HEAD."
  echo "   Commit it first -- otherwise the clone runs the committed script and the verdict is"
  echo "   about neither the file you edited nor the one in the artifact."
  exit 1
fi

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"; [ -n "${SRV:-}" ] && kill "$SRV" 2>/dev/null || true' EXIT

git archive HEAD | tar -x -C "$WORK"
git show "$BASE_COMMIT:index.html" > "$WORK/index.html"

# DRIFT FIRST, BOOT SECOND -- because a stale payload still boots.
# The script embeds blocks of index.html verbatim. That is a fact about the day they were lifted,
# not a property that holds: the app moved one character twenty minutes after the lift and the
# rebuild went quietly back to producing a file the app no longer is, with this gate still green.
# A boot check cannot see that; only a comparison can.
echo "→ checking the patch script's payload still matches the app"
node test/harness-payload-matches-app.mjs || {
  echo "❌ $SCRIPT no longer copies the app. Re-extract the blocks it reports; do not hand-edit."
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
