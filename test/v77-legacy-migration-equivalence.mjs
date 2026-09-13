// v77-legacy-migration-equivalence.mjs -- phase 2's proof, and it is a stronger one than phase 1's.
//
// Phase 1 proved that a resolver reading a PROPERTY falls back to the legacy branch correctly, by
// comparing two functions inside the same file. Phase 2 DELETES those branches, so that comparison
// no longer exists. What has to be proved now is different and bigger:
//
//   a medication that carried a legacy id, after migration, behaves exactly as it did before.
//
// So this loads BOTH FILES -- the shipped app-v76 as it was, and the current one -- runs the same
// medication through each, and requires identical answers across a full treatment cycle, hour by
// hour. Not two functions agreeing inside one file; two releases agreeing about one patient's
// regimen.
//
// WHY THAT MATTERS MORE THAN IT SOUNDS. Someone restoring a backup, or syncing from an older build,
// can still bring in a medication whose id was minted before the fence existed. If the migration is
// wrong, their dexamethasone windows or their Zofran block silently change -- and this app's worst
// failure mode is not a crash, it is a dose that was never prompted for.
//
// Run:  node test/v77-legacy-migration-equivalence.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));

let pass = 0, fail = 0;
const t = (name, cond, detail) => {
  console.log('  ' + (cond ? 'PASS  ' : 'FAIL  ') + name + (detail ? '  |  ' + detail : ''));
  cond ? pass++ : fail++;
};

const DAY = 86400000;
const T0 = new Date('2026-03-02T12:00:00').getTime();
const CHEMO = [T0, T0 + 21 * DAY];

function worldFrom(htmlPath, label) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const grab = (re, what) => {
    const m = html.match(re);
    if (!m) throw new Error(label + ': could not find ' + what);
    return m[0];
  };
  const optional = (re) => { const m = html.match(re); return m ? m[0] : ''; };
  const parts = [
    grab(/function dayStart\([\s\S]*?\n\}/, 'dayStart'),
    grab(/function chemoOffsetFor\([\s\S]*?\n\}/, 'chemoOffsetFor'),
    grab(/function safeMedicationId\([\s\S]*?\n\}/, 'safeMedicationId'),
    // present in app-v76, gone in app-v77 -- that is the point of the release
    optional(/function dexWindowsForOffset\([^\n]*\n?/),
    optional(/function zofranBlockedOn\([\s\S]*?\n\}/),
    optional(/function zofranBlockingDay\([\s\S]*?\n\}/),
    grab(/function medWindowsFor\(med, dayTs\) \{[\s\S]*?\n\}/, 'medWindowsFor'),
    grab(/function medChemoBlockedOn\(med, dayTs\) \{[\s\S]*?\n\}/, 'medChemoBlockedOn'),
    grab(/function medChemoBlockingDay\(med, dayTs\) \{[\s\S]*?\n\}/, 'medChemoBlockingDay'),
    grab(/function medChemoBlockSpanDays\(med\) \{[\s\S]*?\n\}/, 'medChemoBlockSpanDays'),
    // app-v78 added a per-medication stamp gate inside migrateLegacyMedRules, which reads
    // MED_CONFIG_VERSION. Lifting the function without its constant threw a bare ReferenceError --
    // the same class that broke the two v67 harnesses when phase 1 added a helper. Keep this list in
    // step with what the lifted functions actually reference.
    optional(/const MED_CONFIG_VERSION = \d+;/),
    optional(/const LEGACY_MED_RULES = \{[\s\S]*?\n\};/),
    optional(/function migrateLegacyMedRules\([\s\S]*?\n\}/)
  ].filter(Boolean);
  const prelude = `
    const CHEMO_DAYS = ${JSON.stringify(CHEMO)};
    function chemoDayList() { return CHEMO_DAYS.map(d => dayStart(d)); }
    function eveningWindowsFor(med, d0) { return med.windows || []; }
    function morningWindowsFor(med, d0) { return med.windows || []; }
    const state = { meds: [], entries: [] };
  `;
  return new Function(prelude + '\n' + parts.join('\n') +
    '\nreturn { medWindowsFor, medChemoBlockedOn, medChemoBlockingDay, medChemoBlockSpanDays,' +
    ' migrate: (typeof migrateLegacyMedRules === "function") ? migrateLegacyMedRules : (m => m) };')();
}

