// v86-logging-and-labels.mjs -- the four defects from Aaron's 2026-10-23 testing pass, plus one
// found alongside them.
//
// WHAT THIS PROTECTS.
//  #1  "Daily check-in card for bowel movement and appetite never appears on Home, even after
//      enabling those check-ins and advancing the beta date to the next day... Reports say these
//      are 'logged from Home' but there's no visible way to reach them."  His diagnosis was
//      right: the Home card is gated on the TIME OF DAY (checkinWindowOpen, 19:00 default) and
//      the beta date control only moves the DATE. The gate stays; what was wrong is that it was
//      the only door. Both report screens now log directly.
//  #2  "History day summary counts everything that isn't temperature or weight as a 'dose' --
//      blood pressure readings, symptoms, and paracentesis entries all get labeled doses."
//  #13 A daily mg total read "N mg APAP" whichever medication it was counting.
//  #7  "Account says 'Rename or delete profiles in Settings,' but no rename or delete control is
//      visible in the Settings profile row."
//  #8  "Snoozing the UP NEXT banner gives no toast or indication of when it returns."
//
// EVERY CHECK DRIVES THE SHIPPED CODE through window.__v86Test or through the rendered DOM. None
// re-implements what it is testing -- app-v85 shipped a draft that exported a re-implementation
// and called it "the shipped predicate", which proves only that a suite agrees with itself.
//
// Run:  python3 -m http.server 8899 --directory <repo>   (then)  node test/v86-logging-and-labels.mjs
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
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const thrown = [];
// EVERY PAGE, NOT JUST THE FIRST. The v85 suite attached pageerror to page one of six and its
// "nothing threw" check was blind on the other five -- a delta-5 audit proved it with a real
// uncaught throw that still printed "none". Attaching at the CONTEXT catches every page this
// suite opens, including ones opened later.
ctx.on('page', (p) => p.on('pageerror', (e) => thrown.push(String(e))));
const page = await ctx.newPage();


// EACH SCENARIO GETS ITS OWN CONTEXT, NOT JUST ITS OWN PAGE. localStorage is per ORIGIN, shared
// by every page in a context -- and these pages stay open, each running a one-second tick that
// writes. Section 16 renamed the wrong profile for exactly this reason: its two-profile fixture
// was overwritten by an earlier page's single-profile app before the rename ran, and the suite
// reported a bug in the app that was a bug in the suite. Separate contexts make the fixtures mean
// what they say.
const freshPage = async (seedFn) => {
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  c.on('page', (pg) => pg.on('pageerror', (e) => thrown.push(String(e))));
  const pg = await c.newPage();
  await pg.addInitScript(seedFn);
  await pg.goto(BASE, { waitUntil: 'load' });
  await pg.waitForTimeout(2400);
  return pg;
};

const seed = () => {
  localStorage.setItem('chemowell-app-profiles-v1', JSON.stringify({ list: [{ id: 'p1', name: 'Alex', createdAt: 1 }], activeId: 'p1' }));
  localStorage.setItem('chemowell-app-p-p1-prefs-v1', JSON.stringify({
    patientName: 'Alex', onboarded: true, sex: 'female', treatmentType: 'chemo', tourDone: true, installedAt: 1
  }));
  localStorage.setItem('chemowell-app-p-p1-entries-v1', JSON.stringify([]));
};
await page.addInitScript(seed);
await page.goto(BASE, { waitUntil: 'load' });
await page.waitForTimeout(2300);

console.log('\n1. THE HOOK REACHES THE SHIPPED CODE');
const hookOk = await page.evaluate(() => !!(window.__v86Test && typeof window.__v86Test.isDoseEntry === 'function' && typeof window.__v86Test.openReport === 'function'));
t('window.__v86Test exposes the shipped functions', hookOk === true, 'hook=' + hookOk);

console.log('\n2. #1 -- THE BOWEL REPORT CAN LOG, NOT ONLY REMOVE');
// THE DEFECT ITSELF. Before this release the screen rendered a history list and a Remove button
// and nothing that could create an entry, at any hour.
await page.evaluate(() => window.__v86Test.openReport('bowel_movement'));
await page.waitForTimeout(900);
const bowelUi = await page.evaluate(() => {
  const el = document.querySelector('[data-daily-logger="bowel_movement"]');
  return { present: !!el, values: el ? [...el.querySelectorAll('[data-daily-log-value]')].map(x => x.getAttribute('data-daily-log-value')) : [] };
});
t('the bowel report renders a logger', bowelUi.present === true, 'present=' + bowelUi.present);
t('it offers every bowel value', bowelUi.values.length === 5 && bowelUi.values.includes('diarrhea'), bowelUi.values.join(','));

// THE CLOCK MUST NOT MATTER. This is the whole point: the Home card is correctly gated on the
// check-in time, so the report control has to work regardless of what hour it is.
const hourNow = await page.evaluate(() => new Date().getHours());
t('and it is reachable at whatever hour this suite happens to run', bowelUi.present === true, 'local hour ' + hourNow + (hourNow < 19 ? ' (before the 19:00 check-in window -- the case Aaron hit)' : ' (inside the window)'));

console.log('\n3. #1 -- LOGGING, THEN CORRECTING, SUPERSEDES INSTEAD OF DELETING');
// CLICK THROUGH A GUARD. A mutant that deletes the logger used to abort this file with a
// TypeError on null, which ends the run and leaves every later section unreported -- the same
// shape as v71-report-controls dying at para-add. A missing control is a FAIL, not a crash.
const clickValue = async (pg, key, val) => pg.evaluate(([k, v]) => {
  const el = document.querySelector('[data-daily-logger="' + k + '"] [data-daily-log-value="' + v + '"]');
  if (!el) return false;
  el.click(); return true;
}, [key, val]);
t('the Normal button is there to click', await clickValue(page, 'bowel_movement', 'normal'), 'clicked');
await page.waitForTimeout(800);
const afterFirst = await page.evaluate(() => JSON.parse(localStorage.getItem('chemowell-app-p-p1-entries-v1') || '[]').filter(e => e.medId === 'bowel_movement'));
t('picking a value writes an entry', afterFirst.length === 1 && afterFirst[0].value === 'normal', JSON.stringify(afterFirst.map(e => e.value)));

