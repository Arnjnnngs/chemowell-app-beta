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

console.log('\n2b. THE GUARANTEES THE PROSE CLAIMED AND NO FIXTURE CHECKED');
{
  // The audit deleted the medScheduledOn guard and the treatment-block guard from nextDueDose and
  // got 14/14 both times: the suite listed both cases in a comment and built a fixture for neither.
  // Prose in a test file is not a check.
  const dow = new Date(FROZEN).getDay();
  const otherDays = [0,1,2,3,4,5,6].filter(d => d !== dow);
  const cases = [
    ['today is not one of its days', [win({ id: 'notoday', name: 'NotTodayMed', windows: openWin,
      scheduleDays: { mode: 'weekly', days: otherDays } })], []],
    ['it is marked as-needed under Days taken', [win({ id: 'prnday', name: 'PrnDaysMed', windows: openWin,
      scheduleDays: { mode: 'asneeded' } })], []],
    ['it has no card anywhere on Home', [win({ id: 'nocard', name: 'NoCardMed', windows: openWin,
      quickLog: false })], []],
    ['it is excluded around the treatment day',
      [win({ id: 'excl', name: 'ExcludedMed', windows: openWin, treatmentMode: 'excluded',
             treatmentDaysBefore: 1, treatmentDaysAfter: 1 })],
      [{ id: 'cd', medId: 'chemo_date', ts: FROZEN, dose: null, mg: 0 }]]
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

console.log('\n3b. A MEDICATION WITH MORE THAN ONE STRENGTH NAMES NONE OF THEM');
{
  // Printing doses[0] as THE dose put "500 mg" on a card for something the caregiver might be about
  // to give 1,000 mg of. Where there is a choice, the card that offers the choice makes it.
  const txt = await setup([win({ id: 'multi', name: 'MultiStrength', windows: openWin,
    doses: [{ label: '500 mg', mg: 500 }, { label: '1000 mg', mg: 1000 }] })], []);
  t('it still names the medication', /MultiStrength/.test(String(txt)), String(txt));
  t('and prints no single strength as though it were the dose',
    !/500 mg|1000 mg/.test(String(txt)), String(txt));
}

console.log('\n4b. A GROUPED MEDICATION IS MARKED TOO, NOT JUST A STANDALONE CARD');
{
  // A medication inside "Evening meds" has no card of its own, so the mark had to go on the group
  // section -- and it did not. It scrolled correctly and lit up nothing, which is exactly the
  // "landing on a card with nothing marking it" failure this release claims to have fixed, left in
  // place for the morning and evening rounds, which are the batches.
  await setup([win({ id: 'grouped', name: 'GroupedMed', windows: openWin, quickLog: false, groupedEvening: true })], []);
  const txt = await page.evaluate(() => {
    const el = document.querySelector('[data-home="up-next"]');
    return el ? (el.innerText || '').replace(/\s+/g, ' ') : null;
  });
  t('a grouped medication can be the one named', /GroupedMed/.test(String(txt)), String(txt));
  const btn = page.locator('[data-home="up-next"] button');
  if (await btn.count()) { await btn.first().click(); await page.waitForTimeout(900); }
  const marked = await page.evaluate(() => document.querySelectorAll('[data-flash="on"]').length);
  t('and tapping the hero marks the card that holds it', marked > 0, marked + ' marked');
}

console.log('\n4c. THE BUTTON STILL WORKS WITH THE QUICK LOG SECTION COLLAPSED');
{
  // ONE TAP ON HOME REACHED A DEAD CONTROL. The "Quick log" header is a collapse chevron: tap it
  // and every standalone card leaves the page while the hero stays, still naming the medication and
  // still offering to take you to it. The button then did nothing at all -- no scroll, no mark, no
  // message -- and the collapse is remembered for the rest of the session.
  await setup([win({ id: 'collapsed', name: 'CollapsedTarget', windows: openWin })], []);
  await page.locator('[data-tour="quick-log"]').first().click();
  await page.waitForTimeout(700);
  const cardsGone = await page.evaluate(() => document.querySelectorAll('[data-med-card]').length);
  t('collapsing Quick log really does take the cards off the page', cardsGone === 0, cardsGone + ' card(s)');
  const btn = page.locator('[data-home="up-next"] button');
  t('the hero and its button are still there', await btn.count() === 1, String(await btn.count()));
  await btn.first().click();
  await page.waitForTimeout(900);
  const landed = await page.evaluate(() => {
    const el = document.querySelector('[data-flash="on"]');
    return el ? el.getAttribute('data-med-card') : null;
  });
  t('tapping it opens the section and marks the card', landed === 'collapsed', String(landed));
}

console.log('\n4d. ONE CARD LIGHTS UP, NOT EVERY CARD THAT HOLDS THE MEDICATION');
{
  // A medication placed in two rounds lit both sections, and one with its own card plus a group lit
  // both of those. Two glowing cards for one tap, only one of which is where the page went.
  // A PLAIN STANDALONE CARD RIDES ALONG, and it is not decoration: the null-attribute check at the
  // bottom of this section needs an UNFLASHED card to exist. Without one the page has no standalone
  // cards at all, the check passes on an empty query, and the h() trap it exists to catch walks
  // straight through it -- which is what happened the first time it was written.
  await setup([
    win({ id: 'twogroups', name: 'TwoGroups', windows: openWin,
      quickLog: false, groupedMorning: true, groupedEvening: true }),
    win({ id: 'plaincard', name: 'PlainCard', windows: laterWin })
  ], []);
  const sections = await page.evaluate(() => document.querySelectorAll('[data-med-card-twogroups]').length);
  t('the medication really is in two group cards', sections === 2, sections + ' group(s)');
  const btn = page.locator('[data-home="up-next"] button');
  if (await btn.count()) { await btn.first().click(); await page.waitForTimeout(900); }
  const marked = await page.evaluate(() => document.querySelectorAll('[data-flash="on"]').length);
  t('and exactly one of them is marked', marked === 1, marked + ' marked');
  // The h() null-attribute trap, asserted rather than assumed: `{'data-flash': x ? 'on' : null}`
  // writes the literal string "null", and every selector in this suite reads "on", so the trap
  // would come back unnoticed. This release already re-introduced it once.
  const cards = await page.evaluate(() => document.querySelectorAll('[data-med-card]').length);
  t('an unflashed standalone card is on the page for the next check to look at', cards >= 1, cards + ' card(s)');
  const nulls = await page.evaluate(() => document.querySelectorAll('[data-flash="null"]').length);
  t('and no card carries the literal attribute value "null"', nulls === 0, nulls + ' found');
}

console.log('\n4e. A LONG MEDICATION NAME DOES NOT TURN THE BUTTON INTO A PARAGRAPH');
{
  // The 3-line clamp was added to stop a long name growing the card until its only control sat
  // under the fixed tab bar. It clamped the TITLE while the button below printed all 105 characters
  // over five lines -- so the button, at 95px, became what drove the card's height.
  const LONG = 'Hydroxyprogesterone Caproate Extended Release Suspension For Intramuscular Use Prefilled Syringe Kit';
  await setup([win({ id: 'longname', name: LONG, windows: openWin })], []);
  const btn = page.locator('[data-home="up-next"] button');
  const label = (await btn.first().innerText()).trim();
  t('the button falls back to a generic label', label === 'Show me the card', label);
  const box = await btn.first().boundingBox();
  t('and it is one line high', !!box && box.height <= 60, box ? Math.round(box.height) + 'px' : 'no box');
  await btn.first().click();
  await page.waitForTimeout(900);
  const landed = await page.evaluate(() => {
    const el = document.querySelector('[data-flash="on"]');
    return el ? el.getAttribute('data-med-card') : null;
  });
  t('and it still goes where it says it goes', landed === 'longname', String(landed));
}

console.log('\n4f. THE DAY’S DOSE FIGURE NEVER LEAVES HOME');
{
  // THE HEADER RING IS SUPPRESSED ON HOME ONLY WHEN THE HERO IS SHOWING IT INSTEAD. Get that
  // condition wrong -- suppress it whenever the view is Home -- and on a day where a window closed
  // unlogged there is no hero, no all-done card and no ring: the day's dose count disappears from
  // the app entirely. Every other fixture in this suite has the hero on screen, where the right
  // answer and the wrong one look identical.
  const closedWin = [{ start: 6, end: 8, name: 'Earlier' }];
  const txt = await setup([win({ id: 'missedone', name: 'MissedOne', windows: closedWin })], []);
  t('nothing is due, so there is no hero', txt === null, String(txt));
  const rings = await page.evaluate(() =>
    [...document.querySelectorAll('[role="img"][aria-label*="scheduled doses logged today"]')]
      .map(e => e.getAttribute('aria-label')));
  t('and the day’s dose figure is still on Home', rings.length === 1, JSON.stringify(rings));
  t('and it says none of the day’s one dose is logged',
    /^0 of 1 /.test(rings[0] || ''), JSON.stringify(rings));
}

console.log('\n4g. A PASTED NAME WITH NO SPACES IN IT DOES NOT PUSH HOME SIDEWAYS AT 320px');
{
  // THE MISSED-DOSE BANNER HAS NEVER WRAPPED A MEDICATION NAME. Its text column is `flex: 1` with
  // no `minWidth: 0`, so a flex item refuses to shrink below its own min-content, and one unbroken
  // 62-character name takes Home past the width of the phone and carries the bottom tabs off the
  // side -- including the tab the caregiver needs to reach the card. Found in the sibling app's
  // staging copy, which has the same banner from the same ancestor, by a suite this repo does not
  // have; checked here rather than assumed, and the same fix applied.
  const LONG = 'HydroxyprogesteroneCaproateExtendedReleaseSuspensionIntramuscular Kit';
  const closedWin = [{ start: 6, end: 8, name: 'Earlier' }];
  await setup([win({ id: 'pasted', name: LONG, windows: closedWin })], []);
  await page.setViewportSize({ width: 320, height: 780 });
  await page.waitForTimeout(1200);
  const m = await page.evaluate(() => ({
    // THE RULER IS THE WIDTH THIS TEST SET, never window.innerWidth -- under mobile emulation
    // innerWidth grows with the content and a broken page measures as clean.
    doc: document.documentElement.scrollWidth,
    nav: (document.querySelector('nav') || { scrollWidth: -1 }).scrollWidth,
    banner: [...document.querySelectorAll('div')].some(d => /closed with no dose logged/.test(d.innerText || ''))
  }));
  t('the missed-dose banner naming the pasted medication is on screen', m.banner === true, JSON.stringify(m));
  t('Home does not scroll sideways at 320px', m.doc <= 320, 'page=' + m.doc + 'px');
  t('and every bottom tab is still reachable', m.nav > 0 && m.nav <= 320, 'nav=' + m.nav + 'px');
  await page.setViewportSize({ width: 390, height: 900 });
  await page.waitForTimeout(600);
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
