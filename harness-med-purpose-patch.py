#!/usr/bin/env python3
"""
harness-med-purpose-patch.py -- app-v72. Every medication says what it is for.

Aaron, 2026-09-08: "I've asked before to have something pulled from another site to say what the med
is intended for... it wasn't webMD, it was something else that couldn't sue me for using their
stuff." He was right that it never shipped, and the ask was not written down in ANY of the three
repos -- including this one, whose REQUESTS.md and BACKLOG.md have existed since app-v25.

ON THE SOURCE, because it was his actual worry. What cannot be copied is somebody's PROSE; the fact
that ondansetron prevents nausea is not ownable by anyone. So this ships SHORT ORIGINAL sentences
written for a patient -- nothing copied from WebMD, from a drug label, or from any site -- and the
app cites nothing, because a citation to a document nobody here read would be a lie. US federal
sources (openFDA, DailyMed, MedlinePlus) are public domain and would also have been safe to quote;
every one is blocked by the build sandbox's network policy, which is why the text is original rather
than quoted. Refreshing it to exact federal wording later is a data change into the same table.

WHY THIS DIFFERS FROM care-tracker's v74, WHICH SHIPPED THE SAME DAY. care-tracker has a fixed list
of thirteen medications, so its table is keyed by medication ID. ChemoWell has NO default list --
every user types their own -- so a table keyed by id would match nothing. Here the lookup is by
NAME, and by GENERIC NAME as a fallback, both lowercased and punctuation-stripped, so someone who
types "Zofran" and someone who types "ondansetron" both get the line. What the user typed in the
field always wins over the lookup, and a medication nobody recognises simply shows nothing.

WHAT IT DOES
  * MED_PURPOSE: one plain sentence per commonly-prescribed medication, keyed by lowercase name.
  * purposeOf(med): typed field > lookup on name > lookup on generic > '' (never an empty label).
  * "What it's for" is a real field in the medication editor, optional, free text.
  * The Meds screen shows it under the generic name, with ONE disclaimer above the list.
  * medicationFormFrom() seeds the field, so editing a medication cannot silently wipe it. That is
    care-tracker's v43.3 failure class and this app has the identical seeder shape.

WHAT IT DELIBERATELY DOES NOT DO
  * Nothing on the Home quick-log cards -- that is the screen a patient taps when they feel awful,
    and every extra line sits between them and the dose button.
  * No runtime fetch. A live lookup would send a user's medication list to a third-party server and
    would fail exactly when they are offline. The text is in the file.
  * No dose, no schedule, no advice. Only what the medication is generally for.

Usage:  python3 harness-med-purpose-patch.py [--base <index.html>] [--out index.html]
The version stamp lives INSIDE this patch: it refuses a base that is not app-v71 and emits app-v72.
"""
import re, sys, os

HERE = os.path.dirname(os.path.abspath(__file__))
FROM_V, TO_V = 'app-v71', 'app-v72'
FROM_C, TO_C = 'chemowell-app-v71-1', 'chemowell-app-v72-1'

args = sys.argv[1:]
base = args[args.index('--base') + 1] if '--base' in args else os.path.join(HERE, 'index.html')
out = args[args.index('--out') + 1] if '--out' in args else os.path.join(HERE, 'index.html')
sw_out = os.path.join(os.path.dirname(out) or '.', 'sw.js')

s = open(base, encoding='utf-8').read()
m = re.search(r"const APP_VERSION = '([^']+)';", s)
if not m or m.group(1) != FROM_V:
    sys.exit('REFUSING: base is %s, this patch transforms %s -> %s' % (m.group(1) if m else '?', FROM_V, TO_V))


def rep(old, new, n=1):
    global s
    c = s.count(old)
    if c != n:
        sys.exit('REFUSING: expected %d match(es), found %d for:\n%s' % (n, c, old[:200]))
    s = s.replace(old, new)


