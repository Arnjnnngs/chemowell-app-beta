AUDITED-COMMIT: 217cba0
VERDICT: DO NOT SHIP

# Zero Day Audit — app-v81, round 5 (delta: `217cba0` over `df600c9`)

## The headline, in plain words

**The fix for BLOCK 2 turns off daily pill limits that are already working. Measured on this build:
a medication saved under app-v80 whose dose reads `5/325 mg`, with a daily ceiling of 4 tablets
armed, comes through this release's migration with the pill count DELETED FROM DISK and the ceiling
left in place. Eight doses logged one after another. The app blocked none of them, showed no
warning, and the card read "✓Available" the whole way. The same medication with the dose written
`1 tablet` blocks correctly on the fifth.**

Round 4 blocked this release because `5/325 mg` counted five tablets and locked the card before
breakfast. That was the wrong number in the SAFE direction — it refused a dose. This round replaces
it with no number at all, which is the wrong number in the UNSAFE direction: the ceiling the
caregiver configured silently stops counting and never fires again. Nothing on any screen says so.

The commit says the trade is covered: *"a pill ceiling correctly refuses to arm and the editor's
existing amber line says why."* **Both halves are false for a medication that already exists.** The
gate it names (`dosageOptionsCarryLimitUnit`) lives only in the medication editor and only affects a
limit being typed; `ceiling`, `ceilingMax` and `ceilingUnit` already on disk are untouched by the
migration. And with a mixed dose list — `1 tablet`, `2 tablets`, `5/325 mg`, which is how a real
Percocet card is set up — the amber line cannot appear at all, because `.some(d => d.pills > 0)` is
satisfied by the other two, while every `5/325 mg` dose logged from that same card counts zero.

**The rest of the round is good work and I could not break it.** The temporal-dead-zone fix is
complete and I proved it mechanically rather than by reading; "Bring back" is genuinely migrated;
the suite's list-wide check is not vacuous; the notice copy is fixed; `test/v81-dose-parser.mjs` is
110/110 and `test/v75-no-other-patient.mjs` 27/27 against a clean tree.

---

## BLOCK 1 — an armed daily pill ceiling is silently disarmed by the migration *(HIGH)*

### What the code does

`migrateDoseLabels` (index.html 1276-1277) re-parses every stored dose label and then:

    const fixed = { ...dose, label: again[0].label, mg: again[0].mg };
    if (again[0].pills === undefined) delete fixed.pills; else fixed.pills = again[0].pills;

`parseDoseOptions` (6744) now refuses to set `pills` whenever `UNEVALUATED_RATIO` matches. So for any
label carrying a slash between two digits — every combination strength — the migration **deletes**
`pills` from the medication's stored configuration. It does not touch `ceiling`, `ceilingMax` or
`ceilingUnit`.

Everything downstream that enforces a pill/application ceiling reads `pills`:

* `dailyPills` (1723) — `reduce((s, e) => s + (e.pills || 0), 0)`
* the entry writer (2658) — `if (m.dose && m.dose.pills) entry.pills = m.dose.pills;`
* `doseBlocked` (5915) — `const amt = med.ceilingUnit ? (d.pills || 0) : (d.mg || 0); return amt > 0 && amt > (dc.max - dc.used);`

With `pills` absent the dose's amount is 0, `amt > 0` is false, `dailyPills` stays at 0 forever, and
`dailyCeiling().used` never moves off zero.

### Measured on the real screen, this build

Seeded exactly as an app-v80 device stores it — `version: 2`, no `doseSchemaV`, one dose
`{ label: '5/325 mg', mg: 325, pills: 5 }`, `ceiling: true, ceilingMax: 4, ceilingUnit: 'tablets'`.
Loaded the page, dismissed the browser notice, then tapped the dose and confirmed the time, six
times in a row.

    disk after migration   [{"label":"5/325 mg","mg":325}]        <-- pills: 5 is GONE
    tap 1 -> entries=1   Percocet | ✓Available | Last taken ... | 5/325 mg
    tap 2 -> entries=2   Percocet | ✓Available | ...
    tap 3 -> entries=3   Percocet | ✓Available | ...
    tap 4 -> entries=4   Percocet | ✓Available | ...
    tap 5 -> entries=5   Percocet | ✓Available | ...
    tap 6 -> entries=6   Percocet | ✓Available | ...
    entries written      [{mg:325},{mg:325},{mg:325},{mg:325},{mg:325},{mg:325}]   no pills on any

