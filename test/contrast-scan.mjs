// contrast-scan.mjs -- Aaron, from a screenshot of the History report:
//
//   "This color would be too hard to read for some people and I'm talking mainly about the
//    background. I don't want it to be white and I don't want it to be black but the background
//    blends in with some of the words that's not put in the box"
//
// Every gate this project has asks whether a screen FITS, whether the copy is TRUE, whether the
// record SURVIVES, whether the release mechanics happened. Not one of them has ever asked whether
// the words can be READ. This is that gate, and it is a measurement rather than an opinion:
// WCAG 2.1 contrast, computed from the pixels the browser actually painted.
//
// HOW THE BACKDROP IS MEASURED, and why it is not read out of CSS. The page background is a
// three-stop diagonal gradient, so the colour behind a word depends on where the word is. Walking
// up the DOM for a `background-color` returns `rgba(0,0,0,0)` for every one of these elements and
// would make the scan report a perfect ratio against nothing. Instead:
//
//   1. every piece of text on screen is made transparent (layout untouched),
//   2. the viewport is photographed,
//   3. that photograph is handed back to a canvas in a second page, so the browser decodes it,
//   4. the pixels under each word are read out of it.
//
// So the backdrop is whatever was really painted there -- gradient, card, scrim, blur and all.
//
// AND IT ONLY MEASURES WHAT IS ACTUALLY VISIBLE. Before sampling, `elementFromPoint` must return
// the text element itself at that point. Anything covered by a fixed overlay -- the floating Back
// pill, the bottom nav -- is skipped rather than measured through, because the number would be the
// contrast of a word against a button sitting on top of it, which is not a number about anything.
//
// Run: python3 -m http.server 8899 --directory <repo>  then
//      env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy node test/contrast-scan.mjs
//      [--file <index.html>] [--json <out>]
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = (() => {
  const _p = require('path');
  for (const t of ['playwright', _p.join(_p.dirname(process.execPath), '..', 'lib', 'node_modules', 'playwright'),
                   '/opt/node22/lib/node_modules/playwright']) { try { return require(t); } catch (e) {} }
  throw new Error('playwright not found');
})();
const argv = process.argv.slice(2);
const arg = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const BASE = process.env.FALSIFY_BASE || arg('--base') || 'http://127.0.0.1:8899/index.html';
const JSON_OUT = arg('--json');
const WIDTH = Number(arg('--width') || 390);

// --- WCAG 2.1 relative luminance and contrast. The one piece of arithmetic here, written out
//     rather than imported, and checked below against the two ratios everyone knows.
const srgb = (c) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
const lum = ([r, g, b]) => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
const ratio = (a, b) => { const la = lum(a), lb = lum(b); const hi = Math.max(la, lb), lo = Math.min(la, lb); return (hi + 0.05) / (lo + 0.05); };
{
  const bw = ratio([0, 0, 0], [255, 255, 255]);
  if (Math.abs(bw - 21) > 0.01) { console.error('REFUSING: black on white computes ' + bw + ', not 21. The arithmetic is wrong.'); process.exit(3); }
  const same = ratio([120, 80, 60], [120, 80, 60]);
  if (Math.abs(same - 1) > 0.001) { console.error('REFUSING: a colour on itself computes ' + same + ', not 1.'); process.exit(3); }
}

// AA: 4.5 for body text, 3.0 for large text (>=24px, or >=18.66px when bold).
const needs = (px, weight) => ((px >= 24) || (px >= 18.66 && Number(weight) >= 700)) ? 3.0 : 4.5;

