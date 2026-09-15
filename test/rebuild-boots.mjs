// Does the REBUILT file BOOT? Not "did the script print OK" -- that is exactly what it printed
// while producing a blank app for two audit rounds.
//
// THE FIRST VERSION OF THIS CHECK CALLED A HEALTHY BUILD DEAD. It failed on any console error, and
// in this sandbox a page fetching a font or an icon through the agent proxy logs
// ERR_TUNNEL_CONNECTION_FAILED -- eight of them against HEAD, which boots perfectly. A check that
// reds on the environment rather than the file is the same class of defect as one that greens on a
// broken build: it stops being read. It asks the three questions that matter instead:
//   * did the module throw (pageerror -- a ReferenceError from a temporal dead zone lands here)
//   * did the app render anything into #root
//   * did module evaluation reach the LAST line, which is what the debug-hook block proves
import _m from 'module';
const require = _m.createRequire(import.meta.url);
const { chromium } = (() => {
  for (const t of ['playwright', '/opt/node22/lib/node_modules/playwright', '/home/claude/.npm-global/lib/node_modules/playwright']) {
    try { return require(t); } catch (e) {}
  }
  throw new Error('playwright not found');
})();
const BASE = process.env.BASE;
const b = await chromium.launch();
const p = await b.newPage();
const thrown = [];
p.on('pageerror', (e) => thrown.push(String(e)));
await p.goto(BASE, { waitUntil: 'load' });
await p.waitForTimeout(2500);
const len = await p.evaluate(() => (document.querySelector('#root') || {}).innerHTML?.length || 0);
const hooks = await p.evaluate(() => ({
  whatsnew: typeof window.__whatsNewTest,
  version: window.__backTest && window.__backTest.version,
  key: window.__whatsNewTest && window.__whatsNewTest.key,
  older: window.__whatsNewTest && typeof window.__whatsNewTest.olderUnseen,
  firstEver: window.__whatsNewTest && typeof window.__whatsNewTest.firstEver,
}));
console.log('uncaught exceptions:', thrown.length ? thrown : 'none');
console.log('#root innerHTML length:', len);
console.log('hooks:', JSON.stringify(hooks));
const ok = thrown.length === 0 && len > 500 && hooks.whatsnew === 'object' && hooks.version === 'app-v84';
console.log(ok ? 'BOOTS' : 'DEAD');
await b.close();
process.exit(ok ? 0 : 1);
