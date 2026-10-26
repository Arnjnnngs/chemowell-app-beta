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
// FALSIFIED. Three mutants, each against a byte copy served on its own port via FALSIFY_BASE,
// the repo file never touched:
//   M1  the back-fill writes to TODAY instead of the day picked, and the future guard disabled
//       -> 4 red, including "0 days back" and a future day writing an entry.
//   M2  supersedeStamp returns the colliding base stamp, so a back-filled answer may not win its
//       day -> 4 red, AND section 5 goes "banner still showing", which is the proof that check
//       discriminates rather than restating that an entry exists. M1 did NOT turn section 5 red,
//       because writing `normal` to today also ends the alarm -- noted here so nobody reads M1's
//       4 reds as covering it.
//   M3  the appetite note field removed, everything else intact -> 5 red.
//
// SECOND ROUND. The three mutants that walked through the first set, re-run here and now caught:
//   M5   the row corrector sends what is DISPLAYED instead of what was TYPED  -> 1 red (7d2 row)
//   M6   the logger does the same                                            -> 1 red (7d2 logger)
//   M16  the display expression always returns blank, sent value left correct -> 3 red (7b, 7f A+B)
// All three survived the first set for one reason: no section used the only fixture that
// distinguishes displayed from typed -- a day that ALREADY HAS a note, a box NOBODY TOUCHED, and
// a DIFFERENT answer picked. One section typed first, the other cleared the draft, so in both of
// them the two agreed. 7d2 is that fixture, on both surfaces.
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
             // THE VALUE, not just the element. Asserting `!!element` tests that a box is
             // rendered, which is true on a build whose display expression always returns blank
             // -- an audit reverted exactly that and scored the whole gate green.
             noteShown: (d.querySelector('[data-daily-modal-note]') || {}).value,
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
  // RE-READ AFTER THE DAY IS PICKED. The first version captured `shape` at open time, when the
  // modal still held today -- so the "shows that day's note" check was reading a day with no
  // note and reported an empty box as a defect in the app. The box is a function of the day.
  shape.noteShown = await pg.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    const inp = d && d.querySelector('[data-daily-modal-note]');
    return inp ? inp.value : null;
  });
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
  // THE DAY'S OWN ROW, NOT THE WHOLE PAGE -- the first version of this was vacuous and an audit
  // proved it. Clause one tested /Normal/ against document.body.innerText, which is
  // unconditionally true because the logger's own buttons are on that page; clause two only
  // fired because the TOAST happened to sit within 40 characters of the word "Remove". Reword
  // the toast and an oldest-wins build scored this green. So: find the row for that day by its
  // own Correct button and read only that container.
  const rowText = await p3.evaluate((target) => {
    const btn = [...document.querySelectorAll('[data-correct-day]')]
      .find(x => String(x.getAttribute('data-correct-day')) === String(target));
    if (!btn) return null;
    let row = btn.parentElement;
    for (let i = 0; i < 4 && row && !/\d/.test(row.innerText || ''); i++) row = row.parentElement;
    return row ? (row.innerText || '') : null;
  }, (() => { const n = new Date(); n.setHours(0,0,0,0); return n.getTime() - 2 * DAY; })());
  t('precondition: that day has a row on screen with its own Correct button', !!rowText, rowText === null ? 'no row found' : 'found');
  t('and the newer answer is what that row shows',
    !!rowText && /Normal/.test(rowText) && !/None/.test(rowText),
    rowText ? JSON.stringify(rowText.replace(/\s+/g, ' ').slice(0, 90)) : 'n/a');
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

console.log('\n7b. THE UNTOUCHED NOTE BOX MUST NOT CLEAR A NOTE -- the path the rule exists for');
// NEITHER SECTION 6 NOR 7 EXERCISED THIS, which an audit found and which is how the release's
// worst defect got in: both of them TYPE in the box, so the untouched path that
// dailyNoteToSend() exists for was never driven. The modal opened with note: '' -- the
// touched-and-emptied signal -- so confirming it without going near the note box sent "delete
// the note", and re-picking the answer already standing for a day silently removed the note
// while the superseded line kept the only copy of it.
const p7b = await freshPage(new Function(seed(
  '[{ id: "a1", medId: "appetite", value: "normal", dose: "Normal", mg: 0, note: "ate a full dinner", ts: d - 2*86400000 + 12*3600000 }]')));
