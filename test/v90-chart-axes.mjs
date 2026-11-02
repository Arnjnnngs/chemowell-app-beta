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
const axisOf = async (chartKey, entries, months, simYmd) => {
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  c.on('page', (pg2) => pg2.on('pageerror', (e) => thrown.push(String(e))));
  const pg = await c.newPage();
  await pg.addInitScript(seed(entries));
  await pg.goto(BASE, { waitUntil: 'load' });
  await pg.waitForTimeout(2200);
  // Move the app's clock BEFORE the report is drawn, where asked. chartTimeMax takes `now` as an
  // argument precisely so one drawing cannot hold two clocks, and a mutant that threw the
  // argument away and called Date.now() again passed all 89 checks -- because nothing in the
  // suite could make the app's clock differ from the real one.
  if (simYmd) {
    const moved = await pg.evaluate((ymd) => {
      if (!(window.__v86Test && window.__v86Test.simDate)) return 'no hook';
      window.__v86Test.simDate(ymd); return 'ok';
    }, simYmd);
    if (moved !== 'ok') thrown.push('simDate hook missing');
    await pg.waitForTimeout(500);
  }
  const opened = await pg.evaluate((k) => {
    if (!(window.__v86Test && window.__v86Test.openReport)) return 'no hook';
    window.__v86Test.openReport(k); return 'ok';
  }, chartKey);
  await pg.waitForTimeout(900);
  // The Weeks/Months toggle decides whether the axis asks for 4 ticks or 6. A mutant that
  // hard-coded it to 4 survived the whole suite, because nothing ever pressed Months.
  if (months) {
    await pg.evaluate(() => {
      const b2 = [...document.querySelectorAll('button')].find(x => /^Months$/.test((x.innerText || '').trim()));
      if (b2) b2.click();
    });
    await pg.waitForTimeout(700);
  }
  // POSITION, NOT ONLY TEXT. Four surviving mutants moved every label sideways -- one tick right
  // of its own time, or the de-duplication keeping the last of a run instead of the first -- and
  // the suite never noticed, because it only ever read the words. data-xaxis already carries x.
  const out = await pg.evaluate(() => {
    const ns = [...document.querySelectorAll('[data-xaxis]')];
    const svg = ns.length ? ns[0].closest('svg') : null;
    const vb = svg ? (svg.getAttribute('viewBox') || '').split(/\s+/).map(Number) : null;
    return {
      labels: ns.map(n => (n.textContent || '').trim()),
      xs: ns.map(n => Number(n.getAttribute('x'))),
      // The data points are the chart's own statement of where a moment in time sits. The first
      // one is drawn at the earliest reading, which is exactly where the axis starts -- so it is
      // an exact anchor for the first label, derived from the chart rather than guessed.
      cxs: svg ? [...svg.querySelectorAll('circle')].map(c => Number(c.getAttribute('cx'))) : [],
      // THE BOX, NOT THE ANCHOR. Putting pad.right back to 20 -- undoing the clipping fix this
      // release shipped -- passed all 89 checks, because the only positional check asked whether
      // the label's `x` was inside the viewBox and both 646 and 660 are. What clips is the drawn
      // text, which extends half its width either side of x because text-anchor is middle.
      boxes: ns.map(n => { try { const b = n.getBBox(); return [b.x, b.x + b.width]; } catch (e) { return null; } }),
      vbWidth: vb && vb.length === 4 ? vb[2] : null,
      svgs: document.querySelectorAll('svg').length,
    };
  });
  await c.close();
  return { opened, ...out };
};

// FIXTURES ARE RELATIVE TO NOW, NEVER AT AN ABSOLUTE HOUR. The first version seeded todayAt(9)
// and todayAt(7/9/11), so before those hours it was creating FUTURE-dated readings: the single
// reading case collapsed to tMax === tMin, one label, and that label was after now. Six checks
// red, on this exact and correct code, at 03:07, 03:38, 04:38 and 04:05 in four timezones --
// found by the audit running at a different hour than the author.
//
// A suite that passes in the afternoon and fails in the morning is worse than no suite: it is
// red on correct code, which teaches whoever sees it that red means nothing. Every fixture below
// is "N hours before now", clamped so it never lands before midnight -- so a run at 00:30 gets a
// span measured in minutes rather than a reading dated yesterday, and still tests the same thing.
const ago = (hours) => {
  const now = Date.now();
  const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
  const wanted = now - hours * HOUR;
  // Keep it inside today, and never exactly now -- a zero-length span is its own case, not this one.
  return Math.max(wanted, midnight.getTime() + 60000);
};
// Hours before now, used where a case needs a day boundary crossed rather than a time of day.
const agoDays = (d, hours) => ago(hours) - d * DAY;

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

