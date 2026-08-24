// Lead Developer self-verification for app-v57's browser first-run notice, driven through the real
// rendered UI at both mobile widths.
//
// Run:  python3 -m http.server 8899 --directory <repo>   (then)
//       env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy node test/v57-browser-notice.mjs
//
// Two environment facts, recorded so the next person doesn't rediscover them:
//  1. index.html is a single <script type="module">, so NOTHING it declares is reachable from
//     page.evaluate(). Every behavioural check here goes through the rendered UI, as a user would.
//  2. This sandbox injects HTTPS_PROXY, which Chromium picks up and then fails on for 127.0.0.1.
//     Clear the proxy vars for the node process and use 127.0.0.1 rather than localhost. The CDN
//     <script> tags (Capacitor) cannot load here; that is a sandbox artifact, filtered explicitly
//     below rather than ignored silently.
//
// WHAT THIS FILE IS FOR. Aaron is sharing the beta as a plain HTTPS URL months before either store
// listing exists. The notice exists because a browser tab is not the phone app and one of the
// differences can cost a tester everything they logged: iOS Safari erases a site's saved data after
// seven days without a visit, and a Home Screen install is the documented exemption. A notice that
// silently stops appearing is therefore a data-loss defect, not a cosmetic one, so the checks below
// are written to be able to FAIL -- each one names the exact string it looks for and each dismissal
// path is exercised separately and then re-checked after a full reload.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
// Playwright's location is environment-specific: the old sandbox kept it under a user-global npm
// prefix, this one ships it alongside node. Resolving a LIST of candidates instead of one pinned
// absolute path is what lets the same suite run in both. The pinned path made all 39 browser
// suites in these three repos unrunnable the moment the environment changed -- a gate that cannot
// start is indistinguishable from a gate that passes, which is the failure Rule 5 is about.
const { chromium } = (() => {
  const _p = require('node:path');
  const tries = ['playwright',
    _p.join(_p.dirname(process.execPath), '..', 'lib', 'node_modules', 'playwright'),
    '/opt/node22/lib/node_modules/playwright',
    '/home/claude/.npm-global/lib/node_modules/playwright'];
  for (const c of tries) { try { return require(c); } catch (e) {} }
  throw new Error('playwright not found; tried:\n  ' + tries.join('\n  '));
})();
const fs = require('fs');

const BASE = 'http://127.0.0.1:8899/index.html';
let fail = 0;
const t = (name, cond, detail) => { console.log((cond ? 'PASS  ' : 'FAIL  ') + name + (detail ? '  |  ' + detail : '')); if (!cond) fail++; };
const isSandboxNoise = (s) => /ERR_CERT_AUTHORITY_INVALID|ERR_TUNNEL_CONNECTION_FAILED|ERR_PROXY|cdn\.jsdelivr\.net|Failed to load resource/i.test(s);

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
function codeOnly(s) { return s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' '); }
const code = codeOnly(html);

// ---------- source-level: the gates that keep it off the native build ----------
t('the notice is gated on !isNativeApp()', /function browserNoticeDue\(\)[\s\S]{0,260}!isNativeApp\(\)/.test(code));
t('the notice is gated on the first-run guide being finished (state.tourStep == null)',
  /function browserNoticeDue\(\)[\s\S]{0,260}state\.tourStep == null/.test(code));
t('the notice waits for prefs to load, so it cannot flash before browserNoticeSeen is known',
  /function browserNoticeDue\(\)[\s\S]{0,260}state\.prefsLoaded/.test(code));
// Persistence must go through setPrefsDB (on-device prefs), not setState alone -- setState alone
// would make it reappear on the next reload, which is the whole defect the flag exists to prevent.
t('dismissal writes browserNoticeSeen to on-device prefs',
  /async function dismissBrowserNotice\(\)[\s\S]{0,200}setPrefsDB\(\{ browserNoticeSeen: true \}\)/.test(code));
t('the prefs subscriber reads browserNoticeSeen back into state',
  /browserNoticeSeen: !!prefs\.browserNoticeSeen/.test(code));
t('browserNoticeSeen has an initial value in state (undefined would be a silent falsy)',
  /browserNoticeSeen: false/.test(code));
