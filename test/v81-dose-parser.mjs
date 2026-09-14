// v81-dose-parser.mjs -- the dose PRINTED on the button and the dose COUNTED toward the daily limit
// have to be the same number. They differed by ten.
//
// WHAT WAS WRONG. `parseDoseOptions` read the amount with /(\d+(?:\.\d+)?)/, which cannot match a
// leading dot. So ".5 mg" -- the naked decimal the ISMP error-prone-designations list exists to warn
// about -- printed ".5 mg" on the card and counted FIVE milligrams. An acetaminophen ceiling of
// 3,000 mg was then reached after 300 mg of medicine. Three more of the same shape: "1/2 tablet"
// counted as one whole (dangerous direction on a pill ceiling), "5,000 units" split down its
// thousands separator into a "5" button and a "000 units" button, and "1.0 mg" kept a trailing zero
// that is on the same published list for the same reason.
//
// HOW THIS SUITE IS BUILT, and section 1 is the one that matters. Section 2 measures the parser
// through `window.__doseTest`, which is a debug hook of the kind this file already carries three of.
// That is cheap coverage of a table of written forms. But a parser can be right while the screen is
// wrong, so section 1 does not use the hook at all: it types the dose into the real Add-medication
// form, saves it, reads the button off Home, logs from it and reads what the app then believes was
// taken. Section 3 then requires the two to agree for EVERY form in the table -- because "the label
// and the count disagree" is the defect itself, not one of its instances.
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
// Longer than the editor's 450ms debounce, so a wait means "the redraw has happened" and not
// "the redraw usually happens by now".
const AFTER_REDRAW = 1200;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
const page = await ctx.newPage();
// THE CLOCK IS FROZEN AT 10:00. A daily limit is a per-CALENDAR-DAY total, so a suite that logs a
// dose at 23:59:59 and reads the total back at 00:00:01 measures an empty day and passes for the
// wrong reason. v79-warning-priority went red at 01:35 for exactly this class of reason and the
// lesson is written into its header; this one is frozen from the first line.
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
const dismiss = async () => {
  for (const n of ['Skip guide', 'Got it']) {
    const b = page.getByRole('button', { name: n, exact: n === 'Got it' });
    if (await b.count()) { await b.first().click(); await page.waitForTimeout(500); }
  }
};
await dismiss();

// ---------------------------------------------------------------------------------------------
// SECTION 1 -- THROUGH THE REAL SCREEN. No hook, no seeded config: the dose is typed into the form
// a caregiver types into, and every number below is read back off the rendered app.
// ---------------------------------------------------------------------------------------------
console.log('\n1. THE TEN-FOLD ERROR, ON THE SCREEN A CAREGIVER USES');

// `.5 mg` doses with a 2 mg daily limit. Correct: one dose uses 0.5 of 2, and a second is still
// offered. Under the defect: one dose uses 5 of 2, the limit is already blown, and the card says so.
const addMed = async ({ name, doses, limit }) => {
  await page.getByRole('button', { name: /^Meds/ }).first().click();
  await page.waitForTimeout(600);
  await page.locator('[data-tour="meds-add"]').first().click();
  await page.waitForTimeout(400);
  await page.getByPlaceholder('Medication name').first().fill(name);
  await page.getByPlaceholder('For example, 4 hours').first().fill('1');
  await page.locator('#med-doses-text').fill(doses);
  await page.waitForTimeout(AFTER_REDRAW);
  if (limit != null) {
    // The Daily limit box is disabled until Dosage options carries the picked unit -- which is
    // itself part of what this release fixes, so failing to fill it is a finding, not a skip.
    const box = page.locator('#med-daily-limit');
    const locked = await box.isDisabled();
    t('Daily limit unlocks for "' + doses + '"', !locked,
      locked ? 'still Locked -- the parser did not find an mg amount' : '');
    if (!locked) { await box.fill(String(limit)); await page.waitForTimeout(AFTER_REDRAW); }
  }
  await page.getByRole('button', { name: 'Add medication', exact: true }).first().click();
  await page.waitForTimeout(800);
  await dismiss();
};

await addMed({ name: 'Halfmil', doses: '.5 mg', limit: 2 });

