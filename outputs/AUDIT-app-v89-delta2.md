AUDITED-COMMIT: 3c25aa9
VERDICT: DO NOT SHIP

# Zero Day Audit — ChemoWell app-v89, SECOND DELTA PASS

Auditor: Zero Day Auditor (independent). Follows `outputs/AUDIT-app-v89.md` (refused `c692f8a`)
and `outputs/AUDIT-app-v89-delta.md` (refused `92b95b1`). This pass covers `git diff 92b95b1 3c25aa9`.

Working tree clean and equal to `3c25aa9` (`index.html` md5 `7705c328…`). Every measurement below
was taken against a clean `git archive` export of `3c25aa9` served on **port 9101**, and the
app-v88 comparisons against a clean export of `origin/main` (`8a7d696`, md5 `6c24a321…`) on
**port 9102**. Both ports were confirmed free before binding and both were md5-verified against
their own directories before any result was believed. Ports 8899 and 8940–8944 were still held by
earlier rounds' servers and were deliberately avoided.

Baseline: `test/v89-everything-free.mjs` **62/62**, `test/v75-no-other-patient.mjs` **29/29**.

---

## HEADLINE

**The commit whose message is "The changelog told patients something untrue" shipped literal
markdown into the patient-facing What's New notice, and a suite that already exists in this repo
catches it.** Read rendered at 390px, the new bullet begins:

> Also fixed, found while making the report free: `**radiation sessions and symptoms**` came out of
> the report and the spreadsheet with an empty details column…

`test/v84-whatsnew.mjs` against this build: **100 checks, 98 passed, 2 FAILED** —

```
FAIL  and it contains no literal markdown -- this array is not parsed, it is printed
      |  4 found: "while making the report free: **radiation sessions and sympto"
FAIL  and no entry reachable from the notice carries any either
```

That suite's own comment says why it exists: *"app-v88 SHIPPED `**Log another day**` INTO THIS
NOTICE AND FOUR AUDIT ROUNDS READ PAST IT."* One release later, the same defect, in the same array,
in the bullet written to correct a different defect in the same bullet. The `**` this commit added
is the **only** markdown in the entire `CHANGELOG` array (verified: 2 occurrences, both in this
bullet, zero elsewhere across every historical entry).

**The reason it got through is mechanical and is the finding that outlives the release.**
`release_check.sh` runs `v76-properties-equivalence`, `v76-empty-window-render`,
`v89-everything-free` and `v75-no-other-patient` (lines 824 and 837). **`test/v84-whatsnew.mjs` is
not in the gate**, and all three audit passes on this release listed it under "suites not run". A
guard written for a defect, left outside the gate, caught nothing when the defect recurred.

Second, in the same sentence: **the corrected bullet contains a new false claim of its own.**
*"Doses, temperatures, blood pressures, weights and the daily answers were never affected."*
Measured against the live build, weights **were** affected.

---

## N1–N8, item by item

| Item | Verdict |
|---|---|
| **N1** changelog bullet false | **NOT RESOLVED.** The central correction is right and independently confirmed (see below), but the replacement sentence introduces a new false claim about weights (P2) and the bullet renders literal `**` (P1). |
| **N2** raw weight reason id | **RESOLVED.** Measured: `152 lb (Fluid retention / swelling)` where app-v88 printed `152 lb`. Guard 7c.3 bites. Residual edge case noted below. |
| **N3** fixtures not app-shaped | **MOSTLY RESOLVED.** `dose` added in sections 1 and 7; 7c.1/7c.2 pin radiation and symptom by name. **One fixture is still a shape the app cannot write** — see P7. |
| **N4** B2 guard satisfiable by a mention | **NOT RESOLVED.** Two independent mutants restore blocker B2 in full and score **62/62**. See P4. |
| **N5** B1 guard satisfied by a noun | **RESOLVED.** The alternation now requires an actual "set it up with any name"; the noun "welcome screen" no longer matches. |
| **N6** 5.1b accepts any bullet with "people" | **NOT RESOLVED.** A paid bullet selling a feature, opening with an allowed shape, scores **62/62**. See P5. |
| **N7** `exp-csv` routed via bare "Export" | **RESOLVED.** `exp-csv` step 2 is now "Scroll to **Export data**." Zero occurrences of `**Export**` remain anywhere in the file. |
| **N8** navigation trapped in a conditional step | **RESOLVED.** Read rendered: step 2 now says *"Then, in that same place — menu → Settings, scroll to Export data, then Backup & restore — tap Save backup file…"*. A reader who skips the conditional step 1 still has the route. (The route is now printed twice; wordy, not wrong.) |

