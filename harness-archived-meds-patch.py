#!/usr/bin/env python3
"""
harness-archived-meds-patch.py -- app-v73. Three things Aaron picked on 2026-09-11: "Do A, B and C."

A. REMOVED MEDICATIONS CAN BE SEEN AND BROUGHT BACK. The app has carried `archivedMeds` for many
   releases -- removing a medication keeps its name so old doses still render properly -- but no
   screen listed them and nothing brought one back. A medication paused between cycles had to be
   typed in again, and came back under a NEW id, so every dose that referenced the old one reads as
   a removed medication. The data was never lost; it was unreachable.

B. THE PURPOSE TABLE GAINS THE MEDICATIONS IT WAS MISSING -- Neulasta, Reglan / metoclopramide,
   Phenergan / promethazine, and the brand halves of a dozen drugs it already covered by generic
   name, where typing the brand showed no line at all.

C. COMBINATION PRODUCTS GET THEIR OWN LINE. `Tylenol PM` with the generic field filled in as
   acetaminophen used to read "Eases pain." -- true, and incomplete, because it also contains a
   sedating antihistamine. A name that is a combination product now matches BEFORE the generic
   fallback and says what is actually in it.

THE WRITE MODEL FOR A, stated before a line was written.

  * APPENDS: nothing. No code path here writes, edits or deletes an ENTRY.
  * CHANGES: the medication CONFIG only -- `meds` and `archivedMeds` -- through the existing
    persistMedicationConfig(), the path every medication edit already uses.
  * THE ARCHIVE NOW KEEPS THE WHOLE MEDICATION (`config`) beside the {name, sub, pausePeriods} it
    already kept. Nothing that used to be kept is dropped. There is precedent in this very file:
    app-v20 widened this same record to keep pausePeriods, for the same reason, and had to add the
    matching line to normalizeArchivedMeds because otherwise the next load stripped it straight
    back out again.
  * RESTORE PUTS IT BACK UNDER ITS ORIGINAL ID. That is the point: every stored dose references
    that id, so the old doses read properly again. A new id leaves them orphaned, which is exactly
    what typing the medication in again does today.
  * RESTORE ALWAYS COMES BACK WITH REMINDERS OFF, whatever the archive says, and the app says so.
    THIS IS THE TRAP THIS RELEASE EXISTS TO AVOID. The missed-dose walk reads every tracked
    medication for every day in range, so restoring one with alerts on flags every dose window
    during the weeks it was archived -- the wall of red that ending a hospital stay produced once
    already, and the reason per-window suppression was built.
  * PAUSE PERIODS COME BACK TOO. app-v20 archives them precisely so a medication re-added later is
    not flagged for days it was legitimately paused; dropping them on the way back in would undo
    that fix from the other end.
  * TIE-BREAK: if an ACTIVE medication already holds that id, restore is REFUSED by name.
  * TWICE: the second restore is a no-op -- the id is gone from the archive after the first.
  * THIS APP SHIPS NO DEFAULT MEDICATIONS (DEFAULT_MEDS is empty by design: every medication is one
    the user typed). So where care-tracker can fall back to the medication it ships with, this app
    cannot, and the copy says the doses and rules were not kept rather than implying otherwise.

Usage:  python3 harness-archived-meds-patch.py [--base <index.html>] [--out index.html]
The version stamp lives INSIDE this patch: it refuses a base that is not app-v72 and emits app-v73.
"""
import re, sys, os

HERE = os.path.dirname(os.path.abspath(__file__))
FROM_V, TO_V = 'app-v72', 'app-v73'
FROM_C, TO_C = 'chemowell-app-v72-1', 'chemowell-app-v73-1'

args = sys.argv[1:]
base = args[args.index('--base') + 1] if '--base' in args else os.path.join(HERE, 'index.html')
out = args[args.index('--out') + 1] if '--out' in args else os.path.join(HERE, 'index.html')

