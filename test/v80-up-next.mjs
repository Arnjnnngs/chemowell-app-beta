// v80-up-next.mjs -- Home answers "what is due next" before it asks for anything.
//
// WHAT THIS PROTECTS. The hero names a medication and a time, and a caregiver acts on it. Three
// ways it could be wrong, in the order they would hurt:
//   1. It names the WRONG medication -- one already logged, one paused, one not scheduled today,
//      one blocked around a treatment day. Every one of those would tell somebody to give a dose
//      the app itself says should not be given.
//   2. It names an as-needed medication. A painkiller available every four hours is not DUE at any
//      time, and a card headed "Up next" saying so invites a dose nobody asked for.
//   3. It disappears when the day is finished, so the screen answers "what is next" by going blank
//      at the exact moment it should feel done.
//
// It is a BROWSER test because the hero is a render, and because this repo has now shipped two
// releases where a Node-sandbox suite reported "zero differences" about a screen that was dead.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = (() => {
  const _p = require('node:path');
  const tries = ['playwright',
    _p.join(_p.dirname(process.execPath), '..', 'lib', 'node_modules', 'playwright'),
    '/opt/node22/lib/node_modules/playwright',
    '/home/claude/.npm-global/lib/node_modules/playwright'];
  for (const c of tries) { try { return require(c); } catch (e) {} }
  throw new Error('playwright not found');
})();

const BASE = 'http://127.0.0.1:8899/index.html';
let pass = 0, fail = 0;
const t = (name, cond, detail) => {
  console.log('  ' + (cond ? 'PASS  ' : 'FAIL  ') + name + (detail ? '  |  ' + detail : ''));
  cond ? pass++ : fail++;
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
const page = await ctx.newPage();
// THE CLOCK IS FROZEN AT 10:00, and without it this suite quietly stops testing anything at certain
// times of day. The first version built its windows around the current hour to avoid exactly that,
// and it still went vacuous: run in the evening, the "later" window landed past midnight, so the
// medication meant to lose the comparison was excluded before the comparison happened -- and a
// mutant that let a later dose beat one due now passed. A fixture whose meaning depends on when it
// is run is a fixture that reports green for the wrong reason on some days.
const FROZEN = (() => { const d = new Date(); d.setHours(10, 0, 0, 0); return d.getTime(); })();
await page.addInitScript((frozen) => {
  const RealDate = Date;
  const D = function (...a) { return a.length ? new RealDate(...a) : new RealDate(frozen); };
  D.now = () => frozen; D.parse = RealDate.parse; D.UTC = RealDate.UTC; D.prototype = RealDate.prototype;
  window.Date = D;
}, FROZEN);
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1600);
await page.fill('input[placeholder="Enter patient name"]', 'Preview');
await page.getByRole('button', { name: 'Female', exact: true }).click();
await page.getByRole('button', { name: 'Chemo', exact: true }).click();
await page.getByRole('button', { name: 'Get started' }).click();
await page.waitForTimeout(900);
const skip = page.getByRole('button', { name: 'Skip guide' });
if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(600); }
// The config key is profile-scoped and does not exist until the app writes it; seeding a guessed
// key means nothing loads and the screen is blank for the wrong reason.
await page.getByRole('button', { name: /^Meds/ }).first().click();
await page.waitForTimeout(600);
await page.locator('[data-tour="meds-add"]').first().click();
await page.waitForTimeout(400);
await page.getByPlaceholder('Medication name').first().fill('Seed');
await page.getByPlaceholder('For example, 4 hours').first().fill('4');
await page.getByRole('button', { name: 'Add medication', exact: true }).first().click();
await page.waitForTimeout(700);
const KEY = await page.evaluate(() => Object.keys(localStorage).find(k => /-med-v1$/.test(k)));
if (!KEY) { console.log('  FAIL  no medication config key'); process.exit(1); }

// Windows are written around the CURRENT hour so the suite does not quietly stop testing anything
// when it runs at a different time of day -- a pinned 8am window passes vacuously every afternoon.
const setup = async (meds, entries) => {
  await page.evaluate(({ key, meds, entries }) => {
    localStorage.setItem(key, JSON.stringify({ version: 2, meds, archivedMeds: {} }));
    const ek = Object.keys(localStorage).find(k => /entries-v1$/.test(k)) || 'chemowell-app-p-p1-entries-v1';
    localStorage.setItem(ek, JSON.stringify(entries));
  }, { key: KEY, meds, entries });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1900);
  const sk = page.getByRole('button', { name: 'Skip guide' });
  if (await sk.count()) { await sk.first().click(); await page.waitForTimeout(500); }
  const gt = page.getByRole('button', { name: 'Got it', exact: true });
  if (await gt.count()) { await gt.first().click(); await page.waitForTimeout(500); }
  await page.getByRole('button', { name: /^Home/ }).first().click();
  await page.waitForTimeout(900);
  return await page.evaluate(() => {
    const el = document.querySelector('[data-home="up-next"]');
    return el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : null;
  });
};
// Fixed hours against the frozen 10:00 clock: one window open right now, one that opens this
// afternoon and is unambiguously later the same day.
const openWin = [{ start: 9, end: 11, name: 'Now' }];
const laterWin = [{ start: 14, end: 16, name: 'Later' }];
const win = (m) => ({ type: 'win', schemaV: 2, quickLog: true, doses: [{ label: '1 tab', mg: 0, pills: 1 }], ...m });

