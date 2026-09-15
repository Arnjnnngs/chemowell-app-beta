AUDITED-COMMIT: 7eb5daa
VERDICT: DO NOT SHIP

# SCRIBE — ChemoWell app-v83 + app-v84

Stage 7. The code was not reviewed for correctness here; every finding below is a **record**
measured against the shipping diff (`048c1ff..7eb5daa`), and where a record and the code disagree
this report says which one is wrong.

**HEADLINE: there is a sixth records failure, and it is four.** The `README.md` app-v84 row asserts
a scroll-lock mechanism the build does not contain and deliberately rejected; a nineteen-mutant
falsification result that no run has ever produced; a `falsify.sh` port guard that exists in no
commit of this release; and a rebuild script "verified by LOADING it" that, loaded, renders a blank
app. The first and the fourth are the same shape as this release's own worst finding — *a record
asserting a guarantee the code does not have* — and the fourth I reproduced rather than reasoned.

Every suite figure in the app-v84 row's final list is TRUE. Every caregiver-facing string I could
check is TRUE. The app is not what is wrong here; the paperwork is.

---

## 1. BLOCKING — records that are materially false about what shipped

### B1. The scroll lock is not driven by the back-button registry. `README.md:14` (app-v84 row).

The row says:

> "Written for the class per Rule 5.5 and driven by the back-button registry — a layer marked
> `overlay: true` gets a lock on the same line where somebody decides what Back does to it, **so the
> two decisions cannot drift apart.**"

**The record is wrong.** `index.html` contains no `overlay: true` flag anywhere — `grep -c "overlay:
true" index.html` is 0, and the five remaining occurrences of the word "overlay" are the function
name and prose about why the flag was removed. The shipping lock is `anyOverlayOpen()`
(`index.html:1845–1884`), which maintains no list at all: it walks the page's direct children, skips
anything not `position: fixed`, skips anything with `pointer-events: none`, and returns true for an
element covering ≥90% of the viewport in both axes.

This is not a drafting slip. The flag mechanism was built at `e5dfce4` and **deleted** at `6d7280a`,
and the code's own comment (`index.html:1829–1837`) records why:

> "the audit found TEN OF TWENTY-THREE FLAGS WRONG. The medication editor is an in-page panel, not
> an overlay — marking it froze the body at 844px around a 6,869px editor with no inner scroller,
> putting 'Save changes' and sixty-one other controls permanently out of reach on the only screen
> where editing and deleting live. Nine inline confirmations had the same problem."

So the README asserts the exact safety property (*"cannot drift apart"*) that was measured to have
drifted ten times out of twenty-three and was replaced for that reason. `README.md` was committed
twelve more times after `6d7280a` and this paragraph was never touched.

**Two consequences, both real.** A reader who trusts the row adds `overlay: true` to a new
`BACK_LAYERS` entry and gets no lock. And the defect that replacement fixed — the medication editor
and nine armed delete confirmations freezing the page — **appears nowhere in the README at all**
(`Save changes`, `6,869`, `sixty-one other controls`: 0 hits). The row records the tour freeze, the
`preventScroll` half-fix and the `touchmove` mutant in paragraph-level detail; this one, which is at
least as user-visible, is absent.

**The row's exemption list is wrong for the same reason.** It says *"Deliberately exempt and
asserted as exempt: the inline layers — the vitals panel, the symptom filter, an open help topic"*.
The code says the exemptions are *"exempt BY MEASUREMENT rather than by being remembered"* and its
list also names the medication editor and an armed delete confirmation — the two that actually
broke.

**Which side is wrong: the README.** The code is right and its comment is accurate.

### B2. "Nineteen mutants swept, nineteen caught, none survived" is a result no run has produced. `README.md:14`.

The only sweep recorded anywhere in `outputs/` is `AUDIT-app-v84-delta6.md` §2.1:

    === BASELINE  95 checks: 95 passed, 0 failed
    === 18 mutant(s) caught, 0 survived        (exit 0)

That ran against `8bcb8c9`, a tree that **did not contain mutant 19** — delta6 is the pass that
proposed it. Mutant 19 was added in `0fcca1c`, which is also the commit that wrote this sentence
into the README, and also the commit that rewrote the licence-exclusion line that `mutant_18`
anchors on **without updating the mutant**. From that commit onward the sweep could not reach 19:
`mutant_18`'s `assert s.count(old)==1` failed, and under `set -e` the sweep died on the spot. HEAD's
own commit message says so in those words:

> "The sweep stopped three times on a stale mutant and never said so … log ending on mutant 18's
> header, no tally, pipeline exit 0."

