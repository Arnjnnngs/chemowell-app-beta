AUDITED-COMMIT: 1b0cd4461b1b20124b7059056a2d798289d6f619
VERDICT: DO NOT SHIP

# Zero Day Audit — app-v81, round 2 (delta: `9000670`, `1b0cd44`)

## The headline, in plain words

**The guard I blocked on in round 1 is genuinely fixed. I am blocking on something else, and it is
in the box this release is about: if the caregiver types the medication's name and then goes
straight to "What it's for" and starts typing, the app throws her out of that box after a few
letters and the rest of what she types goes nowhere.**

I measured it three times on the shipping build. Type "Methotrexate", tap "What it's for", type
"my own words" — the box ends up holding *"my own wor"*, the cursor is gone, and the last letters
landed on nothing. On app-v80, the build that is live now, the same typing keeps all twelve
characters. **This is new in this release**, and it is the exact failure the release's own test file
warns about in its opening lines: *"a hint that appears at the cost of eating keystrokes would be a
worse app than the one with no hint."*

**Why it happens, and the fix is one line.** The name field now rebuilds the screen 450 ms after the
last keystroke — that is what makes the hint appear, and it is right. `render()` can only put the
cursor back in a field it can find again **by id**. The name and generic-name fields were given ids
for exactly that reason. **"What it's for" has no id**, so when that delayed rebuild lands while she
has already moved into it, the box she is typing in is destroyed and not restored. I added
`id: 'med-purpose'` to that one field, re-ran the same test twice: all twelve characters land and the
cursor stays. Then I put the file back byte-for-byte.

Everything else in the delta holds up. The schedule guard is now genuinely stricter than what is
live, measured both ways rather than asserted. The hint is readable in full at 320 px with the
longest description in the table and a long pasted name at the same time. The three drug mechanisms
are corrected and no other entry is now in the wrong group.

---

## 1. The schedule guard — the round-1 block is properly closed

Measured on the shipping build by putting fake entries into the real table and running the real
suite, then restoring the file.

| Sentence I put in the table | Result |
|---|---|
| "Given prior to chemotherapy to prevent sickness." | **REJECTED** (round 1: passed) |
| "Taken throughout chemotherapy." | **REJECTED** (round 1: passed) |
| "Given on the day of chemotherapy." | **REJECTED** (round 1: passed) |
| "Given during chemo." | **REJECTED** — and the app-v80 pattern **admits** it |
| "A chemo medicine that helps." | **REJECTED** — and the app-v80 pattern **admits** it |

I ran the live app-v80 pattern against those last two myself rather than taking the claim: it lets
both through. **So "stricter than the original guard" is true**, and it is true in the only sense
that matters — the set of sentences the new check refuses is everything the old one refused, plus
every other way of writing "chemo", minus six sentences a person has read and approved.

**Is `.trim()` enough normalisation?** Yes, and it errs on the strict side, which is the right
direction. Measured:

- lower-case first letter — rejected
- a doubled space inside an approved sentence — rejected
- a non-breaking space inside — rejected
- a trailing ordinary space, and a trailing non-breaking space — **admitted** (JavaScript's `trim`
  removes both). Harmless: the sentence itself is character-for-character the approved one.

Every near-miss therefore goes to a human, which is the point of an allow-list. The six approved
sentences are exactly the six distinct chemo sentences in the table — no dead entries on the list,
nothing in the table missing from it.

**The residual hole, and it is not a regression.** The allow-list only governs sentences containing
"chemo". A schedule written without that word still walks through. Six I invented, all green on a
full board:

> "Given the night before each treatment." · "Taken two hours before treatment." ·
> "Start it the morning of treatment." · "Keep taking it until the sickness stops." ·
> "Given after radiation." · "Given before your treatment session."

All six pass the app-v80 guard too, so this release makes nothing worse — but the timing net is
still a blacklist for everything that does not say "chemo", and the comment above it should say so
plainly rather than leaving the next editor to infer that inverting it covered schedules generally.
**Recommended (S).**

