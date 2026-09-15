#!/bin/bash
# falsify.sh -- run a falsification sweep WITHOUT destroying work in progress.
#
# WHY THIS EXISTS, and it is not hypothetical. Falsifying a check means breaking the code on
# purpose, watching the check go red, and restoring it. Done by hand in the working tree, that
# creates a window in which the tree is deliberately wrong, and this session fell into it TWICE in
# one day:
#
#   1. A commit landed between "break" and "restore", so the branch carried a weight Log button
#      wired to nothing. Nothing in the release chain caught it -- a git hook did.
#   2. A background sweep's `git checkout -- index.html` silently reverted three finished fixes
#      that had been written while it was running, and later a fourth. The suite went green
#      afterwards, because it was green about the reverted file.
#
# Both are the same root cause: THE SWEEP AND THE BUILD SHARE ONE WORKING TREE. This script does
# not share it. Every mutant is applied to a throwaway clone of HEAD, the suite runs against that
# clone on its own port, and the real working tree is never touched at all -- so a sweep can run
# while work continues beside it, which is the whole reason the temptation existed.
#
# Usage:  ./falsify.sh <suite-path> <mutants-file>
#   <mutants-file> is a shell file defining mutants as functions named mutant_1, mutant_2, ...
#   each with a MUTANT_DESC_n description. Each function edits index.html IN THE CLONE.
set -euo pipefail
cd "$(dirname "$0")"

SUITE="${1:?usage: ./falsify.sh <suite-path> <mutants-file>}"
MUTANTS="${2:?usage: ./falsify.sh <suite-path> <mutants-file>}"
PORT="${FALSIFY_PORT:-8877}"

if [ -n "$(git status --porcelain -- index.html)" ]; then
  echo "❌ index.html has uncommitted changes."
  echo "   A sweep judges HEAD, so commit first -- otherwise the mutants are applied on top of"
  echo "   work that is not in the artifact, and the result describes neither."
  exit 1
fi

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"; [ -n "${SRV:-}" ] && kill "$SRV" 2>/dev/null || true' EXIT
git archive HEAD | tar -x -C "$WORK"
cp -r test "$WORK/test" 2>/dev/null || true

( cd "$WORK" && python3 -m http.server "$PORT" >/dev/null 2>&1 ) &
SRV=$!
for _ in $(seq 1 25); do curl -fsS -o /dev/null --max-time 1 "http://127.0.0.1:$PORT/index.html" && break; sleep 0.4; done

# The suite is pointed at the clone's port by environment, never by editing the suite.
run_suite() {
  ( cd "$WORK" && env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy \
      FALSIFY_BASE="http://127.0.0.1:$PORT/index.html" node "$SUITE" 2>&1 ) \
    | grep -E "^  FAIL|checks:" || true
}

# shellcheck disable=SC1090
source "$MUTANTS"

# RUN THIS ALONE. Not a style preference -- measured on 2026-09-15: started beside eight browser
# suites on the same box, the BASELINE came back 70/80 on a build that scores 80/80 by itself, and
# ten reds about nothing is exactly as useless as a green that means nothing. The suites here drive
# real gestures with real timings (a 320ms window, a touch fling, a one-second render tick), and
# those are the first things a loaded machine distorts. If the baseline is red, check what else is
# running before you believe it -- and do not filter the FAIL lines out of this script's output,
# because they are what tells you which it was.
echo "=== BASELINE (no mutant) -- every check must be green before any of them mean anything"
BASE=$(run_suite)
echo "$BASE"
if echo "$BASE" | grep -q "^  FAIL"; then
  echo "❌ the suite is not green on HEAD. Fix that before falsifying anything."
  exit 1
fi

DEAD=0; ALIVE=0
i=1
while declare -F "mutant_$i" >/dev/null; do
  desc_var="MUTANT_DESC_$i"
  echo ""
  echo "=== MUTANT $i: ${!desc_var:-（no description）}"
  ( cd "$WORK" && "mutant_$i" )
  OUT=$(run_suite)
  echo "$OUT"
  if echo "$OUT" | grep -q "^  FAIL"; then
    DEAD=$((DEAD+1))
  else
    ALIVE=$((ALIVE+1))
    echo "  ⚠️  SURVIVED -- no check went red. Either the check cannot fail, or this mutant is a no-op."
  fi
  # Rebuild the clone IN PLACE. `rm -rf "$WORK"; mkdir "$WORK"` looks equivalent and is not:
  # the http.server subshell holds "$WORK" as its working directory, so deleting the directory
  # leaves that process sitting on a deleted inode and serving nothing. Every mutant after the
  # first would then fail the suite for want of a page, be scored as CAUGHT, and the sweep would
  # report a clean sheet it never measured. Emptying the directory keeps the inode the server
  # holds, so the same server serves the rebuilt files.
  find "$WORK" -mindepth 1 -delete
  git archive HEAD | tar -x -C "$WORK"
  cp -r test "$WORK/test" 2>/dev/null || true
  i=$((i+1))
done

echo ""
echo "=== $DEAD mutant(s) caught, $ALIVE survived"
[ "$ALIVE" -eq 0 ] || exit 1
