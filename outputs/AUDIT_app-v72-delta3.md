# Zero Day Audit — app-v72, third re-audit (delta 3)

AUDITED-COMMIT: 38bf3ddc4ad40fa8dab5f01d4d8fdec17ab96472
VERDICT: DO NOT SHIP

**Headline, in plain words. The three things the last pass blocked on are genuinely fixed — the
release gate no longer complains about the README or the PM file, the false comment is gone, and the
guard is renamed and much wider. I am refusing on what the FIX introduced, and two of the three are
checks that report green while the thing they guard is broken. (1) The four brand-new "can this guard
actually fire?" checks were added because a guard in the sibling repo had been dead for weeks. Two of
the four do not protect anything: they re-type the pattern instead of using the guard's own one. I
killed the fever guard exactly the way the sibling's was killed, put "Eases pain and brings down a
fever." on acetaminophen, and the suite printed 34/34 GREEN — including the line that says "the
fever guard can actually fire". This app tracks Temperature and the release's own stated safety
decision is that no line may ever tell anyone to bring a fever down. That check is now decoration.
(2) The new 320px sideways-scrolling check measures the page against a ruler that stretches with the
page. Three ordinary inputs — a pasted pharmacy name with no spaces, a pasted MyChart URL in the
existing note field, a long generic name — each make the Meds screen 413 to 447 pixels wide on a
320-pixel phone, and the new check says PASS on all three. The wrapping fix was applied to one of the
four free-text fields on that card. (3) The suite comment AND the shipped README row both state a
rule the code does not follow: "it bans route, not anatomy". The list bans the bare words skin,
tongue and vein, so "Eases itching and swelling of the skin" is rejected while "Settles the stomach"
passes. A future editor is being told the opposite of what the check does, in the record.**

Fourth pass, 2026-09-08. HEAD was `38bf3ddc4ad40fa8dab5f01d4d8fdec17ab96472` when I started and the
same, with a clean tree, when I finished — nothing moved under me. Suite **34/34** at this commit.
Every run with `env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy`; nothing reached the
network, every probe stubbed the same way the harness does. Chromium at `/opt/pw-browsers/chromium`.
**No repo file was edited except this one. Nothing was committed. Nothing was pushed.** Every mutant
and probe is in the scratchpad, outside the repo.

---

# THE THREE BLOCKS

## B1 — two of the four new liveness checks vouch for a guard they do not touch

The reason these checks exist is written in the suite: the sibling repo's copy of the form guard had
a doubled backslash, could never match anything, and sat green for weeks over a sentence an audit had
already blocked. The cure was to hand each guard a sentence it MUST reject.

It works for two of them and not for the other two, because of where the pattern lives.

* The form guard and the schedule guard are named constants (`FORMY`, `SCHEDULEY`). The liveness
  check calls the same constant, so breaking the guard breaks the liveness check.
* **The fever guard and the number guard are written inline, and the liveness check re-types the
  pattern.** Two separate copies. Break the one that reads the table and the one that proves it
  fires is untouched.

Measured, not argued. I made one edit — the fever guard's own regex, from `/fever|...` to
`/f\\ever|...`, the identical doubled-backslash typo the sibling shipped — and set acetaminophen to
`'Eases pain and brings down a fever.'`:

    PASS  NO entry tells anyone a medication brings down a fever
    PASS  the fever guard can actually fire
    34/34 checks passed

Same for the number guard: broke `/\d/` to `/\\d/`, set an entry to `'Eases pain for 6 hours.'` —
**34/34, both lines green.** Control, to prove the other two do work: the doubled backslash in
`FORMY` gives **33/34**, red on "the form/route guard can actually fire", exactly as intended.

The fix is three lines: lift the fever and number patterns into named constants and have both the
guard and its liveness check use them. **The same two decorative checks have already been ported into
`/home/user/care-tracker/harness/med-purpose-test.mjs` and
`/home/user/chemowell-beta/harness/med-purpose-test.mjs`**, so this is a three-repo fix, not one.

## B2 — the new 320px check passes on a page that really does scroll sideways

The check reads:

    t('a very long typed line does not push the page sideways at 320px', w.doc <= w.view + 1, ...)

with `w.view = window.innerWidth`. Under the mobile emulation this suite uses, **`window.innerWidth`
is not the width the test asked for — it grows to swallow the overflow** (Chromium's shrink-to-fit,
clamped at about four times the device width). So `doc` and `view` move together and the comparison
is nearly always true. Measured at a 320px viewport, with the shipped file:

    a pasted pharmacy name, no spaces (39 ch)   doc=447   innerWidth=447   the check would say PASS
    a pasted URL in the app-v71 note field      doc=413   innerWidth=413   the check would say PASS
    a long generic-name field                   doc=413   innerWidth=413   the check would say PASS
    plain baseline                              doc=320   innerWidth=320   correct

All three of those pages scroll sideways on the narrowest phone the app supports. The check sees
none of them. It only failed for me on the 300-character mutant because that overflow (2651) finally
exceeded the clamp (1280) — which is why it looked like it worked.

Two separate defects sit under that:

* **The assertion should compare against the literal 320 it set**, not against a number the browser
  is free to change. `w.doc <= 321`. Falsified: with `overflowWrap` stripped, the 300-character case
  gives `doc=2651 view=1280` and goes red; with it restored, `doc=320`.
