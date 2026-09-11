# Zero Day Audit — ChemoWell app-v74

AUDITED-COMMIT: 8e8a394c89081076bf71a014f85287f083a5782c
VERDICT: DO NOT SHIP

Code audited at `8e8a394` (`index.html`, `sw.js`, `harness-med-source-patch.py`, `test/v74-med-source.mjs`).
The three commits since it (`cef9b72`, `0cc40af`, `a4131ad`) touch only `README.md` and `outputs/`,
and the README row added by `a4131ad` is read and judged here as part of the record.

---

## HEADLINE — RENAME A MEDICATION AND IT KEEPS THE PREVIOUS DRUG'S SENTENCE AND ITS CITATION

**Measured, in a real browser, on the shipped file.** Seed a medication `Zofran` carrying a cached
`purposeSource` (the state any medication is in the moment the lookup succeeds once). Open the
editor, change the name to `Compazine`, Save, with the endpoint dead — the state the release itself
says a real phone may be in forever. The card then reads:

    Compazine
    Prevents and settles nausea and vomiting.
    Where this came from · MedlinePlus  →  https://medlineplus.gov/druginfo/meds/a601209.html

`a601209` is ondansetron. Under a medication named Compazine the app prints Zofran's sentence and,
beneath it, a citation stating that this is where that sentence came from. Both are false. It
persists — there is no expiry, no retry, and when the lookup fails (offline, CORS-blocked, no match,
which the release admits is unverified and may be permanent) nothing ever corrects it.

**It is worse than a stale line: it beats the app's own correct answer.** `purposeOf()` puts the
cached source ABOVE the built-in table. The built-in table knows Compazine — *"Settles nausea and
vomiting."* — and the stale Zofran record suppresses it. With the fix applied (below) the same probe
prints exactly that table line and a `Look it up on MedlinePlus` search link.

**This is the hazard the release names in its own words, on a path that needs no race at all.**
`test/v74-med-source.mjs` §9 and the README both say a late answer is dropped *"otherwise the
medication would carry a description, and a citation under it, fetched for a different drug."* The
in-flight race is guarded. The committed case is not: `nextMedicationId(name, existingId)` returns
`existingId`, so a rename keeps the id; `saveMedicationEditor` builds `candidate` from
`...(original || {})`, so `purposeSource` is carried onto the new name; `normalizeMedication` keeps
it because the URL is https and the text passes the guards. Nothing anywhere compares the cached
source against the name it was fetched for.

§9 of the suite cannot see this — it deliberately deletes `purposeSource` before renaming, so the
one case that matters is outside the check.

**Probe:** `probe-rename.mjs` in the scratchpad (not committed; the substance is above and in the
report text). **Falsified:** it goes green on a patched copy, so it is not a check that can only fail.

### The fix, and the trap in it

Stamp the name on the record and require it to match:

    // fetchPurposeSource(): return { text, url, label, forName: clean, fetchedAt }
    // sourcedPurposeText(med) and purposeSourceLink(med): if src.forName is set and does not
    //   match med.name (trim + lowercase), treat the record as absent.

**`normalizeMedication` is a whitelist and will silently drop the new field.** It rebuilds
`purposeSource` as exactly `{url, text, label, fetchedAt}`. I hit this: the first patched build still
showed the false citation because `forName` never survived a load. It must be added there too
(`forName: String(rawSource.forName || '').slice(0, 80)`).

Prefer this over "delete `purposeSource` when the name changes in the editor": stamping the name also
covers a record arriving from a backup or another phone, which the editor check cannot.

A check for it must be added to `test/v74-med-source.mjs` and falsified.

---

## SECOND BLOCKER — THE README SAYS SOMETHING THE BUILD DOES NOT DO

README `app-v74` row: *"The release is built so this is safe: **if the fetch never succeeds the app is
exactly what it is today**, with no error, no empty state and no promise on screen that did not come
true."*

