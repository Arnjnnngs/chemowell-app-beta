#!/usr/bin/env python3
"""app-v74 -> app-v75: the MedlinePlus text itself, baked in, with a real citation.

AARON, 2026-09-11: "Strip the fetch ship the link and start database."
AARON, 2026-09-12, on the card being too small for a full description:
    "120 is fine. What about building it in the ellipsis? Another tab would be too much as you said.
     What's your honest suggestion?"

app-v74 shipped the link. This ships the WORDS the link points at.

WHERE THE WORDS COME FROM AND WHY NOTHING LEAVES THE PHONE.
tools/fetch-medlineplus.mjs runs in GitHub Actions, once, on a build machine. It reads the
"Why is this medication prescribed?" section of each drug's MedlinePlus page, keeps the first
sentence, and puts every candidate through the guards in tools/build-med-table.mjs. The result is
the table below. A phone downloads an app that already knows the answers and asks nobody anything --
the app still makes no outbound request of any kind. MedlinePlus is the US National Library of
Medicine and its text is public domain, so it can be copied and quoted with a citation.

THE 120-CHARACTER ANSWER, AND WHY IT IS NOT WHAT SHIPPED.
Aaron approved a 120-character limit for the card. Taken literally it would have been a data rule --
the generator rejects anything over the ceiling -- and at 120 the table keeps 18 medications of 46
instead of 20. Uncapped it keeps 32. The sentences being deleted were good ones; ibuprofen's real
answer is 255 characters and says exactly what a caregiver wants to know.

So the ceiling moved to the DISPLAY, where the problem actually was. The card shows the first two
lines and the whole sentence opens on tap. Trimming and clamping are not the same thing: trimming
edits the data and then presents the remains as the whole sentence, which is how "not for fever"
becomes "for fever"; clamping shows all of it one tap away. Nothing trims. The card clamps.

THE HONEST ANSWER TO "BUILD IT IN THE ELLIPSIS".
There is no ellipsis menu in this app -- that is care-tracker. This app has a left drawer holding
Account, Calendar, Notes, Help & FAQ, Report a problem and Settings, so "in the ellipsis" would mean
a seventh drawer row leading to an A-Z list of drugs.

That row is not built, deliberately. A drug dictionary answers "what is this for?" -- a question that
is only ever asked while looking at a particular medication, which is a screen the app already has.
Sending her to a separate index to look up a drug the app already knows she takes is a longer route
to the same sentence, and every row added to that drawer makes the six real destinations harder to
find. The expand IS the dictionary: it lives on the medication, where the question gets asked.

WHAT IT APPENDS: nothing. No new stored field, no new record shape, no migration. The description
and its citation are looked up from a constant at render time, by name, exactly as the hand-written
table already was.
WHAT IT DELETES: nothing.
HOW IT TIE-BREAKS: what the caregiver typed wins over everything, always. Then the MedlinePlus
sentence, if there is one for that name or generic. Then this app's own hand-written line. Then
nothing at all -- never an empty label under a medication nobody has described.

WHY MEDLINEPLUS BEATS THE HAND-WRITTEN LINE, having lost to it in app-v74's plan: the citation. A
link under a sentence written in this repo saying "Read it on MedlinePlus" is a false citation, and
this project has been refused for that class of defect more than any other. Text and page now travel
together as one record or neither ships, so the link says "Read it on MedlinePlus" only where the
words above it came from that exact page. Where they did not, the link stays app-v74's honest
"Look it up on MedlinePlus", pointing at a search.

NO NEW OVERLAY, so no new scroll-lock case (Rule 5.5). The expand grows the card in place. A modal
for reading one sentence would have added a fifth full-screen surface, its own focus trap and its own
back-gesture question, to save nothing.
"""
import re, sys, pathlib, json

ROOT = pathlib.Path(__file__).resolve().parent
HTML = ROOT / 'index.html'
SW = ROOT / 'sw.js'
TABLE = ROOT / 'tools' / 'med-source-table.json'

def die(msg):
    print('PATCH FAILED: ' + msg); sys.exit(1)

