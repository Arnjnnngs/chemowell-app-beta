// v90-chart-axes.mjs -- Aaron: "Chart x-axes repeat dates and run into the future".
//
// Both halves came from six lines that existed TWICE, in the temperature chart and the weight
// chart. So every case here runs against BOTH, from one table, and a fix that lands in one and not
// the other fails. That is the whole reason the suite is shaped this way: the defect was a copy.
//
// WHAT THE OLD CODE DID, which is what the mutants restore:
//   tMax = Math.max(lastReading, tMin + DAY)      -> one reading today puts TOMORROW on the axis
//   labels: always M/D, evenly spaced             -> a short span repeats one date 4-5 times
//
// THE CHECK MOST LIKELY TO BE WRITTEN VACUOUSLY is "no label is in the future", and it is named
// here as such. Asserting that a set of M/D strings contains no future date is easy to write in a
// way that passes on an empty set -- if the chart fails to render, or the selector finds nothing,
// there are no labels and therefore none in the future. Every section below asserts the label
// count FIRST and fails loudly when it is zero, and the labels are found by the data-xaxis hook
// rather than by position in the SVG.
//
// Run: python3 -m http.server 8899 --directory <repo>  then
//      env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy node test/v90-chart-axes.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = (() => {
  const _p = require('path');
  const tries = ['playwright',
    _p.join(_p.dirname(process.execPath), '..', 'lib', 'node_modules', 'playwright'),
    '/opt/node22/lib/node_modules/playwright',
    '/home/claude/.npm-global/lib/node_modules/playwright'];
  for (const t of tries) { try { return require(t); } catch (e) {} }
  throw new Error('playwright not found');
})();
const BASE = process.env.FALSIFY_BASE || 'http://127.0.0.1:8899/index.html';

let pass = 0, fail = 0;
const t = (name, ok, detail) => {
  if (ok) { pass++; console.log('  PASS  ' + name + (detail ? '  |  ' + detail : '')); }
  else { fail++; console.log('  FAIL  ' + name + '  |  ' + detail); }
};
const b = await chromium.launch();
const thrown = [];
const HOUR = 3600000, DAY = 86400000;

// Both charts, from one table. temp entries are medId 'temp' with a temp field; weight entries are
// medId 'weight' with a weight field -- the shapes the app's own writers produce (3205, 3242).
const CHARTS = [
  { key: 'temp',   name: 'temperature', mk: (ts, i) => ({ id: 't' + i, medId: 'temp', ts, temp: 99 + i * 0.1, unit: 'Fahrenheit', dose: (99 + i * 0.1).toFixed(1) + ' °F' }) },
  { key: 'weight', name: 'weight',      mk: (ts, i) => ({ id: 'w' + i, medId: 'weight', ts, weight: 150 + i, unit: 'lb', dose: (150 + i) + ' lb' }) },
];

const seed = (entries) => `(() => {
  localStorage.setItem('chemowell-app-profiles-v1', JSON.stringify({ list: [{ id: 'p1', name: 'Alex', createdAt: 1 }], activeId: 'p1' }));
  localStorage.setItem('chemowell-app-license-v1', JSON.stringify({ tier: 'free' }));
  localStorage.setItem('chemowell-app-p-p1-prefs-v1', JSON.stringify({ patientName: 'Alex', onboarded: true, treatmentType: 'chemo', tourDone: true, installedAt: Date.now() - 90*86400000 }));
  localStorage.setItem('chemowell-app-p-p1-med-v1', JSON.stringify({ version: 2, archivedMeds: {}, meds: [] }));
  localStorage.setItem('chemowell-app-p-p1-entries-v1', JSON.stringify(${JSON.stringify(entries)}));
  localStorage.setItem('chemowell-app-seen-version', 'app-v90');
})()`;

