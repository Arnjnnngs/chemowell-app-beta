// v87-correct-a-past-day.mjs -- the two Enhancer findings from the app-v86 pass.
//
// E-2  The Home bowel-issue banner offered FOUR of the five values the app has. `Loose` -- the
//      value between normal and diarrhea, and the one that most often moves first during
//      chemotherapy -- could not be recorded from the banner at all. The caregiver had to leave
//      it for the Reports screen and nothing said so. Pre-existing; app-v86 rewrote this
//      control's writer without anyone reading the screen, which is what the Enhancer seat is
//      for and why its absence on that release was a real cost rather than a clerical one.
//
// E-1  A day logged earlier could only be DELETED. Both report screens log today and supersede a
//      correction; every older row carried exactly one control, Remove. So a mis-tap yesterday
//      meant deleting the record with no way to put the right one back -- the delete-based
//      correction this project has shipped and undone twice, sitting on the screens app-v86
//      rebuilt.
//
// Every check drives the shipped code through the rendered DOM or window.__v86Test. The
// pageerror listener is on the CONTEXT and each scenario gets its OWN context, because app-v86's
// suite was wrong five times before its code was: pages in one context share localStorage and
// clobbered each other's fixtures, and it once reported a bug in the app that was a bug in itself.
//
// Run:  python3 -m http.server 8899 --directory <repo>   (then)  node test/v87-correct-a-past-day.mjs
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
const thrown = [];
const D0 = (() => { const n = new Date(); n.setHours(0, 0, 0, 0); return n.getTime(); })();

const freshPage = async (seedFn) => {
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  c.on('page', (pg) => pg.on('pageerror', (e) => thrown.push(String(e))));
  const pg = await c.newPage();
  await pg.addInitScript(seedFn);
  await pg.goto(BASE, { waitUntil: 'load' });
  await pg.waitForTimeout(2400);
  return pg;
};
const base = (entries) => {
  const day = new Date(); day.setHours(0, 0, 0, 0); const d = day.getTime();
  localStorage.setItem('chemowell-app-profiles-v1', JSON.stringify({ list: [{ id: 'p1', name: 'Alex', createdAt: 1 }], activeId: 'p1' }));
  localStorage.setItem('chemowell-app-p-p1-prefs-v1', JSON.stringify({ patientName: 'Alex', onboarded: true, sex: 'female', treatmentType: 'chemo', tourDone: true, installedAt: d - 7 * 86400000 }));
  localStorage.setItem('chemowell-app-p-p1-med-v1', JSON.stringify({ version: 2, archivedMeds: {}, meds: [] }));
  localStorage.setItem('chemowell-app-p-p1-entries-v1', JSON.stringify(entries));
};

console.log('\n1. E-2 -- THE BANNER OFFERS EVERY VALUE THE APP HAS');
// The banner shows only while the standing answer is a bowel ISSUE, so today is seeded 'diarrhea'.
const bannerPage = await freshPage(() => {
  const day = new Date(); day.setHours(0, 0, 0, 0); const d = day.getTime();
  localStorage.setItem('chemowell-app-profiles-v1', JSON.stringify({ list: [{ id: 'p1', name: 'Alex', createdAt: 1 }], activeId: 'p1' }));
  localStorage.setItem('chemowell-app-p-p1-prefs-v1', JSON.stringify({ patientName: 'Alex', onboarded: true, sex: 'female', treatmentType: 'chemo', tourDone: true, installedAt: d - 7 * 86400000 }));
  localStorage.setItem('chemowell-app-p-p1-med-v1', JSON.stringify({ version: 2, archivedMeds: {}, meds: [] }));
  localStorage.setItem('chemowell-app-p-p1-entries-v1', JSON.stringify([
    { id: 'b1', medId: 'bowel_movement', value: 'diarrhea', dose: 'Diarrhea', mg: 0, ts: d + 12 * 3600000 }
  ]));
});
const opts = await bannerPage.evaluate(() => {
  const sel = [...document.querySelectorAll('select')].find(s2 => [...s2.options].some(o => /Diarrhea/i.test(o.textContent)));
  if (!sel) return null;
  return { values: [...sel.options].map(o => o.value).filter(Boolean), placeholder: sel.options[0].textContent.trim() };
});
t('precondition: the banner is on Home with its answer box', !!opts, opts ? 'found' : 'no select on Home');
if (opts) {
  // Counted against the app's own label map rather than a number typed here, so adding a sixth
  // value to the app and not to the banner is what goes red -- not a count that has to be edited.
  const appValues = await bannerPage.evaluate(() => Object.keys(window.__v86Test.bowelLabels()));
  t('precondition: the app defines more than four bowel values', appValues.length >= 5, appValues.join(','));
  t('the banner offers every value the app defines', appValues.every(v => opts.values.includes(v)),
    'app=' + appValues.join(',') + '  banner=' + opts.values.join(','));
  t('including Loose, which it used to omit', opts.values.includes('loose'), opts.values.join(','));
  t('and the box no longer invites only one of them', !/back to normal/i.test(opts.placeholder), 'placeholder="' + opts.placeholder + '"');
}

