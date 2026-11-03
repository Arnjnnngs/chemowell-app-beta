// v92-pill-clearance.mjs — CAN THE LAST LINE ON A REPORT SCREEN ACTUALLY BE READ?
//
// Task #36. On a Reports sub-screen, scrolled to the end, the bottom of the last line of text runs
// underneath the floating "↩ Back" pill. Measured before the fix, glyph boxes by Range intersected
// with the pill's own rect, at max scroll:
//
//        320px   History 35x7px ("1 tablet")   Temperature 50x7px ("Wed, Oct 7 · 11:30 AM")
//        360px   History 15x7px                Temperature 30x7px
//        390px   History none                  Temperature 15x7px
//
// WHY THIS IS A SUITE OF ITS OWN AND NOT A ROW IN AN EXISTING ONE.
//
//   - `overflow-scan.mjs` asks whether a box is too small for its text. These boxes are the right
//     size; something is parked on top of them. It is a different question and it scrolls to 0.
//   - `contrast-scan.mjs` DELIBERATELY SKIPS anything a fixed overlay covers — its own header says
//     so, and that is correct there: the contrast of a word against a button sitting on top of it
//     is not a number about anything. So the gate that photographs this exact pixel is structurally
//     incapable of reporting it.
//   - Every gate in this repo asks about a STILL FRAME (care-tracker's Rule 5.5). This one scrolls
//     first and measures after, because the defect only exists at the end of the scroll.
//
// WHAT IT ASSERTS: the INVARIANT, not one row. At max scroll, on every report sub-screen the
// Reports menu offers, at three widths, NO glyph box may intersect the pill's rect. There is no
// "last row" hook on these lists and there should not be — which element is last depends on the
// screen and on the data, so a hook would pin this instance while geometry pins the class.
//
// THE COMPLETENESS RATCHET: the sub-screens are discovered from the Reports menu's own
// `data-report-tile` attributes, never from a list written here. A tenth report added to the app is
// walked by this suite on the day it lands, with nothing to remember.
//
// DELIBERATELY EXEMPT, said out loud rather than quietly skipped:
//   - The toast. It is `pointer-events: none`, lives ~4.5s, and already has its own lift
//     (`toastNeedsLift`/`backPillShowing`). A transient overlay over a row is a different defect
//     class from a permanent one and is not measured here.
//   - The bottom nav. Content clears it today; that is what the 90px baseline is for.
//   - Safari. This is Chromium at Apple's viewport sizes. A clean run narrows the search.
//
// Run: env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy node test/v92-pill-clearance.mjs
//      [--base <url>] [--file <path>] [--width <px>]
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = (() => {
  const _p = require('path');
  for (const t of ['playwright', _p.join(_p.dirname(process.execPath), '..', 'lib', 'node_modules', 'playwright'),
                   '/opt/node22/lib/node_modules/playwright']) { try { return require(t); } catch (e) {} }
  throw new Error('playwright not found');
})();
for (const v of ['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy'])
  if (process.env[v]) { console.error('REFUSING: ' + v + ' is set — the suite cannot reach its own local server through a proxy.'); process.exit(3); }

const argv = process.argv.slice(2);
const arg = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const BASE_IN = process.env.FALSIFY_BASE || arg('--base');
const APP_FILE = arg('--file') || new URL('../index.html', import.meta.url).pathname;
const WIDTHS = arg('--width') ? [Number(arg('--width'))] : [320, 360, 390];

// THE CLOCK IS FROZEN, for the same reason it is frozen in `contrast-scan.mjs` and
// `v90-chart-axes.mjs`: the fixture places readings relative to "now", and a run an hour later
// crosses a time-of-day boundary, draws one more heading, and moves the page's height. A suite
// whose geometry depends on the wall clock is red for an hour a day on correct code.
const FROZEN = (() => { const d = new Date(); d.setHours(14, 0, 0, 0); return d.getTime(); })();
const freeze = '(() => { const R = Date;'
  + ' const D = function (...a) { return a.length ? new R(...a) : new R(' + FROZEN + '); };'
  + ' D.now = () => ' + FROZEN + '; D.parse = R.parse; D.UTC = R.UTC; D.prototype = R.prototype;'
  + ' window.Date = D; })()';

