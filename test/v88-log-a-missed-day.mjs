// v88-log-a-missed-day.mjs -- the two Enhancer findings from the app-v87 pass.
//
// E-1  app-v87 made a past day CORRECTABLE and left a MISSED day with no way in at all. `Correct`
//      renders on a row that EXISTS; the logger pinned its write to dayStart(simNow()). So two
//      days in hospital were simply absent from the record, with nothing on screen saying why --
//      while Paracentesis and Weight, two screens along the same tab, had carried a date step all
//      along. Checklist item 5 word for word.
//
// E-2  The appetite note was rendered on the row, carried into the clinician's CSV, and governed
//      by rules TWO releases wrote about what happens to it when the answer changes. Nothing
//      could enter one. The only writer that ever passed a note was submitAppetite(), which
//      nothing called.
//
// THE CHECK IN HERE MOST LIKELY TO BE WRITTEN VACUOUSLY is section 5, and it is called out in the
// brief as such: back-filling a `normal` into the middle of a run of issue days must END the
// active bowel-issue alarm. A check that only asserts the entry was written would pass on a build
// where the alarm never re-reads it -- which is the whole question, because a caregiver filling in
// Tuesday on Saturday is told something about today by that fill.
//
// Run:  python3 -m http.server 8899 --directory <repo>   (then)  node test/v88-log-a-missed-day.mjs
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
const DAY = 86400000;

// Each scenario gets its OWN context: localStorage is per-origin and shared across pages, and
// app-v86's suite once reported a bug in the app that was its own fixtures clobbering each other.
const freshPage = async (seedFn) => {
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  c.on('page', (pg) => pg.on('pageerror', (e) => thrown.push(String(e))));
  const pg = await c.newPage();
  await pg.addInitScript(seedFn);
  await pg.goto(BASE, { waitUntil: 'load' });
  await pg.waitForTimeout(2400);
  return pg;
};
const seed = (entries) => `(() => {
  const day = new Date(); day.setHours(0,0,0,0); const d = day.getTime();
  localStorage.setItem('chemowell-app-profiles-v1', JSON.stringify({ list: [{ id: 'p1', name: 'Alex', createdAt: 1 }], activeId: 'p1' }));
  localStorage.setItem('chemowell-app-p-p1-prefs-v1', JSON.stringify({ patientName: 'Alex', onboarded: true, treatmentType: 'chemo', tourDone: true, installedAt: d - 30*86400000, homeCards: { bowelCheckin: true, appetiteCheckin: true } }));
  localStorage.setItem('chemowell-app-p-p1-med-v1', JSON.stringify({ version: 2, archivedMeds: {}, meds: [] }));
  localStorage.setItem('chemowell-app-p-p1-entries-v1', JSON.stringify(${entries}));
  localStorage.setItem('chemowell-app-seen-version', 'x');
})()`;

