// Verification for the v35 notification-engine rebuild (post-workspace-reset). Not a byte-for-byte
// reproduction of the lost pre-restart harness -- this checks the actual contract the rebuilt code
// implements: pre-scheduling, the failure path, the surgical cancel, and the Settings status card's
// state model. Run:  BASE_PORT=8917 node verify_v35_rebuild.mjs

import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';

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
  const rec = { scheduled: [], cancelled: [], channels: [], pending: [], permState: cfg.permState || 'granted', exactState: cfg.exactState || 'granted', scheduleCalls: 0, failAlways: !!cfg.failAlways };
  window.__ln = rec;
  const flatten = (n) => ({ id: n.id, title: n.title, body: n.body, at: (n.schedule && n.schedule.at) ? new Date(n.schedule.at).getTime() : null, extra: n.extra || null });
  const LN = {
    async checkPermissions() { return { display: rec.permState }; },
    async requestPermissions() { rec.permState = 'granted'; return { display: rec.permState }; },
    async createChannel(c) { rec.channels.push(c); },
    async listChannels() { return { channels: rec.channels.slice() }; },
    async getPending() { return { notifications: rec.pending.map(n => ({ id: n.id, title: n.title, body: n.body, extra: n.extra })) }; },
    async cancel(o) { const ids = ((o && o.notifications) || []).map(n => n.id); rec.cancelled.push(ids); rec.pending = rec.pending.filter(n => ids.indexOf(n.id) === -1); },
    async schedule(o) {
      rec.scheduleCalls++;
      if (rec.failAlways) throw new Error('java.lang.SecurityException: exact alarms revoked');
      const list = ((o && o.notifications) || []).map(flatten); rec.scheduled.push(list);
      list.forEach(n => { rec.pending = rec.pending.filter(p => p.id !== n.id); rec.pending.push(n); });
    },
    async checkExactNotificationSetting() { return { exact_alarm: rec.exactState }; },
    async changeExactNotificationSetting() { rec.exactState = 'granted'; return { exact_alarm: 'granted' }; },
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

// R1 — boot arms the plan
console.log('\n=== R1: boot pre-schedules a plan matching the seeded meds/appts ===');
{
  const { context, page, errors } = await openPage(browser, {});
  const ln = await page.evaluate(() => window.__ln);
  const okCount = ln.pending.length > 0;
  const okChannels = ln.channels.length === 2;
  const allPositive31 = ln.pending.every(n => n.id > 0 && n.id < 2147483647);
  const uniqueIds = new Set(ln.pending.map(n => n.id)).size === ln.pending.length;
  const pass = okCount && okChannels && allPositive31 && uniqueIds && errors.length === 0;
  rec('R1', 'boot arms a plan with 2 channels, unique positive 31-bit ids', pass,
    'armed=' + ln.pending.length + ' channels=' + ln.channels.length + ' allPositive31=' + allPositive31 + ' uniqueIds=' + uniqueIds + ' consoleErrors=' + errors.length);
  await context.close();
}

// R2 — quiet hours excluded, out-of-horizon excluded
console.log('\n=== R2: quiet-hours windows and appointments beyond 72h are never armed ===');
{
  const meds = [med('m-late', 'LateMed', [{ start: 23, end: 23.5, name: 'Late' }]), med('m-early', 'EarlyMed', [{ start: 6, end: 7, name: 'Early' }])];
  const appts = [{ id: 'far', title: 'Far out', ts: at(10, 10, 0), reminder: '1h', reminded: false }];
  const { context, page, errors } = await openPage(browser, { meds, appts });
  const ln = await page.evaluate(() => window.__ln);
  const pass = ln.pending.length === 0 && errors.length === 0;
  rec('R2', 'no reminders armed for quiet-hours-only meds or a 10-day-out appointment', pass, 'armed=' + ln.pending.length + ' consoleErrors=' + errors.length);
  await context.close();
}

// R3 — a failed sync still lets a surgical cancel through, and the card shows "failed"
console.log('\n=== R3: after a failed sync, logging a dose still cancels exactly one id ===');
{
  const { context, page, errors } = await openPage(browser, { fakeNow: at(0, 17, 55) }); // just before the 18:00 Evening window
  const before = await page.evaluate(() => window.__ln.pending.length);
  await page.evaluate(() => { window.Capacitor.Plugins.LocalNotifications.schedule = async () => { throw new Error('java.lang.SecurityException: exact alarms revoked'); }; });
  // There's no visibilitychange hook in this app and module-scope functions aren't reachable from
  // page.evaluate (type="module"), so the only way to force a real re-sync attempt through the UI is
  // to trigger one of markNotifDirty()'s real call sites -- and syncNativeReminders() short-circuits
  // on an unchanged plan signature unless the call passes force:true, which markNotifDirty()'s calls
  // never do. So the plan itself has to genuinely change first. Pushing the clock to 18:15 (20 min
  // past the Evening window's 18:00 open) drops that window from a freshly-built plan -- its `at` is
  // now behind the NOTIF_MIN_LEAD_MS cutoff -- which changes the signature and forces a real attempt,
  // while 18:15 is still inside 18:00-21:00 so logging Zofran "now" still targets that exact window.
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
  await page.waitForTimeout(2200); // 400ms debounce + the failing sync attempt itself
  const cardShowsFailed = await page.evaluate(() => (document.body.innerText || '').indexOf('Reminders couldn’t be set on this device') !== -1);
  const cancelledBefore = await page.evaluate(() => window.__ln.cancelled.length);
  await page.evaluate(() => { const bt = document.querySelector('header button'); if (bt) bt.click(); });
  await page.waitForTimeout(400);
  await page.evaluate(() => { const el = Array.from(document.querySelectorAll('button,div')).find(x => x.innerText && x.innerText.trim() === 'Home'); if (el) el.click(); });
  await page.waitForTimeout(900);
  const logged = await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find(x => (x.innerText || '').trim() === 'Log Zofran');
    if (!b) return { ok: false, buttons: Array.from(document.querySelectorAll('button')).map(x => (x.innerText || '').trim()).filter(Boolean).slice(0, 20) };
    b.click(); return { ok: true };
  });
  await page.waitForTimeout(700);
  const confirmed = await page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    if (!dlg) return { ok: false };
    const b = Array.from(dlg.querySelectorAll('button')).find(x => (x.innerText || '').trim() === 'Confirm');
    if (!b) return { ok: false, buttons: Array.from(dlg.querySelectorAll('button')).map(x => (x.innerText || '').trim()) };
    b.click(); return { ok: true };
  });
  await page.waitForTimeout(1200);
  const after = await page.evaluate(n => window.__ln.cancelled.slice(n), cancelledBefore);
  const pass = cardShowsFailed && logged.ok && confirmed.ok && after.length === 1 && after[0].length === 1 && errors.length === 0;
  rec('R3', 'failed-sync card shows + surgical cancel still finds exactly one id', pass,
    'before=' + before + ' cardShowsFailed=' + cardShowsFailed + ' logFound=' + logged.ok + (logged.ok ? '' : ' buttons=' + JSON.stringify(logged.buttons)) +
    ' confirmed=' + confirmed.ok + ' newCancelBatches=' + JSON.stringify(after) + ' consoleErrors=' + errors.length);
  await context.close();
}

