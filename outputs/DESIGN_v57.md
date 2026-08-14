# DESIGN REVIEW — app-v57

**Stage:** Designer (TEAM.md stage 4), independent gate. **Author:** Designer agent, 2026-08-13.
**Reviewed against:** the rendered product, not the diff. `outputs/DEV_v57.md` was read as a claim to
verify. House references used for "is this in family": `TYPE` (`index.html:2397`), `NOTICE_TONES`
(`index.html:1942`), the sibling Home banners (`index.html:3873`, `:3909`, `:3922`, `:4409`), and the
bar set by `outputs/DESIGN_v56.md`.

**Method.** 76 Playwright captures at **320 / 360 / 390 / 768**, `deviceScaleFactor: 2`, against
`http://127.0.0.1:8901/index.html`, curated down to the 15 in `outputs/v57-design/`. Every number
below is measured live from `getBoundingClientRect()` / `getComputedStyle()` or computed from sampled
screenshot pixels — none is estimated. Contrast ratios are WCAG 2.1 relative-luminance, computed
against the **actual** composited backdrop (alpha flattened), not against an assumed white.

Profiles were driven through the real first-run flow in a fresh context each time. **The notice card
was reviewed on a Home screen with real data** — three medications added through the real editor
(Ondansetron/Zofran, Dexamethasone, Paracetamol/Acetaminophen), doses logged through the confirm
modal, a temperature reading logged — specifically because of the v56 lesson where an empty test
profile hid a 1.00:1 problem. `A-home-realdata-full-360.png` is that screen.

Console: **zero** real errors at every width, in every state, including the notice, the Help centre,
the med editor and the Reports detail. The only console output is the Capacitor CDN `<script>`
failing `ERR_CERT_AUTHORITY_INVALID`, which is a sandbox artefact and explicitly not a defect.

---

## Verdict

**NOT READY.** Three must-fixes.

The mechanical parts of this release are clean, and I want to say so before the findings: the bubble
removal left **no hole**. I enumerated every `position: fixed` element on all five tabs after removal
— the only survivors are the toast (z 50) and the bottom nav (z 35). The z-index slots the bubble
used (37, 51) are unclaimed, the `#helpbot-fab:focus-visible` rule is gone, the page's
`paddingBottom: calc(90px + inset)` is unchanged from v55/v56 so nothing was reserving space, and
nothing reflowed. "Help & FAQ" fits on one line in the drawer (152.2px label in a 268.8px drawer at
320) and the `HELP & FAQ` eyebrow is one line at 87px on all four Help screens at 320. The new
`sym-medical-question` row renders cleanly at every width — 4 lines / 94.9px at 320, 3 lines at
360/390, zero horizontal overflow anywhere. All four of those were the specific things I was asked to
check for breakage, and none of them is broken.

What is not ready is **the new card itself**. At 360px it is **919px tall** — taller than the
viewport — with a body line measure of **24.3 characters**. At 320px it is **1,121.7px** at **19.1
characters per line**. A browser tester's first screen of ChemoWell is a full-height slab of text
with no app visible behind it, no action visible, and the only visible dismiss control an
**28×28px** button. Separately, the toast/pill revert put the toast **34px on top of** the "Back to
reports" pill — the exact thing this review was asked to verify.

---

# MUST FIX

## M1. The notice card is a wall of text at every phone width: 919px tall at 360, 19–30 characters per line

`index.html:3671–3688`

Measured live, real-data profile, fresh install:

| viewport | card height | body column | chars/line (measured) | "Got it" sits |
|---|---|---|---|---|
| **320** | **1,121.7px** | 167px | **19.1** | 1,011px below the card's top |
| **360** | **919.0px** | 207px | **24.3** | 808px below the card's top |
| **390** | 773.3px | 237px | 29.7 | 714px below |
| 768 | 441.9px | 597px | ~70 | in view |

Chars/line is counted from `Range.getClientRects()` on the longest body paragraph (267 characters →
14 lines at 320, 11 at 360, 9 at 390), cross-checked against a measured average glyph width of
8.03px at 13px/600. The comfortable range for body copy is 45–75 characters; WCAG 1.4.8 caps it at
80. **19 characters is roughly a quarter of the low end.**

Two causes, both fixable, and they compound:

1. **The card gives away 121px of its 328px to two flanking columns.** A 32px icon chip + 12px gap on
   the left and a 28px ✕ + 12px gap on the right are *flex siblings of the whole body*, so every one
   of the ~40 body lines is indented past an icon that stops after 32px and a close button that stops
   after 28px. At 360 the text column is 207px inside a 328px card.
2. **There are ~200 words of copy in it** — three sub-points of 55–70 words each plus an intro and a
   privacy line.

