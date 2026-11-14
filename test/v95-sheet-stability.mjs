// v95-sheet-stability.mjs — A SHEET MUST NOT BE TORN DOWN WHILE SOMEBODY IS USING IT.
//
// Aaron, 2026-11-13: "when I'm trying to log my medication and there's two in a row ... the first
// one I'm able to enter just fine but when I go to enter the second one and try to adjust the time
// it backs out and then I have to go back into the time part again."
//
// render() rebuilds the whole tree -- `root.innerHTML = ''` then one appendChild -- so every
// re-render destroys every node. The <input type="time"> in the log sheet is one of them, and on
// Android that input IS the system clock dialog: destroy it and the dialog closes. The toast from
// the FIRST log expires 4.5 seconds later and clearing it calls setState, which renders. That is
// why the first dose is fine and the second is not -- the second is the one opened inside the
// first toast's lifetime.
//
// The 1s tick has had a guard against exactly this since v11 and grew it in v22, v27, v45 and v55.
// The guard was on the TICK; the cosmetic timers call the same render() and never had it.
//
// WHAT THIS SUITE ASSERTS IS NODE IDENTITY, not appearance. A rebuilt tree looks identical in a
// screenshot -- same markup, same value -- and the only observable difference is that the element
// the caregiver's finger was in no longer exists. Every gate in this repo photographs a still
// frame; this one marks a node and asks whether it is still the same node.
//
// Run: env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy node test/v95-sheet-stability.mjs
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = (() => {
  const _p = require('node:path');
  for (const c of ['playwright', '/opt/node-tools/node_modules/playwright',
    _p.join(_p.dirname(process.execPath), '..', 'lib', 'node_modules', 'playwright'),
    '/opt/node22/lib/node_modules/playwright']) { try { return require(c); } catch (e) {} }
  throw new Error('playwright not found');
})();
for (const v of ['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy'])
  if (process.env[v]) { console.log('  FAIL  ' + v + ' is set'); process.exit(3); }

const argv = process.argv.slice(2);
const arg = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const BASE_IN = process.env.FALSIFY_BASE || arg('--base');
const APP_FILE = arg('--file') || new URL('../index.html', import.meta.url).pathname;

const FROZEN = Date.UTC(2026, 10, 13, 17, 3, 0);
const freeze = `(() => { const F = ${FROZEN}; const R = Date;
  function D(...a) { return a.length ? new R(...a) : new R(F); }
  D.prototype = R.prototype; D.now = () => F; D.UTC = R.UTC; D.parse = R.parse;
  Object.setPrototypeOf(D, R); window.Date = D; })()`;

// TWO medications, both with a window open right now: "two in a row", which is the case.
const win = (id, name) => ({ id, name, type: 'win', schemaV: 2, quickLog: true,
  doses: [{ label: '10 mg', mg: 10 }], windows: [{ start: 17, end: 21, name: 'Daily' }] });
const MEDS = [win('bp2', 'Blood pressure dose 2'), win('bp3', 'Blood pressure dose 3')];
// TWO dose options, so the hero cannot log it directly (`canLogHere = openNow && doses.length <= 1`)
// and offers "Show me the card" instead -- which is the only control that arms the card-flash
// timer. Without this fixture the flash timer never runs and its mutant is a no-op.
const TWO_DOSE = [{ id: 'bp4', name: 'Blood pressure dose 4', type: 'win', schemaV: 2, quickLog: true,
  doses: [{ label: '5 mg', mg: 5 }, { label: '10 mg', mg: 10 }],
  windows: [{ start: 17, end: 21, name: 'Daily' }] }];

