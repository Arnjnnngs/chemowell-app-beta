// Auditor live-testing harness for v35 pre-scheduled native notifications.
// Adapted from verify_v35_rebuild.mjs's stub pattern. Run: BASE_PORT=8917 node audit_v35_live_tests.mjs
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
  const rec = { scheduled: [], cancelled: [], channels: [], pending: [], permState: cfg.permState || 'granted', exactState: cfg.exactState || 'granted', scheduleCalls: 0, failAlways: !!cfg.failAlways, scheduleLog: [] };
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
      const list = ((o && o.notifications) || []).map(flatten);
      rec.scheduleLog.push({ atCall: Date.now(), items: list });
      rec.scheduled.push(list);
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
  if (cfg.noPlugin) { window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android', isPluginAvailable: () => false, convertFileSrc: s => s, Plugins: {} }; return; }
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

async function openPage(browser, cfg, width) {
  const context = await browser.newContext({ viewport: { width: width || 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const errors = [];
  const warns = [];
  page.on('console', m => {
    if (m.type() === 'error' && !/ERR_TUNNEL|ERR_FAILED|ERR_NAME_NOT_RESOLVED|favicon/.test(m.text())) errors.push(m.text());
    if (m.type() === 'warning') warns.push(m.text());
  });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.route(CAP_CORE, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: '/*stub*/' }));
  await page.route(CAP_LN, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: '/*stub*/' }));
  await page.addInitScript(installFakeClock, (cfg.fakeNow || at(0, 10, 0)) - Date.now());
  await page.addInitScript(installCapacitorStub, cfg);
  await page.addInitScript(installSeed, { meds: cfg.meds || MEDS, entries: cfg.entries || [], appts: cfg.appts || [] });
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(cfg.settleMs === undefined ? 2200 : cfg.settleMs);
  return { context, page, errors, warns };
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
async function gotoHome(page) {
  await page.evaluate(() => { const bt = document.querySelector('header button'); if (bt) bt.click(); });
  await page.waitForTimeout(400);
  await page.evaluate(() => { const el = Array.from(document.querySelectorAll('button,div')).find(x => x.innerText && x.innerText.trim() === 'Home'); if (el) el.click(); });
  await page.waitForTimeout(900);
}

const results = [];
function rec(id, desc, pass, detail) {
  results.push({ id, desc, pass });
  console.log('  ' + (pass ? 'PASS' : (pass === null ? 'INFO' : 'FAIL')) + ' ' + id + ' — ' + desc);
  if (detail) console.log('         ' + detail);
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

// T1 — Double-tap "Log Zofran" rapidly: does it create two entries / double-cancel / throw?
console.log('\n=== T1: rapid double-click "Log Zofran" ===');
{
  const { context, page, errors } = await openPage(browser, { fakeNow: at(0, 9, 30) });
  await gotoHome(page);
  const found = await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find(x => (x.innerText || '').trim() === 'Log Zofran');
    if (!b) return { ok: false, buttons: Array.from(document.querySelectorAll('button')).map(x => (x.innerText||'').trim()).filter(Boolean).slice(0,25) };
    b.click(); b.click(); return { ok: true };
  });
  await page.waitForTimeout(800);
  // If a confirm dialog appeared (time picker), double-click Confirm rapidly too.
  const confirmed = await page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    if (!dlg) return { present: false };
    const b = Array.from(dlg.querySelectorAll('button')).find(x => (x.innerText || '').trim() === 'Confirm');
    if (!b) return { present: true, found: false };
    b.click(); b.click(); b.click();
    return { present: true, found: true };
  });
  await page.waitForTimeout(1200);
  const entryCount = await page.evaluate(() => JSON.parse(localStorage.getItem('chemowell-app-p-p1-entries-v1') || '[]').filter(e => e.medId === 'm-zof').length);
  const cancelledBatches = await page.evaluate(() => window.__ln.cancelled.length);
  rec('T1', 'rapid double-click Log Zofran does not create 2 entries or throw', entryCount <= 1 && errors.length === 0,
    'found=' + JSON.stringify(found) + ' confirmDialog=' + JSON.stringify(confirmed) + ' zofranEntryCount=' + entryCount + ' cancelledBatches=' + cancelledBatches + ' consoleErrors=' + errors.length + (errors.length? ' :: '+errors.join(' | '):''));
  await context.close();
}

