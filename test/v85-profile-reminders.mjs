// v85-profile-reminders.mjs -- one profile's reminders must never cancel another's.
//
// WHAT THIS PROTECTS. Aaron, 2026-09-17: "I didn't get my notification for my medicine (because I
// was logged in under the wrong profile)." Two profiles on one phone; the other one active; his
// doses arrived as "3 missed doses from previous days" and no reminder ever fired.
//
// The cause was not that the inactive profile went unscheduled. It was that the reconcile loop
// CANCELLED it: the plan is built from the active profile alone, notification ids carry the
// profile, and everything armed that was not in the plan was torn down -- on every cold start, not
// just on a switch, because the boot sync passes force: true.
//
// EVERY CHECK BELOW DRIVES THE SHIPPED `notifCancelCandidates` THROUGH `window.__notifScopeTest`.
// None re-implements it. A suite that re-implements the thing it is testing proves only that it
// agrees with itself, and this repo has shipped roughly eight checks with that shape.
//
// Run:  python3 -m http.server 8899 --directory <repo>   (then)  node test/v85-profile-reminders.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = (() => {
  const _p = require('path');
  const tries = ['playwright',
    _p.join(_p.dirname(process.execPath), '..', 'lib', 'node_modules', 'playwright'),
    '/opt/node22/lib/node_modules/playwright',
    '/home/claude/.npm-global/lib/node_modules/playwright'];
  for (const t of tries) { try { return require(t); } catch (e) {} }
  throw new Error('playwright not found');
})();
const BASE = process.env.FALSIFY_BASE || 'http://127.0.0.1:8899/index.html';

let pass = 0, fail = 0;
const t = (name, ok, detail) => {
  if (ok) { pass++; console.log('  PASS  ' + name + (detail ? '  |  ' + detail : '')); }
  else { fail++; console.log('  FAIL  ' + name + '  |  ' + detail); }
};

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const thrown = [];
page.on('pageerror', (e) => thrown.push(String(e)));

// Two profiles on one device, p1 active -- the exact shape of Aaron's phone.
await page.addInitScript(() => {
  localStorage.setItem('chemowell-app-profiles-v1', JSON.stringify({
    list: [{ id: 'p1', name: 'Alex', createdAt: 1 }, { id: 'p2', name: 'Sam', createdAt: 2 }],
    activeId: 'p1'
  }));
  localStorage.setItem('chemowell-app-p-p1-prefs-v1', JSON.stringify({ patientName: 'Alex' }));
  localStorage.setItem('chemowell-app-p-p2-prefs-v1', JSON.stringify({ patientName: 'Sam' }));
});
await page.goto(BASE, { waitUntil: 'load' });
await page.waitForTimeout(2200);

console.log('\n1. THE HOOK REACHES THE SHIPPED CODE');
const hookOk = await page.evaluate(() => !!(window.__notifScopeTest && typeof window.__notifScopeTest.cancelCandidates === 'function'));
t('the shipped cancel predicate is reachable', hookOk, hookOk ? 'window.__notifScopeTest.cancelCandidates' : 'missing');
const active = await page.evaluate(() => window.__notifScopeTest.activeProfileId());
t('the active profile is the one the fixture set', active === 'p1', 'active=' + active);

console.log('\n2. THE DEFECT ITSELF — another profile\'s armed reminder survives');
const r = await page.evaluate(() => {
  const now = Date.now();
  const pending = [
    { id: 11, extra: { profileId: 'p1', kind: 'dose' } },   // mine, not in plan -> cancel
    { id: 22, extra: { profileId: 'p2', kind: 'dose' } },   // theirs -> MUST survive
    { id: 33, extra: { profileId: 'p2', kind: 'dose' } }    // theirs -> MUST survive
  ];
  // notifPlanApplied is EMPTY, which is what a reload leaves behind -- the condition that made the
  // protection band vacuous. If scoping is wrong, every id here is cancellable.
  const out = window.__notifScopeTest.cancelCandidates(pending, new Set(), [], now);
  return out.map(p => p.id);
});
t('the other profile\'s reminders are NOT cancelled', !r.includes(22) && !r.includes(33), 'toCancel=[' + r.join(',') + ']');
t('this profile\'s own stale reminder IS still cancelled', r.includes(11), 'toCancel=[' + r.join(',') + ']');
t('exactly one id was cancelled', r.length === 1, r.length + ' cancelled');