// What the app STORED, read out of its own config rather than out of the form.
const stored = await page.evaluate((medName) => {
  const key = Object.keys(localStorage).find(k => /-med-v1$/.test(k));
  if (!key) return null;
  const cfg = JSON.parse(localStorage.getItem(key) || '{}');
  const med = (cfg.meds || []).find(m => m.name === medName);
  return med ? { doses: med.doses, ceiling: med.ceiling, ceilingMax: med.ceilingMax } : null;
}, 'Halfmil');
t('the medication saved with one dose option', !!stored && Array.isArray(stored.doses) && stored.doses.length === 1,
  JSON.stringify(stored && stored.doses));
const d0 = (stored && stored.doses && stored.doses[0]) || {};
t('the label is written as 0.5 mg, not .5 mg', d0.label === '0.5 mg', 'label=' + JSON.stringify(d0.label));
t('the COUNTED milligrams are 0.5, not 5', d0.mg === 0.5, 'mg=' + JSON.stringify(d0.mg));
t('the daily limit saved as 2 mg', stored && stored.ceiling === true && stored.ceilingMax === 2,
  JSON.stringify(stored && { c: stored.ceiling, m: stored.ceilingMax }));

// On Home: the button prints what was stored, and the card is not already at its limit.
await page.getByRole('button', { name: /^Home/ }).first().click();
await page.waitForTimeout(900);
// THE CARD IS FOUND THROUGH THE DOSE BUTTON AND CONFIRMED TO NAME THE MEDICATION. An earlier
// version of this helper walked the DOM by guesswork, returned "(card not found)", and the
// "nothing is at its limit" check PASSED on that string -- a check that goes green when the thing
// it measures is absent, which is the exact class this project has shipped three times.
const MISSING = '(the Halfmil card was not found on Home)';
const cardText = () => page.evaluate((missing) => {
  const btn = [...document.querySelectorAll('button')].find(b => /0\.5 mg/.test(b.innerText || ''));
  if (!btn) return missing;
  let n = btn;
  for (let i = 0; i < 8 && n; i++) {
    if ((n.innerText || '').includes('Halfmil')) return (n.innerText || '').replace(/\s+/g, ' ').trim();
    n = n.parentElement;
  }
  return missing;
}, MISSING);

const before = await cardText();
t('the Halfmil card is on Home and its dose button prints 0.5 mg',
  before !== MISSING && /0\.5 mg/.test(before), before.slice(0, 140));
t('the button never prints the naked ".5 mg" the caregiver typed',
  before !== MISSING && !/(^|[^\d.])\.5 mg/.test(before), before.slice(0, 140));
t('nothing is at its daily limit before a single dose is logged',
  before !== MISSING && !/Daily limit reached/i.test(before), before.slice(0, 140));

// Log one 0.5 mg dose the way a caregiver does: tap the dose, confirm the time.
// EVERY STEP BELOW IS GUARDED. The first version clicked unconditionally while only its assertion
// was guarded, so a mutant that left the label as ".5 mg" removed the button and the suite DIED
// instead of reporting the finding. A suite has to survive the app being broken -- that is the one
// condition it exists for.
const doseBtn = page.getByRole('button', { name: /0\.5 mg/ }).first();
const haveDose = await doseBtn.count() > 0;
t('the 0.5 mg dose button is offered and enabled', haveDose && await doseBtn.isEnabled().catch(() => false));
if (haveDose) {
  await doseBtn.click();
  await page.waitForTimeout(900);
  const confirm = page.getByRole('button', { name: 'Confirm', exact: true });
  t('tapping the dose asks which time to log it at', await confirm.count() > 0);
  if (await confirm.count()) { await confirm.first().click(); await page.waitForTimeout(900); }
} else {
  t('tapping the dose asks which time to log it at', false, 'no 0.5 mg button to tap');
}
await dismiss();

const logged = await page.evaluate(() => {
  const ek = Object.keys(localStorage).find(k => /entries-v1$/.test(k));
  const all = JSON.parse(localStorage.getItem(ek) || '[]');
  return all.filter(e => e.mg != null || e.pills != null).map(e => ({ mg: e.mg, pills: e.pills }));
});
t('a dose was actually written to the record', logged.length === 1, JSON.stringify(logged));
t('THE LOGGED DOSE COUNTED 0.5 mg, NOT 5 mg', logged.length === 1 && logged[0].mg === 0.5,
  JSON.stringify(logged));

