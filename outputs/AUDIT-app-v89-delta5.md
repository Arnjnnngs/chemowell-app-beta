AUDITED-COMMIT: 1afe961
VERDICT: SHIP

# Zero Day Audit — ChemoWell app-v89, FIFTH DELTA PASS (the two-word re-audit)

Auditor: Zero Day Auditor (independent). Follows `outputs/AUDIT-app-v89.md` (refused `c692f8a`),
`-delta.md` (`92b95b1`), `-delta2.md` (`3c25aa9`), `-delta3.md` (`f6be11f`) and `-delta4.md`
(`a18098b` — the clearing pass that refused on two one-word edits). This pass covers
`git diff a18098b 1afe961` and `git log a18098b..1afe961`.

Working tree clean, `HEAD` = `1afe961`, `index.html` md5 `a9de408c…` — identical to a clean
`git archive` of `1afe961`. Measurements were taken against md5-verified clean exports served on
their own ports: `1afe961` on **9611**, `a18098b` on **9612**, `origin/main` (`8a7d696` = live
app-v88, md5 `6c24a321…`) on **9613**, and **nine mutants** — eight byte copies of the app on
**9621–9628** plus one suite-side mutant run against the unmodified app. Every served file's md5
was compared with its own directory before any result was believed. All eleven servers were killed
at the end; only the pre-existing repo server on 8899, which this pass did not start, is left
running. No tracked file was modified except this report; no `git add`/`checkout`/`reset`/`stash`.

---

## HEADLINE

**SHIP.** Both blockers are genuinely fixed, the delta is exactly the four lines of copy it claims
to be, and I re-measured the release's substance from scratch against the live build rather than
trusting the previous pass: **live app-v88 is serving clinicians a report and a CSV that drop a
radiation session's number, a skin reaction's severity and site, and a weight's reason, and this
build fixes all three and changes nothing else.** The notice describing it is true, and the title
is now true without qualification.

**Section 9 is sound for what it pins, and I broke it four ways it does not pin.** The builder's
four falsifications all reproduce exactly as claimed. But my own mutants found **four survivors at
a fully green 74/74**, and one of them is the original blocker's own shape re-entering:

| My mutant | What it does | Result |
|---|---|---|
| **m4** | keeps `skin reactions` **and adds** `symptoms` — *"Radiation sessions, symptoms including skin reactions, and weights…"* | **74/74 — SURVIVES.** 9.4's `\|\| /skin reaction/` escape hatch lets the over-claim back in additively. |
| **m5** | names two kinds that lost nothing and are outside 9.5's four-word list — *"…paracentesis volumes, in-patient days and weights…"* | **74/74 — SURVIVES.** |
| **m7** | a false title the regex does not know — `Nothing costs money now`, with Plus at $4.99 on screen | **74/74 — SURVIVES.** |
| **m8** | the false title `Everything is free now` **plus** emptying the modal's `Updated` badge | **74/74 — 9.6 GOES VACUOUS.** The title is extracted as `"Oct 31, 2026"` and **9.6a, the precondition that exists to catch this, passes on the date string.** |

None of these is a reason to hold the release — the shipped copy is true, measured three ways — but
**9.6 is one positional index away from checking nothing**, and that is a `data-` hook and two lines
of assertion away from being fixed. Follow-ups F1–F4.

**Three new, small findings in the record rather than the app** (R1–R3): the README row the commit
added says the suite grew to **71 checks** when it is **74**, claims **`v88 58/58`** when that suite
is **56/58 on every build including live** (the previous pass's own N2 false red, still red at HEAD
today), and is still dated **Oct 26** while the changelog entry it documents is now dated **Oct 31**.

---

## B1 — RESOLVED. The gate is green and the ratchet was not loosened.

`index.html:9319` now reads `// Aaron is right and the numbers were indefensible…`. The one-word
edit removes exactly one `\bhe\b` hit.

```
$ node test/v75-no-other-patient.mjs
  PASS  no NEW gendered pronoun has been added to the file (Rule 0 shape 2)  |  32 found, ratchet allows 32
  PASS  and the ratchet is not slack -- lower it when the debt is cleared    |  32 found, ratchet set at 32
29/29 checks passed            (exit 0)
```

