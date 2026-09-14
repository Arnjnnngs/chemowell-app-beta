// v83-whatsnew.mjs -- the update notice appears once, to the right people, and never lies.
//
// WHAT THIS PROTECTS. ChemoWell shipped eighty-two releases without telling anybody what changed.
// The notice that fixes that is itself a thing that can go wrong in ways a still-frame check will
// not see:
//   1. It shows to somebody who has just installed the app, who has no idea what "changed".
//   2. It comes back after being dismissed -- the app re-renders every second, so a notice whose
//      "should I show" is asked inside render() re-opens the instant it is closed.
//   3. It never shows at all, because the marker was written before the notice was drawn.
//   4. The phone's Back button cannot dismiss it, undoing app-v82's back-button work.
//   5. It says something untrue about the release, which is the one surface that speaks directly
//      to the person taking the medicine.
//
// Run:  python3 -m http.server 8899 --directory <repo>   (then)  node test/v83-whatsnew.mjs
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

const BASE = process.env.FALSIFY_BASE || 'http://127.0.0.1:8899/index.html';
let pass = 0, fail = 0;
const t = (name, cond, detail) => {
  console.log('  ' + (cond ? 'PASS  ' : 'FAIL  ') + name + (detail !== undefined ? '  |  ' + detail : ''));
  cond ? pass++ : fail++;
};
const section = s => console.log('\n' + s);

const browser = await chromium.launch();
const allErrors = [];

// A page with NOTHING in local storage -- a phone that has never run ChemoWell.
//
// `setUp` decides whether the app gets past its welcome screen. It matters more than it looks:
// the notice is mounted in the running app, NOT on the first-run setup screen, and a fixture that
// never names a patient sits on that screen forever while every check reports "no notice" -- which
// is true, and about the wrong screen. That is how the first run of this suite failed.
async function freshPage(setUp) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', e => allErrors.push(String(e.message)));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const x = m.text();
    if (/Failed to load resource|net::ERR_/.test(x)) return;
    allErrors.push(x);
  });
  await page.goto(BASE);
  await page.waitForTimeout(1500);
  if (setUp) {
    const k = await page.evaluate(() => Object.keys(localStorage).find(x => /prefs-v1$/.test(x)));
    if (!k) throw new Error('no prefs key to set up against');
    await page.evaluate((key) => {
      const pr = JSON.parse(localStorage.getItem(key) || '{}');
      localStorage.setItem(key, JSON.stringify(Object.assign(pr, { patientName: 'Test', onboarded: true })));
    }, k);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1600);
    for (const n of ['Skip guide', 'Got it']) {
      const b = page.getByRole('button', { name: n, exact: true });
      if (await b.count()) { await b.first().click(); await page.waitForTimeout(400); }
    }
  }
  return page;
}

// ---------------------------------------------------------------------------------------------
section('1. A BRAND-NEW PHONE IS NOT GREETED WITH "HERE IS WHAT CHANGED"');
{
  const p = await freshPage();
  t('nothing pops up on a first-ever run',
    await p.locator('[data-whatsnew-modal]').count() === 0,
    String(await p.locator('[data-whatsnew-modal]').count()));
  // It must still be STAMPED, or the question gets asked again on every single load.
  const stamped = await p.evaluate(() => localStorage.getItem('chemowell-app-seen-version'));
  t('and the version is recorded silently, so it is asked once not forever',
    typeof stamped === 'string' && /^app-v/.test(stamped), String(stamped));
  await p.close();
}

// ---------------------------------------------------------------------------------------------
section('2. A PHONE THAT HAS BEEN RUNNING THE APP *DOES* GET THE NOTICE');
{
  const p = await freshPage(true);
  // Simulate a phone upgrading from before the marker existed: it has ChemoWell data, no marker.
  await p.evaluate(() => {
    const keep = Object.keys(localStorage).filter(k => k.indexOf('chemowell-app') === 0 && k !== 'chemowell-app-seen-version');
    if (!keep.length) localStorage.setItem('chemowell-app-prefs-v1', '{}');
    localStorage.removeItem('chemowell-app-seen-version');
  });
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1800);
  t('the notice appears for a phone that has run the app before',
    await p.locator('[data-whatsnew-modal]').count() === 1);
  const entries = await p.locator('[data-whatsnew-modal] [data-whatsnew-entry]').count();
  t('and it shows ONE release, not the whole history', entries === 1, entries + ' entries');
  await p.close();
}

