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
# used `curl -fsS`, and `-f` makes curl fail on any 4xx/5xx. So the guard was asking "is something
# serving a page here" when the question is "is something ANSWERING here". Proved by starting a
# bare http.server on 8951 and sweeping against it: the refusal never fired and the sweep carried
# on. Without -f, curl exits 0 on ANY HTTP response and non-zero only when nothing answered, which
# is the actual question.
#
# WHAT THE SQUATTER ACTUALLY REPLIES IS NOT FIXED, and an earlier version of this comment asserted
# it was. This guard requests `/`, and a bare `python3 -m http.server` answers `/` with **200** and
# a directory listing when its directory exists, and 404 only when it does not (a deleted cwd --
# which is what the 404s in the original measurement were). Both exit 0 without -f, which is why
# the guard is correct either way; but "the squatter answers 404" was a detail of one run being
# reported as how squatters behave. The flag was never the whole story -- the requested PATH is
# equally load-bearing -- and the release's standing finding is records asserting more than the
# code guarantees.
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
  # mutants and getting 96 checks where the archived copy had 95. Copy the CONTENTS.
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
#
# AND ITS EXIT CODE IS KEPT. The first version piped node straight into `grep`, so the status was
# `grep`'s and the suite's own was thrown away -- the sweep judged redness purely by whether a
# `FAIL` line was printed. That is nearly always the same answer and it has one hole, which the
# app-v91 fifth audit measured: `contrast-scan` also exits non-zero on a PAGE ERROR, and a page
# error prints no FAIL line at all. A mutant that throws is therefore invisible to the text test
# -- and if it were labelled `MUTANT_EXPECT="survive"` it would be scored "SURVIVED AS EXPECTED"
# on a run the suite had refused. It cannot bite today (the only `survive` mutant is CSS and
# cannot throw), which is exactly the status every other defect in this family had the day before
# it bit. $LAST_STATUS is the suite's own.
# AND IT HAS TO REACH THE PARENT SHELL, which the first version of this did not. It set
# LAST_STATUS inside the function and every caller used `OUT=$(run_suite)` -- a command
# substitution, which is a SUBSHELL, so the assignment happened in a child and was discarded. The
# scoring code read the initialised 0 forever, the over-block branch below could never be true,
# and the sweep printed "and exited 0" about runs that had exited 1. A check that cannot fire, in
# the file whose only job is proving that checks fire, shipped in the commit that wrote down why
# the hole mattered. Found by an audit running it, not by reading it -- again.
#
# So run_suite assigns and the callers READ, with no substitution anywhere.
LAST_STATUS=0
LAST_OUT=""
run_suite() {
  LAST_OUT=$( cd "$WORK" && env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy \
      FALSIFY_BASE="http://127.0.0.1:$PORT/index.html" node "$SUITE" 2>&1 )
  LAST_STATUS=$?
  LAST_OUT=$(printf '%s\n' "$LAST_OUT" | grep -E "^  FAIL|checks:" || true)
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
run_suite; BASE="$LAST_OUT"
echo "$BASE"
# THE BASELINE IS HELD TO THE SAME "DID IT RUN" TEST AS EVERY MUTANT, and it was not. Each mutant
# below must produce a `checks:` summary or it is scored COULD NOT MEASURE -- while the run they are
# all calibrated against was checked only for the absence of a red. A baseline that died before its
# first check has no reds either, so the sweep would have proceeded to compare nineteen mutants against
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
# A MUTANT CAN BE EXPECTED TO SURVIVE, AND UNTIL NOW THERE WAS NO WAY TO SAY SO. Two kinds:
#
#   MUTANT_EXPECT_n="survive"  -- an OVER-BLOCK CONTROL. It changes something a real release might
#     legitimately contain (a slow page-gradient animation, say) and the suite MUST stay green. If
#     such a mutant is caught, that is a false alarm, and a check that cries wolf is the one that
#     gets `|| true` written beside it -- which has already happened in this repo. Catching it is
#     scored as a FAILURE of the sweep, the opposite of every other row.
#
#   MUTANT_EXPECT_n="hole"     -- a KNOWN OPEN HOLE, with its ticket named in the description. It
#     survives today and everyone knows why. Keeping it in the corpus is how the day it STARTS
#     dying is noticed, instead of the hole being rediscovered by a fourth audit. Scored neither
#     as a catch nor as a surprise -- printed, counted, and listed in the tally by name.
#
# Without this, the only honest way to keep either mutant was to leave it out of the corpus, and
# leaving it out is how the corpus stops describing the instrument.
DEAD=0; ALIVE=0; SURVIVED=0; UNMEASURED=0; STALE=0; OVERBLOCK=0; HOLE=0; EXPECTED_ALIVE=0
HOLE_LIST=""; OVERBLOCK_LIST=""
FROM="${FALSIFY_FROM:-1}"
TO="${FALSIFY_TO:-9999}"
i=1
while declare -F "mutant_$i" >/dev/null; do
  if [ "$i" -lt "$FROM" ] || [ "$i" -gt "$TO" ]; then i=$((i+1)); continue; fi
  desc_var="MUTANT_DESC_$i"
  expect_var="MUTANT_EXPECT_$i"
  EXPECT="${!expect_var:-die}"
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
    ALIVE=$((ALIVE+1)); STALE=$((STALE+1))
    find "$WORK" -mindepth 1 -delete
    git archive HEAD | tar -x -C "$WORK"
    cp -r test/. "$WORK/test/" || { echo "❌ could not copy the suite into the clone"; exit 1; }
    i=$((i+1))
    continue
  fi
  run_suite; OUT="$LAST_OUT"
  echo "$OUT"
  # FOUR OUTCOMES, NOT TWO -- and this comment said THREE while the code below scored four, which is
  # a small version of the thing the whole script exists to catch.
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
    [ "$_ran" = 1 ] || echo "  ℹ️  CAUGHT, but the suite ABORTED after its first red -- the counts above are partial."
    if [ "$EXPECT" = "survive" ]; then
      ALIVE=$((ALIVE+1)); OVERBLOCK=$((OVERBLOCK+1)); OVERBLOCK_LIST="$OVERBLOCK_LIST $i"
      echo "  ❌ OVER-BLOCK -- this mutant was expected to SURVIVE and the suite went red on it."
      echo "     It changes something a real release could legitimately contain, so this is a false"
      echo "     alarm, not a catch. A gate that fails legitimate work is the one that gets"
      echo "     disabled. Fix the check, not the mutant."
    else
      DEAD=$((DEAD+1))
      [ "$EXPECT" = "hole" ] && echo "  ✅ CAUGHT -- and this mutant was recorded as a KNOWN OPEN HOLE. The hole is closed;"
      [ "$EXPECT" = "hole" ] && echo "     update its MUTANT_EXPECT to \"die\" and close its ticket."
    fi
  elif [ "$_ran" = 0 ]; then
    ALIVE=$((ALIVE+1)); UNMEASURED=$((UNMEASURED+1))
    echo "  ⚠️  COULD NOT MEASURE -- the suite produced neither a red nor a summary, so it never ran."
    echo "      This is not a survivor and not a catch. Find out why before believing anything here."
  elif [ "$EXPECT" = "survive" ] && [ "$LAST_STATUS" -ne 0 ]; then
    # GREEN TEXT IS NOT A GREEN RUN. See run_suite's comment: a suite can exit non-zero with no
    # FAIL line (contrast-scan does it on a page error). Scoring that as "survived as expected"
    # would let an over-block control certify a run the suite actually refused.
    ALIVE=$((ALIVE+1)); OVERBLOCK=$((OVERBLOCK+1)); OVERBLOCK_LIST="$OVERBLOCK_LIST $i"
    echo "  ❌ OVER-BLOCK -- this mutant was expected to SURVIVE and printed no FAIL line, but the"
    echo "     suite exited $LAST_STATUS. A non-zero exit with no red line is a refusal, not a pass."
  elif [ "$EXPECT" = "survive" ]; then
    EXPECTED_ALIVE=$((EXPECTED_ALIVE+1))
    echo "  ✅ SURVIVED AS EXPECTED -- the suite stayed green on a change a real release could"
    echo "     legitimately contain, and exited 0. That is this mutant's job: it is the"
    echo "     over-block control."
  elif [ "$EXPECT" = "hole" ]; then
    HOLE=$((HOLE+1)); HOLE_LIST="$HOLE_LIST $i"
    echo "  ⚠️  SURVIVED -- KNOWN OPEN HOLE, and its description names the ticket. Not a surprise and"
    echo "     not a catch. It stays in the corpus so the day it starts dying is noticed."
  else
    ALIVE=$((ALIVE+1)); SURVIVED=$((SURVIVED+1))
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
  # mutants and getting 96 checks where the archived copy had 95. Copy the CONTENTS.
  cp -r test/. "$WORK/test/" || { echo "❌ could not copy the suite into the clone -- the sweep would run whatever git archive left there"; exit 1; }
  i=$((i+1))
done

echo ""
# THE TALLY MUST NOT COLLAPSE WHAT THE SCORING JUST SEPARATED. This line used to read
# "$DEAD caught, $ALIVE survived", and $ALIVE counts survivors AND mutants that could not be
# measured -- so a sweep where the suite never ran reported those runs to the reader as survivors,
# which is a different and much more alarming claim than the truth. The summary line is the only
# line most people read; it says which of the four outcomes actually happened.
# FOUR OUTCOMES SCORED, FOUR OUTCOMES PRINTED -- and the first version of this line printed
# THREE, which the independent audit caught by driving the tally block through all four. The
# DID-NOT-APPLY branch incremented only $ALIVE, so a stale anchor left
# $DEAD + $SURVIVED + $UNMEASURED short of the mutants attempted and vanished from the summary --
# in the very commit whose message was "the sweep stopped three times on a stale mutant and never
# said so". The exit code was right, so nothing could ship on it; the line a person reads was wrong.
echo "=== $DEAD mutant(s) caught, $SURVIVED survived unexpectedly, $UNMEASURED could not be measured, $STALE anchor(s) stale"
echo "=== $EXPECTED_ALIVE over-block control(s) correctly stayed green, $OVERBLOCK over-block(s) fired, $HOLE known open hole(s)"
[ -n "$HOLE_LIST" ] && echo "    known open holes still open: mutant(s)$HOLE_LIST -- see their descriptions for the ticket"
[ -n "$OVERBLOCK_LIST" ] && echo "    OVER-BLOCKS: mutant(s)$OVERBLOCK_LIST -- the suite failed a change it should have passed"
# A KNOWN OPEN HOLE DOES NOT FAIL THE SWEEP -- it is already written down and ticketed, and a sweep
# that is permanently red is a sweep nobody runs. An OVER-BLOCK does fail it, and so does an
# unexpected survivor, a mutant that could not be measured, and a stale anchor.
[ "$ALIVE" -eq 0 ] || exit 1
