// v76-properties-equivalence.mjs -- HARDCODED_MEDS_PLAN.md phase 1 must change NOTHING.
//
// Phase 1 adds five medication properties and routes every hardcoded branch through a resolver that
// reads the property first and falls back to the legacy branch. On today's data every property is
// absent, so every answer must be byte-identical to app-v75's.
//
// WHY A SIMULATION AND NOT A SPOT CHECK. This is the scheduling engine of a medication app. A
// mistake here does not crash -- it shows up as a dose that was never prompted for, or a missed-dose
// alert that never fires, and this project has shipped exactly that (v43.3, where correcting a
// schedule type silently disabled missed-dose alerts). So the old path and the new path are both
// run, across a full treatment cycle, hour by hour, and required to agree EVERYWHERE.
//
// The functions are lifted out of index.html and run directly, so this tests what ships rather than
// a copy of it.
//
// Run:  node test/v76-properties-equivalence.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(HERE, '..', 'index.html'), 'utf8');

let pass = 0, fail = 0;
const t = (name, cond, detail) => {
  console.log('  ' + (cond ? 'PASS  ' : 'FAIL  ') + name + (detail ? '  |  ' + detail : ''));
  cond ? pass++ : fail++;
};

// ---- a tiny world the real functions can run inside ---------------------------------------------
const DAY = 86400000;
const grab = (re, what) => {
  const m = html.match(re);
  if (!m) throw new Error('could not find ' + what + ' in index.html');
  return m[0];
};
const SRC = [
  grab(/function dayStart\([\s\S]*?\n\}/, 'dayStart'),
  grab(/function chemoDayList\(\)[\s\S]*?\n\}/, 'chemoDayList'),
  grab(/function chemoOffsetFor\([\s\S]*?\n\}/, 'chemoOffsetFor'),
  grab(/function safeMedicationId\([\s\S]*?\n\}/, 'safeMedicationId'),
  grab(/function medWindowsFor\(med, dayTs\) \{[\s\S]*?\n\}/, 'medWindowsFor'),
  grab(/function medChemoBlockedOn\(med, dayTs\) \{[\s\S]*?\n\}/, 'medChemoBlockedOn'),
  grab(/function medChemoBlockingDay\(med, dayTs\) \{[\s\S]*?\n\}/, 'medChemoBlockingDay'),
  grab(/function medChemoBlockSpanDays\(med\) \{[\s\S]*?\n\}/, 'medChemoBlockSpanDays'),
  grab(/function linkedAnchorTs\([\s\S]*?\n\}/, 'linkedAnchorTs'),
  grab(/function linkedWindowsFor\([\s\S]*?\n\}/, 'linkedWindowsFor')
].join('\n');

// Two treatment dates three weeks apart, so offsets repeat and a block can span a boundary.
const T0 = new Date('2026-03-02T12:00:00').getTime();
const CHEMO = [T0, T0 + 21 * DAY];

// The dates are baked into each world, so a world with none of them is a SEPARATE world rather
// than something the test mutates afterwards. The first version cleared the outer array and
// expected the sandbox to notice -- it could not, because the dates are serialised into the prelude,
// and the check correctly reported that the fixture had not done what it claimed.
function world(dates) {
  const prelude = `
    const CHEMO_DAYS = ${JSON.stringify(dates || CHEMO)};
    function chemoDayList() { return CHEMO_DAYS.map(d => dayStart(d)); }
    // NOT STUBBED. The first version returned med.windows from both, which made a REAL behaviour
    // change structurally invisible: medWindowsFor briefly applied the Protonix-linked branches,
    // and two of the three call sites it replaced never had them, so the missed-dose walk's night
    // window moved from 22:00-24:00 to 21:00-24:00 on a fixture with an evening Protonix dose --
    // changing which doses count as MISSED. A stub that returns the same thing as the fallback
    // cannot tell the two apart, which is the one job it had.
    const state = { meds: [], entries: [] };
    function entriesFor(id) { return state.entries.filter(e => e.medId === id).sort((a, b) => a.ts - b.ts); }
  `;
  // chemoDayList and chemoOffsetFor come out of the file; chemoDayList is replaced by the stub above
  // so the simulation controls the dates. chemoOffsetFor is the real one.
  const body = SRC.replace(/function chemoDayList\(\)[\s\S]*?\n\}/, '');
  return new Function(prelude + '\n' + body +
    '\nreturn { dayStart, chemoOffsetFor,' +
    ' medWindowsFor, medChemoBlockedOn, medChemoBlockingDay, medChemoBlockSpanDays,' +
    ' linkedWindowsFor, state };')();
}
const W = world();
const NO_DATES = world([]);   // a device with no treatment date on record: every new user, and anyone who used Clear

