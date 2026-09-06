/**
 * v71-report-controls.mjs — the report screens must be able to do the whole job.
 *
 * Aaron, 2026-09-06: "we probably need to make sure the same applies to chemowell where allowed."
 *
 * app-v71 adds an add row to Paracentesis, Weight and Radiation, and Edit to paracentesis rows.
 *
 * THREE CHECKS HERE EXIST BECAUSE care-tracker GOT THEM WRONG FIRST, in the sibling release four
 * hours earlier:
 *
 *   1. EDITING MUST SUPERSEDE, NOT DUPLICATE. A paracentesis edit writes a new record carrying the
 *      SAME paraId. Get it wrong and correcting "45 L" to "4.5 L" leaves BOTH on screen -- a
 *      fluid-balance record showing a drain that never happened. So the row COUNT is asserted as
 *      well as the value: asserting the new value alone passes just as happily on a build that
 *      duplicated.
 *   2. WEIGHT IS TESTED WITH READINGS SEEDED. care-tracker v66 shipped its Weight add row visible
 *      only when there were NO readings -- exactly backwards, invisible on a real device -- and its
 *      suite went green because it tested the empty state. Whichever state a real device is in is
 *      the state the test has to be in.
 *   3. THE PARACENTESIS MODAL MUST NOT BORROW ANOTHER TYPE'S TITLE. app-v70's title chain ended on
 *      a bare `else` that assumed weight, so the paracentesis dialog was headed
 *      "Log Weight · undefined". care-tracker hit the same bug and Aaron reported it as a MISSING
 *      DATE FIELD, because who would trust that dialog.
 *
 * Run: env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy node test/v71-report-controls.mjs
 *      --file <path>   to point at a scratch copy during falsification
 */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = (() => {
  const _p = require('node:path');
  const tries = ['playwright',
    _p.join(_p.dirname(process.execPath), '..', 'lib', 'node_modules', 'playwright'),
    '/opt/node22/lib/node_modules/playwright'];
  for (const c of tries) { try { return require(c); } catch (e) {} }
  throw new Error('playwright not found');
})();
const argv = process.argv.slice(2);
const APP_FILE = argv.indexOf('--file') >= 0 ? argv[argv.indexOf('--file') + 1]
                                             : new URL('../index.html', import.meta.url).pathname;
const rawHtml = fs.readFileSync(APP_FILE, 'utf8');
for (const v of ['HTTPS_PROXY','https_proxy','HTTP_PROXY','http_proxy'])
  if (process.env[v]) { console.error('REFUSING: ' + v + ' set.'); process.exit(3); }

let fail = 0;
const t = (name, cond, detail) => {
  console.log((cond ? 'PASS  ' : 'FAIL  ') + name + (detail ? '  |  ' + detail : ''));
  if (!cond) fail++;
};

const P = 'chemowell-app-p-p1-';
// Local noon, so a fixture seeded at a multiple of 24h does not cross a day boundary on a run that
// spans midnight and fail at the fixture with nothing wrong with the app.
const NOON = (() => { const d = new Date(); d.setHours(12, 0, 0, 0); return d.getTime(); })();
const DAY = 86400000;
const SEED_ENTRIES = [
  { id: 'p1', medId: 'paracentesis', paraId: 'para_a', liters: 4.5, dose: '4.5 L', mg: 0, ts: NOON - 3 * DAY, loggedAt: NOON - 3 * DAY },
  // See note 2 above: weights are seeded ON PURPOSE so the populated path is the one under test.
  { id: 'w1', medId: 'weight', weight: 156.2, dose: '156.2 lbs', mg: 0, ts: NOON - 2 * DAY },
  { id: 'w2', medId: 'weight', weight: 154.8, dose: '154.8 lbs', mg: 0, ts: NOON - 9 * DAY },
  // RADIATION SESSIONS ARE SEEDED FOR THE SAME REASON THE WEIGHTS ARE, and the first version of
  // this file forgot. With none seeded the Radiation check only ever reached the EMPTY-state
  // return, so deleting addRow from the populated return -- `return [addRow, summary, list]` --
  // left this suite 15/15 green. That is care-tracker v66's exact defect (a control visible only
  // when there is nothing to show) on the very screen this release adds the control to. The
  // Weight lesson had been learned and then not carried one screen to the right.
  { id: 'r1', medId: 'radiation_session', dose: null, mg: 0, ts: NOON - 4 * DAY },
  { id: 'r2', medId: 'radiation_session', dose: null, mg: 0, ts: NOON - 1 * DAY }
];
// treatmentType 'both', NOT 'chemo'. The Radiation report is filtered out of reportTypes unless
// hasRadiation() is true ('radiation' or 'both'), so a chemo-only fixture makes the Radiation check
// report a missing control on a build where the control is present and correct. The suite was
// wrong, not the app -- and a report that only exists for the patients it applies to is the app
// behaving properly.
const SEED_PREFS = { patientName: 'Test Patient', sex: 'female', treatmentType: 'both',
  tourDone: true, ceilingMg: 2500, tempUnit: 'Fahrenheit', weightUnit: 'lbs' };

