#!/usr/bin/env python3
"""app-v81 round 2 -- the audit blocked it, and the block is my own false claim about a safety guard.

I wrote, in three places, that the schedule guard was made STRICTER in the same edit that admitted
the word "chemotherapy". The auditor measured it and it is false: every phrase I added already
contained "chemotherapy", which the old blunt rule caught on its own, so relative to that rule my
edit added nothing and removed a great deal. It put three real timing instructions into the live
table and the board stayed green:

    "Given prior to chemotherapy to prevent sickness."
    "Taken throughout chemotherapy."
    "Given on the day of chemotherapy."

Nothing that SHIPS is wrong -- all 184 descriptions were read one by one and none carries a
schedule, a dose, a form, a route or a diagnosis. What was broken is the guard protecting the next
person to edit the table, and a comment, a commit message and a README row all telling that person
it was stronger than it was. This repo ruled at app-v70 that a check printing a false sentence in
green is worse than no check. That is what I shipped into the test file.

The only code change here is the medication wording in finding 5 below; the guard itself lives in
test/v72-med-purpose.mjs and is changed there.
"""
import sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent
HTML = ROOT / 'index.html'

def die(msg):
    print('PATCH FAILED: ' + msg); sys.exit(1)

src = HTML.read_text(encoding='utf-8')
if "'etoposide': 'A chemotherapy medicine that damages the DNA of cancer cells.'" in src:
    die('already applied')
if "const APP_VERSION = 'app-v81'" not in src:
    die('app-v81 has not been built -- run the two v81 scripts first')

def cut(old, new, what):
    global src
    n = src.count(old)
    if n != 1:
        die(what + ' is not where it was (found ' + str(n) + ') -- nothing written')
    src = src.replace(old, new, 1)

# ---------------------------------------------------------------------------------------------
# FINDING 5 -- three drugs were given the wrong mechanism, and the auditor is medically right.
# Etoposide, doxorubicin and irinotecan act on topoisomerases: they break DNA and stop the cell
# repairing it. The taxanes and the vinca drugs are the ones that stop a cell dividing by acting on
# the spindle. "Stops cancer cells from dividing" is not false of any of them in the loosest sense,
# but it is the wrong sentence for these three, and this table's whole purpose is a caregiver
# reading one true line at 2am rather than a roughly-right one.
# ---------------------------------------------------------------------------------------------
cut("""  'irinotecan': 'A chemotherapy medicine that stops cancer cells from dividing.',
  'doxorubicin': 'A chemotherapy medicine that stops cancer cells from dividing.',
  'adriamycin': 'A chemotherapy medicine that stops cancer cells from dividing.',""",
    """  'irinotecan': 'A chemotherapy medicine that damages the DNA of cancer cells.',
  'doxorubicin': 'A chemotherapy medicine that damages the DNA of cancer cells.',
  'adriamycin': 'A chemotherapy medicine that damages the DNA of cancer cells.',""",
    "the irinotecan and doxorubicin lines")

cut("""  'etoposide': 'A chemotherapy medicine that stops cancer cells from dividing.',""",
    """  'etoposide': 'A chemotherapy medicine that damages the DNA of cancer cells.',""",
    "the etoposide line")

HTML.write_text(src, encoding='utf-8')
print('app-v81 round 2 applied: three drugs get the mechanism they actually have')
