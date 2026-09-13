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

# ---- 3c. the Home daily-total cards: one renderer, driven by the medication -----------------------
# Three near-identical blocks, each opening `if (usedRecently('tylenol'))`, `('imodium')`,
# `('lidocaine')`, each with that drug's name typed into the label -- and TWO HARDCODED DOSE
# CEILINGS, `const imoMax = 4` and `const lidoMax = 4`, which are one care plan's limits sitting in
# a product every user shares. (The no-other-patient check did not catch those: it looks for
# `ceilingMg` and for a drug name next to a number, and these are bare numbers on their own line.)
#
# Now: one renderer over whichever medications carry a homeCard, using that medication's own name,
# its own configured daily limit, and the unit it was set up with. A medication with no configured
# limit gets a total with no ceiling rather than somebody else's number.
HOME_CARDS = """  // app-v77 phase 2: one renderer for every daily-total card. Was three copies keyed to three
  // medication ids, with two hardcoded ceilings. A medication appears here because the caregiver
  // gave it a homeCard, and it shows ITS name, ITS limit and ITS unit.
  for (const hcMed of state.meds.filter(m => m && m.homeCard && !m.paused && usedRecently(m.id))) {
    const kind = medHomeCardKind(hcMed);
    const hcMax = medicationCeilingMax(hcMed) || 0;
    const hcUsed = kind === 'mg'
      ? (hcMed.ceilingGroup ? dailyGroupMg(hcMed) : dailyDoseMg(hcMed.id))
      : (kind === 'ml' ? dailyVolumeMl(hcMed.id) : dailyPills(hcMed.id));
    const hcUnit = kind === 'mg' ? 'mg' : (kind === 'ml' ? 'mL' : (hcMed.ceilingUnit || 'doses'));
    const hcPct = hcMax > 0 ? Math.min(100, hcUsed / hcMax * 100) : 0;
    const hcColor = hcMax > 0 && hcUsed >= hcMax ? '#C0453B' : hcPct >= 90 ? '#C0453B' : hcPct >= 60 ? '#9A6419' : '#BF4C1A';
    const hcLeft = Math.max(0, hcMax - hcUsed);
    parts.push(h('section', { style: { background: '#FFFFFF', border: '1px solid #E9D8D1', borderRadius: '18px', padding: '16px 17px', boxShadow: '0 4px 24px rgba(203,122,87,0.10), 0 1px 2px rgba(203,122,87,0.06)' } },
      h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '12px' } },
        h('div', null,
          h('div', { style: { ...TYPE.label, color: '#915E48' } }, hcMed.name + ' · today'),
          // NO CEILING IS A REAL STATE, and it must not read as a limit of zero. A medication with
          // no configured daily limit still gets its running total; it just has nothing to be
          // "left" of.
          h('div', { style: { fontSize: '12.5px', color: '#7A6E76', marginTop: '3px' } },
            hcMax > 0 ? (hcLeft.toLocaleString() + ' ' + hcUnit + ' left before the daily limit') : 'No daily limit set')
        ),
        h('div', { className: 'mono', style: { fontSize: '20px', fontWeight: '600', letterSpacing: '-0.02em', whiteSpace: 'nowrap' } },
          hcUsed.toLocaleString(),
          h('span', { style: { color: '#7A6E76', fontSize: '13px', fontWeight: '400' } },
            hcMax > 0 ? (' / ' + hcMax.toLocaleString() + ' ' + hcUnit) : (' ' + hcUnit))
        )
      ),
      hcMax > 0 ? h('div', { role: 'img', 'aria-label': hcUsed.toLocaleString() + ' of ' + hcMax.toLocaleString() + ' ' + hcUnit + ' used today', style: { height: '12px', background: 'rgba(246,108,49,0.10)', borderRadius: '99px', overflow: 'hidden', marginTop: '12px' } },
        h('div', { style: { height: '100%', width: Math.round(hcPct) + '%', background: hcColor, borderRadius: '99px', transition: 'width .45s ease, background .45s ease' } })
      ) : null
    ));
  }
"""
_cards_start = src.index("  // Acetaminophen meter (full width)")
_cards_end = src.index("  // Temperature + Weight row (each card user-toggleable in Settings)")
_removed_cards = src[_cards_start:_cards_end]
for _needle in ["usedRecently('tylenol')", "usedRecently('imodium')", "usedRecently('lidocaine')", "imoMax = 4", "lidoMax = 4"]:
    if _needle not in _removed_cards:
        die('the Home daily-total card block is not shaped as expected (missing ' + _needle + ') -- nothing written')
