// v94-window-coverage.mjs — HAS THIS DOSE BEEN GIVEN? ONE ANSWER, OR THE APP ASKS TWICE.
//
// Aaron, 2026-11-06, screenshot of his own Home screen: "I just logged my medication for the 5:00
// round and it still shows me to log it." He had logged it at about 4:45. The card kept asking.
//
// The app held SIX answers to "has this window been covered" and three were wrong. The first
// build of this fix unified the three SCREEN surfaces and the independent audit refused it over
// the three it had not: the Home screen stopped asking and the OS alarm stayed armed, so the
// phone still woke him at 17:00 to give a dose he had given at 16:45. The armed plan for that day
// was byte-identical to the plan for a day with nothing logged at all. The notification section
// at the bottom of this file is that defect's check: it asserts on the PLAN, because the titles
// in the plan are identical whether or not the dose was logged, and a suite built on titles could
// not see an alarm that should have been dropped.
//
// The three screen surfaces:
//   missedDosesFor    -- the correct one, fixed in v68 after Aaron reported the mirror image
//                        (a LATE dose still flagged missed). Its comment says early logs count.
//   status()          -- `e.ts >= windowStart && e.ts < windowEnd`. 16:45 is not in [17:00,21:00),
//                        so the Home card and the Up next hero asked for a dose already given.
//   doseProgressToday -- counted ENTRIES capped at the window count, so two doses in one window
//                        read as two windows done: "4/4 DOSES" beside "Due now".
//
// And the three on the notification path:
//   medWindowDueAt         -- feeds the OS alarm plan AND the app-icon badge / drawer dot.
//   dueRemindersAt         -- the reactive web notification, its own copy of the same test.
//   cancelReminderForEntry -- decided which window's alarm to cancel, so for a dose logged early
//                             it cancelled nothing, which is why none of it self-healed.
//
// This suite drives the RENDERED Home screen, not the functions in isolation: the defect was only
// ever visible as two parts of one screen contradicting each other, and a unit test on either half
// alone would have passed throughout.
//
// Run: env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy node test/v94-window-coverage.mjs
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
  if (process.env[v]) { console.log('  FAIL  ' + v + ' is set'); console.error('REFUSING: ' + v + ' is set.'); process.exit(3); }

const argv = process.argv.slice(2);
const arg = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const BASE_IN = process.env.FALSIFY_BASE || arg('--base');
const APP_FILE = arg('--file') || new URL('../index.html', import.meta.url).pathname;

// Frozen at 17:03 with the context pinned to UTC: the suite's idea of "now" must not depend on the
// host's zone. v90-chart-axes was red one hour a day on correct code for exactly that reason.
const FROZEN = Date.UTC(2026, 10, 6, 17, 3, 0);
const D0 = Date.UTC(2026, 10, 6, 0, 0, 0);
const H = (h, m) => D0 + h * 3600000 + (m || 0) * 60000;
const freezeAt = (ts) => `(() => { const F = ${ts}; const R = Date;
  function D(...a) { return a.length ? new R(...a) : new R(F); }
  D.prototype = R.prototype; D.now = () => F; D.UTC = R.UTC; D.parse = R.parse;
  Object.setPrototypeOf(D, R); window.Date = D; })()`;
const freeze = freezeAt(FROZEN);
// A SECOND CLOCK, AND IT IS THE WHOLE POINT OF THE NOTIFICATION SECTION. 17:03 is inside the
// evening window, so today's 17:00 alarm is already in the past and buildReminderPlan's 30-second
// minimum lead drops it whether or not the dose was logged -- the two plans then match for a
// reason that has nothing to do with coverage, and the first version of these checks was green on
// a broken app for exactly that reason. The question only exists BEFORE the window opens: at
// 16:50 the alarm is still pending and logging at 16:45 either drops it or does not.
const BEFORE = Date.UTC(2026, 10, 6, 16, 50, 0);

