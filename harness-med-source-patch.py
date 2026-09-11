#!/usr/bin/env python3
"""app-v73 -> app-v74: the medication description can fill itself in from an official source, and
the row says where it came from.

AARON, 2026-09-11: "The med desc should also fill automatically with what it's for based on the
website it was pulled from. There should be a clickable source link to get to the website with that
exact wording that pulls in the app." Then: "Do the auto fill with the caching start on chemowell so
you get the mechanics working first before you move to caretracker."

THE PREMISE HE STARTED FROM WAS WRONG AND IS WORTH WRITING DOWN. The description ALREADY fills
itself in -- purposeOf() falls back to MED_PURPOSE. But nothing was ever pulled from a website:
app-v23 wrote every line here by hand precisely so nothing was copied and nothing had to be cited,
and before this release the app made ZERO outbound requests of any kind.

WHAT THIS RELEASE APPENDS: one optional field per medication.

    purposeSource: { text: String, url: String, label: String, fetchedAt: Number }

WHAT IT DELETES: nothing. No entry is written, edited or deleted; no existing field is dropped; the
built-in table is untouched and still answers for every medication it knows.

THE TIE-BREAK, in this order, and it is the same order the app already used with one rung added:
  1. What the caregiver TYPED. Always wins. Unchanged.
  2. The cached official text, IF it arrived and passed the guards.
  3. The built-in table line.
  4. Nothing at all -- never an empty label under a medication nobody has described.

WHEN THE FETCH HAPPENS: once, when a medication is saved in the editor. NEVER at render time, never
on a timer, never on load. The result is cached on the medication record, so the app behaves offline
exactly as it does today -- which matters more here than anywhere, because this is a patient's phone
in a hospital where the signal drops.

THE GUARDS MOVE INTO THE APP, AND THAT IS THE REAL CHANGE. Until now the rules -- no numbers, no
schedule, no dosage form, no route, no fever claim -- were enforced by test/v72-med-purpose.mjs
against a STATIC table, at build time. Fetched text arrives at RUN time on a patient's phone, where
no suite can see it. So the same rules are implemented in the app and applied before a single
fetched character can reach the screen. Text that fails them is DISCARDED; the link is still kept,
because a link is not a claim about wording.

  * NO NUMBERS, so nothing that could read as a dose or a schedule.
  * NO DOSAGE FORM OR ROUTE -- app-v23's audit blocked "a numbing cream for soreness on the skin"
    because the same name may be a rinse or a patch.
  * NO FEVER CLAIM, EVER. A fever during chemo is a thing to report, not to suppress, and this app
    tracks Temperature.
  * A LENGTH CEILING. A paragraph is not a purpose line and would wreck the card.

HONESTY ABOUT THE LINK, which is the part most easily got wrong and the part he actually asked for:
a link may only claim to be the source of wording that is ACTUALLY ON SCREEN.
  * Displaying cached official text -> "Where this came from", pointing at the exact page it came
    from.
  * Displaying our own line, or the caregiver's -> "Look it up", pointing at a SEARCH on the
    official site. It is labelled as a lookup and never as the source, because it is not one.
This distinction is the whole reason the render reads `usingSourceText` rather than just `url`.

SAID OUT LOUD, AND IT IS THE LIMIT OF THIS RELEASE: THE LIVE FETCH IS NOT VERIFIED. The sandbox this
was built in blocks every external host at the egress proxy (403 on CONNECT to
dailymed.nlm.nih.gov, connect.medlineplus.gov, rxnav.nlm.nih.gov and api.fda.gov alike), and its own
documentation says to report a blocked host rather than route around it. So every mechanic below is
proved against a stubbed endpoint -- the same way this project has always stubbed Firebase -- and
what is NOT proved from here is that the real service answers a browser at all: a service that sends
no `Access-Control-Allow-Origin` header cannot be read cross-origin, and no amount of local testing
reveals that. The release is built so that this is safe: IF THE FETCH NEVER SUCCEEDS, THE APP IS
EXACTLY WHAT IT IS TODAY. No error, no empty state, no promise on screen that did not come true --
the built-in line shows, the lookup link shows, and nothing anywhere claims a source it does not
have. Confirming the live fetch needs Aaron's phone, and the check is named in the release notes.

WHY MedlinePlus AND NOT WebMD OR drugs.com: those are copyrighted and their terms forbid
republishing their text, so copying their wording into the app would be the one thing app-v23 set
out to avoid. MedlinePlus is the US National Library of Medicine -- public domain, written for
patients rather than clinicians, and it has stable pages to link at.
"""
import re, sys, os

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = HERE
FROM_V, TO_V = 'app-v73', 'app-v74'

