// v83-meds-and-reports.mjs -- the Meds card, the Temperature report, and the symptom bars.
//
// THREE SCREENS, ONE RELEASE, AND ONE THING THEY HAVE IN COMMON: each shows the caregiver a NUMBER
// about a patient that was not on screen before. That is the class this project has been hurt by
// most -- app-v82 put "N logged" on Home and it counted doses that were never given -- so every
// figure below is checked against what the app itself believes, not against a fixture I wrote.
//
//   MEDS CARD (Enhancer E5). The card said what a medication IS and nothing about what has
//   happened. Status pill, doses-today line, ceiling bar. The pill comes from the SAME status()
//   the Home cards use, so Meds can never disagree with Home about whether a dose may be given --
//   and that is the check that matters, because disagreement here means somebody gives a dose the
//   app elsewhere says to withhold.
//
//   TEMPERATURE REPORT. There was none. The app colours a reading red at the high threshold
//   because a fever during chemotherapy can mean neutropenic sepsis, and then offered nowhere to
//   see the readings over time. The chart's threshold lines are read from the app's own
//   tempFever()/tempHigh(), so a line drawn here cannot disagree with the colour shown on Home.
//
//   SYMPTOM BARS. A list with no summary. "How often has the nausea been happening" had to be
//   answered by counting rows by hand.
//
// Run:  python3 -m http.server 8899 --directory <repo>   (then)  node test/v83-meds-and-reports.mjs
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

// falsify.sh serves a throwaway clone of HEAD on its own port and points the suite at it,
// so a sweep never touches the working tree. Default stays the normal dev server.
const BASE = process.env.FALSIFY_BASE || 'http://127.0.0.1:8899/index.html';
let pass = 0, fail = 0;
const t = (name, cond, detail) => {
  console.log('  ' + (cond ? 'PASS  ' : 'FAIL  ') + name + (detail !== undefined ? '  |  ' + detail : ''));
  cond ? pass++ : fail++;
};
const section = s => console.log('\n' + s);
const HOUR = 3600000;
const browser = await chromium.launch();
const allErrors = [];

async function open(fixture, viewport) {
  const page = await browser.newPage({ viewport: viewport || { width: 390, height: 844 } });
  page.on('pageerror', e => allErrors.push(String(e.message)));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const x = m.text();
    if (/Failed to load resource|net::ERR_/.test(x)) return;
    allErrors.push(x);
  });
  await page.goto(BASE);
  await page.waitForTimeout(1300);
  // Every key is DERIVED from the prefs key the app actually created. Searching for them finds
  // nothing before anything is written, and a fixture written into a key nobody reads is a suite
  // that passes on an empty app -- which is how the v82 timeline fixture was silently dropped.
  const prefs = await page.evaluate(() => Object.keys(localStorage).find(k => /prefs-v1$/.test(k)));
  if (!prefs) throw new Error('no prefs key');
  const keys = { prefs, entries: prefs.replace(/prefs-v1$/, 'entries-v1'), med: prefs.replace(/prefs-v1$/, 'med-v1') };
  await page.evaluate(({ k, f }) => {
    const pr = JSON.parse(localStorage.getItem(k.prefs) || '{}');
    // A COMPLETE PROFILE, or Home shows "Finish setting up this profile" and renders NO
    // medication cards -- and every card assertion below then measures a setup prompt. Two
    // checks failed that way and both looked like app defects.
    localStorage.setItem(k.prefs, JSON.stringify(Object.assign(pr, { patientName: 'Test', onboarded: true, sex: 'female', treatmentType: 'chemo' }, f.prefs || {})));
    localStorage.setItem(k.entries, JSON.stringify(f.entries || []));
    if (f.meds) localStorage.setItem(k.med, JSON.stringify({ version: 2, meds: f.meds, archivedMeds: {} }));
  }, { k: keys, f: fixture });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);
  for (const n of ['Skip guide', 'Got it']) {
    const b = page.getByRole('button', { name: n, exact: true });
    if (await b.count()) { await b.first().click(); await page.waitForTimeout(400); }
  }
  return page;
}
const goto = async (page, tab) => { await page.getByRole('button', { name: new RegExp('^' + tab) }).first().click(); await page.waitForTimeout(800); };

const gapMed = (m) => Object.assign({ type: 'gap', gapH: 4, schemaV: 2, quickLog: true,
  doses: [{ label: '500 mg', mg: 500, pills: 1 }] }, m);

