// Lead Designer independent re-verification of the v35 notif-card fix (commit 171e702).
// Run: node lead_designer_v35_verify.mjs   (uses BASE_PORT env, default 8917)
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';

const PORT = process.env.BASE_PORT || '8917';
const BASE = 'http://127.0.0.1:' + PORT + '/index.html';
const DAY = 86400000;
const at = (d, h, m) => new Date(2026, 7, 11 + d, h, m || 0, 0, 0).getTime();
const CAP_CORE = /cdn\.jsdelivr\.net\/npm\/@capacitor\/core@/;
const CAP_LN = /cdn\.jsdelivr\.net\/npm\/@capacitor\/local-notifications@/;

function installFakeClock(offsetMs) {
  const RealDate = Date;
  window.__clockOffset = offsetMs;
  function FakeDate(...args) { if (args.length === 0) return new RealDate(RealDate.now() + window.__clockOffset); return new RealDate(...args); }
  FakeDate.prototype = RealDate.prototype;
  FakeDate.now = () => RealDate.now() + window.__clockOffset;
  FakeDate.parse = RealDate.parse; FakeDate.UTC = RealDate.UTC;
  window.Date = FakeDate;
  class FakeNotification { static permission = 'granted'; static requestPermission() { return Promise.resolve('granted'); } constructor() {} }
  window.Notification = FakeNotification;
}
function installCapacitorStub(cfg) {
  const rec = { scheduled: [], cancelled: [], channels: [], pending: [], permState: cfg.permState || 'granted', exactState: cfg.exactState || 'granted', scheduleCalls: 0, failAlways: !!cfg.failAlways, reqPermCalls: 0 };
  window.__ln = rec;
  const delay = (ms) => new Promise(r => setTimeout(r, ms));
  const flatten = (n) => ({ id: n.id, title: n.title, body: n.body, at: (n.schedule && n.schedule.at) ? new Date(n.schedule.at).getTime() : null, extra: n.extra || null });
  const LN = {
    async checkPermissions() { if (cfg.checkPermDelayMs) await delay(cfg.checkPermDelayMs); return { display: rec.permState }; },
    // Real OS behavior: calling requestPermissions() when already denied/undecided does not silently
    // grant. The app calls this unconditionally at boot (subscribePush -> requestNotifPermission), so
    // to render a stable 'blocked'/'not_asked' state the stub must not auto-upgrade permission on that
    // boot-time call -- only on an explicit post-click grant when cfg.grantOnNthRequest is reached.
    async requestPermissions() {
      rec.reqPermCalls++;
      if (cfg.slowRequest) await delay(cfg.slowRequest);
      if (cfg.grantOnNthRequest && rec.reqPermCalls >= cfg.grantOnNthRequest) rec.permState = 'granted';
      return { display: rec.permState };
    },
    async createChannel(c) { rec.channels.push(c); },
    async listChannels() { return { channels: rec.channels.slice() }; },
    async getPending() { if (cfg.slowGetPending) await delay(cfg.slowGetPending); return { notifications: rec.pending.map(n => ({ id: n.id, title: n.title, body: n.body, extra: n.extra })) }; },
    async cancel(o) { const ids = ((o && o.notifications) || []).map(n => n.id); rec.cancelled.push(ids); rec.pending = rec.pending.filter(n => ids.indexOf(n.id) === -1); },
    async schedule(o) {
      rec.scheduleCalls++;
      if (rec.failAlways) throw new Error('java.lang.SecurityException: exact alarms revoked');
      const list = ((o && o.notifications) || []).map(flatten); rec.scheduled.push(list);
      list.forEach(n => { rec.pending = rec.pending.filter(p => p.id !== n.id); rec.pending.push(n); });
    },
    async checkExactNotificationSetting() { return { exact_alarm: rec.exactState }; },
    async changeExactNotificationSetting() { if (cfg.slowRequest) await delay(cfg.slowRequest); rec.exactState = 'granted'; return { exact_alarm: 'granted' }; },
    async areEnabled() { return { value: true }; },
    async registerActionTypes() { }, async removeAllDeliveredNotifications() { },
    async getDeliveredNotifications() { return { notifications: [] }; },
    async addListener() { return { remove() { } }; }, async removeAllListeners() { }
  };
  if (cfg.noExactMethod) delete LN.changeExactNotificationSetting;
  window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android', isPluginAvailable: () => true, convertFileSrc: s => s, Plugins: { LocalNotifications: LN } };
}
function installSeed(seed) {
  const P = 'chemowell-app-p-p1-';
  localStorage.setItem('chemowell-app-profiles-v1', JSON.stringify({ activeId: 'p1', list: [{ id: 'p1', name: 'Test Patient' }] }));
  localStorage.setItem(P + 'prefs-v1', JSON.stringify({ patientName: 'Test Patient', sex: 'female', treatmentType: 'chemo', installedAt: Date.now() - 30 * 86400000, tourDone: true }));
  localStorage.setItem(P + 'med-v1', JSON.stringify({ version: 1, meds: seed.meds || [], archivedMeds: [] }));
  localStorage.setItem(P + 'entries-v1', JSON.stringify(seed.entries || []));
  localStorage.setItem(P + 'appts-v1', JSON.stringify(seed.appts || []));
}
const med = (id, name, windows) => ({ id, name, sub: '', type: 'win', windows, alerts: true, quickLog: true, createdAt: Date.now() - 40 * DAY });
const MEDS = [
  med('m-zof', 'Zofran', [{ start: 9, end: 12, name: 'Morning' }, { start: 18, end: 21, name: 'Evening' }]),
  med('m-dex', 'Dexamethasone', [{ start: 8, end: 10, name: 'Morning' }]),
];
const APPTS = [{ id: 'a1', title: 'Infusion', note: '', ts: at(1, 14, 0), reminder: '1h', reminded: false }];