// 40 days of readings: enough to make a report list taller than any phone, so the end of the
// scroll is a real end rather than a short screen that cannot clip anything.
const seed = () => `(() => {
  const now = Date.now(), DAY = 86400000;
  const e = [];
  // ONE READING OF EVERY KIND, ON EVERY ONE OF THE 40 DAYS. The first fixture seeded only doses,
  // weight and temperature, so four of eighteen screen x width combinations were ALREADY vacuous
  // on a green run -- blood_pressure at all three widths had never had its end-of-scroll tested
  // at all, because the screen was too short to clip anything. The suite printed "(short
  // (vacuously clear))" honestly, and still passed. Now every report the menu offers has rows,
  // and the guard below fails any screen that still does not scroll.
  for (let d = 0; d < 40; d++) {
    e.push({ id: 'm' + d, medId: 'med-1', name: 'Blood pressure', kind: 'med', ts: now - d * DAY - 3600000, dose: '1 tablet' });
    e.push({ id: 'w' + d, medId: 'weight', ts: now - d * DAY - 7200000, weight: 150 + (d % 9), unit: 'lb', dose: (150 + (d % 9)) + ' lb' });
    e.push({ id: 't' + d, medId: 'temp', ts: now - d * DAY - 9000000, temp: 98.6, unit: 'Fahrenheit', dose: '98.6 \\u00b0F' });
    e.push({ id: 'bp' + d, medId: 'blood_pressure', ts: now - d * DAY - 10800000, sys: 118 + (d % 7), dia: 72 + (d % 5), dose: (118 + (d % 7)) + '/' + (72 + (d % 5)) + ' mmHg' });
    e.push({ id: 'bm' + d, medId: 'bowel_movement', ts: now - d * DAY - 12600000, value: 'normal', dose: 'Normal' });
    e.push({ id: 'ap' + d, medId: 'appetite', ts: now - d * DAY - 14400000, value: 'some', dose: 'Ate some' });
    e.push({ id: 'pa' + d, medId: 'paracentesis', ts: now - d * DAY - 16200000, liters: 2.5, dose: '2.5 L' });
    e.push({ id: 'rs' + d, medId: 'radiation_session', ts: now - d * DAY - 18000000, dose: null });
  }
  // EIGHT CYCLES, not one. With a single period the cycle report is shorter than the viewport and
  // the guard below correctly called it vacuous -- which is the guard working, and the fixture's
  // job is to give it something to measure.
  for (let c = 1; c <= 8; c++) {
    e.push({ id: 'cs' + c, medId: 'cycle_start', ts: now - (c * 28) * DAY, dose: null });
    e.push({ id: 'ce' + c, medId: 'cycle_end', ts: now - (c * 28 - 4) * DAY, dose: null });
  }
  localStorage.setItem('chemowell-app-profiles-v1', JSON.stringify({ list: [{ id: 'p1', name: 'Alex', createdAt: 1 }], activeId: 'p1' }));
  localStorage.setItem('chemowell-app-license-v1', JSON.stringify({ tier: 'free' }));
  // EVERY REPORT THE APP CAN OFFER, not the six a default profile shows. Three of the nine are
  // profile-gated -- \`cycle\` (non-male and cycleTracking on), \`radiation\` (a radiation or both
  // treatment type) and \`paracentesis\` (paracentesisTracking on, or resolved entries) -- so a
  // default fixture discovers six tiles and the suite's own record then says "every report
  // sub-screen" about two thirds of them. Turning all three on is one line and makes the sentence
  // true. If a tenth report appears it is discovered too, because the walk reads the menu.
  localStorage.setItem('chemowell-app-p-p1-prefs-v1', JSON.stringify({ patientName: 'Alex', onboarded: true, treatmentType: 'both', sex: 'female', tourDone: true, installedAt: now - 90 * DAY, homeCards: { cycleTracking: true, paracentesisTracking: true } }));
  localStorage.setItem('chemowell-app-p-p1-med-v1', JSON.stringify({ version: 2, archivedMeds: {}, meds: [
    { id: 'med-1', name: 'Blood pressure', schedule: 'daily', times: ['08:00'], doses: [{ label: '1 tablet', single: true }] }
  ] }));
  localStorage.setItem('chemowell-app-p-p1-entries-v1', JSON.stringify(e));
  // NO VERSION LITERAL. Pinning the seen-version to suppress What's New breaks on the next release
  // (Rule 5, and it has already cost this repo a blocker). The modal is dismissed after load.
})()`;

