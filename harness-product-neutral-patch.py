#!/usr/bin/env python3
"""app-v74: take one specific patient back out of a product every user shares.

AARON, 2026-09-13:
    "chemowell should not have any data referring back to Brandi. I read in the med page it also
     mentioned refer to her team. There shouldn't be ANY hard coding in this app for Brandi OR
     medication including treatment or diagnosis"

He is right, and the leak he found was on the Meds screen where I had just put it.

WHAT THIS IS. care-tracker is one person's app -- her name, her medications, her care team, all
correct there. ChemoWell is a product: every user is a different patient, most of them not women,
none of them Brandi. The two codebases share ancestry and a lot of prose, and the prose is where the
first app keeps leaking into the second. This patch takes out what leaked.

THE ONE THAT MATTERED MOST is the medication disclaimer -- the only place in the app that gives
safety guidance about medication, sitting directly above a list of them. It read "Follow her care
team." To a man using this app, or a daughter tracking her father's treatment, that sentence is
about somebody else, and the instruction it carries is the one that must land.

WHY THEY/THEM RATHER THAN "HE OR SHE" OR REWRITING AROUND IT: the patient is whoever the user set
up. The app has never asked anyone's gender for this purpose and should not start.

AND A HARDCODED DOSE. `CONFIG.ceilingMg = 2500` is a daily acetaminophen limit from one care plan,
carried over from the sibling app. Nothing in this file ever read it -- which is the only reason it
was harmless -- but a named patient's dose ceiling has no business sitting in a shared product, and
"it is unused" is exactly the argument that keeps such a thing alive until something reads it. A
daily limit belongs to the medication the user sets up, where medicationCeilingMax already finds it.

WHAT IT APPENDS: nothing. WHAT IT DELETES: nothing -- no record, no stored field, no user data. This
is wording and one dead constant.

Run BEFORE harness-med-database-patch.py. Nothing here touches what that patch anchors on.
"""
import sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent
HTML = ROOT / 'index.html'

def die(msg):
    print('PATCH FAILED: ' + msg); sys.exit(1)

src = HTML.read_text(encoding='utf-8')

# Every edit is (old, new, why). Validated as a set BEFORE anything is written, so a drifted anchor
# cannot leave the file half-neutral -- the same lesson the database patch learned from sw.js.
EDITS = [
    # The medication disclaimer. This is the one Aaron read.
    ("not advice and not a dose. Follow her care team. ",
     "not advice and not a dose. Follow the care team. ",
     "the medication disclaimer, directly above the list of medications"),
    # The In-Patient FAQ, which narrates a hospital stay in the third person.
    ("If she comes home part-way through a day, the windows after that point are yours again",
     "If they come home part-way through a day, the windows after that point are yours again",
     "In-Patient FAQ: coming home mid-day"),
    ("which meant falsifying when she came home in order to record a dose she really took",
     "which meant falsifying when they came home in order to record a dose that was really taken",
     "In-Patient FAQ: the note explaining why the old behaviour was wrong"),
    # Not user-facing, but a product's source should not assume who the patient is either. These
    # are the sentences a future session reads before writing the next screen's copy.
    ('// a genuine keyword hit on `collapsed`, which is why no threshold catches it -- and "she is coughing',
     '// a genuine keyword hit on `collapsed`, which is why no threshold catches it -- and "they are coughing',
     "comment in the Help search scoring"),
    ('// `collapsed`, so no score threshold anywhere can catch it -- and "she is unresponsive" ranks',
     '// `collapsed`, so no score threshold anywhere can catch it -- and "they are unresponsive" ranks',
     "comment in the Help search scoring"),
    ("const CONFIG = { patientName: '', ceilingMg: 2500, tempUnit: 'Fahrenheit', weightUnit: 'lbs' };",
     "// ceilingMg: 2500 was here and is GONE. It is a daily acetaminophen limit from one specific\n"
     "// person's care plan, carried over from the sibling app, and nothing in this file ever read it --\n"
     "// so it was a named patient's dose ceiling sitting in a product every user shares. A daily limit\n"
     "// belongs to the medication the user sets up, which is where medicationCeilingMax reads it from.\n"
     "const CONFIG = { patientName: '', tempUnit: 'Fahrenheit', weightUnit: 'lbs' };",
     "a hardcoded daily milligram ceiling inherited from the other app"),
]

missing = [why for old, _new, why in EDITS if src.count(old) != 1]
if missing:
    die('these anchors are not present exactly once, and nothing was written:\n  - ' + '\n  - '.join(missing))

for old, new, _why in EDITS:
    src = src.replace(old, new, 1)

HTML.write_text(src, encoding='utf-8')
print('product-neutral patch applied: %d edits' % len(EDITS))
