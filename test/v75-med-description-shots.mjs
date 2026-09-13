// v75: what the description actually looks like on a medication card, at every phone width.
//
// AARON, 2026-09-12: "I need to see what the text box looks like in the app."
//
// This is the Designer pass for app-v75 and it is also the answer to a question -- so the
// medications it adds are chosen to show the whole range rather than a happy path: the shortest
// sentence in the table, a middling one, the longest one, and one the guards REJECTED so the app
// falls back to its own hand-written line and the link stays a search rather than a citation.
//
// 320 / 360 / 390 because that is the Designer's brief. This sandbox has Chromium only: an iPhone's
// rendering cannot be reproduced here and the two real phones are still the last word.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = (() => {
  const _p = require('node:path');
  const tries = ['playwright',
    _p.join(_p.dirname(process.execPath), '..', 'lib', 'node_modules', 'playwright'),
    '/opt/node22/lib/node_modules/playwright',
    '/home/claude/.npm-global/lib/node_modules/playwright'];
  for (const c of tries) { try { return require(c); } catch (e) {} }
  throw new Error('playwright not found; tried:\n  ' + tries.join('\n  '));
})();

const BASE = 'http://127.0.0.1:8899/index.html';
const OUT = 'outputs/v75-shots';
fs.mkdirSync(OUT, { recursive: true });

// shortest quoted / middling quoted / longest quoted / rejected-so-falls-back
const MEDS = ['Buspirone', 'Ondansetron', 'Cyclophosphamide', 'Dexamethasone'];

let fail = 0;
const browser = await chromium.launch();