async function openPage(browser, cfg, width) {
  const context = await browser.newContext({ viewport: { width: width || 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|ERR_FAILED|ERR_NAME_NOT_RESOLVED|favicon/.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.route(CAP_CORE, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: '/*stub*/' }));
  await page.route(CAP_LN, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: '/*stub*/' }));
  await page.addInitScript(installFakeClock, (cfg.fakeNow || at(0, 10, 0)) - Date.now());
  await page.addInitScript(installCapacitorStub, cfg);
  await page.addInitScript(installSeed, { meds: cfg.meds || MEDS, entries: cfg.entries || [], appts: cfg.appts || APPTS });
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(cfg.settleMs === undefined ? 2200 : cfg.settleMs);
  return { context, page, errors };
}
async function gotoSettings(page) {
  const onSettings = () => page.evaluate(() => !!(document.body && document.body.innerText.indexOf('Readings are shown in your chosen units everywhere') !== -1));
  for (let i = 0; i < 4 && !(await onSettings()); i++) {
    await page.evaluate(() => { const bt = document.querySelector('header button'); if (bt) bt.click(); });
    await page.waitForTimeout(400);
    await page.evaluate(() => { const el = Array.from(document.querySelectorAll('button,div')).find(x => x.innerText && x.innerText.trim() === 'Settings'); if (el) el.click(); });
    await page.waitForTimeout(900);
  }
  if (!(await onSettings())) throw new Error('could not reach Settings');
}

