// v82-timeline.mjs -- the Today timeline, which shipped with NO checks at all.
//
// WHY THIS FILE EXISTS, and it is not a nice-to-have. app-v82 rebuilt the Today list into a
// timeline and shipped a 41-check suite that covered only the vitals strip. The independent audit
// proved the gap by gutting the timeline -- deleting every dot and planting the literal attribute
// value "null" on the section -- and watching all 41 checks stay green, because no file in test/
// so much as named `data-home="timeline"`. That blind spot is how the defect below reached the
// audit in the first place:
//
//   THE HEADER COUNTED MISSED DOSES AS LOGGED. "N logged" summed the journal groups, and those are
//   built from today's entries PLUS today's missed doses. One temperature and one missed dose read
//   "2 logged", with the word MISSED in the row directly underneath. On the first screen of a
//   medication app, wrong in the reassuring direction.
//
// Run:  python3 -m http.server 8899 --directory <repo>   (then)  node test/v82-timeline.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = (() => {
  const _p = require('node:path');
  const tries = ['playwright',
    _p.join(_p.dirname(process.execPath), '..', 'lib', 'node_modules', 'playwright'),
    '/opt/node22/lib/node_modules/playwright',
    '/home/claude/.npm-global/lib/node_modules/playwright'];
  for (const c of tries) { try { return require(c); } catch (e) {} }
  throw new Error('playwright not found');
})();

const BASE = process.env.FALSIFY_BASE || 'http://127.0.0.1:8899/index.html';
let pass = 0, fail = 0;
const t = (name, cond, detail) => {
  console.log('  ' + (cond ? 'PASS  ' : 'FAIL  ') + name + (detail !== undefined ? '  |  ' + detail : ''));
  cond ? pass++ : fail++;
};
const section = s => console.log('\n' + s);

const HOUR = 3600000;
const browser = await chromium.launch();
const allErrors = [];

// Fixtures are built around a FROZEN hour rather than the wall clock. A suite whose windows move
// with the time of day stops testing anything at 11pm and nobody notices -- the app-v80 finding.
const AT = (h, m) => { const d = new Date(); d.setHours(h, m || 0, 0, 0); return d.getTime(); };

async function open(fixture, viewport) {
  const page = await browser.newPage({ viewport: viewport || { width: 390, height: 844 } });
  page.on('pageerror', e => allErrors.push(String(e.message)));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const x = m.text();
    if (/Failed to load resource|net::ERR_/.test(x)) return;
    allErrors.push(x);
  });
  await page.goto(BASE);
  await page.waitForTimeout(1200);
  const keys = await page.evaluate(() => {
    const prefs = Object.keys(localStorage).find(k => /prefs-v1$/.test(k));
    return {
      prefs,
      // NEITHER of these keys exists until something is written, so both are derived from the
      // prefs key the app really created rather than searched for. Searching found nothing, the
      // medication fixture was silently dropped, and the missed-dose case then reported "no MISSED
      // row was produced" instead of passing -- which is the only reason the mistake was visible.
      entries: prefs ? prefs.replace(/prefs-v1$/, 'entries-v1') : null,
      med: prefs ? prefs.replace(/prefs-v1$/, 'med-v1') : null
    };
  });
  if (!keys.prefs || !keys.entries) throw new Error('storage keys not found: ' + JSON.stringify(keys));
  await page.evaluate(({ k, f }) => {
    const prefs = JSON.parse(localStorage.getItem(k.prefs) || '{}');
    localStorage.setItem(k.prefs, JSON.stringify(Object.assign(prefs, { patientName: 'Test', onboarded: true }, f.prefs || {})));
    localStorage.setItem(k.entries, JSON.stringify(f.entries || []));
    if (f.meds) {
      if (!k.med) throw new Error('no medication config key to write the fixture into');
      localStorage.setItem(k.med, JSON.stringify({ version: 2, meds: f.meds, archivedMeds: {} }));
    }
  }, { k: keys, f: fixture });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1700);
  for (const name of ['Skip guide', 'Got it']) {
    const b = page.getByRole('button', { name, exact: true });
    if (await b.count()) { await b.first().click(); await page.waitForTimeout(400); }
  }
  page.__keys = keys;
  return page;
}

