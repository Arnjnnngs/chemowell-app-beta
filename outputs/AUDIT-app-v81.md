AUDITED-COMMIT: 8ff4e96f54d327a13ec689e1ff689995f6933f09
VERDICT: DO NOT SHIP

# Zero Day Audit — app-v81

## The headline, in plain words

**Do not ship this yet. One line needs changing and three sentences need correcting, and then it is good.**

The release says — in the code, in the commit, and in the README row Aaron reads — that the safety
check on the medication descriptions was made **stricter** at the same time it was opened up to let
chemotherapy drugs in. **That is not true. It was made weaker, and only weaker.**

The check exists to stop the app ever printing *when* or *how much* to take a medicine. It used to
refuse any sentence containing the word "chemotherapy". That was too blunt — it is why the app had
no chemotherapy drugs in it at all, which is the real bug Aaron found, and opening it up was right.
But the way it was opened up also let go of six-plus ways of writing a genuine schedule.

I put three fake medicines into the real app and ran the real test suite:

- "Given prior to chemotherapy to prevent sickness."
- "Taken throughout chemotherapy."
- "Given on the day of chemotherapy."

**All three are instructions about timing. All three were caught by the old check. All three now pass,
and the suite printed a full green board — 187 entries, every guard PASS.** Putting the old check
back makes all three go red immediately. So this is measured on the shipping build, not argued.

**Nothing is wrong with what ships today.** I read all 184 descriptions. Not one of them contains a
schedule, a dose, a dosage form, a route, a fever claim, a diagnosis, a pronoun or anything belonging
to the other patient. The app is safe right now. What is broken is **the guard that protects the next
person who edits this table** — and a comment, a commit message and a release note that all tell that
person the guard is stronger than it is. This project has already ruled, at app-v70, that *a check
that prints a false sentence in green is worse than no check*. This is that, one level up.

The fix is small and does not touch the data. It is written out at the end.

---

## What I checked and what I found

### 1. The typing fix — it works, and it is safe. No finding.

This was the change I expected to block on, and it holds up under everything I threw at it.

| Attack | Result |
|---|---|
| Slow typing, 600 ms a key — a full page rebuild between **every** keystroke | "Keytruda" intact, caret at 8, focus never left |
| Fast typing, 5 ms a key | "Pembrolizumab" intact |
| Typing across the 450 ms boundary, half and half | "Carboplatin" — both halves, in order, one field |
| Paste in one shot | "Cyclophosphamide" intact |
| Backspace across the boundary | correct |
| **Correcting the middle of a word, three times, each across a rebuild** | caret moved 3 → 4 → 5, exactly one place per character. **It never jumped to the end.** |
| Select a whole word and replace it across a rebuild | replaced, not appended |
| Mobile context (`isMobile`, `hasTouch`) | identical: name intact, caret kept, hint updates |
| **Closing the editor inside the 450 ms window** (the one the brief flagged first) | editor closes and **stays** closed; the stale timer fires into nothing; no error |
| Opening a second editor inside the window | the new form is empty — it does not inherit the half-typed name |
| Does the 450 ms redraw fight the 1-second tick? | **No.** The tick is already skipped while `state.medEditor` is open, and again while any input has focus. Two independent guards. |
| Are `med-name` / `med-sub` unique ids? | Yes — one occurrence each in the whole file, both inside the medication editor. No collision. |

On the stale timer specifically: the callback reads `state.medEditor` **at fire time**, and the value
was already written to the form object synchronously on the keystroke. So the worst it can do is
repaint whatever editor is open at that moment. It cannot write one medication's text into another's.

**Falsified both halves of the fix.** Removing `'debounced'` from the name field takes the suite to
**11/18**. Removing `id: 'med-name'` takes it to **13/18** — and, as the commit claims, it *reports*
the finding rather than throwing a stack trace. Both checks bite.

**One honest exemption.** A Japanese/Chinese/Korean input method composing a word across the redraw
does get disturbed — I drove one through Chrome DevTools and the half-composed text was committed and
then the final word appended after it, giving duplicated characters. This is new in this release (the
field never redrew mid-typing before). I am **not** blocking on it: Chromium's emulated composition is
not a faithful model of a real phone IME, the app ships in English, and I could not verify it on a real
device. It should be written down as a known limitation rather than discovered later.

