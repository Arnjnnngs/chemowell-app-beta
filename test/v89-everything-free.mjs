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
  // SIX entries across THREE days, every value distinct. One entry was not enough: a mutant that
  // served free users only the last three rows of the report scored the whole suite green, because
  // section 1 proved a DOCUMENT came back and never that it was COMPLETE. Quietly coming back
  // short is the shape a soft paywall actually takes -- the button still works, and the caregiver
  // hands a doctor a trimmed record with nothing on it saying so.
  localStorage.setItem('chemowell-app-p-p1-entries-v1', JSON.stringify([
    // medId 'temp', with a temp field and a unit -- the shape buildExportRows() actually reads.
    // The first version of this fixture wrote medId 'temperature' with a value field, and the
    // report printed the row with an EMPTY Detail column, which looked exactly like the app
    // losing the reading. It was the fixture. Found by reading the rendered report rather than
    // by trusting the red. (No backticks in here: this comment lives inside a template literal.)
    { id: 'e1', medId: 'temp', ts: d - 2*86400000 + 9*3600000, temp: 99.1, unit: 'Fahrenheit' },
    { id: 'e2', medId: 'temp', ts: d - 2*86400000 + 15*3600000, temp: 99.2, unit: 'Fahrenheit' },
    { id: 'e3', medId: 'temp', ts: d - 86400000 + 9*3600000, temp: 99.3, unit: 'Fahrenheit' },
    { id: 'e4', medId: 'temp', ts: d - 86400000 + 15*3600000, temp: 99.4, unit: 'Fahrenheit' },
    { id: 'e5', medId: 'temp', ts: d + 9*3600000, temp: 99.5, unit: 'Fahrenheit' },
    { id: 'e6', medId: 'temp', ts: d + 15*3600000, temp: 99.6, unit: 'Fahrenheit' }
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

// Drawer -> Settings -> the Profiles section. The SECOND place the cap is enforced.
const gotoProfiles = async (pg) => {
  await pg.evaluate(() => { const m = document.querySelector('[data-tour="menu-btn"]'); if (m) m.click(); });
  await pg.waitForTimeout(500);
  const clicked = await pg.evaluate(() => {
    const d = document.getElementById('app-drawer');
    if (!d) return 'no drawer';
    const row = [...d.querySelectorAll('button')].find(x => /^\s*Settings\b/.test(x.innerText || ''));
    if (!row) return 'no Settings row';
    row.click(); return 'ok';
  });
  await pg.waitForTimeout(900);
  if (clicked !== 'ok') return clicked;
  // Scroll the Profiles block into view so its Add button is rendered and clickable.
  const found = await pg.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => /\+\s*Add profile/i.test(x.innerText || ''));
    if (b) { b.scrollIntoView({ block: 'center' }); return true; }
    return false;
  });
  await pg.waitForTimeout(400);
  return found ? 'ok' : 'no Add profile on Settings';
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
  t('1.3  and it carries the record, not an empty shell', /Treatment record/i.test(body),
    'first 120 chars: ' + JSON.stringify(body.slice(0, 120)));

  // THE WHOLE record. Six seeded readings, three days, all six must be in the document a free
  // user hands to a doctor. "A report opened" and "the report is complete" are different claims
  // and only the second one is the promise this release makes.
  const WANT = ['99.1', '99.2', '99.3', '99.4', '99.5', '99.6'];
  const got = WANT.filter(v => body.includes(v));
  t('1.3b  and it is the WHOLE record, not a trimmed one', got.length === WANT.length,
    'seeded ' + WANT.length + ', found ' + got.length + ': ' + got.join(' '));
  const days = (body.match(/\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/g) || []);
  t('1.3c  across all three days', new Set(days).size === 3, 'day headings: ' + [...new Set(days)].join(', '));

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
  await c.close();
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
  // BOTH ROUTES. There are two "+ Add profile" buttons in this app, each with its own copy of the
  // cap test, reached by two different rows of the drawer. The first version of this section drove
  // only one of them and a mutant that loosened the other scored the whole suite green.
  //
  // The names below are the DRAWER ROW clicked, not a claim about which code renders it -- and
  // that distinction is not pedantry: mutating the copy of the guard that reads `limit` turned the
  // "account" rows red, not the "settings" rows, so the obvious mapping is the wrong way round.
  // Walking both routes is what makes the section correct without having to know which is which.
  // Two copies of a rule is one copy too many; until they are merged, the test walks both.
  for (const surface of ['account', 'settings']) {
    for (const [tier, n, want, label] of cases) {
      const { pg, c } = await freshPage(tier, n);
      const nav = surface === 'account' ? await gotoAccount(pg) : await gotoProfiles(pg);
      const got = nav === 'ok' ? await addProfile(pg) : 'nav failed: ' + nav;
      t('3.' + surface + '.' + tier + n + '  ' + label, got === want, 'wanted ' + want + ', got ' + got);
      await c.close();
    }
  }
}

