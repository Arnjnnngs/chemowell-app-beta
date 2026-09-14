#!/usr/bin/env python3
"""app-v81, the back button -- the phone's own Back button closed the app. Aaron found it; nothing here ever looked.

    Aaron, 2026-09-14: "All apps close out (go to user phone home screen) when hitting the phones
    built in back button. This should at least go to the previous page. There is a back button that
    we've built into the app that works. Thought you should know. Should have been found already."

**He is right that it should have been found, and the reason it was not is written into this
project's own rules.** Rule 5.5 says every gate here asks about a still frame -- does the screen
fit, is the copy true, can she do the job, does the record survive -- and that the one thing nobody
asks is what happens while a finger is moving. The hardware Back button is the purest example of
that class there is, and there was not one line about it: `grep popstate` returned nothing in all
THREE apps. Not a regression, not a broken fix -- a feature that was never built, on the control a
phone user reaches for most often after the screen itself.

**What it costs.** A caregiver part-way through the time-confirm sheet, or filling in a medication,
taps Back to undo one step and the whole app disappears to the home screen. Nothing is corrupted --
none of these screens writes until it is confirmed -- but the work in front of her is gone and the
app has behaved like nothing else on the phone.

WHAT THIS DOES. One ordered registry of every layer Back can dismiss, innermost first, and one
handler:

  1. a confirmation sitting on top of something else  (Yes/No arming states)
  2. a modal or sheet                                 (time, appointment, note, check-in, info...)
  3. a full-screen editor                             (the medication editor, Help, the drawer)
  4. a tab that is not Home                           -> Home
  5. nothing left                                     -> the phone may close the app, as it should

**PRECEDENCE IS FIXED, NOT A STACK, AND THAT IS SAID OUT LOUD.** `state` records what is open, never
the order it was opened in, so a real stack would mean a second source of truth that can disagree
with the screen -- and this file already carries scars from exactly that shape. The list below is
ordered by how deeply a layer nests, which is the same answer in every arrangement these screens can
actually reach, because the app never opens two modals at once.

MECHANISM: one history entry, pushed once, re-pushed after every Back that the app handles. That is
deliberately the same mechanism in the browser, in the installed PWA and inside the Capacitor
WebView -- Capacitor's own default Back walks history and only exits at the root, so giving it an
entry to walk is all it needs, and no new plugin or CDN script is added to do it.

THE COMPLETENESS CHECK IS THE POINT, per Rule 5.5: the case is written for the CLASS, not for the
one screen that was reported. `test/v82-back-button.mjs` enumerates every dismissible key in `state`
and fails if one is missing from the registry, so a nineteenth overlay cannot be added without a
rule for what Back does to it.
"""
import sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent
HTML = ROOT / 'index.html'

def die(msg):
    print('PATCH FAILED: ' + msg); sys.exit(1)

def cut(src, old, new, what):
    if src.count(old) != 1:
        die(what + ' is not where it was (' + str(src.count(old)) + ' matches) -- nothing written')
    return src.replace(old, new, 1)

src = HTML.read_text(encoding='utf-8')
if 'BACK_LAYERS' in src:
    die('already applied')

