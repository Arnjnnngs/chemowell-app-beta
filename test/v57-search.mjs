// Lead Developer self-verification for the Help & FAQ centre's SEARCH BOX (app-v57), run headless
// against the REAL corpus sliced straight out of index.html — no copy of the data, so this can
// never drift from what ships.
//
// Run:  env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy node test/v57-search.mjs
//
// LINEAGE. This is test/v56-matcher.mjs with the on-screen help bubble's half deleted. v57 removed
// the bubble at the Owner's direction; the scored matcher underneath it stayed, because it is what
// the Help view's search box runs on and reverting to v55's AND-over-substrings filter would be a
// straight regression. Everything here that survived is a property of the SEARCH BOX. Everything
// that was a property of the BOT — helpBotDecide's answer/list/none thresholds, the clinical and
// person guards, and the held-out guard fixture in test/v56-guard-heldout.mjs — was deleted with
// the code it tested rather than left behind asserting against functions that no longer exist.
//
// CORRECTION, and read this before trusting anything else in this header. The first version of this
// paragraph argued the removal was safe because "the search box only ranks a list of page titles,
// which is exactly what v55 shipped and what every v55 gate passed." **That was false.** The Zero
// Day Auditor sliced v55's actual helpSearch() out of commit 864aeaf and measured it: v55 returned
// NOTHING for 49 of 50 clinical questions -- an honest empty state -- while the v56 matcher returns
// a ranked list for 45 of 50. The behaviour being defended arrived with v56, on a path nobody had
// audited, because v56's review was aimed at the bubble. "It passed before" was not evidence.
//
// What is actually true: the guards existed because the bubble ANSWERED, replying to a typed
// sentence with prose, so "is 101.4 a fever" had to be intercepted before it could reply at all.
// The search box does not answer. But it does RANK, and ranking "she collapsed" against a corpus
// containing a page about collapsed sections produces a confident-looking wrong row that no score
// threshold can catch. So the safety property is not a refusal and not a classifier -- both of
// those failed in v56. It is a render path: the care-team sentence and a one-tap route to
// sym-severe are above EVERY results screen, unconditionally. That is asserted in the rendered UI
// by test/v57-browser-notice.mjs. What is measured here is the weaker, supporting property -- that
// a frightening query also tends to surface a care-team page in the rows a phone actually shows.
//
// Why a slice-and-eval harness rather than Playwright: index.html is a single <script
// type="module">, so nothing it declares is reachable from page.evaluate(). UI-level checks drive
// the real rendered Help view; this file exercises the scoring function itself across 53 fixture
// questions plus the out-of-scope probes, which would be unbearably slow through a browser and
// much harder to read when one of them regresses.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const fs = require('fs');
const vm = require('vm');

// --file lets this suite be pointed at a mutated copy, which is what makes its assertions
// FALSIFIABLE -- break the build under test, watch the check go red, restore it.
const FILE = process.argv.includes('--file')
  ? process.argv[process.argv.indexOf('--file') + 1]
  : new URL('../index.html', import.meta.url);
const html = fs.readFileSync(FILE, 'utf8');

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
  'let helpSearchIndex = null;',
  sliceFn('helpNorm'), sliceFn('helpStem'), sliceFn('helpIndex'),
  sliceFn('helpEditWithin'), sliceFn('helpFuzzy'), sliceFn('helpTerms'),
  sliceFn('helpScore'), sliceFn('helpMatch'),
  sliceFn('helpFaqTopics'),
  sliceLine(/function helpAllTopics\(\)[^\n]*/),
  sliceLine(/const HELP_SEARCH_FLOOR = [0-9.]+;/),
  sliceLine(/const HELP_SEARCH_MAX = [0-9]+;/),
  sliceFn('helpSearchFull'),
  sliceLine(/function helpSearch\(query\) \{ return helpSearchFull\(query\)\.hits; \}/),
  'globalThis.__api = { HELP_POINTERS, helpMatch, helpSearch, helpSearchFull, helpStem, helpNorm, helpTerms, helpIndex, HELP_TOPICS, FAQ_ITEMS };'
].join('\n\n');