t('the Diarrhea button is there to click', await clickValue(page, 'bowel_movement', 'diarrhea'), 'clicked');
await page.waitForTimeout(900);
const afterSecond = await page.evaluate(() => JSON.parse(localStorage.getItem('chemowell-app-p-p1-entries-v1') || '[]').filter(e => e.medId === 'bowel_movement').sort((a, c) => a.ts - c.ts));
t('correcting it APPENDS rather than deleting -- the first answer survives', afterSecond.length === 2, 'entries=' + afterSecond.length + ' ' + JSON.stringify(afterSecond.map(e => e.value)));
t('the correction is stamped strictly newer, so latest-wins is not left to array order',
  afterSecond.length === 2 && afterSecond[1].ts > afterSecond[0].ts, afterSecond.length === 2 ? ('delta ' + (afterSecond[1].ts - afterSecond[0].ts) + 'ms') : 'n/a');
const shownNow = await page.evaluate(() => {
  const el = document.querySelector('[data-daily-logger="bowel_movement"]');
  return el ? el.textContent.replace(/\s+/g, ' ') : '';
});
t('and the screen shows the corrected value, not the original', /currently Diarrhea/i.test(shownNow), shownNow.slice(0, 110));

console.log('\n4. #1 -- THE APPETITE REPORT, SAME TREATMENT');
await page.evaluate(() => window.__v86Test.openReport('appetite'));
await page.waitForTimeout(900);
const appUi = await page.evaluate(() => {
  const el = document.querySelector('[data-daily-logger="appetite"]');
  return { present: !!el, n: el ? el.querySelectorAll('[data-daily-log-value]').length : 0 };
});
t('the appetite report renders a logger too', appUi.present === true && appUi.n === 3, 'present=' + appUi.present + ' values=' + appUi.n);
t('the appetite button is there to click', await clickValue(page, 'appetite', 'little'), 'clicked');
await page.waitForTimeout(800);
const appEntries = await page.evaluate(() => JSON.parse(localStorage.getItem('chemowell-app-p-p1-entries-v1') || '[]').filter(e => e.medId === 'appetite'));
t('picking an appetite value writes an entry', appEntries.length === 1 && appEntries[0].value === 'little', JSON.stringify(appEntries.map(e => e.value)));

console.log('\n5. #1 -- THE DESCRIPTIONS NO LONGER SEND PEOPLE SOMEWHERE THEY CANNOT GO');
// "Reports say these are 'logged from Home' but there's no visible way to reach them."
const menuText = await page.evaluate(() => { window.__v86Test.openReport(null); return null; });
await page.waitForTimeout(700);
const descs = await page.evaluate(() => document.body.innerText);
t('no report description still claims these are logged from Home', !/logged from Home/i.test(descs), /logged from Home/i.test(descs) ? 'still present' : 'gone');

console.log('\n6. #2 -- THE DAY SUMMARY COUNTS BY TYPE, NOT "EVERYTHING IS A DOSE"');
// The shipped classifier, driven directly. Each of these is a real medId the app writes.
const cls = await page.evaluate(() => {
  const f = window.__v86Test.isDoseEntry;
  return {
    bp: f({ medId: 'blood_pressure' }), sym: f({ medId: 'symptom_nausea' }), para: f({ medId: 'paracentesis' }),
    bowel: f({ medId: 'bowel_movement' }), appetite: f({ medId: 'appetite' }), temp: f({ medId: 'temp' }),
    weight: f({ medId: 'weight' }), inpatient: f({ medId: 'inpatient_start' }), radiation: f({ medId: 'radiation_session' }),
    chemo: f({ medId: 'chemo_date' }), realMed: f({ medId: 'zofran' })
  };
});
t('a blood pressure reading is not a dose', cls.bp === false, 'isDoseEntry=' + cls.bp);
t('a symptom is not a dose', cls.sym === false, 'isDoseEntry=' + cls.sym);
t('a paracentesis is not a dose', cls.para === false, 'isDoseEntry=' + cls.para);
t('bowel, appetite, in-patient, radiation and the treatment date are not doses',
  !cls.bowel && !cls.appetite && !cls.inpatient && !cls.radiation && !cls.chemo, JSON.stringify(cls));
t('a real medication still IS a dose -- the fix did not stop counting doses', cls.realMed === true, 'isDoseEntry=' + cls.realMed);

console.log('\n7. #2 -- AND THE RENDERED SUMMARY SAYS SO');
// Structural agreement is not enough; the sentence on screen is what Aaron read.
// A FRESH PAGE FOR THIS SECTION. Driven on the page above, the router reported reports/history
// while the DOM still showed the Reports menu -- that page had already been navigated and
// reloaded several times by the sections before it. Rather than tune waits until it happens to
// agree, this opens its own page with the fixture already in storage, which is also how a real
// phone reaches History: open the app, tap Reports, tap History.
const histPage = await freshPage(() => {
  const day = new Date(); day.setHours(0, 0, 0, 0); const d = day.getTime();
  localStorage.setItem('chemowell-app-profiles-v1', JSON.stringify({ list: [{ id: 'p1', name: 'Alex', createdAt: 1 }], activeId: 'p1' }));
  localStorage.setItem('chemowell-app-p-p1-prefs-v1', JSON.stringify({ patientName: 'Alex', onboarded: true, sex: 'female', treatmentType: 'chemo', tourDone: true, installedAt: 1 }));
  localStorage.setItem('chemowell-app-p-p1-entries-v1', JSON.stringify([
    { id: 'x1', medId: 'blood_pressure', sys: 120, dia: 80, dose: '120/80', mg: 0, ts: d + 9 * 3600000 },
    { id: 'x2', medId: 'symptom_nausea', dose: 'Nausea', mg: 0, ts: d + 10 * 3600000 },
    { id: 'x3', medId: 'paracentesis', dose: '3 L', mg: 0, ts: d + 11 * 3600000 },
    { id: 'x4', medId: 'temp', temp: 98.6, unit: 'Fahrenheit', dose: '98.6 F', mg: 0, ts: d + 8 * 3600000 }
  ]));
});
await histPage.evaluate(() => window.__v86Test.openReport('history'));
await histPage.waitForTimeout(1400);
const onHistory = await histPage.evaluate(() => { const w = window.__v86Test.where(); return w.view === 'reports' && w.reportsView === 'history'; });
const histText = await histPage.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
t('the History detail screen is actually open', onHistory === true && /TODAY/i.test(histText),
  onHistory ? 'router reports view=reports/history and a day heading is on screen' : 'NOT on History -- the assertions below would read the wrong screen');
