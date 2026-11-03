// v93-profile-notifications.mjs — WHOSE DOSE IS DUE, AND WHO HAS BEEN SILENCED?
//
// Aaron, 2026-11-03, three asks in one message:
//   "there's multiple profiles and getting notifications for all the accounts ... but there's no
//    indication on who's account that message is for."
//   "there should be a notification number on the app itself to say if there's a medication due
//    ... you can look over on the left hand side with the drop down of the accounts or profile and
//    you can see an indicator of who needs to take the medication."
//   "we also need a way to silence a certain account profile. Maybe that person is currently in
//    the hospital, they're currently not taking their meds."
//
// WHY HIS FIRST COMPLAINT EXISTS AT ALL, because it reads like a regression and is the opposite.
// Before app-v85 a profile switch DESTROYED every other profile's armed reminders. app-v85 fixed
// that, so a phone with three people on it now correctly gets three people's reminders -- and
// every one of them said only "Alpha Due".
//
// WHAT THIS SUITE DRIVES. The SHIPPED functions through the app's own test hook, never a copy of
// them: `notifProfileLabel`, `withProfileLabel`, `buildReminderPlan` (via buildReminderTitles),
// `profileDueSummary`, `totalDueCount`, `setProfileMuted`. A suite that re-implements the decision
// it is checking proves only that it agrees with itself, which is a failure this repo has shipped
// repeatedly. The rendered drawer is read out of the DOM through explicit `data-` hooks (Rule 5),
// never by text.
//
// Run: env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy node test/v93-profile-notifications.mjs
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
  if (process.env[v]) { console.log('  FAIL  ' + v + ' is set'); console.error('REFUSING: ' + v + ' is set — the suite cannot reach its own local server through a proxy.'); process.exit(3); }

const argv = process.argv.slice(2);
const arg = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const BASE_IN = process.env.FALSIFY_BASE || arg('--base');
const APP_FILE = arg('--file') || new URL('../index.html', import.meta.url).pathname;

// A FROZEN CLOCK, BUILT WITH Date.UTC AND PINNED TO UTC. `setHours` would make the fixture's idea
// of "now" depend on the HOST's zone, which is how v90-chart-axes was red for one hour a day on
// correct code; the browser context is pinned to UTC as well, because pinning only one half leaves
// the other free to move. 10:30 UTC sits inside the 09:00-12:00 window below and outside 14:00-16:00.
const FROZEN = Date.UTC(2026, 10, 3, 10, 30, 0);
const freeze = `(() => {
  const F = ${FROZEN};
  const RealDate = Date;
  function FakeDate(...a) { return a.length ? new RealDate(...a) : new RealDate(F); }
  FakeDate.prototype = RealDate.prototype;
  FakeDate.now = () => F;
  FakeDate.UTC = RealDate.UTC; FakeDate.parse = RealDate.parse;
  Object.setPrototypeOf(FakeDate, RealDate);
  window.Date = FakeDate;
})()`;

