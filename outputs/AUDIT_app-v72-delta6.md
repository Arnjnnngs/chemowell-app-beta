# Zero Day Audit — ChemoWell app-v72, seventh pass (delta 6)

AUDITED-COMMIT: 69b9c3177193bda7b4e6b4755702d91cc6299006
VERDICT: DO NOT SHIP

`git rev-parse HEAD` at start and at finish: `69b9c3177193bda7b4e6b4755702d91cc6299006`, clean tree.
Nothing moved under me. Suite on HEAD: **40/40 green**, exit 0. `test/overflow-scan.mjs` on HEAD:
**170 of 170 combinations CLEAN**, exit 0. `./release_check.sh` fails only on the five standing
refusals from passes 1–6. No test touched real Firestore: every request off 127.0.0.1 was aborted,
the CDN scripts stubbed.

# HEADLINE, IN PLAIN WORDS

**Two things, and the first is the one that would reach Brandi.**

**1. The one-line CSS rule this release added has visibly broken two screens.** On Home, the
hospital-stay banner — the one that says doses given by hospital staff are not counted as missed —
now renders as a 28-pixel-wide column of shredded words, thirty-two lines tall, splitting words
mid-syllable: `hos / pit / al`, `you / rsel / f.` The banner grows from 182 pixels to **740**. On the
In-Patient screen the heading reads **"IN-PATIEN / T / STATU / S"**. The word "Clear" on Home's
treatment card breaks into three lines inside its own button. None of this existed in app-v71; all of
it is caused by the single line added at index.html:39, and it happens at **every width I tested**
(320, 360, 390, 428), not only on a small phone.

**2. The check written to close pass 6's block never goes to Home.** The new case is named *"HOME does
not scroll sideways at 320px with a pasted medication name"*. It navigates by clicking a button whose
text is exactly `Today`. **There is no such button** — the tab is labelled **Home**. I instrumented the
suite: the click returns `false`, and the tab still current when the measurement is taken is **Meds**.
So the sixth case measures the same screen the other five measured, which is precisely the defect pass
6 blocked on. It is green because the CSS rule happens to fix Home, not because anything checked Home.
Proven: on a build where Home is broken at **900px** with the tab bar stretched to 900px, that check
still prints PASS and the suite still prints **40/40**.

That is the **seventh consecutive pass** in which a check on this release printed green while the thing
it names was broken. The release's own table of that pattern is accurate and is now one row short.

# BLOCKING

## B1 — `*{overflow-wrap:anywhere}` is a layout regression on two caregiver screens, at every width

Method, so it can be repeated. Three files, identical except for the one line: HEAD; HEAD with only
`overflow-wrap:anywhere` deleted from the reset; and `git show 4e5b91f:index.html` (app-v71). Same
localStorage fixture as `overflow-scan.mjs` — an active hospital stay, two treatment dates, a logged
dose, a symptom note. Every element on twelve screens (five tabs, six drawer screens, the medication
editor) measured at 320/360/390/428 and diffed by DOM path. Chromium only; iPhone rendering is exempt
and stated as exempt, as on every release here.

Against **app-v71** and against **the same build without the line** — identical results, so this is the
line and nothing else:

| Where | app-v71 / no-rule | **HEAD** |
|---|---|---|
| Home, hospital-stay banner text column | 207px wide, 96px tall | **27.6px wide, 710px tall** |
| Home, banner body copy | 4 lines | **32 lines** |
| Home, whole banner | 182px | **740px** |
| Home, page scroll height at 320px | 2736px | **3310px** |
| Home, "Clear" button (treatment card) | 1 line, 27px | **3 lines, 57px** (320px) · 2 lines, 42px at 360, 390 **and 428** |
| Home, journal row "Dexamethasone" | 1 line | **2 lines**, row 69px → 85px |
| In-Patient, heading "In-Patient Status" | 3 lines, 47px | **5 lines, 78px** — reads `IN-PATIEN` / `T` / `STATU` / `S` |

Screenshots taken at 320px on both builds; the banner crop is a vertical ladder of one-and-two-letter
fragments with no sentence readable in it.

**Why it happens, since the release's reasoning is the thing to correct.** The record says
`overflow-wrap` *"cannot change a layout except to stop a long unbroken word pushing the page
sideways."* That is true of `break-word` and **false of `anywhere`**: `anywhere` is defined to make the
break opportunities count toward **min-content intrinsic size**. Applied to `*`, every flex and grid
item in the app can now shrink to roughly one character. The banner at index.html:4587 is a
`display:flex` row with `flexWrap:'wrap'`, a `flex:'1'` text column and a `flexShrink:'0'` button; it
only fits at 320px because the text's min-content width used to push the button onto a second line.
With `anywhere` the wrap no longer triggers and the text is squeezed into what is left. The comment
sitting three lines below it — *"The wrap on the row above is the single load-bearing change, and it is
provable on its own"* — describes a fix this release silently disables.

**The evidence offered does not cover this.** I ran `test/overflow-scan.mjs` on HEAD: **170/170 CLEAN**,
exit 0, on the build pictured above. Every rule in that scan is a width rule — text wider than its box,
content wider than its box, past the left or right edge. A banner that goes from four lines to
thirty-two overflows nothing horizontally. The scan is not evidence that nothing else moved; it is
evidence that nothing got wider.

