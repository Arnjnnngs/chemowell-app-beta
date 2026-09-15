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
  * A "See recent updates" screen behind one tap. It lists the entries the app carries, which is
 * not every release -- five of eighty-four -- and no surface is allowed to say otherwise.
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
  { v: 'app-v84', date: 'Sep 14, 2026', title: 'The app now tells you what changed',
    points: [
      'Until today ChemoWell updated quietly. A button could move or a number could start being counted differently and nothing on screen said so.',
      'From now on, the first time you open the app after an update, a short note tells you what is different. Tap "Got it" and it does not come back.',
      'Updates from here on are listed under “What’s new” in the menu, newest first, if you want to look back at one.'
    ] },
  { v: 'app-v83', date: 'Sep 14, 2026', title: 'Your medication cards now show what has happened today',
    points: [
      'Each medication on the Meds screen used to describe itself and its rules and say nothing about today. It now shows whether it is available, due, paused, or at its daily limit — and how many doses have been taken today and when the last one was.',
      'A medication with a daily limit gets a bar showing how much of it has been used and how much is left.',
      'Temperature has its own report for the first time. It charts your readings over time with the fever line marked, so you can see at a glance how long a temperature has been up and how high it got.',
      'The Symptoms screen now shows how often each symptom has been happening over the last few weeks. Tap one to see just those entries.'
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
          'Recent updates to ChemoWell, newest first. This phone is running ' + APP_VERSION + '.')
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
          style: { flex: '1', minHeight: '46px', borderRadius: '13px', background: 'rgba(246,108,49,0.10)', border: '1px solid rgba(228,111,60,0.34)', color: '#BF4C1A', fontSize: '14px', fontWeight: '800' } }, 'See recent updates'),
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
src = cut(src, "const APP_VERSION = 'app-v83';\n",
          "const APP_VERSION = 'app-v84';\n" + BLOCK, 'the changelog block')

# ---- 2. state, decided once at startup ---------------------------------------------------------
src = cut(src, "let state = { heroSnoozeUntil: 0, vitalOpen: null,",
          "let state = { heroSnoozeUntil: 0, whatsNewOpen: false, vitalOpen: null,", 'state.whatsNewOpen')

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
  "    { key: 'whatsnew', label: 'What\\u2019s new', icon: 'bulb', helper: 'Recent updates, newest first' },\n"
  "    { key: 'help', label: 'Help & FAQ', icon: 'help', helper: 'Find and fix a problem' },",
  'the drawer row')

src = cut(src, "    renderTimeModal(),", "    renderTimeModal(),\n    renderWhatsNewModal(),", 'the modal mount')

# ---- 4. the debug hooks: MOVED TO THE END OF THE MODULE, not edited where they sit -------------
#
# THIS SECTION SHIPPED A SCRIPT THAT BUILT A BLANK APP, and it did it twice over.
#
# First it was a Python SyntaxError -- a multi-line JavaScript replacement written as a
# single-quoted string -- so it had never executed at all, while being listed as the way to rebuild
# app-v84. That was fixed, and the fix exposed the second defect underneath it: the script added
# `key: WHATS_NEW_KEY` to a hook block that sits ~1,500 lines ABOVE `const WHATS_NEW_KEY`, so the
# rebuilt file threw "Cannot access 'WHATS_NEW_KEY' before initialization" at module load and
# rendered an empty #root. The independent delta audit found it by LOADING the rebuilt file, which
# is the only way it could have been found -- the script ran, printed OK, and produced a dead app.
#
# The getter that was added here guarded APP_VERSION and nothing else, which is the patch-each-field
# approach the shipped fix deliberately rejected. POSITION IS THE GUARD: the whole hook block runs
# LAST, after every const it reads, so nothing it touches can be in its temporal dead zone and any
# hook added to it later is safe by construction rather than by remembering. The script now does
# what the release did -- lifts the block out and appends it before </script> -- instead of editing
# it where it stands and hoping.
BASE_HOOKS = """if (typeof window !== 'undefined') {
  window.__doseTest = { parseDoseOptions, normaliseDoseNumber, splitDoseOptions };
  // The back-button registry, for the completeness check in test/v82-back-button.mjs. Exported
  // rather than copied into the suite, so a new layer cannot be added to one and not the other.
  // `stateKeys` is what makes the completeness check real. Without it the suite's "every
  // dismissible thing has a Back rule" assertion had nothing to compare against and PASSED on the
  // absence \u2014 a check that reports green loudest when it cannot see anything, which is the exact
  // class this file has been caught on four times.
  window.__backTest = { keys: backLayerKeys, press: handleBackPress, stateKeys: () => Object.keys(state) };
}
"""

MOVED_HOOKS = """
// ---- DEBUG/TEST HOOKS -- LAST IN THE MODULE, AND THE POSITION IS THE POINT --------------------
//
// This block used to sit ~1,500 lines higher up, and it read `APP_VERSION` and `WHATS_NEW_KEY`
// eagerly. Both are `const` declared BELOW that point, so module evaluation threw "Cannot access
// 'APP_VERSION' before initialization" and the whole app stopped booting -- silently, because the
// only symptom was a feature that never appeared.
//
// **That is the third temporal-dead-zone failure in this file**, and the third one happened while
// writing the comment about the second. Patching each field into a getter would have fixed the two
// that were caught and left the next one to be found by somebody using the app. Position is the
// actual guard: a block that runs last cannot read anything too early, so every future hook added
// here is safe by construction rather than by remembering.
//
// Nothing here changes app behaviour; it exports what the suites compare against, so a check
// cannot quietly test its own copy of the app's logic instead of the app's.
if (typeof window !== 'undefined') {
  window.__doseTest = { parseDoseOptions, normaliseDoseNumber, splitDoseOptions };
  // The back-button registry, for the completeness check in test/v82-back-button.mjs. Exported
  // rather than copied into the suite, so a new layer cannot be added to one and not the other.
  // `stateKeys` is what makes the completeness check real. Without it the suite's "every
  // dismissible thing has a Back rule" assertion had nothing to compare against and PASSED on the
  // absence \u2014 a check that reports green loudest when it cannot see anything, which is the exact
  // class this file has been caught on four times.
  window.__backTest = { keys: backLayerKeys, press: handleBackPress, stateKeys: () => Object.keys(state),
    get version() { return APP_VERSION; } };
  window.__whatsNewTest = { latest: whatsNewLatest, all: () => CHANGELOG, shouldShow: whatsNewShouldShow, key: WHATS_NEW_KEY };
}
</script>"""

src = cut(src, BASE_HOOKS, '', 'lifting the hook block out of the middle of the module')
# The anchor is the module's CLOSING TAG PLUS THE DOCUMENT'S, not "</script>" on its own: there are
# six script tags in this file and the block must land at the end of the module, after every const
# it reads. `cut` refuses an anchor that is not unique, which is how that was caught rather than
# silently patching the first inline script it found.
src = cut(src, "</script>\n</body>\n</html>", MOVED_HOOKS + "\n</body>\n</html>",
          'the hook block, re-attached at the end of the module')

HTML.write_text(src)
print('OK -- What\'s New applied')
