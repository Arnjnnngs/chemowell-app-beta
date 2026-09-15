# Mutants for test/v84-whatsnew.mjs.
#
# Every one of these breaks something the suite claims to protect. A mutant that SURVIVES is a
# check that cannot fail -- this release has already shipped four of those, each found this way
# and not by reading. Mutant 1 is the reason section 7e exists at all: it survived the whole
# fifty-check suite, and writing the check that kills it showed the shipped fix was half a fix.
#
# Each function runs with the clone as its working directory and edits its index.html.

MUTANT_DESC_1="render()'s focus restore is no longer marked -- the renderer re-schedules the v28 nudge"
mutant_1() {
  python3 - <<'PY'
p='index.html'; s=open(p,encoding='utf-8').read()
old="  if (restoringFocus) return;\n"
assert s.count(old)==1
open(p,'w',encoding='utf-8').write(s.replace(old,""))
PY
}

MUTANT_DESC_2="the v28 nudge no longer checks whether the person scrolled since focus landed"
mutant_2() {
  python3 - <<'PY'
p='index.html'; s=open(p,encoding='utf-8').read()
old="    if (lastUserScrollAt > focusedAt) return;\n"
assert s.count(old)==1
open(p,'w',encoding='utf-8').write(s.replace(old,""))
PY
}

MUTANT_DESC_3="the v28 nudge is deleted outright -- the feature the guard is supposed to preserve"
mutant_3() {
  python3 - <<'PY'
p='index.html'; s=open(p,encoding='utf-8').read()
old="    try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {}\n"
assert s.count(old)==1
open(p,'w',encoding='utf-8').write(s.replace(old,""))
PY
}

MUTANT_DESC_4="preventScroll is dropped from render()'s focus restore"
mutant_4() {
  python3 - <<'PY'
p='index.html'; s=open(p,encoding='utf-8').read()
old="try { freshActive.focus({ preventScroll: true }); } catch (e) { freshActive.focus(); }"
assert s.count(old)==1
open(p,'w',encoding='utf-8').write(s.replace(old,"freshActive.focus();"))
PY
}

MUTANT_DESC_5="anyOverlayOpen() stops ignoring pointer-transparent layers -- the first-run guide freezes the page"
mutant_5() {
  python3 - <<'PY'
p='index.html'; s=open(p,encoding='utf-8').read()
old="    if (cs.pointerEvents === 'none') continue;"
assert s.count(old)==1
open(p,'w',encoding='utf-8').write(s.replace(old,"    if (false) continue;"))
PY
}

MUTANT_DESC_6="the scroll lock is never released -- the page stays frozen after the notice closes"
mutant_6() {
  python3 - <<'PY'
p='index.html'; s=open(p,encoding='utf-8').read()
old="  } else if (!want && scrollLockY !== null) {"
assert s.count(old)==1
open(p,'w',encoding='utf-8').write(s.replace(old,"  } else if (false) {"))
PY
}

MUTANT_DESC_7="the scroll lock never engages -- the page scrolls behind the update notice"
mutant_7() {
  python3 - <<'PY'
p='index.html'; s=open(p,encoding='utf-8').read()
old="    if (r.width >= vw * 0.9 && r.height >= vh * 0.9) return true;"
assert s.count(old)==1
open(p,'w',encoding='utf-8').write(s.replace(old,"    if (false) return true;"))
PY
}

MUTANT_DESC_8="'Got it' does not stamp the version -- the update notice comes back every open"
mutant_8() {
  python3 - <<'PY'
p='index.html'; s=open(p,encoding='utf-8').read()
old="localStorage.setItem(WHATS_NEW_KEY, APP_VERSION)"
assert s.count(old)==1
open(p,'w',encoding='utf-8').write(s.replace(old,"void 0"))
PY
}

MUTANT_DESC_9="the gesture guard stops listening for touchmove -- the yank returns on every phone"
mutant_9() {
  python3 - <<'PY'
p='index.html'; s=open(p,encoding='utf-8').read()
old="['wheel', 'touchmove'].forEach((evt) => {"
assert s.count(old)==1
open(p,'w',encoding='utf-8').write(s.replace(old,"['wheel'].forEach((evt) => {"))
PY
}

MUTANT_DESC_10="the button goes back to 'See all updates' -- the claim four review rounds removed"
mutant_10() {
  python3 - <<'PY'
p='index.html'; s=open(p,encoding='utf-8').read()
old="} }, 'See recent updates'),"
assert s.count(old)==1
open(p,'w',encoding='utf-8').write(s.replace(old,"} }, 'See all updates'),"))
PY
}

MUTANT_DESC_11="a completeness claim planted in an aria-label -- nothing visible changes"
mutant_11() {
  python3 - <<'PY'
p='index.html'; s=open(p,encoding='utf-8').read()
old="'aria-label': 'What\u2019s new in this update'"
assert s.count(old)==1, s.count(old)
open(p,'w',encoding='utf-8').write(s.replace(old,"'aria-label': 'Every update ChemoWell has ever shipped'"))
PY
}

MUTANT_DESC_12="the notice stops saying how many earlier updates this phone never saw"
mutant_12() {
  python3 - <<'PY'
p='index.html'; s=open(p,encoding='utf-8').read()
old="  return Math.max(0, unseen - 1);"
assert s.count(old)==1
open(p,'w',encoding='utf-8').write(s.replace(old,"  return 0;"))
PY
}