const med = (id, name, start, end) => ({
  id, name, type: 'win', schemaV: 2, quickLog: true,
  doses: [{ label: '1 tablet', pills: 1 }],
  windows: [{ start, end, name: 'Morning' }]
});
// `type: 'win'` IS THE INGREDIENT. normalizeMedication DERIVES `alerts` from it and DISCARDS a
// stored `alerts: true`; anything without it normalises to 'gap' and never counts as due. A
// fixture can render a flawless medication card and produce no reminders at all.
const seedTwo = `(() => {
  const P = (id, s) => 'chemowell-app-p-' + id + '-' + s;
  localStorage.setItem('chemowell-app-profiles-v1', JSON.stringify({
    list: [{ id: 'p1', name: 'Dana', createdAt: 1 }, { id: 'p2', name: 'Rosa', createdAt: 2 }],
    activeId: 'p1'
  }));
  localStorage.setItem('chemowell-app-license-v1', JSON.stringify({ tier: 'pro' }));
  [['p1', 'Dana'], ['p2', 'Rosa']].forEach(([id, nm]) => {
    localStorage.setItem(P(id, 'prefs-v1'), JSON.stringify({ patientName: nm, onboarded: true, treatmentType: 'chemo', tourDone: true }));
    localStorage.setItem(P(id, 'entries-v1'), JSON.stringify([]));  // Rosa's is replaced below
  });
  // Dana: one window OPEN right now (09-12) and one that is not (14-16). One due.
  localStorage.setItem(P('p1', 'med-v1'), JSON.stringify({ version: 2, archivedMeds: {}, meds: [
    ${JSON.stringify(med('alpha', 'Alpha', 9, 12))}, ${JSON.stringify(med('beta', 'Beta', 14, 16))}
  ] }));
  // Rosa: THREE windows open right now and one of them ALREADY LOGGED, so her count is 2. Still a
  // DIFFERENT number from Dana's on purpose -- a suite where both profiles show the same figure
  // cannot tell a per-profile count from a global one.
  //
  // THE LOGGED ONE IS THE WHOLE POINT, and the first version of this fixture did not have it: both
  // profiles carried an empty entries array, so "already logged in this window" was a branch no
  // check could reach, and the corpus mutant that DELETES that branch survived as a no-op. A dose
  // you have already given must stop asking -- the most ordinary thing this count does, and the
  // one thing untested. Same class as the empty-Home trap overflow-scan has paid for twice.
  localStorage.setItem(P('p2', 'med-v1'), JSON.stringify({ version: 2, archivedMeds: {}, meds: [
    ${JSON.stringify(med('gamma', 'Gamma', 9, 12))}, ${JSON.stringify(med('delta', 'Delta', 8, 11))}, ${JSON.stringify(med('eps', 'Epsilon', 10, 13))}
  ] }));
  // 09:30 on the frozen day, inside gamma's 09-12 window. The context is pinned to UTC and the app
  // reads dayStart() in local time, so these agree by construction rather than by luck.
  localStorage.setItem(P('p2', 'entries-v1'), JSON.stringify([
    { id: 'g1', medId: 'gamma', dose: '1 tablet', ts: ${Date.UTC(2026, 10, 3, 9, 30)} }
  ]));
})()`;
const seedOne = `(() => {
  const P = (s) => 'chemowell-app-p-p1-' + s;
  localStorage.setItem('chemowell-app-profiles-v1', JSON.stringify({ list: [{ id: 'p1', name: 'Dana', createdAt: 1 }], activeId: 'p1' }));
  localStorage.setItem('chemowell-app-license-v1', JSON.stringify({ tier: 'free' }));
  localStorage.setItem(P('prefs-v1'), JSON.stringify({ patientName: 'Dana', onboarded: true, treatmentType: 'chemo', tourDone: true }));
  localStorage.setItem(P('entries-v1'), JSON.stringify([]));
  localStorage.setItem(P('med-v1'), JSON.stringify({ version: 2, archivedMeds: {}, meds: [${JSON.stringify(med('alpha', 'Alpha', 9, 12))}] }));
})()`;

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
async function openApp(seed) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, timezoneId: 'UTC' });
  const noise = [];
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
  await page.addInitScript(seed);
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  return { ctx, page, noise };
}

