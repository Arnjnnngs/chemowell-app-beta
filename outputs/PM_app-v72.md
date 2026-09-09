# PM sign-off — ChemoWell app-v72

AUDITED-COMMIT: 9ece97fc856237825483df6f4588dc7dc778f22c
VERDICT: SHIP

**Release:** every medication says what it is for.
**Base:** app-v71 (`chemowell-app-v71-1`) · **This build:** app-v72 (`chemowell-app-v72-1`)
**Patch:** `harness-med-purpose-patch.py`, applied from the app-v71 base; refuses any other base.

## What Aaron asked for

2026-09-08: *"I've asked before to have something pulled from another site to say what the med is
intended for... it wasn't webMD, it was something else that couldn't sue me for using their stuff.
I think it was something used for public. get that going and then once completed... this needs to be
on both apps as soon as possible."*

**He was right that it never shipped, and the ask is not written down anywhere in this repo** — not
in `REQUESTS.md`, not in `BACKLOG.md`, both of which have existed since app-v25. It was dropped, not
deprioritised. Both files now carry it.

## On the source, because that was his actual worry

What cannot be copied is somebody's **prose**. The fact that ondansetron prevents nausea is not
ownable by anyone. So this ships **short original sentences** written for a patient: nothing is
copied from WebMD, from a drug label, or from any site, and **the app cites nothing**, because a
citation to a document nobody here read would be a lie.

US federal sources (openFDA, DailyMed, MedlinePlus) are public domain and would have been safe to
quote. Every one of them is blocked by the build sandbox's network policy — measured, not assumed:
`api.fda.gov`, `rxnav.nlm.nih.gov`, `medlineplus.gov`, `dailymed.nlm.nih.gov` all refused at the
proxy. That is why the text is original rather than quoted, and a later refresh to exact federal
wording is a data change into the same table rather than a rebuild.

**Net effect for Aaron: there is no licence to breach, because nothing was taken.**

## How this differs from care-tracker's v74, which shipped the same day

care-tracker has a fixed list of thirteen medications, so its table is keyed by medication **id**.
**This app has no default list — every medication is one the user typed** — so the lookup here is by
**name**, with the generic name as a fallback, both lowercased and punctuation-stripped. Someone who
types "Zofran" and someone who types "ondansetron" get the same line. **42 entries.** This line said 42, then 41, then 42 again: the count moved when `tylenol liquid` was added between audit passes, and the correction to 41 was made against the table as it stood an hour earlier. Counted against the shipped table.

## Findings carried across from care-tracker's audit, before this build existed

Its Zero Day Audit blocked v74 twice. Every finding applies here, and all were fixed here before
this build was ever a candidate:

1. **The built-in line is a placeholder, never a seeded value.** Seeded as a value, clearing the box
   and saving did nothing while the app said "updated", and every saved edit froze that day's
   wording into the user's stored record.
2. **The lookup uses `hasOwnProperty`, not a bare index.** `MED_PURPOSE['constructor']` reads back
   `Object.prototype.constructor` — a function — and the list render throws. The medication
   persists, so the Meds screen comes up empty forever, and the Meds screen is the only place edit
   and delete live. **In this app the key is the name the user typed, so it is reachable by typing
   "Constructor".** Worse than in care-tracker, and easier.
3. **The form seeder carries the field**, so an edit cannot silently wipe it.
4. **No line states a dose or a schedule**, in digits or in words.

## Clinical copy corrections, from the same audit

- **Every fever clause removed.** Acetaminophen, paracetamol, Tylenol, ibuprofen and Advil all said
  they bring down a fever. True of the drugs, and the one class of sentence here most likely to
  change what somebody does at 2am in the wrong direction: **a fever during chemo is something to
  report, not to suppress.**
- **"Gentle" removed from senna.** Senna is a stimulant laxative; "gentle" was an editorial claim.
- **"Around chemo" and "after chemo" removed** from dexamethasone, decadron and the filgrastims.
  Those are schedules written in words.

## Gate

`test/v72-med-purpose.mjs` — **24/24**, and red on four separate builds:

