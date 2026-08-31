// REMOVING ONE TREATMENT DATE, LEAVING THE OTHERS ALONE.
//
// Until now Clear was all-or-nothing, so correcting a single mistyped date meant wiping the whole
// schedule and typing it back in. v69 made Help honest about that; this is the fix.
//
// WHAT THIS SUITE IS REALLY GUARDING. The store is append-only and a backup can be restored into an
// OLDER build. A "remove one day" entry of a new shape -- a negative ts, say -- would be read by an
// older build as a date to ADD, and dayStart(-X) lands in 1970: exactly the "Zofran blocked until
// 1 Jan 1970" defect this project already shipped. So the removal is built from the two forms that
// already exist, and these checks pin that: no new entry shape, and chemoDayList() unchanged.
//
// Run: env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy node test/v70-remove-one-date.mjs
import fs from 'node:fs';
import vm from 'node:vm';

const FILE = process.argv.includes('--file')
  ? process.argv[process.argv.indexOf('--file') + 1]
  : new URL('../index.html', import.meta.url).pathname;
const html = fs.readFileSync(FILE, 'utf8');
function fn(name) {
  // KEEPS THE `async`. The extractor used across this project searches for "function <name>(" and
  // so silently drops a preceding `async`, producing a body with `await` in a non-async function --
  // a SyntaxError inside the sandbox rather than a failed assertion. The suite dies instead of
  // reporting, which is the same class as a gate that cannot start.
  let i = html.indexOf('async function ' + name + '(');
  if (i < 0) i = html.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  const from = html.indexOf('{', html.indexOf(')', i));
  let d = 0;
  for (let k = from; k < html.length; k++) {
    if (html[k] === '{') d++;
    else if (html[k] === '}') { d--; if (d === 0) return html.slice(i, k + 1); }
  }
  throw new Error('unbalanced: ' + name);
}

let pass = 0, fail = 0;
function t(label, ok, detail) {
  if (ok) { pass++; console.log('  PASS  ' + label + (detail ? '  |  ' + detail : '')); }
  else { fail++; console.log('  FAIL  ' + label + (detail ? '  |  ' + detail : '')); }
}
const D = (m, d) => new Date(2026, m - 1, d).getTime();

// A sandbox with a real append-only store, so removal is exercised the way the app does it.
const ctx = { state: { entries: [], meds: [], chemoDates: [] }, console, toasts: [] };
ctx.setToast = (m) => ctx.toasts.push(m);
ctx.addEntryDB = async (e) => { ctx.state.chemoDates.push({ ...e }); };
vm.createContext(ctx);
vm.runInContext([
  fn('dayStart'), fn('nextDay'), fn('entriesFor'), fn('nextChemoTs'), fn('chemoDayList'),
  fn('removeChemoDate'),
  'globalThis.__api = { chemoDayList, removeChemoDate, dayStart };'
].join('\n'), ctx);
const { chemoDayList, removeChemoDate, dayStart } = ctx.__api;

const seed = (...days) => {
  ctx.state.chemoDates = days.map((d, i) => ({ medId: 'chemo_date', ts: d, loggedAt: i + 1 }));
};
const shown = () => chemoDayList().map(d => new Date(d).getDate()).join(',');

console.log('\n1. The wrong date goes, the right ones stay');
seed(D(8, 20), D(8, 24), D(8, 31));
await removeChemoDate(D(8, 20));
t('the removed date is gone', chemoDayList().indexOf(dayStart(D(8, 20))) < 0, shown());
t('the other two survive, in order', shown() === '24,31', shown());

console.log('\n2. It survives being done twice, and to the last one');
await removeChemoDate(D(8, 24));
t('a second removal works on the rebuilt list', shown() === '31', shown());
await removeChemoDate(D(8, 31));
t('removing the last date leaves nothing', chemoDayList().length === 0, shown() || '(none)');

console.log('\n3. Removing a date that is not there changes nothing');
seed(D(9, 3), D(9, 10));
const before = shown();
await removeChemoDate(D(7, 1));
t('the schedule is untouched', shown() === before, before + ' -> ' + shown());

console.log('\n4. A date set AFTER a removal still works');
seed(D(9, 3), D(9, 10));
await removeChemoDate(D(9, 3));
ctx.state.chemoDates.push({ medId: 'chemo_date', ts: D(9, 17), loggedAt: Date.now() + 9999 });
t('the new date joins the survivors', shown() === '10,17', shown());

console.log('\n5. No new kind of entry was invented');
// The whole safety argument rests on this: an older build must read these entries correctly.
const written = ctx.state.chemoDates;
t('every entry is a real timestamp or the existing tombstone',
  written.every(e => e.ts === 0 || e.ts > 0), JSON.stringify(written.map(e => e.ts).slice(0, 6)));
t('no negative timestamp anywhere — that is what lands in 1970',
  !written.some(e => e.ts < 0), '');
const src = fn('removeChemoDate');
t('removal writes only the two doses the app already used',
  /'Treatment date removed'|'Treatment scheduled'/.test(src) && !/medId: '(?!chemo_date)/.test(src), '');
t('chemoDayList still treats only a falsy ts as a tombstone',
  /if \(!e\.ts\) \{ days = \[\]; return; \}/.test(fn('chemoDayList')), '');

console.log('\n6. Ordering is explicit, because ties would clear what they meant to keep');
seed(D(8, 20), D(8, 24));
await removeChemoDate(D(8, 20));
const ordered = ctx.state.chemoDates.map(e => e.loggedAt);
t('every entry has a loggedAt', ordered.every(x => typeof x === 'number'), '');
t('the re-adds land strictly after the tombstone',
  ordered.slice(-2).every((x, i, a) => i === 0 || a[i - 1] < x), ordered.slice(-2).join(' < '));
// Deliberately NOT asserting the re-adds differ from each other: they are all adds, and
// chemoDayList dedupes and sorts, so their order among themselves cannot change the schedule.
// Falsifying that showed it -- collapsing them to one value left this suite green, so the code
// no longer bothers.

console.log('\n' + pass + '/' + (pass + fail) + ' checks passed');
process.exit(fail ? 1 : 0);