// Only for spans whose ticks are guaranteed to produce distinct labels -- a day or more apart on
// a dated axis, or distinct hours on a same-day one. There, EVERY tick must carry a label, so the
// gaps between labels are all equal. A mutant that dropped one label from the middle of the axis
// passed all 89 checks: nothing asserted the axis was fully labelled, and every distinctness
// check (`new Set(labels).size === labels.length`) is satisfied MORE easily by dropping a label
// than by keeping it. The suite was blind in exactly the direction the de-duplication fix moved
// the code. Deliberately NOT applied where labels are meant to collapse (sections 3, 3b and 4c).
const checkFullyLabelled = (tag, r) => {
  const xs = r.xs || [];
  t(tag + '.f1  every tick on the axis carries a label -- none dropped from the middle',
    xs.length >= 3 && xs.slice(1).every((v, i) => Math.abs((v - xs[i]) - (xs[1] - xs[0])) <= 0.3),
    'gaps ' + JSON.stringify(xs.slice(1).map((v, i) => Math.round((v - xs[i]) * 10) / 10)));
};

// Every section runs this. It is the half the suite was missing.
const checkPositions = (tag, r) => {
  const xs = r.xs || [];
  t(tag + '.p1  every label has a real x inside the drawing',
    xs.length > 0 && r.vbWidth > 0 && xs.every(v => Number.isFinite(v) && v >= 0 && v <= r.vbWidth),
    'viewBox width ' + r.vbWidth + ', xs ' + JSON.stringify(xs));
  t(tag + '.p2  and they run left to right, never backwards or on top of each other',
    xs.length > 0 && xs.every((v, i) => i === 0 || v > xs[i - 1]), JSON.stringify(xs));
  // A label shifted a whole tick sideways is still "increasing" and still "inside" -- what it is
  // not is anchored to the data. Two mutants did exactly that: one drew every label a tick right
  // of its own time, the other kept the LAST of a run of repeats instead of the first, which
  // drags the surviving label rightwards. Both move the FIRST label off the earliest reading,
  // and the earliest reading's own dot is where the axis begins -- so this compares the two.
  // (The LAST label is deliberately not checked against the right edge: where the labels
  // de-duplicate, as they do across a two-day span, the last one kept sits where the date
  // changes, which is correct and is nowhere near the edge.)
  const cxs = (r.cxs || []).filter(Number.isFinite);
  t(tag + '.p3  the first label sits exactly on the earliest reading',
    xs.length > 0 && cxs.length > 0 && Math.abs(xs[0] - Math.min.apply(null, cxs)) <= 0.11,
    'first label at ' + xs[0] + ', earliest reading at ' + (cxs.length ? Math.min.apply(null, cxs) : 'none'));
  const boxes = (r.boxes || []).filter(Boolean);
  t(tag + '.p4  and no label is DRAWN outside the chart, box and all',
    boxes.length === xs.length && r.vbWidth > 0 && boxes.every(bx => bx[0] >= 0 && bx[1] <= r.vbWidth),
    'viewBox 0..' + r.vbWidth + ', boxes ' + JSON.stringify(boxes.map(bx => [Math.round(bx[0] * 10) / 10, Math.round(bx[1] * 10) / 10])));
};

