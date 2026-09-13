#!/usr/bin/env python3
"""app-v78 -> app-v79: everything the phase 2/3 audit found, and it found a dead Home screen.

THE HEADLINE. `medHomeCardKind()` is called three times and defined nowhere. Phase 1 deleted it --
correctly, it had no callers then -- and phase 2 added three and never put it back. Home throws
`ReferenceError: medHomeCardKind is not defined` on every render after the first for any device whose
medication list went through the legacy migration, which is the migration this release exists to
perform. History is dead too.

ALL FIVE SUITES -- 103 CHECKS -- PASSED WHILE THE APP WAS DEAD, and the reason is the finding behind
every other item here: `v77-legacy-migration-equivalence` lifts FOUR functions into a Node sandbox.
It never runs `status()`, `missedDosesFor()`, `afterLog()`, the home cards or the history summary,
which is where every defect below lives. No suite in this repo has ever rendered a screen with a
medication that carries a `homeCard`. "Zero differences" was a statement about four functions, not
about the release.
"""
import sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent
HTML = ROOT / 'index.html'
SW = ROOT / 'sw.js'

def die(msg):
    print('PATCH FAILED: ' + msg); sys.exit(1)

src = HTML.read_text(encoding='utf-8')
if 'function medHomeCardKind' in src:
    die('already applied')

def cut(old, new, what):
    global src
    if src.count(old) != 1:
        die(what + ' is not where it was (found ' + str(src.count(old)) + ') -- nothing written')
    src = src.replace(old, new, 1)

# ---- 1. THE DEAD HOME SCREEN --------------------------------------------------------------------
cut("""// medHomeCardKind IS DELIBERATELY NOT HERE.""",
    """// medHomeCardKind. Phase 1 removed it because nothing called it; phase 2 added three call sites and
// did not put it back, so `medHomeCardKind is not defined` threw on every render after the first for
// any device whose medications had been migrated. Home froze on its pre-entries paint -- the
// caregiver could not see or log a dose from it -- and History died with it. Five suites, 103 checks,
// all green, because not one of them renders a screen with a medication that has a homeCard.
//
// It reads the property and nothing else. The legacy ids it used to fall back to are gone.
function medHomeCardKind(med) {
  const kind = med && med.homeCard && typeof med.homeCard === 'object' ? med.homeCard.kind : null;
  return ['mg', 'pills', 'ml'].includes(kind) ? kind : null;
}
// The phase 1 note, kept because it is still the reason this function is shaped the way it is:""",
    'the medHomeCardKind comment')

# ---- 2. THE ACETAMINOPHEN CEILING GOING SILENT ---------------------------------------------------
# The old code deliberately borrowed the ceiling from the group's ceiling-bearing medication when a
# liquid was logged. dailyCeiling(theLiquid) returns null because the liquid carries only a volume
# cap, so 3,500mg against a 3,000mg ceiling produced NO WARNING AT ALL.
# ---- 3. and the early return suppressed the volume warning that used to fire alongside it.
# ---- 4. "Take all" fired afterLog per id into one `state.warn` slot, so the last call won and a red
#         ceiling warning was silently overwritten by an amber spacing reminder.
_al_start = src.index("  const configuredMedication = state.meds.find(med => med.id === entry.medId);")
_al_end = src.index("\n}\n\nasync function logMed(", _al_start)
_removed = src[_al_start:_al_end]
for _needle in ["dailyCeiling(configuredMedication)", "dailyVolumeCeiling(configuredMedication)"]:
    if _needle not in _removed:
        die('afterLog is not shaped as expected (missing ' + _needle + ') -- nothing written')
