// v82-vitals-strip.mjs -- the vitals strip logs what the two big cards logged.
//
// WHAT THIS PROTECTS. app-v82 took Temperature, Weight and Blood Pressure out of three large cards
// with permanently-visible inputs and put them into three compact tiles whose input appears on tap.
// That is a re-arrangement of the FIRST SCREEN of a medication app, so the things that could go
// wrong are not cosmetic:
//   1. The input moves behind a tap and the Log button stops writing. A caregiver types a fever
//      reading, taps Log, and nothing is recorded.
//   2. A Settings toggle stops being honoured -- a vital somebody switched off comes back, or one
//      they kept disappears.
//   3. The panel opens for a tile that is not on the strip, so an input hangs under nothing.
//   4. Three tiles side by side push Home sideways on a 320px phone.
//   5. The h() null-attribute trap writes the literal string "null" onto an element.
//
// Every check below runs in a real browser against the real file. A Node sandbox cannot see any of
// these, because every one of them is about what the page actually draws.
//
// Run:  python3 -m http.server 8899 --directory <repo>   (then)  node test/v82-vitals-strip.mjs
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
  console.log('  ' + (cond ? 'PASS  ' : 'FAIL  ') + name + (detail !== undefined ? '  |  ' + detail : ''));
  cond ? pass++ : fail++;
};
const section = s => console.log('\n' + s);

const HOUR = 3600000;

// Seeded readings, each a different age so the "how long ago" line has something to be wrong about.
function seed(homeCards) {
  const now = Date.now();
  return {
    // The Settings toggles live under prefs.homeCards -- writing them at the top level is the shape
    // of a check that passes while testing nothing, because homePref() would never see them.
    prefs: homeCards ? { patientName: 'Test', onboarded: true, homeCards } : { patientName: 'Test', onboarded: true },
    entries: [
      { id: 't1', medId: 'temp', temp: 100.8, ts: now - 3 * HOUR },
      { id: 'w1', medId: 'weight', weight: 151.2, ts: now - 9 * HOUR },
      { id: 'b1', medId: 'blood_pressure', sys: 128, dia: 82, ts: now - 40 * 60000 }
    ]
  };
}

async function open(browser, fixture, viewport) {
  const page = await browser.newPage({ viewport: viewport || { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.message)));
  // A blocked font or analytics request through the sandbox proxy is not a defect in this page.
  // Real page errors and real console errors still count.
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const x = m.text();
    if (/Failed to load resource|ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|net::ERR_/.test(x)) return;
    errors.push(x);
  });
  await page.goto(BASE);
  await page.waitForTimeout(1200);
  // The app picks its own per-profile storage keys on first run, so the fixture is written into
  // WHATEVER keys it actually created rather than into names guessed from outside. A suite that
  // guesses wrong writes a fixture nothing reads and then passes on an empty app.
  const keys = await page.evaluate(() => {
    const prefs = Object.keys(localStorage).find(k => /prefs-v1$/.test(k));
    // The entries key does not exist until something is logged, so it is derived from the prefs key
    // the app really created rather than guessed -- same profile prefix, same version suffix.
    return { prefs, entries: Object.keys(localStorage).find(k => /entries-v1$/.test(k))
      || (prefs ? prefs.replace(/prefs-v1$/, 'entries-v1') : null) };
  });
  if (!keys.prefs || !keys.entries) throw new Error('storage keys not found: ' + JSON.stringify(keys));
  await page.evaluate(({ k, f }) => {
    const prefs = JSON.parse(localStorage.getItem(k.prefs) || '{}');
    localStorage.setItem(k.prefs, JSON.stringify(Object.assign(prefs, f.prefs)));
    localStorage.setItem(k.entries, JSON.stringify(f.entries));
  }, { k: keys, f: fixture });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1600);
  // First-run guide sits over Home and swallows taps. Dismiss it the way a person would.
  for (const name of ['Skip guide', 'Got it']) {
    const b = page.getByRole('button', { name, exact: true });
    if (await b.count()) { await b.first().click(); await page.waitForTimeout(400); }
  }
  page.__errors = errors;
  page.__keys = keys;
  return page;
}

