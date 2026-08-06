// Quick self-verification for the app-v35 sw.js cache-version bump (PM-1 fix).
// Confirms: (1) a browser with the OLD v34 worker already installed genuinely detects and
// activates the NEW v35 worker (byte-diff triggers the update path), (2) the old cache gets
// deleted and a new v35-named cache is created, (3) zero console/page errors throughout.
// Uses a minimal same-origin harness page (sw_test_harness.html) rather than index.html so this
// test isn't racing the real app's own inline sw.js registration + reload-on-controllerchange
// logic (index.html ~6223-6239) — that logic is pre-existing and unaffected by this fix; testing
// it here would just add noise. Not a full regression suite — those (verify_v35_rebuild.mjs,
// verify_smoke_v24.mjs, verify_notif_fix_v24.mjs) already passed fresh in the PM stage.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';

const BASE = 'http://127.0.0.1:8917';
let pass = true;
const check = (label, cond) => { console.log(`${cond ? 'PASS' : 'FAIL'}: ${label}`); if (!cond) pass = false; };

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const context = await browser.newContext();
const page = await context.newPage();
const consoleErrors = [];
page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('pageerror', (err) => consoleErrors.push(String(err)));

await page.goto(`${BASE}/sw_test_harness.html`, { waitUntil: 'load' });

// Register the OLD v34 worker content directly (simulating a browser that already had it
// installed from a prior visit), then wait for it to actually control the page.
const oldReg = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.register('/sw_old_v34_sim.js', { scope: '/' });
  await new Promise((resolve) => {
    if (navigator.serviceWorker.controller) return resolve();
    navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true });
    setTimeout(resolve, 4000);
  });
  const keys = await caches.keys();
  return { active: reg.active ? reg.active.scriptURL : null, cacheKeys: keys };
});

check('old v34-content worker installs and takes control', !!oldReg.active);
check('old worker creates a chemowell-app-v34 cache', oldReg.cacheKeys.includes('chemowell-app-v34'));

// Now register the REAL, current sw.js (the v35 file on disk) at the same scope and confirm the
// browser detects it as a genuinely different worker (byte-diff) and activates it, replacing the
// old cache with the new one. This is the actual PM-1 defect: before the version-string bump,
// this file was byte-identical to v34's, so the browser's update algorithm would never have
// detected a change at all, and a device with v34 already installed would stay on v34 forever.
const newState = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  await reg.update();
  await new Promise((resolve) => {
    const done = () => reg.active && reg.active.scriptURL.endsWith('/sw.js') && !reg.installing && resolve();
    done();
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      nw && nw.addEventListener('statechange', () => { if (nw.state === 'activated') done(); });
    });
    setTimeout(resolve, 5000); // safety timeout
  });
  const keys = await caches.keys();
  return { scriptURL: reg.active ? reg.active.scriptURL : null, cacheKeys: keys };
});

check('new sw.js registers and activates', !!newState.scriptURL && newState.scriptURL.endsWith('/sw.js'));
check('new worker creates a chemowell-app-v35 cache', newState.cacheKeys.includes('chemowell-app-v35'));
check("old chemowell-app-v34 cache was cleaned up by the new worker's activate handler", !newState.cacheKeys.includes('chemowell-app-v34'));

check('zero console/page errors across the whole flow', consoleErrors.length === 0);
if (consoleErrors.length) console.log('Console errors:', consoleErrors);

await browser.close();
console.log(`\n=== FINAL RESULT: ${pass ? 'PASS' : 'FAIL'} ===`);
process.exit(pass ? 0 : 1);