vm.runInThisContext('(function(){\n' + src + '\n})()');
const A = globalThis.__api;
const HELP_POINTERS_Q = A.HELP_POINTERS[0].q;
const HELP_POINTERS_TO = A.HELP_POINTERS[0].to;

let fail = 0;
const t = (name, cond, detail) => {
  console.log((cond ? 'PASS  ' : 'FAIL  ') + name + (detail ? '  |  ' + detail : ''));
  if (!cond) fail++;
};

// Source-level assertions run against CODE ONLY. Three false positives across two releases all came
// from a comment that mentioned the very token the assertion forbade, so comments are stripped
// before any "this string must not appear" check.
function codeOnly(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
}

// ---------- the bubble is gone, and stayed gone ----------
// Written as an ABSENCE check on code (not comments) because "we removed it" is exactly the kind of
// claim that quietly stops being true when a later release restores a helper "just for the search".
{
  const code = codeOnly(html);
  const survivors = ['helpBotDecide', 'helpBotGuard', 'renderHelpBot', 'helpBotSyncViewport',
    'HELPBOT_ANSWER', 'HELP_GUARD_HARD', 'HELP_GUARD_SOFT', 'HELP_GUARD_PERSON',
    'helpBotOpen', 'helpbot-fab', 'helpbot-log', 'helpbot-input'].filter(n => code.indexOf(n) >= 0);
  t('no help-bubble symbol survives anywhere in shipped code', survivors.length === 0, survivors.join(', '));
}

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
  const found = A.helpSearch(HELP_POINTERS_Q);
  t('searching the pointer text finds its target topic', found.length > 0 && found[0].id === HELP_POINTERS_TO,
    found.slice(0, 2).map(x => x.id).join(', '));
}
t('no document indexes an empty vocabulary', ix.docs.every(d => d.all.size > 3));

