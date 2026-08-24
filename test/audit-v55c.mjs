// Auditor pass 3 — regression with real data entered through the UI.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
// Playwright's location is environment-specific: the old sandbox kept it under a user-global npm
// prefix, this one ships it alongside node. Resolving a LIST of candidates instead of one pinned
// absolute path is what lets the same suite run in both. The pinned path made all 39 browser
// suites in these three repos unrunnable the moment the environment changed -- a gate that cannot
// start is indistinguishable from a gate that passes, which is the failure Rule 5 is about.
const { chromium } = (() => {
  const _p = require('node:path');
  const tries = ['playwright',
    _p.join(_p.dirname(process.execPath), '..', 'lib', 'node_modules', 'playwright'),
    '/opt/node22/lib/node_modules/playwright',
    '/home/claude/.npm-global/lib/node_modules/playwright'];
  for (const c of tries) { try { return require(c); } catch (e) {} }
  throw new Error('playwright not found; tried:\n  ' + tries.join('\n  '));
})();
const fs = require('fs');
const BASE = 'http://127.0.0.1:8899/index.html';
const noise = (s) => /ERR_CERT_AUTHORITY_INVALID|ERR_TUNNEL_CONNECTION_FAILED|ERR_PROXY|cdn\.jsdelivr|Failed to load resource/i.test(s);
let fail = 0, pass = 0;
const t = (n, c, d) => { console.log((c ? 'PASS  ' : 'FAIL  ') + n + (d ? '  |  ' + d : '')); c ? pass++ : fail++; };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
const errs = [];
page.on('console', m => { if (m.type() === 'error' && !noise(m.text())) errs.push(m.text()); });
page.on('pageerror', e => { if (!noise(e.message)) errs.push('pageerror: ' + e.message); });
const txt = () => page.evaluate(() => document.body.innerText);
const nav = async (l) => { await page.getByRole('button', { name: new RegExp('^' + l + '$', 'i') }).first().click({ force: true }); await page.waitForTimeout(600); };
const drawer = async (l) => { await page.getByRole('button', { name: 'Open menu' }).click(); await page.waitForTimeout(300); await page.getByRole('button', { name: new RegExp('^' + l) }).first().click(); await page.waitForTimeout(500); };

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1800);
await page.fill('input[placeholder="Enter patient name"]', 'Reg Test');
await page.getByRole('button', { name: 'Female', exact: true }).click();
await page.getByRole('button', { name: 'Chemo', exact: true }).click();
await page.getByRole('button', { name: 'Get started' }).click();
await page.waitForTimeout(900);
const skip = page.getByRole('button', { name: 'Skip guide' });
if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(700); }

async function addMed({ name, mode, unitIdx, doses, hours, limit, placement, treat, times }) {
  await nav('Meds');
  await page.getByRole('button', { name: /^Add$/ }).first().click();
  await page.waitForTimeout(500);
  await page.locator('input[placeholder="Medication name"]').fill(name);
  const sels = page.locator('main select');
  await sels.nth(0).selectOption({ index: mode });          // schedule type
  await page.waitForTimeout(300);
  if (unitIdx != null) { await page.locator('main select').nth(1).selectOption({ index: unitIdx }); await page.waitForTimeout(200); }
  await page.locator('input[placeholder="500 mg, 1000 mg"]').fill(doses);
  await page.waitForTimeout(300);
  if (hours != null) { const hEl = page.locator('input[placeholder="For example, 4 hours"]'); if (await hEl.count()) await hEl.fill(String(hours)); }
  if (limit != null) { const lEl = page.locator('main input[type="text"]').last(); }
  if (limit != null) {
    const dl = page.locator('main input').filter({ hasNot: page.locator('x') });
    const el = await page.evaluateHandle(() => [...document.querySelectorAll('main input')].find(i => !i.disabled && i.previousSibling === null && false) || null);
  }
  if (times) {
    for (const tm of times) {
      const addWin = page.getByRole('button', { name: /Add (a )?(time|window|reminder)/i });
      if (await addWin.count()) { await addWin.first().click(); await page.waitForTimeout(300); }
      const timeInputs = page.locator('main input[type="time"]');
      const n = await timeInputs.count();
      if (n) { await timeInputs.nth(n - 1).fill(tm); await page.waitForTimeout(200); }
    }
  }
  if (placement) { await page.getByRole('radio', { name: new RegExp(placement) }).first().click(); await page.waitForTimeout(200); }
  if (treat) { await page.getByRole('radio', { name: new RegExp(treat) }).first().click(); await page.waitForTimeout(200); }
  await page.getByRole('button', { name: 'Add medication' }).first().click();
  await page.waitForTimeout(4200);
}

await addMed({ name: 'Ondansetron', mode: 0, unitIdx: 0, doses: '8 mg, 16 mg', hours: 4 });
t('G1 as-needed med with mg doses added', /Ondansetron/.test(await txt()));

await addMed({ name: 'Rad Cream', mode: 0, unitIdx: 2, doses: '1 application', hours: 6, placement: 'Morning meds group', treat: 'Only near treatment day' });
t('G2 treatment-only med in the Morning group added', /Rad Cream/.test(await txt()));

// V52-1 regression: no treatment date exists, so the grouped treatment-only med must NOT read
// "Outside its treatment-day window".
await nav('Home');
const home = await txt();
t('G3 v52 H-2: grouped treatment-only med is available with no treatment date',
  /Rad Cream/.test(home) && !/Outside its treatment-day window/.test(home),
  (home.match(/Rad Cream[\s\S]{0,80}/) || [''])[0].replace(/\n/g, ' | '));

// log a dose of Ondansetron (the dose chips ARE the log buttons)
await page.getByRole('button', { name: /^8 mg$/ }).first().click({ force: true });
await page.waitForTimeout(700);
await page.getByRole('button', { name: 'Confirm' }).first().click({ force: true });
await page.waitForTimeout(1500);
let b = await txt();
t('G4 a dose logs from Home and reaches Today’s journal', /Ondansetron/.test(b) && !/No doses logged yet today/.test(b),
  (b.match(/TODAY’S JOURNAL[\s\S]{0,120}/) || [''])[0].replace(/\n/g, ' | '));

// History
await nav('Reports');
await page.waitForTimeout(400);
const hist = page.getByRole('button', { name: /History/ });
if (await hist.count()) { await hist.first().click(); await page.waitForTimeout(600); }
b = await txt();
t('G5 the logged dose appears in History', /Ondansetron/.test(b));

// CSV export (H-3 units)
await drawer('Settings');
b = await txt();
t('G6 Settings renders with the export section', /Download CSV|Export/i.test(b));
const dl = page.getByRole('button', { name: /Download CSV/i });
let csv = '';
if (await dl.count()) {
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }).catch(() => null), dl.first().click()]);
  if (download) { const p = await download.path(); csv = fs.readFileSync(p, 'utf8'); }
}
t('G7 CSV export produces a file', csv.length > 0, csv.split('\n')[0] || '(no file)');
t('G8 v52 H-3: CSV carries the dose unit', /8 mg/.test(csv), (csv.split('\n').find(l => /Ondansetron/.test(l)) || '(no row)'));

// v53 treatment-type switching and the tick-guard probes moved to test/audit-v55d.mjs, which
// measures them after the view has settled (a probe fired immediately after navigation catches
// the one-shot re-render that follows drawer close, which is not the 1s tick).

t('GZ console errors', errs.length === 0, errs.slice(0, 5).join(' | '));
console.log('\n' + pass + ' passed, ' + fail + ' failed');
await browser.close();