// iPadOS 13+ reports a desktop Macintosh UA; without the touch-points check every iPad would be
// handed the Android instructions.
t('iPad-on-desktop-UA is detected via maxTouchPoints, not the UA string alone',
  /function isIOSDevice\(\)[\s\S]{0,320}maxTouchPoints/.test(code));
t('installed-PWA detection checks BOTH display-mode and iOS navigator.standalone',
  /function isInstalledPWA\(\)[\s\S]{0,300}display-mode: standalone[\s\S]{0,200}navigator\.standalone === true/.test(code));

// ---------- the manifest a tester actually sees under the Home Screen icon ----------
const man = JSON.parse(fs.readFileSync(new URL('../manifest.webmanifest', import.meta.url), 'utf8'));
t('manifest no longer describes the app as chemo-only', !/chemo/i.test(man.description), man.description);
t('manifest still states the on-device promise', /stays on your device/i.test(man.description));
t('manifest short_name is short enough for a Home Screen label', (man.short_name || '').length <= 12, man.short_name);

const browser = await chromium.launch();

async function firstRun(page) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);
  await page.fill('input[placeholder="Enter patient name"]', 'Test Patient');
  await page.getByRole('button', { name: 'Female', exact: true }).click();
  await page.getByRole('button', { name: 'Chemo', exact: true }).click();
  await page.getByRole('button', { name: 'Get started' }).click();
  await page.waitForTimeout(900);
}
const overflowOf = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const bodyText = (page) => page.evaluate(() => document.body.innerText || '');

