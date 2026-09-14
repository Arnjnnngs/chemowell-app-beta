#!/usr/bin/env python3
"""app-v81 round 3 -- the audit blocked it, and the regression is in the box this release is about.

THE BLOCK, measured by the auditor on the shipping build, three times out of three:

    type a medication name, move to "What it's for", type "my own words"
      ->  the box holds "my own wor", and focus is on <body>

She is thrown out of the field after a few letters and the rest goes nowhere. On app-v80 the same
typing keeps all twelve characters, so THIS IS NEW IN app-v81 and it is mine. The 450ms rebuild that
makes the hint appear lands while the cursor is in a field that has no `id`, and render() restores
focus and the caret only for an element it can find again by id.

I WROTE THE GUARD AGAINST THIS AND APPLIED IT TO THE WRONG FIELDS. The name and generic-name boxes
got ids because they drive the hint. The box the hint is ABOUT did not, and neither did four others.
This release's own test file says it out loud -- "a hint that appears at the cost of eating
keystrokes would be a worse app than the one with no hint" -- and that is exactly what shipped into
the branch.

THE FIX IS THE CLASS, NOT THE INSTANCE. Every text field in the medication editor gets a stable id,
because ANY of them can hold the cursor when the debounce fires. Naming only `med-purpose` would fix
the sentence the auditor typed and leave the same defect in the hours-between-doses box, the repeat
interval, its start date and the notes.

AND THE PURPOSE FIELD ALSO GETS THE DEBOUNCE, which fixes a second finding in the same line: the
hint is supposed to disappear the moment she writes her own words, and it did not, because typing
there redrew nothing. The copy under it described a condition the app only honoured at the next
redraw. With the id in place the redraw is safe, so the copy becomes true.
"""
import sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent
HTML = ROOT / 'index.html'

def die(msg):
    print('PATCH FAILED: ' + msg); sys.exit(1)

src = HTML.read_text(encoding='utf-8')
if "id: 'med-purpose'" in src:
    die('already applied')
if "const APP_VERSION = 'app-v81'" not in src:
    die('app-v81 has not been built -- run the v81 scripts first')

def cut(old, new, what):
    global src
    n = src.count(old)
    if n != 1:
        die(what + ' is not where it was (found ' + str(n) + ') -- nothing written')
    src = src.replace(old, new, 1)

# THE FIELD THE RELEASE IS ABOUT. id so the caret survives the rebuild; 'debounced' so the hint
# under it goes away as soon as she starts writing her own words, which is what its own copy says.
cut("""          formInput({ value: form.purpose, placeholder: 'For example: settles nausea',
                      onInput: event => updateMedicationForm('purpose', event.target.value) }),""",
    """          formInput({ id: 'med-purpose', value: form.purpose, placeholder: 'For example: settles nausea',
                      onInput: event => updateMedicationForm('purpose', event.target.value, 'debounced') }),""",
    "the What it's for field")

# THE REST OF THE CLASS. None of these drives the hint; they need ids because the cursor can be in
# any of them when the name field's debounce fires 450ms after she stopped typing there.
cut("""            formInput({ type: 'number', min: '0', step: '0.5', value: String(form.gapH == null ? '' : form.gapH), placeholder: 'No extra gap', onInput: event => updateMedicationForm('gapH', event.target.value) })""",
    """            formInput({ id: 'med-gap-h-win', type: 'number', min: '0', step: '0.5', value: String(form.gapH == null ? '' : form.gapH), placeholder: 'No extra gap', onInput: event => updateMedicationForm('gapH', event.target.value) })""",
    "the extra-gap field")

cut("""            formInput({ type: 'number', min: '2', step: '1', value: String(form.intervalN), onInput: event => updateMedicationForm('intervalN', event.target.value), style: { width: '70px' } }),""",
    """            formInput({ id: 'med-interval-n', type: 'number', min: '2', step: '1', value: String(form.intervalN), onInput: event => updateMedicationForm('intervalN', event.target.value), style: { width: '70px' } }),""",
    "the repeat-interval field")

cut("""            formInput({ type: 'date', value: form.intervalAnchor, onInput: event => updateMedicationForm('intervalAnchor', event.target.value), style: { width: '165px' } })""",
    """            formInput({ id: 'med-interval-anchor', type: 'date', value: form.intervalAnchor, onInput: event => updateMedicationForm('intervalAnchor', event.target.value), style: { width: '165px' } })""",
    "the repeat-start-date field")

i = src.index("h('label', null, fieldLabel('Hours between doses'")
j = src.index("formInput({ type: 'number', min: '0.5'", i)
src = src[:j] + "formInput({ id: 'med-gap-h', type: 'number', min: '0.5'" + src[j + len("formInput({ type: 'number', min: '0.5'"):]

cut("""h('textarea', { placeholder: 'Take with food \\u00b7 From Dr. Kim \\u00b7 Crush if needed', onInput: event => updateMedicationForm('note'""",
    """h('textarea', { id: 'med-note', placeholder: 'Take with food \\u00b7 From Dr. Kim \\u00b7 Crush if needed', onInput: event => updateMedicationForm('note'""",
    "the notes field")

HTML.write_text(src, encoding='utf-8')
print('app-v81 round 3 applied: every text field in the editor keeps the cursor through a rebuild')
