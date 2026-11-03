# Mutants for test/contrast-scan.mjs -- THE OVERLAY CORPUS.
#
# WHY THIS FILE EXISTS. The contrast gate took four attempts to build and had nine defects, and
# EVERY ONE was found by running a mutant, never by reading the code. Four separate audits built
# those mutants, and every one of them lived in a scratch directory that died with its session --
# so each audit rebuilt the previous audit's corpus from the written description. `TEAM.md` says
# the corpus "belongs beside the scan, not in a scratch directory". This is that.
#
# Run:  ./falsify.sh test/contrast-scan.mjs falsify/mutants-contrast-overlays.sh
#       (FALSIFY_PORT=<n> if 8877 is busy. The sweep clones HEAD, so commit first.)
#
# WHAT THE SCAN ACTUALLY GUARANTEES, which is what this corpus is for. It catches a layer that
# HIDES the glyphs and a backdrop that MOVES. It does NOT catch a static TRANSLUCENT veil, because
# the backdrop is read from the photograph (veiled) while the ink is read from `cs.color`
# (unveiled) -- both wrong in the same direction, so the ratio goes UP and the scan prints a
# number that is better than the truth. Mutant 4 is that hole, kept as `MUTANT_EXPECT="hole"` so
# the day it starts dying is noticed. See `BACKLOG.md` M38.
#
# Two mutants are expected to SURVIVE and one of them must:
#   4  the translucent veil      -- KNOWN OPEN HOLE (M38)
#   8  the animated page gradient -- OVER-BLOCK CONTROL. A real release may legitimately animate a
#      background. If the scan ever goes red on this, it has started crying wolf, and a gate that
#      fails legitimate work is the one that gets `|| true` written beside it.
#
# Each function runs with the clone as its working directory and edits its index.html. The anchor
# is the app's closing </body>, so a mutant is a layer INJECTED into the page rather than an edit
# to any of the app's own code -- which is the point: these are not defects in the app, they are
# things that could sit on top of it.

# One helper, so a mutant is one line of CSS/HTML and the rest cannot drift between them.
_inject() {
  python3 - "$1" <<'PY'
import sys, io
frag = sys.argv[1]
p = 'index.html'
s = io.open(p, encoding='utf-8').read()
# NOT just '</body>'. The app builds a printable treatment record as an HTML STRING, so the file
# contains a second '</body>' in the middle of a JavaScript concatenation (index.html:10971) --
# the first version of this helper asserted one occurrence, found two, and all nine mutants were
# scored STALE in a sweep that then reported "0 caught" without a single measurement. The anchor
# is the document's own closing pair at the very end of the file, which is unambiguous.
anchor = '\n</body>\n</html>'
assert s.count(anchor) == 1, 'expected exactly one document-closing </body></html>, found %d' % s.count(anchor)
io.open(p, 'w', encoding='utf-8').write(s.replace(anchor, '\n' + frag + anchor))
PY
}

MUTANT_DESC_1="an OPAQUE 390x140 bar at pointer-events:none -- the layer the second audit walked through"
mutant_1() {
  _inject '<div style="position:fixed;left:0;top:0;width:390px;height:140px;background:#FFFFFF;pointer-events:none;z-index:999"></div>'
}

MUTANT_DESC_2="the same bar painted from currentColor with a 2s transition -- the deepest defect of app-v91"
# Under the OLD `HIDE` (`color: transparent`) this bar vanished in the hidden frame, so the scan
# sampled the true gradient under invisible text and exited 0 with three guards downstream of it.
# `-webkit-text-fill-color` closes it at source; this must now be caught as INVISIBLE.
mutant_2() {
  _inject '<div style="position:fixed;left:0;top:0;width:390px;height:140px;background:currentColor;color:#FFFFFF;transition:background 2s;pointer-events:none;z-index:999"></div>'
}

