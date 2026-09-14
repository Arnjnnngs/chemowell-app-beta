#!/usr/bin/env python3
"""app-v80 round 3 — the round-2 audit blocked it, and again the block is the hero's only button.

THE BLOCK. Round 2 fixed "Go to [medication]" doing nothing by asking whether the medication is
CONFIGURED to have a card on Home. It never asked whether the card is actually ON THE SCREEN.
Home's "Quick log" section has a collapse chevron; one tap on Home removes every standalone card
from the page, the collapse is remembered, and the hero's button then does nothing at all -- no
scroll, no mark, no message -- for the rest of the session. Same control, same silence round 1
called "worse than a dead control", reached through a different door.

Also in this round, all from the same report:
  * a medication in two groups lit BOTH of them up; only the one the scroll landed on should;
  * the contrast claim in round 2's commit message was FALSE (measured 3.57-3.82:1 against a
    4.5:1 claim) -- the gradient is darkened until every white string on the card really clears it;
  * the 3-line clamp trimmed the medication name while the button below printed all 105 characters
    over five lines, so the BUTTON, not the title, drove the card's height;
  * `nextDueDose`'s comment claimed the hero draws the same line as the missed-dose walk. It does
    not: the hero also requires a reachable card. One sentence, so nobody re-derives it.
"""
import sys, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent
HTML, SW = ROOT / 'index.html', ROOT / 'sw.js'

def die(msg):
    print('PATCH FAILED: ' + msg); sys.exit(1)

src = HTML.read_text(encoding='utf-8')
if 'quickLogOpen: true' in src and 'data-med-group' in src:
    die('already applied')

def cut(old, new, what):
    global src
    n = src.count(old)
    if n != 1:
        die(what + ' is not where it was (found ' + str(n) + ') -- nothing written')
    src = src.replace(old, new, 1)

# ---------------------------------------------------------------------------------------------
# BLOCK 1 -- the button must work with Quick log collapsed, and must mark ONE card, not two.
# ---------------------------------------------------------------------------------------------
cut("""  const safe = String(medId).replace(/[^A-Za-z0-9_-]/g, '');
  const el = document.querySelector('[data-med-card="' + safe + '"]')
    || document.querySelector('[data-med-card-' + safe + ']');
  if (!el) return;""",
    """  const safe = String(medId).replace(/[^A-Za-z0-9_-]/g, '');
  const find = () => document.querySelector('[data-med-card="' + safe + '"]')
    || document.querySelector('[data-med-card-' + safe + ']');
  let el = find();
  // THE SECTION MAY BE COLLAPSED, and the card is then not on the page at all. Home's "Quick log"
  // header is a chevron: one tap removes every standalone card, the collapse is remembered for the
  // session, and this button silently did nothing from then on. Open the section and look again --
  // setState re-renders synchronously, so the element exists by the next line.
  if (!el && state.quickLogOpen === false) { setState({ quickLogOpen: true }); el = find(); }
  if (!el) return;""",
    "scrollToMedCard's lookup")

cut("""  clearTimeout(medFlashTimer);
  setState({ medFlash: safe });
  medFlashTimer = setTimeout(() => { if (state.medFlash === safe) setState({ medFlash: null }); }, 1800);""",
    """  // ONE CARD LIGHTS UP, THE ONE THE SCROLL LANDED ON. Keyed on the medication id alone, a
  // medication placed in two groups lit both sections and a medication with its own card AND a
  // group lit both of those -- two glowing cards for one tap, only one of which is where the page
  // actually went. The chosen element names itself, and the render matches on that.
  clearTimeout(medFlashTimer);
  const grp = el.getAttribute && el.getAttribute('data-med-group');
  setState({ medFlash: { id: safe, group: grp || null } });
  medFlashTimer = setTimeout(() => { if (state.medFlash && state.medFlash.id === safe) setState({ medFlash: null }); }, 1800);""",
    "scrollToMedCard's highlight")

