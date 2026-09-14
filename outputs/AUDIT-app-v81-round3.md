AUDITED-COMMIT: c391bc9
VERDICT: DO NOT SHIP

# Zero Day Audit — app-v81, round 3 (delta: `4610027`, `cbd6042`, `c391bc9`)

## The headline, in plain words

**This release takes a combination-strength dose — the way an opioid/paracetamol tablet is written
on every bottle of it — and silently turns it into a different, far smaller number, on the button
and in the daily total. A caregiver who types `5/325 mg` gets a button reading `0.015 mg`, and
every dose logged from it counts fifteen thousandths of a milligram toward the paracetamol ceiling.
Measured on the shipping build.**

`5/325 mg` is Percocet and Norco. It is the most commonly written dose string in cancer pain
management, and paracetamol's 3–4 g daily ceiling is the single most important number this app
computes. On app-v80 that string counts 325 mg — roughly right, and it stops the caregiver after
nine tablets. On this build it counts 0.015 mg, so the ceiling is reached after **200,000 tablets**.

**This is the same defect the release exists to fix, in the same direction, on a commoner string.**
The release note says the ten-fold error reached a ceiling "after a tenth of the medicine it should
take." This is a twenty-thousand-fold error in the opposite, worse direction: the ceiling is never
reached at all, and nothing on screen says so.

**And it is not the only reason to hold it.** The release does not fix anything for a medication
that already exists. Nothing re-parses stored doses, so a medication saved yesterday with `.5 mg`
still prints `.5 mg` and still counts 5 mg on this build — measured on screen, below. The commit
message, the suite and the code comments all describe the defect as fixed. For existing data it is
not, and that exemption is nowhere written down.

Three smaller findings follow, including a new gate in `release_check.sh` that does not fire for
the one case its own comment names.

---

## BLOCK 1 — a combination strength is rewritten into a wrong number *(CRITICAL)*

Measured through `window.__doseTest.parseDoseOptions` in a real Chromium page against the shipping
`index.html` at `c391bc9` — the actual function, not a copy.

| typed into Dosage options | app-v80 (live now) | **app-v81 (this build)** |
|---|---|---|
| `5/325 mg` | label `5/325 mg`, mg **325** | label **`0.015 mg`**, mg **0.015** |
| `10/325 mg` | label kept, mg **325** | label **`0.031 mg`**, mg **0.031** |
| `5/500 mg` | label kept, mg **500** | label **`0.01 mg`**, mg **0.01** |
| `25/2 mg` | label kept, mg **2** | label **`12.5 mg`**, mg **12.5** |
| `300/30/10 mg` | label kept, mg **10** | label **`10/10 mg`**, mg **10** |

And on the screen itself, with that medication saved and a 3,000 mg limit set:

    HOME:    button "0.015 mg"
    LOGGED:  { medId: "combo", mg: 0.015, pills: 0.015 }
    CARD:    "Combo  logged · 0.015 mg at 10:00 AM"

**The cause.** The plain-fraction pass is

    out = out.replace(/(?<![\d.])(\d+)\s*\/\s*(\d+)(?![\d.])/g, ...)

It accepts any two integers around a slash, so it reads `5/325` as a fraction and computes
`5 ÷ 325 = 0.015`. Nothing in the expression distinguishes "half a tablet" from "five of one drug
and three hundred and twenty-five of another."

**It is worse than a wrong number, because it is inconsistent.** The decimal lookbehind/lookahead
accidentally protects some combination strengths and not others, measured side by side:

    "5/325 mg"    ->  0.015 mg      MANGLED
    "7.5/325 mg"  ->  7.5/325 mg    untouched
    "80/12.5 mg"  ->  80/12.5 mg    untouched
    "2.5/5 mg"    ->  2.5/5 mg      untouched

So two strengths of the same product behave differently, which is how a caregiver learns not to
trust what the box does.

The brief asked specifically about `5 mg/mL` and `100 mg/m2`. **Both are safe** — measured,
`5 mg/mL` → `5 mg/mL` (mg 5) and `100 mg/m2` → `100 mg/m2` (mg 100) — because there is no digit
immediately before the slash. The slash risk is real, but it is on the other side of it.

**What would fix it.** Only treat `a/b` as a fraction when it is a **proper** fraction with a
plausible denominator: numerator strictly less than denominator, denominator in {2,3,4,5,6,8}. That
keeps every case the release is actually for (`1/2`, `2/3`, `3/4`, `1/3`, `1 1/2`) and leaves
`5/325`, `10/325`, `25/2`, `11/2` and `300/30/10` exactly as the caregiver wrote them. It also
retires the `11/2` ambiguity (eleven halves vs. one and a half — this build currently picks 5.5)
by declining to guess. Every row in the table above belongs in the suite afterwards.

---

## BLOCK 2 — nothing is fixed for a medication that already exists *(HIGH)*

Measured on this build, with a medication stored in the shape app-v80's save path produces
(`{label: ".5 mg", mg: 5}`), a 2 mg daily limit, and no dose logged:

    HOME, BEFORE ANY DOSE:   button ".5 mg · over limit"

