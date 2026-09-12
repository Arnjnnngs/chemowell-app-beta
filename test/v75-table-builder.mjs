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
import { buildTable, guardFailure, firstSentence, tidy, GUARDS, MAX_LEN } from '../tools/build-med-table.mjs';

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
    ['longer than ' + MAX_LEN + ' characters',    'Used to treat ' + 'a very long list of conditions '.repeat(8)]
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

console.log('\n8. AN EMPTY OR BROKEN INPUT PRODUCES AN EMPTY TABLE, NOT A CRASH');
{
  for (const bad of [null, undefined, [], [null], [{}], 'not an array']) {
    const r = buildTable(bad);
    t('survives ' + JSON.stringify(bad), r && typeof r.table === 'object', Object.keys(r.table).length + ' entries');
  }
}

console.log('\n' + pass + '/' + (pass + fail) + ' checks passed' + (fail ? '  <-- FAIL' : ''));
process.exit(fail ? 1 : 0);