# The grouped card: name itself, and light up only when it is the one that was chosen.
cut("""  const groupHook = {};
  let groupFlashed = false;
  meds.forEach(m => {
    if (!m || !m.id) return;
    const k = String(m.id).replace(/[^A-Za-z0-9_-]/g, '');
    groupHook['data-med-card-' + k] = 'group';
    if (state.medFlash === k) groupFlashed = true;
  });""",
    """  // The group names itself so scrollToMedCard can say WHICH section it landed on -- see the note
  // there about two cards lighting up for one tap.
  const groupKey = String(title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const groupHook = { 'data-med-group': groupKey };
  let groupFlashed = false;
  meds.forEach(m => {
    if (!m || !m.id) return;
    const k = String(m.id).replace(/[^A-Za-z0-9_-]/g, '');
    groupHook['data-med-card-' + k] = 'group';
    if (state.medFlash && state.medFlash.id === k && state.medFlash.group === groupKey) groupFlashed = true;
  });""",
    "the grouped card's flash hook")

cut("""    const flashed = state.medFlash === medHook;""",
    """    // A standalone card is never the landing place when the scroll went to a group.
    const flashed = !!(state.medFlash && state.medFlash.id === medHook && !state.medFlash.group);""",
    "the standalone card's flash test")

# ---------------------------------------------------------------------------------------------
# FINDING 5 -- the hero's population is a third one, and the comment said it was the walk's.
# ---------------------------------------------------------------------------------------------
cut("""function nextDueDose(now) {""",
    """// NOT QUITE THE MISSED-DOSE WALK'S POPULATION, and the difference is deliberate. The walk filters
// on `alerts` and windows; this adds `medHasReachableCard`, so a "managed only" medication is still
// flagged as missed in History and still counted in the day's denominator, but is never NAMED here
// -- naming it would offer a button with nowhere to go. Three populations exist: flagged as missed,
// counted in the ring, and named by the hero. This is the third.
function nextDueDose(now) {""",
    "the nextDueDose comment")

# ---------------------------------------------------------------------------------------------
# FINDING 2 -- the contrast claim was false. Measured, not asserted.
#
# White on the old first stop #E4693B is 3.29:1, and the label is 12px bold, which is SMALL text:
# AA wants 4.5. Round 2's commit said full white "clears 4.5:1"; it did not. The gradient is
# darkened until the LIGHTEST stop clears 4.5 with pure white (#C44E1C -> 4.71:1), and every white
# string on the card is made fully opaque, because 0.88 and 0.95 white over that ground measure
# 4.04 and 4.13 -- both under. Hierarchy now comes from size and weight, which is where it belongs.
# test/v80-contrast.mjs computes all of this from the file rather than taking this comment's word.
# ---------------------------------------------------------------------------------------------
cut("""          background: 'linear-gradient(152deg, #E4693B 0%, #BF4C1A 52%, #8B3C1B 100%)',
          boxShadow: '0 10px 30px -12px rgba(139,60,27,0.55), 0 1px 2px rgba(139,60,27,0.20)'""",
    """          background: 'linear-gradient(152deg, #C44E1C 0%, #A8401A 52%, #7E3418 100%)',
          boxShadow: '0 10px 30px -12px rgba(126,52,24,0.55), 0 1px 2px rgba(126,52,24,0.20)'""",
    "the hero gradient")

cut("""            // 0.82 white on this gradient measured 2.69:1. Full white clears 4.5:1 and the label is
            // small and uppercase, which is where contrast matters most.
            h('div', { style: { ...TYPE.label, color: '#FFFFFF' } }, 'Up next'),""",
    """            // MEASURED, NOT ASSERTED. 0.82 white on the original gradient was 2.69:1; full white on
            // it was 3.29:1, and the release note claiming 4.5 was simply wrong. 12px bold is small
            // text, so AA wants 4.5 -- full white on the darkened first stop is 4.71:1.
            h('div', { style: { ...TYPE.label, color: '#FFFFFF' } }, 'Up next'),""",
    "the Up next label comment")

cut("""            sub ? h('div', { style: { fontSize: '14px', fontWeight: '500', color: 'rgba(255,255,255,0.88)', marginTop: '4px' } }, sub) : null,
            h('div', { style: { fontSize: '13.5px', fontWeight: '700', color: 'rgba(255,255,255,0.95)', marginTop: '7px' } },""",
    """            sub ? h('div', { style: { fontSize: '14px', fontWeight: '500', color: '#FFFFFF', marginTop: '4px' } }, sub) : null,
            h('div', { style: { fontSize: '13.5px', fontWeight: '700', color: '#FFFFFF', marginTop: '7px' } },""",
    "the hero's sub and timing lines")