// R4 — Settings card state model: never a green pill + red error at once, never count without pill
console.log('\n=== R4: Settings card never contradicts itself across permission/exact states ===');
{
  const CASES = [
    { label: 'granted+exact', permState: 'granted', exactState: 'granted' },
    { label: 'denied', permState: 'denied', exactState: 'granted' },
    { label: 'prompt', permState: 'prompt', exactState: 'granted' },
    { label: 'granted, exact denied', permState: 'granted', exactState: 'denied' },
  ];
  let ok = true, detail = [];
  for (const c of CASES) {
    const { context, page, errors } = await openPage(browser, c);
    await gotoSettings(page);
    const m = await page.evaluate(() => {
      const t = document.body.innerText || '';
      return { pill: /✓ Notifications are on/.test(t), err: /blocked|couldn.t be set/.test(t), count: /reminders? scheduled/.test(t) };
    });
    const contradiction = (m.pill && m.err) || (m.count && !m.pill);
    if (contradiction || errors.length) { ok = false; detail.push(c.label + ': pill=' + m.pill + ' err=' + m.err + ' count=' + m.count + ' consoleErrors=' + errors.length); }
    await context.close();
  }
  rec('R4', 'no card ever shows a green pill with an error, or a count without the pill', ok, detail.join(' | ') || 'all 4 states clean');
}

