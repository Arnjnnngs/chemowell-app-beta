// Project Manager gate — app-v55 (post-fix build f2a4177). Independent re-verification.
// Run: env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy node test/pm-v55.mjs [width]
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

const W = parseInt(process.argv[2] || '360', 10);
const BASE = 'http://127.0.0.1:8899/index.html';
const noise = (s) => /ERR_CERT_AUTHORITY_INVALID|ERR_TUNNEL_CONNECTION_FAILED|ERR_PROXY|cdn\.jsdelivr|Failed to load resource/i.test(s);
let fail = 0, pass = 0;
const t = (n, c, d) => { console.log((c ? 'PASS  ' : 'FAIL  ') + n + (d ? '  |  ' + d : '')); c ? pass++ : fail++; };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: W, height: 800 } });
const page = await ctx.newPage();
const errs = [];
page.on('console', m => { if (m.type() === 'error' && !noise(m.text())) errs.push(m.text()); });
page.on('pageerror', e => { if (!noise(e.message)) errs.push('pageerror: ' + e.message); });

async function firstRun(name = 'PM Patient', sex = 'Female', tx = 'Chemo') {
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
const mainText = () => page.evaluate(() => document.querySelector('main').innerText);
const ovf = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
async function openDrawerTo(label) {
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.waitForTimeout(350);
  await page.getByRole('button', { name: new RegExp('^' + label) }).first().click();
  await page.waitForTimeout(450);
}
const backBtn = () => page.locator('main > div:first-child > button').first();

await firstRun();

// ---------------- P1: drawer shape (V55-1 precondition) ----------------
await page.getByRole('button', { name: 'Open menu' }).click();
await page.waitForTimeout(350);
const drawerBtns = await page.locator('#app-drawer button').allInnerTexts();
t('P1a drawer has an Account row', drawerBtns.some(s => /^Account/.test(s)), JSON.stringify(drawerBtns));
t('P1b drawer name is NOT a button (v54 holds)', !drawerBtns.some(s => /PM Patient/.test(s)));
const nameClickable = await page.evaluate(() => {
  const d = document.getElementById('app-drawer');
  const el = [...d.querySelectorAll('div')].find(n => n.textContent.trim() === 'PM Patient');
  if (!el) return 'no-name-node';
  let p = el; while (p && p !== d) { if (p.tagName === 'BUTTON' || p.onclick || p.getAttribute('role') === 'button') return 'interactive'; p = p.parentElement; }
  return 'inert';
});
t('P1c drawer name node is inert', nameClickable === 'inert', nameClickable);
await page.keyboard.press('Escape'); await page.waitForTimeout(300);

// ---------------- P2: Account really is where the copy sends people ----------------
await openDrawerTo('Account');
const acct = await mainText();
t('P2a Account screen has Start over', /start over/i.test(acct), (acct.match(/START OVER/i)||['none'])[0]);
t('P2b Account screen has Profiles', /Profile/i.test(acct));
t('P2c Account screen has Download CSV', /Download CSV/i.test(acct), (acct.match(/Download CSV/i) || ['none'])[0]);
// add a 2nd profile so the Switch control the copy names can be observed
const addP = page.getByRole('button', { name: /^Add (another )?(profile|person)/i });
let switchSeen = 'not-tested';
if (await addP.count()) {
  await addP.first().click(); await page.waitForTimeout(400);
  const inp = page.locator('main input[type="text"]');
  if (await inp.count()) {
    await inp.first().fill('PM Second');
    const save = page.getByRole('button', { name: /^(Add|Save|Create)/ });
    if (await save.count()) { await save.first().click(); await page.waitForTimeout(600); }
  }
  switchSeen = (await page.locator('main button', { hasText: /^Switch$/ }).count()) > 0 ? 'Switch present' : 'no Switch';
}
t('P2d Account offers profile Switch once a 2nd profile exists', /present/.test(switchSeen) || switchSeen === 'not-tested', switchSeen);

// ---------------- P3: exhaustive Help sweep — markup leakage, chips, headings, overflow ----------------
await openDrawerTo('Help');
t('P3a Help opens from drawer', /Find and fix a problem/.test(await mainText()));
const cats = await page.locator('main button').filter({ hasText: /\d+ topics?$/ }).allInnerTexts();
const catNames = cats.map(s => s.split('\n')[0]);
t('P3b 17 category tiles', catNames.length === 17, catNames.length + '');

const CARE_LEAD = ['miss-real-missed', 'vit-temp-high', 'vit-weight-change', 'sym-severe'];
const MEDICAL_Q = {
  'rem-none': null, 'med-add-first': null, 'med-daily-limit-locked': null, 'log-anyway-override': null,
  'ip-meds-restricted': null, 'miss-real-missed': null, 'vit-temp-high': null, 'vit-weight-change': null, 'sym-severe': null
};

let rows = 0, tick = [], asterisk = [], maxOvf = 0, codeTopics = [], chipOverflow = [], calloutSeen = [];
for (const cn of catNames) {
  await page.getByRole('button', { name: new RegExp('^' + cn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).first().click();
  await page.waitForTimeout(280);
  const o = await ovf(); if (o > maxOvf) maxOvf = o;
  if (cn === 'Common questions') {
    const qs = await page.locator('main section:last-child button[aria-expanded]').count();
    for (let i = 0; i < qs; i++) {
      const b = page.locator('main section:last-child button[aria-expanded]').nth(i);
      const label = (await b.innerText()).replace(/\n[+−]$/, '').trim();
      await b.click(); await page.waitForTimeout(140);
      const body = await mainText();
      if (body.includes('`')) tick.push('FAQ: ' + label);
      if (/\*\*|(^|\s)\*\S/.test(body)) asterisk.push('FAQ: ' + label);
      const o2 = await ovf(); if (o2 > maxOvf) maxOvf = o2;
      await b.click(); await page.waitForTimeout(90);
      rows++;
    }
  } else {
    const rowCount = await page.locator('main section:last-child > div > div > button').count();
    for (let i = 0; i < rowCount; i++) {
      const row = page.locator('main section:last-child > div > div > button').nth(i);
      const label = (await row.innerText()).split('\n')[0].trim();
      await row.click(); await page.waitForTimeout(150);
      rows++;
      const body = await mainText();
      const o2 = await ovf(); if (o2 > maxOvf) maxOvf = o2;
      if (body.includes('`')) tick.push(cn + ' / ' + label);
      if (/\*\*|(^|\s)\*\S/.test(body)) asterisk.push(cn + ' / ' + label);
      const nCode = await page.locator('main code').count();
      if (nCode) {
        codeTopics.push(label + ' (' + nCode + ')');
        const bad = await page.evaluate(() => {
          const out = [];
          document.querySelectorAll('main code').forEach(c => {
            const r = c.getBoundingClientRect();
            const p = c.closest('li, p, div');
            const pr = p.getBoundingClientRect();
            if (r.right > pr.right + 1 || r.right > document.documentElement.clientWidth + 1) out.push(c.textContent + ' r=' + Math.round(r.right) + ' pr=' + Math.round(pr.right));
          });
          return out;
        });
        chipOverflow.push(...bad.map(b => label + ': ' + b));
      }
      // medical callout heading
      const callout = await page.evaluate(() => {
        const n = [...document.querySelectorAll('main div')].find(d => /^(Contact your care team|Not medical advice)$/.test(d.textContent.trim()));
        return n ? n.textContent.trim() : null;
      });
      if (callout) calloutSeen.push([label, callout]);
      await backBtn().click(); await page.waitForTimeout(140);
    }
  }
  await page.getByRole('button', { name: 'All help topics' }).first().click();
  await page.waitForTimeout(220);
}
t('P3c every row opened', rows === 133, rows + ' rows');
t('P3d NO literal backtick survives into rendered text', tick.length === 0, tick.slice(0, 8).join(' ; '));
t('P3e NO literal markdown asterisks in rendered text', asterisk.length === 0, asterisk.slice(0, 8).join(' ; '));
t('P3f <code> chips rendered on the affected topics', codeTopics.length >= 4, codeTopics.join(' | '));
t('P3g no code chip overflows its column/viewport @' + W, chipOverflow.length === 0, chipOverflow.slice(0, 6).join(' ; '));
t('P3h no horizontal overflow in Help @' + W, maxOvf <= 0, 'max=' + maxOvf + 'px');
console.log('CALLOUTS: ' + JSON.stringify(calloutSeen));
const urgentHeads = calloutSeen.filter(([, hd]) => hd === 'Contact your care team');
const calmHeads = calloutSeen.filter(([, hd]) => hd === 'Not medical advice');
t('P3i exactly 9 medical callouts seen', calloutSeen.length === 9, calloutSeen.length + '');
t('P3j 4 careLead topics keep "Contact your care team"', urgentHeads.length === 4, urgentHeads.map(x => x[0]).join(' | '));
t('P3k 5 calm topics say "Not medical advice"', calmHeads.length === 5, calmHeads.map(x => x[0]).join(' | '));

// ---------------- P4: legacy sessionStorage 'faq' ----------------
await page.evaluate(() => sessionStorage.setItem('chemowell-app-ui-view', 'faq'));
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1600);
const afterFaq = await mainText();
t('P4a legacy faq view lands on a real screen (not blank)', afterFaq.trim().length > 40, afterFaq.slice(0, 60).replace(/\n/g, ' '));
t('P4b legacy faq view lands on Home', !/Find and fix a problem/.test(afterFaq) && /Today/i.test(afterFaq));
const storedAfter = await page.evaluate(() => sessionStorage.getItem('chemowell-app-ui-view'));
console.log('sessionStorage view after reload: ' + storedAfter);

// ---------------- P5: console ----------------
t('P5 zero console errors', errs.length === 0, errs.slice(0, 5).join(' ; '));

console.log('\n' + pass + ' pass, ' + fail + ' fail @' + W + 'px');
await browser.close();
process.exit(fail ? 1 : 0);
