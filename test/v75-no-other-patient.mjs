// v75-no-other-patient.mjs -- ChemoWell is a product, not one person's app.
//
// AARON, 2026-09-13, twice in one day and once before that on 2026-08-19:
//   "chemowell should not have any data referring back to Brandi ... There shouldn't be ANY hard
//    coding in this app for Brandi OR medication including treatment or diagnosis"
//   "I want to know why you think that Brandi's name or any medications of hers or caretracker
//    needs to be mentioned or fixed. There may be a bigger issue with this that you're writing for
//    and will cause a lot of future errors, money and bad reviews"
//
// HE IS RIGHT THAT IT IS STRUCTURAL, AND THIS FILE EXISTS BECAUSE A PROMISE IS NOT A FIX.
//
// There WAS already a check for this: test/v58-eod-checkin.mjs asserts the owner's name does not
// appear in index.html. It passed all day today while the medication disclaimer -- the one place
// in the app that gives safety guidance about medication -- read "Follow her care team." It looked
// for a NAME. The leak was never going to be a name; it was going to be a pronoun, a dose from one
// care plan, and a rule keyed to one person's prescription.
//
// So this checks the four shapes the leak actually takes, and the fourth is a RATCHET rather than a
// pass/fail, because the hardcoded scheduling rules are a real refactor (HARDCODED_MEDS_PLAN.md,
// written 2026-08-19, phases 1-5, none done). A gate that is permanently red gets ignored, and a
// gate that ignores the problem is what let this happen twice. A number that can only go down is
// neither.
//
// Run:  node test/v75-no-other-patient.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');

let pass = 0, fail = 0;
const t = (name, cond, detail) => {
  console.log('  ' + (cond ? 'PASS  ' : 'FAIL  ') + name + (detail ? '  |  ' + detail : ''));
  cond ? pass++ : fail++;
};

// The files a user actually receives. Notes, plans and audit reports may discuss the other app --
// that is how the two projects learn from each other -- but nothing here ships.
const SHIPPED = ['index.html', 'sw.js', 'manifest.webmanifest', 'reset.html'];
const files = SHIPPED.filter(f => fs.existsSync(path.join(ROOT, f)))
  .map(f => ({ name: f, raw: fs.readFileSync(path.join(ROOT, f), 'utf8') }));

console.log('\n1. NO NAME, IN ANYTHING A USER RECEIVES');
{
  t('every shipped file was found', files.length === SHIPPED.length,
    files.map(f => f.name).join(', '));
  for (const f of files) {
    // "branding" contains the name; the surrounding characters are what tell them apart.
    const hits = [...f.raw.matchAll(/brandi/gi)]
      .filter(m => !f.raw.slice(Math.max(0, m.index - 12), m.index + 12).toLowerCase().includes('branding'));
    t('no owner name in ' + f.name, hits.length === 0, hits.length + ' occurrence(s)');
  }
}