t('the summary names blood pressure', /1 BP/.test(histText), (histText.match(/.{0,55}1 BP.{0,25}/) || ['not found'])[0]);
t('the summary names the symptom', /1 symptom\b/.test(histText), (histText.match(/.{0,45}1 symptom.{0,25}/) || ['not found'])[0]);
t('the summary names the paracentesis', /1 para\b/.test(histText), (histText.match(/.{0,45}1 para.{0,20}/) || ['not found'])[0]);
t('and it does NOT call those three doses', !/\b[1-9]\d* dose/.test(histText),
  /dose/.test(histText) ? (histText.match(/.{0,40}dose.{0,20}/) || [''])[0] : 'the word dose does not appear in the summary')

console.log('\n8. #13 -- A mg TOTAL NAMES ITS OWN MEDICATION, NOT "APAP"');
// THIS SECTION WAS VACUOUS IN ITS FIRST FORM and a mutant proved it: putting "APAP" back scored a
// clean 33/33, because the fixture above has no medication carrying an mg daily-total card, so
// mgTotals was empty and the string under test never rendered at all. An absence check only means
// something when the thing could have been present. This page has an mg medication with a logged
// dose, so the summary genuinely carries an mg row.
const mgPage = await freshPage(() => {
  const day = new Date(); day.setHours(0, 0, 0, 0); const d = day.getTime();
  localStorage.setItem('chemowell-app-profiles-v1', JSON.stringify({ list: [{ id: 'p1', name: 'Alex', createdAt: 1 }], activeId: 'p1' }));
  localStorage.setItem('chemowell-app-p-p1-prefs-v1', JSON.stringify({ patientName: 'Alex', onboarded: true, sex: 'female', treatmentType: 'chemo', tourDone: true, installedAt: 1 }));
  localStorage.setItem('chemowell-app-p-p1-med-v1', JSON.stringify({ version: 2, archivedMeds: {}, meds: [
    { id: 'ibu', name: 'Ibuprofen', type: 'prn', schemaV: 2, quickLog: true,
      homeCard: { kind: 'mg', limit: 2400 },
      // homeCard must be the OBJECT form -- medHomeCardKind() reads homeCard.kind and returns
      // null for a bare true, which is how the first version of this fixture produced no mg row
      // at all and left the check below asserting the absence of a string that was never there.
      doses: [{ label: '600 mg', mg: 600 }] }
  ] }));
  localStorage.setItem('chemowell-app-p-p1-entries-v1', JSON.stringify([
    { id: 'm1', medId: 'ibu', dose: '600 mg', mg: 600, ts: d + 9 * 3600000 }
  ]));
});
await mgPage.evaluate(() => window.__v86Test.openReport('history'));
await mgPage.waitForTimeout(1400);
const mgText = await mgPage.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
// ANCHORED TO THE SUMMARY LINE, not to the page. The first version matched "600 mg" anywhere and
// was satisfied by the entry row further down, so it reported a precondition that was not met.
// The summary sits between the day's date and the first time-of-day heading. Anchoring to that
// span is what makes the two checks below mean "on the summary line" rather than "somewhere on
// the page" -- the entry row further down also contains "600 mg", and an earlier version of this
// precondition was satisfied by it while the summary said only "1 dose".
const mgSummary = (mgText.match(/\d{1,2}\/\d{1,2}\s+(.*?)\s+(?:MORNING|AFTERNOON|EVENING|OVERNIGHT)/) || ['', ''])[1] || '';
t('precondition: an mg total really is on the day summary -- otherwise this section proves nothing',
  /\b600 mg\b/.test(mgSummary), 'summary="' + mgSummary.trim().slice(0, 70) + '"');
t('the mg total names the medication the caregiver configured', /600 mg Ibuprofen/.test(mgSummary),
  'summary="' + mgSummary.trim().slice(0, 70) + '"');
t('and it does not label it APAP', !/APAP/.test(mgText), /APAP/.test(mgText) ? 'APAP still on screen' : 'no APAP anywhere');

console.log('\n9. #7 -- A ONE-PROFILE PHONE HAS A VISIBLE RENAME CONTROL');
// Aaron's case exactly: Free gives one profile, that profile is the active one, and the active
// row used to render an "Active" pill and nothing else.
await page.evaluate(() => { const b2 = document.querySelector('[data-tour="menu-btn"]'); if (b2) b2.click(); });
await page.waitForTimeout(700);
await page.evaluate(() => { const b2 = [...document.querySelectorAll('#app-drawer button, #app-drawer [role="button"]')].find(x => /Settings/i.test(x.textContent)); if (b2) b2.click(); });
await page.waitForTimeout(1500);
const renameBtn = await page.evaluate(() => {
  const el = [...document.querySelectorAll('button')].find(x => /^Rename$/.test(x.textContent.trim()));
  return { found: !!el, label: el ? el.getAttribute('aria-label') : null };
});
t('the active profile row offers Rename', renameBtn.found === true, renameBtn.label || 'ABSENT -- this is the defect Aaron reported');

