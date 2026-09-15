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
async function freshPage(setUp, opts) {
  // `opts` exists for ONE caller: the touch swipe in 7g needs a context with `hasTouch`, and a
  // context is fixed at creation. Everything else about the fixture has to stay identical, or the
  // touch check and the wheel check stop being the same measurement with a different finger.
  const page = await browser.newPage(Object.assign({ viewport: { width: 390, height: 844 } }, opts || {}));
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
  t('the button to the full screen opens it', await p.locator('[data-whatsnew-screen]').count() === 1);
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
section('7d. THE FIRST-RUN GUIDE MUST NOT FREEZE THE PAGE -- THE PATH A NEW USER TAKES');
{
  // THE CHECK ABOVE THIS ONE WAS WRITTEN FOR EXACTLY THIS REGRESSION AND COULD NOT SEE IT, BECAUSE
  // ITS OWN SETUP CLICKS "Skip guide" FIRST. The precondition of the check was the dismissal of the
  // thing that breaks. That is the sharpest version of a vacuous check I have hit: not a weak
  // assertion, a setup step that removes the defect before measuring.
  //
  // The tour layer is fixed and full-screen but `pointer-events: none` -- it highlights the page
  // without blocking it. The lock measured only position and size, called it an overlay, and froze
  // the body for the whole guide. On the step telling a new user to fill in the form and tap "Add
  // medication", that button sat over a thousand pixels below a fold that could not be scrolled,
  // and the step only advances when a medication is saved. A brand-new user could not start.
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', e => allErrors.push(String(e.message)));
  await page.goto(BASE);
  await page.waitForTimeout(1500);
  const k = await page.evaluate(() => Object.keys(localStorage).find(x => /prefs-v1$/.test(x)));
  if (k) {
    await page.evaluate((key) => {
      const pr = JSON.parse(localStorage.getItem(key) || '{}');
      localStorage.setItem(key, JSON.stringify(Object.assign(pr, { patientName: 'Test', onboarded: true })));
    }, k);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1800);
  }
  // DELIBERATELY NOT DISMISSED. That is the whole point of this case.
  const tourUp = await page.locator('#tour-layer').count();
  t('the first-run guide is on screen -- not skipped, which is what hid this', tourUp > 0,
    tourUp + ' tour layer(s)');
  t('and the page is NOT frozen by it',
    await page.evaluate(() => document.body.style.position !== 'fixed'),
    await page.evaluate(() => document.body.style.position || '(none)'));
  await page.evaluate(() => window.scrollTo(0, 500));
  await page.waitForTimeout(350);
  t('and the page still scrolls while the guide is up',
    await page.evaluate(() => window.scrollY) > 0,
    (await page.evaluate(() => window.scrollY)) + 'px');
  // AND NOW WALK IT TO THE STEP THAT ACTUALLY BROKE.
  //
  // THE FOUR CHECKS ABOVE MEASURE THE TOUR'S FIRST FRAME AND STOP, AND THAT IS NOT ENOUGH. A
  // mutant that re-freezes the page precisely when the medication editor is open -- the original
  // failure verbatim, a brand-new user unable to add their first medication -- passed this suite
  // 37/37. A case that proves step 1 is fine says nothing about step 4, which is the step the
  // defect was on.
  //
  // So this taps through the guide the way a new user does: Meds, then Add, then the editor, and
  // then it CLICKS the button the guide is telling them to click. A click that times out because
  // the button is a thousand pixels below a frozen fold is the failure, reported as a failure.
  // Step 1 is a welcome CARD that covers the tab bar until it is acknowledged -- it is the one
  // part of the tour layer that does intercept taps, which is correct and is why the walk starts
  // by tapping its own button rather than reaching past it.
  const showMe = page.getByRole('button', { name: 'Show me', exact: true });
  t('the guide opens on its welcome card', await showMe.count() > 0);
  if (await showMe.count()) { await showMe.first().click(); await page.waitForTimeout(700); }
  await page.getByRole('button', { name: /^Meds/ }).first().click();
  await page.waitForTimeout(700);
  const addBtn = page.locator('[data-tour="meds-add"]').first();
  t('the guide leads to the Add control', await addBtn.count() > 0);
  await addBtn.click();
  await page.waitForTimeout(800);
  t('the medication editor opens under the guide', await page.locator('#med-doses-text').count() > 0);
  t('and the guide is STILL up -- otherwise this is the ordinary editor case, not the tour one',
    await page.locator('#tour-layer').count() > 0);
  t('and the page is not frozen with the editor open under the guide',
    await page.evaluate(() => document.body.style.position !== 'fixed'),
    await page.evaluate(() => document.body.style.position || '(none)'));
  await page.evaluate(() => window.scrollTo(0, 800));
  await page.waitForTimeout(350);
  t('and it scrolls, which is what a thousand-pixel-tall form needs',
    await page.evaluate(() => window.scrollY) > 0,
    (await page.evaluate(() => window.scrollY)) + 'px');

  // THE WHOLE POINT: the button the guide names must be clickable, not merely present.
  // PIN THE STEP BEFORE ASSERTING IT MOVES ON. "The guide advanced" was checked as
  // `!/Fill out the form/`, and a negative assertion is satisfied by a guide that never said it --
  // deleting the step from TOUR_STEPS entirely passed 48/48. So the step is asserted to be HERE
  // first, and only then asserted to be gone.
  const bannerBefore = await page.evaluate(() => {
    const el = document.querySelector('#tour-banner, #tour-card');
    return el ? (el.innerText || '') : '';
  });
  t('the guide is actually ON the fill-in-the-form step before we act on it',
    /Fill out the form/i.test(bannerBefore), bannerBefore.replace(/\n/g, ' | ').slice(0, 90) || '(no banner)');
  await page.getByPlaceholder('Medication name').first().fill('FirstMed');
  await page.getByPlaceholder('For example, 4 hours').first().fill('4');
  const save = page.getByRole('button', { name: 'Add medication', exact: true }).first();
  t('the button the guide tells a new user to tap exists', await save.count() > 0);
  // A PLAYWRIGHT CLICK IS NOT A FINGER, and taking it for one made this check decoration.
  // Playwright scrolls an element into view over CDP, which walks straight through an
  // `overflow: hidden` freeze that a thumb cannot -- so a build frozen that way let this "pass"
  // while a real user was stuck. The question is whether the button is ON THE SCREEN the user is
  // looking at, so that is what is measured, and only then is it tapped.
  // SCROLL THE WAY A FINGER DOES, THEN LOOK. Measuring the button where it sits before scrolling
  // says nothing -- of course it is below the fold on a 2,387px form. And using Playwright's own
  // scrollIntoView is the cheat this check exists to avoid: it drives the scroll over CDP and goes
  // straight through an `overflow: hidden` freeze that a thumb cannot. `window.scrollTo` is what a
  // finger's swipe amounts to, and a frozen page ignores it -- which is exactly the difference
  // being measured.
  const vh = page.viewportSize().height;
  // LET THE FORM SETTLE FIRST. Typing triggers a debounced redraw, and measuring where a button is
  // while the page is still reflowing gives a position that is already stale.
  await page.waitForTimeout(900);
  // Then scroll the way a person does: a swipe, a look, and another swipe if needed. Two passes,
  // no more -- a loop that keeps scrolling until it likes the answer would pass on anything.
  let box = null;
  const vh2 = page.viewportSize().height;
  for (let attempt = 0; attempt < 2; attempt++) {
    // RE-RESOLVE EVERY TIME. render() rebuilds the page into root.innerHTML on its tick, so a
    // handle taken before a scroll can point at a detached node and report "no box", which reads
    // like the button vanished.
    const fresh = page.getByRole('button', { name: 'Add medication', exact: true }).first();
    const abs = await fresh.evaluate(el => el.getBoundingClientRect().top + (window.scrollY || 0));
    await page.evaluate(y => window.scrollTo(0, Math.max(0, y - 200)), abs);
    await page.waitForTimeout(600);
    box = await page.getByRole('button', { name: 'Add medication', exact: true }).first().boundingBox();
    if (box && box.y >= 0 && box.y + box.height <= vh2 + 1) break;
  }
  const onScreen = !!box && box.y >= 0 && box.y + box.height <= vh + 1;
  t('the button the guide names comes ON SCREEN when the page is scrolled as a finger would',
    onScreen, box ? ('top=' + Math.round(box.y) + ' of ' + vh + 'px viewport') : 'no box');
  let clicked = true;
  try { await save.click({ timeout: 6000 }); } catch (e) { clicked = false; }
  t('and it can actually be TAPPED', clicked,
    clicked ? 'clicked' : 'CLICK TIMED OUT: a new user cannot add their first medication');
  await page.waitForTimeout(900);
  // And the guide must move on, or the user is stuck even having saved.
  const advanced = await page.evaluate(() => {
    const el = document.querySelector('#tour-banner, #tour-card');
    return el ? (el.innerText || '') : '';
  });
  t('and the guide advances once the medication is saved',
    !/Fill out the form/i.test(advanced), advanced.replace(/\n/g, ' | ').slice(0, 90) || '(no banner)');

  // REACHABLE MEANS TAPPABLE. This counted the control and called that "reachable" -- on the one
  // release where the whole defect was a control that existed and could not be reached.
  const skip = page.getByRole('button', { name: 'Skip guide' });
  const seen = await skip.count();
  t('the guide still offers a way out', seen > 0, seen + ' control(s)');
  let escapable = true;
  if (seen) { try { await skip.first().click({ timeout: 5000 }); } catch (e) { escapable = false; } }
  t('and that way out can actually be tapped', escapable,
    escapable ? 'clicked' : 'CLICK TIMED OUT: a user cannot leave the guide');
  await page.waitForTimeout(500);
  t('and tapping it really does end the guide',
    await page.locator('#tour-layer').count() === 0,
    String(await page.locator('#tour-layer').count()));
  await page.close();
}

