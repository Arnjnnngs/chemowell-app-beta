/**
 * v72-med-purpose.mjs — every medication says what it is for, and an edit cannot wipe it.
 *
 * Aaron, 2026-09-08: "I've asked before to have something pulled from another site to say what the
 * med is intended for... it wasn't webMD, it was something else that couldn't sue me for using
 * their stuff." It had never shipped, and the ask was not written down in this repo's REQUESTS.md
 * or BACKLOG.md, both of which have existed since app-v25.
 *
 * FOUR OF THESE CHECKS EXIST BECAUSE care-tracker GOT THEM WRONG FIRST, in the sibling release the
 * same day. Its Zero Day Audit blocked v74 twice, and every finding applies here because this is
 * the same feature in the same shape of code:
 *
 *   1. THE BUILT-IN LINE MUST BE A PLACEHOLDER, NEVER A SEEDED VALUE. care-tracker seeded the box
 *      with the resolved line, which made "deliberately blank" and "never set" the same state:
 *      clearing the box and saving did NOTHING while the app said "updated", so a line someone
 *      believed was wrong could be overwritten but never removed. And saving ANY edit froze that
 *      day's wording into the user's stored config, so a later correction would never reach a
 *      medication anyone had edited.
 *   2. THE LOOKUP MUST NOT BE A BARE OBJECT INDEX. MED_PURPOSE['constructor'] reads back
 *      Object.prototype.constructor -- a function, truthy, not a string -- and h() throws inside
 *      the list render. The medication PERSISTS, so every later render throws too and the Meds
 *      screen comes up with no cards at all, which is the only place edit and delete live. In
 *      care-tracker that needed an id slug to survive; HERE THE KEY IS THE NAME THE USER TYPED, so
 *      it is reachable by typing "Constructor" into the name box. Worse, and easier.
 *   3. NO LINE MAY STATE A DOSE OR A SCHEDULE. care-tracker's first guard only looked for digits,
 *      so "given around chemo" -- a schedule in words -- walked through it.
 *   4. THE SAVE PATH MUST BE ASSERTED FROM STORAGE, NOT FROM THE SCREEN. The built-in line covers
 *      for a value the save path drops, so a screen-only check stayed green on a build with the
 *      field missing from the saved object entirely.
 *
 * Run:  node test/v72-med-purpose.mjs [--file <index.html>]
 * Falsified against the app-v71 base and three hand-built mutants; numbers in the release notes.
 */
import http from 'node:http';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = (() => {
  const tries = ['playwright', '/opt/node22/lib/node_modules/playwright'];
  for (const c of tries) { try { return require(c); } catch (e) {} }
  throw new Error('playwright not found');
})();

const argv = process.argv.slice(2);
const APP_FILE = argv.indexOf('--file') >= 0 ? argv[argv.indexOf('--file') + 1]
                                             : new URL('../index.html', import.meta.url).pathname;
const rawHtml = fs.readFileSync(APP_FILE, 'utf8');
for (const v of ['HTTPS_PROXY','https_proxy','HTTP_PROXY','http_proxy'])
  if (process.env[v]) { console.error('REFUSING: ' + v + ' set.'); process.exit(3); }

let fail = 0, pass = 0;
const t = (name, cond, detail) => {
  console.log((cond ? 'PASS  ' : 'FAIL  ') + name + (detail ? '  |  ' + detail : ''));
  cond ? pass++ : fail++;
};

const P = 'chemowell-app-p-p1-';
const MED_KEY = P + 'med-v1';
const NOON = (() => { const d = new Date(); d.setHours(12, 0, 0, 0); return d.getTime(); })();

// The table is read OUT OF THE FILE UNDER TEST. A copy of the sentences here would drift from the
// app and prove nothing about it.
const tableMatch = rawHtml.match(/const MED_PURPOSE = \{([\s\S]*?)\n\};/);
const TABLE = {};
if (tableMatch) {
  for (const m of tableMatch[1].matchAll(/'([a-z0-9 -]+)':\s*'((?:[^'\\]|\\.)*)'/g)) TABLE[m[1]] = m[2];
}