console.log('\n1b. EVERY CONTROL THAT OFFERS BOWEL VALUES OFFERS ALL OF THEM');
// THE FIRST VERSION OF THIS SUITE CHECKED ONE CONTROL OF FOUR. index.html carried TWO hand-written
// option lists -- the Home banner and the daily check-in sheet -- and app-v87 fixed the banner and
// left the sheet at four. That was worse than a missing option: openCheckinModal() pre-fills with
// the standing answer, so once Loose was one tap away from the banner, a Loose day opened the
// sheet with a BLANK select. The release's own headline defect, reproduced inside its own fix,
// and a mutant removing Loose from the new corrector scored a clean 25/25. Every control is
// counted here, against the app's own map, so a sixth value cannot be added to four places and
// forgotten in a fifth.
const everyControl = await freshPage(() => {
  const day = new Date(); day.setHours(0, 0, 0, 0); const d = day.getTime();
  localStorage.setItem('chemowell-app-profiles-v1', JSON.stringify({ list: [{ id: 'p1', name: 'Alex', createdAt: 1 }], activeId: 'p1' }));
  localStorage.setItem('chemowell-app-p-p1-prefs-v1', JSON.stringify({ patientName: 'Alex', onboarded: true, sex: 'female', treatmentType: 'chemo', tourDone: true,
    installedAt: d - 7 * 86400000, dailyCheckinTime: '00:00', homeCards: { bowelCheckin: true, appetiteCheckin: true } }));
  localStorage.setItem('chemowell-app-p-p1-med-v1', JSON.stringify({ version: 2, archivedMeds: {}, meds: [] }));
  // A LOOSE day standing: the exact state that rendered the check-in sheet blank.
  localStorage.setItem('chemowell-app-p-p1-entries-v1', JSON.stringify([
    { id: 'c1', medId: 'bowel_movement', value: 'loose', dose: 'Loose', mg: 0, ts: d + 12 * 3600000 },
    { id: 'c0', medId: 'bowel_movement', value: 'normal', dose: 'Normal', mg: 0, ts: d - 86400000 + 12 * 3600000 }
  ]));
});
const defined = await everyControl.evaluate(() => Object.keys(window.__v86Test.bowelLabels()));
const sheet = await everyControl.evaluate(async () => {
  const start = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Start');
  if (!start) return { ok: false, why: 'no Start button on Home' };
  start.click();
  await new Promise(r => setTimeout(r, 900));
  const dlg = document.querySelector('[role="dialog"][aria-label="Daily check-in"]');
  if (!dlg) return { ok: false, why: 'sheet did not open' };
  const sel = [...dlg.querySelectorAll('select')].find(s2 => [...s2.options].some(o => /Diarrhea/i.test(o.textContent)));
  if (!sel) return { ok: false, why: 'no bowel select in the sheet' };
  return { ok: true, values: [...sel.options].map(o => o.value).filter(Boolean),
           prefilled: sel.value, index: sel.selectedIndex,
           shown: sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex].textContent.trim() : '(BLANK)' };
});
t('precondition: the daily check-in sheet opens with its bowel question', sheet.ok === true, JSON.stringify(sheet.why || 'open'));
if (sheet.ok) {
  t('the check-in sheet offers every value the app defines', defined.every(v => sheet.values.includes(v)),
    'app=' + defined.join(',') + '  sheet=' + sheet.values.join(','));
  t('and a Loose day pre-fills it rather than rendering blank', sheet.prefilled === 'loose' && sheet.index >= 0,
    'value="' + sheet.prefilled + '" index=' + sheet.index + ' shown="' + sheet.shown + '"');
}
// THE EIGHTH, and it is the release's own headline in mirror image. Deleting the sheet's
// ''/"Not answered" option scores a clean pass on every suite -- and would render the select
// BLANK on every morning nobody has answered yet, which is exactly the failure this release
// exists to have fixed, arrived at from the other side.
const declineable = await everyControl.evaluate(() => {
  const dlg = document.querySelector('[role="dialog"][aria-label="Daily check-in"]');
  const sel = dlg && [...dlg.querySelectorAll('select')].find(s2 => [...s2.options].some(o => /Diarrhea/i.test(o.textContent)));
  if (!sel) return null;
  return { first: sel.options[0].value, firstText: sel.options[0].textContent.trim(), count: sel.options.length };
});
t('the check-in sheet still lets a caregiver decline to answer', !!declineable && declineable.first === '',
  declineable ? ('first option = "' + declineable.firstText + '"') : 'sheet not open');
t('and the sheet offers exactly the app\u2019s values plus that one decline, nothing more',
  !!declineable && declineable.firstText.length > 0 && declineable.count === defined.length + 1,
  declineable ? (declineable.count + ' options for ' + defined.length + ' values + 1 decline') : 'n/a');