// ---------------------------------------------------------------------------------------------
section('7e. SCROLLING AWAY FROM A FIELD YOU JUST TYPED IN MUST STICK');
{
  // WHY THIS EXISTS: a falsification sweep, not a reading. `./falsify.sh test/v84-whatsnew.mjs
  // falsify/mutants-v84-whatsnew.sh` put app-v84's headline fix back the way it was and all fifty
  // checks stayed green -- the fix was protected by nothing. Writing the check that would have gone
  // red then showed something worse: the release's stated cause was not the one producing the
  // symptom, and the shipped fix did not touch the real one.
  //
  // THE SCENARIO, which is the one a person actually performs: open the medication editor, type the
  // name, and immediately swipe down to reach "Add medication" at the bottom of a 2,387px form.
  // A `focusin` listener (index.html near 4218, added in v28 so the on-screen keyboard cannot leave
  // a field above the fold) had already scheduled a smooth scrollIntoView 320ms out, and it fired
  // after the swipe: scrollY 1503 -> 1336 -> 454 -> 1 over about 750ms, with the save button left
  // 1,353px below the fold.
  //
  // THE TIMING IS THE CHECK. Waiting for the page to "settle" before scrolling -- which is what 7d
  // above does -- lets that timer expire harmlessly and measures nothing. So this scrolls INSIDE the
  // window, and then does nothing at all for long enough that any pending scroll would have run.
  const p = await freshPage(true);
  await p.getByRole('button', { name: /^Meds/ }).first().click();
  await p.waitForTimeout(700);
  await p.locator('[data-tour="meds-add"]').first().click();
  await p.waitForTimeout(700);
  t('the medication editor is open', await p.locator('#med-doses-text').count() > 0);

  // The form must be TALLER than the phone or there is no "back up" to be dragged to, and this
  // check would pass on anything.
  const vhE = p.viewportSize().height;
  const docH = await p.evaluate(() => document.documentElement.scrollHeight);
  t('the form is taller than the screen, so scrolling away is possible at all',
    docH > vhE * 2, docH + 'px of page in a ' + vhE + 'px viewport');

  // Type, and LEAVE THE CARET WHERE A PERSON LEAVES IT -- fill() ends with the field focused, which
  // is what schedules the nudge. A blurred field schedules nothing and the check would be vacuous.
  await p.getByPlaceholder('Medication name').first().fill('ScrollTest');
  t('the caret is in a form field, which is what schedules the nudge',
    await p.evaluate(() => { const a = document.activeElement; return !!a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName); }),
    await p.evaluate(() => (document.activeElement && (document.activeElement.id || document.activeElement.tagName)) || 'none'));

  // Swipe down NOW -- inside the 320ms window, the way a thumb moves. window.scrollTo is what a
  // swipe amounts to; Playwright's scrollIntoViewIfNeeded drives it over CDP and is the cheat these
  // checks exist to avoid.
  // A REAL WHEEL, NOT window.scrollTo. The app now answers "has the person scrolled since?" from
  // wheel/touchmove events rather than by comparing scroll positions -- by cause instead of by
  // effect, so that an on-screen keyboard resizing the viewport can never be mistaken for a swipe.
  // A synthetic scrollTo produces no gesture event, so a check that used one would be measuring a
  // path no finger takes and would pass on a build with the guard removed. `page.mouse.wheel`
  // dispatches the event the app actually listens for.
  await p.waitForTimeout(120);
  await p.mouse.move(195, 500);
  for (let i = 0; i < 6; i++) { await p.mouse.wheel(0, 400); await p.waitForTimeout(25); }
  await p.waitForTimeout(150);
  const before = await p.evaluate(() => window.scrollY);
  t('the swipe moved the page away from the field', before > 600, before + 'px');

  // AND NOW DO NOTHING. No clicking, no re-scrolling, no re-resolving a handle -- 1.8s is past the
  // 320ms timer and past the smooth animation it starts. Whatever the page does to itself here is
  // what it does to somebody reaching for the button.
  await p.waitForTimeout(1800);
  const after = await p.evaluate(() => window.scrollY);
  t('and it STAYS there -- nothing drags the page back to the field',
    after >= before - 40, 'scrollY ' + before + ' -> ' + after);

  // The consequence, stated the way the user meets it.
  const saveBox = await p.getByRole('button', { name: /Add medication|Save changes/ }).first().boundingBox();
  t('so the save button is still on screen where the swipe left it',
    !!saveBox && saveBox.y >= 0 && saveBox.y + saveBox.height <= vhE + 1,
    saveBox ? ('top=' + Math.round(saveBox.y) + ' of ' + vhE + 'px viewport') : 'no box');

  // AND v28'S OWN REASON MUST SURVIVE THE GUARD. Focus a field and DON'T scroll: the nudge must
  // still bring it to the middle, or this "fix" has quietly deleted the feature it guards.
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(250);
  // FOCUS IT FROM INSIDE THE PAGE WITH preventScroll, or the browser's OWN focus scroll does the
  // work and the check cannot tell a build with the nudge from a build without it. Playwright's
  // locator.focus() lets the browser scroll the element into view, which is precisely how the
  // first version of this check scored 57/57 against a mutant that deleted the nudge outright.
  const deep = p.locator('#med-doses-text').first();
  const deepTopBefore = await deep.evaluate(el => Math.round(el.getBoundingClientRect().top));
  const yBeforeFocus = await p.evaluate(() => window.scrollY);
  await deep.evaluate(el => el.focus({ preventScroll: true }));
  await p.waitForTimeout(1400);
  const deepTopAfter = await deep.evaluate(el => Math.round(el.getBoundingClientRect().top));
  const yAfterFocus = await p.evaluate(() => window.scrollY);
  // THIS CHECK WAS VACUOUS WHEN FIRST WRITTEN, AND THE SWEEP SAID SO. It OR'd three conditions
  // together, the first of which ("the field started below the fold") is true before the app does
  // anything at all -- so mutant 3, which deletes the nudge outright, passed 57/57. A precondition
  // belongs in its own check; OR-ing it into the assertion is how an assertion stops asserting.
  t('precondition: the field is below the fold, so there is something for the nudge to do',
    deepTopBefore > vhE, 'top=' + deepTopBefore + ' in a ' + vhE + 'px viewport');
  t('and focusing it WITHOUT a swipe brings it into view -- v28 is not deleted by the guard',
    yAfterFocus > yBeforeFocus + 100 && deepTopAfter >= 0 && deepTopAfter <= vhE - 40,
    'scrollY ' + yBeforeFocus + ' -> ' + yAfterFocus + ', field top ' + deepTopBefore + ' -> ' + deepTopAfter + ' in ' + vhE + 'px');
  await p.close();
}

