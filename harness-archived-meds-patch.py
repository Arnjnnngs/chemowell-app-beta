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
  * REMINDERS COME BACK EXACTLY AS THEY WERE, AND WHAT IS SUPPRESSED IS THE SPAN IT WAS AWAY --
    BOTH ENDS OF IT. Removal writes down the day the medication left (`removedAt`); restore turns
    that into an `awayPeriods` span from that day to this one; the missed-dose walk skips a day only
    when it falls INSIDE one of those spans.
    THE SECOND VERSION OF THIS RELEASE STAMPED `alertsFrom` AND SKIPPED EVERYTHING BEFORE IT, and
    the audit refused that too -- worse than the first. The span a medication is archived for is
    only ever part of "everything before now", so bringing one back erased every missed dose it had
    ever had: 122 misses over two months gone from the banner, the day summaries and the report
    that goes to the doctor, for a medication off the list for two seconds.
    THE FIRST VERSION OF THIS RELEASE GOT THIS WRONG and the audit refused it -- twice over, in
    opposite directions. It restored the medication with reminders switched OFF, which in ChemoWell
    was erased at the next app open (its normaliser RECOMPUTES `alerts` from the schedule type and
    never reads what was saved), and in care-tracker stayed off FOREVER under a toast promising
    "turn them back on in Edit" when the editor has no such control at all. Either way it removed
    missed-dose cover invisibly, under a button labelled "Bring back".
    The design was wrong, not just the code: "reminders off" trades a VISIBLE, recoverable problem
    -- a wall of missed doses for days she was not taking it -- for an INVISIBLE, unrecoverable one.
    A clinician takes the first every time.
    SAID OUT LOUD, and the audit is right that it matters more than it looks:
      - AN ARCHIVE ENTRY WRITTEN BY ANY EARLIER BUILD HAS NO `removedAt`. It restores with a
        single-day span and suppresses NOTHING. Since no build before this one could list removed
        medications, the first one anybody brings back is necessarily such an entry. The app knows
        which case it is in and SAYS so -- per row and in the toast -- rather than promising
        something it cannot do.
      - A phone still on the OLD build ignores `awayPeriods` and shows the days as missed until it
        updates. Visible and self-correcting; silent loss of alerting would be neither.
      - THE SPAN COMES FROM THE DEVICE CLOCK, so a phone with the wrong date records a wrong span.
      - THE DAY OF THE RESTORE IS ITSELF INSIDE THE SPAN (the range is inclusive at both ends), so
        a dose window already missed earlier that same day is not counted. One day, deliberate: the
        alternative flags a medication for hours when it was not on the list.
      - A SPAN CANNOT BE CLEARED. Restore appends; nothing removes. Bringing a medication back a
        second time adds a second span rather than replacing the first, and no screen shows either.
        Deliberate -- a control that edits suppression is a control that can hide real missed doses
        -- but it means a wrong span stays until the medication is deleted outright.
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
  'promethazine': 'Settles nausea and vomiting, and is also used for allergies. It causes drowsiness.',
  'phenergan': 'Settles nausea and vomiting, and is also used for allergies. It causes drowsiness.',
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
  // EXCEDRIN IS DELIBERATELY NOT HERE, and that is the C principle applied honestly rather than
  // mechanically. The bare name covers products with DIFFERENT ingredients -- Tension Headache
  // has no aspirin, PM swaps the caffeine for a sedating antihistamine -- so no single line is
  // true of all of them. A name that cannot carry one true sentence gets no sentence: the app
  // shows nothing, which is what it already does for every name it does not recognise.
  'vicodin': 'A strong pain reliever that also contains acetaminophen.'
};""")

# ================= A: the archive keeps the whole medication ===================================
rep("""    archived[id] = { name: String(value.name || id), sub: String(value.sub || ''), pausePeriods: normalizePausePeriods(value.pausePeriods) };""",
    """    // app-v73: the CONFIG is preserved when the archive carries one -- the same line, for the same
    // reason, as the pausePeriods one above it. This function runs on every load, so without it the
    // widened archive written below is stripped straight back out again. A corrupted or hand-edited
    // archive cannot inject a malformed medication: whatever it holds goes through
    // normalizeMedication() exactly like any other.
    const entry = { name: String(value.name || id), sub: String(value.sub || ''), pausePeriods: normalizePausePeriods(value.pausePeriods) };
    if (Number(value.removedAt)) entry.removedAt = Number(value.removedAt);
    if (value.config && typeof value.config === 'object') {
      try { entry.config = normalizeMedication(JSON.parse(JSON.stringify(value.config))); } catch (e) {}
    }
    archived[id] = entry;""")

rep("""  const archivedMeds = { ...(state.archivedMeds || {}), [id]: { name: med.name, sub: med.sub || '', pausePeriods: archivedPausePeriods } };""",
    """  // app-v73: archive the WHOLE medication, not just its name and pause record. Until now removing
  // one threw away its doses, windows, limits and notes -- in an app where every medication is one
  // the user typed, that is the whole of their work on it.
  const archivedMeds = { ...(state.archivedMeds || {}), [id]: { name: med.name, sub: med.sub || '', pausePeriods: archivedPausePeriods, config: JSON.parse(JSON.stringify(med)), removedAt: dayStart(state.now || Date.now()) } };""")

# ================= A: restoring =================================================================
rep("""function deleteMedicationConfig(id) {""",
    """// ---- BRINGING A MEDICATION BACK (app-v73) ----
// REMINDERS COME BACK EXACTLY AS THEY WERE. What is suppressed is the SPAN IT WAS AWAY, both ends
// of it: removal writes down the day the medication left, restore turns that into an `awayPeriods`
// span ending today, and the missed-dose walk skips a day only when it falls INSIDE one.
// The audit refused two earlier designs here. The first switched reminders OFF -- erased at the next
// load by a normaliser in one app, permanent with no control to undo it in the other, and either way
// a silent loss of missed-dose cover under a button labelled "Bring back". The second suppressed
// everything BEFORE the restore day, which erased the medication's entire missed-dose history.
// AN ENTRY FROM AN OLDER BUILD CARRIES NO `removedAt` and gets a single-day span, so it suppresses
// nothing -- the toast and the row say so rather than promising otherwise.
// PAUSE PERIODS DO come back: app-v20 archives them precisely so a medication re-added later is not
// flagged for days it was legitimately paused, and dropping them here would undo that from the
// other end.
function restoreMedicationConfig(id) {
  // hasOwnProperty, NOT a bare index -- the guard every neighbouring lookup in this file got after
  // v74, when a medication named `Constructor` read back Object.prototype's own property and
  // destroyed the Meds screen permanently.
  const archive = state.archivedMeds || {};
  const entry = Object.prototype.hasOwnProperty.call(archive, id) ? archive[id] : null;
  if (!entry || typeof entry !== 'object') return;
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
  // REMINDERS COME BACK AS THEY WERE. What is suppressed is the SPAN IT WAS AWAY -- from the day it
  // left the list to today -- and nothing outside it. The first version switched reminders off
  // instead, which removed safety cover invisibly; the second suppressed everything BEFORE the
  // restore, which erased the medication's entire missed-dose history from the banner, the day
  // summaries and the clinician export. Both ends, or it is not a gap.
  // An archive written before this release carries no removedAt: that restore gets a single-day
  // span, which suppresses nothing that matters and never reaches backwards.
  // WHETHER THE APP EVER KNEW. An entry written before this release carries no `removedAt`, so the
  // span collapses to a single day and suppresses nothing. That is the right fallback -- it can
  // never reach backwards over days the medication was on the list -- but it is NOT what the copy
  // used to promise, and the first medication anybody brings back is necessarily such an entry.
  const knewWhenItLeft = !!Number(entry.removedAt);
  const awayFrom = dayStart(Number(entry.removedAt) || (state.now || Date.now()));
  const awayTo = dayStart(state.now || Date.now());
  med.awayPeriods = (Array.isArray(med.awayPeriods) ? med.awayPeriods : [])
    .filter(p => p && Number(p.start) && Number(p.end))
    .concat([{ start: awayFrom, end: awayTo }]);
  med.pausePeriods = normalizePausePeriods(entry.pausePeriods);
  const meds = state.meds.concat([med]);
  const archivedMeds = { ...(state.archivedMeds || {}) };
  delete archivedMeds[id];
  persistMedicationConfig(meds, archivedMeds);
  setState({ meds, archivedMeds, confirmRestoreMed: null });
  setToast(med.name + (hadConfig ? ' is back, with its doses and rules.'
    : ' is back. Its doses and rules were not kept \\u2014 set them in Edit.')
    + (knewWhenItLeft
        ? ' Its reminders come back on, and the days it was off the list are not counted as missed.'
        : ' Its reminders come back on. The app has no record of when you removed it, so the days it was away will still show as missed.'));
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
    .map(([id, item]) => {
      const left = Number(item.removedAt) || 0;
      return { id: id, name: String(item.name || id), sub: String(item.sub || ''), config: !!item.config,
        removedAt: left, daysAway: left ? Math.round((dayStart(state.now || Date.now()) - dayStart(left)) / 86400000) : 0 };
    })
    .sort((a, b) => a.name.localeCompare(b.name));""")

rep("""    h('div', { style: { display: 'flex', flexDirection: 'column', gap: '9px' } }, ...cards),
    null // v12 redundancy cut: stale "now live in Settings" breadcrumb removed""",
    """    h('div', { style: { display: 'flex', flexDirection: 'column', gap: '9px' } }, ...cards),
    // ONLY when something has been removed. A heading over an empty list is a notice about
    // nothing -- the defect the v72 audit found in the disclaimer two lines above.
    archivedList.length ? h('div', { 'data-archived-meds': 'true', style: { marginTop: '18px' } },
      h('div', { style: { ...TYPE.label, color: '#915E48', marginBottom: '4px' } }, 'Removed medications'),
      h('div', { style: { ...TYPE.caption, color: '#6B5F66', lineHeight: '1.4', marginBottom: '9px' } },
        'Their dose history is still in the app. Bring one back and its old doses read properly again, with its reminders on. Each one says below whether the days it was away will still count as missed.'),
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '9px' } }, ...archivedList.map(item => {
        const restoring = state.confirmRestoreMed === item.id;
        return h('article', { 'data-archived-med': item.id, style: { background: '#FFFFFF', border: '1px dashed #E0CEC6', borderRadius: '15px', padding: '12px', display: 'flex', alignItems: 'center', gap: '10px', overflowWrap: 'anywhere' } },
          h('div', { style: { minWidth: '0', flex: '1' } },
            h('div', { style: { ...TYPE.title, color: '#554A52' } }, item.name),
            h('div', { style: { ...TYPE.caption, color: '#6B5F66', marginTop: '1px' } },
              (item.sub || 'No generic name') + (item.config ? '' : ' \\u00b7 doses and rules were not kept')),
            h('div', { style: { fontSize: '11px', color: '#8A7280', fontWeight: '600', marginTop: '2px' } },
              item.removedAt
                ? (item.daysAway <= 0 ? 'Removed today' : item.daysAway === 1 ? 'Removed yesterday' : 'Removed ' + item.daysAway + ' days ago') + ' \\u00b7 those days will not count as missed'
                : 'Removed before this update \\u2014 the app cannot tell when, so those days will still count as missed')
          ),
          h('button', { onClick: () => restoreMedicationConfig(item.id), 'aria-label': restoring ? 'Confirm bringing back ' + item.name : 'Bring back ' + item.name, style: { flexShrink: '0', minHeight: '44px', padding: '0 13px', borderRadius: '999px', background: restoring ? '#0A6B4A' : 'rgba(10,107,74,0.10)', color: restoring ? '#fff' : '#0A6B4A', border: '1px solid ' + (restoring ? '#0A6B4A' : 'rgba(10,107,74,0.28)'), fontSize: '13px', fontWeight: '700' } }, restoring ? 'Yes, bring it back' : 'Bring back')
        );
      }))
    ) : null,
    null // v12 redundancy cut: stale "now live in Settings" breadcrumb removed""")

# ---- THE DAYS IT WAS AWAY ARE NOT MISSED DOSES. BOTH ENDS. ------------------------------------
# The audit refused two designs here before this one, and each time the design was wrong rather than
# only the code.
#   (1) Restore with reminders switched OFF -- erased at the next load in one app by a normaliser
#       that recomputes `alerts`, permanent in the other under a toast promising a control that does
#       not exist. Either way it removed missed-dose cover invisibly.
#   (2) Stamp `alertsFrom` and skip every day BEFORE it -- which erased the medication's entire
#       missed-dose history, because the span it was archived for is only ever part of "everything
#       before now". 122 misses over two months, gone from the banner, the day summaries and the
#       clinician export, for a medication off the list for two seconds.
# What ships reads `awayPeriods` and skips a day only when the day falls INSIDE one of those spans.
# No medication that was never archived carries the field, so this line does nothing at all for any
# of them, and the engine is otherwise identical.
rep("""  state.meds.filter(m => m.alerts && m.windows).forEach(med => {""",
    """  state.meds.filter(m => m.alerts && m.windows).forEach(med => {
    // BROUGHT BACK FROM THE ARCHIVE: the days it was AWAY are not missed doses. Both ends matter.
    // The version before this one suppressed everything before the restore day, so bringing a
    // medication back erased its whole missed-dose history -- 122 misses over two months, gone from
    // the banner, the day summaries and the report that goes to the doctor, for a medication that
    // had been off the list for two seconds.
    if ((med.awayPeriods || []).some(p => p && d0 >= dayStart(p.start) && d0 <= dayStart(p.end))) return;""")

# ---- TWO THINGS THE AUDIT FOUND AROUND THE NEW CONTROL ----------------------------------------
# 1. A half-armed "Bring back" survived navigation. The confirm beside it -- Remove -- has been
#    cleared on every view change since long before this release; this one was not, so leaving the
#    Meds screen and coming back left a button one tap from acting.
rep("""  const next = { view, reportsView: view === 'reports' ? null : state.reportsView, medEditor: view === 'meds' ? state.medEditor : null, confirmDeleteMed: null };""",
    """  // v75/app-v73: a half-armed "Bring back" is cleared on navigation exactly like a half-armed
  // Remove. Leaving it armed means coming back to the Meds screen later and finding a button
  // already one tap from acting -- the audit found it, and the neighbouring confirm has been
  // cleared here since long before this release.
  const next = { view, reportsView: view === 'reports' ? null : state.reportsView, medEditor: view === 'meds' ? state.medEditor : null, confirmDeleteMed: null, confirmRestoreMed: null };""")

# 2. THE 1s TICK GUARD. This file's own comment calls the exclusion list "a recurring bug class
#    (v11, v22, v27 all hit the same thing -- a new confirm state gets added below and nobody
#    remembers to list it here)". app-v73 added a sixth confirm and did exactly that: measured
#    against the guarded control in the same session, an armed Remove kept the SAME node while an
#    armed Bring back was REBUILT every second, dropping focus once a second under the caregiver.
rep("""&& !state.confirmDeleteMed &&""",
    """&& !state.confirmDeleteMed && !state.confirmRestoreMed &&""")

# ---- THE MISSED-DOSE BANNER GETS THE HOOK ITS SIBLING ALREADY HAS ------------------------------
# Without it a suite cannot tell "no banner, because there is nothing to report" from "a banner it
# cannot read" -- and those two must never collapse into the same answer in a file whose subject is
# a safety claim about that banner. One attribute, no behaviour change.
rep("""h('button', { onClick: (ev) => { ev.stopPropagation(); clearMissedDoses(); }, style: { flexShrink: '0', minHeight: '44px'""",
    """h('button', { onClick: (ev) => { ev.stopPropagation(); clearMissedDoses(); }, 'data-missed-clear': 'true', style: { flexShrink: '0', minHeight: '44px'""")

# ---- THE SPANS ARE VALIDATED, LIKE EVERY OTHER STORED LIST ------------------------------------
# The third audit pass found `awayPeriods` going into the missed-dose walk unchecked, while the
# field it behaves like -- pausePeriods -- is validated. A malformed span fails safe; a WIDE one
# does not, and medsync accepts a medication config from another device.
rep("""  if (doses && doses.length) medication.doses = doses; else delete medication.doses;""",
    """  // v75: THE SPANS THE MEDICATION WAS OFF THE LIST, VALIDATED. This function runs on every load and
  // over anything medsync publishes from another device, and it hands the result straight to the
  // missed-dose walk. A malformed span fails safe -- every comparison against NaN is false, so
  // nothing is suppressed -- but a WIDE one does not: {start: 0, end: <huge>} would swallow the
  // whole record. Nothing in this release can write that; medsync means the walk should not be the
  // thing that trusts it. Same shape of guard the sibling app's pausePeriods already gets.
  const awaySpans = (Array.isArray(original.awayPeriods) ? original.awayPeriods : [])
    .map(span => ({ start: Number(span && span.start), end: Number(span && span.end) }))
    .filter(span => isFinite(span.start) && isFinite(span.end)
      && span.start > 0 && span.end > 0 && span.start <= span.end
      // AND IT CANNOT END IN THE FUTURE. This app only ever writes a span ending on the day of the
      // restore, so an end beyond now did not come from it -- and that is the shape that does real
      // damage: {start: 1, end: <far future>} suppresses every missed dose the record holds.
      // Rejecting malformed spans was not enough; the first version of this filter passed that one.
      // SAID OUT LOUD, because it is a real limit rather than an oversight: a span ending in the
      // PAST cannot be checked this way, because it is indistinguishable from a medication that was
      // genuinely off the list for a long time. Nothing here can write one, and a span only ever
      // changes what the missed-dose banner counts -- no entry is written, edited or deleted by any
      // of this -- so the worst case is under-reporting, which is visible and undone by deleting the
      // medication.
      && span.end <= Date.now());
  if (awaySpans.length) medication.awayPeriods = awaySpans; else delete medication.awayPeriods;
  if (doses && doses.length) medication.doses = doses; else delete medication.doses;""")

if "const APP_VERSION = '%s';" % FROM_V not in s: sys.exit('REFUSING: version stamp missing')
rep("const APP_VERSION = '%s';" % FROM_V, "const APP_VERSION = '%s';" % TO_V)

open(out, 'w', encoding='utf-8').write(s)

sw_path = os.path.join(os.path.dirname(out) or '.', 'sw.js')
sw = open(sw_path, encoding='utf-8').read()
if FROM_C not in sw: sys.exit('REFUSING: sw.js cache is not %s' % FROM_C)
open(sw_path, 'w', encoding='utf-8').write(sw.replace(FROM_C, TO_C))
print('patched %s -> %s (cache %s -> %s)' % (FROM_V, TO_V, FROM_C, TO_C))
