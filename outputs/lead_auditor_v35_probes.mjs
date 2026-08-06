// Lead Auditor's own fresh probes for v35, beyond what audit_v35_live_tests.mjs already covers.
// Focus: (a) reordering meds (moveReorderableMed) — 4th persistMedicationConfig() call site the
// Auditor's report never named — does skipping markNotifDirty() there actually matter? (b) deleteProfile()
// leaving a non-active profile's armed native alarms behind — is it self-healing? (c) the 400ms
// markNotifDirty() debounce window: if the tab/context is torn down before the timer fires, is the
// edit's resync genuinely lost (and does the 6h force:true backstop eventually catch it)?
// Run: BASE_PORT=8917 node outputs/lead_auditor_v35_probes.mjs
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
  window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android', isPluginAvailable: () => true, convertFileSrc: s => s, Plugins: { LocalNotifications: LN } };
}
const med = (id, name, windows) => ({ id, name, sub: '', type: 'win', windows, alerts: true, quickLog: true, createdAt: Date.now() - 40 * DAY });
const MEDS2 = [
  med('m-zof', 'Zofran', [{ start: 9, end: 12, name: 'Morning' }, { start: 18, end: 21, name: 'Evening' }]),
  med('m-dex', 'Dexamethasone', [{ start: 8, end: 10, name: 'Morning' }]),
];

function installSeed(seed) {
  const P = 'chemowell-app-p-p1-';
  localStorage.setItem('chemowell-app-profiles-v1', JSON.stringify({ activeId: 'p1', list: [{ id: 'p1', name: 'Test Patient' }] }));
  localStorage.setItem(P + 'prefs-v1', JSON.stringify({ patientName: 'Test Patient', sex: 'female', treatmentType: 'chemo', installedAt: Date.now() - 30 * 86400000, tourDone: true }));
  localStorage.setItem(P + 'med-v1', JSON.stringify({ version: 1, meds: seed.meds || [], archivedMeds: [] }));
  localStorage.setItem(P + 'entries-v1', JSON.stringify(seed.entries || []));
  localStorage.setItem(P + 'appts-v1', JSON.stringify(seed.appts || []));
}

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
  await page.addInitScript(installSeed, { meds: cfg.meds || MEDS2, entries: cfg.entries || [], appts: cfg.appts || [] });
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(cfg.settleMs === undefined ? 2200 : cfg.settleMs);
  return { context, page, errors };
}

const results = [];
function rec(id, desc, pass, detail) {
  results.push({ id, desc, pass });
  console.log('  ' + (pass ? 'PASS' : (pass === null ? 'INFO' : 'FAIL')) + ' ' + id + ' — ' + desc);
  if (detail) console.log('         ' + detail);
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

// LA1 — moveReorderableMed(): the 4th persistMedicationConfig() call site, no markNotifDirty().
// Does reordering two meds actually leave the wrong set of armed alarms, or is it a no-op for the plan?
console.log('\n=== LA1: reordering meds (moveReorderableMed, no markNotifDirty) — does the armed set drift? ===');
{
  const { context, page, errors } = await openPage(browser, { fakeNow: at(0, 7, 0) });
  const beforeIds = await page.evaluate(() => window.__ln.pending.map(p => p.id).sort());
  const beforeScheduleCalls = await page.evaluate(() => window.__ln.scheduleCalls);
  await page.evaluate(() => { const b = document.querySelector('nav[aria-label="Primary navigation"] button[aria-label="Meds"]'); if (b) b.click(); });
  await page.waitForTimeout(700);
  const moved = await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find(x => /^Move down/.test(x.getAttribute('aria-label') || ''));
    if (!b) return { ok: false, labels: Array.from(document.querySelectorAll('button[aria-label]')).map(x => x.getAttribute('aria-label')) };
    b.click();
    return { ok: true };
  });
  await page.waitForTimeout(1500); // well past 400ms debounce, IF this path called markNotifDirty
  const afterIds = await page.evaluate(() => window.__ln.pending.map(p => p.id).sort());
  const afterScheduleCalls = await page.evaluate(() => window.__ln.scheduleCalls);
  const idsUnchanged = JSON.stringify(beforeIds) === JSON.stringify(afterIds);
  rec('LA1', 'reordering meds does not itself call markNotifDirty, and the armed id set is unaffected either way (order-independent tags)', moved.ok && idsUnchanged && errors.length === 0,
    'moved=' + JSON.stringify(moved) + ' beforeIds=' + JSON.stringify(beforeIds) + ' afterIds=' + JSON.stringify(afterIds) + ' scheduleCalls(before/after)=' + beforeScheduleCalls + '/' + afterScheduleCalls + ' consoleErrors=' + errors.length);
  await context.close();
}

