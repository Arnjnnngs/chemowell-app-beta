# DESIGN REVIEW — app-v56, the on-screen help bubble ("helpbot")

**Stage:** Designer (Quality Chain stage 3). **Author:** Designer agent, 2026-08-11.
**Reviewed against:** `outputs/DEV_BRIEF_v56_helpbot.md` §2 (geometry) and §3 (the panel), and the
app's own `TYPE` scale (`index.html:2355`) and existing component vocabulary.
**Implementation reviewed:** `index.html:6225–6597` (`helpBotVisible` → `renderHelpBot`), plus the
toast move at `index.html:3287` and the mount point at `index.html:3306`.

**Method:** rendered product, not code reading. 74 screenshots taken with Playwright against
`http://127.0.0.1:8899/index.html` at **320 / 360 / 390 / 430 / 519 / 520 / 521 / 768** px, plus a
landscape 740×400 and two simulated-keyboard heights (380 / 330). All geometry, contrast and
touch-target numbers below are measured from `getBoundingClientRect()` / `getComputedStyle()` in the
live page, not estimated. Screenshots in `outputs/v56-designer/` (naming: `A-` bubble per screen,
`B-` panel states, `C-` width sweep, `D-` transcript + keyboard, `E-` reports detail, `F-` reopen,
`G-` safe-area + rotate, `H-` reply edge cases, `I-` walkthrough comparison, `J-` icon crops,
`K-` bubble over content).

---

## Verdict

The panel is **structurally sound and a genuine improvement** — it is not a floating chatbot bolted
on. The tone work is right: no typing indicator, no avatar, no fake latency, and the "I don't have
an answer" state is styled as a normal outcome rather than an error. Nothing overflows horizontally
at any width I tested (`documentElement.scrollWidth - innerWidth === 0` at all eight widths, zero
elements extending past the viewport in either direction). Every touch target clears 44px. The
bubble hides correctly on setup, the tour, the drawer, every modal, the med editor and the Help
view, all confirmed live.

But it is **not yet App-Store-featured quality**, and three of the findings below are things a
frightened caregiver would actually hit tonight: a send button that points backwards, a landscape
rotation that turns the panel into a 724px-wide takeover, and 34px of dead space eaten out of the
panel on every notched iPhone. Those three are must-fix.

---

# MUST FIX

## M1. The send button's arrow points the wrong way — it reads as "Back", not "Send"

`index.html:6588`

```js
h('button', { type: 'submit', 'aria-label': 'Send question', style: { … } }, appIcon('arrow', 19))
```

`svgIcon`'s `arrow` glyph (`index.html:2411`) is
`<path d="M10 7 5 12l5 5"/><path d="M5 12h14"/>` — a chevron at x=5 opening **left**, with the shaft
running right. It is the app's **back** arrow, and the app uses it as exactly that: `backRow()` in the
Help view (`index.html:6602`) and the walkthrough back pill both render `appIcon('arrow', 17)` next to
the word "Back". The helpbot ships the identical unrotated glyph as its Send control.

Evidence: `outputs/v56-designer/J-send-crop.png` (2× crop of the button) and every `B-*` /
`C-answer-*` screenshot — the arrow visibly points left in all of them.

This is the single worst finding in the release. The composer is the one control the entire feature
exists for, and it is currently labelled with the app's own "go back / undo" symbol, sitting 8px from
a text field. A caregiver who has typed a question and is looking for the button that sends it is
shown a button that means the opposite. `aria-label="Send question"` is correct, so screen-reader
users are fine and sighted users are not — which is the worst split.

**Fix:** add a dedicated send glyph rather than rotating the back arrow (a rotated back-arrow still
reads as "forward/next", not "send"). Add to the `paths` map in `svgIcon` (`index.html:2400–2420`),
keeping the set's `stroke-width="1.9"`, `viewBox="0 0 24 24"` convention:

```js
send: '<path d="M4.5 11.9 20 4.5l-7.4 15.5-2.1-6.4-6-1.7Z"/><path d="m10.5 13.6 9.5-9.1"/>',
```

and change `index.html:6588` to `appIcon('send', 19)`.

If a new glyph is not acceptable in this release, the minimum acceptable stopgap is
`appIcon('arrow', 19, { transform: 'rotate(180deg)' })` — `appIcon`'s third parameter already merges
into the wrapper `<span>`'s style (`index.html:2422`), so this needs no other change.

---

## M2. Rotating to landscape leaves the panel in the phone layout, permanently

`index.html:6520` — `const wide = window.innerWidth >= 520;`