let server = null, BASE = BASE_IN;
if (!BASE) {
  const root = path.dirname(APP_FILE);
  server = http.createServer((req, res) => {
    const f = path.join(root, decodeURIComponent(req.url.split('?')[0]) === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
    fs.readFile(f, (e, data) => {
      if (e) { res.writeHead(404); res.end('no'); return; }
      const ext = path.extname(f);
      res.writeHead(200, { 'Content-Type': ext === '.html' ? 'text/html' : ext === '.js' ? 'text/javascript' : 'application/octet-stream' });
      res.end(data);
    });
  }).listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  BASE = 'http://127.0.0.1:' + server.address().port + '/index.html';
}

// A CRASH MUST READ AS A FAILURE, NOT AS NOTHING. Under `--file` this suite died with an
// uncaught click timeout and printed no checks line and no FAILURES list -- which looks far more
// like "did not run" than like "found a defect", and the v93 corpus already lost a mutant to a
// suite that crashed instead of failing. Same shape as v94's lesson: a check that cannot report
// is a check that cannot fail.
const fails = [];
let checks = 0;
const bail = (what) => (err) => {
  console.log('  FAIL  the suite ' + what + ': ' + (err && err.message || err));
  console.log('');
  console.log((checks + 1) + ' checks: ' + (checks - fails.length) + ' passed, ' + (fails.length + 1) + ' failed');
  console.log('\nFAILURES:');
  fails.forEach(f => console.log('  - ' + f));
  console.log('  - ' + what + ': ' + (err && err.message || err));
  process.exit(1);
};
process.on('uncaughtException', bail('threw'));
process.on('unhandledRejection', bail('rejected a promise'));
const ok = (label, cond, detail) => {
  checks++;
  if (cond) { console.log('  ok    ' + label); return true; }
  fails.push(label + (detail ? ' — ' + detail : ''));
  console.log('  FAIL  ' + label + (detail ? ' — ' + detail : ''));
  return false;
};

const b = await chromium.launch();
const noise = [];
async function open(meds, entries, keepWhatsNew, seenVersion) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, timezoneId: 'UTC' });
  await ctx.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith('http://127.0.0.1')) return route.continue();
    if (u.includes('cdn.jsdelivr.net')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: '/* stubbed */' });
    return route.abort();
  });
  ctx.on('page', (p) => p.on('console', (m) => {
    if (m.type() !== 'error' && m.type() !== 'warning') return;
    const t = m.text();
    if (t.includes('Service Worker registration blocked by Playwright')) return;
    noise.push(m.type() + ': ' + t);
  }));
  await ctx.addInitScript(freeze);
  const page = await ctx.newPage();
  await page.addInitScript(`(() => {
    const P = 'chemowell-app-p-p1-';
    localStorage.setItem('chemowell-app-profiles-v1', JSON.stringify({ list: [{ id: 'p1', name: 'Aaron', createdAt: 1 }], activeId: 'p1' }));
    localStorage.setItem('chemowell-app-license-v1', JSON.stringify({ tier: 'free' }));
    localStorage.setItem(P + 'prefs-v1', JSON.stringify({ patientName: 'Aaron', onboarded: true, treatmentType: 'chemo', sex: 'other', tourDone: true }));
    localStorage.setItem(P + 'med-v1', JSON.stringify({ version: 2, archivedMeds: {}, meds: ${JSON.stringify(meds || MEDS)} }));
    localStorage.setItem(P + 'entries-v1', JSON.stringify(${JSON.stringify(entries || [])}));
    // AN OLDER SEEN-MARKER, which is the only way the What's New sheet opens. An UNSET marker
    // deliberately shows nothing (a brand-new phone should not be handed a changelog), so the
    // first version of the scenario below never opened the modal at all and was marking an
    // inline card on Home instead -- which the tick rebuilds quite correctly, so the check
    // failed on a healthy build and said the fix was broken. Measuring the wrong element reads
    // exactly like a defect.
    ${seenVersion ? `localStorage.setItem('chemowell-app-seen-version', ${JSON.stringify(seenVersion)});` : ''}
  })()`);
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(1100);
  if (!keepWhatsNew) {
    for (const label of ['Got it', 'Close']) {
      const btn = page.locator(`button:has-text("${label}")`).first();
      if (await btn.count() && await btn.isVisible().catch(() => false)) { await btn.click(); await page.waitForTimeout(250); break; }
    }
  }
  return { ctx, page };
}
const markInput = (page) => page.evaluate(() => {
  const el = document.querySelector('input[type="time"]');
  if (!el) return false;
  el.__probeMark = 'original';
  el.focus();
  return document.activeElement === el;
});
const sampleInput = (page) => page.evaluate(() => {
  const el = document.querySelector('input[type="time"]');
  return { present: !!el, isOriginal: !!(el && el.__probeMark === 'original'), focused: !!(el && document.activeElement === el) };
});
// THE TOAST'S OWN ELEMENT, never its words. The first version of this read the page text for
// "logged" -- which also matches the dose ring's label, "N of N scheduled doses logged today", so
// it reported a toast that had been gone for seconds. Rule 5, for the same reason it is written
// down: a text selector in a single-file app matches the app talking about itself.
const toastShowing = (page) => page.evaluate(() => !!document.querySelector('[data-toast]'));