// ---------- fixture ----------
// The 53 questions the v56 matcher was tuned against, re-scored through helpSearch. The bot's
// answer/list/none decision is gone, so the property is now purely about RANK: the page a person
// asking this needs must be at or near the top of the list they are shown.
const FIXTURE = [
  ['why cant i type in the daily limit box', 'med-daily-limit-locked'],
  ['daily limit is locked', 'med-daily-limit-locked'],
  ['the limit box is greyed out', 'med-daily-limit-locked'],
  ['im not getting any notifications', 'rem-none'],
  ['no reminders coming through at all', ['rem-none', 'rem-none-scheduled']],
  ['notifcations not working', ['rem-none', 'rem-none-scheduled']],
  ['the reminder came 10 mins late', 'rem-late'],
  ['alarms and reminders switch is missing on my samsung', 'rem-exact-toggle-missing'],
  ['how do i add a new medicine', 'med-add-first'],
  ['how do i add a med', 'med-add-first'],
  ['my moms medication isnt on the home screen', ['med-not-on-home', 'set-card-missing', 'med-placement']],
  ['all my meds vanished', 'set-quicklog-collapsed'],
  ['the app is broken', ['app-report', 'app-old-version']],
  ['the screen is blank', 'app-blank'],
  ['screen keeps flickering', 'set-something-flickering'],
  ['i tap the button and nothing happens', 'app-nothing-happens'],
  ['he missed his chemo pill last night what do i do', 'miss-real-missed'],
  ['i think i logged the same dose twice', 'log-double-tap'],
  ['how do i delete something i logged by mistake', 'log-remove'],
  ['can i log a dose from yesterday', ['log-wrong-time', 'log-forgot-yesterday']],
  ['export to excel', 'exp-csv'],
  ['where did my csv file go', 'exp-where-file'],
  ['print a report for the doctor', 'exp-printable'],
  ['how do i put in his weight', ['vit-weight-log', 'vit-weight-change', 'rep-weight']],
  ['the temprature wont save', ['vit-temp-rejected', 'med-save-blocked']],
  ['change it to celsius', 'vit-units'],
  ['i look after two people', 'pro-add'],
  ['how much does pro cost', 'pro-plans'],
  ['is my information private', ['priv-server', 'faq:privacy', 'priv-who-sees']],
  ['what happens if i lose my phone', 'priv-lost-phone'],
  ['his meds say restricted', 'ip-meds-restricted'],
  ['i forgot to end the hospital stay', 'ip-forgot-end'],
  ['the back button closes the whole app', 'app-back-button'],
  ['how do i do the walkthrough again', 'tour-replay'],
  ['whats the difference between notes and the check in', 'note-vs-checkin'],
  ['add an appointment reminder', ['appt-add', 'appt-reminder-choose', 'rem-appointment']],
  ['red banner wont go away', 'miss-banner'],
  ['clear all the missed doses at once', 'miss-clear-all'],
  ['history is really slow', 'rep-history-slow'],
  ['i cant find something i logged', 'rep-entry-missing'],
  ['does it work with no internet', 'app-offline'],
  ['wat version am i on', ['app-version', 'app-old-version']],
  ['how do i start over and erase everything', 'set-erase-all'],
  ['diarrhoea where do i put it', 'sym-bowel-confusion'],
  ['pause a medication for a week', 'med-pause-resume'],
  ['it wont let me save the medication', 'med-save-blocked'],
  ['what does reminds at mean', ['med-windows', 'faq:schedule-windows']],
  ['i want a reminder every 4 hours', ['med-gap-hours', 'med-asneeded-vs-scheduled', 'faq:gap-timer']],
  ['why is the log button greyed out', 'log-button-locked'],
  ['when does a dose count as missed', 'miss-what-counts'],
  ['how do i set the treatment date', ['treat-set-date', 'faq:treatment-date']],
  ['radiation session counter', 'treat-radiation'],
  ['i picked the wrong treatment type', 'pro-wrong-treatment-type']
];

const want = (e) => Array.isArray(e) ? e : [e];
let exact = 0, top3 = 0, missed = [];
FIXTURE.forEach(([q, expected]) => {
  const ids = A.helpSearch(q).map(x => x.id);
  const w = want(expected);
  if (ids[0] && w.indexOf(ids[0]) >= 0) exact++;
  else if (w.some(x => ids.slice(0, 3).indexOf(x) >= 0)) top3++;
  else missed.push(q + '  -> [' + ids.slice(0, 4).join(', ') + '] want ' + w.join('|'));
});
t('every fixture question ranks an acceptable topic in the top 3', missed.length === 0, missed.join(' ;; '));
t('at least 45 of ' + FIXTURE.length + ' rank an acceptable topic FIRST', exact >= 45, exact + ' first, ' + top3 + ' recovered in top 3');

// ---------- noise ----------
// A search box may legitimately show weak matches -- it is a list of page titles, not an answer --
// but pure noise must not put a specific page at rank 1 as though it were the thing you asked for.
const NOISE = ['asdfgh', 'qwertyuiop', 'zzzzzz'];
let noiseBad = [];
NOISE.forEach(q => { const r = A.helpSearch(q); if (r.length) noiseBad.push(q + ' -> ' + r.slice(0, 2).map(x => x.id).join(', ')); });
t('gibberish returns no results at all', noiseBad.length === 0, noiseBad.join(' ;; '));

// The named regression from the v56 brief, restated for a ranked list: "will she lose her hair"
// must not put "What happens if I lose my phone?" at rank 1 on the strength of the word "lose".
{
  const r = A.helpSearch('will she lose her hair');
  t('"will she lose her hair" does not rank the lost-phone page first',
    !(r.length && r[0].id === 'priv-lost-phone'), r.slice(0, 3).map(x => x.id).join(', '));
}

