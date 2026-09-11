// v74-med-source.mjs -- app-v74. The description can fill itself in from an official source, and the
// row says where it came from.
//
// WHAT IT PROVES, and the order matters because the FIRST one is the state a real phone may well be
// in forever:
//   1. THE LOOKUP FAILING CHANGES NOTHING. Offline, blocked cross-origin, 404, timeout: the app is
//      exactly what it was before this release. This is asserted first and hardest because the
//      sandbox this was built in cannot reach the real service at all -- so "it works when the fetch
//      works" is the half that is NOT evidence the release is safe. The half that is, is this one.
//   2. When the lookup succeeds the text is CACHED on the medication and survives the app being
//      closed and reopened with the network dead. A feature that needs the network to render is a
//      feature that is broken in a hospital basement.
//   3. THE LINK IS HONEST. "Where this came from" appears ONLY over wording that actually came from
//      that page. Anything else gets a lookup into the official search, labelled as a lookup.
//   4. What the caregiver typed still wins over everything, and when it does, the citation drops
//      back to a lookup -- because the sentence on screen is now hers, not the page's.
//   5. THE GUARDS RUN IN THE APP. Numbers, schedules, dosage forms, routes, fever claims and
//      paragraphs are discarded at runtime. Until this release those rules only ever ran against the
//      static table at build time, where no fetched string could reach them.
//   6. A stored URL that is not https is dropped on load. An unchecked one is a javascript: link
//      waiting to be tapped.
//
// Run:  node test/v74-med-source.mjs [--file <index.html>]
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
const exempt = (name, why) => console.log('  EXEMPT  ' + name + '  |  ' + why);

const P = 'chemowell-app-p-p1-';
const MED_KEY = P + 'med-v1';
const SEED_MEDS = [
  { id: 'zofran', name: 'Zofran', sub: 'Ondansetron', type: 'gap', gapH: 8, doses: [{ label: '4 mg', mg: 4 }] },
  // A name the built-in table does NOT know, so "the lookup filled something in" cannot be confused
  // with "the table already knew it". Without this every check below would pass on a build whose
  // fetch does nothing at all.
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

// THE STUBBED SOURCE. What the real service sends cannot be observed from here -- the egress policy
// in this sandbox refuses every external host -- so the endpoint is stubbed exactly the way Firebase
// has always been stubbed in this project, and `sourceMode` steers it per check.
let sourceMode = 'dead';        // dead | ok | unsafe | slow | nolink
let sourceHits = 0;
const PAGE_URL = 'https://medlineplus.gov/druginfo/meds/a601209.html';
const GOOD_TEXT = 'Prevents and settles nausea and vomiting.';
const UNSAFE_TEXT = 'Take one tablet by mouth every 8 hours to bring down a fever.';
const body = () => {
  if (sourceMode === 'nolink') return { feed: { entry: [{ title: { _value: 'X' }, summary: { _value: GOOD_TEXT } }] } };
  const text = sourceMode === 'unsafe' ? UNSAFE_TEXT : GOOD_TEXT;
  return { feed: { entry: [{ link: [{ href: PAGE_URL }], title: { _value: 'Ondansetron' }, summary: { _value: text } }] } };
};

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
await ctx.route('**/*', async route => {
  const u = route.request().url();
  if (u.startsWith('http://127.0.0.1:' + PORT)) return route.continue();
  if (u.includes('connect.medlineplus.gov')) {
    sourceHits++;
    if (sourceMode === 'dead') return route.abort();
    if (sourceMode === 'slow') { await new Promise(r => setTimeout(r, 9000)); return route.abort(); }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body()) });
  }
  if (u.includes('cdn.jsdelivr.net')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: '/* stubbed */' });
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
const saved = () => page.evaluate((k) => { try { return JSON.parse(localStorage.getItem(k) || '{}'); } catch (e) { return {}; } }, MED_KEY);
const medRec = async (id) => ((await saved()).meds || []).find(m => m.id === id) || null;
const purposeText = (id) => page.evaluate((i) => {
  const el = document.querySelector('[data-med-purpose="' + i + '"]');
  return el ? (el.innerText || '').trim() : null;
}, id);
const sourceLink = (id) => page.evaluate((i) => {
  const el = document.querySelector('[data-med-source="' + i + '"]');
  if (!el) return null;
  return { href: el.getAttribute('href') || '', exact: el.getAttribute('data-med-source-exact'), text: (el.innerText || '').trim() };
}, id);
// Re-save a medication through the real editor, which is the only thing that triggers a lookup.
const resave = async (name) => {
  await goMeds();
  await clickLabel('Edit ' + name);
  await page.waitForTimeout(600);
  await clickText(/^Save changes$/);
  await page.waitForTimeout(1500);
  await goMeds();
};

