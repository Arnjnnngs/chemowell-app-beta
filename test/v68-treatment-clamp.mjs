// app-v68 (PM findings): the treatment window the app OBEYS must be the one it SHOWS, and a window
// stored as text must survive.
//
// Three places used to answer "how big is this window?" and disagreed. clampTreatmentDays had no
// upper bound, so a medication saved with 300 days printed the chip "Treatment day -300/+300" while
// the only code that evaluated the window capped it at 14 -- the number on screen was not the number
// the app obeyed. Separately, normalizeMedication tested Number.isFinite() on values that arrive from
// a TEXT input, so a window saved as the string "3" collapsed back to 1 the next time any medication
// was normalized: upstream of every read site, so no read-site fix could reach it.
//
// Run: env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy node test/v68-treatment-clamp.mjs
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
  throw new Error('unbalanced function: ' + name);
}
function decl(re) { const m = html.match(re); if (!m) throw new Error('declaration not found: ' + re); return m[0]; }

const DAY = 86400000;
const ctx = { state: { entries: [], meds: [], chemoDates: [], dismissedMisses: [] }, console };
vm.createContext(ctx);
vm.runInContext([
  fn('treatmentDaysMax'),
  fn('clampTreatmentDays'), fn('dayStart'), fn('nextDay'), fn('entriesFor'),
  fn('nextChemoTs'), fn('chemoDayList'), fn('chemoOffsetFor'), fn('treatmentActiveOn'),
  'globalThis.__api = { clampTreatmentDays, treatmentActiveOn, dayStart, treatmentDaysMax };'
].join('\n'), ctx);
const { clampTreatmentDays, treatmentActiveOn, dayStart, treatmentDaysMax } = ctx.__api;
const TREATMENT_DAYS_MAX = treatmentDaysMax();

let pass = 0, fail = 0;
function is(label, got, want) {
  const ok = Object.is(got, want);
  if (ok) { pass++; console.log('  PASS  ' + label); }
  else { fail++; console.log('  FAIL  ' + label + '\n          got ' + JSON.stringify(got) + ', want ' + JSON.stringify(want)); }
}

console.log('\n1. clampTreatmentDays — one rule, bounded, and it coerces text');
is('blank falls back to 1, not 0', clampTreatmentDays(''), 1);
is('whitespace falls back to 1', clampTreatmentDays('   '), 1);
is('null falls back to 1', clampTreatmentDays(null), 1);
is('undefined falls back to 1', clampTreatmentDays(undefined), 1);
is('garbage falls back to 1', clampTreatmentDays('abc'), 1);
is('negative falls back to 1', clampTreatmentDays(-5), 1);
is('a deliberate 0 is kept (treatment day itself only)', clampTreatmentDays(0), 0);
is('the STRING "0" is kept as 0', clampTreatmentDays('0'), 0);
is('the STRING "3" is 3, not 1', clampTreatmentDays('3'), 3);
is('the number 3 is 3', clampTreatmentDays(3), 3);
is('3.6 rounds to 4', clampTreatmentDays(3.6), 4);
is('the maximum itself is kept', clampTreatmentDays(TREATMENT_DAYS_MAX), TREATMENT_DAYS_MAX);
is('one over the maximum is clamped', clampTreatmentDays(TREATMENT_DAYS_MAX + 1), TREATMENT_DAYS_MAX);
is('300 is clamped, not stored as 300', clampTreatmentDays(300), TREATMENT_DAYS_MAX);
is('the STRING "300" is clamped too', clampTreatmentDays('300'), TREATMENT_DAYS_MAX);

console.log('\n2. The chip and the behaviour cannot disagree');
// One treatment date. The chip prints clampTreatmentDays(med.treatmentDaysBefore); the app obeys
// treatmentActiveOn. Ask both about the same medication and require the same answer.
const T = new Date(2026, 7, 20).getTime();
ctx.state.chemoDates = [{ ts: T, loggedAt: T }];
const wild = { treatmentDaysBefore: 300, treatmentDaysAfter: 300 };
const shown = clampTreatmentDays(wild.treatmentDaysBefore);
is('the chip shows the clamped number, not 300', shown, TREATMENT_DAYS_MAX);
is('active exactly at the edge the chip promises', treatmentActiveOn(wild, T - shown * DAY), true);
is('NOT active one day beyond what the chip promises', treatmentActiveOn(wild, T - (shown + 1) * DAY), false);
is('not active 20 days out, which "300" would have claimed', treatmentActiveOn(wild, T - 20 * DAY), false);

console.log('\n3. A window saved as text is obeyed as written');
const asText = { treatmentDaysBefore: '3', treatmentDaysAfter: '0' };
is('3 days before, from the string "3"', treatmentActiveOn(asText, T - 3 * DAY), true);
is('4 days before is outside it', treatmentActiveOn(asText, T - 4 * DAY), false);
is('the string "0" after means treatment day is the last day', treatmentActiveOn(asText, T), true);
is('the day after is outside a "0" after-window', treatmentActiveOn(asText, T + DAY), false);

console.log('\n4. normalizeMedication does not collapse a text window upstream');
// This is the one that made every read-site fix pointless: normalization runs over every saved
// medication, so a string window was rewritten to 1 before any read site ever saw it.
const normSrc = fn('normalizeMedication');
const bMatch = normSrc.match(/treatmentDaysBefore:\s*([^\n,]+),/);
const aMatch = normSrc.match(/treatmentDaysAfter:\s*([^\n,]+),/);
is('normalizeMedication routes "days before" through the shared clamp',
  !!(bMatch && /clampTreatmentDays\(/.test(bMatch[1])), true);
is('normalizeMedication routes "days after" through the shared clamp',
  !!(aMatch && /clampTreatmentDays\(/.test(aMatch[1])), true);
is('no Number.isFinite test left on either treatment-day field in normalizeMedication',
  /treatmentDays(Before|After):\s*Number\.isFinite/.test(normSrc), false);

console.log('\n5. Nobody keeps a private copy of the rule');
// The bug was three implementations, not one wrong one. Any second bound in the file is a second
// answer waiting to drift from this one.
const bodyOnly = html.slice(html.indexOf('<script type="module">'));
const privateBounds = (bodyOnly.match(/Math\.min\(\s*14\s*,/g) || []).length;
is('no hardcoded 14-day bound outside the shared clamp', privateBounds, 0);
is('treatmentActiveOn calls the shared clamp', /clampTreatmentDays\(/.test(fn('treatmentActiveOn')), true);

console.log('\n' + (fail ? 'FAILED' : 'OK') + '  PASS ' + pass + '  FAIL ' + fail);
process.exit(fail ? 1 : 0);
