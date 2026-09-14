// v80-contrast.mjs -- the "Up next" hero's white text really does clear WCAG AA on its gradient.
//
// WHY THIS EXISTS. app-v80's round-2 commit message said the label's full white "clears 4.5:1".
// It did not: measured against the gradient actually behind it, it was 3.3-3.8:1, and 12px bold is
// SMALL text, which AA holds to 4.5. Nobody caught it because nothing measured anything -- the
// claim was written by the same hand that chose the colour.
//
// So this suite measures. It reads the COMPUTED colours off the rendered card (not the source, so
// a token change or a cascade surprise is caught too), takes the LIGHTEST stop of the gradient as
// the worst case behind every string, blends any translucent text against it, and applies the AA
// thresholds: 4.5:1 for small text, 3:1 for text that is 24px, or 18.66px and bold.
//
// FALSIFY IT by putting the old gradient back (`#E4693B 0%`) or by returning any of the hero's
// white strings to `rgba(255,255,255,0.88)`; every affected row goes red.
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

const BASE = 'http://127.0.0.1:8899/index.html';
let pass = 0, fail = 0;
const t = (name, cond, detail) => {
  console.log('  ' + (cond ? 'PASS  ' : 'FAIL  ') + name + (detail ? '  |  ' + detail : ''));
  cond ? pass++ : fail++;
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
const page = await ctx.newPage();
const FROZEN = (() => { const d = new Date(); d.setHours(10, 0, 0, 0); return d.getTime(); })();
await page.addInitScript((frozen) => {
  const R = Date;
  const D = function (...a) { return a.length ? new R(...a) : new R(frozen); };
  D.now = () => frozen; D.parse = R.parse; D.UTC = R.UTC; D.prototype = R.prototype;
  window.Date = D;
}, FROZEN);
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1600);
await page.fill('input[placeholder="Enter patient name"]', 'Preview');
await page.getByRole('button', { name: 'Female', exact: true }).click();
await page.getByRole('button', { name: 'Chemo', exact: true }).click();
await page.getByRole('button', { name: 'Get started' }).click();
await page.waitForTimeout(900);
const skip = page.getByRole('button', { name: 'Skip guide' });
if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(600); }
await page.getByRole('button', { name: /^Meds/ }).first().click();
await page.waitForTimeout(600);
await page.locator('[data-tour="meds-add"]').first().click();
await page.waitForTimeout(400);
await page.getByPlaceholder('Medication name').first().fill('Seed');
await page.getByPlaceholder('For example, 4 hours').first().fill('4');
await page.getByRole('button', { name: 'Add medication', exact: true }).first().click();
await page.waitForTimeout(700);
const KEY = await page.evaluate(() => Object.keys(localStorage).find(k => /-med-v1$/.test(k)));
if (!KEY) { console.log('  FAIL  no medication config key'); process.exit(1); }
await page.evaluate(({ key }) => {
  localStorage.setItem(key, JSON.stringify({ version: 2, archivedMeds: {}, meds: [
    { id: 'due', name: 'DueNow', type: 'win', schemaV: 2, quickLog: true,
      doses: [{ label: '1 tab', mg: 0, pills: 1 }], windows: [{ start: 9, end: 11, name: 'Now' }] }
  ] }));
  const ek = Object.keys(localStorage).find(k => /entries-v1$/.test(k));
  if (ek) localStorage.setItem(ek, '[]');
}, { key: KEY });
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1900);
for (const nm of ['Skip guide', 'Got it']) {
  const b = page.getByRole('button', { name: nm, exact: nm === 'Got it' });
  if (await b.count()) { await b.first().click(); await page.waitForTimeout(500); }
}
await page.getByRole('button', { name: /^Home/ }).first().click();
await page.waitForTimeout(900);

const measured = await page.evaluate(() => {
  const hero = document.querySelector('[data-home="up-next"]');
  if (!hero) return { error: 'no hero on Home' };
  const parse = (s) => {
    const m = String(s).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(',').map(x => parseFloat(x.trim()));
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const stops = (String(getComputedStyle(hero).backgroundImage).match(/rgba?\([^)]+\)/g) || []).map(parse).filter(Boolean);
  // Walk every element inside the hero that has its own text, and record what it is drawn in.
  const rows = [];
  const walk = (el) => {
    for (const child of el.children) walk(child);
    const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(' ').trim();
    if (!own) return;
    const cs = getComputedStyle(el);
    rows.push({ text: own.slice(0, 40), color: parse(cs.color),
                size: parseFloat(cs.fontSize), weight: parseInt(cs.fontWeight, 10) || 400,
                bg: parse(cs.backgroundColor) });
  };
  walk(hero);
  return { stops, rows };
});
if (measured.error) { console.log('  FAIL  ' + measured.error); process.exit(1); }

const lin = (c) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
const lum = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
const over = (fg, bg) => ({ r: fg.a * fg.r + (1 - fg.a) * bg.r, g: fg.a * fg.g + (1 - fg.a) * bg.g, b: fg.a * fg.b + (1 - fg.a) * bg.b, a: 1 });
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

console.log('\n1. THE GRADIENT WAS READ, NOT ASSUMED');
{
  t('the hero paints a gradient with at least two stops', measured.stops.length >= 2,
    measured.stops.length + ' stop(s)');
  t('and it carries text to measure', measured.rows.length >= 3, measured.rows.length + ' string(s)');
}

// The worst case behind any string on this card is its LIGHTEST stop, wherever the string sits.
const worst = measured.stops.slice().sort((a, b) => lum(b) - lum(a))[0];

console.log('\n2. EVERY STRING ON THE HERO CLEARS AA AGAINST THE LIGHTEST PART OF ITS GROUND');
{
  for (const row of measured.rows) {
    if (!row.color) continue;
    // A string on its own opaque chip (the ring's inner disc, the white button) is measured against
    // that chip, not against the gradient underneath it.
    const ground = row.bg && row.bg.a >= 0.999 ? row.bg : (row.bg && row.bg.a > 0 ? over(row.bg, worst) : worst);
    const fg = row.color.a < 0.999 ? over(row.color, ground) : row.color;
    const large = row.size >= 24 || (row.size >= 18.66 && row.weight >= 700);
    const need = large ? 3 : 4.5;
    const got = ratio(fg, ground);
    t('"' + row.text + '" at ' + row.size + 'px/' + row.weight + (large ? ' (large)' : ' (small)'),
      got >= need, got.toFixed(2) + ':1, needs ' + need + ':1');
  }
}

console.log('\n3. AND NOTHING THREW');
{
  const real = errors.filter(e => !/Failed to fetch dynamically imported module/i.test(String(e).split('\n')[0]));
  t('no page error', real.length === 0, real.join(' | '));
}

await browser.close();
console.log('\n' + pass + '/' + (pass + fail) + ' checks passed' + (fail ? '  <-- FAIL' : ''));
process.exit(fail ? 1 : 0);
