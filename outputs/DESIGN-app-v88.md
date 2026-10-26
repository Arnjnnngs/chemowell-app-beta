# Designer pass — app-v88

**Run late, and the PM refused the release for its absence.** That is the correct refusal: v88 adds
**four new on-screen controls** and all four audit reports exempted 320/360 overflow with the same
words — *"the Designer owns that"* — while the Designer never sat down. v84 through v87 each
produced a pass; v88 adds more controls than v87 did and produced none until now.

**Everything below is measured on the rendered page**, not read from source. That distinction is
not pedantry on this release: the one user-visible defect it shipped — literal `**asterisks**` in
the What's New notice — was invisible in the source and obvious on screen, and four audit rounds
read the source.

12 screenshots in `outputs/design-app-v88/`, at 320, 360 and 390 wide, device scale 2.

## The four new controls

| | 320 | 360 | 390 | floor |
|---|---|---|---|---|
| Logger note input | 256×46, 16px | 296×46, 16px | 326×46, 16px | 44px tap, **16px font** |
| `Log another day` button | 134×44, 13px | 134×44 | 134×44 | 44px tap |
| Corrector note input | 256×46, 16px | 296×46, 16px | 326×46, 16px | 44px tap, **16px font** |
| Modal value select | 52px, 16px | 52px | 52px | 44px tap, **16px font** |
| Modal note input | 48px, 16px | 48px | 48px | 44px tap, **16px font** |

**Every text input is 16px.** That is not a style choice — below 16px, iOS Safari zooms the page on
focus and the caregiver loses their place mid-sentence. All three new inputs clear it.

**No control in the new modal is under 44px.** Measured, not asserted: every button in the dialog
was enumerated and the count under 44px tall is **zero**, at all three widths.

## The modal, which nobody had ever seen rendered

* **Closed calendar:** 280×465 at 320 wide, 320×465 at 360 and 390. Fits the viewport at all three.
* **Calendar open — the tallest state the dialog has, and the one worth checking.** 776px tall,
  with **Confirm at y=785 of an 844px viewport**. Reachable without scrolling, at every width.
  **59 pixels of margin**, which is thin but real, and it is the state a caregiver reaches by
  tapping the date pill — the common path, not an edge case.
* **31 day cells, none under 32px.** No tiny tap targets in the calendar grid.
* `document.scrollWidth === window.innerWidth` at 320, 360 and 390 on every screen the release
  touches. **The new controls introduce no horizontal overflow.**

## What I did NOT find, and one thing the PM found that I must record

**The PM ran `overflow-scan` because nobody had, and it is not clean: three overflows on Home at
320px.** It then did the right thing and proved they are **pre-existing** — it extracted app-v87's
published `index.html` and got character-identical output. **Not chargeable to this release**, and
not fixed here.

**But the finding underneath it is this release's business.** The last two Designer passes recorded
*"overflow — clean"* while that suite reports three. **Two instruments disagree and nobody
noticed.** A Designer pass that says "clean" while a committed suite says otherwise is worth less
than no pass at all, because it is a false reassurance in the record. That is logged for its own
task rather than guessed at here — I do not know yet which instrument is wrong.

## Exempt, and say it out loud

* **Chromium only.** There is no iPhone in this sandbox. Safari's rendering, its form controls and
  its keyboard behaviour are **untested**, and the 16px floor above is the mitigation for the one
  Safari behaviour that is predictable without a device.
* **Nothing here has been on a real phone.** Touch targets are measured in CSS pixels in a
  simulated viewport, which is not the same as a thumb.
* The 59px of margin under Confirm with the calendar open is measured at 844px tall. **A shorter
  phone will need to scroll**, and the dialog does scroll internally — but I have not measured
  where it starts to.

## For Aaron to check on his own phone

1. **Reports → Appetite.** The note box and the `Log another day` button are both new.
2. **Tap `Log another day`, then tap the date.** That opens the tallest thing this release built;
   confirm the Confirm button is reachable without fighting the page.
3. **Pick a past day, type a note, then change your mind and pick a different day.** That exact
   sequence broke twice during this release.