### What the N1 correction got right, verified independently

I did not take the builder's line references on trust. I read every writer, checked the history of
each, and then measured a real export of app-v88 against a real export of this build with entries
shaped exactly as those writers produce them (`window.__v86Test.exportRows()`, both ports
md5-verified):

| Entry type | app-v88 (live) | app-v89 | Lost a value? |
|---|---|---|---|
| Temperature | `99.1 °F` | `99.1 °F` | No |
| Blood Pressure | `120/80 mmHg` | `120/80 mmHg` | No |
| Weight (no reason) | `150 lb` | `150 lb` | No |
| **Weight (reason)** | `152 lb` | `152 lb (Fluid retention / swelling)` | **Yes — the reason** |
| Paracentesis | `3.5 L` | `3.5 L drained` | No (number present) |
| Paracentesis (removed) | `Paracentesis removed` | `Removed` | No |
| **Radiation Session** | *(empty)* | `Session 1` | **Yes** |
| Bowel Movement | `Normal` | `Normal` | No |
| Appetite | `Normal` | `Normal` | No |
| **Symptom (nausea)** | *(empty)* | `Moderate` | **Yes** |
| **Symptom (pain)** | *(empty)* | `Severe, site: left side, 3 episodes` | **Yes** |
| Dose (Tylenol) | `500 mg` | `500 mg` | No |
| Dose with pain level | `650 mg, pain 7/10` | `650 mg, pain 7/10` | No |

And the claim holds for historical data too, which nobody had checked: `dose` has been written by
the temperature writer since **app-v1** (`bb6eb76`), by weight/bowel/appetite since app-v1, and by
blood pressure since its introduction in app-v8c (`93b7312`). There is no vintage of stored entry
for those types that lacks a `dose`, so the narrowed claim is not merely true today — it is true of
every record a user could still be holding. **The core of N1 is genuinely fixed.**

---

## BLOCKERS

### P1 — BLOCKER — Literal `**` renders in the What's New notice, and the suite that catches it is not in the gate
**File/line:** `index.html:9320` (CHANGELOG, app-v89, fourth bullet). Gate: `release_check.sh:824`.
**Reproduce.** Set `chemowell-app-seen-version` to `app-v88`, load the app at 390px, read the
"UPDATED / Every feature is free" notice: the asterisks are on screen. Mechanically:
`FALSIFY_BASE=http://127.0.0.1:9101/index.html node test/v84-whatsnew.mjs` → **98/100, 2 failed**,
both naming this string. The changelog is not parsed for markdown; `HELP_TOPICS` is. 2 occurrences
of `**` exist in the whole CHANGELOG array and both are in this bullet.
**Why it matters to a caregiver.** This notice is the one surface in the product that speaks
directly to the patient, and it is being shown precisely because the last bullet in it was wrong.
A patient opening an update and reading `**radiation sessions and symptoms**` is reading a rough
draft of an apology about their medical records.
**Fix.** Delete the two `**` pairs (the notice has no emphasis anywhere else), **and add
`test/v84-whatsnew.mjs` to the suite loop in `release_check.sh`.** The second half is the real fix:
the guard was written one release ago for this exact defect and has been outside the gate ever
since, which is why three consecutive audit passes recorded it as "not run".

### P2 — BLOCKER — The corrected bullet asserts "weights … were never affected". They were.
**File/line:** `index.html:9320`.
**Measured** (clean v88 export vs clean HEAD export, entries written as `index.html:3242–3246`
writes them):

```
app-v88 (live)  Weight | DETAIL = "152 lb"
app-v89 (fixed) Weight | DETAIL = "152 lb (Fluid retention / swelling)"
```