// ---- THE REPORTED BUG ------------------------------------------------------------------------
{
  const { ctx, page } = await open();
  await page.locator('button:has-text("Log this dose")').first().click();
  await page.waitForTimeout(350);
  ok('the first dose opens its sheet', await page.locator('input[type="time"]').count() > 0);
  await page.locator('button:has-text("Confirm")').first().click();
  await page.waitForTimeout(400);
  ok('and logging it raises a toast', await toastShowing(page));

  // The second dose, opened inside the first toast's lifetime -- Aaron's case exactly.
  await page.locator('button:has-text("Log this dose")').first().click();
  await page.waitForTimeout(350);
  ok('the second dose opens its sheet', await markInput(page));

  // Past the toast's 4.5s and the flash's 1.8s.
  let worst = null;
  for (let i = 0; i < 7; i++) {
    await page.waitForTimeout(800);
    const s = await sampleInput(page);
    if (s.present && !s.isOriginal && !worst) worst = { at: (i + 1) * 800, ...s };
  }
  ok('the time field is NOT destroyed while the second sheet is open',
    worst === null, worst ? 'replaced at ~' + worst.at + 'ms' : '');
  const end = await sampleInput(page);
  ok('and it still has focus at the end', end.focused, JSON.stringify(end));
  await ctx.close();
}

// ---- THE DEFERRAL MUST NOT STRAND THE TOAST --------------------------------------------------
// Without this, "never clear the toast" passes every check above and is plainly wrong.
{
  const { ctx, page } = await open();
  await page.locator('button:has-text("Log this dose")').first().click();
  await page.waitForTimeout(350);
  await page.locator('button:has-text("Confirm")').first().click();
  await page.waitForTimeout(400);
  ok('toast is up right after a log', await toastShowing(page));
  await page.waitForTimeout(5200);
  ok('and with NO sheet open it clears on its own', !(await toastShowing(page)));
  await ctx.close();
}
{
  const { ctx, page } = await open();
  await page.locator('button:has-text("Log this dose")').first().click();
  await page.waitForTimeout(350);
  await page.locator('button:has-text("Confirm")').first().click();
  await page.waitForTimeout(300);
  await page.locator('button:has-text("Log this dose")').first().click();
  await page.waitForTimeout(350);
  await page.waitForTimeout(5200);                       // held open past the toast's life
  ok('the toast is still up while the sheet holds it back', await toastShowing(page));
  await page.locator('button:has-text("Cancel")').first().click();
  await page.waitForTimeout(1400);                       // the retry runs every 600ms
  ok('and it clears once the sheet closes', !(await toastShowing(page)),
    'a deferral that never fires is a leak, not a fix');
  await ctx.close();
}

// ---- THE 1s TICK MUST STILL NOT REBUILD UNDER A SHEET ----------------------------------------
// The guard list moved into liveEditingSurfaceOpen(); this is the regression check on that move.
{
  const { ctx, page } = await open();
  await page.locator('button:has-text("Log this dose")').first().click();
  await page.waitForTimeout(350);
  ok('a sheet is open for the tick check', await markInput(page));
  await page.waitForTimeout(3000);                        // three ticks
  const s = await sampleInput(page);
  ok('three seconds of ticks do not replace the open field', s.present && s.isOriginal,
    JSON.stringify(s));
  await ctx.close();
}

// ---- A FOCUSED FIELD WITH NO SHEET OPEN ------------------------------------------------------
// The guard's first clause is "is something focused", inherited from the tick's `isEditing`. Every
// scenario above also has a sheet open, so the sheet clause alone satisfies them and a build that
// stopped caring about focus passes all of them. This is the case where focus is the ONLY thing
// protecting the field: the Beta date controls' date input, on Home, with a toast still counting
// down and no modal anywhere.
{
  const { ctx, page } = await open();
  await page.locator('button:has-text("Log this dose")').first().click();
  await page.waitForTimeout(350);
  await page.locator('button:has-text("Confirm")').first().click();
  await page.waitForTimeout(350);
  ok('a toast is counting down with no sheet open', await toastShowing(page));
  const panel = page.locator('button:has-text("BETA DATE CONTROLS"), [role="button"]:has-text("BETA DATE CONTROLS")').first();
  if (await panel.count()) { await panel.click(); await page.waitForTimeout(350); }
  const focused = await page.evaluate(() => {
    const el = document.querySelector('input[type="date"]');
    if (!el) return false;
    el.__probeMark = 'original';
    el.focus();
    return document.activeElement === el;
  });
  ok('the beta date field is focused and no sheet is open', focused
    && !(await page.locator('input[type="time"]').count()));
  await page.waitForTimeout(5200);
  const after = await page.evaluate(() => {
    const el = document.querySelector('input[type="date"]');
    return { present: !!el, isOriginal: !!(el && el.__probeMark === 'original'), focused: !!(el && document.activeElement === el) };
  });
  ok('a focused field alone is enough to hold the rebuild off', after.present && after.isOriginal,
    JSON.stringify(after));
  await ctx.close();
}

