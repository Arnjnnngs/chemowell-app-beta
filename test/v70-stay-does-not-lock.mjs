// EVERY LIVE SENTENCE ABOUT A HOSPITAL STAY IS ON AN ALLOW-LIST, AND A NEW ONE FAILS UNTIL SOMEBODY
// LOOKS AT IT.
//
// WHY THIS FILE EXISTS. app-v67 changed the rule: a stay no longer blocks logging, it only stops
// dose windows that opened during the stay from being counted as misses. app-v70 set out to delete
// the leftover prose that still said otherwise, claimed three places were fixed, and shipped with
// FIVE -- the worst of them not in Help at all but on the In-Patient screen itself, under the
// "Active" chip, contradicting the Home banner, the FAQ, the tour and its own help icon in one build.
//
// WHY IT LOOKS LIKE THIS, which is the part worth keeping. The first version of this gate was a
// BLACKLIST: a family of phrasings that mean "logging is locked". The Zero Day Auditor got four
// false claims past it in one sitting -- "logging is SUSPENDED", "you CAN'T LOG medications",
// "every DOSE BUTTON is locked" (which never says the word logging at all), and the verbatim
// pre-fix sentence joined by an em-dash to a clause containing "was", which the past-tense
// exemption then released. The exemption had by then been holed three separate ways, which is the
// signal that the SHAPE was wrong, not the radius.
//
// The blacklist was a family of phrasings of THE SENTENCES ALREADY FIXED -- the exact mistake this
// release was opened to correct, rebuilt one level up. English has unlimited ways to say "you
// cannot log"; it has a countable number of sentences that actually appear in this file. So the
// list is inverted. Every live sentence that mentions a stay AND mentions logging, doses,
// medications, cards, buttons or missed-dose tracking must appear below, verbatim. Rewording one,
// or adding a new one, fails this suite until a person reads it and puts it here on purpose.
// That is the point: the failure is "nobody has checked this sentence", not "this sentence matched
// a bad pattern".
//
// Assert on the SOURCE, never on document.body.textContent: in a single-file app that includes the
// app's own source code, so a string check there matches itself and always passes.
//
// Run: env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy node test/v70-stay-does-not-lock.mjs
//      --file <path>   to point at a scratch copy during falsification
import fs from 'node:fs';
import http from 'node:http';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
// Same candidate list as the other browser suites here: a pinned playwright path made every browser
// suite in these repos unrunnable the last time the environment moved, and a gate that cannot start
// is indistinguishable from a gate that passes.
const { chromium } = (() => {
  const _p = require('node:path');
  const tries = ['playwright',
    _p.join(_p.dirname(process.execPath), '..', 'lib', 'node_modules', 'playwright'),
    '/opt/node22/lib/node_modules/playwright',
    '/home/claude/.npm-global/lib/node_modules/playwright'];
  for (const c of tries) { try { return require(c); } catch (e) {} }
  throw new Error('playwright not found; tried:\n  ' + tries.join('\n  '));
})();

const argv = process.argv.slice(2);
const FILE = argv.indexOf('--file') >= 0 ? argv[argv.indexOf('--file') + 1]
                                         : new URL('../index.html', import.meta.url).pathname;
const src = fs.readFileSync(FILE, 'utf8');
// Whole-line comments removed: index.html records WHY the old wording went, and this file quotes it
// too. A gate that fires on its own history is a gate somebody deletes. Only leading-// lines are
// dropped, never a trailing //, which would cut a URL in half.
const code = src.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');

let fail = 0;
const t = (name, cond, detail) => {
  console.log((cond ? 'PASS  ' : 'FAIL  ') + name + (detail ? '\n        ' + detail : ''));
  if (!cond) fail++;
};