console.log('\n10. #7 -- RENAMING WRITES BOTH PLACES THE NAME LIVES');
// profiles.list[].name drives the Settings row; prefs.patientName drives the greeting, the CSV
// filename and the printed report. Writing one and not the other leaves the two disagreeing.
const renamed = await page.evaluate(async () => {
  window.__v86Test.renameActiveProfile('Jordan Reyes');
  await new Promise(r => setTimeout(r, 400));
  const ps = JSON.parse(localStorage.getItem('chemowell-app-profiles-v1') || '{}');
  const pr = JSON.parse(localStorage.getItem('chemowell-app-p-p1-prefs-v1') || '{}');
  return { listName: (ps.list || []).map(x => x.name).join(','), prefName: pr.patientName };
});
t('the profile list carries the new name', renamed.listName === 'Jordan Reyes', 'list=' + renamed.listName);
t('and so does patientName, which the report and the export use', renamed.prefName === 'Jordan Reyes', 'patientName=' + renamed.prefName);
const emptyReject = await page.evaluate(() => {
  const before = JSON.parse(localStorage.getItem('chemowell-app-profiles-v1') || '{}').list[0].name;
  window.__v86Test.renameActiveProfile('   ');
  const after = JSON.parse(localStorage.getItem('chemowell-app-profiles-v1') || '{}').list[0].name;
  return { before, after };
});
t('a blank name is refused rather than wiping the name', emptyReject.after === emptyReject.before, 'before=' + emptyReject.before + ' after=' + emptyReject.after);

console.log('\n11. #8 -- SNOOZE SAYS HOW LONG, ON THE BUTTON AND IN THE TOAST');
// A scheduled medication due now is what puts the Up Next card on Home. `type: 'win'` is required
// -- normalizeMedication DERIVES `alerts` from it and discards a stored alerts:true, so a fixture
// without it renders a perfect med card and never produces an Up Next.
const snoozePage = await freshPage(() => {
  localStorage.setItem('chemowell-app-profiles-v1', JSON.stringify({ list: [{ id: 'p1', name: 'Alex', createdAt: 1 }], activeId: 'p1' }));
  localStorage.setItem('chemowell-app-p-p1-prefs-v1', JSON.stringify({ patientName: 'Alex', onboarded: true, sex: 'female', treatmentType: 'chemo', tourDone: true, installedAt: 1 }));
  localStorage.setItem('chemowell-app-p-p1-entries-v1', JSON.stringify([]));
  const h = new Date().getHours();
  localStorage.setItem('chemowell-app-p-p1-med-v1', JSON.stringify({ version: 2, archivedMeds: {}, meds: [
    { id: 'alpha', name: 'Alpha', type: 'win', schemaV: 2, quickLog: true,
      doses: [{ label: '1 tablet', pills: 1 }],
      windows: [{ start: Math.max(0, h - 1), end: Math.min(23.9, h + 2), name: 'Now' }] }
  ] }));
});
const snooze = await snoozePage.evaluate(() => {
  const el = [...document.querySelectorAll('button')].find(x => /^Snooze/.test(x.textContent.trim()));
  return { found: !!el, label: el ? el.textContent.trim() : null };
});
t('the Up Next card is on screen with a Snooze button', snooze.found === true, snooze.label || 'no Snooze button -- fixture did not produce an Up Next card');
if (snooze.found) {
  t('the button itself states the duration', /\d+\s*m/.test(snooze.label), 'label="' + snooze.label + '"');
  t('and the duration is 15 minutes, the behaviour that was always there', /15\s*m/.test(snooze.label), 'label="' + snooze.label + '"');
  await snoozePage.evaluate(() => [...document.querySelectorAll('button')].find(x => /^Snooze/.test(x.textContent.trim())).click());
  await snoozePage.waitForTimeout(700);
  const toast = await snoozePage.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
  t('tapping it says when the card comes back', /back in 15 minutes/i.test(toast), (toast.match(/.{0,20}back in 15 minutes.{0,45}/) || ['no toast found'])[0]);
  t('and it says the dose itself was not changed', /Nothing about the dose has changed/i.test(toast), /Nothing about the dose/i.test(toast) ? 'stated' : 'not stated');
  // AND THE BEHAVIOUR, NOT ONLY THE THREE STRINGS ABOUT IT. A mutant setting the handler to 90
  // minutes while the label and the toast still read 15 scored a clean 38/38 -- the suite checked
  // what the app SAID and never what it DID. Read in the same breath as the click, because this
  // is in-memory state and a later section is a later second.
  const snoozeMins = await snoozePage.evaluate(() => (window.__v86Test.snoozeUntil() - Date.now()) / 60000);
  t('the snooze really is set ~15 minutes out, not just labelled that way',
    snoozeMins > 14 && snoozeMins < 15.5, 'handler set it ' + snoozeMins.toFixed(2) + ' minutes out');
}

console.log('\n12. THE HOME CHECK-IN MUST NOT LOSE TO THE REPORTS LOGGER');
// THE BLOCKER THE AUDIT FOUND, and it was a design shape rather than arithmetic: supersedeStamp
// was an OPTIONAL fourth argument that only the new Reports logger passed. confirmCheckinModal()
// still wrote at dayStart+12h, so after two picks from Reports the check-in's own answer landed
// BEHIND them in the latest-wins comparison, was never displayed anywhere, and the app said
// "Check-in saved." The stamp is computed inside the writers now, so there is no argument to
// forget. dailyCheckinTime is set to 00:00 here purely so the Home card is reachable at whatever
// hour this suite runs -- the window gate is correct and is not what is under test.
const ciPage = await freshPage(() => {
  localStorage.setItem('chemowell-app-profiles-v1', JSON.stringify({ list: [{ id: 'p1', name: 'Alex', createdAt: 1 }], activeId: 'p1' }));
  localStorage.setItem('chemowell-app-p-p1-prefs-v1', JSON.stringify({
    patientName: 'Alex', onboarded: true, sex: 'female', treatmentType: 'chemo', tourDone: true,
    installedAt: Date.now() - 86400000, dailyCheckinTime: '00:00',
    homeCards: { bowelCheckin: true, appetiteCheckin: true }
  }));
  localStorage.setItem('chemowell-app-p-p1-entries-v1', JSON.stringify([]));
  localStorage.setItem('chemowell-app-p-p1-med-v1', JSON.stringify({ version: 2, archivedMeds: {}, meds: [] }));
});
await ciPage.evaluate(() => window.__v86Test.openReport('bowel_movement'));
await ciPage.waitForTimeout(1000);
const pick1 = await clickValue(ciPage, 'bowel_movement', 'normal'); await ciPage.waitForTimeout(700);
const pick2 = await clickValue(ciPage, 'bowel_movement', 'loose');  await ciPage.waitForTimeout(800);
t('two picks from the Reports logger land, in order', pick1 && pick2, 'both clicked');
const before = await ciPage.evaluate(() => JSON.parse(localStorage.getItem('chemowell-app-p-p1-entries-v1') || '[]').filter(e => e.medId === 'bowel_movement').map(e => e.value));
t('precondition: two bowel answers exist before the check-in is opened', before.length === 2, JSON.stringify(before));

