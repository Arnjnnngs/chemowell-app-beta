# RESEARCH — dose units

Seat: RESEARCH (`TEAM-ORDER.md` §1). Run 2026-09-14. Written after reading `index.html`, running the
app's own parser against real dose strings, and searching the public safety literature.

**I did not change `index.html`, `sw.js` or anything under `test/`. This file is the only thing I wrote.**

---

## 1 · THE HEADLINE, in plain words

Aaron is right that three units is not the medical world. **But the dropdown is the smaller half of
the problem, and I found the bigger half by running the app's own code.**

**Four things, in order of how much they matter:**

**(a) The app already mis-records a dose today, by a factor of ten.** If a caregiver types the
dosage option `.5 mg` — half a milligram — the app stores it as **5 mg**. I ran the app's real
`parseDoseOptions` function to check this; it is not a guess. The label printed on screen still
says `.5 mg`, so the number on the card and the number being counted toward the daily limit
disagree by 10x and nothing says so. This is the single most-warned-about writing mistake in
medication safety — the "naked decimal" — and the app currently agrees with the misreading instead
of catching it. **This is a defect in the shipping build, not a missing feature.**

**(b) A comma-grouped number silently becomes two medications' worth of nonsense.** Dosage options
is a comma-separated field. Typing `5,000 units` — the normal way an insulin or heparin dose is
written — produces two dose options: `5` and `000 units`. Neither is the dose.

**(c) Anything that is not milligrams is recorded as a number of "pills."** `500 mcg` is stored as
500 pills. `2.5 mL` is stored as 2.5 pills. `20 mEq` is stored as 20 pills. `2 puffs` is stored as
2 pills. The count is right; the word is wrong, and the word is what a caregiver reads back and what
a printed report shows a clinician.

**(d) The app can already display any unit word you like — the input side just never offers them.**
The Home card code has a whole singulariser measured across 42 real unit words (`patches` → `patch`,
`lozenges` → `lozenge`, and it deliberately leaves `bolus` alone). The test suite exercises
`lozenges`, `patches`, `caps`, `tablets` and `bolus`. **The display layer is already more capable
than the editor.** Widening the list is mostly unlocking something that is already built and tested.

**What it costs a caregiver right now.** They cannot set a daily limit on an inhaler, an insulin pen,
eye drops, a liquid, or anything measured in micrograms — because Daily limit stays locked until the
dosage text carries the unit she picked, and the only units she can pick are mg, pills and
applications. The app's own help text already admits this: *"The list is currently only those three.
More units (mcg, mL, puffs, drops, and others) are planned."* That sentence has been shipping as a
promise.

**And one more, found while checking:** the app has a complete millilitre pathway — per-dose volume,
a millilitre daily cap, a Home card that counts mL, and two passing test suites — **that no user can
ever reach.** See §5.

---

## 2 · VERIFYING THE BRIEF

Everything I was told to check, checked against the file.

| Claim in the brief | Verdict | Where |
|---|---|---|
| Dosage options is free text; `parseDoseOptions` takes `\d+ mg` else a leading number | **Correct** | `index.html:6538` |
| Limit unit is a `<select>` with exactly `mg` / `pills` / `applications` | **Correct** | `index.html:7146` |
| A logged entry stores only `mg`, `pills`, `volumeMl` | **Nearly correct, and the difference matters** | `index.html:2571-2573` |
| `homeCard.kind` accepts only `['mg','pills','ml']` | **Correct** | `normHomeCard`, `index.html:1142`; `medHomeCardKind`, `2345` |

**The one correction, and it is good news.** A logged entry also stores `dose` — the **exact label
text** the caregiver picked (`index.html:2571`). So `"2 puffs"` is not lost; the words survive, and
the CSV/printable report prints that label first (`index.html:8920-8926`). What is lost is the
*unit of the number*: the 2 goes into a field literally named `pills`.

**And `pills` is not a pill count.** The file says so itself, twice, in comments paid for by real
bugs — v45 (`index.html:6540`) and v52 (`index.html:8912`, from Aaron reporting a report that read
*"500mg, 500 pills"* for a 500 mg Tylenol). The field is *"the amount in the non-mg limit unit."*
**That is the most important structural fact in this report**, and §5 turns on it.

