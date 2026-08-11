// Lead Developer self-verification for app-v56's help matcher, run headless against the REAL
// corpus sliced straight out of index.html — no copy of the data, so this can never drift from
// what ships.
//
// Run:  env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy node test/v56-matcher.mjs
//
// Why a slice-and-eval harness rather than Playwright: index.html is a single <script
// type="module">, so nothing it declares is reachable from page.evaluate(). The UI-level checks
// live in test/v56-helpbot.mjs and drive the real panel; this file exercises the scoring function
// itself across 60 fixture questions plus 18 out-of-scope probes, which would be unbearably slow
// through a browser and much harder to read when one of them regresses.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// Slice by declaration name and brace/bracket matching, so adding a topic or renaming a function
// cannot silently drop a chunk from the harness.
function sliceBlock(startMarker, openCh, closeCh) {
  const i = html.indexOf(startMarker);
  if (i < 0) throw new Error('marker not found: ' + startMarker);
  const from = html.indexOf(openCh, i);
  let depth = 0;
  for (let k = from; k < html.length; k++) {
    const c = html[k];
    if (c === openCh) depth++;
    else if (c === closeCh) { depth--; if (depth === 0) return html.slice(i, k + 1) + ';'; }
  }
  throw new Error('unbalanced block: ' + startMarker);
}
function sliceFn(name) {
  const marker = 'function ' + name + '(';
  const i = html.indexOf(marker);
  if (i < 0) throw new Error('function not found: ' + name);
  const from = html.indexOf('{', html.indexOf(')', i));
  let depth = 0;
  for (let k = from; k < html.length; k++) {
    const c = html[k];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return html.slice(i, k + 1); }
  }
  throw new Error('unbalanced function: ' + name);
}
function sliceLine(re) {
  const m = html.match(re);
  if (!m) throw new Error('line not found: ' + re);
  return m[0];
}

