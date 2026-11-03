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
# Mutants 1-3 are for the pill suite, 4-6 for the collisions suite, 7-9 for overflow-scan. A
# mutant aimed at another suite is a no-op for the one being swept and will be scored SURVIVED,
# which is why each is labelled with the suite it belongs to and why the runs are reported
# separately. Use FALSIFY_FROM / FALSIFY_TO to run one group.
#
# WHICH PROPERTY IS LOAD-BEARING FOR WHICH SUITE, measured rather than assumed -- and the first
# version of this file got it wrong, which is the part worth keeping:
#
#   * The COLLISION is held off by `minWidth: '0'` on the NAME SPAN. Remove it and
#     "Hydroxychloroquine" lands on "Remove" (46x9px at 320px, 6x9px at 360px). Remove the time
#     cell's `flexShrink: '0'` instead and nothing collides, because the name absorbs the squeeze
#     -- that was written as a collision mutant, it SURVIVED, and it was right to.
#   * The OVERFLOW is held off by `flexShrink: '0'` on the time cell and its group, and by
#     `minWidth: '0'` on the badges. Those belong to overflow-scan, not to the collision suite.
#
# Two suites, two different properties, and a mutant pointed at the wrong one teaches nothing.
# Being able to say which is which is what a corpus is for.

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

MUTANT_DESC_4="[collisions] the name span cannot shrink -- the drug name lands on the Remove button"
# THE load-bearing property for this suite. A bare text child of a flex container is an anonymous
# flex item and cannot go below its own min-content width; the span with `minWidth: 0` is what
# lets the name give way instead of pushing its neighbours. Measured with it removed:
# "Hydroxychloroquine" over "Remove", 46x9px at 320px and 6x9px at 360px.
mutant_4() {
  python3 - <<'MUT'
import io
p='index.html'; s=io.open(p,encoding='utf-8').read()
old = "h('span', { style: { minWidth: '0' } }, nameOf(e.medId)),"
assert s.count(old)==3, s.count(old)
io.open(p,'w',encoding='utf-8').write(s.replace(old,"h('span', null, nameOf(e.medId)),"))
MUT
}

MUTANT_DESC_5="[collisions] the content column cannot shrink -- the other half of the same guard"
mutant_5() {
  python3 - <<'MUT'
import io
p='index.html'; s=io.open(p,encoding='utf-8').read()
old = "h('div', { style: { flex: '1', minWidth: '0' } },"
assert s.count(old)>=3, s.count(old)
io.open(p,'w',encoding='utf-8').write(s.replace(old,"h('div', { style: { flex: '1' } },"))
MUT
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

# --- overflow-scan group. SLOW: each run is 7 to 13 minutes, so sweep these deliberately:
#       FALSIFY_PORT=8864 FALSIFY_FROM=7 FALSIFY_TO=9 \
#         ./falsify.sh test/overflow-scan.mjs falsify/mutants-v92-layout.sh
#     Each was also falsified on its own while app-v92 was built; the figures are in each one.

MUTANT_DESC_7="[overflow] the time cell can shrink -- '10:00 AM' over its box by 5px at 320px"
# The app-v92 defect itself, as overflow-scan sees it. Measured with it reverted: 3 overflowing,
# "10:00 AM" by 5px, 320px only. That number badly understates what is on the screen -- the name
# prints across the time and the dose -- and saying so is mutant 4's job, in the other suite.
mutant_7() {
  python3 - <<'MUT'
import io
p='index.html'; s=io.open(p,encoding='utf-8').read()
old = "color: '#6A4433', minWidth: '58px', flexShrink: '0' } }, fmtTime(e.ts))"
assert s.count(old)==1
io.open(p,'w',encoding='utf-8').write(s.replace(old,"color: '#6A4433', minWidth: '58px' } }, fmtTime(e.ts))"))
MUT
}

MUTANT_DESC_8="[overflow] the badges cannot shrink -- 'Not scheduled - Early - Over limit' by 21px"
# The defect app-v92's audit found. `overflow-wrap: break-word` IS inherited by the badge and does
# NOT reduce a flex item's automatic minimum size; only min-width does. Measured with minWidth
# removed from the badge spans: 6 overflowing, 21px at 320px and 11px at 330px.
mutant_8() {
  python3 - <<'MUT'
import io
p='index.html'; s=io.open(p,encoding='utf-8').read()
pairs = [("borderRadius: '6px', padding: '1px 6px', minWidth: '0' } }, overrideBadgeLabel(e.overrideReason))",
          "borderRadius: '6px', padding: '1px 6px' } }, overrideBadgeLabel(e.overrideReason))"),
         ("borderRadius: '6px', padding: '1px 6px', minWidth: '0' } }, 'Skipped')",
          "borderRadius: '6px', padding: '1px 6px' } }, 'Skipped')")]
for old, new in pairs:
    assert s.count(old) == 2, s.count(old)
    s = s.replace(old, new)
io.open(p,'w',encoding='utf-8').write(s)
MUT
}

MUTANT_DESC_9="[overflow] SEED_ENTRIES loses the badge -- the fixture stops being able to see mutant 8"
MUTANT_EXPECT_9="hole"
# NOT a defect in the app: a defect in the INSTRUMENT, kept so that the day somebody trims that
# fixture entry the sweep says so. It survives on a correct build because nothing is wrong with
# the app. What it demonstrates is that mutant 8 goes invisible under it -- the state this suite
# was actually in for the whole of app-v92's first commit. Run 8 and 9 and read them as a pair.
mutant_9() {
  python3 - <<'MUT'
import io
p='test/overflow-scan.mjs'; s=io.open(p,encoding='utf-8').read()
old = ",\n    override: true, overrideReason: 'offDay+early+overLimit', skipped: true },"
assert s.count(old)==1
io.open(p,'w',encoding='utf-8').write(s.replace(old," },"))
MUT
}
