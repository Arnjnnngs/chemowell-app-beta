// v94-window-coverage.mjs — HAS THIS DOSE BEEN GIVEN? ONE ANSWER, OR THE APP ASKS TWICE.
//
// Aaron, 2026-11-06, screenshot of his own Home screen: "I just logged my medication for the 5:00
// round and it still shows me to log it." He had logged it at about 4:45. The card kept asking.
//
// The app held THREE answers to "has this window been covered" and two were wrong:
//   missedDosesFor    -- the correct one, fixed in v68 after Aaron reported the mirror image
//                        (a LATE dose still flagged missed). Its comment says early logs count.
//   status()          -- `e.ts >= windowStart && e.ts < windowEnd`. 16:45 is not in [17:00,21:00),
//                        so the Home card and the Up next hero asked for a dose already given.
//   doseProgressToday -- counted ENTRIES capped at the window count, so two doses in one window
//                        read as two windows done: "4/4 DOSES" beside "Due now".
//
// This suite drives the RENDERED Home screen, not the functions in isolation: the defect was only
// ever visible as two parts of one screen contradicting each other, and a unit test on either half
// alone would have passed throughout.
//
// Run: env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy node test/v94-window-coverage.mjs
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = (() => {
  const _p = require('node:path');
  for (const c of ['playwright', '/opt/node-tools/node_modules/playwright',
    _p.join(_p.dirname(process.execPath), '..', 'lib', 'node_modules', 'playwright'),
    '/opt/node22/lib/node_modules/playwright']) { try { return require(c); } catch (e) {} }
  throw new Error('playwright not found');
})();
for (const v of ['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy'])
  if (process.env[v]) { console.log('  FAIL  ' + v + ' is set'); console.error('REFUSING: ' + v + ' is set.'); process.exit(3); }

const argv = process.argv.slice(2);
const arg = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const BASE_IN = process.env.FALSIFY_BASE || arg('--base');
const APP_FILE = arg('--file') || new URL('../index.html', import.meta.url).pathname;

// Frozen at 17:03 with the context pinned to UTC: the suite's idea of "now" must not depend on the
// host's zone. v90-chart-axes was red one hour a day on correct code for exactly that reason.
const FROZEN = Date.UTC(2026, 10, 6, 17, 3, 0);
const D0 = Date.UTC(2026, 10, 6, 0, 0, 0);
const H = (h, m) => D0 + h * 3600000 + (m || 0) * 60000;
const freeze = `(() => { const F = ${FROZEN}; const R = Date;
  function D(...a) { return a.length ? new R(...a) : new R(F); }
  D.prototype = R.prototype; D.now = () => F; D.UTC = R.UTC; D.parse = R.parse;
  Object.setPrototypeOf(D, R); window.Date = D; })()`;

// `type: 'win'` IS THE INGREDIENT. normalizeMedication DERIVES `alerts` from it and discards a
// stored alerts:true; without it a medication renders a perfect card and is never "due" at all.
const win = (windows) => ({ id: 'bp2', name: 'Blood pressure dose 2', type: 'win', schemaV: 2,
  quickLog: true, doses: [{ label: '10 mg', mg: 10 }], windows });
const EVENING = [{ start: 17, end: 21, name: 'Daily' }];
const TWO = [{ start: 8, end: 12, name: 'Morning' }, { start: 17, end: 21, name: 'Daily' }];
const dose = (id, ts) => ({ id, medId: 'bp2', dose: '10 mg', ts });