console.log('\n2. NO PRONOUN THAT DECIDES WHO THE PATIENT IS');
{
  // THE CHECK THAT WOULD HAVE CAUGHT TODAY'S LEAK. Most users are not women and none of them are
  // the person this codebase grew up around, so a user-facing sentence must not pick a gender.
  // Strings are parsed out of the file rather than eyeballed: the leak was one sentence in a
  // 900KB file and it had survived every read.
  const PRONOUN = /\b(her|hers|she|his|him)\b/i;
  for (const f of files) {
    const noLine = f.raw.replace(/^\s*\/\/.*$/gm, '');
    const noBlock = noLine.replace(/\/\*[\s\S]*?\*\//g, '');
    const hits = new Set();
    for (const q of ["'", '"']) {
      const re = new RegExp(q + '((?:[^' + q + '\\\\\\n]|\\\\.){3,600})' + q, 'g');
      let m;
      while ((m = re.exec(noBlock)) !== null) {
        const s = m[1];
        // The Help search's stopword list contains every pronoun on purpose; it is a word list,
        // not a sentence about anyone.
        if (/they them their/.test(s)) continue;
        if (PRONOUN.test(s)) hits.add(s.slice(0, 90));
      }
    }
    t('no gendered pronoun in a user-facing string in ' + f.name, hits.size === 0,
      [...hits].join('  ||  '));
  }
}

console.log('\n3. NO DOSE, CEILING OR SCHEDULE FROM ONE CARE PLAN');
{
  // ceilingMg: 2500 sat here for months. Nothing read it, which is the only reason it was harmless,
  // and "it is unused" is exactly the argument that keeps such a thing alive until something reads
  // it. A number that is one patient's prescription has no business in a shared product.
  for (const f of files) {
    // COMMENTS OFF FIRST. The comment recording that ceilingMg was REMOVED contains the string
    // `ceilingMg: 2500`, so the check reported the very thing it had just been written to confirm
    // was gone -- a false positive that, left in, teaches everyone to ignore this section.
    const code = f.raw.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    const bad = [];
    if (/ceilingMg\s*:\s*\d/.test(code)) bad.push('a default milligram ceiling in CONFIG');
    // A literal daily maximum next to a drug name, which is a prescription.
    for (const m of code.matchAll(/\b(tylenol|acetaminophen|paracetamol|ibuprofen|morphine|oxycodone)\b[^,;\n]{0,40}?\b(\d{3,5})\s*(mg|ml)\b/gi)) {
      bad.push(m[0].slice(0, 60));
    }
    t('no hardcoded dose or ceiling in ' + f.name, bad.length === 0, bad.join(' | '));
  }
}

console.log('\n4. THE RATCHET: BEHAVIOUR KEYED TO ONE PERSON\'S PRESCRIPTION');
{
  // HARDCODED_MEDS_PLAN.md, 2026-08-19, inventories eight behaviours attached to a medication ID
  // instead of to a property the user can set: dexamethasone's chemo-relative windows, a Zofran
  // block for three days after chemo, schedules linked to Protonix, an Iron+Protonix interaction
  // warning, Tylenol and Imodium home counters, a combined Tylenol ceiling, and report totals.
  //
  // The app knows this is unsafe for strangers -- RESERVED_LEGACY_MED_IDS exists solely to stop a
  // user creating a medication that would inherit another patient's regimen. Verified by running
  // the app: a new user typing "Zofran" gets the id `zofran-2` and no rule fires. So it is fenced,
  // not fixed, and the fence is the only thing holding.
  //
  // This does not fail the build today, because ripping out the scheduling engine of a medication
  // app is a real refactor with equivalence testing attached, and a permanently-red gate gets
  // ignored. It PINS the number instead. A new reference fails immediately; removing one requires
  // lowering CEILING, so the count can only ever go down.
  const LEGACY_IDS = ['dexamethasone', 'zofran', 'protonix', 'tylenol', 'tylenol-liquid', 'iron',
    'compazine', 'buspirone', 'paroxetine', 'morphine', 'senokot', 'imodium', 'lidocaine'];
  const html = (files.find(f => f.name === 'index.html') || { raw: '' }).raw;

  // TWO NUMBERS, NOT ONE, SINCE app-v76 PHASE 1. The single count went UP -- 17 to 21 -- when phase 1
  // landed, and the ratchet was right to refuse it: the phase adds resolvers that hold the legacy
  // branch as a fallback, so the ids are still in the file. But they are no longer SCATTERED, which
  // is the thing that actually matters. Collapsing both into one number would have forced a choice
  // between raising a ceiling that says NEVER RAISE, and pretending the fallbacks are not there.
  //
  //   OUTSIDE  -- places in the app that know one specific patient's medication. This is the real
  //               debt. Phase 1: 17 -> 13. Phase 2 drives it to 0.
  //   INSIDE   -- the migration scaffold's fallbacks, all in named resolvers. Phase 2 deletes them.
  //
  // Both can only go down, and both are checked for staleness, so neither can drift quietly.
  const RESOLVERS = ['medWindowsFor', 'medChemoBlockedOn', 'medChemoBlockingDay',
    'medChemoBlockSpanDays', 'medInteractionsFor', 'medHomeCardKind'];
  const idRe = () => new RegExp("(?:med|entry|m)\\.(?:med)?[Ii]d\\s*===\\s*['\"](" + LEGACY_IDS.join('|') + ")['\"]", 'g');
  let rest = html, inside = 0;
  for (const r of RESOLVERS) {
    const m = html.match(new RegExp('function ' + r + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}'));
    if (m) { rest = rest.replace(m[0], ''); inside += (m[0].match(idRe()) || []).length; }
  }
  const direct = (rest.match(idRe()) || []).map(x => x);
  const HELPERS = ['zofranBlockedOn', 'zofranBlockingDay', 'dexWindowsForOffset',
    'protonixMorningLogTs', 'protonixEveningLogTs', 'morningLinkedToProtonix',
    'eveningLinkedToProtonix', 'tylenolMg'];
  const helpers = HELPERS.filter(h => new RegExp('function\\s+' + h + '\\b').test(html));

  // MEASURED, NOT GUESSED. The first version of this file estimated these and was wrong in both
  // directions -- which would have let five new references in while claiming three helpers had been
  // removed that never existed. A ratchet pinned to a guess is not a ratchet.
  // Lower these as the phases land. NEVER raise them.
  const CEILING = { outside: 13, inside: 8, helpers: 6 };

  t('no NEW place in the app knows one patient\'s medication', direct.length <= CEILING.outside,
    direct.length + ' outside the resolvers, ceiling ' + CEILING.outside);
  t('and the migration scaffold is not growing', inside <= CEILING.inside,
    inside + ' fallbacks inside resolvers, ceiling ' + CEILING.inside);
  t('no NEW helper that exists only for one patient\'s regimen', helpers.length <= CEILING.helpers,
    helpers.length + ' helper(s), ceiling ' + CEILING.helpers + ' -- ' + helpers.join(', '));
  // THE RATCHET'S OTHER HALF. Without this the ceiling never moves: someone deletes a branch, the
  // check still passes at the old number, and the debt is invisible again.
  t('and no ceiling is stale -- lower it when a phase lands',
    direct.length === CEILING.outside && inside === CEILING.inside && helpers.length === CEILING.helpers,
    'found ' + direct.length + '/' + inside + '/' + helpers.length +
    ', pinned at ' + CEILING.outside + '/' + CEILING.inside + '/' + CEILING.helpers);

  // The fence has to stay until the refactor removes what it is fencing.
  t('and RESERVED_LEGACY_MED_IDS still fences every one of them, since they are still here',
    LEGACY_IDS.every(id => new RegExp("'" + id + "'").test(
      (html.match(/const RESERVED_LEGACY_MED_IDS = new Set\(\[[\s\S]*?\]\)/) || [''])[0])),
    '');
}

console.log('\n' + pass + '/' + (pass + fail) + ' checks passed' + (fail ? '  <-- FAIL' : ''));
process.exit(fail ? 1 : 0);
