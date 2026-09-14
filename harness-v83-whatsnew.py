#!/usr/bin/env python3
"""app-v83 -- ChemoWell gets the WHAT'S NEW notice on open. care-tracker has had one since v61.

Aaron, 2026-09-14: *"I know the caretracker has the updates that pops up when opening...but I
haven't seen that in the chemowell app recently"* -- and there was nothing to see. Searching this
file for any changelog, any "what's new", any seen-version marker returned NOTHING. The app has
shipped eighty-two releases without ever telling the person using it that anything changed.

WHY THAT MATTERS MORE HERE THAN IN care-tracker. This is a product. Every user is a stranger with
their own medications and their own care team. When a release changes what a button does -- and
app-v81 changed how a dose amount is counted against a daily limit, and app-v82 moved the
temperature and weight boxes behind a tap -- a user who is not told simply finds their app
different one morning. That is how somebody stops trusting a medication app.

WHAT THIS BUILDS, ported from care-tracker and de-personalised on the way (CLAUDE.md Rule 0):

  * `CHANGELOG` -- newest first, written for a tired non-technical reader at 2am. No version
    numbers in the prose, no file names, no function names. **they/them throughout** -- this app
    has never asked anyone's gender and most users are not women.
  * A pop-up on open, showing the NEWEST release only. Not the whole history: a wall of entries on
    open is something a person dismisses without reading, which defeats showing it at all.
  * A "See all updates" screen behind one tap, listing every release.
  * A drawer row so it can be found again after it has been dismissed.

THE TWO RULES THAT MAKE IT BEARABLE RATHER THAN ANNOYING, both learned in care-tracker:

  1. **A FRESH INSTALL IS NOT AN UPDATE.** With nothing stored we cannot tell a brand-new phone
     from one that has been running for weeks, and greeting a first-time user with "here is what
     changed" is both meaningless and in the way. `DEVICE_HAS_PRIOR_DATA` -- any other ChemoWell
     key already on this phone -- separates them. A genuinely new phone is stamped silently and
     told nothing; the next real update is the first thing this ever shows.
  2. **THE MARKER IS PER DEVICE, NOT PER PROFILE.** "Have I read this yet" is a fact about the
     phone in somebody's hand. It lives in plain `localStorage` under a key with no profile in it,
     so switching profile does not re-show it and does not silence it either.

WRITE MODEL: this release writes NO patient record of any kind. It writes exactly one string --
the version last seen -- to one localStorage key on the device, and it reads it back. No entry, no
medication, no preference, nothing that syncs, nothing that leaves the phone.

DECIDED ONCE AT STARTUP, not on every render. `render()` runs on a one-second tick; asking
"should this show" inside it would re-open the notice the moment it was dismissed.
"""
import sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent
HTML = ROOT / 'index.html'

def die(msg):
    print('REFUSED: ' + msg); sys.exit(1)

def cut(src, old, new, what):
    if src.count(old) != 1:
        die('%s -- anchor matched %d times, expected exactly 1' % (what, src.count(old)))
    return src.replace(old, new)

src = HTML.read_text()
if 'WHATS_NEW_KEY' in src:
    die("What's New is already in this file")

