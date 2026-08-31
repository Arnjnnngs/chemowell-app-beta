// REMOVING ONE TREATMENT DATE, DRIVEN THROUGH THE REAL RENDERED APP.
//
// test/v70-remove-one-date.mjs pins the LOGIC (it lifts removeChemoDate into a VM and checks the
// entries it writes). That suite cannot see the wiring: a Remove button that is never rendered, or
// rendered without its onClick, passes it at 12/12. The temporal-dead-zone bug that silently wiped
// every saved medication was green in four unit suites for the same reason -- they never run module
// init and never render. So this one clicks the actual button in an actual browser and reads the
// actual screen back.
//
// Run: env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy node test/v70-remove-one-date-browser.mjs
//      --file <path>   optional, to point at a sabotaged copy during falsification
import http from 'node:http';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
// Same candidate list as the other browser suites: a pinned playwright path made every browser
// suite in this repo unrunnable the last time the environment moved.
const { chromium } = (() => {
  const _p = require('node:path');
  const tries = ['playwright',
    _p.join(_p.dirname(process.execPath), '..', 'lib', 'node_modules', 'playwright'),
    '/opt/node22/lib/node_modules/playwright',
    '/home/claude/.npm-global/lib/node_modules/playwright'];
  for (const c of tries) { try { return require(c); } catch (e) {} }
  throw new Error('playwright not found; tried:\n  ' + tries.join('\n  '));
})();

const argv = process.argv.slice(2);
const APP_FILE = argv.indexOf('--file') >= 0 ? argv[argv.indexOf('--file') + 1]
                                             : new URL('../index.html', import.meta.url).pathname;
const rawHtml = fs.readFileSync(APP_FILE, 'utf8');

let fail = 0;
const t = (name, cond, detail) => {
  console.log((cond ? 'PASS  ' : 'FAIL  ') + name + (detail ? '  |  ' + detail : ''));
  if (!cond) fail++;
};

const P = 'chemowell-app-p-p1-';
// Local noon, for the same reason the overflow scan uses it: a date seeded at an exact multiple of
// 24h from "now" crosses a day boundary on a run that spans midnight, and the suite then fails at
// the fixture with nothing wrong with the app.
const NOON = (() => { const d = new Date(); d.setHours(12, 0, 0, 0); return d.getTime(); })();
const DAY = 86400000;
const D1 = NOON - 10 * DAY, D2 = NOON - 3 * DAY, D3 = NOON + 4 * DAY;
const SEED_ENTRIES = [
  { id: 'c1', medId: 'chemo_date', dose: 'Treatment scheduled', mg: 0, ts: D1, loggedAt: D1 },
  { id: 'c2', medId: 'chemo_date', dose: 'Treatment scheduled', mg: 0, ts: D2, loggedAt: D1 + 1000 },
  { id: 'c3', medId: 'chemo_date', dose: 'Treatment scheduled', mg: 0, ts: D3, loggedAt: D1 + 2000 }
];
const SEED_PREFS = { patientName: 'Test Patient', sex: 'female', treatmentType: 'chemo',
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
// SEED ONCE, NOT ON EVERY NAVIGATION. Playwright replays an init script on each load, including
// page.reload() -- so the first version of this file wrote the original three dates back over the
// removal and then reported that the removal had not survived a reload. The app was fine; the
// suite was re-seeding behind its own check. Guarding on the key makes the fixture behave like a
// device that already has data on it, which is what the reload check is actually about.
await page.addInitScript(([p, entries, prefs]) => {
  if (localStorage.getItem(p + 'entries-v1')) return;
  localStorage.setItem(p + 'entries-v1', JSON.stringify(entries));
  localStorage.setItem(p + 'prefs-v1', JSON.stringify(prefs));
}, [P, SEED_ENTRIES, SEED_PREFS]);
await page.goto(URL_, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1600);

// The fixture has to have taken, or every check below is measuring a first-run setup screen.
const reachedHome = await page.evaluate(() => !!document.querySelector('[data-tour="nav-home"]'));
t('the app got past first-run setup with the fixture seeded', reachedHome);
if (!reachedHome) { await browser.close(); server.close(); console.log('\n1 or more FAILED'); process.exit(1); }

const listed = () => page.evaluate(() =>
  [...document.querySelectorAll('[data-chemo-list] [data-chemo-remove]')].map(b => Number(b.getAttribute('data-chemo-remove'))));
const dayStart = ts => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };

