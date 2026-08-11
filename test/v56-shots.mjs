// Visual evidence for the app-v56 help bubble, at the primary 360px width. Feeds the Designer
// stage and gives Aaron something to look at.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
const OUT = new URL('../outputs/', import.meta.url).pathname;
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 360, height: 780 } });
const p = await ctx.newPage();
await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1800);
await p.fill('input[placeholder="Enter patient name"]', 'Test Patient');
await p.getByRole('button', { name: 'Female', exact: true }).click();
await p.getByRole('button', { name: 'Chemo', exact: true }).click();
await p.getByRole('button', { name: 'Get started' }).click();
await p.waitForTimeout(900);
const skip = p.getByRole('button', { name: 'Skip guide' });
if (await skip.count()) { await skip.first().click(); await p.waitForTimeout(700); }
await p.waitForTimeout(5200);   // let any toast clear so it does not sit over the shot
await p.screenshot({ path: OUT + 'v56-01-bubble-on-home-360.png' });
await p.locator('#helpbot-fab').click();
await p.waitForTimeout(600);
await p.screenshot({ path: OUT + 'v56-02-panel-greeting-360.png' });
async function ask(q, file) {
  await p.locator('#helpbot-input').click();
  await p.locator('#helpbot-input').fill('');
  await p.keyboard.type(q, { delay: 10 });
  await p.keyboard.press('Enter');
  await p.waitForTimeout(650);
  await p.screenshot({ path: OUT + file });
}
await ask('why cant i type in the daily limit box', 'v56-03-answer-360.png');
await p.locator('#helpbot-fab').count();
await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1700);
if (await p.getByRole('button', { name: 'Skip guide' }).count()) { await p.getByRole('button', { name: 'Skip guide' }).first().click(); await p.waitForTimeout(600); }
await p.waitForTimeout(5200);
await p.locator('#helpbot-fab').click(); await p.waitForTimeout(500);
await ask('is 101 a fever', 'v56-04-clinical-guard-360.png');
await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1700);
if (await p.getByRole('button', { name: 'Skip guide' }).count()) { await p.getByRole('button', { name: 'Skip guide' }).first().click(); await p.waitForTimeout(600); }
await p.waitForTimeout(5200);
await p.locator('#helpbot-fab').click(); await p.waitForTimeout(500);
await ask('the app is broken', 'v56-05-disambiguation-360.png');
await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1700);
if (await p.getByRole('button', { name: 'Skip guide' }).count()) { await p.getByRole('button', { name: 'Skip guide' }).first().click(); await p.waitForTimeout(600); }
await p.waitForTimeout(5200);
await p.locator('#helpbot-fab').click(); await p.waitForTimeout(500);
await ask('zzzqqq wibble', 'v56-06-no-answer-360.png');
console.log('screenshots written');
await ctx.close(); await b.close();