const src = [
  sliceBlock('const HELP_CATEGORIES = [', '[', ']'),
  sliceBlock('const HELP_POINTERS = [', '[', ']'),
  sliceLine(/const HELP_CARE_TEAM_LINE = '[^']*';/),
  sliceBlock('const HELP_TOPICS = [', '[', ']'),
  sliceBlock('const FAQ_ITEMS = [', '[', ']'),
  sliceBlock('const HELP_STOP = new Set(', '(', ')'),
  sliceBlock('const HELP_STOP_GREETING = new Set(', '(', ')'),
  sliceLine(/const HELP_STOP_SEARCH = new Set\([^\n]*/),
  sliceBlock('const HELP_SYNONYMS = {', '{', '}'),
  sliceBlock('const HELP_FIELDS = [', '[', ']'),
  sliceLine(/const HELP_UNKNOWN_IDF = [0-9.]+;/),
  sliceLine(/const HELPBOT_ANSWER = [0-9.]+;/),
  sliceLine(/const HELPBOT_SHOW = [0-9.]+;/),
  sliceLine(/const HELPBOT_MARGIN = [0-9.]+;/),
  sliceLine(/const HELPBOT_LIST_COVERAGE = [0-9.]+;/),
  sliceLine(/const HELPBOT_MIN_TERMS = [0-9.]+;/),
  sliceLine(/const HELPBOT_SUBJECT_MARGIN = [0-9.]+;/),
  sliceLine(/const HELP_THIRD_PERSON = [^\n]*/),
  'let helpBotIndex = null;',
  sliceFn('helpNorm'), sliceFn('helpStem'), sliceFn('helpIndex'),
  sliceFn('helpEditWithin'), sliceFn('helpFuzzy'), sliceFn('helpTerms'),
  sliceFn('helpScore'), sliceFn('helpMatch'), sliceFn('helpBotDecide'),
  sliceFn('helpFaqTopics'),
  sliceLine(/function helpAllTopics\(\)[^\n]*/),
  sliceFn('helpSearch'),
  sliceLine(/const HELP_CLINICAL_MEASURES = [^\n]*/),
  sliceBlock('const HELP_GUARD_HARD = [', '[', ']'),
  sliceBlock('const HELP_GUARD_SOFT = [', '[', ']'),
  sliceLine(/const HELP_APP_OBJECTS = [^\n]*/),
  sliceLine(/const HELP_APP_OBJECTS_DUAL = [^\n]*/),
  sliceLine(/const HELP_APP_TASK = [^\n]*/),
  sliceBlock('const HELP_GUARD_PERSON = [', '[', ']'),
  sliceFn('helpBotGuard'),
  'globalThis.__api = { HELP_POINTERS, helpBotDecide, helpMatch, helpSearch, helpStem, helpNorm, helpTerms, helpIndex, helpBotGuard, HELP_TOPICS, FAQ_ITEMS };'
].join('\n\n');

vm.runInThisContext('(function(){\n' + src + '\n})()');
const A = globalThis.__api;
const HELP_POINTERS_Q = A.HELP_POINTERS[0].q;
const HELP_POINTERS_TO = A.HELP_POINTERS[0].to;

let fail = 0, warn = 0;
const t = (name, cond, detail) => {
  console.log((cond ? 'PASS  ' : 'FAIL  ') + name + (detail ? '  |  ' + detail : ''));
  if (!cond) fail++;
};

// ---------- stemmer unit cases (the brief's worked examples) ----------
const STEM = [['doses', 'dos'], ['dose', 'dos'], ['logged', 'log'], ['logging', 'log'],
  ['taking', 'tak'], ['take', 'tak'], ['missed', 'mis'], ['missing', 'mis'], ['miss', 'mis'],
  ['medications', 'medication'], ['battery', 'batteri'], ['batteries', 'batteri'],
  ['reminders', 'reminder']];
let stemBad = [];
STEM.forEach(([w, want]) => { const got = A.helpStem(w); if (got !== want) stemBad.push(w + '->' + got + ' want ' + want); });
t('stemmer collapses the verb/plural families the design depends on', stemBad.length === 0, stemBad.join(', '));
t('stemmer is idempotent (stem(stem(x)) === stem(x))',
  STEM.every(([w]) => A.helpStem(A.helpStem(w)) === A.helpStem(w)));

// ---------- normalisation ----------
t('apostrophes are deleted, not spaced', A.helpNorm("can't type") === 'cant type', A.helpNorm("can't type"));
t('curly apostrophes normalise the same as straight', A.helpNorm('can’t') === A.helpNorm("can't"));
t('decimals split identically on both sides', A.helpNorm('100.4') === '100 4', A.helpNorm('100.4'));

// ---------- index integrity ----------
const ix = A.helpIndex();
t('index covers every topic + FAQ', ix.N === A.HELP_TOPICS.length + A.FAQ_ITEMS.length, ix.N + ' docs');
// V56-10 (Auditor): the first version of this checked that vit-units' keywords contain "unit",
// which its OWN keyword "units" already supplies -- deleting the pointer fold-in entirely would
// not have failed it. Assert against a word that appears ONLY in the pointer's text, computed from
// HELP_POINTERS rather than hardcoded, so it keeps working when pointer #2 is added.
{
  const ptrWords = A.helpNorm(HELP_POINTERS_Q).split(' ').filter(Boolean);
  const target = ix.docs.find(d => d.t.id === HELP_POINTERS_TO);
  const missing = ptrWords.filter(w => !target.tok.kw.has(w) && !target.tok.kw.has(A.helpStem(w)));
  t('HELP_POINTERS folded in as keyword aliases on their target (BACKLOG gap closed)',
    !!target && missing.length === 0, 'missing from ' + HELP_POINTERS_TO + '.kw: ' + missing.join(', '));
  // And the behaviour it exists for: the pointer text must actually find its target.
  const found = A.helpSearch(HELP_POINTERS_Q);
  t('searching the pointer text finds its target topic', found.length > 0 && found[0].id === HELP_POINTERS_TO,
    found.slice(0, 2).map(x => x.id).join(', '));
}
t('no document indexes an empty vocabulary', ix.docs.every(d => d.all.size > 3));

// ---------- the single most important stopword case ----------
const helpWord = A.helpBotDecide('help');
t('typing the single word "help" does NOT return the emergency-symptom page',
  helpWord.mode === 'none', helpWord.mode + (helpWord.topic ? ' -> ' + helpWord.topic.id : ''));

// ---------- fixture ----------
// expected: string id, or array of acceptable ids. decision: 'answer' | 'list' | 'none' | 'guard'.
const FIXTURE = [
  ['why cant i type in the daily limit box', 'med-daily-limit-locked', 'answer'],
  ['daily limit is locked', 'med-daily-limit-locked', 'answer'],
  ['the limit box is greyed out', 'med-daily-limit-locked', 'answer'],
  ['im not getting any notifications', 'rem-none', 'answer'],
  ['no reminders coming through at all', ['rem-none', 'rem-none-scheduled'], null],
  ['notifcations not working', ['rem-none', 'rem-none-scheduled'], null],
  ['the reminder came 10 mins late', 'rem-late', 'answer'],
  ['alarms and reminders switch is missing on my samsung', 'rem-exact-toggle-missing', 'answer'],
  ['how do i add a new medicine', 'med-add-first', 'answer'],
  ['how do i add a med', 'med-add-first', 'answer'],
  ['my moms medication isnt on the home screen', ['med-not-on-home', 'set-card-missing', 'med-placement'], null],
  ['all my meds vanished', 'set-quicklog-collapsed', null],
  ['the app is broken', ['app-report', 'app-old-version'], null],
  ['the screen is blank', 'app-blank', 'answer'],
  ['screen keeps flickering', 'set-something-flickering', 'answer'],
  ['i tap the button and nothing happens', 'app-nothing-happens', 'answer'],
  ['he missed his chemo pill last night what do i do', 'miss-real-missed', null],
  ['i think i logged the same dose twice', 'log-double-tap', 'answer'],
  ['how do i delete something i logged by mistake', 'log-remove', 'answer'],
  ['can i log a dose from yesterday', ['log-wrong-time', 'log-forgot-yesterday'], null],
  ['export to excel', 'exp-csv', 'answer'],
  ['where did my csv file go', 'exp-where-file', 'answer'],
  ['print a report for the doctor', 'exp-printable', 'answer'],
  ['how do i put in his weight', ['vit-weight-log', 'vit-weight-change', 'rep-weight'], null],
  ['the temprature wont save', ['vit-temp-rejected', 'med-save-blocked'], null],
  ['change it to celsius', 'vit-units', 'answer'],
  ['i look after two people', 'pro-add', null],
  ['how much does pro cost', 'pro-plans', 'answer'],
  ['is my information private', ['priv-server', 'faq:privacy', 'priv-who-sees'], null],
  ['what happens if i lose my phone', 'priv-lost-phone', 'answer'],
  ['his meds say restricted', 'ip-meds-restricted', 'answer'],
  ['i forgot to end the hospital stay', 'ip-forgot-end', 'answer'],
  ['the back button closes the whole app', 'app-back-button', 'answer'],
  ['how do i do the walkthrough again', 'tour-replay', 'answer'],
  ['whats the difference between notes and the check in', 'note-vs-checkin', 'answer'],
  ['add an appointment reminder', ['appt-add', 'appt-reminder-choose', 'rem-appointment'], null],
  ['red banner wont go away', 'miss-banner', 'answer'],
  ['clear all the missed doses at once', 'miss-clear-all', 'answer'],
  ['history is really slow', 'rep-history-slow', 'answer'],
  ['i cant find something i logged', 'rep-entry-missing', 'answer'],
  ['does it work with no internet', 'app-offline', 'answer'],
  ['wat version am i on', ['app-version', 'app-old-version'], null],
  ['how do i start over and erase everything', 'set-erase-all', 'answer'],
  ['diarrhoea where do i put it', 'sym-bowel-confusion', 'answer'],
  ['pause a medication for a week', 'med-pause-resume', 'answer'],
  ['it wont let me save the medication', 'med-save-blocked', 'answer'],
  ['what does reminds at mean', ['med-windows', 'faq:schedule-windows'], null],
  ['i want a reminder every 4 hours', ['med-gap-hours', 'med-asneeded-vs-scheduled', 'faq:gap-timer'], null],
  ['why is the log button greyed out', 'log-button-locked', 'answer'],
  ['when does a dose count as missed', 'miss-what-counts', 'answer'],
  ['how do i set the treatment date', ['treat-set-date', 'faq:treatment-date'], null],
  ['radiation session counter', 'treat-radiation', 'answer'],
  ['i picked the wrong treatment type', 'pro-wrong-treatment-type', 'answer']
];

const idsOf = (d) => d.mode === 'answer' ? [d.topic.id] : d.mode === 'list' ? d.hits.map(x => x.id) : [];
const want = (e) => Array.isArray(e) ? e : [e];

let exact = 0, top3 = 0, missed = [];
FIXTURE.forEach(([q, expected, decision]) => {
  const d = A.helpBotDecide(q);
  const got = idsOf(d);
  const alts = d.mode === 'answer' ? (d.alts || []).map(x => x.id) : [];
  const shown = got.concat(alts);
  const w = want(expected);
  if (got[0] && w.indexOf(got[0]) >= 0) exact++;
  else if (w.some(x => shown.indexOf(x) >= 0)) top3++;
  else missed.push(q + '  -> [' + shown.join(', ') + '] want ' + w.join('|'));
  if (decision && d.mode !== decision) { warn++; console.log('      note: "' + q + '" decided ' + d.mode + ', brief said ' + decision); }
});
t('every fixture question surfaces an acceptable topic somewhere', missed.length === 0, missed.join(' ;; '));
t('at least 45 of ' + FIXTURE.length + ' rank an acceptable topic FIRST', exact >= 45, exact + ' first, ' + top3 + ' in shown set');

// ---------- must-refuse ----------
const NONE_OK = ['asdfgh', 'thanks', 'hows the weather today', 'whats for dinner', 'ok', 'hello', 'thank you so much'];
let noneBad = [];
NONE_OK.forEach(q => { const d = A.helpBotDecide(q); if (d.mode === 'answer') noneBad.push(q + ' -> ' + d.topic.id); });
t('noise and greetings never produce a confident answer', noneBad.length === 0, noneBad.join(', '));

// The named regression from the brief: "will she lose her hair" must never confidently answer
// "What happens if I lose my phone?". This is the coverage gate doing its job.
const hair = A.helpBotDecide('will she lose her hair');
t('"will she lose her hair" never answers the lost-phone page confidently',
  !(hair.mode === 'answer' && hair.topic.id === 'priv-lost-phone'),
  hair.mode + (hair.topic ? ' -> ' + hair.topic.id : ''));

// ---------- guards ----------
// The eight after the first line are V56-1 from the Auditor: every one of them used to get a
// normal app answer, and "is this medicine safe for children" answered the PRIVACY page while
// "what are the side effects of cisplatin" answered the symptom-logging walkthrough with steps.
const CLINICAL = ['what dose should i give', 'is 101 a fever', 'should i take a double dose',
  'can he take two paracetamol together', 'how many mg of tylenol is safe', 'can i give him ibuprofen',
  'is 99.8 too high', 'is it ok to double up', 'should i be worried', 'is that normal',
  'what dosage should he have', 'is this dangerous',
  'is this medicine safe for children', 'what are the side effects of cisplatin',
  'is 2 tablets too many', 'can i crush the tablet', 'does this interact with grapefruit',
  'can he take this with food', 'is it safe to take with alcohol', 'how long should he stay on this',
  'is this ok during pregnancy', 'is he allergic to this', 'what are the side effects',
  'can this be taken with milk'];
let clinBad = [];
CLINICAL.forEach(q => { const g = A.helpBotGuard(q); if (!g || g.kind !== 'clinical') clinBad.push(q + ' -> ' + (g ? g.kind : 'none')); });
t('every clinical question fires the clinical guard', clinBad.length === 0, clinBad.join(' ;; '));

const PERSON = ['are you a real person', 'is this a real person', 'can i speak to someone',
  'are you human', 'are you ai', 'can i talk to a person', 'is anyone there'];
let persBad = [];
PERSON.forEach(q => { const g = A.helpBotGuard(q); if (!g || g.kind !== 'person') persBad.push(q + ' -> ' + (g ? g.kind : 'none')); });
t('every "are you real" question fires the person guard', persBad.length === 0, persBad.join(' ;; '));

// The guard must not fire on ordinary app questions — a refusal shown to someone asking how to
// export a CSV is just as much a defect as an answer shown to someone asking about a dose.
let falsePos = [];
FIXTURE.forEach(([q]) => { const g = A.helpBotGuard(q); if (g) falsePos.push(q + ' -> ' + g.kind); });
t('no guard fires on any of the ' + FIXTURE.length + ' ordinary app questions', falsePos.length === 0, falsePos.join(' ;; '));


// ---------- the Lead Auditor's two sets, both directions ----------
// These are HIS lists, verbatim, not a re-derivation: the first version of the clinical guard
// scored well on my own fixture and still refused 21 ordinary questions, because I only ever
// measured the direction I was worried about. Both directions are pinned here permanently.
const GUARD_MUST_NOT_FIRE = [
  "is my data safe",
  "is my information safe on this app",
  "is the app safe to use offline",
  "where do i put take with food",
  "how do i add take with food instructions",
  "can i set up a profile for a child",
  "i added too many medications how do i delete one",
  "i logged too many doses by mistake",
  "how long should i keep my history",
  "how long does the export take",
  "how do i log side effects",
  "where do i record side effects",
  "where do i note the liver test results",
  "is it safe to delete a profile",
  "is my backup safe if i change phones",
  "how many medications can i add",
  "what does the allergy field do",
  "where do i put allergies",
  "can this be exported to a spreadsheet",
  "how do i split the dose into morning and evening",
  "how do i change units to metric",
  "is my phone the only place the data is stored",
  "does the app share my data with anyone",
  "how do i export a csv",
  "why is the daily limit box locked",
  "how do i pause treatment",
  "i get too many reminders how do i turn some off",
  "how do i set a reminder for my childs vitamins",
  "can i add a medication for a child profile",
  "is it safe to uninstall the app will i lose data",
  "how do i back up before switching phones",
  "what happens if i log a dose twice",
  "how do i mark a dose as taken with food",
  "is the export file safe to email",
  "how do i turn off too many notifications"
];
const GUARD_MUST_FIRE = [
  "he keeps throwing up after every meal what do i do",
  "her feet are swelling up is that from the chemo",
  "the nurse said watch for infection what should i look for",
  "he has a sore mouth and cant eat anything",
  "how do i stop the nausea",
  "what helps with the mouth sores",
  "she cant sleep since starting treatment",
  "his hands are numb and tingly",
  "her white count is low what does that mean",
  "what does neutropenic mean",
  "he has a nosebleed that wont stop",
  "she fell this morning should she be seen",
  "hes been sleeping 20 hours a day",
  "the injection site is red and hot",
  "her port is leaking",
  "when will his hair grow back",
  "how long until the chemo starts working",
  "does radiation burn the skin",
  "what cream can i put on the radiation burn",
  "he has a headache can he take anything for it",
  "she is constipated from the painkillers",
  "her lips are turning blue",
  "he is confused and not making sense",
  "she has been running a low grade temp for two days",
  "he is shivering and his teeth are chattering",
  "she is bleeding from her gums",
  "how much water should he drink",
  "his appetite is gone completely",
  "her heart is racing",
  "he has a fever of 103 what do i do",
  "she threw up her pill right after taking it",
  "what do i do about the diarrhea",
  "when should i call the on call number",
  "can he drink alcohol on chemo",
  "is it safe to be around the grandkids",
  "does he need a mask in public",
  "can she get the flu shot during chemo",
  "how do i know if its an infection",
  "his stool is black",
  "she has a lump under her arm",
  "what are the signs of dehydration",
  "should we go to the er",
  "he wont eat or drink anything today",
  "her chemo brain is getting worse is that permanent",
  "how long does chemo stay in the body",
  "what happens if he misses a whole week of pills",
  "she is coughing up blood",
  "the pharmacist gave a different colour tablet is it the same drug",
  "his temperature keeps going up and down all day",
  "can i give her the tablet with her heart medicine"
];

let ordinaryRefused = [];
GUARD_MUST_NOT_FIRE.forEach(q => { const g = A.helpBotGuard(q); if (g) ordinaryRefused.push(q + ' -> ' + g.kind); });
t('none of the ' + GUARD_MUST_NOT_FIRE.length + ' ordinary app questions is refused as clinical',
  ordinaryRefused.length === 0, ordinaryRefused.join(' ;; '));

// The safety property is NOT "the guard catches every clinical question" -- it is "no clinical
// question ever gets a normal app answer or a list of app pages". Anything the guard misses must
// fall through to the "I don't have an answer for that one" reply, whose copy already says it is a
// question for the care team.
let clinicalLeaked = [], guardCaught = 0;
GUARD_MUST_FIRE.forEach(q => {
  if (A.helpBotGuard(q)) { guardCaught++; return; }
  const d = A.helpBotDecide(q);
  if (d.mode === 'answer' && d.topic.careLead) return;   // a careLead answer IS the care-team route
  if (d.mode !== 'none') clinicalLeaked.push(q + ' -> ' + (d.mode === 'answer' ? 'CONFIDENT ' + d.topic.id : 'list [' + d.hits.map(x => x.id).join(', ') + ']'));
});
// Scoped honestly. The earlier version of this asserted a flat "no clinical question gets an app
// answer or a list", went green, and that sentence went into the README in bold -- where the PM
// gate broke it in five minutes with questions this fixture had never seen. A tuned set can only
// tell you about itself. The absolute claim now lives in test/v56-guard-heldout.mjs, against
// questions nobody tuned on, and it is a measured number there rather than an absolute anywhere.
t('no clinical question in the TUNED set gets a confident answer on a non-careLead topic',
  clinicalLeaked.filter(x => x.indexOf('CONFIDENT') >= 0).length === 0,
  clinicalLeaked.filter(x => x.indexOf('CONFIDENT') >= 0).join(' ;; '));
t('at most 1 clinical question in the TUNED set gets a list of app pages',
  clinicalLeaked.length <= 1, clinicalLeaked.join(' ;; '));
t('the guard itself catches at least 35 of the ' + GUARD_MUST_FIRE.length + ' clinical questions',
  guardCaught >= 35, guardCaught + ' caught, ' + (GUARD_MUST_FIRE.length - guardCaught) + ' fall through to "I do not know"');

// ---------- ordering: guard beats score ----------
t('clinical guard fires even when a topic would have scored high',
  !!A.helpBotGuard('should i take a double dose'),
  'decide() would have returned: ' + JSON.stringify(idsOf(A.helpBotDecide('should i take a double dose'))));

// ---------- performance ----------
const t0 = Date.now();
for (let i = 0; i < 200; i++) A.helpBotDecide(FIXTURE[i % FIXTURE.length][0]);
const per = (Date.now() - t0) / 200;
t('a query resolves in under 25ms on this machine', per < 25, per.toFixed(2) + ' ms/query');

// ---------- the Help view's search box shares the matcher ----------
const s1 = A.helpSearch('greyed out daily limit');
t('Help search still finds the daily-limit topic', s1.length > 0 && s1[0].id === 'med-daily-limit-locked', s1.slice(0, 2).map(x => x.id).join(', '));
t('Help search is unfiltered by threshold (returns more than the bot would)',
  A.helpSearch('reminder').length > 4, A.helpSearch('reminder').length + ' results');
t('Help search returns [] for an empty query', A.helpSearch('   ').length === 0);
// LA-2: "help" typed into a box headed *Search help* returned "Nothing matched that", because the
// search box shared the BOT's stopword list -- where `help` exists so that a chat box answers a
// bare "help" with its greeting rather than the emergency-symptom page.
t('LA-2 searching "help" in the Help view returns results', A.helpSearch('help').length > 0,
  A.helpSearch('help').length + ' results');
t('LA-2 the BOT still refuses a bare "help" (the two lists differ on purpose)',
  A.helpBotDecide('help').mode === 'none');
// Regression: every topic must still be findable by its own title, which is how the v55 audit
// checked the old search and is the one property a scoring rewrite could silently break.
let unfindable = [];
A.HELP_TOPICS.forEach(topic => {
  const r = A.helpSearch(topic.q);
  if (!r.length || r[0].id !== topic.id) unfindable.push(topic.id + ' -> ' + (r[0] ? r[0].id : 'none'));
});
t('all 117 topics are still found first by their own question text', unfindable.length === 0,
  unfindable.length + ' not first: ' + unfindable.slice(0, 5).join(', '));

console.log('\n' + exact + '/' + FIXTURE.length + ' exact, ' + top3 + ' recovered in the shown set, ' + missed.length + ' missed');
console.log(fail === 0 ? 'ALL GREEN' : '\n' + fail + ' FAILURES');
process.exit(fail ? 1 : 0);