**`PRONOUNS_ALLOWED` is still 32** (`test/v75-no-other-patient.mjs:313`) — the count came down to
the ratchet rather than the ratchet going up to the count, which is what delta4 asked for. Both
sides of the two-sided check are exactly tight, so the next added pronoun fails immediately.
`release_check.sh:847–860` runs this suite, so the gate's v75 line is now green.

The delta adds no pronoun and no patient name anywhere, including in the new test code
(`git diff a18098b 1afe961` → zero `\b(she|her|his|him|he)\b` on added lines, zero `brandi`).

## B2 — RESOLVED, and the title is true without qualification.

`index.html:9330` now reads `title: 'Every feature is free now'`, dated `Oct 31, 2026`.

**Measured, not read.** Every tier gate in the file is a profile-count gate and nothing else:
`tierLimit()` (`index.html:172`, free 1 / plus 3 / pro ∞) has exactly three readers —
`createProfile()` (`:634`) and the two Add-profile buttons (`:10390`, `:11377`) — and the only other
`upgradeOpen: true` call sites are the two **View plans** buttons (`:10391`, `:11344`). There is no
feature check left: `openPrintReport()` (`:10931`) builds and opens the report with no tier test at
all, and both export consumers (`:10876` CSV, `:10932` report) go through the one `buildExportRows()`.
So **every feature is free, and the title is the exact true claim.**

**And the whole notice reads consistently with it**, rendered at 320px:

> **UPDATED**
> **Every feature is free now** · Oct 31, 2026
> • The printable doctor's report no longer costs anything. It was the only feature you had to pay for.
> • Paying adds one thing: more people to track. One person gets every feature, free, for good.
> • Radiation sessions, skin reactions and weights logged with a reason were printing without their details. Fixed. If you sent a care team a report or spreadsheet since October 24th showing any of those, send a fresh one.

Bullet 2 no longer contradicts the headline — it qualifies it, in the direction the headline leaves
open. The plans sheet says the same thing in its own words (`index.html:5183`: *"Every feature in
ChemoWell is free for one person, and stays free. Paying adds more people to track — once, not
monthly"*), and the two paid cards' third bullet is *"Every feature, for all three"* / *"for all of
them"*. **Headline, bullets and price list now agree.** A caregiver tracking two relatives reads
the headline, reads one line further, and is told the thing they are about to hit.

**The two copy minors from delta4 (M4, M5) are both fixed in the same bullet:** *"a report or
spreadsheet"* (the CSV was affected too) and *"since October 24th"* (a concrete date in place of
*"in the last few days"*).

### The date change is coherent

`app-v89` is dated **Oct 31** (today, the ship date) and the bullet says the defect has been live
**since October 24th**. `README.md`'s own table dates **app-v86 — the release that introduced the
defect — Oct 24**, so the date in the sentence is the right one and a reader can act on it. Entry
order is unchanged and still non-increasing: v89 Oct 31, v88 Oct 25, v87 Oct 25, v86 Oct 24, v85
Sep 17, v84/v83/v82/v81 Sep 14, v80 Sep 13. No other entry's date moved.

**Rule 0.9 mechanics, re-measured on all ten entries:** titles 4–6 words (v89 is 5); bullets 1–3
per entry; **424 bullet words total**; longest entry **71 words** (v89, the documented
action-bullet exception, one word over the ~70 target and well under the 100-word rewrite line);
**zero markdown characters in the array** and zero in the rendered notice at all three widths.

---

## SECTION 9 — IS IT SOUND, OR DOES IT ONLY LOOK SOUND?

**Both defects delta4's N1 fix introduced and then repaired are genuinely repaired.** The lookup
table is gone — the search term is derived from the type string the export printed
(`termFor = ty => ty.split('/')[0].trim().split(/\s+/)[0]`), so `Skin Reaction/Rash` yields `Skin`
and the one kind the section exists for can no longer be silently skipped. And the notice is read
from `document.querySelector('[data-whatsnew-modal]').innerText`, not `document.body`, so the nav's
"Symptoms" tab no longer counts as the notice saying "symptoms". I confirmed the second one by
construction: m1's failure detail prints the changelog sentence, not a nav label.

### The builder's four falsifications — all four reproduce

