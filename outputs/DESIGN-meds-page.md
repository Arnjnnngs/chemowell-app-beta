# DESIGNER — the Meds page, before the rebuild

Run with the Enhancer, before the build, per `TEAM-ORDER.md`. **This is the first Designer pass run
as a role rather than as screenshots taken afterwards.**

Measured on the running app at **320 / 360 / 390**, with a 59-character medication name, two dose
options and a gap rule — the longest realistic content the screen can hold.

## What is sound, and should not be touched

| Check | 320 | 360 | 390 |
|---|---|---|---|
| Page width (does it scroll sideways) | 320 ✓ | 360 ✓ | 390 ✓ |
| Text clipped or truncated anywhere | none ✓ | none ✓ | none ✓ |
| Tap targets below 44 px | none ✓ | none ✓ | none ✓ |
| Page errors | none ✓ | none ✓ | none ✓ |

A 59-character medication name wraps and does not push the page out at any width. **That is the
app-v75 Home defect not recurring here**, and it is worth recording as a pass rather than assuming.

## D1 — Five elements render below 12 px, the smallest at 10 px. *(S)*

The floor this project already enforces is **16 px on anything you type into**, because iOS zooms the
page below that. There is no written floor for *display* text, and five elements on this screen sit
at 10–11 px.

**This is a legibility finding, not a lint rule.** The reader is frequently exhausted, sometimes
nauseated, often holding the phone one-handed at 2 am, and a meaningful share of this app's users are
over sixty. 10 px is small in a design tool and smaller in a hospital corridor.

**Proposed:** a display floor of **12 px**, with anything load-bearing at 13 px or more, and say out
loud which elements are deliberately below it and why.

## D2 — Bare `▲` / `▼` glyphs as controls. *(S)*

Two collapse toggles on this screen are an unlabelled triangle in a `<span>`. They are large enough
to tap and they work; they have no accessible name, and a triangle alone does not say what it
collapses. **Proposed:** an `aria-label` naming the section, and the section's own name beside the
glyph where there is room.

## D3 — The card is a wall of key-value prose. *(M — the same item as Enhancer E5)*

> Doses: 500 mg · 1000 mg · **Rules:** Min 4-hour gap · Own Home card

Four different kinds of fact in one undifferentiated run of text, in one weight and one colour. The
mockup Aaron approved separates them: the schedule on its own line, a **status pill** (*On track* /
*Cycle* / *Paused*) as the one thing you can read at a glance, and the ceiling as **a bar** rather
than a sentence. A bar answers *how much is left today* without reading; the current card requires
reading and then arithmetic the app has already done.

## Deliberately exempt, said out loud

- **iPhone rendering.** This sandbox has **Chromium only**. Font metrics, safe-area insets and
  Safari's own form controls cannot be reproduced here. Every measurement above is Chromium at
  Apple viewport sizes, and the rebuilt screen must be opened on the two real phones before anyone
  calls it verified.
- **Dark mode** is not measured, because the app does not offer one.
- **Contrast is not measured on this screen.** `test/v80-contrast.mjs` exists but only knows the
  Home hero. Extending it to a second screen is its own item and is written up in
  `outputs/NEXT-RELEASE-FROM-v80.md`.