let server = null, BASE = BASE_IN;
if (!BASE) {
  const root = path.dirname(APP_FILE);
  server = http.createServer((req, res) => {
    const f = path.join(root, decodeURIComponent(req.url.split('?')[0]) === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
    fs.readFile(f, (e, data) => {
      if (e) { res.writeHead(404); res.end('no'); return; }
      const ext = path.extname(f);
      res.writeHead(200, { 'Content-Type': ext === '.html' ? 'text/html' : ext === '.js' ? 'text/javascript' : 'application/octet-stream' });
      res.end(data);
    });
  }).listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  BASE = 'http://127.0.0.1:' + server.address().port + '/index.html';
}

const fails = [];
let checks = 0;
const ok = (label, cond, detail) => {
  checks++;
  if (cond) { console.log('  ok    ' + label); return true; }
  fails.push(label + (detail ? ' — ' + detail : ''));
  console.log('  FAIL  ' + label + (detail ? ' — ' + detail : ''));
  return false;
};

const b = await chromium.launch();
const noise = [];
async function home(meds, entries) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, timezoneId: 'UTC' });
  await ctx.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith('http://127.0.0.1')) return route.continue();
    if (u.includes('cdn.jsdelivr.net')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: '/* stubbed */' });
    return route.abort();
  });
  ctx.on('page', (p) => p.on('console', (m) => {
    if (m.type() !== 'error' && m.type() !== 'warning') return;
    const t = m.text();
    if (t.includes('Service Worker registration blocked by Playwright')) return;
    noise.push(m.type() + ': ' + t);
  }));
  await ctx.addInitScript(freeze);
  const page = await ctx.newPage();
  await page.addInitScript(`(() => {
    const P = 'chemowell-app-p-p1-';
    localStorage.setItem('chemowell-app-profiles-v1', JSON.stringify({ list: [{ id: 'p1', name: 'Aaron', createdAt: 1 }], activeId: 'p1' }));
    localStorage.setItem('chemowell-app-license-v1', JSON.stringify({ tier: 'free' }));
    localStorage.setItem(P + 'prefs-v1', JSON.stringify({ patientName: 'Aaron', onboarded: true, treatmentType: 'chemo', tourDone: true }));
    localStorage.setItem(P + 'med-v1', JSON.stringify({ version: 2, archivedMeds: {}, meds: ${JSON.stringify(meds)} }));
    localStorage.setItem(P + 'entries-v1', JSON.stringify(${JSON.stringify(entries)}));
  })()`);
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(1100);
  const r = await page.evaluate(() => {
    const hero = document.querySelector('[data-home="up-next"]');
    const ring = hero ? hero.querySelector('[aria-label*="scheduled doses logged"]') : null;
    const all = document.body.innerText || '';
    return {
      hasHero: !!hero,
      due: !!hero && /Due now/.test(hero.textContent),
      ring: ring ? ring.getAttribute('aria-label') : null,
      // Read off the "all scheduled doses are in" panel by its words, which is the only thing that
      // distinguishes it; it carries no data- hook of its own and adding one is not this fix's job.
      allIn: /All scheduled doses are in/.test(all)
    };
  });
  await ctx.close();
  return r;
}

// ---- THE REPORTED BUG ------------------------------------------------------------------------
{
  const r = await home([win(EVENING)], [dose('a', H(16, 45))]);
  ok('a dose logged 15 minutes early stops the card asking for it', !r.due && r.allIn,
    JSON.stringify(r));
}
{
  // The far side of the grace: 2 hours is the bound, so 2h01m before is NOT this window's dose.
  // Without this the grace could be widened to the whole day and every check above still passes.
  const r = await home([win(EVENING)], [dose('a', H(14, 59))]);
  ok('a dose logged more than two hours early does NOT cover the window', r.due,
    JSON.stringify(r));
}
{
  const r = await home([win(EVENING)], [dose('a', H(17, 1))]);
  ok('a dose logged inside the window still clears it', !r.due && r.allIn, JSON.stringify(r));
}

// ---- THE RING AND THE CARD MUST AGREE ---------------------------------------------------------
{
  // Two windows, BOTH of the day's doses logged into the first. The evening window is genuinely
  // still due, and the ring must say one of two -- not two of two, which is what shipped.
  const r = await home([win(TWO)], [dose('a', H(9)), dose('b', H(10))]);
  ok('two doses in one window count as ONE window covered', /1 of 2/.test(r.ring || ''),
    'ring: ' + r.ring);
  ok('and the card still asks for the window that is genuinely open', r.due, JSON.stringify(r));
  ok('so the ring and the card do not contradict each other', /1 of 2/.test(r.ring || '') && r.due,
    'ring: ' + r.ring + ' due: ' + r.due);
}
{
  const r = await home([win(TWO)], [dose('a', H(9)), dose('b', H(17, 30))]);
  ok('one dose in each window clears the day', !r.due && r.allIn, JSON.stringify(r));
}

// ---- v68 MUST STILL HOLD: A LATE DOSE CREDITS THE WINDOW IT WAS LATE FOR -----------------------
{
  // Windows 8-12 and 17-21, one dose at 13:00. v68: that dose belongs to the 8am window it was
  // late for, and must NOT be stolen by the evening window just because 13:00 is also before it.
  // If it were stolen, the morning would read as missed and the evening as covered -- both wrong.
  const r = await home([win(TWO)], [dose('a', H(13))]);
  ok('a late dose credits the window it was late for, not the next one (v68)', r.due,
    JSON.stringify(r));
  ok('and the ring counts it as one of two', /1 of 2/.test(r.ring || ''), 'ring: ' + r.ring);
}

// ---- NOTHING LOGGED AT ALL --------------------------------------------------------------------
{
  const r = await home([win(EVENING)], []);
  ok('with nothing logged the card asks for the dose', r.due, JSON.stringify(r));
  ok('and the ring reads none of one', /0 of 1/.test(r.ring || ''), 'ring: ' + r.ring);
}

if (noise.length) {
  const uniq = [...new Set(noise)];
  checks++; fails.push('console: ' + uniq.slice(0, 2).join(' | '));
  console.log('  FAIL  the app logged ' + uniq.length + ' console error(s)/warning(s): ' + uniq[0]);
} else { ok('no console errors or warnings', true); }

await b.close();
if (server) server.close();
console.log('');
console.log(checks + ' checks: ' + (checks - fails.length) + ' passed, ' + fails.length + ' failed');
if (fails.length) { console.log('\nFAILURES:'); fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
console.log('PASS — one answer to "has this dose been given", and the ring agrees with the card.');