| Mutant (byte copy, own port, md5 verified) | Claimed | Measured |
|---|---|---|
| **m1** `skin reactions` → `symptoms` (port 9621, md5 `c35d04b5…`) | reds 9.3 and 9.4 | **72/74 — reds 9.3 (`not named: ["Skin Reaction/Rash"]`) and 9.4.** ✓ |
| **m2** the weight dropped from the named list (9622, `089202dd…`) | reds 9.3 | **73/74 — reds 9.3 (`not named: ["Weight"]`).** ✓ |
| **m3** the false title `Everything is free now` restored (9623, `3d4b2ffb…`) | reds 9.6 | **73/74 — reds 9.6.** ✓ |
| the false title before 9.6 existed | scored 71/71 | consistent with m3 above: every other check in the section reads bullets. ✓ |

**So the two blockers are now each held by a check that fails when they come back.** And it matters
that `release_check.sh:834` runs `test/v89-everything-free.mjs` in its suite loop — section 9 and
9.6 are gate-enforced, not merely present.

### My own mutants — four survivors and one false red

**m4 — the original over-claim re-enters additively. SURVIVES 74/74.**
*"Radiation sessions, **symptoms including skin reactions**, and weights logged with a reason were
printing without their details…"* 9.4 is
`!/\bsymptoms?\b/.test(notice) || /skin reaction/.test(notice)` — the second clause is an escape
hatch, so the word that caused three refusals is allowed back as long as `skin reaction` appears
somewhere in the same notice. This is not hypothetical wording: it is the most natural way a future
editor would try to be helpful. **It tells someone logging nausea to re-send an oncology printout
that comes back identical**, which is the exact harm the sentence took five drafts to stop doing.

**m5 — a kind that lost nothing can still be named. SURVIVES 74/74.**
*"Radiation sessions, skin reactions, **paracentesis volumes, in-patient days** and weights…"*
9.5 polices a fixed four-word vocabulary (`temperature`, `blood pressure`, `appetite`, `bowel`), so
any other kind can be falsely named. Both of my additions are false: paracentesis lost only the
word *"drained"* (measured below) and in-patient rows are byte identical on both builds.

**m7 — a false title the regex does not know. SURVIVES 74/74.** `Nothing costs money now`, with
`["$0","$4.99","$14.99"]` read off the plans sheet in the same run. 9.6's regex is
`/\b(everything|all of it|all features)\b[^.]{0,20}\bfree\b/i` — derived with respect to *whether
the app charges*, but pinned with respect to *phrasing*. It catches the one sentence that was
written and no paraphrase of it.

**m8 — the most important one. 9.6 goes VACUOUS and 9.6a does not notice. SURVIVES 74/74.**
The title is taken positionally: `notice.split('\n').filter(Boolean)[1]`. Line 0 is the modal's
unconditional `Updated` badge (`index.html:9491`). I served the false title `Everything is free now`
**and** emptied that badge's text, and the suite reported:

```
PASS  9.6a  precondition: the notice title was found  |  "Oct 31, 2026"
PASS  9.6   the title does not promise everything is free while the app still charges
            |  title "Oct 31, 2026" with prices ["$0","$4.99","$14.99"]
```

9.6a's guard is `title.length > 3 && title.length < 60`, which a date satisfies. **Any future change
to that modal's header — a badge removed, a line added above the title — silently turns 9.6 into a
check on the date string, and the precondition written to prevent exactly that passes.** It is the
Rule 5 rule about text selectors: the title node (`whatsNewEntry`, `index.html:9458`) carries no
`data-` hook, so the only thing identifying it is its position.

**m9 — a FALSE RED, on the suite's own derivation. (Suite-side mutant: I added one paracentesis
entry to section 9's seed and ran it against the unmodified app on 9611.)**

```
FAIL  9.3  | measured affected: ["Weight","Radiation Session","Skin Reaction/Rash","paracentesis"]
           | not named: ["paracentesis"]
73/74
```