The control, identical in every other respect, dose written `1 tablet`:

    tap 4 -> entries=4   Percocet | Limit | Next dose tomorrow after midnight
    tap 5 -> entries=4   "Daily limit of 4 tablets reached. Log more anyway?"  [Log 1 tablet now] [Cancel]
    tap 6 -> RED BANNER  "Percocet daily limit exceeded — Today's Percocet total is 5 tablets,
                          above the 4 tablets daily limit these share. Check with the care team
                          before logging more."
    entries written      5, the last one stamped overrideReason: "overLimit"

Same ceiling, same medication, same taps. One enforces; one does not.

### The mixed list, where the editor's warning cannot save it either

Doses `1 tablet`, `2 tablets`, `5/325 mg`; ceiling 4 tablets. After migration the disk holds
`[{1 tablet, pills:1},{2 tablets, pills:2},{5/325 mg}]`. Eight consecutive `5/325 mg` doses:

    tap 1..8  entries=1..8   Percocet | ✓Available   (never once "Limit")

`dosageOptionsCarryLimitUnit` returns true here, so the Daily-limit field is unlocked and the amber
line the commit relies on never renders. The caregiver sees a limit that is set, displayed in the
editor, and enforced against nothing.

### Why this is worse than what it replaced

Round 4's defect refused a dose the caregiver was entitled to give. This one permits every dose
past a ceiling she deliberately set, and does it by **editing her stored configuration** — the one
thing the write model is supposed to enumerate. A backup taken after the upgrade carries the
stripped dose forward, so there is no going back to the old numbers.

### The fix — and the obvious one is WRONG, which I measured rather than assumed *(M)*

The parser is right not to invent a count. The migration is wrong to delete a count a caregiver's
ceiling is already relying on, silently. The tempting one-line fix is to stop deleting:

    if (again[0].pills !== undefined) fixed.pills = again[0].pills;   // leave a stored count alone

**I applied exactly that to a copy of the shipping page, served it, and re-ran the same probe. It
does not ship.** The check moves — which is the falsification, and it proves the measurement can go
red — but it moves back to round 4's defect:

    disk after migration   [{"label":"5/325 mg","mg":325,"pills":5}]
    HOME, NOTHING LOGGED   "5/325 mg . over limit"
    tap 1                  "This would go over today's 4 tablets limit. Log it anyway?"   entries=0

That is verbatim the screen round 4 refused this release for. The control medication (`1 tablet`) is
unaffected by the edit and still blocks correctly on the fifth dose, so the difference is the ratio
dose and not the patch.

So the two behaviours are in genuine tension and there is no one-liner: **counting five locks a card
that should be open; counting nothing opens a ceiling that should hold.**

**The fix that resolves both is the half this release left out: delete the count AND tell the
caregiver on the card.** A medication with `ceilingUnit` set and no dose carrying `pills` has a limit
that cannot be applied, and Home is where she gives the dose. The sentence already exists —
`dailyLimitPreview`'s amber line, *"Dosage options don't include a pill count yet"* — it just never
leaves the editor. Route it to the medication card and the Meds row and the commit's own claim
becomes true: the app counts nothing, exactly as for `as directed`, and the caregiver is not the last
to know.

**`dosageOptionsCarryLimitUnit` is the wrong gate for this** either way: it answers a question about
the editor's form, and the defect lives in a medication nobody is editing. The class check is: *for
every medication the app is holding, if a limit is armed in a unit, at least one dose must carry that
unit — and if not, the caregiver is told, on the screen where she gives the dose.* A suite row for
that goes red on this commit AND on the one-line patch above, which is the property a check of this
class needs.

### Name the seat

**The builder's write model (Rule 1.5).** It is required to state *"what this release deletes (the
answer is nothing)"*. This release contains a literal `delete fixed.pills` that runs unconditionally
over every saved medication on every device, and the write model did not name it. Round 4 named the
same seat for the same reason — the door it missed was a write it had not enumerated.

---

## 2 — the temporal dead zone: checked mechanically, and it is CLEAN *(no finding — recorded so it is not re-audited)*

Brief item 3, the highest-value item, and the answer is that the fix is complete.

