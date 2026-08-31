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
t('it warns that a mistyped date keeps driving the rules',
  /mistyped date keeps working|both stay/i.test(topic), '');
t('it names Clear as removing EVERY date, not just the wrong one',
  /removes \*\*every\*\* date/i.test(topic), '');

console.log('\n' + pass + '/' + (pass + fail) + ' checks passed');
process.exit(fail ? 1 : 0);