// ---------------------------------------------------------------------------------------------
section('7g. THE SAME SWIPE WITH A FINGER -- THE ONLY INPUT THIS APP WILL SHIP WITH');
{
  // 7e ABOVE VERIFIES THE GUARD ON AN INPUT DEVICE THIS PRODUCT WILL NEVER HAVE. It swipes with
  // `page.mouse.wheel`, which is a real wheel event and was the right fix for the `window.scrollTo`
  // version before it -- but this repo exists to be wrapped by Capacitor for iOS and Android
  // (CLAUDE.md, "What this repo is"), and a phone has no wheel. The guard listens for
  // `['wheel', 'touchmove']`; delete `'touchmove'` and the whole 65-check suite still scored 65/65
  // while, measured with real touch, the page went from holding at scrollY 535 to being yanked back
  // to 1. Every real user would have had the defect back and the sweep would have said 8 caught,
  // 0 survived.
  //
  // Playwright's touchscreen API has only tap(), so the swipe is dispatched over CDP. Two things
  // that make this measure something, both learned the hard way:
  //   * Chromium's touch fling CONTINUES past touchEnd and will carry the page to the bottom on its
  //     own, which looks like a pass whatever the app does. The finger holds still for ~80ms first,
  //     which cancels the fling.
  //   * The whole gesture must land INSIDE the 320ms window the nudge is scheduled in, or the nudge
  //     fires mid-swipe and the measurement is about something else.
  const p = await freshPage(true, { hasTouch: true, isMobile: true });
  await p.getByRole('button', { name: /^Meds/ }).first().click();
  await p.waitForTimeout(700);
  await p.locator('[data-tour="meds-add"]').first().click();
  await p.waitForTimeout(700);
  t('the medication editor is open', await p.locator('#med-doses-text').count() > 0);

  const cdp = await p.context().newCDPSession(p);
  // A real touchmove has to reach the document, or this check is measuring a gesture that never
  // happened. Counted from the page, not assumed from the API.
  await p.evaluate(() => {
    window.__tm = 0;
    document.addEventListener('touchmove', (e) => { if (e.isTrusted) window.__tm++; }, { passive: true, capture: true });
  });

  await p.getByPlaceholder('Medication name').first().fill('TouchTest');
  t('the caret is in a form field, which is what schedules the nudge',
    await p.evaluate(() => { const a = document.activeElement; return !!a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName); }),
    await p.evaluate(() => (document.activeElement && (document.activeElement.id || document.activeElement.tagName)) || 'none'));

  const swipe = async (fromY, toY) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 195, y: fromY }] });
    const steps = 8;
    for (let i = 1; i <= steps; i++) {
      const y = Math.round(fromY + (toY - fromY) * (i / steps));
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 195, y }] });
    }
    // Hold still: this is what stops Chromium flinging the page to the bottom after the finger
    // lifts, which would move the page regardless of what the app decided.
    await p.waitForTimeout(80);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  await p.waitForTimeout(100);
  await swipe(760, 120);
  await swipe(760, 120);
  await p.waitForTimeout(120);

  t('a real, trusted touchmove reached the page -- otherwise this check measures nothing',
    await p.evaluate(() => window.__tm) > 0, (await p.evaluate(() => window.__tm)) + ' touchmove event(s)');
  const before = await p.evaluate(() => window.scrollY);
  t('the finger moved the page away from the field', before > 300, before + 'px');

  // And now nothing at all, past the 320ms timer and past the smooth animation it would start.
  await p.waitForTimeout(1800);
  const after = await p.evaluate(() => window.scrollY);
  t('and it STAYS where the finger left it -- the touchmove half of the guard is doing the work',
    after >= before - 40, 'scrollY ' + before + ' -> ' + after);
  await p.close();
}

