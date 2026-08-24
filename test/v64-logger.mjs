// app-v64 gate — the log: what went wrong, and what should be better.
//
// Aaron: "we were also going to build in a logger for errors or improvements. so many thing I've
// said has gotten lost." This app has no backend and no crash reporting, so until now a tester who
// hit a real error had one route: remember it, and describe it later from memory.
//
// The checks that matter most are the ones about the logger not becoming the fault: it must record
// a real thrown error without swallowing it, it must not fill its own storage when one error
// repeats every tick, it must never break the app when storage is full, and the file it produces
// must not contain a single medication, entry, appointment or note — because the whole point is
// that the person can send it to a stranger.
//
// Run: env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy node test/v64-logger.mjs
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
for (const v of ['HTTPS_PROXY','https_proxy','HTTP_PROXY','http_proxy'])
  if (process.env[v]) { console.error('REFUSING: ' + v + ' set.'); process.exit(3); }

const FILE = process.argv.includes('--file')
  ? process.argv[process.argv.indexOf('--file') + 1]
  : new URL('../index.html', import.meta.url).pathname;
const raw = fs.readFileSync(FILE, 'utf8');
// Read from the file under test, never typed in. This suite pinned the literal 'app-v64' and broke
// on the very next release -- the same anti-pattern that had already cost this project three
// patches, and the same one its CareTracker twin was fixed for a day earlier.
const APP_VER = (raw.match(/APP_VERSION\s*=\s*'([^']+)'/) || [])[1];
if (!APP_VER) { console.error('REFUSING: could not read APP_VERSION out of the file under test.'); process.exit(3); }

let fail = 0, pass = 0;
const t = (n, c, d) => { console.log((c ? '  PASS  ' : '  FAIL  ') + n + (d ? '  |  ' + String(d).replace(/\s+/g,' ').slice(0,220) : '')); c ? pass++ : fail++; };
const noise = (s) => /ERR_CERT_AUTHORITY_INVALID|ERR_TUNNEL|ERR_PROXY|cdn\.jsdelivr|Failed to load resource/i.test(s);

const at = new Date(); at.setHours(14, 0, 0, 0);
const i = raw.indexOf('function simNow() {');
const end = raw.indexOf('\n}', i);
const html = raw.slice(0, i) + 'function simNow() { return ' + at.getTime() + '; ' + raw.slice(end + 1);

const server = http.createServer((rq, rs) => {
  if (rq.url.startsWith('/index.html')) { rs.writeHead(200, {'Content-Type':'text/html'}); rs.end(html); return; }
  rs.writeHead(404); rs.end();
}).listen(0, '127.0.0.1');
await new Promise(r => server.once('listening', r));
const port = server.address().port, URL_ = 'http://127.0.0.1:' + port + '/index.html';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 360, height: 800 }, serviceWorkers: 'block' });
const page = await ctx.newPage();
const errs = [];
page.on('console', m => { if (m.type() === 'error' && !noise(m.text())) errs.push(m.text()); });
// The point of this feature is that a thrown error is still a thrown error. pageerror firing is
// EXPECTED here for the ones this suite raises on purpose, so they are counted, not treated as noise.
const pageErrs = [];
page.on('pageerror', e => { pageErrs.push(e.message); });

const SECRET_MED = 'Zofranium';
const SECRET_NOTE = 'zzzsecretnotetextzzz';

const skipGuide = async () => {
  const sk = page.getByRole('button', { name: 'Skip guide' });
  if (await sk.count()) { await sk.first().click(); await page.waitForTimeout(400); }
};
const openReport = async () => {
  await page.getByRole('button', { name: 'Open menu' }).click(); await page.waitForTimeout(320);
  const opened = await page.evaluate(async () => {
    const b = [...document.querySelectorAll('#app-drawer nav button')].find(x => /Report a problem/.test(x.textContent));
    if (b) { b.click(); return true; }
    const esc = document.querySelector('[aria-label="Close menu"]'); if (esc) esc.click();
    return false;
  });
  await page.waitForTimeout(650);
  return opened;
};
const logNow = () => page.evaluate(() => JSON.parse(localStorage.getItem('chemowell-app-log-v1') || '[]'));
const tapSel = (sel) => page.evaluate((s) => { const b = document.querySelector(s); if (b) { b.click(); return true; } return false; }, sel);
const typeInto = (sel, v) => page.evaluate(([s, vv]) => {
  const el = document.querySelector(s);
  if (!el) return false;
  const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, vv);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
}, [sel, v]);