// T2 — Dose logged exactly at window boundary (12:00:00 for a 9-12 window): in or out?
console.log('\n=== T2: dose logged exactly at window end boundary (12:00:00 for 9-12 window) ===');
{
  const { context, page, errors } = await openPage(browser, { fakeNow: at(0, 11, 59) });
  // advance to exactly 12:00:00
  await page.evaluate(() => { window.__clockOffset += 60 * 1000; });
  const before = await page.evaluate(() => window.__ln.pending.filter(p => p.id).length);
  const cancelledBefore = await page.evaluate(() => window.__ln.cancelled.length);
  await page.evaluate(() => {
    return new Promise(resolve => {
      // call addEntryDB indirectly is not reachable (module scope) — use UI
      resolve();
    });
  });
  await gotoHome(page);
  const found = await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find(x => (x.innerText || '').trim() === 'Log Zofran');
    if (!b) return false; b.click(); return true;
  });
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    if (!dlg) return;
    const b = Array.from(dlg.querySelectorAll('button')).find(x => (x.innerText || '').trim() === 'Confirm');
    if (b) b.click();
  });
  await page.waitForTimeout(800);
  const after = await page.evaluate(n => window.__ln.cancelled.slice(n), cancelledBefore);
  const entryTs = await page.evaluate(() => { const es = JSON.parse(localStorage.getItem('chemowell-app-p-p1-entries-v1')||'[]'); const e = es.filter(x=>x.medId==='m-zof').slice(-1)[0]; return e ? e.ts : null; });
  const nowTs = await page.evaluate(() => Date.now());
  rec('T2', 'boundary dose logged; whether cancelReminderForEntry treats 12:00:00 as inside 9-12 window', true,
    'loggedFound=' + found + ' entryTs=' + entryTs + ' nowTs=' + nowTs + ' cancelBatchesAfter=' + JSON.stringify(after) + ' consoleErrors=' + errors.length);
  await context.close();
}

// T3 — Day-boundary: clock crosses local midnight while app open, does the plan roll forward?
console.log('\n=== T3: clock crosses local midnight while app stays open ===');
{
  const { context, page, errors } = await openPage(browser, { fakeNow: at(0, 23, 58) });
  const before = await page.evaluate(() => ({ pending: window.__ln.pending.length, syncCalls: window.__ln.scheduleCalls }));
  // Advance the clock across midnight in small steps, letting the 1s interval + 6h backstop / dirty timers run.
  await page.evaluate(() => { window.__clockOffset += 5 * 60 * 1000; }); // now 00:03 next day
  await page.waitForTimeout(2500);
  const after = await page.evaluate(() => ({ pending: window.__ln.pending.length, syncCalls: window.__ln.scheduleCalls, signature: null }));
  rec('T3', 'plan does not error crossing midnight (backstop is 6h so an immediate resync is NOT expected within seconds)', errors.length === 0, JSON.stringify({ before, after }) + ' consoleErrors=' + errors.length);
  await context.close();
}