const before = await listed();
t('all three treatment dates are on screen, each with its own Remove',
  before.length === 3 && before[0] === dayStart(D1) && before[1] === dayStart(D2) && before[2] === dayStart(D3),
  before.map(x => new Date(x).toDateString()).join(' | '));
// Oldest first, so a caregiver reads the schedule in the order it happens rather than in the order
// it was typed.
t('the list is in date order, oldest first', before.join() === [...before].sort((a, b) => a - b).join());

const tapTargets = await page.evaluate(() =>
  [...document.querySelectorAll('[data-chemo-list] [data-chemo-remove]')].map(b => Math.round(b.getBoundingClientRect().height)));
t('every Remove button clears the 44px iOS tap-target floor', tapTargets.every(h => h >= 44), tapTargets.join('px, ') + 'px');

// Remove the MIDDLE date. The ends are the easy cases; a filter that is off by one, or a rebuild
// that drops everything after the removed entry, only shows up in the middle.
const clickedD2 = await page.evaluate(target => {
  const b = document.querySelector('[data-chemo-remove="' + target + '"]');
  if (!b) return false; b.click(); return true;
}, dayStart(D2));
t('the middle date has a Remove button to click', clickedD2);
await page.waitForTimeout(1200);

const after = await listed();
t('the removed date is gone', !after.includes(dayStart(D2)), after.map(x => new Date(x).toDateString()).join(' | '));
t('the two dates that were not removed are still there',
  after.length === 2 && after.includes(dayStart(D1)) && after.includes(dayStart(D3)));

// PERSISTENCE, not just the screen. The store is append-only and this removal is a tombstone
// followed by re-adds; a reload replays the whole log, so a wrong loggedAt ordering shows up here
// and nowhere else -- the tombstone landing after its own re-adds would wipe the schedule on the
// next launch while the screen looked right until then.
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1600);
const afterReload = await listed();
t('the removal survives a reload', afterReload.join() === after.join(),
  afterReload.map(x => new Date(x).toDateString()).join(' | '));

// NO NEW ENTRY SHAPE. A backup taken now can be restored into an older build, which knows only
// "ts > 0 = a date to add" and "ts === 0 = clear everything". Anything else -- a negative ts, a new
// medId -- would be read as a treatment date in 1970 and drive real medication rules from it.
const shapes = await page.evaluate(p => {
  const rows = JSON.parse(localStorage.getItem(p + 'entries-v1') || '[]').filter(e => e.medId === 'chemo_date');
  return { count: rows.length, negatives: rows.filter(e => Number(e.ts) < 0).length,
           medIds: [...new Set(rows.map(e => e.medId))] };
}, P);
t('no chemo_date entry carries a negative timestamp', shapes.negatives === 0, JSON.stringify(shapes));
t('removal invented no new medId', shapes.medIds.join() === 'chemo_date');
t('the removal appended entries rather than editing the log in place', shapes.count > SEED_ENTRIES.length,
  shapes.count + ' rows from ' + SEED_ENTRIES.length + ' seeded');

// Down to one date: the list hides itself (one date is already named in the headline above it) but
// the date it holds must still be on the schedule, not quietly removed with the list.
// Clicked through a check rather than directly: under a broken app the button is simply absent, and
// an unguarded .click() on null threw an uncaught TypeError that killed the run half way down the
// list -- the suite ended in a stack trace instead of naming what was wrong, which is the same
// class of failure as a gate that cannot start.
const clickedD1 = await page.evaluate(target => {
  const b = document.querySelector('[data-chemo-remove="' + target + '"]');
  if (!b) return false; b.click(); return true;
}, dayStart(D1));
t('the Remove button for the remaining older date is still there to click', clickedD1);
await page.waitForTimeout(1200);
const one = await listed();
t('with a single date left the per-date list steps aside', one.length === 0);
const headline = await page.evaluate(() => document.body.innerText);
const d3Label = new Date(dayStart(D3)).toLocaleDateString([], { weekday: 'long', month: 'numeric', day: 'numeric' });
t('the surviving date is still shown as the treatment schedule', headline.includes(d3Label), d3Label);

t('the app logged no errors while doing any of this', pageErrors.length === 0, pageErrors.join(' / '));

await browser.close();
server.close();
console.log('\n' + (fail ? fail + ' FAILED' : 'all checks passed'));
process.exit(fail ? 1 : 0);