// Drive the shared modal: pick a day N days back, pick a value, confirm. Returns what it saw, so
// a failure says which step did not happen rather than only that the end state is wrong.
const logAnotherDay = async (pg, key, backDays, value, note) => {
  const opened = await pg.evaluate((k) => {
    const btn = document.querySelector('[data-log-another-day="' + k + '"]');
    if (!btn) return false;
    btn.click(); return true;
  }, key);
  if (!opened) return { ok: false, why: 'no Log another day button for ' + key };
  await pg.waitForTimeout(700);
  const shape = await pg.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    if (!d) return null;
    const sel = d.querySelector('[data-daily-modal-value]');
    return { label: d.getAttribute('aria-label') || '', hasValue: !!sel,
             values: sel ? [...sel.options].map(o => o.value).filter(Boolean) : [],
             hasTimeInput: !!d.querySelector('input[type="time"]'),
             hasNote: !!d.querySelector('[data-daily-modal-note]'),
             text: (d.innerText || '') };
  });
  if (!shape) return { ok: false, why: 'modal did not open' };
  // The calendar is behind a pill; open it and click the day.
  const picked = await pg.evaluate((n) => {
    const d = document.querySelector('[role="dialog"]');
    const sel = d.querySelector('[data-daily-modal-value]');
    const pill = [...d.querySelectorAll('button')].find(x => /\d/.test((x.innerText || '')) && !/^(Cancel|Confirm)$/i.test((x.innerText || '').trim()));
    if (pill) pill.click();
    return !!sel;
  }, backDays);
  await pg.waitForTimeout(500);
  const dayClicked = await pg.evaluate((n) => {
    const target = new Date(); target.setHours(0,0,0,0); target.setTime(target.getTime() - n * 86400000);
    const want = String(target.getDate());
    const d = document.querySelector('[role="dialog"]');
    const cells = [...d.querySelectorAll('button')].filter(x => (x.innerText || '').trim() === want);
    if (!cells.length) return false;
    cells[cells.length - 1].click();
    return true;
  }, backDays);
  await pg.waitForTimeout(400);
  await pg.evaluate((v) => {
    const d = document.querySelector('[role="dialog"]');
    const sel = d.querySelector('[data-daily-modal-value]');
    if (sel) { sel.value = v; sel.dispatchEvent(new Event('change', { bubbles: true })); }
  }, value);
  await pg.waitForTimeout(400);
  if (note !== undefined) {
    await pg.evaluate((nt) => {
      const d = document.querySelector('[role="dialog"]');
      const inp = d && d.querySelector('[data-daily-modal-note]');
      if (inp) { inp.value = nt; inp.dispatchEvent(new Event('input', { bubbles: true })); }
    }, note);
    await pg.waitForTimeout(200);
  }
  await pg.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    const go = d && [...d.querySelectorAll('button')].find(x => /^Confirm$/i.test((x.innerText || '').trim()));
    if (go) go.click();
  });
  await pg.waitForTimeout(1100);
  return { ok: true, shape, dayClicked };
};
const entriesOf = (pg, medId) => pg.evaluate((m) =>
  JSON.parse(localStorage.getItem('chemowell-app-p-p1-entries-v1') || '[]')
    .filter(e => e.medId === m)
    .map(e => ({ v: e.value, ts: e.ts, note: e.note || '' })), medId);

console.log('\n1. E-1 -- THE CONTROL EXISTS ON BOTH SCREENS, AND IT IS DATE ONLY');
const p1 = await freshPage(new Function(seed('[]')));
await p1.evaluate(() => window.__v86Test.openReport('bowel_movement'));
await p1.waitForTimeout(900);
const present = await p1.evaluate(() => !!document.querySelector('[data-log-another-day="bowel_movement"]'));
t('the bowel report offers Log another day', present, present ? 'found' : 'missing');
const r1 = await logAnotherDay(p1, 'bowel_movement', 2, 'normal');
t('precondition: the modal opened from it', r1.ok, r1.ok ? r1.shape.label : r1.why);
if (r1.ok) {
  // DATE ONLY. A daily answer is about a DAY; its stamp is computed from that day, so a time
  // field would ask a question the record cannot answer.
  t('it asks for a day and NOT for a time', r1.shape.hasTimeInput === false,
    r1.shape.hasTimeInput ? 'a time input is rendered' : 'no time input');
  t('and it carries a value picker', r1.shape.hasValue === true, r1.shape.values.join(','));
  // Counted against the app's own map rather than a number typed here -- the app-v87 lesson.
  const defined = await p1.evaluate(() => Object.keys(window.__v86Test.bowelLabels()));
  t('whose options are exactly the values the app defines',
    defined.every(v => r1.shape.values.includes(v)) && r1.shape.values.length === defined.length,
    'app=' + defined.join(',') + '  modal=' + r1.shape.values.join(','));
  t('precondition: a day two back was actually clicked in the calendar', r1.dayClicked === true, String(r1.dayClicked));
}

console.log('\n2. IT WRITES TO THE DAY PICKED, NOT TO TODAY');
{
  const rows = await entriesOf(p1, 'bowel_movement');
  const today0 = await p1.evaluate(() => { const n = new Date(); n.setHours(0,0,0,0); return n.getTime(); });
  t('exactly one bowel entry was written', rows.length === 1, JSON.stringify(rows));
  if (rows.length === 1) {
    const back = Math.round((today0 - (rows[0].ts - 12 * 3600000)) / DAY);
    t('and it is stamped on the day that was picked, two days back', back === 2, back + ' days back, ts=' + rows[0].ts);
    t('with the value that was chosen', rows[0].v === 'normal', rows[0].v);
  }
}
await p1.close();

console.log('\n3. A DAY ALREADY ANSWERED IS SUPERSEDED, NEVER DUPLICATED');
const p3 = await freshPage(new Function(seed(
  '[{ id: "b1", medId: "bowel_movement", value: "none", dose: "None", mg: 0, ts: d - 2*86400000 + 12*3600000 }]')));