cut("""              h('div', { style: { fontSize: '8px', fontWeight: '700', letterSpacing: '0.07em', color: 'rgba(255,255,255,0.8)' } }, 'DOSES')""",
    """              h('div', { style: { fontSize: '9px', fontWeight: '700', letterSpacing: '0.07em', color: '#FFFFFF' } }, 'DOSES')""",
    "the ring's DOSES caption")

# ---------------------------------------------------------------------------------------------
# FINDING 3 -- the button, not the title, was driving the card's height.
# ---------------------------------------------------------------------------------------------
cut("""        h('button', {
          onClick: () => scrollToMedCard(nx.med.id),
          style: { marginTop: '15px', width: '100%', minHeight: '48px', borderRadius: '14px', border: '0', background: '#FFFFFF', color: '#9E3F1C', fontSize: '16px', fontWeight: '800', boxShadow: '0 3px 10px rgba(0,0,0,0.16)' }
        }, nx.openNow ? 'Go to ' + nx.med.name : 'Show me the card')""",
    """        // THE BUTTON IS ONE LINE, ALWAYS. `'Go to ' + name` printed a 105-character pasted name
        // over five lines, and at 320 the button -- 95px of it -- was what drove the card's height,
        // not the title the clamp was added to control. A long name gets the generic label instead;
        // the name itself is on the card the button goes to, in full.
        h('button', {
          onClick: () => scrollToMedCard(nx.med.id),
          style: { marginTop: '15px', width: '100%', minHeight: '48px', padding: '0 14px', borderRadius: '14px', border: '0', background: '#FFFFFF', color: '#8E3818', fontSize: '16px', fontWeight: '800', boxShadow: '0 3px 10px rgba(0,0,0,0.16)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
        }, (nx.openNow && String(nx.med.name).length <= 22) ? ('Go to ' + nx.med.name) : 'Show me the card')""",
    "the hero button")

# ---------------------------------------------------------------------------------------------
# NOT FROM THE AUDIT -- from the sibling app. The staging copy of care-tracker carries a suite this
# repo does not, and it reported Home at 655px on a 320px phone with an unbroken 62-character
# medication name. Same banner, same ancestor, so it was checked here rather than assumed: Home
# measures 620px. The missed-dose banner has never wrapped a medication name, and its text column is
# `flex: 1` with no `minWidth: 0` -- a flex item refuses to shrink below its own min-content, so the
# wrap alone would change nothing. Both are needed, and the banner names the very medication whose
# card the caregiver is being sent to find.
# ---------------------------------------------------------------------------------------------
cut("""      h('div', { style: { flex: '1' } },
        h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '4px' } },
          h('div', { style: { ...TYPE.bodyBold, fontSize: '14px', color: '#2A2127' } }, 'Missed dose'""",
    """      h('div', { style: { flex: '1', minWidth: '0' } },
        h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '4px' } },
          h('div', { style: { ...TYPE.bodyBold, fontSize: '14px', color: '#2A2127' } }, 'Missed dose'""",
    "the missed-dose banner's text column")

cut("""        ...bannerItems.map(m => h('div', { style: { ...TYPE.caption, color: '#554A52' } },""",
    """        ...bannerItems.map(m => h('div', { style: { ...TYPE.caption, color: '#554A52', overflowWrap: 'anywhere' } },""",
    "the missed-dose banner's per-miss lines")

VER = re.search(r"const APP_VERSION = 'app-v80'", src)
if not VER:
    die('APP_VERSION is not app-v80 -- nothing written')

# THE SERVICE WORKER IS CHECKED BEFORE ANYTHING IS WRITTEN. An earlier draft wrote index.html and
# then died on the cache name, leaving the tree half-patched -- exactly the state these scripts
# exist to make impossible.
sw = SW.read_text(encoding='utf-8')
if "chemowell-app-v80-1" not in sw:
    die('sw.js CACHE is not chemowell-app-v80-1 -- nothing written')
HTML.write_text(src, encoding='utf-8')
SW.write_text(sw.replace("chemowell-app-v80-1", "chemowell-app-v80-2", 1), encoding='utf-8')
print('app-v80 round 3 applied')
