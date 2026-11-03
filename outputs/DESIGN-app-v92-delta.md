# Designer — app-v92 delta: the badge row the Blocker-2 fix changed

The app-v92 delta audit's last finding was that **nobody had looked at the state the badge fix
changes.** `DESIGN-app-v92.md` covers the long-name row carefully and never mentions the badge; no
designer pass had ever rendered an `override` + `skipped` entry, which is the same reason
`overflow-scan` could not see it. The auditor measured the UNFIXED box at 89x74 and said in plain
words that the fixed one must be taller and that it had not measured it.

It is. This pass renders it, at four widths, and the answer is not the one the fix wanted.

## What is on the screen, measured

`falsify/probe-badge-row.mjs`, one medication (`Hydroxychloroquine`), two entries, the first
`override: true, overrideReason: 'offDay+early+overLimit', skipped: true`. Text rects by Range.

| width | build | badge box | line boxes | mid-word break | text past its own box |
|---|---|---|---|---|---|
| 320 | **shipped** | **77 x 110** | **6** | **yes — `SCHEDUL` / `ED`** | 0 |
| 320 | pre-fix | 89 x 74 | 4 | no | 0 |
| 330 | shipped | 87 x 74 | 4 | no | 0 |
| 330 | pre-fix | 89 x 74 | 4 | no | 0 |
| 360 | shipped | 117 x 74 | — | no | 0 |
| 390 | shipped | 147 x 38 | — | no | 0 |

No horizontal page overflow at any width in either build (`scrollWidth == innerWidth`, all four).

**At 320px only, the fix made this visibly worse.** The badge is squeezed from 89px to 77px, which
is below the width of its own longest word, so `overflow-wrap: break-word` does what it is for and
splits `SCHEDULED` across two lines. A status label on a medication row now reads
`NOT / SCHEDUL / ED · / EARLY · / OVER / LIMIT` in a 110px-tall pink block. Screenshots:
`before-badge-320.png` and `after-badge-320.png` beside this file.

## Why it is still right to ship

The two states are bad in different conditions and the fixed one is the less bad:

* **Pre-fix**, in a crowded row — which is what `overflow-scan`'s richer fixture renders and this
  probe's simpler one does not — the badge's text line plus its padding ran **21px past the column
  it sits in** at 320px and 11px at 330px. Text escaping its column lands on or under the Remove
  control. That is the defect the audit found and it is functional.
* **Post-fix**, at 320px, the badge is ugly and contained. Nothing escapes anything, nothing is
  unreadable, nothing is covered.

A contained ugly wrap beats text leaving its column and running into a control. Ship it.

## The root cause, which is neither of those, and the decision it needs

**The content column is 77px wide at 320px.** The card's 280px of inner width is spent on the time
group (~85px with the dot and gaps), the `Remove` text button (~72px) and the gaps. `SCHEDULED` at
10px bold uppercase with letter-spacing measures ~85px, so nothing that keeps the badge inside that
column can avoid breaking it.

Three ways out, none of which belongs in a remediation commit, all of which change something Aaron
would see:

1. **Icon-only `Remove` at <= 345px** — already proposed by the Designer pass for app-v92 and not
   built. Gives the column back ~40px, which is enough: `NOT SCHEDULED` then fits on one line.
   **Recommended.** It is also the only one of the three that helps every narrow row, not just this
   badge. Size: S. It is a control change, so it is Aaron's call, not the builder's — Rule 2.6:
   *"never widen a release on its own ... every extra control is a new way to mis-tap."*
2. **Drop the uppercase and letter-spacing on this badge.** Longest word becomes `scheduled` at
   ~52px, which fits 77px with room. Cheapest, and it changes the visual language of a badge type
   across the app. Size: S.
3. **Give the badges their own full-width line below the row**, instead of inside the content
   column. Correct in principle, three render sites, and it changes the shape of every row that
   carries a badge. Size: M.

Logged as `BACKLOG` M39-g. Nothing here blocks app-v92.

## What this pass did NOT look at, and what the audit then looked at

This pass rendered only the Home timeline's badge row, at four widths, in one state. **The
delta2 audit closed most of that gap by attacking the judgement above.** It rendered the History
report with the same `override` + `skipped` fixture at four widths and found it **milder** than
the Home row this argument was made about: at 320px the badge is 101x74 over 4 lines, against
Home's 77x110 over 6, with zero text overflow and no page side-scroll at 320 / 330 / 360 / 390.
So the worst case is the one measured here, and the conclusion holds.

`missedRow` is still unrendered by anybody. Its badge is the literal `'Missed'` — one six-letter
word — so it cannot produce the multi-line wrap this pass is about, which is why nobody held a
release for it. It is logged as `BACKLOG` M39-j as the one surface no gate and no designer pass
has ever looked at.
