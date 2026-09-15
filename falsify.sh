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

# REFUSE A PORT SOMETHING ELSE IS ALREADY SERVING, AND THIS SCRIPT CLAIMED TO DO IT FOR TWELVE
# COMMITS WITHOUT DOING IT. The README said "it also refuses a port something else is already
# serving"; the Scribe read all nine commits of this file and found no check of any kind. What
# actually happened was worse than nothing: `python3 -m http.server` is started with stderr to
# /dev/null, so a failed bind was silent, and the readiness curl then succeeded against THE OTHER
# PROCESS. The sweep would have judged whatever that server was serving while mutating $WORK
# underneath it -- which is precisely the failure the sentence claimed was fixed. A stale server was
# holding a port in this sandbox at the time it was found.
# AND THE FIRST VERSION OF THIS CHECK DID NOT WORK EITHER, for a reason worth writing down: it
# used `curl -fsS`, and `-f` makes curl FAIL on a 404. The thing most likely to be squatting this
# port is another `python3 -m http.server` in a directory with no index.html -- which answers 404.
# So the guard was asking "is something serving a page here", when the question is "is something
# ANSWERING here". Proved by starting a bare http.server on 8951 and running the sweep against it:
# five 404s, the refusal never fired, the sweep carried on. Without -f, curl exits 0 on any HTTP
# response including 404, and non-zero only when nothing answered -- which is the actual question.
if curl -sS --noproxy '*' --max-time 2 -o /dev/null "http://127.0.0.1:$PORT/" 2>/dev/null; then
  echo "❌ something is already answering on 127.0.0.1:$PORT."
  echo "   This sweep would have measured that server's files, not the clone it is about to build."
  echo "   Pick a free port with FALSIFY_PORT=<n>, or stop what is holding this one."
  exit 1
fi

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"; [ -n "${SRV:-}" ] && kill "$SRV" 2>/dev/null || true' EXIT
git archive HEAD | tar -x -C "$WORK"
# `cp -r test "$WORK/test"` NESTS when the destination exists -- and it always exists, because
  # `git archive HEAD` has just written it. So that line silently produced $WORK/test/test and the
  # sweep ran the ARCHIVED suite, not the working tree's. Harmless while the tree is committed, which
  # it always was; a trap the moment somebody sweeps with an edited suite, because this script
  # refuses a dirty index.html and says nothing about a dirty test/. Found by hand-running two
  # mutants and getting 96 checks where the suite has 95. Copy the CONTENTS.
  cp -r test/. "$WORK/test/" || { echo "❌ could not copy the suite into the clone -- the sweep would run whatever git archive left there"; exit 1; }

# NOT `( cd "$WORK" && python3 ... ) &`. That made $! the SUBSHELL, so the trap killed the wrapper
# and left the real server holding the port -- which is how a squatter appeared on this box in the
# first place, and the busy-port guard above exists because of one. `--directory` needs no subshell,
# so $! is the server itself and `kill` reaches it.
python3 -m http.server "$PORT" --directory "$WORK" >/dev/null 2>"$WORK/.server.err" &
SRV=$!
_up=0
for _ in $(seq 1 25); do
  # The server's own liveness is checked BEFORE the curl. A bind failure exits within milliseconds,
  # and without this the loop would spend ten seconds curling and then blame the network.
  if ! kill -0 "$SRV" 2>/dev/null; then break; fi
  if curl -fsS -o /dev/null --max-time 1 "http://127.0.0.1:$PORT/index.html" 2>/dev/null; then _up=1; break; fi
  sleep 0.4
done
if [ "$_up" != 1 ]; then
  echo "❌ the clone's server never came up on 127.0.0.1:$PORT."
  [ -s "$WORK/.server.err" ] && sed 's/^/   /' "$WORK/.server.err"
  exit 1
fi
# The server's own stderr is kept rather than discarded: a bind failure used to vanish into
# /dev/null and the readiness curl would then pass against somebody else's server.
#
# BUT `python3 -m http.server` WRITES ITS ACCESS LOG TO STDERR, so the first version of this warned
# on every healthy run -- one line per request, thousands of them across a sweep. A warning that
# always fires is a warning nobody reads, and it would have buried the bind failure it exists to
# surface underneath its own noise. The access lines are dropped and only what is left is shown.
_noise='^127\.0\.0\.1 - - \[.*\] "(GET|HEAD) .*" [0-9]{3} -$'
if grep -Ev "$_noise" "$WORK/.server.err" 2>/dev/null | grep -q .; then
  echo "⚠️  the clone's server wrote to stderr:"
  grep -Ev "$_noise" "$WORK/.server.err" | sed 's/^/   /'
fi

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
# THE BASELINE IS HELD TO THE SAME "DID IT RUN" TEST AS EVERY MUTANT, and it was not. Each mutant
# below must produce a `checks:` summary or it is scored COULD NOT MEASURE -- while the run they are
# all calibrated against was checked only for the absence of a red. A baseline that died before its
# first check has no reds either, so the sweep would have proceeded to compare twelve mutants against
# nothing at all. An audit found this one line after the mutant half had already been fixed, which is
# the usual shape: the guard goes on the thing you were thinking about and not on the thing beside it.
if ! echo "$BASE" | grep -q "checks:"; then
  echo "❌ the baseline produced no summary line, so the suite never finished on HEAD."
  echo "   Nothing below would mean anything. Find out why before running a sweep."
  exit 1