I built the call closure of `loadMedicationConfig()` from the source — every function it calls, plus
every function passed to it as a bare callback reference (`.map(migrateDoseLabels)`), with comments
stripped so a function named in prose is not mistaken for a call, and with the deferred
`setTimeout(...persistMedicationConfig...)` excluded because it runs after init by design.

    closure: backfillDefaultMedFlags, clampTreatmentDays, deepCopyMeds, defaultMedicationConfig,
             doseFractionValue, loadMedicationConfig, mergeMissingDefaultMeds, migrateDoseLabels,
             migrateLegacyMedRules, migrateSenokotV37, normChemoBlock, normChemoRelativeWindows,
             normHomeCard, normInteractions, normLinkedTo, normaliseDoseNumber,
             normalizeArchivedMeds, normalizeMedication, normalizePausePeriods, parseDoseOptions,
             safeMedicationId, splitDoseOptions, treatmentDaysMax

Cross-referenced against every module-scoped `const`/`let`/`var` in the file, comparing declaration
line against line 1615 (`const initialMedicationConfig = loadMedicationConfig();`):

    module-scoped bindings declared AFTER 1615 and read anywhere in that closure:
      state (1628) — read ONLY inside loadMedicationConfig's setTimeout callback, which is
                     deferred deliberately and carries its own comment saying why.
    nothing else.

Everything the parser reads is now at 1237-1262, well above 1615. `TREATMENT_DAYS_MAX` — the prior
instance the new comment cites — is a hoisted `function treatmentDaysMax()`, not a binding, and the
comment at 1926 is accurate about that.

**The new comment's claim is true**: *"Function declarations hoist completely, so the parser itself
can stay where it reads best."* Every function in the closure above is a `function` declaration; not
one is a `const` arrow. I checked, rather than assuming.

**Worth adding as a permanent guard, and this is a recommendation, not a block.** The same defect has
now shipped once and been reintroduced once, and both times it was found by a runtime symptom. The
analysis above is thirty lines of script and runs in under a second with no browser. A suite row
that rebuilds this closure and fails if any module binding declared below line 1615 appears in it
would make the class un-reintroducible. `harness/` is the right home for it.

---

## 3 — the `UNEVALUATED_RATIO` guard, attacked *(one advisory, no block beyond BLOCK 1)*

Every shape the brief named, measured through the shipping parser (`window.__doseTest`), not reasoned
about:

| typed | label | mg | pills | verdict |
|---|---|---|---|---|
| `1/2 tablet twice a day` | kept | 0 | 0.5 | correct |
| `take 1/2` | kept | 0 | 0.5 | correct |
| `1/2 tab (250 mg)` | kept | 250 | 0.5 | correct |
| `1 1/2 tablets` | kept | 0 | 1.5 | correct — the mixed-number pass clears the slash before the test |
| `1/2, 1 tablet` | two options | 0 / 0 | 0.5 / 1 | correct |
| `2 tablets 3/4 of the way` | kept | 0 | 2 | correct |
| `1 tablet 1/2 of the time` | kept | 0 | 1 | correct |
| `3/4 tablet`, `1/3`, `1/8` | kept | 0 | 0.75 / 0.333… / 0.125 | correct |
| `5/325 mg`, `10/325 mg`, `875/125 mg`, `300/30/10`, `0.5/1 mg` | kept | 325/325/125/0/1 | **none** | intended — see BLOCK 1 for the consequence |
| `1/10 tablet`, `1/16 tablet` | kept | 0 | **none** | intended, and the ten-times bug is closed |
| `50/50 cream` | kept | 0 | none | no count — right, it is a ratio |
| `1/2/26` (a date typed by mistake) | kept | 0 | none | no count — right |
| `5 mg/mL`, `100 mg/m2`, `25 mg/5 mL` | kept | 5 / 100 / 25 | 5 / 100 / 25 | unchanged, as claimed: no digit immediately before the slash |
| `1:1000` | kept | 0 | 1 | unchanged from before |
| `q6h` | kept | 0 | 6 | pre-existing; nobody types a frequency in a dose box |

**No legitimate dose string loses a count it should keep.** I could not construct one. The guard is
correctly written and `5 mg/mL` really is untouched.

**The reverse direction — a string that SHOULD lose its count and does not:** `25 mg/5 mL` counts 25
"pills", and `100 mg/m2` counts 100. Those are concentrations and body-surface doses, not counts,
and the slash rule does not reach them because the character before the slash is a letter. This is
pre-existing and unchanged by this diff, so it is not a block — but it is the same defect class
BLOCK 2 was raised for, one character away, and the denominator exemption comment should say so.

**The denominator exemption is now written down** (1249-1255) and reads accurately, including the
pairing with `UNEVALUATED_RATIO`. Round 4's finding 3 is closed. The suite does not carry a rejected
denominator with its measured value — `1/10 tablet` is asserted, `1/16` is not — which is a
one-row gap, not a finding.