for (const vp of [{ name: '360px', width: 360, height: 800 }, { name: '390px', width: 390, height: 844 }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error' && !isSandboxNoise(m.text())) errs.push(m.text()); });
  page.on('pageerror', e => { if (!isSandboxNoise(e.message)) errs.push('pageerror: ' + e.message); });
  const L = (s) => '[' + vp.name + '] ' + s;

  await firstRun(page);

  // --- it must NOT compete with the first-run guide
  let body = await bodyText(page);
  const guideUp = /GUIDE/.test(body);
  t(L('the first-run guide is showing, and the notice is not on top of it'),
    !guideUp || !/web preview/i.test(body), guideUp ? 'guide up' : 'guide not shown');

  const skip = page.getByRole('button', { name: 'Skip guide' });
  if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(700); }

  // --- it appears once the guide is done
  body = await bodyText(page);
  t(L('the notice appears on Home after the guide'), /You’re using the web preview|You're using the web preview/.test(body),
    body.slice(0, 120).replace(/\n/g, ' | '));
  t(L('it names the Home Screen step, which is the data-loss one'), /Add it to your Home Screen/.test(body));
  t(L('it says reminders need the page open'), /Reminders need this page open/.test(body));
  t(L('it says exports download rather than sharing'), /Exports download instead of sharing/.test(body));
  t(L('it repeats the on-device promise'), /stays on this device/.test(body));
  t(L('no horizontal overflow with the notice on screen'), (await overflowOf(page)) <= 0, 'overflow=' + (await overflowOf(page)) + 'px');

  // Chromium on Linux reports a desktop UA, so the Android wording is the expected branch here.
  // Asserting WHICH branch rendered proves the two are actually wired to isIOSDevice() rather than
  // one of them being dead code that never renders. Designer S4: the REASON has to branch with the
  // instruction -- the first cut showed Android testers a paragraph about Safari and called it "the
  // one that matters", which is the only stated reason to act and does not apply to them.
  t(L('the non-iOS install wording is the branch that rendered'), /Open your browser menu, then Add to Home screen/.test(body),
    (body.match(/Tap Share[^.]*\.|Open your browser menu[^.]*\./) || ['(neither branch found)'])[0]);
  t(L('S4 the Safari-specific reason is NOT shown to a non-iOS tester'), !/Safari/.test(body),
    (body.match(/.{0,60}Safari.{0,60}/) || [''])[0]);

  // --- Designer M1: the card has to fit a phone. It measured 919px at 360 and 1,121px at 320,
  // with a 207px text column. Both the height and the column are asserted, because fixing only the
  // structure (which widens the column) would leave a card that is still taller than the screen.
  const cardMetrics = await page.evaluate(() => {
    const el = [...document.querySelectorAll('div')].find(d => /You’re using the web preview|A couple of things about the browser version/.test(d.innerText || '') && d.parentElement && !/You’re using the web preview|A couple of things/.test(d.parentElement.innerText.slice(0, 0) || ''));
    const card = [...document.querySelectorAll('div')].filter(d => (d.innerText || '').indexOf('Everything you log stays on this device.') >= 0 && (d.innerText || '').indexOf('Got it') >= 0).pop();
    if (!card) return null;
    const body = [...card.querySelectorAll('div')].find(d => /A browser can’t wake a locked phone/.test(d.innerText || ''));
    return { h: Math.round(card.getBoundingClientRect().height), col: body ? Math.round(body.getBoundingClientRect().width) : 0, vh: window.innerHeight };
  });
  t(L('M1 the notice card is found for measurement'), !!cardMetrics, JSON.stringify(cardMetrics));
  t(L('M1 the card is under 620px tall (was 919 at 360, 1122 at 320)'), cardMetrics && cardMetrics.h < 620,
    cardMetrics ? cardMetrics.h + 'px, viewport ' + cardMetrics.vh : 'n/a');
  t(L('M1 body copy runs the full card width (was a 207px column)'), cardMetrics && cardMetrics.col >= 250,
    cardMetrics ? cardMetrics.col + 'px column' : 'n/a');

  // --- every control is a real 44px target (Designer M2: the ✕ was 28x28)
  const btnSizes = await page.evaluate(() => {
    const labels = ['Got it', 'More about the web version', 'Dismiss'];
    return labels.map(l => {
      const el = [...document.querySelectorAll('button')].find(b => (b.innerText || '').trim() === l || b.getAttribute('aria-label') === l);
      if (!el) return { l, h: 0, w: 0, found: false };
      const r = el.getBoundingClientRect();
      return { l, h: Math.round(r.height), w: Math.round(r.width), found: true };
    });
  });
  t(L('all three notice controls exist'), btnSizes.every(b => b.found), JSON.stringify(btnSizes));
  t(L('M2 every control including the ✕ meets the 44px floor'),
    btnSizes.every(b => b.h >= 44 && b.w >= 44), JSON.stringify(btnSizes));

  // --- Designer S3: the read-more control must deep-link to the page that answers the card, and
  // must NOT dismiss -- the person who taps it because they want to read more was previously the
  // only person who could never get the card back.
  await page.getByRole('button', { name: 'More about the web version' }).first().click();
  await page.waitForTimeout(800);
  body = await bodyText(page);
  t(L('S3 read-more deep-links to rem-web-vs-app, not the Help landing'),
    /web browser, not the installed app/.test(body) && !/Find and fix a problem/.test(body),
    body.slice(0, 110).replace(/\n/g, ' | '));
  t(L('S3 the deep-linked page carries the 7-day detail moved out of the card'), /7 days without a visit/.test(body));
  // A walkthrough page's eyebrow is its CATEGORY, not the section name -- that is the breadcrumb the
  // v55 design intended. The section eyebrow this release rewrote is asserted on the Help landing in
  // test/v55-help.mjs, which is where a person arriving from the menu row actually lands.
  t(L('the deep-linked walkthrough shows its category as the eyebrow'), /Reminders & notifications/i.test(body));

  // Back to Home: the notice must STILL be there, because reading more is not dismissing.
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /^Home$/.test((x.innerText || '').trim())); if (b) b.click(); });
  await page.waitForTimeout(800);
  body = await bodyText(page);
  t(L('S3 reading more did NOT dismiss the notice'), /web preview/i.test(body), body.slice(0, 110).replace(/\n/g, ' | '));
  // R2-B (Auditor, round 2): this used to tap "Got it" from an unscrolled page, so scrollY was
  // already 0 and the assertion stayed green with scrollToTop() deleted -- the identical shape to the
  // v56 defect that measured scroll while the panel was suppressed. Scroll first, and prove the
  // scroll took, so the check has something to undo.
  await page.evaluate(() => window.scrollTo(0, 400));
  await page.waitForTimeout(300);
  const scrolledTo = await page.evaluate(() => window.scrollY);
  t(L('S2 precondition: the page really is scrolled before dismissing'), scrolledTo > 200, 'scrollY=' + scrolledTo);
  await page.getByRole('button', { name: 'Got it' }).first().click();
  await page.waitForTimeout(600);
  body = await bodyText(page);
  t(L('"Got it" then dismisses it'), !/web preview/i.test(body));
  t(L('S2 dismissing returns the viewport to the top of Home'),
    (await page.evaluate(() => window.scrollY)) === 0, 'scrollY=' + (await page.evaluate(() => window.scrollY)));

  // --- and it stays gone across a full reload (the setPrefsDB path, not just in-memory state).
  // The app persists the last view, so a reload here lands back on Help -- where the notice never
  // renders anyway. Navigating to Home FIRST is what makes this assertion able to fail; the earlier
  // version of it passed on the Help screen and would have passed with the flag never written.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /^Home$/.test((x.innerText || '').trim())); if (b) b.click(); });
  await page.waitForTimeout(700);
  body = await bodyText(page);
  t(L('reloaded, back on Home, the notice does not come back'),
    /journal/i.test(body) && !/web preview/i.test(body), body.slice(0, 100).replace(/\n/g, ' | '));

  t(L('no app console errors through the whole flow (CDN/proxy noise excluded)'), errs.length === 0, errs.slice(0, 3).join(' | '));
  await ctx.close();
}

