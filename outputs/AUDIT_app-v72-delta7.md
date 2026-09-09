# Zero Day Audit — ChemoWell app-v72, eighth pass (delta 7)

AUDITED-COMMIT: ab576bceb6f4a7d2f2b582d9f78039267e67d8b0
VERDICT: DO NOT SHIP

`git rev-parse HEAD` at start and at finish: `ab576bceb6f4a7d2f2b582d9f78039267e67d8b0`, clean tree.
Nothing moved under me. Suite on HEAD: **43/43**, exit 0. No test touched real Firestore: every
request off 127.0.0.1 was aborted and the CDN scripts stubbed. Chromium only — iPhone rendering is
exempt here as on every release in this repo, and stated as exempt.

# HEADLINE, IN PLAIN WORDS

**The app itself is right this time. The check that is supposed to prove it is still wrong, and I
proved that by breaking the app and watching the check stay green.**

The wrapping fix works. I measured it independently, at four phone widths, with a long unbroken
pharmacy name pasted into the medication name, the generic name, the note and a dose label, on Home,
Meds, Reports, In-Patient and Symptoms — **120 measurements per build, on five builds.** On app-v71
the page ran off the side in 32 of those states, up to **903 pixels wide on a 320-pixel phone.** On
this build **not one of the 120 states overflows**: Home and Meds measure exactly 320, 360, 390 and
428. The two screens the last pass found broken — Home's hospital-stay banner and the In-Patient
heading — are back to **pixel-identical to app-v71** at every width, and so is the "Clear" button.
The scoped rules cost nothing anywhere else: with no long text on screen, this build and a build with
all three rules stripped out are **identical in all 120 states**.

**So what is left is the guard, and it is the ninth pass in a row where it is the guard.**

The suite's new Home case now clicks the right tab. But the medication it renames is **not on the
Home screen at all** — the fixture's medications are saved with no Home card, so the pasted name never
appears there. The case measures an empty Home. I removed the one line that fixes Home, rebuilt, and
confirmed by hand that Home then blows out to **900px at a 320px viewport**. The suite, on that same
broken build, prints:

    PASS  HOME does not scroll sideways at 320px with a pasted medication name  |  page=320px
    PASS  every bottom tab is still on the screen at 320px  |  5 of 5 tabs reachable, nav=320px
    43/43 checks passed

And the second of those two lines is untrue for a second, independent reason: **only 1 of the 5 tabs
is actually inside the phone.** The check asks whether each tab fits inside `window.innerWidth`, and
under this emulator `innerWidth` grows with the overflow — I measured it at **900** on a 320px
viewport. That is the identical stretching-ruler defect pass 4 found and this suite's own comment says
it fixed, reintroduced in the assertion written to close pass 7.

**The third thing: the README row and the PM sign-off describe a fix that is not in this app.** Both
say the medication name on the quick-log card "sits under `white-space: nowrap`" and the dose buttons
are "`flex: 0 0 auto` … Both fixed directly," and that the wrapping property "was never what fixed Home
anyway." None of that is true here. `flex: 0 0 auto` does not occur anywhere in this file, in this
build or in app-v71. The quick-log name is a plain div with no `nowrap`. The diff from app-v71 changes
nothing outside three `overflowWrap` declarations and the medication-purpose feature. And the property
**is** what fixes Home: delete that one declaration and Home returns to 900px.

# BLOCKING

## B1 — The new Home guard cannot fail, because the medication it renames is not on Home

`test/v72-med-purpose.mjs` seeds three medications with no `quickLog` field. `DEFAULT_QUICK_LOG_IDS`
is empty (index.html:1062), so `normalize` resolves `quickLog` to **false** (index.html:1119), and
saving the editor preserves that. Read back out of storage after the case's own save, printed from
inside a replica of its exact steps:

      stored quickLog: zofran:false, pantoprazole:false, madeupzz:false
      wentHome: true, quickLogLabel: "Quick log", bigNameOnScreen: FALSE, doc: 320px

The navigation now genuinely reaches Home — that part of the pass-7 fix is real — but the 73-character
name it just pasted is **nowhere on the screen being measured**. Home has no quick-log cards.

Falsified the only way that settles it. I built HEAD with a single declaration removed — the
`overflowWrap: 'anywhere'` on the Home quick-log grid at index.html:5261, nothing else — which is the
build pass 6 blocked. My own probe, seeding a medication that actually has a Home card, measures that
build at **doc = 900px, nav = 900px at a 320px viewport**. The suite on that build prints PASS on both
Home lines and **43/43**.

This is the third version of this check and the third time it has been green over a broken Home:
pass 6 it never left Meds, pass 7 it clicked a tab that does not exist, pass 8 it arrives at a screen
with nothing on it. The fix is small — seed `quickLog: true` on the fixture medication (or assert the
pasted name is present on Home before measuring) — and it must be watched going red on the mutant
above before it counts.

## B2 — "every bottom tab is still on the screen" is measured with a ruler that stretches

    onScreen: [...document.querySelectorAll('nav button')]
      .filter(b => b.getBoundingClientRect().right <= window.innerWidth + 1).length

Measured on the broken build at a 320px viewport, in one page evaluation:

      doc 900 · innerWidth 900 · nav 900 · tabs 5
      tabs within window.innerWidth: 5 of 5      <- what the check counts
      tabs within the 320px this test SET:  1 of 5   <- what a caregiver's phone shows

