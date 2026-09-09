# Zero Day Audit — ChemoWell app-v72, sixth pass (delta 5)

AUDITED-COMMIT: 543cb5f63de381d59c46ce04571be9934891e9b9
VERDICT: DO NOT SHIP

`git rev-parse HEAD` at start and at finish: `543cb5f63de381d59c46ce04571be9934891e9b9`, clean tree.
Nothing moved under me. Suite on HEAD: **39/39 green**, exit 0. `./release_check.sh` fails only on
the four standing refusals from passes 1–5.

# HEADLINE, IN PLAIN WORDS

**Paste a long pharmacy name into a medication's NAME box and the Home screen breaks — and the row
of tabs along the bottom of the app stretches off the side of the screen with it, so the "Meds" tab
you would use to go back and fix the name is no longer where your thumb is.** Measured on this exact
build, at a 320px phone width: the page becomes **1019 pixels wide**. The same thing happens with a
long dose label (880px).

**The release's own new check says this cannot happen.** Its section is titled *"nothing a caregiver
pastes scrolls the page sideways"*, it has five cases, and all five are green — because **every one
of them only ever looks at the Meds screen.** Not one of them goes to Home. The wrapping rule that
this round put on the medication card fixed the Meds screen for all four fields and left Home
exactly as broken as app-v71.

That is the sixth time running that a check in this release printed green while the thing it names
was broken, and it is the same shape as the block pass 5 raised: a container the rule does not reach,
and a set of cases that all happen to miss it.

# BLOCKING

## B1 — A pasted medication name or dose label scrolls Home sideways to 1019px, and pushes the tab bar off-screen

Measured with Chromium at the viewport this suite itself sets, reading
`document.documentElement.scrollWidth` — never `window.innerWidth`, which pass 4 showed stretches
with the thing being measured. Firebase stubbed, all other network aborted, real Firestore never
touched.

| pasted into | app-v71 base, Meds | app-v71 base, Home | **app-v72 HEAD, Meds** | **app-v72 HEAD, Home** |
|---|---|---|---|---|
| medication name | 1022px | 1019px | **320px (fixed)** | **1019px (unchanged)** |
| dose labels | 668px | 880px | **320px (fixed)** | **880px (unchanged)** |