const after = await cardText();
t('the card found again after logging', after !== MISSING, after.slice(0, 140));
t('half a milligram of a 2 mg allowance is not the limit being reached',
  after !== MISSING && !/Daily limit reached/i.test(after), after.slice(0, 160));
t('a second dose is still offered, because 1.5 mg of the allowance is left',
  await page.getByRole('button', { name: /0\.5 mg/ }).count() > 0 &&
  await page.getByRole('button', { name: /0\.5 mg/ }).first().isEnabled().catch(() => false),
  after.slice(0, 160));

// ---------------------------------------------------------------------------------------------
// SECTION 2 -- THE TABLE OF WRITTEN FORMS, through the shipping function itself.
// ---------------------------------------------------------------------------------------------
console.log('\n2. EVERY WRITTEN FORM ON THE ISMP LIST, THROUGH THE SHIPPING PARSER');

const hookOk = await page.evaluate(() => typeof (window.__doseTest || {}).parseDoseOptions === 'function');
t('the parser is reachable for measurement', hookOk);
const parse = (text) => page.evaluate((s) => window.__doseTest.parseDoseOptions(s), text);

// label: what the caregiver reads. mg / pills: what the app counts. Both are asserted on every row,
// because getting one right while the other is wrong IS the defect.
const TABLE = [
  { in: '.5 mg',        out: [{ label: '0.5 mg',      mg: 0.5,  pills: 0.5 }],  why: 'naked decimal counted as 5' },
  { in: '0.5 mg',       out: [{ label: '0.5 mg',      mg: 0.5,  pills: 0.5 }],  why: 'already correct, must stay correct' },
  { in: '1.0 mg',       out: [{ label: '1 mg',        mg: 1,    pills: 1 }],    why: 'trailing zero reads as 10' },
  { in: '2.50 mg',      out: [{ label: '2.5 mg',      mg: 2.5,  pills: 2.5 }],  why: 'trailing zero after a real decimal' },
  { in: '1/2 tablet',   out: [{ label: '1/2 tablet',  mg: 0,    pills: 0.5 }],  why: 'half counted as a whole — and the LABEL is left as written' },
  { in: '3/4 tab',      out: [{ label: '3/4 tab',     mg: 0,    pills: 0.75 }], why: 'three quarters counted as three' },
  { in: '1 1/2 tablets',out: [{ label: '1 1/2 tablets', mg: 0,  pills: 1.5 }],  why: 'mixed number counted as one' },
  { in: '½ tab',   out: [{ label: '½ tab',   mg: 0,    pills: 0.5 }],  why: 'the fraction character a phone keyboard offers' },
  { in: '1½ tabs', out: [{ label: '1½ tabs', mg: 0,    pills: 1.5 }],  why: 'mixed number written with the character' },
  { in: '5,000 units',  out: [{ label: '5,000 units', mg: 0,    pills: 5000 }], why: 'split into a 5 and a 000 units' },
  // THIS ROW EXISTS BECAUSE FALSIFICATION FOUND THE BOARD COULD NOT SEE THE mg REGEX AT ALL.
  // Putting the old regex back broke nothing measured, because the label is already normalised by
  // the time it runs. A thousands separator in front of "mg" is the case it really carries: the old
  // pattern matches "000 mg" out of "5,000 mg" and counts a 5,000 mg dose as nothing at all, which
  // on an mg ceiling means an overdose that raises no warning because it weighs zero.
  { in: '5,000 mg',     out: [{ label: '5,000 mg',  mg: 5000, pills: 5000 }], why: 'a thousands separator in an mg dose counted as 0 mg' },
  { in: '500 mg, 1000 mg', out: [{ label: '500 mg', mg: 500, pills: 500 }, { label: '1000 mg', mg: 1000, pills: 1000 }],
    why: 'REGRESSION: two strengths must still be two buttons' },
  { in: '1 patch, 2 patches', out: [{ label: '1 patch', mg: 0, pills: 1 }, { label: '2 patches', mg: 0, pills: 2 }],
    why: 'REGRESSION: the field’s own example' },

  // EVERY ROW BELOW WAS ADDED BECAUSE THE ROUND-3 AUDIT BLOCKED THIS RELEASE, and the table above
  // went green on the defect. A COMBINATION-PRODUCT STRENGTH IS NOT A FRACTION: `5/325 mg` is how
  // oxycodone/paracetamol is written on the bottle, and the first fix read it as five
  // three-hundred-and-twenty-fifths and stored 0.015 mg -- a paracetamol ceiling of 3,000 mg
  // reached after two hundred thousand tablets. The parser must leave a slash alone unless it is a
  // proper fraction over a denominator people actually write.
  { in: '5/325 mg',     out: [{ label: '5/325 mg',   mg: 325,  pills: 5 }],    why: 'BLOCK 1: a combination strength read as a fraction' },
  { in: '10/325 mg',    out: [{ label: '10/325 mg',  mg: 325,  pills: 10 }],   why: 'BLOCK 1: the other common strength of the same product' },
  { in: '7.5/325 mg',   out: [{ label: '7.5/325 mg', mg: 325,  pills: 7.5 }],  why: 'BLOCK 1: survived by accident before; must survive on purpose now' },
  { in: '80/12.5 mg',   out: [{ label: '80/12.5 mg', mg: 12.5, pills: 80 }],   why: 'BLOCK 1: a decimal on the other side' },
  { in: '300/30/10',    out: [{ label: '300/30/10',  mg: 0,    pills: 300 }],  why: 'BLOCK 1: three components; the first fix printed "10/10"' },
  { in: '25/2 mg',      out: [{ label: '25/2 mg',    mg: 2,    pills: 25 }],   why: 'BLOCK 1: improper — 25/2 is not twelve and a half of anything the app can know' },
  { in: '11/2 tabs',    out: [{ label: '11/2 tabs',  mg: 0,    pills: 11 }],   why: 'BLOCK 1: eleven halves or one and a half? The app must not guess' },
  // A SLASH THAT IS A RATE, not a fraction and not a strength. These were safe before and the guard
  // must not make them unsafe: there is no digit immediately before the slash in either.
  { in: '5 mg/mL',      out: [{ label: '5 mg/mL',    mg: 5,    pills: 5 }],    why: 'a concentration, not a fraction' },
  { in: '100 mg/m2',    out: [{ label: '100 mg/m2',  mg: 100,  pills: 100 }],  why: 'a body-surface-area dose, not a fraction' },
  // A PROPER FRACTION STILL WORKS. These are the whole point of the fraction pass and the guard
  // must not have thrown them out with the combination strengths.
  { in: '2/3 tablet',   out: [{ label: '2/3 tablet', mg: 0, pills: 2 / 3 }], why: 'a proper third still counts as a number' },
  { in: '5/6 tablet',   out: [{ label: '5/6 tablet', mg: 0, pills: 5 / 6 }], why: 'a proper sixth still counts as a number' },
  { in: '3/8 tab',      out: [{ label: '3/8 tab',    mg: 0, pills: 0.375 }], why: 'a proper eighth still counts as a number' },
];
for (const row of TABLE) {
  const got = await parse(row.in);
  const same = Array.isArray(got) && got.length === row.out.length && row.out.every((want, i) => {
    const g = got[i] || {};
    return g.label === want.label && g.mg === want.mg && (g.pills || 0) === want.pills;
  });
  t('"' + row.in + '" → ' + row.out.map(o => o.label + ' [' + o.mg + 'mg / ' + o.pills + ']').join(' + '),
    same, same ? row.why : 'got ' + JSON.stringify(got));
}

