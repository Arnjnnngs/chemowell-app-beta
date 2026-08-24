// v58 gate — the Daily check-in is an END-OF-DAY question.
//
// Aaron, 2026-08-21: "bowel movement and appetite should be at the end of the day for both
// caretracker and chemowell. no longer for the day before."
//
// ChemoWell already asked about TODAY (app-v37 replaced the three yesterday-retrospective banners
// with one check-in modal). What it did NOT do was wait for the end of the day: the Home card was
// up from midnight, so the app asked "how did today go?" over breakfast. The caregiver already
// picks a check-in time in Settings and the scheduled notification already fires at it, so the
// card now honours that same time. These checks pin both halves.
//
// Run: env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy node test/v58-eod-checkin.mjs
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
// Playwright's location is environment-specific: the old sandbox kept it under a user-global npm
// prefix, this one ships it alongside node. Resolving a LIST of candidates instead of one pinned
// absolute path is what lets the same suite run in both. The pinned path made all 39 browser
// suites in these three repos unrunnable the moment the environment changed -- a gate that cannot
// start is indistinguishable from a gate that passes, which is the failure Rule 5 is about.
const { chromium } = (() => {
  const _p = require('node:path');
  const tries = ['playwright',
    _p.join(_p.dirname(process.execPath), '..', 'lib', 'node_modules', 'playwright'),
    '/opt/node22/lib/node_modules/playwright',
    '/home/claude/.npm-global/lib/node_modules/playwright'];
  for (const c of tries) { try { return require(c); } catch (e) {} }
  throw new Error('playwright not found; tried:\n  ' + tries.join('\n  '));
})();
for (const v of ['HTTPS_PROXY','https_proxy','HTTP_PROXY','http_proxy'])
  if (process.env[v]) { console.error('REFUSING: ' + v + ' set.'); process.exit(3); }

const FILE = process.argv.includes('--file')
  ? process.argv[process.argv.indexOf('--file') + 1]
  : new URL('../index.html', import.meta.url).pathname;
const raw = fs.readFileSync(FILE, 'utf8');

let fail = 0, pass = 0;
const t = (n, c, d) => { console.log((c ? '  PASS  ' : '  FAIL  ') + n + (d ? '  |  ' + String(d).replace(/\s+/g,' ').slice(0,200) : '')); c ? pass++ : fail++; };
const noise = (s) => /ERR_CERT_AUTHORITY_INVALID|ERR_TUNNEL_CONNECTION_FAILED|ERR_PROXY|cdn\.jsdelivr|Failed to load resource/i.test(s);

const browser = await chromium.launch();