// ---- THE CARD-FLASH TIMER, WHICH ONLY ARMS FROM "SHOW ME THE CARD" ---------------------------
// A medication with two dose options cannot be logged from the hero, so the hero offers the card
// instead -- and that control is the only thing that sets the flash. Its timer is 1.8s, so this
// scenario does not need the toast at all.
{
  const { ctx, page } = await open(TWO_DOSE);
  const show = page.locator('button:has-text("Show me the card")').first();
  ok('a two-dose medication offers the card instead of logging in place', await show.count() > 0);
  if (await show.count()) {
    await show.click();                       // arms the 1.8s flash
    await page.waitForTimeout(250);
    const dose = page.locator('button:has-text("10 mg")').first();
    if (await dose.count()) {
      await dose.click();
      await page.waitForTimeout(350);
      ok('and its dose opens a sheet', await markInput(page));
      await page.waitForTimeout(2600);        // past the flash's 1.8s
      const s2 = await sampleInput(page);
      ok('the card-flash timer does not destroy the open sheet', s2.present && s2.isOriginal,
        JSON.stringify(s2));
    } else { ok('and its dose opens a sheet', false, 'no dose button found on the card'); }
  }
  await ctx.close();
}

// ---- THE WHAT'S NEW SHEET MUST SURVIVE A TICK (the audit's BLOCK F2) -------------------------
// Every scenario above dismisses this modal during setup, so for a while the only thing holding
// F2 was the string check below -- the delta audit's G2, and a fair hit: "the term is in the
// guard" is not the same claim as "the modal survives". This is the behavioural half. It is the
// one sheet that opens for every user on every release, so a second's rebuild here is the most
// widely felt version of this defect in the whole app.
{
  const { ctx, page } = await open(MEDS, [], true, 'app-v93');
  // SETTLE FIRST. Boot does a few legitimate renders of its own (the badge sync, the native
  // reminder arming), and marking the node before those have run measures them rather than the
  // tick. The question here is only whether the ONCE-A-SECOND rebuild is held off.
  await page.waitForTimeout(1800);
  // The modal's OWN hook, not an ancestor found by walking up from a button -- `closest('div[style]')`
  // picks whichever wrapper happens to carry a style attribute, which is a different question.
  const marked = await page.evaluate(() => {
    const card = document.querySelector('[data-whatsnew-modal]');
    if (!card) return false;
    card.__probeMark = 'original';
    return true;
  });
  ok("the What's New sheet is open after an update", marked);
  if (marked) {
    await page.waitForTimeout(3200);                       // three ticks
    const still = await page.evaluate(() => {
      const card = document.querySelector('[data-whatsnew-modal]');
      return { present: !!card, isOriginal: !!(card && card.__probeMark === 'original') };
    });
    ok("three seconds of ticks do not rebuild the What's New sheet",
      still.present && still.isOriginal, JSON.stringify(still));
  }
  await ctx.close();
}