const results = [];
function rec(id, desc, pass, detail) {
  results.push({ id, desc, pass });
  console.log('  ' + (pass ? 'PASS' : 'FAIL') + ' ' + id + ' — ' + desc);
  if (detail) console.log('         ' + detail);
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const OUT = '/home/claude/chemowell-app-beta/outputs';

// ============================================================
// PART A: real pointer-click on each of the 4 previously-broken buttons
// ============================================================
console.log('\n=== PART A: real getByRole pointer clicks on the 4 previously-broken buttons ===');

// A1 - blocked / "Try again"
{
  const { context, page, errors } = await openPage(browser, { permState: 'denied', grantOnNthRequest: 2 });
  await gotoSettings(page);
  const cardBefore = await page.evaluate(() => (document.body.innerText || '').indexOf('Notifications are blocked for ChemoWell') !== -1);
  const callsBefore = await page.evaluate(() => window.__ln.reqPermCalls);
  const btn = page.getByRole('button', { name: 'Try again' });
  const enabledBefore = await btn.isEnabled();
  let clickErr = null;
  try { await btn.click({ timeout: 4000 }); } catch (e) { clickErr = e.message; }
  await page.waitForTimeout(600);
  const callsAfter = await page.evaluate(() => window.__ln.reqPermCalls);
  const permAfter = await page.evaluate(() => window.__ln.permState);
  const pass = cardBefore && enabledBefore && !clickErr && callsAfter > callsBefore && permAfter === 'granted';
  rec('A1-blocked', '"Try again" in blocked state is enabled and a real pointer click fires retryNotifPermission (requestPermissions call count increments)', pass,
    'cardShowsBlocked=' + cardBefore + ' enabledBefore=' + enabledBefore + ' clickErr=' + clickErr + ' reqPermCalls ' + callsBefore + '->' + callsAfter + ' permStateAfter=' + permAfter);
  await context.close();
}

// A2 - failed / "Try again"
{
  const { context, page, errors } = await openPage(browser, { fakeNow: at(0, 17, 55) });
  await page.evaluate(() => {
    window.__scheduleAttempts = 0;
    window.Capacitor.Plugins.LocalNotifications.schedule = async () => { window.__scheduleAttempts++; throw new Error('java.lang.SecurityException: exact alarms revoked'); };
  });
  await page.evaluate(() => { window.__clockOffset += 20 * 60 * 1000; });
  await gotoSettings(page);
  await page.evaluate(() => {
    const t = Array.from(document.querySelectorAll('[role="button"]')).find(x => /beta date controls/i.test(x.innerText || ''));
    if (t && t.getAttribute('aria-expanded') !== 'true') t.click();
  });
  await page.waitForTimeout(500);
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => (x.innerText || '').trim() === '+ 1 Day'); if (b) b.click(); });
  await page.waitForTimeout(600);
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => (x.innerText || '').trim() === 'Reset'); if (b) b.click(); });
  await page.waitForTimeout(2200);
  const cardShowsFailed = await page.evaluate(() => (document.body.innerText || '').indexOf('Reminders couldn’t be set on this device') !== -1);
  const before = await page.evaluate(() => window.__scheduleAttempts);
  const btn = page.getByRole('button', { name: 'Try again' });
  const enabledBefore = await btn.isEnabled();
  let clickErr = null;
  try { await btn.click({ timeout: 4000 }); } catch (e) { clickErr = e.message; }
  await page.waitForTimeout(1200);
  const after = await page.evaluate(() => window.__scheduleAttempts);
  const pass = cardShowsFailed && enabledBefore && !clickErr && after > before;
  rec('A2-failed', '"Try again" in failed state is enabled and a real pointer click fires syncNativeReminders(force) — schedule() re-attempted', pass,
    'cardShowsFailed=' + cardShowsFailed + ' enabledBefore=' + enabledBefore + ' clickErr=' + clickErr + ' scheduleAttempts ' + before + '->' + after);
  await context.close();
}

// A3 - not_asked / "Turn on notifications"
{
  const { context, page, errors } = await openPage(browser, { permState: 'prompt', grantOnNthRequest: 2 });
  await gotoSettings(page);
  const cardBefore = await page.evaluate(() => (document.body.innerText || '').indexOf('Notifications aren’t turned on yet') !== -1);
  const callsBefore = await page.evaluate(() => window.__ln.reqPermCalls);
  const btn = page.getByRole('button', { name: 'Turn on notifications' });
  const enabledBefore = await btn.isEnabled();
  let clickErr = null;
  try { await btn.click({ timeout: 4000 }); } catch (e) { clickErr = e.message; }
  await page.waitForTimeout(600);
  const callsAfter = await page.evaluate(() => window.__ln.reqPermCalls);
  const permAfter = await page.evaluate(() => window.__ln.permState);
  const pass = cardBefore && enabledBefore && !clickErr && callsAfter > callsBefore && permAfter === 'granted';
  rec('A3-not_asked', '"Turn on notifications" in not_asked state is enabled and a real pointer click fires retryNotifPermission (requestPermissions call count increments)', pass,
    'cardShowsNotAsked=' + cardBefore + ' enabledBefore=' + enabledBefore + ' clickErr=' + clickErr + ' reqPermCalls ' + callsBefore + '->' + callsAfter + ' permStateAfter=' + permAfter);
  await context.close();
}

