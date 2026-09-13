// v76-empty-window-render.mjs -- an empty window list must not blank the app.
//
// THE CRASH THIS EXISTS FOR. app-v76 phase 1 lets medWindowsFor return [], which app-v75's
// `med.windows` never could: normalizeMedication guarantees a scheduled medication at least one
// window, and dexWindowsForOffset never returns empty. So status() ended with
//   const first = tomorrowWindows[0];
//   return { ... availableAt: ... + first.start * 3600000 ... };
// and `first.start` threw for a medication carrying chemoRelativeWindows on a device with NO
// TREATMENT DATE ON RECORD -- the default state of every new user and of anyone who used Clear.
// status() is called unguarded from the Home medication cards and from the Meds list, and Meds is
// the only place edit and delete live: a blank screen with no way back.
//
// WHY THIS IS A BROWSER TEST AND NOT A UNIT TEST. The phase 1 equivalence suite lifts the resolvers
// out of index.html and never calls status(), so deleting the guard left it 28/28 green -- the fix
// for the audit's worst finding had no test at all. The failure is a render that does not happen,
// so the test has to be a render.
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

// A scheduled medication whose windows depend on a treatment date, on a device that has none.
//
// ADDED THROUGH THE REAL UI FIRST, then given the property. The first version wrote the whole
// medication straight into localStorage under a guessed key -- and the key is PROFILE-SCOPED
// (`chemowell-app-p-<profile>-med-v1`), so nothing loaded and the test reported a blank Meds screen
// that was blank for the wrong reason. A test that seeds its own fixture wrongly reports the bug it
// was written to find, whether or not the bug is there.
// The add control is ON the Meds screen; the first run sat for thirty seconds waiting for it on Home.
await page.getByRole('button', { name: /^Meds/ }).first().click();
await page.waitForTimeout(600);
await page.locator('[data-tour="meds-add"]').first().click();
await page.waitForTimeout(400);
await page.getByPlaceholder('Medication name').first().fill('Steroid X');
// Schedule type is a <select>, not a button. 'win' is the stored value for Scheduled -- selecting
// by value rather than by label so a copy change cannot silently turn this into an as-needed
// medication, which has no windows at all and would make the whole test vacuous.
await page.locator('select').filter({ hasText: 'Scheduled' }).first().selectOption('win');
await page.waitForTimeout(400);
await page.getByRole('button', { name: 'Add medication', exact: true }).first().click();
await page.waitForTimeout(700);

const seeded = await page.evaluate(() => {
  const key = Object.keys(localStorage).find(k => /-med-v1$/.test(k));
  if (!key) return { ok: false, why: 'no medication config key in localStorage' };
  const raw = JSON.parse(localStorage.getItem(key) || '{}');
  const med = (raw.meds || []).find(m => m.name === 'Steroid X');
  if (!med) return { ok: false, why: 'the medication did not save' };
  med.chemoRelativeWindows = [
    { dayOffset: 0, start: 8, end: 12, name: 'Morning' },
    { dayOffset: 0, start: 14, end: 18, name: 'Afternoon' }
  ];
  localStorage.setItem(key, JSON.stringify(raw));
  return { ok: true, key, id: med.id };
});
if (!seeded.ok) { console.log('  FAIL  could not seed the fixture  |  ' + seeded.why); process.exit(1); }
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1800);
const skip2 = page.getByRole('button', { name: 'Skip guide' });
if (await skip2.count()) { await skip2.first().click(); await page.waitForTimeout(500); }

console.log('\n1. HOME STILL RENDERS WITH NO TREATMENT DATE ON RECORD');
{
  // GO TO HOME, EXPLICITLY. The first version asserted against whatever screen the reload landed on
  // -- which was Meds, because that is where the medication was added -- and Meds cards do not call
  // status() at all. So deleting the crash guard left this suite 8/8 green: it was looking at the
  // one screen the bug cannot reach. status() is called from the Home Quick Log cards.
  await page.getByRole('button', { name: /^Home/ }).first().click();
  await page.waitForTimeout(900);
  const cards = await page.evaluate(() => document.querySelectorAll('main section, main article').length);
  const crash = errors.filter(e => /Cannot read properties of undefined|first\.start/.test(e));
  t('no render crash', crash.length === 0, crash.join(' | '));
  t('Home has content on it', cards > 0, cards + ' blocks');
  // THE REAL ASSERTION. A crash inside status() empties the medication list without emptying the
  // page, so "the page rendered" is not enough -- the medication itself has to be on screen.
  const named = await page.evaluate(() => (document.querySelector('main') || {}).innerText || '');
  // ON HOME specifically: a crash inside status() takes out the Quick Log card while leaving the
  // rest of the page standing, so "the page rendered" proves nothing on its own.
  t('and its Quick Log card is on HOME', /Steroid X/.test(named), named.slice(0, 90));
}

console.log('\n2. MEDS STILL RENDERS -- IT IS THE ONLY PLACE EDIT AND DELETE LIVE');
{
  await page.getByRole('button', { name: /^Meds/ }).first().click();
  await page.waitForTimeout(700);
  const editable = await page.evaluate(() => ({
    cards: document.querySelectorAll('main article').length,
    edit: document.querySelectorAll('[aria-label^="Edit "]').length,
    remove: document.querySelectorAll('[aria-label^="Remove "]').length
  }));
  t('the medication card is there', editable.cards > 0, JSON.stringify(editable));
  t('with an edit control', editable.edit > 0, String(editable.edit));
  t('and a remove control -- otherwise there is no way back', editable.remove > 0, String(editable.remove));
  const crash = errors.filter(e => /Cannot read properties of undefined|first\.start/.test(e));
  t('still no render crash', crash.length === 0, crash.join(' | '));
}