The derivation is *Detail ≠ the entry's own `dose`*, used as a proxy for *this kind lost a value*.
That proxy is true of the seven kinds currently seeded and false in general: the paracentesis writer
stores `dose: '3.5 L'` (`index.html:3228`) while the branch computes `'3.5 L drained'`, so a kind
that changed only its **format** is classified as having lost a **value**, and the section then
demands the changelog name it — when naming it would be the over-claim 9.5 exists to forbid. The
seed is fixed and the suite is green, so nothing is wrong today; **but the next person who extends
that seed gets a red that is wrong, on a check whose whole purpose is to be trusted about this
sentence.** A comment naming the proxy, or comparing Detail against the *previous release's* Detail
rather than against `dose`, closes it.

**And one brittleness in the other direction (m6, 73/74, reds 9.3 three times).** A *true* bullet
reworded in a reader's words — *"Treatment sessions, rashes and how much someone weighed, when a
reason was given, were printing without their details"* — reds 9.3 on all three kinds, because the
derived term is the type string's **first word**. I do not think this is a defect: forcing the
notice to use the app's own words for a kind the reader has to recognise on their own screen is the
right trade for a check about truthfulness. It is recorded so nobody is surprised by it.

### 9.6b is a real precondition

If the plans sheet failed to open, `prices` would be `null`/`[]`, `charges` would be false and 9.6
would pass vacuously — but 9.6b reds on exactly that (`prices.length >= 2`). The pair holds. In
every one of my nine runs it read `["$0","$4.99","$14.99"]`.

---

## THE RELEASE AS A WHOLE — RE-CONFIRMED BY MY OWN MEASUREMENT

**The export, both builds, ten app-shaped rows, field shapes taken from the real writers.** Seeded
identically on `1afe961` (9611) and live app-v88 (9613), read through
`window.__v86Test.exportRows()`:

| Type | `1afe961` Detail | live app-v88 Detail | changed |
|---|---|---|---|
| Temperature | `99.1 °F` | `99.1 °F` | — |
| Blood Pressure | `120/80 mmHg` | `120/80 mmHg` | — |
| **Weight, with a reason** | `150 lb (Fluid retention / swelling)` | `150 lb` | **reason restored** |
| **Radiation Session** | `Session 1` | *(empty)* | **number restored** |
| Bowel Movement | `Normal` | `Normal` | — |
| Appetite | `Little to none` | `Little to none` | — |
| **Skin Reaction/Rash, mild, left forearm** | `mild, site: left forearm` | *(empty)* | **severity and site restored** |
| paracentesis, 3.5 L | `3.5 L drained` | `3.5 L` | a word, no value — correctly **not** claimed |
| Nausea (bare symptom) | *(empty)* | *(empty)* | — |
| Weight, no reason | `151 lb` | `151 lb` | — |

Zero uncaught page errors on either build. **Exactly three kinds lost a value on live and exactly
three are fixed here; the bullet names those three and nothing else.** This is an independent
re-derivation of delta4's table, by a different seed and a different script, and it agrees.

**Everything else on the brief, re-checked at `1afe961`:**

* **The paywall removal** — `v89` section 1 clicks **Printable report** as a free user and requires
  a real report document back. Green. Confirmed statically above: no tier check on that path.
* **The cap at 1 / 3 / ∞** — `v89` section 3 drives all three tiers through the real Add-profile
  button. Green. `tierLimit()` unchanged by this delta.
* **`buildExportRows()`, both consumers** — one function, three readers (`:10876` CSV, `:10932`
  report, `:13586` test hook). The `if (superseded)` statement is still **below** the medId chain,
  so the trailing `else { detail = e.dose }` still binds to the chain and not to it.
* **The Help recovery procedure** — `v89` sections 6b.0–6b.6 green, including the three guards
  delta3 called bypassable: step one is the encrypt instruction (`pPassword === 0`), no earlier step
  moves the file, and it is an instruction rather than a denial.
* **No literal markdown rendered** — rendered the notice at **320 / 360 / 390**: zero `*`, zero
  backticks, zero stray underscores. `Updated` badge, title, date, three bullets, two buttons, and
  nothing else. The one element overflowing at 320 is a `1:00 AM` timeline label on **Home, behind
  the modal, byte-identical on live app-v88** — carried over, not a regression, and nothing in the
  modal overflows at any width. No page horizontal scroll at any width. No page errors.