// A4 - on-exact / "Allow exact reminders"
{
  const { context, page, errors } = await openPage(browser, { exactState: 'denied' });
  await gotoSettings(page);
  const btn = page.getByRole('button', { name: 'Allow exact reminders' });
  const enabledBefore = await btn.isEnabled();
  let clickErr = null;
  try { await btn.click({ timeout: 4000 }); } catch (e) { clickErr = e.message; }
  await page.waitForTimeout(1000);
  const toast = await page.evaluate(() => { const t = document.body.innerText || ''; const m = t.match(/(Exact reminders are allowed\.|Open your phone[^\n]*Alarms & reminders[^\n]*)/); return m ? m[1] : null; });
  const pass = enabledBefore && !clickErr && !!toast;
  rec('A4-on-exact', '"Allow exact reminders" in on-exact state is enabled and a real pointer click fires changeExactNotificationSetting (toast observed)', pass,
    'enabledBefore=' + enabledBefore + ' clickErr=' + clickErr + ' toast=' + JSON.stringify(toast));
  await context.close();
}

// ============================================================
// PART B: spacing measurement across 8 states
// ============================================================
console.log('\n=== PART B: gap between intro sentence and card first child, across 8 states ===');
const STATE_CFG = {
  blocked: { permState: 'denied' },
  failed: null, // constructed specially below (reuse A2 setup)
  not_asked: { permState: 'prompt' },
  'on-exact': { exactState: 'denied' },
  empty: { entries: [], appts: [], meds: [] },
  checking: null,
  paused_sim: null,
  on: {},
};

async function measureGap(page) {
  return await page.evaluate(() => {
    const secs = Array.from(document.querySelectorAll('section'));
    const notifSec = secs.find(s => (s.innerText || '').indexOf('NOTIFICATIONS') !== -1 || /notification/i.test(s.innerText || '') && /reminders? can reach you|status/i.test(s.innerText || ''));
    // Fallback: find the label 'Notifications' section explicitly.
    const target = secs.find(s => {
      const label = s.querySelector('div');
      return label && /^Notifications$/i.test((label.innerText || '').trim());
    }) || notifSec;
    if (!target) return { error: 'notification section not found' };
    const children = Array.from(target.children);
    // children: [header row?], intro caption paragraph, then the card wrapper (marginTop 10px flex col)
    // Find the caption (intro sentence) and the very next sibling element.
    let introIdx = -1;
    children.forEach((c, i) => { if (/reach you|status of your device|notification/i.test(c.innerText || '') && introIdx === -1 && c.children.length === 0) introIdx = i; });
    if (introIdx === -1 || introIdx + 1 >= children.length) return { error: 'could not locate intro/card pair', childCount: children.length, texts: children.map(c => (c.innerText || '').slice(0, 40)) };
    const intro = children[introIdx];
    const card = children[introIdx + 1];
    const introRect = intro.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    return { gap: Math.round((cardRect.top - introRect.bottom) * 100) / 100, introText: intro.innerText.slice(0, 50), cardFirstChildText: (card.firstElementChild ? card.firstElementChild.innerText : card.innerText || '').slice(0, 50) };
  });
}

async function gotoNotifSection(page) {
  await gotoSettings(page);
  // scroll to the Notifications heading if present, no-op if already visible; measurement uses getBoundingClientRect not viewport-relative pass/fail so scroll isn't required.
}