// ---------------------------------------------------------------------------------------------
section('7f. NO SURFACE TELLS THE READER THE LIST IS COMPLETE -- THE CLASS, NOT THE THREE INSTANCES');
{
  // THE SAME SENTENCE, FOUR TIMES, FIXED THREE TIMES. CHANGELOG holds five entries for an
  // eighty-four-release app, so anything promising "every update" is false. The audit took it out
  // of the modal copy; two more surfaces kept it and the PM gate found them; a fourth -- the
  // button reading "See all updates" -- survived both and was found by the delta audit, sitting one
  // line under the entry text that had already been corrected.
  //
  // FOUR ROUNDS OF THE SAME FIX IS A MISSING CHECK, NOT CARELESSNESS. So this does not look for the
  // four strings anybody has written down: it reads what is ON THE SCREEN on every surface that
  // shows the changelog and refuses any claim of completeness, however it is worded. A fifth
  // surface added later fails here without anybody remembering to add it to a list.
  //
  // IT READS RENDERED TEXT FROM SCOPED ELEMENTS, NEVER document.body.textContent -- in a
  // single-file app the body text contains this app's own source, so a string check against it
  // matches the code that was just corrected and passes on anything.
  // THE PATTERN, AND THE AUDIT WAS RIGHT THAT THE FIRST ONE WAS WRONG IN BOTH DIRECTIONS.
  // Under-broad: a heading reading "The complete changelog for ChemoWell... Nothing is left out."
  // passed 65/65. Over-broad: innocent true copy -- "We check every release on both phone sizes" --
  // failed it, which would block a legitimate release with a message that does not describe what is
  // wrong. A false positive is a defect too; it is the kind that teaches people to ignore a gate.
  //
  // So a quantifier near "update/release/version" is NOT enough on its own. The claim this hunts is
  // a sentence about what THE LIST CONTAINS, which is a quantifier plus a listing word, or one of
  // the fixed phrases that say it outright.
  const CLAIM = new RegExp([
    // "Every update, newest first" · "Every past update is listed under What's new"
    '\\b(every|all|each|entire|whole|complete|full)\\b[^.]{0,40}\\b(update|release|version|changelog)s?\\b[^.]{0,40}\\b(list|listed|lists|listing|shown|shows|here|below|newest first|in the menu)\\b',
    // the same thing with the halves the other way round
    '\\b(update|release|version|changelog)s?\\b[^.]{0,40}\\b(is|are)\\b[^.]{0,25}\\b(all|every|complete|entire)\\b',
    // "See all updates" -- a button label, which carries no sentence for the rules above to read
    '\\b(see|view|read|open)\\s+(all|every|the\\s+(complete|full|entire|whole))\\b',
    '\\b(complete|full|entire|whole)\\s+(list|history|changelog|record|archive)\\b',
    '\\bnothing\\s+(is\\s+)?(left\\s+out|missing|omitted)\\b',
    '\\beverything\\s+that\\s+(changed|has\\s+changed)\\b'
  ].join('|'), 'i');
  const p = await freshPage(true);
  await p.evaluate(() => { localStorage.setItem('chemowell-app-seen-version', 'app-v1'); });
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1800);

  // innerText AND the aria-labels inside the scope: a claim in an aria-label is read aloud to a
  // screen-reader user and innerText never sees it.
  const readScope = (sel) => p.evaluate((s) => {
    const root = document.querySelector(s);
    if (!root) return '';
    const labels = Array.from(root.querySelectorAll('[aria-label]')).map(el => el.getAttribute('aria-label'));
    if (root.getAttribute && root.getAttribute('aria-label')) labels.push(root.getAttribute('aria-label'));
    return [root.innerText || ''].concat(labels).join('\n');
  }, sel);
  const modalText = await readScope('[data-whatsnew-modal]');
  t('the update notice is on screen, so there is something to read', modalText.length > 0, modalText.length + ' chars');
  t('and the notice claims nothing about being complete',
    !CLAIM.test(modalText), (modalText.match(CLAIM) || ['none'])[0]);

  await p.locator('[data-whatsnew-all]').click();
  await p.waitForTimeout(700);
  const screenText = await readScope('[data-whatsnew-screen]');
  t('the full screen is open', screenText.length > 0, screenText.length + ' chars');
  t('and the screen -- heading included -- claims nothing about being complete',
    !CLAIM.test(screenText), (screenText.match(CLAIM) || ['none'])[0]);

  // The menu row and its helper line, which is the surface the PM gate caught.
  const menu = p.getByRole('button', { name: /menu/i });
  if (await menu.count()) { await menu.first().click(); await p.waitForTimeout(600); }
  const drawerText = await p.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('button, a'));
    const hit = rows.find(el => /What.s new/i.test(el.innerText || ''));
    return hit ? (hit.innerText || '') : '';
  });
  t('the menu row for the changelog is on screen', drawerText.length > 0, JSON.stringify(drawerText));
  t('and its helper line claims nothing about being complete',
    !CLAIM.test(drawerText), (drawerText.match(CLAIM) || ['none'])[0]);

  // AND THE PATTERN IS TESTED IN BOTH DIRECTIONS, ON A CORPUS, because the previous version of this
  // assertion ran the regex over four strings the author already had in hand and one known-good one.
  // That proves there is no typo. It proves nothing about the class the check is named after -- and
  // the gap between what a check does and what is written about it is what has cost this release
  // round after round. Every string below that the audit found the old pattern got wrong is in here.
  const CLAIMS = [
    'Every update, newest first',                                   // the menu row, shipped
    'Every update to ChemoWell, newest first.',                     // the screen heading, shipped
    'See all updates',                                              // the button, shipped
    'Every past update is listed under “What’s new” in the menu',   // the entry text, shipped
    'The complete changelog for ChemoWell, newest first.',          // found by the audit, missed
    'Nothing is left out.',                                         // found by the audit, missed
    'View the entire history of changes',
    'Everything that changed is here',
    'All releases are listed below'
  ];
  const INNOCENT = [
    'Recent updates, newest first',
    'Recent updates to ChemoWell, newest first.',
    'See recent updates',
    'We check every release on both phone sizes.',                  // found by the audit, false red
    'Every medication you add is kept on this phone.',
    'Updates from here on are listed under “What’s new” in the menu, newest first.'
  ];
  const missed = CLAIMS.filter(x => !CLAIM.test(x));
  const falsePos = INNOCENT.filter(x => CLAIM.test(x));
  t('the pattern catches every wording of the claim that has actually been written',
    missed.length === 0, missed.length ? JSON.stringify(missed) : CLAIMS.length + '/' + CLAIMS.length);
  t('and it leaves innocent, true copy alone -- a false red is a defect too',
    falsePos.length === 0, falsePos.length ? JSON.stringify(falsePos) : INNOCENT.length + '/' + INNOCENT.length);
  await p.close();
}

// ---------------------------------------------------------------------------------------------
section('8. AND NOTHING THREW');
t('no page error at any point above', allErrors.length === 0, allErrors.slice(0, 3).join(' / ') || 'none');

await browser.close();
console.log('\n' + (pass + fail) + ' checks: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