### What I measured

The app's real `parseDoseOptions`, run unmodified against strings a caregiver would plausibly type:

| Typed | `mg` | `pills` | Comment |
|---|---|---|---|
| `500 mg` | 500 | 500 | fine — both fields set, readers pick by unit |
| `0.5 mg` | 0.5 | 0.5 | correct |
| **`.5 mg`** | **5** | **5** | **ten-fold error. ISMP's naked decimal.** |
| **`5,000 units`** | — | — | **splits into `5` and `000 units`** |
| `500 mcg` | 0 | 500 | "500 pills" |
| `2.5 mL` | 0 | 2.5 | "2.5 pills" |
| `20 mEq` | 0 | 20 | "20 pills" |
| `2 puffs` | 0 | 2 | "2 pills" |
| `1 patch` | 0 | 1 | works, if Limit unit is "applications" |
| `1/2 tablet` | 0 | 1 | **half becomes one** |
| `two tablets` | 0 | absent | Daily limit stays permanently locked |
| `1.0 mg` | 1 | 1 | numerically fine; the app accepts the trailing-zero form ISMP bans |
| `levothyroxine 88 mcg` | 0 | 88 | "88 pills" |

---

## 3 · RECOMMENDED UNIT LIST

Grouped the way a caregiver thinks, not the way a terminology server does. **The organising question
is the one the app's own help text already asks: "pick the thing you'd actually count at the end of
the day."** That question is the right one and it is what sorts this list.

### 3a · COUNTABLE — the number is the thing. **High confidence.**

These need no conversion, no arithmetic, and no clinician sign-off. Each is a whole object or a
discrete actuation a person can count. **They are also, technically, what the app already supports
today under the single misleading word "pills".**

| Unit | Why |
|---|---|
| tablet / tablets | The most common oral solid. Distinct from capsule and users know which they have. |
| capsule / capsules | As above. |
| pill / pills | Keep it. It is what non-clinical people say, and it is the existing stored value — removing it would strand data. |
| dose / doses | The safe catch-all when the form is odd. Already the app's fallback word. |
| puff / puffs | Inhalers. UCUM carries a dosing unit `PUFF`. |
| spray / sprays | Nasal and topical metered sprays. |
| drop / drops | Eye, ear, nasal. **Write the word; never `gtt`.** |
| patch / patches | Transdermal. The app's singulariser already handles this word. |
| suppository / suppositories | Rectal/vaginal. The singulariser already handles the `-ies` plural. |
| lozenge / lozenges | Already in the app's own test fixtures. |
| packet / packets (sachet) | Powders for oral solution. |
| application / applications | **Keep** — it is the existing stored value for creams and gels. |
| injection / injections | When the person counts syringes, not volume. |
| pen / pens · syringe / syringes · vial / vials | Prefilled devices. Count, not measure. |
| scoop / scoops | Powders with a supplied scoop. |
| chewable / chewables | RxNorm treats "Chewable Product" as its own dose-form group. |

### 3b · MEASURED MASS. **High confidence on the units; see §5 on storage.**

| Unit | Why |
|---|---|
| mg | Already supported. |
| **mcg** | The gap that most obviously bites. Levothyroxine, fentanyl patches, many inhaled steroids. **Must be spelled `mcg`.** |
| g | Rarer at home but real (some powders, some antacids). |

### 3c · MEASURED VOLUME. **High confidence on `mL`; deliberate stance on the rest.**

| Unit | Why |
|---|---|
| **mL** | The correct and only unit for liquids. FDA and ISMP both push metric-only liquid dosing (§4). The app already has a mL pathway; it is unreachable (§5). |

### 3d · ACTIVITY AND AMOUNT-OF-SUBSTANCE. **Ask a clinician before shipping these.**

