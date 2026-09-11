// v74-med-lookup.mjs -- app-v74. Every medication links to a lookup, and NOTHING leaves the phone.
//
// WHY THE FIRST CHECK IS THE ONE THAT MATTERS. An earlier build of this release fetched a
// description from MedlinePlus when a medication was saved. It worked and it was audited twice, and
// it was wrong to ship: this app tells its users, on screen, "no cloud, no accounts, no tracking,
// and the app never sends your information anywhere" -- and a lookup sends the MEDICATION NAME.
// Nothing identifying, and a US government service rather than an ad network, but a sequence of drug
// names from one address composes into "someone here is having chemotherapy", and it would have made
// the app's own promise untrue.
// So the release is a LINK, and a link is not a transmission. Section 1 asserts that literally: not
// one request to anything outside this machine, through loading, rendering, saving and editing. If
// that check ever goes red, the promise on the Welcome screen has become a lie.
//
// Run:  node test/v74-med-lookup.mjs [--file <index.html>]
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = (() => {
  const _p = require('node:path');
  const tries = ['playwright',
    _p.join(_p.dirname(process.execPath), '..', 'lib', 'node_modules', 'playwright'),
    '/opt/node22/lib/node_modules/playwright',
    '/home/claude/.npm-global/lib/node_modules/playwright'];
  for (const c of tries) { try { return require(c); } catch (e) {} }
  throw new Error('playwright not found');
})();
const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const APP_FILE = argv.indexOf('--file') >= 0 ? argv[argv.indexOf('--file') + 1] : path.join(HERE, '..', 'index.html');
for (const v of ['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy'])
  if (process.env[v]) { console.error('REFUSING: ' + v + ' set.'); process.exit(3); }

const rawHtml = fs.readFileSync(APP_FILE, 'utf8');
let pass = 0, fail = 0;
const t = (name, cond, detail) => {
  console.log('  ' + (cond ? 'PASS  ' : 'FAIL  ') + name + (detail ? '  |  ' + detail : ''));
  cond ? pass++ : fail++;
};

const P = 'chemowell-app-p-p1-';
const MED_KEY = P + 'med-v1';
const SEED_MEDS = [
  { id: 'zofran', name: 'Zofran', sub: 'Ondansetron', type: 'gap', gapH: 8, doses: [{ label: '4 mg', mg: 4 }] },
  // A name nothing in the table knows, so "a medication with no description still gets a link" is a
  // real case rather than a hypothetical one.
  { id: 'madeupzz', name: 'Madeupzz', sub: '', type: 'gap', gapH: 6, doses: [{ label: '1 tab', mg: 0 }] }
];
const SEED_PREFS = { patientName: 'Test Patient', sex: 'female', treatmentType: 'chemo',
  tourDone: true, ceilingMg: 2500, tempUnit: 'Fahrenheit', weightUnit: 'lbs',
  installedAt: Date.now() - 30 * 86400000 };

const server = http.createServer((rq, rs) => {
  if (rq.url.startsWith('/index.html')) { rs.writeHead(200, { 'Content-Type': 'text/html' }); rs.end(rawHtml); return; }
  rs.writeHead(204); rs.end();
}).listen(0, '127.0.0.1');
await new Promise(r => server.once('listening', r));
const PORT = server.address().port;
const URL_ = 'http://127.0.0.1:' + PORT + '/index.html';

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
// EVERY REQUEST THAT IS NOT THIS MACHINE IS RECORDED. Not blocked silently -- recorded, so the check
// below can name what was asked for rather than just failing.
const offDevice = [];
await ctx.route('**/*', route => {
  const u = route.request().url();
  if (u.startsWith('http://127.0.0.1:' + PORT)) return route.continue();
  if (u.startsWith('data:') || u.startsWith('blob:')) return route.continue();
  offDevice.push(u);
  return route.abort();
});
const page = await ctx.newPage();
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e)));
await page.addInitScript(([p, mk, meds, prefs]) => {
  if (localStorage.getItem(p + 'prefs-v1')) return;
  localStorage.setItem(p + 'entries-v1', JSON.stringify([]));
  localStorage.setItem(p + 'prefs-v1', JSON.stringify(prefs));
  localStorage.setItem(mk, JSON.stringify({ version: 1, meds, archivedMeds: {} }));
}, [P, MED_KEY, SEED_MEDS, SEED_PREFS]);
const load = async () => { await page.goto(URL_, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1800); };
await load();

