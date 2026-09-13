#!/usr/bin/env python3
"""app-v75 -> app-v76: HARDCODED_MEDS_PLAN.md PHASE 1 — make the behaviours expressible as data.

AARON, 2026-08-19: "nothing should be working off hard coding. we should be able to use the meds in
the list and determine when it should show up and apply. at no point in time should Brandi's meds
ever show in code for chemowell. scrub that entirely."
AARON, 2026-09-13: "I don't care if all the code need rewritten for chemowell." Then, approving the
sequence: "Do the order you recommended."

WHAT PHASE 1 IS, AND WHAT IT DELIBERATELY IS NOT.

Seventeen branches in this file ask "is this medication Zofran?" or "is this Dexamethasone?" and
apply another patient's regimen if the answer is yes. The app knows that is unsafe for strangers:
RESERVED_LEGACY_MED_IDS forbids users from creating a medication with any of those thirteen names,
so a real customer who takes Zofran gets the id `zofran-2` and inherits nothing. Thirteen real drug
names are unusable, and the behaviours themselves are useful -- they are simply attached to an id
instead of to something the user can set.

PHASE 1 ADDS THE PROPERTIES AND CHANGES NO BEHAVIOUR AT ALL. Every resolver below reads the
property first and falls through to the exact legacy branch when it is absent. On today's data every
property is absent, so every answer is byte-identical to app-v75's. That is the whole point, and
every existing suite staying green is the proof. Phase 2 migrates the thirteen ids onto properties
and deletes the legacy branches, with an old-path/new-path equivalence simulation. Phase 3 deletes
the fence.

WHY IT IS SPLIT THIS WAY: this is the scheduling engine of a medication app. A mistake here does not
crash -- it shows up as a dose that was never prompted for, or a missed-dose alert that never fires.
That failure is silent and this project has shipped it before (v43.3: correcting a schedule type
silently disabled missed-dose alerts). Adding a code path that cannot yet be reached is the cheapest
possible way to get the shape wrong in public and find out.

THE FIVE PROPERTIES

  chemoRelativeWindows: [{ dayOffset, start, end, name }]
      Time windows that depend on where today sits relative to a treatment date. Replaces
      `med.id === 'dexamethasone' ? dexWindowsForOffset(...)`.
  chemoBlock: { fromDayOffset, toDayOffset }
      Not loggable for a span around a treatment date. Replaces `zofranBlockedOn`.
  linkedTo: { medId, half }
      This medication's window opens when ANOTHER medication was actually taken. Replaces
      `morningLinkedToProtonix` / `eveningLinkedToProtonix`.
  interactions: [{ withMedId, minGapH, title, body }]
      Warn when two medications are logged too close together. Replaces the iron/protonix branch.
  homeCard: { kind: 'mg' | 'pills' | 'ml' }
      Which daily-total card this medication gets on Home. Replaces `usedRecently('tylenol')` and
      friends. (Wired in phase 2; normalised here so stored data is ready.)

WHAT IT APPENDS: five optional fields on a medication's CONFIG (not on any entry). No entry shape
changes, no migration, no stored record is rewritten.
WHAT IT DELETES: nothing.
HOW IT TIE-BREAKS: the property wins where present; otherwise the legacy branch, unchanged.
"""
import sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent
HTML = ROOT / 'index.html'
SW = ROOT / 'sw.js'

def die(msg):
    print('PATCH FAILED: ' + msg); sys.exit(1)

src = HTML.read_text(encoding='utf-8')
if 'function medWindowsFor(' in src:
    die('already applied')