Four of the five tabs, **including Meds, the only route back to fix the pasted name**, are off the
side, and the check calls all five reachable. The suite already knows this trap: the comment above the
five Meds cases says the ruler "is now the width this test itself set, passed in from Node and never
read back out of the page." `VW` is in scope three lines above. It was not used.

## B3 — The README row and the PM sign-off state a mechanism and a fix that are not in this build

Round 7, Block 2 of `outputs/PM_app-v72.md`, repeated almost verbatim in the app-v72 README row,
quoted here indented so it is not mistaken for this report's own claim:

      the medication name on the quick-log card sits under white-space: nowrap, which disables
      wrapping outright and carried no truncation, so it simply grew; and the dose buttons are
      flex: 0 0 auto with the name inside them, so they refused to shrink and had no maximum
      width. Both are fixed directly, and Home measures 320px at a 320px viewport where it
      measured 829px.

Checked against the shipped file, four ways:

* `grep -c "0 0 auto"` → **0** in this build and **0** in app-v71. The dose buttons are already
  `flex: '0 1 auto', minWidth: '0', maxWidth: '100%', whiteSpace: 'normal'` and have been since before
  this release.
* The quick-log medication name (index.html:5205) is a plain `div` with `TYPE.title`. There is no
  `white-space: nowrap` on it, in either build.
* `git diff 4e5b91f ab576bc -- index.html` has eight hunks: three `overflowWrap` declarations and the
  medication-purpose feature. **Nothing was fixed directly.** No such change exists.
* The property was never *not* what fixed Home: removing only the grid declaration returns Home to
  **900px** at every width. The claim inverts cause and effect.

This is care-tracker's markup written into ChemoWell's record. The measured number is wrong too — I
measure app-v71's Home at **900px**, not 829. It matters beyond tidiness for one reason: the next
person to touch Home will read that the wrapping property is decorative and the real fix is elsewhere,
and delete the line that is holding the screen together. That is exactly how a fixed thing comes back.

The correction is a paragraph in two files, not a code change.

# NOT BLOCKING — verified sound, so nobody spends another pass on it

* **The wrapping fix, measured.** 120 states per build (6 content variants × 5 screens × 4 widths),
  `documentElement.scrollWidth` against the width this probe set, never `innerWidth`.

      app-v71:            32 of 120 states overflow, worst 903px on a 320px phone
      this build:          0 of 120
      grid rule removed:  16 of 120 (Home only)
      all 3 rules removed: 36 of 120 (Home and Meds)

* **The two screens pass 7 broke are exactly restored.** Home's hospital-stay banner, the In-Patient
  heading and Home's "Clear" button are **identical to app-v71** in width, height and line count at
  320/360/390/428. Zero differences.
* **The scoped rules break nothing of their own.** With no long text on screen, this build and a build
  with all three declarations removed are identical in all 120 states — same page width, same page
  height, same banner, same heading, same button. No app label wraps, nothing clips, no button grows.
  `Paused`, `Limit`, `Waiting`, `Not scheduled` and the dose chips carry `white-space: nowrap`, which
  suppresses the break opportunities `overflow-wrap` would otherwise offer, so they are untouched by
  construction as well as by measurement.
* **Zero page errors** across all five builds and every state visited.
* **The accounting check.** I could not get past it. Both patterns are built from one source string and
  `PAIR_RE` is run globally over the whole table body, so anything `ENTRY_LINE` accepts is parsed by
  construction — the pass-7 hole is genuinely closed rather than patched. A space before the colon, a
  double-quoted value, a continuation line, a template literal, two entries on one line, a computed
  key, an unquoted key and a spread are all rejected or read. Worth knowing, not blocking: a comment
  line that *quotes an example entry* (`// 'morphine': '…'`) is skipped by the accounting but still
  picked up by the global parser, so a well-meant example in a comment would go red as if it were a
  real entry.
* **The Voice.** Every caregiver-facing string the diff touched is true and plain: 42 purpose lines,
  the "What it's for" field, the placeholder, and the disclaimer. No dose, no schedule, no fever
  clause, no dosage form, no British idiom, and no computed figure of any kind — so question 3 has
  nothing to bite on. `allopurinol: "Lowers uric acid levels."` is the most clinical sentence in the
  table and is still readable at 2am. The disclaimer says "the line under each medication" and renders
  only when at least one line exists, which is what it claims.
* **The record, prototype trap and placeholder semantics** were re-confirmed sound by pass 7 on
  unchanged code and by the 43/43 suite here; nothing in this diff touches the save path, and no
  probe of mine produced a page error on a medication named `Constructor`.

# WHAT I DID NOT COVER

Safari/WebKit (Chromium only — standing exemption). The beta and care-tracker ports. Firestore and
medsync round trips. **And one thing the release asserts that I did not finish checking: the claim
that `run-all-tests.sh`'s four failures and one non-starter are pre-existing on app-v70 and app-v71.**
I started the harness and watched `audit-v55` fail on help-bot topic counts and `audit-v55b` fail to
start on a missing `/tmp/topics.js` — both plainly unrelated to a diff that touches only `MED_PURPOSE`,
three `overflowWrap` declarations and the medication editor — but I ran out of my 30 minutes before the
baseline comparison completed. Treat that claim as unverified by this pass rather than as confirmed.

`./release_check.sh` currently refuses on the six standing DO-NOT-SHIP reports from passes 1–7; this
report is a seventh, examining a later commit, so the gate stays red on its own terms until a pass
examining a commit later than this one says SHIP.