// ---------------------------------------------------------------------------------------------
section('1. THE MEDS CARD SAYS WHAT HAS HAPPENED, NOT ONLY WHAT THE RULES ARE');
{
  const now = Date.now();
  // THE FIXTURE CARRIES YESTERDAY, AND THAT IS THE POINT. Without an older dose, "count only
  // today's" and "count every dose ever" give the same answer, so the check below cannot tell them
  // apart -- and it did not: a mutant that deleted the day filter entirely passed 45/45. Two
  // separate checks in this suite have now survived a mutant for the same reason, which is that
  // a fixture without the case is a check about nothing.
  const p = await open({
    meds: [gapMed({ id: 'm1', name: 'TestMed', ceiling: true, ceilingMax: 3000 })],
    entries: [
      { id: 'old1', medId: 'm1', dose: '500 mg', mg: 500, pills: 1, ts: now - 30 * HOUR },
      { id: 'old2', medId: 'm1', dose: '500 mg', mg: 500, pills: 1, ts: now - 52 * HOUR },
      { id: 'a', medId: 'm1', dose: '500 mg', mg: 500, pills: 1, ts: now - 6 * HOUR },
      { id: 'b', medId: 'm1', dose: '500 mg', mg: 500, pills: 1, ts: now - 5 * HOUR }
    ]
  });
  await goto(p, 'Meds');
  t('the card carries a status pill', await p.locator('[data-med-status-pill]').count() === 1,
    JSON.stringify(await p.locator('[data-med-status-pill]').allTextContents()));
  const today = await p.locator('[data-med-today]').innerText();
  t('and says how many doses today', /2 doses today/.test(today), today);
  t('and when the last one was', /last at \d/.test(today), today);
  const bar = await p.locator('[data-med-ceiling]').innerText();
  t('and a ceiling bar reading used of max', /1,000 \/ 3,000 mg/.test(bar), bar.replace(/\n/g, ' | '));
  t('and the bar counts TODAY only -- yesterday\'s doses are not in it either',
    !/2,000 \/ 3,000|1,500 \/ 3,000/.test(bar), bar.replace(/\n/g, ' | '));
  // THE WINDOW WORD IS PART OF THE CLAIM, and nothing read it -- a mutant reverting a rolling bar
  // to "today" survived 56/56. A daily limit must say today and must NOT promise it frees up.
  t('a daily limit names its window as today', /left today/.test(bar), bar.replace(/\n/g, ' | '));
  t('and does not promise it frees up as doses age out, which is only true of a rolling one',
    !/frees up/.test(bar), bar.replace(/\n/g, ' | '));
  t('and is not marked as rolling',
    await p.locator('[data-med-ceiling-rolling="true"]').count() === 0,
    String(await p.locator('[data-med-ceiling-rolling="true"]').count()));
  t('and how much is left, not just how much is gone', /2,000 mg left/.test(bar), bar.replace(/\n/g, ' | '));
  await p.close();
}
{
  // NOTHING LOGGED is its own state. "0 doses today" reads like a defect; the words do not.
  const p = await open({ meds: [gapMed({ id: 'm1', name: 'TestMed' })], entries: [] });
  await goto(p, 'Meds');
  const today = await p.locator('[data-med-today]').innerText();
  t('a medication with nothing logged says so in words', /None logged today/.test(today), today);
  t('and a medication with no daily limit gets no bar rather than an empty one',
    await p.locator('[data-med-ceiling]').count() === 0,
    String(await p.locator('[data-med-ceiling]').count()));
  await p.close();
}