# ---- 1. normalise the new properties ------------------------------------------------------------
# `...original` already carries unknown fields through, so these would survive without help. They are
# normalised anyway: a malformed one reaching a render is a blank Meds screen, which is the only place
# edit and delete live. Every one of these is shaped like something the med editor will write in
# phase 4, so the shape is settled before any UI can write a bad version of it.
NORMALISE = """
// ---- app-v76 PHASE 1: the five properties that replace thirteen hardcoded medication ids --------
// Read HARDCODED_MEDS_PLAN.md. Phase 1 adds these and changes NO behaviour: every resolver below
// falls through to the legacy branch when the property is absent, and on today's data every one is
// absent. Existing suites staying green is the proof.
function normChemoRelativeWindows(raw) {
  if (!Array.isArray(raw)) return undefined;
  const out = raw.map((w, i) => ({
    // dayOffset is relative to the treatment date: 0 = the day itself, -1 = the day before.
    dayOffset: Math.trunc(Number(w && w.dayOffset) || 0),
    start: Math.max(0, Math.min(23.75, Number(w && w.start) || 0)),
    end: Math.max(1, Math.min(24, Number(w && w.end) || 24)),
    name: String((w && w.name) || ('Window ' + (i + 1)))
  })).filter(w => w.end > w.start);
  return out.length ? out : undefined;
}
function normChemoBlock(raw) {
  if (!raw || typeof raw !== 'object') return undefined;
  const from = Math.trunc(Number(raw.fromDayOffset) || 0);
  const to = Math.trunc(Number(raw.toDayOffset) || 0);
  // An inverted span would block nothing and read as if it blocked something, which is the worse of
  // the two failures: the caregiver sees a rule on screen that the app is not applying.
  if (to < from) return undefined;
  return { fromDayOffset: from, toDayOffset: to };
}
function normLinkedTo(raw) {
  if (!raw || typeof raw !== 'object') return undefined;
  const medId = safeMedicationId(raw.medId, '');
  if (!medId || medId === 'medication') return undefined;
  return { medId, half: raw.half === 'evening' ? 'evening' : 'morning' };
}
function normInteractions(raw) {
  if (!Array.isArray(raw)) return undefined;
  const out = raw.map(x => {
    if (!x || typeof x !== 'object') return null;
    const withMedId = safeMedicationId(x.withMedId, '');
    if (!withMedId || withMedId === 'medication') return null;
    const minGapH = Math.max(0, Number(x.minGapH) || 0);
    if (!minGapH) return null;
    const title = String(x.title || '').trim();
    const body = String(x.body || '').trim();
    // A warning with nothing to say is worse than none: it interrupts and then explains nothing.
    if (!title || !body) return null;
    return { withMedId, minGapH, title, body };
  }).filter(Boolean);
  return out.length ? out : undefined;
}
function normHomeCard(raw) {
  if (!raw || typeof raw !== 'object') return undefined;
  const kind = ['mg', 'pills', 'ml'].includes(raw.kind) ? raw.kind : null;
  return kind ? { kind } : undefined;
}
"""

anchor = "function normalizeMedication(raw, index) {"
if src.count(anchor) != 1:
    die('normalizeMedication is not where it was')
src = src.replace(anchor, NORMALISE.strip() + "\n" + anchor, 1)

# and actually run them on the medication
field_anchor = """    groupedAfternoon: !!original.groupedAfternoon,"""
if src.count(field_anchor) != 1:
    die('the medication field block is not where it was')
src = src.replace(field_anchor, field_anchor + """
    // app-v76 phase 1. `...original` would carry these through untouched; normalising them means a
    // malformed one cannot reach a render, and a blank Meds screen is the one failure that takes
    // edit and delete with it.
    ...(normChemoRelativeWindows(original.chemoRelativeWindows) ? { chemoRelativeWindows: normChemoRelativeWindows(original.chemoRelativeWindows) } : {}),
    ...(normChemoBlock(original.chemoBlock) ? { chemoBlock: normChemoBlock(original.chemoBlock) } : {}),
    ...(normLinkedTo(original.linkedTo) ? { linkedTo: normLinkedTo(original.linkedTo) } : {}),
    ...(normInteractions(original.interactions) ? { interactions: normInteractions(original.interactions) } : {}),
    ...(normHomeCard(original.homeCard) ? { homeCard: normHomeCard(original.homeCard) } : {}),""", 1)

