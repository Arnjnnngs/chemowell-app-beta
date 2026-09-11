# PM sign-off — ChemoWell app-v74

AUDITED-COMMIT: 6f21d591f27d06be39c789f034cdc872f9fbdfab
VERDICT: SHIP

**What this SHIP rests on, stated exactly, because a sign-off that overstates its own basis is the
thing this project has been burned by most.**

Two independent audit passes. The first refused on a REAL DEFECT — a rename carried the previous
drug's sentence and citation onto a different medication — and on an untrue claim in the release
notes. **The second pass CLOSED the code blocker in terms: it attacked the rename guard five ways on
the running build and it held every time, and it recorded no code blocker at all.** What it still
refused was four untrue statements in these documents, and those are fixed and listed in the README
row and below.

**The doc corrections have NOT been re-audited**, and they are the only part of this release no
independent pass has seen in its final form. They are prose, not behaviour. Every claim in them was
re-checked against the running build before this header was stamped.

**Aaron gave an explicit go on 2026-09-11:** *"Ship what you have now so I can see the updates for
medlinePlus."* That is the authority for shipping without a third pass, and it is recorded here
rather than implied.

**Shipping app-v74 necessarily ships app-v73** — the archived-medications release it is built on —
because they are the same branch. app-v73 had six audit passes of its own.

**Release:** the medication description can fill itself in from an official source, and the row says
where it came from.
**Base:** app-v73 (`chemowell-app-v73-1`) · **This build:** app-v74 (`chemowell-app-v74-1`)
**Patch:** `harness-med-source-patch.py`, applied from the app-v73 base; refuses any other base.

## What Aaron asked for, and the premise that had to be corrected first

> *"The med desc should also fill automatically with what it's for based on the website it was pulled
> from. There should be a clickable source link to get to the website with that exact wording that
> pulls in the app."*

**The description already filled itself in** — `purposeOf()` has fallen back to `MED_PURPOSE` since
app-v23. **What never existed was a website.** Every line in that table was written by hand here,
deliberately, so that nothing was copied and nothing had to be cited, and before this release the app
made **zero** outbound requests of any kind. Building on his picture without saying so would have
meant "fixing" something that was not broken and quietly inventing a provenance the app never had.

## The write model, stated before a line was written

* **Appends** one optional field per medication: `purposeSource { text, url, label, forName, fetchedAt }`. **`forName` was missing from this line** until the second audit pass — the write model is the one statement Rule 1.5 makes binding, and it omitted the field the whole first fix was built on.
* **Deletes** nothing. No entry is written, edited or deleted. The built-in table is untouched.
* **Tie-break**, one rung added to the order that already existed:
  what she **typed** → cached **official** text → the **built-in** line → nothing at all.
  Her wording was already the top rung and stays there.

## The mechanics

* **The lookup runs ONCE, on save.** Never at render, never on load, never on a timer. It is not
  awaited, so a dead or slow network cannot delay the save by a millisecond — the editor closes, the
  card appears, the source arrives later or never.
* **It is cached on the record**, so every later paint is offline-identical to today. That matters
  more here than almost anywhere: this is a patient's phone in a hospital where signal drops.
* **A late answer is dropped.** If the medication was renamed or removed while the request was in
  flight, the answer is stale and is discarded rather than written — otherwise the medication would
  carry a description, and a citation under it, fetched for a different drug.

## THE GUARDS MOVED INTO THE APP, and that is the real change

Until now *no numbers, no schedule, no dosage form, no route, no fever claim* were enforced by
`test/v72-med-purpose.mjs` against a **static table at build time**. Fetched text arrives at **run
time on a patient's phone**, where no suite can see it. The same rules are now implemented in the app
and applied before a single fetched character can reach the screen. Text that fails is **discarded**;
the **link is kept**, because a link is not a claim about wording.

Every one of those rules was paid for by an audit block on this project — the fever rule most of all:
a fever during chemo is a thing to report, not to suppress, and this app tracks Temperature.

## The citation is honest in every state

A link may only claim to be the source of wording that is **actually on screen**.

| What the card shows | What the link says | Where it points |
|---|---|---|
| Cached official text | **Where this came from · MedlinePlus** | the exact page it came from |
| The caregiver's own wording | Look it up on MedlinePlus | a search |
| Our built-in line | Look it up on MedlinePlus | a search |
| Nothing | Look it up on MedlinePlus | a search |

**That last row said *(no link)* and it was false** — measured on the running build, a medication with no typed purpose, nothing in the table and no cached source still renders the lookup link, because the link sits outside the description's conditional and `purposeSourceLink()` returns null only for an empty name. The README in the same commit already said every card gains a link, so the two documents for one release contradicted each other. **That is the defect that got this release refused in the first place, repeated inside the file written to fix it.**

Calling a search "the source" of a sentence written here would be a false citation, which is the one
thing this feature must not do.

## Why MedlinePlus and not WebMD or drugs.com

Theirs is copyrighted and their terms forbid republishing it — copying their wording in is precisely
what app-v23 set out to avoid. MedlinePlus is the US National Library of Medicine: public domain,
written for patients rather than clinicians, and with stable pages worth linking at.