console.log('\n3. THE RELOAD CASE, WHICH IS THE ONE THAT BIT — empty applied list, dose due imminently');
const r2 = await page.evaluate(() => {
  const now = Date.now();
  const lead = window.__notifScopeTest.minLeadMs();
  const pending = [{ id: 44, extra: { profileId: 'p2' } }];   // due inside the protection band
  const out = window.__notifScopeTest.cancelCandidates(pending, new Set(), [], now + lead - 1000);
  return out.length;
});
t('a dose due seconds away on another profile survives a reload', r2 === 0, r2 + ' cancelled');

console.log('\n3b. THE MID-FIRE PROTECTION BAND, ON OUR OWN PROFILE — the pre-existing guard');
// THE SUITE USED TO CERTIFY A FUNCTION WITHOUT THIS. Every earlier check drives an OTHER-profile
// id, which the new profile guard rejects one line before the band is reached, so deleting the
// band outright scored a clean 10/10. An audit found it by mutating exactly that. These two drive
// an id belonging to the ACTIVE profile, which is the only way to reach the band's arithmetic.
const band = await page.evaluate(() => {
  const now = Date.now();
  const lead = window.__notifScopeTest.minLeadMs();
  const mine = [{ id: 88, extra: { profileId: 'p1' } }];
  // Armed by THIS process and about to fire: must be left alone.
  const inBand = window.__notifScopeTest.cancelCandidates(mine, new Set(), [{ id: 88, at: now + lead - 1000 }], now);
  // Armed by this process but far away: safe to cancel.
  const outOfBand = window.__notifScopeTest.cancelCandidates(mine, new Set(), [{ id: 88, at: now + lead + 600000 }], now);
  return { inBand: inBand.length, outOfBand: outOfBand.length };
});
t('our own reminder that is about to fire is NOT cancelled', band.inBand === 0, band.inBand + ' cancelled');
t('our own reminder that is far off IS cancelled', band.outOfBand === 1, band.outOfBand + ' cancelled');

console.log('\n3c. A PROFILE THAT NO LONGER EXISTS IS CANCELLABLE — the erase/undo path');
// The guard keys on "does this profile still exist", not "is it the active one". Keying on the
// latter orphaned alarms forever: eraseAllAppData() and cwUndoRestore() both remove a profile and
// reload, and NOTHING disarms its alarms -- the old over-broad cancel was doing it by accident.
const gone = await page.evaluate(() => {
  const pending = [{ id: 99, extra: { profileId: 'p-deleted-9' } }];
  return window.__notifScopeTest.cancelCandidates(pending, new Set(), [], Date.now()).length;
});
t('an alarm for a profile no longer in the list can be swept', gone === 1, gone + ' cancellable');

console.log('\n3d. AN UNREADABLE PROFILE LIST MUST FAIL CLOSED');
// The guard asks "does this profile still exist". If the profile list cannot be read, the honest
// answer is "I do not know" -- and destroying a medication reminder on a guess is the whole defect
// this release exists to fix. An audit found the obvious implementation fails OPEN: loadJSON()
// returns a fallback list containing only `p1` on a parse error, indistinguishable from a phone
// that genuinely has one profile, so every other profile's alarms silently become cancellable.
const corrupt = await page.evaluate(() => {
  const good = localStorage.getItem('chemowell-app-profiles-v1');
  const pending = [{ id: 4242, extra: { profileId: 'p2' } }];
  localStorage.setItem('chemowell-app-profiles-v1', '{not json at all');
  const whenCorrupt = window.__notifScopeTest.cancelCandidates(pending, new Set(), [], Date.now()).length;
  localStorage.removeItem('chemowell-app-profiles-v1');
  const whenMissing = window.__notifScopeTest.cancelCandidates(pending, new Set(), [], Date.now()).length;
  localStorage.setItem('chemowell-app-profiles-v1', good);
  const whenHealthy = window.__notifScopeTest.cancelCandidates(pending, new Set(), [], Date.now()).length;
  return { whenCorrupt, whenMissing, whenHealthy };
});
t('a corrupt profile list protects the other profile rather than sweeping it', corrupt.whenCorrupt === 0, 'cancelled=' + corrupt.whenCorrupt);
t('a missing profile list protects it too', corrupt.whenMissing === 0, 'cancelled=' + corrupt.whenMissing);
t('and a healthy list still protects it', corrupt.whenHealthy === 0, 'cancelled=' + corrupt.whenHealthy);