const seed = () => `(() => {
  const now = Date.now(), DAY = 86400000;
  const e = [];
  for (let d = 0; d < 6; d++) {
    e.push({ id: 'm' + d, medId: 'med-1', name: 'Blood pressure', kind: 'med', ts: now - d * DAY - 3600000, dose: '1 tablet' });
    e.push({ id: 'w' + d, medId: 'weight', ts: now - d * DAY - 7200000, weight: 150 + d, unit: 'lb', dose: (150 + d) + ' lb' });
    e.push({ id: 't' + d, medId: 'temp', ts: now - d * DAY - 9000000, temp: 98.6 + d * 0.3, unit: 'Fahrenheit', dose: (98.6 + d * 0.3).toFixed(1) + ' \\u00b0F' });
  }
  e.push({ id: 's1', medId: 'symptom', kind: 'symptom', ts: now - 5400000, symptomId: 'nausea', dose: 'Nausea' });
  localStorage.setItem('chemowell-app-profiles-v1', JSON.stringify({ list: [{ id: 'p1', name: 'Alex', createdAt: 1 }], activeId: 'p1' }));
  localStorage.setItem('chemowell-app-license-v1', JSON.stringify({ tier: 'free' }));
  localStorage.setItem('chemowell-app-p-p1-prefs-v1', JSON.stringify({ patientName: 'Alex', onboarded: true, treatmentType: 'chemo', tourDone: true, installedAt: now - 90 * DAY }));
  localStorage.setItem('chemowell-app-p-p1-med-v1', JSON.stringify({ version: 2, archivedMeds: {}, meds: [
    { id: 'med-1', name: 'Blood pressure', schedule: 'daily', times: ['08:00'], doses: [{ label: '1 tablet', single: true }] }
  ] }));
  localStorage.setItem('chemowell-app-p-p1-entries-v1', JSON.stringify(e));
  // NO VERSION LITERAL HERE. An earlier version of this file pinned 'app-v90' to suppress the
  // What's New modal, which worked exactly until the release that bumped APP_VERSION -- in the
  // same commit as the palette. The modal then opened on load, its scrim swallowed the scan's
  // first click, and the scan exited having measured NOTHING while the record quoted figures as
  // if it had. Rule 5 names this: never pin a version literal in a suite. Setting it to
  // 'app-v91' would only move the bug one release. The modal is dismissed after load instead.
})()`;

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: WIDTH, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
const thrown = [];
ctx.on('page', (p) => p.on('pageerror', (e) => thrown.push(String(e))));
const page = await ctx.newPage();
await page.addInitScript(seed());
await page.goto(BASE, { waitUntil: 'load' });
await page.waitForTimeout(2200);
// With no seen-version pinned, What's New opens on first load and its scrim intercepts every
// pointer event. Dismiss it by its own hook, and FAIL LOUDLY if it is still up afterwards --
// a scan that quietly measures a scrim is worse than one that crashes.
{
  const close = await page.$('[data-whatsnew-close="true"]');
  if (close) { await close.click(); await page.waitForTimeout(500); }
  if (await page.$('[data-whatsnew-modal="true"]')) {
    console.error('REFUSING: the What\u2019s New modal is still open, so every measurement would be\n'
      + 'taken against its scrim rather than against the app.');
    process.exit(3);
  }
}

// The decoder: a blank page whose only job is to let the browser turn a PNG back into pixels.
const film = await ctx.newPage();
await film.goto('about:blank');
await film.evaluate(() => {
  window.__load = (dataUrl) => new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0);
      window.__cv = c; res([c.width, c.height]);
    };
    img.src = dataUrl;
  });
  window.__px = (pts) => {
    const g = window.__cv.getContext('2d');
    return pts.map(([x, y]) => { const d = g.getImageData(x, y, 1, 1).data; return [d[0], d[1], d[2]]; });
  };
});

// SVG TEXT IS PAINTED WITH `fill`, NOT `color`, AND THE FIRST VERSION OF THIS FILE FORGOT IT.
// `color: transparent` leaves every chart label on screen, so the "backdrop" sampled under one was
// the glyph itself -- a blend of ink and background -- and the scan reported nineteen chart labels
// as unreadable against muddy greys (#7D7276, #8D8487) that exist nowhere in the app. Precise,
// repeatable, and about nothing. Exactly the shape of defect this project keeps paying for, found
// here only because a backdrop colour looked wrong rather than because a check failed.
const HIDE = `*,*::before,*::after{color:transparent !important;text-shadow:none !important;-webkit-text-stroke:0 !important;}
svg text,svg tspan{fill:transparent !important;stroke:none !important;}`;