await p7b.evaluate(() => window.__v86Test.openReport('appetite'));
await p7b.waitForTimeout(900);
{
  const before = await entriesOf(p7b, 'appetite');
  t('precondition: that day already carries a note', before.length === 1 && before[0].note === 'ate a full dinner', JSON.stringify(before));
  // Same answer, same day, note box NEVER touched.
  const r = await logAnotherDay(p7b, 'appetite', 2, 'normal');
  t('precondition: the modal was driven over that day', r.ok, r.ok ? 'open' : r.why);
  t('and the modal shows the note that day already has, rather than an empty box',
    r.ok && r.shape.noteShown === 'ate a full dinner',
    r.ok ? ('box contained ' + JSON.stringify(r.shape.noteShown)) : 'n/a');
  const after = await entriesOf(p7b, 'appetite');
  const latest = after.slice().sort((a, c) => c.ts - a.ts)[0];
  t('confirming without touching the note box does not delete the note',
    !!latest && latest.note === 'ate a full dinner',
    JSON.stringify(after.map(x => ({ v: x.v, note: x.note }))));
}
await p7b.close();

console.log('\n7c. A DOUBLE TAP ON CONFIRM WRITES ONE ROW, NOT THREE');
// Every other branch of this modal closes before it awaits; the daily branch awaited first and
// had no busy flag, so three taps wrote three rows WITH THE SAME TIMESTAMP -- which
// isSupersededEntry, being strictly-newer-wins, marks as none of them superseding anything.
// Three identical lines in the clinician's export, each presented as a separate answer.
const p7c = await freshPage(new Function(seed('[]')));
await p7c.evaluate(() => window.__v86Test.openReport('bowel_movement'));
await p7c.waitForTimeout(900);
{
  await p7c.evaluate(() => { const b2 = document.querySelector('[data-log-another-day="bowel_movement"]'); if (b2) b2.click(); });
  await p7c.waitForTimeout(700);
  await p7c.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    const go = d && [...d.querySelectorAll('button')].find(x => /^Confirm$/i.test((x.innerText || '').trim()));
    if (go) { go.click(); go.click(); go.click(); }
  });
  await p7c.waitForTimeout(1400);
  const rows = await entriesOf(p7c, 'bowel_movement');
  t('three taps on Confirm write exactly one entry', rows.length === 1, rows.length + ' rows: ' + JSON.stringify(rows.map(r => r.ts)));
  const stamps = new Set(rows.map(r => r.ts));
  t('and no two entries share a timestamp, so supersede can always tell them apart',
    stamps.size === rows.length, rows.length + ' rows, ' + stamps.size + ' distinct stamps');
}
await p7c.close();

console.log('\n7d. THE CORRECTOR\u2019S OWN NOTE FIELD -- never queried until now');
const p7d = await freshPage(new Function(seed(
  '[{ id: "a2", medId: "appetite", value: "normal", dose: "Normal", mg: 0, ts: d - 1*86400000 + 12*3600000 }]')));
await p7d.evaluate(() => window.__v86Test.openReport('appetite'));
await p7d.waitForTimeout(900);
{
  const opened = await p7d.evaluate(() => {
    const btn = document.querySelector('[data-correct-day]');
    if (!btn) return false;
    btn.click(); return true;
  });
  await p7d.waitForTimeout(600);
  const hasField = await p7d.evaluate(() => !!document.querySelector('[data-correct-note]'));
  t('precondition: the corrector opened', opened, String(opened));
  t('the corrector carries a note field', hasField, hasField ? 'present' : 'MISSING');
  await p7d.evaluate(() => {
    const inp = document.querySelector('[data-correct-note]');
    if (inp) { inp.value = 'only managed toast'; inp.dispatchEvent(new Event('input', { bubbles: true })); }
    const b2 = document.querySelector('[data-correct-value="little"]');
    if (b2) b2.click();
  });
  await p7d.waitForTimeout(1100);
  const rows = await entriesOf(p7d, 'appetite');
  const latest = rows.slice().sort((a, c) => c.ts - a.ts)[0];
  t('and a note typed there reaches the record alongside the new answer',
    !!latest && latest.v === 'little' && latest.note === 'only managed toast', JSON.stringify(latest));
}
await p7d.close();