console.log('\n4. LEGACY NOTIFICATIONS ARE STILL CLEANABLE');
const r3 = await page.evaluate(() => {
  const pending = [{ id: 55, extra: {} }, { id: 66 }];        // pre-profile ids, no profileId
  return window.__notifScopeTest.cancelCandidates(pending, new Set(), [], Date.now()).length;
});
t('an untagged reminder can still be cancelled, or it could never be cleaned up', r3 === 2, r3 + '/2 cancellable');

console.log('\n5. THE PLAN STILL WINS — anything in the plan is never cancelled');
const r4 = await page.evaluate(() => {
  const pending = [{ id: 77, extra: { profileId: 'p1' } }];
  return window.__notifScopeTest.cancelCandidates(pending, new Set([77]), [], Date.now()).length;
});
t('an id that is in the plan is left alone', r4 === 0, r4 + ' cancelled');

console.log('\n5b. DELETING A PROFILE DISARMS ITS REMINDERS');
// There was NO check on this and an audit said so. Removing the cancelRemindersForProfile() call
// from deleteProfile() scored a clean 10/10. It drives the SHIPPED function against a stub plugin
// and asserts on what reached ln.cancel().
const del = await page.evaluate(async () => {
  const cancelled = [];
  window.Capacitor = {
    isNativePlatform: () => true,
    Plugins: { LocalNotifications: {
      getPending: async () => ({ notifications: [
        { id: 1, extra: { profileId: 'p1' } },
        { id: 2, extra: { profileId: 'p2' } },
        { id: 3, extra: { profileId: 'p2' } }
      ] }),
      cancel: async (arg) => { (arg.notifications || []).forEach(n => cancelled.push(n.id)); }
    } }
  };
  await window.__notifScopeTest.cancelForProfile('p2');
  return cancelled;
});
t('the helper cancels exactly that profile\'s reminders', del.length === 2 && del.includes(2) && del.includes(3), 'cancelled=[' + del.join(',') + ']');
t('and leaves the surviving profile\'s reminders alone', !del.includes(1), 'cancelled=[' + del.join(',') + ']');

// AND THE WIRING, WHICH THE CHECK ABOVE DOES NOT COVER. Driving the helper proves the helper
// works; it says nothing about whether deleteProfile calls it. A mutant that deleted the call
// scored a clean pass against the version of this section that stopped at the line above.
const wired = await page.evaluate(async () => {
  const cancelled = [];
  window.Capacitor = {
    isNativePlatform: () => true,
    Plugins: { LocalNotifications: {
      getPending: async () => ({ notifications: [
        { id: 1, extra: { profileId: 'p1' } }, { id: 2, extra: { profileId: 'p2' } }
      ] }),
      cancel: async (arg) => { (arg.notifications || []).forEach(n => cancelled.push(n.id)); }
    } }
  };
  window.__notifScopeTest.deleteProfile('p2');
  await new Promise(r => setTimeout(r, 400));   // the cancel is fire-and-forget by design
  const ps = JSON.parse(localStorage.getItem('chemowell-app-profiles-v1'));
  return { cancelled, remaining: ps.list.map(x => x.id) };
});
t('deleteProfile actually disarms that profile\'s reminders', wired.cancelled.includes(2), 'cancelled=[' + wired.cancelled.join(',') + ']');
t('and does not disarm the surviving profile\'s', !wired.cancelled.includes(1), 'cancelled=[' + wired.cancelled.join(',') + ']');
t('and the profile is really gone from the list', !wired.remaining.includes('p2'), 'remaining=[' + wired.remaining.join(',') + ']');