**What clears it.** Not `break-word` — I tested it and **it does not fix Home**: with the rule set to
`break-word`, Home with a pasted pharmacy name still measures **900px at 320px**, exactly as app-v71
does. (It does produce a zero-diff layout — 0 changes across all 48 screen/width combinations — so it
is safe and useless.) The property that fixes Home is the one that breaks these screens, because `*`
applies it to the app's **own fixed labels** as well as to what the caregiver typed. The class fix
belongs on the elements that render user-supplied text — the medication name, generic name, dose label,
note and purpose line, on Home and on Meds — not on every element in the document. Whatever is chosen,
the check has to be able to see a wrapped-to-32-lines banner, or the next pass finds this again with a
different component.

## B2 — The new HOME case cannot fail for the reason it names

`test/v72-med-purpose.mjs`, the block added at HEAD:

    await clickText(/^Today$/);

`clickText` returns `false` when no button matches, and the return value is discarded. Instrumented run
on HEAD, printed from inside the suite:

    PROBE: clickText(/^Today$/) returned false ; current tab = Meds ; buttons labelled exactly "Today" = 0

The measurement that follows is therefore taken **on the Meds screen** — the screen all five earlier
cases already measure. Falsified the only way that settles it: I built HEAD with the global rule removed
and the old per-card rule put back on the medication `article`, which is exactly the state pass 6
blocked (Meds fixed, Home untouched). On that build Home with a pasted name measures **900px at a 320px
viewport, with `nav` also 900px** — the tab bar off the side, the finding pass 6 wrote up — and the
suite prints:

    PASS  HOME does not scroll sideways at 320px with a pasted medication name  |  name=set page=320px nav=320px
    40/40 checks passed

The detail line even reports `page=320px` for a 900px page, because it is reporting the Meds screen. A
check that reports a number from a different screen than the one in its name is worse than no check.
Two further notes on the same block: `nav` is measured and never asserted, and if the rename-back at the
end fails, the failure surfaces four checks later as *"the typed line is still there after closing and
reopening the app"* — a red that blames persistence for a navigation problem.

## B3 — The accounting check accepts a line the suite cannot read: one space before the colon

`ENTRY_LINE` allows whitespace between the key and the colon; the table parser does not
(`/'([^'\n]+)':/`). So a line like the one below is **accounted for and never parsed**, and every guard
that reads `TABLE` passes it in silence:

    'morphine' : 'Brings down a fever. Take 15 mg by mouth every 4 hours as needed.',

Result on that build: **40/40, full green board**, including *"EVERY line in the table is one this suite
can read"*, *"NO entry tells anyone a medication brings down a fever"*, the dose guard, the schedule
guard and all four liveness lines. I then loaded the same file in the browser with a medication named
Morphine and read the Meds screen:

    ON SCREEN: Brings down a fever. Take 15 mg by mouth every 4 hours as needed.

A false clinical claim, a dose and a schedule, on the patient's medication screen, behind a green board.
This is the same shape as pass 5's double-quoted entry and pass 6's continuation line: the parser is the
hole, and the check written to guard the parser shares the parser's blind spot. The check's name is also
untrue as written — it accepts a line the suite cannot read.

Falsification of the four cases that ARE caught was re-run and holds: a `//` line is skipped, a
double-quoted key is red, two entries on one line are red, a template literal is red.

# NON-BLOCKING, worth writing down

* **N1 — two false REDs in the accounting check.** A trailing comment after a valid entry
  (`'zofran': '…', // brand name for ondansetron`) and a `/* … */` comment line inside the block are both
  legitimate JavaScript and both rejected. Measured: 39/40 each. A check that reddens on correct code
  teaches people to ignore it.
* **N2 — two claims in the records are false of what shipped.** `outputs/PM_app-v72.md`:
  *"`overflow-wrap` cannot change a layout except to stop a long unbroken word pushing the page
  sideways"* (untrue of `anywhere`, see B1) and *"the overflow scan across every screen at ten device
  widths is the evidence that nothing else moved"* (the scan measures width; the regressions are
  vertical). The README row repeats the CSS-reset claim.
* **N3 — README wording.** The app-v72 row contains *"falsified across the three apps in the three
  apps"*.
* **N4 — for the record, so nobody spends a round on it:** `overflow-wrap:break-word` in the reset is
  layout-neutral (0 differences across 48 screen/width combinations) and does **not** fix Home.
* **N5 — Voice.** The diff touched no caregiver-facing string. But B1 is a Voice failure by the second
  question: the hospital-stay banner is true, plain and well written, and on HEAD a tired person at 2am
  cannot read it, because it is thirty-two lines of broken syllables. No dose, no schedule, no advice, no
  fever-suppression guidance and no British idiom was introduced anywhere in this diff.
* **N6 — placeholder semantics and the prototype trap re-checked on HEAD and unchanged:** unset stays
  unset, typing overrides, clearing returns the built-in line, a medication named `Constructor` renders
  no purpose line and raises no page error. Nothing frozen into stored config. Those are sound.

# WHAT I DID NOT COVER

Safari/WebKit rendering (Chromium only in this sandbox — standing exemption on every release here), the
beta and care-tracker ports, and Firestore/medsync behaviour beyond the stored-config check above.
