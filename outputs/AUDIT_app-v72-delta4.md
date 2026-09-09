# Zero Day Audit — app-v72, fifth pass (delta 4)

AUDITED-COMMIT: 9258d04c58cfaab2dc28e5cd32185dc59f1967bf
VERDICT: DO NOT SHIP

**Headline, in plain words. The three things pass 4 blocked on are genuinely fixed — all four guards
are named constants and killing any one of them now turns its liveness check red, the 320px ruler is
the width the test set rather than a number the browser can stretch, and the word list no longer
rejects a sentence about the skin. I am refusing on two new things, and both are the same fault this
round has been chasing for four passes: a check that prints green while the thing it guards is
broken. (1) THE GUARDS ONLY SEE THE ENTRIES THE TEST'S OWN PARSER RECOGNISES, AND NOTHING CHECKS
THAT IT SEES THEM ALL. The suite pulls the table out of the file with a pattern that only matches a
single-quoted sentence. I added one entry written with double quotes — the natural thing to do the
moment a sentence contains an apostrophe — reading "Settles nausea, and brings down a fever. One
tablet under the tongue every 4 hours." The suite printed "42 entries" for a file that has 43, and
36/36 GREEN: the fever guard, the number guard, the form/route guard and the schedule guard all
passed over a line that breaks every one of them. Loaded in a browser, the app prints that sentence
under the medication on the patient's Meds screen. This app tracks Temperature and the release's own
headline safety decision is that no line may ever tell anyone to bring a fever down. No typo is
needed to open this hole — just an apostrophe. (2) THE WRAPPING FIX DOES NOT COVER THE NOTE, AND THE
COMMENT SHIPPED BESIDE IT SAYS IT DOES. On the shipped build at a 320px viewport, a portal link
pasted into the app-v71 note field makes the Meds page 347px wide, and a pasted pharmacy name in the
note or in a dose label makes it 668px. All three scroll sideways. The note and the dose summary are
rendered in a different container from the text column the rule was put on, and the four new cases do
not touch either field. Pass 4 said in writing that one of two things had to be true before this
ships — wrap the whole card, or say that only the new field is covered. Neither is true: the card is
not wrapped and the comment claims it is.**

Fifth pass, 2026-09-09. `git rev-parse HEAD` was `9258d04c58cfaab2dc28e5cd32185dc59f1967bf` when I
started and the same, with a clean tree, when I finished — nothing moved under me. The suite is
**36/36** at this commit. Every run with `env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u
http_proxy`; nothing reached the network, every probe stubbed the same three ways the harness does
and aborted all other requests. Chromium at `/opt/pw-browsers/chromium`. **No repo file was edited
except this one. Nothing was committed. Nothing was pushed.** Every mutant and probe is in the
scratchpad, outside the repo.

---

# B1 — the table parser silently drops entries, and the guards are green over what it dropped

The four guards all read `TABLE`, and `TABLE` is built in the harness by this:

    const tableMatch = rawHtml.match(/const MED_PURPOSE = \{([\s\S]*?)\n\};/);
    for (const m of tableMatch[1].matchAll(/'([a-z0-9 -]+)':\s*'((?:[^'\\]|\\.)*)'/g)) TABLE[m[1]] = m[2];

Reading the table out of the file rather than copying it is right. The problem is what the pattern
cannot see, and that nothing anywhere asserts it saw everything:

* a value written in **double quotes** — which is what any author does the moment the sentence
  contains an apostrophe, and this table is prose about medicines;
* a key with a **capital letter, an apostrophe or a period** (`'Tylenol PM'`, `'st john's wort'`).

Either one is skipped in silence, and the only check on the parse is
`t('the app carries a purpose table', ids.length > 0)`. **Zero is caught. Forty-two out of
forty-three is not.**

Measured. One entry added to a copy of the shipped file, nothing else changed:

        'promethazine': "Settles nausea, and brings down a fever. One tablet under the tongue every 4 hours."