// ---------------------------------------------------------------------------------------------
// SECTION 3 -- THE CLASS, not the instances. Re-parsing the printed label must give the same
// numbers the app is already counting. If it ever does not, the card is showing one amount and
// totalling another -- which is the whole defect, in whatever new form it comes back as.
// ---------------------------------------------------------------------------------------------
console.log('\n3. THE PRINTED LABEL AND THE COUNTED NUMBER CAN NEVER DISAGREE');
for (const row of TABLE) {
  const got = await parse(row.in);
  const reparsed = await parse((got || []).map(d => d.label).join('|SPLIT|').split('|SPLIT|')[0]);
  const first = (got || [])[0] || {};
  const again = (reparsed || [])[0] || {};
  const agree = first.label === again.label && first.mg === again.mg && (first.pills || 0) === (again.pills || 0);
  t('reading "' + (first.label == null ? '?' : first.label) + '" back gives the same amount', agree,
    agree ? '' : JSON.stringify({ first, again }));
}

// ---------------------------------------------------------------------------------------------
// SECTION 4 -- SAID OUT LOUD: what this release deliberately does NOT fix.
// An exemption nobody wrote down is indistinguishable from an oversight, so each one is asserted
// rather than skipped. When the storage gains real units these three assertions must be inverted,
// and that is the point of pinning them here.
// ---------------------------------------------------------------------------------------------
// ---------------------------------------------------------------------------------------------
// SECTION 3b -- WHAT THE APP COUNTS IS NOT WHAT IT PRINTS, DELIBERATELY, AND THE DIFFERENCE MATTERS.
// The round-3 audit found that rounding a third to 0.333 let three of them total 0.999 against a
// one-tablet limit -- so the app offered a fourth and the day ended a third over. The BUTTON still
// reads 0.333, because nobody wants sixteen digits on it; the number ADDED UP is exact.
// ---------------------------------------------------------------------------------------------
console.log('\n3b. THREE THIRDS OF A TABLET ARE ONE TABLET, NOT 0.999 OF ONE');
{
  const third = (await parse('1/3 tablet'))[0] || {};
  // THE BUTTON SAYS WHAT THE CAREGIVER TYPED. An earlier version of this fix printed "0.333 tablet"
  // and this check asserted it -- which meant the suite was pinning the rewrite of a string nobody
  // misreads. A fraction was never on the ISMP list; the naked decimal and the trailing zero were.
  t('the button still reads the fraction the caregiver wrote', third.label === '1/3 tablet', JSON.stringify(third.label));
  t('but three of them count as exactly one whole', third.pills * 3 === 1, 'three count as ' + (third.pills * 3));
  const sixth = (await parse('1/6 tab'))[0] || {};
  t('and six sixths are exactly one', sixth.pills * 6 === 1, 'six count as ' + (sixth.pills * 6));
  const twothirds = (await parse('2/3 tablet'))[0] || {};
  t('and three two-thirds are exactly two', twothirds.pills * 3 === 2, 'three count as ' + (twothirds.pills * 3));
}