// --- the X path, in its own fresh profile, so it is proved independently of the "Got it" path
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await firstRun(page);
  const skip = page.getByRole('button', { name: 'Skip guide' });
  if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(700); }
  let body = await bodyText(page);
  t('[X path] the notice is showing before the X is tapped', /web preview/i.test(body));
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.getAttribute('aria-label') === 'Dismiss'); if (b) b.click(); });
  await page.waitForTimeout(600);
  body = await bodyText(page);
  t('[X path] the X dismisses the notice', !/web preview/i.test(body));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  body = await bodyText(page);
  t('[X path] it stays dismissed after a reload', !/web preview/i.test(body));
  await ctx.close();
}

// --- the "Got it" path, also in its own fresh profile
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await firstRun(page);
  const skip = page.getByRole('button', { name: 'Skip guide' });
  if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(700); }
  await page.getByRole('button', { name: 'Got it' }).first().click();
  await page.waitForTimeout(600);
  let body = await bodyText(page);
  t('[Got it path] "Got it" dismisses the notice', !/web preview/i.test(body));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  body = await bodyText(page);
  t('[Got it path] it stays dismissed after a reload', !/web preview/i.test(body));
  // And the rest of Home is intact behind where it was -- a card that removes itself by breaking
  // the render below it would pass every check above.
  t('[Got it path] Home still renders its journal section after dismissal', /journal/i.test(body), body.slice(0, 140).replace(/\n/g, ' | '));
  await ctx.close();
}