// ---------------------------------------------------------------------------------------------
section('2. MEDS AND HOME CANNOT DISAGREE ABOUT WHETHER A DOSE MAY BE GIVEN');
{
  // THIS SECTION USED TO BE A LIE, AND THE AUDIT SAID SO. It was titled "Meds and Home cannot
  // disagree" and it never opened Home -- it matched the Meds pill against regexes written beside
  // it in this file, which proves only that the pill says what I expected the pill to say. It
  // therefore could not see the two states where the screens DID disagree, and both shipped:
  // an off-day medication and a treatment-excluded one both read a green "Available" on Meds while
  // Home refused to give them.
  //
  // It opens Home now and compares the two screens, which is the only comparison that means
  // anything. The pill regexes stay as a second, weaker assertion about the wording.
  const now = Date.now();
  const cases = [
    ['a dose inside the minimum gap', [gapMed({ id: 'm1', name: 'TestMed' })],
      [{ id: 'a', medId: 'm1', dose: '500 mg', mg: 500, pills: 1, ts: now - 10 * 60000 }], /^Wait /],
    ['a paused medication', [gapMed({ id: 'm1', name: 'TestMed', paused: true })], [], /^Paused$/],
    ['a medication at its daily limit', [gapMed({ id: 'm1', name: 'TestMed', ceiling: true, ceilingMax: 1000 })],
      [{ id: 'a', medId: 'm1', dose: '500 mg', mg: 500, pills: 1, ts: now - 6 * HOUR },
       { id: 'b', medId: 'm1', dose: '500 mg', mg: 500, pills: 1, ts: now - 5 * HOUR }], /Daily limit reached/],
    ['an available medication', [gapMed({ id: 'm1', name: 'TestMed' })], [], /^Available$/]
  ];
  for (const [label, meds, entries, want] of cases) {
    const p = await open({ meds, entries });
    await goto(p, 'Meds');
    const pill = (await p.locator('[data-med-status-pill]').innerText().catch(() => '')).trim();
    t('the pill is right for ' + label, want.test(pill), pill || '(no pill)');
    await p.close();
  }
}
{
  // THE TWO STATES THE OLD SECTION COULD NOT SEE, each read off BOTH screens.
  // "Home will give it" is asked the way a caregiver asks it: is there a plain button that logs a
  // dose, or is there not. An override behind a red confirmation is NOT Home saying yes.
  const now = Date.now();
  const today = new Date().getDay();
  const otherDay = (today + 3) % 7;
  const pairs = [
    ['a medication not scheduled today',
      [gapMed({ id: 'm1', name: 'OffDayMed', scheduleDays: { mode: 'weekly', days: [otherDay] } })], []],
    ['a medication held around a treatment day',
      [gapMed({ id: 'm1', name: 'ExcludedMed', treatmentMode: 'excluded' })],
      [{ id: 'c', medId: 'chemo_date', ts: now, dose: '', mg: 0 }]]
  ];
  // THE THIRD GATE, which the first fix missed entirely: a medication whose treatment course has
  // finished has NO CARD ON HOME AT ALL, and the pill still read a green "Available". The two gates
  // added by hand in the first pass were not the whole list, which is exactly why the list now
  // lives in one predicate instead of being copied per call site.
  pairs.push(['a medication whose treatment course has finished',
    [gapMed({ id: 'm1', name: 'FinishedMed', treatmentOnly: true, treatmentMode: 'only' })],
    [{ id: 'c', medId: 'chemo_date', ts: now - 30 * 24 * HOUR, dose: 'Treatment scheduled', mg: 0, loggedAt: now - 30 * 24 * HOUR }]]);
  // THE LAST ACTIVE DAY OF A COURSE, which is a DIFFERENT gate and the sweep proved it. Removing
  // the `courseComplete` branch from the predicate changed nothing against the fixture above,
  // because a treatment 30 days past is already caught by `treatmentOnlyBlocks` -- the mutant was a
  // no-op, not a check that could not fail. `courseComplete` is reachable only in the narrow window
  // where the medication is active TODAY and not tomorrow: a treatment date today with a zero-day
  // window either side. Home drops the card on that day; the pill must agree.
  // It must be a SCHEDULED medication: `courseComplete` is set only inside status()'s window
  // branch, so an as-needed one never reaches it -- and my first attempt at this fixture used an
  // as-needed medication and reported a failure that was the fixture's, not the app's. A treatment
  // date must also carry `loggedAt`, which is what chemoDayList orders and de-duplicates by.
  const hr = new Date().getHours();
  pairs.push(['a medication on the last day of its course',
    [{ id: 'm1', name: 'LastDayMed', type: 'win', schemaV: 2, quickLog: true,
       doses: [{ label: '1 tab', mg: 0, pills: 1 }],
       // A window that has already CLOSED today. status() only reaches `courseComplete` after the
       // window loop finds nothing open -- with an open window it returns early and the branch is
       // unreachable, which is why the first two versions of this fixture proved nothing.
       windows: [{ name: 'Early', start: 0, end: 1 }],
       treatmentOnly: true, treatmentMode: 'only', treatmentDaysBefore: 0, treatmentDaysAfter: 0 }],
    [{ id: 'c', medId: 'chemo_date', ts: now, dose: 'Treatment scheduled', mg: 0, loggedAt: now }]]);
  for (const [label, meds, entries] of pairs) {
    const p = await open({ meds, entries });
    // HOME FIRST, and read what it actually offers.
    // "HOME WITHHOLDS IT" HAS TWO SHAPES AND BOTH COUNT. Some gates leave an inert card saying
    // why; the finished-course gate removes the card from Home ENTIRELY. A check that only looked
    // for explanatory text called the second one a pass for Home and a failure for the fixture --
    // when the absence of any way to log the dose is the strongest form of withholding there is.
    // ASK THE QUESTION A CAREGIVER ASKS: is there a Quick Log card for this medication that offers
    // a dose? Reading the med's NAME off Home is not that question -- a missed-dose row names it
    // too, and a row saying the dose was MISSED is the app withholding, not offering. That crude
    // version reported a failure on the app for a fixture where Home was behaving correctly.
    const medName = meds[0].name;
    const homeText = await p.evaluate(() => {
      const m = document.querySelector('main');
      return m ? (m.innerText || '') : '';
    });
    const card = await p.evaluate(() => document.querySelectorAll('[data-med-card]').length);
    const cardForIt = await p.evaluate((n) => {
      return [...document.querySelectorAll('[data-med-card]')].some(el => (el.innerText || '').indexOf(n) >= 0);
    }, medName);
    const explainedAsHeld = /not scheduled|excluded|held near|held around|outside (its|your) treatment/i.test(homeText);
    // A MEDICATION VANISHING FROM HOME IS A DOSE NOT GIVEN, AND THE PREVIOUS VERSION OF THIS LINE
    // COULD NOT SEE IT. Accepting "no card at all" as proof that Home withholds made the dangerous
    // direction invisible: a mutant deleting the off-day and treatment-excluded cards from Home's
    // filter passed 78/78. Two gates expect an INERT CARD THAT EXPLAINS ITSELF, and two expect the
    // card to be gone, and the difference is the whole point -- so each case now says which it
    // expects rather than accepting either.
    const expectsNoCard = /course/i.test(label);
    const homeSaysNo = expectsNoCard ? !cardForIt : (cardForIt && explainedAsHeld);
    await goto(p, 'Meds');
    const pill = (await p.locator('[data-med-status-pill]').innerText().catch(() => '')).trim();
    t('Home withholds ' + label + ' -- otherwise this comparison proves nothing',
      homeSaysNo,
      (expectsNoCard ? 'expected: no card; ' : 'expected: an inert card that explains itself; ')
      + (cardForIt ? 'has a Quick Log card; ' : 'no Quick Log card; ') + card + ' card(s); '
      + homeText.replace(/\n/g, ' | ').slice(0, 80));
    // AND SAID THE OTHER WAY ROUND, so the check fails whichever direction the filter breaks in.
    if (!expectsNoCard) {
      t('and ' + label + ' KEEPS its card rather than vanishing from Home',
        cardForIt, cardForIt ? 'card present' : 'THE CARD IS GONE -- a medication that disappears is a dose not given');
    }
    t('and Meds does NOT say Available for ' + label,
      !/^Available$/.test(pill), pill || '(no pill)');
    t('and the two screens agree in words', /not scheduled|held|outside|finished|paused/i.test(pill), pill || '(no pill)');
    await p.close();
  }
}
{
  // A BAR IS ONLY DRAWN WHEN THERE IS A REAL TOTAL BEHIND IT. app-v81 established that the app
  // refuses to invent a pill count it cannot read; a bar drawn from a figure the app admits it
  // cannot compute would look measured and would not be. That is the paracentesis average again.
  const p = await open({
    meds: [gapMed({ id: 'm1', name: 'TestMed', ceiling: true, ceilingMax: 0 })],
    entries: []
  });
  await goto(p, 'Meds');
  t('no bar when there is no maximum to draw against',
    await p.locator('[data-med-ceiling]').count() === 0,
    String(await p.locator('[data-med-ceiling]').count()));
  t('but the card is still there with its status and its today line',
    await p.locator('[data-med-status-pill]').count() === 1 && await p.locator('[data-med-today]').count() === 1);
  await p.close();
}

