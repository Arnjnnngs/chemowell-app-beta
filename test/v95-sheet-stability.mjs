// v95-sheet-stability.mjs — A SHEET MUST NOT BE TORN DOWN WHILE SOMEBODY IS USING IT.
//
// Aaron, 2026-11-13: "when I'm trying to log my medication and there's two in a row ... the first
// one I'm able to enter just fine but when I go to enter the second one and try to adjust the time
// it backs out and then I have to go back into the time part again."
//
// render() rebuilds the whole tree -- `root.innerHTML = ''` then one appendChild -- so every
// re-render destroys every node. The <input type="time"> in the log sheet is one of them, and on
// Android that input IS the system clock dialog: destroy it and the dialog closes. The toast from
// the FIRST log expires 4.5 seconds later and clearing it calls setState, which renders. That is
// why the first dose is fine and the second is not -- the second is the one opened inside the
// first toast's lifetime.
//
// The 1s tick has had a guard against exactly this since v11 and grew it in v22, v27, v45 and v55.
// The guard was on the TICK; the cosmetic timers call the same render() and never had it.
//
// WHAT THIS SUITE ASSERTS IS NODE IDENTITY, not appearance. A rebuilt tree looks identical in a
// screenshot -- same markup, same value -- and the only observable difference is that the element
// the caregiver's finger was in no longer exists. Every gate in this repo photographs a still
// frame; this one marks a node and asks whether it is still the same node.
//
// Run: env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy node test/v95-sheet-stability.mjs
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
  if (process.env[v]) { console.log('  FAIL  ' + v + ' is set'); process.exit(3); }

const argv = process.argv.slice(2);
const arg = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const BASE_IN = process.env.FALSIFY_BASE || arg('--base');
const APP_FILE = arg('--file') || new URL('../index.html', import.meta.url).pathname;

const FROZEN = Date.UTC(2026, 10, 13, 17, 3, 0);
const freeze = `(() => { const F = ${FROZEN}; const R = Date;
  function D(...a) { return a.length ? new R(...a) : new R(F); }
  D.prototype = R.prototype; D.now = () => F; D.UTC = R.UTC; D.parse = R.parse;
  Object.setPrototypeOf(D, R); window.Date = D; })()`;

// TWO medications, both with a window open right now: "two in a row", which is the case.
const win = (id, name) => ({ id, name, type: 'win', schemaV: 2, quickLog: true,
  doses: [{ label: '10 mg', mg: 10 }], windows: [{ start: 17, end: 21, name: 'Daily' }] });
