// NO LIVE STRING IN THE APP MAY CLAIM A HOSPITAL STAY LOCKS LOGGING.
//
// WHY THIS FILE EXISTS. app-v67 changed the rule: a stay no longer blocks logging, it only stops
// dose windows that opened during the stay from being counted as misses. app-v70 set out to delete
// the leftover prose that still said otherwise, claimed three places were fixed, and shipped with
// FIVE. The Zero Day Auditor found the two that were missed, and the worse of them was not in Help
// at all -- it sat on the In-Patient screen itself, directly under the "Active" chip, contradicting
// the Home banner, the FAQ, the welcome tour and its own help icon in the same build.
//
// The reason a careful pass missed them is worth writing down: the fix was driven by grepping for
// one phrasing, "logging pauses". The survivors said "logging is paused" and "logging goes back to
// normal". A grep for the sentence you already fixed will always come back clean.
//
// So this asserts by ABSENCE against the shipped source, over a family of phrasings rather than one
// string, and it names the line it found so the next person does not have to hunt.
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
const lines = src.split('\n');
// Whole-line comments removed. index.html records WHY the old wording went, and this file quotes it
// too; a gate that fires on its own history is a gate somebody deletes. Only leading-// lines are
// dropped, never a trailing //, because that would cut a URL in half.
const codeOnly = lines.filter(l => !/^\s*\/\//.test(l)).join('\n');

let fail = 0;
const t = (name, cond, detail) => {
  console.log((cond ? 'PASS  ' : 'FAIL  ') + name + (detail ? '\n        ' + detail : ''));
  if (!cond) fail++;
};

// THE GROUND TRUTH, checked first. If the app ever really does start locking logging during a stay,
// the prose above stops being wrong and this whole file becomes the thing that is out of date. The
// only place a stay changes anything is missed-dose detection, so pin that: the single caller of
// inpatientCoversMoment must sit inside the missed-dose path, and no Log gate may consult a stay.
const coversCalls = [...codeOnly.matchAll(/inpatientCoversMoment\s*\(/g)].length;
t('inpatientCoversMoment is defined once and called once — a stay still touches exactly one rule',
  coversCalls === 2, coversCalls + ' occurrence(s) (1 definition + 1 call expected)');

// The phrasings that all mean the same wrong thing. Deliberately a family, not a string: the miss
// this file exists for was a grep that matched one wording out of three.
const CLAIMS = [
  /logging (is |was |)paused[^.]{0,40}(stay|in-?patient)/i,
  /(stay|in-?patient)[^.]{0,60}logging (is |was |)paused/i,
  /logging (pauses|stops|is blocked|is locked|is disabled)/i,
  /logging goes back to normal/i,
  /(medications?|doses?|logging)[^.]{0,50}(can(not|'t)? be logged|unloggable)[^.]{0,50}(stay|in-?patient)/i,
  /days? inside a hospital stay (are|is) never flagged/i,
  /restricted[^.]{0,40}(during|while)[^.]{0,20}(a |the |)stay/i
];

// A SENTENCE ABOUT THE PAST IS NOT A CLAIM ABOUT NOW. The `ip-meds-restricted` Help topic
// deliberately tells the reader that it "used to work the other way round" and names the date it
// changed, which is honest and useful and must not be deleted to satisfy a gate. So a match is
// exempt only when the surrounding sentence frames it as history. This is the one escape hatch in
// this file, it is narrow on purpose, and it is falsified below: reinstating a PRESENT-tense claim
// inside that very note still goes red.
// SCOPED TO THE MATCHED SENTENCE, AND JUDGED ON ITS OWN TENSE. The first version of this exemption
// looked 220 characters either side of the match for any history marker, and the auditor's sabotage
// walked straight through it: a PRESENT-tense claim planted a few words after "Fixed 2026-08-26"
// inherited that sentence's exemption and the suite reported all-clear. An escape hatch that can
// swallow the very claim the gate exists for is the hole this release already failed on once.
// A sentence describing the past says so in its own verbs -- "could not be logged while a stay WAS
// active" -- so that is what is tested, inside that sentence only.
const HISTORY = /\b(used to|no longer|before this|previously|was|were|showed|told|had been|has since)\b/i;
// Boundaries are . ? ! AND the double quote that separates one Help step from the next. Splitting
// on the full stop alone let a preceding QUESTION leak its tense forward: "Was the person in
// hospital those days? Log the stay ... days inside a hospital stay are never flagged as missed"
// counted as history because of that "Was", and the sabotage of that exact sentence stayed green.
function sentenceAround(line, at) {
  let start = 0;
  for (const m of line.slice(0, at).matchAll(/[.?!"]\s*/g)) start = m.index + m[0].length;
  const rest = line.slice(at);
  const end = rest.search(/[.?!"]/);
  return line.slice(start, end < 0 ? line.length : at + end + 1);
}

const hits = [];
lines.forEach((line, i) => {
  if (/^\s*\/\//.test(line)) return;
  for (const re of CLAIMS) {
    const m = re.exec(line);
    if (!m) continue;
    if (HISTORY.test(sentenceAround(line, m.index))) continue;
    hits.push((i + 1) + ': ' + line.trim().slice(0, 160));
    break;
  }
});
t('no live string claims a hospital stay pauses, blocks or restricts logging',
  hits.length === 0, hits.join('\n        '));

// And the true statement must actually be present, or "no false claim" is satisfiable by saying
// nothing at all — which would leave a caregiver with no idea what a stay does.
t('the app still explains what a stay DOES change',
  /counted as the hospital|treated as the hospital|not counted as missed|hospital'?.?s, not as misses/i.test(src),
  '');

console.log('\n' + (fail ? fail + ' FAILED' : 'all checks passed'));
process.exit(fail ? 1 : 0);