// ---------------------------------------------------------------------------------------------
// 1. A CHEAP SOURCE-LEVEL SMOKE CHECK -- NOT the ground truth. The ground truth is section 3, in a
// real browser, and it is there because two source-shaped versions of this check both failed.
//
//   Version 1 counted occurrences of `inpatientCoversMoment(`. The auditor put a real lock at the
//   top of logMed() using a DIFFERENT helper. Green.
//   Version 2 read the bodies of logMed() and confirmTimeAndLog() and required that neither mention
//   any in-patient predicate. The auditor got past it twice in one sitting: once by putting the
//   lock in `status()` -- which logMed() calls on its second line and obeys, and which is exactly
//   where the pre-v67 "Restricted" behaviour actually lived -- and once by inlining the stay lookup
//   inside logMed() itself using only string literals, so no call expression matched the pattern.
//   Both times every suite in the repo stayed green, including the three v67 suites that exist
//   BECAUSE of this behaviour.
//
// The lesson is not "widen the pattern". It is that you cannot enumerate the places a guard is
// forbidden to live. Assert what the app DOES, not where its code is. The checks below are kept
// only because they cost nothing and name an obvious regression early.
function fnBody(name) {
  let i = code.indexOf('async function ' + name + '(');
  if (i < 0) i = code.indexOf('function ' + name + '(');
  if (i < 0) return null;
  const from = code.indexOf('{', code.indexOf(')', i));
  let d = 0;
  for (let k = from; k < code.length; k++) {
    if (code[k] === '{') d++;
    else if (code[k] === '}') { d--; if (d === 0) return code.slice(from, k + 1); }
  }
  return null;
}
for (const name of ['logMed', 'confirmTimeAndLog', 'status']) {
  const body = fnBody(name);
  t('the function ' + name + '() was found', !!body, body ? body.length + ' chars' : 'MISSING');
  if (!body) continue;
  const refs = [...new Set([...body.matchAll(/\w*[Ii]n[Pp]atient\w*/g)].map(m => m[0]))];
  t(name + '() does not mention a hospital stay (smoke check only — see section 3)',
    refs.length === 0, refs.join(', '));
}

// ---------------------------------------------------------------------------------------------
// 2. THE ALLOW-LIST.
// Scope: a sentence that mentions a stay AND mentions logging/doses/medications/cards/buttons/
// tracking. Code-shaped fragments are excluded so an unrelated styling edit cannot churn the list.
// Boundaries include the em-dash and the semicolon, because the auditor's worst escape was a false
// claim joined by a dash to a clause that made it look historical.
// `admit|admission|ward|discharge` are here because the auditor wrote a false claim that used none
// of the other words: "Medication logging is paused while she is ADMITTED; the WARD gives the doses,
// not you." A caregiver can describe a hospital stay without ever writing "stay" or "hospital", and a
// sentence outside the scope is a sentence nobody is ever asked to review.
const SCOPE = /in-?patient|hospital|admit|admission|\bward\b|discharge|\b(?:a|the|this|each|every|past|active|open|one) stays?\b|\bstays? (?:is|was|begins|ends|are|active|running)\b/i;
const NARROW = /\blog|\bdose|\bmedication|\bmeds?\b|button|card|track|miss|restrict|lock|pause|block|available/i;

