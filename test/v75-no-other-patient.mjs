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

  // ANY LITERAL CEILING INSIDE THE LEGACY RULE TABLE, WHATEVER ITS UNIT OR SIZE.
  // The two checks above were both blind to what app-v79's first attempt actually added:
  // `ceilingMax: 4, ceilingUnit: 'applications'` on Imodium and Lidocaine. The first only matches
  // `ceilingMg`. The second wants three to five digits next to a drug name followed by mg or ml,
  // and a one-digit count of "applications" is none of those things. So the guard for this exact
  // leak shape passed on this exact leak, in the release that introduced it.
  //
  // The lesson is bigger than the pattern: both checks were written against the ONE example that
  // had already happened -- a four-digit milligram figure in CONFIG -- and a guard shaped around a
  // single past instance catches that instance and nothing else. This one is shaped around the
  // PLACE instead. LEGACY_MED_RULES is where a stranger's regimen would have to be written down to
  // have any effect, so no daily maximum of any unit may appear inside it at all.
  {
    const code = files.find(f => f.name === 'index.html').raw
      .replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    const i = code.indexOf('LEGACY_MED_RULES');
    const table = i < 0 ? '' : code.slice(i, code.indexOf('\n};', i) + 3);
    const hits = [...table.matchAll(/\b(ceilingMax|ceilingMg|volumeCeilingMl|rollingCeilingH|gapH)\s*:\s*[\d.]+/g)]
      .map(m => m[0]);
    t('no daily maximum of any unit inside LEGACY_MED_RULES', hits.length === 0,
      hits.join(' | ') || (table ? 'table found, ' + table.length + ' chars scanned' : 'TABLE NOT FOUND'));
    // A matcher that scanned an empty string would pass forever. The table has to actually be there.
    t('and the rule table was actually found and scanned', table.length > 200, String(table.length));
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
  // ANY variable name, and == as well as ===. The first version matched only `med|entry|m`, so
  // `e.medId === 'tylenol'` and `e.medId === 'imodium'` were invisible to it in both app-v75 and
  // app-v76 -- which means "outside = 0" at the end of phase 2 would not have meant zero. Found by
  // the phase 1 audit. Also catches .includes() and a switch case on one of these ids.
  const idRe = () => new RegExp(
    "(?:\\w+\\.(?:med)?[Ii]d\\s*===?\\s*|\\.includes\\(\\s*|case\\s+)['\"](" + LEGACY_IDS.join('|') + ")['\"]", 'g');
  // COUNT CODE, NOT PROSE -- the same correction the phase 2 patch's delete-guard needed. Phase 2's
  // migration table documents each rule by quoting the branch it replaced ("Was: `med.id ===
  // 'dexamethasone' ? ...`"), and the ratchet counted those quotations as live references. It
  // reported the debt going UP while five branches were being deleted. A comment describing removed
  // code is not behaviour; stripping comments here is a fix, not a loophole, and the definitions
  // themselves are code and still counted.
  const code = html.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  let rest = code, inside = 0;
  for (const r of RESOLVERS) {
    const m = code.match(new RegExp('function ' + r + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}'));
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
  // MEASURED WITH THE WIDENED REGEX, AND AGAINST app-v75 TOO so the comparison is honest. The
  // narrow version reported 17 for v75 and 13 for v76; the real numbers on the same regex are
  // 20 -> 16 outside, 0 -> 5 inside. Phase 1 moved four scattered branches into named resolvers and
  // the wider regex then found three more that had always been invisible. Lower these as the phases
  // land; NEVER raise them.
  // ZERO. app-v77 phase 2 landed: no place in the app asks which medication this is, no resolver
  // carries a legacy fallback, and every helper that existed to serve one patient's prescription is
  // deleted. 20 / 0 / 6 at app-v75; 16 / 5 / 6 at app-v76; 0 / 0 / 0 here.
  //
  // The rules themselves are not gone -- they are in LEGACY_MED_RULES, a migration table that runs
  // once per device against a config older than version 2 and is excluded from this count by name.
  // That table is what phase 3 can delete once nobody is still carrying an unmigrated config.
  // NEVER raise these.
  const CEILING = { outside: 0, inside: 0, helpers: 0 };

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

  // THE FENCE IS GONE (app-v78), AND THIS CHECK INVERTED WITH IT.
  // It used to assert that RESERVED_LEGACY_MED_IDS still listed all thirteen names, because the
  // hardcoded branches were still there and the fence was the only thing keeping a stranger's
  // medication away from them. Phases 1 and 2 moved every rule onto properties and phase 3 deleted
  // the fence, so a customer can now name their medication Zofran and get the id `zofran`.
  //
  // Asserting its ABSENCE matters as much as asserting its presence did: bringing it back would
  // mean thirteen real drug names are unusable again, and it would do so silently.
  t('the fence is gone, so a customer can use their medication\'s real name',
    !/RESERVED_LEGACY_MED_IDS/.test(html),
    /RESERVED_LEGACY_MED_IDS/.test(html) ? 'RESERVED_LEGACY_MED_IDS is back in the file' : '');
  // And the reason it is safe for it to be gone: the migration is gated on a per-medication stamp,
  // not on the id. Without this, deleting the fence and deleting the stamp would both pass.
  t('and the legacy migration is gated on a per-medication stamp, not on the id',
    /Number\(med\.schemaV\) >= MED_CONFIG_VERSION/.test(code), '');
  t('which the medication editor writes on every medication it creates',
    /const schemaV = MED_CONFIG_VERSION;/.test(code), '');
}

console.log('\n' + pass + '/' + (pass + fail) + ' checks passed' + (fail ? '  <-- FAIL' : ''));
process.exit(fail ? 1 : 0);