# ---- 1. the changelog and the seen-version machinery -------------------------------------------
BLOCK = r"""
// ---- WHAT'S NEW ------------------------------------------------------------------------------
//
// Written for the person holding the phone, not for a developer reading a diff. No version
// numbers in the prose, no file names, no function names. THEY/THEM throughout: this app has
// never asked anyone's gender and most users are not women (CLAUDE.md Rule 0, leak shape 2).
const CHANGELOG = [
  { v: 'app-v83', date: 'Sep 14, 2026', title: 'The app now tells you what changed',
    points: [
      'Until today ChemoWell updated quietly. A button could move or a number could start being counted differently and nothing on screen said so.',
      'From now on, the first time you open the app after an update, a short note tells you what is different. Tap "Got it" and it does not come back.',
      'Every past update is listed under "What’s new" in the menu, newest first, if you want to look back.'
    ] },
  { v: 'app-v82', date: 'Sep 14, 2026', title: 'The home screen leads with your medications',
    points: [
      'Temperature, weight and blood pressure used to sit in three large boxes at the top of Home, asking to be typed into before you could see anything else. They are three small tiles now, each showing the last reading and how long ago it was.',
      'Tap a tile and the same box and the same Log button open underneath it. Nothing was taken away.',
      'Today’s events are one list down the day now instead of four separate cards split by time of day.',
      'If you had turned temperature and weight off in Settings but kept blood pressure on, the blood pressure box used to disappear along with them. It stays now.'
    ] },
  { v: 'app-v81', date: 'Sep 14, 2026', title: 'Dose amounts are read the way they are written',
    points: [
      'An amount written as ".5 mg" was being counted as 5 mg against a daily limit, so a limit could be reached after a tenth of the medicine. Half-tablets, amounts with a comma in the thousands, and amounts ending in a zero after the point were all counted wrongly too.',
      'Combination medicines written like "5/325 mg" are now left alone rather than guessed at. Where the app cannot work out how many tablets an amount means, it says so on the same screen as the button that gives the dose, and names the limit it is not applying.',
      'Typing a medication name now shows what it is for straight away, instead of only after you touch another box. The list of medicines it recognises went from 66 to 184.'
    ] },
  { v: 'app-v80', date: 'Sep 13, 2026', title: 'Home answers "what is due next"',
    points: [
      'The top of Home now names the next medication that is due, its amount, and whether it is due now or at a time.',
      'It never names a medication the app says not to give — one already logged, one paused, one not scheduled today, or one blocked around a treatment day.',
      'When everything scheduled is logged, it says so rather than disappearing.'
    ] }
];

// PER DEVICE, NOT PER PROFILE. "Have I read this yet" is a fact about the phone in your hand, so
// the key carries no profile id: switching profile neither re-shows the notice nor silences it.
const WHATS_NEW_KEY = 'chemowell-app-seen-version';
function whatsNewLatest() { return CHANGELOG[0] || null; }
function whatsNewSeenVersion() { try { return localStorage.getItem(WHATS_NEW_KEY); } catch (e) { return null; } }
function whatsNewMarkSeen() { try { localStorage.setItem(WHATS_NEW_KEY, APP_VERSION); } catch (e) {} }
// A FRESH INSTALL IS NOT AN UPDATE. No marker means two different things and they must not be
// confused: a phone that has never run ChemoWell (say nothing -- "here is what changed" is
// meaningless to somebody who has never seen the old version) and a phone that HAS run it from
// before this marker existed (an upgrade, which is exactly what this is for). Any other ChemoWell
// key already on the device separates them. Either way the version is stamped, so this is decided
// once rather than on every load.
function deviceHasPriorChemoWellData() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k !== WHATS_NEW_KEY && k.indexOf('chemowell-app') === 0) return true;
    }
  } catch (e) {}
  return false;
}
function whatsNewShouldShow() {
  const seen = whatsNewSeenVersion();
  if (!seen) { const prior = deviceHasPriorChemoWellData(); whatsNewMarkSeen(); return prior; }
  return seen !== APP_VERSION;
}

function whatsNewEntry(e, latest) {
  return h('div', { 'data-whatsnew-entry': e.v, style: { background: latest ? 'rgba(246,108,49,0.08)' : '#FFFDFC', border: '1px solid ' + (latest ? 'rgba(228,111,60,0.34)' : '#F0E3DD'), borderRadius: '15px', padding: '13px 14px', minWidth: '0' } },
    h('div', { style: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', marginBottom: '3px' } },
      h('div', { style: { fontSize: '14.5px', fontWeight: '800', color: '#2A2127', letterSpacing: '-0.01em', minWidth: '0', overflowWrap: 'anywhere' } }, e.title),
      h('div', { style: { fontSize: '11.5px', fontWeight: '700', color: '#915E48', flexShrink: '0' } }, e.date)
    ),
    h('ul', { style: { margin: '7px 0 0', paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '5px' } },
      ...(e.points || []).map((pt) => h('li', { style: { fontSize: '13.5px', lineHeight: '1.5', color: '#554A52', overflowWrap: 'anywhere' } }, pt))
    )
  );
}

function renderWhatsNew(now) {
  const latest = whatsNewLatest();
  return [
    h('section', { 'data-whatsnew-screen': 'true', style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
      h('div', { style: { minWidth: '0' } },
        h('div', { style: { fontSize: '18px', fontWeight: '800', letterSpacing: '-0.02em', color: '#2A2127' } }, 'What’s new'),
        h('div', { style: { fontSize: '13px', color: '#7A6E76', marginTop: '3px', lineHeight: '1.45' } },
          'Every update to ChemoWell, newest first. This phone is running ' + APP_VERSION + '.')
      ),
      ...CHANGELOG.map((e, i) => whatsNewEntry(e, i === 0 && latest && e.v === latest.v))
    )
  ];
}

// THE NEWEST RELEASE ONLY. A wall of entries on open is something a person dismisses without
// reading, which defeats showing it at all. The rest is one tap away for anyone who wants it.
function renderWhatsNewModal() {
  if (!state.whatsNewOpen || !state.loaded) return null;
  const e = whatsNewLatest();
  if (!e) return null;
  const close = () => { whatsNewMarkSeen(); setState({ whatsNewOpen: false }); };
  return h('div', { 'data-whatsnew-modal': 'true', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'What’s new in this update',
    onClick: (ev) => { if (ev.target === ev.currentTarget) close(); },
    style: { position: 'fixed', inset: '0', zIndex: '95', background: 'rgba(42,33,39,0.42)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '16px' } },
    h('div', { style: { width: '100%', maxWidth: '460px', maxHeight: '80vh', overflowY: 'auto', background: '#FFFFFF', border: '1px solid #E9D8D1', borderRadius: '20px', padding: '18px 16px calc(16px + env(safe-area-inset-bottom))', boxShadow: '0 -10px 40px rgba(86,28,4,0.22)', minWidth: '0' } },
      h('div', { style: { fontSize: '11.5px', fontWeight: '800', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#BF4C1A', marginBottom: '8px' } }, 'Updated'),
      whatsNewEntry(e, true),
      h('div', { style: { display: 'flex', gap: '9px', marginTop: '14px' } },
        h('button', { 'data-whatsnew-all': 'true', type: 'button',
          onClick: () => { whatsNewMarkSeen(); setState({ whatsNewOpen: false, view: 'whatsnew', drawerOpen: false }); },
          style: { flex: '1', minHeight: '46px', borderRadius: '13px', background: 'rgba(246,108,49,0.10)', border: '1px solid rgba(228,111,60,0.34)', color: '#BF4C1A', fontSize: '14px', fontWeight: '800' } }, 'See all updates'),
        h('button', { 'data-whatsnew-close': 'true', type: 'button', onClick: close,
          style: { flex: '1', minHeight: '46px', borderRadius: '13px', background: 'linear-gradient(135deg, #E46F3C 0%, #BF4C1A 100%)', color: '#fff', fontSize: '14px', fontWeight: '800' } }, 'Got it')
      )
    )
  );
}

// DECIDED ONCE, HERE, AND NOT EARLIER. render() runs on a one-second tick, so asking "should this
// show" inside it would re-open the notice the moment it was dismissed. And it cannot be asked
// where `state` is declared either: whatsNewShouldShow() reads APP_VERSION, which is a `const`
// declared thousands of lines below that point -- calling it from there throws a ReferenceError
// that the startup try/catch swallows, which is the exact defect this repo has now shipped twice.
// It is asked immediately after APP_VERSION exists.
state.whatsNewOpen = whatsNewShouldShow();
"""