console.log('\n7d2. THE UNTOUCHED BOX ON A DAY THAT HAS A NOTE, PICKING A DIFFERENT ANSWER');
// THE DISCRIMINATING FIXTURE, and neither 7d nor 7e was it. An audit kept two mutants alive
// through both of them -- the corrector and the logger each sending dailyNoteFor (what is
// DISPLAYED) instead of dailyNoteToSend (what was TYPED). The two functions only disagree in one
// situation: a day that already carries a note, a box nobody touched, and a DIFFERENT answer
// picked. 7d typed first and seeded no note, 7e deleted the draft, so in both of them the two
// agreed and the mutants walked. This is that case, on both surfaces.
for (const surface of ['row', 'logger']) {
  const pg = await freshPage(new Function(seed(
    '[{ id: "n1", medId: "appetite", value: "normal", dose: "Normal", mg: 0, note: "ate a full dinner", ts: d + 12*3600000 }]')));
  await pg.evaluate(() => window.__v86Test.openReport('appetite'));
  await pg.waitForTimeout(900);
  const started = await pg.evaluate((sf) => {
    if (sf === 'row') {
      const btn = document.querySelector('[data-correct-day]');
      if (!btn) return false;
      btn.click(); return true;
    }
    return !!document.querySelector('[data-daily-note="appetite"]');
  }, surface);
  await pg.waitForTimeout(500);
  t('precondition: the ' + surface + ' surface is open on a day that carries a note', started === true, String(started));
  // NOTHING IS TYPED. A different answer is picked.
  await pg.evaluate((sf) => {
    const b2 = sf === 'row' ? document.querySelector('[data-correct-value="little"]')
                            : document.querySelector('[data-daily-log-value="little"]');
    if (b2) b2.click();
  }, surface);
  await pg.waitForTimeout(1100);
  const rows = await entriesOf(pg, 'appetite');
  const latest = rows.slice().sort((a, c) => c.ts - a.ts)[0];
  // The writer's own rule: a note survives an UNCHANGED answer and is dropped when the answer
  // changes, because "ate a full dinner" under "Little to none" is a kept record that contradicts
  // itself. Sending the DISPLAYED text instead of the typed text carries it across.
  t('the ' + surface + ' does not carry the old note onto the new answer',
    !!latest && latest.v === 'little' && latest.note === '',
    JSON.stringify(latest));
  t('and the superseded answer still keeps the note that described it',
    rows.some(r => r.v === 'normal' && r.note === 'ate a full dinner'),
    JSON.stringify(rows.map(r => ({ v: r.v, note: r.note }))));
  await pg.close();
}