// Two medications the app should recognise (one by brand, one by generic) and one it should not.
const SEED_MEDS = [
  { id: 'zofran', name: 'Zofran', sub: 'Ondansetron', type: 'gap', gapH: 8, doses: [{ label: '4 mg', mg: 4 }] },
  { id: 'pantoprazole', name: 'Pantoprazole', sub: '', type: 'gap', gapH: 24, doses: [{ label: '40 mg', mg: 40 }] },
  { id: 'madeupzz', name: 'Madeupzz', sub: '', type: 'gap', gapH: 6, doses: [{ label: '1 tab', mg: 0 }] }
];
const SEED_PREFS = { patientName: 'Test Patient', sex: 'female', treatmentType: 'chemo',
  tourDone: true, ceilingMg: 2500, tempUnit: 'Fahrenheit', weightUnit: 'lbs' };

const server = http.createServer((rq, rs) => {
  if (rq.url.startsWith('/index.html')) { rs.writeHead(200, { 'Content-Type': 'text/html' }); rs.end(rawHtml); return; }
  rs.writeHead(204); rs.end();
}).listen(0, '127.0.0.1');
await new Promise(r => server.once('listening', r));
const URL_ = 'http://127.0.0.1:' + server.address().port + '/index.html';

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
await ctx.route('**/*', route => {
  const u = route.request().url();
  if (u.startsWith('http://127.0.0.1:' + server.address().port)) return route.continue();
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
await page.goto(URL_, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1800);

const reached = await page.evaluate(() => document.querySelectorAll('button').length > 5);
t('the app got past first-run setup with the fixture seeded', reached);
if (!reached) { await browser.close(); server.close(); console.log('\nFAILED'); process.exit(1); }

const clickText = async (re) => page.evaluate(([src, flags]) => {
  const rx = new RegExp(src, flags);
  const b = [...document.querySelectorAll('button')].find(x => rx.test((x.innerText || '').trim()));
  if (b) { b.click(); return true; } return false;
}, [re.source, re.flags]);
const goMeds = async () => { await clickText(/^Meds$/); await page.waitForTimeout(800); };
const purposeMap = () => page.evaluate(() => {
  const out = {};
  document.querySelectorAll('[data-med-purpose]').forEach(el => { out[el.getAttribute('data-med-purpose')] = (el.innerText || '').trim(); });
  return out;
});
const storedPurpose = (id) => page.evaluate(([k, i]) => {
  try {
    const raw = JSON.parse(localStorage.getItem(k) || '{}');
    const m = (raw.meds || []).find(x => x.id === i);
    return m ? (m.purpose === undefined ? '<<missing>>' : String(m.purpose)) : '<<no med>>';
  } catch (e) { return '<<unreadable>>'; }
}, [MED_KEY, id]);

console.log('\n1. The table — what the app is willing to say about a medication');
{
  const ids = Object.keys(TABLE);
  t('the app carries a purpose table', ids.length > 0, ids.length + ' entries');
  t('no entry is blank', ids.every(k => TABLE[k].trim()), '');
  t('NO entry contains a number', !ids.some(k => /\d/.test(TABLE[k])),
    ids.filter(k => /\d/.test(TABLE[k])).join(', '));
  // A schedule written in WORDS passed care-tracker's digit-only guard. Dosage forms are allowed;
  // WHEN and HOW MUCH are not.
  const SCHEDULEY = /\b(daily|hourly|nightly|weekly|every \w+|twice|once a|per day|a day|as needed|when needed|at bedtime|before bed|before meals|after meals|with food|on an empty stomach|in the morning|in the evening|on chemo days|around chemo|with chemo|after chemo|before chemo|chemotherapy|dose|doses|mg|ml|mcg)\b/i;
  // NO FEVER CLAUSE, EVER. Removing them was this release's safety decision -- a fever during
  // treatment is a thing to REPORT, not to suppress -- and nothing was holding it. The patch header
  // says a later refresh to federal label wording is planned, and federal wording says "reduces
  // fever", so this guard is what stops that refresh quietly undoing the decision.
  const fevery = ids.filter(k => /fever|antipyretic|temperature/i.test(TABLE[k]));
  t('NO entry tells anyone a medication brings down a fever', fevery.length === 0,
    fevery.map(k => k + ': ' + TABLE[k]).join(' | '));
  // A LINE MUST DESCRIBE THE DRUG, NOT A PRODUCT. The audit blocked on lidocaine being called "a
  // numbing cream": in this app every medication is one the user typed, so the same name may be a
  // rinse for mouth sores or a patch, and a wrong line on the right medication is worse than none.
  const FORMY = /\b(cream|ointment|patch|gel|rinse|suppository|injection|infusion|syrup|lozenge|liquid|tablet|tablets|capsule|capsules|by mouth|topical|rub on|rubbed on|applied to|on the skin|under the tongue)\b/i;
  const formy = ids.filter(k => FORMY.test(TABLE[k]));
  t('NO entry names a dosage form, route or body site', formy.length === 0,
    formy.map(k => k + ': ' + TABLE[k]).join(' | '));
  const bad = ids.filter(k => SCHEDULEY.test(TABLE[k]));
  t('NO entry states a schedule or a dose in words either', bad.length === 0,
    bad.map(k => k + ': ' + TABLE[k]).join(' | '));
}

console.log('\n2. The Meds screen — recognised by brand, by generic, and not at all');
{
  await goMeds();
  const map = await purposeMap();
  t('a medication recognised by its BRAND name shows a line', !!map['zofran'], map['zofran'] || '(none)');
  t('a medication recognised by its GENERIC name shows a line', !!map['pantoprazole'], map['pantoprazole'] || '(none)');
  t('the line matches the table it came from', map['zofran'] === (TABLE['zofran'] || '<<no such entry>>'), map['zofran']);
  t('a medication nobody recognises shows NO line at all rather than an empty one',
    map['madeupzz'] === undefined, JSON.stringify(map['madeupzz']));
  const disc = await page.evaluate(() => document.querySelectorAll('[data-med-disclaimer]').length);
  t('the "general information, not medical advice" line appears exactly once', disc === 1, disc + ' found');
  // ...and NOT AT ALL when no medication carries a line. This app has no default medication list and
  // the table is supportive-care drugs, so a list where nothing is recognised is a common state --
  // the audit measured the notice printing above a list with no lines under it.
  await page.evaluate((k) => {
    const raw = JSON.parse(localStorage.getItem(k) || '{}');
    raw.meds = [{ id: 'unknownzz', name: 'Zzunknownium', sub: '', type: 'gap', gapH: 6, doses: [{ label: '1 tab', mg: 0 }] }];
    localStorage.setItem(k, JSON.stringify(raw));
  }, MED_KEY);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);
  await goMeds();
  const discNone = await page.evaluate(() => document.querySelectorAll('[data-med-disclaimer]').length);
  const linesNone = await page.evaluate(() => document.querySelectorAll('[data-med-purpose]').length);
  t('with NO medication recognised, there are no lines and no disclaimer either',
    linesNone === 0 && discNone === 0, 'lines=' + linesNone + ' disclaimer=' + discNone);
  // restore the fixture for the sections that follow
  await page.evaluate(([k, meds]) => {
    const raw = JSON.parse(localStorage.getItem(k) || '{}');
    raw.meds = meds; localStorage.setItem(k, JSON.stringify(raw));
  }, [MED_KEY, SEED_MEDS]);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);
  await goMeds();
}