// ---------------------------------------------------------------------------------------------
section('2b. A ROLLING LIMIT IS NOT A DAILY ONE, AND THE BAR MUST NOT MIX THEM UP');
{
  const now = Date.now();
  const p = await open({
    meds: [gapMed({ id: 'm1', name: 'RollingMed', ceiling: true, ceilingMax: 15, rollingCeilingH: 4,
      doses: [{ label: '5 mg', mg: 5, pills: 1 }] })],
    entries: [
      { id: 'a', medId: 'm1', dose: '5 mg', mg: 5, pills: 1, ts: now - 9 * HOUR },
      { id: 'b', medId: 'm1', dose: '5 mg', mg: 5, pills: 1, ts: now - 7 * HOUR },
      { id: 'c', medId: 'm1', dose: '5 mg', mg: 5, pills: 1, ts: now - 1 * HOUR }
    ]
  });
  await goto(p, 'Meds');
  const bar = await p.locator('[data-med-ceiling]').innerText();
  t('a rolling limit says which window it is counting', /in the last 4h/.test(bar), bar.replace(/\n/g, ' | '));
  t('and never calls that window "today"', !/left today/.test(bar), bar.replace(/\n/g, ' | '));
  t('and says in words that it is not a daily limit', /not a daily one/.test(bar), bar.replace(/\n/g, ' | '));
  t('and is marked as rolling for anything reading the DOM',
    await p.locator('[data-med-ceiling-rolling="true"]').count() === 1);
  const aria = await p.locator('[data-med-ceiling] [role="img"]').getAttribute('aria-label');
  t('and a screen reader is told the same window, not "used today"',
    /in the last 4h/.test(aria || '') && !/used today/.test(aria || ''), String(aria));
  await p.close();
}
{
  // THE SHAPE THAT BROKE THE FIRST FIX. dailyCeiling() short-circuits on ceilingUnit BEFORE the
  // rolling branch, so this medication's figure is a DAILY pill count even though it carries
  // rollingCeilingH. Reading the flag instead of the branch labelled a daily count "in the last 4h"
  // and promised it would free up as doses aged out. It resets at midnight.
  const now = Date.now();
  const p = await open({
    meds: [gapMed({ id: 'm1', name: 'PillsRolling', ceiling: true, ceilingMax: 4, ceilingUnit: 'pills',
      rollingCeilingH: 4, doses: [{ label: '1 tab', mg: 0, pills: 1 }] })],
    entries: [{ id: 'a', medId: 'm1', dose: '1 tab', mg: 0, pills: 1, ts: now - 1 * HOUR }]
  });
  await goto(p, 'Meds');
  const bar = await p.locator('[data-med-ceiling]').innerText();
  t('a figure that is actually daily says today, whatever flags the medication carries',
    /left today/.test(bar) && !/in the last/.test(bar), bar.replace(/\n/g, ' | '));
  t('and does not promise it frees up as doses age out', !/frees up/.test(bar), bar.replace(/\n/g, ' | '));
  await p.close();
}
{
  // A SHARED CEILING IS NOT THIS MEDICATION'S ALONE, and the bar drew it as though it were.
  const now = Date.now();
  const p = await open({
    meds: [gapMed({ id: 'm1', name: 'GroupA', ceiling: true, ceilingMax: 3000, ceilingGroup: 'acet' }),
           gapMed({ id: 'm2', name: 'GroupB', ceiling: true, ceilingMax: 3000, ceilingGroup: 'acet' })],
    entries: [{ id: 'a', medId: 'm2', dose: '500 mg', mg: 500, pills: 1, ts: now - 2 * HOUR }]
  });
  await goto(p, 'Meds');
  const bars = await p.locator('[data-med-ceiling]').allTextContents();
  t('a shared limit says it is shared', bars.some(b => /shared with other medications/.test(b)),
    bars.join(' || ').replace(/\n/g, ' | ').slice(0, 140));
  await p.close();
}