# ---- 2. the resolvers ---------------------------------------------------------------------------
RESOLVERS = """
// ---- app-v76 PHASE 1 RESOLVERS ------------------------------------------------------------------
// Each answers the question the hardcoded branch used to answer, from a PROPERTY where one exists
// and from the legacy branch otherwise. With no properties set -- which is every medication today --
// each returns exactly what app-v75 returned. Phase 2 deletes the `else` halves.

// Windows for this medication on this day. Three call sites used to inline
// `med.id === 'dexamethasone' ? dexWindowsForOffset(chemoOffsetFor(d0)) : med.windows`, and a fourth
// added the Protonix-linked variants to the same ternary.
function medWindowsFor(med, dayTs) {
  const d0 = dayStart(dayTs);
  // Array.isArray, NOT truthiness. normalizeMedication strips a malformed value, but a medication can
  // reach a render without having passed through it -- a future import, a hand-edited localStorage,
  // a restored archive written by an older build. `chemoRelativeWindows: "not an array"` then threw
  // inside the Meds list render, and because the medication persists, every later render threw too:
  // the Meds screen comes up with no cards at all, and it is the only place edit and delete live.
  // Found by the phase 1 equivalence suite's hostile-value section. A resolver that trusts its
  // normaliser is one import path away from being wrong.
  if (med && Array.isArray(med.chemoRelativeWindows) && med.chemoRelativeWindows.length) {
    const offset = chemoOffsetFor(d0);
    // No treatment date, or today is not one of the offsets this medication names: it has no window
    // today. Falling back to med.windows here would silently give it an everyday schedule, which is
    // the opposite of what "these windows depend on the treatment date" means.
    if (offset === null) return [];
    return med.chemoRelativeWindows
      .filter(w => w.dayOffset === offset)
      .map(w => ({ start: w.start, end: w.end, name: w.name }))
      .sort((a, b) => a.start - b.start);
  }
  if (med && med.id === 'dexamethasone') return dexWindowsForOffset(chemoOffsetFor(d0));
  if (med && med.eveningLinkedToProtonix) return eveningWindowsFor(med, d0);
  if (med && med.morningLinkedToProtonix) return morningWindowsFor(med, d0);
  return (med && med.windows) || [];
}

// Is this medication blocked by a treatment-date rule on this day?
function medChemoBlockedOn(med, dayTs) {
  if (med && med.chemoBlock && typeof med.chemoBlock === 'object') return medChemoBlockingDay(med, dayTs) !== null;
  if (med && med.id === 'zofran') return zofranBlockedOn(dayTs);
  return false;
}
// WHICH treatment day is doing the blocking -- needed to say when it opens again, and it must be the
// day actually blocking rather than the next treatment date. Returning null where a block is live
// would put 1970 on screen through fmtTime; the callers treat null as "not blocked", which is the
// safe failure: a caregiver can still give a dose the app should have allowed.
function medChemoBlockingDay(med, dayTs) {
  if (med && med.chemoBlock && typeof med.chemoBlock === 'object'
      && Number.isFinite(Number(med.chemoBlock.fromDayOffset)) && Number.isFinite(Number(med.chemoBlock.toDayOffset))) {
    const d0 = dayStart(dayTs);
    const from = med.chemoBlock.fromDayOffset, to = med.chemoBlock.toDayOffset;
    let best = null;
    chemoDayList().forEach(d => {
      const o = Math.round((d0 - d) / 86400000);
      if (o >= from && o <= to && (best === null || d > best)) best = d;
    });
    return best;
  }
  if (med && med.id === 'zofran') return zofranBlockingDay(dayTs);
  return null;
}
// How long the block runs, in days after the blocking treatment day -- so the caller can say when it
// lifts without knowing which rule produced it.
function medChemoBlockSpanDays(med) {
  if (med && med.chemoBlock && typeof med.chemoBlock === 'object'
      && Number.isFinite(Number(med.chemoBlock.toDayOffset))) return Number(med.chemoBlock.toDayOffset) + 1;
  if (med && med.id === 'zofran') return 3;
  return 0;
}

// Every interaction warning that applies to an entry just logged, from either source.
function medInteractionsFor(entry) {
  const out = [];
  if (!entry) return out;
  const med = state.meds.find(m => m.id === entry.medId);
  if (med && Array.isArray(med.interactions) && med.interactions.length) {
    for (const rule of med.interactions) {
      const gapMs = rule.minGapH * 3600000;
      const near = state.entries.find(e => e.medId === rule.withMedId && e.id !== entry.id
        && Math.abs(e.ts - entry.ts) <= gapMs);
      if (near) out.push({ tone: 'amber', title: rule.title, body: rule.body });
    }
    return out;
  }
  return out;
}

// Which daily-total card this medication gets on Home. Wired in phase 2; here so stored data and the
// resolver land together and phase 2 is a deletion rather than a new feature.
function medHomeCardKind(med) {
  if (med && med.homeCard) return med.homeCard.kind;
  if (med && med.id === 'tylenol') return 'mg';
  if (med && med.id === 'tylenol-liquid') return 'ml';
  if (med && (med.id === 'imodium' || med.id === 'lidocaine')) return 'pills';
  return null;
}
"""
res_anchor = "function setToast(msg) {"
if src.count(res_anchor) != 1:
    die('setToast is not where it was')
src = src.replace(res_anchor, RESOLVERS.strip() + "\n\n" + res_anchor, 1)