// --- V57-1 (Auditor, High): the search-results safety strip, driven through the real UI.
// The Auditor typed real emergencies into this box and got app pages back with nothing on screen
// saying the app holds no medical information. The strip is unconditional, so this walks a
// frightening query, an ordinary query, and a query that returns nothing, and requires the sentence
// and the one-tap route on all three.
{
  const ctx = await browser.newContext({ viewport: { width: 360, height: 800 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => { if (!isSandboxNoise(e.message)) errs.push(e.message); });
  await firstRun(page);
  const skip = page.getByRole('button', { name: 'Skip guide' });
  if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(700); }
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /^Got it$/.test((x.innerText || '').trim())); if (b) b.click(); });
  await page.waitForTimeout(500);
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => (x.getAttribute('aria-label') || '') === 'Open menu'); if (b) b.click(); });
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /Help & FAQ/ }).first().click();
  await page.waitForTimeout(700);

  const typeQuery = async (q) => {
    // A walkthrough page has no search box. Come back to the Help centre first, so this helper works
    // from wherever the previous step left us rather than timing out on a missing selector.
    if (!(await page.locator('#help-search').count())) {
      await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /^Back to search|^Back/.test((x.innerText || '').trim())); if (b) b.click(); });
      await page.waitForTimeout(600);
    }
    if (!(await page.locator('#help-search').count())) {
      await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => (x.getAttribute('aria-label') || '') === 'Open menu'); if (b) b.click(); });
      await page.waitForTimeout(400);
      await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /Help & FAQ/.test(x.innerText || '')); if (b) b.click(); });
      await page.waitForTimeout(600);
    }
    await page.locator('#help-search').click();
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(150);
    await page.locator('#help-search').click();
    await page.keyboard.type(q, { delay: 18 });
    await page.waitForTimeout(500);
    return bodyText(page);
  };

  for (const q of ['she collapsed', 'she is coughing up blood', 'export to excel', 'zzzqqqwww']) {
    const b = await typeQuery(q);
    t('V57-1 ["' + q + '"] the care-team sentence is on screen', /holds no medical information/.test(b),
      b.slice(0, 90).replace(/\n/g, ' | '));
    t('V57-1 ["' + q + '"] the one-tap route to the care-team page is on screen',
      /When to call the care team straight away/.test(b));
  }

  // The strip must be ABOVE the results, not below them -- only about four rows fit above the fold
  // at 360px, so a strip under the list is a strip nobody sees.
  {
    await typeQuery('she collapsed');
    const order = await page.evaluate(() => {
      const all = [...document.querySelectorAll('div, section, button')];
      const strip = all.filter(e => /holds no medical information/.test(e.innerText || ''))
        .sort((x, y) => (x.innerText || '').length - (y.innerText || '').length)[0];
      const row = all.find(e => e.tagName === 'BUTTON' && /vanished|nothing happens|Home/.test(e.innerText || '') && e.closest('section'));
      if (!strip || !row) return null;
      return { strip: Math.round(strip.getBoundingClientRect().top), row: Math.round(row.getBoundingClientRect().top) };
    });
    t('V57-1 the strip sits above the first result row', order && order.strip < order.row, JSON.stringify(order));
  }

  // And the route actually lands on the emergency page.
  await typeQuery('she collapsed');
  await page.getByRole('button', { name: 'When to call the care team straight away' }).first().click();
  await page.waitForTimeout(700);
  {
    const b = await bodyText(page);
    t('V57-1 the route lands on sym-severe', /something new and frightening is happening/i.test(b),
      b.slice(0, 110).replace(/\n/g, ' | '));
    t('V57-1 sym-severe still opens with the call-now heading', /Contact your care team/.test(b));
  }

  // The capped list must still tell the truth about how many matched.
  await typeQuery('she is coughing up blood');
  {
    const b = await bodyText(page);
    t('V57-1 a capped result set reports the true total', /The closest 12 of \d+ matches/.test(b),
      (b.match(/The closest[^\n]*|\d+ results/) || ['(no count line)'])[0]);
  }

  // Designer S8: the new page must NOT wear the red call-now treatment.
  await typeQuery('will she lose her hair');
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /Side effects/.test(x.innerText || '')); if (b) b.click(); });
  await page.waitForTimeout(700);
  {
    const b = await bodyText(page);
    t('S8 the side-effects page uses the calm "Ask your care team" heading',
      /Ask your care team/.test(b) && !/Contact your care team/.test(b), b.slice(0, 110).replace(/\n/g, ' | '));
    // Read the colour off the SAME element the urgent pages use, and require it to be found --
    // `border === null` would otherwise satisfy `!== red` and this would pass with the callout gone
    // entirely. That is the exact hollow-assertion shape the v56 Lead Auditor found three of.
    const border = await page.evaluate(() => {
      const el = [...document.querySelectorAll('div, section')].filter(d => /Ask your care team/.test(d.innerText || '') && getComputedStyle(d).borderLeftWidth === '4px')
        .sort((x, y) => (x.innerText || '').length - (y.innerText || '').length)[0];
      return el ? getComputedStyle(el).borderLeftColor : null;
    });
    t('S8 the calm callout is actually rendered (a missing one must not pass this)', border !== null, String(border));
    t('S8 its callout is the amber attention tone, not the urgent red',
      border !== null && border !== 'rgb(192, 69, 59)', String(border));
  }

  t('V57-1 no page errors through the whole search flow', errs.length === 0, errs.slice(0, 2).join(' | '));
  await ctx.close();
}

