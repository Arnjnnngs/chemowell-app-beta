# Mutants for the two layout suites app-v92 added — test/v92-pill-clearance.mjs and
# test/v92-text-collisions.mjs.
#
# WHY A SECOND CORPUS FILE. The app-v92 audit's F8: both suites read `FALSIFY_BASE`, so both are
# sweepable, and neither had a committed corpus — which is how the contrast scan ended up being
# rebuilt from prose by four separate audits. One file per question, same as the suites.
#
# Run (one suite at a time; the harness takes one suite path):
#   FALSIFY_PORT=8871 ./falsify.sh test/v92-pill-clearance.mjs  falsify/mutants-v92-layout.sh
#   FALSIFY_PORT=8872 ./falsify.sh test/v92-text-collisions.mjs falsify/mutants-v92-layout.sh
#
# Mutants 1-3 are for the pill suite, 4-6 for the collisions suite. A mutant aimed at the other
# suite is a no-op for the one being swept and will be scored SURVIVED, which is why they are
# labelled with the suite they belong to and why the two runs are reported separately.

MUTANT_DESC_1="[pill] the page's bottom padding goes back to 90px -- the app-v92 defect itself"
mutant_1() {
  python3 - <<'PY'
import io
p='index.html'; s=io.open(p,encoding='utf-8').read()
old = "paddingBottom: 'calc(' + (backPillShowing() ? backPillClearancePx() : 90) + 'px + env(safe-area-inset-bottom))'"
assert s.count(old)==1
io.open(p,'w',encoding='utf-8').write(s.replace(old,"paddingBottom: 'calc(90px + env(safe-area-inset-bottom))'"))
PY
}

MUTANT_DESC_2="[pill] the gap goes to 0 -- the last line TOUCHES the pill instead of clearing it"
# BACK_PILL_GAP is the only part of the clearance that is a judgement rather than geometry. If the
# suite cannot tell 0 from 8 it is measuring the pill's own box and not the clearance.
mutant_2() {
  python3 - <<'PY'
import io
p='index.html'; s=io.open(p,encoding='utf-8').read()
old = "const BACK_PILL_GAP = 8;"
assert s.count(old)==1
io.open(p,'w',encoding='utf-8').write(s.replace(old,"const BACK_PILL_GAP = -24;"))
PY
}

MUTANT_DESC_3="[pill] data-report-tile is removed -- the suite must REFUSE, not walk zero screens"
mutant_3() {
  python3 - <<'PY'
import io
p='index.html'; s=io.open(p,encoding='utf-8').read()
old = "h('button', { 'data-report-tile': type, onClick: () => openReport(type)"
assert s.count(old)==1
io.open(p,'w',encoding='utf-8').write(s.replace(old,"h('button', { onClick: () => openReport(type)"))
PY
}

MUTANT_DESC_4="[collisions] the time cell can shrink again -- the name prints over the time and the dose"
mutant_4() {
  python3 - <<'PY'
import io
p='index.html'; s=io.open(p,encoding='utf-8').read()
old = "color: '#6A4433', minWidth: '58px', flexShrink: '0' } }, fmtTime(e.ts))"
assert s.count(old)==1
io.open(p,'w',encoding='utf-8').write(s.replace(old,"color: '#6A4433', minWidth: '58px' } }, fmtTime(e.ts))"))
PY
}

MUTANT_DESC_5="[collisions] the dot+time group can shrink -- the same collision by the other route"
mutant_5() {
  python3 - <<'PY'
import io
p='index.html'; s=io.open(p,encoding='utf-8').read()
old = "h('div', { style: { display: 'flex', alignItems: 'center', gap: '9px', flexShrink: '0' } },"
assert s.count(old)==1
io.open(p,'w',encoding='utf-8').write(s.replace(old,"h('div', { style: { display: 'flex', alignItems: 'center', gap: '9px', minWidth: '0' } },"))
PY
}

MUTANT_DESC_6="[collisions] an OVERLAP built out of fixed positioning -- must NOT be reported"
MUTANT_EXPECT_6="survive"
# The over-block control for this suite. The page is MEANT to scroll under the fixed header and the
# bottom nav, and a first version of the suite counted exactly that and reported 4 to 11 false
# collisions per screen. This mutant parks an extra FIXED strip of text over the content: it is out
# of flow, so the suite must stay green. If it ever goes red, the in-flow restriction has been
# loosened and the suite has started reporting the layout working.
mutant_6() {
  _v92_inject '<div style="position:fixed;left:0;top:200px;width:390px;z-index:999;font-size:15px;color:#000;background:transparent;pointer-events:none">Fixed strip of text parked over the page</div>'
}

_v92_inject() {
  python3 - "$1" <<'PY'
import sys, io
frag = sys.argv[1]
p = 'index.html'
s = io.open(p, encoding='utf-8').read()
# The document's own closing pair at the very end. NOT a bare '</body>': the app builds a
# printable treatment record as an HTML string and that contains a second one.
anchor = '\n</body>\n</html>'
assert s.count(anchor) == 1, 'expected one document-closing </body></html>, found %d' % s.count(anchor)
io.open(p, 'w', encoding='utf-8').write(s.replace(anchor, '\n' + frag + anchor))
PY
}