| Unit | Why | Confidence |
|---|---|---|
| units | Insulin, heparin, some enzyme replacements. **Spelled out — never `U`.** | Confident it is needed. **A clinician should confirm the copy**, because insulin is a designated high-alert medication and a daily-limit feature over insulin units is a different kind of object from a daily limit over paracetamol. |
| international units | Vitamin D, vitamin E. **Spelled out — never `IU`.** | Confident on the spelling rule; **ask whether it belongs at all** in a cancer-support app. |
| mEq | Potassium chloride is prescribed and dispensed in mEq (20 mEq tablets are standard). | **Ask a clinician.** It is a real home unit, but it is also one where a caregiver may see BOTH `20 mEq` and a tablet count on the same bottle. |
| mmol | The SI sibling of mEq; more common outside the US. | **Ask a clinician**, and probably defer — see §4c. |

### 3e · MY RECOMMENDATION ON SHAPE

**Do not ship one flat list of 25 units in a `<select>`.** Two reasons, both from what is already in
this repo: every extra control is a new way to mis-tap (Rule 2.6), and a long picker on a 320px
screen is a Designer finding waiting to happen.

**Ship it as: a short list of the units this app will *count*, and a free-text "other" that is
labelled as a label.** Concretely — the picker offers mg, mcg, mL, and then the countable group as a
single choice ("a number of…") with a word beside it. The app already stores the word separately
from the number (`ceilingUnit`), already renders it, and already singularises it correctly. That is
the cheap, honest version and it matches the architecture that exists.

---

## 4 · UNITS I RECOMMEND LEAVING OUT, ON PURPOSE

Written down because an omission nobody wrote down is indistinguishable from an oversight.

### 4a · teaspoon, tablespoon, dropperful, "capful" — LEAVE OUT, and say why in the UI

This is the strongest-sourced recommendation in this report and it is a *refusal*, not an omission.

> *"the use of multiple volumetric units (e.g., teaspoons, tablespoons, droppersful) and multiple
> abbreviations increase the likelihood of dosing errors, and one of the most common dosing errors
> is a patient or caregiver confusing teaspoons and tablespoons, resulting in 3-fold dosing errors"*
> — NCPDP recommendations on oral liquid dosing designations

> *"the fewest errors occurred when the label listed the dose in mL only and the syringe had
> measurement markings in mL only"*

FDA and ISMP both push metric-only liquid dosing. An app that offers "teaspoons" as a unit is an app
that helps a caregiver record a 3x error. **Recommendation: mL only, and if a caregiver's bottle says
teaspoons, the app should say so in one line rather than accept the unit.**

### 4b · mg/m² and mg/kg — LEAVE OUT of the dose picker

The brief's hypothesis is **correct**, and the sources support it. `mg/m²` is body-surface-area
dosing: *"BSA-based dosing is a method of prescribing chemotherapy drugs that normalizes the dose
according to the patient's body size"*, and the oncology team computes it from height and weight and
then **rounds to the tablets that exist** — for capecitabine, *"the calculated dose by body surface
area (BSA) will be rounded down to allow doses using 500 mg tablets."*

So `mg/m²` is what the **prescriber** works in; `500 mg tablets, three in the morning` is what the
**patient** counts. They are different numbers for the same dose, and the second is the one that
belongs in a home log.

**Where it legitimately appears in a patient-facing app: as reference text, never as a logging unit.**
A read-only "your regimen" note ("prescribed at 1250 mg/m²") is fine. A `mg/m²` option in the Limit
unit dropdown would invite a caregiver to type the prescriber's number into a field that counts
tablets, and the daily limit would then be meaningless in both directions. **Recommend: not in the
picker. If it is ever wanted, it is a separate read-only field, and it needs a clinician's review.**

### 4c · mmol — LEAVE OUT for now

Real, but for a US-first consumer app it duplicates mEq and doubles the chance of the wrong one
being picked. Revisit if the app goes international.

### 4d · `gtt`, `U`, `IU`, `cc`, `µg`, `ss`, `qd`, `qod` — REFUSE AS INPUT, always

Not units to offer. Strings to catch. See §5… §6 below.

### 4e · percentage strengths (`1% cream`) — LEAVE OUT of the dose unit

A 1% hydrocortisone cream's *dose* is "one application," not "1%". The percentage is a property of
the product, not of the dose. Apple Health treats `%` as a **strength** unit, not a dose unit, and
that split is right.

---

## 5 · THE DATA-MODEL FINDING

**This is the part that decides whether the feature is a dropdown change or a storage change, and the
honest answer is: it is BOTH, and they can be shipped separately.**

