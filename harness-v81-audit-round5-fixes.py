#!/usr/bin/env python3
"""app-v81 round 7 -- the round-5 audit refused this release for the third time, on the fix again.

THE BLOCK, AND IT IS THE WORST ONE OF THE SIX ROUNDS BECAUSE IT ERRS TOWARD GIVING MORE MEDICINE.

Round 4 refused `5/325 mg` counting FIVE tablets: a four-a-day ceiling locked before breakfast. Round
6 answered it by refusing to invent a count at all -- correct, as far as it went -- and left every
armed ceiling on disk untouched. So a medication saved under app-v80 with a `5/325 mg` dose and a
4-tablet daily limit came through the migration with its count DELETED and its limit still switched
on. Re-measured here before anything was changed, on the real screen:

    six doses tapped and confirmed in a row
    every one logged, no block, no warning, the card read "Available" throughout
    the same medication written "1 tablet" blocks correctly on the fifth

**Round 4's defect refused a dose that should have been allowed. This one allows every dose past a
limit the caregiver deliberately set, silently, and writes that state to disk so a backup carries it
forward.** Those are not the same kind of wrong.

AND THE COMMIT'S COVER FOR IT WAS FALSE, BOTH HALVES. It said "a pill ceiling correctly refuses to
arm and the editor's existing amber line says why". `dosageOptionsCarryLimitUnit` lives in the
medication EDITOR and only gates a limit being typed; `ceiling`, `ceilingMax` and `ceilingUnit`
already on disk are untouched. And it is a `.some()`, so on the dose list a real Percocet card has --
`1 tablet`, `2 tablets`, `5/325 mg` -- the other two satisfy it and the amber line cannot appear at
all, while every `5/325 mg` dose logged from that same card counts zero.

THE FIX IS THE HALF ROUND 6 LEFT OUT, and the auditor named it exactly: **delete the count AND tell
the caregiver on the card.** Both alternatives on their own are wrong -- counting five locks a card
that should be open, counting nothing opens a ceiling that should hold -- and the auditor falsified
the one-line version of each. What was missing was never arithmetic. It was disclosure, on the
screen where the dose is actually given rather than in an editor nobody is looking at.

So: a dose the app cannot count is named, on the card, next to the button that logs it, whenever a
limit is armed in that unit. The limit still applies to every dose the app CAN count. Nothing is
silently enforced and nothing is silently ignored.

**THE SEAT, AND THE AUDITOR NAMED THE SAME ONE TWICE RUNNING: the builder's write model.** Rule 1.5
requires stating what a release DELETES, and the stated answer was "nothing" while the release
carried a `delete fixed.pills` running unconditionally over every saved medication on every device.
Round 4's block was a write the write model had not enumerated. This one is the same mistake.
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
if 'uncountableDoses' in src:
    die('already applied')
if 'UNEVALUATED_RATIO' not in src:
    die('round 6 has not been applied')

# ---- the helper, beside the other ceiling helpers so it is found with them -------------------
src = cut(src, """function dailyCeiling(med) {""",
"""// WHICH OF A MEDICATION'S DOSES THIS LIMIT CANNOT COUNT. Empty for almost every medication, and
// that is the point -- it is the exception that has to be visible.
//
// A limit armed in pills or applications is enforced by reading `pills` off each dose. A dose whose
// written amount the app could not turn into a number -- a combination strength like "5/325 mg", a
// fraction over a denominator nobody writes, "as directed" -- carries no `pills` at all, so it adds
// ZERO to the running total no matter how many times it is logged. Before this, that was silent:
// six doses of a four-a-day medication logged one after another with the card reading "Available"
// the whole way, because the ceiling was armed and nothing was counting against it.
//
// The app will not guess a number it cannot derive, and it will not pretend a limit is holding when
// it is not. So it says which dose is not being counted, on the card where that dose is given.
function uncountableDoses(med) {
  if (!med || !med.ceiling || !med.ceilingUnit) return [];   // an mg limit reads `mg`, which is set
  if (!Array.isArray(med.doses)) return [];
  return med.doses.filter(d => d && !(Number(d.pills) > 0)).map(d => String(d.label == null ? '' : d.label));
}
function uncountableDoseNotice(med) {
  const un = uncountableDoses(med);
  const dc = dailyCeiling(med);
  if (!dc) return null;   // no limit actually in force -- nothing to warn about
  // A LIMIT WITH NO DOSE OPTIONS AT ALL IS THE SAME DEFECT WITH NOTHING TO NAME. Logging from a
  // plain Log button records no amount, so a limit in pills counts nothing however many times it is
  // tapped. The editor will not let a NEW medication reach that state; one already on a device can
  // be in it, which is the whole class this release exists for.
  if (!Array.isArray(med.doses) || !med.doses.length) {
    return 'The daily limit of ' + dc.label + ' is not being counted, because this medication has no '
      + 'amounts set. Add them in Edit, or the limit will never be reached.';
  }
  if (!un.length) return null;
  // "EVERY OTHER AMOUNT STILL COUNTS" IS FALSE WHEN THERE IS NO OTHER AMOUNT -- and it was being
  // printed on the single-dose medication that is the commonest shape of this defect. A sentence
  // that reassures about something that does not exist is worse than no sentence.
  const allOfThem = un.length >= med.doses.length;
  const head = un.length === 1 ? 'This amount is' : 'These amounts are';
  return head + ' not counted toward the daily limit of ' + dc.label + ' \u2014 the app cannot tell how '
    + 'many that is: ' + un.join(', ') + '. '
    + (allOfThem ? 'Nothing on this card is being counted against that limit.' : 'Your other amounts still count.');
}
function dailyCeiling(med) {""", 'dailyCeiling, for the helper')

# ---- the card: say it where the dose is given ------------------------------------------------
src = cut(src, """      med.note ? h('div', { style: { ...TYPE.caption, color: '#7A6E76', fontStyle: 'italic' } }, med.note) : null,
      // Buttons
      buttonArea""",
"""      med.note ? h('div', { style: { ...TYPE.caption, color: '#7A6E76', fontStyle: 'italic' } }, med.note) : null,
      // app-v81 round 7: A LIMIT THAT CANNOT COUNT ONE OF ITS OWN DOSES SAYS SO, HERE. Not in the
      // medication editor, which is where the only existing version of this sentence lived and
      // which the caregiver is not looking at when she gives a dose. Renders for no medication whose
      // amounts the app can read, which is nearly all of them.
      (function () {
        const notice = uncountableDoseNotice(med);
        return notice ? h('div', { 'data-uncounted': 'card', style: { ...TYPE.caption, color: '#8C5900', display: 'flex', gap: '6px',
            alignItems: 'flex-start', marginTop: '2px', padding: '6px 8px', borderRadius: '9px',
            background: 'rgba(246,108,49,0.07)', border: '1px solid rgba(246,108,49,0.20)' } },
          h('span', { style: { flexShrink: '0', fontWeight: '800' } }, '!'),
          h('span', { style: { minWidth: '0', overflowWrap: 'anywhere' } }, notice)) : null;
      })(),
      // Buttons
      buttonArea""", 'the card meta block')

# ---- the editor gate: `.some` let a mixed dose list through ----------------------------------
src = cut(src, """function dosageOptionsCarryLimitUnit(form) {
  const unit = form.dailyLimitUnit;
  const testDoses = parseDoseOptions(form.dosesText);
  return unit === 'mg' ? testDoses.some(d => d.mg > 0) : testDoses.some(d => d.pills > 0);
}""",
"""function dosageOptionsCarryLimitUnit(form) {
  const unit = form.dailyLimitUnit;
  const testDoses = parseDoseOptions(form.dosesText);
  return unit === 'mg' ? testDoses.some(d => d.mg > 0) : testDoses.some(d => d.pills > 0);
}
// WHICH OF THE OPTIONS BEING TYPED THE LIMIT WOULD NOT COUNT. `dosageOptionsCarryLimitUnit` above is
// a `.some()`, and the round-5 audit was right that this is exactly the wrong question for a list
// with more than one entry: on `1 tablet, 2 tablets, 5/325 mg` the first two satisfy it, the gate
// opens, the amber line never appears -- and every dose logged from the third counts zero against
// the limit the caregiver is about to set. So the editor now names the ones that will not count,
// while she is still in the box that decides it.
function uncountedDosageOptions(form) {
  if (!form || !form.dailyLimit || form.dailyLimitUnit === 'mg') return [];
  return parseDoseOptions(form.dosesText).filter(d => !(Number(d.pills) > 0)).map(d => String(d.label));
}""", 'dosageOptionsCarryLimitUnit')

src = cut(src, """      dailyLimitPreview(form),""",
"""      dailyLimitPreview(form),
      (function () {
        const un = uncountedDosageOptions(form);
        if (!un.length) return null;
        return h('div', { 'data-uncounted': 'editor', style: { ...TYPE.caption, color: '#8C5900', margin: '2px 0 4px', padding: '7px 9px',
            borderRadius: '9px', background: 'rgba(246,108,49,0.07)', border: '1px solid rgba(246,108,49,0.20)',
            overflowWrap: 'anywhere' } },
          h('strong', { style: { fontWeight: '700' } }, 'Not counted toward the limit: '),
          un.join(', '),
          h('div', { style: { marginTop: '2px' } },
            'The app cannot tell how many that is, so it will not add it up. Write the amount as a plain number if it should count.'));
      })(),""", 'the daily limit preview slot')

# ---- explicit hooks on all three notices, so a suite selects them rather than hunting their text --
# Rule 5: elements by data- hooks, never by text. The suite's own helper searched every div for the
# notice's words and `find` returns the OUTERMOST match -- which is the whole page -- so a check
# asserting the notice does NOT mention "1 tablet" failed because a button elsewhere on the page did.
src = cut(src, """  return h('div', { style: { display: 'flex', gap: '6px', alignItems: 'flex-start', margin: '4px 0 2px',""",
"""  return h('div', { 'data-dose-rewritten': '1', style: { display: 'flex', gap: '6px', alignItems: 'flex-start', margin: '4px 0 2px',""", 'the rewritten-doses notice, for its hook')

# ---- the Voice: an unmeasured superlative ---------------------------------------------------
src = cut(src, """        'A leading zero is added and a trailing zero removed, because .5 and 1.0 are the two amounts most often read wrong. Change the box above if this is not what you meant.')));""",
"""        // "the two amounts MOST OFTEN read wrong" was a ranking nobody here has measured, flagged by
        // the round-5 audit. Both forms are on the published error-prone-designations list; which is
        // commonest is not something this app knows, and it did not need to claim it.
        'A leading zero is added and a trailing zero removed, because a naked decimal point and a trailing zero are both easy to misread. Change the box above if this is not what you meant.')));""",
'the notice copy')

HTML.write_text(src, encoding='utf-8')
print('app-v81 round 7 applied: a limit that cannot count a dose says so on the card')
