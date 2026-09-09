# Zero Day Audit — ChemoWell app-v72, ninth pass (delta 8)

AUDITED-COMMIT: e7638d0185920f74736e3821e67736351bcbfaab
VERDICT: SHIP

`git rev-parse HEAD` at start and at finish: `e7638d0185920f74736e3821e67736351bcbfaab`, clean tree
apart from this report. Nothing moved under me. Chromium only — an iPhone's rendering cannot be
reproduced in this sandbox, and that is exempt here as on every release in this repo. No test of mine
touched real Firestore: every request off 127.0.0.1 was aborted and the CDN scripts stubbed. Zero
page errors in every build and every state I visited.

# HEADLINE, IN PLAIN WORDS

**The three things the last pass refused on are genuinely fixed, and I proved it the only way that
counts: I broke the app on purpose and watched the check go red.**

Take the one line out of the app that holds the Home screen together, and Home blows out to 900
pixels on a 320-pixel phone with four of the five bottom tabs pushed off the side. On that broken
build the suite now says **FAIL — page=900px** and **FAIL — 1 of 5 tabs reachable**, and stops at
42 of 44. Three passes running, that same broken build printed a full green board. It does not any
more.

On the real build Home measures **exactly the width of the phone** at 320, 360, 390 and 428, all five
tabs are reachable, and the pasted 73-character pharmacy name is really on the screen being measured.
app-v71, the version live today, measures **900px at every one of those widths with 1 of 5 tabs
inside the phone**. That is the fix, and it is real.

The written record is now true as well. I checked its claims one at a time against the shipped file
and against the app-v71 baseline, including the one about the other tests' failures being
pre-existing, which the last pass had to leave unverified. It holds.

**I could not substantiate a refusal. Ship it.**

# WHAT I RE-OPENED, AND WHAT I FOUND

## Pass 8's Block 1 — the Home guard that could not fail: CLOSED

The case now forces every seeded medication onto Home and refuses to believe a measurement unless the
pasted name is actually rendered there. Measured:

| build | suite | Home at 320px | tabs on screen |
|---|---|---|---|
| HEAD (`e7638d0`) | **44/44**, exit 0 | 320px | 5 of 5 |
| HEAD minus the quick-log grid declaration | **42/44**, exit 1 | 900px | 1 of 5 |
| HEAD minus all three declarations | **37/44**, exit 1 | 900px | 1 of 5 |
| app-v71 (`4e5b91f`) | — | 900px | 1 of 5 |

The middle row is the exact build passes 6 and 8 blocked. It is red now, on both Home lines, with the
true number printed beside it. My own probe — a separate script, seeding a medication that really has
a Home card, measuring `documentElement.scrollWidth` against the width the probe itself set — agrees
with the suite in every cell above.

## Pass 8's Block 2 — the ruler that stretched: CLOSED

The tab check measures against `VW`, the width the test sets, not `window.innerWidth`. I confirmed the
trap is real and not theoretical: on the broken build at a 320px viewport this emulator reports
`innerWidth` as **900**. Against `VW` the check counts **1 of 5** tabs and goes red; against
`innerWidth` it would have counted 5 of 5 and stayed green. `nav button` selects exactly the five
bottom tabs in this app (one `nav` element, five buttons, confirmed at all four widths).

## Pass 8's Block 3 — the record describing the wrong app: CLOSED

Checked claim by claim against the shipped file:

* `flex: 0 0 auto` — **0 occurrences** in this build and **0** in app-v71, exactly as the corrected
  paragraph now says.
* The corrected text says the scoped `overflow-wrap` **is** the fix here and that removing the
  quick-log grid declaration returns Home to 900px. **I measured 900px.** True.
* The old false sentences are quoted and marked false rather than deleted, so the next reader sees
  what was wrong and why. That is the right shape for this record.
* `APP_VERSION = 'app-v72'` and `sw.js` `CACHE = 'chemowell-app-v72-1'` move together.

## The claim the last pass could not finish: VERIFIED for the one I could measure

The record says `run-all-tests.sh`'s failures are pre-existing, and names `pm-v55` at 20 pass / 1 fail
@360px on both builds. I reproduced that comparison from scratch — serving app-v71's `index.html`,
then this build's, to the same harness on the same port with the same assets:

      app-v71:      20 pass, 1 fail @360px   FAIL  P3c every row opened  |  135 rows
      this build:   20 pass, 1 fail @360px   FAIL  P3c every row opened  |  135 rows