// ---------------------------------------------------------------------------------------------
// SECTION 3c -- A MEDICATION SAVED BEFORE THIS RELEASE IS FIXED TOO.
// The round-3 audit's second block: parseDoseOptions only ever ran inside the editor, so a
// medication already in localStorage kept its stored {label: ".5 mg", mg: 5} and went on counting
// ten times the dose printed on its own button -- while three documents called the defect fixed.
// The migration rewrites the medication's CONFIGURATION and nothing else; a dose already LOGGED is
// history and is asserted below to be left exactly as it was.
// ---------------------------------------------------------------------------------------------
console.log('\n3c. A MEDICATION SAVED BY THE OLD PARSER IS MIGRATED, AND ITS HISTORY IS NOT');
{
  const KEY = await page.evaluate(() => Object.keys(localStorage).find(k => /-med-v1$/.test(k)));
  const EK = await page.evaluate(() => Object.keys(localStorage).find(k => /entries-v1$/.test(k)));
  t('the config and entry keys exist to seed into', !!KEY && !!EK, JSON.stringify({ KEY, EK }));
  // Exactly the shape app-v80 wrote: the naked decimal kept, and 5 mg counted for it.
  await page.evaluate(({ key, ek }) => {
    localStorage.setItem(key, JSON.stringify({ version: 2, archivedMeds: {}, meds: [{
      id: 'oldpill', name: 'Oldpill', type: 'gap', schemaV: 2, quickLog: true, gapH: 1,
      ceiling: true, ceilingMax: 2,
      doses: [{ label: '.5 mg', mg: 5, pills: 5 }]
    }] }));
    // A dose logged under the old parser, with the number it believed at the time.
    localStorage.setItem(ek, JSON.stringify([{ id: 'old1', medId: 'oldpill', kind: 'dose',
      ts: Date.now() - 3600000, mg: 5, pills: 5, label: '.5 mg' }]));
  }, { key: KEY, ek: EK });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1900);
  await dismiss();
  const migrated = await page.evaluate((key) => {
    const cfg = JSON.parse(localStorage.getItem(key) || '{}');
    const m = (cfg.meds || []).find(x => x.id === 'oldpill');
    return m ? { doses: m.doses, stamp: m.doseSchemaV } : null;
  }, KEY);
  const md = (migrated && migrated.doses && migrated.doses[0]) || {};
  t('the stored medication was re-read on load', !!migrated && migrated.stamp === 1, JSON.stringify(migrated && migrated.stamp));
  t('ITS LABEL IS NO LONGER THE NAKED DECIMAL', md.label === '0.5 mg', JSON.stringify(md.label));
  t('AND IT NO LONGER COUNTS TEN TIMES THE DOSE ON ITS OWN BUTTON', md.mg === 0.5, JSON.stringify(md.mg));
  const history = await page.evaluate((ek) => JSON.parse(localStorage.getItem(ek) || '[]'), EK);
  const old = history.find(e => e.id === 'old1') || {};
  t('the dose already LOGGED is left exactly as it was — history is not rewritten',
    old.mg === 5 && old.label === '.5 mg', JSON.stringify(old));
  // And it is one-shot: a second load must not re-walk it.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1700);
  await dismiss();
  const again = await page.evaluate((key) => {
    const cfg = JSON.parse(localStorage.getItem(key) || '{}');
    const m = (cfg.meds || []).find(x => x.id === 'oldpill');
    return m ? m.doses[0] : null;
  }, KEY);
  t('and a second load leaves it alone', again && again.label === '0.5 mg' && again.mg === 0.5, JSON.stringify(again));

  // ONE-SHOT, MEASURED RATHER THAN ASSERTED FROM THE STAMP BEING PRESENT. The migration is
  // idempotent, so "did it re-run" is invisible in its own output -- which is exactly why a mutant
  // that removed the stamp from normalizeMedication's whitelist left this whole board green. What
  // IS observable is the WRITE-BACK: persistMedicationConfig rebuilds the stored object from
  // scratch, so a top-level key the app does not know about survives if and only if nothing wrote.
  // An already-correct, already-stamped config must not be written again.
  await page.evaluate((key) => {
    const cfg = JSON.parse(localStorage.getItem(key) || '{}');
    cfg.__untouched = 'sentinel';
    localStorage.setItem(key, JSON.stringify(cfg));
  }, KEY);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1900);
  await dismiss();
  const sentinel = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '{}').__untouched, KEY);
  t('a config that needs nothing is not rewritten — the migration really is one-shot',
    sentinel === 'sentinel', 'sentinel is ' + JSON.stringify(sentinel));
  // And the negative: a config that DOES need it must be written back, or the fix never reaches
  // an export, a backup, or the next launch.
  await page.evaluate((key) => {
    const cfg = JSON.parse(localStorage.getItem(key) || '{}');
    cfg.meds = cfg.meds.map(m => { const c = { ...m }; delete c.doseSchemaV; c.doses = [{ label: '.5 mg', mg: 5, pills: 5 }]; return c; });
    cfg.__untouched = 'sentinel';
    localStorage.setItem(key, JSON.stringify(cfg));
  }, KEY);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1900);
  await dismiss();
  const after2 = await page.evaluate((key) => {
    const cfg = JSON.parse(localStorage.getItem(key) || '{}');
    const m = (cfg.meds || []).find(x => x.id === 'oldpill');
    return { sentinel: cfg.__untouched, dose: m ? m.doses[0] : null };
  }, KEY);
  t('a config that DOES need it is written back, so the fix outlives the session',
    after2.sentinel === undefined && after2.dose && after2.dose.mg === 0.5, JSON.stringify(after2));
}