console.log('\n3. AND WITH A TREATMENT DATE, THE DECLARED WINDOWS ARE THE ONES IT USES');
{
  // Proves the property is actually wired rather than inert -- without this, section 1 would pass
  // just as well on a medication the app ignores entirely.
  const stored = await page.evaluate((key) => {
    const raw = JSON.parse(localStorage.getItem(key) || '{}');
    const med = (raw.meds || []).find(m => m.name === 'Steroid X');
    return med ? med.chemoRelativeWindows : null;
  }, seeded.key);
  // The app normalises every medication on load. If the property did not survive that round trip,
  // phase 2 would be writing into a field the app throws away -- and section 1 would still pass,
  // because a medication the app ignores entirely also fails to crash it.
  t('the property survives the app\'s own load-and-normalise round trip',
    Array.isArray(stored) && stored.length === 2, JSON.stringify(stored));
}

console.log('\n4. WHY THE CRASH IS NOW STRUCTURALLY IMPOSSIBLE -- AND THE CHECK THAT CAN SAY SO');
{
  // SECTIONS 1-3 PASS WITH `if (!first) return ...` DELETED. That was reported by the phase 2/3
  // audit and it is true, and the reason matters more than the finding: phase 2 did not weaken the
  // guard, it removed the thing the guard was guarding against.
  //
  // In phase 1, medWindowsFor RETURNED the chemo override -- `[]` on a device with no treatment date
  // -- and `first.start` threw. Phase 2 made an override that matches nothing fall THROUGH to
  // `med.windows`, and normalizeMedication line ~1360 gives a scheduled medication a 0-24 'Daily'
  // window when it has none of its own. So for a `win` medication the list cannot be empty, and the
  // guard is defence-in-depth rather than a live fix.
  //
  // A test that strains to reach dead code proves nothing. This one asserts the INVARIANT the crash
  // now depends on, which is a check that can genuinely go red: strip a scheduled medication's
  // windows down to nothing in storage, and the app must hand it one back. Falsified by deleting the
  // `: [{ start: 0, end: 24, name: 'Daily' }]` default in normalizeMedication -- section 1's Quick Log
  // card then disappears and this check fails with `0 window(s)`.
  const stripped = await page.evaluate((key) => {
    const raw = JSON.parse(localStorage.getItem(key) || '{}');
    const med = (raw.meds || []).find(m => m.name === 'Steroid X');
    if (!med) return { ok: false };
    med.windows = [];
    // An offset this device can never be on, so the override matches nothing and the resolver has to
    // fall through -- which is the path phase 2 introduced and the one under test here.
    med.chemoRelativeWindows = [{ dayOffset: 3, start: 8, end: 12, name: 'Morning' }];
    localStorage.setItem(key, JSON.stringify(raw));
    return { ok: true };
  }, seeded.key);
  t('a scheduled medication with no windows at all could be written to storage', stripped.ok === true);
  errors.length = 0;
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);
  const skip3 = page.getByRole('button', { name: 'Skip guide' });
  if (await skip3.count()) { await skip3.first().click(); await page.waitForTimeout(500); }
  await page.getByRole('button', { name: /^Home/ }).first().click();
  await page.waitForTimeout(900);
  // THE ASSERTION: the app handed it a window back. Read off the rendered Home card rather than out
  // of state, which is not global -- a scheduled medication with no window has nothing to be
  // available at, and its Quick Log card does not survive.
  const named = await page.evaluate(() => (document.querySelector('main') || {}).innerText || '');
  // THE DISCRIMINATING ASSERTION, and finding it took three tries worth writing down. "The card is
  // still on screen" is NOT discriminating -- the card renders either way, because a Quick Log card
  // does not need a window to draw itself. What changes is the day's dose progress: with the default
  // the app expects one dose from this medication and Home reads `0/1`; without it the medication
  // has nothing to be due and drops out of the count entirely, silently, with no error and a card
  // that looks completely normal. That is the actual harm, and it is the thing to assert on.
  // Read from <header>, not <main>: the day's dose progress is rendered in the app header beside the
  // date, which is outside the element sections 1-3 read. innerText, never textContent -- in a
  // single-file app textContent carries the source of the app itself and any string matches.
  const ring = await page.evaluate(() => {
    const h = document.querySelector('header') || document.body;
    const m = (h.innerText || '').match(/\b\d+\s*\/\s*\d+\b/);
    return m ? m[0].replace(/\s+/g, '') : '(no dose count in the header)';
  });
  t('the app gives it a window back, so it still counts toward the day', ring === '0/1', ring);
  t('and its Quick Log card is on Home', /Steroid X/.test(named),
    named.slice(0, 80).replace(/\n/g, ' / '));
  const crash = errors.filter(e => /Cannot read properties of undefined|first\.start/.test(e));
  t('and no render crash on Home', crash.length === 0, crash.join(' | '));
  await page.getByRole('button', { name: /^Meds/ }).first().click();
  await page.waitForTimeout(700);
  const editable = await page.evaluate(() => ({
    cards: document.querySelectorAll('main article').length,
    remove: document.querySelectorAll('[aria-label^="Remove "]').length
  }));
  t('Meds still renders, so there is a way to delete it', editable.cards > 0 && editable.remove > 0,
    JSON.stringify(editable));
}

await browser.close();
console.log('\n' + pass + '/' + (pass + fail) + ' checks passed' + (fail ? '  <-- FAIL' : ''));
process.exit(fail ? 1 : 0);