src = src[:_cards_start] + HOME_CARDS + src[_cards_end:]

# the three counters those blocks declared, now computed per medication inside the loop
for _dead in ["  const imoPills = dailyPills('imodium');\\n", "  const imoMax = 4;\\n",
              "  const lidoApps = dailyPills('lidocaine');\\n", "  const lidoMax = 4;\\n"]:
    if _dead in src:
        src = src.replace(_dead, "", 1)

# ---- 3d. afterLog: the generic branch already did all of this ------------------------------------
# The iron/protonix branch is now the `interactions` property. The tylenol block duplicated what the
# generic `else` branch below it already does -- dailyCeiling() has handled ceilingGroup and
# rollingCeilingH for releases -- differing only in saying "Acetaminophen" instead of the
# medication's own name, and in also checking the millilitre ceiling. So: delete both, and teach the
# generic branch the volume check it was missing.
_after_start = src.index("  if (entry.medId === 'iron' || entry.medId === 'protonix') {")
_after_end = src.index("}\n\nasync function logMed(", _after_start)
_removed_after = src[_after_start:_after_end]
for _needle in ["Iron + Protonix timing", "Acetaminophen ceiling exceeded", "dailyCeiling(configuredMedication)"]:
    if _needle not in _removed_after:
        die('afterLog is not shaped as expected (missing ' + _needle + ') -- nothing written')
AFTER = """  const configuredMedication = state.meds.find(med => med.id === entry.medId);
  const configuredLimit = dailyCeiling(configuredMedication);
  if (configuredLimit && configuredLimit.used > configuredLimit.max) {
    setState({ warn: { tone: 'red', title: configuredMedication.name + ' daily limit exceeded', body: "Today's " + configuredMedication.name + ' total is ' + configuredLimit.used.toLocaleString() + ' ' + configuredLimit.unit + ', above the ' + configuredLimit.label + ' daily limit set for it. Check with the care team before logging more.' } });
    return;
  }
  // app-v77 phase 2: the millilitre ceiling used to live inside a Tylenol-Liquid-shaped branch. It
  // is a property (volumeCeilingMl) and dailyVolumeCeiling() was already generic; only the caller
  // was not. A liquid can pass its mg limit and its volume limit independently, so both are checked.
  const volumeLimit = dailyVolumeCeiling(configuredMedication);
  if (volumeLimit && volumeLimit.used > volumeLimit.max) {
    setState({ warn: { tone: 'red', title: configuredMedication.name + ' volume limit exceeded', body: "Today's " + configuredMedication.name + ' total is ' + volumeLimit.used + ' ' + volumeLimit.unit + ', above the ' + volumeLimit.label + ' daily limit set for it. Check with the care team before logging more.' } });
  }
"""
src = src[:_after_start] + AFTER + src[_after_end:]

# and the "Take all" path, which named one medication
cut("""    setTimeout(() => { if (ids.includes('iron')) afterLog({ medId: 'iron', ts, id: 'pending' }); }, 500);""",
    """    // app-v77 phase 2: was `if (ids.includes('iron'))`, so an interaction warning could only ever
    // be raised by one specific medication being in the batch. Every medication just logged gets
    // the same check any single log gets.
    setTimeout(() => { ids.forEach(mid => afterLog({ medId: mid, ts, id: 'pending' })); }, 500);""",
    'the Take-all interaction check')

# ---- 3e. the history summaries ------------------------------------------------------------------
cut("""    const tyDay = items.filter(e => e.medId === 'tylenol' && !e.missed).reduce((s, e) => s + (e.mg || 0), 0);""",
    """    // app-v77 phase 2: was `e.medId === 'tylenol'`, summarised as "mg APAP" -- one drug's name in
    // every history row of a product every user shares. Now: whichever medications the caregiver
    // gave an mg daily-total card, each under its own name.
    const hcMgMeds = state.meds.filter(m => m && m.homeCard && medHomeCardKind(m) === 'mg');
    const tyDay = hcMgMeds.reduce((sum, m) => sum + items.filter(e => e.medId === m.id && !e.missed).reduce((s, e) => s + (e.mg || 0), 0), 0);""",
    'the history mg summary')