The breakpoint is read **once, at render time**, and nothing in the app re-renders on `resize`.
`helpBotSyncViewport()` (`index.html:6279`) does listen to `visualViewport` `resize`/`scroll`, but it
only writes `bottom` and `maxHeight` — it never touches the `left/right/width` branch.

Measured, live: open the panel at 360×800, then resize the viewport to 740×400 (an ordinary phone
rotation).

| moment | panel rect |
|---|---|
| immediately after rotate | `left 8, right 732, width 724, height 292` |
| 1.6s later (after the 1s tick) | `left 8, right 732, width 724, height 292` — **unchanged** |

Expected at 740px is `right: 14px; width: 380px`. Instead the panel spans the full screen at 724px
wide and 292px tall: a ~100-character line measure, the greeting reduced to one visible chip, and the
composer stretched across the whole display. Screenshot: `outputs/v56-designer/G-rotate-740x400.png`.
It never recovers — the only escape is closing and reopening the panel.

**Fix:** make the layout branch survive a resize without adding a re-render-on-resize (which the
brief rightly avoids, since `render()` from a viewport event destroys the focused input). Extend the
existing module-scope listener at `index.html:6279–6293` to write the width branch directly, in the
same style-mutation-only way:

```js
function helpBotSyncViewport() {
  const p = document.getElementById('helpbot-panel');
  if (!p) return;
  // width branch: mutate styles only, never render() -- see the caret bug note above.
  if (window.innerWidth >= HELPBOT_WIDE_MIN) {
    p.style.left = 'auto'; p.style.right = '14px'; p.style.width = '380px';
  } else {
    p.style.left = '8px'; p.style.right = '8px'; p.style.width = 'auto';
  }
  if (!window.visualViewport) return;
  … existing bottom / maxHeight code unchanged …
}
if (window.visualViewport) { … existing … }
window.addEventListener('resize', helpBotSyncViewport);
```

with `const HELPBOT_WIDE_MIN = 448;` added next to `HELPBOT_BASE_BOTTOM` (`index.html:6232`) and
`index.html:6520` changed to `const wide = window.innerWidth >= HELPBOT_WIDE_MIN;` so the constant is
stated once. Note the early `if (!p) return;` has to move above the `visualViewport` guard, otherwise
the width branch is skipped on WebViews without `visualViewport`.

**On the 448 value** (currently 520): measured panel widths below the breakpoint are 304px at 320,
344px at 360, 374px at 390, 414px at 430 and **503px at 519**. At 519 the panel is 503px wide and the
body text runs ~79 characters per line (`C-answer-519.png`) — roughly double the 40–50 the same 13.5px
type gets at 360. 448 puts the switch just above the widest real phone (430) so no phone changes, and
stops the 460–519 band from rendering a near-full-width slab.

---

## M3. The composer double-counts `env(safe-area-inset-bottom)`, costing 34px inside the panel on every notched iPhone

`index.html:6567` — `padding: '10px 10px calc(10px + env(safe-area-inset-bottom))'`

The panel is already positioned at `bottom: calc(84px + env(safe-area-inset-bottom))`
(`index.html:6525`). Its bottom edge therefore sits **84px above the top of the safe area** — it can
never reach the home indicator. Adding the inset again to the composer's bottom padding is pure dead
space, subtracted from a container whose height is capped at 560px.

Measured, live at 360×800 with a simulated 34px inset (iPhone 14/15/16 value):

| | no inset (Chromium default, inset = 0) | inset = 34px |
|---|---|---|
| panel bottom edge, from viewport bottom | 84px | **118px** — 84px of clearance already |
| composer height | 65px | **99px** (+34px) |
| transcript height | 426px | **392px** (−34px) |

Screenshot: `outputs/v56-designer/G-safearea-34px-sim-360.png`. The result on a real iPhone is a
composer that looks bottom-heavy and one fewer line of the answer visible, on the exact device class
most of this audience uses.

**Fix:** `index.html:6567`, change `padding: '10px 10px calc(10px + env(safe-area-inset-bottom))'`
to `padding: '10px'`. (The plans sheet at `index.html:2951` legitimately keeps the inset because it
is anchored at `bottom: 0`; this panel is not.)

---

# SHOULD FIX

## S1. The user's own message bubble is the app's primary-action colour, and reads as a button

`index.html:6422` — `background: mine ? '#BF4C1A' : '#FFF6F1'`, `color: mine ? '#FFFFFF' : '#554A52'`,
`fontSize: '13.5px'`, `fontWeight: '500'`, `borderRadius: '15px 15px 4px 15px'`.

