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

// Unwraps the {threw} shape into an empty array so a single-value reader below reports a miss
// rather than silently measuring a property of an Error.
// Unwraps the {threw} shape into an empty array so a single-value reader below reports a miss
// rather than crashing on a property of an Error. The round-5 audit noted sections 3b and 4 index
// the result directly; they go through arr(), so a throw makes them report `undefined` — correct,
// but unreadable. `threwNote` puts the actual message on the row instead.
const arr = (r) => (Array.isArray(r) ? r : []);
const threwNote = (r) => (r && r.threw ? '  [THE PARSER THREW: ' + r.threw + ']' : '');
const hookOk = await page.evaluate(() => typeof (window.__doseTest || {}).parseDoseOptions === 'function').catch(() => false);
t('the parser is reachable for measurement', hookOk);
// A THROW IS A FINDING, NOT AN EXIT. This used to be a bare page.evaluate, so a mutant that broke
// the parser outright (a constant back in the temporal dead zone, say) made every call reject and
// killed the suite mid-run -- after printing some of its reds but before printing the rest or its
// total. That is the third helper in this file to need the same lesson: a suite exists for the case
// where the app is broken, so it has to survive the app being broken. The error comes back as a
// value, every row that depended on it goes red with the message attached, and the board finishes.
const parse = async (text) => {
  try {
    return await page.evaluate((s) => window.__doseTest.parseDoseOptions(s), text);
  } catch (e) {
    return { threw: String(e && e.message ? e.message : e).split('\n')[0] };
  }
};

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
  { in: '5/325 mg',     out: [{ label: '5/325 mg',   mg: 325,  pills: 0 }],    why: 'BLOCK 1 + round-4 BLOCK 2: the strength is kept, and NO tablet count is invented from it' },
  { in: '10/325 mg',    out: [{ label: '10/325 mg',  mg: 325,  pills: 0 }],    why: 'BLOCK 1: the other common strength of the same product' },
  { in: '7.5/325 mg',   out: [{ label: '7.5/325 mg', mg: 325,  pills: 0 }],    why: 'BLOCK 1: survived by accident before; must survive on purpose now' },
  { in: '80/12.5 mg',   out: [{ label: '80/12.5 mg', mg: 12.5, pills: 0 }],    why: 'BLOCK 1: a decimal on the other side' },
  { in: '300/30/10',    out: [{ label: '300/30/10',  mg: 0,    pills: 0 }],    why: 'BLOCK 1: three components; the first fix printed "10/10"' },
  { in: '25/2 mg',      out: [{ label: '25/2 mg',    mg: 2,    pills: 0 }],    why: 'BLOCK 1: improper — 25/2 is not twelve and a half of anything the app can know' },
  { in: '11/2 tabs',    out: [{ label: '11/2 tabs',  mg: 0,    pills: 0 }],    why: 'BLOCK 1: eleven halves or one and a half? The app must not guess — so it counts nothing' },
  // THE DENOMINATOR WHITELIST, MEASURED RATHER THAN LEFT AS AN UNDOCUMENTED EDGE. An eighth of a
  // tablet evaluates; a tenth does not, because 10 is not a denominator people write on a pill. The
  // round-4 audit was right that two amounts written the same way must not differ by ten times in
  // silence — so a rejected denominator now counts NOTHING rather than counting the numerator, and
  // this row is what stops that drifting back.
  { in: '1/8 tablet',   out: [{ label: '1/8 tablet', mg: 0, pills: 0.125 }],    why: 'an eighth is on the list and evaluates' },
  { in: '1/10 tablet',  out: [{ label: '1/10 tablet', mg: 0, pills: 0 }],       why: 'a tenth is NOT on the list — and must not count as a whole tablet' },
  { in: '1/16 tablet',  out: [{ label: '1/16 tablet', mg: 0, pills: 0 }],       why: 'nor a sixteenth' },
  { in: '1:1000',       out: [{ label: '1:1000', mg: 0, pills: 1 }],            why: 'a colon ratio is not a slash; unchanged from before' },
  // THE EDITOR TELLS THE CAREGIVER "write the amount as a plain number if it should count", and the
  // round-6 audit found that every natural way of doing so was refused: the guard tested whether the
  // STRING contained a ratio anywhere, so "1 tablet (5/325 mg)" counted nothing and the card then
  // said the app could not tell how many "1 tablet" was. An instruction that cannot be followed is
  // worse than no instruction. The guard is anchored to the counted NUMBER now, and these rows are
  // what stop it drifting back to the string.
  { in: '1 tablet (5/325 mg)',  out: [{ label: '1 tablet (5/325 mg)', mg: 325, pills: 1 }],  why: 'the instruction the app itself gives' },
  { in: '2 tablets (5/325 mg)', out: [{ label: '2 tablets (5/325 mg)', mg: 325, pills: 2 }], why: 'and with a count above one' },
  { in: '1 tablet 5/325 mg',    out: [{ label: '1 tablet 5/325 mg', mg: 325, pills: 1 }],    why: 'without the brackets' },
  { in: '1 x 5/325 mg',         out: [{ label: '1 x 5/325 mg', mg: 325, pills: 1 }],         why: 'the other way people write it' },
  // AND WITH THE STRENGTH FIRST. Every row above puts the tablet count before the combination
  // strength, and a mutant restoring "give up if the FIRST number is a ratio" left the whole board
  // green — because not one case had the other order. That is exactly the defect the round-7 audit
  // blocked: `5/325 mg (1 tablet)` counted nothing and the card said it could not tell how many that
  // was, about a string containing the words "1 tablet". The answer must not turn on which half the
  // caregiver wrote first.
  { in: '5/325 mg (1 tablet)',  out: [{ label: '5/325 mg (1 tablet)', mg: 325, pills: 1 }],  why: 'ORDER MUST NOT DECIDE THE COUNT' },
  { in: '5/325 mg 2 tablets',   out: [{ label: '5/325 mg 2 tablets', mg: 325, pills: 2 }],   why: 'same, without the brackets and with a count above one' },
  { in: '1/10 tablet (2 tabs)', out: [{ label: '1/10 tablet (2 tabs)', mg: 0, pills: 2 }],   why: 'a rejected denominator first, a real count after it' },

  // THE NUMBER AFTER A RATIO IS NOT AUTOMATICALLY AN AMOUNT, and this whole block exists because the
  // fix for the rows above walked past the ratio and counted whatever came next. On a combination
  // strength written the way a bottle writes it, what comes next is the DOSING INTERVAL. Measured on
  // that build: `5/325 mg q6h` stored six tablets, so with a four-a-day limit the card was locked at
  // zero doses logged and the only way to give the medicine was the red override — which then stamps
  // every dose as an over-limit override in the history a caregiver hands a nurse.
  //
  // The suite had no row where the first non-ratio number was NOT the amount, so it stayed green.
  // These are those rows.
  { in: '5/325 mg q6h',        out: [{ label: '5/325 mg q6h', mg: 325, pills: 0 }],        why: 'AN INTERVAL IS NOT A PILL COUNT' },
  { in: '10/325 mg q8h',       out: [{ label: '10/325 mg q8h', mg: 325, pills: 0 }],       why: 'nor is the other common one' },
  { in: '5/325 mg q4-6h',      out: [{ label: '5/325 mg q4-6h', mg: 325, pills: 0 }],      why: 'nor a range of intervals' },
  { in: '5/325mg #30',         out: [{ label: '5/325mg #30', mg: 325, pills: 0 }],         why: 'a quantity dispensed is not a dose' },
  { in: '5/325 mg (max 8 per day)', out: [{ label: '5/325 mg (max 8 per day)', mg: 325, pills: 0 }], why: 'a maximum is not a dose either' },
  { in: '5/325 mg x 2',        out: [{ label: '5/325 mg x 2', mg: 325, pills: 0 }],        why: 'and a bare multiplier says nothing about what is being counted' },
  // AND THE AMOUNT STILL COUNTS WHEN THE NEXT WORD SAYS WHAT IT IS. That is the whole distinction,
  // so both halves of it are pinned.
  // THE RANGE EXCEPTION IS GONE. Round 10 counted this as 2 and its commit claimed that "matches
  // what the app already does for a bare 1-2 tablets". It does not — a bare `1-2 tabs` counts 1.
  // A factor of two on the same ceiling, decided by whether a strength happened to precede it. It
  // counts nothing now and the card says so, which is an answer the app can defend.
  { in: '7.5/325 mg 1-2 tabs', out: [{ label: '7.5/325 mg 1-2 tabs', mg: 325, pills: 0 }], why: 'a range past a strength is not a number the app can pick' },

  // A DAILY MAXIMUM IS WRITTEN WITH EXACTLY THE WORD THE WHITELIST LOOKS FOR, which is why the word
  // list was never the answer. Every one of these counted its maximum as a dose: with a six-a-day
  // limit the card read "over limit" before anything was given, NOTHING was disclosed — a dose
  // carrying a count is by definition not an uncountable one — and the only way to give the
  // medicine was the red override, which stamps every dose over-limit in the record.
  //
  // What separates "2 tablets" from "max 8 tabs daily" is not the noun; it is that one sits against
  // the strength and the other is inside a sentence about when to give it. So nobody had to list
  // `max`, `up to`, `no more than` or `#` — they are all "something in between".
  { in: '5/325 mg q4-6h prn max 8 tabs daily',  out: [{ label: '5/325 mg q4-6h prn max 8 tabs daily', mg: 325, pills: 0 }],  why: 'A MAXIMUM IS NOT A DOSE, however it is spelled' },
  { in: '5/325 mg q6h max 8 tabs/day',          out: [{ label: '5/325 mg q6h max 8 tabs/day', mg: 325, pills: 0 }],          why: 'the short form of the same thing' },
  { in: '5/325 mg up to 6 tabs per day',        out: [{ label: '5/325 mg up to 6 tabs per day', mg: 325, pills: 0 }],        why: 'and the plain-English form' },
  { in: '5/325 mg no more than 12 tablets in 24 hours', out: [{ label: '5/325 mg no more than 12 tablets in 24 hours', mg: 325, pills: 0 }], why: 'and the long one' },
  { in: '5/325 mg #30 tablets',                 out: [{ label: '5/325 mg #30 tablets', mg: 325, pills: 0 }],                 why: 'a quantity dispensed, with the noun attached' },
  // AND THE AMOUNT STILL COUNTS WHEN IT SITS AGAINST THE STRENGTH. Both halves pinned, because the
  // rule is a position and not a vocabulary.
  { in: '5/325 mg 2 tablets every 6 hours',     out: [{ label: '5/325 mg 2 tablets every 6 hours', mg: 325, pills: 2 }],     why: 'a real amount with a schedule after it' },
  { in: '80/12.5 mg 1 tablet daily',            out: [{ label: '80/12.5 mg 1 tablet daily', mg: 12.5, pills: 1 }],           why: 'a real combination product written the ordinary way' },
  // CAPITALS ARE THE NORM ON A PRINTED LABEL. This lost its count while "1 tablet" kept it.
  { in: '5/325 mg 1 Tablet',                    out: [{ label: '5/325 mg 1 Tablet', mg: 325, pills: 1 }],                    why: 'the whitelist is case-insensitive now' },

  // A LABEL PUTS PUNCTUATION BETWEEN THE STRENGTH AND THE COUNT, and rejecting it cost a real count
  // for no reason anyone would defend. Found by the first LOOSENING mutants ever written for this
  // parser: every mutant across five rounds had pushed the rule back towards its old behaviour and
  // asked whether the tightening held, and none asked what the tightening now admits.
  { in: '5/325 mg - 1 tablet',  out: [{ label: '5/325 mg - 1 tablet', mg: 325, pills: 1 }],  why: 'a dash is a separator, not a sentence' },
  { in: '5/325 mg: 2 tabs',     out: [{ label: '5/325 mg: 2 tabs', mg: 325, pills: 2 }],     why: 'and so is a colon' },
  { in: '5/325 mg. 2 tablets',  out: [{ label: '5/325 mg. 2 tablets', mg: 325, pills: 2 }],  why: 'and a full stop' },
  // AND THE SEPARATOR DOES NOT OPEN THE DOOR THE PREVIOUS ROUNDS CLOSED. One word may still stand
  // between the strength and the count, and `max` is a word.
  { in: '5/325 mg - max 8 tabs daily', out: [{ label: '5/325 mg - max 8 tabs daily', mg: 325, pills: 0 }], why: 'a separator before a maximum is still a maximum' },
  { in: '5/325 mg: up to 6 tabs',      out: [{ label: '5/325 mg: up to 6 tabs', mg: 325, pills: 0 }],      why: 'same' },
  // TWO WORDS IN BETWEEN IS STILL TOO MANY. A loosening mutant that allowed a second one survived a
  // 209-check board, so the limit of one is pinned rather than assumed.
  { in: '5/325 mg tabs 8',             out: [{ label: '5/325 mg tabs 8', mg: 325, pills: 0 }],             why: 'exactly one word may stand between the strength and the count' },
  // UNITS DELIBERATELY OFF THE WHITELIST. A mutant adding them survived unseen. These lose their
  // count after a strength the app cannot read — and the card says so, which is the honest answer.
  // Widening the list is a decision somebody makes, not a drift: these rows make it fail first.
  { in: '5/325 mg 2 tsp',              out: [{ label: '5/325 mg 2 tsp', mg: 325, pills: 0 }],              why: 'a teaspoon is not on the list, and that is deliberate' },
  { in: '5/325 mg 1 vial',             out: [{ label: '5/325 mg 1 vial', mg: 325, pills: 0 }],             why: 'nor a vial' },
  { in: '5/325 mg 8 units',            out: [{ label: '5/325 mg 8 units', mg: 325, pills: 0 }],            why: 'nor units — the storage has nowhere to put one yet' },
  { in: '5/325 mg (2 capsules)', out: [{ label: '5/325 mg (2 capsules)', mg: 325, pills: 2 }], why: 'a different countable noun' },
  { in: '5/325 mg 1 patch',    out: [{ label: '5/325 mg 1 patch', mg: 325, pills: 1 }],    why: 'and another' },
  // A WORD THAT MERELY STARTS LIKE ONE OF THEM IS NOT ONE OF THEM. Without a word boundary on the
  // whitelist, "tablespoons" matches "tab" and "dropperfuls" matches "drop" — so a liquid measure
  // would be counted as that many tablets against a tablet ceiling. A mutant removing the boundary
  // left every other row green, which is how this gap was found rather than guessed at.
  { in: '5/325 mg 2 tablespoons', out: [{ label: '5/325 mg 2 tablespoons', mg: 325, pills: 0 }], why: 'a tablespoon is not a tablet' },
  { in: '1/10 syrup 3 dropperfuls', out: [{ label: '1/10 syrup 3 dropperfuls', mg: 0, pills: 0 }], why: 'nor is a dropperful a drop' },
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
  // `pills: 0` IN THE TABLE MEANS "no count at all", and that is a different thing from a count of
  // zero -- the app leaves the key off entirely when it cannot derive an amount, exactly as it does
  // for "as directed". Folding the two together with `(g.pills || 0)` would let a literal 0 pass for
  // an absent key and vice versa, on rows whose whole subject is the app refusing to invent a number.
  if (got && got.threw) { t('"' + row.in + '" — THE PARSER THREW', false, got.threw); continue; }
  const same = Array.isArray(got) && got.length === row.out.length && row.out.every((want, i) => {
    const g = got[i] || {};
    if (want.pills === 0 && g.pills !== undefined) return false;
    return g.label === want.label && g.mg === want.mg && (g.pills === undefined ? 0 : g.pills) === want.pills;
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
  if (got && got.threw) { t('re-reading "' + row.in + '" — THE PARSER THREW', false, got.threw); continue; }
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
  const third = arr(await parse('1/3 tablet'))[0] || {};
  // THE BUTTON SAYS WHAT THE CAREGIVER TYPED. An earlier version of this fix printed "0.333 tablet"
  // and this check asserted it -- which meant the suite was pinning the rewrite of a string nobody
  // misreads. A fraction was never on the ISMP list; the naked decimal and the trailing zero were.
  t('the button still reads the fraction the caregiver wrote', third.label === '1/3 tablet', JSON.stringify(third.label));
  t('but three of them count as exactly one whole', third.pills * 3 === 1, 'three count as ' + (third.pills * 3));
  const sixth = arr(await parse('1/6 tab'))[0] || {};
  t('and six sixths are exactly one', sixth.pills * 6 === 1, 'six count as ' + (sixth.pills * 6));
  const twothirds = arr(await parse('2/3 tablet'))[0] || {};
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
  // IF THERE IS NO CONFIG KEY, THE APP DID NOT START. Every assertion below reads stored state, so
  // without this guard a broken app takes the suite down instead of being reported by it -- which is
  // exactly what a mutant putting a constant back into the temporal dead zone did.
  t('the config and entry keys exist to seed into', !!KEY && !!EK, JSON.stringify({ KEY, EK }));
  const canSeed = !!KEY && !!EK;
  if (!canSeed) {
    t('SKIPPED: the app wrote no medication config, so nothing below could be measured', false,
      'this is a finding, not a pass');
  } else {
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
  // NAMED FOR WHAT IT MEASURES. It read "the migration really is one-shot", and the round-4 audit
  // was right that it cannot see that: M15 drops the stamp, the migration re-walks every medication
  // on every load, and this check stays green. A sentinel proves no WRITE happened. The name is what
  // anyone reads off the board, so the name has to be the honest half.
  t('an already-correct config is not written back to disk',
    sentinel === 'sentinel', 'sentinel is ' + JSON.stringify(sentinel));
  // And the negative: a config that DOES need it must be written back, or the fix never reaches
  // an export, a backup, or the next launch.
  await page.evaluate((key) => {
    const cfg = JSON.parse(localStorage.getItem(key) || '{}');
    cfg.meds = (cfg.meds || []).map(m => { const c = { ...m }; delete c.doseSchemaV; c.doses = [{ label: '.5 mg', mg: 5, pills: 5 }]; return c; });
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
}

// ---------------------------------------------------------------------------------------------
// SECTION 3d -- THE APP SAYS WHEN IT HAS REWRITTEN WHAT THE CAREGIVER TYPED.
// The Voice raised this in the round-3 audit and it is the right call: the rewrite is defensible
// while it is always right, and the same audit proved it can be wrong. A silent rewrite that can be
// wrong is the worst of both. It must also NOT fire on every medication, or it is noise rather than
// disclosure -- so the negative cases below matter as much as the positive ones.
// ---------------------------------------------------------------------------------------------
// ---------------------------------------------------------------------------------------------
// SECTION 3e -- EVERY DOOR INTO THE MEDICATION LIST, NOT JUST THE ONE THAT WAS BROKEN.
// The round-4 audit's BLOCK 1: "Bring back" restores an archived medication straight to disk
// without the migration, so one archived under an older release came back counting ten times its
// dose and Home showed it over its limit before anything was logged. The audit's own words on the
// finding: it is not "restore was missed", it is that more than one path writes into the list and
// only one of them migrates. So this section walks them ALL -- and section 3c could never have
// caught it, because every path 3c exercises enters through the migrating door.
// ---------------------------------------------------------------------------------------------
console.log('\n3e. EVERY WAY A MEDICATION GETS ONTO THE LIST PRODUCES A MIGRATED ONE');
{
  const KEY = await page.evaluate(() => Object.keys(localStorage).find(k => /-med-v1$/.test(k)));
  t('the medication config key exists, so this section is measuring something', !!KEY, JSON.stringify(KEY));
  if (!KEY) { t('SKIPPED: no config key, so no door could be walked', false, 'a finding, not a pass'); }
  else {
  // DOOR 1: restore from the archive. Seeded in exactly the shape a delete writes, with the dose
  // numbers app-v80 would have stored.
  await page.evaluate((key) => {
    localStorage.setItem(key, JSON.stringify({ version: 2, meds: [], archivedMeds: {
      backpill: { name: 'Backpill', sub: '', removedAt: Date.now() - 86400000, pausePeriods: [],
        config: { id: 'backpill', name: 'Backpill', type: 'gap', schemaV: 2, quickLog: true, gapH: 1,
          ceiling: true, ceilingMax: 2, doses: [{ label: '.5 mg', mg: 5, pills: 5 }] } }
    } }));
  }, KEY);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1900);
  await dismiss();
  await page.getByRole('button', { name: /^Meds/ }).first().click();
  await page.waitForTimeout(700);
  const bring = page.getByRole('button', { name: /Bring back/i }).first();
  const haveBring = await bring.count() > 0;
  t('the archived medication offers Bring back', haveBring);
  if (haveBring) {
    await bring.click();
    await page.waitForTimeout(500);
    // THE SAME BUTTON, ARMED. Its VISIBLE text becomes "Yes, bring it back" but its accessible name
    // — which is what getByRole matches — is the aria-label, "Confirm bringing back <name>". Looking
    // for the visible text found nothing, the helper quietly did nothing, and the restore never
    // happened: the suite would have been measuring an empty list and calling it a pass.
    const yes = page.getByRole('button', { name: /Confirm bringing back/i }).first();
    t('the armed button asks for confirmation before restoring', await yes.count() > 0);
    if (await yes.count()) { await yes.click(); await page.waitForTimeout(900); }
  }
  await dismiss();
  // READ THE DISK, not the screen. The defect was that the WRONG numbers were persisted; the app
  // then healed itself on the next full load, which is why reading state after a reload would have
  // shown green while a backup taken in between carried the wrong configuration forward.
  const restored = await page.evaluate((key) => {
    const cfg = JSON.parse(localStorage.getItem(key) || '{}');
    const m = (cfg.meds || []).find(x => x.id === 'backpill');
    return m ? { dose: m.doses && m.doses[0], stamp: m.doseSchemaV } : null;
  }, KEY);
  t('Bring back writes a MIGRATED medication to disk, not the archived one',
    !!restored && restored.stamp === 1 && restored.dose && restored.dose.label === '0.5 mg' && restored.dose.mg === 0.5,
    JSON.stringify(restored));
  // And the screen agrees, in the same session, with no reload to rescue it.
  await page.getByRole('button', { name: /^Home/ }).first().click();
  await page.waitForTimeout(900);
  const card = await page.evaluate(() => {
    const el = [...document.querySelectorAll('*')].find(e => (e.innerText || '').includes('Backpill') &&
      ![...e.children].some(c => (c.innerText || '').includes('Backpill')));
    let n = el;
    for (let i = 0; i < 7 && n; i++) {
      if (/over limit|Available|Log/i.test(n.innerText || '')) return (n.innerText || '').replace(/\s+/g, ' ').trim();
      n = n.parentElement;
    }
    return '(card not found)';
  });
  t('and the restored card is not falsely over its limit in the same session',
    card !== '(card not found)' && !/over limit/i.test(card), card.slice(0, 140));

  // DOOR 2: THE LIST AS A WHOLE, and stated honestly after the round-5 audit read it. This does NOT
  // prove a future door will be caught -- it reads the disk at one moment, after one restore, and a
  // door that writes and then reloads would have been repaired by the load before this looks. What
  // it does prove is that the restore above left nothing unmigrated behind it, and that the list is
  // not empty while it says so. The real guard against the next door is the write model naming every
  // write before the code is written; a check cannot substitute for that and should not claim to.
  const unstamped = await page.evaluate((key) => {
    const cfg = JSON.parse(localStorage.getItem(key) || '{}');
    const all = cfg.meds || [];
    return { total: all.length, bad: all.filter(m => !(Number(m.doseSchemaV) >= 1)).map(m => m.id) };
  }, KEY);
  // NOT VACUOUS. An empty list has no unmigrated medication in it either, so the count is asserted
  // as well -- otherwise this check reports green loudest at the moment the restore silently failed
  // and there is nothing on the list at all.
  t('no medication anywhere on the list is unmigrated, and there is one to check',
    unstamped.total >= 1 && unstamped.bad.length === 0, JSON.stringify(unstamped));
  }
}

console.log('\n3d. THE CAREGIVER IS TOLD WHEN THE APP CHANGES WHAT THEY WROTE');
{
  await page.getByRole('button', { name: /^Meds/ }).first().click();
  await page.waitForTimeout(600);
  await page.locator('[data-tour="meds-add"]').first().click();
  await page.waitForTimeout(400);
  await page.getByPlaceholder('Medication name').first().fill('Noticed');
  await page.getByPlaceholder('For example, 4 hours').first().fill('4');
  // THE HELPER PROVES THE EDITOR IS STILL OPEN BEFORE IT REPORTS AN ABSENCE. It returned null both
  // when the notice was absent and when the selector found nothing at all, so a future change that
  // closed the editor early would have turned six negative assertions into six free passes. The
  // round-4 audit flagged the shape while it was still latent; it is closed while it is cheap.
  const notice = async (text) => {
    await page.locator('#med-doses-text').fill(text);
    await page.waitForTimeout(AFTER_REDRAW);
    const box = await page.locator('#med-doses-text').count();
    if (!box) return '(THE DOSAGE OPTIONS BOX IS NOT ON SCREEN — this suite is not measuring what it thinks)';
    return page.evaluate(() => {
      const el = document.querySelector('[data-dose-rewritten]');
      return el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : null;
    });
  };
  const naked = await notice('.5 mg');
  t('a naked decimal is disclosed', !!naked && /Will be saved as: 0\.5 mg/.test(naked), JSON.stringify(naked));
  // THE PROMISE THAT CAME OUT. "so they cannot be misread" was an absolute claim about how a person
  // reads, made by an app that had just been shown to get a number wrong. Asserted absent so it
  // cannot come back in a later edit.
  t('and it does not promise the amount cannot be misread', !!naked && !/cannot be misread/i.test(naked),
    JSON.stringify(naked));
  t('it says what it actually did instead', !!naked && /leading zero is added and a trailing zero removed/i.test(naked),
    JSON.stringify(naked));
  // AND IT CLAIMS ONLY WHAT IS KNOWN. "the two amounts most often read wrong" was a ranking nobody
  // here has measured -- the published list names both as error-prone, it does not order them.
  t('and it does not rank them without evidence', !!naked && !/most often/i.test(naked), JSON.stringify(naked));
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
    const el = document.querySelector('[data-dose-rewritten]');
    if (!el) return { found: false };
    const r = el.getBoundingClientRect();
    return { found: true, right: Math.round(r.right), clipped: el.scrollWidth > el.clientWidth + 1,
      page: Math.round(document.documentElement.scrollWidth) };
  });
  t('the notice is on screen and unclipped at 320px',
    fits.found && !fits.clipped && fits.right <= 320 && fits.page <= 320, JSON.stringify(fits));
  await page.setViewportSize({ width: 390, height: 900 });
  await page.waitForTimeout(400);

  // AND THE SAME THING IN THE EDITOR, WHILE THE LIMIT IS BEING SET. The card notice tells a
  // caregiver about a medication that already exists; this one stops her creating the situation.
  // It had no check at all until a mutant emptied it and the whole board stayed green -- which is
  // the exact shape of "a role whose output nobody reads", one level down.
  const editorNotice = () => page.evaluate(() => {
    const el = document.querySelector('[data-uncounted="editor"]');
    return el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : null;
  });
  await page.locator('#med-doses-text').fill('1 tablet, 5/325 mg');
  await page.waitForTimeout(AFTER_REDRAW);
  await page.selectOption('#med-daily-limit-unit', 'pills');
  await page.waitForTimeout(AFTER_REDRAW);
  t('the daily limit unlocks, because one option does carry a pill count',
    !(await page.locator('#med-daily-limit').isDisabled()));
  await page.locator('#med-daily-limit').fill('4');
  await page.waitForTimeout(AFTER_REDRAW);
  const en = await editorNotice();
  t('THE EDITOR NAMES THE OPTION THE LIMIT WILL NOT COUNT',
    !!en && /5\/325 mg/.test(en), JSON.stringify(en));
  t('and it does not name the one that will', !!en && !/1 tablet/.test(en), JSON.stringify(en));
  t('and it says what to do about it', !!en && /plain number/i.test(en), JSON.stringify(en));
  // THE NEGATIVES. This line must not appear on an ordinary medication, or it is wallpaper.
  await page.locator('#med-doses-text').fill('1 tablet, 2 tablets');
  await page.waitForTimeout(AFTER_REDRAW);
  t('two ordinary options say nothing', (await editorNotice()) === null);
  await page.selectOption('#med-daily-limit-unit', 'mg');
  await page.waitForTimeout(AFTER_REDRAW);
  await page.locator('#med-doses-text').fill('500 mg, 5/325 mg');
  await page.waitForTimeout(AFTER_REDRAW);
  t('an mg limit says nothing, because it counts the mg fine', (await editorNotice()) === null);

  const discard = page.getByRole('button', { name: 'Discard', exact: true });
  if (await discard.count()) { await discard.first().click(); await page.waitForTimeout(600); }
  await dismiss();
}

// ---------------------------------------------------------------------------------------------
// SECTION 3f -- A LIMIT IS NEVER SILENTLY ENFORCED AND NEVER SILENTLY IGNORED.
//
// The round-5 audit's block, and it is the worst of the six rounds because it errs toward giving
// MORE medicine. Round 4 refused this release because `5/325 mg` counted five tablets and locked a
// four-a-day card before breakfast. Round 6 answered by refusing to invent a count — right as far
// as it went — and left every armed ceiling on disk switched on. Measured on that build: six doses
// tapped in a row, every one logged, no block, no warning, "Available" the whole way.
//
// THE TWO WRONG ANSWERS ARE IN TENSION AND THE CHECK HAS TO CATCH BOTH. Counting five locks a card
// that should be open; counting nothing opens a ceiling that should hold. So this section asserts
// the third thing: the count is not invented, AND the caregiver is told on the card. A mutant that
// restores either one-line answer turns it red.
// ---------------------------------------------------------------------------------------------
console.log('\n3f. A DOSE THE APP CANNOT COUNT IS SAID OUT LOUD, WHERE THE DOSE IS GIVEN');
{
  const KEY = await page.evaluate(() => Object.keys(localStorage).find(k => /-med-v1$/.test(k)));
  t('a config key exists to seed into', !!KEY);
  const seedAndOpenHome = async (meds) => {
    await page.evaluate(({ key, meds }) => {
      localStorage.setItem(key, JSON.stringify({ version: 2, archivedMeds: {}, meds }));
      const ek = Object.keys(localStorage).find(k => /entries-v1$/.test(k));
      if (ek) localStorage.setItem(ek, '[]');
    }, { key: KEY, meds });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1900);
    await dismiss();
    await page.getByRole('button', { name: /^Home/ }).first().click();
    await page.waitForTimeout(900);
  };
  // BY AN EXPLICIT HOOK, NOT BY ITS OWN WORDS. The first version searched every div for the
  // sentence and `find` returns the OUTERMOST match -- which is the whole page. So the text it
  // returned contained every dose button on screen, and a check asserting the notice does not
  // mention "1 tablet" failed because a button elsewhere did. Rule 5: elements by data- hooks,
  // never by text.
  const noticeText = () => page.evaluate(() => {
    const el = document.querySelector('[data-uncounted="card"]');
    return el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : null;
  });
  // Exactly how an app-v80 device stores a Percocet card: a combination strength and a tablet limit.
  const combo = (extra) => Object.assign({ id: 'perco', name: 'Perco', type: 'gap', schemaV: 2,
    quickLog: true, gapH: 0, ceiling: true, ceilingMax: 4, ceilingUnit: 'pills',
    doses: [{ label: '5/325 mg', mg: 325, pills: 5 }] }, extra || {});

  await seedAndOpenHome([combo()]);
  const stored = await page.evaluate((key) => {
    const m = (JSON.parse(localStorage.getItem(key) || '{}').meds || [])[0];
    return m && m.doses ? m.doses[0] : null;
  }, KEY);
  t('the app does not invent a tablet count it cannot derive', !!stored && stored.pills === undefined,
    JSON.stringify(stored));
  const n1 = await noticeText();
  t('AND THE CARD SAYS THE LIMIT IS NOT COUNTING THIS DOSE', !!n1 && /5\/325 mg/.test(n1), JSON.stringify(n1));
  t('it names the limit that is not being applied', !!n1 && /4 pills/.test(n1), JSON.stringify(n1));
  // "Every other amount still counts" would be false here — there is no other amount.
  // AND IT DOES NOT CALL A GROUP CARD OR A MODAL "this card". The sentence renders in three places
  // now and it is about the MEDICATION, not the furniture around it.
  t('and it does not reassure about other amounts when there are none',
    !!n1 && /No dose of this medication is being counted/.test(n1) && !/other amounts still count/i.test(n1),
    JSON.stringify(n1));
  t('and it never claims to be talking about "this card"', !!n1 && !/this card/i.test(n1), JSON.stringify(n1));

  // THE MIXED LIST — the shape the audit measured the editor gate failing on. Two countable doses
  // and one that is not: the limit genuinely applies to two of the three, so the sentence must say
  // that rather than claim the whole limit is dead.
  await seedAndOpenHome([combo({ doses: [
    { label: '1 tablet', mg: 0, pills: 1 },
    { label: '2 tablets', mg: 0, pills: 2 },
    { label: '5/325 mg', mg: 325, pills: 5 } ] })]);
  const n2 = await noticeText();
  t('a mixed dose list still names only the dose that cannot be counted',
    !!n2 && /5\/325 mg/.test(n2) && !/1 tablet/.test(n2), JSON.stringify(n2));
  t('and it says the other amounts DO still count',
    !!n2 && /other amounts still count/i.test(n2), JSON.stringify(n2));

  // A LIMIT IN MILLIGRAMS IS NOT AFFECTED. `5/325 mg` carries mg 325, so an mg ceiling counts it
  // correctly and there is nothing to disclose. A notice here would be noise.
  await seedAndOpenHome([combo({ ceilingUnit: undefined, ceilingMax: 3000 })]);
  t('an mg limit on the same medication says nothing, because it counts fine',
    (await noticeText()) === null);

  // AND NEITHER IS AN ORDINARY MEDICATION. The notice must be the exception, or it is wallpaper.
  await seedAndOpenHome([combo({ doses: [{ label: '1 tablet', mg: 0, pills: 1 }] })]);
  t('an ordinary tablet with a tablet limit says nothing', (await noticeText()) === null);
  await seedAndOpenHome([{ id: 'plain', name: 'Plain', type: 'gap', schemaV: 2, quickLog: true, gapH: 4,
    doses: [{ label: '500 mg', mg: 500, pills: 500 }] }]);
  t('a medication with no limit at all says nothing', (await noticeText()) === null);

  // THE LIMIT THAT COUNTS NOTHING BECAUSE THERE IS NOTHING TO COUNT. A medication with a pill limit
  // and no dose options logs no amount at all, so the limit can never be reached however many times
  // the plain Log button is tapped. Same defect, nothing to name, so the sentence is different.
  await seedAndOpenHome([combo({ doses: [] })]);
  const n3 = await noticeText();
  t('a pill limit with no amounts set says so too', !!n3 && /no amounts set/i.test(n3), JSON.stringify(n3));

  // EVERY PLACEMENT THE EDITOR OFFERS, NOT THE ONE THE DEVELOPER TESTED. The round-6 audit's block:
  // the notice was wired into `renderToday`'s standalone card and nowhere else, so on the Morning,
  // Afternoon and Evening group cards -- three of the four placements -- the limit was still
  // silently disarmed. Six doses logged past a four-a-day ceiling with nothing on the page. This
  // section is the class, and it is written so a fifth placement added later fails it too.
  for (const [flag, where] of [['groupedMorning', 'Morning'], ['groupedAfternoon', 'Afternoon'], ['groupedEvening', 'Evening']]) {
    const med = combo({ quickLog: false });
    med[flag] = true;
    await seedAndOpenHome([med]);
    const anyNotice = await page.evaluate(() => {
      const els = [...document.querySelectorAll('[data-uncounted]')];
      return els.length ? els.map(e => (e.innerText || '').replace(/\s+/g, ' ').trim()).join(' | ') : null;
    });
    t('the ' + where + ' group card says the limit is not counting this dose',
      !!anyNotice && /5\/325 mg/.test(anyNotice), JSON.stringify(anyNotice));
  }
  // THE COMPLETENESS CHECK, read off the app's own hooks. This is the THIRD version of it and the
  // first that measures anything: v1 fell back to a list copied into this file; v2 harvested
  // on-screen text matching /(Home card|meds group)$/, which is the same list written as a naming
  // convention -- a sixth placement called "Bedtime list" left the whole board green, and the
  // editor's own `Custom (current mix)` option was already invisible to it. Every option now
  // carries `data-placement-option="<key>"`, so a new one cannot hide behind its label.
  {
    await page.getByRole('button', { name: /^Meds/ }).first().click();
    await page.waitForTimeout(700);
    await page.locator('[data-tour="meds-add"]').first().click();
    await page.waitForTimeout(600);
    const keys = await page.evaluate(() =>
      [...document.querySelectorAll('[data-placement-option]')].map(e => e.getAttribute('data-placement-option')));
    t('the placement picker is on screen and every option is hooked', keys.length > 0, JSON.stringify(keys));
    // Asserted above, one by one: own card, and the three group cards.
    const COVERED = ['own', 'morning', 'afternoon', 'evening'];
    // EXEMPT, SAID OUT LOUD. 'none' puts no logging control on Home, so there is no dose to
    // disclose about. 'custom' is not a placement -- it is the editor offering to keep a mix the
    // caregiver already has, and whichever cards that mix lands on are the four above.
    const EXEMPT = ['none', 'custom'];
    const unaccounted = keys.filter(k => COVERED.indexOf(k) === -1 && EXEMPT.indexOf(k) === -1);
    t('every Home placement that can log a dose is covered above, and the rest are named exempt',
      keys.length > 0 && unaccounted.length === 0, 'unaccounted: ' + JSON.stringify(unaccounted) + ' of ' + JSON.stringify(keys));
    const discard2 = page.getByRole('button', { name: 'Discard', exact: true });
    if (await discard2.count()) { await discard2.first().click(); await page.waitForTimeout(600); }
    await dismiss();
  }

  // THE FIFTH DOOR: "TAKE ALL". The class is not "every placement" -- it is EVERY CONTROL THAT
  // WRITES A DOSE. The batch button sits in the group card's HEADER while the row notice is in its
  // list, and on a six-medication group at 320px the notice measured 404px below the fold. So the
  // caregiver taps a button whose consequence is explained off-screen and confirms in a modal that
  // names every medication and said nothing. Six taps logged six doses past a four-a-day ceiling.
  {
    const uncountable = combo({ quickLog: false, id: 'perco', name: 'Perco' });
    uncountable.groupedEvening = true;
    const filler = { id: 'filler', name: 'Filler', type: 'gap', schemaV: 2, gapH: 0,
      groupedEvening: true, doses: [{ label: '1 tablet', mg: 0, pills: 1 }] };
    await seedAndOpenHome([filler, uncountable]);
    const takeAll = page.getByRole('button', { name: /Take all/i }).first();
    t('the group card offers Take all', await takeAll.count() > 0);
    if (await takeAll.count()) {
      await takeAll.click();
      await page.waitForTimeout(800);
      const inModal = await page.evaluate(() => {
        const dlg = document.querySelector('[role="dialog"]');
        if (!dlg) return '(no dialog)';
        const el = dlg.querySelector('[data-uncounted]');
        return el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : null;
      });
      t('THE BATCH CONFIRMATION SAYS WHICH DOSE ITS LIMIT WILL NOT COUNT',
        !!inModal && inModal !== '(no dialog)' && /5\/325 mg/.test(inModal), JSON.stringify(inModal));
      t('and it names the medication, because the batch is about several at once',
        !!inModal && /Perco/.test(inModal), JSON.stringify(inModal));
      t('and it does not warn about the medication the limit counts fine',
        !!inModal && !/Filler/.test(inModal), JSON.stringify(inModal));
      const cancel = page.getByRole('button', { name: 'Cancel', exact: true }).first();
      if (await cancel.count()) { await cancel.click(); await page.waitForTimeout(500); }
    }
    // THE NEGATIVE: a batch of medications the limit counts properly must say nothing, or the
    // warning is wallpaper on the one screen where it matters most.
    const okA = { id: 'oka', name: 'OkA', type: 'gap', schemaV: 2, gapH: 0, groupedEvening: true,
      ceiling: true, ceilingMax: 4, ceilingUnit: 'pills', doses: [{ label: '1 tablet', mg: 0, pills: 1 }] };
    const okB = { ...okA, id: 'okb', name: 'OkB' };
    await seedAndOpenHome([okA, okB]);
    const ta2 = page.getByRole('button', { name: /Take all/i }).first();
    if (await ta2.count()) {
      await ta2.click();
      await page.waitForTimeout(800);
      t('an ordinary batch says nothing',
        (await page.evaluate(() => {
          const dlg = document.querySelector('[role="dialog"]');
          return dlg ? dlg.querySelectorAll('[data-uncounted]').length : -1;
        })) === 0);
      const cancel2 = page.getByRole('button', { name: 'Cancel', exact: true }).first();
      if (await cancel2.count()) { await cancel2.click(); await page.waitForTimeout(500); }
    }
  }

  // AND THE SINGLE-DOSE CONFIRMATION, the same control one medication at a time. Written as part of
  // the class rather than because anyone reported it.
  {
    const one = combo({ quickLog: true });
    await seedAndOpenHome([one]);
    const btn = page.getByRole('button', { name: /5\/325 mg/ }).first();
    if (await btn.count()) {
      await btn.click();
      await page.waitForTimeout(800);
      const inModal = await page.evaluate(() => {
        const dlg = document.querySelector('[role="dialog"]');
        const el = dlg && dlg.querySelector('[data-uncounted]');
        return el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : null;
      });
      t('the single-dose confirmation says it too', !!inModal && /5\/325 mg/.test(inModal), JSON.stringify(inModal));
      const cancel3 = page.getByRole('button', { name: 'Cancel', exact: true }).first();
      if (await cancel3.count()) { await cancel3.click(); await page.waitForTimeout(500); }
    }
  }

  // AND THE NEGATIVE ON A GROUP CARD TOO, so the notice is not simply always on there.
  {
    const ok = combo({ quickLog: false, doses: [{ label: '1 tablet', mg: 0, pills: 1 }] });
    ok.groupedEvening = true;
    await seedAndOpenHome([ok]);
    t('an ordinary grouped medication says nothing',
      (await page.evaluate(() => document.querySelectorAll('[data-uncounted]').length)) === 0);
  }

  // THE FULL SIG LINE, ON THE REAL SCREEN. The round-9 audit's block was invisible in a parser table
  // for the same reason round 8's was: the harm is that a count set from the MAXIMUM makes
  // doseBlocked true at zero doses, so the ordinary Log button never appears and the only route is
  // the red override — which stamps every dose over-limit in the history handed to a nurse.
  {
    await seedAndOpenHome([combo({ ceilingMax: 6,
      doses: [{ label: '5/325 mg q4-6h prn max 8 tabs daily', mg: 325 }] })]);
    const plain = await page.getByRole('button', { name: /^5\/325 mg q4-6h prn max 8 tabs daily$/ }).count();
    const over = await page.getByRole('button', { name: /over limit/i }).count();
    t('a full sig line offers an ordinary Log button', plain > 0, 'plain: ' + plain);
    t('and is NOT locked behind the override at zero doses logged', over === 0, 'override: ' + over);
    const n = await noticeText();
    t('and the limit it cannot count is disclosed rather than silently applied',
      !!n && /max 8 tabs daily/.test(n), JSON.stringify(n));
  }

  // THE SIG LINE OFF THE BOTTLE, ON THE REAL SCREEN. The round-8 audit's block was not visible in a
  // parser table: the harm is that `pills: 6` on a four-a-day limit makes `doseBlocked` true at ZERO
  // doses logged, so the ordinary Log button never appears and the only route is the red override —
  // which stamps every dose as an over-limit override in the history a caregiver hands a nurse.
  {
    await seedAndOpenHome([combo({ doses: [{ label: '5/325 mg q6h', mg: 325 }] })]);
    const plain = await page.getByRole('button', { name: /^5\/325 mg q6h$/ }).count();
    const over = await page.getByRole('button', { name: /over limit/i }).count();
    t('a medication typed as the bottle writes it offers an ordinary Log button',
      plain > 0, 'plain buttons: ' + plain);
    t('and is NOT locked behind the over-limit override at zero doses logged',
      over === 0, 'override buttons: ' + over);
    // And the limit it cannot count is disclosed rather than silently ignored — the other half.
    const n = await noticeText();
    t('and the card says the limit is not counting it', !!n && /5\/325 mg q6h/.test(n), JSON.stringify(n));
  }

  // THE UPGRADE, LOGGED THROUGH. The round-5 audit's own note on why its block was invisible to
  // this suite: every limit check here used a medication the suite created through the editor, which
  // never had a stored `pills` to lose. So this one seeds an app-v80 device and taps the button six
  // times against a four-a-day limit -- which is exactly how the defect was found, and exactly what
  // no check was doing.
  await seedAndOpenHome([combo({ doses: [
    { label: '1 tablet', mg: 0, pills: 1 },
    { label: '5/325 mg', mg: 325, pills: 5 } ] })]);
  {
    const tapped = [];
    for (let i = 1; i <= 6; i++) {
      const btn = page.getByRole('button', { name: /^1 tablet$/ }).first();
      if (!(await btn.count())) { tapped.push('no button at ' + i); break; }
      if (!(await btn.isEnabled())) { tapped.push('disabled at ' + i); break; }
      await btn.click();
      await page.waitForTimeout(650);
      const cf = page.getByRole('button', { name: 'Confirm', exact: true });
      if (await cf.count()) { await cf.first().click(); await page.waitForTimeout(650); }
      await dismiss();
      const over = await page.getByRole('button', { name: /over limit/i }).count();
      if (over) { tapped.push('offered only as an override at ' + (i + 1)); break; }
    }
    const logged = await page.evaluate(() => {
      const ek = Object.keys(localStorage).find(k => /entries-v1$/.test(k));
      return JSON.parse(localStorage.getItem(ek) || '[]').filter(e => e.medId === 'perco').length;
    });
    // The countable dose still holds the line at four. That is the half of the limit that works,
    // and the migration must not have taken it out along with the count it could not derive.
    t('a countable dose still stops at the limit after the upgrade', logged === 4,
      'logged ' + logged + ' — ' + JSON.stringify(tapped));
    // ASKED OF THE SCREEN, not inferred from why the loop stopped -- and asking the right question.
    // The first version looked for a per-dose "over limit" button, which is what appears when ONE
    // dose would cross the line. Four of four taken is the ceiling already HIT, and that is a
    // different state: the whole card locks and says so, and the per-dose override never renders.
    // The check was measuring the wrong control and calling the right behaviour a failure.
    const reached = await page.evaluate(() => {
      const el = document.querySelector('[data-uncounted="card"]');
      const card = el && el.parentElement;
      return card ? (card.innerText || '').replace(/\s+/g, ' ').trim() : '(no card)';
    });
    // WHAT THE CARD ACTUALLY SAYS AT THE CEILING, read off the screen rather than guessed at twice:
    // the status chip reads "Limit" and the next dose is pushed to tomorrow. That is the lock, and
    // it is the half of this medication's limit that still works after the upgrade.
    t('and the card is locked at the limit until tomorrow',
      /\bLimit\b/.test(reached) && /tomorrow/i.test(reached),
      reached.slice(0, 160) + ' — ' + JSON.stringify(tapped));
  }

  // AND IT HAS TO BE READABLE ON THE NARROWEST PHONE, unclipped, without pushing the page sideways.
  await seedAndOpenHome([combo()]);
  await page.setViewportSize({ width: 320, height: 900 });
  await page.waitForTimeout(700);
  const fit = await page.evaluate(() => {
    const el = document.querySelector('[data-uncounted="card"]');
    if (!el) return { found: false };
    const r = el.getBoundingClientRect();
    return { found: true, left: Math.round(r.left), right: Math.round(r.right),
      clipped: el.scrollHeight > el.clientHeight + 1,
      page: Math.round(document.documentElement.scrollWidth) };
  });
  // AND IT KEEPS A GUTTER. The first run measured right: 320 -- flush against the edge of a 320px
  // screen, which passes a "does the page scroll sideways" check and still looks broken.
  t('the notice is unclipped at 320px and the page does not scroll sideways',
    fit.found && !fit.clipped && fit.right <= 320 && fit.page <= 320, JSON.stringify(fit));
  t('and it keeps a gutter on both sides rather than sitting flush to the screen edge',
    fit.found && fit.left >= 8 && fit.right <= 312, JSON.stringify(fit));
  await page.setViewportSize({ width: 390, height: 900 });
  await page.waitForTimeout(400);
}

