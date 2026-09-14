#!/usr/bin/env python3
"""app-v81 round 2b -- the hint was appearing and still could not be read.

The audit measured the thing I had not: the description is rendered as the field's PLACEHOLDER,
which is one line and clips. **52 of 68 descriptions are cut off at 320px** (49 at 360, 44 at 390).
Typing Cyclophosphamide showed "A chemotherapy medicine that dan". A placeholder also cannot be
selected, cannot be copied and is not read out in the same way as text.

So the fix that made the hint APPEAR left Aaron looking at a third of the answer, which is most of
the way back to the complaint he raised. The description now renders as its own wrapping line under
the field, where it can be read to the end at the narrowest phone this app supports. The field keeps
the plain example as its placeholder, which is what a placeholder is for.

The line is shown only when the app actually knows the medication AND the caregiver has not typed
her own words -- describeMed already puts what she typed first, and a hint under her own sentence
telling her what the app would have said is noise.
"""
import sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent
HTML = ROOT / 'index.html'

def die(msg):
    print('PATCH FAILED: ' + msg); sys.exit(1)

src = HTML.read_text(encoding='utf-8')
if "data-purpose-hint" in src:
    die('already applied')
if "const APP_VERSION = 'app-v81'" not in src:
    die('app-v81 has not been built -- run the v81 scripts first')

OLD = """      h('label', { style: { gridColumn: '1 / -1' } }, fieldLabel('What it’s for'), formInput({ value: form.purpose, placeholder: (purposeOf({ name: (state.medEditor && state.medEditor.form && state.medEditor.form.name) || '', sub: (state.medEditor && state.medEditor.form && state.medEditor.form.sub) || '' }) || 'For example: settles nausea'), onInput: event => updateMedicationForm('purpose', event.target.value) })),"""

NEW = """      // THE DESCRIPTION IS A LINE OF ITS OWN, NOT A PLACEHOLDER. It was a placeholder until the
      // app-v81 audit measured it: a placeholder is one line and clips, so 52 of the 68 descriptions
      // were cut off at 320px -- "A chemotherapy medicine that dan" -- and it cannot be selected or
      // copied either. Making the hint appear and then showing a third of it is most of the way back
      // to the complaint this release exists to answer.
      // ONLY WHEN THE APP KNOWS THE MEDICATION AND SHE HAS NOT WRITTEN HER OWN. describeMed already
      // puts what she typed first; repeating the app's version under her sentence is noise.
      (function () {
        const known = purposeOf({ name: (state.medEditor && state.medEditor.form && state.medEditor.form.name) || '',
                                  sub: (state.medEditor && state.medEditor.form && state.medEditor.form.sub) || '' });
        return h('label', { style: { gridColumn: '1 / -1' } },
          fieldLabel('What it’s for'),
          formInput({ value: form.purpose, placeholder: 'For example: settles nausea',
                      onInput: event => updateMedicationForm('purpose', event.target.value) }),
          (known && !String(form.purpose || '').trim())
            ? h('div', { 'data-purpose-hint': 'on', style: { marginTop: '7px', fontSize: '12.5px', lineHeight: '1.45', color: '#554A52', overflowWrap: 'anywhere' } },
                h('span', { style: { fontWeight: '700', color: '#2A2127' } }, 'The app knows this one: '),
                known,
                h('span', { style: { display: 'block', marginTop: '3px', color: '#7A6B73' } }, 'Leave the box empty to use it, or type your own.'))
            : null
        );
      })(),"""

if src.count(OLD) != 1:
    die('the "What it’s for" field is not where it was (found ' + str(src.count(OLD)) + ') -- nothing written')
src = src.replace(OLD, NEW, 1)
HTML.write_text(src, encoding='utf-8')
print('app-v81 round 2b applied: the description is a line that wraps, not a placeholder that clips')
