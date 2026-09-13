#!/usr/bin/env python3
"""app-v79, round 4: the five code-side items of the round-3 audit, which PASSED the release.

F-R3-3 -- the grouped label was fixed on the warning banner and NOT on the Home card, which is the
surface round 2 raised it on first. Both now go through one helper, and the fallback stops printing
'Untitled medication' into a safety warning by a longer route.
F-R3-4 -- the singulariser, measured across 42 units by the auditor: correct for -es, ss, mg/mL,
one-letter units and Spanish/French plurals, and still wrong for bolus -> bolu, suppositories ->
suppositorie, gas -> ga, lens -> len.
"""
import sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent
HTML = ROOT / 'index.html'

def die(msg):
    print('PATCH FAILED: ' + msg); sys.exit(1)

src = HTML.read_text(encoding='utf-8')
if 'function sharedTotalLabel' in src:
    die('already applied')

def cut(old, new, what):
    global src
    if src.count(old) != 1:
        die(what + ' is not where it was (found ' + str(src.count(old)) + ') -- nothing written')
    src = src.replace(old, new, 1)

# ---- F-R3-3: ONE helper, both surfaces ----------------------------------------------------------
cut("""function ceilingGroupMedIds(med) {""",
    """// What to call a total that belongs to several medications at once. Two surfaces show one --
// the red ceiling warning and the Home daily-total card -- and until now each had its own copy of
// the join, so a fix landed on one and not the other. The audit asked for both; one arrived.
//
// CAPPED, because it is unbounded otherwise: measured on a six-member group the join produced a
// 114-character banner title, repeated verbatim in the body, with the number and the instruction
// buried behind a list.
//
// AND PLACEHOLDER-PROOF, because normalizeMedication writes 'Untitled medication' for a missing
// name -- so `.filter(Boolean)` can never fire, and the word reaches a safety warning. Falling back
// to the ceiling owner is not enough either: the owner can be the unnamed one. The first member
// that has a real name is the fallback, and only if there is none does the owner's name stand.
const UNNAMED_MED = 'Untitled medication';
function sharedTotalLabel(med) {
  const names = med ? ceilingGroupMedIds(med)
    .map(id => (state.meds.find(m => m.id === id) || {}).name)
    .filter(n => n && n !== UNNAMED_MED) : [];
  if (names.length > 2) return names.slice(0, 2).join(' + ') + ' and ' + (names.length - 2) + ' more';
  if (names.length > 1) return names.join(' + ');
  return names[0] || (med || {}).name || UNNAMED_MED;
}
function ceilingGroupMedIds(med) {""",
    'ceilingGroupMedIds')

_lbl_start = src.index("  const ceilingNames = ceilingOwner ? ceilingGroupMedIds(ceilingOwner)")
_lbl_end = src.index("\n", src.index("    : (ceilingOwner || {}).name;", _lbl_start))
src = src[:_lbl_start] + "  const limitLabel = sharedTotalLabel(ceilingOwner);" + src[_lbl_end:]

cut("""? ceilingGroupMedIds(hcMed).map(gid => (state.meds.find(m => m.id === gid) || {}).name).filter(Boolean).join(' + ')""",
    """? sharedTotalLabel(hcMed)""",
    "the home card's group label")

# ---- F-R3-4: two more endings where the rule is not safe ----------------------------------------
cut("""      // patches -> patch, boxes -> box, sprays -> spray, doses -> dose.
      if (/(ch|sh|ss|x|z)es$/i.test(hcUnit)) return hcUnit.replace(/es$/i, '');
      // Not `ss` (a unit ending in double-s is not a plural), and not a bare one-letter word.
      if (/[^s]s$/i.test(hcUnit) && hcUnit.length > 2) return hcUnit.replace(/s$/i, '');
      return hcUnit;""",
    """      // WHERE THE RULE IS NOT SAFE THE UNIT IS LEFT EXACTLY AS TYPED. `ceilingUnit` is free text,
      // so "2 feet" where "1 foot" was meant is a wording slip and "1 fee" is a different word.
      // The endings below were measured across 42 real units by the round-3 audit.
      // -us, -is, -as: bolus, dosis, gas -- singular nouns that happen to end in s.
      if (/(us|is|as)$/i.test(hcUnit)) return hcUnit;
      // lens, and anything else short enough that dropping a letter leaves a stump.
      if (hcUnit.length <= 4) return hcUnit;
      // suppositories -> suppository. The other common English plural.
      if (/[^aeiou]ies$/i.test(hcUnit)) return hcUnit.replace(/ies$/i, 'y');
      // patches -> patch, boxes -> box, glasses -> glass.
      if (/(ch|sh|ss|x|z)es$/i.test(hcUnit)) return hcUnit.replace(/es$/i, '');
      // Not `ss` -- a unit ending in double-s is not a plural.
      if (/[^s]s$/i.test(hcUnit)) return hcUnit.replace(/s$/i, '');
      return hcUnit;""",
    "the singulariser's unsafe endings")

HTML.write_text(src, encoding='utf-8')
print('app-v79 round 4 applied: one label helper for both surfaces, and two more unsafe plurals')
