#!/usr/bin/env python3
"""app-v81 round 9 -- the fifth refusal. A fifth door, a check that completes against itself, and
copy whose truth depended on word order.

BLOCK 1: "TAKE ALL" IS THE FIFTH DOOR, AND IT IS THE SAME SHAPE AS THE ONE JUST FIXED ONE LEVEL UP.
Round 8 put the disclosure on all four Home placements. **The batch button is not in a row -- it is
in the group card's header**, and its confirmation modal names every medication and says nothing.
Measured at 320x720 on an Evening group of six with the combination medication last: Take all at
y=725, the row notice at y=1174 -- **404px below the fold** -- and six taps logged six doses past a
four-a-day ceiling. The identical medication written `1 tablet` stops at four on the identical
button. **A disclosure wired to a surface while the control that ignores it lives somewhere else is
exactly what round 6 blocked**, and my own commit message for round 8 named Take all in passing
without checking it.

So the class is restated, and it is not "every placement". It is **every control that writes a
dose**. The modal now carries the notice for each medication it is about to log.

BLOCK 2: THE COMPLETENESS CHECK COMPLETED AGAINST ITSELF. Round 8 replaced a list copied into the
suite with a harvest of on-screen text matching `/(Home card|meds group)$/` -- **which is the same
list, written as a naming convention.** The auditor measured it: a sixth placement labelled
`Bedtime list` leaves the board 146/146 GREEN; only one named `...meds group` turns it red. And
there is ALREADY a sixth option it cannot see -- `Custom (current mix)`, which the real editor
renders. So round 8's commit message and the README both claim something false, and that is the
seventh such claim in this release.

The picker now carries an explicit hook per option, and the suite reads the hooks. A new placement
is invisible to no one.

BLOCK 3: THE COPY'S TRUTH DEPENDED ON WORD ORDER. `1 tablet (5/325 mg)` counted one tablet;
`5/325 mg (1 tablet)` counted nothing and the card said *"the app cannot tell how many that is:
5/325 mg (1 tablet)"* -- beside a dose button, about a string containing the words "1 tablet".
Round 6 said not to ship the parser half without the copy half and that is what happened.

**The fix generalises the guard instead of explaining the order.** It counts the first number that
is NOT part of an unevaluated ratio, rather than giving up when the first number happens to be one.
Order stops mattering, the editor has nothing to explain, and `5/325 mg` alone still counts nothing
because every number in it belongs to the ratio.
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
if 'firstCountableNumber' in src:
    die('already applied')
if 'leadingNumberIsRatio' not in src:
    die('round 8 has not been applied')

# ---- BLOCK 3: count the first number that is not part of a ratio ------------------------------
src = cut(src, """function leadingNumberIsRatio(text, match) {
  if (!match || match.index == null) return false;
  // ONLY WHAT FOLLOWS, and the symmetrical-looking half that used to be here is GONE. It also tested
  // whether a slash and a digit sat immediately BEFORE the match -- which reads like completeness and
  // is unreachable: the counted number is the FIRST number in the string, so it can never be the
  // denominator of anything. A mutant deleting that half left every check green, which is what
  // proved it dead. Symmetry that cannot run is not defence in depth; it is a line a later reader
  // has to work out is meaningless.
  return /^\\s*\\/\\s*\\d/.test(text.slice(match.index + match[0].length));
}""",
"""// THE FIRST NUMBER THAT IS ACTUALLY AN AMOUNT, rather than the first number and a shrug.
//
// The previous version looked only at the leading number: if that was half of a ratio it could not
// evaluate, it gave up and counted nothing. So `1 tablet (5/325 mg)` counted one tablet and
// `5/325 mg (1 tablet)` counted nothing -- the same information, the same medication, and the
// answer turned on which half the caregiver wrote first. The card then said it could not tell how
// many "5/325 mg (1 tablet)" was, beside a dose button, about a string containing the words
// "1 tablet". **Copy whose truth depends on word order is copy that will be false for somebody.**
//
// Walking past the ratio removes the question rather than documenting it. Every number belonging to
// an unevaluated ratio is skipped; the first one that is not is the amount. `5/325 mg` alone still
// counts nothing, because both of its numbers belong to the ratio -- which is the correct answer and
// the reason this is a generalisation rather than a loosening.
function numberIsInRatio(text, index, length) {
  const before = text.slice(0, index);
  const after = text.slice(index + length);
  return /\\d\\s*\\/\\s*$/.test(before) || /^\\s*\\/\\s*\\d/.test(after);
}
function firstCountableNumber(text) {
  const re = /(\\d*\\.?\\d+)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (!numberIsInRatio(text, m.index, m[0].length)) return Number(m[1]);
  }
  return null;
}""", 'leadingNumberIsRatio')

src = cut(src, """    const numMatch = countable.match(/(\\d*\\.?\\d+)/);
    const dose = { label, mg: mgMatch ? Number(mgMatch[1]) : 0 };
    // NO COUNT AT ALL when the number the app would count is itself half of a ratio it could not
    // evaluate. Leaving `pills` off is what it already does for "as directed": the limit in pills
    // is not applied, and every screen that can log a dose says so. Inventing a number is not.
    if (numMatch && !leadingNumberIsRatio(countable, numMatch)) dose.pills = Number(numMatch[1]);
    return dose;""",
"""    const dose = { label, mg: mgMatch ? Number(mgMatch[1]) : 0 };
    // NO COUNT AT ALL when every number in the amount belongs to a ratio the app could not evaluate.
    // Leaving `pills` off is what it already does for "as directed": the limit in pills is not
    // applied, and every control that writes a dose says so. Inventing a number is not.
    const countedNumber = firstCountableNumber(countable);
    if (countedNumber !== null) dose.pills = countedNumber;
    return dose;""", 'the pills count')

# ---- BLOCK 2: the picker carries a hook, so a new option cannot hide behind its own name -------
src = cut(src, """        ...PLACEMENT_OPTIONS.concat(placementOf(form._origPlacement || {}) === 'custom' ? [{ key: 'custom', label: 'Custom (current mix)', helper:""",
"""        // EVERY OPTION CARRIES ITS KEY, so a check for "is every placement accounted for" reads the
        // app rather than a naming convention. Round 8's version harvested on-screen text matching
        // `/(Home card|meds group)$/` -- which is the same list copied into the suite, one layer
        // down: an option called "Bedtime list" was invisible to it, and `Custom (current mix)`
        // already was. A completeness check that completes against itself is the thing it exists to
        // prevent.
        ...PLACEMENT_OPTIONS.concat(placementOf(form._origPlacement || {}) === 'custom' ? [{ key: 'custom', label: 'Custom (current mix)', helper:""",
'the placement option list')

# ---- BLOCK 1: the fifth door. The control that writes the doses carries the disclosure. -------
src = cut(src, """      h('div', { style: { ...TYPE.title, color: '#2A2127', marginBottom: '22px', textAlign: 'center' } }, title),""",
"""      h('div', { style: { ...TYPE.title, color: '#2A2127', marginBottom: '22px', textAlign: 'center' } }, title),
      // THE BATCH BUTTON IS THE FIFTH DOOR, and it is the same shape as the one round 8 closed, one
      // level up. The row notice lives in the group card's list; "Take all" lives in that card's
      // HEADER, and on a six-medication group at 320px the notice measured 404px below the fold --
      // so the caregiver taps a button whose consequence is explained off-screen, then confirms in a
      // modal that names every medication and says nothing. Six taps logged six doses past a
      // four-a-day ceiling.
      //
      // THE CLASS IS NOT "EVERY PLACEMENT". It is EVERY CONTROL THAT WRITES A DOSE. A disclosure
      // wired to a surface while the control that ignores it lives somewhere else is the defect,
      // whichever surface it is.
      (function () {
        const ids = m.type === 'multi' ? (m.medIds || []) : (m.type === 'med' ? [m.medId] : []);
        const lines = ids.map(id => {
          const med = state.meds.find(x => x.id === id);
          const un = med ? uncountableDoseNotice(med) : null;
          return un ? (med.name + ': ' + un) : null;
        }).filter(Boolean);
        if (!lines.length) return null;
        return h('div', { 'data-uncounted': 'confirm', style: { marginBottom: '16px', padding: '9px 11px',
            borderRadius: '11px', background: 'rgba(246,108,49,0.07)', border: '1px solid rgba(246,108,49,0.20)',
            fontSize: '12.5px', lineHeight: '1.45', color: '#8C5900', overflowWrap: 'anywhere' } },
          ...lines.map(line => h('div', { style: { marginTop: '2px' } }, '! ' + line)));
      })(),""", 'the time modal title')

src = cut(src, """          return h('button', { type: 'button', role: 'radio', 'aria-checked': on ? 'true' : 'false', onClick: () => setPlacement(opt.key),""",
"""          // EVERY OPTION CARRIES ITS KEY. A completeness check for "is every placement accounted
          // for" then reads the app, not a naming convention. Round 8's version harvested on-screen
          // text matching /(Home card|meds group)$/ -- the same list copied into the suite, one
          // layer down: an option named "Bedtime list" was invisible to it, and `Custom (current
          // mix)` already was. A completeness check that completes against itself is the thing it
          // exists to prevent.
          return h('button', { type: 'button', role: 'radio', 'data-placement-option': opt.key, 'aria-checked': on ? 'true' : 'false', onClick: () => setPlacement(opt.key),""", 'the placement radio button')

# ---- the Voice and the Designer, both from the round-7 audit ---------------------------------
src = cut(src, """    + (allOfThem ? 'Nothing on this card is being counted against that limit.' : 'Your other amounts still count.');""",
"""    // "NOTHING ON THIS CARD" WAS WRONG IN TWO OF THE THREE PLACES THIS NOW RENDERS, and the
    // round-7 audit caught it: a group card holds several medications and only one is affected, and
    // a confirmation modal is not a card at all. The sentence is about the MEDICATION, so it says
    // so, and it is true wherever it appears.
    + (allOfThem ? 'No dose of this medication is being counted against it.' : 'Your other amounts still count.');""", 'the all-of-them sentence')

src = cut(src, """              return un ? h('div', { 'data-uncounted': 'group', style: { fontSize: '12px', color: '#8C5900',
                  fontWeight: '600', marginTop: '3px', lineHeight: '1.35', overflowWrap: 'anywhere' } },
                '! ' + un) : null;""",
"""              // BORDERED, LIKE THE STANDALONE CARD'S VERSION. It was a bare amber line styled
              // identically to the scheduling note directly above it, so on a card carrying both,
              // the one that says a safety limit is not being applied read as the same kind of
              // remark as "showing every day until you set a treatment date". Same finding, same
              // screen, and the Designer pass should have had it before the auditor did.
              return un ? h('div', { 'data-uncounted': 'group', style: { fontSize: '12px', color: '#8C5900',
                  fontWeight: '600', marginTop: '5px', lineHeight: '1.35', overflowWrap: 'anywhere',
                  padding: '6px 8px', borderRadius: '9px', background: 'rgba(246,108,49,0.07)',
                  border: '1px solid rgba(246,108,49,0.20)' } },
                '! ' + un) : null;""", 'the grouped notice styling')

HTML.write_text(src, encoding='utf-8')
print('app-v81 round 9 applied: every control that writes a dose discloses, and order no longer decides the count')
