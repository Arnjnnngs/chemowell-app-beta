// PM evidence capture: the two FAQ answers that render literal ** after the V55-1 fix.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
const BASE = 'http://127.0.0.1:8899/index.html';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 360, height: 800 } });
const page = await ctx.newPage();
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1800);
await page.fill('input[placeholder="Enter patient name"]', 'PM Patient');
await page.getByRole('button', { name: 'Female', exact: true }).click();
await page.getByRole('button', { name: 'Chemo', exact: true }).click();
await page.getByRole('button', { name: 'Get started' }).click();
await page.waitForTimeout(900);
const skip = page.getByRole('button', { name: 'Skip guide' });
if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(600); }
await page.getByRole('button', { name: 'Open menu' }).click();
await page.waitForTimeout(350);
await page.getByRole('button', { name: /^Help/ }).first().click();
await page.waitForTimeout(450);
await page.getByRole('button', { name: /^Common questions/ }).first().click();
await page.waitForTimeout(300);
// expand the two profile questions
for (const re of [/How do I switch or add a profile\?/, /caring for more than one person/]) {
  const b = page.locator('main button[aria-expanded]').filter({ hasText: re }).first();
  await b.click(); await page.waitForTimeout(200);
}
const body = await page.evaluate(() => document.querySelector('main').innerText);
console.log(body.split('\n').filter(l => l.includes('**')).join('\n---\n'));
await page.screenshot({ path: 'outputs/pm-v55-01-faq-literal-asterisks-360.png', fullPage: true });
await browser.close();