// Answer the Home check-in with a THIRD, different value.
// BACK TO HOME FIRST. The two picks above happened on Reports > Bowel Movement, and the check-in
// card lives on Home -- an earlier version looked for the card without leaving the report screen
// and reported the sheet as never opening.
await ciPage.evaluate(() => { const nav = [...document.querySelectorAll('button, [role="button"]')].find(x => x.textContent.trim() === 'Home'); if (nav) nav.click(); });
await ciPage.waitForTimeout(1200);
// The Home check-in card's own button is labelled "Start". Matching it exactly rather than
// hunting for the words "check-in" -- an earlier version of this looked for a button whose text
// mentioned a check-in, found none, and reported the sheet as not opening.
const opened = await ciPage.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Start');
  if (btn) { btn.click(); return true; }
  return false;
});
await ciPage.waitForTimeout(900);
// THE CHECK-IN USES SELECTS, NOT BUTTONS. An earlier version of this hunted for a button
// labelled "Diarrhea" and reported the sheet as offering no values -- the dialog carries exactly
// two buttons, Cancel and Save. Setting .value alone does nothing; the app reads the value in an
// onChange handler, so the event has to be dispatched.
const ciState = await ciPage.evaluate(() => {
  const dlg = document.querySelector('[role="dialog"][aria-label="Daily check-in"]');
  if (!dlg) return { open: false };
  const sels = [...dlg.querySelectorAll('select')];
  const bowelSel = sels.find(s2 => [...s2.options].some(o => /Diarrhea/i.test(o.textContent)));
  if (!bowelSel) return { open: true, picked: false, selects: sels.length };
  const opt = [...bowelSel.options].find(o => /Diarrhea/i.test(o.textContent));
  bowelSel.value = opt.value;
  bowelSel.dispatchEvent(new Event('change', { bubbles: true }));
  return { open: true, picked: true, chose: opt.value };
});
t('the Home check-in sheet opens and offers the bowel values', ciState.open === true && ciState.picked === true, JSON.stringify({ opened, ciState }));
if (ciState.open && ciState.picked) {
  await ciPage.waitForTimeout(300);
  await ciPage.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"][aria-label="Daily check-in"]');
    const save = [...dlg.querySelectorAll('button')].find(x => /^(Save|Done|Confirm)/i.test(x.textContent.trim()));
    if (save) save.click();
  });
  await ciPage.waitForTimeout(1100);
  const after = await ciPage.evaluate(() => {
    const all = JSON.parse(localStorage.getItem('chemowell-app-p-p1-entries-v1') || '[]').filter(e => e.medId === 'bowel_movement').sort((a, c) => a.ts - c.ts);
    return { values: all.map(e => e.value), latest: all.length ? all[all.length - 1].value : null };
  });
  t('the check-in answer is written', after.values.length === 3, JSON.stringify(after.values));
  t('AND IT IS THE ONE THAT STANDS -- it does not lose to the earlier picks',
    after.latest === 'diarrhea', 'latest=' + after.latest + ' of ' + JSON.stringify(after.values));
}