// ---------- the property that replaces the guards ----------
// The Lead Auditor's 50 clinical questions, verbatim. With no bot there is nothing to refuse; the
// question is whether the search box HELPS. sym-severe is the page whose first line is "Contact the
// care team, or emergency services if it's urgent" -- for a frightened caregiver typing a symptom
// into the search box, that page appearing in the visible results is the good outcome, and it is
// the one thing a scoring change could silently destroy.
//
// The floor below is MEASURED, not aspirational, and it is deliberately not 50/50: many of these
// are answerable app questions ("what happens if he misses a whole week of pills" genuinely wants
// the missed-dose page) and forcing sym-severe to the top of all 50 would wreck the search box for
// everyone else. Raise this number only by improving the corpus, never by editing the questions.
const CLINICAL = [
  "he keeps throwing up after every meal what do i do", "her feet are swelling up is that from the chemo",
  "the nurse said watch for infection what should i look for", "he has a sore mouth and cant eat anything",
  "how do i stop the nausea", "what helps with the mouth sores",
  "she cant sleep since starting treatment", "his hands are numb and tingly",
  "her white count is low what does that mean", "what does neutropenic mean",
  "he has a nosebleed that wont stop", "she fell this morning should she be seen",
  "hes been sleeping 20 hours a day", "the injection site is red and hot",
  "her port is leaking", "when will his hair grow back",
  "how long until the chemo starts working", "does radiation burn the skin",
  "what cream can i put on the radiation burn", "he has a headache can he take anything for it",
  "she is constipated from the painkillers", "her lips are turning blue",
  "he is confused and not making sense", "she has been running a low grade temp for two days",
  "he is shivering and his teeth are chattering", "she is bleeding from her gums",
  "how much water should he drink", "his appetite is gone completely",
  "her heart is racing", "he has a fever of 103 what do i do",
  "she threw up her pill right after taking it", "what do i do about the diarrhea",
  "when should i call the on call number", "can he drink alcohol on chemo",
  "is it safe to be around the grandkids", "does he need a mask in public",
  "can she get the flu shot during chemo", "how do i know if its an infection",
  "his stool is black", "she has a lump under her arm",
  "what are the signs of dehydration", "should we go to the er",
  "he wont eat or drink anything today", "her chemo brain is getting worse is that permanent",
  "how long does chemo stay in the body", "what happens if he misses a whole week of pills",
  "she is coughing up blood", "the pharmacist gave a different colour tablet is it the same drug",
  "his temperature keeps going up and down all day", "can i give her the tablet with her heart medicine"
];
const CARE_LEAD = new Set(A.HELP_TOPICS.filter(x => x.careLead).map(x => x.id));
// V57-2 (Auditor, Medium), both halves of it.
//
// (a) The first version of this read the top EIGHT while the Auditor measured that only FOUR rows
//     fit above the fold at 360px -- so it scored a slice the person cannot see. Measured across
//     depths: top 3 -> 17/50, top 4 -> 20/50, top 5 -> 20/50, top 8 -> 23/50. It now reads 4, and
//     the floor is what 4 actually is.
// (b) A set-based check could not see WHICH page carried the flag, so dropping careLead from
//     sym-severe -- the emergency page, the whole point of the metric -- still printed ALL GREEN.
//     That page is now pinned by id, separately, before the count is taken.
const VISIBLE_ROWS = 4;
t('sym-severe is still flagged careLead (the emergency page the coverage metric exists for)',
  CARE_LEAD.has('sym-severe'), [...CARE_LEAD].join(', '));