console.log('\n7f. THE DAY UNDER THE NOTE CAN CHANGE, AND THE NOTE MUST NOT FOLLOW IT');
// THE BLOCKER THIS SECTION EXISTS FOR, and it is the modal's note defect rotated one axis. The
// modal holds ONE note and the calendar stays open after a pick, so a second pick used to inherit
// the first day's typing. Two shapes, both reachable by ordinary use of a date picker:
//   A  empty the box meaning to clear Thursday, change your mind to Tuesday, Confirm
//      -> TUESDAY's note is deleted, having never been shown.
//   B  type a note for Thursday, switch to Tuesday, Confirm
//      -> Thursday's words become Tuesday's record.
for (const shape of ['A', 'B']) {
  const pg = await freshPage(new Function(seed(
    '[{ id: "d1", medId: "appetite", value: "normal", dose: "Normal", mg: 0, note: "ate a full dinner", ts: d - 1*86400000 + 12*3600000 },' +
    ' { id: "d2", medId: "appetite", value: "normal", dose: "Normal", mg: 0, note: "soup", ts: d - 3*86400000 + 12*3600000 }]')));
  await pg.evaluate(() => window.__v86Test.openReport('appetite'));
  await pg.waitForTimeout(900);
  await pg.evaluate(() => { const b2 = document.querySelector('[data-log-another-day="appetite"]'); if (b2) b2.click(); });
  await pg.waitForTimeout(700);
  // TRY, THEN OPEN, THEN TRY AGAIN. The calendar collapses behind its pill after a pick, so the
  // second pick found no day cells and reported false -- which looked like the app refusing a
  // second pick when it was the harness not reopening the control.
  const pickDay = async (back) => {
    const attempt = (n) => pg.evaluate((k) => {
      const target = new Date(); target.setHours(0,0,0,0); target.setTime(target.getTime() - k * 86400000);
      const want = String(target.getDate());
      const d = document.querySelector('[role="dialog"]');
      const cells = [...d.querySelectorAll('button')].filter(x => (x.innerText || '').trim() === want);
      if (!cells.length) return false;
      cells[cells.length - 1].click();
      return true;
    }, n);
    if (await attempt(back)) return true;
    await pg.evaluate(() => {
      const d = document.querySelector('[role="dialog"]');
      const pill = [...d.querySelectorAll('button')].find(x => /\d/.test(x.innerText || '') && !/^(Cancel|Confirm)$/i.test((x.innerText || '').trim()));
      if (pill) pill.click();
    });
    await pg.waitForTimeout(450);
    return attempt(back);
  };
  const first = await pickDay(1);
  await pg.waitForTimeout(400);
  await pg.evaluate((sh) => {
    const d = document.querySelector('[role="dialog"]');
    const inp = d && d.querySelector('[data-daily-modal-note]');
    if (inp) { inp.value = sh === 'A' ? '' : 'vomited after lunch'; inp.dispatchEvent(new Event('input', { bubbles: true })); }
  }, shape);
  await pg.waitForTimeout(300);
  const second = await pickDay(3);
  await pg.waitForTimeout(400);
  const boxNow = await pg.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    const inp = d && d.querySelector('[data-daily-modal-note]');
    return inp ? inp.value : null;
  });
  t('precondition (shape ' + shape + '): two different days were picked in one open calendar',
    first === true && second === true, 'first=' + first + ' second=' + second);
  t('shape ' + shape + ': changing the day re-reads that day’s own note',
    boxNow === 'soup', 'box shows ' + JSON.stringify(boxNow) + ', that day’s note is "soup"');
  await pg.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    const go = d && [...d.querySelectorAll('button')].find(x => /^Confirm$/i.test((x.innerText || '').trim()));
    if (go) go.click();
  });
  await pg.waitForTimeout(1100);
  const rows = await entriesOf(pg, 'appetite');
  const d3 = rows.filter(r => r.ts < Date.now() - 2 * DAY).slice().sort((a, c) => c.ts - a.ts)[0];
  t('shape ' + shape + ': and the day that was never typed into keeps its own note',
    !!d3 && d3.note === 'soup', JSON.stringify(rows.map(r => ({ ts: r.ts, note: r.note }))));
  await pg.close();
}

console.log('\n7e. CANCEL ON THE CORRECTOR DISCARDS WHAT WAS TYPED');
const p7e = await freshPage(new Function(seed(
  '[{ id: "a3", medId: "appetite", value: "normal", dose: "Normal", mg: 0, ts: d - 1*86400000 + 12*3600000 }]')));
await p7e.evaluate(() => window.__v86Test.openReport('appetite'));
await p7e.waitForTimeout(900);
{
  await p7e.evaluate(() => { const b2 = document.querySelector('[data-correct-day]'); if (b2) b2.click(); });
  await p7e.waitForTimeout(500);
  await p7e.evaluate(() => {
    const inp = document.querySelector('[data-correct-note]');
    if (inp) { inp.value = 'abandoned text'; inp.dispatchEvent(new Event('input', { bubbles: true })); }
    const c = [...document.querySelectorAll('button')].find(x => /^Cancel$/i.test((x.innerText || '').trim()));
    if (c) c.click();
  });
  await p7e.waitForTimeout(500);
  // Reopen the same day and pick an answer. The abandoned text must NOT come back.
  await p7e.evaluate(() => { const b2 = document.querySelector('[data-correct-day]'); if (b2) b2.click(); });
  await p7e.waitForTimeout(500);
  await p7e.evaluate(() => { const b2 = document.querySelector('[data-correct-value="little"]'); if (b2) b2.click(); });
  await p7e.waitForTimeout(1100);
  const rows = await entriesOf(p7e, 'appetite');
  const latest = rows.slice().sort((a, c) => c.ts - a.ts)[0];
  t('a note typed and then cancelled does not come back as the standing note',
    !!latest && latest.note !== 'abandoned text', JSON.stringify(latest));
}
await p7e.close();

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