`#BF4C1A` is not a neutral brand tint in this file — it is the **primary-action fill**, and only ever
that: the Log buttons on Home, "Get started" (`index.html:2916`), "+ Add" on Meds, the Symptoms add
button, the helpbot FAB (`index.html:6509`), the helpbot send button (`index.html:6588`), and
`helpBotChip`'s `primary` variant, i.e. "Open the full walkthrough" (`index.html:6374`).

The result is visible in `outputs/v56-designer/B-clinical-fever-360.png`: the user's own words
("is 101 a fever") render as a solid `#BF4C1A` rounded rectangle with white text, and 300px below it
"Open the full walkthrough" renders as a solid `#BF4C1A` rounded rectangle with white text. Same
fill, same text colour, same radius family, both full-bleed within their column. One is tappable and
one is a transcript of what the user typed. On a two-line question (`F-reopen-stale-360.png`) the
user bubble is 82% of the panel width and 100px tall — larger than any real button in the panel.

Contrast is also marginal: white on `#BF4C1A` measures **4.92:1**, which clears AA (4.5) for 13.5px
text but fails AAA and is the lowest text contrast anywhere in the panel.

**Fix (preferred, keeps the chat metaphor):** change `index.html:6422`'s `mine` background from
`#BF4C1A` to **`#A83D0F`** — already in this file's palette as the "rose label" colour named in the
`TYPE` header comment (`index.html:2353`) and used throughout the Help view for section labels. It is
visibly distinct from the primary-action fill at a glance, and lifts white-on-fill contrast from
**4.92:1 to 6.29:1**.

**Fix (alternative, more conventional):** make the user bubble quiet rather than solid —
`background: 'rgba(200,83,32,0.12)'`, `color: '#8A3D14'`, `border: '1px solid rgba(246,108,49,0.22)'`.
Those are the app's own existing "quiet accent" values (Related chips, `index.html:6700`; the Help
search Clear button, `index.html:6620`). This removes any possibility of the transcript reading as a
control, at the cost of a less familiar chat shape.

Either way, keep the asymmetric radius (`15px 15px 4px 15px`) — the tail is what carries the
"this is a message" signal, and it is doing that job correctly.

## S2. The panel's care-team callout and the walkthrough page's care-team callout are two components that almost match

`index.html:6407–6412` (panel) vs `index.html:6663–6670` (walkthrough page).

Same content, same tone system (`NOTICE_TONES`), same icons — every dimension different, including
the one that should never change under scaling:

| | walkthrough (`:6663`) | panel (`:6407`) |
|---|---|---|
| border-radius | 17px | 13px |
| padding | 14px | 11px 12px |
| flex gap | 11px | 9px |
| icon chip | 36px, radius 12px, glyph 19 | 28px, radius 9px, glyph 15 |
| **heading** | `...TYPE.bodyBold` = **15px / 700** | **13.5px / 800** |
| body | 14px / 1.55 | 13px / 1.5 |

Measured live from both surfaces: `outputs/v56-designer/I-walkthrough-callout-360.png` (radius 17,
pad 14, gap 11, icon 36/12) against `B-answer-dailylimit-360.png` (radius 13, pad 11/12, gap 9,
icon 28/9). Put the two screenshots side by side and they read as two designs, not one component at
two sizes — the panel's icon chip is visibly smaller relative to its text, and the heading is
*heavier* despite being *smaller*, which inverts the normal relationship.

The weight change is the real defect. `TYPE`'s own header comment (`index.html:2354`) says
*"Weight 800 is reserved for `display` and primary CTA labels"*. A callout heading is neither.

**Fix:** `index.html:6407–6412`, land the panel version on the midpoint and keep the weight identical
to its sibling:

- `borderRadius: '13px'` → **`'15px'`**
- `padding: '11px 12px'` → **`'12px 13px'`**
- `gap: '9px'` → **`'10px'`**
- icon chip `width/height: '28px'`, `borderRadius: '9px'`, glyph `15` → **`'32px'`, `'11px'`, glyph `17`**
- heading `fontSize: '13.5px', fontWeight: '800'` → **`fontSize: '14px', fontWeight: '700'`**
- body `fontSize: '13px', lineHeight: '1.5'` → **`fontSize: '13.5px', lineHeight: '1.55'`** (matches
  the bot bubble's own body size at `index.html:6425`, so the callout body and the paragraph below it
  stop being two different sizes)

