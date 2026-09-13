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
  grab(/function dexWindowsForOffset\([^\n]*\n?/, 'dexWindowsForOffset'),
  grab(/function zofranBlockedOn\([\s\S]*?\n\}/, 'zofranBlockedOn'),
  grab(/function zofranBlockingDay\([\s\S]*?\n\}/, 'zofranBlockingDay'),
  grab(/function safeMedicationId\([\s\S]*?\n\}/, 'safeMedicationId'),
  grab(/function medWindowsFor\(med, dayTs\) \{[\s\S]*?\n\}/, 'medWindowsFor'),
  grab(/function medChemoBlockedOn\(med, dayTs\) \{[\s\S]*?\n\}/, 'medChemoBlockedOn'),
  grab(/function medChemoBlockingDay\(med, dayTs\) \{[\s\S]*?\n\}/, 'medChemoBlockingDay'),
  grab(/function medChemoBlockSpanDays\(med\) \{[\s\S]*?\n\}/, 'medChemoBlockSpanDays')
].join('\n');

// Two treatment dates three weeks apart, so offsets repeat and a block can span a boundary.
const T0 = new Date('2026-03-02T12:00:00').getTime();
const CHEMO = [T0, T0 + 21 * DAY];

function world() {
  const prelude = `
    const CHEMO_DAYS = ${JSON.stringify(CHEMO)};
    function chemoDayList() { return CHEMO_DAYS.map(d => dayStart(d)); }
    function eveningWindowsFor(med, d0) { return med.windows || []; }
    function morningWindowsFor(med, d0) { return med.windows || []; }
    const state = { meds: [], entries: [] };
  `;
  // chemoDayList and chemoOffsetFor come out of the file; chemoDayList is replaced by the stub above
  // so the simulation controls the dates. chemoOffsetFor is the real one.
  const body = SRC.replace(/function chemoDayList\(\)[\s\S]*?\n\}/, '');
  return new Function(prelude + '\n' + body +
    '\nreturn { dayStart, chemoOffsetFor, dexWindowsForOffset, zofranBlockedOn, zofranBlockingDay,' +
    ' medWindowsFor, medChemoBlockedOn, medChemoBlockingDay, medChemoBlockSpanDays };')();
}
const W = world();

console.log('\n1. THE RESOLVERS LOAD AND RUN OUT OF THE SHIPPED FILE');
t('every function this test needs was found in index.html', true, Object.keys(W).join(', '));

console.log('\n2. WITH NO PROPERTIES SET, THE NEW PATH IS THE OLD PATH  (every hour of a full cycle)');
{
  // The two medications that carry hardcoded behaviour today, exactly as stored.
  const dex = { id: 'dexamethasone', windows: [{ start: 8, end: 12, name: 'Morning' }] };
  const zof = { id: 'zofran', windows: [] };
  const plain = { id: 'something-else', windows: [{ start: 9, end: 11, name: 'Morning' }] };

  let winMismatch = 0, blockMismatch = 0, dayMismatch = 0, checks = 0;
  // A full cycle plus a week either side, every hour.
  for (let ts = T0 - 7 * DAY; ts <= T0 + 28 * DAY; ts += 3600000) {
    const d0 = W.dayStart(ts);
    checks++;
    // windows: old path vs resolver
    const oldDex = W.dexWindowsForOffset(W.chemoOffsetFor(d0));
    const newDex = W.medWindowsFor(dex, d0);
    if (JSON.stringify(oldDex) !== JSON.stringify(newDex)) winMismatch++;
    const newPlain = W.medWindowsFor(plain, d0);
    if (JSON.stringify(plain.windows) !== JSON.stringify(newPlain)) winMismatch++;
    // block: old path vs resolver
    if (W.zofranBlockedOn(ts) !== W.medChemoBlockedOn(zof, ts)) blockMismatch++;
    if (W.medChemoBlockedOn(plain, ts) !== false) blockMismatch++;
    if (W.zofranBlockingDay(ts) !== W.medChemoBlockingDay(zof, ts)) dayMismatch++;
  }
  t('windows agree on every hour of the cycle', winMismatch === 0, winMismatch + ' of ' + checks + ' hours differ');
  t('the treatment-date block agrees on every hour', blockMismatch === 0, blockMismatch + ' differ');
  t('and so does WHICH day is blocking', dayMismatch === 0, dayMismatch + ' differ');
  t('the block still runs three days, as it did', W.medChemoBlockSpanDays({ id: 'zofran' }) === 3,
    String(W.medChemoBlockSpanDays({ id: 'zofran' })));
  t('this actually exercised a real span', checks > 800, checks + ' hours simulated');
}

console.log('\n3. FALSIFIED: BREAK THE RESOLVER AND THE SIMULATION MUST NOTICE');
{
  // A simulation that agrees with itself proves nothing. Feed the resolver a medication whose
  // property says something DIFFERENT from the legacy branch and require a disagreement.
  const zofButShorter = { id: 'zofran', chemoBlock: { fromDayOffset: 0, toDayOffset: 0 } };
  let differed = 0;
  for (let ts = T0; ts <= T0 + 5 * DAY; ts += 3600000) {
    if (W.zofranBlockedOn(ts) !== W.medChemoBlockedOn(zofButShorter, ts)) differed++;
  }
  t('a property that disagrees with the legacy branch IS detected', differed > 0,
    differed + ' hours differ, as they must');
  t('and the span follows the property, not the hardcoded 3',
    W.medChemoBlockSpanDays(zofButShorter) === 1, String(W.medChemoBlockSpanDays(zofButShorter)));
}

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
  t('on an unrelated day it gets NONE, never its plain windows',
    farAway.length === 0, JSON.stringify(farAway));
  t('and the windows come back sorted by start time',
    onDay[0].start < onDay[1].start, JSON.stringify(onDay.map(w => w.start)));

  const blocked = { id: 'some-antiemetic', chemoBlock: { fromDayOffset: 0, toDayOffset: 2 } };
  t('a declared block covers the treatment day', W.medChemoBlockedOn(blocked, T0) === true, '');
  t('and two days after', W.medChemoBlockedOn(blocked, T0 + 2 * DAY) === true, '');
  t('and lifts on the third', W.medChemoBlockedOn(blocked, T0 + 3 * DAY) === false, '');
  t('and is not in force the day before', W.medChemoBlockedOn(blocked, T0 - DAY) === false, '');
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
