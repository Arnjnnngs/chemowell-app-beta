#!/usr/bin/env python3
"""app-v81 round 4 -- the dose parser disagrees with the dose it prints, by ten times.

FOUND BY THE RESEARCH SEAT and re-measured here against the shipping build rather than taken on
trust. `parseDoseOptions` run over real dose strings:

    ".5 mg"        ->  { label: ".5 mg",       mg: 5,     pills: 5   }   <-- TEN TIMES
    "1/2 tablet"   ->  { label: "1/2 tablet",              pills: 1   }   <-- TWICE
    "5,000 units"  ->  [ { label: "5" }, { label: "000 units" } ]
    "1.0 mg"       ->  { label: "1.0 mg",      mg: 1,     pills: 1   }

WHAT EACH ONE COSTS A CAREGIVER.

`.5 mg` -- the number regex is /(\\d+(?:\\.\\d+)?)/ and it cannot match a leading dot, so it matches
the 5. The card prints ".5 mg" and every dose logged from it counts FIVE milligrams toward the daily
limit. The printed dose and the counted dose differ by a factor of ten with nothing on screen saying
so, and the acetaminophen ceiling is then reached after a tenth of the medicine it should take.
**This is the naked decimal the ISMP list exists to warn about, and the app currently agrees with
the misreading.**

`1/2 tablet` -- takes the 1 and ignores the /2, so a half counts as a whole. This one errs in the
DANGEROUS direction on a pill ceiling: a limit of four is reached after eight halves, and the app
says three are left.

`5,000 units` -- Dosage options is comma-separated, so a thousands separator splits one dose into
two: a "5" button and a "000 units" button. That is how an insulin or heparin dose is normally
written.

`1.0 mg` -- arithmetically right, and a trailing zero after a decimal point is on the same ISMP list
for the same reason: "1.0" read as "10".

WHAT THIS FIX DOES NOT DO. It does not add a single unit to the picker. `500 mcg` still counts as
`pills: 500` because milligrams, micrograms and millilitres need a place in the stored entry and
that is a storage change, reported separately. The research seat used its stop-power in writing to
say the unit list must not widen before this lands -- adding `mcg` to a picker while `.5 mg` parses
as 5 mg widens the surface of a live ten-fold error. This is that item, on its own, first.

THE LABEL IS NORMALISED, AND THAT IS A DELIBERATE EXCEPTION TO "WHAT THE USER TYPED WINS".
Everywhere else in this app the caregiver's own words are never overwritten. A dose is different: a
naked decimal and a trailing zero are error-prone DESIGNATIONS, and a pharmacy system rewrites them
rather than displaying them. ".5 mg" is shown and stored as "0.5 mg"; "1.0 mg" as "1 mg". The
number is never changed -- only how it is written.
"""
import sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent
HTML = ROOT / 'index.html'

def die(msg):
    print('PATCH FAILED: ' + msg); sys.exit(1)

src = HTML.read_text(encoding='utf-8')
if 'normaliseDoseNumber' in src:
    die('already applied')
if "const APP_VERSION = 'app-v81'" not in src:
    die('app-v81 has not been built -- run the v81 scripts first')

OLD = """function parseDoseOptions(text) {
  return String(text || '').split(',').map(value => value.trim()).filter(Boolean).map(label => {"""