ANCHOR = """function setState(patch) {"""
BLOCK = """// ---- THE PHONE'S OWN BACK BUTTON -------------------------------------------------------------
// Ordered INNERMOST FIRST. Each layer says how to tell it is open and how to close it, and closing
// it must be exactly what the layer's own Cancel/close control does -- if the two ever disagree,
// Back becomes a second way to leave a screen that leaves different state behind.
//
// `label` is for the suite and for anyone reading a failure: it names the layer in the words a
// caregiver would use.
const BACK_LAYERS = [
  // 1. CONFIRMATIONS FIRST. These sit on top of whatever armed them, so Back must disarm the
  //    confirmation and leave that thing open -- not close both.
  { key: 'confirmDeleteMed', label: 'the delete-medication confirmation', open: () => state.confirmDeleteMed != null, close: () => setState({ confirmDeleteMed: null }) },
  { key: 'confirmRestoreMed', label: 'the bring-back confirmation', open: () => state.confirmRestoreMed != null, close: () => setState({ confirmRestoreMed: null }) },
  { key: 'confirmDeleteProfile', label: 'the delete-profile confirmation', open: () => state.confirmDeleteProfile != null, close: () => setState({ confirmDeleteProfile: null }) },
  { key: 'confirmDeleteAppt', label: 'the delete-appointment confirmation', open: () => state.confirmDeleteAppt != null, close: () => setState({ confirmDeleteAppt: null }) },
  { key: 'confirmDeleteNote', label: 'the delete-note confirmation', open: () => state.confirmDeleteNote != null, close: () => setState({ confirmDeleteNote: null }) },
  { key: 'confirmRemove', label: 'the remove-entry confirmation', open: () => state.confirmRemove != null, close: () => setState({ confirmRemove: null }) },
  { key: 'confirmRemovePara', label: 'the remove-paracentesis confirmation', open: () => state.confirmRemovePara != null, close: () => setState({ confirmRemovePara: null }) },
  { key: 'confirmClearChemo', label: 'the clear-treatment-date confirmation', open: () => !!state.confirmClearChemo, close: () => setState({ confirmClearChemo: false }) },
  { key: 'override', label: 'the over-limit override', open: () => state.override != null, close: () => setState({ override: null }) },
  // 2. MODALS AND SHEETS.
  { key: 'timeModal', label: 'the confirm-the-time sheet', open: () => state.timeModal != null, close: () => setState({ timeModal: null }) },
  { key: 'apptModal', label: 'the appointment sheet', open: () => state.apptModal != null, close: () => setState({ apptModal: null }) },
  { key: 'noteModal', label: 'the note sheet', open: () => state.noteModal != null, close: () => setState({ noteModal: null }) },
  { key: 'checkinModal', label: 'the check-in sheet', open: () => state.checkinModal != null, close: () => setState({ checkinModal: null }) },
  { key: 'infoModal', label: 'the information pop-up', open: () => state.infoModal != null, close: () => setState({ infoModal: null }) },
  { key: 'bkNotice', label: 'the backup notice', open: () => state.bkNotice != null, close: () => setState({ bkNotice: null }) },
  { key: 'eraseAllModalOpen', label: 'the erase-everything warning', open: () => !!state.eraseAllModalOpen, close: () => setState({ eraseAllModalOpen: false }) },
  { key: 'upgradeOpen', label: 'the upgrade sheet', open: () => !!state.upgradeOpen, close: () => setState({ upgradeOpen: false }) },
  { key: 'addingProfile', label: 'the add-profile sheet', open: () => !!state.addingProfile, close: () => setState({ addingProfile: false }) },
  { key: 'chemoCalOpen', label: 'the treatment-date calendar', open: () => !!state.chemoCalOpen, close: () => setState({ chemoCalOpen: false }) },
  { key: 'tourStep', label: 'the guided tour', open: () => state.tourStep != null, close: () => setState({ tourStep: null }) },
  // 3. FULL-SCREEN EDITORS AND PANELS.
  { key: 'medEditor', label: 'the medication editor', open: () => state.medEditor != null, close: () => setState({ medEditor: null, confirmDeleteMed: null }) },
  { key: 'help', label: 'an open help topic', open: () => !!(state.help && (state.help.topic || state.help.cat)), close: () => setState({ help: state.help && state.help.topic ? { cat: state.help.cat, topic: null } : { cat: null, topic: null } }) },
  { key: 'drawerOpen', label: 'the menu drawer', open: () => !!state.drawerOpen, close: () => setState({ drawerOpen: false }) }
];
// EVERY KEY THE REGISTRY COVERS, for the suite's completeness check. Exported on the debug hook
// beside the others rather than duplicated into the test, so the two cannot drift apart.
function backLayerKeys() { return BACK_LAYERS.map(l => l.key); }
// Returns what it dismissed, or null if there was nothing left to dismiss on this screen.
function handleBackPress() {
  for (let i = 0; i < BACK_LAYERS.length; i++) {
    if (BACK_LAYERS[i].open()) { BACK_LAYERS[i].close(); return BACK_LAYERS[i].key; }
  }
  // A tab that is not Home goes to Home. This is the "at least go to the previous page" Aaron asked
  // for, and Home is the honest answer for a tab bar: the tabs are siblings, not a trail, so there
  // is no previous page to return to other than the one the app opens on.
  if (state.view !== 'home') { setState({ view: 'home' }); persistView('home'); return 'view'; }
  return null;
}
// ONE HISTORY ENTRY, PUSHED ONCE AND RE-PUSHED AFTER EVERY BACK THE APP HANDLES. The same mechanism
// in a browser tab, in the installed PWA and inside the Capacitor WebView -- Capacitor's own default
// Back walks history and only leaves at the root, so an entry to walk is all it needs. No new plugin
// and no new script tag, which matters on a file that has already been bitten twice by CDN bundles.
function armBackButton() {
  if (typeof window === 'undefined' || !window.history || !window.addEventListener) return;
  try { history.pushState({ cwBack: 1 }, ''); } catch (e) { return; }
  window.addEventListener('popstate', () => {
    const handled = handleBackPress();
    // Re-arm ONLY when the app handled it. When there is nothing left to dismiss the entry is not
    // replaced, so a second Back leaves the app exactly as the phone expects it to.
    if (handled) { try { history.pushState({ cwBack: 1 }, ''); } catch (e) {} }
  });
}

function setState(patch) {"""