const server = http.createServer((rq, rs) => {
  if (rq.url.startsWith('/index.html')) { rs.writeHead(200, { 'Content-Type': 'text/html' }); rs.end(rawHtml); return; }
  rs.writeHead(204); rs.end();
}).listen(0, '127.0.0.1');
await new Promise(r => server.once('listening', r));
const URL_ = 'http://127.0.0.1:' + server.address().port + '/index.html';

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
await ctx.route('**/*', route => {
  const u = route.request().url();
  if (u.startsWith('http://127.0.0.1:' + server.address().port)) return route.continue();
  if (u.includes('cdn.jsdelivr.net')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: '/* stubbed */' });
  return route.abort();
});
const page = await ctx.newPage();
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e)));
// Seed once, not on every navigation: Playwright replays init scripts on each load.
await page.addInitScript(([p, entries, prefs]) => {
  if (localStorage.getItem(p + 'entries-v1')) return;
  localStorage.setItem(p + 'entries-v1', JSON.stringify(entries));
  localStorage.setItem(p + 'prefs-v1', JSON.stringify(prefs));
}, [P, SEED_ENTRIES, SEED_PREFS]);
await page.goto(URL_, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1800);

const reachedHome = await page.evaluate(() => !!document.querySelector('[data-tour="nav-home"]') || document.querySelectorAll('button').length > 5);
t('the app got past first-run setup with the fixture seeded', reachedHome);
if (!reachedHome) { await browser.close(); server.close(); console.log('\nFAILED'); process.exit(1); }

const clickText = (re) => page.evaluate((src) => {
  const rx = new RegExp(src, 'i');
  const b = [...document.querySelectorAll('button')].find(x => rx.test((x.innerText || '').trim()));
  if (b) { b.click(); return true; }
  return false;
}, re.source);
const modalOpen = () => page.evaluate(() => !!document.querySelector('[role="dialog"]'));
const modalTitle = () => page.evaluate(() => {
  const d = document.querySelector('[role="dialog"]');
  return d ? (d.getAttribute('aria-label') || '') : '';
});
// CONFIRM AND PROVE IT CLOSED. A helper that cannot tell success from failure moves the error
// rather than finding it -- a silently-open modal swallows every later click and the suite then
// dies far from the real cause.
const confirmModal = async (where) => {
  await clickText(/^Confirm$/);
  for (let i = 0; i < 30 && await modalOpen(); i++) await page.waitForTimeout(100);
  if (await modalOpen()) throw new Error('modal did not close after Confirm at: ' + where);
  await page.waitForTimeout(400);
};
const openReport = async (label) => {
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /^Reports/.test((x.innerText||'').trim())); if (b) b.click(); });
  await page.waitForTimeout(600);
  await page.evaluate((l) => { const b = [...document.querySelectorAll('button')].find(x => (x.innerText||'').trim().startsWith(l)); if (b) b.click(); }, label);
  await page.waitForTimeout(700);
};
const back = async () => { await clickText(/Back/); await page.waitForTimeout(500); };
const paraRows = () => page.evaluate(() => document.querySelectorAll('[data-para-edit]').length);

