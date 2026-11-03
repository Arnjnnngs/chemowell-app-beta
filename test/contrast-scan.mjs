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
//      [--base <url>] [--json <out>] [--width <px>]
//
// There is no --file: this scan needs a SERVED page, because it photographs a rendered viewport.
// An earlier header advertised one and nothing implemented it.
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

// THE CLOCK IS FROZEN AT 14:00 LOCAL, FOR THE THIRD TIME IN THIS REPO AND THE SAME REASON.
// The seed below places readings relative to "now". Run an hour later, a reading crosses a
// time-of-day boundary, the app draws one more "Overnight" or "Morning" heading, and the string
// count moves: measured, 309 at one hour and 310 at another, with Home +1, History +1, Weight -1.
// Nothing was wrong; the fixture is tied to the wall clock. `v90-chart-axes.mjs` carries the same
// freeze, and `chemowell-beta`'s suites have had it all along.
//
// It matters here even though the gate reads only an exit code: a count that drifts is a count a
// human cannot compare between runs, and comparing runs is how the overlay defects in this file
// were all found.
// 14:00 IN THE ZONE THE BROWSER IS PINNED TO, which is UTC (see newContext below). Computing
// this with `setHours` used the HOST's zone, so `TZ=America/Chicago node ...` froze the page --
// itself running in UTC -- at 20:00, which renders different time-of-day headings: measured
// 310 strings / 602 samples with TZ unset and 309 / 565 with TZ=America/Chicago, on identical
// code. Pinning the browser's zone is only half of it; the fixture's clock has to be pinned in
// the SAME zone or the two disagree and the count moves with the machine's locale.
const FROZEN = (() => { const n = new Date(); return Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate(), 14, 0, 0, 0); })();
const freeze = '(() => {'
  + '  const R = Date;'
  + '  const D = function (...a) { return a.length ? new R(...a) : new R(' + FROZEN + '); };'
  + '  D.now = () => ' + FROZEN + '; D.parse = R.parse; D.UTC = R.UTC; D.prototype = R.prototype;'
  + '  window.Date = D;'
  + '})()';
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
  // A PAUSED MEDICATION, because the row it renders was invisible to every gate this project has.
  // The grouped card's paused row and treatment-excluded row are muted with an opacity on the ROW,
  // and no fixture had ever rendered either of them -- so text painted at 3.4:1 sat in the app
  // through a release whose entire subject was whether the words can be read. A second medication
  // in the same group is all it took. If the group ever stops rendering, the count below drops and
  // that is the signal.
  localStorage.setItem('chemowell-app-p-p1-med-v1', JSON.stringify({ version: 2, archivedMeds: {}, meds: [
    { id: 'med-1', name: 'Blood pressure', schedule: 'daily', times: ['08:00'], doses: [{ label: '1 tablet', single: true }] },
    { id: 'med-2', name: 'Ondansetron', schedule: 'daily', times: ['08:00'], doses: [{ label: '4 mg', single: true }], groupedMorning: true, paused: true }
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
// THE TIMEZONE IS PINNED, AND THE FREEZE ALONE WAS NOT ENOUGH. The fourth audit ran this in six
// zones: 310 strings / 602 samples in UTC, Asia/Tokyo, Pacific/Kiritimati and Europe/London, but
// **313 / 604 in America/Chicago and America/Denver.** The mechanism is not a mystery and was
// measured rather than guessed: `FROZEN` is 14:00 *local*, while the fixture walks back six days in
// fixed milliseconds -- and both US zones had a DST transition on 1 Nov inside that window, so one
// reading lands in a different time-of-day bucket and the app draws one more heading. London
// transitioned on 25 Oct, outside the window, and matches UTC: that is the control.
//
// The VERDICT was stable in all six (0 below AA, worst 4.78:1); only the count moved. But a count
// that moves is a count nobody can compare between runs, and comparing runs is how every overlay
// defect in this file was found. So the zone is pinned too, and `310 / 602` means "in UTC".
//
// WHAT THE FREEZE COSTS, written down rather than discovered later: at 14:00 the fixture no longer
// renders the "Overnight" and "Evening" headings, so two strings leave coverage -- measured,
// `Overnight` at 6.44:1 and a sixth weight row at 6.36:1. Both are comfortably above AA, and the
// frozen set is the HARDER one (worst 4.78:1 frozen against 4.84:1 unfrozen), so nothing below AA
// is being hidden by the freeze. It is still a narrowing, and it is in `BACKLOG.md` M38.
const ctx = await b.newContext({ viewport: { width: WIDTH, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, timezoneId: 'UTC' });
const thrown = [];
ctx.on('page', (p) => p.on('pageerror', (e) => thrown.push(String(e))));
// The freeze is a CONTEXT script so it runs before the seed, which reads Date.now() itself.
await ctx.addInitScript(freeze);
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
  window.__stash = () => { window.__cvA = window.__cv; };
  window.__stashB = () => { window.__cvB = window.__cv; };
  window.__restoreB = () => { window.__cv = window.__cvB; };
  window.__diffBC = (boxes) => {
    const saved = window.__cvA; window.__cvA = window.__cvB;
    const r = window.__diff(boxes); window.__cvA = saved; return r;
  };
  // HOW MANY PIXELS INSIDE THIS BOX CHANGED WHEN THE TEXT WAS HIDDEN. Zero means the text is not
  // painting there -- something is on top of it, or it is invisible for some other reason -- and
  // whatever colour was sampled is not the colour behind that word.
  window.__diff = (boxes) => {
    const ga = window.__cvA.getContext('2d'), gb = window.__cv.getContext('2d');
    const W = window.__cv.width, H = window.__cv.height;
    return boxes.map(([x, y, w, h]) => {
      x = Math.max(0, Math.round(x)); y = Math.max(0, Math.round(y));
      w = Math.min(Math.round(w), W - x); h = Math.min(Math.round(h), H - y);
      if (w < 1 || h < 1) return -1;
      const a2 = ga.getImageData(x, y, w, h).data, b2 = gb.getImageData(x, y, w, h).data;
      let n = 0;
      for (let i = 0; i < a2.length; i += 4) {
        if (a2[i] !== b2[i] || a2[i+1] !== b2[i+1] || a2[i+2] !== b2[i+2]) n++;
      }
      // BOTH NUMBERS, FROM THE SAME ROUNDING. The caller used to compute its own denominator as
      // `round(w * h)` while this loop examines `round(w) * round(h)` after clamping to the
      // canvas -- so a fractional box printed more changed pixels than it had, e.g. "1242 of
      // 1231". The count and the thing it is a fraction OF now come from one place.
      return [n, w * h];
    });
  };
});

// SVG TEXT IS PAINTED WITH `fill`, NOT `color`, AND THE FIRST VERSION OF THIS FILE FORGOT IT.
// `color: transparent` leaves every chart label on screen, so the "backdrop" sampled under one was
// the glyph itself -- a blend of ink and background -- and the scan reported nineteen chart labels
// as unreadable against muddy greys (#7D7276, #8D8487) that exist nowhere in the app. Precise,
// repeatable, and about nothing. Exactly the shape of defect this project keeps paying for, found
// here only because a backdrop colour looked wrong rather than because a check failed.
// HIDE THE GLYPHS AND NOTHING ELSE. `color: transparent` was too broad and the breadth WAS the
// hole: `currentColor` resolves from `color`, so a border, background or shadow painted from it
// vanished in the hidden photograph too. A mutant whose opaque bar used `background:
// currentColor` therefore DISAPPEARED when the text was hidden -- the scan then sampled the real
// gradient underneath, computed a correct ratio for text the user cannot see at all, and exited
// 0. Three guards in a row missed it (the hit-test, the app's overlay probe, and the A/B diff),
// because all three were downstream of a hiding mechanism that changed the thing being measured.
//
// `-webkit-text-fill-color` paints the glyph and nothing else: `color` keeps its value, so
// `currentColor` keeps resolving to it and every border, background and shadow stays exactly as
// painted. The property appears nowhere in index.html, so nothing in the app conflicts with it.
const HIDE = `*,*::before,*::after{-webkit-text-fill-color:transparent !important;text-shadow:none !important;-webkit-text-stroke:0 !important;}
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
      tag: el.tagName.toLowerCase(), svg: isSvg, box: [r.left, r.top, r.width, r.height],
      // The identity used to de-duplicate across scroll passes. The viewport is 844 and the step
      // is 700, so a 144px band is photographed twice and everything in it is collected twice.
      key: s + '\u241f' + el.tagName + '\u241f' + paint + '\u241f' + cs.fontSize + '\u241f' + cs.fontWeight,
    });
  }
  return { out: out, skip: skip };
});

// TWO PHOTOGRAPHS, AND THE DIFFERENCE BETWEEN THEM IS THE PROOF THE TEXT IS VISIBLE.
//
// THE FIRST VERSION OF THIS GUARD DID NOT WORK AND MY OWN FALSIFICATION SAID SO. The audit showed
// that `elementFromPoint` ignores `pointer-events: none`, so an opaque layer that is painted but
// not hit-testable is invisible to the per-point coverage check and the scan measures text
// THROUGH it, against the layer's own pixels, and prints PASS. I first closed that by asking the
// app -- `window.__backTest.overlayNow()` -- and ran the audit's own mutant against it: **it
// still passed, byte for byte.** Of course it did. `anyOverlayOpen()` knows about the app's
// overlays; the mutant's bar is a div the app never heard of. A guard that asks the wrong
// authority is not a weaker guard, it is no guard.
//
// So this asks nobody. Photograph the viewport twice -- once as it is, once with every glyph
// made transparent -- and count the pixels inside each text box that CHANGED. A visible word
// changes pixels. Zero changed pixels means the word is not painting there: something is over it,
// or it is invisible, and the colour sampled underneath is not the colour behind that word.
// It does not care who painted the layer, whether it is hit-testable, whether the app knows about
// it, or whether the text escaped `color` through `fill`. An earlier version of this comment called
// that "mechanism-independent". IT IS NOT, AND THE FOURTH AUDIT MEASURED THE HOLE:
//
//   THE INK AND THE BACKDROP COME FROM DIFFERENT PLACES. The backdrop is read from the photograph,
//   so it is whatever was really painted -- a veil included. The INK is read from `cs.color`, which
//   a veil does not touch. So a TRANSLUCENT layer over the text defeats this guard on both counts
//   at once: the glyphs still change pixels through it, so the A-B diff is non-zero and the string
//   is kept; the layer is static, so B and C are identical and the moving check is silent; and the
//   ratio is then computed from the real ink against a veiled backdrop. Both colours are wrong in
//   the SAME direction, so the printed ratio goes UP.
//
//   Measured, mutant md5 `dcfc26be936ebb9dc1559daad41d69a9`: one 390x140 fixed `<div>`,
//   `pointer-events: none`, `rgba(255,255,255,0.85)`. Output byte-identical to a clean build --
//   310 / 602 / 0 below AA / worst 4.78:1, exit 0 -- while 48 of the 310 printed ratios moved, ALL
//   of them upward. "Alex's Meds" printed 15.08:1 and was painted #DFDEDF on #FFFAF8 = 1.30:1.
//
//   The live shape of it is `#tour-scrim` (`index.html:5349`): a full-viewport
//   `rgba(34,14,6,0.28)` layer at `pointer-events: none`. It fails loudly today only because it is
//   DARK -- a dark veil drives ratios down, past the threshold, and gets caught as a failure. A
//   PALE veil is the silent direction. The only thing keeping the tour shut here is `tourDone:
//   true` in the fixture, pinned by nothing.
//
//   So: this guard catches a layer that HIDES the glyphs (opaque, blend, blur) and a backdrop that
//   MOVES. It does not catch a static translucent veil, and it never reports partial coverage of a
//   box. Closing it means measuring the ink from pixels too, which is a redesign of the sampler --
//   logged with this mutant's md5 in `BACKLOG.md` M38 rather than bolted on at the end of a
//   release. `0 below AA` from this scan means "nothing measured below AA", not "no unreadable
//   text on screen", and nothing in this file may say otherwise.
//
// A second instance of the same premise, AND IT IS LIVE. `getComputedStyle(el).opacity` is the
// element's OWN value, so the `< 0.95` translucency skip below never sees an ANCESTOR's opacity.
// With `#root { opacity: 0.35 }` the scan exits 1 on 13 strings and still prints 297 as passing
// while every one of them is painted at 35%.
//
// An earlier version of this comment said the app had "one `opacity: 0`, two `opacity: 1`, and a
// `0.65` inside a comment" -- not live. **That was wrong, and it came out of an audit report
// rather than out of the file.** The grouped medications card has TWO live rows at
// `opacity: '0.65'` (the paused row and the treatment-excluded row), each wrapping two pieces of
// text, plus an `opacity: '0.55'` disabled input in the med editor. The opacity is on the row, so
// this scan reads 1 on the text and measures the ink unmuted: it would print 8.44:1 and 7.88:1
// for text painted at 3.39:1 and 3.27:1.
//
// app-v92 raises those rows to 0.8, which puts them at 4.92:1 and 4.68:1 as painted, and seeds a
// PAUSED medication below so the row is measured here from now on -- it was invisible to every
// gate for one dull reason: no fixture had ever rendered it. **The ancestor-opacity hole itself is
// still open**: the fix is to multiply the computed opacity up the ancestor chain before applying
// the skip. In `BACKLOG.md` M38-b with the mutant that proves it.
const shotAndSample = async (items) => {
  // A: as the viewer sees it.
  const shotA = await page.screenshot({ type: 'png' });
  await film.evaluate((u) => window.__load(u), 'data:image/png;base64,' + shotA.toString('base64'));
  await film.evaluate(() => window.__stash());
  // B: the same frame with every glyph transparent -- this is what the backdrop is read from.
  const style = await page.addStyleTag({ content: HIDE });
  await page.waitForTimeout(120);
  const shotB = await page.screenshot({ type: 'png' });
  // C IS TAKEN WHILE THE TEXT IS STILL HIDDEN. The first version of this removed the HIDE sheet
  // before photographing C, so C showed the glyphs again and EVERY string differed between B and
  // C -- the clean build reported 341 strings on a "moving" backdrop and measured nothing. The
  // falsification run caught it on the first build it touched, which is the only reason this
  // comment is here rather than a green release containing a guard that flags everything.
  await page.waitForTimeout(260);
  const shotC = await page.screenshot({ type: 'png' });
  await style.evaluate((n) => n.remove());
  await page.waitForTimeout(80);
  await film.evaluate((u) => window.__load(u), 'data:image/png;base64,' + shotB.toString('base64'));
  await film.evaluate(() => window.__stashB());
  // C: THE SAME HIDDEN FRAME AGAIN, AND THE THIRD AUDIT IS WHY IT EXISTS.
  //
  // HISTORY, IN THE PAST TENSE BECAUSE THE MECHANISM IT DESCRIBES IS GONE. `HIDE` USED TO set
  // `color: transparent` on every element, which is wider than hiding a glyph: a border,
  // background, box-shadow or SVG fill drawn from `currentColor` changed too, where no glyph ever
  // was. A mutant whose opaque bar used `background: currentColor` with a 2s transition therefore
  // produced a NON-zero diff inside every covered box and a headline byte-identical to a clean
  // build. `HIDE` now sets `-webkit-text-fill-color` (see its own comment), which paints the glyph
  // and nothing else, so that class is closed AT SOURCE -- the fourth audit re-ran that mutant and
  // it is now caught as INVISIBLE, not as moving. **Do not "restore" `color: transparent` here.**
  //
  // WHAT C STILL DOES, present tense: a backdrop that MOVES. A mutant flipping an opaque bar on a
  // 30ms `setInterval` leaks covered strings past the A-B diff, because Playwright settles CSS
  // animations and cannot settle a timer, so some boxes are photographed on the frame where the bar
  // is absent. Measured by the fourth audit with `movedEnough` forced false: that mutant leaks 304
  // measured strings instead of 268. Without C it still exits 1, but by luck of which boxes land on
  // which frame; C makes the catch deterministic.
  //
  // C is taken in the same hidden state as B, a moment later. A still backdrop is IDENTICAL in
  // B and C; anything moving -- a transition, a timer, an animation the harness did not settle --
  // is not, and a box whose backdrop is still moving is a box whose sampled colour means nothing.
  await film.evaluate((u) => window.__load(u), 'data:image/png;base64,' + shotC.toString('base64'));
  const movingPairs = await film.evaluate((bx) => window.__diffBC(bx), items.map(it => it.box));
  await film.evaluate(() => window.__restoreB());

  const flat = [];
  for (const it of items) for (const p of it.pts) flat.push(p);
  const cols = await film.evaluate((pts) => window.__px(pts), flat);
  let k = 0;
  for (const it of items) it.back = it.pts.map(() => cols[k++]);

  const diffPairs = await film.evaluate((bx) => window.__diff(bx), items.map(it => it.box));
  const live = [];
  for (let i = 0; i < items.length; i++) {
    items[i].changed = diffPairs[i][0];
    // A MOVING BACKDROP CHANGES THE BOX, NOT A FEW PIXELS OF IT. The first threshold here was
    // "any pixel at all", and on a clean build that flagged five strings at 4 to 16 pixels --
    // "BETA", "Overnight", "Weeks", "+" -- which is anti-aliasing between two captures, not an
    // animation. A threshold is a knob and knobs are how checks go vacuous, so this one is tied
    // to the thing it is about: an overlay that covers a word covers the WHOLE word, so it
    // changes most of the box. Noise touches its edges.
    //
    // 25% of the box area, floored at 24px so a tiny box cannot trip on three stray pixels.
    // Falsified in both directions rather than tuned until green: the clean build must pass, and
    // the `currentColor`-transition bar and the 30ms-timer bar must both still fail.
    const movedPx = movingPairs[i][0], examined = Math.max(1, movingPairs[i][1]);
    const movedEnough = movedPx >= Math.max(24, examined * 0.25);
    if (movedEnough) { unstable.push({ text: items[i].text, box: items[i].box.map(Math.round), px: movedPx, of: examined }); continue; }
    if (diffPairs[i][0] > 0) live.push(items[i]);
    else invisible.push({ text: items[i].text, box: items[i].box.map(Math.round) });
  }
  return live;
};

const SCREENS = [];
const skipped = {};
const invisible = [];
const unstable = [];
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
      // NOTHING MAY BE COVERING THE SCREEN. `elementFromPoint` ignores `pointer-events: none`, so a
    // painted-but-not-hit-testable layer is INVISIBLE to the per-point coverage check: the points
    // are kept, the text is "measured", and the backdrop sampled is the OVERLAY's pixels, because
    // the backdrop comes from the photograph and the photograph does show it. The audit proved it
    // with a 390x140 opaque white bar at `pointer-events: none`: six Home strings were measured
    // against #FFFFFF instead of the gradient behind them, every printed number was byte-identical
    // to a clean run, and the scan exited 0. A silent false green, and the skip denominator this
    // same release added did not move by one count.
    //
    // This is not hypothetical in this app: `#tour-layer` and `#tour-scrim` are full-viewport
    // `pointer-events: none` layers, and the only thing keeping the tour shut is `tourDone: true`
    // in the fixture above -- pinned by nothing, exactly like the version literal that caused the
    // last blocker.
    //
    // WHAT THIS ASSERTION ACTUALLY COVERS, after the third audit measured the sentence that used
    // to be here and found it false. It said `anyOverlayOpen()` "covers What's New, the tour, the
    // drawer, the upgrade sheet and every overlay added after this comment. One assertion, whole
    // class." **It does not cover the tour, and the tour is the one example that comment named.**
    //
    // `anyOverlayOpen()` (index.html:1920) SKIPS `pointer-events: none` by deliberate design --
    // twenty lines of comment there record that treating `#tour-layer` as an overlay once froze
    // the body through the whole first-run guide, so a new user could not add their first
    // medication. That behaviour is correct and must not change. It also means this assertion is
    // STRUCTURALLY incapable of catching the exact class the pixel diff below exists for.
    //
    // Measured, not argued: with `tourDone: false` in the fixture and no other change, the scan
    // reports 184 phantom failures at worst 1.39:1 and prints no REFUSING line at all.
    //
    // So: this catches an overlay the APP considers open -- What's New, the drawer, the upgrade
    // sheet -- early and with a clear message, which is worth having and costs one evaluate. It
    // is NOT the guard for painted-but-not-hit-testable layers. That is the pixel diff, and its
    // own limits are written where it lives.
    //
    // (The sentence it replaced was written beside a real fix and was wrong about the case it
    // named. index.html's own rule, ten lines above the `pointer-events` line it was wrong about:
    // "A claim about behaviour that nobody measured does not become true by being written into
    // the code next to a real fix.")
    const over = await page.evaluate(() =>
      (window.__backTest && typeof window.__backTest.overlayNow === 'function')
        ? window.__backTest.overlayNow() : 'no hook');
    if (over !== false) {
      console.error('REFUSING: ' + label + ' at scroll ' + y + ' has something over the screen'
        + ' (overlayNow = ' + JSON.stringify(over) + '). Every measurement here would be taken'
        + ' against that layer rather than against the app.');
      await b.close(); process.exit(3);
    }
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
// A STRING THAT CANNOT BE PROVEN VISIBLE IS NOT A STRING THAT PASSED. Reporting these and
// exiting 0 would be the same silent green the audit walked through -- the count would move and
// the verdict would not.
// DE-DUPLICATED, BECAUSE THE FIRST VERSION OF THIS LINE COUNTED COLLECTIONS AND CALLED THEM
// STRINGS -- the identical inflation pass 1 blocked on, printed four lines under the comment that
// records that lesson.
//
// THESE TWO LINES COUNT WITH DIFFERENT DENOMINATORS AND THAT IS DELIBERATE, because an earlier
// version of this comment did the arithmetic across them and got a number neither line prints.
// `invisible` and `unstable` are de-duplicated GLOBALLY -- the same string on the same box is one
// entry however many screens it appears on -- because a header that is invisible on all eight
// screens is ONE defect, not eight. `measured` is counted PER SCREEN, at each string's worst
// sample there, because a ratio is a property of a string on a screen. So against the opaque-bar
// mutant the scan prints **6 invisible** (six distinct header strings) and **262 measured**
// against a clean **310** -- and 310 - 262 = 48 is 6 strings x 8 screens, not a contradiction.
// Neither number is wrong; subtracting one from the other is.
const uniq = (list) => {
  const m = new Map();
  for (const v of list) m.set(v.text + '\u241f' + JSON.stringify(v.box), v);
  return [...m.values()];
};
const invisibleU = uniq(invisible), unstableU = uniq(unstable);
if (unstableU.length) {
  console.log('\n  FAIL  ' + unstableU.length + ' string(s) sit on a backdrop that was still MOVING');
  console.log('        between two photographs of the same hidden frame, so the colour sampled');
  console.log('        under them is a frame of an animation, not the colour behind them.');
  for (const v of unstableU.slice(0, 8)) console.log('          ' + JSON.stringify(v.text) + '  ' + v.px + ' of ' + v.of + ' px changed');
  if (unstableU.length > 8) console.log('          ... and ' + (unstableU.length - 8) + ' more');
}
if (invisibleU.length) {
  console.log('\n  FAIL  ' + invisibleU.length + ' string(s) were collected but did NOT change any pixel');
  console.log('        when the text was hidden, so something is painted over them, or they are');
  console.log('        invisible. Whatever colour sits under them is not the colour behind them.');
  for (const v of invisibleU.slice(0, 12)) console.log('          ' + JSON.stringify(v.text) + '  box ' + JSON.stringify(v.box));
  if (invisibleU.length > 12) console.log('          ... and ' + (invisibleU.length - 12) + ' more');
}
const skipTotal = Object.values(skipped).reduce((a2, b2) => a2 + b2, 0);
console.log('\n' + measured + ' DISTINCT strings measured (' + samples + ' samples), '
  + failures + ' below AA, worst ' + (Math.round(worstAll * 100) / 100) + ':1');
// The denominator. Not a coverage figure on its own -- `offscreen` is mostly the same element
// seen again on a later pass -- but a number that MOVES when the app starts hiding things from
// the scan, which is the failure this exists to make visible.
console.log('skipped while collecting: ' + skipTotal + '  ' + JSON.stringify(skipped));
console.log('  (NOT a coverage figure. `offscreen` is overwhelmingly the SAME string seen again on'
  + ' another pass; measured coverage is ~96%. This number is here to MOVE when the app starts'
  + ' hiding text from the scan, not to be read as the unmeasured surface.)');
console.log('page errors: ' + thrown.length + (thrown.length ? ' -> ' + thrown.slice(0, 2).join(' | ') : ''));
// A `checks:` LINE IN THE SHARED SHAPE, because `falsify.sh` reads one to decide whether the suite
// RAN at all -- and without it the sweep refused its own baseline and scored every mutant as
// "could not measure". A suite the falsification harness cannot read is a suite nobody falsifies.
// The unit is a distinct string: it passes if it was proven visible, sat on a still backdrop, and
// met AA. So the three red categories are all in `failed`, and this line can never read green
// while a FAIL is printed above it.
{
  const failedChecks = failures + invisibleU.length + unstableU.length;
  const totalChecks = measured + invisibleU.length + unstableU.length;
  console.log(totalChecks + ' checks: ' + (totalChecks - failedChecks) + ' passed, ' + failedChecks + ' failed');
}
if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(report, null, 2));
await b.close();
process.exit(failures || thrown.length || invisibleU.length || unstableU.length ? 1 : 0);
