// v78-fence-removed.mjs -- a customer can finally use the real name of their own medication.
//
// WHAT THE FENCE WAS. RESERVED_LEGACY_MED_IDS listed thirteen real drug names a customer was
// forbidden from using. Type "Zofran" and the app silently made the id `zofran-2`, because a
// medication holding the id `zofran` would have inherited another patient's three-day post-chemo
// block. The app knew its own logic was unsafe for strangers and fenced users out of it instead of
// fixing it. Phases 1 and 2 moved every one of those rules onto properties; phase 3 removes the
// fence.
//
// THE TEST THAT MATTERS IS NOT "the id is pretty now". It is: a medication named Zofran, created by
// a real customer through the real editor, must carry NONE of the behaviour that id used to imply.
// A clean id with a dirty regimen attached would be worse than the fence.
//
// Run:  node test/v78-fence-removed.mjs     (needs a static server on 8899)
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

// Added through the real editor, exactly as a customer would.
const NAMES = ['Zofran', 'Tylenol', 'Dexamethasone', 'Imodium'];
for (const name of NAMES) {
  await page.locator('[data-tour="meds-add"]').first().click();
  await page.waitForTimeout(350);
  await page.getByPlaceholder('Medication name').first().fill(name);
  await page.getByPlaceholder('For example, 4 hours').first().fill('4');
  await page.getByRole('button', { name: 'Add medication', exact: true }).first().click();
  await page.waitForTimeout(550);
}

const stored = await page.evaluate(() => {
  const key = Object.keys(localStorage).find(k => /-med-v1$/.test(k));
  const raw = JSON.parse(localStorage.getItem(key) || '{}');
  return { version: raw.version, meds: (raw.meds || []).map(m => ({
    name: m.name, id: m.id, schemaV: m.schemaV,
    chemoBlock: m.chemoBlock, chemoRelativeWindows: m.chemoRelativeWindows,
    interactions: m.interactions, homeCard: m.homeCard, linkedTo: m.linkedTo
  })) };
});

console.log('\n1. THE REAL NAME PRODUCES THE REAL ID');
{
  for (const name of NAMES) {
    const med = stored.meds.find(m => m.name === name);
    const want = name.toLowerCase();
    t(name + ' gets the id "' + want + '", not "' + want + '-2"',
      !!med && med.id === want, med ? med.id : '(not saved)');
  }
}

console.log('\n2. AND CARRIES NONE OF THE BEHAVIOUR THAT ID USED TO IMPLY');
{
  // This is the whole point. A clean id with another patient's regimen attached to it would be
  // worse than the fence, because the fence at least made the problem visible.
  for (const name of NAMES) {
    const med = stored.meds.find(m => m.name === name) || {};
    const inherited = ['chemoBlock', 'chemoRelativeWindows', 'interactions', 'homeCard', 'linkedTo']
      .filter(k => med[k] !== undefined);
    t(name + ' inherited nothing', inherited.length === 0, inherited.join(', ') || 'clean');
  }
}

console.log('\n3. AND IS STAMPED, SO A RESTORED OLD BACKUP CANNOT REACH IT');
{
  // The config-version gate is a property of the FILE, and a file can be replaced. The stamp is a
  // property of the MEDICATION, and it is what stops a restored version-1 backup running the legacy
  // migration over a medication the customer created and named Zofran.
  for (const name of NAMES) {
    const med = stored.meds.find(m => m.name === name) || {};
    t(name + ' carries a schema stamp', Number(med.schemaV) >= 2, String(med.schemaV));
  }
  t('and the config itself is stamped', Number(stored.version) >= 2, String(stored.version));
}

console.log('\n4. FORCE THE HAZARD: DOWNGRADE THE CONFIG AND RELOAD');
{
  // Exactly what restoring a pre-phase-2 backup does. Without the stamp, the migration would run
  // over a customer's own Zofran and hand it a three-day post-chemo block.
  await page.evaluate(() => {
    const key = Object.keys(localStorage).find(k => /-med-v1$/.test(k));
    const raw = JSON.parse(localStorage.getItem(key) || '{}');
    raw.version = 1;
    localStorage.setItem(key, JSON.stringify(raw));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);
  const after = await page.evaluate(() => {
    const key = Object.keys(localStorage).find(k => /-med-v1$/.test(k));
    const raw = JSON.parse(localStorage.getItem(key) || '{}');
    return (raw.meds || []).map(m => ({ name: m.name, chemoBlock: m.chemoBlock,
      chemoRelativeWindows: m.chemoRelativeWindows, interactions: m.interactions, homeCard: m.homeCard }));
  });
  for (const name of NAMES) {
    const med = after.find(m => m.name === name) || {};
    const inherited = ['chemoBlock', 'chemoRelativeWindows', 'interactions', 'homeCard']
      .filter(k => med[k] !== undefined);
    t(name + ' STILL inherited nothing after a version-1 downgrade',
      inherited.length === 0, inherited.join(', ') || 'clean');
  }
  t('and nothing crashed', errors.filter(e => !/ERR_|jsdelivr/.test(e)).length === 0,
    errors.filter(e => !/ERR_|jsdelivr/.test(e)).join(' | '));
}

console.log('\n5. AN UNSTAMPED LEGACY MEDICATION IS STILL MIGRATED');
{
  // The other half. If the stamp check were too eager the migration would never run at all, and
  // someone restoring a genuinely old backup would silently lose their regimen -- which is the
  // failure this whole plan was built to avoid. Write a medication the way a pre-phase-2 build did:
  // a bare legacy id, no properties, no stamp.
  await page.evaluate(() => {
    const key = Object.keys(localStorage).find(k => /-med-v1$/.test(k));
    const raw = JSON.parse(localStorage.getItem(key) || '{}');
    raw.version = 1;
    raw.meds = [{ id: 'zofran', name: 'Zofran (from an old backup)', type: 'gap', gapH: 4,
      doses: [{ label: '1 tab', mg: 0 }] }];
    localStorage.setItem(key, JSON.stringify(raw));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);
  const migrated = await page.evaluate(() => {
    const key = Object.keys(localStorage).find(k => /-med-v1$/.test(k));
    const raw = JSON.parse(localStorage.getItem(key) || '{}');
    const m = (raw.meds || [])[0] || {};
    return { version: raw.version, chemoBlock: m.chemoBlock };
  });
  t('it gets its chemo block back', !!migrated.chemoBlock && migrated.chemoBlock.toDayOffset === 2,
    JSON.stringify(migrated.chemoBlock));
  t('and the config is stamped forward so it runs once', Number(migrated.version) >= 2,
    String(migrated.version));
}

await browser.close();
console.log('\n' + pass + '/' + (pass + fail) + ' checks passed' + (fail ? '  <-- FAIL' : ''));
process.exit(fail ? 1 : 0);
