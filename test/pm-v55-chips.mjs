// PM gate: measure the <code> chips' headroom against the column, at 360 and 390.
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
for (const W of [360, 390]) {
  const ctx = await browser.newContext({ viewport: { width: W, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);
  await page.fill('input[placeholder="Enter patient name"]', 'Chip Test');
  await page.getByRole('button', { name: 'Female', exact: true }).click();
  await page.getByRole('button', { name: 'Chemo', exact: true }).click();
  await page.getByRole('button', { name: 'Get started' }).click();
  await page.waitForTimeout(900);
  const skip = page.getByRole('button', { name: 'Skip guide' });
  if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(600); }
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.waitForTimeout(320);
  await page.getByRole('button', { name: /^Help/ }).first().click();
  await page.waitForTimeout(450);
  const out = [];
  for (const q of ['Dosage options', 'Daily limit box is greyed out', 'Hours between doses', 'two strengths']) {
    await page.locator('#help-search').fill(q);
    await page.waitForTimeout(500);
    const hit = page.locator('main section:last-child button, main button').filter({ hasText: new RegExp(q) });
    if (!(await hit.count())) { out.push([q, 'NO HIT']); continue; }
    await hit.first().click(); await page.waitForTimeout(400);
    const m = await page.evaluate(() => {
      const res = [];
      document.querySelectorAll('main code').forEach(c => {
        const r = c.getBoundingClientRect();
        const p = c.closest('li') || c.parentElement;
        const pr = p.getBoundingClientRect();
        res.push({ text: c.textContent, w: Math.round(r.width), col: Math.round(pr.width), headroom: Math.round(pr.right - r.right) });
      });
      return res;
    });
    const worst = m.slice().sort((a, b) => a.headroom - b.headroom)[0];
    const docOvf = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    out.push([q, 'chips=' + m.length, 'widest=' + Math.max(...m.map(x => x.w)) + 'px', 'col=' + (m[0] && m[0].col) + 'px',
      'min headroom=' + (worst ? worst.headroom : '-') + 'px on "' + (worst ? worst.text : '') + '"', 'docOverflow=' + docOvf + 'px']);
    await page.locator('main > div:first-child > button').first().click();
    await page.waitForTimeout(300);
  }
  console.log('--- ' + W + 'px ---');
  out.forEach(r => console.log('  ' + r.join('  |  ')));
  await ctx.close();
}
await browser.close();
