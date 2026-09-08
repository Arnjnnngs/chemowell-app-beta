AUDITED-COMMIT: fe83f72f62e1b0cbe85d0a4d1cff7d1d7567a3ed
VERDICT: DO NOT SHIP

**Headline: all three blocks from the first pass are genuinely fixed and I could not reopen any of
them — but a 42nd table entry was committed AFTER the fix commit, and it names a dosage form:
`'tylenol liquid': 'Eases pain. This is Tylenol in liquid form.'` That is the exact class the release
just declared forbidden, in the app's own source comment, in the patch header, and in a brand-new
suite check literally named "NO entry names a dosage form, route or body site" — and that check
reports PASS on it, because it is a list of eleven words and `liquid` is not one of them. The
release's newest gate is already false-green on the first case it met. Two lines clear it: delete
the second sentence, add `liquid` to the guard.**

Delta pass, 2026-09-08. `APP_VERSION` read from the file under test: **app-v72**, `sw.js` CACHE
`chemowell-app-v72-1`. Suite **27/27** at this commit, red on five hand-built mutants (numbers
below). No network on any run (`env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy`; the
suite refuses to start with a proxy set). Chromium at `/opt/pw-browsers/chromium`. **Nothing in the
repo was edited except this file, and nothing was committed.** Probes live in the scratchpad.

**The tree moved twice under me.** I started against `ef6fbc3`, and `bb396da` (the Tylenol Liquid
entry) and `fe83f72` (docs only) landed while I was measuring. Everything below was re-run against
the current HEAD. `index.html`, `sw.js`, the patch and the suite are byte-identical between `bb396da`
and `fe83f72`, so the code I exercised is the code this report stamps.

---

# BLOCK — the 42nd entry, added after the fix, is the defect the fix was for

```js
'tylenol liquid': 'Eases pain. This is Tylenol in liquid form.',
```

Committed in `bb396da`, three hours after the lidocaine line was rewritten to remove exactly this.
Measured on screen: typing **Tylenol Liquid** (or `tylenol liquid`) as a medication name renders that
sentence under the card; **Tylenol Extra Strength** and **Tylenol PM** render no line at all.

Three things are wrong with it, in descending order of importance:

**1. The new guard cannot fail on it, and it is the first case the guard ever met.** The suite check
added this pass prints

```
PASS  NO entry names a dosage form, route or body site
```

on a table containing the words *"in liquid form"*. The check is
`/\b(cream|ointment|patch|gel|rinse|suppository|injection|syrup|lozenge|tablet form|on the skin)\b/i`
— a list of the words in the sentence that got blocked, not the rule its name states. `liquid` is
absent, `tablet form` is present but `liquid form` is not, and nothing checks a route or a body site
at all. This project's own rule is that a check which cannot fail is worse than no check, and this
one now certifies the class it was built to stop. That is the blocking half of this finding: not the
sentence, the green light over it.

**2. The sentence carries no purpose.** It is the only one of 42 whose second half describes the
product rather than what the medication does. *"This is Tylenol in liquid form"* tells a tired
caregiver nothing she did not already know from the name she typed. Rule 2.7 question 3 — does this
belong on the screen at all — and the answer is no.

**3. It is the seed of a product table.** The file's comment, corrected this same pass, argues that a
name carrying extra words should MISS rather than resolve, *"which is a miss rather than a wrong
answer."* One product-variant key is fine on its own; a table that grows *Tylenol Liquid*,
*Children's Tylenol*, *Tylenol Extra Strength* one commit at a time is a maintenance surface nobody
signed up for, and the release notes do not mention it exists.

**In its defence, and this matters:** the sentence is **true**, and the key `tylenol liquid` names
the form itself, so the "one drug, many forms" reasoning that made the lidocaine line dangerous does
not apply here. **No patient is misled.** This is not the same severity as Block 1 last pass. I am
refusing on the false green plus the empty half-sentence, and both fixes are one line each.

**What clears it:**

```js
'tylenol liquid': 'Eases pain.',
```
identical to `'tylenol'`, no form language — and then `liquid` (and, while the file is open, `liquid
form`, `topical`, `by mouth`, `under the tongue`) into `FORMY`. Re-run; it stays 27/27 and the guard
goes red if the sentence ever comes back. **Verify the order:** fix the entry first, or the guard
fails on the shipped table.

