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

MUTANT_DESC_13="the sentence prints one more than the count -- the data attribute stays right"
mutant_13() {
  python3 - <<'PY'
p='index.html'; s=open(p,encoding='utf-8').read()
old=": (n + ' earlier updates you have not seen are under"
assert s.count(old)==1
open(p,'w',encoding='utf-8').write(s.replace(old,": ((n + 1) + ' earlier updates you have not seen are under"))
PY
}

MUTANT_DESC_14="a marker the changelog does not carry counts nothing instead of everything"
mutant_14() {
  python3 - <<'PY'
p='index.html'; s=open(p,encoding='utf-8').read()
old="  const unseen = idx === -1 ? CHANGELOG.length : idx;"
assert s.count(old)==1
open(p,'w',encoding='utf-8').write(s.replace(old,"  const unseen = idx === -1 ? 0 : idx;"))
PY
}

MUTANT_DESC_15="the singular branch never fires -- '1 earlier updates ... are'"
mutant_15() {
  python3 - <<'PY'
p='index.html'; s=open(p,encoding='utf-8').read()
old="            n === 1\n"
assert s.count(old)==1
open(p,'w',encoding='utf-8').write(s.replace(old,"            n === 0\n"))
PY
}

MUTANT_DESC_16="the first-ever line is gone -- every phone in this rollout is told nothing again"
mutant_16() {
  python3 - <<'PY'
p='index.html'; s=open(p,encoding='utf-8').read()
old="        if (whatsNewFirstEver && Array.isArray(CHANGELOG) && CHANGELOG.length > 1) {"
assert s.count(old)==1
open(p,'w',encoding='utf-8').write(s.replace(old,"        if (false && Array.isArray(CHANGELOG) && CHANGELOG.length > 1) {"))
PY
}

MUTANT_DESC_17="the app is its own prior data again -- a brand-new phone is greeted with 'here is what changed'"
mutant_17() {
  python3 - <<'PY'
p='index.html'; s=open(p,encoding='utf-8').read()
old="function deviceHasPriorChemoWellData() { return HAD_PRIOR_CHEMOWELL_DATA; }"
assert s.count(old)==1
open(p,'w',encoding='utf-8').write(s.replace(old,"function deviceHasPriorChemoWellData() { return true; }"))
PY
}

MUTANT_DESC_18="the snapshot counts the licence key, so a device that bought Plus looks like an upgrade forever"
mutant_18() {
  python3 - <<'PY'
p='index.html'; s=open(p,encoding='utf-8').read()
old="      if (k === 'chemowell-app-license-v1') continue;      // survives a wipe on purpose\n"
assert s.count(old)==1
open(p,'w',encoding='utf-8').write(s.replace(old,""))
PY
}

MUTANT_DESC_19="a key is added to what survives a factory reset, and the snapshot no longer agrees"
mutant_19() {
  python3 - <<'PY'
p='index.html'; s=open(p,encoding='utf-8').read()
old="const WIPE_SURVIVORS = [LICENSE_KEY];"
assert s.count(old)==1
open(p,'w',encoding='utf-8').write(s.replace(old,"const WIPE_SURVIVORS = [LICENSE_KEY];\nconst WIPE_SURVIVORS_DRIFTED = [LICENSE_KEY, 'chemowell-app-profiles-v1'];"))
s2=open(p,encoding='utf-8').read()
old2="      if (k && k.indexOf('chemowell-app-') === 0 && WIPE_SURVIVORS.indexOf(k) === -1) doomed.push(k);"
assert s2.count(old2)==1
open(p,'w',encoding='utf-8').write(s2.replace(old2,"      if (k && k.indexOf('chemowell-app-') === 0 && WIPE_SURVIVORS_DRIFTED.indexOf(k) === -1) doomed.push(k);"))
PY
}