for (const chart of CHARTS) {
  console.log('\n=== ' + chart.name.toUpperCase() + ' CHART ===');

  // --- 1. ONE reading today. The reported "runs into the future" case, at its sharpest: the old
  //        floor made the right edge 24h after the ONLY reading.
  {
    const r = await axisOf(chart.key, [chart.mk(ago(4), 0)]);
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
    checkPositions('1.' + chart.key + '', r);
    checkFullyLabelled('1.' + chart.key + '', r);
  }

  // --- 2. Three readings in one morning. The reported "repeats dates" case.
  {
    const r = await axisOf(chart.key, [chart.mk(ago(5), 0), chart.mk(ago(3), 1), chart.mk(ago(1), 2)]);
    t('2.' + chart.key + '.0  precondition: the chart rendered and has labels',
      r.opened === 'ok' && r.labels.length > 0, 'labels=' + JSON.stringify(r.labels));
    t('2.' + chart.key + '.1  three readings in one morning give several distinct labels',
      r.labels.length >= 3 && new Set(r.labels).size === r.labels.length,
      r.labels.length + ' labels: ' + JSON.stringify(r.labels));
    t('2.' + chart.key + '.2  and none of them is after now',
      r.labels.length > 0 && futureOnes(r.labels).length === 0, JSON.stringify(futureOnes(r.labels)));
    checkPositions('2.' + chart.key + '', r);
    checkFullyLabelled('2.' + chart.key + '', r);
  }

  // --- 3. Two days, which is the span the old code repeated most visibly.
  {
    const base = ago(1);
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
    checkPositions('3.' + chart.key + '', r);
  }

  // --- 4. Four weeks. The case that already worked: it must still look the way it did, dates and
  //        all, or the format rule has eaten the ordinary chart.
  {
    const base = ago(1);
    const pts = [];
    for (let i = 27; i >= 0; i -= 3) pts.push(chart.mk(base - i * DAY, 27 - i));
    const r = await axisOf(chart.key, pts);
    t('4.' + chart.key + '.0  precondition: the chart rendered and has labels',
      r.opened === 'ok' && r.labels.length >= 3, 'labels=' + JSON.stringify(r.labels));
    t('4.' + chart.key + '.1  a month of readings is still labelled with dates',
      r.labels.length >= 3 && r.labels.every(L => /^\d{1,2}\/\d{1,2}$/.test(L)), JSON.stringify(r.labels));
    t('4.' + chart.key + '.2  distinct, and none after today',
      r.labels.length >= 3 && new Set(r.labels).size === r.labels.length && futureOnes(r.labels).length === 0,
      JSON.stringify(r.labels) + ' future=' + JSON.stringify(futureOnes(r.labels)));
    checkPositions('4.' + chart.key, r);
    checkFullyLabelled('4.' + chart.key, r);

    // --- 4b. THE MONTHS TOGGLE, which asks the axis for 6 ticks instead of 4. Nothing pressed it
    //         before, so a mutant hard-coding the count sailed through every case above.
    const rm = await axisOf(chart.key, pts, true);
    t('4b.' + chart.key + '.0  precondition: Months renders an axis', rm.labels.length >= 3,
      'labels=' + JSON.stringify(rm.labels));
    t('4b.' + chart.key + '.1  Months asks for more ticks than Weeks, and gets them',
      rm.labels.length > r.labels.length,
      'weeks ' + r.labels.length + ' ' + JSON.stringify(r.labels) + ' vs months ' + rm.labels.length + ' ' + JSON.stringify(rm.labels));
    t('4b.' + chart.key + '.2  still distinct, still nothing after today',
      new Set(rm.labels).size === rm.labels.length && futureOnes(rm.labels).length === 0,
      JSON.stringify(rm.labels));
    checkPositions('4b.' + chart.key, rm);
    checkFullyLabelled('4b.' + chart.key, rm);
  }
}

// --- 3b. A SPAN WHOSE FIRST DATE REPEATS. This exists because of a mutant that survived
//         everything above: de-duplication that keeps the LAST of a run of repeats instead of
//         the first. In section 3 the earliest tick's date happened to be unique, so keeping the
//         last of each run moved nothing the suite was looking at. Here most of the early ticks
//         land on the first day, so keep-last drags that day's label inward, off the earliest
//         reading -- and p3 sees it. The fixture is anchored to local midnight rather than to
//         the current hour, so it does not change shape through the day.
console.log('\n=== 3b. A span whose earliest date covers several ticks');
for (const chart of CHARTS) {
  const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
  const t0 = midnight.getTime() - 2 * DAY + HOUR;         // two days ago, 01:00
  const t1 = midnight.getTime() - DAY + 12 * HOUR;        // yesterday, noon
  const r = await axisOf(chart.key, [chart.mk(t0, 0), chart.mk(t1, 1)]);
  t('3b.' + chart.key + '.0  precondition: the chart rendered an axis', r.labels.length >= 2,
    'labels=' + JSON.stringify(r.labels));
  t('3b.' + chart.key + '.1  distinct, and nothing after today',
    new Set(r.labels).size === r.labels.length && futureOnes(r.labels).length === 0,
    JSON.stringify(r.labels));
  // THIS CHECK WAS VACUOUS AND THE AUDIT PROVED IT. It read `r.labels.length >= 2` -- character
  // for character its own precondition one line above -- under a name claiming something else
  // entirely, and the keep-the-last-of-a-run mutant made that claim false while this passed.
  // Rule 5's `|| true` hazard with better camouflage, in the very commit whose message was about
  // checks that cannot be reached. It now asserts the claim its name makes: the first label is
  // the DATE OF THE EARLIEST READING, which is a different statement from p3's positional one.
  const wantFirst = (new Date(t0).getMonth() + 1) + '/' + new Date(t0).getDate();
  t('3b.' + chart.key + '.2  the first label names the earliest reading\u2019s own date',
    r.labels[0] === wantFirst, 'first label ' + JSON.stringify(r.labels[0]) + ', want ' + JSON.stringify(wantFirst));
  checkPositions('3b.' + chart.key, r);
}