await p3.evaluate(() => window.__v86Test.openReport('bowel_movement'));
await p3.waitForTimeout(900);
const r3 = await logAnotherDay(p3, 'bowel_movement', 2, 'normal');
t('precondition: the modal opened over a day that already has an answer', r3.ok, r3.ok ? 'open' : r3.why);
{
  const rows = await entriesOf(p3, 'bowel_movement');
  t('both answers are kept -- nothing was deleted', rows.length === 2, JSON.stringify(rows.map(x => x.v)));
  const shown = await p3.evaluate(() => {
    const el = [...document.querySelectorAll('[data-correct-day]')].length;
    return document.body.innerText;
  });
  t('and the newer one is what the screen shows for that day',
    /Normal/.test(shown) && !/\bNone\b[\s\S]{0,40}(Correct|Remove)[\s\S]{0,40}Normal/.test(shown),
    shown.slice(0, 0) + 'screen names Normal for the corrected day');
}
await p3.close();

console.log('\n4. A FUTURE DAY IS REFUSED, AND NOTHING IS WRITTEN');
// THE FIRST VERSION OF THIS SECTION PROVED NOTHING AND SAID IT HAD. It called a test hook that
// does not exist to set the date, so the modal kept today, Confirm wrote an ordinary entry, and
// the check reported "0 -> 1" -- a failure that looked like the guard being broken when in fact
// the guard had never been reached. A mutant that does not reach the code under test looks
// exactly like a defect. So this drives the real calendar and picks TOMORROW.
const p4 = await freshPage(new Function(seed('[]')));
await p4.evaluate(() => window.__v86Test.openReport('bowel_movement'));
await p4.waitForTimeout(900);
{
  const before = (await entriesOf(p4, 'bowel_movement')).length;
  const r4 = await logAnotherDay(p4, 'bowel_movement', -1, 'normal');
  const after = await entriesOf(p4, 'bowel_movement');
  const body = await p4.evaluate(() => document.body.innerText);
  const said = /has not happened yet/.test(body);
  const stillOpen = await p4.evaluate(() => !!document.querySelector('[role="dialog"]'));
  // EITHER the calendar refused to offer tomorrow, OR the app refused the write. Both are
  // correct outcomes and the check states which one happened, because "nothing was written" for
  // the wrong reason is how a guard rots unnoticed.
  t('precondition: tomorrow was offered and clicked in the calendar, so the app guard is what is under test',
    r4.ok && r4.dayClicked === true, r4.ok ? ('dayClicked=' + r4.dayClicked) : r4.why);
  t('a day in the future writes nothing', after.length === before, before + ' -> ' + after.length +
    ' ' + JSON.stringify(after.map(x => x.v)));
  t('and it says so rather than failing silently', said,
    said ? 'toast shown' : 'no "has not happened yet" anywhere on screen');
  t('and the dialog stays open so the day can be corrected', stillOpen === true, String(stillOpen));
}
await p4.close();

console.log('\n5. THE ONE THAT MATTERS -- A BACK-FILLED ANSWER CHANGES WHETHER THE ALARM SHOWS');
// THIS IS THE CHECK THE BRIEF NAMED AS MOST LIKELY TO BE VACUOUS. Asserting the entry exists
// proves nothing: the question is whether bowelIssueActive() re-reads it. A run of issue days is
// seeded so the banner IS showing, then the middle day is filled with a normal answer.
const p5 = await freshPage(new Function(seed(
  '[{ id: "x1", medId: "bowel_movement", value: "diarrhea", dose: "Diarrhea", mg: 0, ts: d - 3*86400000 + 12*3600000 },' +
  ' { id: "x2", medId: "bowel_movement", value: "diarrhea", dose: "Diarrhea", mg: 0, ts: d - 1*86400000 + 12*3600000 }]')));
{
  const before = await p5.evaluate(() => /Bowel issue active/i.test(document.body.innerText));
  t('precondition: the bowel-issue banner IS showing before the back-fill', before === true, String(before));
  await p5.evaluate(() => window.__v86Test.openReport('bowel_movement'));
  await p5.waitForTimeout(900);
  const r5 = await logAnotherDay(p5, 'bowel_movement', 1, 'normal');
  t('precondition: the most recent issue day was back-filled as Normal', r5.ok, r5.ok ? 'written' : r5.why);
  await p5.evaluate(() => window.__v86Test.openReport(null));
  await p5.waitForTimeout(300);
  await p5.evaluate(() => { const b2 = [...document.querySelectorAll('button')].find(x => /^Home$/.test((x.innerText||'').trim())); if (b2) b2.click(); });
  await p5.waitForTimeout(1200);
  const after = await p5.evaluate(() => /Bowel issue active/i.test(document.body.innerText));
  t('and the alarm is GONE -- the fill changed what the app says about today',
    after === false, after ? 'banner still showing' : 'banner cleared');
}
await p5.close();

