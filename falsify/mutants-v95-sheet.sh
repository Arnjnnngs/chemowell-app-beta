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
# ANCHOR ON THE DECIDING LINES, NOT THE BLOCK. This mutant spanned the whole callback twice and
# went stale twice -- once when app-v95's F4 fix added a bail line, once when the comment above
# that line was written. Both times falsify.sh reported DID NOT APPLY and the mutant for the
# defect this release exists to fix silently did not run. A mutant's anchor should be the smallest
# text that identifies the decision it is reverting, so that editing the prose around it cannot
# disarm it.
old = """    if (!state.toast) return;
    if (liveEditingSurfaceOpen()) { toastTimer = setTimeout(clearToast, 600); return; }
"""
assert s.count(old)==1
io.open(p,'w',encoding='utf-8').write(s.replace(old,""))
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

# ---- Added after the app-v95 audit refused the first build -----------------------------------

MUTANT_DESC_7="the In-Patient Undo timer clears without deferring -- the audit's BLOCK F1"
mutant_7() {
  python3 - <<'MUT'
import io
p='index.html'; s=io.open(p,encoding='utf-8').read()
old = """    _undoInpatientTimer = setTimeout(function clearUndo() {
      if (liveEditingSurfaceOpen()) { _undoInpatientTimer = setTimeout(clearUndo, 600); return; }
      setState({ confirmUndoInpatient: false });
    }, 5000);"""
assert s.count(old)==1
io.open(p,'w',encoding='utf-8').write(s.replace(old,"    _undoInpatientTimer = setTimeout(() => setState({ confirmUndoInpatient: false }), 5000);"))
MUT
}

MUTANT_DESC_8="the What's New sheet drops out of the guard -- the audit's BLOCK F2"
mutant_8() {
  python3 - <<'MUT'
import io
p='index.html'; s=io.open(p,encoding='utf-8').read()
old = "|| state.eraseAllModalOpen || state.whatsNewOpen || state.addingProfile"
assert s.count(old)==1
io.open(p,'w',encoding='utf-8').write(s.replace(old,"|| state.eraseAllModalOpen || state.addingProfile"))
MUT
}

MUTANT_DESC_9="state.confirmRemove leaves the guard -- the substring trap the delta audit found"
# Not about any one surface: this is the check that exists so a NINTH omission is found by a suite
# rather than by a person. Any removed term should redden it.
mutant_9() {
  python3 - <<'MUT'
import io
p='index.html'; s=io.open(p,encoding='utf-8').read()
# REPOINTED. It used to remove `state.confirmRemovePara`, whose name is unique -- so the old
# substring-matching check caught it and the corpus read "0 known open holes" while the real hole
# was open. `state.confirmRemove` is the one that hides inside its neighbour, so it is the one
# worth reverting: on the old check the whole suite scored 26/26 with this term gone and the tick
# rebuilding under an armed delete confirmation.
old = " || state.confirmRemove || state.confirmRemovePara);"
assert s.count(old)==1
io.open(p,'w',encoding='utf-8').write(s.replace(old," || state.confirmRemovePara);"))
MUT
}

MUTANT_DESC_10="a guard term is NEGATED rather than removed -- the delta-3 audit's N1"
# One character. The term is still present, so a check that asks "is this key mentioned" stays
# green while the add-profile sheet -- which has a name field in it -- is rebuilt once a second.
# The completeness check requires each `||` arm to be exactly `state.<key>`, so this reddens.
mutant_10() {
  python3 - <<'MUT'
import io
p='index.html'; s=io.open(p,encoding='utf-8').read()
old = "|| state.whatsNewOpen || state.addingProfile"
assert s.count(old)==1
io.open(p,'w',encoding='utf-8').write(s.replace(old,"|| state.whatsNewOpen || !state.addingProfile"))
MUT
}