# ---- 3. route the call sites through the resolvers ----------------------------------------------
CALLSITES = [
    # the zofran block inside status()
    ("""  if (med.id === 'zofran' && zofranBlockedOn(now)) {""",
     """  if (medChemoBlockedOn(med, now)) {""", 'the treatment-date block in status()'),
    ("""    const zb = zofranBlockingDay(now);
    if (zb !== null) return { locked: true, chemoBlock: true, availableAt: zb + 3 * 86400000 + 8 * 3600000 };""",
     """    const zb = medChemoBlockingDay(med, now);
    if (zb !== null) return { locked: true, chemoBlock: true, availableAt: zb + medChemoBlockSpanDays(med) * 86400000 + 8 * 3600000 };""",
     'the block-until calculation'),
    # tomorrow's windows at the end of status()
    ("""  const tomorrowWindows = med.id === 'dexamethasone' ? dexWindowsForOffset(chemoOffsetFor(d0 + 86400000)) : windows;""",
     """  const tomorrowWindows = medWindowsFor(med, d0 + 86400000).length ? medWindowsFor(med, d0 + 86400000) : windows;""",
     "tomorrow's windows"),
]
for old, new, what in CALLSITES:
    if src.count(old) != 1:
        die(what + ' is not where it was -- nothing written')
for old, new, what in CALLSITES:
    if new is not None:
        src = src.replace(old, new, 1)

# THE status() TERNARY. Matched in FULL, as one exact string.
# The first version of this anchored on a two-space-indented prefix and used str.index -- and the
# missed-dose walk's four-space line CONTAINS that prefix at offset 2, so index() found the walk at
# line 1773 instead of the ternary at 1955 and the slice that followed deleted roughly 180 lines of
# this file. Nothing detected it except a later count check that happened to run afterwards and
# happened to be looking at one of the deleted lines. A prefix anchor plus index() is a silent
# deletion waiting for the day the validation below the surgery is less lucky.
TERNARY = ("  const windows = med.id === 'dexamethasone' ? dexWindowsForOffset(chemoOffsetFor(d0))"
           " : med.eveningLinkedToProtonix ? eveningWindowsFor(med, d0) : med.morningLinkedToProtonix"
           " ? morningWindowsFor(med, d0) : med.windows;")
if src.count(TERNARY) != 1:
    die('the status() window ternary is not where it was -- nothing written')
src = src.replace(TERNARY, "  const windows = medWindowsFor(med, d0);", 1)

# the two missed-dose walks
WALKS = ("""    const windows = med.id === 'dexamethasone' ? dexWindowsForOffset(chemoOffsetFor(d0)) : med.windows;""",
         """    const windows = medWindowsFor(med, d0);""")
n = src.count(WALKS[0])
if n < 1:
    die('the missed-dose walk window resolution is not where it was')
src = src.replace(WALKS[0], WALKS[1])
WALKS2 = ("""      const windows = med.id === 'dexamethasone' ? dexWindowsForOffset(chemoOffsetFor(d0)) : med.windows;""",
          """      const windows = medWindowsFor(med, d0);""")
src = src.replace(WALKS2[0], WALKS2[1])

# afterLog's interaction branch: property-driven rules first, legacy branch untouched behind them
old_after = """  if (entry.medId === 'iron' || entry.medId === 'protonix') {"""
if src.count(old_after) != 1:
    die('the interaction branch is not where it was')
src = src.replace(old_after, """  // app-v76 phase 1: property-driven interaction rules, if this medication carries any. Falls
  // through to the legacy iron/protonix branch below when it does not, which is every medication
  // today. Phase 2 deletes that branch.
  const declared = medInteractionsFor(entry);
  if (declared.length) { setState({ warn: declared[0] }); return; }
  if (entry.medId === 'iron' || entry.medId === 'protonix') {""", 1)

# ---- 4. version ---------------------------------------------------------------------------------
if src.count("const APP_VERSION = 'app-v75';") != 1:
    die('APP_VERSION is not app-v75')
sw = SW.read_text(encoding='utf-8')
if "const CACHE = 'chemowell-app-v75-1';" not in sw:
    die('sw.js CACHE is not at app-v75-1 -- nothing was written')
src = src.replace("const APP_VERSION = 'app-v75';", "const APP_VERSION = 'app-v76';", 1)
sw_next = sw.replace("const CACHE = 'chemowell-app-v75-1';", "const CACHE = 'chemowell-app-v76-1';", 1)

HTML.write_text(src, encoding='utf-8')
SW.write_text(sw_next, encoding='utf-8')
print('app-v76 phase 1 applied: five properties, five resolvers, every call site routed')