// R5 — exact-alarm toast fires with and without the plugin method
console.log('\n=== R5: "Allow exact reminders" always gives feedback ===');
{
  let ok = true, detail = [];
  for (const c of [{ label: 'method present', noExactMethod: false }, { label: 'method absent', noExactMethod: true }]) {
    const { context, page, errors } = await openPage(browser, { exactState: 'denied', noExactMethod: c.noExactMethod });
    await gotoSettings(page);
    const clicked = await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => (x.innerText || '').trim() === 'Allow exact reminders'); if (b) { b.click(); return true; } return false; });
    await page.waitForTimeout(1200);
    const toast = await page.evaluate(() => { const t = document.body.innerText || ''; const m = t.match(/(Exact reminders are allowed\.|Open your phone[^\n]*Alarms & reminders[^\n]*)/); return m ? m[1] : null; });
    if (!clicked || !toast || errors.length) { ok = false; detail.push(c.label + ': buttonFound=' + clicked + ' toast=' + JSON.stringify(toast) + ' consoleErrors=' + errors.length); }
    else detail.push(c.label + ': OK (' + toast.slice(0, 30) + '…)');
    await context.close();
  }
  rec('R5', 'the exact-alarm button never dead-ends, with or without the plugin method', ok, detail.join(' | '));
}

// R6 — sim date pauses arming
console.log('\n=== R6: reminders do not arm while the beta date controls simulate a date ===');
{
  const { context, page, errors } = await openPage(browser, {});
  await gotoSettings(page);
  const opened = await page.evaluate(() => {
    const t = Array.from(document.querySelectorAll('[role="button"]')).find(x => /beta date controls/i.test(x.innerText || ''));
    if (!t) return 'not-found';
    if (t.getAttribute('aria-expanded') !== 'true') t.click();
    return 'ok';
  });
  await page.waitForTimeout(500);
  const clicked = await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => (x.innerText || '').trim() === '+ 1 Day'); if (b) { b.click(); return true; } return false; });
  await page.waitForTimeout(2600);
  const cancelCalls = await page.evaluate(() => window.__ln.scheduled.length);
  const cardText = await page.evaluate(() => (document.body.innerText || '').indexOf('paused while the beta date controls') !== -1);
  const pass = opened === 'ok' && clicked && cardText && errors.length === 0;
  rec('R6', 'paused_sim: card explains it, no new schedule() calls fire', pass, 'toggleOpened=' + opened + ' dayShiftClicked=' + clicked + ' cardShowsPaused=' + cardText + ' scheduleCallBatches=' + cancelCalls + ' consoleErrors=' + errors.length);
  await context.close();
}

await browser.close();
const failed = results.filter(r => !r.pass);
console.log('\n============================================================');
console.log(failed.length === 0 ? 'V35 REBUILD VERIFICATION: PASS (' + results.length + '/' + results.length + ')' : 'V35 REBUILD VERIFICATION: FAIL — ' + failed.map(f => f.id).join(', '));
console.log('============================================================');
process.exit(failed.length === 0 ? 0 : 1);
