#!/usr/bin/env python3
"""app-v81 round 12 -- what the narrowed rule ADMITS, which nobody had asked.

THE AUDIT SAID SHIP. This round is not a fix for a block; it is the process failure the audit named
three rounds running, acted on.

**Every mutant written for this parser across five rounds mutates the rule TOWARDS the previous
round's behaviour.** They all ask "does the tightening still hold". Not one asks "what does the
narrowed rule now let through". A board that tests one direction is a board that keeps discovering
the other one in an audit -- which is exactly what rounds 8, 9, 10 and 11 were.

So six LOOSENING mutants were written, and three of them survived: the board could not see the
difference between the shipping rule and a materially looser one. One of those three is a real
defect and is fixed here; the other two are correct behaviour that nothing pinned, and are pinned.

THE FIX: A PHARMACY WRITES A SEPARATOR. `5/325 mg - 1 tablet` and `5/325 mg: 2 tabs` are the same
dose as `5/325 mg 1 tablet`, and the gap test rejected them because a dash or a colon is not
whitespace. So the count was dropped and the limit went unapplied -- disclosed, but for no reason
anybody would defend. The gap now allows the punctuation a label uses between a strength and a
count, and nothing else: `5/325 mg - max 8 tabs` is still refused, because `max` is still a word in
between.

(A comma never reaches this test -- it splits the Dosage options line into two buttons long before.)
"""
import sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent
HTML = ROOT / 'index.html'

def die(msg):
    print('PATCH FAILED: ' + msg); sys.exit(1)

src = HTML.read_text(encoding='utf-8')
OLD = """const ONLY_UNIT_AND_BRACKETS = /^\\s*[A-Za-z%]*(?:\\/[A-Za-z%]+)?\\s*[([]?\\s*$/;"""
NEW = """// A DASH OR A COLON IS HOW A LABEL SEPARATES THE STRENGTH FROM THE COUNT, and rejecting them cost
// a real count for no reason anyone would defend: "5/325 mg - 1 tablet" is the same dose as
// "5/325 mg 1 tablet". Found by a LOOSENING mutant -- the first ones ever written for this parser.
// Every mutant across the previous five rounds pushed the rule back towards its old behaviour and
// asked whether the tightening held; none asked what the tightening now admits, and three of six
// loosenings turned out to be invisible to a 209-check board.
// Still exactly ONE word may stand between them, so "5/325 mg - max 8 tabs" is refused as before.
// LABEL_SEPARATOR: the punctuation a printed label puts between a strength and a count.
const LABEL_SEPARATOR = '[\\\\s:;.\\\\-\\\\u2013\\\\u2014]*';
const ONLY_UNIT_AND_BRACKETS = new RegExp('^' + LABEL_SEPARATOR + '[A-Za-z%]*(?:\\\\/[A-Za-z%]+)?' + LABEL_SEPARATOR + '[([]?\\\\s*$');"""
# A SENTINEL THAT IS ACTUALLY UNIQUE TO THIS PATCH. The first one tested for the string 'u2013',
# which already appears elsewhere in this file -- so the script reported 'already applied' and
# wrote nothing, silently, on a clean tree. A guard that fires on someone else's text is a guard
# that skips the work it is protecting.
if 'LABEL_SEPARATOR' in src:
    die('already applied')
if src.count(OLD) != 1:
    die('ONLY_UNIT_AND_BRACKETS is not where it was -- nothing written')
HTML.write_text(src.replace(OLD, NEW, 1), encoding='utf-8')
print('app-v81 round 12 applied: a label separator no longer costs a real count')
