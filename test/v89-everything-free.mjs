// v89-everything-free.mjs -- Aaron's pricing decision, mechanised.
//
// Aaron, 2026-10-25: "free shouldn't be penalized bc they didn't pay... people should be able to
// use ALL the features if they are a single user. its the most important thing to me. not money"
//
// So the axis stops being WHICH features you get and becomes HOW MANY PEOPLE you track. This file
// pins both halves of that, because each half fails in the opposite direction:
//
//   * FEATURES FREE. The app had exactly one feature paywall -- the printable report -- and it is
//     gone. Section 1 does not grep for the deleted line; it clicks the button as a free user and
//     requires an actual report document to come back.
//   * PROFILES STILL PAID. The temptation while "making things free" is to loosen the cap too, and
//     that cap is the only thing Aaron is still selling. Section 3 drives all three tiers through
//     the real Add-profile button and requires 1 / 3 / unlimited to still bite.
//
// THE CHECK MOST LIKELY TO BE WRITTEN VACUOUSLY is section 5, and it is named here as such: "no
// feature is sold". A check that merely asserts the Plus card no longer says the exact old string
// would pass on a card that sells a DIFFERENT feature tomorrow. So it asserts over a vocabulary --
// report, backup, restore, CSV, export, insight, encrypted -- scoped to the two paid cards only,
// and separately requires those same words to be PRESENT in the Free card. Absent-everywhere and
// present-only-where-it-belongs are different claims, and only the pair of them is the rule.
//
// FALSIFIED -- each mutant a byte copy served on its own port via FALSIFY_BASE, repo file never
// touched. Results are recorded at the bottom of outputs/DEV-BRIEF-app-v89.md once run.
//
// Run:  python3 -m http.server 8899 --directory <repo>   (then)  node test/v89-everything-free.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = (() => {
  const _p = require('path');
  const tries = ['playwright',
    _p.join(_p.dirname(process.execPath), '..', 'lib', 'node_modules', 'playwright'),
    '/opt/node22/lib/node_modules/playwright',
    '/home/claude/.npm-global/lib/node_modules/playwright'];
  for (const t of tries) { try { return require(t); } catch (e) {} }
  throw new Error('playwright not found');
})();
const BASE = process.env.FALSIFY_BASE || 'http://127.0.0.1:8899/index.html';

let pass = 0, fail = 0;
const t = (name, ok, detail) => {
  if (ok) { pass++; console.log('  PASS  ' + name + (detail ? '  |  ' + detail : '')); }
  else { fail++; console.log('  FAIL  ' + name + '  |  ' + detail); }
};
const b = await chromium.launch();
const thrown = [];

// tier: 'free' | 'plus' | 'pro'. nProfiles: how many profiles exist on the device.
const seed = (tier, nProfiles) => `(() => {
  const day = new Date(); day.setHours(0,0,0,0); const d = day.getTime();
  const list = [];
  for (let i = 1; i <= ${nProfiles}; i++) list.push({ id: 'p' + i, name: 'Person ' + i, createdAt: i });
  localStorage.setItem('chemowell-app-profiles-v1', JSON.stringify({ list: list, activeId: 'p1' }));
  localStorage.setItem('chemowell-app-license-v1', JSON.stringify({ tier: '${tier}' }));
  for (let i = 1; i <= ${nProfiles}; i++) {
    localStorage.setItem('chemowell-app-p-p' + i + '-prefs-v1', JSON.stringify({ patientName: 'Person ' + i, onboarded: true, treatmentType: 'chemo', tourDone: true, installedAt: d - 30*86400000 }));
    localStorage.setItem('chemowell-app-p-p' + i + '-med-v1', JSON.stringify({ version: 2, archivedMeds: {}, meds: [] }));
  }
  // One real entry, so the report has something to report and cannot pass by being empty.
  localStorage.setItem('chemowell-app-p-p1-entries-v1', JSON.stringify([
    { id: 'e1', medId: 'temperature', ts: d + 9*3600000, value: 37.2 }
  ]));
  localStorage.setItem('chemowell-app-seen-version', 'x');
})()`;