console.log('\n12b. RE-CONFIRMING THE SAME ANSWER FROM THE CHECK-IN IS ALSO A NO-OP');
// The no-op guard for duplicate picks was first written in the UI handler -- the exact shape the
// F1 lesson had just warned about -- so the Home check-in could still write a duplicate. Once the
// export marker runs over it, the doctor's file prints "X (corrected later -- superseded)"
// directly above "X": a correction that did not happen. The guard lives in the writers now.
// ITS OWN PAGE, with the answer already recorded and the check-in NOT yet completed. Reusing the
// page from section 12 could not work: answering the check-in sets an explicit per-day completed
// flag, so the Home card is gone and there is no Start button to press. An earlier version of
// this check pressed nothing and reported the sheet as never opening.
const dupPage = await freshPage(() => {
  const day = new Date(); day.setHours(0, 0, 0, 0); const d = day.getTime();
  localStorage.setItem('chemowell-app-profiles-v1', JSON.stringify({ list: [{ id: 'p1', name: 'Alex', createdAt: 1 }], activeId: 'p1' }));
  localStorage.setItem('chemowell-app-p-p1-prefs-v1', JSON.stringify({
    patientName: 'Alex', onboarded: true, sex: 'female', treatmentType: 'chemo', tourDone: true,
    // WEIGHT IS ENABLED AND LEFT UNANSWERED ON PURPOSE. With bowel and appetite both already
    // recorded, checkinDoneForDay() is satisfied and the Home card correctly disappears -- there
    // is no Start button to press. A third metric still outstanding keeps the card on screen so
    // the other two can be re-confirmed, which is the case under test.
    installedAt: d - 86400000, dailyCheckinTime: '00:00',
    homeCards: { bowelCheckin: true, appetiteCheckin: true, dailyWeightCheckin: true }
  }));
  localStorage.setItem('chemowell-app-p-p1-entries-v1', JSON.stringify([
    { id: 'd1', medId: 'bowel_movement', value: 'diarrhea', dose: 'Diarrhea', mg: 0, ts: d + 12 * 3600000 },
    { id: 'd2', medId: 'appetite', value: 'little', dose: 'Little to none', mg: 0, ts: d + 12 * 3600000 }
  ]));
  localStorage.setItem('chemowell-app-p-p1-med-v1', JSON.stringify({ version: 2, archivedMeds: {}, meds: [] }));
});
const dupCi = await dupPage.evaluate(async () => {
  const seeded = JSON.parse(localStorage.getItem('chemowell-app-p-p1-entries-v1') || '[]');
  const before = seeded.filter(e => e.medId === 'bowel_movement').length;
  const appBefore = seeded.filter(e => e.medId === 'appetite').length;
  const start = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Start');
  if (!start) return { opened: false, before, why: 'no Start button on Home' };
  start.click();
  await new Promise(r => setTimeout(r, 900));
  const dlg = document.querySelector('[role="dialog"][aria-label="Daily check-in"]');
  if (!dlg) return { opened: false, before, why: 'sheet did not open' };
  const sel = [...dlg.querySelectorAll('select')].find(s2 => [...s2.options].some(o => /Diarrhea/i.test(o.textContent)));
  const opt = sel && [...sel.options].find(o => /Diarrhea/i.test(o.textContent));
  if (!opt) return { opened: false, before, why: 'no Diarrhea option' };
  // The sheet pre-fills with today's recorded answer, so this is literally "Save without
  // changing anything" -- the ordinary case, not a contrived one.
  sel.value = opt.value; sel.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise(r => setTimeout(r, 200));
  // Re-confirm the appetite answer too. The check-in is the path that bypasses the Reports
  // logger's own UI guard, which is exactly why the enforcement had to move into the writers.
  const aSel = [...dlg.querySelectorAll('select')].find(s2 => [...s2.options].some(o => /Little to none/i.test(o.textContent)));
  const aOpt = aSel && [...aSel.options].find(o => /Little to none/i.test(o.textContent));
  if (aOpt) { aSel.value = aOpt.value; aSel.dispatchEvent(new Event('change', { bubbles: true })); }
  await new Promise(r => setTimeout(r, 300));
  const save = [...dlg.querySelectorAll('button')].find(x => /^Save$/i.test(x.textContent.trim()));
  if (save) save.click();
  await new Promise(r => setTimeout(r, 1000));
  const raw = JSON.parse(localStorage.getItem('chemowell-app-p-p1-entries-v1') || '[]');
  return { opened: true, before, after: raw.filter(e => e.medId === 'bowel_movement').length,
           appBefore, appAfter: raw.filter(e => e.medId === 'appetite').length };
});
t('precondition: the check-in sheet opens with today\u2019s answer already recorded', dupCi.opened === true, JSON.stringify(dupCi));
if (dupCi.opened) {
  t('re-confirming the answer already recorded writes no second record', dupCi.after === dupCi.before, dupCi.before + ' -> ' + dupCi.after);
  // THE CHECK-IN IS THE PATH THAT BYPASSES THE LOGGER'S OWN GUARD, which is exactly why the
  // enforcement had to move into the writers. Removing the appetite writer's guard survived a
  // whole suite run while the Reports logger's UI guard quietly stood in for it.
  t('and the appetite answer is not duplicated either', dupCi.appAfter === dupCi.appBefore, dupCi.appBefore + ' -> ' + dupCi.appAfter);
  const falseMark = await dupPage.evaluate(() => window.__v86Test.exportRows().filter(r => /(Bowel Movement|Appetite)/i.test(r[2] || '') && /superseded/i.test(r[3] || '')).map(r => r[3]));
  t('so the export does not mark an identical answer as corrected', falseMark.length === 0, JSON.stringify(falseMark));
}

console.log('\n13. A DAY OF ONLY BOWEL / APPETITE / RADIATION IS NOT "NOTHING LOGGED"');
// THE SECOND BLOCKER, and this release caused it: those three moved out of the dose count with no
// counter of their own, so the summary announced "Nothing logged" directly above the records it
// was summarising. Before app-v86 it said "3 doses" -- the wrong label, but present.
const nlPage = await freshPage(() => {
  const day = new Date(); day.setHours(0, 0, 0, 0); const d = day.getTime();
  localStorage.setItem('chemowell-app-profiles-v1', JSON.stringify({ list: [{ id: 'p1', name: 'Alex', createdAt: 1 }], activeId: 'p1' }));
  localStorage.setItem('chemowell-app-p-p1-prefs-v1', JSON.stringify({ patientName: 'Alex', onboarded: true, sex: 'female', treatmentType: 'chemo', tourDone: true, installedAt: d - 86400000 }));
  localStorage.setItem('chemowell-app-p-p1-entries-v1', JSON.stringify([
    { id: 'n1', medId: 'bowel_movement', value: 'loose', dose: 'Loose', mg: 0, ts: d + 12 * 3600000 },
    { id: 'n2', medId: 'appetite', value: 'little', dose: 'Little to none', mg: 0, ts: d + 12 * 3600000 },
    // RADIATION IS THE THIRD OF THE THREE and had no fixture, so deleting its counter scored a
    // clean 60/60 while this section's own title claimed to cover it.
    { id: 'n3', medId: 'radiation_session', dose: 'Session', mg: 0, ts: d + 14 * 3600000 }
  ]));
  localStorage.setItem('chemowell-app-p-p1-med-v1', JSON.stringify({ version: 2, archivedMeds: {}, meds: [] }));
});
await nlPage.evaluate(() => window.__v86Test.openReport('history'));
await nlPage.waitForTimeout(1300);
const nlText = await nlPage.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
const nlSummary = (nlText.match(/\d{1,2}\/\d{1,2}\s+(.*?)\s+(?:MORNING|AFTERNOON|EVENING|OVERNIGHT)/) || ['', ''])[1] || '';
t('precondition: the day really does list those records', /Loose/.test(nlText) && /Little to none/.test(nlText), 'both entries on screen');
t('the summary does NOT say "Nothing logged" above records it is summarising', !/Nothing logged/.test(nlSummary), 'summary="' + nlSummary.trim().slice(0, 70) + '"');
t('it counts them under their own names', /1 BM/.test(nlSummary) && /1 appetite/.test(nlSummary) && /1 radiation/.test(nlSummary), 'summary="' + nlSummary.trim().slice(0, 70) + '"');

