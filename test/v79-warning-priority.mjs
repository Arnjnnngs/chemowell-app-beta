// v79-warning-priority.mjs -- the warning a caregiver sees after logging a dose.
//
// WHY THIS EXISTS. The app-v79 audit found that fix 4 did not work: the release said "red beats
// amber, and an existing red is never overwritten", and shipped the exact order-dependent behaviour
// it named, because two lines of app-v78 were left standing above the code that replaced them.
// NOT ONE of the 231 checks across the seven existing suites touches afterLog. Four of app-v79's
// eight fixes live in it. A commit message was doing a check's job -- which is the same failure
// app-v79 exists to apologise for, one release later.
//
// THE HARM. "Take all" logs several medications in one tap, calling afterLog once per medication
// into a single state.warn slot. If an amber spacing reminder can overwrite a red
// "daily limit exceeded", then whether a caregiver is told about an acetaminophen overdose depends
// on the order their medications happen to sit in a list. That is the warning that matters most in
// this app and the control most likely to cross a ceiling.
//
// It is a BROWSER test, on purpose. afterLog reads state.meds, calls dailyCeiling and
// medInteractionsFor, and writes through setState. Lifting it into a Node sandbox is what let the
// v77 equivalence suite report "zero differences" about a release with a dead Home screen.
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
await page.getByRole('button', { name: /^Meds/ }).first().click();
await page.waitForTimeout(600);
// ONE MEDICATION THROUGH THE REAL UI FIRST. The config key is PROFILE-SCOPED and does not exist
// until the app writes it; seeding a guessed key means nothing loads and the suite reports a blank
// screen that is blank for the wrong reason. The v76 render suite shipped that bug twice.
await page.locator('[data-tour="meds-add"]').first().click();
await page.waitForTimeout(400);
await page.getByPlaceholder('Medication name').first().fill('Seed');
await page.getByPlaceholder('For example, 4 hours').first().fill('4');
await page.getByRole('button', { name: 'Add medication', exact: true }).first().click();
await page.waitForTimeout(700);

// A group over its shared ceiling, plus two medications that warn about each other's timing.
const seeded = await page.evaluate(() => {
  const key = Object.keys(localStorage).find(k => /-med-v1$/.test(k));
  if (!key) return { ok: false, why: 'no medication config key' };
  localStorage.setItem(key, JSON.stringify({ version: 2, meds: [
    { id: 'tylenol', name: 'Tylenol', type: 'gap', gapH: 4, schemaV: 2, ceiling: true,
      ceilingMax: 3000, ceilingGroup: 'apap', homeCard: { kind: 'mg' },
      // groupedEvening on BOTH sides of the collision, because section 3 drives the real "Take all"
      // control and that control only exists for a group.
      doses: [{ label: '500 mg', mg: 500 }], groupedEvening: true },
    { id: 'tylenol-liquid', name: 'Tylenol Liquid', type: 'gap', gapH: 4, schemaV: 2,
      ceilingGroup: 'apap', volumeCeilingMl: 90, homeCard: { kind: 'ml' },
      doses: [{ label: '15 mL', mg: 480, volumeMl: 15 }], quickLog: true },
    { id: 'iron', name: 'Iron', type: 'win', schemaV: 2,
      // THE WHOLE DAY, not a morning window. Section 3 taps the real control, and a medication whose
      // window has closed is filtered out of the batch before the defect can be reached.
      windows: [{ start: 0, end: 24, name: 'All day' }],
      interactions: [{ withMedId: 'protonix', minGapH: 2, tone: 'amber',
        title: 'Iron + Protonix timing',
        body: 'These work best a couple of hours apart. Check with the care team.' }],
      doses: [{ label: '1 tablet', mg: 0, pills: 1 }], groupedEvening: true },
    { id: 'protonix', name: 'Protonix', type: 'win', schemaV: 2,
      windows: [{ start: 8, end: 12, name: 'Morning' }],
      doses: [{ label: '40 mg', mg: 40 }], quickLog: true }
  ], archivedMeds: {} }));
  return { ok: true, key };
});
if (!seeded.ok) { console.log('  FAIL  could not seed  |  ' + seeded.why); process.exit(1); }