console.log('\n3. THE EXEMPTION, ASSERTED: Home stays clean');
{
  await clickText(/^Home$/);
  await page.waitForTimeout(800);
  const onHome = await page.evaluate(() => document.querySelectorAll('[data-med-purpose]').length);
  t('the Home quick-log cards carry NO purpose text', onHome === 0, onHome + ' found on Home');
}

console.log('\n4. The box is a PLACEHOLDER, and an edit stores nothing (care-tracker\'s blocked build)');
{
  await goMeds();
  const opened = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => /^Edit Zofran$/i.test(x.getAttribute('aria-label') || ''));
    if (b) { b.click(); return true; } return false;
  });
  t('the Zofran editor opens', opened, '');
  await page.waitForTimeout(600);
  const box = await page.evaluate(() => {
    const lab = [...document.querySelectorAll('label')].find(l => /what it/i.test(l.innerText || ''));
    const inp = lab && lab.querySelector('input, textarea');
    return inp ? { value: inp.value, placeholder: inp.placeholder } : null;
  });
  t('the box is EMPTY for a medication nobody has described', box && box.value === '', JSON.stringify(box && box.value));
  t('the built-in sentence shows as the PLACEHOLDER instead',
    !!(box && box.placeholder === (TABLE['zofran'] || '<<no such entry>>')), JSON.stringify(box && box.placeholder));
  await clickText(/^Save changes$/);
  await page.waitForTimeout(900);
  const stored = await storedPurpose('zofran');
  t('saving an untouched medication stores NOTHING — the wording is never frozen into the record',
    stored === '' || stored === '<<missing>>', stored);
  const after = (await purposeMap())['zofran'] || '';
  t('and the line is still on screen afterwards', after === (TABLE['zofran'] || '<<no such entry>>'), after);
}

