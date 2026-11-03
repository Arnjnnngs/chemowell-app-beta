# Mutants for test/v93-profile-notifications.mjs — the app-v93 profile notification work.
#
# Run:
#   FALSIFY_PORT=9441 ./falsify.sh test/v93-profile-notifications.mjs falsify/mutants-v93-profiles.sh
#
# One mutant per CLAIM the suite makes, plus two over-block controls. Every claim in the release
# message should have a mutant here that kills the suite when it is broken; a claim with no mutant
# is a claim nobody has tested.

MUTANT_DESC_1="the notification title loses its profile name -- the whole of Aaron's first ask"
mutant_1() {
  python3 - <<'MUT'
import io, re
p='index.html'; s=io.open(p,encoding='utf-8').read()
m = re.search(r"^  const pfx = \(t\) => .*$", s, re.M)
assert m, 'the pfx line is gone'
io.open(p,'w',encoding='utf-8').write(s[:m.start()] + '  const pfx = (t) => t;' + s[m.end():])
MUT
}

MUTANT_DESC_2="the name is APPENDED instead of prefixed -- the half of the fix Android truncates away"
mutant_2() {
  python3 - <<'MUT'
import io, re
p='index.html'; s=io.open(p,encoding='utf-8').read()
m = re.search(r"^  const pfx = \(t\) => .*$", s, re.M)
assert m, 'the pfx line is gone'
io.open(p,'w',encoding='utf-8').write(s[:m.start()] + "  const pfx = (t) => (profileLabel ? t + ' \\u00b7 ' + profileLabel : t);" + s[m.end():])
MUT
}

MUTANT_DESC_3="the label is applied on a SINGLE-profile phone too -- noise in the one line Android shows"
mutant_3() {
  python3 - <<'MUT'
import io
p='index.html'; s=io.open(p,encoding='utf-8').read()
old = "  return multiProfile() ? profileNameById(id || ACTIVE_PROFILE_ID) : '';"
assert s.count(old)==1
io.open(p,'w',encoding='utf-8').write(s.replace(old,"  return profileNameById(id || ACTIVE_PROFILE_ID);"))
MUT
}

MUTANT_DESC_4="the count ignores whether the window is OPEN -- every scheduled dose reads as due"
mutant_4() {
  python3 - <<'MUT'
import io
p='index.html'; s=io.open(p,encoding='utf-8').read()
old = "      if (nowTs < ws || nowTs >= we) return;        // the window is not open right now"
assert s.count(old)==1
io.open(p,'w',encoding='utf-8').write(s.replace(old,"      if (false) return;"))
MUT
}

MUTANT_DESC_5="the count ignores what has already been logged -- a dose you gave still asks for it"
mutant_5() {
  python3 - <<'MUT'
import io
p='index.html'; s=io.open(p,encoding='utf-8').read()
old = "\n      if (!medWindowDueAt(med, d0, w, entries)) return; // already logged in this window\n"
assert s.count(old)==1
io.open(p,'w',encoding='utf-8').write(s.replace(old,"\n      if (false) return;\n"))
MUT
}

MUTANT_DESC_6="every profile reports the ACTIVE profile's data -- the per-person count becomes one number"
mutant_6() {
  python3 - <<'MUT'
import io
p='index.html'; s=io.open(p,encoding='utf-8').read()
old = """  const meds = active ? state.meds : readProfileMeds(id);
  const entries = active ? state.entries : readProfileEntries(id);"""
assert s.count(old)==1
io.open(p,'w',encoding='utf-8').write(s.replace(old,"  const meds = state.meds;\n  const entries = state.entries;"))
MUT
}

MUTANT_DESC_7="a silenced profile still counts -- the badge keeps asking about the person in hospital"
mutant_7() {
  python3 - <<'MUT'
import io
p='index.html'; s=io.open(p,encoding='utf-8').read()
old = "  return profileDueSummary(nowTs).reduce((n, r) => n + (r.muted ? 0 : r.count), 0);"
assert s.count(old)==1
io.open(p,'w',encoding='utf-8').write(s.replace(old,"  return profileDueSummary(nowTs).reduce((n, r) => n + r.count, 0);"))
MUT
}

MUTANT_DESC_8="silencing does not persist -- the switch moves and nothing is written"
mutant_8() {
  python3 - <<'MUT'
import io
p='index.html'; s=io.open(p,encoding='utf-8').read()
old = "  try { saveJSON(PROFILES_KEY, ps); }"
assert s.count(old)==1
io.open(p,'w',encoding='utf-8').write(s.replace(old,"  try { /* mutant: the write is gone */ }"))
MUT
}

MUTANT_DESC_9="bellOff is removed -- svgIcon silently draws a HOUSE beside the words 'Reminders off'"
mutant_9() {
  python3 - <<'MUT'
import io
p='index.html'; s=io.open(p,encoding='utf-8').read()
old = "    bellOff: '<path d=\"M6 9a6 6 0 0 1 12 0c0 3.6 1 5.2 1.6 6H4.4C5 14.2 6 12.6 6 9Z\"/><path d=\"M10 19a2 2 0 0 0 4 0\"/><path d=\"M4 3.5 20 20.5\"/>'"
assert s.count(old)==1
io.open(p,'w',encoding='utf-8').write(s.replace(old,"    bellOffRemovedByMutant: ''"))
MUT
}

MUTANT_DESC_10="the drawer profile list is hidden entirely -- the place Aaron asked for it"
mutant_10() {
  python3 - <<'MUT'
import io
p='index.html'; s=io.open(p,encoding='utf-8').read()
old = "  if (rows.length < 2) return null;"
assert s.count(old)==1
io.open(p,'w',encoding='utf-8').write(s.replace(old,"  return null;"))
MUT
}

MUTANT_DESC_11="the menu-button count is removed -- the number Aaron said he wanted to see"
mutant_11() {
  python3 - <<'MUT'
import io
p='index.html'; s=io.open(p,encoding='utf-8').read()
old = "          const total = multiProfile() ? totalDueCount() : 0;"
assert s.count(old)==1
io.open(p,'w',encoding='utf-8').write(s.replace(old,"          const total = 0;"))
MUT
}

MUTANT_EXPECT_12="survive"
MUTANT_DESC_12="OVER-BLOCK CONTROL: the badge turns a different colour -- a real release may restyle it"
mutant_12() {
  python3 - <<'MUT'
import io
p='index.html'; s=io.open(p,encoding='utf-8').read()
old = "h('span', { 'data-menu-due': String(total), 'aria-hidden': 'true', style: { position: 'absolute', top: '-1px', right: '-1px', minWidth: '18px', height: '18px', padding: '0 5px', borderRadius: '9px', background: '#A83D0F'"
assert s.count(old)==1
io.open(p,'w',encoding='utf-8').write(s.replace(old, old.replace("background: '#A83D0F'","background: '#8A2F0C'")))
MUT
}

MUTANT_EXPECT_13="survive"
MUTANT_DESC_13="OVER-BLOCK CONTROL: the separator becomes an en dash -- the NAME is the claim, not the glyph"
mutant_13() {
  python3 - <<'MUT'
import io, re
p='index.html'; s=io.open(p,encoding='utf-8').read()
m = re.search(r"^  const pfx = \(t\) => .*$", s, re.M)
assert m, 'the pfx line is gone'
io.open(p,'w',encoding='utf-8').write(s[:m.start()] + "  const pfx = (t) => (profileLabel ? profileLabel + ' \\u2013 ' + t : t);" + s[m.end():])
MUT
}
