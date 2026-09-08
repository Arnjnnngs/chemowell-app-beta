# Zero Day Audit — app-v72, second re-audit (delta 2)

AUDITED-COMMIT: daf3639bcae4d72f0ac079962619ec652511d148
VERDICT: DO NOT SHIP

**Headline, in plain words: the medication-purpose feature itself held up. I attacked it for half an
hour and could not break it, and all four earlier blocks are genuinely closed — the Tylenol Liquid
sentence is gone, the widened guard now goes red on it, and the lidocaine wording is safe. I am
refusing on three things that are about the RECORD rather than the code. (1) The release cannot pass
its own gate: `./release_check.sh` fails right now because README.md has no version-history row for
app-v72 and `outputs/PM_app-v72.md` has a header the gate cannot read. Ship-blocking, mechanical,
already proven by running it. (2) The comment sitting three lines above the guard still says "Dosage
forms are allowed" — in the very commit titled "no entry may name a dosage form". The last pass
reported that exact line and it survived the fix. (3) The check named "NO entry names a dosage form,
route or body site" still does not check that class: `a pill you swallow`, `given as a shot under the
skin`, `given through a drip`, `numbs the skin`, `placed under your tongue`, `rub onto`, `rub into`
and `applied where it hurts` all sail through it — and so, by its own name, would the sentence the
release actually ships for lidocaine. The last pass said "widen it OR rename it". It was widened and
not renamed, so the green line still states more than it verifies.**

Second delta pass, 2026-09-08. HEAD was `daf3639` when I started and `daf3639` with a clean working
tree when I finished — the tree did not move under me. Suite **27/27** at this commit. Every run with
`env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy`; the suite refuses to start otherwise
and nothing reached the network. Chromium at `/opt/pw-browsers/chromium`. **No repo file was edited
except this one, nothing was committed, nothing was pushed.** Probes are in the scratchpad.

---

# THE THREE BLOCKS

## B1 — `./release_check.sh` fails on this commit. Run it.

Measured, verbatim:

    RELEASE CHECK FAILED: README.md has no version-history row for app-v72.
    RELEASE CHECK FAILED: a chain report exists that this gate cannot read.
      Unreadable: outputs/PM_app-v72.md

README.md's version history stops at app-v71. The gate also requires that row to name the cache key
`chemowell-app-v72-1`. `sw.js` **is** bumped and `APP_VERSION` **is** `app-v72`, so this is the
documentation half of the deploy workflow, not the mechanics half — but it is mandatory here, the
gate enforces it, and two releases (app-v54, app-v55) once shipped with no row at all, which is why
the check exists. `PUBLISHED.json` still records app-v71, correctly, since nothing is live yet.

The PM sign-off's header is separately unreadable to the gate. Whatever it says, the gate treats it
as an objection it cannot see. Both are fixed by editing two files; neither needs a re-audit.

## B2 — a false comment survived the commit that made it false

`test/v72-med-purpose.mjs`, three lines above the form guard:

    // A schedule written in WORDS passed care-tracker's digit-only guard. Dosage forms are allowed;
    // WHEN and HOW MUCH are not.

The commit directly below it is titled *"no entry may name a dosage form, route or body site"*. The
previous pass reported this same line. This is the third occurrence of the false-source-comment class
in this one release (F3 and F4 were the other two), and this time it was reported and then left in
place while the code around it was edited. Delete the clause.

## B3 — the guard's name still claims a class it does not enforce

I evaluated the shipped `FORMY` regex directly against 27 candidate sentences a future editor could
plausibly write. It catches: `A liquid you swish around your mouth`, `An infusion given in the vein`,
`Taken by mouth`, `A suppository for constipation`, `A numbing skin cream`. It **passes** all of
these:

| candidate line | verdict |
|---|---|
| `A pill you swallow to ease pain.` | passes |
| `Given as a shot under the skin.` | passes |
| `Given through a drip.` | passes |
| `Numbs the skin.` | passes (`on the skin` is pinned; `the skin` is not) |
| `Placed under your tongue to ease pain.` | passes (`under the tongue` is pinned; `your` is not) |
| `A numbing medicine you rub onto a sore spot.` | passes (`rub on` is pinned; `\b` blocks `onto`) |
| `A numbing medicine you rub into a sore spot.` | passes |
| `Applied where it hurts.` | passes (`applied to` is pinned) |
| `Numbs the part of the body it is used on.` | passes — **and this is the shipped lidocaine line** |

`pill`, `shot` and `drip` are the three most ordinary English words for a dosage form and none of
them is on the list. I also ran the whole mutant build with `'lidocaine': 'A numbing medicine you rub
onto a sore spot.'` — a route and a body site in one sentence — and the suite reported **27/27
GREEN**, exactly as it did last pass. Widening the word list did not change that; it cannot, because
the check is a ratchet over specific strings and its name describes a class.