const freshPage = async (tier, nProfiles) => {
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  c.on('page', (pg) => pg.on('pageerror', (e) => thrown.push(String(e))));
  const pg = await c.newPage();
  await pg.addInitScript(seed(tier, nProfiles || 1));
  await pg.goto(BASE, { waitUntil: 'load' });
  await pg.waitForTimeout(2400);
  return { pg, c };
};

// Drawer -> Account. The export tools live there, and so does Add profile.
const gotoAccount = async (pg) => {
  await pg.evaluate(() => { const m = document.querySelector('[data-tour="menu-btn"]'); if (m) m.click(); });
  await pg.waitForTimeout(500);
  const clicked = await pg.evaluate(() => {
    const d = document.getElementById('app-drawer');
    if (!d) return 'no drawer';
    const row = [...d.querySelectorAll('button')].find(x => /^\s*Account\b/.test(x.innerText || ''));
    if (!row) return 'no Account row';
    row.click(); return 'ok';
  });
  await pg.waitForTimeout(900);
  return clicked;
};

const sheetText = (pg) => pg.evaluate(() => {
  const s = document.getElementById('plans-sheet');
  return s ? (s.innerText || '') : null;
});

console.log('\n=== 1. A FREE user opens the printable report and gets a report');
{
  const { pg, c } = await freshPage('free', 1);
  const nav = await gotoAccount(pg);
  t('1.0  precondition: the Account screen is open', nav === 'ok', nav);
  const found = await pg.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find(x => /Printable report/i.test(x.innerText || ''));
    return !!btn;
  });
  t('1.1  precondition: the Printable report button is on screen', found, found ? '' : 'button not found');

  // The report opens a popup window in the browser build. Catch the popup, read it, and require
  // the document itself -- not a toast, not an absence of an error.
  const popupPromise = c.waitForEvent('page', { timeout: 6000 }).catch(() => null);
  await pg.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find(x => /Printable report/i.test(x.innerText || ''));
    if (btn) btn.click();
  });
  // Sample the page for a payment nudge RIGHT HERE, before waiting on the popup. The first
  // version of this read it after `await popupPromise`, and on a build with the paywall restored
  // that await burns its full 6s timeout -- by which point the toast has auto-dismissed and the
  // check scored green on the one mutant it exists for. A check that runs too late looks exactly
  // like a check that passed.
  await pg.waitForTimeout(150);
  const nudge = await pg.evaluate(() => (document.body.innerText.match(/part of Plus[^\n]*/i) || [''])[0]);

  const popup = await popupPromise;
  let body = '';
  if (popup) { await popup.waitForTimeout(600); body = await popup.evaluate(() => document.body ? document.body.innerText : ''); }
  t('1.2  a report document opened', !!popup, popup ? '' : 'no window opened at all');
  t('1.3  and it carries the record, not an empty shell', /Treatment record/i.test(body) && /37\.2|Temperature/i.test(body),
    'first 120 chars: ' + JSON.stringify(body.slice(0, 120)));

  await pg.waitForTimeout(400);
  const sheet = await sheetText(pg);
  t('1.4  the plans sheet did NOT open instead', sheet === null, sheet ? 'sheet is up: ' + JSON.stringify(sheet.slice(0, 60)) : '');
  t('1.5  nothing told the person to pay', nudge === '', JSON.stringify(nudge));
  await c.close();
}

console.log('\n=== 2. No PLUS badge anywhere on the export tools');
{
  const { pg, c } = await freshPage('free', 1);
  await gotoAccount(pg);
  const txt = await pg.evaluate(() => {
    const bk = document.querySelector('[data-backup-section]');
    const sec = bk ? bk.closest('section') : null;
    return sec ? (sec.innerText || '') : null;
  });
  t('2.0  precondition: the Export section rendered', txt !== null && /Printable report/i.test(txt || ''),
    txt === null ? 'section not found' : JSON.stringify((txt || '').slice(0, 80)));
  t('2.1  no PLUS badge on it', !/\bPLUS\b/.test(txt || ''),
    (((txt || '').match(/.{0,40}\bPLUS\b.{0,40}/) || [''])[0]));
  t('2.2  and both export controls plus both backup controls are there',
    /Download CSV/.test(txt || '') && /Printable report/.test(txt || '')
    && /Save backup file/.test(txt || '') && /Restore from a backup/.test(txt || ''),
    JSON.stringify((txt || '').replace(/\n+/g, ' | ').slice(0, 200)));
}