// Collect every text-bearing element in the viewport, with the points to sample for each. Points
// sit inside the text's own box, which is why the text has to be hidden before the photograph.
const collect = () => page.evaluate(() => {
  const out = [];
  // EVERY SKIP IS COUNTED. Seven branches below drop an element, and until this was added none
  // of them left a trace -- so "0 below AA" could not be told apart from "did not look at it".
  // Add a sticky header tomorrow and the labels under it leave the count silently while the scan
  // still prints PASS. A denominator is the cheapest guard there is against that.
  const skip = { hidden: 0, tiny: 0, offscreen: 0, nopaint: 0, translucent: 0, covered: 0 };
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  let n;
  while ((n = walk.nextNode())) {
    const s = (n.nodeValue || '').trim();
    if (!s) continue;
    const el = n.parentElement;
    if (!el || seen.has(el)) continue;
    seen.add(el);
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.95) { skip.hidden++; continue; }
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) { skip.tiny++; continue; }
    // OFF-SCREEN AT THIS SCROLL POSITION -- usually caught on a later pass, so this count is not
    // a coverage figure on its own. The one shape that escapes every pass is an element TALLER
    // than the overlap between passes (144px): `bottom > innerHeight` on one, `top < 0` on the
    // next. Nothing in the app is that tall today. A longer paragraph would be, silently.
    if (r.top < 0 || r.bottom > innerHeight || r.left < 0 || r.right > innerWidth) { skip.offscreen++; continue; }
    // ...and the colour has to be read from the same property that paints it. An SVG label's
    // computed `color` is whatever it inherited from the page and has nothing to do with what is
    // drawn; `fill` is the ink.
    const isSvg = el.namespaceURI === 'http://www.w3.org/2000/svg';
    const paint = isSvg ? (cs.fill || '') : (cs.color || '');
    const m = paint.match(/rgba?\(([^)]+)\)/);
    if (!m) { skip.nopaint++; continue; }
    const p = m[1].split(',').map(Number);
    if (p.length > 3 && p[3] < 0.95) { skip.translucent++; continue; }   // translucent ink
    // Sample points spread across the box, inset so a border is not read as the backdrop.
    const pts = [];
    for (const fx of [0.2, 0.5, 0.8]) for (const fy of [0.3, 0.7]) {
      const x = Math.round(r.left + r.width * fx), y = Math.round(r.top + r.height * fy);
      const top = document.elementFromPoint(x, y);
      if (!top) continue;
      if (top !== el && !el.contains(top)) continue;    // covered by something: skip the point
      pts.push([x, y]);
    }
    if (!pts.length) { skip.covered++; continue; }      // wholly covered: not measurable here
    out.push({
      text: s.slice(0, 48), color: [p[0], p[1], p[2]],
      px: parseFloat(cs.fontSize), weight: cs.fontWeight, pts: pts,
      tag: el.tagName.toLowerCase(), svg: isSvg,
      // The identity used to de-duplicate across scroll passes. The viewport is 844 and the step
      // is 700, so a 144px band is photographed twice and everything in it is collected twice.
      key: s + '\u241f' + el.tagName + '\u241f' + cs.color + '\u241f' + cs.fontSize + '\u241f' + cs.fontWeight,
    });
  }
  return { out: out, skip: skip };
});

const shotAndSample = async (items) => {
  const style = await page.addStyleTag({ content: HIDE });
  await page.waitForTimeout(120);
  const buf = await page.screenshot({ type: 'png' });
  await page.evaluate((id) => { const e = document.querySelector('style[data-hide]'); if (e) e.remove(); }, null);
  await style.evaluate((n) => n.remove());
  await page.waitForTimeout(80);
  const url = 'data:image/png;base64,' + buf.toString('base64');
  await film.evaluate((u) => window.__load(u), url);
  const flat = [];
  for (const it of items) for (const p of it.pts) flat.push(p);
  const cols = await film.evaluate((pts) => window.__px(pts), flat);
  let k = 0;
  for (const it of items) {
    it.back = it.pts.map(() => cols[k++]);
  }
  return items;
};

const SCREENS = [];
const skipped = {};
const goNav = async (key) => { await page.click('[data-tour="nav-' + key + '"]'); await page.waitForTimeout(900); };
const goReport = async (k) => { await page.evaluate((r) => window.__v86Test.openReport(r), k); await page.waitForTimeout(900); };