const BOUND = /[.?!";\n]|\\u2014|—/;

function sentenceAt(text, at) {
  let start = 0;
  const b = new RegExp(BOUND.source, 'g');
  let m;
  while ((m = b.exec(text.slice(0, at))) !== null) start = m.index + m[0].length;
  const rest = text.slice(at);
  const e = rest.search(BOUND);
  return text.slice(start, e < 0 ? text.length : at + e).replace(/\s+/g, ' ').trim();
}

// Generated from the reviewed file and then read by a person. If you are adding to this list,
// the question to answer is not "does it compile" but "is this sentence TRUE of what the code does".
const ALLOWED = new Set([
  "How does In-Patient tracking work",
  "Tap Log In-Patient Start when a hospital stay begins",
  "Everything stays loggable while a stay is active",
  "What changes is missed-dose tracking: any dose window that opened while the stay was running is treated as the hospital\u2019s, not a miss of yours",
  "Tap Log In-Patient End when discharged",
  "Log the stay on the **In-Patient** tab",
  "Any dose window that OPENED while the stay was running is treated as the hospital's and is not flagged",
  "so a stay that ends at noon still leaves that afternoon and evening yours, and tracked normally",
  "When the stay begins, tap **Log In-Patient Start**",
  "When the person is discharged, tap **Log In-Patient End**",
  "Can I still log medications during a hospital stay",
  "Everything stays loggable the whole time a stay is active",
  "Doses the hospital gave are not counted as missed: any dose window that opened while the stay was running is treated as theirs",
  "You do NOT need to end the stay early to log them",
  "Medications showed as 'Restricted' and could not be logged at all while a stay was active, and this page told you to end the stay early to unlock them",
  "Tap **Log In-Patient End**",
  "There's a separate control for logging a past stay with both dates",
  "Find the option to log a past stay (Start + End)",
  "Logging is not blocked by a stay",
  "what changes is that dose windows opening during it stop being counted as the hospital's",
  "Each row is one logged entry: a dose, a temperature, a weight, a blood pressure, a symptom, a period marker, a hospital start or end",
  "Home, Meds, Reports, In-Patient, Symptoms",
  "hospital doses will not be flagged missed",
  "Track hospital stays here",
  "You can still log everything during a stay",
  "doses the hospital gave just aren\u2019t counted as missed",
  "add the End later from the card once this stay is over",
  "doses given by hospital staff are not counted as missed",
  "Log In-Patient End",
  "In-Patient tracking",
  "tap Log In-Patient Start",
  "Logging carries on as normal while a stay is active",
  "what changes is that dose windows opening during the stay are counted as the hospital\u2019s rather than as misses of yours",
  "\\n\\nTap Log In-Patient End when discharged",
  "\\n\\nUse the \u201c+\u201d button to log a past stay you forgot to record at the time (both a start and an end date)",
  "Dose windows that open while the stay is running are counted as the hospital\\u2019s, not as misses of yours",
  "Log a past stay (Start + End)",
  "Log a past hospital stay",
  "Log In-Patient Start",
  "No in-patient stays logged yet",
]);

// EXTRACT THE PROSE FIRST, THEN SCOPE INSIDE IT. The previous version scanned the raw source and
// then threw away any fragment that looked code-shaped -- a brace, an arrow, `style`, `h('`. That
// exclusion existed so a colour change could not churn the allow-list, and it silently discarded
// SEVENTEEN sentences that nobody ever reviewed. One of them was false and had survived four audit
// passes:
//
//     { id: 'inpatient', label: 'Hospital stays', icon: 'hospital',
//       blurb: 'Starting and ending a stay, and what pauses meanwhile' }
//
// That is the Help-centre category subtitle -- the line a caregiver reads under "Hospital stays"
// before opening anything, i.e. the first sentence shown to someone who came to Help specifically
// to find out what a stay does. It was skipped because its fragment carried the surrounding braces.
// A filter that decides what to look at by guessing at code shape will always throw away prose that
// happens to sit next to a brace, and what it throws away is exactly what nobody checks.
//
// So the strings are pulled out of the source properly first -- respecting escapes, which the old
// fragment approach did not -- and only their CONTENTS are scoped. A style value or a colour is not
// prose and is filtered by NARROW as before; a brace can no longer hide a sentence.
function stringLiterals(text) {
  const out = [];
  const re = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const v = m[1] !== undefined ? m[1] : m[2];
    if (v && v.length >= 4) out.push(v);
  }
  return out;
}
const unknown = [];
const seen = new Set();
for (const lit of stringLiterals(code)) {
  const scan = new RegExp(SCOPE.source, 'gi');
  let m;
  while ((m = scan.exec(lit)) !== null) {
    const sentence = sentenceAt(lit, m.index);
    if (!sentence || !NARROW.test(sentence)) continue;
    if (seen.has(sentence)) continue;
    seen.add(sentence);
    if (!ALLOWED.has(sentence)) unknown.push(sentence);
  }
}
t('the scanner still finds the sentences about hospital stays (it has not gone blind)',
  seen.size >= 20, seen.size + ' found');
t('every live sentence about a hospital stay is one a person has reviewed',
  unknown.length === 0,
  unknown.map(s => '  NEW OR CHANGED: ' + JSON.stringify(s.slice(0, 200))).join('\n        ') +
  (unknown.length ? '\n        Read each one. If it is true of what the code does, add it to ALLOWED.' : ''));