console.log('\n1d. AN UNANSWERED DAY OPENS ON THE DECLINE OPTION, AND SAVING IT WRITES NOTHING');
// THE NINTH VACUOUS CHECK WAS THE EIGHTH ONE'S FIX, AND THIS SECTION IS WHY IT EXISTS.
//
// The check above was named "an unanswered day opens on it rather than blank" and never opened an
// unanswered day: its scenario has a standing `loose` entry, so openCheckinModal() takes its
// truthy branch. The condition inspected the OPTION LIST and never the SELECTION. An audit put a
// sentinel in the unanswered pre-fill -- option list untouched, decline option still present and
// still first -- and scored 45/45, 87/87 and v58 10/10 while the sheet rendered selectedIndex -1,
// BLANK, on every morning nobody had answered yet, and Save wrote a bowel_movement record for a
// question the caregiver never answered.
//
// The previous round asked for two things. The first became the assertion; the second became the
// assertion's NAME. A name is not a check. So this section drives the path: no entry for today,
// open the sheet, read the SELECTION, then Save and count what was written.
const unanswered = await freshPage(() => {
  const day = new Date(); day.setHours(0, 0, 0, 0); const d = day.getTime();
  localStorage.setItem('chemowell-app-profiles-v1', JSON.stringify({ list: [{ id: 'p1', name: 'Alex', createdAt: 1 }], activeId: 'p1' }));
  localStorage.setItem('chemowell-app-p-p1-prefs-v1', JSON.stringify({ patientName: 'Alex', onboarded: true, sex: 'female', treatmentType: 'chemo', tourDone: true,
    installedAt: d - 7 * 86400000, dailyCheckinTime: '00:00', homeCards: { bowelCheckin: true, appetiteCheckin: true } }));
  localStorage.setItem('chemowell-app-p-p1-med-v1', JSON.stringify({ version: 2, archivedMeds: {}, meds: [] }));
  // NOTHING FOR TODAY. Yesterday only, so the app is a going concern rather than a fresh install
  // -- an empty store would take a different path through the Home screen entirely.
  localStorage.setItem('chemowell-app-p-p1-entries-v1', JSON.stringify([
    { id: 'u0', medId: 'bowel_movement', value: 'normal', dose: 'Normal', mg: 0, ts: d - 86400000 + 12 * 3600000 }
  ]));
});
const blankDay = await unanswered.evaluate(async () => {
  const start = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Start');
  if (!start) return { ok: false, why: 'no Start button on Home' };
  start.click();
  await new Promise(r => setTimeout(r, 900));
  const dlg = document.querySelector('[role="dialog"][aria-label="Daily check-in"]');
  if (!dlg) return { ok: false, why: 'sheet did not open' };
  const sel = [...dlg.querySelectorAll('select')].find(s2 => [...s2.options].some(o => /Diarrhea/i.test(o.textContent)));
  if (!sel) return { ok: false, why: 'no bowel select in the sheet' };
  return { ok: true, value: sel.value, index: sel.selectedIndex,
           shown: sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex].textContent.trim() : '(BLANK)' };
});
t('precondition: the sheet opens on a day with no bowel answer', blankDay.ok === true, JSON.stringify(blankDay.why || 'open'));
if (blankDay.ok) {
  // THE SELECTION, not the option list. This is the clause the previous version was missing.
  t('an unanswered day opens ON the decline option, not on nothing',
    blankDay.index === 0 && blankDay.value === '',
    'value="' + blankDay.value + '" index=' + blankDay.index + ' shown="' + blankDay.shown + '"');
  const beforeSave = await unanswered.evaluate(() => JSON.parse(localStorage.getItem('chemowell-app-p-p1-entries-v1') || '[]').filter(e => e.medId === 'bowel_movement').length);
  await unanswered.evaluate(async () => {
    const dlg = document.querySelector('[role="dialog"][aria-label="Daily check-in"]');
    const save = dlg && [...dlg.querySelectorAll('button')].find(x => /^Save$/i.test(x.textContent.trim()));
    if (save) save.click();
    await new Promise(r => setTimeout(r, 900));
  });
  await unanswered.waitForTimeout(600);
  const afterSave = await unanswered.evaluate(() => JSON.parse(localStorage.getItem('chemowell-app-p-p1-entries-v1') || '[]').filter(e => e.medId === 'bowel_movement').map(e => e.value));
  // A FABRICATED DAILY ANSWER IS WORSE THAN A MISSING ONE -- a clinician reads these.
  t('and saving without answering writes no bowel record at all',
    afterSave.length === beforeSave, beforeSave + ' before -> ' + afterSave.length + ' after [' + afterSave.join(',') + ']');
}
await unanswered.close();