**The naked decimal is still printed and still counts 5 mg.** The ten-fold error is live, on this
build, for every medication saved before the update.

**Why.** `parseDoseOptions` is called in exactly three places (`index.html` 6635, 6790, 6825) and
all three are inside the medication editor. `loadMedicationConfig` does not re-parse; `deepCopyMeds`
copies `doses` verbatim; `migrateLegacyMedRules` never looks at `doses`. There is no migration.

**The related half, and it cuts the other way.** Line 6478 seeds the editor from
`base.doses.map(d => d.label).join(', ')`, and line 6825 re-parses that on save. So opening any
medication to change something unrelated — the gap hours, the daily limit — silently re-parses every
dose. For `.5 mg` that quietly repairs it. **For `5/325 mg` it quietly destroys it**, turning a dose
the caregiver never touched into `0.015 mg` as a side effect of editing a different field. That is
Block 1 reaching data that was correct before this release.

**What would fix it.** Either (a) a one-time migration that re-parses stored dose labels on load,
stamped so it runs once — which also needs Block 1 fixed first, or it corrupts combination doses on
everyone's device at once — or (b) say the exemption out loud: assert in the suite and state in the
release note that existing medications keep their stored labels and amounts until re-saved. Rule 5.5
is explicit that an exemption nobody wrote down is indistinguishable from an oversight. Right now
three separate documents describe this as fixed, and for existing data it is not.

---

## 3 — the new `release_check.sh` gate does not fire for the case it names *(MEDIUM)*

The block's own comment:

> *A FILE THAT EXISTS IS NOT A PASS THAT RAN. … it is here because `touch outputs/DESIGN-app-v81.md`
> would otherwise clear a gate written to stop exactly that.*

**`touch` still clears it.** Falsified in isolation, with the block's exact lines under
`set -euo pipefail`:

    A) no files at all      -> gate fires correctly (an unmatched glob is safe under set -u)
    B) two EMPTY files      -> bash: [: 0\n0: integer expression expected   FAIL=0  GATE DID NOT FIRE
    C) a 2-non-blank-line   -> GATE FIRED

`grep -c . empty-file` prints `0` **and exits 1**, so `|| echo 0` appends a second line; the test
becomes `[ "0\n0" -lt 3 ]`, which is a syntax error, evaluates false, and prints a raw bash error to
the operator's console that reads like a broken script. **The gate bites a thin pass and lets an
empty one through** — the exact inversion of what it was written for.

Two things I checked and found sound: an unmatched glob does **not** kill the script under `set -u`
(bash leaves the literal pattern and `[ -e ]` is false), and `RULE5_CHANGED` is newline-separated,
so `grep -q '^index\.html$'` matches correctly and the gate is properly scoped to index.html changes
only. Whole-script run of `./release_check.sh` on this tree exits 1 on the audit/PM stage, as it
should.

**Fix:** `n=$(grep -c . "$_f" 2>/dev/null); n=${n:-0}` — or `[ "$(grep -c . "$_f" || true)" ...]`
with the count read into a variable first, then tested. Then falsify it with `touch`.

---

## 4 — a code comment states the safety direction backwards *(MEDIUM — brief item 7)*

`index.html`, in the new block:

> *A VULGAR FRACTION is a number. "1/2 tablet" and "½ tab" are half a tablet, and the old parser
> read both as one whole — **which errs in the dangerous direction on a pill ceiling**.*

**It errs in the safe direction.** Counting a half as a whole reaches the limit *early*: against a
4-pill ceiling the app stops the caregiver after 4 halves — 2 real tablets. Over-counting on a
ceiling blocks a legitimate dose, which is a real harm and worth fixing, but it is not "the dangerous
direction."

`harness-v81-dose-parser.py` compounds it: *"a limit of four is reached after eight halves, and the
app says three are left."* Eight halves is four tablets — that is the **correct** behaviour being
described as the bug. Under the old code the limit is reached after four halves.

The fix is right. The justification printed beside it is not, and this release's own commit message
names "a sentence claiming a property the code does not have" as the class it refused five times.

---

## 5 — the rounding leaks one extra third *(MEDIUM-LOW — brief item 2)*

`round3` makes `1/3 tablet` into `0.333` (measured through the shipping hook). `dailyPills` sums
`entry.pills`; `dailyCeiling` returns `{used: dailyPills(...), max}`; the lockout is `dc.used >= dc.max`
(`index.html` 1636, 1750, 2172).

Three thirds sum to `0.999…`, which is not `>= 1`, so against a 1-tablet daily limit **a fourth third
is still offered and logged**. The caregiver ends the day at 1.333 tablets against a limit of 1 — 33%
over. With `2/3` it goes the other way: `0.667 × 3 = 2.001 > 2`, blocking a dose that is exactly at
the limit.

Small in absolute terms, but the release's whole claim is that the printed number and the counted
number are the same number, and here they are not: the button says a third and the total counts
0.333 of one. **Fix:** compare with a tolerance (`used >= max - 1e-6`), or keep more places than 3.