**This project has already decided what to do about this.** The app-v70 record says it out loud: *"A
check that prints a false sentence in green is worse than no check, because the total still reads
healthy."* Keep the ratchet — it is worth having, and it caught the real regression, see below — but
rename the printed line to **"NO entry names one of these dosage forms"** so the next reader is not
told a class is closed when a word list is.

---

# WHAT I TRIED TO REOPEN, AND COULD NOT

## The four earlier blocks are all genuinely closed

* **Tylenol Liquid.** The table now reads `'tylenol liquid': 'Eases pain.'`, identical to `'tylenol'`.
  No form language anywhere in the 42 entries; I checked all 42 against the guards directly and none
  is flagged.
* **The guard now bites on it.** Mutant restoring `'Eases pain. This is Tylenol in liquid form.'` →
  **26/27**, red on the form guard, naming the entry. It was green on this same input last pass.
* **Lidocaine** reads `'Numbs the part of the body it is used on.'` — true of the cream, the patch,
  the viscous rinse and an injection. (Systemic IV lidocaine remains the one form it does not
  describe; a hospital drug, still worth a line in BACKLOG rather than a release.)
* **British idiom** — every entry is American register. The suite fixture still types "sickness" as
  the *user's own words*, which is correct and proves typed text survives verbatim.
* **The disclaimer** renders only when at least one line is on screen. Mutant forcing it
  unconditional → **26/27**, red at `lines=0 disclaimer=1`.

## Every new or changed check can fail. Eight mutants, built and run

| mutant | result |
|---|---|
| unmodified HEAD | **27/27** |
| `acetaminophen` = "Eases pain and lowers a high temperature." | **26/27** — fever guard red (the `temperature` word was added and it works) |
| `tylenol liquid` form clause restored | **26/27** — form guard red |
| `dexamethasone` = "A steroid given after chemotherapy…" | **26/27** — schedule guard red (`chemotherapy` added and it works) |
| disclaimer forced unconditional | **26/27** |
| `purposeLookup` reverted to a bare `MED_PURPOSE[k]` | **24/27** — `0 editable rows`, and the real `TypeError: Failed to execute 'appendChild' … parameter 1 is not of type 'Node'` |
| editor seeded with `purposeOf(base)` instead of a placeholder | **25/27** — the box is pre-filled and the wording freezes into the record |
| `purpose` dropped from the save path | **24/27** — asserted from storage, `<<missing>>` |
| `lidocaine` = "A numbing medicine you rub onto a sore spot." | **27/27 — GREEN. See B3.** |

The bare-index mutant is the important one: it reproduces the care-tracker failure exactly — the Meds
screen comes up with **zero** cards, which is the only screen where edit and delete live — and the
suite catches it three ways. That check is real.

## The `h()` / prototype-key trap — attacked harder than the suite does, still holds

I created real medications named `Constructor`, `__proto__`, `hasOwnProperty`, `toString`,
`valueOf`, `isPrototypeOf` and `To String`, plus two whose **generic name** field was `constructor`
and `__proto__` — the editor path the suite never exercises — and rendered all fourteen at 320px.
**14 of 14 editable rows, zero page errors, no purpose line on any of them.** Opening the editor for
`Constructor` and for `__proto__` shows an empty box with the generic `For example: settles nausea`
placeholder and raises nothing. `medPurposeKey()` lowercases and strips non-alphanumerics, so
`__proto__` → `proto`, `toString` → `tostring`, `hasOwnProperty` → `hasownproperty`; only
`constructor` survives normalisation at all, and `Object.prototype.hasOwnProperty.call` catches it.
Belt and braces.

## The record cannot be lost or frozen — checked on the path a real device takes

* Typed text wins, clearing returns to the built-in line, an untouched save stores nothing. All four
  states asserted **from storage**, not from the screen.
* **A gap in the suite that I closed by hand:** nothing asserts that a typed purpose survives a page
  **reload**. It does — `normalizeMedication()` spreads `...original`, so the field passes through —
  but that is a property of one spread nobody is guarding. I typed a line, saved, reloaded, and read
  it back off both the screen and localStorage. Worth one more `t(...)`.
* The **backup** carries it: `cwBkCollect()` takes the med config raw, so `purpose` travels into a
  plain and an encrypted backup and comes back on restore.
* `purposeOf` is read-only. No delete path, no correction path, no timestamp, no tie-break — this
  release cannot lose a record.
* Text is rendered through `document.createTextNode`, so a purpose of
  `<img src=x onerror="window.__pwned=1">` renders as literal characters. `window.__pwned` was
  `undefined`. No markup path.

---

# NEW, NOT BLOCKING — but each should be written down rather than rediscovered

## N1 — the generic-name fallback quietly undoes the Tylenol PM safety argument

The source comment argues, and the last pass certified, that `Tylenol PM` correctly gets **no** line
because it contains diphenhydramine and *"Eases pain"* would be the wrong line on the right
medication. **Measured: a medication named `Tylenol PM` with its Generic name field set to
`Acetaminophen` DOES render "Eases pain."** — because `purposeOf` falls back to `purposeLookup(med.sub)`.
And the app's own Help topic `med-generic-name` tells the user to do exactly that: *"Put the other
name in Generic name if it helps."*