args = sys.argv[1:]
base = args[args.index('--base') + 1] if '--base' in args else os.path.join(REPO, 'index.html')
out = args[args.index('--out') + 1] if '--out' in args else os.path.join(REPO, 'index.html')
sw_in = os.path.join(os.path.dirname(base), 'sw.js')
sw_out = os.path.join(os.path.dirname(out), 'sw.js')

s = open(base, encoding='utf-8').read()
m = re.search(r"const APP_VERSION = '([^']+)';", s)
if not m or m.group(1) != FROM_V:
    sys.exit('REFUSING: base is %s, this patch transforms %s -> %s' % (m.group(1) if m else '?', FROM_V, TO_V))

def rep(old, new, count=1):
    global s
    if s.count(old) < count:
        sys.exit('REFUSING: anchor not found (%d hits):\n%s' % (s.count(old), old[:160]))
    s = s.replace(old, new, count)

# ---- 1. the source adapter, the guards, and the fetch ------------------------------------------
rep("""function normalizeMedication(raw, index) {""",
    """// ---- WHERE A DESCRIPTION MAY COME FROM (app-v74) ----------------------------------------------
// One place, on purpose: the endpoint, the link builders and the shape-reading all live here, so
// correcting any of it later is one edit rather than a hunt, and the suite can swap the whole thing
// for a stub without touching a line of the logic that uses it.
// MedlinePlus is the US National Library of Medicine: public domain, written for patients, and with
// stable pages worth linking at. WebMD and drugs.com are deliberately NOT used -- their text is
// copyrighted and their terms forbid republishing it, which is the whole reason this app writes its
// own lines.
const MED_SOURCE = {
  label: 'MedlinePlus',
  // A SEARCH on the official site. Built from the name with no network at all, so it works offline
  // and on the very first paint. It is a lookup, not a citation, and the UI never calls it one.
  searchUrl: function (name) {
    return 'https://medlineplus.gov/search/?query=' + encodeURIComponent(String(name || '').trim());
  },
  // The lookup that MAY return an exact page. Wrapped so a stub can replace it wholesale.
  lookupUrl: function (name) {
    return 'https://connect.medlineplus.gov/service?knowledgeResponseType=application/json'
      + '&mainSearchCriteria.v.dn=' + encodeURIComponent(String(name || '').trim());
  },
  // Reading the answer is separated from fetching it so the shape can be corrected without touching
  // the network path, and so the suite can prove the reader on fixtures alone.
  read: function (payload) {
    try {
      const feed = payload && payload.feed;
      const entry = feed && Array.isArray(feed.entry) ? feed.entry[0] : null;
      if (!entry) return null;
      const link = Array.isArray(entry.link) ? entry.link.find(l => l && l.href) : null;
      const url = link ? String(link.href) : '';
      const title = entry.title && entry.title._value ? String(entry.title._value) : '';
      const summary = entry.summary && entry.summary._value ? String(entry.summary._value) : '';
      if (!url) return null;
      return { url: url, title: title, text: summary };
    } catch (e) { return null; }
  }
};

// THE GUARDS, IN THE APP. Until this release these rules lived only in test/v72-med-purpose.mjs and
// ran against the STATIC table at build time. Fetched text arrives at RUN time on a patient's phone
// where no suite can see it, so the same rules are enforced here, before a single fetched character
// can reach the screen. Every one of them was paid for by an audit block on this project.
const PURPOSE_MAX_LEN = 150;
// The `u` flag matters: without it \\d misses non-ASCII digits, and a line reading "Take \u0662
// tablets" carried a dose past a guard whose whole job is to stop one. Spelled-out numbers were
// missed entirely for the same reason -- they are not digits at all.
const PURPOSE_NUMBERY = /\\d|[\\u0660-\\u0669\\u06F0-\\u06F9\\u0966-\\u096F]/u;
const PURPOSE_WORDNUM = /\\b(one|two|three|four|five|six|seven|eight|nine|ten|twice|thrice|half|quarter)\\b/i;
const PURPOSE_FEVERY = /fever|febrile|pyrexia|antipyretic|temperature/i;
const PURPOSE_SCHEDULEY = /\\b(daily|hourly|nightly|weekly|every \\w+|twice|once a|per day|a day|as needed|when needed|at bedtime|before bed|before meals|after meals|with food|on an empty stomach|in the morning|in the evening|on chemo days|around chemo|with chemo|after chemo|before chemo|chemotherapy|dose|doses|mg|ml|mcg)\\b/i;
const PURPOSE_FORMY = /\\b(pills?|tablets?|capsules?|caplets?|troches?|lozenges?|liquids?|syrups?|elixirs?|powders?|sachets?|patches|patch|creams?|ointments?|gels?|lotions?|rinses?|mouthwash|gargle|suppositor(?:y|ies)|enemas?|sprays?|sprayed|inhalers?|inhaled|nebuli[sz]ed|injections?|injected|inject|shots?|infusions?|infused|drips?|intravenous(?:ly)?|iv|subcutaneous(?:ly)?|intramuscular(?:ly)?|sublingual(?:ly)?|transdermal|intranasal|swallow(?:ed)?|chew(?:able)?|topical(?:ly)?|orally|by mouth|rub|rubs|rubbed|applied|apply|smear|dab|rectally|on the skin|onto the skin|into the skin|under the skin|under the tongue|under your tongue|into a vein|through a vein|into a muscle|in a drip|through a drip|eye drops?|ear drops?|nose drops?|into the eye|into the ear|into the nose|per os|p\\.?o\\.?|nebuli[sz]er|vaginally|buccal(?:ly)?|implants?|pessar(?:y|ies))\\b/i;
function purposeTextIsSafe(text) {
  const t = String(text || '').trim();
  if (!t) return false;
  if (t.length > PURPOSE_MAX_LEN) return false;
  if (PURPOSE_NUMBERY.test(t)) return false;
  if (PURPOSE_WORDNUM.test(t)) return false;
  if (PURPOSE_FEVERY.test(t)) return false;
  if (PURPOSE_SCHEDULEY.test(t)) return false;
  if (PURPOSE_FORMY.test(t)) return false;
  return true;
}

// THE ONLY OUTBOUND REQUEST THIS APP MAKES, and it is made ONCE, when a medication is SAVED --
// never at render time, never on a timer, never on load. What it finds is cached on the medication
// record, so every later paint is offline-identical to today.
// IT CANNOT FAIL LOUDLY. Offline, a blocked cross-origin read, a 404, a timeout, a shape that
// changed: every one of them returns null and the app carries on being exactly what it was. That is
// deliberate and it is the reason this release is safe to ship without the live endpoint having been
// verified -- see the header of harness-med-source-patch.py.
async function fetchPurposeSource(name) {
  const clean = String(name || '').trim();
  if (!clean || typeof fetch !== 'function') return null;
  const controller = (typeof AbortController === 'function') ? new AbortController() : null;
  const timer = controller ? setTimeout(() => { try { controller.abort(); } catch (e) {} }, 6000) : null;
  try {
    const response = await fetch(MED_SOURCE.lookupUrl(clean), controller ? { signal: controller.signal } : {});
    if (!response || !response.ok) return null;
    const payload = await response.json();
    const found = MED_SOURCE.read(payload);
    if (!found || !found.url) return null;
    // The TEXT must earn its place; the URL does not have to. A link is not a claim about wording,
    // so a page whose summary is unusable still gives the caregiver somewhere real to read.
    const text = purposeTextIsSafe(found.text) ? String(found.text).trim() : '';
    // forName: THE NAME THIS WAS FETCHED FOR, and it is the whole of the fix for the defect the
    // app-v74 audit found. Renaming a medication in the editor keeps its record -- same id, fields
    // spread from the original -- so the cached sentence and its citation survived onto a DIFFERENT
    // drug. Measured: a medication renamed from Zofran to Compazine printed ondansetron's sentence
    // with a link to ondansetron's page under it, beating the app's own correct line for Compazine,
    // permanently, with nothing to correct it. The in-flight race was guarded; this needs no race.
    return { text: text, url: String(found.url), label: MED_SOURCE.label, forName: clean, fetchedAt: Date.now() };
  } catch (e) {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function normalizeMedication(raw, index) {""")