// 3,020 mg of acetaminophen already logged today against a 3,000 mg group ceiling, and a Protonix
// dose 30 minutes ago so that an Iron dose now falls inside the declared 2-hour interaction window.
await page.evaluate(() => {
  const key = Object.keys(localStorage).find(k => /entries-v1$/.test(k)) || 'chemowell-app-p-p1-entries-v1';
  const now = Date.now();
  localStorage.setItem(key, JSON.stringify([
    { id: 'a1', medId: 'tylenol', ts: now - 5400000, dose: '500 mg', mg: 3020 },
    { id: 'a2', medId: 'protonix', ts: now - 1800000, dose: '40 mg', mg: 40 }
  ]));
});
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1800);
const sk2 = page.getByRole('button', { name: 'Skip guide' });
if (await sk2.count()) { await sk2.first().click(); await page.waitForTimeout(500); }

// Read the banner the app actually renders, in both orders, by calling afterLog the way "Take all"
// does: once per medication, sharing one batch token.
async function warnFor(ids) {
  return await page.evaluate((ids) => {
    if (!window.__warnTest) return { unreachable: true };
    window.__warnTest.clearWarn();
    // EXACTLY WHAT "Take all" DOES: one call per medication, sharing one batch token.
    const batch = {};
    ids.forEach(id => window.__warnTest.afterLog({ medId: id, ts: Date.now(), id: 'pending' }, batch));
    const w = window.__warnTest.getWarn();
    return w ? { tone: w.tone, title: w.title } : { tone: null, title: null };
  }, ids);
}

console.log('\n1. THE RED CEILING WARNING SURVIVES, IN EITHER ORDER');
{
  const a = await warnFor(['tylenol', 'iron']);
  const b = await warnFor(['iron', 'tylenol']);
  if (a.unreachable) {
    // A test that cannot reach its subject must FAIL, never quietly pass. This is the exact shape
    // that let "all green" mean nothing in app-v78.
    t('afterLog is reachable from the test harness', false,
      'window.__warnTest is not exposed -- the suite cannot see its subject, so nothing below ran');
  } else {
    t('Tylenol first, then Iron -> the caregiver sees the RED ceiling warning',
      a.tone === 'red', JSON.stringify(a));
    t('Iron first, then Tylenol -> the same RED warning',
      b.tone === 'red', JSON.stringify(b));
    t('and the two orders agree, which is the whole defect',
      a.title === b.title, a.title + '  vs  ' + b.title);
    t('the title names the shared total, not one member of it',
      /Tylenol \+ Tylenol Liquid/.test(String(a.title)), String(a.title));
  }
}

console.log('\n2. A RED LEFT ON SCREEN FROM EARLIER DOES NOT SILENCE A NEW AMBER');
{
  const fresh = await page.evaluate(() => {
    if (!window.__warnTest) return { unreachable: true };
    window.__warnTest.clearWarn();
    // A red raised in an earlier, separate action and never dismissed.
    window.__warnTest.afterLog({ medId: 'tylenol', ts: Date.now(), id: 'pending' });
    const before = window.__warnTest.getWarn();
    // A genuinely new amber, in its own action -- no shared batch token.
    window.__warnTest.afterLog({ medId: 'iron', ts: Date.now(), id: 'pending' });
    const after = window.__warnTest.getWarn();
    return { before: before && before.tone, after: after && after.tone,
             afterTitle: after && after.title };
  });
  if (fresh.unreachable) {
    t('afterLog is reachable from the test harness', false, 'window.__warnTest is not exposed');
  } else {
    t('the earlier red was raised', fresh.before === 'red', JSON.stringify(fresh));
    t('and a new amber in a SEPARATE action still reaches the screen',
      fresh.after === 'amber', JSON.stringify(fresh));
  }
}

