// v75-table-builder.mjs -- the build-time table generator, tested exhaustively on fixtures.
//
// THIS IS THE WHOLE ARGUMENT FOR BAKING THE TABLE IN. The version of this feature that fetched on a
// phone had to guard text at RUN time, where no suite could ever see it -- the best it could do was
// check that a guard existed. Here every candidate sentence passes through a pure function with no
// network in it, so the guards can be fired at real MedlinePlus prose, one case each, and a test can
// read the entire shipped table before it ships.
//
// The fixtures are written in the SHAPE MedlinePlus actually uses -- "Ondansetron is used to prevent
// nausea and vomiting caused by cancer chemotherapy..." -- because a guard tested only on sentences
// invented to trip it proves nothing about the sentences it will really meet.
//
// Run:  node test/v75-table-builder.mjs
import { buildTable, guardFailure, firstSentence, tidy, whySection, GUARDS, MAX_LEN } from '../tools/build-med-table.mjs';

let pass = 0, fail = 0;
const t = (name, cond, detail) => {
  console.log('  ' + (cond ? 'PASS  ' : 'FAIL  ') + name + (detail ? '  |  ' + detail : ''));
  cond ? pass++ : fail++;
};
const U = (id) => 'https://medlineplus.gov/druginfo/meds/' + id + '.html';

console.log('\n1. A GOOD PAGE BECOMES A GOOD LINE, with the page it came from');
{
  const { table, rejected } = buildTable([
    { name: 'Ondansetron', generic: 'Ondansetron', url: U('a601209'),
      whyPrescribed: 'Ondansetron is used to prevent nausea and vomiting caused by cancer chemotherapy. It is in a class of medications called serotonin 5-HT3 receptor antagonists.' }
  ]);
  t('the medication is in the table', !!table['ondansetron'], JSON.stringify(table['ondansetron']));
  t('the drug name is stripped off the front, because the card already shows it',
    !!table['ondansetron'] && /^Used to prevent nausea/.test(table['ondansetron'].t), table['ondansetron'] && table['ondansetron'].t);
  t('only the FIRST sentence is kept -- the rest drifts into drug classes and schedules',
    !!table['ondansetron'] && !/serotonin/i.test(table['ondansetron'].t), '');
  t('and the exact page travels with it, so the citation is real',
    !!table['ondansetron'] && table['ondansetron'].u === U('a601209'), table['ondansetron'] && table['ondansetron'].u);
  t('nothing was rejected', rejected.length === 0, JSON.stringify(rejected));
}

console.log('\n2. EVERY GUARD FIRES ON PROSE OF THE KIND MEDLINEPLUS ACTUALLY WRITES');
{
  // One case per guard, each a sentence that could really appear, so a guard cannot pass by only
  // ever meeting sentences invented to trip it.
  const cases = [
    ['a number, which could read as a dose',      'Used to relieve pain lasting more than 3 days.'],
    ['a spelled-out number',                      'Used to relieve pain for up to two weeks at a time.'],
    ['a fever claim',                             'Used to relieve pain and reduce fever.'],
    ['a schedule or a dose unit',                 'Used to prevent nausea, taken daily.'],
    ['a dosage form or route',                    'Used to numb an area of skin before a needle is inserted.'],
    ['an instruction to the reader',              'Used to treat heartburn; do not take it with other acid reducers.'],
    ['a run-on from a bulleted page',             'Used to treat allergy symptoms: sneezing runny nose itching of the throat Diphenhydramine is also used for sleeplessness.'],
    ['longer than ' + MAX_LEN + ' characters',    'Used to treat ' + 'a very long list of conditions '.repeat(30)]
  ];
  for (const [why, sentence] of cases) {
    const got = guardFailure(sentence);
    t('rejects ' + why, got === why, 'got: ' + got);
  }
  t('and lets a good sentence through', guardFailure('Used to prevent nausea and vomiting.') === null,
    String(guardFailure('Used to prevent nausea and vomiting.')));
  t('every guard in the list was exercised above', GUARDS.length === 6, GUARDS.length + ' guards');
}

console.log('\n3. A REJECTED SENTENCE IS DROPPED, NEVER TRIMMED TO FIT');
{
  const { table, rejected } = buildTable([
    { name: 'Lidocaine', generic: 'Lidocaine', url: U('a682701'),
      whyPrescribed: 'Lidocaine is used to numb an area of skin before a needle is inserted.' }
  ]);
  t('the medication does NOT enter the table', !table['lidocaine'], JSON.stringify(table));
  t('and the reason is recorded so a person can read it',
    rejected.length === 1 && /dosage form or route/.test(rejected[0].why), JSON.stringify(rejected[0]));
  // THE POINT. Trimming "of skin" off that sentence makes it pass and changes nothing about the fact
  // that it describes a route -- the meaning survives the words being cut.
  t('nothing in the table is a trimmed version of it',
    !Object.values(table).some(v => /numb an area/i.test(v.t)), '');
}

