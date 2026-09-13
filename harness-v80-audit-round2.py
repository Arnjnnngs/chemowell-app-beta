#!/usr/bin/env python3
"""app-v80, round 2: the Zero Day Audit blocked it three times, and the headline is the worst kind.

THE HEADLINE, in the auditor's words: the card can tell a caregiver a medication is due when the app
itself says it never is. Set a medication's "Days taken" to AS NEEDED -- one dropdown, whose own help
text reads "Available any day -- missed doses are never flagged for this medication" -- and the hero
named it and said "Due now", while its own card two inches below said "Available".

WHY I MISSED IT. I guarded on `med.windows.length`, and reasoned that only a windowed medication can
be late for anything. That is true of the SCHEDULE TYPE and false of the DAYS TAKEN: a medication can
be type 'win', carry windows, and still be marked as-needed through `scheduleDays.mode`, which is
where the user actually said it. The commit message claims the hero "draws the same line the
missed-dose walk draws"; the walk draws it on `med.alerts` and I drew it on `windows.length`, and for
this medication those differ. Keying on `med.alerts` makes the two provably identical rather than
similar -- normalizeMedication sets it as exactly `type === 'win' && not as-needed`.
"""
import sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent
HTML = ROOT / 'index.html'

def die(msg):
    print('PATCH FAILED: ' + msg); sys.exit(1)

src = HTML.read_text(encoding='utf-8')
if 'medHasReachableCard' in src:
    die('already applied')

def cut(old, new, what):
    global src
    if src.count(old) != 1:
        die(what + ' is not where it was (found ' + str(src.count(old)) + ') -- nothing written')
    src = src.replace(old, new, 1)

# ---- BLOCK 1: as-needed by DAYS TAKEN, and a medication with nowhere to go ----------------------
cut("""    if (!med) continue;
    if (!(med.windows && med.windows.length)) continue;      // as-needed: available, never due""",
    """    if (!med) continue;
    // `med.alerts`, NOT `med.windows.length`. normalizeMedication sets alerts to exactly
    // `type === 'win' && the schedule days are not "as needed"`, which is the same line the
    // missed-dose walk draws -- so the hero and the walk cannot disagree about what "due" means.
    // Guarding on windows instead let a medication marked AS NEEDED under "Days taken" through: it
    // is type 'win', it has windows, and the app's own help text for that setting says missed doses
    // are never flagged for it. The hero said "Due now" while its card said "Available".
    if (!med.alerts) continue;
    if (!(med.windows && med.windows.length)) continue;
    // AND IT MUST HAVE SOMEWHERE TO SEND THE CAREGIVER. A medication set to "Managed only (no Home
    // card)" was named by the hero, and its button then did nothing at all -- scrollToMedCard found
    // no element and returned -- with no way to log the announced dose anywhere on Home.
    if (!medHasReachableCard(med)) continue;""",
    "nextDueDose's schedule guard")

cut("""function nextDueDose(now) {""",
    """// Is there anywhere on Home for this medication? The hero's only control scrolls to a card, so
// naming a medication that has none leaves a caregiver told a dose is due with nothing to tap.
function medHasReachableCard(med) {
  return !!(med && (med.quickLog || med.groupedMorning || med.groupedAfternoon || med.groupedEvening));
}

function nextDueDose(now) {""",
    'nextDueDose')

# ---- BLOCK 2b: a grouped medication scrolled and never lit up -----------------------------------
cut("""  const groupHook = {};
  meds.forEach(m => { if (m && m.id) groupHook['data-med-card-' + String(m.id).replace(/[^A-Za-z0-9_-]/g, '')] = 'group'; });""",
    """  const groupHook = {};
  let groupFlashed = false;
  meds.forEach(m => {
    if (!m || !m.id) return;
    const k = String(m.id).replace(/[^A-Za-z0-9_-]/g, '');
    groupHook['data-med-card-' + k] = 'group';
    if (state.medFlash === k) groupFlashed = true;
  });
  // THE GROUP CARD LIGHTS UP TOO. It scrolled correctly and never showed the mark, because the mark
  // was rendered only on standalone cards -- so for the morning and evening rounds, which are the
  // batches, the caregiver landed on a card with nothing on it saying why. That is precisely the
  // failure this release's own notes claim to have fixed, left in place for the grouped half.
  if (groupFlashed) groupHook['data-flash'] = 'on';""",
    "the grouped card's hook")
cut("""  return h('section', { ...groupHook, style: { overflowWrap: 'anywhere' } },""",
    """  return h('section', { ...groupHook, style: { overflowWrap: 'anywhere', transition: 'box-shadow .25s ease', ...(groupFlashed ? { boxShadow: '0 0 0 3px rgba(191,76,26,0.55)', borderRadius: '18px' } : {}) } },""",
    "the grouped card's section style")