console.log('\n13b. A CORRECTION FROM REPORTS KEEPS THE NOTE THE ANSWER CARRIED');
// logAppetite only attached a note when one was passed, and the Reports logger passes none, so a
// correction silently dropped a note the caregiver had typed. Untested until a mutant reverting
// the preservation scored a clean 60/60.
const notePage = await freshPage(() => {
  const day = new Date(); day.setHours(0, 0, 0, 0); const d = day.getTime();
  localStorage.setItem('chemowell-app-profiles-v1', JSON.stringify({ list: [{ id: 'p1', name: 'Alex', createdAt: 1 }], activeId: 'p1' }));
  localStorage.setItem('chemowell-app-p-p1-prefs-v1', JSON.stringify({ patientName: 'Alex', onboarded: true, sex: 'female', treatmentType: 'chemo', tourDone: true, installedAt: d - 86400000 }));
  localStorage.setItem('chemowell-app-p-p1-entries-v1', JSON.stringify([
    { id: 'q1', medId: 'appetite', value: 'normal', dose: 'Normal', note: 'only managed toast', mg: 0, ts: d + 12 * 3600000 }
  ]));
  localStorage.setItem('chemowell-app-p-p1-med-v1', JSON.stringify({ version: 2, archivedMeds: {}, meds: [] }));
});
await notePage.evaluate(() => window.__v86Test.openReport('appetite'));
await notePage.waitForTimeout(1000);
const notePick = await clickValue(notePage, 'appetite', 'none');
await notePage.waitForTimeout(900);
const noteAfter = await notePage.evaluate(() => {
  const all = JSON.parse(localStorage.getItem('chemowell-app-p-p1-entries-v1') || '[]').filter(e => e.medId === 'appetite').sort((a, c) => a.ts - c.ts);
  return { n: all.length, latestValue: all.length ? all[all.length - 1].value : null, latestNote: all.length ? (all[all.length - 1].note || '') : null };
});
t('precondition: the correction was accepted', notePick && noteAfter.n === 2 && noteAfter.latestValue === 'none', JSON.stringify(noteAfter));
t('and the note from the answer it replaced came with it', noteAfter.latestNote === 'only managed toast', 'note="' + noteAfter.latestNote + '"');

console.log('\n14. RE-PICKING THE VALUE ALREADY SHOWN IS A NO-OP, NOT A DUPLICATE RECORD');
await nlPage.evaluate(() => window.__v86Test.openReport('bowel_movement'));
await nlPage.waitForTimeout(1000);
const dupBefore = await nlPage.evaluate(() => JSON.parse(localStorage.getItem('chemowell-app-p-p1-entries-v1') || '[]').filter(e => e.medId === 'bowel_movement').length);
for (let i = 0; i < 4; i++) { await clickValue(nlPage, 'bowel_movement', 'loose'); await nlPage.waitForTimeout(250); }
await nlPage.waitForTimeout(600);
const dupAfter = await nlPage.evaluate(() => JSON.parse(localStorage.getItem('chemowell-app-p-p1-entries-v1') || '[]').filter(e => e.medId === 'bowel_movement').length);
t('four taps on the value already showing add no records', dupAfter === dupBefore, dupBefore + ' -> ' + dupAfter);
// AND THE SAME FOR APPETITE, which has its own guard because the note is part of the answer.
// Removing the bowel guard was caught; removing the appetite one scored a clean 67/67 until this.
await nlPage.evaluate(() => window.__v86Test.openReport('appetite'));
await nlPage.waitForTimeout(900);
const apBefore = await nlPage.evaluate(() => JSON.parse(localStorage.getItem('chemowell-app-p-p1-entries-v1') || '[]').filter(e => e.medId === 'appetite').length);
for (let i = 0; i < 3; i++) { await clickValue(nlPage, 'appetite', 'little'); await nlPage.waitForTimeout(250); }
await nlPage.waitForTimeout(600);
const apAfter = await nlPage.evaluate(() => JSON.parse(localStorage.getItem('chemowell-app-p-p1-entries-v1') || '[]').filter(e => e.medId === 'appetite').length);
t('and three taps on the appetite value already showing add none either', apAfter === apBefore, apBefore + ' -> ' + apAfter);

console.log('\n15. A CORRECTED ANSWER IS MARKED IN THE DOCTOR-FACING EXPORT, NOT DELETED');
await nlPage.evaluate(() => window.__v86Test.openReport('bowel_movement'));
await nlPage.waitForTimeout(800);
await clickValue(nlPage, 'bowel_movement', 'diarrhea');
await nlPage.waitForTimeout(900);
const ex = await nlPage.evaluate(() => {
  const rows = window.__v86Test.exportRows().filter(r => /Bowel Movement/i.test(r[2] || ''));
  return rows.map(r => ({ time: r[1], detail: r[3] }));
});
t('precondition: both answers are in the export -- the original is not deleted', ex.length === 2, JSON.stringify(ex));
t('the superseded one says so', ex.some(r => /superseded/i.test(r.detail)), JSON.stringify(ex.map(r => r.detail)));
t('and the current one does not', ex.filter(r => !/superseded/i.test(r.detail)).length === 1, JSON.stringify(ex.map(r => r.detail)));