for (const width of [320, 360, 390]) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
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
  await page.waitForTimeout(500);

  for (const name of MEDS) {
    // The Meds screen's own control is labelled just "Add"; "Add medication" is the SAVE button at
    // the bottom of the editor it opens. Getting those two the wrong way round is what made the
    // first run of this suite sit for thirty seconds waiting for a button that was never on screen.
    await page.locator('[data-tour="meds-add"]').first().click();
    await page.waitForTimeout(400);
    await page.getByPlaceholder('Medication name').first().fill(name);
    // An "as needed" medication will not save without a minimum gap -- saveMedicationEditor toasts
    // and returns. The first run of this suite clicked Save four times, got four toasts nobody was
    // reading, and reported "0 of 4 medications show a description" as if the feature were broken.
    await page.getByPlaceholder('For example, 4 hours').first().fill('4');
    await page.waitForTimeout(200);
    await page.getByRole('button', { name: 'Add medication', exact: true }).first().click();
    await page.waitForTimeout(600);
  }

  await page.screenshot({ path: `${OUT}/v75-meds-collapsed-${width}.png`, fullPage: true });

  // expand every one that has a control, so the open state is on the record too
  const toggles = page.locator('[data-med-purpose-toggle]');
  const n = await toggles.count();
  for (let i = 0; i < n; i++) await toggles.nth(i).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/v75-meds-expanded-${width}.png`, fullPage: true });

  // ---- the checks, not just the pictures -------------------------------------------------------
  const seen = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('[data-med-purpose]')) {
      const card = el.closest('article');
      const link = card && card.querySelector('[data-med-source]');
      const btn = card && card.querySelector('[data-med-purpose-toggle]');
      out.push({
        name: card ? (card.querySelector('div') || {}).innerText : '',
        text: el.innerText,
        clipped: el.scrollHeight > el.clientHeight + 1,
        linkText: link ? link.innerText.trim() : null,
        linkHref: link ? link.getAttribute('href') : null,
        btnH: btn ? Math.round(btn.getBoundingClientRect().height) : null,
        btnW: btn ? Math.round(btn.getBoundingClientRect().width) : null,
        rowW: btn ? Math.round(btn.parentElement.getBoundingClientRect().width) : null,
        linkW: link ? Math.round(link.getBoundingClientRect().width) : null,
        sameRow: (btn && link) ? Math.abs(btn.getBoundingClientRect().top - link.getBoundingClientRect().top) < 4 : null,
        linkH: link ? Math.round(link.getBoundingClientRect().height) : null
      });
    }
    return { rows: out, scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth };
  });

  // EVERY .every() BELOW IS TRUE ON AN EMPTY LIST. The first run of this suite added no medications
  // at all and still reported three of these as PASS -- clipping, toggle height and link height all
  // "passed" over zero rows. Nothing after this point may run until there is something to look at.
  if (seen.rows.length !== MEDS.length) {
    console.log('  FAIL  [' + width + '] the screen has ' + seen.rows.length + ' descriptions on it, expected ' +
      MEDS.length + ' -- every check below would pass vacuously, so none of them ran');
    fail++;
    await ctx.close();
    continue;
  }
  const t = (label, cond, detail) => {
    console.log('  ' + (cond ? 'PASS  ' : 'FAIL  ') + `[${width}] ` + label + (detail ? '  |  ' + detail : ''));
    if (!cond) fail++;
  };
  // THE CDN FAILURES ARE DELIBERATELY EXEMPT AND NAMED. Four Capacitor libraries load from
  // cdn.jsdelivr.net on every app open -- pre-existing, unrelated to this release, and unreachable
  // from this sandbox, which has no outbound network. Filtering them by MESSAGE rather than by count
  // means a real error appearing alongside them is still caught; an exemption nobody wrote down is
  // indistinguishable from an oversight.
  const cdnNoise = /ERR_TUNNEL_CONNECTION_FAILED|ERR_FAILED|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CERT_AUTHORITY_INVALID|jsdelivr/;
  const real = errors.filter(e => !cdnNoise.test(e));
  t('no console or page errors, apart from the sandbox\'s blocked CDN', real.length === 0, real.join(' | '));
  t('the page does not scroll sideways', seen.scrollW <= seen.clientW + 1, seen.scrollW + ' > ' + seen.clientW);
  // EXPANDED means nothing is clipped. A "Show less" control over text that is still cut off is the
  // worst of both: it looks like all of it and is not.
  t('expanded, nothing is still clipped', seen.rows.every(r => !r.clipped),
    seen.rows.filter(r => r.clipped).map(r => r.text.slice(0, 30)).join(' | '));
  // Every touch target at the iOS floor, measured after layout rather than asserted from the style.
  t('every toggle is at least 44px tall', seen.rows.every(r => r.btnH === null || r.btnH >= 44),
    seen.rows.map(r => r.btnH).join(','));
  t('the expander and the link share one row where they fit',
    seen.rows.every(r => r.sameRow === null || r.sameRow === true),
    seen.rows.filter(r => r.sameRow === false).map(r => 'btn ' + r.btnW + ' + link ' + r.linkW + ' in ' + r.rowW).join(' | '));
  t('every source link is at least 44px tall', seen.rows.every(r => r.linkH === null || r.linkH >= 44),
    seen.rows.map(r => r.linkH).join(','));
  // THE CITATION RULE. "Read it on" may only appear over text that came from that exact page.
  const quoted = seen.rows.filter(r => /^Read it on/.test(r.linkText || ''));
  const search = seen.rows.filter(r => /^Look it up on/.test(r.linkText || ''));
  t('a quoted description links to its own MedlinePlus page, not a search',
    quoted.length > 0 && quoted.every(r => /\/druginfo\/meds\//.test(r.linkHref || '')),
    quoted.map(r => r.linkHref).join(' | '));
  t('a description this app wrote links to a SEARCH and never claims to be quoted',
    search.length > 0 && search.every(r => /\/search\//.test(r.linkHref || '')),
    search.map(r => r.linkText + ' -> ' + r.linkHref).join(' | '));
  t('Dexamethasone fell back to the app\'s own line, because MedlinePlus\'s was off topic',
    seen.rows.some(r => /adrenal glands/.test(r.text)) === false,
    seen.rows.map(r => r.text.slice(0, 40)).join(' | '));

  await ctx.close();
}

await browser.close();
console.log('\nshots in ' + OUT + (fail ? '\n' + fail + ' CHECKS FAILED' : '\nall checks passed'));
process.exit(fail ? 1 : 0);