console.log('\n=== 3. The profile cap is UNCHANGED -- 1 / 3 / unlimited');
// Each case drives the real "+ Add profile" button. At the limit it opens the plans sheet; below
// it, the add form. Asserting both directions is what makes this a cap test rather than a
// "something happened" test.
{
  const addProfile = async (pg) => {
    await pg.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find(x => /\+\s*Add profile/i.test(x.innerText || ''));
      if (btn) btn.click();
    });
    await pg.waitForTimeout(700);
    const sheet = await sheetText(pg);
    const form = await pg.evaluate(() => {
      const i = document.querySelector('input[placeholder*="name" i]');
      return !!i && !document.getElementById('plans-sheet');
    });
    return sheet !== null ? 'sheet' : (form ? 'form' : 'nothing');
  };
  const cases = [
    ['free', 1, 'sheet', 'Free is capped at 1 -- a second profile asks you to pay'],
    ['plus', 1, 'form',  'Plus below its cap goes straight to the add form'],
    ['plus', 3, 'sheet', 'Plus is capped at 3 -- a fourth asks you to pay'],
    ['pro',  3, 'form',  'Pro is uncapped -- a fourth is just added'],
  ];
  for (const [tier, n, want, label] of cases) {
    const { pg, c } = await freshPage(tier, n);
    const nav = await gotoAccount(pg);
    const got = nav === 'ok' ? await addProfile(pg) : 'nav failed: ' + nav;
    t('3.' + tier + n + '  ' + label, got === want, 'wanted ' + want + ', got ' + got);
    await c.close();
  }
}

console.log('\n=== 4. The plans sheet still sells three plans');
let SHEET = '';
{
  const { pg, c } = await freshPage('free', 1);
  await gotoAccount(pg);
  await pg.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find(x => /View plans/i.test(x.innerText || ''));
    if (btn) btn.click();
  });
  await pg.waitForTimeout(700);
  SHEET = (await sheetText(pg)) || '';
  t('4.0  precondition: the plans sheet is open', SHEET.length > 0, 'length ' + SHEET.length);
  t('4.1  all three plans are named', /\bFree\b/.test(SHEET) && /\bPlus\b/.test(SHEET) && /\bPro\b/.test(SHEET),
    JSON.stringify(SHEET.replace(/\n+/g, ' | ').slice(0, 160)));
  t('4.2  all three prices are shown', /\$0\b/.test(SHEET) && /\$4\.99/.test(SHEET) && /\$14\.99/.test(SHEET),
    (SHEET.match(/\$[0-9.]+/g) || []).join(' '));
  // Both paid tiers must keep a purchase control: once Play Billing lands, a dropped card is a
  // dropped SKU, not a dropped paragraph.
  const buys = await pg.evaluate(() => [...document.querySelectorAll('#plans-sheet button')]
    .filter(x => /Buy|Simulate purchase/i.test(x.innerText || '')).length);
  t('4.3  both paid plans still have a purchase control', buys === 2, buys + ' purchase buttons');
  await c.close();
}

