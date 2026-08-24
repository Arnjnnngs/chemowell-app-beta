// PM gate: walk the routes the corrected V55-1 copy now names, end to end, in the real UI.
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
const BASE = 'http://127.0.0.1:8899/index.html';
const noise = (s) => /ERR_CERT_AUTHORITY_INVALID|ERR_TUNNEL_CONNECTION_FAILED|ERR_PROXY|cdn\.jsdelivr|Failed to load resource/i.test(s);
let fail = 0, pass = 0;
const t = (n, c, d) => { console.log((c ? 'PASS  ' : 'FAIL  ') + n + (d ? '  |  ' + d : '')); c ? pass++ : fail++; };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 360, height: 800 } });
const page = await ctx.newPage();
const errs = [];
page.on('console', m => { if (m.type() === 'error' && !noise(m.text())) errs.push(m.text()); });
page.on('pageerror', e => { if (!noise(e.message)) errs.push('pageerror: ' + e.message); });
const mainText = () => page.evaluate(() => document.querySelector('main').innerText);
const drawer = async (l) => { await page.getByRole('button', { name: 'Open menu' }).click(); await page.waitForTimeout(320); await page.getByRole('button', { name: new RegExp('^' + l) }).first().click(); await page.waitForTimeout(500); };

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1800);
await page.fill('input[placeholder="Enter patient name"]', 'Route One');
await page.getByRole('button', { name: 'Female', exact: true }).click();
await page.getByRole('button', { name: 'Chemo', exact: true }).click();
await page.getByRole('button', { name: 'Get started' }).click();
await page.waitForTimeout(900);
const skip = page.getByRole('button', { name: 'Skip guide' });
if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(600); }

// ---- Route named by set-erase-all / priv-delete: Menu -> Account -> Start over ----
await drawer('Account');
let b = await mainText();
t('R1 Menu -> Account reaches the Account screen', /Account|Plan/i.test(b));
t('R2 Account contains a Start over section', /start over/i.test(b), (b.match(/START OVER/i) || ['none'])[0]);
t('R3 Start over exposes the erase button the walkthrough names', (await page.getByRole('button', { name: /Erase all data/i }).count()) > 0);
t('R4 Account contains Download CSV (the "export first" step)', (await page.getByRole('button', { name: /Download CSV/i }).count()) > 0);

// ---- Route named by pro-switch / switch-profile: Account -> add + Switch ----
// Free tier caps at 1 profile, so the multi-profile route needs a paid tier first.
await page.evaluate(() => localStorage.setItem('chemowell-app-license-v1', JSON.stringify({ tier: 'pro' })));
await drawer('Settings');
await drawer('Account');
await page.getByRole('button', { name: /\+ Add profile/ }).first().click();
await page.waitForTimeout(400);
await page.locator('main input[placeholder="Patient name"]').fill('Route Two');
await page.getByRole('button', { name: /^Create$/ }).first().click();
await page.waitForTimeout(1500);
// Creating a profile switches to it, and a profile with no name lands on the welcome screen.
if (await page.locator('input[placeholder="Enter patient name"]').count()) {
  await page.fill('input[placeholder="Enter patient name"]', 'Route Two');
  await page.getByRole('button', { name: 'Male', exact: true }).click();
  await page.getByRole('button', { name: 'Radiation', exact: true }).click();
  await page.getByRole('button', { name: 'Get started' }).click();
  await page.waitForTimeout(1000);
  const sk2 = page.getByRole('button', { name: 'Skip guide' });
  if (await sk2.count()) { await sk2.first().click(); await page.waitForTimeout(600); }
}
await drawer('Account');
b = await mainText();
const nSwitch = await page.getByRole('button', { name: /^Switch$/ }).count();
t('R5 Account lists both profiles', /Route One/.test(b) && /Route Two/.test(b));
t('R6 Account offers the "Switch" control pro-switch names', nSwitch >= 1, nSwitch + ' Switch button(s)');
await page.getByRole('button', { name: /^Switch$/ }).first().click();
await page.waitForTimeout(1200);
await page.getByRole('button', { name: 'Open menu' }).click();
await page.waitForTimeout(320);
const drawerTxt = await page.locator('#app-drawer').innerText();
t('R7 switching changes the name shown at the top of the menu (as the copy claims)', /Route One/.test(drawerTxt), drawerTxt.split('\n')[0]);
await page.keyboard.press('Escape'); await page.waitForTimeout(250);

// ---- Route named by switch-profile / priv-delete: Settings -> Profiles -> Switch/Delete ----
await drawer('Settings');
b = await mainText();
t('R8 Settings has a Profiles section', /profiles/i.test(b));
t('R9 Settings -> Profiles offers Switch and Delete', (await page.getByRole('button', { name: /^Switch$/ }).count()) >= 1
  && (await page.getByRole('button', { name: /^Delete /i }).count()) >= 1);

t('RZ zero console errors', errs.length === 0, errs.slice(0, 4).join(' ; '));
console.log('\n' + pass + ' pass, ' + fail + ' fail');
await browser.close();
