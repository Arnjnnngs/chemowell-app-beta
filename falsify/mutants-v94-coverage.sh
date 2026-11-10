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

MUTANT_DESC_5="pass 1 reaches as far as pass 2 -- the two passes collapse back into one"
mutant_5() {
  python3 - <<'MUT'
import io
p='index.html'; s=io.open(p,encoding='utf-8').read()
old = "    const hit = day.find(e => !claimed.has(e) && e.ts >= b.lo && e.ts <= b.we);"
assert s.count(old)==1
io.open(p,'w',encoding='utf-8').write(s.replace(old,"    const hit = day.find(e => !claimed.has(e) && e.ts >= b.lo && e.ts < b.hi);"))
MUT
}

MUTANT_DESC_6="every window's late reach runs to midnight -- the wrong window recorded as missed"
# A DECLARED HOLE, measured rather than excused. Before the two-pass change this mutant was simply
# uncaught; after it, pass 1 claims every dose that is on time or early for a window, so `hi` only
# decides which window is credited for a dose that falls in a GAP -- after one window closes and
# more than two hours before the next opens. The dose count is identical either way, and the only
# place the difference shows is WHICH window is recorded as missed, which lives in History and in
# the missed-dose rows. This suite reads the Home screen. Constructed and measured at a fixed
# 17:03 clock with windows at 6-8, 13-15 and 20-22 and one dose at 16:00: the correct build
# credits the 13-15 window, this mutant credits 6-8, and Home renders identically for both.
#
# CLOSED 2026-11-10, in the same delta that fixed the notification path, and not by reading the
# missed rows. cancel-on-log has to know WHICH window a dose belongs to, so the claim became
# readable through a hook -- and a dose at 16:00 against windows 6-8 and 11-13 is credited to the
# 11-13 window by the correct build and to 6-8 by this mutant. The hole was never in the app; it
# was in what the suite could see. BACKLOG M44's remaining half -- that no gate RENDERS a missed
# row -- is still open and still worth the suite it asks for.
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

# ---- THE NOTIFICATION PATH. Added after the independent audit refused the first build. ---------
# Mutants 1-7 above all read the SCREEN, and every one of them was green on a build whose OS alarm
# still fired for a dose already given. That is the gap these four close: one per notification
# surface, plus one for the app-v93 appointment fix, which shipped with no mutant behind it at all.

MUTANT_DESC_8="the ALARM PLAN goes back to the naive window test -- the audit's BLOCK, restored"
mutant_8() {
  python3 - <<'MUT'
import io
p='index.html'; s=io.open(p,encoding='utf-8').read()
old = """  if (wi < 0) return true;
  return !coveredWindowFlags(d0, mine, windows)[wi];"""
assert s.count(old)==1
new = """  const ws = d0 + w.start * 3600000, we = d0 + w.end * 3600000;
  return !mine.some(e => e.ts >= ws && e.ts < we);"""
io.open(p,'w',encoding='utf-8').write(s.replace(old,new))
MUT
}

MUTANT_DESC_9="the REACTIVE web notification keeps its own private copy of the same test"
mutant_9() {
  python3 - <<'MUT'
import io
p='index.html'; s=io.open(p,encoding='utf-8').read()
old = "      if (medWindowDueAt(med, d0, w, state.entries)) due.push({ med, window: w });"
assert s.count(old)==1
new = """      const ws = d0 + w.start * 3600000, we = d0 + w.end * 3600000;
      if (!entriesFor(med.id).some(e => e.ts >= ws && e.ts < we)) due.push({ med, window: w });"""
io.open(p,'w',encoding='utf-8').write(s.replace(old,new))
MUT
}

MUTANT_DESC_10="CANCEL-ON-LOG only cancels a window the dose falls inside -- so it cancels nothing"
mutant_10() {
  python3 - <<'MUT'
import io
p='index.html'; s=io.open(p,encoding='utf-8').read()
old = "      if (!claim || Number(claim.ts) !== ts) return; // some other dose covers this window, or none does"
assert s.count(old)==1
new = "      if (ts < hourTs(d0, w.start) || ts >= hourTs(d0, w.end)) return;"
io.open(p,'w',encoding='utf-8').write(s.replace(old,new))
MUT
}