Evidence: `outputs/v57-design/A-notice-top-360.png` (the entire first screen is the card, mid-sentence
at the fold), `A-notice-top-320.png` (same, worse), `A-notice-actions-360.png` (the buttons, ~490px of
scrolling later), `A-home-realdata-full-360.png` (the card is 919px of a 2,491px page — **37% of the
whole Home screen's scroll length**, above three real medication cards and the journal).
`A-notice-top-768.png` is included because at 768 the same component reads correctly — this is
specifically a phone-width failure.

**Fix — part A, reclaim the columns (structural, no copy change).** Take the icon and the ✕ out of the
body's flex row so the paragraphs run the full card width.

At `index.html:3671`, change the card container from
`display: 'flex', gap: '12px', alignItems: 'flex-start'` to
`position: 'relative'` (drop `display/gap/alignItems`).
Wrap the icon chip (`:3672`) and the title (`:3674`) in a single header row:

```js
h('div', { style: { display: 'flex', gap: '12px', alignItems: 'center', paddingRight: '36px' } },
  <existing 32px icon chip span>,
  h('div', { style: { ...TYPE.bodyBold, fontSize: '15px', color: '#2A2127' } }, 'You’re using the web preview')
),
```

and move the ✕ (`:3687`) to
`position: 'absolute', top: '10px', right: '10px'` on the now-relative card.
Delete the `h('div', { style: { flex: '1', minWidth: '0' } }, …)` wrapper at `:3673` so its children
become direct children of the card.

Measured result of part A alone: body column **291px at 360** (36.2 chars/line, +49%) and **251px at
320** (31.3 chars/line, +64%); card height falls to roughly **700px at 360**.

**Fix — part B, cut the copy to what a first screen can hold.** Part A is not enough on its own —
36 chars/line is still under the 45 floor, and no rewrite of a 328px card will reach 45 at 13px. So
the copy has to come down to ~90 words. Exact replacement strings, keeping every fact that costs a
tester something and moving the elaboration to the Help page (see **S3**):

- intro (`:3675`) → `'Everything works. Three things are different in a browser:'`
- point 1, iOS, not installed → title `'Add it to your Home Screen'`, body
  `'Tap Share, then Add to Home Screen. Safari deletes a site’s saved data after 7 days without a visit — and your log is stored nowhere else.'`
- point 1, Android, not installed → title `'Add it to your Home Screen'`, body
  `'Open your browser menu, then Add to Home screen. It keeps your log one tap away and out of reach of anything that clears browser data.'`
- point 1, installed → title `'Your log is safe on this device'`, body
  `'You’ve already added ChemoWell to your Home Screen. Keep opening it from that icon, not a browser tab.'`
- point 2 (`:3679`) → title `'Reminders need this page open'`, body
  `'A browser can’t wake a locked phone. The phone app schedules them with the operating system instead.'`
- point 3 (`:3680`) → title `'Exports download instead of sharing'`, body
  `'Download CSV and Print/PDF save to your Downloads folder.'`
- privacy line (`:3681`) → `'Everything you log stays on this device.'`

A + B together land the card at approximately **480–520px at 360** and **560–600px at 320** — about
half a screen, with the "Got it" button reachable in one short scroll. That is the shape a first-run
notice should have.

---

## M2. The ✕ is a 28×28px touch target — the only dismiss control visible on the first screen

`index.html:3687` — `width: '28px', height: '28px'`.

Measured 28.0 × 28.0 at **every** width. The project's floor is 44px, and both other buttons in this
same card clear it (`Got it` 77×44, `Open Help & FAQ` 149.3×44 — verified). The ✕ is the one that
misses, and because of M1 it is the **only** control on screen when the card first paints: `Got it`
is 808px further down at 360. So the affordance a hurried tester will actually reach for is the one
that is 40% under the minimum.

Its glyph contrast is also under AA: `#7A6E76` on `rgba(124,97,86,0.10)` over white composites to
`#7A6E76` on `rgb(242,239,238)` = **4.25:1**, below the 4.5:1 floor for 13px text.

Focus handling is fine — `G-focus-x-360.png` shows the shared `button:focus-visible` ring
(2px `#BF4C1A`, 2px offset) landing correctly on the white card at 4.92:1. The ring makes the control
*look* 36px; it is still 28px to a thumb.

**Fix:** `index.html:3687` —
`width: '28px', height: '28px'` → **`width: '44px', height: '44px'`**,
`fontSize: '13px'` → **`'15px'`**,
`color: '#7A6E76'` → **`'#6B5C63'`** (5.50:1 on the same chip, clears AA),
`borderRadius: '50%'` unchanged,
and add `display: 'flex', alignItems: 'center', justifyContent: 'center'` so the glyph stays centred
at the larger box. With M1's absolute positioning this costs the body column nothing.

---

## M3. The toast lands on top of the "Back to reports" pill — 34px of vertical overlap, 88.5px of horizontal overlap

`index.html:3329` (toast, `bottom: calc(96px + inset)`) vs `index.html:3345` (pill,
`bottom: calc(88px + inset)`).

This is the specific thing I was asked to verify, and it does not clear. Measured live on the Reports
→ History detail view with a real toast in flight:

| | 320 | 360 |
|---|---|---|
| pill rect | `top 670, bottom 712, left 115.8, right 204.2` | `top 670, bottom 712, left 135.8, right 224.2` |
| toast rect | `top 621.2, bottom 704, left 80, right 240` | `top 621.2, bottom 704, left 90, right 270` |
| **vertical overlap** | **34.0px** | **34.0px** |
| **horizontal overlap** | **88.5px** | **88.5px** |
| z-index | toast 50, pill 36 | toast 50, pill 36 |

Both are `rgba(59,25,10,0.88)` dark pills, both centred horizontally, and the toast paints on top.
`outputs/v57-design/E-toast-over-pill-360.png` shows the result: "↩ Back" is a ghost visible *through*
the toast, and the two merge into one ambiguous dark blob for the toast's full ~4.5s life.
`E-reports-detail-360.png` is the same screen without a toast, for comparison.

Taps still land (`pointerEvents: 'none'` on the toast is correct and should stay), so this is not a
functional break — it is a "this app was assembled, not designed" moment on a screen where the user
is mid-task. Note the arithmetic: the pill's top edge is 130px from the bottom and the toast's
**bottom** edge is 96px from the bottom, so overlap is guaranteed for any toast at all; this toast
measured 82.8px tall because the message wrapped to two lines, and a three-line toast makes it worse.
v56 masked this by raising the toast to 150px for the bubble; reverting to 96px re-exposed it.

**Fix:** make the toast's offset conditional on the pill being on screen — both are rendered in the
same `render()` pass and `state.reportsView` is already in scope. At `index.html:3329`, change
`bottom: 'calc(96px + env(safe-area-inset-bottom))'` to:

```js
bottom: (state.view === 'reports' && state.reportsView)
  ? 'calc(142px + env(safe-area-inset-bottom))'
  : 'calc(96px + env(safe-area-inset-bottom))',
```

142px puts the toast's bottom edge 12px above the pill's 130px top edge, on the one screen where the
pill exists, and leaves the 96px value — correct everywhere else, and 19px clear of the bottom nav
(measured `navTop 731`, `pill bottom 712`) — untouched. Do **not** raise the pill instead: toast
height varies with message length, so only moving the toast is deterministic.

---

# SHOULD FIX

## S1. Inside the card, headings and body are the same size — three points read as one paragraph

`index.html:3668–3669`.

Measured computed styles: sub-point heading **13px / 700 / `#2A2127` / lh 19.5px**, its body **13px /
600 / `#554A52` / lh 18.2px**. Same size. 100 weight units and a colour step is all that separates a
heading from 60 words of body under it — and at 600, the body is itself semibold, so the whole card
renders as one uniform block of near-bold text (visible in every `A-notice-*` capture). The card
title above them is 14px/700, one pixel larger than the headings it is supposed to outrank.

This is not the house pattern. Every sibling banner (`:3877`, `:3912`, `:4412`) pairs a **14px/700**
title with a **13px/600** one-line caption — a step that works for one line and collapses over three
nested blocks.

Rhythm compounds it: `point()` sets `marginTop: '9px'` between points and `marginBottom: '1px'`
between a heading and its own body. 9px vs 1px is not enough separation for blocks that are 5–9 lines
tall; the three points do not read as three.

**Fix**, `index.html:3667–3669`:

- `point()` wrapper `marginTop: '9px'` → **`'16px'`**
- heading: `...TYPE.bodyBold, fontSize: '13px'` → **`fontSize: '14px', fontWeight: '700', lineHeight: '1.35'`**, `marginBottom: '1px'` → **`'3px'`**
- body: `...TYPE.caption` → **`fontSize: '13px', fontWeight: '500', lineHeight: '1.5'`** (13/500 is
  already in family — `index.html:6319` and `:6304` use 13.5/500 and 14.5/500 for help body copy)
- card title `index.html:3674` `fontSize: '14px'` → **`'15px'`** (i.e. plain `...TYPE.bodyBold`), so
  the hierarchy is 15 / 14 / 13 rather than 14 / 13 / 13

Dropping the body to weight 500 also removes ~8% of the card's height on its own.

## S2. Dismissing from the bottom of the card strands the viewport in the middle of the page

`index.html:3683` / `:3687` / `:3684` all call `dismissBrowserNotice()`, which writes the pref and
lets `render()` rebuild. Nothing restores scroll.

Measured: scroll to "Got it" (the only way to reach it at phone width — M1), tap it, and 919px is
removed from above the viewport:

| | scrollY before | scrollY after | what is at y=200 after |
|---|---|---|---|
| 320 | 812 (doc 2,312) | **372** (doc 1,172) | "Treatment schedule" |
| 360 | 609 (doc 2,069) | **332** (doc 1,132) | Blood pressure, cut in half |

`outputs/v57-design/F-after-dismiss-360.png`: the tester's reward for reading the notice is a jump to
the middle of Home, top card sliced through, with the top of their own screen never seen. Every other
"this view changed wholesale" transition in this app calls `scrollToTop()` (`index.html:2485`) —
`helpGo`, `helpOpenTopic`, `endTour`.

**Fix:** `index.html:605` (`dismissBrowserNotice`), after the pref write:

```js
async function dismissBrowserNotice() {
  try { await setPrefsDB({ browserNoticeSeen: true }); }
  catch (e) { setState({ browserNoticeSeen: true }); }
  scrollToTop();
}
```

(For the `Open Help & FAQ` path at `:3684`, `navigateTo` already scrolls, so no double-call issue.)

## S3. "Open Help & FAQ" permanently dismisses the notice and lands on a page that answers none of it

`index.html:3684` — `onClick: () => { dismissBrowserNotice(); navigateTo('help'); }`.

Two problems in one control:

1. It lands on the Help **landing** page ("Find and fix a problem", 6 category tiles + a search box).
   Nothing about the web preview, Home Screen or reminders is visible. The topic that answers it —
   **`rem-web-vs-app`, "I'm using ChemoWell in a web browser, not the installed app"**
   (`index.html:2177`) — exists and is not linked. The tester has to guess that a browser question
   lives under "Reminders & notifications".
2. It writes `browserNoticeSeen` on the way out. So the person who taps the button *because they want
   to read more* is the one person who can never get the card back — there is no Settings toggle and
   no other route; `browserNoticeSeen` is only ever set, never cleared (grep: `index.html:605`, `:3683`,
   `:3684`, `:3687`, `:8171`). If they wanted to re-read the Home Screen steps tomorrow, they can't.

**Fix**, `index.html:3684` — deep-link, and stop dismissing:

```js
h('button', { onClick: () => { setState({ help: { cat: 'reminders', topic: 'rem-web-vs-app' } }); navigateTo('help'); },
  style: { …unchanged… } }, 'More about the web version')
```

(`navigateTo` at `index.html:610` does not reset `state.help`, so setting it first works. The notice
stays until "Got it" or ✕ is used, which is the correct contract: one explicit dismissal, one
explicit read-more.)

If the elaboration cut in **M1 part B** is taken, `rem-web-vs-app` should gain the Home Screen
7-day-eviction detail that comes out of the card — the notice becomes the summary and the help page
becomes the full version, which is the right division of labour.

## S4. The iOS/Android branch splits the instruction but not the reason, so both audiences read the wrong half

`index.html:3664–3666` branches only `addStep`. The rest of the sentence at `:3678` is shared.

What each audience actually reads, captured live:

- **Android** (`A-notice-top-360.png`): *"Open your browser's menu, then Add to Home screen (or
  Install app). **On iPhone this is the one that matters — Safari erases a website's saved data after
  7 days without a visit**, and nothing you've logged is stored anywhere else."* — the longest and
  scariest clause in the card is about a browser they are not using. It is also the only stated reason
  to act, so an Android tester's honest conclusion is "doesn't apply to me."