t('the corpus still carries at least one careLead page', CARE_LEAD.size > 0, [...CARE_LEAD].join(', '));
let careSurfaced = 0, noResults = 0;
CLINICAL.forEach(q => {
  const r = A.helpSearch(q).slice(0, VISIBLE_ROWS).map(x => x.id);
  if (!r.length) noResults++;
  if (r.some(id => CARE_LEAD.has(id))) careSurfaced++;
});
t('a "contact your care team" page is in the ' + VISIBLE_ROWS + ' rows a phone actually shows, for at least 18 of the 50 clinical questions',
  careSurfaced >= 18, careSurfaced + '/50 surfaced in the top ' + VISIBLE_ROWS + ', ' + noResults + ' returned nothing');

// ---------- the unconditional care-team strip is the actual V57-1 fix ----------
// The metric above is a quality floor, not the safety property. The safety property is that the
// care-team sentence and a one-tap route to sym-severe are on the results screen NO MATTER WHAT the
// ranking does -- because "she collapsed" ranks a real keyword hit on `collapsed` and nothing in a
// scorer will ever catch that. Asserted here at source level; the rendered version is driven in
// test/v57-browser-notice.mjs.
{
  const searchScreen = (html.match(/\/\/ ---- Search results ----[\s\S]*?^  \}$/m) || [''])[0];
  // R2-A (Auditor, round 2): this line used to also claim it proved the strip was UNCONDITIONAL, via
  // `!/\?[\s\S]{0,120}.../`. He wrapped the strip in a ternary and the suite stayed green -- the `?`
  // sat ~200 characters back, past the style object -- and then wrote the same gate with `&&`, which
  // the regex never looked for at all. A regex cannot see control flow. The claim is deleted rather
  // than patched: the UNCONDITIONAL property is proved in test/v57-browser-notice.mjs, which types
  // four queries into the real UI (including `export to excel`, the high-coverage query any
  // coverage-based gate would suppress) and requires the sentence and the route on every one. What
  // survives here is only that the sentence exists in this screen's source at all.
  // app-v66: this pinned the sentence VERBATIM. app-v58 reworded it -- "...holds no medical
  // information AND CAN'T TELL YOU WHETHER SOMETHING IS SERIOUS. For anything about..." -- and this
  // gate went red on 2026-08-20 and STAYED red through app-v58, v59, v60, v61, v62, v63, v64 and
  // v65. Eight releases shipped past a failing safety check because it was failing for a reason
  // nobody read. Pinning a literal is the same mistake that has already cost this project three
  // patches; this time it was wearing a safety label, which is what made it dangerous.
  // The property worth asserting is that the screen still disclaims medical authority AND names the
  // care team. The exact phrasing is copy, and copy is allowed to change.
  t('V57-1 the results screen source carries the care-team sentence',
    /holds no medical information/.test(searchScreen) && /contact the care team/.test(searchScreen),
    searchScreen ? 'found, ' + searchScreen.length + ' chars' : '(search screen block not found)');
  t('V57-1 the strip routes to sym-severe in one tap',
    /helpGo\(\{ topic: 'sym-severe' \}\)/.test(searchScreen));
  t('V57-1 the results list is capped and the true total is still reported',
    /searchRes\.total > searchRes\.shown/.test(searchScreen) && /The closest /.test(searchScreen));
}

// ---------- the floor and the cap ----------
// Measured, not guessed. "she is coughing up blood" returned 66 rows before the floor.
{
  const wide = A.helpSearchFull('she is coughing up blood');
  t('the relevance floor cuts the long tail (was 66 rows)', wide.total < 30, wide.total + ' survive the floor');
  t('the cap holds the shown list to 12', wide.shown <= 12, wide.shown + ' shown');
  const ordinary = A.helpSearchFull('export to excel');
  t('the floor does not touch a query the corpus genuinely answers',
    ordinary.hits.length > 0 && ordinary.hits[0].id === 'exp-csv', ordinary.total + ' results, first ' + (ordinary.hits[0] || {}).id);
}

// ---------- performance ----------
const t0 = Date.now();
for (let i = 0; i < 200; i++) A.helpSearch(FIXTURE[i % FIXTURE.length][0]);
const per = (Date.now() - t0) / 200;
t('a query resolves in under 25ms on this machine', per < 25, per.toFixed(2) + ' ms/query');