---

# THE THREE BLOCKS FROM THE FIRST PASS — all genuinely fixed, none merely moved

## Block 1, lidocaine — CLEARED

`'lidocaine': 'Numbs the part of the body it is used on.'` No form, no route, no site. True of the
cream, the patch, the viscous swish-and-spit rinse for chemo mouth sores, and an injection — the four
products an oncology patient actually has. Rendered and confirmed on screen at 390px and 320px.

*Residual, not blocking:* systemic **intravenous lidocaine** (arrhythmia, or a perioperative
analgesia infusion) does not numb the part of the body it is used on; it acts on the whole body. That
is a hospital drug, not one a patient tracks in an outpatient app, and I would not spend a release on
it — but it is the one form the new sentence is not true of, and it should be written down rather
than discovered later.

## Block 2, "sickness" — CLEARED

`lorazepam` and `ativan` both now read *"Eases anxiety, and is also used for nausea and sleep."*
Every entry in the table uses American register. **The suite fixture still types "My oncologist
prescribed this for sickness"** as the user's own words — which is correct and should stay: it is the
user's sentence, not the app's, and it proves typed text survives verbatim.

## Block 3, the unconditional disclaimer — CLEARED, and I could not reopen it

Measured in a browser, four fixtures:

| fixture | medications | lines rendered | disclaimer |
|---|---|---|---|
| nothing recognised (`Zzunknownium`) | 1 | 0 | **0** |
| **empty medication list** | 0 | 0 | **0** — no crash, no page error |
| mixed (Zofran, Pantoprazole, Madeupzz) | 3 | 2 | 1 |
| Tylenol variants + Lidocaine | 5 | 3 | 1 |

`sortedMeds` is the exact array the cards are built from (`index.html:6265`, `:6293`, `:6346`), so
`.some(m => purposeOf(m))` cannot disagree with what is on screen. The empty-list case returns `null`
into the children array, which `h()` already handles — there is a `null` sitting in that same array
from the v12 breadcrumb cut. Zero page errors on every fixture.

**On the wording in the mixed case, which the brief asked about specifically.** The notice still
reads *"The line under each medication is general information, not medical advice."* In the mixed
case — three medications, two lines — "each" over-reaches. I am **not** blocking on it: it errs
toward more disclaiming rather than less, it is a description of a class of lines rather than a claim
about every card, and it is nothing like the blocked case where the sentence described something
that was not on the screen at all. If it is being touched anyway, *"The lines under your medications
are general information, not medical advice"* is true in all three states and costs nothing.

*One observation, pre-existing, not from this delta:* when every line on screen is the user's **own
typed** text, the notice calls her own words "general information". Harmless, and arguably still
right to disclaim. Noted so it is not rediscovered as new.

---

# THE FOUR NON-BLOCKING ITEMS — three taken cleanly, one re-broken by the newer commit

| | first pass | now |
|---|---|---|
| **F1** schedule guard missed `after chemo` | the patch header claimed it was caught; it was not | **fixed** — `after chemo` and `before chemo` added; verified red on a mutant |
| **F2** no fever guard at all | the release's headline safety decision was unguarded | **added**, and it fires — but see G1 below, it is narrower than it looks |
| **F3/F4** two false source comments | placeholder-while-typing, and the "Zofran (ODT)" claim | **both corrected**, and the corrected text now matches measured behaviour |
| **F5** "42 entries" was 41 | `outputs/PM_app-v72.md` | **corrected to 41 — and the table is now 42 again.** The document says *"41 entries (the earlier draft and the audit brief both said 42; the audit counted)"* while the shipped table has 42 keys. Fix the number in the same commit that fixes the entry. |

---

# NEW THIS PASS

## G1 — the fever guard misses the plainest way to write a fever clause

The guard is `/fever|antipyretic/i`. The first pass recommended `/\bfever|temperature\b/i`;
`temperature` was dropped and `antipyretic` — a word no plain-English line in this table would ever
use — was substituted for it. Run directly:

| candidate line | fever guard |
|---|---|
| `Reduces fever.` | **CAUGHT** |
| `Eases pain and brings down a fever.` | **CAUGHT** |
| `Eases pain and lowers a high temperature.` | **passes** |