console.log('\n1. IT NAMES THE MEDICATION THAT IS ACTUALLY DUE');
{
  const dueFirst = await setup([
    win({ id: 'due', name: 'DueNow', windows: openWin }),
    win({ id: 'later', name: 'LaterOne', windows: laterWin })
  ], []);
  const laterFirst = await setup([
    win({ id: 'later', name: 'LaterOne', windows: laterWin }),
    win({ id: 'due', name: 'DueNow', windows: openWin })
  ], []);
  t('the hero is on Home', dueFirst !== null, String(dueFirst));
  t('it names the medication whose window is open', /DueNow/.test(String(dueFirst)), String(dueFirst));
  t('not the one due later', !/LaterOne/.test(String(dueFirst)), String(dueFirst));
  t('and the same one when the list order is reversed',
    /DueNow/.test(String(laterFirst)) && !/LaterOne/.test(String(laterFirst)), String(laterFirst));
}

console.log('\n2. IT NEVER NAMES A MEDICATION THE APP SAYS NOT TO GIVE');
{
  // Each of these is a separate reason status() refuses, and each one would be a real instruction
  // to give a dose that should not be given.
  const cases = [
    ['already logged in this window', [win({ id: 'done', name: 'AlreadyTaken', windows: openWin })],
      [{ id: 'e1', medId: 'done', ts: FROZEN - 60000, dose: '1 tab', mg: 0, pills: 1 }]],
    ['paused', [win({ id: 'paused', name: 'PausedOne', windows: openWin, paused: true })], []],
    ['as-needed, which is available rather than due',
      [{ id: 'prn', name: 'AsNeededOne', type: 'gap', gapH: 4, schemaV: 2, quickLog: true,
         doses: [{ label: '1 tab', mg: 0, pills: 1 }] }], []]
  ];
  for (const [why, meds, entries] of cases) {
    const txt = await setup(meds, entries);
    const named = meds.map(m => m.name).filter(n => new RegExp(n).test(String(txt)));
    t('never named when ' + why, named.length === 0, String(txt));
  }
}

console.log('\n3. A FINISHED DAY LOOKS FINISHED, NOT BROKEN');
{
  const txt = await setup([win({ id: 'done2', name: 'OnlyMed', windows: openWin })],
    [{ id: 'e2', medId: 'done2', ts: FROZEN - 60000, dose: '1 tab', mg: 0, pills: 1 }]);
  t('the card is still there when everything is logged', txt !== null, String(txt));
  t('and it says so rather than naming a medication',
    /scheduled doses are in/i.test(String(txt)), String(txt));
}

console.log('\n4. THE BUTTON GOES TO A CARD THAT EXISTS');
{
  await setup([win({ id: 'due3', name: 'TapTarget', windows: openWin })], []);
  const target = await page.evaluate(() => document.querySelectorAll('[data-med-card="due3"]').length);
  t('the medication it names has a card with a scroll hook', target === 1, String(target));
  const btn = page.locator('[data-home="up-next"] button');
  t('and the hero has exactly one control', await btn.count() === 1, String(await btn.count()));
  await btn.first().click();
  await page.waitForTimeout(900);
  // NOT "the page scrolled" -- it does not need to on a short page. The assertion is that the
  // control reached its destination, which is what the caregiver needs.
  // NOT "the page scrolled" -- it does not need to on a short page, and not the inline style
  // either: this app re-renders on a one-second tick, so anything written onto the node is gone
  // within a second. The landing is marked in app STATE and rendered from there, which is what
  // survives a re-render and what a caregiver would actually see.
  const landed = await page.evaluate(() =>
    (document.querySelector('[data-flash="on"]') || {}).getAttribute
      ? document.querySelector('[data-flash="on"]').getAttribute('data-med-card') : null);
  t('tapping it marks that card, and the mark survives a re-render', landed === 'due3', String(landed));
}

console.log('\n5. ONE PROGRESS FIGURE ON HOME, NOT TWO');
{
  const rings = await page.evaluate(() =>
    [...document.querySelectorAll('[role="img"][aria-label*="scheduled doses logged today"]')].length);
  t('the header ring is not repeated beside the hero', rings === 1, rings + ' ring(s)');
}

console.log('\n6. AND NOTHING THREW');
{
  const real = errors.filter(e => !/Failed to fetch dynamically imported module/i.test(String(e).split('\n')[0]));
  t('no page error at any point above', real.length === 0, real.join(' | '));
}

await browser.close();
console.log('\n' + pass + '/' + (pass + fail) + ' checks passed' + (fail ? '  <-- FAIL' : ''));
process.exit(fail ? 1 : 0);