## WHAT IS DELIBERATELY EXEMPT, AND WHAT IS NOT VERIFIED

* **THE LIVE FETCH IS NOT VERIFIED, and this is the honest limit of the release.** The sandbox blocks
  every external host at the egress proxy — 403 on CONNECT to `dailymed.nlm.nih.gov`,
  `connect.medlineplus.gov`, `rxnav.nlm.nih.gov` and `api.fda.gov` alike — and its own documentation
  says to report a blocked host rather than route around it. So every mechanic is proved against a
  **stubbed endpoint**, the way Firebase has always been stubbed here, and what is **not** proved is
  that the real service answers a browser at all: a service that sends no `Access-Control-Allow-Origin`
  header cannot be read cross-origin, and no local test reveals that.
  **Stated accurately rather than reassuringly:** if the fetch never succeeds there is no error, no
  empty state and no false citation — the built-in line shows and nothing claims a source it does not
  have. **What changes either way** is that every card gains a *"Look it up on MedlinePlus"* link and
  the disclaimer is reworded; an earlier draft of this file said the app would be *"exactly what it is
  today"*, which omitted the single most visible change in the release. **And the likely real outcome
  is that the auto-fill never triggers:** MedlinePlus Connect's summary is HTML and will almost
  certainly exceed the 150-character ceiling, so the text is discarded and only the link survives.
  Safe, and not the feature. Confirming the response shape needs Aaron's phone.
* **The re-check inside `sourcedPurposeText()` is redundant** and has no mutant of its own:
  `normalizeMedication()` strips the same text first on every load. It is kept as a second line on
  patient-facing medical text, and removing it alone changes no behaviour — which is why no check goes
  red for it, and why that is written down rather than covered by a check that cannot fail.
* **iPhone rendering** — this sandbox has Chromium only.
* **care-tracker is untouched.** Aaron: *"start on chemowell so you get the mechanics working first
  before you move to caretracker."*

## The suite, and what falsifying it found

`test/v74-med-source.mjs` **43/43**. `test/falsify-app-v74.py`: **ALL MUTANTS BEHAVED**.

Falsification found **four** real defects in the release and the suite, three of them checks that
could not fail:

1. **A temporal dead zone in the app.** `normalizeMedication` reads the guards, and they were declared
   4,500 lines below it — the read threw, but only once a medication actually HAD a cached source,
   which is why the first section of the suite passed and the third did not.
2. **`[data-med-editor]` does not exist in this app.** "The editor closed without waiting on the
   lookup" asked whether that attribute was absent, so it was always true and passed on every build.
   It reads the Save button now.
3. **The stale-answer check tested the wrong hazard.** It asserted the rename survived — which it
   always did, because the write merges into the current record and never touches the name. The real
   damage is a description, and a citation, fetched for a different drug.
4. **The stub answered the same page whatever it was asked**, so "this URL is stale" and "this URL is
   right for the new name" were the same string and the check could not be written honestly. The stub
   now tags the page with the name queried, and the stale lookup is made to answer **first and alone**
   — with one fixed delay both answered and the second overwrote the first, hiding the defect.

Two guards cover stored text and neither can be turned red alone, because each covers the other. That
is defence in depth rather than a hole, and it is proved by a mutant that breaks **both**, with each
alone listed as expected-green.

## THE DEFECT AN AUDIT BLOCKED THIS RELEASE FOR, and the guard that closed it

**Renaming a medication carried the previous drug's sentence AND its citation onto the new one.** An
edit keeps the record — same id, fields spread from the original — so a medication renamed from
Zofran to Compazine printed *"Prevents and settles nausea and vomiting."* with a link to
**ondansetron's** page underneath, and **beat the app's own correct line for Compazine**. Permanent,
with nothing to correct it, and it needed no race: the in-flight guard was already there and this sat
outside it, because the check written for it deliberately clears the field before renaming.

A cached description now records **`forName`**, the name it was looked up under, and is used only
while that still matches. The second pass attacked the fix five ways — a changed generic name, a
case-only rename, whitespace, two medications sharing a name, and races stacked on top — and it held
each time. **An entry stored without `forName` stops being displayed rather than being trusted**;
that loses a correct description rather than keeping a possibly-false one, and since app-v74 has
never shipped, no record in the wild carries one at all.

## The full sweep

`v74-med-source` 43/43 · `v73-archived-meds` 50/50 · `v72-med-purpose` 62/62 · `overflow-scan` PASS.
30 PASS, 4 FAIL, 1 COULD-NOT-START — and those five (`audit-v55`, `pm-v55`, `pm-v55b`,
`v57-browser-notice`, `audit-v55b`) are pre-existing and were verified identical on app-v71.

## What needs Aaron's phone

1. Add or edit a medication the app does not already know — the description should fill itself in
   within a second or two, with **Where this came from · MedlinePlus** under it. **If it does not,
   that is the unverified half above, not a bug in the app** — nothing else will be wrong.
2. Tap that link: it should open the MedlinePlus page for that drug.
3. Turn the phone to airplane mode and reopen the app: the description and the link must still be
   there.
4. Type your own wording for a medication: yours must win, and the link must change to *Look it up*.