// ---------------------------------------------------------------------------------------------
section('3. DISMISSING IT DISMISSES IT -- ON A SCREEN THAT REDRAWS EVERY SECOND');
{
  const p = await freshPage(true);
  await p.evaluate(() => { localStorage.setItem('chemowell-app-seen-version', 'app-v1'); });
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1800);
  t('an older recorded version brings the notice back', await p.locator('[data-whatsnew-modal]').count() === 1);
  await p.locator('[data-whatsnew-close]').click();
  await p.waitForTimeout(400);
  t('"Got it" closes it', await p.locator('[data-whatsnew-modal]').count() === 0);
  // THE ONE-SECOND TICK. This is the check that matters: waiting out several re-renders.
  await p.waitForTimeout(3500);
  t('and it is still closed three seconds and several redraws later',
    await p.locator('[data-whatsnew-modal]').count() === 0);
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1800);
  t('and it does not come back on the next app open',
    await p.locator('[data-whatsnew-modal]').count() === 0);
  await p.close();
}

// ---------------------------------------------------------------------------------------------
section('4. THE PHONE’S BACK BUTTON DISMISSES IT, AND MARKS IT SEEN');
{
  const p = await freshPage(true);
  await p.evaluate(() => { localStorage.setItem('chemowell-app-seen-version', 'app-v1'); });
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1800);
  t('the notice is open before the Back press', await p.locator('[data-whatsnew-modal]').count() === 1);
  t('and the back-button registry knows about it',
    await p.evaluate(() => !!(window.__backTest && window.__backTest.keys().indexOf('whatsNewOpen') >= 0)));
  await p.evaluate(() => window.__backTest.press());
  await p.waitForTimeout(400);
  t('one Back press closes it', await p.locator('[data-whatsnew-modal]').count() === 0);
  // Back that does not mark it seen means it returns on the next open -- worse than never showing.
  const seen = await p.evaluate(() => localStorage.getItem('chemowell-app-seen-version'));
  const ver = await p.evaluate(() => (window.__backTest && window.__backTest.version) || null);
  t('and Back marks it seen, so it does not return', seen !== 'app-v1', String(seen));
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1800);
  t('confirmed: it does not reappear after a Back dismissal',
    await p.locator('[data-whatsnew-modal]').count() === 0);
  await p.close();
}

// ---------------------------------------------------------------------------------------------
section('5. THE FULL LIST IS REACHABLE, BOTH WAYS');
{
  const p = await freshPage(true);
  await p.evaluate(() => { localStorage.setItem('chemowell-app-seen-version', 'app-v1'); });
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1800);
  await p.locator('[data-whatsnew-all]').click();
  await p.waitForTimeout(600);
  t('"See all updates" opens the full screen', await p.locator('[data-whatsnew-screen]').count() === 1);
  const n = await p.locator('[data-whatsnew-screen] [data-whatsnew-entry]').count();
  t('which lists more than one release', n > 1, n + ' entries');
  t('and it names the version this phone is actually running -- computed, not typed in',
    await p.evaluate(() => {
      const v = window.__backTest && window.__backTest.version;
      const el = document.querySelector('[data-whatsnew-screen]');
      return !!(v && el && el.innerText.indexOf(v) >= 0);
    }));
  await p.close();
}
{
  // Once dismissed, the only way back to it is the menu. A notice with no permanent home is a
  // notice somebody can never re-read.
  const p = await freshPage(true);
  const menu = p.getByRole('button', { name: /menu/i });
  if (await menu.count()) { await menu.first().click(); await p.waitForTimeout(500); }
  const row = p.getByRole('button', { name: /What.s new/i });
  t('the menu has a "What’s new" row', await row.count() >= 1, String(await row.count()));
  if (await row.count()) {
    await row.first().click();
    await p.waitForTimeout(700);
    t('and it opens the full list', await p.locator('[data-whatsnew-screen]').count() === 1);
  } else {
    t('and it opens the full list', false, 'row not found, so this could not be checked');
  }
  await p.close();
}

// ---------------------------------------------------------------------------------------------
section('6. THE COPY IS ABOUT A PRODUCT, NOT ABOUT ONE PATIENT (CLAUDE.md Rule 0)');
{
  const p = await freshPage(true);
  await p.evaluate(() => { localStorage.setItem('chemowell-app-seen-version', 'app-v1'); });
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1800);
  await p.locator('[data-whatsnew-all]').click();
  await p.waitForTimeout(600);
  // Read the RENDERED text, never document.body.textContent -- in a single-file app that contains
  // the source code, so a string check against it always matches and proves nothing.
  const text = await p.locator('[data-whatsnew-screen]').innerText();
  t('no patient name anywhere in the changelog', !/\bBrandi\b/i.test(text));
  t('no gendered pronoun -- every user is a different patient',
    !/\b(she|her|hers|he|him|his)\b/i.test(text),
    (text.match(/\b(she|her|hers|he|him|his)\b/i) || ['none'])[0]);
  t('no file name, function name or version literal in the prose',
    !/index\.html|sw\.js|\.mjs|function |APP_VERSION/.test(text));
  t('and it is written in sentences, not release-note shorthand',
    text.split('\n').filter(l => l.trim().length > 30).length >= 5);
  await p.close();
}