* **`overflowWrap: 'anywhere'` went on the purpose line only.** The medication name, the generic-name
  line and the app-v71 note on the very same card have no wrapping rule, and with a 300-character
  name the Meds page measures **3267px wide at 320**. The previous pass recorded the note field
  overflowing and recorded that a pasted 89-character URL "wraps correctly and does not overflow" —
  **that second measurement is wrong**; I measured 413 at 320 for a realistic MyChart URL in the note
  field. Whichever way it is fixed, one of the two — wrap the whole card, or say in writing that
  only the new field is covered and the rest is a known app-v71 defect — has to be true before this
  ships, because the README currently implies the class is closed.

## B3 — a rule stated in the comment and in the README that the code does not implement

The suite comment says, and the shipped README row repeats almost word for word:

    THE LIST BANS FORM AND ROUTE, NOT ANATOMY. "Lowers stomach acid" and "slows the gut down" name
    the organ a drug ACTS ON ... "on the skin", "under the tongue" and "as a shot" name where a
    caregiver PUTS it

The list contains the bare words `skin`, `tongue`, `vein`, `rectal`. Evaluated directly against the
shipped pattern:

    Settles the stomach.                          passes
    Lowers stomach acid ...                       passes
    Slows the gut down to control diarrhea.       passes
    Numbs the skin.                               REJECTED
    Treats an infection of the skin.              REJECTED
    Eases itching and swelling of the skin.       REJECTED
    Eases soreness of the mouth and tongue.       REJECTED
    Helps prevent a blood clot in a vein.         REJECTED

Same grammatical shape, opposite outcome, and the anatomy the rule promises to allow is the anatomy
that gets rejected. This is not academic: skin care is a large part of chemo supportive care — hand
and foot syndrome, radiation dermatitis, hydrocortisone, barrier creams — and the plainest true
sentence about any of them names the skin. The next person to add one will read a comment telling
them anatomy is fine, watch the suite go red, and have to work out why. **This is the fourth pass in
a row on this one check, and the third time the sentence written beside it has not matched what it
does.** Fix it in one place and copy it to the other two: say that the list is a blunt word ratchet,
that it deliberately over-rejects a few body-site words, and that a legitimate line naming the skin
needs the word removed from the list and the reason recorded.

---

# WHAT I TRIED TO REOPEN AND COULD NOT

* **`./release_check.sh`** no longer fails on the README row or on the PM header. The only failure
  left is that two earlier audit reports say DO NOT SHIP, which is the gate working as designed. The
  README has an app-v72 row naming `chemowell-app-v72-1`; `sw.js` CACHE and `APP_VERSION` agree;
  `PUBLISHED.json` still records app-v71, correctly.
* **The false comment from the last pass is gone.** The clause "Dosage forms are allowed" is deleted
  and replaced with a true one. (A different false statement took its place three lines lower — B3.)
* **The eight sentences that walked through the old guard are all caught now**: pill, shot, drip,
  numbs the skin, under your tongue, rub onto, rub into, applied where it hurts. So is the old
  lidocaine line's replacement question — the shipped `'Numbs the area where it is used.'` names no
  form and no site, is true of the cream, the patch, the rinse and an injection, and reads plainly.
  It is the same in all three repos; I checked the files.
* **The reload check proves what it says.** The fixture's seeding script is guarded by
  `if (localStorage.getItem(...)) return;`, so the reload does not re-seed, and the typed line is
  read back off both the screen and localStorage. It is real persistence, not a render cache.
* **The `h()` / prototype-key trap holds.** A medication named `constructor` renders as an ordinary
  card with no purpose line and no page error; `medPurposeKey()` plus
  `Object.prototype.hasOwnProperty.call` covers the name field, the generic-name field and the
  editor. Nothing I typed produced a function where a sentence belongs.
* **Nothing here can lose a record.** The built-in line is still a placeholder, an untouched save
  stores nothing, clearing returns to the built-in, and the release adds no delete or correction path.

# NOT BLOCKING, BUT WRITE THEM DOWN

* **`IV` is not on the list.** "Given by IV" is the commonest route phrase in oncology and passes.
  So do plurals and inflections the list missed — creams, lozenges, sprayed, suppositories — and
  `sublingual`, `transdermal`, `wafer`, and any sentence naming the nose, the eye or the arm. The
  ratchet is worth keeping; it is a word list, and after B3 its name and comment will finally say so.
* **The disclaimer still says "The line under each medication".** It renders when at least ONE
  medication carries a line, and with no default medication list the ordinary case is one recognised
  drug out of four. "The lines under your medications are general information, not medical advice" is
  true in every state. This was raised last pass and not changed; it is one word.
* **No dose, no schedule, no advice, no fever guidance, US register throughout** — I read all 42
  entries and every string the diff touched. The copy itself is clean.

# HOW TO CLEAR THIS

B1 and B2 are code, roughly a dozen lines between them, and both are inside the test file plus one
style property. B3 is two sentences of prose in the suite and in README.md. None of it needs a
rebuild and none of it touches the feature, which held up under everything I threw at it for the
second pass running. Re-run the suite, re-run `./release_check.sh`, and the re-audit is a delta pass
over those three points.
