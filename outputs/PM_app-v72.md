# PM sign-off — ChemoWell app-v72

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
types "Zofran" and someone who types "ondansetron" get the same line. 42 entries.

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
| app-v72 as it stands | **24/24** |
| app-v71 base (no feature) | 12/24 |
| bare-index lookup (the crash) | 21/24 |
| built-in line seeded as a value (care-tracker's block) | 22/24 |
| save path drops the field | 21/24 |

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

**PM verdict: clear to ship once the Zero Day Audit reports.**
