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
old="    if (Math.abs(yNow - yAtFocus) > 8) return;\n"
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
