// v80-pixel-identity.mjs -- the token extraction must change NOTHING a user can see.
//
// WHY THIS EXISTS. app-v80 replaces about 1,580 inline colour literals -- 84 distinct hex values used
// 1,132 times, plus 139 distinct rgba() values used 449 times -- with token references. That is a
// fifteen-hundred-edit diff in a file that has already shipped a dead Home screen past five suites
// and 103 checks. No reviewer reads fifteen hundred colour changes carefully, and no assertion about
// behaviour would catch a single wrong one.
//
// So the check is not behavioural. It is: **render every screen at every phone width, before and
// after, and require the images to be byte-identical.** A large refactor whose own test is "the
// pixels did not move" is one of the very few that can be verified COMPLETELY rather than sampled --
// and one wrong token anywhere in the file fails it.
//
// THE CLOCK IS FROZEN, and without that this suite is worthless: the header prints the time, so two
// runs a minute apart differ in every screenshot and the check becomes noise that everyone learns to
// ignore. Date.now and new Date() are pinned before any app code runs.
//
// Run:
//   node test/v80-pixel-identity.mjs --save   outputs/pixel-baseline     (before the refactor)
//   node test/v80-pixel-identity.mjs --check  outputs/pixel-baseline     (after it)
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
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

const argv = process.argv.slice(2);
const MODE = argv.includes('--save') ? 'save' : 'check';
const DIR = argv[argv.indexOf(MODE === 'save' ? '--save' : '--check') + 1];
if (!DIR) { console.log('  FAIL  no directory given'); process.exit(1); }
if (MODE === 'save') fs.mkdirSync(DIR, { recursive: true });
else if (!fs.existsSync(DIR)) {
  // A baseline that is not there must FAIL, never be silently created -- a check that regenerates
  // its own expected output is a check that always passes.
  console.log('  FAIL  no baseline at ' + DIR + ' -- run --save on the PREVIOUS build first');
  process.exit(1);
}

const BASE = 'http://127.0.0.1:8899/index.html';
const WIDTHS = [320, 360, 390];
// Noon on a fixed date, so "Sunday, Sep 13" and the clock in the header are the same every run.
const FROZEN = new Date('2026-09-13T12:00:00').getTime();
let pass = 0, fail = 0;
const t = (name, cond, detail) => {
  console.log('  ' + (cond ? 'PASS  ' : 'FAIL  ') + name + (detail ? '  |  ' + detail : ''));
  cond ? pass++ : fail++;
};

const browser = await chromium.launch();
const shots = [];
for (const width of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.addInitScript((frozen) => {
    // FROZEN BEFORE ANY APP CODE RUNS. The header prints the time; without this, two runs a minute
    // apart differ in every screenshot and the whole check becomes noise.
    const RealDate = Date;
    const D = function (...a) { return a.length ? new RealDate(...a) : new RealDate(frozen); };
    D.now = () => frozen;
    D.parse = RealDate.parse; D.UTC = RealDate.UTC;
    D.prototype = RealDate.prototype;
    window.Date = D;
  }, FROZEN);
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1600);
  await page.fill('input[placeholder="Enter patient name"]', 'Preview');
  await page.getByRole('button', { name: 'Female', exact: true }).click();
  await page.getByRole('button', { name: 'Chemo', exact: true }).click();
  await page.getByRole('button', { name: 'Get started' }).click();
  await page.waitForTimeout(900);
  const skip = page.getByRole('button', { name: 'Skip guide' });
  if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(600); }
  const got = page.getByRole('button', { name: 'Got it', exact: true });
  if (await got.count()) { await got.first().click(); await page.waitForTimeout(500); }

  for (const tab of ['Home', 'Meds', 'Reports', 'In-Patient', 'Symptoms']) {
    const btn = page.getByRole('button', { name: new RegExp('^' + tab) }).first();
    if (!(await btn.count())) continue;
    await btn.click();
    await page.waitForTimeout(800);
    const buf = await page.screenshot({ fullPage: true });
    shots.push({ name: tab.toLowerCase() + '-' + width + '.png', buf });

    // THE SUB-SCREENS, and leaving them out was a real hole rather than a scoping choice.
    // The first version captured only the five tabs. Changing `#E9D8D1` -- a border colour used
    // 89 times -- in its FIRST occurrence left the check 3/3 green, because that occurrence is in
    // the report-card helper, which only renders once a report row is opened. In a refactor that
    // edits fifteen hundred literals, the screens nobody captured are exactly where a wrong one
    // hides, and a check that passes on them teaches everyone to trust it.
    if (tab === 'Reports') {
      const rows = await page.getByRole('button').all();
      let opened = 0;
      for (const r of rows) {
        const label = ((await r.innerText().catch(() => '')) || '').trim();
        if (!/^(History|Weight|Blood Pressure|Bowel Movement|Appetite|Temperature)/.test(label)) continue;
        await r.click().catch(() => {});
        await page.waitForTimeout(650);
        shots.push({ name: 'report-' + label.split('\n')[0].toLowerCase().replace(/[^a-z]+/g, '-') +
          '-' + width + '.png', buf: await page.screenshot({ fullPage: true }) });
        await page.getByRole('button', { name: /^Reports/ }).first().click().catch(() => {});
        await page.waitForTimeout(600);
        if (++opened >= 4) break;
      }
    }
    if (tab === 'Meds') {
      // The medication editor is the longest screen in the app and carries colours nothing else does.
      const add = page.locator('[data-tour="meds-add"]');
      if (await add.count()) {
        await add.first().click();
        await page.waitForTimeout(700);
        shots.push({ name: 'med-editor-' + width + '.png', buf: await page.screenshot({ fullPage: true }) });
        const cancel = page.getByRole('button', { name: /^(Cancel|Back)/ });
        if (await cancel.count()) { await cancel.first().click(); await page.waitForTimeout(500); }
      }
    }
  }
  await ctx.close();
}
await browser.close();

// A suite that captured nothing would report "no differences" forever.
t('every screen was captured at every width', shots.length >= WIDTHS.length * 7,
  shots.length + ' screenshot(s)');

if (MODE === 'save') {
  for (const s of shots) fs.writeFileSync(path.join(DIR, s.name), s.buf);
  console.log('\n  saved ' + shots.length + ' baseline screenshots to ' + DIR);
  console.log('\n' + pass + '/' + (pass + fail) + ' checks passed' + (fail ? '  <-- FAIL' : ''));
  process.exit(fail ? 1 : 0);
}

let missing = 0, differ = [];
for (const s of shots) {
  const p = path.join(DIR, s.name);
  if (!fs.existsSync(p)) { missing++; continue; }
  if (!fs.readFileSync(p).equals(s.buf)) differ.push(s.name);
}
t('the baseline covers every screen this run captured', missing === 0, missing + ' missing');
t('NOT ONE PIXEL MOVED', differ.length === 0, differ.join(', ') || 'all ' + shots.length + ' identical');

console.log('\n' + pass + '/' + (pass + fail) + ' checks passed' + (fail ? '  <-- FAIL' : ''));
process.exit(fail ? 1 : 0);
