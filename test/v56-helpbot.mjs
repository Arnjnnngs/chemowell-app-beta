// Lead Developer self-verification for app-v56's on-screen help bubble, driven through the real
// UI at phone widths.
//
// Run:  nohup python3 -m http.server 8899 --directory <repo> &   (then)
//       env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy node test/v56-helpbot.mjs
//
// Environment facts, recorded so nobody rediscovers them:
//  1. index.html is a single <script type="module">, so NOTHING it declares is reachable from
//     page.evaluate(). Every behavioural check here drives the rendered UI as a user would. The
//     scoring function itself is covered headless in test/v56-matcher.mjs.
//  2. This sandbox injects HTTPS_PROXY, which Chromium picks up and then fails on for loopback.
//     Clear the proxy vars and use 127.0.0.1, never localhost.
//  3. The CDN <script> tags (Capacitor) cannot load here and throw ERR_CERT_AUTHORITY_INVALID.
//     That is a sandbox artifact, filtered explicitly below rather than by ignoring errors.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
const fs = require('fs');

const BASE = 'http://127.0.0.1:8899/index.html';
let fail = 0;
const t = (name, cond, detail) => {
  console.log((cond ? 'PASS  ' : 'FAIL  ') + name + (detail ? '  |  ' + detail : ''));
  if (!cond) fail++;
};
const isSandboxNoise = (s) => /ERR_CERT_AUTHORITY_INVALID|ERR_TUNNEL_CONNECTION_FAILED|ERR_PROXY|cdn\.jsdelivr\.net|Failed to load resource/i.test(s);

// ---------- source-level ----------
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const sw = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
t('APP_VERSION is app-v56', /const APP_VERSION = 'app-v56';/.test(html));
// Invariant, not a pinned literal — a pinned one has to be hand-weakened every release, which is
// how two assertions in the v55 suite quietly stopped guarding.
const vNow = (html.match(/const APP_VERSION = '([^']+)'/) || [])[1];
const cNow = (sw.match(/const CACHE = '([^']+)'/) || [])[1];
t('sw.js CACHE names the same version index.html declares',
  !!cNow && !!vNow && cNow.indexOf(vNow.replace('app-', '') + '-') >= 0, 'APP_VERSION=' + vNow + '  CACHE=' + cNow);
