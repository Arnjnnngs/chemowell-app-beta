# Mutants for test/v94-window-coverage.mjs — the app-v94 "has this dose been given" fix.
#
# Run: FALSIFY_PORT=9451 ./falsify.sh test/v94-window-coverage.mjs falsify/mutants-v94-coverage.sh
#
# One mutant per claim the release makes. Mutants 1 and 2 restore the two defects Aaron reported,
# byte for byte; if either survives, the suite is not testing the bug it was written for.

MUTANT_DESC_1="status() goes back to the naive window test -- Aaron's reported bug, restored"
mutant_1() {
  python3 - <<'MUT'
import io
p='index.html'; s=io.open(p,encoding='utf-8').read()
old = "    if (coveredHere[wi]) continue;"
assert s.count(old)==1
io.open(p,'w',encoding='utf-8').write(s.replace(old,"    if (es.some(e => e.ts >= ws && e.ts < we)) continue;"))
MUT
}

MUTANT_DESC_2="the ring counts ENTRIES again -- '4/4 DOSES' beside 'Due now'"
mutant_2() {
  python3 - <<'MUT'
import io
p='index.html'; s=io.open(p,encoding='utf-8').read()
old = "      taken += coveredWindowFlags(d0, entriesFor(med.id), windows).filter(Boolean).length;"
assert s.count(old)==1
new = "      taken += Math.min(windows.length, entriesFor(med.id).filter(e => e.ts >= d0 && e.ts < nextDay(d0)).length);"
io.open(p,'w',encoding='utf-8').write(s.replace(old,new))
MUT
}

MUTANT_DESC_3="the early reach becomes unbounded -- a morning dose covers an evening window again"
mutant_3() {
  python3 - <<'MUT'
import io
p='index.html'; s=io.open(p,encoding='utf-8').read()
old = "    lo: Math.max(d0, hourTs(d0, w.start) - WINDOW_EARLY_GRACE_MS),"
assert s.count(old)==1
io.open(p,'w',encoding='utf-8').write(s.replace(old,"    lo: d0,"))
MUT
}

MUTANT_DESC_4="the grace goes to zero -- a dose logged one minute early stops counting"
mutant_4() {
  python3 - <<'MUT'
import io
p='index.html'; s=io.open(p,encoding='utf-8').read()
old = "const WINDOW_EARLY_GRACE_MS = 2 * 3600000;"
assert s.count(old)==1
io.open(p,'w',encoding='utf-8').write(s.replace(old,"const WINDOW_EARLY_GRACE_MS = 0;"))
MUT
}

MUTANT_DESC_5="each window claims independently -- the ordering that IS the v68 fix is gone"
mutant_5() {
  python3 - <<'MUT'
import io
p='index.html'; s=io.open(p,encoding='utf-8').read()
old = """  const claimed = new Set();
  return bounds.map(b => {
    const hit = day.find(e => !claimed.has(e) && e.ts >= b.lo && e.ts < b.hi);
    if (hit) { claimed.add(hit); return true; }
    return false;
  });"""
assert s.count(old)==1
new = """  return bounds.map(b => day.some(e => e.ts >= b.lo && e.ts < b.hi));"""
io.open(p,'w',encoding='utf-8').write(s.replace(old,new))
MUT
}

MUTANT_DESC_6="every window's late reach runs to midnight -- a later window steals an earlier dose"
mutant_6() {
  python3 - <<'MUT'
import io
p='index.html'; s=io.open(p,encoding='utf-8').read()
old = "    hi: i + 1 < windows.length ? hourTs(d0, windows[i + 1].start) : end"
assert s.count(old)==1
io.open(p,'w',encoding='utf-8').write(s.replace(old,"    hi: end"))
MUT
}

MUTANT_EXPECT_7="survive"
MUTANT_DESC_7="OVER-BLOCK CONTROL: the Up next card changes colour -- a real release may restyle it"
mutant_7() {
  python3 - <<'MUT'
import io
p='index.html'; s=io.open(p,encoding='utf-8').read()
old = "background: 'linear-gradient(152deg, #C44E1C 0%, #A8401A 52%, #7E3418 100%)',"
assert s.count(old)==1
io.open(p,'w',encoding='utf-8').write(s.replace(old,"background: 'linear-gradient(152deg, #B8481A 0%, #9C3A16 52%, #722F14 100%)',"))
MUT
}
