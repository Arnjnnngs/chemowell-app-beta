#!/usr/bin/env python3
"""app-v81 round 10 -- the sixth refusal, and round 9's generalisation was too free.

THE BLOCK. Round 9 made the parser walk past every number belonging to a ratio and count the first
one left. On a combination strength written the way a bottle writes it, the first one left is the
DOSING INTERVAL:

    "5/325 mg q6h"              -> pills 6      (was: no count)
    "10/325 mg q8h"             -> pills 8
    "5/325 mg (max 8 per day)"  -> pills 8
    "5/325mg #30"               -> pills 30     (the quantity dispensed)
    "5/325 mg q4-6h"            -> pills 4

Measured end to end: with a 4-tablet daily limit, `5/325 mg q6h` stores `pills: 6`, `doseBlocked` is
`6 > 4 - 0`, and the ordinary Log button never appears **at zero doses logged**. A caregiver who
types the sig line off the bottle can only give the medication through the red two-tap override, and
every dose is then stamped as an over-limit override in History and in the export she hands a nurse.

**THIS IS MY DEFECT, NOT AN INHERITED ONE.** Round 9 widened the rule to fix a real problem -- the
count depending on word order -- and widened it past what could be justified. Walking past a ratio to
find "the amount" is a guess, and the previous rounds of this release are a record of what guessing
costs here.

THE FIX IS A WHITELIST, NOT A BLACKLIST OF FREQUENCY WORDS. Blacklisting `q`, `h`, `#`, `max` closes
the five shapes measured above and nothing else; the next sig abbreviation nobody listed would count
again. So: **the first number still counts exactly as it always did when it is not part of a ratio**
-- nothing about ordinary amounts changes. A number AFTER a ratio is only counted when the very next
word says what is being counted: tablets, capsules, patches, sprays, drops, puffs, millilitres. An
interval, a quantity dispensed and a maximum are none of those, so they count nothing, and the
release's own disclosure then tells the caregiver the limit is not being applied -- which is true,
and is the outcome round 9 was reaching for.

`7.5/325 mg 1-2 tabs` now counts 2 rather than 1: the noun follows the upper bound. On a ceiling that
is the cautious direction, and it matches what the app already does for a bare `1-2 tablets`.
"""
import sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent
HTML = ROOT / 'index.html'

def die(msg):
    print('PATCH FAILED: ' + msg); sys.exit(1)

def cut(src, old, new, what):
    if src.count(old) != 1:
        die(what + ' is not where it was (' + str(src.count(old)) + ' matches) -- nothing written')
    return src.replace(old, new, 1)

src = HTML.read_text(encoding='utf-8')
if 'COUNTABLE_NOUN' in src:
    die('already applied')
if 'firstCountableNumber' not in src:
    die('round 9 has not been applied')

src = cut(src, """function firstCountableNumber(text) {
  const re = /(\\d*\\.?\\d+)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (!numberIsInRatio(text, m.index, m[0].length)) return Number(m[1]);
  }
  return null;
}""",
"""// WHAT THE NEXT WORD HAS TO SAY BEFORE A NUMBER PAST A RATIO IS TREATED AS AN AMOUNT.
// Deliberately a whitelist. The first version of this walked past the ratio and counted whatever
// number came next -- and on a combination strength written the way a bottle writes it, that is the
// DOSING INTERVAL: `5/325 mg q6h` counted six tablets, `#30` counted the quantity dispensed, and
// `(max 8 per day)` counted the maximum. With a four-a-day limit the card was then locked at zero
// doses logged, so the only way to give the medicine was the red override, and every dose went into
// the record stamped as an over-limit override.
// Blacklisting `q`, `h`, `#` and `max` would close those five shapes and leave the next sig
// abbreviation nobody thought of. Saying what a countable thing IS closes the class.
const COUNTABLE_NOUN = /^\\s*\\(?\\s*(tab|tabs|tablet|tablets|cap|caps|capsule|capsules|pill|pills|patch|patches|spray|sprays|drop|drops|puff|puffs|lozenge|lozenges|application|applications|dose|doses|ml|mL|millilitre|millilitres|milliliter|milliliters)\\b/;
function firstCountableNumber(text) {
  const re = /(\\d*\\.?\\d+)/g;
  let m, sawRatio = false;
  while ((m = re.exec(text)) !== null) {
    if (numberIsInRatio(text, m.index, m[0].length)) { sawRatio = true; continue; }
    // BEFORE ANY RATIO, NOTHING CHANGES. A leading number has counted as the amount since v45, at
    // Aaron's request, because "1 patch" and "2 sprays" are how people write a dose and the field's
    // own example does not contain any of the words above.
    if (!sawRatio) return Number(m[1]);
    // AFTER ONE, the next word has to say what is being counted. An interval, a quantity dispensed
    // and a maximum are not amounts, so they are not counted -- and the card then says the limit is
    // not being applied, which is true and is the honest answer.
    if (COUNTABLE_NOUN.test(text.slice(m.index + m[0].length))) return Number(m[1]);
  }
  return null;
}""", 'firstCountableNumber')

HTML.write_text(src, encoding='utf-8')
print('app-v81 round 10 applied: a dosing interval is not a pill count')