await page.goto(URL_, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1800);
await page.fill('input[placeholder="Enter patient name"]', 'Alpha Patient');
await page.getByRole('button', { name: 'Female', exact: true }).click();
await page.getByRole('button', { name: 'Chemo', exact: true }).click();
await page.getByRole('button', { name: 'Get started' }).click();
await page.waitForTimeout(900);
await skipGuide();

console.log('\nTHE LOG — ChemoWell ' + APP_VER + '\n');

// ---- it is findable ----
const drawerHas = await page.evaluate(async () => {
  const b = [...document.querySelectorAll('button')].find(x => /Open menu/.test(x.getAttribute('aria-label') || ''));
  if (b) b.click();
  await new Promise(r => setTimeout(r, 400));
  const rows = [...document.querySelectorAll('#app-drawer nav button')].map(x => x.textContent);
  const idx = rows.findIndex(x => /Report a problem/.test(x));
  const helpIdx = rows.findIndex(x => /Help/.test(x));
  const esc = document.querySelector('[aria-label="Close menu"]'); if (esc) esc.click();
  await new Promise(r => setTimeout(r, 300));
  return { has: idx >= 0, afterHelp: idx === helpIdx + 1, rows: rows.length };
});
t('LOG-1 the menu has a way in, directly under Help',
  drawerHas.has && drawerHas.afterHelp,
  'a logger nobody can find is a logger nobody uses — ' + drawerHas.rows + ' menu rows');

await openReport();
t('LOG-2 the screen opens and offers both a problem and an idea',
  await page.evaluate(() => !!document.querySelector('[data-report-kind="problem"]') && !!document.querySelector('[data-report-kind="idea"]')),
  'Aaron asked for "errors or improvements" — both, not just crashes');

// ---- the person's side ----
await typeInto('#report-draft', 'The weight box would not take a decimal point.');
await page.waitForTimeout(200);
await tapSel('[data-report-save]');
await page.waitForTimeout(600);
let log = await logNow();
t('LOG-3 what the person types is written down',
  log.length === 1 && log[0].kind === 'problem' && /decimal point/.test(log[0].text) && log[0].app === APP_VER,
  JSON.stringify(log.map(e => e.kind)));

t('LOG-4 the box is emptied so the same report is not filed twice',
  await page.evaluate(() => { const el = document.querySelector('#report-draft'); return !!el && el.value === ''; }), 'draft cleared after saving');

await tapSel('[data-report-kind="idea"]');
await page.waitForTimeout(300);
await typeInto('#report-draft', 'Let me reorder the medication list.');
await page.waitForTimeout(200);
await tapSel('[data-report-save]');
await page.waitForTimeout(600);
log = await logNow();
t('LOG-5 an idea is kept as an idea, not filed as a fault',
  log.length === 2 && log[1].kind === 'idea', JSON.stringify(log.map(e => e.kind)));

const emptyBefore = (await logNow()).length;
await typeInto('#report-draft', '    ');
await page.waitForTimeout(200);
await tapSel('[data-report-save]');
await page.waitForTimeout(500);
t('LOG-6 an empty report is not recorded', (await logNow()).length === emptyBefore, 'blank submissions are noise in the one list that has to stay readable');

// ---- the app's side: a REAL thrown error, not a simulated call ----
const beforeErr = (await logNow()).length;
const errCountBefore = pageErrs.length;
await page.evaluate(() => { setTimeout(() => { throw new Error('deliberate-test-fault-alpha'); }, 0); });
await page.waitForTimeout(700);
log = await logNow();
const captured = log.filter(e => e.kind === 'error' && /deliberate-test-fault-alpha/.test(e.text));
t('LOG-7 a genuinely thrown error records itself, with no code asking it to',
  captured.length === 1, 'entries went ' + beforeErr + ' -> ' + log.length);
