# PM sign-off — ChemoWell app-v74

AUDITED-COMMIT: 095851ea0512ac829cf49ea370a73edad820b257
VERDICT: SHIP

**SHIPPED ON AARON'S EXPLICIT INSTRUCTION, WITHOUT AN AUDIT PASS ON THIS EXACT BUILD. Both halves of
that sentence are true and neither is buried.**

Aaron, 2026-09-11: *"Ship what you have now so I can see the updates for medlinePlus"*, then
*"Strip the fetch ship the link and start database."*

**What no independent pass has seen:** this build. The two audit reports on record examined the
FETCHING release, which is deleted. A refusal against code that no longer exists is not a refusal
against this, and it is not a clearance either.

**Why shipping anyway is defensible, stated so it can be argued with:** what ships is strictly less
than what was audited. No network request, no stored field, no record shape, no migration, no
runtime guards, no citation logic — an anchor element and a disclaimer string. The whole diff against
app-v73 is a link built from `med.name` at render time. `test/v74-med-lookup.mjs` is 23/23 and its
first section pins the app's outbound destinations, which is the only property this release could
plausibly have broken.

**An audit pass on this build follows immediately.** If it finds anything, it ships again.

Below stands as written before the merge. **The two
audit passes on record examined a DIFFERENT release** — one that fetched from MedlinePlus at save
time. That build is gone. Their findings are kept below because they are the reason this one looks
the way it does, but neither of them is a sign-off on this code.

**Release:** every medication links to a lookup on MedlinePlus. No network request is made.
**Base:** app-v73 (`chemowell-app-v73-1`) · **This build:** app-v74 (`chemowell-app-v74-1`)
**Patch:** `harness-med-source-patch.py`, applied from the app-v73 base; refuses any other base.

## Why the feature shrank to a link

Aaron asked for the description to fill itself in from a website, with a source link. The first build
did that, and two audit passes went through it — one finding a real defect (a rename carried the
previous drug's sentence and citation), one finding four untrue statements in these documents.

**Both passes missed the thing that actually stopped it**, and so did I until I read this repo's own
rules. The app tells its users, in Welcome, Settings and About:

> *"no cloud, no accounts, no tracking, and the app never sends your information anywhere"*

A lookup sends the medication name. Nothing identifying, and MedlinePlus is a US government service
rather than an ad network — but a sequence of drug names from one address composes into *someone here
is having chemotherapy*, and it would have made that sentence untrue. APP_CLAUDE.md's hard rule says
it directly: no casual network write of user data, and the one exception ever granted was encrypted
sync, deliberately, with a lawyer's review attached.

**This should have been raised before the feature was built.** It was raised before it shipped, which
is the only part of that sentence worth anything.

## What ships

* **No outbound request of any kind.** The app is exactly as connected as it was yesterday.
* **A link**, built from the medication's name at render time. Nothing stored, nothing appended, no
  migration. Nothing leaves the phone until the caregiver taps it, and `rel="noopener noreferrer"`
  means MedlinePlus is not told which app she came from.
* **It never claims to be a source.** *"Look it up on MedlinePlus"*, pointing at a search — because
  the description above it was written in this repo.

## What is deliberately exempt

* **The descriptions still come from the built-in table**, unchanged. The baked-in database is the
  next piece of work, not this one.
* **iPhone rendering** — this sandbox has Chromium only.
* **care-tracker is untouched**, per Aaron's instruction to get ChemoWell right first.
* **Four Capacitor libraries load from a CDN on every app open.** Pre-existing, unchanged by this
  release, and carrying no patient data — but they do reveal the device's IP to that CDN. Found by
  writing this release's privacy check as *"not one request"* and watching it fail on a correct
  build. Written down rather than hidden; the check now pins the destination list at exactly those
  four, so a fifth would fail it.

## The gate

`test/v74-med-lookup.mjs` **23/23**. Its first section records every request leaving the machine
through loading, rendering, saving and editing, and requires that **not one carries a medication name
or anything else of hers**.


## THE AUDIT ON THE SHIPPED BUILD FOUND TWO THINGS, BOTH ON SCREEN, BOTH NOW FIXED

It ran against live code, as asked, and did not soften the findings because the code was already out.

**1. A one-tap path that sends the medication name, and a whole class of users told nothing about
it.** The note mentioning MedlinePlus was gated on at least one medication having a built-in
description; the link is gated on nothing but a name. Measured: two medications the table does not
know gave **two lookup links and no note at all**. The code's own comment above that gate says *"no
medication is recognised is a common state, not an edge case"* — the reasoning was applied to the
descriptions and not to the link put underneath them. Meanwhile About and two FAQ answers still
said, flatly, *"nothing is ever sent anywhere"*.

**This is the same datum the fetch was deleted over.** A link she taps without being told where it
goes is a quieter version of the same problem. The note is now gated on there being medications at
all, it says plainly that tapping opens MedlinePlus and that the site will see which medication she
looked up, and all three unqualified promises name the exception. Every one of them was true of the
app and incomplete about the link — that distinction is the whole fix.

**2. At 320px the link rendered as two separate-looking underlined links 44px apart.** The touch
target was built with `lineHeight: '44px'` on an `inline-block`, and line-height applies per line, so
the wrap produced h=88. `inline-flex` with `minHeight` keeps one target whatever the text does.
Measured 44px at 320, 360 and 390.

**What the audit could not break:** reproducibility is exact — the patch applied to the app-v73 base
produces an `index.html` byte-identical to live, which proves "no outbound request" by construction
rather than by suite. Twenty-two hostile medication names (quotes, `<script>`, newlines, RTL
override, `javascript:`, `//evil.example.com`, 500 characters) all produced `https:` URLs on
`medlineplus.gov` with no injection. The records were accurate on every mechanical claim — the
untrue-notes failure did not repeat.

`test/v74-med-lookup.mjs` **31/31**, with both blockers falsified: re-gating the note, reverting the
touch target and removing the tapping sentence each turn exactly one check red.

AUDITED-COMMIT after the fix: 0ebec5106cc8f624d526befe1f9747519920f7d1