s = open(base, encoding='utf-8').read()
m = re.search(r"const APP_VERSION = '([^']+)';", s)
if not m or m.group(1) != FROM_V:
    sys.exit('REFUSING: base is %s, this patch transforms %s -> %s' % (m.group(1) if m else '?', FROM_V, TO_V))


def rep(old, new, n=1):
    global s
    c = s.count(old)
    if c != n:
        sys.exit('REFUSING: expected %d match(es), found %d for:\n%s' % (n, c, old[:200]))
    s = s.replace(old, new)


# ================= B and C: the table ==========================================================
# EVERY LINE HERE IS A NEW MEDICAL CLAIM and was read as one. No dose, no schedule, no dosage form,
# no route, no body site, no fever claim -- the guards this table has collected over nine audit
# passes apply to these exactly as to the originals.
# COMBINATION PRODUCTS ARE KEYED BY THEIR OWN NAME so the name lookup matches BEFORE the generic
# fallback. Without that, `Tylenol PM` with a generic of acetaminophen read "Eases pain." -- true,
# and incomplete for a product that also contains a sedating antihistamine.
rep("""  'benadryl': 'An antihistamine, used for allergic reactions and to help with sleep.'
};""",
    """  'benadryl': 'An antihistamine, used for allergic reactions and to help with sleep.',
  // app-v73 (B): the ones the table was missing entirely.
  'neulasta': 'Helps the body make white blood cells.',
  'metoclopramide': 'Settles nausea and helps the stomach empty.',
  'reglan': 'Settles nausea and helps the stomach empty.',
  'promethazine': 'Settles nausea and vomiting, and is also used for allergies.',
  'phenergan': 'Settles nausea and vomiting, and is also used for allergies.',
  // app-v73 (B): brand halves of drugs the table already covered by generic name. Typing the brand
  // used to show no line at all, which reads as "the app does not know this one".
  'motrin': 'Eases pain and swelling.',
  'ms contin': 'A strong pain reliever for moderate to severe pain.',
  'oxycontin': 'A strong pain reliever for moderate to severe pain.',
  'roxicodone': 'A strong pain reliever for moderate to severe pain.',
  'ultram': 'A pain reliever for moderate pain.',
  'neurontin': 'Eases nerve pain, and is also used for some seizures.',
  'lidoderm': 'Numbs the area where it is used.',
  'xylocaine': 'Numbs the area where it is used.',
  'prilosec': 'Lowers stomach acid, which protects the stomach and eases reflux.',
  'pepcid': 'Lowers stomach acid, which eases reflux and heartburn.',
  'colace': 'A stool softener for constipation.',
  'buspar': 'Eases anxiety.',
  'paxil': 'Treats depression, and is also used for anxiety.',
  'zoloft': 'Treats depression, and is also used for anxiety.',
  'zyloprim': 'Lowers uric acid levels.',
  // app-v73 (C): COMBINATION PRODUCTS. Each names what is actually in it, because the generic
  // fallback would otherwise describe one ingredient and stay silent about the other.
  'tylenol pm': 'Eases pain, and also contains an antihistamine that helps with sleep.',
  'percocet': 'A strong pain reliever that also contains acetaminophen.',
  'norco': 'A strong pain reliever that also contains acetaminophen.',
  'vicodin': 'A strong pain reliever that also contains acetaminophen.',
  'excedrin': 'Eases pain. It also contains aspirin and caffeine.'
};""")

# ================= A: the archive keeps the whole medication ===================================
rep("""    archived[id] = { name: String(value.name || id), sub: String(value.sub || ''), pausePeriods: normalizePausePeriods(value.pausePeriods) };""",
    """    // app-v73: the CONFIG is preserved when the archive carries one -- the same line, for the same
    // reason, as the pausePeriods one above it. This function runs on every load, so without it the
    // widened archive written below is stripped straight back out again. A corrupted or hand-edited
    // archive cannot inject a malformed medication: whatever it holds goes through
    // normalizeMedication() exactly like any other.
    const entry = { name: String(value.name || id), sub: String(value.sub || ''), pausePeriods: normalizePausePeriods(value.pausePeriods) };
    if (value.config && typeof value.config === 'object') {
      try { entry.config = normalizeMedication(JSON.parse(JSON.stringify(value.config))); } catch (e) {}
    }
    archived[id] = entry;""")