## S3. The generic care-team refusal is the weakest-looking notice in the feature, and it is the most safety-critical one

`index.html:6446–6451`

When the clinical guard fires and **no** `careLead` topic matches, the reply is not the callout
component at all — it is a bare `borderLeft: '4px solid ' + tone.accent` with `paddingLeft: '10px'`:
no white card, no icon chip, no background, sitting directly on the bot bubble's `#FFF6F1` tint.

Compare `outputs/v56-designer/B-refusal-tylenol-360.png` ("how many mg of tylenol is safe" — a bare
red rule and a wall of text) with `B-clinical-fever-360.png` ("is 101 a fever" — a full white card,
a heart icon in a tinted chip, a bold heading). The *less* certain, *more* generic refusal — the one
that fires precisely when the app has nothing to offer and the user must be pushed toward a human —
is styled as an aside. The visual hierarchy is inverted relative to the safety hierarchy.

There is a second problem in the same block: `HELP_CARE_TEAM_LINE` is rendered with
`fontStyle: 'italic'` (`index.html:6450`) and runs to **seven full italic lines** at 13.5px in the
screenshot. The walkthrough page never italicises that line. Long-form italic body copy at 13.5px is
the wrong choice for an audience reading on a cracked phone at 2am.

**Fix:** render this state through `helpBotCallout`'s own visual shell rather than a bespoke one.
Concretely, at `index.html:6446` replace the `borderLeft`/`paddingLeft` div with the same wrapper the
callout uses — `background: '#FFFFFF'`, `border: '1px solid #E9D8D1'`,
`borderLeft: '4px solid ' + NOTICE_TONES.urgent.accent`, `borderRadius: '15px'`, `padding: '12px 13px'`,
`display: 'flex'`, `gap: '10px'` — with the same 32px `heart` icon chip using
`NOTICE_TONES.urgent.chipBg` / `.chipFg`, and drop `fontStyle: 'italic'` from `index.html:6450`
(keep the `marginTop: '8px'`, and set that line to `fontSize: '12.5px', color: '#7A6E76'` so it reads
as the standing disclaimer it is, not as a second paragraph of the refusal).

## S4. Reopening the panel lands on the oldest exchange, not the newest

`index.html:6258–6262` (`openHelpBot`) sets `helpBotOpen` and focuses the input. It never positions
the transcript. `helpBotLog` (`index.html:6228`) is module-scope and is never cleared on close, so the
rebuilt `#helpbot-log` starts at `scrollTop: 0`.

Measured: ask three questions, close, reopen → `scrollTop: 0` against `scrollHeight: 1569` /
`clientHeight: 426`. Screenshot `outputs/v56-designer/F-reopen-stale-360.png` — the panel reopens
showing question #1 and its answer; the most recent exchange is 1,100px below the fold.

`helpBotAsk` already solves exactly this problem for a fresh reply (`index.html:6337–6341`, scrolling
so the *top* of the newest reply is visible so the callout is never scrolled past). `openHelpBot`
should reuse it.

**Fix:** in `openHelpBot` (`index.html:6258`), inside the existing `setTimeout(…, 50)` and before the
input focus, add:

```js
const log = document.getElementById('helpbot-log');
if (log && log.lastElementChild) log.scrollTop = Math.max(0, log.lastElementChild.offsetTop - log.offsetTop - 6);
```

## S5. The starter chips and "Browse all 117 help topics" disappear permanently after the first question

`index.html:6549–6559` renders the greeting, the five starter chips and the Browse-all escape hatch
only when `empty` (`helpBotLog.length === 0`). After one answer they are gone for the rest of the
session, and the `answer` / `list` / `person` reply kinds (`index.html:6432–6476`) offer no route to
the Help view's top level. Only the `none` state does (`index.html:6481`).

So: a user whose first question gets a *nearly* right answer has no in-panel way to reach the 117
topics — they have to close the panel, open the drawer and find the Help row. That is precisely the
user most likely to want the browse route.

**Fix:** append a Browse-all affordance to the `answer` and `list` branches. At `index.html:6461`
(after the "Open the full walkthrough" chip) and `index.html:6469` (after the disambiguation list),
add a low-emphasis text button rather than a sixth full-width chip, so it does not compete with the
primary CTA:

```js
h('button', { onClick: helpBotBrowseAll, style: { marginTop: '10px', minHeight: '44px', padding: '0', background: 'transparent', color: '#A83D0F', fontSize: '12.5px', fontWeight: '700', textDecoration: 'underline', textAlign: 'left' } }, 'Browse all ' + HELP_TOPICS.length + ' help topics')
```