---

## 4 — the third door: every path that writes a medication, walked *(no block; one fragility)*

Brief item 1. Every writer of `persistMedicationConfig` or of the `-med-v1` key:

| door | line | migrated? | how |
|---|---|---|---|
| module init / full load | 1589 | yes | the `.map(migrateDoseLabels)` chain |
| **Bring back (restore from archive)** | 7100-7101, 7141 | **yes — fixed this round** | `migrateDoseLabels(normalizeMedication(...))` on both branches, including the no-config branch |
| medication editor save (add / edit) | 7008 | yes by construction | the form is parsed through `parseDoseOptions` on save |
| reorder / placement change | 7040, 7060 | n/a | writes medications already in `state.meds` |
| delete (archive) | 7172 | n/a | removes from the list |
| treatment-type change | 3079 | n/a | writes `state.meds` |
| **backup RESTORE** (`cwBkApplyTo`) | **549** | **yes, but only by accident of a reload** | writes `{version: 1, meds: incomingMeds}` straight to localStorage with no migration, then both callers (327, 348) `setTimeout(() => location.reload(), …)`, and the next `loadMedicationConfig` migrates |
| new profile | 564 | n/a | no medication list is written |
| demo / seed | — | n/a | `DEFAULT_MEDS` is `[]`; `mergeMissingDefaultMeds` returns its input |
| sync | — | n/a | `SYNC_API_BASE` is empty; no medication write path exists yet |

**The backup restore is the one to watch.** It is correct today for a reason that is not in the
code: it writes unmigrated medications to disk and relies on a `location.reload()` two functions
away to fix them. Remove or defer that reload — a perfectly ordinary refactor — and the third door
opens with exactly the symptom BLOCK 1 of round 4 described. One line (`.map(migrateDoseLabels)` on
`incomingMeds` at 549) would make it true by construction rather than by timing. **Advisory, not a
block**, because I measured the reload and it happens on both paths.

**The suite's DOOR 2 comment over-claims.** *"Every medication the app is holding must carry the
stamp, however it got there"* — the check reads the disk after DOOR 1 only, so it measures the
medications the suite itself put there. It is genuinely not vacuous (it reads before any reload, and
it asserts `total >= 1` so an empty list cannot pass), and it would catch a regression in the door it
walks. It cannot see a door nobody walks. That is the fifth comment in this release describing a
property the code does not have; the honest sentence is *"the medication this test restored carries
the stamp, and the list it landed on has no unmigrated medication on it."*

---

## 5 — the migration itself, on the restore path *(no finding)*

Brief item 4. `restoreMedicationConfig` has no try/catch, so a throw inside `migrateDoseLabels` would
kill "Bring back". Walked it:

* `migrateDoseLabels` guards `!med`, a non-array `doses`, an empty `doses`, a null element, and
  `dose.label == null`, then `String(dose.label)` before parsing — so an object, a number or a
  boolean label cannot throw.
* `parseDoseOptions` → `splitDoseOptions` → `normaliseDoseNumber` → `doseFractionValue`: all pure
  string/number work, `doseFractionValue` returns null on a zero denominator (asserted in the suite,
  and `1/0 tablet` measured above).
* the archive's `entry.config` is deep-copied through `JSON.parse(JSON.stringify(...))` first, so a
  cyclic object cannot reach it.

I could not make it throw. The order is also right: `normalizeMedication` runs first, so the
migration sees a sanitised medication, matching the load path exactly.

---

## 6 — the suite, assumed to be lying *(one MEDIUM, one advisory)*

**110/110 green against a clean tree**, re-run here (~40 s). `test/v75-no-other-patient.mjs` 27/27,
all three ratchets at 0/0/0.

* **The `canSeed` restructuring is clean.** `3e` is `if (!KEY) { t(…, false) } else { … }` — a
  missing key records a FAILURE, not a skip, so the section cannot go quiet. `total >= 1` inside the
  class check closes the "green loudest when nothing happened" hole its own comment names. Both are
  right.
* **The `{threw}` wrapper is NOT applied everywhere `parse()` is called.** `arr()` unwraps it in
  section 2 and 3; sections 3b and 4 call `parse()` and index the result directly. Today the parser
  does not throw, so nothing bites — but the wrapper exists precisely because a broken parser once
  crashed the suite instead of reporting, and two sections still have the old shape. *MEDIUM-LOW,
  and it is a one-line change in each.*
