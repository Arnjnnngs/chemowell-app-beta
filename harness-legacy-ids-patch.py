#!/usr/bin/env python3
"""app-v76 -> app-v77: HARDCODED_MEDS_PLAN.md PHASE 2 — the thirteen ids stop driving behaviour.

AARON, 2026-09-13: "Start stage 2."

WHAT PHASE 2 DOES. Phase 1 made the behaviours expressible as data and left every hardcoded branch in
place as a fallback. Phase 2 deletes the fallbacks. After this, nothing in the app asks "is this
medication Zofran?" -- the medication carries its own rules and the app reads them.

WHERE THE RULES GO INSTEAD, AND WHY THIS IS SAFE FOR ANYONE WHO ALREADY HAS THEM.
`LEGACY_MED_RULES` below is a MIGRATION TABLE, not logic. It is the last place in this file where
those thirteen names appear, and it runs ONCE: `loadMedicationConfig` applies it when the stored
config is older than version 2, and the next save stamps version 2. From then on the id means
nothing and the properties mean everything.

THE MIGRATION MUST BE ONE-SHOT, AND THIS IS THE WHOLE REASON FOR THE VERSION STAMP. Phase 3 deletes
RESERVED_LEGACY_MED_IDS so a customer can finally name their medication Zofran and get the id
`zofran`. If the migration keyed off the id alone it would then hand that customer another patient's
three-day post-chemo block -- the exact defect this whole plan exists to remove, reintroduced by its
own migration. Gating on the stored version means the rules only ever reach data that predates them.

WHY ANY MIGRATION AT ALL, when DEFAULT_MEDS is empty and the fence has blocked those ids for
months: a backup restore and a sync can both bring in a medication whose id was minted before the
fence existed. Deleting the branches without migrating would silently drop that person's regimen.

WHAT IT APPENDS: nothing to any entry. It writes medication CONFIG properties for pre-existing
legacy medications, once, and bumps the config's version stamp.
WHAT IT DELETES: no record, no entry, no user data. Six functions and thirteen hardcoded branches.
"""
import sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent
HTML = ROOT / 'index.html'
SW = ROOT / 'sw.js'

def die(msg):
    print('PATCH FAILED: ' + msg); sys.exit(1)

src = HTML.read_text(encoding='utf-8')
if 'LEGACY_MED_RULES' in src:
    die('already applied')

# Validate EVERY anchor before writing anything. The phase 1 patch nearly deleted 180 lines from a
# prefix anchor matched with str.index; every anchor here is a full exact string, count-checked.
def cut(old, new, what):
    global src
    if src.count(old) != 1:
        die(what + ' is not where it was (found ' + str(src.count(old)) + ') -- nothing written')
    src = src.replace(old, new, 1)

