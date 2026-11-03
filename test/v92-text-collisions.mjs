// v92-text-collisions.mjs — DO TWO PIECES OF TEXT LAND ON TOP OF EACH OTHER?
//
// Task #28, and the reason this suite exists rather than a row in `overflow-scan.mjs`.
//
// `overflow-scan.mjs` reported the defect as: *"10:00 AM" — the wording is wider than the box it
// sits in by 5px.* True, and a drastic understatement. What is actually on the screen at 320px is
// **"Hydroxychloroquine" printed straight across "8:00 AM" and "200 mg"**, so the time and the dose
// of a logged medication cannot be read at all. The scan compares each element's text against ITS
// OWN box, one element at a time, so a sibling that escapes its box and lands on another element is
// a 5px number with no hint that two strings are now illegible.
//
// That is the same shape as the contrast gate's blind spot one week earlier: an instrument that
// measures one element at a time cannot see a relationship between two. So this one asks the
// relationship question and nothing else.
//
// THE INVARIANT: no two text runs IN NORMAL FLOW may overlap. Not "mostly", not "by less than a
// few pixels" — in-flow text landing on in-flow text is never correct.
//
// OUT OF FLOW IS DELIBERATELY OUT OF SCOPE, and saying so is the whole reason this check is usable.
// The page is MEANT to scroll under the fixed header and the bottom nav. A first version counted
// those and reported 4 to 11 collisions per screen on a build with exactly one real defect —
// "ChemoWell" over "Radiation", "Morning" over "Home" — which is the layout working. Whether
// something painted on top of text hides it is `contrast-scan.mjs`'s question and it has its own
// answer; this suite skips any run with a `fixed`, `sticky` or `absolute` ancestor.
//
// MEASURED, so the numbers are on the record rather than in a commit message:
//   before  320px Home  2 collisions  "8:00 AM" x "Hydroxychloroquine"  31x16px   (every other
//                                      screen x width: 0)
//   after   all 15 screen/width combinations: 0
//
// Run: env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy node test/v92-text-collisions.mjs
//      [--base <url>] [--file <path>]
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
const SCREENS = ['home', 'meds', 'reports', 'symptoms', 'inpatient'];

// The clock and the zone are both pinned, for the reason written out at length in
// `contrast-scan.mjs`: a fixture dated from the wall clock changes what the app renders, and
// pinning only the browser leaves the host's TZ deciding the fixture's own clock.
const FROZEN = (() => { const n = new Date(); return Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate(), 14, 0, 0, 0); })();
const freeze = '(() => { const R = Date;'
  + ' const D = function (...a) { return a.length ? new R(...a) : new R(' + FROZEN + '); };'
  + ' D.now = () => ' + FROZEN + '; D.parse = R.parse; D.UTC = R.UTC; D.prototype = R.prototype;'
  + ' window.Date = D; })()';

// THE FIXTURE NEEDS A LONG MEDICATION NAME OR IT CANNOT SEE THIS DEFECT. "Blood pressure" fits at
// every width; the collision needs a name whose longest WORD is wider than the column it is given.
// `Hydroxychloroquine` is a real drug and an 18-character single token, which is the shape a user
// will type. A fixture of short names would make this suite green on the broken build — the
// empty-Home trap `overflow-scan.mjs` paid for twice, in its third costume.
const seed = () => `(() => {
  const now = Date.now(), DAY = 86400000;
  const b1 = new Date(now); b1.setHours(10, 0, 0, 0);
  const e = [
    { id: 'a1', medId: 'med-1', kind: 'med', ts: b1.getTime(), dose: '1 tablet' },
    { id: 'a2', medId: 'med-2', kind: 'med', ts: b1.getTime() - 3600000, dose: '10 mL' },
    { id: 'a3', medId: 'med-3', kind: 'med', ts: b1.getTime() - 7200000, dose: '200 mg' }
  ];
  for (let d = 1; d < 8; d++) e.push({ id: 'h' + d, medId: 'med-3', kind: 'med', ts: b1.getTime() - d * DAY, dose: '200 mg' });
  localStorage.setItem('chemowell-app-profiles-v1', JSON.stringify({ list: [{ id: 'p1', name: 'Alex', createdAt: 1 }], activeId: 'p1' }));
  localStorage.setItem('chemowell-app-license-v1', JSON.stringify({ tier: 'free' }));
  localStorage.setItem('chemowell-app-p-p1-prefs-v1', JSON.stringify({ patientName: 'Alex', onboarded: true, treatmentType: 'chemo', tourDone: true, browserNoticeSeen: true, installedAt: now - 90 * DAY }));
  localStorage.setItem('chemowell-app-p-p1-med-v1', JSON.stringify({ version: 2, archivedMeds: {}, meds: [
    { id: 'med-1', name: 'Blood pressure', schedule: 'daily', times: ['08:00'], doses: [{ label: '1 tablet', single: true }] },
    { id: 'med-2', name: "Children's Liquid Tylenol", schedule: 'daily', times: ['09:00'], doses: [{ label: '10 mL', single: true }] },
    { id: 'med-3', name: 'Hydroxychloroquine', schedule: 'daily', times: ['07:00'], doses: [{ label: '200 mg', single: true }] }
  ] }));
  localStorage.setItem('chemowell-app-p-p1-entries-v1', JSON.stringify(e));
})()`;

