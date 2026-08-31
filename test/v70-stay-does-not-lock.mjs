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
// 1. THE GROUND TRUTH: the dose-logging path must not consult a stay at all.
//
// The first version of this check counted occurrences of `inpatientCoversMoment(`. The auditor put
// `if (isInpatientActiveNow()) { ...; return; }` at the top of logMed() -- genuinely blocking every
// dose log during a stay, the exact v67 regression -- and the check stayed GREEN, because the count
// of the OTHER function was unchanged. It was a tripwire on one name, not a statement about what a
// stay does, and it printed a false sentence in green.
//
// So: read the two functions that actually write a dose and require that neither mentions ANY
// in-patient predicate, whatever it is called.
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
for (const name of ['logMed', 'confirmTimeAndLog']) {
  const body = fnBody(name);
  t('the dose-logging function ' + name + '() was found', !!body, body ? body.length + ' chars' : 'MISSING');
  if (!body) continue;
  const refs = [...new Set([...body.matchAll(/\b(\w*[Ii]n[Pp]atient\w*)\s*\(/g)].map(m => m[1]))];
  t(name + '() does not consult a hospital stay before writing a dose', refs.length === 0,
    refs.join(', '));
}

// ---------------------------------------------------------------------------------------------
// 2. THE ALLOW-LIST.
// Scope: a sentence that mentions a stay AND mentions logging/doses/medications/cards/buttons/
// tracking. Code-shaped fragments are excluded so an unrelated styling edit cannot churn the list.
// Boundaries include the em-dash and the semicolon, because the auditor's worst escape was a false
// claim joined by a dash to a clause that made it look historical.
const SCOPE = /in-?patient|hospital|\b(?:a|the|this|each|every|past|active|open|one) stays?\b|\bstays? (?:is|was|begins|ends|are|active|running)\b/i;
const NARROW = /\blog|\bdose|\bmedication|\bmeds?\b|button|card|track|miss|restrict|lock|pause|block|available/i;
const CODEY = /[{}]|=>|function |style|onClick|medId:|VALID_VIEWS|await |const |h\('/;
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
  "', a: 'Tap Log In-Patient Start when a hospital stay begins",
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
  "Logging was never blocked by the stay",
  "what changes is that dose windows opening during it stop being counted as the hospital's",
  "Each row is one logged entry: a dose, a temperature, a weight, a blood pressure, a symptom, a period marker, a hospital start or end",
  "Home, Meds, Reports, In-Patient, Symptoms",
  "hospital doses will not be flagged missed')",
  "You can still log everything during a stay",
  "doses the hospital gave just aren\u2019t counted as missed",
  "add the End later from the card once this stay is over",
  "') : '') + 'doses given by hospital staff are not counted as missed",
  "helpIcon('In-Patient tracking', 'Use this when a hospital stay begins",
  "tap Log In-Patient Start",
  "Logging carries on as normal while a stay is active",
  "what changes is that dose windows opening during the stay are counted as the hospital\u2019s rather than as misses of yours",
  "\\n\\nTap Log In-Patient End when discharged",
  "\\n\\nUse the \u201c+\u201d button to log a past stay you forgot to record at the time (both a start and an end date)",
  "Dose windows that open while the stay is running are counted as the hospital\\u2019s, not as misses of yours",
]);

const unknown = [];
const seen = new Set();
const scan = new RegExp(SCOPE.source, 'gi');
let m;
while ((m = scan.exec(code)) !== null) {
  const s = sentenceAt(code, m.index);
  if (!s || !NARROW.test(s) || CODEY.test(s)) continue;
  if (seen.has(s)) continue;
  seen.add(s);
  if (!ALLOWED.has(s)) unknown.push(s);
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

console.log('\n' + (fail ? fail + ' FAILED' : 'all checks passed'));
process.exit(fail ? 1 : 0);