So at the moment the figure was written a nineteen-mutant sweep was impossible, and the three
attempts since produced no tally at all. The recorded 18/18 is also against a **95-check** baseline;
the suite is 96 checks now, so it is not a run of the shipping suite either.

**I checked the substance rather than only the claim.** `FALSIFY_FROM=17 FALSIFY_TO=19
./falsify.sh test/v84-whatsnew.mjs falsify/mutants-v84-whatsnew.sh` at HEAD, on a free port:
baseline **96 checks: 96 passed**, then `=== 3 mutant(s) caught, 0 survived`, each of 17, 18 and 19
dying at 94/96 on the two first-run assertions. So mutant 18's anchor fix works and the underlying
claim is probably true. **It is still a figure asserting a measurement that did not happen**, which
is the thing this release has refused five times, and mutants 1–16 have never been swept against
HEAD's `index.html` at all (it changed at `0fcca1c`).

**Which side is wrong: the README.** The honest sentence is the recorded one — eighteen caught at
`8bcb8c9` against a 95-check baseline, plus 17–19 verified individually at HEAD — or a completed
sweep, in slices, at HEAD.

### B3. `falsify.sh` does not refuse a busy port. `README.md:14`.

> "It also refuses a port something else is already serving, after the first run of the script judged
> the previous run's mutated clone and reported a baseline failure about code that was fine."

**No such guard exists, in any commit of this release.** I read every version of the file
(`git log --format=%h -- falsify.sh`, nine commits): none contains a listener check — no `lsof`, no
`ss`, no `/dev/tcp`, no test of the server's exit status. Lines 48–50 start
`python3 -m http.server "$PORT"` with **stdout and stderr to `/dev/null`**, capture `$!`, and then
curl the port for up to ten seconds. If another process already holds the port, the new server dies
with an unread "Address already in use", `SRV` is a dead pid, the curl succeeds against the **other**
server, and the whole sweep — baseline and every mutant — runs against whatever that server is
serving while `$WORK` is mutated underneath a server nobody is talking to. That is precisely the
failure the sentence claims is fixed.

This is not theoretical here: a stale `http.server` was already holding port 8931 in this sandbox
when I started, which is why I ran on 8933/8951.

**Which side is wrong: the README.** (Or the code — a guard would be four lines. But the record
must not claim it until it exists.)

### B4. The documented rebuild path builds a blank app, and the row says it was verified by loading. `README.md:14`, `harness-v84-whatsnew.py`.

The row says:

> "**THE REBUILD SCRIPT RAN AND BUILT A BLANK APP.** … The script now does what the release did:
> lifts the whole hook block out and re-attaches it at the end of the module, and **the result was
> verified by LOADING it, not by the script printing OK.**"

**Measured, not argued.** I exported the base the script anchors on — `aaeca4f`, the only commit
carrying `const APP_VERSION = 'app-v83';` — ran `harness-v84-whatsnew.py` against it, served the
output and loaded it in Chromium:

    pageerrors: ["ReferenceError: HAD_PRIOR_CHEMOWELL_DATA is not defined"]
    root innerHTML length: 0

The script prints `OK -- What's New applied` and exits 0. The file it writes emits

    // after they dismissed it. See `const HAD_PRIOR_CHEMOWELL_DATA` near `const PROFILES_KEY`.
    function deviceHasPriorChemoWellData() { return HAD_PRIOR_CHEMOWELL_DATA; }

— a reference to a constant it never creates, and a comment pointing the reader at a declaration
that is not in the file. `state.whatsNewOpen = whatsNewShouldShow()` runs at module scope, and on a
phone with no seen-version marker — **every phone in this rollout** — it throws and the app stops
booting. Same symptom as the failure the row says was fixed, one identifier over.

It went stale at a traceable point: at `7187a9c` the script still built a self-contained
`deviceHasPriorChemoWellData()` that walked `localStorage`, which would have loaded. `0fcca1c`
rewrote it to return the snapshot and did not build the snapshot. The "verified by LOADING it"
sentence predates that and was not re-run.

**The docstring describes something other than what it builds** (brief item 5). It says:

> "THIS SCRIPT DOES NOT BUILD THAT SNAPSHOT, so a file rebuilt from base + this patch **carries the
> defect**"

It does not carry the defect. It does not run. "Carries the defect" tells a reader they get an app
with the old always-greeted behaviour; what they get is an empty `#root`. The README's closing
paragraph has the same gap — it names `whatsNewOlderUnseenCount` and the first-ever line as missing
and does not name the snapshot, which is the one that is fatal.