// ---------------------------------------------------------------------------------------------
section('3. THE TEMPERATURE REPORT, WHICH DID NOT EXIST');
{
  const now = Date.now();
  const p = await open({ entries: [
    { id: 't1', medId: 'temp', temp: 101.4, dose: '101.4', mg: 0, ts: now - 3 * HOUR },
    { id: 't2', medId: 'temp', temp: 99.2, dose: '99.2', mg: 0, ts: now - 30 * HOUR },
    { id: 't3', medId: 'temp', temp: 98.4, dose: '98.4', mg: 0, ts: now - 80 * HOUR }
  ] });
  await goto(p, 'Reports');
  const tile = p.getByRole('button', { name: /Temperature/ }).first();
  t('Temperature is on the Reports menu', await tile.count() > 0);
  t('and its tile line says whether the last reading was a fever, not how many there are',
    /fever|high/i.test(await tile.innerText()), (await tile.innerText()).replace(/\n/g, ' | '));
  await tile.click();
  await p.waitForTimeout(900);
  t('the chart is drawn', await p.locator('[data-temp-chart]').count() === 1);
  const svg = await p.locator('[data-temp-chart] svg').innerHTML();
  // THE LINE IS DRAWN FROM THE APP'S OWN THRESHOLD, so it cannot disagree with the colour Home
  // paints a reading. The label is read back out of the chart rather than compared to a literal.
  // THIS CHECK SURVIVED A MUTANT AND HAD TO BE REWRITTEN. Its first version stripped the SVG tags
  // and matched /Fever\s*[\d.]+/ -- which happily matched the word "Fever" followed by whatever
  // axis label came next in the flattened text. A mutant that replaced the label with a bare
  // "Fever" and hardcoded the threshold passed 44/44. The check now reads the app's OWN threshold
  // off a debug hook and requires the drawn label to be exactly that, so a hardcoded number and a
  // computed one are distinguishable.
  const want = await p.evaluate(() => (window.__tempTest ? ('Fever ' + window.__tempTest.fever() + window.__tempTest.suffix()) : null));
  t('the app exposes its own fever threshold, so this check has something real to compare against',
    typeof want === 'string' && /\d/.test(want), String(want));
  const label = (svg.match(/>\s*(Fever[^<]*)</) || [])[1] || '';
  t('the fever line is on the chart', /Fever/.test(svg), label || 'not found');
  t('and its label is the threshold the app actually colours from, character for character',
    label.trim() === String(want).trim(), 'drawn=' + JSON.stringify(label.trim()) + ' expected=' + JSON.stringify(want));
  const stats = await p.locator('[data-temp-peak]').innerText() + ' / ' + await p.locator('[data-temp-latest]').innerText() + ' / ' + await p.locator('[data-temp-overcount]').innerText();
  t('the highest reading is reported', /101\.4/.test(stats), stats.replace(/\n/g, ' '));
  t('and how many were at or above the fever line', /\b1\b/.test(await p.locator('[data-temp-overcount]').innerText()),
    (await p.locator('[data-temp-overcount]').innerText()).replace(/\n/g, ' '));
  // THAT COUNT MUST BE OVER THE CHARTED SET, NOT ALL HISTORY, and this is what proves it: a
  // feverish reading from outside the window must not be counted. The check without this could not
  // fail -- a mutant counting every reading ever passed it.
  const withOld = await open({ entries: [
    { id: 't1', medId: 'temp', temp: 101.4, dose: '101.4', mg: 0, ts: Date.now() - 3 * HOUR },
    { id: 'old', medId: 'temp', temp: 103.6, dose: '103.6', mg: 0, ts: Date.now() - 60 * 24 * HOUR }
  ] });
  await goto(withOld, 'Reports');
  await withOld.getByRole('button', { name: /Temperature/ }).first().click();
  await withOld.waitForTimeout(900);
  const oc = await withOld.locator('[data-temp-overcount]').innerText();
  const pk = await withOld.locator('[data-temp-peak]').innerText();
  t('a feverish reading from outside the window is not counted in it',
    /\b1\b/.test(oc) && !/\b2\b/.test(oc), oc.replace(/\n/g, ' '));
  t('and it is not reported as the highest, either', !/103\.6/.test(pk), pk.replace(/\n/g, ' '));
  await withOld.close();
  // RULE 2.7 QUESTION 3. A mean body temperature over a month describes nothing anybody acts on,
  // and reads as reassurance across a week holding one 101.4.
  const screen = await p.locator('[data-temp-chart]').innerText() + ' ' + stats;
  t('and there is NO average temperature anywhere on the screen', !/averag/i.test(screen), screen.replace(/\n/g, ' ').slice(0, 90));
  const list = await p.locator('[data-temp-list]').innerText();
  t('every reading is listed', /101\.4/.test(list) && /99\.2/.test(list) && /98\.4/.test(list), list.replace(/\n/g, ' | ').slice(0, 120));
  t('and a feverish one is marked as such in words, not only by colour', /fever/i.test(list), list.replace(/\n/g, ' | ').slice(0, 120));
  await p.close();
}
{
  const p = await open({ entries: [] });
  await goto(p, 'Reports');
  const tile = p.getByRole('button', { name: /Temperature/ }).first();
  await tile.click();
  await p.waitForTimeout(800);
  t('with no readings the report says so rather than drawing an empty chart',
    await p.locator('[data-temp-empty]').count() === 1 && await p.locator('[data-temp-chart]').count() === 0,
    'empty=' + await p.locator('[data-temp-empty]').count() + ' chart=' + await p.locator('[data-temp-chart]').count());
  t('and the box to log one is still on the screen',
    await p.locator('[data-temp-report-add]').count() === 1);
  await p.close();
}
{
  // AN EMPTY WINDOW WITH READINGS OUTSIDE IT. This is the case the report used to get wrong and the
  // case the suite could not see: with nothing in range it charted the last two readings EVER and
  // left every label saying "Last 4 weeks", so a 102.4 from ten weeks ago read as this month's
  // fever. The previous fixture had readings both inside and outside the window, so the fallback
  // never ran and a mutant restoring it survived 56/56.
  const now = Date.now();
  const p = await open({ entries: [
    { id: 'o1', medId: 'temp', temp: 102.4, dose: '102.4', mg: 0, ts: now - 70 * 24 * HOUR },
    { id: 'o2', medId: 'temp', temp: 99.8, dose: '99.8', mg: 0, ts: now - 72 * 24 * HOUR },
    { id: 'o3', medId: 'temp', temp: 98.2, dose: '98.2', mg: 0, ts: now - 75 * 24 * HOUR }
  ] });
  await goto(p, 'Reports');
  await p.getByRole('button', { name: /Temperature/ }).first().click();
  await p.waitForTimeout(900);
  t('nothing in the last 4 weeks draws NO chart at all',
    await p.locator('[data-temp-chart]').count() === 0,
    String(await p.locator('[data-temp-chart]').count()));
  t('and says so in words instead',
    await p.locator('[data-temp-none-in-range]').count() === 1,
    String(await p.locator('[data-temp-none-in-range]').count()));
  const note = await p.locator('[data-temp-none-in-range]').innerText().catch(() => '');
  t('and names the range it is talking about', /4 weeks/.test(note), note.replace(/\n/g, ' | '));
  t('and points at the most recent reading rather than hiding it', /102\.4/.test(note), note.replace(/\n/g, ' | '));
  // THE HEADLINE OF THE ORIGINAL DEFECT: an old fever must not be reported as this month's.
  const body = await p.evaluate(() => document.querySelector('main') ? document.querySelector('main').innerText : '');
  t('no ten-week-old fever is presented under "Last 4 weeks"',
    !/Last 4 weeks/.test(body) || !/102\.4/.test(body.split('Last 4 weeks')[1] || ''),
    body.replace(/\n/g, ' | ').slice(0, 130));
  await p.close();
}