### 5a · What is actually stored today, verified

A logged medication entry (`index.html:2571-2573`) is:

    { medId, dose: "<the label text>", mg: <number|0>, ts,
      pills?: <the leading number from the label>,
      volumeMl?: <med.volumePerDoseMl>, painLevel?, override?, ... }

Three counting functions read it:

- `dailyDoseMg(medId)` sums `entry.mg`
- `dailyPills(medId)` sums `entry.pills` — `index.html` line ~1730
- `dailyVolumeMl(medId)` sums `entry.volumeMl` — `index.html:1735`

and `dailyCeiling(med)` (`index.html:1746`) routes **anything with a `ceilingUnit` through
`dailyPills`**, and everything else through mg.

### 5b · THE GOOD NEWS, and it is bigger than it looks

**`entry.pills` is already a generic count field, and the unit word already lives separately on the
medication as `ceilingUnit`, which the render layer already treats as free text.**

Which means: **for every countable unit in §3a, adding it to the dropdown is a LABEL change, not a
storage change.** "2 puffs" already stores `pills: 2` and `dose: "2 puffs"`. The only thing wrong
today is that `ceilingUnit` can only be the word `pills` or `applications`, so the Home card and the
daily-limit copy print the wrong noun beside a correct number.

Evidence that the display half is already finished and tested:
- `index.html:5489-5511` — the Home card reads `hcMed.ceilingUnit` as free text and singularises it
  with rules *"measured across 42 real units by the round-3 audit"*, deliberately sparing `bolus`,
  `lens`, `gas`.
- `test/v79-home-cards-render.mjs` already asserts on `ceilingUnit` values `lozenges`, `patches`,
  `caps`, `bolus`; `test/v79-warning-priority.mjs` on `tablets`.

**So §3a is achievable by widening one `<select>` and touching no stored entry at all.**

### 5c · THE BAD NEWS — where it really is a storage change

**Measured units (mcg, g, mL, mEq, mmol) cannot live in `pills`.** They must be summable and, for
mass, convertible — 500 mcg + 0.5 mg is 1 mg, and a `pills`-style sum would call it 500.5. There is
exactly one mass slot (`mg`) and it is populated only by a literal `\d+ mg` match.

**And there is a defect here, not just a gap.** The millilitre pathway is **complete and
unreachable**:

- `dailyVolumeMl` (1735), `volumeDailyCeiling` (1737), the `kind:'ml'` Home card (5485), and two
  passing suites all exist;
- `med.volumePerDoseMl` and `med.volumeCeilingMl` are the only inputs to them;
- **`medicationFormFrom` (6468) does not read either field and `saveMedicationEditor` (6748) does not
  write either field** — I checked every occurrence in the repo; outside those two read sites the
  only hits are in test fixtures;
- `DEFAULT_MEDS = []` (1057) — the app ships with **no** medications;
- so the only way a medication acquires `volumePerDoseMl` is a restored backup, a sync from an older
  build, or the `'tylenol-liquid'` legacy migration entry (1190).

**A brand-new user cannot create a liquid medication that counts millilitres. The feature is built,
tested, rendered, and switched off.** I flag this as an Enhancer/Designer-class finding that reached
the Research seat instead: nothing is *wrong*, a whole capability is *missing an input*.

### 5d · A SECOND FINDING: the unit is stored on the medication, not on the dose

`ceilingUnit` lives on the medication and every unit word is derived at render time from it
(5489, 6036, 8925). **So editing a medication's Limit unit retroactively relabels every dose already
logged.** Log three sprays, later switch Limit unit to "Number of pills / doses", and the Home card
total, the medication list line, and the export's fallback text all now say "pills" about doses that
were sprays. **Nothing is deleted and no number changes** — the stored `dose` label still reads
"1 spray" and the export prints that label first — but the counted total is relabelled silently.

**This gets worse, not better, as the unit list grows.** With 3 units it is nearly invisible; with 25
it is a caregiver switching from "puffs" to "mcg" and a card that now claims 6 mcg.

**Recommendation: stamp the unit on the entry at log time.** One new optional field, written by new
logs only, read in preference to `ceilingUnit` where present. Append-only, no rewrite.