*"Lowers a high temperature"* is exactly how this table's register would phrase it — the app writes
*"Lowers stomach acid"*, *"Lowers uric acid levels"*. One word closes it: add `|temperature`. It
cannot false-positive; no entry in the table mentions temperature.

## G2 — the form guard catches words, not the class its name claims

Falsified against candidates that a future editor could plausibly write:

| candidate line | form guard |
|---|---|
| `A numbing skin cream.` | **CAUGHT** |
| `A numbing medicine you rub onto a sore spot.` | passes |
| `A liquid you swish around your mouth to numb it.` | passes |
| `Taken by mouth to ease pain.` | passes |
| `Given as a shot under the skin.` | passes |
| `An infusion given in the vein.` | passes |
| `A tablet that eases pain.` | passes (`tablet form` is listed; `tablet` is not) |

I ran a whole mutant build with `'lidocaine': 'A numbing medicine you rub onto a sore spot.'` — a
route and a body site in one sentence — and the suite passed **27/27**. The guard pins the string
that got blocked, the way a delete-ratchet pins a call site. That is worth having and it is not what
the check's name says. Either widen it, or rename it to *"NO entry names one of these dosage
forms"* so the next reader is not told a class is closed when a word list is.

Related, and it is the same false-claim class as F3/F4: the comment directly above the schedule guard
still reads *"Dosage forms are allowed; WHEN and HOW MUCH are not."* A guard forbidding dosage forms
now sits three lines below it.

## G3 — the schedule guard is evaded by writing the word out

`\bafter chemo\b` catches `after chemo` and does **not** catch `after chemotherapy` (the `\b` needs a
non-word character after `chemo`). Verified both ways. `chemo\w*` fixes it. Low urgency — no shipped
line is affected — but it is the same evasion shape as G1 and G2 and the three are one commit.

## G4 — four NUL bytes in the gate suite, invisible in every tool that reads it

`test/v72-med-purpose.mjs` contains four literal `\x00` characters, at lines 163, 217, 224 and 267.
Every one is in the same idiom:

```js
t('the line matches the table it came from', map['zofran'] === (TABLE['zofran'] || '\0'), ...)
```

That was meant to be `|| ''`. Consequences, measured:

- The file classifies as **binary**. `grep` refuses it without `-a`; `file` reports `data`. Anyone
  grepping the harness for a check will silently not find it. `git diff` still renders it, but only
  because the first NUL sits at byte 9849 and git only sniffs the first 8000.
- The sentinel itself is **harmless and fails safe**: `TABLE['zofran']` is truthy whenever extraction
  works, so the fallback never fires; if extraction ever broke, the comparison goes red, which is the
  direction you want.

Not blocking, and **it predates this delta** — the NULs are already in `HEAD~2`, so it is a
"did-not-reach-last-pass" finding rather than a regression. Replace the four with `''`.

---

# WHAT I TRIED TO BREAK AND COULD NOT

- **Tylenol PM does not get the Tylenol line.** `Tylenol PM` normalises to `tylenol pm`, misses, and
  renders no line — correct, and it is the case that makes prefix-matching unsafe: Tylenol PM
  contains diphenhydramine, so *"Eases pain"* would be a wrong line on the right medication. The
  file's own comment argues this and the behaviour matches it. **Do not "fix" the miss with prefix
  matching**; per-product keys, written carefully, are the right answer.
- **`Tylenol Extra Strength`** — no line. Correct.
- **The release is reproducible from the patch.** `harness-med-purpose-patch.py --base <app-v71
  index.html> --out <scratch>` produces `index.html` and `sw.js` **byte-identical** to the shipped
  files. The patch refuses a base that is not app-v71. Every hand-fix from this delta, the Tylenol
  entry included, is in the patch as well as the file — the two do not disagree anywhere.
- **The empty medication list** renders Meds with no cards, no disclaimer and no page error.
- **320px** with the new lines: page `scrollWidth` 320, no purpose line clipped, no horizontal scroll.
- **The first pass's mechanical findings still hold and I did not re-litigate them**: the
  `hasOwnProperty` + `typeof` lookup (`constructor`, `toString`, `__proto__`, fullwidth text all
  return `''` and never throw), the editor round-trip that adds `purpose` and drops nothing else on
  four medication shapes, forward and backward storage compatibility with app-v71, and Home asserted
  clean rather than skipped. Nothing in this delta touches any of that — it is a table edit and one
  ternary.