// --- installed-PWA branch. display-mode is not settable from Playwright's page API on this build,
// so this is asserted at source level rather than claimed as a UI pass: the check is that the two
// branches differ and that the installed one drops the instruction instead of repeating it.
{
  const inst = (code.match(/const homeScreenPoint = installed\s*\n?\s*\?\s*\['([^']+)'/) || [])[1] || '';
  t('the installed-PWA branch has its own headline, not the instruction',
    inst.length > 0 && !/Add it to your Home Screen/.test(inst), inst || '(branch not found)');
  // Designer S5: the installed branch used to keep "You're using the web preview" and "Three things
  // need the phone app" over a first point saying nothing was needed -- it stated three and listed a
  // confirmation. Title and intro must branch too, and the intro must say two.
  t('S5 the installed branch has its own title', /installed \? 'A couple of things about the browser version' : 'You’re using the web preview'/.test(code));
  t('S5 the installed branch says TWO things differ, not three',
    /installed \? 'Everything works, and your log is already safe\. Two things still behave differently here:'/.test(code));
}

// ---------- Designer round 2: the search-results screen against the REAL usable height ----------
// R2D-1 was raised because the strip pushed 0 of 12 result rows -- and the empty state's advice line
// -- under the 69px FIXED BOTTOM NAV. The nav is the thing that makes this measurable and is exactly
// what the earlier clearance figures missed: they treated the fold as the viewport edge. Every
// measurement here subtracts the nav, and the strip is required to leave a legible result row.
{
  for (const vp of [{ name: '320px', width: 320, height: 720 }, { name: '360px', width: 360, height: 720 }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    const L = (s) => '[' + vp.name + '] ';
    await firstRun(page);
    const skip = page.getByRole('button', { name: 'Skip guide' });
    if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(700); }
    // R2D-2: the browser notice IS the greeting on a first browser run; the "Welcome to ChemoWell"
    // toast used to paint across its privacy line and the top of its primary button.
    t(L() + 'R2D-2 no welcome toast competes with the notice on a first browser run',
      (await page.evaluate(() => !!document.querySelector('[role="status"]'))) === false);
    const noticeGeom = await page.evaluate(() => {
      const card = [...document.querySelectorAll('div')].filter(d => (d.innerText || '').includes('Everything you log stays on this device.') && (d.innerText || '').includes('Got it')).pop();
      const got = [...document.querySelectorAll('button')].find(b => (b.innerText || '').trim() === 'Got it');
      const nav = [...document.querySelectorAll('nav, div')].filter(d => getComputedStyle(d).position === 'fixed' && d.getBoundingClientRect().bottom >= window.innerHeight - 2 && d.getBoundingClientRect().height > 40).pop();
      return { card: card ? Math.round(card.getBoundingClientRect().height) : 0,
        gotTop: got ? Math.round(got.getBoundingClientRect().top) : 0,
        navTop: nav ? Math.round(nav.getBoundingClientRect().top) : 0 };
    });
    t(L() + 'R2D-5 the notice\'s primary action is above the bottom nav on first paint',
      noticeGeom.gotTop > 0 && noticeGeom.navTop > 0 && noticeGeom.gotTop < noticeGeom.navTop, JSON.stringify(noticeGeom));

    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /^Got it$/.test((x.innerText || '').trim())); if (b) b.click(); });
    await page.waitForTimeout(400);
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => (x.getAttribute('aria-label') || '') === 'Open menu'); if (b) b.click(); });
    await page.waitForTimeout(300);
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /Help & FAQ/.test(x.innerText || '')); if (b) b.click(); });
    await page.waitForTimeout(600);
    await page.locator('#help-search').click();
    await page.keyboard.type('reminder', { delay: 10 });
    await page.waitForTimeout(500);
    const g = await page.evaluate(() => {
      const strip = [...document.querySelectorAll('section')].find(e => /holds no medical information/.test(e.innerText || ''));
      const nav = [...document.querySelectorAll('nav, div')].filter(d => getComputedStyle(d).position === 'fixed' && d.getBoundingClientRect().bottom >= window.innerHeight - 2 && d.getBoundingClientRect().height > 40).pop();
      const first = [...document.querySelectorAll('button')].find(b => /reminder/i.test(b.innerText || '') && b.getBoundingClientRect().height > 40 && b.getBoundingClientRect().top > 300);
      const navTop = nav ? nav.getBoundingClientRect().top : window.innerHeight;
      return { stripH: strip ? Math.round(strip.getBoundingClientRect().height) : 0,
        stripBg: strip ? getComputedStyle(strip).backgroundColor : null,
        firstTop: first ? Math.round(first.getBoundingClientRect().top) : 0,
        navTop: Math.round(navTop), visible: first ? Math.round(navTop - first.getBoundingClientRect().top) : 0 };
    });
    t(L() + 'R2D-1 the strip is under 200px (was 235 at 320, 216 at 360)', g.stripH > 0 && g.stripH < 200, JSON.stringify(g));
    // The two title lines of a result row occupy its first ~47px. Requiring 50px of visible row is
    // the Designer's own accepted bar: title fully legible, category sub-label clipped, and the
    // partial row signals that the list scrolls -- which a fully hidden row does not.
    t(L() + 'R2D-1 the first result row is legible above the bottom nav', g.visible >= 50, JSON.stringify(g));
    // R2D-4: the strip was the same #FFFFFF as both the search card above it and the results card
    // below it -- 1.00:1 -- so it read as the first result rather than as an aside.
    t(L() + 'R2D-4 the strip has its own surface, not the same white as the cards around it',
      g.stripBg === 'rgb(255, 251, 245)', String(g.stripBg));
    // R2D-3: the count line rendered AFTER all twelve rows, ~1,080px below the fold. It is now a
    // caption inside the results card, above the rows it describes.
    const countGeom = await page.evaluate(() => {
      const cap = [...document.querySelectorAll('div')].find(d => /^The closest \d+ of \d+ matches$|^\d+ results?$/.test((d.innerText || '').trim()));
      const first = [...document.querySelectorAll('button')].find(b => /reminder/i.test(b.innerText || '') && b.getBoundingClientRect().height > 40 && b.getBoundingClientRect().top > 300);
      if (!cap || !first) return { found: false };
      return { found: true, text: cap.innerText.trim(), color: getComputedStyle(cap).color,
        capTop: Math.round(cap.getBoundingClientRect().top), firstTop: Math.round(first.getBoundingClientRect().top) };
    });
    t(L() + 'R2D-3 the count line is found and states the true total', countGeom.found === true && /of \d+ matches/.test(countGeom.text || ''), JSON.stringify(countGeom));
    t(L() + 'R2D-3 it sits ABOVE the rows it describes', countGeom.found && countGeom.capTop < countGeom.firstTop, JSON.stringify(countGeom));
    t(L() + 'R2D-3 it is no longer the low-contrast token that failed AA on the gradient',
      countGeom.color === 'rgb(94, 67, 55)', String(countGeom.color));
    await ctx.close();
  }
}
// R2D-9: at 768 the strip ran 86.5 chars/line, over WCAG 1.4.8's 80-character cap, while every
// neighbour sat in a 2-column grid.
t('R2D-9 the notice and the strip are both capped at 560px', (code.match(/maxWidth: '560px'/g) || []).length >= 2,
  (code.match(/maxWidth: '560px'/g) || []).length + ' capped');

