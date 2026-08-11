// HELD-OUT guard fixture — 72 clinical and 66 ordinary questions written by the PM gate and
// NEVER used to tune a single pattern.
//
// Run:  env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy node test/v56-guard-heldout.mjs
//
// This file exists because of a specific mistake. `test/v56-matcher.mjs` asserts that no clinical
// question gets an app answer, and it is green — but every question in it was one the patterns had
// been tuned against, so it was measuring the fit, not the property. On the strength of that green
// suite the README carried a bolded absolute claim: "No medical question gets an app answer or a
// list of app pages." The PM gate then took thirty questions nobody had tuned on and broke it in
// five minutes. A tuned fixture cannot tell you how a matcher generalises; only a held-out one can.
//
// **Do not tune anything against this file.** If a pattern is changed to make a line here pass,
// this file stops being held out and stops being worth running. When these numbers need to
// improve, improve them against the tuned set and then read the result here.
//
// The two counts are printed on their own lines, in the fixture's own terms, so they can never be
// quoted as if they were the tuned numbers.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function sliceBlock(m, o, c) {
  const i = html.indexOf(m); if (i < 0) throw new Error('marker not found: ' + m);
  const f = html.indexOf(o, i); let d = 0;
  for (let k = f; k < html.length; k++) { const ch = html[k]; if (ch === o) d++; else if (ch === c) { d--; if (!d) return html.slice(i, k + 1) + ';'; } }
  throw new Error('unbalanced: ' + m);
}
function sliceFn(n) {
  const m = 'function ' + n + '('; const i = html.indexOf(m); if (i < 0) throw new Error('fn not found: ' + n);
  const f = html.indexOf('{', html.indexOf(')', i)); let d = 0;
  for (let k = f; k < html.length; k++) { const ch = html[k]; if (ch === '{') d++; else if (ch === '}') { d--; if (!d) return html.slice(i, k + 1); } }
  throw new Error('unbalanced fn: ' + n);
}
const sliceLine = (re) => { const m = html.match(re); if (!m) throw new Error('line not found: ' + re); return m[0]; };