// ---------- search-box behaviour ----------
const s1 = A.helpSearch('greyed out daily limit');
t('Help search finds the daily-limit topic', s1.length > 0 && s1[0].id === 'med-daily-limit-locked', s1.slice(0, 2).map(x => x.id).join(', '));
t('Help search returns a broad set for a broad word', A.helpSearch('reminder').length > 4, A.helpSearch('reminder').length + ' results');
t('Help search returns [] for an empty query', A.helpSearch('   ').length === 0);
// LA-2 (v56): "help" typed into a box headed *Search help* returned "Nothing matched that", because
// the search box shared the bot's stopword list -- where `help` existed so a chat box answered a
// bare "help" with a greeting rather than the emergency-symptom page. HELP_STOP_SEARCH is the
// reduced list; with the bot gone this is now the ONLY consumer, so the reason it differs from
// HELP_STOP is recorded here as well as at the declaration.
t('LA-2 searching "help" in the Help view returns results', A.helpSearch('help').length > 0,
  A.helpSearch('help').length + ' results');
// Regression: every topic must still be findable by its own title, which is how the v55 audit
// checked the old search and is the one property a scoring rewrite could silently break.
let unfindable = [];
A.HELP_TOPICS.forEach(topic => {
  const r = A.helpSearch(topic.q);
  if (!r.length || r[0].id !== topic.id) unfindable.push(topic.id + ' -> ' + (r[0] ? r[0].id : 'none'));
});
t('every topic is still found first by its own question text', unfindable.length === 0,
  unfindable.length + ' not first: ' + unfindable.slice(0, 5).join(', '));

// app-v66. The British spelling is not decoration in a keyword array -- it is the only thing that
// catches a user who TYPES it, and it is asserted on the RANKED OUTPUT rather than on a string's
// presence in the file, because a source check cannot tell a working alias from a decorative one.
//
// WHAT THIS PARAGRAPH USED TO SAY, AND WHY IT WAS DELETED: it claimed app-v65 made the topic score
// ZERO for "litres" and that helpFuzzy could not bridge the gap. That is FALSE, it was retracted in
// the round-1 commit message, and it survived here anyway -- eight lines above its own correction --
// until a second audit caught it. Measured twice, by two different readers: with the alias removed,
// proc-para still comes back and still comes back FIRST, at 0.65 via a fuzzy transposition.
// A correction that lives only in a commit message is not a correction. Nobody reads those; they
// read the file. This is the same failure as the V57-1 gate that sat red for nine releases.
// FIRST DRAFT OF THIS CHECK WAS WORTHLESS, and the record is more useful than the fix. It asserted
// helpSearch('litres')[0] === 'proc-para' -- which PASSED on app-v65, the very build it was written
// to indict. app-v65 was never broken: the vocabulary holds the unstemmed 'liters' as well as the
// stem, and helpFuzzy() bridges litres->liters as a single transposition inside its 1-edit budget.
// The topic was found either way. So the check could not fail, and a check that cannot fail is
// worse than no check at all (Rule 5).
//
// What actually differs is the QUALITY of the match, and that is worth locking. Without the alias
// the term is a 0.65 fuzzy guess that also drags faq:weight-reason into the results; with it, the
// term is a 1.0 exact keyword hit that returns the one right topic. Relying on a coincidence of the
// stemmer is the fragile part -- rename a keyword and the coincidence evaporates silently.
// ---- the spelling gate, moved here in app-v66 round 2 ----
// It used to live in test/v59-para.mjs and assert against the RAW BYTES, finding keyword arrays with
// /keywords:\s*\[[^\]]*\]/g. The Zero Day Auditor defeated it: writing the literal text
// "keywords: [" into Help COPY opens a region that regex treats as a safe keyword array, so a build
// with the alias DELETED and a visible "Litres" in a Help answer passed 16/16. A regex cannot tell a
// keyword array from prose shaped like one. This suite already parses HELP_TOPICS into a VM, so here
// the actual objects can be walked -- which is not defeatable by anything written inside a string.
const displayedText = (tp) => [tp.q, tp.a, tp.note]
  .concat(tp.steps || [])
  .concat((tp.branches || []).flatMap(br => [br.when].concat(br.steps || [])))
  .filter(v => typeof v === 'string');