| Build | Result |
|---|---|
| app-v72 as it stands | **27/27** |
| app-v71 base (no feature) | 15/27 |
| bare-index lookup (the crash) | 22/27 |
| built-in line seeded as a value (care-tracker's block) | 22/24 at the time it was measured |
| save path drops the field | 21/24 at the time it was measured |
| a fever clause restored | 26/27 |
| lidocaine described as a cream again | 26/27 |
| the disclaimer made unconditional again | 26/27 |

**One check could not fail and was rewritten.** The crash section drove the add form, and this app's
add form needs more than a name, so nothing was ever added — the section scored 24/24 against the
bare-index build it exists to catch. It seeds the medication through storage now, which is also the
truer test: the danger is not the moment of adding, it is that the medication persists and every
render afterwards throws.

## Deliberately not done

- **Nothing on the Home quick-log cards.** That is the screen a patient taps when they feel awful,
  and every extra line sits between them and the dose button. The suite asserts Home stays clean
  rather than quietly skipping it.
- **No runtime fetch.** A live lookup would send a user's medication list to a third-party server and
  would fail exactly when they are offline. The text is in the file.

## Exempt, said out loud

- **iPhone rendering.** The build sandbox has Chromium only; the Meds cards are taller now and a real
  device should confirm them.
- **No live two-phone sync round trip.** The field rides the existing medication-config sync and
  nothing writes it without a real edit, so two phones cannot be made to disagree by this release
  alone — but that is reasoned, not measured.

## The Zero Day Audit BLOCKED the first build. Three findings, all copy or data, all fixed.

1. **`'lidocaine': 'A numbing cream for soreness in one spot on the skin.'`** — the only entry that
   described a PRODUCT rather than a drug. It was care-tracker's line, where lidocaine really is one
   patient's tube of cream. **Here every medication is one the user typed**, so "Lidocaine" is just
   as likely to be the viscous rinse for chemo mouth sores, or a patch. A wrong line on the right
   medication, under a disclaimer promising general information about the drug. Now: *"Numbs the
   part of the body it is used on."* — and a new table guard rejects any entry naming a form, route
   or body site.
2. **`'Eases anxiety, and is also used for sickness and sleep.'`** (lorazepam, ativan) — British
   idiom in an app that writes American and says *nausea* in every other entry; a US patient reads
   "sickness" as "being unwell". Now: *"...also used for nausea and sleep."*
3. **The disclaimer rendered unconditionally** — measured at `disclaimer: 1, lines: 0`. A notice
   about *"the line under each medication"* printed above a list with no lines in it. This app has
   no default medication list and the table is supportive-care drugs, so that is a common state, not
   an edge case. It renders only when at least one medication carries a line, and the suite asserts
   the empty case.

**Four non-blocking findings, all taken:** the schedule guard passed *"after chemo"* while the patch
header claimed it caught it; there was **no fever guard at all**, despite fever removal being this
release's headline safety decision and the header planning a later refresh to federal wording, which
says *"reduces fever"*; the placeholder does not update while a new medication's name is being typed,
so the header's discoverability claim was untrue and now says what actually happens; and the
key-normaliser comment claimed *"Zofran (ODT)"* and *"zofran"* land on the same key — they do not, a
safe miss but a false comment.

**Could not be broken, and worth not re-litigating:** `purposeLookup` survives `constructor`,
`toString`, `hasOwnProperty`, `__proto__`, fullwidth and empty names; the generic fallback and its
precedence are right; saving preserves schedule type, windows, gap hours, daily limit and unit, dose
options, placement, treatment-day availability, notes, paused and alerts byte-identical to app-v71,
with only `purpose` added; rollback is safe in both directions; zero clipping and zero horizontal
overflow at 320px.

**PM verdict: clear to ship.** All three blocks fixed, every non-blocking finding taken, the suite
grew from 24 checks to 27 and is red on five separate broken builds.

---

# Round 4 — the audit went at this release's own newest check, and broke it eight ways

**This section supersedes the verdict above where the two differ.** The sign-off said *clear to ship*
after three blocks were fixed. Two further passes followed, and both found real things, so the
sign-off had been given too early. That is worth recording rather than editing out.

**Pass 2 (delta).** A 42nd entry was committed *after* the fix commit and read
*"Eases pain. This is Tylenol in liquid form."* — a dosage form, the exact class this release had
just declared forbidden in the app's source, in the patch header and in a brand-new check literally
named *"NO entry names a dosage form, route or body site"*. **That check reported PASS on it**,
because it was a list of eleven words and `liquid` was not one of them.

**Pass 3.** The widened list was broken eight more ways: *"A pill you swallow"*, *"Given as a shot
under the skin"*, *"Given through a drip"*, *"Numbs the skin"*, *"Placed under your tongue"*,
*"rub onto"*, *"rub into"*, *"Applied where it hurts"*. Every one green. The auditor's ruling was the
right one: **widen it or rename it, and it had been widened and not renamed.**

**What was done, and it is a change of kind rather than of degree.** A list of words can never
enforce *"names no dosage form"*, so the check no longer claims to. It is named for exactly what it
does — *"NO entry uses a word from the dosage-form / route list"* — and the list now carries sixty-odd
form and route words. It bans **route and form, not anatomy**: *"lowers stomach acid"* names the organ
a drug acts on, which is the description; *"on the skin"* names where a caregiver puts it, which is a
dosage instruction this app must never give.

**And the port to `chemowell-beta` found the worst instance of the class.** That repo's copy of the
same guard was written with a **doubled backslash**, so the pattern searched for a literal backslash
and could never match anything. It had reported PASS for weeks over *"A numbing cream for soreness in
one spot on the skin"* — the sentence pass 1 blocked here three releases ago, still shipping there.

**The structural answer: four liveness checks.** Each guard is handed a sentence it MUST reject. A
typo that kills a pattern now turns one check red instead of turning the whole table green. That is
the cure for the class; widening the list was only the cure for the instance.

**Three more findings from pass 3, all taken:**

1. The comment three lines above the guard still read *"Dosage forms are allowed"* — in the commit
   titled *"no entry may name a dosage form"*.
2. The purpose line is free text and had **no wrapping rule**: 300 unbroken characters pushed the
   page sideways at 320px. `overflowWrap` plus the check that catches it. The overflow scan never
   could — it scans the app's own text, never text a caregiver typed into it.
3. **Nothing anywhere asserted that a typed line survives closing and reopening the app.** It does;
   the auditor confirmed it by hand. *"I checked by hand"* is the sentence this project has been
   burned by, so it is a check.

**Deliberately NOT done, and said out loud.** The auditor noted the table has no Neulasta, no
Reglan/metoclopramide and no Phenergan/promethazine, and is missing the brand halves of a dozen drugs
it covers. Every one of those is a new medical claim, and **adding table entries after the audit is
exactly how the Tylenol Liquid block happened** — an entry committed after the fix, past the
reviewer. They are queued as an Enhancer item for their own release, with their own read.

Also open, non-blocking, recorded rather than fixed: a medication named *Tylenol PM* whose generic
field says *Acetaminophen* does get *"Eases pain."* through the generic fallback. True but incomplete
for a combination product. The fallback earns its place for the common case; combination products get
their own pass with the entries above.

**Suite 34/34.** Falsified this round on five mutants per app across all three apps — fifteen in
total, every one red on the intended check and only that check, including the doubled-backslash bug
itself, which turns the liveness check red while the table check stays green.

**PM verdict: clear to ship**, and this time after four adversarial passes rather than one.

---

# Round 5 — the suite's own parser was the hole in every guard

Two more blocks, and the pattern is now unmistakable enough to write down as a finding in its own
right: **every block after the first has been a check that printed green while the thing it guards
was broken.** The feature has not needed a rebuild since round 1. The checks have needed four.

**Block 1 — one entry in double quotes defeated all four guards at once.** The suite reads
`MED_PURPOSE` out of `index.html` with a pattern that matched only a SINGLE-quoted value with an
all-lowercase key. The auditor added a single line written with double quotes — the natural thing to
reach for the moment a sentence contains an apostrophe, in a table made of prose about medicines —
saying that a medication brings down a fever and to put one tablet under the tongue every four hours.
The suite reported **42 entries for a 43-entry table and a full green board**: fever guard, number
guard, form/route guard, schedule guard and all four liveness lines. Chromium, loading that same
file, printed the sentence under the medication on the patient's Meds screen. **No typo was needed,
and the only assertion on the parse was that it found more than zero entries.**

It reads both quote styles now, and — the part that matters more — **the parsed count is asserted
against the number of lines that look like entries**, because the next thing this parser cannot read
will not be a quote style. A lowercase-key check comes with it: that had been "enforced" by the
parser being unable to see such a key, which is the worst way to enforce anything, since being unable
to see it was the bug.

**Block 2 — the wrapping rule did not cover the note, and the comment beside it said it did.** The
note and the dose summary render in a different container from the text column the rule was put on.
Measured at a 320px viewport on the shipped file: a portal link pasted into the note 347px, a pasted
pharmacy name in the note 668px, the same as a dose label 668px — against a 320px page. The four new
overflow cases touched neither field and stayed green. The rule is on the whole card now, one
property on the article, and a fifth case pastes into the note.

**A claim of mine that was false, and is corrected rather than quietly dropped.** The round-4 commit
said the two wrapping rules had been proved separately non-redundant "in both directions". The mutant
that would have tested that was never run. `overflow-wrap` is inherited, so the purpose line's own
copy did nothing at all. Both narrower copies are removed.

**Two words are left out of the list on purpose, said out loud.** `oral` would reject "Treats oral
thrush" — a condition, not a route, and nystatin is a supportive-care drug this table may well gain.
`dissolve` would reject "Dissolves clots", which is what a drug does rather than how it is taken. The
cost is that "An oral steroid" and "Dissolves on the tongue" pass. That is the accepted price of a
list that must not reject true descriptions, and it is why the reader is the gate and the list is
only the floor.

**PM verdict: clear to ship.** Five adversarial passes. The feature was right after the first;
everything since has been the checks catching up with it.