// ---------------------------------------------------------------------------------------------
// SECTION 3g -- THREE STRINGS THE APP CANNOT RESOLVE, PINNED RATHER THAN GUESSED AT.
//
// The round-10 audit measured these and did NOT block on them, and it was right not to: on 20 of 25
// representative written amounts this build is safer than what is live, and on these three a
// caregiver is worse off by ONE PRESS, at a daily limit of five or more.
//
// WHY THERE IS NO FIX HERE, and that is the finding. "5/325 mg 30 tablets" is a quantity dispensed;
// "5/325 mg 2 tablets" is a dose. Nothing in the grammar separates them -- only the size of the
// number, which is a guess. The obvious rule, "a count followed by a period is a rate", counts
// "80/12.5 mg 1 tablet daily" as a rate too, and that is a real once-daily dose on a real
// combination product. **Every one of rounds 8 through 11 was a guess about prose that the next
// audit found a string for.** A fourth guess to win back one press is the same move again.
//
// So these are pinned at their measured values. If a later change moves any of them, that is a
// decision somebody is making rather than a drift, and this comment says what the decision costs.
// The real answer is a structured amount field -- see outputs/DECISION-dose-amounts.md.
// ---------------------------------------------------------------------------------------------
console.log('\n3g. AMBIGUOUS BY NATURE — PINNED, NOT GUESSED AT');
{
  const known = [
    ['5/325 mg 30 tablets', 30, 'a quantity dispensed reads exactly like a dose of thirty'],
    ['5/325 mg 8 tabs/24h', 8, 'a daily total reads exactly like a dose of eight'],
    ['5/325 mg 12 tablets in 24 hours', 12, 'and so does the long form'],
  ];
  for (const [input, count, why] of known) {
    const got = arr(await parse(input))[0] || {};
    t('"' + input + '" counts ' + count + ' — KNOWN, and the app cannot tell it from a dose (' + why + ')',
      got.pills === count, JSON.stringify(got));
  }
  // AND THE ONES THAT LOOK THE SAME AND REALLY ARE DOSES. Pinned beside them, because any rule
  // written to catch the three above will catch these unless it is measured against them.
  for (const [input, count] of [['5/325 mg 2 tablets', 2], ['80/12.5 mg 1 tablet daily', 1], ['5/325 mg 1 tablet every 6 hours', 1]]) {
    const got = arr(await parse(input))[0] || {};
    t('"' + input + '" counts ' + count + ' — a real dose, and must stay one', got.pills === count, JSON.stringify(got));
  }
}