// One browser context per frozen clock position. Freezing inside the served HTML (rather than
// with a fake timer) means the run is identical whatever the real wall time is.
async function bootAt(hour) {
  const at = new Date(); at.setHours(hour, 0, 0, 0);
  // ChemoWell's simNow() is the TEST_MODE date-offset shim, not a one-liner. Replace its whole
  // body so the frozen clock survives any future change to the offset logic.
  const marker = 'function simNow() {';
  const i = raw.indexOf(marker);
  if (i < 0) { console.error('simNow not found'); process.exit(4); }
  const end = raw.indexOf('\n}', i);
  if (end < 0) { console.error('simNow body not delimited'); process.exit(4); }
  const html = raw.slice(0, i) + 'function simNow() { return ' + at.getTime() + '; ' + raw.slice(end + 1);
  if (!html.includes('return ' + at.getTime())) { console.error('clock freeze failed'); process.exit(4); }
  const server = http.createServer((rq, rs) => {
    if (rq.url.startsWith('/index.html')) { rs.writeHead(200, {'Content-Type':'text/html'}); rs.end(html); return; }
    rs.writeHead(404); rs.end();
  }).listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  const port = server.address().port;
  const ctx = await browser.newContext({ viewport: { width: 360, height: 800 }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error' && !noise(m.text())) errs.push(m.text()); });
  page.on('pageerror', e => { if (!noise(e.message)) errs.push('pageerror: ' + e.message); });
  await page.goto('http://127.0.0.1:' + port + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);
  // Onboarding, then turn ON the two check-in metrics Aaron named.
  await page.fill('input[placeholder="Enter patient name"]', 'EOD Test');
  await page.getByRole('button', { name: 'Female', exact: true }).click();
  await page.getByRole('button', { name: 'Chemo', exact: true }).click();
  await page.getByRole('button', { name: 'Get started' }).click();
  await page.waitForTimeout(900);
  const skip = page.getByRole('button', { name: 'Skip guide' });
  if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(600); }
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.waitForTimeout(320);
  await page.getByRole('button', { name: /^Settings/ }).first().click();
  await page.waitForTimeout(600);
  // Click the two check-in toggles by their aria-pressed button, then assert they actually flipped
  // -- a click that silently misses would leave the check-in disabled and make EOD-4 fail for a
  // reason that has nothing to do with the end-of-day window.
  const setToggle = async (label) => page.evaluate((l) => {
    const b = [...document.querySelectorAll('main button')].find(x => (x.innerText||'').startsWith(l));
    if (!b) return 'missing';
    if (b.getAttribute('aria-pressed') !== 'true') b.click();
    return 'ok';
  }, label);
  for (const l of ['Bowel movement in daily check-in', 'Appetite in daily check-in']) {
    const r = await setToggle(l);
    if (r !== 'ok') { console.error('toggle not found: ' + l); process.exit(4); }
    await page.waitForTimeout(350);
  }
  const on = await page.evaluate(() => [...document.querySelectorAll('main button')]
    .filter(x => /daily check-in/i.test(x.innerText||'') && x.getAttribute('aria-pressed') === 'true')
    .map(x => (x.innerText||'').split('\n')[0]));
  if (on.length < 2) { console.error('toggles did not stick: ' + JSON.stringify(on)); process.exit(4); }
  // Reload rather than navigating the drawer back to Home: the drawer's closing overlay
  // intercepts pointer events for ~half a second and made this step flake. State is in
  // localStorage, so a reload lands straight on Home with the toggles still on.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);
  const skip2 = page.getByRole('button', { name: 'Skip guide' });
  if (await skip2.count()) { await skip2.first().click(); await page.waitForTimeout(600); }
  // The app restores the last view, which is Settings after toggling. Go to Home via the bottom
  // nav and PROVE we landed there -- the first version of this file read the Settings screen and
  // "found" the words "daily check-in" in its own toggle labels, a vacuous pass.
  await page.click('[data-tour="nav-home"]');
  await page.waitForTimeout(800);
  const onHome = await page.evaluate(() =>
    document.querySelector('[data-tour="nav-home"]').getAttribute('aria-current') === 'page');
  if (!onHome) { console.error('did not land on Home'); process.exit(4); }
  const home = await page.evaluate(() => document.querySelector('main').innerText);
  return { page, ctx, server, home, errs, close: async () => { await ctx.close(); server.close(); } };
}

console.log('\nEND-OF-DAY CHECK-IN — ChemoWell app-v58\n');

const morning = await bootAt(9);
t('EOD-1 the check-in card is NOT on Home at 9:00 AM',
  !/daily check-in/i.test(morning.home), morning.home.slice(0, 160));
t('EOD-2 Home asks nothing about a previous day in the morning',
  !/yesterday/i.test(morning.home), (morning.home.match(/.{0,60}yesterday.{0,60}/i) || [''])[0]);
t('EOD-3 no console or page errors at 9:00 AM', morning.errs.length === 0, morning.errs[0]);
await morning.close();

const evening = await bootAt(20);
t('EOD-4 the check-in card IS on Home at 8:00 PM (after the 19:00 default)',
  /daily check-in/i.test(evening.home), evening.home.slice(0, 160));
t('EOD-5 it asks about today, not a past day',
  /about today/i.test(evening.home) && !/yesterday/i.test(evening.home), evening.home.slice(0, 200));
t('EOD-6 no console or page errors at 8:00 PM', evening.errs.length === 0, evening.errs[0]);
await evening.close();

await browser.close();

// ---- source-level guards ----
t('EOD-7 the window is defined once and the card is gated on it',
  (raw.match(/function checkinWindowOpen/g) || []).length === 1 &&
  (raw.match(/&& checkinWindowOpen\(now\)\) \{/g) || []).length === 1);
t('EOD-8 the window comes from the caregiver\'s own setting, not a hardcoded hour',
  /timeValueToDecimalHour\(getDailyCheckinTime\(\)\)/.test(
    (raw.match(/function checkinWindowOpen[\s\S]{0,400}?\n\}/) || [''])[0]));
t('EOD-9 the Reports appetite summary describes today, not yesterday',
  !/Not yet logged for yesterday/.test(raw) && /Not yet logged for today/.test(raw));
t('EOD-10 no owner name anywhere in the shipped file',
  ![...raw.matchAll(/brandi/gi)].some(m => !raw.slice(Math.max(0, m.index - 12), m.index + 12).toLowerCase().includes('branding')));

console.log('\n' + pass + '/' + (pass + fail) + ' checks passed');
process.exit(fail === 0 ? 0 : 1);
