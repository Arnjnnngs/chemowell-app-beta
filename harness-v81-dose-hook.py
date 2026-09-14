#!/usr/bin/env python3
"""app-v81 round 4b -- expose the dose parser to a harness, the same way the warning path already is.

WHY THIS IS NEEDED AND WHY IT IS SAFE. `index.html` is a single `<script type="module">`, so nothing
declared in it is reachable from outside. `window.__syncTest`, `window.__warnTest` and
`window.__notifTest` already exist for exactly this reason, with the reasoning written next to each.
`parseDoseOptions` is a PURE function of a string -- it holds nothing, reads nothing and writes
nothing -- so exposing it adds no surface at all. What it buys is a suite that measures the real
shipping function rather than a copy of it pasted into a test, and a copy is precisely how a suite
ends up green while the app is wrong.

THE SUITE DOES NOT STOP THERE. `test/v81-dose-parser.mjs` uses this hook for the table of written
forms, and then drives the actual screen for the case that matters: the number PRINTED on the dose
button and the number COUNTED toward the daily limit have to be the same number. That is the defect
-- they differed by ten -- and only the screen can prove it.
"""
import sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent
HTML = ROOT / 'index.html'

def die(msg):
    print('PATCH FAILED: ' + msg); sys.exit(1)

src = HTML.read_text(encoding='utf-8')
if '__doseTest' in src:
    die('already applied')
if 'normaliseDoseNumber' not in src:
    die('round 4 has not been applied -- run harness-v81-dose-parser.py first')

ANCHOR = """// v38 (Aaron-requested): whether Dosage options actually carries an amount in the currently-picked
// Limit unit"""

HOOK = """// Debug/test hook only -- same reasoning and same pattern as window.__syncTest and
// window.__warnTest elsewhere in this file: this is a single <script type="module">, so a real
// (non-simulated) harness cannot otherwise reach a module-scoped function. These three are pure
// functions of a string and hold nothing, so exposing them adds no surface. The alternative is a
// suite that tests its own copy of the parser, which is how a board stays green while the app is
// wrong.
if (typeof window !== 'undefined') {
  window.__doseTest = { parseDoseOptions, normaliseDoseNumber, splitDoseOptions };
}

""" + ANCHOR

if src.count(ANCHOR) != 1:
    die('the anchor after parseDoseOptions is not where it was -- nothing written')
src = src.replace(ANCHOR, HOOK, 1)

HTML.write_text(src, encoding='utf-8')
print('app-v81 round 4b applied: window.__doseTest exposes the shipping parser')