**The cost of the new words, said out loud.** `following` and `throughout` now reject true, useful
descriptions: *"Eases pain following surgery."* and *"Protects the stomach throughout treatment."*
both go red. That fails safe — a person has to look — but it will bite a real entry one day and
should be written down as deliberate.

The other guards still bite: the digit guard, the fever guard, the dosage-form/route guard and the
parsed-count-versus-entry-line check were all green on the real table and all four liveness lines
("can this guard actually fire") passed.

## 2. The hint on its own line

**Readable, at every width.** 320 / 360 / 390 px, with the longest description in the table
(methotrexate, 91 characters) **and** a 44-character pasted brand name in the name field at the same
time: the whole sentence wraps, nothing is cut off horizontally or vertically, the hint's right edge
stays inside the screen (287 px at a 320 px screen) and the page never scrolls sideways. Screenshots
in `outputs/v81-audit-r2-shots/`. **Chromium only — an iPhone's rendering cannot be reproduced in
this sandbox, and that stays exempt.**

**The typing fix still holds with the extra element.** `test/v81-purpose-hint.mjs` is **23/23**,
including the two cases the brief named — a correction typed into the middle of a word lands where
the cursor was, and a name typed across the 450 ms boundary arrives whole with the cursor still in
the field. Nothing regressed there.

**But the condition is only half true, and it is the same root cause as the block.** Typing in
"What it's for" changes the stored value without redrawing anything, so:

- She types her own words → **the hint stays on the screen underneath them**, still reading *"The app
  knows this one: … Leave the box empty to use it, or type your own."* Measured: box holds
  "my own words", hint still showing.
- She clears the box again → the hint does **not** come back until something else redraws the screen.

Nothing is lost and nothing is wrong on screen after the next redraw — but "shown only when she has
typed nothing" is not what the app does. The clean fix is the same one as the block: give the field
an id **and** let it redraw debounced, exactly like the name field. **Recommended (S), and it should
ship with the blocker's fix since it is the same line of code.**

## 3. The repointed check — and a third mutant that survives it

The move from "the sentence must BE the placeholder" to "shown on the field, and not in the box" is
right: it pins the guarantee (*shown, never seeded*) instead of the attribute it happened to live in.

**A mutant survives it.** I left the hint in the DOM and made it invisible — `opacity: 0` and
`position: absolute; left: -9999px`. **`v72-med-purpose` stayed 65/65 and `v81-purpose-hint` stayed
23/23**, including the check that says the hint is "on the screen at 320px" and the one that says
"none of it is cut off". `innerText` counts text that is rendered but pushed off-screen or made
transparent, and `scrollWidth`/`clientWidth` are happy with an element nobody can see. So the pair
proves the sentence is *in the page*, not that a caregiver can read it.

Not a blocker — the shipping build renders it visibly and I have the screenshots — but it is this
repo's own "a check that prints a false sentence in green" class. **Recommended (S): assert the
hint's bounding box is inside the viewport, has a non-zero height, and that computed `opacity` and
`visibility` are not hiding it.** That kills this mutant and the clipping claim becomes real.

Two further notes on the suites, both small:
- `v72-med-purpose` section 5 sets the purpose by assigning `input.value` and firing an `input`
  event. That path can never see a dropped keystroke — which is why the defect above was invisible
  to a green board. A typed case belongs next to it.
- No suite asserts what happens when the caregiver moves from one field to the next inside the
  450 ms window. That is the whole of finding 0, and it is the class, not the instance:
  **`gapH`, `intervalN`, `intervalAnchor` and the note field have no id either.**

## 4. The three drug mechanisms