const MEDS = [win('bp2', 'Blood pressure dose 2'), win('bp3', 'Blood pressure dose 3')];
// TWO dose options, so the hero cannot log it directly (`canLogHere = openNow && doses.length <= 1`)
// and offers "Show me the card" instead -- which is the only control that arms the card-flash
// timer. Without this fixture the flash timer never runs and its mutant is a no-op.
const TWO_DOSE = [{ id: 'bp4', name: 'Blood pressure dose 4', type: 'win', schemaV: 2, quickLog: true,
  doses: [{ label: '5 mg', mg: 5 }, { label: '10 mg', mg: 10 }],
  windows: [{ start: 17, end: 21, name: 'Daily' }] }];

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
async function open(meds) {
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
    localStorage.setItem(P + 'med-v1', JSON.stringify({ version: 2, archivedMeds: {}, meds: ${JSON.stringify(meds || MEDS)} }));
    localStorage.setItem(P + 'entries-v1', JSON.stringify([]));
  })()`);
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(1100);
  for (const label of ['Got it', 'Close']) {
    const btn = page.locator(`button:has-text("${label}")`).first();
    if (await btn.count() && await btn.isVisible().catch(() => false)) { await btn.click(); await page.waitForTimeout(250); break; }
  }
  return { ctx, page };
}
const markInput = (page) => page.evaluate(() => {
  const el = document.querySelector('input[type="time"]');
  if (!el) return false;
  el.__probeMark = 'original';
  el.focus();
  return document.activeElement === el;
});
const sampleInput = (page) => page.evaluate(() => {
  const el = document.querySelector('input[type="time"]');
  return { present: !!el, isOriginal: !!(el && el.__probeMark === 'original'), focused: !!(el && document.activeElement === el) };
});
// THE TOAST'S OWN ELEMENT, never its words. The first version of this read the page text for
// "logged" -- which also matches the dose ring's label, "N of N scheduled doses logged today", so
// it reported a toast that had been gone for seconds. Rule 5, for the same reason it is written
// down: a text selector in a single-file app matches the app talking about itself.
const toastShowing = (page) => page.evaluate(() => !!document.querySelector('[data-toast]'));

// ---- THE REPORTED BUG ------------------------------------------------------------------------
{
  const { ctx, page } = await open();
  await page.locator('button:has-text("Log this dose")').first().click();
  await page.waitForTimeout(350);
  ok('the first dose opens its sheet', await page.locator('input[type="time"]').count() > 0);
  await page.locator('button:has-text("Confirm")').first().click();
  await page.waitForTimeout(400);
  ok('and logging it raises a toast', await toastShowing(page));

  // The second dose, opened inside the first toast's lifetime -- Aaron's case exactly.
  await page.locator('button:has-text("Log this dose")').first().click();
  await page.waitForTimeout(350);
  ok('the second dose opens its sheet', await markInput(page));

  // Past the toast's 4.5s and the flash's 1.8s.
  let worst = null;
  for (let i = 0; i < 7; i++) {
    await page.waitForTimeout(800);
    const s = await sampleInput(page);
    if (s.present && !s.isOriginal && !worst) worst = { at: (i + 1) * 800, ...s };
  }
  ok('the time field is NOT destroyed while the second sheet is open',
    worst === null, worst ? 'replaced at ~' + worst.at + 'ms' : '');
  const end = await sampleInput(page);
  ok('and it still has focus at the end', end.focused, JSON.stringify(end));
  await ctx.close();
}

// ---- THE DEFERRAL MUST NOT STRAND THE TOAST --------------------------------------------------
// Without this, "never clear the toast" passes every check above and is plainly wrong.
{
  const { ctx, page } = await open();
  await page.locator('button:has-text("Log this dose")').first().click();
  await page.waitForTimeout(350);
  await page.locator('button:has-text("Confirm")').first().click();
  await page.waitForTimeout(400);
  ok('toast is up right after a log', await toastShowing(page));
  await page.waitForTimeout(5200);
  ok('and with NO sheet open it clears on its own', !(await toastShowing(page)));
  await ctx.close();
}
{
  const { ctx, page } = await open();
  await page.locator('button:has-text("Log this dose")').first().click();
  await page.waitForTimeout(350);
  await page.locator('button:has-text("Confirm")').first().click();
  await page.waitForTimeout(300);
  await page.locator('button:has-text("Log this dose")').first().click();
  await page.waitForTimeout(350);
  await page.waitForTimeout(5200);                       // held open past the toast's life
  ok('the toast is still up while the sheet holds it back', await toastShowing(page));
  await page.locator('button:has-text("Cancel")').first().click();
  await page.waitForTimeout(1400);                       // the retry runs every 600ms
  ok('and it clears once the sheet closes', !(await toastShowing(page)),
    'a deferral that never fires is a leak, not a fix');
  await ctx.close();
}

// ---- THE 1s TICK MUST STILL NOT REBUILD UNDER A SHEET ----------------------------------------
// The guard list moved into liveEditingSurfaceOpen(); this is the regression check on that move.
{
  const { ctx, page } = await open();
  await page.locator('button:has-text("Log this dose")').first().click();
  await page.waitForTimeout(350);
  ok('a sheet is open for the tick check', await markInput(page));
  await page.waitForTimeout(3000);                        // three ticks
  const s = await sampleInput(page);
  ok('three seconds of ticks do not replace the open field', s.present && s.isOriginal,
    JSON.stringify(s));
  await ctx.close();
}

// ---- A FOCUSED FIELD WITH NO SHEET OPEN ------------------------------------------------------
// The guard's first clause is "is something focused", inherited from the tick's `isEditing`. Every
// scenario above also has a sheet open, so the sheet clause alone satisfies them and a build that
// stopped caring about focus passes all of them. This is the case where focus is the ONLY thing
// protecting the field: the Beta date controls' date input, on Home, with a toast still counting
// down and no modal anywhere.
{
  const { ctx, page } = await open();
  await page.locator('button:has-text("Log this dose")').first().click();
  await page.waitForTimeout(350);
  await page.locator('button:has-text("Confirm")').first().click();
  await page.waitForTimeout(350);
  ok('a toast is counting down with no sheet open', await toastShowing(page));
  const panel = page.locator('button:has-text("BETA DATE CONTROLS"), [role="button"]:has-text("BETA DATE CONTROLS")').first();
  if (await panel.count()) { await panel.click(); await page.waitForTimeout(350); }
  const focused = await page.evaluate(() => {
    const el = document.querySelector('input[type="date"]');
    if (!el) return false;
    el.__probeMark = 'original';
    el.focus();
    return document.activeElement === el;
  });
  ok('the beta date field is focused and no sheet is open', focused
    && !(await page.locator('input[type="time"]').count()));
  await page.waitForTimeout(5200);
  const after = await page.evaluate(() => {
    const el = document.querySelector('input[type="date"]');
    return { present: !!el, isOriginal: !!(el && el.__probeMark === 'original'), focused: !!(el && document.activeElement === el) };
  });
  ok('a focused field alone is enough to hold the rebuild off', after.present && after.isOriginal,
    JSON.stringify(after));
  await ctx.close();
}

// ---- THE CARD-FLASH TIMER, WHICH ONLY ARMS FROM "SHOW ME THE CARD" ---------------------------
// A medication with two dose options cannot be logged from the hero, so the hero offers the card
// instead -- and that control is the only thing that sets the flash. Its timer is 1.8s, so this
// scenario does not need the toast at all.
{
  const { ctx, page } = await open(TWO_DOSE);
  const show = page.locator('button:has-text("Show me the card")').first();
  ok('a two-dose medication offers the card instead of logging in place', await show.count() > 0);
  if (await show.count()) {
    await show.click();                       // arms the 1.8s flash
    await page.waitForTimeout(250);
    const dose = page.locator('button:has-text("10 mg")').first();
    if (await dose.count()) {
      await dose.click();
      await page.waitForTimeout(350);
      ok('and its dose opens a sheet', await markInput(page));
      await page.waitForTimeout(2600);        // past the flash's 1.8s
      const s2 = await sampleInput(page);
      ok('the card-flash timer does not destroy the open sheet', s2.present && s2.isOriginal,
        JSON.stringify(s2));
    } else { ok('and its dose opens a sheet', false, 'no dose button found on the card'); }
  }
  await ctx.close();
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
console.log('PASS — a sheet survives the timers that fire underneath it, and the toast still clears.');