* **Rule 0, all four shapes** — no patient name; **32 pronouns, ratchet 32, both sides tight**; no
  care-plan dose, ceiling or schedule; medication-id ratchets `0/0/0`, pinned at `0/0/0`.
* **Release mechanics** — `APP_VERSION = 'app-v89'` (`index.html:9307`) and
  `CACHE = 'chemowell-app-v89-1'` (`sw.js:1`) still move together. The delta touches neither.

**Suites run by me at `1afe961`, against the md5-verified clean export:**

```
v89-everything-free     74 / 74     (section 9 and 9.6 included)
v84-whatsnew           100 / 100
v75-no-other-patient    29 / 29     exit 0
v87-correct-a-past-day  64 / 64
v86-logging-and-labels  87 / 87
v88-log-a-missed-day    56 / 58     <-- the previous pass's N2 false red, still red (see R2)
```

---

## NEW FINDINGS

### R1 — MINOR (record) — the new README row says the suite grew to 71 checks. It is 74.
`README.md:14`: *"`test/v89-everything-free.mjs` grew 30 → **71 checks**"*. The suite is **74**, and
`1afe961`'s own commit message says *"the suite growing 30 → 74"*. 71 is the count **before 9.6
existed** — the number the false-title mutant scored against. The row therefore records the state of
the suite one commit before the commit that wrote the row. One digit, in the file Rule 0.9 nominates
as where the detail lives.

### R2 — MINOR (record) — the same row claims `v88 58/58`. That suite is 56/58 on every build, including live.
I ran it at HEAD: **56/58**, failing *"a day in the future writes nothing"* and *"and it says so
rather than failing silently"*. Identical on `a18098b` and on live app-v88 per delta4's own
measurement — it is the month-end calendar defect in the **suite** (it clicks the cell labelled with
tomorrow's date number while `renderCalendar()` draws only the cursor month, so on Oct 31 it clicks
Oct 1), not a defect in the app, and it is **not** in `release_check.sh`'s suite list, so it does not
block. But a release record that lists a suite as green when running it today prints two FAILs is
the "check that cannot fail" failure wearing the other face: **a check that did fail, recorded as
passing.** Fix the row, or fix the suite and then the row (delta4's N2, already logged as its own
task).

### R3 — MINOR (record) — the README row is dated Oct 26; the entry it documents is now dated Oct 31.
The delta moved the changelog entry to its real ship date and left the version-history row behind.
Two dates for one release, in the two records that are supposed to agree.

### F1 — FOLLOW-UP (instrument, the one I would do first) — give the notice title a `data-` hook and stop counting lines.
`whatsNewEntry` (`index.html:9458`) renders the title as an unmarked `div`. Add
`'data-whatsnew-title': e.v` to it and have 9.6 read
`m.querySelector('[data-whatsnew-title]').innerText`, then assert it **equals the newest
`CHANGELOG` entry's title**. That kills m8 outright and makes 9.6a a precondition that can actually
fail. ~3 lines of app, ~2 of suite. Rule 5 already requires this — *"elements by explicit `data-`
hooks, never text selectors"* — and a positional index into `innerText` is a text selector with
extra steps.

### F2 — FOLLOW-UP (instrument) — 9.4's escape hatch lets the over-claim back in (m4).
Make the forbidden-word test unconditional on the word, not cancelled by `skin reaction` appearing
elsewhere: if measurement says only `Skin Reaction/Rash` is affected, the notice must not contain a
bare `\bsymptoms?\b` **at all**. One changed line.

### F3 — FOLLOW-UP (instrument) — 9.5's over-claim list is a fixed vocabulary (m5).
Derive it the way 9.3 derives its list: for every seeded kind that measurement says was **unaffected**,
require the notice not to name it in a lost-value sentence. That covers paracentesis, in-patient,
cycle and doses without anyone having to think of them.

### F4 — FOLLOW-UP (instrument) — name the proxy in section 9, or change it (m9).
`Detail !== dose` means *"formats differently from the stored label"*, not *"lost a value"*. Add a
comment saying so beside the derivation, and ideally compare against the **previous release's**
Detail for the same seed — which is what the claim is actually about, and which this pass and the
last one both did by hand.

