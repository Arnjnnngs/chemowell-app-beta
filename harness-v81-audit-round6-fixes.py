#!/usr/bin/env python3
"""app-v81 round 8 -- the fourth refusal, and the disclosure was wired to one screen out of four.

BLOCK 1: THE NOTICE RENDERS ON THE STANDALONE CARD AND NOWHERE ELSE. Round 7's whole argument was
that a sentence living only in the medication editor is not disclosure, because the editor is not
where a dose is given. It then put the sentence on `renderToday`'s standalone card and stopped.
`renderGroupedMedsCard` has its own Log button, its own Take all, and never called it -- so on the
Morning, Afternoon and Evening group cards, THREE OF THE FOUR PLACEMENTS the editor offers, round
5's block is still live and still silent. Measured with the same seed, changing only the placement:
six doses logged past a four-a-day limit with no notice anywhere on the page.

**AND THIS FUNCTION ALREADY CARRIES THE SAME FINDING TWICE, IN ITS OWN COMMENTS.** One from v52 --
*"grouped placements carried none of D-2's explanation, so the same medication read ... on a
standalone card and said nothing at all inside a Morning group on the same screen"* -- and one from
this very release about the flash mark, which calls it *"precisely the failure this release's own
notes claim to have fixed, left in place for the grouped half."* The same sentence is now true a
third time, in the same function, about a safety limit. A comment is not a mechanism.

BLOCK 2: THE APP TOLD THE CAREGIVER TO DO SOMETHING IT WOULD NOT ACCEPT. The editor's line reads
*"Write the amount as a plain number if it should count."* `UNEVALUATED_RATIO` matched a digit-slash-
digit ANYWHERE in the string, so every natural way of doing what it asks was refused:

    "1 tablet (5/325 mg)"   -> no count      "1 x 5/325 mg"    -> no count
    "1 tablet 5/325 mg"     -> no count      "2 tablets (5/325 mg)"  -> no count

and the card then read *"the app cannot tell how many that is: 1 tablet (5/325 mg)"*, which is not
true about an amount beginning with the words "1 tablet". **An instruction that cannot be followed is
worse than no instruction**, and a false sentence next to a dose button is worse again.

THE FIX: the guard asks whether THE NUMBER THE APP WOULD COUNT is itself part of a ratio, instead of
whether the string contains one anywhere. `5/325 mg` still counts nothing -- its leading number IS
the ratio. `1 tablet (5/325 mg)` counts one tablet, because its leading number is a tablet count and
the strength in brackets is documentation. That makes the editor's instruction true, and it is now
asserted.
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
if 'leadingNumberIsRatio' in src:
    die('already applied')
if 'uncountableDoses' not in src:
    die('round 7 has not been applied')

# ---- BLOCK 2: ask about the number, not about the string -------------------------------------
src = cut(src, """// A SLASH STILL BETWEEN TWO DIGITS AFTER EVALUATION MEANS THE APP DID NOT UNDERSTAND IT. That is
// every combination strength (`5/325 mg`, `875/125 mg`, `300/30/10`), every improper ratio
// (`25/2`, `11/2`) and every fraction over a denominator not on the list above (`1/10`, `1/16`).
// The app must not then take the leading number as an amount: a single oxycodone/paracetamol
// tablet was weighing FIVE tablets, so a four-a-day ceiling read "over limit" with nothing logged.
// `5 mg/mL` and `100 mg/m2` are deliberately unaffected -- neither has a digit on both sides.
const UNEVALUATED_RATIO = /\\d\\s*\\/\\s*\\d/;""",
"""// IS THE NUMBER THE APP WOULD COUNT ITSELF PART OF A RATIO? That is the question, and the first
// version asked a different one: whether the string contained a ratio ANYWHERE. The difference is
// the whole of the round-6 audit's second block.
//
// The app must not read `5/325 mg` as five tablets -- a single oxycodone/paracetamol tablet was
// weighing five, so a four-a-day ceiling read "over limit" with nothing logged. Its leading number
// IS the ratio, so it counts nothing. But `1 tablet (5/325 mg)` begins with a tablet count and
// carries the strength as documentation, and the string-wide test refused that too -- **while the
// editor was telling the caregiver to write exactly that.** Every natural way of following the
// app's own instruction was rejected, and the card then said it could not tell how many "1 tablet"
// was. An instruction that cannot be followed is worse than no instruction.
//
// So the test is anchored to the match: the counted number is discarded only when a slash sits
// immediately on one side of it with a digit on the other. `5 mg/mL` and `100 mg/m2` are unaffected
// for the same reason they always were -- no digit on both sides of that slash.
function leadingNumberIsRatio(text, match) {
  if (!match || match.index == null) return false;
  // ONLY WHAT FOLLOWS, and the symmetrical-looking half that used to be here is GONE. It also tested
  // whether a slash and a digit sat immediately BEFORE the match -- which reads like completeness and
  // is unreachable: the counted number is the FIRST number in the string, so it can never be the
  // denominator of anything. A mutant deleting that half left every check green, which is what
  // proved it dead. Symmetry that cannot run is not defence in depth; it is a line a later reader
  // has to work out is meaningless.
  return /^\\s*\\/\\s*\\d/.test(text.slice(match.index + match[0].length));
}""", 'UNEVALUATED_RATIO')

src = cut(src, """    const numMatch = countable.match(/(\\d*\\.?\\d+)/);
    const dose = { label, mg: mgMatch ? Number(mgMatch[1]) : 0 };
    // NO COUNT AT ALL when the amount is a ratio the app did not evaluate. Leaving `pills` off is
    // the same thing it already does for "as directed": the daily limit in pills refuses to arm and
    // the editor's own amber line says why, which is honest. Inventing a number is not.
    if (numMatch && !UNEVALUATED_RATIO.test(countable)) dose.pills = Number(numMatch[1]);
    return dose;""",
"""    const numMatch = countable.match(/(\\d*\\.?\\d+)/);
    const dose = { label, mg: mgMatch ? Number(mgMatch[1]) : 0 };
    // NO COUNT AT ALL when the number the app would count is itself half of a ratio it could not
    // evaluate. Leaving `pills` off is what it already does for "as directed": the limit in pills
    // is not applied, and every screen that can log a dose says so. Inventing a number is not.
    if (numMatch && !leadingNumberIsRatio(countable, numMatch)) dose.pills = Number(numMatch[1]);
    return dose;""", 'the pills count')

# ---- BLOCK 1: the other three placements ------------------------------------------------------
src = cut(src, """            lastToday ? h('div', { style: { fontSize: '12.5px', color: '#0C7F57', fontWeight: '700', marginTop: '2px' } }, '✓ Logged ' + fmtTime(lastToday.ts)) : null,""",
"""            // THE SAME NOTICE AS THE STANDALONE CARD, and this is the THIRD time this function has
            // been the place a per-medication line was left out. The v52 comment above records it
            // once; the flash-mark comment at the top of this function records it again, in this
            // same release, calling it "precisely the failure this release's own notes claim to
            // have fixed, left in place for the grouped half."
            // Three of the four placements the editor offers are group cards. A disclosure wired to
            // the fourth is not a disclosure -- it is a disclosure for whoever happened to file the
            // medication the way the developer tested it.
            (function () {
              const un = uncountableDoseNotice(med);
              return un ? h('div', { 'data-uncounted': 'group', style: { fontSize: '12px', color: '#8C5900',
                  fontWeight: '600', marginTop: '3px', lineHeight: '1.35', overflowWrap: 'anywhere' } },
                '! ' + un) : null;
            })(),
            lastToday ? h('div', { style: { fontSize: '12.5px', color: '#0C7F57', fontWeight: '700', marginTop: '2px' } }, '✓ Logged ' + fmtTime(lastToday.ts)) : null,""",
'the grouped medication row')

HTML.write_text(src, encoding='utf-8')
print('app-v81 round 8 applied: every placement discloses, and the instruction can be followed')