### 2. The 184 descriptions — read one by one, as a stranger with cancer

No finding that blocks. This is careful work and several lines are notably well judged:

- Olanzapine reads *"Calms nausea, and is also used for some mental health conditions"* — it does not
  print "antipsychotic" or name a condition under someone's medication.
- Valacyclovir and acyclovir say *"certain viruses"* and do not name a stigmatised infection.
- Rituximab, trastuzumab and pertuzumab describe the **protein** they target and assert no cancer type.
- Leuprolide says *"sex hormones"*, not a sex. Nothing in the table has a gendered pronoun.

Checked mechanically over all 184: **no "her/she/his/he", no "Brandi", no second person, no named
diagnosis or stage, no dose, no digit, no dosage form or route, no fever claim.** `v75-no-other-patient`
is **27/27** and the four leak shapes are all clean.

Two notes worth one line each, neither blocking:

- **The chemotherapy drugs are sorted into three mechanisms and two of them are in the wrong bucket.**
  Etoposide, doxorubicin and irinotecan are grouped under *"stops cancer cells from dividing"* with the
  taxanes and vincas; all three actually work by damaging DNA, which is the wording already used for the
  platinums. Nobody will act on this and it is not unsafe — but it is the sort of thing an oncology nurse
  would notice, and the correct sentence already exists in the table.
- **Methotrexate is the one chemotherapy agent not labelled as one.** Defensible, since it is also a low-dose
  immune medicine and the line says so. Leaving it is fine; it should be a deliberate choice, not an oversight.

### 3. The loosened guard — the block

Proven in both directions against the real suite, not against a copy of the pattern:

- Three schedule sentences added to the live table: **187 entries, every guard PASS, green board.**
- The old pattern restored into the suite with the same three entries: **FAIL, naming all three.**

And the claim itself does not survive inspection. Every phrase added in this edit — *with chemotherapy*,
*after chemotherapy*, *during chemotherapy*, and the rest — contains the word "chemotherapy", which the
old pattern already caught on its own. **So relative to the old check, the edit added nothing and removed
a great deal.** The set of sentences the new check refuses is a strict subset of the set the old one
refused. "Stricter in the same edit" is false wherever it appears, and it appears in three places:

1. the comment above the pattern in `test/v72-med-purpose.mjs`
2. the commit message on `8ff4e96`
3. **the README version-history row** — the one Aaron reads

The release notes have now carried a false claim on four consecutive releases. That is the pattern
this audit exists to break.

**The fix I recommend — and it is the shape this repo already decided on at app-v70.** Do not try to
enumerate the prepositions; you cannot. Invert it. Ban "chemo" in a description **unless** the whole
sentence matches one of the handful of forms that have actually been read and approved — today that is
`A chemotherapy medicine that …` and `… that chemotherapy can cause.` A new wording then fails until a
person puts it on the list on purpose, which is exactly the reasoning in `test/v70-stay-does-not-lock.mjs`.
If a pattern is preferred instead, it must at minimum catch a preposition or verb before *chemo(therapy)*
— `before|after|during|with|around|prior to|ahead of|following|throughout|between|until|on the day of|post|pre`
— and even then it is a blacklist and will be beaten again.

Then correct the three sentences. If the claim is simply dropped and the truth written instead —
*"the noun is admitted; the timing phrases are re-listed in both spellings; sentences naming
chemotherapy in any other way are no longer caught"* — that alone would satisfy me, because the data
that ships is clean and the next editor would be told the truth.

### 4. The deliberate omissions — the right call, said correctly

`cyanocobalamin`, `vitamin b12` and Excedrin are left out because no true short line clears the
digit check. **I agree, and I would not narrow the digit guard.** A digit in a sentence about a
medicine is a dose far more often than it is a vitamin's name, and the cost of the guard here is one
missing entry, while the cost of narrowing it is unbounded. The app shows nothing for an unrecognised
name, which is honest. Note it is already inconsistent in a harmless direction — `vitamin d` **is** in
the table, because "D" is a letter. That is fine; it just means the rule is "no digits", not "no
vitamins", and the note should say so.

### 5. Voice — the caregiver-facing strings

Every measurable claim in the README row, checked against the code rather than accepted:

| Claim | Verdict |
|---|---|
| `MED_PURPOSE` 66 → 184 | **True.** Parsed both builds: 66 before, 184 after. No duplicate keys, every key lowercase, every line readable by the suite. |
| `test/v81-purpose-hint.mjs` 18/18 | **True.** Ran it. |
| `v72-med-purpose` 64/64 | **True.** Ran it. |
| "no dose, no schedule, no dosage form, no route" in every line | **True** of all 184. |
| "stricter than before in the same edit" | **FALSE.** See above. |
| `APP_VERSION` → app-v81, `sw.js` CACHE → `chemowell-app-v81-1` | **True.** Both present and moved together. |
| "Rebuilt from e310665 plus the ten patch scripts: byte-identical" | **Not independently verified.** Reproducing it means running the patch scripts, which rewrite `index.html` in place, and I would not do that mid-audit. Flagging it as unverified rather than accepting it. |

No number about a patient is printed anywhere by this change. The hint is a description, not a statistic.

**One more, in the test file rather than the app.** `test/v81-purpose-hint.mjs` has a helper called
`cancel()` that looks for a button named `Cancel`. **The editor's button is called `Discard`.** The
helper finds nothing, silently does nothing, and every section that thinks it closed the editor did
not. The suite still measures the right thing — reopening the add form resets it — but it does so by
luck, and the helper's name says something that is not happening. Worth ten seconds to fix while the
file is open.

### 6. Designer — 320, 360, 390

Screenshots in `outputs/v81-audit-shots/`. No sideways scroll at any width; the editor lays out
correctly; the hint updates at all three.

**But the thing this release exists to show is mostly not readable.** The hint is the field's
*placeholder*, on one line, and a placeholder cannot be scrolled or selected — what does not fit is
simply gone.

| Width | Hint box | Descriptions cut off |
|---|---|---|
| 320 px | 230 px | **52 of 68** |
| 360 px | 270 px | **49 of 68** |
| 390 px | 300 px | **44 of 68** |

At 320 px, typing Cyclophosphamide shows *"A chemotherapy medicine that dan"*. The longest line shows
*"Blocks a vitamin that fast-growing "* and stops. Truncation existed before, but the old 66 lines were
mostly short and the hint never appeared while typing at all — this release makes it the thing the
caregiver is looking at. **Recommendation (S): render the hint as wrapping text beneath the field
rather than as a placeholder inside it, so the sentence is readable in full.** Not a blocker, and not
a reason to hold the data — but the feature is half-delivered without it.

**Exempt and said out loud: this sandbox has Chromium only. An iPhone's rendering cannot be reproduced
here.** Everything above is Chromium at those three widths. The real phones still need a look.

---

## Suites

- `test/v81-purpose-hint.mjs` — **18/18**
- `test/v72-med-purpose.mjs` — **64/64**
- `test/v75-no-other-patient.mjs` — **27/27**
- Known-red and not this release's: `audit-v55` (3), `pm-v55` (1 @360), `pm-v55b` (2 @360),
  `v57-browser-notice` (17), `v74-shipped-audit-probe` (3), `audit-v55b` cannot start. **This release
  makes none of them worse.**

## Mutations — every one restored

Six mutations were made and every one reverted. `index.html` and `test/v72-med-purpose.mjs` are
byte-identical to `8ff4e96` (verified by md5 against a pre-audit baseline), and `git status --short`
shows only the six PNG files that were already modified before this audit began, plus this report and
the screenshots it produced.

## What has to happen before this ships

1. **Required —** make the schedule guard genuinely stricter (allow-list preferred), and prove it by
   putting the three sentences above into the table and watching the suite go red.
2. **Required —** correct "stricter in the same edit" in the test comment, the commit message and the
   README row. If the guard is fixed properly, rewrite it to say what it really does.
3. **Recommended (S) —** show the hint as wrapping text under the field instead of as a placeholder.
4. **Recommended (XS) —** fix the dead `cancel()` helper in `test/v81-purpose-hint.mjs` (`Discard`).
5. **Recommended (XS) —** move etoposide, doxorubicin and irinotecan to the DNA-damage wording.
6. **Write down —** the IME limitation, and that iPhone rendering is exempt in this sandbox.