NEW = """// ONE PLACE DECIDES WHAT A WRITTEN AMOUNT MEANS, so the number printed on the card and the number
// counted toward the daily limit can never disagree again. They disagreed by a factor of ten.
//   * A NAKED DECIMAL gets its leading zero. ".5" is 0.5, not 5, and it is shown as "0.5" because
//     that is what the ISMP error-prone list asks for -- a dot alone is the single most misread
//     mark in a written dose.
//   * A TRAILING ZERO after a decimal point is dropped: "1.0" is shown as "1", for the mirror
//     reason -- "1.0" read as "10".
//   * A VULGAR FRACTION is a number. "1/2 tablet" and "½ tab" are half a tablet, and the old parser
//     read both as one whole -- which errs in the dangerous direction on a pill ceiling.
// The VALUE is never altered: only the way it is written, and only where the way it is written is
// on a published list of things that get misread.
const DOSE_FRACTIONS = { '\\u00bd': 0.5, '\\u00bc': 0.25, '\\u00be': 0.75, '\\u2153': 1 / 3, '\\u2154': 2 / 3 };
function normaliseDoseNumber(label) {
  let out = String(label == null ? '' : label);
  const round3 = (n) => String(Math.round(n * 1000) / 1000);
  // A MIXED NUMBER FIRST, because "1 1/2 tablets" is one amount and not two. Taking the fractions
  // first turned it into the string "1 0.5 tablets", whose leading number is 1 -- the same
  // under-count as the bug this is fixing, reintroduced by the fix. Measured, not reasoned about.
  out = out.replace(/(?<![\\d.])(\\d+)\\s+(\\d+)\\s*\\/\\s*(\\d+)(?![\\d.])/g, (whole, w, a, b) => {
    const d = Number(b);
    if (!d) return whole;
    return round3(Number(w) + Number(a) / d);
  });
  // Then a plain fraction: "1/2" and "3/4" -> a decimal the rest of the app can add up.
  out = out.replace(/(?<![\\d.])(\\d+)\\s*\\/\\s*(\\d+)(?![\\d.])/g, (whole, a, b) => {
    const d = Number(b);
    if (!d) return whole;
    return round3(Number(a) / d);
  });
  // A single-character fraction, alone or after a whole number: "1\\u00bd" and a bare "\\u00bd".
  out = out.replace(/(\\d*)\\s*([\\u00bd\\u00bc\\u00be\\u2153\\u2154])/g, (whole, lead, ch) =>
    round3((lead ? Number(lead) : 0) + DOSE_FRACTIONS[ch]));
  // The leading zero, and the trailing zero. Both are on the ISMP list and both are about how the
  // number is WRITTEN -- neither changes what it is worth.
  out = out.replace(/(^|[^\\d.])\\.(\\d)/g, '$10.$2');
  out = out.replace(/(\\d+\\.\\d*?)0+(?![\\d])/g, '$1');
  out = out.replace(/(\\d+)\\.(?![\\d])/g, '$1');
  return out;
}
// A COMMA BETWEEN TWO DIGITS IS A THOUSANDS SEPARATOR, NOT A SEPARATOR BETWEEN DOSES. Splitting on
// it turned "5,000 units" -- the ordinary way an insulin or heparin dose is written -- into a "5"
// button and a "000 units" button. Commas anywhere else still separate the options, so
// "500 mg, 1000 mg" is two doses exactly as before.
function splitDoseOptions(text) {
  return String(text || '').split(/,(?!\\d{3}(?!\\d))|(?<!\\d),/).map(v => v.trim()).filter(Boolean);
}
function parseDoseOptions(text) {
  return splitDoseOptions(text).map(raw => {
    const label = normaliseDoseNumber(raw);
    const countable = label.replace(/(\\d),(?=\\d{3}(?!\\d))/g, '$1');"""

if src.count(OLD) != 1:
    die('parseDoseOptions is not where it was -- nothing written')
src = src.replace(OLD, NEW, 1)

cut_old = """    const numMatch = label.match(/(\\d+(?:\\.\\d+)?)/);
    const dose = { label, mg: mgMatch ? Number(mgMatch[1]) : 0 };
    if (numMatch) dose.pills = Number(numMatch[1]);
    return dose;"""
cut_new = """    // WHAT EACH HALF OF THIS ACTUALLY BUYS, corrected after falsification. Putting the old
    // `/(\\d+(?:\\.\\d+)?)/` back broke nothing measurable, because normaliseDoseNumber above has
    // ALREADY turned ".5 mg" into "0.5 mg" by the time these run -- the normalisation is what fixes
    // the naked decimal, and the leading-dot tolerance here is defence in depth behind it, not the
    // cure. What these two lines really carry is the COMMA: `countable` has the thousands separator
    // stripped, so "5,000 mg" counts 5000. On the old pattern `\\b` let "000 mg" match and a
    // 5,000 mg dose weighed ZERO -- an overdose that raises no warning because the app thinks
    // nothing was taken. The LABEL keeps its comma: that is how the amount is written and the
    // caregiver should see what they typed.
    const numMatch = countable.match(/(\\d*\\.?\\d+)/);
    const dose = { label, mg: mgMatch ? Number(mgMatch[1]) : 0 };
    if (numMatch) dose.pills = Number(numMatch[1]);
    return dose;"""
if src.count(cut_old) != 1:
    die("parseDoseOptions' number match is not where it was -- nothing written")
src = src.replace(cut_old, cut_new, 1)

# The mg match has the same blind spot, and it is the one that feeds the acetaminophen ceiling.
mg_old = """    const mgMatch = label.match(/(\\d+(?:\\.\\d+)?)\\s*mg\\b/i);"""
mg_new = """    const mgMatch = countable.match(/(\\d*\\.?\\d+)\\s*mg\\b/i);"""
if src.count(mg_old) != 1:
    die("parseDoseOptions' mg match is not where it was -- nothing written")
src = src.replace(mg_old, mg_new, 1)

HTML.write_text(src, encoding='utf-8')
print('app-v81 round 4 applied: the printed dose and the counted dose are the same number')
