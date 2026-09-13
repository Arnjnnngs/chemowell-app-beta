#!/bin/bash
# ChemoWell session guard -- runs at SessionStart, and again at Stop.
#
# WHY THIS EXISTS. On 2026-09-13 Aaron found the medication disclaimer in this app -- the one place
# it gives safety guidance about medication -- reading "Follow her care team." The "her" is the owner's
# wife, whose own app (care-tracker) is a sibling of this one. He had given the same directive on
# 2026-08-19 and it had not been carried out.
#
# The mechanism was a filename: this repo's rules lived in APP_CLAUDE.md, which Claude Code does not
# auto-load, so the ONLY instruction file any session ever loaded was care-tracker/CLAUDE.md -- 719
# lines naming her nine times and listing four of her medications. Every session was briefed on her
# and never on this product.
#
# Renaming the file fixed the missing brief. It did NOT fix the extra one: all three repos sit under
# one working directory, so reading any file in care-tracker still pulls its instructions in. This
# hook is what makes that visible instead of silent.
#
# It NEVER blocks work -- a guard that stops a session gets disabled the first time it is wrong, and
# then it protects nothing. It prints, loudly, on every session.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PARENT="$(dirname "$ROOT")"

echo ""
echo "================================================================"
echo " CHEMOWELL IS A PRODUCT. Every user is a different patient."
echo " None of them is the owner's wife. Her app is care-tracker."
echo "================================================================"
echo ""

# Is the other patient's app visible from here?
if [ -f "$PARENT/care-tracker/CLAUDE.md" ]; then
  echo " ⚠  care-tracker is in this working directory."
  echo "    Its CLAUDE.md names one specific patient and lists her medications,"
  echo "    and reading ANY file in it pulls those instructions into this session."
  echo ""
  echo "    DO NOT open care-tracker files from a ChemoWell session. If care-tracker"
  echo "    work is needed, it gets its OWN session. That separation is the fix;"
  echo "    this message is only the reminder that it is not automatic."
  echo ""
fi

# The four shapes, checked rather than described. Never blocks; always reports.
if [ -f "$ROOT/test/v75-no-other-patient.mjs" ]; then
  if ( cd "$ROOT" && node test/v75-no-other-patient.mjs >/tmp/cw-guard.log 2>&1 ); then
    echo " ✓  No-other-patient check: clean (name, pronouns, hardcoded doses, id-keyed rules)."
  else
    echo " ✗  NO-OTHER-PATIENT CHECK FAILED -- one patient has leaked into this product."
    echo ""
    sed -n '/FAIL/p' /tmp/cw-guard.log | head -12 | sed 's/^/    /'
    echo ""
    echo "    Full output: /tmp/cw-guard.log    Rule 0 in CLAUDE.md explains each shape."
  fi
else
  echo " ⚠  test/v75-no-other-patient.mjs is missing. That check is the only"
  echo "    mechanical guard against this class; it should not be deleted."
fi
echo ""
exit 0