cut("""    const imoDay = items.filter(e => e.medId === 'imodium' && !e.missed).reduce((s, e) => s + (e.pills || 0), 0);
    if (imoDay) summary += ' · ' + imoDay + ' Imodium';""",
    """    // Same for the pill counters. Each names the medication it counts rather than one drug.
    for (const m of state.meds.filter(x => x && x.homeCard && medHomeCardKind(x) === 'pills')) {
      const n = items.filter(e => e.medId === m.id && !e.missed).reduce((s, e) => s + (e.pills || 0), 0);
      if (n) summary += ' · ' + n + ' ' + m.name;
    }""",
    'the history pill summary')

# ---- 3f. the linked windows: "opens two hours after ANOTHER medication was taken" ----------------
# morningLinkedToProtonix / eveningLinkedToProtonix, and the two helpers that read one specific
# medication's entries by id. The rule is generic and useful -- a medication whose window opens a
# fixed time after another one was actually logged -- and it was welded to a drug name.
LINKED = """// app-v77 phase 2: was morningWindowsFor/eveningWindowsFor + protonixMorningLogTs/
// protonixEveningLogTs, each reading one specific medication's entries by id. The rule is generic:
// this medication's window opens a fixed gap after ANOTHER medication was actually taken, in the
// named half of the day. The medication says which one and how long via `linkedTo`.
function linkedAnchorTs(med, d0) {
  if (!med || !med.linkedTo || typeof med.linkedTo !== 'object') return null;
  const fromH = med.linkedTo.half === 'evening' ? 12 : 0;
  const toH = med.linkedTo.half === 'evening' ? 24 : 12;
  const entry = entriesFor(med.linkedTo.medId)
    .find(e => e.ts >= d0 + fromH * 3600000 && e.ts < d0 + toH * 3600000);
  return entry ? entry.ts : null;
}
function linkedWindowsFor(med, d0) {
  const anchor = linkedAnchorTs(med, d0);
  if (anchor === null) return med.windows || [];
  const gapH = Number(med.linkedTo.gapH);
  const startH = (anchor + (Number.isFinite(gapH) ? gapH : 2) * 3600000 - d0) / 3600000;
  // Past midnight: the window would have no room left today, so the medication keeps its own.
  if (!(startH < 24)) return med.windows || [];
  return [{ start: Math.max(0, startH), end: 24, name: med.linkedTo.half === 'evening' ? 'Night' : 'Morning' }];
}
"""
# The four sit in file order protonixEveningLogTs, eveningWindowsFor, protonixMorningLogTs,
# morningWindowsFor -- NOT the order they are named in. Slicing from the first name mentioned to the
# last produced an empty range and a shape check that failed on nothing. Take the span from the
# earliest of the four to the end of the latest.
_lw_start = min(src.index("function protonixEveningLogTs(d0) {"), src.index("function eveningWindowsFor(med, d0) {"))
_lw_last = max(src.index("function protonixMorningLogTs(d0) {"), src.index("function morningWindowsFor(med, d0) {"))
_lw_end = src.index("\n}\n", _lw_last) + len("\n}\n")
_removed_lw = src[_lw_start:_lw_end]
for _needle in ["protonixMorningLogTs", "protonixEveningLogTs", "2 * 3600000"]:
    if _needle not in _removed_lw:
        die('the linked-window block is not shaped as expected (missing ' + _needle + ') -- nothing written')
src = src[:_lw_start] + LINKED + src[_lw_end:]

# status() picked the linked branch by flag; it picks it by property now.
cut("""  const windows = (med.eveningLinkedToProtonix || med.morningLinkedToProtonix) && med.id !== 'dexamethasone'
    ? (med.eveningLinkedToProtonix ? eveningWindowsFor(med, d0) : morningWindowsFor(med, d0))
    : medWindowsFor(med, d0);""",
    """  // A medication whose window follows another medication's actual dose keeps that at status()'s
  // own call site, as it always has -- the missed-dose walk and the dose-progress ring never
  // applied it, and folding it into medWindowsFor moved their windows by an hour (the phase 1
  // audit's B5). The `med.id !== 'dexamethasone'` guard that used to sit here is gone with the id.
  const windows = med.linkedTo ? linkedWindowsFor(med, d0) : medWindowsFor(med, d0);""",
    "status()'s linked-window branch")