### 5e · WHAT THE MODEL SHOULD BECOME

Additive, and deliberately boring:

    // unchanged, still written exactly as today:
    { medId, dose, mg, pills?, volumeMl?, ts, ... }

    // new, optional, written only by builds that have it:
    amount:     <number>      // the quantity as typed
    amountUnit: <string>      // the canonical unit code: 'mg'|'mcg'|'g'|'mL'|'units'|
                              // 'international units'|'mEq'|'tablet'|'puff'|'drop'|…

Readers use `amount`/`amountUnit` when present, and fall back to the existing triple when not.
`dailyCeiling` gains one canonicalisation step (mcg→mg, g→mg for mass; everything else sums only
against its own unit and **never across units**).

`homeCard.kind` widens from `['mg','pills','ml']` to a class rather than a unit — `'mass'`,
`'volume'`, `'count'`, `'activity'` — with `normHomeCard` mapping the three legacy values forward.
`mg`→mass, `ml`→volume, `pills`→count. Three values in, four classes out, old data reads identically.

### 5f · CAN IT BE DONE WITHOUT TOUCHING A SINGLE LOGGED DOSE? **Yes. Stated precisely.**

- **No entry is rewritten, edited or deleted.** Every field that exists today keeps its meaning and
  its reader.
- **`amount`/`amountUnit` are written by new logs only.** An entry from before the change has
  neither, and the fallback path is the code that runs today.
- **Medications need no migration either.** A medication with `ceilingUnit: 'applications'` keeps
  working through the same `dailyPills` route; a medication with no `ceilingUnit` keeps the mg route.
- **The one thing that is NOT free** is the mL input gap in §5c. Making `volumePerDoseMl` reachable
  is a genuine new editor field, and it changes what a medication can hold — but it still writes
  nothing to any existing entry.

**Said out loud, because this repo refuses claims that were believed rather than measured:** I have
read the write path and every read site named above, and I have run `parseDoseOptions` directly.
**I have not run the app, and I have not written or run a migration test.** The equivalence claim in
this section is an argument from the code, not a measurement — `test/v76-properties-equivalence.mjs`
is the pattern that would turn it into one, and phase 1 of any build from this report should do
exactly that before a line of UI is written.

---

## 6 · SAFETY RULES THE APP SHOULD ENFORCE

Every one of these is a concrete, falsifiable check on text a caregiver types. **All of them apply to
the Dosage options field, which is free text today and validated by nothing.**

### The sources, in their own words

- **mcg, never µg** — *"Use the abbreviation 'mcg' for microgram, never the Greek letter µg, because
  'µg' could be misread as mg."*
- **units, never U** — *"Never use the abbreviation U, which easily can be mistaken as a zero,
  causing a 10-fold overdose. Spell out the word 'units'."* ISMP has *"reported for decades on the
  danger of using the letter 'u'… serious mistakes, ten-fold overdoses, and even fatal events…
  misread as a zero, four, seven, or 'cc'."*
- **international units, never IU** — *"Never abbreviate international units as IU; this measure…
  has been misread as IV (intravenous)"*, or as the number 10.
- **mL, never cc** — *"Do not use 'cc,' which has been misread as 'U' or the number 4. Use 'mL'."*
- **No trailing zero** — *"Do not use trailing zeros at the end of a dose… (e.g., 5 mg, never
  5.0 mg)"*; *"a trailing zero… might be read as '10 mg' if the decimal is missed."*
- **Always a leading zero** — *"Use leading zeros for doses less than one measurement unit (e.g.,
  0.3 mg, never .3 mg)."*
- **@ is on the do-not-use list.**
- **qd / qod** — *"often mistaken for each other… write out 'daily' or 'every other day.'"* ISMP's
  reported case: *"an order for Flomax 0.4 mg QD that was misinterpreted as Flomax 0.4 mg QID."*

### The implementable checks

Ordered by severity. **Severity 1 is a bug fix, not a feature.**