# ---- 2. the tie-break gains one rung -----------------------------------------------------------
rep("""function purposeOf(med) {
  if (!med) return '';
  const typed = String(med.purpose || '').trim();
  if (typed) return typed;
  return purposeLookup(med.name) || purposeLookup(med.sub);
}""",
    """function purposeOf(med) {
  if (!med) return '';
  const typed = String(med.purpose || '').trim();
  if (typed) return typed;
  // app-v74: the cached official line sits BETWEEN what she typed and what we wrote. It never
  // overrides her -- that rung was already the top one and stays there.
  const sourced = sourcedPurposeText(med);
  if (sourced) return sourced;
  return purposeLookup(med.name) || purposeLookup(med.sub);
}
// Re-checked on the way OUT as well as on the way in. The record can reach this app from another
// phone through medsync, and a stored string is not evidence that it ever passed a guard here.
function sourcedPurposeText(med) {
  const src = med && med.purposeSource;
  if (!src || typeof src !== 'object') return '';
  if (!purposeSourceMatchesName(med)) return '';
  const text = String(src.text || '').trim();
  return purposeTextIsSafe(text) ? text : '';
}
// A cached description belongs to the NAME it was looked up under, and to nothing else. Renaming a
// medication keeps its record, so without this the sentence and the citation walk across to whatever
// the medication is called next.
// An entry written before this check existed carries no `forName`: it is treated as NOT matching, so
// it stops being displayed rather than being trusted. That loses a correct description on the next
// load for medications that had one -- and it is the right way round, because the alternative is
// keeping a possibly-false one. Saving the medication looks it up again.
function purposeSourceMatchesName(med) {
  const src = med && med.purposeSource;
  if (!src || typeof src !== 'object') return false;
  const forName = String(src.forName || '').trim().toLowerCase();
  if (!forName) return false;
  return forName === String(med.name || '').trim().toLowerCase();
}
// WHICH LINK IS HONEST FOR THIS MEDICATION. A link may only claim to be the source of wording that
// is actually on screen: showing the cached official text earns "Where this came from" and the exact
// page; anything else gets a lookup into the official site's search, labelled as a lookup. Calling a
// search "the source" of a sentence written here would be a false citation, which is the one thing
// this feature must not do.
function purposeSourceLink(med) {
  if (!med) return null;
  const src = (med.purposeSource && typeof med.purposeSource === 'object') ? med.purposeSource : null;
  const label = (src && String(src.label || '').trim()) || MED_SOURCE.label;
  const shown = purposeOf(med);
  const sourced = sourcedPurposeText(med);
  const usingSourceText = !!sourced && shown === sourced;
  if (usingSourceText && src && src.url && purposeSourceMatchesName(med)) {
    return { url: String(src.url), label: label, exact: true, text: 'Where this came from \\u00b7 ' + label };
  }
  const name = String(med.name || '').trim();
  if (!name) return null;
  return { url: MED_SOURCE.searchUrl(name), label: label, exact: false, text: 'Look it up on ' + label };
}""")

