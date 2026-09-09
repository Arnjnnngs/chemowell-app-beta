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
// THE PARSER IS A GUARD TOO, AND PASS 5 FOUND IT WAS THE HOLE IN ALL THE OTHERS.
// It matched only a SINGLE-quoted value with an all-lowercase key. One entry written with DOUBLE
// quotes -- the natural thing to reach for the moment a sentence contains an apostrophe, in a table
// made of prose about medicines -- was invisible to every check in this file at once. The suite
// printed "42 entries" for a 43-entry table and a FULL GREEN BOARD (fever guard, number guard,
// form/route guard, schedule guard and all four liveness lines) while the app rendered "brings down
// a fever ... one tablet under the tongue every 4 hours" under that medication on the patient's Meds
// screen. No typo was needed, and the only assertion on the parse was that it found more than zero.
// It reads both quote styles now, AND the count is asserted against the number of lines that look
// like entries, because the next thing this parser cannot read will not be a quote style.
const tableMatch = rawHtml.match(/const MED_PURPOSE = \{([\s\S]*?)\n\};/);
const TABLE = {};
const unreadable = [];
// ONE SOURCE STRING FOR BOTH HALVES. Pass 6 replaced a count with an accounting check, and pass 7
// got past it with `'morphine' : '...'` -- ONE SPACE before the colon, which the accounting regex
// accepted and the parser could not read: a full green board over "Brings down a fever. Take 15 mg
// by mouth every 4 hours as needed." Two patterns written by hand to agree with each other will not
// agree. The pair below is built from PAIR_SRC, so a line the accounting accepts is BY CONSTRUCTION
// a line the parser reads, and no future edit can drift one out of step with the other.
const PAIR_SRC = "'([^'\\n]+)':\\s*(?:'((?:[^'\\\\]|\\\\.)*)'|\"((?:[^\"\\\\]|\\\\.)*)\")";
const PAIR_RE = new RegExp(PAIR_SRC, 'g');
// a trailing // comment after a real entry, and a /* */ line, were two false REDs in the first
// version -- and a check that goes red on something correct teaches people to stop reading it.
const ENTRY_LINE = new RegExp('^\\s*' + PAIR_SRC + '\\s*,?\\s*(?:\\/\\/.*)?$');
if (tableMatch) {
  for (const m of tableMatch[1].matchAll(PAIR_RE))
    TABLE[m[1]] = m[2] !== undefined ? m[2] : m[3];
  for (const line of tableMatch[1].split('\n')) {
    const l = line.trim();
    if (!l || l.startsWith('//') || l.startsWith('/*') || l.startsWith('*')) continue;
    if (!ENTRY_LINE.test(line)) unreadable.push(l.slice(0, 70));
  }
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
  // THE CHECK THAT CLOSES THE HOLE. Every guard below reads TABLE, so an entry the parser cannot
  // see is an entry every one of them passes in silence. This compares what was parsed against what
  // LOOKS like an entry in the source, so an unreadable line is a red check rather than an absent one.
  t('EVERY line in the table is one this suite can read', unreadable.length === 0,
    unreadable.join(' | '));
  // The app lowercases its lookup key, so an entry keyed with a capital could never be found at
  // runtime. That used to be enforced by accident, by a parser that could not see such a key --
  // which is the worst way to enforce anything, since the accident was the bug above.
  const shouty = ids.filter(k => k !== k.toLowerCase());
  t('every key is lowercase, so the app can actually find it', shouty.length === 0, shouty.join(', '));
  t('no entry is blank', ids.every(k => TABLE[k].trim()), '');
  const NUMBERY = /\d/;
  t('NO entry contains a number', !ids.some(k => NUMBERY.test(TABLE[k])),
    ids.filter(k => NUMBERY.test(TABLE[k])).join(', '));
  // A schedule written in WORDS passed care-tracker's digit-only guard. WHEN and HOW MUCH are
  // never allowed here, and neither is a dosage form -- see the guard below.
  const SCHEDULEY = /\b(daily|hourly|nightly|weekly|every \w+|twice|once a|per day|a day|as needed|when needed|at bedtime|before bed|before meals|after meals|with food|on an empty stomach|in the morning|in the evening|on chemo days|around chemo|with chemo|after chemo|before chemo|chemotherapy|dose|doses|mg|ml|mcg)\b/i;
  // NO FEVER CLAUSE, EVER. Removing them was this release's safety decision -- a fever during
  // treatment is a thing to REPORT, not to suppress -- and nothing was holding it. The patch header
  // says a later refresh to federal label wording is planned, and federal wording says "reduces
  // fever", so this guard is what stops that refresh quietly undoing the decision.
  const FEVERY = /fever|antipyretic|temperature/i;
  const fevery = ids.filter(k => FEVERY.test(TABLE[k]));
  t('NO entry tells anyone a medication brings down a fever', fevery.length === 0,
    fevery.map(k => k + ': ' + TABLE[k]).join(' | '));
  // A LINE DESCRIBES THE DRUG. IT NEVER SAYS WHAT THE THING LOOKS LIKE OR WHERE TO PUT IT.
  // Three audit passes went at this one check and the list was too short every time:
  //   pass 1 blocked  "a numbing CREAM ... ON THE SKIN"          -> cream, on the skin added
  //   pass 2 blocked  "This is Tylenol in LIQUID form"           -> liquid, tablet, capsule added,
  //                   and the check written for that exact case had reported PASS on it
  //   pass 3 broke it with "a PILL you SWALLOW", "as a SHOT under the skin", "through a DRIP",
  //                   "Numbs the SKIN", "under your TONGUE", "RUB onto", "APPLIED where it hurts"
  //                   -- eight sentences, every one green.
  // THE LESSON, WRITTEN DOWN SO A FOURTH PASS DOES NOT HAVE TO FIND IT AGAIN. A list of words can
  // never enforce "names no dosage form", so this check no longer CLAIMS to. It is named for exactly
  // what it does: it rejects a word from the list. A check that prints a false sentence in green is
  // worse than no check -- the app-v70 ruling, on this same class.
  // THE LIST BANS FORM AND ROUTE, NOT ANATOMY -- and pass 4 caught this sentence being FALSE of the
  // code beside it, for the third time on this one check. The list held bare `skin`, `tongue`, `vein`
  // and `rectal`, so "Eases itching and swelling of the skin" was rejected while "Settles the
  // stomach" was not. Skin drugs are a large part of supportive care: that would have bitten a real
  // entry, and the next person to edit this table was being told the opposite in the comment AND in
  // the shipped release note. The bare anatomy words are gone. The ROUTE PHRASES that contain them
  // stay -- "on the skin" is where you put it, "of the skin" is what it acts on -- and so do the
  // plurals, the inflections and IV, all of which walked through the previous list.
  // "Numbs the skin" now PASSES, deliberately. It says what the drug does. Whether it is TRUE of a
  // particular medication is a question for a reader, and no list of words was ever going to answer it.
  // TWO WORDS ARE LEFT OUT ON PURPOSE, SAID OUT LOUD because an exemption nobody wrote down is
  // indistinguishable from an oversight. `oral` would reject "Treats oral thrush", a condition
  // rather than a route, and nystatin is a supportive-care drug this table may well gain.
  // `dissolve` would reject "Dissolves clots", which is what a drug does rather than how it is
  // taken. Both mean this list lets "An oral steroid" and "Dissolves on the tongue" through --
  // "under the tongue" is caught, "on the tongue" is not. That is the accepted cost of a list
  // that must not reject true descriptions, and it is why the reader, not the list, is the gate.
  const FORMY = /\b(pills?|tablets?|capsules?|caplets?|troches?|lozenges?|liquids?|syrups?|elixirs?|powders?|sachets?|patches|patch|creams?|ointments?|gels?|lotions?|rinses?|mouthwash|gargle|suppositor(?:y|ies)|enemas?|sprays?|sprayed|inhalers?|inhaled|nebuli[sz]ed|injections?|injected|inject|shots?|infusions?|infused|drips?|intravenous(?:ly)?|iv|subcutaneous(?:ly)?|intramuscular(?:ly)?|sublingual(?:ly)?|transdermal|intranasal|swallow(?:ed)?|chew(?:able)?|topical(?:ly)?|orally|by mouth|rub|rubs|rubbed|applied|apply|smear|dab|rectally|on the skin|onto the skin|into the skin|under the skin|under the tongue|under your tongue|into a vein|through a vein|into a muscle|in a drip|through a drip)\b/i;
  const formy = ids.filter(k => FORMY.test(TABLE[k]));
  t('NO entry uses a word from the dosage-form / route list', formy.length === 0,
    formy.map(k => k + ': ' + TABLE[k]).join(' | '));
  const bad = ids.filter(k => SCHEDULEY.test(TABLE[k]));
  t('NO entry states a schedule or a dose in words either', bad.length === 0,
    bad.map(k => k + ': ' + TABLE[k]).join(' | '));

  // ---- CAN THESE CHECKS FIRE AT ALL? -----------------------------------------------------------
  // The beta's copy of the form guard was written with a DOUBLED backslash, so the pattern looked
  // for a literal backslash and could never match anything. It sat green for weeks over the exact
  // sentence the first audit had blocked, in a suite that ran on every release.
  // A guard nobody can prove fires is not a guard. Each one is now handed a sentence it MUST reject,
  // so a typo that kills the pattern turns this red instead of turning the whole table green.
  // AND EACH CHECK MUST TOUCH THE GUARD IT VOUCHES FOR. The first version of this block re-typed two
  // of the four patterns instead of naming them, so the fever guard could be killed with the very
  // typo this block exists to catch and the suite stayed 34/34 GREEN -- with an entry reading "Eases
  // pain and brings down a fever" and the line "the fever guard can actually fire" printed in green
  // above it. A copy of a pattern proves nothing about the original. All four are constants now.
  t('the form/route guard can actually fire', FORMY.test('A numbing cream you rub on the skin.'), '');
  t('the schedule guard can actually fire', SCHEDULEY.test('Take one at bedtime as needed.'), '');
  t('the fever guard can actually fire', FEVERY.test('Brings down a fever.'), '');
  t('the number guard can actually fire', NUMBERY.test('Eases pain for 4 hours.'), '');
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

console.log('\nTyped text — it survives a reload, and nothing a caregiver pastes scrolls the page sideways');
{
  // PASS 4 BROKE THE FIRST VERSION OF THIS CHECK, AND THE WAY IT BROKE IT IS THE LESSON.
  // It compared document.scrollWidth to window.innerWidth -- and under this suite's mobile emulation
  // innerWidth GROWS to swallow the overflow, so the ruler stretched with the thing being measured.
  // A pasted no-space pharmacy name (447px), a pasted portal link (413px) and a long generic name
  // (413px) every one scrolled sideways at a 320px viewport, and the check said PASS on all three.
  // It caught the 300-character mutant only because that finally exceeded the emulator's clamp.
  // THE RULER IS NOW THE WIDTH THIS TEST ITSELF SET, passed in from Node and never read back out of
  // the page, and the cases are what a caregiver actually pastes rather than one absurd one.
  // EVERY ONE OF THESE FOUR STRINGS WAS LENGTHENED UNTIL IT COULD ACTUALLY FAIL. The first draft
  // used a 48-character pharmacy name and a 71-character link, and BOTH stayed green on a build
  // with the wrapping rule deleted -- they simply fit. Two of the four cases could not fail, in a
  // suite added because a check that could not fail sat green for weeks.
  // ONE RULE, ON THE WHOLE CARD. The previous version put it on the card's text COLUMN and left a
  // second copy on the purpose line, and claimed the two were proved non-redundant -- which the
  // audit disproved in one run, because overflow-wrap is INHERITED and the line's copy did nothing.
  // Worse, the note and the dose summary render in a DIFFERENT container from that column, so a
  // pasted pharmacy name in the note measured 668px at a 320px viewport while all four cases here
  // stayed green. The rule is on the article now, so every string the card renders is inside it --
  // which is why one of the cases below pastes into the note.
  const VW = 320;
  const LONG = 'Prescribed' + 'x'.repeat(300) + 'end';
  const setField = (labelRe, v) => page.evaluate(([lr, val]) => {
    const rx = new RegExp(lr, 'i');
    const lab = [...document.querySelectorAll('label')].find(l => rx.test(l.innerText || ''));
    const inp = lab && lab.querySelector('input, textarea');
    if (!inp) return false;
    inp.value = val; inp.dispatchEvent(new Event('input', { bubbles: true })); return true;
  }, [labelRe, v]);
  const openZofran = () => page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => /^Edit Zofran$/i.test(x.getAttribute('aria-label') || ''));
    if (b) { b.click(); return true; } return false;
  });
  const pageWidthAt = async (w) => {
    await page.setViewportSize({ width: w, height: 800 });
    await page.waitForTimeout(400);
    const doc = await page.evaluate(() => document.documentElement.scrollWidth);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(250);
    return doc;
  };

  await goMeds();
  const CASES = [
    ['what it', 'a pasted pharmacy name with no spaces', 'ONDANSETRONHYDROCHLORIDEDIHYDRATEORALLYDISINTEGRATINGTABLETEIGHTMILLIGRAMFILMCOATED'],
    ['what it', 'a link pasted from the hospital portal', 'https://mychart.example-hospital.org/inside/visit/summary/medications/2026-09-08/detail?ref=printout'],
    ['generic name', 'a very long generic name', 'ONDANSETRONHYDROCHLORIDEDIHYDRATEORALLYDISINTEGRATINGTABLETEIGHTMILLIGRAMFILMCOATED'],
    ['note', 'a pasted pharmacy name in the note field', 'ONDANSETRONHYDROCHLORIDEDIHYDRATEORALLYDISINTEGRATINGTABLETEIGHTMILLIGRAMFILMCOATED'],
    ['what it', 'three hundred characters with no break in them', LONG],
  ];
  // EACH CASE PUTS THE FIELD BACK BEFORE THE NEXT ONE RUNS. The first draft did not, so the long
  // GENERIC NAME from one case was still on the card during the next, and that case went red for a
  // reason that had nothing to do with what it was testing. A check that fails for the wrong reason
  // is no better evidence than one that passes for the wrong reason.
  const SAFE = { 'generic name': 'Ondansetron', 'what it': '', 'note': '' };
  for (const [field, what, value] of CASES) {
    await openZofran();
    await page.waitForTimeout(500);
    const ok = await setField(field, value);
    await clickText(/^Save changes$/);
    await page.waitForTimeout(700);
    const doc = await pageWidthAt(VW);
    t('the page does not scroll sideways at ' + VW + 'px: ' + what,
      ok && doc <= VW + 1, 'field=' + (ok ? 'set' : 'MISSING') + ' page=' + doc + 'px');
    await openZofran();
    await page.waitForTimeout(400);
    await setField(field, SAFE[field]);
    await clickText(/^Save changes$/);
    await page.waitForTimeout(600);
  }
  // PASS 6 FOUND THE SCREEN NONE OF THE ABOVE EVER VISITS. Every case so far measures the Meds
  // screen, under a heading that promises "nothing a caregiver pastes scrolls the page sideways".
  // Paste a long pharmacy name into a medication's NAME and HOME reached 1019px on a 320px phone --
  // and the bottom tab bar stretched with it, so the Meds tab you would use to go back and fix the
  // name was no longer on the screen. The paste that causes the problem moves the only route to the
  // fix out of reach, which is what makes this one worth a release rather than a note.
  // PASS 7: THE FIRST VERSION OF THIS CASE NEVER REACHED HOME. It clicked a tab called "Today"; the
  // tab is labelled "Home", so the click returned false and every measurement below was taken on the
  // Meds screen. On a build where Home measured 900px with the nav stretched to match -- the block
  // above, unfixed -- it printed PASS. It was green because the fix happened to work, not because
  // anything looked. So each step is asserted now: the navigation, the nav bar (the nav is what
  // carried the Meds tab off the screen), and the restore, whose silent failure used to surface
  // later as a misleading persistence failure on a different check.
  {
    const BIGNAME = 'ONDANSETRONHYDROCHLORIDEDIHYDRATEORALLYDISINTEGRATINGTABLETEIGHTMILLIGRAM';
    const openBy = (label) => page.evaluate((l) => {
      const b = [...document.querySelectorAll('button')].find(x => (x.getAttribute('aria-label') || '') === 'Edit ' + l);
      if (b) { b.click(); return true; } return false;
    }, label);
    // EVERY MEDICATION ONTO HOME FIRST. Pass 8: in one of these apps the seeded medications save
    // with quickLog false, so the pasted name never rendered on Home and this case measured an EMPTY
    // screen -- it printed PASS on a build whose Home measured 900px at a 320px viewport.
    await page.evaluate((k) => {
      try {
        const raw = JSON.parse(localStorage.getItem(k) || '{}');
        if (raw && Array.isArray(raw.meds)) {
          raw.meds.forEach(m => { m.quickLog = true; });
          localStorage.setItem(k, JSON.stringify(raw));
        }
      } catch (e) {}
    }, MED_KEY);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await goMeds();
    await openBy('Zofran');
    await page.waitForTimeout(500);
    const named = await setField('medication name', BIGNAME);
    await clickText(/^Save changes$/);
    await page.waitForTimeout(800);
    // BY aria-label FIRST, then by text. care-tracker's tab reads 'Home' as its label;
    // ChemoWell's carries the word in an aria-label with an icon beside it. A selector that
    // works in one app and silently returns false in the other is how the first version of
    // this case measured the wrong screen and printed PASS.
    const wentHome = await page.evaluate(() => {
      const bs = [...document.querySelectorAll('button')];
      const b = bs.find(x => (x.getAttribute('aria-label') || '') === 'Home')
        || bs.find(x => (x.innerText || '').trim() === 'Home');
      if (b) { b.click(); return true; } return false;
    });
    await page.waitForTimeout(900);
    t('the Home case actually reaches Home', wentHome, '');
    await page.setViewportSize({ width: VW, height: 800 });
    await page.waitForTimeout(500);
    // THE RULER IS VW, THE WIDTH THIS TEST SET -- never window.innerWidth. Pass 8 found innerWidth
    // reported 900 on a 320px viewport, so the tab check said 5 of 5 tabs were reachable when 1 was.
    // That is the pass-4 stretching-ruler defect, reintroduced in the assertion written to close
    // pass 7, with VW in scope three lines above it and unused.
    // `onHome` is the other half: a check that cannot SEE the thing it measures is not measuring it.
    // innerText, not textContent -- in a single-file app textContent contains the source.
    const home = await page.evaluate(([vw, big]) => ({
      doc: document.documentElement.scrollWidth,
      nav: (document.querySelector('nav') || { scrollWidth: -1 }).scrollWidth,
      onScreen: [...document.querySelectorAll('nav button')].filter(b => b.getBoundingClientRect().right <= vw + 1).length,
      tabs: document.querySelectorAll('nav button').length,
      // BOTH HALVES. The name being on screen proves the app rendered it; the Home TAB carrying
      // aria-current=page proves the screen being measured is Home. (An earlier draft used a
      // data-tour marker that exists in one app and not the other -- the same portability trap
      // that made the first version of this case click a tab called 'Today'.) The audit built the mutant that beats the first alone -- make
      // the Home tab a no-op on top of a broken Home and both lines print PASS at 320px, because
      // the measurement is then taken on Meds, where the name also appears.
      onHome: ((document.getElementById('root') || {}).innerText || '').includes(big)
        && [...document.querySelectorAll('nav button')].some(b =>
             (b.getAttribute('aria-label') || '').trim() === 'Home' && b.getAttribute('aria-current') === 'page')
    }), [VW, BIGNAME]);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    t('the pasted name is actually ON the Home screen being measured', wentHome && home.onHome, '');
    t('HOME does not scroll sideways at ' + VW + 'px with a pasted medication name',
      wentHome && named && home.onHome && home.doc <= VW + 1, 'page=' + home.doc + 'px');
    t('every bottom tab is still on the screen at ' + VW + 'px',
      wentHome && home.onHome && home.tabs > 0 && home.onScreen === home.tabs,
      home.onScreen + ' of ' + home.tabs + ' tabs reachable, nav=' + home.nav + 'px');
    // put the name back, or every later section is looking at a card it does not recognise
    await goMeds();
    const reopened = await openBy(BIGNAME);
    await page.waitForTimeout(400);
    await setField('medication name', 'Zofran');
    await clickText(/^Save changes$/);
    await page.waitForTimeout(700);
    const restored = await page.evaluate(() =>
      [...document.querySelectorAll('button')].some(b => (b.getAttribute('aria-label') || '') === 'Edit Zofran'));
    t('the medication name is put back before anything else runs', reopened && restored, '');
  }

  await openZofran(); await page.waitForTimeout(400);
  await setField('what it', LONG);
  await clickText(/^Save changes$/);
  await page.waitForTimeout(700);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await goMeds();
  const back = (await purposeMap())['zofran'] || '';
  t('the typed line is still there after closing and reopening the app', back === LONG,
    back.slice(0, 24) + ' (' + back.length + ' chars)');
}