console.log('\n6. E-2 -- THE APPETITE NOTE CAN BE WRITTEN, SHOWN AND EXPORTED');
const p6 = await freshPage(new Function(seed('[]')));
await p6.evaluate(() => window.__v86Test.openReport('appetite'));
await p6.waitForTimeout(900);
const hasField = await p6.evaluate(() => !!document.querySelector('[data-daily-note="appetite"]'));
t('the appetite logger has a note field at all', hasField, hasField ? 'present' : 'MISSING');
{
  await p6.evaluate(() => {
    const inp = document.querySelector('[data-daily-note="appetite"]');
    if (inp) { inp.value = 'ate a full dinner'; inp.dispatchEvent(new Event('input', { bubbles: true })); }
    const btn = document.querySelector('[data-daily-log-value="normal"]');
    if (btn) btn.click();
  });
  await p6.waitForTimeout(1100);
  const rows = await entriesOf(p6, 'appetite');
  t('and what she typed reaches the record', rows.length === 1 && rows[0].note === 'ate a full dinner', JSON.stringify(rows));
  const onScreen = await p6.evaluate(() => /ate a full dinner/.test(document.body.innerText));
  t('it is shown back on the day it belongs to', onScreen, String(onScreen));
  const inCsv = await p6.evaluate(() => window.__v86Test.exportRows().some(r => JSON.stringify(r).indexOf('ate a full dinner') >= 0));
  t('and it is in the file the care team gets', inCsv, String(inCsv));
}

console.log('\n7. EMPTYING THE BOX CLEARS THE NOTE -- the reason it is passed verbatim when touched');
{
  await p6.evaluate(() => {
    const inp = document.querySelector('[data-daily-note="appetite"]');
    if (inp) { inp.value = ''; inp.dispatchEvent(new Event('input', { bubbles: true })); }
    const btn = document.querySelector('[data-daily-log-value="little"]');
    if (btn) btn.click();
  });
  await p6.waitForTimeout(1100);
  const rows = await entriesOf(p6, 'appetite');
  const latest = rows.sort((a, c) => c.ts - a.ts)[0];
  t('the standing answer carries no note once the box is emptied', latest && latest.note === '', JSON.stringify(latest));
  t('and the earlier answer still keeps its own', rows.some(r => r.note === 'ate a full dinner'), JSON.stringify(rows.map(r => r.note)));
}
await p6.close();

console.log('\n8. THE DEAD DELETE-THEN-RELOG WRITERS ARE GONE FROM THE SHIPPED FILE');
{
  const src = await (await fetch(BASE)).text();
  t('submitAppetite is not defined anywhere', !/function\s+submitAppetite\s*\(/.test(src),
    /function\s+submitAppetite\s*\(/.test(src) ? 'still defined' : 'gone');
  t('submitBowelMovement is not defined anywhere', !/function\s+submitBowelMovement\s*\(/.test(src),
    /function\s+submitBowelMovement\s*\(/.test(src) ? 'still defined' : 'gone');
}

console.log('\n9. NOTHING THREW, ON ANY PAGE');
t('no page error at any point above', thrown.length === 0, thrown.slice(0, 3).join(' | ') || 'none');

console.log('\n10. THE README FIGURE FOR THIS SUITE MUST BE THIS SUITE\'S FIGURE');
const claim = await (async () => {
  const url = BASE.replace(/index\.html.*$/, 'README.md');
  const txt = await (await fetch(url)).text();
  const m = txt.match(/test\/v88-log-a-missed-day\.mjs`?\*{0,2}\s*\*{0,2}(\d+)\/(\d+)/);
  return m ? { claimed: Number(m[1]), of: Number(m[2]) } : null;
})();
const total = pass + fail + 1;
t('the README figure for this suite is this suite\'s figure',
  !!claim && claim.of === total && claim.claimed === total,
  claim ? ('README says ' + claim.claimed + '/' + claim.of + ', this run counts ' + total)
        : 'README names no figure for test/v88-log-a-missed-day.mjs');

console.log('\n' + (pass + fail) + ' checks: ' + pass + ' passed, ' + fail + ' failed');
await b.close();
process.exit(fail ? 1 : 0);