rep("""  const archivedMeds = { ...(state.archivedMeds || {}), [id]: { name: med.name, sub: med.sub || '', pausePeriods: archivedPausePeriods } };""",
    """  // app-v73: archive the WHOLE medication, not just its name and pause record. Until now removing
  // one threw away its doses, windows, limits and notes -- in an app where every medication is one
  // the user typed, that is the whole of their work on it.
  const archivedMeds = { ...(state.archivedMeds || {}), [id]: { name: med.name, sub: med.sub || '', pausePeriods: archivedPausePeriods, config: JSON.parse(JSON.stringify(med)) } };""")

# ================= A: restoring =================================================================
rep("""function deleteMedicationConfig(id) {""",
    """// ---- BRINGING A MEDICATION BACK (app-v73) ----
// REMINDERS COME BACK OFF, ALWAYS, WHATEVER THE ARCHIVE SAYS. The missed-dose walk reads every
// tracked medication for every day in range, so a medication restored with alerts on is flagged for
// every dose window during the weeks it was archived -- a wall of red for days nobody was ever
// meant to take it. That is the flood ending a hospital stay produced once already. It comes back
// silent, and the caregiver turns reminders on again in Edit when she wants them.
// PAUSE PERIODS DO come back: app-v20 archives them precisely so a medication re-added later is not
// flagged for days it was legitimately paused, and dropping them here would undo that from the
// other end.
function restoreMedicationConfig(id) {
  const entry = (state.archivedMeds || {})[id];
  if (!entry) return;
  // TIE-BREAK, and the reason this control exists at all. The id is what every stored dose points
  // at. If an active medication already holds it, putting this one back would collide; giving it a
  // NEW id instead would orphan its whole dose history, which is exactly what typing the medication
  // in again does today and the thing this is here to stop.
  if (state.meds.some(item => item.id === id)) {
    setToast('A medication called ' + (entry.name || id) + ' is already on the list. Remove or rename that one first.');
    return;
  }
  if (state.confirmRestoreMed !== id) { setState({ confirmRestoreMed: id }); return; }
  let med = null;
  const hadConfig = !!entry.config;
  if (hadConfig) med = normalizeMedication(JSON.parse(JSON.stringify(entry.config)));
  else med = normalizeMedication({ id: id, name: entry.name || id, sub: entry.sub || '' });
  med.id = id;
  med.alerts = false;
  med.pausePeriods = normalizePausePeriods(entry.pausePeriods);
  const meds = state.meds.concat([med]);
  const archivedMeds = { ...(state.archivedMeds || {}) };
  delete archivedMeds[id];
  persistMedicationConfig(meds, archivedMeds);
  setState({ meds, archivedMeds, confirmRestoreMed: null });
  setToast(med.name + (hadConfig ? ' is back, with its doses and rules.'
    : ' is back. Its doses and rules were not kept \\u2014 set them in Edit.')
    + ' Reminders are off so the days it was away are not counted as missed.');
  markNotifDirty(); // whatever alarms this medication had are gone; nothing new is armed
}
function deleteMedicationConfig(id) {""")

rep("""function deleteMedicationConfig(id) {
  const med = state.meds.find(item => item.id === id);
  if (!med) return;
  if (state.confirmDeleteMed !== id) { setState({ confirmDeleteMed: id }); return; }""",
    """function deleteMedicationConfig(id) {
  const med = state.meds.find(item => item.id === id);
  if (!med) return;
  // app-v73: starting a removal clears any half-tapped restore, so the two confirmations can never
  // be armed at once and a second tap can never land on the control she was not looking at.
  if (state.confirmRestoreMed) setState({ confirmRestoreMed: null });
  if (state.confirmDeleteMed !== id) { setState({ confirmDeleteMed: id }); return; }""")