**Which side is wrong: both records.** The script is also wrong, but it is out of my scope to edit
and the release is reproducible from git, which the row already says.

---

## 2. DISCREPANCIES — record wrong, not blocking

**D1. `README.md:15` (app-v83 row): `test/v83-meds-and-reports.mjs` **45/45**.** The shipping suite
reports **80/80** (measured). Nothing in the row marks 45 as a point-in-time figure. `PM-app-v84.md`
§7 flagged this exact figure — *"neither 45 nor 56 is what the shipping build reports"* — and it was
not corrected. The app-v84 row's final list does carry 80/80, so the two rows disagree with each
other.

**D2. `README.md:17` (app-v81 row): `test/v81-purpose-hint.mjs` **23/23**.** The shipping suite
reports **32/32** (measured, 7 sections). It is the row's last word on that suite and reads as final.

**D3. `README.md:14`: "the final figures for every suite are at the end of this row."** The
end-of-row list carries nine suites. Three more were run for this release and are not in it:
`test/v81-dose-parser.mjs` **227/227**, `test/v81-purpose-hint.mjs` **32/32**,
`test/v72-med-purpose.mjs` **65/65** (all measured). "Every suite" is an overstatement of a list that
is otherwise exactly right.

**D4. `README.md:17`: "The registry covers 23 layers … a nineteenth overlay cannot be added."** 23
was true at app-v81 (verified at `6fd6248`). "Nineteenth" matches nothing — not 23 then, not the
**26** entries in `BACK_LAYERS` at HEAD. `test/v82-back-button.mjs` passes 15/15 against 26, so the
completeness check is fine; the prose is not.

**D5. `harness-v84-whatsnew.py:2` opens `"""app-v83 -- ChemoWell gets the WHAT'S NEW notice on
open."""`** The script patches `const APP_VERSION = 'app-v83';` → `'app-v84'` and writes a CHANGELOG
whose newest entry is `app-v84`. It builds app-v84. The title is left over from `df09f18`, when
What's New was going to be v83 and the Meds card v84, and the two were swapped.

**D6. `falsify.sh:74–75`: "the sweep would have proceeded to compare twelve mutants against nothing
at all."** There are nineteen, and line 89 of the same file says "Nineteen mutants". One of the two
is stale; the reader cannot tell which.

**D7. `falsify.sh:45` and `:165`: "getting 96 checks where the suite has 95."** The suite has 96 now.
It reads as a present-tense fact about the suite and is a past anecdote.

**D8. `falsify.sh:120`: "THREE OUTCOMES, NOT TWO."** The code implements four — CAUGHT,
CAUGHT-but-aborted, COULD NOT MEASURE, SURVIVED — and the README correctly says four. The comment
body is accurate; only its heading undercounts.

**D9. `index.html:5306`, `:5308` and `:9727`: "the v28 listener near line 4218" (three times).** The listener is at
`4321`. A hundred-line pointer in a 12,800-line file.

**D10. `test/v84-whatsnew.mjs:1` is headed `v83-whatsnew.mjs` and its Run line says
`node test/v83-whatsnew.mjs`.** The file is `test/v84-whatsnew.mjs`. Same v83/v84 swap as D5.

**D11. `PM-app-v84.md` body, standing claims now false without a correction beside them.** The
appended correction is **accurate** — I re-read the shipping snapshot and `whatsNewShouldShow()` and
it describes them correctly, and it is right that README, the code comment and `DESIGN-app-v84.md`
were all corrected in place (I verified all three). But the body also says *"the independent audit
has never seen the commit being shipped"* and *"the Enhancer and Designer seats have no pass on file"*,
and both were answered afterwards (`AUDIT-app-v84-delta4/5/6`, `ENHANCER-app-v84.md`,
`DESIGN-app-v84.md` with four addenda). The header pins the file to `3ec6b4c` and the footer says
"Measured at `3ec6b4c`", so a careful reader is not misled — but the correction section says *"ONE
CLAIM IN SECTION 3 WAS FALSE"* and there are more than one stale claim in the file.

---

## 3. CHAIN STATE — not a records defect, but the next reader needs it

- The only PM sign-off on file for this release, `outputs/PM-app-v84.md`, still reads
  **`VERDICT: DO NOT SHIP`** at `3ec6b4c`. `release_check.sh` requires a **current** `PM*app-v84*`
  saying SHIP (lines 704–705) and will refuse until one is issued.