await everyControl.evaluate(() => { const c = [...document.querySelectorAll('button')].find(x => /^Cancel$/i.test(x.textContent.trim())); if (c) c.click(); });
await everyControl.waitForTimeout(500);
await everyControl.evaluate(() => window.__v86Test.openReport('bowel_movement'));
await everyControl.waitForTimeout(1000);
const inReports = await everyControl.evaluate((day) => {
  const logger = [...document.querySelectorAll('[data-daily-logger="bowel_movement"] [data-daily-log-value]')].map(x => x.getAttribute('data-daily-log-value'));
  const btn = document.querySelector('[data-correct-day="' + day + '"]');
  if (btn) btn.click();
  return { logger, btn: !!btn };
}, D0 - 86400000);
await everyControl.waitForTimeout(700);
const corrector = await everyControl.evaluate((day) => {
  const el = document.querySelector('[data-correcting-day="' + day + '"]');
  if (!el) return null;
  return { values: [...el.querySelectorAll('[data-correct-value]')].map(x => x.getAttribute('data-correct-value')),
           marked: [...el.querySelectorAll('[data-correct-value]')].filter(x => /rgba\(200, 83, 32/.test(x.style.background)).map(x => x.getAttribute('data-correct-value')) };
}, D0 - 86400000);
t("the Reports logger offers every value", defined.every(v => inReports.logger.includes(v)), 'logger=' + inReports.logger.join(','));
t('precondition: the corrector opened on a past row', !!corrector, corrector ? 'open' : 'did not open');
if (corrector) {
  t('and the corrector offers every value too', defined.every(v => corrector.values.includes(v)), 'corrector=' + corrector.values.join(','));
  // F7: nothing checked that the picker marks the answer already standing, so a mutant setting
  // the highlight permanently off scored a clean pass.
  t('the picker marks the answer already standing', corrector.marked.length === 1 && corrector.marked[0] === 'normal',
    'marked=' + JSON.stringify(corrector.marked));
}

console.log('\n1c. THE BANNER NAMES THE DAY IT ACTUALLY WRITES TO');
// The placeholder this release introduced read "Change today's answer" and was hardcoded into a
// control that writes to latestBowelDay(), which is NOT necessarily today. Three days on it sat
// two lines under "Update status for Thursday, Oct 22" and contradicted it -- a fix for a
// misleading placeholder that shipped a differently misleading one. Only a banner whose day is
// not today can tell the difference, which is why the first check could not.
const oldDayPage = await freshPage(() => {
  const day = new Date(); day.setHours(0, 0, 0, 0); const d = day.getTime();
  localStorage.setItem('chemowell-app-profiles-v1', JSON.stringify({ list: [{ id: 'p1', name: 'Alex', createdAt: 1 }], activeId: 'p1' }));
  localStorage.setItem('chemowell-app-p-p1-prefs-v1', JSON.stringify({ patientName: 'Alex', onboarded: true, sex: 'female', treatmentType: 'chemo', tourDone: true, installedAt: d - 9 * 86400000 }));
  localStorage.setItem('chemowell-app-p-p1-med-v1', JSON.stringify({ version: 2, archivedMeds: {}, meds: [] }));
  localStorage.setItem('chemowell-app-p-p1-entries-v1', JSON.stringify([
    { id: 'o1', medId: 'bowel_movement', value: 'diarrhea', dose: 'Diarrhea', mg: 0, ts: d - 3 * 86400000 + 12 * 3600000 }
  ]));
});
const oldDay = await oldDayPage.evaluate(() => {
  const sel = [...document.querySelectorAll('select')].find(s2 => [...s2.options].some(o => /Diarrhea/i.test(o.textContent)));
  if (!sel) return null;
  // Read the heading from the DOM, not out of innerText -- a select's option text does not sit
  // beside its label in the flattened string, which is why matching them in one pass failed.
  const head = [...document.querySelectorAll('div, span, p')].map(x => x.textContent.trim())
    .find(x => /^Update status for /.test(x) && x.length < 40);
  return { placeholder: sel.options[0].textContent.trim(), heading: head || null, page: document.body.innerText.replace(/\s+/g, ' ') };
});
t('precondition: the banner is showing for a day that is not today', !!oldDay && !/Update status for today/i.test(oldDay.page),
  oldDay ? (oldDay.page.match(/Update status for [^\n]{0,24}/) || ['heading not found'])[0] : 'no banner');
if (oldDay) {
  t('the box does not call that day today', !/today/i.test(oldDay.placeholder), 'placeholder="' + oldDay.placeholder + '"');
  // Both strings are built from the same variable, so this compares what the caregiver reads:
  // the heading's day and the box's day, pulled out independently.
  const headingDay = (String(oldDay.heading || '').match(/^Update status for (.+)$/) || [])[1];
  const boxDay = (oldDay.placeholder.match(/Change the answer for (.+?)\u2026/) || [])[1];
  t('precondition: both the heading and the box name a day', !!headingDay && !!boxDay,
    'heading="' + headingDay + '" box="' + boxDay + '"');
  t('and it is the same day in both', !!headingDay && !!boxDay && headingDay.trim() === boxDay.trim(),
    'heading="' + (headingDay || '').trim() + '" box="' + (boxDay || '').trim() + '"');
}

console.log('\n2. E-2 -- AND LOGGING LOOSE FROM THE BANNER ACTUALLY WORKS');
const loose = await bannerPage.evaluate(async () => {
  const n0 = JSON.parse(localStorage.getItem('chemowell-app-p-p1-entries-v1') || '[]').filter(e => e.medId === 'bowel_movement').length;
  const sel = [...document.querySelectorAll('select')].find(s2 => [...s2.options].some(o => /Diarrhea/i.test(o.textContent)));
  const opt = sel && [...sel.options].find(o => o.value === 'loose');
  if (!opt) return { ok: false, why: 'no Loose option' };
  sel.value = 'loose'; sel.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise(r => setTimeout(r, 250));
  let btn = null, node = sel.parentElement;
  for (let i = 0; i < 5 && node && !btn; i++) { btn = [...node.querySelectorAll('button')].find(x => /update|save|log/i.test(x.textContent)); node = node.parentElement; }
  if (!btn) return { ok: false, why: 'no update button' };
  btn.click();
  await new Promise(r => setTimeout(r, 1000));
  const all = JSON.parse(localStorage.getItem('chemowell-app-p-p1-entries-v1') || '[]').filter(e => e.medId === 'bowel_movement').sort((a, c) => a.ts - c.ts);
  return { ok: true, n0, n1: all.length, latest: all[all.length - 1].value };
});
t('precondition: the banner accepted the pick', loose.ok === true, JSON.stringify(loose.why || 'clicked'));
if (loose.ok) {
  t('Loose is the answer that now stands', loose.latest === 'loose', 'latest=' + loose.latest);
  t('and the earlier answer is kept, not deleted', loose.n1 === loose.n0 + 1, loose.n0 + ' -> ' + loose.n1);
}

console.log('\n3. E-1 -- A PAST DAY OFFERS A CORRECTION, NOT ONLY A DELETE');
const pastPage = await freshPage(() => {
  const day = new Date(); day.setHours(0, 0, 0, 0); const d = day.getTime();
  localStorage.setItem('chemowell-app-profiles-v1', JSON.stringify({ list: [{ id: 'p1', name: 'Alex', createdAt: 1 }], activeId: 'p1' }));
  localStorage.setItem('chemowell-app-p-p1-prefs-v1', JSON.stringify({ patientName: 'Alex', onboarded: true, sex: 'female', treatmentType: 'chemo', tourDone: true, installedAt: d - 7 * 86400000 }));
  localStorage.setItem('chemowell-app-p-p1-med-v1', JSON.stringify({ version: 2, archivedMeds: {}, meds: [] }));
  localStorage.setItem('chemowell-app-p-p1-entries-v1', JSON.stringify([
    { id: 'y1', medId: 'bowel_movement', value: 'normal', dose: 'Normal', mg: 0, ts: d - 2 * 86400000 + 12 * 3600000 },
    { id: 'y2', medId: 'appetite', value: 'normal', dose: 'Normal', note: 'ate a full dinner', mg: 0, ts: d - 2 * 86400000 + 12 * 3600000 }
  ]));
});
await pastPage.evaluate(() => window.__v86Test.openReport('bowel_movement'));
await pastPage.waitForTimeout(1100);
const twoDaysAgo = D0 - 2 * 86400000;
const hasCorrect = await pastPage.evaluate((day) => !!document.querySelector('[data-correct-day="' + day + '"]'), twoDaysAgo);
t('a row from two days ago offers Correct', hasCorrect === true, hasCorrect ? 'control present' : 'ABSENT -- this is the defect');
const stillRemovable = await pastPage.evaluate(() => /Remove/.test(document.body.innerText));
t('and Remove is still there -- correcting replaces nothing', stillRemovable === true, 'Remove present');

console.log('\n4. E-1 -- CORRECTING A PAST DAY SUPERSEDES IT');
const corrected = await pastPage.evaluate(async (day) => {
  const before = JSON.parse(localStorage.getItem('chemowell-app-p-p1-entries-v1') || '[]').filter(e => e.medId === 'bowel_movement').length;
  const open = document.querySelector('[data-correct-day="' + day + '"]');
  if (!open) return { ok: false, why: 'no Correct button' };
  open.click();
  await new Promise(r => setTimeout(r, 600));
  const pick = document.querySelector('[data-correcting-day="' + day + '"] [data-correct-value="diarrhea"]');
  if (!pick) return { ok: false, why: 'picker did not open' };
  pick.click();
  await new Promise(r => setTimeout(r, 1000));
  const all = JSON.parse(localStorage.getItem('chemowell-app-p-p1-entries-v1') || '[]').filter(e => e.medId === 'bowel_movement').sort((a, c) => a.ts - c.ts);
  return { ok: true, before, after: all.length, values: all.map(e => e.value),
           sameDay: all.every(e => { const n = new Date(e.ts); n.setHours(0, 0, 0, 0); return n.getTime() === day; }),
           text: document.body.innerText.replace(/\s+/g, ' ') };
}, twoDaysAgo);
t('precondition: the picker opened on that row', corrected.ok === true, JSON.stringify(corrected.why || 'opened'));
if (corrected.ok) {
  t('the correction is written', corrected.after === corrected.before + 1, JSON.stringify(corrected.values));
  t('the new answer is the one that stands', corrected.values[corrected.values.length - 1] === 'diarrhea', JSON.stringify(corrected.values));
  t('and BOTH stay on the day they belong to, not today', corrected.sameDay === true, 'all on ' + new Date(twoDaysAgo).toDateString());
  t('the screen says it changed, not that it was already that', /Changed to Diarrhea/.test(corrected.text),
    (corrected.text.match(/.{0,8}(Changed to|Already logged).{0,28}/) || ['no toast'])[0]);
}

console.log('\n5. E-1 -- RE-PICKING THE ANSWER ALREADY THERE IS A NO-OP');
const noop = await pastPage.evaluate(async (day) => {
  const n0 = JSON.parse(localStorage.getItem('chemowell-app-p-p1-entries-v1') || '[]').filter(e => e.medId === 'bowel_movement').length;
  const open = document.querySelector('[data-correct-day="' + day + '"]');
  if (!open) return { ok: false };
  open.click();
  await new Promise(r => setTimeout(r, 600));
  const pick = document.querySelector('[data-correcting-day="' + day + '"] [data-correct-value="diarrhea"]');
  if (!pick) return { ok: false };
  pick.click();
  await new Promise(r => setTimeout(r, 900));
  return { ok: true, n0, n1: JSON.parse(localStorage.getItem('chemowell-app-p-p1-entries-v1') || '[]').filter(e => e.medId === 'bowel_movement').length,
           text: document.body.innerText.replace(/\s+/g, ' ') };
}, twoDaysAgo);
if (noop.ok) {
  t('picking the answer already standing writes nothing', noop.n1 === noop.n0, noop.n0 + ' -> ' + noop.n1);
  t('and says so rather than claiming a change', /Already logged as Diarrhea/.test(noop.text),
    (noop.text.match(/.{0,8}(Already logged|Changed to).{0,28}/) || ['no toast'])[0]);
}

console.log('\n6. E-1 -- THE SUPERSEDED ANSWER IS MARKED FOR THE DOCTOR, NOT DELETED');
const ex = await pastPage.evaluate(() => window.__v86Test.exportRows()
  .filter(r => /Bowel Movement/i.test(r[2] || '')).map(r => r[3]));
t('both answers reach the export', ex.length === 2, JSON.stringify(ex));
t('the superseded one is marked', ex.filter(r => /superseded/i.test(r)).length === 1, JSON.stringify(ex));
t('and the standing one is not', ex.filter(r => !/superseded/i.test(r)).length === 1, JSON.stringify(ex));

console.log('\n7. E-1 -- THE APPETITE SCREEN TOO, AND THE NOTE SURVIVES');
await pastPage.evaluate(() => window.__v86Test.openReport('appetite'));
await pastPage.waitForTimeout(1100);
const app = await pastPage.evaluate(async (day) => {
  const open = document.querySelector('[data-correct-day="' + day + '"]');
  if (!open) return { ok: false, why: 'no Correct button on the appetite row' };
  open.click();
  await new Promise(r => setTimeout(r, 600));
  const pick = document.querySelector('[data-correcting-day="' + day + '"] [data-correct-value="none"]');
  if (!pick) return { ok: false, why: 'picker did not open' };
  pick.click();
  await new Promise(r => setTimeout(r, 1000));
  const all = JSON.parse(localStorage.getItem('chemowell-app-p-p1-entries-v1') || '[]').filter(e => e.medId === 'appetite').sort((a, c) => a.ts - c.ts);
  return { ok: true, n: all.length, latest: all[all.length - 1].value, note: all[all.length - 1].note || '' };
}, twoDaysAgo);
t('the appetite screen offers it as well', app.ok === true, JSON.stringify(app.why || 'opened'));
if (app.ok) {
  t('the correction is written there too', app.n === 2 && app.latest === 'none', JSON.stringify(app));
  // THE NOTE DOES NOT FOLLOW A CHANGED ANSWER. Carrying it across produced "No Appetite" above
  // "ate a full dinner" in the clinician's export -- a kept record that reads as a contradiction.
  // Nothing is lost: the superseded entry keeps its own note, attached to the answer it described.
  t('the note describing the OLD answer does not follow the new one', app.note === '', 'note="' + app.note + '"');
  const oldKept = await pastPage.evaluate(() => {
    const all = JSON.parse(localStorage.getItem('chemowell-app-p-p1-entries-v1') || '[]').filter(e => e.medId === 'appetite').sort((a, c) => a.ts - c.ts);
    return all.length ? (all[0].note || '') : null;
  });
  t('but the answer it DID describe still carries it', oldKept === 'ate a full dinner', 'superseded note="' + oldKept + '"');
}

console.log('\n7a. A LOOSE DAY DOES NOT LOOK LIKE A NORMAL DAY');
// Making Loose reachable put it one tap from the alarm surface -- and `loose` was in no
// classification set, so it fell through to the green dot and rendered IDENTICALLY to Normal in
// the history list. The audit measured rgb(15,157,107) on both. It is deliberately NOT promoted
// into BOWEL_ISSUE_VALUES (that set drives the red banner, and alarming on something the app has
// never alarmed on is Aaron's call, not a side effect of making it selectable) -- but it is in
// the watch set beside Very little now, so it reads as a variation rather than as fine.
const dotPage = await freshPage(() => {
  const day = new Date(); day.setHours(0, 0, 0, 0); const d = day.getTime();
  localStorage.setItem('chemowell-app-profiles-v1', JSON.stringify({ list: [{ id: 'p1', name: 'Alex', createdAt: 1 }], activeId: 'p1' }));
  localStorage.setItem('chemowell-app-p-p1-prefs-v1', JSON.stringify({ patientName: 'Alex', onboarded: true, sex: 'female', treatmentType: 'chemo', tourDone: true, installedAt: d - 9 * 86400000 }));
  localStorage.setItem('chemowell-app-p-p1-med-v1', JSON.stringify({ version: 2, archivedMeds: {}, meds: [] }));
  localStorage.setItem('chemowell-app-p-p1-entries-v1', JSON.stringify([
    { id: 'g1', medId: 'bowel_movement', value: 'normal',   dose: 'Normal',   mg: 0, ts: d - 4 * 86400000 + 12 * 3600000 },
    { id: 'g2', medId: 'bowel_movement', value: 'loose',    dose: 'Loose',    mg: 0, ts: d - 3 * 86400000 + 12 * 3600000 },
    { id: 'g3', medId: 'bowel_movement', value: 'diarrhea', dose: 'Diarrhea', mg: 0, ts: d - 2 * 86400000 + 12 * 3600000 }
  ]));
});
await dotPage.evaluate(() => window.__v86Test.openReport('bowel_movement'));
await dotPage.waitForTimeout(1100);
const dots = await dotPage.evaluate(() => {
  const out = {};
  for (const row of document.querySelectorAll('[data-daily-logger] ~ section div, section div')) {
    const txt = (row.textContent || '').trim();
    const m = txt.match(/\u2014\s*(Normal|Loose|Diarrhea)\s*$/);
    if (!m) continue;
    const dot = row.parentElement && row.parentElement.querySelector('span');
    if (dot && !out[m[1]]) out[m[1]] = getComputedStyle(dot).backgroundColor;
  }
  return out;
});
t('precondition: all three rows rendered with a dot', !!(dots.Normal && dots.Loose && dots.Diarrhea), JSON.stringify(dots));
if (dots.Normal && dots.Loose && dots.Diarrhea) {
  t('a Loose day does not get the same dot as a Normal day', dots.Loose !== dots.Normal,
    'loose=' + dots.Loose + ' normal=' + dots.Normal);
  t('and it is still not the alarm colour a Diarrhea day gets', dots.Loose !== dots.Diarrhea,
    'loose=' + dots.Loose + ' diarrhea=' + dots.Diarrhea);
}

console.log('\n7b. A REFUSED WRITE SAYS SO AND DOES NOT WEDGE THE PICKER');
// dailyLogBusy is a module-level flag shared by the today-logger and the row corrector. Moving
// its reset out of the `finally` scored a clean pass -- no scenario made a write fail, so the
// string "Could not save that -- nothing was changed." was read by nothing anywhere in the repo,
// and a wedged flag would have silently stopped every later pick.
const failPage = await freshPage(() => {
  const day = new Date(); day.setHours(0, 0, 0, 0); const d = day.getTime();
  localStorage.setItem('chemowell-app-profiles-v1', JSON.stringify({ list: [{ id: 'p1', name: 'Alex', createdAt: 1 }], activeId: 'p1' }));
  localStorage.setItem('chemowell-app-p-p1-prefs-v1', JSON.stringify({ patientName: 'Alex', onboarded: true, sex: 'female', treatmentType: 'chemo', tourDone: true, installedAt: d - 7 * 86400000 }));
  localStorage.setItem('chemowell-app-p-p1-med-v1', JSON.stringify({ version: 2, archivedMeds: {}, meds: [] }));
  localStorage.setItem('chemowell-app-p-p1-entries-v1', JSON.stringify([
    { id: 'f1', medId: 'bowel_movement', value: 'normal', dose: 'Normal', mg: 0, ts: d - 86400000 + 12 * 3600000 }
  ]));
});
await failPage.evaluate(() => window.__v86Test.openReport('bowel_movement'));
await failPage.waitForTimeout(1000);
const refused = await failPage.evaluate(async (day) => {
  const real = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) { if (/-entries-v1$/.test(k)) throw new Error('quota'); return real.call(this, k, v); };
  const open = document.querySelector('[data-correct-day="' + day + '"]');
  if (!open) { Storage.prototype.setItem = real; return { ok: false, why: 'no Correct button' }; }
  open.click();
  await new Promise(r => setTimeout(r, 600));
  const pick = document.querySelector('[data-correcting-day="' + day + '"] [data-correct-value="diarrhea"]');
  if (!pick) { Storage.prototype.setItem = real; return { ok: false, why: 'picker did not open' }; }
  pick.click();
  await new Promise(r => setTimeout(r, 900));
  const saidSo = /Could not save that/i.test(document.body.innerText);
  Storage.prototype.setItem = real;
  return { ok: true, saidSo,
           n: JSON.parse(localStorage.getItem('chemowell-app-p-p1-entries-v1') || '[]').filter(e => e.medId === 'bowel_movement').length };
}, D0 - 86400000);
t('precondition: the picker was reachable with writes failing', refused.ok === true, JSON.stringify(refused.why || 'reached'));
if (refused.ok) {
  t('a refused write tells the caregiver rather than failing silently', refused.saidSo === true,
    refused.saidSo ? 'said so' : 'said nothing');
  // AND THE FLAG IS RELEASED. With writes working again a later pick must still land -- this is
  // what a reset moved out of the `finally` would break, invisibly.
  const recovered = await failPage.evaluate(async (day) => {
    const n0 = JSON.parse(localStorage.getItem('chemowell-app-p-p1-entries-v1') || '[]').filter(e => e.medId === 'bowel_movement').length;
    // THE PICKER STAYS OPEN AFTER A REFUSED WRITE, deliberately -- closing it would throw away
    // the caregiver's choice at the moment they most want to try again. So this retries on the
    // picker that is already open rather than hunting for a Correct button that is not rendered.
    let pick = document.querySelector('[data-correcting-day="' + day + '"] [data-correct-value="diarrhea"]');
    if (!pick) {
      const open = document.querySelector('[data-correct-day="' + day + '"]');
      if (!open) return { ok: false, why: 'neither an open picker nor a Correct button' };
      open.click();
      await new Promise(r => setTimeout(r, 600));
      pick = document.querySelector('[data-correcting-day="' + day + '"] [data-correct-value="diarrhea"]');
    }
    if (!pick) return { ok: false, why: 'picker would not open' };
    pick.click();
    await new Promise(r => setTimeout(r, 900));
    return { ok: true, n0, n1: JSON.parse(localStorage.getItem('chemowell-app-p-p1-entries-v1') || '[]').filter(e => e.medId === 'bowel_movement').length };
  }, D0 - 86400000);
  t('and the next pick still works -- the busy flag was released', recovered.ok && recovered.n1 === recovered.n0 + 1,
    recovered.ok ? (recovered.n0 + ' -> ' + recovered.n1) : 'picker unreachable');
}