# ---- 1. the migration table ---------------------------------------------------------------------
MIGRATION = '''
// ---- app-v77 PHASE 2: THE LAST PLACE THESE THIRTEEN NAMES APPEAR --------------------------------
// A MIGRATION TABLE, NOT LOGIC. Every behaviour below used to be an `if (med.id === '...')` branch
// somewhere in this file, applying one specific patient's regimen to anyone whose medication happened
// to carry that id. They are now properties the medication owns, and this table exists only to move
// the rules onto medications that already had the ids before the properties existed -- a restored
// backup, a sync from an older build. It runs ONCE per device.
//
// IT IS GATED ON THE STORED CONFIG VERSION, AND THAT IS THE POINT. Phase 3 deletes
// RESERVED_LEGACY_MED_IDS so a customer can name their medication Zofran and get the id `zofran`.
// If this keyed off the id alone, that customer would inherit another patient's three-day post-chemo
// block -- the exact defect this plan exists to remove, reintroduced by its own migration.
const MED_CONFIG_VERSION = 2;
const LEGACY_MED_RULES = {
  // 8am-12pm and 2pm-6pm on the day before and the day of treatment; mornings only the day after.
  // Was: `med.id === 'dexamethasone' ? dexWindowsForOffset(chemoOffsetFor(d0)) : med.windows`.
  // READ THE OLD LINE BEFORE BELIEVING THE OBVIOUS MIGRATION:
  //   dexWindowsForOffset(offset) => offset === 1 ? [8-12] : [8-12, 14-18]
  // That is EVERY DAY gets both windows -- including days nowhere near a treatment date, and
  // including a device with no treatment date at all -- except the day AFTER treatment, which gets
  // mornings only. Whether the medication applies on a given day is a separate question that
  // treatmentMode/treatmentOnly already answers generically.
  // The first version of this table wrote windows for offsets -1, 0 and +1 and nothing else, which
  // read like a sensible steroid taper and was wrong on 697 of 841 simulated hours. The two-release
  // comparison caught it; nothing else would have.
  'dexamethasone': {
    windows: [{ start: 8, end: 12, name: 'Morning' }, { start: 14, end: 18, name: 'Afternoon' }],
    chemoRelativeWindows: [{ dayOffset: 1, start: 8, end: 12, name: 'Morning' }]
  },
  // Not loggable on the treatment day or the two days after. Was: zofranBlockedOn/zofranBlockingDay.
  'zofran': { chemoBlock: { fromDayOffset: 0, toDayOffset: 2 } },
  // Was: the `entry.medId === 'iron' || entry.medId === 'protonix'` branch in afterLog, with its
  // copy inline. Declared on both sides, because either one being logged should raise it.
  'iron': { interactions: [{ withMedId: 'protonix', minGapH: 2, title: 'Iron + Protonix timing',
    body: 'Iron and Protonix were logged within 2 hours of each other. A PPI lowers stomach acid, which can markedly reduce iron absorption. Check with the care team about spacing them further apart.' }] },
  'protonix': { interactions: [{ withMedId: 'iron', minGapH: 2, title: 'Iron + Protonix timing',
    body: 'Iron and Protonix were logged within 2 hours of each other. A PPI lowers stomach acid, which can markedly reduce iron absorption. Check with the care team about spacing them further apart.' }] },
  // Which daily-total card this medication gets on Home, and which unit its history summary counts.
  // Was: tylenolMg(), dailyPills('imodium'), and `e.medId === 'tylenol'` inside the report builder.
  'tylenol': { homeCard: { kind: 'mg' } },
  'tylenol-liquid': { homeCard: { kind: 'ml' } },
  'imodium': { homeCard: { kind: 'pills' } }
};
// Applied ONCE, from loadMedicationConfig, and only to a config older than MED_CONFIG_VERSION.
// A property the medication already carries is never overwritten: if someone has configured their
// own rule, theirs wins over a table entry that only exists for historical reasons.
function migrateLegacyMedRules(med) {
  const rules = med && Object.prototype.hasOwnProperty.call(LEGACY_MED_RULES, med.id)
    ? LEGACY_MED_RULES[med.id] : null;
  if (!rules) return med;
  const next = { ...med };
  for (const key of Object.keys(rules)) {
    // `windows` is the one key a legacy medication always already has, and for dexamethasone the old
    // code IGNORED it entirely -- dexWindowsForOffset never looked at med.windows. So leaving the
    // stored value in place would change behaviour for the one medication this entry exists for.
    // Every other key is only written when absent, so a rule the user configured themselves wins.
    const replace = (key === 'windows');
    if (replace || next[key] === undefined) next[key] = JSON.parse(JSON.stringify(rules[key]));
  }
  return next;
}
'''
cut("function normalizeMedication(raw, index) {", MIGRATION.strip() + "\n" + "function normalizeMedication(raw, index) {",
    'normalizeMedication')

# ---- 2. run it from the loader, gated on the stored version --------------------------------------
cut("""    const meds = mergeMissingDefaultMeds(saved.meds.map(backfillDefaultMedFlags).map(normalizeMedication).map(migrateSenokotV37), archivedMeds);
    return { meds, archivedMeds };""",
    """    // app-v77 phase 2: move the legacy ids' behaviour onto properties, ONCE. `saved.version` is
    // stamped by persistMedicationConfig; anything written before this release is 1 or absent.
    // After the next save the ids carry no meaning at all.
    const needsLegacyMigration = !(Number(saved.version) >= MED_CONFIG_VERSION);
    const migrated = needsLegacyMigration ? saved.meds.map(migrateLegacyMedRules) : saved.meds;
    const meds = mergeMissingDefaultMeds(migrated.map(backfillDefaultMedFlags).map(normalizeMedication).map(migrateSenokotV37), archivedMeds);
    // Persist immediately so the migration is genuinely one-shot. Without this it would re-run on
    // every load, which is harmless today and becomes the phase 3 defect the moment a customer is
    // allowed to name their medication Zofran.
    if (needsLegacyMigration) persistMedicationConfig(meds, archivedMeds);
    return { meds, archivedMeds };""",
    'the medication config load chain')