---

## 6 — the suite, assumed to be lying

**49/49 green on this tree, re-run here.** Three things it does not do:

- **Section 3 cannot see Block 1.** It is an *idempotence* check — parse a string, re-parse the label
  it produced, require the same numbers. `5/325 mg` → `0.015 mg` → `0.015 mg`: **agrees perfectly.**
  A first-pass mistranslation is invisible to it. The section header calls itself "THE CLASS, not the
  instances"; it is one specific property (stability), not the class (correctness), and it should say
  so rather than implying coverage it does not have.
- **A condition term that can never be false.** Section 4:
  `t('a divide by zero leaves the text alone…', junk && zero.length === 1 && …)`. `junk` is the array
  from the previous assertion and is always truthy — a leftover. The remaining terms still bite, so
  nothing is hidden, but it is the shape of the defect this project keeps shipping.
- **The table has no combination strength, no improper fraction, and no `mg/mL` or `mg/m²` in it** —
  the four shapes where a slash appears in real dosing. Adding them turns Block 1 red immediately.

**The debug hook's claim holds.** Measured rather than accepted: `window.__doseTest` exposes exactly
three keys, calling all three leaves `localStorage` byte-identical (snapshot before and after), and
nothing in the trio reads or writes app state. `state` is not reachable from the hook. The one thing
worth noting is that the property is writable and enumerable, so anything already running on the page
could replace it — irrelevant in a no-network local app, and no worse than the three hooks beside it.

---

## 7 — Rule 0, product neutrality

`test/v75-no-other-patient.mjs` is **27/27** on this tree, with all four ratchets at 0/0/0. Nothing in
the diff adds a patient name, an id-keyed branch, or a care-plan dose or ceiling to application code.

One advisory, not a block: `outputs/RESEARCH-dose-units.md` — new in this commit — refers to the
generic caregiver as *"**She** cannot set a daily limit on an inhaler…"* while the same document
states its own convention is *they*. It is a design document, not app copy, so the guard is right not
to fail on it; it is also exactly the habit Rule 0's shape #2 exists to break, and the habit is what
travels into a string.

---

## 8 — the Voice: the app now rewrites what the caregiver typed, and says nothing

The diff adds no new caregiver-facing sentence. It adds something harder: **a silent edit of the
caregiver's own words.** She types `.5 mg`; the button reads `0.5 mg`. She types `5/325 mg`; the
button reads `0.015 mg`.

**My actual opinion: the rewrite is correct in principle and unacceptable as shipped.** Rewriting
`.5` to `0.5` is what a pharmacy system does and it is right. But a rewrite the user cannot see is
only safe when it cannot be wrong, and Block 1 proves this one can be wrong — badly, silently, on a
common string, in the direction of an unflagged overdose. A caregiver who types the strength off the
bottle and glances at the button has no way to notice that the app decided she meant something else.

**What it needs, independently of Block 1 (S):** a live line under the Dosage options field reading
what will actually be saved — *"Will be saved as: 0.5 mg · 1 mg"*. The editor already renders a
`dailyLimitPreview` in that spot, so there is a surface and a pattern for it. It makes every rewrite
visible at the moment it happens, and it would have made Block 1 obvious to the first person who
typed a real combination strength into the form.

**And this one has a name.** The **Enhancer** pass at `cbd6042` did walk this field — it flagged the
parser as E8 and wrote *"the parser takes any leading number as a count"* — and then proposed nothing
about showing the caregiver the parser's output, which is Rule 2.6's checklist item 4 exactly:
information shown with no way to see what it became. The **Designer** pass at the same commit
measured the Meds page at 320/360/390 and never rendered a dose string the parser changes. Both seats
ran on the right screen in the right order and neither looked at the box this release is about
producing a different string from the one that was typed into it.

---

## What it would take to turn this into SHIP

1. **Block 1** — restrict the fraction pass to proper fractions with plausible denominators; add
   `5/325 mg`, `10/325 mg`, `7.5/325 mg`, `25/2 mg`, `11/2`, `300/30/10 mg`, `100 mg/m2`, `5 mg/mL`
   to the table with their expected untouched labels; falsify by removing the restriction and
   watching those rows go red.
2. **Block 2** — either migrate stored doses once (only after 1) or assert and publish the exemption.
3. **Finding 3** — fix the `grep -c` count, then clear it with `touch` and watch the gate fire.
4. **Finding 4** — correct the two sentences about which direction the old fraction bug errs in.
5. **Finding 5** — a tolerance on the ceiling comparison, or more decimal places.
6. **Finding 6** — rename section 3 to what it measures, drop the dead `junk &&` term.
7. **Finding 8** — the "will be saved as" line. Small, and it is the thing that makes a silent
   rewrite honest.

Items 1, 2 and 3 are the release. 4–7 should ride with them.

Chromium only; an iPhone's rendering cannot be reproduced in this sandbox and stays exempt.