// Open a report and read its x-axis labels by hook.
const axisOf = async (chartKey, entries) => {
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  c.on('page', (pg2) => pg2.on('pageerror', (e) => thrown.push(String(e))));
  const pg = await c.newPage();
  await pg.addInitScript(seed(entries));
  await pg.goto(BASE, { waitUntil: 'load' });
  await pg.waitForTimeout(2200);
  const opened = await pg.evaluate((k) => {
    if (!(window.__v86Test && window.__v86Test.openReport)) return 'no hook';
    window.__v86Test.openReport(k); return 'ok';
  }, chartKey);
  await pg.waitForTimeout(900);
  const out = await pg.evaluate(() => ({
    labels: [...document.querySelectorAll('[data-xaxis]')].map(n => (n.textContent || '').trim()),
    svgs: document.querySelectorAll('svg').length,
  }));
  await c.close();
  return { opened, ...out };
};

// Today at a given hour, in the browser's own zone, as a timestamp.
const todayAt = (h, m) => { const d = new Date(); d.setHours(h, m || 0, 0, 0); return d.getTime(); };

// A label is "in the future" if it names a calendar day after today, or an hour later than now.
// Date labels are M/D; time labels are "9 AM" or "9:05 AM". Both are checked against the same
// clock the fixture used.
const futureOnes = (labels) => {
  const now = new Date();
  return labels.filter(L => {
    const md = L.match(/^(\d{1,2})\/(\d{1,2})$/);
    if (md) {
      const d = new Date(now.getFullYear(), Number(md[1]) - 1, Number(md[2]), 23, 59, 59);
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      return d.getTime() > today.getTime();
    }
    const hm = L.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
    if (hm) {
      let hh = Number(hm[1]) % 12; if (/pm/i.test(hm[3])) hh += 12;
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, Number(hm[2] || 0));
      return d.getTime() > now.getTime() + 60000;
    }
    return false;
  });
};

for (const chart of CHARTS) {
  console.log('\n=== ' + chart.name.toUpperCase() + ' CHART ===');

  // --- 1. ONE reading today. The reported "runs into the future" case, at its sharpest: the old
  //        floor made the right edge 24h after the ONLY reading.
  {
    const r = await axisOf(chart.key, [chart.mk(todayAt(9), 0)]);
    t('1.' + chart.key + '.0  precondition: the chart rendered and has labels',
      r.opened === 'ok' && r.labels.length > 0, 'opened=' + r.opened + ' svgs=' + r.svgs + ' labels=' + JSON.stringify(r.labels));
    const fut = futureOnes(r.labels);
    t('1.' + chart.key + '.1  a single reading today puts nothing after today on the axis',
      r.labels.length > 0 && fut.length === 0, 'future: ' + JSON.stringify(fut) + ' of ' + JSON.stringify(r.labels));
    // DISTINCT IS NOT ENOUGH, and a mutant proved it: reverting to always-M/D keeps every label
    // identical, the de-duplication collapses them to ONE, and "all distinct" is trivially true
    // of a single label. The axis is then not lying, it is just useless -- one tick for a whole
    // day of readings. So the count is asserted alongside the distinctness.
    t('1.' + chart.key + '.2  and a day of readings gets several distinct labels, not one',
      r.labels.length >= 3 && new Set(r.labels).size === r.labels.length,
      r.labels.length + ' labels: ' + JSON.stringify(r.labels));
  }

  // --- 2. Three readings in one morning. The reported "repeats dates" case.
  {
    const r = await axisOf(chart.key, [chart.mk(todayAt(7), 0), chart.mk(todayAt(9), 1), chart.mk(todayAt(11), 2)]);
    t('2.' + chart.key + '.0  precondition: the chart rendered and has labels',
      r.opened === 'ok' && r.labels.length > 0, 'labels=' + JSON.stringify(r.labels));
    t('2.' + chart.key + '.1  three readings in one morning give several distinct labels',
      r.labels.length >= 3 && new Set(r.labels).size === r.labels.length,
      r.labels.length + ' labels: ' + JSON.stringify(r.labels));
    t('2.' + chart.key + '.2  and none of them is after now',
      r.labels.length > 0 && futureOnes(r.labels).length === 0, JSON.stringify(futureOnes(r.labels)));
  }

  // --- 3. Two days, which is the span the old code repeated most visibly.
  {
    const base = todayAt(9);
    const r = await axisOf(chart.key, [chart.mk(base - DAY, 0), chart.mk(base - DAY + 6 * HOUR, 1), chart.mk(base, 2)]);
    t('3.' + chart.key + '.0  precondition: the chart rendered and has labels',
      r.opened === 'ok' && r.labels.length > 0, 'labels=' + JSON.stringify(r.labels));
    // Two labels is the honest answer for a two-day span, so no floor of three here -- only that
    // a date is never printed twice, and that the axis says something.
    t('3.' + chart.key + '.1  a two-day span does not print one date twice',
      r.labels.length >= 2 && new Set(r.labels).size === r.labels.length,
      r.labels.length + ' labels: ' + JSON.stringify(r.labels));
    t('3.' + chart.key + '.2  and nothing is after today',
      r.labels.length > 0 && futureOnes(r.labels).length === 0, JSON.stringify(futureOnes(r.labels)));
  }

  // --- 4. Four weeks. The case that already worked: it must still look the way it did, dates and
  //        all, or the format rule has eaten the ordinary chart.
  {
    const base = todayAt(9);
    const pts = [];
    for (let i = 27; i >= 0; i -= 3) pts.push(chart.mk(base - i * DAY, 27 - i));
    const r = await axisOf(chart.key, pts);
    t('4.' + chart.key + '.0  precondition: the chart rendered and has labels',
      r.opened === 'ok' && r.labels.length >= 3, 'labels=' + JSON.stringify(r.labels));
    t('4.' + chart.key + '.1  a month of readings is still labelled with dates',
      r.labels.length >= 3 && r.labels.every(L => /^\d{1,2}\/\d{1,2}$/.test(L)), JSON.stringify(r.labels));
    t('4.' + chart.key + '.2  distinct, and none after today',
      new Set(r.labels).size === r.labels.length && futureOnes(r.labels).length === 0,
      JSON.stringify(r.labels) + ' future=' + JSON.stringify(futureOnes(r.labels)));
  }
}