# Placed immediately after APP_VERSION, which every function above reads. Declaring them before it
# would be the temporal-dead-zone defect this repo has now shipped twice.
src = cut(src, "const APP_VERSION = 'app-v82';\n",
          "const APP_VERSION = 'app-v83';\n" + BLOCK, 'the changelog block')

# ---- 2. state, decided once at startup ---------------------------------------------------------
src = cut(src, "let state = { heroSnoozeUntil: 0, vitalOpen: null,",
          "let state = { heroSnoozeUntil: 0, vitalOpen: null, whatsNewOpen: false,", 'state.whatsNewOpen')

# ---- 3. the router, the view whitelist, the back registry, the drawer ---------------------------
src = cut(src,
  "const VALID_VIEWS = ['home', 'meds', 'reports', 'inpatient', 'symptoms', 'settings', 'calendar', 'account', 'notes', 'help', 'report'];",
  "const VALID_VIEWS = ['home', 'meds', 'reports', 'inpatient', 'symptoms', 'settings', 'calendar', 'account', 'notes', 'help', 'report', 'whatsnew'];",
  'VALID_VIEWS')

src = cut(src, "  if (state.view === 'help') return renderHelpView(now);",
          "  if (state.view === 'whatsnew') return renderWhatsNew(now);\n  if (state.view === 'help') return renderHelpView(now);",
          'the router')