t('the panel is in the 1s tick guard (the caret bug has shipped five times)',
  /if \(state\.view !== 'help' && !state\.helpBotOpen/.test(html));
// The rule is not "no handler" -- it is "the handler must not re-render". An input with no
// handler at all loses the draft on any unrelated setState (proved live: the toast auto-dismiss).
t('the input handler assigns the draft and nothing else — no setState, no render',
  /onInput: \(ev\) => \{ helpBotDraft = ev\.target\.value; \}/.test(html));
t('no render() or setState() anywhere in the composer input handler',
  !/onInput: \(ev\) => \{[^}]*(render\(\)|setState)/.test(html));
t('the toast was raised clear of the bubble (84-140px band)',
  /bottom: 'calc\(150px \+ env\(safe-area-inset-bottom\)\)'/.test(html));
t('the send button is never passed disabled (h() would render disabled="false")',
  !/'Send question'[\s\S]{0,300}?disabled/.test(html));
t('the panel does not claim aria-modal (it is deliberately non-modal, no trap)',
  !/id: 'helpbot-panel'[\s\S]{0,400}?aria-modal/.test(html));
t('focus return re-queries by id inside requestAnimationFrame (not a cached node)',
  /function closeHelpBot\(\)[\s\S]{0,400}requestAnimationFrame[\s\S]{0,200}getElementById\('helpbot-fab'\)/.test(html));
t('the viewport listener is registered once at module scope',
  /window\.visualViewport\.addEventListener\('resize', helpBotSyncViewport\)/.test(html));
// Match a CALL, not the word: the previous version of this failed because the function's own
// comment explains why it must not render, which is the same false-positive shape as V55-4.
// Source-level assertions must read CODE, not comments. This has now produced three false
// positives in two releases (V55-4's dead-branch check, the onInput check, and this one), every
// time because the comment explaining why something is forbidden contains the forbidden token.
// Strip comments once, here, and use it for every check that asks "does this code call X".
const codeOnly = (src) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');
t('helpBotSyncViewport never calls render() or setState()', (() => {
  const i = html.indexOf('function helpBotSyncViewport()');
  const body = codeOnly(html.slice(i, html.indexOf('\n}', i)));
  return !/(^|[^a-zA-Z.])render\(\s*\)/.test(body) && !/setState\(/.test(body);
})());
// LA-5: the first version of this used String.match without /g, so it inspected the FIRST onInput
// in the file -- the welcome screen's name field -- and said nothing about the composer at all.
// Anchor on the composer's own id and slice forward from there.
t('the composer input handler never calls render() or setState()', (() => {
  const src = codeOnly(html);
  const i = src.indexOf("id: 'helpbot-input'");
  if (i < 0) return false;
  const m = src.slice(i, i + 1200).match(/onInput: \(ev\) => \{[^}]*\}/);
  return !!m && !/render\(|setState\(/.test(m[0]);
})());
t('the transcript is never persisted (no localStorage anywhere near it)',
  !/helpBotLog[\s\S]{0,200}localStorage/.test(html) && /let helpBotLog = \[\];/.test(html));

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
const fab = (page) => page.locator('#helpbot-fab');
const panel = (page) => page.locator('#helpbot-panel');

async function ask(page, q) {
  await page.locator('#helpbot-input').click();
  await page.locator('#helpbot-input').fill('');
  await page.keyboard.type(q, { delay: 12 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(420);
  return page.evaluate(() => document.getElementById('helpbot-log').innerText);
}

for (const vp of [{ name: '360px', width: 360, height: 800 }, { name: '390px', width: 390, height: 844 }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error' && !isSandboxNoise(m.text())) errs.push(m.text()); });
  page.on('pageerror', e => { if (!isSandboxNoise(e.message)) errs.push('pageerror: ' + e.message); });
  const L = (s) => `[${vp.name}] ` + s;

  // ---- hidden during setup ----
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);
  t(L('bubble is absent on the welcome screen'), (await fab(page).count()) === 0);

  await firstRun(page);
  // ---- hidden during the guided tour (it is tappable THROUGH the tour layer otherwise) ----
  t(L('bubble is absent while the guided tour is up'), (await fab(page).count()) === 0);
  const skip = page.getByRole('button', { name: 'Skip guide' });
  if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(600); }

  // ---- present on Home ----
  t(L('bubble appears on Home once the tour is dismissed'), (await fab(page).count()) === 1);
  const box = await fab(page).boundingBox();
  t(L('bubble is at least 44x44 (it is 56)'), box && box.width >= 44 && box.height >= 44, box ? box.width + 'x' + box.height : 'none');
  t(L('bubble is clear of the bottom nav'), await page.evaluate(() => {
    const f = document.getElementById('helpbot-fab').getBoundingClientRect();
    const n = document.querySelector('nav[aria-label="Primary navigation"]').getBoundingClientRect();
    return f.bottom <= n.top;
  }));
  t(L('bubble paints above the nav'), await page.evaluate(() => {
    const f = document.getElementById('helpbot-fab');
    const r = f.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!(hit && (hit === f || f.contains(hit)));
  }));
  t(L('no horizontal overflow with the bubble on screen'), (await overflowOf(page)) <= 0);

  // ---- open ----
  await fab(page).click();
  await page.waitForTimeout(450);
  t(L('panel opens'), (await panel(page).count()) === 1);
  t(L('bubble is replaced by the panel, not stacked with it'), (await fab(page).count()) === 0);
  t(L('focus lands in the input'), await page.evaluate(() => document.activeElement && document.activeElement.id === 'helpbot-input'));
  let log = await page.evaluate(() => document.getElementById('helpbot-log').innerText);
  t(L('greeting says plainly it is not a person and not AI'), /not a person and I.m not AI/.test(log), log.slice(0, 80));
  t(L('greeting says nothing leaves the device'), /leaves this device/.test(log));
  t(L('four starter chips plus browse-all'), (await page.locator('#helpbot-log button').count()) >= 5,
    (await page.locator('#helpbot-log button').count()) + ' buttons');
  t(L('no horizontal overflow with the panel open'), (await overflowOf(page)) <= 0);
  t(L('panel sits above the nav'), await page.evaluate(() => {
    const p = document.getElementById('helpbot-panel').getBoundingClientRect();
    const n = document.querySelector('nav[aria-label="Primary navigation"]').getBoundingClientRect();
    return p.bottom <= n.top + 1;
  }));

  // ---- typing survives the 1s tick (the bug that shipped five times) ----
  const typed = 'why cant i type in the daily limit box';
  await page.locator('#helpbot-input').click();
  await page.keyboard.type(typed, { delay: 45 });     // slower than the tick, on purpose
  await page.waitForTimeout(1600);                     // let at least one tick fire mid-typing
  t(L('the input keeps every character typed'), (await page.locator('#helpbot-input').inputValue()) === typed,
    'got "' + (await page.locator('#helpbot-input').inputValue()) + '"');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(450);
  log = await page.evaluate(() => document.getElementById('helpbot-log').innerText);
  t(L('a real question gets the right walkthrough'), /Daily limit box is greyed out/.test(log), log.slice(-260));
  t(L('the question the user typed is shown back'), log.indexOf(typed) >= 0);
  t(L('the reply offers the full walkthrough'), /Open the full walkthrough/.test(log));
  t(L('a medical-adjacent reply carries the calm callout, not the urgent heading'),
    /Not medical advice/.test(log) && !/Contact your care team/.test(log));
  t(L('no raw markup reaches the reader'), log.indexOf('**') < 0 && log.indexOf('`') < 0,
    (log.match(/.{0,25}(\*\*|`).{0,25}/) || ['(none)'])[0]);

  // ---- guards ----
  // Per the brief: when a care-team topic is a plausible match the guard shows THAT topic's own
  // words (miss-real-missed opens "Contact the care team. Whether to take a missed dose late,
  // skip it, or double up is a medical decision"), which is a better answer than generic copy.
  // Either branch is correct; what must never happen is a dose, a number, or a normal app answer.
  log = await ask(page, 'should i take a double dose');
  t(L('a dosing question is refused and routed to the care team'),
    /question for the care team/.test(log) || /Contact the care team/.test(log), log.slice(-220));
  t(L('the dosing refusal never suggests a dose or a number'),
    !/\b\d+\s*(mg|ml|mcg|pills?|tablets?)\b/i.test(log.split('should i take a double dose')[1] || ''));
  // A DOSE question routes to the page whose own answer is exactly this question. A DRUG-INFO
  // question has no such page and gets the generic refusal. Both are the care-team route; pinning
  // which one each takes is what stops V56-6's "whichever careLead scored best" coming back.
  t(L('a dose question routes to the missed-dose care-team page'),
    /Contact your care team/.test(log) && /double up is a medical decision/.test(log), log.slice(-260));

  log = await ask(page, 'how many mg of tylenol is safe');
  t(L('a "how much is safe" question is refused with the generic care-team copy'),
    /question for the care team/.test(log), log.slice(-240));
  t(L('that refusal carries the app disclaimer verbatim'), /record-keeping tool, not medical advice/.test(log));

  log = await ask(page, 'is 101 a fever');
  t(L('a fever question routes to the care-team page, urgent tone'),
    /Contact your care team/.test(log) && /Contact the care team now/.test(log), log.slice(-220));
  t(L('the fever reply states no threshold'), !/100\.4|37\.5/.test(log.split('is 101 a fever')[1] || ''));

  log = await ask(page, 'are you a real person');
  t(L('"are you a real person" is answered honestly'),
    /No — I.m not a person, and I.m not AI either/.test(log), log.slice(-200));

  log = await ask(page, 'help');
  t(L('the single word "help" never returns the emergency-symptom page'),
    !/severe, or something new and frightening/.test(log), log.slice(-200));

  log = await ask(page, 'zzzqqq wibble');
  t(L('an unanswerable question says so calmly, with a way forward'),
    /don.t have an answer for that one/.test(log) && /Browse all 117 help topics/.test(log), log.slice(-200));

  log = await ask(page, 'the app is broken');
  t(L('an ambiguous question offers a short disambiguation list'),
    /not certain which one you mean/.test(log), log.slice(-220));
  // Scoped to the LAST bot message: counting every button in the log counts every earlier reply's
  // buttons too, which is how the first version of this assertion failed on a correct build.
  t(L('disambiguation offers at most 4 rows'),
    (await page.evaluate(() => {
      const msgs = document.getElementById('helpbot-log').children;
      const last = msgs[msgs.length - 1];
      return last ? last.querySelectorAll('button').length : -1;
    })) <= 4,
    'rows in last reply: ' + (await page.evaluate(() => {
      const msgs = document.getElementById('helpbot-log').children;
      const last = msgs[msgs.length - 1];
      return last ? last.querySelectorAll('button').length : -1;
    })));

  // ---- through to the walkthrough ----
  await ask(page, 'export to excel');
  await page.getByRole('button', { name: 'Open the full walkthrough' }).last().click();
  await page.waitForTimeout(600);
  const body = await page.evaluate(() => document.body.innerText);
  t(L('the walkthrough opens in one step, on the right topic'), /Step by step/i.test(body) && /CSV/i.test(body), body.slice(0, 160));
  t(L('the bubble is hidden on the Help view itself'), (await fab(page).count()) === 0);
  t(L('Back names the topic own category, not "All help topics"'), !/All help topics/.test(body.slice(0, 200)));

  // ---- transcript does not survive a reload ----
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);
  if (await page.getByRole('button', { name: 'Skip guide' }).count()) { await page.getByRole('button', { name: 'Skip guide' }).first().click(); await page.waitForTimeout(500); }
  await page.evaluate(() => { try { sessionStorage.removeItem('chemowell-app-ui-view'); } catch (e) {} });
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);
  if (await page.getByRole('button', { name: 'Skip guide' }).count()) { await page.getByRole('button', { name: 'Skip guide' }).first().click(); await page.waitForTimeout(500); }
  await fab(page).click();
  await page.waitForTimeout(400);
  log = await page.evaluate(() => document.getElementById('helpbot-log').innerText);
  t(L('the transcript is gone after a reload — nothing typed is stored'),
    /type what.s going wrong in your own words/.test(log) && log.indexOf('double dose') < 0);

  // ---- close: Escape, and focus return ----
  await page.keyboard.press('Escape');
  await page.waitForTimeout(350);
  t(L('Escape closes the panel'), (await panel(page).count()) === 0);
  t(L('focus returns to the bubble, not to <body>'),
    await page.evaluate(() => document.activeElement && document.activeElement.id === 'helpbot-fab'),
    await page.evaluate(() => document.activeElement ? (document.activeElement.id || document.activeElement.tagName) : 'null'));

  // ---- hidden behind every overlay ----
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.waitForTimeout(350);
  t(L('bubble is hidden while the drawer is open'), (await fab(page).count()) === 0);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(350);
  t(L('bubble returns when the drawer closes'), (await fab(page).count()) === 1);

  await page.getByRole('button', { name: 'Meds', exact: true }).click();
  await page.waitForTimeout(400);
  t(L('bubble is present on the Meds tab'), (await fab(page).count()) === 1);
  const addBtn = page.getByRole('button', { name: /Add/ }).first();
  if (await addBtn.count()) {
    await addBtn.click();
    await page.waitForTimeout(500);
    t(L('bubble is hidden while the medication editor is open'), (await fab(page).count()) === 0);
  }

  // ---- Auditor/Designer fixes from the first gate round ----
  // V56-2 (High): the panel used to survive a nav tap and cover the view it navigated to, with the
  // target screen's own controls unreachable behind it.
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await page.waitForTimeout(400);
  await fab(page).click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Meds', exact: true }).click();
  await page.waitForTimeout(500);
  t(L('V56-2 navigating closes the panel'), (await panel(page).count()) === 0);
  t(L('V56-2 the destination screen is reachable, not covered'), await page.evaluate(() => !document.getElementById('helpbot-panel')));
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await page.waitForTimeout(400);
  t(L('V56-2 the panel does not resurrect itself on the way back'), (await panel(page).count()) === 0);

  // V56-3 (Med): focus was handed back to the bubble and then dropped to <body> by the next tick.
  await fab(page).click();
  await page.waitForTimeout(400);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1800);   // outlive at least one 1s tick
  t(L('V56-3 focus is still on the bubble after the tick rebuilds the tree'),
    await page.evaluate(() => document.activeElement && document.activeElement.id === 'helpbot-fab'),
    await page.evaluate(() => document.activeElement ? (document.activeElement.id || document.activeElement.tagName) : 'null'));

  // V56-1 (High): clinical questions that used to get a normal app answer.
  await fab(page).click();
  await page.waitForTimeout(400);
  for (const q of ['is this medicine safe for children', 'what are the side effects of cisplatin', 'can i crush the tablet']) {
    const lg = await ask(page, q);
    const after = lg.split(q)[1] || '';
    t(L('V56-1 "' + q + '" is routed to the care team'),
      /care team/i.test(after) && !/Step by step|Open the full walkthrough/i.test(after), after.slice(0, 180));
  }

  // V56-4 (Med): transcript scroll survives a re-render.
  // LA-4: the first version of this waited 1.6s with the panel open -- where the 1s tick is
  // SUPPRESSED, so no re-render happened and the assertion passed whether the fix existed or not.
  // The panel is non-modal, so tapping the Beta date-controls box behind it is a real user action
  // that really re-renders. That is what makes this test able to fail.
  await ask(page, 'export to excel');
  await ask(page, 'red banner wont go away');
  const before = await page.evaluate(() => { const l = document.getElementById('helpbot-log'); l.scrollTop = 45; return l.scrollTop; });
  await page.getByRole('button', { name: /BETA DATE CONTROLS/i }).first().click();
  await page.waitForTimeout(450);
  const after = await page.evaluate(() => { const l = document.getElementById('helpbot-log'); return l ? l.scrollTop : -1; });
  t(L('V56-4 transcript scroll survives a real re-render behind the panel'),
    before > 0 && Math.abs(after - before) < 8, 'set ' + before + ', now ' + after);
  await page.getByRole('button', { name: /BETA DATE CONTROLS/i }).first().click();
  await page.waitForTimeout(350);

  // V56-5 (Med): the transcript is capped.
  // LA-4: the first version counted ~12 messages against a limit of 40, so deleting the cap left
  // it green. Push past the limit.
  for (let i = 0; i < 22; i++) await ask(page, 'export to excel ' + i);
  const msgCount = await page.evaluate(() => document.getElementById('helpbot-log').children.length);
  t(L('V56-5 the transcript is capped once it exceeds the limit'), msgCount <= 41 && msgCount >= 20,
    msgCount + ' messages after 24 exchanges');

  // Designer M1: the send control no longer uses the app's BACK chevron.
  t(L('M1 send button uses the send glyph, not the back arrow'), await page.evaluate(() => {
    const b = document.querySelector('[aria-label="Send question"]');
    return !!b && b.innerHTML.indexOf('M4.5 11.9') >= 0;
  }));
  // Designer M2 / V56-7: the layout branch survives a resize.
  await page.setViewportSize({ width: 740, height: 400 });
  await page.waitForTimeout(500);
  t(L('M2 the panel adopts the wide layout after a resize'), await page.evaluate(() => {
    const p = document.getElementById('helpbot-panel');
    return p ? Math.round(p.getBoundingClientRect().width) <= 400 : false;
  }), await page.evaluate(() => { const p = document.getElementById('helpbot-panel'); return p ? Math.round(p.getBoundingClientRect().width) + 'px' : 'no panel'; }));
  await page.setViewportSize({ width: vp.width, height: vp.height });
  await page.waitForTimeout(500);
  t(L('M2 and reverts to the phone layout on the way back'), await page.evaluate(() => {
    const p = document.getElementById('helpbot-panel');
    return p ? Math.round(p.getBoundingClientRect().width) > 300 : false;
  }));
  t(L('no horizontal overflow after the resize round trip'), (await overflowOf(page)) <= 0);

  // Designer S8: a persistent announcer node, written after the rebuild.
  t(L('S8 a dedicated live region exists and holds the newest reply'), await page.evaluate(() => {
    const a = document.getElementById('helpbot-announce');
    return !!a && a.getAttribute('aria-live') === 'polite' && a.textContent.trim().length > 0;
  }), await page.evaluate(() => { const a = document.getElementById('helpbot-announce'); return a ? a.textContent.slice(0, 60) : 'missing'; }));
  t(L('S8 the transcript container no longer claims to be a live region'), await page.evaluate(() => {
    const l = document.getElementById('helpbot-log');
    return l.getAttribute('aria-live') === 'off';
  }));

  // Designer S5: browse-all stays reachable after the first question.
  t(L('S5 browse-all is still offered after a reply'),
    (await page.getByRole('button', { name: /Browse all \d+ help topics/ }).count()) > 0);

  t(L('zero app console errors across the whole run'), errs.length === 0, errs.slice(0, 4).join(' | '));
  await ctx.close();
}

await browser.close();
console.log(fail === 0 ? '\nALL GREEN' : '\n' + fail + ' FAILURES');
process.exit(fail ? 1 : 0);