It is not exactly what it is today. When the fetch never succeeds, **every medication card gains a
new 44px underlined green link reading "Look it up on MedlinePlus"**, and the disclaimer paragraph is
reworded. The release's own suite prints it: §1 asserts *"a LOOKUP link is offered"* in precisely the
state the sentence describes.

The patch header's version of this sentence is honest — it ends *"the built-in line shows, **the
lookup link shows**, and nothing anywhere claims a source it does not have."* The README dropped the
qualifier that made it true.

Compounding it: **the README never states anywhere that a new link now appears under every
medication**, including medications with no description at all (`purposeSourceLink` returns a search
link whenever `med.name` is non-empty; only the *disclaimer* is gated on some medication having a
line). That is the most visible change in the release and it is missing from the record, while the
sentence that is present says nothing visible changed.

Both are one-edit fixes. They are listed as blocking because on the previous release four refusals
were for exactly this class, and this is a sentence Aaron reads as the record of what shipped.

---

## NON-BLOCKING FINDINGS

**N1 — the guards under-block in named ways.** Measured by running `purposeTextIsSafe` directly
against adversarial strings. These PASS and would reach the screen:

* spelled-out numbers — `"Take two"`, `"Take five"`, `"Half of one"`
* non-ASCII digits — `"Take ٥ each day"` (`/\d/` has no `u` flag, so it is ASCII-only)
* routes and forms not in the list — `"Used as eye drops for an infection of the eye"`,
  `"Given as drops into the ear for pain"`, `"Instilled into each nostril"`, `"Given per os"`,
  `"Put into the eye"`, and `"Given by nebuliser"` — the British spelling; only `nebulised/nebulized`
  are listed, and this project has a documented British-spelling hazard
* a fever claim by synonym — `"Helps with pyrexia and chills"`

Over-blocking is fine and it over-blocks a great deal; these are under-blocks. The README's summary
*"no numbers, no schedule, no dosage form, no route, no fever claim"* is therefore stronger than the
code. Cheap fixes: `\p{Nd}` with the `u` flag, one–twelve spelled out, `drops|instil|nostril|nasal|
otic|ophthalmic|per os|nebulis`, `pyrexia|febrile`.

**N2 — the https check is not on the write path.** `normalizeMedication` rejects a non-`https:` URL
on every load, and the suite proves it. But `refreshPurposeSource` writes `String(found.url)` straight
from the response without that test, and `h()` renders it with `setAttribute('href', v)` — so a
`javascript:` href from the endpoint would be live for that session and only dropped on the next load.
It needs NLM's own JSON over TLS to carry it, so this is hardening, not an attack. It is one line
(`if (!/^https:\/\//i.test(found.url)) return null;`) and the claim should not be made without it.
Otherwise clean: `target="_blank"` ships with `rel="noopener noreferrer"` (verified in the DOM), the
search URL is `encodeURIComponent` onto a fixed https origin so there is no open redirect, and every
text child goes through `createTextNode`, so no fetched string can inject markup.

**N3 — this is the first code in the app that writes the medication config asynchronously.**
`refreshPurposeSource` calls `persistMedicationConfig(state.meds, state.archivedMeds)` up to ~6s
(the abort timeout) after a save. A backup restore writes the medication list to localStorage and
then reloads 700–900ms later; a lookup answering inside that window would overwrite the just-restored
list with the in-memory one, and the reload would serve the overwrite. Reaching it means confirming a
restore within about six seconds of saving a medication, which is not realistic — but no async writer
of this key existed before v74, so the class is new. A generation token, or skipping the write while
`state.bkPending`/a reload is scheduled, closes it.

**N4 — a comment claims a property the code does not have.** `refreshPurposeSource`: *"Gone, renamed,
or already described by the caregiver while the request was in flight: in every one of those cases the
answer is now stale and is dropped rather than written."* Only the name is compared. If she types a
description while the lookup is out, the answer **is** written. No harm results — her wording still
wins and the link correctly drops to "Look it up" — but the sentence is not true of the code, which is
the same defect as the README one, one level down.