console.log('\n3. THE REAL "TAKE ALL" CONTROL, WHICH IS THE ONE THE FIX ACTUALLY LIVES IN');
{
  // WHY THIS SECTION EXISTS, AND IT IS THE WHOLE POINT OF THE SUITE.
  // Sections 1 and 2 build their own `batch = {}` inside page.evaluate and hand it to afterLog.
  // That tests afterLog's CONTRACT and never the caller that has to honour it -- so the round-2
  // audit deleted the batch token from the one and only production caller, the ids.forEach inside
  // confirmTimeAndLog's 'multi' branch, and this suite stayed 6/6 while all nine suites stayed
  // green, 243 checks, with the real app back at the exact app-v78 defect.
  //
  // That is the same failure as the thing it is fixing, one level up: round 1's collection logic was
  // correct and the calling context was wrong; round 2's afterLog was correct and the calling
  // context was untested. "Falsified three ways" was true and all three mutants were inside
  // afterLog. This section drives the control a caregiver actually taps.
  //
  // Falsify it by removing `warnBatch` from that forEach and watching it go red.
  const runTakeAll = async () => {
    await page.evaluate(() => window.__warnTest && window.__warnTest.clearWarn());
    await page.getByRole('button', { name: /^Home/ }).first().click();
    await page.waitForTimeout(800);
    const takeAll = page.getByRole('button', { name: /^Take all/ });
    if (!(await takeAll.count())) return { missing: 'no Take all control on Home' };
    await takeAll.first().click();
    await page.waitForTimeout(700);
    // The confirm sits inside the dialog and the page behind it intercepts pointer events, so the
    // locator is scoped to the dialog rather than to the document.
    const dlg = page.locator('[role=dialog]');
    const ok = dlg.getByRole('button', { name: /^(Confirm|Log all)/ });
    if (!(await ok.count())) return { missing: 'no confirm inside the dialog' };
    await ok.last().click();
    // afterLog runs inside a 500 ms setTimeout.
    await page.waitForTimeout(1800);
    return await page.evaluate(() => {
      const w = window.__warnTest.getWarn();
      return w ? { tone: w.tone, title: w.title } : { tone: null, title: null };
    });
  };

  const reorder = async (order) => page.evaluate(({ key, order }) => {
    const raw = JSON.parse(localStorage.getItem(key) || '{}');
    raw.meds = order.map(id => (raw.meds || []).find(m => m.id === id)).filter(Boolean)
      .concat((raw.meds || []).filter(m => !order.includes(m.id)));
    localStorage.setItem(key, JSON.stringify(raw));
  }, { key: seeded.key, order });

  const seedDay = async () => page.evaluate(() => {
    const key = Object.keys(localStorage).find(k => /entries-v1$/.test(k)) || 'chemowell-app-p-p1-entries-v1';
    const now = Date.now();
    localStorage.setItem(key, JSON.stringify([
      { id: 'a1', medId: 'tylenol', ts: now - 6 * 3600000, dose: '500 mg', mg: 2600 },
      { id: 'a2', medId: 'protonix', ts: now - 1800000, dose: '40 mg', mg: 40 }
    ]));
  });

  const results = {};
  for (const order of [['tylenol', 'iron'], ['iron', 'tylenol']]) {
    await reorder(order);
    await seedDay();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1900);
    const sk = page.getByRole('button', { name: 'Skip guide' });
    if (await sk.count()) { await sk.first().click(); await page.waitForTimeout(500); }
    results[order.join(',')] = await runTakeAll();
  }
  const a = results['tylenol,iron'], b = results['iron,tylenol'];
  t('the real Take all control was reachable in both orders',
    !a.missing && !b.missing, JSON.stringify(a) + ' / ' + JSON.stringify(b));
  t('Tylenol first -> the caregiver is left looking at the RED ceiling warning',
    a.tone === 'red', JSON.stringify(a));
  t('Iron first -> the same RED warning', b.tone === 'red', JSON.stringify(b));
  t('so the warning no longer depends on the order of the medication list',
    a.title === b.title, String(a.title) + '  vs  ' + String(b.title));
}

console.log('\n4. AND NOTHING THREW ALONG THE WAY');
{
  // afterLog runs inside a setTimeout, so a throw there is SILENT and the dose still saves -- which
  // is the exact hazard medInteractionsFor's own comment documents. This suite collected pageerror
  // from the first line and never read it, which every other browser suite here does.
  const real = errors.filter(e => !/Capacitor|cdn|Failed to fetch dynamically/i.test(e));
  t('no page error during any of the above', real.length === 0, real.join(' | '));
}

await browser.close();
console.log('\n' + pass + '/' + (pass + fail) + ' checks passed' + (fail ? '  <-- FAIL' : ''));
process.exit(fail ? 1 : 0);