# ---- 3. the record is validated on every load, like every other stored list ---------------------
rep("""  if (doses && doses.length) medication.doses = doses; else delete medication.doses;""",
    """  // app-v74: THE CACHED SOURCE, VALIDATED. normalizeMedication runs on every load and over anything
  // medsync publishes from another device, and what it returns goes straight to the screen. A stored
  // string is not evidence it ever passed a guard here, and a stored URL is not evidence it is a URL
  // -- an unchecked one is a javascript: link waiting to be tapped by a caregiver at 2am.
  const rawSource = original.purposeSource;
  if (rawSource && typeof rawSource === 'object') {
    const srcUrl = String(rawSource.url || '').trim();
    const httpOnly = /^https:\\/\\//i.test(srcUrl);
    const srcText = String(rawSource.text || '').trim();
    if (httpOnly) {
      medication.purposeSource = {
        url: srcUrl,
        text: purposeTextIsSafe(srcText) ? srcText : '',
        label: String(rawSource.label || 'MedlinePlus').slice(0, 40),
        // CARRIED THROUGH ON PURPOSE. This object is a WHITELIST -- anything not named here is gone
        // at the next load. The audit hit exactly that: its first attempt at the rename fix still
        // showed the false citation, because the new field was dropped here and the match could
        // never succeed.
        forName: String(rawSource.forName || '').slice(0, 120),
        fetchedAt: Number(rawSource.fetchedAt) > 0 ? Number(rawSource.fetchedAt) : 0
      };
    } else {
      delete medication.purposeSource;
    }
  } else {
    delete medication.purposeSource;
  }
  if (doses && doses.length) medication.doses = doses; else delete medication.doses;""")