console.log('\n=== 4. The plans sheet still sells three plans');
let SHEET = '';
let CARDS = {};
let BULLETS = {};
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

  // ON THE RIGHT CARD. Asserting the strings appear SOMEWHERE on the sheet passed a mutant that
  // swapped the two prices -- Plus $14.99, Pro $4.99. Low stakes while purchases are simulated;
  // a real stake the day Play Billing is wired up and the sheet is what someone is charged by.
  CARDS = await pg.evaluate(() => {
    const out = {};
    [...document.querySelectorAll('#plans-sheet div')].forEach(el => {
      const txt = (el.innerText || '').trim();
      const m = txt.match(/^(Free|Plus|Pro)\b/);
      // The card is the SMALLEST node that starts with the plan name AND carries a price. Taking
      // the largest instead returned the cards' CONTAINER for "Free" -- it starts with the word
      // Free and holds all three prices -- which would have made the negative half of 4.2b
      // meaningless on that card.
      if (m && /\$\d/.test(txt) && (!out[m[1]] || txt.length < out[m[1]].length)) out[m[1]] = txt;
    });
    return out;
  });
  t('4.2b  each price is on its own card', /\$0\b/.test(CARDS.Free || '') && /\$4\.99/.test(CARDS.Plus || '')
    && /\$14\.99/.test(CARDS.Pro || '') && !/\$14\.99/.test(CARDS.Plus || '') && !/\$4\.99/.test(CARDS.Pro || ''),
    'Free=' + ((CARDS.Free || '').match(/\$[0-9.]+/g) || []).join(',')
    + ' Plus=' + ((CARDS.Plus || '').match(/\$[0-9.]+/g) || []).join(',')
    + ' Pro=' + ((CARDS.Pro || '').match(/\$[0-9.]+/g) || []).join(','));
  // Both paid tiers must keep a purchase control: once Play Billing lands, a dropped card is a
  // dropped SKU, not a dropped paragraph.
  const buys = await pg.evaluate(() => [...document.querySelectorAll('#plans-sheet button')]
    .filter(x => /Buy|Simulate purchase/i.test(x.innerText || '')).length);
  // The bullets, read from the list elements they are rendered as and attributed to a card by
  // walking up to the nearest ancestor that starts with a plan name. Slicing the sheet's text was
  // the first attempt and it is guesswork: the node that carries the price is not the node that
  // carries the bullets, so one capture cannot serve both.
  BULLETS = await pg.evaluate(() => {
    const res = {};
    [...document.querySelectorAll('#plans-sheet ul')].forEach(ul => {
      let el = ul.parentElement;
      while (el && !/^(Free|Plus|Pro)\b/.test((el.innerText || '').trim())) el = el.parentElement;
      const m = el ? (el.innerText || '').trim().match(/^(Free|Plus|Pro)\b/) : null;
      if (m) res[m[1]] = [...ul.querySelectorAll('li')].map(li => (li.innerText || '').trim()).filter(Boolean);
    });
    return res;
  });
  t('4.4  both paid cards render their bullets as a list',
    (BULLETS.Plus || []).length >= 2 && (BULLETS.Pro || []).length >= 2, JSON.stringify(BULLETS));

  t('4.3  both paid plans still have a purchase control', buys === 2, buys + ' purchase buttons');
  await c.close();
}