// `type: 'win'` IS THE INGREDIENT. normalizeMedication DERIVES `alerts` from it and discards a
// stored alerts:true; without it a medication renders a perfect card and is never "due" at all.
const win = (windows) => ({ id: 'bp2', name: 'Blood pressure dose 2', type: 'win', schemaV: 2,
  quickLog: true, doses: [{ label: '10 mg', mg: 10 }], windows });
const EVENING = [{ start: 17, end: 21, name: 'Daily' }];
const TWO = [{ start: 8, end: 12, name: 'Morning' }, { start: 17, end: 21, name: 'Daily' }];
// Two windows with a real GAP after the second: a dose at 16:00 is three hours past the last
// window's close and in neither window's early reach, so only the LATE reach decides which window
// is credited for it. That is the case BACKLOG M44 recorded as unobservable.
const GAP = [{ start: 6, end: 8, name: 'Early' }, { start: 11, end: 13, name: 'Mid' }];
const dose = (id, ts) => ({ id, medId: 'bp2', dose: '10 mg', ts });

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

const fails = [];
let checks = 0;
const ok = (label, cond, detail) => {
  checks++;
  if (cond) { console.log('  ok    ' + label); return true; }
  fails.push(label + (detail ? ' — ' + detail : ''));
  console.log('  FAIL  ' + label + (detail ? ' — ' + detail : ''));
  return false;
};