// Temperature, weight and blood pressure all go through the confirm-the-time sheet before anything
// is written -- that is deliberate, and a suite that clicked Log and read storage straight away
// would report a failure that is really the app asking a question.
// It REPORTS rather than throws. A suite that dies when the sheet never opens tells you a stack
// trace instead of which check failed -- which is exactly what happened the first time a Log button
// was deliberately unwired to test these checks.
async function confirmSheet(page) {
  const c = page.getByRole('button', { name: 'Confirm', exact: true });
  try { await c.first().waitFor({ timeout: 4000 }); } catch (e) { return false; }
  await c.first().click();
  await page.waitForTimeout(600);
  return true;
}

const browser = await chromium.launch();
const allErrors = [];

// ---------------------------------------------------------------------------------------------
section('1. THE STRIP IS ON HOME AND IT SHOWS THE READINGS THAT EXIST');
{
  const p = await open(browser, seed());
  t('the strip is drawn', await p.locator('[data-home="vitals"]').count() === 1,
    String(await p.locator('[data-home="vitals"]').count()));
  const tiles = await p.locator('[data-vital-tile]').allTextContents();
  t('three tiles, one per vital', tiles.length === 3, JSON.stringify(tiles));
  t('the temperature tile prints the latest reading', /100\.8/.test(tiles.join('|')), tiles[0]);
  t('the weight tile prints the latest reading', /151\.2/.test(tiles.join('|')), tiles[1]);
  t('the blood pressure tile prints both numbers', /128\/82/.test(tiles.join('|')), tiles[2]);

  // The age line is the one thing the old cards did NOT say, and the reason a caregiver at 2am
  // could not tell whether a number was current.
  t('the temperature tile says how old the reading is', /3h ago/.test(tiles[0]), tiles[0]);
  t('the weight tile says how old the reading is', /9h ago/.test(tiles[1]), tiles[1]);
  t('a reading from the last hour says minutes, not "0h"', /40m ago/.test(tiles[2]), tiles[2]);

  allErrors.push(...p.__errors);
  await p.close();
}

// ---------------------------------------------------------------------------------------------
section('2. THE INPUT IS BEHIND ONE TAP AND THE LOG BUTTON STILL WRITES');
{
  const p = await open(browser, seed());
  t('no input is showing before a tap', await p.locator('[data-vital-panel]').count() === 0,
    String(await p.locator('[data-vital-panel]').count()));

  await p.locator('[data-vital-tile="temp"]').click();
  await p.waitForTimeout(250);
  t('tapping the temperature tile opens a panel',
    await p.locator('[data-vital-panel="temp"]').count() === 1);
  t('and the panel holds a temperature input',
    await p.locator('[data-vital-input="temp"]').count() === 1);
  t('and the tile says it is expanded, for a screen reader',
    await p.locator('[data-vital-tile="temp"]').getAttribute('aria-expanded') === 'true');

  const before = await p.evaluate(K =>
    JSON.parse(localStorage.getItem(K)).filter(e => e.medId === 'temp').length, p.__keys.entries);
  await p.locator('[data-vital-input="temp"]').fill('99.4');
  await p.locator('[data-vital-log="temp"]').click();
  await p.waitForTimeout(400);
  t('Log opens the confirm-the-time sheet rather than writing straight away',
    await p.getByRole('button', { name: 'Confirm', exact: true }).count() >= 1);
  t('and the sheet is really there to confirm', await confirmSheet(p));
  const after = await p.evaluate(K =>
    JSON.parse(localStorage.getItem(K)).filter(e => e.medId === 'temp'), p.__keys.entries);
  t('tapping Log writes exactly one temperature reading', after.length === before + 1,
    before + ' -> ' + after.length);
  t('and it is the number that was typed',
    after.sort((a, b) => b.ts - a.ts)[0].temp === 99.4,
    String(after.sort((a, b) => b.ts - a.ts)[0].temp));

  const tiles = await p.locator('[data-vital-tile]').allTextContents();
  t('and the tile now shows the new reading', /99\.4/.test(tiles[0]), tiles[0]);
  t('and it is described as just taken', /just now|0m ago|1m ago/.test(tiles[0]), tiles[0]);

  await p.locator('[data-vital-tile="temp"]').click();
  await p.waitForTimeout(250);
  t('tapping the tile again closes the panel',
    await p.locator('[data-vital-panel]').count() === 0);

  allErrors.push(...p.__errors);
  await p.close();
}