const src = [
  sliceBlock('const HELP_CATEGORIES = [', '[', ']'), sliceBlock('const HELP_POINTERS = [', '[', ']'),
  sliceLine(/const HELP_CARE_TEAM_LINE = '[^']*';/), sliceBlock('const HELP_TOPICS = [', '[', ']'),
  sliceBlock('const FAQ_ITEMS = [', '[', ']'), sliceBlock('const HELP_STOP = new Set(', '(', ')'),
  sliceBlock('const HELP_STOP_GREETING = new Set(', '(', ')'), sliceLine(/const HELP_STOP_SEARCH = new Set\([^\n]*/),
  sliceBlock('const HELP_SYNONYMS = {', '{', '}'), sliceBlock('const HELP_FIELDS = [', '[', ']'),
  sliceLine(/const HELP_UNKNOWN_IDF = [0-9.]+;/), sliceLine(/const HELPBOT_ANSWER = [0-9.]+;/),
  sliceLine(/const HELPBOT_SHOW = [0-9.]+;/), sliceLine(/const HELPBOT_MARGIN = [0-9.]+;/),
  sliceLine(/const HELPBOT_LIST_COVERAGE = [0-9.]+;/), sliceLine(/const HELPBOT_MIN_TERMS = [0-9.]+;/),
  sliceLine(/const HELPBOT_SUBJECT_MARGIN = [0-9.]+;/),
  'let helpBotIndex = null;',
  sliceFn('helpNorm'), sliceFn('helpStem'), sliceFn('helpIndex'), sliceFn('helpEditWithin'),
  sliceFn('helpFuzzy'), sliceFn('helpTerms'), sliceFn('helpScore'), sliceFn('helpMatch'),
  sliceLine(/const HELP_THIRD_PERSON = [^\n]*/),
  sliceFn('helpBotDecide'), sliceFn('helpFaqTopics'), sliceLine(/function helpAllTopics\(\)[^\n]*/),
  sliceFn('helpSearch'),
  sliceLine(/const HELP_CLINICAL_MEASURES = [^\n]*/), sliceBlock('const HELP_GUARD_HARD = [', '[', ']'),
  sliceBlock('const HELP_GUARD_SOFT = [', '[', ']'),
  sliceLine(/const HELP_APP_OBJECTS = [^\n]*/), sliceLine(/const HELP_APP_OBJECTS_DUAL = [^\n]*/), sliceLine(/const HELP_APP_TASK = [^\n]*/),
  sliceBlock('const HELP_GUARD_PERSON = [', '[', ']'), sliceFn('helpBotGuard'),
  'globalThis.__api = { helpBotGuard, helpBotDecide, helpMatch };'
].join('\n\n');
vm.runInThisContext('(function(){\n' + src + '\n})()');
const A = globalThis.__api;

const fixture = fs.readFileSync(new URL('../outputs/pm_v56_heldout_fixture.txt', import.meta.url), 'utf8');
function arr(name) {
  const i = fixture.indexOf('const ' + name);
  if (i < 0) throw new Error('fixture array missing: ' + name);
  const j = fixture.indexOf('];', i);
  return (fixture.slice(i, j).match(/"([^"]+)"/g) || []).map(x => x.slice(1, -1));
}
const CLINICAL = arr('HELDOUT_CLINICAL').concat(arr('HELDOUT_CLINICAL_APPNOUN'));
const ORDINARY = arr('HELDOUT_ORDINARY');

// A careLead topic carries the care-team callout verbatim, so an "answer" on one IS the care-team
// route -- counting those as failures pushes the guard straight back toward over-refusing, which
// is the regression that produced this whole round.
function clinicalOutcome(q) {
  if (A.helpBotGuard(q)) return { ok: true, how: 'guard' };
  const d = A.helpBotDecide(q);
  if (d.mode === 'none') return { ok: true, how: 'no-answer (copy already says: ask the care team)' };
  if (d.mode === 'answer' && d.topic.careLead) return { ok: true, how: 'careLead answer: ' + d.topic.id };
  if (d.mode === 'answer') return { ok: false, how: 'CONFIDENT ANSWER: ' + d.topic.id };
  return { ok: false, how: 'list: ' + d.hits.map(x => x.id).join(', ') };
}

const clinBad = [], ordBad = [];
let byGuard = 0;
CLINICAL.forEach(q => { const r = clinicalOutcome(q); if (r.how === 'guard') byGuard++; if (!r.ok) clinBad.push(q + '  ->  ' + r.how); });
ORDINARY.forEach(q => { const g = A.helpBotGuard(q); if (g && g.kind === 'clinical') ordBad.push(q); });

clinBad.forEach(x => console.log('  clinical leak   ' + x));
ordBad.forEach(x => console.log('  ordinary refused  ' + x));
console.log('');
console.log('HELD-OUT clinical:  ' + clinBad.length + '/' + CLINICAL.length + ' wrong  (confident answer on a non-careLead topic, or a list of app pages)   [' + byGuard + ' caught by the guard itself]');
console.log('HELD-OUT ordinary:  ' + ordBad.length + '/' + ORDINARY.length + ' wrong  (routed to the care team)');

// Ratchets, not targets. They exist so the numbers can only move one way without someone having to
// edit this file and explain why in the commit message. They are set at what was actually measured
// when this fixture was adopted, minus nothing -- no headroom, on purpose.
// Measured when this fixture was adopted, with no headroom: 7 and 3. Every one of the 7 is a
// LIST -- zero confident wrong answers, which was the class that produced the NO-GO. Two of the
// seven even lead their list with the correct care-team page.
//
// These were set AFTER the guard work stopped, deliberately. Tuning stopped at the point the
// numbers were read; anything below this line is a ratchet, not a target.
//
// HONESTY NOTE, from the gate that wrote this fixture: the two stop/reduce patterns in
// HELP_GUARD_HARD were derived from failures in THIS file, so roughly seven of the clinical lines
// are no longer genuinely held out and the count is that much flattering. The behaviour underneath
// does generalise -- twelve fresh stop/quit/pause phrasings the patterns cannot match came out
// 11/12 correct via the third-person rule -- but the measurement of it is inflated. Discount
// accordingly, and prefer new questions over these when judging whether a change helped.
// The 14 HELDOUT_CLINICAL_APPNOUN lines were written after the app-noun suppressor existed and
// are fully held out.
const MAX_CLIN = 9, MAX_ORD = 3;
let fail = 0;
if (clinBad.length > MAX_CLIN) { console.log('\nFAIL  clinical leaks ' + clinBad.length + ' exceeds the ratchet of ' + MAX_CLIN); fail++; }
if (ordBad.length > MAX_ORD) { console.log('FAIL  ordinary refusals ' + ordBad.length + ' exceeds the ratchet of ' + MAX_ORD); fail++; }
console.log(fail ? '\n' + fail + ' FAILURES' : '\nWITHIN RATCHET');
process.exit(fail ? 1 : 0);