cut("""    localStorage.setItem(MED_CONFIG_STORAGE_KEY, JSON.stringify({ version: 1, meds, archivedMeds }));""",
    """    localStorage.setItem(MED_CONFIG_STORAGE_KEY, JSON.stringify({ version: MED_CONFIG_VERSION, meds, archivedMeds }));""",
    'the medication config save')

# ---- 3. delete the resolver fallbacks ------------------------------------------------------------
cut("""  if (med && med.id === 'dexamethasone') return dexWindowsForOffset(chemoOffsetFor(d0));
""", "", "medWindowsFor's dexamethasone fallback")

# chemoRelativeWindows OVERRIDES named offsets; every other day keeps the medication's own windows.
# PHASE 1 HAD THIS THE OTHER WAY -- a match replaced the windows and no match meant NO windows -- and
# the phase 1 audit endorsed it, reasoning that "these windows depend on the treatment date" must not
# silently become an everyday schedule. Sound reasoning about a hypothetical; the real regimen
# contradicts it. The only medication in the app with this behaviour has both windows EVERY day and a
# narrower one the day after treatment. Whether a medication applies near treatment at all is what
# treatmentMode/treatmentOnly already decides, generically, and that separation is the right one:
# this property shapes the windows, that one gates them.
cut("""    const offset = chemoOffsetFor(d0);
    // No treatment date, or today is not one of the offsets this medication names: it has no window
    // today. Falling back to med.windows here would silently give it an everyday schedule, which is
    // the opposite of what "these windows depend on the treatment date" means.
    if (offset === null) return [];
    return med.chemoRelativeWindows
      .filter(w => w.dayOffset === offset)
      .map(w => ({ start: w.start, end: w.end, name: w.name }))
      .sort((a, b) => a.start - b.start);""",
    """    const offset = chemoOffsetFor(d0);
    const override = offset === null ? [] : med.chemoRelativeWindows
      .filter(w => w.dayOffset === offset)
      .map(w => ({ start: w.start, end: w.end, name: w.name }))
      .sort((a, b) => a.start - b.start);
    // An OVERRIDE for the offsets this medication names. Every other day -- and a device with no
    // treatment date on record -- falls through to its ordinary windows.
    if (override.length) return override;""",
    "medWindowsFor's chemo-relative branch")
cut("""  if (med && med.id === 'zofran') return zofranBlockedOn(dayTs);
""", "", "medChemoBlockedOn's zofran fallback")
cut("""  if (med && med.id === 'zofran') return zofranBlockingDay(dayTs);
""", "", "medChemoBlockingDay's zofran fallback")
cut("""  if (med && med.id === 'zofran') return 3;
""", "", "medChemoBlockSpanDays' zofran fallback")

# ---- 3b. the treatment-day chips: driven by properties, labelled with the medication's own name ---
# These are USER-FACING and they named one patient's prescription in the product's own copy:
#   "Dexamethasone Due — 8 AM & 2 PM"   and   "Zofran — Restricted"
# Hardcoded text, hardcoded times, hardcoded drugs, on a screen a stranger opens. They now come from
# whichever medications actually carry chemoRelativeWindows and chemoBlock, and they say that
# medication's own name and its own window times.
cut("""    const dexDueToday = dexActiveOn(now) && state.meds.some(m => m.id === 'dexamethasone');
    const zofranRestrictedToday = zofranBlockedOn(now) && state.meds.some(m => m.id === 'zofran');""",
    """    // Whichever medications the CAREGIVER has given a treatment-relative rule -- not a list of
    // drug names written into the app. A medication with no such rule produces no chip.
    const chemoWindowMeds = state.meds.filter(m => !m.paused && Array.isArray(m.chemoRelativeWindows)
      && medWindowsFor(m, now).length);
    const chemoBlockedMeds = state.meds.filter(m => !m.paused && m.chemoBlock && medChemoBlockedOn(m, now));""",
    'the treatment-day chip conditions')

cut("""      (dexDueToday || zofranRestrictedToday) ? h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '8px' } },""",
    """      (chemoWindowMeds.length || chemoBlockedMeds.length) ? h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '8px' } },""",
    'the chip row condition')

