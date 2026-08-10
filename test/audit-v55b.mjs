// Auditor pass 2 — related chips on every topic, care-team callout tones, 390px sweep.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
const TOPICS = require('/tmp/topics.js');

const BASE = 'http://127.0.0.1:8899/index.html';
const noise = (s) => /ERR_CERT_AUTHORITY_INVALID|ERR_TUNNEL_CONNECTION_FAILED|ERR_PROXY|cdn\.jsdelivr|Failed to load resource/i.test(s);
let fail = 0, pass = 0;
const t = (n, c, d) => { console.log((c ? 'PASS  ' : 'FAIL  ') + n + (d ? '  |  ' + d : '')); c ? pass++ : fail++; };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const errs = [];
page.on('console', m => { if (m.type() === 'error' && !noise(m.text())) errs.push(m.text()); });
page.on('pageerror', e => { if (!noise(e.message)) errs.push('pageerror: ' + e.message); });

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1800);
await page.fill('input[placeholder="Enter patient name"]', 'Aud B');
await page.getByRole('button', { name: 'Male', exact: true }).click();
await page.getByRole('button', { name: 'Radiation', exact: true }).click();
await page.getByRole('button', { name: 'Get started' }).click();
await page.waitForTimeout(900);
const skip = page.getByRole('button', { name: 'Skip guide' });
if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(600); }

await page.getByRole('button', { name: 'Open menu' }).click();
await page.waitForTimeout(350);
await page.getByRole('button', { name: /^Help/ }).first().click();
await page.waitForTimeout(450);

const txt = () => page.evaluate(() => document.body.innerText);
const ovf = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

// Reach every topic through search (unique-enough query on its own q), then compare rendered
// chips against the data's `related` array.
let chipMismatch = [], notFound = [], maxOvf = 0, tonesOk = [], toneBad = [];
const CARE = { urgent: '#C0453B', attention: '#B5761E' };

async function search(q) {
  await page.locator('#help-search').click();
  await page.keyboard.press('Control+A'); await page.keyboard.press('Backspace');
  await page.keyboard.type(q, { delay: 5 });
  await page.waitForTimeout(260);
}

for (const top of TOPICS) {
  // search on a distinctive slice of the question
  const words = top.q.replace(/[^A-Za-z0-9' ]/g, ' ').split(/\s+/).filter(w => w.length > 3).slice(0, 5).join(' ');
  await search(words);
  const rows = page.locator('main section:last-of-type button, main section button').filter({ hasText: top.q.slice(0, 25) });
  let target = page.getByRole('button', { name: new RegExp(top.q.slice(0, 30).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) });
  if (!(await target.count())) { notFound.push(top.id + ' | q="' + words + '"'); continue; }
  await target.first().click();
  await page.waitForTimeout(200);
  const o = await ovf(); if (o > maxOvf) maxOvf = o;
  const chips = page.locator('main section').filter({ hasText: /^Related/ }).locator('button');
  const n = await chips.count();
  const want = (top.related || []).length;
  if (n !== want) chipMismatch.push(top.id + ' rendered ' + n + ' want ' + want);
  // care callout tone
  if (top.medical) {
    const border = await page.evaluate(() => {
      const secs = [...document.querySelectorAll('main section')];
      const s = secs.find(x => /Contact your care team/.test(x.innerText || ''));
      return s ? getComputedStyle(s).borderLeftColor : null;
    });
    const wantHex = top.careLead ? CARE.urgent : CARE.attention;
    const toRgb = (h) => 'rgb(' + [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16)).join(', ') + ')';
    if (border === toRgb(wantHex)) tonesOk.push(top.id); else toneBad.push(top.id + ' got ' + border + ' want ' + toRgb(wantHex));
  }
  await page.locator('main > div:first-child > button').first().click();
  await page.waitForTimeout(120);
}

t('F1 every topic reachable by searching its own question text', notFound.length === 0, notFound.slice(0, 8).join(' ; '));
t('F2 rendered Related chips match the data for every topic', chipMismatch.length === 0, chipMismatch.slice(0, 8).join(' ; '));
t('F3 care-team callout tone: 4 urgent + 5 attention as designed', toneBad.length === 0 && tonesOk.length === 9, tonesOk.length + ' ok; bad: ' + toneBad.join(' ; '));
t('F4 no horizontal overflow at 390px across every walkthrough', maxOvf <= 0, 'max=' + maxOvf);

// follow a chip and check the back-out label + destination
await search('greyed out daily limit');
await page.getByRole('button', { name: /Daily limit box is greyed out/ }).first().click();
await page.waitForTimeout(250);
const chip = page.locator('main section').filter({ hasText: /^Related/ }).locator('button').first();
const chipName = await chip.innerText();
await chip.click(); await page.waitForTimeout(250);
const h1 = await page.locator('main h1').first().innerText();
t('F5 a Related chip opens that topic', h1.trim() === chipName.trim(), '"' + chipName + '" -> "' + h1 + '"');
await page.locator('main > div:first-child > button').first().click();
await page.waitForTimeout(250);
t('F6 back after a chip lands somewhere real (search results)', /Search help/i.test(await txt()));

t('FZ console errors', errs.length === 0, errs.slice(0, 4).join(' | '));
console.log('\n' + pass + ' passed, ' + fail + ' failed');
await browser.close();
process.exit(fail ? 1 : 0);