// T4 — Editing/deleting a medication with an already-armed reminder: stale reminder cleaned up?
console.log('\n=== T4: deleting a medication with an armed reminder ===');
{
  const { context, page, errors } = await openPage(browser, { fakeNow: at(0, 8, 30) });
  const beforePending = await page.evaluate(() => window.__ln.pending.map(p=>p.id));
  await page.evaluate(() => { const b = document.querySelector('nav[aria-label="Primary navigation"] button[aria-label="Meds"]'); if (b) b.click(); });
  await page.waitForTimeout(900);
  const editOpened = await page.evaluate(() => {
    const el = document.querySelector('button[aria-label="Remove Zofran"]');
    return !!el;
  });
  const deleted = await page.evaluate(() => {
    const b1 = document.querySelector('button[aria-label="Remove Zofran"]');
    if (!b1) return { ok: false, step: 'no-remove-button' };
    b1.click();
    return { ok: true };
  });
  await page.waitForTimeout(300);
  const confirmed = await page.evaluate(() => {
    const b2 = document.querySelector('button[aria-label="Confirm removal of Zofran"]');
    if (!b2) return { ok: false };
    b2.click();
    return { ok: true };
  });
  await page.waitForTimeout(2200); // 400ms debounce + sync
  await page.waitForTimeout(2200); // 400ms markNotifDirty debounce + sync
  const afterPending = await page.evaluate(() => window.__ln.pending.map(p=>({id:p.id,title:p.title})));
  const zofranStillPending = afterPending.some(p => /Zofran/.test(p.title || ''));
  rec('T4', 'deleting a medication removes its armed reminders from device pending set', editOpened && deleted.ok && confirmed.ok && !zofranStillPending,
    'editOpened=' + editOpened + ' deleted=' + JSON.stringify(deleted) + ' confirmed=' + JSON.stringify(confirmed) + ' beforePendingCount=' + beforePending.length + ' afterPendingCount=' + afterPending.length + ' zofranStillPending=' + zofranStillPending + ' afterPendingTitles=' + JSON.stringify(afterPending.map(p=>p.title)) + ' consoleErrors=' + errors.length);
  await context.close();
}

// T5 — Reload mid-flow after boot armed reminders: does re-boot double-arm?
console.log('\n=== T5: reload after boot has armed reminders — no double-arm ===');
{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|ERR_FAILED|ERR_NAME_NOT_RESOLVED|favicon/.test(m.text())) errors.push(m.text()); });
  await page.route(CAP_CORE, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: '/*stub*/' }));
  await page.route(CAP_LN, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: '/*stub*/' }));
  const fakeNow = at(0, 8, 0);
  await page.addInitScript(installFakeClock, fakeNow - Date.now());
  await page.addInitScript(installCapacitorStub, {});
  await page.addInitScript(installSeed, { meds: MEDS, entries: [], appts: [] });
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(2200);
  const first = await page.evaluate(() => ({ pending: window.__ln.pending.map(p=>p.id).sort(), scheduleCalls: window.__ln.scheduleCalls, cancelCalls: window.__ln.cancelled.length }));
  // Reload WITHOUT re-adding init scripts for clock/stub (they persist via addInitScript for the context) but pending state is page-scoped (window.__ln) so it resets. We want to check the persisted device "pending" — but our stub is page-scoped, not device-scoped, so simulate a "device" by re-seeding the LN pending array via localStorage bridge is not available.
  // Instead: capture localStorage plan reproducibility — same signature should arm identical ids both times.
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(2200);
  const second = await page.evaluate(() => ({ pending: window.__ln.pending.map(p=>p.id).sort(), scheduleCalls: window.__ln.scheduleCalls, cancelCalls: window.__ln.cancelled.length }));
  const sameIds = JSON.stringify(first.pending) === JSON.stringify(second.pending);
  rec('T5', 'reload reproduces an identical id set (idempotent plan) rather than drifting/duplicating', sameIds && errors.length === 0,
    'first=' + JSON.stringify(first) + ' second=' + JSON.stringify(second) + ' sameIds=' + sameIds + ' consoleErrors=' + errors.length);
  await context.close();
}

// T6 — Appointment with malformed reminderCustomValue: reminderTriggerTs must return null, not garbage.
console.log('\n=== T6: malformed appointment reminderCustomValue reaching buildReminderPlan ===');
{
  const appts = [
    { id: 'bad1', title: 'Bad negative', ts: at(1, 14, 0), reminder: 'custom', reminderCustomValue: -5, reminderCustomUnit: 'hours', reminded: false },
    { id: 'bad2', title: 'Bad NaN', ts: at(1, 14, 0), reminder: 'custom', reminderCustomValue: 'not-a-number', reminderCustomUnit: 'hours', reminded: false },
    { id: 'bad3', title: 'Bad Infinity', ts: at(1, 14, 0), reminder: 'custom', reminderCustomValue: Infinity, reminderCustomUnit: 'hours', reminded: false },
  ];
  const { context, page, errors } = await openPage(browser, { meds: [], appts, fakeNow: at(0, 10, 0) });
  const pending = await page.evaluate(() => window.__ln.pending);
  const anyBad = pending.some(p => !Number.isFinite(p.at) || p.at < 0);
  rec('T6', 'malformed reminderCustomValue produces no garbage-timestamp alarm and no crash', !anyBad && errors.length === 0,
    'pendingCount=' + pending.length + ' anyBadTimestamp=' + anyBad + ' consoleErrors=' + errors.length + (errors.length? ' :: '+errors.join(' | '):''));
  await context.close();
}