t('LOG-8 recording it does not swallow it',
  pageErrs.length > errCountBefore && pageErrs.some(m => /deliberate-test-fault-alpha/.test(m)),
  'a logger that eats the error hides it from the console and from every other tool');

const rejBefore = (await logNow()).filter(e => e.kind === 'error').length;
await page.evaluate(() => { Promise.reject(new Error('deliberate-test-rejection-beta')); });
await page.waitForTimeout(700);
log = await logNow();
t('LOG-9 an unfinished background task is recorded too',
  log.filter(e => /deliberate-test-rejection-beta/.test(e.text)).length === 1,
  'errors went ' + rejBefore + ' -> ' + log.filter(e => e.kind === 'error').length +
  ' — most real failures in this app are inside an await, where window.onerror never fires');

// ---- the logger must not become the fault ----
const flood = await page.evaluate(async () => {
  const before = JSON.parse(localStorage.getItem('chemowell-app-log-v1') || '[]').length;
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(() => { try { throw new Error('repeating-render-fault'); } catch (e) { window.dispatchEvent(new ErrorEvent('error', { message: e.message, error: e })); } r(); }, 0));
  }
  const after = JSON.parse(localStorage.getItem('chemowell-app-log-v1') || '[]');
  const rep = after.filter(e => /repeating-render-fault/.test(e.text));
  return { grew: after.length - before, rows: rep.length, count: rep.length ? rep[0].count : 0 };
});
t('LOG-10 one error repeating forty times is one entry, counted',
  flood.rows === 1 && flood.count === 40 && flood.grew === 1,
  'rows=' + flood.rows + ' count=' + flood.count + ' — a render error fires every tick, and without this it evicts every other entry within seconds');

const capped = await page.evaluate(async () => {
  for (let i = 0; i < 140; i++) window.dispatchEvent(new ErrorEvent('error', { message: 'distinct-fault-' + i }));
  await new Promise(r => setTimeout(r, 400));
  const l = JSON.parse(localStorage.getItem('chemowell-app-log-v1') || '[]');
  return { n: l.length, hasNewest: l.some(e => /distinct-fault-139/.test(e.text)), hasOldest: l.some(e => /distinct-fault-0\b/.test(e.text)) };
});
t('LOG-11 the list is capped, and it is the OLDEST that goes',
  capped.n <= 100 && capped.hasNewest && !capped.hasOldest,
  'n=' + capped.n + ' newest kept=' + capped.hasNewest + ' oldest dropped=' + capped.hasOldest);

// This one is here because the first build of the feature failed it. A flood of errors used to
// evict the person's own description of the fault they were reporting -- the half nobody can
// reconstruct afterwards -- leaving only the machine's account of an event that already had a
// human one.
const minePreserved = await page.evaluate(() => {
  const l = JSON.parse(localStorage.getItem('chemowell-app-log-v1') || '[]');
  const mine = l.filter(e => e.kind !== 'error');
  return { n: l.length, mine: mine.length, texts: mine.map(e => e.text).join(' | ') };
});
t('LOG-11b 180 errors do not evict what the person wrote',
  minePreserved.mine === 2 && /decimal point/.test(minePreserved.texts) && /reorder the medication list/.test(minePreserved.texts),
  'kept ' + minePreserved.mine + ' of the 2 written reports through ' + minePreserved.n + ' stored entries');

const survivesFullDisk = await page.evaluate(async () => {
  const real = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k) { if (k === 'chemowell-app-log-v1') { const e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e; } return real.apply(this, arguments); };
  let threw = false;
  try { window.dispatchEvent(new ErrorEvent('error', { message: 'fault-while-storage-is-full' })); }
  catch (e) { threw = true; }
  Storage.prototype.setItem = real;
  await new Promise(r => setTimeout(r, 200));
  return { threw: threw, alive: !!document.querySelector('[data-report-kind="problem"]') };
});
t('LOG-12 a full phone does not turn one error into a broken app',
  survivesFullDisk.threw === false && survivesFullDisk.alive === true,
  'the logger writes on the error path, which is exactly when storage is most likely to be gone');