// Measured inside the page. The pill is found by its own fixed wrapper's z-index, not by its label:
// '↩ Back' is text, and Rule 5 forbids selecting by text.
const measure = () => {
  let pillEl = null;
  for (const b of document.querySelectorAll('button')) {
    for (let a = b; a && a !== document.body; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.position === 'fixed' && cs.zIndex === '36') { pillEl = b; break; }
    }
    if (pillEl) break;
  }
  const pr = pillEl ? pillEl.getBoundingClientRect() : null;
  const covered = [];
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n, glyphBoxes = 0;
  while ((n = walk.nextNode())) {
    const t = (n.nodeValue || '').trim();
    if (!t) continue;
    const el = n.parentElement;
    if (!el) continue;
    // Skip the overlays themselves — the pill's own label is not content it is covering.
    let skip = false;
    for (let a = el; a && a !== document.body; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.position === 'fixed' || cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') { skip = true; break; }
    }
    if (skip) continue;
    const range = document.createRange(); range.selectNodeContents(n);
    for (const r of range.getClientRects()) {
      if (r.width < 1 || r.height < 1) continue;
      glyphBoxes++;
      if (!pr) continue;
      const ox = Math.min(r.right, pr.right) - Math.max(r.left, pr.left);
      const oy = Math.min(r.bottom, pr.bottom) - Math.max(r.top, pr.top);
      // 0.5px, not 0: sub-pixel layout rounding produces sub-pixel "overlap" that is not real.
      if (ox > 0.5 && oy > 0.5) covered.push({ text: t.slice(0, 40), tag: el.tagName, w: Math.round(ox), h: Math.round(oy) });
    }
  }
  return {
    pill: pr ? { top: Math.round(pr.top), h: Math.round(pr.height), w: Math.round(pr.width) } : null,
    covered, glyphBoxes,
    scrollTop: Math.round(window.scrollY),
    atEnd: Math.abs(window.scrollY + window.innerHeight - document.documentElement.scrollHeight) < 2
  };
};