console.log('\n7c. THE HELP PROSE MUST MATCH THE CONTROLS IT DESCRIBES');
// THE AUDIT'S HEADLINE, AND IT IS THIS RELEASE'S OWN DEFECT ONE SCREEN OVER.
//
// Help -> Symptoms -> "Should diarrhoea go in Symptoms or the bowel tracker?" answered "Either
// works" and stated "The Symptoms list does include diarrhoea and constipation for exactly that
// reason." The picker has not offered either since v57 -- the comment above SYMPTOM_TYPES says so
// in terms. A second topic enumerated the choices and named them too. Both prose lists had been
// copied from SYMPTOM_TYPES, which has ELEVEN entries, rather than from the control, which has
// nine. A caregiver with diarrhoea at 2am was told Symptoms carries it and sent to a control it
// was taken out of thirty releases ago.
//
// A positive claim about a deleted control is worse than an incomplete list, and it survived
// every gate here because nothing tied a sentence to a picker. These checks are that tie. They
// read the SHIPPED data, not a copy of it.
const helpPage = await freshPage(() => {
  const day = new Date(); day.setHours(0, 0, 0, 0); const d = day.getTime();
  localStorage.setItem('chemowell-app-profiles-v1', JSON.stringify({ list: [{ id: 'p1', name: 'Alex', createdAt: 1 }], activeId: 'p1' }));
  localStorage.setItem('chemowell-app-p-p1-prefs-v1', JSON.stringify({ patientName: 'Alex', onboarded: true, sex: 'female', treatmentType: 'chemo', tourDone: true, installedAt: d - 7 * 86400000 }));
  localStorage.setItem('chemowell-app-p-p1-med-v1', JSON.stringify({ version: 2, archivedMeds: {}, meds: [] }));
  localStorage.setItem('chemowell-app-p-p1-entries-v1', JSON.stringify([]));
});
const helpData = await helpPage.evaluate(() => {
  const T = window.__v86Test;
  const topics = T.helpTopics();
  const text = tp => [tp.q, tp.a].concat(tp.steps || []).concat(tp.note ? [tp.note] : [])
    .concat((tp.branches || []).flatMap(br => [br.when].concat(br.steps || [])))
    .filter(v => typeof v === 'string').join(' \n ');
  const byId = {};
  topics.forEach(tp => { byId[tp.id] = text(tp); });
  return { ids: T.selectableSymptomIds(), types: T.symptomTypes(), bowel: T.bowelLabels(),
           symLog: byId['sym-log'] || '', symBowel: byId['sym-bowel-confusion'] || '',
           all: topics.map(tp => text(tp)).join(' \n ') };
});