# A pop-up the phone's Back button cannot dismiss is the app-v82 back-button work undone. It goes
# with the other modals, ABOVE the drawer, because it covers the whole screen.
src = cut(src,
  "  { key: 'tourStep', label: 'the guided tour', open: () => state.tourStep != null, close: () => setState({ tourStep: null }) },",
  "  { key: 'tourStep', label: 'the guided tour', open: () => state.tourStep != null, close: () => setState({ tourStep: null }) },\n"
  "  // Back marks it seen, exactly as \"Got it\" does -- dismissing a notice is dismissing it, and a\n"
  "  // notice that comes back after you closed it is worse than one that never appeared.\n"
  "  { key: 'whatsNewOpen', label: 'the what\\u2019s-new notice', open: () => !!state.whatsNewOpen, close: () => { whatsNewMarkSeen(); setState({ whatsNewOpen: false }); } },",
  'the back-button layer')

src = cut(src,
  "    { key: 'help', label: 'Help & FAQ', icon: 'help', helper: 'Find and fix a problem' },",
  "    { key: 'whatsnew', label: 'What\\u2019s new', icon: 'bulb', helper: 'Every update, newest first' },\n"
  "    { key: 'help', label: 'Help & FAQ', icon: 'help', helper: 'Find and fix a problem' },",
  'the drawer row')

src = cut(src, "    renderTimeModal(),", "    renderTimeModal(),\n    renderWhatsNewModal(),", 'the modal mount')

# ---- 4. the debug hooks the suite compares against ---------------------------------------------
# Exported rather than copied into the suite. The v82 back-button suite's completeness check first
# passed because the app was NOT exporting the list it compares against -- green precisely because
# it could see nothing. The version is exported for the same reason: so the suite can assert the
# newest changelog entry names the running release without pinning a version literal, which this
# project has been broken by on every legitimate release.
src = cut(src,
  "  window.__backTest = { keys: backLayerKeys, press: handleBackPress, stateKeys: () => Object.keys(state) };",
  "  window.__backTest = { keys: backLayerKeys, press: handleBackPress, stateKeys: () => Object.keys(state), version: APP_VERSION };\n"
  "  window.__whatsNewTest = { latest: whatsNewLatest, all: () => CHANGELOG, shouldShow: whatsNewShouldShow, key: WHATS_NEW_KEY };",
  'the debug hooks')

HTML.write_text(src)
print('OK -- What\'s New applied')