AFTERLOG = """  const configuredMedication = state.meds.find(med => med.id === entry.medId);
  // EVERY WARNING THIS DOSE EARNS, THEN THE WORST ONE. Three separate defects lived in the shape
  // this replaces, all found by the phase 2/3 audit:
  //  * the mg branch `return`ed, so a liquid over BOTH its mg ceiling and its millilitre cap only
  //    ever reported one of them;
  //  * "Take all" calls this once per medication into a single `state.warn` slot, so with
  //    ['tylenol','iron'] the red "daily limit exceeded" was silently overwritten by the amber
  //    spacing reminder, and with ['iron','tylenol'] it was not -- the caregiver's warning depended
  //    on list order;
  //  * and a red warning must never lose to an amber one, whatever order they arrive in.
  const warnings = [];

  // THE ACETAMINOPHEN CEILING, WHICH WENT SILENT AND IS THE ONE THAT KILLS PEOPLE.
  // dailyCeiling(theLiquid) is null -- a liquid carries a volume cap, not an mg ceiling -- so
  // logging 1,500mg of liquid on top of 2,000mg of pills produced NO WARNING AT ALL against a
  // 3,000mg limit. The old code deliberately borrowed the ceiling from the group. `ceilingGroup` is
  // already the generic expression of "these share one daily total"; the group's ceiling-bearing
  // medication is the one to ask.
  const ceilingOwner = (configuredMedication && configuredMedication.ceilingGroup)
    ? (state.meds.find(m => m.ceilingGroup === configuredMedication.ceilingGroup && medicationCeilingMax(m))
       || configuredMedication)
    : configuredMedication;
  const configuredLimit = dailyCeiling(ceilingOwner);
  if (configuredLimit && configuredLimit.used > configuredLimit.max) {
    // Named for the medication that OWNS the limit, not the one just logged: "Tylenol daily limit
    // exceeded" after a dose of Tylenol Liquid is the true statement, because they share one total.
    warnings.push({ tone: 'red', title: ceilingOwner.name + ' daily limit exceeded', body: "Today's " + ceilingOwner.name + ' total is ' + configuredLimit.used.toLocaleString() + ' ' + configuredLimit.unit + ', above the ' + configuredLimit.label + ' daily limit set for it. Check with the care team before logging more.' });
  }
  const volumeLimit = dailyVolumeCeiling(configuredMedication);
  if (volumeLimit && volumeLimit.used > volumeLimit.max) {
    warnings.push({ tone: 'red', title: configuredMedication.name + ' volume limit exceeded', body: "Today's " + configuredMedication.name + ' total is ' + volumeLimit.used + ' ' + volumeLimit.unit + ', above the ' + volumeLimit.label + ' daily limit set for it. Check with the care team before logging more.' });
  }
  for (const w of medInteractionsFor(entry)) warnings.push(w);

  if (!warnings.length) return;
  // RED BEATS AMBER, AND AN EXISTING RED IS NEVER OVERWRITTEN. Take-all calls this in a loop; a
  // ceiling warning raised by the first medication must survive a spacing reminder raised by the
  // third.
  const worst = warnings.find(w => w.tone === 'red') || warnings[0];
  if (state.warn && state.warn.tone === 'red' && worst.tone !== 'red') return;
  setState({ warn: worst });
"""
src = src[:_al_start] + AFTERLOG + src[_al_end:]

# ---- 5. a device that cannot write to localStorage lost its whole medication list -----------------
# loadMedicationConfig ran persistMedicationConfig inline. On a write failure that calls setToast ->
# setState -> `state`, which is in the temporal dead zone at that point, and the ReferenceError
# escaped into loadMedicationConfig's own catch, which returns the EMPTY fallback. Safari Private
# Browsing and a full disk both hit this, and the medications vanish for the session.
cut("""    if (needsLegacyMigration) persistMedicationConfig(meds, archivedMeds);""",
    """    // DEFERRED, NOT INLINE. Called here it runs during module init, before `let state` is
    // initialised -- and its own failure path calls setToast -> setState -> state, throwing a
    // ReferenceError out of this function's try, whose catch returns the EMPTY fallback. On a device
    // that cannot write to localStorage (Safari Private Browsing, a full disk) the caregiver's whole
    // medication list disappeared for the session. A timeout puts the write after init, where a
    // failed save is a toast rather than a data loss.
    if (needsLegacyMigration) setTimeout(() => persistMedicationConfig(state.meds, state.archivedMeds), 0);""",
    'the migration persist')

