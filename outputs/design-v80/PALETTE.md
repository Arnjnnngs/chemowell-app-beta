# app-v80 — the palette that is already in the file, written down

Measured from the shipped `index.html`: **84 distinct hex colours, 1,132 uses**, plus 139 distinct
`rgba()` values used 449 times. Nobody chose these as a set; they accumulated one style object at a
time over eighty releases. The census is the design work — naming them is what makes the
inconsistency visible, and most of the tail below is not a colour, it is a decision nobody made.

## The twenty that carry the app (≈900 of 1,132 uses)

| Token | Hex | Uses | Role |
|---|---|---|---|
| `--card` | `#FFFFFF` | 139 | every card and input surface |
| `--ink` | `#2A2127` | 138 | primary text |
| `--ink-2` | `#554A52` | 75 | secondary text |
| `--ink-3` | `#7A6E76` | 92 | muted text, captions |
| `--ink-warm` | `#915E48` | 78 | the brown label text on card headings |
| `--line` | `#E9D8D1` | 89 | every border |
| `--header` | `#FDDCCE` | 8 | the sticky header ground |
| `--act` | `#BF4C1A` | 99 | primary action |
| `--act-deep` | `#A83D0F` | 75 | pressed / high-emphasis action |
| `--act-bright` | `#E46F3C` | 32 | gradient top, highlights |
| `--act-dark` | `#8B3C1B` | 11 | action text on a light ground |
| `--stop` | `#C0453B` | 34 | over a limit |
| `--stop-2` | `#A5443C` | 20 | missed-dose text |
| `--stop-deep` | `#8E2018` | 6 | the darkest warning text |
| `--due` | `#9A6419` | 28 | approaching a limit |
| `--due-2` | `#8C5900` | 14 | the beta strip, amber notices |
| `--ok` | `#0A6B4A` | 16 | logged, on track |
| `--ok-2` | `#2E7D4F` | 10 | secondary green |
| `--ink-brown` | `#5E4337` `#6D5247` `#745649` | 40 | three browns doing one job |

## The finding, and it is a design finding rather than a code one

**Forty-four colours are used once or twice — 54 uses between them.** Among them: four separate
greens (`#0A6B4A`, `#2E7D4F`, `#0C7F57`, `#0F9D6B`) that all mean *done*; three browns within six
luminance points of each other; `#FFA6AE`, `#FFC18B`, `#FFE1B8` at 100% saturation, which belong to
no other colour on the screen.

**None of that is visible while the values are written inline.** It becomes obvious the moment they
have to be named, because naming forces the question *what is this one FOR that the other three are
not?* — and for most of the tail the answer is nothing.

## How app-v80 uses this

1. The twenty above become tokens. Mechanical, and the pixel-identity suite proves nothing moved.
2. The tail is **collapsed onto the twenty**, one at a time, each collapse its own commit — and each
   one **will** move pixels, so each is a deliberate visual change reviewed on its own rather than a
   thousand-line diff nobody reads.
3. Only then does the redesign's own palette get applied, as edits to twenty values instead of a
   search across fifteen hundred.

Step 2 is the one that cannot be automated and should not be rushed: four greens collapsing to one
is right; `#FFA6AE` might be a deliberate cue on a screen nobody has looked at in a year.