const scan = async (label, setup) => {
  await setup();
  const rows = [];
  let y = 0, guard = 0;
  const hMax = await page.evaluate(() => document.documentElement.scrollHeight);
  while (y < hMax && guard++ < 12) {
    await page.evaluate((v) => window.scrollTo(0, v), y);
    await page.waitForTimeout(260);
      const got = await collect();
    for (const k of Object.keys(got.skip)) skipped[k] = (skipped[k] || 0) + got.skip[k];
    if (got.out.length) rows.push(...await shotAndSample(got.out));
    y += 700;
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  SCREENS.push({ label, rows });
};

await scan('Home', async () => { await goNav('home'); });
await scan('Reports menu', async () => { await goNav('reports'); });
await scan('Reports / History', async () => { await goReport('history'); });
await scan('Reports / Weight', async () => { await goReport('weight'); });
await scan('Reports / Temperature', async () => { await goReport('temp'); });
await scan('Meds', async () => { await goNav('meds'); });
await scan('Symptoms', async () => { await goNav('symptoms'); });
await scan('In-Patient', async () => { await goNav('inpatient'); });

const hex = (c) => '#' + c.map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
// DISTINCT STRINGS, NOT SAMPLES. The first version of this counted rows and called them
// "strings": the viewport is 844 and the scroll step 700, so a 144px band is photographed twice
// and everything in it was counted twice. 565 "strings" was really 295, a 1.9x inflation, and one
// mutant changing ONE literal on ONE line was reported as 18 failures -- all the same string.
// The ratios were right; the word was wrong, in four places in the record. A string is counted
// once per screen, at its WORST sample anywhere on that screen.
let worstAll = 99, failures = 0, measured = 0, samples = 0;
const report = [];
for (const sc of SCREENS) {
  const fails = [];
  const best = new Map();
  for (const r of sc.rows) {
    let w = 99, wb = null;
    for (const bk of r.back) { const v = ratio(r.color, bk); if (v < w) { w = v; wb = bk; } }
    samples++;
    const k = r.key || (r.text + r.px + r.weight);
    const prev = best.get(k);
    if (!prev || w < prev.worst) best.set(k, { r: r, worst: w, back: wb });
  }
  sc.rows = [...best.values()].map(v => Object.assign({}, v.r, { back: [v.back] }));
  for (const r of sc.rows) {
    // The WORST point under the word is the one that decides whether it can be read.
    let worst = 99, worstBack = null;
    for (const bk of r.back) { const v = ratio(r.color, bk); if (v < worst) { worst = v; worstBack = bk; } }
    measured++;
    const need = needs(r.px, r.weight);
    if (worst < worstAll) worstAll = worst;
    if (worst < need) { failures++; fails.push({ text: r.text, ratio: Math.round(worst * 100) / 100, need, color: hex(r.color), back: hex(worstBack), px: r.px, weight: r.weight }); }
  }
  report.push({ screen: sc.label, measured: sc.rows.length, fails });
}

console.log('contrast-scan  ' + BASE + '  width ' + WIDTH + 'px\n');
for (const s of report) {
  if (!s.fails.length) { console.log('  PASS  ' + s.screen + '  (' + s.measured + ' strings, all at or above AA)'); continue; }
  console.log('  FAIL  ' + s.screen + '  (' + s.fails.length + ' of ' + s.measured + ' below AA)');
  for (const f of s.fails.sort((a, b) => a.ratio - b.ratio))
    console.log('          ' + String(f.ratio).padStart(5) + ':1  needs ' + f.need + '   ' + f.color + ' on ' + f.back
      + '   ' + f.px + 'px/' + f.weight + '   "' + f.text + '"');
}
const skipTotal = Object.values(skipped).reduce((a2, b2) => a2 + b2, 0);
console.log('\n' + measured + ' DISTINCT strings measured (' + samples + ' samples), '
  + failures + ' below AA, worst ' + (Math.round(worstAll * 100) / 100) + ':1');
// The denominator. Not a coverage figure on its own -- `offscreen` is mostly the same element
// seen again on a later pass -- but a number that MOVES when the app starts hiding things from
// the scan, which is the failure this exists to make visible.
console.log('skipped while collecting: ' + skipTotal + '  ' + JSON.stringify(skipped));
console.log('page errors: ' + thrown.length + (thrown.length ? ' -> ' + thrown.slice(0, 2).join(' | ') : ''));
if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(report, null, 2));
await b.close();
process.exit(failures || thrown.length ? 1 : 0);
