// Auditor pass 4 — missed-dose banner vs History (v52 H-1), treatment-type switching (v53),
// and the 1s-tick guard measured after the view has settled.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
const BASE = 'http://127.0.0.1:8899/index.html';
const noise = (s) => /ERR_CERT_AUTHORITY_INVALID|ERR_TUNNEL_CONNECTION_FAILED|ERR_PROXY|cdn\.jsdelivr|Failed to load resource/i.test(s);
let fail = 0, pass = 0;
const t = (n, c, d) => { console.log((c ? 'PASS  ' : 'FAIL  ') + n + (d ? '  |  ' + d : '')); c ? pass++ : fail++; };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
const page = await ctx.newPage();
const errs = [];
page.on('console', m => { if (m.type() === 'error' && !noise(m.text())) errs.push(m.text()); });
page.on('pageerror', e => { if (!noise(e.message)) errs.push('pageerror: ' + e.message); });
const txt = () => page.evaluate(() => document.body.innerText);
const nav = async (l) => { await page.getByRole('button', { name: new RegExp('^' + l + '$', 'i') }).first().click({ force: true }); await page.waitForTimeout(700); };
const drawer = async (l) => { await page.getByRole('button', { name: 'Open menu' }).click(); await page.waitForTimeout(350); await page.getByRole('button', { name: new RegExp('^' + l) }).first().click(); await page.waitForTimeout(700); };

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1800);
await page.fill('input[placeholder="Enter patient name"]', 'Miss Test');
await page.getByRole('button', { name: 'Female', exact: true }).click();
await page.getByRole('button', { name: 'Both', exact: true }).click();
await page.getByRole('button', { name: 'Get started' }).click();
await page.waitForTimeout(900);
const skip = page.getByRole('button', { name: 'Skip guide' });
if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(700); }
t('H0 "Both" treatment profile completes first-run', /Miss Test/.test(await txt()));

// scheduled medication, default 8 AM daily window
await nav('Meds');
await page.getByRole('button', { name: /^Add$/ }).first().click();
await page.waitForTimeout(500);
await page.locator('input[placeholder="Medication name"]').fill('Capecitabine');
await page.locator('main select').nth(0).selectOption({ index: 1 });
await page.waitForTimeout(400);
await page.locator('input[placeholder="500 mg, 1000 mg"]').fill('500 mg');
await page.waitForTimeout(300);
await page.getByRole('button', { name: 'Add medication' }).first().click();
await page.waitForTimeout(4200);
t('H1 scheduled med with an 8 AM window added', /Capecitabine/.test(await txt()));

// advance the simulated date by one day so yesterday's 8 AM dose is genuinely missed
await page.getByRole('button', { name: /BETA DATE CONTROLS/i }).first().click({ force: true });
await page.waitForTimeout(500);
const ctrlText = await txt();
const plus = page.getByRole('button', { name: /^\+1 day$|^\+ 1 day$|^\+1$/ });
if (await plus.count()) { await plus.first().click({ force: true }); }
else {
  const anyPlus = page.locator('header button').filter({ hasText: /^\+/ });
  if (await anyPlus.count()) await anyPlus.first().click({ force: true });
}
await page.waitForTimeout(1500);
const afterAdvance = await txt();
t('H2 beta date controls advance the simulated day', !/Monday, Aug 10$/.test(afterAdvance.split('\n')[3] || ''),
  (afterAdvance.split('\n').slice(2, 5).join(' / ')));

await nav('Home');
let b = await txt();
const m = b.match(/(\d+) missed doses? from previous days/);
t('H3 v52 H-1: the header banner reports past missed doses', !!m, m ? m[0] : 'no banner (text: ' + (b.match(/missed[^\n]*/) || ['none'])[0] + ')');
if (m) {
  await page.getByRole('button', { name: 'Review' }).first().click({ force: true });
  await page.waitForTimeout(1000);
  b = await txt();
  const rows = (b.match(/Took later/g) || []).length;
  t('H4 v52 H-1: tapping Review lands on History with the same misses resolvable',
    /History/i.test(b) && rows >= Number(m[1]), 'banner=' + m[1] + ' resolvable rows=' + rows);
}

// v53 — treatment type switching from Settings (a 4-button picker, not a select)
await drawer('Settings');
b = await txt();
t('H5 v53 Settings has the treatment-type picker', /TREATMENT\n/.test(b) && /Radiation/.test(b));
await page.getByRole('button', { name: 'Radiation', exact: true }).first().click({ force: true });
await page.waitForTimeout(900);
await nav('Home');
b = await txt();
t('H6 v53 switching to Radiation keeps Home rendering', b.length > 200 && !/undefined|NaN/.test(b));
await drawer('Settings');
await page.getByRole('button', { name: 'Other', exact: true }).first().click({ force: true });
await page.waitForTimeout(900);
await nav('Home');
b = await txt();
t('H7 v53 switching to Other keeps Home rendering', b.length > 200 && !/undefined|NaN/.test(b));
await drawer('Settings');
await page.getByRole('button', { name: 'Chemo', exact: true }).first().click({ force: true });
await page.waitForTimeout(900);
t('H8 v53 switching back to Chemo works', /Chemo/.test(await txt()));

// tick guard, measured after the view settles
await drawer('Help');
await page.waitForTimeout(5000);
await page.evaluate(() => document.querySelector('main').dataset.k = 'M');
await page.waitForTimeout(4000);
t('H9 the 1s tick leaves a settled Help view alone', (await page.evaluate(() => document.querySelector('main').dataset.k || '-')) === 'M');
await nav('Home');
await page.waitForTimeout(3000);
await page.evaluate(() => document.querySelector('main').dataset.k = 'M');
await page.waitForTimeout(2500);
t('H10 the 1s tick still rebuilds Home', (await page.evaluate(() => document.querySelector('main').dataset.k || '-')) === '-');

t('HZ console errors', errs.length === 0, errs.slice(0, 5).join(' | '));
console.log('\n' + pass + ' passed, ' + fail + ' failed');
await browser.close();
