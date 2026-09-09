# PM sign-off — ChemoWell app-v72

AUDITED-COMMIT: 2345058d6cd2b455488f7ce782b4df7f9a72afd6
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

**PM verdict at the end of round 1: clear to ship — and it was given too early.** All three blocks
of that round were fixed and every non-blocking finding taken, and the suite had grown from 24
checks to 27. Five further adversarial passes followed and every one of them found something
real, so the numbers in this paragraph are the numbers of the *first* round and nothing more.
**The shipped figures are in the final verdict at the foot of this document**, and the rounds
below say what changed. This paragraph is left standing rather than edited into agreement,
because a sign-off that quietly rewrites itself teaches nobody anything; but it is labelled, because the last audit found a reader could reach a verdict here and never reach the correction.

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

---

# Round 6 — the screen none of the checks ever visited, and a cross-check blind in both halves

**Block 1 — Home.** The wrapping rule has now been put on three different containers in three rounds,
each time the one the last audit named: the purpose line, then the medication card, then Home. Paste a
long pharmacy name into a medication's **name** and Home reached **1019px on a 320px phone** — and the
bottom tab bar stretched with it, so the **Meds** tab a caregiver would use to go back and fix the name
was no longer on the screen. The paste that causes the problem moves the only route to the fix out of
reach. The release's own new section is titled *"nothing a caregiver pastes scrolls the page
sideways"* and **every one of its five cases only ever looked at the Meds screen.**

Three rounds of putting a property on whichever container the last audit named is three rounds of
fixing an instance, so this round put it on `*` in the app's own CSS reset. A Home case was added to
the suite.

> **BOTH SENTENCES THAT FOLLOWED THIS IN THE ORIGINAL WERE FALSE, AND ROUND 7 BELOW PROVED IT.**
> They read: *"`overflow-wrap` cannot change a layout except to stop a long unbroken word pushing the
> page sideways, and the overflow scan across every screen at ten device widths is the evidence that
> nothing else moved."* It can and it did — the property changes min-content sizing and it broke two
> screens — and the scan is not evidence of that, because the scan measures width and the damage was
> vertical. They are quoted rather than deleted because a sign-off that quietly edits its own wrong
> claims out teaches nobody what to distrust next time.

**Block 2 — the new count check was blind in both halves at once.** It compared what the parser read
against the number of lines that looked like entries — and a value wrapped across two lines with `+`
is read by NEITHER, so the two agreed and the board stayed green while the app rendered the whole
sentence. **A cross-check whose halves fail in the same direction is not a cross-check.** Counting was
the wrong shape: every line inside the table must now be something the suite can **account for** — one
complete entry, a comment, or blank. Anything else is red, whatever it turns out to be, which covers
the continuation line, the template literal, two entries on one line, and the next trick as well.

**Block 3 — this document contradicted itself.** Round 5's numbers were appended below round 1's
verdict rather than replacing it, so a reader could reach *"clear to ship … 34/34 … fifteen mutants"*
and never reach the correction. That paragraph is now labelled as the first round's, and points here.

---

# THE FINDING OF THIS RELEASE, WORTH MORE THAN THE FEATURE

Six adversarial passes. **The feature has not been rebuilt since pass 1. Every block since has been a
check that printed green while the thing it guarded was broken**, or a record that said something
untrue about what shipped:

| Pass | What was green while something was broken |
|---|---|
| 2 | the dosage-form guard, on the entry it was written for |
| 3 | the same guard, on eight more sentences; the guard's NAME overclaimed |
| 4 | two liveness checks that re-typed their pattern instead of naming it; a 320px check measured with a ruler that stretches |
| 5 | the suite's own PARSER — one double-quoted entry was invisible to all four guards at once |
| 6 | a cross-check blind in both halves; and five overflow cases that never left one screen |

The lesson is not any of the individual fixes. It is that **on this project a green check is not
evidence until somebody has watched it go red**, and that a check written to catch a class must be
tested against the class rather than the instance that prompted it.

---

# Round 7 — the fix broke two screens, and the check that would have caught it was on the wrong screen

**Block 1 — `*{overflow-wrap:anywhere}` broke Home and In-Patient.** The property changes
**min-content intrinsic sizing** (`break-word` does not), so flex items across the app could shrink to
about one character. Measured against app-v71 and against the same build minus that one line, twelve
screens at 320/360/390/428: Home's hospital-stay banner text column collapsed 207px → 27.6px, its body
went from **4 lines to 32** with words split mid-syllable, and the In-Patient heading rendered
**"IN-PATIEN / T / STATU / S"**.

**And the overflow scan reported CLEAN through all of it.** It measures WIDTH; that damage is
vertical. The previous round of this document cited the scan as evidence the rule *"moved nothing
else"* — **a false claim about what that tool can see**, and the most useful sentence in this whole
release to have written down.

**Block 2 — the property was never what fixed Home anyway.** Two causes, and `overflow-wrap` could
reach neither: the medication name on the quick-log card sits under `white-space: nowrap`, which
disables wrapping outright and carried no truncation, so it simply grew; and the dose buttons are
`flex: 0 0 auto` with the name inside them, so they refused to shrink and had no maximum width. Both
are fixed directly, and Home measures 320px at a 320px viewport where it measured 829px. The wrapping
property is scoped to the three places that render a string a caregiver typed — the medication card,
the Home quick-log cards, the grouped-medications card.

**Block 3 — the Home check never reached Home.** It clicked a tab called *Today*; the tab is *Home*,
so the click returned false and every measurement was taken on the Meds screen. On a build where Home
measured 900px with the tab bar stretched to match — the previous round's block, unfixed — it printed
PASS. Every step is asserted now: the navigation, that every bottom tab is still on the screen, and
the restore, whose silent failure used to surface later as a misleading persistence failure on a
different check.

**Block 4 — the accounting check accepted a line its own parser could not read:** `'morphine' : '…'`,
one space before the colon. Two patterns written by hand to agree with each other will not. Both are
built from one source string now, so a line the accounting accepts is **by construction** a line the
parser reads.

---

# THE FINDING OF THIS RELEASE, WORTH MORE THAN THE FEATURE

Seven adversarial passes. **The feature has not been rebuilt since pass 1. Every block since has been
a check that printed green while the thing it guarded was broken, or a record that said something
untrue about what shipped:**

| Pass | What was green while something was broken |
|---|---|
| 2 | the dosage-form guard, on the entry it was written for |
| 3 | the same guard, on eight more sentences; its NAME overclaimed |
| 4 | two liveness checks that re-typed their pattern instead of naming it; a 320px check measured with a ruler that stretches |
| 5 | the suite's own PARSER — one double-quoted entry was invisible to all four guards at once |
| 6 | a cross-check blind in both halves; five overflow cases that never left one screen |
| 7 | the overflow SCAN, reporting CLEAN over two visibly broken screens, because it measures width and the damage was vertical; and the new Home check, on the wrong screen |

Three lessons, in the order they cost something:

1. **A green check is not evidence until somebody has watched it go red.**
2. **A tool's silence is only evidence about the question that tool asks.** The scan answers *does
   anything overflow sideways* and nothing else; it was cited as though it answered *did the layout
   change*.
3. **A check written to catch a class must be tested against the class**, not against the instance
   that prompted it.

**PM verdict: clear to ship.** Suite **43/43**. `overflow-scan` **170/170 CLEAN**.
`./run-all-tests.sh`: PASS 26 / FAIL 4 / cannot-start 1 — **the four failures and the non-starter are
pre-existing and identical on the untouched app-v70 and app-v71 baselines**, verified by running the
same harness against them rather than inferred.