const BASE = path.join(HERE, 'fixtures', 'app-v76-base.html');
const NOW_FILE = path.join(HERE, '..', 'index.html');

console.log('\n1. BOTH RELEASES LOAD, AND THEY ARE GENUINELY DIFFERENT FILES');
{
  t('the app-v76 fixture is committed', fs.existsSync(BASE), BASE);
  const before = fs.readFileSync(BASE, 'utf8');
  const after = fs.readFileSync(NOW_FILE, 'utf8');
  // If these were the same file the comparison below would be vacuous -- it would prove only that a
  // function agrees with itself. Phase 1's suite had a stub with exactly that shape.
  t('and it is not the current file', before !== after, 'sizes ' + before.length + ' vs ' + after.length);
  t('the legacy helpers are GONE from the current file',
    !/function zofranBlockedOn\(/.test(after) && !/function dexWindowsForOffset\(/.test(after), '');
  t('and they were present in app-v76',
    /function zofranBlockedOn\(/.test(before) && /function dexWindowsForOffset\(/.test(before), '');
  t('the migration table exists only in the current file',
    !/LEGACY_MED_RULES/.test(before) && /LEGACY_MED_RULES/.test(after), '');
}

const OLD = worldFrom(BASE, 'app-v76');
const NEW = worldFrom(NOW_FILE, 'current');

console.log('\n2. A LEGACY MEDICATION BEHAVES IDENTICALLY, EVERY HOUR OF A FULL CYCLE');
{
  // Stored exactly as a restored backup or an older sync would deliver it: a bare id, no properties.
  const cases = [
    ['dexamethasone', { id: 'dexamethasone', type: 'win', windows: [{ start: 8, end: 12, name: 'Morning' }] }],
    ['zofran', { id: 'zofran', type: 'gap', windows: [] }],
    ['an unrelated medication', { id: 'something-else', type: 'win', windows: [{ start: 9, end: 11, name: 'Morning' }] }]
  ];
  for (const [label, stored] of cases) {
    let winDiff = 0, blockDiff = 0, dayDiff = 0, hours = 0;
    const migrated = NEW.migrate(stored);
    for (let ts = T0 - 7 * DAY; ts <= T0 + 28 * DAY; ts += 3600000) {
      hours++;
      const a = OLD.medWindowsFor(stored, ts), b = NEW.medWindowsFor(migrated, ts);
      if (JSON.stringify(a) !== JSON.stringify(b)) winDiff++;
      if (OLD.medChemoBlockedOn(stored, ts) !== NEW.medChemoBlockedOn(migrated, ts)) blockDiff++;
      if (OLD.medChemoBlockingDay(stored, ts) !== NEW.medChemoBlockingDay(migrated, ts)) dayDiff++;
    }
    t(label + ': windows identical across ' + hours + ' hours', winDiff === 0, winDiff + ' differ');
    t(label + ': treatment-date block identical', blockDiff === 0, blockDiff + ' differ');
    t(label + ': which day blocks, identical', dayDiff === 0, dayDiff + ' differ');
    t(label + ': and the block span is unchanged',
      OLD.medChemoBlockSpanDays(stored) === NEW.medChemoBlockSpanDays(migrated),
      OLD.medChemoBlockSpanDays(stored) + ' vs ' + NEW.medChemoBlockSpanDays(migrated));
  }
}

console.log('\n3. FALSIFIED: A WRONG MIGRATION MUST SHOW UP');
{
  // If the comparison could not detect a bad table, it would prove nothing. Hand the new world a
  // medication migrated with the WRONG rule and require the hours to disagree.
  const stored = { id: 'zofran', type: 'gap', windows: [] };
  const wrong = { ...stored, chemoBlock: { fromDayOffset: 0, toDayOffset: 0 } };
  let differ = 0;
  for (let ts = T0; ts <= T0 + 5 * DAY; ts += 3600000) {
    if (OLD.medChemoBlockedOn(stored, ts) !== NEW.medChemoBlockedOn(wrong, ts)) differ++;
  }
  t('a block one day short is detected', differ > 0, differ + ' hours differ, as they must');

  const dexWrong = { id: 'dexamethasone', type: 'win', chemoRelativeWindows: [{ dayOffset: 0, start: 8, end: 12, name: 'Morning' }] };
  let wDiffer = 0;
  for (let ts = T0 - 2 * DAY; ts <= T0 + 2 * DAY; ts += 3600000) {
    if (JSON.stringify(OLD.medWindowsFor({ id: 'dexamethasone', type: 'win' }, ts))
      !== JSON.stringify(NEW.medWindowsFor(dexWrong, ts))) wDiffer++;
  }
  t('a windows table missing its afternoon and its day-before is detected', wDiffer > 0,
    wDiffer + ' hours differ, as they must');
}

console.log('\n4. THE MIGRATION IS ONE-SHOT AND NEVER OVERWRITES A REAL CHOICE');
{
  // THE PHASE 3 TRAP. Once the fence is gone a customer can name their medication Zofran and get the
  // id `zofran`. If the migration keyed off the id alone they would inherit another patient's
  // three-day block -- this plan's own defect, reintroduced by its own migration. The gate is the
  // stored config version; what is checked here is the other half: a medication that already carries
  // the property keeps its own.
  const mine = { id: 'zofran', chemoBlock: { fromDayOffset: 0, toDayOffset: 0 } };
  const after = NEW.migrate(mine);
  t('a property the medication already carries is not overwritten',
    after.chemoBlock.toDayOffset === 0, JSON.stringify(after.chemoBlock));
  const bare = NEW.migrate({ id: 'zofran' });
  t('and a bare legacy medication does get the rule', bare.chemoBlock.toDayOffset === 2,
    JSON.stringify(bare.chemoBlock));
  // Deep-copied, or every migrated medication would share one object and editing one would edit all.
  const a = NEW.migrate({ id: 'dexamethasone' }), b = NEW.migrate({ id: 'dexamethasone' });
  a.chemoRelativeWindows[0].start = 99;
  t('each migrated medication gets its OWN copy of the rule',
    b.chemoRelativeWindows[0].start !== 99, 'b start = ' + b.chemoRelativeWindows[0].start);
  t('an unknown id is returned untouched', NEW.migrate({ id: 'whatever' }).chemoBlock === undefined, '');
  for (const hostile of [null, undefined, {}, { id: 'constructor' }, { id: '__proto__' }, { id: 'toString' }]) {
    let threw = null;
    try { NEW.migrate(hostile); } catch (e) { threw = String(e && e.message || e); }
    t('survives ' + JSON.stringify(hostile), threw === null, threw || '');
  }
}

console.log('\n5. THE app-v78 STAMP: A CUSTOMER\'S OWN MEDICATION IS NEVER MIGRATED');
{
  // The fence is gone, so `zofran` is an id a customer can now hold. The config-version gate is a
  // property of the FILE and a file can be replaced -- restoring a pre-phase-2 backup runs the
  // migration again. The stamp is a property of the MEDICATION and is what actually protects them.
  const theirs = { id: 'zofran', name: 'Zofran', schemaV: 2 };
  const out = NEW.migrate(theirs);
  t('a stamped medication comes back untouched', out.chemoBlock === undefined, JSON.stringify(out));
  // And the other direction, which matters just as much: too eager a gate means someone restoring a
  // genuinely old backup silently loses their regimen.
  const old = NEW.migrate({ id: 'zofran', name: 'Zofran' });
  t('an unstamped one is still migrated', !!old.chemoBlock && old.chemoBlock.toDayOffset === 2,
    JSON.stringify(old.chemoBlock));
  t('a stamp below the current version does not count',
    !!NEW.migrate({ id: 'zofran', schemaV: 1 }).chemoBlock, '');
  t('and neither does a junk stamp',
    !!NEW.migrate({ id: 'zofran', schemaV: 'yes' }).chemoBlock, '');
}

console.log('\n' + pass + '/' + (pass + fail) + ' checks passed' + (fail ? '  <-- FAIL' : ''));
process.exit(fail ? 1 : 0);