// ---- THE THREE WRAPPING DECLARATIONS, CHECKED IN THE SOURCE --------------------------------------
// Two of the three are proved by behaviour above: remove the medication card's and the pasted-text
// cases go red; remove the Home quick-log grid's and both Home lines go red with the true number.
// THE THIRD IS NOT, and the audit measured why: the fixture never renders a GROUPED medications card,
// so deleting that declaration leaves the whole board green. It is not decorative -- with a
// 73-character name that element measures 872px inside a 175px box with `overflow: hidden` above it,
// so about eighty per cent of the medication name becomes invisible and unreachable. The page width
// never moves, which is exactly why every width check on this board stays green.
// A presence check is weak evidence and this file says so elsewhere. It is here because the
// alternative is NO evidence, the behaviour is proven on the two sibling elements, and the real fix
// -- a fixture that renders a grouped card -- is queued as its own change rather than bolted onto a
// release that has already been audited.
{
  const decls = [
    ['the medication card on Meds', /return h\('article', \{ style: \{[^\n]*overflowWrap: 'anywhere'/],
    ['the quick-log cards on Home', /minmax\(260px,1fr\)\)'[^\n]*overflowWrap: 'anywhere'/],
    ['the grouped-medications card', /h\('section', \{ style: \{ overflowWrap: 'anywhere' \} \}/]
  ];
  for (const [what, re] of decls)
    t('the wrapping rule is still on ' + what, re.test(rawHtml), '');
}

console.log('\n-- nothing broke on the way');
t('no page errors', pageErrors.length === 0, pageErrors.join(' | ').slice(0, 300));

await browser.close(); server.close();
console.log('\n' + pass + '/' + (pass + fail) + ' checks passed' + (fail ? '  <-- FAIL' : ''));
process.exit(fail ? 1 : 0);
