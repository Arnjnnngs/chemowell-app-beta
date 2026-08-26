// backfillDefaultMedFlags() in THIS app — and why it is a no-op here today.
//
// Ported from care-tracker v60, where its absence caused three weeks of false Dexamethasone alerts:
// `chemoOnly` was added to DEFAULT_MEDS after a device had saved its own medication list, nothing
// backfilled a new PROPERTY onto an existing saved medication, and normalizeMedication() froze
// "never heard of it" into a permanent false.
//
// THAT CLASS OF DRIFT CANNOT HAPPEN IN THIS APP TODAY, and the reason is worth pinning rather than
// remembering: ChemoWell ships DEFAULT_MEDS EMPTY. It is the generic app — every medication is one
// the user added, so there is no default for a saved medication to drift away from. care-tracker is
// the patient-specific build with a real default list, which is why it was the one that broke.
//
// The function is carried here anyway, and these checks exist so that the day somebody adds a
// default medication to this app, the first check goes RED and whoever did it has to come and read
// this comment instead of rediscovering the care-tracker bug from scratch.
import fs from 'node:fs';
import vm from 'node:vm';

const FILE = process.argv.includes('--file')
  ? process.argv[process.argv.indexOf('--file') + 1]
  : new URL('../index.html', import.meta.url).pathname;
const html = fs.readFileSync(FILE, 'utf8');
function block(marker, open, close) {
  const i = html.indexOf(marker);
  if (i < 0) throw new Error('marker not found: ' + marker);
  const from = html.indexOf(open, i);
  let d = 0;
  for (let k = from; k < html.length; k++) {
    if (html[k] === open) d++;
    else if (html[k] === close) { d--; if (d === 0) return html.slice(i, k + 1) + ';'; }
  }
  throw new Error('unbalanced: ' + marker);
}
function fn(name) {
  const i = html.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  const from = html.indexOf('{', html.indexOf(')', i));
  let d = 0;
  for (let k = from; k < html.length; k++) {
    if (html[k] === '{') d++;
    else if (html[k] === '}') { d--; if (d === 0) return html.slice(i, k + 1); }
  }
  throw new Error('unbalanced function: ' + name);
}
const ctx = { console };
vm.createContext(ctx);
vm.runInContext([
  block('const DEFAULT_MEDS = [', '[', ']'), fn('deepCopyMeds'), fn('backfillDefaultMedFlags'),
  'globalThis.__api = { DEFAULT_MEDS, backfillDefaultMedFlags };'
].join('\n'), ctx);
const A = ctx.__api;

let pass = 0, fail = 0;
const t = (name, cond, detail) => {
  console.log((cond ? '  PASS  ' : '  FAIL  ') + name + (detail ? '  |  ' + detail : ''));
  cond ? pass++ : fail++;
};

t('THIS APP SHIPS NO DEFAULT MEDICATIONS — read the header if this ever goes red',
  A.DEFAULT_MEDS.length === 0,
  A.DEFAULT_MEDS.length + ' default(s): ' + A.DEFAULT_MEDS.map(m => m.id).join(', '));

const med = { id: 'anything', name: 'Anything', alerts: true, windows: [{ start: 8, end: 12 }] };
t('with no defaults, a saved medication passes through completely untouched',
  JSON.stringify(A.backfillDefaultMedFlags(med)) === JSON.stringify(med));
t('a medication with no matching default is left alone',
  A.backfillDefaultMedFlags({ id: 'nope' }).id === 'nope');
t('null and undefined do not throw',
  A.backfillDefaultMedFlags(null) === null && A.backfillDefaultMedFlags(undefined) === undefined);

// The mechanism itself is proven in care-tracker/harness/medflag-backfill-test.mjs against a real
// default list. Proven here: it is inert, so carrying it costs this app nothing.
console.log('\n' + pass + '/' + (pass + fail) + ' checks passed');
process.exit(fail ? 1 : 0);