The overflowing element, read straight off the page: a `DIV` **991px wide**, right edge at 1019px,
`overflow-wrap: normal`, containing the medication name — the Home quick-log card's title. It sits
outside the `article` the release put `overflowWrap: 'anywhere'` on, because Home draws its own cards
(`renderHome`'s `medCards`, index.html ~line 5079), not the Meds card at ~line 6296.

**Why this is worse than a cosmetic overflow.** With the document 1019px wide, the bottom navigation
measures 1019px too, and its five buttons spread across it: at scroll position zero, "Meds" starts at
x=435 and "Reports" at x=580 — both past the right edge of a 320px screen. The medication editor is
reached from the Meds tab. So the one paste that causes this also moves the route to the only screen
where it can be undone. A caregiver who pastes a pharmacy label into the name box at 2am has to
discover horizontal scrolling to get out of it.

**It is not a regression — app-v71 is identical on Home — and that is not a defence.** Pass 5 blocked
this release on the note field, which was equally pre-existing, on exactly this reasoning: the
release claims to have closed the class *"free text a caregiver pastes pushes the page sideways"*,
and a member of the class is still open. Rule 5.5 is explicit that a case is written for the class,
not for the one instance reported. The name field is the most likely paste target of all of them — a
pharmacy name is a name.

**What clears it.** Either put the same one property on Home's quick-log card containers, or, if the
builder decides Home is deliberately out of scope for this release, say so in the README row, in the
suite's section header and in the PM sign-off in those words — and then the section header must stop
claiming *"nothing a caregiver pastes scrolls the page sideways"*, because that sentence is not true
of this build. **Whichever is chosen, the check has to visit Home**, or the next pass finds the same
hole with a different field.

## B2 — The brand-new count check, the one added to close pass 5's hole, is still blind to a value split across two lines

The check is named *"the suite can read EVERY entry in the table"* and asserts parsed count against
`entryLines`. I falsified it five ways against the shipped file. Four are correctly caught. One is not.

    parsed / entryLines / fever guard
    0. HEAD as shipped                          42 / 42   GREEN   GREEN
    M1 double-quoted KEY + a fever claim        41 / 42   RED     (caught)
    M2 two entries on one physical line         43 / 42   RED     (caught)
    M4 value as a template literal              41 / 42   RED     (caught)
    M5 FEVERY killed by a doubled backslash        --     liveness RED (caught)
    M3 value split with `+` across two lines    42 / 42   GREEN   GREEN   <-- HOLE

M3, written into the table exactly as a person would wrap a long sentence:

        'senna': 'A laxative for constipation. ' +
          'Brings down a fever.',

The value parser stops at the first closing quote and reads only the first fragment. The line counter
does not count the continuation line, because it has no `key:` on it. **Both numbers agree at 42, the
whole board stays green, and the app renders "A laxative for constipation. Brings down a fever."
under that medication on the patient's Meds screen.** This is pass 5's finding with a different
trigger: a way of writing an entry that the parser silently truncates while the check written to
detect exactly that reports agreement.

**Why this is not theoretical here.** The README and the PM both say a later refresh to **exact
federal label wording** is planned as a data change into this same table. Federal label sentences are
long, long sentences get wrapped, and federal wording says *"reduces fever"* — the single claim the
README names as this release's safety decision. The hole sits on the path the release says it is
guarding. The fix is one assertion (for instance: reject the table outright if the region between the
braces contains a `+` or a backtick, or assert that the parsed values account for every quoted string
in it), in three repos.

## B3 — The PM sign-off still carries the stale numbers pass 5 blocked on, above its own "clear to ship"

`outputs/PM_app-v72.md` line 199, immediately above **"PM verdict: clear to ship"**:

    Suite 34/34. Falsified this round on five mutants per app across all three apps -- fifteen in
    total ...

The shipped suite is **39/39** (I ran it). The README row for the same release says **39/39** and
**21 mutants**. Pass 5 blocked on this precise sentence. It was not rewritten — a "Round 5" section
was appended *below* it, so the document's headline count and its verdict line still describe a build
that no longer exists, and the two shipped records now disagree with each other about the same
release. A reader reaching the verdict never reaches the correction.

# WHAT I TRIED TO REOPEN AND COULD NOT

* **The parser and the four guards.** Both quote styles read. The lowercase-key check is real. All
  four guards use named constants (`FORMY`, `SCHEDULEY`, `FEVERY`, `NUMBERY`), each liveness check
  uses the same constant rather than a retyped copy, none carries a `g` flag, none is reassigned. I
  killed `FEVERY` with the doubled backslash that sat green for weeks in the beta: the liveness check
  goes red. That cure holds.
* **The five overflow cases genuinely fail when they should** — I confirmed the Meds-screen numbers
  independently on the v71 base (1022 / 668 / 668) and on HEAD (320 across the board). The ruler is
  the literal 320 the test passes in, never read back out of the page. Each case resets its own field
  and asserts its own field-set, so a silent reset failure cannot carry a mangled card into a later
  case. The final reload check really does prove the typed line persists (313 chars, byte-compared).
  The defect in B1 is not that these cases are weak; it is that all five stand on one screen.
* **Placeholder semantics.** Unset stays unset; the built-in sentence is the `placeholder`, never the
  `value`; typing overrides; clearing returns to the built-in rather than doing nothing; an untouched
  save stores nothing, asserted from `localStorage` and not from the screen. No wording is frozen into
  stored config, so nothing wrong gets published by medsync. The release adds no delete and no
  correction path and cannot lose or freeze a record.
* **The `h()` / prototype trap.** `medPurposeKey()` normalises, and `Object.prototype.hasOwnProperty
  .call` gates the lookup, with a `typeof v === 'string'` belt after it. Covered on the name, the
  generic name and the editor. A medication named `Constructor` written straight into storage renders
  as an ordinary card, no line, no page error, all four rows still editable.
* **Saving does not write over a field it did not display.** The editor seeder carries `purpose`
  through, and an untouched save round-trips it unchanged.
* **The VOICE pass on the app's own strings.** The disclaimer — *"Where a medication has a line under
  it, that is general information, not medical advice. Your care team is the answer for anything
  specific."* — is true in every state the screen can reach, renders only when at least one line is
  actually present, and reads plainly. The field label *"What it's for"*, the placeholder behaviour
  and the empty states are clean. No dose, no schedule, no advice, no fever-suppression guidance, US
  idiom throughout, and lidocaine reads *"Numbs the area where it is used."* **The untrue
  caregiver-facing text in this release is not in the app — it is in the records (B3) and in the
  suite's own section header (B1).**

# NON-BLOCKING, WRITTEN DOWN

* The two deliberate exemptions (`oral`, `dissolve`) are now stated in the suite, in the README and in
  the PM, with the cost named. That is the right treatment and it closes pass 5's complaint. The two
  regressions it flagged — sentences the v71 list rejected and this one accepts — remain accepted
  cost, correctly.
* Still through the list: *"Place it between the cheek and gum."*, *"Melts in the mouth."*,
  *"Placed in the rectum."*, *"Given through a port."* The guard polices only the 42 built-in
  sentences, never what a caregiver types, so these are editorial rather than live.
* Still wrongly rejected: *"Makes it easier to swallow."* and *"Reduces post-nasal drip."*
* A key written with an escaped apostrophe (`'it\'s': '...'`) parses to the wrong key while the value
  is still guarded and the counts still agree. Harmless today; worth one more character class if B2
  is being touched anyway.
* The PM sign-off's `AUDITED-COMMIT` is `2345058`, one behind HEAD. That is unavoidable for a file
  stamped by the commit that contains it, and 543cb5f changes nothing but that line. Not a finding.
* The table still has no Neulasta, metoclopramide or promethazine. Correctly queued for its own
  release with its own read; adding entries after an audit is how the Tylenol Liquid block happened.

# HOW TO CLEAR THIS

B1 is one CSS property on Home's quick-log card (or an explicit, written-down exemption), plus at
least one overflow case that navigates to Home — otherwise the check keeps vouching for a screen it
never opens. B2 is one assertion in three repos. B3 is two numbers in one paragraph. **The feature
itself still has not needed a rebuild since pass 1.** Sixth pass, sixth block, and all six have been
in the checks and the records rather than in the thing being shipped — which is now the most reliable
finding on this release and belongs in the README row in those words.