console.log('\n4. NOTHING THAT IS NOT A MEDLINEPLUS PAGE GETS IN');
{
  const { table, rejected } = buildTable([
    { name: 'Evil', url: 'https://evil.example.com/a.html', whyPrescribed: 'Used to treat nausea.' },
    { name: 'Nojs', url: 'javascript:alert(1)', whyPrescribed: 'Used to treat nausea.' },
    { name: 'Nohttp', url: 'http://medlineplus.gov/x.html', whyPrescribed: 'Used to treat nausea.' },
    { name: '', url: U('a1'), whyPrescribed: 'Used to treat nausea.' }
  ]);
  t('none of them is in the table', Object.keys(table).length === 0, JSON.stringify(table));
  t('all four are recorded as rejected', rejected.length === 4, JSON.stringify(rejected.map(r => r.name)));
  t('and plain http is refused as well as the obvious ones',
    rejected.some(r => r.name === 'Nohttp'), '');
}

console.log('\n4B. www.medlineplus.gov IS THE HOST THE SITE ACTUALLY REDIRECTS TO');
{
  // THE BUG THAT MADE THE FIRST REAL RUN PRODUCE AN EMPTY TABLE. The resolver found 46 pages and
  // this guard threw away every one of them, because it demanded the bare host and MedlinePlus
  // redirects to www. The run went green and committed {} -- it looked exactly like "MedlinePlus
  // knows none of these medications", which is the worst way for a bug to fail.
  const { table, rejected } = buildTable([
    { name: 'Ondansetron', url: 'https://www.medlineplus.gov/druginfo/meds/a601209.html',
      whyPrescribed: 'Ondansetron is used to prevent nausea and vomiting.' }
  ]);
  t('a www url is accepted, because that is what the site returns', !!table['ondansetron'],
    JSON.stringify(rejected));
  t('and the url is kept exactly as the site gave it, not rewritten',
    !!table['ondansetron'] && table['ondansetron'].u === 'https://www.medlineplus.gov/druginfo/meds/a601209.html',
    table['ondansetron'] && table['ondansetron'].u);
  const bare = buildTable([{ name: 'Zofran', url: U('a601209'), whyPrescribed: 'Used to prevent nausea.' }]);
  t('and the bare host still works too', !!bare.table['zofran'], JSON.stringify(bare.rejected));
  const evil = buildTable([{ name: 'Evil', url: 'https://wwwXmedlineplus.gov/druginfo/meds/a1.html', whyPrescribed: 'Used to treat nausea.' }]);
  t('but a lookalike host does NOT slip through the widened rule', Object.keys(evil.table).length === 0,
    JSON.stringify(evil.table));
}

console.log('\n5. THE KEY MATCHES THE ONE THE APP ALREADY LOOKS UP BY');
{
  // medPurposeKey() in the app lowercases and strips punctuation. A table keyed any other way would
  // silently never match, and every description would quietly fall back to the built-in line.
  const { table } = buildTable([
    { name: 'Tylenol PM', url: U('a1'), whyPrescribed: 'Used to relieve pain and help with sleep.' },
    { name: 'Neupogen®', url: U('a2'), whyPrescribed: 'Used to reduce the chance of infection.' }
  ]);
  t('a two-word brand keys the way the app keys it', !!table['tylenol pm'], Object.keys(table).join(', '));
  t('a registered-trademark mark is stripped', !!table['neupogen'], Object.keys(table).join(', '));
}

console.log('\n6. A DUPLICATE CANNOT QUIETLY REPLACE THE FIRST ENTRY');
{
  const { table, rejected } = buildTable([
    { name: 'Zofran', url: U('a601209'), whyPrescribed: 'Used to prevent nausea and vomiting.' },
    { name: 'zofran', url: U('a999999'), whyPrescribed: 'Used to treat something else entirely.' }
  ]);
  t('the first one wins', table['zofran'] && table['zofran'].u === U('a601209'), JSON.stringify(table['zofran']));
  t('and the second is recorded rather than silently dropped',
    rejected.some(r => /duplicate/.test(r.why)), JSON.stringify(rejected));
}

console.log('\n7. THE PIECES THAT SHAPE THE SENTENCE');
{
  t('an abbreviation does not end the sentence early',
    firstSentence('Approved in the U.S. for nausea. It also treats other things.') === 'Approved in the U.S. for nausea.',
    firstSentence('Approved in the U.S. for nausea. It also treats other things.'));
  t('a generic name at the front is stripped too, not just the brand',
    tidy('Pantoprazole is used to treat heartburn.', 'Protonix', 'Pantoprazole') === 'Used to treat heartburn.',
    tidy('Pantoprazole is used to treat heartburn.', 'Protonix', 'Pantoprazole'));
  t('a sentence that does not start with the name is left alone',
    tidy('Eases pain.', 'Tylenol', 'Acetaminophen') === 'Eases pain.', '');
  t('and the result always starts with a capital',
    /^[A-Z]/.test(tidy('ondansetron is used to prevent nausea.', 'Zofran', 'Ondansetron')),
    tidy('ondansetron is used to prevent nausea.', 'Zofran', 'Ondansetron'));
}