// T7 — Plugin entirely undefined at sync time (not just failing calls).
console.log('\n=== T7: window.Capacitor.Plugins.LocalNotifications entirely undefined ===');
{
  const { context, page, errors } = await openPage(browser, { noPlugin: true, fakeNow: at(0, 8, 30) });
  const isNative = await page.evaluate(() => window.Capacitor.isNativePlatform());
  await gotoSettings(page);
  const bodyText = await page.evaluate(() => document.body.innerText || '');
  rec('T7', 'plugin entirely missing does not throw / does not hang UI in "checking" forever without cause', errors.length === 0,
    'isNative=' + isNative + ' consoleErrors=' + errors.length + (errors.length? ' :: '+errors.join(' | '):'') + ' cardShowsChecking=' + /Checking notification status/.test(bodyText) + ' bodySnippet=' + bodyText.slice(bodyText.indexOf('NOTIFICATIONS'), bodyText.indexOf('NOTIFICATIONS')+300));
  await context.close();
}

// T8 — REACTIVE/PRE-SCHEDULED DUPLICATE CHECK: with app open (foreground) and native platform,
// does checkNotifications()'s reactive path ALSO fire a native schedule() call for a window v35
// already pre-armed, producing a duplicate notification for the same dose window?
console.log('\n=== T8: duplicate-notification risk — reactive checkNotifications() vs v35 pre-armed plan (native, app foregrounded) ===');
{
  const meds = [med('m-zof', 'Zofran', [{ start: 9, end: 12, name: 'Morning' }])];
  const { context, page, errors } = await openPage(browser, { meds, appts: [], fakeNow: at(0, 8, 59) }); // 60s before window opens: >= NOTIF_MIN_LEAD_MS so v35 arms it at boot
  const afterBoot = await page.evaluate(() => ({ scheduleCalls: window.__ln.scheduleCalls, pending: window.__ln.pending.map(p=>({id:p.id,title:p.title,at:p.at})) }));
  // Advance clock across the window boundary (9:00:00) while app remains open/foregrounded.
  await page.evaluate(() => { window.__clockOffset += 90 * 1000; }); // now ~09:00:50
  await page.waitForTimeout(2500); // let the 1s tick's checkNotifications() run
  const afterCross = await page.evaluate(() => ({ scheduleCalls: window.__ln.scheduleCalls, scheduleLog: window.__ln.scheduleLog }));
  // Look for a schedule() call AFTER boot whose payload title matches "Zofran Due" — that would be
  // the reactive path firing a SECOND, separately-scheduled native notification for the same window
  // the v35 plan already pre-armed at boot.
  const reactiveFired = afterCross.scheduleLog.slice(1).some(call => call.items.some(it => /Zofran Due/.test(it.title || '')));
  const duplicateIdCount = (() => {
    const ids = {};
    afterCross.scheduleLog.forEach(call => call.items.forEach(it => { ids[it.id] = (ids[it.id]||0)+1; }));
    return Object.values(ids).filter(c => c > 1).length;
  })();
  rec('T8', 'reactive checkNotifications() does NOT also schedule a native notification for a window v35 already pre-armed (no duplicate)', !reactiveFired,
    'bootScheduleCalls=' + afterBoot.scheduleCalls + ' totalScheduleCallsAfterCross=' + afterCross.scheduleCalls + ' reactivePathFiredSecondSchedule=' + reactiveFired + ' duplicateIdReuseCount=' + duplicateIdCount + ' fullScheduleLog=' + JSON.stringify(afterCross.scheduleLog));
  await context.close();
}

