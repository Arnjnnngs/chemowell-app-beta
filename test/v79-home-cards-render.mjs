// v79-home-cards-render.mjs -- render a screen with a migrated medication on it.
//
// THIS IS THE SUITE THAT WAS MISSING, AND ITS ABSENCE IS WHY app-v78 SHIPPED A DEAD HOME SCREEN.
//
// `medHomeCardKind()` was called three times and defined nowhere. Home threw
// `ReferenceError: medHomeCardKind is not defined` on every render after the first -- for any device
// whose medications had been through the legacy migration, which is the migration that release
// existed to perform. History died with it. FIVE SUITES, 103 CHECKS, ALL GREEN.
//
// They were green because the equivalence suite lifts FOUR FUNCTIONS into a Node sandbox and never
// runs status(), missedDosesFor(), afterLog(), the home cards or the history summary -- which is
// where every defect in that audit lived. No suite in this repo had ever rendered a screen with a
// medication carrying a `homeCard`. "Zero differences" was a statement about four functions.
//
// So this one renders. It seeds the exact shape the migration produces and then LOOKS at Home and
// at History, which is the only way a missing function shows up.
//
// Run:  node test/v79-home-cards-render.mjs     (needs a static server on 8899)
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = (() => {
  const _p = require('node:path');
  const tries = ['playwright',
    _p.join(_p.dirname(process.execPath), '..', 'lib', 'node_modules', 'playwright'),
    '/opt/node22/lib/node_modules/playwright',
    '/home/claude/.npm-global/lib/node_modules/playwright'];
  for (const c of tries) { try { return require(c); } catch (e) {} }
  throw new Error('playwright not found; tried:\n  ' + tries.join('\n  '));
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

// A config exactly as an older build wrote it: bare legacy ids, no properties, version 1. This is
// what a restored backup delivers, and what loadMedicationConfig migrates on load.
// The config key is profile-scoped and does not exist until a medication is saved, so one is added
// through the real editor first. The v76 render suite learned this the same way: seeding a guessed
// key means nothing loads and the screen is blank for the wrong reason.
await page.getByRole('button', { name: /^Meds/ }).first().click();
await page.waitForTimeout(600);
await page.locator('[data-tour="meds-add"]').first().click();
await page.waitForTimeout(400);
await page.getByPlaceholder('Medication name').first().fill('Seed');
await page.getByPlaceholder('For example, 4 hours').first().fill('4');
await page.getByRole('button', { name: 'Add medication', exact: true }).first().click();
await page.waitForTimeout(700);

const seeded = await page.evaluate(() => {
  const key = Object.keys(localStorage).find(k => /-med-v1$/.test(k));
  if (!key) return { ok: false, why: 'no medication config key even after adding one' };
  localStorage.setItem(key, JSON.stringify({ version: 1, meds: [
    { id: 'tylenol', name: 'Tylenol', type: 'gap', gapH: 4, ceiling: true, ceilingMax: 3000,
      ceilingGroup: 'apap', doses: [{ label: '500 mg', mg: 500 }], quickLog: true },
    { id: 'tylenol-liquid', name: 'Tylenol Liquid', type: 'gap', gapH: 4, ceilingGroup: 'apap',
      volumeCeilingMl: 90, doses: [{ label: '15 mL', mg: 480, volumeMl: 15 }], quickLog: true },
    { id: 'imodium', name: 'Imodium', type: 'gap', gapH: 6,
      doses: [{ label: '1 pill', mg: 0, pills: 1 }], quickLog: true },
    // TWO MEDICATIONS ADDED SO THAT THE SINGULAR-UNIT CHECK CAN ACTUALLY FAIL.
    // The audit reverted the whole `hcUnitFor` helper and this suite stayed 12/12, because
    // "1 doses" is only produced by the NO-LIMIT branch (`hcUsed + ' ' + unit`) and by
    // `hcLeft === 1`, and the Imodium fixture above reaches neither: it has no ceiling, so
    // `hcMax` is 0, and one pill of an unlimited medication was never rendered with a count.
    // The check was asserting the absence of a string its own data could not generate.
    //   * 'antacid' has a homeCard and NO ceiling  -> renders the bare "1 <unit>" form.
    //   * 'lozenge' has a ceiling of 2 and one dose -> renders "1 <unit> left before the limit".
    { id: 'antacid', name: 'Antacid', type: 'gap', gapH: 4, homeCard: { kind: 'pills' },
      doses: [{ label: '1 tablet', mg: 0, pills: 1 }], quickLog: true },
    { id: 'lozenge', name: 'Lozenge', type: 'gap', gapH: 4, homeCard: { kind: 'pills' },
      ceiling: true, ceilingMax: 2, ceilingUnit: 'lozenges',
      doses: [{ label: '1 lozenge', mg: 0, pills: 1 }], quickLog: true },
    // A CEILING OF ONE, because a limit of 1 is the only thing that renders " / 1 <unit>". The two
    // medications above cover the USED side of the singular fix; neither can ever produce the MAX
    // side, so reverting hcUnitFor(hcMax) at both its call sites left this suite 14/14 -- the same
    // could-not-fail defect round 1 was blocked for, in the release fixing it.
    { id: 'patch', name: 'Patch', type: 'gap', gapH: 8, homeCard: { kind: 'pills' },
      ceiling: true, ceilingMax: 1, ceilingUnit: 'patches',
      doses: [{ label: '1 patch', mg: 0, pills: 1 }], quickLog: true },
    // A UNIT THAT IS NOT A PLURAL. `ceilingUnit` is free text, and the singulariser's job is as much
    // to LEAVE THINGS ALONE as to trim them: "bolus" is one bolus, and the first two versions of the
    // rule turned it into "bolu". Nothing covered that, so removing the rule left the suite green.
    { id: 'infusion', name: 'Infusion', type: 'gap', gapH: 8, homeCard: { kind: 'pills' },
      ceiling: true, ceilingMax: 1, ceilingUnit: 'bolus',
      doses: [{ label: '1 bolus', mg: 0, pills: 1 }], quickLog: true },
    // A THIRD MEMBER OF THE ACETAMINOPHEN GROUP, so the label has something to cap. With two
    // members the cap can never fire, which is why removing it left every check green.
    { id: 'apap-chew', name: 'Chewable', type: 'gap', gapH: 4, ceilingGroup: 'apap',
      doses: [{ label: '160 mg', mg: 160 }], quickLog: true }
  ], archivedMeds: {} }));
  const ekey = Object.keys(localStorage).find(k => /entries/.test(k));
  return { ok: true, key, ekey };
});
if (!seeded.ok) { console.log('  FAIL  could not seed  |  ' + seeded.why); process.exit(1); }
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
const skip2 = page.getByRole('button', { name: 'Skip guide' });
if (await skip2.count()) { await skip2.first().click(); await page.waitForTimeout(500); }

// BACK TO HOME, EXPLICITLY. Seeding required navigating to Meds, and the reload lands there -- so
// without this every assertion below reads the Meds screen, which does not render daily-total cards
// at all. The v76 render suite passed against its own mutant for exactly this reason.
await page.getByRole('button', { name: /^Home/ }).first().click();
await page.waitForTimeout(1000);

console.log('\n1. HOME RENDERS AT ALL  (the check that was missing)');
{
  const crash = errors.filter(e => /is not defined|Cannot read propert/.test(e));
  t('no ReferenceError on any render', crash.length === 0, crash.join(' | '));
  const txt = await page.evaluate(() => (document.querySelector('main') || {}).innerText || '');
  t('the migrated medications are on screen',
    /Tylenol/.test(txt) && /Imodium/.test(txt), txt.slice(0, 80));
}

console.log('\n2. LOG A DOSE, AND THE DAILY-TOTAL CARD APPEARS AND IS RIGHT');
{
  // THE ENTRY IS WRITTEN DIRECTLY, not logged through the modal. The card render is what is under
  // test here; the logging flow has its own suites, and driving it left a time modal open that
  // intercepted every later click. A test should reach its subject by the shortest honest route.
  await page.evaluate(() => {
    const key = Object.keys(localStorage).find(k => /entries-v1$/.test(k));
    const now = Date.now();
    const rows = [
      { id: 'e1', medId: 'tylenol', ts: now - 3600000, dose: '500 mg', mg: 500 },
      { id: 'e2', medId: 'tylenol-liquid', ts: now - 1800000, dose: '15 mL', mg: 480, volumeMl: 15 },
      { id: 'e3', medId: 'imodium', ts: now - 900000, dose: '1 pill', mg: 0, pills: 1 },
      { id: 'e4', medId: 'antacid', ts: now - 800000, dose: '1 tablet', mg: 0, pills: 1 },
      { id: 'e5', medId: 'lozenge', ts: now - 700000, dose: '1 lozenge', mg: 0, pills: 1 },
      { id: 'e6', medId: 'patch', ts: now - 600000, dose: '1 patch', mg: 0, pills: 1 },
      { id: 'e7', medId: 'infusion', ts: now - 500000, dose: '1 bolus', mg: 0, pills: 1 },
      { id: 'e8', medId: 'apap-chew', ts: now - 400000, dose: '160 mg', mg: 160 }
    ];
    localStorage.setItem(key || 'chemowell-app-p-p1-entries-v1', JSON.stringify(rows));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  const sk3 = page.getByRole('button', { name: 'Skip guide' });
  if (await sk3.count()) { await sk3.first().click(); await page.waitForTimeout(500); }
  const txt = await page.evaluate(() => (document.querySelector('main') || {}).innerText || '');
  t('a daily-total card is on Home', /today/i.test(txt) && /3,000|3000/.test(txt), txt.slice(0, 120));
  // THE GROUPED LABEL. Tylenol and Tylenol Liquid share one ceiling, so a card labelled with just
  // one of their names tells a caregiver who gave 500mg of pills that they have given the group's
  // whole total under that one name.
  // CASE-INSENSITIVE. TYPE.label uppercases these, so innerText comes back "TYLENOL + TYLENOL
  // LIQUID" and a case-sensitive match failed on a card that was rendering correctly.
  t('the mg total, which really is shared, names both medications',
    /tylenol \+ tylenol liquid[^\n]* · today\s*\n?\s*[\d,]+ mg left/i.test(txt), (txt.match(/[A-Za-z +]+ · today/g) || []).join(' | '));
  // And the mL card must NOT: a millilitre cap is one medication's own labelled limit, not a shared
  // total, so a grouped label over a figure counting only the liquid is a false impression too.
  t('but the mL total, which is not shared, names only its own medication',
    /tylenol liquid · today\s*\n?\s*[\d,]+ mL left/i.test(txt) && !/tylenol \+ tylenol liquid[^\n]* · today\s*\n?\s*[\d,]+ mL/i.test(txt),
    (txt.match(/[A-Za-z +]+ · TODAY[^\n]*\n[^\n]*/gi) || []).join(' || '));
  // A COUNT OF ONE IS NEVER PLURAL, on either branch. Falsified by reverting hcUnitFor at both
  // call sites and watching all three of these go red.
  const plurals = (txt.match(/\b1 (?:doses|tablets|lozenges|pills|applications)\b/g) || []);
  t('no count of 1 is printed with a plural unit', plurals.length === 0, plurals.join(' | '));
  // AND THE FIXTURE REALLY REACHES BOTH BRANCHES. Without this the check above passes on a screen
  // that simply never printed a 1, which is how its first version passed against its own mutant.
  t('the no-limit branch is actually on screen', /No daily limit set/.test(txt),
    txt.includes('Antacid') ? 'Antacid card present, no-limit text missing' : 'Antacid card missing');
  t('and the remaining-count branch did too', /\b1 lozenge left\b/.test(txt),
    (txt.match(/\d+ \w+ left/g) || []).join(' | '));
  // THE MAX SIDE, which nothing covered. "1 / 1 patches" is what a medication limited to one a day
  // read before this.
  t('a limit of one is printed singular too', /\b1 \/ 1 patch\b/.test(txt) && !/1 \/ 1 patches/.test(txt),
    (txt.match(/\d+ \/ \d+ \w+/g) || []).join(' | '));
  // AND THE SCREEN READER GETS THE SAME SENTENCE. No suite in this repo had ever asserted an
  // aria-label, so half of every accessibility fix here has gone unread by any check.
  // A UNIT THE RULE MUST NOT TOUCH.
  t('a unit that only looks plural is left exactly as typed',
    /\b1 \/ 1 bolus\b/.test(txt) && !/\b1 \/ 1 bolu\b/.test(txt),
    (txt.match(/1 \/ 1 \w+/g) || []).join(' | '));
  // AND THE GROUPED LABEL IS CAPPED. Three members, so the third is summarised rather than listed.
  t('a group of three is summarised, not spelled out',
    /and 1 more/i.test(txt) && !/Tylenol \+ Tylenol Liquid \+ Chewable/i.test(txt),
    (txt.match(/[A-Za-z ]+\+[^\n]{0,50}/g) || []).slice(0, 2).join(' | '));
  const labels = await page.evaluate(() =>
    [...document.querySelectorAll('[role="img"][aria-label]')].map(e => e.getAttribute('aria-label')));
  t('and so does the bar\'s screen-reader label',
    labels.some(l => /\b1 of 1 patch\b/.test(l) && !/1 of 1 patches/.test(l)), labels.join(' | '));
  const crash = errors.filter(e => /is not defined|Cannot read propert/.test(e));
  t('still no ReferenceError', crash.length === 0, crash.join(' | '));
}

console.log('\n3. HISTORY RENDERS TOO  (it calls the same function, twice)');
{
  await page.getByRole('button', { name: /^Reports/ }).first().click();
  await page.waitForTimeout(1200);
  const crash = errors.filter(e => /is not defined|Cannot read propert/.test(e));
  t('no ReferenceError on Reports', crash.length === 0, crash.join(' | '));
  const txt = await page.evaluate(() => (document.querySelector('main') || {}).innerText || '');
  t('and it has content', txt.length > 40, txt.slice(0, 70));
}

console.log('\n4. THE MIGRATION IS ONE-SHOT, SO AN EDIT IS NOT REVERTED BY A RESTORE');
{
  // cwBkRestore hardcodes version: 1, and the migration used to replace `windows` unconditionally
  // and never stamp what it migrated -- so a caregiver who edited their times had them silently
  // reverted on the next restore.
  const stamped = await page.evaluate((key) => {
    const raw = JSON.parse(localStorage.getItem(key) || '{}');
    return (raw.meds || []).map(m => ({ name: m.name, schemaV: m.schemaV, homeCard: m.homeCard }));
  }, seeded.key);
  t('every migrated medication is stamped', stamped.every(m => Number(m.schemaV) >= 2),
    JSON.stringify(stamped.map(m => m.name + ':' + m.schemaV)));
  t('and carries its home card', stamped.filter(m => m.homeCard).length >= 2,
    JSON.stringify(stamped.map(m => m.name + ':' + JSON.stringify(m.homeCard))));

  // Edit a window, downgrade the config, reload: the edit must survive.
  await page.evaluate((key) => {
    const raw = JSON.parse(localStorage.getItem(key) || '{}');
    raw.version = 1;
    const t = (raw.meds || []).find(m => m.id === 'tylenol');
    if (t) t.gapH = 9;
    localStorage.setItem(key, JSON.stringify(raw));
  }, seeded.key);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);
  const after = await page.evaluate((key) => {
    const raw = JSON.parse(localStorage.getItem(key) || '{}');
    const t = (raw.meds || []).find(m => m.id === 'tylenol');
    return t ? t.gapH : null;
  }, seeded.key);
  t('an edited value survives a version-1 downgrade', after === 9, String(after));
}

await browser.close();
console.log('\n' + pass + '/' + (pass + fail) + ' checks passed' + (fail ? '  <-- FAIL' : ''));
process.exit(fail ? 1 : 0);
