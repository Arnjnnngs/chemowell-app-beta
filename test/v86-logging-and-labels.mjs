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
const histPage = await ctx.newPage();
await histPage.addInitScript(() => {
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
await histPage.goto(BASE, { waitUntil: 'load' });
await histPage.waitForTimeout(2400);
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
const mgPage = await ctx.newPage();
await mgPage.addInitScript(() => {
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
await mgPage.goto(BASE, { waitUntil: 'load' });
await mgPage.waitForTimeout(2400);
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
const snoozePage = await ctx.newPage();
await snoozePage.addInitScript(() => {
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
await snoozePage.goto(BASE, { waitUntil: 'load' });
await snoozePage.waitForTimeout(2400);
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
}

console.log('\n12. NOTHING THREW, ON ANY PAGE');
t('no page error at any point above', thrown.length === 0, thrown.join(' | ') || 'none');

console.log('\n13. THE README FIGURE FOR THIS SUITE MUST BE THIS SUITE\'S FIGURE');
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
