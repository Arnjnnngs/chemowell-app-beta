// v81-purpose-hint.mjs -- the "What it's for" hint appears WHILE you are typing the name, and
// typing survives the redraw that makes it appear.
//
// WHY THIS EXISTS. Aaron typed "Tylenol" into a fresh medication and the hint under it still read
// "For example: settles nausea" -- for a drug the app has had a line for since app-v72. Measured on
// the shipped build with Ondansetron: nothing after typing the name, and the real description only
// after touching some OTHER field. The lookup was never broken; the screen just never redrew while
// the name field was the one in use.
//
// THE DANGER IN THE FIX IS THE FIX. Making the editor redraw while a text field has focus is
// exactly how a form throws the caregiver out mid-word: render() rebuilds the page into
// root.innerHTML and can only restore focus and the caret for an element it can find again BY ID.
// So sections 2 and 3 matter more than section 1 -- a hint that appears at the cost of eating
// keystrokes would be a worse app than the one with no hint.
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
// Longer than the editor's 450ms debounce, so every wait below is "the redraw has definitely
// happened" rather than a race. A test that sometimes wins the race is a test that sometimes lies.
const AFTER_REDRAW = 1200;

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

// The hint as the caregiver sees it: the placeholder of the field labelled "What it's for",
// found through its own label rather than by position, so a reordered form does not silently
// start measuring a different box.
const hint = () => page.evaluate(() => {
  const l = [...document.querySelectorAll('label')].find(x => /What it/i.test(x.innerText || ''));
  const inp = l ? l.querySelector('input, textarea') : null;
  return inp ? inp.getAttribute('placeholder') : '(field not found)';
});
const openAdd = async () => {
  await page.locator('[data-tour="meds-add"]').first().click();
  await page.waitForTimeout(400);
};
const cancel = async () => {
  const b = page.getByRole('button', { name: /^Cancel$/ });
  if (await b.count()) { await b.last().click(); await page.waitForTimeout(500); }
};
// TYPED, NOT FILLED. `fill()` sets the value in one shot and fires one event, which is not what a
// thumb does and would never expose a redraw eating the keystroke after it.
const typeInto = async (placeholder, text) => {
  const el = page.getByPlaceholder(placeholder).first();
  await el.click();
  await el.type(text, { delay: 40 });
};

console.log('\n1. THE HINT APPEARS WHILE YOU ARE STILL IN THE NAME FIELD');
{
  await openAdd();
  t('it starts as the example', (await hint()) === 'For example: settles nausea', await hint());
  await typeInto('Medication name', 'Ondansetron');
  await page.waitForTimeout(AFTER_REDRAW);
  const h1 = await hint();
  // NOTHING ELSE IS TOUCHED between the typing and this read. That is the whole bug: the old build
  // showed the description too, but only once some other field had fired a render.
  t('after typing the name, the hint is the real description',
    /Prevents and settles nausea/i.test(String(h1)), String(h1));
  t('and the name field still holds what was typed',
    (await page.getByPlaceholder('Medication name').first().inputValue()) === 'Ondansetron',
    await page.getByPlaceholder('Medication name').first().inputValue());
  await cancel();
}

console.log('\n2. TYPING SURVIVES THE REDRAW THAT MAKES THE HINT APPEAR');
{
  // Type past the debounce, let the page rebuild underneath the cursor, then keep typing. If focus
  // or the caret is lost, the second half lands somewhere else or nowhere at all.
  await openAdd();
  await typeInto('Medication name', 'Ondan');
  await page.waitForTimeout(AFTER_REDRAW);
  await page.keyboard.type('setron', { delay: 40 });
  await page.waitForTimeout(300);
  const val = await page.getByPlaceholder('Medication name').first().inputValue();
  t('the whole name is there, typed across the redraw', val === 'Ondansetron', val);
  const focused = await page.evaluate(() => (document.activeElement || {}).id || '(none)');
  t('and the cursor is still in that field', focused === 'med-name', focused);
  await cancel();
}