- **iPhone** (`D-ios-notice-320.png`, real iOS UA): *"Tap the Share button, then Add to Home Screen.
  **On iPhone this is the one that matters** — Safari erases…"* — told "on iPhone" while on an iPhone.

**Fix:** branch the whole body, not the first sentence. Replace `addStep` (`:3664`) with a full
`addBody`, and use it at `:3678`. Strings as given in **M1 part B**.

## S5. The installed-PWA branch keeps a title and an intro that contradict its own first point

Forced live (`matchMedia('(display-mode: standalone)')` stubbed true;
`outputs/v57-design/D-installed-notice-360.png`, card 846.3px at 360). What renders:

> **You're using the web preview**
> Everything here works. **Three things need the phone app**, so you know before you hit them:
> **Your data is safe on this device** — You've already added ChemoWell to your Home Screen…

Three things are stated to need the phone app, and the first of the three is then a confirmation that
nothing is needed. And a person running the installed Home Screen app is not "using the web preview"
in the sense the title means. `isInstalledPWA()` itself is correct — it checks `display-mode:
standalone` **and** `navigator.standalone`, and `isIOSDevice()` correctly uses `maxTouchPoints` to
catch iPadOS's desktop UA. It is only the copy that did not follow the branch.

**Fix**, `index.html:3674` and `:3675` — branch both:

```js
h('div', { …title style… }, installed ? 'A couple of things about the browser version' : 'You’re using the web preview'),
h('div', { …caption style… }, installed
  ? 'Everything works, and your log is already safe. Two things still behave differently here:'
  : 'Everything works. Three things are different in a browser:'),
```

## S6. The card's primary button wears the *info* tone on an *attention*-toned card

`index.html:3683` — `background: 'linear-gradient(135deg, #BF4C1A 0%, #A83D0F 100%)'` on a card whose
`bTone` is `NOTICE_TONES.attention` (accent `#B5761E`, chip `rgba(181,118,30,0.14)` / `#8C5900`).

So the 4px left rule and the icon chip are amber, and the button is rust. Every other in-card action
button in this file takes its fill from its own card's tone — Daily check-in "Start" is
`cTone.accent` (`index.html:3916`), Bowel "Update" is `bTone.accent` (`index.html:3892`). The gradient
does exist in the vocabulary, but only on `NOTICE_TONES.info` surfaces (the support banner,
`index.html:4409`/`:4416`), which is why it looks correct there and mismatched here. The result is a
card that reads as two colour families stacked (`A-notice-actions-360.png`).

Contrast is fine either way and should be recorded: white on `#BF4C1A` = **4.92:1**, white on
`#A83D0F` = **6.29:1**, `#A83D0F` on white = **6.29:1**, chip `#8C5900` on `rgb(245,236,224)` =
**5.07:1**. All clear AA at 13px/700.

**Fix**, `index.html:3683`: `background: 'linear-gradient(135deg, #BF4C1A 0%, #A83D0F 100%)'` →
**`background: '#8C5900'`** (`NOTICE_TONES.attention.chipFg`; white on it measures **5.93:1**).
Using `attention.accent` `#B5761E` directly would give white-on-fill only **3.77:1** and must not be
used behind white text — this is why `chipFg` is the right token here.

## S7. `HELP & FAQ` — the eyebrow this release rewrote on four screens — measures 2.79:1 and fails AA

`index.html:6231` — `color: '#BF4C1A'`, `...TYPE.label` (12px / 700 / 0.06em uppercase), rendered
directly on the page gradient, not on a card.

Sampled from the rendered pixel behind the label on `C-help-landing-320.png`: backdrop
`rgb(255,175,163)`. `#BF4C1A` on that = **2.79:1** — below the 4.5:1 AA floor for 12px text, and the
`appIcon('help', 19)` sitting beside it in the same colour is below the 3:1 non-text floor of WCAG
1.4.11 as well. For scale, the `<h1>` under it (`#2A2127`) measures 8.86:1 and the caption
(`#554A52`) 4.79:1 on the same backdrop, so this is the one element on the screen that misses.

The colour is inherited from v55; the **string** changed in v57 on all four Help screens
(`index.html:6334`, `:6349`, `:6388`, `:6396`), which is what puts it inside this gate's scope. It is
also the label that tells a lost user which section they are in, so colour is carrying meaning.

**Fix**, `index.html:6231`: `color: '#BF4C1A'` → **`'#7A2E08'`** (measured **5.36:1** on the same
backdrop, and 9.45:1 on white for the tablet layout where the gradient is lighter). `#8C2F0B` is the
minimum that passes (4.72:1) if a lighter rust is preferred; `#A83D0F` does **not** pass here (3.57:1).

## S8. The new help page fires the urgent red "call now" treatment for a calm informational question

`index.html:6283` — `const tone = topic.careLead ? NOTICE_TONES.urgent : NOTICE_TONES.attention;`
and `:6284` — `careHeading = topic.careLead ? 'Contact your care team' : 'Not medical advice'`.

`sym-medical-question` ships `careLead: true`, so a caregiver who taps *"Is this a side effect? Will
there be hair loss, sickness, tiredness — is this normal?"* is met with a **red** `#C0453B` 4px rule,
a red heart chip and the heading **"Contact your care team"** (measured `calloutBorder:
rgb(192,69,59)`; `outputs/v57-design/C-symtopic-320.png`).

That is the treatment the other four `careLead` pages earn honestly — `sym-severe` ("something new
and frightening is happening"), `vit-temp-high`, `vit-weight-change`, `miss-real-missed` — all of
which are *something is wrong right now*. This one is *what should I expect?* The comment directly
above the line I am citing (`index.html:6277–6282`, from Auditor finding V55-3) makes exactly this
argument in the opposite direction: *"an audience that is already frightened does not need a false
alarm."* v57 re-introduced the inversion the same comment was written to close.

I am not asking for `careLead: false` — that flag is load-bearing for the 23/50 care-team coverage
floor. Decouple the *tone* from the *routing*.

**Fix**, `index.html:6283–6284`:

```js
const calmCare = topic.careTone === 'calm';
const tone = (topic.careLead && !calmCare) ? NOTICE_TONES.urgent : NOTICE_TONES.attention;
const careHeading = topic.careLead ? (calmCare ? 'Ask your care team' : 'Contact your care team') : 'Not medical advice';
```

and add **`careTone: 'calm'`** to the `sym-medical-question` record (`index.html:2240`). The four
existing `careLead` pages are untouched and keep red. Recommend `test/v55-help.mjs` gain the
invariant that `careTone: 'calm'` is only ever set on a topic that is also `medical: true`, matching
the guard added in v57 §3.1.

---

# NICE TO HAVE

## N1. The two action labels are 6px out of alignment when the row wraps

`Got it` has `padding: '0 18px'` (`:3683`); `Open Help & FAQ` has `padding: '0 12px'` (`:3684`). At
320 and 360 the row wraps (measured: `Got it` top 987.4 / `Open Help & FAQ` top 1039.4 at 360), so the
two labels stack — and their text starts 6px apart on a ragged left edge
(`A-notice-actions-360.png`, `A-notice-actions-320.png` show it clearly). At 390 and 768 the row fits
on one line and the problem disappears.

**Fix:** `index.html:3684`, `padding: '0 12px'` → **`'0 18px'`**.

## N2. Three affordances for one dismissal

`Got it`, `✕`, and `Open Help & FAQ` all write the same pref. Once **S3** stops the third one
dismissing, consider dropping the ✕ as well — with M1's shorter card, `Got it` is on screen from the
start, and one clear "I've read it" is calmer than two. If the ✕ stays, it must be 44px (**M2**).

## N3. The notice is the same white as every card below it — 1.00:1, over 919px

Measured: notice `rgb(255,255,255)`; the Temperature card 18px below it `rgb(255,255,255)`. Card
border `#E9D8D1` against the peach backdrop is **1.28:1**, i.e. invisible. The only separator is the
4px amber rule at the left edge, which is off-screen the moment the eye is on the text.

Every banner in this app does this and it is fine at 90px. At 919px it means a tester scrolling
through the middle of the card cannot tell whether they are still reading the notice or have arrived
at the app (`A-notice-actions-360.png` — the card's bottom edge and the Temperature card read as one
continuous white column). **M1 largely dissolves this**; if the card still lands above ~600px after
the fix, set `background: '#FFFBF5'` on it (`index.html:3671`) so the notice has its own surface. Body
`#554A52` on `#FFFBF5` measures 8.19:1, so nothing else moves.

## N4. New help page title: 85 characters and two questions

`index.html:2213` — *"Is this a side effect? Will there be hair loss, sickness, tiredness — is this
normal?"*. It renders without breaking (4 lines / 94.9px at 320, verified —
`C-symcat-longrow-320.png`), so this is a scanning point, not a layout one: it is the longest row in
a 118-row corpus, it stacks two questions, and in the list it is the only row a reader has to parse
twice. Search behaviour is correct — typing "hair loss" ranks it first at all four widths, verified.