// And the true statement must actually still be present, or "nothing false is said" is satisfiable
// by saying nothing at all, which leaves a caregiver with no idea what a stay does.
t('the app still explains what a stay DOES change',
  /counted as the hospital|treated as the hospital|not counted as missed|hospital'?.?s, not as misses/i.test(code), '');

// ---------------------------------------------------------------------------------------------
// 3. THE GROUND TRUTH, IN A REAL BROWSER: with a hospital stay OPEN, tapping Log must write a dose.
//
// This is the only check here that cannot be routed around. Two source-shaped versions of it were
// beaten by simply moving the guard -- into status(), and into an inlined lookup with no call
// expression -- while every suite in this repository stayed green and the pre-v67 lockout was fully
// reinstated. You cannot enumerate the places a guard is forbidden to live. You can seed a stay,
// press the button a caregiver presses, and require the dose to be in the store afterwards.
//
// It fails both ways a lock can be built: a lock in status() removes the Log button entirely (no
// button to press), and a lock inside logMed() leaves the button but writes nothing.
const server = http.createServer((rq, rs) => {
  if (rq.url.startsWith('/index.html')) { rs.writeHead(200, { 'Content-Type': 'text/html' }); rs.end(src); return; }
  rs.writeHead(204); rs.end();
}).listen(0, '127.0.0.1');
await new Promise(r => server.once('listening', r));
const URL_ = 'http://127.0.0.1:' + server.address().port + '/index.html';

const P = 'chemowell-app-p-p1-';
const NOON = (() => { const d = new Date(); d.setHours(12, 0, 0, 0); return d.getTime(); })();
const SEED_ENTRIES = [
  // AN OPEN STAY: a start with no matching end is what "she is in hospital right now" looks like.
  { id: 'ip1', medId: 'inpatient_start', dose: 'In-patient start', mg: 0, ts: NOON - 86400000 }
];
// THREE medications, and the shapes are checked against normalizeMedication() rather than assumed.
//
// WHY THREE. One quickLog medication reaches exactly one route: a standalone card. That left three
// ways to lose a dose unwatched, all three of which the auditor then used and none of which any
// suite in this repo caught. So: one standalone card AND a two-medication Evening group, which is
// the everyday shape for anyone with morning/evening medications and which renders `Take all` --
// a SEPARATE branch of confirmTimeAndLog(), and a control that index.html:3535 records as having
// been hidden for a whole stay as a v67 leftover ("both web builds removed it correctly; this one
// did not").
//
// SHAPES VERIFIED, NOT ASSUMED. The first fixture used `type: 'prn'` and `doses: ['1 tablet']`.
// Neither is real. The normaliser is `type = original.type === 'win' ? 'win' : 'gap'`, so 'prn'
// silently became a gap-timer medication; and `doses.filter(d => d && d.label)` drops bare strings,
// so it had no dose options at all. The suite passed anyway -- its central claim, "nothing but a
// stay could block this", was asserted and never checked. These are explicit gap medications with
// gapHours 0 (no cooldown), no scheduleDays (every day), no treatment window, not paused, and real
// dose objects.
const SEED_MEDS = { version: 1, archivedMeds: [], meds: [
  { id: 'testmed', name: 'Test Medication', type: 'gap', quickLog: true, gapHours: 0,
    doses: [{ label: '1 tablet', mg: 0 }] },
  { id: 'grp1', name: 'Group One', type: 'gap', quickLog: false, groupedEvening: true, gapHours: 0,
    doses: [{ label: '1 capsule', mg: 0 }] },
  { id: 'grp2', name: 'Group Two', type: 'gap', quickLog: false, groupedEvening: true, gapHours: 0,
    doses: [{ label: '2 capsules', mg: 0 }] }
]};
const SEED_PREFS = { patientName: 'Test Patient', sex: 'female', treatmentType: 'chemo',
  tourDone: true, browserNoticeSeen: true, ceilingMg: 2500, tempUnit: 'Fahrenheit', weightUnit: 'lbs' };

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
await page.addInitScript(([p, entries, meds, prefs]) => {
  if (localStorage.getItem(p + 'entries-v1')) return;
  localStorage.setItem(p + 'entries-v1', JSON.stringify(entries));
  localStorage.setItem(p + 'med-v1', JSON.stringify(meds));
  localStorage.setItem(p + 'prefs-v1', JSON.stringify(prefs));
}, [P, SEED_ENTRIES, SEED_MEDS, SEED_PREFS]);
await page.goto(URL_, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1800);

// The fixture has to have taken, or everything below measures a first-run setup screen.
const ready = await page.evaluate(seedName => {
  if (!document.querySelector('[data-tour="nav-home"]')) return 'still on first-run setup';
  const main = document.querySelector('main');
  if (!main) return 'no <main> rendered';
  if (main.innerText.indexOf(seedName) < 0) return 'the seeded medication is not on Home';
  // And the stay must actually be open, or this is just a normal log and proves nothing.
  if (main.innerText.indexOf('In-Patient active') < 0) return 'no hospital stay is active — the fixture did not take';
  return true;
}, SEED_MEDS.meds[0].name);
t('a hospital stay is open and the seeded medication is on Home', ready === true,
  ready === true ? '' : String(ready));

// Helpers used by every route below. Every one of these exists because of a fault found on this
// file: press by EXACT text (an ancestor walk once clicked "Log In-Patient End" and ended the stay
// the whole check depends on), and always drive through Confirm (logMed() does not write -- it
// opens the time modal, and confirmTimeAndLog() writes; stopping at the first tap failed for the
// wrong reason on an app that was fine).
const pressExact = (label) => page.evaluate(want => {
  const b = [...document.querySelectorAll('main button')].find(x => (x.innerText || '').trim() === want);
  if (!b) return false; b.click(); return true;
}, label);
const pressConfirm = () => page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find(x => (x.innerText || '').trim() === 'Confirm');
  if (!b) return false; b.click(); return true;
});
const rows = (medId) => page.evaluate(([p, id]) =>
  JSON.parse(localStorage.getItem(p + 'entries-v1') || '[]').filter(e => e.medId === id), [P, medId]);
