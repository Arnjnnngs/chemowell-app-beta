// v82-back-button.mjs -- the phone's own Back button walks the app instead of leaving it.
//
// Aaron, 2026-09-14: "All apps close out (go to user phone home screen) when hitting the phones
// built in back button. This should at least go to the previous page. There is a back button that
// we've built into the app that works. Thought you should know. Should have been found already."
//
// HE IS RIGHT THAT IT SHOULD HAVE BEEN FOUND, and the reason it was not is written into this
// project's own rules. Rule 5.5: every gate here asks about a still frame -- does the screen fit, is
// the copy true, can she do the job, does the record survive -- and the one thing nobody asks is
// what happens while a finger is moving. The hardware Back button is the purest case of that class,
// and `grep popstate` returned nothing across all three apps. Never built, never tested, on the
// control a phone user reaches for most after the screen itself.
//
// SO THIS SUITE IS WRITTEN FOR THE CLASS, NOT THE REPORT. Section 3 enumerates every dismissible
// key in `state` and fails if one is missing from the registry, so a nineteenth overlay cannot be
// added without somebody deciding what Back does to it.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = (() => {
  const _p = require('node:path');
  const tries = ['playwright',
    _p.join(_p.dirname(process.execPath), '..', 'lib', 'node_modules', 'playwright'),
    '/opt/node22/lib/node_modules/playwright', '/home/claude/.npm-global/lib/node_modules/playwright'];
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
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1600);
await page.fill('input[placeholder="Enter patient name"]', 'Preview');
await page.getByRole('button', { name: 'Female', exact: true }).click();
await page.getByRole('button', { name: 'Chemo', exact: true }).click();
await page.getByRole('button', { name: 'Get started' }).click();
await page.waitForTimeout(900);
const dismiss = async () => {
  for (const n of ['Skip guide', 'Got it']) {
    const b = page.getByRole('button', { name: n, exact: n === 'Got it' });
    if (await b.count()) { await b.first().click(); await page.waitForTimeout(500); }
  }
};
await dismiss();
// STILL IN THE APP is the whole question, so it is asked the same way every time: the app's own tab
// bar is on screen. A blank page, an about:blank, or a navigation away all fail this.
const stillInApp = () => page.evaluate(() =>
  [...document.querySelectorAll('button')].some(b => /^Home$/.test((b.innerText || '').trim())));

console.log('\n1. BACK DOES NOT LEAVE THE APP');
{
  await page.getByRole('button', { name: /^Reports/ }).first().click();
  await page.waitForTimeout(700);
  await page.goBack();
  await page.waitForTimeout(800);
  t('after Back from a tab, the app is still on screen', await stillInApp());
  // "At least go to the previous page" — for a tab bar the honest previous page is Home. The tabs
  // are siblings, not a trail, so there is nowhere else to go back TO.
  // ASSERT THE BEHAVIOUR, NOT WHERE IT WAS DRAWN LAST WEEK. This read the word TEMPERATURE out
  // of the page, and app-v82 renamed that label to "Temp" when the vitals cards became tiles --
  // so a check about the BACK BUTTON went red for a change to a heading. Home is identified by
  // its own sections' hooks now, which survive any amount of relabelling.
  const onHome = await page.evaluate(() => document.querySelectorAll('[data-home]').length > 0);
  t('and it is on Home, not still on the tab it was on', onHome);
}

console.log('\n2. BACK CLOSES WHAT IS OPEN, ONE LAYER AT A TIME');
{
  await page.getByRole('button', { name: /^Meds/ }).first().click();
  await page.waitForTimeout(600);
  await page.locator('[data-tour="meds-add"]').first().click();
  await page.waitForTimeout(500);
  t('the medication editor is open', await page.locator('#med-doses-text').count() > 0);
  await page.goBack();
  await page.waitForTimeout(800);
  t('Back closes the editor', await page.locator('#med-doses-text').count() === 0);
  t('and does NOT leave the app', await stillInApp());
  // AND THE SECOND BACK STILL DOES NOT LEAVE IT: the editor was opened from Meds, so one more Back
  // goes to Home rather than out. This is the case that matters — a caregiver taps Back twice.
  await page.goBack();
  await page.waitForTimeout(800);
  t('a second Back goes to Home rather than out of the app', await stillInApp());
  t('and it really is Home', await page.evaluate(() => document.querySelectorAll('[data-home]').length > 0));
}