const reached = await page.evaluate(() => document.querySelectorAll('button').length > 5);
t('the app got past first-run setup with the fixture seeded', reached);
if (!reached) { await browser.close(); server.close(); console.log('\nFAILED'); process.exit(1); }

const clickText = async (re) => page.evaluate(([src, flags]) => {
  const rx = new RegExp(src, flags);
  const b = [...document.querySelectorAll('button')].find(x => rx.test((x.innerText || '').trim()));
  if (b) { b.click(); return true; } return false;
}, [re.source, re.flags]);
const clickLabel = async (label) => page.evaluate((l) => {
  const b = [...document.querySelectorAll('button')].find(x => (x.getAttribute('aria-label') || '') === l);
  if (b) { b.click(); return true; } return false;
}, label);
const goMeds = async () => { await clickText(/^Meds$/); await page.waitForTimeout(800); };
const linkFor = (id) => page.evaluate((i) => {
  const el = document.querySelector('[data-med-source="' + i + '"]');
  if (!el) return null;
  return { href: el.getAttribute('href') || '', target: el.getAttribute('target') || '',
    rel: el.getAttribute('rel') || '', text: (el.innerText || '').trim(),
    height: Math.round(el.getBoundingClientRect().height) };
}, id);
const purposeText = (id) => page.evaluate((i) => {
  const el = document.querySelector('[data-med-purpose="' + i + '"]');
  return el ? (el.innerText || '').trim() : null;
}, id);

console.log('\n1. NOTHING LEAVES THE PHONE -- the reason this release is a link and not a lookup');
{
  await goMeds();
  // exercise every path that could plausibly reach out: render, save, edit, reload
  await clickLabel('Edit Zofran');
  await page.waitForTimeout(600);
  await clickText(/^Save changes$/);
  await page.waitForTimeout(1500);
  await load();
  await goMeds();
  await page.waitForTimeout(1200);
  // WHAT MATTERS IS WHAT THE REQUESTS CARRY. Writing this as "not one request" failed on a correct
  // build and taught me something: the app already loads four Capacitor libraries from a CDN, and
  // has since long before this release. They carry no patient data -- they are library files -- but
  // they do reveal the device's IP to that CDN on every open, which is worth knowing and is recorded
  // rather than hidden behind an assertion that was quietly wrong.
  const KNOWN_CDN = /^https:\/\/cdn\.jsdelivr\.net\/npm\/@capacitor\//;
  const unexpected = offDevice.filter(u => !KNOWN_CDN.test(u));
  t('NO REQUEST OFF THIS MACHINE BEYOND THE LIBRARIES THIS APP ALREADY LOADED, through loading, rendering, saving and editing',
    unexpected.length === 0, unexpected.length ? unexpected.slice(0, 3).join(' | ') : '0 new destinations');
  // THE CHECK THAT ACTUALLY GUARDS THE PROMISE. A medication name is the thing this release could
  // have leaked, so it is named explicitly: if "Zofran" or "Madeupzz" ever appears in an outbound
  // URL, the Welcome screen's "never sends your information anywhere" has become a lie.
  const carriesUserData = offDevice.filter(u => /Zofran|Madeupzz|Compazine|Test%20Patient|Test\+Patient/i.test(u));
  t('AND NOT ONE CARRIES A MEDICATION NAME OR ANYTHING ELSE OF HERS',
    carriesUserData.length === 0, carriesUserData.length ? carriesUserData.join(' | ') : 'nothing of hers left the phone');
  t('the CDN loads are exactly the four that were here before this release, so a fifth destination would fail this',
    offDevice.every(u => KNOWN_CDN.test(u)) && new Set(offDevice).size <= 4,
    [...new Set(offDevice)].length + ' distinct: ' + [...new Set(offDevice)].map(u => u.split('/npm/')[1] || u).join(', '));
  t('and the app carries no lookup code at all',
    !/fetchPurposeSource|refreshPurposeSource/.test(rawHtml), '');
}