// A dose is only recorded if it is recorded FOR TODAY. See the timestamp check below.
const daysOff = (ts) => {
  const a = new Date(ts); a.setHours(0, 0, 0, 0);
  const b = new Date(); b.setHours(0, 0, 0, 0);
  return Math.round((a.getTime() - b.getTime()) / 86400000);
};

if (ready === true) {
  // ---- ROUTE 1: a standalone Quick Log card, twice ----------------------------------------------
  // TWICE, because a lock that lets the FIRST dose through and refuses every one after it passed a
  // single-dose check with all green. One dose is not a day of medication.
  for (const attempt of [1, 2]) {
    const before = (await rows('testmed')).length;
    const tapped = await pressExact('1 tablet');
    t('dose ' + attempt + ': the dose button is there during a stay', tapped,
      tapped ? '' : 'no "1 tablet" button on Home — a stay is locking the card, which is the pre-v67 defect');
    await page.waitForTimeout(900);
    const conf = await pressConfirm();
    t('dose ' + attempt + ': the log flow opened and offered Confirm', conf,
      conf ? '' : 'no Confirm button — the log flow did not open');
    await page.waitForTimeout(1200);
    const after = await rows('testmed');
    t('dose ' + attempt + ': tapping through actually records the dose', after.length === before + 1,
      before + ' before, ' + after.length + ' after');
    // COUNTING ROWS IS NOT RECORDING A DOSE. A sabotage that wrote the entry with a timestamp a
    // month in the past passed a count check with all green: the dose never appears in Today's
    // journal, never covers the window it was given for, and the dose that WAS given still flags as
    // missed. The row existed; the dose was lost.
    const newest = after[after.length - 1];
    t('dose ' + attempt + ': it is recorded for TODAY, not filed somewhere else',
      !!newest && daysOff(newest.ts) === 0,
      newest ? (daysOff(newest.ts) + ' day(s) off today · ts ' + new Date(newest.ts).toString().slice(0, 24)) : 'no entry');
  }

  // ---- ROUTE 2: the grouped card and Take all ---------------------------------------------------
  // A separate branch of confirmTimeAndLog(), and a control this app has ALREADY had removed for the
  // duration of a stay once (index.html:3535, a v67 leftover both web builds fixed and this one did
  // not). A fixture with one quickLog medication never renders a group card, so none of this was
  // watched by anything.
  const g1Before = (await rows('grp1')).length;
  const g2Before = (await rows('grp2')).length;
  const takeAll = await pressExact('Take all (2)');
  t('Take all is still offered during a hospital stay', takeAll,
    takeAll ? '' : 'no Take all on the group card — it has been hidden for the stay, which is the v67 leftover');
  if (takeAll) {
    await page.waitForTimeout(900);
    const conf = await pressConfirm();
    t('Take all opened the log flow and offered Confirm', conf, conf ? '' : 'no Confirm button');
    await page.waitForTimeout(1400);
    // PER MEDICATION, never a total. A total of two is satisfied by one medication logged twice,
    // and a partial write that saves some and drops the rest is a defect this project already has
    // on record in care-tracker's own Take all.
    const g1 = await rows('grp1'), g2 = await rows('grp2');
    t('Take all recorded the first medication in the group', g1.length === g1Before + 1,
      g1Before + ' before, ' + g1.length + ' after');
    t('Take all recorded the second medication in the group', g2.length === g2Before + 1,
      g2Before + ' before, ' + g2.length + ' after');
    t('both grouped doses are recorded for today',
      g1.length > g1Before && g2.length > g2Before &&
      daysOff(g1[g1.length - 1].ts) === 0 && daysOff(g2[g2.length - 1].ts) === 0, '');
  }

  t('the app logged no errors while doing any of it', pageErrors.length === 0, pageErrors.join(' / '));
}

await browser.close();
server.close();

console.log('\n' + (fail ? fail + ' FAILED' : 'all checks passed'));
process.exit(fail ? 1 : 0);
