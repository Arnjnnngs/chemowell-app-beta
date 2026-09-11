#!/usr/bin/env python3
"""app-v73 -> app-v74: every medication gets a link to look it up on MedlinePlus.

AARON, 2026-09-11, after reading what the first version of this release actually did:
"Strip the fetch ship the link and start database."

WHAT THIS RELEASE IS NOW, AND WHY IT IS A TENTH OF THE SIZE IT WAS AN HOUR AGO.

The first version fetched a description from MedlinePlus when a medication was saved, guarded the
text at runtime, cached it on the record, and printed a citation over it. It worked, it was audited
twice, and it was WRONG TO SHIP -- because this app tells its users, on screen, in Welcome, Settings
and About:

    "no cloud, no accounts, no tracking, and the app never sends your information anywhere"

A lookup sends the MEDICATION NAME. MedlinePlus would have seen an IP address asking about Neulasta,
then dexamethasone, then ondansetron -- which composes into "someone at this address is having
chemotherapy". Nothing identifying, and a US government service rather than an ad network, but it is
inferable health information leaving the phone automatically, and it would have made the app's own
promise untrue. This repo's hard rule -- no casual network write of user data, Aaron's explicit
sign-off -- says so directly, and the one exception he ever granted was encrypted sync, deliberately,
with a lawyer's review attached.

So: NO FETCH. The app makes no outbound request of any kind, exactly as before this release.

WHAT IS LEFT is a link, and a link is not a transmission. Nothing leaves the phone until the
caregiver taps it, at which point it is an ordinary web visit -- and `rel="noopener noreferrer"`
means MedlinePlus is not even told which app she came from.

WHAT IT APPENDS: nothing. No new stored field, no new record shape, no migration. The link is built
from the medication's name at render time.
WHAT IT DELETES: nothing.

THE LINK NEVER CLAIMS TO BE A SOURCE. It reads "Look it up on MedlinePlus" and points at a search,
because the description above it was written here and did not come from that page. Calling a search
the source of a sentence written in this repo would be a false citation. When the baked-in database
lands -- fetched once at build time, on a server, never on a phone -- the text and its exact page
will travel together and the wording will change to match. Not before.

MedlinePlus rather than WebMD or drugs.com: theirs is copyrighted and their terms forbid
republishing it, which is what app-v23 set out to avoid. MedlinePlus is the US National Library of
Medicine -- public domain, written for patients, and that is what makes the database step legal at
all.
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

# ---- 1. where a medication can be looked up ----------------------------------------------------
rep("""function medPurposeKey(text) {""",
    """// ---- LOOKING A MEDICATION UP (app-v74) --------------------------------------------------------
// A SEARCH URL BUILT FROM THE NAME, WITH NO NETWORK. Nothing is requested, nothing is stored and
// nothing leaves the phone until the caregiver taps the link herself.
// MedlinePlus is the US National Library of Medicine: public domain, written for patients rather
// than clinicians. WebMD and drugs.com are deliberately not used -- their text is copyrighted and
// their terms forbid republishing it, which is exactly what this app set out to avoid when it wrote
// its own descriptions by hand.
const MED_SOURCE = {
  label: 'MedlinePlus',
  searchUrl: function (name) {
    return 'https://medlineplus.gov/search/?query=' + encodeURIComponent(String(name || '').trim());
  }
};
// THE LINK IS A LOOKUP, NEVER A CITATION. The description above it was written in this repo, so
// saying "source" over it would be a false citation -- the class of defect this project has been
// refused for repeatedly. When the baked-in database lands, text and page will travel together and
// the wording changes to match. Not before.
function purposeSourceLink(med) {
  const name = med ? String(med.name || '').trim() : '';
  if (!name) return null;
  return { url: MED_SOURCE.searchUrl(name), text: 'Look it up on ' + MED_SOURCE.label };
}
function medPurposeKey(text) {""")

# ---- 2. the row --------------------------------------------------------------------------------
# Its own element and its own hook so it can be asserted on directly. target + rel are set together:
# target=_blank without noopener hands the opened page a handle on this one, and noreferrer means
# MedlinePlus is not told which app she came from.
rep("""          purposeOf(med) ? h('div', { 'data-med-purpose': med.id, style: { ...TYPE.caption, color: '#4A3F47', marginTop: '4px', lineHeight: '1.35' } }, purposeOf(med)) : null""",
    """          purposeOf(med) ? h('div', { 'data-med-purpose': med.id, style: { ...TYPE.caption, color: '#4A3F47', marginTop: '4px', lineHeight: '1.35' } }, purposeOf(med)) : null,
          (function () {
            const link = purposeSourceLink(med);
            if (!link) return null;
            return h('a', {
              'data-med-source': med.id,
              href: link.url,
              target: '_blank',
              rel: 'noopener noreferrer',
              style: { ...TYPE.caption, display: 'inline-block', color: '#0A6B4A', fontWeight: '700', textDecoration: 'underline', marginTop: '3px', minHeight: '44px', lineHeight: '44px' }
            }, link.text);
          })()""")

# ---- 3. the disclaimer -------------------------------------------------------------------------
# It said the descriptions were written here, which is still true, and must now also account for the
# link. It must NOT imply the descriptions came from MedlinePlus -- they did not.
m2 = re.search(r"h\('div', \{ 'data-med-disclaimer': 'true'.*?\},\s*('[^']*')", s, re.S)
if not m2:
    sys.exit('REFUSING: could not read the disclaimer string')
NEW_DISC = ("'These descriptions are written here \\u2014 general information about what a medication "
            "is usually for, not advice and not a dose. Each one links to ' + MED_SOURCE.label + ', "
            "where you can read more. Follow her care team.'")
s = s[:m2.start(1)] + NEW_DISC + s[m2.end(1):]

# ---- 4. version stamp --------------------------------------------------------------------------
if "const APP_VERSION = '%s';" % FROM_V not in s: sys.exit('REFUSING: version stamp missing')
s = s.replace("const APP_VERSION = '%s';" % FROM_V, "const APP_VERSION = '%s';" % TO_V, 1)
open(out, 'w', encoding='utf-8').write(s)

sw = open(sw_in, encoding='utf-8').read()
old_cache, new_cache = 'chemowell-%s-1' % FROM_V, 'chemowell-%s-1' % TO_V
if old_cache not in sw:
    sys.exit('REFUSING: sw.js cache is not %s' % old_cache)
open(sw_out, 'w', encoding='utf-8').write(sw.replace(old_cache, new_cache))
print('patched %s -> %s (cache %s -> %s)' % (FROM_V, TO_V, old_cache, new_cache))