const b = await chromium.launch();
const noise = [];
async function home(meds, entries) {
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
    localStorage.setItem(P + 'prefs-v1', JSON.stringify({ patientName: 'Aaron', onboarded: true, treatmentType: 'chemo', tourDone: true }));
    localStorage.setItem(P + 'med-v1', JSON.stringify({ version: 2, archivedMeds: {}, meds: ${JSON.stringify(meds)} }));
    localStorage.setItem(P + 'entries-v1', JSON.stringify(${JSON.stringify(entries)}));
  })()`);
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(1100);
  const r = await page.evaluate(() => {
    const hero = document.querySelector('[data-home="up-next"]');
    // The ring is read from ANYWHERE on Home, not only from inside the hero: when every window is
    // either covered or already missed there is no hero at all, and the first version of this
    // suite could not see the count in exactly the cases the corpus cared about.
    const ring = document.querySelector('[aria-label*="scheduled doses logged"]');
    const all = document.body.innerText || '';
    return {
      hasHero: !!hero,
      due: !!hero && /Due now/.test(hero.textContent),
      ring: ring ? ring.getAttribute('aria-label') : null,
      // Read off the "all scheduled doses are in" panel by its words, which is the only thing that
      // distinguishes it; it carries no data- hook of its own and adding one is not this fix's job.
      allIn: /All scheduled doses are in/.test(all)
    };
  });
  await ctx.close();
  return r;
}

// ---- THE REPORTED BUG ------------------------------------------------------------------------
{
  const r = await home([win(EVENING)], [dose('a', H(16, 45))]);
  ok('a dose logged 15 minutes early stops the card asking for it', !r.due && r.allIn,
    JSON.stringify(r));
}
{
  // The far side of the grace: 2 hours is the bound, so 2h01m before is NOT this window's dose.
  // Without this the grace could be widened to the whole day and every check above still passes.
  const r = await home([win(EVENING)], [dose('a', H(14, 59))]);
  ok('a dose logged more than two hours early does NOT cover the window', r.due,
    JSON.stringify(r));
}
{
  const r = await home([win(EVENING)], [dose('a', H(17, 1))]);
  ok('a dose logged inside the window still clears it', !r.due && r.allIn, JSON.stringify(r));
}

// ---- THE RING AND THE CARD MUST AGREE ---------------------------------------------------------
{
  // Two windows, BOTH of the day's doses logged into the first. The evening window is genuinely
  // still due, and the ring must say one of two -- not two of two, which is what shipped.
  const r = await home([win(TWO)], [dose('a', H(9)), dose('b', H(10))]);
  ok('two doses in one window count as ONE window covered', /1 of 2/.test(r.ring || ''),
    'ring: ' + r.ring);
  ok('and the card still asks for the window that is genuinely open', r.due, JSON.stringify(r));
  ok('so the ring and the card do not contradict each other', /1 of 2/.test(r.ring || '') && r.due,
    'ring: ' + r.ring + ' due: ' + r.due);
}
{
  const r = await home([win(TWO)], [dose('a', H(9)), dose('b', H(17, 30))]);
  ok('one dose in each window clears the day', !r.due && r.allIn, JSON.stringify(r));
}

// ---- v68 MUST STILL HOLD: A LATE DOSE CREDITS THE WINDOW IT WAS LATE FOR -----------------------
{
  // Windows 8-12 and 17-21, one dose at 13:00. v68: that dose belongs to the 8am window it was
  // late for, and must NOT be stolen by the evening window just because 13:00 is also before it.
  // If it were stolen, the morning would read as missed and the evening as covered -- both wrong.
  const r = await home([win(TWO)], [dose('a', H(13))]);
  ok('a late dose credits the window it was late for, not the next one (v68)', r.due,
    JSON.stringify(r));
  ok('and the ring counts it as one of two', /1 of 2/.test(r.ring || ''), 'ring: ' + r.ring);
}

// ---- A DOSE GIVEN FOR *THIS* WINDOW IS NOT STOLEN BY AN EARLIER ONE ---------------------------
// Both of these came from the mutant corpus, which found a real flaw in the first version of the
// fix: with a single claim pass in window order, the MORNING window took a dose logged at 16:00 as
// a late catch-up, so the app turned round at 17:00 and asked for the evening dose that had just
// been given -- Aaron's original complaint in a different hat.
{
  // 16:00 is four hours after the morning window closed AND one hour before the evening one opens.
  // Both have a claim. The dose was given for the evening, so the evening gets it and the morning
  // is the one that reads as missed.
  const r = await home([win(TWO)], [dose('a', H(16))]);
  // The discriminator is `allIn`, not `due`. Claiming it for the evening leaves the MORNING
  // uncovered and in the past -- a missed dose, so the day is not "all in". A rule that let both
  // windows take the same dose would report the day complete and nothing would ever be flagged.
  ok('a dose an hour before a window belongs to THAT window, not to an earlier one',
    !r.due && !r.allIn && /1 of 2/.test(r.ring || ''), JSON.stringify(r));
}
{
  // The same thing from the other side: a dose at 18:00 is inside the evening window and the
  // morning window must not reach forward and swallow it.
  const r = await home([win(TWO)], [dose('a', H(18))]);
  ok('a dose inside a window is never claimed by an earlier window', !r.due,
    JSON.stringify(r));
  ok('and the day still reads as one of two covered', /1 of 2/.test(r.ring || ''), 'ring: ' + r.ring);
}

// ---- NOTHING LOGGED AT ALL --------------------------------------------------------------------
{
  const r = await home([win(EVENING)], []);
  ok('with nothing logged the card asks for the dose', r.due, JSON.stringify(r));
  ok('and the ring reads none of one', /0 of 1/.test(r.ring || ''), 'ring: ' + r.ring);
}

// ---- THE NOTIFICATION PATH. THE SCREEN STOPPED ASKING; THE PHONE DID NOT. ---------------------
// This is what the independent audit refused app-v94's first build over, and it is the half that
// reaches somebody who is not looking at the app -- which on a medication tracker at 5am is most
// of the time. Every check here reads a DECISION (the armed plan, the shipped predicate, the
// claim cancel-on-log keys off), never a rendered string.
async function notif(meds, entries, clock) {
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
  await ctx.addInitScript(freezeAt(clock || FROZEN));
  const page = await ctx.newPage();
  await page.addInitScript(`(() => {
    const P = 'chemowell-app-p-p1-';
    localStorage.setItem('chemowell-app-profiles-v1', JSON.stringify({ list: [{ id: 'p1', name: 'Aaron', createdAt: 1 }], activeId: 'p1' }));
    localStorage.setItem('chemowell-app-license-v1', JSON.stringify({ tier: 'free' }));
    localStorage.setItem(P + 'prefs-v1', JSON.stringify({ patientName: 'Aaron', onboarded: true, treatmentType: 'chemo', tourDone: true }));
    localStorage.setItem(P + 'med-v1', JSON.stringify({ version: 2, archivedMeds: {}, meds: ${JSON.stringify(meds)} }));
    localStorage.setItem(P + 'entries-v1', JSON.stringify(${JSON.stringify(entries)}));
  })()`);
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(1100);
  const r = await page.evaluate((d0) => {
    const t = window.__v86Test;
    // TODAY'S alarms only. The plan runs a 72-hour horizon, so tomorrow and the day after are
    // legitimately armed in every fixture here and would swamp the one day under test. Comparing
    // whole plans is how the first version of this check reported three armed alarms either way
    // and looked like a defect that was not there.
    const today = t.reminderPlan().filter(n => n.kind === 'dose' && n.tag.indexOf('-' + d0) !== -1);
    return {
      doseTags: today.map(n => n.tag + '@' + n.at).sort(),
      due0: t.medWindowDue('bp2', 0),
      due1: t.medWindowDue('bp2', 1),
      reactive: t.dueReminderKeys(),
      claims: t.windowClaimTs('bp2')
    };
  }, D0);
  await ctx.close();
  return r;
}

{
  // THE DEFECT, IN ONE ASSERTION. Aaron's own fixture against a day with nothing logged, read at
  // 16:50 -- five minutes after he logged the dose and ten minutes before the phone would go off.
  const given = await notif([win(EVENING)], [dose('a', H(16, 45))], BEFORE);
  const nothing = await notif([win(EVENING)], [], BEFORE);
  ok('nothing logged arms tonight\'s dose alarm', nothing.doseTags.length === 1,
    JSON.stringify(nothing.doseTags));
  ok('a dose logged 15 minutes early DROPS that alarm from the plan',
    given.doseTags.length === 0, JSON.stringify(given.doseTags));
  ok('so the armed plan is not identical to a day with nothing logged',
    given.doseTags.join('|') !== nothing.doseTags.join('|'),
    'given: ' + JSON.stringify(given.doseTags) + ' nothing: ' + JSON.stringify(nothing.doseTags));
  // The predicate the plan and the app-icon badge both ask.
  ok('the shipped predicate says that window is no longer due', given.due0 === false, String(given.due0));
  ok('and still says it IS due when nothing is logged', nothing.due0 === true, String(nothing.due0));
}
{
  // The far side of the grace, on the notification path too -- otherwise the bound could be
  // widened to the whole day and every check above would still pass.
  const r = await notif([win(EVENING)], [dose('a', H(14, 59))], BEFORE);
  ok('a dose more than two hours early leaves the alarm armed', r.doseTags.length === 1,
    JSON.stringify(r.doseTags));
}
{
  // THE REACTIVE WEB PATH has its own loop over the windows, so a mutant that reverts only that
  // line leaves the predicate above correct and must still be caught. It fires only in a window's
  // first five minutes, so this one is read at 17:03, inside that five, where the plan question
  // above no longer exists -- two clocks, each where its own question lives.
  const given = await notif([win(EVENING)], [dose('a', H(16, 45))], FROZEN);
  const nothing = await notif([win(EVENING)], [], FROZEN);
  ok('the reactive notification does not fire for a dose logged early', given.reactive.length === 0,
    JSON.stringify(given.reactive));
  ok('and does fire when nothing is logged', nothing.reactive.length === 1,
    JSON.stringify(nothing.reactive));
}
{
  // CANCEL-ON-LOG asks which window the dose covers. With windows at 8 and 17 and one dose at
  // 16:45, the answer must be "the evening one" -- the old test answered "none of them", so the
  // alarm the audit found armed also never got cancelled when the caregiver logged the dose.
  const r = await notif([win(TWO)], [dose('a', H(16, 45))], BEFORE);
  ok('cancel-on-log credits the dose to the window it was given for',
    r.claims[0] === null && r.claims[1] === H(16, 45), JSON.stringify(r.claims));
  ok('and tonight\'s alarm is dropped while the morning stays missed, not armed',
    r.doseTags.length === 0, JSON.stringify(r.doseTags));
}

// ---- WHICH WINDOW IS CREDITED FOR A DOSE LOGGED IN A GAP (closes BACKLOG M44's hole) ----------
// M44 recorded this as unobservable, and it was -- from the Home screen, which is all this suite
// could read at the time. It is observable now, because cancel-on-log needs to know which window a
// dose belongs to and so the claim became readable. Windows 6-8 and 11-13, one dose at 16:00:
// the later window's late reach runs to midnight and takes it. If the EARLIER window's reach also
// ran to midnight it would take it instead, and the wrong window would be recorded as missed.
{
  const r = await notif([win(GAP)], [dose('a', H(16))], FROZEN);
  ok('a dose in a gap is credited to the last window, not the first',
    r.claims[0] === null && r.claims[1] === H(16), JSON.stringify(r.claims));
}

// ---- CANCEL-ON-LOG, THROUGH THE REAL FUNCTION AND A STUBBED BRIDGE ----------------------------
// The claim check above reads the WALK, and a mutant reverting cancelReminderForEntry's own guard
// to the old inside-the-window test survived it: that mutant does not touch the walk. This drives
// the shipped function and watches what reaches the plugin's cancel().
//
// The clock is 16:50 and the fixture logs NOTHING at boot, deliberately: the alarm has to be armed
// before there is anything to cancel. Then the entry is handed to the shipped function exactly as
// the write path hands it over.
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, timezoneId: 'UTC' });
  await ctx.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith('http://127.0.0.1')) return route.continue();
    if (u.includes('cdn.jsdelivr.net')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: '/* stubbed */' });
    return route.abort();
  });
  await ctx.addInitScript(freezeAt(BEFORE));
  const page = await ctx.newPage();
  await page.addInitScript(`(() => {
    const P = 'chemowell-app-p-p1-';
    localStorage.setItem('chemowell-app-profiles-v1', JSON.stringify({ list: [{ id: 'p1', name: 'Aaron', createdAt: 1 }], activeId: 'p1' }));
    localStorage.setItem('chemowell-app-license-v1', JSON.stringify({ tier: 'free' }));
    localStorage.setItem(P + 'prefs-v1', JSON.stringify({ patientName: 'Aaron', onboarded: true, treatmentType: 'chemo', tourDone: true }));
    localStorage.setItem(P + 'med-v1', JSON.stringify({ version: 2, archivedMeds: {}, meds: ${JSON.stringify([win(EVENING)])} }));
    localStorage.setItem(P + 'entries-v1', JSON.stringify([]));
    window.__cancelled = [];
    const ln = {
      getPending: async () => ({ notifications: [] }),
      cancel: async (o) => { ((o && o.notifications) || []).forEach(n => window.__cancelled.push(n.id)); },
      schedule: async () => {}, createChannel: async () => {},
      checkPermissions: async () => ({ display: 'granted' }),
      requestPermissions: async () => ({ display: 'granted' }),
      checkExactNotificationSetting: async () => ({ exact_alarm: 'granted' }),
      addListener: () => ({ remove: () => {} }), removeAllListeners: async () => {}
    };
    window.Capacitor = { isNativePlatform: () => true, Plugins: { LocalNotifications: ln } };
  })()`);
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  const r = await page.evaluate(async (ts) => {
    const t = window.__v86Test;
    const armed = t.armedTags().filter(a => a.tag.indexOf('dose-') === 0);
    const tonight = armed.find(a => /-17-21-/.test(a.tag));
    window.__cancelled.length = 0;
    await t.cancelForEntry({ medId: 'bp2', ts: ts });
    await new Promise(res => setTimeout(res, 300));
    return { armedCount: armed.length, tonightId: tonight ? tonight.id : null, cancelled: window.__cancelled.slice() };
  }, H(16, 45));
  await ctx.close();
  ok('tonight\'s dose alarm is armed before anything is logged', r.tonightId !== null,
    JSON.stringify(r));
  ok('logging the dose 15 minutes early CANCELS that armed alarm',
    r.tonightId !== null && r.cancelled.indexOf(r.tonightId) !== -1, JSON.stringify(r));
}

// ---- SILENCING A PROFILE MUST NOT TAKE THEIR APPOINTMENT ALARMS (app-v93's BLOCK) -------------
// The audit's F1: the fix for that block shipped with zero checks and zero mutants behind it.
// The bridge is stubbed because the decision is on this side of it -- what reaches cancel().
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, timezoneId: 'UTC' });
  await ctx.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith('http://127.0.0.1')) return route.continue();
    if (u.includes('cdn.jsdelivr.net')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: '/* stubbed */' });
    return route.abort();
  });
  await ctx.addInitScript(freeze);
  const page = await ctx.newPage();
  await page.addInitScript(`(() => {
    const P = 'chemowell-app-p-p1-';
    localStorage.setItem('chemowell-app-profiles-v1', JSON.stringify({ list: [
      { id: 'p1', name: 'Aaron', createdAt: 1 }, { id: 'p2', name: 'Sam', createdAt: 2 }], activeId: 'p1' }));
    localStorage.setItem('chemowell-app-license-v1', JSON.stringify({ tier: 'plus' }));
    localStorage.setItem(P + 'prefs-v1', JSON.stringify({ patientName: 'Aaron', onboarded: true, treatmentType: 'chemo', tourDone: true }));
    // A stubbed Capacitor bridge. getPending answers with one dose alarm, one check-in and one
    // APPOINTMENT for the profile about to be silenced, and cancel() records what it was asked to
    // remove. Everything else is a no-op so the app's own sync cannot throw.
    window.__cancelled = [];
    const ln = {
      getPending: async () => ({ notifications: [
        { id: 101, extra: { profileId: 'p2', kind: 'dose' } },
        { id: 102, extra: { profileId: 'p2', kind: 'appt' } },
        { id: 103, extra: { profileId: 'p2', kind: 'checkin' } },
        { id: 104, extra: { profileId: 'p1', kind: 'dose' } },
        { id: 105, extra: {} }
      ] }),
      cancel: async (o) => { ((o && o.notifications) || []).forEach(n => window.__cancelled.push(n.id)); },
      schedule: async () => {}, createChannel: async () => {},
      checkPermissions: async () => ({ display: 'granted' }),
      requestPermissions: async () => ({ display: 'granted' }),
      checkExactNotificationSetting: async () => ({ exact_alarm: 'granted' }),
      addListener: () => ({ remove: () => {} }), removeAllListeners: async () => {}
    };
    window.Capacitor = { isNativePlatform: () => true, Plugins: { LocalNotifications: ln } };
  })()`);
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  const r = await page.evaluate(async () => {
    window.__cancelled.length = 0;              // ignore anything the app's own sync did on boot
    await window.__v86Test.setProfileMuted('p2', true);
    await new Promise(res => setTimeout(res, 400));
    return { cancelled: window.__cancelled.slice(), muted: window.__v86Test.profileIsMuted('p2') };
  });
  await ctx.close();
  ok('silencing a profile records the mute', r.muted === true, JSON.stringify(r));
  ok('silencing cancels their DOSE alarm', r.cancelled.indexOf(101) !== -1, JSON.stringify(r.cancelled));
  ok('silencing cancels their check-in alarm', r.cancelled.indexOf(103) !== -1, JSON.stringify(r.cancelled));
  ok('SILENCING DOES NOT TOUCH THEIR APPOINTMENT ALARM — the app-v93 BLOCK',
    r.cancelled.indexOf(102) === -1, JSON.stringify(r.cancelled));
  ok('and does not touch another profile\'s alarms', r.cancelled.indexOf(104) === -1,
    JSON.stringify(r.cancelled));
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
console.log('PASS — one answer to "has this dose been given", and the ring agrees with the card.');
