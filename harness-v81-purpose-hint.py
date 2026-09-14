#!/usr/bin/env python3
"""app-v80 -> app-v81: the "What it's for" hint never appeared while you were typing the name.

AARON FOUND THIS BY USING THE APP, and sent a screenshot: "Tylenol" typed into Medication name,
cursor moved on to Generic name, and WHAT IT'S FOR still reading "For example: settles nausea" --
for a drug the app has had a hand-written line for since app-v72.

MEASURED BEFORE ANY CODE CHANGED, on the shipped build, with Ondansetron:

    before typing              "For example: settles nausea"
    after typing the name      "For example: settles nausea"   <- still nothing
    after touching ANY other field   "Prevents and settles nausea and vomiting."

So the lookup works and always did; the screen simply never redraws while the name field is the
one being typed in, and by the time it does the caregiver has stopped looking. The hint is computed
at render time from state.medEditor.form.name, and `updateMedicationForm(field, value)` called with
no third argument stores the value WITHOUT a re-render.

THE FIX IS THE PATTERN THIS FILE ALREADY USES, APPLIED TO TWO MORE FIELDS -- AND IT IS BOTH HALVES
OR IT IS WORSE THAN THE BUG. `Dosage options` and `Daily limit` already re-render while you type:
they pass 'debounced' (450ms after the last keystroke) AND they carry a stable `id`. The id is not
decoration -- render() rebuilds the whole page into root.innerHTML, and it restores focus and the
caret only for an element it can find again BY ID afterwards. Add the debounce without the id and
every keystroke after the first 450ms would throw the caregiver out of the field mid-word.

AND THE TABLE GETS WIDER. Aaron: Keytruda came back blank. The drug list was chemo-shaped but thin
-- no immunotherapy, no targeted agents, none of the everyday medications a patient is also taking.
Every line added here follows the rules the existing ones were written to: what the medicine DOES,
never what the reader HAS; no dose, no schedule, no dosage form, no route, no instruction. A drug
whose bare name covers products with different ingredients gets no line at all, which is the
Excedrin principle already in the file.
"""
import sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent
HTML, SW = ROOT / 'index.html', ROOT / 'sw.js'

def die(msg):
    print('PATCH FAILED: ' + msg); sys.exit(1)

src = HTML.read_text(encoding='utf-8')
if "id: 'med-name'" in src:
    die('already applied')

sw = SW.read_text(encoding='utf-8')
if "chemowell-app-v80-2" not in sw:
    die('sw.js CACHE is not chemowell-app-v80-2 -- nothing written')

def cut(old, new, what):
    global src
    n = src.count(old)
    if n != 1:
        die(what + ' is not where it was (found ' + str(n) + ') -- nothing written')
    src = src.replace(old, new, 1)

# ---------------------------------------------------------------------------------------------
# THE TWO FIELDS THAT FEED THE LOOKUP. describeMed reads med.name and then med.sub, so the generic
# name is not an afterthought: typing "pembrolizumab" under a brand the app does not know is the
# other way to reach a description, and it was just as silent.
# ---------------------------------------------------------------------------------------------
cut("""      h('label', null, fieldLabel('Medication name'), formInput({ value: form.name, placeholder: 'Medication name', onInput: event => updateMedicationForm('name', event.target.value) })),""",
    """      // BOTH HALVES, AND NEITHER IS OPTIONAL. 'debounced' redraws 450ms after the last keystroke,
      // which is what makes the hint below appear while the caregiver is still looking at it. The
      // `id` is what lets render() find this input again afterwards -- it rebuilds the page into
      // root.innerHTML and restores focus and the caret BY ID. Debounce without the id would throw
      // her out of the field mid-word, which is worse than the silence it replaces.
      h('label', null, fieldLabel('Medication name'), formInput({ id: 'med-name', value: form.name, placeholder: 'Medication name', onInput: event => updateMedicationForm('name', event.target.value, 'debounced') })),""",
    "the medication name field")

cut("""      h('label', null, fieldLabel('Generic name'), formInput({ value: form.sub, placeholder: 'Generic name', onInput: event => updateMedicationForm('sub', event.target.value) })),""",
    """      // The generic name is the OTHER way into the lookup -- describeMed falls back to med.sub --
      // so typing "pembrolizumab" under an unrecognised brand name has to light the hint too.
      h('label', null, fieldLabel('Generic name'), formInput({ id: 'med-sub', value: form.sub, placeholder: 'Generic name', onInput: event => updateMedicationForm('sub', event.target.value, 'debounced') })),""",
    "the generic name field")

cut("""const APP_VERSION = 'app-v80'""", """const APP_VERSION = 'app-v81'""", 'APP_VERSION')
HTML.write_text(src, encoding='utf-8')
SW.write_text(sw.replace("chemowell-app-v80-2", "chemowell-app-v81-1", 1), encoding='utf-8')
print('app-v81 part 1 applied: the hint refreshes while you type')