**N5 — the disclaimer and the link disagree about when they appear.** The disclaimer renders only
when some medication has a purpose line; the link renders under every medication with a name. So a
list where nothing is described shows a "Look it up on MedlinePlus" link under every row with no
disclaimer above it. And in the expected state — nothing ever fetched — the disclaimer's *"where one
came from MedlinePlus, the row links to the page it came from"* describes something that is not on the
screen: the v72 "a notice about nothing" defect that the code comment two lines above it cites.

**N6 — the unverified half, judged.** The claim *"if the fetch never succeeds the app is exactly what
it is today"* is false as written (see the second blocker) but the property it is reaching for is
**true and I measured it**: with the endpoint dead the built-in line still shows, nothing is cached,
no error reaches the screen, no request is made at load or paint, and no citation is claimed. On that
basis shipping an unverified endpoint is acceptable — the failure is silent and harmless.

What should change first is how it is described. Beyond CORS, there is a second reason it may never
produce text: MedlinePlus Connect returns `summary._value` as an HTML block, ordinarily far longer
than the 150-character ceiling, so against the real service the most likely outcome is that
`purposeTextIsSafe` rejects every response, `text` stays empty, and the auto-fill Aaron asked for
never happens while the link quietly degrades to a search. That is safe. It is not the feature. The
release message should say plainly that the auto-fill may simply never trigger until the response
shape is confirmed on his phone, and name that check.

**N7 — suite gap.** §9 clears `purposeSource` before renaming, which is exactly what puts the headline
finding outside the suite's reach.

---

## WHAT I TRIED TO BREAK AND COULD NOT

* **Nothing is deleted.** No entry write, edit or delete on any path in this diff; no `removeEntryDB`;
  the built-in table is untouched; `purposeSource` is additive and optional.
* **Two lookups in flight cannot clobber each other.** `state` is a module-level object that
  `setState` mutates in place, so each answer re-reads the current list. Save-A/save-B, save-then-
  archive, save-then-delete, save-then-rename and save-then-readd all resolve to either a correct
  merge or an early return.
* **A late answer for a removed or renamed medication is dropped** (id lookup + name comparison).
* **The out-guard holds.** Unsafe text planted in storage the way another device could publish it does
  not reach the screen, and the citation stands down to "Look it up".
* **A non-https stored URL is dropped on load.**
* **No network at render.** Zero requests during load and paint, measured.
* **A stalling lookup does not delay the save** — 28ms against a 9s stall.
* **No temporal dead zone.** `MED_SOURCE` and the guards are at 1095–1171, `normalizeMedication` at
  1173, and the first call at 1417.
* **No markup injection** from fetched text; children are text nodes.
* **`h()` null-attribute trap** not tripped: every attribute on the new `h('a', …)` is a string.
* **Version mechanics** correct: `APP_VERSION` → `app-v74`, `sw.js` → `chemowell-app-v74-1`, patch
  refuses any base but app-v73.
* `test/v74-med-source.mjs` re-run here: **36/36, exit 0, no page errors.**

## NOT VERIFIED BY ME

* `test/falsify-app-v74.py` was not re-run (mutation sweep, outside the time cap). Its design was read
  and the four defects it is credited with finding are consistent with the shipped file.
* The claim that four failures and one non-starter in the full sweep are pre-existing and identical on
  app-v71 was not re-measured.
* The live endpoint, for the same reason the builder gives: every external host is 403 at the egress
  proxy.

---

## WHAT HAS TO HAPPEN BEFORE THIS SHIPS

1. Stamp `forName` on `purposeSource` and require it to match, **including in `normalizeMedication`**,
   so a renamed medication cannot carry another drug's sentence or its citation.
2. Add a check for the committed rename to `test/v74-med-source.mjs` and falsify it.
3. Correct the README: remove "exactly what it is today" or restore the patch header's qualifier, and
   state that a link now appears under every medication.
4. Re-audit as a delta pass.