* **The suite has no case for BLOCK 1**, and could not have caught it: every check about a limit
  uses a medication the suite itself creates through the editor, which never had a stored `pills`
  to lose. The missing case is the upgrade: seed an app-v80 medication with a ratio dose and an
  armed ceiling, load, log past the ceiling, assert the app blocks.

---

## 7 — the Voice *(MEDIUM-LOW)*

The notice now reads:

> **Will be saved as:** 0.5 mg
> A leading zero is added and a trailing zero removed, because .5 and 1.0 are the two amounts most
> often read wrong. Change the box above if this is not what you meant.

**"so they cannot be misread" is gone, and that was the right call.** What replaced it is honest
about mechanism: I fired the notice on `.5 mg` and `1.0 mg` and it fires on nothing else in the
table (measured: fraction, combination strength, thousands separator, two ordinary strengths and an
empty box are all silent), so the sentence matches the behaviour in every case it appears.

**"the two amounts most often read wrong" is still a superlative nobody has measured.** ISMP lists
naked decimals and trailing zeros as error-prone designations; it does not rank them first and
second, and this app has no data of its own. *"because a naked decimal point and a trailing zero are
both easy to misread"* says the same useful thing and claims only what is known. One-line edit.

At 2am the line reads fine — plain words, no jargon, names the control directly above it.

---

## 8 — `release_check.sh` *(correct)*

    $ bash release_check.sh ; echo $?
    ❌ RELEASE CHECK FAILED: the quality chain has not run for app-v81.
       missing: an outputs/PM*app-v81*.md sign-off
       AND a report on record REFUSES this release: AUDIT-app-v81.md, -round2, -round3, -round4
    1

**That is the right answer given `outputs/`.** Four standing DO-NOT-SHIP reports and no PM sign-off;
this report makes five. The baseline notice (app-v80, 6 commits since) is accurate.

---

## 9 — Rule 0, product neutrality *(clean)*

`test/v75-no-other-patient.mjs` 27/27. Nothing in this diff adds a patient name, a gendered pronoun,
a care-plan dose or ceiling, or a branch keyed to a medication id. The new constants and comments are
product-neutral; `Percocet`, `oxycodone/paracetamol` and `5/325 mg` appear only as generic examples
of a written form, not as anyone's regimen.

---

## 10 — the README row *(one omission, numbers check out)*

Verified against reality: **110 checks** (measured, 110/110), **25 mutants across three rounds** (the
count matches `outputs/FALSIFY-app-v81-round{4,5,6}.txt`), `sw.js` CACHE is
`chemowell-app-v81-2` and `APP_VERSION` is `app-v81`. As in round 4, **"full battery 407/407 across
twelve suites" and "app-v81 plus four harness scripts rebuild index.html byte for byte" are outside
this diff's reach in the time available and I am not asserting them either way.**

**What the row omits is BLOCK 1.** It says *"anything else keeps its text and the app counts nothing
rather than inventing a number"* and *"MEDICATIONS ALREADY SAVED ARE MIGRATED"* — both true, and
together they describe, without saying so, a daily limit that stops working on a medication a
caregiver set up months ago. Rule 5.5: an exemption nobody wrote down is indistinguishable from an
oversight. If the behaviour is kept as-is, that sentence has to be in the row and in the release
message, in plain words.

---

## What it would take to turn this into SHIP

1. **BLOCK 1** — a limit armed in a unit that no dose carries has to be visible to the caregiver on
   the card, not only in the editor she is not on. Simply keeping the old count instead is measured
   above and reproduces round 4's defect, so it is not the answer. Add the suite case for the CLASS,
   written so it goes red on this commit and on that patch: for every medication the app holds, an
   armed limit whose unit no dose carries must surface on Home.
2. **Finding 4** — `.map(migrateDoseLabels)` on `incomingMeds` in `cwBkApplyTo` (549), so the backup
   restore is correct by construction instead of by the timing of a reload two functions away.
3. **Finding 4** — correct the suite's DOOR 2 comment to what it measures.
4. **Finding 6** — apply the `{threw}` wrapper in 3b and 4, the two sections that still index
   `parse()` directly.
5. **Finding 7** — drop the unmeasured superlative from the notice.
6. **Finding 10** — put the disarmed-ceiling behaviour in the README row and the release message if
   it is kept.
7. **Finding 2 (recommended, not required)** — add the module-binding-order check to `harness/` so
   the temporal dead zone cannot be reintroduced a third time.

1 is the release. 2-6 should ride with it.

Chromium only; an iPhone's rendering cannot be reproduced in this sandbox and stays exempt.