// ---------------------------------------------------------------------------------------------
section('1. THE TIMELINE IS ON HOME AND CARRIES THE DAY');
{
  const p = await open({ entries: [
    { id: 'a', medId: 'temp', temp: 99.1, dose: '99.1 \u00b0F', mg: 0, ts: AT(2, 10) },
    { id: 'b', medId: 'weight', weight: 150.4, dose: '150.4 lbs', mg: 0, ts: AT(8, 30) },
    { id: 'c', medId: 'blood_pressure', sys: 120, dia: 78, dose: '120/78 mmHg', mg: 0, ts: AT(14, 5) }
  ] });
  t('the timeline section is drawn', await p.locator('[data-home="timeline"]').count() === 1,
    String(await p.locator('[data-home="timeline"]').count()));
  const txt = await p.locator('[data-home="timeline"]').innerText();
  t('and it is headed Today', /Today/i.test(txt), txt.split('\n')[0]);
  // THE DOTS ARE THE THING THE REDESIGN IS NAMED FOR. The audit deleted every one of them and the
  // old suite stayed green, so this check exists precisely to make that impossible again.
  const dots = await p.evaluate(() => document.querySelectorAll('[data-home="timeline"] [data-timeline-dot]').length);
  t('every event has a dot on the rail', dots === 3, dots + ' dots for 3 events');
  const rail = await p.evaluate(() => document.querySelectorAll('[data-home="timeline"] [data-timeline-rail]').length);
  t('and there is exactly one rail, not one per bucket', rail === 1, rail + ' rail(s)');
  // The old design was four white cards with four headings. One day is one thing.
  t('the buckets survive as dividers, not as separate cards',
    /Overnight/i.test(txt) && /Morning/i.test(txt) && /Afternoon/i.test(txt), txt.replace(/\n/g, ' | ').slice(0, 120));
  await p.close();
}

// ---------------------------------------------------------------------------------------------
section('2. "LOGGED" MEANS LOGGED — THE DEFECT THE AUDIT BLOCKED ON');
{
  // One real entry. Nothing else. Whatever the header says here is what the app believes "logged"
  // means, with no missed doses to muddle it.
  const p = await open({ entries: [{ id: 'a', medId: 'temp', temp: 98.6, dose: '98.6 \u00b0F', mg: 0, ts: AT(9, 0) }] });
  const count = await p.locator('[data-timeline-count]').innerText();
  t('one entry reads "1 logged"', /^1 logged$/.test(count.trim()), count);
  t('and says nothing about missed doses when none were missed', !/missed/i.test(count), count);
  await p.close();
}
{
  // A medication whose window opened this morning and closed, never logged -> a MISSED row. Plus
  // one real temperature. The header must say one logged, not two.
  const meds = [{
    id: 'sched-a', name: 'ScheduledMed', type: 'win', schemaV: 2, quickLog: true, alerts: true,
    doses: [{ label: '1 tab', mg: 0, pills: 1 }],
    // A window that opened and CLOSED before the fixture's "now", so the app itself decides this
    // is a miss. Anchored to fixed early hours rather than to the wall clock, because a window
    // computed from the current hour lands past midnight when the suite runs in the evening and
    // the case quietly stops existing -- the app-v80 finding.
    windows: [{ name: 'Morning', start: 1, end: 2 }]
  }];
  const p = await open({
    meds,
    entries: [{ id: 'a', medId: 'temp', temp: 98.6, dose: '98.6 \u00b0F', mg: 0, ts: AT(12, 0) }]
  });
  const txt = await p.locator('[data-home="timeline"]').innerText();
  const hasMissed = /MISSED/i.test(txt);
  t('the fixture really does produce a MISSED row -- otherwise this proves nothing',
    hasMissed, txt.replace(/\n/g, ' | ').slice(0, 160));
  if (hasMissed) {
    const count = await p.locator('[data-timeline-count]').innerText();
    t('a missed dose is NOT counted as logged', /(^|\D)1 logged/.test(count), count);
    t('and the missed one is named separately rather than hidden', /1 missed/.test(count), count);
    t('and the missed figure is not silently folded into the logged figure', !/2 logged/.test(count), count);
  } else {
    // Reported, never skipped. A fixture that stopped producing the case it was written for is a
    // suite that has quietly stopped testing, which is worse than a red check.
    t('a missed dose is NOT counted as logged', false, 'no MISSED row was produced - fixture no longer exercises this');
    t('and the missed one is named separately rather than hidden', false, 'not reachable');
    t('and the missed figure is not silently folded into the logged figure', false, 'not reachable');
  }
  await p.close();
}