const gaps = {};
for (const [label, cfg] of Object.entries(STATE_CFG)) {
  let context, page;
  if (label === 'failed') {
    ({ context, page } = await openPage(browser, { fakeNow: at(0, 17, 55) }));
    await page.evaluate(() => { window.Capacitor.Plugins.LocalNotifications.schedule = async () => { throw new Error('boom'); }; });
    await page.evaluate(() => { window.__clockOffset += 20 * 60 * 1000; });
    await gotoNotifSection(page);
    await page.evaluate(() => {
      const t = Array.from(document.querySelectorAll('[role="button"]')).find(x => /beta date controls/i.test(x.innerText || ''));
      if (t && t.getAttribute('aria-expanded') !== 'true') t.click();
    });
    await page.waitForTimeout(500);
    await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => (x.innerText || '').trim() === '+ 1 Day'); if (b) b.click(); });
    await page.waitForTimeout(600);
    await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => (x.innerText || '').trim() === 'Reset'); if (b) b.click(); });
    await page.waitForTimeout(2200);
  } else if (label === 'checking') {
    ({ context, page } = await openPage(browser, { checkPermDelayMs: 15000, settleMs: 400 }));
    await gotoNotifSection(page);
    // status stays 'checking' for 15s in this cfg -- ample time to reach Settings and measure
  } else if (label === 'paused_sim') {
    ({ context, page } = await openPage(browser, {}));
    await gotoNotifSection(page);
    await page.evaluate(() => {
      const t = Array.from(document.querySelectorAll('[role="button"]')).find(x => /beta date controls/i.test(x.innerText || ''));
      if (t && t.getAttribute('aria-expanded') !== 'true') t.click();
    });
    await page.waitForTimeout(500);
    await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => (x.innerText || '').trim() === '+ 1 Day'); if (b) b.click(); });
    await page.waitForTimeout(800);
  } else {
    ({ context, page } = await openPage(browser, cfg));
    await gotoNotifSection(page);
  }
  const m = await measureGap(page);
  gaps[label] = m;
  console.log('  ' + label + ': ' + JSON.stringify(m));
  await context.close();
}
const gapValues = Object.entries(gaps).filter(([k, v]) => typeof v.gap === 'number').map(([k, v]) => v.gap);
const allSame = gapValues.length >= 6 && gapValues.every(g => Math.abs(g - gapValues[0]) < 0.5);
rec('B1-spacing', 'gap between intro sentence and card is consistent across states (' + gapValues.length + '/8 measured)', allSame, JSON.stringify(gaps));

// ============================================================
// PART C: busy-state visual check + 320px checks on the 4 broken states + spot re-checks
// ============================================================
console.log('\n=== PART C: busy-state visual, 320px on broken states, spot re-checks ===');

// C1: busy visual. First attempt (permState stays 'denied' throughout) showed the busy window is
// essentially never observable for retryNotifPermission from the 'blocked'/'not_asked' states,
// because syncNativeReminders() short-circuits instantly (before it ever reaches the slowed
// getPending()) whenever notifPermState !== 'granted' -- so notifActionBusy flips back to false
// within the same microtask burst as the click, no real async gap, nothing paints as disabled.
// To find a genuinely observable busy window, grant permission on click (grantOnNthRequest) so
// syncNativeReminders() actually proceeds past that early-return into its (slowed) getPending()
// call. Using not_asked+exact-denied: granting permission transitions the card from 'not_asked' to
// 'on-exact', which still has a button ("Allow exact reminders") -- so we can inspect whether
// notifActionBusy's disabled state is visible on *that* newly-rendered button during the gap.
{
  const { context, page } = await openPage(browser, { permState: 'prompt', exactState: 'denied', grantOnNthRequest: 2, slowGetPending: 3000 });
  await gotoSettings(page);
  const btn = page.getByRole('button', { name: 'Turn on notifications' });
  await btn.click();
  await page.waitForTimeout(600); // after refreshNativeNotifStatus's mid-flow setState, well before the slowed getPending() resolves
  const mid = await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find(x => (x.innerText || '').trim() === 'Allow exact reminders');
    if (!b) return { found: false };
    const cs = getComputedStyle(b);
    return { found: true, disabled: b.disabled, bg: cs.backgroundColor, opacity: cs.opacity, cursor: cs.cursor, pointerEvents: cs.pointerEvents };
  });
  await page.screenshot({ path: OUT + '/lead_designer_v35_busy_disabled_visual.png' });
  const mechanismWorks = mid.found && mid.disabled === true;
  // Even when it IS genuinely disabled mid-flow, is it visually distinguishable from enabled? (full
  // opacity + same bg + pointer cursor = no, matching the exact "invisible disabled" pattern the
  // Designer's original blocker finding described for the permanent case.)
  const looksIdenticalToEnabled = mid.found && mid.opacity === '1' && mid.cursor === 'pointer';
  rec('C1a-busy-mechanism', 'notifActionBusy DOES reach a genuine async gap and render disabled=true on a live button (proven via a state transition that keeps a button on screen)', mechanismWorks,
    'mid=' + JSON.stringify(mid));
  rec('C1b-busy-visual-affordance', 'INFO (not pass/fail on its own): while genuinely disabled mid-busy, the button is visually IDENTICAL to enabled (opacity 1, same bg, cursor pointer) -- no dimming/spinner, so on the rare occasions this window is wide enough to be seen, a caregiver gets no visual cue anything is happening', !looksIdenticalToEnabled,
    'mid=' + JSON.stringify(mid));
  await page.waitForTimeout(2000);
  await context.close();
}
// C1c: the common-case check -- from 'blocked' with permission staying denied (the realistic retry
// failure case), confirm the busy window is in practice NOT observable (near-zero width) because
// syncNativeReminders short-circuits before its slow call is ever reached. This documents *why*
// C1a needed a special setup, and shows the common-case flows never visibly gray out at all.
{
  const { context, page } = await openPage(browser, { permState: 'denied', slowGetPending: 3000 });
  await gotoSettings(page);
  const btn = page.getByRole('button', { name: 'Try again' });
  await btn.click();
  await page.waitForTimeout(500);
  const stillEnabled = await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find(x => (x.innerText || '').trim() === 'Try again');
    return b ? !b.disabled : null;
  });
  rec('C1c-busy-common-case', 'INFO: from blocked (permission stays denied), the retry click never visibly disables the button at all -- syncNativeReminders short-circuits before the busy window is wide enough to render', stillEnabled === true,
    'stillEnabledAt500ms=' + stillEnabled);
  await context.close();
}