console.log('\n16. RENAME TARGETS THE ACTIVE PROFILE, NOT WHICHEVER IS FIRST IN THE LIST');
// A mutant replacing find(x => x.id === ACTIVE_PROFILE_ID) with list[0] SURVIVED 38/38, because
// every fixture had one profile and the two are indistinguishable there. Two profiles, and the
// SECOND one active, is the only shape that can tell them apart.
const rnPage = await freshPage(() => {
  localStorage.setItem('chemowell-app-profiles-v1', JSON.stringify({ list: [{ id: 'p1', name: 'First Person', createdAt: 1 }, { id: 'p2', name: 'Second Person', createdAt: 2 }], activeId: 'p2' }));
  localStorage.setItem('chemowell-app-p-p1-prefs-v1', JSON.stringify({ patientName: 'First Person', onboarded: true, sex: 'female', treatmentType: 'chemo', tourDone: true, installedAt: Date.now() - 86400000 }));
  localStorage.setItem('chemowell-app-p-p2-prefs-v1', JSON.stringify({ patientName: 'Second Person', onboarded: true, sex: 'male', treatmentType: 'chemo', tourDone: true, installedAt: Date.now() - 86400000 }));
});
const rn = await rnPage.evaluate(async () => {
  const active = window.__v86Test.activeId ? window.__v86Test.activeId() : null;
  window.__v86Test.renameActiveProfile('Renamed Target');
  await new Promise(r => setTimeout(r, 400));
  const ps = JSON.parse(localStorage.getItem('chemowell-app-profiles-v1') || '{}');
  return { active, names: (ps.list || []).map(x => x.id + '=' + x.name).join(','),
           p1: JSON.parse(localStorage.getItem('chemowell-app-p-p1-prefs-v1') || '{}').patientName,
           p2: JSON.parse(localStorage.getItem('chemowell-app-p-p2-prefs-v1') || '{}').patientName };
});
t('the ACTIVE profile is the one renamed', /p2=Renamed Target/.test(rn.names), rn.names);
t('the first profile in the list is untouched', /p1=First Person/.test(rn.names), rn.names);
t('and the untouched profile keeps its own patientName', rn.p1 === 'First Person', 'p1 patientName=' + rn.p1);
t('while the active profile\'s patientName moved with it', rn.p2 === 'Renamed Target', 'p2 patientName=' + rn.p2);

console.log('\n16b. A FAILED RENAME LEAVES BOTH STORES AS THEY WERE');
// The two writes land in different blobs. A quota failure between them would leave Settings and
// the doctor's report disagreeing permanently -- and the first version of the guard called the
// async write unawaited inside the try, so a failure of the FIRST write never reached the catch
// at all and the app still said "Renamed to ...". Forced here with a throwing setItem.
const failRename = await rnPage.evaluate(async () => {
  const real = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) { if (/-prefs-v1$/.test(k)) throw new Error('quota'); return real.call(this, k, v); };
  let ok = null;
  try { ok = await window.__v86Test.renameActiveProfile('Should Not Stick'); } catch (e) { ok = 'threw'; }
  Storage.prototype.setItem = real;
  await new Promise(r => setTimeout(r, 300));
  const ps = JSON.parse(localStorage.getItem('chemowell-app-profiles-v1') || '{}');
  const pr = JSON.parse(localStorage.getItem('chemowell-app-p-p2-prefs-v1') || '{}');
  return { ok, listName: (ps.list || []).map(x => x.id + '=' + x.name).join(','), prefName: pr.patientName };
});
t('a rename whose prefs write fails reports failure rather than success', failRename.ok === false, 'returned ' + JSON.stringify(failRename.ok));
t('and neither store is left holding the new name', !/Should Not Stick/.test(failRename.listName) && failRename.prefName !== 'Should Not Stick',
  'list=' + failRename.listName + ' patientName=' + failRename.prefName);

console.log('\n17. A NEW MEDICATION CANNOT TAKE A RECORD TYPE\'S ID');
// The v78 fence that refused thirteen drug names is gone and should stay gone -- an id is just an
// id. But `weight`, `appetite`, `paracentesis` and the rest are not drug names, they are the ids
// this app stores its own vitals and daily metrics under. Name a medication "Weight" and it took
// `weight`, at which point isDoseEntry stopped counting its doses because that id is on the
// not-a-dose list. Found by the app-v86 audit; nothing asserted it until this check, which a
// mutant proved by removing the guard and still scoring a clean 55/55.
const ids = await page.evaluate(() => ({
  weight: window.__v86Test.nextMedicationId('Weight'),
  appetite: window.__v86Test.nextMedicationId('Appetite'),
  para: window.__v86Test.nextMedicationId('Paracentesis'),
  temp: window.__v86Test.nextMedicationId('Temperature'),
  ordinary: window.__v86Test.nextMedicationId('Ondansetron')
}));
t('a medication named Weight does not take the id `weight`', ids.weight !== 'weight', 'got ' + ids.weight);
t('nor Appetite the id `appetite`', ids.appetite !== 'appetite', 'got ' + ids.appetite);
t('nor Paracentesis, nor Temperature', ids.para !== 'paracentesis' && ids.temp !== 'temp', 'para=' + ids.para + ' temp=' + ids.temp);
t('and an ordinary medication still gets its plain id -- the fence is not back',
  ids.ordinary === 'ondansetron', 'got ' + ids.ordinary);
const stillDose = await page.evaluate((i) => window.__v86Test.isDoseEntry({ medId: i }), ids.weight);
t('so its doses are still counted as doses', stillDose === true, 'isDoseEntry(' + ids.weight + ')=' + stillDose);

console.log('\n18. NOTHING THREW, ON ANY PAGE');
t('no page error at any point above', thrown.length === 0, thrown.join(' | ') || 'none');

console.log('\n19. THE README FIGURE FOR THIS SUITE MUST BE THIS SUITE\'S FIGURE');
// Last check in the file, deliberately. app-v85 carried this check with a hand-typed `+2` offset
// for the checks that ran after it, and a delta audit proved that deleting any of those left the
// README wrong and the check green. Being last makes the offset exactly one -- itself.
const claim = await page.evaluate(async (base) => {
  const url = base.replace(/index\.html.*$/, 'README.md');
  const txt = await (await fetch(url)).text();
  const m = txt.match(/test\/v86-logging-and-labels\.mjs`?\*{0,2}\s*\*{0,2}(\d+)\/(\d+)/);
  return m ? { claimed: Number(m[1]), of: Number(m[2]) } : null;
}, BASE);
const total = pass + fail + 1;
t('the README figure for this suite is this suite\'s figure',
  !!claim && claim.of === total && claim.claimed === total,
  claim ? ('README says ' + claim.claimed + '/' + claim.of + ', this run counts ' + total)
        : 'README names no figure for test/v86-logging-and-labels.mjs at all');

console.log('\n' + (pass + fail) + ' checks: ' + pass + ' passed, ' + fail + ' failed');
await b.close();
process.exit(fail ? 1 : 0);