**Fix (optional, keeps every search term in the title):**
`'Is this normal? Hair loss, sickness, tiredness and other side effects'` — 68 characters, one
question, retains *normal*, *hair loss*, *sickness*, *tiredness*, *side effect*. Re-run
`test/v57-search.mjs` after; the `keywords` array already carries the rest.

## N5. At 768 the notice is the only full-bleed card on a two-column screen

Measured 688px wide against a ~70-character line, while Temperature/Weight sit in a 2-col grid beside
it (`A-notice-top-768.png`). It reads acceptably, but it is the one card that ignores the tablet
grid. **Fix:** add `maxWidth: '560px'` to `index.html:3671`.

## N6. Pre-existing, noted because 320 was in scope: the bottom nav wraps "In-Patient" to two lines

Visible at 320 in every capture (`A-notice-top-320.png`, `C-help-landing-320.png`). Not a v57 change;
logging it so it is on the record rather than rediscovered.

---

# Verified correct — do not "fix" these

Recorded so the next pass does not spend time here. All measured, not assumed.

- **The bubble removal left no hole.** Enumerated every `position: fixed` element on Home, Meds,
  Reports, In-Patient and Symptoms at 360 after removal: exactly two survive — the toast (z 50) and
  the nav (z 35, `rect [0,731,360,69]`). z-indexes 37 and 51 are unclaimed. `#helpbot-fab:focus-visible`
  is gone from the stylesheet. The page container's `paddingBottom: calc(90px + inset)`
  (`index.html:3316`) is byte-identical to v56, so nothing was reserving space for the bubble.
  Screenshot: `H-tab-symptoms-360.png`.
- **The toast clears the bottom nav.** Measured `navTop 731`, toast `bottom 712` → **19px** of
  clearance at both 320 and 360. The 96px revert is correct everywhere except the Reports detail
  (**M3**).
- **"Help & FAQ" fits the drawer at 320.** Drawer width 268.8px (`min(84vw, 320px)`); the label
  measures 152.2px on one line, the helper "Find and fix a problem" fits beside it, every row is 56px
  tall. No wrap, no crowding, at any width.
- **`HELP & FAQ` eyebrow does not wrap.** 87.0px wide, 15.6px tall, exactly one line, in a 288px row
  at 320 — on all four Help screens (landing, category, category-fallback, search results). Its
  *colour* is the problem (**S7**), not its length.
- **The new `sym-medical-question` row and topic hold up at every width.** Category row: 4 lines /
  94.9px at 320, 3 lines / 76.7px at 360 and 390, 2 lines / 58.4px at 768 — consistent with its
  neighbours, chevron never crowded, `documentElement.scrollWidth - innerWidth === 0` throughout.
  Topic `<h1>`: 4 / 3 / 3 / 2 lines at 320 / 360 / 390 / 768, no overflow.
  (`C-symcat-longrow-320.png`, `C-symtopic-320.png`.)
- **Zero horizontal overflow anywhere.** `documentElement.scrollWidth - window.innerWidth === 0` at
  320, 360, 390 and 768, on Home with the notice, Home with real medication data, the Help landing,
  a Help category, a Help topic, search results, the Reports list and the Reports detail.
- **The notice's gates hold.** Never rendered during the first-run guide (verified live at guide
  steps 1 and 2 — the `state.tourStep == null` gate is the only condition and it holds); never before
  prefs load; dismissal survives a full reload (verified). Profile-scoped persistence behaves as
  documented.
- **`isInstalledPWA()` / `isIOSDevice()` branch correctly.** Both branches were forced and rendered:
  real iPhone UA gives the Share-sheet wording, forced standalone gives the confirmation point. The
  detection is right; only the surrounding copy is (**S4**, **S5**).
- **`Got it` and `Open Help & FAQ` both clear 44px** (77×44 and 149.3×44) at every width, and both
  clear AA (4.92:1 and 6.29:1). Only the ✕ misses (**M2**).
- **Keyboard focus is correct on the notice.** Tab order is `Got it` → `Open Help & FAQ` → `✕` →
  Temperature input; the shared `button:focus-visible` ring (2px `#BF4C1A`, 2px offset) renders on all
  three against the white card at 4.92:1. `G-focus-x-360.png`.
- **The card's shell matches the house banner exactly** — 14px radius, `14px 16px` padding, 1px
  `#E9D8D1` border, 4px tone rule, `0 2px 10px rgba(203,122,87,0.10)` shadow, 32px / 10px-radius icon
  chip. Identical to `index.html:3874`, `:3910`, `:4410`. Only the *interior* (M1, S1) and the button
  tone (S6) drift.
- **Zero console errors** in every state at every width, once the sandbox's Capacitor CDN certificate
  failure is excluded.

---

## Screenshot index

`outputs/v57-design/` — 15 curated PNGs at `deviceScaleFactor: 2`, plus the reproduction harness
(`lib.mjs`, `seed.mjs`, `s1`–`s16.mjs`; run as
`env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy node sN.mjs` against
`python3 -m http.server 8901`).

| file | what it shows |
|---|---|
| `A-notice-top-360.png` | **M1** — the entire first screen is the notice, cut mid-sentence |
| `A-notice-top-320.png` | **M1** at 320 — 19.1 chars/line, 1,121.7px tall |
| `A-notice-actions-360.png` | **M1 / N1 / N3** — where the buttons actually are, and the ragged left edge |
| `A-notice-top-768.png` | the same component reading correctly at tablet width |
| `A-home-realdata-full-360.png` | the notice above three real medication cards and the journal |
| `E-toast-over-pill-360.png` | **M3** — "↩ Back" ghosting through the toast |
| `E-reports-detail-360.png` | **M3** baseline, same screen, no toast |
| `G-focus-x-360.png` | **M2** — the 28px ✕ and its focus ring |
| `F-after-dismiss-360.png` | **S2** — where "Got it" leaves you |
| `D-installed-notice-360.png` | **S5** — the installed branch contradicting its own title |
| `D-ios-notice-320.png` | **S4** — the iOS branch, real iPhone UA |
| `C-help-landing-320.png` | **S7** — `HELP & FAQ` at 2.79:1 on the gradient |
| `C-symcat-longrow-320.png` | **N4** — the long new row in the Symptoms list (renders correctly) |
| `C-symtopic-320.png` | **S8** — urgent red tone on a calm question |
| `H-tab-symptoms-360.png` | bubble removal left no hole |

---
---

# ROUND 2 — independent re-verification, app-v57

**Stage:** Designer (TEAM.md stage 4), round 2. **Author:** a second, independent Designer session,
2026-08-14. Round 1 above is left exactly as written; nothing in it was edited.

**How this round was run.** I picked this up cold. Round 1's findings were re-tested by
**re-measuring the rendered product**, not by reading the diff or trusting `outputs/DEV_v57.md` §6 —
that document was read only to know what to attack. The Auditor's round-2 report was read for its
R2-E / R2-F / R2-G findings, which touch UI in my scope.

**Server discipline.** Everything measured against `http://127.0.0.1:8901`, served from this repo.
`curl -s http://127.0.0.1:8901/index.html | md5sum` = `5d67ef6782ffc518c29c57f509e4f7cc` =
`md5sum index.html`, checked before the first measurement and again after the last. Port 8899 was
never touched. One private port (**8907**) served a *measurement copy* in `/tmp/dmut` — see M3 below
for exactly what one line was changed and why; every other number in this section comes from 8901.
All servers I started are killed.