| # | Check | On match | Severity |
|---|---|---|---|
| **1** | **`parseDoseOptions` must not read a naked leading decimal as a whole number.** `.5 mg` currently parses to **5**. Anchor the number regex so `.5` is either read as `0.5` or refused outright. **Refusing is safer than guessing.** | **Block the save.** Message: *"Write 0.5 mg, not .5 mg — a missed dot is a ten-times dose."* | **1 — live ten-fold error** |
| **2** | **A comma-grouped number must not split the field.** `5,000 units` currently becomes `5` and `000 units`. Detect `\d,\d{3}` before splitting. | Block. *"Write 5000 units without the comma — the comma separates two different dose options here."* | **1 — silently wrong dose** |
| 3 | Reject `U` or `u` used as a unit after a number (`10 U`, `10u`) | Block. *"Write 'units' in full."* | 1 |
| 4 | Reject `IU` after a number | Block. *"Write 'international units' in full."* | 1 |
| 5 | Reject `cc` | Normalise to `mL` and say so, or block. | 1 |
| 6 | Reject `µg` / `μg` (both Unicode codepoints) | Auto-correct to `mcg`, visibly. | 1 |
| 7 | Reject a trailing zero after a decimal point (`1.0 mg`, `10.0 mL`) | Warn and offer the corrected text. Do not block — it is unambiguous, just error-prone. | 2 |
| 8 | Reject `@` anywhere in a dose string | Block. | 2 |
| 9 | Reject `qd`, `qod`, `qid`, `bid`, `tid`, `hs`, `sc`, `SQ`, `gtt`, `ss`, `AD/AS/AU`, `OD/OS/OU` in any caregiver-typed field | Warn with the spelled-out replacement. These belong to prescribing, not to a home log, so a warning is enough. | 2 |
| 10 | Require whitespace between the number and a unit word (`10units`) | Auto-insert. ISMP: *"tenfold overdoses may still occur when there is inadequate white space between the dose number and the word."* | 2 |
| 11 | Warn on `1/2`, `½`, `1 1/2` — currently `1/2 tablet` parses as **1** | Warn and suggest `0.5`. | 2 |
| 12 | Warn when the dosage text carries a unit the medication's Limit unit is not (`500 mcg` under a `mg` limit) | Warn. **This is the check that stops §1(c).** | 2 |
| 13 | Warn on a word-number with no digit (`two tablets`) — parses to nothing and silently locks Daily limit forever | Warn at the point of typing, not at save. | 3 |

**Falsification duty, for whoever builds these (Rule 5):** every one of the 13 must be broken once
and watched go red. Checks 1 and 2 have a free head start — the failing input is already written
down in §2's table, measured, with the wrong answer beside it.

**One rule the app should NOT enforce:** do not reject a unit word just because it is not on the
list. A caregiver whose bottle says something the list does not carry must still be able to record
it. Refuse the *dangerous* strings; accept the *unfamiliar* ones as labels. The existing free-text
`ceilingUnit` plus a 42-word-tested singulariser is already the right shape for that.

---

## 7 · SIZED RECOMMENDATION, IN ORDER

Sizes are this repo's S / M / L (S <50k tokens, M 50-150k, L >150k tokens of work).

| # | Item | Size | Why this order |
|---|---|---|---|
| **1** | **Fix the naked decimal and the comma split in `parseDoseOptions`** (checks 1 and 2) | **S** | It is a live ten-fold dose error and a live wrong-dose error, in the shipping build, reproducible from §2. It is not part of the units feature and must not wait for it. **Writes/edits a record → independent auditor required regardless of size** (`chemowell-app-beta` hard rule 5; care-tracker Rule 2.2). |
| 2 | The remaining ISMP input guards (checks 3-13) | S–M | Pure validation on typed text. No stored entry changes. Falsify all 13. |
| 3 | **Stamp `amount` + `amountUnit` on new entries; readers fall back** (§5e) | M | The storage half. Ship it *before* the dropdown grows, so the first widened unit is already recorded correctly. Gate on an equivalence suite in the shape of `v76-properties-equivalence.mjs`. |
| 4 | **Widen Limit unit to the countable list** (§3a) | S–M | Cheap once #3 exists, and largely already rendered and tested (§5b). Designer pass at 320/360/390 on the picker before it is built — a 25-row `<select>` is exactly the finding `TEAM-ORDER.md` §3 exists to catch. |
| 5 | **Add mcg (and g) as measured mass units** (§3b) | M | Needs the canonicalisation step in `dailyCeiling`. The most-requested real gap after the countables. |
| 6 | **Make the millilitre pathway reachable** — editor fields for `volumePerDoseMl` / `volumeCeilingMl` (§5c) | M | Turning on a feature that is already built, tested and rendered. Sequenced after #3 so the new field writes the new model, not the old one. |
| 7 | **units / international units / mEq** (§3d) | M | **Do not ship without a clinician reading the copy.** Insulin is a designated high-alert medication. |
| 8 | Update the help entries `med-limit-unit` and `med-daily-limit-locked` (`index.html:3433-3434`) | S | `med-limit-unit` currently ships the sentence *"The list is currently only those three. More units (mcg, mL, puffs, drops, and others) are planned."* The Voice seat should take that line the moment #4 lands — it becomes false on the same release. |