// ---------------------------------------------------------------------------------------------
section('4. THE SYMPTOM BARS');
{
  const now = Date.now();
  // THE FIXTURE CARRIES ENTRIES OUTSIDE THE WINDOW, and that is the point. Without them, "count the
  // last 4 weeks" and "count everything ever" give the same answer, and the count check cannot tell
  // them apart -- it did not: a mutant deleting the window entirely passed. Two entries from ~40
  // days ago are inside the Months range and outside the Weeks range, so the two ranges must
  // disagree, which is the only way this suite can see a window at all.
  const p = await open({ entries: [
    { id: 's1', medId: 'symptom_nausea', symptomType: 'nausea', dose: '', mg: 0, ts: now - 4 * HOUR },
    { id: 's2', medId: 'symptom_nausea', symptomType: 'nausea', dose: '', mg: 0, ts: now - 50 * HOUR },
    { id: 's3', medId: 'symptom_fatigue', symptomType: 'fatigue', dose: '', mg: 0, ts: now - 26 * HOUR },
    { id: 'old1', medId: 'symptom_nausea', symptomType: 'nausea', dose: '', mg: 0, ts: now - 40 * 24 * HOUR },
    { id: 'old2', medId: 'symptom_nausea', symptomType: 'nausea', dose: '', mg: 0, ts: now - 45 * 24 * HOUR }
  ] });
  await goto(p, 'Symptoms');
  const bars = await p.locator('[data-symptom-bar]').count();
  t('one bar per symptom', bars === 2, bars + ' bars');
  const txt = await p.locator('[data-symptom-summary]').innerText();
  t('the count is right', /Nausea[\s\S]*?\b2\b/.test(txt) && !/Nausea[\s\S]*?\b4\b/.test(txt),
    txt.replace(/\n/g, ' | '));
  // THE WINDOW IS REAL, OR THE COUNT ABOVE MEANS NOTHING. Weeks and Months must disagree, because
  // the fixture put two entries between the two ranges.
  await p.locator('[data-symptom-range="months"]').click();
  await p.waitForTimeout(500);
  const months = await p.locator('[data-symptom-summary]').innerText();
  t('switching to Months changes the count, so the window is actually applied',
    /Nausea[\s\S]*?\b4\b/.test(months), months.replace(/\n/g, ' | '));
  await p.locator('[data-symptom-range="weeks"]').click();
  await p.waitForTimeout(500);
  // THE LIST AND THE BARS COUNT THE SAME DAYS. A bar saying 2 that opens a list of 7 was a real
  // defect; both figures were right about their own window and the pair of them was a lie.
  await p.locator('[data-symptom-bar="nausea"]').click();
  await p.waitForTimeout(500);
  const rows = await p.locator('[data-symptom-list] [data-symptom-row], [data-symptom-list] > div').count();
  const listTxt = await p.locator('[data-symptom-list]').innerText();
  const listNausea = (listTxt.match(/Nausea/g) || []).length;
  t('tapping a bar shows exactly as many entries as the bar counted',
    listNausea === 2, listNausea + ' rows for a bar reading 2');
  await p.locator('[data-symptom-clear]').click();
  await p.waitForTimeout(400);
  t('and when it was last noted', /today|yesterday|days ago/.test(txt), txt.replace(/\n/g, ' | '));
  // LONGEST FIRST. A chart whose order is arbitrary makes the reader do the comparison the chart
  // exists to do for them.
  const order = await p.locator('[data-symptom-bar]').evaluateAll(els => els.map(e => e.getAttribute('data-symptom-bar')));
  t('the most frequent symptom is first', order[0] === 'nausea', JSON.stringify(order));
  // RULE 2.7 QUESTION 3 AGAIN. Counting discrete events is honest; averaging a three-word severity
  // scale would not be.
  t('and there is no average severity anywhere', !/averag/i.test(txt), txt.replace(/\n/g, ' | ').slice(0, 90));

  await p.locator('[data-symptom-bar="nausea"]').click();
  await p.waitForTimeout(500);
  const shown = await p.locator('[data-symptom-list]').innerText();
  t('tapping a bar filters the list to that symptom', /Nausea/.test(shown) && !/Fatigue/.test(shown),
    shown.replace(/\n/g, ' | ').slice(0, 110));
  // THE BARS MUST NOT REDRAW AROUND THE SELECTION, or the selected bar is always the longest one
  // on screen and the chart stops being something you can compare against.
  t('and the bars themselves do not redraw around the selection',
    await p.locator('[data-symptom-bar]').count() === 2,
    String(await p.locator('[data-symptom-bar]').count()));
  await p.locator('[data-symptom-clear]').click();
  await p.waitForTimeout(500);
  t('"Show all" clears the filter', /Fatigue/.test(await p.locator('[data-symptom-list]').innerText()));
  // Back is a layer for it, or app-v82's back-button work has a hole the day this ships.
  await p.locator('[data-symptom-bar="nausea"]').click();
  await p.waitForTimeout(400);
  t('the back-button registry knows about the filter',
    await p.evaluate(() => !!(window.__backTest && window.__backTest.keys().indexOf('symptomFilter') >= 0)));
  await p.evaluate(() => window.__backTest.press());
  await p.waitForTimeout(500);
  t('and one Back press clears it', /Fatigue/.test(await p.locator('[data-symptom-list]').innerText()));
  await p.close();
}
{
  const p = await open({ entries: [] });
  await goto(p, 'Symptoms');
  t('with nothing logged there are no bars and no empty chart',
    await p.locator('[data-symptom-summary]').count() === 0,
    String(await p.locator('[data-symptom-summary]').count()));
  await p.close();
}