// ---------------------------------------------------------------- TWO PROFILES
{
  const { ctx, page, noise } = await openApp(seedTwo);

  const label = await page.evaluate(() => window.__v86Test.notifProfileLabel());
  ok('two profiles: the notification label is the active profile’s name', label === 'Dana', 'got ' + JSON.stringify(label));

  const titles = await page.evaluate(() => window.__v86Test.buildReminderTitles());
  // THE CLAIM IS THE NAME, NOT THE GLYPH. A first version asserted startsWith('Dana · ') and the
  // corpus's own over-block control -- swap the middle dot for an en dash, which a real release may
  // well do -- turned that check red. Pinning today's punctuation would make this suite refuse a
  // legitimate restyle while catching nothing extra, so it asserts what Aaron actually asked for:
  // the name is there, it is first, and the medication name still follows it.
  ok('every armed reminder title starts with the name and still names the medication',
    titles.length > 0 && titles.every(t => t.startsWith('Dana') && /Alpha|Beta/.test(t.slice(4))),
    titles.length ? JSON.stringify(titles.slice(0, 3)) : 'the plan was EMPTY, so this check was vacuous');
  // THE NAME GOES FIRST, and that is the assertion -- Android truncates a title from the END, so a
  // name appended to a long medication name is the part that disappears.
  ok('the name is at the FRONT of the title, not appended', titles.every(t => t.indexOf('Dana') === 0),
    JSON.stringify(titles.slice(0, 2)));

  const sum = await page.evaluate(() => window.__v86Test.profileDueSummary());
  ok('the summary has one row per profile', sum.length === 2, JSON.stringify(sum.map(r => r.id)));
  const dana = sum.find(r => r.id === 'p1'), rosa = sum.find(r => r.id === 'p2');
  ok('the OPEN profile’s count is exact (1 of its 2 windows is open now)', dana && dana.count === 1 && dana.approx === false, JSON.stringify(dana));
  // THE OTHER PROFILE IS THE WHOLE POINT: this number is read out of another profile's storage
  // without switching to it, which is what makes the drawer able to say who needs something.
  ok('the OTHER profile’s count is read without switching to it', rosa && rosa.count === 2, JSON.stringify(rosa));
  // A DOSE ALREADY GIVEN STOPS ASKING. Rosa has THREE windows open right now and one of them is
  // logged, so the honest answer is 2. A count that ignored what had been logged would say 3 --
  // and would keep saying it all day, for every profile, which is what makes a reminder count
  // worth nothing. This is the check the corpus proved was missing.
  ok('a dose already logged is not counted (3 windows open, 1 given)', rosa && rosa.count === 2, JSON.stringify(rosa));
  ok('the other profile’s name is resolved too', rosa && rosa.name === 'Rosa', JSON.stringify(rosa && rosa.name));
  ok('the total is the sum across profiles', (await page.evaluate(() => window.__v86Test.totalDueCount())) === 3);

  // ---- the menu badge
  const menuBadge = await page.$eval('[data-tour="menu-btn"]', (el) => {
    const s = el.querySelector('[data-menu-due]');
    return s ? s.getAttribute('data-menu-due') : null;
  });
  ok('the menu button carries the total', menuBadge === '3', 'got ' + JSON.stringify(menuBadge));

  // ---- the drawer rows
  await page.click('[data-tour="menu-btn"]');
  await page.waitForTimeout(400);
  const rows = await page.$$eval('[data-profile-row]', (els) => els.map(e => ({
    id: e.getAttribute('data-profile-row'),
    due: (e.querySelector('[data-profile-due]') || {}).getAttribute ? e.querySelector('[data-profile-due]').getAttribute('data-profile-due') : null,
    mute: !!e.querySelector('[data-profile-mute]')
  })));
  ok('the drawer lists every profile', rows.length === 2, JSON.stringify(rows));
  ok('each row carries that profile’s own count', rows.find(r => r.id === 'p1')?.due === '1' && rows.find(r => r.id === 'p2')?.due === '2', JSON.stringify(rows));
  ok('each row has a silence control', rows.every(r => r.mute), JSON.stringify(rows));

  // A MISSING ROW MUST FAIL, NOT THROW. The mutant that hides the drawer profile list entirely
  // made every check below `page.$eval('[data-profile-row="p2"]')` reject, and the suite died with
  // no `checks:` line at all -- which the falsify harness can only report as "could not measure".
  // A crash is indistinguishable from a refusal, and this repo has written that lesson down twice.
  // The dependent checks are now recorded as FAILURES and the walk continues.
  if (!rows.some(r => r.id === 'p2')) {
    ['the silenced profile is recorded as muted', 'a silenced profile contributes nothing to the total',
     'the menu badge drops to the unsilenced total', 'the silenced row stops showing a due number',
     'the silence control reports its state to a screen reader',
     'the silenced control draws a different icon from the unsilenced one',
     'the silenced icon is a struck-through bell, not the home fallback',
     'unsilencing restores the total'].forEach(l => ok(l, false, 'no [data-profile-row="p2"] to act on'));
  } else {

  // ---- silencing the OTHER profile, which is the case Aaron described
  await page.click('[data-profile-mute="p2"]');
  await page.waitForTimeout(500);
  ok('the silenced profile is recorded as muted', (await page.evaluate(() => window.__v86Test.profileIsMuted('p2'))) === true);
  ok('a silenced profile contributes nothing to the total', (await page.evaluate(() => window.__v86Test.totalDueCount())) === 1);
  const after = await page.$eval('[data-tour="menu-btn"]', (el) => {
    const s = el.querySelector('[data-menu-due]');
    return s ? s.getAttribute('data-menu-due') : null;
  });
  ok('the menu badge drops to the unsilenced total', after === '1', 'got ' + JSON.stringify(after));
  const rowAfter = await page.$eval('[data-profile-row="p2"]', (e) => ({
    due: !!e.querySelector('[data-profile-due]'),
    pressed: e.querySelector('[data-profile-mute]').getAttribute('aria-pressed')
  }));
  ok('the silenced row stops showing a due number', rowAfter.due === false, JSON.stringify(rowAfter));
  ok('the silence control reports its state to a screen reader', rowAfter.pressed === 'true', JSON.stringify(rowAfter));

  // THE ICON IS NOT A HOUSE. svgIcon falls back to `paths.home` for any name it does not have, so a
  // missing `bellOff` would render a house beside the words "Reminders off" -- confidently, and
  // with nothing failing. This compares the muted control's drawn paths against the app's own home
  // icon rather than asserting a path string, which would just pin today's artwork.
  const iconCheck = await page.evaluate(() => {
    const muted = document.querySelector('[data-profile-mute="p2"] svg');
    const home = document.querySelector('[data-profile-mute="p1"] svg');
    return { mutedHTML: muted ? muted.innerHTML : '', unmutedHTML: home ? home.innerHTML : '' };
  });
  ok('the silenced control draws a different icon from the unsilenced one',
    iconCheck.mutedHTML && iconCheck.unmutedHTML && iconCheck.mutedHTML !== iconCheck.unmutedHTML);
  ok('the silenced icon is a struck-through bell, not the home fallback',
    iconCheck.mutedHTML.includes('M6 9a6 6 0') && iconCheck.mutedHTML.includes('M4 3.5 20 20.5'),
    iconCheck.mutedHTML.slice(0, 80));

  // ---- unsilencing puts it back
  await page.click('[data-profile-mute="p2"]');
  await page.waitForTimeout(500);
  ok('unsilencing restores the total', (await page.evaluate(() => window.__v86Test.totalDueCount())) === 3);
  }

  if (noise.length) {
    const uniq = [...new Set(noise)];
    checks++; fails.push('console: ' + uniq.slice(0, 2).join(' | '));
    console.log('  FAIL  the app logged ' + uniq.length + ' console error(s)/warning(s): ' + uniq[0]);
  } else { ok('no console errors or warnings', true); }
  await ctx.close();
}