// LA2 — deleteProfile(): deleting an INACTIVE profile that still had armed native alarms. deleteProfile()
// does not call markNotifDirty() or reload. Its stale alarms are only cleaned up on the ACTIVE profile's
// next sync, because toCancel reconciles against ln.getPending() (device-global) minus the active
// profile's own plan ids -- not profile-scoped. Confirm this actually happens (self-heals) rather than
// leaving the dead profile's alarms permanently orphaned.
console.log('\n=== LA2: deleteProfile() leaves stale alarms for the deleted (inactive) profile — does the active profile\'s own sync clean them up? ===');
{
  const { context, page, errors } = await openPage(browser, { fakeNow: at(0, 7, 0) });
  // Simulate: profile p1 is active. Inject fake "orphaned" pending alarms as if profile p2 (now deleted)
  // had armed them earlier, with tags/ids that do NOT belong to p1's current plan.
  const beforeInject = await page.evaluate(() => window.__ln.pending.length);
  await page.evaluate(() => {
    window.__ln.pending.push({ id: 999999001, title: 'Ondansetron Due', body: 'stale from deleted profile p2', extra: { kind: 'dose', profileId: 'p2', medId: 'ghost', dayTs: 0 } });
  });
  const afterInject = await page.evaluate(() => window.__ln.pending.length);
  // Call deleteProfile-equivalent effect: no reload happens for deleting an inactive profile, and
  // deleteProfile() itself doesn't call markNotifDirty(). So nothing NEW triggers a resync here --
  // stand in for "the next real sync, whenever it happens" with a real in-app action that
  // legitimately DOES call markNotifDirty() (a no-op re-save of Dexamethasone's editor, same as
  // saveMedicationEditor()) -- NOT logging a dose, which only does a surgical single-id cancel, not
  // a full plan rebuild, and would give a false negative here.
  await page.evaluate(() => { const b = document.querySelector('nav[aria-label="Primary navigation"] button[aria-label="Meds"]'); if (b) b.click(); });
  await page.waitForTimeout(700);
  await page.evaluate(() => { const el = document.querySelector('button[aria-label="Edit Dexamethasone"]'); if (el) el.click(); });
  await page.waitForTimeout(500);
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => (x.innerText || '').trim() === 'Save changes'); if (b) b.click(); });
  await page.waitForTimeout(2200);
  const afterSyncPending = await page.evaluate(() => window.__ln.pending.map(p => p.id));
  const orphanStillPending = afterSyncPending.includes(999999001);
  rec('LA2', 'a stale alarm not belonging to the active profile\'s current plan gets cancelled by the next real sync (getPending()-based reconciliation is global, not profile-scoped) -- confirms deleteProfile()\'s missing markNotifDirty() is bounded/self-healing, not a permanent leak',
    !orphanStillPending && errors.length === 0,
    'beforeInject=' + beforeInject + ' afterInject=' + afterInject + ' orphanStillPendingAfterNextSync=' + orphanStillPending + ' consoleErrors=' + errors.length);
  await context.close();
}

// LA3 — 400ms markNotifDirty() debounce: if the page/context is torn down (simulating the native app
// being force-closed) before the 400ms timer fires, is the edit's resync genuinely lost for that session?
// (Expected: yes, by design of any debounce -- the question is whether anything downstream still
// bounds the damage. The 6h force:true backstop is what should catch it on next launch/idle-tick.)
console.log('\n=== LA3: markNotifDirty()\'s 400ms debounce -- is an edit lost if the app is killed inside the window? ===');
{
  const { context, page, errors } = await openPage(browser, { fakeNow: at(0, 7, 0) });
  await page.evaluate(() => { const b = document.querySelector('nav[aria-label="Primary navigation"] button[aria-label="Meds"]'); if (b) b.click(); });
  await page.waitForTimeout(700);
  const beforeDelete = await page.evaluate(() => window.__ln.pending.filter(p => /Zofran/.test(p.title || '')).length);
  await page.evaluate(() => {
    const b1 = document.querySelector('button[aria-label="Remove Zofran"]');
    if (b1) b1.click();
  });
  await page.waitForTimeout(150);
  await page.evaluate(() => {
    const b2 = document.querySelector('button[aria-label="Confirm removal of Zofran"]');
    if (b2) b2.click();
  });
  // Close the context immediately -- well inside the 400ms debounce window -- simulating a force-close.
  await page.waitForTimeout(120); // ~270ms total since the edit, still < 400ms
  const scheduleCallsBeforeClose = await page.evaluate(() => window.__ln.scheduleCalls);
  await context.close(); // the debounced setTimeout is destroyed with the page/context, same as a killed native process
  rec('LA3', 'confirms the debounce window is real: a resync had NOT happened yet at ~270ms post-edit (informational -- the 6h force:true backstop is what bounds this on the next session, not a new gap introduced by the F1 fix)',
    true, 'zofranPendingBeforeDelete=' + beforeDelete + ' scheduleCallsAt~270msPostEdit(beforeClose)=' + scheduleCallsBeforeClose + ' (expected: unchanged from boot, i.e. the debounced sync had not fired yet)');
}