# ---- 4. the fetch happens on save, and the save does not wait on the network --------------------
rep("""  const meds = editor.sourceId ? state.meds.map(med => med.id === editor.sourceId ? saved : med) : [...state.meds, saved];
  persistMedicationConfig(meds, state.archivedMeds);
  setState({ meds, medEditor: null, confirmDeleteMed: null });""",
    """  const meds = editor.sourceId ? state.meds.map(med => med.id === editor.sourceId ? saved : med) : [...state.meds, saved];
  persistMedicationConfig(meds, state.archivedMeds);
  setState({ meds, medEditor: null, confirmDeleteMed: null });
  // app-v74: THE SAVE IS ALREADY DONE. The lookup runs after it and is not awaited, so a slow or
  // dead network cannot delay the medication being saved by a single millisecond -- the editor
  // closes, the card appears, and the source arrives later or never. Re-reads state when it returns
  // rather than closing over `meds`, because the caregiver may have edited or removed the
  // medication while the request was in flight, and writing a stale list back would undo that.
  refreshPurposeSource(saved.id, saved.name);""")

rep("""function saveMedicationEditor() {""",
    """// app-v74: look the medication up, cache what comes back, and touch nothing else. Every early
// return here leaves the record exactly as it was.
async function refreshPurposeSource(id, name) {
  const found = await fetchPurposeSource(name);
  if (!found) return;
  // THE SAME https CHECK THE LOAD PATH MAKES. Without it this is the one route by which a URL
  // reaches an href without ever having been validated -- the load-time guard only sees what is
  // already in storage, and this writes straight into state. A redirect or a changed service could
  // hand back anything.
  if (!/^https:\/\//i.test(String(found.url || ''))) return;
  const current = state.meds.find(item => item.id === id);
  // Gone, or RENAMED while the request was in flight: the answer is stale and is dropped. Note what
  // this does NOT check -- text she typed in the meantime. It does not need to: her wording outranks
  // a cached source everywhere it is read, so storing one under it changes nothing she sees. An
  // earlier version of this comment claimed the typed case was checked here, which was not true.
  if (!current || String(current.name || '').trim() !== String(name || '').trim()) return;
  const meds = state.meds.map(item => item.id === id ? { ...item, purposeSource: found } : item);
  persistMedicationConfig(meds, state.archivedMeds);
  setState({ meds });
}
function saveMedicationEditor() {""")