// A -- THE CONTROL ITSELF, driven, not read. It is generated from the id list now, so this is the
// check that catches somebody hand-writing the options back in.
const pickerValues = await helpPage.evaluate(async () => {
  const sym = [...document.querySelectorAll('button')].find(x => /^Symptoms$/.test((x.innerText || '').trim()));
  if (!sym) return { ok: false, why: 'no Symptoms tab' };
  sym.click();
  await new Promise(r => setTimeout(r, 700));
  const plus = [...document.querySelectorAll('button')].find(x => (x.innerText || '').trim() === '+');
  if (!plus) return { ok: false, why: 'no + button on Symptoms' };
  plus.click();
  await new Promise(r => setTimeout(r, 700));
  const sel = [...document.querySelectorAll('[role="dialog"] select')].find(s2 => [...s2.options].some(o => /Nausea/i.test(o.textContent)));
  if (!sel) return { ok: false, why: 'no symptom select in the dialog' };
  return { ok: true, values: [...sel.options].map(o => o.value).filter(Boolean) };
});
t('precondition: the symptom picker opens', pickerValues.ok === true, JSON.stringify(pickerValues.why || 'open'));
if (pickerValues.ok) {
  t('the symptom picker offers exactly the app’s selectable list, in order',
    JSON.stringify(pickerValues.values) === JSON.stringify(helpData.ids),
    'picker=' + pickerValues.values.join(',') + '  list=' + helpData.ids.join(','));
}