MUTANT_DESC_11="silencing a profile drops the kind filter -- the app-v93 BLOCK, restored exactly"
mutant_11() {
  python3 - <<'MUT'
import io
p='index.html'; s=io.open(p,encoding='utf-8').read()
old = "      && (!kinds || kinds.indexOf(p.extra.kind) !== -1));"
assert s.count(old)==1
io.open(p,'w',encoding='utf-8').write(s.replace(old,"      );"))
MUT
}

MUTANT_EXPECT_12="hole"
MUTANT_DESC_12="status() goes back to a fixed 24-hour hop -- DST ONLY, see BACKLOG M46"
# A DECLARED HOLE, and the reason is in the fixture rather than in the check. `atH` and `hourTs`
# differ by exactly one hour on the two DST transition days a year and are identical on the other
# 363, and this suite's clock is frozen to 2026-11-06 in UTC -- deliberately, because a suite whose
# answer depends on the host's zone was red one hour a day on correct code (v90-chart-axes). So
# this mutant cannot be observed here without a second fixture pinned to a transition day in a
# zone that has one, which is BACKLOG M46. Logged rather than left as an uncaught survivor.
mutant_12() {
  python3 - <<'MUT'
import io
p='index.html'; s=io.open(p,encoding='utf-8').read()
old = "  const d0 = dayStart(now), atH = (h) => hourTs(d0, h);"
assert s.count(old)==1
io.open(p,'w',encoding='utf-8').write(s.replace(old,"  const d0 = dayStart(now), atH = (h) => d0 + h * 3600000;"))
MUT
}

MUTANT_DESC_13="a FOURTH private copy of the naive test, in the app-icon badge -- the delta audit's D1"
# The delta audit planted exactly this on a copy outside the repo and the suite stayed 33/33, and
# v93-profile-notifications stayed green because its fixture logs INSIDE the window where the naive
# test is accidentally right. The README claimed profileDueCount as one of the five surfaces this
# release fixed; nothing could falsify that claim. Now something can.
mutant_13() {
  python3 - <<'MUT'
import io
p='index.html'; s=io.open(p,encoding='utf-8').read()
old = """      if (nowTs < ws || nowTs >= we) return;        // the window is not open right now
      if (!medWindowDueAt(med, d0, w, entries)) return; // already logged in this window"""
assert s.count(old)==1
new = """      if (nowTs < ws || nowTs >= we) return;        // the window is not open right now
      if ((entries || []).some(e => e && e.medId === med.id && e.ts >= ws && e.ts < we)) return;"""
io.open(p,'w',encoding='utf-8').write(s.replace(old,new))
MUT
}

MUTANT_EXPECT_14="hole"
MUTANT_DESC_14="an unknown window reads as covered instead of due -- NO-OP TODAY, see the comment"
# IT SURVIVED THE FIRST SWEEP AND THAT IS THE CORRECT ANSWER, so it is declared rather than left as
# a surprise. `wi < 0` is unreachable: all five call sites iterate `med.windows` and pass the object
# they got from it, which the delta audit checked one by one. So reversing the fallback changes
# nothing that runs, and no check can go red.
#
# It stays in the corpus for the one thing a hole is good for: THE DAY IT STARTS DYING IS THE DAY
# `wi < 0` BECAME REACHABLE -- a sixth call site, a derived window list, a cloned medication -- and
# that is exactly when somebody needs to look at which direction this fails in. Making it catchable
# today would mean a test-only entry point that hands medWindowDueAt a foreign window object, and
# a test-only path through production logic is worse than a declared hole.
mutant_14() {
  python3 - <<'MUT'
import io
p='index.html'; s=io.open(p,encoding='utf-8').read()
old = "  if (wi < 0) return true;"
assert s.count(old)==1
io.open(p,'w',encoding='utf-8').write(s.replace(old,"  if (wi < 0) return false;"))
MUT
}
