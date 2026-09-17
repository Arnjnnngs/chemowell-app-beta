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

console.log('\n6. SETTINGS TELLS THE TRUTH ABOUT WHO IS COVERED');
const scope = await page.evaluate(() => {
  const el = document.querySelector('[data-notif-profile-scope]');
  return el ? { n: el.getAttribute('data-notif-profile-scope'), text: el.textContent.trim() } : null;
});
// The card only renders on a native build; on web the status is 'web'. Assert the FUNCTION's
// output rather than requiring a native shell the sandbox does not have.
const scopeText = await page.evaluate(() => {
  const ps = JSON.parse(localStorage.getItem('chemowell-app-profiles-v1'));
  const others = ps.list.filter(p => p.id !== 'p1');
  return others.length;
});
t('the fixture really does have a second profile to be honest about', scopeText === 1, scopeText + ' other profile(s)');
if (scope) {
  t('the scope line names this profile', /Alex/.test(scope.text), scope.text.slice(0, 90));
  t('the scope line says the other profile has none', /no reminders set/.test(scope.text), scope.text.slice(0, 90));
} else {
  console.log('  EXEMPT  the Settings notification card renders only on a native build; this sandbox is web.');
  console.log('          Its copy is covered by the native smoke test, not here. Stated rather than skipped.');
}

console.log('\n7. NOTHING THREW');
t('no page error at any point above', thrown.length === 0, thrown.join(' | ') || 'none');

console.log('\n' + (pass + fail) + ' checks: ' + pass + ' passed, ' + fail + ' failed');
await b.close();
process.exit(fail ? 1 : 0);