- The newest audit, `AUDIT-app-v84-delta6.md`, says SHIP at **`8bcb8c9`**. HEAD is `7eb5daa`, five
  commits later, and `index.html` changed by 47 lines in between (`WIPE_SURVIVORS`,
  `window.__eraseTest`, the two-exclusions comment). I verified those changes are behaviour-neutral
  — `WIPE_SURVIVORS = [LICENSE_KEY]` makes both call sites identical to the literals they replaced —
  but no audit has seen them.

---

## 4. VERIFIED TRUE — do not re-derive these

**Version identity — consistent, all four places.** `index.html:9033` `APP_VERSION = 'app-v84'`;
`sw.js:1` `CACHE = 'chemowell-app-v84-14'`; `CHANGELOG[0].v === 'app-v84'`; README row header and its
closing `APP_VERSION → app-v84` / `sw.js CACHE → chemowell-app-v84-14`. Every `chemowell-app-v8N-n`
string in the README (`v80-2`, `v81-3`, `v82-1`, `v83-1`, `v84-14`) matches a real commit's `sw.js`
line 1. Only `v84-14` reaches a device; the others are intermediate rows, which is this history's
existing convention.

**Every suite figure in the app-v84 row's final list.** Measured against a clean `git archive HEAD`
export, served on port 8933, **md5 of the served file checked against HEAD's `index.html` first**
(`d6fdcf6c20738b1f4ba8f2d49152d425`, identical):

| Suite | README | Measured |
|---|---|---|
| `test/v84-whatsnew.mjs` | 96/96 | **96/96** |
| `test/v83-meds-and-reports.mjs` | 80/80 | **80/80** |
| `test/v80-up-next.mjs` | 48/48 | **48/48** |
| `test/v75-no-other-patient.mjs` | 27/27 | **27/27** |
| `test/v82-vitals-strip.mjs` | 41/41 | **41/41** |
| `test/v82-timeline.mjs` | 24/24 | **24/24** |
| `test/v82-back-button.mjs` | 15/15 | **15/15** |
| `test/v76-properties-equivalence.mjs` | 22/22 | **22/22** |
| `test/v76-empty-window-render.mjs` | 13/13 | **13/13** |

Also `test/v81-dose-parser.mjs` **227/227** (README v81 row: "227 checks" ✓) and
`test/v72-med-purpose.mjs` **65/65** (README v81 row ✓).

**Counts the brief asked for, one at a time.**
- `CHANGELOG.length` = **5** (`index.html:9040–9076`); README "five entries for an eighty-four-release
  app" ✓.
- Mutant file defines `mutant_1 … mutant_19` = **19** ✓ (the *sweep result* is B2, the file is right).
- Corpus: `CLAIMS` = **18**, `INNOCENT` = **12** (`test/v84-whatsnew.mjs:957–990`); README "eighteen
  wordings that must be caught, twelve innocent ones" ✓.
- `1,354px` (tour freeze, `index.html:1865`, `AUDIT-app-v84.md:58`) and `1,353px` (v28 swipe,
  `index.html:4280`, `test/v84-whatsnew.mjs:551`) are two different measurements, not a typo ✓.
- Suite sections `7g` and `7h` exist by those names; `7h` covers **five** cases as claimed ✓.

**The four completeness surfaces are all corrected, and I read the shipping strings, not the diff.**
Menu row helper `index.html:4558` "Recent updates, newest first"; screen heading `:9164` "Recent
updates to ChemoWell, newest first."; button `:9214` "See recent updates"; changelog entry `:9045`
"Updates from here on are listed under “What’s new” in the menu, newest first". None claims
completeness, and all four sit in the suite's `INNOCENT` corpus.

**The in-app `CHANGELOG`, Voice's three questions.** All five entries: they/them or second person
throughout, no patient name, no care-plan dose, no version number in the prose, no file or function
names. Each bullet checked against the code —
- v84 "Tap 'Got it' and it does not come back" — `close()` calls `whatsNewMarkSeen()` before
  `setState` ✓, and Back does the same (`BACK_LAYERS` `whatsNewOpen`, `index.html:1799`) ✓.
- v84 "listed under What's new in the menu, newest first" — `CHANGELOG` is newest-first and
  `renderWhatsNew` maps it in order ✓.
- v83 "a bar showing how much of it has been used and how much is left" — `medCeilingBar`
  (`index.html:8371`) ✓, and a rolling-window limit now prints "A rolling 4-hour limit, not a daily
  one" and labels the reader "in the last 4h" rather than "today" ✓.
- v81 "'.5 mg' was being counted as 5 mg against a daily limit" — matches `test/v81-dose-parser.mjs`
  227/227 ✓. This is the one entry with a clinical consequence and it reads correctly at 2am.