// ---------- R2-E: a toast must not survive a navigation ----------
// The Auditor's repro was: log a dose on Home (toast fires), open the menu, tap Help & FAQ, type a
// query within 4.5s at 320px -- the toast then covered the care-team safety button entirely, 44px of
// overlap, for the toast's full life. The button is in normal page flow, so the constant lift that
// fixes the Reports pill cannot chase it; the fix is upstream, in navigateTo(). Driven live at 320px
// through exactly that sequence.
{
  const ctx = await browser.newContext({ viewport: { width: 320, height: 720 } });
  const page = await ctx.newPage();
  await firstRun(page);
  const skip = page.getByRole('button', { name: 'Skip guide' });
  if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(700); }
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /^Got it$/.test((x.innerText || '').trim())); if (b) b.click(); });
  await page.waitForTimeout(500);

  // Raise a real toast on Home.
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /^Log$/.test((x.innerText || '').trim())); if (b) b.click(); });
  await page.waitForTimeout(400);
  const toastUp = await page.evaluate(() => !!document.querySelector('[role="status"]'));
  // The precondition is asserted, so this block cannot quietly become a no-op if the Log button moves.
  t('R2-E precondition: a real toast is in flight on Home', toastUp === true, 'toast present=' + toastUp);

  // Navigate to Help well inside the toast's ~4.5s life.
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => (x.getAttribute('aria-label') || '') === 'Open menu'); if (b) b.click(); });
  await page.waitForTimeout(300);
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /Help & FAQ/.test(x.innerText || '')); if (b) b.click(); });
  await page.waitForTimeout(400);
  const stillUp = await page.evaluate(() => !!document.querySelector('[role="status"]'));
  t('R2-E the toast does not survive the navigation to Help', stillUp === false, 'toast present after nav=' + stillUp);

  await page.locator('#help-search').click();
  await page.keyboard.type('she collapsed', { delay: 12 });
  await page.waitForTimeout(450);
  const geom = await page.evaluate(() => {
    const toast = document.querySelector('[role="status"]');
    const btn = [...document.querySelectorAll('button')].find(b => /call the care team/.test(b.innerText || ''));
    if (!btn) return { btn: false };
    if (!toast) return { btn: true, toast: false };
    const t = toast.getBoundingClientRect(), b = btn.getBoundingClientRect();
    return { btn: true, toast: true, overlap: Math.round(Math.min(t.bottom, b.bottom) - Math.max(t.top, b.top)) };
  });
  t('R2-E [320px] the care-team button is on the search screen', geom.btn === true, JSON.stringify(geom));
  t('R2-E [320px] nothing is painting over the care-team button',
    geom.btn === true && (!geom.toast || geom.overlap <= 0), JSON.stringify(geom));
  await ctx.close();
}
t('R2-E navigateTo clears any in-flight toast', /if \(state\.toast\) next\.toast = null;/.test(code));
// The lift predicate is deliberately FIXED-position-only. A constant offset cannot chase an element
// that scrolls, and pretending otherwise is what would have made R2-E look fixed at one scroll
// position and be broken at every other.
t('R2-E the lift predicate covers only fixed-positioned furniture',
  /function toastNeedsLift\(\) \{\s*\n\s*return state\.view === 'reports' && !!state\.reportsView;\s*\n\}/.test(code));

// ---------- Designer M3: the toast must clear the Back-to-reports pill ----------
// Reverting the toast from v56's bubble-clearance 150px back to 96px put it 34px into the pill, in
// the same dark fill, for the toast's full ~4.5s life. Asserted at source level because forcing a
// toast onto the Reports detail is timing-dependent; the arithmetic is not.
// R2D-6 (Designer, round 2): 142px left the lifted toast 12px from the pill -- roughly one line-gap,
// and both are the same dark fill, so they read as one two-storey block. 150px gives 20px of
// separation and still leaves the toast 40px clear of the bottom nav.
t('M3 the toast lifts to 150px when the predicate says so, and sits at 96px otherwise',
  /bottom: toastNeedsLift\(\) \? 'calc\(150px \+ env\(safe-area-inset-bottom\)\)' : 'calc\(96px \+ env\(safe-area-inset-bottom\)\)'/.test(code));
t('M3 the pill itself is unchanged at 88px (only the toast moves -- toast height varies)',
  /bottom: 'calc\(88px \+ env\(safe-area-inset-bottom\)\)'/.test(code));

await browser.close();
console.log(fail === 0 ? '\nALL GREEN' : '\n' + fail + ' FAILURES');
process.exit(fail ? 1 : 0);