// ---- THE IN-PATIENT UNDO TIMER (the audit's BLOCK F1) ----------------------------------------
// A bottom-nav screen where `+` (log a past stay, which opens a sheet with a time field) and
// `Undo` (which arms a 5-second timer) sit 8px apart in the same row. "Undo that, then + to log it
// properly instead" is the natural corrective sequence, and the audit measured the open field
// ceasing to exist 5315ms into it. The first build of this release moved that from 4.5s to 5.3s
// and called it fixed; this is the check that would have said otherwise.
{
  const active = [{ id: 'ip1', medId: 'inpatient_start', dose: null, mg: 0, ts: Date.UTC(2026, 10, 13, 9, 0, 0) }];
  const ctxp = await open(MEDS, active);
  const { ctx, page } = ctxp;
  // EXACT match. `has-text("In-Patient")` also matches the card's own "Log In-Patient End"
  // button, and the first version of this clicked that instead -- ending the stay, so the Undo
  // control it was about to look for no longer existed. A substring selector that silently hits
  // a different control is Rule 5's text-selector hazard in its most expensive form: the check
  // did not error, it just quietly tested nothing.
  // By ACCESSIBLE NAME, exact. `has-text` also matches the card's own "Log In-Patient End" button
  // and the first version of this clicked that instead -- ending the stay, so the Undo control it
  // was about to look for no longer existed. The check did not error; it quietly tested nothing,
  // which is Rule 5's text-selector hazard in its most expensive form. `:text-is` then found
  // nothing at all, because the nav label sits in a child element rather than on the button.
  const tab = page.getByRole('button', { name: 'In-Patient', exact: true }).first();
  if (await tab.count()) { await tab.click(); await page.waitForTimeout(500); }
  const undo = page.locator('button:has-text("Undo")').first();
  ok('the In-Patient screen shows Undo for an active stay', await undo.count() > 0);
  if (await undo.count()) {
    await undo.click();                                   // arms the 5s timer
    await page.waitForTimeout(250);
    const plus = page.locator('[aria-label="Log a past hospital stay"]').first();
    ok('and the past-stay control sits beside it', await plus.count() > 0);
    if (await plus.count()) {
      await plus.click();
      await page.waitForTimeout(400);
      ok('which opens a sheet with a time field', await markInput(page));
      await page.waitForTimeout(6400);                    // past the undo timer's 5s
      const s2 = await sampleInput(page);
      ok('the Undo timer does not destroy that open sheet', s2.present && s2.isOriginal,
        JSON.stringify(s2));
    }
  }
  await ctx.close();
}