// C2: 320px screenshots + no-overflow check for the 4 previously-broken states
const BROKEN_STATES = {
  blocked: { permState: 'denied' },
  not_asked: { permState: 'prompt' },
  'on-exact': { exactState: 'denied' },
};
for (const [label, cfg] of Object.entries(BROKEN_STATES)) {
  const { context, page } = await openPage(browser, cfg, 320);
  await gotoSettings(page);
  const overflow = await page.evaluate(() => {
    const secs = Array.from(document.querySelectorAll('section'));
    const target = secs.find(s => { const label = s.querySelector('div'); return label && /^Notifications$/i.test((label.innerText || '').trim()); });
    if (!target) return { error: 'not found' };
    return { scrollWidth: target.scrollWidth, clientWidth: target.clientWidth, overflowing: target.scrollWidth > target.clientWidth + 1 };
  });
  await page.screenshot({ path: OUT + '/lead_designer_v35_' + label + '_320_full.png', fullPage: true });
  rec('C2-320-' + label, '320px width, ' + label + ' state: no horizontal overflow in Notifications section', !overflow.overflowing, JSON.stringify(overflow));
  await context.close();
}
// also failed at 320
{
  const { context, page } = await openPage(browser, { fakeNow: at(0, 17, 55) }, 320);
  await page.evaluate(() => { window.Capacitor.Plugins.LocalNotifications.schedule = async () => { throw new Error('boom'); }; });
  await page.evaluate(() => { window.__clockOffset += 20 * 60 * 1000; });
  await gotoSettings(page);
  await page.evaluate(() => {
    const t = Array.from(document.querySelectorAll('[role="button"]')).find(x => /beta date controls/i.test(x.innerText || ''));
    if (t && t.getAttribute('aria-expanded') !== 'true') t.click();
  });
  await page.waitForTimeout(500);
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => (x.innerText || '').trim() === '+ 1 Day'); if (b) b.click(); });
  await page.waitForTimeout(600);
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => (x.innerText || '').trim() === 'Reset'); if (b) b.click(); });
  await page.waitForTimeout(2200);
  const overflow = await page.evaluate(() => {
    const secs = Array.from(document.querySelectorAll('section'));
    const target = secs.find(s => { const label = s.querySelector('div'); return label && /^Notifications$/i.test((label.innerText || '').trim()); });
    if (!target) return { error: 'not found' };
    return { scrollWidth: target.scrollWidth, clientWidth: target.clientWidth, overflowing: target.scrollWidth > target.clientWidth + 1 };
  });
  await page.screenshot({ path: OUT + '/lead_designer_v35_failed_320_full.png', fullPage: true });
  rec('C2-320-failed', '320px width, failed state: no horizontal overflow in Notifications section', !overflow.overflowing, JSON.stringify(overflow));
  await context.close();
}