**Note on the file under test.** `index.html` is md5 `5d67ef67…`; the Auditor's round 2 tested
`907a70f5…`. The tree has moved since his pass — his R2-F and R2-G copy fixes are in, and so is a
change he did *not* ask for that closes his R2-E (see "R2-E" below). So his READY was given on
different bytes than the ones I measured.

**Method.** 9 Playwright harnesses (`d1`…`d12` in `outputs/v57-design/r2/`), 320 / 360 / 390 / 768 at
`deviceScaleFactor: 2`, plus 320×568 (iPhone SE) and three keyboard-open heights. Fresh browser
context per profile, real first-run flow every time, and the notice card measured on a Home screen
carrying **three real medications added through the real editor** (Ondansetron/Zofran,
Dexamethasone, Paracetamol/Acetaminophen). Contrast is WCAG 2.1 relative luminance computed against
the **actual composited backdrop**, sampled out of the rendered PNG (a zlib PNG decoder in
`dlib.mjs`) — not against an assumed white, and not from the ancestor chain, because the page
backdrop is a gradient. Where a sample is taken *beside* the glyph run rather than through it, that
is stated. Console: **zero** real errors in every run at every width, once the sandbox's Capacitor
CDN certificate failure is excluded.

---

## Verdict

**NOT READY.** One Must-fix, three Should-fix.

Round 1's eleven M/S findings are **all genuinely fixed** — I re-measured every one and each holds
up, several of them better than DEV_v57 claims. M3 in particular is now closed twice over. That is a
real result and it should be said plainly.

What is not ready is the **care-team strip on the Help search-results screen**, which no Designer had
seen before this round. It is a good idea, well-executed in colour and touch target, and at 320 and
360 it pushes **every result — including the "Nothing matched that" empty state — underneath the
bottom nav**, so the answer to the question a person just typed is not on the screen. Its heading and
its body also say the same sentence twice, which is what makes it that tall. And separately: on a
genuine first run at 320 and 360, the "Welcome to ChemoWell" toast paints across the new notice
card's privacy line and the top of its "Got it" button — the same collision class this release has
now fixed twice elsewhere, in the one moment the notice exists for.

---

# ROUND-1 FINDINGS — RE-VERIFIED

Every number below is mine, measured this round. Where DEV_v57 §6 gives a figure, I have recorded
whether my measurement agrees.

## M1 — the wall of text. **FIXED.** 320 measured for the first time.

Home, real-data profile, fresh install, non-iOS UA:

| viewport | card height | body column | chars/line (longest body) | round 1 |
|---|---|---|---|---|
| **320×720** | **586.1px** | **251px** | **33.5** | 1,121.7px / 167px / 19.1 |
| **360×720** | **547.7px** | **291px** | **33.5** | 919.0px / 207px / 24.3 |
| **390×844** | **528.2px** | **321px** | **44.7** | 773.3px / 237px / 29.7 |
| 768×1024 | 391.2px | 651px | 67.0 | 441.9px / 597px / ~70 |

DEV_v57 claims 548 at 360 and 528 at 390 — **both confirmed exactly** (547.7 / 528.2). **320 was
never measured before; it is 586.1px**, a 48% reduction, and it is the widest gap between the claim
and the untested case, so it was worth measuring: it is fine.

The card is now 586px of a 2,030px Home page at 320 (29%, was 37% at 360) and it reads as a notice.
`D1-notice-320.png` and `D1-notice-360.png` are the whole first screen: title, intro, three headed
points and the privacy line are all visible without scrolling at both widths.

