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
    // A dose field as well, because the app's temperature writer sets one (index.html:3205).
    // (No backticks in this comment: it lives inside a template literal, and that is the second
    // time in this file. Section 7's
    // fixtures were corrected for this first; leaving it out HERE had a subtler cost. Under the
    // mutant that restores the export defect, these six went blank and 1.3b went red -- which
    // reads as "temperatures were affected", and they were not. A suite whose failure signal
    // overstates the blast radius is how the overstatement got into the changelog in the first
    // place. With a realistic shape, this mutant now reddens only the two things that really
    // broke, and section 1 keeps testing the one thing it is for: that the report is COMPLETE.
    { id: 'e1', medId: 'temp', ts: d - 2*86400000 + 9*3600000, temp: 99.1, unit: 'Fahrenheit', dose: '99.1 \u00b0F' },
    { id: 'e2', medId: 'temp', ts: d - 2*86400000 + 15*3600000, temp: 99.2, unit: 'Fahrenheit', dose: '99.2 \u00b0F' },
    { id: 'e3', medId: 'temp', ts: d - 86400000 + 9*3600000, temp: 99.3, unit: 'Fahrenheit', dose: '99.3 \u00b0F' },
    { id: 'e4', medId: 'temp', ts: d - 86400000 + 15*3600000, temp: 99.4, unit: 'Fahrenheit', dose: '99.4 \u00b0F' },
    { id: 'e5', medId: 'temp', ts: d + 9*3600000, temp: 99.5, unit: 'Fahrenheit', dose: '99.5 \u00b0F' },
    { id: 'e6', medId: 'temp', ts: d + 15*3600000, temp: 99.6, unit: 'Fahrenheit', dose: '99.6 \u00b0F' }
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
  // CONTAINING the word "people" is not the same as BEING about people. "Priority help by email
  // for all 3 people" matched the old regex and sailed through, which is the deny-list's weakness
  // wearing an allow-list's clothes. A paid bullet has exactly four jobs on this sheet -- state a
  // count, say the people are kept separate, say the features are all included, or say who the
  // plan is for -- so the opener is pinned to those four. It is deliberately brittle: changing
  // the shape of what a paid plan claims SHOULD require touching this line.
  // TWO TESTS PER BULLET, because anchoring the opener alone let "Each person also gets priority
  // email help, plus early access to new screens" through -- a support tier sold on a paid card,
  // 62/62. The opener says what KIND of claim this is; the deny-list says no benefit may be
  // smuggled into the rest of the sentence. The opener also accepts the obvious rewordings
  // ("Track up to 3 people", "Up to 3 profiles") so it is brittle about MEANING, not phrasing.
  const PAID_BULLET = /^(track |)?(up to \d+ (people|profiles)\b|as many (people|profiles) as you need\b|each person\b|every feature\b|for a family\b)/i;
  const SMUGGLED = /\b(priority|email|support|help desk|access|screens?|reports?|backup|restore|csv|export|insights?|encrypted|sync|cloud|storage|discount)\b/i;
  const offList = bullets.filter(x => !PAID_BULLET.test(x) || SMUGGLED.test(x));
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
  // "welcome screen" used to be one of the alternatives here, and it made this check satisfiable
  // by a noun. A mutant that deleted the instruction and kept the words "welcome screen" scored
  // clean. Only an actual imperative counts now.
  const iSetup = txt.search(/set it up with any name|set the app up with any name|\*\*set it up with any name first\*\*/i);
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
  // BY STEP, AND BY THE INSTRUCTION RATHER THAN THE FIRST MENTION. The first version searched
  // character offsets in the joined blob for the PHRASE "Protect the file with a password" -- so a
  // mutant that left a passive mention in step 1 and moved the real instruction to step 5, after
  // the save AND the share, kept this green. The reader's experience is governed by which numbered
  // step tells them to act, so that is what is measured: the part index of the imperative.
  // THE NUMBERED STEPS, from their own hook. The previous version indexed [question, answer,
  // ...steps, note], so a mutant that moved the encrypt-first caveat into the ANSWER and left the
  // steps as navigate -> save -> share -> ... -> encrypt scored a clean 62/62. The reader follows
  // the circled numbers; this reads the circled numbers.
  const allSteps = await pg.evaluate(() => (window.__v86Test && window.__v86Test.helpSteps) ? window.__v86Test.helpSteps() : {});
  const parts = (allSteps['priv-lost-phone'] || []);
  t('6b.3b  precondition: the numbered steps were read as steps', parts.length >= 4, parts.length + ' steps');
  const idxOf = (re) => parts.findIndex(x => re.test(x));
  const pPassword = idxOf(/turn on \*\*Protect the file with a password\*\*/i);
  const pSave = idxOf(/\*\*Save backup file\*\*/);
  const pShare = idxOf(/share screen opens/i);
  t('6b.4  the instruction to encrypt is the first step, before the save',
    pPassword > -1 && pSave > -1 && pPassword < pSave, 'password step ' + pPassword + ', save step ' + pSave
    + ' of ' + parts.length);
  t('6b.5  and before anything tells you to send the file anywhere',
    pPassword > -1 && pShare > -1 && pPassword < pShare, 'password step ' + pPassword + ', share step ' + pShare);
  t('6b.6  and it is an instruction, not a mention', pPassword > -1,
    'no step says to TURN ON the password; a passive mention does not count');
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
//
// EVERY FIXTURE CARRIES A `dose`, BECAUSE EVERY WRITER IN THE APP DOES. The first version of this
// section omitted it, which made the defect look total -- and that overstatement travelled from
// these fixtures into a code comment, a commit message and a CHANGELOG bullet that asked patients
// to re-send medical paperwork that had been fine. The delta audit measured it against the live
// app-v88 build: `temp` (3205), `blood_pressure` (3086), `weight` (3242), `paracentesis` (3228),
// `bowel_movement` (3845) and `appetite` (3939) all set `dose` to the same string the branch
// computes, so the overwrite was invisible for those. Only `radiation_session` and `symptom_*`
// write `dose: null`, and those are the two that actually lost a value a reader would notice.
//
// So a fixture that omits a field the app always writes is not a simplification -- it is a
// different program. Section 7c below pins the two that genuinely broke, by name.
{
  const KINDS = `(() => {
    const day = new Date(); day.setHours(0,0,0,0); const d = day.getTime();
    localStorage.setItem('chemowell-app-profiles-v1', JSON.stringify({ list: [{ id: 'p1', name: 'Alex', createdAt: 1 }], activeId: 'p1' }));
    localStorage.setItem('chemowell-app-license-v1', JSON.stringify({ tier: 'free' }));
    localStorage.setItem('chemowell-app-p-p1-prefs-v1', JSON.stringify({ patientName: 'Alex', onboarded: true, treatmentType: 'both', tourDone: true, installedAt: d - 30*86400000 }));
    localStorage.setItem('chemowell-app-p-p1-med-v1', JSON.stringify({ version: 2, archivedMeds: {}, meds: [] }));
    localStorage.setItem('chemowell-app-p-p1-entries-v1', JSON.stringify([
      { id: 'k1', medId: 'temp', ts: d + 3600000, temp: 99.1, unit: 'Fahrenheit', dose: '99.1 \u00b0F' },
      { id: 'k2', medId: 'blood_pressure', ts: d + 2*3600000, sys: 120, dia: 80, dose: '120/80 mmHg' },
      { id: 'k3', medId: 'weight', ts: d + 3*3600000, weight: 150, unit: 'lb', dose: '150 lb', weightReason: 'fluid_retention' },
      { id: 'k4', medId: 'paracentesis', ts: d + 4*3600000, liters: 3.5, dose: '3.5 L' },
      { id: 'k5', medId: 'radiation_session', ts: d + 5*3600000, dose: null, mg: 0 },
      { id: 'k6', medId: 'bowel_movement', ts: d + 6*3600000, value: 'normal', dose: 'Normal' },
      // 'little', not 'good': APPETITE_LABELS is { normal, little, none } (index.html:3915) and
      // 'good' is not a value the app can store. N3's own lesson, half-applied the first time.
      { id: 'k7', medId: 'appetite', ts: d + 7*3600000, value: 'little', dose: 'Little to none' },
      { id: 'k8', medId: 'symptom_nausea', ts: d + 8*3600000, severity: 'Moderate', dose: null, mg: 0 },
      // The changelog promises "the severity OR BODY SITE" is fixed, and only severity was
      // guarded -- dropping site and freq from the branch scored 62/62 while the bullet claimed
      // otherwise. A promise to a patient needs a check behind every clause of it.
      { id: 'k10', medId: 'symptom_skin_reaction', ts: d + 10*3600000, severity: 'Mild', site: 'left forearm', freq: 3, dose: null, mg: 0 },
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
  t('7.0  precondition: all ten entries reached the export', Array.isArray(rows) && rows.length === 10,
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

  // 7c. THE TWO THAT ACTUALLY BROKE. Everything else in this section would pass on the defective
  // build, because its writer supplies a `dose` that happens to match. These two write
  // `dose: null`, so they are the entire user-visible footprint of the defect and the only rows
  // that discriminate. Named individually so a future regression says which one.
  t('7c.1  a radiation session prints its number', detailOf('radiation') === 'Session 1',
    JSON.stringify(detailOf('radiation')));
  t('7c.2  a symptom prints its severity', detailOf('nausea') === 'Moderate',
    JSON.stringify(detailOf('nausea')));
  const skin = detailOf('skin');
  t('7c.2b  and its body site and episode count', /Mild/.test(skin) && /left forearm/.test(skin) && /3 episodes/.test(skin),
    JSON.stringify(skin));

  // 7c.3 is the regression this release's own fix introduced: once the suffix stopped being
  // suppressed, the weight row started printing the RAW stored id to a clinician.
  const w = detailOf('weight');
  t('7c.3  the weight reason is a readable label, not a stored id', /^150 lb \(/.test(w) && !/_/.test(w),
    JSON.stringify(w));
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