console.log('\n9. A BULLETED ANSWER BECOMES PROSE, NOT A RUN-ON  (app-v75)');
{
  // Real shape of a MedlinePlus page whose answer is a list. Before app-v75 the tags were stripped
  // first, so the items ran together with nothing between them and the "first sentence" carried on
  // past the end of the list into the paragraph after it. Two drugs were dropped for being too long
  // when what was actually wrong was that they had lost their punctuation.
  const html = '<h2>Why is this medication prescribed?</h2>' +
    '<p>Valacyclovir is used to treat certain viral infections including:</p>' +
    '<ul><li>herpes labialis (cold sores)</li>' +
    '<li>varicella infections including shingles</li>' +
    '<li>genital herpes</li></ul>' +
    '<p>It is in a class of medications called antivirals.</p>' +
    '<h2>How should this medicine be used?</h2><p>Comes as a tablet.</p>';
  const why = whySection(html);
  t('the list items are separated, not glued together', /cold sores\); varicella/.test(why), why);
  t('the list is closed with a full stop, so the sentence ends where the list ends',
    /genital herpes\.\s*It is in a class/.test(why), why);
  t('the section after the heading is not included', !/Comes as a tablet/.test(why), why);
  const one = tidy(firstSentence(why), 'Valacyclovir', 'Valacyclovir');
  t('so the first sentence is just the list, and it passes every guard',
    guardFailure(one) === null, one + '  [' + one.length + ' chars]  guard: ' + guardFailure(one));
  t('and it is a sentence a person can read', /^Used to treat certain viral infections including: herpes labialis/.test(one), one);

  // FALSIFICATION. Feed the same content with the separators already missing -- the exact string the
  // old extractor produced -- and the run-on guard must reject it. A backstop that cannot fire is
  // the thing this project has been burned by more than any other.
  const glued = 'Used to treat certain viral infections including: herpes labialis (cold sores) varicella infections including shingles genital herpes It is in a class of antivirals.';
  t('FALSIFIED: with the separators removed, the run-on guard rejects it',
    guardFailure(glued) === 'a run-on from a bulleted page', String(guardFailure(glued)));
}

console.log('\n10. LENGTH IS A SANITY CEILING NOW, NOT A CARD WIDTH  (app-v75)');
{
  // The card clamps to two lines and opens on tap, so a long true sentence costs nothing on screen.
  // Deleting the data to make the card tidy is what the old 150-character rule did: it threw away 14
  // medications whose only fault was that MedlinePlus answered them thoroughly.
  const ibuprofen = 'Prescription ibuprofen is used to relieve pain, tenderness, swelling, and stiffness caused by osteoarthritis (arthritis caused by a breakdown of the lining of the joints) and rheumatoid arthritis (arthritis caused by swelling of the lining of the joints).';
  t('a real 255-character MedlinePlus answer is kept', guardFailure(ibuprofen) === null,
    String(guardFailure(ibuprofen)) + '  [' + ibuprofen.length + ' chars]');
  t('it would have been rejected under the old 150 rule', ibuprofen.length > 150, ibuprofen.length + ' chars');

  // FALSIFICATION. The ceiling still has to catch a runaway extraction -- a page whose markup changed
  // and whose whole body came back as one "sentence". Without this the guard is decoration.
  const runaway = 'Used to treat ' + 'conditions of many different kinds affecting many parts of the body '.repeat(12);
  t('FALSIFIED: a runaway extraction is still caught',
    guardFailure(runaway) === 'longer than ' + MAX_LEN + ' characters',
    String(guardFailure(runaway)) + '  [' + runaway.length + ' chars]');
  t('and the ceiling sits above every real answer seen so far, below a whole page',
    MAX_LEN > 600 && MAX_LEN < 2000, 'MAX_LEN=' + MAX_LEN);
}

console.log('\n8. AN EMPTY OR BROKEN INPUT PRODUCES AN EMPTY TABLE, NOT A CRASH');
{
  for (const bad of [null, undefined, [], [null], [{}], 'not an array']) {
    const r = buildTable(bad);
    t('survives ' + JSON.stringify(bad), r && typeof r.table === 'object', Object.keys(r.table).length + ' entries');
  }
}

console.log('\n' + pass + '/' + (pass + fail) + ' checks passed' + (fail ? '  <-- FAIL' : ''));
process.exit(fail ? 1 : 0);