// ---- COMPLETENESS: EVERY DISMISSIBLE LAYER IS ACCOUNTED FOR --------------------------------
// The audit of this release's first build found `whatsNewOpen` missing from the guard -- the one
// modal that opens for EVERY user on EVERY release, rebuilt once a second the whole time it sat
// there. It had been missing from the old inline list too. That is the eighth instance of
// "somebody added a surface and forgot the list" (v11, v22, v27, v45, v55, and three in this
// release), and the audit's own recommendation was that a list which must be remembered will be
// forgotten a ninth time.
//
// So this does not read the guard and nod. It reads the app's OWN registry of dismissible layers
// -- `backLayerKeys`, which the Back-button handling already maintains and already exports -- and
// requires every key in it to be either guarded or named below with a reason. Add a layer and
// this goes red until somebody decides which it is. That is the same shape as
// harness/scrolllock-test.mjs's completeness check, and for the same reason.
{
  const { ctx, page } = await open();
  const r = await page.evaluate(() => ({
    // backLayerKeys is exported as-is and is a function in this build; take either shape rather
    // than assume, so this check does not break the next time its form changes.
    keys: (() => {
      const k = window.__backTest && window.__backTest.keys;
      const list = typeof k === 'function' ? k() : k;
      return (list || []).map(x => (x && x.key) || x).filter(Boolean);
    })(),
    guard: String(window.__v86Test && window.__v86Test.guardSource || '')
  }));
  await ctx.close();
  // WHAT THIS REGISTRY IS, stated so the check is not read as broader than it is: backLayerKeys
  // is the set of surfaces the BACK BUTTON can dismiss. The delta audit checked rather than
  // assumed -- all ten `role: 'dialog'` surfaces in the file have an entry -- but a confirm with
  // no Back entry (confirmUndoInpatient is one) is invisible here. So this catches a registered
  // layer losing its guard; it does not catch a surface that was never registered.
  ok('the app exposes its own layer registry', r.keys.length > 10, 'keys: ' + r.keys.length);
  ok('and the guard source is readable', r.guard.length > 50, 'len ' + r.guard.length);

  // Each exemption is a DECISION with a reason, not a hole. If one of these ever needs guarding,
  // delete its line here and add the term -- the check then goes green again on purpose.
  const EXEMPT = {
    confirmClearChemo: 'deferred by its OWN timer; guarding it would mean its disarm never runs',
    tourStep: 'a fixed banner that can sit for minutes -- stopping the 1s tick for it would let Home go stale',
    vitalOpen: 'an inline panel, not a sheet; its field values live in state and survive a rebuild, and a focused field is covered by the first clause',
    symptomFilter: 'a filter selection, not a surface',
    help: 'handled separately: the tick skips the Help view outright via state.view'
  };
  // The four view names (home, meds, reports, inpatient) were in this list when it was first
  // written, from a static grep that had picked up a different array in the file. The anti-rot
  // check below caught them on its first run: they are not layers and never were. Left recorded
  // because an exemption list is exactly where a plausible-looking wrong line survives longest.
  // TOKENS, NOT SUBSTRINGS, AND ONLY FROM THE EXPRESSION. The first version asked
  // `guard.indexOf('state.' + key) >= 0`, and the guard's last two terms are
  // `state.confirmRemove || state.confirmRemovePara` -- so 'state.confirmRemove' matched INSIDE
  // 'state.confirmRemovePara'. The delta audit deleted `state.confirmRemove` from the guard and
  // ran the whole suite against it: 26/26 PASS, while the 1s tick rebuilt the document under an
  // armed delete confirmation -- Aaron's own v45 report, restored, with the completeness check
  // green over the top of it. A check built to stop a ninth omission could not see the first one
  // it was given.
  //
  // Slicing from `return !!(` also shuts a second mouth: the guard's comment is inside
  // String(liveEditingSurfaceOpen) and happens to contain no `state.` token today, so a future
  // comment mentioning `state.foo` would silently exempt it.
  // AND IT MUST BE A DISJUNCT, NOT MERELY MENTIONED. The token version of this check proved a
  // key appeared somewhere in the expression, which is a weaker claim than "this key makes the
  // guard true". The delta-3 audit showed the gap with one character: `|| !state.addingProfile`
  // leaves the whole suite green while the add-profile sheet -- which has a name field in it --
  // is rebuilt once a second. So each `||` arm must be exactly `state.<key>` and nothing else;
  // a negation, a parenthesised expression or a `false &&` no longer counts as cover.
  // Cut to the matching parenthesis rather than stripping a trailing `);` -- the source of a
  // function ends `);\n}`, so the naive strip left the closing brace glued to the LAST arm and
  // that one arm alone failed the shape test. It surfaced the moment the shape test went in,
  // which is the check doing its job on itself.
  const src = r.guard.slice(r.guard.indexOf('return !!('));
  const expr = src.slice(src.indexOf('(') + 1, src.lastIndexOf(')'));
  const arms = expr.split('||').map(x => x.trim());
  const guarded = new Set(arms.filter(a => /^state\.\w+$/.test(a)).map(a => a.slice(6)));
  ok('the guard parses into plain state.<key> disjuncts', guarded.size > 15,
    'disjuncts: ' + guarded.size + ' of ' + arms.length + ' arms');
  const unaccounted = r.keys.filter(k => !guarded.has(k) && !EXEMPT[k]);
  ok('EVERY dismissible layer is either guarded or exempted with a reason',
    unaccounted.length === 0,
    unaccounted.length ? 'unaccounted: ' + unaccounted.join(', ') + ' — guard it, or exempt it here and say why' : '');
  // The exemption list must not rot either: a name that is no longer a layer is a line nobody
  // will question, and the next person reads it as a considered decision about something real.
  const stale = Object.keys(EXEMPT).filter(k => r.keys.indexOf(k) < 0);
  ok('and no exemption names a layer that no longer exists', stale.length === 0,
    stale.length ? 'stale exemptions: ' + stale.join(', ') : '');
}

if (noise.length) {
  const uniq = [...new Set(noise)];
  checks++; fails.push('console: ' + uniq.slice(0, 2).join(' | '));
  console.log('  FAIL  the app logged ' + uniq.length + ' console error(s)/warning(s): ' + uniq[0]);
} else { ok('no console errors or warnings', true); }

await b.close();
if (server) server.close();
console.log('');
console.log(checks + ' checks: ' + (checks - fails.length) + ' passed, ' + fails.length + ' failed');
if (fails.length) { console.log('\nFAILURES:'); fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
console.log('PASS — a sheet survives the timers that fire underneath it, and the toast still clears.');
// Stand the crash handlers down and exit explicitly. Without this a late rejection arriving after
// the tally prints a SECOND, contradictory tally and exits 1 -- a false red, which hides nothing
// but which release_check.sh reads as a failure.
process.removeAllListeners('uncaughtException');
process.removeAllListeners('unhandledRejection');
process.exit(0);