**Recommended first approval: items 1 and 2 together, as one S/M release.** They are safety fixes on
the shipping build, they need no data-model decision, and they are the part of this report that is
costing something today rather than costing an opportunity.

**This seat's stop-power (`TEAM-ORDER.md` §1), used once:** any release that widens the unit list
**before** item 1 lands should be stopped. Adding `mcg` to a picker while `.5 mg` still parses as
5 mg widens the surface of a live ten-fold error.

---

## 8 · RULE 0 CHECK

Nothing in this report is keyed to one patient's medications or care plan. No medication id appears
in any recommendation. Every unit named is a property of a dosage form, not of a regimen. The
pronoun used throughout is **they**, for the patient and for the caregiver alike.

**CORRECTED after the app-v81 round-3 audit, which was right to raise it.** This section previously
said "she"/"her" was fine for the generic caregiver "the repo's existing copy already addresses" --
and that is not a defence, it is a description of the leak. Rule 0's second shape is exactly this:
a pronoun carried over from one named person's app into a product where the caregiver is whoever
installed it. The one instance in §1 is fixed. If the repo's existing copy does this elsewhere, that
is a finding against the copy, not a licence. §4b
deliberately declines to put a chemotherapy prescribing unit into a patient-facing control.

---

## 9 · SOURCES

Fetched-source note, stated plainly as the brief requires: **`WebFetch` is blocked by this sandbox's
egress proxy for every domain I tried** (`www.nlm.nih.gov`, `terminology.hl7.org`,
`online.ecri.org` all returned `EGRESS_BLOCKED`). Everything below came through `WebSearch`, which
returns a summary plus the source URLs. **Quoted text in §4a and §6 is quoted from those search
result summaries, not from a page I retrieved in full.** I have marked below what that means for
each claim.