# ---- 5. the row: the line, then the link that is honest about what it points at -----------------
# The link is its own element with its own hook so it can be asserted on directly; rel and target are
# set together because target=_blank without noopener hands the opened page a handle on this one.
rep("""          purposeOf(med) ? h('div', { 'data-med-purpose': med.id, style: { ...TYPE.caption, color: '#4A3F47', marginTop: '4px', lineHeight: '1.35' } }, purposeOf(med)) : null""",
    """          purposeOf(med) ? h('div', { 'data-med-purpose': med.id, style: { ...TYPE.caption, color: '#4A3F47', marginTop: '4px', lineHeight: '1.35' } }, purposeOf(med)) : null,
          (function () {
            // app-v74. Rendered only when there is a real place to send her. `exact` decides the
            // WORDS, not just the address: "Where this came from" is a citation and is only ever
            // printed over the page the sentence above actually came from.
            const link = purposeSourceLink(med);
            if (!link) return null;
            return h('a', {
              'data-med-source': med.id,
              'data-med-source-exact': link.exact ? 'true' : 'false',
              href: link.url,
              target: '_blank',
              rel: 'noopener noreferrer',
              style: { ...TYPE.caption, display: 'inline-block', color: '#0A6B4A', fontWeight: '700', textDecoration: 'underline', marginTop: '3px', minHeight: '44px', lineHeight: '44px' }
            }, link.text);
          })()""")

# ---- 6. the disclaimer has to stop saying the app wrote all of this -----------------------------
# app-v23's wording was true when every line was written here. It is not true of a line fetched from
# MedlinePlus, and a disclaimer that describes the wrong provenance is worse than none.
old_disc = s[s.index("'data-med-disclaimer': 'true'"):]
old_disc = old_disc[:old_disc.index('\n')]
if 'app-v74' not in old_disc:
    m2 = re.search(r"h\('div', \{ 'data-med-disclaimer': 'true'.*?\},\s*('[^']*')", s, re.S)
    if not m2:
        sys.exit('REFUSING: could not read the disclaimer string')
    old_text = m2.group(1)
    new_text = ("'These descriptions are general information about what a medication is usually for \\u2014 "
                "not advice, and not a dose. Some are written here; where one came from " + "' + MED_SOURCE.label + '"
                ", the row links to the page it came from. Follow her care team.'")
    s = s[:m2.start(1)] + new_text + s[m2.end(1):]

# ---- 7. What's New -----------------------------------------------------------------------------
if "const CHANGELOG" in s or "changelog" in s.lower():
    pass

# ---- 8. version stamp --------------------------------------------------------------------------
if "const APP_VERSION = '%s';" % FROM_V not in s: sys.exit('REFUSING: version stamp missing')
s = s.replace("const APP_VERSION = '%s';" % FROM_V, "const APP_VERSION = '%s';" % TO_V, 1)
open(out, 'w', encoding='utf-8').write(s)

sw = open(sw_in, encoding='utf-8').read()
old_cache = 'chemowell-%s-1' % FROM_V
new_cache = 'chemowell-%s-1' % TO_V
if old_cache not in sw:
    sys.exit('REFUSING: sw.js cache is not %s' % old_cache)
open(sw_out, 'w', encoding='utf-8').write(sw.replace(old_cache, new_cache))
print('patched %s -> %s (cache %s -> %s)' % (FROM_V, TO_V, old_cache, new_cache))