**33.5 chars/line is still under the 45 floor and that is not a defect.** A 291px column at
13px/500 cannot hold 45 characters — 36 is the arithmetic ceiling. Round 1 said this itself. The
structural fix (icon and ✕ out of the body's flex row) landed: the column went 207 → 291 at 360
(+41%) and 167 → 251 at 320 (+50%).

**One thing the fix did not update, recorded so it is on the file, not raised as a finding.** The
header row still carries `paddingRight: '36px'` (`index.html:3719`), sized for the old 28px ✕. The ✕
is now 44px at `right: 10px`, so it needs 54px. Measured: the title's box right edge is 252 at 320
and 292 at 360; the ✕'s left edge is 249 and 289 — a **3px box overlap** at both. It does not clip a
glyph today (longest rendered title line is 171px of a 212px box at 360, and the installed branch's
longer title wraps before it reaches the ✕ — `D8-installed-notice-360.png`), so nothing is broken.
It is one number out of sync with another, and `paddingRight: '54px'` would make it honest.

## M2 — the 28px ✕. **FIXED.**

Measured **44.0 × 44.0** at 320, 360, 390 and 768; `display: flex`, `alignItems: center`,
`justifyContent: center`, `fontSize: 15px`, `color: rgb(107,92,99)` = `#6B5C63`. Position
`absolute`, `top 10 / right 10`, so it costs the body column nothing — confirmed by M1's column
widths above.

Contrast, two ways: **computed** `#6B5C63` on `rgba(124,97,86,0.10)` over the card's new `#FFFBF5`
= **5.37:1**; **sampled** from the rendered pixels (darkest glyph pixel `rgb(107,92,99)` against the
chip's modal pixel `rgb(242,235,229)`) = **5.33:1**. Both clear the 4.5:1 floor. DEV_v57 says 5.50 —
that is the figure against a white card; the card is `#FFFBF5` now (N3), which costs 0.13. Immaterial,
but 5.33 is the number that is true of the shipped screen.

## M3 — the toast over the "Back to reports" pill. **FIXED, and closed twice.**

I could not reproduce round 1's overlap at all, for two independent reasons, and both are worth
recording because only one of them is the fix DEV_v57 describes.

**First: `navigateTo()` now clears any toast in flight** (`index.html:2511`, `if (state.toast)
next.toast = null;`). Measured live: fire a toast on Home, tap Reports — the toast is gone before the
Reports list paints. That closes the *carry-in* route completely, and it is also the real fix for the
Auditor's R2-E (see below). I checked it is safe: no handler in the file calls `setToast()` and then
`navigateTo()` (grep, both orders, ±3 lines) — 103 `setToast` call sites, zero of them navigate. So
no confirmation message is swallowed by this.

**Second: the lift itself is correct.** With the carry-in route closed, nothing on the Reports detail
calls `setToast()`, so a toast on that screen is now unreachable through the UI. To prove the lift
anyway I served a **measurement copy** on port 8907 whose *only* change is that `setToast()` also
assigns itself to `window.__setToast`; `toastNeedsLift()`, the toast's styles and the pill are
byte-identical. Then, standing on the real Reports → History detail:

| | 320 | 360 | 390 |
|---|---|---|---|
| `toastNeedsLift()` | **true** | true | true |
| toast `bottom` | **142px** | 142px | 142px |
| 1-line toast | bottom 578, pill top 590 → **12px clear** | 12px | 12px |
| 2-line toast (82.8px) | bottom 578 → **12px clear** | 12px | 12px |
| **3-line toast (141.6px)** | bottom 578 → **12px clear** | 12px | 12px |
| vertical overlap | **−12px (none)** | −12 | −12 |

The three-line case is the one that matters: the toast grows **upward** from a fixed bottom edge, so
message length can never re-open the collision. Round 1's warning about that is answered.
Control, same toast on the Reports **list** and on Home: `toastNeedsLift()` **false**, `bottom: 96px`,
**27px** of clearance above the nav at every width. `D9-lift-reportsdetail-360.png`,
`D9-lift-3line-360.png`.

**Medication editor at keyboard-open heights — no regression.** Editor opened at 320×360, 360×380 and
390×420 with the name field focused, then its own validation toast fired ("Enter a medication name
before saving."). Toast `bottom: 96px`, `toastNeedsLift()` false, **zero** collisions with any fixed
or sticky element (the only fixed furniture in the editor is the header at z20 and the nav at z35;
the "Add medication" submit is 1,700px down the scroll, nowhere near it). `D11-mededitor-kb-360.png`.

## S1 — type hierarchy. **FIXED.**
Measured computed styles inside the card: title **15px/700**, sub-point headings **14px/700**
(`lineHeight 1.35`, `marginBottom 3px`, `marginTop 16px` on the wrapper), bodies **13px/500**
(`lineHeight 1.5`). 15 / 14 / 13 with a 200-unit weight step between heading and body, exactly as
specified. Body at 500 rather than 600 is visible in `D1-notice-360.png` — the card no longer reads
as one uniform semibold block, and the three points read as three.

## S2 — dismiss strands the viewport. **FIXED.**
Scrolled Home to `scrollY 400` (doc 1,697), tapped "Got it": `scrollY` **0**, doc 1,132.
`D8-after-dismiss-360.png`. This is the check the Auditor's R2-B says the shipped suite cannot make —
it is made here, against the running app.

## S3 — "Open Help & FAQ". **FIXED.**
The control now reads **"More about the web version"** and lands on
**"I'm using ChemoWell in a web browser, not the installed app"** (`rem-web-vs-app`) — not the Help
landing. It carries a working back row ("← Reminders & notifications") and the full detail that came
out of the card, including the 7-day Safari eviction. The notice **survives**: still on Home after
navigating back, and still there after a full reload. `D8-readmore-360.png`.

## S4 — iOS/Android branch. **FIXED.**
Real iPhone UA, 320: *"Tap Share, then Add to Home Screen. Safari deletes a site's saved data after 7
days without a visit — and your log is stored nowhere else."* Default UA, same width: *"Open your
browser menu, then Add to Home screen. It keeps your log one tap away and out of reach of anything
that clears browser data."* No Safari sentence anywhere in the Android body. The whole body branches,
not the instruction. `D8-ios-notice-320.png`.

## S5 — installed-PWA branch. **FIXED.**
Forced `display-mode: standalone` + `navigator.standalone`: title **"A couple of things about the
browser version"**, intro **"Everything works, and your log is already safe. Two things still behave
differently here:"**, first point **"Your log is safe on this device"**. Two things promised, two
things delivered, and the title no longer calls an installed app a preview. `D8-installed-notice-360.png`.

## S6 — button tone. **FIXED.**
"Got it" background sampled from the rendered pixels: **`rgb(140,89,0)`** = `#8C5900` =
`NOTICE_TONES.attention.chipFg`. White on it = **5.93:1**. No gradient. "More about the web version"
is `#8C5900` text on the card at **5.75:1**. Card, rule, chip and both buttons are now one colour
family.

## S7 — the `HELP & FAQ` eyebrow. **FIXED.**
`color: rgb(122,46,8)` = `#7A2E08`, 12px/700, sampled against the real gradient beside the glyphs:

| screen | 320 | 360 | 390 | 768 |
|---|---|---|---|---|
| Help landing | backdrop `rgb(255,169,163)` → **5.18:1** | 5.21:1 | 5.21:1 | 5.21:1 |
| Help category | `rgb(255,176,162)` → **5.39:1** | 5.39:1 | 5.39:1 | 5.30:1 |

All clear 4.5:1 (round 1 measured 2.79:1). The `appIcon('help', 19)` beside it inherits the same
colour, so it clears the 3:1 non-text floor too. I measured landing and category rather than all four
screens because the eyebrow sits at a fixed `y` of 181.1 on every one of them and the gradient is a
function of `y` only — the search-results and category-fallback screens are the same pixel.
My 5.18 at 320 is a shade under DEV_v57's 5.36; both pass, and 5.18 is the number on the tightest
screen.

## S8 — `careTone`. **FIXED. All five pages verified, at 320 and 360.**
Each page reached through the real search box and opened by its own title:

| topic | heading | callout rule | chip |
|---|---|---|---|
| `sym-medical-question` | **"Ask your care team"** | **`rgb(181,118,30)` amber** | `rgba(181,118,30,…)` |
| `sym-severe` | "Contact your care team" | `rgb(192,69,59)` red | red |
| `vit-temp-high` | "Contact your care team" | `rgb(192,69,59)` red | red |
| `vit-weight-change` | "Contact your care team" | `rgb(192,69,59)` red | red |
| `miss-real-missed` | "Contact your care team" | `rgb(192,69,59)` red | red |

Identical at both widths. The four original `careLead` pages are untouched red; only the calm one
moved. `D7-calm-360.png`.

## N1 — button padding. **FIXED.** Both `0px 18px`, both `44px` tall, both left edges at `x = 36` when
the row wraps at 320 and 360. Measured, no ragged edge.

## N3 — the card's own surface. **FIXED.** Card `rgb(255,251,245)` = `#FFFBF5`; the Temperature card
below it `rgb(250,247,246)`. Body `#554A52` on `#FFFBF5` = **8.19:1**, title **15.14:1** — nothing
else moved, as predicted. The two surfaces are only 1.03:1 apart, which is a small step, but with the
card now 586px instead of 919 the boundary is visible in one screen and the 4px amber rule is on
screen with it. Adequate.

## N2 — dropping the ✕. **The Lead Developer's decline is right, and I would have made the same call.**
Measured, not assumed: with the card at 547.7px at 360, "Got it" is at `y 616` on first paint and the
✕ is at `y 190.4` — both within one short scroll, and the ✕ is a real 44px target. Two dismissals of
the same weight would be worse than one big one and one small one. Keep it.

## N4 — the long title. **FIXED** (title now 62 chars, "Side effects — hair loss, sickness,
tiredness: is this normal?"). In the Symptoms category list it renders 3 lines / 76.7px at 320 and
360, 2 lines at 390, 1 line at 768 — consistent with its neighbours, chevron never crowded. In the
topic view the `<h1>` is 3 / 3 / 3 / 1 lines. `D5-symcat-320.png`. It is still two clauses, but it is
one question, and it is no longer the row that has to be read twice.

---

# NEW FINDINGS

## MUST FIX

### R2D-1. The care-team strip pushes every search result — and the empty state — under the bottom nav at 320 and 360

**Screen:** Help & FAQ → search results. **Viewports:** 320×720 and 360×720 (390 and 768 are fine).
`index.html:6458–6463`.

Measured live, every query type, nav top at `y 651` at both widths:

| | 320 | 360 | 390 | 768 |
|---|---|---|---|---|
| strip occupies | **y 360.4 → 595.8 (235.4px)** | y 360.4 → 576.3 (215.9px) | 360.4 → 556.8 | 360.4 → 499.6 |
| strip as % of usable height above the nav | **36.2%** | 33.2% | 26.0% | 15.6% |
| first result row top | y 629.8 | y 610.3 | y 590.8 | y 533.6 |
| **result rows fully above the nav** | **0 of 12** | **0 of 12** | 2 | 6 |
| "Nothing matched that" (empty state) | top y 628.8 — **22px sliver** | 609.3 — 42px sliver | 589.8 — visible | visible |
| its "Try a single plain word…" line | **entirely below the fold** | entirely below the fold | visible | visible |

`D3-strip-320-empty.png` is the clearest statement of the problem: a person mistypes, and the screen
they get back is the search box, a 235px advisory, and a half-cut heading. The app's answer to their
question is not on it. `D3-strip-360-many.png` is the same shape with 12 real results —
"I forgot to log yesterday's doses" is bisected by the nav.

This is not an argument against the strip. Above the results is the right place for it and the
Auditor is right that it does the job. But the Auditor's clearance figures ("first result row at
y=610, fold at 710"; "strip 360→583, fold at 630" at 320) treat the fold as the viewport edge and do
not subtract the **69px fixed bottom nav**, which is opaque and paints over the content. Against the
real usable height the count is 0 rows at 360, not 2.

**The height is avoidable, because the strip says the same sentence twice.** Heading:
*"ChemoWell can't tell you if something is serious"*. Body, first clause:
*"ChemoWell holds no medical information and can't tell you whether something is serious."* The
heading is a verbatim restatement of half the body — visible in every capture, and most obvious at
768 (`D3-strip-768-many.png`) where both sit on one screen. TEAM.md's copy rule is explicit that
copy should not repeat itself; here the repetition is also what costs 3 lines of height.

**Fix**, `index.html:6460` — cut the duplicated clause from the body, keep the heading (the Auditor's
R2-F wording is good and should stay):

```js
h('div', { style: { fontSize: '13px', fontWeight: '500', color: '#554A52', lineHeight: '1.5', marginTop: '3px' } },
  'It holds no medical information. For anything about symptoms, doses, or how someone is feeling, contact the care team.'),
```

118 characters instead of 173. **These are measured, not estimated** — I substituted the string into
the live DOM at each width, left every style untouched, and re-read the geometry
(`d13-proposed.mjs`):

| | 320 as shipped | 320 with the cut | 360 as shipped | 360 with the cut | 390 with the cut |
|---|---|---|---|---|---|
| body lines | 6 | **4** | 5 | **3** | 3 |
| strip height | 235.4px | **196.4px** | 215.9px | **176.9px** | 176.9px |
| first row top / bottom | 629.8 / 709.4 | **590.8 / 670.4** | 610.3 / 689.9 | **571.3 / 650.9** | 571.3 / 632.7 |
| rows fully above the nav | 0 | 0 | **0** | **1** | 2 |

**−39.0px at both 320 and 360.** At 360 that is the whole fix: the first result row lands fully above
the nav. At 320 it is not — the row's bottom is still 19.4px under it — but it changes the outcome
from *a 21px sliver* to *the row's question title fully legible with only its category sub-label
clipped* (62.2px of a 79.6px row visible; the two title lines occupy the first 47.4px). A partly
visible row also signals that the list scrolls, which a hidden one does not. I would accept that at
320.

Adding **`padding: '11px 14px'`** to the strip (`index.html:6458`, from `12px 14px`) buys a further
2.0px at every width — measured, worth taking, not sufficient alone.

The remaining lever, if 320 is judged still short, is the heading, which wraps to 2 lines at every
phone width (24 chars/line). **"ChemoWell can't tell you if it's serious"** (39 chars) drops it to
**1 line at 360 and 390** — measured strip 156.7px, first row 551.1, and at 390 a third row comes
above the fold — but it stays at 2 lines at 320, so it does not help the width that needs it. Take
the body cut first: it is a copy defect on its own merits, and it is the one I would ship regardless
of the fold.

**Do not fix this by shortening the button or removing the strip.** The button is the strongest thing
on the screen and is the reason the strip works.

---

## SHOULD FIX

### R2D-2. On a real first run the "Welcome to ChemoWell" toast paints across the notice card's privacy line and its primary button

**Screen:** Home, first run. **Viewports:** 320×720, 360×720, 390×844 — all three.
`index.html:2940` (`completeSetup`) vs `index.html:3717–3743` (the notice card).

`completeSetup()` fires `setToast('Welcome to ChemoWell')` and, on the next line, sets `tourStep: 0`.
The notice is gated on `tourStep == null`, so it paints the moment the person taps **Skip guide** —
which is one tap, well inside the toast's 4.5s life. Measured on the real first-run flow, 1.24s after
"Get started":

| viewport | toast rect | what it covers |
|---|---|---|
| **320×720** | y 560.8–624 | *"Download CSV and Print/PDF save to your Downloads folder."* — **27.6px × 160px**; *"Everything you log stays on this device."* — **21.6px × 160px** |
| **360×720** | y 560.8–624 | the privacy line **in full** (that line is 19.5px tall; overlap 19.5px × 180px); the top **8px** of the **"Got it"** button |
| **390×844** | y 684.8–748 | the top **7.7px** of **"More about the web version"** (180.7px wide) |

`D12-firstrun-toast-over-notice-360.png`, `D12-firstrun-toast-over-notice-320.png`.

Taps still land (`pointerEvents: none`), and it clears itself after ~3.3 more seconds. It is still the
first four seconds of the product, on the one card this release exists to add, and the line it blots
out at 360 is *"Everything you log stays on this device."* — the privacy promise. This is the same
collision class as M3 and as the Auditor's R2-E, both of which this release decided were worth
fixing; this instance was missed because both of those were found on other screens.

**Do not fix this with `toastNeedsLift()`.** The comment at `index.html:107` is right: a constant
lift can only clear a constant, and the notice card scrolls. Suppress the greeting instead — the card
*is* the greeting on this run, and two at once is one too many.

**Fix**, `index.html:2940`:

```js
// The browser notice is itself the first thing this person is greeted with, and a 96px toast
// paints across its privacy line and its "Got it" button at 320/360. One greeting, not two.
if (isNativeApp() || getPrefsDB().browserNoticeSeen) setToast('Welcome to ChemoWell');
```

(`getPrefsDB()` is already read on the following line, so it is in scope and loaded.) Native builds
and every later profile keep the greeting exactly as it is now.

### R2D-3. The "closest 12 of 19" count line fails AA, and is 1,092px below the fold — after the rows it is describing

**Screen:** Help & FAQ → search results. **Viewports:** all four. `index.html:6472–6475`.

Two separate problems in one new element.

**Contrast.** `color: '#7A6E76'`, 13px/600, rendered on the **page gradient** — the section has no
background (`backgroundColor: rgba(0,0,0,0)`). Sampled 6px to the right of the glyph run, same `y`:

| viewport | backdrop | ratio | AA 4.5:1 |
|---|---|---|---|
| 320 | `rgb(255,218,174)` | **3.68:1** | fail |
| 360 | `rgb(255,216,171)` | **3.63:1** | fail |
| 768 | `rgb(255,200,149)` | **3.23:1** | fail |

`#7A6E76` is a house token (85 uses) and is fine on the white card surfaces it usually sits on
(**4.86:1** on `#FFFFFF`). This line is one of the few places it is used **directly on the gradient**,
and it is new in v57, which is what puts it in scope. It is also the line carrying the fact that
**46 matches are being withheld** — colour is doing load-bearing work here.

**Fix**, `index.html:6473`: `color: '#7A6E76'` → **`'#5E4337'`** — measured **6.81:1** on
`rgb(255,218,174)`, **6.71:1** on `rgb(255,216,171)`, **5.98:1** on `rgb(255,200,149)`: passes at
every width with margin, and it is already a house token (20 uses) for text of this weight.
`#554A52` also passes (6.39 / 6.30 / 5.61) if a neutral is preferred. **`#6B5C63` must not be used
here** — 4.76 / 4.69 / **4.18**, so it fails at 768 exactly where the gradient is deepest.

**Position.** The line renders **after** the list. Measured with 12 rows: `y 1,721.4` at 320 (doc
1,850) and `y 1,629` at 360 — **1,070–1,092px below the fold**, i.e. only reachable by scrolling past
all twelve rows first. The sentence exists so that a person can decide whether to search again; they
make that decision at the top of the list, not the bottom.

**Fix:** move the `results.length ? h('section', …)` count block from after `listCard(...)` to
**immediately before it** (`index.html:6466`), and give it `marginBottom: '-4px'` so it reads as a
caption on the list rather than a card of its own. At 320 that puts it at `y ≈ 600` — the last thing
read before the rows, which is where it does its job.

### R2D-4. The strip, the search card and the results card are three identical white cards in a row

**Screen:** Help & FAQ → search results. **Viewports:** all four. `index.html:6458`.

Measured from the rendered pixels: strip surface `rgb(255,255,255)`, result-row surface
`rgb(255,255,255)` at 360/390/768 and `rgb(254,253,253)` at 320 — **1.00:1 to 1.02:1**. The search
card above it is `#FFFFFF` too. All three share `1px #E9D8D1` and a 14–17px radius. The strip's only
distinguishing feature is its 4px amber left rule, which is at the extreme left edge and off the eye's
path once it is reading the copy — the same argument round 1 made in **N3** about the notice card,
which was accepted and fixed with a surface change.

The strip is the one element on this screen that is not a search affordance and not a result. It
should not be the same material as both of them.

**Fix**, `index.html:6458`: `background: '#FFFFFF'` → **`'#FFFBF5'`**, matching the notice card's
treatment exactly. Re-checked against that surface: heading `#2A2127` **15.14:1**, body `#554A52`
**8.19:1**, and the `#8C5900` button is unchanged at **5.93:1** — nothing else moves. This is
cosmetic on its own; taken with R2D-1 it is what makes the strip read as *an aside above the results*
rather than *the first result*.

---

## NICE TO HAVE

### R2D-5. At 320 the notice's "Got it" lands 3px under the bottom nav on first paint
Measured 320×720: card 179.4 → 765.4, "Got it" at `y 654.4`, nav top `651` — the primary action is
**fully covered** on first paint, so the card appears to have no action until the person scrolls
~55px. At 360×720 it is 80% visible (`y 616–660` against a nav top of 651, 9px clipped) — see
`D1-notice-360.png`. On a real 320×568 device (iPhone SE) it needs ~130px of scroll
(`D8-notice-320x568.png`). This is a consequence of a 586px card in a 651px usable height and it is
much better than round 1's 808px; I am not asking for another copy cut. If a cheap 40px is wanted,
the intro line *"Everything works. Three things are different in a browser:"* (2 lines at 320/360) is
the least load-bearing sentence in the card — the three headings already say there are three things.

### R2D-6. The lifted toast and the "Back" pill read as one stacked object at 12px apart
Measured 12px of clearance at every width (M3 above). Both are `rgba(59,25,10,0.88)`, both centred,
both pill-shaped, and 12px is roughly one line-gap — `D9-lift-reportsdetail-360.png` reads as a
two-storey dark block. The collision is gone and that was the finding; this is only about it looking
deliberate. **Fix (optional):** `index.html:3360`, `142px` → **`150px`**, which gives 20px of
separation and still leaves the toast 40px clear of the nav.

### R2D-7. The deep-linked help page's back row points somewhere the reader has never been
Tapping "More about the web version" on Home lands on `rem-web-vs-app` with a back row reading
**"← Reminders & notifications"** (`D8-readmore-360.png`). The person came from Home, not from that
category, so "back" is an invitation into a section they did not ask for. Everything works; it is an
orientation wrinkle. **Fix (optional):** when `state.help` is set from outside the Help centre, label
the row **"← Home"** and route it to `navigateTo('home')`.

### R2D-8. The strip's button label wraps to two lines at every phone width
"When to call the care team straight away" measures 2 lines inside its 44px box at 320, 360 and 390
(1 line at 768). It fits — 2 × 16.9px of line box in 44px — and R2-G's wording is a genuine
improvement on "them". Recorded only so it is a known state, not a surprise. If a one-line label at
390 is wanted: **"When to call the care team now"** (30 chars) fits one line at 360 and 390 and keeps
the antecedent R2-G was added for.

### R2D-9. At 768 the notice card and the strip are the only full-bleed elements on a two-column screen
Re-measured, unchanged from round 1's **N5**: notice 688px wide at 67 chars/line, strip 688px at
**86.5 chars/line** — over the 80-character cap of WCAG 1.4.8. Both sit full width while their
neighbours are in a 2-col grid. Not taken in round 1 and I am not escalating it. **Fix:**
`maxWidth: '560px'` on `index.html:3717` (notice) and `index.html:6458` (strip).

---

# VERIFIED CORRECT — do not spend time here again

All measured this round, not assumed.

- **The Auditor's R2-E is already closed, by a better fix than the one he proposed.** He asked for the
  search screen to be added to `toastNeedsLift()`. Instead `navigateTo()` clears the toast
  (`index.html:2511`), so no toast can reach the Help search screen at all. Re-tested his exact
  repro at 320, 360 and 390 — log on Home, menu, Help & FAQ, type within 4.5s: **the toast is gone
  before the Help screen paints**, at every width. Zero overlap with the strip's button. The
  structural fix is the right one: it closes the whole class rather than one screen, and it left
  `toastNeedsLift()` doing only the job it is commented for.
- **R2-F and R2-G are in.** The heading reads "ChemoWell can't tell you if something is serious" and
  the button "When to call the care team straight away". (R2-F's fix is what creates R2D-1's
  duplication — the heading was added and the body was left unchanged.)
- **The strip's own contrast and target are clean at every width.** Heading `#2A2127` 13.5px/700 =
  **15.61:1**; body `#554A52` 13px/500 = **8.44:1**; button white on `rgb(140,89,0)` = **5.93:1**;
  button **255×44 / 295×44 / 325×44 / 331×44** at 320 / 360 / 390 / 768 — every one clears 44px.
- **The strip renders on all four states.** 12-row capped list, 6-row list, 2-row list and the
  "Nothing matched that" empty state, at all four widths — 16 combinations, present every time,
  always above the results, never conditional.
- **The strip does not read as boilerplate.** This was asked explicitly. It does not: the filled
  `#8C5900` button is the only filled element on the screen, and nothing else near it is an advisory.
  Reading order at 360 is the person's own words → the heading → the sentence → a dark 44px button.
  My objection is the height it costs, not the tone.
- **The count line's copy is right.** "The closest 12 of 58 matches" for a capped list, "6 results" /
  "2 results" for an uncapped one — verified live on both paths. Telling someone 46 matches were
  withheld is the honest call and it should stay.
- **Zero horizontal overflow.** `documentElement.scrollWidth − innerWidth === 0` at 320, 360, 390 and
  768 on the Home notice, Home with three real medications, the Help landing, a Help category, a Help
  topic, all four search states, the Reports list and the Reports detail.
- **Zero console errors** in every run at every width, with the Capacitor CDN certificate failure
  excluded as the sandbox artefact it is.
- **The notice card's shell still matches the house banner** — 14px radius, `14px 16px` padding, 1px
  `#E9D8D1`, 4px tone rule, `0 2px 10px rgba(203,122,87,0.10)`, 32px / 10px-radius icon chip. Only
  the surface changed (N3), deliberately.
- **The shortened help title behaves in both places** — category row and topic `<h1>`, all four
  widths, no overflow, chevron never crowded.

---

## Round 2 verdict

**NOT READY.**

- **R2D-1 (Must-fix)** — at 320 and 360 the search-results screen shows the person no result at all
  above the bottom nav, including the empty state, and the strip is that tall partly because its
  heading and its body say the same thing. One copy cut (measured, −39.0px) fixes 360 outright and
  takes 320 from a 21px sliver to a legible first row title.
- **R2D-2, R2D-3, R2D-4 (Should-fix)** — the welcome toast over the new notice card on first run; the
  new count line at 3.23–3.68:1 and 1,000px below the rows it describes; the strip indistinguishable
  from the results.
- Five Nice-to-haves, none of which should hold a release.

Every round-1 Must-fix and Should-fix is genuinely fixed, and M3 is fixed twice over. The work in
this round-2 build is good. What it has not had is a designer's eyes on the screen the High was fixed
on — this is the first pass over it, and it found a fold problem and a repeated sentence that a
second look was always going to find.

Per TEAM.md's restart rule, R2D-1 and R2D-3 are copy/colour/order changes and R2D-2 is a one-line
gate — none is functional or data-relevant, so the targeted-fix tier applies: the Lead Developer
fixes them and this stage re-verifies those four directly against the running product. That is a
short loop, not another full round.

## Screenshot index — `outputs/v57-design/r2/`

18 curated PNGs at `deviceScaleFactor: 2`; the other 63 captures are in `r2/all/`. Harnesses
`dlib.mjs` and `d1`–`d13` reproduce every number (`d13-proposed.mjs` is the one that measures the
**proposed** R2D-1 strings by substituting them into the live DOM, so the fix's savings are measured
rather than estimated)
(`env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy node dN.mjs` against
`python3 -m http.server 8901 --directory <repo>`).

| file | what it shows |
|---|---|
| `D3-strip-320-empty.png` | **R2D-1** — the empty state cut in half by the nav; its advice line off-screen |
| `D3-strip-360-many.png` | **R2D-1** — 12 results, first row bisected by the nav |
| `D3-strip-320-many.png` | **R2D-1** at 320 |
| `D3-strip-768-many.png` | the strip reading correctly at tablet width; the duplicated sentence at its clearest |
| `D12-firstrun-toast-over-notice-360.png` | **R2D-2** — the welcome toast over the privacy line and "Got it" |
| `D12-firstrun-toast-over-notice-320.png` | **R2D-2** at 320 |
| `D1-notice-320.png` | **M1 fixed** — 586.1px at 320, the whole notice on one screen |
| `D1-notice-360.png` | **M1 fixed** — 547.7px; **M2** the 44px ✕; **R2D-5** the clipped "Got it" |
| `D8-notice-320x568.png` | the card on a real iPhone SE |
| `D8-installed-notice-360.png` | **S5** — the installed branch, coherent |
| `D8-ios-notice-320.png` | **S4** — the iOS branch, real iPhone UA |
| `D8-readmore-360.png` | **S3** — deep link to `rem-web-vs-app`; **R2D-7** the back row |
| `D8-after-dismiss-360.png` | **S2** — dismissal returns to the top of Home |
| `D9-lift-reportsdetail-360.png` | **M3 fixed** — 12px clear of the pill; **R2D-6** |
| `D9-lift-3line-360.png` | **M3** — a three-line toast still clears, because it grows upward |
| `D11-mededitor-kb-360.png` | the 96px toast in the med editor at a keyboard-open height — no regression |
| `D7-calm-360.png` | **S8** — "Ask your care team" on amber |
| `D5-symcat-320.png` | **N4** — the shortened title in the category list |