Correct, and nothing else is now mis-sorted. Etoposide and irinotecan are topoisomerase inhibitors
and doxorubicin/adriamycin an anthracycline — all three damage DNA, which is now what they say, and
they sit with the platinums and cyclophosphamide. What is left under *"stops cancer cells from
dividing"* is paclitaxel, taxol, docetaxel, taxotere, vincristine and vinorelbine — taxanes and
vincas, which is exactly right. Gemcitabine ("copying their DNA"), fluorouracil/capecitabine
("blocks a chemical"), pemetrexed ("blocks vitamins") and aprepitant ("helps prevent the nausea and
vomiting that chemotherapy can cause") are all in the right group. Methotrexate is still the one
chemotherapy agent not labelled as one — deliberate, as in round 1.

## 5. Voice — every caregiver-facing string the delta touched

| String | Verdict |
|---|---|
| *"The app knows this one: …"* | True and plain. Reads at 2am. |
| *"Leave the box empty to use it, or type your own."* | **True, and I checked it rather than assuming.** An untouched save stores nothing at all, and the Meds row then shows the built-in line. Clearing a typed line gives the built-in one back. |
| *"A chemotherapy medicine that damages the DNA of cancer cells."* ×3 | True of all three drugs. No diagnosis, no stage, no dose, no schedule, no pronoun. |

Rule 0, all four shapes, on the strings this delta adds: no name, no gendered pronoun, no dose or
ceiling from one care plan, no behaviour keyed to a medication id. `v75-no-other-patient` is
**27/27**.

## 6. The release notes

Checked against the code and the suites, one claim at a time:

| Claim in the README row | Verdict |
|---|---|
| `MED_PURPOSE` 66 → 184 | **True.** Parsed both builds: 66 at app-v80, 184 now. |
| `v72-med-purpose` **65/65** | **True.** Ran it. |
| `v81-purpose-hint` **23/23** | **True.** Ran it. |
| "52 of the 68" descriptions clipped as a placeholder | **True** — 68 is the number of distinct sentences in the table, and 52 was my own round-1 measurement. |
| "rejects two sentences the ORIGINAL guard let through" | **True.** Measured in both directions. |
| "the guard is now INVERTED … a new wording fails until a person adds it deliberately" | **True.** |
| "proven unclipped at 320px by the DOM's own `scrollWidth`/`scrollHeight`" | **True but weak** — see the surviving mutant in section 3. |
| `APP_VERSION` → `app-v81`, `sw.js` CACHE → `chemowell-app-v81-1` | **True.** Both present, moved together. |
| **`test/v81-purpose-hint.mjs` 18/18** | **FALSE.** The suite has 23 checks and the same README row says **23/23** thirty lines later. The 18/18 is a leftover from the first draft and it contradicts itself in the one place Aaron reads. **Required correction.** |

## What has to happen before this ships

1. **Required (blocker) —** give the "What it's for" field a stable id so a delayed rebuild cannot
   eat what she is typing. `id: 'med-purpose'` is enough; I proved it. Do the same for the note field
   and the other id-less editor inputs, and add a typed case that moves between two fields inside the
   450 ms window — the class, not the instance.
2. **Required —** delete the stale **18/18** from the README row; the suite is 23/23.
3. **Recommended (S) —** let the purpose field redraw debounced too, so the hint really does go away
   while she types her own words and come back when she clears them, as the copy says.
4. **Recommended (S) —** make the hint checks assert geometry and computed visibility, not just
   `innerText`; an invisible, off-screen hint currently keeps both suites fully green.
5. **Recommended (S) —** say in the guard's comment that the allow-list only governs sentences
   naming chemo, and that a schedule written without that word still passes; note that `following`
   and `throughout` will reject some true descriptions.

## Suites and mutations

- `test/v81-purpose-hint.mjs` **23/23** · `test/v72-med-purpose.mjs` **65/65** ·
  `test/v75-no-other-patient.mjs` **27/27**.
- Known-red and not this release's: `audit-v55` (3), `pm-v55` (1 @360), `pm-v55b` (2 @360),
  `v57-browser-notice` (17), `v74-shipped-audit-probe` (3), `audit-v55b` cannot start. Nothing in
  this delta touches any of them; the three suites it does touch are green.
- **Four mutations, every one restored.** 18 probe entries injected into `MED_PURPOSE`; the
  `id: 'med-purpose'` fix; the invisible-hint mutant; and the app-v80 build served from a scratch
  directory for comparison (never inside the repo). `index.html` md5 is `9a2af2f73577a6db2ce0ae93c0a865ef`
  before and after, identical to `1b0cd44`; no test file was edited at all. `git status --short`
  shows only this report and `outputs/v81-audit-r2-shots/`.