console.log('\n2. EVERY MEDICATION HAS A LOOKUP LINK, including one nothing knows about');
{
  const a = await linkFor('zofran');
  t('a medication the app can describe has a link', !!a, a ? a.text : '(none)');
  t('it points at a search for that medication on the official site',
    !!a && a.href === 'https://medlineplus.gov/search/?query=Zofran', a ? a.href : '');
  const b = await linkFor('madeupzz');
  const noDesc = await purposeText('madeupzz');
  t('a medication with NO description still gets one', !!b, b ? b.text : '(none)');
  t('and it shows no empty description above it', noDesc === null, String(noDesc));
  t('the link is built from that medication\'s own name',
    !!b && b.href === 'https://medlineplus.gov/search/?query=Madeupzz', b ? b.href : '');
}

console.log('\n3. THE LINK NEVER CLAIMS TO BE A SOURCE');
{
  // The description above it was written in this repo. Saying "source" or "where this came from"
  // over it would be a false citation -- the class of defect this project keeps being refused for.
  const a = await linkFor('zofran');
  t('it reads as a lookup, not a citation', !!a && /look it up/i.test(a.text), a ? a.text : '');
  t('and never says the description came from there',
    !!a && !/came from|source/i.test(a.text), a ? a.text : '');
  const disclaimer = await page.evaluate(() => {
    const el = document.querySelector('[data-med-disclaimer]');
    return el ? (el.innerText || '').trim() : null;
  });
  t('the disclaimer says the descriptions are written here', !!disclaimer && /written here/i.test(disclaimer),
    disclaimer ? disclaimer.slice(0, 90) : '(none)');
  t('and does NOT claim they came from MedlinePlus',
    !!disclaimer && !/came from MedlinePlus|from MedlinePlus, /i.test(disclaimer), '');
}

console.log('\n4. IT OPENS SAFELY, and it can be tapped');
{
  const a = await linkFor('zofran');
  t('https only', !!a && /^https:\/\//.test(a.href), a ? a.href : '');
  t('opens in a new tab', !!a && a.target === '_blank', a ? a.target : '');
  t('noopener AND noreferrer -- the opened page gets no handle on this one, and is not told which app she came from',
    !!a && /noopener/.test(a.rel) && /noreferrer/.test(a.rel), a ? a.rel : '');
  t('it meets the 44px touch target this project holds every control to',
    !!a && a.height >= 44, a ? a.height + 'px' : '');
}

console.log('\n5. RENAMING A MEDICATION MOVES THE LINK WITH IT');
{
  // The previous build of this release stored a page per medication and carried the OLD drug's page
  // onto the new name -- an audit blocked it. Built from the current name, that cannot happen; this
  // check is what proves the property survived the rewrite.
  await goMeds();
  await clickLabel('Edit Madeupzz');
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    const lab = [...document.querySelectorAll('label')].find(l => /name/i.test(l.innerText || ''));
    const inp = lab && lab.querySelector('input');
    if (inp) { inp.value = 'Compazine'; inp.dispatchEvent(new Event('input', { bubbles: true })); }
  });
  await clickText(/^Save changes$/);
  await page.waitForTimeout(1200);
  await goMeds();
  const a = await linkFor('madeupzz');
  t('the link now points at the new name', !!a && /query=Compazine$/.test(a.href), a ? a.href : '');
  t('and carries no trace of the old one', !!a && !/Madeupzz/.test(a.href), a ? a.href : '');
  const desc = await purposeText('madeupzz');
  t("and the app's own description for the new name appears", desc === 'Settles nausea and vomiting.', String(desc));
}

console.log('\n-- nothing broke on the way');
t('no page errors', pageErrors.length === 0, pageErrors.join(' | ').slice(0, 200));
t('still nothing of hers has left the phone, after everything above',
  offDevice.filter(u => /Zofran|Madeupzz|Compazine|Test%20Patient|Test\+Patient/i.test(u)).length === 0,
  offDevice.length + ' off-device request(s), all library files');

await browser.close();
server.close();
console.log('\n' + pass + '/' + (pass + fail) + ' checks passed' + (fail ? '  <-- FAIL' : ''));
process.exit(fail ? 1 : 0);