// --- 3c. A CHART WHOSE NEWEST READING IS DAYS OLD. This is the case the whole suite was
//         missing, and it is the same gap that let a FALSE SENTENCE reach the patient: the
//         app-v90 release note first said the charts "stop at the last reading", which is only
//         true when the last reading is old. Every fixture in the suite ended at roughly now, so
//         the suite could not tell "stops at the newest reading" from "runs on to today" -- and
//         a mutant dropping the `tMin + AXIS_DAY` cap entirely passed all 89 checks for exactly
//         that reason. Here the newest reading is five days back, so the axis must END on it.
console.log('\n=== 3c. The axis ends on the newest reading when that reading is days old');
for (const chart of CHARTS) {
  const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
  const t0 = midnight.getTime() - 20 * DAY + 9 * HOUR;
  const tLast = midnight.getTime() - 5 * DAY + 9 * HOUR;
  const r = await axisOf(chart.key, [chart.mk(t0, 0), chart.mk(Math.round((t0 + tLast) / 2), 1), chart.mk(tLast, 2)]);
  t('3c.' + chart.key + '.0  precondition: the chart rendered an axis', r.labels.length >= 3,
    'labels=' + JSON.stringify(r.labels));
  // The newest reading's dot and the final tick must be the same point. If the axis ran on to
  // today, the last dot would sit well left of the last label.
  const cxs = (r.cxs || []).filter(Number.isFinite);
  t('3c.' + chart.key + '.1  the last label sits exactly on the newest reading, not days past it',
    r.xs.length > 0 && cxs.length > 0
      && Math.abs(r.xs[r.xs.length - 1] - Math.max.apply(null, cxs)) <= 0.11,
    'last label at ' + r.xs[r.xs.length - 1] + ', newest reading at ' + (cxs.length ? Math.max.apply(null, cxs) : 'none'));
  // And said the other way round, in the axis's own words rather than its geometry.
  const wantLast = (new Date(tLast).getMonth() + 1) + '/' + new Date(tLast).getDate();
  t('3c.' + chart.key + '.2  and the last label is that reading\u2019s date, not today\u2019s',
    r.labels[r.labels.length - 1] === wantLast,
    'last label ' + JSON.stringify(r.labels[r.labels.length - 1]) + ', want ' + JSON.stringify(wantLast));
  t('3c.' + chart.key + '.3  distinct, and nothing after today',
    new Set(r.labels).size === r.labels.length && futureOnes(r.labels).length === 0,
    JSON.stringify(r.labels));
  checkPositions('3c.' + chart.key, r);
  checkFullyLabelled('3c.' + chart.key, r);
}

// --- 3d. A SPAN LONGER THAN A YEAR, WHICH THE CODE'S OWN COMMENT CLAIMED WAS UNREACHABLE.
//         It is not: when every reading is older than the window, renderWeightTrend falls back to
//         `weightEntries.slice(-2)` with no bound on how far apart the two are. Without the year
//         in the format, global de-duplication dropped the tick sitting under the most recent
//         reading. Weight only -- the temperature report says "no temperatures in the last N"
//         for an empty window instead of falling back, and that difference is the point.
console.log('\n=== 3d. A span longer than a year carries the year, and loses no label');
{
  const chart = CHARTS.find(c => c.key === 'weight');
  const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
  const t0 = midnight.getTime() - 400 * DAY + 9 * HOUR;
  const tLast = midnight.getTime() - 60 * DAY + 9 * HOUR;   // 340 days apart, both outside 28d
  const r = await axisOf(chart.key, [chart.mk(t0, 0), chart.mk(tLast, 1)]);
  t('3d.0  precondition: the fallback rendered a chart from two out-of-window readings',
    r.labels.length >= 3, 'labels=' + JSON.stringify(r.labels));
  t('3d.1  every label carries the year, so no two can be confused across one',
    r.labels.length >= 3 && r.labels.every(L => /^\d{1,2}\/\d{1,2}\/\d{2}$/.test(L)),
    JSON.stringify(r.labels));
  t('3d.2  and the tick under the newest reading still has its label',
    new Set(r.labels).size === r.labels.length, JSON.stringify(r.labels));
  checkPositions('3d', r);
  checkFullyLabelled('3d', r);
}