# ---- 8. the migration ran again on every restore, and reverted edited window times ----------------
# cwBkRestore writes version: 1, and migrateLegacyMedRules never stamped the medications it migrated,
# so gate 2 never protected them -- and `windows` was replaced unconditionally every time.
cut("""    const replace = (key === 'windows');
    if (replace || next[key] === undefined) next[key] = JSON.parse(JSON.stringify(rules[key]));""",
    """    // ONLY WHEN ABSENT, INCLUDING `windows`. This replaced windows unconditionally so that a
    // dexamethasone medication stored before the properties existed got the everyday times the old
    // code hardcoded and ignored med.windows for. But the migration can run more than once -- a
    // backup restore writes version 1 -- so a caregiver who edited their dexamethasone times had
    // them silently reverted to 8-12 / 14-18 on the next restore. The medication is stamped below
    // instead, which makes the migration genuinely one-shot, so replacing once is enough.
    if (key === 'replaceWindows') continue;   // a directive to this function, not a medication field
    if (next[key] === undefined) next[key] = JSON.parse(JSON.stringify(rules[key]));""",
    "migrateLegacyMedRules' replace rule")

# The dexamethasone windows still have to land exactly once. The old code IGNORED med.windows for
# this medication entirely -- dexWindowsForOffset built the times itself -- so a stored legacy
# dexamethasone always HAS windows, and they are not the ones the app actually used. The rule's times
# must therefore overwrite what is stored, once. Expressed as a FLAG ON THE RULE, not an
# `if (med.id === 'dexamethasone')` in migrateLegacyMedRules: that would be the fourteenth branch on a
# medication id in the release whose entire point is that there are none left.
cut("""  'dexamethasone': {
    windows: [{ start: 8, end: 12, name: 'Morning' }, { start: 14, end: 18, name: 'Afternoon' }],""",
    """  'dexamethasone': {
    // A legacy dexamethasone already has windows and the old code ignored them, so these have to
    // replace what is stored rather than only filling a gap. The flag lives on the rule -- see
    // migrateLegacyMedRules -- so no code anywhere branches on this medication's name.
    replaceWindows: true,
    windows: [{ start: 8, end: 12, name: 'Morning' }, { start: 14, end: 18, name: 'Afternoon' }],""",
    'the dexamethasone rule')
cut("""  if (!rules) return next;""",
    """  if (!rules) return next;
  // `windows` is the one key the old code IGNORED on a legacy medication -- dexWindowsForOffset never
  // looked at med.windows -- so the rule's own times have to overwrite what is stored, exactly once.
  // Expressed as a flag ON THE RULE rather than a check on the id: an `if (med.id === '...')` here
  // would be the fifteenth such branch, in the release whose whole point is that there are none.
  if (rules.replaceWindows) delete next.windows;
  next.schemaV = MED_CONFIG_VERSION;""",
    "migrateLegacyMedRules' stamp")

# ---- 7. the daily-total cards were not equivalent -------------------------------------------------
cut("""  'imodium': { homeCard: { kind: 'pills' } },""",
    """  'imodium': { homeCard: { kind: 'pills' }, ceiling: true, ceilingMax: 4, ceilingUnit: 'pills' },
  // Missing entirely, so its card disappeared: the old medHomeCardKind returned 'pills' for it and
  // the old block carried `const lidoMax = 4`. Both were one care plan's numbers; they are written
  // here as that medication's own configured limit, once, on data that predates the properties.
  'lidocaine': { homeCard: { kind: 'pills' }, ceiling: true, ceilingMax: 4, ceilingUnit: 'applications' },""",
    'the imodium rule')
cut("""  'tylenol': { homeCard: { kind: 'mg' } },""",
    """  'tylenol': { homeCard: { kind: 'mg' } },
  // Was `const imoMax = 4` inline; see the imodium entry for why it is here.""",
    'the tylenol rule')