// ---------------------------------------------------------------- ONE PROFILE
{
  const { ctx, page, noise } = await openApp(seedOne);
  const label = await page.evaluate(() => window.__v86Test.notifProfileLabel());
  // ON A SINGLE-PROFILE PHONE THE NAME IS NOISE, in the one line of text Android shows before it
  // truncates. This is the over-block control of this suite: a fix that prefixes unconditionally
  // passes every check above and fails here.
  ok('one profile: no name is prefixed', label === '', 'got ' + JSON.stringify(label));
  const titles = await page.evaluate(() => window.__v86Test.buildReminderTitles());
  // Asserted as "the title BEGINS with the medication", not "contains no middle dot" -- same
  // reasoning as the two-profile check above: a separator is styling, a name is the feature.
  ok('one profile: the title begins with the medication, with nothing in front of it',
    titles.length > 0 && titles.every(t => t.startsWith('Alpha')),
    titles.length ? JSON.stringify(titles.slice(0, 2)) : 'the plan was EMPTY, so this check was vacuous');
  const menuBadge = await page.$eval('[data-tour="menu-btn"]', (el) => !!el.querySelector('[data-menu-due]'));
  ok('one profile: the menu carries no count', menuBadge === false);
  await page.click('[data-tour="menu-btn"]');
  await page.waitForTimeout(400);
  const rows = await page.$$eval('[data-profile-row]', (els) => els.length);
  ok('one profile: the drawer shows no profile list', rows === 0, 'rows=' + rows);
  if (noise.length) { checks++; fails.push('console (single): ' + noise[0]); console.log('  FAIL  single-profile console: ' + noise[0]); }
  else { ok('no console errors or warnings (single profile)', true); }
  await ctx.close();
}

await b.close();
if (server) server.close();

console.log('');
console.log(checks + ' checks: ' + (checks - fails.length) + ' passed, ' + fails.length + ' failed');
if (fails.length) { console.log('\nFAILURES:'); fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
console.log('PASS — every reminder names its profile, the counts are per person, and silencing one person stops only theirs.');
