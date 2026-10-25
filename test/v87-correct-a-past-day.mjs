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
  t('and the note the day carried comes with it', app.note === 'ate a full dinner', 'note="' + app.note + '"');
}

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