That sentence names a fever, a form, a route, a schedule and a number — one line breaks all four
guards. The suite, run against that file:

    PASS  the app carries a purpose table  |  42 entries        <- the file has 43
    PASS  NO entry contains a number
    PASS  NO entry tells anyone a medication brings down a fever
    PASS  NO entry uses a word from the dosage-form / route list
    PASS  NO entry states a schedule or a dose in words either
    PASS  the form/route guard can actually fire
    PASS  the fever guard can actually fire
    36/36 checks passed

And the app is not confused at all — a medication named Promethazine, seeded and rendered in
Chromium off that same file:

    ON THE PATIENT'S MEDS SCREEN -> {"p1":"Settles nausea, and brings down a fever. One tablet under the tongue every 4 hours."}

This is the identical shape of the fault the liveness checks were built for, one layer further out.
The liveness checks now prove each PATTERN is alive; nothing proves the pattern is being shown the
whole table. **Fix, one line and version-agnostic:** count the entry lines inside the matched block
and assert the parsed count equals it, so a dropped entry turns this red instead of shrinking the
thing being guarded. Falsify it by adding a double-quoted entry and watching it go red. The same
parser is in `/home/user/care-tracker/harness/med-purpose-test.mjs` and
`/home/user/chemowell-beta/harness/med-purpose-test.mjs`, so it is a three-repo fix.

# B2 — the note and the dose labels still scroll the page sideways at 320px

The `overflowWrap: 'anywhere'` moved to the card's text column, and the comment above it says why:

        The name, the generic name and the note are free text too

The name and the generic name are in that column. **The note is not** — it is rendered further down
the card in a separate grid, and so is `medicationDoseSummary(med)`, which is built from dose labels
the caregiver types. Neither inherits the rule. Measured on the shipped `index.html` at a 320px
viewport, seeded and read in Chromium (`document.documentElement.scrollWidth`):

    SCROLLS  page=  347px   a portal link pasted into the note field
    SCROLLS  page=  668px   a pasted pharmacy name in the note field
    SCROLLS  page=  668px   a pasted pharmacy name as a dose label
    ok       page=  320px   baseline, nothing pasted

The four new cases cover the purpose box and the generic name only, so the suite is green on all
three. Pass 4 set the condition explicitly: wrap the whole card, or write down that only the new
field is covered and the rest is a known app-v71 defect. What shipped does neither, and the comment
asserts the covered case that is not covered. Either extend the rule to the card (or to those two
blocks) and add the note and a dose label to the case list, or delete the false clause from the
comment and record the note as an open app-v71 defect in the README row.

# B3 — a falsification claimed in the record that was not run, and its conclusion is false

The comment shipped in the suite, and the commit message, both say the two wrapping rules were
proved separately non-redundant "in both directions": deleting the column rule leaves the pasted
cases green, deleting both turns every case red. Those two mutants are real; I reproduced both
(35/36 and 32/36). **The third mutant — the one that actually tests the claim — was not run.**
Removing the purpose line's own `overflowWrap` and leaving the column rule in place:

    PASS  ... a pasted pharmacy name with no spaces      page=320px
    PASS  ... a link pasted from the hospital portal     page=320px
    PASS  ... a very long generic name                   page=320px
    PASS  ... three hundred characters with no break     page=320px
    36/36 checks passed

`overflow-wrap` is an inherited property and the purpose line is a child of that column, so the
line's own rule is fully redundant. That is harmless in the product and false in the record, which is
the third pass running that the sentence beside this check has not matched what the check does.

# THE RECORD — two numbers that are not true of what shipped

* The **README row** (the shipped release note) and the **PM sign-off** both state **"Suite 34/34"**.
  The shipped suite is **36/36**. The PM sign-off also says fifteen mutants across three apps; the
  commit message says eighteen. The PM file's own examined-commit line is two commits behind HEAD and
  its narrative stops at round 4 — it does not mention that two of the four liveness checks it
  presents as the structural cure vouched for a copy of the pattern, nor the stretched ruler, nor the
  anatomy reversal. A reader of the record would not learn that round 5 happened.