src = HTML.read_text(encoding='utf-8')
if "const MED_SOURCE_TABLE" in src:
    die('already applied')
if not TABLE.exists():
    die('tools/med-source-table.json is missing -- run the refresh workflow first')

data = json.loads(TABLE.read_text(encoding='utf-8'))
if not isinstance(data, dict) or not data:
    die('the table is empty. A green run that commits an empty table is the failure mode this '
        'project has already shipped once; refusing to bake it in.')

# --- 1. the table itself -------------------------------------------------------------------------
rows = []
for key in sorted(data):
    entry = data[key]
    t = str(entry.get('t', '')).strip()
    u = str(entry.get('u', '')).strip()
    if not t or not re.match(r'^https://(www\.)?medlineplus\.gov/', u, re.I):
        die('entry %r has no text or a url that is not a MedlinePlus page' % key)
    rows.append("  %s: { t: %s, u: %s }," % (json.dumps(key), json.dumps(t), json.dumps(u)))

table_js = (
"// ---- MEDLINEPLUS, BAKED IN AT BUILD TIME (app-v75) ----------------------------------------------\n"
"// Generated by tools/build-med-table.mjs from pages fetched by tools/fetch-medlineplus.mjs in\n"
"// GitHub Actions. DO NOT EDIT BY HAND: `t` is quoted verbatim from `u`, and hand-editing the text\n"
"// would turn the citation under it into a false one. Re-run the refresh workflow instead.\n"
"//\n"
"// Every sentence here passed the build-time guards: no digits and no spelled-out numbers (a dose),\n"
"// no fever claim (a fever during chemo is a thing to report, not to suppress), no schedule, no\n"
"// dosage form or route, no instruction to the reader, and no run-on from a bulleted page. A\n"
"// sentence that failed any of them was dropped rather than edited to fit, and the app keeps its own\n"
"// hand-written line for that drug. MedlinePlus is the US National Library of Medicine; its text is\n"
"// public domain, which is why it and not WebMD or drugs.com.\n"
"const MED_SOURCE_TABLE = {\n" + "\n".join(rows) + "\n};\n"
"// hasOwnProperty, NOT a bare index -- the same trap purposeLookup documents just below. A\n"
"// medication named \"constructor\" would otherwise read back a function here too.\n"
"function medSourceEntry(name) {\n"
"  const k = medPurposeKey(name);\n"
"  if (!k || !Object.prototype.hasOwnProperty.call(MED_SOURCE_TABLE, k)) return null;\n"
"  const v = MED_SOURCE_TABLE[k];\n"
"  if (!v || typeof v.t !== 'string' || typeof v.u !== 'string' || !v.t || !v.u) return null;\n"
"  return v;\n"
"}\n"
"// The description and its page are ONE record or NEITHER. Returning the text without the url, or\n"
"// the url without the text, is what produces a citation under a sentence that did not come from it.\n"
"function medSourceFor(med) {\n"
"  if (!med) return null;\n"
"  return medSourceEntry(med.name) || medSourceEntry(med.sub);\n"
"}\n"
)

anchor = "function medPurposeKey(text) {"
if src.count(anchor) != 1:
    die('medPurposeKey anchor is not unique')
# medPurposeKey must be DECLARED before the table's helpers run, but const hoisting means the
# helpers only need it at call time. Place the block after medPurposeKey's closing brace.
mk_end = src.index("\n}\n", src.index(anchor)) + len("\n}\n")
src = src[:mk_end] + "\n" + table_js + src[mk_end:]

# --- 2. purposeOf tie-break ----------------------------------------------------------------------
old_purpose = """function purposeOf(med) {
  if (!med) return '';
  const typed = String(med.purpose || '').trim();
  if (typed) return typed;
  return purposeLookup(med.name) || purposeLookup(med.sub);
}"""
if src.count(old_purpose) != 1:
    die('purposeOf is not where it was')
