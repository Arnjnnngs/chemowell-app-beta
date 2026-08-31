// THE APP AND ITS OWN INSTRUCTIONS MUST AGREE ABOUT TREATMENT DATES.
//
// Found by the seventh Zero Day Audit and confirmed live in published app-v67: Help said "Setting a
// new date replaces the old one", and the app APPENDS. Correct a mistyped 20 Aug to 24 Aug and both
// dates stay in the schedule -- Zofran still blocks on the 21st and 22nd, Dexamethasone is still
// expected on the 19th through the 21st. Someone following the printed instruction believes they
// have fixed a mistake that is still driving their medication rules.
//
// This suite pins the two halves TOGETHER: what the code does, and what Help says about it. Either
// one drifting is a failure, because the defect was never in the behaviour alone -- multiple
// treatment dates are deliberate, a course has several -- it was in the app describing itself wrongly.
//
// Run: env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy node test/v69-treatment-date-help.mjs
import fs from 'node:fs';
import vm from 'node:vm';

const FILE = process.argv.includes('--file')
  ? process.argv[process.argv.indexOf('--file') + 1]
  : new URL('../index.html', import.meta.url).pathname;
const html = fs.readFileSync(FILE, 'utf8');
function fn(name) {
  const i = html.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  const from = html.indexOf('{', html.indexOf(')', i));
  let d = 0;
  for (let k = from; k < html.length; k++) {
    if (html[k] === '{') d++;
    else if (html[k] === '}') { d--; if (d === 0) return html.slice(i, k + 1); }
  }
  throw new Error('unbalanced: ' + name);
}
const ctx = { state: { entries: [], meds: [], chemoDates: [] }, console };
vm.createContext(ctx);
vm.runInContext([
  fn('dayStart'), fn('nextDay'), fn('entriesFor'), fn('nextChemoTs'), fn('chemoDayList'),
  'globalThis.__api = { chemoDayList, dayStart };'
].join('\n'), ctx);
const { chemoDayList, dayStart } = ctx.__api;

let pass = 0, fail = 0;
function t(label, ok, detail) {
  if (ok) { pass++; console.log('  PASS  ' + label + (detail ? '  |  ' + detail : '')); }
  else { fail++; console.log('  FAIL  ' + label + (detail ? '  |  ' + detail : '')); }
}

const D = (y, m, d) => new Date(y, m - 1, d).getTime();

console.log('\n1. What the app actually does with a corrected date');
// The exact scenario from the audit: a date typed wrongly, then the right one set after it.
ctx.state.chemoDates = [
  { ts: D(2026, 8, 20), loggedAt: 1 },
  { ts: D(2026, 8, 24), loggedAt: 2 }
];
let days = chemoDayList();
t('BOTH dates are in the schedule — setting one does not replace the other',
  days.length === 2, days.map(x => new Date(x).toLocaleDateString()).join(' + '));
t('the mistyped date is still there and still counts',
  days.indexOf(dayStart(D(2026, 8, 20))) >= 0, '');

console.log('\n2. Clear removes every date, which is the only way back');
ctx.state.chemoDates = [
  { ts: D(2026, 8, 20), loggedAt: 1 },
  { ts: D(2026, 8, 24), loggedAt: 2 },
  { ts: 0, loggedAt: 3 }
];
t('a clear empties the whole schedule', chemoDayList().length === 0, '');
ctx.state.chemoDates.push({ ts: D(2026, 8, 24), loggedAt: 4 });
days = chemoDayList();
t('and dates set afterwards start from nothing', days.length === 1 && days[0] === dayStart(D(2026, 8, 24)), '');

console.log('\n3. Help describes THAT, and not something else');
// ANCHORED TO THE DEFINITION, not the first mention. `"treat-clear"` appears earlier inside another
// topic's `related: [...]` list, so searching for the bare string extracted 50 characters of the
// wrong topic and reported four failures against an app that was already correct. The same shape as
// this project's `keywords: [` incident, where a literal in ordinary prose fooled a gate.
const topic = (() => {
  const i = html.indexOf('{ id: "treat-clear"');
  if (i < 0) return '';
  const j = html.indexOf('{ id:', i + 10);
  return html.slice(i, j > 0 ? j : i + 1600);
})();
t('the "change or remove the treatment date" topic exists', topic.length > 100, topic.length + ' chars');
t('it does NOT claim a new date replaces the old one',
  !/replaces the old one/i.test(topic), /replaces the old one/i.test(topic) ? 'still claims replacement' : 'claim gone');
t('it says a date is ADDED to the schedule',
  /\bADDED\b/.test(topic), '');
// SEARCHED INSIDE THE STEPS, NOT THE WHOLE TOPIC. The first version of this check read
// /mistyped date keeps working|both stay/ across the entire topic, and the Zero Day Auditor deleted
// the warning STEP outright while it stayed green at 9/9 -- the `both stay` alternative matched the
// answer paragraph above the steps, so the check was really asserting that a different sentence
// existed. An alternation is a check with two ways to pass and only one of them meant.
const steps = (() => {
  const i = topic.indexOf('steps: [');
  if (i < 0) return '';
  return topic.slice(i, topic.indexOf('],', i) + 1);
})();
t('the topic has a steps list to check', steps.length > 100, steps.length + ' chars');
t('one of the STEPS warns that a mistyped date keeps driving the rules',
  /mistyped date (is gone it |)keeps working/i.test(steps), '');
t('it names Clear as clearing EVERY date, not just the wrong one',
  /\*\*every\*\* date/i.test(steps), '');
t('it tells you how to remove ONE date without losing the rest',
  /Tap \*\*Remove\*\* beside/i.test(steps), '');