Identical, same failing check, same detail line. `pm-v55` and `pm-v55b` do take a width as `argv[2]`
and have no `--file`, as the record says. I did not re-measure `audit-v55`, `v57-browser-notice` or
`audit-v55b` inside my window; the one I checked was accurate, which is the evidence I have.

# NOT BLOCKING — but write these down, because both are the same lesson this release is about

## N1 — the third wrapping declaration is load-bearing, and NOTHING guards it

Removing the declaration on the grouped-medications card (`renderGroupedMedsCard`) leaves the suite at
**44/44 green**. The fixture never renders a grouped card — its medications are `type: 'gap'` with no
`groupedMorning/Afternoon/Evening` flag — so no check in this repo has ever looked at that screen.

It is not a decorative line. I seeded a grouped evening card with the same 73-character name and
measured the name element itself:

      with the declaration:     scrollWidth 175 in a 175px box, wraps to 128px tall — fully readable
      without it:               scrollWidth 872 in a 175px box, one line 21px tall — about 80% of the
                                name is invisible, and the card has overflow:hidden so it cannot be
                                reached by scrolling

The page width is **320px in both cases**, which is precisely why every width check on the board stays
green. This is pass 7's finding wearing different clothes: *the damage is vertical and every automated
check here measures width.* The app is RIGHT — shipping this is strictly better than app-v71, where
the same name is clipped. What is missing is a case, and it is a fixture change, not a code change:
seed one grouped medication and assert the name's `scrollWidth` fits its box.

## N2 — `onHome` proves the name is on SOME screen, not that the screen is Home

The new assertion reads `root.innerText` for the pasted name. On the Meds screen that name is also
present, so the pair (clicked Home, name visible) does not by itself prove which screen was measured.
I built the mutant that exploits it — the Home tab's click made a no-op, on top of the broken Home —
and both Home lines printed **PASS at page=320px** on a build whose Home is 900px.

Two things keep this off the blocking list. The suite still failed overall on that build (43/44), red
on *"the Home quick-log cards carry NO purpose text | 2 found on Home"* — an unrelated check that
noticed it was on the wrong screen. And the mutant requires a second, independent defect: navigation
silently doing nothing while the button still exists. The regression this guard actually exists to
catch — someone deleting the wrapping line — turns it red, which is the thing three passes could not
say.

The hardening is one clause: also require a Home-only marker (the `data-tour="quick-log"` element, or
`aria-current="page"` on the Home tab) before believing the measurement.

# THE VOICE

Nothing caregiver-facing changed since the build pass 8 examined: the diff `ab576bc..e7638d0` touches
`test/`, `README.md` and `outputs/` only. I re-read the strings this release introduces anyway — the
42 purpose lines, the editor's *"What it's for"* field, its placeholder *"For example: settles
nausea"*, and the disclaimer *"Where a medication has a line under it, that is general information,
not medical advice. Your care team is the answer for anything specific."* Every one is true, plain at
2am, American, and free of a dose, a schedule, a route or a dosage form. There is no computed figure
anywhere in this feature, so question 3 has nothing to bite on. The disclaimer renders only when at
least one line exists, which is what it claims.

# THE RECORD, AND WHAT COULD LOSE IT

Nothing in this diff touches the save path beyond adding one optional field. The purpose is a
placeholder, never a seeded value, so "deliberately blank" and "never set" stay distinct and no
wording is frozen into stored config. The `hasOwnProperty` guard on the lookup still stands and the
`Constructor` case is green. No `removeEntryDB`-shaped call appears anywhere in the diff. Across five
builds and every state I visited, **zero page errors**.

# WHAT I DID NOT COVER

Safari/WebKit (Chromium-only sandbox — standing exemption, stated). The beta and care-tracker ports.
Firestore and medsync round trips. `audit-v55`, `v57-browser-notice` and `audit-v55b` baselines.
`test/overflow-scan.mjs` did finish, late and all at once — it buffers its output to the end, which
looked for several minutes exactly like a hung job: **170 of 170 screen/width combinations, 0
overflowing elements, CLEAN, exit 0**, confirming the PM's figure. It is worth remembering what that
tool can and cannot see: it scans the app's own text, not a string a caregiver pasted, and it measures
width, so N1 above is invisible to it by construction. That is pass 7's second lesson — a tool's
silence is only evidence about the question that tool asks — and it is why my own measurement stands
beside it rather than being replaced by it.

`./release_check.sh` refuses today on seven standing DO-NOT-SHIP reports from passes 1–8, the latest
of which examined `ab576bc`. This report examines `e7638d0`, a later commit, and says SHIP, which is
how that gate is cleared on its own terms.