// ---------------------------------------------------------------------------------------------
// SECTION 3d -- THE APP SAYS WHEN IT HAS REWRITTEN WHAT THE CAREGIVER TYPED.
// The Voice raised this in the round-3 audit and it is the right call: the rewrite is defensible
// while it is always right, and the same audit proved it can be wrong. A silent rewrite that can be
// wrong is the worst of both. It must also NOT fire on every medication, or it is noise rather than
// disclosure -- so the negative cases below matter as much as the positive ones.
// ---------------------------------------------------------------------------------------------
console.log('\n3d. THE CAREGIVER IS TOLD WHEN THE APP CHANGES WHAT THEY WROTE');
{
  await page.getByRole('button', { name: /^Meds/ }).first().click();
  await page.waitForTimeout(600);
  await page.locator('[data-tour="meds-add"]').first().click();
  await page.waitForTimeout(400);
  await page.getByPlaceholder('Medication name').first().fill('Noticed');
  await page.getByPlaceholder('For example, 4 hours').first().fill('4');
  const notice = async (text) => {
    await page.locator('#med-doses-text').fill(text);
    await page.waitForTimeout(AFTER_REDRAW);
    return page.evaluate(() => {
      const el = [...document.querySelectorAll('div')].find(d => /^Will be saved as:/.test((d.innerText || '').trim()));
      return el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : null;
    });
  };
  const naked = await notice('.5 mg');
  t('a naked decimal is disclosed', !!naked && /Will be saved as: 0\.5 mg/.test(naked), JSON.stringify(naked));
  const trailing = await notice('1.0 mg');
  t('a trailing zero is disclosed', !!trailing && /Will be saved as: 1 mg/.test(trailing), JSON.stringify(trailing));
  // THE NEGATIVES. A line that appears on every medication teaches people to ignore it.
  t('an ordinary dose says nothing', (await notice('500 mg')) === null);
  t('two ordinary strengths say nothing', (await notice('500 mg, 1000 mg')) === null);
  t('a fraction says nothing, because it is no longer rewritten', (await notice('1/2 tablet')) === null);
  t('a combination strength says nothing, because it is left alone', (await notice('5/325 mg')) === null);
  t('a thousands separator says nothing — it is kept in the label', (await notice('5,000 units')) === null);
  t('an empty box says nothing', (await notice('')) === null);
  // And it must be readable on the narrowest phone this app supports.
  await page.locator('#med-doses-text').fill('.5 mg');
  await page.waitForTimeout(AFTER_REDRAW);
  await page.setViewportSize({ width: 320, height: 900 });
  await page.waitForTimeout(600);
  const fits = await page.evaluate(() => {
    const el = [...document.querySelectorAll('div')].find(d => /^Will be saved as:/.test((d.innerText || '').trim()));
    if (!el) return { found: false };
    const r = el.getBoundingClientRect();
    return { found: true, right: Math.round(r.right), clipped: el.scrollWidth > el.clientWidth + 1,
      page: Math.round(document.documentElement.scrollWidth) };
  });
  t('the notice is on screen and unclipped at 320px',
    fits.found && !fits.clipped && fits.right <= 320 && fits.page <= 320, JSON.stringify(fits));
  await page.setViewportSize({ width: 390, height: 900 });
  await page.waitForTimeout(400);
  const discard = page.getByRole('button', { name: 'Discard', exact: true });
  if (await discard.count()) { await discard.first().click(); await page.waitForTimeout(600); }
  await dismiss();
}