// B -- the enumeration in Help names every selectable symptom and nothing else.
const notSelectable = Object.keys(helpData.types).filter(k => helpData.ids.indexOf(k) < 0);
const spokenMissing = helpData.ids.filter(id => {
  const label = (helpData.types[id] || id).toLowerCase();
  const head = label.split(' (')[0].split('/')[0].trim();
  return helpData.symLog.toLowerCase().indexOf(head) < 0 && id !== 'neuropathy' && id !== 'skin_reaction';
});
t('precondition: the app has symptom types that are NOT selectable', notSelectable.length > 0, notSelectable.join(',') || 'none');
t('Help’s list of what you can choose names every selectable symptom', spokenMissing.length === 0,
  spokenMissing.length ? ('missing from sym-log: ' + spokenMissing.join(',')) : helpData.symLog.slice(0, 0) + 'all present');
const wronglyNamed = notSelectable.filter(k => new RegExp('\\b' + (helpData.types[k] || k).toLowerCase().replace('diarrhea', 'diarrh(e|o)ea') + '\\b', 'i').test(helpData.symLog));
t('and names none that the picker does not offer', wronglyNamed.length === 0,
  wronglyNamed.length ? ('sym-log still offers: ' + wronglyNamed.join(',')) : 'none');

// C -- no topic anywhere may ASSERT that Symptoms carries them. The bowel topic says the opposite,
// on purpose, so this looks for the affirmative claim rather than for the words.
const falseClaim = /(symptoms?[^.]{0,40}(list|picker|tab)[^.]{0,40}\b(does include|includes|offers|has)\b[^.]{0,40}(diarrh|constipation))|(\b(does include|includes)\b[^.]{0,30}(diarrh(o?)ea|constipation)[^.]{0,40}symptom)/i;
t('no Help topic claims the Symptoms list carries diarrhoea or constipation',
  !falseClaim.test(helpData.all), (helpData.all.match(falseClaim) || ['none'])[0]);

