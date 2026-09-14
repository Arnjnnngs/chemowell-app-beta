#!/usr/bin/env python3
"""app-v81 round 6 -- the round-4 audit refused the release again, and again it was right.

BLOCK 1: THERE IS A SECOND DOOR INTO THE MEDICATION LIST AND THE MIGRATION IS NOT BEHIND IT.
`migrateDoseLabels` lives in exactly one place, the map chain inside `loadMedicationConfig`. **Bring
back** -- the control that restores a medication the caregiver removed -- rebuilds the medication
through `normalizeMedication` and calls `persistMedicationConfig` directly. So a medication archived
under app-v80 comes back with its old `.5 mg / 5 mg` dose, is WRITTEN TO DISK that way, and Home
shows ".5 mg - over limit" before anything has been logged. It heals on the next full app load and
that is the entire mitigation: until then the card is falsely locked, the only way past it records a
5 mg dose the release is explicit it will never rewrite, and a backup taken in the window carries
the wrong configuration forward.

**And the toast says "is back, with its doses and rules"** -- the app asserting the doses are right
in the same breath as restoring the wrong ones.

THE FINDING IS NOT "RESTORE WAS MISSED". It is that more than one path writes into `state.meds` and
only one of them migrates. Fixed at the call site AND at the class: the suite now walks every door.

**Named honestly: this is the builder's write model.** Rule 1.5 requires stating what a release
appends before coding it, and that statement covered the load path only.

BLOCK 2: A SINGLE PERCOCET WEIGHED FIVE TABLETS. `5/325 mg` now keeps its label and counts 325 mg,
which is right -- and it also counted **pills: 5**, because the count was still the leading number.
On the real screen, with limit unit "Number of pills / doses" and a limit of 4, that reads
"5/325 mg - over limit" before breakfast. Worse, round 5's OWN SUITE pinned `pills: 5` as the
correct answer, so a row added to close an audit finding had certified a wrong number for whoever
touches this next.

The same shape sat one notch down and nobody had written it down: `1/8 tablet` counted 0.125 and
`1/10 tablet` counted a WHOLE TABLET, because 10 is not on the denominator list. Two amounts written
the same way, ten times apart, with nothing on screen to tell them apart -- which is the exact
complaint round 3 blocked the first fix for.

ONE RULE CLOSES BOTH. **If the counted form still contains a slash between two digits, the app did
not evaluate it -- so it must not invent a count.** `5/325`, `875/125`, `300/30/10`, `1/10`, `1/12`
and `1/16` now carry NO pill count at all, exactly as `as directed` does. The milligram figure is
unaffected, so an mg ceiling still works. A pill ceiling correctly refuses to arm, and the amber
line the editor already renders explains why. `5 mg/mL` and `100 mg/m2` are untouched -- there is no
digit on both sides of those slashes.

Also fixed, all of them the audit's: a promise no app can keep ("so they cannot be misread"), two
comments describing behaviour deleted in the previous commit, and a suite check whose NAME claimed
more than it measured.
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
if 'UNEVALUATED_RATIO' in src:
    die('already applied')
if 'DOSE_FRACTION_DENOMS' not in src:
    die('round 5 has not been applied')

# ---- BLOCK 3, FOUND BY THIS ROUND'S OWN SUITE: THE TEMPORAL DEAD ZONE, AGAIN -----------------
# `loadMedicationConfig()` runs at module init -- it builds the starting state -- and
# migrateDoseLabels calls parseDoseOptions from inside it, five thousand lines ABOVE where the
# parser's constants are declared. A `const` is in the temporal dead zone until its own line runs,
# so the first medication carrying a ratio threw "Cannot access 'UNEVALUATED_RATIO' before
# initialization", the try/catch around loadMedicationConfig swallowed it, and it returned the
# EMPTY FALLBACK: every saved medication gone from the app with no message on screen.
#
# THIS EXACT FAILURE IS ALREADY WRITTEN INTO THIS FILE, at the `TREATMENT_DAYS_MAX` comment, as
# something that shipped once and had to be found by a render scan. Rounds 4 and 5 got away with it
# only by luck: DOSE_FRACTIONS and DOSE_FRACTION_DENOMS are read inside callbacks a dose without a
# fraction never enters, so the throw was waiting for the first caregiver with a half tablet.
# `UNEVALUATED_RATIO.test()` is unconditional, which is what finally made it fire -- and the suite
# written for the migration is what caught it, not a reading of the code.
#
# THE FIX IS PLACEMENT, NOT LOGIC. Function declarations hoist completely; `const` does not.
src = cut(src, """const DOSE_FRACTIONS = { '\\u00bd': 0.5, '\\u00bc': 0.25, '\\u00be': 0.75, '\\u2153': 1 / 3, '\\u2154': 2 / 3 };\n""", '', 'the DOSE_FRACTIONS declaration (moved)')
src = cut(src, """const DOSE_FRACTION_DENOMS = [2, 3, 4, 5, 6, 8];\n""", '', 'the denominator list (moved above the migration)')

src = cut(src, """function migrateDoseLabels(med) {""",
"""// THESE CONSTANTS LIVE HERE, ABOVE THE MIGRATION, AND NOT BESIDE THE PARSER THAT READS THEM.
// `loadMedicationConfig()` runs during module initialisation and calls migrateDoseLabels, which
// calls parseDoseOptions -- so every constant the parser touches has to be initialised BEFORE this
// point, not where the parser is written. Declared down there they sit in the temporal dead zone,
// the parser throws, loadMedicationConfig's try/catch swallows it, and the caregiver's entire
// medication list is replaced by the empty fallback with nothing on screen to say why.
// **That is not hypothetical: it shipped once already on this file** -- see the TREATMENT_DAYS_MAX
// comment further down, which is the same defect with a different constant. Function declarations
// hoist completely, so the parser itself can stay where it reads best.
const DOSE_FRACTIONS = { '\\u00bd': 0.5, '\\u00bc': 0.25, '\\u00be': 0.75, '\\u2153': 1 / 3, '\\u2154': 2 / 3 };
// WHICH DENOMINATORS EVALUATE, AND WHAT HAPPENS TO THE REST -- written down because the round-4
// audit was right that nothing said it anywhere. These six are the ones a person writes by hand on
// a pill: halves, thirds, quarters, fifths, sixths, eighths. A denominator outside the list is NOT
// evaluated, and UNEVALUATED_RATIO below then makes sure the app counts NOTHING rather than
// counting the numerator -- so `1/10 tablet` is not silently a whole tablet. That pairing is the
// point: widening this list and removing that guard are the same decision, and neither is safe
// alone.
const DOSE_FRACTION_DENOMS = [2, 3, 4, 5, 6, 8];
// A SLASH STILL BETWEEN TWO DIGITS AFTER EVALUATION MEANS THE APP DID NOT UNDERSTAND IT. That is
// every combination strength (`5/325 mg`, `875/125 mg`, `300/30/10`), every improper ratio
// (`25/2`, `11/2`) and every fraction over a denominator not on the list above (`1/10`, `1/16`).
// The app must not then take the leading number as an amount: a single oxycodone/paracetamol
// tablet was weighing FIVE tablets, so a four-a-day ceiling read "over limit" with nothing logged.
// `5 mg/mL` and `100 mg/m2` are deliberately unaffected -- neither has a digit on both sides.
const UNEVALUATED_RATIO = /\\d\\s*\\/\\s*\\d/;
function migrateDoseLabels(med) {""", 'migrateDoseLabels, for the constants')

# ---- BLOCK 2 + finding 3: no invented count for a ratio the app did not evaluate --------------

src = cut(src, """    const numMatch = countable.match(/(\\d*\\.?\\d+)/);
    const dose = { label, mg: mgMatch ? Number(mgMatch[1]) : 0 };
    if (numMatch) dose.pills = Number(numMatch[1]);
    return dose;""",
"""    const numMatch = countable.match(/(\\d*\\.?\\d+)/);
    const dose = { label, mg: mgMatch ? Number(mgMatch[1]) : 0 };
    // NO COUNT AT ALL when the amount is a ratio the app did not evaluate. Leaving `pills` off is
    // the same thing it already does for "as directed": the daily limit in pills refuses to arm and
    // the editor's own amber line says why, which is honest. Inventing a number is not.
    if (numMatch && !UNEVALUATED_RATIO.test(countable)) dose.pills = Number(numMatch[1]);
    return dose;""", 'the pills count')

# ---- fix (a): a comment describing rounding that was deleted a commit ago --------------------
src = cut(src, """    // COUNTED FROM THE UNROUNDED FORM, SHOWN FROM THE ROUNDED ONE. See `precise` above: reading the
    // number back out of the displayed label is what made three thirds add up to 0.999.""",
"""    // COUNTED FROM THE EVALUATED FORM, SHOWN FROM WHAT WAS TYPED. See `precise` above.
    // THIS SAID "unrounded ... rounded" UNTIL THE ROUND-4 AUDIT READ IT: the same commit that wrote
    // it had deleted the rounding, so the sentence described a build that no longer existed. The
    // split is evaluated-versus-verbatim. Reading the number back out of the displayed label is
    // what made three thirds of a tablet add up to 0.999.""", 'the countable comment')

# ---- fix (b): the whitelist comment that contradicted itself four lines later ----------------
src = cut(src, """    // WHAT THIS LINE ACTUALLY DOES, corrected after falsifying it: NOTHING TODAY. migrateDoseLabels
    // runs AFTER this function in loadMedicationConfig's chain, so it sets the stamp on this
    // function's OUTPUT and the stamp reaches the disk either way -- removing this line leaves every
    // measurable behaviour identical, which a mutant proved rather than a reading of it. It is kept""",
"""    // WHAT THIS LINE ACTUALLY DOES, corrected twice. migrateDoseLabels runs AFTER this function in
    // loadMedicationConfig's chain, so it sets the stamp on this function's OUTPUT and the stamp
    // reaches the disk either way. Removing this line changes NOTHING THE SUITE CAN SEE, because the
    // migration is idempotent -- a mutant proved that much. It does NOT leave every behaviour
    // identical, and the round-4 audit caught this comment claiming so and then describing the
    // difference four lines further down: without the line the migration re-walks every medication
    // on every load, forever, and nothing measures it. It is kept""", 'the whitelist comment')

# ---- BLOCK 1: the second door --------------------------------------------------------------
src = cut(src, """  if (hadConfig) med = normalizeMedication(JSON.parse(JSON.stringify(entry.config)));
  else med = normalizeMedication({ id: id, name: entry.name || id, sub: entry.sub || '' });""",
"""  // THROUGH THE SAME MIGRATIONS AS THE LOAD PATH. Restoring an archived medication is the SECOND
  // door into state.meds and it used to bypass migrateDoseLabels entirely -- so a medication
  // archived under an older release came back with its old dose numbers, was written straight to
  // disk that way, and Home showed it over its limit before anything had been logged. It healed on
  // the next full app load, which is no mitigation at all: in the meantime the card is falsely
  // locked, the only way past it records a dose ten times too large, and a backup taken in that
  // window carries the wrong configuration forward. The toast below says "is back, with its doses
  // and rules" -- the app asserting the doses are right while restoring the wrong ones.
  if (hadConfig) med = migrateDoseLabels(normalizeMedication(JSON.parse(JSON.stringify(entry.config))));
  else med = migrateDoseLabels(normalizeMedication({ id: id, name: entry.name || id, sub: entry.sub || '' }));""",
'the restore path')

# ---- the Voice: a promise no app can keep ----------------------------------------------------
src = cut(src, """        'Amounts are written the way a pharmacy writes them, so they cannot be misread. Change the box above if this is not what you meant.')));""",
"""        // "so they cannot be misread" WAS HERE AND IS GONE. The round-4 audit was right: it is an
        // absolute claim about how a person reads, made by an app, on a screen that had just been
        // shown to get a number wrong -- and Rule 2.7 forbids promising a fix that has not been
        // confirmed, let alone one that cannot be. This says what happened and stops.
        'A leading zero is added and a trailing zero removed, because .5 and 1.0 are the two amounts most often read wrong. Change the box above if this is not what you meant.')));""",
'the notice copy')

HTML.write_text(src, encoding='utf-8')
print('app-v81 round 6 applied: every door migrates, and no count is invented from a ratio')