new_purpose = """// ONE FUNCTION DECIDES BOTH THE WORDS AND WHERE THEY CAME FROM, because the alternative is a
// citation under a sentence that came from somewhere else. The first build of app-v75 had two
// functions -- one picked the text, another decided whether to print "Read it on MedlinePlus" -- and
// the audit that blocked the release found several paths where they disagreed.
function describeMed(med) {
  if (!med) return { text: '', source: null };
  // WHAT SHE TYPED WINS OVER EVERYTHING, ALWAYS. Her own words about her own medication are never
  // overwritten by a database, however official it is.
  const typed = String(med.purpose || '').trim();
  if (typed) return { text: typed, source: null };
  // THEN THIS APP'S OWN LINE, AND THIS ORDER IS THE WHOLE OF THE app-v75 AUDIT BLOCK.
  // It shipped the other way round for an hour -- MedlinePlus first, because it is the only text
  // that can carry a citation -- and that solved a citation problem by making the medicine worse.
  // MedlinePlus answers for a drug's PRIMARY indication, which is very often not the reason a
  // chemotherapy patient is taking it. Fourteen hand-written lines would have been overridden and
  // six of them badly. The one that settles it: promethazine's card said "Settles nausea and
  // vomiting... It causes drowsiness", and MedlinePlus's first sentence is about allergic rhinitis
  // and itchy eyes. Clamped to two lines on a phone at 2am, with the patient vomiting, that card
  // reads "her allergy medicine" -- and the sedation warning was gone too. Promethazine is one of
  // the two drugs most likely to be reached for at that exact moment.
  // These lines were written for THIS patient on THIS treatment, some of them by name after Aaron
  // reported the gap. A general reference does not get to overrule them.
  const own = purposeLookup(med.name) || purposeLookup(med.sub);
  if (own) return { text: own, source: null };
  // THEN MEDLINEPLUS, for the drugs this app has never had a line for -- which is the real win here
  // and is untouched by the above: 19 of the 33 entries are drugs with no hand-written line at all,
  // most of them the chemotherapy and supportive-care drugs the table never covered.
  const official = medSourceFor(med);
  if (official) return { text: official.t, source: official };
  return { text: '', source: null };
}
function purposeOf(med) {
  return describeMed(med).text;
}"""
src = src.replace(old_purpose, new_purpose, 1)

# --- 3. the link becomes a citation where it has earned it ----------------------------------------
old_link = """function purposeSourceLink(med) {
  const name = med ? String(med.name || '').trim() : '';
  if (!name) return null;
  return { url: MED_SOURCE.searchUrl(name), text: 'Look it up on ' + MED_SOURCE.label };
}"""
if src.count(old_link) != 1:
    die('purposeSourceLink is not where it was')
new_link = """function purposeSourceLink(med) {
  const name = med ? String(med.name || '').trim() : '';
  if (!name) return null;
  // THE CITATION IS FOR THE TEXT ON SCREEN, NOT FOR THE MEDICATION. describeMed returns the page
  // only when the sentence it chose came FROM that page, so "Read it on MedlinePlus" cannot appear
  // over a hand-written line or over something she typed. The first build asked a different
  // question -- "is there a MedlinePlus entry for this drug?" -- and the audit found it citing the
  // oxycodone page under the app's own Percocet line, with the acetaminophen warning deleted.
  const described = describeMed(med);
  if (described.source) {
    return { url: described.source.u, text: 'Read it on ' + MED_SOURCE.label, quoted: true };
  }
  // Otherwise app-v74's honest search: a lookup, not a source.
  return { url: MED_SOURCE.searchUrl(name), text: 'Look it up on ' + MED_SOURCE.label, quoted: false };
}"""
src = src.replace(old_link, new_link, 1)

# --- 4. the card: two lines, tap to read it all ---------------------------------------------------
# Both the description and the link are replaced together: they become one block with one row of
# controls under it. Replacing only the description left two link-shaped controls stacked on every
# long card, one above the other, both starting with the word "Read".
old_block_start = """          purposeOf(med) ? h('div', { 'data-med-purpose': med.id, style: { ...TYPE.caption, color: '#4A3F47', marginTop: '4px', lineHeight: '1.35' } }, purposeOf(med)) : null,
          (function () {
            const link = purposeSourceLink(med);
            if (!link) return null;"""