const corpus = A.HELP_TOPICS.concat(A.FAQ_ITEMS || []);
const litreVisible = corpus.filter(tp => displayedText(tp).some(v => /litre/i.test(v))).map(tp => tp.id);
const litreKeyed = corpus.filter(tp => (tp.keywords || []).some(k => /litre/i.test(k))).map(tp => tp.id);
t('app-v66 no Help topic shows the British spelling anywhere a reader can see it',
  litreVisible.length === 0, litreVisible.join(', ') || 'none — correct');
t('app-v66 the paracentesis topic still carries it as an invisible search keyword',
  litreKeyed.includes('proc-para'), litreKeyed.join(', ') || 'NONE — the alias is gone');

// COVERAGE HOLE FOUND WHILE FALSIFYING THE ABOVE, and closed here rather than shipped.
// The two checks above walk the Help corpus, so they catch nothing outside it -- and the ten strings
// app-v65 actually fixed were mostly NOT in Help: the paracentesis input placeholder, the validation
// toast, the Reports empty state, the Settings toggle description. Falsifying with a visible
// "Litres drained" placeholder passed both checks above. Replacing a raw-bytes check with a parsed
// one narrowed the blast radius without anyone noticing, which is the same class of mistake as the
// gate this release replaces.
//
// So: cross-check the two counts. Every occurrence of the British spelling in the shipped bytes must
// be accounted for by an occurrence in a PARSED keywords array. Prose containing it raises the raw
// count without raising the parsed one, so it cannot be hidden inside a string that merely looks
// like a keyword array -- which is precisely how the old gate was defeated.
// codeOnly(): comments are stripped first. That helper's own header records THREE false positives
// across two releases from a comment mentioning the token its assertion forbade, and this check
// walked straight into a fourth -- a source comment saying "litres" made it red for no defect.
const rawLitre = (codeOnly(html).match(/litre/gi) || []).length;
const keyedLitre = corpus.reduce((n, tp) => n + (tp.keywords || []).filter(k => /litre/i.test(k)).length, 0);
t('app-v66 every "litre" in the shipped bytes is accounted for by a parsed search keyword',
  rawLitre === keyedLitre,
  rawLitre + ' in the file, ' + keyedLitre + ' in parsed keyword arrays');

const litresTerms = A.helpTerms('litres');
t('app-v66 "litres" is an EXACT keyword hit, not a 0.65 fuzzy coincidence',
  litresTerms.length === 1 && litresTerms[0].quality === 1,
  JSON.stringify(litresTerms));
t('app-v66 and it still resolves to the paracentesis topic, alone',
  JSON.stringify(A.helpSearch('litres').map(x => x.id)) === JSON.stringify(['proc-para']),
  'litres -> ' + (A.helpSearch('litres').map(x => x.id).join(', ') || 'NOTHING'));
t('app-v66 the American spelling is unchanged by the alias',
  A.helpSearch('liters')[0] && A.helpSearch('liters')[0].id === 'proc-para',
  'liters -> ' + (A.helpSearch('liters').slice(0, 3).map(x => x.id).join(', ') || 'NOTHING'));

console.log('\n' + exact + '/' + FIXTURE.length + ' exact, ' + top3 + ' recovered in top 3, ' + missed.length + ' missed');
console.log(fail === 0 ? 'ALL GREEN' : '\n' + fail + ' FAILURES');
process.exit(fail ? 1 : 0);