# ---- the h() null-attribute trap, in a file that warns about it twice ---------------------------
cut("""    return h('div', { 'data-med-card': medHook, 'data-flash': flashed ? 'on' : null, style: {""",
    """    // NOT `'data-flash': flashed ? 'on' : null` -- h() writes the string "null" as an attribute
    // value, so every unflashed card carried data-flash="null". A fresh instance of the trap this
    // file warns about twice, added by the release that quotes the warning.
    return h('div', { 'data-med-card': medHook, ...(flashed ? { 'data-flash': 'on' } : {}), style: {""",
    "the card's flash attribute")

# ---- "Due in 0 minutes", and a dose that is one of several --------------------------------------
cut("""      const whenWords = nx.openNow
        ? 'Due now'
        : mins < 60
          ? ('Due in ' + mins + ' minute' + (mins === 1 ? '' : 's'))
          : ('Due at ' + fmtTime(nx.at));""",
    """      // "Due in 0 minutes" showed for the half-minute before a window opened -- true to the
      // arithmetic and meaningless to read. Under a minute says so in words.
      const whenWords = nx.openNow
        ? 'Due now'
        : mins < 1
          ? 'Due in under a minute'
          : mins < 60
            ? ('Due in ' + mins + ' minute' + (mins === 1 ? '' : 's'))
            : ('Due at ' + fmtTime(nx.at));""",
    'the timing words')
cut("""      const firstDose = nx.med.doses && nx.med.doses.length ? nx.med.doses[0].label : null;""",
    """      // ONLY WHERE THERE IS ONE DOSE TO NAME. A medication with several strengths printed its
      // first as though it were THE dose -- "500 mg" on a card for something the caregiver might be
      // about to give 1,000 mg of. Where there is a choice, the card that offers the choice makes it.
      const firstDose = nx.med.doses && nx.med.doses.length === 1 ? nx.med.doses[0].label : null;""",
    'the dose label')

# ---- a second tap looked dead, because the first tap's timer cleared it --------------------------
cut("""  setState({ medFlash: safe });
  setTimeout(() => { if (state.medFlash === safe) setState({ medFlash: null }); }, 1800);""",
    """  // THE PREVIOUS TIMER IS CANCELLED. Without this, tapping the same button twice inside 1.8s let
  // the first tap's timer clear the second tap's mark, and the control looked broken.
  clearTimeout(medFlashTimer);
  setState({ medFlash: safe });
  medFlashTimer = setTimeout(() => { if (state.medFlash === safe) setState({ medFlash: null }); }, 1800);""",
    "the flash timer")
cut("""function scrollToMedCard(medId) {""",
    """let medFlashTimer = null;
function scrollToMedCard(medId) {""",
    'scrollToMedCard')

# ---- the day's dose figure disappeared from Home entirely ---------------------------------------
cut("""        state.view === 'home' ? null : doseRing(now)""",
    """        // SUPPRESSED ONLY WHERE THE HERO ACTUALLY SHOWS THE SAME FIGURE. `state.view === 'home'`
        // alone hid it on a day with an unlogged past window, where neither the hero nor the
        // all-done card renders -- so the count vanished from the app completely, which is worse
        // than showing it twice.
        (state.view === 'home' && homeShowsDoseCount(now)) ? null : doseRing(now)""",
    "the header's dose ring")
cut("""function doseProgressToday(now) {""",
    """// True exactly when Home is already showing the day's dose count, which is the only condition
// under which the header may drop it.
function homeShowsDoseCount(now) {
  const p = doseProgressToday(now);
  if (p.scheduled <= 0) return false;
  return !!nextDueDose(now) || p.taken >= p.scheduled;
}

function doseProgressToday(now) {""",
    'doseProgressToday')

# ---- contrast, and the 320px card growing under the tab bar -------------------------------------
cut("""            h('div', { style: { ...TYPE.label, color: 'rgba(255,255,255,0.82)' } }, 'Up next'),""",
    """            // 0.82 white on this gradient measured 2.69:1. Full white clears 4.5:1 and the label is
            // small and uppercase, which is where contrast matters most.
            h('div', { style: { ...TYPE.label, color: '#FFFFFF' } }, 'Up next'),""",
    "the Up next label")
cut("""            h('div', { style: { fontSize: '23px', fontWeight: '800', letterSpacing: '-0.02em', lineHeight: '1.15', marginTop: '3px', overflowWrap: 'anywhere' } }, nx.med.name),""",
    """            // CAPPED AT THREE LINES. At 320 a long pasted medication name grew the card to 316px and
            // pushed its only control under the fixed tab bar, which is the app-v75 Home bug in a new
            // place: the control needed to fix the problem is the one carried off-screen. The full
            // name is on the card the button goes to.
            h('div', { style: { fontSize: '23px', fontWeight: '800', letterSpacing: '-0.02em', lineHeight: '1.15', marginTop: '3px', overflowWrap: 'anywhere', display: '-webkit-box', WebkitLineClamp: '3', WebkitBoxOrient: 'vertical', overflow: 'hidden' } }, nx.med.name),""",
    'the hero title')

HTML.write_text(src, encoding='utf-8')
print('app-v80 round 2 applied: as-needed days, a card that exists, and seven more')