if src.count(old_block_start) != 1:
    die('the purpose line and its link are not where they were on the med card')
end_marker = """            }, link.text);
          })()"""
i = src.index(old_block_start)
j = src.index(end_marker, i) + len(end_marker)

# WHERE IT GOES, WHICH TURNED OUT TO MATTER MORE THAN HOW IT LOOKS. The description used to sit in
# the same flex column as the medication's name, beside the 44px edit and delete buttons -- so it
# was rendering into 227px of a 390px card, and its two controls could not fit on one line at ANY
# phone width. Measured: expander 73px + gap 18px + link 168px = 259px into 227px available.
# It now spans the full width of the card, below the header row. More room for the sentence, the
# controls fit on one line, and the header row goes back to being what it looks like: a name and the
# two buttons that act on it.
after_header = "\n        )\n      ),\n"

NEW_BLOCK = """          (function () {
            const text = purposeOf(med);
            const link = purposeSourceLink(med);
            if (!text && !link) return null;
            // A MAP, NOT A SINGLE ID. It was one id -- an accordion -- and that is wrong on a list
            // of cards: expanding a description near the bottom silently collapsed one near the top,
            // so the page jumped under her thumb and the thing she had just opened moved. Rule 5.5
            // is about exactly this class -- every other gate here asks about a still frame. Each
            // card now opens and closes on its own and nothing else on the screen moves.
            const openMap = state.purposeOpen && typeof state.purposeOpen === 'object' ? state.purposeOpen : {};
            const open = !!openMap[med.id];
            // TWO LINES, THEN A TAP. A card is narrow and a real MedlinePlus answer can run to 250
            // characters, so the choice was between deleting the long ones and clamping them. The
            // clamp is a DISPLAY limit -- the whole sentence is in the DOM and in the accessibility
            // tree, so a screen reader always reads all of it, and the ellipsis says plainly that
            // there is more. Cutting the string instead would present the remains as the whole
            // sentence, which is the defect class this project has been refused for.
            //
            // Short descriptions get no control at all. Most of this app's hand-written lines are
            // one line long, and a "show all of it" under "Settles nausea and vomiting." is a button
            // that does nothing -- a dead end, which is exactly what the Enhancer's checklist calls
            // out. The threshold is on the TEXT, not on measured height: measuring after layout
            // would need a second render pass, and getting it wrong shows a control that expands
            // nothing rather than hiding one that was needed.
            const long = !!text && text.length > 88;
            return h('div', null,
              text ? h('div', {
                'data-med-purpose': med.id,
                id: 'med-purpose-' + med.id,
                style: {
                  ...TYPE.caption, color: '#4A3F47', marginTop: '4px', lineHeight: '1.35',
                  ...(long && !open ? {
                    display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  } : {})
                }
              }, text) : null,
              // ONE ROW, AND ONLY ONE THING LOOKS LIKE A LINK. These were stacked, so a long card
              // carried two link-shaped controls one above the other and 88px of height between the
              // description and the doses. The external link keeps the underline and the green
              // because it is the one that leaves the app; the expander is plain orange text,
              // because it only opens what is already on the page. Wraps at 320, with a real gap so
              // neither is a mis-tap for the other.
              h('div', { style: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: '18px' } },
                long ? h('button', {
                  'data-med-purpose-toggle': med.id,
                  onClick: () => {
                    const next = { ...openMap };
                    if (open) delete next[med.id]; else next[med.id] = true;
                    setState({ purposeOpen: next });
                  },
                  'aria-expanded': open ? 'true' : 'false',
                  'aria-controls': 'med-purpose-' + med.id,
                  // 44px the way app-v74's audit established it: inline-flex plus minHeight, never
                  // lineHeight on an inline-block -- line-height applies per line, so a label that
                  // wrapped at 320px rendered as two targets with a 44px gap between them.
                  style: { ...TYPE.caption, display: 'inline-flex', alignItems: 'center', minHeight: '44px',
                    padding: '0', background: 'transparent', border: 'none', color: '#A83D0F',
                    fontWeight: '700', lineHeight: '1.35' }
                // NOT "Read more". The link beside it says "Read it on MedlinePlus", and two controls
                // on one row both starting with "Read" is how a person taps the wrong one.
                }, open ? 'Show less' : 'Show all of it') : null,
                link ? h('a', {
                  'data-med-source': med.id,
                  href: link.url,
                  target: '_blank',
                  rel: 'noopener noreferrer',
                  style: { ...TYPE.caption, display: 'inline-flex', alignItems: 'center', color: '#0A6B4A',
                    fontWeight: '700', textDecoration: 'underline', minHeight: '44px', lineHeight: '1.35' }
                }, link.text) : null
              )
            );
          })()"""