console.log('\n1. THE LOOKUP FAILING CHANGES NOTHING -- the state a real phone may be in forever');
{
  sourceMode = 'dead';
  const hitsBefore = sourceHits;
  await resave('Zofran');
  t('the app did try to look it up', sourceHits > hitsBefore, sourceHits - hitsBefore + ' request(s)');
  const rec = await medRec('zofran');
  t('nothing was cached, because nothing came back', !rec || !rec.purposeSource, JSON.stringify(rec && rec.purposeSource));
  const line = await purposeText('zofran');
  t('the built-in description still shows, exactly as before this release', !!line && line.length > 0, line);
  const link = await sourceLink('zofran');
  t('a LOOKUP link is offered, not a citation', !!link && link.exact === 'false', link ? link.text : '(none)');
  t('and it points at the official site', !!link && /^https:\/\/medlineplus\.gov\//.test(link.href), link ? link.href : '');
  t('no error reached the screen', pageErrors.length === 0, pageErrors.join(' | ').slice(0, 120));
  // A medication the table does NOT know must still be silent rather than showing an empty label.
  const unknown = await purposeText('madeupzz');
  t('a medication nothing knows about shows no description at all, not an empty one', unknown === null, String(unknown));
}

console.log('\n2. WHEN IT SUCCEEDS the text is cached on the record');
{
  sourceMode = 'ok';
  await resave('Madeupzz');
  const rec = await medRec('madeupzz');
  t('the official text is stored on the medication', !!rec && !!rec.purposeSource && rec.purposeSource.text === 'Prevents and settles nausea and vomiting.',
    rec && rec.purposeSource ? rec.purposeSource.text : '(none)');
  t('and the exact page it came from is stored with it',
    !!rec && !!rec.purposeSource && rec.purposeSource.url === 'https://medlineplus.gov/druginfo/meds/a601209.html',
    rec && rec.purposeSource ? rec.purposeSource.url : '(none)');
  t('the day it was fetched is recorded', !!rec && !!rec.purposeSource && Number(rec.purposeSource.fetchedAt) > 0,
    rec && rec.purposeSource ? String(rec.purposeSource.fetchedAt) : '');
  const line = await purposeText('madeupzz');
  t('it shows on the card, for a medication the app knew nothing about before', line === 'Prevents and settles nausea and vomiting.', String(line));
  const link = await sourceLink('madeupzz');
  t('THE CITATION IS EARNED: the link now says where this came from', !!link && link.exact === 'true', link ? link.text : '(none)');
  t('and it points at the EXACT page, not a search',
    !!link && link.href === 'https://medlineplus.gov/druginfo/meds/a601209.html', link ? link.href : '');
}

console.log('\n3. IT SURVIVES THE APP CLOSING, WITH THE NETWORK DEAD');
{
  sourceMode = 'dead';
  const hitsBefore = sourceHits;
  await load();
  await goMeds();
  const line = await purposeText('madeupzz');
  t('the cached description is still there after closing and reopening', line === 'Prevents and settles nausea and vomiting.', String(line));
  const link = await sourceLink('madeupzz');
  t('and so is the exact link', !!link && link.exact === 'true' && /a601209/.test(link.href), link ? link.href : '(none)');
  t('AND NOTHING WAS FETCHED TO RENDER IT -- no request at load or paint', sourceHits === hitsBefore,
    (sourceHits - hitsBefore) + ' request(s) during load and render');
}

console.log('\n4. WHAT SHE TYPED STILL WINS, and the citation stands down when it does');
{
  await goMeds();
  await clickLabel('Edit Madeupzz');
  await page.waitForTimeout(600);
  const typed = await page.evaluate(() => {
    const lab = [...document.querySelectorAll('label')].find(l => /what it/i.test(l.innerText || ''));
    const inp = lab && lab.querySelector('input, textarea');
    if (!inp) return false;
    inp.value = 'The one the doctor started in May'; inp.dispatchEvent(new Event('input', { bubbles: true })); return true;
  });
  t('her own wording can be typed in', typed);
  await clickText(/^Save changes$/);
  await page.waitForTimeout(1500);
  await goMeds();
  const line = await purposeText('madeupzz');
  t('her wording is what shows', line === 'The one the doctor started in May', String(line));
  const rec = await medRec('madeupzz');
  t('and the cached source is KEPT, not destroyed -- clearing her text brings it back',
    !!rec && !!rec.purposeSource && !!rec.purposeSource.url, rec && rec.purposeSource ? rec.purposeSource.url : '(gone)');
  const link = await sourceLink('madeupzz');
  t('THE CITATION STANDS DOWN: this sentence is hers, so the link no longer claims to be its source',
    !!link && link.exact === 'false', link ? link.text : '(none)');
}

console.log('\n5. THE GUARDS RUN IN THE APP, where a suite cannot reach');
{
  sourceMode = 'unsafe';
  await resave('Zofran');
  const rec = await medRec('zofran');
  const storedText = rec && rec.purposeSource ? String(rec.purposeSource.text || '') : '';
  t('text carrying a dose, a schedule, a route AND a fever claim is discarded', storedText === '', storedText || '(empty, as intended)');
  t('but the LINK is kept, because a link is not a claim about wording',
    !!rec && !!rec.purposeSource && !!rec.purposeSource.url, rec && rec.purposeSource ? rec.purposeSource.url : '(none)');
  const line = await purposeText('zofran');
  t('the card falls back to the line written here, not the unsafe one',
    !!line && !/fever|tablet|hours/i.test(line), String(line));
  const link = await sourceLink('zofran');
  t('and the link does NOT claim to be the source of a sentence it did not supply',
    !!link && link.exact === 'false', link ? link.text : '(none)');
}

console.log('\n6. A STORED URL THAT IS NOT https IS DROPPED ON LOAD');
{
  const planted = await page.evaluate((k) => {
    try {
      const cfg = JSON.parse(localStorage.getItem(k) || '{}');
      const med = (cfg.meds || []).find(m => m.id === 'zofran');
      if (!med) return false;
      med.purposeSource = { url: 'javascript:alert(1)', text: 'Settles nausea.', label: 'MedlinePlus', fetchedAt: Date.now() };
      localStorage.setItem(k, JSON.stringify(cfg));
      return true;
    } catch (e) { return false; }
  }, MED_KEY);
  t('a javascript: URL can be planted, the way another device could publish one', planted);
  sourceMode = 'dead';
  await load();
  await goMeds();
  const link = await sourceLink('zofran');
  t('THE RECORD SURVIVES IT: no javascript: link reaches the screen',
    !link || /^https:\/\//i.test(link.href), link ? link.href : '(no link)');
  t('and no page error was thrown getting there', pageErrors.length === 0, pageErrors.join(' | ').slice(0, 120));
}

console.log('\n7. A SLOW SOURCE NEVER DELAYS THE SAVE');
{
  sourceMode = 'slow';
  await goMeds();
  await clickLabel('Edit Zofran');
  await page.waitForTimeout(600);
  const started = Date.now();
  await clickText(/^Save changes$/);
  await page.waitForFunction(() => !document.querySelector('[data-med-editor]'), null, { timeout: 5000 }).catch(() => {});
  const closed = await page.evaluate(() => !document.querySelector('[data-med-editor]'));
  const took = Date.now() - started;
  t('the editor closed without waiting on the lookup', closed && took < 5000, took + 'ms, with the source stalling for 9s');
  sourceMode = 'dead';
}

console.log('\n-- nothing broke on the way');
t('no page errors', pageErrors.length === 0, pageErrors.join(' | ').slice(0, 200));

await browser.close();
server.close();
console.log('\n' + pass + '/' + (pass + fail) + ' checks passed' + (fail ? '  <-- FAIL' : ''));
process.exit(fail ? 1 : 0);