console.log('\n1. THE RESOLVERS LOAD AND RUN OUT OF THE SHIPPED FILE');
t('every function this test needs was found in index.html', true, Object.keys(W).join(', '));

// SECTION 2 IS GONE, AND ON PURPOSE. It compared the resolver against dexWindowsForOffset and
// zofranBlockedOn -- the legacy branches -- and app-v77 phase 2 DELETED those functions. The
// comparison it made now happens between two real releases in v77-legacy-migration-equivalence.mjs,
// which loads the committed app-v76 file and the current one and requires them to agree about a
// migrated medication, hour by hour. That is strictly stronger than two functions agreeing inside
// one file, which is what this section was.

// SECTION 3 MOVED with section 2, for the same reason: its falsification compared against
// zofranBlockedOn. v77's suite carries a falsification of the same shape against the real app-v76.

console.log('\n4. THE PROPERTIES DO WHAT THEY SAY  (the behaviour phase 2 will migrate onto)');
{
  // Dexamethasone's real rule expressed as data: 8-12 and 14-18 on the treatment day and the day
  // before, 8-12 only on the day after.
  const declared = {
    id: 'some-steroid',
    chemoRelativeWindows: [
      { dayOffset: -1, start: 8, end: 12, name: 'Morning' },
      { dayOffset: -1, start: 14, end: 18, name: 'Afternoon' },
      { dayOffset: 0, start: 8, end: 12, name: 'Morning' },
      { dayOffset: 0, start: 14, end: 18, name: 'Afternoon' },
      { dayOffset: 1, start: 8, end: 12, name: 'Morning' }
    ],
    windows: [{ start: 6, end: 7, name: 'Never used' }]
  };
  const onDay = W.medWindowsFor(declared, T0);
  const dayAfter = W.medWindowsFor(declared, T0 + DAY);
  const farAway = W.medWindowsFor(declared, T0 + 10 * DAY);
  t('on the treatment day it gets both windows', onDay.length === 2, JSON.stringify(onDay));
  t('the day after it gets one', dayAfter.length === 1, JSON.stringify(dayAfter));
  // NOT med.windows. "These windows depend on the treatment date" must not quietly become an
  // everyday schedule on a day the medication does not name -- that would hand a steroid an
  // every-single-day window, which is the opposite of the rule.
  t('on an unrelated day it falls through to its plain windows (phase 2 semantic)',
    farAway.length === 1 && farAway[0].name === 'Never used', JSON.stringify(farAway));
  t('and the windows come back sorted by start time',
    onDay[0].start < onDay[1].start, JSON.stringify(onDay.map(w => w.start)));

  const blocked = { id: 'some-antiemetic', chemoBlock: { fromDayOffset: 0, toDayOffset: 2 } };
  t('a declared block covers the treatment day', W.medChemoBlockedOn(blocked, T0) === true, '');
  t('and two days after', W.medChemoBlockedOn(blocked, T0 + 2 * DAY) === true, '');
  t('and lifts on the third', W.medChemoBlockedOn(blocked, T0 + 3 * DAY) === false, '');
  t('and is not in force the day before', W.medChemoBlockedOn(blocked, T0 - DAY) === false, '');
}