console.log('\n3. THE CARET STAYS WHERE IT WAS, NOT AT THE END');
{
  // A correction mid-word is the case that exposes a restored focus with a reset caret: the field
  // keeps focus, the letters go to the end, and the caregiver gets "Tylenolx" instead of "Tyxlenol".
  await openAdd();
  await typeInto('Medication name', 'Tylnol');
  await page.waitForTimeout(AFTER_REDRAW);
  // GUARDED, AND THAT IS NOT TIDINESS. Removing the field's id -- one of the two halves of this
  // release's fix -- used to make this line throw, which killed the whole suite instead of turning
  // one check red. A gate that crashes is a gate whose result you have to interpret; this one now
  // reports the id as missing, which is the finding.
  const caretSet = await page.evaluate(() => {
    const el = document.getElementById('med-name');
    if (!el) return false;
    el.focus(); el.setSelectionRange(3, 3); return true;
  });
  t('the name field can still be found by id after a redraw', caretSet === true, caretSet ? '' : 'med-name is gone');
  await page.keyboard.type('e', { delay: 40 });
  await page.waitForTimeout(300);
  const val = await page.getByPlaceholder('Medication name').first().inputValue();
  t('the letter landed where the cursor was', val === 'Tylenol', val);
  await page.waitForTimeout(AFTER_REDRAW);
  const h3 = await hint();
  t('and the corrected name now finds its description', /Eases pain/i.test(String(h3)), String(h3));
  await cancel();
}

console.log('\n4. THE GENERIC NAME FEEDS THE LOOKUP TOO');
{
  // describeMed falls back to med.sub, so a brand the app has never heard of still gets a
  // description when the caregiver fills in what is actually in the bottle.
  await openAdd();
  await typeInto('Medication name', 'Zzqbrand');
  await page.waitForTimeout(AFTER_REDRAW);
  t('an unknown brand alone shows the example', (await hint()) === 'For example: settles nausea', await hint());
  await typeInto('Generic name', 'pembrolizumab');
  await page.waitForTimeout(AFTER_REDRAW);
  const h4 = await hint();
  t('typing the generic name lights the hint', h4 !== 'For example: settles nausea' && !!h4, String(h4));
  const focused = await page.evaluate(() => (document.activeElement || {}).id || '(none)');
  t('and the cursor is still in the generic name field', focused === 'med-sub', focused);
  await cancel();
}

console.log('\n5. A MEDICATION THE APP DOES NOT KNOW STILL SAYS NOTHING');
{
  // The app must never invent a description. Without this, "the hint appears" could be satisfied by
  // a build that prints something for everything.
  await openAdd();
  await typeInto('Medication name', 'Zzqmadeupdrug');
  await page.waitForTimeout(AFTER_REDRAW);
  t('an unknown medication keeps the example placeholder',
    (await hint()) === 'For example: settles nausea', await hint());
  await cancel();
}

console.log('\n6. THE DRUGS THE TABLE GAINED THIS RELEASE ARE REACHABLE BY TYPING');
{
  // Aaron typed a real cancer drug and got nothing. These are read through the SAME path a
  // caregiver uses -- the editor's own hint -- not out of the table object, because a table entry
  // nothing can reach is not a description.
  const NEW = ['Keytruda', 'Carboplatin', 'Prednisone', 'Levothyroxine', 'Tamoxifen'];
  for (const name of NEW) {
    await openAdd();
    await typeInto('Medication name', name);
    await page.waitForTimeout(AFTER_REDRAW);
    const h = await hint();
    t(name + ' has a description', !!h && h !== 'For example: settles nausea' && h !== '(field not found)', String(h).slice(0, 70));
    await cancel();
  }
}

console.log('\n7. AND NOTHING THREW');
{
  const real = errors.filter(e => !/Failed to fetch dynamically imported module/i.test(String(e).split('\n')[0]));
  t('no page error at any point above', real.length === 0, real.join(' | '));
}

await browser.close();
console.log('\n' + pass + '/' + (pass + fail) + ' checks passed' + (fail ? '  <-- FAIL' : ''));
process.exit(fail ? 1 : 0);