console.log('\n4. DELIBERATELY UNCHANGED, AND PINNED SO IT CANNOT DRIFT QUIETLY');
{
  const mcg = await parse('500 mcg');
  t('"500 mcg" still counts as 500 with no unit of its own — micrograms have nowhere to be stored yet',
    mcg.length === 1 && mcg[0].mg === 0 && mcg[0].pills === 500, JSON.stringify(mcg));
  const ml = await parse('5 mL');
  t('"5 mL" still counts as 5 with no unit of its own — same reason',
    ml.length === 1 && ml[0].mg === 0 && ml[0].pills === 5, JSON.stringify(ml));
  const units = await parse('8 units');
  t('"8 units" still counts as 8 with no unit of its own — same reason',
    units.length === 1 && units[0].mg === 0 && units[0].pills === 8, JSON.stringify(units));
  const empty = await parse('');
  t('an empty Dosage options is still no doses at all, not one blank button',
    Array.isArray(empty) && empty.length === 0, JSON.stringify(empty));
  const junk = await parse('as directed');
  t('text with no number at all saves as a plain button and counts nothing',
    junk.length === 1 && junk[0].label === 'as directed' && junk[0].mg === 0 && junk[0].pills === undefined,
    JSON.stringify(junk));
  const zero = await parse('1/0 tablet');
  // `junk &&` used to sit in front of this condition. `junk` is a non-empty array, so the term could
  // never be false: a dead clause in an assertion, found by the round-3 audit. Removed rather than
  // left as decoration -- a condition that cannot contribute is indistinguishable from one that was
  // meant to check something and does not.
  t('a divide by zero leaves the text alone instead of printing Infinity',
    zero.length === 1 && zero[0].label === '1/0 tablet', JSON.stringify(zero));
}

console.log('\n5. NOTHING THREW');
t('no page errors at any point', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
console.log('\n' + pass + '/' + (pass + fail) + ' passing' + (fail ? '  (' + fail + ' FAILING)' : ''));
process.exit(fail ? 1 : 0);