// --- serve, unless a --base was given (release_check.sh passes one)
let server = null, BASE = BASE_IN;
if (!BASE) {
  const root = path.dirname(APP_FILE);
  server = http.createServer((req, res) => {
    const f = path.join(root, decodeURIComponent(req.url.split('?')[0]) === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
    fs.readFile(f, (e, data) => {
      if (e) { res.writeHead(404); res.end('no'); return; }
      const ext = path.extname(f);
      res.writeHead(200, { 'Content-Type': ext === '.html' ? 'text/html' : ext === '.js' ? 'text/javascript' : 'application/octet-stream' });
      res.end(data);
    });
  }).listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  BASE = 'http://127.0.0.1:' + server.address().port + '/index.html';
}

console.log('v92-pill-clearance  ' + BASE + '  widths ' + WIDTHS.join(', '));
const fails = [];
let checks = 0, scrolledScreens = 0, tileCount = null;
const b = await chromium.launch();
for (const W of WIDTHS) {
  const ctx = await b.newContext({ viewport: { width: W, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const thrown = [];
  ctx.on('page', (p) => p.on('pageerror', (e) => thrown.push(String(e))));
  await ctx.addInitScript(freeze);
  const page = await ctx.newPage();
  await page.addInitScript(seed());
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(2200);
  const close = await page.$('[data-whatsnew-close="true"]');
  if (close) { await close.click(); await page.waitForTimeout(500); }
  if (await page.$('[data-whatsnew-modal="true"]')) {
        // A REFUSAL PRINTS A `FAIL` LINE TOO. `falsify.sh` scores a run with neither a FAIL line nor a
    // `checks:` summary as COULD NOT MEASURE -- which is right in general and wrong here: a refusal
    // IS the suite catching something. Measured: the mutant that removes `data-report-tile` made
    // this suite exit 3 correctly and the sweep scored it "could not measure" rather than caught.
    console.log('  FAIL  the What’s New modal is still open');
    console.error('REFUSING: the What’s New modal is still open, so every measurement would be\n'
      + 'taken against its scrim rather than against the app.');
    await b.close(); if (server) server.close(); process.exit(3);
  }
  // Discover the sub-screens from the app, never from a list in this file.
  await page.click('[data-tour="nav-reports"]');
  await page.waitForTimeout(900);
  const tiles = await page.$$eval('[data-report-tile]', (els) => els.map((e) => e.getAttribute('data-report-tile')));
  if (!tiles.length) {
    console.log('  FAIL  the Reports menu rendered no [data-report-tile] elements');
    console.error('REFUSING: the Reports menu rendered no [data-report-tile] elements, so this suite\n'
      + 'has nothing to walk. Either the hook was removed or the menu did not render — and a suite\n'
      + 'that walks zero screens must FAIL, not report clean.');
    await b.close(); if (server) server.close(); process.exit(3);
  }
  if (tileCount === null) tileCount = tiles.length;
  else if (tileCount !== tiles.length) {
    fails.push(W + 'px: the Reports menu offered ' + tiles.length + ' reports, but ' + tileCount
      + ' at an earlier width. The set must not depend on the viewport.');
  }
  for (const key of tiles) {
    await page.evaluate((r) => window.__v86Test.openReport(r), key);
    await page.waitForTimeout(900);
    const where = await page.evaluate(() => window.__v86Test.where());
    if (where.view !== 'reports' || where.reportsView !== key) {
      fails.push(W + 'px ' + key + ': openReport did not land on that screen (' + JSON.stringify(where) + ').');
      continue;
    }
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(400);
    const g = await page.evaluate(measure);
    checks++;
    if (!g.pill) {
      fails.push(W + 'px ' + key + ': the Back pill was not on screen at all. Either it stopped '
        + 'rendering on a report screen, or its fixed wrapper no longer carries z-index 36 and this '
        + 'suite is measuring nothing.');
      continue;
    }
    if (!g.atEnd) {
      fails.push(W + 'px ' + key + ': the page did not reach the end of its scroll, so this is not '
        + 'the position the defect lives at.');
      continue;
    }
    // A SCREEN THAT DID NOT SCROLL IS NOT A SCREEN THAT PASSED. The brief promised this and the
    // first version did not do it: it refused only when NOT ONE screen scrolled, and with the
    // fixture emptied an audit got a PASS with 13 of 18 combinations vacuous, because the
    // appetite screen scrolls on app chrome alone. A per-screen failure is the promise kept.
    if (g.scrollTop > 0) { scrolledScreens++; }
    else {
      fails.push(W + 'px ' + key + ': the screen did not scroll, so its end-of-scroll was never '
        + 'tested. Either the fixture stopped seeding this report, or the report stopped '
        + 'rendering its rows. A vacuous check is not a passing one.');
      console.log('  FAIL  ' + W + 'px ' + key.padEnd(16) + 'did not scroll \u2014 vacuous, not clear');
      continue;
    }
    const tag = 'scrolled';
    if (g.covered.length) {
      const worst = g.covered.slice().sort((a, c) => (c.w * c.h) - (a.w * a.h))[0];
      fails.push(W + 'px ' + key + ': ' + g.covered.length + ' glyph box(es) under the Back pill, worst '
        + worst.w + 'x' + worst.h + 'px on <' + worst.tag.toLowerCase() + '> "' + worst.text + '".');
      console.log('  FAIL  ' + W + 'px ' + key.padEnd(16) + g.covered.length + ' covered, worst '
        + worst.w + 'x' + worst.h + 'px  (' + tag + ')');
    } else {
      console.log('  ok    ' + W + 'px ' + key.padEnd(16) + g.glyphBoxes + ' glyph boxes, none under the pill  (' + tag + ')');
    }
  }
  if (thrown.length) fails.push(W + 'px: the page threw — ' + thrown.join(' | '));
  await ctx.close();
}
await b.close();
if (server) server.close();

// A run where nothing scrolled is a run that could not have caught this defect, whatever it printed.
if (scrolledScreens === 0) {
  console.log('  FAIL  not one report screen scrolled');
  console.error('\nREFUSING: not one report screen scrolled. The fixture is not producing enough rows,\n'
    + 'so every "none under the pill" above is vacuous. This is the empty-Home trap overflow-scan.mjs\n'
    + 'paid for twice; a suite that cannot see the defect must fail rather than report clean.');
  process.exit(3);
}
console.log('\n' + checks + ' screen×width combinations at end-of-scroll, ' + scrolledScreens
  + ' of them genuinely scrolling, ' + tileCount + ' report screens discovered from the menu.');
// A `checks:` LINE IN THE SHARED SHAPE, because `falsify.sh` reads one to decide whether the
// suite RAN at all. Without it the sweep refuses its own baseline and no mutant is ever
// measured -- which is exactly what happened the first time this suite was swept. The unit is
// a screen x width combination: it passes if the screen scrolled and nothing sat under the pill.
console.log(checks + ' checks: ' + (checks - fails.length) + ' passed, ' + fails.length + ' failed');
if (fails.length) {
  console.error('\n' + fails.length + ' FAILURE(S):');
  for (const f of fails) console.error('  - ' + f);
  process.exit(1);
}
console.log('PASS — nothing is hidden behind the Back pill at the end of any report screen.');
