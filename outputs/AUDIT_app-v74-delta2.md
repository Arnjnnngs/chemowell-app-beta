# Zero Day Audit — ChemoWell app-v74, delta pass 2

AUDITED-COMMIT: bedc055f324e25c37b0f156d15742427860cc45b
VERDICT: DO NOT SHIP

Narrow delta over `8e8a394..bedc055`. Everything the first pass established is taken as given and was
not re-derived.

---

## HEADLINE — THE CODE FIX IS GOOD. THE DOCUMENTS DESCRIBING IT ARE STILL NOT TRUE.

**Blocker 1 (the rename carrying the previous drug's sentence and citation) is CLOSED.** I attacked it
five ways on the running build and it held every time. There is no code blocker in this delta, and I
want that said first so nobody goes hunting for one.

**Blocker 2 (the README claim) is NOT closed.** It was refused because the release documents said
things about the release that were not true. Four of them are still not true at `bedc055`, three of
them in the two files the fix touched, and one of the four is **measured false against the running
app**. One is the **write model** — the single statement Rule 1.5 makes binding — and it omits the
very field this delta exists to add.

The remedy is four string edits and no code change.

---

## BLOCKER — four untrue sentences in `README.md` and `outputs/PM_app-v74.md`

### B-1. `outputs/PM_app-v74.md`, the honesty table: "Nothing → *(no link)*" is FALSE

The table at line 60-67 says a card showing no description gets no link:

| What the card shows | What the link says | Where it points |
|---|---|---|
| Nothing | *(no link)* | — |

**Measured on the build at `bedc055`.** A medication named `Zzqqxx` — no typed purpose, nothing in
`MED_PURPOSE`, no cached source — renders:

```
purpose line : null
source link  : { href: "https://medlineplus.gov/search/?query=Zzqqxx",
                 exact: "false", text: "Look it up on MedlinePlus" }
```

`purposeSourceLink()` returns `null` only when `med.name` is empty, and `normalizeMedication()`
guarantees a name (`'Untitled medication'` is the floor). The link element in the Meds card render is
outside the `purposeOf(med) ? … : null` ternary, so it is unconditional.

This is not a code defect — the link is a search for the medication's own name and claims nothing.
It is the **same self-contradiction that got the release refused**: the README in this very commit
now says *"every medication card gains a 'Look it up on MedlinePlus' link"*, and the PM document for
the same release says a card with nothing on it gets no link. Both cannot be true; the PM one is the
false one, and it survived the fix that was supposed to correct exactly this.

**Fix:** change that row to `Nothing | Look it up on MedlinePlus | a search`.

### B-2. The stated WRITE MODEL omits `forName` — in both files

`README.md` (app-v74 row):
> **THE WRITE MODEL:** appends one optional field per medication, `purposeSource {text, url, label, fetchedAt}`

`outputs/PM_app-v74.md`:
> * **Appends** one optional field per medication: `purposeSource { text, url, label, fetchedAt }`.

The record actually written, read out of `localStorage` on the running build:

```json
{"text":"Prevents and settles nausea and vomiting.",
 "url":"https://medlineplus.gov/druginfo/meds/a601209.html?asked=Madeupzz",
 "label":"MedlinePlus","forName":"Madeupzz","fetchedAt":1789153089917}
```

`forName` is written by `fetchPurposeSource()`, carried through `normalizeMedication()`'s whitelist,
and is the whole of the blocker-1 fix. The write model is the one statement this project treats as
binding on what a release stores, and it is wrong in both documents.

**Fix:** `purposeSource { text, url, label, forName, fetchedAt }`, and one sentence saying what
`forName` is for and that a record written without it stops being displayed.

### B-3. "36/36" is wrong — the suite is 41/41

`README.md`: *"New gate `test/v74-med-source.mjs` **36/36**"*.
`outputs/PM_app-v74.md`, twice: line 104 *"`test/v74-med-source.mjs` **36/36**"* and line 129
*"`v74-med-source` 36/36"*.

Measured, this commit, clean environment:

```
41/41 checks passed
```

The delta added section 10 (five checks). The counts were not updated.

### B-4. The release documents do not mention blocker 1 at all

Both files still describe only the **in-flight** stale answer (*"A late answer is dropped"*). Neither
says that a **committed** rename used to carry the previous drug's sentence and citation permanently,
nor that a guard now exists for it, nor that a `purposeSource` stored without `forName` is dropped
from display on the next load. The README row spends a paragraph narrating the four defects
falsification found and is silent on the one an audit blocked the release for.

Not a false sentence on its own; with B-2 it becomes one, because the reader is told the write model
is unchanged when it is not.

---

## WHAT I ATTACKED IN THE RENAME FIX, AND WHAT HELD

All on the running build at `bedc055`, Chromium, network stubbed, Firebase stubbed.

1. **Committed rename, the reported defect.** Suite section 10 reproduces it and it is dead:
   `Madeupzz` (carrying a cached sentence and an exact citation) renamed to `Compazine` shows the
   app's own line and `Look it up on MedlinePlus → /search/?query=Compazine`, `exact="false"`.
   Falsifier mutant *"THE AUDIT BLOCKER"* → 40/41, **RED as intended**.

2. **`sub` (generic name) changed instead of `name`.** Source cached for `Madeupzz`; generic changed
   `Ondansetron → Prochlorperazine`. The sentence and the exact citation **stay**. This is correct,
   not a hole: the lookup was performed on `name`, the citation is a claim about `name`, and `name`
   did not change. Noted as non-blocking N-4 below for the one way it can still mislead.

3. **Case-only rename.** `Madeupzz → MADEUPZZ`: the match is case-insensitive on both sides, the
   source is kept. Correct — a rename that changes only case is the same drug, and no two drugs
   differ only by case.

4. **Whitespace.** `forName` is `String(name).trim()` at write; `purposeSourceMatchesName()` trims
   both sides at read; `normalizeMedication()` stores `name` trimmed (line 1209). All three agree.
   Internal whitespace is not collapsed on either side, so it cannot desynchronise them either.

5. **Two medications with the same name.** Each has its own record, its own `id`, and its own fetch
   keyed on its own `saved.name`. No path reads another medication's `purposeSource`.

6. **In-flight races on top of the committed fix.** A→B with fetch(B) in flight, then B→A: dropped
   (`current.name !== name`). A→B→C with fetch(C) resolving before fetch(B): fetch(B)'s answer is
   dropped. Section 9 covers the base case; mutant *"the stale-result guard removed"* → RED.

7. **The deliberate loss of pre-existing entries.** Consequence is smaller than the comment implies,
   not larger: app-v74 has never shipped, so **no record in the wild carries a `purposeSource` at
   all**, with or without `forName`. For any that ever did, the fallback measured is the built-in
   line plus a `Look it up` search link — honest in every state. The `slice(0, 120)` on `forName`
   against an unsliced `name` can only make the match **fail**, never falsely succeed, for any name
   at or under 120 characters.

8. **The new write-path https check.** Stub made to answer `javascript:alert(1)`:
   `record: undefined`, link falls back to `Look it up → /search/?query=Madeupzz`. The guard works
   and it is load-bearing — `refreshPurposeSource()` writes straight into `state` and the render
   takes `src.url` as an `href` before `normalizeMedication()`'s load-time check ever runs again.

9. `41/41`, `pageErrors: 0` across every probe.

---

## NON-BLOCKING FINDINGS

### N-1. Two of the delta's own new guards have NO check that can go red

The falsifier declares both new `expect=None`, which prints `NOT COVERED` and still counts toward
`ALL MUTANTS BEHAVED`:

```
the citation ignores the name match even when the text is held back   41/41   NOT COVERED
the https check on the WRITE path removed                             41/41   NOT COVERED
```

* The first is **genuinely redundant** and that is why nothing goes red: `purposeSourceLink()` needs
  `usingSourceText`, which needs `sourcedPurposeText()`, which already returns `''` unless the name
  matches. Defence in depth, harmless — but `PM_app-v74.md` documents the *other* redundant guard
  (`sourcedPurposeText`'s re-check) in so many words and is silent on this one. Say it there too, or
  the next reader reasonably assumes it is covered.
* The second is **not redundant** (see item 8 above) and has no test at all. Section 6 plants a bad
  URL in storage and exercises the *load* path only; nothing makes the stub answer a non-https URL.
  Cheap to close: a `sourceMode = 'badurl'` returning `javascript:alert(1)`, then assert nothing is
  cached and the rendered `href` starts `https:`. Until then a future edit can delete that line and
  every gate stays green.

`ALL MUTANTS BEHAVED` now covers 14 of 18 mutants; four are expected-not-covered. The phrase is true
as the script defines it, and it reads stronger than it is.

### N-2. The `u`-flag comment on `PURPOSE_NUMBERY` is wrong, in a release that corrected another wrong comment

```js
// The `u` flag matters: without it \d misses non-ASCII digits …
const PURPOSE_NUMBERY = /\d|[٠-٩۰-۹०-९]/u;
```

Measured in node:

```
plain \d on "٢": false    \d with u flag: false    \p{Nd} with u: true
Thai "๕": not caught      fullwidth "５": not caught     \p{Nd} catches both
```

The `u` flag changes nothing here; the explicit ranges do all the work, and they cover only
Arabic-Indic, Extended Arabic-Indic and Devanagari. What the `u` flag *actually* buys is `\p{Nd}`,
which catches every decimal digit in Unicode and is the one-token fix. No practical consequence —
MedlinePlus answers in English and the 150-char ceiling and the other four guards sit in front of it
— but this delta explicitly claims to have corrected an overclaiming comment while adding a new one.

### N-3. Suite section 10's second assertion cannot fail on its own

```js
t("and the app's OWN line for the new name is what shows instead", !!line && /settles nausea/i.test(line))
```

The stub's sentence is `"Prevents and settles nausea and vomiting."` and Compazine's built-in line is
`"Settles nausea and vomiting."` — **both match `/settles nausea/i`**. The stale sentence would pass
this check. The section is still sound because the preceding assertion compares against the stub's
exact string, but as written this one measures nothing the one above it does not. Anchor it
(`/^Settles nausea/`) or assert equality with the built-in line.

### N-4. A stale `label` is printed next to a URL it does not describe

`purposeSourceLink()` reads `label` from `med.purposeSource` **before** the name check, and the
non-exact branch prints `'Look it up on ' + label` over `MED_SOURCE.searchUrl(name)`. So a record
whose stored `label` is anything other than `MedlinePlus` — `normalizeMedication()` accepts any
40-character string from storage or a sync peer — renders `Look it up on Drugs.com` pointing at
`medlineplus.gov`. Pre-existing, not introduced here, and unreachable today because the only writer
is `MED_SOURCE.label`; the rename path is a *new* way to reach it, since a non-matching source's
label now survives into the lookup link. One line: use `MED_SOURCE.label` on the non-exact branch.

### N-5. `PURPOSE_WORDNUM` does not over-block, and the new form/route terms do not either

Twenty realistic one-line descriptions run through all three new/changed guards: none blocked. The
only blocks were the intended ones (`p.o.`, `po`). `\b`-anchoring keeps `p\.?o\.?` off `post`,
`pond`, `spot` and `Apo` — I checked. No finding.

---

## SCOPE — what was NOT re-derived

Taken as established by the first pass and not re-tested: no deletes, no entry writes, concurrent
lookups cannot clobber each other, the out-guard on planted text, no network at render, the 9s stall
not delaying the save, no TDZ, no markup injection, `rel="noopener noreferrer"`, version and cache
mechanics, and the endpoint-dead behaviour.

Chromium only; iPhone rendering is exempt and unverifiable here.

## TO CLEAR THIS

Four documentation edits, no code change, no re-audit of the code needed — a re-read of the two
files is enough:

1. PM honesty table: `Nothing | Look it up on MedlinePlus | a search`.
2. Write model, both files: add `forName`, and one sentence on what it does.
3. `36/36` → `41/41`, three places.
4. One sentence in each file on the committed-rename defect and its guard.

Then N-1's second bullet — a `badurl` stub mode — before the next release that touches this path.