# Each chip is now one per qualifying medication, named for itself and stating its real times.
_dex_start = src.index("        dexDueToday ? h('div', { style: { display: 'inline-flex'")
_zof_marker = "        ) : null\n      ) : null"
_zof_end = src.index(_zof_marker, _dex_start) + len("        ) : null\n")
CHIPS = """        ...chemoWindowMeds.map(m => h('div', { style: { display: 'inline-flex', alignItems: 'center', gap: '7px', background: 'rgba(15,157,87,0.10)', border: '1px solid rgba(15,157,87,0.25)', borderRadius: '11px', padding: '6px 11px' } },
          h('span', { style: { flexShrink: '0', width: '18px', height: '18px', borderRadius: '50%', background: 'rgba(15,157,87,0.15)', color: '#0C7F57', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '800' } }, '\\u2713'),
          // The medication's OWN name and its OWN window times. "Dexamethasone Due - 8 AM & 2 PM"
          // was three hardcoded facts about one patient in a product every user shares.
          h('span', { style: { fontSize: '13px', fontWeight: '700', color: '#0C7F57', letterSpacing: '0.01em' } },
            m.name + ' due \\u2014 ' + medWindowsFor(m, now).map(w => formatHour(w.start)).join(' & '))
        )),
        ...chemoBlockedMeds.map(m => h('div', { style: { display: 'inline-flex', alignItems: 'center', gap: '7px', background: 'rgba(192,69,59,0.10)', border: '1px solid rgba(192,69,59,0.25)', borderRadius: '11px', padding: '6px 11px' } },
          h('span', { style: { flexShrink: '0', width: '18px', height: '18px', borderRadius: '50%', background: 'rgba(192,69,59,0.15)', color: '#A5443C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '800' } }, '!'),
          h('span', { style: { fontSize: '13px', fontWeight: '700', color: '#A5443C', letterSpacing: '0.01em' } }, m.name + ' \\u2014 restricted')
        ))
"""
src = src[:_dex_start] + CHIPS + src[_zof_end:]

# the two stale comments naming functions this release deletes
src = src.replace("    // 3-day block (chemo day + 2 following days, see zofranBlockedOn) -- opens on day+3 at 8am.",
                  "    // The medication's own chemoBlock span (see LEGACY_MED_RULES for where the three-day rule\n    // came from) -- reopens the morning after the span ends.")
src = src.replace("// dexWindowsForOffset never returns []. medWindowsFor CAN return [] -- a medication with",
                  "// a scheduled medication always had at least one. medWindowsFor CAN return [] -- a medication with")

# ---- 4. delete the helpers that existed only to serve those ids ---------------------------------
# Nothing calls them now. Leaving a function named zofranBlockedOn in a shared product is the debt
# this whole plan is about, even when it is dead.
import re as _re
for _name in ['dexWindowsForOffset', 'zofranBlockedOn', 'zofranBlockingDay']:
    # COUNT CODE, NOT PROSE. An earlier version counted every textual occurrence and refused to
    # delete a function because the comments explaining WHY it was being deleted named it.
    _code = _re.sub(r'(?m)^\s*//.*$', '', src)
    _code = _re.sub(r'/\*[\s\S]*?\*/', '', _code)
    _refs = len(_re.findall(r'\b' + _name + r'\b', _code))
    if _refs != 1:
        die(_name + ' is still called from ' + str(_refs - 1) + ' place(s) in CODE; refusing to delete it')
    # CUT THE WHOLE FUNCTION. The first version used an alternation whose one-line branch matched
    # first, so it deleted `function zofranBlockingDay(dayTs) {` and LEFT THE BODY -- an orphaned
    # block that broke the file's syntax. A one-liner ends on its own line; a multi-line function
    # ends at the next `}` in column 1. Find the opening, then walk to whichever comes first, and
    # ASSERT the text removed both starts and ends like a function before writing anything.
    _sig = '\nfunction ' + _name + '('
    if src.count(_sig) != 1:
        die('could not locate ' + _name + ' exactly once -- nothing written')
    _i = src.index(_sig) + 1
    _line_end = src.index('\n', _i)
    if src[_i:_line_end].rstrip().endswith('}'):
        _j = _line_end + 1                      # a one-liner
    else:
        _close = src.index('\n}\n', _i)
        _j = _close + len('\n}\n')
    _removed = src[_i:_j]
    if not _removed.startswith('function ' + _name + '(') or not _removed.rstrip().endswith('}'):
        die('refusing to delete a fragment of ' + _name + ': ' + repr(_removed[:60]) + ' ... ' + repr(_removed[-20:]))
    src = src[:_i] + src[_j:]

HTML.write_text(src, encoding='utf-8')
print('app-v77 phase 2 step 1: migration table in, four resolver fallbacks out')