# READING THE SWEEP LOG: the two timer mutants (3 and 9) are red on every run, but WHICH screens go
# red moves between runs, because which boxes are photographed on the frame where the bar is absent
# depends on timing. Their redness and the verdict are stable; their per-screen counts are not.
# A later session comparing two sweep logs line by line would otherwise read that as a regression.
MUTANT_DESC_3="an opaque bar flipped by a 30ms setInterval -- a timer Playwright cannot settle"
# This is the reason photograph C exists. With the moving check forced off, this mutant leaks 304
# measured strings instead of 268: without C it still exits 1, but by luck of which boxes land on
# which frame. C makes the catch deterministic.
mutant_3() {
  _inject '<div id="m3bar" style="position:fixed;left:0;top:0;width:390px;height:140px;background:#FFFFFF;pointer-events:none;z-index:999"></div><script>setInterval(function(){var b=document.getElementById("m3bar");if(b)b.style.background=b.style.background==="rgb(255, 255, 255)"?"#101010":"#FFFFFF";},30);</script>'
}

MUTANT_DESC_4="a TRANSLUCENT rgba(255,255,255,0.85) veil -- KNOWN OPEN HOLE, BACKLOG M38"
MUTANT_EXPECT_4="hole"
# Measured by the fourth audit: output byte-identical to a clean build (310 / 602 / 0 below AA /
# worst 4.78:1, exit 0) while 48 of the 310 printed ratios moved, every one of them UPWARD.
# "Alex's Meds" printed 15.08:1 and was painted #DFDEDF on #FFFAF8 = 1.30:1. The live shape of
# this is `#tour-scrim`, which fails loudly today only because it is DARK.
mutant_4() {
  _inject '<div style="position:fixed;left:0;top:0;width:390px;height:140px;background:rgba(255,255,255,0.85);pointer-events:none;z-index:999"></div>'
}

MUTANT_DESC_5="a mix-blend-mode:lighten layer -- paint the scan never reads out of any property"
mutant_5() {
  _inject '<div style="position:fixed;left:0;top:0;width:390px;height:140px;background:#FFFFFF;mix-blend-mode:lighten;pointer-events:none;z-index:999"></div>'
}

MUTANT_DESC_6="backdrop-filter: blur(8px) brightness(1.6) -- washes the text out without painting over it"
# The fourth audit measured 4 of 6 caught here: two strings survive the blur. A smaller instance of
# mutant 4's premise, and it still blocks, so it is scored as a catch.
mutant_6() {
  _inject '<div style="position:fixed;left:0;top:0;width:390px;height:140px;backdrop-filter:blur(8px) brightness(1.6);pointer-events:none;z-index:999"></div>'
}

MUTANT_DESC_7="an ANCESTOR opacity of 0.35 on #root -- getComputedStyle().opacity is the element's OWN value"
# Caught, but only partly: exit 1 on 13 strings while 297 still print as passing, every one of them
# painted at 35%. Not live in the app today (one opacity:0, two opacity:1, and a 0.65 inside a
# comment) -- which is exactly the status `currentColor` had before it became this release's
# deepest defect. In BACKLOG M38.
mutant_7() {
  _inject '<style>#root{opacity:0.35}</style>'
}

MUTANT_DESC_8="an animated 400% page gradient -- OVER-BLOCK CONTROL, a real release may do this"
MUTANT_EXPECT_8="survive"
# The fourth audit tried specifically to make the gate cry wolf with this and could not: exit 0,
# figures byte-identical to a clean build, zero strings flagged. If this ever goes red, the moving
# check's 25% threshold has become a trap for legitimate work.
mutant_8() {
  _inject '<style>body{background-size:400% 400% !important;animation:m8 8s linear infinite !important}@keyframes m8{0%{background-position:0% 50%}100%{background-position:100% 50%}}</style>'
}

MUTANT_DESC_9="a 4px opaque line flipped every 30ms -- below the 25% area threshold by construction"
# The audit's attempt to beat the knob. It DOES beat the moving check (zero flagged moving) and the
# consequence is a false FAIL rather than a false green: the scan reports strings below AA because
# it sampled a black line. To get under 25% an overlay has to leave most of the word showing, so
# the knob is tied to the quantity it is about. Scored as a catch because the scan does go red.
mutant_9() {
  _inject '<div id="m9ln" style="position:fixed;left:0;top:60px;width:390px;height:4px;background:#FFFFFF;pointer-events:none;z-index:999"></div><script>setInterval(function(){var b=document.getElementById("m9ln");if(b)b.style.background=b.style.background==="rgb(255, 255, 255)"?"#101010":"#FFFFFF";},30);</script>'
}