(`12.5px / 700 / #A83D0F` underlined is the app's existing quiet-text-link treatment — see
`index.html:3170`, the tour's "Skip this step".)

## S6. The transcript hard-cuts under the header and above the composer, with no scroll affordance

`index.html:6548` — `#helpbot-log` is `overflow-y: auto` with no gradient, mask or inner shadow at
either edge, and the header/composer are opaque white with only a 1px `#F2E4DE` divider.

The result, at 360×800 with any reply longer than the log's 426px: text is guillotined mid-glyph.
`outputs/v56-designer/D-long-transcript-end-360.png` shows a sentence sliced horizontally through the
x-height directly under the header rule. `H-longtitle-notevscheckin-360.png` and
`B-refusal-tylenol-360.png` show something worse — a 12px sliver of the solid `#BF4C1A` user bubble
clipped flat against the header divider, which reads as a rendering artefact rather than as content
continuing above. `H-faq-answer-360.png` shows the "NOT WHAT YOU MEANT?" label sliced in half by the
composer.

**Fix:** `index.html:6548`, add to the `#helpbot-log` style:

```js
boxShadow: 'inset 0 10px 8px -8px rgba(60,21,4,0.10), inset 0 -10px 8px -8px rgba(60,21,4,0.10)'
```

An inset shadow (rather than a `mask-image` gradient) is used because it composites correctly over
the two different bubble fills the log contains and needs no vendor prefix in the target WebViews.

## S7. The 11.5px muted label fails WCAG AA in both places it is used

`index.html:6543` (header subtitle "Searches this app's help pages") and `index.html:6475`
(the category label under each disambiguation row) both use `fontSize: '11.5px'`, `fontWeight: '600'`,
`color: '#8A7B84'`.

`#8A7B84` on `#FFFFFF` measures **4.00:1** — below the 4.5:1 AA floor for normal text, and it is
being used *below* the size at which the large-text exemption applies. It is also below the "no text
below 12px" rule stated in `TYPE`'s own header comment (`index.html:2354`).

The app already has the right colour for this exact role. `topicRow`'s sub-label in the Help view
(`index.html:6631`) renders the *identical piece of information* — the category name under a topic
title — as `...TYPE.caption, color: '#915E48'`, i.e. **13px / 600 / #915E48 = 5.39:1**.

**Fix:**
- `index.html:6475`: `fontSize: '11.5px', fontWeight: '600', color: '#8A7B84'` →
  `...TYPE.caption, color: '#915E48'` (13px / 600, 5.39:1) — this also makes the disambiguation row
  and the Help view's search-result row identical, which they should be, since they are the same
  row showing the same thing.
- `index.html:6543`: `fontSize: '11.5px', fontWeight: '600', color: '#8A7B84'` →
  `fontSize: '12px', fontWeight: '600', color: '#7A6E76'` (**4.86:1**; `#7A6E76` is the "tertiary"
  colour named at `index.html:2353` and is what the panel already uses for "+ N more steps").

## S8. `aria-live` on the transcript cannot work as specified, because the live region is destroyed on every render

`index.html:6548` — `role="log" aria-live="polite" aria-relevant="additions"`.

`render()` does `root.innerHTML = ''` then rebuilds the whole tree (`index.html:3326–3335`). Every
submit therefore replaces `#helpbot-log` with a **brand-new node**. `aria-relevant="additions"` diffs
against a live region's prior state; a region that has just been inserted whole has no prior state,
so assistive tech will either announce the entire transcript or nothing at all — never "the new reply
only", which is what the brief's accessibility contract (§3.8) promises.

This gets worse as the transcript grows: the log measured **2,410px / ~1,900 words** after six
questions (`D-long-transcript-*`), so a seventh question risks reading the whole session aloud.

**Fix:** stop asking the rebuilt container to be the live region, and add a small dedicated announcer
that only ever holds the newest reply's plain text.

- `index.html:6548`: keep `role="log"`, change `aria-live` to **`'off'`**, drop `aria-relevant`.
- Add a visually-hidden `<div id="helpbot-announce" role="status" aria-live="polite">` as a sibling
  of the log inside the panel, and in `helpBotAsk`'s existing `requestAnimationFrame` callback
  (`index.html:6336`) set its `textContent` to the newest reply's heading + first paragraph.

Because it is written *after* the rebuild, into a node that persists for that render, the
announcement is correct and bounded.

## S9. Vertically stacked chips use a 6px gap; every comparable stack in this file uses 8–10px

`index.html:6464`, `:6469`, `:6481`, `:6552` all use `gap: '6px'` for columns of full-width, 44px-tall
buttons. Measured live in the greeting: five chips, inter-chip gaps of exactly **6, 6, 6, 6 px**.

The comparators in this same file:

| stack | line | gap |
|---|---|---|
| Help view category cards (full-width, stacked) | `index.html:6773` | **10px** |
| Related chips | `index.html:6699` | 8px |
| The panel's own composer row | `index.html:6567` | 8px |
| **The panel's own message log** | `index.html:6548` | **10px** |

6px only appears in this file for *horizontal* wrapped pill rows (`index.html:4187`, `:4193`), where
a tight gap is correct. For a column of five 44px slabs it is not: at 6px the chips read as one
segmented control rather than five separate destinations, which is exactly wrong for a list whose
whole job is "these are five different problems, pick yours"
(`outputs/v56-designer/B-greeting-360.png`).

**Fix:** change `gap: '6px'` to `gap: '10px'` at `index.html:6464`, `:6469`, `:6481` and `:6552`,
matching the log's own 10px rhythm and the Help view's stacked-card gap.

## S10. Chips are the same fill as the bubble they sit in, so tappable and non-tappable look alike

`helpBotChip` (`index.html:6368–6379`) uses `background: '#FFF6F1'` for the non-primary variant.
The bot bubble it sits inside (`index.html:6422`) is **also** `#FFF6F1`. Measured computed values:
chip `rgb(255,246,241)`, containing bubble `rgb(255,246,241)` — identical. The only separation is a
1px `#EFDCD4` border.

The app's own chip vocabulary does not do this. Related chips (`index.html:6700`) and the Help
search Clear button (`index.html:6620`) both use `background: 'rgba(200,83,32,0.10)'` with
`border: '1px solid rgba(246,108,49,0.22)'` — a tint that *reads* as tappable against a plain surface.
The `list` reply kind gets this right by going the other way (white rows on the tinted bubble,
`index.html:6472`), which is why `B-disambig-broken-360.png` reads noticeably better than
`B-greeting-360.png` and `B-noanswer-zzz-360.png`.

**Fix:** `index.html:6372–6375`, non-primary branch only:
`background: '#FFF6F1'` → **`'rgba(200,83,32,0.10)'`**, and
`border: '1px solid #EFDCD4'` → **`'1px solid rgba(246,108,49,0.22)'`**.
Keep `color: '#8A3D14'` (7.14:1 on the resulting fill). The `primary` branch is unchanged.

---

# NICE TO HAVE

## N1. The bubble is the primary-action colour, on screens that already have a primary-action button

`index.html:6509` — `background: '#BF4C1A'`, `border: '2px solid rgba(255,255,255,0.75)'`,
`boxShadow: '0 8px 22px rgba(136,57,24,0.34)'`, `appIcon('help', 25)`.

The glyph itself is right — `help` is a question mark in a circle (`index.html:2412`), and at 25px on
a 56px disc it reads as help, not as "create" (`outputs/v56-designer/J-fab-crop.png`). The problem is
the fill. On **Symptoms** (`A-bubble-symptoms-360.png`) the screen's add-a-symptom button is a solid
`#BF4C1A` rounded square with a white `+`, and the help bubble is a solid `#BF4C1A` circle with a
white `?` — two same-colour, same-scale floating-looking controls, one of which creates a record. On
**Meds** (`K-fab-meds-with-med-360.png`) the "+ Add" button is again solid `#BF4C1A`. On **Home**,
three `Log` buttons are solid `#BF4C1A`. The bubble is currently indistinguishable, by colour, from
"the thing that commits data on this screen."

The app already has a distinct visual register for *floating chrome that is not a screen action*: the
toast (`index.html:3287`) and the "Back to reports" pill (`index.html:3304`) are both
`background: 'rgba(59,25,10,0.88)'` with white content. That register would separate the bubble from
every screen's primary action at a glance.

**Fix (option A, matches existing floating chrome):** `index.html:6509`,
`background: '#BF4C1A'` → `'rgba(59,25,10,0.88)'`, `border` → `'1px solid rgba(255,255,255,0.2)'`
(the pill's exact values). Downside: at 56px it is a fairly heavy dark disc.

**Fix (option B, reads most explicitly as "help"):** invert it —
`background: '#FFFFFF'`, `color: '#BF4C1A'`, `border: '1px solid #E9D8D1'`,
`boxShadow: '0 8px 22px rgba(136,57,24,0.22)'`. This is the same treatment the panel already gives
its own header icon chip (`index.html:6541`, rose `help` glyph on a light tint), so opening the panel
becomes visually continuous with the thing you tapped.

I lean to option B. Either way it should not stay `#BF4C1A`.

Related, smaller: the app already uses a `?` for a different job — `infoChip` (`index.html:2967–2968`)
is a 20px circle with a `?` meaning "explain *this card*", visible on In-Patient in
`A-bubble-in-patient-360.png` two inches from the bubble. Two `?` affordances with different scopes is
tolerable at these very different sizes, but it is one more reason not to also share a fill colour.

## N2. The bubble and the "Back to reports" pill sit 3px out of alignment

Measured on the Reports detail view at 360 (`outputs/v56-designer/E-reports-detail-360.png`):

| | rect | vertical centre |
|---|---|---|
| Back pill (`index.html:3304`, `bottom: calc(88px + inset)`, height 42) | `left 135.8, right 224.2, top 670, bottom 712` | 691 |
| Help bubble (`index.html:6509`, `bottom: calc(84px + inset)`, height 56) | `left 290, right 346, top 660, bottom 716` | 688 |

No collision — 65.8px of horizontal clearance at 360, 45.8px at 320 (both measured) — so §2.2's
collision analysis holds. But the two are the only floating controls on that screen, they occupy the
same horizontal band, and their centres are 3px apart. That misalignment is the sort of thing that
separates "designed" from "assembled."

**Fix:** `index.html:3304`, change the pill's `bottom` from `calc(88px + env(safe-area-inset-bottom))`
to `calc(91px + env(safe-area-inset-bottom))`, putting its centre at 112px to match the bubble's. The
pill's top edge moves from 130 to 133, still 17px below the toast's 150px floor, so nothing else
shifts.

## N3. The focus ring on the bubble is the same colour as the bubble

`index.html:55` — `button:focus-visible { outline: 2px solid #BF4C1A; outline-offset: 2px; }`, applied
to a `#BF4C1A` bubble.

Keyboard-tabbed live (12 tabs from page load reaches `#helpbot-fab`);
`outputs/v56-designer/J-fab-focus-kbd.png` shows the ring landing on the peach page background, where
it is present but faint — roughly 2.4:1 against the app's background gradient, under WCAG 2.2
1.4.11's 3:1 floor for non-text indicators. On every other control in the app the same ring lands on
a white or near-white card and is fine; the bubble is the one place it lands on the gradient.

**Fix:** add one scoped rule to the stylesheet next to `index.html:55`:

```css
#helpbot-fab:focus-visible { outline: 3px solid #2A2127; outline-offset: 3px; }
```

`#2A2127` is the app's ink colour and measures well over 3:1 against both the bubble and the
background gradient.

## N4. `aria-expanded` is always `"false"` and `aria-controls` always dangles

`index.html:6500–6504`. The bubble is only rendered when `!state.helpBotOpen` (`index.html:6497`), so
`aria-expanded="false"` is the only value that ever exists, and `aria-controls="helpbot-panel"` always
points at an element that is absent at the moment the attribute is readable. §3.8 of the brief
specifies `aria-expanded="true|false"`, which the unmount makes unreachable.

This is harmless but it is a claim the markup cannot honour. **Fix:** since the panel carries its own
`role="dialog"` and its own close control, drop both attributes from `index.html:6502–6504` and keep
`aria-label="Ask for help"`. A button that opens a labelled dialog does not need the disclosure
pattern.

## N5. `+ N more steps` reads as a greyed-out fourth step

`index.html:6394` — `fontSize: '12.5px', fontWeight: '600', color: '#7A6E76', marginTop: '7px'`,
rendered flush-left under the numbered list with no numeral and no rule.

In `H-faq-answer-360.png` it sits 7px under step 3 in a lighter grey, at a size only 1px off the step
body — it looks like a disabled step, not a count. It is also not tappable, while the control
directly below it is.

**Fix:** treat it as metadata rather than list content — `index.html:6394`, change to
`...TYPE.label, color: '#A83D0F', marginTop: '11px'` (12px / 700 / uppercase / 0.06em, the app's
section-label token). At uppercase-label weight it reads as a count, matching how "Step by step" and
"Not what you meant?" (`index.html:6463`) already label blocks in this panel.

## N6. The header subtitle wraps to two lines at 320px

`index.html:6543`, at 320px viewport: "Searches this app's help pages" breaks after "help"
(`outputs/v56-designer/C-greeting-320.png`), making the header 18px taller and leaving the close
button visually high against a two-line title block. 320 is below the project's stated 360 floor, so
this is cosmetic only.

**Fix (only if S7's 12px change does not already resolve it — it will not, 12px still wraps at 320):**
shorten the string at `index.html:6543` from `'Searches this app’s help pages'` to
`'Searches this app’s help'` — 25 characters, fits on one line at 320 with the 44px close button
and the 28px icon chip accounted for.

---

# What is already right, and should not be changed

Recording these so a later pass does not "fix" them:

- **Touch targets.** Every interactive element in the panel measures ≥44px in its constrained
  dimension: close 44×44, send 44×44, input 44 high, every chip 44 high × 290 wide at 360, every
  disambiguation row 44 high. No exceptions found at any width.
- **No horizontal overflow anywhere.** `documentElement.scrollWidth - window.innerWidth === 0` at 320,
  360, 390, 430, 519, 520, 521 and 768, in the greeting, answer, clinical, refusal, disambiguation and
  no-answer states. Zero elements measured extending past either viewport edge. `wordBreak:
  'break-word'` on the bubble (`index.html:6427`) holds the 76-character longest topic title
  (`note-vs-checkin`) cleanly at 320.
- **Visibility predicate.** Confirmed live from a wiped install: no bubble on setup, none during the
  tour, none with the drawer or any modal open, none in the med editor (`L-med-editor-360.png`), none
  on the Help view. `helpBotVisible()` (`index.html:6248`) is correct as written.
- **Height clamping.** `helpBotSyncViewport`'s `Math.min(HELPBOT_MAX_H, Math.max(240, …))`
  (`index.html:6286`) behaves correctly under simulated keyboards: 560px at 800 viewport height,
  272px at 380, 240px (the floor) at 330 — never a takeover, never collapsed.
- **Toast clearance.** The move to `calc(150px + inset)` (`index.html:3287`) clears the bubble's 140px
  top edge and the Back pill's 130px top edge, as §2.2 intended.
- **Focus return on close.** `closeHelpBot`'s `requestAnimationFrame` + re-query by id
  (`index.html:6263–6272`) is correct and avoids the pre-existing `closeDrawer()` detached-node
  defect. Do not "simplify" it back.
- **Honesty rules.** No typing indicator, no delay, no avatar, no persona name; the reply appears in
  the same frame. The "I don't have an answer" state uses no red and no error styling. All of §3.9 is
  honoured in the rendered product.
- **Tablet layout.** At 768 the panel anchors right at 380px and reads well
  (`C-answer-768.png`) — the ≥520 branch itself is correct, only its threshold (M2) and its
  resize-staleness (M2) need attention.

---

## Screenshot index

`outputs/v56-designer/` — 74 PNGs, all at `deviceScaleFactor: 2`.

| prefix | what |
|---|---|
| `A-bubble-{home,meds,reports,in-patient,symptoms}-360` | the bubble on all five tabs |
| `B-{greeting,answer-dailylimit,clinical-fever,refusal-tylenol,disambig-broken,noanswer-zzz,person}-360` | the seven panel states |
| `C-{bubble,greeting,answer}-{320,360,390,430,519,520,521,768}` | full width sweep incl. both sides of the 520 boundary |
| `D-long-transcript-{top,bottom,end}-360` | six-question transcript, 2,410px of scroll |
| `D-keyboard-{380h,330h}-360` | simulated software keyboard |
| `E-reports-detail-{360,320}` | bubble vs the "Back to reports" pill |
| `F-reopen-stale-360` | S4 — reopening lands on the oldest exchange |
| `G-rotate-740x400` | M2 — landscape rotation |
| `G-safearea-34px-sim-360` | M3 — simulated 34px bottom inset |
| `H-{shortanswer-noteadd,longtitle-notevscheckin,faq-answer,faq-nosteps,medical-calm-override}-360` | reply edge cases |
| `I-walkthrough-callout-360` | S2 — the walkthrough page's callout, for comparison |
| `J-{fab-crop,fab-focus,fab-focus-kbd,send-crop,close-focus}` | 2× icon and focus-ring crops |
| `K-fab-{over-content-home,over-content-meds,home-with-med,meds-with-med}-360` | bubble against real page content |
| `L-med-editor-360` | bubble correctly absent in the med editor |

Reproduction harness: `outputs/v56-designer/lib.mjs` plus `s1.mjs`–`s15.mjs`
(`env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy node sN.mjs`).