console.log('\n=== 5. No feature is sold -- and the free plan says it has them');
{
  // The sheet's text, split at the plan headings. Free runs to "Plus", the paid block from there.
  const iPlus = SHEET.indexOf('Plus');
  const freeBlock = iPlus > 0 ? SHEET.slice(0, iPlus) : '';
  const paidBlock = iPlus > 0 ? SHEET.slice(iPlus) : '';
  t('5.0  precondition: the sheet splits into a free half and a paid half',
    freeBlock.length > 40 && paidBlock.length > 40, 'free ' + freeBlock.length + ' / paid ' + paidBlock.length);

  const FEATURE_WORDS = /\b(report|reports|backup|restore|CSV|export|insights?|encrypted)\b/i;
  const sold = (paidBlock.match(new RegExp(FEATURE_WORDS.source, 'gi')) || []);
  t('5.1  neither paid plan sells a feature', sold.length === 0,
    sold.length ? 'sold: ' + [...new Set(sold)].join(', ') + '  in: ' + JSON.stringify(paidBlock.replace(/\n+/g, ' | ').slice(0, 220)) : '');

  // The other half of the rule. "Absent from the paid cards" alone passes on a sheet that never
  // mentions features at all, which would leave a free user with no way to know what they have.
  t('5.2  the free plan says it carries them', /report/i.test(freeBlock) && /backup/i.test(freeBlock),
    JSON.stringify(freeBlock.replace(/\n+/g, ' | ').slice(0, 200)));

  t('5.3  nothing on the sheet is a promise', !/coming soon|in development|planned/i.test(SHEET),
    ((SHEET.match(/.{0,40}(coming soon|in development|planned).{0,40}/i) || [''])[0]));
  t('5.4  the unmeasured "Most popular" claim is gone', !/Most popular/i.test(SHEET),
    ((SHEET.match(/.{0,40}Most popular.{0,40}/i) || [''])[0]));
  t('5.5  the sheet says what paying actually buys', /more people|as many people|up to 3 people/i.test(SHEET),
    JSON.stringify(SHEET.replace(/\n+/g, ' | ').slice(0, 200)));
}

console.log('\n=== 6. Help agrees with the app');
{
  const { pg, c } = await freshPage('free', 1);
  const prose = await pg.evaluate(() => (window.__v86Test && window.__v86Test.helpProse) ? window.__v86Test.helpProse() : null);
  t('6.0  precondition: the Help prose hook answered', Array.isArray(prose) && prose.length > 10,
    Array.isArray(prose) ? prose.length + ' topics' : String(prose));
  const all = (prose || []).map(x => JSON.stringify(x)).join('\n');

  t('6.1  Help no longer sells the printable report',
    !/printable[^"]{0,60}part of the Plus|part of the Plus plan/i.test(all),
    ((all.match(/.{0,60}part of the Plus.{0,60}/i) || [''])[0]));

  t('6.2  Help no longer says backup is unbuilt',
    !/(backup[^"]{0,80}(not built yet|planned but not|isn.t built))|((not built yet|planned but not)[^"]{0,80}backup)/i.test(all),
    ((all.match(/.{0,80}not built yet.{0,80}/i) || [''])[0]));

  t('6.3  Help no longer says the data cannot be restored',
    !/no way to restore it/i.test(all), ((all.match(/.{0,70}no way to restore it.{0,70}/i) || [''])[0]));

  const lost = (prose || []).find(x => x.id === 'priv-lost-phone');
  const lostAll = lost ? JSON.stringify(lost) : '';
  t('6.4  and tells you how to get your records onto a new phone',
    /Save backup file/.test(lostAll) && /Restore from a backup/.test(lostAll),
    JSON.stringify(lostAll.slice(0, 200)));

  // Every control name Help prints for this journey has to be a control that exists. v66's
  // "Tap Start or End" named buttons that had been renamed; this is that rule, mechanised.
  await gotoAccount(pg);
  const live = await pg.evaluate(() => {
    const bk = document.querySelector('[data-backup-section]');
    const sec = bk ? bk.closest('section') : null;
    return sec ? (sec.innerText || '') : '';
  });
  const named = ['Save backup file', 'Restore from a backup', 'Protect the file with a password', 'Printable report', 'Download CSV'];
  const missing = named.filter(n => !live.includes(n));
  t('6.5  every control Help names is really on the screen', missing.length === 0, 'missing: ' + missing.join(' / '));
  await c.close();
}

console.log('\n=== 7. Nothing threw');
t('7.1  no uncaught page errors', thrown.length === 0, thrown.slice(0, 3).join(' | '));

await b.close();
console.log('\n' + (pass + fail) + ' checks: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
