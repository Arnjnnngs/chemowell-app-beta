#!/usr/bin/env python3
"""app-v81 round 11 -- the seventh refusal: a MAXIMUM written with the word the whitelist looks for.

THE BLOCK. Round 10 said a number past a strength the app cannot read counts only when the next word
says what is being counted. That closed the five shapes it measured. It cannot see a daily maximum
written the way a pharmacy actually prints one -- **because a maximum is written with exactly that
word.** Measured on the shipping parser:

    "5/325 mg q4-6h prn max 8 tabs daily"           -> pills 8
    "5/325 mg q6h max 8 tabs/day"                   -> pills 8
    "5/325 mg up to 6 tabs per day"                 -> pills 6
    "5/325 mg no more than 12 tablets in 24 hours"  -> pills 12
    "5/325 mg #30 tablets"                          -> pills 30

On screen with a six-a-day limit and nothing logged, the only dose button reads
"... max 8 tabs daily - over limit", **no disclosure fires** -- a dose carrying `pills` is by
definition not an uncountable one -- and the medicine can only be given through the red two-tap
override, every dose then stamped over-limit in History and in the export. That is round 8's harm
verbatim, through a different string, and round 8's own string now behaves correctly. Three refusals
running have been defects inside the fix for the previous one.

**THE RULE WAS STILL THE WRONG SHAPE, and the word list was never going to be the answer.** What
separates `5/325 mg 2 tablets` from `5/325 mg max 8 tabs daily` is not the noun. It is that in the
first, the count sits directly against the strength, and in the second there is a sentence in
between telling you when and how often. So the rule is POSITIONAL: past a strength the app could not
read, a number counts only when nothing but the strength's own unit, whitespace and brackets stands
between them. `max`, `up to`, `no more than`, `#`, `q4-6h prn` and anything else anybody writes are
all "something in between", and none of them had to be listed.

THE RANGE EXCEPTION IS GONE TOO, and with it a false claim. Round 10 counted `7.5/325 mg 1-2 tabs`
as 2 and its commit said this "matches what the app already does for a bare 1-2 tablets". **It does
not** -- a bare `1-2 tabs` counts 1. A factor of two on the same ceiling, decided by whether a
strength happened to precede it. It now counts nothing and says so, which is the answer the app can
defend.

AND THE WHITELIST IS CASE-INSENSITIVE. `5/325 mg 1 Tablet` lost its count while `1 tablet` kept it,
and a capital is the norm on a printed label. `ml|mL` being the only pair spelled both ways is the
tell that case was thought about once and missed everywhere else.
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
if 'ONLY_UNIT_AND_BRACKETS' in src:
    die('already applied')
if 'COUNTABLE_NOUN' not in src:
    die('round 10 has not been applied')

src = cut(src, """const COUNTABLE_NOUN = /^\\s*\\(?\\s*(tab|tabs|tablet|tablets|cap|caps|capsule|capsules|pill|pills|patch|patches|spray|sprays|drop|drops|puff|puffs|lozenge|lozenges|application|applications|dose|doses|ml|mL|millilitre|millilitres|milliliter|milliliters)\\b/;
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
}""",
"""// CASE-INSENSITIVE, because a capital is the norm on a printed label: "1 Tablet" lost its count
// while "1 tablet" kept it. `ml|mL` being the only pair that was spelled both ways is the tell that
// case was thought about once and missed everywhere else.
const COUNTABLE_NOUN = /^\\s*\\(?\\s*(tab|tabs|tablet|tablets|cap|caps|capsule|capsules|pill|pills|patch|patches|spray|sprays|drop|drops|puff|puffs|lozenge|lozenges|application|applications|dose|doses|ml|millilitre|millilitres|milliliter|milliliters)\\b/i;
// NOTHING BUT THE STRENGTH'S OWN UNIT, WHITESPACE AND BRACKETS MAY STAND BETWEEN THEM.
//
// The word list was never going to be the answer, and the round-9 audit proved it: a daily MAXIMUM
// is written with exactly the word the list looks for. "5/325 mg max 8 tabs daily" counted eight
// tablets; so did "up to 6 tabs per day", "no more than 12 tablets in 24 hours" and "#30 tablets".
// With a six-a-day limit the card was locked before a dose was given, and nothing was disclosed --
// a dose carrying a count is by definition not an uncountable one.
//
// What separates "5/325 mg 2 tablets" from "5/325 mg max 8 tabs daily" is not the noun. It is that
// in the first, the count sits directly against the strength; in the second there is a sentence in
// between saying when and how often. So the test is POSITIONAL, and `max`, `up to`, `no more than`,
// `#` and `q4-6h prn` never had to be listed -- they are all "something in between".
const ONLY_UNIT_AND_BRACKETS = /^\\s*[A-Za-z%]*(?:\\/[A-Za-z%]+)?\\s*[([]?\\s*$/;
function firstCountableNumber(text) {
  const re = /(\\d*\\.?\\d+)/g;
  let m, ratioEnd = -1;
  while ((m = re.exec(text)) !== null) {
    if (numberIsInRatio(text, m.index, m[0].length)) { ratioEnd = m.index + m[0].length; continue; }
    // BEFORE ANY STRENGTH THE APP COULD NOT READ, NOTHING CHANGES. A leading number has counted as
    // the amount since v45, at Aaron's request, because "1 patch" and "2 sprays" are how people
    // write a dose and the field's own example contains none of the words above.
    if (ratioEnd < 0) return Number(m[1]);
    // AFTER ONE: the next word must say what is being counted, AND the number must sit against the
    // strength rather than inside a sentence about when to give it.
    if (COUNTABLE_NOUN.test(text.slice(m.index + m[0].length))
      && ONLY_UNIT_AND_BRACKETS.test(text.slice(ratioEnd, m.index))) return Number(m[1]);
  }
  return null;
}""", 'firstCountableNumber')

HTML.write_text(src, encoding='utf-8')
print('app-v81 round 11 applied: a maximum is not a dose, and nobody had to list the word')
