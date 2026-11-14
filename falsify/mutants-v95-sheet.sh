# Mutants for test/v95-sheet-stability.mjs — app-v95, the sheet that closed itself.
#
# Run: FALSIFY_PORT=9501 ./falsify.sh test/v95-sheet-stability.mjs falsify/mutants-v95-sheet.sh
#
# Mutant 1 restores Aaron's bug byte for byte. If it survives, this suite is not testing the thing
# it was written for. Mutant 4 is the other direction -- a "fix" that never clears the toast would
# pass every check about the input surviving, and is plainly wrong.

MUTANT_DESC_1="the toast timer clears without deferring -- Aaron's reported bug, restored"
mutant_1() {
  python3 - <<'MUT'
import io
p='index.html'; s=io.open(p,encoding='utf-8').read()
old = """  toastTimer = setTimeout(function clearToast() {
    if (liveEditingSurfaceOpen()) { toastTimer = setTimeout(clearToast, 600); return; }
    setState({ toast: null });
  }, 4500);"""
assert s.count(old)==1
io.open(p,'w',encoding='utf-8').write(s.replace(old,"  toastTimer = setTimeout(() => setState({ toast: null }), 4500);"))
MUT
}

MUTANT_DESC_2="the card-flash timer clears without deferring -- the same defect, 1.8s earlier"
mutant_2() {
  python3 - <<'MUT'
import io
p='index.html'; s=io.open(p,encoding='utf-8').read()
old = """  medFlashTimer = setTimeout(function clearFlash() {
    if (!state.medFlash || state.medFlash.id !== safe) return;
    if (liveEditingSurfaceOpen()) { medFlashTimer = setTimeout(clearFlash, 600); return; }
    setState({ medFlash: null });
  }, 1800);"""
assert s.count(old)==1
io.open(p,'w',encoding='utf-8').write(s.replace(old,"  medFlashTimer = setTimeout(() => { if (state.medFlash && state.medFlash.id === safe) setState({ medFlash: null }); }, 1800);"))
MUT
}

MUTANT_DESC_3="the guard forgets the log sheet -- the recurring v11/v22/v27/v45/v55 omission"
mutant_3() {
  python3 - <<'MUT'
import io
p='index.html'; s=io.open(p,encoding='utf-8').read()
old = "  return !!(state.timeModal || state.upgradeOpen || state.drawerOpen || state.apptModal"
assert s.count(old)==1
io.open(p,'w',encoding='utf-8').write(s.replace(old,"  return !!(state.upgradeOpen || state.drawerOpen || state.apptModal"))
MUT
}

MUTANT_DESC_4="OVER-BLOCK: the guard always says busy, so the toast never clears"
# The opposite failure, and the one a careless fix produces. Every check about the input surviving
# passes on this build; only the two that require the toast to GO can see it. Without them, "never
# re-render" would look like a fix.
mutant_4() {
  python3 - <<'MUT'
import io
p='index.html'; s=io.open(p,encoding='utf-8').read()
old = "function liveEditingSurfaceOpen() {"
assert s.count(old)==1
io.open(p,'w',encoding='utf-8').write(s.replace(old,"function liveEditingSurfaceOpen() {\n  if (true) return true;"))
MUT
}

MUTANT_DESC_5="the guard stops caring about a focused field, only about sheets"
mutant_5() {
  python3 - <<'MUT'
import io
p='index.html'; s=io.open(p,encoding='utf-8').read()
old = "  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return true;"
assert s.count(old)==1
io.open(p,'w',encoding='utf-8').write(s.replace(old,"  if (false) return true;"))
MUT
}

MUTANT_EXPECT_6="survive"
MUTANT_DESC_6="OVER-BLOCK CONTROL: the toast changes colour -- a real release may restyle it"
mutant_6() {
  python3 - <<'MUT'
import io
p='index.html'; s=io.open(p,encoding='utf-8').read()
old = "background: 'rgba(59,25,10,0.88)'"
assert s.count(old)>=1
io.open(p,'w',encoding='utf-8').write(s.replace(old,"background: 'rgba(49,21,8,0.9)'"))
MUT
}
