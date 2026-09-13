#!/usr/bin/env python3
"""app-v79, round 3: the round-2 audit says the code is right and the CHECK is the blocker.

THE HEADLINE, and it is the same failure one level up. Round 1's collection logic was correct and the
CALLING CONTEXT was wrong. Round 2's afterLog is correct and the calling context is UNTESTED: the
auditor deleted the batch token from the one and only production caller -- the ids.forEach inside
"Take all" -- and test/v79-warning-priority.mjs stayed 6/6 while all nine suites stayed green, 243
checks, with the real app back at the exact app-v78 defect. The suite builds its own token inside
page.evaluate and calls afterLog directly, so it tests the CONTRACT and never the caller that has to
honour it. "Falsified three ways" was true and all three mutants were inside afterLog.

Code changes here are R2-2, R2-4, R2-5, R2-6 and R2-7. The blocker (R2-1) and R2-3 and R2-8 are
fixed in the suites, which this patch does not touch.
"""
import sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent
HTML = ROOT / 'index.html'

def die(msg):
    print('PATCH FAILED: ' + msg); sys.exit(1)

src = HTML.read_text(encoding='utf-8')
if 'and ' + "' + (ceilingNames.length - 2)" in src:
    die('already applied')

def cut(old, new, what):
    global src
    if src.count(old) != 1:
        die(what + ' is not where it was (found ' + str(src.count(old)) + ') -- nothing written')
    src = src.replace(old, new, 1)

# ---- R2-6: the claim this release exists to disown is still in the file -------------------------
cut("""  // Was `const imoMax = 4` inline; see the imodium entry for why it is here.
  'tylenol-liquid': { homeCard: { kind: 'ml' } },""",
    """  'tylenol-liquid': { homeCard: { kind: 'ml' } },""",
    'the false imoMax comment')

# ---- R2-4 (VOICE): the grouped label is unbounded and prints a placeholder into a safety warning --
cut("""  const limitLabel = ceilingNames.length > 1 ? ceilingNames.join(' + ') : (ceilingOwner || {}).name;""",
    """  // CAPPED AT TWO, AND NEVER THE PLACEHOLDER. Measured on a six-member group, the join produced a
  // 114-character banner title, repeated verbatim in the body -- the number and the instruction
  // buried behind a list, and the one word that catches the eye is "Untitled". `.filter(Boolean)`
  // cannot help: normalizeMedication writes 'Untitled medication' for a missing name, so no member
  // is ever falsy and the placeholder reaches a safety warning. Where any member is unnamed the
  // label falls back to the medication that owns the limit, which is at least a real name.
  const PLACEHOLDER = 'Untitled medication';
  const limitLabel = (ceilingNames.length > 1 && !ceilingNames.includes(PLACEHOLDER))
    ? (ceilingNames.length <= 2
        ? ceilingNames.join(' + ')
        : ceilingNames.slice(0, 2).join(' + ') + ' and ' + (ceilingNames.length - 2) + ' more')
    : (ceilingOwner || {}).name;""",
    'the grouped ceiling label')

# ---- R2-7 (VOICE): "set for it" after a compound subject ----------------------------------------
cut("""configuredLimit.label + ' daily limit set for it. Check with the care team before logging more.' });""",
    """configuredLimit.label + ' daily limit these share. Check with the care team before logging more.' });""",
    "the ceiling warning's closing sentence")

# ---- R2-5: two reds in one batch, and a comment that says it cannot happen ----------------------
cut("""  // RED BEATS AMBER, AND AN EXISTING RED IS NEVER OVERWRITTEN. Take-all calls this in a loop; a
  // ceiling warning raised by the first medication must survive a spacing reminder raised by the
  // third.""",
    """  // RED BEATS AMBER, AND THE FIRST RED OF A BATCH IS NEVER REPLACED -- INCLUDING BY ANOTHER RED.
  // The previous guard only suppressed a DOWNGRADE, so with two reds in one "Take all" the second
  // overwrote the first: a group acetaminophen ceiling raised first was replaced by a volume cap
  // raised second, three lines under a comment saying an existing red is never overwritten. Not a
  // regression -- there has only ever been one banner slot -- but the comment and the shipped
  // version-history row both said something untrue about the one case that matters most, two reds
  // at once with acetaminophen among them. The comment is now the behaviour.""",
    "the downgrade guard's comment")
cut("""  if (warnBatch && warnBatch.red && worst.tone !== 'red') return;""",
    """  if (warnBatch && warnBatch.red) return;""",
    'the downgrade guard')

# ---- found by the R2-3 check the audit asked for: "1 / 1 patche" ------------------------------
# The singulariser was `replace(/s$/, '')`, which is right for doses, pills, lozenges and
# applications -- every unit the fixtures happened to use -- and wrong for any plural formed with
# -es. `ceilingUnit` is FREE TEXT the caregiver types, so the rule has to survive words nobody here
# chose. It still cannot handle an irregular plural, so where the rule is not safe the unit is left
# exactly as typed: showing "2 feet" where "1 foot" was meant is a wording slip, and inventing
# "1 fee" is a different word.
cut("""    const hcUnitFor = (n) => (n === 1 && /s$/.test(hcUnit)) ? hcUnit.replace(/s$/, '') : hcUnit;""",
    """    const hcUnitFor = (n) => {
      if (n !== 1) return hcUnit;
      // patches -> patch, boxes -> box, sprays -> spray, doses -> dose.
      if (/(ch|sh|ss|x|z)es$/i.test(hcUnit)) return hcUnit.replace(/es$/i, '');
      // Not `ss` (a unit ending in double-s is not a plural), and not a bare one-letter word.
      if (/[^s]s$/i.test(hcUnit) && hcUnit.length > 2) return hcUnit.replace(/s$/i, '');
      return hcUnit;
    };""",
    "the home card's singulariser")

HTML.write_text(src, encoding='utf-8')
print('app-v79 round 3 applied: the unbounded label, the second red, and two false sentences')