**Directly supported by quoted search-result text (§4a, §6):**
- [ISMP's List of Error-Prone Abbreviations, Symbols, and Dose Designations](https://www.ismp.org/sites/default/files/attachments/2017-11/Error%20Prone%20Abbreviations%202015.pdf) — mcg/µg, U, IU, cc, trailing zeros, leading zeros
- [ISMP List of Error-Prone Abbreviations (ECRI mirror)](https://online.ecri.org/hubfs/ISMP/Resources/ISMP_ErrorProneAbbreviation_List.pdf)
- [ISMP — Safe Electronic Communication of Medication Information](https://www.ismp.org/system/files/resources/2019-03/Electronic-Guidelines-2019.pdf) — the "U → zero, four, seven, cc" and inadequate-whitespace findings
- [ISMP Error-Prone Abbreviations, hosted copy](https://depts.washington.edu/pharm543/documents/schedule/ISMP%208%2024%20error%20prone%20abrevs.pdf) — `@`, qd/qod, and the Flomax QD→QID case
- [ISMP Guidelines for Optimizing Safe Subcutaneous Insulin Use in Adults](https://www.ismp.org/sites/default/files/attachments/2018-09/ISMP138D-Insulin%20Guideline-090718.pdf) — insulin as a high-alert medication
- [NCPDP — Recommendations for Standardizing Dosing Designations on Oral Liquid Medication Labels](https://ncpdp.org/NCPDP/media/pdf/WhitePaper/DosingDesignations-OralLiquid-MedicationLabels.pdf) — the teaspoon/tablespoon 3-fold error
- [FDA — Standardize the Dosing Designations on Prescription Container Labels for Oral Liquid Medications](https://www.fda.gov/files/drugs/published/Standardize-the-Dosing-Designations-on-Prescription-Container-Labels-for-Oral-Liquid-Medications-(pdf).pdf)
- [ISMP — Move Toward Full Use of Metric Dosing](https://www.ismp.org/alerts/full-use-metric-dosing) — mL-only dosage cups

**Taxonomy, supported by search-result summaries (I could not open the primary lists):**
- [RxNorm Appendix 3 — Dose Form Groups (TTY=DFG)](https://www.nlm.nih.gov/research/umls/rxnorm/docs/2018/appendix3.html) — the DFG concept and groups (Topical, Inhalant, Injectable, Rectal, Vaginal, Buccal, Chewable Product). **I did not retrieve the full group list; treat §3's grouping as informed by this, not copied from it.**
- [RxNorm Technical Documentation](https://www.nlm.nih.gov/research/umls/rxnorm/docs/techdoc.html)
- [HL7 Terminology — Common UCUM units value set](https://terminology.hl7.org/5.5.0/ValueSet-ucum-common.html) — **blocked; not retrieved**
- [Commonly Used UCUM Codes](https://download.hl7.de/documents/ucum/ucumdata.html) and [UCUM specification](https://ucum.org/ucum) — source for `TABLET`, `CAPSULE`, `PUFF` as UCUM dosing units and `IU`/`ug`/`mcg`
- [NHS Dose Syntax Implementation for FHIR — UCUM and/or SNOMED units of measure](https://nhsconnect.github.io/Dose-Syntax-Implementation/dosage-unitsofmeasure.html) — SNOMED fallback where UCUM has no code (capsule = SNOMED 732937005)
- [FDA — Dosage Forms (SPL resources)](https://www.fda.gov/industry/structured-product-labeling-resources/dosage-forms) and [NCI — FDA Terminology](https://www.cancer.gov/about-nci/organization/cbiit/vocabulary/fda) — the SPL/NCIt dosage-form vocabulary

**Chemotherapy / BSA (§4b):**
- [Medical Calculations Using Body Surface Area (BSA)](https://ecampusontario.pressbooks.pub/sccmedicalmath/chapter/6-7-medical-calculations-using-body-surface-area-bsa/)
- [Adjuvant Capecitabine trial protocol, NCT05321329](https://clinicaltrials.gov/study/NCT05321329) — *"rounded down to allow doses using 500 mg tablets"*; 150 mg / 500 mg tablet strengths
- [Fixed-dose capecitabine study](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC2361225/) — fixed dosing as an alternative to BSA

**mEq (§3d):**
- [DailyMed — Potassium Chloride ER tablets](https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=c64ed4c0-1e27-42b3-9625-fb4e0d31e271)
- [Potassium Chloride Dosage Guide](https://www.goodrx.com/potassium-chloride/dosage)

**Comparable consumer apps (§5 of the brief) — PARTIAL, AND I AM SAYING SO:**
- [Apple — Add and log medications with iPhone](https://support.apple.com/en-us/105064). Search results indicate Apple Health's medication **types** are Capsule, Tablet, Liquid, Topical (plus cream, gel, spray, injection) and that its **strength** units include mg, mL and %. **That form/strength split is the one design decision I would copy** (§4e). I could not retrieve Apple's full unit list.
- [Medisafe features](https://medisafeapp.com/features/) / [Medisafe on the App Store](https://apps.apple.com/us/app/medisafe-medication-management/id573916946). **I could not find Medisafe's dose-unit list in any public source.** The search returned nothing on it and the result summary said so explicitly. **I am not going to write down a unit list for Medisafe, MyTherapy or CareZone from memory** — this repo has refused releases for exactly that. **If Aaron wants the competitive comparison, it needs someone to install the three apps and photograph the picker.** That is a real, small task and it is not one I can do from here.

**Marked as my own knowledge, not a source:** the grouping of §3 into countable / mass / volume /
activity; the judgement in §3e that a flat 25-item `<select>` is the wrong shape; the whole of §5,
which is read from this repo's own `index.html` and from running its own parser, and cites line
numbers rather than any external source.