const collide = () => {
  const runs = [];
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walk.nextNode())) {
    const t = (n.nodeValue || '').trim(); if (!t) continue;
    const el = n.parentElement; if (!el) continue;
    let skip = false;
    for (let a = el; a && a !== document.body; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') { skip = true; break; }
      if (cs.position === 'fixed' || cs.position === 'sticky' || cs.position === 'absolute') { skip = true; break; }
    }
    if (skip) continue;
    const r = document.createRange(); r.selectNodeContents(n);
    for (const b of r.getClientRects()) {
      if (b.width < 1 || b.height < 1) continue;
      if (b.bottom < 0 || b.top > window.innerHeight) continue;
      runs.push({ el, t: t.slice(0, 32), x: b.left, y: b.top, r: b.right, b: b.bottom });
    }
  }
  const hits = [];
  for (let i = 0; i < runs.length; i++) for (let j = i + 1; j < runs.length; j++) {
    const A = runs[i], B = runs[j];
    if (A.el === B.el) continue;
    // A parent's own text box can legitimately contain a child's, so nesting is not a collision.
    if (A.el.contains(B.el) || B.el.contains(A.el)) continue;
    const ox = Math.min(A.r, B.r) - Math.max(A.x, B.x);
    const oy = Math.min(A.b, B.b) - Math.max(A.y, B.y);
    // 1px, not 0: adjacent inline runs share a sub-pixel edge after layout rounding.
    if (ox > 1 && oy > 1) hits.push({ a: A.t, b: B.t, w: Math.round(ox), h: Math.round(oy) });
  }
  return { runs: runs.length, hits };
};

let server = null, BASE = BASE_IN;
if (!BASE) {
  const root = path.dirname(APP_FILE);
  server = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]);
    const f = path.join(root, u === '/' ? 'index.html' : u);
    fs.readFile(f, (e, d) => {
      if (e) { res.writeHead(404); res.end('no'); return; }
      const x = path.extname(f);
      res.writeHead(200, { 'Content-Type': x === '.html' ? 'text/html' : x === '.js' ? 'text/javascript' : 'application/octet-stream' });
      res.end(d);
    });
  }).listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  BASE = 'http://127.0.0.1:' + server.address().port + '/index.html';
}

console.log('v92-text-collisions  ' + BASE + '  widths ' + WIDTHS.join(', '));
const fails = [];
let combos = 0, runsTotal = 0;
const b = await chromium.launch();
for (const W of WIDTHS) {
  const ctx = await b.newContext({ viewport: { width: W, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, timezoneId: 'UTC' });
  const thrown = [];
  ctx.on('page', (p) => p.on('pageerror', (e) => thrown.push(String(e))));
  await ctx.addInitScript(freeze);
  const page = await ctx.newPage();
  await page.addInitScript(seed());
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(2300);
  const close = await page.$('[data-whatsnew-close="true"]');
  if (close) { await close.click(); await page.waitForTimeout(400); }
  if (await page.$('[data-whatsnew-modal="true"]')) {
        // A REFUSAL PRINTS A `FAIL` LINE TOO. `falsify.sh` scores a run with neither a FAIL line nor a
    // `checks:` summary as COULD NOT MEASURE -- which is right in general and wrong here: a refusal
    // IS the suite catching something. Measured: the mutant that removes `data-report-tile` made
    // this suite exit 3 correctly and the sweep scored it "could not measure" rather than caught.
    console.log('  FAIL  the What’s New modal is still open');
    console.error('REFUSING: the What’s New modal is still open, so this would measure its scrim.');
    await b.close(); if (server) server.close(); process.exit(3);
  }
  for (const nav of SCREENS) {
    await page.click('[data-tour="nav-' + nav + '"]');
    await page.waitForTimeout(800);
    const H = await page.evaluate(() => document.documentElement.scrollHeight);
    let runs = 0; const all = [];
    for (let y = 0; y < H; y += 700) {
      await page.evaluate((v) => window.scrollTo(0, v), y);
      await page.waitForTimeout(250);
      const g = await page.evaluate(collide);
      runs += g.runs; all.push(...g.hits);
    }
    combos++; runsTotal += runs;
    const uniq = [...new Map(all.map((h) => [h.a + '␟' + h.b, h])).values()];
    if (uniq.length) {
      const worst = uniq.slice().sort((p, q) => (q.w * q.h) - (p.w * p.h))[0];
      fails.push(W + 'px ' + nav + ': ' + uniq.length + ' in-flow text collision(s), worst "'
        + worst.a + '" over "' + worst.b + '" by ' + worst.w + 'x' + worst.h + 'px.');
      console.log('  FAIL  ' + W + 'px ' + nav.padEnd(10) + uniq.length + ' collision(s), worst '
        + worst.w + 'x' + worst.h + 'px  "' + worst.a + '" x "' + worst.b + '"');
    } else {
      console.log('  ok    ' + W + 'px ' + nav.padEnd(10) + runs + ' in-flow text runs, none overlapping');
    }
  }
  if (thrown.length) fails.push(W + 'px: the page threw — ' + thrown.join(' | '));
  await ctx.close();
}
await b.close();
if (server) server.close();

// A run that collected almost nothing cannot have seen a collision, whatever it printed.
if (runsTotal < 100) {
  console.log('  FAIL  too few in-flow text runs collected');
  console.error('\nREFUSING: only ' + runsTotal + ' in-flow text runs were collected across '
    + combos + ' screen×width combinations. The fixture is not rendering, so every "none'
    + ' overlapping" above is vacuous.');
  process.exit(3);
}
console.log('\n' + combos + ' checks: ' + (combos - fails.length) + ' passed, ' + fails.length + ' failed'
  + '   (' + runsTotal + ' in-flow text runs compared)');
if (fails.length) {
  console.error('\n' + fails.length + ' FAILURE(S):');
  for (const f of fails) console.error('  - ' + f);
  process.exit(1);
}
console.log('PASS — no two pieces of text in normal flow land on each other.');
