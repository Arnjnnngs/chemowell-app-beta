// PM gate: cross-check the app-v54 README row's factual claim about drawer focus.
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
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 360, height: 800 } });
const page = await ctx.newPage();
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1800);
await page.fill('input[placeholder="Enter patient name"]', 'Focus Test');
await page.getByRole('button', { name: 'Female', exact: true }).click();
await page.getByRole('button', { name: 'Chemo', exact: true }).click();
await page.getByRole('button', { name: 'Get started' }).click();
await page.waitForTimeout(900);
const sk = page.getByRole('button', { name: 'Skip guide' });
if (await sk.count()) { await sk.first().click(); await page.waitForTimeout(600); }
const active = () => page.evaluate(() => {
  const a = document.activeElement;
  return a ? (a.tagName + (a.id ? '#' + a.id : '') + ' "' + (a.innerText || a.getAttribute('aria-label') || '').slice(0, 24) + '"') : 'none';
});
for (const how of ['Escape', 'X', 'scrim']) {
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.waitForTimeout(400);
  const inDrawer = await active();
  if (how === 'Escape') await page.keyboard.press('Escape');
  else if (how === 'X') await page.getByRole('button', { name: 'Close menu' }).click();
  else await page.mouse.click(345, 400);
  await page.waitForTimeout(500);
  console.log('close via ' + how.padEnd(7) + ' | focus while open: ' + inDrawer + ' | focus after close: ' + (await active()));
}
await browser.close();