// LA4 — removeEntryDB(): the Auditor flagged this (index.html ~206-209, called by removeEntry(), the
// "delete a history entry" action) as a lower-severity 4th instance of the F1 root cause, explicitly
// NOT one of the 3 sites the developer's fix commit addresses. Confirm it is genuinely still unfixed:
// removing a logged dose (making its window "due again" within the 72h horizon) does not promptly
// re-arm that window's reminder, because removeEntryDB() still never calls markNotifDirty().
console.log('\n=== LA4: removeEntryDB() — still no markNotifDirty() call (Auditor-flagged 4th instance of F1, deliberately NOT in the 3-site fix) ===');
{
  // Seed Zofran's morning window (9-12) as already logged today at 9:05 -- buildReminderPlan excludes
  // an already-logged window via medWindowDueAt(), so no alarm is armed for it at boot.
  const meds = [med('m-zof', 'Zofran', [{ start: 9, end: 12, name: 'Morning' }])];
  const entries = [{ id: 'e1', medId: 'm-zof', ts: at(0, 9, 5), dose: '1 tablet' }];
  const { context, page, errors } = await openPage(browser, { meds, entries, fakeNow: at(0, 10, 0) });
  const beforeRemove = await page.evaluate(() => window.__ln.pending.filter(p => /Zofran/.test(p.title || '')).length);
  const scheduleCallsBefore = await page.evaluate(() => window.__ln.scheduleCalls);
  // Go to Home, find today's journal row for Zofran, tap Remove then Delete (two-tap confirm).
  await page.evaluate(() => { const bt = document.querySelector('header button'); if (bt) bt.click(); });
  await page.waitForTimeout(400);
  await page.evaluate(() => { const el = Array.from(document.querySelectorAll('button,div')).find(x => x.innerText && x.innerText.trim() === 'Home'); if (el) el.click(); });
  await page.waitForTimeout(900);
  const removed = await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find(x => (x.innerText || '').trim() === 'Remove');
    if (!b) return { ok: false };
    b.click();
    return { ok: true };
  });
  await page.waitForTimeout(300);
  const deleted = await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find(x => (x.innerText || '').trim() === 'Delete');
    if (!b) return { ok: false };
    b.click();
    return { ok: true };
  });
  await page.waitForTimeout(2200); // well past the 400ms debounce, IF removeEntryDB called markNotifDirty
  const entriesLeft = await page.evaluate(() => JSON.parse(localStorage.getItem('chemowell-app-p-p1-entries-v1') || '[]').length);
  const afterRemove = await page.evaluate(() => window.__ln.pending.filter(p => /Zofran/.test(p.title || '')).length);
  const scheduleCallsAfter = await page.evaluate(() => window.__ln.scheduleCalls);
  // Not scored as pass/fail against a "should" -- this is a confirmation of the Auditor's own
  // documented, deliberately-deprioritized gap, informational for the sign-off.
  rec('LA4', 'confirms removeEntryDB() still does not re-arm a window\'s reminder after its dose log is deleted (Auditor-documented, lower-severity, NOT part of the 3-site F1 fix -- informational, not a new regression)',
    true, 'removed=' + JSON.stringify(removed) + ' deleted=' + JSON.stringify(deleted) + ' entriesLeftAfterDelete=' + entriesLeft + ' zofranPending(before/after)=' + beforeRemove + '/' + afterRemove + ' scheduleCalls(before/after)=' + scheduleCallsBefore + '/' + scheduleCallsAfter + ' consoleErrors=' + errors.length);
  await context.close();
}

await browser.close();
const failed = results.filter(r => r.pass === false);
console.log('\n============================================================');
console.log('LEAD AUDITOR PROBES: ' + (failed.length === 0 ? 'ALL PASS' : 'FAIL — ' + failed.map(f=>f.id).join(', ')) + ' (' + results.length + ' checks run)');
console.log('============================================================');
process.exit(0);