// ---------------------------------------------------------------------------------------------
section('2b. WEIGHT AND BLOOD PRESSURE WRITE TOO -- NOT ONLY THE ONE THAT WAS CHECKED');
{
  const p = await open(browser, seed());
  await p.locator('[data-vital-tile="weight"]').click();
  await p.waitForTimeout(250);
  await p.locator('[data-vital-input="weight"]').fill('149.6');
  await p.locator('[data-vital-log="weight"]').click();
  await p.waitForTimeout(400);
  t('the weight Log button opens its confirm sheet', await confirmSheet(p));
  const w = await p.evaluate(K =>
    JSON.parse(localStorage.getItem(K))
      .filter(e => e.medId === 'weight').sort((a, b) => b.ts - a.ts)[0], p.__keys.entries);
  t('the weight panel writes a weight', w && Number(w.weight) === 149.6, w ? String(w.weight) : 'none');

  await p.locator('[data-vital-tile="bp"]').click();
  await p.waitForTimeout(250);
  t('opening another tile closes the first -- one panel at a time',
    await p.locator('[data-vital-panel]').count() === 1,
    await p.locator('[data-vital-panel]').getAttribute('data-vital-panel'));
  await p.locator('[data-vital-input="bp-sys"]').fill('118');
  await p.locator('[data-vital-input="bp-dia"]').fill('76');
  // Blood pressure writes straight away -- it is the one vital with no confirm-the-time sheet.
  // Asserted rather than skipped, so the day that changes, this says so.
  await p.locator('[data-vital-log="bp"]').click();
  await p.waitForTimeout(600);
  t('blood pressure writes without a sheet, unlike temperature and weight',
    await p.getByRole('button', { name: 'Confirm', exact: true }).count() === 0);
  const bp = await p.evaluate(K =>
    JSON.parse(localStorage.getItem(K))
      .filter(e => e.medId === 'blood_pressure').sort((a, b) => b.ts - a.ts)[0], p.__keys.entries);
  t('the blood pressure panel writes both halves',
    bp && Number(bp.sys) === 118 && Number(bp.dia) === 76, bp ? (bp.sys + '/' + bp.dia) : 'none');

  allErrors.push(...p.__errors);
  await p.close();
}

// ---------------------------------------------------------------------------------------------
section('3. A VITAL TURNED OFF IN SETTINGS STAYS OFF');
{
  // These are the real preference keys the strip reads. If the strip ever stops reading them, a
  // caregiver who cleared their screen gets the clutter back without touching anything.
  const p = await open(browser, seed({ showTemperature: false }));
  const keys = await p.locator('[data-vital-tile]').evaluateAll(
    els => els.map(e => e.getAttribute('data-vital-tile')));
  t('temperature off removes its tile', keys.indexOf('temp') < 0, JSON.stringify(keys));
  t('and leaves the other two', keys.length === 2, JSON.stringify(keys));
  allErrors.push(...p.__errors);
  await p.close();
}
{
  const p = await open(browser, seed({ showTemperature: false, showWeight: false, showBloodPressure: false }));
  t('all three off draws no strip at all',
    await p.locator('[data-home="vitals"]').count() === 0,
    String(await p.locator('[data-home="vitals"]').count()));
  allErrors.push(...p.__errors);
  await p.close();
}
{
  // BEFORE app-v82 this case rendered NOTHING: blood pressure lived inside a grid gated on
  // `showTemperature || showWeight`, so a caregiver who wanted only BP on Home got a blank space.
  // The strip fixes that, and this check is what stops it regressing.
  const p = await open(browser, seed({ showTemperature: false, showWeight: false }));
  const keys = await p.locator('[data-vital-tile]').evaluateAll(
    els => els.map(e => e.getAttribute('data-vital-tile')));
  t('blood pressure alone still draws -- it used to vanish', keys.length === 1 && keys[0] === 'bp',
    JSON.stringify(keys));
  await p.locator('[data-vital-tile="bp"]').click();
  await p.waitForTimeout(250);
  t('and its input opens', await p.locator('[data-vital-input="bp-sys"]').count() === 1);
  allErrors.push(...p.__errors);
  await p.close();
}

