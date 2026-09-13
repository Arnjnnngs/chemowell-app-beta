#!/usr/bin/env python3
"""app-v77 -> app-v78: HARDCODED_MEDS_PLAN.md PHASE 3 — the fence comes down.

AARON, 2026-09-13: "Lets go ahead and run phase 3."

WHAT THE FENCE WAS. `RESERVED_LEGACY_MED_IDS` is a list of thirteen real drug names that a customer
was FORBIDDEN from using. Type "Zofran" and the app silently gave the medication the id `zofran-2`,
because a medication with the id `zofran` would have inherited another patient's three-day
post-chemo block. The app knew its own logic was unsafe for strangers and fenced users out of it
rather than fixing it. Phases 1 and 2 fixed it; this deletes the fence.

After this, a customer names their medication Zofran, gets the id `zofran`, and gets exactly the
behaviour they configured and nothing else.

THE ONE REAL HAZARD, AND THE TWO GATES THAT CLOSE IT.
`LEGACY_MED_RULES` still exists, because someone out there may still be carrying a config written
before phase 2 -- a restored backup, an older sync. It must reach that data and must never reach a
medication a customer just created and happened to name Zofran.

  GATE 1, the config version. The migration runs only when the stored config is older than
  MED_CONFIG_VERSION. A device that has loaded once since phase 2 never runs it again.

  GATE 2, added here, and it is the one that matters after the fence is gone. Gate 1 is a property
  of the FILE, and a file can be replaced: restore a version-1 backup onto a phase-3 device and the
  migration runs again -- over a medication the customer created, with the id `zofran`, which is now
  a thing that can exist. So every medication created from this release onward is stamped with
  `schemaV`, and the migration skips any medication carrying one. A medication that was there before
  the properties existed cannot have the stamp; a medication created after them always does.

WHAT IT APPENDS: one integer, `schemaV`, on newly created medications.
WHAT IT DELETES: `RESERVED_LEGACY_MED_IDS`. No record, no entry, no user data.
"""
import sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent
HTML = ROOT / 'index.html'
SW = ROOT / 'sw.js'

def die(msg):
    print('PATCH FAILED: ' + msg); sys.exit(1)

src = HTML.read_text(encoding='utf-8')
if 'RESERVED_LEGACY_MED_IDS' not in src:
    die('the fence is already gone')
if 'schemaV' in src:
    die('already applied')

def cut(old, new, what):
    global src
    if src.count(old) != 1:
        die(what + ' is not where it was (found ' + str(src.count(old)) + ') -- nothing written')
    src = src.replace(old, new, 1)

# ---- 1. GATE 2: stamp every medication created from now on ---------------------------------------
cut("""function nextMedicationId(name, existingId) {
  const base = safeMedicationId(name, 'medication');
  if (existingId) return existingId;
  const ids = new Set(state.meds.map(med => med.id));
  const taken = id => ids.has(id) || RESERVED_LEGACY_MED_IDS.has(id);
  if (!taken(base)) return base;""",
    """function nextMedicationId(name, existingId) {
  const base = safeMedicationId(name, 'medication');
  if (existingId) return existingId;
  const ids = new Set(state.meds.map(med => med.id));
  // THE FENCE IS GONE (app-v78). This used to also refuse thirteen real drug names, so a customer
  // typing "Zofran" got `zofran-2` and a customer typing "Tylenol" got `tylenol-2` -- because a
  // medication holding one of those ids would have inherited another patient's regimen. Phases 1
  // and 2 moved every one of those rules onto properties the medication owns, so an id is just an
  // id now. The only thing still refused is a collision with a medication that actually exists.
  const taken = id => ids.has(id);
  if (!taken(base)) return base;""",
    'nextMedicationId')

cut("""const RESERVED_LEGACY_MED_IDS = new Set(['dexamethasone', 'zofran', 'protonix', 'tylenol', 'tylenol-liquid', 'iron', 'compazine', 'buspirone', 'paroxetine', 'morphine', 'senokot', 'imodium', 'lidocaine']);
""", "", 'the RESERVED_LEGACY_MED_IDS declaration')