fi
if echo "$BASE" | grep -q "^  FAIL"; then
  echo "❌ the suite is not green on HEAD. Fix that before falsifying anything."
  exit 1
fi

# FALSIFY_FROM / FALSIFY_TO -- run a SLICE of the sweep, because the whole thing no longer fits.
# Nineteen mutants at five to eight minutes each is over two hours, and a run that hits its own
# ceiling prints a truncated log that looks exactly like a finished one in anything filtered. That
# has now happened twice. A slice finishes, says so, and the slices together are the sweep -- which
# is honest, where "it probably would have passed" is not. Always state which slice a result covers.
DEAD=0; ALIVE=0
FROM="${FALSIFY_FROM:-1}"
TO="${FALSIFY_TO:-9999}"
i=1
while declare -F "mutant_$i" >/dev/null; do
  if [ "$i" -lt "$FROM" ] || [ "$i" -gt "$TO" ]; then i=$((i+1)); continue; fi
  desc_var="MUTANT_DESC_$i"
  echo ""
  echo "=== MUTANT $i: ${!desc_var:-（no description）}"
  # A MUTANT THAT DOES NOT APPLY IS NOT A MUTANT THAT PASSED. Each one asserts its anchor matches
  # exactly once, which is right -- but under `set -e` a failed assert killed the sweep where it
  # stood, with the log ending on this mutant's header and the pipeline exiting 0. That is how
  # mutant 18 silently ended three consecutive sweeps after the line it anchors on was rewritten:
  # the mutants file had gone stale against the code, which is worth knowing and is invisible if
  # the sweep simply stops. Counted as NOT caught, because an unmeasured mutant is not a passed one.
  if ! ( cd "$WORK" && "mutant_$i" ); then
    echo "  ❌ DID NOT APPLY -- this mutant's anchor no longer matches the file, so the sweep cannot"
    echo "     judge it. Update the mutant. Counted as not caught."
    ALIVE=$((ALIVE+1))
    find "$WORK" -mindepth 1 -delete
    git archive HEAD | tar -x -C "$WORK"
    cp -r test/. "$WORK/test/" || { echo "❌ could not copy the suite into the clone"; exit 1; }
    i=$((i+1))
    continue
  fi
  OUT=$(run_suite)
  echo "$OUT"
  # THREE OUTCOMES, NOT TWO -- and the third is the one this script used to hide.
  #
  # Scoring on "is there a FAIL line" alone means a mutant that makes the suite DIE -- a page that
  # never loads, a locator that times out and takes the process with it -- is scored CAUGHT, on the
  # strength of nothing. Mutant 8 does exactly that today: it prints one correct red and then the
  # section after it times out, so the run has no `checks:` summary at all. That red happens to be
  # the right one, so the verdict was right by luck, and "right by luck" is how an instrument that
  # reports success loudest when it can see nothing gets left in place. The same class as the clone
  # that was never rebuilt, and as a check that passes on its own precondition.
  #
  # So: a summary line is what says the suite RAN. A red with no summary is still a catch, and says
  # so in those words. NO red and NO summary is not a catch at all -- it is a measurement that did
  # not happen, and it fails the sweep like a survivor, because that is what it is.
  # `echo "$OUT" | grep -q "checks:" && _ran=1` UNDER `set -e` KILLS THE SCRIPT when the grep finds
  # nothing -- an `A && B` list whose A fails returns non-zero, and that is exactly the case this
  # line exists to detect. So the guard written to catch a mutant that produces no output made the
  # sweep exit silently the first time one did: the log ended on a header, the final tally never
  # printed, and the pipeline still exited 0. A truncated sweep that looks finished, produced by the
  # check for sweeps that look finished. `if` has no such behaviour.
  _ran=0
  if echo "$OUT" | grep -q "checks:"; then _ran=1; fi
  if echo "$OUT" | grep -q "^  FAIL"; then
    DEAD=$((DEAD+1))
    [ "$_ran" = 1 ] || echo "  ℹ️  CAUGHT, but the suite ABORTED after its first red -- the counts above are partial."
  elif [ "$_ran" = 0 ]; then
    ALIVE=$((ALIVE+1))
    echo "  ⚠️  COULD NOT MEASURE -- the suite produced neither a red nor a summary, so it never ran."
    echo "      This is not a survivor and not a catch. Find out why before believing anything here."
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
# `cp -r test "$WORK/test"` NESTS when the destination exists -- and it always exists, because
  # `git archive HEAD` has just written it. So that line silently produced $WORK/test/test and the
  # sweep ran the ARCHIVED suite, not the working tree's. Harmless while the tree is committed, which
  # it always was; a trap the moment somebody sweeps with an edited suite, because this script
  # refuses a dirty index.html and says nothing about a dirty test/. Found by hand-running two
  # mutants and getting 96 checks where the suite has 95. Copy the CONTENTS.
  cp -r test/. "$WORK/test/" || { echo "❌ could not copy the suite into the clone -- the sweep would run whatever git archive left there"; exit 1; }
  i=$((i+1))
done

echo ""
echo "=== $DEAD mutant(s) caught, $ALIVE survived"
[ "$ALIVE" -eq 0 ] || exit 1
