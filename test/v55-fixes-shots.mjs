// Visual evidence for the app-v55 Auditor fixes that change what is on screen (V55-2 code chips,
// V55-3 callout heading + icon). The Designer stage is conditional on a visual change, so these
// are the before/after surfaces it needs, captured at the primary 360px width.
//
// Run:  python3 -m http.server 8899 --directory <repo>   (then)
//       env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy node test/v55-fixes-shots.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');

const BASE = 'http://127.0.0.1:8899/index.html';
const OUT = new URL('../outputs/', import.meta.url).pathname;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 360, height: 800 } });
const page = await ctx.newPage();

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1800);
await page.fill('input[placeholder="Enter patient name"]', 'Test Patient');
await page.getByRole('button', { name: 'Female', exact: true }).click();
await page.getByRole('button', { name: 'Chemo', exact: true }).click();
await page.getByRole('button', { name: 'Get started' }).click();
await page.waitForTimeout(900);
const skip = page.getByRole('button', { name: 'Skip guide' });
if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(600); }

async function openHelp() {
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.waitForTimeout(350);
  await page.getByRole('button', { name: /^Help/ }).first().click();
  await page.waitForTimeout(450);
}
async function search(term) {
  await page.locator('#help-search').click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await page.keyboard.type(term, { delay: 25 });
  await page.waitForTimeout(500);
}

await openHelp();

// V55-2 + V55-3 calm variant on one screen: the daily-limit walkthrough is both the entry with the
// most literal examples in it and one of the five mechanics pages that used to be headed
// "Contact your care team".
await search('greyed out daily limit');
await page.getByRole('button', { name: /Daily limit box is greyed out/ }).first().click();
await page.waitForTimeout(500);
await page.screenshot({ path: OUT + 'v55fix-01-code-chips-and-calm-callout-360.png', fullPage: true });

// V55-3 urgent variant, unchanged: the call-now heading must still be there.
await page.locator('main > div:first-child > button').first().click();
await page.waitForTimeout(350);
await search('temperature is high');
await page.getByRole('button', { name: /The temperature is high/ }).first().click();
await page.waitForTimeout(500);
await page.screenshot({ path: OUT + 'v55fix-02-urgent-callout-unchanged-360.png', fullPage: true });

// V55-2 across the other three affected entries.
await page.locator('main > div:first-child > button').first().click();
await page.waitForTimeout(350);
await search('dosage options commas');
await page.getByRole('button', { name: /Dosage options/ }).first().click();
await page.waitForTimeout(500);
await page.screenshot({ path: OUT + 'v55fix-03-dose-options-code-chips-360.png', fullPage: true });

// V55-1: the erase-everything walkthrough, the one that pointed at the dead drawer element.
await page.locator('main > div:first-child > button').first().click();
await page.waitForTimeout(350);
await search('erase everything start over');
const eraseRow = page.locator('main button').filter({ hasText: /start over|erase/i }).first();
if (await eraseRow.count()) {
  await eraseRow.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: OUT + 'v55fix-04-erase-walkthrough-account-route-360.png', fullPage: true });
}

console.log('screenshots written to outputs/');
await ctx.close();
await browser.close();
