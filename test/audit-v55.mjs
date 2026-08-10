// Zero Day Auditor — app-v55 independent sweep. Not the Lead Developer's self-verification.
// Run: env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy node test/audit-v55.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');

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

async function firstRun(name = 'Aud Patient', sex = 'Female', tx = 'Chemo') {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);
  await page.fill('input[placeholder="Enter patient name"]', name);
  await page.getByRole('button', { name: sex, exact: true }).click();
  await page.getByRole('button', { name: tx, exact: true }).click();
  await page.getByRole('button', { name: 'Get started' }).click();
  await page.waitForTimeout(900);
  const skip = page.getByRole('button', { name: 'Skip guide' });
  if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(600); }
}
const txt = () => page.evaluate(() => document.body.innerText);
const ovf = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
async function openDrawerTo(label) {
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.waitForTimeout(350);
  await page.getByRole('button', { name: new RegExp('^' + label) }).first().click();
  await page.waitForTimeout(450);
}
const backBtn = () => page.locator('main > div:first-child > button').first();

await firstRun();
await openDrawerTo('Help');
t('C1 Help view opens from drawer', /Find and fix a problem/.test(await txt()));

// ---------- Case group A: exhaustive walk of every category / every row ----------
const cats = await page.locator('main button').filter({ hasText: /\d+ topics?$/ }).allInnerTexts();
t('A0 17 category tiles', cats.length === 17, cats.length + '');
const catNames = cats.map(s => s.split('\n')[0]);
let totalRows = 0, badRows = [], noSteps = [], relChipsChecked = 0, maxOvf = 0;