console.log('\n4B. THE CHECKS THE AUDIT FOUND COULD NOT FAIL');
{
  // Both of these passed against a mutant. They are the two that matter most, because the branch
  // they guard is the one behind the blank-screen crash.

  // (a) NO TREATMENT DATE AT ALL. The old fixture used a day ten days after treatment, where
  // chemoOffsetFor returns 10 -- not null -- so `if (offset === null) return []` was never
  // exercised, and deleting that line left the suite 24/24 green. That branch is the default state
  // of every new user and of anyone who used Clear.
  const noDates = NO_DATES.medWindowsFor({ id: 'x',
    chemoRelativeWindows: [{ dayOffset: 0, start: 8, end: 12, name: 'M' }],
    windows: [{ start: 6, end: 7, name: 'Plain' }] }, T0);
  // And the override still wins on a day it DOES name -- without this, "falls through" would pass
  // just as well on a property the app ignores entirely.
  const onNamedDay = W.medWindowsFor({ id: 'x',
    chemoRelativeWindows: [{ dayOffset: 0, start: 8, end: 12, name: 'M' }],
    windows: [{ start: 6, end: 7, name: 'Plain' }] }, T0);
  t('but on a day it DOES name, the override wins',
    onNamedDay.length === 1 && onNamedDay[0].name === 'M', JSON.stringify(onNamedDay));
  // THIS ASSERTION IS THE OPPOSITE OF WHAT IT SAID IN PHASE 1, AND PHASE 2 IS WHY.
  // Phase 1 made chemoRelativeWindows REPLACE the medication's windows, so a day the medication did
  // not name meant no window at all. The phase 1 audit endorsed that: "these windows depend on the
  // treatment date" must not silently become an everyday schedule. Sound about a hypothetical --
  // and the real regimen contradicts it. The one medication in this app with treatment-relative
  // windows had BOTH windows every single day, including on a device with no treatment date, and a
  // narrower one only the day AFTER treatment. Encoding phase 1's semantic into the migration was
  // wrong on 697 of 841 simulated hours, which the two-release comparison caught.
  // So the property is an OVERRIDE for the offsets it names, and every other day falls through to
  // med.windows. Whether a medication applies near treatment at all is what treatmentMode and
  // treatmentOnly already decide, generically -- this property shapes the windows, that one gates
  // them, and that is the cleaner split.
  t('with NO treatment date on record it falls through to its plain windows',
    Array.isArray(noDates) && noDates.length === 1 && noDates[0].name === 'Plain',
    JSON.stringify(noDates));

  // (b) UNSORTED INPUT. The old fixture was already in order, so deleting the sort changed nothing
  // and the check passed against a mutant.
  const unsorted = W.medWindowsFor({ id: 'x', chemoRelativeWindows: [
    { dayOffset: 0, start: 18, end: 20, name: 'Evening' },
    { dayOffset: 0, start: 8, end: 12, name: 'Morning' },
    { dayOffset: 0, start: 13, end: 15, name: 'Afternoon' }
  ] }, T0);
  t('windows given out of order come back sorted',
    unsorted.map(w => w.start).join(',') === '8,13,18', unsorted.map(w => w.start).join(','));
}

console.log('\n4C. THE PROTONIX-LINKED BRANCHES BELONG TO status(), NOT TO THE RESOLVER');
{
  // medWindowsFor replaced THREE call sites and only one of them -- status() -- ever applied these.
  // The missed-dose walk and the dose-progress ring used `med.id === 'dexamethasone' ? ... :
  // med.windows`, full stop. A resolver that applies them silently moves the walk's windows, which
  // changes which doses count as missed. The real helpers are loaded here, not stubbed, so the two
  // answers can actually differ.
  const d0 = W.dayStart(T0);
  W.state.entries.length = 0;
  W.state.entries.push({ id: 'e1', medId: 'protonix', ts: d0 + 19 * 3600000 });
  // app-v77 phase 2: the booleans became a `linkedTo` property and the two id-reading helpers became
  // linkedWindowsFor. The rule under test is unchanged and so is the thing that must stay true:
  // medWindowsFor does NOT apply it, because two of the three call sites it replaced never did.
  const linked = { id: 'some-evening-med', linkedTo: { medId: 'protonix', half: 'evening', gapH: 2 },
    windows: [{ start: 22, end: 24, name: 'Night' }] };
  const viaResolver = W.medWindowsFor(linked, d0);
  const viaHelper = W.linkedWindowsFor(linked, d0);
  t('the linked helper really does move the window, so this check has teeth',
    JSON.stringify(viaHelper) !== JSON.stringify(linked.windows),
    'helper: ' + JSON.stringify(viaHelper));
  t('and medWindowsFor does NOT apply it -- it returns the plain windows',
    JSON.stringify(viaResolver) === JSON.stringify(linked.windows),
    'resolver: ' + JSON.stringify(viaResolver));
  W.state.entries.length = 0;
}

console.log('\n5. BROKEN OR HOSTILE PROPERTY VALUES CANNOT CRASH A RENDER');
{
  for (const bad of [
    { id: 'x', chemoRelativeWindows: 'not an array' },
    { id: 'x', chemoRelativeWindows: [] },
    { id: 'x', chemoBlock: { fromDayOffset: 5, toDayOffset: 0 } },
    { id: 'x', chemoBlock: null },
    { id: 'x', chemoBlock: 'nope' },
    null, undefined, {}
  ]) {
    let threw = null;
    try { W.medWindowsFor(bad, T0); W.medChemoBlockedOn(bad, T0); W.medChemoBlockingDay(bad, T0); }
    catch (e) { threw = String(e && e.message || e); }
    t('survives ' + JSON.stringify(bad), threw === null, threw || '');
  }
}

console.log('\n' + pass + '/' + (pass + fail) + ' checks passed' + (fail ? '  <-- FAIL' : ''));
process.exit(fail ? 1 : 0);