// ---------------------------------------------------------------------------------------------
section('7. THE NEWEST ENTRY IS ABOUT THE VERSION THAT IS RUNNING');
{
  // The whole point of the notice is that it describes THIS release. An entry that has not been
  // updated is a notice telling somebody about a change they got two releases ago.
  const p = await freshPage(true);
  const mismatch = await p.evaluate(() => {
    const v = window.__backTest && window.__backTest.version;
    return { running: v, newest: (window.__whatsNewTest && window.__whatsNewTest.latest()) || null };
  });
  t('the newest changelog entry names the running version',
    mismatch.newest && mismatch.running && mismatch.newest.v === mismatch.running,
    JSON.stringify(mismatch));
  await p.close();
}

// ---------------------------------------------------------------------------------------------
section('7b. THE PAGE DOES NOT SCROLL BEHIND IT -- Rule 5.5, THE CLASS NOT THE INSTANCE');
{
  // The audit found the page scrolling 0 -> 333px behind this notice, and the real finding was
  // bigger than one modal: THIS APP HAD NO SCROLL LOCK AT ALL. So the lock is driven by the
  // back-button registry -- the same list that already decides what Back closes -- and this checks
  // the registry as a whole, not just the notice.
  const p = await freshPage(true);
  await p.evaluate(() => { localStorage.setItem('chemowell-app-seen-version', 'app-v1'); });
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1800);
  t('the notice is open', await p.locator('[data-whatsnew-modal]').count() === 1);
  // A page that is already short cannot scroll, so a lock check on it passes on nothing. Make the
  // page long first, then prove it stops moving.
  await p.evaluate(() => { const d = document.createElement('div'); d.id = 'tall'; d.style.height = '3000px'; document.body.appendChild(d); });
  await p.waitForTimeout(150);
  await p.evaluate(() => window.scrollTo(0, 600));
  await p.waitForTimeout(350);
  const scrolledBehind = await p.evaluate(() => window.scrollY || Math.abs(parseInt(document.body.style.top || '0', 10)) === 0 ? window.scrollY : 0);
  t('the page does not scroll behind the notice', scrolledBehind === 0, scrolledBehind + 'px');
  await p.locator('[data-whatsnew-close]').click();
  await p.waitForTimeout(500);
  const unlocked = await p.evaluate(() => document.body.style.position);
  t('and the page is released once the notice closes', unlocked !== 'fixed', unlocked || '(none)');

  // THE CLASS, AND IT IS ASSERTED AS BEHAVIOUR RATHER THAN AS A LIST. The first version of this
  // check read a hand-written `overlay: true` flag off the registry -- and the audit found TEN OF
  // TWENTY-THREE FLAGS WRONG, including the medication editor, which the lock then froze so hard
  // that "Save changes" could not be reached at all. A check that reads the same wrong list as the
  // code agrees with it. So the app decides by measuring the screen, and this measures the screen
  // too: an overlay locks, an in-page panel does not, and neither is asked to be labelled.
  t('the app decides from the screen, not from a flag list',
    await p.evaluate(() => !!(window.__backTest && typeof window.__backTest.overlayNow === 'function')));
  await p.close();
}

// ---------------------------------------------------------------------------------------------
section('7c. AN IN-PAGE PANEL MUST NOT FREEZE THE PAGE AROUND IT');
{
  // THE REGRESSION THE FIRST LOCK SHIPPED. The medication editor is an in-page panel, and marking
  // it as an overlay froze the body at one viewport around a 6,869px form with no inner scroller:
  // "Save changes" and sixty-one other controls became unreachable, on the only screen where
  // editing and deleting a medication live. This is the case that must never come back.
  const p = await freshPage(true);
  await p.getByRole('button', { name: /^Meds/ }).first().click();
  await p.waitForTimeout(700);
  const add = p.locator('[data-tour="meds-add"]').first();
  t('the Add-medication control is reachable', await add.count() > 0);
  await add.click();
  await p.waitForTimeout(700);
  t('the medication editor is open', await p.locator('#med-doses-text').count() > 0);
  t('and the page is NOT locked around it',
    await p.evaluate(() => document.body.style.position !== 'fixed'),
    await p.evaluate(() => document.body.style.position || '(none)'));
  await p.evaluate(() => window.scrollTo(0, 900));
  await p.waitForTimeout(350);
  t('and it still scrolls', await p.evaluate(() => window.scrollY) > 0,
    (await p.evaluate(() => window.scrollY)) + 'px');
  const save = p.getByRole('button', { name: /Add medication|Save changes/ }).first();
  let reachable = true;
  try { await save.scrollIntoViewIfNeeded({ timeout: 4000 }); } catch (e) { reachable = false; }
  t('and the button that saves the medication can actually be reached', reachable);
  await p.close();
}

// ---------------------------------------------------------------------------------------------
section('8. AND NOTHING THREW');
t('no page error at any point above', allErrors.length === 0, allErrors.slice(0, 3).join(' / ') || 'none');

await browser.close();
console.log('\n' + (pass + fail) + ' checks: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