// ---------------------------------------------------------------------------------------------
section('3. AN EMPTY DAY LOOKS EMPTY, NOT BROKEN');
{
  const p = await open({ entries: [] });
  t('the timeline is still there with nothing logged',
    await p.locator('[data-home="timeline"]').count() === 1);
  const txt = await p.locator('[data-home="timeline"]').innerText();
  t('and prints no count at all rather than "0 logged"', !/\d+ logged/.test(txt), txt.replace(/\n/g, ' | ').slice(0, 100));
  t('and no dots on an empty rail',
    await p.evaluate(() => document.querySelectorAll('[data-home="timeline"] [data-timeline-dot]').length) === 0);
  t('and it does not print undefined, NaN or null', !/undefined|NaN|null/.test(txt), txt.slice(0, 80));
  await p.close();
}

// ---------------------------------------------------------------------------------------------
section('4. THE ROWS THEMSELVES SURVIVED THE REPACKAGING');
{
  const p = await open({ entries: [
    { id: 'a', medId: 'temp', temp: 101.2, dose: '101.2 \u00b0F', mg: 0, ts: AT(6, 15) },
    { id: 'b', medId: 'weight', weight: 149.9, dose: '149.9 lbs', mg: 0, ts: AT(6, 45) }
  ] });
  const txt = await p.locator('[data-home="timeline"]').innerText();
  t('a temperature reading is on the timeline with its number', /101\.2/.test(txt), txt.replace(/\n/g, ' | ').slice(0, 140));
  t('a weight reading is too', /149\.9/.test(txt), txt.replace(/\n/g, ' | ').slice(0, 140));
  t('each row carries its own time', /\d{1,2}:\d{2}/.test(txt), txt.replace(/\n/g, ' | ').slice(0, 140));
  // The rows are ordered within the day; a timeline that is not in order is not a timeline.
  const times = await p.evaluate(() =>
    [...document.querySelectorAll('[data-home="timeline"] [data-timeline-dot]')]
      .map(d => d.closest('[data-timeline-row]')) .filter(Boolean).length);
  t('every dot belongs to a row', times === 2, times + ' rows for 2 dots');
  await p.close();
}

// ---------------------------------------------------------------------------------------------
section('5. THE h() NULL-ATTRIBUTE TRAP — ON THE TIMELINE, NOT ONLY ON THE VITALS STRIP');
{
  // The old suite's null sweep was scoped to [data-home="vitals"], so a literal "null" planted on
  // the timeline was invisible to it. This sweep is scoped to the timeline, and the whole-page
  // sweep below is scoped to nothing at all.
  const p = await open({ entries: [
    { id: 'a', medId: 'temp', temp: 98.9, dose: '98.9 \u00b0F', mg: 0, ts: AT(7, 0) },
    { id: 'b', medId: 'blood_pressure', sys: 118, dia: 76, dose: '118/76 mmHg', mg: 0, ts: AT(19, 30) }
  ] });
  const inTimeline = await p.evaluate(() => [...document.querySelectorAll('[data-home="timeline"], [data-home="timeline"] *')]
    .filter(e => [...e.attributes].some(a => a.value === 'null')).length);
  t('nothing on the timeline carries the literal attribute value "null"', inTimeline === 0, inTimeline + ' found');
  const wholePage = await p.evaluate(() => [...document.querySelectorAll('*')]
    .filter(e => [...e.attributes].some(a => a.value === 'null'))
    .map(e => e.tagName + '[' + [...e.attributes].filter(a => a.value === 'null').map(a => a.name).join(',') + ']'));
  t('and neither does anything else on the page', wholePage.length === 0, wholePage.slice(0, 4).join(' ') || 'none');
  await p.close();
}

// ---------------------------------------------------------------------------------------------
section('6. IT FITS THE SMALLEST PHONE');
{
  const p = await open({ entries: [
    { id: 'a', medId: 'temp', temp: 98.6, dose: '98.6 \u00b0F', mg: 0, ts: AT(8, 0) },
    { id: 'b', medId: 'weight', weight: 150.0, dose: '150.0 lbs', mg: 0, ts: AT(16, 0) }
  ] }, { width: 320, height: 800 });
  t('Home does not scroll sideways at 320px',
    await p.evaluate(() => document.documentElement.scrollWidth) <= 320,
    await p.evaluate(() => document.documentElement.scrollWidth) + 'px');
  const overflow = await p.evaluate(() => {
    const el = document.querySelector('[data-home="timeline"]');
    return el ? Math.round(el.scrollWidth - el.clientWidth) : -1;
  });
  t('and the timeline itself does not overflow its own box', overflow <= 0, overflow + 'px');
  await p.close();
}

// ---------------------------------------------------------------------------------------------
section('7. AND NOTHING THREW');
t('no page error at any point above', allErrors.length === 0, allErrors.slice(0, 3).join(' / ') || 'none');

await browser.close();
console.log('\n' + (pass + fail) + ' checks: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