A weight entry carrying a reason — the select at `index.html:5738`, available to every user — lost
that reason from the printable report and the CSV for the whole v86–v88 window. The app's own
Reports screen shows it (`index.html:12592`), so the export and the screen disagreed.
**Why it matters to a caregiver.** It is the same failure mode N1 blocked on, pointing the other
way: an absolute statement about what did and did not happen to the patient's records, made in the
one voice that reaches the patient, that measurement contradicts. "Fluid retention / swelling" next
to a weight is not decoration in an oncology population, and a caregiver told weights were never
affected will not re-send the printout that dropped it. The previous audit's recommended wording
named this explicitly (*"Weight entries left out the reason, and drains left out the word
'drained'"*); it was dropped on the way into the file.
**Fix (one clause).** Remove "weights" from the never-affected list and say what happened:
*"…were never affected. Weight entries left out the reason you noted beside the number, and that is
back too."*

### P3 — BLOCKER (record, not screen) — The corrected code comment still describes a second direction the defect never had
**File/line:** `index.html:10606–10607`.

> `* An entry that WAS superseded skipped the else, so an ordinary corrected dose printed only
> "(corrected later -- superseded)" with no dose in front of it.`

**This is false twice.** `SUPERSEDABLE_MED_IDS = new Set(['bowel_movement', 'appetite'])`
(`index.html:11915`) — **a dose can never be superseded**, so "an ordinary corrected dose" does not
exist. And for the two types that can be, I measured it rather than reasoning about it:

```
                      app-v88 (live)                               app-v89
Bowel Movement   "Normal (corrected later — superseded)"   "Normal (corrected later — superseded)"
Appetite         "Normal (corrected later — superseded)"   "Normal (corrected later — superseded)"
```

Identical. Nothing was ever lost on that branch.
**Why it matters.** N1 was a blocker because a statement about the defect's blast radius was wrong.
This commit corrected the vitals half of that statement, in the same paragraph, and left the other
half standing — and the commit message and `outputs/` carry it forward as the permanent record the
next session will build on. The whole lesson of N3 was that an overstatement travels from one
artefact into the next; it has travelled again. It is a code comment rather than a patient-facing
string, which is why it is listed third, but it is the same defect class the pass was convened for.
**Fix.** Delete the bullet, or rewrite it to what is true: the superseded branch was the one branch
that still worked, which is also why the correction suites never caught the defect.

---

## MAJOR

### P4 — MAJOR — N4 is not resolved: blocker B2 walks back in twice, suite 62/62 both times
**File/line:** `test/v89-everything-free.mjs:492–507`.
The check builds `parts = [lost.q].concat(body.split(' \n '))` and takes `findIndex`. `body` is
`[a, ...steps, note, ...branches]` (`index.html:13628`). **`parts[0]` is the question and `parts[1]`
is the answer line — neither is a step** — so an imperative planted in either is earlier than every
step, unconditionally.

**Mutant m2** (port 9112, md5 `0e64c754…`, verified served): imperative appended to the question,
real password instruction moved to the last step. **62/62, 0 failed.**

**Mutant m4** (port 9114, md5 `a1101710…`, verified served) — the realistic one, and it renders
clean with no markdown artefacts. The caveat goes into the answer line; the numbered steps become:

```
1  Menu → Settings, scroll to Export data, then Backup & restore.
2  … tap Save backup file …
3  Your phone's share screen opens. Send it to yourself, or put it in Drive or Files …
5  Last of all, go back and turn on Protect the file with a password if you already sent the
   file somewhere.
```

**62/62, 0 failed.** Captured rendered, not from source. This is blocker B2 in full — the reader
emails a complete unencrypted medical record and is told afterwards to encrypt it — and the guard
rewritten specifically to hold B2 shut does not hold it shut.
**Fix.** Drop `lost.q` and the answer from `parts`, or better, assert on the rendered `<ol>`: the
first `<li>` must contain both the control name and the imperative. The check's own comment says
*"the part index of the imperative"* — it needs to be the index of the **step**, which means
measuring the steps array and nothing else.

### P5 — MAJOR — N6 is not resolved: an allow-list that only pins the opener
**File/line:** `test/v89-everything-free.mjs:357`.
`PAID_BULLET = /^(up to \d+ people\b|as many people as you need\b|each person\b|every feature\b|for a family\b)/i`
is a literal transcription of the openers of the six bullets currently on the sheet, and it is
anchored only at the start.

**Mutant m1** (port 9111, md5 `15002175…`, verified served): one bullet added to the Plus card —
**"Each person also gets priority email help, plus early access to new screens"**. Opens with an
allowed shape; "help" and "early access" are not in 5.1's `FEATURE_WORDS`; no future tense for 5.3.
**62/62, 0 failed**, with a support tier being sold on a paid card.
**On the other question asked of it — is it too brittle?** Yes, and in the ordinary direction:
"Track up to 3 people", "Three people, kept separate", "Up to 3 profiles" and "Everything included,
for all three" are all reasonable future copy and all fail. Brittle *and* bypassable is the worst
pair, because the maintenance cost trains people to widen it.
**Fix.** Assert the predicate instead of the opener: require every paid bullet to contain a person
count or the phrase "every feature", **and** re-run 5.1's deny-list over the bullets individually
rather than over the sheet blob, so a feature word anywhere in a bullet is caught wherever it sits.

### P6 — MAJOR — The half of the fix the changelog advertises is unguarded
**File/line:** `index.html:10566`; `test/v89-everything-free.mjs:583`.
The bullet promises *"the severity **or body site** missing from a symptom"* is fixed. 7c.2 asserts
only `detailOf('nausea') === 'Moderate'`, and the fixture carries severity alone.

**Mutant m3** (port 9113, md5 `04fb19e6…`, verified served): the symptom branch reduced to
`if (e.severity) bits.push(e.severity)` — body site and episode count dropped from every exported
symptom row. **62/62, 0 failed.** A caregiver who logs "Pain, severe, left side, 3 episodes" hands
a clinician "Severe", and nothing in the release notices.
**Fix.** Give the symptom fixture a `site` and a `freq` and assert the whole string
(`'Severe, site: left side, 3 episodes'`), the way 7.2–7.4 do for the vitals.

---

## MINOR

* **P7 — N3 is not quite finished.** `test/v89-everything-free.mjs:547` still seeds
  `{ medId: 'appetite', value: 'good', dose: 'Good' }`. `APPETITE_LABELS` is
  `{ normal, little, none }` (`index.html:3915`) — **there is no `good`**, so the app cannot write
  this entry, which is exactly the defect N3 named. It happens not to change any verdict (a real
  appetite row reads `Normal` on both builds, which I measured), but the lesson N3 was written to
  teach is only half-applied: adding a field the app writes does not make a fixture app-shaped if
  the value is one the app cannot produce.
* **`weightReasonLabel()` returns the raw id for an unknown reason.** `index.html:4012` falls
  through to `return id`. I measured `weightReason: 'made_up_id'` → `154 lb (made_up_id)` in the
  clinician's report. All seven `WEIGHT_REASONS` and the legacy `paracentesis` id resolve correctly,
  and no writer produces anything else today, so this is latent rather than live — but 7c.3's
  `!/_/.test(w)` would also miss any future slug without an underscore.
* `exp-printable`'s answer line still reads *"The Printable report, in the Export section"*
  (`index.html:4183`) while the heading is **Export data**. Prose, not a route, so it is not N7 —
  but it is the last survivor of M3's vocabulary.
* `priv-lost-phone` step 2 now prints the full route a second time, verbatim. N8 is closed by it;
  it reads heavily on a panic path.
* Carried over, unchanged: the `note`'s em-dash weld of two unrelated paragraphs; the two different
  routes to one screen in steps 1 and 4; the `profiles` category blurb (`index.html:4074`); the
  one-child `inline-flex` on the Printable report button (`index.html:10974`).
* `release_check.sh` **still stops early** (exit 1, "the quality chain has not run for app-v89"),
  so the delete ratchet, the 16px floor and the README-row check did not run on this release and
  remain unevaluated. Logged previously as M25; stated again rather than assumed green.

---

## CHECKED AND CLEAN

* **`buildExportRows()` has no regression from the `weightReasonLabel()` change.** Driven with one
  entry of every shape the chain has an arm for, plus `cycle_start`, `inpatient_start`, a cancelled
  paracentesis, a weight with no reason, a weight with an unknown reason, a legacy
  `weightReason: 'paracentesis'` + `litersDrained` pair (which the v-21 migration correctly turns
  into a standalone paracentesis record), a dose with a `painLevel`, and superseded bowel and
  appetite pairs. Nineteen rows, both consumers (the CSV path and `openPrintReport()` share this
  function), zero page errors on either build. **No row is worse under this build than under v88.**
* **Every line number in the corrected code comment is right.** 3205 temp, 3086 BP, 3242 weight,
  3228 paracentesis, 3845 bowel, 3939 appetite, 3329/3488 radiation, 4215 symptom — each read and
  confirmed. (Its *prose* is wrong in one place; see P3.)
* **"Since October 24th" is right.** app-v86's changelog date is `Oct 24, 2026`
  (`index.html:9338`) and `0f73911` landed 2026-10-25 01:20 UTC — Oct 24 evening in US time.
* **The bullet's advice now matches what a reader should do**, and the two earlier Voice defects in
  it are gone: "A bigger one" with no antecedent, and "WHEN" shouted in capitals.
* **N5, N7, N8 verified as fixed, read rendered.** `priv-lost-phone` opened through the real Help
  search on a real first-run profile: five numbered steps in the right order, zero literal `**` or
  backticks, no horizontal overflow. Zero `**Export**` anywhere in the file.
* **The What's New notice fits at 320, 360 and 390px** — `scrollWidth === clientWidth` at all three.
  The previous pass flagged the lengthened bullet as unmeasured at 320; it is measured now.
* **Rule 0.** `test/v75-no-other-patient.mjs` **29/29**. No patient name; pronoun ratchet 32 found /
  32 allowed, so the new comments add none; no care-plan dose, ceiling or schedule; the diff adds no
  behaviour keyed to a medication id.
* **Release mechanics.** `APP_VERSION = 'app-v89'` (`index.html:9307`) and
  `CACHE = 'chemowell-app-v89-1'` (`sw.js:1`) moved together. No `h()` null-attribute trap. No
  uncaught page errors in any run, on any of the six trees served.
* **Instrument hygiene.** Every server md5-verified against its own directory before use; ports
  9101/9102/9111–9114 confirmed free before binding, all above the 8890–8950 band earlier rounds
  left occupied. No tracked file was modified by this audit other than this report; no `git add`,
  `checkout`, `reset` or `stash` was run.

---

## NOT CHECKED — stated so nobody assumes otherwise

* **iOS / Safari rendering.** Chromium only in this sandbox. Standing exemption.
* **The native Capacitor share path**, and real purchases (`TEST_MODE` simulated).
* **`sync-backend/`, `capacitor.config.ts`, `package.json`, `.github/workflows/`**, and `sw.js`
  beyond the `CACHE` constant.
* **Everything in `release_check.sh` after its early stop** — delete ratchet, 16px floor, README row.
* **The builder's own five mutants in `3c25aa9`** — not re-run. I wrote four of my own instead
  (m1–m4); **all four survived.**
* Suites not run, for time: `v76-*` (run by the gate), `v55-help`, `v57-search`, `v61-backup`,
  `v63-encrypted-backup`, `overflow-scan`, `v79`–`v88`. `v84-whatsnew` WAS run — see P1.
* A full re-measure of the three pre-existing 320px Home overflows.
* Whether a real person completes the recovery journey, and how long it takes them.

---

## IF ONLY ONE THING IS FIXED

**P1 — and the one-line gate change that comes with it.** Delete the two `**` pairs from the
changelog bullet and add `test/v84-whatsnew.mjs` to `release_check.sh`'s suite loop. The asterisks
are what every user sees; the missing suite is why they are there. A guard that was written for this
exact defect one release ago, and then left outside the gate, is the same failure as the Enhancer
list filed in `outputs/` — output that lands somewhere nobody looks is not output.

**Fix P2 in the same edit.** It is twelve words in the same sentence, and leaving it is the third
consecutive release in which this bullet tells a patient something about their records that is not
true.