# ---- 1. the table and the reader ---------------------------------------------------------------
rep("""function medicationFormFrom(med) {""", """// ---- WHAT EACH MEDICATION IS FOR (app-v72) ----
// Short original sentences, written for a patient rather than a clinician. Nothing is copied from
// any site or label -- see this patch's header on why that is the safe answer. No dose, no
// schedule, no advice: only what the medication is generally used for.
// KEYED BY NAME, not by id: this app has no default medication list, so every entry is one the user
// typed. Both the brand name and the generic resolve to the same line.
const MED_PURPOSE = {
  'ondansetron': 'Prevents and settles nausea and vomiting.',
  'zofran': 'Prevents and settles nausea and vomiting.',
  'prochlorperazine': 'Settles nausea and vomiting.',
  'compazine': 'Settles nausea and vomiting.',
  'dexamethasone': 'A steroid given around chemo to calm nausea, swelling and reactions.',
  'decadron': 'A steroid given around chemo to calm nausea, swelling and reactions.',
  'acetaminophen': 'Eases pain and brings down a fever.',
  'paracetamol': 'Eases pain and brings down a fever.',
  'tylenol': 'Eases pain and brings down a fever.',
  'ibuprofen': 'Eases pain, swelling and fever.',
  'advil': 'Eases pain, swelling and fever.',
  'morphine': 'A strong pain reliever for moderate to severe pain.',
  'oxycodone': 'A strong pain reliever for moderate to severe pain.',
  'hydrocodone': 'A strong pain reliever for moderate to severe pain.',
  'tramadol': 'A pain reliever for moderate pain.',
  'gabapentin': 'Eases nerve pain, and is also used for some seizures.',
  'lidocaine': 'A numbing cream for soreness in one spot on the skin.',
  'pantoprazole': 'Lowers stomach acid, which protects the stomach and eases reflux.',
  'protonix': 'Lowers stomach acid, which protects the stomach and eases reflux.',
  'omeprazole': 'Lowers stomach acid, which protects the stomach and eases reflux.',
  'famotidine': 'Lowers stomach acid, which eases reflux and heartburn.',
  'senna': 'A gentle laxative for constipation.',
  'senokot': 'A gentle laxative for constipation.',
  'docusate': 'A stool softener for constipation.',
  'polyethylene glycol': 'A laxative that draws water into the gut to ease constipation.',
  'miralax': 'A laxative that draws water into the gut to ease constipation.',
  'loperamide': 'Slows the gut down to control diarrhea.',
  'imodium': 'Slows the gut down to control diarrhea.',
  'lorazepam': 'Eases anxiety, and is also used for sickness and sleep.',
  'ativan': 'Eases anxiety, and is also used for sickness and sleep.',
  'buspirone': 'Eases anxiety.',
  'paroxetine': 'Treats depression, and is also used for anxiety.',
  'sertraline': 'Treats depression, and is also used for anxiety.',
  'ferrous sulfate': 'An iron supplement, for low iron levels.',
  'iron': 'An iron supplement, for low iron levels.',
  'filgrastim': 'Helps the body make white blood cells after chemo.',
  'neupogen': 'Helps the body make white blood cells after chemo.',
  'pegfilgrastim': 'Helps the body make white blood cells after chemo.',
  'allopurinol': 'Lowers uric acid levels.',
  'diphenhydramine': 'An antihistamine, used for allergic reactions and to help with sleep.',
  'benadryl': 'An antihistamine, used for allergic reactions and to help with sleep.'
};
// Lowercased, and stripped of anything but letters, digits and single spaces, so "Zofran (ODT)" and
// "zofran" land on the same key.
function medPurposeKey(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\\s+/g, ' ').trim();
}
// What the user typed wins; then the name; then the generic; otherwise nothing at all -- never an
// empty label under a medication nobody has described.
function purposeOf(med) {
  if (!med) return '';
  const typed = String(med.purpose || '').trim();
  if (typed) return typed;
  return MED_PURPOSE[medPurposeKey(med.name)] || MED_PURPOSE[medPurposeKey(med.sub)] || '';
}
function medicationFormFrom(med) {""")

# ---- 2. the editor seeds and saves it ----------------------------------------------------------
# The seeder did not carry the field. Without this, opening any medication's editor and saving would
# write an empty string over the line -- care-tracker's v43.3 failure exactly, in the same shape of
# function. Seeded with purposeOf() so the box shows what the screen shows.
rep("""    name: base.name || '',
    sub: base.sub || '',
    note: base.note || '',""",
    """    name: base.name || '',
    sub: base.sub || '',
    purpose: purposeOf(base),
    note: base.note || '',""")

rep("""    sub: String(form.sub || '').trim(),""",
    """    sub: String(form.sub || '').trim(),
    purpose: String(form.purpose || '').trim(),""")

# ---- 3. the field in the editor -----------------------------------------------------------------
rep("""      h('label', null, fieldLabel('Generic name'), formInput({ value: form.sub, place""",
    """      h('label', { style: { gridColumn: '1 / -1' } }, fieldLabel('What it\u2019s for'), formInput({ value: form.purpose, placeholder: 'For example: settles nausea', onInput: event => updateMedicationForm('purpose', event.target.value) })),
      h('label', null, fieldLabel('Generic name'), formInput({ value: form.sub, place""")

# ---- 4. the Meds screen shows it, with one disclaimer above the list -----------------------------
rep("""          h('div', { style: { ...TYPE.caption, color: '#554A52', marginTop: '1px' } }, med.sub || 'No generic name')""",
    """          h('div', { style: { ...TYPE.caption, color: '#554A52', marginTop: '1px' } }, med.sub || 'No generic name'),
          purposeOf(med) ? h('div', { 'data-med-purpose': med.id, style: { ...TYPE.caption, color: '#4A3F47', marginTop: '4px', lineHeight: '1.35' } }, purposeOf(med)) : null""")
rep("""    h('div', { style: { display: 'flex', flexDirection: 'column', gap: '9px' } }, ...cards),""",
    """    h('div', { 'data-med-disclaimer': 'true', style: { ...TYPE.caption, color: '#6B5F66', lineHeight: '1.4', margin: '2px 0 10px' } },
      'The line under each medication is general information, not medical advice. Your care team is the answer for anything specific.'),
    h('div', { style: { display: 'flex', flexDirection: 'column', gap: '9px' } }, ...cards),""")

# ---- 5. version and cache ------------------------------------------------------------------------
rep("const APP_VERSION = '%s';" % FROM_V, "const APP_VERSION = '%s';" % TO_V)

open(out, 'w', encoding='utf-8').write(s)

sw_path = os.path.join(os.path.dirname(out) or '.', 'sw.js')
sw = open(sw_path, encoding='utf-8').read()
if FROM_C not in sw: sys.exit('REFUSING: sw.js cache is not %s' % FROM_C)
open(sw_path, 'w', encoding='utf-8').write(sw.replace(FROM_C, TO_C))
print('patched %s -> %s (cache %s -> %s)' % (FROM_V, TO_V, FROM_C, TO_C))