src = cut(src, ANCHOR, BLOCK, 'setState')

# Arm it beside the other debug hooks, after init rather than during it.
HOOK = """  window.__doseTest = { parseDoseOptions, normaliseDoseNumber, splitDoseOptions };"""
src = cut(src, HOOK,
"""  window.__doseTest = { parseDoseOptions, normaliseDoseNumber, splitDoseOptions };
  // The back-button registry, for the completeness check in test/v82-back-button.mjs. Exported
  // rather than copied into the suite, so a new layer cannot be added to one and not the other.
  // `stateKeys` is what makes the completeness check real. Without it the suite's "every
  // dismissible thing has a Back rule" assertion had nothing to compare against and PASSED on the
  // absence — a check that reports green loudest when it cannot see anything, which is the exact
  // class this file has been caught on four times.
  window.__backTest = { keys: backLayerKeys, press: handleBackPress, stateKeys: () => Object.keys(state) };""", 'the dose test hook')

# Arm on load, after state exists.
BOOT = """const initialMedicationConfig = loadMedicationConfig();"""
src = cut(src, BOOT, BOOT, 'the boot anchor (unchanged, checked)')
if 'armBackButton();' in src:
    die('armBackButton already called')
# Called at the end of the module, where render() and state are both live.
TAIL = """if (typeof window !== 'undefined') {
  // app-v79: the warning path, for test/v79-warning-priority.mjs. See the note above __syncTest."""
src = cut(src, TAIL,
"""if (typeof window !== 'undefined') {
  // ARMED HERE, not during module init: pushState is harmless that early but the popstate handler
  // calls setState, and `state` is not initialised at the top of this file. loadMedicationConfig
  // learned that the expensive way -- see the TREATMENT_DAYS_MAX comment.
  armBackButton();
  // app-v79: the warning path, for test/v79-warning-priority.mjs. See the note above __syncTest.""",
'the debug-hook tail')

HTML.write_text(src, encoding='utf-8')
print('app-v81 back button applied: the phone Back button walks the app instead of leaving it')