console.log('\n1. Paracentesis — the screen that could delete but not add');
await openReport('Paracentesis');
{
  const box = await page.$('[data-para-report-add]');
  t('an add control exists on the Paracentesis report', !!box, box ? '' : 'no [data-para-report-add]');
  const before = await paraRows();
  if (box) {
    await box.fill('2.5');
    await page.evaluate(() => {
      const inp = document.querySelector('[data-para-report-add]');
      const btn = inp && inp.parentElement && [...inp.parentElement.querySelectorAll('button')].find(b => /^Log$/.test((b.innerText||'').trim()));
      if (btn) btn.click();
    });
    await page.waitForTimeout(600);
    t('logging from the report opens the date step', await modalOpen(), '');
    // See note 3: app-v70 headed this dialog "Log Weight · undefined".
    const title = await modalTitle();
    t('the dialog is titled for a paracentesis, not a weight', /Paracentesis/i.test(title) && !/Weight/i.test(title), title);
    await confirmModal('para-add');
  }
  const after = await paraRows();
  t('the new procedure is on the list', after === before + 1, before + ' -> ' + after);
}

console.log('\n2. Editing a paracentesis supersedes it — it must not appear twice');
{
  const before = await paraRows();
  t('there was a record to edit in the first place', before > 0, before + ' row(s)');
  await page.evaluate(() => { const b = document.querySelector('[data-para-edit]'); if (b) b.click(); });
  await page.waitForTimeout(600);
  const litres = await page.$('[data-para-edit-liters]');
  t('the edit step lets the liters be corrected', !!litres, litres ? '' : 'no liters field in the edit dialog');
  const title = await modalTitle();
  t('the edit dialog says Edit', /Edit Paracentesis/i.test(title), title);
  if (litres) { await litres.fill('7.5'); await confirmModal('para-edit'); }
  const after = await paraRows();
  // BOTH halves. The value alone would pass on a build that duplicated.
  t('the record count is unchanged after an edit', before > 0 && after === before, before + ' -> ' + after);
  const shown = await page.evaluate(() =>
    [...document.querySelectorAll('[data-para-edit]')].map(b => b.closest('div').parentElement.innerText).join(' | '));
  t('the corrected volume is the one displayed', /7\.5 L/.test(shown), shown.replace(/\n/g, ' ').slice(0, 80));
}

console.log('\n3. Weight — tested WITH readings, the state a real device is in');
{
  await back();
  await openReport('Weight');
  const box = await page.$('[data-weight-report-add]');
  const populated = await page.evaluate(() => [...document.querySelectorAll('button')].some(b => /^Weeks$/.test((b.innerText||'').trim())));
  t('the Weight report is showing its populated view', populated, populated ? '' : 'no Weeks/Months toggle - still the empty state');
  t('an add control exists on the Weight report with readings', !!box && populated, box ? '' : 'no [data-weight-report-add]');
}

console.log('\n4. Radiation — the screen that had no controls at all');
{
  await back();
  await openReport('Radiation');
  // PROVE WHICH PATH WE ARE ON, exactly as the Weight check does. Without this the check cannot
  // tell the populated return from the empty one, and a control that appears only when there is
  // nothing to show passes it.
  //
  // SCOPED TO <main>, NOT document.body. This is a single-file app: the source is inside body, so
  // a body-text test matches the app's own code and can never go red.
  const populated = await page.evaluate(() => {
    const el = document.querySelector('main') || document.getElementById('root');
    const txt = el ? (el.innerText || '') : '';
    return txt.length > 0 && !/No radiation sessions logged yet/i.test(txt);
  });
  t('the Radiation report is showing its populated view', populated, populated ? '' : 'still the empty state');
  const btn = await page.$('[data-report-add-btn]');
  t('an add control exists on the Radiation report', !!btn && populated, btn ? '' : 'no [data-report-add-btn]');
  if (btn) {
    // RE-QUERY IMMEDIATELY BEFORE CLICKING. A handle held across the app's 1s tick detaches from
    // the DOM and the click throws "Element is not attached" -- which reads like a missing control
    // rather than a stale reference.
    await page.evaluate(() => { const b = document.querySelector('[data-report-add-btn]'); if (b) b.click(); });
    await page.waitForTimeout(600);
    t('it opens the session dialog', await modalOpen(), '');
    await clickText(/^Cancel$/);
    await page.waitForTimeout(400);
  }
}

console.log('\n5. Nothing broke on the way');
t('no page errors', pageErrors.length === 0, pageErrors.join(' / ').slice(0, 200));

await browser.close(); server.close();
console.log('\n' + (fail ? fail + ' FAILED' : 'all checks passed'));
process.exit(fail ? 1 : 0);