# FALSIFICATION NUMBERS — every new check, broken and watched go red

| mutant build | result |
|---|---|
| unmodified HEAD | **27/27** |
| `acetaminophen` given a fever clause | **26/27** — fever guard red |
| `lidocaine` restored to "A numbing cream … on the skin" | **26/27** — form guard red |
| disclaimer made unconditional (`true ?`) | **26/27** — red on `lines=0 disclaimer=1` |
| `dexamethasone` given "given after chemo" | **26/27** — schedule guard red |
| `lidocaine` = "A numbing medicine you rub onto a sore spot" | **27/27 — GREEN. See G2.** |

The three guard regexes were also evaluated directly against seventeen candidate sentences; the
passes and catches are tabulated in G1–G3. No guard rejects any of the 42 lines the app actually
ships, so none of them is too tight.

# DELIBERATELY EXEMPT

- **iPhone rendering.** This sandbox has Chromium only. 320/360/390 in Chromium is not an iPhone and
  never will be; the Meds card at large text sizes on a real phone is Aaron's test, not mine.
- **Home is asserted clean, not skipped** — the suite checks `[data-med-purpose]` count is 0 on Home,
  which is an exemption written down as an assertion instead of an absence.
- **Clinical accuracy of the 42 sentences beyond what is named here.** I read all 42 again with the
  eye that caught lidocaine, looking specifically for a second entry naming a product, a route, a
  body site, or something true of only one form. There is exactly one: the Tylenol Liquid entry
  above. `'pantoprazole': '…which protects the stomach'` and `'loperamide': 'Slows the gut down…'`
  name organs, but as the mechanism, true of every form of the drug — that is not the defect class.
  `'iron'` is still circular and still harmless. I am not a clinician and this is not a clinician's
  review; `BACKLOG.md` now carries a standing item for a periodic clinical re-read, which is the
  right home for it.
- **The user's own typed purpose text** is never audited by any guard, by design — it is her sentence,
  not the app's, and the guards run over `MED_PURPOSE` only.

# WHAT WOULD CLEAR THIS

One commit, four small edits, then a re-run of the suite — no re-audit of the mechanics is needed,
nothing here reopens the build:

1. `'tylenol liquid': 'Eases pain.'` — drop the second sentence.
2. `liquid` into the form guard (and, cheaply, `temperature` into the fever guard, `chemo\w*` into the
   schedule guard).
3. The stale comment above the schedule guard — dosage forms are no longer allowed.
4. `outputs/PM_app-v72.md`: 41 → 42.

Optional in the same pass, none of it blocking: the four NUL bytes in the suite, the mixed-case
wording of the disclaimer, and one line somewhere recording that intravenous lidocaine is the form
the new sentence does not describe.

---

# THE FIRST PASS, SUMMARISED (this file is the only one the gate reads)

Audited `ef6fbc3^`, verdict **BLOCK**. Three blocks: **(1)** `'lidocaine': 'A numbing cream for
soreness in one spot on the skin.'` — the only entry of 41 naming a form and a body site, ported from
care-tracker where lidocaine is one patient's tube of cream, into an app whose `DEFAULT_MEDS` is
empty and where every medication is one the user typed, so the same key is just as likely to be the
viscous rinse for mouth sores or a patch. **(2)** `'…used for sickness and sleep'` on lorazepam and
ativan — British idiom in an app that writes American throughout, and at 2am "sickness" reads as
"being ill", which invites taking a benzodiazepine for feeling unwell. **(3)** the disclaimer
rendered unconditionally, measured at `disclaimer=1, lines=0`, telling a new user about "the line
under each medication" when no medication had one. Four non-blocking: the schedule guard missed the
exact phrase its own documentation claimed it caught; there was no fever guard at all behind the
release's headline safety decision; two source comments described behaviour the code does not have;
and the write-up said 42 entries when there were 41. Cleared as unbreakable in that pass: the
`hasOwnProperty` lookup against JavaScript built-in names, the editor round-trip on four medication
shapes, storage compatibility in both directions with app-v71, and 320px rendering.