# ================= A: the screen ================================================================
rep("""  const sortedMeds = state.meds.slice().sort((a, b) => a.name.localeCompare(b.name));""",
    """  const sortedMeds = state.meds.slice().sort((a, b) => a.name.localeCompare(b.name));
  // app-v73: what has been removed, in the same order the active list uses.
  const archivedList = Object.entries(state.archivedMeds || {})
    .map(([id, item]) => ({ id: id, name: String(item.name || id), sub: String(item.sub || ''), config: !!item.config }))
    .sort((a, b) => a.name.localeCompare(b.name));""")

rep("""    h('div', { style: { display: 'flex', flexDirection: 'column', gap: '9px' } }, ...cards),
    null // v12 redundancy cut: stale "now live in Settings" breadcrumb removed""",
    """    h('div', { style: { display: 'flex', flexDirection: 'column', gap: '9px' } }, ...cards),
    // ONLY when something has been removed. A heading over an empty list is a notice about
    // nothing -- the defect the v72 audit found in the disclaimer two lines above.
    archivedList.length ? h('div', { 'data-archived-meds': 'true', style: { marginTop: '18px' } },
      h('div', { style: { ...TYPE.label, color: '#915E48', marginBottom: '4px' } }, 'Removed medications'),
      h('div', { style: { ...TYPE.caption, color: '#6B5F66', lineHeight: '1.4', marginBottom: '9px' } },
        'Their dose history is still in the app. Bring one back and its old doses read properly again \\u2014 it returns with reminders off, so the days it was away are not counted as missed.'),
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '9px' } }, ...archivedList.map(item => {
        const restoring = state.confirmRestoreMed === item.id;
        return h('article', { 'data-archived-med': item.id, style: { background: '#FFFFFF', border: '1px dashed #E0CEC6', borderRadius: '15px', padding: '12px', display: 'flex', alignItems: 'center', gap: '10px', overflowWrap: 'anywhere' } },
          h('div', { style: { minWidth: '0', flex: '1' } },
            h('div', { style: { ...TYPE.title, color: '#554A52' } }, item.name),
            h('div', { style: { ...TYPE.caption, color: '#6B5F66', marginTop: '1px' } },
              (item.sub || 'No generic name') + (item.config ? '' : ' \\u00b7 doses and rules were not kept'))
          ),
          h('button', { onClick: () => restoreMedicationConfig(item.id), 'aria-label': restoring ? 'Confirm bringing back ' + item.name : 'Bring back ' + item.name, style: { flexShrink: '0', minHeight: '44px', padding: '0 13px', borderRadius: '999px', background: restoring ? '#0A6B4A' : 'rgba(10,107,74,0.10)', color: restoring ? '#fff' : '#0A6B4A', border: '1px solid ' + (restoring ? '#0A6B4A' : 'rgba(10,107,74,0.28)'), fontSize: '13px', fontWeight: '700' } }, restoring ? 'Yes, bring it back' : 'Bring back')
        );
      }))
    ) : null,
    null // v12 redundancy cut: stale "now live in Settings" breadcrumb removed""")

if "const APP_VERSION = '%s';" % FROM_V not in s: sys.exit('REFUSING: version stamp missing')
rep("const APP_VERSION = '%s';" % FROM_V, "const APP_VERSION = '%s';" % TO_V)

open(out, 'w', encoding='utf-8').write(s)

sw_path = os.path.join(os.path.dirname(out) or '.', 'sw.js')
sw = open(sw_path, encoding='utf-8').read()
if FROM_C not in sw: sys.exit('REFUSING: sw.js cache is not %s' % FROM_C)
open(sw_path, 'w', encoding='utf-8').write(sw.replace(FROM_C, TO_C))
print('patched %s -> %s (cache %s -> %s)' % (FROM_V, TO_V, FROM_C, TO_C))