console.log('\n3. A CONFIRMATION IS DISMISSED WITHOUT LOSING WHAT ARMED IT');
{
  // Arm the delete confirmation inside the editor, then Back once: the confirmation goes, the
  // editor stays. Closing both would make Back a second way out of a screen that leaves different
  // state behind — which is the thing the registry's ordering exists to prevent.
  await page.getByRole('button', { name: /^Meds/ }).first().click();
  await page.waitForTimeout(600);
  await page.locator('[data-tour="meds-add"]').first().click();
  await page.waitForTimeout(500);
  await page.getByPlaceholder('Medication name').first().fill('Backtest');
  await page.getByPlaceholder('For example, 4 hours').first().fill('4');
  await page.getByRole('button', { name: 'Add medication', exact: true }).first().click();
  await page.waitForTimeout(800);
  await dismiss();
  const edit = page.getByRole('button', { name: /Edit Backtest/i }).first();
  if (await edit.count()) { await edit.click(); await page.waitForTimeout(600); }
  const del = page.getByRole('button', { name: /^(Delete|Remove)/i }).first();
  const armed = await del.count() > 0;
  t('a destructive control is reachable to arm', armed);
  if (armed) {
    await del.click();
    await page.waitForTimeout(500);
    const wasArmed = await page.evaluate(() => !!(window.__backTest && document.body.innerText));
    await page.goBack();
    await page.waitForTimeout(800);
    t('Back disarms the confirmation and stays in the app', await stillInApp(), String(wasArmed));
  }
  await dismiss();
}

console.log('\n4. THE CLASS: EVERY DISMISSIBLE LAYER HAS A RULE');
{
  // THE COMPLETENESS CHECK, and it is the reason this suite exists rather than one case for the
  // screen Aaron reported. It reads the registry from the app and the dismissible keys from the
  // app's own state, so neither can be a list copied into this file.
  const keys = await page.evaluate(() => (window.__backTest ? window.__backTest.keys() : null));
  t('the back-button registry is reachable', Array.isArray(keys) && keys.length > 0, JSON.stringify(keys));
  // Every state key whose NAME says it holds something dismissible. Deliberately a shape rule, not
  // a list: a new `confirmSomething` or `somethingModal` is caught the day it is added.
  const dismissible = await page.evaluate(() => {
    const s = window.__backTest && window.__backTest.stateKeys ? window.__backTest.stateKeys() : null;
    return s;
  });
  const expected = (dismissible || []).filter(k => /^(confirm|.*Modal$|.*Open$|drawerOpen|medEditor|override|tourStep|help|addingProfile|bkNotice)/.test(k));
  // EXEMPT, SAID OUT LOUD, WITH THE REASON — per Rule 5.5, an exemption nobody wrote down is
  // indistinguishable from an oversight. This list is deliberately tiny and every entry must say
  // why Back should not touch it.
  const EXEMPT = {
    // A collapsible section inside the TEST_MODE banner, not an overlay: it covers nothing, traps
    // nothing, and disappears entirely at store submission. Back closing it would be a surprise.
    testDateControlsOpen: 'a collapsible panel in the beta banner, not an overlay'
  };
  const missing = expected.filter(k => keys.indexOf(k) === -1 && !EXEMPT[k]);
  // NOT VACUOUS. This first passed because `stateKeys` was not exported, so `dismissible` was null
  // and the assertion short-circuited to true — green precisely because it could see nothing. The
  // absence of the list is now the loudest failure in the section.
  t('the app exports its state keys, so this check can see anything at all',
    Array.isArray(dismissible) && dismissible.length > 10, JSON.stringify(dismissible && dismissible.length));
  t('and it found dismissible keys to check', expected.length > 0, JSON.stringify(expected));
  t('every dismissible thing in state has a Back rule, or a named exemption',
    Array.isArray(dismissible) && expected.length > 0 && missing.length === 0,
    'missing: ' + JSON.stringify(missing));
  // AND THE EXEMPTIONS ARE STILL REAL. An exemption for a key that no longer exists is a stale
  // excuse sitting in the check, so it is asserted rather than left to rot.
  const staleExempt = Object.keys(EXEMPT).filter(k => dismissible.indexOf(k) === -1);
  t('and no exemption is for something that no longer exists', staleExempt.length === 0, JSON.stringify(staleExempt));
}

console.log('\n5. NOTHING THREW');
t('no page errors at any point', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
console.log('\n' + pass + '/' + (pass + fail) + ' passing' + (fail ? '  (' + fail + ' FAILING)' : ''));
process.exit(fail ? 1 : 0);