// C3: contrast spot-check (independent recompute), amber text vs white bg
function relLum([r, g, b]) {
  const c = [r, g, b].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contrast(rgb1, rgb2) {
  const L1 = relLum(rgb1), L2 = relLum(rgb2);
  const [hi, lo] = L1 > L2 ? [L1, L2] : [L2, L1];
  return (hi + 0.05) / (lo + 0.05);
}
{
  const { context, page } = await openPage(browser, { permState: 'prompt' });
  await gotoSettings(page);
  const color = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('div')).find(x => (x.innerText || '').trim() === 'Notifications aren’t turned on yet');
    return el ? getComputedStyle(el).color : null;
  });
  let ratio = null;
  if (color) {
    const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (m) ratio = contrast([Number(m[1]), Number(m[2]), Number(m[3])], [255, 255, 255]);
  }
  rec('C3-contrast', 'amber headline text ("not_asked") vs white background computed contrast >= 4.5:1 AA', ratio !== null && ratio >= 4.5, 'color=' + color + ' ratio=' + (ratio ? ratio.toFixed(2) : null));
  await context.close();
}

// C4: 44px touch target spot check, independently measured, for a previously-broken button
{
  const { context, page } = await openPage(browser, { exactState: 'denied' });
  await gotoSettings(page);
  const box = await page.getByRole('button', { name: 'Allow exact reminders' }).boundingBox();
  rec('C4-touch-target', '"Allow exact reminders" button height >= 44px', !!box && box.height >= 44, 'box=' + JSON.stringify(box));
  await context.close();
}

// C5: copy tone spot check — pull live rendered text (not the report) for one state
{
  const { context, page } = await openPage(browser, { fakeNow: at(0, 17, 55) });
  await page.evaluate(() => { window.Capacitor.Plugins.LocalNotifications.schedule = async () => { throw new Error('boom'); }; });
  await page.evaluate(() => { window.__clockOffset += 20 * 60 * 1000; });
  await gotoSettings(page);
  await page.evaluate(() => {
    const t = Array.from(document.querySelectorAll('[role="button"]')).find(x => /beta date controls/i.test(x.innerText || ''));
    if (t && t.getAttribute('aria-expanded') !== 'true') t.click();
  });
  await page.waitForTimeout(500);
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => (x.innerText || '').trim() === '+ 1 Day'); if (b) b.click(); });
  await page.waitForTimeout(600);
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => (x.innerText || '').trim() === 'Reset'); if (b) b.click(); });
  await page.waitForTimeout(2200);
  const bodyText = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('div')).find(x => x.children.length === 0 && (x.innerText || '').indexOf('Something went wrong scheduling reminders') !== -1);
    return el ? el.innerText : null;
  });
  const noJargon = bodyText && !/exception|stack|null|undefined|NaN|SecurityException/i.test(bodyText);
  rec('C5-copy-tone', 'failed-state body copy freshly read from live DOM contains no stack-trace/jargon leakage', !!noJargon, 'text=' + JSON.stringify(bodyText));
  await context.close();
}

await browser.close();
const failed = results.filter(r => !r.pass);
console.log('\n============================================================');
console.log(failed.length === 0 ? 'LEAD DESIGNER VERIFY: ALL PASS (' + results.length + '/' + results.length + ')' : 'LEAD DESIGNER VERIFY: FAIL — ' + failed.map(f => f.id).join(', '));
console.log('============================================================');
fs.writeFileSync(OUT + '/lead_designer_v35_results.json', JSON.stringify({ results, gaps }, null, 2));
process.exit(0);
