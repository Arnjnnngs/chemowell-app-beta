#!/usr/bin/env python3
"""app-v81 round 5 -- what the round-3 audit refused, and it refused the fix rather than the bug.

THE BLOCK. Round 4 fixed a ten-fold under-count and introduced a twenty-thousand-fold one. The
plain-fraction pass accepted any two integers around a slash, so a COMBINATION-PRODUCT strength --
`5/325 mg`, which is how oxycodone/paracetamol is written on every bottle of it -- was read as the
fraction five three-hundred-and-twenty-fifths and stored as **0.015 mg**. A 3,000 mg paracetamol
ceiling is then reached after two hundred thousand tablets. Re-measured here before anything was
changed, and the audit had understated it: `300/30/10` came out as the string `10/10`.

It was also inconsistent, which is the tell. `7.5/325 mg` and `80/12.5 mg` survived untouched --
a decimal on either side blocks the pattern -- so two strengths of one product behaved differently
and neither behaviour was written down.

THE GUARD: a slash is a fraction only when it is a PROPER fraction (numerator smaller than
denominator) over a denominator a person actually writes -- halves, thirds, quarters, fifths,
sixths, eighths. `1/2`, `2/3`, `1 1/2` still work. `5/325`, `25/2`, `11/2` and `300/30/10` are left
exactly as typed, which is what the app did before round 4 and is the only safe answer for a string
whose meaning the app cannot know.

THE SECOND BLOCK: NOTHING WAS FIXED FOR A MEDICATION THAT ALREADY EXISTS. `parseDoseOptions` runs
only inside the editor, so a medication saved before this release kept its stored `{label: ".5 mg",
mg: 5}` and went on counting five milligrams. Three documents called the defect fixed. It is now
migrated once, on load, under its OWN stamp -- not by bumping MED_CONFIG_VERSION, which would re-run
the legacy-rules migration and overwrite schedule windows the caregiver has since edited.

**THE MIGRATION TOUCHES CONFIGURATION AND NOTHING ELSE. Doses already LOGGED are history and are
left exactly as they are.** A logged entry records what the app believed at the time; rewriting it
would be editing a medication record after the fact, which this project does not do anywhere.

THE THIRD: `1/3` rounded to `0.333`, so three of them summed to 0.999 against a one-tablet limit
and the app offered a fourth. The LABEL still reads `0.333` -- nobody wants sixteen digits on a
button -- but the number COUNTED is now exact, and in IEEE arithmetic a third plus a third plus a
third is exactly one. Verified rather than assumed.

THE FOURTH, and it is the Voice's: THE APP REWRITES WHAT THE CAREGIVER TYPED AND SAYS NOTHING. That
was defensible while the rewrite was always right. Block 1 proves it can be wrong, and a silent
rewrite that can be wrong is the worst combination available. The editor now shows what will
actually be saved, the moment it differs from what was typed.

Also in this round: a shipping comment that stated the safety direction BACKWARDS (counting a half
as a whole reaches a pill ceiling EARLY, which is the safe direction), and a release-gate check that
could not fire on the one case its own comment named.
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
if 'DOSE_FRACTION_DENOMS' in src:
    die('already applied')
if 'normaliseDoseNumber' not in src:
    die('round 4 has not been applied')

# ---- 1. THE PROPER-FRACTION GUARD, and the exact value for counting -------------------------
src = cut(src, """const DOSE_FRACTIONS = { '\\u00bd': 0.5, '\\u00bc': 0.25, '\\u00be': 0.75, '\\u2153': 1 / 3, '\\u2154': 2 / 3 };
function normaliseDoseNumber(label) {
  let out = String(label == null ? '' : label);
  const round3 = (n) => String(Math.round(n * 1000) / 1000);""",
"""const DOSE_FRACTIONS = { '\\u00bd': 0.5, '\\u00bc': 0.25, '\\u00be': 0.75, '\\u2153': 1 / 3, '\\u2154': 2 / 3 };
// A SLASH IS ONLY A FRACTION WHEN IT IS ONE, and the round-3 audit blocked this release to say so.
// The first version read any two integers around a slash as a division, so `5/325 mg` -- how
// oxycodone/paracetamol is written on the bottle -- became 0.015 mg, and a 3,000 mg paracetamol
// ceiling was reached after two hundred thousand tablets. `300/30/10` came out as the string
// "10/10". A combination strength is not a fraction, a ratio is not a fraction, and the app has no
// way to tell which it is being shown -- so it guesses only where the guess is safe: a PROPER
// fraction (smaller over larger) with a denominator people actually write by hand.
// Everything else is left exactly as typed, which is what the app did before and is the only
// honest answer to a string whose meaning it does not know.
const DOSE_FRACTION_DENOMS = [2, 3, 4, 5, 6, 8];
function doseFractionValue(a, b) {
  const n = Number(a), d = Number(b);
  if (!d || !isFinite(n) || !isFinite(d)) return null;
  if (n >= d) return null;                                   // improper: 11/2, 25/2, 300/30
  if (DOSE_FRACTION_DENOMS.indexOf(d) === -1) return null;    // 5/325, 10/325, 80/12
  return n / d;
}
// `precise` SPLITS WHAT IS SHOWN FROM WHAT IS COUNTED, and the split goes further than rounding.
//
// The first version of this turned "1/3 tablet" into the label "0.333 tablet". Two things were
// wrong with that and the suite's own round-trip check found both. Arithmetically, three 0.333s
// total 0.999 against a one-tablet limit, so the app offered a fourth and the day ended a third
// over. And editorially, A FRACTION WAS NEVER THE PROBLEM. The ISMP list this normalisation comes
// from is about the naked decimal and the trailing zero -- marks that get MISREAD. "1/2 tablet" is
// not misread by anyone; it is how the instruction is written on the bottle and how the caregiver
// says it out loud. Rewriting it to "0.5 tablet" was the app changing something it had no reason
// to change, and every rewrite it cannot justify spends the trust it needs for the two it can.
//
// So: the LABEL keeps the fraction exactly as typed. The COUNT evaluates it at full precision.
// Three thirds of a tablet are then exactly one tablet, and the button still says "1/3 tablet".
function normaliseDoseNumber(label, precise) {
  let out = String(label == null ? '' : label);
  // Without `precise` the fraction passes below are skipped entirely -- the label is left alone --
  // and only the leading-zero and trailing-zero rules run.
  // CALLED `round3` UNTIL THE ROUNDING CAME OUT. It rounded to three decimals and that is what let
  // three thirds of a tablet total 0.999; the name outlived the behaviour by one edit, which is how
  // a helper ends up meaning the opposite of what it says.
  const numText = (n) => String(n);""",
'normaliseDoseNumber header')

src = cut(src, """  out = out.replace(/(?<![\\d.])(\\d+)\\s+(\\d+)\\s*\\/\\s*(\\d+)(?![\\d.])/g, (whole, w, a, b) => {
    const d = Number(b);
    if (!d) return whole;
    return round3(Number(w) + Number(a) / d);
  });""",
"""  if (precise) out = out.replace(/(?<![\\d.])(\\d+)\\s+(\\d+)\\s*\\/\\s*(\\d+)(?![\\d.])/g, (whole, w, a, b) => {
    const f = doseFractionValue(a, b);
    if (f === null) return whole;
    return numText(Number(w) + f);
  });""", 'the mixed-number pass')

src = cut(src, """  out = out.replace(/(?<![\\d.])(\\d+)\\s*\\/\\s*(\\d+)(?![\\d.])/g, (whole, a, b) => {
    const d = Number(b);
    if (!d) return whole;
    return round3(Number(a) / d);
  });""",
"""  if (precise) out = out.replace(/(?<![\\d.])(\\d+)\\s*\\/\\s*(\\d+)(?![\\d.])/g, (whole, a, b) => {
    const f = doseFractionValue(a, b);
    if (f === null) return whole;
    return numText(f);
  });""", 'the plain-fraction pass')

# The single-character fraction pass belongs with the other two: a bare "\u00bd" is a fraction and
# belongs in the count, but rewriting it to "0.5" on the button is the same unjustified rewrite.
src = cut(src, """  out = out.replace(/(\\d*)\\s*([\\u00bd\\u00bc\\u00be\\u2153\\u2154])/g, (whole, lead, ch) =>
    round3((lead ? Number(lead) : 0) + DOSE_FRACTIONS[ch]));""",
"""  if (precise) out = out.replace(/(\\d*)\\s*([\\u00bd\\u00bc\\u00be\\u2153\\u2154])/g, (whole, lead, ch) =>
    numText((lead ? Number(lead) : 0) + DOSE_FRACTIONS[ch]));""", 'the vulgar-fraction pass')

src = cut(src, """function parseDoseOptions(text) {
  return splitDoseOptions(text).map(raw => {
    const label = normaliseDoseNumber(raw);
    const countable = label.replace(/(\\d),(?=\\d{3}(?!\\d))/g, '$1');""",
"""function parseDoseOptions(text) {
  return splitDoseOptions(text).map(raw => {
    const label = normaliseDoseNumber(raw);
    // COUNTED FROM THE UNROUNDED FORM, SHOWN FROM THE ROUNDED ONE. See `precise` above: reading the
    // number back out of the displayed label is what made three thirds add up to 0.999.
    const countable = normaliseDoseNumber(raw, true).replace(/(\\d),(?=\\d{3}(?!\\d))/g, '$1');""",
'parseDoseOptions body')

# ---- 2. THE COMMENT THAT HAD THE SAFETY DIRECTION BACKWARDS ---------------------------------
src = cut(src, """//   * A VULGAR FRACTION is a number. "1/2 tablet" and "½ tab" are half a tablet, and the old parser
//     read both as one whole -- which errs in the dangerous direction on a pill ceiling.""",
"""//   * A VULGAR FRACTION is a number. "1/2 tablet" and "½ tab" are half a tablet, and the old parser
//     read both as one whole. THE DIRECTION OF THAT ERROR, stated correctly after the round-3 audit
//     caught this comment stating it backwards: counting a half as a whole reaches a pill ceiling
//     EARLY, so the app stops the caregiver sooner than it should. That is the SAFE direction, and
//     it is still wrong -- a limit that fires at half the medicine is a limit nobody trusts, and an
//     untrusted limit gets overridden out of habit until the day it was right.""",
'the vulgar-fraction comment')

# ---- 3. THE MIGRATION FOR MEDICATIONS THAT ALREADY EXIST -------------------------------------
src = cut(src, """function migrateLegacyMedRules(med) {""",
"""// app-v81: RE-READ THE STORED DOSE LABELS, ONCE. Round 4 fixed the parser and fixed nothing that
// was already saved: `parseDoseOptions` runs only inside the editor, so a medication saved before
// this release kept its stored `{label: ".5 mg", mg: 5}` and went on counting ten times the dose
// printed on its own button. The round-3 audit measured that on the built file and refused the
// release for it, with three documents already calling the defect fixed.
//
// ITS OWN STAMP, NOT MED_CONFIG_VERSION. Bumping the config version would re-run
// migrateLegacyMedRules over every medication, and that migration OVERWRITES schedule windows from
// its rule table -- so fixing a dose label would silently throw away times the caregiver has edited
// since. A narrow fix gets a narrow stamp.
//
// WHAT IT WRITES AND WHAT IT REFUSES TO TOUCH. It rewrites the medication's CONFIGURATION: the dose
// options list, which is settings. **It does not touch a single logged dose.** An entry records
// what the app believed when the caregiver tapped the button, and rewriting one would be editing a
// medical record after the fact -- which nothing in this app does. So a day logged under the old
// parser keeps its old numbers and the history stays true to what was believed at the time; from
// here on the button and the total agree.
const DOSE_SCHEMA_VERSION = 1;
function migrateDoseLabels(med) {
  if (!med || Number(med.doseSchemaV) >= DOSE_SCHEMA_VERSION) return med;
  const next = { ...med, doseSchemaV: DOSE_SCHEMA_VERSION };
  if (!Array.isArray(next.doses) || !next.doses.length) return next;
  // Re-read each stored label through the fixed parser. A label is re-parsed ALONE rather than
  // joined back into one comma-separated string: joining and re-splitting would merge "5" and
  // "000 units" -- a dose the OLD splitter had already broken in two -- back into one option and
  // quietly drop a button the caregiver can see today. One in, one out.
  next.doses = next.doses.map(dose => {
    if (!dose || dose.label == null) return dose;
    const again = parseDoseOptions(String(dose.label));
    if (again.length !== 1) return dose;     // ambiguous: leave it exactly as it is
    // Everything else on the stored dose is kept -- only the three fields the parser owns move.
    const fixed = { ...dose, label: again[0].label, mg: again[0].mg };
    if (again[0].pills === undefined) delete fixed.pills; else fixed.pills = again[0].pills;
    return fixed;
  });
  return next;
}
function migrateLegacyMedRules(med) {""", 'migrateLegacyMedRules anchor')

src = cut(src, """    const meds = mergeMissingDefaultMeds(migrated.map(backfillDefaultMedFlags).map(normalizeMedication).map(migrateSenokotV37), archivedMeds);""",
"""    // migrateDoseLabels runs UNCONDITIONALLY, on its own per-medication stamp -- unlike the legacy
    // migration above it, which is gated on the whole FILE's version. A file-level gate would skip
    // every medication in a config already stamped current, which is exactly the config a device
    // that has run app-v77 or later is carrying.
    const meds = mergeMissingDefaultMeds(migrated.map(backfillDefaultMedFlags).map(normalizeMedication).map(migrateSenokotV37).map(migrateDoseLabels), archivedMeds);""",
'loadMedicationConfig migration chain')

# ---- 3b. THE MIGRATION HAS TO SURVIVE THE WHITELIST AND REACH THE DISK -----------------------
# Both of these were found by the suite written for the migration, not by reading it. The migration
# ran, corrected every dose in memory, and then: normalizeMedication rebuilds a medication field by
# field, so it DROPPED the stamp -- the one-shot claim in the comment above was never true, and the
# work was redone on every single load. And the write-back was gated on the LEGACY migration, so on
# any device that has run app-v77 or later the corrected doses were never saved at all: an export or
# a backup taken today still carried ".5 mg counting 5 mg", and the next launch started over.
src = cut(src, """    ...(Number(original.schemaV) > 0 ? { schemaV: Number(original.schemaV) } : {}),""",
"""    ...(Number(original.schemaV) > 0 ? { schemaV: Number(original.schemaV) } : {}),
    // app-v81: the dose-label migration's own stamp. This function is a WHITELIST -- it rebuilds a
    // medication field by field -- so a key it does not name is dropped.
    // WHAT THIS LINE ACTUALLY DOES, corrected after falsifying it: NOTHING TODAY. migrateDoseLabels
    // runs AFTER this function in loadMedicationConfig's chain, so it sets the stamp on this
    // function's OUTPUT and the stamp reaches the disk either way -- removing this line leaves every
    // measurable behaviour identical, which a mutant proved rather than a reading of it. It is kept
    // as the guard for a REORDER: put migrateDoseLabels ahead of normalizeMedication and without
    // this line the stamp is silently eaten, the migration re-walks every medication on every load
    // forever, and nothing anywhere fails. The one-shot property is really carried by
    // `needsDoseMigration` below, which reads the stamp off the stored file before anything
    // normalises it -- and THAT is what the suite measures.
    ...(Number(original.doseSchemaV) > 0 ? { doseSchemaV: Number(original.doseSchemaV) } : {}),""",
'normalizeMedication whitelist')

src = cut(src, """    const meds = mergeMissingDefaultMeds(migrated.map(backfillDefaultMedFlags).map(normalizeMedication).map(migrateSenokotV37).map(migrateDoseLabels), archivedMeds);""",
"""    // Measured BEFORE the map, because afterwards every medication carries the stamp and there is
    // nothing left to ask. This is the flag that decides whether the corrected doses are written
    // back, and without it they were corrected in memory on every load and saved on none -- so a
    // backup taken today still carried ".5 mg counting 5 mg", and the app did the same work again
    // on the next launch, forever.
    const needsDoseMigration = saved.meds.some(m => !(Number(m && m.doseSchemaV) >= DOSE_SCHEMA_VERSION));
    const meds = mergeMissingDefaultMeds(migrated.map(backfillDefaultMedFlags).map(normalizeMedication).map(migrateSenokotV37).map(migrateDoseLabels), archivedMeds);""",
'the migration chain, for the persist flag')

src = cut(src, """    if (needsLegacyMigration) setTimeout(() => persistMedicationConfig(state.meds, state.archivedMeds), 0);""",
"""    if (needsLegacyMigration || needsDoseMigration) setTimeout(() => persistMedicationConfig(state.meds, state.archivedMeds), 0);""",
'the deferred persist')

# ---- 4. THE VOICE: SAY WHAT WILL ACTUALLY BE SAVED --------------------------------------------
src = cut(src, """        formInput({ id: 'med-doses-text', value: form.dosesText, placeholder: '500 mg, 1000 mg', onInput: event => updateMedicationForm('dosesText', event.target.value, 'debounced') })
      ),""",
"""        formInput({ id: 'med-doses-text', value: form.dosesText, placeholder: '500 mg, 1000 mg', onInput: event => updateMedicationForm('dosesText', event.target.value, 'debounced') })
      ),
      // app-v81, and the Voice raised it in the round-3 audit: THE APP REWRITES WHAT THE CAREGIVER
      // TYPED. ".5 mg" is saved as "0.5 mg", "1/2 tablet" as "0.5 tablet". That is deliberate and it
      // is what a pharmacy system does -- a naked decimal is the single most misread mark in a
      // written dose. But it was happening SILENTLY, and the same audit proved the rewrite can be
      // wrong: it turned a combination strength into a number twenty thousand times too small. A
      // silent rewrite that can be wrong is the worst of both. So the caregiver sees the result
      // before saving, and only when it differs from what they typed -- a line that appears on every
      // medication would be noise, and noise is not disclosure.
      dosesRewrittenNotice(form),""",
'the Dosage options field')

src = cut(src, """// v38 (Aaron-requested): whether Dosage options actually carries an amount in the currently-picked
// Limit unit""",
"""// What the caregiver will actually get, shown only when the app changed what they wrote. Compared
// on the JOINED options rather than on the raw text, so adding a space or a trailing comma does not
// light it up -- the notice is about the app changing a NUMBER, not about whitespace.
function dosesRewrittenNotice(form) {
  const raw = String(form.dosesText || '').trim();
  if (!raw) return null;
  const parsed = parseDoseOptions(raw);
  if (!parsed.length) return null;
  const shown = parsed.map(d => d.label).join(', ');
  if (shown === splitDoseOptions(raw).join(', ')) return null;
  return h('div', { style: { display: 'flex', gap: '6px', alignItems: 'flex-start', margin: '4px 0 2px',
      padding: '7px 9px', borderRadius: '9px', background: 'rgba(246,108,49,0.07)',
      border: '1px solid rgba(246,108,49,0.20)' } },
    h('div', { style: { fontSize: '13px', lineHeight: '1.4', color: '#5A4038' } },
      h('strong', { style: { fontWeight: '700' } }, 'Will be saved as: '),
      shown,
      h('div', { style: { fontSize: '12.5px', marginTop: '2px', color: '#7A5C50' } },
        'Amounts are written the way a pharmacy writes them, so they cannot be misread. Change the box above if this is not what you meant.')));
}
// v38 (Aaron-requested): whether Dosage options actually carries an amount in the currently-picked
// Limit unit""", 'the dailyLimitPreview anchor')

HTML.write_text(src, encoding='utf-8')
print('app-v81 round 5 applied: proper fractions only, existing medications migrated, the rewrite is shown')