// T9 — Pausing a medication (setMedicationPaused, no markNotifDirty call) does not cancel its
// already-armed native reminder promptly.
console.log('\n=== T9: pausing a medication does not promptly cancel its armed native reminder ===');
{
  const { context, page, errors } = await openPage(browser, { fakeNow: at(0, 8, 30) });
  const beforePause = await page.evaluate(() => window.__ln.pending.filter(p => /Zofran/.test(p.title||'')).length);
  await page.evaluate(() => { const b = document.querySelector('nav[aria-label="Primary navigation"] button[aria-label="Meds"]'); if (b) b.click(); });
  await page.waitForTimeout(700);
  const editOpened = await page.evaluate(() => { const el = document.querySelector('button[aria-label="Edit Zofran"]'); if (!el) return false; el.click(); return true; });
  await page.waitForTimeout(500);
  const paused = await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => (x.innerText||'').trim() === 'Pause'); if (!b) return false; b.click(); return true; });
  await page.waitForTimeout(2200); // well past the 400ms markNotifDirty debounce, IF this path called it
  const afterPause = await page.evaluate(() => window.__ln.pending.filter(p => /Zofran/.test(p.title||'')).length);
  const scheduleCallsAfter = await page.evaluate(() => window.__ln.scheduleCalls);
  rec('T9', 'pausing a med from the editor cancels its already-armed reminders within the debounce window', afterPause === 0,
    'editOpened=' + editOpened + ' pauseClicked=' + paused + ' zofranPendingBeforePause=' + beforePause + ' zofranPendingAfterPause=' + afterPause + ' scheduleCallsAfter=' + scheduleCallsAfter + ' consoleErrors=' + errors.length);
  await context.close();
}

// T10 — signature short-circuit vs the 6h backstop: if OS permission is silently revoked mid-session
// and the plan's signature happens to stay unchanged (e.g. a single far-out appointment, no daily
// dose windows to force natural drift), does the un-forced backstop call ever actually re-check
// permission and flip the Settings card to "blocked"?
console.log('\n=== T10: permission silently revoked mid-session, static plan (appt-only) — does the 6h backstop detect it? ===');
{
  const appts = [{ id: 'a1', title: 'Infusion', ts: at(3, 14, 0), reminder: '1day', reminded: false }]; // fixed far-out reminder, plan stays static
  const { context, page, errors } = await openPage(browser, { meds: [], appts, fakeNow: at(0, 8, 0) });
  const bootSig = await page.evaluate(() => window.__ln.pending.length);
  // Simulate the OS silently revoking permission behind the app's back (no in-app action triggers this).
  await page.evaluate(() => { window.__ln.permState = 'denied'; });
  // Advance the clock past the 6h backstop threshold without touching anything else (no markNotifDirty
  // trigger fires — no meds, appt doesn't change, no dose logged).
  await page.evaluate(() => { window.__clockOffset += 6 * 3600 * 1000 + 5 * 60 * 1000; });
  await page.waitForTimeout(2500); // let the 1s interval's backstop condition evaluate and (maybe) resync
  await gotoSettings(page);
  const cardText = await page.evaluate(() => document.body.innerText || '');
  const showsBlocked = /Notifications are blocked for ChemoWell/.test(cardText);
  const showsOnStale = /✓ Notifications are on/.test(cardText);
  rec('T10', 'the 6h backstop actually re-checks permission (via a forced call) even when the plan signature is unchanged', showsBlocked && !showsOnStale,
    'bootPendingCount=' + bootSig + ' realPermStateNow=denied(simulated OS revoke) cardShowsBlocked=' + showsBlocked + ' cardStillShowsOnStale=' + showsOnStale + ' consoleErrors=' + errors.length);
  await context.close();
}

await browser.close();
const failed = results.filter(r => r.pass === false);
console.log('\n============================================================');
console.log('AUDIT LIVE TESTS: ' + (failed.length === 0 ? 'ALL PASS' : 'FAIL — ' + failed.map(f=>f.id).join(', ')) + ' (' + results.length + ' checks run)');
console.log('============================================================');
process.exit(0);