The resulting line is true but incomplete — it says nothing about the sedating half. I could not
construct a case where the `sub` fallback produces a **false** line, since the generic named really
is a component, so this is not a block. But the safety property the file claims is not the property
the code has, and no check in the suite exercises the `sub` fallback with a combination product.

## N2 — the table is thin in exactly the places an oncology patient types

42 keys, roughly 30 distinct drugs, and the brand/generic pairing is inconsistent. Absent entirely:
**Neulasta** (pegfilgrastim is in the table; the brand almost every patient actually types is not),
**Reglan / metoclopramide** and **Phenergan / promethazine** — two of the commonest rescue
antiemetics in chemo — plus **Emend / aprepitant**, and the missing brand halves of drugs already
present: Colace, Zoloft, Paxil, Neurontin, Prilosec, Pepcid, Motrin, Buspar, Ultram, Lidoderm,
Percocet, Norco, OxyContin. A miss is safe by design, so nothing here is dangerous; but with no
default medication list, "nothing is recognised" or "one of four is recognised" is the ordinary case,
not an edge case, and that is worth knowing before anyone writes copy promising more.

It also keeps alive the wording point the last pass raised and did not block on: the notice says
*"The line under each medication…"* on a screen where most medications will have no line. *"The lines
under your medications are general information, not medical advice"* is true in every state.

## N3 — free text in a narrow card has no `overflow-wrap`

A purpose of 400 unbroken characters makes the Meds page scroll sideways at 320px (`scrollWidth`
4039 against a 320 viewport). **Pre-existing class, not new:** app-v71's `note` field does the same
thing (3318) and v72 simply adds a second free-text field to the same card. A realistic worst case —
a pasted 89-character URL — wraps correctly and does not overflow. One CSS property
(`overflowWrap: 'anywhere'`) on both fields closes it whenever someone is in there.

## N4 — the commit message cites falsification numbers this repo cannot produce

`daf3639` records *"restoring the form clause turns the widened guard red (30/31), removing it turns
it green again (31/31)"*. This repo's gate is a **27**-check suite; 30/31 is another app's. The
change is real and I re-falsified it here (26/27 → 27/27), but the number in ChemoWell's history is
not from ChemoWell's gate — same claim-accuracy class as B2.

## N5 — housekeeping confirmed fixed

The four NUL bytes are gone (`file` now reports JavaScript source, `grep` reads it without `-a`), the
sentinel is `'<<no such entry>>'`, and `outputs/PM_app-v72.md` says 42, matching the shipped table.

---

# DELIBERATELY EXEMPT, said out loud

* **iPhone rendering.** This sandbox has Chromium only. I measured 320px; an iPhone at large text
  sizes is Aaron's phone, not mine, and never will be reproducible here.
* **Home is asserted clean, not skipped** — `[data-med-purpose]` count is 0 on Home, an exemption
  written as an assertion.
* **The user's own typed text is never audited by any guard**, by design. The guards read
  `MED_PURPOSE` only. Her sentence is hers.
* **Clinical accuracy beyond what is named here.** I read all 42 again looking for a second entry
  naming a product, a route or a body site, or something true of only one form. There is none left.
  `'iron'` remains circular and harmless. I am not a clinician; `BACKLOG.md` already carries the
  standing item for a periodic clinical re-read, which is the right home for it.
* **Interaction, per Rule 5.5.** This release adds no overlay, no modal and nothing that scrolls; the
  only new interactive surface is one text input inside the existing medication editor, which the
  suite drives end to end. Nothing here needs a scroll-lock case.

---

# WHAT WOULD CLEAR THIS

One commit, no re-audit of the mechanics — nothing below reopens the build:

1. **README.md**: add the app-v72 version-history row, naming `chemowell-app-v72-1`.
2. **outputs/PM_app-v72.md**: give it a header the gate can read — first two non-blank lines,
   flush left, `AUDITED-COMMIT: <sha>` then `VERDICT: …`.
3. **test/v72-med-purpose.mjs**: delete *"Dosage forms are allowed;"* from the comment, and rename
   the check to *"NO entry names one of these dosage forms"*.
4. Then `./release_check.sh` and one clean run of the suite.

Optional in the same pass, none of it blocking: a `t(...)` asserting a typed purpose survives a
reload; a line in BACKLOG for N1 (the generic-name fallback), N2 (the missing brands) and the IV
lidocaine residual; `overflowWrap` on the two free-text fields; and the disclaimer reworded to
*"The lines under your medications…"*.

Note for whoever runs the gate: `outputs/AUDIT_app-v72.md` also matches the `AUDIT*app-v72*` glob and
states a refusal against an older sha. Expect it to be listed as present and not current; leave it
where it is, it is the record of passes one and two.