for (const cn of catNames) {
  await page.getByRole('button', { name: new RegExp(cn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).first().click();
  await page.waitForTimeout(300);
  const o = await ovf(); if (o > maxOvf) maxOvf = o;
  if (cn === 'Common questions') {
    // accordion: expand each of the 15 in place
    const qs = await page.locator('main section:last-child button[aria-expanded]').count();
    t('A1 Common questions has 15 accordion rows', qs === 15, qs + '');
    let expandedOk = 0;
    for (let i = 0; i < qs; i++) {
      const b = page.locator('main section:last-child button[aria-expanded]').nth(i);
      const label = (await b.innerText()).replace(/\n[+−]$/, '').trim();
      await b.click(); await page.waitForTimeout(140);
      const exp = await page.locator('main section:last-child button[aria-expanded="true"]').count();
      const body = await txt();
      const stillOnList = /Common questions/.test(body);
      if (exp === 1 && stillOnList) expandedOk++;
      else badRows.push('FAQ:' + label);
      await b.click(); await page.waitForTimeout(100);
    }
    t('A2 all 15 FAQ answers expand in place, one at a time', expandedOk === 15, expandedOk + '/15');
    totalRows += qs;
  } else {
    const rowCount = await page.locator('main section:last-child > div > div > button').count();
    totalRows += rowCount;
    for (let i = 0; i < rowCount; i++) {
      const row = page.locator('main section:last-child > div > div > button').nth(i);
      const label = (await row.innerText()).split('\n')[0].trim();
      await row.click(); await page.waitForTimeout(160);
      const body = await txt();
      const o2 = await ovf(); if (o2 > maxOvf) maxOvf = o2;
      const h1 = await page.locator('main h1').first().innerText().catch(() => '');
      const li = await page.locator('main ol li').count();
      if (!/STEP BY STEP/i.test(body) || li < 1) noSteps.push(cn + ' / ' + label);
      if (!h1 || h1.trim().length < 3) badRows.push(cn + ' / ' + label + ' (no heading)');
      // related chips: every rendered chip must open something
      const chips = page.locator('main section').filter({ hasText: /^RELATED/ }).locator('button');
      const nChips = await chips.count();
      if (nChips && relChipsChecked < 25) {
        const chipLabel = await chips.first().innerText();
        await chips.first().click(); await page.waitForTimeout(160);
        const h1b = await page.locator('main h1').first().innerText().catch(() => '');
        if (h1b.trim() !== chipLabel.trim()) badRows.push('chip mismatch: ' + chipLabel + ' -> ' + h1b);
        relChipsChecked++;
        await backBtn().click(); await page.waitForTimeout(160);
        // chip nav replaces topic; back returns to the category list, so re-enter the row
        const back1 = await txt();
        if (!new RegExp(cn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(back1)) badRows.push('back after chip left ' + cn);
        continue;
      }
      await backBtn().click(); await page.waitForTimeout(150);
      const afterBack = await txt();
      if (!/All help topics/.test(afterBack)) badRows.push('back-out broken at ' + cn + ' / ' + label);
    }
  }
  // back to landing
  await page.getByRole('button', { name: 'All help topics' }).first().click();
  await page.waitForTimeout(250);
}
t('A3 total rows opened across all categories', totalRows === 133, totalRows + ' (117 topics + 15 FAQ + 1 pointer = 133)');
t('A4 every walkthrough has a Step by step list', noSteps.length === 0, noSteps.slice(0, 6).join(' ; '));
t('A5 no broken headings / back-outs / related chips', badRows.length === 0, badRows.slice(0, 6).join(' ; '));
t('A6 related chips sampled', relChipsChecked > 0, relChipsChecked + ' chips followed');
t('A7 no horizontal overflow anywhere in Help @360px', maxOvf <= 0, 'max overflow=' + maxOvf + 'px');

// ---------- Case group B: search typing under the 1s tick ----------
async function typeTest(label, str, delay, dwellEvery, dwellMs) {
  await page.locator('#help-search').click();
  await page.keyboard.press('Control+A'); await page.keyboard.press('Backspace');
  await page.waitForTimeout(150);
  await page.locator('#help-search').click();
  for (let i = 0; i < str.length; i++) {
    await page.keyboard.type(str[i], { delay });
    if (dwellEvery && (i + 1) % dwellEvery === 0) await page.waitForTimeout(dwellMs);
  }
  await page.waitForTimeout(1400);
  const v = await page.locator('#help-search').inputValue();
  t(label, v === str, 'got "' + v + '" (len ' + v.length + ' vs ' + str.length + ')');
  return v;
}
await typeTest('B1 long multi-word query survives (150ms/char, 1.2s dwell every 5)',
  'reminder never arrives on my phone at night', 150, 5, 1200);
await typeTest('B2 fast typing survives', 'greyed out daily limit', 25, 0, 0);
await typeTest('B3 slow typing with 2s dwell every 3 chars', 'export csv', 120, 3, 2000);

// caret position: type into the middle of an existing string
await page.locator('#help-search').click();
await page.keyboard.press('Control+A'); await page.keyboard.press('Backspace');
await page.keyboard.type('exportcsv', { delay: 40 });
await page.waitForTimeout(1300);
// move caret to index 6 and insert a space
await page.evaluate(() => { const el = document.getElementById('help-search'); el.focus(); el.setSelectionRange(6, 6); });
await page.keyboard.type(' ', { delay: 0 });
await page.waitForTimeout(300);
const caretVal = await page.locator('#help-search').inputValue();
const caretPos = await page.evaluate(() => document.getElementById('help-search').selectionStart);
t('B4 mid-string insert lands at the caret', caretVal === 'export csv', 'value="' + caretVal + '"');
t('B5 caret stays after the inserted char', caretPos === 7, 'selectionStart=' + caretPos);

// selection survival across a tick
await page.evaluate(() => { const el = document.getElementById('help-search'); el.focus(); el.setSelectionRange(0, 6); });
await page.waitForTimeout(1600);
const sel = await page.evaluate(() => { const el = document.getElementById('help-search'); return [el.selectionStart, el.selectionEnd, document.activeElement === el]; });
t('B6 selection + focus survive a 1s tick', sel[0] === 0 && sel[1] === 6 && sel[2] === true, JSON.stringify(sel));
// typing over a selection replaces it
await page.keyboard.type('X', { delay: 0 });
await page.waitForTimeout(250);
t('B7 typing over a selection replaces it', (await page.locator('#help-search').inputValue()) === 'X csv', 'got "' + (await page.locator('#help-search').inputValue()) + '"');

// search behaviour
await page.locator('#help-search').click();
await page.keyboard.press('Control+A'); await page.keyboard.press('Backspace');
await page.keyboard.type('not getting reminders', { delay: 20 });
await page.waitForTimeout(600);
let body = await txt();
t('B8 brief example query "not getting reminders" returns hits', /result/i.test(body) && !/Nothing matched/.test(body),
  (body.match(/\d+ results?/) || ['?'])[0]);
await page.locator('#help-search').click();
await page.keyboard.press('Control+A'); await page.keyboard.press('Backspace');
await page.keyboard.type('zzzqq', { delay: 20 });
await page.waitForTimeout(500);
t('B9 no-match empty state', /Nothing matched that/.test(await txt()));

// ---------- Case group C: FAQ reset entry points at Account ----------
await page.locator('#help-search').click();
await page.keyboard.press('Control+A'); await page.keyboard.press('Backspace');
await page.waitForTimeout(300);
await page.getByRole('button', { name: /Common questions/ }).first().click();
await page.waitForTimeout(300);
await page.getByRole('button', { name: /start over \/ erase everything/i }).first().click();
await page.waitForTimeout(250);
body = await txt();
t('C2 reset FAQ answer names Account (not Settings)', /open Account \(in the menu\)/.test(body) && !/Settings.{0,20}Start over/.test(body));
await openDrawerTo('Account');
body = await txt();
t('C3 Account really contains "Start over"', /Start over/i.test(body));

// ---------- Case group D: reload with deep Help state ----------
await openDrawerTo('Help');
await page.getByRole('button', { name: /Adding & editing medications/ }).first().click();
await page.waitForTimeout(300);
await page.getByRole('button', { name: /Daily limit box is greyed out/ }).first().click();
await page.waitForTimeout(300);
await page.locator('#help-search').count(); // walkthrough has no search box
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1800);
body = await txt();
t('D1 reload on a deep Help state does not crash', !/Something went wrong/i.test(body) && body.length > 50);
t('D2 reload returns to the Help top level (view persisted, drill-down not)', /Find and fix a problem/.test(body), body.split('\n').slice(0, 3).join(' / '));
// reload with an active search
await page.locator('#help-search').click();
await page.keyboard.type('missed', { delay: 20 });
await page.waitForTimeout(500);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1600);
body = await txt();
t('D3 reload with an active search does not crash', /Find and fix a problem/.test(body));

// ---------- Case group E: regression sweep, every screen ----------
const screens = [
  ['Home', 'button[aria-label="Open menu"]', null],
];
async function bottomNav(label) {
  await page.getByRole('button', { name: new RegExp('^' + label + '$', 'i') }).first().click();
  await page.waitForTimeout(500);
}
await openDrawerTo('Help');
await page.getByRole('button', { name: /^Home$/i }).first().click().catch(() => {});
await page.waitForTimeout(400);
for (const [label, expect] of [['Home', /Today|Treatment schedule|Quick log/i], ['Meds', /Medications|Add/i],
  ['Reports', /Reports/i], ['In-Patient', /In-Patient/i], ['Symptoms', /Symptoms/i]]) {
  await bottomNav(label);
  const b = await txt();
  t('E ' + label + ' renders', expect.test(b), b.split('\n').slice(0, 2).join(' / '));
  const o = await ovf();
  t('E ' + label + ' no horizontal overflow', o <= 0, 'ovf=' + o);
}
for (const [label, expect] of [['Account', /Account|Profiles/i], ['Calendar', /Calendar/i], ['Notes', /Notes/i], ['Settings', /Settings/i], ['Help', /Find and fix a problem/]]) {
  await openDrawerTo(label);
  const b = await txt();
  t('E ' + label + ' renders', expect.test(b), b.split('\n').slice(0, 2).join(' / '));
}
// drawer name non-interactive (v54)
await page.getByRole('button', { name: 'Open menu' }).click();
await page.waitForTimeout(350);
const drawerBtns = await page.locator('#app-drawer button').allInnerTexts();
t('E v54 drawer identity name is not a button', !drawerBtns.some(s => /^Aud Patient/.test(s)), JSON.stringify(drawerBtns));
t('E v55 drawer shows Help, no FAQ row', drawerBtns.some(s => /^Help/.test(s)) && !drawerBtns.some(s => /^FAQ/.test(s)));
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

t('Z console errors across the whole run', errs.length === 0, errs.slice(0, 5).join(' | '));
console.log('\n' + pass + ' passed, ' + fail + ' failed');
await browser.close();
process.exit(fail ? 1 : 0);