// ---------------------------------------------------------------------------------------------
section('5. ALL THREE SCREENS FIT A 320px PHONE, AND NONE CARRIES A LITERAL "null"');
{
  const now = Date.now();
  const p = await open({
    meds: [gapMed({ id: 'm1', name: 'TestMed', ceiling: true, ceilingMax: 3000 })],
    entries: [
      { id: 'a', medId: 'm1', dose: '500 mg', mg: 500, pills: 1, ts: now - 6 * HOUR },
      { id: 't1', medId: 'temp', temp: 101.4, dose: '101.4', mg: 0, ts: now - 3 * HOUR },
      { id: 's1', medId: 'symptom_nausea', symptomType: 'nausea', dose: '', mg: 0, ts: now - 4 * HOUR }
    ]
  }, { width: 320, height: 800 });
  for (const tab of ['Meds', 'Symptoms', 'Reports']) {
    await goto(p, tab);
    const w = await p.evaluate(() => document.documentElement.scrollWidth);
    t(tab + ' does not scroll sideways at 320px', w <= 320, w + 'px');
    const nulls = await p.evaluate(() => [...document.querySelectorAll('*')]
      .filter(e => [...e.attributes].some(a => a.value === 'null')).length);
    t('and nothing on ' + tab + ' carries the literal attribute value "null"', nulls === 0, nulls + ' found');
  }
  const tile = p.getByRole('button', { name: /Temperature/ }).first();
  if (await tile.count()) {
    await tile.click(); await p.waitForTimeout(800);
    const w = await p.evaluate(() => document.documentElement.scrollWidth);
    t('the temperature report does not scroll sideways at 320px', w <= 320, w + 'px');
  }
  await p.close();
}

// ---------------------------------------------------------------------------------------------
section('6. AND NOTHING THREW');
t('no page error at any point above', allErrors.length === 0, allErrors.slice(0, 3).join(' / ') || 'none');

await browser.close();
console.log('\n' + (pass + fail) + ' checks: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