console.log('\n=== 4c. A span under three hours is labeled to the minute');
// The minute branch (span under 3 hours, all on one day) was only reachable by accident, between
// about 09:00 and 12:00 local, so the mutant that disabled it survived the whole suite. The axis
// always runs to NOW, so the window has to end at now and start after midnight -- which is as
// little as a few seconds just after midnight. So the fixture takes whatever of the last 90
// minutes is still inside today:
const MIN = 60000;
const minuteWindow = () => {
  const now = Date.now();
  const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
  const end = now - 30000;
  const start = Math.max(midnight.getTime() + 1000, end - 90 * MIN);
  return [start, start + (end - start) / 2, end];
};
for (const chart of CHARTS) {
  const w = minuteWindow();
  const r = await axisOf(chart.key, w.map((ts, i) => chart.mk(ts, i)));
  // The floor is one label, not three, on purpose: a minute past midnight the window is a few
  // seconds wide and every tick rounds to the same minute. One label is enough to kill the
  // mutant -- an hour-formatted label cannot match this pattern -- and the distinctness of a
  // normal run is asserted in sections 1 through 4b, which are not clock-bound.
  t('4c.' + chart.key + '.0  precondition: the chart rendered an axis', r.labels.length >= 1,
    'labels=' + JSON.stringify(r.labels));
  t('4c.' + chart.key + '.1  a span inside one hour is labeled with minutes, not bare hours',
    r.labels.length >= 1 && r.labels.every(L => /^\d{1,2}:\d{2}\s*(AM|PM)$/i.test(L)),
    JSON.stringify(r.labels));
  t('4c.' + chart.key + '.2  distinct and none after now',
    new Set(r.labels).size === r.labels.length && futureOnes(r.labels).length === 0,
    JSON.stringify(r.labels));
  checkPositions('4c.' + chart.key, r);
}

// --- 4d. THE TEST_MODE DATE OVERRIDE. chartTimeMax is handed the same `now` the rest of the
//         chart was built from, instead of calling simNow() a second time -- so one drawing holds
//         one clock. A mutant that ignored the argument and called Date.now() passed every one of
//         the 89 checks before this, because no fixture ever moved the app's clock. With the
//         clock pushed three days forward, a reading logged that morning draws a normal axis; a
//         chart reading the REAL clock collapses the span to nothing and draws a single label.
console.log('\n=== 4d. A simulated future date moves the axis with it');
{
  const future = new Date(); future.setHours(0, 0, 0, 0);
  future.setTime(future.getTime() + 3 * DAY);
  const ymd = future.getFullYear() + '-' + String(future.getMonth() + 1).padStart(2, '0')
    + '-' + String(future.getDate()).padStart(2, '0');
  for (const chart of CHARTS) {
    const r = await axisOf(chart.key, [chart.mk(future.getTime() + 9 * HOUR, 0)], false, ymd);
    t('4d.' + chart.key + '.0  precondition: the chart rendered on the simulated day',
      r.labels.length >= 1, 'labels=' + JSON.stringify(r.labels));
    t('4d.' + chart.key + '.1  the axis runs from the reading to the SIMULATED now, not collapsed',
      r.labels.length >= 3 && new Set(r.labels).size === r.labels.length,
      r.labels.length + ' labels: ' + JSON.stringify(r.labels));
    t('4d.' + chart.key + '.2  and they are times on one day, since the reading is today there',
      r.labels.length >= 3 && r.labels.every(L => /(AM|PM)/i.test(L)), JSON.stringify(r.labels));
    checkPositions('4d.' + chart.key, r);
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