### F5 — FOLLOW-UP (blocking the push, not the build) — there is no PM sign-off for app-v89.
`outputs/` has five `AUDIT*app-v89*` reports, an `ENHANCER`, a `DESIGN` and a `DEV-BRIEF`, and **no
`PM*app-v89*`**. `release_check.sh:471–481` requires one naming a current commit, so the release
cannot pass its own gate until the PM stage runs. This report supersedes all five standing AUDIT
refusals — `c692f8a`, `92b95b1`, `3c25aa9`, `f6be11f` and `a18098b` are each an ancestor of
`1afe961` (verified with `git merge-base --is-ancestor`), this file states SHIP, and it is well over
the gate's 2 000-byte / 25-line substance floor — but the PM's desk is a different stage and an
auditor cannot sign for it.

### Carried over, unchanged, confirmed on BOTH builds — not regressions
* `nameOf()` (`index.html:2642`) has no `paracentesis` case, so the clinician's **Type** column reads
  lowercase `paracentesis` while the rest of the app says "Paracentesis". Visible in my export table
  above, identical on live.
* delta4's M1 (app-v85's entry lost its one action item; mitigated by permanent Settings copy), M2
  (two entries carry one bullet where Rule 0.9 asks two to four), M3, M6, and the whole M8 list
  (`weightReasonLabel()` on an unknown id, *"the Export section"* vs **Export data**, the
  `priv-lost-phone` step-2 repetition, the `note` em-dash weld, the `profiles` blurb, the one-child
  `inline-flex`). None touched by this delta.
* The Free plan card renders an **empty** feature list (`planCard('free','Free','$0',null,[],'free')`,
  `index.html:5186`), so the one-person limit is stated only in the sheet's blurb above it and not on
  the card itself. Pre-existing at `a18098b`; an Enhancer question, not an audit finding.

---

## NOT CHECKED — stated so nobody assumes otherwise

* **iOS / Safari rendering.** Chromium only in this sandbox. Standing exemption on every release.
* **The native Capacitor share path**, and real purchases (`TEST_MODE` simulates them).
* **`sync-backend/`, `capacitor.config.ts`, `package.json`, `.github/workflows/`**, and `sw.js`
  beyond the `CACHE` constant.
* **`release_check.sh` end to end.** It exits 1 at the chain gate for want of a PM sign-off (F5). I
  read the gate's logic (`:427–700`, `:834`, `:847–860`) and ran the three suites it invokes; I did
  not run the script itself or re-do delta3's throwaway-clone simulation.
* **Suites not run, for time:** `overflow-scan`, `v55-help`, `v57-search`, `v58`, `v59`, `v61`,
  `v63`, `v64`, `v67`–`v79`, `v76-*`, `v80`–`v83`, `v85`. delta4 ran them green at `a18098b`, and
  this delta touches only four lines of changelog copy, one comment word and one test file — but
  that is an argument, not a measurement.
* **The eight earlier changelog entries' truth.** delta4 read all ten; I re-read only app-v89's,
  since no other entry's text changed. Dates and ordering I did check for all ten.
* **Whether a real person completes the Help recovery journey**, and whether a reader of the
  shortened app-v85 entry actually goes to Settings.
* **Whether `exportRows()` returns rows in seeded order on some future build.** Section 9 zips rows
  to a hardcoded `order` array by index. I verified it holds today (ascending `ts`, per
  `buildExportRows()`'s own `.sort()`), and reasoned that a reversal would red rather than go
  vacuous — I did not mutate the sort to prove it.

---

## IF ONLY ONE THING IS DONE AFTER THIS

**Ship it, then F1.** The release is right: the one thing in this product that speaks to a patient
now says something true, and the thing a clinician reads stops silently dropping a radiation
session's number, a skin reaction's severity and site, and a weight's reason. Holding that over four
instrument weaknesses in a check that did not exist two commits ago would be the wrong trade —
app-v88 is the version doing harm.

But **F1 is three lines and it is the difference between 9.6 being a check and 9.6 being a check
that currently happens to pass.** I made the exact blocker this release was refused for come back,
score 74/74, and watched the precondition written to stop that print `"Oct 31, 2026"` and call it a
title. That is the same shape as the `|| true` this repo has shipped before: not a wrong answer, a
question asked of the wrong thing.