// ---- what is on screen ----
await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1600);
await skipGuide();
await openReport();
t('LOG-13 the record survives a restart',
  await page.evaluate(() => !!document.querySelector('[data-log-errors]') && !!document.querySelector('[data-log-mine]')),
  'a fault seen last night has to still be describable this morning');

t('LOG-14 a long list is collapsed rather than dumped on the screen',
  await page.evaluate(() => {
    const shown = document.querySelectorAll('[data-log-errors] [data-log-entry]').length;
    return shown <= 3 && !!document.querySelector('[data-log-more]');
  }), 'three at a time, with a way to see the rest');

await tapSel('[data-log-more]');
await page.waitForTimeout(500);
t('LOG-15 the rest are one tap away',
  await page.evaluate(() => document.querySelectorAll('[data-log-errors] [data-log-entry]').length > 3), 'expanded');

// ---- the file ----
await page.evaluate(([med, note]) => {
  const ps = JSON.parse(localStorage.getItem('chemowell-app-profiles-v1') || 'null');
  const p = ps.activeId;
  const K = (s) => 'chemowell-app-p-' + p + '-' + s;
  localStorage.setItem(K('notes-v1'), JSON.stringify([{ id: 'n1', text: note, ts: Date.now() }]));
  localStorage.setItem(K('med-v1'), JSON.stringify({ version: 1, archivedMeds: {}, meds: [{ id: 'z', name: med, doses: [{ label: '8 mg', mg: 8 }] }] }));
}, [SECRET_MED, SECRET_NOTE]);
await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1600);
await skipGuide();
await openReport();
await page.evaluate(() => {
  Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
  Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });
});
const report = await page.evaluate(async () => {
  let captured = null, name = null;
  const realCreate = URL.createObjectURL;
  URL.createObjectURL = function (b) { captured = b; return realCreate.call(URL, b); };
  const realClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () { if (this.download) name = this.download; return realClick.call(this); };
  const b = document.querySelector('[data-report-file]');
  if (b) b.click();
  await new Promise(r => setTimeout(r, 1600));
  URL.createObjectURL = realCreate;
  HTMLAnchorElement.prototype.click = realClick;
  return { text: captured ? await captured.text() : null, name: name };
});
t('LOG-16 it produces a file that can actually be sent',
  !!report.text && /\.txt$/.test(report.name || ''), 'filename: ' + report.name);
t('LOG-17 the file says which build and which device it came from',
  !!report.text && report.text.indexOf('App version: ' + APP_VER) >= 0 && /Device: /.test(report.text),
  'a bug report without a version number is a guess');
t('LOG-18 both the errors and what the person wrote are in it',
  !!report.text && /decimal point/.test(report.text) && /reorder the medication list/.test(report.text) &&
  /THE APP NOTICED/.test(report.text) && /YOU REPORTED/.test(report.text) && /YOUR IDEA/.test(report.text),
  'the two halves of the same story — named, so whoever reads the file can tell them apart');
t('LOG-19 not one medication, note or entry is in the file',
  !!report.text && !report.text.includes(SECRET_MED) && !report.text.includes(SECRET_NOTE),
  'this file is meant to be sent to a stranger — searched it for a medication name and a note');
t('LOG-20 and the file says so, in words the sender can check',
  !!report.text && /does NOT/i.test(report.text) && /medications/.test(report.text),
  'a promise the person can verify by opening the file beats one they have to take on trust');

// ---- clearing ----
await tapSel('[data-report-clear]');
await page.waitForTimeout(400);
const stillThere = (await logNow()).length;
await tapSel('[data-report-clear]');
await page.waitForTimeout(600);
t('LOG-21 erasing the list takes two taps, not one',
  stillThere > 0 && (await logNow()).length === 0,
  'first tap armed it (' + stillThere + ' entries still there), second erased');

t('LOG-22 no console errors beyond the ones this suite threw on purpose',
  errs.filter(e => !/deliberate-test|repeating-render-fault|distinct-fault|fault-while-storage/.test(e)).length === 0,
  errs.slice(0, 3).join(' || '));

console.log('\n  ' + pass + ' passed, ' + fail + ' failed\n');
await browser.close(); server.close();
process.exit(fail ? 1 : 0);