// D -- F4: the bowel enumeration in prose, held to the map. The previous round fixed this
// sentence by hand and nothing checked it: an audit reverted it to the four-of-five wording that
// had just been refused and scored 45/45, 87/87 and v55-help green.
const bowelWords = Object.keys(helpData.bowel).map(k => helpData.bowel[k].toLowerCase());
const bowelMissing = bowelWords.filter(w => helpData.symBowel.toLowerCase().indexOf(w) < 0);
t('the bowel topic names every value the app defines', bowelMissing.length === 0,
  bowelMissing.length ? ('missing: ' + bowelMissing.join(',')) : bowelWords.join(', '));
await helpPage.close();

console.log('\n8. NOTHING THREW, ON ANY PAGE');
t('no page error at any point above', thrown.length === 0, thrown.join(' | ') || 'none');

console.log('\n9. THE README FIGURE FOR THIS SUITE MUST BE THIS SUITE\'S FIGURE');
// Last check in the file, deliberately: the offset is then exactly one, itself. app-v85 carried
// this with a typed `+2` for the checks after it, and deleting any of those left the README wrong
// and the check green.
const claim = await bannerPage.evaluate(async (base2) => {
  const url = base2.replace(/index\.html.*$/, 'README.md');
  const txt = await (await fetch(url)).text();
  const m = txt.match(/test\/v87-correct-a-past-day\.mjs`?\*{0,2}\s*\*{0,2}(\d+)\/(\d+)/);
  return m ? { claimed: Number(m[1]), of: Number(m[2]) } : null;
}, BASE);
const total = pass + fail + 1;
t('the README figure for this suite is this suite\'s figure',
  !!claim && claim.of === total && claim.claimed === total,
  claim ? ('README says ' + claim.claimed + '/' + claim.of + ', this run counts ' + total)
        : 'README names no figure for test/v87-correct-a-past-day.mjs');

console.log('\n' + (pass + fail) + ' checks: ' + pass + ' passed, ' + fail + ' failed');
await b.close();
process.exit(fail ? 1 : 0);