// ---------------------------------------------------------------------------------------------
section('4. NO READINGS YET LOOKS LIKE AN EMPTY TILE, NOT A BROKEN ONE');
{
  const p = await open(browser, { prefs: { patientName: 'Test', onboarded: true }, entries: [] });
  const tiles = await p.locator('[data-vital-tile]').allTextContents();
  t('the tiles are still there with nothing logged', tiles.length === 3, JSON.stringify(tiles));
  t('and print a dash rather than undefined or NaN',
    tiles.every(x => /—/.test(x)) && !/undefined|NaN|null/.test(tiles.join('|')),
    JSON.stringify(tiles));
  t('and say so in words', tiles.every(x => /none yet/.test(x)), JSON.stringify(tiles));
  await p.locator('[data-vital-tile="temp"]').click();
  await p.waitForTimeout(250);
  t('the panel still opens on an empty tile',
    await p.locator('[data-vital-input="temp"]').count() === 1);
  allErrors.push(...p.__errors);
  await p.close();
}

// ---------------------------------------------------------------------------------------------
section('5. IT FITS THE SMALLEST PHONE, AND EVERY CONTROL IS REACHABLE');
{
  const p = await open(browser, seed(), { width: 320, height: 800 });
  const w = await p.evaluate(() => document.documentElement.scrollWidth);
  t('Home does not scroll sideways at 320px', w <= 320, w + 'px');
  const boxes = await p.locator('[data-vital-tile]').evaluateAll(
    els => els.map(e => { const r = e.getBoundingClientRect(); return { h: Math.round(r.height), r: Math.round(r.right) }; }));
  t('every tile is at least 44px high -- a real tap target',
    boxes.every(b => b.h >= 44), JSON.stringify(boxes.map(b => b.h)));
  t('and no tile runs off the right edge', boxes.every(b => b.r <= 321),
    JSON.stringify(boxes.map(b => b.r)));

  await p.locator('[data-vital-tile="bp"]').click();
  await p.waitForTimeout(250);
  const inputs = await p.locator('[data-vital-panel] input').evaluateAll(
    els => els.map(e => ({ fs: getComputedStyle(e).fontSize, h: Math.round(e.getBoundingClientRect().height) })));
  // 16px is the iOS floor: below it Safari zooms the page on focus and the caregiver is left
  // scrolled sideways on a screen they were only trying to type into.
  t('every input is at the 16px iOS floor',
    inputs.length > 0 && inputs.every(i => parseFloat(i.fs) >= 16), JSON.stringify(inputs.map(i => i.fs)));
  t('and at least 44px high', inputs.every(i => i.h >= 44), JSON.stringify(inputs.map(i => i.h)));
  const logH = await p.locator('[data-vital-log="bp"]').evaluate(e => Math.round(e.getBoundingClientRect().height));
  t('the Log button is a real tap target too', logH >= 44, logH + 'px');
  allErrors.push(...p.__errors);
  await p.close();
}

// ---------------------------------------------------------------------------------------------
section('6. THE h() NULL-ATTRIBUTE TRAP');
{
  const p = await open(browser, seed());
  const n = await p.evaluate(() => [...document.querySelectorAll('[data-home="vitals"] *')]
    .filter(e => [...e.attributes].some(a => a.value === 'null')).length);
  t('no element in the strip carries the literal attribute value "null"', n === 0, n + ' found');
  allErrors.push(...p.__errors);
  await p.close();
}

// ---------------------------------------------------------------------------------------------
section('7. AND NOTHING THREW');
t('no page error at any point above', allErrors.length === 0, allErrors.slice(0, 3).join(' / ') || 'none');

await browser.close();
console.log('\n' + (pass + fail) + ' checks: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