console.log('\n4. DELIBERATELY UNCHANGED, AND PINNED SO IT CANNOT DRIFT QUIETLY');
{
  const mcg = arr(await parse('500 mcg'));
  t('"500 mcg" still counts as 500 with no unit of its own — micrograms have nowhere to be stored yet',
    mcg.length === 1 && mcg[0].mg === 0 && mcg[0].pills === 500, JSON.stringify(mcg));
  const ml = arr(await parse('5 mL'));
  t('"5 mL" still counts as 5 with no unit of its own — same reason',
    ml.length === 1 && ml[0].mg === 0 && ml[0].pills === 5, JSON.stringify(ml));
  const units = arr(await parse('8 units'));
  t('"8 units" still counts as 8 with no unit of its own — same reason',
    units.length === 1 && units[0].mg === 0 && units[0].pills === 8, JSON.stringify(units));
  const empty = arr(await parse(''));
  t('an empty Dosage options is still no doses at all, not one blank button',
    Array.isArray(empty) && empty.length === 0, JSON.stringify(empty));
  const junk = arr(await parse('as directed'));
  t('text with no number at all saves as a plain button and counts nothing',
    junk.length === 1 && junk[0].label === 'as directed' && junk[0].mg === 0 && junk[0].pills === undefined,
    JSON.stringify(junk));
  const zero = arr(await parse('1/0 tablet'));
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