# ---- 2. the migration must never touch a medication created after the properties existed ---------
cut("""function migrateLegacyMedRules(med) {
  let next = med ? { ...med } : med;""",
    """function migrateLegacyMedRules(med) {
  // GATE 2 (app-v78). The config-version gate is a property of the FILE, and a file can be replaced:
  // restoring a version-1 backup onto this release runs the migration again -- over a medication the
  // customer created, possibly with the id `zofran`, which is a thing that can exist now the fence
  // is down. A medication created from app-v78 onward carries schemaV; one that predates the
  // properties cannot. So the stamp, not the id, decides.
  if (med && Number(med.schemaV) >= MED_CONFIG_VERSION) return med;
  let next = med ? { ...med } : med;""",
    'migrateLegacyMedRules')

# stamp it at save
cut("""  const id = nextMedicationId(name, editor.sourceId);""",
    """  const id = nextMedicationId(name, editor.sourceId);
  // app-v78: stamps this medication as postdating the properties, so the legacy migration can never
  // reach it however old the config file around it claims to be. See migrateLegacyMedRules.
  const schemaV = MED_CONFIG_VERSION;""",
    'the medication save id assignment')

_saved = src.index("  const id = nextMedicationId(name, editor.sourceId);")
_obj = src.index("    id,", _saved)
src = src[:_obj] + "    id,\n    schemaV,\n" + src[_obj + len("    id,\n"):]

# and preserve it through normalisation
cut("""    groupedAfternoon: !!original.groupedAfternoon,""",
    """    groupedAfternoon: !!original.groupedAfternoon,
    // app-v78: carried through explicitly rather than relying on `...original`, because this is the
    // flag that stops a customer's own medication being handed another patient's regimen by a
    // restored backup. A field that matters that much is not left to a spread.
    ...(Number(original.schemaV) > 0 ? { schemaV: Number(original.schemaV) } : {}),""",
    'the medication field block')

# ---- 3. the comments that describe a fence that no longer exists ---------------------------------
src = src.replace("""// medication can ever take (see RESERVED_LEGACY_MED_IDS) -- so every real medication that turned the""",
                  """// medication could ever take while the fence existed -- so every real medication that turned the""")
src = src.replace("""// real user-created medication can ever have (RESERVED_LEGACY_MED_IDS exists specifically to stop a
// new medication from inheriting another patient's rules), so every branch was unreachable dead code""",
                  """// real user-created medication could have while the fence existed (app-v78 removed it, by which
// point nothing keyed off those ids at all), so every branch was unreachable dead code""")
src = src.replace("""// RESERVED_LEGACY_MED_IDS so a customer can name their medication Zofran and get the id `zofran`.""",
                  """// the fence so a customer can name their medication Zofran and get the id `zofran` (done, app-v78).""")

if 'RESERVED_LEGACY_MED_IDS' in src:
    die('a reference to the fence survived: ' + repr(src[max(0, src.index('RESERVED_LEGACY_MED_IDS') - 60):src.index('RESERVED_LEGACY_MED_IDS') + 60]))

# ---- 4. version ----------------------------------------------------------------------------------
if src.count("const APP_VERSION = 'app-v77';") != 1:
    die('APP_VERSION is not app-v77')
sw = SW.read_text(encoding='utf-8')
if "const CACHE = 'chemowell-app-v77-1';" not in sw:
    die('sw.js CACHE is not at app-v77-1 -- nothing was written')
src = src.replace("const APP_VERSION = 'app-v77';", "const APP_VERSION = 'app-v78';", 1)
sw_next = sw.replace("const CACHE = 'chemowell-app-v77-1';", "const CACHE = 'chemowell-app-v78-1';", 1)

HTML.write_text(src, encoding='utf-8')
SW.write_text(sw_next, encoding='utf-8')
print('app-v78 phase 3 applied: the fence is down, and the migration can no longer reach a new medication')