- No average, anywhere, on any of the new screens ✓ (Rule 2.7 q3).

**Code comments that make behavioural promises** — each checked against the code beside it:
- `HAD_PRIOR_CHEMOWELL_DATA` "Nothing above it touches localStorage except reads" — `saveJSON` and
  `setLicense` are *defined* above line 207, neither is *called*; the first write is `initProfiles()`
  immediately below ✓.
- The two exclusions, and why they are written differently — `WIPE_SURVIVORS` is declared at :170,
  above the snapshot; `WHATS_NEW_KEY` at :9077, below it. The comment's correction of the earlier
  "both are below" claim is itself correct ✓.
- `WIPE_SURVIVORS` "one list, two readers" — `:213` and `:1097`, and both are behaviourally identical
  to the literals they replaced ✓.
- The double-evaluation note — `controllerchange` → `window.location.reload()` exists at
  `index.html:12773–12777` ✓.
- `restoringFocus` re-entrancy note, "nothing in this file listens for 'focus' OR 'focusin' except
  the v28 nudge" — exactly one `focusin` listener (`:4321`), zero `focus` listeners, zero `onFocus`
  props ✓. The note is true and its warning is the right one.
- The gesture guard — `['wheel','touchmove']`, passive + capture, timestamp not flag, and the
  `lastUserScrollAt > focusedAt` comparison is by cause as described ✓. The withdrawn claim about
  the loading splash is withdrawn in the comment itself and does not appear in the README ✓.
- `falsify.sh`'s scoring block — the code implements what the body describes (summary line = it ran;
  red + summary = caught; red without summary = caught-but-aborted; neither = COULD NOT MEASURE,
  counted against the sweep) ✓. Only the heading and two figures are off (D6–D8).

**`outputs/` standing claims.** `ENHANCER-app-v84.md` and `DESIGN-app-v84.md` both match the shipping
code, including the first-ever line's exact wording and the fact that it carries no number;
`DESIGN`'s "fifteen screenshots" is the main pass and its four addenda account for the other twelve
(27 files on disk ✓). `AUDIT-app-v84-delta6.md`'s sweep quote is accurate for the tree it ran on.
`PM-app-v84.md`'s appended correction is accurate.

---

## 5. HOUSEKEEPING — explicitly outside the verdict

- `test/v84-whatsnew.mjs` prints section `7f` **after** `7h`; the labels are out of order in the log.
- The `CLAIMS` corpus comments mark four strings `// the menu row, shipped`, `// the screen heading,
  shipped`, `// the button, shipped`, `// the entry text, shipped`. All four were **replaced**; they
  are the strings that *used to* ship. "shipped" reads as present tense.
- The app-v83 CHANGELOG bullet says "A medication with a **daily** limit gets a bar". Rolling-window
  limits get one too. Not false; "a limit" would be truer.
- The app-v84 README row is ~19,000 characters in one table cell. Every specific claim in it that I
  could measure is right or is listed above — but the four blocking findings all survived because
  nobody can re-read that cell end to end. Worth splitting the narrative out of the table.
- `falsify.sh` prints a raw `curl: (7) Failed to connect` on its first poll of a server that has not
  started yet. Harmless, looks like an error.

---

## 6. WHAT I DID NOT CHECK

- **I did not review the code for correctness.** Not my seat. Where I read code it was to decide
  which of a record and the file is wrong.
- **I did not run mutants 1–16.** I ran 17, 18 and 19 at HEAD (all caught, baseline 96/96). 1–16 are
  recorded as caught at `8bcb8c9` only, and `index.html` has changed since.
- **I did not open a browser at 320/360/390 or look at any screenshot.** That is the Designer seat; I
  checked that its report's claims match the code, not that its images match its claims.
- **Nothing on a real device, and no iPhone anything.** Chromium only, and this release's iPhone
  exemption is correctly stated in the README and in `DESIGN-app-v84.md`.
- **I did not re-verify the app-v79 and earlier README rows**, or any row below app-v80.
- **I did not check `release_check.sh` end to end** — only its verdict parser and its
  audit/PM-freshness requirement, to report the chain state in §3.
- **I did not verify `PUBLISHED.json`'s `commit` against what is actually serving** at
  `arnjnnngs.github.io`; there is no network to it from here. I took `048c1ff` / `app-v80` as given.

---

*Scribe pass, ChemoWell app-v83 + app-v84. Measured at `7eb5daa` on 2026-09-15. Suites run against a
clean `git archive HEAD` export on port 8933, md5 of the served file checked first. Working tree
untouched apart from this file.*