console.log('\n5. What the user types wins, and clearing it gives the built-in line back');
{
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => /^Edit Zofran$/i.test(x.getAttribute('aria-label') || ''));
    if (b) b.click();
  });
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    const lab = [...document.querySelectorAll('label')].find(l => /what it/i.test(l.innerText || ''));
    const inp = lab && lab.querySelector('input, textarea');
    if (inp) { inp.value = 'My oncologist prescribed this for sickness'; inp.dispatchEvent(new Event('input', { bubbles: true })); }
  });
  await clickText(/^Save changes$/);
  await page.waitForTimeout(900);
  t('the typed line replaces the built-in one on screen',
    (await purposeMap())['zofran'] === 'My oncologist prescribed this for sickness', (await purposeMap())['zofran']);
  // ASSERTED FROM STORAGE, not the screen: the built-in line covers for a save path that drops the
  // field, which is how a screen-only check stayed green on a broken build in care-tracker.
  t('and it really was saved', (await storedPurpose('zofran')) === 'My oncologist prescribed this for sickness',
    await storedPurpose('zofran'));
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => /^Edit Zofran$/i.test(x.getAttribute('aria-label') || ''));
    if (b) b.click();
  });
  await page.waitForTimeout(600);
  const held = await page.evaluate(() => {
    const lab = [...document.querySelectorAll('label')].find(l => /what it/i.test(l.innerText || ''));
    const inp = lab && lab.querySelector('input, textarea');
    return inp ? inp.value : null;
  });
  t('the box holds the typed line when there is one', held === 'My oncologist prescribed this for sickness', JSON.stringify(held));
  await page.evaluate(() => {
    const lab = [...document.querySelectorAll('label')].find(l => /what it/i.test(l.innerText || ''));
    const inp = lab && lab.querySelector('input, textarea');
    if (inp) { inp.value = ''; inp.dispatchEvent(new Event('input', { bubbles: true })); }
  });
  await clickText(/^Save changes$/);
  await page.waitForTimeout(900);
  const cleared = (await purposeMap())['zofran'] || '';
  t('clearing the box returns to the built-in line rather than doing nothing',
    cleared === (TABLE['zofran'] || '<<no such entry>>'), cleared);
}

console.log('\n6. A medication named after a JavaScript built-in must not destroy the Meds screen');
{
  // WRITTEN STRAIGHT INTO STORAGE, not typed through the add form. The first version of this section
  // drove the form, and the form needs more than a name, so nothing was ever added -- the section
  // passed 24/24 against the bare-index build it exists to catch. Storage is also the truer test:
  // the danger is not the moment of adding, it is that the medication PERSISTS and every render
  // afterwards throws, so the Meds screen -- the only place edit and delete live -- comes up empty
  // forever with no way back from inside the app.
  const errsBefore = pageErrors.length;
  await page.evaluate(([k, name]) => {
    const raw = JSON.parse(localStorage.getItem(k) || '{}');
    raw.meds = (raw.meds || []).concat([{ id: 'ctor1', name: name, sub: '', type: 'gap', gapH: 6, doses: [{ label: '1 tab', mg: 0 }] }]);
    localStorage.setItem(k, JSON.stringify(raw));
  }, [MED_KEY, 'Constructor']);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);
  await goMeds();
  const rows = await page.evaluate(() =>
    [...document.querySelectorAll('button')].filter(b => /^Edit /i.test(b.getAttribute('aria-label') || '')).length);
  t('the Meds screen still lists every medication with a "Constructor" in the list', rows >= 4, rows + ' editable rows');
  t('rendering it raises no page error', pageErrors.length === errsBefore,
    pageErrors.slice(errsBefore).join(' | ').slice(0, 200));
  const map = await purposeMap();
  t('and it shows NO purpose line, rather than a function or the word Object',
    map['ctor1'] === undefined, JSON.stringify(map['ctor1']));
}

console.log('\n-- nothing broke on the way');
t('no page errors', pageErrors.length === 0, pageErrors.join(' | ').slice(0, 300));

await browser.close(); server.close();
console.log('\n' + pass + '/' + (pass + fail) + ' checks passed' + (fail ? '  <-- FAIL' : ''));
process.exit(fail ? 1 : 0);