console.log('\n=== 5. The What’s New title has a hook, not a line number (F1, deferred from app-v89)');
{
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  c.on('page', (pg2) => pg2.on('pageerror', (e) => thrown.push(String(e))));
  const pg = await c.newPage();
  await pg.addInitScript(`(() => {
    localStorage.setItem('chemowell-app-profiles-v1', JSON.stringify({ list: [{ id: 'p1', name: 'Alex', createdAt: 1 }], activeId: 'p1' }));
    localStorage.setItem('chemowell-app-p-p1-prefs-v1', JSON.stringify({ patientName: 'Alex', onboarded: true, treatmentType: 'chemo', tourDone: true, installedAt: Date.now() - 90*86400000 }));
    localStorage.setItem('chemowell-app-p-p1-med-v1', JSON.stringify({ version: 2, archivedMeds: {}, meds: [] }));
    localStorage.setItem('chemowell-app-seen-version', 'nothing-seen-yet');
  })()`);
  await pg.goto(BASE, { waitUntil: 'load' });
  await pg.waitForTimeout(2200);
  const got = await pg.evaluate(() => {
    const m = document.querySelector('[data-whatsnew-modal]');
    const nodes = [...document.querySelectorAll('[data-whatsnew-title]')];
    return { modal: !!m, n: nodes.length, first: nodes[0] ? (nodes[0].textContent || '').trim() : null,
             v: nodes[0] ? nodes[0].getAttribute('data-whatsnew-title') : null };
  });
  t('5.0  precondition: the notice is open', got.modal, JSON.stringify(got));
  t('5.1  the title is reachable by hook', got.n >= 1 && !!got.first, JSON.stringify(got));
  // The hook carries the version, so the title cannot be confused with the date beside it -- which
  // is exactly what the old innerText.split('\n')[1] did when the badge above it was emptied.
  t('5.2  and it is a title, not the date next to it',
    !!got.first && !/^[A-Z][a-z]{2}\s+\d{1,2},\s+\d{4}$/.test(got.first), JSON.stringify(got.first));
  t('5.3  and the hook names the version it belongs to', /^app-v\d+$/.test(got.v || ''), JSON.stringify(got.v));
  await c.close();
}

console.log('\n=== 6. Nothing threw');
t('6.1  no uncaught page errors', thrown.length === 0, thrown.slice(0, 3).join(' | '));

await b.close();
console.log('\n' + (pass + fail) + ' checks: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