// THE BUTTON NAMES IN HELP MUST BE THE BUTTON NAMES ON THE CARD. This is the defect the v69 commit
// was itself written to fix and then reintroduced: the topic told the reader to tap **Update**, but
// its own step 3 sends them through Clear first, after which that button reads **Set date**. Nine
// checks passed on a topic that misnamed the button its own instructions land on, because not one
// of them compared Help against the code. Same class as the app-v68 fifth audit.
//
// THIS IS THE THIRD ATTEMPT AT THIS CHECK, and the first two are why it now looks like this.
//   1. A fixed list of names, each checked only IF Help mentioned it. Renaming a button in Help
//      made its check STOP RUNNING and the suite reported 17 of 17.
//   2. Driven off Help's own "tap **X**", compared against a blind 6000-character slice of the
//      file with `card.includes("'" + label + "'")`. The auditor broke it two ways in one sitting:
//      writing "press **Save schedule**" instead of "tap" skipped the extractor entirely (18/18,
//      exit 0, Help now pointing at a button that exists nowhere), and "tap **Paracentesis**"
//      printed, in green, "the card really renders a button called that" -- because the slice ran
//      past the end of this card into another one, and matched a quoted string that is not a
//      button at all. A check that prints a false sentence in green is worse than no check.
// So: bound the card by matching its own parentheses, extract the REAL button labels out of it, and
// compare Help against that set.

// The card's source, bounded by paren matching from the push that creates it -- not a fixed-size
// slice, which ran into the next card and matched its strings.
const card = (() => {
  const anchor = html.indexOf("homePref('showChemoSchedule')) parts.push(");
  if (anchor < 0) return '';
  const from = html.indexOf('(', html.indexOf('parts.push', anchor));
  let d = 0;
  for (let k = from; k < html.length; k++) {
    if (html[k] === '(') d++;
    else if (html[k] === ')') { d--; if (d === 0) return html.slice(from, k + 1); }
  }
  return '';
})();
t('the Treatment schedule card source was located and bounded', card.length > 1000 && card.length < 20000,
  card.length + ' chars');

// THE ACTUAL BUTTON LABELS. For every h('button', ...) inside the card, take the call by paren
// matching and read the strings that come AFTER its props object -- which is where h() puts the
// visible children. That is the difference between "this string appears somewhere near the card"
// and "this string is what a button says".
const cardButtons = (() => {
  const out = new Set();
  let i = 0;
  while ((i = card.indexOf("h('button'", i)) >= 0) {
    const from = card.indexOf('(', i);
    let d = 0, end = -1;
    for (let k = from; k < card.length; k++) {
      if (card[k] === '(') d++;
      else if (card[k] === ')') { d--; if (d === 0) { end = k; break; } }
    }
    if (end < 0) break;
    const call = card.slice(from, end + 1);
    // Children start after the props object closes. Anything before that is styling.
    const afterProps = call.slice(call.lastIndexOf('}') + 1);
    for (const m of afterProps.matchAll(/'((?:[^'\\]|\\.)*)'/g)) {
      const v = m[1].trim();
      if (v) out.add(v);
    }
    i = end;
  }
  return out;
})();
// THE EXTRACTOR IS ITSELF CHECKED, with one name that must be in and one that must be out. Without
// this, an extractor that silently returned nothing would make every comparison below vacuously
// true -- and 'Paracentesis' is the exact string the old blind slice matched as "a button".
t('the button extractor found the card\u2019s buttons', cardButtons.size >= 4,
  [...cardButtons].join(' | ') || 'none found');
t('and it did NOT pick up strings that are not buttons', !cardButtons.has('Paracentesis'),
  [...cardButtons].join(' | '));

// Every button Help tells the reader to press must be one of those. The verb is a family, not the
// single word "tap": switching to "press" was one of the two escapes.
const namedButtons = [...steps.matchAll(/\b(?:tap|press|hit|choose|select|touch)\s+\*\*([^*]+)\*\*/gi)]
  .map(m => m[1].trim());
t('Help names buttons to press at all (the extractor still works)', namedButtons.length >= 4,
  namedButtons.join(', ') || 'none found');
for (const label of namedButtons) {
  t('Help says press **' + label + '** and the card really renders a button called that',
    cardButtons.has(label), 'card buttons: ' + [...cardButtons].join(' | '));
}
// AND THE OTHER DIRECTION. Every bold name in the steps that is not a screen or a tab has to be a
// real button too -- otherwise Help can point at an invented control simply by not using a verb in
// front of it, which is escape A with one more step.
const SCREENS = new Set(['Home', 'Treatment schedule', 'In-Patient', 'Meds', 'Reports', 'Symptoms',
                         'Settings', 'Help & FAQ', 'No date set', 'Days taken']);
const boldNames = [...new Set([...steps.matchAll(/\*\*([^*]+)\*\*/g)].map(m => m[1].trim()))]
  // Bold is also used for plain emphasis -- "this removes **every** date" -- and that is good
  // writing, not a control name. Every button label in this app is capitalised, so a lowercase
  // bold word is emphasis. An invented control ("**Save schedule**") is still capitalised and
  // still caught, which is the case this check exists for.
  .filter(n => !SCREENS.has(n) && /^[A-Z]/.test(n));
for (const label of boldNames) {
  t('every bold control name in the steps is a real button — **' + label + '**',
    cardButtons.has(label), 'card buttons: ' + [...cardButtons].join(' | '));
}
// And the wording that was wrong: Clear does NOT confirm by tapping itself again.
t('Help no longer says Clear confirms by tapping it again',
  !/tap it again to confirm/i.test(steps), '');

console.log('\n' + pass + '/' + (pass + fail) + ' checks passed');
process.exit(fail ? 1 : 0);