# a kind:'ml' card could never show a limit, because medicationCeilingMax reads only ceiling/ceilingMax
cut("""    const hcMax = medicationCeilingMax(hcMed) || 0;""",
    """    // A kind:'ml' card was structurally incapable of showing a limit or a bar: medicationCeilingMax
    // reads `ceiling`/`ceilingMax` and a liquid's cap lives in `volumeCeilingMl`. It showed a bare
    // running total with "No daily limit set" under a medication that has one.
    const hcMax = (kind === 'ml' ? Number(hcMed.volumeCeilingMl) : medicationCeilingMax(hcMed)) || 0;""",
    "the home card's ceiling")
cut("""    const hcUnit = kind === 'mg' ? 'mg' : (kind === 'ml' ? 'mL' : (hcMed.ceilingUnit || 'doses'));""",
    """    const hcUnit = kind === 'mg' ? 'mg' : (kind === 'ml' ? 'mL' : (hcMed.ceilingUnit || 'doses'));
    // "1 doses". The unit is a plural word and the count can be one.
    const hcUnitFor = (n) => (n === 1 && /s$/.test(hcUnit)) ? hcUnit.replace(/s$/, '') : hcUnit;""",
    "the home card's unit")
src = src.replace("""            hcMax > 0 ? (hcLeft.toLocaleString() + ' ' + hcUnit + ' left before the daily limit') : 'No daily limit set')""",
                  """            hcMax > 0 ? (hcLeft.toLocaleString() + ' ' + hcUnitFor(hcLeft) + ' left before the daily limit') : 'No daily limit set')""", 1)
src = src.replace("""            hcMax > 0 ? (' / ' + hcMax.toLocaleString() + ' ' + hcUnit) : (' ' + hcUnit))""",
                  """            hcMax > 0 ? (' / ' + hcMax.toLocaleString() + ' ' + hcUnit) : (' ' + hcUnitFor(hcUsed)))""", 1)

# a grouped card must say what it is totalling, not the name of one member
cut("""          h('div', { style: { ...TYPE.label, color: '#915E48' } }, hcMed.name + ' · today'),""",
    """          // A GROUPED CARD IS NOT ONE MEDICATION. With Tylenol and Tylenol Liquid sharing a
          // ceilingGroup the total is both of them, and labelling it "Tylenol · today" tells a
          // caregiver who gave 500mg of pills that they have given 980mg of Tylenol.
          h('div', { style: { ...TYPE.label, color: '#915E48' } },
            // ONLY WHERE THE TOTAL REALLY IS THE GROUP'S. A ceilingGroup shares an mg total; it does
            // NOT share a millilitre cap, which is one medication's own labelled limit. Labelling the
            // mL card "Tylenol + Tylenol Liquid" over a figure that counts only the liquid is the
            // same false impression in the other direction -- found by looking at the rendered
            // screen, which is the thing no suite had been doing.
            (kind === 'mg' && hcMed.ceilingGroup && ceilingGroupMedIds(hcMed).length > 1
              ? ceilingGroupMedIds(hcMed).map(gid => (state.meds.find(m => m.id === gid) || {}).name).filter(Boolean).join(' + ')
              : hcMed.name) + ' · today'),""",
    "the home card's label")

# ---- 9. a PASS that prints a failure message ------------------------------------------------------
# (in the test file, handled separately)

# ---- version --------------------------------------------------------------------------------------
if src.count("const APP_VERSION = 'app-v78';") != 1:
    die('APP_VERSION is not app-v78')
sw = SW.read_text(encoding='utf-8')
if "const CACHE = 'chemowell-app-v78-1';" not in sw:
    die('sw.js CACHE is not at app-v78-1 -- nothing was written')
src = src.replace("const APP_VERSION = 'app-v78';", "const APP_VERSION = 'app-v79';", 1)
sw_next = sw.replace("const CACHE = 'chemowell-app-v78-1';", "const CACHE = 'chemowell-app-v79-1';", 1)

HTML.write_text(src, encoding='utf-8')
SW.write_text(sw_next, encoding='utf-8')
print('app-v79 applied: the dead Home screen, the silent acetaminophen ceiling, and six more')