# cut it out of the name column...
src = src[:i] + src[j:]
# ...and re-insert it after the header row that column lives in. The trailing comma the old block
# left behind goes with it; what remains is `sub || 'No generic name'), )` -- tidy that first.
stray = """h('div', { style: { ...TYPE.caption, color: '#554A52', marginTop: '1px' } }, med.sub || 'No generic name'),
          ,
        ),"""
tidy_stray = """h('div', { style: { ...TYPE.caption, color: '#554A52', marginTop: '1px' } }, med.sub || 'No generic name')
        ),"""
if src.count(stray) == 1:
    src = src.replace(stray, tidy_stray, 1)

header_end = """        h('div', { style: { display: 'flex', gap: '5px', flexShrink: '0' } },
          h('button', { onClick: () => openMedicationEditor(med), 'aria-label': 'Edit ' + med.name,"""
if src.count(header_end) != 1:
    die('the med card header row is not where it was')
close_after = src.index(header_end)
close_marker = "\n      ),\n"
k = src.index(close_marker, close_after) + len(close_marker)
src = src[:k] + "      " + NEW_BLOCK.lstrip() + ",\n" + src[k:]

# --- 5. the disclaimer must now be true -----------------------------------------------------------
old_disc = ("'These descriptions are written here \\u2014 general information about what a medication is usually "
            "for, not advice and not a dose. Follow her care team. ' + 'Tapping \\u201cLook it up\\u201d opens ' + "
            "MED_SOURCE.label + ' in your browser, and that site will see which medication you looked up. "
            "Nothing is sent unless you tap.'")
if src.count(old_disc) != 1:
    die('the disclaimer is not where it was -- refusing to leave a false one on screen')
new_disc = ("'Some of these descriptions are quoted from ' + MED_SOURCE.label + ', the US National Library of "
            "Medicine; the rest are written here. Either way they are general information about what a "
            "medication is usually for, not advice and not a dose. Follow her care team. ' + 'Tapping a link "
            "opens ' + MED_SOURCE.label + ' in your browser, and that site will see which medication you looked "
            "up. Nothing is sent unless you tap.'")
src = src.replace(old_disc, new_disc, 1)

# --- 6. version -----------------------------------------------------------------------------------
if src.count("const APP_VERSION = 'app-v74';") != 1:
    die('APP_VERSION is not app-v74')
src = src.replace("const APP_VERSION = 'app-v74';", "const APP_VERSION = 'app-v75';", 1)

# EVERY ANCHOR IS CHECKED BEFORE EITHER FILE IS WRITTEN. This used to write index.html and only
# then look at sw.js, so a drifted CACHE line left a bumped APP_VERSION behind a stale service
# worker -- the "devices get stale code" failure the deploy checklist calls critical -- and the
# patch then refused to re-run because it could see its own half-applied work ("already applied").
# Found by the app-v75 audit. Read and validate first, write last.
sw = SW.read_text(encoding='utf-8')
if "const CACHE = 'chemowell-app-v74-1';" not in sw:
    die('sw.js CACHE is not at app-v74-1 -- nothing was written')
sw_next = sw.replace("const CACHE = 'chemowell-app-v74-1';", "const CACHE = 'chemowell-app-v75-1';", 1)

HTML.write_text(src, encoding='utf-8')
SW.write_text(sw_next, encoding='utf-8')

print('app-v75 applied: %d MedlinePlus descriptions baked in' % len(rows))
