#!/usr/bin/env python3
"""app-v79, round 5: the round-4 audit's six findings. Four are in test files; two are here.

F-R4-4 -- the `length <= 4` floor I added to rescue `lens` was a NET REGRESSION, measured: it fixes
one word and breaks twelve. tabs, caps, pens, pads, cups, cans, bars, bags and rods all printed
"1 tabs" after it, and the old floor of `> 2` handled every one of them correctly. `lens` belongs
with the other singular nouns that happen to end in s.

F-R4-5 -- and this one is the sin this project hired the Voice for. The comment I wrote says
`String(e)` on a Playwright pageerror "carries the whole stack". IT DOES NOT: Error.prototype
.toString() returns "name: message" and nothing else, so `.split('\\n')[0]` was a no-op and `/cdn/i`
never matched what I claimed it matched. Worse, the replacement still swallows the exact class it
names: a broken plugin bundle throws "Could not load Capacitor plugin ...", which is precisely what
`/^Error: Could not load Capacitor/i` excuses -- the defect that cost this repo app-v47 through
app-v49. Fixed in the suite; the false reasoning is deleted from the README in the same commit.
"""
import sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent
HTML = ROOT / 'index.html'

def die(msg):
    print('PATCH FAILED: ' + msg); sys.exit(1)

src = HTML.read_text(encoding='utf-8')
if "(us|is|as|ns)$" in src:
    die('already applied')

def cut(old, new, what):
    global src
    if src.count(old) != 1:
        die(what + ' is not where it was (found ' + str(src.count(old)) + ') -- nothing written')
    src = src.replace(old, new, 1)

cut("""      // -us, -is, -as: bolus, dosis, gas -- singular nouns that happen to end in s.
      if (/(us|is|as)$/i.test(hcUnit)) return hcUnit;
      // lens, and anything else short enough that dropping a letter leaves a stump.
      if (hcUnit.length <= 4) return hcUnit;""",
    """      // -us, -is, -as, -ns: bolus, dosis, gas, lens -- singular nouns that happen to end in s.
      // `lens` is here rather than behind a length floor. Round 4 added `if (hcUnit.length <= 4)`
      // to catch it, and that was a NET REGRESSION measured over real units: it rescues one word
      // and breaks twelve. tabs, caps, pens, pads, cups, cans, bars, bags and rods all printed
      // "1 tabs" under it, and every Spanish -a plural with them. The floor stays where it was.
      if (/(us|is|as|ns)$/i.test(hcUnit)) return hcUnit;
      // Not a bare one- or two-letter word, where dropping a letter leaves a stump.
      if (hcUnit.length <= 2) return hcUnit;""",
    'the singulariser floor')

HTML.write_text(src, encoding='utf-8')
print('app-v79 round 5 applied: the floor goes back to 2 and lens joins bolus')