* `./release_check.sh` fails, correctly, only because three audit reports refuse. Nothing else in the
  gate complains: the README row exists, `APP_VERSION` and the `sw.js` CACHE agree on
  `chemowell-app-v72-1`, and `PUBLISHED.json` still records app-v71.

# WHAT I TRIED TO REOPEN AND COULD NOT

* **The liveness checks.** All four patterns are named constants (`FORMY`, `SCHEDULEY`, `FEVERY`,
  `NUMBERY`), each guard uses the constant and each liveness check uses the same constant. None
  carries a `g` flag, so there is no `lastIndex` trap; none is reassigned between definition and use;
  every result is passed to `t()` and asserted, not discarded. The doubled-backslash kill on `FEVERY`
  that stayed green last pass now turns its check red. Both siblings carry the fixed constants.
* **The 320px check now fails when it should.** With both wrapping rules stripped the four cases read
  804px, 416px, 804px and 2651px and all go red; with only the column rule stripped, the generic-name
  case alone goes red at 804px. The ruler is the literal 320 the test set. Each case resets its own
  field, and its own field-set is asserted, so a silent reset failure cannot make a later case pass.
* **The word list, both directions.** The bare anatomy words are gone and the route phrases that
  contain them stay, so "Eases itching and swelling of the skin", "Treats an infection of the skin",
  "Eases soreness of the mouth and tongue" and "Helps prevent a blood clot in a vein" are accepted
  while "Rubbed on the skin", "Put under the tongue", "Given by IV" and "Sprayed into the nose" are
  rejected. The README's "bans route, not anatomy" is now TRUE of the code, in both directions.
* **Placeholder semantics.** Unset stays unset, typing overrides, clearing returns to the built-in,
  an untouched save stores nothing, and no wording is frozen into stored config. The release adds no
  delete or correction path and cannot lose a record.
* **The `h()` / prototype-key trap.** `medPurposeKey()` plus `Object.prototype.hasOwnProperty.call`
  covers the name, the generic name and the editor; a medication named `Constructor` renders as an
  ordinary card with no line and no page error.
* **The copy.** The new disclaimer — "Where a medication has a line under it, that is general
  information, not medical advice. Your care team is the answer for anything specific." — is true in
  every state the screen can be in, which the old wording was not, and it reads plainly at 2am. No
  dose, no schedule, no advice, no fever-suppression guidance, US register throughout. The field
  label, the placeholder and the empty states are unchanged and clean.

# NOT BLOCKING, BUT WRITE THEM DOWN

* **The widened list quietly LOST two words it used to have:** `oral` and `dissolve`/`dissolved`. So
  "An oral steroid that calms swelling." and "Dissolves on the tongue." are rejected by the app-v71
  list and accepted by this one. Also still through: "Place it between the cheek and gum.", "Melts in
  the mouth.", "Placed in the rectum.", "Given through a port." The guard only polices the 42 built-in
  sentences, never what a caregiver types, so these are editorial misses rather than a live risk —
  but the two REGRESSIONS should go back in.
* **Two legitimate sentences the list still wrongly rejects:** "Makes it easier to swallow." (real for
  mouth sores) and "Reduces post-nasal drip." Worth a line in the comment saying the list
  over-rejects a few verbs and how to clear one.
* The table has no Neulasta, no metoclopramide and no promethazine, and misses the brand halves of a
  dozen drugs it covers. Already queued as an Enhancer item; adding entries after an audit is how the
  Tylenol Liquid block happened, so keep them in their own release with their own read.

# HOW TO CLEAR THIS

B1 is one assertion in three repos. B2 is either one style property plus two more cases, or one
sentence of prose and a README line — the choice is the builder's, but one of them has to be true.
B3 and the two stale numbers are prose. Nothing here needs a rebuild and nothing here touches the
feature, which survived everything I threw at it for the third pass running. Re-run the suite,
re-run `./release_check.sh`, and the re-audit is a delta pass over these points.