console.log('\n=== 5. No feature is sold -- and the free plan says it has them');
{
  // The sheet's text, split at the plan headings. Free runs to "Plus", the paid block from there.
  const iPlus = SHEET.indexOf('Plus');
  const freeBlock = iPlus > 0 ? SHEET.slice(0, iPlus) : '';
  const paidBlock = iPlus > 0 ? SHEET.slice(iPlus) : '';
  // 5.0 is load-bearing, not decorative: SHEET is captured in section 4, and if that ever failed
  // to open the sheet then SHEET is '' and 5.1, 5.3 and 5.4 all pass on an empty string. The suite
  // would not go green -- 5.0 fails loudly -- but three of its checks would be reporting nothing,
  // so it also asserts the cards were found rather than only that the text is long enough.
  t('5.0  precondition: the sheet splits into a free half and a paid half',
    freeBlock.length > 40 && paidBlock.length > 40 && !!CARDS.Free && !!CARDS.Plus && !!CARDS.Pro,
    'free ' + freeBlock.length + ' / paid ' + paidBlock.length + ' / cards ' + Object.keys(CARDS).join(','));

  const FEATURE_WORDS = /\b(report|reports|backup|restore|CSV|export|insights?|encrypted)\b/i;
  const sold = (paidBlock.match(new RegExp(FEATURE_WORDS.source, 'gi')) || []);
  t('5.1  neither paid plan sells a feature', sold.length === 0,
    sold.length ? 'sold: ' + [...new Set(sold)].join(', ') + '  in: ' + JSON.stringify(paidBlock.replace(/\n+/g, ' | ').slice(0, 220)) : '');

  // The other half of the rule. "Absent from the paid cards" alone passes on a sheet that never
  // mentions features at all, which would leave a free user with no way to know what they have.
  t('5.2  the free plan says it carries them', /report/i.test(freeBlock) && /backup/i.test(freeBlock),
    JSON.stringify(freeBlock.replace(/\n+/g, ' | ').slice(0, 200)));

  // THE DENY-LIST IS ENUMERATIVE, AND THE AUDIT PROVED IT. A mutant that put "Priority help by
  // email" and "Shared caregiver access (coming later)" back on the Plus card scored clean: the
  // vocabulary in 5.1 is closed, so a feature sold tomorrow under a word nobody listed walks
  // straight through. 5.1 still earns its place -- it names the specific words this release took
  // off -- but the claim that actually holds is the positive one: EVERY bullet on a paid card is
  // about how many PEOPLE you track, or says the features are included.
  const bullets = [...(BULLETS.Plus || []), ...(BULLETS.Pro || [])];
  const ABOUT_PEOPLE = /\b(people|person|profiles?|patients?|relatives)\b|every feature/i;
  const offList = bullets.filter(x => !ABOUT_PEOPLE.test(x));
  t('5.1b  and every paid bullet is about how many people, not about a feature',
    bullets.length >= 4 && offList.length === 0,
    bullets.length < 4 ? 'only found ' + bullets.length + ' bullets: ' + JSON.stringify(bullets)
                       : 'off-list: ' + JSON.stringify(offList));

  // "coming later" beat the old three-word list. Matching on the IDEA -- a future tense next to a
  // bullet -- rather than on the three phrasings this release happened to delete.
  const PROMISE = /\b(coming|soon|later|planned|in development|in progress|upcoming|we(?:'| a)re building|will be)\b/i;
  const promised = bullets.filter(x => PROMISE.test(x));
  t('5.3  no paid bullet promises something that does not exist yet', promised.length === 0,
    JSON.stringify(promised));
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

  // Help now names the SECTION as a navigation step ("scroll to Export data"), so the section's
  // own heading is a label Help depends on too. Case-insensitive: the heading is rendered through
  // text-transform: uppercase, and Help writing it in sentence case is correct for a reader.
  t('6.6  and the section Help tells you to scroll to is named that', /export data/i.test(live),
    JSON.stringify(live.split('\n')[0] || ''));

  // 6.5 SAMPLES ONE STATE, AND THE SAVE BUTTON HAS TWO. It is
  // `state.bkProtect ? 'Save protected backup' : 'Save backup file'`, so a reader who follows
  // Help's instruction to turn the password on FIRST then cannot find the button Help named --
  // v66's "Tap Start or End" defect, in the guard written to mechanise exactly that rule. Help
  // now names both labels; this drives the toggle and requires both to be real.
  const toggled = await pg.evaluate(() => {
    const t2 = document.querySelector('[data-bk-protect-toggle]');
    if (!t2) return false;
    t2.click(); return true;
  });
  await pg.waitForTimeout(500);
  const liveOn = await pg.evaluate(() => {
    const bk = document.querySelector('[data-backup-section]');
    const sec = bk ? bk.closest('section') : null;
    return sec ? (sec.innerText || '') : '';
  });
  t('6.7  precondition: the password switch was found and flipped', toggled && /Save protected backup/.test(liveOn),
    JSON.stringify((liveOn.match(/Save[^\n]*/) || [''])[0]));
  const bothNamed = ['Save backup file', 'Save protected backup']
    .filter(n => !(prose || []).some(x => JSON.stringify(x).includes(n)));
  t('6.8  and Help names the button under BOTH states, not just the default',
    bothNamed.length === 0, 'Help never mentions: ' + bothNamed.join(' / '));
  await c.close();
}

console.log('\n=== 6b. The recovery instructions work on a phone with nothing on it');
// The audit's first blocker. priv-lost-phone told a person who had lost their phone to install
// ChemoWell and go to Settings. On a new install there IS no Settings: render() short-circuits to
// the welcome screen until a patient name exists, and that screen has seven controls, none of them
// a menu. The topic rewritten in this release BECAUSE it was false stopped dead at the step that
// mattered.
//
// The guard is the coupling, not the wording: measure that a cold start really has no menu, and
// then require the topic to say so. If the app ever shows a menu on the welcome screen the first
// half changes and this check should be revisited; until then the caveat is load-bearing.
{
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  c.on('page', (pg2) => pg2.on('pageerror', (e) => thrown.push(String(e))));
  const pg = await c.newPage();
  // Deliberately NO seed. This is a phone that has just installed the app.
  await pg.goto(BASE, { waitUntil: 'load' });
  await pg.waitForTimeout(2400);
  const cold = await pg.evaluate(() => ({
    menu: !!document.querySelector('[data-tour="menu-btn"]'),
    restore: /restore/i.test(document.body.innerText || ''),
    first: (document.body.innerText || '').split('\n').filter(Boolean).slice(0, 3).join(' / ')
  }));
  t('6b.0  a fresh install has no menu button at all', cold.menu === false, 'on screen: ' + cold.first);
  t('6b.1  and the word "restore" is nowhere on it', cold.restore === false, 'on screen: ' + cold.first);

  const coldProse = await pg.evaluate(() => (window.__v86Test && window.__v86Test.helpProse) ? window.__v86Test.helpProse() : []);
  const lost = (coldProse || []).find(x => x.id === 'priv-lost-phone');
  t('6b.1b  precondition: the topic was found', !!lost, (coldProse || []).length + ' topics on a cold start');
  const txt = lost ? JSON.stringify(lost) : '';
  // The caveat has to come BEFORE the first mention of Settings in the recovery step, or it is
  // advice arriving after the reader is already lost.
  const iSetup = txt.search(/set it up|set up with any name|welcome screen/i);
  const iRestore = txt.search(/Restore from a backup/);
  t('6b.2  Help warns you to set the app up first', iSetup > -1,
    'no mention of setting up before restoring');
  t('6b.3  and it warns you before it sends you to Settings', iSetup > -1 && iRestore > -1 && iSetup < iRestore,
    'setup at ' + iSetup + ', restore at ' + iRestore);

  // The audit's second blocker, and the one with real consequences. These steps render as a
  // numbered <ol>, and "turn the password on FIRST" used to be step 3 -- after step 1 saved the
  // file and step 2 said to email it. Following the numbers in order emails a complete,
  // unencrypted medical record and is then told to encrypt it first. The app's own screen gets
  // this right ("Put a password on it before you send it anywhere", above the buttons); Help had
  // inverted it. Order is the whole content of this check.
  const iPassword = txt.search(/Protect the file with a password/);
  const iSave = txt.search(/Save backup file/);
  const iShare = txt.search(/share screen opens/i);
  t('6b.4  the password comes before the save', iPassword > -1 && iSave > -1 && iPassword < iSave,
    'password at ' + iPassword + ', save at ' + iSave);
  t('6b.5  and well before anything says to send the file anywhere', iPassword > -1 && iShare > -1 && iPassword < iShare,
    'password at ' + iPassword + ', share at ' + iShare);
  await c.close();
}

console.log('\n=== 7. Every kind of entry exports its VALUE, not just its name');
// Added after the extension to section 1 uncovered a live defect in buildExportRows(): a stray
// `if (superseded)` between the medId chain and its trailing `else` bound that else to itself, so
// every entry that had NOT been superseded fell into it and had its Detail overwritten with
// `e.dose` -- which vitals and daily answers do not have. Blank Detail, in the CSV and in the
// printable doctor's report, since app-v86.
//
// It survived three releases because every existing guard on this function asserted on the NOTE
// column or on row COUNT, and because the correction suites seed SUPERSEDED rows, which take the
// one branch that still worked. So this section does the opposite of all of them: one entry of
// every kind the chain has a branch for, none of them superseded, asserting the Detail column.
{
  const KINDS = `(() => {
    const day = new Date(); day.setHours(0,0,0,0); const d = day.getTime();
    localStorage.setItem('chemowell-app-profiles-v1', JSON.stringify({ list: [{ id: 'p1', name: 'Alex', createdAt: 1 }], activeId: 'p1' }));
    localStorage.setItem('chemowell-app-license-v1', JSON.stringify({ tier: 'free' }));
    localStorage.setItem('chemowell-app-p-p1-prefs-v1', JSON.stringify({ patientName: 'Alex', onboarded: true, treatmentType: 'both', tourDone: true, installedAt: d - 30*86400000 }));
    localStorage.setItem('chemowell-app-p-p1-med-v1', JSON.stringify({ version: 2, archivedMeds: {}, meds: [] }));
    localStorage.setItem('chemowell-app-p-p1-entries-v1', JSON.stringify([
      { id: 'k1', medId: 'temp', ts: d + 3600000, temp: 99.1, unit: 'Fahrenheit' },
      { id: 'k2', medId: 'blood_pressure', ts: d + 2*3600000, sys: 120, dia: 80 },
      { id: 'k3', medId: 'weight', ts: d + 3*3600000, weight: 150, unit: 'lb' },
      { id: 'k4', medId: 'paracentesis', ts: d + 4*3600000, liters: 3.5 },
      { id: 'k5', medId: 'radiation_session', ts: d + 5*3600000 },
      { id: 'k6', medId: 'bowel_movement', ts: d + 6*3600000, value: 'normal' },
      { id: 'k7', medId: 'appetite', ts: d + 7*3600000, value: 'good' },
      { id: 'k8', medId: 'symptom_nausea', ts: d + 8*3600000, severity: 'Moderate' },
      { id: 'k9', medId: 'tylenol', ts: d + 9*3600000, dose: '500 mg' }
    ]));
    localStorage.setItem('chemowell-app-seen-version', 'x');
  })()`;
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  c.on('page', (pg2) => pg2.on('pageerror', (e) => thrown.push(String(e))));
  const pg = await c.newPage();
  await pg.addInitScript(KINDS);
  await pg.goto(BASE, { waitUntil: 'load' });
  await pg.waitForTimeout(2400);

  const rows = await pg.evaluate(() => (window.__v86Test && window.__v86Test.exportRows) ? window.__v86Test.exportRows() : null);
  t('7.0  precondition: nine entries reached the export', Array.isArray(rows) && rows.length === 9,
    Array.isArray(rows) ? rows.length + ' rows' : String(rows));

  const blank = (rows || []).filter(r => !String(r[3] || '').trim()).map(r => r[2]);
  t('7.1  every single one carries a value in the Detail column', blank.length === 0,
    blank.length ? 'BLANK Detail for: ' + blank.join(', ') : '');

  // Exact strings for the ones with a fixed format, so a silent change of units or shape is caught
  // too, not only an empty cell.
  const detailOf = (want) => ((rows || []).find(r => (r[2] || '').toLowerCase().includes(want)) || [])[3] || '';
  t('7.2  the temperature reads back exactly', detailOf('temp') === '99.1 °F', JSON.stringify(detailOf('temp')));
  t('7.3  the blood pressure reads back exactly', detailOf('blood') === '120/80 mmHg', JSON.stringify(detailOf('blood')));
  t('7.4  the paracentesis volume reads back exactly', detailOf('paracent') === '3.5 L drained', JSON.stringify(detailOf('paracent')));
  t('7.5  the dose label survives', (rows || []).some(r => String(r[3]) === '500 mg'),
    JSON.stringify((rows || []).map(r => r[3])));
  await c.close();
}

console.log('\n=== 7b. A corrected entry keeps its own value AND says it was corrected');
// The other direction of the same defect: a superseded entry skipped the else, so an ordinary
// corrected dose printed "(corrected later -- superseded)" with NO dose in front of it. Both
// halves have to be in the cell.
{
  const SUP = `(() => {
    const day = new Date(); day.setHours(0,0,0,0); const d = day.getTime();
    localStorage.setItem('chemowell-app-profiles-v1', JSON.stringify({ list: [{ id: 'p1', name: 'Alex', createdAt: 1 }], activeId: 'p1' }));
    localStorage.setItem('chemowell-app-license-v1', JSON.stringify({ tier: 'free' }));
    localStorage.setItem('chemowell-app-p-p1-prefs-v1', JSON.stringify({ patientName: 'Alex', onboarded: true, treatmentType: 'chemo', tourDone: true, installedAt: d - 30*86400000 }));
    localStorage.setItem('chemowell-app-p-p1-med-v1', JSON.stringify({ version: 2, archivedMeds: {}, meds: [] }));
    localStorage.setItem('chemowell-app-p-p1-entries-v1', JSON.stringify([
      { id: 's1', medId: 'bowel_movement', ts: d + 3600000, value: 'normal' },
      { id: 's2', medId: 'bowel_movement', ts: d + 3600000 + 43200000, value: 'loose' }
    ]));
    localStorage.setItem('chemowell-app-seen-version', 'x');
  })()`;
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  c.on('page', (pg2) => pg2.on('pageerror', (e) => thrown.push(String(e))));
  const pg = await c.newPage();
  await pg.addInitScript(SUP);
  await pg.goto(BASE, { waitUntil: 'load' });
  await pg.waitForTimeout(2400);
  const rows = await pg.evaluate(() => window.__v86Test.exportRows());
  const sup = rows.filter(r => /superseded/i.test(String(r[3] || '')));
  t('7b.0  precondition: exactly one row is marked superseded', sup.length === 1,
    JSON.stringify(rows.map(r => r[3])));
  t('7b.1  and it still names the answer it was, not the marker alone',
    sup.length === 1 && String(sup[0][3]).replace(/\s*\(corrected later.*$/, '').trim().length > 0,
    sup.length === 1 ? JSON.stringify(sup[0][3]) : 'n/a');
  t('7b.2  the standing answer is not marked', rows.filter(r => !/superseded/i.test(String(r[3] || ''))).length === 1,
    JSON.stringify(rows.map(r => r[3])));
  await c.close();
}

console.log('\n=== 8. Nothing threw');
t('8.1  no uncaught page errors', thrown.length === 0, thrown.slice(0, 3).join(' | '));

await b.close();
console.log('\n' + (pass + fail) + ' checks: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