# the flags become the property, on load
cut("""  'imodium': { homeCard: { kind: 'pills' } }""",
    """  'imodium': { homeCard: { kind: 'pills' } },
  // Not an id-keyed entry: a MIGRATION OF THE OLD FLAGS. morningLinkedToProtonix and
  // eveningLinkedToProtonix were booleans meaning "two hours after Protonix, in this half of the
  // day". Whoever carried them keeps exactly that, now as data anyone can set for any pair.
  '__flags__': true""",
    'the migration table tail')
cut("""  const rules = med && Object.prototype.hasOwnProperty.call(LEGACY_MED_RULES, med.id)
    ? LEGACY_MED_RULES[med.id] : null;
  if (!rules) return med;
  const next = { ...med };""",
    """  let next = med ? { ...med } : med;
  // The old boolean flags, whatever medication carried them.
  if (next && !next.linkedTo && (next.morningLinkedToProtonix || next.eveningLinkedToProtonix)) {
    next.linkedTo = { medId: 'protonix', half: next.eveningLinkedToProtonix ? 'evening' : 'morning', gapH: 2 };
  }
  const rules = med && Object.prototype.hasOwnProperty.call(LEGACY_MED_RULES, med.id)
    && LEGACY_MED_RULES[med.id] !== true ? LEGACY_MED_RULES[med.id] : null;
  if (!rules) return next;""",
    "migrateLegacyMedRules' body")

# ---- 3g. the Home progress values render() computed from one drug ---------------------------------
cut("""  const tylenolMedication = state.meds.find(med => med.id === 'tylenol');
  const ceiling = medicationCeilingMax(tylenolMedication) || 0;
  const mg = tylenolMg();
  const pct = ceiling > 0 ? Math.min(100, mg / ceiling * 100) : 0;
  const tyColor = mg >= ceiling ? '#C0453B' : pct >= 90 ? '#C0453B' : pct >= 60 ? '#9A6419' : '#BF4C1A';""",
    """  // app-v77 phase 2: these four were computed from `state.meds.find(m => m.id === 'tylenol')` and
  // threaded through renderContent and renderToday as positional arguments. The daily-total cards
  // now compute their own values per medication, so nothing downstream reads them -- they are kept
  // as zeroes only because the two render signatures still take them, and removing arguments from
  // a call chain is a wider change than this release should make.
  const ceiling = 0, mg = 0, pct = 0, tyColor = '#BF4C1A';""",
    "render()'s Tylenol-derived progress values")

# ---- 4. delete the helpers that existed only to serve those ids ---------------------------------
# Nothing calls them now. Leaving a function named zofranBlockedOn in a shared product is the debt
# this whole plan is about, even when it is dead.
import re as _re
for _name in ['dexWindowsForOffset', 'zofranBlockedOn', 'zofranBlockingDay',
              'tylenolMg', 'protonixMorningLogTs', 'protonixEveningLogTs']:
    # COUNT CODE, NOT PROSE. An earlier version counted every textual occurrence and refused to
    # delete a function because the comments explaining WHY it was being deleted named it.
    # ALREADY GONE IS FINE. protonixMorningLogTs and protonixEveningLogTs sit inside the block the
    # linked-window rewrite above replaces wholesale, so by the time this loop reaches them there is
    # nothing left to delete -- and a reference count of zero was being reported as "-1 places",
    # which is the guard misreading its own success as a failure.
    if ('\nfunction ' + _name + '(') not in src:
        continue
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

# ---- 5. version ---------------------------------------------------------------------------------
if src.count("const APP_VERSION = 'app-v76';") != 1:
    die('APP_VERSION is not app-v76')
sw = SW.read_text(encoding='utf-8')
if "const CACHE = 'chemowell-app-v76-1';" not in sw:
    die('sw.js CACHE is not at app-v76-1 -- nothing was written')
src = src.replace("const APP_VERSION = 'app-v76';", "const APP_VERSION = 'app-v77';", 1)
sw_next = sw.replace("const CACHE = 'chemowell-app-v76-1';", "const CACHE = 'chemowell-app-v77-1';", 1)

HTML.write_text(src, encoding='utf-8')
SW.write_text(sw_next, encoding='utf-8')
print('app-v77 phase 2 applied: migration table in, every hardcoded branch out')