console.log('\n6. SETTINGS TELLS THE TRUTH ABOUT WHO IS COVERED');
// THE EXEMPTION THAT USED TO BE HERE WAS NOT HONEST, and an audit called it. It claimed this card
// "renders only on a native build" and that its copy was "covered by the native smoke test" --
// grep the repo for that test and there is exactly one hit: the sentence claiming it exists. The
// premise was wrong too: the card needs isNativeApp() true, which a ten-line Capacitor stub
// provides, so it was testable here all along and simply was not tested.
//
// It reads the RENDERED SENTENCE, not the data attribute beside it, because an audit once made
// those two disagree while every check stayed green.
const nativePage = await ctx.newPage();
await nativePage.addInitScript(() => {
  localStorage.setItem('chemowell-app-profiles-v1', JSON.stringify({
    list: [{ id: 'p1', name: 'Alex', createdAt: 1 }, { id: 'p2', name: 'Sam', createdAt: 2 }],
    activeId: 'p1'
  }));
  // tourDone matters: openDrawer() deliberately refuses to open while the first-run tour is up, so
  // without it the drawer never appears and this check fails for a reason that is not the card.
  // A COMPLETE profile plus a SCHEDULED medication. The status the card shows is driven by the
  // reminder PLAN, not by getPending() -- with no medications the plan is empty, the card falls to
  // 'empty', and the first version of this section unknowingly tested only that state. A window at
  // every hour of the day guarantees the plan is non-empty whenever this runs.
  localStorage.setItem('chemowell-app-p-p1-prefs-v1', JSON.stringify({
    patientName: 'Alex', onboarded: true, sex: 'female', treatmentType: 'chemo', tourDone: true, installedAt: 1
  }));
  localStorage.setItem('chemowell-app-p-p1-entries-v1', JSON.stringify([]));
  // `type: 'win'` IS THE WHOLE INGREDIENT, and three wrong theories died before an audit found it.
  // normalizeMedication DERIVES alerts (`type === 'win' && mode !== 'asneeded'`) and DISCARDS a
  // stored `alerts: true`; anything without type:'win' normalises to 'gap' and never enters the
  // reminder plan. So a fixture can render a flawless medication card and produce no reminders at
  // all -- which is how this section spent three rounds testing the `empty` state while believing
  // it could not reach any other.
  //
  // ONE window, not twenty-four, and it works at any hour: buildReminderPlan walks days forward,
  // so tomorrow's occurrence is always inside the 72h horizon. A suite that only passes in the
  // morning is a suite this repo has shipped before.
  localStorage.setItem('chemowell-app-p-p1-med-v1', JSON.stringify({ version: 2, archivedMeds: {}, meds: [
    { id: 'alpha', name: 'Alpha', type: 'win', schemaV: 2, quickLog: true,
      doses: [{ label: '1 tablet', pills: 1 }],
      windows: [{ start: 9, end: 12, name: 'Morning' }] }
  ] }));
  window.Capacitor = {
    isNativePlatform: () => true,
    Plugins: { LocalNotifications: {
      checkPermissions: async () => ({ display: 'granted' }),
      checkExactNotificationSetting: async () => ({ exact_alarm: 'granted' }),
      createChannel: async () => {},
      // ARMED REMINDERS, DELIBERATELY. With getPending() empty the card falls into its 'empty'
      // state -- "No reminders are currently due in the next 3 days" -- and an audit showed the
      // suite was therefore checking the disambiguating sentence ONLY in the state where there is
      // no count to disambiguate. Deleting the line from the 'on' and 'on-exact' states, the two
      // a real phone actually shows, scored a clean pass. These pending entries put the card in
      // 'on'.
      getPending: async () => ({ notifications: [
        { id: 4101, extra: { profileId: 'p1', kind: 'dose', pk: 'x' } },
        { id: 4102, extra: { profileId: 'p1', kind: 'dose', pk: 'y' } }
      ] }),
      schedule: async () => {}, cancel: async () => {}, addListener: () => ({ remove() {} })
    } }
  };
});
await nativePage.goto(BASE, { waitUntil: 'load' });
await nativePage.waitForTimeout(2500);
// Settings lives in the DRAWER, not the bottom nav -- the first version of this check clicked a
// bottom-nav button that does not exist, found nothing, and reported "not rendered" as though the
// card were broken. Open the menu the way a finger does, then tap the row.
await nativePage.evaluate(() => { const b = document.querySelector('[data-tour="menu-btn"]'); if (b) b.click(); });
await nativePage.waitForTimeout(700);
await nativePage.evaluate(() => { const b = [...document.querySelectorAll('#app-drawer button, #app-drawer [role="button"]')].find(x => /Settings/i.test(x.textContent)); if (b) b.click(); });
await nativePage.waitForTimeout(1600);
const scope = await nativePage.evaluate(() => {
  const el = document.querySelector('[data-notif-profile-scope]');
  return el ? { n: el.getAttribute('data-notif-profile-scope'), text: el.textContent.replace(/\s+/g, ' ').trim() } : null;
});
const cardState = await nativePage.evaluate(() => {
  const txt = document.body.innerText;
  if (/No reminders are currently due/i.test(txt)) return 'empty';
  if (/Notifications are on/i.test(txt)) return 'on';
  return 'other';
});
// THE STATE THIS SECTION REACHES IS ASSERTED, NOT HOPED FOR. Earlier versions silently landed in
// `empty` -- the one state with no count to disambiguate -- so deleting the scope line from `on`
// and `on-exact`, the two a real phone shows, scored a clean pass. An audit disproved the
// impossibility claim that replaced it; this is behavioural now, and the structural stand-in is
// gone rather than kept alongside.
t('the card is in the `on` state, which is what a real phone shows', cardState === 'on', 'state=' + cardState);
t('the scope line renders on a two-profile phone', !!scope, scope ? scope.text.slice(0, 80) : 'not rendered');
if (scope) {
  t('it names the profile the count belongs to', /Alex/.test(scope.text), scope.text.slice(0, 100));
  t('it counts the other profiles correctly', scope.n === '1', 'data-notif-profile-scope=' + scope.n);
  // THE SENTENCE MUST NOT CLAIM THE OTHER PROFILE HAS NO REMINDERS. It said exactly that in the
  // first draft -- true only while the bug destroyed them, and false the moment it was fixed.
  t('it does NOT claim the other profile has no reminders', !/no reminders/i.test(scope.text), scope.text.slice(0, 120));
  t('it says nothing adds to the other profile\'s reminders', /nothing adds to/i.test(scope.text), scope.text.slice(0, 120));
  // THE EXPIRY IS THE PART THAT MAKES IT A LIMITATION RATHER THAN A TRAP. Nothing re-arms an
  // inactive profile and NOTIF_HORIZON_MS is 72h, so "keeps the reminders it already had" is true
  // for at most three days and then that profile silently has none. An audit found the sentence
  // saying the first half and not the second, while I had reported it fixed.
  t('it says the other profile\'s reminders run out', /run out|three days/i.test(scope.text), scope.text.slice(0, 160));
  t('it does not claim the other profile is covered', !/(fully covered|will get every reminder|on time)/i.test(scope.text), scope.text.slice(0, 120));
}
// And it must stay quiet on a one-profile phone, which is every Free user.
const solo = await ctx.newPage();
await solo.addInitScript(() => {
  localStorage.setItem('chemowell-app-profiles-v1', JSON.stringify({ list: [{ id: 'p1', name: 'Alex', createdAt: 1 }], activeId: 'p1' }));
  localStorage.setItem('chemowell-app-p-p1-prefs-v1', JSON.stringify({ patientName: 'Alex', tourDone: true, installedAt: 1 }));
  window.Capacitor = { isNativePlatform: () => true, Plugins: { LocalNotifications: {
    checkPermissions: async () => ({ display: 'granted' }),
    checkExactNotificationSetting: async () => ({ exact_alarm: 'granted' }),
    createChannel: async () => {}, getPending: async () => ({ notifications: [] }),
    schedule: async () => {}, cancel: async () => {}, addListener: () => ({ remove() {} }) } } };
});
await solo.goto(BASE, { waitUntil: 'load' });
await solo.waitForTimeout(2000);
await solo.evaluate(() => { const b = document.querySelector('[data-tour="menu-btn"]'); if (b) b.click(); });
await solo.waitForTimeout(700);
await solo.evaluate(() => { const b = [...document.querySelectorAll('#app-drawer button, #app-drawer [role="button"]')].find(x => /Settings/i.test(x.textContent)); if (b) b.click(); });
await solo.waitForTimeout(1400);
const soloScope = await solo.evaluate(() => !!document.querySelector('[data-notif-profile-scope]'));
t('a one-profile phone is not told about profiles it does not have', soloScope === false, soloScope ? 'rendered anyway' : 'absent');

console.log('\n7. NOTHING THREW');
t('no page error at any point above', thrown.length === 0, thrown.join(' | ') || 'none');

console.log('\n' + (pass + fail) + ' checks: ' + pass + ' passed, ' + fail + ' failed');
await b.close();
process.exit(fail ? 1 : 0);
